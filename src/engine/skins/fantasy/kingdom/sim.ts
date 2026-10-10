/**
 * The dwarven kingdom: a range of mountains in cutaway, and the clans that dig it. No DOM.
 *
 * The range is wider than the screen (the camera pans along it). Each seed draws:
 * - the mountain (iron, crystal, frost, ember, drowned)
 * - two to four holds, each a clan with its own banner, king, and architecture: how it goes
 *   down (ladders, a lift, stair flights that zigzag), how it carves its rooms (arched,
 *   domed, tiered, vaulted, plain), how it lights them (torches, braziers, crystal lamps,
 *   lava channels), whether it lines them in dressed stone, lays rails, and raises statues
 * - a cast (kit/compose, cast.ts): what lies below, hazards, neighbours, wonders, fauna, the
 *   sky (a dragon), and the temper of the clans' politics
 *
 * The holds never stop building. Each has an endless plan: deeper levels, rooms as the clan
 * needs them, mines along the veins (with rails), grand halls with statues of its kings,
 * galleries of kings, a face carved on the mountain, highways to the neighbouring holds with
 * bridges over the caverns they cross. Dwarves dig fast enough to watch; haulers cart the ore;
 * smiths, brewers, farmers, and masons work; they sleep in shifts and feast.
 *
 * The holds trade along the highways, and fall out: wars march soldier columns through the
 * tunnels to sack an enemy's hall; a hold emptied falls, and another clan takes it. Goblins
 * come to the gates; a dragon over the range burns a gate; the rock floods, burns, caves in;
 * the caverns let out what lives in them; and something below wakes when they dig near it.
 *
 * Everyone walks the tunnels for real (breadth-first over the open cells). Space: world px,
 * cells CELL px; the director (kit) paces the big moments and points the camera.
 */
import { forkRng, type Rng } from '../../../rng';
import { createBus, type Bus } from '../../../sim/bus';
import { compose, createDirector, createGenome, ARCS, WORLD_SCALE, type Director, type Genome } from '../../../kit';
import { titled } from '../names';
import { KINGDOM_CAST, KINGDOM_RULE } from './cast';

export type Mountain = 'iron' | 'crystal' | 'frost' | 'ember' | 'drowned';
const MOUNTAINS: Mountain[] = ['iron', 'crystal', 'frost', 'ember', 'drowned'];
export const MOUNTAIN_NAMES: Record<Mountain, string> = { iron: 'THE IRON RANGE', crystal: 'THE CRYSTAL PEAKS', frost: 'THE FROSTSPINES', ember: 'THE EMBER MOUNTAINS', drowned: 'THE DROWNED PEAKS' };

export const M = { SKY: 0, OPEN: 1, CAVE: 2, SOIL: 3, STONE: 4, SLATE: 5, DEEP: 6, BASALT: 7, ICE: 8, IRON: 9, COAL: 10, GOLD: 11, GEM: 12, MITHRIL: 13, AQUIFER: 14, MAGMA: 15, RUIN: 16, RUBBLE: 17, OBSIDIAN: 18, SEAL: 19, MASON: 20, CARVED: 21, BRIDGE: 22 } as const;
const HARD = [0, 0, 0, 0.5, 1.1, 0.9, 1.6, 2.4, 0.8, 1.3, 0.8, 1.2, 1.8, 3, 0.9, 2, 1.5, 0.35, 3, 4, 3, 3, 1];
export const isOpen = (m: number) => m <= 2;
const ORE: Partial<Record<number, Load['kind']>> = { 9: 'iron', 10: 'coal', 11: 'gold', 12: 'gem', 13: 'mithril' };

export type Job = 'miner' | 'hauler' | 'smith' | 'brewer' | 'farmer' | 'mason' | 'soldier' | 'king';
export type RoomKind = 'entrance' | 'store' | 'dorm' | 'farm' | 'brewery' | 'forge' | 'hall' | 'temple' | 'tomb' | 'barracks' | 'treasury' | 'pump' | 'library' | 'kings' | 'vault';
export type Shape = 'rect' | 'arch' | 'dome' | 'tiered' | 'vault';
export const ROOM_NAMES: Record<RoomKind, string> = {
  entrance: 'THE GATEHALL', store: 'THE STOREROOM', dorm: 'THE DORMITORY', farm: 'THE MUSHROOM FARM', brewery: 'THE BREWERY', forge: 'THE FORGE', hall: 'THE GREAT HALL', temple: 'THE TEMPLE',
  tomb: 'THE TOMBS', barracks: 'THE BARRACKS', treasury: 'THE TREASURY', pump: 'THE PUMPS', library: 'THE HALL OF RECORDS', kings: 'THE GALLERY OF KINGS', vault: 'THE VAULTED HALL',
};
/** Width and height in cells (the height includes the gallery's three rows). */
const ROOM_SIZE: Record<RoomKind, [number, number]> = {
  entrance: [14, 6], store: [10, 5], dorm: [12, 5], farm: [14, 5], brewery: [9, 5], forge: [10, 6], hall: [24, 8], temple: [12, 8], tomb: [11, 5], barracks: [11, 5], treasury: [9, 6], pump: [6, 5], library: [10, 6], kings: [20, 8], vault: [16, 9],
};

export type Load = { id: number; kind: 'iron' | 'coal' | 'gold' | 'gem' | 'mithril'; cell: number; taken: boolean; skip: number; hold: number };
export type Room = { id: number; hold: number; kind: RoomKind; shape: Shape; level: number; c0: number; c1: number; top: number; floor: number; dug: boolean; furnished: boolean; statue: boolean; ruined: boolean; work: number };
export type Style = {
  gap: number; shaft: 'ladder' | 'lift' | 'stair'; shaftW: number; shapes: Record<Shape, number>; layout: 'tree' | 'terrace' | 'warren' | 'grand';
  light: 'torch' | 'brazier' | 'crystal' | 'lava'; statues: number; rails: boolean; masonry: boolean; hallScale: number; stone: string;
};
export type Level = { k: number; floor: number; anchor: number; left: number; right: number };
export type Stocks = { food: number; ale: number; iron: number; coal: number; gold: number; gem: number; mithril: number; goods: number; treasure: number };
export type Hold = {
  id: number; name: string; clan: string; color: string; style: Style; shaftC: number; gateC: number; gateFloor: number; side: 1 | -1; x0: number; x1: number;
  levels: Level[]; king: Dwarf | null; reign: number; stocks: Stocks; artifacts: { name: string; maker: string }[]; deaths: number; fallen: boolean; fallenAt: number;
  relation: number[]; war: number; warT0: number; lift: { y: number; dir: 1 | -1 } | null; face: boolean; faceC: number; faceR: number; attacked: boolean; feast: number; nextFeast: number; nextMigrants: number; gateOpen: boolean; gateHp: number; founded: number;
};
export type Task = {
  kind: 'dig' | 'haul' | 'work' | 'sleep' | 'feast' | 'flee' | 'fight' | 'furnish' | 'idle' | 'leave' | 'mood' | 'enter' | 'march' | 'trade' | 'carve';
  cell?: number; room?: Room; load?: Load; until?: number; t0: number; stage?: number; target?: number;
};
export type Dwarf = {
  id: number; hold: number; name: string; job: Job; x: number; y: number; at: number; route: number[]; ri: number; task: Task | null; hp: number; alive: boolean; deadAt: number; anim: number;
  facing: 1 | -1; beard: number; variant: number; age: number; fails: number; carry: Load | null; cart: boolean; swingUntil: number; drown: number; cd: number; repath: number; outside: boolean; crossbow: boolean; sick: number; squad: number;
};
export type FoeKind = 'goblin' | 'spider' | 'troll' | 'skeleton' | 'crawler' | 'trader' | 'mule' | 'golem' | 'gnome' | 'mushroom' | 'lich' | 'engine' | 'queen' | 'sleeper';
export type Foe = { id: number; kind: FoeKind; x: number; y: number; at: number; route: number[]; ri: number; hp: number; hpMax: number; alive: boolean; deadAt: number; anim: number; facing: 1 | -1; cd: number; home: number; active: boolean; boss: boolean; swingUntil: number; repath: number; lost: number; task: 'wander' | 'hunt' | 'gate' | 'leave' | 'trade'; target: number };
export type SleeperKind = 'worm' | 'spider' | 'giant' | 'demon' | 'tentacle';
export type Cavern = { id: number; c: number; r: number; known: boolean; kind: 'cavern' | 'lake' | 'ruin' | 'lair' | 'geode' | 'shrine' | 'warren' | 'gnomes' | 'engine' | 'hive'; clearAt: number; claimed: boolean; name: string };
export type Fx = { kind: 'dust' | 'spark' | 'glint' | 'blast' | 'steam' | 'rubble' | 'bolt' | 'fire' | 'z' | 'breath'; x: number; y: number; x1?: number; y1?: number; t0: number; dur: number; r: number; seed: number; color?: string };
export type Label = { text: string; x: number; y: number; color: string; t0: number; dur: number };
export type Highway = { a: number; b: number; floor: number; c0: number; c1: number; open: boolean };
export type Dragon = { x: number; y: number; vx: number; vy: number; hp: number; target: number; t0: number; state: 'come' | 'burn' | 'leave' | 'fall'; breathing: boolean; wing: number; name: string; color: number };

export type KingdomOptions = { mountain: string; holds: number | string; hazards: number; below: string; scale: number; camera?: string };

export type KingdomWorld = {
  t: number; W: number; H: number; GW: number; GH: number; CELL: number; cols: number; rows: number; bus: Bus; director: Director;
  mountain: Mountain; cast: string[]; castIds: string[]; below: string; sleeperKind: SleeperKind; sleeperTint: string; sleeperName: string;
  mat: Uint8Array; water: Float32Array; magma: Float32Array; ladder: Uint8Array; rail: Uint8Array; plank: Uint8Array; roomAt: Int16Array; caveAt: Int16Array; owner: Int8Array;
  dirty: number[]; surface: Int16Array;
  holds: Hold[]; rooms: Room[]; dwarves: Dwarf[]; foes: Foe[]; caverns: Cavern[]; loads: Load[]; highways: Highway[]; mines: number[][]; dragon: Dragon | null;
  fx: Fx[]; labels: Label[]; chronicle: { t: number; text: string }[];
  day: number; season: number; year: number; quake: number;
  cellX(i: number): number;
  cellY(i: number): number;
  holdAt(c: number): Hold;
  wealth(h: Hold): number;
  step(dt: number): void;
  /** A visitor touched the range at (x, y), in world pixels. Returns the line said, or null. */
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

const DAY = 220;
const SEASON = 160;
export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;
const ORD = ['GATE', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH'];
export const deepName = (k: number) => (k <= 0 ? 'THE GATEHALL' : `THE ${ORD[k] ?? `${k}TH`} DEEP`);
const N1 = ['UR', 'THO', 'BAL', 'DU', 'GIM', 'KHA', 'BRO', 'FUN', 'NAR', 'OI', 'GLO', 'THRA', 'BO', 'MO', 'DAI', 'KI', 'NO', 'FRE', 'BRA', 'GRO', 'HE', 'SKA'];
const N2 = ['IN', 'RIN', 'LI', 'DIN', 'GAR', 'DOK', 'BUR', 'NAR', 'LOK', 'GRIM', 'DUR', 'MIR', 'THOR', 'BALD', 'RAK', 'RIK', 'KAR', 'VI', 'ROD', 'MLI'];
const CLAN1 = ['STONE', 'IRON', 'DEEP', 'GOLD', 'ANVIL', 'COPPER', 'GRANITE', 'ASH', 'FROST', 'EMBER', 'HAMMER', 'BRONZE', 'COAL', 'SILVER', 'FLINT', 'OAK'];
const CLAN2 = ['BEARD', 'FIST', 'HELM', 'FORGE', 'DELVER', 'SHIELD', 'MANTLE', 'HEART', 'BROW', 'BORN', 'GUARD', 'HAND'];
const HOLD1 = ['KAR', 'BAR', 'DUR', 'ZAR', 'GUN', 'MOR', 'THAR', 'NAL', 'BRUN', 'KHEL', 'AZ', 'VOR', 'GAB', 'EREB'];
const HOLD2 = ['AK', 'GRIM', 'HELM', 'DAL', 'KUL', 'UND', 'RUK', 'BAZ', 'DRUM', 'GOL', 'ZIRAK', 'HOLD', 'DUN'];
const BANNERS = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7e22ce', '#0f766e', '#c2410c', '#be123c'];
const ART_KIND = ['AXE', 'HAMMER', 'CROWN', 'SHIELD', 'CHALICE', 'RING', 'HELM', 'ANVIL', 'LANTERN', 'BLADE'];
const ART_NAME = ['STARFALL', 'DEEPHEART', 'EMBERKISS', 'OATHSTONE', 'NIGHTFORGE', 'GLOAMING', 'KINGSBANE', 'THE LONG MEMORY', 'MOUNTAINROOT', 'FIRSTLIGHT', 'GRUDGEKEEPER'];

export function createKingdom(seed: string | number, W: number, H: number, opts: KingdomOptions): KingdomWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'kingdom');
  const g: Genome = createGenome(seed, 'kingdom');
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  let ids = 1;
  const mountain: Mountain = (MOUNTAINS as string[]).includes(opts.mountain) ? (opts.mountain as Mountain) : g.pick(MOUNTAINS);
  const hz = Math.max(0, opts.hazards);
  const scale = Math.max(0.5, Math.min(2, opts.scale ?? 1));
  const castDrawn = compose(g.fork('cast'), { mountain, hazards: hz, below: opts.below ?? 'any' }, KINGDOM_CAST, KINGDOM_RULE);
  const drew = (id: string) => castDrawn.some((c) => c.def.id === id);
  // The whole range on screen (the default): the world in the screen's proportions, a little
  // larger; a bigger `scale` means smaller cells, not a world off the edge. Or the old range,
  // two to three screens wide, for the director's camera to pan over.
  const whole = opts.camera !== 'director';
  const wide = g.range(2.4, 3.3);
  const deep = g.range(2.0, 2.5);
  const CELL = whole ? Math.max(4, Math.round(H / (105 * Math.sqrt(scale)))) : Math.max(5, Math.round(H / 105));
  const cols = whole ? Math.ceil((W * WORLD_SCALE) / CELL) : Math.ceil((W * wide * Math.sqrt(scale)) / CELL);
  const rows = whole ? Math.ceil((H * WORLD_SCALE) / CELL) : Math.ceil((H * deep) / CELL);
  const N = cols * rows;
  const mat = new Uint8Array(N);
  const water = new Float32Array(N);
  const magma = new Float32Array(N);
  const ladder = new Uint8Array(N);
  const rail = new Uint8Array(N);
  const plank = new Uint8Array(N);
  /** Cells some dig means to open (rooms keep clear of them). */
  const resv = new Uint8Array(N);
  const roomAt = new Int16Array(N).fill(-1);
  const caveAt = new Int16Array(N).fill(-1);
  const owner = new Int8Array(N).fill(-1);
  const veinAt = new Int16Array(N).fill(-1);
  const surface = new Int16Array(cols);
  const SK: SleeperKind[] = ['worm', 'spider', 'giant', 'demon', 'tentacle'];
  const sleeperKind = g.weighted({ worm: mountain === 'iron' ? 3 : 1, spider: mountain === 'crystal' ? 3 : 1, giant: mountain === 'frost' ? 3 : 1, demon: mountain === 'ember' ? 3 : 1, tentacle: mountain === 'drowned' ? 3 : 1 } as Record<SleeperKind, number>);
  void SK;
  const TINTS: Record<SleeperKind, string[]> = { worm: ['#78716c', '#9a3412', '#475569'], spider: ['#a78bfa', '#f0abfc', '#67e8f9'], giant: ['#cbd5e1', '#a5f3fc', '#d6d3d1'], demon: ['#44201a', '#3b0764', '#1c1917'], tentacle: ['#052e16', '#1e1b4b', '#3f0d12'] };
  const NOUN_S: Record<SleeperKind, string[]> = { worm: ['WORM', 'STONE-EATER', 'DEVOURER'], spider: ['MOTHER', 'WEAVER', 'SPINNER'], giant: ['KING', 'GIANT', 'WARDEN'], demon: ['FLAME', 'BALEFIRE', 'LORD BELOW'], tentacle: ['ONE', 'DREAMER', 'THING BELOW'] };

  const world: KingdomWorld = {
    t: 0, W, H, GW: cols * CELL, GH: rows * CELL, CELL, cols, rows, bus,
    director: null as unknown as Director,
    mountain, cast: castDrawn.map((c) => c.def.label ?? c.def.id), castIds: castDrawn.map((c) => c.def.id), below: castDrawn.find((c) => c.def.tags.includes('below'))?.def.id ?? 'nothing',
    sleeperKind, sleeperTint: g.pick(TINTS[sleeperKind]), sleeperName: `THE ${g.pick(['HUNGERING', 'PALE', 'OLD', 'DROWNED', 'BURNING', 'BLIND', 'NAMELESS', 'GLASS', 'RIME', 'DREAMING'])} ${g.pick(NOUN_S[sleeperKind])}`,
    mat, water, magma, ladder, rail, plank, roomAt, caveAt, owner, dirty: [], surface,
    holds: [], rooms: [], dwarves: [], foes: [], caverns: [], loads: [], highways: [], mines: [], dragon: null,
    fx: [], labels: [], chronicle: [], day: 0.32, season: Math.floor(r() * 3), year: 200 + Math.floor(r() * 600), quake: 0,
    cellX: (i) => ((i % cols) + 0.5) * CELL,
    cellY: (i) => (Math.floor(i / cols) + 1) * CELL,
    holdAt: (c) => holdAt(c),
    wealth: (h) => {
      const s = h.stocks;
      return Math.round(s.goods * 10 + s.gold * 8 + s.gem * 20 + s.mithril * 60 + s.treasure * 30 + h.artifacts.length * 500);
    },
    step,
    nudge: (x, y) => nudge(x, y),
    counts() {
      return {
        holds: world.holds.filter((h) => !h.fallen).length,
        dwarves: alive().length,
        rooms: world.rooms.filter((x) => x.dug).length,
        digs: digs.length,
        highways: world.highways.filter((h) => h.open).length,
        wars: world.holds.filter((h) => h.war >= 0).length,
        foes: world.foes.filter((f) => f.alive && f.active && !neutral(f)).length,
        bosses: world.foes.filter((f) => f.boss && f.alive).length,
        deepest: Math.max(0, ...world.holds.map((h) => h.levels.length - 1)),
      };
    },
  };
  const alive = () => world.dwarves.filter((d) => d.alive);
  const at = (c: number, rr: number) => rr * cols + c;
  const inb = (c: number, rr: number) => c >= 0 && c < cols && rr >= 0 && rr < rows;
  const neutral = (f: Foe) => f.kind === 'trader' || f.kind === 'mule' || f.kind === 'gnome' || f.kind === 'mushroom';
  const hostile = (f: Foe) => f.alive && f.active && !neutral(f);
  const setMat = (i: number, m: number) => {
    if (mat[i] === m) return;
    mat[i] = m;
    world.dirty.push(i);
  };

  // ---- telling -------------------------------------------------------------------------------------
  const say = (text: string, x: number, y: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 5)) return;
    world.labels.push({ text, x, y, color, t0: world.t, dur: 5.5 });
    if (world.labels.length > 10) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, color, priority });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 6) world.chronicle.shift();
  };
  const T = titled;
  const look = (_why: string, x: number, y: number, zoom: number, dur: number, priority = 3) => world.director.look(_why, x, y, zoom, dur, priority);
  const said = new Set<string>();
  const once = (k: string) => (said.has(k) ? false : (said.add(k), true));
  const pending: { at: number; fn: () => void }[] = [];
  const later = (s: number, fn: () => void) => pending.push({ at: world.t + s, fn });
  const quake = (k: number) => (world.quake = Math.max(world.quake, k));

  // ---- the range -----------------------------------------------------------------------------------
  // As many holds as fit side by side (one on a phone), up to what was asked or drawn.
  const room = Math.max(1, Math.floor(cols / 62));
  const nHolds = Math.max(1, Math.min(4, room, Number(opts.holds) > 0 ? Math.round(Number(opts.holds)) : [2, 3, 4][Number(g.weighted({ 0: 1, 1: 2.2, 2: 1.3 }))]));
  const baseR = Math.round(rows * 0.24);
  const peaks: [number, number, number][] = [];
  for (let k = 0; k < nHolds; k++) peaks.push([((k + 0.5) / nHolds) * cols + g.normal(0, cols * 0.03), baseR - rows * g.range(0.12, 0.2), cols * g.range(0.22, 0.32) / nHolds * 1.6]);
  for (let c = 0; c < cols; c++) {
    let h = baseR;
    for (const [pc, top, wd] of peaks) h = Math.min(h, top + (baseR - top) * Math.min(1, (Math.abs(c - pc) / wd) ** 1.15));
    surface[c] = Math.round(h + Math.sin(c * 0.37) * 0.8 + Math.sin(c * 0.11 + 2) * 1.2);
  }
  for (let pass = 0; pass < 2; pass++) for (let c = 1; c < cols; c++) if (Math.abs(surface[c] - surface[c - 1]) > 1) surface[c] = surface[c - 1] + Math.sign(surface[c] - surface[c - 1]);
  // ---- the holds' places ------------------------------------------------------------------------------
  const taken = new Set<string>();
  const uniq = (f: () => string) => {
    let s = f();
    for (let k = 0; k < 8 && taken.has(s); k++) s = f();
    taken.add(s);
    return s;
  };
  const banners = g.shuffle(BANNERS);
  const style = (hg: Genome): Style => {
    const shaft = hg.weighted({ ladder: 3, lift: 2, stair: 3 });
    return {
      gap: hg.int(8, 11), shaft, shaftW: shaft === 'lift' ? 3 : 2,
      shapes: { rect: hg.range(0, 1), arch: hg.range(0, 2), dome: hg.range(0, 1.4), tiered: hg.range(0, 1.2), vault: hg.range(0, 0.6) },
      layout: hg.weighted({ tree: 3, terrace: 2, warren: 2, grand: 2 }), light: hg.weighted({ torch: 4, brazier: 2, crystal: 1.2, lava: mountain === 'ember' ? 2 : 0.6 }),
      statues: hg.range(0.2, 0.9), rails: hg.chance(0.8), masonry: hg.chance(0.85), hallScale: hg.range(0.9, 1.4), stone: hg.pick(['#8a8478', '#9c8f7a', '#7c8794', '#8b7d8f', '#a39274']),
    };
  };
  for (let k = 0; k < nHolds; k++) {
    const x0 = Math.round((k / nHolds) * cols);
    const x1 = Math.round(((k + 1) / nHolds) * cols) - 1;
    const sc = Math.round(peaks[k][0] + g.range(-0.08, 0.08) * (x1 - x0));
    const side: 1 | -1 = sc < (x0 + x1) / 2 ? -1 : 1;
    const gf = Math.min(baseR - 3, surface[sc] + g.int(9, 15));
    let gate = sc;
    while (gate > x0 + 2 && gate < x1 - 2 && surface[gate] < gf - 1) gate += side;
    // A flat dooryard before the gate, then the slope.
    for (let j = 0; j < 7; j++) {
      const c = gate + side * j;
      if (c >= 0 && c < cols) surface[c] = gf + 1;
    }
    for (let c = gate + side * 7; c >= 0 && c < cols && c >= x0 - 30 && c <= x1 + 30; c += side) {
      const p = surface[c - side];
      if (Math.abs(surface[c] - p) > 1) surface[c] = p + Math.sign(surface[c] - p);
    }
    const hg = g.fork(`hold-${k}`);
    world.holds.push({
      id: k, name: uniq(() => pick(HOLD1) + pick(HOLD2)), clan: uniq(() => pick(CLAN1) + pick(CLAN2)), color: banners[k % banners.length], style: style(hg),
      shaftC: sc, gateC: gate - side, gateFloor: gf, side, x0, x1, levels: [], king: null, reign: 1,
      stocks: { food: 40, ale: 30, iron: 3, coal: 3, gold: 0, gem: 0, mithril: 0, goods: 4, treasure: 0 }, artifacts: [], deaths: 0, fallen: false, fallenAt: -1,
      relation: [], war: -1, warT0: -1, lift: null, face: false, faceC: -1, faceR: -1, attacked: false, feast: -1, nextFeast: 60 + r() * 140, nextMigrants: 40 + r() * 80, gateOpen: true, gateHp: 120, founded: 0,
    });
  }
  for (let rr = 0; rr < rows; rr++) {
    const f = rr / rows;
    for (let c = 0; c < cols; c++) {
      const i = at(c, rr);
      const d = rr - surface[c];
      if (d < 0) mat[i] = M.SKY;
      else if (d < 3) mat[i] = mountain === 'frost' && rr < baseR - 4 ? M.ICE : M.SOIL;
      else if (f < 0.4) mat[i] = M.STONE;
      else if (f < (mountain === 'ember' ? 0.52 : 0.62)) mat[i] = M.SLATE;
      else if (f < (mountain === 'ember' ? 0.66 : 0.82)) mat[i] = M.DEEP;
      else mat[i] = M.BASALT;
    }
  }
  const rockAt = (i: number) => mat[i] >= M.SOIL && mat[i] <= M.ICE;
  const area = N / 30000;
  const vein = (m: number, f0: number, f1: number, len: number, near?: [number, number]) => {
    let c = near ? near[0] : 4 + r() * (cols - 8);
    let rr = near ? near[1] : rows * (f0 + r() * (f1 - f0));
    let a = r() * Math.PI * 2;
    const id = ids++;
    for (let s = 0; s < len; s++) {
      a += (r() - 0.5) * 0.9;
      c += Math.cos(a);
      rr += Math.sin(a) * 0.6;
      for (const [dc, dr] of [[0, 0], [1, 0], [0, 1]]) {
        if (dc + dr > 0 && r() < 0.5) continue;
        const cc = Math.round(c) + dc;
        const r2 = Math.round(rr) + dr;
        if (!inb(cc, r2) || r2 < surface[cc] + 4) continue;
        const i = at(cc, r2);
        if (rockAt(i)) {
          mat[i] = m;
          veinAt[i] = id;
        }
      }
    }
  };
  const kk = (base: number, mul = 1) => Math.round(base * area * mul);
  for (let i = 0; i < kk(8, mountain === 'iron' ? 1.6 : 1); i++) vein(M.COAL, 0.2, 0.6, 20 + r() * 30);
  for (let i = 0; i < kk(8, mountain === 'iron' ? 2 : 1); i++) vein(M.IRON, 0.22, 0.75, 18 + r() * 30);
  for (let i = 0; i < kk(5, mountain === 'ember' ? 1.4 : 1); i++) vein(M.GOLD, 0.35, 0.85, 14 + r() * 24);
  for (let i = 0; i < kk(4, mountain === 'crystal' ? 2.6 : 1); i++) vein(M.GEM, 0.45, 0.95, 10 + r() * 20);
  for (let i = 0; i < (drew('lode') ? 5 : 1); i++) vein(M.MITHRIL, drew('lode') ? 0.5 : 0.85, 0.92, 16 + r() * 16);

  const blob = (c0: number, r0: number, rx: number, ry: number, fn: (i: number, c: number, rr: number) => void) => {
    for (let rr = Math.floor(r0 - ry - 1); rr <= r0 + ry + 1; rr++) for (let c = Math.floor(c0 - rx - 1); c <= c0 + rx + 1; c++) {
      if (!inb(c, rr)) continue;
      const u = (c - c0) / rx;
      const v = (rr - r0) / ry;
      const edge = 1 + Math.sin(c * 0.9 + rr * 1.3 + c0) * 0.12 + Math.sin(c * 0.31 - rr * 0.7) * 0.1;
      if (u * u + v * v <= edge) fn(at(c, rr), c, rr);
    }
  };

  const politics = drew('rivals') ? -0.2 : drew('allies') ? 0.5 : 0.1;
  for (const a of world.holds) a.relation = world.holds.map((b) => (a === b ? 1 : politics + g.range(-0.3, 0.3)));
  for (const a of world.holds) for (const b of world.holds) b.relation[a.id] = a.relation[b.id];
  const holdAt = (c: number) => world.holds.find((h) => c >= h.x0 && c <= h.x1) ?? world.holds[0];
  const safe = (c: number, rr: number, pad: number) => world.holds.some((h) => Math.abs(c - h.shaftC) < 22 + pad && rr < h.gateFloor + h.style.gap * 2 + 5 + pad);

  // ---- hazards, caverns, chambers ------------------------------------------------------------------------
  const place = (f0: number, f1: number, rx: number, ry: number) => {
    for (let tries = 0; tries < 40; tries++) {
      const c = 4 + rx + r() * (cols - 8 - rx * 2);
      const rr = rows * (f0 + r() * (f1 - f0));
      if (safe(c, rr, rx) || rr - ry < surface[Math.round(c)] + 6) continue;
      return [c, rr] as [number, number];
    }
    return null;
  };
  const near = (f0: number, f1: number, hw: number): [number, number] | null => {
    for (let tries = 0; tries < 40; tries++) {
      const h = pick(world.holds);
      const c = h.shaftC + (r() < 0.5 ? -1 : 1) * (hw + 6 + r() * 22);
      const rr = rows * (f0 + r() * (f1 - f0));
      if (c - hw < 3 || c + hw > cols - 4 || safe(c, rr, hw) || rr - 6 < surface[Math.round(c)] + 6) continue;
      return [c, rr];
    }
    return null;
  };
  const nAquifers = drew('floods') ? Math.round(kk(4, mountain === 'drowned' ? 2 : 1) * hz * g.range(0.7, 1.4)) : 0;
  for (let n = 0; n < nAquifers; n++) {
    const p = place(0.22, 0.75, 6, 3);
    if (p) blob(p[0], p[1], 3 + r() * 6, 2 + r() * 2.5, (i) => rockAt(i) && (mat[i] = M.AQUIFER));
  }
  const nMagma = drew('magma') ? Math.round(kk(2, mountain === 'ember' ? 2 : 1) * hz * g.range(0.8, 1.6)) : 0;
  for (let n = 0; n < nMagma; n++) {
    const p = place(0.5, 0.9, 5, 3);
    if (p) blob(p[0], p[1], 3 + r() * 4, 2 + r() * 2, (i) => mat[i] >= M.SOIL && mat[i] !== M.SKY && (mat[i] = M.MAGMA));
  }
  const cavern = (kind: Cavern['kind'], f0: number, f1: number, rx: number, ry: number, name: string, close = false) => {
    const p = close ? near(f0, f1, rx) : place(f0, f1, rx, ry);
    if (!p) return null;
    const cv: Cavern = { id: world.caverns.length, c: p[0], r: p[1], known: false, kind, clearAt: -1, claimed: false, name };
    world.caverns.push(cv);
    blob(p[0], p[1], rx, ry, (i, _c, rr) => {
      if (mat[i] === M.SKY) return;
      mat[i] = M.CAVE;
      caveAt[i] = cv.id;
      if (kind === 'lake' && rr > p[1] + ry * 0.1) water[i] = 1;
    });
    return cv;
  };
  const CA = ['GLOWING', 'WEEPING', 'LONG', 'ECHOING', 'HOLLOW', 'SUNLESS', 'WHISPERING', 'DRIPPING', 'GREEN', 'SILENT', 'FOLDED'];
  const CB = ['DARK', 'WOOD', 'VAULT', 'GARDENS', 'DEEPS', 'GALLERIES', 'MAZE', 'CHAPELS', 'SPIRES', 'FOREST'];
  for (let n = 0; n < Math.max(2, Math.round(g.lognormal(4, 0.3) * Math.sqrt(scale) * Math.min(1.5, 0.5 + hz * 0.5))); n++) cavern('cavern', 0.3, 0.88, g.range(10, 24), g.range(3.5, 8), `THE ${pick(CA)} ${pick(CB)}`);
  if (drew('lake')) cavern('lake', 0.4, 0.75, g.range(16, 28), g.range(4, 7), `THE ${pick(['BLACK', 'STILL', 'DROWNED', 'MIRROR'])} LAKE`);
  const chamber = (kind: Cavern['kind'], f0: number, f1: number, hw: number, name: string) => {
    const p = near(f0, f1, hw + 2);
    if (!p) return null;
    const cv: Cavern = { id: world.caverns.length, c: p[0], r: p[1], known: false, kind, clearAt: -1, claimed: false, name };
    world.caverns.push(cv);
    for (let rr = Math.round(p[1]) - 4; rr <= Math.round(p[1]) + 2; rr++) for (let c = Math.round(p[0]) - hw; c <= Math.round(p[0]) + hw; c++) {
      if (!inb(c, rr)) continue;
      const i = at(c, rr);
      const wall = rr === Math.round(p[1]) - 4 || rr === Math.round(p[1]) + 2 || Math.abs(c - p[0]) >= hw - 0.5;
      mat[i] = wall ? M.RUIN : M.CAVE;
      if (!wall) caveAt[i] = cv.id;
    }
    return cv;
  };
  const elder = `${pick(N1)}${pick(N2)}`;
  const ruin = drew('ruins') || drew('lich') ? chamber('ruin', 0.28, 0.5, 9 + Math.floor(r() * 5), `THE HALLS OF ${elder} THE ELDER`) : null;
  if (drew('shrine')) chamber('shrine', 0.3, 0.55, 6, `THE SHRINE OF ${pick(['THE STONEFATHER', 'THE FORGE-MOTHER', 'THE DEEP KING', 'THE FIRST HAMMER'])}`);
  if (drew('geode')) cavern('geode', 0.3, 0.6, g.range(7, 12), g.range(4, 6), `THE ${pick(['STAR', 'AMETHYST', 'SAPPHIRE', 'SUNSTONE'])} GEODE`, true);
  if (drew('warren')) cavern('warren', 0.35, 0.7, g.range(10, 16), g.range(3, 5), `THE ${pick(['RED', 'GNAWED', 'BONE', 'TWISTED'])} WARREN`, true);
  if (drew('deepfolk')) cavern('gnomes', 0.45, 0.8, g.range(10, 16), g.range(4, 6), `THE ${pick(['LANTERN', 'QUIET', 'COPPER', 'MOSS'])} HOLLOW`, true);
  for (let rr = rows - 4; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    mat[at(c, rr)] = M.OPEN;
    magma[at(c, rr)] = 1;
  }
  let bossLair: Cavern | null = null;
  if (world.below !== 'nothing') {
    const p = near(0.38, 0.6, 12) ?? [cols / 2, rows * 0.55];
    if (world.below === 'lich' && ruin) bossLair = ruin;
    else {
      const kind = world.below === 'engine' ? 'engine' : world.below === 'hive' ? 'hive' : 'lair';
      const cv: Cavern = { id: world.caverns.length, c: p[0], r: p[1], known: false, kind, clearAt: -1, claimed: false, name: kind === 'engine' ? `THE ENGINE OF ${elder}` : kind === 'hive' ? 'THE HIVE' : 'THE DEEP CHAMBER' };
      world.caverns.push(cv);
      blob(p[0], p[1], 10, 5, (i) => {
        if (mat[i] === M.SKY) return;
        mat[i] = M.CAVE;
        caveAt[i] = cv.id;
      });
      for (let n = 0; n < 3; n++) vein(M.MITHRIL, 0, 0, 10 + r() * 8, [p[0] + (r() - 0.5) * 30, p[1] - 8 - r() * 8]);
      bossLair = cv;
    }
  }

  // ---- walking -----------------------------------------------------------------------------------------
  let gateShut = new Set<number>();
  const walkable = (i: number) => {
    if (i < 0 || i >= N || mat[i] > 2) return false;
    if (gateShut.has(i)) return false;
    // Ladders and stairs can be climbed through a flood, holding breath; open water can't be crossed.
    if (ladder[i] || plank[i]) return true;
    if (water[i] > 0.7 && i >= cols && water[i - cols] > 0.5) return false;
    const b = i + cols;
    if (b >= N || mat[b] > 2 || ladder[b] === 1) return true;
    const c = i % cols;
    return c > 0 && c < cols - 1 && mat[i - 1] > 2 && mat[i + 1] > 2 && mat[i] !== M.SKY;
  };
  const prev = new Int32Array(N);
  const seen = new Uint32Array(N);
  const queue = new Int32Array(N);
  let stamp = 1;
  let budget = 0;
  function bfs(from: number, goal: (i: number) => boolean, max = 9000): number[] | null {
    if (budget <= 0) return null;
    budget--;
    stamp++;
    let h = 0;
    let tl = 0;
    queue[tl++] = from;
    seen[from] = stamp;
    prev[from] = -1;
    const visit = (j: number, i: number) => {
      if (j < 0 || j >= N || seen[j] === stamp || !walkable(j)) return;
      seen[j] = stamp;
      prev[j] = i;
      queue[tl++] = j;
    };
    while (h < tl) {
      const i = queue[h++];
      if (goal(i)) {
        const path: number[] = [];
        for (let j = i; j !== from && j >= 0; j = prev[j]) path.push(j);
        return path.reverse();
      }
      if (h > max) break;
      const c = i % cols;
      if (c > 0) visit(i - 1, i);
      if (c < cols - 1) visit(i + 1, i);
      visit(i - cols, i);
      visit(i + cols, i);
      if (i - cols >= 0 && mat[i - cols] <= 2) {
        if (c > 0) visit(i - cols - 1, i);
        if (c < cols - 1) visit(i - cols + 1, i);
      }
      if (c > 0) visit(i + cols - 1, i);
      if (c < cols - 1) visit(i + cols + 1, i);
    }
    return null;
  }
  type Walker = { x: number; y: number; at: number; route: number[]; ri: number; anim: number; facing: 1 | -1 };
  const cellOf = (a: { x: number; y: number }) => at(Math.max(0, Math.min(cols - 1, Math.floor(a.x / CELL))), Math.max(0, Math.min(rows - 1, Math.floor((a.y - 1) / CELL))));
  function walk(a: Walker, speed: number, dt: number): boolean {
    if (a.ri >= a.route.length) {
      const here = cellOf(a);
      a.at = here;
      if (!isOpen(mat[here])) {
        a.y -= CELL;
        return false;
      }
      if (!walkable(here) && here + cols < N && mat[here + cols] <= 2) {
        a.y = Math.min(world.cellY(here + cols), a.y + 90 * dt);
        a.route = [];
        a.ri = 0;
        return false;
      }
      return true;
    }
    const i = a.route[a.ri];
    if (!walkable(i)) {
      a.route = [];
      a.ri = 0;
      return false;
    }
    const tx = world.cellX(i);
    const ty = world.cellY(i);
    const dx = tx - a.x;
    const dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const sp = speed * (ladder[i] && Math.abs(dy) > 1 ? 0.7 : 1) * (water[i] > 0.4 ? 0.55 : 1);
    if (dist <= sp * dt) {
      a.x = tx;
      a.y = ty;
      a.at = i;
      a.ri++;
    } else {
      a.x += (dx / dist) * sp * dt;
      a.y += (dy / dist) * sp * dt;
    }
    if (Math.abs(dx) > 0.5) a.facing = dx > 0 ? 1 : -1;
    a.anim += dt * 7;
    return a.ri >= a.route.length;
  }
  const go = (a: Walker, goal: (i: number) => boolean, max?: number) => {
    const from = a.ri < a.route.length && walkable(a.at) ? a.at : cellOf(a);
    const p = bfs(from, goal, max);
    if (!p) return false;
    a.route = p;
    a.ri = 0;
    return true;
  };

  // ---- digging --------------------------------------------------------------------------------------
  type Dig = { id: number; hold: number; other: number; cells: Set<number>; purpose: 'rescue' | 'shaft' | 'room' | 'highway' | 'gallery' | 'vein'; room?: Room; claimed: Map<number, number>; t0: number; last: number; skip: Map<number, number>; mine?: number[]; done?: () => void };
  const digs: Dig[] = [];
  const newDig = (h: Hold, purpose: Dig['purpose'], cells: number[], extra: Partial<Dig> = {}) => {
    const d: Dig = { id: ids++, hold: h.id, other: -1, cells: new Set(cells.filter((i) => i >= 0 && i < N && !isOpen(mat[i]))), purpose, claimed: new Map(), t0: world.t, last: world.t, skip: new Map(), ...extra };
    for (const i of d.cells) resv[i] = 1;
    if (d.cells.size) digs.push(d);
    else d.done?.();
    return d;
  };
  const frontier = (i: number) => {
    const c = i % cols;
    return (c > 0 && isOpen(mat[i - 1]) && mat[i - 1] !== M.SKY) || (c < cols - 1 && isOpen(mat[i + 1]) && mat[i + 1] !== M.SKY) || (i - cols >= 0 && isOpen(mat[i - cols]) && mat[i - cols] !== M.SKY) || (i + cols < N && isOpen(mat[i + cols]));
  };
  const canDigFrom = (s: number, t: number) => {
    const sc = s % cols;
    const tc = t % cols;
    const sr = Math.floor(s / cols);
    const tr = Math.floor(t / cols);
    if (Math.abs(sc - tc) > 1) return false;
    const dy = tr - sr;
    if (dy > 1 || dy < -8) return false;
    if (dy >= -1) return true;
    for (let rr = tr + 1; rr < sr; rr++) if (!isOpen(mat[at(tc, rr)])) return false;
    return true;
  };
  let nearLair = Infinity;
  function digCell(i: number, by: Dwarf | null, h: Hold) {
    const m = mat[i];
    const c = i % cols;
    const rr = Math.floor(i / cols);
    setMat(i, M.OPEN);
    owner[i] = h.id;
    if (shaftCol(h, c) && rr >= h.gateFloor - 2) ladder[i] = h.style.shaft === 'lift' ? (c === h.shaftC ? 1 : 0) : 1;
    if (bossLair) nearLair = Math.min(nearLair, Math.hypot((c - bossLair.c) * 0.6, rr - bossLair.r));
    if (r() < 0.4) world.fx.push({ kind: 'dust', x: world.cellX(i), y: world.cellY(i) - CELL / 2, t0: world.t, dur: 1, r: CELL * 0.6, seed: ids++ });
    const ore = ORE[m];
    if (ore) {
      world.loads.push({ id: ids++, kind: ore, cell: by ? cellOf(by) : i, taken: false, skip: 0, hold: h.id });
      const v = veinAt[i];
      if (v >= 0 && once(`vein-${v}`)) strike(ore, i, h);
      if (ore === 'coal' && rr > rows * 0.35 && drew('firedamp') && r() < 0.06 * hz) firedamp(i);
    }
    for (const j of [i - 1, i + 1, i - cols, i + cols]) {
      if (j < 0 || j >= N) continue;
      if (mat[j] === M.AQUIFER) breachWater(j);
      else if (mat[j] === M.MAGMA) breachMagma(j);
      else if (caveAt[j] >= 0 && !world.caverns[caveAt[j]].known) breachCave(world.caverns[caveAt[j]], j);
    }
  }
  const shaftCol = (h: Hold, c: number) => h.style.shaft !== 'stair' && c >= h.shaftC && c < h.shaftC + h.style.shaftW;
  const digNow = (h: Hold, cells: number[]) => {
    for (const i of cells) {
      if (i < 0 || i >= N || isOpen(mat[i])) continue;
      mat[i] = M.OPEN;
      owner[i] = h.id;
      const c = i % cols;
      if (shaftCol(h, c) && Math.floor(i / cols) >= h.gateFloor - 2) ladder[i] = h.style.shaft === 'lift' ? (c === h.shaftC ? 1 : 0) : 1;
      world.dirty.push(i);
    }
  };
  function strike(ore: Load['kind'], i: number, h: Hold) {
    const x = world.cellX(i);
    const y = world.cellY(i);
    world.fx.push({ kind: 'glint', x, y: y - CELL / 2, t0: world.t, dur: 2.5, r: CELL * 2, seed: i, color: ore === 'gold' ? '#facc15' : ore === 'gem' ? '#c084fc' : ore === 'mithril' ? '#e0f2fe' : ore === 'iron' ? '#f97316' : '#94a3b8' });
    if (ore === 'mithril') {
      say(`MITHRIL! UNDER ${h.name}`, x, y, '#e0f2fe', 'high');
      emit('mithril', x, y, 0.8);
      chronicle(`Mithril was struck under ${T(h.name)}.`);
      look('strike', x, y, 1.5, 7, 4);
    } else if (ore === 'gem' || ore === 'gold') {
      say(ore === 'gem' ? `GEMS UNDER ${h.name}` : `GOLD UNDER ${h.name}`, x, y, ore === 'gem' ? '#d8b4fe' : '#fde68a', 'medium');
      emit(ore === 'gem' ? 'gems' : 'gold', x, y, 0.4);
      if (r() < 0.5) look('strike', x, y, 1.45, 5, 2);
    } else emit('strike', x, y, 0.15);
  }

  // ---- hazards --------------------------------------------------------------------------------------
  const flood = (i: number, from: number, fn: (j: number) => void, limit = 900) => {
    const q = [i];
    const s = new Set([i]);
    while (q.length && s.size < limit) {
      const j = q.pop()!;
      fn(j);
      for (const n of [j - 1, j + 1, j - cols, j + cols]) if (n >= 0 && n < N && !s.has(n) && mat[n] === from) {
        s.add(n);
        q.push(n);
      }
    }
    return s.size;
  };
  function breachWater(i: number) {
    flood(i, M.AQUIFER, (j) => {
      setMat(j, M.OPEN);
      water[j] = 1;
    });
    fluidBox(i, 22);
    const h = holdAt(i % cols);
    const x = world.cellX(i);
    const y = world.cellY(i);
    say(`WATER BREAKS IN UNDER ${h.name}`, x, y, '#7dd3fc', 'high');
    emit('flood', x, y, 0.85);
    chronicle(`Water broke in under ${T(h.name)}.`);
    look('flood', x, y, 1.35, 12, 6);
    alarm(i, 30);
    later(4, () => !world.rooms.some((x2) => x2.hold === h.id && x2.kind === 'pump') && placeRoom(h, 'pump'));
  }
  function breachMagma(i: number) {
    flood(i, M.MAGMA, (j) => {
      setMat(j, M.OPEN);
      magma[j] = 1;
    });
    fluidBox(i, 22);
    const x = world.cellX(i);
    const y = world.cellY(i);
    say('MAGMA!', x, y, '#fb923c', 'high');
    emit('magma', x, y, 0.9);
    chronicle(`The miners of ${T(holdAt(i % cols).name)} broke into magma.`);
    look('magma', x, y, 1.4, 12, 6);
    alarm(i, 30);
  }
  function breachCave(cv: Cavern, i: number) {
    cv.known = true;
    const x = world.cellX(i);
    const y = world.cellY(i);
    if (cv.kind === 'engine' || cv.kind === 'hive' || cv.kind === 'lair') {
      rouse(cv.kind === 'engine' ? 'engine' : cv.kind === 'hive' ? 'queen' : 'sleeper', cv);
      return;
    }
    if (cv.kind === 'geode') {
      holdAt(i % cols).stocks.gem += 30;
      for (let n = 0; n < 6; n++) world.fx.push({ kind: 'glint', x: (cv.c + (r() - 0.5) * 16) * CELL, y: (cv.r + (r() - 0.5) * 6) * CELL, t0: world.t + n * 0.4, dur: 3, r: CELL * 3, seed: ids++, color: '#c4b5fd' });
      say(`${cv.name}!`, x, y, '#d8b4fe', 'high');
      emit('geode', x, y, 0.75);
      look('ruin', cv.c * CELL, cv.r * CELL, 1.4, 10, 5);
      return;
    }
    if (cv.kind === 'shrine') {
      const h = holdAt(i % cols);
      for (const d of alive()) if (d.hold === h.id) d.sick = -1;
      h.feast = world.t + 40;
      say(cv.name, x, y, '#fde68a', 'high');
      emit('shrine', x, y, 0.75);
      chronicle(`${T(h.clan)} found ${T(cv.name)} under the mountain, and feasted.`);
      look('ruin', cv.c * CELL, cv.r * CELL, 1.4, 10, 5);
      return;
    }
    if (cv.kind === 'warren' || cv.kind === 'gnomes') {
      say(cv.kind === 'warren' ? `THE MINERS BREAK INTO ${cv.name}` : `THE DEEP GNOMES OF ${cv.name}`, x, y, cv.kind === 'warren' ? '#fca5a5' : '#bbf7d0', 'high');
      emit(cv.kind === 'warren' ? 'warren' : 'deepfolk', x, y, 0.7);
      look('cavern', cv.c * CELL, cv.r * CELL, 1.25, 9, 5);
      if (cv.kind === 'warren') {
        for (const f of world.foes) if (f.home === cv.id) {
          f.active = true;
          f.task = 'hunt';
        }
        alarm(i, 40);
      }
      return;
    }
    if (cv.kind === 'ruin') {
      holdAt(i % cols).stocks.treasure += 20;
      say(`${cv.name}!`, x, y, '#fde68a', 'high');
      emit('ruin', x, y, 0.75);
      chronicle(`Miners broke into ${T(cv.name)}, sealed since before the clans.`);
      look('ruin', cv.c * CELL, cv.r * CELL, 1.35, 10, 5);
      if (world.below === 'lich') later(4, () => rouse('lich', cv));
      else if (r() < 0.4) later(5, () => {
        for (let k = 0; k < 5; k++) {
          const f = foe('skeleton', cv, true);
          if (f) f.task = 'hunt';
        }
        say('THE DEAD WAKE IN THE OLD HALLS', cv.c * CELL, cv.r * CELL, '#bae6fd', 'high');
        emit('deadwake', cv.c * CELL, cv.r * CELL, 0.8);
        alarm(at(Math.round(cv.c), Math.round(cv.r)), 50);
      });
      return;
    }
    say(cv.kind === 'lake' ? 'THE MINERS BREAK THROUGH TO A BLACK LAKE' : `THE MINERS BREAK INTO ${cv.name}`, x, y, '#a5f3fc', 'high');
    emit('cavern', x, y, 0.7);
    look('cavern', cv.c * CELL, cv.r * CELL, 1, 9, 4);
    fluidBox(i, 40);
    for (const f of world.foes) if (f.home === cv.id && !neutral(f)) f.active = true;
    if (world.foes.some((f) => f.home === cv.id && f.alive && !neutral(f))) later(4, () => {
      say('THINGS COME UP OUT OF THE DARK', x, y, '#fca5a5', 'high');
      emit('creatures', x, y, 0.7);
      alarm(i, 50);
    });
  }
  function firedamp(i: number) {
    const x = world.cellX(i);
    const y = world.cellY(i) - CELL;
    world.fx.push({ kind: 'blast', x, y, t0: world.t, dur: 1.6, r: CELL * 5, seed: i });
    for (let dr = -3; dr <= 3; dr++) for (let dc = -4; dc <= 4; dc++) {
      const c = (i % cols) + dc;
      const rr = Math.floor(i / cols) + dr;
      if (!inb(c, rr) || dc * dc + dr * dr * 2 > 14) continue;
      const j = at(c, rr);
      if (mat[j] >= M.SOIL && mat[j] <= M.DEEP) setMat(j, r() < 0.3 ? M.RUBBLE : M.OPEN);
    }
    for (const d of alive()) if (Math.hypot(d.x - x, d.y - y) < CELL * 3.5) die(d, 'the firedamp');
    say('FIREDAMP!', x, y, '#fb923c', 'high');
    emit('firedamp', x, y, 0.9);
    look('firedamp', x, y, 1.45, 8, 6);
    quake(0.6);
  }
  let caveIns = 0;
  function caveIn(room: Room) {
    const w = 4 + Math.floor(r() * 4);
    const a = room.c0 + Math.floor(r() * Math.max(1, room.c1 - room.c0 - w));
    const b = Math.min(room.c1, a + w);
    const k2 = 2 + Math.floor(r() * 2);
    for (let c = a; c <= b; c++) {
      let top = room.top;
      while (top > 0 && isOpen(mat[at(c, top - 1)])) top--;
      for (let dr = 1; dr <= k2; dr++) {
        const j = at(c, top - dr);
        if (mat[j] === M.AQUIFER) breachWater(j);
        else if (mat[j] >= M.SOIL && mat[j] <= M.ICE) setMat(j, M.OPEN);
      }
      for (let dr = 0; dr < k2; dr++) {
        const j = at(c, room.floor - dr);
        if (isOpen(mat[j])) setMat(j, M.RUBBLE);
      }
    }
    const x = ((a + b) / 2) * CELL;
    const y = room.floor * CELL;
    for (let n = 0; n < 12; n++) world.fx.push({ kind: 'rubble', x: (a + r() * (b - a)) * CELL, y: (room.top - k2) * CELL, y1: y, t0: world.t + r() * 0.6, dur: 1, r: CELL * 0.5, seed: ids++ });
    world.fx.push({ kind: 'dust', x, y: y - CELL * 2, t0: world.t, dur: 3, r: CELL * 5, seed: ids++ });
    for (const d of alive()) if (!isOpen(mat[cellOf(d)])) {
      if (r() < 0.5) die(d, 'the cave-in');
      else d.y -= k2 * CELL;
    }
    room.dug = false;
    const rescue: number[] = [];
    for (let c = a; c <= b; c++) for (let dr = 0; dr < k2; dr++) rescue.push(at(c, room.floor - dr));
    newDig(world.holds[room.hold], 'rescue', rescue, { room, done: () => (room.dug = true) });
    say(`CAVE-IN IN ${ROOM_NAMES[room.kind]} OF ${world.holds[room.hold].name}`, x, y, '#fca5a5', 'high');
    emit('cavein', x, y, 0.85);
    look('cavein', x, y - CELL * 2, 1.45, 8, 6);
    caveIns++;
    quake(0.5);
  }

  // ---- fluids ---------------------------------------------------------------------------------------
  const box = { c0: cols, c1: -1, r0: rows, r1: -1 };
  const fluidBox = (i: number, pad: number) => {
    const c = i % cols;
    const rr = Math.floor(i / cols);
    box.c0 = Math.max(0, Math.min(box.c0, c - pad));
    box.c1 = Math.min(cols - 1, Math.max(box.c1, c + pad));
    box.r0 = Math.max(0, Math.min(box.r0, rr - pad));
    box.r1 = Math.min(rows - 5, Math.max(box.r1, rr + pad));
  };
  for (let i = 0; i < N; i++) if (water[i] > 0) fluidBox(i, 2);
  function flow(arr: Float32Array, other: Float32Array, rate: number, i: number, c: number, flip: number): boolean {
    let v = arr[i];
    if (!isOpen(mat[i])) {
      arr[i] = 0;
      return false;
    }
    if (mat[i] === M.SKY) {
      arr[i] = Math.max(0, v - 0.2);
      return true;
    }
    const d = i + cols;
    if (d < N && isOpen(mat[d])) {
      const m = Math.min(v, 1 - water[d] - magma[d]) * rate;
      if (m > 0) {
        arr[d] += m;
        arr[i] -= m;
        v -= m;
      }
    }
    if (v < 0.01) return true;
    for (let k2 = 0; k2 < 2; k2++) {
      const s = (k2 === 0) === (flip === 1) ? -1 : 1;
      if ((s < 0 && c === 0) || (s > 0 && c === cols - 1)) continue;
      const j = i + s;
      if (!isOpen(mat[j])) continue;
      const diff = v - arr[j] - other[j];
      if (diff > 0.02) {
        const m = diff * 0.3 * rate;
        arr[j] += m;
        arr[i] -= m;
        v -= m;
      }
    }
    return true;
  }
  let fluidAcc = 0;
  let tick = 0;
  function fluids(dt: number) {
    fluidAcc += dt;
    while (fluidAcc >= 0.1) {
      fluidAcc -= 0.1;
      tick++;
      if (box.c1 < box.c0) return;
      const flip = tick & 1;
      let any = false;
      for (let rr = box.r1; rr >= box.r0; rr--) for (let n = box.c0; n <= box.c1; n++) {
        const c = flip ? n : box.c1 - (n - box.c0);
        const i = at(c, rr);
        if (water[i] >= 0.003 && flow(water, magma, 1, i, c, flip)) any = true;
        if (magma[i] >= 0.003 && flow(magma, water, 0.3, i, c, flip)) any = true;
        if (water[i] > 0.05 && (magma[i] > 0.05 || (rr === rows - 5 && magma[i + cols] > 0.5)) && rr < rows - 4) {
          setMat(i, M.OBSIDIAN);
          water[i] = magma[i] = 0;
          if (r() < 0.3) world.fx.push({ kind: 'steam', x: c * CELL + CELL / 2, y: rr * CELL, t0: world.t, dur: 2.5, r: CELL * 2, seed: ids++ });
        }
        if (magma[i] > 0.3 && rr < rows - 4 && r() < 0.0006) {
          setMat(i, M.OBSIDIAN);
          magma[i] = 0;
        }
        if (water[i] > 0 && caveAt[i] < 0) water[i] = Math.max(0, water[i] - (water[i] < 0.06 ? 0.002 : 0.0006));
      }
      for (const p of world.rooms) if (p.kind === 'pump' && p.furnished && !p.ruined) {
        for (let rr = Math.max(box.r0, p.top); rr <= box.r1; rr++) for (let c = Math.max(box.c0, p.c0 - 40); c <= Math.min(box.c1, p.c1 + 40); c++) {
          const i = at(c, rr);
          if (water[i] > 0 && caveAt[i] < 0) water[i] = Math.max(0, water[i] - 0.012);
        }
      }
      if (tick % 20 === 0) {
        let c0 = cols;
        let c1 = -1;
        let r0 = rows;
        let r1 = -1;
        if (any) for (let rr = box.r0; rr <= box.r1; rr++) for (let c = box.c0; c <= box.c1; c++) {
          const i = at(c, rr);
          if (water[i] > 0.003 || magma[i] > 0.003) {
            c0 = Math.min(c0, c);
            c1 = Math.max(c1, c);
            r0 = Math.min(r0, rr);
            r1 = Math.max(r1, rr);
          }
        }
        box.c0 = Math.max(0, c0 - 2);
        box.c1 = Math.min(cols - 1, c1 + 2);
        box.r0 = Math.max(0, r0 - 2);
        box.r1 = Math.min(rows - 5, r1 + 2);
      } else {
        box.c0 = Math.max(0, box.c0 - 1);
        box.c1 = Math.min(cols - 1, box.c1 + 1);
        box.r1 = Math.min(rows - 5, box.r1 + 1);
      }
    }
  }

  // ---- architecture: levels, connectors, rooms ----------------------------------------------------------------------
  const levelFloor = (h: Hold, k: number) => h.gateFloor + k * h.style.gap;
  /** A level: its connector down from the one above (ladder shaft, lift, or a stair flight), and a gallery stub. */
  function openLevel(h: Hold, k: number, instant = false) {
    const floor = levelFloor(h, k);
    if (floor > rows - 10) return null;
    const prevLv = h.levels[k - 1];
    const s = h.style;
    let anchor = h.shaftC;
    const cells: number[] = [];
    if (k === 0 || s.shaft !== 'stair') {
      const from = k === 0 ? h.gateFloor - 3 : prevLv.floor;
      for (let rr = from + 1; rr <= floor; rr++) for (let c = h.shaftC; c < h.shaftC + s.shaftW; c++) cells.push(at(c, rr));
    } else {
      // A flight of stairs, one step across for each step down, turning back on itself.
      const dir = k % 2 ? 1 : -1;
      anchor = Math.max(h.x0 + 4, Math.min(h.x1 - 4, prevLv.anchor + dir * s.gap));
      const d = Math.sign(anchor - prevLv.anchor) || 1;
      let c = prevLv.anchor;
      for (let rr = prevLv.floor; rr <= floor; rr++) {
        for (let dr = -2; dr <= 0; dr++) cells.push(at(c, rr + dr));
        // Each step is a tread, walkable even where it runs down into the gallery's air.
        plank[at(c, rr)] = 1;
        if (c !== anchor) c += d;
      }
      for (let cc = Math.min(c, anchor); cc <= Math.max(c, anchor); cc++) for (let dr = -2; dr <= 0; dr++) cells.push(at(cc, floor + dr));
    }
    const shift = s.layout === 'terrace' ? (k % 2 ? 1 : -1) * Math.min(6, k) : 0;
    const lv: Level = { k, floor, anchor, left: anchor - 4 + shift, right: anchor + s.shaftW + 3 + shift };
    for (let c = lv.left; c <= lv.right; c++) for (let rr = floor - 2; rr <= floor; rr++) cells.push(at(c, rr));
    floorOf(cells, floor);
    h.levels[k] = lv;
    if (instant) digNow(h, cells);
    else newDig(h, 'shaft', cells);
    return lv;
  }
  const inShape = (shape: Shape, x: number, y: number, w: number, hgt: number) => {
    const cx = (w - 1) / 2;
    const dx = Math.abs(x - cx) / (w / 2);
    if (shape === 'rect') return true;
    if (shape === 'arch' || shape === 'vault') {
      const spring = hgt - (shape === 'vault' ? 4 : 2.5);
      if (y < spring) return true;
      const v = (y - spring) / (hgt - spring);
      return dx * dx + v * v <= 1.05;
    }
    if (shape === 'dome') {
      const base = Math.max(3, hgt - 4);
      if (y < base) return true;
      const v = (y - base) / (hgt - base);
      return dx * dx + v * v <= 1;
    }
    // Tiered: the ceiling steps in.
    if (y < hgt - 2) return true;
    if (y < hgt - 1) return x >= 1 && x <= w - 2;
    return x >= 3 && x <= w - 4;
  };
  const shapeFor = (h: Hold, kind: RoomKind): Shape => {
    if (kind === 'vault') return 'vault';
    if (kind === 'pump' || kind === 'store') return 'rect';
    return h.style.shapes ? (g.weighted({ rect: h.style.shapes.rect, arch: h.style.shapes.arch, dome: h.style.shapes.dome, tiered: h.style.shapes.tiered }) as Shape) : 'rect';
  };
  const DEEP_FIRST: RoomKind[] = ['forge', 'barracks', 'treasury', 'tomb', 'library', 'kings', 'vault', 'pump'];
  function placeRoom(h: Hold, kind: RoomKind, level?: number): Room | null {
    let [w, hgt] = ROOM_SIZE[kind];
    if (kind === 'hall' || kind === 'kings' || kind === 'vault' || kind === 'temple') {
      w = Math.round(w * h.style.hallScale);
      hgt = Math.round(hgt * (h.style.layout === 'grand' ? 1.25 : 1));
    }
    if (h.style.layout === 'warren') w = Math.max(6, Math.round(w * 0.75));
    const shape = shapeFor(h, kind);
    if (shape === 'dome') hgt += 2;
    if (shape === 'arch') hgt += 1;
    const open = h.levels.filter((l) => l && l.k > 0 && isOpen(mat[at(l.anchor, l.floor)]));
    const order = level != null ? [h.levels[level]].filter(Boolean) : DEEP_FIRST.includes(kind) ? [...open].reverse() : open;
    for (const lv of order) {
      // Not higher than the level above's floor allows.
      const ceiling = lv.k > 0 && h.levels[lv.k - 1] ? h.levels[lv.k - 1].floor + 2 : 0;
      const hh = Math.min(hgt, lv.floor - ceiling);
      if (hh < 4) continue;
      for (let off = 2; off < (h.x1 - h.x0) * 0.6; off += 2) {
        for (const sd of r() < 0.5 ? [-1, 1] : [1, -1]) {
          const c0 = sd < 0 ? lv.anchor - off - w : lv.anchor + h.style.shaftW + 1 + off;
          const c1 = c0 + w - 1;
          if (c0 < h.x0 + 3 || c1 > h.x1 - 3) continue;
          const top = lv.floor - hh + 1;
          let ok = true;
          for (let rr = top - 2; rr <= lv.floor + 1 && ok; rr++) for (let c = c0 - 1; c <= c1 + 1 && ok; c++) {
            const i = at(c, rr);
            const m = mat[i];
            if (m === M.SKY || m === M.RUIN || caveAt[i] >= 0 || roomAt[i] >= 0 || (owner[i] >= 0 && owner[i] !== h.id)) ok = false;
            // Above the gallery and under the floor, the rock must be whole: no stair, shaft, or mine to swallow.
            else if ((rr < lv.floor - 2 || rr > lv.floor) && (isOpen(m) || resv[i] || ladder[i])) ok = false;
          }
          if (!ok) continue;
          const room: Room = { id: world.rooms.length, hold: h.id, kind, shape, level: lv.k, c0, c1, top, floor: lv.floor, dug: false, furnished: false, statue: (kind === 'hall' || kind === 'kings' || kind === 'vault' || kind === 'temple') && r() < h.style.statues + (kind === 'kings' ? 1 : 0), ruined: false, work: 0 };
          world.rooms.push(room);
          const cells: number[] = [];
          const from = sd < 0 ? c1 + 1 : lv.right + 1;
          const to = sd < 0 ? lv.left - 1 : c0 - 1;
          for (let c = from; c <= to; c++) for (let rr = lv.floor - 2; rr <= lv.floor; rr++) cells.push(at(c, rr));
          for (let rr = lv.floor; rr >= top; rr--) for (let c = c0; c <= c1; c++) {
            if (!inShape(shape, c - c0, lv.floor - rr, w, hh) && rr < lv.floor - 2) continue;
            cells.push(at(c, rr));
            roomAt[at(c, rr)] = room.id;
          }
          floorOf(cells, lv.floor);
          lv.left = Math.min(lv.left, c0);
          lv.right = Math.max(lv.right, c1);
          newDig(h, 'room', cells, { room, done: () => roomDug(room) });
          return room;
        }
      }
    }
    return null;
  }
  /**
   * A gallery's floor: planked where it crosses an opening (a stair going down under it, a
   * shaft), and bridged where it crosses a cavern.
   */
  function floorOf(cells: number[], floor: number) {
    for (const i of cells) {
      if (Math.floor(i / cols) !== floor) continue;
      plank[i] = 1;
      const b = i + cols;
      if (b < N && mat[b] === M.CAVE) setMat(b, M.BRIDGE);
    }
  }
  /** A room dug out: its walls dressed in stone (if that is the clan's way), its floor laid. */
  function roomDug(room: Room) {
    room.dug = true;
    const h = world.holds[room.hold];
    if (!h.style.masonry) return;
    for (let rr = room.top - 1; rr <= room.floor + 1; rr++) for (let c = room.c0 - 1; c <= room.c1 + 1; c++) {
      if (!inb(c, rr)) continue;
      const i = at(c, rr);
      if (mat[i] < M.SOIL || mat[i] > M.ICE) continue;
      const touches = [i - 1, i + 1, i - cols, i + cols].some((j) => j >= 0 && j < N && roomAt[j] === room.id && isOpen(mat[j]));
      if (touches) setMat(i, M.MASON);
    }
  }

  // ---- the plan: what each hold builds next, forever ---------------------------------------------------
  const pendingKind = (h: Hold, kind: RoomKind) => world.rooms.some((x) => x.hold === h.id && x.kind === kind && !x.dug);
  const ready = (h: Hold, kind: RoomKind) => world.rooms.filter((x) => x.hold === h.id && x.kind === kind && x.dug && x.furnished && !x.ruined);
  const pop = (h: Hold) => world.dwarves.filter((d) => d.alive && d.hold === h.id).length;
  function plan(h: Hold) {
    if (h.fallen) return;
    // The shaft is kept: ladders put back where a blast or a cave-in tore them out.
    const last = h.levels[h.levels.length - 1];
    if (h.style.shaft !== 'stair') for (let rr = h.gateFloor - 2; rr <= last.floor; rr++) for (let c = h.shaftC; c < h.shaftC + (h.style.shaft === 'lift' ? 1 : h.style.shaftW); c++) {
      const i = at(c, rr);
      if (isOpen(mat[i]) && mat[i] !== M.SKY && !ladder[i]) {
        ladder[i] = 1;
        world.dirty.push(i);
      }
    }
    // A level never reached (its shaft given up on): dig for it again.
    if (!isOpen(mat[at(last.anchor, last.floor)]) && !digs.some((d) => d.hold === h.id && d.purpose === 'shaft')) {
      const lv = openLevel(h, last.k);
      if (lv) {
        lv.left = Math.min(lv.left, last.left);
        lv.right = Math.max(lv.right, last.right);
      }
    }
    const mine = digs.filter((d) => d.hold === h.id || d.other === h.id);
    const builders = world.dwarves.filter((d) => d.alive && d.hold === h.id && (d.job === 'miner' || d.job === 'mason' || d.job === 'hauler')).length;
    const cap = 1 + Math.floor(builders / 3);
    if (mine.filter((d) => d.purpose !== 'vein').length >= cap) return;
    const n = pop(h);
    const rooms = world.rooms.filter((x) => x.hold === h.id);
    const count = (k: RoomKind) => rooms.filter((x) => x.kind === k).length;
    // What the clan needs.
    const need: RoomKind[] = [];
    if (!count('store')) need.push('store');
    if (count('dorm') * 8 < n + 6) need.push('dorm');
    if (count('farm') < 1 + Math.floor(n / 14)) need.push('farm');
    if (!count('brewery')) need.push('brewery');
    if (count('forge') < 1 + Math.floor(n / 25)) need.push('forge');
    if (n >= 10 && !count('hall')) need.push('hall');
    if (n >= 16 && !count('temple')) need.push('temple');
    if (h.deaths >= 2 && !count('tomb')) need.push('tomb');
    if ((h.attacked || h.war >= 0) && count('barracks') < 1 + Math.floor(n / 30)) need.push('barracks');
    if (world.wealth(h) > 800 && !count('treasury')) need.push('treasury');
    if (n >= 22 && !count('library')) need.push('library');
    for (const kind of need) if (!pendingKind(h, kind) && placeRoom(h, kind)) return;
    // Then: grow. Something is always possible, so the hold never stops.
    const deepest = h.levels.length - 1;
    const reached = isOpen(mat[at(h.levels[deepest].anchor, h.levels[deepest].floor)]);
    const canDeepen = reached && !mine.some((d) => d.purpose === 'shaft') && levelFloor(h, deepest + 1) <= rows - 10;
    const neighbour = world.holds.find((o) => o !== h && Math.abs(o.id - h.id) === 1 && !world.highways.some((x) => (x.a === h.id && x.b === o.id) || (x.a === o.id && x.b === h.id)) && o.levels.length >= 3 && !o.fallen);
    const choice = g.weighted({
      deepen: canDeepen ? 3 + (deepest < 4 ? 4 : 0) : 0,
      mine: 3,
      room: 2.5,
      grand: n >= 14 ? 1.2 : 0,
      highway: neighbour && h.levels.length >= 3 ? 2.5 : 0,
      face: h.faceC === -1 && n >= 12 ? 0.8 : 0,
      widen: 0.8,
    });
    if (choice === 'deepen') {
      const lv = openLevel(h, deepest + 1);
      if (lv) {
        say(`${h.name} DIGS DOWN TO ${deepName(lv.k)}`, h.shaftC * CELL, lv.floor * CELL, '#e7dcc4', 'low');
        emit('deeper', h.shaftC * CELL, lv.floor * CELL, 0.25);
      }
    } else if (choice === 'mine') {
      const v = prospect(h);
      if (v) {
        world.mines.push(v);
        newDig(h, 'vein', v, { mine: v });
      }
    } else if (choice === 'room') {
      const extra: RoomKind[] = ['dorm', 'farm', 'forge', 'store', 'brewery', 'library', 'tomb'];
      placeRoom(h, pick(extra));
    } else if (choice === 'grand') {
      const kind = pick(['kings', 'vault', 'hall', 'temple'] as RoomKind[]);
      const room = placeRoom(h, kind);
      if (room) {
        say(`${h.name} BEGINS ${ROOM_NAMES[kind]}`, ((room.c0 + room.c1) / 2) * CELL, room.top * CELL, '#fde68a', 'medium');
        emit('grandwork', ((room.c0 + room.c1) / 2) * CELL, room.floor * CELL, 0.4);
      }
    } else if (choice === 'highway' && neighbour) highway(h, neighbour);
    else if (choice === 'face') carveFace(h);
    else {
      // Widen: a long gallery further out, torch-lit, for what comes later.
      const lv = pick(h.levels.filter((l) => l && l.k > 0));
      if (lv) {
        const sd = r() < 0.5 ? -1 : 1;
        const from = sd < 0 ? Math.max(h.x0 + 3, lv.left - 14) : lv.right + 1;
        const to = sd < 0 ? lv.left - 1 : Math.min(h.x1 - 3, lv.right + 14);
        const cells: number[] = [];
        for (let c = from; c <= to; c++) for (let rr = lv.floor - 2; rr <= lv.floor; rr++) if (roomAt[at(c, rr)] < 0 && (owner[at(c, rr)] < 0 || owner[at(c, rr)] === h.id)) cells.push(at(c, rr));
        floorOf(cells, lv.floor);
        if (cells.length) {
          lv.left = Math.min(lv.left, from);
          lv.right = Math.max(lv.right, to);
          newDig(h, 'gallery', cells);
        }
      }
    }
  }
  const claimedOre = new Set<number>();
  function prospect(h: Hold): number[] | null {
    let best = -1;
    let score = 0;
    let from = -1;
    const value: Record<number, number> = { 9: 2, 10: 1.6, 11: 3, 12: 4, 13: 7 };
    for (const lv of h.levels) {
      if (!lv || lv.k === 0) continue;
      for (let c = Math.max(h.x0 + 2, lv.left - 16); c <= Math.min(h.x1 - 2, lv.right + 16); c++) for (let rr = lv.floor - 9; rr <= lv.floor + 6; rr++) {
        if (!inb(c, rr)) continue;
        const i = at(c, rr);
        const v = value[mat[i]];
        if (!v || claimedOre.has(veinAt[i])) continue;
        const gx = Math.max(lv.left, Math.min(lv.right, c));
        const s = v / (4 + Math.abs(c - gx) + Math.abs(rr - lv.floor));
        if (s > score) {
          score = s;
          best = i;
          from = at(gx, lv.floor);
        }
      }
    }
    if (best < 0) return null;
    claimedOre.add(veinAt[best]);
    const cells: number[] = [];
    let c = from % cols;
    let rr = Math.floor(from / cols);
    const tc = best % cols;
    const tr = Math.floor(best / cols);
    let wig = 0;
    while (c !== tc || rr !== tr) {
      if (rr !== tr) {
        rr += Math.sign(tr - rr);
        c += c !== tc ? Math.sign(tc - c) : wig++ % 2 ? 1 : -1;
      } else c += Math.sign(tc - c);
      cells.push(at(c, rr), at(c, rr - 1));
    }
    const v = veinAt[best];
    flood(best, mat[best], (j) => veinAt[j] === v && cells.push(j), 60);
    // Not through a room, a stair, or a floor.
    return cells.filter((j) => j >= 0 && j < N && mat[j] !== M.SKY && (owner[j] < 0 || owner[j] === h.id) && roomAt[j] < 0 && !plank[j] && !resv[j] && !(j >= cols && plank[j - cols]));
  }
  /** A highway to the neighbouring hold, with rails; dug from both ends. */
  function highway(h: Hold, o: Hold) {
    const ka = Math.min(h.levels.length - 1, 2 + Math.floor(r() * 2));
    const la = h.levels[ka];
    const lb = o.levels.reduce((best, l) => (l && Math.abs(l.floor - la.floor) < Math.abs(best.floor - la.floor) ? l : best), o.levels[1]);
    if (!la || !lb) return;
    const leftH = h.shaftC < o.shaftC ? h : o;
    const L = leftH === h ? la : lb;
    const R = leftH === h ? lb : la;
    const cells: number[] = [];
    const floor = L.floor;
    const c0 = L.right + 1;
    const c1 = R.left - 1;
    // Level to the far side, then a flight of stairs up or down to meet the other's floor.
    const n = Math.abs(R.floor - floor);
    const cs = Math.max(c0, c1 - n);
    for (let c = c0; c <= cs; c++) for (let rr = floor - 2; rr <= floor; rr++) cells.push(at(c, rr));
    floorOf(cells, floor);
    for (let k = 1; k <= n; k++) {
      const rr = floor + k * Math.sign(R.floor - floor);
      for (let dr = -2; dr <= 0; dr++) cells.push(at(Math.min(c1 + 1, cs + k), rr + dr));
      plank[at(Math.min(c1 + 1, cs + k), rr)] = 1;
    }
    const hw: Highway = { a: h.id, b: o.id, floor, c0, c1, open: false };
    world.highways.push(hw);
    for (let cc = c0; cc <= cs; cc++) rail[at(cc, floor)] = 1;
    newDig(h, 'highway', cells, {
      other: o.id,
      done: () => {
        hw.open = true;
        const x = ((c0 + c1) / 2) * CELL;
        say(`THE HIGHWAY FROM ${h.name} TO ${o.name} IS OPEN`, x, floor * CELL, '#fde68a', 'high');
        emit('highway', x, floor * CELL, 0.6);
        chronicle(`A highway was cut under the mountains from ${T(h.name)} to ${T(o.name)}.`);
        look('highway', x, floor * CELL, 1.1, 8, 4);
        h.relation[o.id] = o.relation[h.id] = Math.min(1, h.relation[o.id] + 0.2);
      },
    });
    say(`${h.name} AND ${o.name} BEGIN A HIGHWAY`, ((c0 + c1) / 2) * CELL, floor * CELL, '#e7dcc4', 'medium');
    emit('highwaybegun', ((c0 + c1) / 2) * CELL, floor * CELL, 0.3);
  }
  /** The face of the first king, carved in the mountain above the gate. */
  function carveFace(h: Hold) {
    // The nearest face of whole rock to the gate, under the mountainside.
    h.faceC = -2;
    for (let k = 0; k < 120 && h.faceC < 0; k++) {
      const c = h.gateC + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * -h.side;
      if (c < 7 || c > cols - 8) continue;
      // Cut into the slope: its brow at the surface, so it looks out over the valley.
      const cy = surface[c] + 5;
      if (cy + 7 >= rows - 10) continue;
      let ok = true;
      for (let dy = -7; dy <= 7 && ok; dy++) for (let dc = -6; dc <= 6 && ok; dc++) {
        const i = at(c + dc, cy + dy);
        if ((isOpen(mat[i]) && mat[i] !== M.SKY) || resv[i] || roomAt[i] >= 0) ok = false;
      }
      if (ok) {
        h.faceC = c;
        h.faceR = cy;
      }
    }
    if (h.faceC < 0) return;
    const cx = h.faceC;
    const cy = h.faceR;
    const masons = world.dwarves.filter((d) => d.alive && d.hold === h.id && d.job === 'mason').slice(0, 3);
    for (const d of masons) {
      d.task = { kind: 'carve', t0: world.t, stage: 0, target: at(cx, cy) };
      d.route = [];
    }
    later(25, () => {
      h.face = true;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -5; dx <= 5; dx++) {
        const c = cx + dx;
        const rr = cy + dy;
        if (!inb(c, rr)) continue;
        const i = at(c, rr);
        if (mat[i] < M.SOIL || mat[i] > M.ICE) continue;
        if ((dx / 5) ** 2 + (dy / 6.5) ** 2 <= 1) setMat(i, M.CARVED);
      }
      say(`THE FACE OF ${h.name}'S FIRST KING IS CARVED ON THE MOUNTAIN`, cx * CELL, cy * CELL, '#fde68a', 'high');
      emit('face', cx * CELL, cy * CELL, 0.6);
      chronicle(`${T(h.clan)} carved their first king's face into the mountain above ${T(h.name)}.`);
      look('face', cx * CELL, cy * CELL, 1.3, 8, 4);
    });
  }

  // ---- the people -------------------------------------------------------------------------------------
  const dwarfName = () => pick(N1) + pick(N2);
  function dwarf(h: Hold, job: Job, x: number, y: number, outside = false): Dwarf {
    const d: Dwarf = {
      id: ids++, hold: h.id, name: dwarfName(), job, x, y, at: cellOf({ x, y }), route: [], ri: 0, task: null, hp: job === 'soldier' ? 20 : 10, alive: true, deadAt: -1, anim: r() * 4,
      facing: r() < 0.5 ? 1 : -1, beard: Math.floor(r() * 6), variant: Math.floor(r() * 4), age: 30 + Math.floor(r() * 120), fails: 0, carry: null, cart: false, swingUntil: -1, drown: 0, cd: 0, repath: 0, outside, crossbow: job === 'soldier' && r() < 0.4, sick: -1, squad: -1,
    };
    world.dwarves.push(d);
    return d;
  }
  function die(d: Dwarf, how: string) {
    if (!d.alive) return;
    d.alive = false;
    d.deadAt = world.t;
    const h = world.holds[d.hold];
    h.deaths++;
    if (d.carry) d.carry.taken = false;
    if (h.king === d) {
      h.king = null;
      later(4, () => crown(h, `${T(d.name)} the king died, by ${how}`));
    }
  }
  function crown(h: Hold, why: string) {
    const heir = world.dwarves.filter((d) => d.alive && d.hold === h.id).sort((a, b) => b.age - a.age)[0];
    if (!heir) return;
    h.king = heir;
    heir.job = 'king';
    h.reign++;
    say(`LONG LIVE KING ${heir.name} OF ${h.name}`, heir.x, heir.y - CELL * 2, '#fde68a', 'medium');
    emit('crowned', heir.x, heir.y, 0.5);
    chronicle(`${why}. ${T(heir.name)} was crowned in ${T(h.name)}.`);
  }
  function foe(kind: FoeKind, cv: Cavern | null, active: boolean, x?: number, y?: number): Foe | null {
    let px = x ?? 0;
    let py = y ?? 0;
    if (cv) {
      for (let tries = 0; tries < 60; tries++) {
        const c = Math.round(cv.c + (r() - 0.5) * 30);
        const rr = Math.round(cv.r + (r() - 0.5) * 12);
        if (!inb(c, rr)) continue;
        const i = at(c, rr);
        if (caveAt[i] === cv.id && walkable(i) && water[i] < 0.3) {
          px = world.cellX(i);
          py = world.cellY(i);
          break;
        }
      }
      if (!px) return null;
    }
    const hp = { goblin: 7, spider: 9, troll: 30, skeleton: 8, crawler: 12, trader: 10, mule: 10, golem: 26, gnome: 8, mushroom: 6, lich: 120, engine: 160, queen: 110, sleeper: 240 }[kind];
    const f: Foe = { id: ids++, kind, x: px, y: py, at: cellOf({ x: px, y: py }), route: [], ri: 0, hp, hpMax: hp, alive: true, deadAt: -1, anim: r() * 4, facing: 1, cd: 0, home: cv ? cv.id : -1, active, boss: kind === 'lich' || kind === 'engine' || kind === 'queen' || kind === 'sleeper', swingUntil: -1, repath: 0, lost: 0, task: 'wander', target: -1 };
    world.foes.push(f);
    return f;
  }
  for (const cv of world.caverns) {
    if (cv.kind === 'warren') {
      for (let k = 0; k < 8 + Math.floor(r() * 6); k++) foe('goblin', cv, false);
      continue;
    }
    if (cv.kind === 'gnomes') {
      for (let k = 0; k < 6 + Math.floor(r() * 5); k++) foe('gnome', cv, false);
      continue;
    }
    if (cv.kind !== 'cavern' && cv.kind !== 'lake') continue;
    const kinds = [...(drew('spiders') ? ['spider', 'spider'] : []), ...(drew('crawlers') ? ['crawler', 'crawler'] : []), ...(drew('trolls') && cv.r > rows * 0.5 ? ['troll'] : []), ...(drew('mushroomfolk') ? ['mushroom', 'mushroom'] : [])] as FoeKind[];
    if (!kinds.length) kinds.push('crawler');
    for (let k = 0; k < Math.round((3 + r() * 5 * Math.max(0.3, hz)) * Math.sqrt(scale)); k++) foe(pick(kinds), cv, false);
  }
  let alarmUntil = -1;
  function alarm(i: number, dur: number) {
    alarmUntil = Math.max(alarmUntil, world.t + dur);
    const y = world.cellY(i);
    const x = world.cellX(i);
    for (const d of alive()) {
      if (d.job === 'soldier' || d.outside || d.squad >= 0) continue;
      if (Math.abs(d.y - y) < CELL * 25 && Math.abs(d.x - x) < CELL * 60 && d.task?.kind !== 'flee') {
        d.task = { kind: 'flee', t0: world.t };
        d.route = [];
      }
    }
  }

  // ---- founding the holds ------------------------------------------------------------------------------
  for (const h of world.holds) {
    openLevel(h, 0, true);
    const tunnel: number[] = [];
    const lo = Math.min(h.gateC, h.shaftC);
    const hi = Math.max(h.gateC, h.shaftC + h.style.shaftW - 1);
    for (let c = lo; c <= hi; c++) for (let rr = h.gateFloor - 2; rr <= h.gateFloor; rr++) tunnel.push(at(c, rr));
    digNow(h, tunnel);
    h.levels[0].left = lo;
    h.levels[0].right = hi;
    const e = placeEntrance(h, lo, hi);
    void e;
    openLevel(h, 1, true);
    openLevel(h, 2, true);
    for (const kind of ['store', 'dorm'] as RoomKind[]) {
      const room = placeRoom(h, kind, 1);
      if (room) {
        const dg = digs.find((x) => x.room === room);
        if (dg) {
          digNow(h, [...dg.cells]);
          digs.splice(digs.indexOf(dg), 1);
        }
        roomDug(room);
        room.furnished = true;
      }
    }
    const founders = Math.max(8, Math.min(24, Math.round(g.lognormal(13, 0.3) * scale)));
    const trades: [Job, number][] = [['miner', 0.32], ['hauler', 0.14], ['soldier', 0.14], ['mason', 0.12], ['smith', 0.08], ['farmer', 0.1], ['brewer', 0.06]];
    const jobs: Job[] = ['king'];
    for (const [j, share] of trades) for (let n = 0; n < Math.max(1, Math.round(founders * share)); n++) jobs.push(j);
    for (const j of jobs) {
      const lv = h.levels[1 + Math.floor(r() * 2)];
      let c = lv.left + Math.floor(r() * (lv.right - lv.left + 1));
      for (let k = 0; k < 20 && !walkable(at(c, lv.floor)); k++) c = lv.left + Math.floor(r() * (lv.right - lv.left + 1));
      const d = dwarf(h, j, world.cellX(at(c, lv.floor)), world.cellY(at(c, lv.floor)));
      if (j === 'king') {
        h.king = d;
        d.age = 180 + Math.floor(r() * 50);
      }
    }
    if (h.style.shaft === 'lift') h.lift = { y: h.gateFloor * CELL, dir: 1 };
  }
  function placeEntrance(h: Hold, lo: number, hi: number) {
    const c0 = h.side > 0 ? Math.max(lo + 2, hi - 14) : lo + 2;
    const c1 = Math.min(hi - 2, c0 + 13);
    const room: Room = { id: world.rooms.length, hold: h.id, kind: 'entrance', shape: 'arch', level: 0, c0, c1, top: h.gateFloor - 5, floor: h.gateFloor, dug: true, furnished: true, statue: r() < 0.5, ruined: false, work: 0 };
    world.rooms.push(room);
    const cells: number[] = [];
    for (let rr = room.top; rr <= h.gateFloor; rr++) for (let c = c0; c <= c1; c++) {
      const i = at(c, rr);
      if (mat[i] === M.SKY || !inShape('arch', c - c0, h.gateFloor - rr, c1 - c0 + 1, 6)) continue;
      cells.push(i);
      roomAt[i] = room.id;
    }
    digNow(h, cells);
    roomDug(room);
    return room;
  }
  const gateCells = (h: Hold) => [at(h.gateC, h.gateFloor), at(h.gateC, h.gateFloor - 1), at(h.gateC, h.gateFloor - 2)];
  const refreshGates = () => {
    gateShut = new Set();
    for (const h of world.holds) if (!h.gateOpen) for (const i of gateCells(h)) gateShut.add(i);
  };

  // ---- the day's work --------------------------------------------------------------------------------------
  const tired = (d: Dwarf) => (world.day - 0.8 + (d.id % 4) * 0.05 + 1) % 1 < 0.14;
  const roomGoal = (room: Room) => (i: number) => roomAt[i] === room.id && Math.floor(i / cols) === room.floor;
  const entranceOf = (h: Hold) => world.rooms.find((x) => x.hold === h.id && x.kind === 'entrance')!;
  function think(d: Dwarf) {
    const h = world.holds[d.hold];
    if (d.fails > 10) {
      d.fails = 0;
      const row = Math.floor(d.y / CELL);
      const lv = h.levels.filter(Boolean).sort((a, b) => Math.abs(a.floor - row) - Math.abs(b.floor - row))[0];
      if (lv) for (let k = 0; k < 30; k++) {
        const c = lv.left + Math.floor(r() * (lv.right - lv.left + 1));
        const i = at(c, lv.floor);
        if (walkable(i)) {
          d.x = world.cellX(i);
          d.y = world.cellY(i);
          d.at = i;
          d.route = [];
          break;
        }
      }
    }
    if (h.feast > world.t && ready(h, 'hall').length && d.job !== 'soldier') {
      const hall = ready(h, 'hall')[0];
      d.task = { kind: 'feast', room: hall, t0: world.t, until: h.feast };
      if (!go(d, roomGoal(hall))) d.task = null;
      return;
    }
    if (tired(d) && d.job !== 'soldier') {
      const dorms = ready(h, 'dorm');
      const dorm = dorms[d.id % Math.max(1, dorms.length)] ?? entranceOf(h);
      d.task = { kind: 'sleep', room: dorm, t0: world.t };
      if (!go(d, roomGoal(dorm))) d.task = { kind: 'idle', t0: world.t, until: world.t + 4 };
      return;
    }
    switch (d.job) {
      case 'mason':
        if (masonWork(d)) return;
        if (takeDig(d)) return;
        break;
      case 'miner':
        if (takeDig(d)) return;
        if (takeHaul(d)) return;
        break;
      case 'hauler':
        if (trade(d)) return;
        if (takeHaul(d)) return;
        if (takeDig(d)) return;
        break;
      case 'smith': {
        const forge = ready(h, 'forge')[d.id % Math.max(1, ready(h, 'forge').length)];
        if (forge) return work(d, forge);
        if (takeHaul(d)) return;
        break;
      }
      case 'brewer': {
        const b = ready(h, 'brewery')[0];
        if (b) return work(d, b);
        break;
      }
      case 'farmer': {
        const f = ready(h, 'farm')[d.id % Math.max(1, ready(h, 'farm').length)];
        if (f) return work(d, f);
        break;
      }
      case 'soldier': {
        const b = ready(h, 'barracks')[0] ?? entranceOf(h);
        return work(d, b);
      }
      case 'king': {
        const hall = ready(h, 'hall')[0] ?? ready(h, 'temple')[0] ?? entranceOf(h);
        return work(d, hall);
      }
      default:
        break;
    }
    const rooms = world.rooms.filter((x) => x.hold === h.id && x.dug && !x.ruined);
    const room = rooms[Math.floor(r() * rooms.length)];
    d.task = { kind: 'idle', t0: world.t, until: world.t + 3 + r() * 5, room };
    if (room && budget > 0 && !go(d, roomGoal(room), 5000) && budget > 0) d.fails++;
  }
  function work(d: Dwarf, room: Room) {
    d.task = { kind: 'work', room, t0: world.t, until: world.t + 15 + r() * 15 };
    if (!go(d, (i) => roomAt[i] === room.id && Math.floor(i / cols) === room.floor && Math.abs((i % cols) - (room.c0 + ((d.id * 3) % (room.c1 - room.c0 + 1)))) < 2)) {
      if (!go(d, roomGoal(room))) d.task = { kind: 'idle', t0: world.t, until: world.t + 3 };
    }
  }
  const ORDER: Dig['purpose'][] = ['rescue', 'shaft', 'room', 'highway', 'gallery', 'vein'];
  function takeDig(d: Dwarf): boolean {
    // A third of the miners are the road crew: highways before anything but a rescue.
    const rank = (x: Dig) => (d.id % 3 === 0 && x.purpose === 'highway' ? 0.5 : ORDER.indexOf(x.purpose));
    const sorted = digs.filter((x) => x.hold === d.hold || x.other === d.hold).sort((a, b) => rank(a) - rank(b));
    const dc = Math.floor(d.x / CELL);
    const dr = Math.floor(d.y / CELL);
    for (const gd of sorted) {
      if (budget <= 0) return false;
      let best = -1;
      let bd = Infinity;
      for (const i of gd.cells) {
        if (gd.claimed.has(i) || (gd.skip.get(i * 64 + (d.id & 63)) ?? 0) > world.t || !frontier(i)) continue;
        const dd = Math.abs((i % cols) - dc) + Math.abs(Math.floor(i / cols) - dr) * 1.5;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      if (best < 0) continue;
      if (go(d, (s) => canDigFrom(s, best))) {
        d.fails = 0;
        gd.claimed.set(best, d.id);
        d.task = { kind: 'dig', cell: best, t0: world.t, stage: 0 };
        return true;
      }
      if (budget > 0) {
        gd.skip.set(best * 64 + (d.id & 63), world.t + 10);
        d.fails++;
      }
    }
    return false;
  }
  function takeHaul(d: Dwarf): boolean {
    const h = world.holds[d.hold];
    const store = ready(h, 'store')[0] ?? entranceOf(h);
    const loads = world.loads.filter((l) => !l.taken && l.skip < world.t && l.hold === h.id);
    if (!loads.length || budget <= 0) return false;
    loads.sort((a, b) => Math.hypot(world.cellX(a.cell) - d.x, world.cellY(a.cell) - d.y) - Math.hypot(world.cellX(b.cell) - d.x, world.cellY(b.cell) - d.y));
    const l = loads[0];
    if (!go(d, (i) => Math.abs((i % cols) - (l.cell % cols)) <= 1 && Math.abs(Math.floor(i / cols) - Math.floor(l.cell / cols)) <= 1)) {
      if (budget > 0) l.skip = world.t + 15;
      return false;
    }
    l.taken = true;
    d.task = { kind: 'haul', load: l, room: store, t0: world.t, stage: 0 };
    return true;
  }
  /** Haulers take goods along the highways to a friendly hold, and come back. */
  function trade(d: Dwarf): boolean {
    if (r() > 0.15 || budget <= 0) return false;
    const h = world.holds[d.hold];
    const road = world.highways.find((x) => x.open && (x.a === h.id || x.b === h.id));
    if (!road) return false;
    const o = world.holds[road.a === h.id ? road.b : road.a];
    if (o.fallen || h.war === o.id || h.stocks.goods < 2) return false;
    const store = ready(o, 'store')[0] ?? entranceOf(o);
    d.task = { kind: 'trade', room: store, t0: world.t, stage: 0, target: o.id };
    d.cart = true;
    h.stocks.goods -= 1;
    if (!go(d, roomGoal(store), 30000)) {
      d.task = null;
      d.cart = false;
      h.stocks.goods += 1;
      return false;
    }
    return true;
  }
  function masonWork(d: Dwarf): boolean {
    const room = world.rooms.find((x) => x.hold === d.hold && x.dug && (!x.furnished || x.ruined) && !world.dwarves.some((o) => o !== d && o.alive && o.task?.kind === 'furnish' && o.task.room === x));
    if (!room) return false;
    d.task = { kind: 'furnish', room, t0: world.t, stage: 0 };
    if (!go(d, roomGoal(room))) {
      d.task = null;
      return false;
    }
    return true;
  }
  const DIG_RATE = 0.28;
  function act(d: Dwarf, dt: number) {
    const task = d.task;
    if (!task) return think(d);
    const h = world.holds[d.hold];
    const arrived = walk(d, d.job === 'soldier' ? 44 : d.cart || d.carry ? 30 : 38, dt);
    switch (task.kind) {
      case 'dig': {
        const i = task.cell!;
        const gd = digs.find((x) => x.cells.has(i));
        if (!gd || isOpen(mat[i])) {
          gd?.cells.delete(i);
          gd?.claimed.delete(i);
          d.task = null;
          break;
        }
        if (!arrived) break;
        if (!canDigFrom(cellOf(d), i)) {
          gd.claimed.delete(i);
          d.task = null;
          break;
        }
        d.facing = world.cellX(i) > d.x ? 1 : world.cellX(i) < d.x ? -1 : d.facing;
        d.swingUntil = world.t + 0.2;
        task.stage = (task.stage ?? 0) + dt;
        if (r() < dt * 4) world.fx.push({ kind: 'spark', x: world.cellX(i), y: world.cellY(i) - CELL / 2, t0: world.t, dur: 0.3, r: 2, seed: ids++, color: '#fde68a' });
        if (task.stage >= HARD[mat[i]] * DIG_RATE * (d.job === 'miner' ? 1 : 1.6)) {
          gd.cells.delete(i);
          gd.claimed.delete(i);
          gd.last = world.t;
          digCell(i, d, world.holds[gd.hold === d.hold ? gd.hold : d.hold]);
          d.task = null;
        }
        break;
      }
      case 'haul': {
        const l = task.load!;
        if (task.stage === 0) {
          if (!arrived) break;
          d.carry = l;
          d.cart = h.style.rails;
          world.loads = world.loads.filter((x) => x !== l);
          task.stage = 1;
          if (!go(d, roomGoal(task.room!))) {
            d.carry = null;
            d.cart = false;
            l.cell = cellOf(d);
            l.taken = false;
            world.loads.push(l);
            d.task = null;
          }
          break;
        }
        if (!arrived) break;
        if (d.carry) h.stocks[d.carry.kind] += 1;
        d.carry = null;
        d.cart = false;
        d.task = null;
        break;
      }
      case 'trade': {
        if (!arrived) break;
        const o = world.holds[task.target!];
        if (task.stage === 0) {
          o.stocks.goods += 1;
          h.stocks.food += 6;
          h.stocks.gold += 1;
          h.relation[o.id] = o.relation[h.id] = Math.min(1, h.relation[o.id] + 0.03);
          if (once(`trade-${h.id}-${o.id}-${Math.floor(world.t / 90)}`)) {
            say(`CARTS FROM ${h.name} REACH ${o.name}`, d.x, d.y - CELL * 2, '#fde68a', 'low');
            emit('trade', d.x, d.y, 0.2);
          }
          task.stage = 1;
          const home = ready(h, 'store')[0] ?? entranceOf(h);
          if (!go(d, roomGoal(home), 30000)) {
            d.task = null;
            d.cart = false;
          }
          break;
        }
        d.cart = false;
        d.task = null;
        break;
      }
      case 'work': {
        if (!arrived) break;
        const room = task.room!;
        d.swingUntil = world.t + 0.2;
        if (room.kind === 'forge') {
          room.work += dt / 10;
          if (r() < dt * 4) world.fx.push({ kind: 'spark', x: d.x + d.facing * CELL, y: d.y - CELL, t0: world.t, dur: 0.4, r: 3, seed: ids++, color: '#fbbf24' });
          if (room.work >= 1) {
            room.work = 0;
            const s = h.stocks;
            if (s.mithril >= 1 && r() < 0.5) {
              s.mithril--;
              s.treasure += 4;
            } else if (s.iron >= 1 && s.coal >= 1) {
              s.iron--;
              s.coal--;
              s.goods++;
            } else if (s.gold >= 1) {
              s.gold--;
              s.treasure++;
            } else if (s.gem >= 1) {
              s.gem--;
              s.treasure += 2;
            } else s.goods += 0.5;
          }
        } else if (room.kind === 'brewery') {
          room.work += dt / 8;
          if (room.work >= 1) {
            room.work = 0;
            h.stocks.ale += 4;
          }
        } else if (room.kind === 'farm') {
          room.work += dt / 7;
          if (room.work >= 1) {
            room.work = 0;
            h.stocks.food += 4;
          }
        }
        if (world.t > (task.until ?? 0)) d.task = null;
        break;
      }
      case 'furnish': {
        if (!arrived) break;
        const room = task.room!;
        d.swingUntil = world.t + 0.2;
        task.stage = (task.stage ?? 0) + dt;
        if (r() < dt * 2) world.fx.push({ kind: 'dust', x: d.x + d.facing * CELL, y: d.y - CELL, t0: world.t, dur: 0.8, r: CELL * 0.5, seed: ids++ });
        if (task.stage > 4) {
          const was = room.furnished;
          room.furnished = true;
          room.ruined = false;
          if (!was) {
            const x = ((room.c0 + room.c1) / 2) * CELL;
            const grand = room.kind === 'hall' || room.kind === 'temple' || room.kind === 'kings' || room.kind === 'vault';
            say(`${ROOM_NAMES[room.kind]} OF ${h.name}${room.statue && grand ? ', WITH ITS STATUE,' : ''} IS FINISHED`, x, room.top * CELL, '#bbf7d0', grand ? 'medium' : 'low');
            emit('room', x, room.floor * CELL, grand ? 0.45 : 0.15);
            if (grand) {
              look('room', x, room.floor * CELL - CELL * 3, 1.3, 7, 3);
              chronicle(`${T(ROOM_NAMES[room.kind])} of ${T(h.name)} was finished.`);
            }
          }
          d.task = null;
        }
        break;
      }
      case 'carve': {
        const i = task.target!;
        if (task.stage === 0) {
          task.stage = 1;
          // Out on the mountainside under it, or in the nearest gallery.
          if (!go(d, (j) => Math.abs((j % cols) - (i % cols)) <= 7 && Math.abs(Math.floor(j / cols) - Math.floor(i / cols)) <= 9, 20000)) d.task = null;
          break;
        }
        if (arrived) {
          d.swingUntil = world.t + 0.2;
          if (r() < dt * 3) world.fx.push({ kind: 'dust', x: world.cellX(i) + (r() - 0.5) * CELL * 8, y: world.cellY(i) + (r() - 0.5) * CELL * 10, t0: world.t, dur: 1, r: CELL * 0.6, seed: ids++ });
        }
        if (world.t - task.t0 > 26) d.task = null;
        break;
      }
      case 'sleep':
        if (arrived && r() < dt * 0.3) world.fx.push({ kind: 'z', x: d.x, y: d.y - CELL * 1.5, t0: world.t, dur: 2.5, r: 3, seed: ids++ });
        if (!tired(d)) d.task = null;
        break;
      case 'feast':
        if (world.t > (task.until ?? 0)) d.task = null;
        else if (arrived) {
          d.swingUntil = world.t + 0.2;
          if (r() < dt * 0.4) {
            const goal = roomGoal(task.room!);
            go(d, (i) => goal(i) && r() < 0.08);
          }
        }
        break;
      case 'flee': {
        if (d.route.length === 0 || arrived) {
          if (world.t > alarmUntil && !world.foes.some((f) => hostile(f) && f.task === 'hunt' && Math.hypot(f.x - d.x, f.y - d.y) < CELL * 30)) {
            d.task = null;
            break;
          }
          const dorm = ready(h, 'dorm')[0] ?? entranceOf(h);
          if (roomAt[cellOf(d)] === dorm.id) break;
          if (world.t < (task.until ?? 0)) break;
          task.until = world.t + 3;
          go(d, roomGoal(dorm));
        }
        break;
      }
      case 'leave':
        if (arrived) {
          d.alive = false;
          d.deadAt = world.t;
          world.dwarves = world.dwarves.filter((x) => x !== d);
        }
        break;
      case 'mood': {
        if (!arrived) break;
        d.swingUntil = world.t + 0.2;
        task.stage = (task.stage ?? 0) + dt;
        if (r() < dt * 8) world.fx.push({ kind: 'spark', x: d.x + d.facing * CELL, y: d.y - CELL, t0: world.t, dur: 0.6, r: 4, seed: ids++, color: r() < 0.5 ? '#fef3c7' : '#a5f3fc' });
        if (task.stage > 22) {
          const name = `THE ${pick(ART_KIND)} ${pick(ART_NAME)}`;
          h.artifacts.push({ name, maker: d.name });
          say(`${d.name} OF ${h.name} FORGES ${name}`, d.x, d.y - CELL * 3, '#fde68a', 'high');
          emit('artifact', d.x, d.y, 0.8);
          chronicle(`${T(d.name)} of ${T(h.name)}, taken by a strange mood, forged ${T(name)}.`);
          look('artifact', d.x, d.y - CELL * 2, 1.6, 7, 5);
          h.feast = world.t + 30;
          d.task = null;
        }
        break;
      }
      case 'idle':
        if (world.t > (task.until ?? 0)) d.task = null;
        break;
      default:
        break;
    }
    if (d.task && world.t - d.task.t0 > 90 && d.task.kind !== 'sleep' && d.task.kind !== 'mood' && d.task.kind !== 'march') {
      if (d.task.kind === 'dig') for (const gd of digs) gd.claimed.delete(d.task.cell ?? -1);
      if (d.task.kind === 'haul' && d.task.load && !d.carry) d.task.load.taken = false;
      d.task = null;
      d.cart = false;
    }
  }

  // ---- fighting: soldiers against foes, and against the soldiers of a hold at war ------------------------------------
  const atWar = (a: number, b: number) => a !== b && (world.holds[a].war === b || world.holds[b].war === a);
  function soldiers(dt: number) {
    const foes = world.foes.filter(hostile).filter((f) => f.task === 'hunt' || f.task === 'gate');
    const living = alive();
    for (const d of living) {
      if (d.job !== 'soldier' || d.outside) continue;
      const h = world.holds[d.hold];
      // Enemies: creatures near the hold, and the dwarves of a hold at war that are near.
      let best: { x: number; y: number; hit: (dmg: number) => void } | null = null;
      let bd = Infinity;
      for (const f of foes) {
        const dd = Math.hypot(f.x - d.x, f.y - d.y);
        if (dd < bd && dd < CELL * 80) {
          bd = dd;
          best = { x: f.x, y: f.y, hit: (dmg) => hurt(f, dmg) };
        }
      }
      for (const e of living) {
        if (!atWar(e.hold, d.hold) || (e.squad < 0 && d.squad !== e.hold)) continue;
        const dd = Math.hypot(e.x - d.x, e.y - d.y);
        if (dd < bd && dd < CELL * 50) {
          bd = dd;
          best = { x: e.x, y: e.y, hit: (dmg) => ((e.hp -= dmg), e.hp <= 0 && die(e, `the soldiers of ${h.name}`)) };
        }
      }
      if (!best) {
        if (d.task?.kind === 'fight') d.task = null;
        continue;
      }
      if (d.task?.kind !== 'fight' && d.task?.kind !== 'march') d.task = { kind: 'fight', t0: world.t };
      d.cd -= dt;
      if (bd < CELL * 1.6) {
        d.facing = best.x > d.x ? 1 : -1;
        if (d.cd <= 0) {
          d.cd = 0.9 + r() * 0.4;
          d.swingUntil = world.t + 0.25;
          best.hit(2 + r() * 3);
          world.fx.push({ kind: 'spark', x: (best.x + d.x) / 2, y: d.y - CELL, t0: world.t, dur: 0.3, r: 3, seed: ids++, color: '#fca5a5' });
        }
        continue;
      }
      if (d.crossbow && bd < CELL * 14 && Math.abs(best.y - d.y) < CELL * 2 && d.cd <= 0) {
        d.cd = 1.5;
        d.facing = best.x > d.x ? 1 : -1;
        world.fx.push({ kind: 'bolt', x: d.x, y: d.y - CELL, x1: best.x, y1: best.y - CELL * 0.7, t0: world.t, dur: 0.25, r: 1, seed: ids++ });
        const b = best;
        later(0.25, () => b.hit(2 + r() * 2));
        continue;
      }
      if (d.task?.kind === 'march') continue;
      d.repath -= dt;
      if (d.repath <= 0 || d.ri >= d.route.length) {
        d.repath = 1.5;
        const tc = cellOf(best);
        go(d, (i) => Math.abs((i % cols) - (tc % cols)) <= 1 && Math.abs(Math.floor(i / cols) - Math.floor(tc / cols)) <= 1, 20000);
      }
      walk(d, 44, dt);
    }
  }
  function hurt(f: Foe, dmg: number) {
    if (!f.alive) return;
    f.hp -= dmg;
    if (f.hp <= 0) {
      f.alive = false;
      f.deadAt = world.t;
      const cv = world.caverns[f.home];
      if (cv && !world.foes.some((o) => o.alive && o.home === cv.id && !neutral(o))) cv.clearAt = world.t;
    }
  }
  function foes(dt: number) {
    const dwarfCells = new Set<number>();
    for (const d of alive()) dwarfCells.add(cellOf(d));
    for (const f of world.foes) {
      if (!f.alive) continue;
      f.cd -= dt;
      if (f.kind === 'trader' || f.kind === 'mule') {
        caravanStep(f, dt);
        continue;
      }
      if (f.kind === 'gnome') {
        gnomeStep(f, dt);
        continue;
      }
      if (f.kind === 'mushroom' || !f.active) {
        f.repath -= dt;
        if (f.repath <= 0) {
          f.repath = 4 + r() * 6;
          const home = f.home;
          go(f, (i) => caveAt[i] === home && r() < 0.02, 700);
        }
        walk(f, f.kind === 'mushroom' ? 6 : 8, dt);
        continue;
      }
      if (f.boss && f.kind !== 'sleeper') {
        for (const d of alive()) if (Math.hypot(d.x - f.x, d.y - f.y) < CELL * 3.5 && f.cd <= 0) {
          f.cd = 1.2;
          f.swingUntil = world.t + 0.3;
          d.hp -= 6;
          world.fx.push({ kind: f.kind === 'engine' ? 'blast' : 'spark', x: d.x, y: d.y - CELL, t0: world.t, dur: 0.6, r: CELL * 1.5, seed: ids++, color: '#fca5a5' });
          if (d.hp <= 0) die(d, 'something below');
        }
        continue;
      }
      if (f.kind === 'sleeper') {
        sleeperStep(f, dt);
        continue;
      }
      if (f.task === 'gate') {
        const h = world.holds[f.target];
        const atGate = Math.abs(f.x - h.gateC * CELL) < CELL * 5;
        if (!atGate && (f.route.length === 0 || f.ri >= f.route.length)) {
          f.repath -= dt;
          if (f.repath <= 0) {
            f.repath = 1.5;
            const lane = h.gateC + h.side * (2 + (f.id % 3));
            go(f, (i) => i % cols === lane && Math.floor(i / cols) === h.gateFloor, 30000);
          }
        }
        if (walk(f, 26, dt) && atGate && !h.gateOpen) {
          f.swingUntil = world.t + 0.2;
          h.gateHp -= dt * (f.kind === 'troll' ? 3 : 0.7);
          if (h.gateHp <= 0) {
            h.gateOpen = true;
            refreshGates();
            say(`THE GATE OF ${h.name} IS BROKEN`, h.gateC * CELL, h.gateFloor * CELL - CELL * 2, '#fca5a5', 'high');
            emit('gatebreak', h.gateC * CELL, h.gateFloor * CELL, 0.85);
            look('fight', h.gateC * CELL, h.gateFloor * CELL, 1.4, 10, 6);
            for (const o of world.foes) if (o.task === 'gate' && o.target === h.id) o.task = 'hunt';
          }
        }
        if (h.gateOpen) f.task = 'hunt';
        continue;
      }
      let best: Dwarf | null = null;
      let bd = Infinity;
      for (const d of alive()) {
        const dd = Math.hypot(d.x - f.x, d.y - f.y);
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      if (!best) continue;
      if (f.task !== 'hunt') {
        f.repath -= dt;
        if (bd < CELL * 30 && f.repath <= 0) f.task = 'hunt';
        else continue;
      }
      if (bd < CELL * (f.kind === 'troll' || f.kind === 'golem' ? 2 : 1.4)) {
        f.facing = best.x > f.x ? 1 : -1;
        if (f.cd <= 0) {
          f.cd = 1 + r() * 0.5;
          f.swingUntil = world.t + 0.25;
          best.hp -= f.kind === 'troll' || f.kind === 'golem' ? 5 : 1 + r() * 1.5;
          if (best.hp <= 0) die(best, `a ${f.kind}`);
          else if (best.job !== 'soldier' && r() < 0.4) hurt(f, 1 + r() * 1.5);
          if (best.job !== 'soldier' && best.alive && best.task?.kind !== 'flee') best.task = { kind: 'flee', t0: world.t };
        }
        continue;
      }
      f.repath -= dt;
      if (f.repath <= 0 || f.ri >= f.route.length) {
        f.repath = 2 + r();
        if (budget > 0 && !go(f, (i) => dwarfCells.has(i))) {
          if (budget > 0 && ++f.lost > 3) {
            f.task = 'wander';
            f.lost = 0;
            f.repath = 10;
          }
        } else f.lost = 0;
      }
      walk(f, f.kind === 'spider' ? 34 : f.kind === 'troll' || f.kind === 'golem' ? 20 : 28, dt);
    }
    for (const cv of world.caverns) if (cv.known && !cv.claimed && cv.clearAt > 0 && world.t - cv.clearAt > 50 && cv.kind === 'cavern') {
      cv.claimed = true;
      say(`${cv.name} IS CLAIMED`, cv.c * CELL, cv.r * CELL, '#bbf7d0', 'medium');
      emit('claimed', cv.c * CELL, cv.r * CELL, 0.4);
    }
  }

  // ---- what lies below --------------------------------------------------------------------------------------
  const bossName = new Map<number, string>();
  const bossNext = new Map<number, number>();
  const bossWoke = new Map<number, number>();
  const retired = new Set<number>();
  let lairRest = 0;
  const BOSS_NAMES: Record<string, string[]> = {
    lich: ['THE LICH KING', 'THE GREY CHANCELLOR', 'THE HOLLOW QUEEN', 'THE LAST ELDER'],
    engine: ['THE IRON HEART', 'THE GREAT ENGINE', 'THE BRASS MIND', 'THE FIRST FURNACE'],
    queen: ['THE HIVE QUEEN', 'THE BROOD MOTHER', 'THE PALE MATRIARCH'],
  };
  function rouse(kind: 'lich' | 'engine' | 'queen' | 'sleeper', cv: Cavern) {
    if (world.foes.some((f) => f.boss && f.alive && f.home === cv.id)) return;
    const f = foe(kind, cv, true);
    if (!f) return;
    f.task = 'hunt';
    const name = kind === 'sleeper' ? world.sleeperName : pick(BOSS_NAMES[kind]);
    bossName.set(f.id, name);
    bossNext.set(f.id, world.t + 8);
    bossWoke.set(f.id, world.t);
    const what = kind === 'lich' ? 'RISES IN THE OLD HALLS' : kind === 'engine' ? 'TURNS OVER, AND WAKES' : kind === 'queen' ? 'STIRS IN THE HIVE' : 'WAKES BENEATH THE MOUNTAINS';
    say(`${name} ${what}`, f.x, f.y - CELL * 4, kind === 'engine' ? '#fdba74' : kind === 'lich' ? '#86efac' : '#d8b4fe', 'high');
    emit(kind === 'sleeper' ? 'sleeperwakes' : kind === 'queen' ? 'hive' : kind, f.x, f.y, 0.95);
    chronicle(`${T(name)} ${what.toLowerCase()}.`);
    look('sleeper', f.x, f.y - CELL * 4, 1.3, 12, 8);
    alarm(cellOf(f), 120);
    quake(0.7);
  }
  function breakOut(cv: Cavern) {
    const living = alive();
    if (!living.length) return;
    const tx = cv.c * CELL;
    const ty = cv.r * CELL;
    const d = living.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[0];
    let c = Math.round(cv.c);
    let rr = Math.round(cv.r) + 1;
    const ec = Math.floor(d.x / CELL);
    const er = Math.floor((d.y - 1) / CELL);
    for (let k = 0; k < 220 && (Math.abs(c - ec) > 1 || Math.abs(rr - er) > 1); k++) {
      if (c !== ec) c += Math.sign(ec - c);
      if (rr !== er && (c === ec || k % 2 === 0)) rr += Math.sign(er - rr);
      for (const dr of [0, -1, -2]) {
        if (!inb(c, rr + dr)) continue;
        const i = at(c, rr + dr);
        if (mat[i] >= M.SOIL && mat[i] !== M.MAGMA && mat[i] !== M.AQUIFER) setMat(i, M.OPEN);
        else if (mat[i] === M.AQUIFER) breachWater(i);
      }
    }
    quake(0.8);
    say('IT BREAKS THROUGH THE ROCK', d.x, d.y - CELL * 3, '#fca5a5', 'high');
    emit('breakthrough', d.x, d.y, 0.85);
  }
  function bosses(dt: number) {
    if (bossLair && nearLair < (world.below === 'lich' ? 26 : 20) && world.t > lairRest && !world.foes.some((f) => f.boss && f.home === bossLair!.id && (f.alive || !retired.has(f.id)))) {
      bossLair.known = true;
      rouse(world.below === 'lich' ? 'lich' : world.below === 'engine' ? 'engine' : world.below === 'hive' ? 'queen' : 'sleeper', bossLair);
      breakOut(bossLair);
    }
    for (const f of world.foes) {
      if (!f.boss) continue;
      const name = bossName.get(f.id) ?? 'IT';
      if (f.alive && world.t - (bossWoke.get(f.id) ?? world.t) > (f.kind === 'sleeper' ? 200 : 300)) {
        f.alive = false;
        f.deadAt = world.t;
        retired.add(f.id);
        nearLair = Infinity;
        lairRest = world.t + 240;
        const what = f.kind === 'lich' ? `${name} WITHDRAWS INTO THE DARK` : f.kind === 'engine' ? `${name} RUNS DOWN` : f.kind === 'queen' ? 'THE HIVE GOES QUIET' : `${name} GOES BACK INTO THE DEEP`;
        say(what, f.x, f.y - CELL * 4, '#c4b5fd', 'high');
        emit('bossrests', f.x, f.y, 0.6);
        alarmUntil = world.t;
        for (const o of world.foes) if (o.alive && o.home === f.home && !o.boss) hurt(o, 1000);
        continue;
      }
      if (!f.alive) {
        if (!retired.has(f.id) && once(`boss-dead-${f.id}`)) {
          say(`${name} IS ENDED`, f.x, f.y - CELL * 4, '#fde68a', 'high');
          emit('bossslain', f.x, f.y, 1);
          chronicle(`The soldiers came down to ${T(name)}, and ended it.`);
          look('sleeper', f.x, f.y - CELL * 3, 1.4, 10, 8);
          const h = holdAt(Math.floor(f.x / CELL));
          h.stocks.treasure += 40;
          h.stocks.mithril += 6;
          h.feast = world.t + 40;
          for (const o of world.foes) if (o.alive && o.home === f.home && !o.boss) hurt(o, 1000);
        }
        continue;
      }
      f.anim += dt;
      if (f.kind === 'engine' && r() < dt * 0.15) quake(0.18);
      if (Math.floor(world.t / 40) !== Math.floor((world.t - dt) / 40)) look('sleeper', f.x, f.y - CELL * 4, 1.3, 12, 7);
      if (f.kind === 'sleeper') continue;
      if (world.t >= (bossNext.get(f.id) ?? 0)) {
        bossNext.set(f.id, world.t + (f.kind === 'queen' ? 28 : f.kind === 'lich' ? 38 : 50) + r() * 15);
        const cv = world.caverns[f.home];
        const n = f.kind === 'queen' ? 5 + Math.floor(r() * 6) : f.kind === 'lich' ? 3 + Math.floor(r() * 4) : 1 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const m = foe(f.kind === 'queen' ? (r() < 0.7 ? 'crawler' : 'spider') : f.kind === 'lich' ? 'skeleton' : 'golem', cv, true);
          if (m) m.task = 'hunt';
        }
        say(f.kind === 'queen' ? 'A SWARM POURS OUT OF THE HIVE' : f.kind === 'lich' ? `${name} RAISES THE DEAD` : `${name} SENDS OUT ITS GOLEMS`, f.x, f.y - CELL * 4, '#fca5a5', 'medium');
        emit(f.kind === 'queen' ? 'swarm' : f.kind === 'lich' ? 'deadwake' : 'golems', f.x, f.y, 0.6);
        look('sleeper', f.x, f.y - CELL * 4, 1.3, 8, 6);
        alarm(cellOf(f), 40);
      }
    }
  }
  /** The sleeper, awake: it goes through the rock toward the nearest hold, killing as it goes. */
  function sleeperStep(f: Foe, dt: number) {
    f.anim += dt;
    const living = alive();
    let tx = f.x;
    let ty = f.y;
    let bd = Infinity;
    for (const d of living) {
      const dd = Math.hypot(d.x - f.x, d.y - f.y);
      if (dd < bd) {
        bd = dd;
        tx = d.x;
        ty = d.y;
      }
    }
    const dx = tx - f.x;
    const dy = ty - f.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CELL * 2) {
      const c = Math.round(f.x / CELL);
      const rr = Math.round(f.y / CELL);
      let solid = 0;
      for (let dr = -5; dr <= 0; dr++) for (let dc = -3; dc <= 3; dc++) {
        if (!inb(c + dc, rr + dr)) continue;
        const i = at(c + dc, rr + dr);
        if (mat[i] >= M.SOIL && mat[i] !== M.SEAL) {
          if (mat[i] === M.AQUIFER) breachWater(i);
          else {
            setMat(i, r() < 0.15 ? M.RUBBLE : M.OPEN);
            solid++;
          }
        }
      }
      const sp = solid > 4 ? 6 : 16;
      f.x += (dx / dist) * sp * dt;
      f.y += (dy / dist) * sp * dt;
      f.facing = dx >= 0 ? 1 : -1;
      if (solid && r() < 0.2) world.fx.push({ kind: 'dust', x: f.x, y: f.y - CELL * 3, t0: world.t, dur: 1.5, r: CELL * 3, seed: ids++ });
    }
    for (const d of living) if (Math.hypot(d.x - f.x, d.y - f.y) < CELL * 3.2 && f.cd <= 0) {
      f.cd = 1.1;
      d.hp -= 7;
      world.fx.push({ kind: world.sleeperKind === 'demon' ? 'fire' : 'blast', x: d.x, y: d.y - CELL, t0: world.t, dur: 0.8, r: CELL * 2, seed: ids++ });
      if (d.hp <= 0) die(d, world.sleeperName.toLowerCase());
    }
  }

  // ---- the plague, the neighbours, the gnomes ------------------------------------------------------------------
  let nextPlague = 300 + r() * 400;
  let plagueOn = false;
  let plagueTick = 0;
  function plague(dt: number) {
    if (!drew('plague')) return;
    const living = alive();
    if (!plagueOn && world.t > nextPlague && living.length > 10) {
      plagueOn = true;
      const zero = living[Math.floor(r() * living.length)];
      zero.sick = world.t;
      say(`THE SPORE-SICKNESS IN ${world.holds[zero.hold].name}`, zero.x, zero.y - CELL * 2, '#bef264', 'high');
      emit('plague', zero.x, zero.y, 0.75);
      look('fight', zero.x, zero.y - CELL, 1.4, 8, 5);
    }
    if (!plagueOn) return;
    plagueTick += dt;
    if (plagueTick < 1) return;
    plagueTick = 0;
    for (const d of living.filter((x) => x.sick >= 0)) {
      for (const o of living) if (o.sick < 0 && Math.hypot(o.x - d.x, o.y - d.y) < CELL * 2.5 && r() < 0.05) o.sick = world.t;
      const temple = ready(world.holds[d.hold], 'temple').length > 0;
      if (world.t - d.sick > (temple ? 50 : 85)) {
        if (r() < (temple ? 0.05 : 0.16)) die(d, 'the spore-sickness');
        else d.sick = -1;
      }
    }
    if (!living.some((d) => d.sick >= 0)) {
      plagueOn = false;
      nextPlague = world.t + 500 + r() * 600;
      emit('plagueends', W / 2, H / 2, 0.4);
    }
  }
  let nextWarren = 0;
  let nextGnomes = 0;
  function neighbours() {
    for (const cv of world.caverns) {
      if (!cv.known) continue;
      if (cv.kind === 'warren' && world.t > nextWarren) {
        nextWarren = world.t + 90 + r() * 110;
        for (let k = 0; k < 4 + Math.floor(r() * 5 * Math.max(0.5, hz)); k++) {
          const f = foe(r() < 0.15 ? 'troll' : 'goblin', cv, true);
          if (f) f.task = 'hunt';
        }
        say(`GOBLINS COME UP FROM ${cv.name}`, cv.c * CELL, cv.r * CELL, '#fca5a5', 'high');
        emit('goblins', cv.c * CELL, cv.r * CELL, 0.75);
        look('fight', cv.c * CELL, cv.r * CELL, 1.3, 8, 5);
        alarm(at(Math.round(cv.c), Math.round(cv.r)), 50);
      }
      if (cv.kind === 'gnomes' && world.t > nextGnomes) {
        nextGnomes = world.t + 100 + r() * 100;
        for (const f of world.foes) if (f.alive && f.home === cv.id && f.kind === 'gnome' && r() < 0.5) {
          f.active = true;
          f.task = 'trade';
          f.route = [];
          f.repath = 0;
        }
        emit('gnomes', cv.c * CELL, cv.r * CELL, 0.2);
      }
    }
  }
  function gnomeStep(f: Foe, dt: number) {
    if (f.task === 'trade' || f.task === 'leave') {
      if (f.route.length === 0 || f.ri >= f.route.length) {
        f.repath -= dt;
        if (f.repath <= 0) {
          f.repath = 3;
          if (f.task === 'trade') go(f, (i) => roomAt[i] >= 0 && world.rooms[roomAt[i]].kind === 'store');
          else go(f, (i) => caveAt[i] === f.home);
        }
      }
      if (walk(f, 20, dt)) {
        const i = cellOf(f);
        if (f.task === 'trade' && roomAt[i] >= 0 && world.rooms[roomAt[i]].kind === 'store') {
          const h = world.holds[world.rooms[roomAt[i]].hold];
          h.stocks.gem += 2;
          h.stocks.food += 6;
          f.task = 'leave';
          f.route = [];
          if (once(`gnome-${Math.floor(world.t / 60)}`)) {
            say(`THE DEEP GNOMES TRADE WITH ${h.name}`, f.x, f.y - CELL * 2, '#bbf7d0', 'low');
            emit('trade', f.x, f.y, 0.2);
          }
        } else if (f.task === 'leave' && caveAt[i] === f.home) {
          f.active = false;
          f.task = 'wander';
        }
      }
      return;
    }
    f.repath -= dt;
    if (f.repath <= 0) {
      f.repath = 4 + r() * 6;
      go(f, (i) => caveAt[i] === f.home && r() < 0.02, 700);
    }
    walk(f, 8, dt);
  }

  // ---- the surface: caravans, migrants, goblins, the dragon -----------------------------------------------------
  const edgeFor = (h: Hold) => (h.side > 0 ? Math.min(cols - 1, h.x1 + 6) : Math.max(0, h.x0 - 6));
  function caravan(h: Hold) {
    const ex = edgeFor(h);
    for (let k = 0; k < 6; k++) {
      const f = foe(k % 2 ? 'mule' : 'trader', null, true, (ex + h.side * k * 1.2) * CELL, surface[ex] * CELL);
      if (!f) continue;
      f.task = 'trade';
      f.target = h.id;
    }
    say(`A CARAVAN COMES UP TO ${h.name}`, ex * CELL, surface[ex] * CELL - CELL * 3, '#fde68a', 'low');
    emit('caravan', ex * CELL, surface[ex] * CELL, 0.3);
  }
  const traded = new Set<string>();
  function caravanStep(f: Foe, dt: number) {
    const h = world.holds[f.target];
    if (f.task === 'trade') {
      if (f.route.length === 0 || f.ri >= f.route.length) {
        f.repath -= dt;
        if (f.repath <= 0) {
          f.repath = 2;
          if (!go(f, (i) => roomAt[i] >= 0 && world.rooms[roomAt[i]].kind === 'entrance' && world.rooms[roomAt[i]].hold === h.id && Math.floor(i / cols) === h.gateFloor, 30000)) return;
        }
      }
      if (walk(f, 20, dt) && roomAt[cellOf(f)] >= 0) {
        f.cd = 12;
        f.task = 'leave';
        f.route = [];
        const key = `${h.id}-${Math.floor(world.t / 60)}`;
        if (!traded.has(key)) {
          traded.add(key);
          const sold = Math.min(h.stocks.goods, 6);
          h.stocks.goods -= sold;
          h.stocks.food += 20 + sold * 4;
          h.stocks.ale += 10 + sold * 2;
          h.stocks.treasure += Math.floor(sold / 2);
          emit('trade', f.x, f.y, 0.2);
        }
      }
      return;
    }
    if (f.cd > 0) return;
    if (f.route.length === 0) go(f, (i) => i % cols === edgeFor(h), 30000);
    if (walk(f, 20, dt) && f.route.length) {
      f.alive = false;
      f.deadAt = -999;
    }
  }
  function migrants(h: Hold) {
    const ex = edgeFor(h);
    const n = 3 + Math.floor(r() * 6);
    for (let k = 0; k < n; k++) {
      const d = dwarf(h, pick(['miner', 'miner', 'miner', 'hauler', 'mason', 'farmer', 'brewer', 'smith', 'soldier'] as Job[]), (ex + h.side * k * 1.4) * CELL, surface[ex] * CELL, true);
      d.task = { kind: 'enter', t0: world.t };
    }
    say(`${n} MIGRANTS COME TO ${h.name}`, ex * CELL, surface[ex] * CELL - CELL * 3, '#bbf7d0', 'low');
    emit('migrants', ex * CELL, surface[ex] * CELL, 0.25);
  }
  function goblins(h: Hold) {
    h.attacked = true;
    const ex = edgeFor(h);
    const n = 4 + Math.floor(r() * 4 * Math.max(0.5, hz)) + Math.min(8, Math.floor(world.wealth(h) / 700));
    for (let k = 0; k < n; k++) {
      const f = foe(r() < 0.12 ? 'troll' : 'goblin', null, true, (ex + h.side * k * 1.5) * CELL, surface[ex] * CELL);
      if (!f) continue;
      f.task = 'gate';
      f.target = h.id;
      f.repath = k * 0.3;
    }
    h.gateOpen = false;
    h.gateHp = 120 + (h.attacked ? 40 : 0);
    refreshGates();
    say(`GOBLINS AT THE GATE OF ${h.name}`, h.gateC * CELL, h.gateFloor * CELL - CELL * 3, '#fca5a5', 'high');
    emit('goblins', h.gateC * CELL, h.gateFloor * CELL, 0.8);
    chronicle(`Goblins came up the mountains to the gate of ${T(h.name)}.`);
    look('goblins', (h.gateC + h.side * 10) * CELL, h.gateFloor * CELL, 1.15, 12, 6);
  }
  function dragon(dt: number) {
    const dg = world.dragon;
    if (!dg) {
      if (drew('dragon') && world.t > 150 && world.director.want('dragon', 0.85, 320)) {
        const h = pick(world.holds.filter((x) => !x.fallen));
        if (!h) return;
        const fromLeft = r() < 0.5;
        world.dragon = { x: fromLeft ? -200 : world.GW + 200, y: surface[h.gateC] * CELL - H * 0.4, vx: 0, vy: 0, hp: 60, target: h.id, t0: world.t, state: 'come', breathing: false, wing: 0, name: `${pick(['ASH', 'CINDER', 'GLAUR', 'SMAUL', 'VERMI', 'SKAR', 'ANCALA'])}${pick(['UNG', 'AGON', 'THRAX', 'OR', 'GAR'])}`, color: Math.floor(r() * 4) };
        say(`THE DRAGON ${world.dragon.name} COMES OVER THE PEAKS`, h.gateC * CELL, h.gateFloor * CELL - H * 0.3, '#fb923c', 'high');
        emit('dragon', h.gateC * CELL, h.gateFloor * CELL, 0.9);
        chronicle(`The dragon ${T(world.dragon.name)} came over the peaks to ${T(h.name)}.`);
        look('dragon', h.gateC * CELL, h.gateFloor * CELL - CELL * 12, 1, 14, 8);
      }
      return;
    }
    const h = world.holds[dg.target];
    dg.wing += dt * 7;
    dg.breathing = false;
    const gx = (h.gateC + h.side * 8) * CELL;
    const gy = h.gateFloor * CELL - CELL * 10;
    if (dg.state === 'come') {
      const dx = gx - dg.x;
      const dy = gy - dg.y;
      const d = Math.hypot(dx, dy);
      dg.vx = (dx / d) * 140;
      dg.vy = (dy / d) * 140;
      if (d < 30) {
        dg.state = 'burn';
        dg.t0 = world.t;
      }
    } else if (dg.state === 'burn') {
      const age = world.t - dg.t0;
      // Passes back and forth before the gate, breathing fire into it.
      dg.vx = Math.cos(age * 0.9) * 120 * h.side * -1;
      dg.vy = Math.sin(age * 1.8) * 40;
      dg.breathing = Math.sin(age * 1.3) > 0.2;
      if (dg.breathing && r() < dt * 6) {
        const fx2 = (h.gateC + h.side * (1 + r() * 8)) * CELL;
        world.fx.push({ kind: 'fire', x: fx2, y: h.gateFloor * CELL, t0: world.t, dur: 1.4, r: CELL * 2, seed: ids++ });
        for (const d2 of alive()) if (Math.abs(d2.x - fx2) < CELL * 3 && Math.abs(d2.y - h.gateFloor * CELL) < CELL * 3) die(d2, 'dragonfire');
      }
      look('dragon', dg.x, dg.y + CELL * 6, 1.15, 3, 8);
      // The gate's crossbows.
      for (const d2 of alive()) if (d2.hold === h.id && d2.job === 'soldier' && Math.hypot(d2.x - dg.x, d2.y - dg.y) < CELL * 30 && r() < dt * 0.8) {
        world.fx.push({ kind: 'bolt', x: d2.x, y: d2.y - CELL, x1: dg.x, y1: dg.y, t0: world.t, dur: 0.4, r: 1, seed: ids++ });
        dg.hp -= 1;
      }
      if (age > 12 && once(`dragon-burn-${Math.floor(dg.t0)}`)) {
        const e = entranceOf(h);
        e.ruined = true;
        say(`${dg.name} BURNS THE GATEHALL OF ${h.name}`, h.gateC * CELL, h.gateFloor * CELL - CELL * 4, '#fca5a5', 'high');
        emit('dragonfire', h.gateC * CELL, h.gateFloor * CELL, 0.85);
      }
      if (dg.hp <= 0) {
        dg.state = 'fall';
        dg.t0 = world.t;
        say(`${dg.name} FALLS ON THE MOUNTAIN`, dg.x, dg.y, '#fde68a', 'high');
        emit('dragonslain', dg.x, dg.y, 1);
        chronicle(`The crossbows of ${T(h.name)} brought down the dragon ${T(dg.name)}.`);
        h.stocks.treasure += 80;
      } else if (age > 50) {
        dg.state = 'leave';
        say(`${dg.name} FLIES OFF OVER THE PEAKS`, dg.x, dg.y, '#fdba74', 'medium');
        emit('dragonleaves', dg.x, dg.y, 0.5);
      }
    } else if (dg.state === 'leave') {
      dg.vx = (dg.x < world.GW / 2 ? -1 : 1) * 160;
      dg.vy = -60;
      if (dg.x < -300 || dg.x > world.GW + 300) world.dragon = null;
    } else {
      dg.vx *= 0.98;
      dg.vy += 220 * dt;
      const ground = surface[Math.max(0, Math.min(cols - 1, Math.floor(dg.x / CELL)))] * CELL;
      if (dg.y >= ground) {
        dg.y = ground;
        dg.vy = 0;
        dg.vx = 0;
        world.fx.push({ kind: 'dust', x: dg.x, y: ground, t0: world.t, dur: 3, r: CELL * 8, seed: ids++ });
        later(60, () => (world.dragon = null));
        dg.state = 'leave';
        dg.hp = -999;
      }
    }
    if (dg.hp > -999) {
      dg.x += dg.vx * dt;
      dg.y += dg.vy * dt;
    }
  }

  // ---- war and peace between the holds --------------------------------------------------------------------
  function politicsStep() {
    for (const hw of world.highways) {
      if (!hw.open) continue;
      const a = world.holds[hw.a];
      const b = world.holds[hw.b];
      if (a.fallen || b.fallen) continue;
      // Old feuds flare; rivals bicker; allies forgive.
      const drift = drew('rivals') ? -0.01 : drew('allies') ? 0.006 : -0.003;
      a.relation[b.id] = b.relation[a.id] = Math.max(-1, Math.min(1, a.relation[b.id] + drift + (r() - 0.5) * 0.02));
      if (a.war < 0 && b.war < 0 && a.relation[b.id] < -0.35 && world.director.want('war', 0.8, 200)) {
        const [att, def] = world.wealth(a) < world.wealth(b) ? [a, b] : [b, a];
        declareWar(att, def);
      }
    }
    for (const h of world.holds) {
      if (h.war < 0) continue;
      const enemy = world.holds[h.war];
      const squad = world.dwarves.filter((d) => d.alive && d.hold === h.id && d.squad === enemy.id);
      if (!squad.length || world.t - h.warT0 > 240) peace(h, enemy, squad.length ? 'the long war wore both down' : `the host of ${T(h.name)} was broken`);
    }
  }
  function declareWar(a: Hold, b: Hold) {
    a.war = b.id;
    a.warT0 = world.t;
    a.attacked = b.attacked = true;
    const soldiers2 = world.dwarves.filter((d) => d.alive && d.hold === a.id && d.job === 'soldier');
    const levy = world.dwarves.filter((d) => d.alive && d.hold === a.id && (d.job === 'miner' || d.job === 'hauler')).slice(0, 3);
    for (const d of levy) {
      d.job = 'soldier';
      d.hp = 16;
    }
    const target = ready(b, 'hall')[0] ?? ready(b, 'treasury')[0] ?? entranceOf(b);
    for (const d of [...soldiers2, ...levy].slice(0, 14)) {
      d.squad = b.id;
      d.task = { kind: 'march', room: target, t0: world.t, stage: 0 };
      d.route = [];
    }
    const x = ((a.shaftC + b.shaftC) / 2) * CELL;
    const y = world.highways.find((hw) => (hw.a === a.id && hw.b === b.id) || (hw.a === b.id && hw.b === a.id))?.floor ?? a.gateFloor;
    say(`${a.name} MARCHES ON ${b.name}`, x, y * CELL, '#fca5a5', 'high');
    emit('war', x, y * CELL, 0.85);
    chronicle(`Over ${pick(['a seam of mithril', 'an old grudge', 'a broken oath', 'the toll on the highway', 'a stolen crown'])}, ${T(a.clan)} marched on ${T(b.name)}.`);
    look('war', x, y * CELL, 1.2, 12, 7);
  }
  function peace(a: Hold, b: Hold, why: string) {
    a.war = -1;
    a.relation[b.id] = b.relation[a.id] = 0.1;
    for (const d of world.dwarves) if (d.hold === a.id && d.squad >= 0) {
      d.squad = -1;
      d.task = null;
    }
    say(`${a.name} AND ${b.name} MAKE PEACE`, ((a.shaftC + b.shaftC) / 2) * CELL, a.gateFloor * CELL, '#bbf7d0', 'medium');
    emit('peace', ((a.shaftC + b.shaftC) / 2) * CELL, a.gateFloor * CELL, 0.5);
    chronicle(`Peace between ${T(a.name)} and ${T(b.name)}: ${why}.`);
  }
  /** A soldier of a host on the march: through the highway to the enemy's hall; there, the sack. */
  function march(d: Dwarf, dt: number) {
    const task = d.task!;
    const enemy = world.holds[d.squad];
    const room = task.room!;
    if (d.route.length === 0 || d.ri >= d.route.length) {
      d.repath -= dt;
      if (d.repath <= 0) {
        d.repath = 3;
        if (roomAt[cellOf(d)] !== room.id) go(d, roomGoal(room), 40000);
      }
    }
    walk(d, 40, dt);
    if (roomAt[cellOf(d)] === room.id) {
      const defenders = world.dwarves.some((e) => e.alive && e.hold === enemy.id && e.job === 'soldier' && Math.hypot(e.x - d.x, e.y - d.y) < CELL * 15);
      if (!defenders) {
        task.stage = (task.stage ?? 0) + dt;
        d.swingUntil = world.t + 0.2;
        if (task.stage > 12 && once(`sack-${enemy.id}-${Math.floor(world.t / 120)}`)) {
          const h = world.holds[d.hold];
          const loot = Math.min(enemy.stocks.treasure, 25) + Math.min(enemy.stocks.gold, 10);
          enemy.stocks.treasure = Math.max(0, enemy.stocks.treasure - 25);
          enemy.stocks.gold = Math.max(0, enemy.stocks.gold - 10);
          h.stocks.treasure += loot;
          room.ruined = true;
          say(`${h.name} SACKS ${enemy.name}`, d.x, d.y - CELL * 3, '#fca5a5', 'high');
          emit('sack', d.x, d.y, 0.85);
          chronicle(`${T(h.clan)} sacked ${T(ROOM_NAMES[room.kind].toLowerCase())} of ${T(enemy.name)}.`);
          look('war', d.x, d.y - CELL * 2, 1.4, 10, 7);
          peace(h, enemy, 'the sack was enough');
        }
      }
    }
  }

  // ---- falls and reclaims ---------------------------------------------------------------------------------
  function checkFalls() {
    for (const h of world.holds) {
      const n = pop(h);
      if (!h.fallen && n === 0 && world.t - h.founded > 20) {
        h.fallen = true;
        h.fallenAt = world.t;
        h.war = -1;
        for (const room of world.rooms) if (room.hold === h.id) room.ruined = true;
        for (const gd of digs) if (gd.hold === h.id) gd.cells.clear();
        say(`${h.name} FALLS`, h.shaftC * CELL, h.gateFloor * CELL - CELL * 4, '#fca5a5', 'high');
        emit('holdfalls', h.shaftC * CELL, h.gateFloor * CELL, 1);
        chronicle(`${T(h.name)} fell, and its halls went dark.`);
        look('fall', h.shaftC * CELL, h.gateFloor * CELL, 0.9, 14, 9);
      }
      if (h.fallen && world.t - h.fallenAt > 100) {
        // Another clan comes: a neighbour, or strangers over the mountains.
        h.fallen = false;
        h.founded = world.t;
        const by = world.holds.find((o) => o !== h && !o.fallen && pop(o) > 20 && r() < 0.6);
        h.clan = by ? by.clan : uniq(() => pick(CLAN1) + pick(CLAN2));
        h.color = by ? by.color : pick(BANNERS);
        h.reign = 1;
        h.gateOpen = true;
        refreshGates();
        const ex = edgeFor(h);
        const jobs: Job[] = ['king', 'miner', 'miner', 'miner', 'hauler', 'mason', 'mason', 'smith', 'farmer', 'brewer', 'soldier', 'soldier'];
        for (const [k, j] of jobs.entries()) {
          const d = dwarf(h, j, (ex + h.side * k * 1.3) * CELL, surface[ex] * CELL, true);
          d.task = { kind: 'enter', t0: world.t };
          if (j === 'king') h.king = d;
        }
        say(`THE ${h.clan} CLAN COMES TO RETAKE ${h.name}`, ex * CELL, surface[ex] * CELL - CELL * 3, '#bbf7d0', 'high');
        emit('reclaim', ex * CELL, surface[ex] * CELL, 0.8);
        chronicle(`${by ? `${T(by.name)} sent settlers` : `The ${T(h.clan)} clan came`} to retake ${T(h.name)}.`);
        look('surface', (h.gateC + h.side * 10) * CELL, h.gateFloor * CELL, 1, 12, 7);
      }
    }
  }

  // ---- the frame --------------------------------------------------------------------------------------------
  /**
   * A visitor's touch. On the slopes or in the sky: traders come up the road. In a hold's
   * rooms: the bell rings for a feast. In plain rock: a vein shows itself, and the miners
   * will find it (one every half minute at most). Once every few seconds.
   */
  let lastNudge = -Infinity;
  let lastVein = -Infinity;
  function nudge(px: number, py: number): string | null {
    if (world.t - lastNudge < 4) return null;
    const c = Math.max(0, Math.min(cols - 1, Math.floor(px / CELL)));
    const rr = Math.max(0, Math.min(rows - 1, Math.floor(py / CELL)));
    const i = at(c, rr);
    const h = world.holdAt(c);
    if (!h || h.fallen) return null;
    const said = (text: string, color: string) => {
      lastNudge = world.t;
      say(text, px, py - CELL * 2, color, 'high');
      emit('nudge', px, py, 0.3);
      return text;
    };
    if (rr < surface[c]) {
      caravan(h);
      return said(`TRADERS SET OUT FOR ${h.name}`, '#fde68a');
    }
    const room = roomAt[i] >= 0 ? world.rooms[roomAt[i]] : null;
    if (room && room.dug && h.feast < world.t) {
      h.feast = world.t + 24;
      h.nextFeast = Math.max(h.nextFeast, world.t + 120);
      return said(`THE BELL RINGS IN ${h.name}: A FEAST`, '#fde68a');
    }
    const m = mat[i];
    if (m >= M.SOIL && m <= M.DEEP && world.t - lastVein > 30) {
      lastVein = world.t;
      const depth = (rr - surface[c]) / Math.max(1, rows - surface[c]);
      const ore = depth > 0.6 && r() < 0.5 ? M.GEM : depth > 0.3 && r() < 0.6 ? M.GOLD : M.IRON;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const cc = c + dx;
          const r2 = rr + dy;
          if (!inb(cc, r2) || r2 <= surface[cc] + 1 || Math.abs(dx) + Math.abs(dy) > 2) continue;
          const j = at(cc, r2);
          if (mat[j] >= M.SOIL && mat[j] <= M.DEEP) setMat(j, ore);
        }
      world.fx.push({ kind: 'glint', x: px, y: py, t0: world.t, dur: 3, r: CELL * 3, seed: ids++, color: ore === M.GEM ? '#c084fc' : ore === M.GOLD ? '#facc15' : '#f97316' });
      return said(ore === M.GEM ? 'GEMS GLITTER IN THE ROCK' : ore === M.GOLD ? 'A SEAM OF GOLD SHOWS IN THE ROCK' : 'IRON SHOWS RED IN THE ROCK', '#facc15');
    }
    return null;
  }

  function establish() {
    const p = r();
    const hs = world.holds.filter((h) => !h.fallen);
    const h = hs[Math.floor(r() * Math.max(1, hs.length))] ?? world.holds[0];
    if (p < 0.25) return { x: world.GW / 2, y: rows * CELL * 0.35, zoom: 0.6 };
    if (p < 0.6) {
      const deep = levelFloor(h, Math.max(1, h.levels.length - 1));
      return { x: h.shaftC * CELL, y: ((h.gateFloor + deep) / 2) * CELL, zoom: 0.85 };
    }
    const busy = world.dwarves.filter((d) => d.alive && (d.task?.kind === 'dig' || d.task?.kind === 'work' || d.task?.kind === 'march'));
    const d = busy[Math.floor(r() * busy.length)];
    return d ? { x: d.x, y: d.y - CELL * 2, zoom: 1.35 } : { x: h.shaftC * CELL, y: h.gateFloor * CELL, zoom: 1 };
  }
  let nextPlan = 1;
  let nextGoblins = 70 + r() * 80;
  let nextCave = 30;
  let nextMood = 100 + r() * 100;
  let nextPolitics = 5;
  let lastSeason = world.season;
  const seasonBase = world.season;
  let digTick = 0;
  function step(dt: number) {
    world.t += dt;
    world.day = (world.day + dt / DAY) % 1;
    world.director.step(world.t, dt);
    budget = 14;
    world.quake = Math.max(0, world.quake - dt * 0.5);
    for (let i = pending.length - 1; i >= 0; i--) if (world.t >= pending[i].at) {
      const f = pending[i].fn;
      pending.splice(i, 1);
      f();
    }
    // The year.
    const s = (seasonBase + Math.floor(world.t / SEASON)) % 4;
    if (s !== lastSeason) {
      lastSeason = s;
      world.season = s;
      if (s === 0) {
        world.year++;
        for (const d of world.dwarves) d.age++;
      }
      emit(SEASONS[s].toLowerCase(), world.GW / 2, baseR * CELL, 0.15);
      for (const h of world.holds) {
        if (h.fallen) continue;
        if (s !== 3) later(10 + r() * 80, () => caravan(h));
      }
      for (const d of alive()) if (d.age > 230 && r() < 0.2) die(d, 'old age');
    }
    if (world.t >= nextPlan) {
      nextPlan = world.t + 1.2;
      for (const h of world.holds) plan(h);
    }
    for (const d of world.dwarves) {
      if (!d.alive) continue;
      const h = world.holds[d.hold];
      if (d.task?.kind === 'enter') {
        if (d.route.length === 0 || d.ri >= d.route.length) {
          const e = entranceOf(h);
          if (!go(d, (i) => roomAt[i] === e.id && Math.floor(i / cols) === h.gateFloor, 30000) && world.t - d.task.t0 > 30) {
            d.outside = false;
            d.task = null;
          }
        }
        if (walk(d, 30, dt) && roomAt[cellOf(d)] >= 0) {
          d.outside = false;
          d.task = null;
        }
        continue;
      }
      if (d.task?.kind === 'march') {
        if (d.squad < 0) d.task = null;
        else march(d, dt);
        continue;
      }
      if (d.job === 'soldier' && d.task?.kind === 'fight') continue;
      act(d, dt);
      const i = cellOf(d);
      if (water[i] > 0.75 && i >= cols && water[i - cols] > 0.5) {
        d.drown += dt;
        if (d.drown > 12) die(d, 'drowning');
      } else d.drown = Math.max(0, d.drown - dt);
      if (magma[i] > 0.15) {
        die(d, 'magma');
        world.fx.push({ kind: 'fire', x: d.x, y: d.y - CELL, t0: world.t, dur: 1.2, r: CELL * 1.5, seed: ids++ });
      }
    }
    soldiers(dt);
    foes(dt);
    bosses(dt);
    plague(dt);
    neighbours();
    dragon(dt);
    fluids(dt);
    if (world.t > nextPolitics) {
      nextPolitics = world.t + 3;
      politicsStep();
      checkFalls();
    }
    // Feasts, moods, goblins, cave-ins.
    for (const h of world.holds) {
      if (h.fallen) continue;
      if (world.t > h.nextFeast && ready(h, 'hall').length && h.stocks.ale > 6) {
        h.nextFeast = world.t + 240 + r() * 240;
        h.feast = world.t + 24;
        h.stocks.ale -= 6;
        const hall = ready(h, 'hall')[0];
        say(`A FEAST IN ${h.name}`, ((hall.c0 + hall.c1) / 2) * CELL, hall.top * CELL, '#fde68a', 'medium');
        emit('feast', ((hall.c0 + hall.c1) / 2) * CELL, hall.floor * CELL, 0.35);
        look('feast', ((hall.c0 + hall.c1) / 2) * CELL, hall.floor * CELL - CELL * 3, 1.35, 10, 3);
      }
      const n = pop(h);
      if (world.t > h.nextMigrants) {
        h.nextMigrants = world.t + 70 + r() * 90;
        const beds = world.rooms.filter((x) => x.hold === h.id && x.kind === 'dorm' && x.dug).length * 8;
        if (n < 55 * scale && (beds > n || n < 16)) migrants(h);
      }
      h.stocks.food = Math.max(0, h.stocks.food - n * dt * 0.004);
      h.stocks.ale = Math.max(0, h.stocks.ale - n * dt * 0.003);
      if (h.lift) {
        const top = h.gateFloor * CELL;
        const bottom = levelFloor(h, Math.max(1, h.levels.length - 1)) * CELL;
        h.lift.y += h.lift.dir * 30 * dt;
        if (h.lift.y > bottom) h.lift.dir = -1;
        if (h.lift.y < top) h.lift.dir = 1;
      }
    }
    if (world.t > nextMood) {
      nextMood = world.t + 260 + r() * 300;
      const h = pick(world.holds.filter((x) => !x.fallen && ready(x, 'forge').length));
      if (h) {
        const who = world.dwarves.filter((d) => d.alive && d.hold === h.id && (d.job === 'smith' || d.job === 'mason'))[0];
        const forge = ready(h, 'forge')[0];
        if (who && forge) {
          who.task = { kind: 'mood', room: forge, t0: world.t, stage: 0 };
          go(who, roomGoal(forge));
          say(`${who.name} OF ${h.name} IS TAKEN BY A STRANGE MOOD`, who.x, who.y - CELL * 2, '#c4b5fd', 'medium');
          emit('mood', who.x, who.y, 0.45);
        }
      }
    }
    if (drew('goblins') && world.t > nextGoblins && hz > 0) {
      nextGoblins = world.t + (300 + r() * 300) / Math.max(0.4, hz);
      const h = pick(world.holds.filter((x) => !x.fallen));
      if (h) goblins(h);
    }
    for (const h of world.holds) if (!h.gateOpen && !world.foes.some((f) => f.alive && f.task === 'gate' && f.target === h.id)) {
      h.gateOpen = true;
      refreshGates();
      emit('gateheld', h.gateC * CELL, h.gateFloor * CELL, 0.35);
    }
    if (world.t > nextCave) {
      nextCave = world.t + 8;
      for (const room of world.rooms) {
        if (!room.dug || room.kind === 'entrance' || room.c1 - room.c0 < 9) continue;
        const above = mat[at(Math.round((room.c0 + room.c1) / 2), room.top - 1)];
        const weak = above === M.SOIL || above === M.SLATE || above === M.ICE || above === M.RUBBLE;
        const odds = (weak ? 0.006 : 0.0015) * hz * (drew('weakrock') ? 1.8 : 0.3) + world.quake * 0.04;
        if (r() < odds) {
          caveIn(room);
          break;
        }
      }
    }
    // Digs: finished ones close; stale ones are given up; stale claims released.
    if (digTick++ % 30 === 0) for (const gd of digs) {
      for (const i of gd.cells) if (isOpen(mat[i])) gd.cells.delete(i);
      for (const [i, id] of gd.claimed) {
        const d = world.dwarves.find((x) => x.id === id);
        if (!d || !d.alive || d.task?.kind !== 'dig' || d.task.cell !== i) gd.claimed.delete(i);
      }
    }
    for (let i = digs.length - 1; i >= 0; i--) {
      const gd = digs[i];
      if (gd.cells.size === 0 || world.t - gd.last > (gd.purpose === 'highway' ? 400 : 150)) {
        digs.splice(i, 1);
        for (const j of gd.cells) resv[j] = 0;
        if (gd.cells.size === 0) gd.done?.();
        else if (gd.room) gd.room.dug = true;
      }
    }
    world.dwarves = world.dwarves.filter((d) => d.alive || world.t - d.deadAt < 30);
    world.foes = world.foes.filter((f) => f.alive || (f.deadAt > 0 && world.t - f.deadAt < 20));
    for (const cv of world.caverns) if (cv.known && !cv.claimed && (cv.kind === 'cavern' || cv.kind === 'lake') && r() < dt * 0.003 * hz && world.foes.filter((f) => f.alive && f.home === cv.id).length < 6) {
      const f = foe(r() < 0.2 ? 'troll' : r() < 0.5 ? 'spider' : 'crawler', cv, true);
      if (f) f.task = 'hunt';
    }
    for (let i = world.fx.length - 1; i >= 0; i--) if (world.t - world.fx[i].t0 > world.fx[i].dur) world.fx.splice(i, 1);
    if (world.fx.length > 500) world.fx.splice(0, world.fx.length - 500);
    for (let i = world.labels.length - 1; i >= 0; i--) if (world.t - world.labels[i].t0 > world.labels[i].dur) world.labels.splice(i, 1);
  }

  // The first wagons and the first migrants, so the range is busy from the start.
  later(4 + r() * 6, () => caravan(pick(world.holds)));
  later(18 + r() * 10, () => migrants(pick(world.holds)));
  world.director = createDirector(g.fork('director').rng, { arc: g.pick(ARCS), period: g.range(240, 400), floor: 0.3, establish });
  for (const h of world.holds) chronicle(`The ${T(h.clan)} clan held ${T(h.name)}.`);
  return world;
}
