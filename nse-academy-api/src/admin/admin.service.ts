import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { ConfigService } from '@nestjs/config';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';

type MonthRow = { month: string };
type GrowthRow = MonthRow & { count: bigint };
type TrendRow = MonthRow & { active: bigint; cancelled: bigint };

@Injectable()
export class AdminService {
  private analyticsClient: BetaAnalyticsDataClient | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
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
    if (tier || status) {
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
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _pw, ...rest } = user;
    return rest;
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
    const tierBreakdown = {
      free: tierStats.find(t => t.tier === 'free')?._count ?? 0,
      intermediary: tierStats.find(t => t.tier === 'intermediary')?._count ?? 0,
      premium: tierStats.find(t => t.tier === 'premium')?._count ?? 0,
    };
    const estimatedMRR = tierBreakdown.intermediary * 100 + tierBreakdown.premium * 500;

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
        console.error('GA Fetch Error:', err);
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
