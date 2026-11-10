/**
 * P7 — A canvas drawn in cells.
 *
 * Positions are in units of the stage's height (x ∈ [0, aspect], y ∈ [0, 1]), so a scene keeps its shape at any size.
 * The stage is a grid of square cells (`cols` across); everything snaps to cells and is drawn as a fill and/or one glyph.
 *
 * The water and its faint grid are painted directly every frame. They are never cached in an offscreen canvas: in a
 * headless run that canvas once came up blank and every frame smeared over the last (reef mockup, round R4).
 */
import { hash2, TAU } from '../math.js';

export interface CellGrid {
  /** Stage size in CSS px. */
  W: number;
  H: number;
  /** W / H. */
  A: number;
  cols: number;
  rows: number;
  /** Cell size in CSS px. */
  cell: number;
  /** Cell size in units of the height. */
  cs: number;
  dpr: number;
}

export function cellGrid(W: number, H: number, cols = 64, dpr = 1): CellGrid {
  const cell = W / cols;
  return { W, H, A: W / H, cols, rows: Math.ceil(H / cell), cell, cs: cell / H, dpr };
}

/** Which cell a point (height units) falls in. */
export const cellOf = (g: CellGrid, x: number, y: number): [number, number] => [
  Math.floor(x / g.cs),
  Math.floor(y / g.cs),
];

export interface WaterStyle {
  top: string;
  bottom: string;
  gridLine?: string;
}

export interface Water {
  gradient: CanvasGradient;
  grid: Path2D;
  style: WaterStyle;
}

/** Build once per resize: the gradient and the grid path. Paint them every frame with `paintWater`. */
export function makeWater(ctx: CanvasRenderingContext2D, g: CellGrid, style: WaterStyle): Water {
  const gradient = ctx.createLinearGradient(0, 0, 0, g.H);
  gradient.addColorStop(0, style.top);
  gradient.addColorStop(1, style.bottom);
  const grid = new Path2D();
  for (let c = 0; c <= g.cols; c++) {
    const x = Math.round(c * g.cell) + 0.5;
    grid.moveTo(x, 0);
    grid.lineTo(x, g.H);
  }
  for (let r = 0; r <= g.rows; r++) {
    const y = Math.round(r * g.cell) + 0.5;
    grid.moveTo(0, y);
    grid.lineTo(g.W, y);
  }
  return { gradient, grid, style };
}

/** Reset the transform and paint the water and its grid — the first call of every frame. */
export function paintWater(ctx: CanvasRenderingContext2D, g: CellGrid, w: Water): void {
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = w.gradient;
  ctx.fillRect(0, 0, g.W, g.H);
  ctx.strokeStyle = w.style.gridLine ?? 'rgba(255,255,255,0.075)';
  ctx.lineWidth = 1;
  ctx.stroke(w.grid);
}

/** Set the glyph font for the grid's cells. */
export function glyphFont(
  ctx: CanvasRenderingContext2D,
  g: CellGrid,
  family = '"JetBrains Mono","SF Mono",ui-monospace,Menlo,monospace',
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(g.cell * 1.02)}px ${family}`;
}

export interface NetCell {
  c: number;
  r: number;
  glyph: string;
  /** 0 … 1: how close to the net's line the cell's middle is. */
  k: number;
}

/**
 * The light's net on the bottom (caustics): edges of a slowly moving Voronoi diagram (where the nearest and the
 * second-nearest feature points are almost equally far), each drawn with the glyph that follows the edge's direction.
 */
export function causticNet(g: CellGrid, t: number, spacing = 0.085, width = 1.05): NetCell[] {
  const out: NetCell[] = [];
  forEachNetCell(g, t, (c, r, glyph, k) => out.push({ c, r, glyph, k }), spacing, width);
  return out;
}

/** The same net without building a list: `visit` is called per cell on the net (what a frame loop should use). */
export function forEachNetCell(
  g: CellGrid,
  t: number,
  visit: (c: number, r: number, glyph: string, k: number) => void,
  spacing = 0.085,
  width = 1.05,
): void {
  const G = spacing;
  const nx = Math.ceil(g.A / G) + 3;
  const ny = Math.ceil(1 / G) + 3;
  const pts = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const h = hash2(i, j);
      const k = 2 * (j * nx + i);
      pts[k] = (i - 1 + 0.5 + 0.36 * Math.sin(t * 0.33 + h * 6.28)) * G;
      pts[k + 1] = (j - 1 + 0.5 + 0.36 * Math.cos(t * 0.27 + h * 9.1)) * G;
    }
  const lim = g.cs * width;
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      const px = (c + 0.5) * g.cs;
      const py = (r + 0.5) * g.cs;
      const gx = Math.floor(px / G) + 1;
      const gy = Math.floor(py / G) + 1;
      let f1 = 9;
      let f2 = 9;
      let a1 = 0;
      let b1 = 0;
      let a2 = 0;
      let b2 = 0;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const k = 2 * ((gy + oy) * nx + gx + ox);
          const qx = pts[k];
          const qy = pts[k + 1];
          const d = (px - qx) * (px - qx) + (py - qy) * (py - qy);
          if (d < f1) {
            f2 = f1;
            a2 = a1;
            b2 = b1;
            f1 = d;
            a1 = qx;
            b1 = qy;
          } else if (d < f2) {
            f2 = d;
            a2 = qx;
            b2 = qy;
          }
        }
      const e = Math.sqrt(f2) - Math.sqrt(f1);
      if (e > lim) continue;
      const th = (((Math.atan2(b2 - b1, a2 - a1) + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI;
      visit(c, r, NET_GLYPHS[Math.round(th / (Math.PI / 4)) % 4], 1 - e / lim);
    }
}

/** An edge's direction (0, 45, 90, 135° with y down) → its glyph. */
export const NET_GLYPHS = ['-', '\\', '|', '/'] as const;

export function drawCaustics(
  ctx: CanvasRenderingContext2D,
  g: CellGrid,
  t: number,
  alpha: number,
  color = '#ffffff',
): number {
  let n = 0;
  ctx.fillStyle = color;
  forEachNetCell(g, t, (c, r, glyph, k) => {
    ctx.globalAlpha = alpha * k * (0.75 + 0.25 * Math.sin((c + 0.5) * g.cs * 40 + t));
    ctx.fillText(glyph, (c + 0.5) * g.cell, (r + 0.5) * g.cell);
    n++;
  });
  ctx.globalAlpha = 1;
  return n;
}

/** The cells on a circle (a ripple), each once, snapped to the grid. */
export function ringCells(g: CellGrid, cx: number, cy: number, radius: number): Array<[number, number]> {
  const steps = Math.max(8, Math.floor((TAU * radius) / g.cs));
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * TAU;
    const c = Math.floor((cx + Math.cos(a) * radius) / g.cs);
    const r = Math.floor((cy + Math.sin(a) * radius) / g.cs);
    const key = `${c},${r}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([c, r]);
  }
  return out;
}
