/**
 * P4 — A typewriter that edits like a person.
 *
 * When a line's target changes, the typewriter keeps the common head and the common tail and works only on the middle:
 * it deletes back what no longer fits, then types the new text — one keystroke at a time, the caret at the edit point.
 * Lines are edited one at a time, top to bottom; a line that finishes "lands" (a short flash) and the typist takes a
 * breath. A slider's number never retypes: it glides to its new value.
 *
 * Its clock is real elapsed time (capped at `maxDt`), not the physics step — a slow frame must not make the code fall
 * a section behind the sound (found in the reef mockup's receipts, round R4).
 */
import type { CodeLine, Range, Token } from './code-text.js';

export interface TypewriterOptions {
  /** Characters per second while typing. */
  cps?: number;
  /** Characters per second while deleting. */
  deleteCps?: number;
  /** Characters per second for spaces and newlines. */
  spaceCps?: number;
  /** Pause after a line lands, in seconds. */
  breath?: number;
  /** How fast slider values glide (per second, exponential). */
  sliderRate?: number;
  /** How fast the landing flash fades (per second). */
  landDecay?: number;
  /** Longest real step `update` takes, in seconds (a tab that was hidden must not type a page at once). */
  maxDt?: number;
}

export interface LineState {
  id: string;
  typed: string;
  target: string;
  tokens: Token[];
  unders: Range[];
  sliders: number[];
  sliderTargets: number[];
  /** 1 when the line just landed, fading to 0. */
  land: number;
  /** Length of the common tail kept during the current edit (null: work it out on the next key). */
  tail: number | null;
}

export type KeyKind = 'del' | 'add' | 'space';

export interface KeyResult {
  typed: string;
  /** Index of the character the caret sits on (or `typed.length` at the end). */
  caretAt: number;
  kind: KeyKind;
  tail: number;
}

/**
 * One keystroke from `typed` towards `target`, keeping the common head and the common tail fixed.
 * `tail` is the tail length chosen when the edit began; pass `null` on the first key of an edit.
 */
export function nextKey(typed: string, target: string, tail: number | null): KeyResult {
  let p = 0;
  while (p < typed.length && p < target.length && typed[p] === target[p]) p++;
  let q = tail;
  if (q === null) {
    q = 0;
    while (
      q < typed.length - p &&
      q < target.length - p &&
      typed[typed.length - 1 - q] === target[target.length - 1 - q]
    )
      q++;
  } else {
    // the tail was fixed when the edit began: the head may not grow into it (it would reuse the tail's first
    // character — a quote — as new text, and the line would end right but not be typed the way a person types)
    p = Math.min(p, typed.length - q, target.length - q);
  }
  q = Math.min(q, typed.length - p, target.length - p);
  const mid = typed.slice(p, typed.length - q);
  const want = target.slice(p, target.length - q);
  const cut = typed.length - q;
  if (!want.startsWith(mid))
    return { typed: typed.slice(0, cut - 1) + typed.slice(cut), caretAt: cut - 1, kind: 'del', tail: q };
  const ch = want[mid.length];
  return {
    typed: typed.slice(0, cut) + ch + typed.slice(cut),
    caretAt: cut + 1,
    kind: ch === ' ' || ch === '\n' ? 'space' : 'add',
    tail: q,
  };
}

/** Where the next keystroke of an edit lands (the end of the part kept before the tail). */
export function editPoint(typed: string, target: string, tail: number | null): number {
  let p = 0;
  while (p < typed.length && p < target.length && typed[p] === target[p]) p++;
  let q = tail ?? 0;
  if (tail === null)
    while (
      q < typed.length - p &&
      q < target.length - p &&
      typed[typed.length - 1 - q] === target[target.length - 1 - q]
    )
      q++;
  return typed.length - Math.min(q, typed.length - p);
}

export class Typewriter {
  private readonly lines = new Map<string, LineState>();
  private readonly order: string[];
  private clock = 0;
  private readonly o: Required<TypewriterOptions>;
  /** The line being edited now, or null when everything is typed. */
  current: string | null = null;
  /** Where the caret sits in the current line. */
  caretAt = 0;

  constructor(ids: readonly string[], opts: TypewriterOptions = {}) {
    this.order = [...ids];
    this.o = {
      cps: 95,
      deleteCps: 220,
      spaceCps: 160,
      breath: 0.06,
      sliderRate: 3.5,
      landDecay: 2.2,
      maxDt: 0.5,
      ...opts,
    };
    for (const id of ids)
      this.lines.set(id, {
        id,
        typed: '',
        target: '',
        tokens: [],
        unders: [],
        sliders: [],
        sliderTargets: [],
        land: 0,
        tail: null,
      });
  }

  line(id: string): LineState {
    const l = this.lines.get(id);
    if (!l) throw new Error(`typewriter: no line ${id}`);
    return l;
  }

  get ids(): readonly string[] {
    return this.order;
  }

  /** Everything typed (sliders may still be gliding). */
  get done(): boolean {
    return this.order.every((id) => this.line(id).typed === this.line(id).target);
  }

  /** New targets. `instant` sets them as already typed (a first screen, a test). Unknown ids are ignored. */
  set(lines: readonly CodeLine[], instant = false): void {
    for (const d of lines) {
      const l = this.lines.get(d.id);
      if (!l) continue;
      if (l.target !== d.text) l.tail = null;
      l.target = d.text;
      l.tokens = d.tokens;
      l.unders = d.unders;
      l.sliderTargets = d.sliders.slice();
      if (instant || l.sliders.length !== d.sliders.length) l.sliders = d.sliders.slice();
      if (instant) l.typed = d.text;
    }
  }

  /** Advance by `dt` real seconds. */
  update(dt: number): void {
    const step = Math.min(this.o.maxDt, Math.max(0, dt));
    for (const id of this.order) {
      const l = this.line(id);
      for (let i = 0; i < l.sliders.length; i++)
        l.sliders[i] += (l.sliderTargets[i] - l.sliders[i]) * Math.min(1, step * this.o.sliderRate);
      l.land = Math.max(0, l.land - step * this.o.landDecay);
    }
    this.clock += step;
    this.current = null;
    for (let guard = 0; guard < 2000; guard++) {
      const id = this.order.find((k) => this.line(k).typed !== this.line(k).target);
      if (!id) {
        this.clock = 0;
        return;
      }
      const l = this.line(id);
      if (this.current !== id) this.caretAt = editPoint(l.typed, l.target, l.tail);
      this.current = id;
      if (this.clock < 1 / this.o.cps) return;
      const k = nextKey(l.typed, l.target, l.tail);
      l.typed = k.typed;
      l.tail = k.tail;
      this.caretAt = k.caretAt;
      this.clock -= k.kind === 'del' ? 1 / this.o.deleteCps : k.kind === 'space' ? 1 / this.o.spaceCps : 1 / this.o.cps;
      if (l.typed === l.target) {
        l.land = 1;
        l.tail = null;
        this.clock -= this.o.breath;
      }
    }
  }
}
