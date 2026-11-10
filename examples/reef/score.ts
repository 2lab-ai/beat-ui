/** The reef demo's song: its score, sections and the code each section writes (data only). */
import {
  alternation,
  arrange,
  type CodeLine,
  eighthsToPattern,
  eighthValues,
  line,
  plain,
  type Section,
  slots,
  steps16,
} from '@2lab.ai/beat-ui';

export const BPM = 140;
export const BASS = ['c#3', 'ab2', 'b2', 'ab2'];
export const CHORDS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['C#m', [61, 64, 68]],
  ['Abm', [56, 59, 63]],
  ['B', [59, 63, 66]],
  ['Abm', [56, 59, 63]],
];
/** Ab minor pentatonic from Ab4, for the vox slices. */
export const PENT = [68, 71, 73, 75, 78, 80, 83, 85, 87, 90];

export const PAT = {
  kickFour: 'x...x...x...x...',
  kickDrop: 'x...x..x..x.x...',
  clap: '....x.......x...',
  hho: '..x...x...x...x.',
  hhc8: 'x.x.x.x.x.x.x.x.',
} as const;
export const VOX = { vox1: [9, -1, 6, 2, -1, 1, 4, -1], vox2: [9, -1, -1, -1, 6, -1, 4, 2] } as const;

export interface Parts {
  kick?: keyof typeof PAT;
  clap?: boolean;
  hhc?: boolean;
  hho?: boolean;
  /** bass / chords: the low-pass slider's value */
  bass?: number;
  chords?: number;
  vox?: keyof typeof VOX;
}

export const SECTIONS: Record<string, Section<Parts>> = {
  intro: { parts: { kick: 'kickFour' } },
  groove: { parts: { kick: 'kickFour', clap: true, hho: true, bass: 900 } },
  breakdown: { label: 'breakdown', parts: { hho: true, bass: 420, chords: 1800, vox: 'vox1' } },
  drop: {
    label: 'drop',
    parts: { kick: 'kickDrop', clap: true, hhc: true, hho: true, bass: 2600, chords: 4200, vox: 'vox2' },
  },
};

/** Bars 1–2 intro, 3–4 groove, then breakdown 4 / drop 8 forever (the first drop: bar 9, 13.7 s in). */
export const sectionOf = arrange({
  intro: [
    ['intro', 2],
    ['groove', 2],
  ],
  loop: [
    ['breakdown', 4],
    ['drop', 8],
  ],
});

export const voxPattern = (p: Parts) => (p.vox ? eighthsToPattern(VOX[p.vox]) : '');

export const gridRows = (p: Parts) => [
  { label: 'bd', pattern: p.kick ? PAT[p.kick] : '' },
  { label: 'cp', pattern: p.clap ? PAT.clap : '' },
  { label: 'hh', pattern: p.hhc ? PAT.hhc8 : '' },
  { label: 'oh', pattern: p.hho ? PAT.hho : '' },
  { label: 'vx', pattern: voxPattern(p) },
];

export const LINE_IDS = ['title', 'tempo', 'scale', 'kick', 'clap', 'hhc', 'hho', 'bass', 'chords', 'vox'];
export const LAYOUT = [
  'title',
  'tempo',
  'scale',
  '|',
  'kick',
  'clap',
  'hhc',
  'hho',
  '[grid]',
  'bass',
  'chords',
  'vox',
  '[roll]',
];
const ALL16 = Array.from({ length: 16 }, (_, i) => i);

/** The code a section writes; `null` = before the beat. */
export function linesFor(sect: string | null): CodeLine[] {
  const p: Parts = sect ? SECTIONS[sect].parts : {};
  const label = sect ? SECTIONS[sect].label : undefined;
  return [
    ...(sect
      ? [
          plain('title', 'x = demo("reef_beat")'),
          plain('tempo', `setcpm(${BPM}/4)${label ? `  // ${label}` : ''}`),
          plain('scale', 'const scale = "Ab:minor"'),
        ]
      : [
          plain('title', '// listening: nothing yet'),
          plain('tempo', '// setcpm(?)  finding the beat...'),
          plain('scale', '// const scale = "?"'),
        ]),
    p.kick
      ? steps16(line('kick').t('kick: s('), PAT[p.kick], 'bd').t(')').wrap().t('.bank("RolandTR909")').build()
      : plain('kick', '// kick: s("bd").bank("RolandTR909")'),
    p.clap
      ? slots(line('clap').t('clap: s('), PAT.clap, 'cp', 4).t(').bank("RolandTR909")').wrap().t('.room(.2)').build()
      : plain('clap', '// clap: s("cp").bank("RolandTR909").room(.2)'),
    p.hhc
      ? line('hhc').t('hhc: s("').k('hh*8', { steps: ALL16, hit: true }).t('").bank("RolandTR909").gain(1)').build()
      : plain('hhc', '// hhc: s("hh").bank("RolandTR909").gain(.5)'),
    p.hho
      ? slots(line('hho').t('hho: s('), PAT.hho, 'oh', 8).t(').bank("RolandTR909")').wrap().t('.gain(.4)').build()
      : plain('hho', '// hho: s("oh").bank("RolandTR909").gain(.4)'),
    p.bass
      ? alternation(line('bass').t('bassline: note('), BASS)
          .t(').segment(8)')
          .wrap()
          .t('.s("sawtooth").lpf(')
          .slider(p.bass, 100, 4000)
          .t(')')
          .build()
      : plain('bass', '// bassline: note("~").s("sawtooth")'),
    p.chords
      ? alternation(
          line('chords').t('chords: chord('),
          CHORDS.map(([n]) => n),
        )
          .t(').voicing()')
          .wrap()
          .t('.s("supersaw").lpf(')
          .slider(p.chords, 200, 9000)
          .t(')')
          .build()
      : plain('chords', '// chords: chord("~").voicing()'),
    p.vox
      ? eighthValues(line('vox').t('vox: s("vox").slice(16, '), VOX[p.vox]).t(')').wrap().t('.clip(1)').build()
      : plain('vox', '// vox: s("vox").slice(16, "0").clip(1)'),
  ];
}
