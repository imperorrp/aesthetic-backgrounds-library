/**
 * The sand as terrain: a dune field (a heightfield of transverse dunes, sharp at the brink, steep on
 * the slip face, with smaller dunes on their backs and the long swells under them), and a renderer
 * that draws it into the picture column by column, front to back (the old voxel-space way), lit per
 * sample by the sun or the moon, faded into the haze with distance.
 *
 * The picture is cut into slabs of distance, each its own image, so things standing on the sand can
 * be drawn between them: a dune nearer than a crawler hides it. It renders a few hundred columns a
 * frame into a back buffer and swaps when a pass is done, so the light can follow the sun without a
 * stall. Painter-only (it makes canvases); the sim never needs it.
 */
import { hash } from '../../instruments/kit';
import { clamp01 } from './desert';

/** Smooth value noise, 0..1. */
export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export type DuneField = {
  /** Height of the sand at ground (x, z), in world units. */
  h(x: number, z: number): number;
  /** After `h`: how near that point was to a dune's brink (0..1). */
  brink: number;
  /** World z at a distance d (0 near, 1 the horizon). */
  zOf(d: number): number;
  /** Which way the ridges' slip faces fall (sign along the ridge normal). */
  lee: number;
  /** About how far above (and below) the mean the sand goes. */
  max: number;
};

export function createDuneField(seed: number, u: number, opts: { size?: number } = {}): DuneField {
  const R = (k: number) => hash(seed, k, 77);
  const size = opts.size ?? 1;
  // Great dunes: long ridges a good way apart, with small ones on their backs only.
  const lam1 = (520 + R(2) * 300) * u * size;
  const lam2 = lam1 * (0.24 + R(3) * 0.08);
  const a1 = (R(4) - 0.5) * 1.0;
  // The small dunes run nearly with the great ones (crossed at a steep angle, their ridges fan out like spokes in perspective).
  const a2 = a1 + (R(5) < 0.5 ? -1 : 1) * (0.2 + R(6) * 0.2);
  const s1 = Math.sin(a1);
  const k1 = Math.cos(a1);
  const s2 = Math.sin(a2);
  const k2 = Math.cos(a2);
  const H1 = (95 + R(7) * 45) * u * size;
  const H2 = H1 * 0.06;
  const H0 = (50 + R(8) * 50) * u * size;
  // Heights about the mean, so the sand's level stays where the picture's ground is.
  const MEAN = H1 * 0.48 + H2 * 0.3 + H0 * 0.5;
  // A real dune's proportions: four fifths windward slope (about 10°), one fifth slip face (about 34°, the angle of repose).
  const c1 = 0.78 + R(9) * 0.06;
  // The slip faces fall toward us (and away from a sun that is out in front): we see the steep
  // shadowed faces under every crest, the windward slopes going up into the light beyond.
  const lee = -1;
  // Depth in true perspective: the picture's ground falls as (1 - d)², so the ground's own z goes as
  // 1 / (1 - d)²: near, the dunes come at their own pace; far, a hundred of them crowd into the horizon.
  const Z0 = 1500 * u * size;
  const WARP = 1 / (1600 * u * size);
  const sd = Math.floor(R(11) * 1e5);
  // The dune's profile along its normal: a long windward slope up to a sharp brink, then the slip face.
  const prof = (t: number, c: number) => {
    const f = t - Math.floor(t);
    if (f < c) {
      const q = f / c;
      return q * (1.35 - 0.35 * q);
    }
    const r = (f - c) / (1 - c);
    return Math.pow(1 - r, 1.3);
  };
  const F: DuneField = {
    brink: 0,
    lee,
    max: H1 * 0.75 + H2 * 0.4 + H0 * 0.5,
    zOf: (d) => Z0 * (1 / Math.pow(1 - Math.min(0.997, d), 2) - 1),
    h(x, z) {
      const wx = (vnoise(x * WARP, z * WARP, sd) - 0.5) * lam1 * 0.9;
      const wz = (vnoise(x * WARP + 7.3, z * WARP + 3.1, sd + 1) - 0.5) * lam1 * 0.9;
      const X = x + wx;
      const Z = z + wz;
      const t1 = (lee * (X * s1 + Z * k1)) / lam1;
      // Sinuous crests (the phase wanders along the ridge), and ridges that rise and die away along their length.
      const ph = (vnoise(X / (lam1 * 1.15), Z / (lam1 * 0.85), sd + 2) - 0.5) * 1.0 + (vnoise(X / (lam1 * 3.5), Z / (lam1 * 2), sd + 6) - 0.5) * 0.8;
      const amp = 0.22 + 1.0 * vnoise(X / (lam1 * 1.6), Z / (lam1 * 1.2), sd + 3);
      const tt = t1 + ph;
      const p1 = prof(tt, c1);
      const f = tt - Math.floor(tt);
      F.brink = clamp01(1 - Math.abs(f - c1) * 9) * amp;
      const t2 = (lee * (X * s2 + Z * k2)) / lam2;
      const p2 = prof(t2, 0.7);
      const draa = vnoise(x / (lam1 * 4.5), z / (lam1 * 3.2), sd + 4);
      return H1 * amp * p1 + H2 * p2 * (0.3 + 0.7 * (1 - amp * 0.6)) + H0 * draa - MEAN;
    },
  };
  return F;
}

type RGB = [number, number, number];
const rgbOf = (hex: string): RGB => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** What the sand is lit by now, and what lies on it (stains to tint, bowls to cut). */
export type TerrainLight = {
  /** Toward the light (the sun, or the moon at night), normalised. */
  L: [number, number, number];
  sand: string; lit: string; shade: string; haze: string;
  /** How much a distance is lost in the haze, 0..1. */
  hazeOf(d: number): number;
  /** Spice stains: ground x, z, radius, how much. */
  stains: [number, number, number, number][];
  /** Craters: ground x, z, radius, depth. */
  bowls: [number, number, number, number][];
};

export type TerrainView = {
  /** The width drawn (world px), and the columns from and to (world px) worth drawing. */
  W: number; x0: number; x1: number;
  /** The rows drawn (world px). */
  top: number; bottom: number;
  res: number;
  /** Nearest and farthest distance marched (the near one may be below 0, under the ledge). */
  dNear: number;
  yOf(d: number): number;
  mOf(d: number): number;
  /** Ground x under picture x at a distance. */
  groundX(sx: number, d: number): number;
  /** Distances where the slabs begin, ascending from dNear. */
  slabs: number[];
};

export function createTerrain(field: DuneField, view: TerrainView, mk: (w: number, h: number) => HTMLCanvasElement) {
  const { res, top, bottom, slabs } = view;
  const cols = Math.max(1, Math.ceil(view.W * res));
  const rows = Math.max(1, Math.ceil((bottom - top) * res));
  const c0 = Math.max(0, Math.floor(view.x0 * res));
  const c1 = Math.min(cols, Math.ceil(view.x1 * res));
  // Enough samples down each column to catch every dune's brink (too few, and the crests are comb-toothed).
  const N = 560;
  // March from far enough in front that even the tallest dune there is below the bottom of the picture.
  let dStart = view.dNear;
  while (dStart > -1.5 && view.yOf(dStart) - field.max * view.mOf(dStart) < bottom + 4) dStart -= 0.01;
  // Spaced evenly on the picture, not on the ground: about the same number of rows between samples near and far.
  const ys0 = view.yOf(dStart);
  const ys1 = view.yOf(0.997);
  const ds = Array.from({ length: N }, (_, i) => {
    const y = ys0 + (ys1 - ys0) * Math.pow(i / (N - 1), 0.85);
    const k = (y - view.yOf(1)) / (view.yOf(0) - view.yOf(1));
    return 1 - Math.sqrt(Math.max(0, k));
  });
  const ys = ds.map((d) => view.yOf(d));
  const ms = ds.map((d) => view.mOf(d));
  const zs = ds.map((d) => field.zOf(d));
  const slabOf = ds.map((d) => {
    let k = 0;
    while (k + 1 < slabs.length && d >= slabs[k + 1]) k++;
    return k;
  });
  const canvases = slabs.map(() => mk(cols, rows));
  const back = slabs.map(() => new ImageData(cols, rows));
  const prevH = new Float32Array(N);
  const prevX = new Float32Array(N);
  let col = c0;
  let fresh = false;
  let L: TerrainLight | null = null;
  let haze: Float32Array = new Float32Array(N);
  let litC: RGB = [1, 1, 1];
  let shadeC: RGB = [0.5, 0.5, 0.6];
  let sandC: RGB = [0.8, 0.6, 0.4];
  let hazeC: RGB = [0.8, 0.8, 0.8];

  /** Height of the sand, with the craters cut into it. */
  const heightAt = (x: number, z: number, bowls: TerrainLight['bowls']) => {
    let h = field.h(x, z);
    for (const [bx, bz, br, bd] of bowls) {
      const q = Math.hypot(x - bx, (z - bz) * 0.8) / br;
      if (q < 1.25) h -= q < 1 ? bd * (1 - q * q) : -bd * 0.25 * (1 - (q - 1) / 0.25);
    }
    return h;
  };

  function begin(light: TerrainLight) {
    L = light;
    litC = rgbOf(light.lit);
    shadeC = rgbOf(light.shade);
    sandC = rgbOf(light.sand);
    hazeC = rgbOf(light.haze);
    haze = Float32Array.from(ds, (d) => light.hazeOf(Math.max(0, d)));
    col = c0;
  }

  function column(c: number) {
    const light = L!;
    const [lx, ly, lz] = light.L;
    const sx = (c + 0.5) / res;
    for (const img of back) {
      const p = img.data;
      for (let r = 0; r < rows; r++) p[(r * cols + c) * 4 + 3] = 0;
    }
    let slab = -1;
    let maxY = rows;
    let ph = 0;
    let pz = 0;
    let pR = 0;
    let pG = 0;
    let pB = 0;
    let hasPrev = false;
    let dzS = 0;
    let lastPy = rows;
    const first = c === c0;
    for (let i = 0; i < N; i++) {
      const d = ds[i];
      const gx = view.groundX(sx, d);
      const z = zs[i];
      const h = heightAt(gx, z, light.bowls);
      const brink = field.brink;
      const m = ms[i];
      const py = (ys[i] - h * m - top) * res;
      // The slope: along z from the last sample (eased, so a long step far off does not jump), along x from the last column.
      const dzRaw = i ? (h - ph) / Math.max(1e-3, z - pz) : 0;
      dzS = i ? dzS + (dzRaw - dzS) * (d < 0.35 ? 1 : 0.75) : dzRaw;
      const dz = dzS;
      let dx: number;
      if (first) {
        const e = 2 * (1 / res);
        dx = (heightAt(gx + e, z, light.bowls) - h) / e;
      } else dx = (h - prevH[i]) / Math.max(1e-3, gx - prevX[i]);
      prevH[i] = h;
      prevX[i] = gx;
      ph = h;
      pz = z;
      if (slabOf[i] !== slab) {
        slab = slabOf[i];
        hasPrev = false;
        // Each slab starts where the last sample of the nearer one fell (so a face rising steeply across
        // the boundary leaves no gap), and runs a few rows under it, so no seam shows when scaled up.
        maxY = slab === 0 ? rows : Math.min(rows, Math.ceil(Math.max(py, lastPy)) + 4);
      }
      lastPy = py;
      if (py >= maxY) continue;
      // Ripples near, across the wind: a little light and shade in the slope.
      const nearK = clamp01(1 - d * 4);
      const rip = nearK > 0 ? Math.sin((gx * 0.31 + z * 0.9) / (5 + 3 * nearK)) * 0.06 * nearK : 0;
      const nx = -dx + rip;
      const nz = -dz;
      const inv = 1 / Math.hypot(nx, 1, nz);
      const dot = (nx * lx + ly + nz * lz) * inv;
      // A crisp terminator: a face turned from the light falls into shade quickly, as sand does.
      // (softer with distance, where the slope is measured over a long way and would step)
      const q0 = clamp01((dot - 0.02) / (0.32 + Math.max(0, d) * 0.4));
      const lam = 0.12 + 0.88 * q0 * q0 * (3 - 2 * q0);
      const up = inv;
      // Lit sand toward the light's colour; the faces away in the sky's cool shade; the brink catches the light.
      let r = shadeC[0] + (litC[0] - shadeC[0]) * lam;
      let g = shadeC[1] + (litC[1] - shadeC[1]) * lam;
      let b = shadeC[2] + (litC[2] - shadeC[2]) * lam;
      // The troughs darker than the crests (the sky sees less of them), and the faces turned to us a touch darker than those turned up.
      const rel = clamp01((h + field.max * 0.6) / (field.max * 1.6));
      const amb = (0.9 + 0.1 * up) * (0.74 + 0.26 * rel) * (1 - clamp01(-nz * inv) * 0.12);
      r *= amb;
      g *= amb;
      b *= amb;
      if (brink > 0.35 && lam > 0.5) {
        const k = (brink - 0.35) * 0.1 * lam;
        r += (litC[0] - r) * k;
        g += (litC[1] - g) * k;
        b += (litC[2] - b) * k;
      }
      // Spice: the sand stained rust.
      let sp = 0;
      for (const [x2, z2, rr, amt] of light.stains) {
        const q = Math.hypot(gx - x2, (z - z2) * 0.7) / rr;
        if (q < 1) sp += amt * (1 - q * q) * (0.75 + 0.25 * Math.sin(gx * 0.05 + z * 0.03));
      }
      if (sp > 0) {
        const k = Math.min(0.85, sp);
        r += (r * 0.95 - r) * k;
        g += (g * 0.55 - g) * k;
        b += (b * 0.35 - b) * k;
      }
      // A touch of the sand's own colour into the shade, so it never goes grey.
      r = r * 0.9 + sandC[0] * 0.1 * (1 - lam);
      g = g * 0.9 + sandC[1] * 0.1 * (1 - lam);
      b = b * 0.9 + sandC[2] * 0.1 * (1 - lam);
      const hz = haze[i];
      r += (hazeC[0] - r) * hz;
      g += (hazeC[1] - g) * hz;
      b += (hazeC[2] - b) * hz;
      const R = Math.max(0, Math.min(255, r * 255));
      const G = Math.max(0, Math.min(255, g * 255));
      const B = Math.max(0, Math.min(255, b * 255));
      const p = back[slab].data;
      const y0 = Math.max(0, Math.floor(py));
      // A run of rows from this sample down to the last one seen: shade it from this colour to that
      // one, so a face seen steeply is a gradient, not a block.
      const run = maxY - y0;
      const fresh = !hasPrev;
      for (let y = y0; y < maxY; y++) {
        const k = fresh || run <= 1 ? 0 : (y - y0) / run;
        const o = (y * cols + c) * 4;
        p[o] = R + (pR - R) * k;
        p[o + 1] = G + (pG - G) * k;
        p[o + 2] = B + (pB - B) * k;
        p[o + 3] = 255;
      }
      pR = R;
      pG = G;
      pB = B;
      hasPrev = true;
      maxY = y0;
      if (maxY <= 0) break;
    }
  }

  return {
    canvases,
    cols,
    rows,
    get fresh() {
      return fresh;
    },
    /** Height of the sand under ground (x, d) (with the craters), in world units. */
    groundH(x: number, d: number, bowls: TerrainLight['bowls'] = []) {
      return heightAt(x, field.zOf(d), bowls);
    },
    /** Render everything now (the first frame). */
    full(light: TerrainLight) {
      begin(light);
      for (let c = c0; c < c1; c++) column(c);
      for (let k = 0; k < slabs.length; k++) canvases[k].getContext('2d')!.putImageData(back[k], 0, 0);
      fresh = true;
    },
    /**
     * Go on with the pass in hand (`budget` columns), starting a new one with `light` when the last
     * is done. Returns true when a pass finished and the slabs were swapped.
     */
    work(light: () => TerrainLight, budget: number) {
      if (!L || col >= c1) begin(light());
      const end = Math.min(c1, col + budget);
      for (; col < end; col++) column(col);
      if (col >= c1) {
        for (let k = 0; k < slabs.length; k++) canvases[k].getContext('2d')!.putImageData(back[k], 0, 0);
        L = null;
        return true;
      }
      return false;
    },
  };
}
export type Terrain = ReturnType<typeof createTerrain>;
