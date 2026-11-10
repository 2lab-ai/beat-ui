/**
 * P8 — A spine creature drawn in cells.
 *
 * A body is a chain of points from the snout (follow-the-leader): the head moves, every later joint turns towards the
 * one before it by at most `jointLimit` radians, so the body bends smoothly and never folds into a C.
 *
 * To draw it, each cell asks "where am I along and across the body?" (`probeSpine`): along ∈ [0, 1] from snout to tail
 * tip, across signed in units of the body's length. A shape function answers what part is there (body, fin, eye …).
 * Ahead of the snout and past the tail, `along` runs below 0 / above 1, so shapes see "nothing" there — clamping it to
 * [0, 1] painted a half-disc in front of every snout (reef mockup, round R3). A cell whose middle misses is still filled
 * when two of four points near its corners hit, which keeps thin fins and tails from breaking up.
 */
import { angDiff, clamp } from '../math';
import type { CellGrid } from './cells';

export interface Spine {
  /** x0, y0, x1, y1 … from the snout, in units of the height. */
  nodes: Float32Array;
  /** Body length, in units of the height. */
  L: number;
  /** Heading of the snout, radians. */
  head: number;
}

export const spinePoints = (s: Spine): number => s.nodes.length / 2;

/** A straight spine trailing behind a snout at (x, y). */
export function makeSpine(x: number, y: number, head: number, L: number, points = 16): Spine {
  const nodes = new Float32Array(points * 2);
  const seg = L / (points - 1);
  for (let k = 0; k < points; k++) {
    nodes[2 * k] = x - Math.cos(head) * seg * k;
    nodes[2 * k + 1] = y - Math.sin(head) * seg * k;
  }
  return { nodes, L, head };
}

/** Move the snout along its heading, then let every joint follow, bending at most `jointLimit` each. */
export function moveSpine(s: Spine, distance: number, jointLimit = 0.075): void {
  const n = s.nodes;
  n[0] += Math.cos(s.head) * distance;
  n[1] += Math.sin(s.head) * distance;
  const points = spinePoints(s);
  const seg = s.L / (points - 1);
  let prev = s.head + Math.PI;
  for (let k = 1; k < points; k++) {
    const px = n[2 * k - 2];
    const py = n[2 * k - 1];
    const a = prev + clamp(angDiff(prev, Math.atan2(n[2 * k + 1] - py, n[2 * k] - px)), -jointLimit, jointLimit);
    n[2 * k] = px + Math.cos(a) * seg;
    n[2 * k + 1] = py + Math.sin(a) * seg;
    prev = a;
  }
}

export interface Probe {
  /** Distance to the nearest point of the spine. */
  best: number;
  /** 0 at the snout … 1 at the tail tip; < 0 ahead of the snout, > 1 past the tail. */
  along: number;
  /** Signed distance from the spine, in units of the body length. On screen (y down), heading right: above is +. */
  across: number;
  /** The spine's left normal at that point. */
  nx: number;
  ny: number;
}

export function probeSpine(s: Spine, px: number, py: number): Probe {
  const n = s.nodes;
  const segs = spinePoints(s) - 1;
  const p: Probe = { best: 9, along: 0, across: 0, nx: 0, ny: 0 };
  for (let k = 0; k < segs; k++) {
    const ax = n[2 * k];
    const ay = n[2 * k + 1];
    const vx = n[2 * k + 2] - ax;
    const vy = n[2 * k + 3] - ay;
    const vv = vx * vx + vy * vy || 1e-9;
    const raw = ((px - ax) * vx + (py - ay) * vy) / vv;
    const u = clamp(raw, 0, 1);
    const d = Math.hypot(px - (ax + vx * u), py - (ay + vy * u));
    if (d < p.best) {
      const len = Math.sqrt(vv);
      p.best = d;
      p.along = (k + (k === 0 ? Math.min(raw, 1) : k === segs - 1 ? Math.max(raw, 0) : u)) / segs;
      p.across = (vx * (py - ay) - vy * (px - ax)) / len / s.L;
      p.nx = -vy / len;
      p.ny = vx / len;
    }
  }
  return p;
}

/** Part codes a shape function returns; 0 means "nothing here". Species may add their own above these. */
export const PART = { NONE: 0, BODY: 1, FIN: 2, RIDGE: 3, EYE: 4, MARK: 5 } as const;

/** (along, across) → a part code. `across` is in units of the body length. */
export type ShapeFn = (along: number, across: number) => number;

/** Where in a cell, besides its middle, an edge cell is sampled (fractions of a cell). */
export const EDGE_SAMPLES: ReadonlyArray<readonly [number, number]> = [
  [-0.27, 0.24],
  [0.27, 0.2],
  [-0.2, -0.26],
  [0.24, -0.24],
];

export interface SpineCell {
  c: number;
  r: number;
  part: number;
  probe: Probe;
}

/**
 * Every cell the creature covers. `reach` = the widest part's half-width in units of L (fins, a hammer's wing).
 * `halfWidth(along)` (optional) lets a cell whose middle misses be skipped early when even its nearest edge cannot hit.
 */
export function rasterSpine(s: Spine, g: CellGrid, shape: ShapeFn, reach: number): SpineCell[] {
  const n = s.nodes;
  const R = reach * s.L;
  const half = (0.5 * g.cs) / s.L;
  let x0 = 9;
  let y0 = 9;
  let x1 = -9;
  let y1 = -9;
  for (let k = 0; k < spinePoints(s); k++) {
    x0 = Math.min(x0, n[2 * k]);
    x1 = Math.max(x1, n[2 * k]);
    y0 = Math.min(y0, n[2 * k + 1]);
    y1 = Math.max(y1, n[2 * k + 1]);
  }
  const c0 = Math.max(0, Math.floor((x0 - R) / g.cs));
  const c1 = Math.min(g.cols - 1, Math.ceil((x1 + R) / g.cs));
  const r0 = Math.max(0, Math.floor((y0 - R) / g.cs));
  const r1 = Math.min(g.rows - 1, Math.ceil((y1 + R) / g.cs));
  const out: SpineCell[] = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const px = (c + 0.5) * g.cs;
      const py = (r + 0.5) * g.cs;
      let probe = probeSpine(s, px, py);
      if (probe.best > R + g.cs) continue;
      let part = probe.best > R ? PART.NONE : shape(probe.along, probe.across);
      if (part === PART.NONE) {
        // nothing at its middle: skip unless the cell's nearest edge could be in, then sample four points
        if (shape(probe.along, probe.across - Math.sign(probe.across) * half) === PART.NONE) continue;
        let hits = 0;
        let first: { probe: Probe; part: number } | null = null;
        for (const [sx, sy] of EDGE_SAMPLES) {
          const q = probeSpine(s, px + sx * g.cs, py + sy * g.cs);
          const qp = q.best > R ? PART.NONE : shape(q.along, q.across);
          if (qp !== PART.NONE) {
            hits++;
            first = first ?? { probe: q, part: qp };
          }
        }
        if (hits < 2 || !first) continue;
        probe = first.probe;
        part = first.part;
      }
      out.push({ c, r, part, probe });
    }
  return out;
}

/** How lit a point of the body is (0 … 1) with light from `sun` (a unit vector, y down): the sunward side brighter. */
export const SUN: readonly [number, number] = [-0.6, -0.8];

/** How much the body's side at this point faces the light (−1 … 1). */
export function sunDot(probe: Probe, sun: readonly [number, number] = SUN): number {
  const side = probe.across >= 0 ? 1 : -1;
  return side * (probe.nx * sun[0] + probe.ny * sun[1]);
}

export function litAt(probe: Probe, halfWidth: number, sun: readonly [number, number] = SUN): number {
  return clamp(
    0.6 + 0.38 * sunDot(probe, sun) * Math.min(1, Math.abs(probe.across) / (halfWidth + 1e-4)) - 0.12 * probe.along,
    0.04,
    1,
  );
}

/** Sparse where lit, dense in shadow. */
export const GLYPH_RAMP = [':', ';', 'i', '+', 'x', '<', '$', '8', '#', '@'] as const;

export const glyphFor = (lit: number): string => GLYPH_RAMP[clamp(Math.floor((1 - lit) * 10), 0, 9)];
