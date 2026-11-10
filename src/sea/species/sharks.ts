/**
 * A species pack: three sharks seen from above (a hammerhead, a blacktip, a zebra shark), as shape functions for
 * `rasterSpine` and a tile shader. Content, not a pattern — a scene brings its own species the same way.
 */
import { clamp, hash2, lerp, mix, type RGB, rgb } from '../../math.js';
import { glyphFor, litAt, PART, type ShapeFn, type SpineCell, sunDot } from '../spine.js';

export interface SharkKind {
  name: 'hammerhead' | 'blacktip' | 'zebra';
  /** Body length, units of the height. */
  L: number;
  body: RGB;
  dark: RGB;
  light: RGB;
  /** Radius of its round (units of the height) and which way it swims it. */
  ring: number;
  dir: 1 | -1;
}

export const SHARKS: readonly SharkKind[] = [
  { name: 'hammerhead', L: 0.32, body: [80, 94, 114], dark: [30, 36, 48], light: [150, 168, 186], ring: 0.17, dir: 1 },
  { name: 'blacktip', L: 0.27, body: [108, 102, 90], dark: [40, 37, 32], light: [176, 168, 150], ring: 0.22, dir: 1 },
  { name: 'zebra', L: 0.36, body: [158, 132, 80], dark: [66, 50, 26], light: [214, 190, 132], ring: 0.27, dir: -1 },
];

/** The widest part's half-width, units of L (pectoral fins, the hammer). */
export const SHARK_REACH = 0.17;

/** Half the body's width at `a` (0 snout … 1 tail tip), units of L. */
export function sharkHalfWidth(a: number, kind: number): number {
  if (kind === 2) {
    if (a < 0.07) return 0.05 * Math.sin((Math.PI / 2) * (a / 0.07)) ** 0.6;
    if (a < 0.24) return lerp(0.05, 0.064, (a - 0.07) / 0.17);
    if (a < 0.5) return lerp(0.064, 0.02, (a - 0.24) / 0.26);
    return lerp(0.02, 0.008, (a - 0.5) / 0.5);
  }
  const head = kind === 0 ? 0.03 : 0.044;
  if (a < 0.09) return head * Math.sin((Math.PI / 2) * (a / 0.09)) ** 0.6;
  if (a < 0.3) return lerp(head, 0.058, (a - 0.09) / 0.21);
  if (a < 0.86) return lerp(0.058, 0.011, ((a - 0.3) / 0.56) ** 0.9);
  return 0.011 - 0.004 * ((a - 0.86) / 0.14);
}

export function sharkShape(kind: number): ShapeFn {
  return (a, c) => {
    if (a < 0 || a > 1) return PART.NONE;
    const ac = Math.abs(c);
    const w = sharkHalfWidth(a, kind);
    if (kind === 0 && a < 0.06 && ac < 0.15) {
      // the hammer: a wing across the head, the eyes at its tips
      const thick = 0.052 - 0.2 * Math.max(0, ac - 0.09);
      if (a < thick) return ac > 0.12 && a > 0.01 && a < 0.04 ? PART.EYE : PART.BODY;
    }
    if (ac < w) {
      if (kind !== 0 && a > 0.055 && a < 0.095 && ac > 0.55 * w && ac < 0.95 * w) return PART.EYE;
      if (a > 0.3 && a < 0.44 && ac < 0.014) return kind === 1 && a > 0.42 ? PART.MARK : PART.RIDGE;
      if (kind === 2 && a > 0.1 && hash2(Math.floor(a * 34), Math.floor((c + 0.3) * 30)) < 0.3) return PART.MARK;
      return PART.BODY;
    }
    const fr = kind === 2 ? 0.12 : 0.15;
    if (a > 0.2 && a < 0.45) {
      // pectoral fins, swept back
      const reach =
        a < 0.39
          ? lerp(sharkHalfWidth(0.2, kind), fr, (a - 0.2) / 0.19)
          : lerp(fr, sharkHalfWidth(0.45, kind), (a - 0.39) / 0.06);
      if (ac < reach) return kind === 1 && ac > reach - 0.03 && ac > 0.09 ? PART.MARK : PART.FIN;
    }
    if (a > 0.62 && a < 0.71 && ac < w + 0.028 * Math.sin((Math.PI * (a - 0.62)) / 0.1)) return PART.FIN;
    if (a > 0.84) {
      // the tail's fin: a long upper lobe, a short lower one (the zebra's, a low fin on its long tail)
      const u = (a - 0.84) / 0.16;
      const reach =
        kind === 2
          ? c > 0
            ? 0.01 + 0.03 * Math.sin(Math.PI * u)
            : 0
          : c > 0
            ? 0.01 + 0.085 * u
            : 0.01 + 0.05 * Math.min(1, u * 1.4) * (a < 0.97 ? 1 : 0);
      if (ac < reach) return kind === 1 && u > 0.75 ? PART.MARK : PART.FIN;
    }
    return PART.NONE;
  };
}

export interface Tile {
  fill: string;
  glyph: string;
  ink: string;
}

/** A covered cell → its fill, its glyph and the glyph's colour. */
export function sharkTile(kind: number, cell: SpineCell): Tile {
  const K = SHARKS[kind];
  const { probe, part } = cell;
  const sd = sunDot(probe);
  let lit: number;
  let col: RGB;
  if (part === PART.FIN) {
    lit = clamp(0.7 + 0.2 * sd, 0, 1);
    col = mix(K.body, K.light, 0.35 * lit);
  } else if (part === PART.RIDGE) {
    lit = 0.18;
    col = mix(K.dark, K.body, 0.35);
  } else if (part === PART.EYE) {
    lit = 0;
    col = [20, 22, 24];
  } else if (part === PART.MARK) {
    lit = 0.1;
    col = kind === 1 ? [26, 28, 30] : mix(K.dark, [40, 30, 18], 0.4);
  } else {
    lit = litAt(probe, sharkHalfWidth(probe.along, kind));
    col = lit > 0.5 ? mix(K.body, K.light, (lit - 0.5) * 2) : mix(K.dark, K.body, lit * 2);
  }
  const ink =
    lit > 0.45
      ? `rgba(${K.dark[0]},${K.dark[1]},${K.dark[2]},0.78)`
      : `rgba(${K.light[0]},${K.light[1]},${K.light[2]},0.72)`;
  return { fill: rgb(col), glyph: part === PART.EYE ? '@' : glyphFor(lit), ink };
}
