import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { CreateAlertDto } from './dto/create-alert.dto';

interface NewNotification {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevo: BrevoService,
    private readonly config: ConfigService,
  ) {}

  private webUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  createAlert(userId: string, dto: CreateAlertDto) {
    return this.prisma.priceAlert.create({
      data: {
        userId,
        ticker: dto.ticker.toUpperCase().trim(),
        targetPrice: dto.targetPrice,
        direction: dto.direction,
      },
    });
  }

  listAlerts(userId: string) {
    return this.prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAlert(userId: string, id: string) {
    const existing = await this.prisma.priceAlert.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Alert not found');
    await this.prisma.priceAlert.delete({ where: { id } });
    return { success: true };
  }

  listNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  private createNotification(input: NewNotification) {
    return this.prisma.notification.create({ data: input });
  }

  /**
   * Called after each market-data poll with the tickers/prices just saved.
   * One-shot: a matched alert is marked 'triggered' and never re-fires, even
   * if the price keeps moving further past the target.
   */
  async checkAlertsForTickers(prices: { ticker: string; price: number }[]) {
    for (const { ticker, price } of prices) {
      if (!ticker || !price) continue;

      const matches = await this.prisma.priceAlert.findMany({
        where: {
          ticker,
          status: 'pending',
          OR: [
            { direction: 'ABOVE', targetPrice: { lte: price } },
            { direction: 'BELOW', targetPrice: { gte: price } },
          ],
        },
      });

      for (const alert of matches) {
        try {
          await this.fireAlert(alert, price);
        } catch (err) {
          this.logger.error(
            `Failed to fire alert ${alert.id} for ${ticker}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  private async fireAlert(
    alert: { id: string; userId: string; ticker: string; targetPrice: number; direction: string },
    price: number,
  ) {
    const directionWord = alert.direction === 'ABOVE' ? 'crossed above' : 'dropped below';
    const title = `${alert.ticker} ${directionWord} KSh ${alert.targetPrice}`;
    const body = `${alert.ticker} is now trading at KSh ${price}, ${directionWord} your target of KSh ${alert.targetPrice}.`;
    const link = `${this.webUrl()}/dashboard/journal`;

    await this.createNotification({
      userId: alert.userId,
      type: 'PRICE_ALERT',
      title,
      body,
      link,
    });

    const user = await this.prisma.user.findUnique({ where: { id: alert.userId } });
    if (user) {
      const infoBox = `Current price: <strong>KSh ${price}</strong> &middot; Target: KSh ${alert.targetPrice} &middot; ${alert.direction === 'ABOVE' ? 'Above' : 'Below'}`;
      await this.brevo.sendTransactional({
        to: { email: user.email, name: user.name },
        subject: title,
        htmlContent: renderEmailHtml({
          eyebrow: 'Price Alert',
          heading: title,
          bodyHtml: [`Your price alert for <strong>${alert.ticker}</strong> has been triggered.`],
          infoBox,
          button: { label: 'View Your Trade Journal', url: link },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: title,
          bodyText: [body],
          button: { label: 'Trade Journal', url: link },
          siteUrl: this.webUrl(),
        }),
        tags: ['price-alert'],
      });
    }

    await this.prisma.priceAlert.update({
      where: { id: alert.id },
      data: { status: 'triggered', triggeredAt: new Date() },
    });
  }
}
