/**
 * Wyrmspire, the living vale: a valley seen from a hillside, wider than the screen, and the wyrm
 * on its spire. No DOM.
 *
 * The valley is full: a walled town under its castle, villages with their fields and mills, a
 * river with its bridge, forests, pastures with their herds, watchtowers on the hills. Its
 * people work in plain sight: farmers plough in spring, tend in summer, reap in autumn and cart
 * the sheaves to the granary; woodcutters fell trees and haul the logs; builders raise new
 * houses, a church, a mill, walls, and ballista towers as the valley prospers or fears;
 * shepherds, carts, merchants, guards on the walls, knights at the lists, priests at the church.
 *
 * The wyrm is always in view: coiled on its spire, basking, patrolling the sky. Its brood of
 * drakes hunts the herds. When its wrath is up it raids: the beacons are lit from tower to tower,
 * the bells ring, the people run for the walls; its breath (fire, frost, storm, venom, shadow,
 * by breed) burns, freezes, or blights what it passes over; fires spread from roof to roof until
 * the bucket chains put them out, and the builders rebuild. Archers loose, ballistae throw their
 * bolts, and the knights ride out.
 *
 * The lord answers by temper: endure, fortify, pay tribute (carts to the foot of the spire), or
 * hunt (heroes climb the spire path to the cave). Each seed draws a cast (kit/compose): the
 * brood, rivals and foes, pageants (a tournament, a fair, pilgrims), trade (mines, a port,
 * caravans), the land's own hazards, and help (griffon riders, a wizard). The kit's director
 * paces the big moments and points the camera.
 *
 * Space: world px. x along the valley (0..GW); z depth (0 far, 1 near) on the ground, whose
 * world y is `groundY(z)` and scale `depth(z)`; h height above the ground. A thing at (x, z, h)
 * is drawn at (x, groundY(z) - h * depth(z)).
 */
import { forkRng, type Rng } from '../../../rng';
import { createBus, type Bus } from '../../../sim/bus';
import { compose, createDirector, createGenome, ARCS, WORLD_SCALE, type Director, type Genome, type SystemDef } from '../../../kit';
import { dragonName, heroName, placeName, titled } from '../names';

export type Biome = 'alpine' | 'fjord' | 'canyon' | 'fen' | 'ashland';
export type Breed = 'fire' | 'frost' | 'storm' | 'venom' | 'shadow';
const BIOMES: Biome[] = ['alpine', 'fjord', 'canyon', 'fen', 'ashland'];
const BREEDS: Record<Biome, Breed[]> = { alpine: ['frost', 'storm', 'fire'], fjord: ['storm', 'frost', 'fire'], canyon: ['fire', 'storm', 'shadow'], fen: ['venom', 'shadow', 'storm'], ashland: ['fire', 'shadow', 'venom'] };
export const BREED_NAMES: Record<Breed, string> = { fire: 'A FIRE WYRM', frost: 'A FROST WYRM', storm: 'A STORM DRAKE', venom: 'A VENOM WYRM', shadow: 'A SHADOW WYRM' };
export const LAND_NAMES: Record<Biome, string> = { alpine: 'THE HIGH VALLEY OF', fjord: 'THE FJORD OF', canyon: 'THE RED CANYON OF', fen: 'THE FEN OF', ashland: 'THE ASHLANDS OF' };
export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;
export const BREATH: Record<Breed, string> = { fire: '#fb923c', frost: '#bae6fd', storm: '#c7d2fe', venom: '#a3e635', shadow: '#a855f7' };

export type BKind = 'keep' | 'wall' | 'gatehouse' | 'house' | 'farmhouse' | 'church' | 'mill' | 'tower' | 'ballista' | 'granary' | 'inn' | 'smithy' | 'stall' | 'shrine' | 'mine' | 'dock' | 'lists';
export type Building = {
  id: number; kind: BKind; settle: number; x: number; z: number; w: number; state: 'plot' | 'building' | 'standing' | 'ruin';
  progress: number; hp: number; fire: number; frozen: number; blight: number; seed: number; beacon: number; cd: number; variant: number;
  /** A wall runs from (ax, az) to (bx, bz); (x, z) is its middle. */
  ax: number; az: number; bx: number; bz: number;
};
export type Settlement = { id: number; name: string; kind: 'town' | 'village'; x: number; z: number; r: number; wood: number; grain: number; gold: number; prosper: number; alarm: number; raided: number };
export type Field = { id: number; settle: number; x0: number; x1: number; z0: number; z1: number; plowed: number; grown: number; harvested: number; blight: number; frozen: number; burnt: number; crop: number };
export type Tree = { x: number; z: number; kind: 'pine' | 'oak' | 'dead' | 'birch' | 'cactus'; felled: number; burnt: number; seed: number };
export type Beast = { id: number; kind: 'cow' | 'sheep' | 'goat'; x: number; z: number; hx: number; hz: number; alive: boolean; carried: boolean; seed: number; anim: number };
export type PKind = 'farmer' | 'woodcutter' | 'builder' | 'shepherd' | 'villager' | 'merchant' | 'cart' | 'guard' | 'archer' | 'knight' | 'priest' | 'hero' | 'thief' | 'pilgrim' | 'miner' | 'giant' | 'troll' | 'rider' | 'wizard' | 'child';
export type Person = {
  id: number; kind: PKind; name: string; settle: number; x: number; z: number; h: number; tx: number; tz: number; task: string; target: number; t0: number; until: number;
  hp: number; alive: boolean; deadAt: number; carry: '' | 'sheaf' | 'log' | 'bucket' | 'gold' | 'ore' | 'goods'; facing: 1 | -1; anim: number; swing: number; hidden: boolean; seed: number; k: number;
};
export type DKind = 'wyrm' | 'drake' | 'rival' | 'hatchling';
export type Dragon = {
  id: number; kind: DKind; breed: Breed; name: string; x: number; z: number; h: number; state: string; tx: number; tz: number; th: number; target: number;
  hp: number; hpMax: number; wrath: number; hunger: number; t0: number; carry: number; facing: 1 | -1; wing: number; breathing: number; cd: number; alive: boolean; deadAt: number; color: number; seed: number;
};
export type Missile = { kind: 'arrow' | 'bolt' | 'rock' | 'spell' | 'lance'; x: number; z: number; h: number; x1: number; z1: number; h1: number; t0: number; dur: number; to: number; dmg: number; seed: number };
export type Fx = { kind: 'fire' | 'smoke' | 'spark' | 'flash' | 'ember' | 'dust' | 'splash' | 'debris' | 'lantern' | 'confetti' | 'frost' | 'venom' | 'lightning' | 'chop' | 'glint'; x: number; z: number; h: number; t0: number; dur: number; r: number; color: string; seed: number };
export type Label = { text: string; x: number; y: number; color: string; t0: number; dur: number };

export type ValeOptions = { valley: string; wrath: number; knights: number; villages: number; camera?: string };

export type ValeWorld = {
  t: number; W: number; H: number; GW: number; GH: number; /** Distance scale: 1 on a desktop, less on a narrow screen. */ u: number; bus: Bus; director: Director; biome: Biome; breed: Breed; name: string; lord: string; temper: 'bold' | 'cautious' | 'greedy';
  policy: 'endure' | 'fortify' | 'appease' | 'hunt'; cast: string[]; castIds: string[];
  HZ: number; GY0: number; GY1: number; spire: { x: number; z: number; apexY: number; caveY: number; path: [number, number][]; hoard: number };
  river: { at(z: number): number; width: number } | null; lake: { x0: number; x1: number; z0: number; z1: number } | null; road: [number, number][];
  settlements: Settlement[]; buildings: Building[]; fields: Field[]; trees: Tree[]; beasts: Beast[]; people: Person[]; dragons: Dragon[]; missiles: Missile[]; fx: Fx[]; labels: Label[];
  chronicle: { t: number; text: string }[]; boats: { x: number; z: number; dir: 1 | -1; seed: number }[];
  day: number; season: number; year: number; festival: number; fair: number; joust: { a: number; b: number; t0: number } | null; slain: number;
  groundY(z: number): number;
  depth(z: number): number;
  step(dt: number): void;
  counts(): Record<string, number>;
};

type CastCtx = { biome: Biome; wrath: number };
type D = SystemDef<CastCtx, undefined>;
const stub = (id: string) => () => ({ id });
const def = (id: string, label: string, tags: string[], weight: D['weight']): D => ({ id, label, tags, weight, create: stub(id) });
export const VALE_CAST: D[] = [
  def('drakes', 'a brood of drakes', ['brood'], 2),
  def('eggs', 'a clutch of eggs in the spire', ['brood'], 1),
  def('lone', 'a wyrm alone', ['brood'], 0.6),
  def('rival', 'a rival wyrm', ['foe'], (_g, c) => (c.wrath > 0 ? 1.2 : 0.3)),
  def('giants', 'a hill giant', ['foe'], (_g, c) => (c.biome === 'alpine' || c.biome === 'canyon' ? 1.2 : 0.5)),
  def('trolls', 'a troll under the bridge', ['foe'], (_g, c) => (c.biome === 'fen' || c.biome === 'fjord' ? 1.2 : 0.5)),
  def('tournament', 'tournaments', ['pageant'], 1.2),
  def('fair', 'a great fair', ['pageant'], 1),
  def('pilgrims', 'pilgrims to the shrine', ['pageant'], 0.8),
  def('mining', 'mines in the mountains', ['trade'], (_g, c) => (c.biome === 'alpine' || c.biome === 'canyon' ? 1.6 : 0.6)),
  def('port', 'boats on the water', ['trade'], (_g, c) => (c.biome === 'fjord' || c.biome === 'fen' ? 2 : 0.4)),
  def('caravans', 'caravans on the road', ['trade'], 1),
  def('avalanche', 'avalanches', ['nature'], (_g, c) => (c.biome === 'alpine' || c.biome === 'fjord' ? 1 : 0)),
  def('eruption', 'a mountain that smokes', ['nature'], (_g, c) => (c.biome === 'ashland' || c.biome === 'canyon' ? 1.2 : 0)),
  def('floods', 'floods', ['nature'], (_g, c) => (c.biome === 'fen' ? 1.4 : 0.4)),
  def('riders', 'griffon riders', ['help'], 0.7),
  def('wizard', 'a wizard in the tower', ['help'], 0.7),
  def('nohelp', 'no help but their own', ['help'], 0.6),
];
const VALE_RULE = { total: [6, 9] as [number, number], quota: { brood: [1, 1] as [number, number], foe: [0, 2] as [number, number], pageant: [1, 2] as [number, number], trade: [1, 2] as [number, number], nature: [0, 1] as [number, number], help: [1, 1] as [number, number] } };

export const DAY = 240;
const SEASON = 150;
const LORDS = ['LORD AMBROSE', 'LADY ISEULT', 'LORD VARGA', 'LADY MAUD', 'LORD HAKON', 'LADY ELSWYTH', 'LORD CORVIN', 'LADY BRISEIS', 'LORD OTTO', 'LADY RHOSYN'];
const KNIGHTS = ['SER ALDRIC', 'SER COLM', 'DAME ISOLT', 'SER BRAND', 'DAME HELKA', 'SER WULFRIC', 'SER TAMSIN', 'DAME OONA', 'SER GARETH', 'SER BOROS'];

export function createVale(seed: string | number, W: number, H: number, opts: ValeOptions): ValeWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'vale');
  const g: Genome = createGenome(seed, 'vale');
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  let ids = 1;
  const biome: Biome = (BIOMES as string[]).includes(opts.valley) ? (opts.valley as Biome) : g.pick(BIOMES);
  const breed: Breed = g.pick(BREEDS[biome]);
  const wrathK = Math.max(0, opts.wrath);
  const castDrawn = compose(g.fork('cast'), { biome, wrath: wrathK }, VALE_CAST, VALE_RULE);
  const drew = (id: string) => castDrawn.some((c) => c.def.id === id);
  // The whole valley on screen (the default), or the old wide valley the director pans over.
  const wide = g.range(2.3, 2.8);
  const whole = opts.camera !== 'director';
  const GW = Math.round(whole ? W * WORLD_SCALE : W * wide);
  const GH = Math.round(whole ? H * WORLD_SCALE : H * 1.12);
  // Distances shrink on a narrow screen, so a phone gets a smaller valley, not a cut-off one.
  const u = Math.max(0.35, Math.min(1, GW / 1600));
  const HZ = GH * 0.38;
  const GY0 = GH * 0.44;
  const GY1 = GH;
  const groundY = (z: number) => GY0 + (GY1 - GY0) * Math.pow(Math.max(0, Math.min(1, z)), 1.25);
  const depth = (z: number) => 0.3 + 0.7 * Math.max(0, Math.min(1, z));
  const ZPX = 900;
  const spireX = GW * g.range(0.55, 0.8);
  const apexY = GH * g.range(0.19, 0.24);
  const caveY = apexY + (groundY(0.02) - apexY) * 0.3;
  const path: [number, number][] = [];
  {
    const base = groundY(0.02);
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const y = base - (base - caveY) * (k / n);
      const half = (40 + (1 - k / n) * 50) * u;
      path.push([spireX + (k % 2 ? half : -half) * 0.8, y]);
    }
  }

  const world: ValeWorld = {
    t: 0, W, H, GW, GH, u, bus, director: null as unknown as Director, biome, breed, name: placeName(r), lord: g.pick(LORDS), temper: g.weighted({ bold: 1, cautious: 1, greedy: 1 }),
    policy: 'endure', cast: castDrawn.map((c) => c.def.label ?? c.def.id), castIds: castDrawn.map((c) => c.def.id),
    HZ, GY0, GY1, spire: { x: spireX, z: 0.02, apexY, caveY, path, hoard: 900 + Math.floor(r() * 600) },
    river: null, lake: null, road: [],
    settlements: [], buildings: [], fields: [], trees: [], beasts: [], people: [], dragons: [], missiles: [], fx: [], labels: [], chronicle: [], boats: [],
    day: 0.3 + r() * 0.2, season: Math.floor(r() * 3), year: 1100 + Math.floor(r() * 300), festival: -1, fair: -1, joust: null, slain: 0,
    groundY, depth, step,
    counts() {
      const alive = world.people.filter((p) => p.alive);
      return {
        people: alive.length,
        working: alive.filter((p) => p.task !== 'idle' && p.task !== 'hide').length,
        buildings: world.buildings.filter((b) => b.state === 'standing').length,
        building: world.buildings.filter((b) => b.state === 'building' || b.state === 'plot').length,
        burning: world.buildings.filter((b) => b.fire > 0).length,
        dragons: world.dragons.filter((d) => d.alive).length,
        flying: world.dragons.filter((d) => d.alive && d.h > 30).length,
        herd: world.beasts.filter((b) => b.alive).length,
        fields: world.fields.length,
      };
    },
  };

  // ---- telling -------------------------------------------------------------------------------------
  const sy = (x: number, z: number, h = 0) => [x, groundY(z) - h * depth(z)] as const;
  const say = (text: string, x: number, z: number, h: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    const [lx, ly] = sy(x, z, h);
    world.labels.push({ text, x: lx, y: ly, color, t0: world.t, dur: 5.5 });
    if (world.labels.length > 9) world.labels.shift();
    bus.emit({ type: 'say', text, x: lx, y: ly, color, priority });
  };
  const emit = (type: string, x: number, z: number, weight: number) => {
    const [ex, ey] = sy(x, z);
    bus.emit({ type, x: ex, y: ey, weight });
    world.director?.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 6) world.chronicle.shift();
  };
  const T = titled;
  const look = (why: string, x: number, z: number, h: number, zoom: number, dur: number, priority = 3) => {
    const [lx, ly] = sy(x, z, h);
    world.director?.look(why, lx, ly, zoom, dur, priority);
  };
  const fx = (kind: Fx['kind'], x: number, z: number, h: number, dur: number, rad: number, color = '#ffffff') => world.fx.push({ kind, x, z, h, t0: world.t, dur, r: rad, color, seed: ids++ });
  const pending: { at: number; fn: () => void }[] = [];
  const later = (s: number, fn: () => void) => pending.push({ at: world.t + s, fn });
  const said = new Set<string>();
  const once = (k: string) => (said.has(k) ? false : (said.add(k), true));
  const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, (az - bz) * ZPX);

  // ---- the land -------------------------------------------------------------------------------------
  const hasWater = biome === 'fjord' || biome === 'fen' || drew('port') || g.chance(0.5);
  if (biome === 'fjord' || (drew('port') && biome !== 'fen')) world.lake = { x0: GW * g.range(0.05, 0.45), x1: 0, z0: g.range(0.18, 0.3), z1: 0 };
  if (world.lake) {
    world.lake.x1 = Math.min(GW - 40, world.lake.x0 + GW * g.range(0.3, 0.45));
    world.lake.z1 = world.lake.z0 + g.range(0.12, 0.2);
  }
  if (hasWater || biome === 'alpine') {
    const a = spireX + g.range(-0.15, 0.15) * GW;
    const b = GW * g.range(0.15, 0.85);
    const wob = g.range(30, 90);
    const k = g.range(5, 9);
    world.river = { at: (z: number) => a + (b - a) * z + Math.sin(z * k + 1) * wob, width: g.range(18, 30) };
  }
  const wet = (x: number, z: number) => {
    if (world.lake && x > world.lake.x0 && x < world.lake.x1 && z > world.lake.z0 && z < world.lake.z1) return true;
    if (world.river && Math.abs(world.river.at(z) - x) < world.river.width * (0.5 + z * 0.8)) return true;
    return false;
  };
  const nearWater = (x: number, z: number): [number, number] | null => {
    let best: [number, number] | null = null;
    let bd = Infinity;
    if (world.river) for (let k = 0; k <= 40; k++) {
      const zz = k / 40;
      const xx = world.river.at(zz);
      const d = dist(x, z, xx, zz);
      if (d < bd) {
        bd = d;
        best = [xx + (x > xx ? 1 : -1) * world.river.width * (0.6 + zz * 0.8), zz];
      }
    }
    return bd < 700 ? best : null;
  };

  // ---- settlements -----------------------------------------------------------------------------------
  const nVillages = Math.max(1, Math.min(5, Math.round(opts.villages + g.int(0, 1)), 1 + Math.floor(GW / 450)));
  const free = (x: number, z: number, rx: number) => !wet(x, z) && !wet(x - rx, z) && !wet(x + rx, z) && Math.abs(x - spireX) > 160 * u && world.settlements.every((s) => dist(s.x, s.z, x, z) > s.r + rx + 120 * u);
  const settle = (kind: Settlement['kind'], z0: number, z1: number, rx: number): Settlement | null => {
    for (let k = 0; k < 200; k++) {
      const x = 150 * u + r() * (GW - 300 * u);
      const z = z0 + r() * (z1 - z0);
      if (!free(x, z, rx)) continue;
      const s: Settlement = { id: world.settlements.length, name: placeName(r), kind, x, z, r: rx, wood: 6, grain: 10, gold: 20, prosper: 0.5, alarm: 0, raided: -999 };
      world.settlements.push(s);
      return s;
    }
    return null;
  };
  // The town: wherever it fits, smaller if it must.
  const town: Settlement = (() => {
    let s = settle('town', 0.5, 0.68, 230 * u);
    for (let k = 0; k < 4 && !s; k++) s = settle('town', 0.4, 0.85, 230 * u * (0.8 - k * 0.12));
    if (s) return s;
    const fallback: Settlement = { id: 0, name: placeName(r), kind: 'town', x: spireX < GW / 2 ? GW * 0.7 : GW * 0.3, z: 0.62, r: 140 * u, wood: 6, grain: 10, gold: 20, prosper: 0.5, alarm: 0, raided: -999 };
    world.settlements.push(fallback);
    return fallback;
  })();
  for (let k = 0; k < nVillages; k++) settle('village', 0.3, 0.9, (120 + r() * 50) * u);
  const bld = (kind: BKind, s: Settlement, x: number, z: number, w: number, state: Building['state'] = 'standing'): Building => {
    const b: Building = { id: ids++, kind, settle: s.id, x, z, w, state, progress: state === 'standing' ? 1 : 0, hp: 1, fire: 0, frozen: 0, blight: 0, seed: ids, beacon: -1, cd: 0, variant: Math.floor(r() * 4), ax: x, az: z, bx: x, bz: z };
    world.buildings.push(b);
    return b;
  };
  /** A ring of wall in segments, end to end, with a gate where it faces the valley. */
  function ring(s: Settlement, rad: number, n: number, state: Building['state']) {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const ax = s.x + Math.cos(a0) * rad;
      const az = s.z + (Math.sin(a0) * rad) / ZPX;
      const bx = s.x + Math.cos(a1) * rad;
      const bz = s.z + (Math.sin(a1) * rad) / ZPX;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      if (wet(mx, mz) || mz < 0.15 || mz > 0.99) continue;
      const gate = s.kind === 'town' && k === Math.round(n / 4);
      const b = bld(gate ? 'gatehouse' : 'wall', s, mx, mz, gate ? 30 : Math.abs(bx - ax) + 4, state);
      b.ax = ax;
      b.az = az;
      b.bx = bx;
      b.bz = bz;
    }
  }
  const occupied = (x: number, z: number, w: number) => world.buildings.some((b) => Math.abs(b.x - x) < (b.w + w) * 0.55 && Math.abs(b.z - z) * ZPX < 34) || wet(x, z);
  const plotIn = (s: Settlement, rx: number, w: number): [number, number] | null => {
    for (let k = 0; k < 60; k++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rx;
      const x = s.x + Math.cos(a) * d;
      const z = s.z + (Math.sin(a) * d) / ZPX * 0.9;
      if (z < 0.22 || z > 0.97 || occupied(x, z, w)) continue;
      return [x, z];
    }
    return null;
  };
  // The town: the keep, walls round, the gatehouse, the church, the market, houses.
  bld('keep', town, town.x, town.z - 0.05, 70);
  const wallR = town.r * 0.95;
  ring(town, wallR, 26, 'standing');
  for (const [kind, w] of [['church', 34], ['inn', 26], ['smithy', 22], ['granary', 24]] as [BKind, number][]) {
    const p = plotIn(town, town.r * 0.75, w);
    if (p) bld(kind, town, p[0], p[1], w);
  }
  for (let k = 0; k < 4; k++) {
    const p = plotIn(town, town.r * 0.5, 14);
    if (p) bld('stall', town, p[0], p[1], 14);
  }
  for (let k = 0; k < 16; k++) {
    const p = plotIn(town, town.r * 0.82, 18);
    if (p) bld('house', town, p[0], p[1], 18);
  }
  for (const s of world.settlements) if (s.kind === 'village') {
    for (let k = 0; k < 5 + Math.floor(r() * 5); k++) {
      const p = plotIn(s, s.r * 0.7, 18);
      if (p) bld(k === 0 ? 'farmhouse' : 'house', s, p[0], p[1], 18);
    }
    const p = plotIn(s, s.r, 20);
    if (p && r() < 0.8) bld('mill', s, p[0], p[1], 20);
  }
  if (drew('tournament')) {
    const p = plotIn(town, town.r * 1.6, 60);
    if (p) bld('lists', town, p[0], p[1], 70);
  }
  if (drew('pilgrims')) {
    const s = pick(world.settlements);
    const p = plotIn(s, s.r * 2, 20);
    if (p) bld('shrine', s, p[0], Math.max(0.25, p[1] - 0.1), 20);
  }
  if (drew('mining')) bld('mine', town, GW * (r() < 0.5 ? 0.12 : 0.88), 0.08, 30);
  if (drew('port') && (world.lake || world.river)) {
    const s = world.settlements.slice().sort((a, b) => {
      const da = world.lake ? Math.abs(a.z - world.lake.z1) : Math.abs(a.x - (world.river?.at(a.z) ?? 0));
      const db = world.lake ? Math.abs(b.z - world.lake.z1) : Math.abs(b.x - (world.river?.at(b.z) ?? 0));
      return da - db;
    })[0];
    if (world.lake) bld('dock', s, Math.max(world.lake.x0 + 30, Math.min(world.lake.x1 - 30, s.x)), world.lake.z1 + 0.01, 40);
    for (let k = 0; k < 3; k++) world.boats.push({ x: world.lake ? world.lake.x0 + r() * (world.lake.x1 - world.lake.x0) : 0, z: world.lake ? world.lake.z0 + r() * (world.lake.z1 - world.lake.z0) : r(), dir: r() < 0.5 ? 1 : -1, seed: ids++ });
  }
  // Watchtowers on the hills, for the beacons.
  for (let k = 0; k < 5; k++) {
    const x = ((k + 0.5) / 5) * GW + (r() - 0.5) * 100;
    const z = 0.12 + r() * 0.15;
    if (wet(x, z) || Math.abs(x - spireX) < 140 * u) continue;
    const s = world.settlements.slice().sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
    bld('tower', s, x, z, 16);
  }
  // Fields round the villages (and the town), in strips.
  for (const s of world.settlements) {
    const n = s.kind === 'town' ? 4 : 5 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const fw = (70 + r() * 90) * Math.max(0.6, u);
      const fd = 0.03 + r() * 0.04;
      const a = r() * Math.PI * 2;
      const d = s.r * (s.kind === 'town' ? 1.25 : 0.9) + 40 + r() * 140;
      const x0 = s.x + Math.cos(a) * d - fw / 2;
      const z0 = s.z + (Math.sin(a) * d) / ZPX - fd / 2;
      if (z0 < 0.2 || z0 + fd > 0.99) continue;
      if (wet(x0, z0) || wet(x0 + fw, z0 + fd) || world.fields.some((f) => x0 < f.x1 + 10 && x0 + fw > f.x0 - 10 && z0 < f.z1 + 0.01 && z0 + fd > f.z0 - 0.01)) continue;
      if (world.buildings.some((b) => b.x > x0 - 10 && b.x < x0 + fw + 10 && b.z > z0 - 0.02 && b.z < z0 + fd + 0.02)) continue;
      world.fields.push({ id: world.fields.length, settle: s.id, x0, x1: x0 + fw, z0, z1: z0 + fd, plowed: world.season === 0 ? 0.3 : 1, grown: world.season === 1 ? 0.5 : world.season === 2 ? 1 : 0, harvested: 0, blight: 0, frozen: 0, burnt: 0, crop: Math.floor(r() * 3) });
    }
  }
  // Forests, and trees scattered.
  const treeKind: Tree['kind'] = biome === 'alpine' || biome === 'fjord' ? 'pine' : biome === 'ashland' ? 'dead' : biome === 'canyon' ? 'cactus' : 'oak';
  const blocked = (x: number, z: number) => wet(x, z) || world.buildings.some((b) => Math.abs(b.x - x) < b.w && Math.abs(b.z - z) * ZPX < 30) || world.fields.some((f) => x > f.x0 - 4 && x < f.x1 + 4 && z > f.z0 - 0.005 && z < f.z1 + 0.005) || world.settlements.some((s) => dist(s.x, s.z, x, z) < s.r * 0.8);
  for (let c = 0; c < 11; c++) {
    const cx = r() * GW;
    const cz = c < 6 ? 0.07 + r() * 0.2 : 0.12 + r() * 0.7;
    const n = c < 6 ? 60 + Math.floor(r() * 60) : 30 + Math.floor(r() * 50);
    for (let k = 0; k < n; k++) {
      const x = cx + (r() - 0.5) * 300 * u;
      const z = cz + (r() - 0.5) * 0.18;
      if (z < 0.06 || z > 1 || x < 0 || x > GW || blocked(x, z)) continue;
      world.trees.push({ x, z, kind: biome === 'fen' && r() < 0.3 ? 'dead' : r() < 0.2 && treeKind === 'oak' ? 'birch' : treeKind, felled: -1, burnt: -1, seed: ids++ });
    }
  }
  for (let k = 0; k < 90; k++) {
    const x = r() * GW;
    const z = 0.08 + r() * 0.9;
    if (!blocked(x, z)) world.trees.push({ x, z, kind: treeKind, felled: -1, burnt: -1, seed: ids++ });
  }
  // The road: from edge to edge through every settlement, and up to the foot of the spire.
  const stops = world.settlements.slice().sort((a, b) => a.x - b.x);
  world.road = [[0, 0.62], ...stops.map((s) => [s.x, s.z + (s.kind === 'town' ? 0.02 : 0)] as [number, number]), [GW, 0.6]];
  // Pastures and herds.
  const beastKind: Beast['kind'] = biome === 'alpine' || biome === 'canyon' ? 'goat' : biome === 'fjord' || biome === 'fen' ? 'sheep' : 'cow';
  for (let k = 0; k < 3 + Math.floor(r() * 2); k++) {
    for (let tries = 0; tries < 40; tries++) {
      const hx = r() * GW;
      const hz = 0.25 + r() * 0.6;
      if (blocked(hx, hz) || Math.abs(hx - spireX) < 200 * u) continue;
      const kind = r() < 0.7 ? beastKind : pick(['cow', 'sheep', 'goat'] as Beast['kind'][]);
      for (let j = 0; j < 7 + Math.floor(r() * 8); j++) world.beasts.push({ id: ids++, kind, x: hx + (r() - 0.5) * 80, z: hz + (r() - 0.5) * 0.04, hx, hz, alive: true, carried: false, seed: ids, anim: r() * 6 });
      break;
    }
  }

  // ---- the people --------------------------------------------------------------------------------------
  const person = (kind: PKind, s: Settlement, x?: number, z?: number, name = ''): Person => {
    const p: Person = {
      id: ids++, kind, name, settle: s.id, x: x ?? s.x + (r() - 0.5) * s.r, z: z ?? s.z + (r() - 0.5) * 0.04, h: 0, tx: 0, tz: 0, task: 'idle', target: -1, t0: world.t, until: world.t + r() * 4,
      hp: kind === 'knight' || kind === 'hero' || kind === 'rider' ? 40 : kind === 'giant' || kind === 'troll' ? 120 : 8, alive: true, deadAt: -1, carry: '', facing: r() < 0.5 ? 1 : -1, anim: r() * 6, swing: -1, hidden: false, seed: ids, k: 0,
    };
    p.tx = p.x;
    p.tz = p.z;
    world.people.push(p);
    return p;
  };
  for (const s of world.settlements) {
    const town2 = s.kind === 'town';
    const jobs: [PKind, number][] = town2 ? [['villager', 10], ['builder', 4], ['guard', 4], ['archer', 3], ['priest', 1], ['merchant', 3], ['child', 3], ['farmer', 3], ['woodcutter', 2]] : [['farmer', 6], ['woodcutter', 2], ['builder', 1], ['villager', 3], ['shepherd', 1], ['child', 2]];
    for (const [kind, n] of jobs) for (let k = 0; k < n; k++) person(kind, s);
  }
  const nKnights = Math.round(3 + opts.knights * 3);
  for (let k = 0; k < nKnights; k++) person('knight', town, undefined, undefined, KNIGHTS[k % KNIGHTS.length]);
  if (drew('mining')) for (let k = 0; k < 3; k++) person('miner', town);
  if (drew('riders')) for (let k = 0; k < 2; k++) {
    const p = person('rider', town, undefined, undefined, pick(KNIGHTS).replace('SER', 'RIDER').replace('DAME', 'RIDER'));
    p.h = 0;
  }
  if (drew('wizard')) {
    const s = world.settlements.slice().sort((a, b) => b.z - a.z)[0];
    const p = plotIn(s, s.r * 1.5, 16);
    if (p) bld('tower', s, p[0], p[1], 16).variant = 9;
    person('wizard', s, p?.[0], p?.[1], pick(['MERIDOC THE GREY', 'OLD WEN', 'SABINE OF THE TOWER', 'THE HERMIT']));
  }

  // ---- the dragons -----------------------------------------------------------------------------------
  const perch = (k: number): [number, number, number] => {
    // The apex, or a ledge below it, as (x, z, h).
    const z = world.spire.z;
    const y = k === 0 ? apexY + 6 : caveY - 10 - k * 18;
    return [spireX + (k === 0 ? 0 : (k % 2 ? -1 : 1) * 28), z, (groundY(z) - y) / depth(z)];
  };
  const dragon = (kind: DKind, name: string, at?: [number, number, number]): Dragon => {
    const [x, z, h] = at ?? perch(0);
    const hp = kind === 'wyrm' ? 700 : kind === 'rival' ? 600 : kind === 'drake' ? 45 : 20;
    const d: Dragon = { id: ids++, kind, breed, name, x, z, h, state: kind === 'wyrm' ? 'sleep' : 'roost', tx: x, tz: z, th: h, target: -1, hp, hpMax: hp, wrath: 0.25 * wrathK, hunger: r() * 0.5, t0: world.t, carry: -1, facing: 1, wing: r() * 6, breathing: 0, cd: 0, alive: true, deadAt: -1, color: Math.floor(r() * 4), seed: ids };
    world.dragons.push(d);
    return d;
  };
  const wyrm = dragon('wyrm', dragonName(r));
  if (drew('drakes')) for (let k = 0; k < 2 + Math.floor(r() * 3); k++) dragon('drake', `DRAKE ${k + 1}`, perch(1 + k));
  let clutch = drew('eggs') ? 3 : 0;

  // ---- moving on the ground -------------------------------------------------------------------------
  /** Step toward (tx, tz); true on arrival. Speed in px/s at the front. */
  function walk(p: { x: number; z: number; facing: 1 | -1; anim: number }, tx: number, tz: number, speed: number, dt: number): boolean {
    const dx = tx - p.x;
    const dz = (tz - p.z) * ZPX;
    const d = Math.hypot(dx, dz);
    const st = speed * dt * depth(p.z);
    if (Math.abs(dx) > 0.5) p.facing = dx > 0 ? 1 : -1;
    p.anim += dt * 7;
    if (d <= st) {
      p.x = tx;
      p.z = tz;
      return true;
    }
    p.x += (dx / d) * st;
    p.z += ((dz / d) * st) / ZPX;
    return false;
  }
  const SPEED: Record<PKind, number> = { farmer: 26, woodcutter: 26, builder: 26, shepherd: 22, villager: 24, merchant: 20, cart: 22, guard: 22, archer: 24, knight: 60, priest: 18, hero: 34, thief: 30, pilgrim: 16, miner: 22, giant: 26, troll: 30, rider: 120, wizard: 22, child: 34 };
  const settleOf = (p: Person) => world.settlements[p.settle];
  const roadPoint = (): [number, number] => {
    const k = Math.floor(r() * (world.road.length - 1));
    const [ax, az] = world.road[k];
    const [bx, bz] = world.road[k + 1];
    const u = r();
    return [ax + (bx - ax) * u, az + (bz - az) * u];
  };
  const bsOf = (s: Settlement, kind?: BKind) => world.buildings.filter((b) => b.settle === s.id && b.state === 'standing' && (!kind || b.kind === kind));
  const night = () => world.day < 0.2 || world.day > 0.8;

  function think(p: Person) {
    const s = settleOf(p);
    p.t0 = world.t;
    p.swing = -1;
    // Under attack: run for the walls, or indoors.
    if (s.alarm > world.t && p.kind !== 'knight' && p.kind !== 'archer' && p.kind !== 'guard' && p.kind !== 'rider' && p.kind !== 'hero' && p.kind !== 'wizard' && p.kind !== 'giant' && p.kind !== 'troll') {
      const burning = world.buildings.find((b) => b.settle === s.id && b.fire > 0.15);
      if (burning && p.kind !== 'child' && r() < 0.6) return fetch(p, burning);
      const home = bsOf(s, s.kind === 'town' ? 'keep' : undefined)[0] ?? bsOf(s)[0];
      p.task = 'flee';
      p.tx = home ? home.x + (r() - 0.5) * 20 : s.x;
      p.tz = home ? home.z + 0.01 : s.z;
      return;
    }
    // A fire after the attack: buckets.
    const burning = world.buildings.find((b) => b.fire > 0.15 && dist(b.x, b.z, p.x, p.z) < 600);
    if (burning && (p.kind === 'villager' || p.kind === 'farmer' || p.kind === 'builder' || p.kind === 'woodcutter' || p.kind === 'guard') && r() < 0.8) return fetch(p, burning);
    if (night() && (p.kind === 'farmer' || p.kind === 'villager' || p.kind === 'child' || p.kind === 'builder' || p.kind === 'woodcutter') && world.festival < world.t && r() < 0.8) {
      const home = pick(bsOf(s).filter((b) => b.kind === 'house' || b.kind === 'farmhouse' || b.kind === 'inn'));
      p.task = 'home';
      p.tx = home ? home.x : s.x;
      p.tz = home ? home.z + 0.004 : s.z;
      return;
    }
    if (world.festival > world.t && p.kind !== 'knight' && p.kind !== 'guard') {
      p.task = 'festival';
      const sq = world.settlements[0];
      p.tx = sq.x + (r() - 0.5) * 120;
      p.tz = sq.z + 0.03 + (r() - 0.5) * 0.04;
      p.until = world.t + 6 + r() * 6;
      return;
    }
    if (world.joust && (p.kind === 'villager' || p.kind === 'child' || p.kind === 'merchant') && r() < 0.6) {
      const li = world.buildings.find((b) => b.kind === 'lists');
      if (li) {
        p.task = 'watch';
        p.tx = li.x + (r() - 0.5) * li.w * 1.1;
        p.tz = li.z + (r() < 0.5 ? -1 : 1) * 0.03;
        p.until = world.t + 10;
        return;
      }
    }
    switch (p.kind) {
      case 'farmer': {
        const fs = world.fields.filter((f) => f.settle === p.settle && f.burnt < 0.5);
        const f = fs.length ? pick(fs) : null;
        if (!f || world.season === 3) return wander(p, s);
        p.task = world.season === 0 ? (f.plowed < 1 ? 'plow' : 'sow') : world.season === 1 ? 'tend' : f.harvested < 1 ? 'reap' : 'glean';
        p.target = f.id;
        p.tx = f.x0 + r() * (f.x1 - f.x0);
        p.tz = f.z0 + r() * (f.z1 - f.z0);
        p.until = world.t + 8 + r() * 8;
        return;
      }
      case 'woodcutter': {
        const trees = world.trees.filter((tr) => tr.felled < 0 && tr.burnt < 0 && dist(tr.x, tr.z, s.x, s.z) < 900);
        if (!trees.length) return wander(p, s);
        trees.sort((a, b) => dist(a.x, a.z, p.x, p.z) - dist(b.x, b.z, p.x, p.z));
        const tr = trees[Math.floor(r() * Math.min(5, trees.length))];
        p.task = 'chop';
        p.target = world.trees.indexOf(tr);
        p.tx = tr.x - 8;
        p.tz = tr.z + 0.002;
        p.until = world.t + 7 + r() * 4;
        return;
      }
      case 'builder': {
        const site = world.buildings.filter((b) => (b.state === 'plot' || b.state === 'building' || (b.state === 'ruin' && b.kind !== 'wall')) && dist(b.x, b.z, p.x, p.z) < 1400).sort((a, b) => dist(a.x, a.z, p.x, p.z) - dist(b.x, b.z, p.x, p.z))[0];
        if (!site) return wander(p, s);
        p.task = 'build';
        p.target = site.id;
        p.tx = site.x + (r() - 0.5) * site.w;
        p.tz = site.z + 0.008;
        p.until = world.t + 10 + r() * 6;
        return;
      }
      case 'shepherd': {
        const herd = world.beasts.filter((b) => b.alive && !b.carried);
        const b = herd.length ? herd.sort((a, c) => dist(a.hx, a.hz, p.x, p.z) - dist(c.hx, c.hz, p.x, p.z))[0] : null;
        if (!b) return wander(p, s);
        p.task = 'herd';
        p.tx = b.hx + (r() - 0.5) * 120;
        p.tz = b.hz + (r() - 0.5) * 0.05;
        p.until = world.t + 6 + r() * 6;
        return;
      }
      case 'guard': {
        const walls = world.buildings.filter((b) => b.settle === p.settle && (b.kind === 'wall' || b.kind === 'gatehouse') && b.state === 'standing');
        const w = walls.length ? pick(walls) : null;
        p.task = 'patrol';
        p.tx = w ? w.x : s.x;
        p.tz = w ? w.z + 0.002 : s.z;
        p.until = world.t + 8;
        return;
      }
      case 'archer': {
        const ts = world.buildings.filter((b) => (b.kind === 'wall' || b.kind === 'ballista' || b.kind === 'gatehouse') && b.state === 'standing');
        const w = ts.length ? pick(ts) : null;
        p.task = 'watch';
        p.tx = w ? w.x + (r() - 0.5) * 10 : s.x;
        p.tz = w ? w.z + 0.003 : s.z;
        p.until = world.t + 12;
        return;
      }
      case 'knight': {
        const li = world.buildings.find((b) => b.kind === 'lists');
        if (li && r() < 0.35) {
          p.task = 'train';
          p.tx = li.x + (r() - 0.5) * li.w;
          p.tz = li.z;
          p.until = world.t + 8;
          return;
        }
        const [x, z] = roadPoint();
        p.task = 'ride';
        p.tx = x;
        p.tz = z;
        p.until = world.t + 4;
        return;
      }
      case 'merchant': {
        const stall = pick(world.buildings.filter((b) => b.kind === 'stall' && b.state === 'standing'));
        p.task = 'trade';
        p.tx = stall ? stall.x + (r() - 0.5) * 10 : s.x;
        p.tz = stall ? stall.z + 0.006 : s.z;
        p.until = world.t + 10 + r() * 10;
        return;
      }
      case 'priest': {
        const ch = bsOf(s, 'church')[0] ?? world.buildings.find((b) => b.kind === 'shrine');
        p.task = 'pray';
        p.tx = ch ? ch.x : s.x;
        p.tz = ch ? ch.z + 0.008 : s.z;
        p.until = world.t + 14;
        return;
      }
      case 'miner': {
        const mine = world.buildings.find((b) => b.kind === 'mine');
        if (!mine) return wander(p, s);
        p.task = p.carry === 'ore' ? 'haul' : 'mine';
        const smith = bsOf(town, 'smithy')[0] ?? world.buildings[0];
        p.tx = p.carry === 'ore' ? smith.x : mine.x;
        p.tz = p.carry === 'ore' ? smith.z + 0.008 : mine.z + 0.01;
        p.until = world.t + 6;
        return;
      }
      case 'rider':
        p.task = 'patrol';
        p.tx = r() * GW;
        p.tz = 0.2 + r() * 0.6;
        p.until = world.t + 4;
        return;
      case 'wizard':
        p.task = 'study';
        p.until = world.t + 20;
        p.tx = p.x;
        p.tz = p.z;
        return;
      case 'villager': {
        // Everyone lends a hand when a house is down.
        const ruin = world.buildings.find((b) => b.settle === p.settle && (b.state === 'ruin' || b.state === 'building') && b.kind !== 'wall');
        if (ruin && r() < 0.5) {
          p.task = 'build';
          p.target = ruin.id;
          p.tx = ruin.x + (r() - 0.5) * ruin.w;
          p.tz = ruin.z + 0.008;
          p.until = world.t + 10;
          return;
        }
        return wander(p, s);
      }
      default:
        return wander(p, s);
    }
  }
  function wander(p: Person, s: Settlement) {
    const b = pick(bsOf(s));
    p.task = 'idle';
    p.tx = b ? b.x + (r() - 0.5) * 40 : s.x + (r() - 0.5) * s.r;
    p.tz = b ? b.z + 0.006 + (r() - 0.5) * 0.02 : s.z;
    p.until = world.t + 3 + r() * 6;
  }
  function fetch(p: Person, b: Building) {
    const w = nearWater(p.x, p.z) ?? [settleOf(p).x, settleOf(p).z];
    p.task = p.carry === 'bucket' ? 'douse' : 'water';
    p.target = b.id;
    p.tx = p.carry === 'bucket' ? b.x + (r() - 0.5) * b.w : w[0];
    p.tz = p.carry === 'bucket' ? b.z + 0.01 : w[1];
  }
  function act(p: Person, dt: number) {
    if (p.kind === 'hero' || p.kind === 'thief') return quest(p, dt);
    if (p.kind === 'giant' || p.kind === 'troll') return brute(p, dt);
    if (p.kind === 'cart' || p.kind === 'pilgrim') return traveller(p, dt);
    if (p.kind === 'knight' && p.task === 'sortie') return sortie(p, dt);
    if (p.kind === 'rider' && p.task === 'sortie') return sortie(p, dt);
    const arrived = walk(p, p.tx, p.tz, SPEED[p.kind] * (p.task === 'flee' ? 1.8 : 1), dt);
    if (p.task === 'idle' && !arrived) return;
    switch (p.task) {
      case 'plow':
      case 'sow':
      case 'tend':
      case 'reap':
      case 'glean': {
        if (!arrived) return;
        const f = world.fields[p.target];
        p.swing = world.t;
        if (f) {
          if (p.task === 'plow') f.plowed = Math.min(1, f.plowed + dt * 0.012);
          if (p.task === 'tend') f.grown = Math.min(1, f.grown + dt * 0.004);
          if (p.task === 'reap') {
            f.harvested = Math.min(1, f.harvested + dt * 0.012);
            if (world.t > p.until - 1 && !p.carry) p.carry = 'sheaf';
          }
          if (r() < dt * 0.8) {
            fx(p.task === 'plow' ? 'dust' : 'spark', p.x + p.facing * 4, p.z, 2, 0.8, 4, p.task === 'plow' ? '#a8896a' : '#fde68a');
            // A step along the furrow.
            p.tx = Math.max(f.x0, Math.min(f.x1, p.x + p.facing * 14));
          }
        }
        if (world.t > p.until) {
          if (p.carry === 'sheaf') {
            const gr = bsOf(settleOf(p), 'granary')[0] ?? bsOf(town, 'granary')[0] ?? bsOf(settleOf(p), 'farmhouse')[0];
            p.task = 'carry';
            p.tx = gr ? gr.x : settleOf(p).x;
            p.tz = gr ? gr.z + 0.008 : settleOf(p).z;
          } else p.task = 'idle';
        }
        return;
      }
      case 'carry':
        if (arrived) {
          if (p.carry === 'sheaf') settleOf(p).grain += 1;
          if (p.carry === 'log') settleOf(p).wood += 1;
          if (p.carry === 'ore') town.gold += 2;
          p.carry = '';
          p.task = 'idle';
          p.until = world.t + 1;
        }
        return;
      case 'chop': {
        if (!arrived) return;
        const tr = world.trees[p.target];
        if (!tr || tr.felled >= 0) {
          p.task = 'idle';
          return;
        }
        p.swing = world.t;
        if (r() < dt * 2) fx('chop', tr.x, tr.z, 10, 0.4, 3, '#d6c3a5');
        if (world.t > p.until) {
          tr.felled = world.t;
          fx('dust', tr.x + 8, tr.z, 4, 1.2, 10, '#a8896a');
          emit('timber', tr.x, tr.z, 0.03);
          p.carry = 'log';
          p.task = 'carry';
          const s = settleOf(p);
          p.tx = s.x + (r() - 0.5) * 40;
          p.tz = s.z + 0.01;
        }
        return;
      }
      case 'build': {
        if (!arrived) return;
        const b = world.buildings.find((x) => x.id === p.target);
        if (!b || b.state === 'standing') {
          p.task = 'idle';
          return;
        }
        p.swing = world.t;
        if (b.state === 'plot' || b.state === 'ruin') {
          b.state = 'building';
          b.progress = 0;
          b.fire = 0;
        }
        b.progress += dt / (b.kind === 'church' || b.kind === 'keep' ? 70 : b.kind === 'house' || b.kind === 'farmhouse' ? 22 : 35);
        if (r() < dt * 2) fx('chop', b.x + (r() - 0.5) * b.w, b.z, 8 + b.progress * 20, 0.4, 2, '#d6c3a5');
        if (b.progress >= 1) {
          b.state = 'standing';
          b.hp = 1;
          b.frozen = 0;
          b.blight = 0;
          const s = world.settlements[b.settle];
          const what: Partial<Record<BKind, string>> = { church: 'A CHURCH', mill: 'A MILL', ballista: 'A BALLISTA TOWER', granary: 'A GRANARY', inn: 'AN INN', wall: 'THE WALL', tower: 'A WATCHTOWER', smithy: 'A SMITHY' };
          if (what[b.kind]) {
            say(`${s.name} RAISES ${what[b.kind]}`, b.x, b.z, 50, '#fde68a', 'medium');
            emit('raised', b.x, b.z, 0.3);
            look('build', b.x, b.z, 30, 1.6, 5, 2);
          } else emit('house', b.x, b.z, 0.06);
          s.prosper = Math.min(1, s.prosper + 0.05);
        }
        if (world.t > p.until) p.task = 'idle';
        return;
      }
      case 'water':
        if (arrived) {
          p.carry = 'bucket';
          fx('splash', p.x, p.z, 2, 0.5, 4, '#93c5fd');
          const b = world.buildings.find((x) => x.id === p.target);
          if (b && b.fire > 0) fetch(p, b);
          else p.task = 'idle';
        }
        return;
      case 'douse': {
        if (!arrived) return;
        const b = world.buildings.find((x) => x.id === p.target);
        p.carry = '';
        if (b) {
          b.fire = Math.max(0, b.fire - 0.22);
          fx('splash', b.x, b.z, 14, 0.6, 8, '#bfdbfe');
          fx('smoke', b.x, b.z, 20, 2, 10, '#cbd5e1');
          if (b.fire > 0) fetch(p, b);
          else p.task = 'idle';
        } else p.task = 'idle';
        return;
      }
      case 'flee':
        if (arrived) {
          p.hidden = true;
          if (settleOf(p).alarm < world.t) {
            p.hidden = false;
            p.task = 'idle';
          }
        }
        return;
      case 'home':
        if (arrived) {
          p.hidden = true;
          if (!night()) {
            p.hidden = false;
            p.task = 'idle';
          }
        }
        return;
      case 'mine':
        if (arrived) {
          p.hidden = true;
          if (world.t > p.until + 8) {
            p.hidden = false;
            p.carry = 'ore';
            p.task = 'idle';
            p.until = world.t;
          }
        }
        return;
      case 'haul':
        if (arrived) {
          p.carry = '';
          town.gold += 3;
          p.task = 'idle';
        }
        return;
      case 'pray':
      case 'study':
      case 'trade':
      case 'watch':
      case 'patrol':
      case 'ride':
      case 'train':
      case 'herd':
      case 'festival':
        if (arrived) {
          if (p.task === 'train' || p.task === 'patrol' && p.kind === 'guard') p.swing = world.t;
          if (p.task === 'festival' && r() < dt * 2) p.anim += 2;
        }
        if (world.t > p.until && (arrived || p.task === 'ride')) p.task = 'idle';
        return;
      default:
        if (world.t > p.until) think(p);
    }
  }

  // ---- travellers, brutes, heroes, sorties -------------------------------------------------------------
  function traveller(p: Person, dt: number) {
    // Along the road, stop to stop.
    if (p.k >= world.road.length) {
      p.alive = false;
      p.deadAt = -999;
      return;
    }
    const [x, z] = world.road[p.k];
    if (walk(p, x, z, SPEED[p.kind], dt)) p.k += p.facing > 0 ? 1 : 1;
  }
  function quest(p: Person, dt: number) {
    const w = world.dragons.find((d) => d.kind === 'wyrm' && d.alive) ?? null;
    switch (p.task) {
      case 'arrive':
        if (walk(p, town.x, town.z + 0.02, SPEED.hero, dt)) {
          p.task = 'feast';
          p.until = world.t + 8;
          if (p.kind === 'hero') say(`${p.name} FEASTS IN ${town.name}`, p.x, p.z, 30, '#fde68a', 'low');
        }
        return;
      case 'feast':
        if (world.t > p.until && (p.kind === 'hero' || night())) {
          p.task = 'approach';
          if (p.kind === 'hero') {
            say(`${p.name} RIDES FOR THE SPIRE`, p.x, p.z, 30, '#fde68a', 'high');
            emit('hero', p.x, p.z, 0.6);
            chronicle(`${T(p.name)} rode out for the spire of ${T(wyrm.name)}.`);
          }
        }
        return;
      case 'approach':
        if (walk(p, spireX, 0.04, SPEED.hero, dt)) {
          p.task = 'climb';
          p.k = 0;
          if (p.kind === 'hero') look('climb', spireX, 0.02, 200, 1.4, 10, 5);
        }
        return;
      case 'climb': {
        p.k = Math.min(1, p.k + dt / 40);
        if (p.k >= 1) {
          p.task = 'cave';
          p.until = world.t + (p.kind === 'hero' ? 14 : 6);
          if (p.kind === 'hero') {
            say(`${p.name} FACES ${w?.name ?? 'THE EMPTY CAVE'} AT THE CAVE`, spireX, 0.02, 300, '#fca5a5', 'high');
            emit('cavefight', spireX, 0.02, 0.85);
            look('cave', spireX, 0.02, 280, 1.6, 14, 7);
            if (w && w.state !== 'dead') {
              w.state = 'cavefight';
              w.target = p.id;
            }
          }
        }
        return;
      }
      case 'cave': {
        if (r() < dt * 3) fx(p.kind === 'hero' ? 'flash' : 'glint', spireX + (r() - 0.5) * 30, 0.02, (groundY(0.02) - caveY) / depth(0.02), 0.5, 18, p.kind === 'hero' ? BREATH[breed] : '#fde68a');
        if (world.t < p.until) return;
        const roll = r();
        if (p.kind === 'thief') {
          if (roll < 0.55 || !w) {
            const stolen = 40 + Math.floor(r() * 120);
            world.spire.hoard = Math.max(0, world.spire.hoard - stolen);
            say(`THIEVES MAKE OFF WITH ${stolen} CROWNS`, spireX, 0.02, 200, '#fde68a', 'medium');
            emit('thieves', spireX, 0.02, 0.4);
            if (w) w.wrath += 0.6;
          } else {
            say('THE THIEVES WAKE THE WYRM', spireX, 0.02, 200, '#fca5a5', 'high');
            emit('caught', spireX, 0.02, 0.6);
            p.alive = false;
            p.deadAt = world.t;
            if (w) {
              w.wrath = 2;
              w.state = 'wake';
            }
            return;
          }
        } else if (w && w.state !== 'dead') {
          const odds = 0.12 + (world.policy === 'hunt' ? 0.08 : 0);
          if (roll < odds) {
            hurtDragon(w, 9999, `${p.name} AT THE CAVE`);
            say(`${p.name} SLAYS ${w.name}`, spireX, 0.02, 300, '#fde68a', 'high');
          } else if (roll < 0.5) {
            hurtDragon(w, w.hpMax * 0.35, p.name);
            w.state = 'flee';
            say(`${w.name} FLEES THE VALLEY, WOUNDED`, spireX, 0.02, 300, '#fde68a', 'high');
            emit('wyrmflees', spireX, 0.02, 0.85);
            chronicle(`${T(p.name)} drove ${T(w.name)} from its spire.`);
          } else {
            say(`${p.name} FALLS AT THE CAVE`, spireX, 0.02, 300, '#fca5a5', 'high');
            emit('herofalls', spireX, 0.02, 0.6);
            chronicle(`${T(p.name)} climbed to the cave of ${T(w.name)}, and did not come down.`);
            p.alive = false;
            p.deadAt = world.t;
            w.wrath += 1;
            w.state = 'wake';
            return;
          }
        }
        p.task = 'descend';
        return;
      }
      case 'descend':
        p.k = Math.max(0, p.k - dt / 25);
        if (p.k <= 0) {
          p.task = 'leave';
          if (p.kind === 'hero') {
            say(`${p.name} COMES DOWN FROM THE SPIRE`, spireX, 0.04, 20, '#bbf7d0', 'medium');
            world.festival = world.t + 40;
          }
        }
        return;
      case 'leave':
        if (walk(p, p.x < GW / 2 ? -40 : GW + 40, 0.6, SPEED.hero, dt)) {
          p.alive = false;
          p.deadAt = -999;
        }
        return;
      default:
        return;
    }
  }
  function brute(p: Person, dt: number) {
    if (p.kind === 'troll') {
      // Under the bridge: it comes up for carts and cattle.
      const prey = world.people.find((q) => q.alive && (q.kind === 'cart' || q.kind === 'villager' || q.kind === 'merchant') && dist(q.x, q.z, p.x, p.z) < 160);
      if (prey) {
        p.task = 'hunt';
        walk(p, prey.x, prey.z, SPEED.troll, dt);
        if (dist(prey.x, prey.z, p.x, p.z) < 14) {
          p.swing = world.t;
          if (r() < dt * 0.6) {
            prey.alive = false;
            prey.deadAt = world.t;
            if (once(`troll-${Math.floor(world.t / 60)}`)) {
              say('THE TROLL UNDER THE BRIDGE TAKES ONE', p.x, p.z, 30, '#fca5a5', 'medium');
              emit('troll', p.x, p.z, 0.5);
            }
          }
        }
      } else walk(p, p.tx, p.tz, 10, dt);
      return;
    }
    // A giant wanders down, stamps on a field, throws rocks at the walls, and goes.
    if (p.task === 'leave') {
      if (walk(p, p.tx, p.tz, SPEED.giant, dt)) {
        p.alive = false;
        p.deadAt = -999;
      }
      return;
    }
    const target = world.buildings.filter((b) => b.state === 'standing' && b.kind !== 'tower').sort((a, b) => dist(a.x, a.z, p.x, p.z) - dist(b.x, b.z, p.x, p.z))[0];
    if (!target) return;
    if (dist(target.x, target.z, p.x, p.z) > 180) walk(p, target.x, target.z, SPEED.giant, dt);
    else if (r() < dt * 0.4) {
      p.swing = world.t;
      world.missiles.push({ kind: 'rock', x: p.x, z: p.z, h: 60, x1: target.x, z1: target.z, h1: 10, t0: world.t, dur: 1.4, to: -target.id, dmg: 0.3, seed: ids++ });
    }
    if (p.hp < 40 || world.t - p.t0 > 80) {
      p.task = 'leave';
      p.tx = p.x < GW / 2 ? -80 : GW + 80;
      p.tz = 0.15;
      say('THE GIANT GOES BACK TO THE HILLS', p.x, p.z, 80, '#bbf7d0', 'medium');
    }
  }
  /** Knights (and griffon riders) riding out against a dragon. */
  function sortie(p: Person, dt: number) {
    const d = world.dragons.find((x) => x.id === p.target && x.alive);
    if (!d || world.t > p.until) {
      p.task = 'idle';
      p.h = 0;
      return;
    }
    const flier = p.kind === 'rider';
    walk(p, d.x - p.facing * 30, flier ? d.z : Math.max(0.2, d.z), SPEED[p.kind], dt);
    if (flier) p.h += (Math.max(60, d.h) - p.h) * Math.min(1, dt * 1.5);
    p.facing = d.x > p.x ? 1 : -1;
    if (Math.abs(d.x - p.x) < 60 && (flier ? Math.abs(d.h - p.h) < 60 : d.h < 70)) {
      p.swing = world.t;
      if (r() < dt * 1.2) {
        hurtDragon(d, flier ? 14 : 18, p.name);
        fx('spark', d.x, d.z, d.h, 0.4, 6, '#fde68a');
      }
      if (r() < dt * 0.15 && d.kind !== 'drake') {
        fx('fire', p.x, p.z, p.h + 6, 1, 10, BREATH[d.breed]);
        p.hp -= 14;
        if (p.hp <= 0) {
          p.alive = false;
          p.deadAt = world.t;
          say(`${p.name} FALLS`, p.x, p.z, 40, '#fca5a5', 'medium');
          emit('knightfalls', p.x, p.z, 0.5);
        }
      }
    }
  }

  // ---- buildings: fire, plans ------------------------------------------------------------------------
  function ignite(b: Building, k: number) {
    if (b.state !== 'standing' && b.state !== 'building') return;
    b.fire = Math.min(1, b.fire + k);
    const s = world.settlements[b.settle];
    s.alarm = Math.max(s.alarm, world.t + 25);
  }
  function burnStep(dt: number) {
    for (const b of world.buildings) {
      if (b.fire <= 0) continue;
      b.fire = Math.min(1, b.fire + dt * 0.02);
      b.hp -= dt * b.fire * 0.012;
      if (r() < dt * b.fire * 3) fx('ember', b.x + (r() - 0.5) * b.w, b.z, 10 + r() * 20, 1.5, 3, '#fb923c');
      // Spread to a neighbour's roof.
      if (r() < dt * b.fire * 0.025) {
        const n = world.buildings.find((o) => o !== b && o.fire <= 0 && o.state === 'standing' && dist(o.x, o.z, b.x, b.z) < 50);
        if (n) ignite(n, 0.2);
      }
      if (b.hp <= 0) {
        b.fire = 0;
        b.state = 'ruin';
        b.progress = 0;
        fx('debris', b.x, b.z, 10, 1.4, b.w, '#57534e');
        fx('smoke', b.x, b.z, 16, 6, 18, '#57534e');
        emit('collapse', b.x, b.z, 0.2);
      }
    }
  }
  /** What each settlement builds next: houses as it grows, the rest as it needs. */
  function plan(s: Settlement) {
    if (world.buildings.some((b) => b.settle === s.id && (b.state === 'plot' || b.state === 'building'))) return;
    const has = (k: BKind) => world.buildings.some((b) => b.settle === s.id && b.kind === k);
    let kind: BKind = 'house';
    let w = 18;
    let rx = s.r * 0.9;
    if (world.policy === 'fortify' && world.buildings.filter((b) => b.kind === 'ballista').length < 2 + world.year % 3) {
      kind = 'ballista';
      w = 16;
      rx = s.r * 1.2;
    } else if (s.kind === 'village' && !has('church') && s.prosper > 0.7) {
      kind = 'church';
      w = 30;
    } else if (s.kind === 'village' && !has('granary') && s.grain > 20) {
      kind = 'granary';
      w = 22;
    } else if (r() < 0.15 && !has('mill') && s.kind === 'village') {
      kind = 'mill';
      w = 20;
      rx = s.r * 1.2;
    } else if (s.kind === 'village' && s.prosper > 0.85 && r() < 0.3 && !has('wall')) {
      // A palisade round a village that has grown.
      ring(s, s.r, 16, 'plot');
      say(`${s.name} RAISES A PALISADE`, s.x, s.z, 40, '#fde68a', 'medium');
      return;
    }
    const p = plotIn(s, rx, w);
    if (!p) {
      s.r += 12;
      return;
    }
    bld(kind, s, p[0], p[1], w, 'plot');
  }

  // ---- the dragons' lives --------------------------------------------------------------------------
  function hurtDragon(d: Dragon, dmg: number, by: string) {
    if (!d.alive) return;
    d.hp -= dmg;
    d.wrath += dmg * 0.002;
    if (d.hp > 0) return;
    d.alive = d.kind === 'wyrm' || d.kind === 'rival' ? true : false;
    d.state = 'fall';
    d.deadAt = world.t;
    d.alive = false;
    world.slain++;
    const what = d.kind === 'drake' || d.kind === 'hatchling' ? `A DRAKE IS BROUGHT DOWN BY ${by}` : `${d.name} IS SLAIN BY ${by}`;
    say(what, d.x, d.z, d.h, '#fde68a', d.kind === 'drake' ? 'medium' : 'high');
    emit(d.kind === 'drake' ? 'drakefalls' : 'dragonslain', d.x, d.z, d.kind === 'drake' ? 0.5 : 1);
    if (d.kind !== 'drake' && d.kind !== 'hatchling') {
      chronicle(`${T(d.name)} was slain by ${T(by)}. The valley feasted for a week.`);
      look('slain', d.x, d.z, d.h, 1.2, 12, 9);
      world.festival = world.t + 60;
      if (d.kind === 'wyrm') {
        // In time, another comes to the empty spire.
        later(150 + r() * 100, () => {
          const nw = dragon('wyrm', dragonName(r), [-200, 0.2, 400]);
          nw.state = 'arrive';
          nw.breed = pick(BREEDS[biome]);
          say(`${nw.name} COMES TO THE EMPTY SPIRE`, GW / 2, 0.2, 300, '#fb923c', 'high');
          emit('dragon', GW / 2, 0.2, 0.9);
          chronicle(`${T(nw.name)} came to the empty spire.`);
        });
      }
    }
  }
  const beastAt = (id: number) => world.beasts.find((b) => b.id === id);
  function fly(d: Dragon, dt: number, speed: number) {
    const dx = d.tx - d.x;
    const dz = (d.tz - d.z) * ZPX;
    const dh = d.th - d.h;
    const dd = Math.hypot(dx, dz, dh);
    d.wing += dt * (dh > 20 ? 9 : 6);
    if (Math.abs(dx) > 3) d.facing = dx > 0 ? 1 : -1;
    const st = speed * dt;
    if (dd <= st) {
      d.x = d.tx;
      d.z = d.tz;
      d.h = d.th;
      return true;
    }
    d.x += (dx / dd) * st;
    d.z += ((dz / dd) * st) / ZPX;
    d.h += (dh / dd) * st;
    return false;
  }
  function breathe(d: Dragon, dt: number, aim: (b: Building) => boolean) {
    d.breathing = world.t + 0.3;
    const reach = d.kind === 'drake' ? 60 : 110;
    for (let k = 0; k < (d.kind === 'drake' ? 1 : 3); k++) if (r() < dt * 8) fx(d.breed === 'frost' ? 'frost' : d.breed === 'venom' ? 'venom' : d.breed === 'storm' ? 'lightning' : 'fire', d.x + d.facing * (20 + r() * reach), d.z, Math.max(0, d.h * r() * 0.6), 1.1, 10 + r() * 10, BREATH[d.breed]);
    for (const b of world.buildings) {
      if (!aim(b) || Math.abs(b.x - (d.x + d.facing * reach * 0.6)) > reach * 0.7 || Math.abs(b.z - d.z) * ZPX > 60 || d.h > 200) continue;
      if (d.breed === 'frost') b.frozen = Math.min(1, b.frozen + dt * 0.4);
      else if (d.breed === 'venom') b.blight = Math.min(1, b.blight + dt * 0.4);
      if (d.breed !== 'frost' && d.breed !== 'venom') ignite(b, dt * (d.kind === 'drake' ? 0.15 : 0.5));
      else b.hp -= dt * 0.05;
    }
    for (const f of world.fields) if (d.x + d.facing * 60 > f.x0 && d.x + d.facing * 60 < f.x1 && d.z > f.z0 - 0.03 && d.z < f.z1 + 0.03 && d.h < 200) {
      if (d.breed === 'frost') f.frozen = 1;
      else if (d.breed === 'venom' || d.breed === 'shadow') f.blight = 1;
      else f.burnt = 1;
    }
    for (const tr of world.trees) if (tr.burnt < 0 && tr.felled < 0 && Math.abs(tr.x - (d.x + d.facing * 60)) < 50 && Math.abs(tr.z - d.z) * ZPX < 50 && d.h < 200 && d.breed !== 'frost') tr.burnt = world.t;
    for (const p of world.people) if (p.alive && !p.hidden && Math.abs(p.x - (d.x + d.facing * 60)) < 40 && Math.abs(p.z - d.z) * ZPX < 40 && d.h < 160 && r() < dt * 0.8) {
      if (p.kind === 'knight' || p.kind === 'hero' || p.kind === 'rider') p.hp -= 10;
      else p.hp -= 8;
      if (p.hp <= 0) {
        p.alive = false;
        p.deadAt = world.t;
      }
    }
  }
  function raid(d: Dragon, s: Settlement) {
    d.state = 'raid';
    d.target = s.id;
    d.t0 = world.t;
    d.cd = 0;
    s.alarm = world.t + 60;
    s.raided = world.t;
    say(`${d.name} FALLS ON ${s.name}`, s.x, s.z, 120, '#fca5a5', 'high');
    emit(d.breed === 'fire' ? 'dragonfire' : `${d.breed}breath`, s.x, s.z, 0.9);
    emit('raid', s.x, s.z, 0.9);
    chronicle(`${T(d.name)} fell on ${T(s.name)}.`);
    look('raid', s.x, s.z, 70, 1.45, 16, 8);
    beacons(s);
    // The knights ride out; the riders take wing.
    for (const p of world.people) if (p.alive && (p.kind === 'knight' || p.kind === 'rider') && p.task !== 'sortie' && r() < 0.8) {
      p.task = 'sortie';
      p.target = d.id;
      p.until = world.t + 50;
    }
    if (once(`horn-${Math.floor(world.t / 30)}`)) later(3, () => say(`THE KNIGHTS OF ${town.name} RIDE OUT`, town.x, town.z, 40, '#bfdbfe', 'medium'));
  }
  /** The beacons are lit, tower to tower, from the nearest outward, and the bells ring. */
  function beacons(s: Settlement) {
    const towers = world.buildings.filter((b) => b.kind === 'tower' && b.state === 'standing').sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x));
    towers.forEach((b, k) => later(k * 1.4, () => {
      b.beacon = world.t;
      emit('beacon', b.x, b.z, 0.15);
    }));
    for (const o of world.settlements) o.alarm = Math.max(o.alarm, world.t + 30 + Math.abs(o.x - s.x) / 100);
    emit('bell', s.x, s.z, 0.3);
  }
  function wyrmStep(d: Dragon, dt: number) {
    d.hunger = Math.min(1.5, d.hunger + dt * 0.004);
    d.wrath = Math.max(0, Math.min(3, d.wrath + dt * 0.002 * (0.5 + wrathK) - (world.policy === 'appease' ? dt * 0.002 : 0)));
    switch (d.state) {
      case 'sleep':
      case 'bask': {
        const [x, z, h] = perch(0);
        d.tx = x;
        d.tz = z;
        d.th = h;
        fly(d, dt, 80);
        d.wing += dt * (d.state === 'bask' ? 1.5 : 0.4);
        if (world.t - d.t0 < 12) return;
        // Wake, bask in the sun, go out.
        if (d.state === 'sleep' && !night() && r() < dt * 0.06) {
          d.state = 'bask';
          d.t0 = world.t;
          emit('wake', d.x, d.z, 0.2);
        } else if (d.state === 'bask' && r() < dt * 0.05) {
          d.t0 = world.t;
          if (d.wrath > 1 && world.director.want('raid', 0.75, 150)) {
            const s = world.settlements.slice().sort((a, b) => (a.raided - b.raided) + (r() - 0.5) * 100)[0];
            raid(d, s);
          } else if (d.hunger > 0.6 && world.director.want('hunt', 0.35, 60)) {
            const b = pick(world.beasts.filter((x) => x.alive && !x.carried));
            if (b) {
              d.state = 'hunt';
              d.target = b.id;
              emit('hunt', b.x, b.z, 0.3);
              look('hunt', b.x, b.z, 50, 1.45, 9, 4);
            }
          } else {
            d.state = 'patrol';
            emit('patrol', d.x, d.z, 0.1);
          }
        } else if (d.state === 'bask' && night() && r() < dt * 0.1) {
          d.state = 'sleep';
          d.t0 = world.t;
        }
        return;
      }
      case 'wake':
        d.state = 'bask';
        d.t0 = world.t - 12;
        d.wrath = Math.max(d.wrath, 1.2);
        return;
      case 'patrol': {
        // A wide circle over the valley.
        const a = (world.t - d.t0) * 0.08;
        d.tx = GW / 2 + Math.cos(a) * GW * 0.38;
        d.tz = 0.4 + Math.sin(a) * 0.25;
        d.th = 280 + Math.sin(a * 2) * 60;
        fly(d, dt, 160);
        if (world.t - d.t0 > 60) d.state = 'return';
        return;
      }
      case 'hunt': {
        const b = beastAt(d.target);
        if (!b || !b.alive) {
          d.state = 'return';
          return;
        }
        d.tx = b.x;
        d.tz = b.z;
        d.th = 6;
        if (fly(d, dt, 220) || (Math.abs(d.x - b.x) < 12 && Math.abs(d.z - b.z) < 0.02 && d.h < 20)) {
          b.carried = true;
          d.carry = b.id;
          d.state = 'return';
          d.hunger = 0;
          const s = world.settlements.slice().sort((a, c) => dist(a.x, a.z, b.x, b.z) - dist(c.x, c.z, b.x, b.z))[0];
          if (d.kind === 'wyrm') {
            say(`${d.name} TAKES CATTLE FROM ${s.name}`, b.x, b.z, 40, '#fca5a5', 'medium');
            chronicle(`${T(d.name)} took cattle from the pastures of ${T(s.name)}.`);
          } else if (once(`drakehunt-${Math.floor(world.t / 45)}`)) say(`A DRAKE TAKES A ${b.kind.toUpperCase()} FROM ${s.name}`, b.x, b.z, 40, '#fca5a5', 'low');
          emit('taken', b.x, b.z, d.kind === 'wyrm' ? 0.5 : 0.25);
        }
        return;
      }
      case 'raid': {
        const s = world.settlements[d.target];
        // Passes over the roofs, breathing.
        const age = world.t - d.t0;
        const pass = Math.floor(age / 6);
        const dir = pass % 2 ? -1 : 1;
        d.tx = s.x + dir * (s.r + 140);
        d.tz = s.z + Math.sin(pass * 1.7) * 0.04;
        d.th = 70;
        fly(d, dt, 210);
        if (Math.abs(d.x - s.x) < s.r + 40) breathe(d, dt, (b) => b.settle === s.id);
        if (age > 26 + d.wrath * 6) {
          d.state = 'return';
          d.wrath = Math.max(0, d.wrath - 1.2);
          emit('sated', d.x, d.z, 0.3);
        }
        return;
      }
      case 'cavefight':
        d.wing += dt * 6;
        if (r() < dt * 2) d.breathing = world.t + 0.3;
        if (!world.people.some((p) => p.id === d.target && p.alive && p.task === 'cave')) d.state = 'bask';
        return;
      case 'arrive':
      case 'return': {
        const [x, z, h] = perch(0);
        d.tx = x;
        d.tz = z;
        d.th = h;
        if (fly(d, dt, 180)) {
          if (d.carry >= 0) {
            const b = beastAt(d.carry);
            if (b) b.alive = false;
            d.carry = -1;
          }
          d.state = 'bask';
          d.t0 = world.t;
        }
        return;
      }
      case 'flee': {
        d.tx = d.x < GW / 2 ? -400 : GW + 400;
        d.tz = 0.1;
        d.th = 500;
        if (fly(d, dt, 200)) {
          d.state = 'away';
          d.t0 = world.t;
          d.hp = d.hpMax * 0.7;
        }
        return;
      }
      case 'away':
        // Healing, far off; it comes back in time.
        if (world.t - d.t0 > 120) {
          d.state = 'arrive';
          d.wrath = 2;
          say(`${d.name} RETURNS, HEALED, AND ANGRY`, GW / 2, 0.2, 300, '#fb923c', 'high');
          emit('returns', GW / 2, 0.2, 0.8);
        }
        return;
      case 'fall':
        d.th = 0;
        d.tz = Math.max(0.2, d.z);
        d.tx = d.x + d.facing * 60;
        fly(d, dt, 180);
        return;
      case 'duel':
        return;
      default:
        d.state = 'bask';
    }
    if (d.hp < d.hpMax * 0.25 && d.state !== 'flee' && d.state !== 'fall' && d.state !== 'away') {
      d.state = 'flee';
      say(`${d.name} FLEES, WOUNDED`, d.x, d.z, d.h, '#fde68a', 'high');
      emit('wyrmflees', d.x, d.z, 0.8);
    }
  }
  function drakeStep(d: Dragon, dt: number) {
    d.hunger = Math.min(1.5, d.hunger + dt * 0.012);
    switch (d.state) {
      case 'roost': {
        const k = world.dragons.filter((x) => x.kind === 'drake' || x.kind === 'hatchling').indexOf(d);
        const [x, z, h] = perch(1 + Math.max(0, k));
        d.tx = x;
        d.tz = z;
        d.th = h;
        fly(d, dt, 120);
        d.wing += dt * 0.5;
        if (d.hunger > 0.6 && r() < dt * 0.05 && world.director.want('drakehunt', 0.2, 18)) {
          const prey = pick(world.beasts.filter((b) => b.alive && !b.carried));
          if (prey) {
            d.state = 'hunt';
            d.target = prey.id;
            emit('drake', prey.x, prey.z, 0.2);
          }
        } else if (d.kind === 'drake' && r() < dt * 0.006 && world.director.want('harass', 0.35, 70)) {
          const s = pick(world.settlements);
          d.state = 'harass';
          d.target = s.id;
          d.t0 = world.t;
          s.alarm = world.t + 25;
          say(`A DRAKE HARRIES ${s.name}`, s.x, s.z, 100, '#fca5a5', 'medium');
          emit('harass', s.x, s.z, 0.45);
          beacons(s);
          look('raid', s.x, s.z, 50, 1.5, 8, 5);
        }
        return;
      }
      case 'hunt':
        wyrmStep(d, dt);
        if ((d.state as string) === 'return') d.state = 'back';
        return;
      case 'harass': {
        const s = world.settlements[d.target];
        const age = world.t - d.t0;
        const dir = Math.floor(age / 4) % 2 ? -1 : 1;
        d.tx = s.x + dir * (s.r + 60);
        d.tz = s.z;
        d.th = 50;
        fly(d, dt, 190);
        if (Math.abs(d.x - s.x) < s.r) breathe(d, dt, (b) => b.settle === s.id);
        if (age > 16) d.state = 'back';
        return;
      }
      case 'back': {
        const [x, z, h] = perch(1);
        d.tx = x;
        d.tz = z;
        d.th = h;
        if (fly(d, dt, 160)) {
          if (d.carry >= 0) {
            const b = beastAt(d.carry);
            if (b) b.alive = false;
            d.carry = -1;
          }
          d.state = 'roost';
          d.hunger = 0;
        }
        return;
      }
      case 'fall':
        d.th = 0;
        fly(d, dt, 150);
        return;
      default:
        d.state = 'roost';
    }
  }
  /** A rival: it comes over the mountains, and the two fight in the sky. */
  function rivalStep(d: Dragon, dt: number) {
    const w = world.dragons.find((x) => x.kind === 'wyrm' && x.alive);
    if (d.state === 'fall') {
      d.th = 0;
      fly(d, dt, 180);
      return;
    }
    if (!w) {
      // The spire is free: it takes it.
      d.kind = 'wyrm';
      d.state = 'arrive';
      say(`${d.name} TAKES THE SPIRE`, d.x, d.z, d.h, '#fb923c', 'high');
      chronicle(`${T(d.name)} took the spire.`);
      return;
    }
    if (w.state !== 'duel') {
      w.state = 'duel';
      w.target = d.id;
    }
    const a = (world.t - d.t0) * 0.7;
    const cx = spireX - 260;
    w.tx = cx + Math.cos(a) * 180;
    w.tz = 0.3 + Math.sin(a) * 0.12;
    w.th = 300 + Math.sin(a * 1.3) * 60;
    d.tx = cx + Math.cos(a + Math.PI) * 180;
    d.tz = 0.3 + Math.sin(a + Math.PI) * 0.12;
    d.th = 300 + Math.sin(a * 1.3 + 1) * 60;
    fly(w, dt, 200);
    fly(d, dt, 200);
    if (r() < dt * 1.2) {
      const [att, def2] = r() < 0.5 ? [w, d] : [d, w];
      att.breathing = world.t + 0.4;
      att.facing = def2.x > att.x ? 1 : -1;
      fx('fire', def2.x, def2.z, def2.h, 0.8, 18, BREATH[att.breed]);
      hurtDragon(def2, 12 + r() * 10, att.name);
    }
    if (w.hp < w.hpMax * 0.2) {
      w.state = 'flee';
      say(`${w.name} IS DRIVEN FROM ITS SPIRE BY ${d.name}`, w.x, w.z, w.h, '#fca5a5', 'high');
      emit('newwyrm', w.x, w.z, 0.95);
      chronicle(`${T(d.name)} drove ${T(w.name)} from the spire, and took it.`);
      d.kind = 'wyrm';
      d.state = 'return';
      w.kind = 'rival';
      later(1, () => {
        w.alive = false;
        w.deadAt = world.t;
      });
    } else if (d.hp < d.hpMax * 0.2) {
      d.state = 'fall';
      d.alive = false;
      d.deadAt = world.t;
      say(`${w.name} THROWS DOWN ${d.name}`, d.x, d.z, d.h, '#fde68a', 'high');
      emit('dragonfight', d.x, d.z, 0.95);
      chronicle(`${T(w.name)} fought ${T(d.name)} over the valley, and threw it down.`);
      w.state = 'return';
    }
    look('duel', (w.x + d.x) / 2, (w.z + d.z) / 2, (w.h + d.h) / 2, 0.95, 2, 7);
  }
  function defenders(dt: number) {
    const flying = world.dragons.filter((d) => d.alive && d.state !== 'sleep' && d.state !== 'bask' && d.state !== 'roost' && d.h < 360);
    if (!flying.length) return;
    for (const p of world.people) {
      if (!p.alive || p.hidden || (p.kind !== 'archer' && p.kind !== 'guard')) continue;
      const d = flying.find((x) => Math.abs(x.x - p.x) < 320 && Math.abs(x.z - p.z) * ZPX < 260);
      if (!d) continue;
      p.k -= dt;
      if (p.k > 0) continue;
      p.k = 1.4 + r();
      p.swing = world.t;
      p.facing = d.x > p.x ? 1 : -1;
      world.missiles.push({ kind: 'arrow', x: p.x, z: p.z, h: 14, x1: d.x + (r() - 0.5) * 20, z1: d.z, h1: d.h, t0: world.t, dur: 0.6 + Math.abs(d.h) / 600, to: d.id, dmg: d.kind === 'drake' ? 4 : 2, seed: ids++ });
    }
    for (const b of world.buildings) {
      if (b.kind !== 'ballista' || b.state !== 'standing') continue;
      const d = flying.find((x) => Math.abs(x.x - b.x) < 420);
      b.cd -= dt;
      if (!d || b.cd > 0) continue;
      b.cd = 4;
      world.missiles.push({ kind: 'bolt', x: b.x, z: b.z, h: 34, x1: d.x, z1: d.z, h1: d.h, t0: world.t, dur: 0.7, to: d.id, dmg: 22, seed: ids++ });
      emit('ballista', b.x, b.z, 0.1);
    }
    // The wizard.
    for (const p of world.people) if (p.alive && p.kind === 'wizard') {
      const d = flying.find((x) => Math.abs(x.x - p.x) < 500);
      p.k -= dt;
      if (!d || p.k > 0) continue;
      p.k = 3;
      p.swing = world.t;
      world.missiles.push({ kind: 'spell', x: p.x, z: p.z, h: 20, x1: d.x, z1: d.z, h1: d.h, t0: world.t, dur: 0.5, to: d.id, dmg: 16, seed: ids++ });
    }
  }
  function missiles() {
    for (let i = world.missiles.length - 1; i >= 0; i--) {
      const m = world.missiles[i];
      if (world.t - m.t0 < m.dur) continue;
      world.missiles.splice(i, 1);
      if (m.to < 0) {
        const b = world.buildings.find((x) => x.id === -m.to);
        if (b) {
          b.hp -= m.dmg;
          fx('debris', b.x, b.z, 14, 1, 10, '#78716c');
          if (b.hp <= 0) {
            b.state = 'ruin';
            b.fire = 0;
          }
        }
        continue;
      }
      const d = world.dragons.find((x) => x.id === m.to);
      if (d && d.alive && r() < (m.kind === 'arrow' ? 0.5 : 0.8)) {
        hurtDragon(d, m.dmg, m.kind === 'bolt' ? 'A BALLISTA BOLT' : m.kind === 'spell' ? 'THE WIZARD' : 'THE ARCHERS');
        fx('spark', m.x1, m.z1, m.h1, 0.4, 5, m.kind === 'spell' ? '#c4b5fd' : '#fde68a');
      }
    }
  }

  // ---- the seasons, the lord, the pageants -----------------------------------------------------------
  function setPolicy() {
    const damage = world.settlements.reduce((s, x) => s + (world.t - x.raided < SEASON * 4 ? 1 : 0), 0);
    const was = world.policy;
    world.policy = world.temper === 'bold' ? (damage > 0 ? 'hunt' : 'fortify') : world.temper === 'cautious' ? (damage > 1 ? 'appease' : 'fortify') : damage > 0 ? 'appease' : 'endure';
    if (was !== world.policy) {
      const what = { endure: 'TO ENDURE', fortify: 'TO FORTIFY THE VALLEY', appease: 'TRIBUTE TO THE WYRM', hunt: 'A HUNT: HEROES ARE SUMMONED' }[world.policy];
      say(`${world.lord} DECREES ${what}`, town.x, town.z, 80, '#e7dcc4', 'high');
      emit('policy', town.x, town.z, 0.4);
      chronicle(`${T(world.lord)} decreed ${what.toLowerCase()}.`);
    }
  }
  function seasonTurn(s: number) {
    world.season = s;
    if (s === 0) {
      world.year++;
      setPolicy();
      for (const f of world.fields) {
        f.plowed = 0;
        f.grown = 0;
        f.harvested = 0;
        f.burnt = 0;
        f.frozen = 0;
        f.blight = Math.max(0, f.blight - 0.5);
      }
      for (const tr of world.trees) if (tr.felled >= 0 && world.t - tr.felled > 200) tr.felled = -1;
      if (clutch > 0 && world.dragons.some((d) => d.kind === 'wyrm' && d.alive)) {
        clutch--;
        const [x, z, h] = perch(2);
        dragon('drake', 'A HATCHLING', [x, z, h]).hp = 25;
        say('AN EGG HATCHES IN THE SPIRE', x, z, h, '#fb923c', 'high');
        emit('hatch', x, z, 0.7);
        chronicle('An egg hatched in the spire. The valley counted its cattle.');
        look('hatch', x, z, h, 1.6, 8, 6);
      }
    }
    if (s === 2) for (const f of world.fields) f.grown = Math.max(f.grown, 0.85);
    emit(SEASONS[s].toLowerCase(), GW / 2, 0.5, 0.15);
    if (s === 3 && once(`yule-${world.year}`)) later(40, () => {
      world.festival = world.t + 45;
      say(`THE FESTIVAL OF LANTERNS IN ${town.name}`, town.x, town.z, 60, '#fde68a', 'high');
      emit('festival', town.x, town.z, 0.6);
      look('festival', town.x, town.z, 40, 1.3, 12, 4);
    });
    if (s === 2 && drew('fair')) later(20, () => {
      world.fair = world.t + 60;
      say(`THE GREAT FAIR OF ${town.name}`, town.x, town.z, 60, '#fde68a', 'high');
      emit('fair', town.x, town.z, 0.5);
      for (let k = 0; k < 6; k++) caravan(true);
    });
    if (world.policy === 'appease' && s !== 3) later(10, () => tribute());
  }
  function caravan(quiet = false) {
    const fromLeft = r() < 0.5;
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const p = person(k === 0 ? 'merchant' : 'cart', town, fromLeft ? -20 - k * 20 : GW + 20 + k * 20, fromLeft ? world.road[0][1] : world.road[world.road.length - 1][1]);
      if (p.kind === 'merchant') p.kind = 'cart';
      p.k = fromLeft ? 1 : world.road.length - 2;
      p.facing = fromLeft ? 1 : -1;
      if (!fromLeft) world.road = world.road;
    }
    if (!quiet) emit('caravan', fromLeft ? 0 : GW, 0.6, 0.15);
  }
  function tribute() {
    const p = person('cart', town, town.x, town.z + 0.02, 'THE TRIBUTE');
    p.task = 'tribute';
    p.carry = 'gold';
    say(`${world.lord} SENDS TRIBUTE TO THE SPIRE`, town.x, town.z, 40, '#fde68a', 'medium');
    emit('tribute', town.x, town.z, 0.3);
  }
  function hero() {
    let name = heroName(r);
    for (let k = 0; k < 6 && KNIGHTS.includes(name); k++) name = heroName(r);
    const p = person('hero', town, r() < 0.5 ? -30 : GW + 30, 0.62, name);
    p.task = 'arrive';
    p.hp = 60;
    say(`${p.name} COMES TO ${town.name}`, p.x, p.z, 30, '#fde68a', 'medium');
    emit('herocomes', p.x, p.z, 0.4);
  }
  function thief() {
    const p = person('thief', town, town.x, town.z, 'THIEVES');
    p.task = 'feast';
    p.until = world.t;
    emit('thieves', town.x, town.z, 0.2);
  }
  function joust() {
    const knights = world.people.filter((p) => p.alive && p.kind === 'knight' && p.task !== 'sortie');
    const li = world.buildings.find((b) => b.kind === 'lists');
    if (knights.length < 2 || !li) return;
    const [a, b] = [knights[0], knights[1]];
    world.joust = { a: a.id, b: b.id, t0: world.t };
    say(`A TOURNAMENT AT ${town.name}: ${a.name} AGAINST ${b.name}`, li.x, li.z, 40, '#fde68a', 'high');
    emit('tournament', li.x, li.z, 0.55);
    look('joust', li.x, li.z, 20, 1.7, 14, 5);
  }
  function joustStep(dt: number) {
    const j = world.joust;
    if (!j) return;
    const a = world.people.find((p) => p.id === j.a);
    const b = world.people.find((p) => p.id === j.b);
    const li = world.buildings.find((x) => x.kind === 'lists');
    if (!a || !b || !li || !a.alive || !b.alive) {
      world.joust = null;
      return;
    }
    const age = world.t - j.t0;
    const run = Math.floor(age / 4);
    const u = (age % 4) / 4;
    const side = run % 2 ? -1 : 1;
    a.task = b.task = 'joust';
    a.x = li.x + side * (li.w / 2) * (1 - 2 * u);
    b.x = li.x - side * (li.w / 2) * (1 - 2 * u);
    a.z = li.z - 0.006;
    b.z = li.z + 0.006;
    a.facing = side < 0 ? 1 : -1;
    b.facing = side < 0 ? -1 : 1;
    a.anim += dt * 12;
    b.anim += dt * 12;
    if (Math.abs(u - 0.5) < dt / 4 * 1.01) {
      fx('spark', li.x, li.z, 14, 0.5, 8, '#fde68a');
      emit('clash', li.x, li.z, 0.1);
    }
    if (age > 12) {
      const [win, lose] = r() < 0.5 ? [a, b] : [b, a];
      say(`${win.name} UNHORSES ${lose.name}`, li.x, li.z, 40, '#fde68a', 'high');
      emit('joust', li.x, li.z, 0.5);
      chronicle(`${T(win.name)} won the tournament at ${T(town.name)}.`);
      for (let k = 0; k < 20; k++) fx('confetti', li.x + (r() - 0.5) * li.w, li.z, 20 + r() * 20, 2, 2, pick(['#fde68a', '#f87171', '#60a5fa', '#ffffff']));
      a.task = b.task = 'idle';
      world.joust = null;
    }
  }

  // ---- the frame -------------------------------------------------------------------------------------
  function establish() {
    const p = r();
    // Mostly the whole valley, sky and spire and all: it is a wallpaper.
    if (p < 0.45) return { x: GW * (0.2 + r() * 0.6), y: GH * 0.5, zoom: 0.5 };
    if (p < 0.55) {
      const [x, y] = sy(spireX, 0.05, 160);
      return { x, y, zoom: 0.95 };
    }
    if (p < 0.8) {
      const s = pick(world.settlements);
      const [x, y] = sy(s.x, s.z, 20);
      return { x, y, zoom: 1.15 };
    }
    const busy = world.people.filter((q) => q.alive && !q.hidden && q.task !== 'idle');
    const q = busy[Math.floor(r() * busy.length)];
    if (q) {
      const [x, y] = sy(q.x, q.z, 10);
      return { x, y, zoom: 1.6 };
    }
    return { x: GW / 2, y: GH / 2, zoom: 1 };
  }
  let lastSeason = world.season;
  const seasonBase = world.season;
  let nextPlan = 2;
  let nextEvent = 10;
  let nextTraveller = 6;
  function step(dt: number) {
    world.t += dt;
    world.day = (world.day + dt / DAY) % 1;
    world.director.step(world.t, dt);
    for (let i = pending.length - 1; i >= 0; i--) if (world.t >= pending[i].at) {
      const f = pending[i].fn;
      pending.splice(i, 1);
      f();
    }
    const s = (seasonBase + Math.floor(world.t / SEASON)) % 4;
    if (s !== lastSeason) {
      lastSeason = s;
      seasonTurn(s);
    }
    // Fields grow by the season.
    for (const f of world.fields) {
      if (world.season === 0 && f.plowed > 0.6) f.grown = Math.min(0.4, f.grown + dt * 0.002);
      if (world.season === 1) f.grown = Math.min(1, f.grown + dt * 0.003);
    }
    for (const p of world.people) {
      if (!p.alive) continue;
      if (p.task === 'idle' || (p.task !== 'joust' && world.t > p.until + 40 && p.kind !== 'hero' && p.kind !== 'thief' && p.kind !== 'cart' && p.kind !== 'pilgrim' && p.kind !== 'giant' && p.kind !== 'troll' && p.task !== 'sortie')) {
        if (world.t >= p.until) think(p);
      }
      if (p.task === 'tribute') {
        if (walk(p, spireX, 0.05, SPEED.cart, dt)) {
          world.spire.hoard += 100;
          for (const d of world.dragons) if (d.kind === 'wyrm') d.wrath = Math.max(0, d.wrath - 0.8);
          say('THE TRIBUTE IS LEFT AT THE FOOT OF THE SPIRE', spireX, 0.05, 30, '#fde68a', 'medium');
          p.task = 'leave';
          p.kind = 'cart';
          p.k = 0;
          p.carry = '';
        }
        continue;
      }
      if (p.task !== 'joust') act(p, dt);
    }
    // Herds wander their pastures.
    for (const b of world.beasts) {
      if (!b.alive) continue;
      if (b.carried) {
        const d = world.dragons.find((x) => x.carry === b.id);
        if (d) {
          b.x = d.x;
          b.z = d.z;
        }
        continue;
      }
      b.anim += dt;
      if (r() < dt * 0.1) {
        const tx = b.hx + (r() - 0.5) * 140;
        const tz = b.hz + (r() - 0.5) * 0.06;
        if (!wet(tx, tz)) {
          b.x += (tx - b.x) * 0.15;
          b.z += (tz - b.z) * 0.15;
        }
      }
    }
    // The herds are bred back up.
    if (r() < dt * 0.02) {
      const dead = world.beasts.find((b) => !b.alive);
      if (dead) {
        dead.alive = true;
        dead.carried = false;
        dead.x = dead.hx;
        dead.z = dead.hz;
      }
    }
    for (const d of world.dragons) {
      if (!d.alive && d.state !== 'fall') continue;
      if (d.state === 'fall' && d.h <= 1) continue;
      if (d.kind === 'wyrm') wyrmStep(d, dt);
      else if (d.kind === 'rival') rivalStep(d, dt);
      else drakeStep(d, dt);
    }
    defenders(dt);
    missiles();
    burnStep(dt);
    joustStep(dt);
    if (world.t >= nextPlan) {
      nextPlan = world.t + 6;
      for (const st of world.settlements) {
        st.prosper = Math.min(1, st.prosper + 0.005);
        if (st.wood > 2 || st.prosper > 0.6) plan(st);
      }
    }
    if (world.t >= nextTraveller) {
      nextTraveller = world.t + 20 + r() * 25;
      if (drew('caravans') || r() < 0.4) caravan();
      if (drew('pilgrims') && r() < 0.5) {
        const sh = world.buildings.find((b) => b.kind === 'shrine');
        if (sh) for (let k = 0; k < 4; k++) {
          const p = person('pilgrim', world.settlements[sh.settle], -20 - k * 14, world.road[0][1]);
          p.k = 1;
          p.facing = 1;
        }
      }
    }
    if (world.t >= nextEvent) {
      nextEvent = world.t + 8;
      if (world.policy === 'hunt' && !world.people.some((p) => p.kind === 'hero' && p.alive) && world.director.want('hero', 0.6, 150)) hero();
      else if (!world.people.some((p) => p.kind === 'hero' && p.alive) && world.t > 200 && world.director.want('hero', 0.7, 300)) hero();
      if (night() && world.director.want('thieves', 0.4, 240)) thief();
      if (drew('tournament') && !world.joust && world.director.want('joust', 0.4, 150) && world.t > 30) joust();
      if (drew('rival') && !world.dragons.some((d) => d.kind === 'rival' && d.alive) && world.t > 240 && world.director.want('rival', 0.85, 600)) {
        const d = dragon('rival', dragonName(r), [r() < 0.5 ? -300 : GW + 300, 0.2, 400]);
        d.breed = pick(BREEDS[biome].concat(['fire']));
        d.color = (wyrm.color + 1 + Math.floor(r() * 3)) % 4;
        d.state = 'duel';
        d.t0 = world.t;
        say(`A RIVAL, ${d.name}, COMES FOR THE SPIRE`, GW / 2, 0.2, 400, '#fb923c', 'high');
        emit('rival', GW / 2, 0.2, 0.9);
        chronicle(`${T(d.name)} came over the mountains to take the spire.`);
      }
      if (drew('giants') && !world.people.some((p) => p.kind === 'giant' && p.alive) && world.director.want('giant', 0.55, 300)) {
        const p = person('giant', town, r() < 0.5 ? -60 : GW + 60, 0.2, 'THE HILL GIANT');
        p.task = 'stomp';
        say('A HILL GIANT COMES DOWN INTO THE VALLEY', p.x, p.z, 100, '#fca5a5', 'high');
        emit('giant', p.x, p.z, 0.7);
        look('giant', p.x < 0 ? 200 : GW - 200, 0.25, 80, 1.1, 10, 5);
      }
      if (drew('avalanche') && world.season === 3 && world.director.want('avalanche', 0.5, 300)) {
        const x = r() * GW;
        for (let k = 0; k < 20; k++) fx('dust', x + (r() - 0.5) * 200, 0.02, 200 - k * 8, 3, 30, '#f1f5f9');
        say('AN AVALANCHE ON THE HIGH SLOPES', x, 0.02, 200, '#e2e8f0', 'medium');
        emit('avalanche', x, 0.02, 0.5);
      }
      if (drew('eruption') && world.director.want('eruption', 0.6, 360)) {
        for (let k = 0; k < 30; k++) fx('ember', GW * 0.1 + r() * 60, 0, 300 + r() * 200, 4, 4, '#f97316');
        say('THE MOUNTAIN SMOKES AND SPITS FIRE', GW * 0.1, 0, 300, '#fb923c', 'medium');
        emit('eruption', GW * 0.1, 0, 0.6);
      }
      if (drew('floods') && world.season === 0 && world.director.want('flood', 0.5, 400) && world.river) {
        for (const f of world.fields) if (Math.abs((world.river?.at((f.z0 + f.z1) / 2) ?? 0) - (f.x0 + f.x1) / 2) < 260) f.blight = 0.6;
        say('THE RIVER FLOODS THE FIELDS', world.river.at(0.6), 0.6, 20, '#93c5fd', 'medium');
        emit('flood', world.river.at(0.6), 0.6, 0.5);
      }
    }
    // A troll under the bridge, if the cast says.
    if (drew('trolls') && world.river && !world.people.some((p) => p.kind === 'troll') && world.t > 20) {
      const bz = world.road.reduce((best, pt) => (Math.abs((world.river?.at(pt[1]) ?? 0) - pt[0]) < Math.abs((world.river?.at(best[1]) ?? 0) - best[0]) ? pt : best))[1];
      const p = person('troll', town, world.river.at(bz), bz + 0.01, 'THE TROLL');
      p.tx = p.x;
      p.tz = p.z;
    }
    for (const b of world.boats) {
      if (!world.lake) break;
      b.x += b.dir * 8 * dt;
      if (b.x < world.lake.x0 + 20 || b.x > world.lake.x1 - 20) b.dir = b.dir > 0 ? -1 : 1;
    }
    world.people = world.people.filter((p) => p.alive || (p.deadAt > 0 && world.t - p.deadAt < 8));
    for (let i = world.fx.length - 1; i >= 0; i--) if (world.t - world.fx[i].t0 > world.fx[i].dur) world.fx.splice(i, 1);
    if (world.fx.length > 600) world.fx.splice(0, world.fx.length - 600);
    for (let i = world.labels.length - 1; i >= 0; i--) if (world.t - world.labels[i].t0 > world.labels[i].dur) world.labels.splice(i, 1);
    world.dragons = world.dragons.filter((d) => d.alive || world.t - d.deadAt < 40);
  }

  world.director = createDirector(g.fork('director').rng, { arc: g.pick(ARCS), period: g.range(220, 360), floor: 0.3, establish });
  setPolicy();
  chronicle(`${T(wyrm.name)}, ${T(BREED_NAMES[breed].toLowerCase())}, sleeps on the spire above ${T(LAND_NAMES[biome].toLowerCase())} ${T(world.name)}.`);
  later(5, () => caravan());
  return world;
}
