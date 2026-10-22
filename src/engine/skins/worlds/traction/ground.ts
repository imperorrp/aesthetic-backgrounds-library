/**
 * The hunting ground, painted: the churned mud of the plain, and the far mountains with the
 * shield-wall along their feet.
 *
 * The mud is a height field (swells, the ruts of a thousand old tracks, clods, shell craters with
 * their lips, standing water in the bowls) lit per texel once, on the first paint, and stored in
 * rows of the picture: each row of the plain at its own depth and scale, one period of ground
 * long. Drawn, each row is laid down at its own scale and offset, so the plain slides past with
 * the camera, near mud fast and far mud slow, in true perspective. Then the hour's light is
 * multiplied over it and the haze of distance laid on.
 *
 * The far panorama (snow peaks, foothills, the shield-wall with its towers and gates, the static
 * settlements terraced on the slopes behind it) is a sprite of its own, one period long, sliding
 * slower than anything on the plain.
 */
import { clamp01, hexA, mix, mk, MOODS, sprite, type Env, type Sprite } from './light';
import type { TractionWorld } from './types';

const ih = (x: number, y: number, s: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
/** Value noise, periodic in x with period px lattice cells. */
export function vnoise(x: number, y: number, s: number, px = 1 << 20) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px;
  const x1 = (x0 + 1) % px;
  const a = ih(x0, yi, s);
  const b = ih(x1, yi, s);
  const c = ih(x0, yi + 1, s);
  const d = ih(x1, yi + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export type Ground = {
  P: number;
  draw(E: Env, scroll: number, x0: number, x1: number, y0: number, y1: number): void;
  /** The ridge's crest height (ground units) at gx. */
  ridgeH(gx: number): number;
  drawRidge(E: Env, scroll: number, x0: number, x1: number, behind: () => void): void;
  pan: Sprite;
  panP: number;
  drawPanorama(E: Env, scroll: number, x0: number, x1: number): void;
};

export function createGround(world: TractionWorld, seed: number): Ground {
  const { GW, GH, HY, NY, u } = world;
  const M0 = 0.13;
  const res = Math.min(0.55, Math.max(0.34, 760 / GW));
  const cell = 520 * u;
  const P = Math.max(4, Math.round((2.3 * GW) / cell)) * cell;
  const nCells = Math.round(P / cell);
  const rows = Math.ceil((GH - HY) * res) + 1;
  const kOfY = (y: number) => (y - HY) / (NY - HY);
  const mOfK = (k: number) => M0 + (1 - M0) * k;
  const Zs = (NY - HY) / ((1 - M0) * 0.34);
  const maxN = Math.ceil(P * mOfK(kOfY(GH + 4)) * res) + 6;
  const M = MOODS[world.mood];
  const [mudC, dryC, wetC] = M.mud;
  const rgb = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const MUD = rgb(mudC);
  const DRY = rgb(dryC);
  const WET = rgb(wetC);
  const GRASS = rgb(M.grass);
  const SKY = [184, 192, 202];
  const land = world.land;
  const STEPPE = [156, 140, 84];
  const SALT = [226, 220, 206];
  const SNOW = [228, 232, 238];
  const sunSide = world.sunSide;
  const Lx = sunSide * 0.62;
  const Ly = 0.6;
  const Lz = -0.18;
  const Ln = Math.hypot(Lx, Ly, Lz);

  // Old ruts: bundles of paired grooves that wander slowly across the plain.
  const ruts = Array.from({ length: 9 }, (_, i) => ({ z: Zs * (1.05 + ih(i, 1, seed) * 5.5), amp: (60 + ih(i, 2, seed) * 220) * u, w: (5 + ih(i, 3, seed) * 7) * u, gauge: (18 + ih(i, 4, seed) * 40) * u, f: 1 + Math.floor(ih(i, 5, seed) * 3), ph: ih(i, 6, seed) * 6.28, deep: 0.5 + ih(i, 7, seed) }));
  const craterAt = (cx: number, cz: number) => {
    const h = ih(cx, cz, seed + 77);
    if (h > 0.42) return null;
    return { x: (cx + 0.2 + ih(cx, cz, seed + 1) * 0.6) * cell, z: (cz + 0.2 + ih(cx, cz, seed + 2) * 0.6) * cell, r: (28 + ih(cx, cz, seed + 3) ** 2 * 150) * u, wet: ih(cx, cz, seed + 4) < 0.55 };
  };
  /** Height (ground units), wetness 0..1, and grass 0..1 at (gx, z). lod: the texel's size in ground units. */
  function field(gx: number, z: number, lod: number): [number, number, number] {
    const fade = (lam: number) => clamp01(lam / lod - 1.2);
    let h = (vnoise(gx / (700 * u), z / (700 * u), seed, P / (700 * u)) - 0.5) * 34 * u;
    h += (vnoise(gx / (180 * u), z / (180 * u), seed + 1, P / (180 * u)) - 0.5) * 12 * u * fade(180 * u);
    const f40 = fade(40 * u);
    if (f40 > 0) h += (vnoise(gx / (38 * u), z / (38 * u), seed + 2, Math.round(P / (38 * u))) - 0.5) * 5 * u * f40;
    const f12 = fade(12 * u);
    if (f12 > 0) h += (vnoise(gx / (11 * u), z / (11 * u), seed + 3, Math.round(P / (11 * u))) - 0.5) * 2.2 * u * f12;
    let wet = 0;
    // The ruts.
    for (const rt of ruts) {
      const zc = rt.z + Math.sin((gx / P) * Math.PI * 2 * rt.f + rt.ph) * rt.amp;
      const dz = Math.abs(z - zc);
      if (dz > rt.gauge + rt.w * 3) continue;
      const w = Math.max(rt.w, lod * 0.7);
      for (const side of [-1, 1]) {
        const q = (z - (zc + side * rt.gauge * 0.5)) / w;
        const g = Math.exp(-q * q);
        h -= g * 4.5 * u * rt.deep * Math.min(1, rt.w / w);
        h += Math.exp(-((Math.abs(q) - 1.4) ** 2) * 2) * 1.4 * u * Math.min(1, rt.w / w);
        wet = Math.max(wet, g * 0.8 * rt.deep);
      }
    }
    // Shell craters and bowls, with lips.
    const cx = Math.floor(gx / cell);
    const cz = Math.floor(z / cell);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        const kx = (((cx + ox) % nCells) + nCells) % nCells;
        const c = craterAt(kx, cz + oz);
        if (!c) continue;
        let dx = gx - c.x - (cx + ox - kx) * cell;
        dx = dx - Math.round(dx / P) * P;
        const dist = Math.hypot(dx, z - c.z) / c.r;
        if (dist > 1.8) continue;
        const bowl = dist < 1 ? -(1 - dist * dist) * c.r * 0.22 : 0;
        const lip = Math.exp(-((dist - 1.05) ** 2) * 14) * c.r * 0.07;
        h += bowl + lip;
        if (c.wet && dist < 0.62) wet = Math.max(wet, 1.2 - dist);
      }
    const grass = clamp01((vnoise(gx / (90 * u), z / (90 * u), seed + 9, Math.round(P / (90 * u))) - 0.6) * 4) * clamp01(h / (8 * u) + 0.5);
    return [h, wet, grass];
  }

  // ---- bake the plain ----------------------------------------------------------------------------
  let tex: HTMLCanvasElement | null = null;
  const rowN: number[] = [];
  const rowM: number[] = [];
  const rowY: number[] = [];
  function bake() {
    tex = mk(maxN + 4, rows);
    const g = tex.getContext('2d')!;
    const img = g.createImageData(maxN + 4, rows);
    const D = img.data;
    const W4 = (maxN + 4) * 4;
    const H = new Float32Array(maxN + 4);
    const HZ = new Float32Array(maxN + 4);
    const WT = new Float32Array(maxN + 4);
    const GR = new Float32Array(maxN + 4);
    for (let r = 0; r < rows; r++) {
      const y = HY + (r + 0.5) / res;
      const k = Math.max(0.0005, kOfY(y));
      const m = mOfK(k);
      const N = Math.max(8, Math.round(P * m * res));
      rowN[r] = N;
      rowM[r] = m;
      rowY[r] = y;
      const z = Zs / m;
      // A texel's footprint: across (ground units), and in depth (z per row).
      const lodX = P / N;
      const lodZ = Math.abs(Zs / mOfK(Math.max(0.0005, kOfY(y + 1 / res))) - z);
      const lod = Math.max(lodX, lodZ * 0.7);
      const e = Math.max(1.5 * u, lodZ * 0.5);
      for (let i = 0; i < N; i++) {
        const gx = ((i + 0.5) / N) * P;
        const f = field(gx, z, lod);
        H[i] = f[0];
        WT[i] = f[1];
        GR[i] = f[2];
        HZ[i] = field(gx, z + e, lod)[0];
      }
      for (let i = 0; i < N; i++) {
        const gx = ((i + 0.5) / N) * P;
        const h = H[i];
        const wet = WT[i];
        const grass = GR[i];
        const hx = (H[(i + 1) % N] - H[(i + N - 1) % N]) / (2 * lodX);
        const hz = (HZ[i] - h) / e;
        let nx = -hx;
        let nz = -hz;
        let ny = 1;
        const nn = Math.hypot(nx, ny, nz);
        nx /= nn;
        ny /= nn;
        nz /= nn;
        const diff = Math.max(0, (nx * Lx + ny * Ly + nz * Lz) / Ln);
        const shade = 0.42 + diff * 0.78 - clamp01(-h / (40 * u)) * 0.12;
        const dry = clamp01(0.5 + h / (16 * u) - wet * 0.8);
        const mott = vnoise(gx / (26 * u), z / (26 * u), seed + 5, Math.round(P / (26 * u)));
        let cr = WET[0] + (MUD[0] - WET[0]) * (1 - wet) + (DRY[0] - MUD[0]) * dry * (0.4 + mott * 0.6);
        let cg = WET[1] + (MUD[1] - WET[1]) * (1 - wet) + (DRY[1] - MUD[1]) * dry * (0.4 + mott * 0.6);
        let cb = WET[2] + (MUD[2] - WET[2]) * (1 - wet) + (DRY[2] - MUD[2]) * dry * (0.4 + mott * 0.6);
        cr += (GRASS[0] - cr) * grass * 0.7;
        cg += (GRASS[1] - cg) * grass * 0.7;
        cb += (GRASS[2] - cb) * grass * 0.7;
        if (land === 'steppe') {
          // Dry grass over most of it, tussocky; the ruts and the bowls bare.
          const tuft = vnoise(gx / (7 * u), z / (7 * u), seed + 11, Math.round(P / (7 * u)));
          const gr2 = clamp01(0.55 + grass * 1.5 + (mott - 0.5) * 0.8 - wet * 1.6) * (0.75 + tuft * 0.25);
          cr += (STEPPE[0] * (0.8 + tuft * 0.35) - cr) * gr2;
          cg += (STEPPE[1] * (0.8 + tuft * 0.35) - cg) * gr2;
          cb += (STEPPE[2] * (0.8 + tuft * 0.35) - cb) * gr2;
        } else if (land === 'salt') {
          // A salt crust, crazed into plates; the tracks break through it to the mud.
          const sk = clamp01(0.9 - wet * 1.3 + (mott - 0.5) * 0.3);
          cr += (SALT[0] - cr) * sk;
          cg += (SALT[1] - cg) * sk;
          cb += (SALT[2] - cb) * sk;
          const crack = Math.abs(vnoise(gx / (16 * u), z / (16 * u), seed + 12, Math.round(P / (16 * u))) - 0.5);
          if (lod < 12 * u && crack < 0.03) {
            cr *= 0.72;
            cg *= 0.72;
            cb *= 0.74;
          }
        } else if (land === 'snow') {
          // Snow lying on the high ground; the ruts, the bowls and the wet show through dark.
          const sn = clamp01(0.82 + h / (12 * u) - wet * 1.1 + (mott - 0.5) * 0.6);
          cr += (SNOW[0] - cr) * sn;
          cg += (SNOW[1] - cg) * sn;
          cb += (SNOW[2] - cb) * sn;
        }
        let R = cr * shade;
        let G = cg * shade;
        let B = cb * shade;
        // Standing water: the sky in it, a dark lip round it.
        if (wet > 0.75) {
          const wk = clamp01((wet - 0.75) * 5);
          const glint = 0.75 + 0.25 * vnoise(gx / (8 * u), z / (30 * u), seed + 6, Math.round(P / (8 * u)));
          R += (SKY[0] * glint * (0.62 + k * 0.1) - R) * wk;
          G += (SKY[1] * glint * (0.62 + k * 0.1) - G) * wk;
          B += (SKY[2] * glint * (0.62 + k * 0.1) - B) * wk;
        } else if (wet > 0.55) {
          R *= 0.72;
          G *= 0.72;
          B *= 0.74;
        }
        // Stones.
        if (lod < 10 * u && ih(Math.floor(gx / (3 * u)), Math.floor(z / (3 * u)), seed + 8) > 0.994) {
          R = R * 0.6 + 90;
          G = G * 0.6 + 86;
          B = B * 0.6 + 80;
        }
        const o = r * W4 + i * 4;
        D[o] = R;
        D[o + 1] = G;
        D[o + 2] = B;
        D[o + 3] = 255;
      }
      // Wrap a few texels past the end, so a row's copies meet without a seam.
      for (let i = 0; i < 4; i++) {
        const a = r * W4 + (N + i) * 4;
        const b = r * W4 + i * 4;
        D[a] = D[b];
        D[a + 1] = D[b + 1];
        D[a + 2] = D[b + 2];
        D[a + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  function bands(E: Env, scroll: number, x0: number, x1: number, y0: number, y1: number) {
    if (!tex) bake();
    const c = E.ctx;
    const T = tex!;
    const r0 = Math.max(0, Math.floor((y0 - HY) * res) - 1);
    const r1 = Math.min(rows - 1, Math.ceil((y1 - HY) * res) + 1);
    const h = 1 / res + 0.5;
    for (let r = r0; r <= r1; r++) {
      const m = rowM[r];
      const N = rowN[r];
      const Pw = P * m;
      const n = Math.floor((scroll + (x0 - GW / 2) / m) / P);
      let x = GW / 2 + (n * P - scroll) * m;
      const y = rowY[r] - 0.5 / res;
      while (x < x1) {
        c.drawImage(T, 0, r, N + 1, 1, x, y, Pw * ((N + 1) / N), h);
        x += Pw;
      }
    }
  }
  function lightAndHaze(E: Env, x0: number, x1: number, y0: number, y1: number) {
    const c = E.ctx;
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = E.L.amb;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.restore();
    const g = c.createLinearGradient(0, HY, 0, NY);
    for (let i = 0; i <= 8; i++) {
      const q = i / 8;
      const k = q * q;
      const d = 1 - Math.sqrt(k);
      const y = HY + k * (NY - HY);
      g.addColorStop(clamp01((y - HY) / (NY - HY)), hexA(E.hazeCol(d), E.hazeOf(d)));
    }
    c.fillStyle = g;
    c.fillRect(x0, Math.max(y0, HY), x1 - x0, Math.min(y1, NY) - Math.max(y0, HY));
  }

  // ---- the ridge --------------------------------------------------------------------------------------
  const ridgeH = (gx: number) => {
    const q = (gx / P) * Math.PI * 2;
    return (34 + 22 * Math.sin(q * 2 + seed) + 14 * Math.sin(q * 5 + seed * 0.3) + 9 * Math.sin(q * 11 + 1) + (vnoise(gx / (60 * u), 3, seed + 20, Math.round(P / (60 * u))) - 0.5) * 18) * u + 10 * u;
  };
  function drawRidge(E: Env, scroll: number, x0: number, x1: number, behind: () => void) {
    const c = E.ctx;
    const rd = world.ridgeD;
    const m = world.mOf(rd);
    const yb = world.yOf(rd);
    const foot = world.yOf(rd - 0.05);
    const path = new Path2D();
    path.moveTo(x0 - 4, foot + 2);
    let top = yb;
    for (let x = x0 - 4; x <= x1 + 8; x += 4) {
      const gx = scroll + (x - GW / 2) / m;
      const y = yb - ridgeH(gx) * m;
      top = Math.min(top, y);
      path.lineTo(x, y);
    }
    path.lineTo(x1 + 8, foot + 2);
    path.closePath();
    behind();
    c.save();
    c.clip(path);
    bands(E, scroll, x0, x1, top, foot + 2);
    lightAndHaze(E, x0, x1, top, foot + 2);
    // The bank toward us, a little darker at its foot; the crest catching the light.
    const g = c.createLinearGradient(0, top, 0, foot);
    g.addColorStop(0, hexA(E.L.sun, 0.1 * E.L.rim * (1 - E.night)));
    g.addColorStop(0.5, hexA(E.L.ink, 0.06));
    g.addColorStop(1, hexA(E.L.ink, 0.3));
    c.fillStyle = g;
    c.fillRect(x0, top, x1 - x0, foot - top + 2);
    c.restore();
    c.strokeStyle = hexA(mix(E.L.sun, E.hazeCol(rd), 0.5), 0.35 * E.L.rim + 0.05);
    c.lineWidth = Math.max(0.7, 1.2 * u);
    c.beginPath();
    for (let x = x0 - 4; x <= x1 + 8; x += 4) {
      const gx = scroll + (x - GW / 2) / m;
      const y = yb - ridgeH(gx) * m;
      if (x === x0 - 4) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }

  // ---- the far panorama: peaks, foothills, the shield-wall and the static towns ------------------------------
  const MP = 0.075;
  const panW = Math.round(GW * 1.6);
  const panP = panW / MP;
  const panH = Math.round(GH * 0.3);
  const pres = 1;
  const pan = sprite(panW * pres, panH * pres, 0, panH * pres, pres, true, true);
  let panBaked = false;
  function bakePanorama() {
    panBaked = true;
    const g = pan.g;
    const wg = pan.wg!;
    const rg = pan.rg!;
    const R = (k: number) => ih(k, 0, seed + 300);
    const per = (x: number) => ((x % panW) + panW) % panW;
    const ridge = (x: number, k: number, amp: number, sc: number) => {
      let v = 0;
      let a = 1;
      let f = 1;
      for (let o = 0; o < 5; o++) {
        v += (vnoise((x / panW) * sc * f, k * 7 + o, seed + 400 + k, Math.round(sc * f)) - 0.5) * a;
        a *= 0.5;
        f *= 2.1;
      }
      return (0.5 + v) * amp;
    };
    // Back range: snow peaks.
    const back = (x: number) => ridge(x, 1, panH * 0.95, 7) + panH * 0.08;
    g.fillStyle = '#8a94a4';
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= panW; x += 2) g.lineTo(x, -back(x));
    g.lineTo(panW, 0);
    g.fill();
    // Snow and the lit faces.
    for (let x = 0; x <= panW; x += 2) {
      const h = back(x);
      const s = back(per(x + 3)) - back(per(x - 3));
      const snow = h > panH * 0.5 ? (h - panH * 0.5) * 0.6 : 0;
      if (snow > 1) {
        g.fillStyle = s * world.sunSide < 0 ? '#e8ecf0' : '#b8c2d0';
        g.fillRect(x, -h, 2, snow * (0.6 + R(x) * 0.5));
      }
      rg.fillStyle = s * world.sunSide < 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
      rg.fillRect(x, -h, 2, 2);
    }
    // Front range: foothills, darker, with terraces.
    const front = (x: number) => ridge(x, 2, panH * 0.5, 13) + panH * 0.12;
    g.fillStyle = '#5a5e62';
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= panW; x += 2) g.lineTo(x, -front(x));
    g.lineTo(panW, 0);
    g.fill();
    g.strokeStyle = 'rgba(30,30,30,0.35)';
    g.lineWidth = 1;
    for (let k = 0; k < 240; k++) {
      const x = R(k + 10) * panW;
      const h = front(x);
      const y = -h * (0.2 + R(k + 20) * 0.7);
      g.beginPath();
      g.moveTo(x - 6 - R(k + 30) * 18, y);
      g.lineTo(x + 6 + R(k + 40) * 18, y + (R(k + 50) - 0.5) * 3);
      g.stroke();
    }
    // The static settlements on the slopes: houses in clusters, temples, a few lit windows.
    for (let k = 0; k < 70; k++) {
      const cx = R(k + 100) * panW;
      const h = front(cx);
      const cy = -h * (0.25 + R(k + 110) * 0.55);
      const n = 4 + Math.floor(R(k + 120) * 12);
      for (let q = 0; q < n; q++) {
        const x = cx + (R(k * 31 + q) - 0.5) * 50;
        const y = cy + (R(k * 37 + q) - 0.5) * 14;
        const w = 3 + R(k * 41 + q) * 4;
        const hh = 2 + R(k * 43 + q) * 4;
        g.fillStyle = R(k * 47 + q) < 0.5 ? '#c8bca8' : '#a89c8a';
        g.fillRect(x, y - hh, w, hh);
        g.fillStyle = '#6a4a3a';
        g.beginPath();
        g.moveTo(x - 1, y - hh);
        g.lineTo(x + w / 2, y - hh - 2.5);
        g.lineTo(x + w + 1, y - hh);
        g.fill();
        rg.fillStyle = 'rgba(255,255,255,0.35)';
        rg.fillRect(x - 1, y - hh - 1, w + 2, 1);
        if (R(k * 53 + q) < 0.45) {
          wg.fillStyle = R(k * 59 + q) < 0.5 ? '#ffcf8a' : '#ffb866';
          wg.fillRect(x + 1, y - hh * 0.6, 1, 1);
        }
      }
      if (R(k + 130) < 0.25) {
        // A temple with tiered roofs.
        const x = cx;
        const y = cy - 4;
        g.fillStyle = '#d8ccb4';
        g.fillRect(x - 3, y - 10, 6, 10);
        g.fillStyle = '#7a3a2a';
        for (let q = 0; q < 3; q++) {
          g.beginPath();
          g.moveTo(x - 7 + q * 1.5, y - 10 - q * 5);
          g.lineTo(x, y - 14 - q * 5);
          g.lineTo(x + 7 - q * 1.5, y - 10 - q * 5);
          g.fill();
        }
        wg.fillStyle = '#ffd79a';
        wg.fillRect(x - 1, y - 6, 2, 2);
      }
    }
    // The shield-wall along the feet of the hills: a long battlemented wall, towers, gun turrets, gates.
    const wallH = Math.max(10, panH * 0.09);
    const wallY = -panH * 0.03;
    g.fillStyle = '#7a746a';
    g.fillRect(0, wallY - wallH, panW, wallH + panH * 0.03 + 1);
    g.fillStyle = '#5a564e';
    g.fillRect(0, wallY - wallH * 0.35, panW, wallH * 0.35);
    rg.fillStyle = 'rgba(255,255,255,0.6)';
    rg.fillRect(0, wallY - wallH - 2, panW, 1.5);
    for (let x = 0; x < panW; x += 5) {
      g.fillStyle = '#7a746a';
      g.fillRect(x, wallY - wallH - 2.5, 2.5, 2.5);
    }
    g.strokeStyle = 'rgba(40,36,30,0.35)';
    for (let x = 0; x < panW; x += 9) {
      g.beginPath();
      g.moveTo(x + 0.5, wallY - wallH);
      g.lineTo(x + 0.5, wallY);
      g.stroke();
    }
    const nTow = Math.round(panW / 70);
    for (let k = 0; k < nTow; k++) {
      const x = (k + 0.3 + R(k + 200) * 0.4) * (panW / nTow);
      const big = R(k + 210) < 0.3;
      const tw = big ? 16 : 9;
      const th = wallH * (big ? 2.4 : 1.6);
      g.fillStyle = '#8a8478';
      g.fillRect(x - tw / 2, wallY - th, tw, th);
      g.fillStyle = '#5e5a52';
      g.fillRect(x + tw * 0.1, wallY - th, tw * 0.4, th);
      for (let q = 0; q < tw; q += 3) {
        g.fillStyle = '#8a8478';
        g.fillRect(x - tw / 2 + q, wallY - th - 2.5, 2, 2.5);
      }
      rg.fillStyle = 'rgba(255,255,255,0.7)';
      rg.fillRect(x - tw / 2, wallY - th - 3, tw, 1.2);
      // Lit loopholes and a beacon on top.
      wg.fillStyle = '#ffcf8a';
      for (let q = 0; q < 3; q++) wg.fillRect(x - 1, wallY - th + 3 + q * 4, 1.5, 1.5);
      if (big) {
        // A gun turret: a dome and a long barrel.
        g.fillStyle = '#4a4842';
        g.beginPath();
        g.arc(x, wallY - th - 2, 5, Math.PI, 0);
        g.fill();
        g.strokeStyle = '#3a3832';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(x, wallY - th - 4);
        g.lineTo(x + (R(k + 220) < 0.5 ? -1 : 1) * 14, wallY - th - 9);
        g.stroke();
        wg.fillStyle = '#ffe2a8';
        wg.fillRect(x - 0.7, wallY - th - 11, 1.4, 1.4);
      }
      if (R(k + 230) < 0.12) {
        // A great gate, arched and lit.
        g.fillStyle = '#2a2622';
        g.beginPath();
        g.moveTo(x + 14, wallY);
        g.lineTo(x + 14, wallY - wallH * 0.6);
        g.arc(x + 20, wallY - wallH * 0.6, 6, Math.PI, 0);
        g.lineTo(x + 26, wallY);
        g.fill();
        wg.fillStyle = 'rgba(255,190,110,0.8)';
        wg.fillRect(x + 16, wallY - wallH * 0.5, 8, wallH * 0.5);
      }
    }
  }
  function drawPanorama(E: Env, scroll: number, x0: number, x1: number) {
    if (!panBaked) bakePanorama();
    const c = E.ctx;
    const n = Math.floor((scroll + (x0 - GW / 2) / MP) / panP);
    let x = GW / 2 + (n * panP - scroll) * MP;
    const glowA = E.night * 0.85 + 0.05;
    while (x < x1) {
      c.drawImage(pan.tint, x, HY - panH + 1);
      if (E.L.rim > 0.05) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.6 * E.L.rim * (1 - E.night * 0.5) * (1 - E.hazeOf(0.8) * 0.6);
        c.drawImage(pan.rimT!, x, HY - panH + 1);
        c.globalAlpha = glowA * (1 - E.rain * 0.6);
        c.drawImage(pan.win!, x, HY - panH + 1);
        c.restore();
      }
      else if (glowA > 0.05) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = glowA;
        c.drawImage(pan.win!, x, HY - panH + 1);
        c.restore();
      }
      x += panW;
    }
  }

  return {
    P,
    draw(E, scroll, x0, x1, y0, y1) {
      bands(E, scroll, x0, x1, y0, y1);
      lightAndHaze(E, x0, x1, Math.max(y0, HY), y1);
    },
    ridgeH,
    drawRidge,
    pan,
    panP,
    drawPanorama,
  };
}
