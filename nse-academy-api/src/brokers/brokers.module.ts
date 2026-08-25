import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BrokersController } from './brokers.controller';
import { BrokersService } from './brokers.service';

@Module({
  imports: [PrismaModule],
  controllers: [BrokersController],
  providers: [BrokersService],
  exports: [BrokersService],
})
export class BrokersModule {}
