# @2lab.ai/beat-ui

Beat-synced live-code visuals as zero-dependency TypeScript patterns: a beat writes its own Strudel code, a grid and a
pitch roll follow it, and an ASCII sea answers the drop.

**Live examples: [reef](examples/reef/) · [minimal](examples/minimal/) — docs at https://2lab.ai/beat-ui once deployed**

```text
@2lab.ai/beat-ui
├── clock      P1  BeatClock — books sound ahead on the audio clock, queues what the picture must show at the same time
├── score      P2  arrange · Pattern ('x...x...') · midi — one source for sound, code and grid
├── code       P3  line() · steps16 · slots · alternation — code text with token ranges and gliding sliders
│              P4  Typewriter · CodeView — edits the middle of a line like a person, on real time
├── widgets    P5  beatGridHtml        P6  PitchRoll
├── sea        P7  cellGrid · paintWater · drawCaustics — a canvas drawn in cells, in units of the height
│              P8  makeSpine · moveSpine · rasterSpine — creatures that bend, drawn cell by cell
│              P9  swimSwarm — a bait ball        P10 DropState · steerHunter — the drop and the hunt
│              species/sharks — a hammerhead, a blacktip, a zebra shark (content, not a pattern)
├── audio      P11 Synth — kick, clap, hats, bass, supersaw, vox in plain WebAudio, at booked times
└── receipts   P12 exposeReceipts — the page says what it shows, in numbers
```

Read [docs/patterns.md](docs/patterns.md) for what each pattern is for, its shape, and the mistake it exists to prevent.

## Use it

```ts
import { BeatClock, CodeView, Synth, Typewriter, beatGridHtml, line, plain, steps16 } from '@2lab.ai/beat-ui';

const KICK = 'x...x...x...x...';
const tw = new Typewriter(['tempo', 'kick']);
const view = new CodeView(document.getElementById('code')!, tw, ['tempo', 'kick', '[grid]']);
tw.set([plain('tempo', 'setcpm(124/4)'), steps16(line('kick').t('kick: s('), KICK, 'bd').t(')').build()]);

const play = { on: false, bar: 0, step: 0 };
let synth: Synth | null = null;
let clock: BeatClock<{ t: number; bar: number; step: number }> | null = null;

// browsers start audio only from a user gesture: create the AudioContext in the click
document.getElementById('play')!.addEventListener('click', () => {
  if (synth) return;
  const sy = (synth = new Synth());
  clock = new BeatClock(sy.ctx, { bpm: 124 }, (s, push) => {
    if (KICK[s.step] === 'x') sy.kick(s.t);
    push(s);
  });
  clock.start();
  play.on = true;
});

let last = performance.now();
requestAnimationFrame(function frame(now) {
  tw.update((now - last) / 1000); // real time, not the physics step
  last = now;
  if (synth && clock) for (const e of clock.drain(synth.ctx.currentTime)) Object.assign(play, e);
  view.render(play);
  view.slot('grid').innerHTML = beatGridHtml({ ...play, rows: [{ label: 'bd', pattern: KICK }] });
  requestAnimationFrame(frame);
});
```

`examples/minimal` is this, with a second section. `examples/reef` is the whole shark scene.

## Work on it

```bash
npm install
npm run dev          # examples at http://localhost:5173/beat-ui/
npm run verify       # biome · tsc · vitest · lib build + types · site build
PLAYWRIGHT_FROM=<a package.json whose node_modules has playwright> npm run receipts   # after build:site
```

Where it came from: the reef mockup in `ascii-shark-visualizer` (a `.prd`-driven reproduction of the shark scene in
[Toaster](https://github.com/StopBanning/toaster), MIT). No Toaster code was copied; the library reproduces the
experience, and the float carries a speaker, not Toaster's mascot.
