/**
 * Wyrmspire's living vale, painted: the valley in depth from a hillside.
 *
 * Back to front: the sky by the hour, far ranges in parallax, the spire with its path and cave,
 * the ground (painted once: the land's colours, the river, the lake, the road), the fields in
 * their season's colours, then everything that stands (trees, buildings in every state, people,
 * herds, the dragons on their perches) sorted by depth and scaled by it; the dragons in flight
 * over all, with their shadows on the ground; missiles and fire; then the night, and the lights
 * in it: windows, beacons, lanterns, burning roofs. No post-processing: glows are cached sprites.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld } from '../../../kit';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../../instruments/kit';
import { serif } from '../names';
import { BREATH, BREED_NAMES, createVale, LAND_NAMES, SEASONS, type Beast, type Biome, type Building, type Dragon, type Person, type Tree, type ValeWorld } from './sim';

type RGB = [number, number, number];
type Look = { sky: [string, string, string]; night: [string, string]; far: [string, string, string]; snow: string; ground: [string, string]; dry: string; wall: string[]; roof: string[]; water: string; rock: string };
const LOOKS: Record<Biome, Look> = {
  alpine: { sky: ['#5b8cc8', '#9cc3e6', '#e8eff2'], night: ['#060a18', '#17213a'], far: ['#7d93b0', '#5e7391', '#455671'], snow: '#f1f5f9', ground: ['#7a9a5a', '#4f7a3a'], dry: '#a4a46a', wall: ['#e7dcc4', '#d6c3a5', '#c9b79a'], roof: ['#5b3a29', '#3f3f46', '#7c2d12', '#57534e'], water: '#4a7fa8', rock: '#8a8a92' },
  fjord: { sky: ['#56708a', '#9fb3c4', '#dbe4ea'], night: ['#050a14', '#141e30'], far: ['#5d6f80', '#455868', '#33434f'], snow: '#e2e8f0', ground: ['#5a7a4e', '#3a5a36'], dry: '#8a8a5a', wall: ['#9a3412', '#b45309', '#7c2d12', '#e7dcc4'], roof: ['#3f6212', '#365314', '#44403c', '#57534e'], water: '#2f5874', rock: '#6b7280' },
  canyon: { sky: ['#d97742', '#f0b27a', '#fbe0b8'], night: ['#120708', '#2a1418'], far: ['#b8643c', '#9a4a2a', '#7a3520'], snow: '#f5d0a9', ground: ['#c49a5e', '#a07040'], dry: '#d8b47a', wall: ['#e0b88a', '#d4a373', '#c79a6a'], roof: ['#9a3412', '#7c2d12', '#b45309', '#78350f'], water: '#4a8a9a', rock: '#a0522d' },
  fen: { sky: ['#7a8a78', '#aab4a2', '#d6dccb'], night: ['#070a08', '#151d17'], far: ['#6a7a68', '#556552', '#425040'], snow: '#e2e8f0', ground: ['#62704a', '#45553a'], dry: '#8a8a5a', wall: ['#a8a29e', '#d6d3d1', '#8b7d6b'], roof: ['#a16207', '#854d0e', '#78716c', '#a8a29e'], water: '#3d5a52', rock: '#6b6b5e' },
  ashland: { sky: ['#4a2a3a', '#8a4a4a', '#d08a5a'], night: ['#0a0406', '#200c12'], far: ['#3a2a30', '#2a1e24', '#1c1418'], snow: '#9a8a8a', ground: ['#5a524c', '#3e3632'], dry: '#6e625a', wall: ['#78716c', '#57534e', '#a8a29e'], roof: ['#292524', '#44403c', '#7f1d1d', '#1c1917'], water: '#7a2a10', rock: '#2e2a2c' },
};
const DRAGON: { body: string; dark: string; belly: string }[] = [
  { body: '#9f1d1d', dark: '#4c0d0d', belly: '#f59e0b' },
  { body: '#1f5f3a', dark: '#0d2a1a', belly: '#bef264' },
  { body: '#27272a', dark: '#09090b', belly: '#f97316' },
  { body: '#cbd5e1', dark: '#64748b', belly: '#bae6fd' },
];
const BREED_COLOR: Record<string, number> = { fire: 0, venom: 1, shadow: 2, frost: 3, storm: 2 };
const SKIN = ['#f1c7a1', '#e0ac69', '#c68642', '#8d5524'];
const CLOTH = ['#7c2d12', '#365314', '#1e3a8a', '#713f12', '#57534e', '#9a3412', '#4c1d95'];

const mixHex = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, k);
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};

export type ValePaintOptions = { valley: string; wrath: number; knights: number; villages: number; time: string; camera: string; labels: boolean; hud: boolean };

export function mountVale(host: SkinHost, o: ValePaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: ValeWorld = createVale(host.config.seed, W, H, { valley: o.valley, wrath: o.wrath, knights: o.knights, villages: o.villages, camera: o.camera });
  const { GW, GH, GY0, groundY, depth } = world;
  const L = LOOKS[world.biome];

  // ---- camera ---------------------------------------------------------------------------------------
  // The whole valley, still or drifting in for the big moments; or the old director's camera.
  const framing = o.camera === 'director' ? null : createFraming(o.camera === 'still' ? 'still' : 'drift', world);
  const cam = framing ? framing.cam : { x: GW / 2, y: GH / 2, zoom: 1 };
  const minZoom = () => Math.max(W / GW, H / GH);
  let Z = 1;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  function camera(dt: number) {
    if (framing) return framing.update(dt, world.t, world.director, W, H);
    const s = world.director.shot;
    const zoom = Math.max(minZoom(), Math.min(2.4, s.zoom));
    cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 0.5);
    const k = Math.min(1, dt * 0.7);
    cam.x += (s.x - cam.x) * k;
    cam.y += (s.y - cam.y) * k;
    const hw = W / 2 / cam.zoom;
    const hh = H / 2 / cam.zoom;
    cam.x = Math.max(hw, Math.min(GW - hw, cam.x));
    cam.y = Math.max(hh, Math.min(GH - hh, cam.y));
    // Keep the horizon in the frame, unless close in: the sky and the spire are half the picture.
    if (cam.zoom < 1.35) cam.y = Math.min(cam.y, world.HZ + hh * 0.45);
  }
  camera(10);
  const wy = (z: number, h = 0) => groundY(z) - h * depth(z);
  const onScreen = (x: number, y: number, pad = 80) => {
    const X = SX(x);
    const Y = SY(y);
    return X > -pad * Z && X < W + pad * Z && Y > -pad * Z * 2 && Y < H + pad * Z;
  };

  // ---- light and time --------------------------------------------------------------------------------
  const glowCache = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, r: number, color: string, a: number) {
    if (r <= 0 || a <= 0.01 || x < -r || x > W + r || y < -r || y > H + r) return;
    let s = glowCache.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(0.35, hexA(color, 0.35));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowCache.set(color, s);
    }
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
  let glows: [number, number, number, string, number][] = [];
  const lit = (x: number, y: number, r: number, color: string, a: number) => glows.push([SX(x), SY(y), r * Z, color, a]);
  const darkness = () => {
    if (o.time === 'night') return 1;
    if (o.time === 'dusk') return 0.55;
    const d = world.day;
    return d < 0.2 || d > 0.82 ? 1 : d < 0.28 ? 1 - (d - 0.2) / 0.08 : d > 0.72 ? (d - 0.72) / 0.1 : 0;
  };
  const dusk = () => {
    const d = world.day;
    return Math.max(0, 1 - Math.abs(d - 0.76) / 0.08) + Math.max(0, 1 - Math.abs(d - 0.24) / 0.06) * 0.7;
  };
  const winter = () => world.season === 3;

  // ---- drawing helpers ------------------------------------------------------------------------------
  const R = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(SX(x), SY(y), w * Z, h * Z);
  };
  const poly = (pts: number[], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < pts.length; k += 2) (k ? ctx.lineTo : ctx.moveTo).call(ctx, SX(pts[k]), SY(pts[k + 1]));
    ctx.closePath();
    ctx.fill();
  };
  const shadow = (x: number, y: number, rx: number, ry: number, a = 0.25) => {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(SX(x), SY(y), Math.max(0.5, rx * Z), Math.max(0.3, ry * Z), 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // ---- the sky, the ranges, the spire ----------------------------------------------------------------
  function sky(t: number, night: number) {
    const top = SY(0);
    const hz = SY(world.HZ + 40);
    const g = ctx.createLinearGradient(0, top, 0, hz);
    const n = (c: string, k: number) => mixHex(c, k ? L.night[1] : L.night[0], night * 0.92);
    const dk = dusk() * (1 - night * 0.5);
    g.addColorStop(0, n(L.sky[0], 0));
    g.addColorStop(0.6, mixHex(n(L.sky[1], 1), '#f97316', dk * 0.35));
    g.addColorStop(1, mixHex(n(L.sky[2], 1), '#fb923c', dk * 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (night > 0.05) for (let i = 0; i < 200; i++) {
      const y = top + hash(i, 2) * (hz - top) * 0.95;
      ctx.fillStyle = `rgba(226,232,240,${((0.2 + hash(i, 3) * 0.6) * night * (0.8 + 0.2 * Math.sin(t * 2 + i))).toFixed(3)})`;
      ctx.fillRect(Math.floor(hash(i, 1) * W), Math.floor(y), 1, 1);
    }
    // Sun and moon on their arcs.
    const ang = world.day * Math.PI * 2;
    const sx = W * 0.5 - Math.sin(ang) * W * 0.42;
    const syy = top + (hz - top) * (0.6 + Math.cos(ang) * 0.55);
    if (night < 0.95 && syy < hz) {
      glow(sx, syy, 180, '#fde68a', 0.35 * (1 - night));
      ctx.fillStyle = hexA('#fffbeb', 0.95 * (1 - night));
      ctx.beginPath();
      ctx.arc(sx, syy, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    const mx = W * 0.5 + Math.sin(ang) * W * 0.42;
    const my = top + (hz - top) * (0.6 - Math.cos(ang) * 0.55);
    if (night > 0.2 && my < hz) {
      glow(mx, my, 70, '#e2e8f0', 0.2 * night);
      ctx.fillStyle = hexA('#f1f5f9', 0.9 * night);
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    // Clouds, slow, soft.
    for (let k = 0; k < 9; k++) {
      const x = ((hash(k, 51) * (GW + 800) + t * (5 + hash(k, 52) * 8)) % (GW + 800)) - 400;
      const y = world.HZ * (0.15 + hash(k, 53) * 0.55);
      const X = SX(x * 0.6 + cam.x * 0.4);
      const Y = SY(y);
      if (X < -400 || X > W + 400) continue;
      const c = night > 0.5 ? '#3a4458' : mixHex(mixHex('#ffffff', L.sky[1], 0.35), '#fb923c', dk * 0.4);
      for (let j = 0; j < 7; j++) glow(X + (j - 3) * 34 * Z, Y + Math.sin(j * 2.1 + k) * 6 * Z, (60 + hash(k, j) * 40) * Z, c, (night > 0.5 ? 0.25 : 0.28) * (0.6 + hash(k, j + 7) * 0.4));
    }
  }
  /** A ridge line: smooth noise of a few sines, by layer. */
  const ridge = (x: number, layer: number) => {
    const a = Math.sin(x * 0.0021 + layer * 1.7) * 0.5 + Math.sin(x * 0.0057 + layer * 3.1) * 0.3 + Math.sin(x * 0.013 + layer) * 0.12 + Math.abs(Math.sin(x * 0.0009 + layer * 5)) * 0.6;
    return a;
  };
  function ranges(night: number) {
    for (let layer = 0; layer < 3; layer++) {
      const par = 0.25 + layer * 0.25;
      const base = GY0 + 4 - layer * 6;
      const amp = world.HZ * (0.75 - layer * 0.18) * (world.biome === 'fen' ? 0.35 : world.biome === 'alpine' ? 1.15 : 1);
      const col = mixHex(L.far[layer], L.night[1], night * 0.75);
      const pts: [number, number][] = [];
      for (let X = -8; X <= W + 8; X += 6) {
        const wx = (X - W / 2) / cam.zoom + cam.x * par + GW * (1 - par) * 0.5;
        const h = (ridge(wx, layer) * 0.5 + 0.55) * amp;
        pts.push([X, SY(base - h)]);
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-8, H);
      for (const [X, Y] of pts) ctx.lineTo(X, Y);
      ctx.lineTo(W + 8, H);
      ctx.fill();
      // The nearest hills fade into the valley floor, with trees along their crests.
      if (layer === 2) {
        const yTop = SY(base - amp * 0.75);
        const g2 = ctx.createLinearGradient(0, yTop, 0, SY(base));
        const floor = mixHex(mixHex(L.ground[1], L.sky[2], 0.4), L.night[1], night * 0.75);
        g2.addColorStop(0, hexA(floor, 0));
        g2.addColorStop(1, hexA(floor, 0.95));
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(-8, SY(base) + 2);
        for (const [X, Y] of pts) ctx.lineTo(X, Y);
        ctx.lineTo(W + 8, SY(base) + 2);
        ctx.fill();
      }
      // Snow on the highest.
      if (layer < 2 && world.biome !== 'fen' && world.biome !== 'canyon') {
        ctx.fillStyle = hexA(mixHex(winter() ? '#ffffff' : L.snow, L.night[1], night * 0.6), 0.9);
        ctx.beginPath();
        let open = false;
        for (const [X, Y] of pts) {
          const peak = Y < SY(base - amp * 0.82);
          if (peak && !open) {
            ctx.moveTo(X, Y + 1);
            open = true;
          } else if (peak) ctx.lineTo(X, Y);
          else if (open) {
            ctx.lineTo(X, SY(base - amp * 0.82) + 2);
            ctx.closePath();
            open = false;
          }
        }
        ctx.fill();
      }
    }
  }
  function spire(t: number, night: number) {
    const sp = world.spire;
    const base = groundY(sp.z) + 6;
    const x = sp.x;
    if (!onScreen(x, (base + sp.apexY) / 2, 300)) return;
    const hgt = base - sp.apexY;
    const rock = mixHex(L.rock, L.night[1], night * 0.6);
    const dark = mixHex(rock, '#000000', 0.45);
    const light = mixHex(rock, '#ffffff', 0.18);
    // A needle of rock, jagged, wide at the foot.
    const left: number[] = [];
    const right: number[] = [];
    for (let k = 0; k <= 14; k++) {
      const u = k / 14;
      const y = base - hgt * u;
      const w = (150 * Math.pow(1 - u, 1.4) + 10 + hash(k, 3) * 10 * (1 - u)) * world.u;
      left.push(x - w - hash(k, 1) * 14, y);
      right.push(x + w + hash(k, 2) * 14, y);
    }
    const outline: number[] = [];
    for (let k = 0; k < left.length; k += 2) outline.push(left[k], left[k + 1]);
    for (let k = right.length - 2; k >= 0; k -= 2) outline.push(right[k], right[k + 1]);
    poly(outline, rock);
    // Shadowed right flank.
    const flank: number[] = [];
    for (let k = 0; k < right.length; k += 2) flank.push(x + (right[k] - x) * 0.35, right[k + 1]);
    for (let k = right.length - 2; k >= 0; k -= 2) flank.push(right[k], right[k + 1]);
    poly(flank, dark);
    // Lit ledges on the left, irregular.
    for (let k = 1; k < 12; k++) {
      const y = base - hgt * (k / 12) + hash(k, 8) * 10;
      const w = (150 * Math.pow(1 - k / 12, 1.4) + 6) * world.u;
      poly([x - w * (0.9 + hash(k, 4) * 0.1), y, x - w * (0.2 + hash(k, 5) * 0.3), y - 3 - hash(k, 6) * 4, x - w * 0.1, y], light);
    }
    // The path, zigzagging up to the cave.
    ctx.strokeStyle = hexA('#d6c3a5', 0.55);
    ctx.lineWidth = Math.max(1, 1.4 * Z);
    ctx.setLineDash([4 * Z, 3 * Z]);
    ctx.beginPath();
    sp.path.forEach(([px, py], k) => (k ? ctx.lineTo(SX(px), SY(py)) : ctx.moveTo(SX(px), SY(py))));
    ctx.stroke();
    ctx.setLineDash([]);
    // The cave, and the glint of the hoard in it.
    ctx.fillStyle = '#0a0705';
    ctx.beginPath();
    ctx.ellipse(SX(x), SY(sp.caveY), 26 * Z, 16 * Z, 0, Math.PI, 0);
    ctx.lineTo(SX(x + 26), SY(sp.caveY + 4));
    ctx.lineTo(SX(x - 26), SY(sp.caveY + 4));
    ctx.fill();
    const hoard = Math.min(1, sp.hoard / 1500);
    for (let k = 0; k < 6; k++) R(x - 14 + k * 5, sp.caveY - 1 - hash(k, 9) * 4 * hoard, 3, 3, '#ca8a04');
    lit(x, sp.caveY - 4, 30 + hoard * 20, '#fbbf24', 0.25 + hoard * 0.25 + 0.05 * Math.sin(t * 2));
    if (world.biome === 'ashland') {
      // Lava seeping from cracks, glowing.
      ctx.strokeStyle = hexA('#f97316', 0.75);
      ctx.lineWidth = Math.max(1, 1.2 * Z);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        let px = x - 50 + k * 30;
        let py = base - hgt * (0.12 + k * 0.08);
        ctx.moveTo(SX(px), SY(py));
        for (let j = 0; j < 6; j++) {
          px += (hash(k, j, 1) - 0.5) * 10;
          py += 8;
          ctx.lineTo(SX(px), SY(py));
        }
        ctx.stroke();
        lit(px, py - 20, 18, '#f97316', 0.35);
      }
    }
  }

  // ---- the ground, painted once ---------------------------------------------------------------------
  let groundCanvas: HTMLCanvasElement | null = null;
  const GS = 0.5;
  function paintGround() {
    const c = document.createElement('canvas');
    c.width = Math.ceil(GW * GS);
    c.height = Math.ceil((GH - GY0 + 20) * GS);
    const g = c.getContext('2d')!;
    const img = g.createImageData(c.width, c.height);
    const [g0, g1] = [mixRgb(L.ground[0], L.ground[0], 0), mixRgb(L.ground[1], L.ground[1], 0)];
    const dry = mixRgb(L.dry, L.dry, 0);
    for (let py = 0; py < c.height; py++) {
      const y = GY0 - 20 + py / GS;
      const z = Math.max(0, Math.min(1, Math.pow(Math.max(0, (y - GY0) / (GH - GY0)), 1 / 1.25)));
      for (let px = 0; px < c.width; px++) {
        const x = px / GS;
        const n = hash(px, py, 7);
        const patch = Math.sin(x * 0.004 + z * 6) * 0.5 + Math.sin(x * 0.011 - z * 9 + 2) * 0.3 + Math.sin(x * 0.0017 + 3) * 0.2;
        // Rolling ground: long ridges across the valley, lit on their near faces.
        const roll = Math.sin(z * 34 + Math.sin(x * 0.003) * 2.2 + Math.sin(x * 0.0011 + 1) * 3) * (1 - z) * 0.09;
        const k = Math.max(0, Math.min(1, 0.5 + patch * 0.5));
        let col: RGB = [g0[0] + (g1[0] - g0[0]) * k, g0[1] + (g1[1] - g0[1]) * k, g0[2] + (g1[2] - g0[2]) * k];
        if (patch > 0.55) col = [col[0] + (dry[0] - col[0]) * 0.4, col[1] + (dry[1] - col[1]) * 0.4, col[2] + (dry[2] - col[2]) * 0.4];
        // Farther is hazier.
        const haze = (1 - z) * 0.35;
        const sk = mixRgb(L.sky[2], L.sky[2], 0);
        const f = 0.92 + n * 0.1 + roll;
        const o4 = (py * c.width + px) * 4;
        img.data[o4] = (col[0] * (1 - haze) + sk[0] * haze) * f;
        img.data[o4 + 1] = (col[1] * (1 - haze) + sk[1] * haze) * f;
        img.data[o4 + 2] = (col[2] * (1 - haze) + sk[2] * haze) * f;
        img.data[o4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // The far edge melts into the haze under the ranges.
    const floorHaze = mixHex(L.ground[1], L.sky[2], 0.4);
    const fade = g.createLinearGradient(0, 0, 0, 90 * GS);
    fade.addColorStop(0, hexA(floorHaze, 1));
    fade.addColorStop(0.25, hexA(floorHaze, 0.85));
    fade.addColorStop(1, hexA(floorHaze, 0));
    g.fillStyle = fade;
    g.fillRect(0, 0, c.width, 90 * GS);
    const toY = (z: number) => (groundY(z) - (GY0 - 20)) * GS;
    // Water: the lake, the river.
    g.fillStyle = L.water;
    if (world.lake) {
      const lk = world.lake;
      g.beginPath();
      g.ellipse(((lk.x0 + lk.x1) / 2) * GS, (toY(lk.z0) + toY(lk.z1)) / 2, ((lk.x1 - lk.x0) / 2) * GS, (toY(lk.z1) - toY(lk.z0)) / 2 + 4, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = hexA('#ffffff', 0.25);
      g.lineWidth = 1.5;
      g.stroke();
    }
    if (world.river) {
      const rv = world.river;
      g.beginPath();
      for (let k = 0; k <= 80; k++) {
        const z = k / 80;
        const w = rv.width * (0.5 + z * 0.8);
        (k ? g.lineTo : g.moveTo).call(g, (rv.at(z) - w) * GS, toY(z));
      }
      for (let k = 80; k >= 0; k--) {
        const z = k / 80;
        const w = rv.width * (0.5 + z * 0.8);
        g.lineTo((rv.at(z) + w) * GS, toY(z));
      }
      g.closePath();
      g.fill();
      g.strokeStyle = hexA('#ffffff', 0.18);
      g.lineWidth = 1;
      g.stroke();
    }
    // The road.
    g.strokeStyle = hexA('#b89a70', 0.75);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    world.road.forEach(([x, z], k) => (k ? g.lineTo : g.moveTo).call(g, x * GS, toY(z)));
    g.lineWidth = 9 * GS;
    g.stroke();
    g.strokeStyle = hexA('#d6c3a5', 0.5);
    g.lineWidth = 4 * GS;
    g.stroke();
    // A bridge where it crosses the river.
    if (world.river) for (let k = 0; k < world.road.length - 1; k++) {
      const [ax, az] = world.road[k];
      const [bx, bz] = world.road[k + 1];
      for (let j = 0; j <= 40; j++) {
        const u = j / 40;
        const x = ax + (bx - ax) * u;
        const z = az + (bz - az) * u;
        if (Math.abs(world.river.at(z) - x) < world.river.width * 0.4) {
          g.fillStyle = '#7c5a36';
          g.fillRect((x - world.river.width * 1.2) * GS, toY(z) - 4, world.river.width * 2.4 * GS, 8);
          g.fillStyle = '#5c3d24';
          g.fillRect((x - world.river.width * 1.2) * GS, toY(z) - 5, world.river.width * 2.4 * GS, 1.5);
          j = 41;
          k = world.road.length;
        }
      }
    }
    groundCanvas = c;
  }
  function ground(t: number, night: number) {
    if (!groundCanvas) paintGround();
    const c = groundCanvas!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, SX(0), SY(GY0 - 20), (c.width / GS) * Z, (c.height / GS) * Z);
    // Winter: snow over all.
    if (winter() && world.biome !== 'canyon' && world.biome !== 'ashland') {
      ctx.fillStyle = 'rgba(236,242,248,0.55)';
      ctx.fillRect(SX(0), SY(GY0 - 20), GW * Z, (GH - GY0 + 20) * Z);
    }
    // Water shimmer.
    if (world.river) for (let k = 0; k < 30; k++) {
      const z = ((hash(k, 4) + t * 0.02) % 1);
      const x = world.river.at(z) + (hash(k, 5) - 0.5) * world.river.width;
      R(x, groundY(z), 4 * depth(z), 1, hexA('#ffffff', 0.3 + 0.2 * Math.sin(t * 3 + k)));
    }
    if (night > 0.6) {
      ctx.fillStyle = `rgba(4,6,16,${(0.18 * night).toFixed(3)})`;
      ctx.fillRect(0, SY(GY0 - 20), W, H);
    }
  }
  /** Fields in their season: furrows, green, gold, stubble, snow; burnt, frozen, blighted. */
  function fields() {
    for (const f of world.fields) {
      if (!onScreen((f.x0 + f.x1) / 2, groundY(f.z0), 200)) continue;
      const y0 = groundY(f.z0);
      const y1 = groundY(f.z1);
      let col = '#8a6a48';
      if (f.burnt > 0.5) col = '#2a221e';
      else if (f.frozen > 0.5) col = '#dbe7f2';
      else if (f.blight > 0.5) col = '#5a4a3a';
      else if (winter()) col = '#e2e8f0';
      else if (world.season === 2) col = f.harvested > 0.6 ? '#c9b27a' : ['#d4a937', '#c9a227', '#b8a03a'][f.crop];
      else if (f.grown > 0.05) col = mixHex('#8a6a48', mixHex(['#6a9a3a', '#8a9a40', '#5a8a46'][f.crop], L.ground[1], 0.35), Math.min(1, f.grown * 1.6));
      else if (f.plowed < 0.5) col = mixHex('#8a9a5a', '#8a6a48', f.plowed * 2);
      const skew = (f.x1 - f.x0) * 0.04;
      poly([f.x0 + skew, y0, f.x1 + skew, y0, f.x1, y1, f.x0, y1], col);
      // Furrows or rows, along the depth.
      if (!winter() && f.burnt < 0.5) {
        ctx.strokeStyle = 'rgba(0,0,0,0.13)';
        ctx.lineWidth = Math.max(0.6, Z * 0.6);
        ctx.beginPath();
        const n = Math.round((f.x1 - f.x0) / 9);
        for (let k = 1; k < n; k++) {
          const u = k / n;
          ctx.moveTo(SX(f.x0 + skew + (f.x1 - f.x0) * u), SY(y0));
          ctx.lineTo(SX(f.x0 + (f.x1 - f.x0) * u), SY(y1));
        }
        ctx.stroke();
      }
      // Sheaves standing in the stubble.
      if (world.season === 2 && f.harvested > 0.3) for (let k = 0; k < 6; k++) {
        const x = f.x0 + hash(f.id, k) * (f.x1 - f.x0);
        const y = y0 + hash(f.id, k, 2) * (y1 - y0);
        poly([x - 2, y, x, y - 5, x + 2, y], '#e0b84a');
      }
    }
  }

  // ---- things that stand ----------------------------------------------------------------------------
  function tree(tr: Tree, t: number) {
    const k = depth(tr.z);
    const x = tr.x;
    const y = groundY(tr.z);
    const s = k * (0.85 + hash(tr.seed, 1) * 0.5);
    const sway = Math.sin(t * 0.9 + tr.seed) * 0.6 * s;
    shadow(x + 3 * s, y, 6 * s, 1.8 * s, 0.2);
    if (tr.felled >= 0) {
      R(x - 1.5 * s, y - 2 * s, 3 * s, 2 * s, '#7c5a36');
      return;
    }
    const burnt = tr.burnt >= 0;
    const snow = winter() && !burnt;
    switch (burnt ? 'dead' : tr.kind) {
      case 'pine': {
        R(x - 1 * s, y - 5 * s, 2 * s, 5 * s, '#4a3520');
        const c = snow ? '#3a5048' : '#2f5a3a';
        for (let j = 0; j < 3; j++) poly([x - (8 - j * 2) * s, y - (4 + j * 7) * s, x + sway, y - (16 + j * 7) * s, x + (8 - j * 2) * s, y - (4 + j * 7) * s], j % 2 ? mixHex(c, '#ffffff', 0.08) : c);
        if (snow) poly([x - 3 * s, y - 25 * s, x + sway, y - 30 * s, x + 3 * s, y - 25 * s], '#f1f5f9');
        break;
      }
      case 'cactus':
        R(x - 1.5 * s, y - 14 * s, 3 * s, 14 * s, '#4d7c0f');
        R(x - 5 * s, y - 10 * s, 2 * s, 5 * s, '#4d7c0f');
        R(x + 3 * s, y - 12 * s, 2 * s, 6 * s, '#4d7c0f');
        break;
      case 'dead':
        ctx.strokeStyle = burnt ? '#1c1917' : '#4a3a30';
        ctx.lineWidth = Math.max(1, 1.4 * s * Z);
        ctx.beginPath();
        ctx.moveTo(SX(x), SY(y));
        ctx.lineTo(SX(x + sway), SY(y - 16 * s));
        ctx.moveTo(SX(x), SY(y - 8 * s));
        ctx.lineTo(SX(x - 5 * s), SY(y - 13 * s));
        ctx.moveTo(SX(x), SY(y - 11 * s));
        ctx.lineTo(SX(x + 5 * s), SY(y - 15 * s));
        ctx.stroke();
        if (burnt && world.t - tr.burnt < 20) lit(x, y - 10 * s, 12 * s, '#f97316', 0.4);
        break;
      default: {
        R(x - 1.2 * s, y - 8 * s, 2.4 * s, 8 * s, tr.kind === 'birch' ? '#e7e5e4' : '#5c3d24');
        const c = snow ? '#9aa6a0' : world.season === 2 ? ['#a16207', '#b45309', '#4d7c0f'][tr.seed % 3] : tr.kind === 'birch' ? '#7aa63e' : '#3f6b2f';
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(SX(x + sway), SY(y - 13 * s), 7 * s * Z, 0, Math.PI * 2);
        ctx.arc(SX(x - 4 * s + sway), SY(y - 10 * s), 5 * s * Z, 0, Math.PI * 2);
        ctx.arc(SX(x + 4 * s + sway), SY(y - 10 * s), 5 * s * Z, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,230,0.14)';
        ctx.beginPath();
        ctx.arc(SX(x - 2 * s + sway), SY(y - 15 * s), 3.5 * s * Z, 0, Math.PI * 2);
        ctx.fill();
        if (snow) R(x - 5 * s + sway, y - 20 * s, 10 * s, 2 * s, '#f1f5f9');
      }
    }
  }
  function building(b: Building, t: number, night: number) {
    const k = depth(b.z);
    const x = b.x;
    const y = groundY(b.z);
    const w = b.w * k;
    const wall = L.wall[b.variant % L.wall.length];
    const roof = winter() && b.state === 'standing' ? '#e8eef4' : L.roof[(b.variant + b.seed) % L.roof.length];
    const dk = (c: string, a = 0.3) => mixHex(c, '#000000', a);
    const lt = (c: string, a = 0.2) => mixHex(c, '#ffffff', a);
    if (b.state === 'plot') {
      for (const dx of [-0.5, 0.5]) R(x + dx * w, y - 4 * k, 1.2 * k, 4 * k, '#7c5a36');
      R(x - w / 2, y - 1, w, 1, hexA('#7c5a36', 0.6));
      return;
    }
    shadow(x + w * 0.2, y, w * 0.65, 3 * k, 0.25);
    const ruin = b.state === 'ruin';
    const prog = b.state === 'building' ? b.progress : 1;
    const H0 = (hh: number) => hh * k * (ruin ? 0.45 : prog);
    const windowLit = night > 0.3 && !ruin && b.fire <= 0 && hash(b.seed, Math.floor(world.t / 30)) < 0.75;
    const win = (wx: number, wyy: number) => {
      R(wx, wyy, 2 * k, 2.5 * k, windowLit ? '#fde68a' : dk(wall, 0.6));
      if (windowLit) lit(wx + k, wyy + k, 7 * k, '#f59e0b', 0.4 * night);
    };
    const house = (bw: number, hh: number, rh: number) => {
      const h1 = H0(hh);
      R(x - bw / 2, y - h1, bw, h1, ruin ? dk(wall, 0.45) : wall);
      R(x + bw * 0.15, y - h1, bw * 0.35, h1, dk(wall, 0.15));
      if (!ruin && prog >= 1) {
        poly([x - bw / 2 - 2 * k, y - h1, x - bw * 0.1, y - h1 - rh * k, x + bw * 0.1, y - h1 - rh * k, x + bw / 2 + 2 * k, y - h1], roof);
        poly([x - bw / 2 - 2 * k, y - h1, x - bw * 0.1, y - h1 - rh * k, x - bw * 0.05, y - h1 - rh * k, x - bw * 0.15, y - h1], lt(roof, 0.15));
        win(x - bw * 0.3, y - h1 * 0.65);
        R(x + bw * 0.05, y - h1 * 0.55, 2.5 * k, h1 * 0.55, dk(wall, 0.5));
        // Chimney smoke.
        if (b.fire <= 0 && hash(b.seed, 3) < 0.6) {
          R(x + bw * 0.25, y - h1 - rh * k * 0.7, 2 * k, rh * k * 0.5, dk(wall, 0.2));
          for (let j = 0; j < 3; j++) {
            const a = (t * 0.35 + j / 3 + hash(b.seed, j)) % 1;
            ctx.fillStyle = `rgba(210,210,210,${((winter() ? 0.35 : 0.2) * (1 - a)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(SX(x + bw * 0.25 + a * 8 * k), SY(y - h1 - rh * k * 0.8 - a * 18 * k), (1.5 + a * 3) * k * Z, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (b.state === 'building') scaffold(x, y, bw, h1 + rh * k);
      else if (ruin) {
        poly([x - bw / 2, y - h1, x - bw / 4, y - h1 - 4 * k, x, y - h1], dk(wall, 0.5));
      }
    };
    switch (b.kind) {
      case 'house':
      case 'farmhouse':
      case 'inn':
      case 'granary':
      case 'smithy':
        house(w, b.kind === 'inn' ? 16 : b.kind === 'granary' ? 13 : 11, b.kind === 'granary' ? 6 : 8);
        if (b.kind === 'inn' && b.state === 'standing') R(x + w / 2, y - 12 * k, 4 * k, 3 * k, '#a16207');
        if (b.kind === 'smithy' && b.state === 'standing') lit(x, y - 4 * k, 14 * k, '#f97316', 0.4);
        if (b.kind === 'farmhouse' && b.state === 'standing') R(x + w / 2 + 2 * k, y - 8 * k, 8 * k, 8 * k, '#7c5a36');
        break;
      case 'church': {
        house(w, 16, 9);
        if (b.state === 'standing') {
          R(x - w * 0.55, y - 30 * k, 7 * k, 30 * k, wall);
          poly([x - w * 0.55 - 1 * k, y - 30 * k, x - w * 0.55 + 3.5 * k, y - 44 * k, x - w * 0.55 + 8 * k, y - 30 * k], roof);
          R(x - w * 0.55 + 3 * k, y - 50 * k, 1 * k, 6 * k, '#d4a017');
          R(x - w * 0.55 + 1.5 * k, y - 48 * k, 4 * k, 1 * k, '#d4a017');
          if (night > 0.3) lit(x, y - 10 * k, 18 * k, '#fde68a', 0.35);
        }
        break;
      }
      case 'keep': {
        const h1 = H0(46);
        R(x - w / 2, y - h1, w, h1, ruin ? dk(L.rock, 0.3) : mixHex(L.rock, '#e7e5e4', 0.4));
        R(x + w * 0.1, y - h1, w * 0.4, h1, mixHex(L.rock, '#78716c', 0.4));
        if (!ruin && prog >= 1) {
          for (let j = 0; j < 6; j++) R(x - w / 2 + j * (w / 6), y - h1 - 4 * k, w / 12, 4 * k, mixHex(L.rock, '#e7e5e4', 0.3));
          for (const tx of [-0.5, 0.5]) {
            R(x + tx * w - 6 * k, y - h1 - 18 * k, 12 * k, h1 + 18 * k, mixHex(L.rock, '#d6d3d1', 0.4));
            poly([x + tx * w - 8 * k, y - h1 - 18 * k, x + tx * w, y - h1 - 32 * k, x + tx * w + 8 * k, y - h1 - 18 * k], roof);
            R(x + tx * w, y - h1 - 44 * k, 1 * k, 12 * k, '#57534e');
            poly([x + tx * w + 1 * k, y - h1 - 44 * k, x + tx * w + 12 * k + Math.sin(t * 3 + tx) * 2 * k, y - h1 - 41 * k, x + tx * w + 1 * k, y - h1 - 38 * k], '#b91c1c');
          }
          for (let j = 0; j < 4; j++) win(x - w * 0.3 + j * w * 0.18, y - h1 * 0.6);
          R(x - 5 * k, y - 14 * k, 10 * k, 14 * k, '#3f2a17');
        }
        break;
      }
      case 'wall':
        if (b.ax !== b.bx || b.az !== b.bz) {
          // A run of wall, end to end: stone round the town, timber round a village.
          const town = world.settlements[b.settle].kind === 'town';
          const stone = town ? mixHex(L.rock, '#d6d3d1', 0.35) : '#8a6a44';
          const ka = depth(b.az);
          const kb = depth(b.bz);
          const ya = groundY(b.az);
          const yb = groundY(b.bz);
          const ha = (town ? 16 : 11) * ka * (ruin ? 0.45 : prog);
          const hb = (town ? 16 : 11) * kb * (ruin ? 0.45 : prog);
          const face = b.bz > b.az ? mixHex(stone, '#000000', 0.18) : stone;
          poly([b.ax, ya, b.bx, yb, b.bx, yb - hb, b.ax, ya - ha], ruin ? dk(stone, 0.35) : face);
          poly([b.ax, ya - ha, b.bx, yb - hb, b.bx, yb - hb - 2 * kb, b.ax, ya - ha - 2 * ka], lt(stone, 0.2));
          if (!ruin && prog >= 1) {
            const n = Math.max(1, Math.round(Math.hypot(b.bx - b.ax, yb - ya) / (town ? 7 : 4)));
            for (let j = 0; j < n; j += 2) {
              const u = (j + 0.5) / n;
              const cx = b.ax + (b.bx - b.ax) * u;
              const cy = ya - ha + (yb - hb - ya + ha) * u;
              const kk = ka + (kb - ka) * u;
              if (town) R(cx - 1.6 * kk, cy - 5 * kk, 3.2 * kk, 3.5 * kk, stone);
              else poly([cx - 1.4 * kk, cy - 1, cx, cy - 4 * kk, cx + 1.4 * kk, cy - 1], '#7c5a36');
            }
          }
          if (b.state === 'building') scaffold(b.x, (ya + yb) / 2, Math.abs(b.bx - b.ax), Math.max(ha, hb));
          break;
        }
        break;
      case 'gatehouse': {
        const h1 = H0(b.kind === 'gatehouse' ? 26 : 16);
        const stone = mixHex(L.rock, '#d6d3d1', 0.35);
        R(x - w / 2, y - h1, w, h1, ruin ? dk(stone, 0.35) : stone);
        R(x - w / 2, y - h1, w, 2 * k, lt(stone, 0.2));
        if (!ruin && prog >= 1) for (let j = 0; j < 5; j++) R(x - w / 2 + j * (w / 5), y - h1 - 3 * k, w / 10, 3 * k, stone);
        if (b.kind === 'gatehouse' && !ruin) {
          R(x - 5 * k, y - 12 * k, 10 * k, 12 * k, '#292524');
          R(x - 8 * k, y - h1 - 8 * k, 16 * k, 8 * k, stone);
        }
        if (b.state === 'building') scaffold(x, y, w, h1 + 4 * k);
        break;
      }
      case 'tower': {
        const h1 = H0(b.variant === 9 ? 40 : 30);
        const stone = b.variant === 9 ? '#6d28d9' : mixHex(L.rock, '#d6d3d1', 0.25);
        R(x - 5 * k, y - h1, 10 * k, h1, stone);
        R(x + 1 * k, y - h1, 4 * k, h1, dk(stone, 0.25));
        if (!ruin && prog >= 1) {
          if (b.variant === 9) {
            poly([x - 7 * k, y - h1, x, y - h1 - 16 * k, x + 7 * k, y - h1], '#4c1d95');
            lit(x, y - h1 - 18 * k, 12 * k, '#c4b5fd', 0.5 + 0.2 * Math.sin(t * 2));
          } else {
            R(x - 7 * k, y - h1 - 3 * k, 14 * k, 3 * k, stone);
            // The beacon.
            const on = b.beacon >= 0 && world.t - b.beacon < 45;
            R(x - 3 * k, y - h1 - 6 * k, 6 * k, 3 * k, '#3f3f46');
            if (on) {
              for (let j = 0; j < 5; j++) {
                const a = (t * 2 + j / 5) % 1;
                ctx.fillStyle = hexA(a < 0.3 ? '#fef3c7' : a < 0.6 ? '#fb923c' : '#dc2626', 0.9 * (1 - a));
                ctx.beginPath();
                ctx.arc(SX(x + Math.sin(j * 2 + t * 5) * 2 * k), SY(y - h1 - 8 * k - a * 14 * k), (4 - a * 2.5) * k * Z, 0, Math.PI * 2);
                ctx.fill();
              }
              lit(x, y - h1 - 10 * k, 50 * k, '#f97316', 0.75);
            }
          }
        }
        break;
      }
      case 'mill': {
        house(w * 0.7, 18, 7);
        if (b.state === 'standing') {
          const hub = [x, y - 22 * k] as const;
          ctx.strokeStyle = '#d6c3a5';
          ctx.lineWidth = Math.max(1, 1.6 * k * Z);
          ctx.beginPath();
          const a0 = t * 0.8 + b.seed;
          for (let j = 0; j < 4; j++) {
            const a = a0 + (j * Math.PI) / 2;
            ctx.moveTo(SX(hub[0]), SY(hub[1]));
            ctx.lineTo(SX(hub[0] + Math.cos(a) * 16 * k), SY(hub[1] + Math.sin(a) * 16 * k));
          }
          ctx.stroke();
        }
        break;
      }
      case 'ballista': {
        const h1 = H0(22);
        R(x - 6 * k, y - h1, 12 * k, h1, '#7c5a36');
        R(x - 6 * k, y - h1, 12 * k, 2 * k, '#a16207');
        if (b.state === 'standing') {
          ctx.strokeStyle = '#3f2a17';
          ctx.lineWidth = Math.max(1, 1.5 * k * Z);
          ctx.beginPath();
          ctx.moveTo(SX(x - 9 * k), SY(y - h1 - 4 * k));
          ctx.quadraticCurveTo(SX(x), SY(y - h1 - 1 * k), SX(x + 9 * k), SY(y - h1 - 4 * k));
          ctx.moveTo(SX(x), SY(y - h1));
          ctx.lineTo(SX(x + 3 * k), SY(y - h1 - 10 * k));
          ctx.stroke();
        } else if (b.state === 'building') scaffold(x, y, 12 * k, h1);
        break;
      }
      case 'stall': {
        R(x - w / 2, y - 6 * k, w, 6 * k, '#7c5a36');
        const fair = world.fair > world.t;
        for (let j = 0; j < 4; j++) R(x - w / 2 + j * (w / 4), y - 10 * k, w / 4, 3 * k, j % 2 ? '#f5f5f4' : ['#b91c1c', '#1d4ed8', '#15803d', '#a16207'][b.variant]);
        if (fair) for (let j = 0; j < 3; j++) R(x - w / 2 + j * 5 * k, y - 8 * k, 3 * k, 2 * k, ['#facc15', '#f87171', '#a3e635'][j]);
        break;
      }
      case 'shrine':
        for (let j = 0; j < 5; j++) R(x - w / 2 + j * (w / 4) - 1.5 * k, y - 10 * k, 3 * k, 10 * k, mixHex(L.rock, '#ffffff', 0.25));
        R(x - w / 2, y - 12 * k, w, 2 * k, mixHex(L.rock, '#ffffff', 0.25));
        lit(x, y - 6 * k, 20 * k, '#fde68a', 0.25 + 0.1 * Math.sin(t));
        break;
      case 'mine':
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.ellipse(SX(x), SY(y), 14 * k * Z, 12 * k * Z, 0, Math.PI, 0);
        ctx.fill();
        R(x - 15 * k, y - 13 * k, 3 * k, 13 * k, '#7c5a36');
        R(x + 12 * k, y - 13 * k, 3 * k, 13 * k, '#7c5a36');
        R(x - 15 * k, y - 15 * k, 30 * k, 3 * k, '#7c5a36');
        lit(x, y - 4 * k, 12 * k, '#f59e0b', 0.4);
        break;
      case 'dock':
        R(x - w / 2, y - 2 * k, w, 3 * k, '#7c5a36');
        for (let j = 0; j < 5; j++) R(x - w / 2 + j * (w / 4), y - 2 * k, 1.5 * k, 7 * k, '#5c3d24');
        break;
      case 'lists': {
        // The tilt barrier, the stands, the pavilions and their pennants.
        R(x - w / 2, y - 4 * k, w, 1.5 * k, '#a16207');
        for (let j = 0; j <= 8; j++) R(x - w / 2 + j * (w / 8), y - 6 * k, 1.2 * k, 6 * k, '#7c5a36');
        for (const side of [-1, 1]) {
          const px = x + side * (w / 2 + 10 * k);
          poly([px - 8 * k, y, px, y - 16 * k, px + 8 * k, y], side < 0 ? '#b91c1c' : '#1d4ed8');
          poly([px - 8 * k, y, px - 3 * k, y - 10 * k, px, y - 16 * k, px, y], '#f5f5f4');
          R(px, y - 24 * k, 1 * k, 8 * k, '#57534e');
          R(px + 1 * k, y - 24 * k, 6 * k + Math.sin(t * 3 + side) * k, 3 * k, side < 0 ? '#facc15' : '#ffffff');
        }
        break;
      }
      default:
        house(w, 11, 8);
    }
    // Fire, frost, blight on it.
    if (b.fire > 0) {
      for (let j = 0; j < 7; j++) {
        const a = (t * 1.6 + j / 7 + hash(b.seed, j)) % 1;
        ctx.fillStyle = hexA(a < 0.3 ? '#fef3c7' : a < 0.6 ? '#fb923c' : '#dc2626', 0.9 * (1 - a) * Math.min(1, b.fire * 2));
        ctx.beginPath();
        ctx.arc(SX(x + (hash(b.seed, j, 2) - 0.5) * w), SY(y - 10 * k - a * 22 * k * (0.5 + b.fire)), (4 - a * 2.5) * k * Z * (0.6 + b.fire), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let j = 0; j < 3; j++) {
        const a = (t * 0.4 + j / 3) % 1;
        ctx.fillStyle = `rgba(50,45,45,${(0.45 * (1 - a)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(SX(x + a * 14 * k), SY(y - 24 * k - a * 50 * k), (5 + a * 10) * k * Z, 0, Math.PI * 2);
        ctx.fill();
      }
      lit(x, y - 12 * k, 40 * k * (0.5 + b.fire), '#f97316', 0.7 * b.fire + 0.2);
    }
    if (b.frozen > 0.1) {
      ctx.fillStyle = hexA('#dbeafe', 0.5 * b.frozen);
      ctx.fillRect(SX(x - w / 2 - 2 * k), SY(y - 20 * k), (w + 4 * k) * Z, 20 * k * Z);
    }
    if (b.blight > 0.1) {
      ctx.fillStyle = hexA('#3f6212', 0.4 * b.blight);
      ctx.fillRect(SX(x - w / 2), SY(y - 16 * k), w * Z, 16 * k * Z);
    }
  }
  function scaffold(x: number, y: number, w: number, h: number) {
    ctx.strokeStyle = 'rgba(160,120,70,0.9)';
    ctx.lineWidth = Math.max(0.8, 0.8 * Z);
    ctx.beginPath();
    for (const dx of [-0.55, 0, 0.55]) {
      ctx.moveTo(SX(x + dx * w), SY(y));
      ctx.lineTo(SX(x + dx * w), SY(y - h - 3));
    }
    for (let k = 4; k < h + 3; k += 6) {
      ctx.moveTo(SX(x - 0.55 * w), SY(y - k));
      ctx.lineTo(SX(x + 0.55 * w), SY(y - k));
    }
    ctx.stroke();
  }

  // ---- people and beasts --------------------------------------------------------------------------
  function beast(b: Beast) {
    if (!b.alive || b.carried) return;
    const k = depth(b.z);
    const x = b.x;
    const y = groundY(b.z);
    const f = Math.sin(b.seed) > 0 ? 1 : -1;
    const step = Math.sin(b.anim * 3) * 0.5;
    shadow(x, y, 4 * k, 1.2 * k, 0.2);
    const body = b.kind === 'cow' ? (b.seed % 3 ? '#78553a' : '#e7e5e4') : b.kind === 'sheep' ? '#f5f5f4' : '#a8a29e';
    R(x - 4 * k, y - 6 * k, 8 * k, 4 * k, body);
    if (b.kind === 'cow' && b.seed % 3 === 0) R(x - 1 * k, y - 6 * k, 3 * k, 2 * k, '#292524');
    R(x - 3.5 * k, y - 2 * k, 1.2 * k, 2 * k + step, '#3f3f46');
    R(x + 2.5 * k, y - 2 * k, 1.2 * k, 2 * k - step, '#3f3f46');
    R(x + f * 4 * k - (f < 0 ? 3 * k : 0), y - 8 * k, 3 * k, 3 * k, b.kind === 'sheep' ? '#3f3f46' : body);
  }
  function personDraw(p: Person, t: number) {
    if (p.hidden) return;
    const k = depth(p.z) * (p.kind === 'child' ? 0.7 : p.kind === 'giant' ? 3.4 : p.kind === 'troll' ? 2.2 : 1);
    let x = p.x;
    let y = groundY(p.z);
    // On the spire path.
    if ((p.kind === 'hero' || p.kind === 'thief') && (p.task === 'climb' || p.task === 'cave' || p.task === 'descend')) {
      const pts = world.spire.path;
      const u = Math.max(0, Math.min(0.999, p.k)) * (pts.length - 1);
      const i = Math.floor(u);
      const f = u - i;
      x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
      y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
    }
    y -= p.h * depth(p.z);
    const f = p.facing;
    const walking = Math.abs(p.x - p.tx) + Math.abs(p.z - p.tz) * 900 > 1;
    const step = walking ? Math.sin(p.anim) : 0;
    const swing = world.t - p.swing < 0.4 ? Math.sin(t * 14) : 0;
    const Rk = (dx: number, dy: number, w: number, h: number, c: string) => R(x + (f > 0 ? dx : -dx - w) * k, y + dy * k, w * k, h * k, c);
    if (!p.alive) {
      ctx.globalAlpha = Math.max(0, 1 - (world.t - p.deadAt) / 8);
      Rk(-4, -2, 8, 2, CLOTH[p.seed % CLOTH.length]);
      ctx.globalAlpha = 1;
      return;
    }
    shadow(p.x, groundY(p.z), (p.kind === 'knight' ? 6 : 3) * k, 1.2 * k, p.h > 5 ? 0.12 : 0.25);
    const cloth = p.kind === 'guard' || p.kind === 'archer' ? '#7f1d1d' : p.kind === 'priest' ? '#f5f5f4' : p.kind === 'pilgrim' ? '#d6d3d1' : p.kind === 'hero' ? '#1e3a8a' : p.kind === 'thief' ? '#1c1917' : p.kind === 'wizard' ? '#4c1d95' : p.kind === 'miner' ? '#57534e' : CLOTH[p.seed % CLOTH.length];
    if (p.kind === 'knight' || p.kind === 'rider' || p.kind === 'cart' || p.kind === 'hero') {
      if (p.kind === 'cart') {
        // An ox and a cart.
        Rk(-10, -7, 9, 5, '#7c5a36');
        Rk(-10, -9, 9, 2, p.carry === 'gold' ? '#facc15' : '#d6c3a5');
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(SX(x + (f > 0 ? -8 : 8) * k), SY(y - 1.5 * k), 1.6 * k * Z, 0, Math.PI * 2);
        ctx.arc(SX(x + (f > 0 ? -3 : 3) * k), SY(y - 1.5 * k), 1.6 * k * Z, 0, Math.PI * 2);
        ctx.fill();
        Rk(1, -6, 7, 4, '#78553a');
        Rk(7, -8, 3, 3, '#78553a');
        Rk(1, -2, 1, 2 + step * 0.5, '#3f2a17');
        Rk(6, -2, 1, 2 - step * 0.5, '#3f2a17');
        return;
      }
      if (p.kind === 'rider' && p.h > 4) {
        // A griffon: wings and an eagle's head.
        const wg = Math.sin(t * 9 + p.seed) * 5;
        poly([x - 2 * k, y - 8 * k, x - 10 * k, y - 16 * k - wg * k, x + 2 * k, y - 8 * k], '#a16207');
        Rk(-6, -9, 12, 5, '#ca8a04');
        Rk(5, -12, 4, 4, '#f5f5f4');
        Rk(9, -11, 2, 1, '#facc15');
        Rk(-1, -16, 3, 6, '#94a3b8');
        return;
      }
      // A horse and its rider.
      const horse = p.kind === 'hero' ? '#f5f5f4' : p.seed % 2 ? '#78553a' : '#292524';
      Rk(-6, -9, 12, 5, horse);
      Rk(5, -12, 3, 5, horse);
      Rk(7, -12, 2, 2, horse);
      Rk(-5, -4, 1.5, 4 + step, mixHex(horse, '#000000', 0.3));
      Rk(4, -4, 1.5, 4 - step, mixHex(horse, '#000000', 0.3));
      Rk(-7, -9, 2, 4, mixHex(horse, '#000000', 0.2));
      Rk(-6, -8, 12, 2, p.kind === 'hero' ? '#1e3a8a' : '#b91c1c');
      Rk(-1, -16, 3, 7, '#94a3b8');
      Rk(-1, -18, 3, 2, '#cbd5e1');
      if (p.task === 'sortie' || p.task === 'joust') {
        ctx.strokeStyle = '#d6c3a5';
        ctx.lineWidth = Math.max(1, 0.8 * k * Z);
        ctx.beginPath();
        ctx.moveTo(SX(x), SY(y - 12 * k));
        ctx.lineTo(SX(x + f * 18 * k), SY(y - 14 * k - swing * 2 * k));
        ctx.stroke();
      } else Rk(0, -24, 0.8, 8, '#d6c3a5');
      Rk(-4, -14, 2.5, 4, '#57534e');
      return;
    }
    if (p.kind === 'giant' || p.kind === 'troll') {
      const skin = p.kind === 'troll' ? '#4d7c0f' : '#a8a29e';
      Rk(-3, -5, 2.5, 5 + step, skin);
      Rk(1, -5, 2.5, 5 - step, skin);
      Rk(-4, -14, 9, 9, p.kind === 'troll' ? '#3f6212' : '#78716c');
      Rk(-2, -18, 5, 4, skin);
      Rk(4, -14 - swing * 3, 2, 7, skin);
      return;
    }
    // On foot.
    Rk(-1.5, -3, 1.2, 3 + step * 0.6, '#3f2a17');
    Rk(0.4, -3, 1.2, 3 - step * 0.6, '#3f2a17');
    Rk(-2, -8, 4, 5, cloth);
    Rk(-1.3, -10.5, 2.6, 2.6, SKIN[p.seed % SKIN.length]);
    if (p.kind === 'priest' || p.kind === 'wizard' || p.kind === 'pilgrim') Rk(-2.4, -3, 4.8, 3, cloth);
    if (p.kind === 'wizard') {
      poly([x - 3 * k, y - 10.5 * k, x + f * 1 * k, y - 18 * k, x + 3 * k, y - 10.5 * k], '#4c1d95');
      Rk(3, -13, 0.8, 13, '#78553a');
      lit(x + f * 3.4 * k, y - 13 * k, 8 * k, '#c4b5fd', world.t - p.swing < 1 ? 0.8 : 0.35);
    }
    if (p.kind === 'guard' || p.kind === 'archer') Rk(-1.4, -11.5, 2.8, 1.2, '#94a3b8');
    if (p.kind === 'farmer' || p.kind === 'shepherd') Rk(-2.5, -11, 5, 1, '#d6b46a');
    // Tools and loads.
    const up = swing > 0;
    switch (p.carry) {
      case 'sheaf':
        Rk(1.5, -12, 2.5, 5, '#e0b84a');
        break;
      case 'log':
        Rk(-4, -11, 9, 1.8, '#7c5a36');
        break;
      case 'bucket':
        Rk(2, -5, 2, 2, '#57534e');
        break;
      case 'ore':
        Rk(2, -6, 2.5, 2.5, '#52525b');
        break;
      default:
        if (p.kind === 'woodcutter' || p.kind === 'builder' || p.kind === 'miner') {
          Rk(2, up ? -12 : -9, 0.8, 5, '#78553a');
          Rk(up ? 1.5 : 2, up ? -13 : -10, 2.5, 1.2, '#a8a29e');
        } else if (p.kind === 'farmer' && (p.task === 'plow' || p.task === 'reap' || p.task === 'tend')) {
          Rk(2, -9 + (up ? -2 : 0), 0.8, 7, '#78553a');
          Rk(2, -3 + (up ? -2 : 0), 3, 1, '#a8a29e');
        } else if (p.kind === 'shepherd' || p.kind === 'pilgrim') Rk(2, -12, 0.8, 12, '#78553a');
        else if (p.kind === 'archer') Rk(2, -10, 1, 7, '#78553a');
        else if (p.kind === 'guard') Rk(2, -14, 0.8, 14, '#a8a29e');
        else if (p.kind === 'thief') Rk(-2, -7, 4, 2, '#292524');
    }
    if (p.task === 'festival' && darkness() > 0) lit(x, y - 10 * k, 6 * k, '#fde68a', 0.4);
  }

  // ---- dragons ---------------------------------------------------------------------------------------
  function dragonDraw(d: Dragon, t: number) {
    // Dragons are big at any distance: the wyrm on its spire is half the picture's drama.
    const k = Math.max(0.8, depth(d.z)) * (d.kind === 'drake' || d.kind === 'hatchling' ? 0.72 : 1.25) * (d.kind === 'hatchling' ? 0.6 : 1);
    const X = SX(d.x);
    const Y = SY(wy(d.z, d.h));
    const u = k * Z * 2.2;
    if (X < -u * 30 || X > W + u * 30 || Y < -u * 20 || Y > H + u * 20) return;
    const col = DRAGON[d.kind === 'rival' ? d.color : BREED_COLOR[d.breed] ?? d.color];
    const f = d.facing;
    const perched = d.state === 'sleep' || d.state === 'bask' || d.state === 'roost' || d.state === 'cavefight';
    const dead = !d.alive && d.h <= 2;
    // Its shadow on the ground, when aloft.
    if (d.h > 20 && !dead) {
      const gy = SY(groundY(d.z));
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.06, 0.25 - d.h / 2000).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(X, gy, u * 10, u * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    if (dead) ctx.globalAlpha = 0.85;
    if (perched && d.state === 'sleep') {
      // Coiled, wings folded, tail wrapped round.
      ctx.fillStyle = col.body;
      ctx.beginPath();
      ctx.ellipse(X, Y - u * 2, u * 6, u * 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col.body;
      ctx.lineWidth = u * 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(X, Y - u * 1.5, u * 6.5, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.fillStyle = col.dark;
      ctx.beginPath();
      ctx.moveTo(X - u * 4, Y - u * 4);
      ctx.lineTo(X + u * 2, Y - u * 7 - Math.sin(t * 0.8) * u * 0.5);
      ctx.lineTo(X + u * 5, Y - u * 3);
      ctx.fill();
      ctx.fillStyle = col.body;
      ctx.beginPath();
      ctx.ellipse(X + f * u * 6, Y - u * 2.2, u * 2, u * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Smoke from the nostrils as it breathes.
      const a = (t * 0.3) % 1;
      ctx.fillStyle = `rgba(200,200,200,${(0.3 * (1 - a)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(X + f * u * (8 + a * 4), Y - u * (3 + a * 6), u * (0.8 + a * 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const flap = perched ? 0.15 + Math.sin(d.wing * 0.4) * 0.15 : Math.sin(d.wing);
    const spread = d.state === 'bask' ? 1.25 : 1;
    for (const back of [1, 0]) {
      const lift = flap * (back ? 0.8 : 1);
      const sx = X + f * u * (back ? 1.5 : -0.5);
      const syy = Y - u;
      const ex = sx - f * u * 3 * spread;
      const ey = syy - u * (3 + lift * 5) * spread;
      const tips = [[ex - f * u * 4 * spread, ey - u * (1 + lift * 2)], [ex - f * u * 6.5 * spread, ey + u * (1.5 - lift)], [ex - f * u * 7 * spread, ey + u * (4.5 - lift * 2)], [sx - f * u * 6, syy + u * 1.2]];
      ctx.fillStyle = back ? col.dark : mixHex(col.body, col.dark, 0.4);
      ctx.beginPath();
      ctx.moveTo(sx, syy);
      ctx.lineTo(ex, ey);
      let px = ex;
      let py = ey;
      for (const [tx, ty] of tips) {
        ctx.quadraticCurveTo((px + tx) / 2 + f * u * 0.6, (py + ty) / 2 + u * 0.6, tx, ty);
        px = tx;
        py = ty;
      }
      ctx.quadraticCurveTo((px + sx) / 2, (py + syy) / 2 + u, sx, syy);
      ctx.fill();
      ctx.strokeStyle = col.dark;
      ctx.lineWidth = Math.max(1, u * 0.35);
      ctx.beginPath();
      ctx.moveTo(sx, syy);
      ctx.lineTo(ex, ey);
      for (const [tx, ty] of tips.slice(0, 3)) {
        ctx.moveTo(ex, ey);
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
    }
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.ellipse(X, Y, u * 5, u * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col.belly;
    ctx.beginPath();
    ctx.ellipse(X + f * u, Y + u * 0.8, u * 3.2, u * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col.body;
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 1.2;
    ctx.beginPath();
    ctx.moveTo(X - f * u * 4, Y);
    ctx.quadraticCurveTo(X - f * u * 10, Y + u * (2 + Math.sin(t * 2 + d.seed) * 2), X - f * u * 15, Y - u * (1 + Math.sin(t * 2 + 1 + d.seed)));
    ctx.stroke();
    ctx.lineWidth = u * 1.3;
    ctx.beginPath();
    ctx.moveTo(X + f * u * 4, Y - u * 0.5);
    ctx.quadraticCurveTo(X + f * u * 7, Y - u * 4, X + f * u * 9, Y - u * 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(X + f * u * 10, Y - u * 2.3, u * 1.8, u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.moveTo(X + f * u * 9.5, Y - u * 3);
    ctx.lineTo(X + f * u * 8, Y - u * 5);
    ctx.lineTo(X + f * u * 10.5, Y - u * 3.2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(X + f * u * 10.4, Y - u * 2.8, u * 0.5, u * 0.4);
    // Eyes and a warm belly-glow, so it reads against the night.
    glows.push([X + f * u * 10.4, Y - u * 2.6, u * 2.5, '#facc15', 0.6]);
    glows.push([X, Y, u * 9, BREATH[d.breed], 0.12]);
    // What it carries off.
    if (d.carry >= 0) {
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(X - u * 2, Y + u * 1.5, u * 4, u * 2);
    }
    // Breath.
    if (d.breathing > world.t) {
      const c = BREATH[d.breed];
      for (let j = 0; j < 12; j++) {
        const a = (t * 3 + j / 12) % 1;
        ctx.fillStyle = hexA(a < 0.3 ? '#ffffff' : c, 0.85 * (1 - a * 0.6));
        ctx.beginPath();
        ctx.arc(X + f * u * (11 + a * 16), Y - u * 2 + a * u * 9 + Math.sin(j * 7 + t * 9) * u * a * 2, u * (0.6 + a * 1.8), 0, Math.PI * 2);
        ctx.fill();
      }
      glows.push([X + f * u * 18, Y + u * 2, u * 18, c, 0.6]);
    }
    ctx.restore();
  }

  // ---- missiles, effects ------------------------------------------------------------------------------
  function missilesDraw(t: number) {
    for (const m of world.missiles) {
      const k = Math.min(1, (t - m.t0) / m.dur);
      const x = m.x + (m.x1 - m.x) * k;
      const z = m.z + (m.z1 - m.z) * k;
      const h = m.h + (m.h1 - m.h) * k + Math.sin(k * Math.PI) * (m.kind === 'rock' ? 80 : 20);
      const X = x;
      const Y = wy(z, h);
      if (m.kind === 'spell') {
        R(X - 2, Y - 2, 4, 4, '#ede9fe');
        lit(X, Y, 14, '#a78bfa', 0.8);
        continue;
      }
      if (m.kind === 'rock') {
        R(X - 4 * depth(z), Y - 4 * depth(z), 8 * depth(z), 8 * depth(z), '#78716c');
        continue;
      }
      const dx = (m.x1 - m.x) / Math.max(1, Math.hypot(m.x1 - m.x, wy(m.z1, m.h1) - wy(m.z, m.h)));
      const dy = (wy(m.z1, m.h1) - wy(m.z, m.h)) / Math.max(1, Math.hypot(m.x1 - m.x, wy(m.z1, m.h1) - wy(m.z, m.h)));
      ctx.strokeStyle = m.kind === 'bolt' ? '#57534e' : '#e7e5e4';
      ctx.lineWidth = Math.max(1, (m.kind === 'bolt' ? 2 : 1) * Z);
      ctx.beginPath();
      ctx.moveTo(SX(X), SY(Y));
      ctx.lineTo(SX(X - dx * (m.kind === 'bolt' ? 14 : 7)), SY(Y - dy * (m.kind === 'bolt' ? 14 : 7)));
      ctx.stroke();
    }
  }
  function effects(t: number) {
    for (const e of world.fx) {
      const k = (t - e.t0) / e.dur;
      if (k < 0 || k > 1) continue;
      const d = depth(e.z);
      const x = e.x;
      const y = wy(e.z, e.h);
      if (!onScreen(x, y, 60)) continue;
      const X = SX(x);
      const Y = SY(y);
      const rr = e.r * d * Z;
      switch (e.kind) {
        case 'fire':
        case 'ember':
        case 'venom':
        case 'frost': {
          const c = e.kind === 'venom' ? '#a3e635' : e.kind === 'frost' ? '#e0f2fe' : k < 0.3 ? '#fef3c7' : k < 0.6 ? '#fb923c' : '#dc2626';
          ctx.fillStyle = hexA(c, 0.85 * (1 - k));
          ctx.beginPath();
          ctx.arc(X, Y - k * (e.kind === 'ember' ? 30 : 12) * d * Z, Math.max(0.8, rr * (e.kind === 'ember' ? 0.3 : 0.5 + k * 0.5)), 0, Math.PI * 2);
          ctx.fill();
          if (e.kind !== 'frost') glows.push([X, Y, rr * 2, e.kind === 'venom' ? '#84cc16' : '#f97316', 0.4 * (1 - k)]);
          break;
        }
        case 'lightning': {
          const a = 1 - k;
          ctx.strokeStyle = hexA('#eef2ff', 0.95 * a);
          ctx.lineWidth = Math.max(1, 1.6 * Z);
          ctx.beginPath();
          ctx.moveTo(X, Y - 60 * d * Z);
          for (let j = 1; j <= 5; j++) ctx.lineTo(X + (hash(e.seed, j) - 0.5) * 16 * Z, Y - 60 * d * Z + j * 12 * d * Z);
          ctx.stroke();
          glows.push([X, Y, 30 * Z, '#c7d2fe', 0.7 * a]);
          break;
        }
        case 'smoke':
        case 'dust':
          ctx.fillStyle = e.kind === 'smoke' ? `rgba(80,80,80,${(0.35 * (1 - k)).toFixed(3)})` : hexA(e.color, 0.35 * (1 - k));
          ctx.beginPath();
          ctx.arc(X, Y - k * 20 * d * Z, Math.max(1, rr * (0.6 + k)), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'splash':
          ctx.fillStyle = hexA('#bfdbfe', 0.7 * (1 - k));
          for (let j = 0; j < 4; j++) ctx.fillRect(X + (hash(e.seed, j) - 0.5) * rr * 2, Y - Math.sin(k * Math.PI) * rr * hash(e.seed, j + 2), Math.max(1, Z), Math.max(1, Z));
          break;
        case 'debris':
          ctx.fillStyle = '#57534e';
          for (let j = 0; j < 6; j++) ctx.fillRect(X + (hash(e.seed, j) - 0.5) * rr * 2, Y - Math.sin(k * Math.PI) * 14 * d * Z * hash(e.seed, j + 3), 2 * d * Z, 2 * d * Z);
          break;
        case 'spark':
        case 'chop':
        case 'glint':
        case 'flash':
          ctx.fillStyle = hexA(e.color, 1 - k);
          ctx.fillRect(X + (hash(e.seed, 1) - 0.5) * rr * 2 * k, Y - k * rr, Math.max(1, Z), Math.max(1, Z));
          if (e.kind !== 'chop') glows.push([X, Y, rr * 2 + 4, e.color, 0.6 * (1 - k)]);
          break;
        case 'confetti':
          ctx.fillStyle = e.color;
          ctx.fillRect(X + Math.sin(k * 6 + e.seed) * 8 * Z, Y + k * 30 * d * Z, Math.max(1, 1.5 * Z), Math.max(1, 1.5 * Z));
          break;
        default:
          break;
      }
    }
  }

  // ---- the scene ------------------------------------------------------------------------------------
  function scene(t: number, night: number) {
    type It = { y: number; draw: () => void };
    const items: It[] = [];
    for (const tr of world.trees) if (onScreen(tr.x, groundY(tr.z), 40)) items.push({ y: groundY(tr.z), draw: () => tree(tr, t) });
    for (const b of world.buildings) if (onScreen(b.x, groundY(b.z), 120)) items.push({ y: groundY(b.z), draw: () => building(b, t, night) });
    for (const b of world.beasts) if (b.alive && !b.carried && onScreen(b.x, groundY(b.z), 30)) items.push({ y: groundY(b.z), draw: () => beast(b) });
    for (const p of world.people) {
      if (p.hidden) continue;
      const onPath = (p.kind === 'hero' || p.kind === 'thief') && (p.task === 'climb' || p.task === 'cave' || p.task === 'descend');
      if (!onPath && !onScreen(p.x, groundY(p.z), 40)) continue;
      items.push({ y: onPath ? 0 : groundY(p.z) + (p.h > 4 ? 2000 : 0), draw: () => personDraw(p, t) });
    }
    for (const b of world.boats) {
      if (!world.lake) break;
      items.push({ y: groundY(b.z), draw: () => {
        const k = depth(b.z);
        const y = groundY(b.z);
        poly([b.x - 10 * k, y - 3 * k, b.x + 10 * k, y - 3 * k, b.x + 7 * k, y, b.x - 7 * k, y], '#5c3d24');
        R(b.x - 0.5 * k, y - 16 * k, 1 * k, 13 * k, '#3f2a17');
        poly([b.x, y - 16 * k, b.x + b.dir * 8 * k, y - 6 * k, b.x, y - 6 * k], '#e7e5e4');
      } });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
  }

  // ---- night, text ------------------------------------------------------------------------------------
  function nightfall(t: number, night: number) {
    if (night > 0.01) {
      ctx.fillStyle = `rgba(6,8,24,${(0.42 * night).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (dusk() > 0.05 && night < 0.9) {
      ctx.fillStyle = `rgba(251,146,60,${(0.07 * dusk()).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Lanterns rising at the festival.
    if (world.festival > world.t) {
      const tw = world.settlements[0];
      for (let k = 0; k < 40; k++) {
        const a = (t * 0.05 + hash(k, 1)) % 1;
        const x = tw.x + (hash(k, 2) - 0.5) * 400;
        const y = groundY(tw.z) - a * 500;
        R(x - 1.5, y - 2, 3, 3, '#fde68a');
        lit(x, y, 10, '#f59e0b', 0.6 * (1 - a));
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const boost = 0.3 + night * 0.6;
    for (const [x, y, r, c, a] of glows) glow(x, y, r, c, a * boost);
    ctx.restore();
    glows = [];
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
      let y = Math.max(96, Math.min(H - 76, SY(l.y) - 18));
      for (let tries = 0; tries < 6 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18); tries++) y -= 19;
      placed.push([x, y, w]);
      ctx.fillStyle = `rgba(8,6,10,${(0.6 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 16);
      const [cr, cg, cb] = mixRgb(l.color, '#f5ecd7', 0.45);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(0.95 * a).toFixed(3)})`;
      fillCrisp(ctx, typed(l.text, age, 40, t), x, y);
    }
    ctx.restore();
  }
  const STATE_WORD: Record<string, string> = { sleep: 'ASLEEP ON ITS SPIRE', bask: 'BASKING ON ITS SPIRE', patrol: 'ON THE WING', hunt: 'HUNTING', raid: 'RAIDING', return: 'FLYING HOME', cavefight: 'FIGHTING AT THE CAVE', flee: 'FLEEING', away: 'GONE FROM THE VALLEY', arrive: 'COMING', duel: 'FIGHTING A RIVAL', fall: 'FALLING', wake: 'WAKING' };
  function hud(t: number, level: number) {
    if (!o.hud) return;
    ctx.save();
    let g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, `rgba(8,6,10,${(0.6 * level).toFixed(3)})`);
    g.addColorStop(1, 'rgba(8,6,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 96);
    g = ctx.createLinearGradient(0, H - 72, 0, H);
    g.addColorStop(0, 'rgba(8,6,10,0)');
    g.addColorStop(1, `rgba(8,6,10,${(0.55 * level).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 72, W, 72);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = serif(13);
    ctx.fillStyle = hexA('#ece4d4', 0.9 * level);
    const room = W - 32;
    fillCrisp(ctx, fitText(ctx, `${LAND_NAMES[world.biome]} ${world.name} · ${SEASONS[world.season]} ${world.year}`, room), 16, 26);
    ctx.font = serif(11);
    const w = world.dragons.find((d) => d.kind === 'wyrm' && d.alive);
    ctx.fillStyle = hexA(w && (w.state === 'raid' || w.state === 'hunt') ? '#fca5a5' : '#b8b2a8', 0.9 * level);
    fillCrisp(ctx, fitText(ctx, w ? `${w.name}, ${BREED_NAMES[w.breed]} · ${STATE_WORD[w.state] ?? w.state.toUpperCase()} · HOARD ${world.spire.hoard} CROWNS` : 'THE SPIRE STANDS EMPTY', room), 16, 42);
    ctx.fillStyle = hexA('#b8b2a8', 0.85 * level);
    const pol = { endure: 'ENDURE', fortify: 'FORTIFY', appease: 'TRIBUTE', hunt: 'THE HUNT' }[world.policy];
    fillCrisp(ctx, fitText(ctx, `${world.lord}, ${world.temper.toUpperCase()} · POLICY: ${pol} · ${world.people.filter((p) => p.alive).length} SOULS · ${world.slain} DRAGONS SLAIN`, room), 16, 57);
    ctx.font = serif(11, true);
    ctx.fillStyle = hexA('#b8b2a8', 0.7 * level);
    fillCrisp(ctx, fitText(ctx, `This valley has ${world.cast.slice(0, 6).join(', ')}.`, room), 16, 72);
    ctx.font = serif(11);
    ctx.textAlign = 'right';
    // On a narrow screen the left column needs the width.
    if (W >= 980) world.settlements.forEach((s, k) => {
      const n = world.buildings.filter((b) => b.settle === s.id && b.state === 'standing').length;
      const burning = world.buildings.some((b) => b.settle === s.id && b.fire > 0);
      ctx.fillStyle = hexA(burning ? '#fca5a5' : s.alarm > world.t ? '#fdba74' : '#b8b2a8', 0.85 * level);
      fillCrisp(ctx, `${s.name}${s.kind === 'town' ? ' (THE TOWN)' : ''} · ${n} ROOFS${burning ? ' · BURNING' : ''}`, W - 16, 26 + k * 15);
    });
    ctx.textAlign = 'left';
    ctx.font = serif(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#ece4d4', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
    ctx.restore();
  }
  let quietCanvas: HTMLCanvasElement | null = null;
  let quietAt = -1;
  let quietEmpty = true;
  function quietShade(t: number) {
    const G = 20;
    const gw = Math.ceil(W / G);
    const gh = Math.ceil(H / G);
    if (!quietCanvas || quietCanvas.width !== gw || quietCanvas.height !== gh || t - quietAt > 1 || t < quietAt) {
      quietCanvas ??= document.createElement('canvas');
      quietCanvas.width = gw;
      quietCanvas.height = gh;
      const q = quietCanvas.getContext('2d')!;
      const img = q.createImageData(gw, gh);
      quietEmpty = true;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const k = host.quiet((x + 0.5) * G, (y + 0.5) * G);
        const o4 = (y * gw + x) * 4;
        img.data[o4] = 8;
        img.data[o4 + 1] = 6;
        img.data[o4 + 2] = 12;
        img.data[o4 + 3] = Math.round(190 * k);
        if (k > 0.01) quietEmpty = false;
      }
      q.putImageData(img, 0, 0);
      quietAt = t;
    }
    if (quietEmpty) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(quietCanvas, 0, 0, gw * G, gh * G);
  }

  function paint(t: number) {
    Z = cam.zoom;
    const level = 0.55 + 0.45 * host.intensity;
    const night = darkness();
    sky(t, night);
    ranges(night);
    spire(t, night);
    ground(t, night);
    fields();
    // Perched dragons belong to the spire, behind the valley's things.
    for (const d of world.dragons) if (d.h > 0 && (d.state === 'sleep' || d.state === 'bask' || d.state === 'roost' || d.state === 'cavefight')) dragonDraw(d, t);
    scene(t, night);
    for (const d of world.dragons) if (!(d.state === 'sleep' || d.state === 'bask' || d.state === 'roost' || d.state === 'cavefight')) dragonDraw(d, t);
    missilesDraw(t);
    effects(t);
    nightfall(t, night);
    quietShade(t);
    labels(t, level);
    hud(t, level);
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [SX(x), SY(y)],
    unproject: (x, y) => [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y],
    after: (dt) => camera(dt),
    paint: (t) => paint(t),
    ambience: () => (world.dragons.some((d) => d.alive && (d.state === 'raid' || d.state === 'duel' || d.state === 'harass')) || world.buildings.some((b) => b.fire > 0) ? 0.9 : 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      groundCanvas = null;
    },
  });
}
