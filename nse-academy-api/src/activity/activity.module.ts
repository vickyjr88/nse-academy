import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityService } from './activity.service';

/** Global: the auth strategy and login need it without importing a module each. */
@Global()
@Module({ imports: [PrismaModule], providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
