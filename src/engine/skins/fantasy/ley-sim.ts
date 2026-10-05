/**
 * Leylines: a land at night, the lines of power under it, and the orders of mages who build
 * on them. No DOM.
 *
 * The land (one of five: isles, steppe, forest, desert, tundra) has wells of power at some
 * of its nodes; lines run between nodes (each to its nearest few, never crossing). Power
 * rises at the wells, more under the convergence of the moons, and flows along the lines
 * from high charge to low, like water; a line carrying more than it can bears heat, and a
 * line that overheats burns out for a while, and may tear the world open.
 *
 * Orders of mages (three to five, each with its colors, its tower style, its archmage, and
 * a temper) hold towers on nodes. Towers draw power from their node and store it; orders
 * spend it to send builders along the lines to raise new towers, to raise their towers
 * higher, to ward them, to summon elementals that walk the lines to an enemy's tower, and in
 * time to raise a great work. Orders that meet along a line make pacts or war; at war, they
 * duel along the lines between their towers, beams pushing a front back and forth until a
 * tower falls or is turned. Archmages die and are succeeded; orders split; an order that
 * loses its last tower is gone, and a new one rises at a free well.
 *
 * Arcane storms drift across the land, overcharging the lines and striking the towers. The
 * moons come into alignment every so often (the convergence): the wells surge, everything
 * burns brighter, and rifts open more easily. A rift grows, swallows the nodes around it,
 * and sends shades along the lines to drain the towers, until ritualists from the orders
 * close it.
 *
 * Space: world px, the screen. The sim says where the camera should look (`focus`).
 */
import { forkRng, type Rng } from '../../rng';
import { createBus, type Bus } from '../../sim/bus';
import type { Noise2D } from '../../noise';
import { placeName, titled } from './names';

export type Land = 'isles' | 'steppe' | 'forest' | 'desert' | 'tundra';
const LANDS: Land[] = ['isles', 'steppe', 'forest', 'desert', 'tundra'];
export const LAND_NAMES: Record<Land, string> = { isles: 'THE SHATTERED ISLES', steppe: 'THE GREAT STEPPE', forest: 'THE ELDERWOOD', desert: 'THE GLASS DESERT', tundra: 'THE WHITE WASTE' };
export type TowerStyle = 'spire' | 'ziggurat' | 'crystal' | 'tree' | 'obelisk';

export type LeyNode = { id: number; x: number; y: number; well: number; charge: number; links: number[]; tower: Tower | null; dead: number; name: string; stones: boolean };
export type Line = { id: number; a: number; b: number; cx: number; cy: number; flow: number; cap: number; heat: number; cut: number; front: number; contest: boolean };
export type Order = { id: number; name: string; color: string; glow: string; style: TowerStyle; archmage: string; temper: 'ambitious' | 'scholarly' | 'zealous'; alive: boolean; mana: number; pacts: Set<number>; wars: Set<number>; great: boolean; age: number; founded: number };
export type Tower = { id: number; node: number; order: number; level: number; hp: number; hpMax: number; ward: number; built: number; name: string; t0: number; fell: number; great: boolean };
export type Walker = { id: number; kind: 'builder' | 'ritualist' | 'elemental' | 'shade'; order: number; line: number; dir: 1 | -1; k: number; speed: number; target: number; alive: boolean; hp: number; t0: number; path: number[] };
export type Storm = { id: number; x: number; y: number; vx: number; vy: number; r: number; power: number; t0: number; dur: number; hue: string };
export type Rift = { id: number; node: number; x: number; y: number; r: number; t0: number; closing: number; closed: number; swallowed: number[] };
export type Beam = { kind: 'duel' | 'bolt' | 'strike' | 'great' | 'drain'; x0: number; y0: number; x1: number; y1: number; color: string; t0: number; dur: number; seed: number };
export type Fx = { kind: 'flash' | 'spark' | 'rune' | 'ring' | 'rubble' | 'burst'; x: number; y: number; t0: number; dur: number; r: number; color: string; seed: number };
export type Label = { text: string; x: number; y: number; color: string; t0: number; dur: number };

export type LeyOptions = { land: string; orders: number; storms: number; rifts: number };

export type LeyWorld = {
  t: number; W: number; H: number; bus: Bus; land: Land; name: string;
  nodes: LeyNode[]; lines: Line[]; orders: Order[]; towers: Tower[]; walkers: Walker[]; storms: Storm[]; rifts: Rift[]; beams: Beam[]; fx: Fx[]; labels: Label[];
  chronicle: { t: number; text: string }[];
  /** 0..1 through the moons' cycle; the convergence while `converging`. */
  moons: number; converging: boolean; nextConvergence: number; age: number;
  ley: string;
  focus: { x: number; y: number; zoom: number; until: number; why: string };
  /** The land's height at a point, -1..1 (below 0 is sea, on the isles). */
  height(x: number, y: number): number;
  lineAt(l: Line, k: number): [number, number];
  step(dt: number): void;
  counts(): Record<string, number>;
};

const ORDERS: [string, string, string, TowerStyle][] = [
  ['THE AZURE CONCLAVE', '#60a5fa', '#bfdbfe', 'spire'],
  ['THE CRIMSON CIRCLE', '#f87171', '#fecaca', 'ziggurat'],
  ['THE VERDANT ORDER', '#4ade80', '#bbf7d0', 'tree'],
  ['THE UMBRAL COURT', '#a78bfa', '#ddd6fe', 'obelisk'],
  ['THE GOLDEN SYNOD', '#facc15', '#fef08a', 'crystal'],
  ['THE ASHEN HAND', '#fb923c', '#fed7aa', 'ziggurat'],
  ['THE PALE CHOIR', '#e2e8f0', '#f8fafc', 'spire'],
];
const MAGES = ['MORGRETH', 'ISOLDE THE WISE', 'VALDIS', 'THE GREY MAGISTER', 'AURELIAN', 'SABINE OF THE TOWER', 'OLD CADOC', 'NERIS', 'HALLOR', 'THE WEAVER', 'ELSPETH', 'ZAREK', 'MIRAEL', 'THORN'];
const NODE_NAMES = ['THE WEEPING STONE', 'THE HOLLOW CROWN', 'THE NINE SISTERS', 'THE DREAMING WELL', 'THE KING-STONE', 'THE BLIND EYE', 'THE SINGING RING', 'THE LAST LANTERN', 'THE BROKEN ALTAR', 'THE STAR-PIT', 'THE WHISPERING MOUND', 'THE SILVER FORD', 'THE OLD GATE', 'THE MOON-POOL'];
const LEY: Record<Land, string> = { isles: '#5eead4', steppe: '#c4b5fd', forest: '#86efac', desert: '#fcd34d', tundra: '#93c5fd' };
const CONVERGE = 320;

/** 
oise is the host's (seeded from the same seed), so the land is the seed's. */
export function createLeyWorld(seed: string | number, W: number, H: number, opts: LeyOptions, noise: Noise2D): LeyWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'ley');
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  let ids = 1;
  const land: Land = (LANDS as string[]).includes(opts.land) ? (opts.land as Land) : pick(LANDS);
  const height = (x: number, y: number) => {
    const s = 1 / Math.max(W, H);
    const n = noise.noise2(x * s * 3, y * s * 3) * 0.6 + noise.noise2(x * s * 7 + 5, y * s * 7) * 0.3 + noise.noise2(x * s * 17, y * s * 17 + 3) * 0.1;
    // The isles: the edges go down into the sea.
    if (land === 'isles') {
      const ex = Math.min(x, W - x) / W;
      const ey = Math.min(y, H - y) / H;
      return n + 0.15 - Math.max(0, 0.18 - Math.min(ex, ey)) * 3;
    }
    return n;
  };
  const world: LeyWorld = {
    t: 0, W, H, bus, land, name: placeName(r),
    nodes: [], lines: [], orders: [], towers: [], walkers: [], storms: [], rifts: [], beams: [], fx: [], labels: [], chronicle: [],
    moons: r() * 0.4, converging: false, nextConvergence: CONVERGE * (0.35 + r() * 0.3), age: 1,
    ley: LEY[land],
    focus: { x: W / 2, y: H / 2, zoom: 1, until: 0, why: 'overview' },
    height,
    lineAt(l, k) {
      const a = world.nodes[l.a];
      const b = world.nodes[l.b];
      const u = 1 - k;
      return [u * u * a.x + 2 * u * k * l.cx + k * k * b.x, u * u * a.y + 2 * u * k * l.cy + k * k * b.y];
    },
    step,
    counts() {
      return {
        orders: world.orders.filter((o) => o.alive).length,
        towers: world.towers.filter((t) => t.fell < 0).length,
        lines: world.lines.filter((l) => l.cut <= world.t).length,
        rifts: world.rifts.filter((x) => x.closed < 0).length,
        storms: world.storms.length,
        walkers: world.walkers.filter((w) => w.alive).length,
        converging: world.converging ? 1 : 0,
        charge: Math.round(world.nodes.reduce((s, n) => s + n.charge, 0)),
      };
    },
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
  const PRIORITY: Record<string, number> = { overview: 0, node: 1, build: 2, storm: 3, pact: 3, duel: 5, great: 6, rift: 7, fall: 6, converge: 6 };
  const look = (why: string, x: number, y: number, zoom: number, dur: number) => {
    const f = world.focus;
    if (world.t < f.until && (PRIORITY[f.why] ?? 0) > (PRIORITY[why] ?? 0)) return;
    world.focus = { x, y, zoom, until: world.t + dur, why };
  };
  const said = new Set<string>();
  const once = (k: string) => (said.has(k) ? false : (said.add(k), true));

  // ---- the land and its lines ---------------------------------------------------------------------

  const x0 = W * 0.06;
  const x1 = W * 0.94;
  const y0 = H * 0.15;
  const y1 = H * 0.85;
  const d = Math.sqrt(((x1 - x0) * (y1 - y0)) / 34);
  for (let tries = 0; tries < 2500 && world.nodes.length < 44; tries++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    if (land === 'isles' && height(x, y) < 0.02) continue;
    if (world.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < d * 0.85)) continue;
    world.nodes.push({ id: world.nodes.length, x, y, well: 0, charge: 0, links: [], tower: null, dead: -1, name: '', stones: r() < 0.5 });
  }
  const names = [...NODE_NAMES].sort(() => r() - 0.5);
  for (const n of world.nodes) n.name = names[n.id % names.length] + (n.id >= names.length ? ` ${['II', 'III', 'IV'][Math.floor(n.id / names.length) - 1] ?? ''}` : '');
  // Wells: a third of the nodes, strong and weak.
  for (const n of world.nodes) if (r() < 0.36) n.well = 0.5 + r() * 1.2;
  // Lines: each node to its nearest three, never crossing another.
  const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) => {
    const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
    return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) && o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by);
  };
  const cands: [number, number, number][] = [];
  for (const a of world.nodes) {
    const near = world.nodes.filter((b) => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 4);
    for (const b of near) if (a.id < b.id || !near.includes(a)) cands.push([Math.hypot(b.x - a.x, b.y - a.y), a.id, b.id]);
  }
  cands.sort((p, q) => p[0] - q[0]);
  for (const [len, a, b] of cands) {
    if (len > d * 2.6) continue;
    if (world.lines.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) continue;
    const A = world.nodes[a];
    const B = world.nodes[b];
    if (world.lines.some((l) => l.a !== a && l.a !== b && l.b !== a && l.b !== b && cross(A.x, A.y, B.x, B.y, world.nodes[l.a].x, world.nodes[l.a].y, world.nodes[l.b].x, world.nodes[l.b].y))) continue;
    // Bowed a little, as lines of power are.
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const bow = (r() - 0.5) * len * 0.35;
    const line: Line = { id: world.lines.length, a, b, cx: mx - ((B.y - A.y) / len) * bow, cy: my + ((B.x - A.x) / len) * bow, flow: 0, cap: 1.5 + r() * 2.5, heat: 0, cut: -1, front: 0.5, contest: false };
    world.lines.push(line);
    A.links.push(line.id);
    B.links.push(line.id);
  }
  const other = (l: Line, n: number) => (l.a === n ? l.b : l.a);
  const live = (l: Line) => l.cut <= world.t && world.nodes[l.a].dead < 0 && world.nodes[l.b].dead < 0;

  // ---- the orders ------------------------------------------------------------------------------

  const tempers = ['ambitious', 'scholarly', 'zealous'] as const;
  const orderDefs = [...ORDERS].sort(() => r() - 0.5);
  let orderIx = 0;
  function newOrder(at: LeyNode, quiet = false): Order {
    const [name, color, glow, style] = orderDefs[orderIx++ % orderDefs.length];
    const o: Order = { id: world.orders.length, name, color, glow, style, archmage: pick(MAGES), temper: pick(tempers), alive: true, mana: 30, pacts: new Set(), wars: new Set(), great: false, age: 30 + Math.floor(r() * 60), founded: world.t };
    world.orders.push(o);
    raise(o, at, true);
    if (!quiet) {
      say(`${o.name} RISES AT ${at.name}`, at.x, at.y, o.glow, 'high');
      emit('neworder', at.x, at.y, 0.6);
      chronicle(`${T(o.name)} rose at ${T(at.name)}, under ${T(o.archmage)}.`);
      look('build', at.x, at.y, 1.4, 8);
    }
    return o;
  }
  function raise(o: Order, n: LeyNode, instant = false): Tower {
    const t: Tower = { id: ids++, node: n.id, order: o.id, level: instant ? 2 : 1, hp: 30, hpMax: 30, ward: -1, built: instant ? 1 : 0, name: placeName(r), t0: world.t, fell: -1, great: false };
    world.towers.push(t);
    n.tower = t;
    return t;
  }
  // The first towers: on wells, spread apart.
  const wells = world.nodes.filter((n) => n.well > 0).sort(() => r() - 0.5);
  const nOrders = Math.max(2, Math.min(5, Math.round(opts.orders)));
  for (let i = 0; i < nOrders; i++) {
    const at = wells.find((n) => !n.tower && world.towers.every((t) => Math.hypot(world.nodes[t.node].x - n.x, world.nodes[t.node].y - n.y) > Math.min(W, H) * 0.3)) ?? wells.find((n) => !n.tower);
    if (at) newOrder(at, true);
  }
  for (const o of world.orders) chronicle(`${T(o.name)} held ${T(world.nodes[world.towers.find((t) => t.order === o.id)!.node].name)}.`);

  const towersOf = (o: Order) => world.towers.filter((t) => t.order === o.id && t.fell < 0);
  const ownerOf = (n: LeyNode) => (n.tower && n.tower.fell < 0 ? n.tower.order : -1);

  // ---- walking the lines ---------------------------------------------------------------------------

  /** Shortest way along live lines from one node to another (by hops). */
  function path(from: number, to: number, enemyOk = false, order = -1): number[] | null {
    const prev = new Map<number, number>([[from, -1]]);
    const q = [from];
    while (q.length) {
      const n = q.shift()!;
      if (n === to) {
        const lines: number[] = [];
        for (let m = to; prev.get(m) !== -1; ) {
          const l = prev.get(m)!;
          lines.unshift(l);
          m = other(world.lines[l], m);
        }
        return lines;
      }
      for (const lid of world.nodes[n].links) {
        const l = world.lines[lid];
        if (!live(l)) continue;
        const m = other(l, n);
        if (prev.has(m)) continue;
        const own = ownerOf(world.nodes[m]);
        if (!enemyOk && m !== to && own >= 0 && own !== order) continue;
        prev.set(m, lid);
        q.push(m);
      }
    }
    return null;
  }
  function send(kind: Walker['kind'], o: Order | null, from: number, to: number): Walker | null {
    const p = path(from, to, kind !== 'builder', o ? o.id : -1);
    if (!p || !p.length) return null;
    const l = world.lines[p[0]];
    const w: Walker = { id: ids++, kind, order: o ? o.id : -1, line: p[0], dir: l.a === from ? 1 : -1, k: l.a === from ? 0 : 1, speed: kind === 'elemental' ? 34 : kind === 'shade' ? 24 : 30, target: to, alive: true, hp: kind === 'elemental' ? 8 : kind === 'shade' ? 6 : 3, t0: world.t, path: p.slice(1) };
    world.walkers.push(w);
    return w;
  }
  const lineLen = (l: Line) => {
    const a = world.nodes[l.a];
    const b = world.nodes[l.b];
    return Math.hypot(a.x - l.cx, a.y - l.cy) + Math.hypot(b.x - l.cx, b.y - l.cy);
  };
  function walkers(dt: number) {
    for (const w of world.walkers) {
      if (!w.alive) continue;
      const l = world.lines[w.line];
      if (!live(l)) {
        w.alive = false;
        continue;
      }
      w.k += (w.dir * w.speed * dt) / Math.max(1, lineLen(l));
      if (w.k < 0 || w.k > 1) {
        const at = w.dir > 0 ? l.b : l.a;
        if (at === w.target || !w.path.length) {
          w.alive = false;
          arrive(w, world.nodes[at]);
          continue;
        }
        const next = world.lines[w.path.shift()!];
        w.line = next.id;
        w.dir = next.a === at ? 1 : -1;
        w.k = w.dir > 0 ? 0 : 1;
      }
    }
    world.walkers = world.walkers.filter((w) => w.alive || false);
  }
  function arrive(w: Walker, n: LeyNode) {
    const o = world.orders[w.order];
    if (w.kind === 'builder') {
      if (n.tower || n.dead >= 0 || !o?.alive) return;
      const t = raise(o, n);
      say(`${o.name} RAISES A TOWER AT ${n.name}`, n.x, n.y, o.glow, 'medium');
      emit('tower', n.x, n.y, 0.4);
      look('build', n.x, n.y, 1.5, 6);
      if (towersOf(o).length === 6 && once(`six-${o.id}`)) chronicle(`${T(o.name)} held six towers on the lines.`);
      void t;
    } else if (w.kind === 'elemental') {
      const t = n.tower;
      world.fx.push({ kind: 'burst', x: n.x, y: n.y, t0: world.t, dur: 1.2, r: 30, color: o?.color ?? '#f97316', seed: ids++ });
      if (t && t.fell < 0 && t.order !== w.order) {
        if (t.ward > world.t) {
          say('THE WARD HOLDS', n.x, n.y, '#e0f2fe', 'low');
          emit('wardholds', n.x, n.y, 0.3);
        } else damage(t, 12, o ?? null);
      }
    } else if (w.kind === 'shade') {
      const t = n.tower;
      if (t && t.fell < 0) {
        const ow = world.orders[t.order];
        ow.mana = Math.max(0, ow.mana - 25);
        damage(t, 5, null);
        world.beams.push({ kind: 'drain', x0: n.x, y0: n.y, x1: n.x, y1: n.y - 40, color: '#581c87', t0: world.t, dur: 1.5, seed: ids++ });
      }
    } else if (w.kind === 'ritualist') {
      // At the rift's edge: the circle is drawn, and the closing goes on.
      const rift = world.rifts.find((x) => x.closed < 0 && (x.node === n.id || n.links.some((lid) => other(world.lines[lid], n.id) === x.node)));
      if (rift) {
        rift.closing += 0.2;
        world.fx.push({ kind: 'rune', x: n.x, y: n.y, t0: world.t, dur: 6, r: 18, color: world.orders[w.order]?.glow ?? '#e0f2fe', seed: ids++ });
      }
    }
  }

  function damage(t: Tower, dmg: number, by: Order | null) {
    t.hp -= dmg;
    const n = world.nodes[t.node];
    world.fx.push({ kind: 'spark', x: n.x, y: n.y - 10, t0: world.t, dur: 0.6, r: 10, color: '#fde68a', seed: ids++ });
    if (t.hp > 0) return;
    const o = world.orders[t.order];
    // Taken (turned) if the attacker is strong and near; else it falls.
    if (by && by.alive && r() < 0.35) {
      t.order = by.id;
      t.hp = t.hpMax * 0.5;
      say(`THE TOWER AT ${n.name} IS TURNED TO ${by.name}`, n.x, n.y, by.glow, 'high');
      emit('turned', n.x, n.y, 0.7);
      chronicle(`${T(by.name)} took the tower at ${T(n.name)} from ${T(o.name)}.`);
    } else {
      t.fell = world.t;
      n.tower = null;
      world.fx.push({ kind: 'rubble', x: n.x, y: n.y, t0: world.t, dur: 60, r: 14, color: o.color, seed: ids++ });
      say(`THE TOWER AT ${n.name} FALLS`, n.x, n.y, '#fca5a5', 'high');
      emit('towerfalls', n.x, n.y, 0.8);
      look('fall', n.x, n.y, 1.5, 7);
    }
    if (!towersOf(o).length) {
      o.alive = false;
      say(`${o.name} IS NO MORE`, n.x, n.y, '#fca5a5', 'high');
      emit('orderends', n.x, n.y, 0.8);
      chronicle(`${T(o.name)} lost its last tower, and was no more.`);
    }
  }

  // ---- power ------------------------------------------------------------------------------------

  let acc = 0;
  function power(dt: number) {
    acc += dt;
    while (acc >= 0.1) {
      acc -= 0.1;
      const k = 0.1;
      const surge = world.converging ? 3 : 1;
      for (const n of world.nodes) {
        if (n.dead >= 0) {
          n.charge *= 0.9;
          continue;
        }
        if (n.well) n.charge += n.well * 2.2 * k * surge;
        n.charge *= 1 - 0.004;
      }
      for (const l of world.lines) {
        if (!live(l)) {
          l.flow *= 0.9;
          continue;
        }
        const A = world.nodes[l.a];
        const B = world.nodes[l.b];
        let f = (A.charge - B.charge) * 0.22;
        const lim = l.cap * 3 * k * surge;
        // Over what it can carry, the line runs hot.
        const over = Math.abs(f) - lim;
        if (over > 0) l.heat += over * 0.6;
        f = Math.max(-lim * 1.6, Math.min(lim * 1.6, f));
        A.charge -= f;
        B.charge += f;
        l.flow += (f / k - l.flow) * 0.2;
        l.heat = Math.max(0, l.heat - k * 0.4);
        if (l.heat > 12) burnOut(l);
      }
      // Towers drink from their nodes.
      for (const t of world.towers) {
        if (t.fell >= 0) continue;
        const n = world.nodes[t.node];
        const take = Math.min(n.charge * 0.2, (0.4 + t.level * 0.25) * k * 3);
        n.charge -= take;
        if (t.built >= 1) world.orders[t.order].mana += take;
      }
    }
  }
  function burnOut(l: Line) {
    l.heat = 0;
    l.cut = world.t + 40 + r() * 40;
    const [x, y] = world.lineAt(l, 0.5);
    world.fx.push({ kind: 'burst', x, y, t0: world.t, dur: 1.5, r: 26, color: world.ley, seed: ids++ });
    say('A LINE BURNS OUT', x, y, world.ley, 'medium');
    emit('burnout', x, y, 0.5);
    look('storm', x, y, 1.4, 5);
    // And sometimes the world tears where it was.
    if (r() < 0.25 * opts.rifts * (world.converging ? 2 : 1)) openRift(world.nodes[r() < 0.5 ? l.a : l.b], 'where a line burned out');
  }

  // ---- the orders' work ------------------------------------------------------------------------------

  function orders(dt: number) {
    for (const o of world.orders) {
      if (!o.alive) continue;
      const mine = towersOf(o);
      // Raise a tower higher, ward against a storm, build out, summon, the great work.
      if (r() > dt * 0.5) continue;
      const storm = world.storms.find((s) => mine.some((t) => Math.hypot(world.nodes[t.node].x - s.x, world.nodes[t.node].y - s.y) < s.r * 1.4));
      if (storm && o.mana > 15) {
        for (const t of mine) if (Math.hypot(world.nodes[t.node].x - storm.x, world.nodes[t.node].y - storm.y) < storm.r * 1.6 && t.ward < world.t) {
          t.ward = world.t + 25;
          o.mana -= 6;
        }
        continue;
      }
      const frontier = new Set<number>();
      for (const t of mine) for (const lid of world.nodes[t.node].links) {
        const l = world.lines[lid];
        if (!live(l)) continue;
        const m = world.nodes[other(l, t.node)];
        if (!m.tower && m.dead < 0) frontier.add(m.id);
      }
      const building = world.walkers.some((w) => w.alive && w.kind === 'builder' && w.order === o.id);
      if (!building && o.mana > 80 && frontier.size && mine.length < 8) {
        // Out to the best free node: a well if there is one.
        const best = [...frontier].sort((a, b) => world.nodes[b].well - world.nodes[a].well)[0];
        const from = mine.find((t) => world.nodes[t.node].links.some((lid) => other(world.lines[lid], t.node) === best))!;
        if (send('builder', o, from.node, best)) o.mana -= 65;
        continue;
      }
      const low = mine.filter((t) => t.built >= 1 && t.level < 5).sort((a, b) => a.level - b.level)[0];
      if (low && o.mana > 50 + low.level * 30 && (o.temper === 'scholarly' || r() < 0.5)) {
        o.mana -= 40 + low.level * 25;
        low.level++;
        low.hpMax += 12;
        low.hp = low.hpMax;
        const n = world.nodes[low.node];
        world.fx.push({ kind: 'ring', x: n.x, y: n.y, t0: world.t, dur: 1.5, r: 24, color: o.glow, seed: ids++ });
        if (low.level === 5) {
          say(`THE TOWER AT ${n.name} REACHES THE CLOUDS`, n.x, n.y, o.glow, 'medium');
          emit('towerhigh', n.x, n.y, 0.4);
        } else emit('upgrade', n.x, n.y, 0.15);
        continue;
      }
      // At war: send an elemental down the lines at the nearest enemy tower.
      if (o.wars.size && o.mana > 40 && (o.temper === 'zealous' || r() < 0.4)) {
        const foes = world.towers.filter((t) => t.fell < 0 && o.wars.has(t.order));
        let best: { from: number; to: number; hops: number } | null = null;
        for (const t of mine) for (const f of foes) {
          const p = path(t.node, f.node, true);
          if (p && p.length <= 4 && (!best || p.length < best.hops)) best = { from: t.node, to: f.node, hops: p.length };
        }
        if (best) {
          const { from, to } = best;
          if (send('elemental', o, from, to)) {
            o.mana -= 35;
            if (once(`elemental-${o.id}-${Math.floor(world.t / 60)}`)) {
              const n = world.nodes[from];
              say(`${o.name} SENDS AN ELEMENTAL DOWN THE LINES`, n.x, n.y, o.glow, 'medium');
              emit('elemental', n.x, n.y, 0.5);
            }
          }
        }
        continue;
      }
      // The great work.
      if (!o.great && mine.length >= 6 && o.mana > 400) {
        const cap = mine.sort((a, b) => b.level - a.level)[0];
        cap.great = true;
        cap.level = 6;
        cap.hpMax = 120;
        cap.hp = 120;
        o.great = true;
        o.mana -= 300;
        const n = world.nodes[cap.node];
        say(`${o.name} RAISES ITS GREAT WORK AT ${n.name}`, n.x, n.y, o.glow, 'high');
        emit('greatwork', n.x, n.y, 0.85);
        chronicle(`${T(o.name)} raised its great work, the tower ${T(cap.name)}, at ${T(n.name)}.`);
        look('great', n.x, n.y, 1.6, 10);
        world.beams.push({ kind: 'great', x0: n.x, y0: n.y, x1: n.x, y1: 0, color: o.glow, t0: world.t, dur: 8, seed: ids++ });
      }
    }
  }

  /** Orders that meet along a line: pacts, wars, and the duels along the lines between them. */
  function politics(dt: number) {
    for (const l of world.lines) {
      const oa = ownerOf(world.nodes[l.a]);
      const ob = ownerOf(world.nodes[l.b]);
      l.contest = live(l) && oa >= 0 && ob >= 0 && oa !== ob && world.orders[oa].wars.has(ob);
      if (!l.contest) {
        l.front += (0.5 - l.front) * dt * 0.2;
        continue;
      }
      // The duel: each side pushes with what it has.
      const A = world.orders[oa];
      const B = world.orders[ob];
      const ta = world.nodes[l.a].tower!;
      const tb = world.nodes[l.b].tower!;
      const pa = Math.min(A.mana, 60) * (0.6 + ta.level * 0.2) * (world.converging ? 1.5 : 1);
      const pb = Math.min(B.mana, 60) * (0.6 + tb.level * 0.2) * (world.converging ? 1.5 : 1);
      A.mana = Math.max(0, A.mana - dt * 2);
      B.mana = Math.max(0, B.mana - dt * 2);
      l.front = Math.max(0, Math.min(1, l.front + ((pa - pb) / (pa + pb + 1)) * dt * 0.05 + (r() - 0.5) * dt * 0.04));
      if (r() < dt * 3) {
        const [fx, fy] = world.lineAt(l, l.front);
        const na = world.nodes[l.a];
        const nb = world.nodes[l.b];
        world.beams.push({ kind: 'duel', x0: na.x, y0: na.y - 14, x1: fx, y1: fy, color: A.glow, t0: world.t, dur: 0.35, seed: ids++ });
        world.beams.push({ kind: 'duel', x0: nb.x, y0: nb.y - 14, x1: fx, y1: fy, color: B.glow, t0: world.t, dur: 0.35, seed: ids++ });
        if (once(`duel-${l.id}-${Math.floor(world.t / 50)}`)) {
          say(`${A.name} AND ${B.name} DUEL ALONG THE LINE`, fx, fy, '#e0f2fe', 'medium');
          emit('duel', fx, fy, 0.6);
          look('duel', fx, fy, 1.45, 8);
        }
      }
      // Pushed all the way: the tower at the end takes the blow.
      if (l.front <= 0.02 && tb.ward < world.t) {
        damage(ta, dt * 2.5, B);
      } else if (l.front >= 0.98 && ta.ward < world.t) damage(tb, dt * 2.5, A);
    }
    // Every so often an order looks at its neighbours: war, or a pact; or a pact betrayed.
    if (r() < dt * 0.04) {
      const living = world.orders.filter((o) => o.alive);
      const a = pick(living);
      const neighbours = new Set<number>();
      for (const t of towersOf(a)) for (const lid of world.nodes[t.node].links) {
        const m = ownerOf(world.nodes[other(world.lines[lid], t.node)]);
        if (m >= 0 && m !== a.id) neighbours.add(m);
      }
      const b = world.orders[pick([...neighbours]) ?? -1];
      if (!b || !b.alive) return;
      const [cx, cy] = centre(a, b);
      if (a.wars.has(b.id)) {
        if (r() < 0.35) {
          a.wars.delete(b.id);
          b.wars.delete(a.id);
          say(`${a.name} AND ${b.name} MAKE PEACE`, cx, cy, '#bbf7d0', 'medium');
          emit('peace', cx, cy, 0.5);
          chronicle(`${T(a.name)} and ${T(b.name)} made peace.`);
        }
      } else if (a.pacts.has(b.id)) {
        if (a.temper === 'ambitious' && r() < 0.4) {
          a.pacts.delete(b.id);
          b.pacts.delete(a.id);
          a.wars.add(b.id);
          b.wars.add(a.id);
          say(`${a.name} BETRAYS ${b.name}`, cx, cy, '#fca5a5', 'high');
          emit('betrayal', cx, cy, 0.7);
          chronicle(`${T(a.name)} broke its pact with ${T(b.name)}.`);
          look('duel', cx, cy, 1.15, 8);
        }
      } else if (r() < (a.temper === 'scholarly' ? 0.6 : 0.3)) {
        a.pacts.add(b.id);
        b.pacts.add(a.id);
        say(`A PACT BETWEEN ${a.name} AND ${b.name}`, cx, cy, '#bbf7d0', 'medium');
        emit('pact', cx, cy, 0.4);
        chronicle(`${T(a.name)} and ${T(b.name)} sealed a pact.`);
        look('pact', cx, cy, 1.1, 6);
      } else {
        a.wars.add(b.id);
        b.wars.add(a.id);
        say(`${a.name} MAKES WAR ON ${b.name}`, cx, cy, '#fca5a5', 'high');
        emit('war', cx, cy, 0.7);
        chronicle(`${T(a.name)} went to war with ${T(b.name)}.`);
        look('duel', cx, cy, 1.15, 8);
      }
    }
  }
  const centre = (a: Order, b: Order): [number, number] => {
    const ts = [...towersOf(a), ...towersOf(b)].map((t) => world.nodes[t.node]);
    return [ts.reduce((s, n) => s + n.x, 0) / Math.max(1, ts.length), ts.reduce((s, n) => s + n.y, 0) / Math.max(1, ts.length)];
  };

  // ---- the weather of the lines ------------------------------------------------------------------------

  function storms(dt: number) {
    if (r() < dt * 0.012 * opts.storms * (world.converging ? 2.5 : 1) && world.storms.length < 2) {
      const left = r() < 0.5;
      const s: Storm = { id: ids++, x: left ? -60 : W + 60, y: H * (0.2 + r() * 0.6), vx: (left ? 1 : -1) * (14 + r() * 12), vy: (r() - 0.5) * 8, r: Math.min(W, H) * (0.1 + r() * 0.08), power: 0.6 + r() * 0.8, t0: world.t, dur: 80, hue: pick(['#a78bfa', '#f472b6', '#22d3ee', '#fbbf24']) };
      world.storms.push(s);
      say('AN ARCANE STORM COMES OVER THE LAND', left ? 60 : W - 60, s.y, s.hue, 'medium');
      emit('storm', s.x, s.y, 0.5);
      look('storm', left ? W * 0.25 : W * 0.75, s.y, 1.1, 8);
    }
    for (const s of world.storms) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      for (const n of world.nodes) {
        const dd = Math.hypot(n.x - s.x, n.y - s.y);
        if (dd > s.r) continue;
        // It pours wild power into the lines under it.
        n.charge += s.power * dt * 3;
        if (r() < dt * 0.25 * s.power) {
          world.beams.push({ kind: 'strike', x0: n.x + (r() - 0.5) * 30, y0: n.y - s.r * 0.8, x1: n.x, y1: n.y, color: s.hue, t0: world.t, dur: 0.3, seed: ids++ });
          if (n.tower && n.tower.fell < 0) {
            if (n.tower.ward > world.t) world.fx.push({ kind: 'ring', x: n.x, y: n.y, t0: world.t, dur: 0.6, r: 20, color: '#e0f2fe', seed: ids++ });
            else damage(n.tower, 4, null);
          } else if (n.well && r() < 0.06 * opts.rifts) openRift(n, 'where the storm struck a well');
        }
      }
    }
    world.storms = world.storms.filter((s) => s.x > -200 && s.x < W + 200 && world.t - s.t0 < 200);
  }

  function openRift(n: LeyNode, why: string) {
    if (n.dead >= 0 || world.rifts.some((x) => x.closed < 0 && Math.hypot(world.nodes[x.node].x - n.x, world.nodes[x.node].y - n.y) < 80)) return;
    if (world.rifts.filter((x) => x.closed < 0).length >= 2) return;
    const rift: Rift = { id: ids++, node: n.id, x: n.x, y: n.y, r: 16, t0: world.t, closing: 0, closed: -1, swallowed: [] };
    world.rifts.push(rift);
    if (n.tower && n.tower.fell < 0) damage(n.tower, 1000, null);
    say(`A RIFT OPENS AT ${n.name}`, n.x, n.y, '#c084fc', 'high');
    emit('rift', n.x, n.y, 0.9);
    chronicle(`The world tore open at ${T(n.name)}, ${why}.`);
    look('rift', n.x, n.y, 1.5, 10);
  }
  function rifts(dt: number) {
    for (const rift of world.rifts) {
      if (rift.closed >= 0) continue;
      const n = world.nodes[rift.node];
      rift.r = Math.min(80, rift.r + dt * (world.converging ? 1.4 : 0.6));
      // Shades come out of it and go along the lines to the towers.
      if (r() < dt * 0.12) {
        const target = world.towers.filter((t) => t.fell < 0).sort((a, b) => Math.hypot(world.nodes[a.node].x - n.x, world.nodes[a.node].y - n.y) - Math.hypot(world.nodes[b.node].x - n.x, world.nodes[b.node].y - n.y))[0];
        if (target) send('shade', null, n.id, target.node);
      }
      // It swallows the nodes near it.
      for (const m of world.nodes) {
        if (m.dead >= 0 || m === n) continue;
        if (Math.hypot(m.x - rift.x, m.y - rift.y) < rift.r * 0.9) {
          m.dead = world.t;
          rift.swallowed.push(m.id);
          if (m.tower && m.tower.fell < 0) damage(m.tower, 1000, null);
          say(`THE RIFT SWALLOWS ${m.name}`, m.x, m.y, '#c084fc', 'medium');
          emit('swallowed', m.x, m.y, 0.6);
        }
      }
      n.dead = n.dead >= 0 ? n.dead : world.t;
      // The orders send ritualists to close it.
      if (r() < dt * 0.15) {
        const near = world.towers.filter((t) => t.fell < 0 && world.orders[t.order].mana > 20);
        const t = near.sort((a, b) => Math.hypot(world.nodes[a.node].x - n.x, world.nodes[a.node].y - n.y) - Math.hypot(world.nodes[b.node].x - n.x, world.nodes[b.node].y - n.y))[0];
        if (t) {
          const neighbour = world.nodes.find((m) => m.dead < 0 && m.links.some((lid) => other(world.lines[lid], m.id) === n.id));
          // They walk to the edge of it and work from there.
          const to = neighbour ?? world.nodes[t.node];
          if (send('ritualist', world.orders[t.order], t.node, to.id) || t.node === to.id) {
            world.orders[t.order].mana -= 15;
            rift.closing += 0.04;
            if (once(`ritual-${rift.id}`)) {
              say(`${world.orders[t.order].name} BEGINS THE RITUAL OF CLOSING`, to.x, to.y, world.orders[t.order].glow, 'medium');
              emit('ritual', to.x, to.y, 0.5);
            }
          }
        }
      }
      if (rift.closing >= 1 || world.t - rift.t0 > 260) {
        rift.closed = world.t;
        say(`THE RIFT AT ${n.name} IS CLOSED`, n.x, n.y, '#bbf7d0', 'high');
        emit('riftclosed', n.x, n.y, 0.8);
        chronicle(`The rift at ${T(n.name)} was closed${rift.swallowed.length ? `, but ${rift.swallowed.length} ${rift.swallowed.length > 1 ? 'nodes were' : 'node was'} lost to it for a time` : ''}.`);
        look('rift', n.x, n.y, 1.3, 6);
        // What it swallowed comes back, scarred, in time.
        later(120, () => {
          for (const id of [rift.node, ...rift.swallowed]) world.nodes[id].dead = -1;
          say(`THE LINES RETURN TO ${n.name}`, n.x, n.y, world.ley, 'low');
          emit('heal', n.x, n.y, 0.3);
        });
      }
    }
  }

  /** The moons: their cycle, and the convergence at the top of it. */
  function moons(dt: number) {
    world.moons = (world.moons + dt / CONVERGE) % 1;
    if (!world.converging && world.t >= world.nextConvergence - 25 && once(`warn-${Math.floor(world.nextConvergence)}`)) {
      say('THE MOONS DRAW TOGETHER', W / 2, H * 0.2, '#e0e7ff', 'medium');
      emit('moonswarn', W / 2, H * 0.2, 0.4);
    }
    if (!world.converging && world.t >= world.nextConvergence) {
      world.converging = true;
      say('THE CONVERGENCE', W / 2, H * 0.25, '#e0e7ff', 'high');
      emit('convergence', W / 2, H / 2, 0.9);
      chronicle(`The moons came into line over ${T(LAND_NAMES[land].toLowerCase())}, and every well burned.`);
      look('converge', W / 2, H / 2, 1, 14);
    }
    if (world.converging && world.t >= world.nextConvergence + 45) {
      world.converging = false;
      world.nextConvergence = world.t + CONVERGE * (0.8 + r() * 0.4);
      world.age++;
      emit('convergenceends', W / 2, H / 2, 0.3);
      if (r() < 0.5 * opts.rifts) {
        const n = world.nodes.filter((x) => x.well && x.dead < 0)[Math.floor(r() * world.nodes.length) % Math.max(1, world.nodes.filter((x) => x.well && x.dead < 0).length)];
        if (n) openRift(n, 'in the last of the convergence');
      }
    }
  }

  /** Archmages grow old, and die; their orders sometimes split over who comes next. */
  function lives(dt: number) {
    for (const o of world.orders) {
      if (!o.alive) continue;
      o.age += dt / 20;
      if (o.age > 100 && r() < dt * 0.01) {
        const old = o.archmage;
        let next = pick(MAGES);
        for (let k = 0; k < 6 && world.orders.some((x) => x.archmage === next); k++) next = pick(MAGES);
        o.archmage = next;
        o.age = 40 + r() * 30;
        const cap = towersOf(o)[0];
        const n = cap ? world.nodes[cap.node] : world.nodes[0];
        say(`${old} IS DEAD. ${next} LEADS ${o.name}`, n.x, n.y, o.glow, 'medium');
        emit('archmage', n.x, n.y, 0.5);
        chronicle(`${T(old)} of ${T(o.name)} died; ${T(next)} took the staff.`);
        const mine = towersOf(o);
        if (mine.length >= 4 && r() < 0.3 && orderIx < orderDefs.length + 2) {
          // A schism: the towers furthest from the first go their own way.
          const half = mine.slice(Math.ceil(mine.length / 2));
          const at = world.nodes[half[0].node];
          const [name, color, glow, style] = orderDefs[orderIx++ % orderDefs.length];
          const split: Order = { id: world.orders.length, name, color, glow, style, archmage: old === next ? pick(MAGES) : pick(MAGES), temper: pick(tempers), alive: true, mana: o.mana / 2, pacts: new Set(), wars: new Set([o.id]), great: false, age: 40, founded: world.t };
          world.orders.push(split);
          o.wars.add(split.id);
          o.mana /= 2;
          for (const t of half) t.order = split.id;
          say(`${o.name} SPLITS: ${split.name}`, at.x, at.y, split.glow, 'high');
          emit('schism', at.x, at.y, 0.7);
          chronicle(`Over who should follow ${T(old)}, ${T(o.name)} split, and ${T(split.name)} went its own way.`);
          look('duel', at.x, at.y, 1.2, 8);
        }
      }
    }
    // Too few orders: a new one rises at a free well.
    if (world.orders.filter((o) => o.alive).length < 2 && r() < dt * 0.05) {
      const n = world.nodes.find((x) => x.well && !x.tower && x.dead < 0);
      if (n) newOrder(n);
    }
  }

  const pending: { at: number; fn: () => void }[] = [];
  const later = (s: number, fn: () => void) => pending.push({ at: world.t + s, fn });

  function step(dt: number) {
    world.t += dt;
    for (let i = pending.length - 1; i >= 0; i--) if (world.t >= pending[i].at) {
      const f = pending[i].fn;
      pending.splice(i, 1);
      f();
    }
    power(dt);
    moons(dt);
    // Towers being raised.
    for (const t of world.towers) if (t.fell < 0 && t.built < 1) t.built = Math.min(1, t.built + dt / 14);
    orders(dt);
    politics(dt);
    walkers(dt);
    storms(dt);
    rifts(dt);
    lives(dt);
    for (let i = world.beams.length - 1; i >= 0; i--) if (world.t - world.beams[i].t0 > world.beams[i].dur) world.beams.splice(i, 1);
    for (let i = world.fx.length - 1; i >= 0; i--) if (world.t - world.fx[i].t0 > world.fx[i].dur) world.fx.splice(i, 1);
    for (let i = world.labels.length - 1; i >= 0; i--) if (world.t - world.labels[i].t0 > world.labels[i].dur) world.labels.splice(i, 1);
    world.towers = world.towers.filter((t) => t.fell < 0 || world.t - t.fell < 60);
    if (world.t > world.focus.until) {
      // Quiet: the whole land, or a look at a tower.
      if (r() < 0.5) look('overview', W / 2, H / 2, 1, 12);
      else {
        const ts = world.towers.filter((t) => t.fell < 0);
        const t = ts[Math.floor(r() * ts.length)];
        if (t) look('node', world.nodes[t.node].x, world.nodes[t.node].y, 1.35, 8);
      }
    }
  }

  return world;
}
