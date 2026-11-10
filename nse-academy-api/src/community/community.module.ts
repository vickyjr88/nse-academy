import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunityController } from './community.controller';

@Module({ imports: [PrismaModule], controllers: [CommunityController] })
export class CommunityModule {}
