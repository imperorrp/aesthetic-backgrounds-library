/**
 * War Rig's shapes: the world the sim keeps and the painter reads.
 *
 * Space: the convoy's frame, side-on. The camera rides along with the rig, so a vehicle keeping
 * pace stays put on the screen and the ground runs away to the left under it. A thing has an `x`
 * (world pixels across, in the convoy's frame), a depth `z` (0 the far lane, 1 the near lane; less
 * than 0 is beyond the road, more than 1 is the near verge) and, when it is off the ground, an
 * `alt` (ground units, scaled by depth on the picture). The world's `yOf`, `mOf` and `sOf` put
 * them on the picture; anything not riding with the convoy slides back at `V · mOf(z)`.
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';
import type { Rng } from '../../../rng';

export type Grade = 'blaze' | 'crimson' | 'umber' | 'chrome';
export type Region = 'flats' | 'dunes' | 'towers' | 'canyon' | 'bog';
export type Kind = 'hotrod' | 'porcupine' | 'polecat' | 'howler' | 'crusher' | 'bike' | 'buggy' | 'ram' | 'throne' | 'drifter';
export type Clan = 'party' | 'rival' | 'ravens' | 'ally';
export type VState = 'arrive' | 'chase' | 'attack' | 'fallback' | 'leave' | 'crash' | 'flung' | 'stuck' | 'jump' | 'rim';

export type Vehicle = {
  id: number; kind: Kind; clan: Clan; name: string; seed: number;
  x: number; z: number; vx: number; tx: number; tz: number; state: VState; t0: number;
  /** Off the ground: height, climb, roll (radians) and spin. */
  alt: number; valt: number; rot: number; vrot: number;
  hp: number; maxHp: number; crew: number;
  /** How hard the engine is pushed now, 0..1 (the blower's flames). */
  boost: number;
  /** When it may next shoot, throw, or make its play. */
  gunT: number; lanceT: number; playT: number; slotT: number;
  /** A polecat's pole: its angle (0 upright, + leaning forward over the rig), where it swings to, and whether a boarder hangs on it. */
  pole: number; poleTo: number; boarder: boolean;
  /** Sinking in the bog, 0..1. */
  sink: number;
  line: string; lineT: number;
};
export type Wreck = { id: number; kind: Kind; clan: Clan; x: number; z: number; t0: number; seed: number; rot: number; burn: number };
export type Shot = { x0: number; z0: number; a0: number; x1: number; z1: number; a1: number; t0: number; dur: number; color: string; hit: boolean };
export type MissileKind = 'lance' | 'bomb' | 'shell' | 'flare';
export type Missile = { id: number; kind: MissileKind; x: number; z: number; alt: number; vx: number; vz: number; valt: number; t0: number; T: number; target: number; from: number; seed: number };
export type FxKind = 'boom' | 'fire' | 'smoke' | 'spark' | 'debris' | 'flash' | 'dust' | 'spray' | 'body' | 'wheel' | 'mud' | 'flare';
export type Fx = { kind: FxKind; x: number; z: number; alt: number; vx: number; vz: number; valt: number; t0: number; dur: number; r: number; color: string; seed: number; rot: number };
export type Bolt = { x: number; z: number; t0: number; seed: number; hit: boolean };
export type Label = { text: string; x: number; y: number; t0: number; color: string };
export type Crew = { role: 'driver' | 'gunner' | 'lancer' | 'lookout'; at: number; up: number; seed: number; t0: number; aim: number };
export type Leg = { at: number; kind: Region };
/** A scar the rig carries from here on: a scorch, a lance left stuck in the plate, a patch welded over a hole. */
export type Mark = { at: number; up: number; kind: 'scorch' | 'lance' | 'patch'; t0: number; seed: number };
/** A title card for the big moments, and a subtitle for what is shouted. */
export type Title = { head: string; sub: string; t0: number; tone: 'fire' | 'cold' | 'dust' };
export type Sub = { who: string; text: string; t0: number; clan: Clan | 'rig' };
/** The story the director is telling: the war party stalks, harries, throws everything at the rig, and falls back. */
export type Phase = 'stalk' | 'harry' | 'assault' | 'aftermath';

export type Rig = {
  name: string; driver: string; cargo: 'fuel' | 'water'; variant: 'tanker' | 'twin';
  /** Scars, kept for the rest of the run; and how many the rig's crew have put over. */
  marks: Mark[]; kills: number;
  x: number; z: number; hp: number;
  /** How full the tank is, 0..1, and the leak: its strength (0 none) and where along the tank. */
  load: number; leak: number; leakAt: number; leakT: number;
  /** Boarders on the tank now, and when each arrived. */
  boarders: { at: number; t0: number; seed: number }[];
  crew: Crew[];
  /** A knock (0..1) from a hit, for the shake; the horn. */
  knock: number; horn: number;
  line: string; lineT: number;
};

export type WarOptions = { traffic: number; camera?: string };

export type WarWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; bus: Bus; director: Director;
  grade: Grade; cast: string[]; castIds: string[];
  /** The names this seed tells its story in. */
  names: { warlord: string; party: string; home: string; bound: string; rivals: string; ravens: string; stilts: string };
  /** The time of day, 0..1 (0 midnight, 0.5 noon), and a day's length in seconds. */
  day: number; dayLen: number;
  /** The horizon; the far lane's depth below it; the road's depth (far lane to near lane), in world y. */
  HY: number; A: number; DB: number;
  /** Vehicle units to world pixels at depth 1 (before depth). */
  VS: number;
  yOf(z: number): number;
  mOf(z: number): number;
  /** World pixels per vehicle unit at depth z. */
  sOf(z: number): number;
  /** The convoy's speed over the ground (world pixels a second at depth scale 1), and the ground run so far. */
  V: number; dist: number;
  /** The road under us, and the legs of it behind (for the painter's far planes, which lag). */
  region: Region; legs: Leg[]; regionName: string;
  rig: Rig; vehicles: Vehicle[]; wrecks: Wreck[]; shots: Shot[]; missiles: Missile[]; fx: Fx[]; bolts: Bolt[];
  /** The toxic storm: how thick (0..1), its eye's x, and the lightning flash. */
  storm: number; stormX: number; flash: number;
  /** The war party fallen back (the lull) or coming on in formation. */
  lull: number; chant: number;
  /** The tally. */
  km: number; wrecked: number; repelled: number; leaks: number;
  view: { x: number; y: number; zoom: number; fit: number };
  labels: Label[]; chronicle: { t: number; text: string }[];
  titles: Title[]; subs: Sub[];
  phase: Phase; phaseT: number;
  /** The seed's layout: the convoy runs right (false) or left (true); landmarks on its horizon; how dusty its air is. */
  flip: boolean; landmarks: string[]; haze: number;
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

/** What the cast's systems get to work with. */
export type Ctx = {
  world: WarWorld; r: Rng;
  say(text: string, x: number, y: number, color?: string): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  speak(who: { line: string; lineT: number }, line: string): void;
  spawn(kind: Kind, clan: Clan, extra?: Partial<Vehicle>): Vehicle;
  fx(kind: FxKind, x: number, z: number, alt: number, extra?: Partial<Fx>): void;
  boom(x: number, z: number, alt: number, size: number, grounded: boolean): void;
  missile(kind: MissileKind, from: Vehicle | null, x: number, z: number, alt: number, tx: number, tz: number, talt: number, flight: number, target: number): void;
  crash(v: Vehicle, how: 'flip' | 'blast' | 'fling'): void;
  look(why: string, x: number, z: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
  setRegion(kind: Region): void;
  title(head: string, sub: string, tone?: Title['tone']): void;
};
