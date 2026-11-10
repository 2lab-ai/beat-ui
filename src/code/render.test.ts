import { describe, expect, it } from 'vitest';
import { line } from './code-text.js';
import { renderLine } from './render.js';
import { Typewriter } from './typewriter.js';

const typed = (l: ReturnType<ReturnType<typeof line>['build']>) => {
  const tw = new Typewriter([l.id]);
  tw.set([l], true);
  return tw.line(l.id);
};

const balanced = (html: string) => (html.match(/<span/g) ?? []).length === (html.match(/<\/span>/g) ?? []).length;

describe('renderLine', () => {
  it('escapes the code', () => {
    const l = typed(line('x').t('a < b && c > d').build());
    expect(renderLine(l, [], -1)).toContain('a &lt; b &amp;&amp; c &gt; d');
  });

  it('reopens a token on the next row and keeps spans balanced', () => {
    const l = typed(line('x').t('a(').u('under\nlined').t(')').build());
    const html = renderLine(l, [], -1);
    expect(balanced(html)).toBe(true);
    expect(html.match(/class="row"/g)?.length).toBe(2);
    expect(html.match(/class="sl"/g)?.length).toBe(2);
  });

  it('keeps spans balanced when the caret sits where a range starts (found while extracting the reef mockup)', () => {
    const l = typed(line('x').t('lpf(').slider(500, 100, 4000).t(')').build());
    const at = l.unders[0].a;
    expect(balanced(renderLine(l, [], at))).toBe(true);
  });

  it('greys a trailing comment and draws the slider value', () => {
    const l = typed(line('x').t('setcpm(140/4)  // drop').build());
    expect(renderLine(l, [], -1)).toContain('<span class="cm">// drop</span>');
    const s = typed(line('y').slider(1550, 100, 4000).build());
    expect(renderLine(s, [], -1)).toContain('slider(1550, 100, 4000)');
  });
});

describe('renderLine mid-edit (code review, PR #2)', () => {
  it('draws the caret on a newline and keeps underlines off a line still being typed', () => {
    const l = typed(line('x').t('kick').wrap().t('.lpf(').slider(500, 100, 4000).t(')').build());
    expect(renderLine(l, [], 4)).toContain('<span class="caret"> </span>');
    const half = { ...l, typed: l.typed.slice(0, 12) };
    expect(renderLine(half, [], -1)).not.toContain('class="sl"');
  });
});
