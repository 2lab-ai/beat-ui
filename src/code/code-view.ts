/**
 * P4 (DOM) — the code panel.
 *
 * A layout lists line ids, gaps and widget slots in order (`['title', 'tempo', '|', 'kick', '[grid]', …]`). Each line
 * renders only when what it shows changed (a signature of its text, active tokens, slider values, caret and flash), so
 * a panel can be rendered every frame without rewriting the DOM every frame.
 */
import { activeTokens } from './code-text';
import { DEFAULT_CLASSES, type RenderClasses, renderLine } from './render';
import type { Typewriter } from './typewriter';

/** A line id, `'|'` for a gap, or `'[name]'` for a widget slot (an element the host fills). */
export type LayoutItem = string;

export interface PlayHead {
  /** Playing (tokens light up only then). */
  on: boolean;
  bar: number;
  step: number;
}

export class CodeView {
  private readonly lineEls = new Map<string, HTMLElement>();
  private readonly slotEls = new Map<string, HTMLElement>();
  private readonly sigs = new Map<string, string>();

  constructor(
    readonly root: HTMLElement,
    readonly typewriter: Typewriter,
    layout: readonly LayoutItem[],
    private readonly classes: RenderClasses = DEFAULT_CLASSES,
  ) {
    const doc = root.ownerDocument;
    for (const item of layout) {
      if (item === '|') {
        const gap = doc.createElement('div');
        gap.className = 'gap';
        root.append(gap);
      } else if (item.startsWith('[') && item.endsWith(']')) {
        const name = item.slice(1, -1);
        const el = doc.createElement('pre');
        el.className = `wid wid-${name}`;
        root.append(el);
        this.slotEls.set(name, el);
      } else {
        const el = doc.createElement('div');
        el.className = 'ln';
        el.dataset.line = item;
        root.append(el);
        this.lineEls.set(item, el);
      }
    }
  }

  /** The element made for a `[name]` slot. */
  slot(name: string): HTMLElement {
    const el = this.slotEls.get(name);
    if (!el) throw new Error(`code-view: no slot [${name}]`);
    return el;
  }

  /** Render the lines that changed. Returns how many were written (0 on a quiet frame). */
  render(play: PlayHead): number {
    const tw = this.typewriter;
    let written = 0;
    for (const [id, el] of this.lineEls) {
      const l = tw.line(id);
      const active = l.typed === l.target && play.on ? activeTokens(l.tokens, play.step, play.bar) : [];
      const caret = tw.current === id ? tw.caretAt : -1;
      const sig = `${l.typed}|${active.join(',')}|${l.sliders.map(Math.round).join(',')}|${caret}|${l.land > 0.05}`;
      if (this.sigs.get(id) === sig) continue;
      this.sigs.set(id, sig);
      el.innerHTML = renderLine(l, active, caret, this.classes);
      written++;
    }
    return written;
  }
}
