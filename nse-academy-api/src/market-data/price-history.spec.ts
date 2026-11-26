import { toDailyPoints } from './price-history';

const day = (d: string, price: number, volume: string, change: string) => ({ d, price, volume, change });

describe('toDailyPoints', () => {
  it('turns each day into a point with numbers', () => {
    const { points } = toDailyPoints([day('2026-11-23', 30.15, '1,594,658', '-4.44'), day('2026-11-24', 30.1, '1.1M', '-0.17')]);
    expect(points).toEqual([
      { date: '2026-11-23', price: 30.15, changePct: -4.44, volume: 1594658 },
      { date: '2026-11-24', price: 30.1, changePct: -0.17, volume: 1100000 },
    ]);
  });

  it('leaves out a day that repeats the one before it, and counts it', () => {
    const out = toDailyPoints([
      day('2026-11-24', 30.1, '1101848', '-0.17'),
      day('2026-11-25', 30.1, '1101848', '-0.17'),
      day('2026-11-26', 31.35, '504787', '4.15'),
    ]);
    expect(out.points.map((p) => p.date)).toEqual(['2026-11-24', '2026-11-26']);
    expect(out.repeatedDays).toBe(1);
  });

  it('keeps a real day whose price did not move but whose trading did', () => {
    const out = toDailyPoints([day('2026-11-05', 30.85, '100', '2.83'), day('2026-11-06', 30.85, '522248', '0.00')]);
    expect(out.points).toHaveLength(2);
    expect(out.repeatedDays).toBe(0);
  });

  it('ignores zero prices', () => {
    expect(toDailyPoints([day('2026-11-24', 0, '5', '0')]).points).toEqual([]);
  });
});
