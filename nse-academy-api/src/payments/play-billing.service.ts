import { BadRequestException, ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralsService } from '../referrals/referrals.service';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { tracked } from '../monitoring/track';
import { TIER_LEVEL } from '../auth/effective-tier.util';
import { GooglePlayClient, PlaySubscriptionV2 } from './google-play.client';
import { PaymentsService, SubscriptionPlan } from './payments.service';

/** Subscription ids created in Play Console (Monetize > Subscriptions). Each carries the base plans the app offers. */
export const PLAY_PRODUCTS: Record<string, SubscriptionPlan> = {
  nse_intermediary: 'intermediary',
  nse_premium: 'premium',
};

/** States in which Google says the member has paid for access right now (a cancelled plan still runs to its expiry). */
const ENTITLED = new Set(['ACTIVE', 'CANCELED', 'IN_GRACE_PERIOD']);

export interface PurchaseRow {
  tier: string;
  state: string;
  expiryTime: Date | null;
}

export function shortState(s?: string): string {
  return (s || 'UNKNOWN').replace('SUBSCRIPTION_STATE_', '');
}

export function isEntitled(p: PurchaseRow, now: Date): boolean {
  return ENTITLED.has(p.state) && !!p.expiryTime && p.expiryTime.getTime() > now.getTime();
}

/** The purchase that decides the member's plan: the highest tier they currently hold, then the one that runs longest. */
export function pickEntitlement<T extends PurchaseRow>(rows: T[], now: Date): T | null {
  const live = rows.filter((r) => isEntitled(r, now));
  if (live.length === 0) return null;
  return live.sort((a, b) => (TIER_LEVEL[b.tier] ?? 0) - (TIER_LEVEL[a.tier] ?? 0) || b.expiryTime!.getTime() - a.expiryTime!.getTime())[0];
}

interface Existing {
  tier: string;
  status: string;
  source: string;
  currentPeriodEnd: Date | null;
}

export type SubscriptionChange = { action: 'none' } | { action: 'grant'; tier: string; end: Date; source: string } | { action: 'lapse' };

/**
 * What Play's verdict does to the member's subscription row. The row also holds web (Paystack) periods, so:
 *  - a live plan on a higher tier is left alone (the Play purchase stays on record and takes over when it lapses);
 *  - the same tier keeps whichever period ends later;
 *  - a higher tier replaces the plan (Google prorates the change on its side);
 *  - with nothing entitled, only a row that Play wrote is lapsed, so web-paid time is never taken away.
 */
export function decideChange(best: PurchaseRow | null, existing: Existing | null, now: Date): SubscriptionChange {
  const live = existing && existing.status === 'active' && existing.currentPeriodEnd && existing.currentPeriodEnd.getTime() > now.getTime() && (TIER_LEVEL[existing.tier] ?? 0) > 0 ? existing : null;
  if (!best) return existing && existing.source === 'play' && existing.status === 'active' ? { action: 'lapse' } : { action: 'none' };
  const end = best.expiryTime as Date;
  if (live && live.source !== 'play') {
    const have = TIER_LEVEL[live.tier] ?? 0;
    const buying = TIER_LEVEL[best.tier] ?? 0;
    if (have > buying) return { action: 'none' };
    if (have === buying) {
      return (live.currentPeriodEnd as Date).getTime() >= end.getTime() ? { action: 'none' } : { action: 'grant', tier: best.tier, end, source: 'play' };
    }
  }
  return { action: 'grant', tier: best.tier, end, source: 'play' };
}

@Injectable()
export class PlayBillingService {
  private readonly logger = new Logger(PlayBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly google: GooglePlayClient,
    private readonly payments: PaymentsService,
    private readonly referrals: ReferralsService,
    @Optional() private readonly monitor?: JobMonitorService,
  ) {}

  /** The opaque id the app attaches to a purchase (Play's obfuscatedAccountId). It carries no personal data. */
  accountIdFor(userId: string): string {
    const secret = this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'changeme';
    return crypto.createHmac('sha256', secret).update(`play:${userId}`).digest('hex');
  }

  appConfig(userId: string) {
    return { enabled: this.google.enabled, accountId: this.accountIdFor(userId), products: Object.keys(PLAY_PRODUCTS) };
  }

  /** Called by the app after Play confirms a purchase. Trusts nothing the app says except the token, which Google checks. */
  async verify(userId: string, purchaseToken: string) {
    if (!purchaseToken || typeof purchaseToken !== 'string') throw new BadRequestException('purchaseToken is required');
    const known = await this.prisma.playPurchase.findUnique({ where: { purchaseToken } });
    if (known && known.userId !== userId) throw new ForbiddenException('This purchase belongs to another account');

    let remote: PlaySubscriptionV2;
    try {
      remote = await this.google.getSubscription(purchaseToken);
    } catch (e) {
      if ((e as any).status === 404 || (e as any).status === 400) throw new BadRequestException('Google Play does not recognise this purchase');
      throw e;
    }
    const line = remote.lineItems?.[0];
    const tier = line?.productId ? PLAY_PRODUCTS[line.productId] : undefined;
    if (!line?.productId || !tier) throw new BadRequestException('This purchase is not an NSE Academy plan');
    const owner = remote.externalAccountIdentifiers?.obfuscatedExternalAccountId;
    if (owner && owner !== this.accountIdFor(userId)) throw new ForbiddenException('This purchase was made for another account');

    const row = await this.saveRemote(userId, purchaseToken, line.productId, tier, remote);
    if (remote.linkedPurchaseToken) {
      // An upgrade or downgrade inside Play: the old token is superseded, not lapsed, so it must not count.
      await this.prisma.playPurchase.updateMany({ where: { purchaseToken: remote.linkedPurchaseToken, userId }, data: { state: 'REPLACED' } });
    }
    await this.acknowledgeIfNeeded(row, remote);
    const change = await this.applyEntitlement(userId);
    if (!known && change.action === 'grant') await this.welcome(userId, row.tier as SubscriptionPlan, change.end, row.orderId ?? purchaseToken.slice(0, 12));
    return this.payments.getSubscriptionStatus(userId);
  }

  /** Re-reads one purchase from Google (Play notification, or the cron) and applies the result. */
  async syncToken(purchaseToken: string) {
    const row = await this.prisma.playPurchase.findUnique({ where: { purchaseToken } });
    if (!row) return;
    const remote = await this.google.getSubscription(purchaseToken);
    const line = remote.lineItems?.[0];
    const saved = await this.saveRemote(row.userId, purchaseToken, line?.productId ?? row.productId, PLAY_PRODUCTS[line?.productId ?? row.productId] ?? (row.tier as SubscriptionPlan), remote);
    if (remote.linkedPurchaseToken) {
      await this.prisma.playPurchase.updateMany({ where: { purchaseToken: remote.linkedPurchaseToken, userId: row.userId }, data: { state: 'REPLACED' } });
    }
    await this.acknowledgeIfNeeded(saved, remote);
    await this.applyEntitlement(row.userId);
  }

  private async saveRemote(userId: string, purchaseToken: string, productId: string, tier: SubscriptionPlan, remote: PlaySubscriptionV2) {
    const line = remote.lineItems?.[0];
    const data = {
      productId,
      tier,
      basePlanId: line?.offerDetails?.basePlanId ?? null,
      orderId: remote.latestOrderId ?? null,
      state: shortState(remote.subscriptionState),
      autoRenewing: !!line?.autoRenewingPlan?.autoRenewEnabled,
      expiryTime: line?.expiryTime ? new Date(line.expiryTime) : null,
      acknowledged: remote.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
      linkedToken: remote.linkedPurchaseToken ?? null,
      lastSyncedAt: new Date(),
    };
    return this.prisma.playPurchase.upsert({ where: { purchaseToken }, create: { purchaseToken, userId, ...data }, update: data });
  }

  private async acknowledgeIfNeeded(row: { purchaseToken: string; productId: string; acknowledged: boolean; state: string; expiryTime: Date | null }, remote: PlaySubscriptionV2) {
    if (row.acknowledged || !isEntitled({ tier: '', state: row.state, expiryTime: row.expiryTime }, new Date())) return;
    try {
      await this.google.acknowledge(row.productId, row.purchaseToken);
      await this.prisma.playPurchase.update({ where: { purchaseToken: row.purchaseToken }, data: { acknowledged: true } });
    } catch (e) {
      // The app also acknowledges (completePurchase) and Google keeps three days to get one of them through.
      this.logger.warn(`Could not acknowledge a Play purchase: ${(e as Error).message}`);
    }
  }

  /** Brings the member's subscription row in line with everything Google says they hold. */
  async applyEntitlement(userId: string): Promise<SubscriptionChange> {
    const now = new Date();
    const rows = await this.prisma.playPurchase.findMany({ where: { userId, state: { not: 'REPLACED' } } });
    const best = pickEntitlement(rows, now);
    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    const change = decideChange(best, existing as Existing | null, now);
    if (change.action === 'grant') {
      const moved = !existing || existing.tier !== change.tier || existing.currentPeriodEnd?.getTime() !== change.end.getTime();
      await this.prisma.subscription.upsert({
        where: { userId },
        create: { userId, tier: change.tier, status: 'active', source: change.source, currentPeriodEnd: change.end },
        update: {
          tier: change.tier,
          status: 'active',
          source: change.source,
          currentPeriodEnd: change.end,
          ...(moved ? { expiryWarningSentAt: null, winbackSentAt: null, renewalNudgeSentAt: null } : {}),
        },
      });
    } else if (change.action === 'lapse') {
      await this.prisma.subscription.update({ where: { userId }, data: { tier: 'free', status: 'cancelled' } });
      this.logger.log(`Play plan for user ${userId} is no longer active; moved to free`);
    }
    return change;
  }

  /** Counts the first paid plan toward a referral and sends the same confirmation the web checkout does. */
  private async welcome(userId: string, tier: SubscriptionPlan, end: Date, reference: string) {
    await this.referrals.completeReferral(userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    void this.payments.sendSubscriptionConfirmedEmail(user.email, user.name, tier, 1, end, 'new');
    void this.payments.alertAdminOfSubscription(user, tier, 1, `play:${reference}`);
  }

  /**
   * Google's real-time developer notification (Pub/Sub push). We only use it as a nudge to re-read the purchase from
   * Google, never as proof of anything, so a forged one can do no more than cause a harmless extra lookup.
   */
  async handleNotification(body: any) {
    const raw = body?.message?.data;
    if (!raw) return { received: true };
    let msg: any;
    try {
      msg = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      return { received: true };
    }
    if (msg.packageName && msg.packageName !== this.google.packageName) return { received: true };
    const token: string | undefined = msg.subscriptionNotification?.purchaseToken;
    if (token) await this.syncToken(token);
    return { received: true };
  }

  checkNotificationToken(provided?: string): boolean {
    const expected = this.config.get<string>('GOOGLE_PLAY_RTDN_TOKEN');
    if (!expected || !provided) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /** Safety net for missed notifications: renewals, lapses and refunds are all picked up here. */
  @Cron('30 5 * * *')
  async syncDaily() {
    return tracked(this.monitor, 'play-subscription-sync', () => this.syncOpen(0));
  }

  @Cron('0 */6 * * *')
  async syncFrequently() {
    return tracked(this.monitor, 'play-subscription-sync-frequent', () => this.syncOpen(5));
  }

  private async syncOpen(minHoursSinceSync: number) {
    if (!this.google.enabled) return;
    const rows = await this.prisma.playPurchase.findMany({
      where: { state: { in: ['ACTIVE', 'CANCELED', 'IN_GRACE_PERIOD', 'ON_HOLD', 'PAUSED', 'PENDING'] }, lastSyncedAt: { lt: new Date(Date.now() - minHoursSinceSync * 3_600_000) } },
      take: 500,
    });
    for (const r of rows) {
      try {
        await this.syncToken(r.purchaseToken);
      } catch (e) {
        this.logger.error(`Play sync failed for user ${r.userId}: ${(e as Error).message}`);
      }
    }
  }
}
