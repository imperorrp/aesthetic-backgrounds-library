/**
 * Deephold: a dwarf hold under a mountain, in cutaway. No DOM.
 *
 * The mountain is a grid of cells (`mat`): sky above its slopes; soil, stone, slate, deep
 * stone, and basalt going down; veins of coal, iron, gold, gems, and (deep, rare) mithril;
 * and things the dwarves cannot see but the viewer can: pockets of water and of magma,
 * caverns of glowing fungus with things living in them, the buried halls of an older people,
 * a sea of magma at the roots, and a chamber where something sleeps.
 *
 * Every seed is a different mountain (iron, crystal, frost, ember, drowned), with its own
 * strata, ores, hazards, and sleeper, and a different clan with its own king.
 *
 * The dwarves live by the day and the season. Miners dig what the overseer lays out:
 * galleries off the shaft, rooms off the galleries (store, dorm, farm, brewery, forge, great
 * hall, temple, tombs, barracks, treasury, pumps, records, a magma forge), new deeps down the
 * shaft, and tunnels along the veins. Haulers cart the ore up; smiths, brewers, and farmers
 * work their rooms; masons furnish them, prop them, and seal what must be sealed. They
 * sleep at night and feast in the hall. Caravans come in summer; migrants when the hold
 * grows rich; kings die and are succeeded; a smith taken by a strange mood forges an
 * artifact.
 *
 * Digging has consequences. Water breaks in from an aquifer and floods a deep (and the water
 * flows: `water`, a cellular fluid); magma likewise (it cools to obsidian, and hisses into
 * steam where it meets water). Wide rooms in weak rock cave in; coal seams hold firedamp.
 * Caverns broken into let their creatures out; the old halls hold treasure, and sometimes
 * their dead. Goblins come to the gate. And if the dwarves dig too greedily and too deep
 * (mithril lies near the sleeper), it stirs, and wakes, and climbs: the soldiers fight it,
 * the masons try to seal the shaft above it, and the hold may fall, to be reclaimed by
 * another clan.
 *
 * Everyone walks the tunnels for real: a breadth-first search over the open cells, with
 * ladders in the shaft and steps along the veins (`route`).
 *
 * Space: world px, x across (0..GW), y down (0..GH); a cell is CELL px square. The sim says
 * where the camera should look (`focus`).
 */
import { forkRng, type Rng } from '../../rng';
import { createBus, type Bus } from '../../sim/bus';
import { titled } from './names';

export type Mountain = 'iron' | 'crystal' | 'frost' | 'ember' | 'drowned';
const MOUNTAINS: Mountain[] = ['iron', 'crystal', 'frost', 'ember', 'drowned'];
export const MOUNTAIN_NAMES: Record<Mountain, string> = { iron: 'THE IRON MOUNTAIN', crystal: 'THE CRYSTAL DEEP', frost: 'THE FROSTPEAK', ember: 'THE EMBER MOUNT', drowned: 'THE DROWNED MOUNTAIN' };

/** Materials. Everything up to CAVE is open; the rest is solid. */
export const M = { SKY: 0, OPEN: 1, CAVE: 2, SOIL: 3, STONE: 4, SLATE: 5, DEEP: 6, BASALT: 7, ICE: 8, IRON: 9, COAL: 10, GOLD: 11, GEM: 12, MITHRIL: 13, AQUIFER: 14, MAGMA: 15, RUIN: 16, RUBBLE: 17, OBSIDIAN: 18, SEAL: 19 } as const;
/** Seconds to dig each material. */
const HARD = [0, 0, 0, 0.5, 1.1, 0.9, 1.6, 2.4, 0.8, 1.3, 0.8, 1.2, 1.8, 3, 0.9, 2, 1.5, 0.35, 3, 4];
export const isOpen = (m: number) => m <= 2;
const ORE: Partial<Record<number, Load['kind']>> = { 9: 'iron', 10: 'coal', 11: 'gold', 12: 'gem', 13: 'mithril' };

export type Job = 'miner' | 'hauler' | 'smith' | 'brewer' | 'farmer' | 'mason' | 'soldier' | 'king';
export type RoomKind = 'entrance' | 'store' | 'dorm' | 'farm' | 'brewery' | 'forge' | 'hall' | 'temple' | 'tomb' | 'barracks' | 'treasury' | 'pump' | 'library' | 'magmaforge';
export const ROOM_NAMES: Record<RoomKind, string> = {
  entrance: 'THE GATEHALL', store: 'THE STOREROOM', dorm: 'THE DORMITORY', farm: 'THE MUSHROOM FARM', brewery: 'THE BREWERY', forge: 'THE FORGE', hall: 'THE GREAT HALL', temple: 'THE TEMPLE',
  tomb: 'THE TOMBS', barracks: 'THE BARRACKS', treasury: 'THE TREASURY', pump: 'THE PUMPS', library: 'THE HALL OF RECORDS', magmaforge: 'THE MAGMA FORGE',
};
/** Width and height in cells (the height includes the gallery's three rows). */
const ROOM_SIZE: Record<RoomKind, [number, number]> = {
  entrance: [14, 6], store: [10, 5], dorm: [12, 5], farm: [14, 5], brewery: [9, 5], forge: [9, 5], hall: [24, 7], temple: [11, 7], tomb: [11, 4], barracks: [11, 5], treasury: [8, 5], pump: [5, 5], library: [10, 5], magmaforge: [10, 5],
};

export type Load = { id: number; kind: 'iron' | 'coal' | 'gold' | 'gem' | 'mithril'; cell: number; taken: boolean; skip: number };
export type Room = { id: number; kind: RoomKind; level: number; c0: number; c1: number; top: number; floor: number; dug: boolean; furnished: boolean; pillars: boolean; ruined: boolean; work: number };
export type Task = {
  kind: 'dig' | 'haul' | 'work' | 'sleep' | 'feast' | 'flee' | 'fight' | 'furnish' | 'idle' | 'leave' | 'seal' | 'mood' | 'enter' | 'trade';
  cell?: number;
  room?: Room;
  load?: Load;
  until?: number;
  t0: number;
  stage?: number;
};
export type Dwarf = {
  id: number; name: string; job: Job; x: number; y: number; at: number; route: number[]; ri: number; task: Task | null; hp: number; alive: boolean; deadAt: number; anim: number;
  facing: 1 | -1; beard: number; variant: number; age: number; fails: number; carry: Load | null; swingUntil: number; drown: number; cd: number; repath: number; outside: boolean; crossbow: boolean; mad: boolean;
};
export type FoeKind = 'goblin' | 'spider' | 'troll' | 'skeleton' | 'crawler' | 'trader' | 'mule';
export type Foe = { id: number; kind: FoeKind; x: number; y: number; at: number; route: number[]; ri: number; hp: number; hpMax: number; alive: boolean; deadAt: number; anim: number; facing: 1 | -1; cd: number; home: number; active: boolean; swingUntil: number; repath: number; lost: number; task: 'wander' | 'hunt' | 'gate' | 'leave' | 'trade' };
export type SleeperKind = 'worm' | 'spider' | 'giant' | 'demon' | 'tentacle';
export type Sleeper = { kind: SleeperKind; name: string; x: number; y: number; hp: number; hpMax: number; state: 'sleep' | 'stir' | 'rise' | 'batter' | 'return' | 'dead'; t0: number; way: [number, number][]; anim: number; facing: 1 | -1; home: [number, number]; cd: number; wounded: boolean; woke: number };
export type Fx = { kind: 'dust' | 'spark' | 'glint' | 'blast' | 'steam' | 'splash' | 'rubble' | 'ghost' | 'bolt' | 'fire' | 'rune' | 'z'; x: number; y: number; x1?: number; y1?: number; t0: number; dur: number; r: number; seed: number; color?: string };
export type Label = { text: string; x: number; y: number; color: string; t0: number; dur: number };
export type Level = { k: number; floor: number; left: number; right: number; sealed: boolean };
export type Cavern = { id: number; c: number; r: number; known: boolean; kind: 'cavern' | 'lake' | 'ruin' | 'lair'; clearAt: number; claimed: boolean; name: string };

export type DeepOptions = { mountain: string; depth: number; hazards: number; sleeper: boolean };

export type DeepWorld = {
  t: number; W: number; H: number; GW: number; GH: number; CELL: number; cols: number; rows: number; bus: Bus;
  name: string; clan: string; king: Dwarf | null; reign: number; mountain: Mountain;
  mat: Uint8Array; water: Float32Array; magma: Float32Array; ladder: Uint8Array; roomAt: Int16Array; caveAt: Int8Array;
  /** Cells whose material changed since the painter last looked. */
  dirty: number[];
  surface: Int16Array;
  gate: { c: number; floor: number; open: boolean; hp: number; hpMax: number; side: 1 | -1 };
  shaftC: number; levels: Level[]; rooms: Room[]; dwarves: Dwarf[]; foes: Foe[]; caverns: Cavern[]; sleeper: Sleeper | null; loads: Load[]; fx: Fx[]; labels: Label[];
  chronicle: { t: number; text: string }[];
  stocks: { food: number; ale: number; iron: number; coal: number; gold: number; gem: number; mithril: number; goods: number; treasure: number };
  artifacts: { name: string; maker: string }[];
  deaths: number; day: number; season: number; year: number; quake: number; fallen: boolean; feast: number;
  focus: { x: number; y: number; zoom: number; until: number; why: string };
  /** The deepest any dwarf has dug, as a row, and its column. */
  deepest: number;
  deepestCol: number;
  cellX(i: number): number;
  cellY(i: number): number;
  wealth(): number;
  step(dt: number): void;
  counts(): Record<string, number>;
};

const DAY = 160;
const SEASON = 150;
const LEV = 10;
export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;
const ORD = ['GATE', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH', 'THIRTEENTH', 'FOURTEENTH', 'FIFTEENTH', 'SIXTEENTH', 'SEVENTEENTH', 'EIGHTEENTH', 'NINETEENTH', 'TWENTIETH'];
export const deepName = (k: number) => (k <= 0 ? 'THE GATEHALL' : `THE ${ORD[k] ?? `${k}TH`} DEEP`);

const N1 = ['UR', 'THO', 'BAL', 'DU', 'GIM', 'KHA', 'BRO', 'FUN', 'NAR', 'OI', 'GLO', 'THRA', 'BO', 'MO', 'DAI', 'KI', 'NO', 'FRE', 'BRA', 'GRO', 'HE', 'SKA'];
const N2 = ['IN', 'RIN', 'LI', 'DIN', 'GAR', 'DOK', 'BUR', 'NAR', 'LOK', 'GRIM', 'DUR', 'MIR', 'THOR', 'BALD', 'RAK', 'RIK', 'KAR', 'VI', 'ROD', 'MLI'];
const CLAN1 = ['STONE', 'IRON', 'DEEP', 'GOLD', 'ANVIL', 'COPPER', 'GRANITE', 'ASH', 'FROST', 'EMBER', 'HAMMER', 'BRONZE', 'COAL', 'SILVER'];
const CLAN2 = ['BEARD', 'FIST', 'HELM', 'FORGE', 'DELVER', 'SHIELD', 'MANTLE', 'HEART', 'BROW', 'BORN', 'GUARD'];
const HOLD1 = ['KAR', 'BAR', 'DUR', 'ZAR', 'GUN', 'MOR', 'THAR', 'NAL', 'BRUN', 'KHEL', 'AZ', 'VOR'];
const HOLD2 = ['AK', 'GRIM', 'HELM', 'DAL', 'KUL', 'UND', 'RUK', 'BAZ', 'DRUM', 'GOL', 'ZIRAK', 'HOLD'];
const ART_KIND = ['AXE', 'HAMMER', 'CROWN', 'SHIELD', 'CHALICE', 'RING', 'HELM', 'ANVIL', 'LANTERN', 'BLADE', 'GAUNTLET', 'CIRCLET'];
const ART_NAME = ['STARFALL', 'DEEPHEART', 'EMBERKISS', 'OATHSTONE', 'NIGHTFORGE', 'GLOAMING', 'KINGSBANE', 'THE LONG MEMORY', 'MOUNTAINROOT', 'FIRSTLIGHT', 'SORROW', 'THE LAST WORD', 'GRUDGEKEEPER', 'THE COLD WEIGHT'];
const SLEEPERS: Record<Mountain, [SleeperKind, string]> = {
  iron: ['worm', 'THE STONE-EATER'], crystal: ['spider', 'THE GLASS MOTHER'], frost: ['giant', 'THE RIME KING'], ember: ['demon', 'THE FLAME BENEATH'], drowned: ['tentacle', 'THE DROWNED ONE'],
};

export function createDeepWorld(seed: string | number, W: number, H: number, opts: DeepOptions): DeepWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'deep');
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  let ids = 1;
  const mountain: Mountain = (MOUNTAINS as string[]).includes(opts.mountain) ? (opts.mountain as Mountain) : pick(MOUNTAINS);
  const CELL = Math.max(6, Math.round(H / 80));
  const cols = Math.ceil((W * 1.6) / CELL);
  const rows = Math.ceil((H * 2.6) / CELL);
  const N = cols * rows;
  const mat = new Uint8Array(N);
  const water = new Float32Array(N);
  const magma = new Float32Array(N);
  const ladder = new Uint8Array(N);
  const roomAt = new Int16Array(N).fill(-1);
  const caveAt = new Int8Array(N).fill(-1);
  const veinAt = new Int16Array(N).fill(-1);
  const surface = new Int16Array(cols);
  const hz = Math.max(0, opts.hazards);
  const dwarfName = () => pick(N1) + pick(N2);

  const world: DeepWorld = {
    t: 0, W, H, GW: cols * CELL, GH: rows * CELL, CELL, cols, rows, bus,
    name: pick(HOLD1) + pick(HOLD2), clan: pick(CLAN1) + pick(CLAN2), king: null, reign: 1, mountain,
    mat, water, magma, ladder, roomAt, caveAt, dirty: [], surface,
    gate: { c: 0, floor: 0, open: true, hp: 120, hpMax: 120, side: 1 },
    shaftC: 0, levels: [], rooms: [], dwarves: [], foes: [], caverns: [], sleeper: null, loads: [], fx: [], labels: [], chronicle: [],
    stocks: { food: 30, ale: 20, iron: 2, coal: 2, gold: 0, gem: 0, mithril: 0, goods: 4, treasure: 0 },
    artifacts: [], deaths: 0, day: 0.3, season: Math.floor(r() * 3), year: 200 + Math.floor(r() * 600), quake: 0, fallen: false, feast: -1,
    focus: { x: 0, y: 0, zoom: 0.7, until: 0, why: 'overview' },
    deepest: 0,
    deepestCol: 0,
    cellX: (i) => ((i % cols) + 0.5) * CELL,
    cellY: (i) => (Math.floor(i / cols) + 1) * CELL,
    wealth: () => {
      const s = world.stocks;
      return Math.round(s.goods * 10 + s.gold * 8 + s.gem * 20 + s.mithril * 60 + s.treasure * 30 + world.artifacts.length * 500);
    },
    step,
    counts() {
      return {
        dwarves: alive().length,
        soldiers: alive().filter((d) => d.job === 'soldier').length,
        rooms: world.rooms.filter((x) => x.dug).length,
        deeps: world.levels.length - 1,
        foes: world.foes.filter((f) => f.alive && f.active && f.kind !== 'trader' && f.kind !== 'mule').length,
        water: Math.round(sum(water)),
        magma: Math.round(sum(magma)),
        wealth: world.wealth(),
        artifacts: world.artifacts.length,
        sleeper: world.sleeper ? ['sleep', 'stir', 'rise', 'batter', 'return', 'dead'].indexOf(world.sleeper.state) : -1,
      };
    },
  };
  const sum = (a: Float32Array) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i];
    return s;
  };
  const alive = () => world.dwarves.filter((d) => d.alive);
  const at = (c: number, rr: number) => rr * cols + c;
  const inb = (c: number, rr: number) => c >= 0 && c < cols && rr >= 0 && rr < rows;
  const setMat = (i: number, m: number) => {
    if (mat[i] === m) return;
    mat[i] = m;
    world.dirty.push(i);
    // Anything opened in the shaft is climbable.
    const c = i % cols;
    if (m === M.OPEN && (c === world.shaftC || c === world.shaftC + 1) && i >= (world.gate.floor - 2) * cols) ladder[i] = 1;
  };

  // ---- telling ---------------------------------------------------------------------------------

  const say = (text: string, x: number, y: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 5)) return;
    world.labels.push({ text, x, y, color, t0: world.t, dur: 5.5 });
    if (world.labels.length > 8) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, color, priority });
  };
  const emit = (type: string, x: number, y: number, weight: number) => bus.emit({ type, x, y, weight });
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 6) world.chronicle.shift();
  };
  const T = titled;
  const PRIORITY: Record<string, number> = { overview: 0, life: 1, work: 2, surface: 2, caravan: 2, strike: 3, room: 3, feast: 3, deeper: 3, mood: 4, below: 2, cavern: 5, ruin: 5, goblins: 5, stir: 5, flood: 6, magma: 6, cavein: 6, firedamp: 6, fight: 6, artifact: 6, sleeper: 8, fall: 9 };
  const look = (why: string, x: number, y: number, zoom: number, dur: number) => {
    const f = world.focus;
    if (world.t < f.until && (PRIORITY[f.why] ?? 0) > (PRIORITY[why] ?? 0)) return;
    world.focus = { x, y, zoom, until: world.t + dur, why };
  };
  const said = new Set<string>();
  const once = (k: string) => (said.has(k) ? false : (said.add(k), true));
  /** Deferred bits of story, in sim time. */
  const pending: { at: number; fn: () => void }[] = [];
  const later = (s: number, fn: () => void) => pending.push({ at: world.t + s, fn });
  let nearSleeper = Infinity;
  const levelOf = (row: number) => Math.max(0, Math.round((row - world.gate.floor) / LEV));

  // ---- the mountain -------------------------------------------------------------------------------

  const shaftC = Math.round(cols * (0.5 + (r() - 0.5) * 0.1));
  const side: 1 | -1 = r() < 0.5 ? 1 : -1;
  const peakC = Math.round(shaftC - side * cols * (0.1 + r() * 0.12));
  const peakR = Math.round(rows * 0.025 + r() * 3);
  const baseR = Math.round((H * 0.52) / CELL);
  for (let c = 0; c < cols; c++) {
    const d = Math.abs(c - peakC) / (cols * 0.5);
    surface[c] = Math.round(peakR + (baseR - peakR) * Math.min(1, d * 1.2) ** 1.15 + Math.sin(c * 0.37 + peakC) * 1.2);
  }
  const eF = Math.round(rows * 0.17);
  // The gate: out along the gate side from the shaft, where the slope comes down to the gate's floor.
  let gc = shaftC;
  while (gc > 1 && gc < cols - 2 && surface[gc] < eF - 1) gc += side;
  // A flat dooryard before the gate, then the slope again, never steeper than a step.
  for (let k = 0; k < 8; k++) {
    const c = gc + side * k;
    if (c >= 0 && c < cols) surface[c] = eF + 1;
  }
  // Outward from the dooryard the road goes down the mountain a step at a time.
  for (let c = gc + side * 8; c >= 0 && c < cols; c += side) {
    const p = surface[c - side];
    if (Math.abs(surface[c] - p) > 1) surface[c] = p + Math.sign(surface[c] - p);
  }
  // The gate stands in the last column of rock.
  world.gate = { c: gc - side, floor: eF, open: true, hp: 120, hpMax: 120, side };
  world.shaftC = shaftC;

  for (let rr = 0; rr < rows; rr++) {
    const f = rr / rows;
    for (let c = 0; c < cols; c++) {
      const i = at(c, rr);
      const d = rr - surface[c];
      if (d < 0) mat[i] = M.SKY;
      else if (d < 3) mat[i] = mountain === 'frost' && f < 0.3 ? M.ICE : M.SOIL;
      else if (mountain === 'frost' && d < 7 && f < 0.3) mat[i] = M.ICE;
      else if (f < 0.4) mat[i] = M.STONE;
      else if (f < (mountain === 'ember' ? 0.52 : 0.62)) mat[i] = M.SLATE;
      else if (f < (mountain === 'ember' ? 0.66 : 0.82)) mat[i] = M.DEEP;
      else mat[i] = M.BASALT;
    }
  }
  const rockAt = (i: number) => mat[i] >= M.SOIL && mat[i] <= M.ICE;
  const area = (cols * rows) / 30000;
  /** A vein: a wandering line of ore through the rock. */
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
  const k = (base: number, ...mul: [Mountain, number][]) => Math.round(base * area * (mul.find(([m]) => m === mountain)?.[1] ?? 1));
  for (let i = 0; i < k(9, ['iron', 1.6]); i++) vein(M.COAL, 0.18, 0.6, 20 + r() * 30);
  for (let i = 0; i < k(9, ['iron', 2]); i++) vein(M.IRON, 0.22, 0.75, 18 + r() * 30);
  for (let i = 0; i < k(5, ['ember', 1.4]); i++) vein(M.GOLD, 0.4, 0.85, 14 + r() * 24);
  for (let i = 0; i < k(4, ['crystal', 2.6]); i++) vein(M.GEM, 0.45, 0.95, 10 + r() * 20);
  vein(M.MITHRIL, 0.85, 0.95, 14);

  /** A blob of something, noisy at the edge. */
  const blob = (c0: number, r0: number, rx: number, ry: number, fn: (i: number, c: number, rr: number) => void) => {
    for (let rr = Math.floor(r0 - ry - 1); rr <= r0 + ry + 1; rr++) {
      for (let c = Math.floor(c0 - rx - 1); c <= c0 + rx + 1; c++) {
        if (!inb(c, rr)) continue;
        const u = (c - c0) / rx;
        const v = (rr - r0) / ry;
        const edge = 1 + Math.sin(c * 0.9 + rr * 1.3 + c0) * 0.12 + Math.sin(c * 0.31 - rr * 0.7) * 0.1;
        if (u * u + v * v <= edge) fn(at(c, rr), c, rr);
      }
    }
  };
  // Keep the first deeps clear of surprises.
  const safe = (c: number, rr: number, pad: number) => Math.abs(c - shaftC) < 24 + pad && rr < eF + LEV * 2 + 5 + pad;
  const place = (f0: number, f1: number, rx: number, ry: number) => {
    for (let tries = 0; tries < 30; tries++) {
      const c = 4 + rx + r() * (cols - 8 - rx * 2);
      const rr = rows * (f0 + r() * (f1 - f0));
      if (safe(c, rr, rx) || rr - ry < surface[Math.round(c)] + 6) continue;
      return [c, rr] as [number, number];
    }
    return null;
  };
  for (let n = 0; n < Math.round(k(4, ['drowned', 2.5], ['frost', 0.6]) * hz); n++) {
    const p = place(0.22, 0.75, 6, 3);
    if (p) blob(p[0], p[1], 3 + r() * 6, 2 + r() * 2.5, (i) => rockAt(i) && (mat[i] = M.AQUIFER));
  }
  for (let n = 0; n < Math.round(k(2, ['ember', 2.2]) * hz); n++) {
    const p = place(0.55, 0.9, 5, 3);
    if (p) blob(p[0], p[1], 3 + r() * 4, 2 + r() * 2, (i) => mat[i] >= M.SOIL && mat[i] !== M.SKY && (mat[i] = M.MAGMA));
  }
  // Caverns: wide hollows of fungus, with things living in them; in the drowned mountain, a lake.
  const cavern = (kind: Cavern['kind'], f0: number, f1: number, rx: number, ry: number, name: string) => {
    const p = place(f0, f1, rx, ry);
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
  const caveNames = ['THE GLOWING DARK', 'THE FUNGUS WOOD', 'THE WEEPING HOLLOW', 'THE LONG DARK', 'THE SPORE GARDENS', 'THE ECHOING VAULT'];
  for (let n = 0; n < Math.max(1, Math.round((2 + r() * 1.5) * Math.min(1.5, 0.5 + hz * 0.5))); n++) cavern('cavern', 0.38, 0.85, 12 + r() * 10, 4 + r() * 3, caveNames[n % caveNames.length]);
  if (mountain === 'drowned') cavern('lake', 0.4, 0.7, 16, 5, 'THE BLACK LAKE');
  // The halls of an older people: worked stone walls round a hall.
  const ruin = (() => {
    const p = place(0.33, 0.6, 12, 4);
    if (!p) return null;
    const cv: Cavern = { id: world.caverns.length, c: p[0], r: p[1], known: false, kind: 'ruin', clearAt: -1, claimed: false, name: `THE HALLS OF ${pick(N1)}${pick(N2)} THE ELDER` };
    world.caverns.push(cv);
    const w = 9 + Math.floor(r() * 4);
    for (let rr = Math.round(p[1]) - 4; rr <= Math.round(p[1]) + 2; rr++) {
      for (let c = Math.round(p[0]) - w; c <= Math.round(p[0]) + w; c++) {
        if (!inb(c, rr)) continue;
        const i = at(c, rr);
        const wall = rr === Math.round(p[1]) - 4 || rr === Math.round(p[1]) + 2 || Math.abs(c - p[0]) >= w - 0.5;
        mat[i] = wall ? M.RUIN : M.CAVE;
        if (!wall) caveAt[i] = cv.id;
      }
    }
    return cv;
  })();
  // Something to find early: gold a deep or two down, and water that should have been left alone.
  vein(M.GOLD, 0, 0, 14, [shaftC + (r() < 0.5 ? -1 : 1) * (10 + r() * 14), eF + LEV * 3 - 3]);
  if (hz > 0) blob(shaftC + (r() < 0.5 ? -1 : 1) * (16 + r() * 12), eF + LEV * 3 + 6, 4 + r() * 3, 2.2, (i) => rockAt(i) && (mat[i] = M.AQUIFER));
  // The magma sea at the mountain's roots.
  for (let rr = rows - 4; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    mat[at(c, rr)] = M.OPEN;
    magma[at(c, rr)] = 1;
  }
  // What sleeps below: a chamber some deeps down, with mithril near it.
  const sleeperRow = eF + LEV * (6 + Math.floor(r() * 4)) + 4;
  const sleeperC = shaftC + (r() < 0.5 ? -1 : 1) * (14 + r() * 18);
  if (opts.sleeper) {
    const cv: Cavern = { id: world.caverns.length, c: sleeperC, r: sleeperRow, known: false, kind: 'lair', clearAt: -1, claimed: false, name: 'THE DEEP CHAMBER' };
    world.caverns.push(cv);
    blob(sleeperC, sleeperRow, 9, 5, (i) => {
      mat[i] = M.CAVE;
      caveAt[i] = cv.id;
    });
    for (let n = 0; n < 3; n++) vein(M.MITHRIL, 0, 0, 10 + r() * 8, [sleeperC + (r() - 0.5) * 30, sleeperRow - 8 - r() * 8]);
    const [sk, sn] = SLEEPERS[mountain];
    world.sleeper = { kind: sk, name: sn, x: sleeperC * CELL, y: (sleeperRow + 4) * CELL, hp: 240, hpMax: 240, state: 'sleep', t0: 0, way: [], anim: 0, facing: 1, home: [sleeperC * CELL, (sleeperRow + 4) * CELL], cd: 0, wounded: false, woke: 0 };
  }
  void ruin;

  // ---- walking ---------------------------------------------------------------------------------

  const gateCells = () => [at(world.gate.c, eF), at(world.gate.c, eF - 1), at(world.gate.c, eF - 2)];
  let gateShut = new Set<number>();
  const walkable = (i: number) => {
    if (i < 0 || i >= N || mat[i] > 2) return false;
    if (gateShut.has(i)) return false;
    // Deep water is swum, not walked: they keep out of it.
    if (water[i] > 0.7 && i >= cols && water[i - cols] > 0.5) return false;
    if (ladder[i]) return true;
    const b = i + cols;
    if (b >= N || mat[b] > 2 || ladder[b] === 1) return true;
    // A chimney one cell wide: they climb it, back to one wall and feet to the other.
    const c = i % cols;
    return c > 0 && c < cols - 1 && mat[i - 1] > 2 && mat[i + 1] > 2 && mat[i] !== M.SKY;
  };
  const prev = new Int32Array(N);
  const seen = new Uint32Array(N);
  const queue = new Int32Array(N);
  let stamp = 1;
  let budget = 0;
  /** Breadth-first over the walkable cells, from a cell to the first that passes `goal`. */
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
      // Steps: up one if there is headroom, down one.
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
  /** Step along the route; true when there. Falls if the floor is gone. */
  function walk(a: Walker, speed: number, dt: number): boolean {
    if (a.ri >= a.route.length) {
      // Standing: on a floor, or falling to one; or shoved into the rock (a cave-in), up and out.
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
    const sp = speed * (ladder[i] && Math.abs(dy) > 1 ? 0.6 : 1) * (water[i] > 0.4 ? 0.55 : 1);
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
    a.anim += dt * 6;
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

  // ---- digging -----------------------------------------------------------------------------------

  type Dig = { id: number; cells: Set<number>; purpose: 'room' | 'shaft' | 'gallery' | 'vein' | 'rescue'; room?: Room; level?: number; claimed: Map<number, number>; t0: number; last: number; skip: Map<number, number> };
  const digs: Dig[] = [];
  const newDig = (purpose: Dig['purpose'], cells: number[], extra: Partial<Dig> = {}) => {
    const d: Dig = { id: ids++, cells: new Set(cells.filter((i) => !isOpen(mat[i]))), purpose, claimed: new Map(), t0: world.t, last: world.t, skip: new Map(), ...extra };
    if (d.cells.size) digs.push(d);
    return d;
  };
  const frontier = (i: number) => {
    const c = i % cols;
    return (c > 0 && isOpen(mat[i - 1]) && mat[i - 1] !== M.SKY) || (c < cols - 1 && isOpen(mat[i + 1]) && mat[i + 1] !== M.SKY) || (i - cols >= 0 && isOpen(mat[i - cols]) && mat[i - cols] !== M.SKY) || (i + cols < N && isOpen(mat[i + cols]));
  };
  /** Can a dwarf standing at s reach cell t with a pick? */
  const canDigFrom = (s: number, t: number) => {
    const sc = s % cols;
    const tc = t % cols;
    const sr = Math.floor(s / cols);
    const tr = Math.floor(t / cols);
    if (Math.abs(sc - tc) > 1) return false;
    const dy = tr - sr;
    if (dy > 1 || dy < -6) return false;
    if (dy >= -1) return true;
    for (let rr = tr + 1; rr < sr; rr++) if (!isOpen(mat[at(tc, rr)])) return false;
    return true;
  };

  function digCell(i: number, by: Dwarf | null) {
    const m = mat[i];
    const c = i % cols;
    const rr = Math.floor(i / cols);
    setMat(i, M.OPEN);
    if (c === shaftC || c === shaftC + 1) {
      if (rr >= eF - 2) ladder[i] = 1;
    }
    if (rr > world.deepest) {
      world.deepest = rr;
      world.deepestCol = c;
    }
    if (world.sleeper) nearSleeper = Math.min(nearSleeper, Math.hypot((c - world.sleeper.x / CELL) * 0.6, rr - world.sleeper.y / CELL));
    if (r() < 0.5) world.fx.push({ kind: 'dust', x: world.cellX(i), y: world.cellY(i) - CELL / 2, t0: world.t, dur: 1.2, r: CELL * 0.6, seed: ids++ });
    const ore = ORE[m];
    if (ore) {
      world.loads.push({ id: ids++, kind: ore, cell: by ? cellOf(by) : i, taken: false, skip: 0 });
      const v = veinAt[i];
      if (v >= 0 && once(`vein-${v}`)) strike(ore, i);
      if (ore === 'coal' && rr > rows * 0.35 && r() < 0.05 * hz) firedamp(i);
    }
    // What is on the other side.
    for (const j of [i - 1, i + 1, i - cols, i + cols]) {
      if (j < 0 || j >= N) continue;
      if (mat[j] === M.AQUIFER) breachWater(j);
      else if (mat[j] === M.MAGMA) breachMagma(j);
      else if (caveAt[j] >= 0 && !world.caverns[caveAt[j]].known) breachCave(world.caverns[caveAt[j]], j);
    }
  }
  const digNow = (cells: number[]) => {
    for (const i of cells) {
      if (isOpen(mat[i])) continue;
      mat[i] = M.OPEN;
      const c = i % cols;
      if ((c === shaftC || c === shaftC + 1) && Math.floor(i / cols) >= eF - 2) ladder[i] = 1;
      world.dirty.push(i);
    }
  };

  function strike(ore: Load['kind'], i: number) {
    const lv = deepName(levelOf(Math.floor(i / cols)));
    const x = world.cellX(i);
    const y = world.cellY(i);
    world.fx.push({ kind: 'glint', x, y: y - CELL / 2, t0: world.t, dur: 2.5, r: CELL * 2, seed: i, color: ore === 'gold' ? '#facc15' : ore === 'gem' ? '#c084fc' : ore === 'mithril' ? '#e0f2fe' : ore === 'iron' ? '#f97316' : '#94a3b8' });
    if (ore === 'mithril') {
      say(`MITHRIL! ON ${lv}`, x, y, '#e0f2fe', 'high');
      emit('mithril', x, y, 0.8);
      chronicle(`Mithril was struck on ${T(lv)}. They dug for more.`);
      look('strike', x, y, 1.5, 7);
      greed += 1.5;
    } else if (ore === 'gem') {
      say(`GEMS ON ${lv}`, x, y, '#d8b4fe', 'medium');
      emit('gems', x, y, 0.5);
      look('strike', x, y, 1.4, 5);
    } else if (ore === 'gold') {
      say(`A VEIN OF GOLD ON ${lv}`, x, y, '#fde68a', 'medium');
      emit('gold', x, y, 0.5);
      look('strike', x, y, 1.4, 5);
      greed += 0.3;
    } else {
      say(`${ore === 'iron' ? 'IRON' : 'COAL'} ON ${lv}`, x, y, '#e7dcc4', 'low');
      emit('strike', x, y, 0.25);
    }
  }

  // ---- hazards -----------------------------------------------------------------------------------

  const flood = (i: number, from: number, fn: (j: number) => void, limit = 900) => {
    const q = [i];
    const seenB = new Set([i]);
    while (q.length && seenB.size < limit) {
      const j = q.pop()!;
      fn(j);
      for (const n of [j - 1, j + 1, j - cols, j + cols]) if (n >= 0 && n < N && !seenB.has(n) && mat[n] === from) {
        seenB.add(n);
        q.push(n);
      }
    }
    return seenB.size;
  };
  let floodedLevel = -1;
  let magmaLevel = -1;
  function breachWater(i: number) {
    const n = flood(i, M.AQUIFER, (j) => {
      setMat(j, M.OPEN);
      water[j] = 1;
    });
    fluidBox(i, 20);
    const lv = levelOf(Math.floor(i / cols));
    floodedLevel = lv;
    const x = world.cellX(i);
    const y = world.cellY(i);
    say(`WATER BREAKS IN ON ${deepName(lv)}`, x, y, '#7dd3fc', 'high');
    emit('flood', x, y, 0.85);
    chronicle(`Water broke in on ${T(deepName(lv))}${n > 60 ? ', and the deep flooded' : ''}.`);
    look('flood', x, y, 1.3, 14);
    alarm(i, 30);
  }
  function breachMagma(i: number) {
    flood(i, M.MAGMA, (j) => {
      setMat(j, M.OPEN);
      magma[j] = 1;
    });
    fluidBox(i, 20);
    const lv = levelOf(Math.floor(i / cols));
    magmaLevel = lv;
    const x = world.cellX(i);
    const y = world.cellY(i);
    say(`MAGMA! ON ${deepName(lv)}`, x, y, '#fb923c', 'high');
    emit('magma', x, y, 0.9);
    chronicle(`They broke into magma on ${T(deepName(lv))}.`);
    look('magma', x, y, 1.35, 14);
    alarm(i, 30);
  }
  function breachCave(cv: Cavern, i: number) {
    cv.known = true;
    const x = world.cellX(i);
    const y = world.cellY(i);
    if (cv.kind === 'lair') {
      if (world.sleeper && world.sleeper.state === 'sleep') wake('THEY BROKE INTO ITS CHAMBER');
      return;
    }
    if (cv.kind === 'ruin') {
      world.stocks.treasure += 20;
      say(`${cv.name}!`, x, y, '#fde68a', 'high');
      emit('ruin', x, y, 0.75);
      chronicle(`The miners broke into ${T(cv.name)}, sealed since before the clan.`);
      look('ruin', cv.c * CELL, cv.r * CELL, 1.35, 12);
      if (r() < 0.45) {
        later(6, () => {
          const n = 4 + Math.floor(r() * 4);
          for (let k2 = 0; k2 < n; k2++) foe('skeleton', cv, true);
          say('THE DEAD WAKE IN THE OLD HALLS', cv.c * CELL, cv.r * CELL, '#bae6fd', 'high');
          emit('deadwake', cv.c * CELL, cv.r * CELL, 0.8);
          chronicle(`The dead of ${T(cv.name)} rose against the clan.`);
          look('fight', cv.c * CELL, cv.r * CELL, 1.4, 10);
          alarm(at(Math.round(cv.c), Math.round(cv.r)), 60);
        });
      }
      return;
    }
    say(cv.kind === 'lake' ? 'THE MINERS BREAK THROUGH TO A BLACK LAKE' : `THE MINERS BREAK INTO ${cv.name}`, x, y, '#a5f3fc', 'high');
    emit('cavern', x, y, 0.7);
    chronicle(`The miners broke into ${T(cv.name)}.`);
    look('cavern', cv.c * CELL, cv.r * CELL, 0.95, 10);
    fluidBox(i, 40);
    for (const f of world.foes) if (f.home === cv.id) f.active = true;
    if (world.foes.some((f) => f.home === cv.id && f.alive)) {
      later(5, () => {
        say('THINGS COME UP OUT OF THE DARK', x, y, '#fca5a5', 'high');
        emit('creatures', x, y, 0.7);
        alarm(i, 50);
      });
    }
    cv.clearAt = -1;
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
    chronicle(`Firedamp went up in a coal seam on ${T(deepName(levelOf(Math.floor(i / cols))))}.`);
    look('firedamp', x, y, 1.45, 8);
    for (const j of [i - 2, i + 2, i - cols * 2, i + cols * 2]) if (j >= 0 && j < N && mat[j] === M.AQUIFER) breachWater(j);
    quake(0.6);
  }

  /** A room's ceiling comes down: the rock above falls in and fills the floor. */
  function caveIn(room: Room, why: string) {
    const w = 4 + Math.floor(r() * 4);
    const a = room.c0 + Math.floor(r() * Math.max(1, room.c1 - room.c0 - w));
    const b = Math.min(room.c1, a + w);
    const k2 = 2 + Math.floor(r() * 2);
    for (let c = a; c <= b; c++) {
      for (let dr = 1; dr <= k2; dr++) {
        const j = at(c, room.top - dr);
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
    for (let n = 0; n < 14; n++) world.fx.push({ kind: 'rubble', x: (a + r() * (b - a)) * CELL, y: (room.top - k2) * CELL, y1: y, t0: world.t + r() * 0.6, dur: 1, r: CELL * 0.5, seed: ids++ });
    world.fx.push({ kind: 'dust', x, y: y - CELL * 2, t0: world.t, dur: 3, r: CELL * 5, seed: ids++ });
    for (const d of alive()) {
      if (!isOpen(mat[cellOf(d)])) {
        if (r() < 0.55) die(d, 'the cave-in');
        else {
          d.y -= k2 * CELL;
          d.route = [];
        }
      }
    }
    room.dug = false;
    room.pillars = false;
    const rescue: number[] = [];
    for (let c = a; c <= b; c++) for (let dr = 0; dr < k2; dr++) rescue.push(at(c, room.floor - dr));
    newDig('rescue', rescue, { room });
    say(`CAVE-IN IN ${ROOM_NAMES[room.kind]}`, x, y, '#fca5a5', 'high');
    emit('cavein', x, y, 0.85);
    chronicle(`${why}: the roof of ${T(ROOM_NAMES[room.kind].toLowerCase())} on ${T(deepName(room.level))} came down.`);
    look('cavein', x, y - CELL * 2, 1.45, 9);
    caveIns++;
    quake(0.5);
  }
  let caveIns = 0;
  const quake = (k2: number) => (world.quake = Math.max(world.quake, k2));

  // ---- fluids --------------------------------------------------------------------------------------

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
  let fluidAcc = 0;
  let tick = 0;
  /** One cell's fluid: down if it can, then out to the sides. */
  function flow(arr: Float32Array, other: Float32Array, rate: number, i: number, c: number, flip: number): boolean {
    let v = arr[i];
    if (!isOpen(mat[i])) {
      arr[i] = 0;
      return false;
    }
    // Out the gate and away down the mountain.
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
  function fluids(dt: number) {    fluidAcc += dt;
    while (fluidAcc >= 0.1) {
      fluidAcc -= 0.1;
      tick++;
      if (box.c1 < box.c0) return;
      const flip = tick & 1;
      let any = false;
      for (let rr = box.r1; rr >= box.r0; rr--) {
        for (let n = box.c0; n <= box.c1; n++) {
          const c = flip ? n : box.c1 - (n - box.c0);
          const i = at(c, rr);
          if (water[i] >= 0.003 && flow(water, magma, 1, i, c, flip)) any = true;
          if (magma[i] >= 0.003 && flow(magma, water, 0.3, i, c, flip)) any = true;
          // Water on magma: steam, and the magma turns to stone.
          if (water[i] > 0.05 && (magma[i] > 0.05 || (rr === rows - 5 && magma[i + cols] > 0.5)) && rr < rows - 4) {
            setMat(i, M.OBSIDIAN);
            water[i] = magma[i] = 0;
            if (r() < 0.3) world.fx.push({ kind: 'steam', x: c * CELL + CELL / 2, y: rr * CELL, t0: world.t, dur: 2.5, r: CELL * 2, seed: ids++ });
            if (once(`steam-${Math.floor(world.t / 30)}`)) {
              say('STEAM AND STONE WHERE WATER MEETS MAGMA', c * CELL, rr * CELL, '#e2e8f0', 'medium');
              emit('steam', c * CELL, rr * CELL, 0.5);
            }
          }
          // Magma at rest cools, slowly, to obsidian.
          if (magma[i] > 0.3 && rr < rows - 4 && r() < 0.0006) {
            setMat(i, M.OBSIDIAN);
            magma[i] = 0;
          }
          // Water seeps away into the rock, slowly; puddles dry.
          if (water[i] > 0 && world.caveAt[i] < 0) water[i] = Math.max(0, water[i] - (water[i] < 0.06 ? 0.002 : 0.0005));
        }
      }
      // Pumps drain their deep.
      // Pumps drain everything below them, down the shaft and out along the deeps.
      for (const p of world.rooms) if (p.kind === 'pump' && p.furnished && !p.ruined) {
        for (let rr = Math.max(box.r0, p.top); rr <= box.r1; rr++) for (let c = Math.max(box.c0, shaftC - 40); c <= Math.min(box.c1, shaftC + 40); c++) {
          const i = at(c, rr);
          if (water[i] > 0 && world.caveAt[i] < 0) water[i] = Math.max(0, water[i] - 0.012);
        }
      }
      if (tick % 20 === 0) {
        // Shrink the box to what is still wet (the magma sea is not in it).
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

  // ---- the hold's plan ------------------------------------------------------------------------------

  function openLevel(k2: number, instant = false) {
    const floor = eF + k2 * LEV;
    if (floor > rows - 8) return null;
    const reach = k2 <= 2 ? 3 : 7 + Math.floor(r() * 6);
    const lv: Level = { k: k2, floor, left: shaftC - reach, right: shaftC + 1 + reach, sealed: false };
    world.levels[k2] = lv;
    const cells: number[] = [];
    const prevFloor = k2 === 0 ? eF - 3 : world.levels[k2 - 1].floor;
    for (let rr = prevFloor + 1; rr <= floor; rr++) for (const c of [shaftC, shaftC + 1]) {
      const i = at(c, rr);
      cells.push(i);
      // Where the shaft passes through a cavern, ladders are hung down it.
      if (isOpen(mat[i]) && mat[i] !== M.SKY) ladder[i] = 1;
    }
    for (let c = lv.left; c <= lv.right; c++) for (let rr = floor - 2; rr <= floor; rr++) cells.push(at(c, rr));
    if (instant) digNow(cells);
    else newDig('shaft', cells, { level: k2 });
    return lv;
  }

  /** Lay out a room on a deep: the gallery out to it, and the room itself. */
  function placeRoom(kind: RoomKind, want?: number, instant = false): Room | null {
    const [w, h] = ROOM_SIZE[kind];
    // Workshops go deep; the clan lives near the top.
    const deepFirst = kind === 'forge' || kind === 'magmaforge' || kind === 'barracks' || kind === 'treasury' || kind === 'tomb' || kind === 'library';
    const open = world.levels.filter((l) => l && !l.sealed && l.k > 0 && isOpen(mat[at(shaftC, l.floor)])).map((l) => l.k);
    const order = want != null ? [want] : deepFirst ? open.reverse() : open;
    for (const k2 of order) {
      const lv = world.levels[k2];
      if (!lv || lv.sealed) continue;
      for (let off = 3; off < cols * 0.42; off += 2) {
        for (const s of r() < 0.5 ? [-1, 1] : [1, -1]) {
          const c0 = s < 0 ? shaftC - off - w : shaftC + 2 + off;
          const c1 = c0 + w - 1;
          if (c0 < 3 || c1 > cols - 4) continue;
          if (world.rooms.some((o) => o.level === k2 && c0 <= o.c1 + 2 && c1 >= o.c0 - 2)) continue;
          const top = lv.floor - h + 1;
          let ok = true;
          for (let rr = top - 2; rr <= lv.floor + 1 && ok; rr++) for (let c = c0 - 1; c <= c1 + 1 && ok; c++) {
            const m = mat[at(c, rr)];
            if (m === M.SKY || m === M.RUIN || caveAt[at(c, rr)] >= 0) ok = false;
          }
          if (!ok) continue;
          const room: Room = { id: world.rooms.length, kind, level: k2, c0, c1, top, floor: lv.floor, dug: false, furnished: false, pillars: false, ruined: false, work: 0 };
          world.rooms.push(room);
          const cells: number[] = [];
          // The gallery from where it ends now out to the room.
          if (s < 0) for (let c = c1 + 1; c < lv.left; c++) for (let rr = lv.floor - 2; rr <= lv.floor; rr++) cells.push(at(c, rr));
          else for (let c = lv.right + 1; c < c0; c++) for (let rr = lv.floor - 2; rr <= lv.floor; rr++) cells.push(at(c, rr));
          for (let rr = lv.floor; rr >= top; rr--) for (let c = c0; c <= c1; c++) {
            cells.push(at(c, rr));
            roomAt[at(c, rr)] = room.id;
          }
          lv.left = Math.min(lv.left, c0);
          lv.right = Math.max(lv.right, c1);
          if (instant) {
            digNow(cells);
            room.dug = room.furnished = true;
          } else newDig('room', cells, { room, level: k2 });
          return room;
        }
      }
    }
    return null;
  }
  const has = (kind: RoomKind) => world.rooms.some((x) => x.kind === kind);
  const ready = (kind: RoomKind) => world.rooms.filter((x) => x.kind === kind && x.dug && x.furnished && !x.ruined);

  let greed = 0.5 * opts.depth;
  let nextDeepen = 60 / Math.max(0.3, opts.depth);
  let attacked = false;
  function plan() {
    if (world.fallen) return;
    const pop = alive().length;
    const rooming = digs.filter((d) => d.purpose === 'room' || d.purpose === 'shaft').length;
    const want: RoomKind[] = [];
    if (!has('store')) want.push('store');
    if (world.rooms.filter((x) => x.kind === 'dorm').length * 6 < pop + 1) want.push('dorm');
    if (!has('farm') || (world.stocks.food < pop * 2 && world.rooms.filter((x) => x.kind === 'farm').length < 3)) want.push('farm');
    if (!has('brewery')) want.push('brewery');
    if (!has('forge')) want.push('forge');
    if (pop >= 10 && !has('hall')) want.push('hall');
    if (pop >= 13 && !has('temple')) want.push('temple');
    if (world.deaths >= 2 && !has('tomb')) want.push('tomb');
    if (attacked && !has('barracks')) want.push('barracks');
    if (world.wealth() > 1500 && !has('treasury')) want.push('treasury');
    if (floodedLevel > 0 && !world.rooms.some((x) => x.kind === 'pump' && x.level === Math.max(1, floodedLevel - 1))) want.unshift('pump');
    if (magmaLevel > 0 && has('forge') && !has('magmaforge')) want.push('magmaforge');
    if (pop >= 16 && !has('library')) want.push('library');
    if (rooming < 2 && want.length) {
      const kind = want[0];
      const room = placeRoom(kind, kind === 'pump' ? Math.max(1, floodedLevel - 1) : kind === 'magmaforge' ? magmaLevel : undefined);
      if (room) {
        const x = ((room.c0 + room.c1) / 2) * CELL;
        say(`THE OVERSEER LAYS OUT ${ROOM_NAMES[kind]}`, x, room.floor * CELL - CELL * 3, '#e7dcc4', 'low');
        emit('layout', x, room.floor * CELL, 0.2);
      } else if (kind !== 'pump' && kind !== 'magmaforge') nextDeepen = Math.min(nextDeepen, world.t + 5);
      else if (kind === 'pump') floodedLevel = -1;
      else magmaLevel = -1;
    }
    // Years after a sealing, greed breaks the seal again.
    if (sealedAt > 0 && world.t - sealedAt > 900 && greed > 0.8 && sealLevel >= 0) {
      const lv = world.levels[sealLevel];
      const cells: number[] = [];
      for (const c of [shaftC, shaftC + 1]) for (let dr = 1; dr <= 3; dr++) cells.push(at(c, lv.floor + dr));
      newDig('shaft', cells, { level: sealLevel + 1 });
      for (const l of world.levels) if (l) l.sealed = false;
      sealedAt = 0;
      sealHp = 0;
      sealLevel = -1;
      nextStirCheck = world.t + 60;
      say('THE CLAN BREAKS THE OLD SEAL', shaftC * CELL, lv.floor * CELL, '#fca5a5', 'high');
      emit('unseal', shaftC * CELL, lv.floor * CELL, 0.7);
      chronicle(`Greedy for what lay below, the ${T(world.clan)} clan broke the old seal.`);
      look('deeper', shaftC * CELL, lv.floor * CELL, 1.3, 8);
    }
    // Deeper: when there is no room left, or for greed, or for the ore below.
    const deepest = world.levels.length - 1;
    const sealedBelow = world.levels.some((l) => l.sealed);
    const reached = isOpen(mat[at(shaftC, world.levels[deepest].floor)]);
    if (!reached && world.t >= nextDeepen && !digs.some((d) => d.purpose === 'shaft')) {
      // The way down was given up half dug (a flood, a fall): take it up again.
      const lv = world.levels[deepest];
      const cells: number[] = [];
      for (let rr = world.levels[deepest - 1].floor + 1; rr <= lv.floor; rr++) for (const c of [shaftC, shaftC + 1]) cells.push(at(c, rr));
      for (let c = lv.left; c <= lv.right; c++) for (let rr = lv.floor - 2; rr <= lv.floor; rr++) if (roomAt[at(c, rr)] < 0) cells.push(at(c, rr));
      newDig('shaft', cells, { level: deepest });
      nextDeepen = world.t + 60;
    }
    if (world.t >= nextDeepen && reached && !digs.some((d) => d.purpose === 'shaft') && !sealedBelow && deepest < 4 + Math.round(18 * opts.depth)) {
      const lv = openLevel(deepest + 1);
      nextDeepen = world.t + (85 + r() * 60) / Math.max(0.3, opts.depth + greed * 0.4);
      if (lv) {
        say(`THE SHAFT GOES DOWN TO ${deepName(lv.k)}`, shaftC * CELL, lv.floor * CELL, '#e7dcc4', 'medium');
        emit('deeper', shaftC * CELL, lv.floor * CELL, 0.4);
        look('deeper', shaftC * CELL, lv.floor * CELL, 1.25, 8);
        if (lv.k >= 5 && once(`deep-chron-${lv.k}`)) chronicle(`The clan dug down to ${T(deepName(lv.k))}.`);
      }
    }
    // Veins: follow the best ore within reach of a gallery.
    if (digs.filter((d) => d.purpose === 'vein').length < 1 + (pop > 14 ? 1 : 0)) {
      const v = prospect();
      if (v) newDig('vein', v, {});
    }
  }

  /** The best ore near a gallery, and the tunnel to it and along it. */
  function prospect(): number[] | null {
    let best = -1;
    let score = 0;
    let from = -1;
    const value: Record<number, number> = { 9: 2, 10: 1.6, 11: 3, 12: 4, 13: 7 };
    for (const lv of world.levels) {
      if (!lv || lv.sealed || lv.k === 0) continue;
      for (let c = Math.max(2, lv.left - 14); c <= Math.min(cols - 3, lv.right + 14); c += 1) {
        for (let rr = lv.floor - 9; rr <= lv.floor + 6; rr++) {
          if (!inb(c, rr)) continue;
          const i = at(c, rr);
          const v = value[mat[i]];
          if (!v || claimedOre.has(veinAt[i])) continue;
          const gx = Math.max(lv.left, Math.min(lv.right, c));
          const dist = Math.abs(c - gx) + Math.abs(rr - lv.floor);
          const s = (v * (1 + greed * 0.3)) / (4 + dist);
          if (s > score) {
            score = s;
            best = i;
            from = at(gx, lv.floor);
          }
        }
      }
    }
    if (best < 0) return null;
    claimedOre.add(veinAt[best]);
    const cells: number[] = [];
    // A stepped tunnel, two high, from the gallery to the ore.
    let c = from % cols;
    let rr = Math.floor(from / cols);
    const tc = best % cols;
    const tr = Math.floor(best / cols);
    let wig = 0;
    while (c !== tc || rr !== tr) {
      // Never straight down or up: always a step across with it, so it can be walked.
      if (rr !== tr) {
        rr += Math.sign(tr - rr);
        c += c !== tc ? Math.sign(tc - c) : wig++ % 2 ? 1 : -1;
      } else c += Math.sign(tc - c);
      cells.push(at(c, rr), at(c, rr - 1));
    }
    // And along the vein.
    const v = veinAt[best];
    flood(best, mat[best], (j) => veinAt[j] === v && cells.push(j), 60);
    return cells.filter((j) => j >= 0 && j < N && mat[j] !== M.SKY);
  }
  const claimedOre = new Set<number>();

  // ---- the people -------------------------------------------------------------------------------

  function dwarf(job: Job, x: number, y: number, outside = false): Dwarf {
    let name = dwarfName();
    for (let k2 = 0; k2 < 6 && world.dwarves.some((o) => o.alive && o.name === name); k2++) name = dwarfName();
    const d: Dwarf = { id: ids++, name, job, x, y, at: cellOf({ x, y }), route: [], ri: 0, task: null, hp: job === 'soldier' ? 20 : 10, alive: true, deadAt: -1, anim: r() * 4, facing: r() < 0.5 ? 1 : -1, beard: Math.floor(r() * 6), variant: Math.floor(r() * 4), fails: 0, age: 30 + Math.floor(r() * 120), carry: null, swingUntil: -1, drown: 0, cd: 0, repath: 0, outside, crossbow: job === 'soldier' && r() < 0.4, mad: false };
    world.dwarves.push(d);
    return d;
  }
  function die(d: Dwarf, how: string) {
    if (!d.alive) return;
    d.alive = false;
    d.deadAt = world.t;
    world.deaths++;
    if (d.carry) d.carry.taken = false;
    if (world.king === d) {
      world.king = null;
      later(4, () => crown(`${T(d.name)} the king died, by ${how}`));
    }
    if (d.task?.kind === 'dig') for (const g of digs) g.claimed.delete(d.task.cell ?? -1);
  }
  function crown(why: string) {
    const heirs = alive().filter((d) => !d.mad).sort((a, b) => b.age - a.age);
    const h = heirs[0];
    if (!h) return;
    world.king = h;
    h.job = 'king';
    world.reign++;
    const x = h.x;
    const y = h.y;
    say(`LONG LIVE KING ${h.name}`, x, y - CELL * 2, '#fde68a', 'high');
    emit('crowned', x, y, 0.6);
    chronicle(`${why}. ${T(h.name)} was crowned king of ${T(world.name)}.`);
    look('feast', x, y, 1.3, 7);
  }

  function foe(kind: FoeKind, cv: Cavern | null, active: boolean, x?: number, y?: number): Foe | null {
    let px = x ?? 0;
    let py = y ?? 0;
    if (cv) {
      // Somewhere on the cavern floor.
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
    const hp = { goblin: 7, spider: 9, troll: 30, skeleton: 8, crawler: 12, trader: 10, mule: 10 }[kind];
    const f: Foe = { id: ids++, kind, x: px, y: py, at: cellOf({ x: px, y: py }), route: [], ri: 0, hp, hpMax: hp, alive: true, deadAt: -1, anim: r() * 4, facing: 1, cd: 0, home: cv ? cv.id : -1, active, swingUntil: -1, repath: 0, lost: 0, task: 'wander' };
    world.foes.push(f);
    return f;
  }
  // Creatures in the caverns, asleep to the dwarves until they break in.
  for (const cv of world.caverns) {
    if (cv.kind !== 'cavern' && cv.kind !== 'lake') continue;
    const n = 3 + Math.floor(r() * 4 * Math.max(0.3, hz));
    const kinds: FoeKind[] = mountain === 'crystal' ? ['spider', 'spider', 'crawler'] : cv.r > rows * 0.65 ? ['troll', 'crawler', 'spider'] : ['crawler', 'spider', 'goblin'];
    for (let k2 = 0; k2 < n; k2++) foe(pick(kinds), cv, false);
  }

  /** Something is coming: the dwarves near it run for the upper deeps, the soldiers to it. */
  let alarmUntil = -1;
  function alarm(i: number, dur: number) {
    alarmUntil = Math.max(alarmUntil, world.t + dur);
    const y = world.cellY(i);
    for (const d of alive()) {
      if (d.job === 'soldier' || d.outside) continue;
      if (Math.abs(d.y - y) < CELL * 25 && d.task?.kind !== 'flee') {
        d.task = { kind: 'flee', t0: world.t };
        d.route = [];
      }
    }
    if (once('bell') || r() < 0.3) {
      say('THE ALARM BELL', world.gate.c * CELL, eF * CELL - CELL * 3, '#fde68a', 'medium');
      emit('bell', world.gate.c * CELL, eF * CELL, 0.4);
    }
  }

  // ---- the founding --------------------------------------------------------------------------------

  openLevel(0, true);
  // The gate tunnel, out to the dooryard.
  const tunnel: number[] = [];
  for (let c = Math.min(gc, shaftC); c <= Math.max(gc, shaftC + 1); c++) for (let rr = eF - 2; rr <= eF; rr++) tunnel.push(at(c, rr));
  digNow(tunnel);
  const entrance: Room = { id: 0, kind: 'entrance', level: 0, c0: Math.min(gc, shaftC) + (side > 0 ? 3 : 1), c1: Math.max(gc, shaftC + 1) - (side > 0 ? 1 : 3), top: eF - 5, floor: eF, dug: true, furnished: true, pillars: true, ruined: false, work: 0 };
  if (entrance.c1 - entrance.c0 > 16) side > 0 ? (entrance.c1 = entrance.c0 + 14) : (entrance.c0 = entrance.c1 - 14);
  world.rooms.push(entrance);
  const eCells: number[] = [];
  for (let rr = entrance.top; rr <= eF; rr++) for (let c = entrance.c0; c <= entrance.c1; c++) {
    const i = at(c, rr);
    if (mat[i] !== M.SKY) {
      eCells.push(i);
      roomAt[i] = 0;
    }
  }
  digNow(eCells);
  world.levels[0].left = Math.min(gc, shaftC);
  world.levels[0].right = Math.max(gc, shaftC + 1);
  openLevel(1, true);
  openLevel(2, true);
  placeRoom('store', 1, true);
  placeRoom('dorm', 1, true);
  placeRoom('farm', 2, true);
  placeRoom('brewery', 2, true);
  placeRoom('forge', 1, true);
  world.deepest = world.levels[2].floor;
  const mid = (shaftC + 1) * CELL;
  const jobs: Job[] = ['king', 'miner', 'miner', 'miner', 'miner', 'hauler', 'hauler', 'smith', 'brewer', 'farmer', 'mason', 'soldier', 'soldier', 'soldier'];
  for (const [n, j] of jobs.entries()) {
    const lv = world.levels[1 + (n % 2)];
    let c = lv.left + Math.floor(r() * (lv.right - lv.left + 1));
    for (let k2 = 0; k2 < 20 && !walkable(at(c, lv.floor)); k2++) c = lv.left + Math.floor(r() * (lv.right - lv.left + 1));
    const d = dwarf(j, world.cellX(at(c, lv.floor)), world.cellY(at(c, lv.floor)));
    if (j === 'king') {
      world.king = d;
      d.age = 180 + Math.floor(r() * 60);
    }
  }
  world.focus = { x: mid, y: world.levels[1].floor * CELL, zoom: 0.8, until: 0, why: 'overview' };
  chronicle(`The ${T(world.clan)} clan came to ${T(MOUNTAIN_NAMES[mountain].toLowerCase())} and founded ${T(world.name)}.`);

  // ---- the day's work ------------------------------------------------------------------------------

  /** The hold keeps shifts: each dwarf sleeps a stretch of the night, staggered. */
  const tired = (d: Dwarf) => (world.day - 0.8 + (d.id % 4) * 0.05 + 1) % 1 < 0.16;
  function laterRun() {
    for (let i = pending.length - 1; i >= 0; i--) if (world.t >= pending[i].at) {
      const f = pending[i].fn;
      pending.splice(i, 1);
      f();
    }
  }

  const roomGoal = (room: Room) => (i: number) => roomAt[i] === room.id && Math.floor(i / cols) === room.floor;
  const safeRoom = () => {
    const ds = ready('dorm').sort((a, b) => a.level - b.level);
    return ds[0] ?? ready('hall')[0] ?? entrance;
  };

  function think(d: Dwarf) {
    // Shut in somewhere nothing can reach (a pit, a pocket after a cave-in): they climb out.
    if (d.fails > 10) {
      d.fails = 0;
      const row = Math.floor(d.y / CELL);
      const lv = world.levels.filter((l) => l && !l.sealed).sort((a, b) => Math.abs(a.floor - row) - Math.abs(b.floor - row))[0];
      if (lv) {
        for (let k2 = 0; k2 < 30; k2++) {
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
    }
    // Night: to bed; the evening of a feast: to the hall.
    if (world.feast > world.t && ready('hall').length && d.job !== 'soldier') {
      const hall = ready('hall')[0];
      d.task = { kind: 'feast', room: hall, t0: world.t, until: world.feast };
      if (!go(d, roomGoal(hall))) d.task = null;
      return;
    }
    if (tired(d) && d.job !== 'soldier') {
      const dorm = ready('dorm')[d.id % Math.max(1, ready('dorm').length)] ?? entrance;
      d.task = { kind: 'sleep', room: dorm, t0: world.t };
      if (!go(d, roomGoal(dorm))) d.task = { kind: 'idle', t0: world.t, until: world.t + 4 };
      return;
    }
    if (d.mad) {
      d.task = { kind: 'leave', t0: world.t };
      if (!go(d, (i) => i % cols === (side > 0 ? cols - 1 : 0) || mat[i] === M.SKY && Math.abs((i % cols) - gc) > 10)) d.task = { kind: 'idle', t0: world.t, until: world.t + 3 };
      return;
    }
    switch (d.job) {
      case 'miner':
      case 'mason':
        if (d.job === 'mason' && masonWork(d)) return;
        if (takeDig(d)) return;
        if (takeHaul(d)) return;
        break;
      case 'hauler':
        if (takeHaul(d)) return;
        if (takeDig(d)) return;
        break;
      case 'smith': {
        const forge = ready('magmaforge')[0] ?? ready('forge')[0];
        if (forge && (world.stocks.iron >= 1 || world.stocks.gold >= 1 || world.stocks.gem >= 1)) return work(d, forge);
        if (takeHaul(d)) return;
        break;
      }
      case 'brewer': {
        const b = ready('brewery')[0];
        if (b) return work(d, b);
        break;
      }
      case 'farmer': {
        const f = ready('farm')[d.id % Math.max(1, ready('farm').length)];
        if (f) return work(d, f);
        break;
      }
      case 'soldier': {
        const b = ready('barracks')[0] ?? entrance;
        return work(d, b);
      }
      case 'king': {
        const h = ready('hall')[0] ?? ready('temple')[0] ?? entrance;
        return work(d, h);
      }
      default:
        break;
    }
    // Nothing to do: a wander in the hall or a room.
    const rooms = world.rooms.filter((x) => x.dug && !x.ruined);
    const room = rooms[Math.floor(r() * rooms.length)];
    d.task = { kind: 'idle', t0: world.t, until: world.t + 4 + r() * 6, room };
    if (room && budget > 0 && !go(d, roomGoal(room), 4000) && budget > 0) d.fails++;
  }
  function work(d: Dwarf, room: Room) {
    d.task = { kind: 'work', room, t0: world.t, until: world.t + 20 + r() * 20 };
    if (!go(d, (i) => roomAt[i] === room.id && Math.floor(i / cols) === room.floor && Math.abs((i % cols) - (room.c0 + ((d.id * 3) % (room.c1 - room.c0 + 1)))) < 2)) {
      if (!go(d, roomGoal(room))) d.task = { kind: 'idle', t0: world.t, until: world.t + 3 };
    }
  }
  function takeDig(d: Dwarf): boolean {
    const order: Dig['purpose'][] = ['rescue', 'shaft', 'room', 'gallery', 'vein'];
    const sorted = [...digs].sort((a, b) => order.indexOf(a.purpose) - order.indexOf(b.purpose));
    const dc = Math.floor(d.x / CELL);
    const dr = Math.floor(d.y / CELL);
    for (const g of sorted) {
      if (budget <= 0) return false;
      let best = -1;
      let bd = Infinity;
      for (const i of g.cells) {
        if (g.claimed.has(i) || (g.skip.get(i * 64 + (d.id & 63)) ?? 0) > world.t || !frontier(i)) continue;
        const dd = Math.abs((i % cols) - dc) + Math.abs(Math.floor(i / cols) - dr) * 1.5;
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      }
      if (best < 0) continue;
      if (go(d, (s) => canDigFrom(s, best))) {
        d.fails = 0;
        g.claimed.set(best, d.id);
        d.task = { kind: 'dig', cell: best, t0: world.t, stage: 0 };
        return true;
      }
      if (budget > 0) {
        g.skip.set(best * 64 + (d.id & 63), world.t + 12);
        d.fails++;
      }
    }
    return false;
  }
  function takeHaul(d: Dwarf): boolean {
    const store = ready('store')[0] ?? entrance;
    const loads = world.loads.filter((l) => !l.taken && l.skip < world.t);
    if (!loads.length || budget <= 0) return false;
    const dx = d.x;
    const dy = d.y;
    loads.sort((a, b) => Math.hypot(world.cellX(a.cell) - dx, world.cellY(a.cell) - dy) - Math.hypot(world.cellX(b.cell) - dx, world.cellY(b.cell) - dy));
    const l = loads[0];
    if (!go(d, (i) => Math.abs((i % cols) - (l.cell % cols)) <= 1 && Math.abs(Math.floor(i / cols) - Math.floor(l.cell / cols)) <= 1)) {
      if (budget > 0) l.skip = world.t + 15;
      return false;
    }
    l.taken = true;
    d.task = { kind: 'haul', load: l, room: store, t0: world.t, stage: 0 };
    return true;
  }
  /** Masons: furnish what is dug, prop wide rooms after a cave-in, mend the gate. */
  function masonWork(d: Dwarf): boolean {
    const room = world.rooms.find((x) => x.dug && (!x.furnished || x.ruined || (caveIns > 0 && !x.pillars && x.c1 - x.c0 >= 9)) && !world.dwarves.some((o) => o !== d && o.alive && o.task?.kind === 'furnish' && o.task.room === x));
    if (!room) return false;
    d.task = { kind: 'furnish', room, t0: world.t, stage: 0 };
    if (!go(d, roomGoal(room))) {
      d.task = null;
      return false;
    }
    return true;
  }

  function act(d: Dwarf, dt: number) {
    const task = d.task;
    if (!task) return think(d);
    const arrived = walk(d, d.job === 'soldier' ? 30 : d.carry ? 18 : 24, dt);
    switch (task.kind) {
      case 'dig': {
        const i = task.cell!;
        const g = digs.find((x) => x.cells.has(i));
        if (!g || isOpen(mat[i])) {
          g?.cells.delete(i);
          g?.claimed.delete(i);
          d.task = null;
          break;
        }
        if (!arrived) break;
        if (!canDigFrom(cellOf(d), i)) {
          g.claimed.delete(i);
          d.task = null;
          break;
        }
        d.facing = world.cellX(i) > d.x ? 1 : world.cellX(i) < d.x ? -1 : d.facing;
        d.swingUntil = world.t + 0.2;
        task.stage = (task.stage ?? 0) + dt;
        if (r() < dt * 3) world.fx.push({ kind: 'spark', x: world.cellX(i), y: world.cellY(i) - CELL / 2, t0: world.t, dur: 0.3, r: 2, seed: ids++, color: '#fde68a' });
        if (task.stage >= HARD[mat[i]] * (d.job === 'miner' ? 0.8 : 1.2)) {
          g.cells.delete(i);
          g.claimed.delete(i);
          g.last = world.t;
          digCell(i, d);
          d.task = null;
        }
        break;
      }
      case 'haul': {
        const l = task.load!;
        if (task.stage === 0) {
          if (!arrived) break;
          d.carry = l;
          world.loads = world.loads.filter((x) => x !== l);
          task.stage = 1;
          if (!go(d, roomGoal(task.room!))) {
            d.carry = null;
            l.cell = cellOf(d);
            l.taken = false;
            world.loads.push(l);
            d.task = null;
          }
          break;
        }
        if (!arrived) break;
        if (d.carry) world.stocks[d.carry.kind] += 1;
        d.carry = null;
        d.task = null;
        break;
      }
      case 'work': {
        if (!arrived) break;
        const room = task.room!;
        d.swingUntil = world.t + 0.2;
        if (room.kind === 'forge' || room.kind === 'magmaforge') {
          const sp = room.kind === 'magmaforge' ? 1.6 : 1;
          room.work += (dt / 14) * sp;
          if (r() < dt * 4) world.fx.push({ kind: 'spark', x: d.x + d.facing * CELL, y: d.y - CELL, t0: world.t, dur: 0.4, r: 3, seed: ids++, color: '#fbbf24' });
          if (room.work >= 1) {
            room.work = 0;
            const s = world.stocks;
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
            }
          }
        } else if (room.kind === 'brewery') {
          room.work += dt / 10;
          if (room.work >= 1) {
            room.work = 0;
            world.stocks.ale += 4;
          }
        } else if (room.kind === 'farm') {
          room.work += dt / 9;
          if (room.work >= 1) {
            room.work = 0;
            world.stocks.food += world.caverns.some((c) => c.claimed) ? 5 : 3;
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
        if (task.stage > 7) {
          const was = room.furnished;
          room.furnished = true;
          if (room.ruined) {
            room.ruined = false;
          } else if (caveIns > 0 && room.c1 - room.c0 >= 9 && was) room.pillars = true;
          if (!was) {
            const x = ((room.c0 + room.c1) / 2) * CELL;
            say(`${ROOM_NAMES[room.kind]} IS FINISHED`, x, room.top * CELL, '#bbf7d0', room.kind === 'hall' || room.kind === 'temple' ? 'medium' : 'low');
            emit('room', x, room.floor * CELL, room.kind === 'hall' ? 0.5 : 0.25);
            if (room.kind === 'hall' || room.kind === 'temple' || room.kind === 'magmaforge' || room.kind === 'library') {
              look('room', x, room.floor * CELL - CELL * 2, 1.3, 7);
              chronicle(`${T(ROOM_NAMES[room.kind])} of ${T(world.name)} was carved on ${T(deepName(room.level))}.`);
            }
          }
          d.task = null;
        }
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
          const safe = safeRoom();
          if (roomAt[cellOf(d)] === safe.id) break;
          if (world.t < (task.until ?? 0)) break;
          task.until = world.t + 3;
          go(d, roomGoal(safe));
        }
        break;
      }
      case 'leave':
        if (arrived) {
          // Mad, he walks out the gate and away.
          d.alive = false;
          d.deadAt = world.t;
          world.dwarves = world.dwarves.filter((x) => x !== d);
        }
        break;
      case 'mood': {
        const room = task.room!;
        if (!arrived) break;
        d.swingUntil = world.t + 0.2;
        task.stage = (task.stage ?? 0) + dt;
        if (r() < dt * 8) world.fx.push({ kind: 'spark', x: d.x + d.facing * CELL, y: d.y - CELL, t0: world.t, dur: 0.6, r: 4, seed: ids++, color: r() < 0.5 ? '#fef3c7' : '#a5f3fc' });
        look('mood', d.x, d.y - CELL * 2, 1.6, 3);
        if (task.stage > 30) {
          const s = world.stocks;
          const has = s.iron + s.gold + s.gem + s.mithril + s.goods > 3;
          if (r() < (has ? 0.95 : 0.5)) {
            const name = `THE ${pick(ART_KIND)} ${pick(ART_NAME)}`;
            world.artifacts.push({ name, maker: d.name });
            s.goods = Math.max(0, s.goods - 2);
            say(`${d.name} FORGES ${name}`, d.x, d.y - CELL * 3, '#fde68a', 'high');
            emit('artifact', d.x, d.y, 0.85);
            chronicle(`${T(d.name)}, taken by a strange mood, forged ${T(name)} in ${T(ROOM_NAMES[room.kind].toLowerCase())}.`);
            look('artifact', d.x, d.y - CELL * 2, 1.6, 7);
            world.fx.push({ kind: 'glint', x: d.x + d.facing * CELL, y: d.y - CELL, t0: world.t, dur: 3, r: CELL * 3, seed: ids++, color: '#fde68a' });
            world.feast = world.t + 30;
          } else {
            d.mad = true;
            say(`${d.name} GOES MAD`, d.x, d.y - CELL * 3, '#fca5a5', 'high');
            emit('mad', d.x, d.y, 0.6);
            chronicle(`${T(d.name)}, taken by a mood and denied what was wanted, went mad and walked out of the gate.`);
          }
          d.task = null;
        }
        break;
      }
      case 'idle':
        if (world.t > (task.until ?? 0)) d.task = null;
        break;
      case 'fight':
        break;
      default:
        d.task = null;
    }
    if (d.task && world.t - d.task.t0 > 90 && d.task.kind !== 'sleep' && d.task.kind !== 'mood') {
      // Stuck: give up and think again.
      if (d.task.kind === 'dig') for (const g of digs) g.claimed.delete(d.task.cell ?? -1);
      if (d.task.kind === 'haul' && d.task.load && !d.carry) d.task.load.taken = false;
      d.task = null;
    }
  }

  // ---- fighting ---------------------------------------------------------------------------------------

  const hostile = (f: Foe) => f.alive && f.active && f.kind !== 'trader' && f.kind !== 'mule';
  function soldiers(dt: number) {
    const foes = world.foes.filter(hostile).filter((f) => f.task === 'hunt' || f.task === 'gate');
    for (const d of alive()) {
      if (d.job !== 'soldier' || d.outside) continue;
      if (!foes.length) {
        if (d.task?.kind === 'fight') d.task = null;
        continue;
      }
      let best: Foe | null = null;
      let bd = Infinity;
      for (const f of foes) {
        const dd = Math.hypot(f.x - d.x, f.y - d.y);
        if (dd < bd) {
          bd = dd;
          best = f;
        }
      }
      if (!best) continue;
      if (d.task?.kind !== 'fight') d.task = { kind: 'fight', t0: world.t };
      d.cd -= dt;
      if (best.task === 'gate' && !world.gate.open) {
        // Behind the shut gate: spears and bolts through the murder holes.
        const inside = world.gate.c - side * (1 + (d.id % 3));
        if (Math.abs(d.x - world.cellX(at(inside, eF))) > CELL * 0.6 || Math.abs(d.y - world.cellY(at(inside, eF))) > 2) {
          d.repath -= dt;
          if (d.repath <= 0 || d.ri >= d.route.length) {
            d.repath = 2;
            go(d, (i) => i === at(inside, eF));
          }
          walk(d, 30, dt);
        } else if (d.cd <= 0) {
          d.cd = 1.3 + r() * 0.5;
          d.swingUntil = world.t + 0.25;
          d.facing = side;
          const at2 = foes.filter((f) => f.task === 'gate' && Math.abs(f.x - world.gate.c * CELL) < CELL * 6);
          const f = at2[Math.floor(r() * at2.length)];
          if (f) {
            world.fx.push({ kind: 'bolt', x: d.x, y: d.y - CELL, x1: f.x, y1: f.y - CELL * 0.7, t0: world.t, dur: 0.2, r: 1, seed: ids++ });
            hurt(f, 1.5 + r() * 2);
          }
        }
        continue;
      }
      if (bd < CELL * 1.6) {
        d.facing = best.x > d.x ? 1 : -1;
        if (d.cd <= 0) {
          d.cd = 0.9 + r() * 0.4;
          d.swingUntil = world.t + 0.25;
          hurt(best, 2 + r() * 3 + (world.artifacts.length ? 1 : 0));
        }
        continue;
      }
      if (d.crossbow && bd < CELL * 14 && Math.abs(best.y - d.y) < CELL * 2 && d.cd <= 0) {
        d.cd = 1.6;
        d.facing = best.x > d.x ? 1 : -1;
        world.fx.push({ kind: 'bolt', x: d.x, y: d.y - CELL, x1: best.x, y1: best.y - CELL * 0.7, t0: world.t, dur: 0.25, r: 1, seed: ids++ });
        later(0.25, () => best && hurt(best, 2 + r() * 2));
        continue;
      }
      d.repath -= dt;
      if (d.repath <= 0 || d.ri >= d.route.length) {
        d.repath = 1.5;
        const fc = new Set(foes.map((f) => cellOf(f)));
        go(d, (i) => fc.has(i) || fc.has(i - 1) || fc.has(i + 1));
      }
      walk(d, 30, dt);
    }
  }
  function hurt(f: Foe, dmg: number) {
    if (!f.alive) return;
    f.hp -= dmg;
    world.fx.push({ kind: 'spark', x: f.x, y: f.y - CELL, t0: world.t, dur: 0.3, r: 3, seed: ids++, color: '#fca5a5' });
    if (f.hp <= 0) {
      f.alive = false;
      f.deadAt = world.t;
      const cv = world.caverns[f.home];
      if (cv && !world.foes.some((o) => o.alive && o.home === cv.id)) cv.clearAt = world.t;
    }
  }
  function foes(dt: number) {
    const dwarfCells = new Map<number, Dwarf>();
    for (const d of alive()) dwarfCells.set(cellOf(d), d);
    for (const f of world.foes) {
      if (!f.alive) continue;
      f.cd -= dt;
      if (f.kind === 'trader' || f.kind === 'mule') {
        caravanStep(f, dt);
        continue;
      }
      if (!f.active) {
        // At home in the dark: a slow wander.
        f.repath -= dt;
        if (f.repath <= 0) {
          f.repath = 4 + r() * 6;
          const home = f.home;
          go(f, (i) => caveAt[i] === home && r() < 0.02, 600);
        }
        walk(f, 8, dt);
        continue;
      }
      if (f.task === 'gate') {
        // Up the road to the gate, and batter it until it gives.
        const atGate = Math.abs(f.x - world.gate.c * CELL) < CELL * 5;
        if (!atGate && (f.route.length === 0 || f.ri >= f.route.length)) {
          f.repath -= dt;
          if (f.repath <= 0) {
            f.repath = 1.5;
            const lane = gc + side * (1 + (f.id % 3));
            go(f, (i) => i % cols === lane && Math.floor(i / cols) === eF, 20000);
          }
        }
        if (walk(f, 22, dt) && atGate && !world.gate.open) {
          f.swingUntil = world.t + 0.2;
          world.gate.hp -= dt * (f.kind === 'troll' ? 3 : 0.6);
          if (r() < dt * 2) world.fx.push({ kind: 'spark', x: world.gate.c * CELL + CELL / 2, y: eF * CELL - CELL, t0: world.t, dur: 0.3, r: 3, seed: ids++, color: '#fde68a' });
          if (world.gate.hp <= 0) {
            world.gate.open = true;
            gateShut = new Set();
            say('THE GATE IS BROKEN', world.gate.c * CELL, eF * CELL - CELL * 2, '#fca5a5', 'high');
            emit('gatebreak', world.gate.c * CELL, eF * CELL, 0.85);
            look('fight', world.gate.c * CELL, eF * CELL, 1.4, 10);
            for (const o of world.foes) if (o.task === 'gate') o.task = 'hunt';
          }
        }
        if (world.gate.open) f.task = 'hunt';
        continue;
      }
      // Hunt: the nearest dwarf.
      let best: Dwarf | null = null;
      let bd = Infinity;
      for (const d of alive()) {
        const dd = Math.hypot(d.x - f.x, d.y - f.y);
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      if (!best) {
        f.task = 'wander';
        continue;
      }
      if (f.task !== 'hunt') {
        f.repath -= dt;
        if (bd < CELL * 30 && f.repath <= 0) f.task = 'hunt';
        else continue;
      }
      if (bd < CELL * (f.kind === 'troll' ? 2 : 1.4)) {
        f.facing = best.x > f.x ? 1 : -1;
        if (f.cd <= 0) {
          f.cd = 1 + r() * 0.5;
          f.swingUntil = world.t + 0.25;
          best.hp -= f.kind === 'troll' ? 5 : 1 + r() * 1.5;
          if (best.hp <= 0) die(best, `a ${f.kind}`);
          // Cornered, anyone with a pick or a hammer hits back.
          else if (best.job !== 'soldier' && r() < 0.4) hurt(f, 1 + r() * 1.5);
          if (best.job !== 'soldier' && best.alive && best.task?.kind !== 'flee') best.task = { kind: 'flee', t0: world.t };
        }
        continue;
      }
      f.repath -= dt;
      if (f.repath <= 0 || f.ri >= f.route.length) {
        f.repath = 2 + r();
        if (budget > 0 && !go(f, (i) => dwarfCells.has(i))) {
          // No way through to them: back to the dark, for now.
          if (budget > 0 && ++f.lost > 3) {
            f.task = 'wander';
            f.lost = 0;
            f.repath = 10;
          }
        } else f.lost = 0;
      }
      walk(f, f.kind === 'spider' ? 30 : f.kind === 'troll' ? 18 : 24, dt);
      if (once(`fight-${Math.floor(world.t / 40)}`)) look('fight', f.x, f.y, 1.35, 6);
    }
    // A cavern cleared stays clear a while, then is claimed: the farmers plant its floor.
    for (const cv of world.caverns) if (cv.known && !cv.claimed && cv.clearAt > 0 && world.t - cv.clearAt > 50 && cv.kind !== 'lair') {
      cv.claimed = true;
      say(`${cv.name} IS CLAIMED`, cv.c * CELL, cv.r * CELL, '#bbf7d0', 'medium');
      emit('claimed', cv.c * CELL, cv.r * CELL, 0.5);
      chronicle(`The clan claimed ${T(cv.name)} and planted its floor.`);
    }
  }

  // ---- the gate, the road, the year ---------------------------------------------------------------------

  const edgeX = () => (side > 0 ? (cols - 1) * CELL : CELL);
  const edgeY = () => surface[side > 0 ? cols - 1 : 0] * CELL;
  function goblins() {
    attacked = true;
    const n = 3 + Math.floor(r() * 3 * Math.max(0.5, hz)) + Math.min(6, Math.floor(world.wealth() / 600));
    for (let k2 = 0; k2 < n; k2++) {
      const f = foe(r() < 0.12 ? 'troll' : 'goblin', null, true, edgeX() + side * k2 * CELL * 1.5, edgeY());
      if (!f) continue;
      f.task = 'gate';
      f.route = [];
      f.repath = k2 * 0.3;
    }
    world.gate.open = false;
    world.gate.hp = world.gate.hpMax;
    gateShut = new Set(gateCells());
    say('GOBLINS AT THE GATE', gc * CELL, eF * CELL - CELL * 3, '#fca5a5', 'high');
    emit('goblins', gc * CELL, eF * CELL, 0.8);
    chronicle(`Goblins came up the mountain to the gate of ${T(world.name)}.`);
    look('goblins', (gc + side * 10) * CELL, eF * CELL, 1.15, 12);
    if (!militia) {
      militia = true;
      const raised = alive().filter((d) => d.job === 'hauler' || d.job === 'miner').slice(0, 2);
      for (const d of raised) {
        d.job = 'soldier';
        d.hp = 16;
        d.task = null;
      }
      if (raised.length) {
        say('THE MILITIA IS RAISED', gc * CELL, eF * CELL - CELL * 5, '#fde68a', 'medium');
        emit('militia', gc * CELL, eF * CELL, 0.4);
      }
    }
  }
  let militia = false;

  function caravan() {
    const n = 2 + Math.floor(r() * 2);
    for (let k2 = 0; k2 < n * 2; k2++) {
      const f = foe(k2 % 2 ? 'mule' : 'trader', null, true, edgeX() + side * k2 * CELL * 1.2, edgeY());
      if (!f) continue;
      f.task = 'trade';
      f.repath = 0;
    }
    say('A CARAVAN COMES UP THE MOUNTAIN', edgeX(), edgeY() - CELL * 3, '#fde68a', 'medium');
    emit('caravan', edgeX(), edgeY(), 0.4);
    look('caravan', (gc + side * 14) * CELL, eF * CELL, 1.1, 10);
    traded = false;
  }
  let traded = false;
  function caravanStep(f: Foe, dt: number) {
    if (f.task === 'trade') {
      if (f.route.length === 0 || f.ri >= f.route.length) {
        f.repath -= dt;
        if (f.repath <= 0) {
          f.repath = 2;
          if (!go(f, (i) => roomAt[i] === 0 && Math.floor(i / cols) === eF, 20000)) return;
        }
      }
      if (walk(f, 16, dt) && roomAt[cellOf(f)] === 0) {
        f.cd = 14;
        f.task = 'leave';
        f.route = [];
        if (!traded) {
          traded = true;
          const s = world.stocks;
          const sold = Math.min(s.goods, 6);
          s.goods -= sold;
          s.food += 20 + sold * 4;
          s.ale += 10 + sold * 2;
          s.treasure += Math.floor(sold / 2);
          say(sold ? `THE CLAN TRADES ${sold} GOODS` : 'THE TRADERS FIND LITTLE TO BUY', f.x, f.y - CELL * 3, '#fde68a', 'low');
          emit('trade', f.x, f.y, 0.3);
        }
      }
      return;
    }
    if (f.task === 'leave') {
      if (f.cd > 0) return;
      if (f.route.length === 0) go(f, (i) => i % cols === (side > 0 ? cols - 1 : 0), 20000);
      if (walk(f, 16, dt) && f.route.length) {
        f.alive = false;
        f.deadAt = -999;
      }
    }
  }

  function migrants() {
    const n = 2 + Math.floor(r() * 3);
    for (let k2 = 0; k2 < n; k2++) {
      const d = dwarf(pick(['miner', 'miner', 'hauler', 'mason', 'farmer', 'brewer', 'smith', 'soldier'] as Job[]), edgeX() + side * k2 * CELL * 1.4, edgeY(), true);
      d.task = { kind: 'enter', t0: world.t };
      d.route = [];
    }
    say(`${n} MIGRANTS COME TO ${world.name}`, edgeX(), edgeY() - CELL * 3, '#bbf7d0', 'medium');
    emit('migrants', edgeX(), edgeY(), 0.4);
    look('surface', (gc + side * 12) * CELL, eF * CELL, 1.1, 8);
  }

  let lastSeason = world.season;
  function year() {
    const s = (lastSeasonBase + Math.floor(world.t / SEASON)) % 4;
    world.season = s;
    if (s === lastSeason) return;
    lastSeason = s;
    if (s === 0) {
      world.year++;
      for (const d of world.dwarves) d.age++;
    }
    say(`${SEASONS[s]} ON THE MOUNTAIN`, gc * CELL, (surface[gc] - 4) * CELL, '#e7dcc4', 'low');
    emit(SEASONS[s].toLowerCase(), gc * CELL, eF * CELL, 0.2);
    if ((s === 1 || s === 2) && !world.fallen) later(10 + r() * 40, caravan);
    if (!world.fallen && world.wealth() > 300 && ready('dorm').length * 6 > alive().length + 2 && alive().length < 30 && r() < 0.7) later(20 + r() * 50, migrants);
    // The old die.
    for (const d of alive()) if (d.age > 220 && r() < 0.25) {
      const wasKing = world.king === d;
      die(d, 'old age');
      say(`${d.name} DIES OF GREAT AGE`, d.x, d.y - CELL * 2, '#cbd5e1', wasKing ? 'high' : 'low');
      emit(wasKing ? 'kingdies' : 'death', d.x, d.y, wasKing ? 0.6 : 0.2);
    }
  }
  const lastSeasonBase = world.season;

  // ---- what sleeps below ------------------------------------------------------------------------------

  function wake(why: string) {
    const s = world.sleeper;
    if (!s || s.state === 'dead') return;
    s.state = 'rise';
    s.t0 = world.t;
    s.woke++;
    const lair = world.caverns.find((c) => c.kind === 'lair');
    if (lair) lair.known = true;
    // Its way up: to the shaft, up it, and along to the hall (or wherever the dwarves are).
    s.way = [[(shaftC + 1) * CELL, s.y], [(shaftC + 1) * CELL, world.levels[1].floor * CELL], [((ready('hall')[0]?.c0 ?? shaftC - 8) + 4) * CELL, (ready('hall')[0]?.floor ?? world.levels[1].floor) * CELL]];
    say(`${s.name} WAKES`, s.x, s.y - CELL * 6, '#fca5a5', 'high');
    emit('sleeperwakes', s.x, s.y, 1);
    chronicle(`${why}, and ${T(s.name)} woke beneath ${T(world.name)}.`);
    look('sleeper', s.x, s.y - CELL * 3, 1.25, 12);
    quake(1);
    alarm(cellOf(s), 200);
    // The masons run to seal the shaft above it.
    sealLevel = -1;
    const above = world.levels.filter((l) => l.floor < s.y / CELL - 4 && l.k > 0).pop();
    if (above && alive().some((d) => d.job === 'mason')) {
      sealLevel = above.k;
      sealWork = 0;
      say('THE MASONS RUN TO SEAL THE SHAFT', shaftC * CELL, above.floor * CELL, '#e7dcc4', 'medium');
      emit('sealing', shaftC * CELL, above.floor * CELL, 0.5);
    }
  }
  let sealLevel = -1;
  let sealWork = 0;
  let sealHp = 0;
  let sealedAt = 0;
  let nextStirCheck = 5;
  function sleeper(dt: number) {
    const s = world.sleeper;
    if (!s) return;
    s.anim += dt;
    if (s.state === 'dead') return;
    if (s.state === 'sleep' || s.state === 'stir') {
      if (world.t < nextStirCheck) return;
      nextStirCheck = world.t + 2;
      if (sealedAt > 0) return;
      const near = nearSleeper;
      if (s.state === 'sleep' && near < 24) {
        s.state = 'stir';
        s.t0 = world.t;
        say('SOMETHING STIRS BENEATH', s.x, s.y - CELL * 8, '#c4b5fd', 'high');
        emit('stir', s.x, s.y, 0.7);
        chronicle(`The miners on ${T(deepName(world.levels.length - 1))} felt the rock shiver under their feet.`);
        look('stir', s.x, s.y - CELL * 2, 1.15, 8);
        quake(0.4);
      }
      if (s.state === 'stir') {
        if (r() < 0.3) quake(0.25);
        if (near < 12 || (world.t - s.t0 > 160 && r() < 0.05)) wake('They dug too greedily and too deep');
      }
      return;
    }
    const target = s.way[0];
    if (s.state === 'return') {
      const [hx, hy] = s.home;
      const dx = hx - s.x;
      const dy = hy - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) {
        s.state = 'sleep';
        s.t0 = world.t;
        s.hp = s.hpMax;
        s.wounded = false;
        nextStirCheck = world.t + 200;
        nearSleeper = Infinity;
        return;
      }
      move(s, dx / d, dy / d, dt, 20);
      return;
    }
    if (!target) return;
    // Up the shaft: but if the masons sealed it, it batters the seal.
    if (sealLevel >= 0 && world.levels[sealLevel] && s.y / CELL < world.levels[sealLevel].floor + 4 && sealHp > 0) {
      s.state = 'batter';
      s.anim += dt * 2;
      sealHp -= dt * (s.wounded ? 0.6 : 1.4);
      if (r() < dt * 2) {
        quake(0.5);
        world.fx.push({ kind: 'dust', x: s.x, y: s.y - CELL * 6, t0: world.t, dur: 1.5, r: CELL * 3, seed: ids++ });
      }
      look('sleeper', s.x, s.y - CELL * 4, 1.3, 3);
      if (sealHp <= 0) {
        for (const c of [shaftC, shaftC + 1]) for (let dr = 0; dr < 3; dr++) setMat(at(c, world.levels[sealLevel].floor + 1 + dr), M.OPEN);
        say('THE SEAL BREAKS', s.x, s.y - CELL * 6, '#fca5a5', 'high');
        emit('sealbreaks', s.x, s.y, 0.9);
        sealLevel = -1;
        s.state = 'rise';
      } else if (world.t - s.t0 > 140) {
        // It gives up, and goes back down; the deeps below are left to it.
        s.state = 'return';
        for (const l of world.levels) if (l.k > sealLevel) l.sealed = true;
        for (const g of digs) if ((g.level ?? 0) > sealLevel || [...g.cells].some((i) => Math.floor(i / cols) > world.levels[sealLevel].floor)) g.cells.clear();
        say('THE DEEP IS SEALED', shaftC * CELL, world.levels[sealLevel].floor * CELL, '#bbf7d0', 'high');
        emit('sealed', shaftC * CELL, world.levels[sealLevel].floor * CELL, 0.8);
        chronicle(`${T(s.name)} was sealed below ${T(deepName(sealLevel))}. The deeps under it were given up.`);
        sealedAt = world.t;
      }
      return;
    }
    s.state = 'rise';
    const dx = target[0] - s.x;
    const dy = target[1] - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) {
      s.way.shift();
      if (!s.way.length) {
        // Up among them: it hunts whoever is nearest.
        const prey = alive().sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
        s.way = prey ? [[prey.x, prey.y]] : [[shaftC * CELL, eF * CELL]];
      }
    } else move(s, dx / d, dy / d, dt, 14);
    // In time it has had enough, and goes back down.
    if (world.t - s.t0 > 170 && !world.fallen) {
      s.state = 'return';
      say(`${s.name} GOES BACK INTO THE DEEP`, s.x, s.y - CELL * 6, '#c4b5fd', 'high');
      emit('sleepersated', s.x, s.y, 0.7);
      chronicle(`${T(s.name)} went back down into the deep, and the clan buried its dead.`);
      alarmUntil = world.t;
      return;
    }
    // It smashes what it passes; it kills what it reaches.
    s.cd -= dt;
    for (const dw of alive()) {
      if (Math.hypot(dw.x - s.x, dw.y - s.y) < CELL * 3.2 && s.cd <= 0) {
        s.cd = 1.1;
        dw.hp -= 7;
        world.fx.push({ kind: s.kind === 'demon' ? 'fire' : 'blast', x: dw.x, y: dw.y - CELL, t0: world.t, dur: 0.8, r: CELL * 2, seed: ids++ });
        if (dw.hp <= 0) die(dw, s.name.toLowerCase());
      }
    }
    // The soldiers.
    const near = alive().filter((dw) => dw.job === 'soldier' && Math.hypot(dw.x - s.x, dw.y - s.y) < CELL * 5);
    for (const dw of near) {
      dw.facing = s.x > dw.x ? 1 : -1;
      dw.swingUntil = world.t + 0.2;
      if (r() < dt * 0.7) s.hp -= 2.5 + (world.artifacts.length ? 1.5 : 0);
    }
    for (const dw of alive()) if (dw.job === 'soldier' && dw.task?.kind !== 'fight') {
      dw.task = { kind: 'fight', t0: world.t };
      dw.repath = 0;
    }
    for (const dw of alive()) if (dw.job === 'soldier') {
      dw.repath -= dt;
      if (dw.repath <= 0) {
        dw.repath = 2;
        const sc = cellOf(s);
        go(dw, (i) => Math.abs((i % cols) - (sc % cols)) <= 3 && Math.abs(Math.floor(i / cols) - Math.floor(sc / cols)) <= 4);
      }
      walk(dw, 30, dt);
    }
    look('sleeper', s.x, s.y - CELL * 3, 1.2, 3);
    if (s.hp <= 0) {
      s.state = 'dead';
      s.t0 = world.t;
      const lair = world.caverns.find((c) => c.kind === 'lair');
      if (lair) lair.claimed = true;
      world.stocks.treasure += 60;
      say(`${s.name} IS SLAIN`, s.x, s.y - CELL * 6, '#fde68a', 'high');
      emit('sleeperslain', s.x, s.y, 1);
      chronicle(`${T(s.name)} was slain in the deeps of ${T(world.name)}${world.artifacts.length ? `, and ${T(world.artifacts[0].name)} was there` : ''}.`);
      look('sleeper', s.x, s.y - CELL * 3, 1.4, 10);
      world.feast = world.t + 40;
      alarmUntil = world.t;
      return;
    }
    if (s.hp < s.hpMax * 0.4 && !s.wounded && r() < 0.75) {
      s.wounded = true;
      s.state = 'return';
      say(`${s.name} GOES BACK INTO THE DEEP, WOUNDED`, s.x, s.y - CELL * 6, '#bbf7d0', 'high');
      emit('sleeperretreats', s.x, s.y, 0.8);
      chronicle(`The soldiers of ${T(world.name)} drove ${T(s.name)} back into the deep.`);
      alarmUntil = world.t;
    }
    // The hold falls.
    if (alive().length <= 3 && !world.fallen) fall();
  }
  /** It moves through rock by breaking it. */
  function move(s: Sleeper, ux: number, uy: number, dt: number, speed: number) {
    const R = s.kind === 'worm' || s.kind === 'tentacle' ? 2 : 3;
    const c = Math.round(s.x / CELL);
    const rr = Math.round(s.y / CELL);
    let solid = 0;
    for (let dr = -R * 2; dr <= 0; dr++) for (let dc = -R; dc <= R; dc++) {
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
    const sp = solid > 4 ? speed * 0.4 : speed;
    s.x += ux * sp * dt;
    s.y += uy * sp * dt;
    s.facing = ux >= 0 ? 1 : -1;
    if (solid && r() < 0.2) world.fx.push({ kind: 'dust', x: s.x, y: s.y - CELL * 3, t0: world.t, dur: 1.5, r: CELL * 3, seed: ids++ });
  }
  function sealing(dt: number) {
    if (sealLevel < 0 || sealHp > 0) return;
    const lv = world.levels[sealLevel];
    if (!lv) return;
    const masons = alive().filter((d) => d.job === 'mason' || d.job === 'miner');
    for (const d of masons.slice(0, 3)) {
      if (d.task?.kind !== 'seal') {
        d.task = { kind: 'seal', t0: world.t };
        go(d, (i) => Math.abs((i % cols) - shaftC) <= 3 && Math.floor(i / cols) === lv.floor);
      }
      const here = cellOf(d);
      if (walk(d, 26, dt) && Math.abs((here % cols) - shaftC) <= 3 && Math.floor(here / cols) === lv.floor) {
        d.swingUntil = world.t + 0.2;
        sealWork += dt / 18;
      }
    }
    if (sealWork >= 1) {
      // Stone across the shaft, three courses deep, under the deep.
      for (const c of [shaftC, shaftC + 1]) for (let dr = 1; dr <= 3; dr++) {
        const i = at(c, lv.floor + dr);
        setMat(i, M.SEAL);
        ladder[i] = 0;
      }
      sealHp = 50;
      say(`THE SHAFT IS SEALED UNDER ${deepName(sealLevel)}`, shaftC * CELL, lv.floor * CELL, '#bbf7d0', 'high');
      emit('seal', shaftC * CELL, lv.floor * CELL, 0.7);
      look('sleeper', shaftC * CELL, lv.floor * CELL, 1.3, 6);
      for (const d of masons) if (d.task?.kind === 'seal') d.task = null;
    }
  }

  /** The hold falls: the last flee out of the gate; the halls go dark; in time, another clan comes. */
  function fall() {
    world.fallen = true;
    say(`${world.name} FALLS`, shaftC * CELL, eF * CELL - CELL * 4, '#fca5a5', 'high');
    emit('holdfalls', shaftC * CELL, eF * CELL, 1);
    chronicle(`${T(world.name)} fell to ${T(world.sleeper?.name.toLowerCase() ?? 'the deep')}. The last of the ${T(world.clan)} clan fled the mountain.`);
    look('fall', shaftC * CELL, eF * CELL, 0.8, 30);
    for (const d of alive()) {
      d.task = { kind: 'leave', t0: world.t };
      go(d, (i) => i % cols === (side > 0 ? cols - 1 : 0), 20000);
    }
    for (const room of world.rooms) room.ruined = room.kind !== 'entrance';
    later(45, () => {
      if (world.sleeper && world.sleeper.state !== 'dead') {
        world.sleeper.state = 'return';
        world.sleeper.wounded = false;
      }
    });
    later(110, reclaim);
  }
  function reclaim() {
    world.fallen = false;
    world.clan = pick(CLAN1) + pick(CLAN2);
    world.reign = 1;
    alarmUntil = -1;
    for (const d of world.dwarves) if (d.alive) d.alive = false;
    world.dwarves = world.dwarves.filter((d) => d.deadAt > world.t - 30);
    const jobs2: Job[] = ['king', 'miner', 'miner', 'hauler', 'mason', 'mason', 'smith', 'farmer', 'brewer', 'soldier', 'soldier', 'soldier'];
    for (const [n, j] of jobs2.entries()) {
      const d = dwarf(j, edgeX() + side * n * CELL * 1.3, edgeY(), true);
      d.task = { kind: 'enter', t0: world.t };
      if (j === 'king') {
        world.king = d;
        d.age = 150;
      }
    }
    for (const lv of world.levels) if (lv) lv.sealed = false;
    sealLevel = -1;
    sealHp = 0;
    sealedAt = 0;
    world.gate.open = true;
    gateShut = new Set();
    say(`THE ${world.clan} CLAN COMES TO RECLAIM ${world.name}`, edgeX(), edgeY() - CELL * 3, '#bbf7d0', 'high');
    emit('reclaim', edgeX(), edgeY(), 0.8);
    chronicle(`Years later the ${T(world.clan)} clan came to reclaim ${T(world.name)}, and lit the halls again.`);
    look('surface', (gc + side * 12) * CELL, eF * CELL, 1.05, 14);
    world.stocks.food = Math.max(world.stocks.food, 30);
    world.stocks.ale = Math.max(world.stocks.ale, 15);
  }

  // ---- the frame ------------------------------------------------------------------------------------

  let nextPlan = 2;
  let tickDigs = 0;
  let nextGoblins = 420 + r() * 300;
  let nextMood = 300 + r() * 300;
  let nextCaveCheck = 30;
  let calm = -12;
  let nextFeast = 200 + r() * 200;
  world.deepestCol = shaftC;
  function step(dt: number) {
    world.t += dt;
    world.day = (world.day + dt / DAY) % 1;
    budget = 10;
    world.quake = Math.max(0, world.quake - dt * 0.5);
    year();
    laterRun();
    if (world.t >= nextPlan) {
      nextPlan = world.t + 4;
      plan();
    }
    for (const d of world.dwarves) {
      if (!d.alive) continue;
      if (d.task?.kind === 'enter') {
        // In from the road, through the gate.
        if (d.route.length === 0 || d.ri >= d.route.length) {
          if (!go(d, (i) => roomAt[i] === 0 && Math.floor(i / cols) === eF, 20000) && world.t - d.task.t0 > 30) {
            d.outside = false;
            d.task = null;
          }
        }
        if (walk(d, 22, dt) && roomAt[cellOf(d)] === 0) {
          d.outside = false;
          d.task = null;
        }
        continue;
      }
      if (d.job === 'soldier' && d.task?.kind === 'fight') continue;
      if (d.task?.kind === 'seal') {
        if (sealLevel >= 0 && sealHp <= 0) continue;
        d.task = null;
      }
      act(d, dt);
      // Water over the head, for long: drowned. Magma: burnt.
      const i = cellOf(d);
      if (water[i] > 0.75 && water[i - cols] > 0.5) {
        d.drown += dt;
        if (d.drown > 12) {
          die(d, 'drowning');
          say(`${d.name} DROWNS`, d.x, d.y - CELL * 2, '#7dd3fc', 'medium');
          emit('drowned', d.x, d.y, 0.4);
        }
      } else d.drown = Math.max(0, d.drown - dt);
      if (magma[i] > 0.15 || magma[i - cols] > 0.3) {
        die(d, 'magma');
        world.fx.push({ kind: 'fire', x: d.x, y: d.y - CELL, t0: world.t, dur: 1.2, r: CELL * 1.5, seed: ids++ });
        if (once(`burnt-${Math.floor(world.t / 20)}`)) {
          say(`${d.name} IS CAUGHT IN THE MAGMA`, d.x, d.y - CELL * 2, '#fb923c', 'medium');
          emit('burnt', d.x, d.y, 0.5);
        }
      }
    }
    if (!world.fallen && !alive().length) fall();
    soldiers(dt);
    sealing(dt);
    foes(dt);
    sleeper(dt);
    fluids(dt);
    // Night falls and the evening feast.
    if (world.t > nextFeast && world.day > 0.7 && world.day < 0.8 && ready('hall').length && world.stocks.ale > 6 && !world.fallen) {
      nextFeast = world.t + 300 + r() * 300;
      world.feast = world.t + 28;
      world.stocks.ale -= 6;
      const h = ready('hall')[0];
      say('A FEAST IN THE GREAT HALL', ((h.c0 + h.c1) / 2) * CELL, h.top * CELL, '#fde68a', 'medium');
      emit('feast', ((h.c0 + h.c1) / 2) * CELL, h.floor * CELL, 0.45);
      look('feast', ((h.c0 + h.c1) / 2) * CELL, h.floor * CELL - CELL * 3, 1.3, 14);
    }
    // Food and drink.
    const pop = alive().length;
    world.stocks.food = Math.max(0, world.stocks.food - pop * dt * 0.006);
    world.stocks.ale = Math.max(0, world.stocks.ale - pop * dt * 0.005);
    // A strange mood.
    if (world.t > nextMood && (ready('forge').length || ready('magmaforge').length) && !world.fallen) {
      nextMood = world.t + 420 + r() * 420;
      const forge = ready('magmaforge')[0] ?? ready('forge')[0];
      const who = alive().filter((d) => d.job === 'smith' || d.job === 'mason' || d.job === 'miner').sort(() => r() - 0.5)[0];
      if (who) {
        who.task = { kind: 'mood', room: forge, t0: world.t, stage: 0 };
        go(who, roomGoal(forge));
        say(`${who.name} IS TAKEN BY A STRANGE MOOD`, who.x, who.y - CELL * 2, '#c4b5fd', 'medium');
        emit('mood', who.x, who.y, 0.5);
        look('mood', who.x, who.y - CELL * 2, 1.4, 6);
      }
    }
    // Goblins.
    if (world.t > nextGoblins && !world.fallen && hz > 0) {
      nextGoblins = world.t + (380 + r() * 420) / Math.max(0.4, hz);
      goblins();
    }
    if (!world.gate.open && !world.foes.some((f) => f.alive && f.task === 'gate')) {
      world.gate.open = true;
      gateShut = new Set();
      world.gate.hpMax += 10;
      if (once(`gate-held-${Math.floor(world.t / 100)}`)) {
        say('THE GATE HELD', gc * CELL, eF * CELL - CELL * 2, '#bbf7d0', 'medium');
        emit('gateheld', gc * CELL, eF * CELL, 0.4);
      }
    }
    // Wide rooms in weak rock, and the shaking, bring roofs down.
    if (world.t > nextCaveCheck) {
      nextCaveCheck = world.t + 8;
      for (const room of world.rooms) {
        if (!room.dug || room.pillars || room.kind === 'entrance' || room.c1 - room.c0 < 9) continue;
        const above = mat[at(Math.round((room.c0 + room.c1) / 2), room.top - 1)];
        const weak = above === M.SOIL || above === M.SLATE || above === M.ICE || above === M.RUBBLE;
        const odds = (weak ? 0.012 : 0.003) * hz + world.quake * 0.05;
        if (r() < odds) {
          caveIn(room, world.quake > 0.2 ? 'The mountain shook' : 'The rock was weak');
          break;
        }
      }
    }
    // A rescue finished: the room is whole again.
    for (const g of digs) if (g.purpose === 'rescue' && g.cells.size === 0 && g.room) {
      g.room.dug = true;
      if (once(`rescued-${g.id}`)) {
        const x = ((g.room.c0 + g.room.c1) / 2) * CELL;
        say(`${ROOM_NAMES[g.room.kind]} IS DUG OUT`, x, g.room.top * CELL, '#bbf7d0', 'low');
        emit('dugout', x, g.room.floor * CELL, 0.3);
      }
    }
    // Rooms dug out.
    for (const g of digs) if (g.purpose === 'room' && g.cells.size === 0 && g.room && !g.room.dug) g.room.dug = true;
    // Cells opened some other way, and claims by dwarves who went off to do something else.
    if (tickDigs++ % 30 === 0) for (const g of digs) {
      for (const i of g.cells) if (isOpen(mat[i])) g.cells.delete(i);
      for (const [i, id] of g.claimed) {
        const d = world.dwarves.find((x) => x.id === id);
        if (!d || !d.alive || d.task?.kind !== 'dig' || d.task.cell !== i) g.claimed.delete(i);
      }
    }
    for (let i = digs.length - 1; i >= 0; i--) {
      const g = digs[i];
      // A dig that has gone nowhere for a long while is given up (what is left cannot be reached).
      if (g.cells.size === 0 || (g.purpose === 'vein' && world.t - g.last > 90) || world.t - g.last > (g.purpose === 'rescue' ? 300 : 150)) {
        if (g.room && g.cells.size && g.purpose === 'room') g.room.dug = true;
        digs.splice(i, 1);
      }
    }
    // The old dead are taken to the tombs (they go from view).
    world.dwarves = world.dwarves.filter((d) => d.alive || world.t - d.deadAt < 40);
    world.foes = world.foes.filter((f) => f.alive || (f.deadAt > 0 && world.t - f.deadAt < 20));
    // Creatures come up again from a known cavern now and then, until it is claimed.
    for (const cv of world.caverns) if (cv.known && !cv.claimed && (cv.kind === 'cavern' || cv.kind === 'lake') && r() < dt * 0.004 * hz && world.foes.filter((f) => f.alive && f.home === cv.id).length < 6) {
      const f = foe(r() < 0.2 ? 'troll' : r() < 0.5 ? 'spider' : 'crawler', cv, true);
      if (f) f.task = 'hunt';
    }
    for (let i = world.fx.length - 1; i >= 0; i--) if (world.t - world.fx[i].t0 > world.fx[i].dur) world.fx.splice(i, 1);
    if (world.fx.length > 400) world.fx.splice(0, world.fx.length - 400);
    for (let i = world.labels.length - 1; i >= 0; i--) if (world.t - world.labels[i].t0 > world.labels[i].dur) world.labels.splice(i, 1);
    // The camera, when nothing calls it: the whole hold, a busy room, the dig face, the gate, or below.
    calm += dt;
    if (world.t > world.focus.until && calm > 10) {
      calm = 0;
      const p = r();
      const busy = alive().filter((d) => d.task?.kind === 'dig' || d.task?.kind === 'work');
      if (p < 0.3) {
        const top = (surface[gc] - 6) * CELL;
        const bottom = (world.deepest + 6) * CELL;
        look('overview', shaftC * CELL, (top + bottom) / 2, Math.max(0.55, Math.min(1, H / Math.max(1, bottom - top))), 14);
      } else if (p < 0.7 && busy.length) {
        const d = busy[Math.floor(r() * busy.length)];
        look('work', d.x, d.y - CELL * 2, 1.35 + r() * 0.25, 10);
      } else if (p < 0.85) look('surface', (gc + side * 6) * CELL, eF * CELL - CELL * 4, 1, 10);
      else if (world.sleeper && world.sleeper.state !== 'dead') look('below', world.sleeper.x, world.sleeper.y - CELL * 3, 1.1, 8);
      else look('overview', shaftC * CELL, world.levels[Math.floor(world.levels.length / 2)].floor * CELL, 0.8, 10);
    }
  }
  return world;
}
