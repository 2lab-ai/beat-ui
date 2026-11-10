import { describe, expect, it } from 'vitest';
import { line, plain } from './code-text';
import { nextKey, Typewriter } from './typewriter';

const run = (from: string, to: string) => {
  let typed = from;
  let tail: number | null = null;
  const states = [typed];
  for (let i = 0; i < 500 && typed !== to; i++) {
    const k = nextKey(typed, to, tail);
    typed = k.typed;
    tail = k.tail;
    states.push(typed);
  }
  return states;
};

describe('nextKey — edit the middle, keep head and tail', () => {
  it('never touches the common tail', () => {
    const from = '// kick: s("bd").bank("RolandTR909")';
    const to = 'kick: s("[bd ~ ~ ~]").bank("RolandTR909")';
    const states = run(from, to);
    expect(states.at(-1)).toBe(to);
    for (const s of states) expect(s.endsWith('").bank("RolandTR909")')).toBe(true);
  });

  it('appends a label without retyping the line', () => {
    const states = run('setcpm(140/4)', 'setcpm(140/4)  // drop');
    expect(states.length - 1).toBe('  // drop'.length);
    for (const s of states) expect(s.startsWith('setcpm(140/4)')).toBe(true);
  });

  it('deletes back before it types', () => {
    const states = run('abcXYZdef', 'abc12def');
    const firstGrow = states.findIndex((s, i) => i > 0 && s.length > states[i - 1].length);
    expect(states[firstGrow - 1]).toBe('abcdef');
  });
});

describe('Typewriter', () => {
  it('types on real time, not on the frame cap (reef R4: a slow frame must not drop the code a section behind)', () => {
    const tw = new Typewriter(['a'], { breath: 0 });
    tw.set([plain('a', 'x'.repeat(200))]);
    tw.update(0.3); // one slow frame
    expect(tw.line('a').typed.length).toBeGreaterThan(25);
    expect(tw.line('a').typed.length).toBeLessThan(32);
  });

  it('caps a huge step (a hidden tab) at maxDt', () => {
    const tw = new Typewriter(['a'], { breath: 0, maxDt: 0.5 });
    tw.set([plain('a', 'x'.repeat(500))]);
    tw.update(30);
    expect(tw.line('a').typed.length).toBeLessThanOrEqual(48);
  });

  it('edits one line at a time, top to bottom, and lands each', () => {
    const tw = new Typewriter(['a', 'b'], { breath: 0 });
    tw.set([plain('a', 'first'), plain('b', 'second')]);
    tw.update(0.03);
    expect(tw.current).toBe('a');
    expect(tw.line('b').typed).toBe('');
    for (let i = 0; i < 40 && !tw.done; i++) tw.update(0.02);
    expect(tw.done).toBe(true);
    expect(tw.line('b').land).toBeGreaterThan(0.5);
  });

  it('glides a slider instead of retyping it', () => {
    const tw = new Typewriter(['bass']);
    const mk = (v: number) => line('bass').t('lpf(').slider(v, 100, 4000).t(')').build();
    tw.set([mk(900)], true);
    tw.set([mk(2600)]);
    const before = tw.line('bass').typed;
    tw.update(0.2);
    expect(tw.line('bass').typed).toBe(before);
    expect(tw.line('bass').sliders[0]).toBeGreaterThan(900);
    expect(tw.line('bass').sliders[0]).toBeLessThan(2600);
    for (let i = 0; i < 40; i++) tw.update(0.1);
    expect(tw.line('bass').sliders[0]).toBeCloseTo(2600, 0);
  });
});
