import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [PrismaModule, BroadcastModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
