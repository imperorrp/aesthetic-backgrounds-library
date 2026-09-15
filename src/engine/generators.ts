/**
 * Background Generators Module
 *
 * @description Utility functions for generating space background elements.
 * Includes fleet generation with chaotic movement patterns, curvature,
 * and spiral factors for dynamic procedural animations.
 *
 * Notes:
 * - SystemState now includes `structures` at both global and per-system levels. Generators add an empty `structures` array by default to maintain a stable state shape.
 * - All generator functions are deterministic when supplied a seed and build out wide sets of procedurally consistent starfields, systems, fleets, and structures.
 * - `generateSingleStructure` now lowers the weight of kinds passed in `excludeKinds` for variety enforcement.
 * @module
 */

import type { SystemState, Fleet, SystemNode, Telemetry, Anomaly, Star, Constellation, CelestialBody, StarSystem, Planet, Structure, SimSettings } from './types';
import type { Rng } from './rng';

const defaultRng: Rng = Math.random;

const DEFAULT_SETTINGS: SimSettings = {
  labelDensity: 'low',
  overlaySpawnRate: 0.012,
  maxOverlays: 2,
};

// Helper to resolve CSS accent color at runtime (falls back to hex)
const accentColor = () => {
  try {
    if (typeof window === 'undefined' || !window.getComputedStyle) return '#06b6d4';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    return (v || '#06b6d4').trim();
  } catch (e) {
    return '#06b6d4';
  }
};

// Definitions for procedural generation
const STRUCTURE_TABLE = [
  // COMMON (Infrastructure)
  { kind: 'station', color: '#38bdf8', chance: 0.25, size: {min:4, max:7} },
  { kind: 'mining_outpost', color: '#fbbf24', chance: 0.25, size: {min:3, max:5} },
  { kind: 'comm_buoy', color: '#a3e635', chance: 0.20, size: {min:2, max:4} },
  { kind: 'shipyard', color: '#60a5fa', chance: 0.15, size: {min:8, max:12} },
  
  // UNCOMMON (Hazards & Tech)
  { kind: 'defense_grid', color: '#f87171', chance: 0.12, size: {min:4, max:6} },
  { kind: 'jumpgate', color: '#818cf8', chance: 0.10, size: {min:10, max:14} },
  { kind: 'rogue_planet', color: '#475569', chance: 0.08, size: {min:6, max:10} },
  { kind: 'derelict_hulk', color: '#94a3b8', chance: 0.08, size: {min:5, max:9} },

  // RARE (Celestial Phenomena)
  { kind: 'neutron_star', color: '#22d3ee', chance: 0.06, size: {min:5, max:7} },
  { kind: 'void_rift', color: '#d946ef', chance: 0.05, size: {min:15, max:25} },
  { kind: 'black_hole', color: '#7c3aed', chance: 0.04, size: {min:12, max:20} },

  // LEGENDARY (Megastructures & Mysteries)
  { kind: 'dyson_sphere', color: '#f59e0b', chance: 0.03, size: {min:20, max:30} },
  { kind: 'ringworld', color: '#10b981', chance: 0.03, size: {min:25, max:35} },
  { kind: 'monolith', color: '#e2e8f0', chance: 0.02, size: {min:8, max:15} },
  { kind: 'stellar_lifter', color: '#ef4444', chance: 0.02, size: {min:15, max:20} },
  { kind: 'matrioshka_brain', color: '#6366f1', chance: 0.02, size: {min:18, max:28} }
] as const;

export { STRUCTURE_TABLE };

const generateSystems = (count: number, width: number, height: number, rng: Rng): StarSystem[] => {
  const systems: StarSystem[] = [];
  for (let i = 0; i < count; i++) {
    const sx = rng() * width;
    const sy = rng() * height;
    const planetCount = 1 + Math.floor(rng() * 5);
    const planets: Planet[] = [];
    for (let p = 0; p < planetCount; p++) {
      const orbitR = 15 + p * (10 + rng() * 30); // Reduced from 30-110 to 15-75
      planets.push({
        id: `${i}-p${p}`,
        type: p === 0 && rng() < 0.15 ? 'asteroid' : (rng() < 0.2 ? 'moon' : 'planet'),
        radius: 1.5 + rng() * 3, // Reduced from 2-8 to 1.5-4.5
        orbitRadius: orbitR,
        orbitSpeed: (0.0005 + rng() * 0.001) * (rng() < 0.5 ? 1 : -1), // Much slower: 0.0005-0.0015
        orbitPhase: rng() * Math.PI * 2,
        color: ['#34a853', accentColor(), '#ffb703','#ff4500'][Math.floor(rng()*4)]
      });
    }

    const structures: Structure[] = [];
    // Generate Structures based on weighted probability
    // Iterate through the table multiple times; independent checks allow multiple structures per system
    for (let attempt = 0; attempt < 5; attempt++) {
      STRUCTURE_TABLE.forEach(def => {
        if (rng() < def.chance) {
          // Find a position that doesn't conflict with existing structures
          let structX: number, structY: number;
          let attempts = 0;
          do {
            structX = sx + (rng() - 0.5) * 400;
            structY = sy + (rng() - 0.5) * 400;
            attempts++;
          } while (attempts < 20 && structures.some(existing => {
            const distance = Math.sqrt(Math.pow(existing.x - structX, 2) + Math.pow(existing.y - structY, 2));
            return distance < 80; // Minimum 80px distance between structures
          }));
          
          structures.push({
            id: `${def.kind}-${i}-${rng().toString(36).substr(2,4)}`,
            kind: def.kind as Structure['kind'],
            x: structX,
            y: structY,
            size: def.size.min + rng() * (def.size.max - def.size.min),
            color: def.color
          });
        }
      });
    }

    systems.push({
      id: `sys-${i}`,
      x: sx,
      y: sy,
      starColor: ['#ffd700','#ffddaa','#fff2a6'][Math.floor(rng()*3)],
      starRadius: 2 + rng()*3, // Reduced from 3-8 to 2-5
      planets,
      structures
    });
  }
  return systems;
};

export const generateSingleSystem = (x: number, y: number, rng: Rng = defaultRng): StarSystem => {
  const planetCount = 1 + Math.floor(rng() * 5);
  const planets: Planet[] = [];
  for (let p = 0; p < planetCount; p++) {
    const orbitR = 15 + p * (10 + rng() * 30);
    planets.push({
      id: `p${p}`,
      type: p === 0 && rng() < 0.15 ? 'asteroid' : (rng() < 0.2 ? 'moon' : 'planet'),
      radius: 1.5 + rng() * 3,
      orbitRadius: orbitR,
      orbitSpeed: (0.0005 + rng() * 0.001) * (rng() < 0.5 ? 1 : -1),
      orbitPhase: rng() * Math.PI * 2,
      color: ['#34a853', accentColor(), '#ffb703','#ff4500'][Math.floor(rng()*4)]
    });
  }

  return {
    id: `sys-${Math.floor(rng() * 10000).toString().padStart(4, '0')}`,
    x,
    y,
    starColor: ['#ffd700','#ffddaa','#fff2a6'][Math.floor(rng()*3)],
    starRadius: 2 + rng()*3,
    planets,
    structures: [] // Structures are now global, not attached to systems
  };
};

// Generate a single structure at given world coordinates
export const generateSingleStructure = (x: number, y: number, excludeKinds: Structure['kind'][] = [], rng: Rng = defaultRng) => {
  // Choose from the structure table with a chance weight — if some kinds are in excludeKinds
  // we lower their effective weight to make them less likely to appear.
  const weighted = STRUCTURE_TABLE.map(def => ({
    def,
    weight: def.chance * (excludeKinds.includes(def.kind as Structure['kind']) ? 0.35 : 1)
  }));
  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let r = rng() * total;
  let chosenDef = weighted[0].def;
  for (let i = 0; i < weighted.length; i++) {
    r -= weighted[i].weight;
    if (r <= 0) {
      chosenDef = weighted[i].def;
      break;
    }
  }
  const def = chosenDef;
  return {
    id: `${def.kind}-${rng().toString(36).substr(2,4)}`,
    kind: def.kind as Structure['kind'],
    x,
    y: y + (rng() - 0.5) * 60,
    size: def.size.min + rng() * (def.size.max - def.size.min),
    color: def.color
  } as Structure;
};

export type GenerateSystemOptions = {
  starCount?: number;
  rng?: Rng;
  /** When false (default), only stars/constellations are filled — the streaming canvas seeds the rest. */
  populate?: boolean;
  settings?: SimSettings;
};

export const generateSystem = (width: number, height: number, options: GenerateSystemOptions | number = {}): SystemState => {
  const opts: GenerateSystemOptions = typeof options === 'number' ? { starCount: options } : options;
  const rng = opts.rng ?? defaultRng;
  const starCount = opts.starCount ?? 150;
  const populate = opts.populate ?? false;
  const settings = opts.settings ?? DEFAULT_SETTINGS;

  const stars = generateStars(width, height, starCount, rng);
  const constellations = generateConstellations(stars, Math.ceil(starCount / 30), rng);
  const celestialBodies = generateCelestialBodies(width, height, 0, rng);
  const fleets = populate ? generateFleets(width, height, 6, rng) : [];
  const nodes = populate ? generateNodes(width, height, 5, rng) : [];
  const telemetry = populate ? generateTelemetry(width, height, 4, rng) : [];
  const anomalies = populate ? generateAnomalies(width, height, 5, rng) : [];
  const systems = populate ? generateSystems(20, width, height, rng) : [];

  return {
    stars,
    constellations,
    celestialBodies,
    fleets,
    nodes,
    telemetry,
    anomalies,
    systems,
    structures: [],
    overlays: [],
    width,
    height,
    settings,
  };
};

const generateStars = (width: number, height: number, count: number, rng: Rng): Star[] => {
  const stars: Star[] = [];
  
  for (let i = 0; i < count; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const brightness = rng() * 0.8 + 0.2; // 0.2 to 1.0
    const size = rng() * 2 + 1; // 1 to 3
    const twinkle = rng() * 0.5 + 0.5; // 0.5 to 1.0
    
    // Color variations
    const colors = ['#ffffff', '#f0f8ff', '#e6e6fa', '#fffacd', '#ffe4e1'];
    const color = colors[Math.floor(rng() * colors.length)];
    
    stars.push({
      id: `STAR-${i}`,
      x,
      y,
      brightness,
      color,
      twinkle,
      size
    });
  }
  
  return stars;
};

const generateConstellations = (stars: Star[], count: number, rng: Rng): Constellation[] => {
  const constellations: Constellation[] = [];
  const usedStars = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    const availableStars = stars.filter(s => !usedStars.has(s.id));
    if (availableStars.length < 3) break;
    
    // Pick 3-5 stars for constellation
    const numStars = Math.floor(rng() * 3) + 3;
    const constellationStars = [];
    
    for (let j = 0; j < numStars && availableStars.length > 0; j++) {
      const randomIndex = Math.floor(rng() * availableStars.length);
      const star = availableStars.splice(randomIndex, 1)[0];
      constellationStars.push(star.id);
      usedStars.add(star.id);
    }
    
    const colors = ['#daa520', '#00bfff', '#ff6347', '#32cd32'];
    constellations.push({
      id: `CONST-${i}`,
      stars: constellationStars,
      name: ['Ursa', 'Orion', 'Cass', 'Draco', 'Lyra'][i % 5] + ` ${i + 1}`,
      color: colors[i % colors.length]
    });
  }
  
  return constellations;
};

const generateCelestialBodies = (width: number, height: number, count: number, rng: Rng): CelestialBody[] => {
  const bodies: CelestialBody[] = [];
  const types: CelestialBody['type'][] = ['planet', 'asteroid', 'moon'];
  
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rng() * types.length)];
    const x = rng() * width;
    const y = rng() * height;
    const size = type === 'planet' ? rng() * 8 + 4 : type === 'moon' ? rng() * 4 + 2 : rng() * 2 + 1;
    
    let color = '#34a853'; // Default green for planets
    if (type === 'planet') {
      const planetColors = ['#34a853', '#ff6b35', '#4a90e2', '#f5a623', '#e94b3c'];
      color = planetColors[Math.floor(rng() * planetColors.length)];
    } else if (type === 'asteroid') {
      color = '#8e8e8e';
    } else if (type === 'moon') {
      color = '#c0c0c0';
    }
    
    // Some bodies orbit
    const orbiting = rng() > 0.7;
    let orbitRadius, orbitSpeed, orbitCenterX, orbitCenterY;
    if (orbiting) {
      orbitRadius = rng() * 100 + 50;
      orbitSpeed = (rng() - 0.5) * 0.02;
      orbitCenterX = x;
      orbitCenterY = y;
    }
    
    bodies.push({
      id: `BODY-${i}`,
      x,
      y,
      type,
      size,
      color,
      orbitRadius,
      orbitSpeed,
      orbitCenterX,
      orbitCenterY
    });
  }
  
  return bodies;
};

const generateFleets = (width: number, height: number, count: number, rng: Rng): Fleet[] => {
  const fleets: Fleet[] = [];
  const types: Fleet['type'][] = ['fighter', 'cruiser', 'freighter', 'scout'];
  
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rng() * types.length)];
    const x = rng() * width;
    const y = rng() * height;
    
    // Boids-like movement parameters - faster speeds
    const vx = (rng() - 0.5) * 4; // Increased from 2 to 4
    const vy = (rng() - 0.5) * 4; // Increased from 2 to 4
    
    // Add curvature parameters for CHAOTIC paths - extreme curves
    const curvature = 0.1 + rng() * 0.4; // Increased to 0.1-0.5 range for extreme chaos
    const curveDirection = rng() > 0.5 ? 1 : -1; // Clockwise or counter-clockwise
    const curvePhase = rng() * Math.PI * 2; // Starting phase for the curve
    const spiralFactor = 0.02 + rng() * 0.08; // Increased spiral factor range

    let glyph = '►';
    let color = accentColor(); // Cyan default

    if (type === 'fighter') { glyph = '►'; color = accentColor(); }
    if (type === 'cruiser') { glyph = '█'; color = '#3b82f6'; }
    if (type === 'freighter') { glyph = '■'; color = '#10b981'; }
    if (type === 'scout') { glyph = '▸'; color = '#f59e0b'; }

    fleets.push({
      id: `FLT-${Math.floor(rng() * 1000)}`,
      x,
      y,
      vx,
      vy,
      glyph,
      color,
      history: [],
      showLabel: rng() > 0.3, // more labels by default
      type,
      formationOffset: { x: 0, y: 0 },
      curvature,
      curveDirection,
      curvePhase,
      spiralFactor,
      state: 'cruising',
      targetId: undefined,
      approachTarget: undefined
    });
  }
  return fleets;
};

export const generateSingleFleet = (x: number, y: number, rng: Rng = defaultRng): Fleet => {
  const types: Fleet['type'][] = ['fighter', 'cruiser', 'freighter', 'scout'];
  const type = types[Math.floor(rng() * types.length)];
  
  // Boids-like movement parameters - faster speeds
  const vx = (rng() - 0.5) * 4;
  const vy = (rng() - 0.5) * 4;
  
  // Add curvature parameters for CHAOTIC paths - extreme curves
  const curvature = 0.1 + rng() * 0.4;
  const curveDirection = rng() > 0.5 ? 1 : -1;
  const curvePhase = rng() * Math.PI * 2;
  const spiralFactor = 0.02 + rng() * 0.08;

  let glyph = '►';
  let color = accentColor();

  if (type === 'fighter') { glyph = '►'; color = accentColor(); }
  if (type === 'cruiser') { glyph = '█'; color = '#3b82f6'; }
  if (type === 'freighter') { glyph = '■'; color = '#10b981'; }
  if (type === 'scout') { glyph = '▸'; color = '#f59e0b'; }

  return {
    id: `FLT-${Math.floor(rng() * 1000)}`,
    x,
    y,
    vx,
    vy,
    glyph,
    color,
    history: [],
    showLabel: rng() > 0.3,
    type,
    formationOffset: { x: 0, y: 0 },
    curvature,
    curveDirection,
    curvePhase,
    spiralFactor,
    state: 'cruising',
    targetId: undefined,
    approachTarget: undefined
  };
};

const generateNodes = (width: number, height: number, count: number, rng: Rng): SystemNode[] => {
  const nodes: SystemNode[] = [];
  const nodeTypes: SystemNode['type'][] = ['star', 'planet', 'station'];
  
  for (let i = 0; i < count; i++) {
    const type = nodeTypes[Math.floor(rng() * nodeTypes.length)];
    let glyph = 'O';
    if (type === 'star') glyph = '☼';
    if (type === 'planet') glyph = '●';
    if (type === 'station') glyph = '⌂';

    nodes.push({
      id: `SYS-${Math.floor(rng() * 1000)}`,
      x: rng() * width,
      y: rng() * height,
      glyph,
      name: `SEC-${Math.floor(rng() * 100)}`,
      type,
      connections: []
    });
  }

  // Generate connections
  nodes.forEach((node, i) => {
    if (i < nodes.length - 1) {
      if (rng() > 0.5) {
        node.connections.push(nodes[i + 1].id);
      }
    }
  });

  return nodes;
};

const generateTelemetry = (width: number, height: number, count: number, rng: Rng): Telemetry[] => {
  const telemetry: Telemetry[] = [];
  const messages = ['SCANNING...', 'SIGNAL LOST', 'INCOMING', 'ANALYZING', 'SYNCING'];
  
  for (let i = 0; i < count; i++) {
    telemetry.push({
      id: `TEL-${i}`,
      x: rng() * width,
      y: rng() * height,
      text: messages[Math.floor(rng() * messages.length)],
      type: 'info',
      opacity: 1,
      age: 0,
      maxAge: 200 + rng() * 200
    });
  }
  return telemetry;
};

const ANOMALY_TEXTS = [
  "DIMENSIONAL TEAR DETECTED", "GRAVITATIONAL WAVE SURGE", "UNKNOWN ENERGY SIGNATURE",
  "TEMPORAL DISTORTION", "REALITY BREACH", "VOID ENTITY MANIFESTING",
  "QUANTUM FLUCTUATION", "SUBSPACE RUPTURE", "ENTROPY CRITICAL",
  "NON-EUCLIDEAN GEOMETRY", "PSIONIC SCREAM", "DATA CORRUPTION IMMINENT",
  "TIMELINE DIVERGENCE", "CAUSALITY VIOLATION", "ZERO POINT ENERGY SPIKE",
  "WARP SIGNATURE ANOMALOUS", "FABRIC OF SPACE WARPING", "EXOTIC MATTER DETECTED",
  "HYPERSPACE ECHO", "PROBABILITY STORM", "DARK ENERGY SPIKE",
  "CHRONITON PARTICLES", "PHASE VARIANCE DETECTED", "ANTIMATTER RESONANCE",
  "VOID WHISPERS INTENSIFYING", "SPACE-TIME FRACTURE", "TACHYON BURST",
  "PARALLEL UNIVERSE BLEED", "COSMIC STRING DETECTED", "SINGULARITY FORMING"
];

export const generateSingleAnomaly = (x: number, y: number, rng: Rng = defaultRng): Anomaly => {
  return {
    id: `ANM-${Math.floor(rng() * 10000)}`,
    x,
    y,
    type: 'signal',
    age: 0,
    text: ANOMALY_TEXTS[Math.floor(rng() * ANOMALY_TEXTS.length)]
  };
};

const generateAnomalies = (width: number, height: number, count: number, rng: Rng): Anomaly[] => {
  const anomalies: Anomaly[] = [];
  for (let i = 0; i < count; i++) {
    anomalies.push({
      id: `ANM-${i}`,
      x: rng() * width,
      y: rng() * height,
      type: 'signal',
      age: 0,
      text: ANOMALY_TEXTS[Math.floor(rng() * ANOMALY_TEXTS.length)]
    });
  }
  return anomalies;
};
