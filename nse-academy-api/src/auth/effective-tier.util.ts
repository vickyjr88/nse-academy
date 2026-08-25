import { PrismaService } from '../prisma/prisma.service';

export const TIER_LEVEL: Record<string, number> = {
  free: 0,
  intermediary: 1,
  premium: 2,
};

export interface EffectiveTierResult {
  effectiveTier: string;
  subscription: { tier: string; status: string } | null;
}

interface OrgLicenseLike {
  status: string;
  currentPeriodEnd: Date;
}

interface SubscriptionLike {
  tier: string;
  status: string;
}

// A corporate/SACCO org member has no personal Subscription row but should
// be treated as premium while their org's license is active — mirrors the
// same check across every tier-aware code path (guard, /users/me, /payments/status)
// so they can't drift out of sync with each other.
export function deriveEffectiveTier(
  subscription: SubscriptionLike | null | undefined,
  orgLicense: OrgLicenseLike | null | undefined,
): string {
  const corporateActive =
    orgLicense?.status === 'active' && orgLicense.currentPeriodEnd > new Date();
  return corporateActive ? 'premium' : subscription?.tier ?? 'free';
}

export async function computeEffectiveTier(
  prisma: PrismaService,
  userId: string,
): Promise<EffectiveTierResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      orgMembership: { include: { org: { include: { license: true } } } },
    },
  });

  const orgLicense = user?.orgMembership?.org?.license;
  const effectiveTier = deriveEffectiveTier(user?.subscription, orgLicense);

  return { effectiveTier, subscription: user?.subscription ?? null };
}
