import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string; email: string; subject: string; message: string }) {
    if (!dto.name || !dto.email || !dto.subject || !dto.message) {
      throw new BadRequestException('All fields are required');
    }
    return this.prisma.contactSubmission.create({ data: dto });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [submissions, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contactSubmission.count(),
    ]);
    return { submissions, total, pageCount: Math.ceil(total / limit) };
  }

  async markRead(id: string) {
    return this.prisma.contactSubmission.update({
      where: { id },
      data: { status: 'read' },
    });
  }

  async markReplied(id: string) {
    return this.prisma.contactSubmission.update({
      where: { id },
      data: { status: 'replied' },
    });
  }

  async countNew() {
    return this.prisma.contactSubmission.count({ where: { status: 'new' } });
  }
}
