import { BadRequestException } from '@nestjs/common';
import { MarketReportService } from './market-report.service';

function make(report: unknown) {
  const prisma = {
    marketReport: {
      findUnique: jest.fn().mockResolvedValue(report),
      update: jest.fn().mockResolvedValue(report),
    },
  };
  const config = { get: jest.fn((key: string) => (key === 'SITE_URL' ? 'https://nseacademy.co.ke' : undefined)) };
  const service = new MarketReportService(prisma as never, config as never);
  return { service, prisma };
}

const published = {
  sessionDate: '2026-11-19',
  status: 'published',
  cardImageUrls: [] as string[],
  social: { xPost: 'NSE closed {URL}' },
};

describe('getReportForXPosting', () => {
  it('uses the public card routes when none were stored', async () => {
    const { service, prisma } = make(published);
    const report = await service.getReportForXPosting('2026-11-19');
    expect(report.cardImageUrls).toEqual([
      'https://nseacademy.example/market-report/2026-11-19/card/1',
      'https://nseacademy.example/market-report/2026-11-19/card/2',
      'https://nseacademy.example/market-report/2026-11-19/card/3',
      'https://nseacademy.example/market-report/2026-11-19/card/4',
      'https://nseacademy.example/market-report/2026-11-19/card/5',
    ]);
    expect(prisma.marketReport.update).toHaveBeenCalledWith({
      where: { sessionDate: '2026-11-19' },
      data: { cardImageUrls: report.cardImageUrls },
    });
  });

  it('keeps card urls already stored on the report', async () => {
    const stored = ['https://cdn.example/card.png'];
    const { service, prisma } = make({ ...published, cardImageUrls: stored });
    const report = await service.getReportForXPosting('2026-11-19');
    expect(report.cardImageUrls).toEqual(stored);
    expect(prisma.marketReport.update).not.toHaveBeenCalled();
  });

  it('rejects a missing report and an unpublished one', async () => {
    await expect(make(null).service.getReportForXPosting('2026-11-19')).rejects.toBeInstanceOf(BadRequestException);
    await expect(make({ ...published, status: 'unpublished' }).service.getReportForXPosting('2026-11-19')).rejects.toThrow(
      'not published',
    );
  });
});
