import { describe, expect, it } from 'vitest';
import { BeatClock, type StepInfo } from './clock.js';

const fake = () => ({ currentTime: 0 });

describe('BeatClock', () => {
  it('books only the steps that start within the lookahead, each once', () => {
    const src = fake();
    const seen: StepInfo[] = [];
    const clock = new BeatClock(src, { bpm: 140, lookahead: 0.14 }, (s) => seen.push(s));
    clock.startAt(0);
    // a step is 60/140/4 = 0.107 s: t=0 and t=0.107 start before 0.14
    expect(seen.map((s) => s.n)).toEqual([0, 1]);
    clock.pump();
    expect(seen.length).toBe(2);
    src.currentTime = 1;
    clock.pump();
    expect(seen.at(-1)!.t).toBeLessThan(1.14);
    expect(new Set(seen.map((s) => s.n)).size).toBe(seen.length);
  });

  it('numbers bars and steps from the step index', () => {
    const src = fake();
    const seen: StepInfo[] = [];
    const clock = new BeatClock(src, { bpm: 120 }, (s) => seen.push(s));
    clock.startAt(0);
    src.currentTime = clock.barDur * 2;
    clock.pump();
    const s16 = seen.find((s) => s.n === 16)!;
    expect([s16.bar, s16.step]).toEqual([1, 0]);
    expect(clock.timeOf(16)).toBeCloseTo(clock.barDur, 9);
    expect(clock.barDur).toBeCloseTo(2, 9); // 4 beats at 120 bpm
  });

  it('drains what is due, in order, and keeps the rest', () => {
    const src = fake();
    const clock = new BeatClock<{ t: number; n: number }>(src, { bpm: 140, lookahead: 0.5 }, (s, push) =>
      push({ t: s.t, n: s.n }),
    );
    clock.startAt(0);
    expect(clock.pending).toBeGreaterThan(2);
    const due = clock.drain(0.2);
    expect(due.map((e) => e.n)).toEqual([0, 1]);
    expect(clock.drain(0.2)).toEqual([]);
    expect(clock.drain(0.3)[0].n).toBe(2);
  });
});

describe('BeatClock (code review, PR #2)', () => {
  it('keeps one timer when start() is called twice', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers();
    const src = { currentTime: 0 };
    let booked = 0;
    const clock = new BeatClock(src, { bpm: 140 }, () => booked++);
    clock.start();
    clock.start();
    clock.stop();
    const before = booked;
    src.currentTime = 10;
    vi.advanceTimersByTime(1000);
    expect(booked).toBe(before);
    vi.useRealTimers();
  });

  it('drains an event that is due even when a later step pushed an earlier time', () => {
    const src = { currentTime: 0 };
    const clock = new BeatClock<{ t: number; id: string }>(src, { bpm: 140, lookahead: 0.3 }, (s, push) => {
      if (s.n === 0) push({ t: s.t + 0.2, id: 'late' });
      if (s.n === 1) push({ t: s.t, id: 'step1' });
    });
    clock.startAt(0);
    expect(clock.drain(0.15).map((e) => e.id)).toEqual(['step1']);
    expect(clock.drain(0.25).map((e) => e.id)).toEqual(['late']);
  });
});
