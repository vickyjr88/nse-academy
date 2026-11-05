import { NotFoundException } from '@nestjs/common';
import { PublicMarketDataController } from './public-market-data.controller';

function make(latest: unknown) {
  const service = { getLatestPriceForTicker: jest.fn().mockResolvedValue(latest) };
  return { controller: new PublicMarketDataController(service as never), service };
}

describe('PublicMarketDataController', () => {
  it('returns only the quote fields, with the timestamp as updatedAt', async () => {
    const ts = new Date('2026-11-04T12:00:00Z');
    const { controller } = make({ id: 'x', ticker: 'BRIT', name: 'Britam', price: 6.2, change: '+1.5%', volume: '1,000', timestamp: ts });
    expect(await controller.quote('BRIT')).toEqual({ ticker: 'BRIT', name: 'Britam', price: 6.2, change: '+1.5%', volume: '1,000', updatedAt: ts });
  });

  it('404s for a ticker with no data', async () => {
    const { controller } = make(null);
    await expect(controller.quote('NOPE')).rejects.toThrow(NotFoundException);
  });

  it('rejects a malformed ticker without touching the database', async () => {
    const { controller, service } = make(null);
    await expect(controller.quote("BRIT'; DROP")).rejects.toThrow(NotFoundException);
    expect(service.getLatestPriceForTicker).not.toHaveBeenCalled();
  });
});
