/**
 * Ironhaze's shapes: the world the sim keeps and the painter reads.
 *
 * Space: the view drifts rightward forever. Each depth `f` has its own x; the view's left edge at
 * depth f is `scroll * f` (so far planes move slower: parallax). The city is streamed in chunks per
 * plane, each built only from (seed, plane, chunk index), so a seed's city is always the same.
 */
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';
import type { Rng } from '../../../rng';

export type Layout = 'canyon' | 'harbour' | 'heights' | 'tiers';
export type Mood = 'amber' | 'verdigris' | 'ashen' | 'rust';
export type Frame = 'balcony' | 'station' | 'bridge' | 'gantry';
export type ClockStyle = 'needle' | 'onion' | 'deco' | 'gear' | 'lattice' | 'twin';
export type BKind =
  | 'gothic' | 'block' | 'stack' | 'deco' | 'dome' | 'factory' | 'refinery' | 'blast' | 'cathedral' | 'clock'
  | 'skydock' | 'lift' | 'arcology' | 'observatory' | 'gasholder' | 'spire' | 'quay';

export type Clock = { x: number; y: number; r: number; f: number; layer: number; style: ClockStyle; top: number; great: boolean };
export type Building = {
  id: number; layer: number; kind: BKind; x: number; w: number; h: number; base: number; seed: number;
  /** Chimney tops: x, y, width. */
  chimneys: [number, number, number][];
  /** Mooring points on it (mast ids). */
  masts: number[];
  clock: Clock | null;
  foundry: boolean;
  /** A red aviation lamp on the very top. */
  beacon: [number, number] | null;
  /** An anti-aircraft gun on the roof. */
  gun: [number, number] | null;
  /** A refinery's flare stack: where the flame burns. */
  flare: [number, number] | null;
};
export type BridgeKind = 'covered' | 'truss' | 'arch';
/** Under the decks of a tiered city: its catwalks, its lifts, its furnaces and vents. */
export type UnderPart = {
  catwalks: [number, number, number][];
  lifts: [number, number, number][];
  furnaces: [number, number, number, number][];
  vents: [number, number][];
  /** The great arches holding up the deck: x, half-width. */
  arches: [number, number][];
};
export type Under = UnderPart & { deck: number; floor: number };
/**
 * Machinery out in the open, drawn live (it moves): beam engines rocking on the roofs, gear trains on
 * the walls, flyball governors, pipe runs with their valves and gauges, pneumatic tubes between the
 * towers with their capsules, hydraulic cranes, steam hammers, great flywheels, bucket elevators.
 * (x2, y2): where a pipe or a tube goes to.
 */
export type MachineKind = 'beam' | 'gears' | 'governor' | 'pipes' | 'tube' | 'crane' | 'hammer' | 'flywheel' | 'elevator';
export type Machine = { kind: MachineKind; layer: number; x: number; y: number; x2: number; y2: number; s: number; seed: number };
/** Words on the city: painted walls, enamel boards, hanging signs, neon at night, tall signs down a tower. */
export type SignKind = 'painted' | 'board' | 'neon' | 'tall' | 'hanging';
export type Sign = { kind: SignKind; layer: number; x: number; y: number; w: number; h: number; text: string; seed: number };
/** One chunk of one plane of the city. */
export type Chunk = {
  i: number; k: number; x0: number; x1: number;
  buildings: Building[];
  bridges: [number, number, number, BridgeKind][];
  walkways: [number, number, number][];
  cliffs: [number, number, number][];
  cables: [number, number, number, number][];
  under: UnderPart | null;
  masts: number[]; paths: number[];
  machines: Machine[]; signs: Sign[];
};
export type Layer = {
  i: number;
  /** Parallax: 1 is the nearest plane; smaller is further into the haze (and moves less). */
  f: number;
  /** Where the layer's streets are (hidden in its fog). */
  base: number;
  /** Perspective: how big things at this depth are drawn. */
  m: number;
  /** Chunk width. */
  cw: number;
  viaduct: number | null;
  /** All of the live chunks', together. */
  buildings: Building[];
  bridges: [number, number, number, BridgeKind][];
  walkways: [number, number, number][];
  cliffs: [number, number, number][];
  machines: Machine[]; signs: Sign[];
};
/** A mooring point. `side`: which side of it a ship lies (-1 left, 1 right, 0 either). */
export type Mast = { id: number; layer: number; f: number; x: number; y: number; ship: number; platform: number; side: -1 | 0 | 1 };
export type PlatformKind = 'dock' | 'garden' | 'fort' | 'market';
export type Platform = { id: number; f: number; x: number; y: number; w: number; kind: PlatformKind; seed: number; masts: number[]; path: number };
export type Island = { id: number; f: number; x: number; y: number; w: number; seed: number; vx: number; hold: number; moving: boolean };

export type ShipKind = 'zeppelin' | 'dreadnought' | 'junk' | 'scout' | 'carrier' | 'balloon' | 'liner' | 'galleon' | 'twin' | 'gunship' | 'hauler' | 'hulk' | 'tender';
export type ShipState = 'cruise' | 'approach' | 'moored' | 'depart' | 'attack' | 'battle' | 'burning' | 'falling' | 'spray';
export type Ship = {
  id: number; kind: ShipKind; name: string; f: number; x: number; y: number; dir: 1 | -1; speed: number;
  /** Length as drawn (already scaled for its depth). */
  len: number;
  state: ShipState; t0: number; mast: number; target: number; fire: number; tilt: number; bob: number;
  colors: [string, string, string]; flag: string; fleet: boolean; search: number; alive: boolean; horn: number;
  /** Whose side it is on in a battle (0: the city's). */
  team: 0 | 1;
  hp: number; gun: number; seed: number;
  /** Her registry, and where she is bound. */
  reg: string; bound: string;
  /** What was last heard from her (the bridge, the deck), and when. */
  line: string; lineT: number;
};
export type WalkerKind = 'biped' | 'quad' | 'tripod' | 'colossus' | 'strider' | 'crawler' | 'hexapod';
export type Walker = {
  id: number; kind: WalkerKind; f: number; x: number; dir: 1 | -1; phase: number; speed: number; h: number;
  gun: number; siren: number; alive: boolean; seed: number; team: 0 | 1; hp: number;
  state: 'walk' | 'fire' | 'fall' | 'down'; t0: number;
  name: string; line: string; lineT: number;
  /** One of the city's own, about its work in the streets (not one of a march or a siege). */
  ambient: boolean;
};
export type Fighter = { id: number; f: number; x: number; y: number; vx: number; vy: number; team: 0 | 1; phase: number; alive: boolean; gun: number; t0: number };
export type Train = { layer: number; x: number; dir: 1 | -1; cars: number; speed: number };
export type SeaShip = { id: number; f: number; x: number; dir: 1 | -1; speed: number; len: number; kind: 'ironclad' | 'steamer' | 'tug'; funnels: number };
export type Gondola = { cable: [number, number, number, number]; layer: number; u: number; dir: 1 | -1; wait: number; chunk: string };
export type PathKind = 'bridge' | 'walk' | 'frame' | 'under' | 'via' | 'deck';
export type Path = { id: number; layer: number; f: number; x0: number; x1: number; y: number; kind: PathKind };
/** Someone out in the city: on a bridge, a walkway, the viaduct's footway, under the decks, or on the balcony with us. */
export type Person = { path: number; u: number; speed: number; dir: 1 | -1; kind: number; wait: number; stand: boolean; flag: number; seed: number };
export type Fire = { layer: number; f: number; x: number; y: number; w: number; t0: number; until: number; out: boolean };
export type FxKind = 'smoke' | 'steam' | 'spark' | 'fire' | 'flash' | 'lantern' | 'debris' | 'bell' | 'flare' | 'muzzle' | 'shell' | 'flak' | 'bomb' | 'water' | 'confetti' | 'firework';
export type Fx = { kind: FxKind; f: number; x: number; y: number; vx: number; vy: number; t0: number; dur: number; r: number; color: string; seed: number };
export type Bolt = { pts: [number, number][]; t0: number; f: number };
export type Label = { text: string; x: number; y: number; f: number; t0: number; color: string };
export type Flock = { x: number; y: number; f: number; n: number; seed: number; scatter: number; home: [number, number] };

export type HazeOptions = { traffic: number; speed: number; camera?: string };

export type HazeWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; bus: Bus; director: Director;
  name: string; layout: Layout; mood: Mood; frame: Frame; side: 1 | -1; year: number; season: number; cast: string[]; castIds: string[];
  /** The time of day, 0..1 (0 midnight, 0.5 noon). */
  day: number;
  /** How far the view has drifted right (near-plane units), and how fast (near-plane units a second). */
  scroll: number; drift: number;
  /** The view at a depth: x at a fraction of the way across it. */
  vx(f: number, frac: number): number;
  /** Whether x (at depth f) is in the view, with a margin (a share of the width). */
  inView(x: number, f: number, margin?: number): boolean;
  layers: Layer[]; chunks: Map<number, Chunk>[];
  /** Bumped when chunks come or go. */
  version: number;
  masts: Mast[]; platforms: Platform[]; islands: Island[]; under: Under | null;
  ships: Ship[]; walkers: Walker[]; fighters: Fighter[]; trains: Train[]; seaShips: SeaShip[]; gondolas: Gondola[];
  paths: Map<number, Path>; people: Person[];
  fx: Fx[]; bolts: Bolt[]; flocks: Flock[]; fires: Fire[];
  /** Anti-aircraft guns on the roofs: layer, x, y. */
  guns: [number, number, number][];
  sea: number | null;
  /** The Great Spire nearest the middle of the view, and every clock in the city. */
  clock: Clock | null; clocks: Clock[];
  storm: number; fog: number; wind: number;
  pour: number; moon: number; lanterns: number;
  pyres: [number, number, number, number][];
  /** Where the searchlights are holding, in a raid. */
  search: { x: number; y: number; f: number } | null;
  /** Bunting out (a parade), and the red flags (a rising): 0..1. */
  bunting: number; unrest: number;
  /** The noon automata on the Great Clock: how far out they are (0..1). */
  automata: number;
  /** The camera as the painter last framed it, in the view's own terms (for touches at depth). */
  view: { x: number; y: number; zoom: number; fit: number };
  labels: Label[]; chronicle: { t: number; text: string }[];
  m(f: number): number;
  groundAt(f: number): number;
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

/** What the cast's systems get to work with. */
export type Ctx = {
  world: HazeWorld; r: Rng;
  say(text: string, x: number, y: number, f: number, color?: string): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  spawn(kind: ShipKind, f: number, extra?: Partial<Ship>): Ship;
  walker(kind: WalkerKind, f: number, extra?: Partial<Walker>): Walker;
  look(id: string, x: number, y: number, f: number, zoom: number, hold: number, priority: number): void;
  /** A shell burst: flash, smoke, debris, maybe fire. */
  blast(x: number, y: number, f: number, size: number): void;
  /** Set a building alight. */
  ignite(layer: number, x: number, y: number, w: number, dur: number): Fire;
  /** A shell from one point to another (a tracer that bursts when it gets there). */
  shoot(x0: number, y0: number, x1: number, y1: number, f: number, speed: number, color?: string, burst?: 0 | 1 | 2, size?: number): void;
  /** A crowd onto the paths in view (a parade, a rising). */
  crowd(n: number, kinds: PathKind[], flag: number): void;
  /** Do something a little later (in sim time). */
  after(delay: number, fn: () => void): void;
  /**
   * Where something heading `dir` at `speed` (at depth f) comes into a drifting view: from behind
   * only if it can outrun the drift, else from ahead. `off`: how far beyond the edge.
   */
  entry(f: number, dir: 1 | -1, speed: number, off: number): number;
  /** Something said aloud on a ship or a walker (shown by it, briefly). */
  speak(who: Ship | Walker, line: string): void;
};
