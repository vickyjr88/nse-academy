import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { EbookService } from './ebook.service';
import { InitializePurchaseDto } from './dto/initialize-purchase.dto';
import { VerifyReferenceDto } from './dto/verify-reference.dto';

@ApiTags('ebook')
@Controller('ebook')
export class EbookController {
  constructor(private ebook: EbookService) {}

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get ebook purchases and subscriber access for the current user',
  })
  getStatus(@Req() req: { user: { id: string } }) {
    return this.ebook.getStatus(req.user.id);
  }

  @Post('purchase')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Initialize Paystack ebook purchase. Authenticated or guest (email required).',
  })
  purchase(
    @Req() req: { user?: { id: string; email: string } },
    @Body() body: InitializePurchaseDto,
  ) {
    return this.ebook.initializePurchase(body, req.user ?? null);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Verify Paystack reference and unlock ebook download (auth or guest)',
  })
  verify(
    @Req() req: { user?: { id: string } },
    @Body() body: VerifyReferenceDto,
  ) {
    return this.ebook.verifyAndActivate(body.reference, req.user?.id ?? null);
  }

  @Get('download/:productId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Get ebook download URL. Returns 403 with checkoutPath when unpaid.',
  })
  download(
    @Req() req: { user: { id: string } },
    @Param('productId') productId: string,
  ) {
    return this.ebook.download(req.user.id, productId);
  }

  @Get('guest-access/:token')
  @ApiOperation({
    summary:
      'Inspect a guest download link without consuming one of its downloads',
  })
  guestAccess(@Param('token') token: string) {
    return this.ebook.getGuestAccessInfo(token);
  }

  @Get('guest-download/:token')
  @ApiOperation({
    summary:
      'Download an ebook using the purchase email link (no login). Consumes one of the 2 allowed downloads.',
  })
  guestDownload(@Param('token') token: string) {
    return this.ebook.downloadByGuestToken(token);
  }
}
