import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingMonths, PLAN_PRICES, SubscriptionPlan, computeAmountKobo } from '../payments/payments.service';
import { DayBounds, boundsForYmd } from './report-helpers';

const DAY_MS = 86_400_000;
const FUNNEL_DAYS = 30;

export interface BusinessMetrics {
  revenue: {
    dayKes: number;
    dayPayments: number;
    monthToDateKes: number;
    last30DaysKes: number;
    /** The payment ledger only starts when it was introduced; earlier payments are in Paystack, not here. */
    recordedSince: string | null;
  };
  recurring: { activePaid: number; premium: number; intermediary: number; mrrKes: number; arrKes: number };
  growth: { signupsDay: number; signups7d: number; signupsPrev7d: number };
  funnel: { windowDays: number; signups: number; profiled: number; activated: number; paying: number };
  churn: { lapsedDay: number; lapsed30d: number; expiringNext7: number };
  product: { tradesLogged: number; statementsImported: number; statementsFailed: number; portfolioWatchSent: number; alertsCreated: number; lessonsCompleted: number };
}

/** What a ledger row was worth in KSh, with the term discount, exactly as Paystack charged it. */
export function paymentAmountKes(plan: string, months: number): number {
  if (!PLAN_PRICES[plan as SubscriptionPlan]) return 0;
  const term = ([1, 3, 6, 12] as number[]).includes(months) ? (months as BillingMonths) : 1;
  return computeAmountKobo(plan as SubscriptionPlan, term) / 100;
}

/** Monthly recurring revenue at list price: every active paid member counted at their plan's monthly price. */
export function recurringRevenue(premium: number, intermediary: number) {
  const mrrKes = premium * (PLAN_PRICES.premium / 100) + intermediary * (PLAN_PRICES.intermediary / 100);
  return { mrrKes, arrKes: mrrKes * 12 };
}

/** The first moment (Nairobi) of the month `day` falls in. */
export function monthStart(day: DayBounds): Date {
  return boundsForYmd(`${day.ymd.slice(0, 8)}01`).start;
}

@Injectable()
export class BusinessMetricsService {
  constructor(private prisma: PrismaService) {}

  async build(day: DayBounds, now = new Date()): Promise<BusinessMetrics> {
    const inDay = { gte: day.start, lt: day.end };
    const soon = new Date(now.getTime() + 7 * DAY_MS);
    const d7 = new Date(day.end.getTime() - 7 * DAY_MS);
    const d14 = new Date(day.end.getTime() - 14 * DAY_MS);
    const d30 = new Date(day.end.getTime() - FUNNEL_DAYS * DAY_MS);
    const cohort = { gte: d30, lt: day.end };
    const monthFrom = monthStart(day);

    const [
      payments, ledgerStart,
      tierGroups,
      signupsDay, signups7d, signupsPrev7d,
      fSignups, fProfiled, fActivated, fPaying,
      lapsedDay, lapsed30d, expiringNext7,
      trades, importsOk, importsFailed, watchSent, alertsCreated, lessons,
    ] = await Promise.all([
      this.prisma.processedPayment.findMany({ where: { appliedAt: { gte: new Date(Math.min(monthFrom.getTime(), d30.getTime())), lt: day.end } }, select: { plan: true, months: true, appliedAt: true, userId: true } }),
      this.prisma.processedPayment.aggregate({ _min: { appliedAt: true } }),
      this.prisma.subscription.groupBy({ by: ['tier'], where: { status: 'active', tier: { in: ['intermediary', 'premium'] } }, _count: true }),
      this.prisma.user.count({ where: { createdAt: inDay } }),
      this.prisma.user.count({ where: { createdAt: { gte: d7, lt: day.end } } }),
      this.prisma.user.count({ where: { createdAt: { gte: d14, lt: d7 } } }),
      this.prisma.user.count({ where: { createdAt: cohort } }),
      this.prisma.user.count({ where: { createdAt: cohort, investorProfile: { isNot: null } } }),
      this.prisma.user.count({ where: { createdAt: cohort, OR: [{ holdings: { some: {} } }, { trades: { some: {} } }] } }),
      this.prisma.user.count({ where: { createdAt: cohort, subscription: { is: { tier: { in: ['intermediary', 'premium'] }, status: 'active' } } } }),
      this.prisma.subscription.count({ where: { status: 'cancelled', currentPeriodEnd: inDay } }),
      this.prisma.subscription.count({ where: { status: 'cancelled', currentPeriodEnd: { gte: d30, lt: day.end } } }),
      this.prisma.subscription.count({ where: { status: 'active', tier: { in: ['intermediary', 'premium'] }, currentPeriodEnd: { gte: now, lte: soon } } }),
      this.prisma.trade.count({ where: { createdAt: inDay } }),
      this.prisma.statementImport.count({ where: { createdAt: inDay, status: 'completed' } }),
      this.prisma.statementImport.count({ where: { createdAt: inDay, status: 'failed' } }),
      this.prisma.notification.count({ where: { type: 'PORTFOLIO_WATCH', createdAt: inDay } }),
      this.prisma.priceAlert.count({ where: { createdAt: inDay } }),
      this.prisma.lessonProgress.count({ where: { completedAt: inDay } }),
    ]);

    const tier = (t: string) => tierGroups.find((g) => g.tier === t)?._count ?? 0;
    const sum = (rows: typeof payments) => rows.reduce((s, p) => s + paymentAmountKes(p.plan, p.months), 0);
    const dayRows = payments.filter((p) => p.appliedAt >= day.start && p.appliedAt < day.end);

    return {
      revenue: {
        dayKes: sum(dayRows),
        dayPayments: dayRows.length,
        monthToDateKes: sum(payments.filter((p) => p.appliedAt >= monthFrom)),
        last30DaysKes: sum(payments.filter((p) => p.appliedAt >= d30)),
        recordedSince: ledgerStart._min.appliedAt ? ledgerStart._min.appliedAt.toISOString().slice(0, 10) : null,
      },
      recurring: { activePaid: tier('premium') + tier('intermediary'), premium: tier('premium'), intermediary: tier('intermediary'), ...recurringRevenue(tier('premium'), tier('intermediary')) },
      growth: { signupsDay, signups7d, signupsPrev7d },
      funnel: { windowDays: FUNNEL_DAYS, signups: fSignups, profiled: fProfiled, activated: fActivated, paying: fPaying },
      churn: { lapsedDay, lapsed30d, expiringNext7 },
      product: { tradesLogged: trades, statementsImported: importsOk, statementsFailed: importsFailed, portfolioWatchSent: watchSent, alertsCreated, lessonsCompleted: lessons },
    };
  }
}
