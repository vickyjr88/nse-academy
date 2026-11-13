import { NotFoundException } from '@nestjs/common';
import { PublicMarketDataController } from './public-market-data.controller';

function make(latest: unknown, extra: Record<string, unknown> = {}) {
  const service = { getLatestPriceForTicker: jest.fn().mockResolvedValue(latest), ...extra };
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

  it('lists every quote from the service', async () => {
    const quotes = [{ ticker: 'SCOM', name: 'Safaricom', price: 30, changePct: 1.2, volume: 100, updatedAt: new Date() }];
    const { controller } = make(null, { listQuotes: jest.fn().mockResolvedValue(quotes) });
    expect(await controller.list()).toBe(quotes);
  });

  it('returns a stock\'s daily closes, bounding the window, and 404s without history or for a bad ticker', async () => {
    const getDailyHistory = jest.fn().mockResolvedValue([{ date: '2026-11-04', price: 30 }, { date: '2026-11-05', price: 31 }]);
    const { controller } = make(null, { getDailyHistory });
    expect(await controller.history('scom', '9999')).toEqual({ ticker: 'SCOM', days: 400, points: [{ date: '2026-11-04', price: 30 }, { date: '2026-11-05', price: 31 }] });
    expect(getDailyHistory).toHaveBeenCalledWith('scom', 400);
    await controller.history('scom', undefined);
    expect(getDailyHistory).toHaveBeenLastCalledWith('scom', 90);
    await expect(make(null, { getDailyHistory: jest.fn().mockResolvedValue([]) }).controller.history('NOPE', '30')).rejects.toThrow(NotFoundException);
    await expect(controller.history("X'; DROP", '30')).rejects.toThrow(NotFoundException);
  });
});
