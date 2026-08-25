import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BroadcastController } from './broadcast.controller';
import { BroadcastService } from './broadcast.service';

@Module({
  imports: [PrismaModule],
  controllers: [BroadcastController],
  providers: [BroadcastService],
})
export class BroadcastModule {}
