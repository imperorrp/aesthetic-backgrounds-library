/**
 * The dwarven kingdom's painter: the range (kingdom/sim.ts) in cutaway, pixel art at any zoom.
 *
 * The rock is a small texture (four texels a cell) painted once and touched up as the clans
 * dig; each hold dresses its halls in its own stone, so the holds read apart even at a
 * distance. Over it: water and magma, planks and stair treads, rails and carts, the lift in
 * its shaft, each room's furnishings (pillars, statues of kings, banners in the clan's
 * colour), the dwarves in their clan's colours, the things from below, the dragon over the
 * peaks; then the dark (deeper is darker) and each hold's lights, its own way: torches,
 * braziers, crystal lamps, or lava run in channels. No post-processing: the glow is a cached
 * sprite drawn additively, so it stays cheap.
 *
 * The camera follows the director (kit): the whole range from far off, one hold top to
 * bottom, or close in on the miners, the feast, the war, the dragon at the gate.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld } from '../../../kit';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../../instruments/kit';
import { serif } from '../names';
import { createKingdom, deepName, isOpen, M, MOUNTAIN_NAMES, SEASONS, type Dwarf, type Foe, type Hold, type KingdomWorld, type Mountain, type Room } from './sim';

const TEX = 4;
type RGB = [number, number, number];
type Tint = { rock: RGB; cave: string; fungus: string[]; grass: string; sky: [string, string, string] };
const TINTS: Record<Mountain, Tint> = {
  iron: { rock: [1.08, 0.98, 0.9], cave: '#2a3440', fungus: ['#5eead4', '#a3e635'], grass: '#3f5a2a', sky: ['#0b1220', '#1b2638', '#3b3f4f'] },
  crystal: { rock: [0.95, 0.92, 1.12], cave: '#2e2648', fungus: ['#c084fc', '#67e8f9'], grass: '#3a5a3a', sky: ['#0c0a1e', '#1d1a38', '#3a3256'] },
  frost: { rock: [0.92, 1, 1.12], cave: '#26364a', fungus: ['#7dd3fc', '#e0f2fe'], grass: '#e2e8f0', sky: ['#0b1424', '#1e2e44', '#51627a'] },
  ember: { rock: [1.15, 0.9, 0.82], cave: '#3a201c', fungus: ['#fb923c', '#facc15'], grass: '#3a3530', sky: ['#160b0b', '#2a1412', '#5a2a1e'] },
  drowned: { rock: [0.9, 1.04, 1.02], cave: '#1e3434', fungus: ['#34d399', '#5eead4'], grass: '#2f5a3a', sky: ['#091618', '#14282b', '#2d4648'] },
};
const ROCK: Record<number, RGB> = {
  [M.SOIL]: [74, 54, 38], [M.STONE]: [86, 82, 76], [M.SLATE]: [64, 70, 82], [M.DEEP]: [60, 54, 66], [M.BASALT]: [42, 38, 40], [M.ICE]: [120, 146, 168],
  [M.IRON]: [86, 82, 76], [M.COAL]: [70, 68, 66], [M.GOLD]: [80, 74, 66], [M.GEM]: [62, 56, 70], [M.MITHRIL]: [50, 52, 60], [M.AQUIFER]: [52, 70, 76],
  [M.MAGMA]: [96, 34, 18], [M.RUIN]: [104, 98, 86], [M.RUBBLE]: [92, 84, 74], [M.OBSIDIAN]: [22, 18, 26], [M.SEAL]: [138, 126, 106], [M.BRIDGE]: [92, 64, 40],
};
const SPECK: Record<number, string> = { [M.IRON]: '#c2693b', [M.COAL]: '#26221f', [M.GOLD]: '#facc15', [M.GEM]: '#c084fc', [M.MITHRIL]: '#e0f2fe', [M.OBSIDIAN]: '#6d5a9c', [M.MAGMA]: '#f97316', [M.AQUIFER]: '#3f8a9a' };
const BEARDS = ['#d97706', '#78350f', '#e5e7eb', '#9ca3af', '#b45309', '#292524'];
const JOB_COLOR: Record<string, string> = { miner: '#8b5a2b', hauler: '#6b7280', smith: '#7f1d1d', brewer: '#4d7c0f', farmer: '#3f6212', mason: '#78716c', soldier: '#94a3b8', king: '#6d28d9' };
const ORE_COLOR: Record<string, string> = { gold: '#facc15', gem: '#c084fc', mithril: '#e0f2fe', coal: '#18181b', iron: '#a0522d' };
const LIGHT: Record<string, string> = { torch: '#f59e0b', brazier: '#fb923c', crystal: '#7dd3fc', lava: '#f97316' };

const hexRgb = (h: string): RGB => mixRgb(h, h, 0);
const rgb = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const mixHex = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, k);
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};

export type KingdomPaintOptions = { mountain: string; holds: string; hazards: number; below: string; scale: number; camera: string; labels: boolean; hud: boolean };

export function mountKingdom(host: SkinHost, o: KingdomPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: KingdomWorld = createKingdom(host.config.seed, W, H, { mountain: o.mountain, holds: o.holds === 'any' ? 0 : Number(o.holds), hazards: o.hazards, below: o.below, scale: o.scale, camera: o.camera });
  const { CELL, cols, rows, mat, water, magma, ladder, plank, rail } = world;
  const tint = TINTS[world.mountain];
  const holdOfCol = new Int8Array(cols);
  for (let c = 0; c < cols; c++) holdOfCol[c] = world.holdAt(c).id;

  // ---- the camera --------------------------------------------------------------------------------
  // The whole range, still or drifting in for the big moments; or the old director's camera.
  const framing = o.camera === 'director' ? null : createFraming(o.camera === 'still' ? 'still' : 'drift', world);
  const cam = framing ? framing.cam : { x: world.GW / 2, y: world.GH * 0.3, zoom: 0.6 };
  const minZoom = () => Math.max(W / world.GW, H / world.GH);
  let shake: [number, number] = [0, 0];
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2 + shake[0];
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2 + shake[1];
  function camera(dt: number) {
    if (framing) return framing.update(dt, world.t, world.director, W, H);
    const s = world.director.shot;
    const zoom = Math.max(minZoom(), Math.min(1.8, s.zoom));
    cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 0.5);
    const k = Math.min(1, dt * 0.7);
    cam.x += (s.x - cam.x) * k;
    cam.y += (s.y - cam.y) * k;
    const hw = W / 2 / cam.zoom;
    const hh = H / 2 / cam.zoom;
    cam.x = Math.max(hw, Math.min(world.GW - hw, cam.x));
    cam.y = Math.max(hh, Math.min(world.GH - hh, cam.y));
  }
  camera(10);

  // ---- the rock --------------------------------------------------------------------------------------
  let rock: HTMLCanvasElement | null = null;
  let rg: CanvasRenderingContext2D | null = null;
  let scratch: ImageData | null = null;
  const peakRow = Math.min(...Array.from(world.surface));
  const stoneOf = world.holds.map((h) => hexRgb(h.style.stone));
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
    let col: RGB;
    if (isOpen(m)) {
      const nat = world.caveAt[i] >= 0;
      if (nat) {
        const k = 0.85 + n * 0.25 - depth * 0.25;
        col = hexRgb(tint.cave).map((v) => v * k) as RGB;
      } else {
        // The back wall: in a room, the clan's dressed stone in courses; in a gallery, hewn rock.
        const room = world.roomAt[i] >= 0 ? world.rooms[world.roomAt[i]] : null;
        const h = world.holds[holdOfCol[c]];
        if (room && h.style.masonry) {
          const s = stoneOf[room.hold];
          const course = ty === 3 || (tx === (((rr & 1) * 2 + (c & 1) * 0) % 4) && ty < 3);
          const k = (course ? 0.32 : 0.48) + n * 0.06 - depth * 0.12;
          col = [s[0] * k, s[1] * k, s[2] * k];
        } else {
          let k = 0.85 + n * 0.25 - depth * 0.25;
          if ((tx + ty * 3 + c + rr) % 7 === 0) k *= 0.8;
          col = [34 * k, 27 * k, 22 * k];
        }
      }
      if (ladder[i] && (tx === 0 || tx === 3 || ty === 1)) col = [107, 74, 43];
    } else if (m === M.MASON || m === M.CARVED) {
      // Dressed stone: the clan's own, in blocks.
      const s = stoneOf[holdOfCol[c]];
      const joint = ty === 3 || (tx === ((rr & 1) * 2) % 4 && ty < 3);
      const k = (joint ? 0.55 : 0.92 + n * 0.12) * (1 - depth * 0.25) * (m === M.CARVED ? 1.08 : 1);
      col = [s[0] * k, s[1] * k, s[2] * k];
    } else if (m === M.BRIDGE) {
      col = ty === 0 ? [140, 100, 60] : tx === 1 && ty > 1 ? [60, 42, 26] : [96, 68, 42];
    } else {
      const base = ROCK[m] ?? ROCK[M.STONE];
      const tn = tone(c, rr);
      let k = 0.78 + tn * 0.34 + (n - 0.5) * 0.16;
      if ((rr * TEX + ty + Math.round(Math.sin(c * 0.21 + rr) * 1.5)) % 11 === 0) k *= 0.82;
      if (hash(c, rr, 7) < 0.04 && tx === ty) k *= 0.7;
      k *= 1 - depth * 0.4;
      col = [base[0] * k * tint.rock[0], base[1] * k * tint.rock[1], base[2] * k * tint.rock[2]];
      if (m === M.RUIN || m === M.SEAL) if (ty === 3 || (tx === ((rr & 1) * 2) % 4 && ty < 3)) col = col.map((v) => v * 0.6) as RGB;
      if (m === M.RUBBLE && hash(c * 4 + tx, rr * 4 + ty, 3) < 0.35) col = col.map((v) => v * 0.6) as RGB;
      const sp = SPECK[m];
      if (sp && hash(c * 4 + tx, rr * 4 + ty, 5) < (m === M.COAL ? 0.32 : 0.3)) col = hexRgb(sp).map((v) => v * (1 - depth * 0.2)) as RGB;
      const above = rr > 0 ? mat[i - cols] : M.SKY;
      if (ty === 0 && above === M.SKY) col = hexRgb(rr < peakRow + 12 && world.mountain !== 'ember' ? '#e2e8f0' : tint.grass);
      else if (ty <= 1 && above === M.SKY && rr < peakRow + 7 && world.mountain !== 'ember') col = [210, 218, 228];
      else if (ty === 0 && isOpen(above)) col = col.map((v) => v * 1.35 + 10) as RGB;
    }
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
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
      const i = rr * cols + c;
      for (let ty = 0; ty < TEX; ty++) for (let tx = 0; tx < TEX; tx++) texel(i, tx, ty, img.data, ((rr * TEX + ty) * rock.width + c * TEX + tx) * 4);
    }
    rg.putImageData(img, 0, 0);
    scratch = rg.createImageData(TEX, TEX);
    world.dirty.length = 0;
  }
  function touchUp() {
    if (!rg || !scratch || !world.dirty.length) return;
    const done = new Set<number>();
    for (const j of world.dirty) for (const i of [j, j - cols, j + cols, j - 1, j + 1]) {
      if (i < 0 || i >= mat.length || done.has(i)) continue;
      done.add(i);
      for (let ty = 0; ty < TEX; ty++) for (let tx = 0; tx < TEX; tx++) texel(i, tx, ty, scratch.data, (ty * TEX + tx) * 4);
      rg.putImageData(scratch, (i % cols) * TEX, Math.floor(i / cols) * TEX);
    }
    world.dirty.length = 0;
  }
  // Rooms finished later re-dress their walls: watch for rooms becoming dug.
  const dressed = new Set<number>();
  function redress() {
    for (const room of world.rooms) {
      if (!room.dug || dressed.has(room.id)) continue;
      dressed.add(room.id);
      for (let rr = room.top - 1; rr <= room.floor + 1; rr++) for (let c = room.c0 - 1; c <= room.c1 + 1; c++) if (c >= 0 && c < cols && rr >= 0 && rr < rows) world.dirty.push(rr * cols + c);
    }
  }

  const fungus: { x: number; y: number; color: string; cave: number; seed: number }[] = [];
  for (let i = cols; i < mat.length - cols; i++) {
    if (mat[i] !== M.CAVE || isOpen(mat[i + cols])) continue;
    if (hash(i, 11) < 0.2) fungus.push({ x: world.cellX(i) + (hash(i, 2) - 0.5) * CELL, y: world.cellY(i), color: tint.fungus[i % tint.fungus.length], cave: world.caveAt[i], seed: i });
  }
  // Pines on the lower slopes, so the outside is a place too.
  const trees: { x: number; y: number; h: number; seed: number }[] = [];
  if (world.mountain !== 'ember') for (let c = 2; c < cols - 2; c += 1) {
    const s = world.surface[c];
    if (s < peakRow + (rows * 0.07) || hash(c, 41) > 0.28 || world.holds.some((h) => Math.abs(c - h.gateC) < 12)) continue;
    trees.push({ x: (c + 0.5) * CELL, y: s * CELL, h: (2.5 + hash(c, 42) * 3) * CELL, seed: c });
  }

  // ---- light ------------------------------------------------------------------------------------------
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
      grad.addColorStop(0.4, hexA(color, 0.35));
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
  const lit = (x: number, y: number, r: number, color: string, a: number) => glows.push([SX(x), SY(y), r * cam.zoom, color, a]);
  const darkness = () => {
    const d = world.day;
    return d < 0.2 || d > 0.88 ? 1 : d < 0.3 ? 1 - (d - 0.2) / 0.1 : d > 0.78 ? (d - 0.78) / 0.1 : 0;
  };

  // ---- helpers (world px) ---------------------------------------------------------------------------
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
  const view = () => {
    const c0 = Math.max(0, Math.floor((cam.x - W / 2 / cam.zoom) / CELL) - 1);
    const c1 = Math.min(cols - 1, Math.ceil((cam.x + W / 2 / cam.zoom) / CELL) + 1);
    const r0 = Math.max(0, Math.floor((cam.y - H / 2 / cam.zoom) / CELL) - 1);
    const r1 = Math.min(rows - 1, Math.ceil((cam.y + H / 2 / cam.zoom) / CELL) + 1);
    return { c0, c1, r0, r1 };
  };

  // ---- the sky and the outside ------------------------------------------------------------------------
  function sky(t: number) {
    const dark = darkness();
    const [a, b, c] = tint.sky;
    const night = (h: string) => mixRgb(h, '#03040a', dark * 0.75);
    const horizon = SY(world.surface.reduce((s, v) => s + v, 0) / cols * CELL);
    const g = ctx.createLinearGradient(0, SY(0), 0, horizon);
    g.addColorStop(0, rgb(night(a)));
    g.addColorStop(0.6, rgb(night(b)));
    g.addColorStop(1, rgb(night(c)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const top = SY(0);
    if (horizon < 0) return;
    if (dark > 0.05) for (let i = 0; i < 160; i++) {
      const y = top + hash(i, 2) * (horizon - top) * 0.9;
      ctx.fillStyle = `rgba(226,232,240,${((0.2 + hash(i, 3) * 0.6) * dark * (0.8 + 0.2 * Math.sin(t * 2 + i))).toFixed(3)})`;
      ctx.fillRect(Math.floor(hash(i, 1) * W), Math.floor(y), 1, 1);
    }
    const ang = world.day * Math.PI * 2;
    const sx = W * 0.5 - Math.sin(ang) * W * 0.4;
    const sy = top + (horizon - top) * (0.55 + Math.cos(ang) * 0.5);
    if (sy < horizon && dark < 0.9) {
      glow(sx, sy, 160, '#fbbf24', 0.28 * (1 - dark));
      ctx.fillStyle = hexA('#fef3c7', 0.85 * (1 - dark));
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    const mx = W * 0.5 + Math.sin(ang) * W * 0.4;
    const my = top + (horizon - top) * (0.55 - Math.cos(ang) * 0.5);
    if (my < horizon && dark > 0.2) {
      glow(mx, my, 60, '#cbd5e1', 0.15 * dark);
      ctx.fillStyle = `rgba(226,232,240,${(0.8 * dark).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Far ranges behind, in parallax.
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = rgb(mixRgb(layer === 2 ? a : layer ? b : c, '#000000', 0.25 + layer * 0.15 + dark * 0.35));
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let X = 0; X <= W + 8; X += 8) {
        const wx = (X - W / 2) / cam.zoom / (1.5 + layer) + cam.x * (0.5 - layer * 0.12);
        const hgt = (0.45 + 0.55 * Math.abs(Math.sin(wx * 0.0042 + layer * 3) * Math.sin(wx * 0.0011 + 1 + layer))) * world.H * (0.55 - layer * 0.13);
        ctx.lineTo(X, SY(peakRow * CELL + world.H * 0.35 - hgt + layer * 30));
      }
      ctx.lineTo(W, H);
      ctx.fill();
    }
    // Clouds, slow.
    for (let k = 0; k < 7; k++) {
      const x = ((hash(k, 51) * world.GW + t * (4 + hash(k, 52) * 6)) % (world.GW + 400)) - 200;
      const y = (peakRow - 6 - hash(k, 53) * 18) * CELL;
      const X = SX(x);
      const Y = SY(y);
      if (X < -300 || X > W + 300 || Y < -60 || Y > H) continue;
      ctx.fillStyle = `rgba(226,232,240,${(0.08 + 0.05 * (1 - dark)).toFixed(3)})`;
      for (let n = 0; n < 5; n++) {
        ctx.beginPath();
        ctx.ellipse(X + (n - 2) * 22 * Z, Y + Math.sin(n * 2) * 4 * Z, 30 * Z, 9 * Z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  function snow(t: number) {
    if (world.season !== 3 && world.mountain !== 'frost') return;
    const horizon = SY(peakRow * CELL + world.H * 0.3);
    if (horizon < 0) return;
    ctx.fillStyle = 'rgba(241,245,249,0.6)';
    for (let i = 0; i < 160; i++) {
      const x = ((hash(i, 1) * W + t * 12 + Math.sin(t + i) * 10) % W + W) % W;
      const y = (hash(i, 2) * horizon + t * (20 + hash(i, 3) * 20)) % Math.max(1, horizon);
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
  function outside(t: number) {
    // Pines.
    for (const tr of trees) {
      if (!visible(tr.x, tr.y, 40)) continue;
      const X = SX(tr.x);
      const Y = SY(tr.y);
      const hgt = tr.h * Z;
      const sway = Math.sin(t * 0.8 + tr.seed) * Z * 0.6;
      ctx.fillStyle = world.season === 3 || world.mountain === 'frost' ? '#3b4f4a' : '#1f3b2a';
      ctx.beginPath();
      ctx.moveTo(X - hgt * 0.3, Y);
      ctx.lineTo(X + sway, Y - hgt);
      ctx.lineTo(X + hgt * 0.3, Y);
      ctx.fill();
      if (world.season === 3 || world.mountain === 'frost') {
        ctx.fillStyle = 'rgba(241,245,249,0.75)';
        ctx.beginPath();
        ctx.moveTo(X - hgt * 0.12, Y - hgt * 0.62);
        ctx.lineTo(X + sway, Y - hgt);
        ctx.lineTo(X + hgt * 0.12, Y - hgt * 0.62);
        ctx.fill();
      }
    }
    // Each hold's front: the road, the gate, the carved face of its first king, its banners.
    for (const h of world.holds) gateFront(h, t);
  }
  function gateFront(h: Hold, t: number) {
    const C = CELL;
    const x = h.gateC * C;
    const fy = (h.gateFloor + 1) * C;
    if (!visible(x, fy, 200)) return;
    // The road down the slope.
    ctx.strokeStyle = 'rgba(120,98,70,0.6)';
    ctx.lineWidth = Math.max(1, C * 0.6 * Z);
    ctx.beginPath();
    let c = h.gateC + h.side;
    ctx.moveTo(SX(c * C), SY(world.surface[c] * C));
    for (let k = 0; k < 40 && c > 0 && c < cols - 1; k++, c += h.side) ctx.lineTo(SX((c + 0.5) * C), SY(world.surface[c] * C - 1));
    ctx.stroke();
    // The gateway: a stone arch, its doors open or barred.
    const s = h.style.stone;
    box(x - C * 0.6, fy - C * 4.2, C * 2.2, C * 0.8, mixHex(s, '#000000', 0.15));
    box(x - C * 0.6, fy - C * 4.2, C * 0.5, C * 4.2, s);
    box(x + C * 1.1, fy - C * 4.2, C * 0.5, C * 4.2, s);
    if (!h.gateOpen) {
      box(x, fy - C * 3.4, C, C * 3.4, '#5c3d24');
      box(x, fy - C * 2.4, C, C * 0.2, '#3f3f46');
      box(x, fy - C * 1.1, C, C * 0.2, '#3f3f46');
    }
    // Banners in the clan's colour.
    for (const sd of [-1, 1]) {
      const bx = x + C * 0.5 + sd * C * 2.2 - C * 0.35;
      box(bx, fy - C * 6, C * 0.12, C * 6, '#57534e');
      const wave = Math.sin(t * 2.2 + sd) * C * 0.15;
      box(bx + C * 0.12, fy - C * 5.8 + wave, C * 0.9, C * 2.2, h.fallen ? '#44403c' : h.color);
      box(bx + C * 0.35, fy - C * 5.2 + wave, C * 0.4, C * 0.4, '#d4a017');
    }
    if (!h.fallen) lit(x + C * 0.5 - h.side * C * 2, fy - C * 2, C * 7, '#f59e0b', 0.35);
    // The face of the first king, carved into the mountain above.
    if (h.face) {
      // A helmed head with a braided beard, cut in relief: lit from the upper left.
      const fx = (h.faceC + 0.5) * C;
      const fyc = (h.faceR + 0.5) * C;
      const st = mixHex(s, '#ffffff', 0.12);
      const mid = mixHex(s, '#000000', 0.12);
      const sh = mixHex(s, '#000000', 0.45);
      const poly = (pts: number[][], color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(SX(fx + px * C), SY(fyc + py * C)) : ctx.moveTo(SX(fx + px * C), SY(fyc + py * C))));
        ctx.closePath();
        ctx.fill();
      };
      ctx.globalAlpha = h.fallen ? 0.6 : 0.95;
      poly([[-4.6, -2.2], [-4.2, -4.8], [-2.6, -6.4], [0, -7], [2.6, -6.4], [4.2, -4.8], [4.6, -2.2]], mid);
      poly([[-4.2, -2.4], [-3.8, -4.6], [-2.4, -6], [0, -6.5], [0, -2.4]], st);
      poly([[-4.8, -2.6], [4.8, -2.6], [4.8, -1.6], [-4.8, -1.6]], sh);
      poly([[-3.6, -1.6], [3.6, -1.6], [3.4, 1], [-3.4, 1]], st);
      poly([[-2.8, -1.1], [-1, -1.1], [-1.2, -0.5], [-2.6, -0.5]], sh);
      poly([[1, -1.1], [2.8, -1.1], [2.6, -0.5], [1.2, -0.5]], sh);
      poly([[-0.5, -2.6], [0.5, -2.6], [0.8, 0.6], [-0.8, 0.6]], mid);
      poly([[-4, 0.6], [4, 0.6], [3.2, 3.4], [1.6, 5.6], [0, 6.6], [-1.6, 5.6], [-3.2, 3.4]], st);
      poly([[0, 0.6], [4, 0.6], [3.2, 3.4], [1.6, 5.6], [0, 6.6]], mid);
      ctx.strokeStyle = sh;
      ctx.lineWidth = Math.max(1, Z * 0.8);
      ctx.beginPath();
      for (const bx of [-2.2, -0.8, 0.8, 2.2]) {
        ctx.moveTo(SX(fx + bx * C), SY(fyc + 1.2 * C));
        ctx.lineTo(SX(fx + bx * 0.55 * C), SY(fyc + (5.6 - Math.abs(bx) * 0.6) * C));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function rockLayer() {
    if (!rock) return;
    const x0 = cam.x - W / 2 / cam.zoom;
    const y0 = cam.y - H / 2 / cam.zoom;
    const sx = Math.max(0, Math.floor((x0 / CELL) * TEX));
    const sy = Math.max(0, Math.floor((y0 / CELL) * TEX));
    const sw = Math.min(rock.width - sx, Math.ceil(((W / cam.zoom) / CELL) * TEX) + 4);
    const sh = Math.min(rock.height - sy, Math.ceil(((H / cam.zoom) / CELL) * TEX) + 4);
    if (sw <= 0 || sh <= 0) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(rock, sx, sy, sw, sh, SX((sx / TEX) * CELL), SY((sy / TEX) * CELL), (sw / TEX) * CELL * cam.zoom, (sh / TEX) * CELL * cam.zoom);
  }

  function fluids(t: number) {
    const { c0, c1, r0, r1 } = view();
    const cs = CELL * cam.zoom;
    let budget = 70;
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
        if (budget > 0 && (c + rr * 3) % 5 === 0) {
          glows.push([X + cs / 2, Y + cs / 2, cs * 4, '#f97316', 0.25]);
          budget--;
        }
      }
    }
  }

  /** Planks over openings, stair treads, rails along the galleries and highways. */
  function works() {
    const { c0, c1, r0, r1 } = view();
    const cs = CELL * cam.zoom;
    for (let rr = r0; rr <= r1; rr++) for (let c = c0; c <= c1; c++) {
      const i = rr * cols + c;
      if (!isOpen(mat[i]) || mat[i] === M.SKY) continue;
      const X = SX(c * CELL);
      const Y = SY((rr + 1) * CELL);
      const below = i + cols < mat.length ? mat[i + cols] : M.STONE;
      const h = world.holds[holdOfCol[c]];
      if (plank[i] && isOpen(below)) {
        const stair = h.style.shaft === 'stair' && !(rr > 0 && plank[i - 1 - cols] === 0 && plank[i + 1 - cols] === 0 && plank[i - 1] && plank[i + 1]);
        ctx.fillStyle = stair ? h.style.stone : '#7c5a36';
        ctx.fillRect(X, Y - Math.max(1, cs * 0.22), cs + 0.5, Math.max(1, cs * 0.22));
        if (stair) {
          ctx.fillStyle = hexA('#000000', 0.25);
          ctx.fillRect(X, Y, cs + 0.5, Math.max(1, cs * 0.12));
        }
      }
      if ((rail[i] || (h.style.rails && plank[i] && !isOpen(below) && world.roomAt[i] < 0)) && cs > 2.5) {
        ctx.fillStyle = '#57534e';
        ctx.fillRect(X, Y - Math.max(1, cs * 0.12), cs + 0.5, Math.max(1, cs * 0.08));
        if ((c & 1) === 0) {
          ctx.fillStyle = '#5c3d24';
          ctx.fillRect(X + cs * 0.2, Y - Math.max(1, cs * 0.06), cs * 0.5, Math.max(1, cs * 0.06));
        }
      }
    }
    // Lifts: a platform on its ropes, riding the shaft.
    for (const h of world.holds) {
      if (!h.lift || h.fallen) continue;
      const x = h.shaftC * CELL;
      if (!visible(x, h.lift.y, 200)) continue;
      ctx.strokeStyle = 'rgba(168,140,100,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const dx of [0.6, 2.4]) {
        ctx.moveTo(SX(x + dx * CELL), SY((h.gateFloor - 3) * CELL));
        ctx.lineTo(SX(x + dx * CELL), SY(h.lift.y - CELL * 2));
      }
      ctx.stroke();
      box(x + CELL * 0.6, h.lift.y - CELL * 0.4, CELL * 2.4, CELL * 0.4, '#7c5a36');
      box(x + CELL * 0.6, h.lift.y - CELL * 2.2, CELL * 2.4, CELL * 0.2, '#5c3d24');
      box(x + CELL * 1.2, h.lift.y - CELL * 1.1, CELL * 1.2, CELL * 0.7, '#6b4a2b');
      box(x + CELL * 1.3, h.lift.y - CELL * 1.4, CELL * 1.0, CELL * 0.3, '#a0522d');
      // The wheel at the top.
      const wy = (h.gateFloor - 3) * CELL;
      ctx.strokeStyle = '#6b4a2b';
      ctx.lineWidth = Math.max(1, Z);
      ctx.beginPath();
      ctx.arc(SX(x + CELL * 1.5), SY(wy), CELL * 1.2 * Z, 0, Math.PI * 2);
      const a = h.lift.y * 0.05;
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(SX(x + CELL * 1.5 + Math.cos(a + k * 2.1) * CELL * 1.2), SY(wy + Math.sin(a + k * 2.1) * CELL * 1.2));
        ctx.lineTo(SX(x + CELL * 1.5 - Math.cos(a + k * 2.1) * CELL * 1.2), SY(wy - Math.sin(a + k * 2.1) * CELL * 1.2));
      }
      ctx.stroke();
    }
  }

  // ---- rooms ------------------------------------------------------------------------------------------
  function statue(x: number, fy: number, hgt: number, stone: string, crown: boolean) {
    const C = CELL;
    const sh = mixHex(stone, '#000000', 0.3);
    const hi = mixHex(stone, '#ffffff', 0.15);
    box(x - C * 1.4, fy - C * 0.8, C * 2.8, C * 0.8, sh);
    box(x - C * 0.9, fy - hgt, C * 1.8, hgt - C * 0.8, stone);
    box(x - C * 0.9, fy - hgt, C * 0.4, hgt - C * 0.8, hi);
    box(x - C * 0.7, fy - hgt - C * 1.2, C * 1.4, C * 1.2, hi);
    box(x - C * 0.8, fy - hgt + C * 0.1, C * 1.6, C * 1.6, mixHex(stone, '#ffffff', 0.25));
    box(x + C * 0.9, fy - hgt + C * 0.4, C * 0.3, hgt * 0.7, sh);
    box(x + C * 0.7, fy - hgt + C * 0.2, C * 0.8, C * 0.6, sh);
    if (crown) box(x - C * 0.7, fy - hgt - C * 1.6, C * 1.4, C * 0.4, '#ca8a04');
  }
  function furnish(room: Room, t: number) {
    if (!room.dug) return;
    const h = world.holds[room.hold];
    const x0 = room.c0 * CELL;
    const x1 = (room.c1 + 1) * CELL;
    const fy = (room.floor + 1) * CELL;
    const ty = room.top * CELL;
    const w = x1 - x0;
    if (!visible((x0 + x1) / 2, (fy + ty) / 2, w)) return;
    const C = CELL;
    const stone = h.style.stone;
    ctx.globalAlpha = room.ruined || h.fallen ? 0.5 : 1;
    const grand = room.kind === 'hall' || room.kind === 'kings' || room.kind === 'vault' || room.kind === 'temple';
    // Pillars in the great rooms; in a tiered room, at its steps.
    if (grand || room.shape === 'tiered') {
      const step = room.kind === 'vault' ? 4 : 6;
      for (let x = x0 + C * 2; x < x1 - C * 1.5; x += C * step) {
        let top = room.top;
        const c = Math.floor(x / C);
        while (top < room.floor && !isOpen(mat[top * cols + c])) top++;
        const yt = top * C;
        box(x, yt, C * 0.8, fy - yt, stone);
        box(x, yt, C * 0.25, fy - yt, mixHex(stone, '#ffffff', 0.15));
        box(x - C * 0.2, yt, C * 1.2, C * 0.45, mixHex(stone, '#ffffff', 0.1));
        box(x - C * 0.2, fy - C * 0.45, C * 1.2, C * 0.45, mixHex(stone, '#000000', 0.2));
      }
    }
    if (!room.furnished) {
      ctx.globalAlpha = 1;
      // Scaffolding while the masons work.
      if (world.dwarves.some((d) => d.alive && d.task?.kind === 'furnish' && d.task.room === room)) {
        ctx.strokeStyle = 'rgba(146,104,60,0.8)';
        ctx.lineWidth = Math.max(1, Z * 0.7);
        ctx.beginPath();
        for (let x = x0 + C; x < x1; x += C * 3) {
          ctx.moveTo(SX(x), SY(fy));
          ctx.lineTo(SX(x), SY(fy - C * 3));
        }
        ctx.moveTo(SX(x0 + C), SY(fy - C * 1.5));
        ctx.lineTo(SX(x1 - C), SY(fy - C * 1.5));
        ctx.moveTo(SX(x0 + C), SY(fy - C * 3));
        ctx.lineTo(SX(x1 - C), SY(fy - C * 3));
        ctx.stroke();
      }
      return;
    }
    const light = (x: number, y: number) => {
      // Each hold lights its rooms its own way.
      const L = h.style.light;
      const f = 0.85 + 0.15 * Math.sin(t * 9 + x) * Math.sin(t * 4.3 + y);
      if (L === 'torch') {
        box(x - C * 0.08, y, C * 0.16, C * 0.5, '#57534e');
        box(x - C * 0.14, y - C * 0.3, C * 0.28, C * 0.3, '#fbbf24');
      } else if (L === 'brazier') {
        box(x - C * 0.5, fy - C * 1.4, C * 1, C * 0.4, '#3f3f46');
        box(x - C * 0.1, fy - C * 1, C * 0.2, C, '#27272a');
        box(x - C * 0.4, fy - C * 1.7 - f * C * 0.2, C * 0.8, C * 0.35, '#fb923c');
        y = fy - C * 1.6;
      } else if (L === 'crystal') {
        box(x - C * 0.15, y - C * 0.5, C * 0.3, C * 0.8, '#bae6fd');
        box(x - C * 0.3, y - C * 0.2, C * 0.6, C * 0.25, '#7dd3fc');
      } else {
        box(x - C * 0.6, fy - C * 0.2, C * 1.2, C * 0.2, '#f97316');
        y = fy - C * 0.2;
      }
      lit(x, y, C * (L === 'crystal' ? 4 : 5) * f, LIGHT[L], (L === 'crystal' ? 0.4 : 0.45) * f);
    };
    const lights = Math.max(1, Math.floor(w / (C * 7)));
    for (let k = 0; k < lights; k++) light(x0 + (w * (k + 0.5)) / lights, fy - C * 2.6);
    switch (room.kind) {
      case 'entrance':
        for (let x = x0 + C * 3; x < x1 - C * 3; x += C * 4) {
          box(x, ty + C * 0.6, C * 1.2, C * 2.2, h.color);
          box(x + C * 0.35, ty + C * 1.2, C * 0.5, C * 0.5, '#d4a017');
        }
        if (room.statue) statue(x0 + C * 2, fy, C * 4, stone, false);
        break;
      case 'store': {
        const s = h.stocks;
        let x = x0 + C;
        for (const [n, color] of [[s.iron, '#a0522d'], [s.coal, '#18181b'], [s.gold, '#facc15'], [s.gem, '#c084fc'], [s.mithril, '#e0f2fe']] as [number, string][]) {
          const hh = Math.min(2.5, Math.sqrt(n) * 0.4) * C;
          if (hh > 1) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(SX(x), SY(fy));
            ctx.lineTo(SX(x + C * 0.9), SY(fy - hh));
            ctx.lineTo(SX(x + C * 1.8), SY(fy));
            ctx.fill();
          }
          x += C * 1.6;
        }
        for (let k = 0; k < Math.min(5, 1 + Math.floor(s.goods / 6)); k++) {
          const cx = x1 - C * (2 + (k % 3) * 1.3);
          const cy = fy - C * (1 + Math.floor(k / 3));
          box(cx, cy, C, C, '#7c5a36');
          box(cx + C * 0.45, cy, C * 0.1, C, '#4a3520');
        }
        break;
      }
      case 'dorm':
        for (let x = x0 + C; x < x1 - C * 2; x += C * 2.5) {
          box(x, fy - C * 0.7, C * 2, C * 0.7, '#5c3d24');
          box(x + C * 0.5, fy - C * 0.9, C * 1.5, C * 0.3, hash(x, 2) < 0.4 ? h.color : ['#1e3a8a', '#365314', '#713f12'][Math.floor(hash(x, 3) * 3)]);
          box(x, fy - C * 0.95, C * 0.5, C * 0.35, '#e7e5e4');
          if (room.c1 - room.c0 > 6 && room.floor - room.top > 4) {
            box(x, fy - C * 2.4, C * 2, C * 0.5, '#5c3d24');
            box(x + C * 0.5, fy - C * 2.55, C * 1.5, C * 0.2, '#7f1d1d');
          }
        }
        break;
      case 'farm':
        for (let x = x0 + C * 0.5; x < x1 - C * 0.5; x += C * 0.9) {
          const hh = (0.6 + hash(x, 1) * 0.9) * C * (0.6 + 0.4 * Math.min(1, room.work + 0.4));
          const color = tint.fungus[Math.floor(hash(x, 3) * tint.fungus.length)];
          box(x + C * 0.3, fy - hh, C * 0.2, hh, '#d6d3d1');
          box(x, fy - hh - C * 0.35, C * 0.8, C * 0.4, color);
          if (hash(x, 4) < 0.3) lit(x + C * 0.4, fy - hh, C * 1.5, color, 0.25);
        }
        break;
      case 'brewery':
        for (let k = 0; k < Math.floor(w / (C * 2.2)) - 1; k++) {
          const x = x0 + C * (1 + k * 2.2);
          box(x, fy - C * 2, C * 1.8, C * 2, '#7c5a36');
          box(x, fy - C * 1.5, C * 1.8, C * 0.15, '#3f3f46');
          box(x, fy - C * 0.6, C * 1.8, C * 0.15, '#3f3f46');
        }
        box(x1 - C * 2.4, fy - C * 1.6, C * 1.4, C * 1.6, '#b45309');
        break;
      case 'forge': {
        const busy = world.dwarves.some((d) => d.alive && d.task?.room === room && d.swingUntil > world.t);
        for (let x = x0 + C; x < x1 - C * 5; x += C * 6) {
          box(x, fy - C * 3, C * 2.4, C * 3, '#44403c');
          box(x + C * 0.4, fy - C * 5, C * 1.6, C * 2, '#3f3f46');
          box(x + C * 0.6, fy - C * 1.6, C * 1.2, C * 0.9, busy ? '#fb923c' : '#7c2d12');
          lit(x + C * 1.2, fy - C * 1.2, C * (busy ? 7 : 3), '#f97316', busy ? 0.6 : 0.2);
          box(x + C * 3.5, fy - C * 0.9, C * 0.6, C * 0.9, '#27272a');
          box(x + C * 3.1, fy - C * 1.2, C * 1.4, C * 0.35, '#3f3f46');
        }
        if (busy && Math.sin(t * 3) > 0) lit(x0 + w / 2, fy - C * 3, C * 10, '#fb923c', 0.15);
        break;
      }
      case 'hall':
      case 'kings':
      case 'vault': {
        const feast = h.feast > world.t && room.kind === 'hall';
        if (room.kind === 'hall') {
          box(x0 + C * 4, fy - C, w - C * 9, C * 0.35, '#6b4a2b');
          for (let x = x0 + C * 4.5; x < x1 - C * 5; x += C * 3) box(x, fy - C * 0.65, C * 0.3, C * 0.65, '#5c3d24');
          if (feast) for (let x = x0 + C * 5; x < x1 - C * 5; x += C * 1.3) box(x, fy - C * 1.25, C * 0.35, C * 0.3, hash(x, 9) < 0.5 ? '#fbbf24' : '#a16207');
          box(x1 - C * 3, fy - C * 2.6, C * 1.8, C * 2.6, '#a16207');
          box(x1 - C * 2.7, fy - C * 2, C * 1.2, C * 1.4, h.color);
          box(x0 + C * 0.8, fy - C * 2.2, C * 2.4, C * 2.2, '#57534e');
          box(x0 + C * 1.3, fy - C * 1.2, C * 1.4, C * 1.2, '#fb923c');
          lit(x0 + C * 2, fy - C * 0.8, C * (feast ? 10 : 6), '#f97316', feast ? 0.6 : 0.4);
          h.artifacts.slice(0, 5).forEach((_a, k) => {
            const x = x0 + C * (6 + k * 3);
            box(x, fy - C * 3.6, C, C * 0.6, '#78716c');
            box(x + C * 0.25, fy - C * 4.2, C * 0.5, C * 0.6, '#fde68a');
            if (Math.sin(t * 2 + k * 2) > 0.7) lit(x + C * 0.5, fy - C * 4, C * 2.5, '#fde68a', 0.5);
          });
        }
        if (room.kind === 'kings') {
          // A row of the clan's kings in stone, the newest still being cut.
          const n = Math.max(1, Math.min(Math.floor(w / (C * 4)), h.reign + 1));
          for (let k = 0; k < n; k++) statue(x0 + C * 2.5 + k * C * 4, fy, C * (4 + (room.floor - room.top) * 0.25), stone, true);
        }
        if (room.kind === 'vault') {
          for (let x = x0 + C * 3; x < x1 - C * 2; x += C * 4) {
            box(x, ty + C * 1.5, C * 1.2, C * 2.6, h.color);
            box(x + C * 0.35, ty + C * 2.1, C * 0.5, C * 0.5, '#d4a017');
          }
        }
        if (room.statue && room.kind !== 'kings') statue((x0 + x1) / 2, fy, C * Math.min(7, (room.floor - room.top) * 0.75), stone, room.kind === 'hall');
        break;
      }
      case 'temple': {
        const x = (x0 + x1) / 2;
        box(x - C * 1.5, fy - C * 0.8, C * 3, C * 0.8, '#57534e');
        statue(x, fy - C * 0.8, C * Math.min(6, (room.floor - room.top) * 0.7), mixHex(stone, '#fde68a', 0.2), false);
        for (const dx of [-3.5, -2.5, 2.5, 3.5]) {
          box(x + dx * C, fy - C * 0.8, C * 0.25, C * 0.8, '#f5f5f4');
          lit(x + dx * C, fy - C, C * 1.6, '#fde68a', 0.4 + 0.1 * Math.sin(t * 5 + dx));
        }
        break;
      }
      case 'tomb':
        for (let k = 0; k < Math.min(h.deaths, Math.floor(w / (C * 2.3))); k++) {
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
        box(x1 - C * 2.6, fy - C * 2.6, C * 0.7, C * 0.8, h.color);
        break;
      case 'treasury': {
        const n = Math.min(Math.floor(w / (C * 1.2)) - 2, 1 + Math.floor(h.stocks.treasure / 6));
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
        break;
      }
      case 'pump': {
        const x = (x0 + x1) / 2;
        const y = fy - C * 2.4;
        ctx.strokeStyle = '#7c5a36';
        ctx.lineWidth = Math.max(1, C * 0.25 * Z);
        ctx.beginPath();
        ctx.arc(SX(x), SY(y), C * 1.9 * Z, 0, Math.PI * 2);
        for (let k = 0; k < 4; k++) {
          const a = t * 1.5 + (k * Math.PI) / 4;
          ctx.moveTo(SX(x + Math.cos(a) * C * 1.9), SY(y + Math.sin(a) * C * 1.9));
          ctx.lineTo(SX(x - Math.cos(a) * C * 1.9), SY(y - Math.sin(a) * C * 1.9));
        }
        ctx.stroke();
        break;
      }
      case 'library':
        for (let x = x0 + C * 0.6; x < x1 - C * 3; x += C * 2.2) {
          box(x, fy - C * 3, C * 1.8, C * 3, '#5c3d24');
          for (let s2 = 0; s2 < 3; s2++) for (let b = 0; b < 4; b++) box(x + C * (0.15 + b * 0.4), fy - C * (2.8 - s2), C * 0.3, C * 0.7, ['#7f1d1d', '#1e3a8a', '#365314', '#a16207'][(b + s2) % 4]);
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

  /** Lights along the galleries, each hold its own way. */
  function galleryLights(t: number) {
    for (const h of world.holds) {
      if (h.fallen) continue;
      for (const lv of h.levels) {
        if (!lv) continue;
        for (let c = lv.left + 3; c <= lv.right - 1; c += 9) {
          const i = (lv.floor - 1) * cols + c;
          if (!isOpen(mat[i]) || mat[i] === M.SKY || world.roomAt[i] >= 0) continue;
          const x = world.cellX(i);
          const y = (lv.floor - 1.6) * CELL;
          if (!visible(x, y)) continue;
          const f = 0.85 + 0.15 * Math.sin(t * 9 + c * 1.3) * Math.sin(t * 4.3 + c);
          const L = h.style.light === 'brazier' ? 'torch' : h.style.light;
          if (L === 'crystal') box(x - CELL * 0.12, y - CELL * 0.3, CELL * 0.24, CELL * 0.6, '#bae6fd');
          else if (L === 'lava') box(x - CELL * 0.5, (lv.floor + 0.8) * CELL, CELL, CELL * 0.2, '#f97316');
          else {
            box(x - CELL * 0.08, y, CELL * 0.16, CELL * 0.5, '#57534e');
            box(x - CELL * 0.12, y - CELL * 0.25, CELL * 0.24, CELL * 0.25, '#fbbf24');
          }
          lit(x, L === 'lava' ? (lv.floor + 0.8) * CELL : y, CELL * 5 * f, LIGHT[L], 0.4 * f);
        }
      }
    }
  }

  // ---- people and things -----------------------------------------------------------------------------
  function dwarfSprite(d: Dwarf, t: number, p: number) {
    const X = SX(d.x);
    const Y = SY(d.y);
    if (X < -30 || X > W + 30 || Y < -30 || Y > H + 40) return;
    const f = d.facing;
    const h = world.holds[d.hold];
    const R = (tx: number, ty: number, w: number, hh: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(X + (f > 0 ? tx : -tx - w) * p, Y + ty * p, w * p, hh * p);
    };
    if (!d.alive) {
      ctx.globalAlpha = Math.max(0, 0.7 - (world.t - d.deadAt) / 40);
      R(-3, -2, 6, 2, JOB_COLOR[d.job]);
      R(2, -2, 2, 2, BEARDS[d.beard]);
      ctx.globalAlpha = 1;
      return;
    }
    const walking = d.ri < d.route.length;
    const step = walking ? Math.floor(d.anim) % 2 : 0;
    const swing = d.swingUntil > world.t ? Math.floor(t * 8) % 2 : -1;
    if (d.task?.kind === 'sleep' && !walking) {
      R(-3, -2, 6, 2, h.color);
      R(1, -3, 2, 2, '#f1c7a1');
      R(-2, -3, 3, 1, BEARDS[d.beard]);
      return;
    }
    // A cart, pushed ahead.
    if (d.cart) {
      R(3, -4, 6, 3, '#5c3d24');
      R(3, -4, 6, 1, '#7c5a36');
      R(4, -1, 1.4, 1.4, '#27272a');
      R(7, -1, 1.4, 1.4, '#27272a');
      if (d.carry) R(3.5, -5, 5, 1.5, ORE_COLOR[d.carry.kind]);
      else if (d.task?.kind === 'trade') R(3.5, -5.5, 5, 2, '#a16207');
    }
    const body = d.job === 'soldier' ? h.color : JOB_COLOR[d.job];
    R(-2, -2, 2, 2 - step, '#292524');
    R(0, -2, 2, 2 - (1 - step), '#292524');
    R(-2, -6, 4, 4, body);
    R(-2, -3, 4, 1, '#3f2a17');
    R(0, -8, 2, 2, d.sick >= 0 ? '#a3e635' : '#f1c7a1');
    R(-1, -8, 1, 2, '#e8b38c');
    R(0, -6, 2, 3, BEARDS[d.beard]);
    R(1, -7, 1, 1, BEARDS[d.beard]);
    // Hood or helm in the clan's colour, so the clans read apart.
    if (d.job === 'king') {
      R(-1, -9, 3, 1, '#facc15');
      R(-1, -10, 1, 1, '#facc15');
      R(1, -10, 1, 1, '#facc15');
      R(-3, -6, 1, 5, h.color);
    } else if (d.job === 'soldier') {
      R(-1, -9, 3, 1, '#cbd5e1');
      R(-1, -10, 2, 1, '#94a3b8');
      R(-3, -6, 1.2, 3.5, '#64748b');
    } else R(-1, -9, 3, 1, h.color);
    const tool = d.job === 'miner' ? 'pick' : d.job === 'mason' || d.job === 'smith' ? 'hammer' : d.job === 'soldier' ? (d.crossbow ? 'bow' : 'axe') : null;
    if (d.carry && !d.cart) {
      R(2, -4, 3, 2, '#5c3d24');
      R(2.5, -5, 2, 1, ORE_COLOR[d.carry.kind]);
    } else if (tool && !d.cart) {
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
    if (d.task?.kind === 'mood') glows.push([X, Y - 6 * p, 18 * p, '#a78bfa', 0.4 + 0.2 * Math.sin(t * 6)]);
    if (d.job === 'miner' && d.task?.kind === 'dig') glows.push([X + f * 2 * p, Y - 9 * p, 7 * p, '#fde68a', 0.22]);
  }

  function foeSprite(fo: Foe, p: number) {
    if (fo.kind === 'sleeper') return;
    if (fo.boss) p *= 2.2;
    const X = SX(fo.x);
    const Y = SY(fo.y);
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
        if (fo.alive) glows.push([X, Y - 7 * p, 6 * p, '#22d3ee', 0.4]);
        break;
      case 'crawler':
        for (let k = 0; k < 4; k++) R(-4 + k * 2, -3 + ((k + step) % 2) * 0.5, 2, 2.5, k % 2 ? '#581c87' : '#6b21a8');
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
      case 'golem':
        R(-3, -4, 2, 4 - step, '#57534e');
        R(1, -4, 2, 4 - (1 - step), '#57534e');
        R(-4, -11, 8, 7, '#78716c');
        R(-4, -11, 8, 1, '#a8a29e');
        R(-2, -14, 4, 3, '#78716c');
        R(0, -13, 1, 1, '#fbbf24');
        R(4, sw ? -12 : -10, 2, 5, '#57534e');
        R(-6, -10, 2, 5, '#57534e');
        if (fo.alive) glows.push([X + f * p, Y - 13 * p, 5 * p, '#fbbf24', 0.6]);
        break;
      case 'gnome':
        R(-1, -2, 1, 2 - step, '#292524');
        R(1, -2, 1, 2 - (1 - step), '#292524');
        R(-1, -5, 3, 3, '#365314');
        R(0, -7, 2, 2, '#f1c7a1');
        R(0, -5, 2, 2, '#e5e7eb');
        R(-1, -8, 3, 1, '#dc2626');
        R(0, -10, 2, 2, '#dc2626');
        glows.push([X + f * 3 * p, Y - 5 * p, 6 * p, '#fbbf24', 0.5]);
        break;
      case 'mushroom': {
        const cap = tint.fungus[fo.id % tint.fungus.length];
        R(-1, -5, 2, 5, '#e7e5e4');
        R(-3, -8, 6, 3, cap);
        R(-2, -9, 4, 1, cap);
        glows.push([X, Y - 7 * p, 8 * p, cap, 0.35]);
        break;
      }
      case 'lich':
        R(-4, -12, 8, 12, '#1f2937');
        R(-3, -12, 2, 11, '#374151');
        R(-2, -16, 4, 4, '#e5e7eb');
        R(-2, -17, 4, 1, '#ca8a04');
        R(-1, -15, 1, 1, '#4ade80');
        R(1, -15, 1, 1, '#4ade80');
        R(5, -20, 1, 20, '#57534e');
        R(4, -22, 3, 3, '#86efac');
        if (fo.alive) {
          glows.push([X + f * 5.5 * p, Y - 21 * p, 14 * p, '#4ade80', 0.7]);
          glows.push([X, Y - 10 * p, 26 * p, '#16a34a', 0.25 + 0.1 * Math.sin(world.t * 2)]);
        }
        break;
      case 'engine': {
        for (const [ox, oy, rr, sp] of [[0, -10, 9, 0.6], [-11, -5, 5, -1.1], [10, -15, 6, -0.9], [8, -3, 4, 1.4]] as [number, number, number, number][]) {
          const cx = X + ox * p;
          const cy = Y + oy * p;
          ctx.strokeStyle = fo.alive ? '#a16207' : '#57534e';
          ctx.lineWidth = Math.max(1, p * 1.2);
          ctx.beginPath();
          ctx.arc(cx, cy, rr * p, 0, Math.PI * 2);
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + (fo.alive ? world.t * sp : 0);
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * (rr + 1.6) * p, cy + Math.sin(a) * (rr + 1.6) * p);
          }
          ctx.stroke();
        }
        R(-3, -13, 6, 6, fo.alive ? '#fb923c' : '#292524');
        if (fo.alive) glows.push([X, Y - 10 * p, 30 * p, '#f97316', 0.5 + 0.15 * Math.sin(world.t * 5)]);
        break;
      }
      case 'queen': {
        ctx.fillStyle = fo.alive ? '#d8b4fe' : '#57534e';
        ctx.beginPath();
        ctx.ellipse(X - f * 6 * p, Y - 6 * p, 10 * p, 6 * p, 0, 0, Math.PI * 2);
        ctx.fill();
        R(2, -10, 6, 5, '#3b0764');
        R(7, -9, 2, 2, '#f0abfc');
        if (fo.alive) glows.push([X, Y - 6 * p, 30 * p, '#c084fc', 0.3]);
        break;
      }
      default:
        break;
    }
    ctx.globalAlpha = 1;
  }

  /** What sleeps below: in its chamber, dim and breathing; awake, lit and terrible. */
  const lair = world.caverns.find((c) => c.kind === 'lair');
  function sleeperDraw(t: number) {
    if (!lair) return;
    const fo = world.foes.find((f) => f.kind === 'sleeper');
    const awake = !!fo && fo.alive;
    const dead = !!fo && !fo.alive;
    const x = fo ? fo.x : lair.c * CELL;
    const y = fo ? fo.y : (lair.r + 4) * CELL;
    const X = SX(x);
    const Y = SY(y);
    const u = CELL * cam.zoom;
    if (X < -u * 14 || X > W + u * 14 || Y < -u * 14 || Y > H + u * 10) return;
    const breathe = 0.5 + 0.5 * Math.sin(t * (awake ? 3 : 0.8));
    const f = fo?.facing ?? 1;
    const tintC = world.sleeperTint;
    ctx.save();
    if (dead) ctx.globalAlpha = 0.55;
    const eyes = (ex: number, ey: number, color: string, n = 2) => {
      if (dead || (!awake && Math.sin(t * 0.3) < 0.7)) return;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = color;
        ctx.fillRect(ex + k * u * 0.6 * f, ey, u * 0.35, u * 0.25);
        glows.push([ex + k * u * 0.6 * f, ey, u * 1.5, color, awake ? 0.6 : 0.3]);
      }
    };
    switch (world.sleeperKind) {
      case 'worm':
        for (let k = 12; k >= 0; k--) {
          const a = k * 0.55 + (awake ? t * 2 : t * 0.2);
          const px = awake ? X - f * k * u * 1.1 + Math.sin(a) * u * 0.8 : X + Math.cos(k * 0.6) * u * 3.2;
          const py = awake ? Y - u * 2 + k * u * 0.6 + Math.cos(a) * u * 0.5 : Y - u * 2 + Math.sin(k * 0.6) * u * 1.6;
          const rad = u * (1.7 - k * 0.06);
          ctx.fillStyle = k % 2 ? mixHex(tintC, '#000000', 0.25) : tintC;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        eyes(X + f * u * 0.2, Y - u * 3.2, '#fb923c');
        break;
      case 'spider':
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = Math.max(1, u * 0.35);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {
          const a = awake ? Math.sin(t * 3 + k + sd) * 0.4 : 0;
          ctx.moveTo(X + sd * u, Y - u * 3);
          ctx.lineTo(X + sd * u * (4 + k * 1.4), Y - u * (6.5 - k * 0.6 + a * 2));
          ctx.lineTo(X + sd * u * (5 + k * 1.8), Y);
        }
        ctx.stroke();
        ctx.fillStyle = tintC;
        ctx.beginPath();
        ctx.ellipse(X - f * u * 1.5, Y - u * 3, u * 4, u * 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(X + f * u * 2.4, Y - u * 3.2, u * 1.8, u * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
        glows.push([X, Y - u * 3, u * 9, '#c084fc', 0.25 + breathe * 0.2]);
        eyes(X + f * u * 3, Y - u * 3.8, '#f0abfc', 4);
        break;
      case 'giant':
      case 'demon': {
        const demon = world.sleeperKind === 'demon';
        const h = u * 9 * (awake || dead ? 1 : 0.6);
        if (demon && !dead) {
          ctx.fillStyle = 'rgba(87,38,28,0.9)';
          for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(X, Y - h * 0.75);
            ctx.lineTo(X + sd * u * (awake ? 7 + breathe : 4), Y - h * (awake ? 1.15 : 0.95));
            ctx.lineTo(X + sd * u * (awake ? 6 : 3.5), Y - h * 0.45);
            ctx.lineTo(X + sd * u * 2, Y - h * 0.55);
            ctx.fill();
          }
          glows.push([X, Y - h * 0.6, u * (awake ? 14 : 8), '#f97316', awake ? 0.55 : 0.25 + breathe * 0.1]);
        } else if (!dead) glows.push([X, Y - h * 0.6, u * 10, '#7dd3fc', 0.2 + breathe * 0.15]);
        ctx.fillStyle = demon ? '#2a1410' : '#64748b';
        ctx.fillRect(X - u * 1.6, Y - h * 0.4, u * 1.2, h * 0.4);
        ctx.fillRect(X + u * 0.4, Y - h * 0.4, u * 1.2, h * 0.4);
        ctx.fillStyle = tintC;
        ctx.fillRect(X - u * 2.2, Y - h * 0.82, u * 4.4, h * 0.45);
        ctx.fillRect(X - u * 3.2, Y - h * 0.8, u, h * 0.42);
        ctx.fillRect(X + u * 2.2, Y - h * 0.8, u, h * 0.42);
        ctx.fillRect(X - u * 1.1, Y - h, u * 2.2, h * 0.2);
        eyes(X - u * 0.7, Y - h * 0.92, demon ? '#facc15' : '#38bdf8');
        break;
      }
      default: {
        ctx.strokeStyle = mixHex(tintC, '#ffffff', 0.15);
        ctx.lineCap = 'round';
        for (let k = 0; k < 7; k++) {
          ctx.lineWidth = u * (0.9 - k * 0.05);
          ctx.beginPath();
          const a0 = (k / 7) * Math.PI * 2;
          ctx.moveTo(X, Y - u * 3);
          const wave = awake ? t * 2 : t * 0.3;
          ctx.quadraticCurveTo(X + Math.cos(a0 + Math.sin(wave + k)) * u * 5, Y - u * 3 + Math.sin(a0 + Math.cos(wave + k)) * u * 4, X + Math.cos(a0) * u * (awake ? 8 : 5), Y - u + Math.sin(a0) * u * (awake ? 5 : 3));
          ctx.stroke();
        }
        ctx.fillStyle = tintC;
        ctx.beginPath();
        ctx.arc(X, Y - u * 3, u * 3.2, 0, Math.PI * 2);
        ctx.fill();
        if (!dead && (awake || Math.sin(t * 0.25) > 0.6)) {
          ctx.fillStyle = '#bef264';
          ctx.beginPath();
          ctx.ellipse(X + f * u * 0.6, Y - u * 3.4, u * 1.1, u * (awake ? 0.8 : 0.25), 0, 0, Math.PI * 2);
          ctx.fill();
          glows.push([X, Y - u * 3.4, u * 8, '#a3e635', awake ? 0.5 : 0.25]);
        }
        break;
      }
    }
    ctx.restore();
  }

  /** The dragon over the range: wings, a long neck, fire. */
  const DRAGON_COLORS = [['#7f1d1d', '#b91c1c'], ['#14532d', '#15803d'], ['#1e1b4b', '#4338ca'], ['#292524', '#57534e']];
  function dragonDraw(t: number) {
    const dg = world.dragon;
    if (!dg) return;
    const X = SX(dg.x);
    const Y = SY(dg.y);
    const u = CELL * cam.zoom * 0.9;
    if (X < -u * 30 || X > W + u * 30 || Y < -u * 30 || Y > H + u * 30) return;
    const [dark, light] = DRAGON_COLORS[dg.color];
    const f = dg.vx >= 0 ? 1 : -1;
    const flap = Math.sin(dg.wing);
    const fallen = dg.hp <= -999;
    ctx.save();
    if (fallen) ctx.globalAlpha = 0.85;
    // Wings.
    // Bat wings: an arm up to the elbow, fingers out to the tips, the membrane scalloped between.
    for (const back of [1, 0]) {
      const lift = fallen ? 0.2 : flap * (back ? 0.8 : 1);
      const sx = X + f * u * (back ? 1.5 : -0.5);
      const sy = Y - u;
      const ex = sx - f * u * 3;
      const ey = sy - u * (3 + lift * 5);
      const tips = [
        [ex - f * u * 4, ey - u * (1 + lift * 2)],
        [ex - f * u * 6.5, ey + u * (1.5 - lift)],
        [ex - f * u * 7, ey + u * (4.5 - lift * 2)],
        [sx - f * u * 6, sy + u * 1.2],
      ];
      ctx.fillStyle = back ? mixHex(dark, '#000000', 0.25) : dark;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      let px = ex;
      let py = ey;
      for (const [tx, ty] of tips) {
        // Each span sags inward between the fingers.
        ctx.quadraticCurveTo((px + tx) / 2 + f * u * 0.6, (py + ty) / 2 + u * 0.6, tx, ty);
        px = tx;
        py = ty;
      }
      ctx.quadraticCurveTo((px + sx) / 2, (py + sy) / 2 + u, sx, sy);
      ctx.fill();
      ctx.strokeStyle = back ? dark : light;
      ctx.lineWidth = Math.max(1, u * 0.35);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      for (const [tx, ty] of tips.slice(0, 3)) {
        ctx.moveTo(ex, ey);
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
    }
    // Body, tail, neck, head.
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(X, Y, u * 5, u * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = light;
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 1.2;
    ctx.beginPath();
    ctx.moveTo(X - f * u * 4, Y);
    ctx.quadraticCurveTo(X - f * u * 10, Y + u * (2 + Math.sin(t * 2) * 2), X - f * u * 15, Y - u * (1 + Math.sin(t * 2 + 1)));
    ctx.stroke();
    ctx.lineWidth = u * 1.3;
    ctx.beginPath();
    ctx.moveTo(X + f * u * 4, Y - u * 0.5);
    ctx.quadraticCurveTo(X + f * u * 7, Y - u * 4, X + f * u * 9, Y - u * 2.5);
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(X + f * u * 10, Y - u * 2.3, u * 1.8, u * 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(X + f * u * 10.4, Y - u * 2.8, u * 0.5, u * 0.4);
    glows.push([X + f * u * 10.4, Y - u * 2.6, u * 2, '#facc15', 0.5]);
    if (dg.breathing) {
      for (let k = 0; k < 14; k++) {
        const a = (t * 3 + k / 14) % 1;
        const fx = X + f * u * (11 + a * 14);
        const fy = Y - u * 2 + a * u * 10 + Math.sin(k * 7 + t * 9) * u * a * 2;
        ctx.fillStyle = hexA(a < 0.3 ? '#fef3c7' : a < 0.65 ? '#fb923c' : '#dc2626', 0.9 * (1 - a * 0.6));
        ctx.beginPath();
        ctx.arc(fx, fy, u * (0.6 + a * 1.6), 0, Math.PI * 2);
        ctx.fill();
      }
      glows.push([X + f * u * 18, Y + u * 2, u * 16, '#f97316', 0.6]);
    }
    ctx.restore();
  }

  // ---- the caverns -----------------------------------------------------------------------------------
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
      const lt = cv.known ? 1 : 0.45;
      switch (cv.kind) {
        case 'geode':
          for (let n = 0; n < 26; n++) {
            const up = hash(k, n, 2) < 0.5;
            const x = x0 + hash(k, n, 1) * (x1 - x0);
            const base = up ? y0 + CELL : y1;
            const len = (1 + hash(k, n, 3) * 2.2) * CELL;
            const col = hash(k, n, 4) < 0.5 ? '#a78bfa' : '#67e8f9';
            ctx.fillStyle = hexA(col, 0.75 * lt);
            ctx.beginPath();
            ctx.moveTo(SX(x - CELL * 0.4), SY(base));
            ctx.lineTo(SX(x + (hash(k, n, 5) - 0.5) * CELL), SY(base + (up ? len : -len)));
            ctx.lineTo(SX(x + CELL * 0.4), SY(base));
            ctx.fill();
          }
          glows.push([SX((x0 + x1) / 2), SY((y0 + y1) / 2), (x1 - x0) * 0.5 * Z, '#8b5cf6', 0.16 * lt]);
          break;
        case 'shrine':
          statue((x0 + x1) / 2, y1, CELL * 4.5, '#8a8478', true);
          glows.push([SX((x0 + x1) / 2), SY(y1 - CELL * 3), CELL * 7 * Z, '#fde68a', (cv.known ? 0.45 : 0.15) * (0.8 + 0.2 * Math.sin(t))]);
          break;
        case 'hive':
          for (let n = 0; n < 18; n++) {
            ctx.fillStyle = hexA('#e9d5ff', 0.55 * lt);
            ctx.beginPath();
            ctx.ellipse(SX(x0 + hash(k, n, 6) * (x1 - x0)), SY(y1 - CELL * (0.3 + hash(k, n, 7) * 1.5)), CELL * 0.5 * Z, CELL * 0.7 * Z, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'engine':
          if (!world.foes.some((f) => f.kind === 'engine' && f.home === cv.id)) for (const [ox, rr] of [[0, 4], [-5, 2.5], [5, 3]] as [number, number][]) {
            ctx.strokeStyle = hexA('#78716c', 0.6 * lt);
            ctx.lineWidth = Math.max(1, Z * 1.5);
            ctx.beginPath();
            ctx.arc(SX((x0 + x1) / 2 + ox * CELL), SY(y1 - CELL * 4), rr * CELL * Z, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        case 'warren':
          for (let n = 0; n < 5; n++) {
            const x = x0 + ((n + 0.5) / 5) * (x1 - x0);
            box(x, y1 - CELL * 1.6, CELL * 0.2, CELL * 1.6, '#57534e');
            glows.push([SX(x), SY(y1 - CELL * 1.8), CELL * 3 * Z, '#ef4444', 0.35 * lt * (0.8 + 0.2 * Math.sin(t * 7 + n))]);
          }
          break;
        case 'gnomes':
          for (let n = 0; n < 6; n++) {
            const x = x0 + ((n + 0.5) / 6) * (x1 - x0);
            box(x - CELL * 0.8, y1 - CELL * 1.6, CELL * 1.6, CELL * 1.6, '#7c5a36');
            box(x - CELL, y1 - CELL * 2.1, CELL * 2, CELL * 0.6, '#b91c1c');
            glows.push([SX(x), SY(y1 - CELL), CELL * 2.5 * Z, '#fbbf24', 0.45 * lt]);
          }
          break;
        default:
          break;
      }
      if (castHas('bats') && cv.known && (cv.kind === 'cavern' || cv.kind === 'lake')) {
        ctx.strokeStyle = 'rgba(214,211,209,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let n = 0; n < 9; n++) {
          const ph = t * 0.35 + n * 0.7 + k;
          const x = (x0 + x1) / 2 + Math.sin(ph) * (x1 - x0) * 0.4;
          const y = (y0 + y1) / 2 + Math.sin(ph * 1.7) * (y1 - y0) * 0.3;
          const fl = Math.sin(t * 14 + n) * 2 * Z;
          ctx.moveTo(SX(x) - 3 * Z, SY(y) - fl);
          ctx.lineTo(SX(x), SY(y));
          ctx.lineTo(SX(x) + 3 * Z, SY(y) - fl);
        }
        ctx.stroke();
      }
    });
    if (castHas('glowworms')) for (const c of ceilings) {
      const X = SX(c.x);
      const Y = SY(c.y);
      if (X < -10 || X > W + 10 || Y < -10 || Y > H + 10) continue;
      glows.push([X, Y + 2, 4 * Z, '#5eead4', (world.caverns[c.cave]?.known ? 0.7 : 0.3) * (0.6 + 0.4 * Math.sin(t * 0.8 + c.seed))]);
    }
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
          ctx.fillStyle = `rgba(168,162,158,${(0.25 * (1 - k)).toFixed(3)})`;
          for (let n = 0; n < 3; n++) {
            ctx.beginPath();
            ctx.arc(X + (hash(e.seed, n) - 0.5) * e.r * 2 * Zz, Y - k * e.r * Zz, e.r * (0.4 + k) * Zz, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'spark':
          ctx.fillStyle = hexA(e.color ?? '#fde68a', 1 - k);
          ctx.fillRect(X + (hash(e.seed, 1) - 0.5) * 14 * Zz * k, Y - k * 10 * Zz * hash(e.seed, 2), Math.max(1, Zz * 1.2), Math.max(1, Zz * 1.2));
          glows.push([X, Y, 6 * Zz, e.color ?? '#fde68a', 0.4 * (1 - k)]);
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
          glows.push([X, Y, r * 1.6, e.color ?? '#fde68a', 0.6 * (1 - k)]);
          break;
        }
        case 'blast':
          glows.push([X, Y, e.r * Zz * (0.5 + k), '#fb923c', 0.9 * (1 - k)]);
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
          glows.push([X, Y, e.r * 3 * Zz, '#f97316', 0.5 * (1 - k)]);
          break;
        case 'z':
          ctx.fillStyle = `rgba(226,232,240,${(0.6 * (1 - k)).toFixed(3)})`;
          ctx.font = serif(Math.max(7, Math.round(7 * Zz)));
          ctx.fillText('z', X + k * 6 * Zz, Y - k * 14 * Zz);
          break;
        default:
          break;
      }
    }
  }

  /** The dark of the deep, then the lights in it. */
  function dark(t: number) {
    const top = SY(peakRow * CELL + world.H * 0.25);
    const bottom = SY(world.GH);
    if (bottom > 0) {
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      const night = darkness();
      g.addColorStop(0, `rgba(3,3,8,${(0.08 + night * 0.15).toFixed(3)})`);
      g.addColorStop(0.5, 'rgba(3,3,8,0.3)');
      g.addColorStop(1, 'rgba(8,2,2,0.48)');
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.max(0, top), W, H);
      if (top > 0) {
        ctx.fillStyle = `rgba(3,4,10,${(0.35 * night).toFixed(3)})`;
        ctx.fillRect(0, 0, W, top);
      }
    }
    // A fallen hold is a dark hold.
    for (const h of world.holds) if (h.fallen) {
      const x0 = SX(h.x0 * CELL);
      const x1 = SX((h.x1 + 1) * CELL);
      if (x1 < 0 || x0 > W) continue;
      ctx.fillStyle = 'rgba(2,2,4,0.35)';
      ctx.fillRect(Math.max(0, x0), Math.max(0, SY(h.gateFloor * CELL - CELL * 4)), Math.min(W, x1) - Math.max(0, x0), H);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const fu of fungus) {
      const X = SX(fu.x);
      const Y = SY(fu.y);
      if (X < -30 || X > W + 30 || Y < -30 || Y > H + 30) continue;
      const a = (world.caverns[fu.cave]?.known ? 0.35 : 0.16) * (0.7 + 0.3 * Math.sin(t * 0.7 + fu.seed));
      ctx.fillStyle = hexA(fu.color, Math.min(1, a * 2.2));
      ctx.fillRect(X, Y - CELL * 0.4 * cam.zoom, Math.max(1, cam.zoom * 1.5), Math.max(1, CELL * 0.4 * cam.zoom));
      glow(X, Y - CELL * 0.3 * cam.zoom, CELL * 1.8 * cam.zoom, fu.color, a);
    }
    for (const [x, y, r, color, a] of glows) glow(x, y, r, color, a);
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
      let y = Math.max(98, Math.min(H - 76, SY(l.y) - 18));
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
    // Scrims behind the text, top and bottom, so it reads over anything.
    const top = 60 + world.holds.length * 14;
    let g = ctx.createLinearGradient(0, 0, 0, top + 24);
    g.addColorStop(0, `rgba(6,5,8,${(0.62 * level).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(6,5,8,${(0.4 * level).toFixed(3)})`);
    g.addColorStop(1, 'rgba(6,5,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, top + 24);
    g = ctx.createLinearGradient(0, H - 72, 0, H);
    g.addColorStop(0, 'rgba(6,5,8,0)');
    g.addColorStop(1, `rgba(6,5,8,${(0.55 * level).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 72, W, 72);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = serif(13);
    ctx.fillStyle = hexA('#e7dcc4', 0.88 * level);
    fillCrisp(ctx, fitText(ctx, `${MOUNTAIN_NAMES[world.mountain]} · ${SEASONS[world.season]} OF THE YEAR ${world.year}`, (W >= 980 ? W * 0.6 : W - 44)), 16, 26);
    ctx.font = serif(11);
    world.holds.forEach((h, k) => {
      const y = 42 + k * 14;
      ctx.fillStyle = hexA(h.fallen ? '#44403c' : h.color, 0.95 * level);
      ctx.fillRect(16, y - 8, 7, 8);
      ctx.fillStyle = hexA(h.war >= 0 ? '#fca5a5' : '#a8a29e', 0.88 * level);
      const n = world.dwarves.filter((d) => d.alive && d.hold === h.id).length;
      const king = h.fallen ? 'FALLEN' : h.king?.alive ? `KING ${h.king.name}${h.reign > 1 ? ` ${roman(Math.min(10, h.reign))}` : ''}` : 'NO KING';
      const war = h.war >= 0 ? ` · AT WAR WITH ${world.holds[h.war].name}` : '';
      fillCrisp(ctx, fitText(ctx, `${h.name} · ${h.clan} · ${king} · ${n} DWARVES · ${deepName(Math.max(0, h.levels.length - 1))}${war}`, (W >= 980 ? W * 0.6 : W - 44) - 12), 28, y);
    });
    ctx.font = serif(11, true);
    ctx.fillStyle = hexA('#a8a29e', 0.7 * level);
    fillCrisp(ctx, fitText(ctx, `These mountains hold ${world.cast.filter((c) => c !== 'only stone').slice(0, 7).join(', ')}.`, (W >= 980 ? W * 0.6 : W - 44)), 16, 46 + world.holds.length * 14);
    ctx.font = serif(11);
    ctx.textAlign = 'right';
    const boss = world.foes.find((f) => f.boss);
    const below = boss ? (boss.alive ? 'BELOW: SOMETHING IS AWAKE' : 'BELOW: IT IS ENDED')
      : world.below === 'sleeper' ? 'BELOW: SOMETHING SLEEPS' : world.below === 'lich' ? 'BELOW: THE OLD HALLS ARE NOT EMPTY' : world.below === 'engine' ? 'BELOW: SOMETHING TICKS' : world.below === 'hive' ? 'BELOW: SOMETHING HUMS' : 'BELOW: ONLY STONE';
    ctx.fillStyle = hexA(boss?.alive ? '#fca5a5' : '#c4b5fd', 0.8 * level);
    if (W >= 980) fillCrisp(ctx, fitText(ctx, below, W * 0.34), W - 16, 26);
    ctx.fillStyle = hexA('#fde68a', 0.75 * level);
    if (W >= 980) world.holds.flatMap((h) => h.artifacts.map((a) => ({ ...a, hold: h.name }))).slice(-3).forEach((a, k) => fillCrisp(ctx, fitText(ctx, `${a.name}, BY ${a.maker} OF ${a.hold}`, W * 0.34), W - 16, 42 + k * 15));
    ctx.textAlign = 'left';
    ctx.font = serif(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#e7dcc4', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
    ctx.restore();
  }

  /** A soft shade under the page's quiet zones (where its text sits), so the text stays legible. */
  let quietCanvas: HTMLCanvasElement | null = null;
  let quietAt = -1;
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
      let any = false;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const k = host.quiet((x + 0.5) * G, (y + 0.5) * G);
        const o4 = (y * gw + x) * 4;
        img.data[o4] = 5;
        img.data[o4 + 1] = 4;
        img.data[o4 + 2] = 9;
        img.data[o4 + 3] = Math.round(170 * k);
        if (k > 0.01) any = true;
      }
      q.putImageData(img, 0, 0);
      quietAt = t;
      if (!any) quietCanvas.dataset.empty = '1';
      else delete quietCanvas.dataset.empty;
    }
    if (quietCanvas.dataset.empty) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(quietCanvas, 0, 0, gw * G, gh * G);
  }

  function paint(t: number) {
    Z = cam.zoom;
    const level = 0.55 + 0.45 * host.intensity;
    shake = world.quake > 0.02 ? [Math.sin(t * 53) * world.quake * 3, Math.cos(t * 47) * world.quake * 2] : [0, 0];
    if (!rock) paintRock();
    redress();
    touchUp();
    ctx.imageSmoothingEnabled = true;
    sky(t);
    snow(t);
    rockLayer();
    outside(t);
    fluids(t);
    ctx.imageSmoothingEnabled = false;
    works();
    for (const room of world.rooms) furnish(room, t);
    galleryLights(t);
    const p = Math.max(0.45, Math.round(CELL * cam.zoom * 0.2 * 4) / 4);
    for (const l of world.loads) {
      const x = world.cellX(l.cell);
      const y = world.cellY(l.cell);
      if (visible(x, y)) box(x - CELL * 0.3, y - CELL * 0.35, CELL * 0.6, CELL * 0.35, ORE_COLOR[l.kind]);
    }
    caveDecor(t);
    sleeperDraw(t);
    for (const f of world.foes) foeSprite(f, p);
    for (const d of world.dwarves) dwarfSprite(d, t, p);
    ctx.imageSmoothingEnabled = true;
    dragonDraw(t);
    effects(t);
    dark(t);
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
    ambience: () => (world.foes.some((f) => f.boss && f.alive) || world.dragon || world.holds.some((h) => h.war >= 0) ? 0.9 : 0.35),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      rock = null;
      rg = null;
    },
  });
}

