/**
 * @2lab.ai/beat-ui — beat-synced live-code visuals as patterns.
 * See docs/patterns.md for what each one is for, its shape, and the mistake it exists to prevent.
 */

export { Synth } from './audio/synth';
export { BeatClock, type ClockOptions, type ClockSource, type OnStep, type StepInfo, type Timed } from './clock/clock';
export {
  activeTokens,
  alternation,
  type CodeLine,
  eighthValues,
  LineBuilder,
  line,
  plain,
  type Range,
  SLIDER,
  slots,
  steps16,
  type Token,
} from './code/code-text';
export { CodeView, type LayoutItem, type PlayHead } from './code/code-view';
export { DEFAULT_CLASSES, type RenderClasses, renderLine } from './code/render';
export {
  type KeyKind,
  type KeyResult,
  type LineState,
  nextKey,
  Typewriter,
  type TypewriterOptions,
} from './code/typewriter';
export { angDiff, clamp, esc, hash2, lerp, mix, type RGB, rgb, seeded, TAU } from './math';
export { exposeReceipts, FpsMeter, type ReceiptApi, r4 } from './receipts/receipts';
export {
  type Arrangement,
  arrange,
  eighthsToPattern,
  hz,
  isHit,
  midi,
  type Pattern,
  PITCH_CLASSES,
  type Section,
  sectionStarts,
} from './score/score';
export {
  type CellGrid,
  causticNet,
  cellGrid,
  cellOf,
  drawCaustics,
  forEachNetCell,
  glyphFont,
  makeWater,
  NET_GLYPHS,
  type NetCell,
  paintWater,
  ringCells,
  type Water,
  type WaterStyle,
} from './sea/cells';
export {
  armHunters,
  DropState,
  type Hunter,
  type HuntWorld,
  makeHunter,
  segmentDistance,
  steerHunter,
} from './sea/hunt';
export {
  SHARK_REACH,
  SHARKS,
  type SharkKind,
  sharkHalfWidth,
  sharkShape,
  sharkTile,
  type Tile,
} from './sea/species/sharks';
export {
  EDGE_SAMPLES,
  GLYPH_RAMP,
  glyphFor,
  litAt,
  makeSpine,
  moveSpine,
  PART,
  type Probe,
  probeSpine,
  rasterSpine,
  type ShapeFn,
  type Spine,
  type SpineCell,
  SUN,
  spinePoints,
  sunDot,
} from './sea/spine';
export {
  catchFish,
  type Fish,
  makeSwarm,
  type Point,
  type SwarmWorld,
  scatterSwarm,
  startleSwarm,
  swarmCenter,
  swarmSpread,
  swimSwarm,
} from './sea/swarm';
export { beatGridHtml, type GridFrame, type GridOptions, type GridRow } from './widgets/beat-grid';
export { PitchRoll, ROLL_ROWS, type RollInput, type RollOptions } from './widgets/pitch-roll';
