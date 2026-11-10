/**
 * P9 — A bait ball.
 *
 * Small fish orbit a home point at their own radius (tighter while `gather` is on — a breakdown pulls the ball in),
 * flee from any predator's head and front body, scatter outward on a drop, and come back from the edge a while after
 * being caught. The ball's centre is the centroid of the fish at home — what hunters charge.
 */
import { clamp, TAU } from '../math.js';
import type { Spine } from './spine.js';

export interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Its own orbit radius at rest. */
  r: number;
  alive: boolean;
  /** Seconds until a caught fish swims back in (≤ 0: at home). */
  back: number;
  /** 0 … 1: how scared. */
  alarm: number;
  /** Swimming back in from the edge after being caught; not part of the ball until it is near home. */
  returning: boolean;
  /** Which way round it swims. */
  dir: 1 | -1;
}

export interface Point {
  x: number;
  y: number;
}

export interface SwarmWorld {
  home: Point;
  /** 0 … 1: pull the ball in (a breakdown). */
  gather: number;
  predators: readonly Spine[];
  /** Stage aspect (width in units of the height). */
  A: number;
  rand: () => number;
}

export function makeSwarm(n: number, home: Point, rand: () => number): Fish[] {
  return Array.from({ length: n }, (_, i) => {
    const a = rand() * TAU;
    const r = 0.065 + rand() * 0.05;
    return {
      x: home.x + Math.cos(a) * r,
      y: home.y + Math.sin(a) * r,
      vx: 0,
      vy: 0,
      r,
      alive: true,
      back: 0,
      alarm: 0,
      returning: false,
      dir: i % 5 === 0 ? -1 : 1,
    };
  });
}

export function swimSwarm(fish: Fish[], dt: number, w: SwarmWorld): void {
  const tight = 1 - 0.5 * w.gather;
  for (const f of fish) {
    if (!f.alive) {
      f.back -= dt;
      if (f.back <= 0) {
        f.x = w.rand() < 0.5 ? -0.05 : w.A + 0.05;
        f.y = 0.3 + w.rand() * 0.6;
        f.vx = 0;
        f.vy = 0;
        f.alive = true;
        f.returning = true;
        f.back = 0;
        f.alarm = 0;
      }
      continue;
    }
    let ax = 0;
    let ay = 0;
    const hx = f.x - w.home.x;
    const hy = f.y - w.home.y;
    const hd = Math.hypot(hx, hy) || 1;
    const calm = 1 - f.alarm;
    if (f.returning && hd < f.r * 1.5) f.returning = false;
    const off = hd - f.r * tight;
    ax -= (hx / hd) * off * 5 * (0.3 + calm);
    ay -= (hy / hd) * off * 5 * (0.3 + calm);
    ax += ((-hy / hd) * 0.12 * f.dir - f.vx) * 1.6 * calm;
    ay += ((hx / hd) * 0.12 * f.dir - f.vy) * 1.6 * calm;
    for (const p of w.predators)
      for (let k = 0; k < Math.min(8, p.nodes.length / 2); k += 2) {
        const dx = f.x - p.nodes[2 * k];
        const dy = f.y - p.nodes[2 * k + 1];
        const d = Math.hypot(dx, dy);
        if (d < 0.1 && d > 1e-6) {
          const wgt = (1 - d / 0.1) * 2.2;
          ax += (dx / d) * wgt;
          ay += (dy / d) * wgt;
          f.alarm = Math.max(f.alarm, 1 - d / 0.1);
        }
      }
    f.alarm = Math.max(0, f.alarm - dt * 0.6);
    ax += (w.rand() - 0.5) * 0.3;
    ay += (w.rand() - 0.5) * 0.3;
    f.vx += ax * dt;
    f.vy += ay * dt;
    const top = 0.16 * (1 + 1.6 * f.alarm);
    const v = Math.hypot(f.vx, f.vy);
    if (v > top) {
      f.vx *= top / v;
      f.vy *= top / v;
    }
    f.x = clamp(f.x + f.vx * dt, -0.08, w.A + 0.08);
    f.y = clamp(f.y + f.vy * dt, -0.08, 1.08);
  }
}

/** Startle every fish outward from home (a drop). */
export function scatterSwarm(fish: Fish[], home: Point, push = 0.25): void {
  for (const f of fish) {
    f.alarm = 1;
    const a = Math.atan2(f.y - home.y, f.x - home.x);
    f.vx += Math.cos(a) * push;
    f.vy += Math.sin(a) * push;
  }
}

/** Startle a little (a kick). */
export function startleSwarm(fish: Fish[], amount = 0.25): void {
  for (const f of fish) f.alarm = Math.max(f.alarm, amount);
}

/** The ball: centroid of the fish at home (alive, not swimming back in), or null when fewer than `minN` are. */
export function swarmCenter(fish: readonly Fish[], minN = 6): (Point & { n: number }) | null {
  let n = 0;
  let x = 0;
  let y = 0;
  for (const f of fish)
    if (f.alive && !f.returning) {
      x += f.x;
      y += f.y;
      n++;
    }
  return n >= minN ? { x: x / n, y: y / n, n } : null;
}

/** Mean distance of the living fish from `home` — a receipt for "the ball gathered / scattered". */
export function swarmSpread(fish: readonly Fish[], home: Point): number {
  const live = fish.filter((f) => f.alive);
  return live.reduce((m, f) => m + Math.hypot(f.x - home.x, f.y - home.y), 0) / (live.length || 1);
}

export function catchFish(f: Fish, rand: () => number): void {
  f.alive = false;
  f.back = 2.5 + rand() * 2;
}
