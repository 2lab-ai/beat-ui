/**
 * P3 — Code text built from the score, with token ranges.
 *
 * A line is built piece by piece; every piece that stands for something playing (a step's `bd`, a bar's `c#3`, a
 * chord's `Abm`) is recorded as a token with the character range it occupies and when it is "on". Highlighting is then
 * a lookup, never a parse of the text. A slider's number is a single placeholder character (`SLIDER`) so it can glide
 * to a new value without retyping, and so token ranges before it never shift.
 */
import type { Pattern } from '../score/score';

/** The placeholder a slider's number is drawn into. One character: typing and ranges count it once. */
export const SLIDER = '';

export interface Token {
  /** Range in the line's text: [a, b). */
  a: number;
  b: number;
  /** On while the current step is one of these (and `hit`). */
  steps?: readonly number[];
  hit?: boolean;
  /** On while `bar % mod === idx` — one item of an alternation `<a b c>`. */
  mod?: number;
  idx?: number;
}

export interface Range {
  a: number;
  b: number;
}

export interface CodeLine {
  id: string;
  text: string;
  tokens: Token[];
  /** Underlined ranges (sliders). */
  unders: Range[];
  /** Slider values, in the order their placeholders appear. */
  sliders: number[];
}

export class LineBuilder {
  private s = '';
  private readonly tokens: Token[] = [];
  private readonly unders: Range[] = [];
  private readonly sliders: number[] = [];

  constructor(private readonly id: string) {}

  /** Plain text. */
  t(text: string): this {
    this.s += text;
    return this;
  }

  /** A token: text that lights up when its step or bar plays. */
  k(text: string, on: Omit<Token, 'a' | 'b'>): this {
    this.tokens.push({ a: this.s.length, b: this.s.length + text.length, ...on });
    this.s += text;
    return this;
  }

  /** An underlined range. */
  u(text: string): this {
    this.unders.push({ a: this.s.length, b: this.s.length + text.length });
    this.s += text;
    return this;
  }

  /** `slider(<value>, min, max)`, underlined, its value kept apart so it can glide. */
  slider(value: number, min: number, max: number): this {
    this.sliders.push(value);
    return this.u(`slider(${SLIDER}, ${min}, ${max})`);
  }

  /** A newline that continues the call on the next row, indented the way you would break Strudel by hand. */
  wrap(): this {
    return this.t('\n  ');
  }

  build(): CodeLine {
    return { id: this.id, text: this.s, tokens: this.tokens, unders: this.unders, sliders: this.sliders };
  }
}

export const line = (id: string): LineBuilder => new LineBuilder(id);

/** A line that is all text (a comment, a title). */
export const plain = (id: string, text: string): CodeLine => line(id).t(text).build();

// ── mini-notation pieces: each writes the pattern and records one token per step group ──

/** 16 steps as four bracketed groups: `"[bd ~ ~ ~] [bd ~ ~ bd] …"`. */
export function steps16(b: LineBuilder, pattern: Pattern, sym: string): LineBuilder {
  b.t('"');
  for (let g = 0; g < 4; g++) {
    b.t('[');
    for (let i = 0; i < 4; i++) {
      const st = g * 4 + i;
      const hit = pattern[st] === 'x';
      b.k(hit ? sym : '~', { steps: [st], hit });
      if (i < 3) b.t(' ');
    }
    b.t(g < 3 ? '] ' : ']');
  }
  return b.t('"');
}

/** `n` evenly spaced slots over 16 steps (4 = quarters, 8 = eighths): `"~ cp ~ cp"`. Slot i is on at its steps. */
export function slots(b: LineBuilder, pattern: Pattern, sym: string, n: 4 | 8): LineBuilder {
  const w = 16 / n;
  b.t('"');
  for (let i = 0; i < n; i++) {
    const own = Array.from({ length: w }, (_, k) => i * w + k);
    const hit = pattern[i * w] === 'x';
    b.k(hit ? sym : '~', { steps: own, hit });
    if (i < n - 1) b.t(' ');
  }
  return b.t('"');
}

/** An alternation `"<a b c d>"`: item i is on while `bar % items.length === i`. */
export function alternation(b: LineBuilder, items: readonly string[]): LineBuilder {
  b.t('"<');
  items.forEach((x, i) => {
    b.k(x, { mod: items.length, idx: i });
    if (i < items.length - 1) b.t(' ');
  });
  return b.t('>"');
}

/** Per-eighth values (−1 = rest) as `"9 ~ 6 2 …"`, each on for its two steps when not a rest. */
export function eighthValues(b: LineBuilder, values: readonly number[]): LineBuilder {
  b.t('"');
  values.forEach((v, i) => {
    b.k(v < 0 ? '~' : String(v), { steps: [2 * i, 2 * i + 1], hit: v >= 0 });
    if (i < values.length - 1) b.t(' ');
  });
  return b.t('"');
}

/** Which tokens of a line are on at this step and bar. */
export function activeTokens(tokens: readonly Token[], step: number, bar: number): number[] {
  const out: number[] = [];
  tokens.forEach((t, i) => {
    if (t.mod !== undefined ? bar % t.mod === t.idx : !!t.hit && !!t.steps?.includes(step)) out.push(i);
  });
  return out;
}
