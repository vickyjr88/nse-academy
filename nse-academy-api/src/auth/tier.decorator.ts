import { SetMetadata } from '@nestjs/common';

export const TIER_KEY = 'requiredTier';

export const RequireTier = (tier: 'intermediary' | 'premium') =>
  SetMetadata(TIER_KEY, tier);
