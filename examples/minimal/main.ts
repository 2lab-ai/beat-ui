/**
 * minimal — the smallest thing built from @2lab.ai/beat-ui: a two-section beat, its code typing itself, the beat grid.
 * No sea, no species: proof that the patterns stand without the reef.
 */
import {
  arrange,
  BeatClock,
  beatGridHtml,
  CodeView,
  line,
  plain,
  Synth,
  sectionStarts,
  slots,
  steps16,
  Typewriter,
} from '@2lab.ai/beat-ui';

const KICK = 'x...x...x...x...';
const HATS = '..x...x...x...x.';
const SNARE = '....x.......x...';
const sectionOf = arrange({
  intro: [['kick', 2]],
  loop: [
    ['groove', 4],
    ['kick', 2],
  ],
});

const code = (sect: string) => [
  plain('tempo', `setcpm(124/4)  // ${sect}`),
  steps16(line('kick').t('kick: s('), KICK, 'bd').t(')').build(),
  sect === 'groove'
    ? slots(line('hats').t('hats: s('), HATS, 'oh', 8).t(')').build()
    : plain('hats', '// hats: s("oh")'),
  sect === 'groove'
    ? slots(line('snare').t('snare: s('), SNARE, 'sd', 4).t(')').build()
    : plain('snare', '// snare: s("sd")'),
];

const root = document.getElementById('code')!;
const tw = new Typewriter(['tempo', 'kick', 'hats', 'snare']);
const view = new CodeView(root, tw, ['tempo', '|', 'kick', 'hats', 'snare', '[grid]']);
tw.set([plain('tempo', '// press play'), plain('kick', ''), plain('hats', ''), plain('snare', '')], true);
const play = { on: false, bar: 0, step: 0, sect: 'kick' };
let synth: Synth | null = null;
let clock: BeatClock<{ t: number; bar: number; step: number; sect: string; start: boolean }> | null = null;

document.getElementById('go')!.addEventListener('click', () => {
  if (synth) return;
  synth = new Synth();
  clock = new BeatClock(synth.ctx, { bpm: 124 }, ({ t, bar, step }, push) => {
    const sect = sectionOf(bar);
    if (KICK[step] === 'x') synth!.kick(t);
    if (sect === 'groove' && HATS[step] === 'x') synth!.hat(t, true);
    if (sect === 'groove' && SNARE[step] === 'x') synth!.clap(t);
    push({ t, bar, step, sect, start: step === 0 && sectionStarts(sectionOf, bar) });
  });
  clock.start();
  play.on = true;
});

let last = performance.now();
requestAnimationFrame(function frame(now) {
  tw.update((now - last) / 1000);
  last = now;
  if (synth && clock)
    for (const e of clock.drain(synth.ctx.currentTime)) {
      Object.assign(play, { bar: e.bar, step: e.step, sect: e.sect });
      if (e.start) tw.set(code(e.sect));
    }
  view.render(play);
  view.slot('grid').innerHTML = beatGridHtml({
    on: play.on,
    bar: play.bar,
    step: play.step,
    rows: [
      { label: 'bd', pattern: KICK },
      { label: 'oh', pattern: play.sect === 'groove' ? HATS : '' },
      { label: 'sd', pattern: play.sect === 'groove' ? SNARE : '' },
    ],
  });
  requestAnimationFrame(frame);
});
