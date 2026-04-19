import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-admin-key'];
    const expected = this.config.get<string>('ADMIN_API_KEY');
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}
