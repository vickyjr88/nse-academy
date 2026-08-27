import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { renderEmailHtml, renderEmailText } from '../brevo/email-template';

const FREE_MONTHS_REWARD = 1;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private prisma: PrismaService,
    private brevo: BrevoService,
    private config: ConfigService,
  ) {}

  private webUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  /** Called during registration when a referral code is provided. */
  async recordPendingReferral(referralCode: string, newUserId: string): Promise<void> {
    const referrer = await this.prisma.user.findUnique({ where: { referralCode } });
    if (!referrer || referrer.id === newUserId) return;

    // One referral per user - ignore if already recorded
    const existing = await this.prisma.referral.findUnique({ where: { referredId: newUserId } });
    if (existing) return;

    await this.prisma.referral.create({
      data: { referrerId: referrer.id, referredId: newUserId },
    });
    this.logger.log(`Pending referral recorded: ${referrer.id} → ${newUserId}`);
  }

  /**
   * Called from the payments webhook after a successful charge.
   * Completes the referral and grants 1 free month to both parties.
   */
  async completeReferral(referredUserId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { referredId: referredUserId },
    });

    if (!referral || referral.status === 'completed') return;

    await this.prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'completed', rewardedAt: new Date() },
    });

    // Grant free month to both referrer and referred user
    const [referrer, referred] = await Promise.all([
      this.grantFreeMonth(referral.referrerId),
      this.grantFreeMonth(referral.referredId),
    ]);

    this.logger.log(`Referral completed: ${referral.referrerId} → ${referral.referredId}. Both rewarded.`);

    if (referrer) {
      void this.sendRewardEmail(referrer.email, referrer.name, 'referrer', referred?.name);
    }
    if (referred) {
      void this.sendRewardEmail(referred.email, referred.name, 'referred', referrer?.name);
    }
  }

  /**
   * Extends subscription by 30 days, or credits freeMonths for future
   * billing. Returns the user's name/email so the caller can send the
   * reward email without a second lookup - null if the user doesn't exist
   * (shouldn't happen in practice, but keeps this safe to call standalone).
   */
  private async grantFreeMonth(userId: string): Promise<{ name: string; email: string } | null> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });

    if (sub) {
      const currentEnd = sub.currentPeriodEnd ?? new Date();
      const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()) + THIRTY_DAYS_MS);
      await this.prisma.subscription.update({
        where: { userId },
        data: {
          currentPeriodEnd: newEnd,
          freeMonths: { increment: FREE_MONTHS_REWARD },
        },
      });
    } else {
      // User hasn't subscribed yet - bank the free month for when they do
      await this.prisma.subscription.create({
        data: {
          userId,
          tier: 'free',
          status: 'active',
          freeMonths: FREE_MONTHS_REWARD,
          currentPeriodEnd: new Date(Date.now() + THIRTY_DAYS_MS),
        },
      });
    }

    return this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  }

  private async sendRewardEmail(
    email: string,
    name: string,
    role: 'referrer' | 'referred',
    otherPartyName?: string,
  ): Promise<void> {
    const firstName = name.split(' ')[0];
    const referralsUrl = `${this.webUrl()}/dashboard/referrals`;
    const heading = role === 'referrer' ? `You earned a free month, ${firstName}!` : `Welcome bonus unlocked, ${firstName}!`;
    const bodyHtml =
      role === 'referrer'
        ? [
            `${otherPartyName ? `<strong>${otherPartyName}</strong>` : 'Someone you referred'} just subscribed to NSE Academy using your referral link - as a thank you, we've added <strong>1 free month</strong> to your subscription.`,
          ]
        : [
            `Thanks for subscribing to NSE Academy${otherPartyName ? ` through <strong>${otherPartyName}</strong>'s referral` : ' through a referral'}! We've added <strong>1 free month</strong> to your subscription as a welcome bonus.`,
          ];
    const bodyText =
      role === 'referrer'
        ? [
            `${otherPartyName ?? 'Someone you referred'} just subscribed to NSE Academy using your referral link - as a thank you, we've added 1 free month to your subscription.`,
          ]
        : [
            `Thanks for subscribing to NSE Academy${otherPartyName ? ` through ${otherPartyName}'s referral` : ' through a referral'}! We've added 1 free month to your subscription as a welcome bonus.`,
          ];
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: role === 'referrer' ? 'You earned a free month on NSE Academy' : 'Your NSE Academy welcome bonus',
        htmlContent: renderEmailHtml({
          eyebrow: 'Referral Reward',
          heading,
          bodyHtml,
          button: { label: 'View Your Referrals', url: referralsUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading,
          bodyText,
          button: { label: 'Your Referrals', url: referralsUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['referral-reward', `role:${role}`],
      });
    } catch (err) {
      this.logger.error(`Failed to send referral reward email to ${email}: ${(err as Error).message}`);
    }
  }

  /** Returns a user's referral stats for the dashboard. */
  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    const [total, completed, sub] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId } }),
      this.prisma.referral.count({ where: { referrerId: userId, status: 'completed' } }),
      this.prisma.subscription.findUnique({ where: { userId }, select: { freeMonths: true } }),
    ]);

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        createdAt: true,
        rewardedAt: true,
        referred: { select: { name: true, createdAt: true } },
      },
    });

    return {
      referralCode: user?.referralCode ?? '',
      totalReferrals: total,
      completedReferrals: completed,
      pendingReferrals: total - completed,
      freeMonthsEarned: sub?.freeMonths ?? 0,
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        joinedAt: r.createdAt,
        rewardedAt: r.rewardedAt,
        name: r.referred.name.split(' ')[0] + ' ' + (r.referred.name.split(' ')[1]?.[0] ?? '') + '.', // First name + last initial
      })),
    };
  }
}
