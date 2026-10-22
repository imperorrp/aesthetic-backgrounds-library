/**
 * Traction's shapes: the world the sim keeps and the painter reads.
 *
 * Space: the hunting ground seen from alongside the great city, as if from a scout airship flying
 * with it. A thing on the plain has a ground `gx` (ground units: pixels at the nearest depth) and a
 * depth `d` (0 the near mud, 1 the horizon); things in the air have an `alt` above the mud in the
 * same units. The camera travels with the city: `scroll` is the ground x under the middle of the
 * picture, so the plain slides past at the city's speed, far things slower than near ones. The
 * world's `yOf`, `mOf` and `sx` put a thing on the picture.
 *
 * A city's own parts (its tiers, guns, fires) are in city units: 1000 from its tail to its jaws,
 * x forward from its middle, y up from the mud negative (see ./design).
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';
import type { Rng } from '../../../rng';

export type Mood = 'ochre' | 'ash' | 'rust' | 'peat';
/** What the hunting ground is: churned mud, a salt flat, dry steppe, or snow over the mud. */
export type Land = 'mud' | 'salt' | 'steppe' | 'snow';
export type CityTop = 'cathedral' | 'dome' | 'spires' | 'ziggurat';
export type CityState = 'roam' | 'hunt' | 'chase' | 'eat' | 'duel' | 'retreat' | 'gone';
export type Fire = { lx: number; ly: number; t0: number; dur: number; r: number };
export type City = {
  id: number; name: string; gx: number; d: number; dir: 1 | -1; speed: number; cruise: number;
  /** Its length, in ground units. */
  len: number; tiers: number; top: CityTop; tracks: number; seed: number; pop: number;
  /** Towns eaten; chimneys lit (one more for each). */
  eaten: number; chimneys: number;
  /** The jaws, 0 shut to 1 open; the gut's furnace glow, 0..1; how far round the tracks have turned. */
  jaw: number; gut: number; tread: number;
  state: CityState; t0: number;
  /** Damage, 0..1; fires burning on it; the burnt places they leave (lasting, slowly patched). */
  hurt: number; fires: Fire[]; scars: { lx: number; ly: number; r: number; t0: number }[];
  /** When its guns last fired, and its horn last blew. */
  gunT: number; hornT: number;
  /** Searchlights: each beam's angle off the vertical, and where it falls on the plain. */
  beams: { a: number; v: number; gx: number; d: number }[];
  rival: boolean; line: string; lineT: number;
};
export type TownKind = 'wheeled' | 'tracked' | 'scav' | 'suburb' | 'mining' | 'sail';
export type TownState = 'arrive' | 'roam' | 'flee' | 'caught' | 'eaten' | 'escaped' | 'broken' | 'scavenge' | 'gone';
export type Town = {
  id: number; name: string; kind: TownKind; gx: number; d: number; vx: number; vd: number; speed: number;
  dir: 1 | -1; state: TownState; t0: number;
  /** Its length in ground units; its tiers; how many live aboard. */
  len: number; tiers: number; pop: number; seed: number;
  /** How far it has gone into the jaws (0..1), once caught. */
  eat: number;
  /** Fleeing: which way it runs (ahead, or for the ridge), and how fast it can. */
  run: 'ahead' | 'ridge' | 'none'; top: number;
  /** Steam and smoke when broken down, 0..1; how far round its wheels have turned. */
  smoke: number; roll: number;
  line: string; lineT: number;
};
export type ShipKind = 'trader' | 'balloon' | 'hauler' | 'league' | 'gunboat' | 'clipper';
export type ShipState = 'cruise' | 'dock' | 'attack' | 'fall' | 'leave' | 'gone';
export type Ship = {
  id: number; name: string; kind: ShipKind; gx: number; d: number; alt: number; vx: number; dir: 1 | -1;
  state: ShipState; t0: number; len: number; seed: number; tx: number; td: number; talt: number;
  /** On fire, 0..1; its bob. */
  fire: number; bob: number;
  line: string; lineT: number;
};
export type Harbour = { name: string; gx: number; d: number; alt: number; t0: number; state: 'arrive' | 'moored' | 'leave'; seed: number; tx: number };
export type Flock = { id: number; gx: number; d: number; alt: number; vx: number; n: number; seed: number; scatter: number; spread: number };
export type FxKind = 'mud' | 'clod' | 'smoke' | 'steam' | 'spark' | 'fire' | 'flash' | 'flak' | 'rocket' | 'debris' | 'splash' | 'shell';
export type Fx = {
  kind: FxKind; gx: number; d: number; alt: number; vx: number; valt: number; t0: number; dur: number; r: number; color: string; seed: number;
  /** Carried along by a city (its id): gx is then relative to the city. */
  on: number;
};
export type RelicKind = 'colossus' | 'dish' | 'tower' | 'ring' | 'hull';
export type Relic = { id: number; kind: RelicKind; gx: number; d: number; t0: number; k: number; seed: number; name: string };
export type Wreck = { id: number; kind: 'ship' | 'town'; gx: number; d: number; t0: number; seed: number; smoke: number; len: number };
export type Trail = { id: number; w: number; gauge: number; pts: [number, number][]; tread: boolean };
/** A note on the plain (the map's hand-lettered annotations). */
export type Label = { text: string; x: number; y: number; gx: number; d: number; t0: number; color: string };
/** A beat of the story: an intertitle in the scene, a bold note on the chart. */
export type Beat = { kicker: string; text: string; t0: number; gx: number; d: number };
/** A line heard on the radio: a subtitle. */
export type Radio = { who: string; text: string; t0: number };
export type Crater = { gx: number; d: number; r: number; t0: number };

export type TractionOptions = { traffic: number; camera?: string };

export type TractionWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; phone: boolean; bus: Bus; director: Director;
  region: string; mood: Mood; land: Land; cast: string[]; castIds: string[];
  /** The time of day, 0..1 (0 midnight, 0.5 noon), and how long a day is in seconds. */
  day: number; dayLen: number;
  /** The horizon, the near edge of the plain, and the ridge's depth. */
  HY: number; NY: number; ridgeD: number;
  /** The ground x under the middle of the picture: the camera travels with the city. */
  scroll: number;
  /** The light's side: +1 the sun is to the right. */
  sunSide: 1 | -1;
  yOf(d: number): number;
  mOf(d: number): number;
  sx(gx: number, d: number): number;
  city: City; rival: City | null; towns: Town[]; ships: Ship[]; harbour: Harbour | null; flocks: Flock[];
  fx: Fx[]; relics: Relic[]; wrecks: Wreck[]; trails: Trail[]; craters: Crater[];
  /** The far shield-wall's guns: when they last fired (and how hard), 0 never. */
  bulwark: { t: number; k: number };
  /** The weather: rain (0..1), the wind, a lightning flash, how wet the mud is. */
  rain: number; wind: number; flash: number; wet: number;
  /** The hunt in hand. */
  hunt: { phase: 'none' | 'sighted' | 'chase' | 'jaws' | 'gut' | 'strip'; town: number; t0: number; outcome: 'catch' | 'escape' };
  /** The tally. */
  eatenTotal: number; escaped: number;
  view: { x: number; y: number; zoom: number; fit: number };
  labels: Label[]; beats: Beat[]; radio: Radio[]; chronicle: { t: number; day: number; text: string }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

export type Ctx = {
  world: TractionWorld; r: Rng;
  /** A note on the plain at (gx, d); with a kicker, a beat of the story. */
  say(text: string, gx: number, d: number, kicker?: string): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  speak(who: { name: string; line: string; lineT: number }, line: string): void;
  look(why: string, gx: number, d: number, alt: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
  town(kind: Town['kind'], gx: number, d: number, extra?: Partial<Town>): Town;
  ship(kind: ShipKind, gx: number, d: number, alt: number, extra?: Partial<Ship>): Ship;
  fx(kind: FxKind, gx: number, d: number, alt: number, extra?: Partial<Fx>): void;
};
