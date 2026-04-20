import { Controller, Get, Post, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EbookService } from './ebook.service';

@ApiTags('ebook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ebook')
export class EbookController {
  constructor(private ebook: EbookService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if current user has purchased the ebook' })
  getStatus(@Req() req: any) {
    return this.ebook.getStatus(req.user.id);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Initialize Paystack ebook purchase (KSh 750)' })
  purchase(@Req() req: any) {
    return this.ebook.initializePurchase(req.user.id, req.user.email);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Paystack reference and unlock ebook download' })
  verify(@Req() req: any, @Body() body: { reference: string }) {
    return this.ebook.verifyAndActivate(req.user.id, body.reference);
  }

  @Get('download')
  @ApiOperation({ summary: 'Get ebook download URL (purchase required)' })
  download(@Req() req: any) {
    return this.ebook.getDownloadUrl(req.user.id);
  }
}
