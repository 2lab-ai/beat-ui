/**
 * P10 — The drop, and a hunt that answers it.
 *
 * `DropState` holds two decaying numbers: `dropK` (the flash, ~3 s) and `hunger` (~6 s). A section change to "drop"
 * and the D key call the same `drop()`.
 *
 * A hunter steers by adding weighted pulls to its heading: a slow wander, then one goal — charge the bait ball until it
 * has cut through it once (or hunger fades), then hunt the nearest fish ahead, else swim its round — plus room for the
 * others, clearance from the float, and a pull back when it leaves the stage. Turning is capped by speed. Charging only
 * for a fixed time left the sharks short of a ball that had already scattered (reef mockup, round R4): the goal is
 * "pass through it", not "charge for 1.3 s".
 */
import { angDiff, clamp } from '../math.js';
import { moveSpine, type Spine } from './spine.js';
import { catchFish, type Fish, type Point } from './swarm.js';

export class DropState {
  dropK = 0;
  hunger = 0;
  constructor(
    readonly flashSeconds = 3.2,
    readonly hungerSeconds = 6,
  ) {}
  drop(): void {
    this.dropK = 1;
    this.hunger = 1;
  }
  update(dt: number): void {
    this.dropK = Math.max(0, this.dropK - dt / this.flashSeconds);
    this.hunger = Math.max(0, this.hunger - dt / this.hungerSeconds);
  }
}

export interface Hunter {
  id: number;
  spine: Spine;
  speed: number;
  wander: number;
  /** 1 on a kick, fading: a burst of speed. */
  dash: number;
  /** When it next picks prey. */
  look: number;
  prey: Fish | null;
  /** Has cut through the ball since the last drop. */
  passed: boolean;
  ate: number;
  /** Its round: radius (units of the height) and direction. */
  ring: number;
  dir: 1 | -1;
  /** Receipts since the last drop. */
  atDrop: number | null;
  closest: number;
  speedAtDrop: number;
  topSpeed: number;
}

export function makeHunter(id: number, spine: Spine, ring: number, dir: 1 | -1): Hunter {
  return {
    id,
    spine,
    speed: 0.05,
    wander: 0,
    dash: 0,
    look: 0,
    prey: null,
    passed: false,
    ate: -9,
    ring,
    dir,
    atDrop: null,
    closest: 9,
    speedAtDrop: 0,
    topSpeed: 0,
  };
}

/** Call on a drop, with the ball as it is now: re-arms the charge and starts the receipts. */
export function armHunters(hunters: readonly Hunter[], ball: Point | null): void {
  for (const h of hunters) {
    h.atDrop = ball ? Math.hypot(ball.x - h.spine.nodes[0], ball.y - h.spine.nodes[1]) : null;
    h.closest = h.atDrop ?? 9;
    h.speedAtDrop = h.speed;
    h.topSpeed = h.speed;
    h.passed = false;
  }
}

export interface HuntWorld {
  t: number;
  dt: number;
  hunger: number;
  /** The bait ball now (null: none). */
  ball: Point | null;
  fish: Fish[];
  hunters: readonly Hunter[];
  float: Point;
  /** Centre of the round. */
  orbit: Point;
  /** Stage aspect. */
  A: number;
  rand: () => number;
  onCatch?: (f: Fish, h: Hunter) => void;
}

export function steerHunter(h: Hunter, w: HuntWorld): void {
  const s = h.spine;
  const n = s.nodes;
  const x = n[0];
  const y = n[1];
  const { t, dt, hunger } = w;
  const ball = w.ball && hunger > 0.55 && !h.passed ? w.ball : null;
  let dx = Math.cos(s.head);
  let dy = Math.sin(s.head);
  h.wander = clamp(h.wander + (w.rand() - 0.5) * dt * 2.2, -0.7, 0.7);
  dx += Math.cos(s.head + h.wander) * 0.3;
  dy += Math.sin(s.head + h.wander) * 0.3;
  let close = 0;
  if (!ball && hunger > 0.25 && t >= h.look) {
    let best = 0.45;
    let pick: Fish | null = null;
    for (const f of w.fish) {
      if (!f.alive) continue;
      const fx = f.x - x;
      const fy = f.y - y;
      const d = Math.hypot(fx, fy);
      const ahead = (fx * Math.cos(s.head) + fy * Math.sin(s.head)) / (d || 1);
      const score = d * (1.6 - 0.6 * ahead);
      if (score < best) {
        best = score;
        pick = f;
      }
    }
    h.prey = pick;
    h.look = t + 0.5;
  }
  if (ball || hunger <= 0.25) h.prey = null;
  const prey = h.prey && h.prey.alive ? h.prey : null;
  if (!ball && prey) {
    const tx = prey.x + prey.vx * 0.3 - x;
    const ty = prey.y + prey.vy * 0.3 - y;
    const d = Math.hypot(tx, ty) || 1;
    dx += (tx / d) * (1.6 + 2.4 * hunger);
    dy += (ty / d) * (1.6 + 2.4 * hunger);
    close = clamp(1 - d / (s.L * 0.9), 0, 1);
    if (Math.hypot(prey.x - x, prey.y - y) < 0.025) {
      catchFish(prey, w.rand);
      h.ate = t;
      h.prey = null;
      w.onCatch?.(prey, h);
    }
  } else if (ball) {
    const side = (h.id - 1) * 0.03;
    const bx = ball.x - x;
    const by = ball.y - y;
    const bd = Math.hypot(bx, by) || 1;
    const tx = bx + (bx / bd) * 0.1 - (by / bd) * side;
    const ty = by + (by / bd) * 0.1 + (bx / bd) * side;
    const d = Math.hypot(tx, ty) || 1;
    dx += (tx / d) * 4;
    dy += (ty / d) * 4;
    close = clamp(1 - bd / (s.L * 0.9), 0, 1);
    h.topSpeed = Math.max(h.topSpeed, h.speed);
    if (bd < 0.05 && t - h.ate > 0.35) {
      for (const f of w.fish)
        if (f.alive && Math.hypot(f.x - x, f.y - y) < 0.035) {
          catchFish(f, w.rand);
          h.ate = t;
          w.onCatch?.(f, h);
          break;
        }
    }
  } else {
    // the round: an ellipse about the middle of the water, taller than wide
    const rx = x - w.orbit.x;
    const ry = (y - w.orbit.y) / 1.55;
    const r = Math.hypot(rx, ry) || 1;
    const out = clamp((h.ring - r) / h.ring, -1, 1);
    dx += ((-ry / r) * h.dir + (rx / r) * out * 0.9) * 0.6;
    dy += ((rx / r) * h.dir + (ry / r) * out * 0.9) * 0.6;
  }
  for (const o of w.hunters) {
    if (o === h) continue;
    for (let k = 0; k < o.spine.nodes.length / 2; k += 3) {
      const ox = x - o.spine.nodes[2 * k];
      const oy = y - o.spine.nodes[2 * k + 1];
      const d = Math.hypot(ox, oy);
      const far = (s.L + o.spine.L) * 0.42;
      if (d < far && d > 1e-6) {
        const wgt = (1 - d / far) * (ball ? 0.8 : 2.6);
        dx += (ox / d) * wgt;
        dy += (oy / d) * wgt;
      }
    }
  }
  const chasing = !!(ball || prey);
  const ex = x - w.float.x;
  const ey = y - w.float.y;
  const e = Math.hypot(ex, ey);
  const clear = (chasing ? 0.07 : 0.15) + 0.1 * s.L;
  if (e < clear && e > 1e-6) {
    const wgt = (1 - e / clear) * (chasing ? 0.4 : 2.4);
    dx += (ex / e) * wgt;
    dy += (ey / e) * wgt;
  }
  const over = Math.max(-x, x - w.A, -y, y - 1);
  const near = s.L * 0.3;
  if (over > -near) {
    const wgt = clamp((over + near) / (s.L * 0.35), 0, 1) * 3.5 + (over > 0 ? 3 : 0);
    const tx = w.orbit.x - x;
    const ty = w.orbit.y - y;
    const d = Math.hypot(tx, ty) || 1;
    dx += (tx / d) * wgt;
    dy += (ty / d) * wgt;
  }
  const most =
    Math.min(chasing || over > 0 ? 1.7 + close + 1.1 * hunger : 0.55, h.speed / (s.L * (ball ? 0.22 : 0.3))) * dt;
  s.head += clamp(angDiff(s.head, Math.atan2(dy, dx)), -most, most);
  h.dash = Math.max(0, h.dash - dt * 2.6);
  const cruise = 0.032 + 0.065 * s.L;
  const want =
    (ball
      ? cruise * (3.2 + 1.2 * close) * (1 + 0.8 * hunger)
      : prey
        ? cruise * (1.6 + 1.5 * close) * (1 + 0.6 * hunger)
        : cruise) *
    (1 + 0.45 * h.dash);
  h.speed += (want - h.speed) * Math.min(1, dt * (chasing ? 3.5 : 1.4));
  moveSpine(s, h.speed * dt);
  if (ball) {
    // measured along the path the snout swept this step, not at its end: at 20 fps a charging shark moves ~0.02 a
    // frame and could pass through the ball between two samples (reef example receipts on a loaded machine)
    const swept = segmentDistance(ball.x, ball.y, x, y, n[0], n[1]);
    h.closest = Math.min(h.closest, swept);
    if (swept < 0.04) h.passed = true;
  }
}

/** Distance from point p to the segment a→b. */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const vv = vx * vx + vy * vy;
  const u = vv > 0 ? clamp(((px - ax) * vx + (py - ay) * vy) / vv, 0, 1) : 0;
  return Math.hypot(px - (ax + vx * u), py - (ay + vy * u));
}
