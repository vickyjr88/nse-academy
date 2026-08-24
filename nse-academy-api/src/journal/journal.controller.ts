import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JournalService } from './journal.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';

const MAX_STATEMENT_SIZE_BYTES = 10 * 1024 * 1024;

@ApiTags('journal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('journal')
export class JournalController {
  constructor(private journal: JournalService) {}

  @Get('brokers')
  @ApiOperation({ summary: 'List active brokers and their fee rates' })
  listBrokers() {
    return this.journal.listBrokers();
  }

  @Get('trades')
  @ApiOperation({ summary: 'List the current user trade journal entries' })
  listTrades(@Req() req: { user: { id: string } }) {
    return this.journal.listTrades(req.user.id);
  }

  @Post('trades')
  @ApiOperation({ summary: 'Log a new trade' })
  createTrade(@Req() req: { user: { id: string } }, @Body() body: CreateTradeDto) {
    return this.journal.createTrade(req.user.id, body);
  }

  @Put('trades/:id')
  @ApiOperation({ summary: 'Update a trade' })
  updateTrade(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: UpdateTradeDto,
  ) {
    return this.journal.updateTrade(req.user.id, id, body);
  }

  @Delete('trades/:id')
  @ApiOperation({ summary: 'Delete a trade' })
  deleteTrade(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.journal.deleteTrade(req.user.id, id);
  }

  @Get('portfolio')
  @ApiOperation({ summary: 'Get current holdings and cost basis, computed from trades' })
  getPortfolio(@Req() req: { user: { id: string } }) {
    return this.journal.getPortfolio(req.user.id);
  }

  @Post('statements/import')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import a CDSC statement of account (PDF) to seed holdings' })
  @UseInterceptors(FileInterceptor('file'))
  importStatement(
    @Req() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF statements are supported');
    }
    if (file.size > MAX_STATEMENT_SIZE_BYTES) {
      throw new BadRequestException('File too large');
    }
    return this.journal.importStatement(req.user.id, file.originalname, file.buffer);
  }

  @Get('statements')
  @ApiOperation({ summary: 'List past statement imports for the current user' })
  listStatementImports(@Req() req: { user: { id: string } }) {
    return this.journal.listStatementImports(req.user.id);
  }
}
