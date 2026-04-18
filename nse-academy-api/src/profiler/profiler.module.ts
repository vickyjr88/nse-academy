import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfilerController } from './profiler.controller';
import { ProfilerService } from './profiler.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfilerController],
  providers: [ProfilerService],
})
export class ProfilerModule {}
