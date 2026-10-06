/**
 * Leylines, the ink world: lines of power that grow, and the orders that grow them. No DOM.
 *
 * Nothing here is a fixed script. A seed's genome draws:
 * - the land (a blend of isles, steppe, forest, desert, tundra, marsh, mountains: sea and
 *   ridges shape where lines can run)
 * - the wells (how many, how strong, laid out scattered, clustered, ringed, in a line, or in
 *   a spiral)
 * - the orders (two to six, each a species of movers with its own way of growing: long
 *   filaments, veins, coral mazes, lace, webs), their colors from the page's palette, and
 *   their sigils
 * - the medium it is seen in
 * - the director's arc
 * - a cast of phenomena composed from a library (see systems.ts): storms, auroras, tides,
 *   mist, rifts, blights, quakes, eclipses, convergences, comets, starfalls, great works,
 *   wisps, leviathans, pilgrims, migrations. Some seeds draw two calamities and no wonders,
 *   some a quiet sky full of life.
 *
 * The lines are physarum trails (kit/physarum): each order's movers follow and lay their
 * own trail, avoid the others', and are drawn to the wells, so networks link the wells by
 * themselves and orders meet at living borders. Which order's trail dominates at a well
 * holds it; orders grow with the wells they hold, fade when they hold none, and new ones
 * rise at free wells. Power pulses out from the wells along the networks (a geodesic
 * distance field), and the land remembers old routes faintly (`memory`).
 *
 * Space: cells (`cols × rows`), `cell` px each; events and the camera are in px.
 */
import { compose, createDirector, createGenome, createPhysarum, Field, geodesic, ARCS, type Director, type Genome, type Glow, type Physarum, type Species, type SystemInstance } from '../../../kit';
import { createBus, type Bus } from '../../../sim/bus';
import type { Noise2D } from '../../../noise';
import type { Palette } from '../../../palette';
import { placeName } from '../names';
import { LIBRARY } from './systems';

export type Medium = 'night' | 'starchart' | 'lacquer' | 'vellum';
export type Arch = 'isles' | 'steppe' | 'forest' | 'desert' | 'tundra' | 'marsh' | 'mountains';
export const ARCHES: Arch[] = ['isles', 'steppe', 'forest', 'desert', 'tundra', 'marsh', 'mountains'];
export type Morph = 'filament' | 'veins' | 'coral' | 'lace' | 'web';
export type Sigil = { rings: number; sides: number; star: boolean; spokes: number; spin: number; dot: boolean };
export type Order = { slot: number; name: string; color: string; sigil: Sigil; morph: Morph; alive: boolean; born: number; wells: number; target: number; hostile: boolean; archmage: string; great: number };
export type Well = { id: number; x: number; y: number; power: number; owner: number; since: number; name: string; crater: boolean };
export type View = { sx(x: number): number; sy(y: number): number; z: number; t: number; glow: Glow; W: number; H: number; medium: Medium };
export type Attractor = { x: number; y: number; r: number; v: number; slot: number; until: number };

export type InkOptions = { land: string; orders: number; storms: number; rifts: number; scale: number };

export type InkWorld = {
  t: number; W: number; H: number; cols: number; rows: number; cell: number; bus: Bus; g: Genome;
  name: string; medium: Medium; land: Record<Arch, number>; landName: string;
  height: Float32Array; wall: Uint8Array;
  phys: Physarum; total: Field; memory: Field; dist: Float32Array; norm: number[];
  orders: Order[]; wells: Well[]; maxSlots: number;
  director: Director; systems: SystemInstance[]; cast: string[];
  attractors: Attractor[]; steer: ((i: number) => number)[];
  mods: { deposit: number; keep: number; speed: number; light: number };
  sparks: { x: number; y: number; t0: number; color: string }[];
  /** Title cards and chronicle lines for the painter (the sim only queues them). */
  tellings: { text: string; sub?: string; color: string; big: boolean; t: number }[];
  view: View | null;
  opts: InkOptions;
  /** Cell index under a px point. */
  idx(x: number, y: number): number;
  tell(text: string, color: string, big: boolean, sub?: string): void;
  emit(type: string, x: number, y: number, weight: number, text?: string): void;
  look(why: string, x: number, y: number, zoom: number, dur: number, priority: number): void;
  addWell(x: number, y: number, power: number, crater: boolean): Well | null;
  raiseOrder(at: Well | null, hostile?: boolean): Order | null;
  step(dt: number): void;
  counts(): Record<string, number>;
};

const MORPHS: Record<Morph, Omit<Species, 'repel'>> = {
  filament: { sa: 0.35, sd: 9, ra: 0.3, speed: 1.1, deposit: 1, diffuse: 0.25, keep: 0.94, jitter: 0.05 },
  veins: { sa: 0.55, sd: 6, ra: 0.45, speed: 1, deposit: 1, diffuse: 0.4, keep: 0.93, jitter: 0.1 },
  coral: { sa: 1.1, sd: 3, ra: 0.6, speed: 0.8, deposit: 1.6, diffuse: 0.6, keep: 0.91, jitter: 0.15 },
  lace: { sa: 0.8, sd: 5, ra: 0.9, speed: 1.2, deposit: 0.8, diffuse: 0.3, keep: 0.95, jitter: 0.25 },
  web: { sa: 0.45, sd: 14, ra: 0.25, speed: 1.4, deposit: 0.9, diffuse: 0.35, keep: 0.94, jitter: 0.08 },
};
const ADJ = ['HOLLOW', 'WEEPING', 'SILVER', 'DROWNED', 'BURNING', 'SLEEPING', 'BROKEN', 'HIDDEN', 'NINEFOLD', 'PALE', 'SINGING', 'BLIND', 'LAST', 'FIRST', 'GREY', 'STARLIT', 'BLACK', 'GILDED', 'SUNKEN', 'WHISPERING', 'THORNED', 'HORNED', 'MOONLESS', 'OLD', 'LOST', 'RED', 'WIDOW\'S', 'KING\'S', 'FROZEN', 'ASHEN'];
const NOUN = ['STONE', 'WELL', 'CROWN', 'GATE', 'MOUND', 'POOL', 'ALTAR', 'RING', 'EYE', 'LANTERN', 'FORD', 'SPRING', 'HARP', 'TOOTH', 'CAIRN', 'MIRROR', 'THRONE', 'BELL', 'ORCHARD', 'HEART', 'STAIR', 'SPINDLE', 'CHALICE', 'TOWER', 'GROVE', 'BARROW', 'LOOM', 'FURNACE', 'KEY', 'NEEDLE'];
const COLLECTIVE = ['CONCLAVE', 'CIRCLE', 'ORDER', 'COURT', 'SYNOD', 'HAND', 'CHOIR', 'LODGE', 'COVEN', 'CHAPTER', 'CABAL', 'COLLEGIUM', 'ASSEMBLY', 'COUNCIL', 'CANTICLE', 'COMPACT', 'SPIRAL', 'LANTERN'];
const SYL1 = ['MOR', 'IS', 'VAL', 'AU', 'SA', 'CA', 'NE', 'HAL', 'EL', 'ZA', 'MI', 'THO', 'OR', 'BE', 'LYS', 'KE', 'RA', 'VE'];
const SYL2 = ['GRETH', 'OLDE', 'DIS', 'RELIAN', 'BINE', 'DOC', 'RIS', 'LOR', 'SPETH', 'REK', 'RAEL', 'RN', 'WYN', 'THAS', 'ANDER', 'ORA', 'IEL', 'MOND'];
const HUE_WORDS: [number, string][] = [[0, 'CRIMSON'], [25, 'EMBER'], [45, 'AMBER'], [70, 'GOLDEN'], [110, 'VERDANT'], [150, 'JADE'], [185, 'TIDEWATER'], [210, 'AZURE'], [245, 'COBALT'], [275, 'VIOLET'], [305, 'UMBRAL'], [335, 'ROSE'], [360, 'CRIMSON']];
export const LAND_TITLES: Record<Arch, string> = { isles: 'THE SHATTERED ISLES', steppe: 'THE GREAT STEPPE', forest: 'THE ELDERWOOD', desert: 'THE GLASS DESERT', tundra: 'THE WHITE WASTE', marsh: 'THE DROWNED FENS', mountains: 'THE BROKEN PEAKS' };

const hueOf = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  const d = mx - mn;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

export function createInkWorld(seed: string | number, W: number, H: number, opts: InkOptions, noise: Noise2D, palette: Palette): InkWorld {
  const bus = createBus(() => world.t);
  const g = createGenome(seed, 'ink');
  const scale = Math.max(0.4, Math.min(2, opts.scale));
  const cols = Math.max(140, Math.min(300, Math.round((W / 5.2) * Math.sqrt(scale))));
  const rows = Math.max(90, Math.round((cols * H) / W));
  const cell = W / cols;
  const N = cols * rows;

  // ---- the medium and the land -------------------------------------------------------------
  const light = palette.theme === 'light';
  const medium: Medium = light ? 'vellum' : g.weighted({ night: 4, starchart: 2, lacquer: 2 });
  const forced = (ARCHES as string[]).includes(opts.land) ? (opts.land as Arch) : null;
  const land = forced ? (Object.fromEntries(ARCHES.map((a) => [a, a === forced ? 1 : 0])) as Record<Arch, number>) : g.blend(ARCHES, 2.2);
  const dominant = ARCHES.reduce((a, b) => (land[a] >= land[b] ? a : b));
  const height = new Float32Array(N);
  const wall = new Uint8Array(N);
  const rough = 1 + land.mountains * 2 + land.tundra * 0.6;
  const f0 = g.range(2.2, 4.2);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = x / cols;
      const v = y / rows;
      let n = noise.noise2(u * f0 * (W / Math.max(W, H)) * 1.6, v * f0 * (H / Math.max(W, H)) * 1.6) * 0.6 + noise.noise2(u * f0 * 4 + 9, v * f0 * 4) * 0.28 * rough + noise.noise2(u * 23, v * 23 + 4) * 0.12;
      // The isles go down into the sea at the edges; the marsh is low everywhere.
      const edge = Math.min(u, 1 - u, v, 1 - v);
      n += land.isles * (0.25 - Math.max(0, 0.2 - edge) * 3.5) - land.marsh * 0.15;
      height[y * cols + x] = n;
      // Only the isles and the fens have water: a sea, or meres.
      const sea = land.isles + land.marsh > 0.2 && n < -0.05 + land.isles * 0.12 + land.marsh * 0.08;
      const ridge = land.mountains > 0.25 && n > 0.62 - land.mountains * 0.25;
      if (sea || ridge) wall[y * cols + x] = 1;
    }
  }

  // ---- orders: species of movers -------------------------------------------------------------
  const maxSlots = 7;
  const nOrders = Math.max(2, Math.min(6, Math.round(opts.orders + g.normal(0, 0.8))));
  const colors = g.hues(palette.accent, maxSlots, { spread: g.weighted({ 50: 1, 120: 2, 180: 2, 300: 2 } as Record<string, number>) === '50' ? 50 : g.pick([120, 180, 300]), l: medium === 'vellum' ? 0.45 : g.range(0.72, 0.82), c: medium === 'vellum' ? 0.13 : g.range(0.13, 0.2) });
  const morphs = Object.keys(MORPHS) as Morph[];
  const species: Species[] = [];
  const orders: Order[] = [];
  const usedNames = new Set<string>();
  for (let s = 0; s < maxSlots; s++) {
    const morph = g.pick(morphs);
    const base = MORPHS[morph];
    species.push({
      sa: g.jitter(base.sa, 0.25), sd: g.jitter(base.sd, 0.25), ra: g.jitter(base.ra, 0.25), speed: g.jitter(base.speed, 0.15) * 0.9,
      deposit: g.jitter(base.deposit, 0.2), diffuse: g.jitter(base.diffuse, 0.2), keep: Math.min(0.975, g.jitter(base.keep, 0.02)), jitter: g.jitter(base.jitter, 0.3), repel: g.range(0.5, 1.4),
    });
    const hue = hueOf(colors[s]);
    const word = HUE_WORDS.reduce((a, b) => (Math.abs(b[0] - hue) < Math.abs(a[0] - hue) ? b : a))[1];
    let name = `THE ${word} ${g.pick(COLLECTIVE)}`;
    for (let k = 0; k < 6 && usedNames.has(name); k++) name = `THE ${word} ${g.pick(COLLECTIVE)}`;
    usedNames.add(name);
    orders.push({
      slot: s, name, color: colors[s], morph, alive: false, born: -1, wells: 0, target: 0, hostile: false, archmage: g.pick(SYL1) + g.pick(SYL2).toLowerCase(),
      sigil: { rings: g.int(1, 3), sides: g.pick([0, 3, 4, 5, 6, 7, 8]), star: g.chance(0.4), spokes: g.pick([0, 0, 3, 4, 6, 8, 12]), spin: g.range(-0.4, 0.4), dot: g.chance(0.6) },
      great: -1,
    });
  }
  const pop = Math.round(g.lognormal(9000, 0.25) * scale);
  const phys = createPhysarum(cols, rows, species, Math.max(3000, Math.min(16000, pop)), g.fork('movers').rng);

  const world: InkWorld = {
    t: 0, W, H, cols, rows, cell, bus, g, name: placeName(g.fork('name').rng), medium, land, landName: LAND_TITLES[dominant],
    height, wall, phys, total: phys.total, memory: new Field(cols, rows), dist: new Float32Array(N), norm: species.map(() => 1),
    orders, wells: [], maxSlots,
    director: createDirector(g.fork('director').rng, { arc: g.pick(ARCS), period: g.range(240, 420), establish: () => ({ x: W / 2, y: H / 2, zoom: 1 }) }),
    systems: [], cast: [], attractors: [], steer: [], mods: { deposit: 1, keep: 1, speed: 1, light: 1 }, sparks: [], tellings: [], view: null, opts,
    idx: (x, y) => Math.max(0, Math.min(rows - 1, Math.floor(y / cell))) * cols + Math.max(0, Math.min(cols - 1, Math.floor(x / cell))),
    tell(text, color, big, sub) {
      world.tellings.push({ text, sub, color, big, t: world.t });
      if (world.tellings.length > 20) world.tellings.shift();
    },
    emit: (type, x, y, weight, text) => {
      bus.emit({ type, x, y, weight, text });
      world.director.note(weight * 0.6);
    },
    look: (why, x, y, zoom, dur, priority) => world.director.look(why, x, y, zoom, dur, priority),
    addWell(x, y, power, crater) {
      const i = world.idx(x, y);
      if (wall[i] || world.wells.some((w) => Math.hypot(w.x - x, w.y - y) < cell * 6)) return null;
      const w: Well = { id: world.wells.length, x, y, power, owner: -1, since: world.t, name: `THE ${g.pick(ADJ)} ${g.pick(NOUN)}`, crater };
      world.wells.push(w);
      return w;
    },
    raiseOrder(at, hostile = false) {
      const o = orders.find((x) => !x.alive && x.born < 0 && !x.hostile) ?? orders.find((x) => !x.alive && !x.hostile);
      if (!o) return null;
      o.alive = true;
      o.born = world.t;
      o.hostile = hostile;
      o.great = -1;
      const w = at ?? world.wells.find((x) => x.owner < 0);
      if (!w) return null;
      w.owner = o.slot;
      w.since = world.t;
      for (let k = 0; k < 500; k++) phys.spawn(o.slot, w.x / cell + (g.unit() - 0.5) * 3, w.y / cell + (g.unit() - 0.5) * 3, g.unit() * Math.PI * 2);
      return o;
    },
    step,
    counts() {
      return {
        orders: orders.filter((o) => o.alive && !o.hostile).length,
        movers: phys.count(),
        wells: world.wells.length,
        held: world.wells.filter((w) => w.owner >= 0).length,
        systems: world.systems.length,
        tension: Math.round(world.director.tension() * 100),
      };
    },
  };

  // ---- the wells -------------------------------------------------------------------------------
  const layout = g.weighted({ scattered: 4, clustered: 3, ring: 1, line: 1, spiral: 1 });
  const nWells = Math.max(14, Math.min(90, Math.round(g.lognormal(36, 0.35) * scale)));
  const margin = 0.06;
  const centers = Array.from({ length: g.int(3, 6) }, () => [g.range(0.15, 0.85), g.range(0.2, 0.8)]);
  for (let k = 0, tries = 0; k < nWells && tries < 4000; tries++) {
    let u = g.range(margin, 1 - margin);
    let v = g.range(margin + 0.06, 1 - margin - 0.04);
    if (layout === 'clustered') {
      const c = g.pick(centers);
      u = c[0] + g.normal(0, 0.09);
      v = c[1] + g.normal(0, 0.09);
    } else if (layout === 'ring' && g.chance(0.7)) {
      const a = g.unit() * Math.PI * 2;
      u = 0.5 + Math.cos(a) * g.normal(0.3, 0.04);
      v = 0.5 + Math.sin(a) * g.normal(0.3, 0.05);
    } else if (layout === 'line' && g.chance(0.7)) {
      const s = g.unit();
      u = 0.08 + s * 0.84;
      v = 0.5 + Math.sin(s * 5) * 0.18 + g.normal(0, 0.05);
    } else if (layout === 'spiral' && g.chance(0.75)) {
      const s = g.unit();
      const a = s * Math.PI * 5;
      u = 0.5 + Math.cos(a) * s * 0.42;
      v = 0.5 + Math.sin(a) * s * 0.36;
    }
    if (u < margin || u > 1 - margin || v < margin + 0.05 || v > 1 - margin) continue;
    if (world.addWell(u * W, v * H, g.lognormal(1, 0.4), false)) k++;
  }

  // ---- the first orders, the cast ----------------------------------------------------------------
  const free = g.shuffle(world.wells);
  for (let k = 0; k < nOrders; k++) {
    const at = free.find((w) => w.owner < 0 && world.wells.every((o) => o.owner < 0 || Math.hypot(o.x - w.x, o.y - w.y) > Math.min(W, H) * 0.25)) ?? free.find((w) => w.owner < 0);
    if (at) world.raiseOrder(at);
  }
  const cast = compose(g.fork('cast'), world, LIBRARY, {
    total: [3, 7],
    quota: { weather: [0, opts.storms > 0 ? 2 : 0], calamity: [0, opts.rifts > 0 ? 2 : 0], wonder: [0, 2], life: [1, 3] },
  });
  for (const c of cast) {
    world.systems.push(c.def.create(world, c.params as never, g.fork(`sys-${c.def.id}`)));
    world.cast.push(c.def.label ?? c.def.id);
  }

  // ---- the frame ----------------------------------------------------------------------------------
  const rnd = g.fork('step').rng;
  let nextCensus = 0;
  let nextDist = 0;
  const queue = new Int32Array(N);
  function bias(x: number, y: number, s: number): number {
    const xi = x | 0;
    const yi = y | 0;
    if (wall[yi * cols + xi]) return -Infinity;
    let b = 0;
    for (const a of world.attractors) {
      if (a.slot >= 0 && a.slot !== s) continue;
      const dx = x - a.x;
      const dy = y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < a.r * a.r) b += a.v * (1 - d2 / (a.r * a.r));
    }
    return b;
  }
  const steer = (i: number) => {
    let s = 0;
    for (const f of world.steer) s += f(i);
    return s;
  };
  const baseSpecies = species.map((s) => ({ ...s }));

  function census() {
    // Who holds each well: the order whose trail is strongest there, by a margin.
    for (const w of world.wells) {
      const cx = w.x / cell;
      const cy = w.y / cell;
      let best = -1;
      let bv = 0;
      let second = 0;
      for (const o of orders) {
        if (!o.alive) continue;
        const v = phys.trails[o.slot].sample(cx, cy) * world.norm[o.slot];
        if (v > bv) {
          second = bv;
          bv = v;
          best = o.slot;
        } else if (v > second) second = v;
      }
      if (best >= 0 && bv > 0.25 && bv > second * 1.4 && best !== w.owner) {
        const prev = w.owner;
        w.owner = best;
        w.since = world.t;
        const o = orders[best];
        if (prev >= 0 && orders[prev].alive) {
          world.emit('claim', w.x, w.y, 0.35, `${o.name} TAKES ${w.name}`);
          if (rnd() < 0.3) world.look('claim', w.x, w.y, 1.35, 6, 2);
        } else world.emit('reach', w.x, w.y, 0.15);
      }
    }
    for (const o of orders) {
      if (!o.alive) continue;
      o.wells = world.wells.filter((w) => w.owner === o.slot).length;
      o.target = o.hostile ? o.target : Math.round((phys.n / (maxSlots + 1)) * 0.25 + o.wells * (phys.n / Math.max(10, world.wells.length)) * 0.9);
      const have = phys.count(o.slot);
      if (have < o.target) {
        const mine = world.wells.filter((w) => w.owner === o.slot);
        for (let k = 0; k < Math.min(300, o.target - have) && mine.length; k++) {
          const w = mine[Math.floor(rnd() * mine.length)];
          phys.spawn(o.slot, w.x / cell + (rnd() - 0.5) * 2, w.y / cell + (rnd() - 0.5) * 2, rnd() * Math.PI * 2);
        }
      } else if (have > o.target * 1.15) {
        let cull = Math.min(400, have - o.target);
        for (let i = 0; i < phys.n && cull > 0; i++) if (phys.alive[i] && phys.s[i] === o.slot && rnd() < 0.3) {
          phys.kill(i);
          cull--;
        }
      }
      // An order with no wells and few movers left is gone.
      if (!o.hostile && o.wells === 0 && world.t - o.born > 30 && phys.count(o.slot) < 60) {
        o.alive = false;
        for (let i = 0; i < phys.n; i++) if (phys.alive[i] && phys.s[i] === o.slot) phys.kill(i);
        world.emit('fade', W / 2, H / 2, 0.6, `${o.name} FADES FROM THE MAP`);
        world.tell(`${o.name} FADES FROM THE MAP`, o.color, true);
      }
    }
    // A new order rises at a free well, now and then, when the director allows.
    const living = orders.filter((o) => o.alive && !o.hostile).length;
    if (living < Math.min(6, nOrders + 1) && world.director.want('rise', 0.4, 90)) {
      const w = world.wells.filter((x) => x.owner < 0).sort(() => rnd() - 0.5)[0];
      if (w) {
        const o = world.raiseOrder(w);
        if (o) {
          world.emit('rise', w.x, w.y, 0.6, `${o.name} RISES AT ${w.name}`);
          world.tell(`${o.name} RISES`, o.color, true, `at ${titleCase(w.name)}, under ${o.archmage}`);
          world.look('rise', w.x, w.y, 1.45, 8, 4);
        }
      }
    }
    // Borders: where two orders' trails both run strong, they clash.
    let clash = 0;
    for (let k = 0; k < 400; k++) {
      const i = Math.floor(rnd() * N);
      let a = -1;
      let av = 0;
      let bv = 0;
      let b = -1;
      for (const o of orders) {
        if (!o.alive) continue;
        const v = phys.trails[o.slot].data[i] * world.norm[o.slot];
        if (v > av) {
          bv = av;
          b = a;
          av = v;
          a = o.slot;
        } else if (v > bv) {
          bv = v;
          b = o.slot;
        }
      }
      if (b >= 0 && bv > 0.35) {
        clash++;
        if (world.sparks.length < 160) world.sparks.push({ x: ((i % cols) + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell, t0: world.t, color: orders[rnd() < 0.5 ? a : b].color });
      }
    }
    if (clash > 14 && world.director.want('clash', 0.3, 50)) {
      const s = world.sparks[world.sparks.length - 1];
      if (s) {
        world.emit('clash', s.x, s.y, 0.45, 'THE ORDERS CLASH ALONG THE LINES');
        world.look('clash', s.x, s.y, 1.4, 7, 3);
      }
    }
    // The great work: an order holding a third of the wells raises its sigil over the land.
    for (const o of orders) if (o.alive && !o.hostile && o.great < 0 && o.wells >= Math.max(5, world.wells.length * 0.33) && world.director.want('great', 0.7, 120)) {
      o.great = world.t;
      const cap = world.wells.filter((w) => w.owner === o.slot).sort((a, b) => b.power - a.power)[0];
      if (cap) {
        world.attractors.push({ x: cap.x / cell, y: cap.y / cell, r: 14, v: 3, slot: o.slot, until: Infinity });
        world.emit('greatwork', cap.x, cap.y, 0.85, `${o.name} RAISES ITS GREAT WORK`);
        world.tell(`${o.name} RAISES ITS GREAT WORK`, o.color, true, `over ${titleCase(cap.name)}`);
        world.look('great', cap.x, cap.y, 1.5, 10, 6);
      }
    }
  }

  function step(dt: number) {
    world.t += dt;
    world.director.step(world.t, dt);
    world.mods = { deposit: 1, keep: 1, speed: 1, light: 1 };
    // Systems first: they set this step's mods, attractors, and steering.
    for (const s of world.systems) s.step?.(dt);
    for (let k = 0; k < species.length; k++) {
      const b = baseSpecies[k];
      species[k].deposit = b.deposit * world.mods.deposit;
      species[k].keep = Math.min(0.985, b.keep * world.mods.keep);
      species[k].speed = b.speed * world.mods.speed;
    }
    // The wells feed their holders strongly and everyone a little: this is what links them.
    for (const w of world.wells) {
      const cx = w.x / cell;
      const cy = w.y / cell;
      for (const o of orders) {
        if (!o.alive) continue;
        const k = w.owner === o.slot ? 3.2 : w.owner < 0 ? 1 : 0.25;
        phys.trails[o.slot].splat(cx, cy, 2.2, k * w.power * world.mods.deposit);
      }
    }
    phys.step(bias, world.steer.length ? steer : undefined);
    world.attractors = world.attractors.filter((a) => a.until > world.t);
    // Normalizers, and the land's memory of old routes.
    const tot = world.total.data;
    for (const o of orders) if (o.alive) world.norm[o.slot] += (1 / Math.max(1, phys.max[o.slot] * 0.55) - world.norm[o.slot]) * 0.05;
    const mem = world.memory.data;
    const avgNorm = world.norm.reduce((s, v) => s + v, 0) / world.norm.length;
    for (let i = 0; i < N; i++) mem[i] = Math.max(mem[i] * 0.9993, Math.min(1, tot[i] * avgNorm) * 0.5);
    if (world.t >= nextCensus) {
      nextCensus = world.t + 1;
      census();
    }
    if (world.t >= nextDist) {
      nextDist = world.t + 0.8;
      const thr = 0.12 / Math.max(1e-6, avgNorm);
      geodesic(cols, rows, world.wells.map((w) => world.idx(w.x, w.y)), (i) => tot[i] > thr, world.dist, queue);
    }
    for (let i = world.sparks.length - 1; i >= 0; i--) if (world.t - world.sparks[i].t0 > 0.6) world.sparks.splice(i, 1);
  }

  // Opening: the first lines spread out from the wells before the first frame is judged.
  for (let k = 0; k < 40; k++) step(0.05);
  world.t = 0;
  return world;
}

export const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
