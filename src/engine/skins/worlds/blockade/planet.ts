/**
 * The planet, lit per sample: a sphere seen in orthographic projection, its surface drawn from
 * noise in latitude and longitude (so it turns), with clouds that turn a little faster, the light
 * of the star (a soft terminator, a reddened band at dusk, the glint of the sun on water), city
 * lights on the night side, lava glowing, and the air: thickening toward the limb inside the disc,
 * a glowing shell outside it, brightest where the star is behind.
 *
 * It is rendered at a fraction of the world's resolution into a buffer, a band of rows each frame;
 * when a pass is done it fades in over the last. A jump of the clock renders all of it at once.
 */
import type { PlanetLook } from './design';
import type { BlockWorld, V3 } from './types';
import { rgbOf, type RGB } from './ships';

const smooth = (a: number, b: number, v: number) => {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const h2 = (x: number, y: number, s: number) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Value noise, periodic in x with period p (lattice cells). */
function vn(x: number, y: number, p: number, s: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % p) + p) % p;
  const x1 = (x0 + 1) % p;
  const a = h2(x0, yi, s);
  const b = h2(x1, yi, s);
  const c = h2(x0, yi + 1, s);
  const d = h2(x1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** fBm over the sphere: `lu` is longitude in turns, `la` latitude in turns. */
function fbm(lu: number, la: number, base: number, oct: number, s: number) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = base;
  for (let o = 0; o < oct; o++) {
    sum += amp * vn(lu * p, la * p, p, s + o * 17);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

export type PlanetPainter = ReturnType<typeof createPlanetPainter>;

export function createPlanetPainter(world: BlockWorld, seed: number) {
  const { GW, GH, planet } = world;
  const { cx, cy, R, A, B1, B2 } = planet;
  const look: PlanetLook = world.planetLook;
  const shell = 1 + planet.atmo * 3.2;
  const top = Math.max(0, Math.floor(cy - R * shell) - 4);
  const res = Math.min(0.62, Math.max(0.38, 1000 / Math.max(GW, GH)));
  const bw = Math.ceil(GW * res);
  const bh = Math.ceil((GH - top) * res);
  const n = bw * bh;
  // Per sample: the view normal, latitude, the angle round the axis; or, outside the disc, how far out.
  const NX = new Float32Array(n);
  const NY = new Float32Array(n);
  const NZ = new Float32Array(n);
  const LAT = new Float32Array(n);
  const ANG = new Float32Array(n);
  const RR = new Float32Array(n);
  for (let j = 0; j < bh; j++)
    for (let i = 0; i < bw; i++) {
      const k = j * bw + i;
      const x = (i + 0.5) / res;
      const y = top + (j + 0.5) / res;
      const nx = (x - cx) / R;
      const ny = (y - cy) / R;
      const rr = Math.sqrt(nx * nx + ny * ny);
      RR[k] = rr;
      NX[k] = nx;
      NY[k] = ny;
      if (rr < 1) {
        const nz = Math.sqrt(1 - rr * rr);
        NZ[k] = nz;
        const sa = nx * A[0] + ny * A[1] + nz * A[2];
        LAT[k] = Math.asin(Math.max(-1, Math.min(1, sa)));
        ANG[k] = Math.atan2(nx * B2[0] + ny * B2[1] + nz * B2[2], nx * B1[0] + ny * B1[1] + nz * B1[2]);
      }
    }
  const C = {
    deep: rgbOf(look.deep), shallow: rgbOf(look.shallow), low: rgbOf(look.low), mid: rgbOf(look.mid), high: rgbOf(look.high), peak: rgbOf(look.peak),
    cloud: rgbOf(look.cloud), atmo: rgbOf(look.atmo), dusk: rgbOf(look.dusk), city: rgbOf(look.city), glow: rgbOf(look.glow),
  };
  const kind = look.kind;
  const TAU = Math.PI * 2;
  const s0 = seed % 100000;
  // A storm on a giant, somewhere on the face we see.
  const storm = { la: 0.025 + ((seed % 97) / 97) * 0.07, lu: (seed % 61) / 61 };
  const mixc = (o: number[], a: RGB, b: RGB, k: number) => {
    o[0] = a[0] + (b[0] - a[0]) * k;
    o[1] = a[1] + (b[1] - a[1]) * k;
    o[2] = a[2] + (b[2] - a[2]) * k;
  };
  const alb = [0, 0, 0];
  /** How much the air hazes the face: thin over fire, thick over a giant. */
  const hazeK = kind === 'lava' ? 0.3 : kind === 'desert' ? 0.7 : 0.9;
  const tmp = [0, 0, 0];

  /** The surface at (lon, lat): its colour into `alb`; returns [water 0..1, city 0..1, emission 0..1]. */
  const out3 = [0, 0, 0];
  function surface(lon: number, lat: number) {
    const lu = lon / TAU;
    const la = lat / TAU;
    out3[0] = 0;
    out3[1] = 0;
    out3[2] = 0;
    if (kind === 'gas') {
      const warp = (fbm(lu, la, 6, 4, s0 + 5) - 0.5) * 0.06 + (fbm(lu, la, 24, 3, s0 + 9) - 0.5) * 0.012;
      const b = la * 46 + warp * 46;
      const band = 0.5 + 0.5 * Math.sin(b * TAU * 0.5 + Math.sin(b * 1.7) * 1.2);
      const fine = fbm(lu * 1, la + warp, 40, 4, s0 + 11);
      const k2 = 0.5 + 0.5 * Math.sin(b * TAU * 1.3 + 1);
      mixc(alb, C.low, C.mid, band);
      mixc(tmp, C.high, C.shallow, k2);
      mixc(alb, alb as RGB, tmp as RGB, 0.35 + fine * 0.3);
      const dark = smooth(0.62, 0.8, fine);
      mixc(alb, alb as RGB, C.peak, dark * 0.5);
      // The great storm.
      let dl = lu - storm.lu;
      dl -= Math.round(dl);
      const dd = Math.hypot(dl * 3.2, (la - storm.la) * 7);
      if (dd < 0.06) {
        const sw = 1 - dd / 0.06;
        mixc(alb, alb as RGB, C.deep, sw * 0.6 * (0.6 + 0.4 * Math.sin(dd * 300 + Math.atan2(la - storm.la, dl) * 3)));
      }
      out3[1] = smooth(0.996, 0.999, h2(Math.floor(lu * 2400), Math.floor(la * 2400), s0 + 33)) * smooth(0.55, 0.7, fine) * 0.6;
      return;
    }
    const wx = (fbm(lu, la, 3, 3, s0 + 1) - 0.5) * 0.06;
    const wy = (fbm(lu, la, 3, 3, s0 + 2) - 0.5) * 0.06;
    const hgt = 0.5 + (fbm(lu + wx, la + wy, 5, 8, s0 + 3) - 0.5) * 1.9;
    const moist = 0.5 + (fbm(lu, la, 4, 3, s0 + 4) - 0.5) * 1.8;
    const sea = look.sea;
    if (kind === 'city') {
      // A whole world built over: districts, the great arteries between them, a few dark seas.
      const dist = fbm(lu, la, 18, 3, s0 + 6);
      const gx = Math.abs(((lu * 360) % 1) - 0.5);
      const gy = Math.abs(((la * 360) % 1) - 0.5);
      const artery = Math.max(smooth(0.46, 0.5, gx), smooth(0.46, 0.5, gy));
      if (hgt < sea) {
        mixc(alb, C.shallow, C.deep, smooth(0, 0.1, sea - hgt));
        out3[0] = 1;
        return;
      }
      mixc(alb, C.low, C.mid, dist);
      mixc(alb, alb as RGB, C.high, smooth(0.6, 0.75, fbm(lu, la, 120, 3, s0 + 7)) * 0.6);
      mixc(alb, alb as RGB, C.deep, artery * 0.5);
      const lights = smooth(0.35, 0.7, fbm(lu, la, 60, 4, s0 + 8)) * 0.8 + artery * 0.6 + smooth(0.6, 0.9, h2(Math.floor(lu * 4000), Math.floor(la * 4000), s0)) * 0.5;
      out3[1] = Math.min(1.4, lights) * look.cityK;
      return;
    }
    if (hgt < sea) {
      const dep = smooth(0, 0.12, sea - hgt);
      if (kind === 'lava') {
        // Lava lakes, skinned over with crust that cracks into plates.
        const crust = smooth(0.42, 0.58, fbm(lu, la, 60, 4, s0 + 19));
        mixc(alb, C.shallow, C.deep, dep);
        mixc(alb, alb as RGB, C.low, crust);
        out3[2] = (0.35 + 0.45 * (1 - dep)) * (1 - crust * 0.85);
        return;
      }
      if (kind === 'ice') {
        mixc(alb, C.shallow, C.deep, dep);
        out3[0] = 0.8;
        // Floes on the open water.
        const floe = smooth(0.55, 0.62, fbm(lu, la, 80, 3, s0 + 12));
        mixc(alb, alb as RGB, C.low, floe);
        out3[0] *= 1 - floe;
        return;
      }
      mixc(alb, C.shallow, C.deep, dep);
      out3[0] = 1;
      return;
    }
    const e = (hgt - sea) / Math.max(0.01, 1 - sea);
    if (kind === 'desert') {
      const dune = 0.5 + 0.5 * Math.sin((lu * 900 + fbm(lu, la, 30, 3, s0 + 13) * 14) * TAU * 0.5);
      mixc(alb, C.low, C.mid, smooth(0.3, 0.7, moist) * 0.8 + dune * 0.2);
      mixc(alb, alb as RGB, C.high, smooth(0.35, 0.6, e));
      mixc(alb, alb as RGB, C.peak, smooth(0.75, 0.9, fbm(lu, la, 50, 3, s0 + 14)) * 0.5);
      out3[1] = smooth(0.7, 0.85, fbm(lu, la, 70, 3, s0 + 15)) * (1 - smooth(0.4, 0.6, e)) * look.cityK;
      return;
    }
    if (kind === 'ice') {
      mixc(alb, C.low, C.high, smooth(0.0, 0.5, e));
      const crack = 1 - Math.abs(fbm(lu, la, 40, 4, s0 + 16) * 2 - 1);
      mixc(alb, alb as RGB, C.shallow, smooth(0.86, 0.96, crack) * 0.8);
      mixc(alb, alb as RGB, C.peak, smooth(0.5, 0.8, e));
      out3[0] = 0.25;
      out3[1] = smooth(0.78, 0.9, fbm(lu, la, 70, 3, s0 + 15)) * look.cityK;
      return;
    }
    if (kind === 'lava') {
      mixc(alb, C.low, C.mid, smooth(0.2, 0.7, moist));
      mixc(alb, alb as RGB, C.high, smooth(0.4, 0.8, e));
      const crack = 1 - Math.abs(fbm(lu, la, 30, 5, s0 + 17) * 2 - 1);
      out3[2] = smooth(0.85, 0.97, crack) * (1 - e * 0.6) + smooth(0, 0.06, 0.06 - e) * 0.6;
      out3[1] = smooth(0.82, 0.92, fbm(lu, la, 80, 3, s0 + 15)) * look.cityK;
      return;
    }
    // An ocean world's land: green lowlands, brown uplands, snow on the peaks.
    mixc(alb, C.low, C.mid, smooth(0.15, 0.6, e) * (0.6 + (1 - moist) * 0.8));
    mixc(alb, alb as RGB, C.high, smooth(0.5, 0.75, e));
    mixc(alb, alb as RGB, C.peak, smooth(0.78, 0.9, e));
    const beach = 1 - smooth(0, 0.03, e);
    mixc(alb, alb as RGB, [0.75, 0.68, 0.5], beach * 0.4);
    const town = smooth(0.52, 0.78, fbm(lu, la, 48, 4, s0 + 18)) * (1 - smooth(0.4, 0.6, e)) + beach * 0.4;
    out3[1] = Math.min(1, town) * look.cityK * (0.4 + 0.6 * smooth(0.55, 0.85, h2(Math.floor(lu * 3000), Math.floor(la * 3000), s0)));
  }
  function cloudAt(lon: number, lat: number) {
    if (look.clouds <= 0) return 0;
    const lu = lon / TAU;
    const la = lat / TAU;
    const wx = (fbm(lu, la, 4, 3, s0 + 40) - 0.5) * 0.08;
    const c = 0.5 + (fbm(lu + wx, la * 1.8 + wx * 0.5, 7, 6, s0 + 41) - 0.5) * 2.1;
    const thr = 1 - look.clouds;
    return smooth(thr - 0.06, thr + 0.16, c) * (0.75 + 0.25 * fbm(lu, la, 90, 2, s0 + 42));
  }

  type Snap = { rot: number; crot: number; L: V3; sun: RGB };
  let job: { img: ImageData; row: number; snap: Snap } | null = null;
  let front: HTMLCanvasElement | null = null;
  let back: HTMLCanvasElement | null = null;
  let fadeT = -1;
  let lastT = -1e9;

  function renderRows(img: ImageData, j0: number, j1: number, s: Snap) {
    const D = img.data;
    const [Lx, Ly, Lz] = s.L;
    // The half vector for the glint (we look down z).
    const hn = Math.hypot(Lx, Ly, Lz + 1) || 1;
    const Hx = Lx / hn;
    const Hy = Ly / hn;
    const Hz = (Lz + 1) / hn;
    const sun = s.sun;
    const amb = 0.035;
    for (let j = j0; j < j1; j++)
      for (let i = 0; i < bw; i++) {
        const k = j * bw + i;
        const o = k * 4;
        const rr = RR[k];
        const nx = NX[k];
        const ny = NY[k];
        if (rr >= 1) {
          if (rr > shell) {
            D[o + 3] = 0;
            continue;
          }
          // The shell of air outside the limb.
          const alt = (rr - 1) / planet.atmo;
          const dens = Math.exp(-alt * 1.6);
          const lnx = nx / rr;
          const lny = ny / rr;
          const d = lnx * Lx + lny * Ly;
          const lit = smooth(-0.35, 0.3, d);
          const behind = Math.pow(Math.max(0, -Lz), 2.5) * smooth(-0.5, 0.15, d) * 1.4;
          const dusk = Math.exp(-((d / 0.22) ** 2)) * 0.8;
          const a = dens * Math.min(1, lit * 0.85 + behind + 0.06);
          const r = C.atmo[0] * (lit + behind) * sun[0] + C.dusk[0] * dusk * (lit + behind);
          const gg = C.atmo[1] * (lit + behind) * sun[1] + C.dusk[1] * dusk * (lit + behind) * 0.7;
          const b = C.atmo[2] * (lit + behind) * sun[2] + C.dusk[2] * dusk * (lit + behind) * 0.5;
          const m = Math.max(1e-3, lit + behind + 0.06);
          D[o] = Math.min(255, (r / m) * 255 * Math.min(1.4, m * 1.2));
          D[o + 1] = Math.min(255, (gg / m) * 255 * Math.min(1.4, m * 1.2));
          D[o + 2] = Math.min(255, (b / m) * 255 * Math.min(1.4, m * 1.2));
          D[o + 3] = Math.min(255, a * 255);
          continue;
        }
        const nz = NZ[k];
        const lat = LAT[k];
        const lonG = ANG[k] - s.rot;
        const lonC = ANG[k] - s.crot;
        surface(lonG, lat);
        const water = out3[0];
        const city = out3[1];
        const emit = out3[2];
        if (kind !== 'gas' && water < 0.5) {
          // Ground texture: ranges and basins finer than the continents.
          const lu = lonG / TAU;
          const la = lat / TAU;
          const det = fbm(lu, la, 90, 4, s0 + 60);
          const ridge = 1 - Math.abs(det * 2 - 1);
          const k = 0.78 + 0.4 * det - smooth(0.8, 0.95, ridge) * 0.18;
          alb[0] *= k;
          alb[1] *= k;
          alb[2] *= k;
        }
        const d = nx * Lx + ny * Ly + nz * Lz;
        const day = smooth(-0.035, 0.06, d);
        const diff = Math.pow(Math.max(0, d), 0.85);
        const tw = Math.exp(-(((d - 0.015) / 0.03) ** 2)) * smooth(-0.03, 0.02, d);
        let r = alb[0] * (amb + diff * sun[0] * 1.05);
        let g = alb[1] * (amb + diff * sun[1] * 1.05);
        let b = alb[2] * (amb + diff * sun[2] * 1.05);
        // The sun's glint on the water.
        if (water > 0) {
          const spec = Math.pow(Math.max(0, nx * Hx + ny * Hy + nz * Hz), 70) * 1.3 * water * day;
          r += spec * sun[0];
          g += spec * sun[1];
          b += spec * sun[2] * 0.95;
        }
        // Clouds, lit, with a little shadow under them.
        const cl = cloudAt(lonC, lat);
        if (cl > 0) {
          const cd = Math.pow(Math.max(0, d + 0.04), 0.7);
          const cr = (kind === 'lava' ? C.cloud[0] * 0.7 : C.cloud[0]) * (amb * 1.4 + cd * sun[0]);
          const cg = (kind === 'lava' ? C.cloud[1] * 0.7 : C.cloud[1]) * (amb * 1.4 + cd * sun[1]);
          const cb = (kind === 'lava' ? C.cloud[2] * 0.7 : C.cloud[2]) * (amb * 1.4 + cd * sun[2]);
          r = r * (1 - cl) + cr * cl;
          g = g * (1 - cl) + cg * cl;
          b = b * (1 - cl) + cb * cl;
        }
        // Dusk reddens the band along the terminator.
        r += C.dusk[0] * tw * 0.07 * (1 + cl);
        g += C.dusk[1] * tw * 0.035 * (1 + cl);
        b += C.dusk[2] * tw * 0.015;
        // The night side: cities, under thin cloud.
        const night = 1 - day;
        if (city > 0 && night > 0) {
          const ck = city * night * (1 - cl * 0.75) * 1.1;
          r += C.city[0] * ck;
          g += C.city[1] * ck;
          b += C.city[2] * ck;
        }
        if (emit > 0) {
          const ek = emit * look.glowK * (0.45 + 0.55 * night) * (1 - cl * 0.6);
          r += C.glow[0] * ek;
          g += C.glow[1] * ek * 0.9;
          b += C.glow[2] * ek * 0.8;
        }
        // The air, thicker toward the limb, lit past the terminator a little.
        const f = (Math.pow(1 - nz, 2.6) * 0.85 + 0.05) * hazeK;
        const sc = smooth(-0.12, 0.35, d);
        const ar = C.atmo[0] * sc * sun[0] * 0.9 + C.dusk[0] * tw * 0.18;
        const ag = C.atmo[1] * sc * sun[1] * 0.9 + C.dusk[1] * tw * 0.1;
        const ab = C.atmo[2] * sc * sun[2] * 0.9 + C.dusk[2] * tw * 0.05;
        r = r * (1 - f * 0.7) + ar * f;
        g = g * (1 - f * 0.7) + ag * f;
        b = b * (1 - f * 0.7) + ab * f;
        // The very edge: a bright rim where the air is thickest.
        const rim = smooth(0.985, 1, rr) * (sc * 0.6 + Math.pow(Math.max(0, -Lz), 2) * 0.5);
        r += C.atmo[0] * rim;
        g += C.atmo[1] * rim;
        b += C.atmo[2] * rim;
        D[o] = Math.min(255, Math.pow(Math.max(0, r), 0.92) * 255);
        D[o + 1] = Math.min(255, Math.pow(Math.max(0, g), 0.92) * 255);
        D[o + 2] = Math.min(255, Math.pow(Math.max(0, b), 0.92) * 255);
        D[o + 3] = 255;
      }
  }
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = bw;
    c.height = bh;
    return c;
  };
  function snapNow(): Snap {
    return { rot: planet.omega * world.t, crot: planet.cloudOmega * world.t, L: [...world.L] as V3, sun: rgbOf(world.star.color) };
  }

  return {
    top, bw, bh, res,
    /** Advance the rendering; draw the planet (world coordinates, under the camera's transform). */
    draw(ctx: CanvasRenderingContext2D, t: number) {
      if (!front) {
        front = mk();
        back = mk();
      }
      const jumped = Math.abs(t - lastT) > 3;
      if (jumped) {
        const snap = snapNow();
        const img = front.getContext('2d')!.createImageData(bw, bh);
        renderRows(img, 0, bh, snap);
        front.getContext('2d')!.putImageData(img, 0, 0);
        job = null;
        fadeT = -1;
      } else {
        if (!job && fadeT < 0) job = { img: back!.getContext('2d')!.createImageData(bw, bh), row: 0, snap: snapNow() };
        if (job) {
          const rows = Math.max(2, Math.ceil(bh / 45));
          const j1 = Math.min(bh, job.row + rows);
          renderRows(job.img, job.row, j1, job.snap);
          job.row = j1;
          if (j1 >= bh) {
            back!.getContext('2d')!.putImageData(job.img, 0, 0);
            job = null;
            fadeT = t;
          }
        }
      }
      lastT = t;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(front, 0, top, GW, bh / res);
      if (fadeT >= 0) {
        const k = Math.min(1, (t - fadeT) / 0.6);
        ctx.globalAlpha = k;
        ctx.drawImage(back!, 0, top, GW, bh / res);
        ctx.globalAlpha = 1;
        if (k >= 1) {
          const f = front;
          front = back;
          back = f;
          fadeT = -1;
        }
      }
    },
    /** Lambert at a world point on the disc (for overlays: is it night there?). */
    lightAt(x: number, y: number) {
      const nx = (x - cx) / R;
      const ny = (y - cy) / R;
      const rr = nx * nx + ny * ny;
      if (rr >= 1) return 1;
      const nz = Math.sqrt(1 - rr);
      return nx * world.L[0] + ny * world.L[1] + nz * world.L[2];
    },
  };
}
