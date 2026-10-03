/**
 * Sound palettes: what each kind of event sounds like in a given world, and the drone
 * under it all. A palette is plain data, so a universe (or you) can bring its own:
 *
 *   registerSoundPalette({ ...SOUND_PALETTES.void, id: 'mine', root: 82, cues: { ... } });
 *
 * Event types are the ones skins report (see `SkinEvent`): explosion, lost, raid, combat,
 * jump, capture, song, bombard, ... An event with no binding makes no sound.
 */
import type { Cue } from './synth';

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
  /** The bed under everything, or null for silence between events. */
  drone: { wave: OscillatorType; notes: number[]; level: number; cutoff: number; wobble: number } | null;
  /** Reverb tail in seconds, and how much of each cue goes into it (0..1). */
  space: number;
  wet: number;
  cues: Record<string, Binding>;
};

/** The sector map's common sounds; the other palettes start from these. */
const BASE: Record<string, Binding> = {
  explosion: { cue: { kind: 'boom', dur: 1.1, tone: 1400, sub: 0.6 }, gain: 0.45, every: 0.12 },
  lost: { cue: { kind: 'ping', note: -12, wave: 'triangle', dur: 1.1, then: -5 }, gain: 0.18, every: 1 },
  alert: { cue: { kind: 'ping', note: 19, wave: 'square', dur: 0.09, then: 14 }, gain: 0.05, every: 1.5 },
  say: { cue: { kind: 'ping', note: 24, dur: 0.07 }, gain: 0.035, every: 0.5, only: 'high' },
  raid: { cue: { kind: 'sweep', from: 420, to: 900, dur: 0.9, q: 4 }, gain: 0.1, every: 3 },
  combat: { cue: { kind: 'crackle', dur: 1.2, rate: 14, tone: 1800 }, gain: 0.1, every: 1.5 },
  jump: { cue: { kind: 'whoosh', from: 300, to: 3200, dur: 0.9 }, gain: 0.14, every: 0.8 },
  arrive: { cue: { kind: 'whoosh', from: 2600, to: 380, dur: 0.8 }, gain: 0.1, every: 1 },
  launch: { cue: { kind: 'ping', note: 7, wave: 'triangle', dur: 0.25 }, gain: 0.04, every: 1.5 },
  depart: { cue: { kind: 'ping', note: 0, wave: 'triangle', dur: 0.2 }, gain: 0.03, every: 2 },
  dock: { cue: { kind: 'thump', pitch: 90, dur: 0.3 }, gain: 0.08, every: 1.5 },
  delivery: { cue: { kind: 'ping', note: 12, dur: 0.2, then: 7 }, gain: 0.035, every: 2 },
  convoy: { cue: { kind: 'ping', note: 5, wave: 'triangle', dur: 0.3, then: 12 }, gain: 0.04, every: 3 },
  armada: { cue: { kind: 'choir', note: -12, chord: [0, 7, 12], dur: 4, vowel: 'oo' }, gain: 0.12, every: 20 },
  flare: { cue: [{ kind: 'whoosh', from: 200, to: 5000, dur: 2.8 }, { kind: 'bell', note: 24, dur: 3 }], gain: 0.14, every: 10 },
  surge: { cue: { kind: 'sweep', from: 80, to: 1200, dur: 1.6, q: 2 }, gain: 0.1, every: 8 },
  scramble: { cue: { kind: 'ping', note: 12, wave: 'square', dur: 0.08, then: 12, echoes: 2 }, gain: 0.05, every: 3 },
  distress: { cue: { kind: 'ping', note: 17, dur: 0.5, echoes: 3 }, gain: 0.07, every: 3 },
  capture: { cue: { kind: 'bell', chord: [0, 7, 12], dur: 3 }, gain: 0.14, every: 4 },
  storm: { cue: { kind: 'whoosh', from: 150, to: 600, dur: 5 }, gain: 0.16, every: 8 },
  collision: { cue: [{ kind: 'thump', pitch: 70, dur: 0.6 }, { kind: 'crackle', dur: 0.4, rate: 30, tone: 600 }], gain: 0.16, every: 0.5 },
  dispute: { cue: { kind: 'ping', note: 6, wave: 'square', dur: 0.14, then: 6 }, gain: 0.04, every: 4 },
  checkpoint: { cue: { kind: 'ping', note: 12, wave: 'triangle', dur: 0.12, then: 12 }, gain: 0.035, every: 3 },
  chase: { cue: { kind: 'sweep', from: 600, to: 1300, dur: 0.5, wave: 'square', q: 6 }, gain: 0.05, every: 3 },
  blowout: { cue: { kind: 'boom', dur: 2.6, tone: 900, sub: 1 }, gain: 0.5, every: 6 },
  shift: { cue: { kind: 'bell', note: 0, chord: [0, 4, 7], dur: 2 }, gain: 0.06, every: 20 },
};

export const SOUND_PALETTES: Record<string, SoundPalette> = {
  /** The sector map: clean, cold, a sine bed and radio blips. */
  void: {
    id: 'void',
    root: 110,
    scale: [0, 3, 5, 7, 10, 12, 15],
    drone: { wave: 'sine', notes: [-12, 7], level: 0.03, cutoff: 900, wobble: 0.2 },
    space: 2.8,
    wet: 0.3,
    cues: BASE,
  },
  /** Saltwind Reach: an industrial hum, rock on rock, dust in the wind. */
  saltwind: {
    id: 'saltwind',
    root: 98,
    scale: [0, 2, 3, 7, 9, 12],
    drone: { wave: 'sawtooth', notes: [-12, 0, 7], level: 0.018, cutoff: 320, wobble: 0.35 },
    space: 1.6,
    wet: 0.2,
    cues: {
      ...BASE,
      explosion: { cue: { kind: 'boom', dur: 1, tone: 1100, sub: 0.7 }, gain: 0.4, every: 0.12 },
      storm: { cue: [{ kind: 'whoosh', from: 120, to: 900, dur: 6 }, { kind: 'crackle', dur: 5, rate: 6, tone: 3000 }], gain: 0.2, every: 8 },
      shift: { cue: { kind: 'sweep', from: 520, to: 560, dur: 1.4, wave: 'triangle', q: 8 }, gain: 0.06, every: 20 },
    },
  },
  /** The Choir: low, dissonant, too big. Voices answer each other; things breathe. */
  choir: {
    id: 'choir',
    root: 55,
    scale: [0, 1, 6, 7, 13, 18],
    drone: { wave: 'sawtooth', notes: [0, 1, 7], level: 0.03, cutoff: 360, wobble: 0.6 },
    space: 5.5,
    wet: 0.55,
    cues: {
      ...BASE,
      explosion: { cue: { kind: 'boom', dur: 1.6, tone: 700, sub: 0.8 }, gain: 0.3, every: 0.2 },
      say: { cue: { kind: 'ping', note: 13, dur: 0.6, echoes: 2 }, gain: 0.025, every: 1, only: 'high' },
      song: { cue: { kind: 'choir', chord: [0, 7], dur: 4 }, gain: 0.11, every: 1.5 },
      cascade: { cue: { kind: 'choir', note: 12, chord: [0, 1, 6], dur: 5 }, gain: 0.13, every: 2 },
      caught: { cue: [{ kind: 'sweep', from: 320, to: 50, dur: 1.6, wave: 'sine', q: 0.5 }, { kind: 'choir', note: 0, chord: [0, 1], dur: 2.5, vowel: 'oo' }], gain: 0.13, every: 2 },
      starbirth: { cue: { kind: 'bell', note: 24, chord: [0, 7, 12, 19], ratio: 2.01, dur: 5 }, gain: 0.13, every: 6 },
      exhale: { cue: { kind: 'whoosh', from: 1200, to: 140, dur: 3 }, gain: 0.14, every: 4 },
      leviathan: { cue: { kind: 'choir', note: -12, chord: [0, 1], dur: 7, vowel: 'oo' }, gain: 0.17, every: 15 },
      echo: { cue: { kind: 'ping', note: 12, dur: 0.6, echoes: 5 }, gain: 0.05, every: 6 },
      hatch: { cue: [{ kind: 'thump', pitch: 62, dur: 0.3 }, { kind: 'thump', pitch: 55, dur: 0.4 }], gain: 0.15, every: 2 },
      eye: { cue: [{ kind: 'choir', chord: [0, 6, 13], dur: 6, vowel: 'oo' }, { kind: 'sweep', from: 90, to: 45, dur: 6, wave: 'sine', q: 0.5 }], gain: 0.12, every: 20 },
      starout: { cue: { kind: 'sweep', from: 900, to: 40, dur: 2.5, wave: 'sine', q: 1 }, gain: 0.1, every: 6 },
      eclipse: { cue: { kind: 'whoosh', from: 90, to: 40, dur: 8 }, gain: 0.25, every: 20 },
      anagram: { cue: { kind: 'ping', note: 25, dur: 0.9 }, gain: 0.025, every: 4 },
    },
  },
  /** The Long Siege: guns over the horizon, horns before an offensive, a bell for a truce. */
  siege: {
    id: 'siege',
    root: 73.4,
    scale: [0, 3, 5, 7, 8, 12],
    drone: { wave: 'triangle', notes: [-12, -5, 0], level: 0.028, cutoff: 260, wobble: 0.3 },
    space: 3.4,
    wet: 0.35,
    cues: {
      ...BASE,
      bombard: { cue: [{ kind: 'thump', pitch: 80, dur: 0.9 }, { kind: 'boom', dur: 1.8, tone: 600, sub: 0.8 }], gain: 0.28, every: 1 },
      blast: { cue: { kind: 'thump', pitch: 60, dur: 0.5 }, gain: 0.1, every: 0.15 },
      spot: { cue: { kind: 'ping', note: 24, wave: 'square', dur: 0.05, echoes: 3 }, gain: 0.035, every: 2 },
      duel: { cue: { kind: 'sweep', from: 1600, to: 200, dur: 1.2, q: 3 }, gain: 0.09, every: 10 },
      'monitor-lost': { cue: { kind: 'boom', dur: 3.5, tone: 900, sub: 1 }, gain: 0.55, every: 4 },
      shield: { cue: { kind: 'sweep', from: 1200, to: 90, dur: 1.2, wave: 'triangle', q: 2 }, gain: 0.12, every: 2 },
      offensive: { cue: { kind: 'choir', note: 0, chord: [0, 7, 12], dur: 3.5, vowel: 'oo' }, gain: 0.13, every: 10 },
      truce: { cue: { kind: 'bell', note: 12, chord: [0, 4, 7], dur: 5 }, gain: 0.12, every: 20 },
      'truce-end': { cue: { kind: 'ping', note: 0, wave: 'square', dur: 0.4, then: 0, echoes: 1 }, gain: 0.06, every: 20 },
      mines: { cue: [{ kind: 'crackle', dur: 1.6, rate: 10, tone: 300 }, { kind: 'boom', dur: 1.4, tone: 900 }], gain: 0.3, every: 2 },
      supplycut: { cue: { kind: 'sweep', from: 500, to: 200, dur: 1, wave: 'square', q: 4 }, gain: 0.06, every: 5 },
      capture: { cue: { kind: 'bell', chord: [0, 3, 7], dur: 3 }, gain: 0.14, every: 4 },
      front: { cue: { kind: 'thump', pitch: 100, dur: 0.4 }, gain: 0.05, every: 2 },
    },
  },
};

export function registerSoundPalette(p: SoundPalette): SoundPalette {
  SOUND_PALETTES[p.id] = p;
  return p;
}

/** The palette for a universe id (the sector map's own when there is no match). */
export function soundPaletteFor(id: string | undefined): SoundPalette {
  return (id && SOUND_PALETTES[id]) || SOUND_PALETTES.void;
}
