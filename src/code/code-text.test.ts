import { describe, expect, it } from 'vitest';
import { activeTokens, alternation, eighthValues, line, SLIDER, slots, steps16 } from './code-text.js';

describe('code text with token ranges', () => {
  it('records each step token where its text is', () => {
    const l = steps16(line('kick').t('kick: s('), 'x...x..x..x.x...', 'bd').t(')').build();
    expect(l.text).toBe('kick: s("[bd ~ ~ ~] [bd ~ ~ bd] [~ ~ bd ~] [bd ~ ~ ~]")');
    for (const t of l.tokens) expect(l.text.slice(t.a, t.b)).toBe(t.hit ? 'bd' : '~');
    const on = (step: number) => activeTokens(l.tokens, step, 0).map((i) => l.text.slice(l.tokens[i].a, l.tokens[i].b));
    expect(on(7)).toEqual(['bd']);
    expect(on(1)).toEqual([]);
  });

  it('lights an alternation item by bar', () => {
    const l = alternation(line('bass').t('note('), ['c#3', 'ab2', 'b2', 'ab2']).t(')').build();
    const item = (bar: number) => activeTokens(l.tokens, 0, bar).map((i) => l.text.slice(l.tokens[i].a, l.tokens[i].b));
    expect([item(0), item(1), item(2), item(5)]).toEqual([['c#3'], ['ab2'], ['b2'], ['ab2']]);
  });

  it('spreads slots over the bar and lights them on their own steps', () => {
    const l = slots(line('clap'), '....x.......x...', 'cp', 4).build();
    expect(l.text).toBe('"~ cp ~ cp"');
    expect(activeTokens(l.tokens, 6, 0)).toEqual([1]);
    expect(activeTokens(l.tokens, 2, 0)).toEqual([]);
    const v = eighthValues(line('vox'), [9, -1, 6]).build();
    expect(v.text).toBe('"9 ~ 6"');
    expect(activeTokens(v.tokens, 5, 0)).toEqual([2]);
  });

  it('keeps a slider as one placeholder character and its value apart', () => {
    const l = line('bass').t('.lpf(').slider(1550, 100, 4000).t(')').build();
    expect(l.text).toBe(`.lpf(slider(${SLIDER}, 100, 4000))`);
    expect(l.sliders).toEqual([1550]);
    expect(l.unders).toEqual([{ a: 5, b: 5 + `slider(${SLIDER}, 100, 4000)`.length }]);
  });
});
