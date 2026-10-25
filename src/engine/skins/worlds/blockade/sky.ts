/**
 * Blockade's sky and lights: the starfield and the galaxy behind it (baked once), cached glow
 * sprites, the star with its glare, the moons lit per sample, the rings, and the aurora's curtain.
 */
import { hash } from '../../instruments/kit';
import { css, rgbOf, type RGB } from './ships';
import type { BlockWorld, Moon, V3 } from './types';

const smooth01 = (v: number) => {
  const k = Math.max(0, Math.min(1, v));
  return k * k * (3 - 2 * k);
};

export const mkCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

/** Soft round sprites by colour: `glow` (bright core) and `soft` (a puff). */
export function createGlows() {
  const glowC = new Map<string, HTMLCanvasElement>();
  const softC = new Map<string, HTMLCanvasElement>();
  const make = (color: string, stops: [number, number][]) => {
    const c = mkCanvas(64, 64);
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    const rgb = rgbOf(color);
    for (const [s, a] of stops) gr.addColorStop(s, css(rgb, a));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return c;
  };
  return {
    glow(color: string) {
      let c = glowC.get(color);
      if (!c) {
        c = make(color, [[0, 1], [0.12, 0.75], [0.35, 0.22], [1, 0]]);
        glowC.set(color, c);
      }
      return c;
    },
    soft(color: string) {
      let c = softC.get(color);
      if (!c) {
        c = make(color, [[0, 0.85], [0.5, 0.4], [1, 0]]);
        if (softC.size > 120) softC.clear();
        softC.set(color, c);
      }
      return c;
    },
  };
}
export type Glows = ReturnType<typeof createGlows>;

/** The deep sky: a galaxy's band of dust and light, nebulae, and the stars. Painted once, at world size. */
export function bakeSky(world: BlockWorld, seed: number, kind: 'band' | 'nebula' | 'core' | 'sparse', tint: string, tint2: string): HTMLCanvasElement {
  const { GW, GH } = world;
  const c = mkCanvas(GW, GH);
  const g = c.getContext('2d')!;
  g.fillStyle = '#020309';
  g.fillRect(0, 0, GW, GH);
  // The band and the clouds, at a quarter of the resolution, smoothed up.
  const q = 4;
  const w = Math.ceil(GW / q);
  const h = Math.ceil(GH / q);
  const low = mkCanvas(w, h);
  const lg = low.getContext('2d')!;
  const img = lg.createImageData(w, h);
  const A = rgbOf(tint);
  const B = rgbOf(tint2);
  const ang = (hash(seed, 1) - 0.5) * 1.2;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const off = (hash(seed, 2) - 0.5) * 0.4;
  const vn = (x: number, y: number, s: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, s);
    const b = hash(xi + 1, yi, s);
    const cc = hash(xi, yi + 1, s);
    const d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (cc - a) * fy + (a - b - cc + d) * fx * fy;
  };
  const fbm = (x: number, y: number, s: number, o = 5) => {
    let v = 0;
    let amp = 0.5;
    let n = 0;
    for (let i = 0; i < o; i++) {
      v += vn(x, y, s + i * 13) * amp;
      n += amp;
      amp *= 0.5;
      x *= 2.03;
      y *= 2.03;
    }
    return v / n;
  };
  const strength = kind === 'sparse' ? 0.35 : kind === 'core' ? 1.25 : 1;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = i / w - 0.5;
      const y = (j / h - 0.5) * (GH / GW);
      const across = -x * sa + y * ca - off;
      const along = x * ca + y * sa;
      const n1 = fbm(i / 22, j / 22, seed);
      const n2 = fbm(i / 9 + 40, j / 9, seed + 7);
      let band = 0;
      if (kind === 'band' || kind === 'core' || kind === 'sparse') band = Math.exp(-((across / (0.07 + n1 * 0.05)) ** 2)) * (0.45 + 0.7 * n2 * n2);
      if (kind === 'core') band += Math.exp(-((along - 0.15) ** 2 / 0.03 + across ** 2 / 0.008)) * 1.3;
      let neb = 0;
      if (kind === 'nebula') {
        // Wisps: ridges of a warped field, brightest along their spines.
        const wv = fbm(i / 40 + n1 * 2.5, j / 40 + n2 * 2.5, seed + 3);
        const ridge = Math.pow(1 - Math.abs(wv * 2 - 1), 4);
        neb = ridge * 0.9 * (0.4 + n2) + Math.pow(Math.max(0, n1 - 0.55) * 2.2, 2) * 0.5;
      }
      // Dark lanes of dust across the band.
      const dust = Math.max(0, fbm(i / 9, j / 9, seed + 9, 4) - 0.52) * 1.6 * smooth01(band * 2.5);
      const v = Math.max(0, (band + neb) * strength * (1 - dust * 0.85));
      const k = Math.min(1, n1 * 1.4);
      const o = (j * w + i) * 4;
      img.data[o] = Math.min(255, (A[0] * (1 - k) + B[0] * k) * v * 46 + 2);
      img.data[o + 1] = Math.min(255, (A[1] * (1 - k) + B[1] * k) * v * 46 + 3);
      img.data[o + 2] = Math.min(255, (A[2] * (1 - k) + B[2] * k) * v * 52 + 7);
      img.data[o + 3] = 255;
    }
  lg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(low, 0, 0, GW, GH);
  // The stars: many faint, some coloured, a few bright with a little cross.
  const n = Math.round((GW * GH) / (kind === 'sparse' ? 900 : 520));
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i, 3) * GW;
    const y = hash(seed, i, 4) * GH;
    const b = Math.pow(hash(seed, i, 5), 3);
    const t = hash(seed, i, 6);
    const col: RGB = t < 0.15 ? [1, 0.8, 0.65] : t < 0.3 ? [0.75, 0.85, 1] : t < 0.35 ? [1, 0.65, 0.55] : [1, 0.97, 0.92];
    g.fillStyle = css(col, 0.25 + b * 0.75);
    const s = b > 0.85 ? 2 : b > 0.4 ? 1.4 : 1;
    g.fillRect(x, y, s, s);
    if (b > 0.93) {
      g.fillStyle = css(col, 0.18);
      g.fillRect(x - 3, y + 0.5, 7, 1);
      g.fillRect(x + 0.5, y - 3, 1, 7);
    }
  }
  return c;
}

/** A moon, lit per sample by the star; kept until the light moves. */
export function createMoonArt() {
  const cache = new Map<string, { c: HTMLCanvasElement; L: V3 }>();
  return (mo: Moon, L: V3, light: number): HTMLCanvasElement => {
    const key = mo.name;
    const hit = cache.get(key);
    if (hit && Math.abs(hit.L[0] - L[0]) + Math.abs(hit.L[1] - L[1]) + Math.abs(hit.L[2] - L[2]) < 0.03) return hit.c;
    const r = Math.max(4, Math.ceil(mo.r));
    const c = hit?.c ?? mkCanvas(r * 2 + 2, r * 2 + 2);
    const g = c.getContext('2d')!;
    const img = g.createImageData(c.width, c.height);
    const base = rgbOf(mo.tint);
    for (let j = 0; j < c.height; j++)
      for (let i = 0; i < c.width; i++) {
        const nx = (i + 0.5 - r - 1) / r;
        const ny = (j + 0.5 - r - 1) / r;
        const rr = nx * nx + ny * ny;
        if (rr > 1) continue;
        const nz = Math.sqrt(1 - rr);
        // Craters and maria, from a few scales of hashed bumps.
        let cr = 0;
        for (let k = 0; k < 3; k++) {
          const s = 3 + k * 4;
          const gx = Math.floor((nx + 1) * s);
          const gy = Math.floor((ny + 1) * s);
          cr += (hash(mo.seed, gx * 31 + gy, k) - 0.5) * (0.3 / (k + 1));
        }
        const mare = hash(mo.seed, Math.floor((nx + 1) * 2.5), Math.floor((ny + 1) * 2.5)) < 0.3 ? -0.12 : 0;
        const d = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) * light;
        const k2 = (0.02 + d * 1.05) * (1 + cr + mare);
        const edge = Math.min(1, (1 - Math.sqrt(rr)) * r * 0.9);
        const o = (j * c.width + i) * 4;
        img.data[o] = Math.min(255, base[0] * k2 * 255);
        img.data[o + 1] = Math.min(255, base[1] * k2 * 255);
        img.data[o + 2] = Math.min(255, base[2] * k2 * 255 + 4);
        img.data[o + 3] = 255 * edge;
      }
    g.putImageData(img, 0, 0);
    cache.set(key, { c, L: [...L] as V3 });
    return c;
  };
}

/** The rings: bands of ice and dust round the planet, an arch across the sky. Baked once (alpha), lit when drawn. */
export function bakeRings(world: BlockWorld, seed: number): HTMLCanvasElement | null {
  const rg = world.rings;
  if (!rg) return null;
  const { GW, GH, planet } = world;
  const q = 2;
  const w = Math.ceil(GW / q);
  const h = Math.ceil(GH / q);
  const c = mkCanvas(w, h);
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  const tint = rgbOf(rg.tint);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5) * q;
      const y = (j + 0.5) * q;
      const dx = x - planet.cx;
      const dy = y - planet.cy;
      const cr = Math.cos(rg.tilt);
      const sr = Math.sin(rg.tilt);
      const e = Math.hypot((dx * cr + dy * sr) / rg.a, (-dx * sr + dy * cr) / rg.b);
      if (e < rg.inner || e > rg.outer) continue;
      const k = (e - rg.inner) / (rg.outer - rg.inner);
      // Ringlets and gaps: broad bands of density, fine ringlets within them.
      const n1 = (q: number, cells: number, s2: number) => {
        const f = q * cells;
        const i0 = Math.floor(f);
        const fr = f - i0;
        const sm = fr * fr * (3 - 2 * fr);
        return hash(seed, i0, s2) * (1 - sm) + hash(seed, i0 + 1, s2) * sm;
      };
      const broad = n1(k, 9, 3);
      const fine = n1(k, 220, 4);
      const gap = Math.abs(k - 0.58) < 0.03 ? 0.05 : Math.abs(k - 0.24) < 0.012 ? 0.35 : 1;
      const edge = Math.min(1, k * 10, (1 - k) * 6);
      const a = (0.15 + 0.6 * broad * broad) * (0.55 + 0.45 * fine) * gap * edge * 0.75;
      const o = (j * w + i) * 4;
      const shade = 0.85 + 0.3 * hash(seed, Math.floor(k * 90), 5);
      img.data[o] = Math.min(255, tint[0] * shade * 255);
      img.data[o + 1] = Math.min(255, tint[1] * shade * 255);
      img.data[o + 2] = Math.min(255, tint[2] * shade * 255);
      img.data[o + 3] = Math.max(0, Math.min(255, a * 255));
    }
  g.putImageData(img, 0, 0);
  return c;
}

/** One strip of aurora: a curtain, bright at its foot, fading up. */
export function bakeCurtain(green: string, top: string): HTMLCanvasElement {
  const c = mkCanvas(8, 96);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 96, 0, 0);
  gr.addColorStop(0, css(rgbOf(green), 0));
  gr.addColorStop(0.08, css(rgbOf(green), 0.9));
  gr.addColorStop(0.35, css(rgbOf(green), 0.45));
  gr.addColorStop(0.7, css(rgbOf(top), 0.25));
  gr.addColorStop(1, css(rgbOf(top), 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 96);
  return c;
}
