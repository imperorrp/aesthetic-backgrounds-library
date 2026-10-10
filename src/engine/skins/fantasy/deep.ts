/**
 * Deephold's mount: the hold (deep-sim.ts) in cutaway, the mountain cut through like a
 * glass ant farm.
 *
 * The rock is painted once into a small texture (four texels a cell: strata, cracks, the
 * glint of ore, ladders in the shaft, worn floors) and touched up cell by cell as the
 * dwarves dig; it is drawn scaled up, unsmoothed, so the whole hold is pixel art at any
 * zoom. Over it: water and magma where they flow, the rooms' furnishings, carts and ore,
 * the dwarves, the things from below, the sleeper, sparks and dust; then the dark (deeper
 * is darker), and the lights in it: torches along the galleries, forge mouths, hearths,
 * glowing fungus in the caverns, magma, miners' lamps. Above it all, the mountain's slopes
 * and the sky, by the hour and the season.
 *
 * The camera follows the sim's `focus`: the whole hold from a distance, or close in on a
 * flood, a cave-in, a forge, the gate, the thing climbing the shaft.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../instruments/kit';
import { DEEPHOLD_SCHEMA } from './index';
import { createDeepWorld, deepName, isOpen, M, MOUNTAIN_NAMES, SEASONS, type Dwarf, type Foe, type Mountain, type Room } from './deep-sim';
import { serif } from './names';
import { mountKingdom } from './kingdom/paint';

const TEX = 4;

type Tint = { rock: [number, number, number]; cave: string; fungus: string[]; grass: string; sky: [string, string, string] };
const TINTS: Record<Mountain, Tint> = {
  iron: { rock: [1.08, 0.98, 0.9], cave: '#2a3440', fungus: ['#5eead4', '#a3e635'], grass: '#3f5a2a', sky: ['#0b1220', '#1b2638', '#3b3f4f'] },
  crystal: { rock: [0.95, 0.92, 1.12], cave: '#2e2648', fungus: ['#c084fc', '#67e8f9'], grass: '#3a5a3a', sky: ['#0c0a1e', '#1d1a38', '#3a3256'] },
  frost: { rock: [0.92, 1, 1.12], cave: '#26364a', fungus: ['#7dd3fc', '#e0f2fe'], grass: '#e2e8f0', sky: ['#0b1424', '#1e2e44', '#51627a'] },
  ember: { rock: [1.15, 0.9, 0.82], cave: '#3a201c', fungus: ['#fb923c', '#facc15'], grass: '#3a3530', sky: ['#160b0b', '#2a1412', '#5a2a1e'] },
  drowned: { rock: [0.9, 1.04, 1.02], cave: '#1e3434', fungus: ['#34d399', '#5eead4'], grass: '#2f5a3a', sky: ['#091618', '#14282b', '#2d4648'] },
};
const ROCK: Record<number, [number, number, number]> = {
  [M.SOIL]: [74, 54, 38], [M.STONE]: [86, 82, 76], [M.SLATE]: [64, 70, 82], [M.DEEP]: [60, 54, 66], [M.BASALT]: [42, 38, 40], [M.ICE]: [150, 178, 198],
  [M.IRON]: [86, 82, 76], [M.COAL]: [70, 68, 66], [M.GOLD]: [80, 74, 66], [M.GEM]: [62, 56, 70], [M.MITHRIL]: [50, 52, 60], [M.AQUIFER]: [52, 70, 76],
  [M.MAGMA]: [96, 34, 18], [M.RUIN]: [104, 98, 86], [M.RUBBLE]: [92, 84, 74], [M.OBSIDIAN]: [22, 18, 26], [M.SEAL]: [138, 126, 106],
};
const SPECK: Record<number, string> = { [M.IRON]: '#c2693b', [M.COAL]: '#26221f', [M.GOLD]: '#facc15', [M.GEM]: '#c084fc', [M.MITHRIL]: '#e0f2fe', [M.OBSIDIAN]: '#6d5a9c', [M.MAGMA]: '#f97316', [M.AQUIFER]: '#3f8a9a' };
const BEARDS = ['#d97706', '#78350f', '#e5e7eb', '#9ca3af', '#b45309', '#292524'];
const JOB_COLOR: Record<string, string> = { miner: '#8b5a2b', hauler: '#6b7280', smith: '#7f1d1d', brewer: '#4d7c0f', farmer: '#3f6212', mason: '#78716c', soldier: '#94a3b8', king: '#6d28d9' };

const rgb = (c: [number, number, number]) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const hexRgb = (h: string): [number, number, number] => mixRgb(h, h, 0);
const mixHex = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, k);
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(DEEPHOLD_SCHEMA, host.options) as { style: string; holds: string; mountain: string; depth: number; hazards: number; below: string; scale: number; camera: string; labels: boolean; hud: boolean };
  if (o.style !== 'classic') return mountKingdom(host, o);
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world = createDeepWorld(host.config.seed, W, H, { mountain: o.mountain, depth: o.depth, hazards: o.hazards, below: o.below, scale: o.scale });
  const { CELL, cols, rows, mat, water, magma, ladder } = world;
  const tint = TINTS[world.mountain];
  let nextAmbience = 0;

  // ---- the camera --------------------------------------------------------------------------------

  const cam = { x: world.focus.x, y: world.focus.y, zoom: world.focus.zoom };
  const minZoom = () => Math.max(W / world.GW, H / world.GH, 0.4);
  function camera(dt: number) {
    const f = world.focus;
    const zoom = Math.max(minZoom(), Math.min(1.9, f.zoom));
    cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 0.6);
    const k = Math.min(1, dt * 0.8);
    cam.x += (f.x - cam.x) * k;
    cam.y += (f.y - cam.y) * k;
    const hw = W / 2 / cam.zoom;
    const hh = H / 2 / cam.zoom;
    cam.x = Math.max(hw, Math.min(world.GW - hw, cam.x));
    cam.y = Math.max(hh - world.GH * 0.02, Math.min(world.GH - hh, cam.y));
  }
  let shake = [0, 0];
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2 + shake[0];
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2 + shake[1];

  world.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const x = typeof e.x === 'number' ? SX(e.x) : W / 2;
    const y = typeof e.y === 'number' ? SY(e.y) : H / 2;
    const near = x > -80 && x < W + 80 && y > -80 && y < H + 80 ? 1 : 0.35;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near, text: e.text, color: e.color, priority: e.priority });
  });
  const step = (info: FrameInfo) => {
    const dt = host.motion === 'off' ? 0 : Math.min(info.dt, 0.1);
    world.step(dt);
    camera(dt);
    if (world.t >= nextAmbience && host.events?.active) {
      nextAmbience = world.t + 2;
      host.events.emit({ type: 'ambience', weight: world.sleeper && world.sleeper.state !== 'sleep' && world.sleeper.state !== 'dead' ? 0.9 : 0.3, pan: 0, near: 1 });
    }
  };

  // ---- the rock --------------------------------------------------------------------------------------

  let rock: HTMLCanvasElement | null = null;
  let rg: CanvasRenderingContext2D | null = null;
  let scratch: ImageData | null = null;
  const peakRow = Math.min(...Array.from(world.surface));
  /** Smooth value noise over the cells (blocks of six), for patches in the rock. */
  const tone = (c: number, rr: number) => {
    const B = 6;
    const gx = c / B;
    const gy = rr / B;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const u = gx - x0;
    const v = gy - y0;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const a = hash(x0, y0, 21);
    const b = hash(x0 + 1, y0, 21);
    const cc = hash(x0, y0 + 1, 21);
    const d = hash(x0 + 1, y0 + 1, 21);
    return a + (b - a) * su + (cc - a) * sv + (a - b - cc + d) * su * sv;
  };
  /** One texel's color, as RGBA. */
  function texel(i: number, tx: number, ty: number, out: Uint8ClampedArray, o4: number) {
    const m = mat[i];
    const c = i % cols;
    const rr = Math.floor(i / cols);
    if (m === M.SKY) {
      out[o4 + 3] = 0;
      return;
    }
    const n = hash(c * TEX + tx, rr * TEX + ty);
    const depth = Math.min(1, rr / rows);
    if (isOpen(m)) {
      // The back wall: dug (warm) or natural (cool); a ladder in the shaft.
      const nat = m === M.CAVE || world.caveAt[i] >= 0;
      const base = nat ? hexRgb(tint.cave) : ([34, 27, 22] as [number, number, number]);
      let k = 0.85 + n * 0.25 - depth * 0.25;
      if (!nat && (tx + ty * 3 + c + rr) % 7 === 0) k *= 0.8;
      let [rC, gC, bC] = base.map((v) => v * k);
      if (ladder[i] && (tx === 0 || tx === 3 || ty === 1)) [rC, gC, bC] = [107, 74, 43];
      out[o4] = rC;
      out[o4 + 1] = gC;
      out[o4 + 2] = bC;
      out[o4 + 3] = 255;
      return;
    }
    const base = ROCK[m] ?? ROCK[M.STONE];
    // Broad patches of lighter and darker stone, and a little grain.
    const tn = tone(c, rr);
    let k = 0.78 + tn * 0.34 + (n - 0.5) * 0.16;
    // Strata lines and cracks.
    if ((rr * TEX + ty + Math.round(Math.sin(c * 0.21 + rr) * 1.5)) % 11 === 0) k *= 0.82;
    if (hash(c, rr, 7) < 0.04 && tx === ty) k *= 0.7;
    k *= 1 - depth * 0.4;
    let col: [number, number, number] = [base[0] * k * tint.rock[0], base[1] * k * tint.rock[1], base[2] * k * tint.rock[2]];
    if (m === M.RUIN || m === M.SEAL) {
      // Worked stone: courses of block.
      if (ty === 3 || (tx === ((rr & 1) * 2) % 4 && ty < 3)) col = col.map((v) => v * 0.6) as [number, number, number];
      if (m === M.SEAL && ty === 0) col = [150, 120, 60];
    }
    if (m === M.RUBBLE && hash(c * 4 + tx, rr * 4 + ty, 3) < 0.35) col = col.map((v) => v * 0.6) as [number, number, number];
    const sp = SPECK[m];
    if (sp && hash(c * 4 + tx, rr * 4 + ty, 5) < (m === M.COAL ? 0.32 : m === M.AQUIFER ? 0.25 : 0.3)) col = hexRgb(sp).map((v) => v * (1 - depth * 0.2)) as [number, number, number];
    // The ground's top: grass, snow, ash; a worn floor where it was walked.
    const above = rr > 0 ? mat[i - cols] : M.SKY;
    if (ty === 0 && above === M.SKY) col = hexRgb(rr < peakRow + 10 && world.mountain !== 'ember' ? '#e2e8f0' : tint.grass);
    else if (ty <= 1 && above === M.SKY && rr < peakRow + 6 && world.mountain !== 'ember') col = [210, 218, 228];
    else if (ty === 0 && above === M.OPEN) col = col.map((v) => v * 1.35 + 10) as [number, number, number];
    out[o4] = col[0];
    out[o4 + 1] = col[1];
    out[o4 + 2] = col[2];
    out[o4 + 3] = 255;
  }
  function paintRock() {
    rock = document.createElement('canvas');
    rock.width = cols * TEX;
    rock.height = rows * TEX;
    rg = rock.getContext('2d')!;
    const img = rg.createImageData(rock.width, rock.height);
    const d = img.data;
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const i = rr * cols + c;
      for (let ty = 0; ty < TEX; ty++) for (let tx = 0; tx < TEX; tx++) texel(i, tx, ty, d, ((rr * TEX + ty) * rock.width + c * TEX + tx) * 4);
    }
    rg.putImageData(img, 0, 0);
    scratch = rg.createImageData(TEX, TEX);
    world.dirty.length = 0;
  }
  function touchUp() {
    if (!rg || !scratch || !world.dirty.length) return;
    const done = new Set<number>();
    for (const j of world.dirty) for (const i of [j, j - cols, j + cols]) {
      if (i < 0 || i >= mat.length || done.has(i)) continue;
      done.add(i);
      for (let ty = 0; ty < TEX; ty++) for (let tx = 0; tx < TEX; tx++) texel(i, tx, ty, scratch.data, (ty * TEX + tx) * 4);
      rg.putImageData(scratch, (i % cols) * TEX, Math.floor(i / cols) * TEX);
    }
    world.dirty.length = 0;
  }

  /** Fungus in the caverns (they glow whether or not the dwarves know). */
  const fungus: { x: number; y: number; color: string; cave: number; seed: number }[] = [];
  for (let i = cols; i < mat.length - cols; i++) {
    if (mat[i] !== M.CAVE || isOpen(mat[i + cols])) continue;
    if (hash(i, 11) < 0.22) fungus.push({ x: world.cellX(i) + (hash(i, 2) - 0.5) * CELL, y: world.cellY(i), color: tint.fungus[i % tint.fungus.length], cave: world.caveAt[i], seed: i });
  }

  // ---- light ------------------------------------------------------------------------------------------

  const glows = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, r: number, color: string, a: number) {
    if (r <= 0 || a <= 0.01 || x < -r || x > W + r || y < -r || y > H + r) return;
    let s = glows.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(0.4, hexA(color, 0.35));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glows.set(color, s);
    }
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prev;
  }
  const darkness = () => {
    const d = world.day;
    return d < 0.2 || d > 0.88 ? 1 : d < 0.3 ? 1 - (d - 0.2) / 0.1 : d > 0.78 ? (d - 0.78) / 0.1 : 0;
  };

  // ---- drawing helpers (world px) -------------------------------------------------------------------

  let Z = 1;
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(SX(x)), Math.round(SY(y)), Math.max(1, Math.round(w * Z)), Math.max(1, Math.round(h * Z)));
  };
  const visible = (x: number, y: number, pad = 60) => {
    const X = SX(x);
    const Y = SY(y);
    return X > -pad * Z && X < W + pad * Z && Y > -pad * Z && Y < H + pad * Z;
  };

  function sky(t: number) {
    const dark = darkness();
    const [a, b, c] = tint.sky;
    const g = ctx.createLinearGradient(0, SY(0), 0, SY(world.surface[world.gate.c] * CELL + CELL * 20));
    const night = (h: string) => mixRgb(h, '#03040a', dark * 0.75);
    g.addColorStop(0, rgb(night(a)));
    g.addColorStop(0.55, rgb(night(b)));
    g.addColorStop(1, rgb(night(c)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const top = SY(0);
    const horizon = SY(world.surface[0] * CELL);
    if (horizon < 0) return;
    if (dark > 0.05) for (let i = 0; i < 120; i++) {
      const y = top + hash(i, 2) * (horizon - top) * 0.9;
      ctx.fillStyle = `rgba(226,232,240,${((0.2 + hash(i, 3) * 0.6) * dark * (0.8 + 0.2 * Math.sin(t * 2 + i))).toFixed(3)})`;
      ctx.fillRect(Math.floor(hash(i, 1) * W), Math.floor(y), 1, 1);
    }
    // Far mountains behind this one.
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = rgb(mixRgb(layer ? b : c, '#000000', 0.35 + layer * 0.2 + dark * 0.3));
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let X = 0; X <= W; X += 8) {
        const wx = (X - W / 2) / cam.zoom / (1.6 + layer) + cam.x * (0.4 + layer * 0.2);
        const hgt = (0.5 + 0.5 * Math.sin(wx * 0.004 + layer * 3) * Math.sin(wx * 0.0013 + 1)) * world.H * (0.28 - layer * 0.08);
        ctx.lineTo(X, SY(world.surface[0] * CELL - hgt + layer * 20));
      }
      ctx.lineTo(W, H);
      ctx.fill();
    }
    const ang = world.day * Math.PI * 2;
    const sx = W * 0.5 - Math.sin(ang) * W * 0.4;
    const sy = top + (horizon - top) * (0.55 + Math.cos(ang) * 0.5);
    if (sy < horizon && dark < 0.9) glow(sx, sy, 140, '#fbbf24', 0.25 * (1 - dark));
    const mx = W * 0.5 + Math.sin(ang) * W * 0.4;
    const my = top + (horizon - top) * (0.55 - Math.cos(ang) * 0.5);
    if (my < horizon && dark > 0.2) {
      glow(mx, my, 60, '#cbd5e1', 0.15 * dark);
      ctx.fillStyle = `rgba(226,232,240,${(0.8 * dark).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function rockLayer() {
    if (!rock) return;
    const x0 = cam.x - W / 2 / cam.zoom;
    const y0 = cam.y - H / 2 / cam.zoom;
    const sx = Math.max(0, (x0 / CELL) * TEX);
    const sy = Math.max(0, (y0 / CELL) * TEX);
    const sw = Math.min(rock.width - sx, ((W / cam.zoom) / CELL) * TEX + 2);
    const sh = Math.min(rock.height - sy, ((H / cam.zoom) / CELL) * TEX + 2);
    if (sw <= 0 || sh <= 0) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(rock, sx, sy, sw, sh, SX((sx / TEX) * CELL), SY((sy / TEX) * CELL), (sw / TEX) * CELL * cam.zoom, (sh / TEX) * CELL * cam.zoom);
  }

  function snow(t: number) {
    if (world.season !== 3 && world.mountain !== 'frost') return;
    const horizon = SY(world.surface[0] * CELL);
    if (horizon < 0) return;
    ctx.fillStyle = 'rgba(241,245,249,0.6)';
    for (let i = 0; i < 140; i++) {
      const x = ((hash(i, 1) * W + t * 12 + Math.sin(t + i) * 10) % W + W) % W;
      const y = (hash(i, 2) * horizon + t * (20 + hash(i, 3) * 20)) % Math.max(1, horizon);
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  function fluids(t: number) {
    const c0 = Math.max(0, Math.floor((cam.x - W / 2 / cam.zoom) / CELL));
    const c1 = Math.min(cols - 1, Math.ceil((cam.x + W / 2 / cam.zoom) / CELL));
    const r0 = Math.max(0, Math.floor((cam.y - H / 2 / cam.zoom) / CELL));
    const r1 = Math.min(rows - 1, Math.ceil((cam.y + H / 2 / cam.zoom) / CELL));
    const cs = CELL * cam.zoom;
    let glowsLeft = 60;
    for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) {
      const i = rr * cols + c;
      const w = water[i];
      const m = magma[i];
      if (w < 0.03 && m < 0.03) continue;
      const X = SX(c * CELL);
      const Y = SY(rr * CELL);
      if (w >= 0.03) {
        const h = Math.min(1, w) * cs;
        ctx.fillStyle = 'rgba(46,110,160,0.62)';
        ctx.fillRect(X, Y + cs - h, cs + 0.5, h);
        if (rr > 0 && water[i - cols] < 0.03) {
          ctx.fillStyle = `rgba(147,197,253,${(0.35 + 0.2 * Math.sin(t * 2 + c)).toFixed(3)})`;
          ctx.fillRect(X, Y + cs - h, cs + 0.5, Math.max(1, cam.zoom));
        }
      }
      if (m >= 0.03) {
        const h = Math.min(1, m) * cs;
        const flick = 0.75 + 0.25 * Math.sin(t * 3 + c * 1.7 + rr);
        ctx.fillStyle = `rgba(${(220 + 35 * flick) | 0},${(90 + 60 * flick * hash(c, rr)) | 0},20,0.95)`;
        ctx.fillRect(X, Y + cs - h, cs + 0.5, h);
        if (glowsLeft > 0 && (c + rr * 3) % 5 === 0) {
          glowsLater.push([X + cs / 2, Y + cs / 2, cs * 4, '#f97316', 0.25]);
          glowsLeft--;
        }
      }
    }
  }
  let glowsLater: [number, number, number, string, number][] = [];

  // ---- rooms ------------------------------------------------------------------------------------------

  function furnish(room: Room, t: number) {
    if (!room.dug && room.kind !== 'entrance') return;
    const x0 = room.c0 * CELL;
    const x1 = (room.c1 + 1) * CELL;
    const fy = (room.floor + 1) * CELL;
    const ty = room.top * CELL;
    const w = x1 - x0;
    if (!visible((x0 + x1) / 2, (fy + ty) / 2, w)) return;
    const C = CELL;
    ctx.globalAlpha = room.ruined ? 0.45 : 1;
    if (room.pillars || room.kind === 'hall') for (let x = x0 + C * 2; x < x1 - C; x += C * 6) {
      box(x, ty, C * 0.7, fy - ty, '#6b6458');
      box(x - C * 0.15, ty, C, C * 0.4, '#857c6c');
      box(x - C * 0.15, fy - C * 0.4, C, C * 0.4, '#857c6c');
    }
    if (!room.furnished) {
      ctx.globalAlpha = 1;
      return;
    }
    const lit = (x: number, y: number, r: number, color: string, a: number) => glowsLater.push([SX(x), SY(y), r * Z, color, a]);
    switch (room.kind) {
      case 'entrance': {
        // Statues of the clan's forebears, and its banners.
        for (const x of [x0 + C * 2, x1 - C * 3]) {
          box(x, fy - C * 0.6, C * 1.6, C * 0.6, '#57534e');
          box(x + C * 0.3, fy - C * 3.6, C, C * 3, '#78716c');
          box(x + C * 0.2, fy - C * 4.4, C * 1.2, C * 0.9, '#8a8478');
          box(x + C * 0.4, fy - C * 3.6, C * 0.8, C * 1.4, '#a8a29e');
        }
        for (let x = x0 + C * 5; x < x1 - C * 4; x += C * 4) {
          box(x, ty + C * 0.3, C * 1.2, C * 2.2, '#7f1d1d');
          box(x + C * 0.3, ty + C * 0.9, C * 0.6, C * 0.6, '#d4a017');
        }
        break;
      }
      case 'store': {
        const s = world.stocks;
        let x = x0 + C;
        for (const [n, color] of [[s.iron, '#a0522d'], [s.coal, '#18181b'], [s.gold, '#facc15'], [s.gem, '#c084fc'], [s.mithril, '#e0f2fe']] as [number, string][]) {
          const h = Math.min(2.5, Math.sqrt(n) * 0.4) * C;
          if (h > 1) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(SX(x), SY(fy));
            ctx.lineTo(SX(x + C * 0.9), SY(fy - h));
            ctx.lineTo(SX(x + C * 1.8), SY(fy));
            ctx.fill();
          }
          x += C * 1.6;
        }
        for (let k = 0; k < 3; k++) {
          const cx = x1 - C * (2 + k * 1.3);
          box(cx, fy - C, C, C, '#7c5a36');
          box(cx + C * 0.45, fy - C, C * 0.1, C, '#4a3520');
        }
        box(x1 - C * 2.5, fy - C * 2, C, C, '#7c5a36');
        break;
      }
      case 'dorm':
        for (let x = x0 + C; x < x1 - C * 2; x += C * 2.5) {
          box(x, fy - C * 0.7, C * 2, C * 0.7, '#5c3d24');
          box(x + C * 0.5, fy - C * 0.9, C * 1.5, C * 0.3, ['#7f1d1d', '#1e3a8a', '#365314', '#713f12'][Math.floor(hash(x, 2) * 4)]);
          box(x, fy - C * 0.95, C * 0.5, C * 0.35, '#e7e5e4');
        }
        break;
      case 'farm':
        for (let x = x0 + C * 0.5; x < x1 - C * 0.5; x += C * 0.9) {
          const h = (0.6 + hash(x, 1) * 0.9) * C;
          const color = tint.fungus[Math.floor(hash(x, 3) * tint.fungus.length)];
          box(x + C * 0.3, fy - h, C * 0.2, h, '#d6d3d1');
          box(x, fy - h - C * 0.35, C * 0.8, C * 0.4, color);
          if (hash(x, 4) < 0.35) lit(x + C * 0.4, fy - h, C * 1.5, color, 0.25);
        }
        break;
      case 'brewery':
        for (let k = 0; k < 3; k++) {
          const x = x0 + C * (1 + k * 2.2);
          box(x, fy - C * 2, C * 1.8, C * 2, '#7c5a36');
          box(x, fy - C * 1.5, C * 1.8, C * 0.15, '#3f3f46');
          box(x, fy - C * 0.6, C * 1.8, C * 0.15, '#3f3f46');
        }
        box(x1 - C * 2.4, fy - C * 1.6, C * 1.4, C * 1.6, '#b45309');
        box(x1 - C * 1.2, fy - C * 2.6, C * 0.3, C * 1.4, '#c2410c');
        break;
      case 'forge':
      case 'magmaforge': {
        const busy = world.dwarves.some((d) => d.alive && d.task?.room === room && d.swingUntil > world.t);
        box(x0 + C, fy - C * 3, C * 2.4, C * 3, '#44403c');
        box(x0 + C * 1.6, fy - C * 1.6, C * 1.2, C * 0.9, busy ? '#fb923c' : '#7c2d12');
        lit(x0 + C * 2.2, fy - C * 1.2, C * (busy ? 6 : 3), '#f97316', busy ? 0.55 : 0.2);
        for (const x of [x0 + C * 4.5, x0 + C * 6.8]) {
          box(x, fy - C * 0.9, C * 0.6, C * 0.9, '#27272a');
          box(x - C * 0.4, fy - C * 1.2, C * 1.4, C * 0.35, '#3f3f46');
        }
        if (room.kind === 'magmaforge') {
          box(x1 - C * 2.5, fy - C * 0.4, C * 2, C * 0.4, '#f97316');
          lit(x1 - C * 1.5, fy - C * 0.2, C * 4, '#f97316', 0.45);
        }
        break;
      }
      case 'hall': {
        // Long tables, the throne, the hearth, the clan's artifacts on their plinths.
        const feast = world.feast > world.t;
        box(x0 + C * 4, fy - C * 1, w - C * 9, C * 0.35, '#6b4a2b');
        for (let x = x0 + C * 4.5; x < x1 - C * 5; x += C * 3) box(x, fy - C * 0.65, C * 0.3, C * 0.65, '#5c3d24');
        if (feast) for (let x = x0 + C * 5; x < x1 - C * 5; x += C * 1.3) box(x, fy - C * 1.25, C * 0.35, C * 0.3, hash(x, 9) < 0.5 ? '#fbbf24' : '#a16207');
        box(x1 - C * 3, fy - C * 2.4, C * 1.8, C * 2.4, '#a16207');
        box(x1 - C * 2.7, fy - C * 1.8, C * 1.2, C * 1.2, '#7f1d1d');
        box(x0 + C * 0.8, fy - C * 2.2, C * 2.4, C * 2.2, '#57534e');
        box(x0 + C * 1.3, fy - C * 1.2, C * 1.4, C * 1.2, '#fb923c');
        lit(x0 + C * 2, fy - C * 0.8, C * (feast ? 9 : 6), '#f97316', feast ? 0.55 : 0.4);
        world.artifacts.slice(0, 5).forEach((_a, k) => {
          const x = x0 + C * (6 + k * 3);
          box(x, fy - C * 3.6, C, C * 0.6, '#78716c');
          box(x + C * 0.25, fy - C * 4.2, C * 0.5, C * 0.6, '#fde68a');
          if (Math.sin(t * 2 + k * 2) > 0.7) lit(x + C * 0.5, fy - C * 4, C * 2.5, '#fde68a', 0.5);
        });
        break;
      }
      case 'temple': {
        const x = (x0 + x1) / 2;
        box(x - C * 1.5, fy - C * 0.8, C * 3, C * 0.8, '#57534e');
        box(x - C * 0.8, fy - C * 5, C * 1.6, C * 4.2, '#8a8478');
        box(x - C * 1, fy - C * 6, C * 2, C * 1.2, '#a8a29e');
        box(x - C * 0.6, fy - C * 4.4, C * 1.2, C * 1.8, '#d6d3d1');
        for (const dx of [-3.5, -2.5, 2.5, 3.5]) {
          box(x + dx * C, fy - C * 0.8, C * 0.25, C * 0.8, '#f5f5f4');
          lit(x + dx * C, fy - C, C * 1.6, '#fde68a', 0.4 + 0.1 * Math.sin(t * 5 + dx));
        }
        break;
      }
      case 'tomb':
        for (let k = 0; k < Math.min(world.deaths, Math.floor(w / (C * 2.3))); k++) {
          const x = x0 + C * (0.8 + k * 2.3);
          box(x, fy - C * 0.9, C * 1.9, C * 0.9, '#57534e');
          box(x - C * 0.1, fy - C * 1.05, C * 2.1, C * 0.25, '#78716c');
        }
        break;
      case 'barracks':
        for (let x = x0 + C; x < x0 + C * 5; x += C * 0.8) {
          box(x, fy - C * 2.2, C * 0.15, C * 2.2, '#57534e');
          box(x - C * 0.15, fy - C * 2.5, C * 0.45, C * 0.4, '#cbd5e1');
        }
        box(x1 - C * 2.4, fy - C * 2, C * 0.25, C * 2, '#6b4a2b');
        box(x1 - C * 3, fy - C * 1.7, C * 1.4, C * 0.25, '#6b4a2b');
        box(x1 - C * 2.6, fy - C * 2.6, C * 0.7, C * 0.8, '#a16207');
        break;
      case 'treasury': {
        const n = Math.min(6, 1 + Math.floor(world.stocks.treasure / 6));
        for (let k = 0; k < n; k++) {
          const x = x0 + C * (0.8 + k * 1.2);
          ctx.fillStyle = '#ca8a04';
          ctx.beginPath();
          ctx.moveTo(SX(x), SY(fy));
          ctx.lineTo(SX(x + C * 0.6), SY(fy - C * (0.8 + hash(k, 3) * 0.8)));
          ctx.lineTo(SX(x + C * 1.2), SY(fy));
          ctx.fill();
          if (Math.sin(t * 3 + k * 1.9) > 0.8) lit(x + C * 0.6, fy - C * 0.8, C * 1.5, '#fde68a', 0.6);
        }
        box(x1 - C * 2, fy - C, C * 1.4, C, '#7c5a36');
        box(x1 - C * 2, fy - C * 0.6, C * 1.4, C * 0.12, '#ca8a04');
        break;
      }
      case 'pump': {
        const x = (x0 + x1) / 2;
        const y = fy - C * 2.4;
        const wet = world.dwarves.length && water[Math.floor(y / C) * cols + Math.floor(x / C)] >= 0;
        ctx.strokeStyle = '#7c5a36';
        ctx.lineWidth = Math.max(1, C * 0.25 * Z);
        ctx.beginPath();
        ctx.arc(SX(x), SY(y), C * 1.9 * Z, 0, Math.PI * 2);
        for (let k = 0; k < 4; k++) {
          const a = (wet ? t * 1.5 : 0) + (k * Math.PI) / 4;
          ctx.moveTo(SX(x + Math.cos(a) * C * 1.9), SY(y + Math.sin(a) * C * 1.9));
          ctx.lineTo(SX(x - Math.cos(a) * C * 1.9), SY(y - Math.sin(a) * C * 1.9));
        }
        ctx.stroke();
        box(x0, fy - C * 0.6, w, C * 0.3, '#3f3f46');
        break;
      }
      case 'library':
        for (let x = x0 + C * 0.6; x < x1 - C * 3; x += C * 2.2) {
          box(x, fy - C * 3, C * 1.8, C * 3, '#5c3d24');
          for (let sy2 = 0; sy2 < 3; sy2++) for (let b = 0; b < 4; b++) box(x + C * (0.15 + b * 0.4), fy - C * (2.8 - sy2), C * 0.3, C * 0.7, ['#7f1d1d', '#1e3a8a', '#365314', '#a16207'][(b + sy2) % 4]);
        }
        box(x1 - C * 2, fy - C * 1.8, C * 1.2, C * 1.8, '#78716c');
        lit(x1 - C * 1.4, fy - C * 1.2, C * 2.4, '#7dd3fc', 0.35 + 0.15 * Math.sin(t * 2));
        break;
      default:
        break;
    }
    if (room.ruined) {
      ctx.strokeStyle = 'rgba(203,213,225,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(SX(x0), SY(ty + C * 2));
      ctx.lineTo(SX(x0 + C * 2), SY(ty));
      ctx.moveTo(SX(x1), SY(ty + C * 2));
      ctx.lineTo(SX(x1 - C * 2), SY(ty));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- torches --------------------------------------------------------------------------------------

  function torches(t: number) {
    if (world.fallen) return;
    for (const lv of world.levels) {
      if (!lv) continue;
      for (let c = lv.left + 2; c <= lv.right - 1; c += 7) {
        const i = (lv.floor - 1) * cols + c;
        if (!isOpen(mat[i]) || mat[i] === M.SKY) continue;
        const x = world.cellX(i);
        const y = (lv.floor - 1.4) * CELL;
        if (!visible(x, y)) continue;
        const f = 0.85 + 0.15 * Math.sin(t * 9 + c * 1.3) * Math.sin(t * 4.3 + c);
        box(x - CELL * 0.08, y, CELL * 0.16, CELL * 0.5, '#57534e');
        box(x - CELL * 0.12, y - CELL * 0.25, CELL * 0.24, CELL * 0.25, '#fbbf24');
        glowsLater.push([SX(x), SY(y), CELL * 5 * Z * f, '#f59e0b', 0.42 * f]);
      }
    }
  }

  // ---- people and things -----------------------------------------------------------------------------

  function dwarfSprite(d: Dwarf, t: number, p: number) {
    const X = Math.round(SX(d.x));
    const Y = Math.round(SY(d.y));
    if (X < -30 || X > W + 30 || Y < -30 || Y > H + 40) return;
    const f = d.facing;
    const R = (tx: number, ty: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      const x = f > 0 ? tx : -tx - w;
      ctx.fillRect(X + x * p, Y + ty * p, w * p, h * p);
    };
    if (!d.alive) {
      ctx.globalAlpha = Math.max(0, 0.7 - (world.t - d.deadAt) / 40);
      ctx.fillStyle = JOB_COLOR[d.job];
      ctx.fillRect(X - 3 * p, Y - 2 * p, 6 * p, 2 * p);
      ctx.fillStyle = BEARDS[d.beard];
      ctx.fillRect(X + 2 * p, Y - 2 * p, 2 * p, 2 * p);
      ctx.globalAlpha = 1;
      return;
    }
    const walking = d.ri < d.route.length;
    const step = walking ? Math.floor(d.anim) % 2 : 0;
    const swing = d.swingUntil > world.t ? Math.floor(t * 8) % 2 : -1;
    const sleeping = d.task?.kind === 'sleep' && !walking;
    if (sleeping) {
      R(-3, -2, 6, 2, '#5c3d24');
      R(1, -3, 2, 2, '#f1c7a1');
      R(-2, -3, 3, 1, BEARDS[d.beard]);
      return;
    }
    const body = JOB_COLOR[d.job];
    R(-2, -2, 2, 2 - step, '#292524');
    R(0, -2, 2, 2 - (1 - step), '#292524');
    R(-2, -6, 4, 4, body);
    R(-2, -3, 4, 1, '#3f2a17');
    R(0, -8, 2, 2, d.sick >= 0 ? '#a3e635' : '#f1c7a1');
    R(-1, -8, 1, 2, '#e8b38c');
    R(0, -6, 2, 3, BEARDS[d.beard]);
    R(1, -7, 1, 1, BEARDS[d.beard]);
    if (d.job === 'king') {
      R(-1, -9, 3, 1, '#facc15');
      R(-1, -10, 1, 1, '#facc15');
      R(1, -10, 1, 1, '#facc15');
    } else if (d.job === 'soldier') {
      R(-1, -9, 3, 1, '#cbd5e1');
      R(-2, -6, 1, 3, '#64748b');
    } else R(-1, -9, 3, 1, d.job === 'farmer' || d.job === 'brewer' ? '#a16207' : '#57534e');
    // The tool in hand.
    const tool = d.job === 'miner' ? 'pick' : d.job === 'mason' || d.job === 'smith' ? 'hammer' : d.job === 'soldier' ? (d.crossbow ? 'bow' : 'axe') : null;
    if (d.carry) {
      R(2, -4, 3, 2, '#5c3d24');
      R(2.5, -5, 2, 1, d.carry.kind === 'gold' ? '#facc15' : d.carry.kind === 'gem' ? '#c084fc' : d.carry.kind === 'mithril' ? '#e0f2fe' : d.carry.kind === 'coal' ? '#18181b' : '#a0522d');
    } else if (tool) {
      const up = swing === 1;
      if (tool === 'bow') {
        R(2, -5, 3, 1, '#6b4a2b');
        R(4, -6, 1, 3, '#a16207');
      } else {
        R(2, up ? -9 : -6, 1, up ? 4 : 3, '#6b4a2b');
        if (tool === 'pick') R(up ? 1 : 2, up ? -10 : -7, 3, 1, '#a8a29e');
        else if (tool === 'hammer') R(1.5, up ? -10 : -7, 2, 1.5, '#57534e');
        else R(2.5, up ? -10 : -7, 2, 2, '#cbd5e1');
      }
    }
    if (d.task?.kind === 'mood') glowsLater.push([X, Y - 6 * p, 18 * p, '#a78bfa', 0.4 + 0.2 * Math.sin(t * 6)]);
    if (d.job === 'miner' && !world.fallen) glowsLater.push([X + f * 2 * p, Y - 9 * p, 8 * p, '#fde68a', 0.25]);
  }

  function foeSprite(fo: Foe, p: number) {
    // The great ones are drawn great.
    if (fo.boss) p *= 2.2;
    const X = Math.round(SX(fo.x));
    const Y = Math.round(SY(fo.y));
    if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) return;
    const f = fo.facing;
    const R = (tx: number, ty: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(X + (f > 0 ? tx : -tx - w) * p, Y + ty * p, w * p, h * p);
    };
    const step = Math.floor(fo.anim) % 2;
    const sw = fo.swingUntil > world.t;
    ctx.globalAlpha = fo.alive ? (fo.active ? 1 : 0.75) : Math.max(0, 0.6 - (world.t - fo.deadAt) / 20);
    switch (fo.kind) {
      case 'goblin':
        R(-1, -2, 1, 2 - step, '#292524');
        R(1, -2, 1, 2 - (1 - step), '#292524');
        R(-1, -5, 3, 3, '#57534e');
        R(-1, -7, 3, 2, '#4d7c0f');
        R(2, -7, 1, 1, '#4d7c0f');
        R(1, -7, 1, 1, '#fde047');
        R(3, sw ? -8 : -6, 1, 5, '#a8a29e');
        break;
      case 'troll':
        R(-3, -4, 2, 4 - step, '#3f3f46');
        R(1, -4, 2, 4 - (1 - step), '#3f3f46');
        R(-4, -11, 8, 7, '#52525b');
        R(-2, -14, 5, 3, '#71717a');
        R(1, -13, 1, 1, '#fde047');
        R(4, sw ? -15 : -10, 2, 7, '#6b4a2b');
        break;
      case 'spider': {
        if (!fo.alive) break;
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = Math.max(1, p * 0.7);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
          const a = Math.sin(fo.anim * 2 + k + (s > 0 ? 1 : 0)) * 0.5;
          ctx.moveTo(X + s * p, Y - 3 * p);
          ctx.lineTo(X + s * (3 + k) * p, Y - (5 - a * 2) * p);
          ctx.lineTo(X + s * (4 + k * 1.2) * p, Y);
        }
        ctx.stroke();
        R(-3, -5, 6, 3, '#27272a');
        R(2, -6, 3, 2, '#18181b');
        R(4, -6, 1, 1, '#ef4444');
        break;
      }
      case 'skeleton':
        R(-1, -2, 1, 2 - step, '#e5e7eb');
        R(1, -2, 1, 2 - (1 - step), '#e5e7eb');
        R(0, -6, 1, 4, '#e5e7eb');
        R(-1, -5, 3, 1, '#d4d4d8');
        R(-1, -8, 3, 2, '#f4f4f5');
        R(1, -7, 1, 1, '#22d3ee');
        R(2, sw ? -9 : -6, 1, 4, '#94a3b8');
        if (fo.alive) glowsLater.push([X, Y - 7 * p, 6 * p, '#22d3ee', 0.4]);
        break;
      case 'crawler':
        for (let k = 0; k < 4; k++) R(-4 + k * 2, -3 + (k + step) % 2 * 0.5, 2, 2.5, k % 2 ? '#581c87' : '#6b21a8');
        R(4, -3, 2, 2, '#3b0764');
        R(5, -3, 1, 1, '#f0abfc');
        break;
      case 'trader':
        R(-1, -2, 1, 2 - step, '#1c1917');
        R(1, -2, 1, 2 - (1 - step), '#1c1917');
        R(-2, -8, 4, 6, '#1e3a8a');
        R(-1, -10, 3, 2, '#f1c7a1');
        R(-2, -11, 5, 1, '#713f12');
        break;
      case 'mule':
        R(-4, -2, 1, 2, '#3f2a17');
        R(3, -2, 1, 2, '#3f2a17');
        R(-4, -5, 8, 3, '#78553a');
        R(3, -7, 3, 2, '#78553a');
        R(-3, -7, 5, 2, '#a16207');
        break;
      case 'golem': {
        const sw2 = sw ? -2 : 0;
        R(-3, -4, 2, 4 - step, '#57534e');
        R(1, -4, 2, 4 - (1 - step), '#57534e');
        R(-4, -11, 8, 7, '#78716c');
        R(-4, -11, 8, 1, '#a8a29e');
        R(-2, -14, 4, 3, '#78716c');
        R(0, -13, 1, 1, '#fbbf24');
        R(4, -10 + sw2, 2, 5, '#57534e');
        R(-6, -10, 2, 5, '#57534e');
        if (fo.alive) glowsLater.push([X + f * p, Y - 13 * p, 5 * p, '#fbbf24', 0.6]);
        break;
      }
      case 'gnome':
        R(-1, -2, 1, 2 - step, '#292524');
        R(1, -2, 1, 2 - (1 - step), '#292524');
        R(-1, -5, 3, 3, '#365314');
        R(0, -7, 2, 2, '#f1c7a1');
        R(0, -5, 2, 2, '#e5e7eb');
        R(-1, -8, 3, 1, '#dc2626');
        R(0, -10, 2, 2, '#dc2626');
        R(1, -11, 1, 1, '#dc2626');
        glowsLater.push([X + f * 3 * p, Y - 5 * p, 6 * p, '#fbbf24', 0.5]);
        break;
      case 'mushroom': {
        const cap = tint.fungus[fo.id % tint.fungus.length];
        R(-1, -5, 2, 5, '#e7e5e4');
        R(-3, -8, 6, 3, cap);
        R(-2, -9, 4, 1, cap);
        R(-1, -7, 1, 1, '#ffffff');
        R(1, -8, 1, 1, '#ffffff');
        glowsLater.push([X, Y - 7 * p, 8 * p, cap, 0.35]);
        break;
      }
      case 'lich': {
        // Robed, crowned, its staff burning green.
        R(-4, -12, 8, 12, '#1f2937');
        R(-3, -12, 2, 11, '#374151');
        R(-2, -16, 4, 4, '#e5e7eb');
        R(-2, -17, 4, 1, '#ca8a04');
        R(-2, -18, 1, 1, '#ca8a04');
        R(1, -18, 1, 1, '#ca8a04');
        R(-1, -15, 1, 1, '#4ade80');
        R(1, -15, 1, 1, '#4ade80');
        R(5, -20, 1, 20, '#57534e');
        R(4, -22, 3, 3, '#86efac');
        if (fo.alive) {
          glowsLater.push([X + f * 5.5 * p, Y - 21 * p, 14 * p, '#4ade80', 0.7]);
          glowsLater.push([X, Y - 10 * p, 26 * p, '#16a34a', 0.25 + 0.1 * Math.sin(world.t * 2)]);
        }
        break;
      }
      case 'engine': {
        // The elder engine: wheels within wheels, turning, its furnace-heart open.
        const t2 = world.t;
        for (const [ox, oy, rr, sp] of [[0, -10, 9, 0.6], [-11, -5, 5, -1.1], [10, -15, 6, -0.9], [8, -3, 4, 1.4]] as [number, number, number, number][]) {
          const cx = X + ox * p;
          const cy = Y + oy * p;
          ctx.strokeStyle = fo.alive ? '#a16207' : '#57534e';
          ctx.lineWidth = Math.max(1, p * 1.2);
          ctx.beginPath();
          ctx.arc(cx, cy, rr * p, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + (fo.alive ? t2 * sp : 0);
            ctx.moveTo(cx + Math.cos(a) * rr * p, cy + Math.sin(a) * rr * p);
            ctx.lineTo(cx + Math.cos(a) * (rr + 1.6) * p, cy + Math.sin(a) * (rr + 1.6) * p);
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * rr * p, cy + Math.sin(a) * rr * p);
          }
          ctx.stroke();
        }
        R(-3, -13, 6, 6, fo.alive ? '#fb923c' : '#292524');
        if (fo.alive) glowsLater.push([X, Y - 10 * p, 30 * p, '#f97316', 0.5 + 0.15 * Math.sin(world.t * 5)]);
        break;
      }
      case 'queen': {
        // Vast and pale, a body of eggs.
        ctx.fillStyle = fo.alive ? '#d8b4fe' : '#57534e';
        ctx.beginPath();
        ctx.ellipse(X - f * 6 * p, Y - 6 * p, 10 * p, 6 * p, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4c1d95';
        for (let k = 0; k < 4; k++) ctx.fillRect(X - f * (12 - k * 4) * p, Y - 10 * p, p, 8 * p);
        R(2, -10, 6, 5, '#3b0764');
        R(7, -9, 2, 2, '#f0abfc');
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = Math.max(1, p * 0.8);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) {
          ctx.moveTo(X + f * (3 + k * 2) * p, Y - 6 * p);
          ctx.lineTo(X + f * (3 + k * 2 + sd * 3) * p, Y - 2 * p + Math.sin(world.t * 6 + k) * p);
          ctx.lineTo(X + f * (3 + k * 2 + sd * 4) * p, Y);
        }
        ctx.stroke();
        if (fo.alive) glowsLater.push([X, Y - 6 * p, 30 * p, '#c084fc', 0.3]);
        break;
      }
      default:
        break;
    }
    ctx.globalAlpha = 1;
  }

  // ---- the caverns' furniture: geodes, shrines, hives, the engine's housing, warrens, gnome hollows, and their life ----

  const caveBox = world.caverns.map(() => ({ c0: Infinity, c1: -Infinity, r0: Infinity, r1: -Infinity }));
  const ceilings: { x: number; y: number; cave: number; seed: number }[] = [];
  for (let i = cols; i < mat.length - cols; i++) {
    const cv = world.caveAt[i];
    if (cv < 0) continue;
    const c = i % cols;
    const rr = Math.floor(i / cols);
    const b = caveBox[cv];
    b.c0 = Math.min(b.c0, c);
    b.c1 = Math.max(b.c1, c);
    b.r0 = Math.min(b.r0, rr);
    b.r1 = Math.max(b.r1, rr);
    if (!isOpen(mat[i - cols]) && hash(i, 31) < 0.18) ceilings.push({ x: world.cellX(i), y: rr * CELL, cave: cv, seed: i });
  }
  const castHas = (id: string) => world.castIds.includes(id);
  function caveDecor(t: number) {
    world.caverns.forEach((cv, k) => {
      const b = caveBox[k];
      if (b.c1 < b.c0) return;
      const x0 = b.c0 * CELL;
      const x1 = (b.c1 + 1) * CELL;
      const y0 = b.r0 * CELL;
      const y1 = (b.r1 + 1) * CELL;
      if (!visible((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 40)) return;
      const lit = cv.known ? 1 : 0.45;
      const fl = y1;
      switch (cv.kind) {
        case 'geode':
          for (let n = 0; n < 26; n++) {
            const u = hash(k, n, 1);
            const up = hash(k, n, 2) < 0.5;
            const x = x0 + u * (x1 - x0);
            const base = up ? y0 + CELL : fl;
            const len = (1 + hash(k, n, 3) * 2.2) * CELL;
            const col = hash(k, n, 4) < 0.5 ? '#a78bfa' : '#67e8f9';
            ctx.fillStyle = hexA(col, 0.75 * lit);
            ctx.beginPath();
            ctx.moveTo(SX(x - CELL * 0.4), SY(base));
            ctx.lineTo(SX(x + (hash(k, n, 5) - 0.5) * CELL), SY(base + (up ? len : -len)));
            ctx.lineTo(SX(x + CELL * 0.4), SY(base));
            ctx.fill();
            if (Math.sin(t * 1.3 + n) > 0.85) glowsLater.push([SX(x), SY(base + (up ? len : -len) * 0.8), CELL * 2.2 * Z, col, 0.6 * lit]);
          }
          glowsLater.push([SX((x0 + x1) / 2), SY((y0 + y1) / 2), (x1 - x0) * 0.5 * Z, '#8b5cf6', 0.16 * lit]);
          break;
        case 'shrine': {
          const x = (x0 + x1) / 2;
          box(x - CELL * 1.2, fl - CELL * 0.7, CELL * 2.4, CELL * 0.7, '#57534e');
          box(x - CELL * 0.7, fl - CELL * 4.5, CELL * 1.4, CELL * 3.8, '#8a8478');
          box(x - CELL * 0.9, fl - CELL * 5.4, CELL * 1.8, CELL * 1, '#a8a29e');
          box(x - CELL * 0.4, fl - CELL * 3.6, CELL * 0.8, CELL * 1.2, '#ca8a04');
          glowsLater.push([SX(x), SY(fl - CELL * 3), CELL * 7 * Z, '#fde68a', (cv.known ? 0.45 : 0.15) * (0.8 + 0.2 * Math.sin(t))]);
          break;
        }
        case 'hive':
          for (let n = 0; n < 18; n++) {
            const x = x0 + hash(k, n, 6) * (x1 - x0);
            const y = fl - CELL * (0.3 + hash(k, n, 7) * 1.5);
            ctx.fillStyle = hexA('#e9d5ff', 0.55 * lit);
            ctx.beginPath();
            ctx.ellipse(SX(x), SY(y), CELL * 0.5 * Z, CELL * 0.7 * Z, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.strokeStyle = hexA('#d6d3d1', 0.25 * lit);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let n = 0; n < 10; n++) {
            ctx.moveTo(SX(x0 + hash(k, n, 8) * (x1 - x0)), SY(y0 + CELL));
            ctx.lineTo(SX(x0 + hash(k, n, 9) * (x1 - x0)), SY(fl - CELL * 2));
          }
          ctx.stroke();
          break;
        case 'engine':
          // Before it wakes: the housing and its still wheels.
          if (!world.foes.some((f) => f.kind === 'engine' && f.home === cv.id)) {
            for (const [ox, rr] of [[0, 4], [-5, 2.5], [5, 3]] as [number, number][]) {
              ctx.strokeStyle = hexA('#78716c', 0.6 * lit);
              ctx.lineWidth = Math.max(1, Z * 1.5);
              ctx.beginPath();
              ctx.arc(SX((x0 + x1) / 2 + ox * CELL), SY(fl - CELL * 4), rr * CELL * Z, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          break;
        case 'warren':
          for (let n = 0; n < 5; n++) {
            const x = x0 + ((n + 0.5) / 5) * (x1 - x0);
            box(x, fl - CELL * 1.6, CELL * 0.2, CELL * 1.6, '#57534e');
            glowsLater.push([SX(x), SY(fl - CELL * 1.8), CELL * 3 * Z, '#ef4444', 0.35 * lit * (0.8 + 0.2 * Math.sin(t * 7 + n))]);
          }
          break;
        case 'gnomes':
          for (let n = 0; n < 6; n++) {
            const x = x0 + ((n + 0.5) / 6) * (x1 - x0);
            box(x - CELL * 0.8, fl - CELL * 1.6, CELL * 1.6, CELL * 1.6, '#7c5a36');
            box(x - CELL, fl - CELL * 2.1, CELL * 2, CELL * 0.6, '#b91c1c');
            glowsLater.push([SX(x), SY(fl - CELL), CELL * 2.5 * Z, '#fbbf24', 0.45 * lit]);
          }
          break;
        default:
          break;
      }
      // Bats, in the caverns the miners have opened.
      if (castHas('bats') && cv.known && (cv.kind === 'cavern' || cv.kind === 'lake')) {
        ctx.strokeStyle = 'rgba(214,211,209,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let n = 0; n < 9; n++) {
          const ph = t * 0.35 + n * 0.7 + k;
          const x = (x0 + x1) / 2 + Math.sin(ph) * (x1 - x0) * 0.4;
          const y = (y0 + y1) / 2 + Math.sin(ph * 1.7) * (y1 - y0) * 0.3;
          const fl2 = Math.sin(t * 14 + n) * 2 * Z;
          ctx.moveTo(SX(x) - 3 * Z, SY(y) - fl2);
          ctx.lineTo(SX(x), SY(y));
          ctx.lineTo(SX(x) + 3 * Z, SY(y) - fl2);
        }
        ctx.stroke();
      }
    });
    // Glow-worms on the cavern ceilings.
    if (castHas('glowworms')) for (const c of ceilings) {
      const X = SX(c.x);
      const Y = SY(c.y);
      if (X < -10 || X > W + 10 || Y < -10 || Y > H + 10) continue;
      const a = (world.caverns[c.cave]?.known ? 0.7 : 0.3) * (0.6 + 0.4 * Math.sin(t * 0.8 + c.seed));
      glowsLater.push([X, Y + 2, 4 * Z, '#5eead4', a]);
    }
  }

  /** What sleeps below: drawn large, by kind; dim and breathing asleep, lit and terrible awake. */
  function sleeperDraw(t: number) {
    const s = world.sleeper;
    if (!s) return;
    const X = SX(s.x);
    const Y = SY(s.y);
    const u = CELL * cam.zoom;
    if (X < -u * 14 || X > W + u * 14 || Y < -u * 14 || Y > H + u * 10) return;
    const awake = s.state !== 'sleep' && s.state !== 'dead';
    const dead = s.state === 'dead';
    const breathe = 0.5 + 0.5 * Math.sin(t * (awake ? 3 : 0.8));
    const f = s.facing;
    ctx.save();
    if (dead) ctx.globalAlpha = 0.55;
    const eyes = (x: number, y: number, color: string, n = 2) => {
      if (dead || (!awake && Math.sin(t * 0.3) < 0.7)) return;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = color;
        ctx.fillRect(x + k * u * 0.6 * f, y, u * 0.35, u * 0.25);
        glowsLater.push([x + k * u * 0.6 * f, y, u * 1.5, color, awake ? 0.6 : 0.3]);
      }
    };
    switch (s.kind) {
      case 'worm': {
        // Segments trailing back and down from the head.
        const n = 12;
        for (let k = n; k >= 0; k--) {
          const a = k * 0.55 + (awake ? s.anim * 2 : t * 0.2);
          const px = awake ? X - f * k * u * 1.1 + Math.sin(a) * u * 0.8 : X + Math.cos(k * 0.6) * u * 3.2;
          const py = awake ? Y - u * 2 + k * u * 0.6 + Math.cos(a) * u * 0.5 : Y - u * 2 + Math.sin(k * 0.6) * u * 1.6;
          const rad = u * (1.7 - k * 0.06);
          ctx.fillStyle = k % 2 ? mixHex(s.tint, '#000000', 0.25) : s.tint;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#9a3412';
          ctx.fillRect(px - rad * 0.6, py - rad * 0.9, rad * 1.2, rad * 0.25);
        }
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(X + f * u * 1.2, Y - u * 2, u * 1.2 * (awake ? 0.6 + breathe * 0.4 : 0.4), 0, Math.PI * 2);
        ctx.fill();
        eyes(X + f * u * 0.2, Y - u * 3.2, '#fb923c');
        break;
      }
      case 'spider': {
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = Math.max(1, u * 0.35);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {
          const a = awake ? Math.sin(s.anim * 3 + k + sd) * 0.4 : 0;
          ctx.moveTo(X + sd * u, Y - u * 3);
          ctx.lineTo(X + sd * u * (4 + k * 1.4), Y - u * (6.5 - k * 0.6 + a * 2));
          ctx.lineTo(X + sd * u * (5 + k * 1.8), Y);
        }
        ctx.stroke();
        const g = ctx.createRadialGradient(X, Y - u * 3, u * 0.5, X, Y - u * 3, u * 4);
        g.addColorStop(0, hexA(mixHex(s.tint, '#ffffff', 0.4), 0.95));
        g.addColorStop(1, 'rgba(76,29,149,0.9)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(X - f * u * 1.5, Y - u * 3, u * 4, u * 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(X + f * u * 2.4, Y - u * 3.2, u * 1.8, u * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        glowsLater.push([X, Y - u * 3, u * 9, '#c084fc', 0.25 + breathe * 0.2]);
        eyes(X + f * u * 3, Y - u * 3.8, '#f0abfc', 4);
        break;
      }
      case 'giant':
      case 'demon': {
        const demon = s.kind === 'demon';
        const crouch = !awake && !dead ? 0.6 : 1;
        const body = s.tint;
        const shade = demon ? '#2a1410' : '#64748b';
        const h = u * 9 * crouch;
        if (demon && !dead) {
          // Wings, and the fire about it.
          ctx.fillStyle = 'rgba(87,38,28,0.9)';
          for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(X, Y - h * 0.75);
            ctx.lineTo(X + sd * u * (awake ? 7 + breathe : 4), Y - h * (awake ? 1.15 : 0.95));
            ctx.lineTo(X + sd * u * (awake ? 6 : 3.5), Y - h * 0.45);
            ctx.lineTo(X + sd * u * 2, Y - h * 0.55);
            ctx.fill();
          }
          for (let k = 0; k < 10; k++) {
            const a = (t * 1.5 + hash(k, 3)) % 1;
            ctx.fillStyle = hexA(a < 0.4 ? '#fde68a' : a < 0.7 ? '#fb923c' : '#dc2626', (awake ? 0.8 : 0.35) * (1 - a));
            ctx.fillRect(X + (hash(k, 5) - 0.5) * u * 4, Y - h * (0.2 + a * 0.9), u * 0.6, u * 0.9);
          }
          glowsLater.push([X, Y - h * 0.6, u * (awake ? 14 : 8), '#f97316', awake ? 0.55 : 0.25 + breathe * 0.1]);
        } else if (!dead) glowsLater.push([X, Y - h * 0.6, u * 10, '#7dd3fc', 0.2 + breathe * 0.15]);
        ctx.fillStyle = shade;
        ctx.fillRect(X - u * 1.6, Y - h * 0.4, u * 1.2, h * 0.4);
        ctx.fillRect(X + u * 0.4, Y - h * 0.4, u * 1.2, h * 0.4);
        ctx.fillStyle = body;
        ctx.fillRect(X - u * 2.2, Y - h * 0.82, u * 4.4, h * 0.45);
        ctx.fillRect(X - u * 3.2 + (awake ? Math.sin(s.anim * 3) * u * 0.4 : 0), Y - h * 0.8, u, h * 0.42);
        ctx.fillRect(X + u * 2.2, Y - h * 0.8, u, h * 0.42);
        ctx.fillRect(X - u * 1.1, Y - h, u * 2.2, h * 0.2);
        if (demon && !dead) {
          // Cracks of fire through it.
          ctx.strokeStyle = hexA('#f97316', awake ? 0.9 : 0.5);
          ctx.lineWidth = Math.max(1, u * 0.18);
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const x = X - u * 1.8 + k * u * 0.9;
            ctx.moveTo(x, Y - h * 0.8);
            ctx.lineTo(x + Math.sin(k * 2.1) * u * 0.6, Y - h * 0.6);
            ctx.lineTo(x - Math.cos(k * 1.3) * u * 0.4, Y - h * 0.42);
          }
          ctx.stroke();
          ctx.strokeStyle = hexA('#ea580c', 0.8);
          ctx.strokeRect(X - u * 2.2, Y - h * 0.82, u * 4.4, h * 0.45);
        }
        if (demon) {
          ctx.fillStyle = '#44403c';
          ctx.fillRect(X - u * 1.4, Y - h * 1.08, u * 0.4, h * 0.1);
          ctx.fillRect(X + u * 1, Y - h * 1.08, u * 0.4, h * 0.1);
        } else {
          ctx.fillStyle = '#e0f2fe';
          for (let k = 0; k < 4; k++) ctx.fillRect(X - u * 1.1 + k * u * 0.6, Y - h * 1.07, u * 0.3, h * 0.07);
        }
        eyes(X - u * 0.7, Y - h * 0.92, demon ? '#facc15' : '#38bdf8');
        break;
      }
      case 'tentacle': {
        ctx.strokeStyle = mixHex(s.tint, '#ffffff', 0.15);
        ctx.lineCap = 'round';
        for (let k = 0; k < 7; k++) {
          ctx.lineWidth = u * (0.9 - k * 0.05);
          ctx.beginPath();
          const a0 = (k / 7) * Math.PI * 2;
          ctx.moveTo(X, Y - u * 3);
          const wave = awake ? s.anim * 2 : t * 0.3;
          const ex = X + Math.cos(a0) * u * (awake ? 8 : 5);
          const ey = Y - u * 3 + Math.sin(a0) * u * (awake ? 5 : 3) + u * 2;
          ctx.quadraticCurveTo(X + Math.cos(a0 + Math.sin(wave + k)) * u * 5, Y - u * 3 + Math.sin(a0 + Math.cos(wave + k)) * u * 4, ex, ey);
          ctx.stroke();
        }
        ctx.fillStyle = s.tint;
        ctx.beginPath();
        ctx.arc(X, Y - u * 3, u * 3.2, 0, Math.PI * 2);
        ctx.fill();
        if (!dead && (awake || Math.sin(t * 0.25) > 0.6)) {
          ctx.fillStyle = '#bef264';
          ctx.beginPath();
          ctx.ellipse(X + f * u * 0.6, Y - u * 3.4, u * 1.1, u * (awake ? 0.8 : 0.25), 0, 0, Math.PI * 2);
          ctx.fill();
          glowsLater.push([X, Y - u * 3.4, u * 8, '#a3e635', awake ? 0.5 : 0.25]);
        }
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  function effects(t: number) {
    const Zz = cam.zoom;
    for (const e of world.fx) {
      const k = (t - e.t0) / e.dur;
      if (k < 0 || k > 1) continue;
      const X = SX(e.x);
      const Y = SY(e.y);
      if (X < -100 || X > W + 100 || Y < -100 || Y > H + 100) continue;
      switch (e.kind) {
        case 'dust':
          for (let n = 0; n < 4; n++) {
            ctx.fillStyle = `rgba(168,162,158,${(0.25 * (1 - k)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(X + (hash(e.seed, n) - 0.5) * e.r * 2 * Zz, Y - k * e.r * Zz + (hash(n, e.seed) - 0.5) * e.r * Zz, e.r * (0.4 + k) * Zz, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'spark':
          ctx.fillStyle = hexA(e.color ?? '#fde68a', 1 - k);
          ctx.fillRect(X + (hash(e.seed, 1) - 0.5) * 14 * Zz * k, Y - k * 10 * Zz * hash(e.seed, 2), Math.max(1, Zz * 1.2), Math.max(1, Zz * 1.2));
          glowsLater.push([X, Y, 6 * Zz, e.color ?? '#fde68a', 0.4 * (1 - k)]);
          break;
        case 'glint': {
          const r = e.r * Zz * (0.4 + k * 0.6);
          ctx.strokeStyle = hexA(e.color ?? '#fde68a', 1 - k);
          ctx.lineWidth = Math.max(1, Zz);
          ctx.beginPath();
          ctx.moveTo(X - r, Y);
          ctx.lineTo(X + r, Y);
          ctx.moveTo(X, Y - r);
          ctx.lineTo(X, Y + r);
          ctx.stroke();
          glowsLater.push([X, Y, r * 1.6, e.color ?? '#fde68a', 0.6 * (1 - k)]);
          break;
        }
        case 'blast':
          glowsLater.push([X, Y, e.r * Zz * (0.5 + k), '#fb923c', 0.9 * (1 - k)]);
          ctx.fillStyle = hexA('#fef3c7', 0.8 * (1 - k) ** 2);
          ctx.beginPath();
          ctx.arc(X, Y, e.r * Zz * 0.5 * (0.3 + k), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'steam':
          ctx.fillStyle = `rgba(226,232,240,${(0.35 * (1 - k)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(X + Math.sin(e.seed + k * 4) * 6 * Zz, Y - k * 40 * Zz, e.r * (0.5 + k) * Zz, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'rubble': {
          const y = e.y + ((e.y1 ?? e.y) - e.y) * Math.min(1, k * k * 1.4);
          ctx.fillStyle = '#78716c';
          ctx.fillRect(X, SY(y), e.r * Zz * 1.4, e.r * Zz * 1.4);
          break;
        }
        case 'bolt': {
          const x = e.x + ((e.x1 ?? e.x) - e.x) * k;
          const y = e.y + ((e.y1 ?? e.y) - e.y) * k;
          ctx.strokeStyle = '#e7e5e4';
          ctx.lineWidth = Math.max(1, Zz * 0.8);
          ctx.beginPath();
          ctx.moveTo(SX(x), SY(y));
          ctx.lineTo(SX(x - Math.sign((e.x1 ?? e.x) - e.x) * CELL * 0.7), SY(y));
          ctx.stroke();
          break;
        }
        case 'fire':
          for (let n = 0; n < 6; n++) {
            const a = (k + hash(e.seed, n)) % 1;
            ctx.fillStyle = hexA(a < 0.4 ? '#fde68a' : a < 0.7 ? '#fb923c' : '#dc2626', 0.9 * (1 - a));
            ctx.fillRect(X + (hash(e.seed, n, 1) - 0.5) * e.r * 2 * Zz, Y - a * e.r * 2 * Zz, 2 * Zz, 3 * Zz);
          }
          glowsLater.push([X, Y, e.r * 3 * Zz, '#f97316', 0.5 * (1 - k)]);
          break;
        case 'z':
          ctx.fillStyle = `rgba(226,232,240,${(0.6 * (1 - k)).toFixed(3)})`;
          ctx.font = `${Math.max(7, Math.round(7 * Zz))}px ${serif(7).split('px ')[1]}`;
          ctx.fillText('z', X + k * 6 * Zz, Y - k * 14 * Zz);
          break;
        default:
          break;
      }
    }
  }

  /** The dark of the deep, and then the lights in it. */
  function dark(t: number) {
    const top = SY(world.gate.floor * CELL - CELL * 6);
    const bottom = SY(world.GH);
    if (bottom > 0) {
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      const night = darkness();
      g.addColorStop(0, `rgba(3,3,8,${(0.1 + night * 0.15).toFixed(3)})`);
      g.addColorStop(0.5, 'rgba(3,3,8,0.32)');
      g.addColorStop(1, 'rgba(8,2,2,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.max(0, top), W, H);
      if (top > 0) {
        ctx.fillStyle = `rgba(3,4,10,${(0.35 * night).toFixed(3)})`;
        ctx.fillRect(0, 0, W, top);
      }
    }
    // A fallen hold is a dark hold.
    if (world.fallen) {
      ctx.fillStyle = 'rgba(2,2,4,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const fu of fungus) {
      const X = SX(fu.x);
      const Y = SY(fu.y);
      if (X < -30 || X > W + 30 || Y < -30 || Y > H + 30) continue;
      const known = world.caverns[fu.cave]?.known;
      const a = (known ? 0.35 : 0.16) * (0.7 + 0.3 * Math.sin(t * 0.7 + fu.seed));
      ctx.fillStyle = hexA(fu.color, Math.min(1, a * 2.2));
      ctx.fillRect(X, Y - CELL * 0.4 * cam.zoom, Math.max(1, cam.zoom * 1.5), Math.max(1, CELL * 0.4 * cam.zoom));
      glow(X, Y - CELL * 0.3 * cam.zoom, CELL * 1.8 * cam.zoom, fu.color, a);
    }
    for (const [x, y, r, color, a] of glowsLater) glow(x, y, r, color, a);
    ctx.restore();
    glowsLater = [];
  }

  function gate(t: number) {
    const g = world.gate;
    const x = g.c * CELL;
    const fy = (g.floor + 1) * CELL;
    if (!visible(x, fy, 120)) return;
    const C = CELL;
    // The carved face above the gate.
    const fx = x - g.side * C * 2;
    box(fx - C * 2.5, fy - C * 8, C * 5, C * 4.6, 'rgba(120,113,108,0.65)');
    box(fx - C * 1.6, fy - C * 7, C * 1, C * 0.6, '#292524');
    box(fx + C * 0.6, fy - C * 7, C * 1, C * 0.6, '#292524');
    box(fx - C * 2, fy - C * 6, C * 4, C * 2.4, 'rgba(168,162,158,0.7)');
    for (let k = 0; k < 5; k++) box(fx - C * 1.8 + k * C * 0.8, fy - C * 5.6, C * 0.3, C * 2, 'rgba(87,83,78,0.7)');
    // The doors.
    if (!g.open) {
      box(x, fy - C * 3, C, C * 3, '#5c3d24');
      box(x, fy - C * 2.2, C, C * 0.2, '#3f3f46');
      box(x, fy - C * 1, C, C * 0.2, '#3f3f46');
    } else {
      box(x + g.side * C * 0.1, fy - C * 3, C * 0.25, C * 3, '#5c3d24');
    }
    // Banners either side.
    for (const s of [-1.5, 1.5]) {
      const bx = x + s * C * 1.2 - C * 0.3;
      box(bx, fy - C * 3.4, C * 0.6, C * 2 + Math.sin(t * 2 + s) * C * 0.1, '#7f1d1d');
      box(bx + C * 0.15, fy - C * 2.9, C * 0.3, C * 0.3, '#d4a017');
    }
    glowsLater.push([SX(x + g.side * C * 2), SY(fy - C * 2), C * 6 * Z, '#f59e0b', 0.3]);
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
      let y = Math.max(84, Math.min(H - 76, SY(l.y) - 18));
      for (let tries = 0; tries < 6 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18); tries++) y -= 19;
      placed.push([x, y, w]);
      ctx.fillStyle = `rgba(6,5,8,${(0.6 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 16);
      const [cr, cg, cb] = mixRgb(l.color, '#f5ecd7', 0.5);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(0.95 * a).toFixed(3)})`;
      fillCrisp(ctx, typed(l.text, age, 40, t), x, y);
    }
    ctx.restore();
  }

  const roman = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n);
  function hud(t: number, level: number) {
    if (!o.hud) return;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = serif(13);
    ctx.fillStyle = hexA('#e7dcc4', 0.88 * level);
    fillCrisp(ctx, `${world.name} UNDER ${MOUNTAIN_NAMES[world.mountain]} · THE ${world.clan} CLAN`, 16, 26);
    ctx.font = serif(11);
    ctx.fillStyle = hexA('#a8a29e', 0.88 * level);
    const pop = world.dwarves.filter((d) => d.alive).length;
    const king = world.king?.alive ? `KING ${world.king.name}${world.reign > 1 ? ` (${roman(Math.min(10, world.reign))} OF THE LINE)` : ''}` : world.fallen ? 'THE HOLD IS EMPTY' : 'NO KING';
    fillCrisp(ctx, `${king} · ${pop} DWARVES · WEALTH ${world.wealth().toLocaleString('en-US')} · DOWN TO ${deepName(Math.max(0, world.levels.length - 1))}`, 16, 42);
    const s = world.stocks;
    fillCrisp(ctx, `FOOD ${Math.round(s.food)} · ALE ${Math.round(s.ale)} · IRON ${s.iron} · COAL ${s.coal} · GOLD ${s.gold} · GEMS ${s.gem}${s.mithril ? ` · MITHRIL ${s.mithril}` : ''} · ${SEASONS[world.season]} ${world.year}`, 16, 57);
    ctx.font = serif(11, true);
    ctx.fillStyle = hexA('#a8a29e', 0.7 * level);
    fillCrisp(ctx, `This mountain holds ${world.cast.filter((c) => c !== 'only stone').slice(0, 7).join(', ')}.`, 16, 72);
    ctx.font = serif(11);
    ctx.textAlign = 'right';
    const sl = world.sleeper;
    const boss = world.foes.find((f) => f.boss);
    const awake = (sl && sl.state !== 'sleep' && sl.state !== 'dead') || (boss && boss.alive);
    const below = sl
      ? sl.state === 'sleep' ? 'BELOW: SOMETHING SLEEPS' : sl.state === 'stir' ? 'BELOW: SOMETHING STIRS' : sl.state === 'dead' ? `BELOW: ${sl.name}, SLAIN` : sl.state === 'return' ? `BELOW: ${sl.name} GOES DOWN AGAIN` : `${sl.name} IS AWAKE`
      : boss ? (boss.alive ? `BELOW: SOMETHING IS AWAKE` : 'BELOW: IT IS ENDED')
      : world.below === 'lich' ? 'BELOW: THE OLD HALLS ARE NOT EMPTY' : world.below === 'engine' ? 'BELOW: SOMETHING TICKS' : world.below === 'hive' ? 'BELOW: SOMETHING HUMS' : 'BELOW: ONLY STONE';
    ctx.fillStyle = hexA(awake ? '#fca5a5' : '#c4b5fd', 0.8 * level);
    if (below) fillCrisp(ctx, below, W - 16, 26);
    ctx.fillStyle = hexA('#fde68a', 0.75 * level);
    world.artifacts.slice(-3).forEach((a, k) => fillCrisp(ctx, `${a.name}, BY ${a.maker}`, W - 16, 42 + k * 15));
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
    },
    frame(info: FrameInfo) {
      step(info);
      const t = world.t;
      Z = cam.zoom;
      const level = 0.55 + 0.45 * host.intensity;
      shake = world.quake > 0.02 ? [Math.sin(t * 53) * world.quake * 3, Math.cos(t * 47) * world.quake * 2] : [0, 0];
      if (!rock) paintRock();
      touchUp();
      ctx.imageSmoothingEnabled = true;
      sky(t);
      snow(t);
      rockLayer();
      fluids(t);
      ctx.imageSmoothingEnabled = false;
      for (const room of world.rooms) furnish(room, t);
      torches(t);
      gate(t);
      const p = Math.max(1, Math.round(CELL * cam.zoom * 0.17 * 2) / 2);
      // Loads waiting to be carted.
      for (const l of world.loads) {
        const x = world.cellX(l.cell);
        const y = world.cellY(l.cell);
        if (!visible(x, y)) continue;
        box(x - CELL * 0.3, y - CELL * 0.35, CELL * 0.6, CELL * 0.35, l.kind === 'gold' ? '#facc15' : l.kind === 'gem' ? '#c084fc' : l.kind === 'mithril' ? '#e0f2fe' : l.kind === 'coal' ? '#18181b' : '#a0522d');
      }
      caveDecor(t);
      sleeperDraw(t);
      for (const f of world.foes) foeSprite(f, p);
      for (const d of world.dwarves) dwarfSprite(d, t, p);
      ctx.imageSmoothingEnabled = true;
      effects(t);
      dark(t);
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
      rock = null;
      rg = null;
    },
  };
}
