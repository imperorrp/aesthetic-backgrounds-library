/**
 * The Pond: the template world. `pnpm create-world <id>` copies this folder; make it yours.
 *
 * A world is a seeded, DOM-free simulation (this file) and a painter (paint.ts). The sim owns
 * everything that happens; the painter only draws it. The bar (docs/AUTHORING.md):
 *
 * - Busy at 1x: something moves everywhere, and something happens every few seconds.
 * - Literal and readable: a pond, lily pads, frogs, a heron, rain. Named things, plain lines.
 * - Never stagnates: growth, loss, regrowth. The director paces the big moments.
 * - Varied by seed: the genome draws the pond and its look; `compose` draws its cast.
 * - Answers a touch: `nudge` (a stone dropped in the water).
 *
 * Rules of the house: randomness only from the seeded rng and genome; time only from `step`;
 * positions in world pixels (GW × GH, the screen's shape a little larger); every event goes
 * through `emit` (sound, the journal, the director) and every line through `say`.
 */
import { createBus, type Bus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Director, type Genome, type SystemDef } from '../../../kit';

export type Pad = { x: number; y: number; r: number; grown: number; bloom: number };
export type Frog = { id: number; name: string; x: number; y: number; pad: number; hop: number; from: [number, number]; alive: boolean };
export type Ripple = { x: number; y: number; t0: number; r: number };
export type Heron = { x: number; y: number; state: 'arrive' | 'stalk' | 'strike' | 'leave'; t0: number; target: number; fromLeft: boolean };
export type Label = { text: string; x: number; y: number; t0: number; color: string };

export type PondOptions = { frogs: number; camera?: string };

export type PondWorld = {
  t: number; W: number; H: number; GW: number; GH: number; bus: Bus; director: Director;
  name: string; cast: string[]; castIds: string[]; hues: string[];
  /** The pond: an ellipse in world pixels. */
  cx: number; cy: number; rx: number; ry: number;
  pads: Pad[]; frogs: Frog[]; ripples: Ripple[]; heron: Heron | null; rain: number; bloom: number;
  labels: Label[]; chronicle: { t: number; text: string }[];
  inPond(x: number, y: number): boolean;
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

const NAMES = ['OLD GREEN', 'PIP', 'MOSSBACK', 'LILY', 'BRAMBLE', 'REED', 'TUPPENCE', 'WARTY', 'SPECK', 'GOLDEYE', 'MUDLARK', 'BOG'];
const PONDS = ['MILLER\'S POND', 'THE STILL WATER', 'HERON MERE', 'THE LILY POOL', 'GREENMERE', 'THE OLD MOAT'];

/** What a system sees: the world and the few verbs every world has. */
type Ctx = { world: PondWorld; r: Rng; say(text: string, x: number, y: number, color?: string): void; emit(type: string, x: number, y: number, weight: number): void; chronicle(text: string): void };

/**
 * The cast library: what a pond may have. Each seed draws some (see `RULE`). Add systems here,
 * tag them, and the director paces them; `none` of a tag is a fine outcome.
 */
const LIBRARY: SystemDef<Ctx>[] = [
  {
    id: 'heron',
    label: 'a heron',
    weight: 3,
    tags: ['threat'],
    create: (c) => {
      const w = c.world;
      return {
        id: 'heron',
        step(dt) {
          const h = w.heron;
          if (!h) {
            if (w.frogs.some((f) => f.alive) && w.director.want('heron', 0.7, 90)) {
              const fromLeft = c.r() < 0.5;
              w.heron = { x: fromLeft ? -60 : w.GW + 60, y: w.cy - w.ry * 0.6, state: 'arrive', t0: w.t, target: -1, fromLeft };
              c.say('A HERON COMES DOWN TO THE WATER', w.cx, w.cy - w.ry - 20, '#e2e8f0');
              c.emit('heron', w.cx, w.cy, 0.6);
              w.director.look('heron', w.cx, w.cy, 1.4, 14, 6);
            }
            return;
          }
          const age = w.t - h.t0;
          if (h.state === 'arrive') {
            const tx = w.cx + (h.fromLeft ? -1 : 1) * w.rx * 0.95;
            h.x += (tx - h.x) * Math.min(1, dt * 1.2);
            if (age > 4) Object.assign(h, { state: 'stalk', t0: w.t });
          } else if (h.state === 'stalk') {
            const prey = w.frogs.filter((f) => f.alive).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
            if (!prey) return Object.assign(h, { state: 'leave', t0: w.t });
            h.target = prey.id;
            h.x += Math.sign(prey.x - h.x) * dt * 14;
            h.y += Math.sign(prey.y - h.y) * dt * 6;
            if (Math.hypot(prey.x - h.x, prey.y - h.y) < 70 || age > 18) Object.assign(h, { state: 'strike', t0: w.t });
          } else if (h.state === 'strike') {
            if (age < 0.6) return;
            const prey = w.frogs.find((f) => f.id === h.target && f.alive);
            if (prey && Math.hypot(prey.x - h.x, prey.y - h.y) < 90 && c.r() < 0.55) {
              prey.alive = false;
              c.say(`THE HERON TAKES ${prey.name}`, prey.x, prey.y - 20, '#fca5a5');
              c.emit('caught', prey.x, prey.y, 0.8);
              c.chronicle(`The heron took ${prey.name}.`);
            } else {
              c.say('THE HERON STRIKES, AND MISSES', h.x, h.y - 30, '#e2e8f0');
              c.emit('missed', h.x, h.y, 0.4);
            }
            Object.assign(h, { state: 'leave', t0: w.t });
          } else {
            h.x += (h.fromLeft ? -1 : 1) * dt * 80;
            if (age > 6) w.heron = null;
          }
        },
        counts: () => ({ heron: w.heron ? 1 : 0 }),
      };
    },
  },
  {
    id: 'rain',
    label: 'summer rain',
    weight: 3,
    tags: ['weather'],
    create: (c) => {
      const w = c.world;
      return {
        id: 'rain',
        step(dt) {
          if (w.rain <= 0 && w.director.want('rain', 0.35, 70)) {
            w.rain = 1;
            c.say('RAIN ON THE POND', w.cx, w.cy - w.ry - 20, '#bae6fd');
            c.emit('rain', w.cx, w.cy, 0.4);
          }
          if (w.rain <= 0) return;
          w.rain = Math.max(0, w.rain - dt / 40);
          // Rain: rings everywhere, and the pads drink it.
          if (c.r() < dt * 14 * w.rain) {
            const a = c.r() * Math.PI * 2;
            const d = Math.sqrt(c.r());
            w.ripples.push({ x: w.cx + Math.cos(a) * w.rx * d, y: w.cy + Math.sin(a) * w.ry * d, t0: w.t, r: 10 + c.r() * 14 });
          }
          for (const p of w.pads) p.grown = Math.min(1, p.grown + dt * 0.01 * w.rain);
        },
      };
    },
  },
  {
    id: 'lotus',
    label: 'the lotus',
    weight: 2,
    tags: ['wonder'],
    create: (c) => {
      const w = c.world;
      return {
        id: 'lotus',
        step(dt) {
          if (w.bloom <= 0 && w.pads.filter((p) => p.grown > 0.8).length > 5 && w.director.want('lotus', 0.8, 240)) {
            w.bloom = 1;
            for (const p of w.pads) if (p.grown > 0.8) p.bloom = 1;
            c.say('THE LOTUS OPENS ON THE WATER', w.cx, w.cy - w.ry - 20, '#f9a8d4');
            c.emit('lotus', w.cx, w.cy, 0.7);
            c.chronicle('The lotus opened, all at once.');
          }
          if (w.bloom > 0) {
            w.bloom = Math.max(0, w.bloom - dt / 50);
            if (w.bloom === 0) for (const p of w.pads) p.bloom = 0;
          }
        },
      };
    },
  },
  {
    id: 'spawn',
    label: 'frogspawn',
    weight: 4,
    tags: ['life'],
    create: (c) => {
      const w = c.world;
      let next = 30;
      return {
        id: 'spawn',
        step() {
          if (w.t < next) return;
          next = w.t + 25 + c.r() * 30;
          if (w.frogs.filter((f) => f.alive).length >= 14) return;
          const pad = w.pads[Math.floor(c.r() * w.pads.length)];
          const name = NAMES[Math.floor(c.r() * NAMES.length)];
          w.frogs.push({ id: w.frogs.length, name, x: pad.x, y: pad.y, pad: w.pads.indexOf(pad), hop: -1, from: [pad.x, pad.y], alive: true });
          c.say(`A NEW FROG, ${name}, CLIMBS ONTO A PAD`, pad.x, pad.y - 20, '#bbf7d0');
          c.emit('newfrog', pad.x, pad.y, 0.3);
        },
      };
    },
  },
];

const RULE = { total: [2, 4] as [number, number], quota: { threat: [0, 1] as [number, number], weather: [0, 1] as [number, number] } };

export function createPond(seed: string | number, W: number, H: number, opts: PondOptions, accent = '#7dd3fc'): PondWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'pond');
  const g: Genome = createGenome(seed, 'pond');
  // The whole pond on screen: the world in the screen's proportions, a little larger.
  const GW = Math.round(W * WORLD_SCALE);
  const GH = Math.round(H * WORLD_SCALE);
  const u = Math.max(0.4, Math.min(1, Math.min(GW, GH * 1.6) / 1600));
  const rx = GW * g.range(0.3, 0.4);
  const ry = Math.min(GH * 0.36, rx * g.range(0.45, 0.65));

  const world: PondWorld = {
    t: 0, W, H, GW, GH, bus,
    director: createDirector(forkRng(seed, 'pond-director'), { arc: g.pick(ARCS), period: g.range(300, 600), establish: () => ({ x: GW / 2, y: GH / 2, zoom: 1 }) }),
    name: g.pick(PONDS), cast: [], castIds: [], hues: g.hues(accent, 3),
    cx: GW / 2 + g.range(-0.05, 0.05) * GW, cy: GH * g.range(0.52, 0.58), rx, ry,
    pads: [], frogs: [], ripples: [], heron: null, rain: 0, bloom: 0, labels: [], chronicle: [],
    inPond: (x, y) => ((x - world.cx) / world.rx) ** 2 + ((y - world.cy) / world.ry) ** 2 < 1,
    step, nudge,
    counts: () => ({ pads: world.pads.length, frogs: world.frogs.filter((f) => f.alive).length, ripples: world.ripples.length, ...Object.assign({}, ...systems.map((s) => s.counts?.() ?? {})) }),
  };

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

  // The pads: Poisson-ish inside the ellipse, by the seed.
  const nPads = Math.round(g.range(14, 26) * u + 6);
  for (let k = 0; k < nPads * 30 && world.pads.length < nPads; k++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.9;
    const x = world.cx + Math.cos(a) * rx * d;
    const y = world.cy + Math.sin(a) * ry * d;
    const pr = (14 + r() * 16) * u;
    if (world.pads.every((p) => Math.hypot(p.x - x, (p.y - y) * 1.6) > p.r + pr + 6)) world.pads.push({ x, y, r: pr, grown: 0.3 + r() * 0.7, bloom: 0 });
  }
  const nFrogs = Math.max(1, Math.min(world.pads.length, Math.round(opts.frogs)));
  for (let k = 0; k < nFrogs; k++) {
    const p = world.pads[k % world.pads.length];
    world.frogs.push({ id: k, name: NAMES[k % NAMES.length], x: p.x, y: p.y, pad: k % world.pads.length, hop: -1, from: [p.x, p.y], alive: true });
  }

  const ctx: Ctx = { world, r, say, emit, chronicle };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);

  // ---- the frogs: hop from pad to pad, and sing at dusk --------------------------------------
  const HOP = 0.7;
  let nextChorus = 20 + r() * 20;
  function frogs(dt: number) {
    for (const f of world.frogs) {
      if (!f.alive) continue;
      if (f.hop >= 0) {
        f.hop += dt / HOP;
        const to = world.pads[f.pad];
        const k = Math.min(1, f.hop);
        f.x = f.from[0] + (to.x - f.from[0]) * k;
        f.y = f.from[1] + (to.y - f.from[1]) * k;
        if (f.hop >= 1) {
          f.hop = -1;
          world.ripples.push({ x: f.x, y: f.y, t0: world.t, r: 18 * u });
        }
        continue;
      }
      // Now and then, a hop to a pad nearby.
      if (r() < dt * 0.12) {
        const near = world.pads.map((p, i) => [i, Math.hypot(p.x - f.x, p.y - f.y)] as const).filter(([i, d]) => i !== f.pad && d < 220 * u).sort((a, b) => a[1] - b[1]);
        const pick = near[Math.floor(r() * Math.min(3, near.length))];
        if (pick) {
          f.from = [f.x, f.y];
          f.pad = pick[0];
          f.hop = 0;
        }
      }
    }
    if (world.t > nextChorus) {
      nextChorus = world.t + 35 + r() * 30;
      if (world.frogs.some((f) => f.alive)) {
        say('THE FROGS SING ACROSS THE WATER', world.cx, world.cy - world.ry - 20, '#bbf7d0');
        emit('chorus', world.cx, world.cy, 0.2);
      }
    }
  }

  // ---- the pads: grow, and new ones come ----------------------------------------------------
  let nextSprout = 15;
  function pads(dt: number) {
    for (const p of world.pads) p.grown = Math.min(1, p.grown + dt * 0.002);
    if (world.t > nextSprout && world.pads.length < nPads * 1.6) {
      nextSprout = world.t + 12 + r() * 18;
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 0.88;
      const x = world.cx + Math.cos(a) * rx * d;
      const y = world.cy + Math.sin(a) * ry * d;
      const pr = (12 + r() * 12) * u;
      if (world.pads.every((p) => Math.hypot(p.x - x, (p.y - y) * 1.6) > p.r + pr + 4)) {
        world.pads.push({ x, y, r: pr, grown: 0.05, bloom: 0 });
        emit('sprout', x, y, 0.05);
      }
    }
  }

  /** A visitor's touch: a stone in the water; the frogs near it leap, and a stalking heron takes fright. */
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 3 || !world.inPond(x, y)) return null;
    lastNudge = world.t;
    for (let k = 0; k < 3; k++) world.ripples.push({ x, y, t0: world.t + k * 0.25, r: (20 + k * 10) * u });
    for (const f of world.frogs) {
      if (!f.alive || f.hop >= 0 || Math.hypot(f.x - x, f.y - y) > 200 * u) continue;
      const away = world.pads.map((p, i) => [i, Math.hypot(p.x - x, p.y - y)] as const).filter(([i]) => i !== f.pad).sort((a, b) => b[1] - a[1])[Math.floor(r() * 3)];
      if (away) Object.assign(f, { from: [f.x, f.y], pad: away[0], hop: 0 });
    }
    const h = world.heron;
    if (h && (h.state === 'stalk' || h.state === 'arrive')) {
      Object.assign(h, { state: 'leave', t0: world.t });
      say('THE HERON TAKES FRIGHT AND GOES', h.x, h.y - 30, '#e2e8f0');
      emit('nudge', x, y, 0.3);
      return 'THE HERON TAKES FRIGHT AND GOES';
    }
    say('A STONE DROPS INTO THE POND', x, y - 20, '#e7e5e4');
    emit('nudge', x, y, 0.3);
    return 'A STONE DROPS INTO THE POND';
  }

  function step(dt: number) {
    world.t += dt;
    world.director.step(world.t, dt);
    frogs(dt);
    pads(dt);
    for (const s of systems) s.step?.(dt);
    // Frogs come back to an empty pond in the end.
    if (!world.frogs.some((f) => f.alive) && world.director.want('return', 0.2, 60)) {
      const p = world.pads[0];
      world.frogs.push({ id: world.frogs.length, name: NAMES[world.frogs.length % NAMES.length], x: p.x, y: p.y, pad: 0, hop: -1, from: [p.x, p.y], alive: true });
      say('A FROG COMES BACK TO THE EMPTY POND', p.x, p.y - 20, '#bbf7d0');
      emit('returns', p.x, p.y, 0.4);
    }
    world.ripples = world.ripples.filter((q) => world.t - q.t0 < 2.5);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
