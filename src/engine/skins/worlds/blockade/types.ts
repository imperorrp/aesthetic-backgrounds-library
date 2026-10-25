/**
 * Blockade's shapes: the world the sim keeps and the painter reads.
 *
 * Space: world pixels (GW × GH), as the picture is composed. The planet is a great disc whose
 * top limb crosses the lower part of the frame (centre `cx, cy`, radius `R`); the fleet sits in
 * front of it at a depth `z` (0 the nearest, 1 the far line; past 1 is the air of the planet),
 * drawn at the scale `mOf(z)`. Points on the planet's surface are kept as latitude and longitude
 * and turn with it (`surf`).
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';
import type { Rng } from '../../../rng';
import type { FleetLook, PlanetLook, StarLook } from './design';

export type V3 = [number, number, number];

export type Side = 'fleet' | 'home' | 'merchant' | 'runner';
export type Cls = 'dreadnought' | 'cruiser' | 'carrier' | 'frigate' | 'tender' | 'corvette' | 'freighter' | 'shuttle' | 'fighter' | 'flagship' | 'platform';
export type ShipState =
  | 'station' | 'patrol' | 'transit' | 'jumpin' | 'jumpout' | 'dash' | 'chase' | 'descend' | 'ascend'
  | 'hold' | 'leave' | 'attack' | 'dying' | 'dead' | 'disabled' | 'tow' | 'launch' | 'land' | 'wing';

export type Ship = {
  id: number; name: string; cls: Cls; side: Side; seed: number;
  x: number; y: number; z: number; vx: number; vy: number;
  /** Which way the bow points (+1 right); `turn` runs 0..1 through a turn, and the bow flips halfway. */
  dir: 1 | -1; turn: number;
  state: ShipState; t0: number;
  hp: number; maxHp: number;
  /** Where it is going (world px, depth), and how fast it may go there (px/s at scale 1). */
  tx: number; ty: number; tz: number; speed: number;
  /** Station keeping: where it holds, and its drift. */
  hx: number; hy: number; phase: number;
  /** Engine thrust 0..1 (the glow), the shield's last flash, how battered it is 0..1. */
  thrust: number; shieldT: number; dmg: number;
  /** A target (ship id) and the next time its guns are ready. */
  target: number; gunT: number;
  /** A carrier's or a wing's leader; a wing's slot. */
  home: number; slot: number;
  /** What it says on the radio, and when. */
  line: string; lineT: number;
  /** For descents and climbs: the point on the planet (lat, lon) and the start of the path. */
  lat: number; lon: number; sx: number; sy: number; sz: number; dur: number;
  /** A ship of the line has a class name ("TRIBUNE-CLASS"), a job word for its tag. */
  klass: string; job: string;
  /** The event it belongs to (runner, battle, convoy), or ''. */
  tag: string;
  /** Lights: off when disabled, the blink phase. */
  dark: boolean;
};

export type BoltKind = 'laser' | 'heavy' | 'missile' | 'flak' | 'beam' | 'ion';
export type Bolt = {
  kind: BoltKind; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number;
  t0: number; dur: number; color: string; from: number; to: number; dmg: number; hit: boolean; done: boolean;
  /** For beams on the planet: where they strike (lat, lon), or NaN. */
  lat: number; lon: number;
};

export type FxKind = 'flash' | 'fire' | 'spark' | 'smoke' | 'ring' | 'muzzle' | 'jump' | 'hit' | 'weld' | 'shard' | 'scan' | 'tractor';
export type Fx = {
  kind: FxKind; x: number; y: number; z: number; vx: number; vy: number;
  t0: number; dur: number; r: number; color: string; seed: number;
  /** For streaks (jump) and beams: the far end. */
  x2: number; y2: number; rot: number;
};

/** A piece of something broken, in orbit; it falls, slowly, and burns up in the air. */
export type Debris = { x: number; y: number; z: number; vx: number; vy: number; rot: number; vr: number; size: number; seed: number; t0: number; hot: number };
export type Meteor = { x: number; y: number; vx: number; vy: number; t0: number; dur: number; size: number; seed: number };

/** A broken ship: pieces of its picture, drifting apart and turning; it falls and burns up at the last. */
export type Wreck = {
  id: number; name: string; cls: Cls; side: Side; seed: number; len: number; dir: 1 | -1;
  x: number; y: number; z: number; vx: number; vy: number; t0: number;
  /** Where it broke (0..1 along the hull), how the pieces turn and part. */
  cut: number; spin: number; part: number; fire: number;
  /** Falling into the air: 0 in orbit, 1 burning up. */
  fall: number;
};

/** A mark on the planet: a strike and the fires after it (night side), smoke by day. */
export type Scar = { lat: number; lon: number; t0: number; size: number; heat: number };

export type Moon = { name: string; x: number; y: number; r: number; seed: number; tint: string; vx: number };

export type StationKind = 'wheel' | 'ring';
export type Station = {
  kind: StationKind; name: string; x: number; y: number; z: number; seed: number;
  /** Segments planned and built; the frontier segment's progress (0..1). */
  plan: number; built: number; work: number; stage: number;
  /** Lit up when complete. */
  lit: number; t0: number;
};

export type Label = { text: string; x: number; y: number; t0: number; color: string; pri: number };
/** A line heard on the radio: who said it, and how much it matters (0 chatter, 1 traffic, 2 the story). */
export type Radio = { t: number; id: number; name: string; side: Side; cls: Cls; text: string; pri: number };
/**
 * The campaign: what drives the story. The planet's stores (0 starving, 1 full), its anger (what
 * it will dare), the fleet's resolve (what the admiral will order), the blockade's day.
 */
export type War = { stores: number; anger: number; resolve: number; day: number; stage: 'calm' | 'contacts' | 'sortie' | 'aftermath'; stageT: number };

export type BlockOptions = { traffic: number; camera?: string };

export type Planet = {
  cx: number; cy: number; R: number;
  /** The atmosphere's height, as a fraction of R. */
  atmo: number;
  /** The axis, and the two directions round it (view space, y down, z toward us). */
  A: V3; B1: V3; B2: V3;
  /** Turning (radians a second), for the ground and the clouds. */
  omega: number; cloudOmega: number;
};

export type BlockWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; phone: boolean;
  bus: Bus; director: Director;
  name: string; system: string;
  planetLook: PlanetLook; star: StarLook; fleet: FleetLook; home: FleetLook;
  cast: string[]; castIds: string[];
  planet: Planet;
  /** The limb at the frame's centre. */
  limb: number;
  /** The orbit: period, where it started, the tilt of the light's path. */
  orbitT: number; theta0: number; iota: number;
  /** The star's direction (view space), where it is in the sky, how much of it shows, and the light on the fleet. */
  L: V3; sun: { x: number; y: number; r: number; vis: number; up: boolean }; light: number;
  /** The orbital hour, 0..1 (0.25 noon: the star behind us; 0.75 midnight: the star behind the planet). */
  hour: number;
  moons: Moon[]; rings: { a: number; b: number; inner: number; outer: number; tint: string; tilt: number } | null;
  ships: Ship[]; bolts: Bolt[]; fx: Fx[]; debris: Debris[]; meteors: Meteor[]; wrecks: Wreck[]; scars: Scar[];
  station: Station;
  /** A solar flare (0..1, the light), the aurora after it; a moon's shadow crossing the planet. */
  flare: number; aurora: number; static: number;
  eclipse: { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; r: number } | null;
  /** The planet's great gun, when it fires. */
  groundGun: { lat: number; lon: number; t0: number; to: number } | null;
  /** Alarm: 0 calm, else when it sounded; what for. */
  alarm: number; alarmWhy: string;
  tally: { through: number; caught: number; killed: number; lost: number; kills: number; landed: number; inspected: number; seized: number; jumps: number };
  /** The camera as the painter last framed it (world units). */
  view: { x: number; y: number; zoom: number; fit: number };
  labels: Label[]; chronicle: { t: number; text: string }[]; radio: Radio[]; war: War;
  /** The sky behind (seeded): a galaxy's band, a nebula, a galactic core, or sparse dark. */
  backdrop: 'band' | 'nebula' | 'core' | 'sparse'; skyTint: [string, string];
  mOf(z: number): number;
  /** The planet's limb (top edge) at x, or Infinity off the disc. */
  limbY(x: number): number;
  /** An orbit lane through (x0, y0 at the centre): the y on it at x. */
  laneY(x: number, y0: number): number;
  /** A point on the planet (lat, lon) as it is now: where on the picture, and whether it faces us (z > 0). */
  surf(lat: number, lon: number): V3;
  /** The planet point under a world point, or null. */
  latLon(x: number, y: number): [number, number] | null;
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

/** What the cast's systems get to work with. */
export type Ctx = {
  world: BlockWorld; r: Rng;
  say(text: string, x: number, y: number, color?: string, pri?: number): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  speak(who: Ship, line: string, pri?: number): void;
  ship(cls: Cls, side: Side, x: number, y: number, z: number, extra?: Partial<Ship>): Ship;
  fire(from: Ship, to: Ship | null, kind: Bolt['kind'], extra?: Partial<Bolt>): Bolt | null;
  boom(s: Ship, big: boolean): void;
  fx(kind: FxKind, x: number, y: number, z: number, extra?: Partial<Fx>): void;
  look(why: string, x: number, y: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
  pick<T>(a: readonly T[]): T;
};
