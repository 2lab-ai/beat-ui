import { describe, expect, it } from 'vitest';
import { arrange, eighthsToPattern, hz, isHit, midi, sectionStarts } from './score.js';

describe('score', () => {
  const sectionOf = arrange({
    intro: [
      ['intro', 2],
      ['groove', 2],
    ],
    loop: [
      ['breakdown', 4],
      ['drop', 8],
    ],
  });

  it('plays the intro once, then the loop forever', () => {
    const at = (bars: number[]) => bars.map(sectionOf);
    expect(at([0, 1, 2, 3, 4, 7, 8, 15, 16, 19, 20, 27, 28])).toEqual([
      'intro',
      'intro',
      'groove',
      'groove',
      'breakdown',
      'breakdown',
      'drop',
      'drop',
      'breakdown',
      'breakdown',
      'drop',
      'drop',
      'breakdown',
    ]);
  });

  it('marks the first bar of every section', () => {
    const starts = Array.from({ length: 21 }, (_, b) => b).filter((b) => sectionStarts(sectionOf, b));
    expect(starts).toEqual([0, 2, 4, 8, 16, 20]);
  });

  it('refuses an empty loop', () => {
    expect(() => arrange({ intro: [['a', 1]], loop: [] })).toThrow();
  });

  it('reads note names and patterns', () => {
    expect([midi('c#3'), midi('ab2'), midi('b2'), midi('A4')]).toEqual([49, 44, 47, 69]);
    expect(hz(69)).toBe(440);
    expect(() => midi('h2')).toThrow();
    expect(eighthsToPattern([9, -1, 6, 2, -1, 1, 4, -1])).toBe('x...x.x...x.x...');
    expect([isHit('x...', 0), isHit('x...', 1), isHit(null, 0)]).toEqual([true, false, false]);
  });
});
