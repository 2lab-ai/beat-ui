# The patterns in @2lab.ai/beat-ui

Twelve patterns pulled out of the reef mockup (a beat writes its own Strudel code while ASCII sharks hunt on the drop).
Each one exists because the mockup needed it, and most carry the mistake that taught it.

## At a glance

| # | Pattern | The problem it solves | API | The mistake it prevents |
|---|---|---|---|---|
| P1 | One clock for sound and picture | Visuals drift from the music when they count frames | `BeatClock` | A hit drawn a frame early or late; a slow tab desynchronising |
| P2 | The score is the single source of truth | Sound, code and grid disagree when each has its own copy | `arrange`, `Pattern`, `midi` | A grid that shows a hit the speakers never played |
| P3 | Code text with token ranges | Highlighting what plays by parsing the text back | `line()`, `steps16`, `slots`, `alternation`, `activeTokens` | Ranges shifting when a slider's number changes width |
| P4 | A typewriter that edits like a person | Retyping whole lines; code lagging behind the sound | `Typewriter`, `nextKey`, `renderLine`, `CodeView` | A slow frame dropping the code a whole section behind |
| P5 | The beat grid | Showing the rhythm without a chart library | `beatGridHtml` | — |
| P6 | The pitch roll | Showing harmony as texture, not as a piano roll | `PitchRoll` | Chord tones drawn as solid bars that read as noise |
| P7 | A canvas drawn in cells | A scene that keeps its look at any size, in letters | `cellGrid`, `makeWater`, `paintWater`, `drawCaustics` | A cached background canvas going blank and smearing every frame |
| P8 | A spine creature | Bodies that swim and bend instead of sliding | `makeSpine`, `moveSpine`, `probeSpine`, `rasterSpine` | A half-disc painted in front of every snout |
| P9 | A bait ball | A crowd that gathers, flees and comes back | `makeSwarm`, `swimSwarm`, `swarmCenter` | — |
| P10 | The drop, and a hunt that answers it | One moment the whole scene reacts to | `DropState`, `armHunters`, `steerHunter` | Hunters giving up before they reach a ball that already scattered |
| P11 | A drum machine in plain WebAudio | Sound with no samples and no library | `Synth` | Notes played "now" instead of at their booked time |
| P12 | Receipts | Proving the page does what the spec says | `exposeReceipts`, `tools/capture.mjs` | A boolean check passing while the picture is wrong |

The species pack (`SHARKS`, `sharkShape`, `sharkTile`) is content, not a pattern: a scene brings its own creatures the same
way.

## How the reef example is put together

```text
examples/reef
├── score.ts      P2  sections, arrangement, patterns, and linesFor(section) → CodeLine[]   (P3)
├── main.ts       P1  BeatClock books each step: Synth voices (P11) + events {section, step, kick}
│                     frame: drain due events → Typewriter.set (P4), Reef.dropNow (P10), PitchRoll.step (P6)
│                     render: CodeView (P4), beatGridHtml (P5), PitchRoll.html (P6), Reef.draw (P7–P10)
│                     receipts: window.__reef.state() (P12)
└── sea.ts        P7  paintWater → drawCaustics → rasterSpine × sharkTile (P8) → fish (P9) → float, ripples, flash
                  P10 DropState + armHunters + steerHunter; swimSwarm (P9)
```

`examples/minimal` uses only P1–P5 and P11: a two-section beat, its code typing itself, and the grid, in about 70
lines. It is the proof that the patterns stand without the reef.

## P1 — One clock for sound and picture

Problem: a visual that counts frames drifts from the music, and a frame rate that changes makes it worse.

Shape: a timer wakes every 25 ms and books every step that starts within the next 0.14 s on the audio clock. Booking a
step does two things at the same time: it schedules the sound at the step's exact time, and it pushes the events the
picture must react to into a queue with that time. Each frame drains the events whose time has come.

```ts
const clock = new BeatClock<Ev>(synth.ctx, { bpm: 140 }, ({ t, bar, step }, push) => {
  if (KICK[step] === 'x') { synth.kick(t); push({ t, type: 'kick' }); }
  push({ t, type: 'step', bar, step });
});
clock.start();
// every frame
for (const e of clock.drain(synth.ctx.currentTime)) handle(e);
```

Rules:

- push events at any time from the step's own on; the queue keeps them in time order, so `drain` can stop at the first
  event that is not due
- `start()` twice is safe: the second call stops the first timer
- create the AudioContext (`new Synth()`) in a click or key handler: before a user gesture the browser keeps it
  suspended, its clock stays at 0 and nothing is ever due
- pause by suspending the AudioContext — the clock stops with it, and nothing needs to be rescheduled
- `startAt(t0)` and `pump(now)` drive the clock without a timer, which is how the tests run it

## P2 — The score is the single source of truth

Problem: when the sound, the code text and the grid each keep their own idea of what plays, they disagree.

Shape: sections say which parts play and how; an arrangement maps a bar to a section (an intro played once, then a
loop); a 16-step pattern is a string (`'x...x...'`). The synth, the code and the grid all read the same objects.

```ts
const sectionOf = arrange({ intro: [['intro', 2], ['groove', 2]], loop: [['breakdown', 4], ['drop', 8]] });
sectionOf(8); // 'drop' — the first drop, bar 9
```

## P3 — Code text with token ranges

Problem: lighting up "what plays now" by parsing the code back is fragile.

Shape: build each line from pieces. A piece that stands for something playing is a token with its character range and
its rule for being on: a set of steps (a drum hit) or a bar alternation (`<c#3 ab2 b2 ab2>`). Highlighting becomes a
lookup. A slider's number is one placeholder character, so it can glide to a new value without retyping and the ranges
before it never shift.

```ts
const kick = steps16(line('kick').t('kick: s('), 'x...x..x..x.x...', 'bd').t(')').wrap().t('.bank("RolandTR909")').build();
activeTokens(kick.tokens, step, bar); // indices of the tokens on now
line('bass').t('.lpf(').slider(1550, 100, 4000).t(')'); // the number lives in .sliders, the text holds ''
```

## P4 — A typewriter that edits like a person

Problem: replacing a line's text outright looks like a page refresh, and typing everything again is too slow to keep up
with the music.

Shape: when a line's target changes, keep the common head and the common tail, delete back what no longer fits in the
middle, then type the new middle — one key at a time, with the caret at the edit point. Lines are edited one at a time,
top to bottom. A finished line "lands" with a short flash. A slider glides.

Rules, each learnt the hard way:

- the typewriter runs on real elapsed time (capped at 0.5 s), never on the physics step. In the mockup, sharing the
  50 ms physics cap made the code fall a whole section behind the sound once frames slowed (round R4)
- once an edit has fixed its tail, the head may not grow into it. Otherwise the tail's first character (a quote) is
  reused as new text: the line ends right, but it is not typed the way a person types (found while extracting)
- `CodeView` only rewrites a line when its signature (text, active tokens, slider values, caret, flash) changed, so the
  panel can render every frame
- `renderLine` opens every range that starts at a character before it draws the caret there. Drawing the caret first
  left a range unopened and its closing tag unmatched (found while extracting)
- ranges (tokens, underlines) belong to the target text, so they are drawn only once a line is fully typed
- when the typist moves to the next line, the caret moves to that line's edit point at once (code review, PR #2)

## P5 — The beat grid

Shape: rows × 16 steps as text, two characters per step. Hits already played this bar are solid, hits still to come are
ghosts (the pattern predicts them), the playhead is a solid column, and a footer says `bar 13 · step 7/16`.

## P6 — The pitch roll

Shape: each step pushes one column of 12 energies (one per pitch class). Energies decay; the bass and the lead add
onsets; chord tones sparkle (a 70% chance each step) rather than sit as solid bars; a little noise keeps it alive. An
energy picks a glyph from a sparse-to-dense ramp. The current chord's tones are labelled on the left.

## P7 — A canvas drawn in cells

Problem: a scene that has to keep its look at any size, drawn in letters.

Shape: every position is in units of the stage's height (x from 0 to the aspect ratio, y from 0 to 1). The stage is a
grid of square cells, 64 across; everything snaps to a cell and is drawn as a fill, a glyph, or both. The light's net on
the bottom is the edges of a slowly moving Voronoi diagram, each edge cell drawn with the glyph that follows its
direction (`- \ | /`).

Rule: paint the water and its grid directly every frame (`paintWater`). In the mockup, a cached offscreen canvas came up
blank in a headless run and every frame smeared over the last (round R4).

## P8 — A spine creature

Problem: a creature that swims and bends instead of sliding like a sprite.

Shape: a chain of points from the snout. The head moves along its heading; every later joint turns towards the one
before it by at most 0.075 rad, so the body bends smoothly and never folds into a C. To draw it, each cell asks where it
is along the body (0 at the snout, 1 at the tail tip) and across it (signed, in units of the body length). A shape
function answers which part is there — body, fin, ridge, eye or mark — and a tile shader turns that into a fill and a
glyph, lit from the upper left.

Rules:

- ahead of the snout `along` runs below 0, and past the tail above 1, so shapes see nothing there. Clamping it to 0–1
  painted a half-disc in front of every snout (round R3)
- a cell whose middle misses is still filled when two of four points near its corners hit, which keeps thin fins and
  tails from breaking up
- keep the body slim (half-width at most about 0.06 of its length) and the joints stiff, or the silhouette stops
  reading as an animal (round R2)

## P9 — A bait ball

Shape: small fish orbit a home point at their own radius (half that radius while a breakdown gathers them), flee from
any predator's head, scatter outward on a drop, and swim back in from the edge a few seconds after being caught. The
ball's centre is the centroid of the fish at home — a fish still swimming back in from the edge does not count until it
is near home, or it would drag the centre towards the edge (code review, PR #2).

## P10 — The drop, and a hunt that answers it

Shape: `DropState` holds two numbers that decay — the flash (`dropK`, about 3 s) and the hunger (about 6 s). A section
change to the drop and the D key call the same function. A hunter steers by adding weighted pulls to its heading: a slow
wander, then one goal (charge the ball, hunt the nearest fish ahead, or swim its round), then room for the others, room
around the float, and a pull back when it leaves the stage. Its turn rate is capped by its speed.

Rules:

- the charge lasts until the hunter has cut through the ball once, or until hunger falls to 0.55. A fixed 1.3 s charge
  left all three sharks short of a ball that had already scattered (round R4)
- the pass is measured along the path the snout swept during the step, not only where it ended. At 20 fps a charging
  shark moves about 0.02 a frame
- a hunter steers at where its prey will be (0.3 s ahead) but catches it only at the fish itself. Testing the catch at
  the aim point made fish vanish about 14 cells away from the shark (code review, PR #2)
- `armHunters` records where each hunter started and how close it came, which is what the receipts report

## P11 — A drum machine in plain WebAudio

Shape: every voice takes the time it should sound and builds itself from oscillators, a shared noise buffer, filters
and envelopes, then is let go. Kick (falling sine), clap (three noise bursts), hats (high-passed noise), bass (two
detuned saws through a resonant low-pass whose cutoff is the code's slider), supersaw chords on a pad bus that `pump()`
ducks on the beat, and a formant pluck standing in for a vocal. A compressor keeps a busy drop from clipping.

## P12 — Receipts

Problem: "it works" from a screenshot or from a boolean is not proof.

Shape: the page exposes `window.__reef = { state(), …actions }`. `tools/capture.mjs` serves the built site, drives the
scenarios headless, screenshots each one and saves `state()` beside it — positions as coordinates, behaviour as distances
and speeds. A claim such as "the sharks charged the ball" becomes "closest pass 0.032, 0.029, 0.019; speed ×8.1, ×6.7,
×6.7".

Rules:

- report coordinates, not "on screen: true". A boolean let a broken popover pass four rounds of review elsewhere
- run headless captures at device scale 1: the browser rasterises in software and a heavy scene slows down
- frame rates on a loaded machine are noise. The reef receipts were taken at a load average of 56 to 63, with 4 to 26 fps

## The reef receipts

The library-built reef passes the mockup's six scenarios (`docs/receipts/reef/metrics.json`, page errors 0):

- S1 first screen: 540 × 960 stage, 3 sharks, `// listening: nothing yet`
- S2 the first line lands in bar 1
- S3 breakdown: the bait ball pulls in by 23% (bar 7) and 38% (bar 8) against the groove
- S4 drop: flash 0.78, speed ×6.6 to ×7.1, two of three sharks cut through the ball (passes at 0.039), the ball scatters ×3.55
- S5 D key: flash 0 → 0.74, all three sharks cut through the ball
- S6 Z key: the code fades out and the float moves to (0.28, 0.56)
- minimal: the code types to `// groove`, the playhead moves, bar 4 after 6.5 s

A pass is recorded the moment the swept path comes within 0.04 of the ball — the hunter then stops charging and hunts —
so "closest" in the receipts reads just under 0.04 for every shark that cut through.

`docs/receipts/reef/parity-mockup-vs-kit.jpg` puts the mockup's receipts beside the library's for the same scenarios.

S4 is the least stable scenario. One run on the loaded machine, before the pass was measured along the swept path, got 1
of 3 sharks through the ball; the four runs since got 3, 3, 3 and 2 of 3. Measuring the swept path can move a reading by only about 0.01,
so part of that difference is chance: re-measure S4 first when the hunt changes.
