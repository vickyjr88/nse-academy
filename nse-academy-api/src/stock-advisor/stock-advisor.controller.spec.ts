import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TierGuard } from '../auth/tier.guard';
import { TIER_KEY } from '../auth/tier.decorator';
import { StockAdvisorController } from './stock-advisor.controller';

const proto = StockAdvisorController.prototype;
const guards = (fn: unknown) => (Reflect.getMetadata(GUARDS_METADATA, fn as object) ?? []) as unknown[];

describe('StockAdvisorController plan gating', () => {
  it('only lets Premium accounts call the AI advice endpoint - it spends search and AI credits on every call', () => {
    expect(guards(proto.aiAdvice)).toContain(TierGuard);
    expect(Reflect.getMetadata(TIER_KEY, proto.aiAdvice)).toBe('premium');
  });
});
