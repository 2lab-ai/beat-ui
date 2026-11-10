import { describe, expect, it } from 'vitest';
import { seeded } from '../math';
import { midi } from '../score/score';
import { beatGridHtml } from './beat-grid';
import { PitchRoll } from './pitch-roll';

describe('beatGridHtml', () => {
  const rows = [
    { label: 'bd', pattern: 'x...x...x...x...' },
    { label: 'cp', pattern: '....x.......x...' },
  ];

  it('marks played hits, ghosts, the playhead and where we are', () => {
    const html = beatGridHtml({ on: true, bar: 12, step: 6, rows });
    const bd = html.split('\n')[1];
    expect(bd.match(/class="h"/g)?.length).toBe(2); // steps 0 and 4 played
    expect(bd.match(/class="g"/g)?.length).toBe(2); // 8 and 12 to come
    expect(bd).toContain('class="ph"');
    expect(html).toContain('bar 13 · step 7/16');
  });

  it('waits before the beat', () => {
    const html = beatGridHtml({ on: false, bar: 0, step: 0, rows });
    expect(html).toContain('waiting for the beat...');
    expect(html).not.toContain('class="ph"');
  });
});

describe('PitchRoll', () => {
  it('writes the bass onset into its pitch class and labels the chord tones', () => {
    const roll = new PitchRoll({ cols: 8, rand: seeded(1) });
    roll.step({ bass: { note: midi('ab2'), strength: 0.9 } });
    expect(roll.cols.at(-1)![8]).toBeGreaterThan(0.5); // Ab = 8
    const html = roll.html({ on: true, chordName: 'Abm', chordTones: [56, 59, 63] });
    expect(html.match(/class="lab"/g)?.length).toBe(3);
    expect(html).toContain('chord Abm');
    expect(new PitchRoll().html({ on: false })).toContain('listening for chords...');
  });
});
