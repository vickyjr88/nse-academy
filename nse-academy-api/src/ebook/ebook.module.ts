import { Module } from '@nestjs/common';
import { EbookService } from './ebook.service';
import { EbookController } from './ebook.controller';

@Module({
  controllers: [EbookController],
  providers: [EbookService],
})
export class EbookModule {}
