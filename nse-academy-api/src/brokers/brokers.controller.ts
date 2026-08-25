import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrokersService } from './brokers.service';

@ApiTags('brokers')
@Controller('brokers')
export class BrokersController {
  constructor(private brokers: BrokersService) {}

  @Get()
  @ApiOperation({ summary: 'List active NSE brokers and their fee rates (public)' })
  list() {
    return this.brokers.listActive();
  }
}
