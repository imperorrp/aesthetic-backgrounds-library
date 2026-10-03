/**
 * Background Types Module
 *
 * @description TypeScript interfaces and types for space background elements and their properties.
 * @module
 */
import type { AnomalyStyle, Rarity, ShipClass, StructureRole, UniversePack } from './universe';
import type { Formation } from './ships';

export interface Point {
  x: number;
  y: number;
}

export interface Star {
  id: string;
  x: number;
  y: number;
  brightness: number;
  color: string;
  twinkle: number;
  size: number;
}

export interface Constellation {
  id: string;
  stars: string[]; // Star IDs
  name?: string;
  color: string;
}

/** One hull in a fleet. `slot` is its formation position (leader-local units). */
export interface Ship {
  cls: ShipClass;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  slot: [number, number];
  /** Hull points; at zero the ship is destroyed. */
  hp: number;
}

/**
 * Cubic Hermite path from p0 (velocity v0) to p1 (velocity v1) over T seconds from t0.
 * Depth eases from z0 to z1 along the way, so a fleet bound for a far station visibly
 * sinks into the distance as it goes.
 */
export interface FleetPlan {
  p0x: number; p0y: number; v0x: number; v0y: number;
  p1x: number; p1y: number; v1x: number; v1y: number;
  z0: number; z1: number;
  T: number;
  t0: number;
}

export interface FleetTarget {
  kind: 'structure' | 'system' | 'anomaly' | 'exit' | 'point';
  id?: string;
  x: number;
  y: number;
  /** Depth of the target (0 = main plane). */
  z?: number;
  label?: string;
  role?: StructureRole;
}

export type FleetPurpose = 'patrol' | 'cargo' | 'survey' | 'transit';
export type FleetMode = 'transit' | 'orbit' | 'docked' | 'jumping' | 'gone';

export interface Fleet {
  id: string;
  /** Call sign shown on the map, e.g. "FLT-215" or a data-driven name. */
  callsign: string;
  cls: ShipClass;
  faction: number;
  purpose: FleetPurpose;
  /** ships[0] is the leader; the rest hold formation slots. */
  ships: Ship[];
  /** Depth of the whole fleet (0 = main plane; see `View`). */
  z: number;
  formation: Formation;
  spacing: number;
  mode: FleetMode;
  plan?: FleetPlan;
  target?: FleetTarget;
  orbit?: { cx: number; cy: number; r: number; ang: number; w: number; until: number };
  dockedUntil?: number;
  jumpAt?: number;
  /** Leader history as flat x,y pairs, oldest first. */
  trail: number[];
  lastSample: number;
  showLabel: boolean;
  /** 0..1 visibility (fades on launch, dock, and jump). */
  fade: number;
  fadeTo: number;
  visits: number;
  maxVisits: number;
  /** Anomaly ids already surveyed, so scouts move on. */
  surveyed: string[];
  /** Set by a mechanic that is steering this fleet's leader (raids, mining, war). */
  steer?: ((f: Fleet, dt: number) => void) | null;
  /** Who spawned it and why (e.g. 'raider', 'miner', 'war'). */
  tag?: string;
  hostile?: boolean;
  /** What it is hauling: drawn as glowing pods behind each hull; delivered when it docks. */
  cargo?: { good: string; amount: number; color: string; to?: string };
}

export interface Planet {
  id: string;
  type: 'planet' | 'moon' | 'asteroid';
  radius: number; // visual radius
  orbitRadius?: number; // if orbiting a star
  orbitSpeed?: number;
  orbitPhase?: number;
  color: string;
}

export interface Structure {
  id: string;
  kind: string;
  label: string;
  role: StructureRole;
  rarity: Rarity;
  art: string[];
  chatter: string[];
  x: number;
  y: number;
  /** Depth: 0 on the main plane, up to ~1.2 far behind it (smaller, slower, dimmer). */
  z?: number;
  size: number;
  color?: string;
  active?: boolean;
  /** Per-structure phase for idle animations. */
  spin: number;
  /** Sim time of the last flash (dock, launch, jump). */
  flashAt?: number;
  /** Sim time of this structure's next behavior (launch, cargo run, arrival). */
  nextAction: number;
  /** A gate's partner: jumps from here come out there. */
  pairId?: string;
}

export interface StarSystem {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Depth (see `Structure.z`). */
  z?: number;
  starColor: string;
  starRadius: number;
  planets: Planet[];
  structures: Structure[];
  visibleHint?: boolean;
}

export interface SystemNode {
  id: string;
  x: number;
  y: number;
  glyph: string;
  name: string;
  type: 'star' | 'planet' | 'station';
  connections: string[]; // IDs of connected nodes
}

export interface Telemetry {
  id: string;
  x: number;
  y: number;
  text: string;
  type: 'info' | 'warn' | 'error';
  opacity: number;
  age: number;
  maxAge: number;
}

export interface CelestialBody {
  id: string;
  x: number;
  y: number;
  type: 'planet' | 'asteroid' | 'moon';
  size: number;
  color: string;
  orbitRadius?: number;
  orbitSpeed?: number;
  orbitCenterX?: number;
  orbitCenterY?: number;
  orbitAngle?: number;
}

export interface Anomaly {
  id: string;
  x: number;
  y: number;
  type: string;
  style: AnomalyStyle;
  color: string;
  /** 0..1 animation phase offset. */
  seed: number;
  born: number;
  age: number;
  text: string; // Associated text that stays with this anomaly
}

export interface TacticalElement {
  id: string;
  text: string;
  x: number;
  y: number;
  type: 'status' | 'info' | 'warning' | 'nav' | 'chatter' | 'fleet';
  priority: 'low' | 'medium' | 'high';
  color: string;
  glow?: boolean;
  followId?: string; // Optional id of a fleet this overlay tracks
  /** Depth of what it is about (follows the fleet's depth). */
  z?: number;
  lifetime: number;       // ms remaining
  duration: number;       // initial ms duration
  anchor: 'screen' | 'world'; // world => transform by camera
  parallax?: number;      // Parallax factor for movement
  createdAt: number;
}

/** A target lock: brackets close on a contact while its data types out. */
export interface TargetLock {
  kind: 'fleet' | 'structure';
  id: string;
  start: number;
  duration: number;
  lines: string[];
}

import type { LabelDensity } from '../../config';

export type { LabelDensity };
export interface SimSettings {
  labelDensity: LabelDensity;
  overlaySpawnRate: number;
  maxOverlays: number;
}

export interface SystemState {
  stars: Star[];
  constellations: Constellation[];
  celestialBodies: CelestialBody[];
  fleets: Fleet[];
  nodes: SystemNode[];
  telemetry: Telemetry[];
  anomalies: Anomaly[];
  systems: StarSystem[];
  structures: Structure[];
  overlays: TacticalElement[];
  width: number;
  height: number;
  settings: SimSettings;
  /** The fiction this map belongs to. */
  universe: UniversePack;
  /** 0..1 slow activity curve: calm stretches and busy stretches. */
  tension: number;
  lock: TargetLock | null;
  /** Monotonic id counter, per world (keeps ids deterministic across instances). */
  seq: number;
  /**
   * Structure roles a mechanic has taken over (the economy runs mines and shipyards, for
   * example). The world's default timed behavior skips them.
   */
  managedRoles?: Set<string>;
}
