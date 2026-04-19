import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          subscription: {
            select: {
              tier: true,
              status: true,
              currentPeriodEnd: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        investorProfile: true,
        subscription: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _pw, ...rest } = user;
    return rest;
  }

  async upsertSubscription(userId: string, dto: UpsertSubscriptionDto) {
    await this.getUser(userId);
    return this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: dto.tier,
        status: dto.status,
        currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null,
      },
      update: {
        tier: dto.tier,
        status: dto.status,
        currentPeriodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : null,
      },
    });
  }

  async cancelSubscription(userId: string) {
    await this.getUser(userId);
    return this.prisma.subscription.update({
      where: { userId },
      data: { status: 'cancelled' },
    });
  }
}
