# AGENTS.md — how to work in 2lab-ai/beat-ui

`@2lab.ai/beat-ui` is a zero-dependency TypeScript library of patterns for beat-synced live-code visuals, with two
examples that double as its docs site (built for the base `/beat-ui/`, the same shape as 2lab-ai/ui's `/ui/`).

## Gates (run before every commit)

```
npm run check       # biome
npm run typecheck   # tsc --noEmit
npm test            # vitest (happy-dom)
npm run build:site  # lib build (dist/beat-ui.js + dist/types) + examples into site-dist/beat-ui/
```

`npm run verify` runs all four. After a change to the clock, the typewriter, the sea or the examples, also run the
receipts: `PLAYWRIGHT_FROM=<package.json with playwright> npm run receipts docs/receipts/reef`, then check S1–S6 in
`docs/receipts/reef/metrics.json` against docs/patterns.md §The reef receipts, convert the PNGs to JPG and commit them.

## Rules

- No runtime dependencies. A module is a pattern (generic) or content (`src/sea/species/`); scene code lives in
  `examples/`.
- Every pattern has a section in `docs/patterns.md`: problem, shape, API, and the mistake it prevents. A new rule learnt
  from a bug goes there with where it was found, and gets a test named after it.
- Pure logic stays testable without a browser: the clock takes any `{ currentTime }`, the typewriter and the sea take
  `dt`, randomness comes in as a function (`seeded()` in tests and receipts).
- Positions are in units of the stage's height. Draw the background every frame; never cache it in an offscreen canvas.
- The typewriter takes real elapsed time; only physics is capped at 50 ms.
- Receipts report numbers (coordinates, distances, speeds), never booleans for position.
- Escape every string that reaches HTML (`esc`).

## Commits

Conventional commits (`feat(sea): …`). End with the co-author lines used in this repo.
