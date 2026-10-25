/**
 * The worlds' faces: a surface map per body (equirectangular, baked once on the first paint from
 * 3D noise on the sphere, so no seam and no pinched poles), and a sphere renderer that turns a map
 * into a lit ball pixel by pixel: the body's spin, the tilt we see it from, the sun's direction (a
 * terminator, a warm band at dusk), a glint on water, clouds that turn at their own rate, lights on
 * the night side, and what changes through the loop (the sand moving between the twins, the
 * crust falling away to show the dark inside).
 *
 * Nothing here runs at mount: maps are made when the painter first asks for them.
 */
import type { Body, Shard } from './types';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};

// ---- noise on the sphere -------------------------------------------------------------------------
function hash3(x: number, y: number, z: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash3(xi, yi, zi, s);
  const b = hash3(xi + 1, yi, zi, s);
  const c = hash3(xi, yi + 1, zi, s);
  const d = hash3(xi + 1, yi + 1, zi, s);
  const e = hash3(xi, yi, zi + 1, s);
  const f = hash3(xi + 1, yi, zi + 1, s);
  const g = hash3(xi, yi + 1, zi + 1, s);
  const h = hash3(xi + 1, yi + 1, zi + 1, s);
  const x1 = a + (b - a) * ux;
  const x2 = c + (d - c) * ux;
  const x3 = e + (f - e) * ux;
  const x4 = g + (h - g) * ux;
  const y1 = x1 + (x2 - x1) * uy;
  const y2 = x3 + (x4 - x3) * uy;
  return y1 + (y2 - y1) * uz;
}
export function fbm3(x: number, y: number, z: number, s: number, oct = 5, lac = 2.03): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise3(x, y, z, s + i * 17);
    norm += amp;
    amp *= 0.5;
    x *= lac;
    y *= lac;
    z *= lac;
  }
  return sum / norm;
}
const ridged = (x: number, y: number, z: number, s: number, oct = 4) => 1 - Math.abs(fbm3(x, y, z, s, oct) * 2 - 1);

type RGB = [number, number, number];
const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/**
 * A body's surface. `col` is the ground (RGB), `col2` a second ground the loop reveals or buries
 * (the sand), `aux` a per-texel value (height, the shard a texel belongs to, cloud cover), `emis`
 * light of its own (village windows, lava, the lures in the fog), `wet` water for the glint.
 */
export type SurfaceMap = {
  w: number;
  h: number;
  col: Uint8ClampedArray;
  col2?: Uint8ClampedArray;
  aux?: Float32Array;
  cloud?: Uint8ClampedArray;
  emis?: Uint8ClampedArray;
  wet?: Uint8Array;
  /** The air's colour at the limb, and how much of it. */
  atmo: RGB;
  atmoK: number;
};

function makeMap(w: number, h: number, seed: number, fn: (x: number, y: number, z: number, i: number, lat: number, lon: number, m: SurfaceMap) => void, atmo: RGB, atmoK: number, extra: Partial<SurfaceMap> = {}): SurfaceMap {
  const m: SurfaceMap = { w, h, col: new Uint8ClampedArray(w * h * 3), atmo, atmoK, ...extra };
  for (let j = 0; j < h; j++) {
    const lat = Math.PI / 2 - ((j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat);
    const y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * TAU;
      fn(cl * Math.sin(lon), y, cl * Math.cos(lon), j * w + i, lat, lon, m);
    }
  }
  void seed;
  return m;
}
const put = (a: Uint8ClampedArray, i: number, c: RGB) => {
  a[i * 3] = c[0];
  a[i * 3 + 1] = c[1];
  a[i * 3 + 2] = c[2];
};

/** Palettes by variant: woods (green, autumn, blue pine), sand, crust, sea, thorn fog. */
const WOODS: [RGB, RGB][] = [[hexRgb('#2f6b34'), hexRgb('#5d9a45')], [hexRgb('#8a4a22'), hexRgb('#d08a2a')], [hexRgb('#1f5a4c'), hexRgb('#3f8a6a')]];
const SANDS: RGB[] = [hexRgb('#e0a860'), hexRgb('#e8b4a0'), hexRgb('#e6c87e')];
const ROCKS: RGB[] = [hexRgb('#7a3e2c'), hexRgb('#6e4050'), hexRgb('#7a5a34')];
const CRUSTS: RGB[] = [hexRgb('#857a9c'), hexRgb('#748296'), hexRgb('#96806a')];
const SEAS: [RGB, RGB][] = [[hexRgb('#14605e'), hexRgb('#5fb8a2')], [hexRgb('#1d5c38'), hexRgb('#7cc08a')], [hexRgb('#183f7a'), hexRgb('#6aa6d8')]];
const FOGS: [RGB, RGB][] = [[hexRgb('#0c140f'), hexRgb('#5a4630')], [hexRgb('#140f1a'), hexRgb('#58405a')], [hexRgb('#1a100c'), hexRgb('#6a3a26')]];

export function buildMap(b: Body, seed: number, shards: Shard[], village: { lon: number; lat: number } | null): SurfaceMap {
  const s = seed + b.id * 101;
  const v = b.variant;
  switch (b.kind) {
    case 'home': {
      const [forest, meadow] = WOODS[v];
      const ox = b.hue * 3;
      const vx = village ? Math.cos(village.lat) * Math.sin(village.lon) : 0;
      const vy = village ? Math.sin(village.lat) : 0;
      const vz = village ? Math.cos(village.lat) * Math.cos(village.lon) : 1;
      const deep = hexRgb('#123e66');
      const shallow = hexRgb('#2f86b0');
      const beach = hexRgb('#d2bd84');
      const rock = hexRgb('#7d7064');
      const snow = hexRgb('#eef3f4');
      return makeMap(384, 192, s, (x, y, z, i, lat, _lon, m) => {
        let e = fbm3(x * 1.7 + ox, y * 1.7, z * 1.7, s, 6);
        // The village sits on a green rise: always land there.
        const dv = (x - vx) ** 2 + (y - vy) ** 2 + (z - vz) ** 2;
        if (village) e = Math.max(e, 0.56 - dv * 1.4);
        const cloud = smooth(0.56, 0.74, fbm3(x * 3 + 9, y * 5.5, z * 3, s + 7, 5));
        m.cloud![i] = cloud * 230;
        const polar = Math.abs(lat) > 1.22 - fbm3(x * 6, y * 6, z * 6, s + 3, 3) * 0.25;
        let c: RGB;
        if (e < 0.5) {
          c = mixc(deep, shallow, smooth(0.38, 0.5, e));
          m.wet![i] = 1;
        } else if (e < 0.515) c = beach;
        else if (e < 0.66) {
          // Woods, in clumps of trees, with meadows between.
          const tree = vnoise3(x * 90, y * 90, z * 90, s + 5);
          const clump = fbm3(x * 9, y * 9, z * 9, s + 6, 3);
          c = mixc(forest, meadow, smooth(0.5, 0.7, clump) * 0.8);
          c = mixc(c, [c[0] * 0.55, c[1] * 0.6, c[2] * 0.55], smooth(0.45, 0.75, tree) * 0.7);
          c = mixc(c, rock, smooth(0.6, 0.66, e) * 0.6);
        } else if (e < 0.72) c = mixc(rock, [96, 84, 74], vnoise3(x * 40, y * 40, z * 40, s + 2));
        else c = snow;
        if (polar) c = mixc(c, snow, 0.92);
        // The village: roofs, and windows at night.
        if (village && dv < 0.006) {
          const roof = hash3(Math.floor(x * 260), Math.floor(y * 260), Math.floor(z * 260), s) > 0.55;
          if (roof) c = hexRgb(hash3(Math.floor(x * 260), 1, Math.floor(z * 260), s) > 0.5 ? '#b0603a' : '#8a5a3a');
          if (roof) m.emis![i] = 200;
        }
        put(m.col, i, c);
      }, hexRgb('#7fc4ff'), 0.85, { cloud: new Uint8ClampedArray(384 * 192), wet: new Uint8Array(384 * 192), emis: new Uint8ClampedArray(384 * 192) });
    }
    case 'twinA':
    case 'twinB': {
      const sand = SANDS[v];
      const rock = ROCKS[(v + (b.kind === 'twinB' ? 1 : 0)) % 3];
      const giver = b.kind === 'twinA';
      return makeMap(256, 128, s, (x, y, z, i, _lat, lon, m) => {
        const e = fbm3(x * 2.4, y * 2.4, z * 2.4, s, 5);
        const crag = ridged(x * 5, y * 5, z * 5, s + 3, 4);
        m.aux![i] = clamp01((e - 0.3) / 0.45) * 0.85 + crag * 0.15;
        let c = mixc(rock, [rock[0] * 0.5, rock[1] * 0.45, rock[2] * 0.45], smooth(0.6, 0.95, crag));
        c = mixc(c, [rock[0] * 1.25, rock[1] * 1.15, rock[2], ], smooth(0.55, 0.8, e) * 0.5);
        // A tower of the ancients on the giver's equator, deep in a basin: the sand hides it till the end.
        if (giver && Math.abs(y) < 0.05 && Math.abs(Math.sin((lon - 1) * 0.5)) < 0.04) {
          c = hexRgb('#5e6a78');
          m.aux![i] = 0.08;
        }
        // Caves on the taker: dark mouths the sand will fill.
        if (!giver && vnoise3(x * 14, y * 14, z * 14, s + 9) > 0.78) c = mixc(c, [24, 14, 12], 0.8);
        put(m.col, i, c);
        const ripple = 0.88 + 0.12 * Math.sin(lon * 70 + fbm3(x * 4, y * 4, z * 4, s + 4, 3) * 18 + y * 30);
        const dune = 0.92 + 0.16 * fbm3(x * 8, y * 8, z * 8, s + 5, 3);
        put(m.col2!, i, [sand[0] * ripple * dune, sand[1] * ripple * dune, sand[2] * ripple * dune]);
      }, hexRgb('#ffc890'), 0.35, { col2: new Uint8ClampedArray(256 * 128 * 3), aux: new Float32Array(256 * 128) });
    }
    case 'crumble': {
      const crust = CRUSTS[v];
      const pts = shards.map((q) => [Math.cos(q.lat) * Math.sin(q.lon), Math.sin(q.lat), Math.cos(q.lat) * Math.cos(q.lon)]);
      return makeMap(320, 160, s, (x, y, z, i, _lat, _lon, m) => {
        // A little warp, so the cracks wander.
        const wx = x + (fbm3(x * 4, y * 4, z * 4, s, 3) - 0.5) * 0.18;
        const wy = y + (fbm3(x * 4 + 5, y * 4, z * 4, s, 3) - 0.5) * 0.18;
        const wz = z + (fbm3(x * 4, y * 4 + 5, z * 4, s, 3) - 0.5) * 0.18;
        let best = -2;
        let second = -2;
        let id = 0;
        for (let k = 0; k < pts.length; k++) {
          const d = wx * pts[k][0] + wy * pts[k][1] + wz * pts[k][2];
          if (d > best) {
            second = best;
            best = d;
            id = k;
          } else if (d > second) second = d;
        }
        m.aux![i] = id;
        const crack = 1 - smooth(0.004, 0.03, best - second);
        const n = fbm3(x * 6, y * 6, z * 6, s + 2, 5);
        let c = mixc([crust[0] * 0.7, crust[1] * 0.7, crust[2] * 0.75], [crust[0] * 1.3, crust[1] * 1.25, crust[2] * 1.3], n);
        // Frost in the hollows, and pale crystals.
        if (vnoise3(x * 30, y * 30, z * 30, s + 8) > 0.82) c = mixc(c, [220, 210, 240], 0.5);
        // The edge of each shard is lighter (broken stone), the crack itself dark.
        c = mixc(c, [crust[0] * 1.5, crust[1] * 1.45, crust[2] * 1.5], smooth(0.02, 0.06, best - second) < 1 ? 0.25 * (1 - crack) : 0);
        c = mixc(c, [12, 8, 18], crack);
        put(m.col, i, c);
      }, hexRgb('#b8a0e0'), 0.2, { aux: new Float32Array(320 * 160) });
    }
    case 'ocean': {
      const [deep, light] = SEAS[v];
      const eyes = Array.from({ length: 6 }, (_, k) => {
        const lo = hash3(k, 1, 0, s) * TAU;
        const la = (hash3(k, 2, 0, s) - 0.5) * 2.2;
        return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo), 2 + hash3(k, 3, 0, s) * 5] as [number, number, number, number];
      });
      return makeMap(384, 192, s, (x, y, z, i, lat, _lon, m) => {
        let px = x;
        let py = y;
        let pz = z;
        // Cyclones: twist the clouds round each eye (Rodrigues' rotation about the eye's axis).
        for (const [ex, ey, ez, sw] of eyes) {
          const d = 1 - (px * ex + py * ey + pz * ez);
          if (d > 0.4) continue;
          const th = sw * Math.exp(-d * 14);
          const c = Math.cos(th);
          const sn = Math.sin(th);
          const dot = px * ex + py * ey + pz * ez;
          const cx = ey * pz - ez * py;
          const cy = ez * px - ex * pz;
          const cz = ex * py - ey * px;
          const nx = px * c + cx * sn + ex * dot * (1 - c);
          const ny = py * c + cy * sn + ey * dot * (1 - c);
          const nz = pz * c + cz * sn + ez * dot * (1 - c);
          px = nx;
          py = ny;
          pz = nz;
        }
        const band = Math.sin(lat * 9 + fbm3(px * 2, py * 2, pz * 2, s, 4) * 5);
        const sea = fbm3(x * 3, y * 3, z * 3, s + 1, 4);
        let c = mixc(deep, [deep[0] * 0.6, deep[1] * 0.7, deep[2] * 0.8], sea);
        c = mixc(c, light, (band * 0.5 + 0.5) * 0.35);
        put(m.col, i, c);
        m.wet![i] = 1;
        const cl = fbm3(px * 3.2, py * 4.5, pz * 3.2, s + 2, 5);
        m.cloud![i] = clamp01(smooth(0.45, 0.7, cl) * 0.9 + (band > 0.7 ? 0.15 : 0)) * 240;
      }, mixc(light, [220, 255, 250], 0.4), 0.7, { cloud: new Uint8ClampedArray(384 * 192), wet: new Uint8Array(384 * 192) });
    }
    case 'thorn': {
      const [dark, bark] = FOGS[v];
      return makeMap(320, 160, s, (x, y, z, i, _lat, _lon, m) => {
        // Tangles: ridged noise at three scales, each a layer of branches over the last.
        const r1 = ridged(x * 3, y * 3, z * 3, s, 4);
        const r2 = ridged(x * 7 + 3, y * 7, z * 7, s + 1, 3);
        const r3 = ridged(x * 15, y * 15 + 2, z * 15, s + 2, 2);
        let c: RGB = [...dark];
        c = mixc(c, mixc(bark, dark, 0.55), smooth(0.86, 0.96, r3));
        c = mixc(c, mixc(bark, dark, 0.3), smooth(0.88, 0.97, r2));
        c = mixc(c, bark, smooth(0.9, 0.985, r1));
        const fog = fbm3(x * 2, y * 2, z * 2, s + 3, 4);
        c = mixc(c, [120, 140, 125], smooth(0.5, 0.8, fog) * 0.25);
        put(m.col, i, c);
        if (hash3(Math.floor(x * 60), Math.floor(y * 60), Math.floor(z * 60), s + 4) > 0.9965) m.emis![i] = 255;
      }, hexRgb('#c8dcc0'), 0.55, { emis: new Uint8ClampedArray(320 * 160) });
    }
    case 'moon':
    case 'shy':
    case 'cinder':
    default: {
      const craters = Array.from({ length: 14 }, (_, k) => {
        const lo = hash3(k, 5, 1, s) * TAU;
        const la = (hash3(k, 6, 1, s) - 0.5) * 2.6;
        return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo), 0.03 + hash3(k, 7, 1, s) * 0.12] as [number, number, number, number];
      });
      const base: RGB = b.kind === 'cinder' ? hexRgb('#2c1e1a') : b.kind === 'shy' ? hexRgb('#8e88a6') : hexRgb('#8f8a84');
      return makeMap(128, 64, s, (x, y, z, i, _lat, _lon, m) => {
        const n = fbm3(x * 4, y * 4, z * 4, s, 5);
        let c = mixc([base[0] * 0.7, base[1] * 0.7, base[2] * 0.7], [base[0] * 1.2, base[1] * 1.2, base[2] * 1.2], n);
        for (const [cx, cy, cz, cr] of craters) {
          const d = 1 - (x * cx + y * cy + z * cz);
          if (d < cr) c = mixc(c, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6], 0.7);
          else if (d < cr * 1.3) c = mixc(c, [c[0] * 1.3, c[1] * 1.3, c[2] * 1.3], 0.6);
        }
        if (b.kind === 'shy') c = mixc(c, [190, 170, 230], smooth(0.4, 0.8, Math.sin(y * 12 + n * 6) * 0.5 + 0.5) * 0.3);
        put(m.col, i, c);
        if (b.kind === 'cinder') m.emis![i] = smooth(0.84, 0.97, ridged(x * 4, y * 4, z * 4, s + 1, 4)) * 255;
      }, b.kind === 'shy' ? hexRgb('#c9b8ff') : b.kind === 'cinder' ? hexRgb('#ff7040') : hexRgb('#a0a0a0'), b.kind === 'shy' ? 0.6 : b.kind === 'cinder' ? 0.3 : 0.05, { emis: new Uint8ClampedArray(128 * 64) });
    }
  }
}

/** The disk's own geometry for a size: per pixel, its normal in the world and where it falls on the map before the spin. */
type Geo = { R: number; D: number; idx: Int32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array; lon: Float32Array; v: Float32Array; edge: Float32Array; dx: Float32Array; dy: Float32Array };

export type Light = {
  /** Unit vector from the body toward the sun, in world axes. */
  L: [number, number, number];
  /** The sunlight's colour and the night's, each 0..1 a channel. */
  sun: RGB;
  heat: number;
  ambient: RGB;
  /** The loop's own changes: sand on this twin (0..1 of the ground covered), fallen shards. */
  sandLevel?: number;
  fallen?: Uint8Array;
  /** The hole in the crust: the black hole's radius as a share of the body's. */
  bh?: number;
  /** Clouds turn on their own: an extra spin for the cloud layer. */
  cloudSpin?: number;
  /** A white-hot burn from the supernova, 0..1. */
  burn?: number;
};

export function createSphere() {
  let geo: Geo | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let img: ImageData | null = null;
  let cE = 0;
  function geometry(R: number, sinE: number, cosE: number): Geo {
    if (geo && geo.R === R && cE === sinE) return geo;
    cE = sinE;
    const pad = 1;
    const D = Math.ceil(R * 2 + pad * 2);
    const idx: number[] = [];
    const nx: number[] = [];
    const ny: number[] = [];
    const nz: number[] = [];
    const lon: number[] = [];
    const v: number[] = [];
    const edge: number[] = [];
    const dxs: number[] = [];
    const dys: number[] = [];
    const c0 = D / 2;
    for (let j = 0; j < D; j++) {
      for (let i = 0; i < D; i++) {
        const dx = (i + 0.5 - c0) / R;
        const dy = (j + 0.5 - c0) / R;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1 + 1 / R) continue;
        const a = d > 1 ? dx / d : dx;
        const b = d > 1 ? -dy / d : -dy;
        const c = Math.sqrt(Math.max(0, 1 - a * a - b * b));
        const Nx = a;
        const Ny = b * cosE + c * sinE;
        const Nz = c * cosE - b * sinE;
        idx.push(j * D + i);
        nx.push(Nx);
        ny.push(Ny);
        nz.push(Nz);
        lon.push(Math.atan2(Nx, Nz));
        v.push(0.5 - Math.asin(Math.max(-1, Math.min(1, Ny))) / Math.PI);
        edge.push(clamp01((1 - d) * R + 0.5));
        dxs.push(dx);
        dys.push(dy);
      }
    }
    geo = { R, D, idx: Int32Array.from(idx), nx: Float32Array.from(nx), ny: Float32Array.from(ny), nz: Float32Array.from(nz), lon: Float32Array.from(lon), v: Float32Array.from(v), edge: Float32Array.from(edge), dx: Float32Array.from(dxs), dy: Float32Array.from(dys) };
    canvas = null;
    return geo;
  }
  return {
    get canvas() {
      return canvas;
    },
    /** Paint the ball into its canvas at radius R device pixels. */
    render(m: SurfaceMap, R: number, sinE: number, cosE: number, spin: number, light: Light, viewY: [number, number, number]): HTMLCanvasElement {
      const G = geometry(R, sinE, cosE);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = canvas.height = G.D;
        img = canvas.getContext('2d')!.createImageData(G.D, G.D);
      }
      const p = img!.data;
      p.fill(0);
      const { w: MW, h: MH, col, col2, aux, cloud, emis, wet } = m;
      const [Lx, Ly, Lz] = light.L;
      const [sr, sg, sb] = light.sun;
      const [ar, ag, ab] = light.ambient;
      const heat = light.heat;
      // The half vector for the glint on water.
      let hx = Lx + viewY[0];
      let hy = Ly + viewY[1];
      let hz = Lz + viewY[2];
      const hl = Math.hypot(hx, hy, hz) || 1;
      hx /= hl;
      hy /= hl;
      hz /= hl;
      const spinU = spin / TAU;
      const cloudU = (spin + (light.cloudSpin ?? 0)) / TAU;
      const sandLevel = light.sandLevel ?? -1;
      const fallen = light.fallen;
      const bh = light.bh ?? 0;
      const burn = light.burn ?? 0;
      const [atr, atg, atb] = m.atmo;
      const atK = m.atmoK;
      const n = G.idx.length;
      for (let q = 0; q < n; q++) {
        const Nx = G.nx[q];
        const Ny = G.ny[q];
        const Nz = G.nz[q];
        let u = G.lon[q] / TAU + spinU;
        u -= Math.floor(u);
        const ti = Math.min(MH - 1, Math.floor(G.v[q] * MH)) * MW + Math.min(MW - 1, Math.floor(u * MW));
        let r = col[ti * 3];
        let g = col[ti * 3 + 1];
        let b = col[ti * 3 + 2];
        let own = 0;
        let ownR = 0;
        let ownG = 0;
        let ownB = 0;
        let hole = false;
        if (col2 && aux && sandLevel >= 0 && aux[ti] < sandLevel) {
          // Sand: lighter where it lies deep.
          const deep = Math.min(1, (sandLevel - aux[ti]) * 6);
          const k = 0.86 + 0.14 * deep;
          r = col2[ti * 3] * k;
          g = col2[ti * 3 + 1] * k;
          b = col2[ti * 3 + 2] * k;
        }
        if (fallen && aux && fallen[aux[ti]]) hole = true;
        const ndl = Nx * Lx + Ny * Ly + Nz * Lz;
        let lit = ndl > 0 ? Math.pow(ndl, 0.8) : 0;
        // A soft terminator.
        lit *= smoothTerm(ndl);
        let R2: number;
        let G2: number;
        let B2: number;
        if (hole) {
          // Into the hollow: the far inside wall dimly lit, and the black hole at the middle with its ring.
          const dd = Math.sqrt(G.dx[q] * G.dx[q] + G.dy[q] * G.dy[q]);
          const ring = Math.exp(-(((dd - bh * 1.25) / (bh * 0.35 + 0.02)) ** 2));
          const inner = 0.25 + 0.4 * clamp01(-ndl);
          R2 = 30 * inner + 170 * ring;
          G2 = 22 * inner + 120 * ring;
          B2 = 44 * inner + 255 * ring;
          if (dd < bh) {
            R2 = G2 = B2 = 0;
          }
        } else {
          R2 = r * (ar + sr * lit * heat);
          G2 = g * (ag + sg * lit * heat);
          B2 = b * (ab + sb * lit * heat);
          if (wet && wet[ti]) {
            const sp = Nx * hx + Ny * hy + Nz * hz;
            if (sp > 0.9) {
              const s2 = Math.pow((sp - 0.9) / 0.1, 6) * 0.55 * lit;
              R2 += 255 * s2 * sr;
              G2 += 255 * s2 * sg;
              B2 += 255 * s2 * sb;
            }
          }
          if (cloud) {
            let cu = G.lon[q] / TAU + cloudU;
            cu -= Math.floor(cu);
            const ci = Math.min(MH - 1, Math.floor(G.v[q] * MH)) * MW + Math.min(MW - 1, Math.floor(cu * MW));
            const ca = cloud[ci] / 255;
            if (ca > 0) {
              const cl = 0.08 + lit * heat;
              R2 += (250 * (sr * cl + ar) - R2) * ca;
              G2 += (250 * (sg * cl + ag) - G2) * ca;
              B2 += (250 * (sb * cl + ab) - B2) * ca;
            }
          }
          // Dusk on the terminator: a warm band where the air is.
          if (atK > 0.3 && ndl > -0.12 && ndl < 0.18) {
            const dusk = (1 - Math.abs(ndl - 0.03) / 0.15) * 0.35 * atK;
            if (dusk > 0) {
              R2 += 120 * dusk;
              G2 += 40 * dusk;
              B2 += 10 * dusk;
            }
          }
          if (emis) {
            const e = emis[ti] / 255;
            if (e > 0) {
              const night = 1 - smoothTerm(ndl + 0.05);
              own = e * (0.35 + 0.65 * night);
              ownR = 255;
              ownG = m.atmoK > 0.5 ? 200 : m.atmo[0] > 200 && m.atmo[1] < 140 ? 110 : 235;
              ownB = m.atmoK > 0.5 ? 120 : m.atmo[0] > 200 && m.atmo[1] < 140 ? 40 : 190;
            }
          }
        }
        // The air at the limb, brighter on the lit side.
        const c = Ny * viewY[1] + Nz * viewY[2] + Nx * viewY[0];
        const rim = Math.pow(1 - Math.max(0, c), 3) * atK * (0.12 + 0.88 * clamp01(ndl + 0.35));
        R2 += atr * rim;
        G2 += atg * rim;
        B2 += atb * rim;
        R2 += ownR * own;
        G2 += ownG * own;
        B2 += ownB * own;
        if (burn > 0) {
          R2 += (235 - R2) * burn;
          G2 += (245 - G2) * burn;
          B2 += (255 - B2) * burn;
        }
        const o = G.idx[q] * 4;
        p[o] = R2;
        p[o + 1] = G2;
        p[o + 2] = B2;
        p[o + 3] = 255 * G.edge[q];
      }
      canvas.getContext('2d')!.putImageData(img!, 0, 0);
      return canvas;
    },
  };
}
const smoothTerm = (ndl: number) => {
  const x = clamp01((ndl + 0.06) / 0.2);
  return x * x * (3 - 2 * x);
};

/** Whether ground (lon, lat) on a map is land and wooded, for the trees on the limb. */
export function sampleMap(m: SurfaceMap, lon: number, lat: number): { wet: boolean; rgb: RGB } {
  let u = lon / TAU;
  u -= Math.floor(u);
  const v = 0.5 - lat / Math.PI;
  const ti = Math.min(m.h - 1, Math.max(0, Math.floor(v * m.h))) * m.w + Math.min(m.w - 1, Math.floor(u * m.w));
  return { wet: !!m.wet?.[ti], rgb: [m.col[ti * 3], m.col[ti * 3 + 1], m.col[ti * 3 + 2]] };
}
