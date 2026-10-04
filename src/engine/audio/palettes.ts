/**
 * Sound palettes: what each kind of event sounds like in a given world, the drone and
 * noise bed under it all, the room it plays in, and the pulse its notes land on. A palette
 * is plain data, so a universe (or you) can bring its own:
 *
 *   registerSoundPalette({ ...SOUND_PALETTES.void, id: 'mine', root: 82, cues: { ... } });
 *
 * Event types are the ones skins report (see `SkinEvent`): explosion, raid, combat, jump,
 * capture, song, bombard, breach, torpedo, quake, ... An event with no binding makes no
 * sound. 'ambience' events (no binding needed) open the bed and brighten the drone.
 *
 * Levels are calibrated with `pnpm sound-check`, which renders every palette offline and
 * reports loudness: the beds sit far below the cues, and no cue clips the limiter.
 */
import type { Cue, NoiseColor } from './synth';

export type Binding = {
  /** One cue, or several layered. */
  cue: Cue | Cue[];
  /** Peak level before weight, nearness, and volume (0..1, keep it small). */
  gain?: number;
  /** At most one of these per this many seconds. */
  every?: number;
  /** For 'say' and 'alert': only lines at or above this priority. */
  only?: 'medium' | 'high';
};

export type SoundPalette = {
  id: string;
  /** The root note in Hz; cue notes are semitones above it. */
  root: number;
  /** Semitones that cues without a fixed note pick from. */
  scale: number[];
  /** The tonal bed: oscillator type, notes above the root, level, filter cutoff, how much it moves. */
  drone: { wave: OscillatorType; notes: number[]; level: number; cutoff: number; wobble: number } | null;
  /** A noise bed (rain, wind, a hull's hum) between `lo` and `hi` Hz. `follow`: 'ambience' events open it. */
  bed?: { noise: NoiseColor; lo: number; hi: number; level: number; follow?: boolean };
  /** Reverb tail in seconds, and how much of each cue goes into it (0..1). */
  space: number;
  wet: number;
  /** Echo time in seconds (the ping-pong delay). */
  echo?: number;
  /** Notes (pings, bells, choirs) land on multiples of this many seconds. */
  grid?: number;
  cues: Record<string, Binding>;
};

/** The sector map's common sounds; the other star-map palettes start from these. */
const BASE: Record<string, Binding> = {
  explosion: { cue: { kind: 'boom', dur: 1.1, tone: 1400, sub: 0.6 }, gain: 0.42, every: 0.12 },
  lost: { cue: { kind: 'ping', note: -12, wave: 'triangle', dur: 1.1, then: -5 }, gain: 0.16, every: 1 },
  alert: { cue: { kind: 'ping', note: 19, wave: 'square', dur: 0.09, then: 14 }, gain: 0.045, every: 1.5 },
  say: { cue: { kind: 'ping', note: 24, dur: 0.08 }, gain: 0.03, every: 0.5, only: 'high' },
  raid: { cue: { kind: 'sweep', from: 420, to: 900, dur: 0.9, q: 4 }, gain: 0.09, every: 3 },
  combat: { cue: { kind: 'crackle', dur: 1.2, rate: 14, tone: 1800 }, gain: 0.09, every: 1.5 },
  jump: { cue: { kind: 'whoosh', from: 300, to: 3200, dur: 0.9 }, gain: 0.12, every: 0.8 },
  arrive: { cue: { kind: 'whoosh', from: 2600, to: 380, dur: 0.8 }, gain: 0.09, every: 1 },
  launch: { cue: { kind: 'ping', note: 7, wave: 'triangle', dur: 0.25 }, gain: 0.035, every: 1.5 },
  depart: { cue: { kind: 'ping', note: 0, wave: 'triangle', dur: 0.2 }, gain: 0.025, every: 2 },
  dock: { cue: { kind: 'thump', pitch: 90, dur: 0.3 }, gain: 0.07, every: 1.5 },
  delivery: { cue: { kind: 'ping', note: 12, dur: 0.2, then: 7 }, gain: 0.03, every: 2 },
  convoy: { cue: { kind: 'ping', note: 5, wave: 'triangle', dur: 0.3, then: 12 }, gain: 0.035, every: 3 },
  armada: { cue: { kind: 'choir', note: -12, chord: [0, 7, 12], dur: 4, vowel: 'oo' }, gain: 0.11, every: 20 },
  flare: { cue: [{ kind: 'whoosh', from: 200, to: 5000, dur: 2.8 }, { kind: 'bell', note: 24, dur: 3 }], gain: 0.12, every: 10 },
  surge: { cue: { kind: 'sweep', from: 80, to: 1200, dur: 1.6, q: 2 }, gain: 0.09, every: 8 },
  scramble: { cue: { kind: 'ping', note: 12, wave: 'square', dur: 0.08, then: 12, echoes: 2 }, gain: 0.045, every: 3 },
  distress: { cue: { kind: 'ping', note: 17, dur: 0.5, echoes: 3 }, gain: 0.06, every: 3 },
  capture: { cue: { kind: 'bell', chord: [0, 7, 12], dur: 3 }, gain: 0.12, every: 4 },
  storm: { cue: { kind: 'whoosh', from: 150, to: 600, dur: 5 }, gain: 0.14, every: 8 },
  collision: { cue: [{ kind: 'thump', pitch: 70, dur: 0.6 }, { kind: 'crackle', dur: 0.4, rate: 30, tone: 600 }], gain: 0.14, every: 0.5 },
  dispute: { cue: { kind: 'ping', note: 6, wave: 'square', dur: 0.14, then: 6 }, gain: 0.035, every: 4 },
  checkpoint: { cue: { kind: 'ping', note: 12, wave: 'triangle', dur: 0.12, then: 12 }, gain: 0.03, every: 3 },
  chase: { cue: { kind: 'sweep', from: 600, to: 1300, dur: 0.5, wave: 'square', q: 6 }, gain: 0.045, every: 3 },
  blowout: { cue: { kind: 'boom', dur: 2.6, tone: 900, sub: 1 }, gain: 0.45, every: 6 },
  shift: { cue: { kind: 'bell', note: 0, chord: [0, 4, 7], dur: 2 }, gain: 0.05, every: 20 },
};

export const SOUND_PALETTES: Record<string, SoundPalette> = {
  /** The sector map: clean and cold, a hull's low hum, radio blips on a quiet pulse. */
  void: {
    id: 'void',
    root: 110,
    scale: [0, 3, 5, 7, 10, 12, 15],
    drone: { wave: 'sine', notes: [-12, 7], level: 0.0105, cutoff: 900, wobble: 0.2 },
    bed: { noise: 'brown', lo: 30, hi: 180, level: 0.0175, follow: true },
    space: 2.8,
    wet: 0.3,
    echo: 0.34,
    grid: 0.17,
    cues: BASE,
  },
  /** Saltwind Reach: an industrial hum, rock on rock, wind that rises with the dust. */
  saltwind: {
    id: 'saltwind',
    root: 98,
    scale: [0, 2, 3, 7, 9, 12],
    drone: { wave: 'sawtooth', notes: [-12, 0, 7], level: 0.0107, cutoff: 320, wobble: 0.35 },
    bed: { noise: 'pink', lo: 250, hi: 1400, level: 0.0201, follow: true },
    space: 1.6,
    wet: 0.2,
    echo: 0.26,
    cues: {
      ...BASE,
      explosion: { cue: { kind: 'boom', dur: 1, tone: 1100, sub: 0.7 }, gain: 0.38, every: 0.12 },
      storm: { cue: [{ kind: 'whoosh', from: 120, to: 900, dur: 6 }, { kind: 'crackle', dur: 5, rate: 6, tone: 3000 }], gain: 0.16, every: 8 },
      shift: { cue: { kind: 'sweep', from: 520, to: 560, dur: 1.4, wave: 'triangle', q: 8 }, gain: 0.05, every: 20 },
    },
  },
  /** The Choir: low, dissonant, too big. Voices answer each other in a long dark room. */
  choir: {
    id: 'choir',
    root: 55,
    scale: [0, 1, 6, 7, 13, 18],
    drone: { wave: 'sawtooth', notes: [0, 1, 7], level: 0.0104, cutoff: 360, wobble: 0.6 },
    bed: { noise: 'brown', lo: 25, hi: 120, level: 0.024 },
    space: 5.5,
    wet: 0.55,
    echo: 0.62,
    grid: 0.5,
    cues: {
      ...BASE,
      explosion: { cue: { kind: 'boom', dur: 1.6, tone: 700, sub: 0.8 }, gain: 0.28, every: 0.2 },
      say: { cue: { kind: 'ping', note: 13, dur: 0.6, echoes: 2 }, gain: 0.022, every: 1, only: 'high' },
      song: { cue: { kind: 'choir', chord: [0, 7], dur: 4 }, gain: 0.1, every: 1.5 },
      cascade: { cue: { kind: 'choir', note: 12, chord: [0, 1, 6], dur: 5, vowel: 'ee' }, gain: 0.11, every: 2 },
      caught: { cue: [{ kind: 'sweep', from: 320, to: 50, dur: 1.6, wave: 'sine', q: 0.5 }, { kind: 'choir', note: 0, chord: [0, 1], dur: 2.5, vowel: 'oo' }], gain: 0.12, every: 2 },
      starbirth: { cue: { kind: 'bell', note: 24, chord: [0, 7, 12, 19], ratio: 2.01, dur: 5 }, gain: 0.11, every: 6 },
      exhale: { cue: { kind: 'whoosh', from: 1200, to: 140, dur: 3 }, gain: 0.12, every: 4 },
      leviathan: { cue: { kind: 'choir', note: -12, chord: [0, 1], dur: 7, vowel: 'oo' }, gain: 0.16, every: 15 },
      echo: { cue: { kind: 'ping', note: 12, dur: 0.6, echoes: 4 }, gain: 0.045, every: 6 },
      hatch: { cue: [{ kind: 'thump', pitch: 62, dur: 0.3 }, { kind: 'thump', pitch: 55, dur: 0.4 }], gain: 0.13, every: 2 },
      eye: { cue: [{ kind: 'choir', chord: [0, 6, 13], dur: 6, vowel: 'oo' }, { kind: 'sweep', from: 90, to: 45, dur: 6, wave: 'sine', q: 0.5 }], gain: 0.11, every: 20 },
      starout: { cue: { kind: 'sweep', from: 900, to: 40, dur: 2.5, wave: 'sine', q: 1 }, gain: 0.09, every: 6 },
      eclipse: { cue: { kind: 'whoosh', from: 90, to: 40, dur: 8 }, gain: 0.22, every: 20 },
      anagram: { cue: { kind: 'ping', note: 25, dur: 0.9, echoes: 2 }, gain: 0.022, every: 4 },
    },
  },
  /** The Long Siege: guns beyond the horizon, horns before an offensive, a bell for a truce. */
  siege: {
    id: 'siege',
    root: 73.4,
    scale: [0, 3, 5, 7, 8, 12],
    drone: { wave: 'triangle', notes: [-12, -5, 0], level: 0.0083, cutoff: 260, wobble: 0.3 },
    bed: { noise: 'brown', lo: 28, hi: 150, level: 0.0176, follow: true },
    space: 3.4,
    wet: 0.35,
    echo: 0.4,
    cues: {
      ...BASE,
      bombard: { cue: [{ kind: 'thump', pitch: 80, dur: 0.9 }, { kind: 'boom', dur: 1.8, tone: 600, sub: 0.8 }], gain: 0.26, every: 1 },
      blast: { cue: { kind: 'thump', pitch: 60, dur: 0.5 }, gain: 0.09, every: 0.15 },
      spot: { cue: { kind: 'ping', note: 24, wave: 'square', dur: 0.05, echoes: 3 }, gain: 0.03, every: 2 },
      duel: { cue: { kind: 'sweep', from: 1600, to: 200, dur: 1.2, q: 3 }, gain: 0.08, every: 10 },
      'monitor-lost': { cue: { kind: 'boom', dur: 3.5, tone: 900, sub: 1 }, gain: 0.5, every: 4 },
      shield: { cue: { kind: 'sweep', from: 1200, to: 90, dur: 1.2, wave: 'triangle', q: 2 }, gain: 0.1, every: 2 },
      offensive: { cue: { kind: 'choir', note: 0, chord: [0, 7, 12], dur: 3.5, vowel: 'oo' }, gain: 0.12, every: 10 },
      truce: { cue: { kind: 'bell', note: 12, chord: [0, 4, 7], dur: 5 }, gain: 0.1, every: 20 },
      'truce-end': { cue: { kind: 'ping', note: 0, wave: 'square', dur: 0.4, then: 0, echoes: 1 }, gain: 0.05, every: 20 },
      mines: { cue: [{ kind: 'crackle', dur: 1.6, rate: 10, tone: 300 }, { kind: 'boom', dur: 1.4, tone: 900 }], gain: 0.28, every: 2 },
      supplycut: { cue: { kind: 'sweep', from: 500, to: 200, dur: 1, wave: 'square', q: 4 }, gain: 0.05, every: 5 },
      capture: { cue: { kind: 'bell', chord: [0, 3, 7], dur: 3 }, gain: 0.12, every: 4 },
      front: { cue: { kind: 'thump', pitch: 100, dur: 0.4 }, gain: 0.045, every: 2 },
    },
  },
  /** Hive Bloom: wet, organic, too close. Spores hiss, the purge roars, the bloom moans. */
  hive: {
    id: 'hive',
    root: 82.4,
    scale: [0, 1, 5, 7, 8, 13],
    drone: { wave: 'sawtooth', notes: [0, 7, 13], level: 0.0108, cutoff: 420, wobble: 0.7 },
    bed: { noise: 'pink', lo: 500, hi: 2200, level: 0.0072 },
    space: 2.4,
    wet: 0.4,
    echo: 0.3,
    cues: {
      ...BASE,
      bloom: { cue: { kind: 'choir', note: -12, chord: [0, 1], dur: 4, vowel: 'oo' }, gain: 0.09, every: 10 },
      spores: { cue: [{ kind: 'whoosh', from: 3000, to: 900, dur: 1.6 }, { kind: 'crackle', dur: 1.4, rate: 20, tone: 4000 }], gain: 0.07, every: 4 },
      settle: { cue: { kind: 'crackle', dur: 0.6, rate: 14, tone: 2500 }, gain: 0.035, every: 4 },
      purge: { cue: [{ kind: 'sweep', from: 300, to: 700, dur: 1, q: 3 }, { kind: 'whoosh', from: 200, to: 700, dur: 2.5 }], gain: 0.11, every: 6 },
      scourge: { cue: { kind: 'choir', note: -12, chord: [0, 7], dur: 3, vowel: 'oo' }, gain: 0.11, every: 20 },
      nodeburn: { cue: [{ kind: 'boom', dur: 3, tone: 800, sub: 1 }, { kind: 'sweep', from: 900, to: 60, dur: 2.5, wave: 'sine', q: 1 }], gain: 0.42, every: 10 },
      infested: { cue: { kind: 'choir', chord: [0, 1, 6], dur: 4, vowel: 'ee' }, gain: 0.1, every: 8 },
      evac: { cue: { kind: 'ping', note: 19, wave: 'square', dur: 0.12, then: 14, echoes: 2 }, gain: 0.045, every: 6 },
    },
  },
  /** The Last Fleet: engines humming under everything, a distress call, a bell for every birth. */
  lastfleet: {
    id: 'lastfleet',
    root: 87.3,
    scale: [0, 2, 4, 7, 9, 12],
    drone: { wave: 'triangle', notes: [-12, 0, 7], level: 0.0095, cutoff: 500, wobble: 0.25 },
    bed: { noise: 'brown', lo: 35, hi: 220, level: 0.0221 },
    space: 3,
    wet: 0.3,
    echo: 0.36,
    grid: 0.3,
    cues: {
      ...BASE,
      straggler: { cue: { kind: 'ping', note: 14, dur: 0.4, echoes: 3 }, gain: 0.06, every: 5 },
      rescue: { cue: { kind: 'bell', note: 7, chord: [0, 4, 7], dur: 2.5 }, gain: 0.07, every: 5 },
      pursuit: { cue: [{ kind: 'sweep', from: 500, to: 1000, dur: 1.2, q: 4 }, { kind: 'choir', note: -12, chord: [0, 6], dur: 3, vowel: 'oo' }], gain: 0.11, every: 20 },
      birth: { cue: { kind: 'bell', note: 24, dur: 2 }, gain: 0.035, every: 6 },
      skim: { cue: { kind: 'whoosh', from: 400, to: 1800, dur: 3 }, gain: 0.07, every: 8 },
    },
  },
  /** Cradle of Suns: a slow choral bed; ignitions ring, contact sings, supernovae roar. */
  cradle: {
    id: 'cradle',
    root: 65.4,
    scale: [0, 2, 4, 7, 9, 11, 14],
    drone: { wave: 'sine', notes: [-12, 7, 16], level: 0.0122, cutoff: 1200, wobble: 0.4 },
    bed: { noise: 'pink', lo: 2500, hi: 9000, level: 0.0022 },
    space: 6,
    wet: 0.6,
    echo: 0.56,
    grid: 0.375,
    cues: {
      collapse: { cue: { kind: 'whoosh', from: 1800, to: 120, dur: 4 }, gain: 0.12, every: 6 },
      ignite: { cue: [{ kind: 'bell', note: 12, chord: [0, 7, 16], dur: 5, ratio: 2.01 }, { kind: 'whoosh', from: 200, to: 3000, dur: 2 }], gain: 0.1, every: 4 },
      planets: { cue: { kind: 'bell', note: 19, chord: [0, 5], dur: 3 }, gain: 0.045, every: 4 },
      life: { cue: { kind: 'ping', note: 24, dur: 0.8, echoes: 2 }, gain: 0.035, every: 3 },
      civilization: { cue: { kind: 'bell', note: 12, chord: [0, 4, 7, 11], dur: 4 }, gain: 0.08, every: 5 },
      firstships: { cue: { kind: 'ping', note: 12, dur: 0.3, then: 19 }, gain: 0.045, every: 4 },
      colony: { cue: { kind: 'bell', note: 16, dur: 2 }, gain: 0.045, every: 5 },
      contact: { cue: { kind: 'choir', note: 12, chord: [0, 4, 7, 11], dur: 5, vowel: 'ah' }, gain: 0.1, every: 10 },
      supernova: { cue: [{ kind: 'boom', dur: 4.5, tone: 1200, sub: 1 }, { kind: 'whoosh', from: 4000, to: 100, dur: 5 }], gain: 0.45, every: 8 },
      silence: { cue: { kind: 'sweep', from: 700, to: 90, dur: 3, wave: 'sine', q: 1 }, gain: 0.06, every: 8 },
      era: { cue: { kind: 'bell', note: 0, chord: [0, 7, 12], dur: 6 }, gain: 0.07, every: 20 },
    },
  },
  /** Undercity: rain on everything, a low synth under it; trains, ICE, and thunder. */
  undercity: {
    id: 'undercity',
    root: 55,
    scale: [0, 3, 7, 10, 12, 15],
    drone: { wave: 'sawtooth', notes: [0, 7, 12], level: 0.0152, cutoff: 300, wobble: 0.5 },
    bed: { noise: 'pink', lo: 900, hi: 11000, level: 0.0532, follow: true },
    space: 2.2,
    wet: 0.35,
    echo: 0.428,
    grid: 0.214,
    cues: {
      train: { cue: { kind: 'whoosh', from: 300, to: 1400, dur: 3 }, gain: 0.1, every: 6 },
      jackin: { cue: { kind: 'ping', note: 24, wave: 'square', dur: 0.06, then: 31, echoes: 3 }, gain: 0.045, every: 5 },
      ice: { cue: [{ kind: 'sweep', from: 200, to: 1600, dur: 1.2, q: 6 }, { kind: 'crackle', dur: 2, rate: 24, tone: 3000 }], gain: 0.1, every: 5 },
      breach: { cue: [{ kind: 'sweep', from: 1800, to: 120, dur: 1.4, wave: 'square', q: 3 }, { kind: 'bell', note: 12, chord: [0, 3, 10], dur: 3 }], gain: 0.12, every: 5 },
      flatline: { cue: { kind: 'ping', note: 19, wave: 'sine', dur: 2.6 }, gain: 0.08, every: 5 },
      police: { cue: { kind: 'sweep', from: 650, to: 900, dur: 1.6, wave: 'triangle', q: 5 }, gain: 0.06, every: 8 },
      outage: { cue: [{ kind: 'thump', pitch: 70, dur: 1.2 }, { kind: 'sweep', from: 120, to: 40, dur: 2, wave: 'sine', q: 1 }], gain: 0.28, every: 10 },
      lightning: { cue: { kind: 'crackle', dur: 0.3, rate: 60, tone: 2000 }, gain: 0.1, every: 5 },
      thunder: { cue: { kind: 'boom', dur: 4, tone: 400, sub: 1 }, gain: 0.42, every: 5 },
    },
  },

  /** Shieldwall: war horns and drums, arrows hissing over, steel, mages' thunder, a dragon's roar. */
  shieldwall: {
    id: 'shieldwall',
    root: 65.4,
    scale: [0, 3, 5, 7, 10, 12],
    drone: { wave: 'sawtooth', notes: [-12, -5, 0], level: 0.0085, cutoff: 280, wobble: 0.3 },
    bed: { noise: 'pink', lo: 180, hi: 1300, level: 0.0165, follow: true },
    space: 3.2,
    wet: 0.32,
    echo: 0.38,
    cues: {
      say: { cue: { kind: 'ping', note: 24, dur: 0.06 }, gain: 0.018, every: 1, only: 'high' },
      horns: { cue: { kind: 'choir', note: -12, chord: [0, 7], dur: 3.5, vowel: 'oo' }, gain: 0.1, every: 8 },
      advance: { cue: [{ kind: 'thump', pitch: 70, dur: 0.5 }, { kind: 'thump', pitch: 64, dur: 0.6 }], gain: 0.12, every: 4 },
      volley: { cue: { kind: 'whoosh', from: 2600, to: 900, dur: 1.3 }, gain: 0.07, every: 1.2 },
      boulder: { cue: { kind: 'thump', pitch: 58, dur: 0.7 }, gain: 0.07, every: 2 },
      impact: { cue: { kind: 'boom', dur: 1.4, tone: 700, sub: 0.7 }, gain: 0.24, every: 0.8 },
      clash: { cue: [{ kind: 'crackle', dur: 2.4, rate: 18, tone: 2600 }, { kind: 'choir', note: -12, chord: [0, 7], dur: 2.5, vowel: 'ah' }], gain: 0.12, every: 6 },
      charge: { cue: [{ kind: 'sweep', from: 220, to: 330, dur: 1.1, wave: 'sawtooth', q: 2 }, { kind: 'crackle', dur: 2.2, rate: 9, tone: 260 }], gain: 0.08, every: 4 },
      fireball: { cue: { kind: 'whoosh', from: 300, to: 1600, dur: 1 }, gain: 0.08, every: 1.5 },
      blast: { cue: { kind: 'boom', dur: 1.6, tone: 1100, sub: 0.8 }, gain: 0.3, every: 0.8 },
      lightning: { cue: [{ kind: 'crackle', dur: 0.3, rate: 60, tone: 2400 }, { kind: 'boom', dur: 3, tone: 420, sub: 1 }], gain: 0.3, every: 2 },
      thunder: { cue: { kind: 'boom', dur: 4, tone: 380, sub: 1 }, gain: 0.32, every: 5 },
      ward: { cue: { kind: 'bell', note: 12, chord: [0, 4, 7], dur: 3 }, gain: 0.07, every: 4 },
      smite: { cue: { kind: 'bell', note: 24, chord: [0, 7, 12], dur: 2 }, gain: 0.08, every: 2 },
      raise: { cue: { kind: 'choir', chord: [0, 1, 6], dur: 4, vowel: 'ee' }, gain: 0.09, every: 8 },
      duel: { cue: { kind: 'bell', note: 0, dur: 2.5 }, gain: 0.08, every: 10 },
      duelwin: { cue: { kind: 'bell', note: 12, chord: [0, 4, 7], dur: 4 }, gain: 0.09, every: 10 },
      rally: { cue: { kind: 'sweep', from: 260, to: 390, dur: 1, wave: 'sawtooth', q: 2 }, gain: 0.06, every: 6 },
      lordfall: { cue: { kind: 'choir', note: -12, chord: [0, 3, 7], dur: 5, vowel: 'ah' }, gain: 0.12, every: 6 },
      rout: { cue: { kind: 'sweep', from: 500, to: 150, dur: 1.5, wave: 'triangle', q: 1 }, gain: 0.05, every: 4 },
      victory: { cue: [{ kind: 'bell', chord: [0, 4, 7, 12], dur: 5 }, { kind: 'choir', note: 0, chord: [0, 4, 7], dur: 5, vowel: 'ah' }], gain: 0.11, every: 20 },
      peace: { cue: { kind: 'bell', note: 12, chord: [0, 7, 12], dur: 7 }, gain: 0.1, every: 20 },
      dragon: { cue: [{ kind: 'sweep', from: 170, to: 60, dur: 3, wave: 'sawtooth', q: 1 }, { kind: 'whoosh', from: 200, to: 900, dur: 3 }], gain: 0.16, every: 10 },
      dragonfire: { cue: [{ kind: 'whoosh', from: 900, to: 3000, dur: 2 }, { kind: 'crackle', dur: 2.5, rate: 30, tone: 900 }], gain: 0.16, every: 3 },
      dragonslain: { cue: [{ kind: 'boom', dur: 5, tone: 300, sub: 1 }, { kind: 'choir', note: -12, chord: [0, 1], dur: 6, vowel: 'oo' }], gain: 0.4, every: 10 },
      dragonleaves: { cue: { kind: 'whoosh', from: 600, to: 150, dur: 3 }, gain: 0.08, every: 10 },
      newbattle: { cue: { kind: 'bell', note: 0, dur: 3 }, gain: 0.05, every: 10 },
      newwar: { cue: { kind: 'bell', note: -12, chord: [0, 7], dur: 5 }, gain: 0.07, every: 10 },
    },
  },

  // ---- the instruments: their own rooms, their own alarms ----------------------------------

  /** Sonar: the deep, the hull, a ping into the dark and what comes back. */
  sonar: {
    id: 'sonar',
    root: 61.7,
    scale: [0, 5, 7, 12],
    drone: { wave: 'sine', notes: [-12, 0], level: 0.0147, cutoff: 260, wobble: 0.2 },
    bed: { noise: 'brown', lo: 20, hi: 260, level: 0.0469 },
    space: 4.5,
    wet: 0.5,
    echo: 0.9,
    cues: {
      contact: { cue: { kind: 'ping', note: 36, dur: 0.15 }, gain: 0.025, every: 4 },
      whale: { cue: { kind: 'sweep', from: 160, to: 90, dur: 4, wave: 'sine', q: 1 }, gain: 0.05, every: 14 },
      torpedo: { cue: [{ kind: 'sweep', from: 1800, to: 2600, dur: 3, wave: 'triangle', q: 6 }, { kind: 'ping', note: 31, wave: 'square', dur: 0.1, then: 31, echoes: 3 }], gain: 0.1, every: 10 },
      turn: { cue: { kind: 'whoosh', from: 120, to: 400, dur: 3 }, gain: 0.08, every: 8 },
      decoy: { cue: { kind: 'crackle', dur: 2.5, rate: 30, tone: 1500 }, gain: 0.07, every: 8 },
      detonation: { cue: { kind: 'boom', dur: 3, tone: 500, sub: 1 }, gain: 0.32, every: 8 },
      active: { cue: { kind: 'ping', note: 48, dur: 1.1, echoes: 3 }, gain: 0.09, every: 5 },
      echo: { cue: { kind: 'ping', note: 48, dur: 0.5 }, gain: 0.035, every: 1 },
    },
  },
  /** Approach radar: a quiet room, radio squelch, the sweep's tick, alarms that mean it. */
  'atc-radar': {
    id: 'atc-radar',
    root: 220,
    scale: [0, 7, 12],
    drone: null,
    bed: { noise: 'pink', lo: 1500, hi: 6000, level: 0.036 },
    space: 0.8,
    wet: 0.12,
    cues: {
      transmit: { cue: [{ kind: 'crackle', dur: 0.12, rate: 60, tone: 2400 }, { kind: 'ping', note: 24, wave: 'square', dur: 0.04 }], gain: 0.025, every: 2.5 },
      sweep: { cue: { kind: 'thump', pitch: 900, dur: 0.05 }, gain: 0.035, every: 2 },
      landing: { cue: { kind: 'ping', note: 7, dur: 0.25, then: 0 }, gain: 0.03, every: 4 },
      departure: { cue: { kind: 'ping', note: 0, dur: 0.25, then: 7 }, gain: 0.03, every: 4 },
      hold: { cue: { kind: 'ping', note: 12, wave: 'triangle', dur: 0.2 }, gain: 0.03, every: 6 },
      goaround: { cue: { kind: 'sweep', from: 700, to: 1100, dur: 0.6, wave: 'triangle', q: 4 }, gain: 0.05, every: 6 },
      conflict: { cue: { kind: 'ping', note: 24, wave: 'square', dur: 0.12, then: 19 }, gain: 0.05, every: 2 },
      emergency: { cue: { kind: 'ping', note: 24, wave: 'square', dur: 0.18, then: 24, echoes: 1 }, gain: 0.07, every: 3 },
    },
  },
  /** Seismograph: the ground itself. Rumbles you feel more than hear. */
  seismograph: {
    id: 'seismograph',
    root: 41.2,
    scale: [0, 7, 12],
    drone: null,
    bed: { noise: 'brown', lo: 20, hi: 90, level: 0.049 },
    space: 2,
    wet: 0.25,
    cues: {
      quake: { cue: [{ kind: 'boom', dur: 5, tone: 260, sub: 1 }, { kind: 'crackle', dur: 3, rate: 12, tone: 500 }], gain: 0.4, every: 6 },
      aftershock: { cue: { kind: 'boom', dur: 2.2, tone: 220, sub: 0.8 }, gain: 0.2, every: 2 },
      blast: { cue: { kind: 'thump', pitch: 70, dur: 0.8 }, gain: 0.16, every: 4 },
      tremor: { cue: { kind: 'choir', note: 0, chord: [0, 7], dur: 6, vowel: 'oo' }, gain: 0.07, every: 10 },
      teleseism: { cue: { kind: 'boom', dur: 7, tone: 140, sub: 1 }, gain: 0.32, every: 10 },
    },
  },
  /** Abyssal scanner: pressure, glassy light, and something enormous out there. */
  abyssal: {
    id: 'abyssal',
    root: 49,
    scale: [0, 2, 7, 9, 14],
    drone: { wave: 'sine', notes: [-12, 7], level: 0.0114, cutoff: 400, wobble: 0.5 },
    bed: { noise: 'brown', lo: 20, hi: 200, level: 0.0264 },
    space: 5,
    wet: 0.55,
    echo: 0.7,
    grid: 0.45,
    cues: {
      flash: { cue: { kind: 'bell', note: 31, ratio: 3.01, dur: 2 }, gain: 0.05, every: 2 },
      hunt: { cue: { kind: 'sweep', from: 200, to: 140, dur: 2.5, wave: 'sine', q: 1 }, gain: 0.06, every: 6 },
      strike: { cue: [{ kind: 'thump', pitch: 90, dur: 0.4 }, { kind: 'crackle', dur: 0.5, rate: 40, tone: 1500 }], gain: 0.1, every: 4 },
      scatter: { cue: { kind: 'crackle', dur: 1, rate: 30, tone: 1200 }, gain: 0.06, every: 4 },
      spit: { cue: { kind: 'whoosh', from: 600, to: 2000, dur: 1.2 }, gain: 0.05, every: 4 },
      giant: { cue: { kind: 'choir', note: -12, chord: [0, 1], dur: 8, vowel: 'oo' }, gain: 0.14, every: 20 },
      vent: { cue: { kind: 'whoosh', from: 90, to: 300, dur: 5 }, gain: 0.08, every: 10 },
    },
  },
  /** Martian weather radar: thin wind, a rover's whir, the sky falling now and then. */
  'mars-radar': {
    id: 'mars-radar',
    root: 73.4,
    scale: [0, 5, 7, 10, 12],
    drone: { wave: 'triangle', notes: [-12, 7], level: 0.0118, cutoff: 500, wobble: 0.3 },
    bed: { noise: 'pink', lo: 200, hi: 1800, level: 0.0222, follow: true },
    space: 1.2,
    wet: 0.2,
    cues: {
      storm: { cue: { kind: 'whoosh', from: 150, to: 900, dur: 6 }, gain: 0.12, every: 10 },
      clear: { cue: { kind: 'ping', note: 12, dur: 0.4, then: 19 }, gain: 0.03, every: 10 },
      meteor: { cue: [{ kind: 'whoosh', from: 3000, to: 300, dur: 1.2 }, { kind: 'boom', dur: 1.8, tone: 700, sub: 0.6 }], gain: 0.26, every: 6 },
      entry: { cue: { kind: 'whoosh', from: 4000, to: 800, dur: 5 }, gain: 0.07, every: 20 },
      landing: { cue: [{ kind: 'whoosh', from: 2000, to: 200, dur: 4 }, { kind: 'thump', pitch: 60, dur: 1 }], gain: 0.16, every: 10 },
      drive: { cue: { kind: 'sweep', from: 180, to: 220, dur: 2, wave: 'triangle', q: 3 }, gain: 0.025, every: 8 },
      core: { cue: { kind: 'crackle', dur: 1.5, rate: 22, tone: 900 }, gain: 0.04, every: 6 },
      flight: { cue: { kind: 'sweep', from: 120, to: 160, dur: 3, wave: 'sawtooth', q: 2 }, gain: 0.035, every: 8 },
      pass: { cue: { kind: 'ping', note: 24, dur: 0.3, echoes: 1 }, gain: 0.025, every: 8 },
      devil: { cue: { kind: 'whoosh', from: 400, to: 1200, dur: 2.5 }, gain: 0.04, every: 6 },
    },
  },
};

export function registerSoundPalette(p: SoundPalette): SoundPalette {
  SOUND_PALETTES[p.id] = p;
  return p;
}

/** The palette for a world or skin id (the sector map's own when there is no match). */
export function soundPaletteFor(id: string | undefined): SoundPalette {
  return (id && SOUND_PALETTES[id]) || SOUND_PALETTES.void;
}
