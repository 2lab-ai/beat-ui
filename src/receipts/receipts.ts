/**
 * P12 — Receipts: the page says what it shows, in numbers.
 *
 * A scene exposes `window[name] = { state(), ...actions }`. A headless run (Playwright: `tools/capture.mjs`) drives
 * the actions, screenshots each scenario and saves `state()` beside it, so a claim like "the sharks charged the ball"
 * is a distance and a speed, not a boolean or a look. Say positions as coordinates: a boolean "on screen" let a broken
 * popover pass four rounds of review in another project.
 */

export type ReceiptApi<S> = { state: () => S } & Record<string, (...args: any[]) => unknown>;

/** Expose a scene's numbers and actions on `window[name]` (no-op outside a browser). */
export function exposeReceipts<S>(name: string, api: ReceiptApi<S>): void {
  if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>)[name] = api;
}

/** A frame-rate meter: call `tick(now)` every frame; `value` is frames per second over the last second. */
export class FpsMeter {
  value = 0;
  private n = 0;
  private t = -1;
  tick(now: number): void {
    if (this.t < 0) this.t = now;
    this.n++;
    if (now - this.t >= 1000) {
      this.value = (this.n * 1000) / (now - this.t);
      this.n = 0;
      this.t = now;
    }
  }
}

/** Round for a receipt (JSON stays readable and diffable). */
export const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
