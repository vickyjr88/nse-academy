import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BroadcastModule } from '../broadcast/broadcast.module';
import { CampaignsController, PublicPortfolioWatchExampleController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [PrismaModule, BroadcastModule],
  controllers: [CampaignsController, PublicPortfolioWatchExampleController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
