import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { BrevoService } from '../brevo/brevo.service';
import { AuthService } from '../auth/auth.service';
import { CorporateService } from '../corporate/corporate.service';
import { JournalService } from '../journal/journal.service';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpsertLicenseDto } from './dto/upsert-license.dto';

type MonthRow = { month: string };
type GrowthRow = MonthRow & { count: bigint };
type TrendRow = MonthRow & { active: bigint; cancelled: bigint };

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private analyticsClient: BetaAnalyticsDataClient | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private brevo: BrevoService,
    private auth: AuthService,
    private corporate: CorporateService,
    private journal: JournalService,
  ) {
    const propertyId = this.configService.get<string>('GA_PROPERTY_ID');
    const clientEmail = this.configService.get<string>('GA_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('GA_PRIVATE_KEY');

    if (propertyId && clientEmail && privateKey) {
      this.analyticsClient = new BetaAnalyticsDataClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
      });
    }
  }

  async listUsers(params: {
    page: number;
    limit: number;
    search?: string;
    tier?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { page, limit, search, tier, status, sortBy, sortOrder } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tier === 'free' && !status) {
      // A user with no Subscription row at all is free tier by definition
      // (see deriveEffectiveTier) - the naive `subscription.tier = 'free'`
      // relation filter below would only match users who *do* have a row,
      // silently excluding the majority of free users who never got one.
      // Nested under AND (not OR) so it composes with the search filter's
      // own OR above instead of overwriting it.
      where.AND = [{ OR: [{ subscription: null }, { subscription: { tier: 'free' } }] }];
    } else if (tier || status) {
      where.subscription = {};
      if (tier) where.subscription.tier = tier;
      if (status) where.subscription.status = status;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy) {
      if (sortBy === 'subscription.tier' || sortBy === 'subscription.status' || sortBy === 'subscription.currentPeriodEnd') {
        const field = sortBy.split('.')[1];
        orderBy = { subscription: { [field]: sortOrder || 'asc' } };
      } else {
        orderBy = { [sortBy]: sortOrder || 'asc' };
      }
    }
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          subscription: {
            select: {
              tier: true,
              status: true,
              currentPeriodEnd: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        investorProfile: true,
        subscription: true,
        ebookPurchase: { orderBy: { purchasedAt: 'desc' } },
        orgMembership: { include: { org: true } },
        referralsMade: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [
      lessonsCompleted,
      referredBy,
      portfolio,
      realizedGains,
      dividendsTotal,
      notificationsUnread,
      priceAlertsActive,
    ] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { userId: id, completed: true } }),
      this.prisma.referral.findUnique({
        where: { referredId: id },
        include: { referrer: { select: { id: true, name: true, email: true } } },
      }),
      this.journal.getPortfolio(id),
      this.journal.getRealizedGainsSummary(id),
      this.prisma.dividend.aggregate({ where: { userId: id }, _sum: { amountKes: true } }),
      this.prisma.notification.count({ where: { userId: id, read: false } }),
      this.prisma.priceAlert.count({ where: { userId: id, status: 'pending' } }),
    ]);

    const { passwordHash: _pw, ebookPurchase, orgMembership, referralsMade, ...rest } = user;

    return {
      ...rest,
      ebookPurchases: ebookPurchase,
      organization: orgMembership
        ? {
            id: orgMembership.org.id,
            name: orgMembership.org.name,
            role: orgMembership.role,
            inviteAccepted: orgMembership.inviteAccepted,
            joinedAt: orgMembership.joinedAt,
          }
        : null,
      referredBy: referredBy
        ? { id: referredBy.referrer.id, name: referredBy.referrer.name, email: referredBy.referrer.email }
        : null,
      referralsMadeCount: referralsMade.length,
      lessonsCompleted,
      portfolio: {
        totalMarketValueKes: portfolio.totalMarketValueKes,
        totalCostBasisKes: portfolio.totalCostBasisKes,
        totalUnrealizedGainKes: portfolio.totalUnrealizedGainKes,
        holdingsCount: portfolio.consolidated.length,
        holdings: portfolio.consolidated,
      },
      totalRealizedGainKes: realizedGains.totalRealizedGainKes,
      totalDividendsKes: dividendsTotal._sum.amountKes ?? 0,
      notificationsUnread,
      priceAlertsActive,
    };
  }

  async listEbookPurchases(params: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { reference: { contains: search, mode: 'insensitive' } },
        { productId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [purchases, total] = await Promise.all([
      this.prisma.ebookPurchase.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { purchasedAt: 'desc' },
      }),
      this.prisma.ebookPurchase.count({ where }),
    ]);

    return {
      data: purchases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEbookPurchase(id: string) {
    const purchase = await this.prisma.ebookPurchase.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!purchase) throw new NotFoundException('Ebook purchase not found');
    return purchase;
  }

  async listInvestorProfiles(params: {
    page: number;
    limit: number;
    search?: string;
    type?: string;
    capitalRange?: string;
  }) {
    const { page, limit, search, type, capitalRange } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (type) where.type = type;
    if (capitalRange) where.capitalRange = capitalRange;

    const [profiles, total] = await Promise.all([
      this.prisma.investorProfile.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.investorProfile.count({ where }),
    ]);

    return {
      data: profiles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getInvestorProfile(id: string) {
    const profile = await this.prisma.investorProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!profile) throw new NotFoundException('Investor profile not found');
    return profile;
  }

  async listLessonProgresses(params: {
    page: number;
    limit: number;
    search?: string;
    completed?: string;
  }) {
    const { page, limit, search, completed } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { lessonId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (completed === 'true') where.completed = true;
    if (completed === 'false') where.completed = false;

    const [progresses, total] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { completedAt: 'desc' },
      }),
      this.prisma.lessonProgress.count({ where }),
    ]);

    return {
      data: progresses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLessonProgress(id: string) {
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!progress) throw new NotFoundException('Lesson progress not found');
    return progress;
  }

  async listOrganizations(params: {
    page: number;
    limit: number;
    search?: string;
    type?: string;
  }) {
    const { page, limit, search, type } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { licenseKey: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (type) where.type = type;

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        skip,
        take: limit,
        where,
        include: {
          license: true,
          _count: { select: { members: true } }
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: organizations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        license: true,
        members: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  /**
   * Admin-driven org setup for offline (bank transfer / invoice) deals with
   * an arbitrary seat count, bypassing the self-serve Paystack flow
   * entirely. Looks up the admin-to-be by email; creates a new account for
   * them (with a password-reset email so they can log in) if none exists.
   */
  async createOrganizationWithLicense(dto: CreateOrganizationDto) {
    const adminEmail = dto.adminEmail.trim().toLowerCase();
    let adminUser = await this.prisma.user.findFirst({
      where: { email: { equals: adminEmail, mode: 'insensitive' } },
    });

    if (!adminUser) {
      const tempPassword = randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      adminUser = await this.prisma.user.create({
        data: { name: dto.adminName, email: adminEmail, passwordHash },
      });
      await this.auth.issuePasswordReset(adminUser);
    }

    const existingMembership = await this.prisma.orgMember.findUnique({
      where: { userId: adminUser.id },
    });
    if (existingMembership) {
      throw new BadRequestException('This user already belongs to an organization');
    }

    const org = await this.corporate.createOrganization(adminUser.id, {
      name: dto.name,
      type: dto.type,
      email: dto.orgEmail,
    });

    await this.upsertOrganizationLicense(org.id, dto.license);

    return this.getOrganization(org.id);
  }

  async upsertOrganizationLicense(orgId: string, dto: UpsertLicenseDto) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const referenceFields =
      dto.paymentMethod === 'offline'
        ? { paystackReference: null, offlineReference: dto.offlineReference ?? null }
        : { offlineReference: null };

    const existing = await this.prisma.corporateLicense.findUnique({ where: { orgId } });
    const seatsUsed = existing
      ? undefined
      : await this.prisma.orgMember.count({ where: { orgId, inviteAccepted: true } });

    return this.prisma.corporateLicense.upsert({
      where: { orgId },
      create: {
        orgId,
        tier: 'premium',
        seats: dto.seats,
        seatsUsed: seatsUsed ?? 0,
        status: dto.status ?? 'active',
        currentPeriodEnd: new Date(dto.currentPeriodEnd),
        paymentMethod: dto.paymentMethod,
        amountKes: dto.amountKes,
        ...referenceFields,
      },
      update: {
        seats: dto.seats,
        status: dto.status ?? 'active',
        currentPeriodEnd: new Date(dto.currentPeriodEnd),
        paymentMethod: dto.paymentMethod,
        amountKes: dto.amountKes,
        ...referenceFields,
      },
    });
  }

  async updateOrgMemberRole(orgId: string, memberId: string, role: 'admin' | 'member') {
    return this.corporate.updateMemberRole(orgId, memberId, role);
  }

  async resendOrgMemberInvite(orgId: string, memberId: string) {
    return this.corporate.resendInvite(orgId, memberId);
  }

  async removeOrgMember(orgId: string, memberId: string) {
    return this.corporate.removeMember(orgId, memberId);
  }

  private webUrl(): string {
    return (
      this.configService.get<string>('WEB_URL') ||
      this.configService.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  async listAdvisors(params: { page: number; limit: number; search?: string; status?: string }) {
    const { page, limit, search, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.approvalStatus = status;
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.advisorProfile.findMany({
        skip,
        take: limit,
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { clients: true, queries: true, insights: true, alerts: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.advisorProfile.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAdvisor(id: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        org: { select: { id: true, name: true } },
        _count: { select: { clients: true, queries: true, insights: true, alerts: true } },
        clients: {
          take: 10,
          orderBy: { requestedAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        queries: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        insights: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!advisor) throw new NotFoundException('Advisor not found');
    return advisor;
  }

  async approveAdvisor(id: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!advisor) throw new NotFoundException('Advisor not found');

    const updated = await this.prisma.advisorProfile.update({
      where: { id },
      data: { approvalStatus: 'approved', approvedAt: new Date() },
    });

    try {
      await this.brevo.sendTransactional({
        to: { email: advisor.user.email, name: advisor.user.name },
        subject: "You're approved as an NSE Academy advisor",
        htmlContent: `<p>Good news, ${advisor.user.name} - your financial advisor profile has been approved and is now live in the NSE Academy advisor directory.</p><p><a href="${this.webUrl()}/dashboard/advisor">Go to your advisor dashboard</a></p>`,
        textContent: `Good news, ${advisor.user.name} - your financial advisor profile has been approved and is now live in the NSE Academy advisor directory.\n\n${this.webUrl()}/dashboard/advisor`,
        tags: ['advisor-approved'],
      });
    } catch (err) {
      this.logger.error(`Failed to send advisor-approved email to ${advisor.user.email}: ${(err as Error).message}`);
    }

    return updated;
  }

  async suspendAdvisor(id: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id } });
    if (!advisor) throw new NotFoundException('Advisor not found');

    return this.prisma.advisorProfile.update({
      where: { id },
      data: { approvalStatus: 'suspended' },
    });
  }

  async listReferrals(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { referrer: { name: { contains: search, mode: 'insensitive' } } },
        { referrer: { email: { contains: search, mode: 'insensitive' } } },
        { referred: { name: { contains: search, mode: 'insensitive' } } },
        { referred: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [referrals, total] = await Promise.all([
      this.prisma.referral.findMany({
        skip,
        take: limit,
        where,
        include: {
          referrer: { select: { name: true, email: true } },
          referred: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.referral.count({ where }),
    ]);

    return {
      data: referrals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReferral(id: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      include: {
        referrer: { select: { id: true, name: true, email: true } },
        referred: { select: { id: true, name: true, email: true } },
      },
    });
    if (!referral) throw new NotFoundException('Referral not found');
    return referral;
  }

  async listContactSubmissions(params: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [submissions, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactSubmission.count({ where }),
    ]);

    return {
      data: submissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getContactSubmission(id: string) {
    const submission = await this.prisma.contactSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Contact submission not found');
    return submission;
  }

  /**
   * The market poll writes a fresh row per ticker every 7 minutes with no
   * upsert, so StockPrice is a pure time-series table - listing it "raw"
   * means the same counter shows up dozens of times. This returns exactly
   * one row per ticker (its most recent poll) via the same DISTINCT ON
   * query MarketDataService.getLatestPrices() already uses.
   */
  async listStockPrices() {
    const prices = await this.prisma.$queryRaw`
      SELECT DISTINCT ON (ticker) *
      FROM "StockPrice"
      ORDER BY ticker, timestamp DESC
    `;
    return { data: prices };
  }

  async getStockPriceHistory(ticker: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const history = await this.prisma.stockPrice.findMany({
      where: { ticker: { equals: ticker, mode: 'insensitive' }, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    });
    if (history.length === 0) throw new NotFoundException('No price history found for this ticker');
    return { ticker: ticker.toUpperCase(), data: history };
  }

  async upsertSubscription(userId: string, dto: UpsertSubscriptionDto) {
    await this.getUser(userId);
    return this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: dto.tier,
        status: dto.status,
        currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null,
      },
      update: {
        tier: dto.tier,
        status: dto.status,
        currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null,
      },
    });
  }

  async cancelSubscription(userId: string) {
    await this.getUser(userId);
    return this.prisma.subscription.update({
      where: { userId },
      data: { status: 'cancelled' },
    });
  }

  async getAnalytics() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
      totalUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      subscriptionStats,
      tierStats,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: startOfThisMonth } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: true }),
      this.prisma.subscription.groupBy({ by: ['tier'], _count: true }),
    ]);

    const activeSubscriptions = subscriptionStats.find(s => s.status === 'active')?._count ?? 0;
    const cancelledSubscriptions = subscriptionStats.find(s => s.status === 'cancelled')?._count ?? 0;
    const intermediaryCount = tierStats.find(t => t.tier === 'intermediary')?._count ?? 0;
    const premiumCount = tierStats.find(t => t.tier === 'premium')?._count ?? 0;
    const tierBreakdown = {
      // Users without a Subscription row are free tier by definition (see
      // deriveEffectiveTier) - groupBy only sees rows that exist, so "free"
      // has to be everyone else rather than a group count of its own.
      free: totalUsers - intermediaryCount - premiumCount,
      intermediary: intermediaryCount,
      premium: premiumCount,
    };
    const estimatedMRR = tierBreakdown.intermediary * 300 + tierBreakdown.premium * 500;

    const [userGrowthRaw, subTrendRaw] = await Promise.all([
      this.prisma.$queryRaw<GrowthRow[]>`
        SELECT TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS month, COUNT(*) AS count
        FROM "User"
        WHERE "createdAt" >= ${twelveMonthsAgo}
        GROUP BY month ORDER BY month`,
      this.prisma.$queryRaw<TrendRow[]>`
        SELECT TO_CHAR(u."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
          SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN s.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
        FROM "User" u
        JOIN "Subscription" s ON s."userId" = u.id
        WHERE u."createdAt" >= ${twelveMonthsAgo}
        GROUP BY month ORDER BY month`,
    ]);

    const userGrowth = this.fillMonths(
      userGrowthRaw.map(r => ({ month: r.month, count: Number(r.count) })),
      twelveMonthsAgo, now, { count: 0 },
    );
    const subscriptionTrend = this.fillMonths(
      subTrendRaw.map(r => ({ month: r.month, active: Number(r.active), cancelled: Number(r.cancelled) })),
      twelveMonthsAgo, now, { active: 0, cancelled: 0 },
    );

    const [totalCompletions, uniqueLearnersRaw, topLessonsRaw] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { completed: true } }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT "userId") AS count FROM "LessonProgress" WHERE completed = true`,
      this.prisma.$queryRaw<Array<{ lessonId: string; completions: bigint }>>`
        SELECT "lessonId", COUNT(*) AS completions
        FROM "LessonProgress" WHERE completed = true
        GROUP BY "lessonId" ORDER BY completions DESC LIMIT 10`,
    ]);

    const [referralGrouped, topReferrersRaw] = await Promise.all([
      this.prisma.referral.groupBy({ by: ['status'], _count: true }),
      this.prisma.$queryRaw<Array<{ userId: string; name: string; email: string; referralCount: bigint }>>`
        SELECT r."referrerId" AS "userId", u.name, u.email, COUNT(*) AS "referralCount"
        FROM "Referral" r
        JOIN "User" u ON u.id = r."referrerId"
        GROUP BY r."referrerId", u.name, u.email
        ORDER BY "referralCount" DESC LIMIT 5`,
    ]);

    const totalReferrals = referralGrouped.reduce((s, r) => s + r._count, 0);
    const completedReferrals = referralGrouped.find(r => r.status === 'completed')?._count ?? 0;
    const pendingReferrals = referralGrouped.find(r => r.status === 'pending')?._count ?? 0;

    const [profileTotal, byTypeRaw, byCapitalRaw, avgRiskRaw] = await Promise.all([
      this.prisma.investorProfile.count(),
      this.prisma.investorProfile.groupBy({ by: ['type'], _count: true }),
      this.prisma.investorProfile.groupBy({ by: ['capitalRange'], _count: true }),
      this.prisma.investorProfile.aggregate({ _avg: { riskScore: true } }),
    ]);

    const [
      totalTrades,
      tradesBySide,
      usersWithTrades,
      topTickersRaw,
      costBasisRaw,
      totalAlerts,
      alertsByStatus,
      usersWithAlerts,
      totalDividends,
      dividendAmountRaw,
      dividendsBySource,
      realizedGainRaw,
      realizedGainCount,
      totalStatementImports,
      importsByStatus,
      totalBrokers,
    ] = await Promise.all([
      this.prisma.trade.count(),
      this.prisma.trade.groupBy({ by: ['side'], _count: true }),
      this.prisma.trade.findMany({ select: { userId: true }, distinct: ['userId'] }).then(r => r.length),
      this.prisma.$queryRaw<Array<{ ticker: string; count: bigint }>>`
        SELECT ticker, COUNT(*) AS count FROM "Trade"
        GROUP BY ticker ORDER BY count DESC LIMIT 10`,
      this.prisma.$queryRaw<[{ total: number | null }]>`
        SELECT SUM(quantity * "avgCost") AS total FROM "Holding" WHERE "avgCost" IS NOT NULL`,
      this.prisma.priceAlert.count(),
      this.prisma.priceAlert.groupBy({ by: ['status'], _count: true }),
      this.prisma.priceAlert.findMany({ select: { userId: true }, distinct: ['userId'] }).then(r => r.length),
      this.prisma.dividend.count(),
      this.prisma.dividend.aggregate({ _sum: { amountKes: true } }),
      this.prisma.dividend.groupBy({ by: ['source'], _count: true }),
      this.prisma.realizedGain.aggregate({ _sum: { realizedGainKes: true } }),
      this.prisma.realizedGain.count(),
      this.prisma.statementImport.count(),
      this.prisma.statementImport.groupBy({ by: ['status'], _count: true }),
      this.prisma.broker.count({ where: { isActive: true } }),
    ]);

    const [
      totalAdvisors,
      advisorsByStatus,
      totalConnections,
      connectionsByStatus,
      totalQueries,
      queriesByStatus,
      avgResponseRaw,
      totalInsights,
      emailedInsights,
      totalAdvisorAlerts,
      advisorAlertsByAction,
      advisorAlertRecipientsRaw,
    ] = await Promise.all([
      this.prisma.advisorProfile.count(),
      this.prisma.advisorProfile.groupBy({ by: ['approvalStatus'], _count: true }),
      this.prisma.advisorClient.count(),
      this.prisma.advisorClient.groupBy({ by: ['status'], _count: true }),
      this.prisma.advisorQuery.count(),
      this.prisma.advisorQuery.groupBy({ by: ['status'], _count: true }),
      this.prisma.$queryRaw<[{ avg_hours: number | null }]>`
        SELECT AVG(EXTRACT(EPOCH FROM (first_advisor_msg."createdAt" - q."createdAt")) / 3600.0) AS avg_hours
        FROM "AdvisorQuery" q
        JOIN LATERAL (
          SELECT "createdAt" FROM "AdvisorQueryMessage"
          WHERE "queryId" = q.id AND "senderRole" = 'advisor'
          ORDER BY "createdAt" ASC LIMIT 1
        ) first_advisor_msg ON true`,
      this.prisma.advisorInsight.count(),
      this.prisma.advisorInsight.count({ where: { emailedAt: { not: null } } }),
      this.prisma.advisorAlert.count(),
      this.prisma.advisorAlert.groupBy({ by: ['action'], _count: true }),
      this.prisma.advisorAlert.aggregate({ _sum: { recipientCount: true } }),
    ]);

    const advisorFeatures = {
      advisors: {
        total: totalAdvisors,
        pending: advisorsByStatus.find(a => a.approvalStatus === 'pending')?._count ?? 0,
        approved: advisorsByStatus.find(a => a.approvalStatus === 'approved')?._count ?? 0,
        suspended: advisorsByStatus.find(a => a.approvalStatus === 'suspended')?._count ?? 0,
      },
      clients: {
        totalConnections,
        accepted: connectionsByStatus.find(c => c.status === 'accepted')?._count ?? 0,
        pending: connectionsByStatus.find(c => c.status === 'pending')?._count ?? 0,
        declined: connectionsByStatus.find(c => c.status === 'declined')?._count ?? 0,
      },
      queries: {
        total: totalQueries,
        open: queriesByStatus.find(q => q.status === 'open')?._count ?? 0,
        answered: queriesByStatus.find(q => q.status === 'answered')?._count ?? 0,
        avgResponseHours: avgResponseRaw[0]?.avg_hours != null ? Math.round(Number(avgResponseRaw[0].avg_hours) * 10) / 10 : null,
      },
      insights: {
        total: totalInsights,
        emailedCount: emailedInsights,
      },
      alerts: {
        total: totalAdvisorAlerts,
        buy: advisorAlertsByAction.find(a => a.action === 'BUY')?._count ?? 0,
        sell: advisorAlertsByAction.find(a => a.action === 'SELL')?._count ?? 0,
        totalRecipients: advisorAlertRecipientsRaw._sum.recipientCount ?? 0,
      },
    };

    const [
      totalEbookPurchases,
      ebookRevenueRaw,
      ebookGuestCount,
      totalContactSubmissions,
      contactByStatus,
    ] = await Promise.all([
      this.prisma.ebookPurchase.count(),
      this.prisma.ebookPurchase.aggregate({ _sum: { amountKes: true } }),
      this.prisma.ebookPurchase.count({ where: { userId: null } }),
      this.prisma.contactSubmission.count(),
      this.prisma.contactSubmission.groupBy({ by: ['status'], _count: true }),
    ]);

    const ebookFeatures = {
      totalPurchases: totalEbookPurchases,
      totalRevenueKes: ebookRevenueRaw._sum.amountKes ?? 0,
      guestPurchases: ebookGuestCount,
      accountPurchases: totalEbookPurchases - ebookGuestCount,
    };

    const contactFeatures = {
      totalSubmissions: totalContactSubmissions,
      new: contactByStatus.find(c => c.status === 'new')?._count ?? 0,
      read: contactByStatus.find(c => c.status === 'read')?._count ?? 0,
      replied: contactByStatus.find(c => c.status === 'replied')?._count ?? 0,
    };

    const journalFeatures = {
      trades: {
        total: totalTrades,
        buy: tradesBySide.find(t => t.side === 'BUY')?._count ?? 0,
        sell: tradesBySide.find(t => t.side === 'SELL')?._count ?? 0,
        usersWithTrades,
        topTickers: topTickersRaw.map(r => ({ ticker: r.ticker, count: Number(r.count) })),
      },
      portfolio: {
        aggregateCostBasisKes: Number(costBasisRaw[0]?.total ?? 0),
      },
      priceAlerts: {
        total: totalAlerts,
        pending: alertsByStatus.find(a => a.status === 'pending')?._count ?? 0,
        triggered: alertsByStatus.find(a => a.status === 'triggered')?._count ?? 0,
        cancelled: alertsByStatus.find(a => a.status === 'cancelled')?._count ?? 0,
        usersWithAlerts,
      },
      dividends: {
        total: totalDividends,
        totalAmountKes: dividendAmountRaw._sum.amountKes ?? 0,
        manual: dividendsBySource.find(d => d.source === 'MANUAL')?._count ?? 0,
        cdscImport: dividendsBySource.find(d => d.source === 'CDSC_IMPORT')?._count ?? 0,
      },
      realizedGains: {
        totalKes: realizedGainRaw._sum.realizedGainKes ?? 0,
        closedPositions: realizedGainCount,
      },
      statementImports: {
        total: totalStatementImports,
        completed: importsByStatus.find(i => i.status === 'completed')?._count ?? 0,
        failed: importsByStatus.find(i => i.status === 'failed')?._count ?? 0,
      },
      brokers: {
        activeCount: totalBrokers,
      },
    };

    let googleAnalytics: any = null;
    if (this.analyticsClient) {
      try {
        const propertyId = this.configService.get<string>('GA_PROPERTY_ID');
        const [response] = await this.analyticsClient.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
            { name: 'sessions' },
            { name: 'bounceRate' },
          ],
        });

        const rows = response.rows || [];
        const totalActiveUsers = rows.reduce((s, r) => s + Number(r.metricValues?.[0]?.value ?? 0), 0);
        const totalPageViews = rows.reduce((s, r) => s + Number(r.metricValues?.[1]?.value ?? 0), 0);
        const dailyStats = rows.map((r) => ({
          date: r.dimensionValues?.[0]?.value,
          users: Number(r.metricValues?.[0]?.value ?? 0),
          views: Number(r.metricValues?.[1]?.value ?? 0),
        })).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

        googleAnalytics = {
          totalActiveUsers,
          totalPageViews,
          dailyStats,
          avgBounceRate: Math.round((rows.reduce((s, r) => s + Number(r.metricValues?.[3]?.value ?? 0), 0) / (rows.length || 1)) * 100) / 100,
        };
      } catch (err) {
        this.logger.error(`GA Fetch Error: ${(err as Error).message}`);
      }
    }

    return {
      overview: {
        totalUsers,
        newUsersThisMonth,
        newUsersLastMonth,
        activeSubscriptions,
        cancelledSubscriptions,
        tierBreakdown,
        estimatedMRR,
      },
      userGrowth,
      subscriptionTrend,
      googleAnalytics, // Added GA data
      journalFeatures,
      advisorFeatures,
      ebookFeatures,
      contactFeatures,
      brevoConfigured: this.brevo.hasCredentials(),
      lessonProgress: {
        totalCompletions,
        uniqueLearners: Number(uniqueLearnersRaw[0].count),
        topLessons: topLessonsRaw.map(r => ({ lessonId: r.lessonId, completions: Number(r.completions) })),
      },
      referrals: {
        total: totalReferrals,
        completed: completedReferrals,
        pending: pendingReferrals,
        conversionRate: totalReferrals > 0
          ? Math.round((completedReferrals / totalReferrals) * 10000) / 100
          : 0,
        topReferrers: topReferrersRaw.map(r => ({ ...r, referralCount: Number(r.referralCount) })),
      },
      investorProfiles: {
        total: profileTotal,
        byType: {
          conservative: byTypeRaw.find(t => t.type === 'conservative')?._count ?? 0,
          moderate: byTypeRaw.find(t => t.type === 'moderate')?._count ?? 0,
          aggressive: byTypeRaw.find(t => t.type === 'aggressive')?._count ?? 0,
          dividend: byTypeRaw.find(t => t.type === 'dividend')?._count ?? 0,
          growth: byTypeRaw.find(t => t.type === 'growth')?._count ?? 0,
        },
        byCapitalRange: {
          '<100k': byCapitalRaw.find(c => c.capitalRange === '<100k')?._count ?? 0,
          '100k-500k': byCapitalRaw.find(c => c.capitalRange === '100k-500k')?._count ?? 0,
          '500k-2M': byCapitalRaw.find(c => c.capitalRange === '500k-2M')?._count ?? 0,
          '>2M': byCapitalRaw.find(c => c.capitalRange === '>2M')?._count ?? 0,
        },
        avgRiskScore: Math.round(((avgRiskRaw._avg.riskScore ?? 0) as number) * 10) / 10,
      },
    };
  }

  listBrokers() {
    return this.prisma.broker.findMany({ orderBy: { name: 'asc' } });
  }

  async updateBroker(
    id: string,
    data: { feePercent?: number; cdaCode?: string | null; cdsRequired?: boolean; isActive?: boolean },
  ) {
    const broker = await this.prisma.broker.findUnique({ where: { id } });
    if (!broker) throw new NotFoundException('Broker not found');
    return this.prisma.broker.update({ where: { id }, data });
  }

  private fillMonths<T extends { month: string }>(
    data: T[],
    from: Date,
    to: Date,
    defaults: Omit<T, 'month'>,
  ): T[] {
    const map = new Map(data.map(d => [d.month, d]));
    const result: T[] = [];
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cur <= to) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      result.push(map.get(key) ?? ({ month: key, ...defaults } as T));
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }
}
