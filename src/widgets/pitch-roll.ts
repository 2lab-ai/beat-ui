/**
 * P6 — The pitch roll: a scrolling chroma picture in letters.
 *
 * Each step pushes one column of twelve energies (one per pitch class). Energies decay, the bass and the lead add
 * onsets, chord tones sparkle rather than sit as solid bars, and a little noise keeps it alive. Energy → a glyph from a
 * sparse-to-dense ramp. The current chord's tones are labelled on the left.
 */
import { clamp, esc } from '../math.js';
import { PITCH_CLASSES } from '../score/score.js';

export interface RollInput {
  /** The bass note (MIDI) and how hard it starts on this step (0 = none). */
  bass?: { note: number; strength: number } | null;
  /** Chord tones (MIDI) sounding now. */
  chord?: readonly number[] | null;
  /** Lead notes starting now (MIDI). */
  notes?: readonly number[];
}

export interface RollOptions {
  cols?: number;
  decay?: number;
  ramp?: string;
  rand?: () => number;
}

/** B at the top, C at the bottom. */
export const ROLL_ROWS = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

export class PitchRoll {
  readonly cols: Float32Array[];
  private readonly e = new Float32Array(12);
  private readonly decay: number;
  private readonly ramp: string;
  private readonly rand: () => number;

  constructor(opts: RollOptions = {}) {
    this.cols = Array.from({ length: opts.cols ?? 48 }, () => new Float32Array(12));
    this.decay = opts.decay ?? 0.8;
    this.ramp = opts.ramp ?? ' .:-=+*#%@';
    this.rand = opts.rand ?? Math.random;
  }

  step(input: RollInput): void {
    const e = this.e;
    const r = this.rand;
    for (let i = 0; i < 12; i++) e[i] *= this.decay;
    if (input.bass && input.bass.strength > 0) e[input.bass.note % 12] += input.bass.strength;
    if (input.chord) for (const m of input.chord) if (r() < 0.7) e[m % 12] = Math.max(e[m % 12], 0.25 + 0.5 * r());
    for (const m of input.notes ?? []) e[m % 12] += 0.85;
    const col = new Float32Array(12);
    for (let i = 0; i < 12; i++) col[i] = clamp(e[i] * (0.7 + 0.5 * r()) + (r() < 0.14 ? 0.12 + 0.25 * r() : 0), 0, 1);
    this.cols.shift();
    this.cols.push(col);
  }

  /** HTML for a `<pre>`: `.lab` on the chord's tones, `.ft` footer. */
  html(f: { on: boolean; chordName?: string | null; chordTones?: readonly number[] | null }): string {
    const tones = new Set((f.chordTones ?? []).map((m) => m % 12));
    const rows = ROLL_ROWS.map((pc) => {
      const name = PITCH_CLASSES[pc].padEnd(2, ' ');
      let line = `${tones.has(pc) && f.on ? `<span class="lab">${name}</span>` : name} │`;
      for (const col of this.cols) {
        const v = col[pc];
        line +=
          v < 0.08 ? ' ' : esc(this.ramp[clamp(Math.floor(v * (this.ramp.length - 0.001)), 1, this.ramp.length - 1)]);
      }
      return `${line}│`;
    });
    const ft = !f.on ? 'listening for chords...' : f.chordName ? `chord ${f.chordName}` : 'no chord';
    return `${rows.join('\n')}\n<span class="ft">   ${esc(ft)}</span>`;
  }
}
