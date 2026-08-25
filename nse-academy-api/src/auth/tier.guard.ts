import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_KEY } from './tier.decorator';
import { computeEffectiveTier, TIER_LEVEL } from './effective-tier.util';

// Must run after JwtAuthGuard in the guard chain — relies on req.user.id
// already being populated.
@Injectable()
export class TierGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.getAllAndOverride<
      'intermediary' | 'premium' | undefined
    >(TIER_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredTier) return true;

    const req = context.switchToHttp().getRequest<{ user: { id: string } }>();
    const { effectiveTier } = await computeEffectiveTier(this.prisma, req.user.id);

    if (TIER_LEVEL[effectiveTier] >= TIER_LEVEL[requiredTier]) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'TIER_REQUIRED',
        message: `This feature requires the ${requiredTier} plan.`,
        requiredTier,
        currentTier: effectiveTier,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
