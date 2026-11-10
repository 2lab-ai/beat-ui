import { describe, expect, it } from 'vitest';
import { angDiff, seeded } from '../math.js';
import { causticNet, cellGrid, NET_GLYPHS, ringCells } from './cells.js';
import { armHunters, DropState, makeHunter, segmentDistance, steerHunter } from './hunt.js';
import { SHARK_REACH, SHARKS, sharkShape } from './species/sharks.js';
import { makeSpine, moveSpine, PART, probeSpine, rasterSpine } from './spine.js';
import { makeSwarm, scatterSwarm, swarmCenter, swarmSpread, swimSwarm } from './swarm.js';

const grid = cellGrid(540, 960, 64);

describe('cells', () => {
  it('measures in units of the height', () => {
    expect(grid.cs).toBeCloseTo(540 / 64 / 960, 9);
    expect(grid.rows).toBe(Math.ceil(960 / (540 / 64)));
  });

  it('draws the net with direction glyphs, inside the grid, the same way twice', () => {
    const a = causticNet(grid, 3);
    expect(a.length).toBeGreaterThan(200);
    for (const n of a) {
      expect(NET_GLYPHS).toContain(n.glyph);
      expect(n.c).toBeLessThan(grid.cols);
      expect(n.r).toBeLessThan(grid.rows);
    }
    expect(causticNet(grid, 3)).toEqual(a);
  });

  it('puts a ripple on each cell once', () => {
    const ring = ringCells(grid, 0.3, 0.8, 0.08);
    expect(new Set(ring.map(([c, r]) => `${c},${r}`)).size).toBe(ring.length);
  });
});

describe('spine', () => {
  it('keeps its joints the same length and bends each no more than the limit', () => {
    const s = makeSpine(0.3, 0.5, 0, 0.3);
    for (let i = 0; i < 60; i++) {
      s.head += 0.2;
      moveSpine(s, 0.01, 0.075);
    }
    const seg = 0.3 / 15;
    let prev = Math.atan2(s.nodes[1] - s.nodes[3], s.nodes[0] - s.nodes[2]);
    for (let k = 1; k < 16; k++) {
      const len = Math.hypot(s.nodes[2 * k] - s.nodes[2 * k - 2], s.nodes[2 * k + 1] - s.nodes[2 * k - 1]);
      expect(len).toBeCloseTo(seg, 5);
      if (k > 1) {
        const a = Math.atan2(s.nodes[2 * k - 1] - s.nodes[2 * k + 1], s.nodes[2 * k - 2] - s.nodes[2 * k]);
        expect(Math.abs(angDiff(prev, a))).toBeLessThanOrEqual(0.075 + 1e-4);
        prev = a;
      }
    }
  });

  it('reads "ahead of the snout" as along < 0 and "past the tail" as along > 1 (reef R3)', () => {
    const s = makeSpine(0.3, 0.5, 0, 0.3); // heading +x, tail towards −x
    expect(probeSpine(s, 0.32, 0.5).along).toBeLessThan(0);
    expect(probeSpine(s, -0.02, 0.5).along).toBeGreaterThan(1);
    expect(probeSpine(s, 0.2, 0.49).across).toBeGreaterThan(0); // heading right on screen: above the spine is +
  });

  it('paints nothing in front of the snout, and keeps the thin tail', () => {
    const s = makeSpine(0.35, 0.5, 0, SHARKS[0].L);
    const cells = rasterSpine(s, grid, sharkShape(0), SHARK_REACH);
    const ahead = cells.filter(({ c }) => (c + 0.5) * grid.cs > 0.35 + grid.cs);
    expect(ahead).toEqual([]);
    expect(cells.some((x) => x.probe.along > 0.85)).toBe(true);
    expect(cells.some((x) => x.part === PART.EYE)).toBe(true);
  });

  it('gives each species its own outline', () => {
    expect(sharkShape(0)(0.03, 0.13)).not.toBe(PART.NONE); // the hammer's wing
    expect(sharkShape(1)(0.03, 0.13)).toBe(PART.NONE);
    expect(sharkShape(1)(-0.01, 0)).toBe(PART.NONE);
  });
});

describe('bait ball and hunt', () => {
  const home = { x: 0.33, y: 0.87 };
  const simulateSwarm = (gather: number) => {
    const rand = seeded(7);
    const fish = makeSwarm(36, home, rand);
    for (let i = 0; i < 240; i++) swimSwarm(fish, 1 / 60, { home, gather, predators: [], A: 0.5625, rand });
    return swarmSpread(fish, home);
  };

  it('pulls in on a breakdown and scatters on a drop', () => {
    expect(simulateSwarm(1)).toBeLessThan(simulateSwarm(0) * 0.8);
    const rand = seeded(3);
    const fish = makeSwarm(36, home, rand);
    const before = swarmSpread(fish, home);
    scatterSwarm(fish, home);
    for (let i = 0; i < 40; i++) swimSwarm(fish, 1 / 60, { home, gather: 0, predators: [], A: 0.5625, rand });
    expect(swarmSpread(fish, home)).toBeGreaterThan(before * 1.4);
    expect(swarmCenter(fish.slice(0, 3))).toBeNull();
  });

  it('decays the flash and the hunger', () => {
    const d = new DropState();
    d.drop();
    d.update(3);
    expect(d.dropK).toBeCloseTo(1 - 3 / 3.2, 6);
    expect(d.hunger).toBeCloseTo(0.5, 6);
  });

  const charge = (dt: number, frames: number) => {
    const rand = seeded(11);
    const ball = { x: 0.3, y: 0.75 };
    const hunters = SHARKS.map((k, i) =>
      makeHunter(i, makeSpine(0.1 + 0.15 * i, 0.3, Math.PI / 2, k.L), k.ring, k.dir),
    );
    const drop = new DropState();
    drop.drop();
    armHunters(hunters, ball);
    for (let f = 0; f < frames; f++) {
      drop.update(dt);
      for (const h of hunters)
        steerHunter(h, {
          t: f * dt,
          dt,
          hunger: drop.hunger,
          ball,
          fish: [],
          hunters,
          float: home,
          orbit: { x: 0.28, y: 0.62 },
          A: 0.5625,
          rand,
        });
    }
    return hunters;
  };

  it('measures a pass on the path swept between two frames, not only at the frame', () => {
    // both ends of the step are 0.0416 away; the path passes 0.035 from the ball
    expect(Math.hypot(0.035, 0.0225)).toBeGreaterThan(0.04);
    expect(segmentDistance(0.335, 0.7225, 0.3, 0.7, 0.3, 0.745)).toBeCloseTo(0.035, 9);
    expect(segmentDistance(0, 0, 1, 1, 1, 1)).toBeCloseTo(Math.SQRT2, 9);
    expect(charge(1 / 20, 60).filter((h) => h.passed).length).toBeGreaterThanOrEqual(2);
  });

  it('charges the ball until it has cut through it (reef R4), faster than it cruises', () => {
    const rand = seeded(11);
    const ball = { x: 0.3, y: 0.75 };
    const hunters = SHARKS.map((k, i) =>
      makeHunter(i, makeSpine(0.1 + 0.15 * i, 0.3, Math.PI / 2, k.L), k.ring, k.dir),
    );
    const drop = new DropState();
    drop.drop();
    armHunters(hunters, ball);
    const dt = 1 / 60;
    for (let f = 0; f < 150; f++) {
      drop.update(dt);
      for (const h of hunters)
        steerHunter(h, {
          t: f * dt,
          dt,
          hunger: drop.hunger,
          ball,
          fish: [],
          hunters,
          float: home,
          orbit: { x: 0.28, y: 0.62 },
          A: 0.5625,
          rand,
        });
    }
    expect(hunters.filter((h) => h.closest < 0.04).length).toBeGreaterThanOrEqual(2);
    for (const h of hunters) expect(h.topSpeed).toBeGreaterThan(h.speedAtDrop * 3);
  });
});

describe('sea (code review, PR #2)', () => {
  it('reads past the tail of a one-segment spine as along > 1', () => {
    const s = makeSpine(0.3, 0.5, 0, 0.2, 2);
    expect(probeSpine(s, 0.05, 0.5).along).toBeGreaterThan(1);
    expect(probeSpine(s, 0.35, 0.5).along).toBeLessThan(0);
  });

  it('leaves fish swimming back in out of the ball', () => {
    const home = { x: 0.3, y: 0.8 };
    const fish = makeSwarm(10, home, seeded(2));
    const c0 = swarmCenter(fish)!;
    for (const f of fish.slice(0, 4)) Object.assign(f, { x: 0, y: 0.3, returning: true });
    const c1 = swarmCenter(fish)!;
    expect(c1.n).toBe(6);
    expect(Math.hypot(c1.x - c0.x, c1.y - c0.y)).toBeLessThan(0.05);
  });

  it('catches prey at the fish, not at the point it aims for', () => {
    const rand = seeded(5);
    const h = makeHunter(0, makeSpine(0.3, 0.5, 0, 0.3), 0.2, 1);
    // the aim point (fish + v·0.3) sits right on the snout; the fish itself is 0.12 away
    const prey = {
      x: 0.42,
      y: 0.5,
      vx: -0.4,
      vy: 0,
      r: 0.07,
      alive: true,
      back: 0,
      alarm: 1,
      returning: false,
      dir: 1 as const,
    };
    h.prey = prey;
    h.look = 99;
    steerHunter(h, {
      t: 0,
      dt: 1 / 60,
      hunger: 0.5,
      ball: null,
      fish: [prey],
      hunters: [h],
      float: { x: 0.3, y: 0.9 },
      orbit: { x: 0.28, y: 0.6 },
      A: 0.5625,
      rand,
    });
    expect(prey.alive).toBe(true);
  });
});
