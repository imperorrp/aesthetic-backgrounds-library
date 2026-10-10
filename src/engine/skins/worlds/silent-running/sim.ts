/**
 * Silent Running: a sea at war, on the chart table of a listening station.
 *
 * On screen, at a glance: a sea chart (coasts, islands, depth bands), two to four ports with
 * the shipping lanes between them, convoys of merchants on the lanes, destroyers pinging,
 * submarines (faint until they are heard), whales, and the station's sonar sweep over it all.
 *
 * Always happening: convoys sail port to port; destroyers patrol and ping; whales migrate and
 * sing; fishing boats work the coasts; the sweep turns.
 * The cast (per seed, `compose`): raiders (submarines that stalk the lanes and torpedo
 * merchants), a wolfpack (raiders that come together), storms (which blind the sonar), ice
 * (floes in the north), and the deep (something very large, very rarely).
 * Keeps going: sunk merchants become wrecks and new ones sail; lost destroyers are replaced
 * from port; raiders that are sunk or that run out of torpedoes are followed by others.
 * A touch drops a sonobuoy: it hears what is under it for a while, and a destroyer comes.
 */
import { createBus, type Bus } from '../../../sim/bus';
import { createNoise2D } from '../../../noise';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Director, type Genome, type SystemDef } from '../../../kit';

export type ShipKind = 'merchant' | 'tanker' | 'destroyer' | 'sub' | 'fisher';
export type Ship = {
  id: number; kind: ShipKind; name: string; x: number; y: number; heading: number; speed: number;
  /** Lane ships: the path and how far along it. */
  path: [number, number][]; pi: number;
  /** Free movers: where they are going. */
  tx: number; ty: number;
  hp: number; alive: boolean; sunkAt: number;
  /** Submarines: 0 at the surface, 1 deep. */
  depth: number;
  /** Heard until this time (submarines). */
  heard: number;
  state: 'sail' | 'patrol' | 'hunt' | 'stalk' | 'attack' | 'evade' | 'leave' | 'escort' | 'fish';
  target: number; cd: number; torpedoes: number; t0: number; convoy: number;
};
export type Port = { name: string; x: number; y: number; sea: [number, number] };
export type Torpedo = { x: number; y: number; target: number; from: number; t0: number; heading: number };
export type Ring = { x: number; y: number; t0: number; r: number; kind: 'ping' | 'charge' | 'song' | 'buoy' | 'hit' };
export type Whale = { x: number; y: number; vx: number; vy: number; n: number; nextSong: number };
export type Wreck = { x: number; y: number; name: string; t: number };
export type Buoy = { x: number; y: number; t0: number; until: number };
export type Label = { text: string; x: number; y: number; t0: number; color: string };

export type SeaOptions = { traffic: number; camera?: string };

export type SeaWorld = {
  t: number; W: number; H: number; GW: number; GH: number; bus: Bus; director: Director;
  name: string; cast: string[]; castIds: string[]; u: number;
  /** Land: true where the chart is dry. Height is the depth field (negative is deep). */
  landAt(x: number, y: number): boolean;
  heightAt(x: number, y: number): number;
  ports: Port[]; lanes: [number, number][][];
  ships: Ship[]; torpedoes: Torpedo[]; rings: Ring[]; whales: Whale[]; wrecks: Wreck[]; buoys: Buoy[]; slicks: { x: number; y: number; t0: number }[];
  /** Storm cover, 0..1, over a band of the chart. */
  storm: { x: number; y: number; r: number; until: number } | null;
  ice: { x: number; y: number; r: number }[];
  /** The station's sweep, radians. */
  sweep: number; station: [number, number];
  labels: Label[]; chronicle: { t: number; text: string }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

const SEAS = ['THE NARROW SEA', 'THE GREY STRAIT', 'THE NORTHERN APPROACHES', 'THE IRON SOUND', 'THE WESTERN REACH', 'THE COLD BIGHT'];
const PORTS = ['HAVNMOUTH', 'KESSELBY', 'PORT ARDEN', 'SALTMARK', 'BRISK', 'NORHAVEN', 'GULLWICK', 'OST TAMMER', 'CAPE LORN', 'WREXHOLM'];
const MERCHANTS = ['ELSA', 'BRENNA', 'MARIT', 'ORLA', 'TILDA', 'GRETE', 'IONA', 'KAIA', 'SVEA', 'HELKA', 'MAREN', 'ODA', 'RUNA', 'FREYA', 'LINNEA', 'ASTA'];
const DESTROYERS = ['VIGILANT', 'KESTREL', 'HARRIER', 'STALWART', 'SENTINEL', 'MERLIN', 'TALON', 'WARDEN'];
const SUBS = ['U-41', 'U-17', 'U-63', 'U-88', 'U-29', 'U-52', 'U-70', 'U-34'];

type Ctx = { world: SeaWorld; r: Rng; say(text: string, x: number, y: number, color?: string): void; emit(type: string, x: number, y: number, weight: number): void; chronicle(text: string): void; spawnSub(fromEdge: boolean): Ship | null };

const LIBRARY: SystemDef<Ctx>[] = [
  {
    id: 'raiders',
    label: 'raiders',
    weight: 6,
    tags: ['threat'],
    create: (c) => ({
      id: 'raiders',
      step() {
        const w = c.world;
        const subs = w.ships.filter((s) => s.kind === 'sub' && s.alive).length;
        if (subs < 2 && w.t > 20 && w.director.want('raider', 0.5, 70)) {
          const s = c.spawnSub(true);
          if (s) c.emit('raider', s.x, s.y, 0.3);
        }
      },
    }),
  },
  {
    id: 'wolfpack',
    label: 'a wolfpack',
    weight: 2,
    tags: ['threat'],
    create: (c) => ({
      id: 'wolfpack',
      step() {
        const w = c.world;
        if (w.t < 240 || !w.director.want('wolfpack', 0.9, 600)) return;
        const lead = c.spawnSub(true);
        if (!lead) return;
        for (let k = 0; k < 2; k++) {
          const s = c.spawnSub(true);
          if (s) Object.assign(s, { x: lead.x + (c.r() - 0.5) * 80, y: lead.y + (c.r() - 0.5) * 80 });
        }
        c.say('A WOLFPACK GATHERS ON THE LANES', lead.x, lead.y, '#fca5a5');
        c.emit('wolfpack', lead.x, lead.y, 0.8);
        c.chronicle('A wolfpack gathered on the lanes.');
        w.director.look('wolfpack', lead.x, lead.y, 1.3, 16, 7);
      },
    }),
  },
  {
    id: 'storms',
    label: 'storms',
    weight: 4,
    tags: ['weather'],
    create: (c) => ({
      id: 'storms',
      step(dt) {
        const w = c.world;
        if (!w.storm && w.director.want('storm', 0.35, 150)) {
          w.storm = { x: c.r() < 0.5 ? -300 : w.GW + 300, y: w.GH * (0.2 + c.r() * 0.6), r: 260 * w.u + c.r() * 120, until: w.t + 70 };
          c.say('A GALE COMES IN, AND THE SONAR GOES DEAF', w.GW / 2, w.GH * 0.15, '#cbd5e1');
          c.emit('storm', w.GW / 2, w.GH / 2, 0.4);
        }
        const s = w.storm;
        if (!s) return;
        s.x += Math.sign(w.GW / 2 - s.x || 1) * dt * 22;
        if (w.t > s.until) w.storm = null;
      },
    }),
  },
  {
    id: 'ice',
    label: 'ice',
    weight: 2,
    tags: ['weather'],
    create: (c) => {
      const w = c.world;
      for (let k = 0; k < 6; k++) {
        const x = c.r() * w.GW;
        const y = c.r() * w.GH * 0.3;
        if (!w.landAt(x, y)) w.ice.push({ x, y, r: (14 + c.r() * 30) * w.u });
      }
      return { id: 'ice', step(dt) {
        for (const f of w.ice) f.x = (f.x + dt * 3 + w.GW) % w.GW;
      } };
    },
  },
  {
    id: 'deep',
    label: 'the deep',
    weight: 1,
    tags: ['wonder'],
    create: (c) => ({
      id: 'deep',
      step() {
        const w = c.world;
        // Most long watches never hear it: past the tenth minute, and even then seldom.
        if (w.t < 600 || !w.director.want('leviathan', 1, 2400) || c.r() < 0.6) return;
        const y = w.GH * (0.3 + c.r() * 0.4);
        w.whales.push({ x: -200, y, vx: 9, vy: 0, n: -1, nextSong: w.t + 3 });
        c.say('A CONTACT TOO LARGE FOR ANY BOAT PASSES UNDER THE LANES', w.GW / 2, y - 40, '#a5f3fc');
        c.emit('leviathan', w.GW / 2, y, 1);
        c.chronicle('Something larger than any boat passed under the lanes.');
      },
    }),
  },
];
const RULE = { total: [2, 4] as [number, number], quota: { threat: [1, 2] as [number, number], weather: [0, 1] as [number, number] } };

export function createSea(seed: string | number, W: number, H: number, opts: SeaOptions): SeaWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'sea');
  const g: Genome = createGenome(seed, 'sea');
  const noise = createNoise2D(forkRng(seed, 'sea-noise'));
  const GW = Math.round(W * WORLD_SCALE);
  const GH = Math.round(H * WORLD_SCALE);
  const u = Math.max(0.4, Math.min(1, Math.min(GW, GH * 1.6) / 1600));
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  let ids = 1;

  // The land: noise, raised toward one or two coasts the seed chooses, and a few islands.
  const coasts = g.subset(['north', 'south', 'west', 'east'] as const, 1, 2);
  const freq = g.range(1.6, 2.6) / Math.max(GW, GH);
  const heightAt = (x: number, y: number) => {
    let h = noise.fbm2(x * freq, y * freq, 4) * 0.55 - 0.22;
    for (const c of coasts) {
      const d = c === 'north' ? y / GH : c === 'south' ? 1 - y / GH : c === 'west' ? x / GW : 1 - x / GW;
      h += Math.max(0, 0.22 - d) * 3.2;
    }
    return h;
  };
  const landAt = (x: number, y: number) => x < 0 || y < 0 || x > GW || y > GH ? false : heightAt(x, y) > 0.12;

  // A coarse grid for lanes.
  const C = Math.max(14, Math.round(22 * u));
  const cols = Math.ceil(GW / C);
  const rows = Math.ceil(GH / C);
  const wet = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) wet[j * cols + i] = landAt((i + 0.5) * C, (j + 0.5) * C) ? 0 : 1;
  const lane = (a: [number, number], b: [number, number]): [number, number][] | null => {
    const si = Math.floor(a[0] / C) + Math.floor(a[1] / C) * cols;
    const gi = Math.floor(b[0] / C) + Math.floor(b[1] / C) * cols;
    if (!wet[si] || !wet[gi]) return null;
    const prev = new Int32Array(cols * rows).fill(-1);
    prev[si] = si;
    const q = [si];
    for (let k = 0; k < q.length && prev[gi] < 0; k++) {
      const i = q[k];
      const x = i % cols;
      const y = Math.floor(i / cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (prev[j] >= 0 || !wet[j]) continue;
        prev[j] = i;
        q.push(j);
      }
    }
    if (prev[gi] < 0) return null;
    const cells: number[] = [];
    for (let i = gi; i !== si; i = prev[i]) cells.push(i);
    cells.push(si);
    cells.reverse();
    // Every few cells, smoothed: a lane is a sailing line, not a staircase.
    const pts: [number, number][] = [a];
    for (let k = 3; k < cells.length - 2; k += 3) pts.push([((cells[k] % cols) + 0.5) * C, (Math.floor(cells[k] / cols) + 0.5) * C]);
    pts.push(b);
    return pts;
  };

  const world: SeaWorld = {
    t: 0, W, H, GW, GH, bus, u,
    director: createDirector(forkRng(seed, 'sea-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => ({ x: GW / 2, y: GH / 2, zoom: 1 }) }),
    name: g.pick(SEAS), cast: [], castIds: [],
    landAt, heightAt, ports: [], lanes: [],
    ships: [], torpedoes: [], rings: [], whales: [], wrecks: [], buoys: [], slicks: [], storm: null, ice: [],
    sweep: 0, station: [GW / 2, GH / 2],
    labels: [], chronicle: [],
    step, nudge,
    counts: () => ({
      merchants: world.ships.filter((s) => s.alive && (s.kind === 'merchant' || s.kind === 'tanker')).length,
      destroyers: world.ships.filter((s) => s.alive && s.kind === 'destroyer').length,
      subs: world.ships.filter((s) => s.alive && s.kind === 'sub').length,
      wrecks: world.wrecks.length,
      whales: world.whales.length,
      lanes: world.lanes.length,
    }),
  };

  const say = (text: string, x: number, y: number, color = '#e2e8f0') => {
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
  const T = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

  // Ports: on the water's edge, spread apart.
  const nPorts = Math.max(2, Math.min(4, Math.round(g.range(2, 4.4) * Math.sqrt(u))));
  for (let tries = 0; tries < 4000 && world.ports.length < nPorts; tries++) {
    const x = (0.06 + r() * 0.88) * GW;
    const y = (0.08 + r() * 0.84) * GH;
    if (!landAt(x, y)) continue;
    // A dry spot with open water a step away.
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const d = dirs.find(([dx, dy]) => !landAt(x + dx * C * 1.5, y + dy * C * 1.5) && !landAt(x + dx * C * 3, y + dy * C * 3));
    if (!d) continue;
    if (world.ports.some((p) => Math.hypot(p.x - x, p.y - y) < Math.max(GW, GH) * 0.35)) continue;
    const used = new Set(world.ports.map((p) => p.name));
    let name = pick(PORTS);
    for (let k = 0; k < 8 && used.has(name); k++) name = pick(PORTS);
    world.ports.push({ name, x, y, sea: [x + d[0] * C * 2, y + d[1] * C * 2] });
  }
  // If the land gave no coast fit for ports, two harbours at the chart's edges.
  if (world.ports.length < 2) {
    world.ports = [
      { name: PORTS[0], x: 8, y: GH * 0.4, sea: [C * 2, GH * 0.4] },
      { name: PORTS[1], x: GW - 8, y: GH * 0.6, sea: [GW - C * 2, GH * 0.6] },
    ];
    for (const p of world.ports) for (let k = 0; k < 5; k++) wet[Math.floor(p.sea[1] / C) * cols + Math.floor(p.sea[0] / C)] = 1;
  }
  for (let i = 0; i < world.ports.length; i++) for (let j = i + 1; j < world.ports.length; j++) {
    const l = lane(world.ports[i].sea, world.ports[j].sea);
    if (l) world.lanes.push(l);
  }
  if (!world.lanes.length) world.lanes.push([world.ports[0].sea, world.ports[world.ports.length - 1].sea]);
  // The station sits on the driest middle ground (or the middle of the chart).
  let best = -Infinity;
  for (let k = 0; k < 200; k++) {
    const x = (0.25 + r() * 0.5) * GW;
    const y = (0.25 + r() * 0.5) * GH;
    const h = heightAt(x, y);
    if (landAt(x, y) && h > best) {
      best = h;
      world.station = [x, y];
    }
  }

  // ---- ships ---------------------------------------------------------------------------------
  let nameK = 0;
  const ship = (kind: ShipKind, x: number, y: number, extra: Partial<Ship> = {}): Ship => {
    const names = kind === 'destroyer' ? DESTROYERS : kind === 'sub' ? SUBS : MERCHANTS;
    const s: Ship = {
      id: ids++, kind, name: names[(nameK++ * 7 + Math.floor(r() * names.length)) % names.length], x, y, heading: 0, speed: kind === 'destroyer' ? 34 : kind === 'sub' ? 16 : kind === 'fisher' ? 8 : 18,
      path: [], pi: 0, tx: x, ty: y, hp: kind === 'sub' ? 3 : kind === 'destroyer' ? 4 : 2, alive: true, sunkAt: -1, depth: kind === 'sub' ? 0.8 : 0, heard: -1,
      state: kind === 'destroyer' ? 'patrol' : kind === 'sub' ? 'stalk' : kind === 'fisher' ? 'fish' : 'sail', target: -1, cd: 0, torpedoes: 4, t0: world.t, convoy: -1, ...extra,
    };
    world.ships.push(s);
    return s;
  };
  let convoys = 0;
  function convoy(quiet = false) {
    const l = pick(world.lanes);
    const fwd = r() < 0.5;
    const path = fwd ? l : [...l].reverse();
    const n = 2 + Math.floor(r() * 3 * Math.max(0.5, opts.traffic));
    const id = ++convoys;
    const ahead = (k: number): [number, number] => [path[0][0] - k * 26 * u * Math.cos(Math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0])), path[0][1] - k * 26 * u * Math.sin(Math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0]))];
    for (let k = 0; k < n; k++) {
      const [x, y] = ahead(k);
      ship(r() < 0.25 ? 'tanker' : 'merchant', x, y, { path, pi: 0, convoy: id });
    }
    const from = world.ports.reduce((a, p) => (Math.hypot(p.sea[0] - path[0][0], p.sea[1] - path[0][1]) < Math.hypot(a.sea[0] - path[0][0], a.sea[1] - path[0][1]) ? p : a));
    const free = world.ships.find((s) => s.alive && s.kind === 'destroyer' && s.state === 'patrol');
    if (free && r() < 0.6) Object.assign(free, { state: 'escort', convoy: id, target: -1 });
    if (!quiet) {
      say(`A CONVOY OF ${n} SAILS FROM ${from.name}`, path[0][0], path[0][1] - 20, '#fde68a');
      emit('convoy', path[0][0], path[0][1], 0.25);
    }
  }
  function spawnSub(fromEdge: boolean): Ship | null {
    if (world.ships.filter((s) => s.kind === 'sub' && s.alive).length >= 4) return null;
    for (let k = 0; k < 30; k++) {
      const side = Math.floor(r() * 4);
      const x = fromEdge ? (side === 0 ? 10 : side === 1 ? GW - 10 : r() * GW) : r() * GW;
      const y = fromEdge ? (side === 2 ? 10 : side === 3 ? GH - 10 : r() * GH) : r() * GH;
      if (landAt(x, y)) continue;
      return ship('sub', x, y);
    }
    return null;
  }
  // The opening: convoys under way, destroyers on patrol, a whale or two, boats by the coast.
  const nDestroyers = Math.max(1, Math.round(g.range(1.5, 3.4) * Math.sqrt(u)));
  for (let k = 0; k < nDestroyers; k++) {
    const p = world.ports[k % world.ports.length];
    ship('destroyer', p.sea[0], p.sea[1]);
  }
  for (let k = 0; k < 2; k++) {
    convoy(true);
    // Spread the opening convoys along their lanes.
    const along = 0.2 + r() * 0.5;
    for (const s of world.ships.filter((x) => x.convoy === convoys && x.path.length > 1)) {
      s.pi = Math.floor(along * (s.path.length - 1));
      [s.x, s.y] = s.path[s.pi];
    }
  }
  for (let k = 0; k < 1 + Math.floor(r() * 2); k++) world.whales.push({ x: r() * GW, y: r() * GH, vx: (r() < 0.5 ? -1 : 1) * (5 + r() * 4), vy: (r() - 0.5) * 3, n: 2 + Math.floor(r() * 3), nextSong: 10 + r() * 20 });
  for (const p of world.ports) for (let k = 0; k < 2; k++) ship('fisher', p.sea[0] + (r() - 0.5) * 60 * u, p.sea[1] + (r() - 0.5) * 60 * u);

  const ctx: Ctx = { world, r, say, emit, chronicle, spawnSub };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);

  // ---- movement ------------------------------------------------------------------------------
  const blocked = (x: number, y: number) => landAt(x, y) || world.ice.some((f) => Math.hypot(f.x - x, f.y - y) < f.r);
  /** Steer toward (tx, ty), going around land. Returns true on arrival. */
  function steer(s: Ship, tx: number, ty: number, speed: number, dt: number): boolean {
    const want = Math.atan2(ty - s.y, tx - s.x);
    let a = want;
    for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
      const h = want + off;
      if (!blocked(s.x + Math.cos(h) * 30 * u, s.y + Math.sin(h) * 30 * u)) {
        a = h;
        break;
      }
    }
    const turn = Math.atan2(Math.sin(a - s.heading), Math.cos(a - s.heading));
    s.heading += Math.max(-dt * 1.2, Math.min(dt * 1.2, turn));
    const nx = s.x + Math.cos(s.heading) * speed * u * dt;
    const ny = s.y + Math.sin(s.heading) * speed * u * dt;
    if (!landAt(nx, ny)) {
      s.x = nx;
      s.y = ny;
    }
    return Math.hypot(tx - s.x, ty - s.y) < 14 * u;
  }
  const sink = (s: Ship, how: string) => {
    s.alive = false;
    s.sunkAt = world.t;
    world.rings.push({ x: s.x, y: s.y, t0: world.t, r: 30 * u, kind: 'hit' });
    world.slicks.push({ x: s.x, y: s.y, t0: world.t });
    if (world.slicks.length > 12) world.slicks.shift();
    if (s.kind !== 'sub') {
      world.wrecks.push({ x: s.x, y: s.y, name: s.name, t: world.t });
      if (world.wrecks.length > 14) world.wrecks.shift();
    }
    void how;
  };

  function merchants(s: Ship, dt: number) {
    if (s.pi >= s.path.length - 1) {
      s.alive = false;
      const port = world.ports.reduce((a, p) => (Math.hypot(p.sea[0] - s.x, p.sea[1] - s.y) < Math.hypot(a.sea[0] - s.x, a.sea[1] - s.y) ? p : a));
      if (!world.ships.some((o) => o.alive && o.convoy === s.convoy && o !== s)) {
        say(`THE CONVOY REACHES ${port.name}`, port.x, port.y - 20, '#fde68a');
        emit('arrived', port.x, port.y, 0.2);
      }
      return;
    }
    const [tx, ty] = s.path[s.pi + 1];
    if (steer(s, tx, ty, s.speed, dt)) s.pi++;
  }

  function destroyer(s: Ship, dt: number) {
    s.cd -= dt;
    // The ping: every few seconds, and more often on a hunt.
    if (s.cd <= 0) {
      s.cd = s.state === 'hunt' ? 4 : 9 + r() * 6;
      world.rings.push({ x: s.x, y: s.y, t0: world.t, r: 0, kind: 'ping' });
      emit('active', s.x, s.y, 0.12);
      const deaf = world.storm && Math.hypot(world.storm.x - s.x, world.storm.y - s.y) < world.storm.r ? 0.35 : 1;
      for (const sub of world.ships) {
        if (!sub.alive || sub.kind !== 'sub') continue;
        const d = Math.hypot(sub.x - s.x, sub.y - s.y);
        if (d > 300 * u) continue;
        if (r() < deaf * (1 - d / (320 * u)) * (1.1 - sub.depth * 0.6)) {
          const fresh = sub.heard < world.t;
          sub.heard = world.t + 25;
          if (fresh) {
            const bearing = Math.round(((Math.atan2(sub.x - s.x, -(sub.y - s.y)) * 180) / Math.PI + 360) % 360);
            say(`${s.name}: CONTACT, BEARING ${String(bearing).padStart(3, '0')}`, s.x, s.y - 18, '#a5f3fc');
            emit('contact', sub.x, sub.y, 0.45);
          }
          if (s.state !== 'hunt') Object.assign(s, { state: 'hunt', target: sub.id, t0: world.t });
        }
      }
      // A whale heard for a boat, now and then.
      const w = world.whales.find((x) => Math.hypot(x.x - s.x, x.y - s.y) < 200 * u);
      if (w && r() < 0.08) {
        say(`${s.name}: CONTACT... BIOLOGICAL. A WHALE`, s.x, s.y - 18, '#bbf7d0');
        emit('falsecontact', w.x, w.y, 0.2);
      }
    }
    if (s.state === 'hunt') {
      const sub = world.ships.find((x) => x.id === s.target && x.alive);
      if (!sub || sub.heard < world.t || world.t - s.t0 > 80) {
        if (sub) {
          say(`${s.name} LOSES CONTACT`, s.x, s.y - 18, '#94a3b8');
          emit('lost', s.x, s.y, 0.2);
        }
        Object.assign(s, { state: 'patrol', target: -1 });
        return;
      }
      if (steer(s, sub.x, sub.y, s.speed * 1.2, dt) || Math.hypot(sub.x - s.x, sub.y - s.y) < 40 * u) {
        // A pattern of depth charges over the contact.
        if (world.t - s.t0 > 2 && r() < dt * 0.6) {
          for (let k = 0; k < 4; k++) world.rings.push({ x: sub.x + (r() - 0.5) * 50 * u, y: sub.y + (r() - 0.5) * 50 * u, t0: world.t + k * 0.35, r: 6, kind: 'charge' });
          emit('detonation', sub.x, sub.y, 0.6);
          if (r() < 0.45 - sub.depth * 0.15) sub.hp -= 1;
          if (sub.hp <= 0) {
            sink(sub, 'charges');
            say(`${sub.name} IS SUNK BY ${s.name}`, sub.x, sub.y - 18, '#fca5a5');
            emit('kill', sub.x, sub.y, 0.9);
            chronicle(`${T(s.name)} sank ${sub.name}.`);
            world.director.look('kill', sub.x, sub.y, 1.4, 12, 7);
            Object.assign(s, { state: 'patrol', target: -1 });
          } else if (sub.state !== 'evade') {
            Object.assign(sub, { state: 'evade', t0: world.t });
            if (r() < 0.5) {
              // A decoy: the destroyer chases a noise while the boat slips away.
              sub.heard = world.t + 2;
              say(`${sub.name} RELEASES A DECOY`, sub.x, sub.y - 18, '#fde68a');
              emit('decoy', sub.x, sub.y, 0.4);
            }
          }
          s.t0 = world.t - 1;
        }
      }
      return;
    }
    if (s.state === 'escort') {
      const flock = world.ships.filter((x) => x.alive && x.convoy === s.convoy);
      if (!flock.length) return void Object.assign(s, { state: 'patrol' });
      const lead = flock[0];
      steer(s, lead.x + Math.cos(lead.heading + 1.4) * 40 * u, lead.y + Math.sin(lead.heading + 1.4) * 40 * u, s.speed, dt);
      return;
    }
    // Patrol: from point to point along the lanes.
    if (steer(s, s.tx, s.ty, s.speed * 0.7, dt) || world.t - s.t0 > 60) {
      const l = pick(world.lanes);
      const p = l[Math.floor(r() * l.length)];
      Object.assign(s, { tx: p[0] + (r() - 0.5) * 80 * u, ty: p[1] + (r() - 0.5) * 80 * u, t0: world.t });
    }
  }

  function sub(s: Ship, dt: number) {
    if (s.state === 'leave') {
      s.depth = Math.min(1, s.depth + dt * 0.05);
      if (steer(s, s.tx, s.ty, s.speed, dt) || s.x < -20 || s.y < -20 || s.x > GW + 20 || s.y > GH + 20) s.alive = false;
      return;
    }
    if (s.state === 'evade') {
      s.depth = Math.min(1, s.depth + dt * 0.12);
      const away = Math.atan2(s.y - world.station[1], s.x - world.station[0]) + Math.sin(world.t * 0.3) * 0.6;
      steer(s, s.x + Math.cos(away) * 200, s.y + Math.sin(away) * 200, s.speed * 1.2, dt);
      if (world.t - s.t0 > 30) Object.assign(s, { state: s.torpedoes > 0 ? 'stalk' : 'leave', t0: world.t, tx: s.x < GW / 2 ? -40 : GW + 40, ty: s.y });
      return;
    }
    if (s.torpedoes <= 0) return void Object.assign(s, { state: 'leave', tx: s.x < GW / 2 ? -40 : GW + 40, ty: s.y });
    const prey = world.ships.filter((x) => x.alive && (x.kind === 'merchant' || x.kind === 'tanker')).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
    if (!prey) {
      s.depth = Math.max(0.5, s.depth - dt * 0.02);
      steer(s, world.station[0] + Math.cos(world.t * 0.05 + s.id) * GW * 0.3, world.station[1] + Math.sin(world.t * 0.05 + s.id) * GH * 0.3, s.speed * 0.6, dt);
      return;
    }
    const d = Math.hypot(prey.x - s.x, prey.y - s.y);
    // Up to periscope depth for the attack.
    s.depth += ((d < 280 * u ? 0.35 : 0.8) - s.depth) * Math.min(1, dt * 0.3);
    s.cd -= dt;
    if (d < 220 * u && s.cd <= 0) {
      s.cd = 12;
      s.torpedoes--;
      const lead = Math.atan2(prey.y + Math.sin(prey.heading) * d * 0.25 - s.y, prey.x + Math.cos(prey.heading) * d * 0.25 - s.x);
      world.torpedoes.push({ x: s.x, y: s.y, target: prey.id, from: s.id, t0: world.t, heading: lead });
      say(`${s.name} FIRES ON THE ${prey.name}`, s.x, s.y - 18, '#fca5a5');
      emit('torpedo', s.x, s.y, 0.6);
      return;
    }
    steer(s, prey.x - Math.cos(prey.heading) * 120 * u, prey.y - Math.sin(prey.heading) * 120 * u, s.speed, dt);
  }

  function torpedoes(dt: number) {
    for (let i = world.torpedoes.length - 1; i >= 0; i--) {
      const tp = world.torpedoes[i];
      const prey = world.ships.find((x) => x.id === tp.target && x.alive);
      if (prey) {
        const want = Math.atan2(prey.y - tp.y, prey.x - tp.x);
        const turn = Math.atan2(Math.sin(want - tp.heading), Math.cos(want - tp.heading));
        tp.heading += Math.max(-dt * 0.35, Math.min(dt * 0.35, turn));
      }
      tp.x += Math.cos(tp.heading) * 80 * u * dt;
      tp.y += Math.sin(tp.heading) * 80 * u * dt;
      if (prey && Math.hypot(prey.x - tp.x, prey.y - tp.y) < 12 * u) {
        world.torpedoes.splice(i, 1);
        prey.hp -= prey.kind === 'tanker' ? 2 : 1 + (r() < 0.5 ? 1 : 0);
        emit('detonation', prey.x, prey.y, 0.7);
        if (prey.hp <= 0) {
          sink(prey, 'torpedo');
          say(`THE ${prey.name} IS HIT, AND GOES DOWN`, prey.x, prey.y - 18, '#fca5a5');
          emit('sunk', prey.x, prey.y, 0.8);
          chronicle(`The ${T(prey.name)} was torpedoed and sank.`);
          world.director.look('sunk', prey.x, prey.y, 1.4, 12, 6);
        } else {
          say(`THE ${prey.name} IS HIT, AND STILL AFLOAT`, prey.x, prey.y - 18, '#fdba74');
          emit('hit', prey.x, prey.y, 0.5);
        }
        continue;
      }
      if (world.t - tp.t0 > 12 || landAt(tp.x, tp.y)) {
        world.torpedoes.splice(i, 1);
        if (landAt(tp.x, tp.y)) world.rings.push({ x: tp.x, y: tp.y, t0: world.t, r: 10, kind: 'hit' });
        emit('missed', tp.x, tp.y, 0.2);
      }
    }
  }

  function whales(dt: number) {
    for (let i = world.whales.length - 1; i >= 0; i--) {
      const w = world.whales[i];
      w.x += w.vx * u * dt;
      w.y += w.vy * u * dt;
      if (landAt(w.x + w.vx * 4, w.y)) w.vx *= -1;
      if (landAt(w.x, w.y + w.vy * 4)) w.vy *= -1;
      if (world.t > w.nextSong) {
        w.nextSong = world.t + 25 + r() * 25;
        world.rings.push({ x: w.x, y: w.y, t0: world.t, r: 8, kind: 'song' });
        emit(w.n < 0 ? 'deepsong' : 'whale', w.x, w.y, w.n < 0 ? 0.6 : 0.2);
      }
      if (w.x < -260 || w.x > GW + 260) world.whales.splice(i, 1);
    }
    if (world.whales.filter((w) => w.n > 0).length < 1 && r() < dt * 0.02) {
      const fromLeft = r() < 0.5;
      world.whales.push({ x: fromLeft ? -40 : GW + 40, y: GH * (0.2 + r() * 0.6), vx: (fromLeft ? 1 : -1) * (5 + r() * 4), vy: (r() - 0.5) * 3, n: 2 + Math.floor(r() * 3), nextSong: world.t + 8 });
      say('WHALES COME INTO THE SOUND', fromLeft ? 120 : GW - 120, GH * 0.3, '#bbf7d0');
      emit('whales', fromLeft ? 0 : GW, GH / 2, 0.2);
    }
  }

  /** A touch: a sonobuoy on the water, listening; it hears what passes under, and calls a destroyer. */
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 4 || landAt(x, y) || x < 0 || y < 0 || x > GW || y > GH) return null;
    lastNudge = world.t;
    world.buoys.push({ x, y, t0: world.t, until: world.t + 30 });
    if (world.buoys.length > 4) world.buoys.shift();
    world.rings.push({ x, y, t0: world.t, r: 0, kind: 'buoy' });
    const heard = world.ships.filter((s) => s.alive && s.kind === 'sub' && Math.hypot(s.x - x, s.y - y) < 240 * u);
    if (heard.length) {
      for (const s of heard) s.heard = world.t + 30;
      const d = world.ships.filter((s) => s.alive && s.kind === 'destroyer').sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      if (d) Object.assign(d, { state: 'hunt', target: heard[0].id, t0: world.t });
      say('THE BUOY HEARS A SUBMARINE', x, y - 18, '#a5f3fc');
      emit('nudge', x, y, 0.4);
      return 'THE BUOY HEARS A SUBMARINE';
    }
    say('A SONOBUOY IS DROPPED, AND LISTENS', x, y - 18, '#cbd5e1');
    emit('nudge', x, y, 0.3);
    return 'A SONOBUOY IS DROPPED, AND LISTENS';
  }

  // ---- the step ------------------------------------------------------------------------------
  let nextConvoy = 15;
  let nextRefit = 30;
  function step(dt: number) {
    world.t += dt;
    world.director.step(world.t, dt);
    world.sweep = (world.sweep + dt * ((Math.PI * 2) / 6)) % (Math.PI * 2);
    if (world.t > nextConvoy) {
      nextConvoy = world.t + (22 + r() * 22) / Math.max(0.3, opts.traffic);
      if (world.ships.filter((s) => s.alive && (s.kind === 'merchant' || s.kind === 'tanker')).length < 14) convoy();
    }
    if (world.t > nextRefit) {
      nextRefit = world.t + 40;
      if (world.ships.filter((s) => s.alive && s.kind === 'destroyer').length < nDestroyers) {
        const p = pick(world.ports);
        const d = ship('destroyer', p.sea[0], p.sea[1]);
        say(`${d.name} PUTS TO SEA FROM ${p.name}`, p.x, p.y - 20, '#cbd5e1');
        emit('commission', p.x, p.y, 0.3);
      }
    }
    for (const s of world.ships) {
      if (!s.alive) continue;
      if (s.kind === 'merchant' || s.kind === 'tanker') merchants(s, dt);
      else if (s.kind === 'destroyer') destroyer(s, dt);
      else if (s.kind === 'sub') sub(s, dt);
      else if (s.kind === 'fisher') {
        if (steer(s, s.tx, s.ty, s.speed, dt) || world.t - s.t0 > 30) {
          const p = world.ports.reduce((a, q) => (Math.hypot(q.sea[0] - s.x, q.sea[1] - s.y) < Math.hypot(a.sea[0] - s.x, a.sea[1] - s.y) ? q : a));
          Object.assign(s, { tx: p.sea[0] + (r() - 0.5) * 120 * u, ty: p.sea[1] + (r() - 0.5) * 120 * u, t0: world.t });
        }
      }
    }
    torpedoes(dt);
    whales(dt);
    for (const sy of systems) sy.step?.(dt);
    // Something surfaces at night to breathe, now and then.
    const quiet = world.ships.find((s) => s.alive && s.kind === 'sub' && s.state === 'stalk' && s.heard < world.t);
    if (quiet && world.director.want('surfaced', 0.3, 200)) {
      quiet.depth = 0;
      say(`${quiet.name} SURFACES TO CHARGE ITS BATTERIES`, quiet.x, quiet.y - 18, '#e2e8f0');
      emit('surfaced', quiet.x, quiet.y, 0.35);
    }
    world.ships = world.ships.filter((s) => s.alive || world.t - s.sunkAt < 6);
    world.rings = world.rings.filter((q) => world.t - q.t0 < 4);
    world.buoys = world.buoys.filter((b) => world.t < b.until);
    world.slicks = world.slicks.filter((s) => world.t - s.t0 < 120);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
