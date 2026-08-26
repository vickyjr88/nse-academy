import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { CorporateService } from '../corporate/corporate.service';
import { JournalService } from '../journal/journal.service';
import { CreateAdvisorProfileDto } from './dto/create-advisor-profile.dto';
import { UpdateAdvisorProfileDto } from './dto/update-advisor-profile.dto';
import { SubmitQueryDto } from './dto/submit-query.dto';
import { AnswerQueryDto } from './dto/answer-query.dto';
import { PublishInsightDto } from './dto/publish-insight.dto';
import { SendAlertDto } from './dto/send-alert.dto';

@Injectable()
export class FinancialAdvisorService {
  private readonly logger = new Logger(FinancialAdvisorService.name);

  constructor(
    private prisma: PrismaService,
    private brevo: BrevoService,
    private corporate: CorporateService,
    private journal: JournalService,
    private config: ConfigService,
  ) {}

  private webUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  async becomeAdvisor(userId: string, dto: CreateAdvisorProfileDto) {
    const existing = await this.prisma.advisorProfile.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('You already have an advisor profile');

    const membership = await this.corporate.getUserOrg(userId);
    const orgId = membership && membership.role === 'admin' ? membership.orgId : undefined;

    const profile = await this.prisma.advisorProfile.create({
      data: {
        userId,
        orgId,
        headline: dto.headline,
        bio: dto.bio,
        specialties: dto.specialties ?? [],
        credentials: dto.credentials,
        photoUrl: dto.photoUrl,
        isPublic: dto.isPublic ?? true,
      },
    });

    if (orgId) {
      const orgMembers = await this.prisma.orgMember.findMany({ where: { orgId, inviteAccepted: true } });
      for (const member of orgMembers) {
        if (member.userId === userId) continue;
        await this.prisma.advisorClient.upsert({
          where: { advisorId_userId: { advisorId: profile.id, userId: member.userId } },
          create: {
            advisorId: profile.id,
            userId: member.userId,
            status: 'accepted',
            source: 'org_member',
            respondedAt: new Date(),
          },
          update: {},
        });
      }
    }

    return profile;
  }

  async updateAdvisorProfile(userId: string, dto: UpdateAdvisorProfileDto) {
    const profile = await this.prisma.advisorProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Advisor profile not found');

    return this.prisma.advisorProfile.update({
      where: { userId },
      data: dto,
    });
  }

  getMyAdvisorProfile(userId: string) {
    return this.prisma.advisorProfile.findUnique({ where: { userId } });
  }

  private async getAdvisorProfileOrThrow(userId: string) {
    const profile = await this.prisma.advisorProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('You do not have an advisor profile');
    return profile;
  }

  async listPublicAdvisors(params: { specialty?: string; page: number; limit: number }) {
    const { specialty, page, limit } = params;
    const skip = (page - 1) * limit;
    const where: any = { isPublic: true, isActive: true };
    if (specialty) where.specialties = { has: specialty };

    const [data, total] = await Promise.all([
      this.prisma.advisorProfile.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.advisorProfile.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPublicAdvisorProfile(advisorId: string) {
    const profile = await this.prisma.advisorProfile.findUnique({
      where: { id: advisorId },
      include: { user: { select: { name: true } } },
    });
    if (!profile || !profile.isPublic || !profile.isActive) {
      throw new NotFoundException('Advisor not found');
    }
    return profile;
  }

  async requestConnection(advisorId: string, userId: string) {
    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: advisorId } });
    if (!advisor || !advisor.isActive) throw new NotFoundException('Advisor not found');
    if (advisor.userId === userId) throw new BadRequestException('You cannot connect with yourself');

    const existing = await this.prisma.advisorClient.findUnique({
      where: { advisorId_userId: { advisorId, userId } },
    });
    if (existing) throw new BadRequestException('You have already requested or connected with this advisor');

    return this.prisma.advisorClient.create({
      data: { advisorId, userId, status: 'pending', source: 'request' },
    });
  }

  listMyConnections(userId: string) {
    return this.prisma.advisorClient.findMany({
      where: { userId },
      include: { advisor: { include: { user: { select: { name: true } } } } },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async respondToConnection(userId: string, clientRowId: string, accept: boolean) {
    const advisor = await this.getAdvisorProfileOrThrow(userId);
    const row = await this.prisma.advisorClient.findUnique({ where: { id: clientRowId } });
    if (!row || row.advisorId !== advisor.id) throw new NotFoundException('Connection request not found');

    return this.prisma.advisorClient.update({
      where: { id: clientRowId },
      data: { status: accept ? 'accepted' : 'declined', respondedAt: new Date() },
    });
  }

  async listMyClients(userId: string, status?: string) {
    const advisor = await this.getAdvisorProfileOrThrow(userId);
    return this.prisma.advisorClient.findMany({
      where: { advisorId: advisor.id, ...(status ? { status } : {}) },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { requestedAt: 'desc' },
    });
  }

  private async assertAcceptedClient(advisorId: string, userId: string) {
    const row = await this.prisma.advisorClient.findUnique({
      where: { advisorId_userId: { advisorId, userId } },
    });
    if (!row || row.status !== 'accepted') {
      throw new ForbiddenException('This user is not a connected client');
    }
  }

  async getClientProfile(advisorUserId: string, clientUserId: string) {
    const advisor = await this.getAdvisorProfileOrThrow(advisorUserId);
    await this.assertAcceptedClient(advisor.id, clientUserId);

    const [user, investorProfile, lessonsCompleted, portfolio, realizedGains] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientUserId },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      }),
      this.prisma.investorProfile.findUnique({ where: { userId: clientUserId } }),
      this.prisma.lessonProgress.count({ where: { userId: clientUserId, completed: true } }),
      this.journal.getPortfolio(clientUserId),
      this.journal.getRealizedGainsSummary(clientUserId),
    ]);

    if (!user) throw new NotFoundException('Client not found');

    return {
      ...user,
      investorProfile,
      lessonsCompleted,
      portfolio: {
        totalMarketValueKes: portfolio.totalMarketValueKes,
        totalCostBasisKes: portfolio.totalCostBasisKes,
        totalUnrealizedGainKes: portfolio.totalUnrealizedGainKes,
        holdingsCount: portfolio.consolidated.length,
        holdings: portfolio.consolidated,
      },
      totalRealizedGainKes: realizedGains.totalRealizedGainKes,
    };
  }

  async submitQuery(userId: string, advisorId: string, dto: SubmitQueryDto) {
    await this.assertAcceptedClient(advisorId, userId);
    const query = await this.prisma.advisorQuery.create({
      data: { advisorId, userId, question: dto.question },
    });

    const advisor = await this.prisma.advisorProfile.findUnique({ where: { id: advisorId } });
    if (advisor) {
      void this.notifyAndEmail(
        advisor.userId,
        'ADVISOR_QUERY',
        'New question from a client',
        dto.question.length > 140 ? `${dto.question.slice(0, 140)}...` : dto.question,
        `${this.webUrl()}/dashboard/advisor`,
      );
    }

    return query;
  }

  async listQueriesForAdvisor(userId: string, status?: string) {
    const advisor = await this.getAdvisorProfileOrThrow(userId);
    return this.prisma.advisorQuery.findMany({
      where: { advisorId: advisor.id, ...(status ? { status } : {}) },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listMyQueries(userId: string) {
    return this.prisma.advisorQuery.findMany({
      where: { userId },
      include: { advisor: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async answerQuery(advisorUserId: string, queryId: string, dto: AnswerQueryDto) {
    const advisor = await this.getAdvisorProfileOrThrow(advisorUserId);
    const query = await this.prisma.advisorQuery.findUnique({ where: { id: queryId } });
    if (!query || query.advisorId !== advisor.id) throw new NotFoundException('Query not found');

    const updated = await this.prisma.advisorQuery.update({
      where: { id: queryId },
      data: { reply: dto.reply, status: 'answered', answeredAt: new Date() },
    });

    void this.notifyAndEmail(
      query.userId,
      'ADVISOR_QUERY_ANSWERED',
      'Your advisor replied to your question',
      dto.reply,
      `${this.webUrl()}/dashboard/advisor`,
    );

    return updated;
  }

  async publishInsight(advisorUserId: string, dto: PublishInsightDto) {
    const advisor = await this.getAdvisorProfileOrThrow(advisorUserId);
    const insight = await this.prisma.advisorInsight.create({
      data: { advisorId: advisor.id, title: dto.title, body: dto.body, tickers: dto.tickers ?? [] },
    });

    const clients = await this.prisma.advisorClient.findMany({
      where: { advisorId: advisor.id, status: 'accepted' },
      select: { userId: true },
    });

    const link = `${this.webUrl()}/dashboard/insights`;
    for (const c of clients) {
      void this.notifyAndEmail(c.userId, 'ADVISOR_INSIGHT', dto.title, dto.body, link);
    }

    await this.prisma.advisorInsight.update({ where: { id: insight.id }, data: { emailedAt: new Date() } });

    return insight;
  }

  async listAdvisorInsights(userId: string) {
    const advisor = await this.getAdvisorProfileOrThrow(userId);
    return this.prisma.advisorInsight.findMany({ where: { advisorId: advisor.id }, orderBy: { createdAt: 'desc' } });
  }

  async listInsightsForClient(userId: string) {
    const connections = await this.prisma.advisorClient.findMany({
      where: { userId, status: 'accepted' },
      select: { advisorId: true },
    });
    const advisorIds = connections.map((c) => c.advisorId);
    if (advisorIds.length === 0) return [];

    return this.prisma.advisorInsight.findMany({
      where: { advisorId: { in: advisorIds } },
      include: { advisor: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async sendAlert(advisorUserId: string, dto: SendAlertDto) {
    const advisor = await this.getAdvisorProfileOrThrow(advisorUserId);
    const ticker = dto.ticker.toUpperCase().trim();

    const clients = await this.prisma.advisorClient.findMany({
      where: { advisorId: advisor.id, status: 'accepted' },
      select: { userId: true },
    });
    let recipientIds = clients.map((c) => c.userId);

    if (dto.action === 'SELL' && recipientIds.length > 0) {
      const holders = await this.prisma.holding.findMany({
        where: { userId: { in: recipientIds }, ticker, quantity: { gt: 0 } },
        select: { userId: true },
      });
      const holderIds = new Set(holders.map((h) => h.userId));
      recipientIds = recipientIds.filter((id) => holderIds.has(id));
    }

    const title = `${dto.action === 'BUY' ? 'Buy' : 'Sell'} alert: ${ticker}`;
    const link = `${this.webUrl()}/dashboard/advisor`;
    for (const userId of recipientIds) {
      void this.notifyAndEmail(userId, 'ADVISOR_ALERT', title, dto.message, link);
    }

    return this.prisma.advisorAlert.create({
      data: {
        advisorId: advisor.id,
        ticker,
        action: dto.action,
        message: dto.message,
        recipientCount: recipientIds.length,
      },
    });
  }

  async listMyAlerts(userId: string) {
    const advisor = await this.getAdvisorProfileOrThrow(userId);
    return this.prisma.advisorAlert.findMany({ where: { advisorId: advisor.id }, orderBy: { createdAt: 'desc' } });
  }

  private async notifyAndEmail(userId: string, type: string, title: string, body: string, link: string): Promise<void> {
    await this.prisma.notification.create({ data: { userId, type, title, body, link } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    try {
      await this.brevo.sendTransactional({
        to: { email: user.email, name: user.name },
        subject: title,
        htmlContent: `<p>${body}</p><p><a href="${link}">View in your dashboard</a></p>`,
        textContent: `${body}\n\n${link}`,
        tags: ['advisor'],
      });
    } catch (err) {
      this.logger.error(`Failed to send advisor email to ${user.email}: ${(err as Error).message}`);
    }
  }
}
