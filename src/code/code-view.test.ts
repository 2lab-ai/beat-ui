import { describe, expect, it } from 'vitest';
import { plain } from './code-text';
import { CodeView } from './code-view';
import { Typewriter } from './typewriter';

describe('CodeView', () => {
  it('builds the layout and writes only what changed', () => {
    const root = document.createElement('div');
    const tw = new Typewriter(['title', 'kick']);
    const view = new CodeView(root, tw, ['title', '|', 'kick', '[grid]']);
    expect(root.querySelectorAll('.ln').length).toBe(2);
    expect(root.querySelector('.gap')).not.toBeNull();
    expect(view.slot('grid').tagName).toBe('PRE');
    tw.set([plain('title', 'x = demo("a")'), plain('kick', 'kick: s("bd")')], true);
    expect(view.render({ on: false, bar: 0, step: 0 })).toBe(2);
    expect(view.render({ on: false, bar: 0, step: 0 })).toBe(0);
    expect(root.textContent).toContain('x = demo("a")');
  });
});
