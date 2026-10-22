/**
 * Last Loop's shapes: the bodies of the little system, the ship, the camps, and what flies
 * between them. DOM-free; the sim owns all of it and the painter only reads it.
 */
import type { Bus } from '../../../sim/bus';
import type { Rng } from '../../../rng';
import type { Director } from '../../../kit';

export type BodyKind = 'home' | 'twinA' | 'twinB' | 'crumble' | 'ocean' | 'thorn' | 'moon' | 'cinder' | 'shy' | 'comet' | 'station';

/** A body of the system. Positions are recomputed every step from the loop's clock, so a reset restores them. */
export type Body = {
  id: number;
  kind: BodyKind;
  name: string;
  /** Radius in world pixels (before the depth scale). */
  r: number;
  /** Orbit: radius around its parent (or the sun), phase at the loop's start, period in seconds (negative runs the other way). */
  a: number;
  phase0: number;
  period: number;
  /** The body it circles (index into bodies), or -1 for the sun. */
  parent: number;
  /** Plane coordinates around the sun: X right, Z toward us. Y is up out of the plane. */
  X: number;
  Y: number;
  Z: number;
  /** Where it is in the world picture, its drawn radius and its nearness (bigger is nearer). */
  x: number;
  y: number;
  R: number;
  depth: number;
  /** Turning on its axis: the angle now, and its rate in radians a second. */
  spin: number;
  spinRate: number;
  /** Per-seed look: a variant and a hue nudge. */
  variant: number;
  hue: number;
  /** Lost to the supernova this loop (restored at the reset). */
  gone: boolean;
  /** When the shockwave reached it (sim time), for the painter's last glow. */
  burnT: number;
};

/** Something standing on a body's surface: a camp, the village, a tower, an island, a funnel. */
export type Site = { body: number; lon: number; lat: number };

export type Camp = Site & {
  id: number;
  who: string;
  instrument: string;
  /** Playing now (notes rise), and since when. */
  playing: boolean;
  since: number;
  fire: string;
};

export type Island = Site & { id: number; lift: number; liftT: number; state: 'sea' | 'flung' | 'falling'; spinT: number };
export type Tornado = Site & { id: number; h: number; drift: number; born: number; dur: number };
/** A shard of the crumbling planet's crust: where it is on the sphere, and when it falls this loop. */
export type Shard = { id: number; lon: number; lat: number; fallAt: number; fallen: boolean; fellT: number };

export type ShipState = 'docked' | 'launch' | 'cruise' | 'land' | 'landed' | 'crash' | 'wrecked' | 'fall' | 'gone';

export type Ship = {
  name: string;
  state: ShipState;
  t0: number;
  x: number;
  y: number;
  depth: number;
  /** Heading on screen, radians. */
  ang: number;
  /** Where from, where to, and the arc between. */
  from: number;
  to: number;
  sx: number;
  sy: number;
  dur: number;
  bend: number;
  /** The side of the body it sits on (screen angle), while landed or wrecked. */
  side: number;
  thrust: number;
  trail: { x: number; y: number; t: number }[];
  /** Who flies it. */
  pilot: string;
  /** Where it plans to go this loop, and how far down the list it is. */
  plan: number[];
  leg: number;
  /** A course set by a touch, taken next. */
  asked: number;
};

export type Probe = { id: number; x: number; y: number; vx: number; vy: number; t0: number; bearing: number };
export type Meteor = { id: number; x: number; y: number; tx: number; ty: number; sx: number; sy: number; t0: number; dur: number; target: number; kind: 'lava' | 'shower'; ang: number };
export type Note = { x: number; y: number; vx: number; vy: number; t0: number; color: string; kind: number };
export type Fx = { kind: 'flash' | 'dust' | 'smoke' | 'splash' | 'spark' | 'debris' | 'ring'; x: number; y: number; vx: number; vy: number; t0: number; dur: number; r: number; color: string };
/**
 * A line on screen, like a film's subtitle: one at a time, at the foot of the picture. `who` speaks
 * it (a quote), or it is the narrator's. `body` is what it is about (the painter rings it).
 */
export type SubKind = 'big' | 'event' | 'radio' | 'quiet';
export type Sub = { text: string; who: string; kind: SubKind; t0: number; dur: number; x: number; y: number; body: number };
/** An entry in the ship's log: what was learned, where, and in which loop. */
export type LogEntry = { text: string; body: number; loop: number; t: number };
/** Lasting marks: scorches on the crumbling crust; the ship's road this loop; the probe's bearings, loop by loop. */
export type Scorch = { lon: number; lat: number; t: number };
export type RoutePoint = { X: number; Z: number; body: number; t: number };
export type ProbeShot = { loop: number; bearing: number; X: number; Z: number };
export type StarKind = 'gold' | 'white' | 'amber';

/** Where the loop is: living, the sun falling in on itself, the supernova, the dark, and the waking. */
export type LoopPhase = 'wake' | 'live' | 'collapse' | 'nova' | 'dark';

export type LoopOptions = { loop: number; traffic: number; camera?: string };


export type LoopWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; k: number; bus: Bus; director: Director;
  /** The system's middle (the sun), the tilt of the orbital plane, and the room the orbits have. */
  cx: number; cy: number; sinE: number; cosE: number; Rmax: number;
  name: string; ancients: string; cast: string[]; castIds: string[]; hues: string[];
  /** What the seed made: the star's kind, the sky's colour family, a ring round the ocean giant, a belt of rubble (radius, width; 0 for none), the white hole (or -1). */
  star: StarKind; sky: number; ringed: boolean; belt: [number, number]; whiteHole: [number, number] | null;
  /** The comet's ellipse (eccentricity, turn), for the chart. */
  cometE: number; cometW: number;
  /** The loop: its length in seconds, which loop this is, the clock in it, and the phase. */
  loopLen: number; loop: number; tau: number; phase: LoopPhase; phaseT: number;
  /** The sun: its radius now, its age 0..1 through the loop, and its colour (warm to deep red). */
  sun: { r: number; r0: number; age: number; color: string; heat: number; flare: number; flareAng: number; nova: number; shock: number };
  bodies: Body[];
  home: number; twinA: number; twinB: number; crumble: number; ocean: number; thorn: number; shy: number; comet: number; station: number; moon: number; cinder: number;
  /** The sand: the share of it still on the first twin (1 at the start of a loop, flowing to the other). */
  sand: number;
  shards: Shard[];
  islands: Island[];
  tornadoes: Tornado[];
  camps: Camp[];
  village: Site;
  tower: Site;
  ship: Ship;
  probes: Probe[];
  meteors: Meteor[];
  notes: Note[];
  fx: Fx[];
  /** The station's barrel: where it aims, and its last shot. */
  aim: number; aimTo: number; fired: number;
  /** The strange moon: which body it circles now, and when it last jumped. */
  shyAt: number; shyT: number;
  /** A meteor shower passing through, 0..1. */
  shower: number;
  /** What the traveller has learned, loop by loop (the ship's log). */
  learned: string[];
  log: LogEntry[];
  sub: Sub | null;
  subQ: Sub[];
  scorches: Scorch[];
  route: RoutePoint[];
  probeLog: ProbeShot[];
  /** Rare things this loop: the comet cracked open; the far eye looking back (0..1); the traveller stayed home. */
  cometCracked: number; eye: number; stayHome: boolean;
  view: { x: number; y: number; zoom: number; fit: number };
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
  /** Where a point on a body's surface is in the picture now; c > 0 faces us. */
  surf(b: Body, lon: number, lat: number, lift?: number): SurfPoint;
};

export type SurfPoint = { x: number; y: number; c: number; nx: number; ny: number; lit: number };

export type Ctx = {
  world: LoopWorld;
  r: Rng;
  say(text: string, x: number, y: number, o?: { kind?: SubKind; who?: string; body?: number; color?: string }): void;
  emit(type: string, x: number, y: number, weight: number): void;
  look(why: string, x: number, y: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
};
