import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BROKER_SEED } from './brokers.seed';

@Injectable()
export class BrokersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedBrokers();
  }

  /**
   * create-only: an admin may have edited feePercent/cdaCode/cdsRequired via
   * the admin API after initial seed, and this runs on every app restart -
   * overwriting on update would silently discard those edits.
   */
  private async seedBrokers() {
    for (const broker of BROKER_SEED) {
      await this.prisma.broker.upsert({
        where: { name: broker.name },
        update: {},
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
