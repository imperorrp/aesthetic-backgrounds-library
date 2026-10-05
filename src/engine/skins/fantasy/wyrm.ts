/**
 * Wyrmspire's mount: the valley (wyrm-sim.ts), seen from the watchtower, and through its
 * spyglass when something is happening.
 *
 * The camera follows the sim's `focus`: it pans along the valley (wider than the screen)
 * and zooms in on what matters (a hero on the spire path, a snatch from a herd, a village
 * on fire), with a spyglass's dark rim when it is close. Layers, back to front:
 *   the sky (by the land, the hour, and the weather; aurora, stars, moon, sun) → far
 *   mountains in parallax → the valley floor (fields, water, worn paths) and the spire,
 *   its path and cave (the hoard glinting, the swords of the fallen on the ledge, the
 *   runes of a binding) → everything that stands or moves, by depth → breath, fire, frost,
 *   venom, the pall, lightning, wards, bolts, lanterns → weather → night and its lights →
 *   the spyglass → call-outs → the valley's state and its chronicle.
 *
 * Each land has its own palette, trees, and houses; each breed of wyrm its own colors and
 * breath.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { forkRng } from '../../rng';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../instruments/kit';
import { WYRMSPIRE_SCHEMA } from './index';
import { BREED_NAMES, createWyrmWorld, LAND_NAMES, SEASONS, type Biome, type Breed, type Person, type Wyrm } from './wyrm-sim';
import { buildAtlas, stamp, type Atlas, type DragonColors } from './sprites';
import { serif } from './names';
import { buildScenery, stampProp, type Prop, type SceneryAtlas } from './scenery';

/** Sky keyframes through the day: [time, top, mid, low]. Kept low-key for legibility. */
const SKY: [number, string, string, string][] = [
  [0, '#02040a', '#070d1c', '#121c30'],
  [0.22, '#04060e', '#121830', '#3a2a3a'],
  [0.32, '#0a1120', '#18263a', '#2f4054'],
  [0.68, '#0a1120', '#18263a', '#2f4054'],
  [0.78, '#06060f', '#1c1328', '#4a2430'],
  [0.88, '#03050c', '#0a1224', '#1b2740'],
  [1, '#02040a', '#070d1c', '#121c30'],
];

type Land = {
  tint: string;
  far: [string, string];
  ground: [string, string];
  winterGround: [string, string];
  fields: string[];
  water: string;
  waterHi: string;
  spire: [string, string];
  trees: Prop[];
  house: Prop;
  jag: number;
  snowCaps: boolean;
};
const LANDS: Record<Biome, Land> = {
  alpine: { tint: '#1e3a5f', far: ['#1a2233', '#121926'], ground: ['#10180f', '#172014'], winterGround: ['#2c3442', '#39414f'], fields: ['#24301a', '#2c2f18', '#1f2a14'], water: '#1c3245', waterHi: '#3b5a72', spire: ['#3a3f4a', '#1c1f26'], trees: ['pine', 'snowpine', 'pine'], house: 'cottage', jag: 1.3, snowCaps: true },
  fjord: { tint: '#334155', far: ['#1a2029', '#11161d'], ground: ['#11160f', '#161c14'], winterGround: ['#2a313b', '#353c47'], fields: ['#22301c', '#262c19'], water: '#122435', waterHi: '#2e4a62', spire: ['#2a2e35', '#14171c'], trees: ['pine', 'pine', 'oak'], house: 'longhouse', jag: 1.1, snowCaps: true },
  canyon: { tint: '#7c2d12', far: ['#3a1f17', '#2a1610'], ground: ['#2a1a10', '#33200f'], winterGround: ['#2e2016', '#382717'], fields: ['#3d2c12', '#45330f', '#3a2a14'], water: '#2a1c12', waterHi: '#4a3420', spire: ['#7c3b1c', '#3d1c0d'], trees: ['bush', 'deadtree', 'bush'], house: 'adobe', jag: 0.4, snowCaps: false },
  fen: { tint: '#1f3d2b', far: ['#161f1a', '#0f1612'], ground: ['#0f170f', '#141c11'], winterGround: ['#1c2220', '#252b28'], fields: ['#1f2a14', '#25301a'], water: '#10211f', waterHi: '#2a4440', spire: ['#1f2224', '#0c0e0f'], trees: ['deadtree', 'reeds', 'oak', 'reeds'], house: 'stilthouse', jag: 0.7, snowCaps: false },
  ashland: { tint: '#450a0a', far: ['#1c1312', '#120c0b'], ground: ['#151212', '#1c1716'], winterGround: ['#1c1918', '#24201e'], fields: ['#221d14', '#1f1a12'], water: '#7c2d12', waterHi: '#f97316', spire: ['#26201e', '#100c0b'], trees: ['deadtree', 'rock', 'deadtree'], house: 'stonehouse', jag: 1.5, snowCaps: false },
};

const BREED_COLORS: Record<Breed, DragonColors> = {
  fire: { body: '#b91c1c', dark: '#450a0a', belly: '#f59e0b', wing: '#7f1d1d', eye: '#fde047' },
  frost: { body: '#cbd5e1', dark: '#475569', belly: '#e0f2fe', wing: '#94a3b8', eye: '#38bdf8' },
  storm: { body: '#4c1d95', dark: '#1e1b4b', belly: '#a5b4fc', wing: '#5b21b6', eye: '#e0e7ff' },
  venom: { body: '#3f6212', dark: '#1a2e05', belly: '#bef264', wing: '#365314', eye: '#facc15' },
  shadow: { body: '#27272a', dark: '#09090b', belly: '#6b21a8', wing: '#18181b', eye: '#c084fc' },
};
/** Breath colors: hot core, body, edge. */
const BREATH: Record<Breed, [string, string, string]> = {
  fire: ['#fef08a', '#fb923c', '#dc2626'],
  frost: ['#ffffff', '#bae6fd', '#38bdf8'],
  storm: ['#e0e7ff', '#a5b4fc', '#6d28d9'],
  venom: ['#ecfccb', '#a3e635', '#3f6212'],
  shadow: ['#e9d5ff', '#7e22ce', '#18181b'],
};

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(WYRMSPIRE_SCHEMA, host.options) as { valley: string; wrath: number; knights: number; villages: number; time: string; labels: boolean; hud: boolean };
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world = createWyrmWorld(host.config.seed, W, H, { wrath: o.wrath, knights: o.knights, villages: o.villages, time: o.time, valley: o.valley });
  const land = LANDS[world.biome];
  let nextAmbience = 0;

  // ---- the camera --------------------------------------------------------------------------------

  /** Where the spyglass points: a valley x, a world y (screen y at zoom 1), and how close. */
  const cam = { x: world.focus.x, y: H * 0.55, zoom: 1 };
  const MID = () => H * 0.55;
  const wy = (z: number, h: number) => world.sy(z) - h;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + MID();

  function camera(dt: number) {
    const f = world.focus;
    const zoom = Math.max(1, Math.min(1.8, f.zoom));
    const k = Math.min(1, dt * 0.7);
    cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 0.5);
    cam.x += (f.x - cam.x) * k;
    // Vertically: the whole valley at zoom 1; the focus itself, closer in.
    const ty = MID() + (wy(f.z, f.h) - MID()) * Math.min(1, (cam.zoom - 1) * 1.7);
    cam.y += (ty - cam.y) * k;
    const half = W / 2 / cam.zoom;
    cam.x = Math.max(half, Math.min(world.BW - half, cam.x));
    cam.y = Math.min(cam.y, H - (H - MID()) / cam.zoom);
  }

  world.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const x = typeof e.x === 'number' ? SX(e.x) : W / 2;
    const near = x > -60 && x < W + 60 ? 1 : 0.4;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near, text: e.text, color: e.color, priority: e.priority });
  });

  const step = (info: FrameInfo) => {
    const dt = host.motion === 'off' ? 0 : Math.min(info.dt, 0.1);
    world.step(dt);
    camera(dt);
    if (world.t >= nextAmbience && host.events?.active) {
      nextAmbience = world.t + 2;
      const awake = world.wyrms.some((d) => !['sleep', 'dead', 'gone', 'bask'].includes(d.state));
      host.events.emit({ type: 'ambience', weight: awake ? 0.8 : 0.2, pan: 0, near: 1 });
    }
  };

  const P0 = () => (H >= 1100 ? 3 : H >= 560 ? 2 : 1);
  /** Pixel size at the camera's zoom, kept to half pixels. */
  const PZ = () => Math.max(1, Math.round(P0() * cam.zoom * 2) / 2);

  // ---- caches -------------------------------------------------------------------------------------

  let atlas: Atlas | null = null;
  const dragonAtlases = new Map<Breed, Atlas>();
  let scenery: SceneryAtlas | null = null;
  type Back = { W: number; H: number; winter: boolean; far: HTMLCanvasElement; ground: HTMLCanvasElement; trees: { x: number; z: number; prop: Prop; v: number }[] };
  let back: Back | null = null;
  const canvas = (w: number, h: number, scale = 1) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    return { c, g };
  };
  const dragonAtlas = (b: Breed) => {
    let a = dragonAtlases.get(b);
    if (!a) {
      a = buildAtlas(world.faction.kit, BREED_COLORS[b], ['dragon']);
      dragonAtlases.set(b, a);
    }
    return a;
  };

  /** Far mountains (a strip for parallax), and the valley floor at world size. */
  function paintBack(winter: boolean) {
    const r = forkRng(host.config.seed, 'wyrm-back');
    const gt = world.groundTop;
    const d = Math.min(2, host.viewport.dpr || 1);
    const FW = W * 1.6;
    const far = canvas(FW, gt + 40, d);
    const g = far.g;
    const ridgeN = (x: number, freq: number, seed: number, jag: number) => {
      const n = host.noise.noise2(x * freq + seed, seed) * 0.65 + host.noise.noise2(x * freq * 3 + seed, 2) * 0.25 + host.noise.noise2(x * freq * 9, seed) * 0.1 * jag;
      // The canyon's mesas: flat tops.
      return world.biome === 'canyon' ? Math.round(n * 3) / 3 : n;
    };
    const ridge = (base: number, amp: number, freq: number, seed: number, color: string, jag: number) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, gt + 40);
      for (let x = 0; x <= FW; x += 4) g.lineTo(x, base - amp * (0.5 + ridgeN(x, freq, seed, jag) * 0.5));
      g.lineTo(FW, gt + 40);
      g.fill();
    };
    const highSeed = r() * 100;
    const highAmp = gt * 0.32 * land.jag * 0.8;
    ridge(gt * 0.66, highAmp, 0.0022, highSeed, land.far[0], land.jag);
    if (land.snowCaps) {
      // Snow on the high crests, hanging down the gullies.
      g.fillStyle = 'rgba(203,213,225,0.2)';
      for (let x = 0; x < FW; x += 2) {
        const n = ridgeN(x, 0.0022, highSeed, land.jag);
        if (n < 0.15) continue;
        const y = gt * 0.66 - highAmp * (0.5 + n * 0.5);
        g.fillRect(x, y, 2, (n - 0.1) * 26 * (0.6 + hash(x, 9) * 0.6));
      }
    }
    ridge(gt * 0.86, gt * 0.16, 0.004, r() * 100, land.far[1], land.jag);
    if (world.biome === 'ashland') {
      // A volcano far off, glowing at its crown.
      const vx = FW * (0.2 + r() * 0.3);
      g.fillStyle = '#140d0c';
      g.beginPath();
      g.moveTo(vx - 160, gt * 0.9);
      g.lineTo(vx - 26, gt * 0.38);
      g.lineTo(vx + 26, gt * 0.38);
      g.lineTo(vx + 160, gt * 0.9);
      g.fill();
      const gl = g.createRadialGradient(vx, gt * 0.38, 0, vx, gt * 0.38, 60);
      gl.addColorStop(0, 'rgba(249,115,22,0.4)');
      gl.addColorStop(1, 'rgba(249,115,22,0)');
      g.fillStyle = gl;
      g.fillRect(vx - 60, gt * 0.38 - 60, 120, 120);
    }
    // The valley floor, the whole valley's width, from a little above the horizon.
    const top = 70;
    const gh = H - gt + top;
    const ground = canvas(world.BW, gh, Math.min(1.5, d));
    const gg = ground.g;
    const [ga, gb] = winter ? land.winterGround : land.ground;
    const grad = gg.createLinearGradient(0, top, 0, gh);
    grad.addColorStop(0, ga);
    grad.addColorStop(1, gb);
    gg.fillStyle = grad;
    gg.fillRect(0, top, world.BW, gh);
    // Low hills along the far edge.
    gg.fillStyle = land.far[1];
    gg.beginPath();
    gg.moveTo(0, top + 4);
    for (let x = 0; x <= world.BW; x += 6) gg.lineTo(x, top + 4 - 30 * (0.5 + host.noise.noise2(x * 0.004 + 3, 3) * 0.5));
    gg.lineTo(world.BW, top + 4);
    gg.fill();
    const depth = world.groundBottom - world.groundTop;
    const Y = (z: number) => top + z * depth;
    // Speckle.
    for (let i = 0; i < world.BW * depth * 0.004; i++) {
      gg.fillStyle = hexA(r() < 0.5 ? '#3f4a2a' : '#1a140c', 0.25);
      gg.fillRect(r() * world.BW, top + r() * depth, 1 + r() * 2, 1);
    }
    // Fields.
    for (const f of world.fields) {
      const c = winter ? '#3a414c' : land.fields[Math.floor(hash(f.x | 0, 3) * land.fields.length)];
      gg.fillStyle = c;
      gg.fillRect(f.x - f.w / 2, Y(f.z), f.w, f.d * depth);
      gg.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 0; k < f.d * depth; k += 2) gg.fillRect(f.x - f.w / 2, Y(f.z) + k, f.w, 0.6);
    }
    // The road along the valley.
    gg.strokeStyle = winter ? '#4b5260' : '#2b2418';
    gg.lineWidth = 3;
    gg.beginPath();
    for (let x = 0; x <= world.BW; x += 20) {
      const y = Y(0.62 + Math.sin(x * 0.004) * 0.04);
      if (x) gg.lineTo(x, y);
      else gg.moveTo(x, y);
    }
    gg.stroke();
    // The water: from the spire's foot down the valley; in the fen, pools besides.
    gg.lineCap = 'round';
    for (let k = 0; k < 60; k++) {
      const a = k / 60;
      const b = (k + 1) / 60;
      gg.strokeStyle = land.water;
      gg.lineWidth = world.riverW(a) * 2;
      gg.beginPath();
      gg.moveTo(world.riverX(a), Y(a));
      gg.lineTo(world.riverX(b), Y(b));
      gg.stroke();
    }
    gg.strokeStyle = hexA(land.waterHi, world.biome === 'ashland' ? 0.6 : 0.25);
    gg.lineWidth = 1;
    for (let k = 0; k < 90; k++) {
      const a = r();
      const x = world.riverX(a) + (r() - 0.5) * world.riverW(a) * 1.4;
      gg.beginPath();
      gg.moveTo(x - 3 - a * 5, Y(a));
      gg.lineTo(x + 3 + a * 5, Y(a));
      gg.stroke();
    }
    if (world.biome === 'fen') {
      for (let i = 0; i < 26; i++) {
        gg.fillStyle = land.water;
        gg.beginPath();
        gg.ellipse(r() * world.BW, Y(r()), 20 + r() * 50, 3 + r() * 6, 0, 0, Math.PI * 2);
        gg.fill();
      }
    }
    // Trees and their kind, clear of villages, castle, water.
    const trees: Back['trees'] = [];
    for (let i = 0; i < world.BW / 22; i++) {
      const x = r() * world.BW;
      const z = r();
      if (world.villages.some((v) => Math.abs(v.x - x) < 90 && Math.abs(v.z - z) < 0.2)) continue;
      if (Math.abs(world.castle.x - x) < 130 && Math.abs(world.castle.z - z) < 0.25) continue;
      if (Math.abs(world.riverX(z) - x) < world.riverW(z) + 10) continue;
      if (Math.abs(world.spire.x - x) < 140 && z < 0.12) continue;
      const prop = land.trees[Math.floor(r() * land.trees.length)];
      trees.push({ x, z, prop: winter && prop === 'pine' ? 'snowpine' : prop, v: Math.floor(r() * 3) });
    }
    back = { W, H, winter, far: far.c, ground: ground.c, trees };
  }

  // ---- light ---------------------------------------------------------------------------------------

  const skyAt = (k: number): [string, string, string] => {
    for (let i = 0; i < SKY.length - 1; i++) {
      const [a, ...ca] = SKY[i];
      const [b, ...cb] = SKY[i + 1];
      if (k < a || k > b) continue;
      const u = (k - a) / (b - a);
      return [0, 1, 2].map((j) => {
        const base = mixRgb(ca[j], cb[j], u);
        const tint = mixRgb(land.tint, land.tint, 0);
        const [x, y, z] = base.map((v, n) => v * 0.78 + tint[n] * 0.22);
        return `rgb(${x | 0},${y | 0},${z | 0})`;
      }) as [string, string, string];
    }
    return [SKY[0][1], SKY[0][2], SKY[0][3]];
  };
  /** How dark it is: 1 at midnight, 0 at noon. */
  const darkness = () => {
    const d = world.day;
    return d < 0.2 || d > 0.88 ? 1 : d < 0.32 ? 1 - (d - 0.2) / 0.12 : d > 0.76 ? (d - 0.76) / 0.12 : 0;
  };

  const glows = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, r: number, color: string, a: number) {
    if (r <= 0 || a <= 0) return;
    let s = glows.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glows.set(color, s);
    }
    const prev = ctx.globalAlpha;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.globalAlpha = prev * Math.min(1, a);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.imageSmoothingEnabled = smooth;
    ctx.globalAlpha = prev;
  }

  function sky(t: number) {
    const [top, mid, low] = skyAt(world.day);
    const hy = SY(world.groundTop);
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(10, hy + 30));
    g.addColorStop(0, top);
    g.addColorStop(0.6, mid);
    g.addColorStop(1, low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const dark = darkness();
    if (dark > 0.05 && world.weather !== 'fog' && world.weather !== 'storm') {
      for (let i = 0; i < 160; i++) {
        const y = hash(i, 2) ** 1.5 * hy * 0.85;
        ctx.fillStyle = `rgba(226,232,240,${((0.15 + hash(i, 3) * 0.5) * dark * (0.8 + 0.2 * Math.sin(t * 2 + i))).toFixed(3)})`;
        ctx.fillRect(Math.floor(hash(i, 1) * W), Math.floor(y), 1, 1);
      }
      // The high lands get the northern lights some nights.
      if (dark > 0.5 && (world.biome === 'alpine' || world.biome === 'fjord') && Math.sin(world.t * 0.01 + 1) > 0.2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 3; b++) {
          ctx.strokeStyle = hexA(b === 1 ? '#a78bfa' : '#4ade80', 0.05 * dark);
          ctx.lineWidth = 18;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 20) {
            const y = hy * (0.2 + b * 0.08) + Math.sin(x * 0.006 + t * 0.2 + b) * 26 + Math.sin(x * 0.017 + t * 0.4) * 10;
            if (x) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    const a = world.day * Math.PI * 2;
    const sun = { x: W * 0.5 - Math.sin(a) * W * 0.42, y: hy * (0.75 + Math.cos(a) * 0.55) };
    const moon = { x: W * 0.5 + Math.sin(a) * W * 0.42, y: hy * (0.75 - Math.cos(a) * 0.55) };
    if (sun.y < hy) glow(sun.x, sun.y, W * 0.35, world.biome === 'canyon' ? '#ea580c' : '#c2410c', 0.22 * (1 - dark * 0.5));
    if (moon.y < hy && world.weather !== 'storm') {
      glow(moon.x, moon.y, 70, '#cbd5e1', 0.12 * dark);
      ctx.fillStyle = `rgba(226,232,240,${(0.75 * Math.max(0.3, dark)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(moon.x, moon.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function farLayer() {
    const b = back!;
    // Mountains slide a third as far as the valley does, and swell a little with the zoom.
    const z = 1 + (cam.zoom - 1) * 0.35;
    const FW = W * 1.6;
    const ox = -((cam.x - W / 2 / cam.zoom) / Math.max(1, world.BW - W / cam.zoom)) * (FW - W) * z - (z - 1) * W * 0.3;
    const hy = (world.groundTop + 40 - cam.y) * z + MID();
    const h = (world.groundTop + 40) * z;
    ctx.drawImage(b.far, ox, hy - h, FW * z, h);
  }

  function groundLayer() {
    const top = 70;
    const x = SX(0);
    const y = SY(world.groundTop - top);
    const w = world.BW * cam.zoom;
    const h = (H - world.groundTop + top) * cam.zoom;
    ctx.drawImage(back!.ground, x, y, w, h);
  }

  // ---- the spire -------------------------------------------------------------------------------

  /** The spire, drawn in the world (it moves and zooms with the valley): rock, path, cave. */
  function spire(t: number, p: number) {
    const sx = world.spire.x;
    const base = world.sy(0);
    const caveY = base - world.spire.caveH;
    const top = base - world.spire.topH;
    const [lit, dark] = land.spire;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let k = 0; k <= 14; k++) {
      const y = base + 8 - (k / 14) * (base + 8 - top);
      const w = (world.biome === 'canyon' ? 70 : 130) * (1 - k / 14) ** (world.biome === 'canyon' ? 0.4 : 0.9) + 8;
      left.push([sx - w + (hash(k, 1) - 0.5) * 18, y]);
      right.push([sx + w * 0.85 + (hash(k, 2) - 0.5) * 18, y]);
    }
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(SX(left[0][0]), SY(left[0][1]));
    for (const [x, y] of left) ctx.lineTo(SX(x), SY(y));
    ctx.lineTo(SX(sx + 4), SY(top - 16));
    for (const [x, y] of [...right].reverse()) ctx.lineTo(SX(x), SY(y));
    ctx.closePath();
    ctx.fill();
    // Its lit face, on the left.
    ctx.fillStyle = hexA(lit, 0.55);
    ctx.beginPath();
    ctx.moveTo(SX(left[0][0]), SY(left[0][1]));
    for (const [x, y] of left) ctx.lineTo(SX(x), SY(y));
    ctx.lineTo(SX(sx + 4), SY(top - 16));
    for (const [x, y] of [...left].reverse()) ctx.lineTo(SX(x + (sx - x) * 0.45), SY(y));
    ctx.fill();
    // Bands of rock (the canyon's are many), the snow at its crown, lava in the ashlands.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, cam.zoom);
    for (let k = 0; k < (world.biome === 'canyon' ? 14 : 7); k++) {
      const y = top + (k / (world.biome === 'canyon' ? 14 : 7)) * (base - top) + 14;
      const w = 50 * (1 - k / 12);
      ctx.beginPath();
      ctx.moveTo(SX(sx - w), SY(y));
      ctx.lineTo(SX(sx + w * 0.7), SY(y + 3));
      ctx.stroke();
    }
    if (land.snowCaps) {
      // Snow on the crown, ragged where it gives out on the rock.
      ctx.fillStyle = 'rgba(203,213,225,0.5)';
      ctx.beginPath();
      ctx.moveTo(SX(left[13][0]), SY(left[13][1]));
      ctx.lineTo(SX(sx + 4), SY(top - 16));
      ctx.lineTo(SX(right[13][0]), SY(right[13][1]));
      for (let k = 0; k <= 6; k++) {
        const x = right[13][0] + ((left[13][0] - right[13][0]) * k) / 6;
        ctx.lineTo(SX(x), SY(right[13][1] + (k % 2 ? 4 : -6) + hash(k, 5) * 6));
      }
      ctx.fill();
    }
    if (world.biome === 'ashland') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(249,115,22,${(0.45 + 0.15 * Math.sin(t * 2)).toFixed(3)})`;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        let x = sx - 30 + k * 14;
        let y = base - 10;
        ctx.moveTo(SX(x), SY(y));
        for (let s = 0; s < 6; s++) {
          x += (hash(k, s) - 0.5) * 16;
          y -= 18;
          ctx.lineTo(SX(x), SY(y));
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (world.biome === 'fen') stampProp(ctx, scenery!, 'deadtree', 1, SX(sx + 2), SY(top - 12), p);
    // The path: steps cut up the face, zigzagging to the cave.
    ctx.strokeStyle = 'rgba(214,211,196,0.18)';
    ctx.setLineDash([2 * cam.zoom, 3 * cam.zoom]);
    ctx.lineWidth = Math.max(1, cam.zoom);
    ctx.beginPath();
    world.spire.path.forEach(([x, h], i) => (i ? ctx.lineTo(SX(x), SY(base - h)) : ctx.moveTo(SX(x), SY(base - h))));
    ctx.stroke();
    ctx.setLineDash([]);
    // The cave, and the hoard's glint inside it.
    ctx.fillStyle = '#040508';
    ctx.beginPath();
    ctx.ellipse(SX(sx), SY(caveY), 26 * cam.zoom, 17 * cam.zoom, 0, Math.PI, 0);
    ctx.lineTo(SX(sx + 26), SY(caveY + 6));
    ctx.lineTo(SX(sx - 26), SY(caveY + 6));
    ctx.fill();
    const gold = Math.min(1, world.hoard / 3000);
    if (gold > 0.02) {
      for (let i = 0; i < 4 + gold * 14; i++) {
        const tw = Math.sin(t * 3 + i * 1.7) > 0.6;
        ctx.fillStyle = tw ? '#fde68a' : '#a16207';
        ctx.fillRect(SX(sx - 16 + hash(i, 4) * 32), SY(caveY + 2 - hash(i, 5) * 6 * gold), Math.max(1, cam.zoom), Math.max(1, cam.zoom));
      }
    }
    // The swords of heroes who died here, on the ledge.
    for (let i = 0; i < Math.min(6, world.swords); i++) {
      const x = SX(sx - 34 - i * 7);
      const y = SY(caveY + 8);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(Math.round(x), Math.round(y - 8 * cam.zoom), Math.max(1, cam.zoom), 8 * cam.zoom);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(Math.round(x - cam.zoom), Math.round(y - 6 * cam.zoom), 3 * cam.zoom, Math.max(1, cam.zoom));
      if (Math.sin(t * 1.3 + i) > 0.95) glow(x, y - 8 * cam.zoom, 6, '#ffffff', 0.6);
    }
    // A binding: runes glowing up the spire, and chains about the cave.
    if (world.bound > world.t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const y = base - (i / 9) * world.spire.caveH;
        glow(SX(sx - 10 + Math.sin(i * 2.1) * 30), SY(y), 6 * cam.zoom, '#a78bfa', 0.6 + 0.3 * Math.sin(t * 2 + i));
      }
      ctx.strokeStyle = `rgba(196,181,253,${(0.5 + 0.2 * Math.sin(t * 3)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SX(sx - 30), SY(caveY - 12));
      ctx.lineTo(SX(sx + 30), SY(caveY + 4));
      ctx.moveTo(SX(sx + 30), SY(caveY - 12));
      ctx.lineTo(SX(sx - 30), SY(caveY + 4));
      ctx.stroke();
      ctx.restore();
    }
    // Asleep: smoke from the cave, and now and then two eyes.
    const sleeper = world.wyrms.find((d) => d.state === 'sleep' && !d.rival);
    if (sleeper) {
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.06 + i / 6) % 1;
        ctx.fillStyle = `rgba(40,38,44,${(0.35 * (1 - k)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(SX(sx + k * 50 + Math.sin(t * 0.5 + i) * 6), SY(caveY - 10 - k * 90), (5 + k * 18) * cam.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      if (Math.sin(t * 0.7) < 0.6 && Math.sin(t * 0.13) > -0.2) {
        const eye = BREED_COLORS[sleeper.breed].eye;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(SX(sx - 6), SY(caveY - 4), 7 * cam.zoom, eye, 0.7);
        glow(SX(sx + 6), SY(caveY - 4), 7 * cam.zoom, eye, 0.7);
        ctx.restore();
      }
    }
    const young = world.wyrms.find((d) => d.size < 1 && d.state === 'sleep' && world.t - d.t0 < 16);
    if (young) stamp(ctx, dragonAtlas(young.breed), 'dragon', Math.floor(t * 6) % 4, (Math.floor(t / 3) & 1) === 1, SX(sx), SY(caveY + 6), Math.max(1, p * 0.6));
  }

  // ---- the living valley ---------------------------------------------------------------------

  type Item = { z: number; draw: () => void };

  function valley(t: number, p: number) {
    const items: Item[] = [];
    const s = scenery!;
    const a = atlas!;
    const night = darkness();
    const visible = (x: number, pad = 80) => {
      const X = SX(x);
      return X > -pad && X < W + pad;
    };
    for (const tr of back!.trees) if (visible(tr.x)) items.push({ z: tr.z, draw: () => stampProp(ctx, s, tr.prop, tr.v, SX(tr.x), SY(world.sy(tr.z)), p) });
    // The castle on its rise.
    items.push({ z: world.castle.z, draw: () => castle(p, t) });
    for (const v of world.villages) {
      for (const h of v.houses) {
        if (!visible(h.x)) continue;
        items.push({
          z: h.z,
          draw: () => {
            const x = SX(h.x);
            const y = SY(world.sy(h.z));
            if (h.ruined >= 0) {
              if (world.t - h.ruined > 55) {
                ctx.globalAlpha = 0.55;
                stampProp(ctx, s, land.house, h.variant, x, y, p);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = 'rgba(160,120,70,0.8)';
                ctx.lineWidth = 1;
                ctx.strokeRect(Math.round(x - 8 * p), Math.round(y - 12 * p), 16 * p, 12 * p);
              } else {
                ctx.fillStyle = '#16120e';
                ctx.fillRect(Math.round(x - 7 * p), Math.round(y - 3 * p), 14 * p, 3 * p);
                ctx.fillStyle = '#292119';
                for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(x - 6 * p + hash(h.id, k) * 10 * p), Math.round(y - 5 * p - hash(k, h.id) * 3 * p), p * 2, p * 3);
              }
              return;
            }
            stampProp(ctx, s, land.house, h.variant, x, y, p);
            if (h.frozen >= 0) {
              // Rimed in ice, icicles at the eaves.
              ctx.fillStyle = 'rgba(224,242,254,0.45)';
              ctx.fillRect(Math.round(x - 8 * p), Math.round(y - 12 * p), 16 * p, 12 * p);
              ctx.fillStyle = '#e0f2fe';
              for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(x - 7 * p + k * 3 * p), Math.round(y - 8 * p), p, (2 + (k % 2)) * p);
            }
            if (night > 0.3 && h.burning < 0 && h.frozen < 0 && !pall(h.x, h.z)) {
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              glow(x - 4 * p, y - 4 * p, 10 * cam.zoom, '#fbbf24', 0.35 * night);
              ctx.restore();
            }
            if (h.burning >= 0) fire(x, y, h.id, t, p, Math.min(1, (world.t - h.burning) / 2), world.wyrms[0]?.breed ?? 'fire');
          },
        });
      }
    }
    for (const b of world.ballistae) if (visible(b.x)) items.push({ z: b.z, draw: () => {
      stampProp(ctx, s, 'ballista', b.ruined ? 1 : 0, SX(b.x), SY(world.sy(b.z)), p);
      if (b.burning >= 0 && world.t - b.burning < 12) fire(SX(b.x), SY(world.sy(b.z)), b.id, t, p, 1, 'fire');
    } });
    for (const h of world.herds) {
      for (const an of h.animals) {
        if (!an.alive) continue;
        const x = h.x + an.dx;
        const z = Math.max(0.02, Math.min(0.98, h.z + an.dz));
        if (!visible(x)) continue;
        items.push({ z, draw: () => stampProp(ctx, s, h.kind === 'sheep' ? 'sheep' : h.kind === 'cattle' ? 'cattle' : 'goat', an.seed % 2, SX(x), SY(world.sy(z)) - (Math.sin(world.t * 2 + an.seed) > 0.9 ? p : 0), p) });
      }
    }
    for (const c of world.carts) if (visible(c.x)) items.push({ z: c.z, draw: () => {
      const x = SX(c.x);
      const y = SY(world.sy(c.z));
      ctx.save();
      if (c.tx < c.x) {
        ctx.translate(x * 2, 0);
        ctx.scale(-1, 1);
      }
      stampProp(ctx, s, 'cart', 0, x, y, p);
      ctx.restore();
      if (c.kind === 'tribute') glow(x, y - 6 * p, 8 * cam.zoom, '#fde68a', 0.5);
    } });
    for (const b of world.boats) {
      const z = b.k;
      const x = world.riverX(z);
      if (!visible(x)) continue;
      items.push({ z, draw: () => {
        const bob = Math.sin(world.t * 2 + b.id) * 0.6 * p;
        stampProp(ctx, s, b.big ? 'galleon' : 'galley', 0, SX(x), SY(world.sy(z)) + bob, p * (b.big ? 0.8 : 0.6));
      } });
    }
    for (const q of world.people) if (visible(q.x)) items.push({ z: q.h > 0 ? 0.001 : q.z, draw: () => personDraw(q, t, p, a) });
    for (const d of world.wyrms) if (!['sleep', 'wake', 'gone'].includes(d.state)) items.push({ z: d.state === 'bask' || d.state === 'fightcave' ? 0.0005 : d.z + 0.001, draw: () => wyrm(d, t, p) });
    // Tribute left at the foot of the spire.
    for (const f of world.fx) if (f.kind === 'gold' && visible(f.x)) items.push({ z: f.z, draw: () => {
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = Math.sin(t * 3 + i) > 0.7 ? '#fde68a' : '#ca8a04';
        ctx.fillRect(Math.round(SX(f.x) + (hash(i, f.seed) - 0.5) * 14 * cam.zoom), Math.round(SY(world.sy(f.z)) - hash(f.seed, i) * 5 * cam.zoom), Math.max(1, p), Math.max(1, p));
      }
    } });
    items.sort((x, y) => x.z - y.z);
    // Shadows of the wyrms first, flat on the ground.
    for (const d of world.wyrms) {
      if (['sleep', 'wake', 'away', 'gone', 'bask', 'fightcave'].includes(d.state) || d.h > 400) continue;
      ctx.fillStyle = `rgba(0,0,0,${(0.35 * Math.max(0, 1 - d.h / 400)).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(SX(d.x), SY(world.sy(d.z)), (24 + d.h * 0.08) * d.size * p * 0.8, 5 * cam.zoom, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const it of items) it.draw();
  }

  /** Under a shadow wyrm's pall, the lights go out. */
  const pall = (x: number, z: number) => world.fx.some((f) => f.kind === 'pall' && Math.abs(f.x - x) < f.r * 4 && Math.abs(f.z - z) < 0.2);

  function castle(p: number, t: number) {
    const c = world.castle;
    const x = SX(c.x);
    const y = SY(world.sy(c.z));
    const k = cam.zoom;
    ctx.fillStyle = land.far[1];
    ctx.beginPath();
    ctx.ellipse(x, y + 4 * k, 110 * k, 26 * k, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3f3d3a';
    ctx.fillRect(x - 70 * k, y - 26 * k, 140 * k, 26 * k);
    ctx.fillStyle = '#4b4844';
    for (let i = 0; i < 14; i++) ctx.fillRect(x - 70 * k + i * 10 * k, y - 31 * k, 6 * k, 5 * k);
    stampProp(ctx, scenery!, 'keep', 0, x, y - 4 * k, p * 1.5);
    ctx.fillStyle = '#3f2a17';
    ctx.fillRect(x + 4 * k, y - 120 * k, 2 * k, 40 * k);
    ctx.fillStyle = world.faction.color;
    ctx.beginPath();
    ctx.moveTo(x + 6 * k, y - 120 * k);
    for (let i = 0; i <= 5; i++) ctx.lineTo(x + (6 + i * 4) * k, y - 120 * k + Math.sin(t * 3 + i) * 2);
    for (let i = 5; i >= 0; i--) ctx.lineTo(x + (6 + i * 4) * k, y - 108 * k + Math.sin(t * 3 + i) * 2);
    ctx.fill();
  }

  function personDraw(q: Person, t: number, p: number, a: Atlas) {
    const x = SX(q.x);
    const y = SY(world.sy(q.z) - q.h);
    const walk = Math.floor(q.anim) % 2;
    if (!q.alive) {
      ctx.globalAlpha = Math.max(0, 0.5 - (world.t - q.deadAt) / 50);
      stamp(ctx, a, q.kind === 'knight' ? 'cav' : q.kind === 'mage' || q.kind === 'wizard' ? 'mage' : q.kind === 'archer' ? 'arch' : 'inf', q.kind === 'knight' ? 4 : q.kind === 'mage' || q.kind === 'wizard' ? 2 : 3, q.facing < 0, x, y, p, q.variant);
      if (q.frozen) {
        ctx.fillStyle = 'rgba(224,242,254,0.5)';
        ctx.fillRect(Math.round(x - 6 * p), Math.round(y - 4 * p), 12 * p, 4 * p);
      }
      ctx.globalAlpha = 1;
      return;
    }
    switch (q.kind) {
      case 'villager':
      case 'shepherd':
        stamp(ctx, a, 'peasant', walk, q.facing < 0, x, y, p, q.variant);
        if (q.light) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(x + q.facing * 4 * p, y - 12 * p, 10 * cam.zoom, '#fbbf24', 0.6);
          ctx.restore();
        }
        break;
      case 'thief':
        ctx.globalAlpha = 0.8;
        stamp(ctx, a, 'arch', walk, q.facing < 0, x, y, p, 2);
        ctx.globalAlpha = 1;
        break;
      case 'hero':
        if (q.h > 0 || q.climb > 0) stamp(ctx, a, 'inf', q.swingUntil > t ? 2 : walk, q.facing < 0, x, y, p, 0);
        else stamp(ctx, a, 'lord', Math.floor(q.anim) % 2, q.facing < 0, x, y, p, 0);
        break;
      case 'knight':
        if (q.h > 0) stamp(ctx, a, 'inf', q.swingUntil > t ? 2 : walk, q.facing < 0, x, y, p, q.variant);
        else stamp(ctx, a, 'cav', q.swingUntil > t ? 3 : Math.floor(q.anim) % 3, q.facing < 0, x, y, p, q.variant);
        break;
      case 'mage':
      case 'wizard':
        stamp(ctx, a, 'mage', q.swingUntil > t ? 1 : 0, q.facing < 0, x, y, p, q.variant);
        if (q.swingUntil > t) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(x, y - 18 * p, 16 * p, q.kind === 'wizard' ? '#a78bfa' : world.faction.kit.magic, 0.5);
          ctx.restore();
        }
        break;
      default:
        stamp(ctx, a, 'arch', q.swingUntil > t ? 2 : walk, q.facing < 0, x, y, p, q.variant);
    }
  }

  function wyrm(d: Wyrm, t: number, p: number) {
    const x = SX(d.x);
    const y = SY(world.sy(d.z) - d.h);
    const atl = dragonAtlas(d.breed);
    const flip = d.vx < 0;
    const scale = Math.max(1, Math.round(p * 1.2 * d.size * 2) / 2);
    if (d.state === 'fall' || d.state === 'dead') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((flip ? -1 : 1) * Math.min(0.9, (world.t - d.t0) * 1.2));
      stamp(ctx, atl, 'dragon', 1, flip, 0, 0, scale);
      ctx.restore();
      return;
    }
    // Basking: wings half open, still; it breathes slow smoke.
    const frame = d.state === 'bask' ? (Math.sin(t * 0.8) > 0 ? 0 : 3) : Math.floor(d.wing) % 4;
    stamp(ctx, atl, 'dragon', frame, flip, x, y, scale);
    if (d.carrying) {
      stampProp(ctx, scenery!, 'sheep', 0, x + (flip ? 4 : -4) * scale, y + 6 * scale, p);
    }
    if (d.breathing) {
      const [c0, c1, c2] = BREATH[d.breed];
      const mx = x + (flip ? -1 : 1) * 26 * scale;
      const my = y - 11 * scale;
      const ground = d.state === 'duel' || d.state === 'fightcave' ? my + 10 * scale : SY(world.sy(d.z));
      ctx.save();
      ctx.globalCompositeOperation = d.breed === 'shadow' ? 'source-over' : 'lighter';
      for (let i = 0; i < 18; i++) {
        const k = (t * 3 + i / 18) % 1;
        const fx = mx + (flip ? -1 : 1) * k * (d.state === 'duel' ? 70 : 30) * scale + (hash(i, Math.floor(t * 20)) - 0.5) * 16 * k * scale;
        const fy = my + k * (ground - my);
        ctx.fillStyle = hexA(k < 0.3 ? c0 : k < 0.7 ? c1 : c2, 0.75 * (1 - k * 0.6));
        ctx.fillRect(fx, fy, scale * (2 + k * 3), scale * (2 + k * 3));
      }
      if (d.breed !== 'shadow') glow(mx, (my + ground) / 2, 60 * d.size * cam.zoom, c1, 0.3);
      ctx.restore();
    }
  }

  /** A house burning; under venom it rots green, under shadow it smoulders black. */
  function fire(x: number, y: number, seed: number, t: number, p: number, k: number, breed: Breed) {
    const dark = breed === 'shadow';
    const [c0, c1, c2] = BREATH[breed === 'venom' || dark ? breed : 'fire'];
    ctx.save();
    ctx.globalCompositeOperation = dark ? 'source-over' : 'lighter';
    if (!dark) glow(x, y - 8 * p, 26 * p * k, breed === 'venom' ? '#84cc16' : '#f97316', 0.4);
    for (let i = 0; i < 9; i++) {
      const a = (t * 1.3 + hash(seed, i)) % 1;
      ctx.fillStyle = hexA(a < 0.4 ? c0 : a < 0.75 ? c1 : c2, 0.85 * (1 - a) * k);
      ctx.fillRect(x + (hash(seed, i, 1) - 0.5) * 16 * p, y - 4 * p - a * 18 * p, p * 1.5, p * 2.5);
    }
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const a = (t * 0.35 + i / 5 + hash(seed, i, 2)) % 1;
      ctx.fillStyle = `rgba(34,30,30,${(0.4 * (1 - a) * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + a * 26 * cam.zoom, y - 14 * p - a * 70 * cam.zoom, (4 + a * 14) * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function effects(t: number, p: number) {
    const k0 = cam.zoom;
    for (const e of world.fx) {
      const k = (t - e.t0) / e.dur;
      if (k < 0) continue;
      const x = SX(e.x);
      const y = SY(world.sy(e.z) - e.h);
      if (x < -200 || x > W + 200) continue;
      switch (e.kind) {
        case 'fire': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(x, y - 8, e.r * 1.4 * k0, '#f97316', 0.35 * (1 - k));
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = hexA(i % 2 ? '#fdba74' : '#ef4444', 0.8 * (1 - k));
            ctx.fillRect(x + (hash(e.seed, i) - 0.5) * e.r * 2 * k0, y - hash(e.seed, i, 1) * 20 * (0.4 + k) * p, p * 2, p * 3);
          }
          ctx.restore();
          break;
        }
        case 'frost': {
          // A rime spreading on the ground, glittering.
          const fade = Math.min(1, (1 - k) * 3);
          ctx.fillStyle = `rgba(186,230,253,${(0.18 * fade).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(x, y, e.r * 2 * k0, e.r * 0.4 * k0, 0, 0, Math.PI * 2);
          ctx.fill();
          for (let i = 0; i < 6; i++) if (Math.sin(t * 4 + i + e.seed) > 0.7) {
            ctx.fillStyle = hexA('#ffffff', fade);
            ctx.fillRect(x + (hash(e.seed, i) - 0.5) * e.r * 3 * k0, y + (hash(i, e.seed) - 0.5) * 6 * k0, 1, 1);
          }
          break;
        }
        case 'gas': {
          // Venom: green clouds that hang, and drift, and thin.
          const fade = Math.min(1, (t - e.t0) * 2, (1 - k) * 3);
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = `rgba(132,204,22,${(0.1 * fade).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x + (hash(e.seed, i) - 0.5) * 60 * k0 + (t - e.t0) * 3 * k0, y - (6 + hash(i, e.seed) * 20) * k0, (14 + i * 4 + k * 20) * k0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'pall': {
          // Shadow: a darkness that sits, swallowing light.
          const fade = Math.min(1, (t - e.t0) * 2, (1 - k) * 2);
          const g = ctx.createRadialGradient(x, y - 20 * k0, 0, x, y - 20 * k0, 120 * k0);
          g.addColorStop(0, `rgba(10,4,20,${(0.55 * fade).toFixed(3)})`);
          g.addColorStop(1, 'rgba(10,4,20,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 120 * k0, y - 140 * k0, 240 * k0, 240 * k0);
          break;
        }
        case 'strike': {
          // Lightning from the cloud to the ground.
          const fade = 1 - k;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = hexA('#e0e7ff', 0.9 * fade);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + (hash(e.seed, 0) - 0.5) * 80, 0);
          for (let i = 1; i <= 8; i++) ctx.lineTo(x + (i < 8 ? (hash(e.seed, i) - 0.5) * 40 * (1 - i / 8) : 0), (y * i) / 8);
          ctx.stroke();
          glow(x, y, 50 * k0, '#a5b4fc', 0.6 * fade);
          ctx.restore();
          break;
        }
        case 'smoke':
          for (let i = 0; i < 6; i++) {
            const a = (t * 0.25 + i / 6) % 1;
            ctx.fillStyle = `rgba(36,32,32,${(0.3 * (1 - a) * (1 - k)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x + a * 30 * k0, y - a * 80 * k0, (5 + a * 16) * k0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'ward': {
          const fade = Math.min(1, (t - e.t0) * 2, (e.dur - (t - e.t0)) * 1.5);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = hexA(world.faction.kit.magic, 0.06 * fade);
          ctx.strokeStyle = hexA(world.faction.kit.magic, (0.35 + 0.15 * Math.sin(t * 6)) * fade);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(x, y + 4, e.r * 1.6 * k0, e.r * k0, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'flash':
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(x, y, e.r * k0, world.faction.kit.magic, 0.6 * (1 - k));
          ctx.restore();
          break;
        case 'crater':
          ctx.fillStyle = `rgba(10,8,7,${(0.5 * Math.min(1, (e.dur - (t - e.t0)) / 10)).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(x, y, e.r * k0, e.r * 0.25 * k0, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'lantern': {
          // Lanterns let go at the festival, rising and drifting off.
          const age = t - e.t0;
          const ly = y - age * 12 * k0;
          const lx = x + Math.sin(age * 0.6 + e.seed) * 10 * k0;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(lx, ly, 8 * k0, '#fbbf24', 0.6 * (1 - k));
          ctx.fillStyle = hexA('#fde68a', 0.9 * (1 - k));
          ctx.fillRect(Math.round(lx), Math.round(ly), Math.max(1, p * 0.75), Math.max(1, p));
          ctx.restore();
          break;
        }
        case 'rune': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = hexA('#a78bfa', 0.7 * (1 - k));
          ctx.beginPath();
          ctx.arc(x, y, (6 + k * 10) * k0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'chains': {
          // Chains of light climbing the spire to the cave.
          const up = Math.min(1, (t - e.t0) / 20);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(196,181,253,${(0.55 * (1 - Math.max(0, k - 0.9) * 10)).toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const x0 = world.spire.path[0][0];
          const base = world.sy(0);
          for (let i = 0; i <= 20 * up; i++) {
            const kk = i / 20;
            const px = x0 + (world.spire.x - x0) * kk + Math.sin(kk * 14 + t * 2) * 10;
            const py = base - kk * world.spire.caveH;
            if (i) ctx.lineTo(SX(px), SY(py));
            else ctx.moveTo(SX(px), SY(py));
          }
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'sparks':
          ctx.fillStyle = hexA('#fef3c7', 1 - k);
          ctx.fillRect(x - p, y - p * 3, p * 2, p * 6);
          ctx.fillRect(x - p * 3, y - p, p * 6, p * 2);
          break;
        default:
          break;
      }
    }
    // Arrows, bolts, and the ballistae's great bolts.
    ctx.strokeStyle = 'rgba(231,229,228,0.8)';
    ctx.lineWidth = Math.max(1, p * 0.6);
    ctx.beginPath();
    for (const s of world.shots) {
      if (s.done || t < s.t0 || s.kind === 'bolt') continue;
      const k = (t - s.t0) / s.dur;
      const x = SX(s.x0 + (s.x1 - s.x0) * k);
      const z = s.z0 + (s.z1 - s.z0) * k;
      const h = s.h0 + (s.h1 - s.h0) * k + 4 * (s.kind === 'ballista' ? 30 : 60) * k * (1 - k);
      const y = SY(world.sy(z) - h);
      const len = (s.kind === 'ballista' ? 12 : 5) * p;
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.sign(s.x1 - s.x0) * len, y + 3);
    }
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of world.shots) {
      if (s.kind !== 'bolt' || t < s.t0 || t > s.t0 + s.dur + 0.2) continue;
      const fade = 1 - Math.max(0, (t - s.t0 - s.dur) / 0.2);
      ctx.strokeStyle = hexA(world.faction.kit.magic, 0.9 * fade);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const x0 = SX(s.x0);
      const y0 = SY(world.sy(s.z0) - s.h0);
      const x1 = SX(s.x1);
      const y1 = SY(world.sy(s.z1) - s.h1);
      ctx.moveTo(x0, y0);
      for (let i = 1; i <= 6; i++) ctx.lineTo(x0 + ((x1 - x0) * i) / 6 + (i < 6 ? (hash(i, Math.floor(s.t0 * 10)) - 0.5) * 20 : 0), y0 + ((y1 - y0) * i) / 6);
      ctx.stroke();
      glow(x1, y1, 30, world.faction.kit.magic, 0.5 * fade);
    }
    ctx.restore();
  }

  function weather(t: number) {
    const w = world.weather;
    if (w === 'rain' || w === 'storm') {
      ctx.strokeStyle = 'rgba(148,163,184,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 240; i++) {
        const x = ((hash(i, 1) * (W + 200) + t * 200) % (W + 200)) - 100;
        const y = (hash(i, 2) * H + t * 860 * (0.8 + hash(i, 3) * 0.4)) % H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 14);
      }
      ctx.stroke();
      if (w === 'storm' && Math.sin(t * 0.9) > 0.985) {
        ctx.fillStyle = 'rgba(226,232,240,0.08)';
        ctx.fillRect(0, 0, W, H);
      }
    } else if (w === 'snow') {
      ctx.fillStyle = 'rgba(241,245,249,0.6)';
      for (let i = 0; i < 200; i++) {
        const x = ((hash(i, 1) * W + t * 16 + Math.sin(t + i) * 12) % W + W) % W;
        const y = (hash(i, 2) * H + t * (28 + hash(i, 3) * 30)) % H;
        ctx.fillRect(x, y, hash(i, 4) < 0.2 ? 2 : 1, hash(i, 4) < 0.2 ? 2 : 1);
      }
    } else if (w === 'ash') {
      for (let i = 0; i < 120; i++) {
        const x = ((hash(i, 1) * W + t * 8 + Math.sin(t * 0.7 + i) * 18) % W + W) % W;
        const y = (hash(i, 2) * H + t * (12 + hash(i, 3) * 14)) % H;
        ctx.fillStyle = i % 9 === 0 ? 'rgba(251,146,60,0.7)' : 'rgba(120,113,108,0.5)';
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (w === 'dust') {
      ctx.fillStyle = 'rgba(180,120,60,0.07)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(214,170,110,0.18)';
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const x = ((hash(i, 1) * (W + 300) + t * 160) % (W + 300)) - 150;
        const y = hash(i, 2) * H;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 26, y + 2);
      }
      ctx.stroke();
    } else if (w === 'fog') {
      for (let i = 0; i < 5; i++) {
        const y = SY(world.groundTop + (i / 5) * (world.groundBottom - world.groundTop) - 10);
        const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
        g.addColorStop(0, 'rgba(148,163,184,0)');
        g.addColorStop(0.5, `rgba(148,163,184,${(0.07 + 0.03 * Math.sin(t * 0.3 + i)).toFixed(3)})`);
        g.addColorStop(1, 'rgba(148,163,184,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 40, W, 80);
      }
    }
  }

  /** Night: the valley darkens; fire, wards, windows, lanterns stay lit; wisps in the fen. */
  function nightfall(t: number) {
    const dark = darkness();
    if (dark < 0.02) return;
    ctx.fillStyle = `rgba(2,4,12,${(0.42 * dark).toFixed(3)})`;
    ctx.fillRect(0, SY(world.groundTop) - 40, W, H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const v of world.villages) for (const h of v.houses) if (h.burning >= 0) glow(SX(h.x), SY(world.sy(h.z) - 10), 70 * cam.zoom, world.wyrms[0]?.breed === 'venom' ? '#65a30d' : '#f97316', world.wyrms[0]?.breed === 'shadow' ? 0 : 0.35 * dark);
    for (const d of world.wyrms) if (d.breathing) glow(SX(d.x), SY(world.sy(d.z)), 140 * cam.zoom, BREATH[d.breed][1], 0.3 * dark);
    if (world.biome === 'ashland') for (let k = 0; k < 10; k++) {
      const z = k / 10;
      glow(SX(world.riverX(z)), SY(world.sy(z)), 40 * cam.zoom, '#f97316', 0.25 * dark);
    }
    if (world.biome === 'fen') for (let i = 0; i < 7; i++) {
      // Will-o'-wisps over the water.
      const x = world.BW * hash(i, 7) + Math.sin(t * 0.3 + i) * 40;
      const z = 0.2 + hash(i, 8) * 0.7;
      const blink = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 2);
      glow(SX(x), SY(world.sy(z) - 14 - Math.sin(t + i) * 6), 9 * cam.zoom, '#bef264', 0.5 * dark * blink);
    }
    ctx.restore();
  }

  /** Close in, the view is through the spyglass: a dark rim. */
  function spyglass() {
    const k = Math.min(1, Math.max(0, (cam.zoom - 1.2) / 0.4));
    if (k <= 0) return;
    const r = Math.hypot(W, H) * 0.5;
    const g = ctx.createRadialGradient(W / 2, H / 2, r * (0.95 - k * 0.25), W / 2, H / 2, r);
    g.addColorStop(0, 'rgba(2,3,6,0)');
    g.addColorStop(1, `rgba(2,3,6,${(0.75 * k).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function labels(t: number, level: number) {
    if (!o.labels) return;
    ctx.save();
    ctx.font = serif(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const placed: [number, number, number][] = [];
    for (const l of world.labels) {
      const age = t - l.t0;
      const a = Math.min(1, age * 3, (l.dur - age) / 0.8) * level;
      if (a <= 0) continue;
      const w = ctx.measureText(l.text).width;
      const x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, SX(l.x)));
      let y = Math.max(80, Math.min(H - 70, SY(world.sy(l.z) - l.h)));
      for (let tries = 0; tries < 6 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18); tries++) y -= 19;
      placed.push([x, y, w]);
      ctx.fillStyle = `rgba(6,5,8,${(0.55 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 16);
      const [cr, cg, cb] = mixRgb(l.color, '#f5ecd7', 0.5);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(0.95 * a).toFixed(3)})`;
      fillCrisp(ctx, typed(l.text, age, 40, t), x, y);
    }
    ctx.restore();
  }

  function hud(t: number, level: number) {
    if (!o.hud) return;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = serif(13);
    ctx.fillStyle = hexA('#e7dcc4', 0.85 * level);
    fillCrisp(ctx, `${LAND_NAMES[world.biome]} ${world.name} · FROM THE WATCHTOWER`, 16, 26);
    const d = world.wyrms.find((x) => !x.rival && x.size >= 1 && x.state !== 'dead');
    ctx.font = serif(11);
    ctx.fillStyle = hexA('#a8a29e', 0.85 * level);
    const doing: Record<string, string> = { sleep: 'ASLEEP', bask: 'BASKING', patrol: 'ON PATROL', hunt: 'HUNTING', carry: 'HUNTING', collect: 'TAKING TRIBUTE', fly: 'RAIDING', dive: 'RAIDING', climb: 'RAIDING', home: 'RETURNING', duel: 'FIGHTING', fightcave: 'FIGHTING AT THE CAVE', gone: 'GONE FROM THE VALLEY', away: 'FLEEING', wake: 'WAKING', fall: 'FALLING' };
    const state = !d ? 'THE SPIRE STANDS EMPTY' : `${d.name}, ${BREED_NAMES[d.breed]} · ${world.bound > world.t ? 'BOUND' : doing[d.state] ?? 'AWAKE'} · HOARD ${Math.round(world.hoard).toLocaleString('en-US')} CROWNS`;
    fillCrisp(ctx, state, 16, 42);
    const hour = Math.floor(world.day * 24);
    fillCrisp(ctx, `${world.lord.name}, ${world.lord.temper.toUpperCase()} · ${world.policy === 'peace' ? 'AT PEACE' : `POLICY: ${world.policy.toUpperCase()}`} · ${SEASONS[world.season]} ${world.year} · ${hour < 5 || hour >= 21 ? 'NIGHT' : hour < 8 ? 'DAWN' : hour < 18 ? 'DAY' : 'DUSK'}`, 16, 57);
    ctx.textAlign = 'right';
    world.villages.forEach((v, i) => {
      const standing = v.houses.filter((h) => h.ruined < 0).length;
      const burning = v.houses.some((h) => h.burning >= 0 || h.frozen >= 0);
      ctx.fillStyle = hexA(burning ? '#fca5a5' : '#e7dcc4', 0.8 * level);
      fillCrisp(ctx, `${v.name}  ${standing}/${v.houses.length}${burning ? ' · STRUCK' : ''}`, W - 16, 26 + i * 15);
    });
    ctx.textAlign = 'left';
    ctx.font = serif(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#e7dcc4', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, typed(l.text, age, 50, t), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
    ctx.restore();
  }

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      world.resize(W, H);
      back = null;
    },
    frame(info: FrameInfo) {
      step(info);
      const t = world.t;
      const p = PZ();
      const level = 0.55 + 0.45 * host.intensity;
      atlas ??= buildAtlas(world.faction.kit);
      scenery ??= buildScenery([[world.faction.color, world.faction.dark], ['#a8a29e', '#57534e']]);
      const winter = world.season === 3 && (world.biome === 'alpine' || world.biome === 'fjord');
      if (!back || back.W !== W || back.H !== H || back.winter !== winter) paintBack(winter);
      ctx.imageSmoothingEnabled = true;
      sky(t);
      farLayer();
      groundLayer();
      ctx.imageSmoothingEnabled = false;
      spire(t, p);
      valley(t, p);
      ctx.imageSmoothingEnabled = true;
      effects(t, p);
      weather(t);
      nightfall(t);
      spyglass();
      labels(t, level);
      hud(t, level);
    },
    advance(info: FrameInfo) {
      step(info);
    },
    inspect(): SkinInspection {
      return {
        t: world.t,
        counts: world.counts(),
        log: world.bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: world.bus.seq,
      };
    },
    destroy() {
      back = null;
      atlas = null;
      dragonAtlases.clear();
    },
  };
}
