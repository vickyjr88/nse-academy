import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';

/** Where in the app a tap on a notification should land, by notification type. */
export function routeForNotification(type: string): string {
  switch (type) {
    case 'PRICE_ALERT':
      return '/tools/alerts';
    case 'PORTFOLIO_WATCH':
      return '/tools/portfolio';
    case 'ADVISOR_QUERY':
    case 'ADVISOR_QUERY_ANSWERED':
      return '/advisers/questions';
    case 'ADVISOR_INSIGHT':
      return '/advisers/insights';
    case 'ADVISOR_ALERT':
      return '/advisers';
    default:
      return '/tools/alerts';
  }
}

/**
 * Push notifications to the Android app through Firebase Cloud Messaging. Off until FIREBASE_SERVICE_ACCOUNT_JSON (a
 * Firebase service-account key, as JSON or base64) is set; until then every call is a quiet no-op, so nothing that creates
 * a notification can fail because push is not configured. A device only has a token here if the member switched
 * notifications on in the app, and the app removes it when they switch them off or sign out.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private auth: GoogleAuth | null = null;
  private projectId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return !!this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  private init(): GoogleAuth {
    if (this.auth) return this.auth;
    const raw = (this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON') || '').trim();
    const credentials = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    this.projectId = credentials.project_id;
    this.auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    return this.auth;
  }

  async register(userId: string, token: string, platform = 'android') {
    if (!token || token.length < 20 || token.length > 4096) return { registered: false };
    const now = new Date();
    // A token belongs to one phone; if a different member signs in on it, it moves to them.
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { token, userId, platform, lastSeenAt: now },
      update: { userId, platform, lastSeenAt: now },
    });
    return { registered: true };
  }

  async unregister(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId } });
    return { registered: false };
  }

  /** Sends one notification to every phone the member has switched notifications on for. Never throws. */
  async notifyUser(userId: string, n: { type: string; title: string; body: string }): Promise<void> {
    if (!this.enabled) return;
    try {
      const devices = await this.prisma.deviceToken.findMany({ where: { userId }, select: { token: true } });
      if (devices.length === 0) return;
      const auth = this.init();
      const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
      const body = n.body.length > 180 ? `${n.body.slice(0, 177)}...` : n.body;
      await Promise.all(
        devices.map(async ({ token }) => {
          const res = await auth.request<any>({
            url,
            method: 'POST',
            data: { message: { token, notification: { title: n.title, body }, data: { route: routeForNotification(n.type), type: n.type }, android: { priority: 'HIGH' } } },
            validateStatus: () => true,
          });
          if (res.status === 404 || res.data?.error?.details?.some((d: any) => d.errorCode === 'UNREGISTERED')) {
            await this.prisma.deviceToken.deleteMany({ where: { token } });
          } else if (res.status >= 300) {
            this.logger.warn(`FCM answered ${res.status} for a push to user ${userId}`);
          }
        }),
      );
    } catch (err) {
      this.logger.error(`Push to user ${userId} failed: ${(err as Error).message}`);
    }
  }
}
