/** Small numeric helpers shared by every module. */

export const TAU = Math.PI * 2;

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export type RGB = readonly [number, number, number];

export const mix = (a: RGB, b: RGB, k: number): RGB => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

export const rgb = (c: RGB): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/** The signed shortest turn from one angle to another, in (-π, π]. */
export function angDiff(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** A seeded generator (LCG), so a scene runs the same way twice — receipts depend on it. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A stable hash of two integers into [0, 1): per-cell noise that does not flicker between frames. */
export function hash2(i: number, j: number): number {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
