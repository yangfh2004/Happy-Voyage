/**
 * The soundtrack: an original 16-bar sea shanty in D dorian, 6/8 time. Each bar
 * is six eighth notes of melody plus a chord (root, third, fifth as MIDI notes)
 * that the bass and accordion play under it.
 */
export interface ShantyBar {
  melody: [note: number | null, eighths: number][];
  chord: [number, number, number];
}

const Dm: ShantyBar['chord'] = [62, 65, 69];
const F: ShantyBar['chord'] = [65, 69, 72];
const C: ShantyBar['chord'] = [60, 64, 67];
const Am: ShantyBar['chord'] = [57, 60, 64];

const [G4, A4, C5, D5, E5, F5, G5, A5, F4] = [67, 69, 72, 74, 76, 77, 79, 81, 65];

export const SHANTY: ShantyBar[] = [
  { melody: [[A4, 2], [D5, 1], [D5, 2], [E5, 1]], chord: Dm },
  { melody: [[F5, 2], [E5, 1], [D5, 2], [C5, 1]], chord: Dm },
  { melody: [[A4, 2], [G4, 1], [F4, 2], [G4, 1]], chord: C },
  { melody: [[A4, 3], [A4, 2], [null, 1]], chord: Dm },
  { melody: [[A4, 2], [D5, 1], [D5, 2], [E5, 1]], chord: Dm },
  { melody: [[F5, 2], [G5, 1], [A5, 2], [F5, 1]], chord: F },
  { melody: [[E5, 2], [C5, 1], [A4, 2], [C5, 1]], chord: Am },
  { melody: [[D5, 5], [null, 1]], chord: Dm },
  { melody: [[F5, 2], [F5, 1], [E5, 2], [D5, 1]], chord: F },
  { melody: [[C5, 2], [A4, 1], [C5, 3]], chord: C },
  { melody: [[E5, 2], [E5, 1], [D5, 2], [C5, 1]], chord: C },
  { melody: [[A4, 2], [G4, 1], [A4, 3]], chord: Dm },
  { melody: [[F5, 2], [F5, 1], [E5, 2], [D5, 1]], chord: F },
  { melody: [[C5, 2], [D5, 1], [E5, 2], [C5, 1]], chord: C },
  { melody: [[D5, 2], [A4, 1], [C5, 2], [E5, 1]], chord: Am },
  { melody: [[D5, 5], [null, 1]], chord: Dm },
];

/** Dotted quarter ≈ 105 bpm: a lilting, rolling-deck pace. */
export const SHANTY_EIGHTH_SECONDS = 0.19;

export const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);
