/**
 * The Walking Castle's shapes: the world the sim keeps and the painters read (the scene, and the map).
 *
 * Space: world pixels, GW × GH. The castle stays near the middle and the land moves under it: `X`
 * is how far it has walked (near-plane units). Things that belong to a plane of depth scroll with
 * it at its rate `s`; each step they move by −dir·speed·s·dt. Things on the near plane stand at a
 * depth `dz` below its crest (0 on the crest, where the castle's feet are; more is nearer to us).
 * Marks left on the land (ruins, wrecks, tar, puddles, burnt trees) keep their plane coordinate
 * `L`, so they stay where they were made and pass behind as the castle walks on.
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';
import type { Rng } from '../../../rng';
import type { Design } from './design';
import type { Land, Region, Segment } from './land';

export type Foot = { L: number; L0: number; lift: number; planted: boolean };
export type DoorState = 'shut' | 'turning' | 'open' | 'closing';
export type Place = { col: string; label: string; kind: 'port' | 'royal' | 'war' | 'flowers'; name: string };
export type Castle = {
  name: string; wizard: string;
  /** The belly, in world units; its scale (castle units to world), and the way it walks. */
  x: number; y: number; cs: number; dir: 1 | -1;
  tilt: number; bob: number;
  /** The gait: 0..1 through one stride of both legs; the speed now, and the speed it wants (a factor of its pace). */
  phase: number; speed: number; want: number; pace: number;
  feet: Foot[];
  steps: number; miles: number;
  door: { state: DoorState; t0: number; place: number; dial: number; open: number; next: number; who: number };
  /** The fire flaring (0..1), and the smoke it is putting out (to hide in). */
  flare: number; belch: number;
  stopped: boolean; stopUntil: number; why: string;
  /** A limp after the tar men (0..1), and whether the washing is out. */
  limp: number; washing: boolean;
  /** What the road has done to it: scorch from the gunboats, patches over the scorch, tar on a leg, flowers in the window boxes, bunting from a market. */
  marks: { scorch: number; patches: number; tar: number; flowers: number; bunting: number; soot: number };
  line: string; lineT: number;
};
export type Member = { id: number; name: string; role: 'wizard' | 'apprentice' | 'keeper' | 'spirit'; where: 'in' | 'out' | 'balcony' | 'deck' | 'head'; spot: number; act: string; t0: number; line: string; lineT: number; seed: number; hair: string; coat: string; accent: string };
/** Another walking house met on the road: on one of the middle ridges, walking the other way. */
export type Neighbour = { id: number; kind: 'keep' | 'mill' | 'cottage' | 'tent'; name: string; L: number; k: number; v: number; t0: number; seed: number; whistled: boolean };
export type Sheep = { id: number; x: number; dz: number; plane: 'near' | 'mid'; dir: 1 | -1; ph: number; state: 'graze' | 'walk' | 'flee'; t0: number; seed: number; black: boolean; lamb: boolean; vx: number };
export type Bird = { x: number; y: number; ph: number; dx: number; dy: number };
export type Flock = { id: number; kind: 'rooks' | 'geese' | 'swallows' | 'gulls' | 'starlings'; x: number; y: number; vx: number; vy: number; s: number; m: number; birds: Bird[]; t0: number; seed: number };
export type ShipKind = 'bomber' | 'gunboat';
export type Ship = {
  id: number; kind: ShipKind; side: 0 | 1; name: string; x: number; y: number; s: number; m: number; vx: number; vy: number; dir: 1 | -1;
  state: 'pass' | 'bomb' | 'look' | 'fight' | 'fall' | 'leave'; t0: number; seed: number; beat: number; hp: number;
  /** The far town it is bombing (far-plane coordinate), or NaN; the ship it is after, or -1. */
  target: number; foe: number; dropped: number; fired: number;
};
export type TarMan = { id: number; x: number; dz: number; ph: number; state: 'rise' | 'chase' | 'cling' | 'melt'; t0: number; seed: number; size: number; vx: number };
export type FxKind = 'smoke' | 'steam' | 'dust' | 'spark' | 'petal' | 'flash' | 'fire' | 'bomb' | 'firefly' | 'splash' | 'ring' | 'leaf' | 'tracer' | 'flak';
export type Fx = { kind: FxKind; x: number; y: number; vx: number; vy: number; s: number; t0: number; dur: number; r: number; color: string; seed: number; grow: number };
/** A mark on a plane: where (plane coordinate), since when, until when, and how much (0..1). */
export type Mark = { L: number; t0: number; until: number; k: number; seed: number; name?: string; dz?: number };
export type Walker = { id: number; x: number; dz: number; dir: 1 | -1; ph: number; kind: 'cart' | 'walker' | 'child' | 'goat'; seed: number };
export type Star = { x: number; y: number; vx: number; vy: number; t0: number; dur: number; fall: boolean };
export type Card = { title: string; sub: string; t0: number };
export type Sub = { who: string; line: string; t0: number; dur: number };
export type Gust = { x: number; t0: number; k: number };
export type Arc = { id: string; phase: 'build' | 'peak' | 'after'; t0: number };

export type CastleOptions = { pace: number; camera?: string };

export type CastleWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; phone: boolean; bus: Bus; director: Director;
  land: Land; design: Design; castle: Castle; places: Place[]; household: Member[];
  cast: string[]; castIds: string[];
  /** The seed's country: where it is (its homeland), its season, its weather's temper; the sun's side (+1 the light from the right). */
  homeland: string; season: 'spring' | 'summer' | 'late' | 'autumn'; temper: number; sunSide: 1 | -1;
  /** The day, 0..1 (0 midnight, 0.5 noon), its length in seconds, and how many have passed. */
  day: number; dayLen: number; days: number;
  /** How far the castle has walked, in near-plane units; and the region it is in now. */
  X: number; region: Region; seg: Segment | null;
  sheep: Sheep[]; flocks: Flock[]; ships: Ship[]; tar: TarMan[]; fx: Fx[]; stars: Star[]; gusts: Gust[]; walkers: Walker[]; neighbours: Neighbour[];
  /** Marks on the land: towns burning and burnt (far plane), wrecks and struck trees (mid plane), tar and puddles (near plane). */
  burning: Mark[]; ruins: Mark[]; wrecks: Mark[]; struck: Mark[]; stains: Mark[]; puddles: Mark[];
  /** The stories under way (build-up, climax, aftermath), for the painters' moods. */
  arcs: Arc[];
  /** The weather: rain (0..1), the storm's dark (0..1), lightning, the rainbow (0..1), the wind (world units/s, + toward +x), wet after rain, mist, guns beyond the hills. */
  rain: number; storm: number; flash: number; bolt: { x: number; y: number; t0: number; seed: number } | null; rainbow: number; wind: number; wet: number; mist: number; guns: number;
  /** How far the air has carried the clouds (world units), for the painter. */
  drift: number;
  /** The flower season (0..1): petals on the wind, the meadows in bloom. */
  bloom: number;
  /** Another walking house on the far hills (far-plane coordinate), legendary. */
  hen: { L: number; t0: number; dur: number } | null;
  /** The market in the town passed, when there is one. */
  market: { seg: Segment; t0: number } | null;
  view: { x: number; y: number; zoom: number; fit: number };
  /** What the screen says: a title card for the big moments, and what is said, as subtitles. */
  cards: Card[]; subs: Sub[];
  /** The travel diary (shown on the map). */
  chronicle: { t: number; day: number; text: string }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
  /** Where a plane coordinate is on screen now (world x). */
  xOf(L: number, s: number): number;
};

export type Ctx = {
  world: CastleWorld; r: Rng;
  say(text: string): void;
  card(title: string, sub?: string): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  speak(who: { name: string; line?: string; lineT?: number }, line: string, dur?: number): void;
  fx(kind: FxKind, x: number, y: number, extra?: Partial<Fx>): void;
  look(why: string, x: number, y: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
  spirit(): Member;
};
