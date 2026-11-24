import { hasRoboticPunctuation, plainCopy } from './plain-copy';

describe('plainCopy', () => {
  it('turns a spaced em dash into a full stop when a new sentence follows', () => {
    expect(plainCopy('Closing bell — NSE Tue 24 Nov closes with 19 up.')).toBe('Closing bell. NSE Tue 24 Nov closes with 19 up.');
  });

  it('turns a spaced em dash before lower case into a comma', () => {
    expect(plainCopy('Banks led — and the rest followed')).toBe('Banks led, and the rest followed');
  });

  it('turns an unspaced em dash into a comma and never leaves a double mark', () => {
    expect(plainCopy('one—two')).toBe('one, two');
    expect(plainCopy('Wait, — what')).toBe('Wait, what');
  });

  it('keeps numeric ranges readable and treats a spaced en dash as a pause', () => {
    expect(plainCopy('KSh 9–10 a share')).toBe('KSh 9-10 a share');
    expect(plainCopy('Equity – the big one')).toBe('Equity, the big one');
  });

  it('removes middle dots from labels and curly quotes from prose', () => {
    expect(plainCopy('Midday session · Spotlight')).toBe('Midday session, Spotlight');
    expect(plainCopy('It’s “quiet”…')).toBe('It\'s "quiet"...');
  });

  it('leaves a link and normal punctuation alone', () => {
    const t = 'Full breakdown: https://nseacademy.co.ke/market-report/2026-11-24';
    expect(plainCopy(t)).toBe(t);
  });

  it('is idempotent and reports whether anything robotic is left', () => {
    const once = plainCopy('A — B · C – D');
    expect(plainCopy(once)).toBe(once);
    expect(hasRoboticPunctuation('A — B')).toBe(true);
    expect(hasRoboticPunctuation(once)).toBe(false);
  });

  it('keeps line breaks between paragraphs', () => {
    expect(plainCopy('First — one.\n\nSecond line.')).toBe('First, one.\n\nSecond line.');
  });
});
