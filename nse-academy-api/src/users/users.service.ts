import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        investorProfile: true,
        subscription: true,
        orgMembership: { include: { org: { include: { license: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...safe } = user;
    const orgLicense = safe.orgMembership?.org?.license;
    const corporateActive =
      orgLicense?.status === 'active' &&
      orgLicense.currentPeriodEnd > new Date();
    const effectiveTier = corporateActive
      ? 'premium'
      : safe.subscription?.tier ?? 'free';
    return { ...safe, effectiveTier };
  }

  async getProgress(userId: string) {
    return this.prisma.lessonProgress.findMany({ where: { userId } });
  }

  async markLessonComplete(userId: string, lessonId: string) {
    return this.prisma.lessonProgress.upsert({
      where: { id: `${userId}_${lessonId}` },
      update: { completed: true, completedAt: new Date() },
      create: { userId, lessonId, completed: true, completedAt: new Date() },
    });
  }
}
