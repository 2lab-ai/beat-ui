/**
 * The reef's water: the library's cell canvas, spine sharks, bait ball and hunt, plus what is this scene's own —
 * the float with its speaker, the kick's ripple, splashes, and the drop's flash.
 */
import {
  armHunters,
  type CellGrid,
  cellGrid,
  DropState,
  drawCaustics,
  type Fish,
  glyphFont,
  type Hunter,
  makeHunter,
  makeSpine,
  makeSwarm,
  makeWater,
  paintWater,
  rasterSpine,
  ringCells,
  SHARK_REACH,
  SHARKS,
  scatterSwarm,
  sharkShape,
  sharkTile,
  startleSwarm,
  steerHunter,
  swarmCenter,
  swimSwarm,
  TAU,
  type Water,
} from '@2lab.ai/beat-ui';

const SHAPES = SHARKS.map((_, i) => sharkShape(i));

export class Reef {
  readonly ctx: CanvasRenderingContext2D;
  grid!: CellGrid;
  private water!: Water;
  readonly drop = new DropState();
  t = 0;
  gather = 0;
  pulse = 0;
  eaten = 0;
  codeHidden = false;
  readonly R = 0.05;
  readonly fl = { x: 0.33, y: 0.87 };
  private flT = { x: 0.33, y: 0.87 };
  readonly hunters: Hunter[];
  readonly fish: Fish[];
  private ripples: { t: number }[] = [];
  private splash: { x: number; y: number; t: number }[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly rand: () => number,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.hunters = SHARKS.map((k, i) => {
      const x = 0.28 + Math.cos(i * 2.1) * 0.15;
      const y = 0.55 + Math.sin(i * 2.1) * 0.25;
      return makeHunter(i, makeSpine(x, y, rand() * TAU, k.L), k.ring, k.dir);
    });
    this.fish = makeSwarm(36, this.fl, rand);
  }

  resize(W: number, H: number, dpr: number): void {
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.grid = cellGrid(W, H, 64, dpr);
    this.water = makeWater(this.ctx, this.grid, { top: 'rgb(112,200,208)', bottom: 'rgb(148,216,212)' });
  }

  setCodeHidden(h: boolean): void {
    this.codeHidden = h;
    this.flT = h ? { x: 0.28, y: 0.56 } : { x: 0.33, y: 0.87 };
  }

  ball() {
    return swarmCenter(this.fish);
  }

  kick(): void {
    this.ripples.push({ t: 0 });
    this.pulse = 1;
    for (const h of this.hunters) h.dash = 1;
    startleSwarm(this.fish);
  }

  /** The drop: a section change and the D key both land here. */
  dropNow(): void {
    this.drop.drop();
    armHunters(this.hunters, this.ball());
    scatterSwarm(this.fish, this.fl);
  }

  update(dt: number): void {
    this.t += dt;
    this.drop.update(dt);
    this.pulse = Math.max(0, this.pulse - dt * 5);
    this.fl.x += (this.flT.x - this.fl.x) * Math.min(1, dt * 2.5);
    this.fl.y += (this.flT.y - this.fl.y) * Math.min(1, dt * 2.5);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 0.9);
    for (const p of this.splash) p.t += dt;
    this.splash = this.splash.filter((p) => p.t < 0.55);
    const A = this.grid.A;
    swimSwarm(this.fish, dt, {
      home: this.fl,
      gather: this.gather,
      predators: this.hunters.map((h) => h.spine),
      A,
      rand: this.rand,
    });
    const hunger = this.drop.hunger;
    const world = {
      t: this.t,
      dt,
      hunger,
      ball: hunger > 0.25 ? this.ball() : null,
      fish: this.fish,
      hunters: this.hunters,
      float: this.fl,
      orbit: { x: A / 2, y: this.codeHidden ? 0.52 : 0.62 },
      A,
      rand: this.rand,
      onCatch: (f: Fish) => {
        this.splash.push({ x: f.x, y: f.y, t: 0 });
        this.eaten++;
      },
    };
    for (const h of this.hunters) steerHunter(h, world);
  }

  draw(): void {
    const g = this.ctx;
    const grid = this.grid;
    const { cell, H } = grid;
    paintWater(g, grid, this.water);
    glyphFont(g, grid);
    drawCaustics(g, grid, this.t, 0.72 + 0.3 * this.drop.dropK);
    const cells = this.hunters.flatMap((h) =>
      rasterSpine(h.spine, grid, SHAPES[h.id], SHARK_REACH).map((c) => ({ c, tile: sharkTile(h.id, c) })),
    );
    // shadows on the bottom, down and to the right
    g.fillStyle = 'rgba(24,92,104,0.2)';
    for (const { c } of cells) g.fillRect(c.c * cell + cell * 1.6, c.r * cell + cell * 2.2, cell, cell);
    g.beginPath();
    g.ellipse(this.fl.x * H + cell * 1.4, this.fl.y * H + cell * 2, this.R * H, this.R * H * 0.92, 0, 0, TAU);
    g.fill();
    this.drawFish();
    for (const { c, tile } of cells) {
      g.fillStyle = tile.fill;
      g.fillRect(c.c * cell + 0.5, c.r * cell + 0.5, cell - 1, cell - 1);
      g.fillStyle = tile.ink;
      g.fillText(tile.glyph, (c.c + 0.5) * cell, (c.r + 0.5) * cell + 0.5);
    }
    g.fillStyle = '#ffffff';
    for (const p of this.splash) {
      g.globalAlpha = 1 - p.t / 0.55;
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + p.t * 3;
        const r = 0.008 + p.t * 0.05;
        g.fillText(k % 2 ? '*' : '+', (p.x + Math.cos(a) * r) * H, (p.y + Math.sin(a) * r) * H);
      }
    }
    for (const r of this.ripples) {
      g.globalAlpha = 0.6 * (1 - r.t / 0.9);
      for (const [c, rr] of ringCells(grid, this.fl.x, this.fl.y, this.R * 1.1 + 0.085 * (r.t / 0.9)))
        g.fillText(r.t < 0.3 ? 'o' : '·', (c + 0.5) * cell, (rr + 0.5) * cell);
    }
    g.globalAlpha = 1;
    this.drawFloat();
    const k = this.drop.dropK;
    if (k > 0) {
      g.fillStyle = `rgba(255,255,255,${(0.24 * k ** 1.4).toFixed(3)})`;
      g.fillRect(0, 0, grid.W, H);
    }
  }

  private drawFish(): void {
    const g = this.ctx;
    const { cs, cell } = this.grid;
    for (const f of this.fish) {
      if (!f.alive) continue;
      const c = Math.floor(f.x / cs);
      const r = Math.floor(f.y / cs);
      const q = Math.round((((Math.atan2(f.vy, f.vx) % TAU) + TAU) % TAU) / (Math.PI / 2)) % 4;
      g.fillStyle = 'rgba(214,238,236,0.55)';
      g.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
      g.fillStyle = 'rgba(28,66,76,0.92)';
      g.fillText(['>', 'v', '<', '^'][q], (c + 0.5) * cell, (r + 0.5) * cell + 0.5);
    }
  }

  /** A red-and-white ring seen from above, a little speaker riding it (pixels of half a cell). */
  private drawFloat(): void {
    const g = this.ctx;
    const { H, cs } = this.grid;
    const R = this.R;
    const p = cs / 2;
    const n = Math.ceil((R * 1.06) / p);
    const ps = p * H;
    const px = Math.floor(this.fl.x / p) * ps;
    const py = Math.floor(this.fl.y / p) * ps;
    const pz = 1 + 0.18 * this.pulse;
    for (let j = -n; j <= n; j++)
      for (let i = -n; i <= n; i++) {
        const dx = i * p;
        const dy = j * p;
        const r = Math.hypot(dx, dy);
        let col: number[] | null = null;
        if (r < R && r > R * 0.56) {
          const seg = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4) + 0.5) % 2;
          const sh = 0.78 + 0.22 * (-(0.6 * dx + 0.8 * dy) / r) - (r > R * 0.9 || r < R * 0.62 ? 0.16 : 0);
          col = (seg ? [214, 52, 52] : [244, 244, 238]).map((v) => Math.min(255, Math.max(0, v * sh)));
          if (r > R * 0.95) col = seg ? [120, 40, 40] : [150, 150, 146];
        } else if (r <= R * 0.56) {
          const bx = Math.abs(dx);
          const by = dy;
          if (bx < R * 0.36 && by > -R * 0.27 && by < R * 0.27) {
            col = bx > R * 0.31 || Math.abs(by) > R * 0.22 ? [86, 94, 100] : [168, 176, 182];
            for (const sx of [-0.165, 0.165]) {
              const d = Math.hypot(dx - sx * R, dy - 0.01 * R);
              const rr = 0.115 * R * pz;
              if (d < rr) col = d < rr * 0.35 ? [150, 156, 160] : d > rr * 0.8 ? [64, 70, 74] : [34, 38, 42];
            }
            if (Math.abs(dx) < R * 0.05 && by < -R * 0.12 && by > -R * 0.2) col = [242, 183, 5];
          } else if (bx < R * 0.2 && by > -R * 0.37 && by <= -R * 0.27 && (bx > R * 0.14 || by < -R * 0.33))
            col = [70, 76, 80];
        }
        if (col) {
          g.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
          g.fillRect(px + i * ps, py + j * ps, ps + 0.5, ps + 0.5);
        }
      }
  }
}
