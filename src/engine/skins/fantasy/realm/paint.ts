/**
 * Leylines' realm, painted: the land from high up, its towers and its mages.
 *
 * The ground (hills shaded, forests, fields round the villages, roads, shores and the sea, snow
 * on the heights) is painted once into a half-resolution texture and patched where fire burns
 * the woods, frost settles, or a ritual raises a forest. Over it, each frame: the marks spells
 * leave, the ley lines with power running along them, the stone circles, villages and ruins,
 * then everything that stands (towers in each order's style, mages, villagers, summoned things,
 * the dragon) sorted back to front; spells in flight; storms, rifts, the falling star; then the
 * night and the lights in it. Lights are cached glow sprites, drawn additively: no bloom.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { runWorld } from '../../../kit';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../../instruments/kit';
import { serif } from '../names';
import { createRealm, LAND_NAMES, SPELL_COLOR, type Land, type Order, type RealmWorld, type School, type Site, type Spell, type Tower, type Unit } from './sim';

type RGB = [number, number, number];
const TS = 1;
const GROUND: Record<Land, { lo: RGB; hi: RGB; dry: RGB }> = {
  isles: { lo: [86, 120, 70], hi: [120, 140, 96], dry: [176, 160, 120] },
  steppe: { lo: [128, 132, 78], hi: [158, 150, 96], dry: [180, 164, 112] },
  forest: { lo: [62, 96, 56], hi: [92, 118, 74], dry: [120, 120, 84] },
  desert: { lo: [196, 160, 108], hi: [222, 188, 132], dry: [232, 204, 150] },
  tundra: { lo: [150, 160, 160], hi: [204, 212, 218], dry: [176, 180, 176] },
  marsh: { lo: [76, 98, 70], hi: [104, 116, 82], dry: [120, 120, 90] },
  mountains: { lo: [100, 108, 90], hi: [140, 136, 124], dry: [150, 140, 120] },
};
const SEA: RGB = [30, 58, 84];
const TREE: Record<Land, string[]> = { isles: ['#2f5a3a', '#3f6b45'], steppe: ['#4a6034', '#5a6f3c'], forest: ['#1f4a2c', '#2b5a34', '#355f2f'], desert: ['#6b7a3a', '#55702f'], tundra: ['#2a4a42', '#3b5a50'], marsh: ['#2f4a34', '#3a5a3a'], mountains: ['#2b4a3a', '#3b5a44'] };
const LEY_COLOR: Record<Land, string> = { isles: '#5eead4', steppe: '#c4b5fd', forest: '#86efac', desert: '#fcd34d', tundra: '#93c5fd', marsh: '#5eead4', mountains: '#c4b5fd' };
const SKIN = ['#f1c7a1', '#e0ac69', '#c68642', '#8d5524'];

const rgbMix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mixHex = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, k);
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};

export type RealmPaintOptions = { land: string; scale: number; orders: number; storms: number; rifts: number; labels: boolean; hud: boolean };

export function mountRealm(host: SkinHost, o: RealmPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: RealmWorld = createRealm(host.config.seed, W, H, { land: o.land, orders: o.orders, storms: o.storms, rifts: o.rifts, scale: o.scale }, host.noise);
  const { GW, GH, CELL, cols, rows } = world;
  // The ground colours: the land blend, mixed.
  const mixBlend = (key: 'lo' | 'hi' | 'dry'): RGB => {
    let c: RGB = [0, 0, 0];
    for (const k of Object.keys(world.blend) as Land[]) c = [c[0] + GROUND[k][key][0] * world.blend[k], c[1] + GROUND[k][key][1] * world.blend[k], c[2] + GROUND[k][key][2] * world.blend[k]];
    return c;
  };
  const LO = mixBlend('lo');
  const HI = mixBlend('hi');
  const DRY = mixBlend('dry');
  const trees = TREE[world.land];
  const ley = LEY_COLOR[world.land];

  // ---- the camera --------------------------------------------------------------------------------
  const cam = { x: GW / 2, y: GH / 2, zoom: 0.6 };
  const minZoom = () => Math.max(W / GW, H / GH);
  let Z = 1;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  function camera(dt: number) {
    const s = world.director.shot;
    const zoom = Math.max(minZoom(), Math.min(2.2, s.zoom));
    cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 0.5);
    const k = Math.min(1, dt * 0.7);
    cam.x += (s.x - cam.x) * k;
    cam.y += (s.y - cam.y) * k;
    const hw = W / 2 / cam.zoom;
    const hh = H / 2 / cam.zoom;
    cam.x = Math.max(hw, Math.min(GW - hw, cam.x));
    cam.y = Math.max(hh, Math.min(GH - hh, cam.y));
  }
  camera(10);
  const visible = (x: number, y: number, pad = 80) => {
    const X = SX(x);
    const Y = SY(y);
    return X > -pad * Z && X < W + pad * Z && Y > -pad * Z * 2 && Y < H + pad * Z;
  };

  // ---- the ground ----------------------------------------------------------------------------------
  let gg: CanvasRenderingContext2D | null = null;
  /** A cell field sampled smoothly (bilinear). */
  const bil = (h: Float32Array, x: number, y: number) => {
    const fx = Math.max(0, Math.min(cols - 1.001, x / CELL - 0.5));
    const fy = Math.max(0, Math.min(rows - 1.001, y / CELL - 0.5));
    const c = Math.floor(fx);
    const r = Math.floor(fy);
    const u = fx - c;
    const v = fy - r;
    const i = r * cols + c;
    return h[i] * (1 - u) * (1 - v) + h[i + 1] * u * (1 - v) + h[i + cols] * (1 - u) * v + h[i + cols + 1] * u * v;
  };
  const hAt = (x: number, y: number) => bil(world.height, x, y);
  const seaLevel = (() => {
    let lo = Infinity;
    for (let i = 0; i < world.water.length; i++) if (!world.water[i]) lo = Math.min(lo, world.height[i]);
    return lo;
  })();
  // The land's heights, ranked: hills and mountains are its highest few parts, whatever the seed.
  const ranked = Array.from(world.height).filter((h) => h >= seaLevel).sort((a, b) => a - b);
  const pct = (p: number) => ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * p))] ?? 1;
  const pHill = pct(0.8 - world.blend.mountains * 0.2);
  const pMtn = pct(0.91 - world.blend.mountains * 0.25);
  const pSnow = pct(0.965 - world.blend.mountains * 0.1 - world.blend.tundra * 0.2);
  function groundPixel(x: number, y: number, out: Uint8ClampedArray, o4: number) {
    const h = hAt(x, y);
    const i = world.cellAt(x, y);
    const n = hash(Math.floor(x), Math.floor(y), 3);
    if (h < seaLevel) {
      const deep = Math.min(1, (seaLevel - h) * 4);
      const c = rgbMix([58, 96, 112], SEA, deep);
      const k = 0.95 + n * 0.08;
      out[o4] = c[0] * k;
      out[o4 + 1] = c[1] * k;
      out[o4 + 2] = c[2] * k;
      out[o4 + 3] = 255;
      return;
    }
    // Hill shading from the upper left.
    const sh = (hAt(x - 4, y - 4) - hAt(x + 4, y + 4)) * 3.5;
    let c = rgbMix(LO, HI, Math.max(0, Math.min(1, (h - seaLevel) * 1.6)));
    if (h - seaLevel < 0.03) c = rgbMix(c, DRY, 0.7);
    if (h > pHill) c = rgbMix(c, [128, 120, 108], Math.min(0.55, (h - pHill) * 4));
    const bu = world.burnt[i] > 0 ? bil(world.burnt, x, y) : 0;
    const fr = world.frost[i] > 0 ? bil(world.frost, x, y) : 0;
    const bl = world.blight[i] > 0 ? bil(world.blight, x, y) : 0;
    if (bu > 0) c = rgbMix(c, [52, 44, 40], bu * 0.75);
    if (fr > 0) c = rgbMix(c, [220, 232, 244], fr * 0.7);
    if (bl > 0) c = rgbMix(c, [70, 52, 80], bl * 0.6);
    // Contours, like a surveyor's map, faint.
    const band = (((h - seaLevel) * 16) % 1 + 1) % 1;
    const k = (0.92 + n * 0.1 + Math.max(-0.16, Math.min(0.2, sh))) * (band < 0.05 ? 0.9 : 1);
    out[o4] = c[0] * k;
    out[o4 + 1] = c[1] * k;
    out[o4 + 2] = c[2] * k;
    out[o4 + 3] = 255;
  }
  /** Trees of a region (world px box), as little crowns with a lit side. */
  function treesIn(x0: number, y0: number, x1: number, y1: number) {
    if (!gg) return;
    for (let r = Math.max(0, Math.floor(y0 / CELL)); r <= Math.min(rows - 1, Math.floor(y1 / CELL)); r++) for (let c = Math.max(0, Math.floor(x0 / CELL)); c <= Math.min(cols - 1, Math.floor(x1 / CELL)); c++) {
      const i = r * cols + c;
      const f = world.forest[i] * (1 - world.burnt[i]);
      if (f < 0.08) continue;
      const n = Math.round(f * 3);
      for (let k = 0; k < n; k++) {
        const x = (c + hash(c, r, k * 2 + 1)) * CELL;
        const y = (r + hash(c, r, k * 2 + 2)) * CELL;
        const rad = (2.6 + hash(c, r, k + 9) * 2.4) * TS * 1.6;
        const col = trees[Math.floor(hash(c, r, k + 5) * trees.length)];
        gg.fillStyle = 'rgba(0,0,0,0.22)';
        gg.beginPath();
        gg.ellipse(x * TS + rad * 0.4, y * TS + rad * 0.5, rad, rad * 0.7, 0, 0, Math.PI * 2);
        gg.fill();
        gg.fillStyle = world.frost[i] > 0.3 ? '#cbd5e1' : col;
        gg.beginPath();
        gg.arc(x * TS, y * TS, rad, 0, Math.PI * 2);
        gg.fill();
        gg.fillStyle = 'rgba(255,255,230,0.12)';
        gg.beginPath();
        gg.arc(x * TS - rad * 0.3, y * TS - rad * 0.3, rad * 0.55, 0, Math.PI * 2);
        gg.fill();
      }
    }
  }
  function roadsIn(x0: number, y0: number, x1: number, y1: number) {
    if (!gg) return;
    gg.save();
    gg.beginPath();
    gg.rect(x0 * TS, y0 * TS, (x1 - x0) * TS, (y1 - y0) * TS);
    gg.clip();
    gg.lineCap = 'round';
    for (const e of world.edges) {
      const a = world.sites[e.a];
      const b = world.sites[e.b];
      if (Math.max(a.x, b.x) < x0 - 20 || Math.min(a.x, b.x) > x1 + 20 || Math.max(a.y, b.y) < y0 - 20 || Math.min(a.y, b.y) > y1 + 20) continue;
      gg.strokeStyle = 'rgba(92,70,48,0.55)';
      gg.lineWidth = 4 * TS * 1.6;
      gg.beginPath();
      gg.moveTo(a.x * TS, a.y * TS);
      gg.lineTo(b.x * TS, b.y * TS);
      gg.stroke();
      gg.strokeStyle = 'rgba(190,160,118,0.55)';
      gg.lineWidth = 2.2 * TS * 1.6;
      gg.stroke();
      // Bridges where the road crosses water.
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n;
        const y = a.y + ((b.y - a.y) * k) / n;
        if (!world.wet(x, y)) continue;
        gg.fillStyle = '#7c5a36';
        gg.fillRect((x - 3) * TS, (y - 3) * TS, 6 * TS, 6 * TS);
      }
    }
    // Fields round the villages.
    for (const s of world.sites) {
      if (s.kind !== 'village' || s.x < x0 - 100 || s.x > x1 + 100 || s.y < y0 - 80 || s.y > y1 + 80) continue;
      for (let k = 0; k < 7; k++) {
        const a = hash(s.id, k, 1) * Math.PI * 2;
        const d = 50 + hash(s.id, k, 2) * 40;
        const fx = s.x + Math.cos(a) * d;
        const fy = s.y + Math.sin(a) * d * 0.7;
        if (world.wet(fx, fy)) continue;
        const fw = 26 + hash(s.id, k, 3) * 24;
        const fh = 16 + hash(s.id, k, 4) * 14;
        gg.fillStyle = ['rgba(196,170,90,0.55)', 'rgba(120,140,70,0.5)', 'rgba(150,120,70,0.5)'][k % 3];
        gg.fillRect((fx - fw / 2) * TS, (fy - fh / 2) * TS, fw * TS, fh * TS);
        gg.fillStyle = 'rgba(0,0,0,0.12)';
        for (let l = 0; l < fh; l += 4) gg.fillRect((fx - fw / 2) * TS, (fy - fh / 2 + l) * TS, fw * TS, TS);
      }
    }
    gg.restore();
  }
  /** Mountains and hills drawn as a mapmaker draws them: peaks lit on the left, snow on the highest. */
  const rock = rgbMix(HI, [140, 132, 120], 0.6);
  const rockLit = `rgb(${rgbMix(rock, [255, 250, 240], 0.25).map((v) => v | 0).join(',')})`;
  const rockDark = `rgb(${rgbMix(rock, [20, 20, 30], 0.45).map((v) => v | 0).join(',')})`;
  const rockMid = `rgb(${rock.map((v) => v | 0).join(',')})`;
  const glyphs: { x: number; y: number; w: number; h: number; kind: 'mtn' | 'hill'; snow: boolean; seed: number }[] = [];
  for (let r = 1; r < rows - 1; r += 2) for (let c = 1; c < cols - 1; c += 2) {
    const jx = (c + hash(c, r, 61) * 2) * CELL;
    const jy = (r + hash(c, r, 62) * 2) * CELL;
    const h = hAt(jx, jy);
    if (h <= pHill || world.wet(jx, jy) || world.sites.some((s) => Math.abs(s.x - jx) < 60 && Math.abs(s.y - jy) < 44)) continue;
    if (h > pMtn) {
      if (hash(c, r, 63) > 0.55) continue;
      const k = Math.min(1, (h - pMtn) / Math.max(0.01, pct(0.995) - pMtn));
      const w = 26 + k * 34 + hash(c, r, 64) * 10;
      glyphs.push({ x: jx, y: jy, w, h: w * (0.7 + hash(c, r, 65) * 0.3), kind: 'mtn', snow: h > pSnow || world.blend.tundra > 0.35, seed: c * 997 + r });
    } else if (hash(c, r, 66) < 0.22) glyphs.push({ x: jx, y: jy, w: 14 + hash(c, r, 67) * 10, h: 6, kind: 'hill', snow: false, seed: c * 997 + r });
  }
  glyphs.sort((a, b) => a.y - b.y);
  function mountainsIn(x0: number, y0: number, x1: number, y1: number) {
    if (!gg) return;
    const T = (v: number) => v * TS;
    for (const m of glyphs) {
      if (m.x + m.w < x0 || m.x - m.w > x1 || m.y < y0 || m.y - m.h > y1) continue;
      const bx = T(m.x);
      const by = T(m.y);
      const w = T(m.w);
      const h = T(m.h);
      if (m.kind === 'hill') {
        gg.fillStyle = rockDark;
        gg.beginPath();
        gg.ellipse(bx, by, w / 2, h, 0, Math.PI, Math.PI * 2);
        gg.fill();
        gg.fillStyle = rockMid;
        gg.beginPath();
        gg.ellipse(bx - w * 0.08, by, w / 2 - 1, h - 1, 0, Math.PI, Math.PI * 1.6);
        gg.lineTo(bx - w * 0.08, by);
        gg.fill();
        continue;
      }
      const px = bx + (hash(m.seed, 1) - 0.5) * w * 0.2;
      const py = by - h;
      // Shadow on the ground to the right.
      gg.fillStyle = 'rgba(0,0,0,0.18)';
      gg.beginPath();
      gg.moveTo(px, py);
      gg.lineTo(bx + w * 0.75, by + 2);
      gg.lineTo(bx + w * 0.2, by + 3);
      gg.fill();
      gg.fillStyle = rockDark;
      gg.beginPath();
      gg.moveTo(bx - w / 2, by);
      gg.lineTo(px, py);
      gg.lineTo(bx + w / 2, by);
      gg.fill();
      gg.fillStyle = rockLit;
      gg.beginPath();
      gg.moveTo(bx - w / 2, by);
      gg.lineTo(px, py);
      gg.lineTo(px - w * 0.04, py + h * 0.4);
      gg.lineTo(px + w * 0.06, by);
      gg.fill();
      // Ridges.
      gg.strokeStyle = rockDark;
      gg.lineWidth = Math.max(1, w * 0.02);
      gg.beginPath();
      gg.moveTo(px, py);
      gg.lineTo(px + w * 0.1, py + h * 0.5);
      gg.lineTo(px + w * 0.02, by);
      gg.stroke();
      if (m.snow) {
        const sh = h * 0.34;
        gg.fillStyle = '#eef2f7';
        gg.beginPath();
        gg.moveTo(px, py);
        gg.lineTo(px - (w / 2) * (sh / h), py + sh);
        gg.lineTo(px - w * 0.06, py + sh * 0.75);
        gg.lineTo(px + w * 0.02, py + sh * 1.05);
        gg.lineTo(px + w * 0.1, py + sh * 0.8);
        gg.lineTo(px + (w / 2) * (sh / h), py + sh);
        gg.closePath();
        gg.fill();
        gg.fillStyle = 'rgba(150,170,200,0.55)';
        gg.beginPath();
        gg.moveTo(px, py);
        gg.lineTo(px + (w / 2) * (sh / h), py + sh);
        gg.lineTo(px + w * 0.1, py + sh * 0.8);
        gg.closePath();
        gg.fill();
      }
    }
  }
  /** The ground in tiles, so a patch re-uploads one small texture, not the whole land. */
  type Tile = { x: number; y: number; w: number; h: number; c: HTMLCanvasElement; g: CanvasRenderingContext2D };
  const TILE = 512;
  let tiles: Tile[] | null = null;
  /** Repaint a region (texture px) of a tile: the ground, then roads, trees and mountains over it. */
  function paintTile(tl: Tile, px0: number, py0: number, pw: number, ph: number) {
    const img = tl.g.createImageData(pw, ph);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) groundPixel((px0 + x) / TS, (py0 + y) / TS, img.data, (y * pw + x) * 4);
    tl.g.putImageData(img, px0 - tl.x, py0 - tl.y);
    gg = tl.g;
    gg.save();
    gg.translate(-tl.x, -tl.y);
    gg.beginPath();
    gg.rect(px0, py0, pw, ph);
    gg.clip();
    const x0 = px0 / TS;
    const y0 = py0 / TS;
    const x1 = (px0 + pw) / TS;
    const y1 = (py0 + ph) / TS;
    roadsIn(x0, y0, x1, y1);
    treesIn(x0 - 10, y0 - 10, x1 + 10, y1 + 10);
    mountainsIn(x0, y0, x1, y1);
    gg.restore();
  }
  function paintGround() {
    tiles = [];
    const tw = Math.ceil(GW * TS);
    const th = Math.ceil(GH * TS);
    for (let y = 0; y < th; y += TILE) for (let x = 0; x < tw; x += TILE) {
      const c = document.createElement('canvas');
      c.width = Math.min(TILE, tw - x);
      c.height = Math.min(TILE, th - y);
      const tl: Tile = { x, y, w: c.width, h: c.height, c, g: c.getContext('2d')! };
      tiles.push(tl);
      paintTile(tl, x, y, tl.w, tl.h);
    }
    world.dirtyCells.length = 0;
  }
  function patch() {
    if (!tiles || !world.dirtyCells.length) return;
    // Merge the changed cells into a few boxes and repaint them.
    const boxes: [number, number, number, number][] = [];
    for (const i of world.dirtyCells.splice(0, 400)) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const b = boxes.find(([c0, r0, c1, r1]) => c >= c0 - 3 && c <= c1 + 3 && r >= r0 - 3 && r <= r1 + 3);
      if (b) {
        b[0] = Math.min(b[0], c);
        b[1] = Math.min(b[1], r);
        b[2] = Math.max(b[2], c);
        b[3] = Math.max(b[3], r);
      } else boxes.push([c, r, c, r]);
    }
    for (const [c0, r0, c1, r1] of boxes.slice(0, 6)) {
      const px0 = Math.floor((c0 - 1) * CELL * TS);
      const py0 = Math.floor((r0 - 1) * CELL * TS);
      const px1 = Math.ceil((c1 + 2) * CELL * TS);
      const py1 = Math.ceil((r1 + 2) * CELL * TS);
      for (const tl of tiles) {
        const ix0 = Math.max(px0, tl.x);
        const iy0 = Math.max(py0, tl.y);
        const ix1 = Math.min(px1, tl.x + tl.w);
        const iy1 = Math.min(py1, tl.y + tl.h);
        if (ix1 > ix0 && iy1 > iy0) paintTile(tl, ix0, iy0, ix1 - ix0, iy1 - iy0);
      }
    }
  }


  // ---- light -----------------------------------------------------------------------------------------
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
    const d = world.day;
    // A long night: the lights are the point.
    const n = d < 0.18 || d > 0.7 ? 1 : d < 0.28 ? 1 - (d - 0.18) / 0.1 : d > 0.6 ? (d - 0.6) / 0.1 : 0;
    const eclipse = world.castIds.includes('eclipse') && world.moons > 0.44 && world.moons < 0.47 ? 0.8 : 0;
    return Math.max(n, eclipse);
  };

  // ---- drawing helpers ---------------------------------------------------------------------------------
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
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
  const shadow = (x: number, y: number, rx: number, ry: number, a = 0.3) => {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(SX(x), SY(y), rx * Z, ry * Z, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const STONE: Record<string, string> = { spire: '#cbd5e1', ziggurat: '#b8a888', crystal: '#94a3b8', tree: '#6b4a2b', obelisk: '#27272a' };

  // ---- the lines, the circles, the villages, the ruins ------------------------------------------------
  function lines() {
    ctx.lineCap = 'round';
    for (const e of world.edges) {
      if (!e.ley) continue;
      const a = world.sites[e.a];
      const b = world.sites[e.b];
      if (!visible((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y) / 2 + 60)) continue;
      const oa = a.tower && a.tower.level > 0 ? world.orders[a.tower.order] : null;
      const ob = b.tower && b.tower.level > 0 ? world.orders[b.tower.order] : null;
      const col = oa && ob && oa === ob ? oa.trim : oa && ob ? '#fca5a5' : ley;
      const strength = 0.25 + e.flow * 0.35 + (world.converging ? 0.25 : 0);
      ctx.strokeStyle = hexA(col, 0.12 * strength * 2);
      ctx.lineWidth = Math.max(1, 7 * Z);
      ctx.beginPath();
      ctx.moveTo(SX(a.x), SY(a.y));
      ctx.lineTo(SX(b.x), SY(b.y));
      ctx.stroke();
      ctx.strokeStyle = hexA(col, Math.min(0.9, 0.45 * strength + 0.15));
      ctx.lineWidth = Math.max(1, 1.6 * Z);
      ctx.stroke();
      // Power running along the line.
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.round(d / 120));
      for (let k = 0; k < n; k++) {
        const u = (e.pulse + k / n) % 1;
        const x = a.x + (b.x - a.x) * u;
        const y = a.y + (b.y - a.y) * u;
        glows.push([SX(x), SY(y), 9 * Z, col, 0.35 + strength * 0.4]);
      }
    }
  }
  function circles(t: number) {
    for (const s of world.sites) {
      if (!visible(s.x, s.y)) continue;
      if (s.kind === 'well') {
        const o = s.tower ? world.orders[s.tower.order] : null;
        const col = o ? o.trim : ley;
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          const x = s.x + Math.cos(a) * 26;
          const y = s.y + Math.sin(a) * 15;
          rect(x - 1.6, y - 4.5, 3.2, 4.5, '#9ca3af');
          rect(x - 1.6, y - 4.5, 1.2, 4.5, '#d1d5db');
        }
        ctx.strokeStyle = hexA(col, 0.5);
        ctx.lineWidth = Math.max(1, Z);
        ctx.beginPath();
        ctx.ellipse(SX(s.x), SY(s.y), 18 * Z, 10 * Z, 0, 0, Math.PI * 2);
        ctx.stroke();
        lit(s.x, s.y, 26, col, 0.3 + 0.1 * Math.sin(t * 1.5 + s.id));
      } else if (s.kind === 'ruin') {
        for (let k = 0; k < 7; k++) {
          const x = s.x + (hash(s.id, k, 1) - 0.5) * 60;
          const y = s.y + (hash(s.id, k, 2) - 0.5) * 34;
          const h = 6 + hash(s.id, k, 3) * 14;
          shadow(x + 2, y, 4, 2, 0.25);
          rect(x - 2.5, y - h, 5, h, '#a8a29e');
          rect(x - 2.5, y - h, 1.6, h, '#d6d3d1');
          rect(x - 3.2, y - h - 1.5, 6.4, 1.5, '#78716c');
        }
        if (world.blight.length && world.castIds.includes('blight')) lit(s.x, s.y - 6, 40, '#a855f7', 0.12 + 0.05 * Math.sin(t));
      }
    }
  }
  /** Cottages: walls, a roof, a lit window at night, smoke from the chimney. */
  function cottage(x: number, y: number, v: number, burnt: boolean, t: number, night: number) {
    shadow(x + 2, y + 1, 7, 2.5, 0.28);
    const roof = burnt ? '#292524' : ['#7f1d1d', '#78350f', '#57534e', '#9a3412'][v];
    rect(x - 5, y - 6, 10, 6, burnt ? '#44403c' : '#d6c3a5');
    poly([x - 6.5, y - 6, x, y - 11, x + 6.5, y - 6], roof);
    rect(x - 1, y - 3.6, 2, 2, night > 0.3 && !burnt ? '#fde68a' : '#57534e');
    if (night > 0.3 && !burnt) lit(x, y - 3, 6, '#f59e0b', 0.35 * night);
    if (!burnt && hash(x | 0, y | 0) < 0.5) for (let k = 0; k < 3; k++) {
      const a = (t * 0.4 + k / 3 + hash(x | 0, k)) % 1;
      ctx.fillStyle = `rgba(200,200,200,${(0.22 * (1 - a)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(SX(x + 3 + a * 6), SY(y - 11 - a * 14), (1.5 + a * 3) * Z, 0, Math.PI * 2);
      ctx.fill();
    }
    if (burnt) lit(x, y - 4, 8, '#f97316', 0.2 + 0.1 * Math.sin(t * 7 + x));
  }

  // ---- towers -------------------------------------------------------------------------------------------
  function towerDraw(tw: Tower, t: number, night: number) {
    const s = world.sites[tw.site];
    const o = world.orders[tw.order];
    const x = s.x;
    const y = s.y - 2;
    const sc = SPELL_COLOR[o.school];
    const lvl = tw.level || 1;
    const full = 34 + lvl * 16;
    const hgt = tw.level === 0 ? Math.max(6, full * tw.build) : full;
    shadow(x + 6, y + 1, 20, 6, 0.35);
    const st = STONE[o.style];
    const lightSide = mixHex(st, '#ffffff', 0.2);
    const darkSide = mixHex(st, '#000000', 0.3);
    const crystal = (cx: number, cy: number, size: number) => {
      const bob = Math.sin(t * 1.6 + tw.id) * 2;
      poly([cx, cy - size * 1.4 + bob, cx + size * 0.7, cy + bob, cx, cy + size * 0.9 + bob, cx - size * 0.7, cy + bob], sc);
      poly([cx, cy - size * 1.4 + bob, cx - size * 0.7, cy + bob, cx, cy + size * 0.9 + bob], mixHex(sc, '#ffffff', 0.4));
      lit(cx, cy + bob, size * 4 * (0.6 + tw.charge * 0.5), sc, 0.3 + tw.charge * 0.25);
    };
    const windows = (x0: number, y0: number, w: number, h: number) => {
      for (let wy = y0 + 10; wy < y0 + h - 6; wy += 11) {
        const on = night > 0.2 && hash(tw.id, wy | 0) < 0.75;
        rect(x0 + w / 2 - 1.2, wy, 2.4, 4, on ? '#fde68a' : '#1f2937');
        if (on) lit(x0 + w / 2, wy + 2, 6, '#fbbf24', 0.25 * night);
      }
    };
    switch (o.style) {
      case 'spire': {
        const w = 12 + lvl * 1.2;
        rect(x - w / 2 - 3, y - 6, w + 6, 6, darkSide);
        rect(x - w / 2, y - hgt, w, hgt, st);
        rect(x - w / 2, y - hgt, w * 0.35, hgt, lightSide);
        rect(x + w / 2 - w * 0.22, y - hgt, w * 0.22, hgt, darkSide);
        for (let by = y - hgt + 12; by < y - 8; by += 18) rect(x - w / 2 - 1, by, w + 2, 2, darkSide);
        windows(x - w / 2, y - hgt, w, hgt);
        if (tw.level > 0) {
          poly([x - w / 2 - 3, y - hgt, x, y - hgt - 18 - lvl * 2, x + w / 2 + 3, y - hgt], o.robe);
          poly([x - w / 2 - 3, y - hgt, x, y - hgt - 18 - lvl * 2, x - 1, y - hgt], mixHex(o.robe, '#ffffff', 0.25));
          rect(x - 0.5, y - hgt - 30 - lvl * 2, 1, 12, '#57534e');
          const wave = Math.sin(t * 3 + tw.id) * 1.5;
          poly([x + 0.5, y - hgt - 30 - lvl * 2, x + 10 + wave, y - hgt - 27 - lvl * 2, x + 0.5, y - hgt - 24 - lvl * 2], sc);
          crystal(x, y - hgt - 40 - lvl * 2, 4 + lvl * 0.6);
        }
        break;
      }
      case 'ziggurat': {
        const tiers = Math.max(1, Math.round((hgt / full) * (2 + lvl)));
        const th = hgt / Math.max(1, 2 + lvl);
        for (let k = 0; k < tiers; k++) {
          const w = 46 - k * (32 / (2 + lvl));
          const ty = y - th * (k + 1);
          rect(x - w / 2, ty, w, th, k % 2 ? st : mixHex(st, '#000000', 0.08));
          rect(x - w / 2, ty, w * 0.3, th, lightSide);
          rect(x - w / 2, ty, w, 1.2, mixHex(st, '#ffffff', 0.35));
          rect(x - 2, ty + th * 0.3, 4, th * 0.5, night > 0.2 ? '#fbbf24' : '#3f3f46');
        }
        if (tw.level > 0) {
          const topY = y - th * tiers;
          rect(x - 5, topY - 4, 10, 4, '#3f3f46');
          for (let k = 0; k < 5; k++) {
            const a = (t * 1.8 + k / 5) % 1;
            ctx.fillStyle = hexA(a < 0.3 ? '#fef3c7' : sc, 0.9 * (1 - a));
            ctx.beginPath();
            ctx.arc(SX(x + Math.sin(k * 2.1 + t * 3) * 3), SY(topY - 6 - a * 16), (3.5 - a * 2.5) * Z, 0, Math.PI * 2);
            ctx.fill();
          }
          lit(x, topY - 10, 34 + lvl * 4, sc, 0.5 + tw.charge * 0.3);
        }
        break;
      }
      case 'crystal': {
        rect(x - 14, y - 6, 28, 6, '#57534e');
        const shards = 3 + lvl;
        for (let k = 0; k < shards; k++) {
          const off = (k - (shards - 1) / 2) * 6;
          const hh = hgt * (k === Math.floor(shards / 2) ? 1 : 0.45 + hash(tw.id, k) * 0.4);
          const lean = off * 0.15;
          poly([x + off - 4, y - 4, x + off + lean, y - hh, x + off + 4, y - 4], hexA(mixHex(sc, '#1e293b', 0.35), 0.92));
          poly([x + off - 4, y - 4, x + off + lean, y - hh, x + off, y - 4], hexA(mixHex(sc, '#ffffff', 0.35), 0.85));
        }
        if (tw.level > 0) lit(x, y - hgt * 0.6, hgt * 0.6, sc, 0.18 + tw.charge * 0.2);
        if (tw.level > 0) crystal(x, y - hgt - 14, 4 + lvl * 0.5);
        break;
      }
      case 'tree': {
        const w = 10 + lvl * 2;
        poly([x - w, y, x - w / 2, y - hgt * 0.75, x + w / 2, y - hgt * 0.75, x + w, y], '#5c3d24');
        poly([x - w, y, x - w / 2, y - hgt * 0.75, x - w / 4, y - hgt * 0.75, x - w / 2, y], '#7c5a36');
        if (tw.level > 0) {
          const cy = y - hgt * 0.8;
          for (const [dx, dy, rr2, c] of [[0, -8, 18, '#14532d'], [-14, 0, 13, '#166534'], [14, -2, 14, '#15803d'], [0, -20, 12, '#16a34a'], [-6, -14, 10, '#22c55e']] as [number, number, number, string][]) {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(SX(x + dx), SY(cy + dy), (rr2 + lvl * 1.5) * Z, 0, Math.PI * 2);
            ctx.fill();
          }
          for (let k = 0; k < 3 + lvl; k++) {
            const lx = x + (hash(tw.id, k) - 0.5) * 34;
            const ly = cy + (hash(tw.id, k, 2) - 0.3) * 20;
            rect(lx - 1, ly, 2, 2.4, sc);
            lit(lx, ly + 1, 8, sc, 0.45);
          }
          rect(x - 6, y - hgt * 0.45, 12, 7, '#92400e');
          poly([x - 8, y - hgt * 0.45, x, y - hgt * 0.45 - 6, x + 8, y - hgt * 0.45], o.robe);
        }
        break;
      }
      default: {
        const w = 12 + lvl;
        poly([x - w / 2, y, x - w / 3, y - hgt, x + w / 3, y - hgt, x + w / 2, y], st);
        poly([x - w / 2, y, x - w / 3, y - hgt, x - w / 6, y - hgt, x - w / 4, y], '#3f3f46');
        if (tw.level > 0) {
          poly([x - w / 3, y - hgt, x, y - hgt - 10, x + w / 3, y - hgt], '#18181b');
          for (let ry = y - hgt + 8; ry < y - 6; ry += 9) {
            const a = 0.5 + 0.5 * Math.sin(t * 2 + ry * 0.2 + tw.id);
            rect(x - 1.5, ry, 3, 4, hexA(sc, 0.4 + a * 0.6));
            if (a > 0.7) lit(x, ry + 2, 7, sc, 0.4 * a);
          }
          ctx.strokeStyle = hexA(sc, 0.6);
          ctx.lineWidth = Math.max(1, Z);
          for (let k = 0; k < Math.min(3, lvl); k++) {
            ctx.beginPath();
            ctx.ellipse(SX(x), SY(y - hgt * (0.4 + k * 0.22) + Math.sin(t + k) * 2), (14 - k * 2) * Z, 4 * Z, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          lit(x, y - hgt - 6, 22 + lvl * 4, sc, 0.35 + tw.charge * 0.3);
        }
        break;
      }
    }
    // Scaffolding while it is built.
    if (tw.level === 0) {
      ctx.strokeStyle = 'rgba(146,104,60,0.85)';
      ctx.lineWidth = Math.max(1, 0.8 * Z);
      ctx.beginPath();
      for (const dx of [-14, 14]) {
        ctx.moveTo(SX(x + dx), SY(y));
        ctx.lineTo(SX(x + dx), SY(y - hgt - 6));
      }
      for (let k = 6; k < hgt + 6; k += 9) {
        ctx.moveTo(SX(x - 14), SY(y - k));
        ctx.lineTo(SX(x + 14), SY(y - k));
      }
      ctx.stroke();
    }
    // A ward: a dome of light over it.
    if (tw.ward > 0) {
      ctx.strokeStyle = hexA(sc, 0.5);
      ctx.fillStyle = hexA(sc, 0.08);
      ctx.lineWidth = Math.max(1, 1.2 * Z);
      ctx.beginPath();
      ctx.ellipse(SX(x), SY(y), 34 * Z, (full + 24) * Z, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Hurt: smoke.
    if (tw.level > 0 && tw.hp < tw.hpMax * 0.6) for (let k = 0; k < 4; k++) {
      const a = (t * 0.5 + k / 4) % 1;
      ctx.fillStyle = `rgba(60,60,60,${(0.4 * (1 - a)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(SX(x + 4 + a * 10), SY(y - hgt * 0.7 - a * 30), (3 + a * 6) * Z, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function stump(s: Site) {
    shadow(s.x + 4, s.y, 18, 5, 0.3);
    for (let k = 0; k < 6; k++) rect(s.x - 14 + hash(s.id, k) * 26, s.y - 3 - hash(s.id, k, 2) * 8, 5, 4, '#78716c');
    rect(s.x - 6, s.y - 14, 5, 12, '#a8a29e');
    rect(s.x + 1, s.y - 9, 5, 7, '#a8a29e');
  }

  // ---- people and creatures -----------------------------------------------------------------------
  function mage(u: Unit, t: number) {
    const o = u.order >= 0 ? world.orders[u.order] : null;
    const robe = o ? o.robe : '#e7e5e4';
    const sc = u.school ? SPELL_COLOR[u.school] : '#fde68a';
    const big = (u.kind === 'archmage' ? 1.45 : u.kind === 'apprentice' ? 0.85 : 1) * 1.45;
    const lift = u.flying ? 14 + Math.sin(t * 2 + u.id) * 2 : 0;
    const x = u.x;
    const y = u.y - lift;
    const walking = u.path.length > 0;
    const bob = walking ? Math.abs(Math.sin(u.anim * 1.5)) * 1.2 : 0;
    const casting = world.t - u.casting < 0.6;
    const f = u.facing;
    const s = big;
    shadow(u.x, u.y, 5 * s, 2 * s, u.flying ? 0.18 : 0.3);
    if (u.flying) {
      // A cloud-disc under them.
      ctx.fillStyle = hexA(mixHex(sc, '#ffffff', 0.5), 0.75);
      ctx.beginPath();
      ctx.ellipse(SX(x), SY(y + 1), 7 * s * Z, 2.5 * s * Z, 0, 0, Math.PI * 2);
      ctx.fill();
      lit(x, y + 1, 10 * s, sc, 0.3);
    }
    if (!u.alive) {
      ctx.globalAlpha = Math.max(0, 1 - (world.t - u.deadAt) / 6);
      poly([x - 6 * s, y, x + 6 * s, y, x + 5 * s, y - 3 * s, x - 5 * s, y - 3 * s], robe);
      ctx.globalAlpha = 1;
      return;
    }
    // Robe, trimmed in the school's colour.
    const top = y - 11 * s - bob;
    poly([x - 4.5 * s, y, x - 2 * s, top + 3 * s, x + 2 * s, top + 3 * s, x + 4.5 * s, y], robe);
    poly([x - 4.5 * s, y, x - 2 * s, top + 3 * s, x - 0.5 * s, top + 3 * s, x - 2 * s, y], mixHex(robe, '#ffffff', 0.2));
    rect(x - 4.5 * s, y - 1.2 * s, 9 * s, 1.2 * s, sc);
    // Head and hat.
    rect(x - 1.6 * s, top, 3.2 * s, 3.2 * s, SKIN[u.seed % SKIN.length]);
    if (u.kind === 'archmage') poly([x - 1.6 * s, top + 2.5 * s, x + 1.6 * s, top + 2.5 * s, x + f * 0.5 * s, top + 7 * s], '#f5f5f4');
    const hat = mixHex(robe, '#000000', 0.25);
    if (o && (o.school === 'nature' || o.school === 'shadow')) poly([x - 2.4 * s, top + 2 * s, x, top - 3 * s, x + 2.4 * s, top + 2 * s], hat);
    else {
      poly([x - 4 * s, top + 0.6 * s, x + 4 * s, top + 0.6 * s, x + 2.4 * s, top - 0.4 * s, x - 2.4 * s, top - 0.4 * s], hat);
      poly([x - 2.2 * s, top - 0.2 * s, x + f * 3 * s, top - 8 * s, x + 2.2 * s, top - 0.2 * s], hat);
    }
    // The staff, its tip lit; raised when casting.
    const sx = x + f * 3.5 * s;
    const sTop = casting ? top - 7 * s : top - 2 * s;
    ctx.strokeStyle = '#78553a';
    ctx.lineWidth = Math.max(1, 0.9 * s * Z);
    ctx.beginPath();
    ctx.moveTo(SX(sx), SY(y));
    ctx.lineTo(SX(sx + (casting ? f * 1.5 : 0)), SY(sTop));
    ctx.stroke();
    rect(sx + (casting ? f * 1.5 : 0) - 1.2 * s, sTop - 1.2 * s, 2.4 * s, 2.4 * s, sc);
    lit(sx, sTop, (casting ? 16 : 6) * s, sc, casting ? 0.75 : 0.35);
    if (casting) {
      // A rune circle at the feet.
      ctx.strokeStyle = hexA(sc, 0.7);
      ctx.lineWidth = Math.max(1, 0.8 * Z);
      ctx.beginPath();
      ctx.ellipse(SX(u.x), SY(u.y), 9 * s * Z, 3.5 * s * Z, t * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (u.kind === 'archmage') lit(x, y - 6 * s, 24, sc, 0.22);
  }
  function creature(u: Unit, t: number) {
    const x = u.x;
    const y = u.y;
    const step = Math.sin(u.anim * 1.4);
    const sc = u.school ? SPELL_COLOR[u.school] : '#e5e7eb';
    ctx.globalAlpha = u.alive ? 1 : Math.max(0, 1 - (world.t - u.deadAt) / 3);
    switch (u.kind) {
      case 'villager':
      case 'pilgrim': {
        shadow(x, y, 3, 1.2);
        const c = u.kind === 'pilgrim' ? '#e7e5e4' : ['#78553a', '#3f6212', '#7c2d12', '#57534e'][u.seed % 4];
        rect(x - 1.6, y - 6 + Math.abs(step) * 0.6, 3.2, 5, c);
        rect(x - 1.1, y - 8.2, 2.2, 2.2, SKIN[u.seed % SKIN.length]);
        if (u.task === 'tribute') rect(x + 1.2, y - 6, 2.4, 2.4, '#a16207');
        break;
      }
      case 'cart':
        shadow(x, y, 9, 2.5);
        rect(x - 7, y - 7, 9, 5, '#7c5a36');
        rect(x - 7, y - 8.5, 9, 1.6, '#d6c3a5');
        rect(x + 3, y - 6, 6, 4, '#78553a');
        rect(x + 7.5, y - 7.5, 2.4, 2.4, '#78553a');
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(SX(x - 5), SY(y - 1.5), 1.6 * Z, 0, Math.PI * 2);
        ctx.arc(SX(x), SY(y - 1.5), 1.6 * Z, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'elemental':
        elemental(u, t, sc);
        break;
      case 'guardian': {
        if (u.name === 'THE PHOENIX') {
          const fy = y - 30 + Math.sin(t * 2) * 4;
          shadow(x, y, 10, 3, 0.2);
          for (const side of [-1, 1]) poly([x, fy, x + side * 22, fy - 10 + Math.sin(t * 6) * 6, x + side * 16, fy + 4], '#fb923c');
          poly([x - 4, fy - 4, x + 6 * u.facing, fy - 2, x - 4, fy + 4, x - 14 * u.facing, fy + 10], '#fde68a');
          lit(x, fy, 50, '#f97316', 0.6);
          break;
        }
        const big = u.name === 'THE COLOSSUS' ? 2.4 : 1.2;
        shadow(x, y, 7 * big, 2.5 * big);
        rect(x - 4 * big, y - 4 * big, 3 * big, 4 * big, '#57534e');
        rect(x + 1 * big, y - 4 * big, 3 * big, 4 * big, '#57534e');
        rect(x - 5 * big, y - 13 * big + step * 0.5, 10 * big, 9 * big, '#78716c');
        rect(x - 5 * big, y - 13 * big + step * 0.5, 3 * big, 9 * big, '#a8a29e');
        rect(x - 2.5 * big, y - 17 * big, 5 * big, 4 * big, '#78716c');
        rect(x - 1 * big, y - 16 * big, 2 * big, 1 * big, u.order >= 0 ? sc : '#38bdf8');
        lit(x, y - 15.5 * big, 6 * big, u.order >= 0 ? sc : '#38bdf8', 0.6);
        break;
      }
      case 'demon':
        shadow(x, y, 4, 1.5);
        rect(x - 2.5, y - 4, 2, 4 - step * 0.5, '#450a0a');
        rect(x + 0.5, y - 4, 2, 4 + step * 0.5, '#450a0a');
        rect(x - 3, y - 10, 6, 6, '#991b1b');
        rect(x - 2, y - 13, 4, 3, '#7f1d1d');
        poly([x - 2, y - 13, x - 3.5, y - 16, x - 1, y - 13], '#fef3c7');
        poly([x + 2, y - 13, x + 3.5, y - 16, x + 1, y - 13], '#fef3c7');
        rect(x - 1.2 * u.facing - 0.4, y - 12, 0.9, 0.9, '#facc15');
        lit(x, y - 8, 12, '#ef4444', 0.4);
        break;
      case 'beast': {
        if (u.name === 'giant') {
          shadow(x, y, 10, 3);
          rect(x - 5, y - 10, 4, 10 + step, '#57534e');
          rect(x + 1, y - 10, 4, 10 - step, '#57534e');
          rect(x - 7, y - 26, 14, 16, '#a8a29e');
          rect(x - 4, y - 32, 8, 6, '#d6d3d1');
          rect(x + 7 * u.facing, y - 24, 2.5, 14, '#6b4a2b');
          break;
        }
        const wolf = u.name === 'wolf';
        shadow(x, y, 5, 1.5);
        const body = wolf ? '#71717a' : '#78553a';
        rect(x - 4, y - 6, 8, 3.5, body);
        rect(x - 3.5, y - 3, 1.2, 3 + step * 0.5, body);
        rect(x + 2.5, y - 3, 1.2, 3 - step * 0.5, body);
        rect(x + 3.5 * u.facing - (u.facing < 0 ? 3 : 0), y - 8, 3, 3, body);
        if (!wolf) rect(x + 4 * u.facing - 1, y - 10, 1, 2.5, '#d6d3d1');
        break;
      }
      default:
        break;
    }
    ctx.globalAlpha = 1;
  }
  function elemental(u: Unit, t: number, sc: string) {
    const x = u.x;
    const y = u.y;
    shadow(x, y, 6, 2);
    switch (u.school) {
      case 'fire':
        for (let k = 0; k < 6; k++) {
          const a = (t * 2 + k / 6) % 1;
          ctx.fillStyle = hexA(a < 0.3 ? '#fef3c7' : a < 0.6 ? '#fb923c' : '#dc2626', 0.9 * (1 - a));
          ctx.beginPath();
          ctx.arc(SX(x + Math.sin(k * 2 + t * 4) * 3), SY(y - 4 - a * 16), (5 - a * 3) * Z, 0, Math.PI * 2);
          ctx.fill();
        }
        lit(x, y - 8, 26, '#f97316', 0.6);
        break;
      case 'frost':
        poly([x - 5, y, x - 3, y - 14, x, y - 18, x + 3, y - 14, x + 5, y], '#bae6fd');
        poly([x - 5, y, x - 3, y - 14, x, y - 18, x, y], '#e0f2fe');
        rect(x - 1.5, y - 13, 1, 1, '#0ea5e9');
        rect(x + 0.5, y - 13, 1, 1, '#0ea5e9');
        lit(x, y - 9, 16, '#7dd3fc', 0.45);
        break;
      case 'storm':
        ctx.strokeStyle = hexA('#c7d2fe', 0.8);
        ctx.lineWidth = Math.max(1, 1.2 * Z);
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(SX(x), SY(y - 6 - k * 4), (7 - k * 1.5) * Z, (2.5 - k * 0.4) * Z, t * (3 + k), 0, Math.PI * 1.6);
          ctx.stroke();
        }
        if (Math.sin(t * 9 + u.id) > 0.8) lit(x, y - 10, 18, '#e0e7ff', 0.7);
        break;
      case 'nature':
        rect(x - 2.5, y - 14, 5, 14, '#5c3d24');
        rect(x - 4, y - 4, 2, 4 + Math.sin(u.anim) , '#5c3d24');
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(SX(x), SY(y - 17), 7 * Z, 0, Math.PI * 2);
        ctx.arc(SX(x - 5), SY(y - 13), 5 * Z, 0, Math.PI * 2);
        ctx.arc(SX(x + 5), SY(y - 13), 5 * Z, 0, Math.PI * 2);
        ctx.fill();
        rect(x - 1.5, y - 10, 1, 1, '#facc15');
        rect(x + 0.5, y - 10, 1, 1, '#facc15');
        break;
      case 'shadow':
        ctx.fillStyle = 'rgba(30,10,50,0.85)';
        ctx.beginPath();
        ctx.ellipse(SX(x), SY(y - 9 + Math.sin(t * 3) * 1.5), 5 * Z, 9 * Z, 0, 0, Math.PI * 2);
        ctx.fill();
        rect(x - 2, y - 12, 1.2, 1.2, '#e9d5ff');
        rect(x + 0.8, y - 12, 1.2, 1.2, '#e9d5ff');
        lit(x, y - 9, 14, '#a855f7', 0.4);
        break;
      case 'light':
        for (const side of [-1, 1]) poly([x, y - 12, x + side * 10, y - 18 + Math.sin(t * 4) * 2, x + side * 7, y - 8], hexA('#fef9c3', 0.8));
        poly([x - 3, y, x, y - 14, x + 3, y], '#fde68a');
        rect(x - 1.5, y - 17, 3, 3, '#fef3c7');
        lit(x, y - 12, 26, '#fde68a', 0.6);
        break;
      default:
        rect(x - 5, y - 13, 10, 10, '#a8a29e');
        rect(x - 5, y - 13, 3, 10, '#d6d3d1');
        rect(x - 3.5, y - 3, 2.5, 3, '#78716c');
        rect(x + 1, y - 3, 2.5, 3, '#78716c');
        rect(x - 2, y - 17, 4, 4, '#a8a29e');
        rect(x - 1, y - 16, 2, 1, sc);
        break;
    }
  }
  const DRAGON = ['#7f1d1d', '#b91c1c'];
  function dragonDraw(u: Unit, t: number) {
    const X = SX(u.x);
    const Y = SY(u.y - 60);
    const k = Z * 1.6;
    const f = u.facing;
    const flap = Math.sin(u.anim);
    // Its shadow on the land.
    shadow(u.x, u.y, 30, 8, 0.25);
    ctx.save();
    for (const back of [1, 0]) {
      const lift = flap * (back ? 0.8 : 1);
      const sx = X + f * k * (back ? 1.5 : -0.5);
      const sy = Y - k;
      const ex = sx - f * k * 3;
      const ey = sy - k * (3 + lift * 5);
      const tips = [[ex - f * k * 4, ey - k * (1 + lift * 2)], [ex - f * k * 6.5, ey + k * (1.5 - lift)], [ex - f * k * 7, ey + k * (4.5 - lift * 2)], [sx - f * k * 6, sy + k * 1.2]];
      ctx.fillStyle = back ? '#450a0a' : DRAGON[0];
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      let px = ex;
      let py = ey;
      for (const [tx, ty] of tips) {
        ctx.quadraticCurveTo((px + tx) / 2 + f * k * 0.6, (py + ty) / 2 + k * 0.6, tx, ty);
        px = tx;
        py = ty;
      }
      ctx.quadraticCurveTo((px + sx) / 2, (py + sy) / 2 + k, sx, sy);
      ctx.fill();
    }
    ctx.fillStyle = DRAGON[1];
    ctx.beginPath();
    ctx.ellipse(X, Y, k * 5, k * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = DRAGON[1];
    ctx.lineCap = 'round';
    ctx.lineWidth = k * 1.2;
    ctx.beginPath();
    ctx.moveTo(X - f * k * 4, Y);
    ctx.quadraticCurveTo(X - f * k * 10, Y + k * (2 + Math.sin(t * 2) * 2), X - f * k * 15, Y - k * (1 + Math.sin(t * 2 + 1)));
    ctx.stroke();
    ctx.lineWidth = k * 1.3;
    ctx.beginPath();
    ctx.moveTo(X + f * k * 4, Y - k * 0.5);
    ctx.quadraticCurveTo(X + f * k * 7, Y - k * 4, X + f * k * 9, Y - k * 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(X + f * k * 10, Y - k * 2.3, k * 1.8, k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(X + f * k * 10.4, Y - k * 2.8, k * 0.5, k * 0.4);
    ctx.restore();
  }

  // ---- spells, storms, rifts, the comet ------------------------------------------------------------
  function spellDraw(sp: Spell, t: number) {
    const k = Math.min(1, (t - sp.t0) / sp.dur);
    const x = sp.x0 + (sp.x1 - sp.x0) * k;
    const y = sp.y0 + (sp.y1 - sp.y0) * k;
    const c = sp.color;
    switch (sp.kind) {
      case 'fireball':
      case 'orb': {
        const arc = sp.kind === 'fireball' ? Math.sin(k * Math.PI) * Math.min(60, Math.hypot(sp.x1 - sp.x0, sp.y1 - sp.y0) * 0.25) : Math.sin(k * 12) * 4;
        for (let j = 5; j >= 0; j--) {
          const kk = Math.max(0, k - j * 0.04);
          const tx = sp.x0 + (sp.x1 - sp.x0) * kk;
          const ty = sp.y0 + (sp.y1 - sp.y0) * kk - (sp.kind === 'fireball' ? Math.sin(kk * Math.PI) * Math.min(60, Math.hypot(sp.x1 - sp.x0, sp.y1 - sp.y0) * 0.25) : Math.sin(kk * 12) * 4);
          ctx.fillStyle = hexA(j === 0 ? mixHex(c, '#ffffff', 0.5) : c, 0.9 - j * 0.14);
          ctx.beginPath();
          ctx.arc(SX(tx), SY(ty), (3.2 - j * 0.4) * Z, 0, Math.PI * 2);
          ctx.fill();
        }
        lit(x, y - arc, 16, c, 0.7);
        break;
      }
      case 'lance':
      case 'bolt': {
        const dx = sp.x1 - sp.x0;
        const dy = sp.y1 - sp.y0;
        const d = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = hexA(mixHex(c, '#ffffff', 0.5), 0.95);
        ctx.lineWidth = Math.max(1, 1.6 * Z);
        ctx.beginPath();
        ctx.moveTo(SX(x - (dx / d) * 10), SY(y - (dy / d) * 10));
        ctx.lineTo(SX(x), SY(y));
        ctx.stroke();
        lit(x, y, 10, c, 0.6);
        break;
      }
      case 'lightning': {
        const a = 1 - k;
        ctx.strokeStyle = hexA('#eef2ff', 0.95 * a);
        ctx.lineWidth = Math.max(1, 2 * Z);
        ctx.beginPath();
        const n = 9;
        for (let j = 0; j <= n; j++) {
          const u = j / n;
          const jx = sp.x0 + (sp.x1 - sp.x0) * u + (j && j < n ? (hash(sp.seed, j) - 0.5) * 22 : 0);
          const jy = sp.y0 + (sp.y1 - sp.y0) * u;
          (j ? ctx.lineTo : ctx.moveTo).call(ctx, SX(jx), SY(jy));
        }
        ctx.stroke();
        lit(sp.x1, sp.y1, 40, '#c7d2fe', 0.8 * a);
        if (sp.y0 < sp.y1 - 200) glows.push([W / 2, H / 2, Math.max(W, H), '#c7d2fe', 0.06 * a]);
        break;
      }
      case 'beam': {
        const a = 1 - k;
        ctx.strokeStyle = hexA(c, 0.9 * a);
        ctx.lineWidth = Math.max(1, 3 * Z * a + 1);
        ctx.beginPath();
        ctx.moveTo(SX(sp.x0), SY(sp.y0));
        ctx.lineTo(SX(sp.x1), SY(sp.y1));
        ctx.stroke();
        lit(sp.x1, sp.y1, 22, c, 0.7 * a);
        break;
      }
      case 'vine': {
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = Math.max(1, 1.6 * Z);
        ctx.beginPath();
        ctx.moveTo(SX(sp.x0), SY(sp.y0 + 10));
        for (let j = 1; j <= 8; j++) {
          const u = (j / 8) * k;
          ctx.lineTo(SX(sp.x0 + (sp.x1 - sp.x0) * u + Math.sin(j * 1.7) * 3), SY(sp.y0 + 10 + (sp.y1 + 6 - sp.y0 - 10) * u));
        }
        ctx.stroke();
        rect(x - 1.5, y + 4, 3, 2, '#86efac');
        break;
      }
      case 'spike':
        for (let j = 0; j < 4; j++) {
          const h = Math.sin(k * Math.PI) * (8 + j * 2);
          const sx = sp.x1 + (j - 1.5) * 4;
          poly([sx - 2, sp.y1 + 6, sx, sp.y1 + 6 - h, sx + 2, sp.y1 + 6], '#a8a29e');
        }
        break;
      case 'breath':
        for (let j = 0; j < 12; j++) {
          const u = (k + j / 12) % 1;
          const bx = sp.x0 + (sp.x1 - sp.x0) * u + Math.sin(j * 5 + t * 9) * 6 * u;
          const by = sp.y0 - 60 + (sp.y1 - sp.y0 + 60) * u;
          ctx.fillStyle = hexA(u < 0.3 ? '#fef3c7' : u < 0.7 ? '#fb923c' : '#dc2626', 0.85 * (1 - u * 0.5));
          ctx.beginPath();
          ctx.arc(SX(bx), SY(by), (2 + u * 7) * Z, 0, Math.PI * 2);
          ctx.fill();
        }
        lit(sp.x1, sp.y1, 40, '#f97316', 0.6);
        break;
      case 'meteor': {
        ctx.strokeStyle = hexA('#fef3c7', 0.9);
        ctx.lineWidth = Math.max(1, 2.5 * Z);
        ctx.beginPath();
        ctx.moveTo(SX(x - (sp.x1 - sp.x0) * 0.15), SY(y - (sp.y1 - sp.y0) * 0.15));
        ctx.lineTo(SX(x), SY(y));
        ctx.stroke();
        lit(x, y, 26, '#fde68a', 0.8);
        break;
      }
      default:
        break;
    }
  }
  function weather(t: number) {
    for (const st of world.storms) {
      if (!visible(st.x, st.y, st.r + 100)) continue;
      // Rain under it, then the cloud.
      ctx.strokeStyle = 'rgba(180,200,230,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 60; k++) {
        const rx = st.x + (hash(k, 1) - 0.5) * st.r * 1.8;
        const ry = st.y + (((hash(k, 2) + t * 1.4) % 1) - 0.5) * st.r;
        ctx.moveTo(SX(rx), SY(ry - 60));
        ctx.lineTo(SX(rx - 3), SY(ry - 48));
      }
      ctx.stroke();
      // Its shadow on the ground, then the cloud: soft billows, lit on top.
      glow(SX(st.x), SY(st.y), st.r * 1.2 * Z, '#00000a', 0.35);
      for (let k = 0; k < 14; k++) {
        const cx = st.x + (hash(k, 7) - 0.5) * st.r * 1.7 + Math.sin(t * 0.3 + k) * 8;
        const cy = st.y - 130 + (hash(k, 8) - 0.5) * st.r * 0.45;
        const rr = (50 + hash(k, 3) * 50) * Z;
        glow(SX(cx), SY(cy), rr, '#262a38', 0.75);
        glow(SX(cx - 10), SY(cy - 14), rr * 0.6, '#6b7390', 0.25);
      }
    }
    for (const rf of world.rifts) {
      if (rf.closed >= 0 && world.t - rf.closed > 3) continue;
      if (!visible(rf.x, rf.y, 160)) continue;
      const a = rf.closed >= 0 ? 1 - (world.t - rf.closed) / 3 : 1;
      const rr = rf.r * a;
      ctx.fillStyle = hexA('#0b0014', 0.92 * a);
      ctx.beginPath();
      ctx.ellipse(SX(rf.x), SY(rf.y - rr * 0.8), rr * 0.55 * Z, rr * 1.1 * Z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexA('#f0abfc', 0.8 * a);
      ctx.lineWidth = Math.max(1, 1.5 * Z);
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(SX(rf.x), SY(rf.y - rr * 0.8), (rr * 0.55 + k * 4) * Z, (rr * 1.1 + k * 6) * Z, Math.sin(t + k) * 0.2, t * (1 + k * 0.3), t * (1 + k * 0.3) + Math.PI * 1.3);
        ctx.stroke();
      }
      lit(rf.x, rf.y - rr * 0.8, rr * 3, '#c026d3', 0.6 * a);
      // The mages' binding: beams into it.
      for (const u of world.units) if (u.alive && u.task === 'close' && world.t - u.casting < 0.6) {
        ctx.strokeStyle = hexA(u.school ? SPELL_COLOR[u.school] : '#fde68a', 0.6);
        ctx.lineWidth = Math.max(1, 1.2 * Z);
        ctx.beginPath();
        ctx.moveTo(SX(u.x), SY(u.y - 14));
        ctx.lineTo(SX(rf.x), SY(rf.y - rr * 0.8));
        ctx.stroke();
      }
    }
    const c = world.comet;
    if (c && !c.landed) {
      ctx.strokeStyle = 'rgba(254,243,199,0.9)';
      ctx.lineWidth = Math.max(1.5, 3 * Z);
      ctx.beginPath();
      ctx.moveTo(SX(c.x - 160), SY(c.y - 125));
      ctx.lineTo(SX(c.x), SY(c.y));
      ctx.stroke();
      lit(c.x, c.y, 50, '#fde68a', 0.9);
    } else if (c && c.landed) lit(c.tx, c.ty, 30, '#fde68a', 0.4 + 0.2 * Math.sin(t * 3));
    // The great rituals: a pillar of light while they work.
    for (const rt of world.rituals) {
      if (rt.done) continue;
      const s = world.sites[rt.site];
      const o = world.orders[rt.order];
      const k = Math.min(1, (world.t - rt.t0) / rt.dur);
      const X = SX(s.x);
      const g = ctx.createLinearGradient(0, 0, 0, SY(s.y));
      g.addColorStop(0, hexA(o.trim, 0));
      g.addColorStop(1, hexA(o.trim, 0.5 * k));
      ctx.fillStyle = g;
      ctx.fillRect(X - (6 + k * 10) * Z, 0, (12 + k * 20) * Z, SY(s.y));
      lit(s.x, s.y - 40, 60 + k * 80, o.trim, 0.5 * k);
    }
  }
  function marks(t: number) {
    for (const m of world.marks) {
      if (!visible(m.x, m.y, m.r + 20)) continue;
      const a = Math.max(0, 1 - (t - m.t0) / m.dur);
      // Soft: the same cached gradient as the lights, drawn plainly.
      const col = m.kind === 'scorch' || m.kind === 'ash' ? '#1e1410' : m.kind === 'frost' ? '#e2eefa' : m.kind === 'bloom' ? '#6ebe5a' : m.kind === 'blight' ? '#3c1450' : '#3c3028';
      glow(SX(m.x), SY(m.y), m.r * 1.3 * Z, col, (m.kind === 'bloom' || m.kind === 'blight' ? 0.35 : 0.6) * a);
      if (m.kind === 'scorch' && a > 0.6) lit(m.x, m.y, m.r, '#f97316', 0.3 * (a - 0.6) * 2.5);
      if (m.kind === 'bloom' && a > 0.3) for (let k = 0; k < 5; k++) rect(m.x + (hash(m.seed, k) - 0.5) * m.r * 1.4, m.y + (hash(m.seed, k, 2) - 0.5) * m.r * 0.7, 1.6, 1.6, ['#f9a8d4', '#fde68a', '#ffffff'][k % 3]);
    }
  }
  function effects(t: number) {
    for (const e of world.fx) {
      const k = (t - e.t0) / e.dur;
      if (k < 0 || k > 1 || !visible(e.x, e.y, e.r + 40)) continue;
      const X = SX(e.x);
      const Y = SY(e.y);
      switch (e.kind) {
        case 'flash':
          glows.push([X, Y, e.r * 3 * Z * (0.5 + k), e.color, 0.9 * (1 - k)]);
          break;
        case 'burst':
          ctx.strokeStyle = hexA(e.color, 0.8 * (1 - k));
          ctx.lineWidth = Math.max(1, 2 * Z * (1 - k));
          ctx.beginPath();
          ctx.ellipse(X, Y, e.r * k * Z, e.r * k * 0.6 * Z, 0, 0, Math.PI * 2);
          ctx.stroke();
          glows.push([X, Y, e.r * 1.5 * Z, e.color, 0.8 * (1 - k)]);
          break;
        case 'ring':
          ctx.strokeStyle = hexA(e.color, 0.7 * (1 - k));
          ctx.lineWidth = Math.max(1, 1.2 * Z);
          ctx.beginPath();
          ctx.ellipse(X, Y, e.r * (0.3 + k) * Z, e.r * (0.3 + k) * 0.5 * Z, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'spark':
        case 'build':
          ctx.fillStyle = hexA(e.color, 1 - k);
          ctx.fillRect(X + (hash(e.seed, 1) - 0.5) * 6 * Z, Y - k * 16 * Z, Math.max(1, 1.4 * Z), Math.max(1, 1.4 * Z));
          if (e.kind === 'spark') glows.push([X, Y - k * 16 * Z, 5 * Z, e.color, 0.5 * (1 - k)]);
          break;
        case 'smoke':
          ctx.fillStyle = `rgba(120,120,120,${(0.35 * (1 - k)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(X, Y - k * 20 * Z, e.r * (0.5 + k) * Z, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'rubble':
          ctx.fillStyle = '#78716c';
          ctx.fillRect(X, Y + k * k * 40 * Z, 3 * Z, 3 * Z);
          break;
        case 'rune':
          ctx.strokeStyle = hexA(e.color, 0.7 * (1 - k));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(X, Y - k * 10 * Z, e.r * Z, 0, Math.PI * 2);
          ctx.moveTo(X - e.r * Z, Y - k * 10 * Z);
          ctx.lineTo(X + e.r * Z, Y - k * 10 * Z);
          ctx.stroke();
          break;
        case 'glint':
          ctx.strokeStyle = hexA(e.color, 1 - k);
          ctx.lineWidth = Math.max(1, Z);
          ctx.beginPath();
          ctx.moveTo(X - e.r * Z * (1 - k), Y);
          ctx.lineTo(X + e.r * Z * (1 - k), Y);
          ctx.moveTo(X, Y - e.r * Z * (1 - k));
          ctx.lineTo(X, Y + e.r * Z * (1 - k));
          ctx.stroke();
          glows.push([X, Y, e.r * 2 * Z, e.color, 0.7 * (1 - k)]);
          break;
        case 'teleport':
          ctx.fillStyle = hexA(e.color, 0.5 * (1 - k));
          ctx.fillRect(X - 3 * Z, Y - 60 * Z, 6 * Z, 60 * Z);
          ctx.strokeStyle = hexA(e.color, 0.8 * (1 - k));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(X, Y, e.r * (0.4 + k) * Z, e.r * (0.4 + k) * 0.4 * Z, 0, 0, Math.PI * 2);
          ctx.stroke();
          glows.push([X, Y - 20 * Z, e.r * 2 * Z, e.color, 0.6 * (1 - k)]);
          break;
        default:
          break;
      }
    }
  }

  // ---- the scene, back to front ------------------------------------------------------------------------
  type Drawable = { y: number; draw: () => void };
  /** Draw something larger about its foot. */
  function scaled(x: number, y: number, k: number, fn: () => void) {
    const X = SX(x);
    const Y = SY(y);
    ctx.save();
    ctx.translate(X, Y);
    ctx.scale(k, k);
    ctx.translate(-X, -Y);
    fn();
    ctx.restore();
  }
  function scene(t: number, night: number) {
    const items: Drawable[] = [];
    for (const s of world.sites) {
      if (!visible(s.x, s.y, 140)) continue;
      if (s.kind === 'village') {
        const burnt = s.burnt >= 0 && world.t - s.burnt < 90;
        for (const [cx, cy, v] of s.cottages) items.push({ y: cy, draw: () => cottage(cx, cy, v, burnt, t, night) });
        // The village well and its fire.
        items.push({ y: s.y, draw: () => {
          rect(s.x - 3, s.y - 3, 6, 3, '#78716c');
          if (night > 0.3) lit(s.x, s.y - 2, 16, '#f59e0b', 0.4 * night);
        } });
      }
      if (s.kind === 'well' && !s.tower && world.towers.some((tw) => tw.site === s.id && tw.fell >= 0)) items.push({ y: s.y, draw: () => stump(s) });
    }
    for (const tw of world.towers) if (tw.fell < 0 && visible(world.sites[tw.site].x, world.sites[tw.site].y, 160)) items.push({ y: world.sites[tw.site].y, draw: () => towerDraw(tw, t, night) });
    for (const u of world.units) {
      if (u.kind === 'dragon' || !visible(u.x, u.y, 40)) continue;
      const isMage = u.kind === 'archmage' || u.kind === 'mage' || u.kind === 'apprentice';
      items.push({ y: u.y, draw: () => (isMage ? mage(u, t) : scaled(u.x, u.y, 1.4, () => creature(u, t))) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();
  }

  // ---- night, text --------------------------------------------------------------------------------------
  function nightfall(t: number, night: number) {
    if (night > 0.01) {
      ctx.fillStyle = `rgba(8,10,30,${(0.55 * night).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Moons: two, wandering toward each other over the cycle.
    const m = world.moons;
    for (const [k, col] of [[0, '#e2e8f0'], [1, '#c4b5fd']] as [number, string][]) {
      const a = (k ? -1 : 1) * (1 - m) * 0.5;
      const mx = W * (0.5 + a * 0.8);
      const my = 70 + Math.abs(a) * 40;
      if (night > 0.2) {
        glow(mx, my, 50, col, 0.25 * night);
        ctx.fillStyle = hexA(col, 0.85 * night);
        ctx.beginPath();
        ctx.arc(mx, my, 7 + k * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const boost = 0.35 + night * 0.45;
    for (const [x, y, rr, col, a] of glows) glow(x, y, rr, col, a * boost);
    ctx.restore();
    glows = [];
    if (world.converging) {
      ctx.fillStyle = `rgba(160,120,255,${(0.05 + 0.03 * Math.sin(t)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
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
      let y = Math.max(110, Math.min(H - 76, SY(l.y) - 18));
      for (let tries = 0; tries < 6 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18); tries++) y -= 19;
      placed.push([x, y, w]);
      ctx.fillStyle = `rgba(6,5,12,${(0.6 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 16);
      const [cr, cg, cb] = mixRgb(l.color, '#f5ecd7', 0.45);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(0.95 * a).toFixed(3)})`;
      fillCrisp(ctx, typed(l.text, age, 40, t), x, y);
    }
    ctx.restore();
  }
  const SCHOOL_NAME: Record<School, string> = { fire: 'FIRE', frost: 'FROST', storm: 'STORM', nature: 'THE GREEN', shadow: 'SHADOW', light: 'LIGHT', stone: 'STONE' };
  function hud(t: number, level: number) {
    if (!o.hud) return;
    ctx.save();
    const live = world.orders.filter((x) => x.alive);
    const top = 62 + live.length * 14;
    let g = ctx.createLinearGradient(0, 0, 0, top + 24);
    g.addColorStop(0, `rgba(6,5,12,${(0.62 * level).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(6,5,12,${(0.4 * level).toFixed(3)})`);
    g.addColorStop(1, 'rgba(6,5,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, top + 24);
    g = ctx.createLinearGradient(0, H - 72, 0, H);
    g.addColorStop(0, 'rgba(6,5,12,0)');
    g.addColorStop(1, `rgba(6,5,12,${(0.55 * level).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 72, W, 72);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = serif(13);
    ctx.fillStyle = hexA('#ece4d4', 0.9 * level);
    fillCrisp(ctx, `${LAND_NAMES[world.land]} · THE LINES OF ${world.name.toUpperCase()}${world.converging ? ' · THE MOONS CONVERGE' : ''}`, 16, 26);
    ctx.font = serif(11);
    live.forEach((ord: Order, k) => {
      const y = 42 + k * 14;
      ctx.fillStyle = hexA(ord.robe, 0.95 * level);
      ctx.fillRect(16, y - 8, 7, 8);
      ctx.fillStyle = hexA(ord.trim, 0.95 * level);
      ctx.fillRect(16, y - 2, 7, 2);
      const n = world.towers.filter((x) => x.order === ord.id && x.fell < 0 && x.level > 0).length;
      const mages = world.units.filter((u) => u.alive && u.order === ord.id && (u.kind === 'archmage' || u.kind === 'mage' || u.kind === 'apprentice')).length;
      ctx.fillStyle = hexA(ord.war >= 0 ? '#fca5a5' : '#b8b2a8', 0.9 * level);
      const war = ord.war >= 0 && world.orders[ord.war]?.alive ? ` · AT WAR WITH ${world.orders[ord.war].name}` : '';
      fillCrisp(ctx, `${ord.name} · ${SCHOOL_NAME[ord.school]} · ${ord.archmage} · ${n} TOWERS · ${mages} MAGES${war}`, 28, y);
    });
    ctx.font = serif(11, true);
    ctx.fillStyle = hexA('#b8b2a8', 0.7 * level);
    fillCrisp(ctx, `This realm holds ${world.cast.slice(0, 7).join(', ')}.`, 16, 48 + live.length * 14);
    ctx.textAlign = 'right';
    ctx.font = serif(11);
    ctx.fillStyle = hexA('#fde68a', 0.75 * level);
    world.orders.flatMap((x) => x.artifacts.map((a) => `${a}, HELD BY ${x.name}`)).slice(-3).forEach((a, k) => fillCrisp(ctx, a, W - 16, 26 + k * 15));
    ctx.textAlign = 'left';
    ctx.font = serif(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#ece4d4', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, typed(l.text, age, 50, t), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
    ctx.restore();
  }
  /** A soft shade under the page's quiet zones, so its text stays legible. */
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
        img.data[o4] = 6;
        img.data[o4 + 1] = 5;
        img.data[o4 + 2] = 12;
        img.data[o4 + 3] = Math.round(180 * k);
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
    if (!tiles) paintGround();
    patch();
    ctx.fillStyle = `rgb(${SEA.join(',')})`;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    for (const tl of tiles ?? []) {
      const X = SX(tl.x / TS);
      const Y = SY(tl.y / TS);
      const w = (tl.w / TS) * cam.zoom;
      const h = (tl.h / TS) * cam.zoom;
      if (X > W || Y > H || X + w < 0 || Y + h < 0) continue;
      // A hair of overlap, so no seams show between tiles.
      ctx.drawImage(tl.c, X, Y, w + 0.6, h + 0.6);
    }
    marks(t);
    lines();
    circles(t);
    scene(t, night);
    for (const u of world.units) if (u.kind === 'dragon' && u.alive) dragonDraw(u, t);
    for (const sp of world.spells) spellDraw(sp, t);
    effects(t);
    weather(t);
    nightfall(t, night);
    quietShade(t);
    labels(t, level);
    hud(t, level);
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [SX(x), SY(y)],
    after: (dt) => camera(dt),
    paint: (t) => paint(t),
    ambience: () => (world.rifts.some((x) => x.closed < 0) || world.units.some((u) => u.kind === 'dragon' && u.alive) || world.orders.some((x) => x.alive && x.war >= 0) ? 0.9 : 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      tiles = null;
      gg = null;
    },
  });
}
