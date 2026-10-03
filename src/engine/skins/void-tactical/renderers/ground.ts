/**
 * The ground layer: faint terrain under the whole map, on a plane a little deeper than
 * the main one, so it drifts slower than the structures and gives the map a floor.
 *
 *   dust    wind-combed streaks and drifts (a mining frontier)
 *   nebula  soft clouds with brighter cores (open space)
 *   mist    low, smooth banks of haze (something old and quiet)
 *
 * The pattern is seamless value noise in world coordinates, baked into small tiles once
 * and cached, so a frame costs a handful of drawImage calls. Tiles are low resolution on
 * purpose: the terrain is soft by nature, and smoothing hides the scale.
 */
import { parseHex } from '../../../color';
import type { RenderFrame } from './utils';

const TILE = 360; // world units per tile on the ground plane
const RES = 96; // pixels per tile side when baked
const DEPTH = 0.25; // how far behind the main plane the ground sits

const cache = new Map<string, HTMLCanvasElement>();

/** Integer hash to [0, 1). */
const hash = (x: number, y: number, s: number) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Smooth value noise, continuous everywhere, so tiles meet without seams. */
const value = (x: number, y: number, s: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

const fbm = (x: number, y: number, s: number) => value(x, y, s) * 0.55 + value(x * 2.1, y * 2.1, s + 1) * 0.3 + value(x * 4.3, y * 4.3, s + 2) * 0.15;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function bake(i: number, j: number, kind: string, color: string, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = RES;
  c.height = RES;
  const g = c.getContext('2d')!;
  const img = g.createImageData(RES, RES);
  const rgb = parseHex(color) ?? { r: 148, g: 163, b: 184 };
  for (let py = 0; py < RES; py++) {
    for (let px = 0; px < RES; px++) {
      const wx = (i + px / RES) * TILE;
      const wy = (j + py / RES) * TILE;
      let a = 0;
      if (kind === 'dust') {
        // Drifts, plus streaks combed along the wind (stretched in x).
        const drift = smooth(0.5, 0.8, fbm(wx * 0.004, wy * 0.004, seed));
        const streak = smooth(0.62, 0.9, fbm(wx * 0.0015, wy * 0.03, seed + 7));
        a = drift * 0.09 + streak * 0.06;
      } else if (kind === 'nebula') {
        const n = fbm(wx * 0.0028, wy * 0.0028, seed);
        a = smooth(0.42, 0.85, n) * 0.11 + smooth(0.78, 0.95, n) * 0.08;
      } else {
        a = smooth(0.48, 0.78, fbm(wx * 0.002, wy * 0.0035, seed)) * 0.085;
      }
      const k = (py * RES + px) * 4;
      img.data[k] = rgb.r;
      img.data[k + 1] = rgb.g;
      img.data[k + 2] = rgb.b;
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function renderGround(ctx: CanvasRenderingContext2D, frame: RenderFrame, viewport: { width: number; height: number }): void {
  const kind = frame.pack.look?.ground;
  if (!kind || kind === 'none') return;
  const color = frame.pack.look?.groundColor ?? frame.palette.accent;
  const v = frame.view;
  const s = v.scale(DEPTH);
  const i0 = Math.floor(v.wx(0, DEPTH) / TILE);
  const i1 = Math.floor(v.wx(viewport.width, DEPTH) / TILE);
  const j0 = Math.floor(v.wy(0, DEPTH) / TILE);
  const j1 = Math.floor(v.wy(viewport.height, DEPTH) / TILE);
  if (cache.size > 80) cache.clear();
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const key = `${frame.seed}|${kind}|${color}|${i},${j}`;
      let tile = cache.get(key);
      if (!tile) cache.set(key, (tile = bake(i, j, kind, color, frame.seed % 100000)));
      // A pixel of overlap hides the seams between smoothed tiles.
      ctx.drawImage(tile, v.sx(i * TILE, DEPTH) - 0.5, v.sy(j * TILE, DEPTH) - 0.5, TILE * s + 1, TILE * s + 1);
    }
  }
  ctx.restore();
}
