/**
 * P2 — The score is the single source of truth.
 *
 * Sections say which parts play and how; an arrangement maps a bar to its section; 16-step patterns are strings
 * (`'x...x...'`) so a pattern reads the same in code, in tests and on the beat grid. Sound, code text and every
 * picture are derived from the same data, so they cannot disagree.
 */

/** A row of steps: `x` = hit, anything else = rest. Length = steps per bar. */
export type Pattern = string;

export const isHit = (pattern: Pattern | undefined | null, step: number): boolean => !!pattern && pattern[step] === 'x';

/** Per-eighth values (−1 = rest) → a 16-step pattern with the hits on even steps. */
export function eighthsToPattern(values: readonly number[]): Pattern {
  return Array.from({ length: values.length * 2 }, (_, s) => (s % 2 === 0 && values[s / 2] >= 0 ? 'x' : '.')).join('');
}

export interface Section<P> {
  /** Shown in the code as `setcpm(…)  // <label>` when set. */
  label?: string;
  parts: P;
}

/** `[sectionName, bars]` runs: an intro played once, then a loop played forever. */
export interface Arrangement {
  intro: ReadonlyArray<readonly [string, number]>;
  loop: ReadonlyArray<readonly [string, number]>;
}

/** Bar (from 0) → section name. */
export function arrange(a: Arrangement): (bar: number) => string {
  const introBars = a.intro.reduce((n, [, b]) => n + b, 0);
  const loopBars = a.loop.reduce((n, [, b]) => n + b, 0);
  if (loopBars <= 0) throw new Error('arrangement: the loop needs at least one bar');
  const find = (runs: Arrangement['intro'], k: number): string => {
    for (const [name, bars] of runs) {
      if (k < bars) return name;
      k -= bars;
    }
    return runs[runs.length - 1][0];
  };
  return (bar) => (bar < introBars ? find(a.intro, bar) : find(a.loop, (bar - introBars) % loopBars));
}

/** True on the first bar of a section (bar 0 included). */
export const sectionStarts = (sectionOf: (bar: number) => string, bar: number): boolean =>
  bar === 0 || sectionOf(bar - 1) !== sectionOf(bar);

// ── pitch ──

export const PITCH_CLASSES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const NOTE: Record<string, number> = {
  c: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  f: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'a#': 10,
  bb: 10,
  b: 11,
};

/** Strudel-style note name (`c#3`, `ab2`) → MIDI number. */
export function midi(name: string): number {
  const m = name.toLowerCase().match(/^([a-g](?:#|b)?)(-?\d)$/);
  if (!m || NOTE[m[1]] === undefined) throw new Error(`midi: not a note name: ${name}`);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}

export const hz = (m: number): number => 440 * 2 ** ((m - 69) / 12);
