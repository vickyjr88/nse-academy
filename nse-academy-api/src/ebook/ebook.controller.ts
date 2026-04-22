import { Controller, Get, Post, Body, Param, UseGuards, Req, HttpCode, Res, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EbookService } from './ebook.service';
import type { Response } from 'express';

@ApiTags('ebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ebook')
export class EbookController {
  constructor(private ebook: EbookService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get all ebook purchases for current user' })
  getStatus(@Req() req: any) {
    return this.ebook.getStatus(req.user.id);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Initialize Paystack ebook purchase' })
  purchase(@Req() req: any, @Body() body: { productId: string; priceKes: number }) {
    return this.ebook.initializePurchase(req.user.id, req.user.email, body.productId, body.priceKes);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Paystack reference and unlock ebook download' })
  verify(@Req() req: any, @Body() body: { reference: string }) {
    return this.ebook.verifyAndActivate(req.user.id, body.reference);
  }

  @Get('download/:productId')
  @ApiOperation({ summary: 'Stream ebook file (purchase required)' })
  download(
    @Req() req: any,
    @Param('productId') productId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Res({ passthrough: true }) _res: Response,
  ): Promise<StreamableFile> {
    return this.ebook.download(req.user.id, productId);
  }
}
