/**
 * reef — the shark scene, assembled from @2lab.ai/beat-ui.
 * Score → BeatClock → Synth (sound) and Typewriter/CodeView, beat grid, pitch roll, Reef (picture), one audio clock.
 * Keys: Space play/pause · D drop now · Z hide code. Receipts: window.__reef.state().
 */
import {
  angDiff,
  BeatClock,
  beatGridHtml,
  CodeView,
  exposeReceipts,
  FpsMeter,
  midi,
  PitchRoll,
  r4,
  Synth,
  sectionStarts,
  seeded,
  Typewriter,
} from '@2lab.ai/beat-ui';
import { BASS, BPM, CHORDS, gridRows, LAYOUT, LINE_IDS, linesFor, PAT, PENT, SECTIONS, sectionOf, VOX } from './score';
import { Reef } from './sea';

type Ev =
  | { t: number; type: 'section'; sect: string }
  | { t: number; type: 'step'; bar: number; step: number; sect: string }
  | { t: number; type: 'kick' };

const $ = (id: string) => document.getElementById(id)!;
const rand = seeded(20261110);
const typewriter = new Typewriter(LINE_IDS);
const code = new CodeView($('code'), typewriter, LAYOUT);
const roll = new PitchRoll({ rand });
const reef = new Reef($('sea') as HTMLCanvasElement, rand);
const play = { on: false, bar: 0, step: 0, sect: 'intro' };
const fps = new FpsMeter();
let synth: Synth | null = null;
let clock: BeatClock<Ev> | null = null;
let codeHidden = false;
let firstLand: { bar: number; step: number } | null = null;
typewriter.set(linesFor(null), true);

function book(s: { t: number; bar: number; step: number }, push: (e: Ev) => void): void {
  const { t, bar, step } = s;
  const sect = sectionOf(bar);
  const p = SECTIONS[sect].parts;
  const sy = synth!;
  if (step === 0 && sectionStarts(sectionOf, bar)) push({ t, type: 'section', sect });
  push({ t, type: 'step', bar, step, sect });
  if (p.kick && PAT[p.kick][step] === 'x') {
    sy.kick(t);
    push({ t, type: 'kick' });
  }
  if (p.clap && PAT.clap[step] === 'x') sy.clap(t);
  if (p.hhc && PAT.hhc8[step] === 'x') sy.hat(t, false);
  if (p.hho && PAT.hho[step] === 'x') sy.hat(t, true);
  if (p.bass && step % 2 === 0) sy.bass(t, midi(BASS[bar % 4]), clock!.stepDur * 1.7, p.bass);
  if (p.chords && step === 0) sy.chord(t, CHORDS[bar % 4][1], clock!.barDur, p.chords);
  if (sect === 'drop' && step % 4 === 0) sy.pump(t);
  const v = p.vox ? VOX[p.vox] : null;
  if (v && step % 2 === 0 && v[step / 2] >= 0) sy.vox(t, PENT[v[step / 2] % PENT.length]);
}

function start(): void {
  if (synth) return;
  synth = new Synth();
  clock = new BeatClock<Ev>(synth.ctx, { bpm: BPM }, book);
  clock.start();
  play.on = true;
  $('start').classList.add('gone');
}
function togglePause(): void {
  if (!synth) {
    start();
    return;
  }
  if (synth.ctx.state === 'running') synth.ctx.suspend();
  else synth.ctx.resume();
}
function toggleCode(): void {
  codeHidden = !codeHidden;
  $('code').classList.toggle('hidden', codeHidden);
  reef.setCodeHidden(codeHidden);
}

function rollStep(sect: string, bar: number, step: number): void {
  const p = SECTIONS[sect].parts;
  const v = p.vox ? VOX[p.vox] : null;
  roll.step({
    bass: p.bass && step % 2 === 0 ? { note: midi(BASS[bar % 4]), strength: step % 4 === 0 ? 0.9 : 0.45 } : null,
    chord: p.chords ? CHORDS[bar % 4][1] : null,
    notes: v && step % 2 === 0 && v[step / 2] >= 0 ? [PENT[v[step / 2] % PENT.length]] : [],
  });
}

let last = performance.now();
function frame(now: number): void {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw); // physics steps at most 50 ms; the typewriter keeps real time
  last = now;
  fps.tick(now);
  if (synth && clock) {
    for (const e of clock.drain(synth.ctx.currentTime)) {
      if (e.type === 'section') {
        play.sect = e.sect;
        typewriter.set(linesFor(e.sect));
        reef.gather = e.sect === 'breakdown' ? 1 : 0;
        if (e.sect === 'drop') reef.dropNow();
      } else if (e.type === 'step') {
        play.bar = e.bar;
        play.step = e.step;
        rollStep(e.sect, e.bar, e.step);
      } else reef.kick();
    }
  }
  if (play.on && !firstLand && typewriter.line('title').typed === typewriter.line('title').target)
    firstLand = { bar: play.bar + 1, step: play.step + 1 }; // receipt: when the first line landed, on the beat
  const paused = !!synth && synth.ctx.state !== 'running';
  if (!paused) {
    typewriter.update(raw);
    reef.update(dt);
  }
  code.render(play);
  code.slot('grid').innerHTML = beatGridHtml({
    on: play.on,
    bar: play.bar,
    step: play.step,
    rows: gridRows(SECTIONS[play.sect].parts),
  });
  const chord = play.on && SECTIONS[play.sect].parts.chords ? CHORDS[play.bar % 4] : null;
  code.slot('roll').innerHTML = roll.html({
    on: play.on,
    chordName: chord?.[0] ?? null,
    chordTones: chord?.[1] ?? null,
  });
  reef.draw();
  requestAnimationFrame(frame);
}

function fitStage(): void {
  const W = Math.floor(Math.min(innerWidth, (innerHeight * 9) / 16));
  const H = Math.floor((W * 16) / 9);
  const st = $('stage');
  st.style.width = `${W}px`;
  st.style.height = `${H}px`;
  st.style.setProperty('--u', `${W / 100}px`);
  reef.resize(W, H, Math.min(2, window.devicePixelRatio || 1));
}
addEventListener('resize', fitStage);
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    togglePause();
  } else if (k === 'd') reef.dropNow();
  else if (k === 'z') toggleCode();
});
$('go').addEventListener('click', start);
fitStage();
requestAnimationFrame(frame);

exposeReceipts('__reef', {
  state: () => {
    const b = reef.ball();
    const live = reef.fish.filter((f) => f.alive);
    const codeRect = $('code').getBoundingClientRect();
    const stage = $('stage').getBoundingClientRect();
    return {
      fps: Math.round(fps.value * 10) / 10,
      playing: !!synth && synth.ctx.state === 'running',
      section: play.on ? play.sect : 'idle',
      bar: play.bar + 1,
      step: play.step + 1,
      hunger: r4(reef.drop.hunger),
      dropK: r4(reef.drop.dropK),
      codeHidden,
      float: { x: r4(reef.fl.x), y: r4(reef.fl.y) },
      ball: b && { x: r4(b.x), y: r4(b.y), n: b.n },
      fishAlive: live.length,
      fishEaten: reef.eaten,
      firstLand,
      ballSpread: r4(live.reduce((m, f) => m + Math.hypot(f.x - reef.fl.x, f.y - reef.fl.y), 0) / (live.length || 1)),
      sharks: reef.hunters.map((h) => {
        const x = h.spine.nodes[0];
        const y = h.spine.nodes[1];
        return {
          kind: ['hammerhead', 'blacktip', 'zebra'][h.id],
          snout: { x: r4(x), y: r4(y) },
          speed: r4(h.speed),
          aimOffBallDeg: b
            ? Math.round((Math.abs(angDiff(h.spine.head, Math.atan2(b.y - y, b.x - x))) * 1800) / Math.PI) / 10
            : null,
          distBall: b ? r4(Math.hypot(b.x - x, b.y - y)) : null,
          sinceDrop:
            h.atDrop == null
              ? null
              : {
                  distAtDrop: r4(h.atDrop),
                  closest: r4(h.closest),
                  speedAtDrop: r4(h.speedAtDrop),
                  topSpeed: r4(h.topSpeed),
                },
        };
      }),
      code: LINE_IDS.map((id) => typewriter.line(id).typed.replace(//g, '#')),
      codeRect: {
        x: codeRect.x - stage.x,
        y: codeRect.y - stage.y,
        w: codeRect.width,
        h: codeRect.height,
        stageW: stage.width,
        stageH: stage.height,
        opacity: getComputedStyle($('code')).opacity,
      },
    };
  },
  start,
  drop: () => reef.dropNow(),
  toggleCode,
});
