/**
 * Titan Dock's shapes: the world the sim keeps and the painter reads.
 *
 * Space is canonical: the dock always stands on the left and looks out to the right, to the sea
 * and the city across the bay; a seed with the dock on the right is the same world mirrored by the
 * painter (`flip`). Inside the dock things have a world `x, y`. Out on the water a thing has an
 * `x` (world pixels across), a distance `d` (0 the foot of the dock, 1 the horizon) and an `alt`
 * above the water in near-plane units; the world's `yOf` and `mOf` put it on the picture.
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';

export type Mood = 'sodium' | 'teal' | 'violet' | 'grey';
/** Where the dock stands: across the bay from a harbour city, in a fjord under cliffs, by a refinery port, or on an island far out. */
export type Setting = 'harbour' | 'fjord' | 'refinery' | 'island';
export type Weapon = 'plasma' | 'cannon' | 'sword' | 'chain' | 'missiles' | 'fists';
export type Emblem = 'star' | 'teeth' | 'sun' | 'bird' | 'anchor' | 'skull' | 'bolt' | 'rose';
export type Build = 'heavy' | 'lean' | 'broad';
/** Where a mech is in its round: in its bay, walking, carried, in the water, fallen, gone. */
export type MechState = 'bay' | 'walkout' | 'hook' | 'carried' | 'drop' | 'fight' | 'victory' | 'pickup' | 'home' | 'walkin' | 'sinking' | 'lost' | 'building';
export type MechAct = { kind: string; t0: number; dur: number; hit: boolean; power: number };
export type Mech = {
  id: number; name: string; mark: number; build: Build; seed: number;
  /** Livery: the main colour, the second colour, the trim, the reactor's light, the visor. */
  colors: { main: string; second: string; trim: string; core: string; visor: string };
  weapons: Weapon[]; emblem: Emblem; pilots: [string, string];
  bay: number; state: MechState; t0: number;
  /** In the dock: x along the floor (feet at floorY); out: x, d, alt (feet). */
  x: number; d: number; alt: number; dir: 1 | -1;
  /** Base height at the near plane, in world pixels. */
  H: number;
  hp: number; kills: number; sorties: number;
  /** Plates torn off, by part (0 whole .. 1 stripped): head, chest, arm (front, back), legs. */
  dmg: { head: number; chest: number; armF: number; armB: number; legs: number };
  repair: number; ph: number; act: MechAct | null; tilt: number; wade: number; burn: number;
  line: string; lineT: number;
  /** For a mech under construction: 0 a bare frame .. 1 finished. */
  built: number;
};
export type MonsterKind = 'crab' | 'winged' | 'horned' | 'veined' | 'serpent';
export type MonsterState = 'rising' | 'advance' | 'fight' | 'rampage' | 'retreat' | 'dying' | 'carcass' | 'gone';
export type Monster = {
  id: number; name: string; kind: MonsterKind; cat: number; seed: number;
  colors: { hide: string; dark: string; glow: string; belly: string };
  x: number; d: number; alt: number; dir: 1 | -1; H: number; hp: number; hp0: number;
  state: MonsterState; t0: number; ph: number; act: MechAct | null; tilt: number;
  /** The carcass: how much of it is left (1 whole .. 0 stripped). */
  left: number; flying: number; second: boolean;
};
export type HeliRole = 'patrol' | 'lift' | 'deck' | 'rescue';
export type Heli = {
  id: number; name: string; role: HeliRole; x: number; d: number; alt: number; dir: 1 | -1; seed: number;
  /** Rotor speed 0..1, a searchlight, which deck pad it lives on. */
  rotor: number; lamp: boolean; pad: number; state: 'parked' | 'spinup' | 'out' | 'circle' | 'home' | 'land' | 'hold';
  t0: number; tx: number; td: number; talt: number; cx: number; cd: number; ph: number; slot: number; cable: number;
};
export type Ship = {
  id: number; kind: 'container' | 'tanker' | 'tug' | 'ferry' | 'barge' | 'trawler'; x: number; d: number; dir: 1 | -1; speed: number; len: number;
  seed: number; state: 'moored' | 'sail' | 'held' | 'thrown' | 'sunk' | 'harvest'; t0: number; tx: number; heel: number;
};
export type Building = { id: number; x: number; d: number; w: number; h: number; seed: number; kind: 'tower' | 'block' | 'spire' | 'slab' | 'crane' | 'tank' | 'stack' | 'rig' | 'house'; fall: number; t0: number; lit: number };
export type Person = {
  id: number; x: number; y: number; dir: 1 | -1; seed: number; ph: number; job: 'walk' | 'weld' | 'climb' | 'marshal' | 'watch' | 'drive';
  tx: number; ty: number; at: number; t0: number; hat: string; speed: number;
};
export type Crane = { id: number; x: number; tx: number; hook: number; thook: number; load: 'plate' | 'arm' | 'barrel' | 'core' | 'head' | 'none'; state: 'fetch' | 'carry' | 'lower' | 'idle'; t0: number; bay: number; seed: number };
export type Lift = { id: number; bay: number; side: -1 | 1; y: number; ty: number; t0: number };
export type Vehicle = { id: number; x: number; tx: number; dir: 1 | -1; kind: 'tug' | 'fork' | 'truck'; seed: number; wait: number; load: boolean };
export type FxKind = 'spark' | 'splash' | 'spray' | 'smoke' | 'fire' | 'flash' | 'blood' | 'acid' | 'plasma' | 'dust' | 'debris' | 'tracer' | 'flare' | 'firework' | 'ring' | 'steam';
/** An effect: in the dock (`d` < 0: plain world x, y) or out on the water (x, d, alt). */
export type Fx = { kind: FxKind; x: number; y: number; d: number; vx: number; vy: number; t0: number; dur: number; r: number; color: string; seed: number; tx?: number; ty?: number };
export type Label = { text: string; x: number; y: number; t0: number; color: string };
/** A title card for the moments that matter, one at a time. */
export type Caption = { text: string; sub: string; t0: number; dur: number; color: string };
/** A line on the radio, shown as a film's subtitle: who, and what they said; one at a time. */
export type Sub = { who: string; text: string; t0: number; dur: number };
/** What a fight leaves in the bay for good (or a long while): the bones of a monster, the wreck of a mech. */
export type Mark = { kind: 'bones' | 'wreck'; x: number; d: number; seed: number; t0: number; name: string; size: number; colors: { main: string; second: string; trim: string } };
export type Phase = 'quiet' | 'alarm' | 'launch' | 'fight' | 'aftermath';

export type DockOptions = { traffic: number; camera?: string };

export type DockWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; phone: boolean; bus: Bus; director: Director;
  name: string; programme: string; mood: Mood; setting: Setting; flip: boolean; cast: string[]; castIds: string[];
  /** The hour, 0..1 (0 midnight), and the length of a day in seconds. */
  day: number; dayLen: number;
  // ---- the dock, in world pixels ----
  /** The hangar: from x0 to the seaward wall at doorX; its floor, ceiling and roof. */
  x0: number; doorX: number; wallT: number; floorY: number; ceilY: number; roofY: number; apronX: number;
  /** The dock's depth as drawn: the back of it is up and to the right of its cut face by (dx, dy). Mechs stand, and
   * helicopters park, halfway back: on the floor at standY, on the roof deck at deckY. */
  dx: number; dy: number; standY: number; deckY: number;
  /** The rolling door: 0 shut .. 1 up. */
  door: number; doorTop: number;
  bays: { x: number; w: number }[]; laneX: number; pads: number[];
  // ---- the water ----
  HY: number; NY: number; yOf(d: number): number; mOf(d: number): number;
  /** The far shore: where the city's waterfront is at distance d. */
  coastX(d: number): number;
  riftX: number; bridge: boolean; bridgeD: number; bridgeX0: number; bridgeX1: number; bridgeBroken: number;
  /** Where the mechs meet them: x at distance d. */
  fightX(d: number): number;
  // ---- the people and the machines ----
  mechs: Mech[]; monsters: Monster[]; helis: Heli[]; ships: Ship[]; buildings: Building[];
  crew: Person[]; cranes: Crane[]; lifts: Lift[]; vehicles: Vehicle[]; fx: Fx[];
  /** The round: what is happening, when the next breach is due, the clock's own words. */
  phase: Phase; breachT: number; clock: number; alarm: number; evac: number; riftPulse: number; fightD: number;
  // ---- the weather ----
  rain: number; wind: number; storm: number; flash: number; bolt: { x: number; y0: number; y1: number; seed: number; t0: number } | null; fog: number; swell: number;
  fireworks: number;
  // ---- the tally ----
  kills: number; lost: number; breaches: number; doubles: number; buildingsLost: number; overloads: number;
  captions: Caption[]; subs: Sub[]; marks: Mark[];
  control: { line: string; lineT: number };
  labels: Label[]; chronicle: { t: number; text: string }[];
  view: { x: number; y: number; zoom: number; fit: number };
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};
