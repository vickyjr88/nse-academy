import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FREE_MONTHS_REWARD = 1;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private prisma: PrismaService) {}

  /** Called during registration when a referral code is provided. */
  async recordPendingReferral(referralCode: string, newUserId: string): Promise<void> {
    const referrer = await this.prisma.user.findUnique({ where: { referralCode } });
    if (!referrer || referrer.id === newUserId) return;

    // One referral per user — ignore if already recorded
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
    await Promise.all([
      this.grantFreeMonth(referral.referrerId),
      this.grantFreeMonth(referral.referredId),
    ]);

    this.logger.log(`Referral completed: ${referral.referrerId} → ${referral.referredId}. Both rewarded.`);
  }

  /** Extends subscription by 30 days, or credits freeMonths for future billing. */
  private async grantFreeMonth(userId: string): Promise<void> {
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
      // User hasn't subscribed yet — bank the free month for when they do
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
