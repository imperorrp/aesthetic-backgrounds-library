/**
 * Saber Front's shapes: the world the sim keeps and the painter reads.
 *
 * Space: a battlefield seen from a ridge. A thing on the ground has an `x` (ground units across,
 * the near plane's pixels) and a distance `d` (0 at the foot of the ridge, 1 the horizon); a thing
 * in the air has an `alt` above the ground in the same units. The world's `yOf`, `mOf` and `xOf`
 * put them on the picture. The sky's own things (starfighters, capital ships) live in world pixels.
 *
 * The two armies: the Grand Army (`ga`: troopers in white armour, walkers, gunships, the knights)
 * and the Confederacy (`cf`: battle droids, rollers, spider walkers, landers). One holds the left of
 * the field and one the right; the front between them moves back and forth.
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';
import type { FieldKind, FieldStyle } from './fields';
import type { Terrain } from './terrain';

export type Side = 'ga' | 'cf';
export type SoldierKind =
  | 'trooper' | 'heavy' | 'officer' | 'commando' | 'arc' | 'jet' | 'wookiee' | 'twilek'
  | 'droid' | 'commander' | 'super' | 'bx' | 'geonosian' | 'magna';
export type SoldierState = 'march' | 'line' | 'charge' | 'retreat' | 'drop' | 'fall' | 'dead' | 'sneak';
export type Soldier = {
  id: number; side: Side; kind: SoldierKind; x: number; d: number; alt: number;
  /** How far behind the front this one stands (ground units), and the depth it keeps. */
  hx: number; hd: number;
  state: SoldierState; t0: number; cool: number; ph: number; seed: number; squad: number;
  /** Crouched in cover, 0..1. */
  crouch: number; face: 1 | -1;
  /** When it last fired (for the muzzle flash). */
  fireT: number;
  /** The cover it is fighting from (an id, or -1); a jump trooper's leap (when it began, or 0). */
  cov: number; jump: number;
};
export type Squad = { id: number; side: Side; name: string; leader: string; line: string; lineT: number; size: number };

export type WalkerKind = 'hexa' | 'spider';
export type WalkerState = 'enter' | 'walk' | 'fall' | 'wreck';
export type Walker = {
  id: number; side: Side; kind: WalkerKind; name: string; x: number; d: number; hx: number;
  state: WalkerState; t0: number; hp: number; cool: number; ph: number; seed: number; face: 1 | -1;
  /** Where the gun is laid (ground x, d) and when it last fired. */
  aimX: number; aimD: number; fireT: number; line: string; lineT: number;
  /** Slung under a carrier (alt) until it is set down. */
  alt: number;
};

export type RollerState = 'roll' | 'deploy' | 'shield' | 'dead';
export type Roller = { id: number; x: number; d: number; tx: number; state: RollerState; t0: number; hp: number; cool: number; seed: number; spin: number; shield: number; fireT: number };

export type CraftKind = 'gunship' | 'carrier' | 'lander' | 'trident';
export type CraftState = 'inbound' | 'descend' | 'drop' | 'climb' | 'strafe' | 'away' | 'falling' | 'off';
export type Craft = {
  id: number; side: Side; kind: CraftKind; name: string; x: number; d: number; alt: number; face: 1 | -1;
  tx: number; td: number; talt: number; state: CraftState; t0: number; seed: number;
  /** Troops still aboard; a walker slung under it (a carrier); how hurt it is. */
  cargo: number; walker: number; hp: number; cool: number; fireT: number; bank: number; doors: number;
  line: string; lineT: number; spin: number;
};

export type Knight = {
  id: number; side: Side; name: string; blade: string; x: number; d: number; hx: number; hd: number;
  state: 'stand' | 'lead' | 'duel' | 'withdraw' | 'away'; t0: number; ph: number; face: 1 | -1; seed: number;
  /** The blade's swing, -1..1, and when it last turned a bolt. */
  swing: number; parryT: number; robe: string; line: string; lineT: number; twin: boolean;
  /** Grievous fights with four. */
  four: boolean;
};

export type BoltKind = 'rifle' | 'cannon' | 'turret' | 'shield';
/** What a bolt was fired at: a soldier, a knight (who may turn it), a walker, a roller, a craft, or the ground. */
export type BoltAim = 'soldier' | 'knight' | 'walker' | 'roller' | 'craft' | 'vehicle' | 'facility' | 'none';
export type Bolt = {
  x0: number; d0: number; a0: number; x1: number; d1: number; a1: number; t0: number; dur: number;
  side: Side; kind: BoltKind; aim: BoltAim; target: number; hit: boolean; shooter: number;
};
export type Shell = { x0: number; d0: number; x1: number; d1: number; t0: number; dur: number; apex: number; side: Side; big: number };

export type FxKind = 'smoke' | 'fire' | 'flash' | 'spark' | 'dust' | 'debris' | 'blast' | 'scrap';
export type Fx = { kind: FxKind; x: number; d: number; alt: number; vx: number; vd: number; valt: number; t0: number; dur: number; r: number; color: string; seed: number };
export type Scorch = { x: number; d: number; r: number; t0: number };
export type Wreck = { id: number; kind: string; x: number; d: number; t0: number; seed: number; face: 1 | -1; smoke: number };

/** The ground war's machines besides the walkers: tanks, scout walkers, speeders, artillery, droid war machines. */
export type VehicleKind = 'atrt' | 'saber' | 'barc' | 'spha' | 'aat' | 'dsd' | 'mtt' | 'hailfire' | 'crab';
export type VehicleState = 'enter' | 'move' | 'deploy' | 'leave' | 'dead';
export type Vehicle = {
  id: number; side: Side; kind: VehicleKind; name: string; x: number; d: number; alt: number; hx: number; hd: number;
  state: VehicleState; t0: number; hp: number; cool: number; fireT: number; aimX: number; aimD: number; aimA: number;
  ph: number; face: 1 | -1; cargo: number; seed: number; line: string; lineT: number; doors: number;
};
/** A great beam (the SPHA-T's) from the ground into the sky or across the field, in world pixels. */
export type Beam = { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; color: string; w: number };
/** A rocket (a hailfire droid's) on its arc toward a gunship or a vehicle. */
export type Missile = { x0: number; d0: number; a0: number; x1: number; d1: number; a1: number; t0: number; dur: number; side: Side; target: number; aim: 'craft' | 'vehicle' | 'ground' };

/** The sky's things, in world pixels. A dogfight: the chased and the chaser on one looping path. */
export type Dogfight = {
  id: number; cx: number; cy: number; ax: number; ay: number; w: number; ph: number; lag: number; s: number;
  /** Which side is being chased; how it ends; when. */
  chased: Side; t0: number; life: number; state: 'fight' | 'over'; downT: number; winner: Side | null; seed: number; cool: number;
};
export type Flyby = { id: number; side: Side; kind: 'fighter' | 'bomber'; x: number; y: number; vx: number; vy: number; s: number; n: number; t0: number; seed: number };
export type SkyFall = { x: number; y: number; vx: number; vy: number; t0: number; side: Side; s: number; seed: number };
export type SkyBolt = { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; color: string; w: number };

export type CapitalKind = 'wedge' | 'frigate' | 'core';
export type Capital = {
  id: number; side: Side; kind: CapitalKind; name: string; x: number; y: number; s: number; x0: number; y0: number; s0: number;
  face: 1 | -1; seed: number; falling: number;
  /** A broadside under way (until), a descent (0..1 down and back), hits on her (flash). */
  fireUntil: number; cool: number; descent: number; descentT: number; hitT: number; drift: number;
};

export type Shield = { x: number; d: number; r: number; up: number; state: 'up' | 'down' | 'raising'; t0: number; hp: number; flick: number; /** The generator, at the dome's near edge. */ gx: number; gd: number };
export type Flare = { x: number; d: number; alt: number; t0: number; dur: number };
export type Label = { text: string; x: number; y: number; t0: number; color: string };
/** A line heard on the radio: who said it, which side, when. Shown as a film subtitle. */
export type Radio = { who: string; text: string; side: Side; t0: number };
/** A standard planted where a side took ground; a mark the field keeps. */
export type Standard = { x: number; d: number; side: Side; t0: number; seed: number };
/** The battle told in acts: build-up, clash, the climax, the aftermath; then the next engagement. */
export type ActPhase = 'buildup' | 'clash' | 'climax' | 'aftermath';
export type Act = { n: number; phase: ActPhase; t0: number; until: number; attacker: Side; climax: string; fired: boolean; winner: Side | null; title: string };

export type SaberOptions = { traffic: number; camera?: string; field?: string };

export type SaberWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; phone: boolean; bus: Bus; director: Director;
  field: FieldKind; style: FieldStyle; battle: string; hour: number; place: string;
  legion: { name: string; color: string; word: string; commander: string; jedi: string[]; men: string[]; squads: string[] };
  /** Who leads the droids here. */
  leader: string;
  cast: string[]; castIds: string[];
  /** The ground: rises, cover, the armies' works. */
  terrain: Terrain;
  vehicles: Vehicle[]; beams: Beam[]; missiles: Missile[];
  /** The horizon and the foot of the ridge, in world y. */
  HY: number; NY: number;
  yOf(d: number): number;
  mOf(d: number): number;
  xOf(x: number, d: number): number;
  /** Which way the Grand Army faces (+1: it holds the left and faces right). */
  gaDir: 1 | -1;
  /** Where the front is (ground x), and the gap of no-man's-land either side of it. */
  front: number; gap: number;
  soldiers: Soldier[]; squads: Squad[]; walkers: Walker[]; rollers: Roller[]; crafts: Craft[]; knights: Knight[];
  bolts: Bolt[]; shells: Shell[]; fx: Fx[]; scorches: Scorch[]; wrecks: Wreck[];
  dogfights: Dogfight[]; flybys: Flyby[]; skyfalls: SkyFall[]; skybolts: SkyBolt[]; capitals: Capital[];
  shield: Shield | null; flares: Flare[];
  /** Weather: rain and wind-driven dust (0..1), lightning (a flash 0..1), ground fog. */
  rain: number; dust: number; lightning: number; fog: number; wind: number;
  /** The tally. */
  fallen: { ga: number; cf: number }; downed: { walkers: number; gunships: number; fighters: number };
  /** Who has the field: -1..1 (+1 the Grand Army pushing), and what the moment is called. */
  tide: number; mood: 'stalemate' | 'push' | 'charge' | 'retreat' | 'regroup' | 'shield' | 'barrage';
  view: { x: number; y: number; zoom: number; fit: number };
  /** Headlines for the biggest moments; the radio, shown one line at a time; the battle's acts. */
  labels: Label[]; chronicle: { t: number; text: string }[]; radio: Radio[]; act: Act;
  /** Marks the field keeps: standards where ground was taken, a capital ship's wreck on the horizon. */
  standards: Standard[]; jump: { x: number; y: number; t0: number; s: number } | null; hulks: { x: number; s: number; t0: number; side: Side; seed: number; kind: CapitalKind }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};
