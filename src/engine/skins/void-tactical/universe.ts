/**
 * Universe packs: everything that makes the sector map belong to one world. Names,
 * factions, ship classes, structures (with their ASCII art and what they do),
 * anomalies, radio chatter, and the faint words in the background.
 *
 * The engine animates; a pack supplies the fiction. Packs are plain JSON, so an AI
 * can write one from a prompt (`universePrompt`) and the result can be pasted in.
 */
import { ASCII_ART } from './renderers/art';

export type ShipClass = 'fighter' | 'scout' | 'freighter' | 'cruiser' | 'carrier' | 'capital';
export type AnomalyStyle = 'wave' | 'rift' | 'singularity' | 'cloud' | 'temporal' | 'burst' | 'psionic' | 'exotic';
export type StructureRole = 'dock' | 'shipyard' | 'mine' | 'gate' | 'relay' | 'defense' | 'giant' | 'wreck' | 'hazard' | 'mystery';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export const SHIP_CLASSES: readonly ShipClass[] = ['fighter', 'scout', 'freighter', 'cruiser', 'carrier', 'capital'];
export const ANOMALY_STYLES: readonly AnomalyStyle[] = ['wave', 'rift', 'singularity', 'cloud', 'temporal', 'burst', 'psionic', 'exotic'];
export const STRUCTURE_ROLES: readonly StructureRole[] = ['dock', 'shipyard', 'mine', 'gate', 'relay', 'defense', 'giant', 'wreck', 'hazard', 'mystery'];
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export type PackFaction = {
  name: string;
  /** Short call-sign prefix for fleet ids, e.g. "FLT" gives "FLT-215". */
  prefix: string;
  color: string;
  /** Classes this faction flies. Defaults to all. */
  classes?: ShipClass[];
  weight?: number;
};

export type PackStructure = {
  /** Stable id; built-in art is used when it matches a built-in kind and `art` is absent. */
  kind: string;
  label: string;
  role: StructureRole;
  color: string;
  rarity: Rarity;
  art: string[];
  /** Status lines shown near this structure. */
  chatter?: string[];
};

export type PackAnomaly = { label: string; style: AnomalyStyle; color?: string };

/** A pre-named fleet, used in order before random ones (data-driven packs). */
export type PackFleet = { name: string; cls: ShipClass; faction?: number };

/** A pre-named star system, used in order as systems stream in. */
export type PackSystem = { name: string; color?: string; size?: number };

export type UniversePack = {
  id: string;
  name: string;
  tagline?: string;
  /** Brand color for the palette (hex) or a built-in palette id. */
  palette?: string;
  /** Key-light warmth, -1 cool to 1 warm. */
  warmth?: number;
  /** Color fleets by ship class (the original look) or by faction. */
  colorBy?: 'class' | 'faction';
  classColors?: Partial<Record<ShipClass, string>>;
  /** Display names for ship classes, e.g. { fighter: 'INTERCEPTOR' }. */
  ships?: Partial<Record<ShipClass, string>>;
  factions: PackFaction[];
  systemPrefix?: string;
  systems?: PackSystem[];
  fleets?: PackFleet[];
  structures: PackStructure[];
  anomalies: PackAnomaly[];
  chatter: { fleet: string[]; structure: string[]; science: string[]; mystery: string[]; system: string[] };
  /** Big faint words drifting in the background. */
  ambient: string[];
  /** Event text templates; `{target}` is replaced by a structure or system name. */
  events?: Partial<Record<'approach' | 'dock' | 'depart' | 'jump' | 'arrive' | 'launch' | 'cargo' | 'survey', string>>;
  /** What happens here: the mechanics this universe runs, with their tuning. */
  mechanics?: { use: string; with?: Record<string, unknown>; enabled?: boolean }[];
  /** How the map itself is drawn. */
  look?: UniverseLook;
  /** What is made, carried, and used here (the `economy` mechanic). */
  economy?: PackEconomy;
};

export type PackGood = { id: string; label: string; color: string };

/** Goods, and what each structure role makes and uses (units per second) and holds. */
export type PackEconomy = {
  goods: PackGood[];
  roles?: Partial<Record<StructureRole, { cap?: number; makes?: Record<string, number>; uses?: Record<string, number> }>>;
};

/** The default economy: ore from mines, fuel and parts from docks, food from habitats. */
export const DEFAULT_ECONOMY: PackEconomy = {
  goods: [
    { id: 'ore', label: 'ORE', color: '#f59e0b' },
    { id: 'fuel', label: 'FUEL', color: '#22d3ee' },
    { id: 'food', label: 'FOOD', color: '#4ade80' },
    { id: 'parts', label: 'PARTS', color: '#c4b5fd' },
  ],
  roles: {
    mine: { cap: 160, makes: { ore: 1.4 } },
    dock: { cap: 220, makes: { fuel: 0.6, parts: 0.25 }, uses: { food: 0.3, ore: 0.3 } },
    shipyard: { cap: 180, uses: { ore: 0.45, parts: 0.2 } },
    giant: { cap: 200, makes: { food: 0.9 } },
    defense: { cap: 90, uses: { fuel: 0.3 } },
    relay: { cap: 40, uses: { fuel: 0.08 } },
  },
};

export type UniverseLook = {
  /** Links between systems: straight data lanes, curved song lines, or none. */
  lanes?: 'straight' | 'curved' | 'none';
  /** Background grid: crosshair marks, survey claim squares, or none. */
  grid?: 'crosses' | 'claims' | 'none';
  /** Ordinary traffic (fleets coming and going), 0 to 2. */
  traffic?: number;
  /** How many anomalies, 0 to 2. */
  anomalies?: number;
  /** Share of systems and structures placed on far planes behind the main one, 0 to 0.8. Default 0.35. */
  depth?: number;
  /** Terrain under everything: wind-combed dust, nebula clouds, or low mist. Default none. */
  ground?: 'dust' | 'nebula' | 'mist' | 'none';
  /** Color of the ground (hex). Default: the palette accent. */
  groundColor?: string;
};

export const ANOMALY_STYLE_COLORS: Record<AnomalyStyle, string> = {
  wave: '#67e8f9',
  rift: '#e879f9',
  singularity: '#a78bfa',
  cloud: '#5eead4',
  temporal: '#fbbf24',
  burst: '#f87171',
  psionic: '#f472b6',
  exotic: '#bef264',
};

export const DEFAULT_EVENTS: Required<NonNullable<UniversePack['events']>> = {
  approach: 'APPROACHING {target}',
  dock: 'DOCKED @ {target}',
  depart: 'DEPARTING {target}',
  jump: 'JUMP · {target}',
  arrive: 'ARRIVAL VIA {target}',
  launch: 'LAUNCHED FROM {target}',
  cargo: 'CARGO RUN → {target}',
  survey: 'SURVEYING {target}',
};

const art = (kind: keyof typeof ASCII_ART) => ASCII_ART[kind];

/** The original sector map, with its words rewritten to read as one world. */
export const VOID_PACK: UniversePack = {
  id: 'void',
  name: 'The Void Sector',
  tagline: 'A quiet frontier at the edge of charted space.',
  colorBy: 'class',
  classColors: {
    fighter: '#06b6d4',
    scout: '#f59e0b',
    freighter: '#10b981',
    cruiser: '#3b82f6',
    carrier: '#818cf8',
    capital: '#e2e8f0',
  },
  ships: { capital: 'DREADNOUGHT' },
  factions: [{ name: 'SECTOR COMMAND', prefix: 'FLT', color: '#06b6d4' }],
  systemPrefix: 'SYS',
  structures: [
    { kind: 'station', label: 'STATION', role: 'dock', color: '#38bdf8', rarity: 'common', art: art('station'),
      chatter: ['HABITAT RING 98% OCCUPIED', 'LIFE SUPPORT NOMINAL', 'TRADE DOCK BUSY', 'SHUTTLE INBOUND · T-5', 'QUIET HOURS IN EFFECT', 'GRAVITY 1.0G · HOLDING'] },
    { kind: 'mining_outpost', label: 'MINING OUTPOST', role: 'mine', color: '#fbbf24', rarity: 'common', art: art('mining_outpost'),
      chatter: ['DRILL 3 AT 87%', '500T ORE PROCESSED', 'RICH VEIN · SECOND SHAFT', 'BLASTING AT 1400', 'HOLD 75% · AWAITING HAULER', 'DUST FILTERS CYCLING'] },
    { kind: 'comm_buoy', label: 'COMM BUOY', role: 'relay', color: '#a3e635', rarity: 'common', art: art('comm_buoy'),
      chatter: ['RELAY ACTIVE · SECTOR 7', 'KEYS ROTATED', 'PACKET RECEIVED', 'LATENCY 4MS', 'BEACON BROADCASTING', 'QUEUE EMPTY'] },
    { kind: 'shipyard', label: 'SHIPYARD', role: 'shipyard', color: '#60a5fa', rarity: 'common', art: art('shipyard'),
      chatter: ['FRIGATE ON THE SLIP', 'WELDING DRONES OUT', 'HULL ASSEMBLY 45%', 'DRYDOCK OCCUPIED', 'LAUNCH WINDOW OPEN', 'PAINT CREW · BAY 4'] },
    { kind: 'defense_grid', label: 'DEFENSE GRID', role: 'defense', color: '#f87171', rarity: 'uncommon', art: art('defense_grid'),
      chatter: ['TARGETING IDLE', 'PERIMETER CLEAR', 'CAPACITORS FULL', 'IFF ON AUTO', 'INTERCEPTORS STANDING BY', 'POINT DEFENSE CALIBRATED'] },
    { kind: 'jumpgate', label: 'JUMPGATE', role: 'gate', color: '#818cf8', rarity: 'uncommon', art: art('jumpgate'),
      chatter: ['THROAT STABLE', 'NEXT EXIT · SECTOR 9', 'TRANSIT QUEUE 2', 'ANCHORS LOCKED', 'ARRIVAL VECTOR CLEAR', 'STRESS 2% · WITHIN TOLERANCE'] },
    { kind: 'rogue_planet', label: 'ROGUE PLANET', role: 'hazard', color: '#94a3b8', rarity: 'uncommon', art: art('rogue_planet'),
      chatter: ['SURFACE -200C', 'NO STAR TO CALL HOME', 'CORE HEAT FADING', 'ICE SHEETS ADVANCING', 'SILENCE ON ALL BANDS'] },
    { kind: 'derelict_hulk', label: 'DERELICT HULK', role: 'wreck', color: '#94a3b8', rarity: 'uncommon', art: art('derelict_hulk'),
      chatter: ['NO LIFE SIGNS', 'GHOST SIGNAL LOOPING', 'AIRLOCK JAMMED', 'LOGS CORRUPTED', 'SALVAGE RIGHTS CONTESTED', 'INTEGRITY 15%'] },
    { kind: 'neutron_star', label: 'NEUTRON STAR', role: 'hazard', color: '#22d3ee', rarity: 'rare', art: art('neutron_star'),
      chatter: ['SPIN 500HZ', 'RADIATION LETHAL', 'PULSAR BEAM · KEEP CLEAR', 'X-RAY BURST IMMINENT', 'CLOCKS RUNNING SLOW'] },
    { kind: 'void_rift', label: 'VOID RIFT', role: 'mystery', color: '#d946ef', rarity: 'rare', art: art('void_rift'),
      chatter: ['THE TEAR IS HOLDING', 'NULL ZONE GROWING', 'A COLOR WITH NO NAME', 'WHISPERS ON CHANNEL 0', 'CONTAINMENT FAILING', 'DESTINATION UNKNOWN'] },
    { kind: 'black_hole', label: 'BLACK HOLE', role: 'hazard', color: '#7c3aed', rarity: 'rare', art: art('black_hole'),
      chatter: ['HORIZON IN VIEW', 'LIGHT DOES NOT RETURN', 'LENSING ACTIVE', 'ACCRETION DISK HOT', 'TIDAL STRESS EXTREME'] },
    { kind: 'dyson_sphere', label: 'DYSON SPHERE', role: 'giant', color: '#f59e0b', rarity: 'legendary', art: art('dyson_sphere'),
      chatter: ['STAR FULLY ENCLOSED', 'OUTPUT 100%', 'MAINTENANCE SWARM ACTIVE', 'POPULATION · TRILLIONS', 'NIGHT SIDE NEVER ENDS'] },
    { kind: 'ringworld', label: 'RINGWORLD', role: 'giant', color: '#10b981', rarity: 'legendary', art: art('ringworld'),
      chatter: ['SHADOW SQUARES ALIGNED', 'SPIN GRAVITY 1.0G', 'RIM WALLS HOLDING', 'OCEANS TEEMING', '3M EARTHS OF SURFACE'] },
    { kind: 'monolith', label: 'MONOLITH', role: 'mystery', color: '#e2e8f0', rarity: 'legendary', art: art('monolith'),
      chatter: ['ORIGIN UNKNOWN', 'RATIO 1:4:9', 'SIGNAL REPEATING', 'SURFACE PERFECTLY SMOOTH', 'IT IS WAITING'] },
    { kind: 'stellar_lifter', label: 'STELLAR LIFTER', role: 'giant', color: '#ef4444', rarity: 'legendary', art: art('stellar_lifter'),
      chatter: ['SIPHON ACTIVE', 'STAR MASS FALLING', 'MAGNETIC FUNNEL STABLE', 'TANKS FILLING', 'HEAT SHIELDS 90%'] },
    { kind: 'matrioshka_brain', label: 'MATRIOSHKA BRAIN', role: 'giant', color: '#6366f1', rarity: 'legendary', art: art('matrioshka_brain'),
      chatter: ['SIMULATIONS RUNNING', 'SHELLS NESTED · 7', 'THOUGHT AT LIGHT SPEED', 'BILLIONS DREAMING', 'QUESTION RECEIVED'] },
  ],
  anomalies: [
    { label: 'DIMENSIONAL TEAR', style: 'rift' },
    { label: 'GRAVITATIONAL WAVE SURGE', style: 'wave' },
    { label: 'UNKNOWN ENERGY SIGNATURE', style: 'exotic' },
    { label: 'TEMPORAL DISTORTION', style: 'temporal' },
    { label: 'REALITY BREACH', style: 'rift' },
    { label: 'VOID ENTITY MANIFESTING', style: 'psionic' },
    { label: 'QUANTUM FLUCTUATION', style: 'cloud' },
    { label: 'SUBSPACE RUPTURE', style: 'rift' },
    { label: 'ENTROPY CRITICAL', style: 'burst' },
    { label: 'NON-EUCLIDEAN GEOMETRY', style: 'exotic' },
    { label: 'PSIONIC SCREAM', style: 'psionic' },
    { label: 'DATA CORRUPTION', style: 'cloud' },
    { label: 'TIMELINE DIVERGENCE', style: 'temporal' },
    { label: 'CAUSALITY VIOLATION', style: 'temporal' },
    { label: 'ZERO POINT SPIKE', style: 'burst' },
    { label: 'WARP SIGNATURE', style: 'wave' },
    { label: 'SPACE WARPING', style: 'wave' },
    { label: 'EXOTIC MATTER', style: 'exotic' },
    { label: 'HYPERSPACE ECHO', style: 'wave' },
    { label: 'PROBABILITY STORM', style: 'cloud' },
    { label: 'DARK ENERGY SPIKE', style: 'burst' },
    { label: 'CHRONITON PARTICLES', style: 'temporal' },
    { label: 'PHASE VARIANCE', style: 'cloud' },
    { label: 'ANTIMATTER RESONANCE', style: 'burst' },
    { label: 'VOID WHISPERS', style: 'psionic' },
    { label: 'SPACE-TIME FRACTURE', style: 'rift' },
    { label: 'TACHYON BURST', style: 'burst' },
    { label: 'PARALLEL BLEED', style: 'exotic' },
    { label: 'COSMIC STRING', style: 'rift' },
    { label: 'SINGULARITY FORMING', style: 'singularity' },
    { label: 'GRAVITY WELL COLLAPSE', style: 'singularity' },
  ],
  chatter: {
    fleet: ['WEAPONS COLD', 'SHIELDS HARMONIC', 'FTL SPOOLING', 'CLAMPS ENGAGED', 'REFUELING', 'CARGO · ALLOYS', 'PATROL GAMMA-9', 'INTERCEPT PLOTTED', 'RUNNING DARK', 'HULL 100%', 'REQUESTING LANE 4', 'ESCORT IN POSITION'],
    structure: ['DOCKING BAY OPEN', 'REFINERY ACTIVE', 'CARGO TRANSFER 45%', 'MAINTENANCE DUE', 'REACTOR STABLE', 'AIRLOCK CYCLING', 'VISITOR PERMIT GRANTED'],
    science: ['ORBITAL DECAY NEGLIGIBLE', 'RADIATION SPIKE', 'GRAVITY WELL DEEP', 'SPECTRUM · AU/FE', 'TECTONIC SHIFT', 'ATMOSPHERE N2/O2', 'TIME DILATION 0.04%', 'BIOSPHERE PRE-INDUSTRIAL'],
    mystery: ['DISTRESS CALL · NO ORIGIN', 'RUINS SCAN POSITIVE', 'CRYPTIC TRANSMISSION', 'BIOSIGNS ANOMALOUS', 'RELIC WARMING UP', 'DERELICT FOUND', 'SOMETHING ANSWERED', 'THEY ARE WATCHING'],
    system: ['UPLINK ESTABLISHED', 'ENCRYPTION ROTATED', 'DATA STREAM STABLE', 'HANDSHAKE COMPLETE', 'PING 12MS', 'CHART UPDATED'],
  },
  ambient: [
    'PICKET 4 HOLDING · NO CONTACT',
    'BEACON KESTREL HAS GONE DARK',
    'LANE 9 OPEN · TOLL WAIVED',
    'LAST TRANSMISSION 00:41:07 AGO',
    'SALVAGE RIGHTS CONTESTED',
    'QUIET WATCH · ALL STATIONS',
    'CARGO MANIFEST DOES NOT MATCH',
    'DRIFT CORRECTION +0.003°',
    'GRAVE ORBIT · DO NOT HAIL',
    'RELIEF CONVOY SIX HOURS OUT',
    'SECTOR 7-GAMMA-9 · QUARANTINE LIFTED',
    'SOMETHING ANSWERED ON CHANNEL 0',
  ],
  mechanics: [
    { use: 'economy', with: { convoys: 5 } },
    { use: 'gates', with: { spacing: 4, disputes: 0.15 } },
    { use: 'relays', with: { chatter: 0.6 } },
    { use: 'skirmish', with: { rate: 0.6, raiders: 4, weapon: 'tracers', name: 'RAIDERS' } },
    { use: 'police', with: { wing: 3 } },
    { use: 'events', with: { rate: 0.6 } },
  ],
  look: { lanes: 'straight', grid: 'crosses', traffic: 1 },
};

// ---- registry ------------------------------------------------------------------------------

/** What a gallery or picker needs to show a universe without loading it. */
export type UniverseMeta = Pick<UniversePack, 'id' | 'name' | 'tagline' | 'palette' | 'warmth'>;

const registry = new Map<string, UniversePack>();
const loaders = new Map<string, { meta: UniverseMeta; load: () => Promise<unknown> }>();
const order: string[] = [];

/** Register a full pack (available immediately). */
export function registerUniverse(pack: UniversePack): UniversePack {
  registry.set(pack.id, pack);
  if (!order.includes(pack.id)) order.push(pack.id);
  return pack;
}

/**
 * Register a universe that loads on demand. `load` imports the module that registers
 * the pack (and its mechanics). Until then only `meta` is known.
 */
export function registerUniverseLoader(meta: UniverseMeta, load: () => Promise<unknown>): void {
  loaders.set(meta.id, { meta, load });
  if (!order.includes(meta.id)) order.push(meta.id);
}

/** The full pack, if it is loaded. */
export const getUniverse = (id: string): UniversePack | undefined => registry.get(id);

/** Every known universe, loaded or not, in registration order. */
export const listUniverses = (): UniverseMeta[] =>
  order.map((id) => {
    const p = registry.get(id);
    return p ? { id: p.id, name: p.name, tagline: p.tagline, palette: p.palette, warmth: p.warmth } : loaders.get(id)!.meta;
  });

/** True when the pack is available now (built in, already loaded, or unknown and so the default). */
export const isUniverseReady = (id: string | undefined): boolean => !id || registry.has(id) || !loaders.has(id);

/** Load a universe's pack and mechanics. Resolves to the pack (or undefined for an unknown id). */
export async function loadUniverse(id: string): Promise<UniversePack | undefined> {
  if (registry.has(id)) return registry.get(id);
  const l = loaders.get(id);
  if (!l) return undefined;
  await l.load();
  return registry.get(id);
}

registerUniverse(VOID_PACK);
// The other built-ins load on demand; their names and colors are known up front.
registerUniverseLoader(
  { id: 'saltwind', name: 'Saltwind Reach', tagline: 'Ore, dust, and debt at the end of the old road.', palette: '#f59e0b', warmth: 0.5 },
  () => import('./packs/saltwind'),
);
registerUniverseLoader(
  { id: 'choir', name: 'Choir of Hollow Stars', tagline: 'Every star here was emptied, and something lives inside.', palette: '#a78bfa', warmth: -0.4 },
  () => import('./packs/choir'),
);
registerUniverseLoader(
  { id: 'siege', name: 'The Long Siege', tagline: 'Forty years on the same front. Neither side remembers why.', palette: '#cbd5e1', warmth: 0.15 },
  () => import('./packs/siege'),
);

// ---- validation --------------------------------------------------------------------------------

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const clean = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max) : '';
const lines = (v: unknown, max: number, len: number): string[] =>
  Array.isArray(v) ? v.map((x) => clean(x, len)).filter(Boolean).slice(0, max) : [];
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback);
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T =>
  typeof v === 'string' && (values as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : fallback;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32) || 'thing';

/** ASCII art rows: printable ASCII and a few box glyphs only, at most 7 rows by 14 columns. */
function cleanArt(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const rows = v
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.replace(/[^\x20-\x7e·°∿~]/g, ' ').slice(0, 14).replace(/\s+$/, ''))
    .slice(0, 7);
  while (rows.length && !rows[0].trim()) rows.shift();
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
  return rows;
}

export type UniverseValidation = { pack: UniversePack; errors: string[]; warnings: string[] };

/**
 * Turn untrusted JSON (for example, what an AI returned) into a usable pack. Never
 * throws: problems become `errors` (the pack is unusable) or `warnings` (a default
 * was substituted).
 */
export function validateUniverse(raw: unknown): UniverseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let input = raw;
  if (typeof input === 'string') {
    const text = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      input = JSON.parse(text);
    } catch {
      return { pack: VOID_PACK, errors: ['Not valid JSON. Paste only the JSON object the AI returned.'], warnings };
    }
  }
  if (!input || typeof input !== 'object') return { pack: VOID_PACK, errors: ['Expected a JSON object.'], warnings };
  const r = input as Record<string, any>;

  const name = clean(r.name, 40) || 'UNNAMED UNIVERSE';
  const factions: PackFaction[] = (Array.isArray(r.factions) ? r.factions : []).slice(0, 5).map((f: any, i: number) => ({
    name: clean(f?.name, 28) || `FACTION ${i + 1}`,
    prefix: clean(f?.prefix, 4).replace(/[^A-Z0-9]/g, '') || `F${i + 1}`,
    color: color(f?.color, ['#22d3ee', '#f59e0b', '#a78bfa', '#4ade80', '#f87171'][i]),
    classes: Array.isArray(f?.classes) ? f.classes.map((c: unknown) => oneOf(c, SHIP_CLASSES, 'fighter')) : undefined,
    weight: typeof f?.weight === 'number' && f.weight > 0 ? Math.min(10, f.weight) : 1,
  }));
  if (!factions.length) {
    warnings.push('No factions; using one default faction.');
    factions.push({ name: 'UNKNOWN', prefix: 'UNK', color: '#22d3ee' });
  }

  const seen = new Set<string>();
  const structures: PackStructure[] = (Array.isArray(r.structures) ? r.structures : []).slice(0, 24).flatMap((s: any) => {
    const label = clean(s?.label ?? s?.name, 24);
    if (!label) return [];
    let kind = slug(typeof s?.kind === 'string' ? s.kind : label);
    while (seen.has(kind)) kind += '_';
    seen.add(kind);
    const builtIn = (ASCII_ART as Record<string, string[]>)[kind];
    const artRows = cleanArt(s?.art);
    return [{
      kind,
      label,
      role: oneOf(s?.role, STRUCTURE_ROLES, 'dock'),
      color: color(s?.color, '#94a3b8'),
      rarity: oneOf(s?.rarity, RARITIES, 'common'),
      art: artRows.length ? artRows : builtIn ?? ['  ___  ', ' |   | ', ' | o | ', ' |___| '],
      chatter: lines(s?.chatter, 10, 30),
    }];
  });
  if (!structures.length) errors.push('No structures. A universe needs at least a dock, a shipyard, a mine, and a gate.');
  for (const role of ['dock', 'shipyard', 'mine'] as const) {
    if (structures.length && !structures.some((s) => s.role === role)) warnings.push(`No "${role}" structure; ships will have fewer places to go.`);
  }

  const anomalies: PackAnomaly[] = (Array.isArray(r.anomalies) ? r.anomalies : []).slice(0, 40).flatMap((a: any) => {
    const label = clean(typeof a === 'string' ? a : a?.label, 28);
    if (!label) return [];
    const style = oneOf(typeof a === 'string' ? undefined : a?.style, ANOMALY_STYLES, ANOMALY_STYLES[label.length % ANOMALY_STYLES.length]);
    return [{ label, style, color: typeof a === 'object' && a?.color ? color(a.color, ANOMALY_STYLE_COLORS[style]) : undefined }];
  });
  if (!anomalies.length) warnings.push('No anomalies; the map will have none.');

  const c = r.chatter && typeof r.chatter === 'object' ? r.chatter : {};
  const chatter = {
    fleet: lines(c.fleet, 24, 30),
    structure: lines(c.structure, 24, 30),
    science: lines(c.science, 24, 30),
    mystery: lines(c.mystery, 24, 30),
    system: lines(c.system, 24, 30),
  };
  for (const [k, v] of Object.entries(chatter)) if (!v.length) warnings.push(`No "${k}" chatter.`);

  const ambient = lines(r.ambient, 16, 38);
  if (!ambient.length) warnings.push('No ambient lines; the background words will be blank.');

  const ships: UniversePack['ships'] = {};
  if (r.ships && typeof r.ships === 'object') {
    for (const k of SHIP_CLASSES) {
      const v = clean(r.ships[k], 16);
      if (v) ships[k] = v;
    }
  }

  const pack: UniversePack = {
    id: slug(typeof r.id === 'string' ? r.id : name).replace(/_/g, '-'),
    name,
    tagline: typeof r.tagline === 'string' ? r.tagline.slice(0, 90) : undefined,
    palette: typeof r.palette === 'string' && (HEX.test(r.palette.trim()) || /^[a-z-]+$/.test(r.palette)) ? r.palette.trim() : undefined,
    warmth: typeof r.warmth === 'number' ? Math.max(-1, Math.min(1, r.warmth)) : undefined,
    colorBy: r.colorBy === 'class' ? 'class' : 'faction',
    classColors: r.classColors && typeof r.classColors === 'object'
      ? Object.fromEntries(SHIP_CLASSES.flatMap((k) => (typeof r.classColors[k] === 'string' && HEX.test(r.classColors[k]) ? [[k, r.classColors[k]]] : [])))
      : undefined,
    ships,
    factions,
    systemPrefix: clean(r.systemPrefix, 8) || 'SYS',
    systems: Array.isArray(r.systems)
      ? r.systems.slice(0, 60).flatMap((s: any) => {
          const n = clean(typeof s === 'string' ? s : s?.name, 18);
          return n ? [{ name: n, color: s?.color ? color(s.color, '#ffd700') : undefined, size: typeof s?.size === 'number' ? s.size : undefined }] : [];
        })
      : undefined,
    fleets: Array.isArray(r.fleets)
      ? r.fleets.slice(0, 60).flatMap((f: any) => {
          const n = clean(f?.name, 22);
          if (!n) return [];
          const faction = typeof f?.faction === 'number' && f.faction >= 0 && f.faction < factions.length ? Math.floor(f.faction) : undefined;
          return [{ name: n, cls: oneOf(f?.cls, SHIP_CLASSES, 'fighter'), faction }];
        })
      : undefined,
    structures: structures.length ? structures : VOID_PACK.structures,
    anomalies,
    chatter,
    ambient,
    events: r.events && typeof r.events === 'object'
      ? Object.fromEntries(Object.entries(r.events).flatMap(([k, v]) => (k in DEFAULT_EVENTS && typeof v === 'string' ? [[k, clean(v, 30)]] : [])))
      : undefined,
    // Mechanic ids are checked against the registry when the world starts; unknown ones are skipped.
    mechanics: Array.isArray(r.mechanics)
      ? r.mechanics.slice(0, 12).flatMap((m: any) => {
          const use = typeof m === 'string' ? m : m?.use;
          if (typeof use !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(use)) return [];
          return [{ use, with: m?.with && typeof m.with === 'object' ? m.with : undefined, enabled: m?.enabled === false ? false : undefined }];
        })
      : undefined,
    look: r.look && typeof r.look === 'object'
      ? {
          lanes: oneOf(r.look.lanes, ['straight', 'curved', 'none'] as const, 'straight'),
          grid: oneOf(r.look.grid, ['crosses', 'claims', 'none'] as const, 'crosses'),
          traffic: typeof r.look.traffic === 'number' ? Math.max(0, Math.min(2, r.look.traffic)) : undefined,
          anomalies: typeof r.look.anomalies === 'number' ? Math.max(0, Math.min(2, r.look.anomalies)) : undefined,
          depth: typeof r.look.depth === 'number' ? Math.max(0, Math.min(0.8, r.look.depth)) : undefined,
          ground: r.look.ground === undefined ? undefined : oneOf(r.look.ground, ['dust', 'nebula', 'mist', 'none'] as const, 'none'),
          groundColor: typeof r.look.groundColor === 'string' ? color(r.look.groundColor, '#94a3b8') : undefined,
        }
      : undefined,
    economy: validateEconomy(r.economy),
  };
  return { pack, errors, warnings };
}

/** Keep an AI-written economy only if it names some goods; clamp every rate. */
function validateEconomy(raw: unknown): PackEconomy | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { goods?: unknown; roles?: unknown };
  const goods: PackGood[] = (Array.isArray(r.goods) ? r.goods : []).slice(0, 6).flatMap((g: any) => {
    const id = typeof g?.id === 'string' ? slug(g.id) : typeof g?.label === 'string' ? slug(g.label) : '';
    return id ? [{ id, label: clean(g.label ?? id, 10) || id.toUpperCase(), color: color(g.color, '#94a3b8') }] : [];
  });
  if (!goods.length) return undefined;
  const known = new Set(goods.map((g) => g.id));
  const rates = (v: unknown) =>
    v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).flatMap(([k, n]) => (known.has(slug(k)) && typeof n === 'number' ? [[slug(k), Math.max(0, Math.min(5, n))]] : [])))
      : undefined;
  const roles: PackEconomy['roles'] = {};
  if (r.roles && typeof r.roles === 'object') {
    for (const [role, spec] of Object.entries(r.roles as Record<string, any>)) {
      if (!STRUCTURE_ROLES.includes(role as StructureRole) || !spec || typeof spec !== 'object') continue;
      roles[role as StructureRole] = { cap: typeof spec.cap === 'number' ? Math.max(10, Math.min(400, spec.cap)) : undefined, makes: rates(spec.makes), uses: rates(spec.uses) };
    }
  }
  return { goods, roles: Object.keys(roles).length ? roles : undefined };
}

/** Resolve the pack for a mount: an inline pack object wins over a registered id. */
export function resolveUniverse(options: { universe?: unknown; pack?: unknown } | undefined): UniversePack {
  const inline = options?.pack;
  if (inline && typeof inline === 'object') {
    const { pack, errors } = validateUniverse(inline);
    if (!errors.length) return pack;
  }
  if (typeof options?.universe === 'string') return getUniverse(options.universe) ?? VOID_PACK;
  return VOID_PACK;
}

// ---- the prompt ------------------------------------------------------------------------------

/** A mechanic as the prompt describes it. */
export type PromptMechanic = { id: string; description: string; params: string[] };

/**
 * A prompt to paste into any capable AI. It returns a universe pack for `subject`
 * (a book, a film, a game, a TTRPG setting, or a few lines about your own world).
 * Pass the registered mechanics so the AI can choose what happens there.
 */
export function universePrompt(subject: string, mechanics: PromptMechanic[] = []): string {
  const what = subject.trim() || 'an original setting of your choice';
  const menu = mechanics.map((m) => `  ${m.id}: ${m.description} (params: ${m.params.join(', ')})`).join('\n');
  return `Write a universe pack (JSON) for a living tactical star map of: ${what}.
Write it as the instrument its inhabitants would use: their names, factions, places, terse radio talk. Specific, never generic. Not space-faring? Translate (kingdoms → factions, cities → docks).

Return only JSON:
- id, name, tagline, palette (hex), warmth (-1 cold..1 warm)
- ships: display names for fighter, scout, freighter, cruiser, carrier, capital
- factions: 2-4 {name, prefix (2-4 letters), color (hex, bright), classes}
- systemPrefix (≤8 chars)
- structures: 10-14 {label, role, color, rarity, art, chatter (4-6 lines)}. role: dock|shipyard|mine|gate|relay|defense|giant|wreck|hazard|mystery (include dock, shipyard, mine, gate). art: 3-6 rows of plain ASCII, ≤12 chars, bold silhouette.
- anomalies: 10-16 {label, style: wave|rift|singularity|cloud|temporal|burst|psionic|exotic}
- chatter: {fleet, structure, science, mystery, system}, 8-12 lines each, ≤30 chars
- ambient: 8-12 haunting fragments, ≤34 chars
- mechanics: 2-4 of what HAPPENS here, as {use, with:{params}}. This is what makes the world feel different, so choose for the story:
${menu || '  (see the studio for the list)'}
- look: {lanes: straight|curved|none, grid: crosses|claims|none, traffic 0-2, anomalies 0-2, depth 0-0.8, ground: dust|nebula|mist|none, groundColor}
- economy (if goods move here; for the economy mechanic): {goods: 3-5 {id, label, color}, roles: {mine: {makes: {ore: 1.4}}, dock: {makes: {...}, uses: {...}}, ...}}
All text uppercase.`;
}
