import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BROKER_SEED } from './brokers.seed';

@Injectable()
export class BrokersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedBrokers();
  }

  private async seedBrokers() {
    for (const broker of BROKER_SEED) {
      await this.prisma.broker.upsert({
        where: { name: broker.name },
        update: {
          cdaCode: broker.cdaCode,
          feePercent: broker.feePercent,
          cdsRequired: broker.cdsRequired,
        },
        create: broker,
      });
    }
  }

  listActive() {
    return this.prisma.broker.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
