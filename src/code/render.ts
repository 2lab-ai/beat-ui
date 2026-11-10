/**
 * P4 (render) — a typed line → HTML.
 *
 * Ranges (active tokens, underlines, a trailing `// comment`) become spans; a `\n` closes the row and reopens every open
 * span on the next one, so a token or an underline never leaks across rows. The caret is drawn on the character it sits
 * on (inside the line while editing the middle), or after the last one.
 */
import { esc } from '../math.js';
import { SLIDER } from './code-text.js';
import type { LineState } from './typewriter.js';

export interface RenderClasses {
  row: string;
  land: string;
  comment: string;
  token: string;
  under: string;
  caret: string;
}

export const DEFAULT_CLASSES: RenderClasses = {
  row: 'row',
  land: 'land',
  comment: 'cm',
  token: 'tok',
  under: 'sl',
  caret: 'caret',
};

interface Span {
  a: number;
  b: number;
  cls: string;
}

/**
 * @param active indices of the tokens on now (ignored unless the line is fully typed)
 * @param caretAt the caret's index, or −1 for none
 */
export function renderLine(
  l: LineState,
  active: readonly number[],
  caretAt: number,
  classes: RenderClasses = DEFAULT_CLASSES,
): string {
  const s = l.typed;
  const done = l.typed === l.target;
  const isComment = s.startsWith('//');
  const commentAt = isComment ? -1 : s.indexOf('//');
  const spans: Span[] = [
    ...(done ? active.map((i) => ({ a: l.tokens[i].a, b: l.tokens[i].b, cls: classes.token })) : []),
    // ranges belong to the target text: draw them only once it is typed, or they land on the wrong characters
    ...(done ? l.unders.map((u) => ({ a: u.a, b: u.b, cls: classes.under })) : []),
  ];
  if (commentAt > 0) spans.push({ a: commentAt, b: s.length, cls: classes.comment });
  const rowOpen = `<span class="${classes.row}${isComment ? ` ${classes.comment}` : ''}${l.land > 0.05 ? ` ${classes.land}` : ''}">`;
  let h = rowOpen;
  const open: Span[] = [];
  let slider = 0;
  for (let i = 0; i <= s.length; i++) {
    for (let k = open.length - 1; k >= 0; k--) {
      if (open[k].b === i) {
        h += '</span>';
        open.splice(k, 1);
      }
    }
    if (i === s.length) break;
    const ch = s[i];
    const shown = ch === SLIDER ? String(Math.round(l.sliders[slider++] ?? 0)) : ch;
    for (const sp of spans) {
      if (sp.a === i) {
        h += `<span class="${sp.cls}">`;
        open.push(sp);
      }
    }
    if (i === caretAt && ch !== '\n') {
      h += `<span class="${classes.caret}">${esc(shown)}</span>`;
      continue;
    }
    if (ch === '\n') {
      if (i === caretAt) h += `<span class="${classes.caret}"> </span>`;
      h += `${'</span>'.repeat(open.length)}</span>${rowOpen}${open.map((sp) => `<span class="${sp.cls}">`).join('')}`;
      continue;
    }
    h += esc(shown);
  }
  h += '</span>'.repeat(open.length);
  if (caretAt >= s.length) h += `<span class="${classes.caret}">_</span>`;
  return `${h}</span>`;
}
