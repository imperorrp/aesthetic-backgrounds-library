/**
 * Leylines, the realm: a land seen from high up, the lines of power across it, and the orders
 * of mages who build on them. No DOM.
 *
 * The land is wider than the screen (the camera pans over it): hills, forests, lakes or sea,
 * mountains, villages with their fields, the ruins of an older age, and stone circles on the
 * wells where the ley lines meet. Each seed draws its land (a blend of isles, steppe, forest,
 * desert, tundra, marsh, mountains) and a cast (kit/compose): the weather, what can tear the
 * world open, what flies over it, and what walks it.
 *
 * Orders of mages (two to six), each with its colours, its school (fire, frost, storm, nature,
 * shadow, light, stone) and so its spells and its summons, its tower style, its archmage, and
 * a temper. Their mages are out on the land all the time, walking the roads and the lines:
 * channelling at their wells, going out to claim free wells and raising towers on them stone
 * by stone, raising their towers higher, blessing villages, searching ruins for artifacts,
 * summoning guardians. Rival mages who meet duel; orders at war send war parties with their
 * summoned creatures to besiege a tower until its ward breaks and it falls, and its well is
 * free to be claimed again. At the moons' convergence an order gathers in a circle for a
 * great ritual. Storms strike the towers; a dragon comes; a comet falls; a rift opens and
 * pours out demons until the orders close it.
 *
 * Space: world px. The director (kit) paces the big moments and points the camera.
 */
import { forkRng, type Rng } from '../../../rng';
import { createBus, type Bus } from '../../../sim/bus';
import type { Noise2D } from '../../../noise';
import { compose, createDirector, createGenome, ARCS, WORLD_SCALE, type Director, type Genome, type SystemDef } from '../../../kit';
import { placeName, titled } from '../names';

export type School = 'fire' | 'frost' | 'storm' | 'nature' | 'shadow' | 'light' | 'stone';
export const SCHOOLS: School[] = ['fire', 'frost', 'storm', 'nature', 'shadow', 'light', 'stone'];
export const SPELL_COLOR: Record<School, string> = { fire: '#fb923c', frost: '#7dd3fc', storm: '#c7d2fe', nature: '#86efac', shadow: '#c084fc', light: '#fde68a', stone: '#e7c9a0' };
export type TowerStyle = 'spire' | 'ziggurat' | 'crystal' | 'tree' | 'obelisk';
const STYLE_OF: Record<School, TowerStyle[]> = { fire: ['ziggurat', 'spire'], frost: ['crystal', 'spire'], storm: ['spire', 'crystal'], nature: ['tree'], shadow: ['obelisk', 'spire'], light: ['spire', 'crystal'], stone: ['ziggurat', 'obelisk'] };
export type Land = 'isles' | 'steppe' | 'forest' | 'desert' | 'tundra' | 'marsh' | 'mountains';
const LANDS: Land[] = ['isles', 'steppe', 'forest', 'desert', 'tundra', 'marsh', 'mountains'];
export const LAND_NAMES: Record<Land, string> = { isles: 'THE SHATTERED ISLES', steppe: 'THE GREAT STEPPE', forest: 'THE ELDERWOOD', desert: 'THE GLASS DESERT', tundra: 'THE WHITE WASTE', marsh: 'THE DROWNED FENS', mountains: 'THE HIGH PASSES' };

export type Site = { id: number; kind: 'well' | 'village' | 'ruin'; x: number; y: number; name: string; links: number[]; tower: Tower | null; owner: number; claimT: number; prosper: number; burnt: number; searched: number; cottages: [number, number, number][] };
export type Edge = { a: number; b: number; ley: boolean; flow: number; pulse: number };
export type Order = {
  id: number; name: string; robe: string; trim: string; school: School; style: TowerStyle; archmage: string; temper: 'ambitious' | 'scholarly' | 'zealous';
  alive: boolean; mana: number; relation: number[]; war: number; warT0: number; artifacts: string[]; founded: number; capital: number; age: number;
};
export type Tower = { id: number; site: number; order: number; level: number; build: number; hp: number; hpMax: number; ward: number; charge: number; name: string; t0: number; fell: number; cd: number };
export type UnitKind = 'archmage' | 'mage' | 'apprentice' | 'villager' | 'cart' | 'elemental' | 'demon' | 'guardian' | 'dragon' | 'pilgrim' | 'beast';
export type Task = 'idle' | 'channel' | 'claim' | 'build' | 'raise' | 'bless' | 'explore' | 'war' | 'ritual' | 'home' | 'fight' | 'trade' | 'tribute' | 'close' | 'wander' | 'hunt';
export type Unit = {
  id: number; kind: UnitKind; order: number; school: School | null; x: number; y: number; tx: number; ty: number; path: number[]; at: number;
  task: Task; target: number; t0: number; until: number; hp: number; hpMax: number; cd: number; alive: boolean; deadAt: number; facing: 1 | -1; anim: number;
  flying: boolean; name: string; casting: number; foe: number; seed: number; carry: boolean;
};
export type Spell = { id: number; kind: 'fireball' | 'bolt' | 'lightning' | 'lance' | 'vine' | 'orb' | 'beam' | 'spike' | 'breath' | 'meteor'; school: School | null; x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; color: string; from: number; to: number; dmg: number; seed: number; hitTower: number };
export type Mark = { kind: 'scorch' | 'frost' | 'bloom' | 'crater' | 'blight' | 'ash'; x: number; y: number; r: number; t0: number; dur: number; seed: number };
export type Fx = { kind: 'flash' | 'spark' | 'ring' | 'rubble' | 'burst' | 'smoke' | 'rune' | 'glint' | 'teleport' | 'build'; x: number; y: number; t0: number; dur: number; r: number; color: string; seed: number };
export type Label = { text: string; x: number; y: number; color: string; t0: number; dur: number };
export type Storm = { x: number; y: number; vx: number; vy: number; r: number; t0: number; dur: number; next: number };
export type Rift = { site: number; x: number; y: number; r: number; t0: number; closing: number; closed: number; next: number };
export type Ritual = { order: number; site: number; t0: number; dur: number; kind: 'aurora' | 'starfall' | 'colossus' | 'grove' | 'wardstone' | 'phoenix' | 'eclipse'; done: boolean };

export type RealmOptions = { land: string; orders: number; storms: number; rifts: number; scale: number; camera?: string };

export type RealmWorld = {
  t: number; W: number; H: number; GW: number; GH: number; bus: Bus; director: Director; land: Land; blend: Record<Land, number>; name: string;
  cast: string[]; castIds: string[];
  CELL: number; cols: number; rows: number; height: Float32Array; water: Uint8Array; forest: Float32Array; burnt: Float32Array; frost: Float32Array; blight: Float32Array; dirtyCells: number[];
  sites: Site[]; edges: Edge[]; orders: Order[]; towers: Tower[]; units: Unit[]; spells: Spell[]; marks: Mark[]; fx: Fx[]; labels: Label[];
  storms: Storm[]; rifts: Rift[]; rituals: Ritual[]; comet: { x: number; y: number; t0: number; tx: number; ty: number; landed: boolean } | null;
  chronicle: { t: number; text: string }[];
  day: number; moons: number; converging: boolean; age: number;
  cellAt(x: number, y: number): number;
  wet(x: number, y: number): boolean;
  step(dt: number): void;
  counts(): Record<string, number>;
};

type CastCtx = { land: Land; storms: number; rifts: number };
type D = SystemDef<CastCtx, undefined>;
const stub = (id: string) => () => ({ id });
const def = (id: string, label: string, tags: string[], weight: D['weight']): D => ({ id, label, tags, weight, create: stub(id) });
/** What each seed's realm holds, beyond its orders. */
export const REALM_CAST: D[] = [
  def('storms', 'arcane storms', ['weather'], (_g, c) => (c.storms > 0 ? 1.5 * c.storms : 0)),
  def('rains', 'long rains', ['weather'], (_g, c) => (c.land === 'desert' ? 0 : 0.6)),
  def('stillair', 'still air', ['weather'], 0.4),
  def('rift', 'a rift to the outer dark', ['calamity'], (_g, c) => (c.rifts > 0 ? 1.4 * c.rifts : 0)),
  def('comet', 'a falling star', ['calamity'], 0.8),
  def('blight', 'a blight from the old ruins', ['calamity'], (_g, c) => (c.rifts > 0 ? 0.7 : 0)),
  def('dragon', 'a dragon', ['sky'], 1.2),
  def('griffons', 'griffon riders', ['sky'], 0.6),
  def('clearsky', 'empty skies', ['sky'], 0.5),
  def('herds', 'great herds', ['beasts'], (_g, c) => (c.land === 'steppe' || c.land === 'tundra' ? 1.6 : 0.6)),
  def('wolves', 'wolves', ['beasts'], (_g, c) => (c.land === 'forest' || c.land === 'tundra' ? 1.4 : 0.6)),
  def('giants', 'giants from the mountains', ['beasts'], (_g, c) => (c.land === 'mountains' || c.land === 'tundra' ? 1.4 : 0.4)),
  def('pilgrims', 'pilgrims on the roads', ['folk'], 1),
  def('traders', 'traders between the villages', ['folk'], 1.2),
  def('convergence', 'the moons\' convergence', ['moons'], 1.5),
  def('eclipse', 'eclipses', ['moons'], 0.6),
];
const REALM_RULE = { total: [6, 9] as [number, number], quota: { weather: [1, 1] as [number, number], calamity: [1, 2] as [number, number], sky: [1, 2] as [number, number], beasts: [1, 2] as [number, number], folk: [1, 2] as [number, number], moons: [1, 1] as [number, number] } };

const ORDER_NAMES = ['CONCLAVE', 'CIRCLE', 'ORDER', 'COURT', 'SYNOD', 'HAND', 'CHOIR', 'COLLEGIUM', 'CABAL', 'COVEN', 'TRIBUNAL', 'LODGE'];
const ORDER_ADJ: Record<School, string[]> = {
  fire: ['EMBER', 'CRIMSON', 'ASHEN', 'SCARLET', 'BURNING'], frost: ['AZURE', 'RIME', 'WINTER', 'PALE', 'GLASS'], storm: ['STORM', 'THUNDER', 'SKY', 'TEMPEST', 'GALE'],
  nature: ['VERDANT', 'GREEN', 'OAKEN', 'THORN', 'MOSS'], shadow: ['UMBRAL', 'NIGHT', 'VEILED', 'HOLLOW', 'RAVEN'], light: ['GOLDEN', 'DAWN', 'RADIANT', 'SUN', 'WHITE'], stone: ['GRANITE', 'IRON', 'DEEP', 'BASALT', 'OBSIDIAN'],
};
const ROBES: Record<School, string[]> = {
  fire: ['#b91c1c', '#c2410c', '#9f1239'], frost: ['#1d4ed8', '#0e7490', '#475569'], storm: ['#4338ca', '#334155', '#1e40af'], nature: ['#15803d', '#3f6212', '#166534'],
  shadow: ['#581c87', '#1e1b4b', '#3b0764'], light: ['#f5f5f4', '#ca8a04', '#e7e5e4'], stone: ['#78350f', '#57534e', '#44403c'],
};
const MAGE_A = ['MOR', 'IS', 'VAL', 'AUR', 'SAB', 'CAD', 'NER', 'HAL', 'ELS', 'ZAR', 'MIR', 'THO', 'ALD', 'BRE', 'CAS', 'DOR', 'EIR', 'FEN', 'GWY', 'OS', 'RHI', 'SEL', 'TAL', 'YS'];
const MAGE_B = ['GRETH', 'OLDE', 'DIS', 'ELIAN', 'INE', 'OC', 'IS', 'LOR', 'PETH', 'EK', 'AEL', 'RN', 'RIC', 'WYN', 'SIEL', 'AN', 'ARA', 'WEN', 'TH', 'IRA', 'ON', 'ENE', 'ORIN', 'OLDA'];
const TITLE = ['THE WISE', 'THE GREY', 'OF THE TOWER', 'THE ELDER', 'THE PALE', 'THE BOLD', 'THE QUIET', 'STARBORN', 'THE OLD', 'THE YOUNG', 'THE TWICE-BORN'];
const WELL_NAMES = ['THE WEEPING STONE', 'THE HOLLOW CROWN', 'THE NINE SISTERS', 'THE DREAMING WELL', 'THE KING-STONE', 'THE BLIND EYE', 'THE SINGING RING', 'THE LAST LANTERN', 'THE BROKEN ALTAR', 'THE STAR-PIT', 'THE WHISPERING MOUND', 'THE SILVER FORD', 'THE OLD GATE', 'THE MOON-POOL', 'THE GIANT\'S TABLE', 'THE ASH CIRCLE', 'THE COLD HEARTH', 'THE TWIN STONES', 'THE DROWNED BELL', 'THE GREEN MAN', 'THE SPINDLE', 'THE CROW-RING'];
const ARTIFACTS = ['THE STAFF OF', 'THE CROWN OF', 'THE MIRROR OF', 'THE ORB OF', 'THE BOOK OF', 'THE LANTERN OF', 'THE RING OF', 'THE BELL OF'];
const ART_B = ['SEVEN WINDS', 'THE DROWNED KING', 'ASH', 'THE FIRST DAWN', 'LONG NIGHT', 'WHISPERS', 'THE MOONS', 'STARS', 'THE DEEP ROOTS', 'BROKEN OATHS'];
export const DAY = 300;

export function createRealm(seed: string | number, W: number, H: number, opts: RealmOptions, noise: Noise2D): RealmWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'realm');
  const g: Genome = createGenome(seed, 'realm');
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  let ids = 1;
  const scale = Math.max(0.5, Math.min(2, opts.scale ?? 1));
  const blend = g.blend(LANDS, 0.6);
  if ((LANDS as string[]).includes(opts.land)) {
    for (const k of LANDS) blend[k] *= 0.25;
    blend[opts.land as Land] += 0.75;
  }
  const land = LANDS.reduce((a, b) => (blend[b] > blend[a] ? b : a), LANDS[0]);
  const castDrawn = compose(g.fork('cast'), { land, storms: opts.storms, rifts: opts.rifts }, REALM_CAST, REALM_RULE);
  const drew = (id: string) => castDrawn.some((c) => c.def.id === id);
  // The whole realm on screen (the default): the screen's shape, a little larger. Or the old
  // wide land for the director's camera to pan over.
  const wide = g.range(2.2, 2.7);
  const tall = g.range(1.5, 1.8);
  const whole = opts.camera !== 'director';
  const GW = Math.round(whole ? W * WORLD_SCALE * 1.2 * Math.sqrt(scale) : W * wide * Math.sqrt(scale));
  const GH = Math.round(whole ? H * WORLD_SCALE * 1.2 * Math.sqrt(scale) : H * tall * Math.sqrt(scale));
  // Distances shrink on a narrow screen: a phone gets a smaller realm, not a cut-off one.
  const us = Math.max(0.4, Math.min(1, Math.min(GW, GH * 1.6) / 1700));
  const CELL = 8;
  const cols = Math.ceil(GW / CELL);
  const rows = Math.ceil(GH / CELL);
  const N = cols * rows;
  const height = new Float32Array(N);
  const water = new Uint8Array(N);
  const forest = new Float32Array(N);
  const burnt = new Float32Array(N);
  const frost = new Float32Array(N);
  const blight = new Float32Array(N);

  const world: RealmWorld = {
    t: 0, W, H, GW, GH, bus, director: null as unknown as Director, land, blend, name: placeName(r),
    cast: castDrawn.map((c) => c.def.label ?? c.def.id), castIds: castDrawn.map((c) => c.def.id),
    CELL, cols, rows, height, water, forest, burnt, frost, blight, dirtyCells: [],
    sites: [], edges: [], orders: [], towers: [], units: [], spells: [], marks: [], fx: [], labels: [],
    storms: [], rifts: [], rituals: [], comet: null, chronicle: [],
    day: 0.62 + r() * 0.2, moons: r() * 0.5, converging: false, age: 1,
    cellAt: (x, y) => Math.max(0, Math.min(rows - 1, Math.floor(y / CELL))) * cols + Math.max(0, Math.min(cols - 1, Math.floor(x / CELL))),
    wet: (x, y) => water[world.cellAt(x, y)] === 1,
    step,
    counts() {
      return {
        orders: world.orders.filter((o) => o.alive).length,
        towers: world.towers.filter((t) => t.fell < 0 && t.level > 0).length,
        building: world.towers.filter((t) => t.fell < 0 && t.level === 0).length,
        mages: world.units.filter((u) => u.alive && isMage(u)).length,
        units: world.units.filter((u) => u.alive).length,
        spells: world.spells.length,
        wars: world.orders.filter((o) => o.alive && o.war >= 0).length,
        rifts: world.rifts.filter((x) => x.closed < 0).length,
      };
    },
  };
  const isMage = (u: Unit) => u.kind === 'archmage' || u.kind === 'mage' || u.kind === 'apprentice';

  // ---- telling ---------------------------------------------------------------------------------
  const say = (text: string, x: number, y: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    world.labels.push({ text, x, y, color, t0: world.t, dur: 5.5 });
    if (world.labels.length > 9) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, color, priority });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director?.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 6) world.chronicle.shift();
  };
  const T = titled;
  const look = (why: string, x: number, y: number, zoom: number, dur: number, priority = 3) => world.director?.look(why, x, y, zoom, dur, priority);
  const pending: { at: number; fn: () => void }[] = [];
  const later = (s: number, fn: () => void) => pending.push({ at: world.t + s, fn });
  const fx = (kind: Fx['kind'], x: number, y: number, dur: number, rad: number, color: string) => world.fx.push({ kind, x, y, t0: world.t, dur, r: rad, color, seed: ids++ });

  // ---- the land ---------------------------------------------------------------------------------
  const sea = blend.isles * 0.9 + blend.marsh * 0.35 - blend.desert * 0.3 - blend.mountains * 0.2;
  const seaLevel = -0.12 + sea * 0.45;
  const roughness = 1 + blend.mountains * 1.4;
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    const x = c * CELL;
    const y = rr * CELL;
    const s = 1 / 900;
    let h = noise.fbm2(x * s, y * s, 4, 2, 0.5) * roughness;
    if (blend.isles > 0.25) {
      const ex = Math.min(x, GW - x) / GW;
      const ey = Math.min(y, GH - y) / GH;
      h += 0.12 - Math.max(0, 0.12 - Math.min(ex, ey)) * 4 * blend.isles;
    }
    // Marsh: flat and wet, threaded with water.
    if (blend.marsh > 0.2) h = h * (1 - blend.marsh * 0.6) + Math.abs(noise.noise2(x * s * 5 + 7, y * s * 5)) * 0.12 * blend.marsh - 0.05 * blend.marsh;
    const i = rr * cols + c;
    height[i] = h;
    water[i] = h < seaLevel ? 1 : 0;
    const f = noise.noise2(x * s * 3 + 31, y * s * 3 - 17) * 0.5 + 0.5;
    const fd = blend.forest * 1.3 + blend.marsh * 0.4 + blend.tundra * 0.4 + blend.mountains * 0.5 + blend.steppe * 0.15 + blend.isles * 0.5;
    forest[i] = water[i] || h > 0.55 ? 0 : Math.max(0, Math.min(1, (f - (1 - fd * 0.6)) * 3));
  }
  const landAt = (x: number, y: number) => x > 20 && y > 20 && x < GW - 20 && y < GH - 20 && !water[world.cellAt(x, y)];
  // Sites: wells, villages, ruins, by Poisson-ish spacing on dry land.
  const placeSite = (kind: Site['kind'], minD: number, tries = 400): Site | null => {
    for (let k = 0; k < tries; k++) {
      const x = 60 * us + r() * (GW - 120 * us);
      const y = 70 + r() * (GH - 140);
      if (!landAt(x, y) || height[world.cellAt(x, y)] > 0.6) continue;
      let ok = true;
      for (let dx = -2; dx <= 2 && ok; dx++) for (let dy = -2; dy <= 2 && ok; dy++) if (!landAt(x + dx * 14, y + dy * 14)) ok = false;
      if (!ok || world.sites.some((s) => Math.hypot(s.x - x, s.y - y) < minD * (s.kind === kind ? 1 : 0.6))) continue;
      const s: Site = { id: world.sites.length, kind, x, y, name: '', links: [], tower: null, owner: -1, claimT: -1, prosper: 0.5, burnt: -1, searched: -999, cottages: [] };
      world.sites.push(s);
      return s;
    }
    return null;
  };
  const area = (GW * GH) / (1280 * 720);
  const nWells = Math.round(g.range(5.5, 7.5) * area);
  const nVillages = Math.round(g.range(4, 6) * area);
  const nRuins = Math.round(g.range(1, 2.5) * area);
  const usedNames = new Set<string>();
  for (let k = 0; k < nWells; k++) {
    const s = placeSite('well', 230 * us);
    if (!s) continue;
    let n = pick(WELL_NAMES);
    for (let j = 0; j < 6 && usedNames.has(n); j++) n = pick(WELL_NAMES);
    s.name = usedNames.has(n) ? `${n} II` : n;
    usedNames.add(s.name);
  }
  for (let k = 0; k < nVillages; k++) {
    const s = placeSite('village', 200 * us);
    if (!s) continue;
    s.name = placeName(r).toUpperCase();
    for (let j = 0; j < 6 + Math.floor(r() * 8); j++) {
      const a = r() * Math.PI * 2;
      const d = (14 + r() * 36) * Math.max(0.6, us);
      const cx = s.x + Math.cos(a) * d;
      const cy = s.y + Math.sin(a) * d * 0.7;
      if (landAt(cx, cy)) s.cottages.push([cx, cy, Math.floor(r() * 4)]);
    }
    // Fields around a village: no forest there.
    for (let dy = -9; dy <= 9; dy++) for (let dx = -12; dx <= 12; dx++) {
      const i = world.cellAt(s.x + dx * CELL, s.y + dy * CELL);
      forest[i] *= 0.1;
    }
  }
  for (let k = 0; k < nRuins; k++) {
    const s = placeSite('ruin', 220 * us);
    if (s) s.name = `THE RUINS OF ${placeName(r).toUpperCase()}`;
  }
  for (const s of world.sites) if (s.kind === 'well') for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) forest[world.cellAt(s.x + dx * CELL, s.y + dy * CELL)] = 0;
  // Edges: each site to its nearest few (a relative neighbourhood graph), not across much water.
  const wetAlong = (a: Site, b: Site) => {
    let wet = 0;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / CELL);
    for (let k = 0; k <= n; k++) if (water[world.cellAt(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n)]) wet++;
    return wet / (n + 1);
  };
  for (const a of world.sites) for (const b of world.sites) {
    if (b.id <= a.id) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d > 620 * us) continue;
    // Relative neighbourhood: no third site closer to both.
    if (world.sites.some((c) => c !== a && c !== b && Math.max(Math.hypot(c.x - a.x, c.y - a.y), Math.hypot(c.x - b.x, c.y - b.y)) < d)) continue;
    if (wetAlong(a, b) > 0.35) continue;
    world.edges.push({ a: a.id, b: b.id, ley: a.kind === 'well' && b.kind === 'well', flow: 0, pulse: r() });
    a.links.push(b.id);
    b.links.push(a.id);
  }
  // Join any islands of sites to the rest (a long road, a bridge, a ferry).
  for (let pass = 0; pass < 6; pass++) {
    const seen = new Set<number>([0]);
    const q = [0];
    while (q.length) for (const n of world.sites[q.pop()!].links) if (!seen.has(n)) {
      seen.add(n);
      q.push(n);
    }
    if (seen.size === world.sites.length) break;
    let best: [number, number, number] | null = null;
    for (const a of world.sites) if (seen.has(a.id)) for (const b of world.sites) if (!seen.has(b.id)) {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best || d < best[2]) best = [a.id, b.id, d];
    }
    if (!best) break;
    world.edges.push({ a: best[0], b: best[1], ley: false, flow: 0, pulse: 0 });
    world.sites[best[0]].links.push(best[1]);
    world.sites[best[1]].links.push(best[0]);
  }
  /** Shortest path over the sites (few dozen): Dijkstra. */
  function route(from: number, to: number): number[] {
    const n = world.sites.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[from] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity) break;
      if (u === to) break;
      done[u] = 1;
      const su = world.sites[u];
      for (const v of su.links) {
        const sv = world.sites[v];
        const d = dist[u] + Math.hypot(sv.x - su.x, sv.y - su.y);
        if (d < dist[v]) {
          dist[v] = d;
          prev[v] = u;
        }
      }
    }
    const path: number[] = [];
    for (let v = to; v >= 0 && v !== from; v = prev[v]) path.push(v);
    return path.reverse();
  }
  const nearestSite = (x: number, y: number, kind?: Site['kind']) => {
    let best = world.sites[0];
    let bd = Infinity;
    for (const s of world.sites) {
      if (kind && s.kind !== kind) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };

  // ---- orders -----------------------------------------------------------------------------------
  const nOrders = Math.max(2, Math.min(6, Math.round(opts.orders + g.int(-1, 1))));
  const schools = g.shuffle(SCHOOLS);
  const mageName = () => `${pick(MAGE_A)}${pick(MAGE_B)}`;
  const wells = () => world.sites.filter((s) => s.kind === 'well');
  // Capitals spread apart: farthest-point picks over the wells.
  const capitals: Site[] = [];
  const pool = g.shuffle(wells());
  if (pool.length) capitals.push(pool[0]);
  while (capitals.length < Math.min(nOrders, pool.length)) {
    let best = pool[0];
    let bd = -1;
    for (const s of pool) {
      if (capitals.includes(s)) continue;
      const d = Math.min(...capitals.map((c) => Math.hypot(c.x - s.x, c.y - s.y)));
      if (d > bd) {
        bd = d;
        best = s;
      }
    }
    capitals.push(best);
  }
  for (let k = 0; k < capitals.length; k++) {
    const school = schools[k % schools.length];
    const og = g.fork(`order-${k}`);
    const o: Order = {
      id: k, name: `THE ${og.pick(ORDER_ADJ[school])} ${og.pick(ORDER_NAMES)}`, robe: og.pick(ROBES[school]), trim: SPELL_COLOR[school], school, style: og.pick(STYLE_OF[school]),
      archmage: `${mageName()} ${og.pick(TITLE)}`, temper: og.weighted({ ambitious: 1.2, scholarly: 1, zealous: 0.9 }), alive: true, mana: 40, relation: [], war: -1, warT0: -1, artifacts: [], founded: 0, capital: capitals[k].id, age: 0,
    };
    world.orders.push(o);
  }
  for (const a of world.orders) a.relation = world.orders.map((b) => (a === b ? 1 : g.range(-0.6, 0.4) + (a.temper === 'zealous' || b.temper === 'zealous' ? -0.15 : 0)));
  for (const a of world.orders) for (const b of world.orders) b.relation[a.id] = a.relation[b.id];

  function raiseTower(site: Site, order: Order, level: number, quiet = false): Tower {
    const tw: Tower = { id: ids++, site: site.id, order: order.id, level, build: level > 0 ? 1 : 0, hp: 60 + level * 30, hpMax: 60 + level * 30, ward: 0, charge: 0.5, name: site.name, t0: world.t, fell: -1, cd: 0 };
    site.tower = tw;
    site.owner = order.id;
    site.claimT = world.t;
    world.towers.push(tw);
    if (!quiet) emit('claim', site.x, site.y, 0.2);
    return tw;
  }
  function unit(kind: UnitKind, order: number, x: number, y: number, extra: Partial<Unit> = {}): Unit {
    const o = order >= 0 ? world.orders[order] : null;
    const hp = { archmage: 60, mage: 26, apprentice: 14, villager: 6, cart: 10, elemental: 40, demon: 30, guardian: 50, dragon: 260, pilgrim: 6, beast: 14 }[kind];
    const u: Unit = {
      id: ids++, kind, order, school: o && (isMageKind(kind) || kind === 'elemental' || kind === 'guardian') ? o.school : null, x, y, tx: x, ty: y, path: [], at: nearestSite(x, y).id,
      task: 'idle', target: -1, t0: world.t, until: world.t + 1 + r() * 3, hp, hpMax: hp, cd: r() * 2, alive: true, deadAt: -1, facing: r() < 0.5 ? 1 : -1, anim: r() * 4,
      flying: false, name: isMageKind(kind) ? mageName() : '', casting: -1, foe: -1, seed: ids, carry: false, ...extra,
    };
    world.units.push(u);
    return u;
  }
  const isMageKind = (k: UnitKind) => k === 'archmage' || k === 'mage' || k === 'apprentice';
  for (const o of world.orders) {
    const cap = world.sites[o.capital];
    const tw = raiseTower(cap, o, 3, true);
    tw.charge = 1;
    const am = unit('archmage', o.id, cap.x + 10, cap.y + 6);
    am.name = o.archmage;
    // Storm mages ride the air.
    am.flying = o.school === 'storm';
    const n = Math.round(g.range(4, 6) * Math.sqrt(scale));
    for (let k = 0; k < n; k++) {
      const u = unit(k < 2 ? 'mage' : 'apprentice', o.id, cap.x + (r() - 0.5) * 40, cap.y + (r() - 0.5) * 24);
      u.flying = o.school === 'storm' && r() < 0.5;
    }
  }
  // Villagers and their carts.
  for (const s of world.sites) if (s.kind === 'village') for (let k = 0; k < 2 + Math.floor(r() * 3); k++) unit('villager', -1, s.x + (r() - 0.5) * 50, s.y + (r() - 0.5) * 30);

  // ---- movement --------------------------------------------------------------------------------
  const SPEED: Record<UnitKind, number> = { archmage: 22, mage: 26, apprentice: 26, villager: 16, cart: 14, elemental: 20, demon: 30, guardian: 18, dragon: 90, pilgrim: 14, beast: 30 };
  /** Send a unit to a site, along the roads and lines (fliers go straight). */
  function goTo(u: Unit, site: number) {
    u.target = site;
    // Timed work starts on arrival.
    u.until = -1;
    if (u.flying) {
      u.path = [site];
      return;
    }
    const from = nearestSite(u.x, u.y).id;
    u.path = from === site ? [site] : route(from, site);
    if (!u.path.length) u.path = [site];
    if (from !== site && Math.hypot(world.sites[from].x - u.x, world.sites[from].y - u.y) > 30) u.path.unshift(from);
  }
  /** Move along the path; true when there. Arrives near the site, not on it (spread out). */
  function move(u: Unit, dt: number, speed = SPEED[u.kind]): boolean {
    if (!u.path.length) return true;
    const s = world.sites[u.path[0]];
    const last = u.path.length === 1;
    const ox = last ? ((u.seed * 37) % 31) - 15 : 0;
    const oy = last ? ((u.seed * 17) % 19) - 9 + 8 : 0;
    const dx = s.x + ox - u.x;
    const dy = s.y + oy - u.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt * (world.wet(u.x, u.y) && !u.flying ? 0.5 : 1);
    if (Math.abs(dx) > 0.5) u.facing = dx > 0 ? 1 : -1;
    u.anim += dt * 6;
    if (d <= step) {
      u.x = s.x + ox;
      u.y = s.y + oy;
      u.at = s.id;
      u.path.shift();
      return !u.path.length;
    }
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
    return false;
  }
  const near = (u: Unit, x: number, y: number, rad: number) => Math.hypot(u.x - x, u.y - y) < rad;

  // ---- spells ------------------------------------------------------------------------------------
  const SPELL_OF: Record<School, Spell['kind']> = { fire: 'fireball', frost: 'lance', storm: 'lightning', nature: 'vine', shadow: 'orb', light: 'beam', stone: 'spike' };
  function cast(from: Unit | null, school: School | null, x0: number, y0: number, x1: number, y1: number, dmg: number, to: number, kind?: Spell['kind'], hitTower = -1) {
    const k = kind ?? (school ? SPELL_OF[school] : 'bolt');
    const d = Math.hypot(x1 - x0, y1 - y0);
    const dur = k === 'lightning' || k === 'beam' ? 0.35 : k === 'spike' || k === 'vine' ? 0.6 : Math.max(0.35, d / (k === 'fireball' ? 260 : 360));
    world.spells.push({ id: ids++, kind: k, school, x0, y0, x1, y1, t0: world.t, dur, color: school ? SPELL_COLOR[school] : '#fca5a5', from: from?.id ?? -1, to, dmg, seed: ids, hitTower });
    if (from) {
      from.casting = world.t;
      from.facing = x1 > from.x ? 1 : -1;
    }
  }
  function impact(sp: Spell) {
    const school = sp.school;
    // Marks on the land, by school.
    const mk = (kind: Mark['kind'], rad: number, dur: number) => world.marks.push({ kind, x: sp.x1, y: sp.y1, r: rad, t0: world.t, dur, seed: sp.seed });
    if (school === 'fire' || sp.kind === 'breath' || sp.kind === 'meteor') {
      mk('scorch', sp.kind === 'meteor' ? 40 : 18, 90);
      burn(sp.x1, sp.y1, sp.kind === 'meteor' ? 4 : 2);
    } else if (school === 'frost') {
      mk('frost', 22, 80);
      chill(sp.x1, sp.y1, 3);
    } else if (school === 'nature') mk('bloom', 18, 70);
    else if (school === 'shadow') mk('blight', 16, 60);
    else if (school === 'stone') mk('crater', 14, 90);
    fx(sp.kind === 'meteor' ? 'burst' : 'flash', sp.x1, sp.y1, 0.6, sp.kind === 'meteor' ? 50 : 14, sp.color);
    if (sp.hitTower >= 0) {
      const tw = world.towers.find((t) => t.id === sp.hitTower);
      if (tw && tw.fell < 0) hurtTower(tw, sp.dmg, sp.from);
      return;
    }
    const target = world.units.find((u) => u.id === sp.to);
    // Splash: everyone hostile near the impact.
    const from = world.units.find((u) => u.id === sp.from);
    for (const u of world.units) {
      if (!u.alive) continue;
      const hit = u === target ? near(u, sp.x1, sp.y1, 26) : near(u, sp.x1, sp.y1, 14) && from && hostile(from, u);
      if (hit) hurt(u, sp.dmg * (u === target ? 1 : 0.5), from ?? null);
    }
  }
  function burn(x: number, y: number, rad: number) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const i = world.cellAt(x + dx * CELL, y + dy * CELL);
      if (forest[i] > 0.05 && burnt[i] < 0.5) {
        burnt[i] = 1;
        world.dirtyCells.push(i);
      }
    }
  }
  function chill(x: number, y: number, rad: number) {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const i = world.cellAt(x + dx * CELL, y + dy * CELL);
      if (frost[i] < 0.8) {
        frost[i] = 1;
        world.dirtyCells.push(i);
      }
    }
  }
  function hostile(a: Unit, b: Unit) {
    if (a.id === b.id || !b.alive) return false;
    const evil = (u: Unit) => u.kind === 'demon' || (u.kind === 'dragon' && u.order < 0) || (u.kind === 'beast' && u.task === 'hunt') || (u.kind === 'guardian' && u.order === -2);
    if (evil(a) !== evil(b)) return !(b.kind === 'villager' && a.kind !== 'demon' && a.kind !== 'dragon' && a.kind !== 'beast') && !(a.kind === 'villager');
    if (a.order < 0 || b.order < 0 || a.order === b.order) return false;
    // Rival mages who meet duel, at war or not.
    if (isMage(a) && isMage(b) && world.orders[a.order].relation[b.order] < -0.25) return true;
    const o = world.orders[a.order];
    return o.war === b.order || world.orders[b.order].war === a.order;
  }
  function hurt(u: Unit, dmg: number, by: Unit | null) {
    if (!u.alive) return;
    u.hp -= dmg;
    if (u.hp <= 0) die(u, by);
  }
  function die(u: Unit, by: Unit | null) {
    u.alive = false;
    u.deadAt = world.t;
    fx(u.kind === 'demon' ? 'burst' : 'smoke', u.x, u.y - 6, 1.2, 10, u.kind === 'demon' ? '#ef4444' : '#a8a29e');
    if (u.kind === 'archmage' && u.order >= 0) {
      const o = world.orders[u.order];
      const heir = world.units.filter((m) => m.alive && m.order === o.id && m.kind === 'mage').sort((a, b) => a.t0 - b.t0)[0];
      say(`${u.name} OF ${o.name} HAS FALLEN`, u.x, u.y - 20, o.trim, 'high');
      emit('archmage', u.x, u.y, 0.8);
      if (heir) {
        heir.kind = 'archmage';
        heir.hp = heir.hpMax = 60;
        o.archmage = `${heir.name} ${pick(TITLE)}`;
        heir.name = o.archmage;
        later(3, () => {
          say(`${o.archmage} LEADS ${o.name}`, heir.x, heir.y - 20, o.trim, 'medium');
          chronicle(`${T(u.name)} fell${by ? ` to ${by.kind === 'dragon' ? 'the dragon' : by.order >= 0 ? T(world.orders[by.order].name) : 'the dark'}` : ''}; ${T(o.archmage)} leads ${T(o.name)}.`);
        });
      }
    }
    if (u.kind === 'dragon') {
      say('THE DRAGON FALLS', u.x, u.y - 30, '#fde68a', 'high');
      emit('dragonslain', u.x, u.y, 1);
      chronicle(`The mages of the realm brought the dragon down${by && by.order >= 0 ? `; ${T(world.orders[by.order].name)} took its heart` : ''}.`);
      if (by && by.order >= 0) world.orders[by.order].mana += 120;
      look('dragon', u.x, u.y, 1.3, 8, 7);
    }
  }
  function hurtTower(tw: Tower, dmg: number, by: number) {
    if (tw.ward > 0) {
      tw.ward = Math.max(0, tw.ward - dmg);
      const s = world.sites[tw.site];
      fx('ring', s.x, s.y - 20, 0.5, 34, SPELL_COLOR[world.orders[tw.order].school]);
      if (tw.ward === 0) {
        say(`THE WARD OF ${tw.name} BREAKS`, s.x, s.y - 50, '#fca5a5', 'medium');
        emit('wardbreaks', s.x, s.y, 0.5);
      }
      return;
    }
    tw.hp -= dmg;
    if (tw.hp <= 0) fall(tw, by);
  }
  function fall(tw: Tower, by: number) {
    if (tw.fell >= 0) return;
    const s = world.sites[tw.site];
    const o = world.orders[tw.order];
    const killer = world.units.find((u) => u.id === by);
    tw.fell = world.t;
    s.tower = null;
    s.owner = -1;
    for (let k = 0; k < 14; k++) fx('rubble', s.x + (r() - 0.5) * 30, s.y - r() * 50, 1.4, 4, '#a8a29e');
    fx('burst', s.x, s.y - 20, 1.5, 60, SPELL_COLOR[o.school]);
    say(`THE TOWER AT ${s.name} FALLS`, s.x, s.y - 60, '#fca5a5', 'high');
    emit('towerfalls', s.x, s.y, 0.9);
    chronicle(`${T(o.name)}'s tower at ${T(s.name)} fell${killer && killer.order >= 0 ? ` to ${T(world.orders[killer.order].name)}` : killer?.kind === 'demon' ? ' to the demons' : ''}.`);
    look('fall', s.x, s.y - 20, 1.4, 9, 7);
    world.director.note(0.6);
    if (!world.towers.some((t) => t.order === o.id && t.fell < 0)) {
      later(2, () => {
        if (world.towers.some((t) => t.order === o.id && t.fell < 0)) return;
        o.alive = false;
        for (const u of world.units) if (u.order === o.id && u.alive) {
          u.task = 'wander';
          u.order = -1;
          u.kind = u.kind === 'archmage' || u.kind === 'mage' || u.kind === 'apprentice' ? 'pilgrim' : u.kind;
        }
        for (const x of world.orders) if (x.war === o.id) x.war = -1;
        say(`${o.name} IS NO MORE`, s.x, s.y - 80, '#fca5a5', 'high');
        emit('orderends', s.x, s.y, 0.9);
        chronicle(`${T(o.name)} lost its last tower, and was no more.`);
        later(40 + r() * 60, () => newOrder());
      });
    }
  }
  /** A new order rises at a free well (an old one's survivors, or newcomers over the hills). */
  function newOrder() {
    const free = wells().filter((s) => !s.tower && !world.rifts.some((x) => x.site === s.id && x.closed < 0));
    if (!free.length || world.orders.filter((o) => o.alive).length >= 6) return;
    const s = free.sort((a, b) => minEnemyDist(b) - minEnemyDist(a))[0];
    const school = pick(SCHOOLS.filter((x) => !world.orders.some((o) => o.alive && o.school === x)).concat(SCHOOLS));
    const og = g.fork(`order-new-${world.orders.length}`);
    const o: Order = {
      id: world.orders.length, name: `THE ${og.pick(ORDER_ADJ[school])} ${og.pick(ORDER_NAMES)}`, robe: og.pick(ROBES[school]), trim: SPELL_COLOR[school], school, style: og.pick(STYLE_OF[school]),
      archmage: `${mageName()} ${og.pick(TITLE)}`, temper: og.weighted({ ambitious: 1.2, scholarly: 1, zealous: 0.9 }), alive: true, mana: 60, relation: [], war: -1, warT0: -1, artifacts: [], founded: world.t, capital: s.id, age: world.age,
    };
    world.orders.push(o);
    for (const x of world.orders) {
      x.relation[o.id] = x === o ? 1 : g.range(-0.3, 0.4);
      o.relation[x.id] = x.relation[o.id];
    }
    raiseTower(s, o, 2, true);
    const am = unit('archmage', o.id, s.x, s.y + 6);
    am.name = o.archmage;
    for (let k = 0; k < 4; k++) unit(k < 1 ? 'mage' : 'apprentice', o.id, s.x + (r() - 0.5) * 30, s.y + (r() - 0.5) * 20);
    fx('teleport', s.x, s.y, 2, 50, o.trim);
    say(`${o.name} RISES AT ${s.name}`, s.x, s.y - 60, o.trim, 'high');
    emit('neworder', s.x, s.y, 0.8);
    chronicle(`${T(o.name)} rose at ${T(s.name)}, under ${T(o.archmage)}.`);
    look('rise', s.x, s.y - 20, 1.3, 8, 6);
  }
  const minEnemyDist = (s: Site) => Math.min(9999, ...world.towers.filter((t) => t.fell < 0).map((t) => Math.hypot(world.sites[t.site].x - s.x, world.sites[t.site].y - s.y)));

  // ---- what the orders decide ------------------------------------------------------------------
  const towersOf = (o: Order) => world.towers.filter((t) => t.order === o.id && t.fell < 0);
  const magesOf = (o: Order) => world.units.filter((u) => u.alive && u.order === o.id && isMage(u));
  function orderMind(o: Order) {
    if (!o.alive) return;
    const tws = towersOf(o);
    const mages = magesOf(o);
    // The wells feed the towers, the towers feed the order.
    for (const tw of tws) if (tw.level > 0) o.mana += 0.6 * tw.level * (world.converging ? 2 : 1);
    // New blood: apprentices arrive at the towers.
    if (mages.length < 3 + tws.length * 3 * Math.sqrt(scale) && o.mana > 25 && r() < 0.35) {
      const tw = pick(tws.filter((t) => t.level > 0));
      if (tw) {
        const s = world.sites[tw.site];
        const u = unit('apprentice', o.id, s.x, s.y + 8);
        u.flying = o.school === 'storm' && r() < 0.4;
        o.mana -= 20;
        fx('teleport', u.x, u.y, 1, 12, o.trim);
      }
    }
    // Promotions with time.
    for (const u of mages) if (u.kind === 'apprentice' && world.t - u.t0 > 180 && r() < 0.02) {
      u.kind = 'mage';
      u.hp = u.hpMax = 26;
    }
    // Pick a free task for idle mages.
    for (const u of mages) {
      if (u.task !== 'idle' || world.t < u.until) continue;
      assign(o, u, tws);
    }
    // War and peace.
    for (const b of world.orders) {
      if (b === o || !b.alive) continue;
      const rel = o.relation[b.id];
      // With no free wells left, the only way to grow is to take one: tempers shorten.
      const crowded = !wells().some((s) => !s.tower) ? (o.temper === 'scholarly' ? 0.008 : 0.02) : 0;
      const drift = (o.temper === 'zealous' ? -0.012 : o.temper === 'scholarly' ? 0.006 : -0.004) + (r() - 0.5) * 0.02 - (borderTension(o, b) ? 0.01 : 0) - crowded;
      o.relation[b.id] = b.relation[o.id] = Math.max(-1, Math.min(1, rel + drift));
      if (o.war < 0 && b.war !== o.id && o.relation[b.id] < -0.35 && borderTension(o, b) && world.director.want('war', 0.45, 80)) declareWar(o, b);
    }
    if (o.war >= 0) {
      const b = world.orders[o.war];
      if (!b.alive || world.t - o.warT0 > 200) peace(o, b);
    }
  }
  const borderTension = (a: Order, b: Order) => towersOf(a).some((x) => towersOf(b).some((y) => Math.hypot(world.sites[x.site].x - world.sites[y.site].x, world.sites[x.site].y - world.sites[y.site].y) < 700));
  function assign(o: Order, u: Unit, tws: Tower[]) {
    const home = tws.length ? tws.reduce((a, b) => (Math.hypot(world.sites[a.site].x - u.x, world.sites[a.site].y - u.y) < Math.hypot(world.sites[b.site].x - u.x, world.sites[b.site].y - u.y) ? a : b)) : null;
    if (!home) {
      u.task = 'wander';
      return;
    }
    const roll = r();
    const free = wells().filter((s) => !s.tower && !world.units.some((m) => m.alive && m.task === 'claim' && m.target === s.id) && !world.rifts.some((x) => x.site === s.id && x.closed < 0));
    const unfinished = tws.find((t) => t.level === 0);
    // Help raise a tower in building.
    if (unfinished && roll < 0.35) {
      u.task = 'build';
      goTo(u, unfinished.site);
      return;
    }
    // Claim a free well (the order's ambition, and its mana, decide how far).
    if (free.length && o.mana > 30 && roll < (o.temper === 'ambitious' ? 0.5 : 0.32) && u.kind !== 'apprentice') {
      const s = free.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      if (Math.hypot(s.x - u.x, s.y - u.y) < 1100) {
        o.mana -= 30;
        u.task = 'claim';
        goTo(u, s.id);
        return;
      }
    }
    // Raise a tower higher.
    if (roll < 0.5 && o.mana > 60) {
      const tw = tws.filter((t) => t.level > 0 && t.level < (t.site === o.capital ? 5 : 4) && !world.units.some((m) => m.alive && m.task === 'raise' && m.target === t.site)).sort((a, b) => a.level - b.level)[0];
      if (tw) {
        o.mana -= 50;
        u.task = 'raise';
        goTo(u, tw.site);
        return;
      }
    }
    // Bless a village; search a ruin; channel at home.
    if (roll < 0.66) {
      const v = world.sites.filter((s) => s.kind === 'village').sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[Math.floor(r() * 2)];
      if (v) {
        u.task = 'bless';
        goTo(u, v.id);
        return;
      }
    }
    if (roll < 0.76) {
      const ru = world.sites.filter((s) => s.kind === 'ruin' && world.t - s.searched > 150).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      if (ru && Math.hypot(ru.x - u.x, ru.y - u.y) < 1000) {
        u.task = 'explore';
        goTo(u, ru.id);
        return;
      }
    }
    u.task = 'channel';
    goTo(u, home.site);
  }
  function declareWar(a: Order, b: Order) {
    a.war = b.id;
    a.warT0 = world.t;
    // The target: b's nearest tower to a's.
    const mine = towersOf(a);
    const theirs = towersOf(b).filter((t) => t.level > 0);
    if (!mine.length || !theirs.length) return;
    let best = theirs[0];
    let bd = Infinity;
    for (const t of theirs) for (const m of mine) {
      const d = Math.hypot(world.sites[t.site].x - world.sites[m.site].x, world.sites[t.site].y - world.sites[m.site].y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    const s = world.sites[best.site];
    const party = magesOf(a).filter((u) => u.kind !== 'apprentice' || r() < 0.5).slice(0, 7);
    for (const u of party) {
      u.task = 'war';
      goTo(u, best.site);
    }
    // Summons march with them.
    const home = world.sites[mine[0].site];
    for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
      const e = unit('elemental', a.id, home.x + (r() - 0.5) * 30, home.y + (r() - 0.5) * 20);
      e.task = 'war';
      goTo(e, best.site);
      fx('teleport', e.x, e.y, 1, 16, a.trim);
    }
    say(`${a.name} MAKES WAR ON ${b.name}`, s.x, s.y - 70, '#fca5a5', 'high');
    emit('war', s.x, s.y, 0.85);
    chronicle(`${T(a.name)} made war on ${T(b.name)}, and marched on ${T(s.name)}.`);
    look('war', (home.x + s.x) / 2, (home.y + s.y) / 2, 0.9, 12, 6);
    // The defenders raise their wards.
    best.ward = 30 + best.level * 15;
    fx('ring', s.x, s.y - 20, 1.2, 40, b.trim);
  }
  function peace(a: Order, b: Order) {
    a.war = -1;
    a.relation[b.id] = b.relation[a.id] = 0.15;
    for (const u of world.units) if (u.alive && u.order === a.id && u.task === 'war') u.task = 'idle';
    if (b.alive) {
      const s = world.sites[a.capital];
      say(`${a.name} AND ${b.name} MAKE PEACE`, s.x, s.y - 60, '#bbf7d0', 'medium');
      emit('peace', s.x, s.y, 0.4);
      chronicle(`${T(a.name)} and ${T(b.name)} made peace.`);
    }
  }

  // ---- the units' day --------------------------------------------------------------------------
  function act(u: Unit, dt: number) {
    if (u.kind === 'dragon') return dragonStep(u, dt);
    // Fight whatever hostile is near.
    if (fight(u, dt)) return;
    const o = u.order >= 0 ? world.orders[u.order] : null;
    const arrived = move(u, dt);
    const s = world.sites[u.target] ?? world.sites[u.at];
    switch (u.task) {
      case 'idle':
        if (world.t > u.until && !isMage(u)) wanderTo(u);
        break;
      case 'channel':
        if (!arrived) break;
        if (!s.tower || s.tower.order !== u.order) {
          u.task = 'idle';
          break;
        }
        if (u.until < 0) u.until = world.t + 8 + r() * 12;
        u.casting = world.t;
        s.tower.charge = Math.min(1, s.tower.charge + dt * 0.05);
        if (o) o.mana += dt * 0.25;
        if (world.t > u.until) {
          u.task = 'idle';
          u.until = world.t + 1 + r() * 2;
        }
        break;
      case 'claim': {
        if (!arrived) break;
        if (s.tower || !o) {
          u.task = 'idle';
          break;
        }
        raiseTower(s, o, 0);
        say(`${o.name} CLAIMS ${s.name}`, s.x, s.y - 40, o.trim, 'low');
        u.task = 'build';
        break;
      }
      case 'build': {
        if (!arrived) break;
        const tw = s.tower;
        if (!tw || tw.order !== u.order || tw.level > 0) {
          u.task = 'idle';
          break;
        }
        u.casting = world.t;
        tw.build += dt / 14 * (u.kind === 'apprentice' ? 0.6 : 1);
        if (r() < dt * 3) fx('build', s.x + (r() - 0.5) * 20, s.y - r() * 30 * tw.build, 0.8, 3, o!.trim);
        if (tw.build >= 1) {
          tw.level = 1;
          tw.hp = tw.hpMax = 90;
          say(`${o!.name} RAISES A TOWER AT ${s.name}`, s.x, s.y - 50, o!.trim, 'medium');
          emit('tower', s.x, s.y, 0.2);
          if (towersOf(o!).length >= 3 && r() < 0.5) chronicle(`${T(o!.name)} raised a tower at ${T(s.name)}.`);
          look('tower', s.x, s.y - 20, 1.5, 6, 3);
          fx('ring', s.x, s.y - 10, 1, 30, o!.trim);
          for (const m of world.units) if (m.alive && m.task === 'build' && m.target === s.id) m.task = 'idle';
        }
        break;
      }
      case 'raise': {
        if (!arrived) break;
        const tw = s.tower;
        if (!tw || tw.order !== u.order) {
          u.task = 'idle';
          break;
        }
        u.casting = world.t;
        if (r() < dt * 2) fx('build', s.x + (r() - 0.5) * 16, s.y - 30 - tw.level * 14, 0.8, 3, o!.trim);
        if (u.until < 0) u.until = world.t + 10;
        if (world.t > u.until) {
          u.task = 'idle';
          if (tw.level >= 5) break;
          tw.level++;
          tw.hpMax += 40;
          tw.hp = tw.hpMax;
          if (tw.level >= 3) say(`THE TOWER AT ${s.name} RISES HIGHER`, s.x, s.y - 50 - tw.level * 14, o!.trim, 'low');
          emit('towerrises', s.x, s.y, 0.08);
          fx('ring', s.x, s.y - 20 - tw.level * 14, 1, 24, o!.trim);
          if (tw.level === 5 && o) {
            say(`${o.name} CROWNS ITS TOWER AT ${s.name}`, s.x, s.y - 140, o.trim, 'high');
            emit('greattower', s.x, s.y, 0.7);
            chronicle(`${T(o.name)} crowned its tower at ${T(s.name)}, the highest in the land.`);
            look('tower', s.x, s.y - 60, 1.2, 8, 5);
          }
          u.task = 'idle';
        }
        break;
      }
      case 'bless':
        if (!arrived) break;
        u.casting = world.t;
        if (u.until < 0) u.until = world.t + 7;
        if (r() < dt * 4) fx('spark', s.x + (r() - 0.5) * 70, s.y + (r() - 0.5) * 40, 1.2, 2, o?.trim ?? '#fde68a');
        if (world.t > u.until) {
          s.prosper = Math.min(1, s.prosper + 0.15);
          if (o) {
            s.owner = o.id;
            o.mana += 15;
          }
          if (s.prosper > 0.8 && s.cottages.length < 18 && r() < 0.5) {
            const a = r() * Math.PI * 2;
            const d = 20 + r() * 40;
            const cx = s.x + Math.cos(a) * d;
            const cy = s.y + Math.sin(a) * d * 0.7;
            if (landAt(cx, cy)) {
              s.cottages.push([cx, cy, Math.floor(r() * 4)]);
              emit('village', cx, cy, 0.02);
            }
          }
          u.task = 'idle';
          u.until = world.t + 1;
        }
        break;
      case 'explore':
        if (!arrived) break;
        u.casting = world.t;
        if (u.until < 0) u.until = world.t + 9;
        if (r() < dt * 2) fx('rune', s.x + (r() - 0.5) * 40, s.y + (r() - 0.5) * 30, 1.5, 6, '#c4b5fd');
        if (world.t > u.until) {
          s.searched = world.t;
          const roll = r();
          if (roll < 0.12 && o) {
            const name = `${pick(ARTIFACTS)} ${pick(ART_B)}`;
            o.artifacts.push(name);
            o.mana += 60;
            fx('glint', s.x, s.y - 10, 2.5, 30, '#fde68a');
            say(`${u.name} FINDS ${name} IN ${s.name}`, s.x, s.y - 40, '#fde68a', 'high');
            emit('artifact', s.x, s.y, 0.75);
            chronicle(`${T(u.name)} of ${T(o.name)} found ${T(name)} in ${T(s.name)}.`);
            look('artifact', s.x, s.y - 10, 1.6, 6, 5);
          } else if (roll < 0.3) {
            const gd = unit('guardian', -2, s.x, s.y);
            gd.task = 'hunt';
            gd.foe = u.id;
            fx('teleport', s.x, s.y, 1.2, 30, '#94a3b8');
            say(`A GUARDIAN WAKES IN ${s.name}`, s.x, s.y - 40, '#fca5a5', 'medium');
            emit('guardian', s.x, s.y, 0.55);
            look('fight', s.x, s.y, 1.5, 6, 4);
          }
          u.task = 'idle';
          u.until = world.t + 1;
        }
        break;
      case 'war': {
        const tw = s.tower;
        if (!tw || tw.order === u.order || !o || o.war < 0 || tw.order !== o.war) {
          // The target fell: claim its well, if a mage.
          if (!tw && isMage(u) && o && s.kind === 'well' && o.mana > 10) {
            u.task = 'claim';
            goTo(u, s.id);
          } else u.task = 'home';
          break;
        }
        if (Math.hypot(s.x - u.x, s.y - u.y) < 150) {
          u.path = [];
          if (u.cd <= 0) {
            u.cd = 1.6 + r();
            const dmg = u.kind === 'archmage' ? 10 : u.kind === 'elemental' ? 7 : 5;
            if (u.school) cast(u, u.school, u.x, u.y - 10, s.x + (r() - 0.5) * 10, s.y - 16 - r() * 30, dmg, -1, undefined, tw.id);
          }
        }
        break;
      }
      case 'home':
        if (o) {
          const tws = towersOf(o);
          if (!tws.length) {
            u.task = 'wander';
            break;
          }
          if (!u.path.length) goTo(u, tws[0].site);
          if (arrived) u.task = 'idle';
        } else u.task = 'wander';
        break;
      case 'ritual': {
        const rt = world.rituals.find((x) => x.order === u.order && !x.done);
        if (!rt) {
          u.task = 'idle';
          break;
        }
        if (arrived) u.casting = world.t;
        break;
      }
      case 'close': {
        const rf = world.rifts.find((x) => x.site === u.target && x.closed < 0);
        if (!rf) {
          u.task = 'idle';
          break;
        }
        if (Math.hypot(rf.x - u.x, rf.y - u.y) < 90) {
          u.path = [];
          u.casting = world.t;
          rf.closing += dt * (u.kind === 'archmage' ? 0.025 : 0.012);
        }
        break;
      }
      case 'trade':
      case 'tribute':
        if (arrived) {
          if (u.task === 'tribute' && s.tower && s.tower.order >= 0) world.orders[s.tower.order].mana += 5;
          u.task = 'idle';
          u.until = world.t + 3 + r() * 6;
        }
        break;
      case 'wander':
        if (arrived && world.t > u.until) wanderTo(u);
        break;
      case 'hunt': {
        const prey = world.units.find((x) => x.id === u.foe && x.alive) ?? world.units.filter((x) => x.alive && hostile(u, x)).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
        if (!prey || Math.hypot(prey.x - u.x, prey.y - u.y) > 900) {
          u.task = 'wander';
          if (u.kind === 'guardian' || u.kind === 'demon') {
            u.alive = false;
            u.deadAt = world.t;
            fx('teleport', u.x, u.y, 1, 16, '#94a3b8');
          }
          break;
        }
        u.foe = prey.id;
        const d = Math.hypot(prey.x - u.x, prey.y - u.y);
        if (d > 18) {
          u.x += ((prey.x - u.x) / d) * SPEED[u.kind] * dt;
          u.y += ((prey.y - u.y) / d) * SPEED[u.kind] * dt;
          u.facing = prey.x > u.x ? 1 : -1;
          u.anim += dt * 6;
        }
        break;
      }
      default:
        break;
    }
    // Demons and beasts go for the nearest prey; villagers carry on.
    if (u.kind === 'villager' && u.task === 'idle' && world.t > u.until) {
      const tws = world.towers.filter((t) => t.fell < 0 && t.level > 0);
      if (tws.length && r() < 0.25) {
        u.task = 'tribute';
        goTo(u, pick(tws).site);
      } else wanderTo(u);
    }
  }
  function wanderTo(u: Unit) {
    const s = world.sites[u.at];
    const links = s ? s.links : [];
    const next = links.length ? world.sites[pick(links)] : nearestSite(u.x, u.y);
    if (u.kind === 'villager' || u.kind === 'cart' || u.kind === 'pilgrim') u.task = u.kind === 'villager' && r() < 0.5 ? 'trade' : 'wander';
    else u.task = 'wander';
    goTo(u, next.id);
    u.until = world.t + 2 + r() * 6;
  }
  /** Cast at the nearest hostile in reach; true if fighting (the unit stays put). */
  function fight(u: Unit, dt: number): boolean {
    u.cd -= dt;
    if (u.kind === 'villager' || u.kind === 'cart' || u.kind === 'pilgrim') {
      // Flee anything hostile.
      const threat = world.units.find((x) => x.alive && (x.kind === 'demon' || x.kind === 'dragon' || (x.kind === 'beast' && x.task === 'hunt')) && near(u, x.x, x.y, 90));
      if (threat) {
        const d = Math.hypot(u.x - threat.x, u.y - threat.y) || 1;
        u.x += ((u.x - threat.x) / d) * 22 * dt;
        u.y += ((u.y - threat.y) / d) * 22 * dt;
        u.x = Math.max(10, Math.min(GW - 10, u.x));
        u.y = Math.max(10, Math.min(GH - 10, u.y));
        u.anim += dt * 8;
        return true;
      }
      return false;
    }
    const reach = isMage(u) ? (u.kind === 'archmage' ? 170 : 130) : u.kind === 'dragon' ? 160 : 22;
    let foe: Unit | null = null;
    let fd = Infinity;
    for (const x of world.units) {
      if (!x.alive || !hostile(u, x)) continue;
      const d = Math.hypot(x.x - u.x, x.y - u.y);
      if (d < reach && d < fd) {
        fd = d;
        foe = x;
      }
    }
    if (!foe) return false;
    u.facing = foe.x > u.x ? 1 : -1;
    if (isMage(u) || u.kind === 'elemental' && u.school) {
      if (u.cd <= 0) {
        u.cd = (u.kind === 'archmage' ? 1.2 : u.kind === 'mage' ? 1.6 : 2.2) + r() * 0.6;
        const dmg = u.kind === 'archmage' ? 9 : u.kind === 'mage' ? 6 : u.kind === 'elemental' ? 7 : 3.5;
        cast(u, u.school, u.x + u.facing * 4, u.y - 12, foe.x, foe.y - 6, dmg, foe.id);
        if (isMage(u) && foe.order >= 0 && isMage(foe) && once(`duel-${Math.min(u.order, foe.order)}-${Math.max(u.order, foe.order)}-${Math.floor(world.t / 40)}`)) {
          say(`${u.name} DUELS ${foe.name}`, (u.x + foe.x) / 2, Math.min(u.y, foe.y) - 30, '#fde68a', 'medium');
          emit('duel', u.x, u.y, 0.45);
          look('duel', (u.x + foe.x) / 2, (u.y + foe.y) / 2, 1.6, 5, 4);
        }
        // A mage hard-pressed blinks away.
        if (isMage(u) && u.hp < u.hpMax * 0.3 && r() < 0.3 && u.order >= 0) {
          const tws = towersOf(world.orders[u.order]);
          if (tws.length) {
            fx('teleport', u.x, u.y, 1, 14, world.orders[u.order].trim);
            const s = world.sites[tws[0].site];
            u.x = s.x + (r() - 0.5) * 20;
            u.y = s.y + 10;
            u.path = [];
            u.task = 'idle';
            u.until = world.t + 10;
            fx('teleport', u.x, u.y, 1, 14, world.orders[u.order].trim);
          }
        }
      }
      return true;
    }
    // Melee: close in, strike.
    if (fd > 14) {
      u.x += ((foe.x - u.x) / fd) * SPEED[u.kind] * dt;
      u.y += ((foe.y - u.y) / fd) * SPEED[u.kind] * dt;
      u.anim += dt * 6;
    } else if (u.cd <= 0) {
      u.cd = 1 + r() * 0.5;
      u.casting = world.t;
      hurt(foe, u.kind === 'demon' ? 5 : u.kind === 'guardian' ? 7 : u.kind === 'elemental' ? 6 : 3, u);
      fx('spark', foe.x, foe.y - 8, 0.4, 3, '#fca5a5');
    }
    return true;
  }
  const said = new Set<string>();
  const once = (k: string) => (said.has(k) ? false : (said.add(k), true));

  // ---- towers defend themselves; storms; the dragon; rifts; the comet; the moons -------------------
  function towerStep(tw: Tower, dt: number) {
    if (tw.fell >= 0 || tw.level === 0) return;
    const s = world.sites[tw.site];
    const o = world.orders[tw.order];
    tw.charge = Math.max(0, tw.charge - dt * 0.01);
    tw.cd -= dt;
    tw.hp = Math.min(tw.hpMax, tw.hp + dt * 0.3);
    if (tw.cd > 0) return;
    const probe: Unit = { order: tw.order, kind: 'mage', id: -tw.id } as Unit;
    const foe = world.units.find((u) => u.alive && Math.hypot(u.x - s.x, u.y - s.y) < 140 + tw.level * 10 && hostile(probe, u));
    if (!foe) return;
    tw.cd = 2.4 - tw.level * 0.2;
    cast(null, o.school, s.x, s.y - 30 - tw.level * 14, foe.x, foe.y - 6, 6 + tw.level * 2, foe.id);
  }
  function stormStep(dt: number) {
    if (!drew('storms')) return;
    if (!world.storms.length && world.director.want('storm', 0.35, 80)) {
      const fromLeft = r() < 0.5;
      const y = GH * (0.2 + r() * 0.6);
      world.storms.push({ x: fromLeft ? -200 : GW + 200, y, vx: (fromLeft ? 1 : -1) * (25 + r() * 20), vy: (r() - 0.5) * 10, r: 160 + r() * 140, t0: world.t, dur: 120, next: world.t + 2 });
      say('AN ARCANE STORM ROLLS IN', fromLeft ? 120 : GW - 120, y, '#c7d2fe', 'medium');
      emit('storm', fromLeft ? 0 : GW, y, 0.5);
    }
    for (const st of world.storms) {
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      if (world.t > st.next) {
        st.next = world.t + 0.8 + r() * 2;
        // Lightning: at a tower if one is under it, else the ground (or a line).
        const tw = world.towers.find((t) => t.fell < 0 && t.level > 0 && Math.hypot(world.sites[t.site].x - st.x, world.sites[t.site].y - st.y) < st.r);
        const x = tw ? world.sites[tw.site].x : st.x + (r() - 0.5) * st.r * 1.6;
        const y = tw ? world.sites[tw.site].y - 30 - tw.level * 14 : st.y + (r() - 0.5) * st.r;
        world.spells.push({ id: ids++, kind: 'lightning', school: 'storm', x0: x + (r() - 0.5) * 40, y0: y - 400, x1: x, y1: y, t0: world.t, dur: 0.35, color: '#e0e7ff', from: -1, to: -1, dmg: tw ? 4 : 0, seed: ids, hitTower: tw ? tw.id : -1 });
        if (tw) {
          tw.charge = 1;
          world.orders[tw.order].mana += 8;
        }
        emit('thunder', x, y, 0.15);
      }
    }
    world.storms = world.storms.filter((st) => world.t - st.t0 < st.dur && st.x > -400 && st.x < GW + 400);
  }
  function dragonStep(u: Unit, dt: number) {
    u.anim += dt * 5;
    const prey = u.foe >= 0 ? world.units.find((x) => x.id === u.foe && x.alive) : null;
    const age = world.t - u.t0;
    if (age > 110 || (u.hp < u.hpMax * 0.3 && u.task !== 'home')) {
      if (u.task !== 'home') {
        u.task = 'home';
        say('THE DRAGON FLIES OFF', u.x, u.y - 30, '#fdba74', 'medium');
        emit('dragonleaves', u.x, u.y, 0.4);
      }
      u.tx = u.x < GW / 2 ? -400 : GW + 400;
      u.ty = u.y - 100;
    } else if (u.task === 'hunt' && u.target >= 0) {
      const s = world.sites[u.target];
      u.tx = s.x + Math.cos(world.t * 0.6) * 140;
      u.ty = s.y - 60 + Math.sin(world.t * 0.9) * 70;
      // Breathe fire on the village or tower below, and on any mage near.
      u.cd -= dt;
      if (u.cd <= 0 && Math.hypot(u.x - s.x, u.y - s.y) < 240) {
        u.cd = 2.2 + r();
        const victim = prey ?? world.units.find((x) => x.alive && isMage(x) && Math.hypot(x.x - u.x, x.y - u.y) < 220);
        const tx = victim ? victim.x : s.x + (r() - 0.5) * 60;
        const ty = victim ? victim.y : s.y + (r() - 0.5) * 30;
        world.spells.push({ id: ids++, kind: 'breath', school: 'fire', x0: u.x + u.facing * 30, y0: u.y, x1: tx, y1: ty, t0: world.t, dur: 0.9, color: '#fb923c', from: u.id, to: victim?.id ?? -1, dmg: 12, seed: ids, hitTower: !victim && s.tower ? s.tower.id : -1 });
        if (s.kind === 'village' && s.burnt < world.t - 60) {
          s.burnt = world.t;
          s.prosper = Math.max(0, s.prosper - 0.4);
          say(`THE DRAGON BURNS ${s.name}`, s.x, s.y - 40, '#fca5a5', 'high');
          emit('dragonfire', s.x, s.y, 0.8);
          chronicle(`The dragon burned ${T(s.name)}.`);
        }
      }
    }
    const dx = u.tx - u.x;
    const dy = u.ty - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = Math.min(d, SPEED.dragon * dt * (u.task === 'home' ? 1.4 : 1));
    u.x += (dx / d) * sp;
    u.y += (dy / d) * sp;
    if (Math.abs(dx) > 2) u.facing = dx > 0 ? 1 : -1;
    if (u.task === 'home' && (u.x < -300 || u.x > GW + 300)) {
      u.alive = false;
      u.deadAt = -999;
    }
    look('dragon', u.x, u.y + 40, 1.1, 2, 6);
  }
  function dragons() {
    if (world.units.some((u) => u.kind === 'dragon' && u.alive)) return;
    if (!drew('dragon') || world.t < 70 || !world.director.want('dragon', 0.6, 240)) return;
    const targets = world.sites.filter((s) => s.kind === 'village' || (s.tower && s.tower.level > 0));
    const s = pick(targets);
    if (!s) return;
    const fromLeft = r() < 0.5;
    const d = unit('dragon', -1, fromLeft ? -300 : GW + 300, s.y - 200);
    d.flying = true;
    d.task = 'hunt';
    d.target = s.id;
    d.name = `${pick(['ASH', 'CINDER', 'GLAUR', 'VERMI', 'SKAR', 'ANCALA', 'NIDHO', 'FAFN'])}${pick(['UNG', 'AGON', 'THRAX', 'OR', 'GAR', 'IR'])}`;
    say(`THE DRAGON ${d.name} COMES`, s.x, s.y - 80, '#fb923c', 'high');
    emit('dragon', s.x, s.y, 0.9);
    chronicle(`The dragon ${T(d.name)} came over the hills to ${T(s.name)}.`);
    look('dragon', s.x, s.y - 40, 1, 10, 7);
    // The nearest orders send their mages.
    for (const o of world.orders) if (o.alive) for (const u of magesOf(o).filter((m) => Math.hypot(m.x - s.x, m.y - s.y) < 700).slice(0, 3)) {
      u.task = 'war';
      u.path = [];
      goTo(u, s.id);
    }
  }
  function rifts(dt: number) {
    if (drew('rift') && !world.rifts.some((x) => x.closed < 0) && world.t > 120 && world.director.want('rift', 0.6, 360)) {
      const free = wells().filter((s) => !s.tower);
      const s = free.length ? pick(free) : pick(world.sites.filter((x) => x.kind === 'ruin')) ?? pick(wells());
      if (s) {
        world.rifts.push({ site: s.id, x: s.x, y: s.y, r: 10, t0: world.t, closing: 0, closed: -1, next: world.t + 4 });
        say(`A RIFT TEARS OPEN AT ${s.name}`, s.x, s.y - 60, '#f0abfc', 'high');
        emit('rift', s.x, s.y, 0.95);
        chronicle(`A rift to the outer dark tore open at ${T(s.name)}.`);
        look('rift', s.x, s.y, 1.2, 12, 8);
        // Every order sends its best to close it: the old feuds wait.
        later(6, () => {
          for (const o of world.orders) if (o.alive) for (const u of magesOf(o).filter((m) => m.kind !== 'apprentice').slice(0, 2)) {
            u.task = 'close';
            u.path = [];
            goTo(u, s.id);
          }
          say('THE ORDERS SEND THEIR MAGES TO CLOSE IT', s.x, s.y - 80, '#e9d5ff', 'medium');
        });
      }
    }
    for (const rf of world.rifts) {
      if (rf.closed >= 0) continue;
      rf.r = Math.min(46, rf.r + dt * 2);
      if (world.t > rf.next) {
        rf.next = world.t + 5 + r() * 5;
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const d = unit('demon', -1, rf.x + (r() - 0.5) * 20, rf.y + (r() - 0.5) * 10);
          d.task = 'hunt';
          fx('teleport', d.x, d.y, 0.8, 12, '#f0abfc');
        }
        if (r() < 0.4) emit('demons', rf.x, rf.y, 0.4);
      }
      if (rf.closing >= 1 || world.t - rf.t0 > 300) {
        rf.closed = world.t;
        fx('burst', rf.x, rf.y, 2, 90, '#f5d0fe');
        say(rf.closing >= 1 ? `THE RIFT AT ${world.sites[rf.site].name} IS CLOSED` : 'THE RIFT FADES', rf.x, rf.y - 60, '#e9d5ff', 'high');
        emit('riftclosed', rf.x, rf.y, 0.8);
        chronicle(rf.closing >= 1 ? `The mages of the realm closed the rift at ${T(world.sites[rf.site].name)}.` : 'The rift faded on its own.');
        look('rift', rf.x, rf.y, 1.2, 8, 7);
        for (const u of world.units) {
          if (u.alive && u.kind === 'demon') die(u, null);
          if (u.alive && u.task === 'close') u.task = 'idle';
        }
        for (const o of world.orders) for (const b of world.orders) if (o !== b) o.relation[b.id] = Math.min(1, o.relation[b.id] + 0.2);
      }
    }
  }
  function comet() {
    if (!drew('comet')) return;
    const c = world.comet;
    if (!c) {
      if (world.t > 150 && world.director.want('comet', 0.5, 400)) {
        const tx = GW * (0.2 + r() * 0.6);
        const ty = GH * (0.25 + r() * 0.5);
        if (!landAt(tx, ty)) return;
        world.comet = { x: tx - 900, y: ty - 700, t0: world.t, tx, ty, landed: false };
        say('A STAR FALLS', tx, ty - 120, '#fef3c7', 'high');
        emit('comet', tx, ty, 0.6);
        look('comet', tx, ty - 80, 0.9, 9, 6);
      }
      return;
    }
    if (c.landed) {
      if (world.t - c.t0 > 120) world.comet = null;
      return;
    }
    const k = Math.min(1, (world.t - c.t0) / 5);
    c.x = c.tx - 900 * (1 - k);
    c.y = c.ty - 700 * (1 - k);
    if (k >= 1) {
      c.landed = true;
      c.t0 = world.t;
      world.spells.push({ id: ids++, kind: 'meteor', school: 'fire', x0: c.tx, y0: c.ty, x1: c.tx, y1: c.ty, t0: world.t, dur: 0.01, color: '#fde68a', from: -1, to: -1, dmg: 30, seed: ids, hitTower: -1 });
      world.marks.push({ kind: 'crater', x: c.tx, y: c.ty, r: 36, t0: world.t, dur: 600, seed: ids++ });
      say('THE STAR FALLS TO EARTH: STAR-IRON FOR WHOEVER COMES FIRST', c.tx, c.ty - 50, '#fde68a', 'high');
      emit('starfall', c.tx, c.ty, 0.9);
      chronicle('A star fell to earth, and the orders raced for its iron.');
      // A race: each order sends a mage.
      const s: Site = { id: world.sites.length, kind: 'ruin', x: c.tx, y: c.ty, name: 'THE STARFALL', links: [], tower: null, owner: -1, claimT: -1, prosper: 0, burnt: -1, searched: -999, cottages: [] };
      const nearS = world.sites.slice().sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, 2);
      world.sites.push(s);
      for (const n of nearS) {
        s.links.push(n.id);
        n.links.push(s.id);
        world.edges.push({ a: s.id, b: n.id, ley: false, flow: 0, pulse: 0 });
      }
      for (const o of world.orders) if (o.alive) {
        const m = magesOf(o).filter((u) => u.kind !== 'apprentice').sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
        if (m) {
          m.task = 'explore';
          goTo(m, s.id);
        }
      }
    }
  }
  /** The moons: every so often they align; then an order gathers for a great ritual. */
  function moons(dt: number) {
    world.moons = (world.moons + dt / 360) % 1;
    const was = world.converging;
    world.converging = drew('convergence') && world.moons > 0.86 && world.moons < 0.97;
    if (world.converging && !was) {
      say('THE MOONS CONVERGE', GW / 2, GH * 0.2, '#e9d5ff', 'high');
      emit('convergence', GW / 2, GH / 2, 0.7);
      chronicle('The moons converged, and the wells ran high.');
      const o = pick(world.orders.filter((x) => x.alive && towersOf(x).length));
      if (o) startRitual(o);
    }
    if (drew('eclipse') && !world.converging && world.moons > 0.45 && world.moons < 0.46 && once(`eclipse-${Math.floor(world.t / 360)}`)) {
      say('THE SUN IS EATEN', GW / 2, GH * 0.2, '#c4b5fd', 'high');
      emit('eclipse', GW / 2, GH / 2, 0.6);
    }
  }
  function startRitual(o: Order) {
    const tws = towersOf(o).filter((t) => t.level > 0);
    if (!tws.length) return;
    const tw = tws.sort((a, b) => b.level - a.level)[0];
    const s = world.sites[tw.site];
    const kind = o.school === 'fire' ? 'phoenix' : o.school === 'nature' ? 'grove' : o.school === 'stone' ? 'colossus' : o.school === 'light' ? 'wardstone' : o.school === 'shadow' ? 'eclipse' : o.school === 'frost' ? 'aurora' : 'starfall';
    const rt: Ritual = { order: o.id, site: s.id, t0: world.t, dur: 30, kind, done: false };
    world.rituals.push(rt);
    for (const u of magesOf(o).slice(0, 8)) {
      u.task = 'ritual';
      u.path = [];
      goTo(u, s.id);
    }
    say(`${o.name} GATHERS AT ${s.name} FOR A GREAT RITUAL`, s.x, s.y - 80, o.trim, 'high');
    emit('ritual', s.x, s.y, 0.7);
    look('ritual', s.x, s.y - 30, 1.3, 14, 6);
  }
  function rituals() {
    for (const rt of world.rituals) {
      if (rt.done) continue;
      const o = world.orders[rt.order];
      const s = world.sites[rt.site];
      if (!o.alive || !s.tower) {
        rt.done = true;
        continue;
      }
      if (world.t - rt.t0 < rt.dur) continue;
      rt.done = true;
      for (const u of world.units) if (u.alive && u.order === o.id && u.task === 'ritual') u.task = 'idle';
      const what: Record<Ritual['kind'], string> = {
        phoenix: 'A PHOENIX RISES FROM', grove: 'A FOREST SPRINGS UP AROUND', colossus: 'A STONE COLOSSUS WAKES AT', wardstone: 'A WARD OF LIGHT RISES OVER', eclipse: 'NIGHT FALLS AT NOON OVER', aurora: 'THE SKY BURNS WITH AURORA OVER', starfall: 'STARS FALL AROUND',
      };
      say(`${what[rt.kind]} ${s.name}`, s.x, s.y - 100, o.trim, 'high');
      emit('greatwork', s.x, s.y, 0.95);
      chronicle(`Under the converging moons, ${T(o.name)} worked a great ritual at ${T(s.name)}.`);
      look('ritual', s.x, s.y - 40, 1.1, 10, 7);
      fx('burst', s.x, s.y - 40, 3, 140, o.trim);
      o.mana += 150;
      s.tower.level = Math.min(5, s.tower.level + 1);
      s.tower.ward = 120;
      if (rt.kind === 'grove') for (let dy = -10; dy <= 10; dy++) for (let dx = -14; dx <= 14; dx++) {
        if (dx * dx + dy * dy * 2 > 160 || (Math.abs(dx) < 4 && Math.abs(dy) < 3)) continue;
        const i = world.cellAt(s.x + dx * CELL, s.y + dy * CELL);
        if (!water[i]) {
          forest[i] = Math.min(1, forest[i] + 0.8);
          burnt[i] = 0;
          world.dirtyCells.push(i);
        }
      }
      if (rt.kind === 'colossus' || rt.kind === 'phoenix') {
        const e = unit('guardian', o.id, s.x, s.y + 10);
        e.hp = e.hpMax = 160;
        e.school = o.school;
        e.flying = rt.kind === 'phoenix';
        e.task = 'idle';
        e.name = rt.kind === 'phoenix' ? 'THE PHOENIX' : 'THE COLOSSUS';
      }
      if (rt.kind === 'starfall') for (let k = 0; k < 8; k++) {
        const a = r() * Math.PI * 2;
        const d = 80 + r() * 160;
        later(k * 0.5, () => world.spells.push({ id: ids++, kind: 'meteor', school: 'fire', x0: s.x + Math.cos(a) * d - 300, y0: s.y + Math.sin(a) * d * 0.6 - 500, x1: s.x + Math.cos(a) * d, y1: s.y + Math.sin(a) * d * 0.6, t0: world.t, dur: 1.2, color: '#fde68a', from: -1, to: -1, dmg: 0, seed: ids, hitTower: -1 }));
      }
    }
  }
  function beasts() {
    if (world.units.filter((u) => u.kind === 'beast' && u.alive).length > 14) return;
    if ((drew('herds') || drew('wolves') || drew('giants')) && r() < 0.004) {
      const s = pick(world.sites);
      const wolves = drew('wolves') && r() < 0.5;
      const giants = drew('giants') && !wolves && r() < 0.35;
      const n = giants ? 1 : wolves ? 4 + Math.floor(r() * 4) : 6 + Math.floor(r() * 8);
      const x0 = r() < 0.5 ? 20 : GW - 20;
      for (let k = 0; k < n; k++) {
        const b = unit('beast', -1, x0 + (r() - 0.5) * 60, s.y + (r() - 0.5) * 60);
        b.name = giants ? 'giant' : wolves ? 'wolf' : 'herd';
        b.hp = b.hpMax = giants ? 120 : wolves ? 14 : 10;
        if (wolves || giants) b.task = 'hunt';
        else {
          b.task = 'wander';
          goTo(b, s.id);
        }
      }
      if (giants) {
        say('A GIANT COMES DOWN FROM THE HILLS', x0, s.y - 40, '#fca5a5', 'medium');
        emit('giant', x0, s.y, 0.5);
      } else if (wolves) emit('wolves', x0, s.y, 0.3);
      else emit('herds', x0, s.y, 0.15);
    }
  }
  function folk() {
    if ((drew('pilgrims') || drew('traders')) && r() < 0.01 && world.units.filter((u) => (u.kind === 'cart' || u.kind === 'pilgrim') && u.alive).length < 10) {
      const vs = world.sites.filter((s) => s.kind === 'village');
      if (vs.length < 2) return;
      const a = pick(vs);
      const b = pick(vs.filter((x) => x !== a));
      const trader = drew('traders') && (r() < 0.6 || !drew('pilgrims'));
      for (let k = 0; k < (trader ? 2 : 4); k++) {
        const u = unit(trader ? 'cart' : 'pilgrim', -1, a.x + k * 8, a.y);
        u.task = 'wander';
        goTo(u, trader ? b.id : (world.towers.filter((t) => t.fell < 0 && t.level >= 3)[0]?.site ?? b.id));
      }
    }
  }

  // ---- the frame -------------------------------------------------------------------------------
  function establish() {
    const p = r();
    if (p < 0.25) return { x: GW / 2, y: GH / 2, zoom: 0.6 };
    const tws = world.towers.filter((t) => t.fell < 0);
    if (p < 0.6 && tws.length) {
      const s = world.sites[pick(tws).site];
      return { x: s.x, y: s.y - 30, zoom: 1.3 };
    }
    const busy = world.units.filter((u) => u.alive && isMage(u) && u.task !== 'idle');
    const u = busy[Math.floor(r() * busy.length)];
    return u ? { x: u.x, y: u.y - 10, zoom: 1.9 } : { x: GW / 2, y: GH / 2, zoom: 0.8 };
  }
  let nextMind = 0.5;
  let nextBlight = 0;
  function step(dt: number) {
    world.t += dt;
    world.day = (world.day + dt / DAY) % 1;
    world.director.step(world.t, dt);
    for (let i = pending.length - 1; i >= 0; i--) if (world.t >= pending[i].at) {
      const f = pending[i].fn;
      pending.splice(i, 1);
      f();
    }
    if (world.t >= nextMind) {
      nextMind = world.t + 1;
      for (const o of world.orders) orderMind(o);
      beasts();
      folk();
      dragons();
      comet();
      // The ley lines: power runs from the wells to the towers on them.
      for (const e of world.edges) {
        if (!e.ley) continue;
        const a = world.sites[e.a].tower;
        const b = world.sites[e.b].tower;
        e.flow = (a && a.level > 0 ? 0.5 : 0) + (b && b.level > 0 ? 0.5 : 0) + (world.converging ? 0.5 : 0);
      }
      if (drew('blight') && world.t > nextBlight) {
        nextBlight = world.t + 4;
        const ru = world.sites.filter((s) => s.kind === 'ruin');
        for (const s of ru) {
          const c = world.cellAt(s.x + (r() - 0.5) * 160, s.y + (r() - 0.5) * 100);
          if (!water[c]) {
            blight[c] = Math.min(1, blight[c] + 0.5);
            world.dirtyCells.push(c);
          }
        }
      }
    }
    for (const e of world.edges) e.pulse = (e.pulse + dt * (0.2 + e.flow * 0.3)) % 1;
    for (const u of world.units) if (u.alive) act(u, dt);
    for (const tw of world.towers) towerStep(tw, dt);
    stormStep(dt);
    rifts(dt);
    moons(dt);
    rituals();
    // Spells in flight land.
    for (let i = world.spells.length - 1; i >= 0; i--) {
      const sp = world.spells[i];
      if (world.t - sp.t0 >= sp.dur) {
        world.spells.splice(i, 1);
        impact(sp);
      }
    }
    // Marks fade; the land heals.
    for (let i = world.marks.length - 1; i >= 0; i--) if (world.t - world.marks[i].t0 > world.marks[i].dur) world.marks.splice(i, 1);
    if (Math.floor(world.t * 2) !== Math.floor((world.t - dt) * 2)) for (let k = 0; k < 40; k++) {
      const i = Math.floor(r() * N);
      if (burnt[i] > 0) {
        burnt[i] = Math.max(0, burnt[i] - 0.05);
        if (burnt[i] === 0) world.dirtyCells.push(i);
      }
      if (frost[i] > 0) {
        frost[i] = Math.max(0, frost[i] - 0.08);
        if (frost[i] === 0) world.dirtyCells.push(i);
      }
    }
    world.units = world.units.filter((u) => u.alive || (u.deadAt > 0 && world.t - u.deadAt < 6));
    for (let i = world.fx.length - 1; i >= 0; i--) if (world.t - world.fx[i].t0 > world.fx[i].dur) world.fx.splice(i, 1);
    if (world.fx.length > 400) world.fx.splice(0, world.fx.length - 400);
    if (world.marks.length > 200) world.marks.splice(0, world.marks.length - 200);
    for (let i = world.labels.length - 1; i >= 0; i--) if (world.t - world.labels[i].t0 > world.labels[i].dur) world.labels.splice(i, 1);
  }

  world.director = createDirector(g.fork('director').rng, { arc: g.pick(ARCS), period: g.range(220, 360), floor: 0.3, establish });
  for (const o of world.orders) chronicle(`${T(o.name)} held ${T(world.sites[o.capital].name)}, under ${T(o.archmage)}.`);
  return world;
}
