/**
 * P11 — A drum machine and three synths in plain WebAudio, scheduled at exact times.
 *
 * Every voice takes the time it should sound (`t`, on the AudioContext clock) — the clock books it ahead. Voices are
 * built per hit from oscillators, a shared noise buffer, filters and envelopes, then let go; nothing is kept playing.
 * A compressor on the master keeps a busy drop from clipping; a generated impulse gives a small room.
 */
import { hz } from '../score/score.js';

export class Synth {
  readonly ctx: AudioContext;
  readonly out: GainNode;
  private readonly noiseBuf: AudioBuffer;
  private readonly revIn: GainNode;
  /** The pad bus (chords); `pump()` ducks it on the beat. */
  readonly pad: GainNode;

  constructor(ctx?: AudioContext) {
    const C = ctx ?? new AudioContext();
    this.ctx = C;
    const comp = C.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.out = C.createGain();
    this.out.gain.value = 0.85;
    this.out.connect(comp).connect(C.destination);
    const n = C.createBuffer(1, C.sampleRate, C.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;
    const ir = C.createBuffer(2, Math.floor(C.sampleRate * 1.6), C.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const x = ir.getChannelData(ch);
      for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length) ** 3;
    }
    const rev = C.createConvolver();
    rev.buffer = ir;
    this.revIn = C.createGain();
    this.revIn.gain.value = 0.3;
    this.revIn.connect(rev).connect(this.out);
    this.pad = C.createGain();
    this.pad.connect(this.out);
    this.pad.connect(this.revIn);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noise(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur);
    return s;
  }

  /** A sine with a falling pitch. */
  kick(t: number): void {
    const C = this.ctx;
    const o = C.createOscillator();
    const g = C.createGain();
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    this.env(g, t, 1, 0.003, 0.36);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.42);
  }

  /** Three quick noise bursts through a band-pass, into the room. */
  clap(t: number): void {
    const C = this.ctx;
    const f = C.createBiquadFilter();
    const g = C.createGain();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    for (const o of [0, 0.011, 0.023]) {
      g.gain.setValueAtTime(0.5, t + o);
      g.gain.exponentialRampToValueAtTime(0.08, t + o + 0.009);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    this.noise(t, 0.22).connect(f).connect(g);
    g.connect(this.out);
    g.connect(this.revIn);
  }

  /** High-passed noise: short (closed) or long (open). */
  hat(t: number, open = false): void {
    const C = this.ctx;
    const f = C.createBiquadFilter();
    const g = C.createGain();
    f.type = 'highpass';
    f.frequency.value = 7600;
    this.env(g, t, open ? 0.13 : 0.18, 0.002, open ? 0.24 : 0.035);
    this.noise(t, open ? 0.3 : 0.06)
      .connect(f)
      .connect(g)
      .connect(this.out);
  }

  /** Two detuned saws through a resonant low-pass whose cutoff is the code's slider. */
  bass(t: number, note: number, dur: number, cutoff: number): void {
    const C = this.ctx;
    const f = C.createBiquadFilter();
    const g = C.createGain();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(cutoff * 2.4, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff), t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const det of [-7, 7]) {
      const o = C.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(note);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    f.connect(g).connect(this.out);
  }

  /** A supersaw chord (three detuned saws per note) on the pad bus. */
  chord(t: number, notes: readonly number[], dur: number, cutoff: number): void {
    const C = this.ctx;
    const f = C.createBiquadFilter();
    const g = C.createGain();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.05);
    g.gain.setValueAtTime(0.9, t + dur - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    for (const m of notes)
      for (const det of [-14, 0, 14]) {
        const o = C.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(m);
        o.detune.value = det;
        const og = C.createGain();
        og.gain.value = 0.026;
        o.connect(og).connect(f);
        o.start(t);
        o.stop(t + dur + 0.3);
      }
    f.connect(g).connect(this.pad);
  }

  /** Duck the pad bus on a beat and let it swell back (sidechain feel). */
  pump(t: number): void {
    const g = this.pad.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.25, t);
    g.linearRampToValueAtTime(1, t + 0.24);
  }

  /** A short formant pluck — a stand-in for a chopped vocal. */
  vox(t: number, note: number): void {
    const C = this.ctx;
    const o = C.createOscillator();
    const f = C.createBiquadFilter();
    const g = C.createGain();
    o.type = 'square';
    o.frequency.value = hz(note);
    f.type = 'bandpass';
    f.frequency.value = 1150;
    f.Q.value = 2.5;
    this.env(g, t, 0.22, 0.004, 0.16);
    o.connect(f).connect(g);
    g.connect(this.out);
    g.connect(this.revIn);
    o.start(t);
    o.stop(t + 0.2);
  }
}
