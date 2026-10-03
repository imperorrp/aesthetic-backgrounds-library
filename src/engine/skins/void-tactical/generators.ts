/**
 * Background Generators Module
 *
 * @description Seeded generators for the sector map: the star field, star systems,
 * structures, and anomalies. Content (names, kinds, art, colors) comes from the
 * active universe pack; geometry and randomness come from the seeded streams.
 * @module
 */

import type { SystemState, Telemetry, Anomaly, Star, Constellation, StarSystem, Planet, Structure, SimSettings } from './types';
import { createRng, type Rng } from '../../rng';
import type { Palette } from '../../palette';
import { ANOMALY_STYLE_COLORS, VOID_PACK, type Rarity, type StructureRole, type UniversePack } from './universe';

const DEFAULT_SETTINGS: SimSettings = {
  labelDensity: 'low',
  overlaySpawnRate: 0.012,
  maxOverlays: 2,
};

const accentColor = (palette?: Palette) => palette?.accent ?? '#06b6d4';

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 0.22, uncommon: 0.1, rare: 0.05, legendary: 0.025 };

const planetsFor = (rng: Rng, palette?: Palette): Planet[] => {
  const planetCount = 1 + Math.floor(rng() * 5);
  const planets: Planet[] = [];
  for (let p = 0; p < planetCount; p++) {
    const orbitR = 15 + p * (10 + rng() * 30);
    planets.push({
      id: `p${p}`,
      type: p === 0 && rng() < 0.15 ? 'asteroid' : rng() < 0.2 ? 'moon' : 'planet',
      radius: 1.5 + rng() * 3,
      orbitRadius: orbitR,
      orbitSpeed: (0.0005 + rng() * 0.001) * (rng() < 0.5 ? 1 : -1),
      orbitPhase: rng() * Math.PI * 2,
      color: ['#34a853', accentColor(palette), '#ffb703', '#ff4500'][Math.floor(rng() * 4)],
    });
  }
  return planets;
};

/** A star system. `index` picks the pack's next named system, if it has a list. */
export const generateSingleSystem = (x: number, y: number, rng: Rng, palette?: Palette, pack: UniversePack = VOID_PACK, index = 0): StarSystem => {
  const planets = planetsFor(rng, palette);
  const number = Math.floor(rng() * 10000).toString().padStart(4, '0');
  const starColor = ['#ffd700', '#ffddaa', '#fff2a6'][Math.floor(rng() * 3)];
  const starRadius = 2 + rng() * 3;
  const named = pack.systems?.length ? pack.systems[index % pack.systems.length] : undefined;
  return {
    id: `sys-${number}-${index}`,
    name: named?.name ?? `${pack.systemPrefix ?? 'SYS'} ${number}`,
    x,
    y,
    starColor: named?.color ?? starColor,
    starRadius: named?.size ? Math.max(2, Math.min(7, named.size)) : starRadius,
    planets,
    structures: [],
  };
};

/**
 * A structure from the pack, weighted by rarity. Kinds seen recently are damped for
 * variety, and the roles that give fleets somewhere to go (dock, mine, shipyard,
 * gate) are boosted when they have not appeared lately.
 */
export const generateSingleStructure = (
  x: number,
  y: number,
  recentKinds: string[],
  rng: Rng,
  pack: UniversePack = VOID_PACK,
  recentRoles: StructureRole[] = [],
  id = 0,
): Structure => {
  const essentials: StructureRole[] = ['dock', 'mine', 'shipyard', 'gate'];
  const defs = pack.structures.length ? pack.structures : VOID_PACK.structures;
  const weights = defs.map((def) => {
    let w = RARITY_WEIGHT[def.rarity] ?? 0.1;
    if (recentKinds.includes(def.kind)) w *= 0.35;
    if (essentials.includes(def.role) && recentRoles.length >= 4 && !recentRoles.includes(def.role)) w *= 3;
    return w;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  let def = defs[0];
  for (let i = 0; i < defs.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      def = defs[i];
      break;
    }
  }
  const sizeByRarity: Record<Rarity, [number, number]> = { common: [3, 8], uncommon: [6, 12], rare: [10, 20], legendary: [18, 30] };
  const [lo, hi] = sizeByRarity[def.rarity] ?? [4, 8];
  return {
    id: `${def.kind}-${id}`,
    kind: def.kind,
    label: def.label,
    role: def.role,
    rarity: def.rarity,
    art: def.art,
    chatter: def.chatter ?? [],
    x,
    y: y + (rng() - 0.5) * 60,
    size: lo + rng() * (hi - lo),
    color: def.color,
    spin: rng() * Math.PI * 2,
    nextAction: 0,
  };
};

export type GenerateSystemOptions = {
  starCount?: number;
  /** Seeded generator. Defaults to a fixed seed so output is reproducible even when omitted. */
  rng?: Rng;
  settings?: SimSettings;
  palette?: Palette;
  universe?: UniversePack;
  /** @deprecated Ignored; the streaming world spawns everything else. */
  populate?: boolean;
};

/** The empty world: stars and constellations only. The streaming sim fills the rest. */
export const generateSystem = (width: number, height: number, options: GenerateSystemOptions | number = {}): SystemState => {
  const opts: GenerateSystemOptions = typeof options === 'number' ? { starCount: options } : options;
  const rng = opts.rng ?? createRng('void-tactical');
  const starCount = opts.starCount ?? 150;
  const settings = opts.settings ?? DEFAULT_SETTINGS;

  const stars = generateStars(width, height, starCount, rng);
  const constellations = generateConstellations(stars, Math.ceil(starCount / 30), rng);

  return {
    stars,
    constellations,
    celestialBodies: [],
    fleets: [],
    nodes: [],
    telemetry: [],
    anomalies: [],
    systems: [],
    structures: [],
    overlays: [],
    width,
    height,
    settings,
    universe: opts.universe ?? VOID_PACK,
    tension: 0.5,
    lock: null,
    seq: 0,
  };
};

const generateStars = (width: number, height: number, count: number, rng: Rng): Star[] => {
  const stars: Star[] = [];
  const colors = ['#ffffff', '#f0f8ff', '#e6e6fa', '#fffacd', '#ffe4e1'];
  for (let i = 0; i < count; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const brightness = rng() * 0.8 + 0.2;
    const size = rng() * 2 + 1;
    const twinkle = rng() * 0.5 + 0.5;
    const color = colors[Math.floor(rng() * colors.length)];
    stars.push({ id: `STAR-${i}`, x, y, brightness, color, twinkle, size });
  }
  return stars;
};

const generateConstellations = (stars: Star[], count: number, rng: Rng): Constellation[] => {
  const constellations: Constellation[] = [];
  const usedStars = new Set<string>();
  for (let i = 0; i < count; i++) {
    const availableStars = stars.filter((s) => !usedStars.has(s.id));
    if (availableStars.length < 3) break;
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
      color: colors[i % colors.length],
    });
  }
  return constellations;
};

export const generateTelemetry = (width: number, height: number, count: number, rng: Rng): Telemetry[] => {
  const messages = ['SCANNING...', 'SIGNAL LOST', 'INCOMING', 'ANALYZING', 'SYNCING'];
  return Array.from({ length: count }, (_, i) => ({
    id: `TEL-${i}`,
    x: rng() * width,
    y: rng() * height,
    text: messages[Math.floor(rng() * messages.length)],
    type: 'info' as const,
    opacity: 1,
    age: 0,
    maxAge: 200 + rng() * 200,
  }));
};

/** An anomaly from the pack; `recent` labels are avoided so the map does not repeat itself. */
export const generateSingleAnomaly = (x: number, y: number, rng: Rng, pack: UniversePack = VOID_PACK, t = 0, recent: string[] = [], id = 0): Anomaly => {
  const defs = pack.anomalies.length ? pack.anomalies : VOID_PACK.anomalies;
  let def = defs[Math.floor(rng() * defs.length)];
  for (let i = 0; i < 4 && recent.includes(def.label) && defs.length > recent.length; i++) def = defs[Math.floor(rng() * defs.length)];
  return {
    id: `ANM-${id}`,
    x,
    y,
    type: def.style,
    style: def.style,
    color: def.color ?? ANOMALY_STYLE_COLORS[def.style],
    seed: rng(),
    born: t,
    age: 0,
    text: def.label,
  };
};
