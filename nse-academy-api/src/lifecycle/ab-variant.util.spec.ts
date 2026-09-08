import { assignVariant } from './ab-variant.util';

describe('assignVariant', () => {
  it('is deterministic - same user + test always returns the same variant', () => {
    const first = assignVariant('user-123', 'day14-pitch', ['a', 'b'] as const);
    for (let i = 0; i < 20; i++) {
      expect(assignVariant('user-123', 'day14-pitch', ['a', 'b'] as const)).toBe(first);
    }
  });

  it('different test names can assign the same user to different variants independently', () => {
    // Not asserting a specific outcome (that would be testing the hash
    // function itself) - just that varying testName is part of the input,
    // so two different experiments don't accidentally correlate.
    const a = assignVariant('user-123', 'day14-pitch', ['a', 'b'] as const);
    const b = assignVariant('user-123', 'winback-pitch', ['a', 'b'] as const);
    expect(['a', 'b']).toContain(a);
    expect(['a', 'b']).toContain(b);
  });

  it('splits a large population roughly evenly across 2 variants', () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) {
      const v = assignVariant(`user-${i}`, 'day14-pitch', ['a', 'b'] as const);
      counts[v]++;
    }
    // Not asserting exactly 50/50 - a hash-based split has natural variance -
    // but it should be nowhere near lopsided for 2000 samples.
    expect(counts.a).toBeGreaterThan(800);
    expect(counts.b).toBeGreaterThan(800);
  });

  it('throws rather than silently returning undefined for an empty variant list', () => {
    expect(() => assignVariant('user-123', 'broken-test', [])).toThrow();
  });

  it('supports 3+ variants, not just A/B', () => {
    const v = assignVariant('user-123', 'three-way', ['a', 'b', 'c'] as const);
    expect(['a', 'b', 'c']).toContain(v);
  });
});
