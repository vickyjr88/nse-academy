import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { investorProfile: true, subscription: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _, ...safe } = user;
    return safe;
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
