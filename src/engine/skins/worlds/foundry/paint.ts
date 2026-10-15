/**
 * Foundry, painted from above. Back to front: the ground (grass, water, woods, ore, burnt
 * patches; one cached picture, redrawn when it changes), pollution, belts with their items,
 * machines by kind (ghosts while they are built, rubble when wrecked), power wires, nests and
 * biters, bots with their shadows, effects (smoke, sparks, shots, fire, the rocket), the night
 * and its lights, call-outs, then the HUD.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash, hexA, typed } from '../../instruments/kit';
import { createFoundry, ORES, TECHS, type FoundryWorld, type Item, type Line, type Machine } from './sim';

export type FoundryPaintOptions = { pace: number; camera: string; labels: boolean; hud: boolean };

const MONO = (px: number) => `${px}px "Syne Mono", ui-monospace, "Cascadia Mono", monospace`;
const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px ui-serif, Georgia, "Times New Roman", serif`;

const ITEM_COLOR: Record<Item, string> = {
  'iron-ore': '#8fa3b8',
  'copper-ore': '#d8834a',
  coal: '#1c1c1c',
  stone: '#c9b88a',
  iron: '#dfe6ee',
  copper: '#f0a060',
  brick: '#a5503a',
  gear: '#b8c0c8',
  circuit: '#4ade80',
};
const ORE_SPECK = ['', '#8fa3b8', '#d8834a', '#111111', '#cdbd8e'];

export function mountFoundry(host: SkinHost, o: FoundryPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: FoundryWorld = createFoundry(host.config.seed, W, H, { pace: o.pace, camera: o.camera });
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.4 });
  const cam = framing.cam;
  const T = world.T;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;

  // ---- the ground --------------------------------------------------------------------------------
  let ground: HTMLCanvasElement | null = null;
  let groundAt = -1;
  let groundVersion = -1;
  function paintGround() {
    const c = (ground ??= document.createElement('canvas'));
    c.width = world.cols * 8;
    c.height = world.rows * 8;
    const g = c.getContext('2d')!;
    const s = 8;
    for (let r = 0; r < world.rows; r++)
      for (let q = 0; q < world.cols; q++) {
        const i = r * world.cols + q;
        const h = hash(q, r);
        const x = q * s;
        const y = r * s;
        if (world.ground[i] === 1) {
          // Water, lighter by the shore.
          const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => world.ground[i + dy * world.cols + dx] === 0);
          g.fillStyle = shore ? '#2b5470' : '#1d3d55';
          g.fillRect(x, y, s, s);
          if (h < 0.2) {
            g.fillStyle = 'rgba(180,210,230,0.15)';
            g.fillRect(x + 1, y + 3, 4, 1);
          }
          continue;
        }
        g.fillStyle = world.ground[i] === 2 ? (h < 0.5 ? '#2c2824' : '#33302a') : h < 0.33 ? '#3f4c2d' : h < 0.66 ? '#43512f' : '#475532';
        g.fillRect(x, y, s, s);
        const ore = world.oreType[i];
        if (ore) {
          g.fillStyle = ORE_SPECK[ore];
          const n = 2 + Math.min(5, Math.floor(world.oreAmt[i] / 25));
          for (let k = 0; k < n; k++) g.fillRect(x + Math.floor(hash(i, k) * 6), y + Math.floor(hash(i, k, 1) * 6), 2, 2);
        }
        if (world.tree[i]) {
          g.fillStyle = 'rgba(0,0,0,0.28)';
          g.beginPath();
          g.arc(x + 5, y + 6, 3.4, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = h < 0.5 ? '#25391f' : '#2c4424';
          g.beginPath();
          g.arc(x + 4, y + 4, 3.6, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(140,180,90,0.25)';
          g.fillRect(x + 2, y + 2, 2, 2);
        }
      }
    groundVersion = world.groundVersion;
    groundAt = world.t;
  }

  // ---- belts and items ---------------------------------------------------------------------------
  const tileXY = (i: number): [number, number] => [((i % world.cols) + 0.5) * T, (Math.floor(i / world.cols) + 0.5) * T];
  function beltColor() {
    return world.level >= 9 ? '#3b82f6' : world.level >= 4 ? '#dc2626' : '#d4a017';
  }
  function drawBelt(l: Line, t: number, Z: number) {
    const n = Math.min(l.path.length, Math.floor(l.built));
    const s = T * Z;
    const edge = beltColor();
    for (let k = 0; k < n; k++) {
      const [wx, wy] = tileXY(l.path[k]);
      const x = SX(wx);
      const y = SY(wy);
      if (l.hidden[k]) continue;
      // Entering or leaving the ground: a darker mouth.
      const mouth = (k > 0 && l.hidden[k - 1]) || (k < l.path.length - 1 && l.hidden[k + 1]);
      ctx.fillStyle = mouth ? '#1a1a1a' : '#2f2f2f';
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      const a = l.path[Math.min(l.path.length - 1, k + 1)];
      const b = l.path[Math.max(0, k - 1)];
      const [ax, ay] = tileXY(k < l.path.length - 1 ? a : l.path[k]);
      const [bx, by] = tileXY(k > 0 ? b : l.path[k]);
      const dx = Math.sign(ax - bx);
      const dy = Math.sign(ay - by);
      // Rails on the two sides, and a chevron that runs.
      ctx.fillStyle = edge;
      if (dx !== 0) {
        ctx.fillRect(x - s / 2, y - s / 2, s, Math.max(1, s * 0.12));
        ctx.fillRect(x - s / 2, y + s / 2 - Math.max(1, s * 0.12), s, Math.max(1, s * 0.12));
      } else {
        ctx.fillRect(x - s / 2, y - s / 2, Math.max(1, s * 0.12), s);
        ctx.fillRect(x + s / 2 - Math.max(1, s * 0.12), y - s / 2, Math.max(1, s * 0.12), s);
      }
      if (l.built >= l.path.length) {
        const ph = ((t * world.beltSpeed) % 1) - 0.5;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + dx * ph * s - s * 0.08 - Math.abs(dy) * s * 0.25, y + dy * ph * s - s * 0.08 - Math.abs(dx) * s * 0.25, s * 0.16 + Math.abs(dy) * s * 0.5, s * 0.16 + Math.abs(dx) * s * 0.5);
      }
    }
  }
  function drawItems(l: Line, Z: number) {
    if (l.built < l.path.length) return;
    const col = ITEM_COLOR[l.item];
    const sz = Math.max(2, T * Z * 0.3);
    const last = l.path.length - 1;
    for (const p of l.items) {
      // Positions count from the start of the first tile; tile k's centre is at k + 0.5.
      const q = Math.max(0, p - 0.5);
      const k = Math.min(last, Math.floor(q));
      if (l.hidden[Math.min(last, Math.round(q))]) continue;
      const f = q - k;
      const [x0, y0] = tileXY(l.path[k]);
      const [x1, y1] = tileXY(l.path[Math.min(last, k + 1)]);
      const x = SX(x0 + (x1 - x0) * f);
      const y = SY(y0 + (y1 - y0) * f);
      ctx.fillStyle = col;
      if (l.item === 'gear') {
        ctx.beginPath();
        ctx.arc(x, y, sz * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        if (l.item === 'circuit') {
          ctx.fillStyle = '#14532d';
          ctx.fillRect(x - sz / 6, y - sz / 6, sz / 3, sz / 3);
        }
      }
    }
  }

  // ---- machines --------------------------------------------------------------------------------
  function machine(m: Machine, t: number, Z: number) {
    if (m.state === 'gone') return;
    const x = SX(m.c * T);
    const y = SY(m.r * T);
    const s = m.n * T * Z;
    const pad = 1.5 * Z;
    if (m.state === 'ghost') {
      ctx.fillStyle = 'rgba(96,165,250,0.12)';
      ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
      ctx.strokeStyle = 'rgba(147,197,253,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(147,197,253,0.35)';
      ctx.fillRect(x + pad, y + s - pad - 3 * Z, (s - pad * 2) * m.build, 3 * Z);
      return;
    }
    if (m.state === 'ruin') {
      ctx.fillStyle = '#2a2622';
      ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
      ctx.fillStyle = '#4b443c';
      for (let k = 0; k < 6 * m.n; k++) ctx.fillRect(x + hash(m.id, k) * (s - 4 * Z), y + hash(m.id, k, 1) * (s - 4 * Z), 3 * Z, 3 * Z);
      if (m.build > 0) {
        ctx.fillStyle = 'rgba(147,197,253,0.4)';
        ctx.fillRect(x + pad, y + s - pad - 3 * Z, (s - pad * 2) * m.build, 3 * Z);
      }
      return;
    }
    const cxs = x + s / 2;
    const cys = y + s / 2;
    // A shadow, then the body.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + pad + 2 * Z, y + pad + 3 * Z, s - pad * 2, s - pad * 2);
    const body: Record<string, string> = { hq: '#4b5563', miner: '#7a6f4c', furnace: '#7d6e60', assembler: '#5b6470', lab: '#4a5568', silo: '#3f3f46', boiler: '#6b6358', turret: '#5a5f52' };
    ctx.fillStyle = body[m.kind];
    ctx.fillRect(x + pad, y + pad, s - pad * 2, s - pad * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + pad, y + pad, s - pad * 2, 2 * Z);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + pad, y + s - pad - 2 * Z, s - pad * 2, 2 * Z);
    const working = m.busy || (m.kind === 'miner' && m.outBuf < 6) || (m.kind === 'boiler' && m.fuel > 0);
    if (m.kind === 'miner') {
      ctx.fillStyle = ORE_SPECK[ORES.indexOf(m.ore as (typeof ORES)[number]) + 1] || '#888';
      ctx.fillRect(cxs - s * 0.18, cys - s * 0.18, s * 0.36, s * 0.36);
      const a = working ? t * 4 : 0.6;
      ctx.strokeStyle = '#d4c48a';
      ctx.lineWidth = Math.max(1, 2 * Z);
      ctx.beginPath();
      ctx.moveTo(cxs - Math.cos(a) * s * 0.32, cys - Math.sin(a) * s * 0.32);
      ctx.lineTo(cxs + Math.cos(a) * s * 0.32, cys + Math.sin(a) * s * 0.32);
      ctx.stroke();
    } else if (m.kind === 'furnace') {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(cxs - s * 0.22, cys - s * 0.05, s * 0.44, s * 0.3);
      if (working) {
        ctx.fillStyle = `rgba(251,146,60,${(0.6 + 0.3 * Math.sin(t * 9 + m.id)).toFixed(3)})`;
        ctx.fillRect(cxs - s * 0.18, cys, s * 0.36, s * 0.2);
      }
    } else if (m.kind === 'assembler') {
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = Math.max(1, 1.5 * Z);
      const a = working ? t * 2 : 0;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = a + (k / 8) * Math.PI * 2;
        ctx.moveTo(cxs + Math.cos(ang) * s * 0.12, cys + Math.sin(ang) * s * 0.12);
        ctx.lineTo(cxs + Math.cos(ang) * s * 0.26, cys + Math.sin(ang) * s * 0.26);
      }
      ctx.stroke();
      ctx.fillStyle = m.recipe === 'circuit' ? '#4ade80' : '#b8c0c8';
      ctx.fillRect(x + s - pad - 6 * Z, y + pad + 2 * Z, 4 * Z, 4 * Z);
    } else if (m.kind === 'lab') {
      ctx.fillStyle = `rgba(96,165,250,${(working ? 0.55 + 0.3 * Math.sin(t * 4 + m.id) : 0.25).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cxs, cys, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (m.kind === 'boiler') {
      ctx.fillStyle = '#3f3a33';
      ctx.fillRect(x + s * 0.15, cys - s * 0.12, s * 0.7, s * 0.24);
      if (working) {
        ctx.fillStyle = `rgba(251,146,60,${(0.5 + 0.3 * Math.sin(t * 7 + m.id)).toFixed(3)})`;
        ctx.fillRect(cxs - s * 0.08, cys - s * 0.06, s * 0.16, s * 0.12);
      }
    } else if (m.kind === 'turret') {
      const b = world.biters.filter((q) => q.alive).sort((p, q) => Math.hypot(p.x - (m.c + 1) * T, p.y - (m.r + 1) * T) - Math.hypot(q.x - (m.c + 1) * T, q.y - (m.r + 1) * T))[0];
      const a = b ? Math.atan2(b.y - (m.r + 1) * T, b.x - (m.c + 1) * T) : t * 0.3 + m.id;
      ctx.fillStyle = '#3f4238';
      ctx.beginPath();
      ctx.arc(cxs, cys, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a3a89a';
      ctx.lineWidth = Math.max(1, 2.5 * Z);
      ctx.beginPath();
      ctx.moveTo(cxs, cys);
      ctx.lineTo(cxs + Math.cos(a) * s * 0.45, cys + Math.sin(a) * s * 0.45);
      ctx.stroke();
    } else if (m.kind === 'silo') {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(cxs, cys, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = Math.max(1, 2 * Z);
      ctx.beginPath();
      ctx.arc(cxs, cys, s * 0.38, -Math.PI / 2, -Math.PI / 2 + (m.parts / 40) * Math.PI * 2);
      ctx.stroke();
      const flying = world.fx.some((f) => f.kind === 'rocket' && Math.abs(f.x - (m.c + m.n / 2) * T) < 1);
      if (m.parts > 20 && !flying) {
        ctx.fillStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.arc(cxs, cys, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (m.kind === 'hq') {
      ctx.strokeStyle = 'rgba(253,230,138,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cxs, cys, s * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(cxs - s * 0.18, cys - s * 0.18, s * 0.36, s * 0.36);
      ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#fbbf24' : '#78350f';
      ctx.fillRect(cxs - 2 * Z, cys - 2 * Z, 4 * Z, 4 * Z);
    }
    if (m.boost > world.t) {
      ctx.strokeStyle = `rgba(253,230,138,${(0.4 + 0.3 * Math.sin(t * 8)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + pad - 1, y + pad - 1, s - pad * 2 + 2, s - pad * 2 + 2);
    }
    if (m.hp < 100 && m.state === 'work') {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(x + pad, y - 3 * Z, s - pad * 2, 2 * Z);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x + pad, y - 3 * Z, (s - pad * 2) * (m.hp / 100), 2 * Z);
    }
  }

  // Power wires: each powered machine to its nearest neighbour, recomputed when the factory changes.
  let wires: [number, number, number, number][] = [];
  let wiredAt = -1;
  function rewire() {
    const powered = world.machines.filter((m) => m.state === 'work' && m.kind !== 'turret');
    wires = [];
    for (const a of powered) {
      const ax = (a.c + a.n - 0.3) * T;
      const ay = (a.r + 0.3) * T;
      let best: [number, number] | null = null;
      let bd = 12 * T;
      for (const b of powered) {
        if (b === a || b.id > a.id) continue;
        const bx = (b.c + b.n - 0.3) * T;
        const by = (b.r + 0.3) * T;
        const d = Math.hypot(bx - ax, by - ay);
        if (d < bd) {
          bd = d;
          best = [bx, by];
        }
      }
      if (best) wires.push([ax, ay, best[0], best[1]]);
    }
    wiredAt = world.machines.filter((m) => m.state === 'work').length;
  }

  // Night lights: one soft sprite, tinted by drawing it in colour.
  const glowCache = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, rad: number, color: string, a: number) {
    let c = glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowCache.set(color, c);
    }
    ctx.globalAlpha = a;
    ctx.drawImage(c, x - rad, y - rad, rad * 2, rad * 2);
    ctx.globalAlpha = 1;
  }

  let pollutionCanvas: HTMLCanvasElement | null = null;
  function paint(t: number) {
    const Z = cam.zoom;
    ctx.fillStyle = '#20281a';
    ctx.fillRect(0, 0, W, H);
    if (!ground || (world.groundVersion !== groundVersion && world.t - groundAt > 1.5)) paintGround();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ground!, SX(0), SY(0), world.cols * T * Z, world.rows * T * Z);
    ctx.imageSmoothingEnabled = true;
    // Pollution: a brown haze over the busiest ground.
    const pcv = (pollutionCanvas ??= document.createElement('canvas'));
    pcv.width = world.pcols;
    pcv.height = world.prows;
    const pg = pcv.getContext('2d')!;
    const img = pg.createImageData(world.pcols, world.prows);
    for (let k = 0; k < world.pollution.length; k++) {
      img.data[k * 4] = 70;
      img.data[k * 4 + 1] = 52;
      img.data[k * 4 + 2] = 30;
      img.data[k * 4 + 3] = Math.min(90, world.pollution[k] * 40);
    }
    pg.putImageData(img, 0, 0);
    ctx.drawImage(pcv, SX(0), SY(0), world.pcols * world.pc * T * Z, world.prows * world.pc * T * Z);
    // Fire in the woods.
    for (const [i] of world.fires) {
      const [wx, wy] = tileXY(i);
      ctx.fillStyle = `rgba(249,115,22,${(0.5 + 0.4 * Math.sin(t * 12 + i)).toFixed(3)})`;
      ctx.fillRect(SX(wx) - T * Z * 0.4, SY(wy) - T * Z * 0.4, T * Z * 0.8, T * Z * 0.8);
    }
    for (const l of world.lines) if (!l.dead) drawBelt(l, t, Z);
    for (const l of world.lines) if (!l.dead) drawItems(l, Z);
    for (const m of world.machines) machine(m, t, Z);
    if (wiredAt !== world.machines.filter((m) => m.state === 'work').length) rewire();
    ctx.strokeStyle = 'rgba(20,16,10,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [ax, ay, bx, by] of wires) {
      ctx.moveTo(SX(ax), SY(ay));
      ctx.quadraticCurveTo((SX(ax) + SX(bx)) / 2, (SY(ay) + SY(by)) / 2 + 6 * Z, SX(bx), SY(by));
    }
    ctx.stroke();
    // Nests and biters.
    for (const n of world.nests) {
      const x = SX(n.x);
      const y = SY(n.y);
      ctx.fillStyle = '#3b1f3f';
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        ctx.arc(x + (hash(k, n.attacks, 3) - 0.5) * 3.5 * T * Z, y + (hash(k, 5) - 0.5) * 2.5 * T * Z, (5 + hash(k, 7) * 6) * Z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(192,132,252,${(0.4 + 0.2 * Math.sin(t * 2 + n.x)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * Z, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of world.biters) {
      if (!b.alive) continue;
      const x = SX(b.x);
      const y = SY(b.y);
      const leg = Math.sin(t * 18 + b.hx) * 1.5 * Z;
      ctx.strokeStyle = '#2a1030';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4 * Z, y - 2 * Z + leg);
      ctx.lineTo(x + 4 * Z, y + 2 * Z - leg);
      ctx.moveTo(x - 4 * Z, y + 2 * Z - leg);
      ctx.lineTo(x + 4 * Z, y - 2 * Z + leg);
      ctx.stroke();
      ctx.fillStyle = '#7e2a52';
      ctx.beginPath();
      ctx.ellipse(x, y, 3.4 * Z, 2.6 * Z, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bots: a shadow on the ground, the bot above it.
    for (const b of world.bots) {
      const x = SX(b.x);
      const y = SY(b.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 3 * Z, y + 6 * Z, 3 * Z, 2 * Z);
      ctx.fillStyle = b.job >= 0 ? '#fbbf24' : '#d6d3d1';
      ctx.beginPath();
      ctx.moveTo(x, y - 2.5 * Z);
      ctx.lineTo(x + 2.5 * Z, y);
      ctx.lineTo(x, y + 2.5 * Z);
      ctx.lineTo(x - 2.5 * Z, y);
      ctx.fill();
    }
    // Effects.
    for (const f of world.fx) {
      const age = t - f.t0;
      if (age < 0) continue;
      const k = age / f.dur;
      const x = SX(f.x);
      const y = SY(f.y);
      if (f.kind === 'smoke') {
        ctx.fillStyle = `rgba(160,155,145,${(0.3 * (1 - k)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + age * 4 * Z, y - age * 9 * Z, (3 + age * 2.5) * Z, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 'spark') {
        ctx.fillStyle = `rgba(253,224,71,${(1 - k).toFixed(3)})`;
        ctx.fillRect(x - Z, y - Z, 2 * Z, 2 * Z);
      } else if (f.kind === 'shot') {
        ctx.strokeStyle = `rgba(253,230,138,${(1 - k).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(SX(f.x1!), SY(f.y1!));
        ctx.stroke();
      } else if (f.kind === 'boom') {
        ctx.strokeStyle = `rgba(251,146,60,${(1 - k).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, (6 + k * 30) * Z, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'crater') {
        ctx.fillStyle = `rgba(253,186,116,${(0.8 * (1 - k)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, (10 + k * 50) * Z, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 'rocket') {
        // Up and away: the rocket climbs off the top of the chart, on a column of smoke.
        const rise = age * age * 22 * Z;
        for (let s = 0; s < 14; s++) {
          ctx.fillStyle = `rgba(200,196,190,${(0.35 * (1 - s / 14) * (1 - k * 0.6)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x + Math.sin(s + age) * 3 * Z, y - rise + s * 14 * Z, (6 + s * 2) * Z, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(x - 2 * Z, y - rise + 6 * Z, 4 * Z, (6 + 3 * Math.sin(age * 30)) * Z);
        ctx.fillStyle = '#f5f5f4';
        ctx.fillRect(x - 3 * Z, y - rise - 12 * Z, 6 * Z, 18 * Z);
      }
    }
    // Night, and the lights in it.
    const night = Math.max(0, Math.cos(world.day * Math.PI * 2)) * 0.55;
    if (night > 0.02) {
      ctx.fillStyle = `rgba(6,10,24,${night.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of world.machines) {
        if (m.state !== 'work') continue;
        const x = SX((m.c + m.n / 2) * T);
        const y = SY((m.r + m.n / 2) * T);
        const color = m.kind === 'furnace' || m.kind === 'boiler' ? '#f97316' : m.kind === 'lab' ? '#60a5fa' : '#fde68a';
        glow(x, y, (m.n * 10 + 10) * Z, color, night * (m.busy || m.kind === 'hq' ? 0.7 : 0.35));
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    labels(t);
    hud(t);
  }

  function labels(t: number) {
    if (!o.labels) return;
    ctx.font = MONO(12);
    ctx.textAlign = 'center';
    const placed: [number, number, number][] = [];
    for (const l of [...world.labels].reverse()) {
      const age = t - l.t0;
      const text = fitText(ctx, typed(l.text, age, 45, t), W - 40);
      const w = ctx.measureText(text).width;
      const x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, SX(l.x)));
      let y = Math.max(64, Math.min(H - 70, SY(l.y)));
      for (let k = 0; k < 4 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 6 && Math.abs(py - y) < 16); k++) y -= 16;
      placed.push([x, y, w]);
      ctx.fillStyle = 'rgba(12,10,8,0.6)';
      ctx.fillRect(x - w / 2 - 4, y - 11, w + 8, 15);
      ctx.fillStyle = hexA(l.color, Math.min(1, age * 3, (6 - age) / 1.5));
      fillCrisp(ctx, text, x, y);
    }
    ctx.textAlign = 'left';
  }

  function hud(t: number) {
    if (!o.hud) return;
    const level = 0.55 + 0.45 * host.intensity;
    const c = world.counts();
    const tech = TECHS[world.level] ?? 'MINING PRODUCTIVITY';
    ctx.font = MONO(13);
    ctx.fillStyle = hexA('#f5f5f4', 0.92 * level);
    fillCrisp(ctx, fitText(ctx, `FOUNDRY · ${world.name}${world.launches ? ` · ${world.launches} ROCKET${world.launches > 1 ? 'S' : ''} LAUNCHED` : ''}`, W - 32), 16, 26);
    ctx.font = MONO(11);
    ctx.fillStyle = hexA('#d6d3d1', 0.85 * level);
    fillCrisp(ctx, fitText(ctx, `${c.machines} MACHINES · ${c.items} ON THE BELTS · POWER ${Math.round(world.power * 100)}% · RESEARCHING ${tech}`, W - 32), 16, 43);
    fillCrisp(ctx, fitText(ctx, `IRON ${Math.floor(world.stock.iron)} · COPPER ${Math.floor(world.stock.copper)} · BRICK ${Math.floor(world.stock.brick)}${world.cast.length ? ` · ${world.cast.join(', ').toUpperCase()}` : ''}`, W - 32), 16, 58);
    ctx.font = SERIF(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#f5f5f4', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [SX(x), SY(y)],
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y],
    after: (dt) => framing.update(dt, world.t, world.director, W, H),
    paint: (t) => paint(t),
    ambience: () => (world.biters.some((b) => b.alive) ? 0.9 : 0.5),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      ground = null;
      pollutionCanvas = null;
    },
  });
}
