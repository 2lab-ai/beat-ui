/**
 * P5 — The beat grid: rows × 16 steps as text.
 *
 * Hits already played this bar are solid, hits still to come are ghosts (the pattern predicts them), the playhead is a
 * solid column across every row, and a footer says where we are. Two characters per step so blocks read as squares in
 * a monospace font.
 */
import { esc } from '../math';
import type { Pattern } from '../score/score';

export interface GridRow {
  label: string;
  pattern: Pattern | null | undefined;
}

export interface GridFrame {
  on: boolean;
  bar: number;
  step: number;
  rows: readonly GridRow[];
}

export interface GridOptions {
  stepsPerBar?: number;
  beats?: number;
  waiting?: string;
  /** Characters for a hit and an empty step (each drawn twice). */
  block?: string;
  empty?: string;
}

/** HTML for a `<pre>`: `.h` played hit, `.g` ghost, `.ph` playhead, `.ft` footer. */
export function beatGridHtml(f: GridFrame, opts: GridOptions = {}): string {
  const steps = opts.stepsPerBar ?? 16;
  const beats = opts.beats ?? 4;
  const block = (opts.block ?? '█').repeat(2);
  const empty = (opts.empty ?? '·').repeat(2);
  const per = (steps / beats) * 2;
  const pad = Math.max(...f.rows.map((r) => r.label.length), 2);
  let head = ' '.repeat(pad + 2);
  for (let b = 1; b <= beats; b++) head += String(b).padEnd(per, ' ');
  const lines = [head];
  for (const r of f.rows) {
    let row = `${esc(r.label.padEnd(pad, ' '))} │`;
    for (let s = 0; s < steps; s++) {
      const hit = !!r.pattern && r.pattern[s] === 'x';
      if (!f.on) row += empty;
      else if (s === f.step) row += `<span class="ph">${block}</span>`;
      else if (hit) row += `<span class="${s < f.step ? 'h' : 'g'}">${block}</span>`;
      else row += empty;
    }
    lines.push(`${row}│`);
  }
  const foot = f.on ? `bar ${f.bar + 1} · step ${f.step + 1}/${steps}` : (opts.waiting ?? 'waiting for the beat...');
  lines.push(`<span class="ft">${' '.repeat(pad + 2)}${esc(foot)}</span>`);
  return lines.join('\n');
}
