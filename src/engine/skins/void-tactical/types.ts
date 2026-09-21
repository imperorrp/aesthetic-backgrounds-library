/**
 * Background Types Module
 *
 * @description TypeScript interfaces and types for space background elements and their properties.
 * @module
 */

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

export interface Fleet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  glyph: string;
  color: string;
  history: Point[];
  showLabel: boolean;
  type: 'fighter' | 'cruiser' | 'freighter' | 'scout';
  formationOffset: Point; // Offset from the fleet center
  curvature: number; // How much the path curves
  curveDirection: number; // 1 for clockwise, -1 for counter-clockwise
  curvePhase: number; // Starting phase for the curve
  spiralFactor: number; // Additional spiral tightening factor
  state: 'cruising' | 'approaching' | 'orbiting' | 'docking' | 'launching'; // Fleet AI state
  targetId?: string; // ID of target system/structure
  approachTarget?: Point; // Target position for approaching
  targetType?: 'planet' | 'structure'; // Type of target being approached
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
  // Vastly expanded ontology
  kind: 
    // Infrastructure
    | 'station' | 'shipyard' | 'jumpgate' | 'comm_buoy' | 'defense_grid' | 'mining_outpost'
    // Megastructures
    | 'dyson_sphere' | 'ringworld' | 'stellar_lifter' | 'matrioshka_brain' | 'penrose_sphere'
    // Celestial / Hazards
    | 'black_hole' | 'neutron_star' | 'quasar' | 'magnetar' | 'rogue_planet'
    // Ancient / Mystery
    | 'void_rift' | 'precursor_relic' | 'ancient_gate' | 'psionic_beacon' | 'derelict_hulk' | 'monolith';
  x: number;
  y: number;
  size: number;
  color?: string;
  active?: boolean;
}

export interface StarSystem {
  id: string;
  x: number;
  y: number;
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
  followId?: string; // Optional id of entity this overlay should track (e.g., fleet id)
  lifetime: number;       // ms remaining
  duration: number;       // initial ms duration
  anchor: 'screen' | 'world'; // world => transform by camera
  parallax?: number;      // Parallax factor for movement
  createdAt: number;
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
}
