/**
 * Foundry: a factory that builds itself, seen from above.
 *
 * On screen, at a glance: grass, lakes and woods; ore fields (iron blue-grey, copper orange,
 * coal black, stone sand); the headquarters, and around it miners, furnaces, assemblers, labs,
 * a boiler by the water, and the belts between them, full of moving ore, plates, gears and
 * circuits; construction bots flying out from the headquarters; smoke, and lights at night.
 *
 * Always happening: items ride the belts; machines work; bots build and repair.
 * How it grows: one rule does most of it. A machine missing an input gets a supplier: a lab
 * needs gears and circuits, so assemblers are built beside it; an assembler needs plates, so
 * furnaces; a furnace needs ore, so a miner goes up on the nearest field. The headquarters
 * keeps its own supply lines (it pays for everything), the power keeps up with the machines,
 * labs come with research, and a rocket silo with enough of it.
 * Keeps going: ore runs out under a miner, which is taken down and another goes up elsewhere,
 * so the belts are rerouted all the time. Research never ends; rockets keep launching.
 * The cast (per seed): biters drawn by the pollution (and turrets against them), wildfires
 * in the woods, meteors that leave new ore.
 * A touch: on an ore field, a new mine is ordered; on a machine, overtime.
 */
import { createBus, type Bus } from '../../../sim/bus';
import { createNoise2D } from '../../../noise';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Director, type Genome, type SystemDef } from '../../../kit';

export type Item = 'iron-ore' | 'copper-ore' | 'coal' | 'stone' | 'iron' | 'copper' | 'brick' | 'gear' | 'circuit';
export type Kind = 'hq' | 'miner' | 'furnace' | 'assembler' | 'lab' | 'silo' | 'boiler' | 'turret';
export const SIZE: Record<Kind, number> = { hq: 4, miner: 2, furnace: 2, assembler: 3, lab: 3, silo: 5, boiler: 3, turret: 2 };
export const ORES = ['iron-ore', 'copper-ore', 'coal', 'stone'] as const;
export const ORE_NAME: Record<(typeof ORES)[number], string> = { 'iron-ore': 'IRON', 'copper-ore': 'COPPER', coal: 'COAL', stone: 'STONE' };

type Recipe = { in: Partial<Record<Item, number>>; out: Item | 'research' | 'part' | 'power'; time: number };
export const RECIPES: Record<string, Recipe> = {
  iron: { in: { 'iron-ore': 1 }, out: 'iron', time: 2.2 },
  copper: { in: { 'copper-ore': 1 }, out: 'copper', time: 2.2 },
  brick: { in: { stone: 2 }, out: 'brick', time: 2.8 },
  gear: { in: { iron: 2 }, out: 'gear', time: 1.6 },
  circuit: { in: { iron: 1, copper: 2 }, out: 'circuit', time: 2.4 },
  science: { in: { gear: 1, circuit: 1 }, out: 'research', time: 4 },
  rocket: { in: { brick: 1, gear: 1, circuit: 1 }, out: 'part', time: 3 },
  power: { in: { coal: 1 }, out: 'power', time: 6 },
};
const MAKER: Record<Item, { kind: Kind; recipe: string | null }> = {
  'iron-ore': { kind: 'miner', recipe: null },
  'copper-ore': { kind: 'miner', recipe: null },
  coal: { kind: 'miner', recipe: null },
  stone: { kind: 'miner', recipe: null },
  iron: { kind: 'furnace', recipe: 'iron' },
  copper: { kind: 'furnace', recipe: 'copper' },
  brick: { kind: 'furnace', recipe: 'brick' },
  gear: { kind: 'assembler', recipe: 'gear' },
  circuit: { kind: 'assembler', recipe: 'circuit' },
};
const COST: Record<Kind, Partial<Record<'iron' | 'copper' | 'brick', number>>> = {
  hq: {},
  miner: { iron: 8 },
  furnace: { iron: 5, brick: 2 },
  assembler: { iron: 12, copper: 6 },
  lab: { iron: 16, copper: 10 },
  silo: { iron: 90, copper: 50, brick: 40 },
  boiler: { iron: 12 },
  turret: { iron: 10 },
};
const BELT_COST = 0.4;
const CAP = 6;
const SPACING = 0.34;
export const TECHS = ['AUTOMATION', 'LOGISTICS', 'ELECTRONICS', 'FAST BELTS', 'STEEL', 'CONSTRUCTION BOTS', 'ADVANCED CIRCUITS', 'ROCKET SILO', 'EXPRESS BELTS', 'SOLAR', 'ROBOTICS', 'SPACE SCIENCE'];
const PLANETS = ['NAUVIS', 'VESTA PRIME', 'KORRIN', 'TAL-4', 'OBERON FIELD', 'HADLEY', 'CINDERMOOR', 'AURELIA'];

export type Machine = {
  id: number; kind: Kind; c: number; r: number; n: number;
  state: 'ghost' | 'work' | 'ruin' | 'gone';
  build: number; recipe: string | null; ore: Item | null;
  inBuf: Partial<Record<Item, number>>; outBuf: number; busy: boolean; craft: number;
  hp: number; outLine: number; inLines: number[]; boost: number; fuel: number; parts: number; field: string; t0: number;
};
export type Line = { id: number; from: number; to: number; path: number[]; hidden: Uint8Array; item: Item; items: number[]; built: number; dead: boolean };
export type Bot = { x: number; y: number; job: number; work: number };
export type Job = { id: number; kind: 'machine' | 'line' | 'repair'; target: number; workers: number };
export type Biter = { x: number; y: number; hp: number; target: number; alive: boolean; wave: number; bite: number; hx: number; hy: number; leaving: boolean; t0: number; killed: boolean };
export type Nest = { x: number; y: number; alive: boolean; attacks: number };
export type Fx = { kind: 'shot' | 'smoke' | 'spark' | 'fire' | 'boom' | 'crater' | 'rocket'; x: number; y: number; x1?: number; y1?: number; t0: number; dur: number };
export type Label = { text: string; x: number; y: number; t0: number; color: string };
export type Field = { name: string; ore: (typeof ORES)[number]; c: number; r: number };

export type FoundryOptions = { pace: number; camera?: string };

export type FoundryWorld = {
  t: number; W: number; H: number; GW: number; GH: number; T: number; cols: number; rows: number; bus: Bus; director: Director;
  name: string; cast: string[]; castIds: string[];
  /** 0 grass, 1 water, 2 burnt. */
  ground: Uint8Array; tree: Uint8Array; oreType: Uint8Array; oreAmt: Float32Array; occ: Int32Array;
  /** Bumped when the ground changes (ore mined out, trees felled or burnt). */
  groundVersion: number;
  fields: Field[];
  machines: Machine[]; lines: Line[]; bots: Bot[]; jobs: Job[]; biters: Biter[]; nests: Nest[]; fx: Fx[]; fires: Map<number, number>;
  stock: Record<'iron' | 'copper' | 'brick', number>;
  research: number; level: number; launches: number; power: number; made: number;
  pollution: Float32Array; pc: number; pcols: number; prows: number;
  hq: Machine; beltSpeed: number; day: number;
  labels: Label[]; chronicle: { t: number; text: string }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

type Ctx = { world: FoundryWorld; r: Rng; say(text: string, x: number, y: number, color?: string): void; emit(type: string, x: number, y: number, weight: number): void; chronicle(text: string): void; addField(ore: (typeof ORES)[number], c: number, r: number, rad: number, rich: number): void };

const LIBRARY: SystemDef<Ctx>[] = [
  {
    id: 'biters',
    label: 'biters',
    weight: 5,
    tags: ['threat'],
    create: (c) => {
      const w = c.world;
      const [hc, hr] = [w.hq.c + 2, w.hq.r + 2];
      for (let k = 0; k < 40 && w.nests.length < 3; k++) {
        const side = Math.floor(c.r() * 4);
        const tc = side === 0 ? 3 : side === 1 ? w.cols - 4 : Math.floor(c.r() * w.cols);
        const tr = side === 2 ? 3 : side === 3 ? w.rows - 4 : Math.floor(c.r() * w.rows);
        const i = tr * w.cols + tc;
        if (w.ground[i] !== 0 || Math.hypot(tc - hc, tr - hr) < Math.min(w.cols, w.rows) * 0.42) continue;
        if (w.nests.some((n) => Math.hypot(n.x - (tc + 0.5) * w.T, n.y - (tr + 0.5) * w.T) < 12 * w.T)) continue;
        w.nests.push({ x: (tc + 0.5) * w.T, y: (tr + 0.5) * w.T, alive: true, attacks: 0 });
      }
      return { id: 'biters' };
    },
  },
  {
    id: 'wildfire',
    label: 'wildfires',
    weight: 3,
    tags: ['weather'],
    create: (c) => ({
      id: 'wildfire',
      step() {
        const w = c.world;
        if (w.t < 120 || w.fires.size || !w.director.want('wildfire', 0.45, 260)) return;
        // Where the woods are thickest near the smoke.
        let best = -1;
        let score = -1;
        for (let k = 0; k < 300; k++) {
          const i = Math.floor(c.r() * w.cols * w.rows);
          if (!w.tree[i]) continue;
          const s = w.pollution[Math.floor(Math.floor(i / w.cols) / w.pc) * w.pcols + Math.floor((i % w.cols) / w.pc)] + c.r();
          if (s > score) {
            score = s;
            best = i;
          }
        }
        if (best < 0) return;
        w.fires.set(best, w.t);
        const x = ((best % w.cols) + 0.5) * w.T;
        const y = (Math.floor(best / w.cols) + 0.5) * w.T;
        c.say('FIRE IN THE WOODS', x, y - 20, '#fdba74');
        c.emit('wildfire', x, y, 0.5);
      },
    }),
  },
  {
    id: 'meteors',
    label: 'meteors',
    weight: 2,
    tags: ['wonder'],
    create: (c) => ({
      id: 'meteors',
      step() {
        const w = c.world;
        if (w.t < 300 || !w.director.want('meteor', 0.8, 700)) return;
        for (let k = 0; k < 60; k++) {
          const tc = 6 + Math.floor(c.r() * (w.cols - 12));
          const tr = 6 + Math.floor(c.r() * (w.rows - 12));
          const i = tr * w.cols + tc;
          if (w.ground[i] !== 0 || w.occ[i] !== -1 || w.oreType[i]) continue;
          const ore = c.r() < 0.6 ? 'iron-ore' : 'copper-ore';
          c.addField(ore, tc, tr, 3 + Math.floor(c.r() * 2), 2.5);
          const x = (tc + 0.5) * w.T;
          const y = (tr + 0.5) * w.T;
          w.fx.push({ kind: 'crater', x, y, t0: w.t, dur: 4 });
          c.say(`A METEOR FALLS, AND LEAVES ${ORE_NAME[ore]} IN ITS CRATER`, x, y - 24, '#fde68a');
          c.emit('meteor', x, y, 0.8);
          c.chronicle(`A meteor fell and left ${ORE_NAME[ore].toLowerCase()} in its crater.`);
          return;
        }
      },
    }),
  },
];
const RULE = { total: [1, 3] as [number, number], quota: { threat: [0, 1] as [number, number], weather: [0, 1] as [number, number] } };

export function createFoundry(seed: string | number, W: number, H: number, opts: FoundryOptions): FoundryWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'foundry');
  const shotR: Rng = forkRng(seed, 'foundry-shots');
  // eslint-disable-next-line prefer-const
  let world: FoundryWorld;
  const g: Genome = createGenome(seed, 'foundry');
  const noise = createNoise2D(forkRng(seed, 'foundry-noise'));
  const T = 16;
  const GW = Math.round(W * WORLD_SCALE);
  const GH = Math.round(H * WORLD_SCALE);
  const cols = Math.max(24, Math.floor(GW / T));
  const rows = Math.max(24, Math.floor(GH / T));
  const N = cols * rows;
  const pace = Math.max(0.3, Math.min(3, opts.pace));
  let ids = 1;
  const at = (c: number, rr: number) => rr * cols + c;
  const inb = (c: number, rr: number) => c >= 0 && rr >= 0 && c < cols && rr < rows;
  const pc = 5;
  const pcols = Math.ceil(cols / pc);
  const prows = Math.ceil(rows / pc);

  world = {
    t: 0, W, H, GW: cols * T, GH: rows * T, T, cols, rows, bus,
    director: createDirector(forkRng(seed, 'foundry-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    name: g.pick(PLANETS), cast: [], castIds: [],
    ground: new Uint8Array(N), tree: new Uint8Array(N), oreType: new Uint8Array(N), oreAmt: new Float32Array(N), occ: new Int32Array(N).fill(-1), groundVersion: 0,
    fields: [], machines: [], lines: [], bots: [], jobs: [], biters: [], nests: [], fx: [], fires: new Map(),
    stock: { iron: 160, copper: 70, brick: 30 },
    research: 0, level: 0, launches: 0, power: 1, made: 0,
    pollution: new Float32Array(pcols * prows), pc, pcols, prows,
    hq: null as unknown as Machine, beltSpeed: 1.8, day: g.range(0.25, 0.4),
    labels: [], chronicle: [],
    step, nudge,
    counts: () => ({
      machines: world.machines.filter((m) => m.state === 'work').length,
      lines: world.lines.filter((l) => !l.dead).length,
      items: world.lines.reduce((s, l) => s + l.items.length, 0),
      level: world.level,
      launches: world.launches,
      bots: world.bots.length,
      biters: world.biters.filter((b) => b.alive).length,
    }),
  };

  /** A quiet shot for a camera that follows: a busy machine up close, or the headquarters. Its own rng, so the factory grows the same. */
  function establish(): { x: number; y: number; zoom: number } {
    if (!world?.hq) return { x: (cols * T) / 2, y: (rows * T) / 2, zoom: 1 };
    const busy = world.machines.filter((m) => m.state === 'work' && m.kind !== 'turret');
    const m = busy[Math.floor(shotR() * busy.length)] ?? world.hq;
    return { x: (m.c + m.n / 2) * T, y: (m.r + m.n / 2) * T, zoom: 1.9 + shotR() * 0.6 };
  }
  const say = (text: string, x: number, y: number, color = '#e7e5e4') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    world.labels.push({ text, x, y, t0: world.t, color });
    if (world.labels.length > 6) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, priority: 'high' });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };
  const cx = (m: Machine) => (m.c + m.n / 2) * T;
  const cy = (m: Machine) => (m.r + m.n / 2) * T;

  // ---- the land ----------------------------------------------------------------------------------
  const lakes = g.range(0.3, 0.42);
  const woods = g.range(0.1, 0.35);
  const f1 = g.range(0.022, 0.04);
  for (let rr = 0; rr < rows; rr++)
    for (let c = 0; c < cols; c++) {
      const i = at(c, rr);
      const e = noise.fbm2(c * f1 + 300, rr * f1 - 120, 3);
      if (e < -lakes) world.ground[i] = 1;
      else if (noise.fbm2(c * 0.11 + 40, rr * 0.11 - 17, 3) > woods) world.tree[i] = 1;
    }
  const fieldName = (c: number, rr: number, ore: (typeof ORES)[number]) => {
    const dx = c / cols - 0.5;
    const dy = rr / rows - 0.5;
    const dir = Math.hypot(dx, dy) < 0.15 ? 'CENTRAL' : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'WEST' : 'EAST') : dy < 0 ? 'NORTH' : 'SOUTH';
    return `THE ${dir} ${ORE_NAME[ore]} FIELD`;
  };
  function addField(ore: (typeof ORES)[number], c0: number, r0: number, rad: number, rich: number) {
    for (let rr = r0 - rad - 1; rr <= r0 + rad + 1; rr++)
      for (let c = c0 - rad - 1; c <= c0 + rad + 1; c++) {
        if (!inb(c, rr)) continue;
        const d = Math.hypot(c - c0, (rr - r0) * 1.1) / rad + (noise.noise2(c * 0.4, rr * 0.4) * 0.35);
        const i = at(c, rr);
        if (d > 1 || world.ground[i] === 1 || world.occ[i] !== -1) continue;
        world.oreType[i] = ORES.indexOf(ore) + 1;
        world.oreAmt[i] = (35 + (1 - d) * 70) * rich;
        world.tree[i] = 0;
      }
    world.fields.push({ name: fieldName(c0, r0, ore), ore, c: c0, r: r0 });
    world.groundVersion++;
  }
  // The headquarters: dry, open ground near the middle.
  let hc = Math.floor(cols / 2) - 2;
  let hr = Math.floor(rows / 2) - 2;
  for (let k = 0; k < 400; k++) {
    const c = Math.floor(cols * (0.3 + r() * 0.4));
    const rr = Math.floor(rows * (0.3 + r() * 0.4));
    let ok = true;
    for (let dy = -1; dy < 5 && ok; dy++) for (let dx = -1; dx < 5 && ok; dx++) ok = inb(c + dx, rr + dy) && world.ground[at(c + dx, rr + dy)] === 0;
    if (ok) {
      hc = c;
      hr = rr;
      break;
    }
  }
  for (let dy = -1; dy < 5; dy++) for (let dx = -1; dx < 5; dx++) if (inb(hc + dx, hr + dy)) world.ground[at(hc + dx, hr + dy)] = 0;
  // Ore fields: some of each, nearer and farther, none on the headquarters.
  const scaleN = Math.max(0.5, Math.min(1.4, (cols * rows) / 6000));
  const counts: Record<(typeof ORES)[number], number> = { 'iron-ore': g.int(3, 5), 'copper-ore': g.int(2, 4), coal: g.int(1, 3), stone: g.int(1, 2) };
  for (const ore of ORES) {
    const n = Math.max(1, Math.round(counts[ore] * scaleN));
    for (let k = 0, made = 0; k < 200 && made < n; k++) {
      const c = 3 + Math.floor(r() * (cols - 6));
      const rr = 3 + Math.floor(r() * (rows - 6));
      const d = Math.hypot(c - hc - 2, rr - hr - 2);
      // The first of each kind close by, so the factory can start.
      if (made === 0 && d > Math.min(cols, rows) * 0.38) continue;
      if (d < 7 || world.ground[at(c, rr)] === 1 || world.oreType[at(c, rr)]) continue;
      if (world.fields.some((f) => Math.hypot(f.c - c, f.r - rr) < 9)) continue;
      addField(ore, c, rr, 3 + Math.floor(r() * 4), g.range(0.8, 1.3));
      made++;
    }
  }

  // ---- machines and belts --------------------------------------------------------------------------
  const free = (c: number, rr: number, n: number, margin = 0) => {
    for (let dy = -margin; dy < n + margin; dy++)
      for (let dx = -margin; dx < n + margin; dx++) {
        const x = c + dx;
        const y = rr + dy;
        if (!inb(x, y)) return false;
        const i = at(x, y);
        const inside = dx >= 0 && dy >= 0 && dx < n && dy < n;
        if (world.ground[i] === 1 || world.fires.has(i)) return false;
        if (inside ? world.occ[i] !== -1 : world.occ[i] >= 0) return false;
      }
    return true;
  };
  const machineAt = (i: number) => (world.occ[i] >= 0 ? world.machines[world.occ[i]] ?? null : null);
  function place(kind: Kind, c: number, rr: number, extra: Partial<Machine> = {}): Machine {
    const n = SIZE[kind];
    const m: Machine = {
      id: world.machines.length, kind, c, r: rr, n, state: 'ghost', build: 0, recipe: null, ore: null, inBuf: {}, outBuf: 0, busy: false, craft: 0,
      hp: 100, outLine: -1, inLines: [], boost: 0, fuel: 0, parts: 0, field: '', t0: world.t, ...extra,
    };
    world.machines.push(m);
    for (let dy = 0; dy < n; dy++)
      for (let dx = 0; dx < n; dx++) {
        const i = at(c + dx, rr + dy);
        world.occ[i] = m.id;
        if (world.tree[i]) {
          world.tree[i] = 0;
          world.groundVersion++;
        }
      }
    return m;
  }
  const hq = place('hq', hc, hr, { state: 'work', build: 1 });
  world.hq = hq;

  /** A belt route between two machines: cheapest over open ground, under other belts where it must cross. */
  const beltUse = new Uint8Array(N);
  function route(a: Machine, b: Machine): { path: number[]; hidden: Uint8Array } | null {
    const ring = (m: Machine) => {
      const out: number[] = [];
      for (let k = 0; k < m.n; k++)
        for (const [x, y] of [[m.c + k, m.r - 1], [m.c + k, m.r + m.n], [m.c - 1, m.r + k], [m.c + m.n, m.r + k]]) {
          if (!inb(x, y)) continue;
          const i = at(x, y);
          if (world.ground[i] !== 1 && world.occ[i] === -1) out.push(i);
        }
      return out;
    };
    const starts = ring(a);
    const goals = new Set(ring(b));
    if (!starts.length || !goals.size) return null;
    const cost = new Int32Array(N).fill(1 << 30);
    const prev = new Int32Array(N).fill(-1);
    const buckets: number[][] = [];
    for (const s of starts) {
      cost[s] = 0;
      (buckets[0] ??= []).push(s);
    }
    let found = -1;
    const limit = 2400;
    for (let d = 0; d < limit && found < 0; d++) {
      const bucket = buckets[d];
      if (!bucket) continue;
      for (const i of bucket) {
        if (cost[i] !== d) continue;
        if (goals.has(i)) {
          found = i;
          break;
        }
        const c = i % cols;
        const rr = (i - c) / cols;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = c + dx;
          const y = rr + dy;
          if (!inb(x, y)) continue;
          const j = at(x, y);
          if (world.ground[j] === 1 || world.occ[j] >= 0 || world.fires.has(j)) continue;
          const step = world.occ[j] === -2 ? 9 : world.tree[j] ? 3 : world.oreType[j] ? 3 : 2;
          const nd = d + step;
          if (nd >= cost[j] || nd >= limit) continue;
          cost[j] = nd;
          prev[j] = i;
          (buckets[nd] ??= []).push(j);
        }
      }
    }
    if (found < 0) return null;
    const path: number[] = [];
    for (let i = found; i >= 0; i = prev[i]) path.push(i);
    path.reverse();
    if (path.length > 200) return null;
    // A route may not start or end under another belt.
    if (world.occ[path[0]] === -2 || world.occ[path[path.length - 1]] === -2) return null;
    const hidden = new Uint8Array(path.length);
    path.forEach((i, k) => (hidden[k] = world.occ[i] === -2 ? 1 : 0));
    return { path, hidden };
  }
  function lay(from: Machine, to: Machine, item: Item, pathed: { path: number[]; hidden: Uint8Array }): Line {
    const l: Line = { id: world.lines.length, from: from.id, to: to.id, path: pathed.path, hidden: pathed.hidden, item, items: [], built: 0, dead: false };
    world.lines.push(l);
    for (const i of l.path) {
      world.occ[i] = -2;
      beltUse[i]++;
      if (world.tree[i]) {
        world.tree[i] = 0;
        world.groundVersion++;
      }
    }
    from.outLine = l.id;
    to.inLines.push(l.id);
    world.jobs.push({ id: ids++, kind: 'line', target: l.id, workers: 0 });
    return l;
  }
  function unlay(l: Line) {
    if (l.dead) return;
    l.dead = true;
    l.items = [];
    for (const i of l.path) {
      beltUse[i] = Math.max(0, beltUse[i] - 1);
      if (!beltUse[i] && world.occ[i] === -2) world.occ[i] = -1;
    }
    const to = world.machines[l.to];
    to.inLines = to.inLines.filter((x) => x !== l.id);
    const from = world.machines[l.from];
    if (from.outLine === l.id) from.outLine = -1;
  }
  function remove(m: Machine) {
    m.state = 'gone';
    for (let dy = 0; dy < m.n; dy++) for (let dx = 0; dx < m.n; dx++) world.occ[at(m.c + dx, m.r + dy)] = -1;
    if (m.outLine >= 0) unlay(world.lines[m.outLine]);
    for (const id of [...m.inLines]) unlay(world.lines[id]);
  }
  const afford = (cost: Partial<Record<'iron' | 'copper' | 'brick', number>>, extra = 0) =>
    (world.stock.iron >= (cost.iron ?? 0) + extra) && world.stock.copper >= (cost.copper ?? 0) && (world.stock.brick >= (cost.brick ?? 0) || (cost.brick ?? 0) === 0 || world.stock.iron >= (cost.iron ?? 0) + extra + (cost.brick ?? 0) * 2);
  const pay = (cost: Partial<Record<'iron' | 'copper' | 'brick', number>>, extra = 0) => {
    world.stock.iron -= (cost.iron ?? 0) + extra;
    world.stock.copper -= cost.copper ?? 0;
    const b = cost.brick ?? 0;
    // No bricks yet: iron stands in.
    if (world.stock.brick >= b) world.stock.brick -= b;
    else world.stock.iron -= b * 2;
  };

  /** An n × n spot near (c, r): open, dry, a tile clear around it for belts. */
  function spotNear(n: number, c0: number, r0: number, maxR = 22, avoidOre = true): [number, number] | null {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let k = 0; k < 260; k++) {
      const a = r() * Math.PI * 2;
      const d = 2 + Math.sqrt(r()) * maxR;
      const c = Math.round(c0 + Math.cos(a) * d - n / 2);
      const rr = Math.round(r0 + Math.sin(a) * d - n / 2);
      if (!free(c, rr, n, 1)) continue;
      let ore = 0;
      if (avoidOre) for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) ore += world.oreType[at(c + dx, rr + dy)] ? 1 : 0;
      const s = d + ore * 3;
      if (s < bd) {
        bd = s;
        best = [c, rr];
      }
    }
    return best;
  }
  /** A miner's spot: on ore of the kind, nearest to (c, r). */
  function mineSpot(ore: Item, c0: number, r0: number, near?: [number, number]): [number, number] | null {
    const kind = ORES.indexOf(ore as (typeof ORES)[number]) + 1;
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      if (world.oreType[i] !== kind) continue;
      const c = i % cols;
      const rr = (i - c) / cols;
      if (near && Math.hypot(c - near[0], rr - near[1]) > 8) continue;
      const d = Math.hypot(c - c0, rr - r0) + (r() - 0.5) * 3;
      if (d >= bd) continue;
      if (!free(c, rr, 2, 0)) continue;
      let n = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (world.oreType[at(c + dx, rr + dy)] === kind) n++;
      if (n < 3) continue;
      // A tile clear on at least one side, for the belt.
      bd = d;
      best = [c, rr];
    }
    return best;
  }

  /** Build what `consumer` needs of `item`: the maker beside it (or a miner on a field) and the belt between. */
  function supply(item: Item, consumer: Machine): boolean {
    const mk = MAKER[item];
    const n = SIZE[mk.kind];
    const cost = COST[mk.kind];
    const ccx = consumer.c + consumer.n / 2;
    const ccy = consumer.r + consumer.n / 2;
    const spot = mk.kind === 'miner' ? mineSpot(item, ccx, ccy) : spotNear(n, ccx, ccy, consumer.kind === 'hq' ? 16 : 10);
    if (!spot) return false;
    const est = Math.hypot(spot[0] - ccx, spot[1] - ccy) * 1.3 * BELT_COST;
    if (!afford(cost, est)) return false;
    const m = place(mk.kind, spot[0], spot[1], { recipe: mk.recipe, ore: mk.kind === 'miner' ? item : null });
    const p = route(m, consumer);
    if (!p) {
      remove(m);
      world.machines.pop();
      return false;
    }
    pay(cost, p.path.length * BELT_COST);
    if (mk.kind === 'miner') {
      const f = world.fields.filter((x) => x.ore === item).sort((a, b) => Math.hypot(a.c - spot[0], a.r - spot[1]) - Math.hypot(b.c - spot[0], b.r - spot[1]))[0];
      m.field = f?.name ?? '';
    }
    world.jobs.push({ id: ids++, kind: 'machine', target: m.id, workers: 0 });
    lay(m, consumer, item, p);
    return true;
  }
  /** A new consumer (a lab, the silo, a boiler, a turret) somewhere near the headquarters. */
  function raise(kind: Kind, recipe: string | null, near: [number, number] = [hq.c + 2, hq.r + 2], maxR = 24): Machine | null {
    if (!afford(COST[kind])) return null;
    const spot = spotNear(SIZE[kind], near[0], near[1], maxR);
    if (!spot) return null;
    pay(COST[kind]);
    const m = place(kind, spot[0], spot[1], { recipe });
    world.jobs.push({ id: ids++, kind: 'machine', target: m.id, workers: 0 });
    return m;
  }
  const live = (kind?: Kind) => world.machines.filter((m) => (m.state === 'work' || m.state === 'ghost' || m.state === 'ruin') && (!kind || m.kind === kind));
  const hqLines = (item: Item) => world.lines.filter((l) => !l.dead && l.to === hq.id && l.item === item).length;
  const missing = (m: Machine): Item | null => {
    const rec = m.recipe ? RECIPES[m.recipe] : null;
    if (!rec) return null;
    for (const it of Object.keys(rec.in) as Item[]) if (!m.inLines.some((id) => !world.lines[id].dead && world.lines[id].item === it)) return it;
    return null;
  };

  // ---- the plan: one step at a time ----------------------------------------------------------------
  let attacks = 0;
  let lastAttackAt: [number, number] | null = null;
  function plan() {
    const L = world.level;
    // Ore gone from under a miner: take it down (its consumer will want another).
    const dry = world.machines.find((m) => m.state === 'work' && m.kind === 'miner' && m.ore && !oreUnder(m));
    if (dry) {
      say(`${dry.field || 'A FIELD'} RUNS DRY UNDER A MINER`, cx(dry), cy(dry) - 20, '#a8a29e');
      emit('depleted', cx(dry), cy(dry), 0.25);
      remove(dry);
      return;
    }
    // The headquarters' own supply comes first: everything is paid for from it.
    for (const [it, n] of [['iron', 3], ['copper', 2]] as [Item, number][]) if (hqLines(it) < n && supply(it, hq)) return;
    // Power to keep up with the machines.
    const demand = live().filter((m) => m.kind !== 'hq' && m.kind !== 'boiler' && m.kind !== 'turret').length;
    if (live('boiler').length * 12 + 10 < demand) {
      const water = waterSpot();
      if (raise('boiler', 'power', water ?? [hq.c + 2, hq.r + 2], water ? 6 : 20)) return;
    }
    // Whatever is missing an input gets a supplier.
    for (const m of world.machines) {
      if (m.state !== 'work' && m.state !== 'ghost') continue;
      const it = missing(m);
      if (it && supply(it, m)) return;
    }
    // Turrets toward where the biters came from.
    if (lastAttackAt && live('turret').length < Math.min(10, attacks * 2)) {
      if (raise('turret', null, lastAttackAt, 5)) return;
    }
    // More of the headquarters' supply as the factory grows.
    for (const [it, n] of [['iron', 3 + Math.floor(L / 2)], ['copper', 2 + Math.floor(L / 3)], ['brick', L >= 1 ? 1 : 0]] as [Item, number][]) if (hqLines(it) < n && supply(it, hq)) return;
    // Labs: research. Iron to spare pays for more of them, and every lab pulls a supply chain behind it.
    const spare = Math.floor(Math.max(0, world.stock.iron - 150) / 120);
    if (live('lab').length < Math.min(16, 1 + Math.floor(L * 0.8) + spare) && raise('lab', 'science')) return;
    // The silo.
    if (L >= 7 && !live('silo').length) {
      const s = raise('silo', 'rocket', [hq.c + 2, hq.r + 2], 30);
      if (s) {
        say('WORK BEGINS ON A ROCKET SILO', cx(s), cy(s) - 30, '#fde68a');
        emit('silo', cx(s), cy(s), 0.7);
        chronicle('Work began on a rocket silo.');
      }
    }
  }
  function waterSpot(): [number, number] | null {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let i = 0; i < N; i += 3) {
      if (world.ground[i] !== 1) continue;
      const c = i % cols;
      const rr = (i - c) / cols;
      const d = Math.hypot(c - hq.c, rr - hq.r);
      if (d < bd) {
        bd = d;
        best = [c, rr];
      }
    }
    return best;
  }
  function oreUnder(m: Machine) {
    const kind = ORES.indexOf(m.ore as (typeof ORES)[number]) + 1;
    for (let dy = 0; dy < m.n; dy++) for (let dx = 0; dx < m.n; dx++) if (world.oreType[at(m.c + dx, m.r + dy)] === kind && world.oreAmt[at(m.c + dx, m.r + dy)] > 0) return true;
    return false;
  }

  // ---- production -----------------------------------------------------------------------------------
  const firsts = new Set<string>();
  function produce(m: Machine, dt: number) {
    const speed = dt * Math.max(0.25, world.power) * (m.boost > world.t ? 2 : 1) * pace;
    if (m.kind === 'miner') {
      if (m.outBuf >= CAP) return;
      m.craft += speed / 1.8;
      if (m.craft < 1) return;
      m.craft = 0;
      const kind = ORES.indexOf(m.ore as (typeof ORES)[number]) + 1;
      for (let dy = 0; dy < m.n; dy++)
        for (let dx = 0; dx < m.n; dx++) {
          const i = at(m.c + dx, m.r + dy);
          if (world.oreType[i] !== kind || world.oreAmt[i] <= 0) continue;
          world.oreAmt[i] -= 1;
          if (world.oreAmt[i] <= 0) {
            world.oreType[i] = 0;
            world.groundVersion++;
          }
          m.outBuf++;
          return;
        }
      return;
    }
    const rec = m.recipe ? RECIPES[m.recipe] : null;
    if (!rec) return;
    if (!m.busy) {
      if (rec.out !== 'research' && rec.out !== 'part' && rec.out !== 'power' && m.outBuf >= CAP) return;
      if (rec.out === 'power' && m.fuel > 3) return;
      for (const [it, n] of Object.entries(rec.in) as [Item, number][]) if ((m.inBuf[it] ?? 0) < n) return;
      for (const [it, n] of Object.entries(rec.in) as [Item, number][]) m.inBuf[it] = (m.inBuf[it] ?? 0) - n;
      m.busy = true;
      m.craft = 0;
      if (rec.out === 'power') {
        m.fuel += rec.time;
        m.busy = false;
      }
      return;
    }
    m.craft += speed / rec.time;
    if (m.craft < 1) return;
    m.busy = false;
    m.craft = 0;
    world.made++;
    if (rec.out === 'research') {
      world.research++;
      const cost = 18 + world.level * 14;
      if (world.research >= cost) {
        world.research -= cost;
        const name = TECHS[world.level] ?? `MINING PRODUCTIVITY ${world.level - TECHS.length + 1}`;
        world.level++;
        if (world.level === 4) world.beltSpeed = 3;
        if (world.level === 9) world.beltSpeed = 4.4;
        say(`RESEARCH COMPLETE: ${name}`, cx(m), cy(m) - 30, '#93c5fd');
        emit('research', cx(m), cy(m), 0.5);
        chronicle(`Research complete: ${name.charAt(0)}${name.slice(1).toLowerCase()}.`);
      }
      return;
    }
    if (rec.out === 'part') {
      m.parts++;
      if (m.parts >= 40) {
        m.parts = 0;
        world.launches++;
        world.fx.push({ kind: 'rocket', x: cx(m), y: cy(m), t0: world.t, dur: 12 });
        say(world.launches === 1 ? 'THE FIRST ROCKET LAUNCHES' : `ROCKET ${world.launches} LAUNCHES`, cx(m), cy(m) - 40, '#fde68a');
        emit('launch', cx(m), cy(m), 1);
        chronicle(world.launches === 1 ? 'The first rocket launched.' : `Rocket ${world.launches} launched.`);
        world.director.look('launch', cx(m), cy(m), 1.5, 12, 8);
      }
      return;
    }
    m.outBuf++;
    for (const n of [100, 1000, 5000, 20000, 100000]) if (world.made === n) {
      say(`THE FACTORY HAS MADE ${n.toLocaleString('en-US')} THINGS`, cx(hq), cy(hq) - 40, '#fde68a');
      emit('milestone', cx(hq), cy(hq), 0.4);
      chronicle(`The factory made its ${n.toLocaleString('en-US')}th thing.`);
    }
    if ((rec.out === 'gear' || rec.out === 'circuit') && !firsts.has(rec.out)) {
      firsts.add(rec.out);
      say(rec.out === 'gear' ? 'THE FIRST GEAR' : 'THE FIRST CIRCUIT', cx(m), cy(m) - 24, '#fde68a');
      emit(rec.out === 'gear' ? 'firstgear' : 'firstcircuit', cx(m), cy(m), 0.4);
    }
  }

  function belts(dt: number) {
    for (const l of world.lines) {
      if (l.dead || l.built < l.path.length) continue;
      const src = world.machines[l.from];
      const dst = world.machines[l.to];
      const end = l.path.length - 0.5;
      let limit = end;
      const v = world.beltSpeed * dt * pace;
      for (let k = 0; k < l.items.length; k++) {
        l.items[k] = Math.min(l.items[k] + v, limit);
        limit = l.items[k] - SPACING;
      }
      if (l.items.length && l.items[0] >= end - 1e-6 && dst.state === 'work') {
        if (dst.kind === 'hq') {
          if (l.item === 'iron' || l.item === 'copper' || l.item === 'brick') world.stock[l.item]++;
          l.items.shift();
        } else if ((dst.inBuf[l.item] ?? 0) < CAP) {
          dst.inBuf[l.item] = (dst.inBuf[l.item] ?? 0) + 1;
          l.items.shift();
        }
      }
      if (src.state === 'work' && src.outBuf > 0 && (!l.items.length || l.items[l.items.length - 1] >= SPACING)) {
        l.items.push(0);
        src.outBuf--;
      }
    }
  }

  // ---- bots -----------------------------------------------------------------------------------------
  function jobAt(j: Job): [number, number] | null {
    if (j.kind === 'line') {
      const l = world.lines[j.target];
      if (l.dead || l.built >= l.path.length) return null;
      const i = l.path[Math.floor(l.built)];
      return [((i % cols) + 0.5) * T, (Math.floor(i / cols) + 0.5) * T];
    }
    const m = world.machines[j.target];
    if (m.state === 'gone' || (j.kind === 'machine' && m.state !== 'ghost') || (j.kind === 'repair' && m.state !== 'ruin')) return null;
    return [cx(m), cy(m)];
  }
  function botsStep(dt: number) {
    const want = Math.min(24, 5 + world.level * 2);
    while (world.bots.length < want) world.bots.push({ x: cx(hq), y: cy(hq), job: -1, work: 0 });
    world.jobs = world.jobs.filter((j) => jobAt(j) !== null);
    for (const j of world.jobs) j.workers = 0;
    for (const b of world.bots) if (b.job >= 0) {
      const j = world.jobs.find((x) => x.id === b.job);
      if (j) j.workers++;
      else b.job = -1;
    }
    for (const [bi, b] of world.bots.entries()) {
      if (b.job < 0) {
        const j = world.jobs.filter((x) => x.workers < (x.kind === 'line' ? 2 : 3)).sort((p, q) => {
          const a = jobAt(p)!;
          const c = jobAt(q)!;
          return Math.hypot(a[0] - b.x, a[1] - b.y) - Math.hypot(c[0] - b.x, c[1] - b.y);
        })[0];
        if (j) {
          b.job = j.id;
          j.workers++;
        }
      }
      const j = b.job >= 0 ? world.jobs.find((x) => x.id === b.job) : null;
      const tgt = j ? jobAt(j) : [cx(hq) + Math.cos(world.t * 0.5 + bi * 1.3) * (26 + (bi % 3) * 8), cy(hq) + Math.sin(world.t * 0.5 + bi * 1.3) * (26 + (bi % 3) * 8)];
      if (!tgt) {
        b.job = -1;
        continue;
      }
      const d = Math.hypot(tgt[0] - b.x, tgt[1] - b.y);
      const v = 170 * dt * pace;
      if (d > 6) {
        b.x += ((tgt[0] - b.x) / d) * Math.min(d, v);
        b.y += ((tgt[1] - b.y) / d) * Math.min(d, v);
        continue;
      }
      if (!j) continue;
      if (j.kind === 'line') {
        const l = world.lines[j.target];
        l.built = Math.min(l.path.length, l.built + dt * 6 * pace);
        if (l.built >= l.path.length) {
          b.job = -1;
          const [ex, ey] = [((l.path[l.path.length - 1] % cols) + 0.5) * T, (Math.floor(l.path[l.path.length - 1] / cols) + 0.5) * T];
          emit('belt', ex, ey, 0.08);
        }
      } else {
        const m = world.machines[j.target];
        m.build = Math.min(1, m.build + (dt * pace) / (m.n * m.n * 0.5));
        if (r() < dt * 4) world.fx.push({ kind: 'spark', x: cx(m) + (r() - 0.5) * m.n * T, y: cy(m) + (r() - 0.5) * m.n * T, t0: world.t, dur: 0.4 });
        if (m.build >= 1) {
          const repaired = m.state === 'ruin';
          m.state = 'work';
          m.hp = 100;
          b.job = -1;
          if (repaired) {
            say(`THE ${m.kind.toUpperCase()} IS REBUILT`, cx(m), cy(m) - 20, '#bbf7d0');
            emit('rebuilt', cx(m), cy(m), 0.3);
          } else {
            emit('built', cx(m), cy(m), m.kind === 'lab' || m.kind === 'silo' ? 0.4 : 0.12);
            if (m.kind === 'lab' && live('lab').filter((x) => x.state === 'work').length === 1) say('THE FIRST LAB IS BUILT; RESEARCH BEGINS', cx(m), cy(m) - 24, '#93c5fd');
            else if (m.kind === 'silo') say('THE ROCKET SILO STANDS', cx(m), cy(m) - 40, '#fde68a');
            else if (m.kind === 'boiler') say('A BOILER BY THE WATER: MORE POWER', cx(m), cy(m) - 24, '#fde68a');
            else if (m.kind === 'miner' && r() < 0.35) say(`A NEW MINE ON ${m.field}`, cx(m), cy(m) - 20, '#e7e5e4');
          }
        }
      }
    }
  }

  // ---- pollution, biters, turrets, fire -----------------------------------------------------------
  let nextPollute = 0;
  function pollute() {
    if (world.t < nextPollute) return;
    nextPollute = world.t + 1;
    const p = world.pollution;
    for (const m of world.machines) {
      if (m.state !== 'work') continue;
      const add = m.kind === 'boiler' ? 3 : m.kind === 'furnace' ? 2 : m.kind === 'miner' ? 1 : 0.4;
      p[Math.floor((m.r + 1) / pc) * pcols + Math.floor((m.c + 1) / pc)] += add * 0.15 * pace;
    }
    const next = new Float32Array(p.length);
    for (let y = 0; y < prows; y++)
      for (let x = 0; x < pcols; x++) {
        const i = y * pcols + x;
        let s = 0;
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (x + dx < 0 || y + dy < 0 || x + dx >= pcols || y + dy >= prows) continue;
          s += p[i + dy * pcols + dx];
          n++;
        }
        next[i] = (p[i] * 0.86 + (s / Math.max(1, n)) * 0.12) * 0.995;
      }
    world.pollution = next;
  }
  let wave = 0;
  function biters(dt: number) {
    for (const n of world.nests) {
      if (!n.alive) continue;
      const cell = Math.floor(n.y / T / pc) * pcols + Math.floor(n.x / T / pc);
      if (world.pollution[cell] < 0.35 || world.biters.some((b) => b.alive)) continue;
      if (!world.director.want('attack', 0.6, 100)) continue;
      const prey = world.machines.filter((m) => m.state === 'work' && m.kind !== 'turret').sort((a, b) => Math.hypot(cx(a) - n.x, cy(a) - n.y) - Math.hypot(cx(b) - n.x, cy(b) - n.y))[0];
      if (!prey) continue;
      wave++;
      attacks++;
      n.attacks++;
      const count = Math.min(16, 4 + Math.floor(r() * 5) + world.level);
      for (let k = 0; k < count; k++) world.biters.push({ x: n.x + (r() - 0.5) * 40, y: n.y + (r() - 0.5) * 40, hp: 22 + world.level * 3, target: prey.id, alive: true, wave, bite: 0, hx: n.x, hy: n.y, leaving: false, t0: world.t, killed: false });
      lastAttackAt = [Math.round((prey.c * 2 + n.x / T) / 3), Math.round((prey.r * 2 + n.y / T) / 3)];
      say('BITERS COME OUT OF THE NEST', n.x, n.y - 20, '#c084fc');
      emit('attack', n.x, n.y, 0.7);
      world.director.look('attack', (n.x + cx(prey)) / 2, (n.y + cy(prey)) / 2, 1.3, 14, 6);
    }
    const alive = world.biters.filter((b) => b.alive);
    for (const b of alive) {
      // Fed, or tired of it: home to the nest.
      if (b.leaving || world.t - b.t0 > 50) {
        b.leaving = true;
        const d = Math.hypot(b.hx - b.x, b.hy - b.y);
        if (d < 12) b.alive = false;
        else {
          b.x += ((b.hx - b.x) / d) * 34 * dt * pace;
          b.y += ((b.hy - b.y) / d) * 34 * dt * pace;
        }
        continue;
      }
      let m = world.machines[b.target];
      if (!m || m.state !== 'work') {
        m = world.machines.filter((x) => x.state === 'work').sort((a, c) => Math.hypot(cx(a) - b.x, cy(a) - b.y) - Math.hypot(cx(c) - b.x, cy(c) - b.y))[0];
        if (!m) continue;
        b.target = m.id;
      }
      const d = Math.hypot(cx(m) - b.x, cy(m) - b.y);
      if (d > m.n * T * 0.55) {
        const a = Math.atan2(cy(m) - b.y, cx(m) - b.x) + Math.sin(world.t * 2 + b.hp) * 0.3;
        const nx = b.x + Math.cos(a) * 30 * dt * pace;
        const ny = b.y + Math.sin(a) * 30 * dt * pace;
        const i = at(Math.floor(nx / T), Math.floor(ny / T));
        if (i >= 0 && i < N && world.ground[i] !== 1) {
          b.x = nx;
          b.y = ny;
        } else b.x += Math.cos(a + 1.5) * 30 * dt;
      } else {
        b.bite += dt;
        m.hp -= dt * 9 * pace;
        if (m.hp <= 0 && m.state === 'work') {
          m.state = 'ruin';
          m.build = 0;
          m.busy = false;
          world.fx.push({ kind: 'boom', x: cx(m), y: cy(m), t0: world.t, dur: 1.5 });
          say(`BITERS WRECK THE ${m.kind.toUpperCase()}`, cx(m), cy(m) - 20, '#fca5a5');
          emit('destroyed', cx(m), cy(m), 0.7);
          world.jobs.push({ id: ids++, kind: 'repair', target: m.id, workers: 0 });
          for (const o of world.biters) if (o.wave === b.wave) o.leaving = true;
        }
      }
    }
    // Turrets.
    for (const tu of world.machines) {
      if (tu.kind !== 'turret' || tu.state !== 'work') continue;
      tu.craft -= dt * pace;
      if (tu.craft > 0) continue;
      const b = alive.filter((x) => x.alive && Math.hypot(x.x - cx(tu), x.y - cy(tu)) < 8 * T).sort((p, q) => Math.hypot(p.x - cx(tu), p.y - cy(tu)) - Math.hypot(q.x - cx(tu), q.y - cy(tu)))[0];
      if (!b) continue;
      tu.craft = 0.35;
      b.hp -= 9;
      world.fx.push({ kind: 'shot', x: cx(tu), y: cy(tu), x1: b.x, y1: b.y, t0: world.t, dur: 0.12 });
      if (b.hp <= 0) {
        b.alive = false;
        b.killed = true;
      }
    }
    const waves = new Set(world.biters.filter((b) => !b.alive).map((b) => b.wave));
    for (const wv of waves) {
      if (world.biters.some((b) => b.wave === wv && b.alive)) continue;
      const lost = world.biters.filter((b) => b.wave === wv);
      world.biters = world.biters.filter((b) => b.wave !== wv);
      const x = lost[0].x;
      const y = lost[0].y;
      if (lost.every((b) => b.killed)) {
        say('THE TURRETS HOLD; THE BITERS ARE DEAD', x, y - 20, '#bbf7d0');
        emit('repelled', x, y, 0.5);
      } else {
        say('THE BITERS GO BACK TO THEIR NEST', lost[0].hx, lost[0].hy - 20, '#c084fc');
        emit('retreat', lost[0].hx, lost[0].hy, 0.3);
      }
    }
  }
  function fire(dt: number) {
    for (const [i, t0] of [...world.fires]) {
      if (world.t - t0 > 5) {
        world.fires.delete(i);
        world.tree[i] = 0;
        world.ground[i] = 2;
        world.groundVersion++;
        continue;
      }
      if (r() < dt * 0.9) {
        const c = i % cols;
        const rr = (i - c) / cols;
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
        const j = at(c + dx, rr + dy);
        if (inb(c + dx, rr + dy) && world.tree[j] && !world.fires.has(j) && world.fires.size < 160) world.fires.set(j, world.t);
      }
    }
  }

  /** A touch: on a field, a new mine for the headquarters; on a machine, overtime. */
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 3) return null;
    const c = Math.floor(x / T);
    const rr = Math.floor(y / T);
    if (!inb(c, rr)) return null;
    const i = at(c, rr);
    const m = machineAt(i);
    if (m && m.state === 'work' && m.kind !== 'hq') {
      lastNudge = world.t;
      m.boost = world.t + 20;
      for (let k = 0; k < 6; k++) world.fx.push({ kind: 'spark', x: cx(m) + (r() - 0.5) * m.n * T, y: cy(m) + (r() - 0.5) * m.n * T, t0: world.t + k * 0.1, dur: 0.5 });
      const text = `OVERTIME AT THE ${m.kind.toUpperCase()}`;
      say(text, cx(m), cy(m) - 24, '#fde68a');
      emit('nudge', cx(m), cy(m), 0.3);
      return text;
    }
    const ore = world.oreType[i];
    if (ore) {
      const item = ORES[ore - 1];
      const plate: Item = item === 'iron-ore' ? 'iron' : item === 'copper-ore' ? 'copper' : item === 'stone' ? 'brick' : 'coal';
      lastNudge = world.t;
      // A furnace for the headquarters, fed from here.
      const ok = plate === 'coal' ? !!raise('boiler', 'power', waterSpot() ?? [c, rr], 10) : supplyFrom(plate, [c, rr]);
      const text = ok ? `ORDERS: A NEW MINE ON ${fieldName(c, rr, item)}` : 'ORDERS: A NEW MINE HERE, WHEN THERE IS IRON FOR IT';
      say(text, x, y - 20, '#fde68a');
      emit('nudge', x, y, 0.3);
      return text;
    }
    return null;
  }
  /** A furnace for the headquarters whose miner stands on the field at `near`. */
  function supplyFrom(plate: Item, near: [number, number]): boolean {
    if (!supply(plate, hq)) return false;
    const furnace = world.machines[world.machines.length - 1];
    const ore = RECIPES[plate].in && (Object.keys(RECIPES[plate].in)[0] as Item);
    const spot = mineSpot(ore, near[0], near[1], near);
    if (!spot || !afford(COST.miner, 20)) return true;
    const mn = place('miner', spot[0], spot[1], { ore, field: fieldName(near[0], near[1], ore as (typeof ORES)[number]) });
    const p = route(mn, furnace);
    if (!p) {
      remove(mn);
      world.machines.pop();
      return true;
    }
    pay(COST.miner, p.path.length * BELT_COST);
    world.jobs.push({ id: ids++, kind: 'machine', target: mn.id, workers: 0 });
    lay(mn, furnace, ore, p);
    return true;
  }

  const ctx: Ctx = { world, r, say, emit, chronicle, addField };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);

  // ---- the step -------------------------------------------------------------------------------------
  let nextPlan = 1;
  let lowPower = false;
  function step(dt: number) {
    world.t += dt;
    world.day = (world.day + dt / 300) % 1;
    world.director.step(world.t, dt);
    // Scrap from the landing: a trickle of iron, so the factory never stalls for want of it.
    world.stock.iron += dt * 0.4;
    if (world.t >= nextPlan) {
      nextPlan = world.t + 2.5 / pace;
      plan();
    }
    // Power: boilers with coal, and the headquarters' own.
    const consumers = world.machines.filter((m) => m.state === 'work' && m.kind !== 'hq' && m.kind !== 'boiler' && m.kind !== 'turret').length;
    let supplyP = 10;
    for (const b of world.machines) {
      if (b.kind !== 'boiler' || b.state !== 'work') continue;
      if (b.fuel > 0) {
        supplyP += 12;
        b.fuel = Math.max(0, b.fuel - dt * pace * Math.min(1, consumers / 16));
      }
    }
    world.power = consumers ? Math.min(1, supplyP / consumers) : 1;
    if (world.power < 0.6 && !lowPower && world.t > 60) {
      lowPower = true;
      say('NOT ENOUGH POWER: THE MACHINES SLOW', cx(hq), cy(hq) - 40, '#fca5a5');
      emit('brownout', cx(hq), cy(hq), 0.5);
    } else if (world.power > 0.9 && lowPower) {
      lowPower = false;
      say('FULL POWER AGAIN', cx(hq), cy(hq) - 40, '#bbf7d0');
      emit('restored', cx(hq), cy(hq), 0.3);
    }
    for (const m of world.machines) if (m.state === 'work') produce(m, dt);
    belts(dt);
    botsStep(dt);
    pollute();
    biters(dt);
    fire(dt);
    for (const s of systems) s.step?.(dt);
    // Smoke from the chimneys.
    if (r() < dt * 3) {
      const m = world.machines[Math.floor(r() * world.machines.length)];
      if (m && m.state === 'work' && (m.kind === 'furnace' || m.kind === 'boiler')) world.fx.push({ kind: 'smoke', x: cx(m), y: cy(m) - T * 0.5, t0: world.t, dur: 5 });
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
