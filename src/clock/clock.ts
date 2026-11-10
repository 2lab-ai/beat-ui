/**
 * P1 — One clock for sound and picture.
 *
 * Sound is scheduled ahead on the audio clock (a timer wakes every `interval` ms and books every step that starts
 * within `lookahead` seconds). Everything the picture must react to is pushed into a queue with the same time, and
 * the frame loop drains what is due (`t <= now`). The screen therefore shows a hit on the step it sounds, whatever
 * the frame rate — never earlier (it was booked ahead) and never by frame count.
 */

/** Anything with an audio-style clock in seconds. `AudioContext` fits; tests pass a fake. */
export interface ClockSource {
  readonly currentTime: number;
}

export interface StepInfo {
  /** The step's index since start (0, 1, 2 …). */
  n: number;
  /** When it sounds, on the source clock. */
  t: number;
  /** Bar index from 0. */
  bar: number;
  /** Step within the bar, 0 … stepsPerBar − 1. */
  step: number;
}

export interface ClockOptions {
  bpm: number;
  /** Steps per bar (16 = sixteenth notes in 4/4). */
  stepsPerBar?: number;
  /** Steps per beat (4 = sixteenth notes). */
  stepsPerBeat?: number;
  /** How far ahead to book, in seconds. */
  lookahead?: number;
  /** How often the booking timer runs, in ms. */
  interval?: number;
  /** The first step starts this long after `start()`, in seconds, so it is never booked in the past. */
  startDelay?: number;
}

export interface Timed {
  t: number;
}

export type OnStep<E extends Timed> = (step: StepInfo, push: (event: E) => void) => void;

export class BeatClock<E extends Timed> {
  readonly stepDur: number;
  readonly barDur: number;
  readonly stepsPerBar: number;
  private readonly lookahead: number;
  private readonly interval: number;
  private readonly startDelay: number;
  private queue: E[] = [];
  private t0 = 0;
  private n = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly source: ClockSource,
    opts: ClockOptions,
    private readonly onStep: OnStep<E>,
  ) {
    this.stepsPerBar = opts.stepsPerBar ?? 16;
    this.stepDur = 60 / opts.bpm / (opts.stepsPerBeat ?? 4);
    this.barDur = this.stepDur * this.stepsPerBar;
    this.lookahead = opts.lookahead ?? 0.14;
    this.interval = opts.interval ?? 25;
    this.startDelay = opts.startDelay ?? 0.12;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /** Steps booked so far. */
  get booked(): number {
    return this.n;
  }

  /** The time step `n` sounds at (valid after `start` / `startAt`). */
  timeOf(n: number): number {
    return this.t0 + n * this.stepDur;
  }

  /** Start booking now (+ `startDelay`), with a timer. */
  start(): void {
    this.stop(); // a second start() must not leave the first timer booking steps
    this.startAt(this.source.currentTime + this.startDelay);
    this.timer = setInterval(() => this.pump(), this.interval);
  }

  /** Set the first step's time without a timer — for tests, offline renders, or a host that calls `pump()` itself. */
  startAt(t0: number): void {
    this.t0 = t0;
    this.n = 0;
    this.queue = [];
    this.pump();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Book every step that starts before `now + lookahead`. Safe to call any time; books each step once. */
  pump(now = this.source.currentTime): void {
    // kept in time order whatever order steps push in, so drain() can stop at the first event not yet due
    const push = (e: E) => {
      let i = this.queue.length;
      while (i > 0 && this.queue[i - 1].t > e.t) i--;
      this.queue.splice(i, 0, e);
    };
    while (this.timeOf(this.n) < now + this.lookahead) {
      const n = this.n;
      this.n++;
      this.onStep({ n, t: this.timeOf(n), bar: Math.floor(n / this.stepsPerBar), step: n % this.stepsPerBar }, push);
    }
  }

  /** The events now due (`t <= now`), in time order (booking order among equal times), removed from the queue. */
  drain(now = this.source.currentTime): E[] {
    let i = 0;
    while (i < this.queue.length && this.queue[i].t <= now) i++;
    return i ? this.queue.splice(0, i) : [];
  }

  /** Events booked but not yet due. */
  get pending(): number {
    return this.queue.length;
  }
}
