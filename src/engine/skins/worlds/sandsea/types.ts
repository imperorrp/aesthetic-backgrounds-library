/**
 * Sandsea's shapes: the world the sim keeps and the painter reads.
 *
 * Space: the open sand seen from a rock ledge. A thing on the sand has an `x` (ground units
 * across, the near plane's pixels) and a distance `d` (0 at the foot of the ledge, 1 the
 * horizon); things in the air have an `alt` above the sand, in the same units. The world's
 * `yOf`, `mOf` and `xOf` put them on the picture.
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';
import type { Rng } from '../../../rng';
import type { Air } from './desert';

export type Patch = { id: number; x: number; d: number; r: number; spice: number; rich: boolean };
export type CrawlerState = 'slung' | 'working' | 'lifting' | 'lost' | 'wreck';
export type Crawler = {
  id: number; name: string; x: number; d: number; alt: number; dir: 1 | -1; state: CrawlerState; t0: number;
  /** How full the hold is, 0..1. */
  hold: number; crew: number; seed: number; line: string; lineT: number;
};
export type CarryallState = 'inbound' | 'lower' | 'standoff' | 'lift' | 'rise' | 'away' | 'off';
export type Carryall = {
  id: number; name: string; x: number; d: number; alt: number; dir: 1 | -1; state: CarryallState; t0: number;
  crawler: number; seed: number; tx: number; td: number; talt: number; line: string; lineT: number;
};
export type ThopterRole = 'spotter' | 'patrol' | 'smuggler' | 'rescue';
export type ThopterState = 'circle' | 'cross' | 'land' | 'landed' | 'takeoff' | 'falling' | 'wreck' | 'off';
export type Thopter = {
  id: number; name: string; x: number; d: number; alt: number; dir: 1 | -1; state: ThopterState; t0: number;
  role: ThopterRole; cx: number; cd: number; cr: number; phase: number; speed: number; seed: number; beat: number;
  lamp: boolean; tx: number; td: number; line: string; lineT: number;
};
export type WormState = 'sign' | 'strike' | 'surface' | 'submerge' | 'ridden' | 'gone';
export type Worm = {
  id: number; x: number; d: number; dir: 1 | -1; speed: number; state: WormState; t0: number; k: number;
  tx: number; td: number; targetKind: 'crawler' | 'thumper' | 'none'; crawler: number; size: number; riders: number; seed: number;
  /** How long it stays up, surfaced or ridden. */
  dur: number;
};
export type PartyState = 'cross' | 'crouch' | 'salvage' | 'wait' | 'meet' | 'mount';
export type Party = {
  id: number; x: number; d: number; dir: 1 | -1; speed: number; state: PartyState; t0: number; seed: number;
  tx: number; members: { dx: number; dd: number; ph: number; pack: boolean; weapon: boolean; child: boolean; seed: number }[];
  /** What it came for (a wreck's id, a thopter's id), or -1. */
  at: number; line: string; lineT: number;
};
export type Wreck = { id: number; kind: 'thopter' | 'crawler'; x: number; d: number; t0: number; smoke: number; stripped: number; seed: number };
export type Crater = { x: number; d: number; t0: number; size: number };
export type Thumper = { x: number; d: number; t0: number; until: number };
export type Devil = { x: number; d: number; t0: number; dur: number; h: number; vx: number };
export type FxKind = 'dust' | 'smoke' | 'spark' | 'fire' | 'flash' | 'spice' | 'sand' | 'glint';
export type Fx = { kind: FxKind; x: number; d: number; alt: number; vx: number; valt: number; t0: number; dur: number; r: number; color: string; seed: number };
export type Label = { text: string; x: number; y: number; t0: number; color: string };
export type Watcher = { x: number; seed: number; glass: number };

export type SandOptions = { traffic: number; camera?: string };

export type SandWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; bus: Bus; director: Director;
  name: string; air: Air; cast: string[]; castIds: string[];
  /** The time of day, 0..1 (0 midnight, 0.5 noon), and how long a day is in seconds. */
  day: number; dayLen: number;
  /** The horizon and the foot of the sand (the ledge's edge), in world y; the ledge itself. */
  HY: number; NY: number; ledge: { y: number; x0: number; x1: number; side: 1 | -1 };
  /** The sun's side: +1 the light comes from the right. */
  sunSide: 1 | -1;
  yOf(d: number): number;
  mOf(d: number): number;
  xOf(x: number, d: number): number;
  patches: Patch[]; crawlers: Crawler[]; carryalls: Carryall[]; thopters: Thopter[]; worms: Worm[]; parties: Party[];
  wrecks: Wreck[]; craters: Crater[]; thumpers: Thumper[]; devils: Devil[]; fx: Fx[]; watchers: Watcher[];
  /** The weather: the storm (0..1), where its front is (ground x) and which way it goes; static flashes; the wind; dust in the air. */
  storm: number; stormFront: number; stormDir: 1 | -1; flash: number; wind: number; dust: number;
  /** The spice blow underway, if any. */
  blow: { x: number; d: number; t0: number } | null;
  /** The old one: a colossal worm at the horizon. */
  oldOne: { x: number; t0: number; dur: number } | null;
  /** The tally: tonnes of spice brought in, crawlers lost. */
  tonnes: number; lost: number;
  /** The harvest in hand. */
  op: { phase: 'between' | 'inbound' | 'working' | 'calling' | 'lifting' | 'away'; t0: number; crawler: number; carryall: number; patch: number; alarm: number; eta: number };
  /** The camera as the painter last framed it (world units). */
  view: { x: number; y: number; zoom: number; fit: number };
  labels: Label[]; chronicle: { t: number; text: string }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

/** What the cast's systems get to work with. */
export type Ctx = {
  world: SandWorld; r: Rng;
  say(text: string, x: number, y: number, color?: string): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  speak(who: { line: string; lineT: number }, line: string): void;
  thopter(role: ThopterRole, x: number, d: number, extra?: Partial<Thopter>): Thopter;
  party(x: number, d: number, dir: 1 | -1, n: number, extra?: Partial<Party>): Party;
  worm(x: number, d: number, extra?: Partial<Worm>): Worm;
  fx(kind: FxKind, x: number, d: number, alt: number, extra?: Partial<Fx>): void;
  look(why: string, x: number, d: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
};
