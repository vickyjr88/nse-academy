import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates when a Bearer token is present, but never rejects anonymous
 * requests. Invalid/expired tokens are treated as anonymous so checkout can
 * still proceed as a guest.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers?: { authorization?: string };
    }>();
    const header = req.headers?.authorization;
    if (!header) return true;
    try {
      await super.canActivate(context);
    } catch {
      return true;
    }
    return true;
  }

  override handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
