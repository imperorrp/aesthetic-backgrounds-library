/**
 * The country, painted: five planes of depth, each cut into chunks along the way the castle walks
 * and painted once when it comes into view, per pixel (ridges lit by their slope, patchwork fields
 * with hedges, heather, rock and snow, brush texture, haze with distance), then the things that
 * stand on them drawn over (./props). Each chunk is painted in noon light and coloured by the hour
 * afterwards (multiplied by the light, then hazed), a plane at a time so neighbours always match.
 *
 * Also here, drawn live each frame: the water (lakes and the sea, with the far hills reflected,
 * the sun's path on it and ripples, boats on the sea), the lights of windows at night, windmill
 * sails, cottage smoke, the wind running through the grass, and the near grass blades that sway.
 */
import { clamp01, hash, midS, MIDS, n1, n2, NMID, PLANES, ridged, smoothstep, type PlaneId, type Region } from './land';
import * as P from './props';
import { goldenOf, hexRgb, mix, mk, rgba, sunPos, type Env, type RGB } from './sky';
import type { CastleWorld } from './types';

type Chunk = { plane: PlaneId; i: number; L0: number; base: HTMLCanvasElement; out: HTMLCanvasElement; stamp: RGB | null; hz: number; ink: P.Ink };
type Pal = { lit: RGB; base: RGB; shade: RGB; fields: RGB[]; hedge: RGB; fs: number; walls: boolean };

const SEASON: Record<CastleWorld['season'], [string, number]> = { spring: ['#86d65a', 0.14], summer: ['#6aa040', 0.0], late: ['#c8b45a', 0.2], autumn: ['#c88a44', 0.26] };

export function createScenery(world: CastleWorld, E: Env, res: number) {
  const { land, GW, GH, u, phone } = world;
  const { HY, GY } = land;
  const dir = world.castle.dir;
  const lxc = world.sunSide * dir;
  const pu = phone ? u * 1.5 : u;
  const S = land.seed;
  const PAD = 2;
  const CW = Math.round(380 * Math.max(0.55, u));
  const BAND: Record<PlaneId, [number, number]> = {
    back: [HY - GH * 0.33, HY + GH * 0.045],
    far: [HY - GH * 0.14, HY + GH * 0.13],
    m0: land.midBand(0),
    m1: land.midBand(1),
    m2: land.midBand(2),
    m3: land.midBand(3),
    m4: land.midBand(4),
    near: [GY - 240 * u - GH * 0.02, GH + 4],
    fore: [GH - GH * 0.26, GH + 4],
  };
  const HAZE: Record<PlaneId, number> = { back: 0.36, far: 0.26, m0: 0.2, m1: 0.15, m2: 0.1, m3: 0.06, m4: 0.04, near: 0.015, fore: 0 };
  const [stint, sk] = SEASON[world.season];
  const sea = (c: string) => hexRgb(mix(c, stint, sk));
  const raw = (c: string) => hexRgb(c);
  const pal = (lit: string, base: string, shade: string, fields: string[], hedge: string, fs: number, walls = false): Pal => ({ lit: sea(lit), base: sea(base), shade: sea(shade), fields: fields.map(sea), hedge: raw(hedge), fs, walls });
  const PALS: Record<Region, Pal> = {
    meadow: pal('#c0dc6e', '#7eb04a', '#3e6c38', ['#8cbc50', '#a6c860', '#dcc86c', '#c8b458', '#6a9c40', '#a08e5a', '#b4d06c', '#78aa48'], '#2e5232', 0.6),
    town: pal('#c0dc6e', '#7eb04a', '#3e6c38', ['#8cbc50', '#a6c860', '#dcc86c', '#6a9c40', '#b4d06c'], '#2e5232', 0.55),
    moor: pal('#c4bc78', '#8c8a54', '#4a4a3a', ['#8a6c72', '#9c7c4c', '#7c8248', '#a48c5c', '#76705e', '#946a6a'], '#8a8476', 0.5, true),
    lake: pal('#b4d46c', '#6ca04a', '#34603a', ['#7cac4c', '#8eb658', '#5c8c42'], '#2e4c34', 0.28),
    coast: pal('#c8dc80', '#8cb458', '#4a7242', ['#9cc262', '#bccc74', '#d8d2a4', '#88ae54'], '#5c6c4a', 0.35, true),
    mountain: pal('#b0c478', '#6e9052', '#3a5038', ['#6c8c4c', '#7c9c5a', '#8c8c72'], '#6a6a62', 0.2),
    flowers: pal('#c6e074', '#8aba50', '#46723c', ['#f2d246', '#f6f2ea', '#ea92b4', '#aa8ad8', '#e44a3a', '#8aba50', '#f2a444', '#f6f2ea'], '#3a6236', 0.85),
  };
  const HAZE_RGB = raw('#b8cee4');
  const LEAF: Record<CastleWorld['season'], [string, string, string]> = {
    spring: ['#2e5a2e', '#4e8c3c', '#88c45a'],
    summer: ['#24482a', '#3e7234', '#6ea24a'],
    late: ['#2e4a28', '#527436', '#94a850'],
    autumn: ['#5a3a22', '#a8642e', '#e0a04a'],
  };
  const leaf = LEAF[world.season];
  const leafAlt: [string, string, string] = world.season === 'autumn' ? ['#3a4a28', '#6a7a3a', '#a8a850'] : ['#2a4434', '#3e6448', '#6a9268'];
  const pineLeaf: [string, string, string] = ['#1e3430', '#2c4a3e', '#4e7060'];

  // ---- the shapes the planes need -------------------------------------------------------------------
  const foreTop = (L: number) => GH - GH * 0.05 - n1(L / (240 * pu), S + 70) * GH * 0.04 - n1(L / (70 * pu), S + 71) * GH * 0.012;
  const regionPick = (Xc: number, h: number): Region => {
    const g = land.regionAt(Xc);
    return h < g.k ? g.b : g.a;
  };

  // ---- the rasteriser ---------------------------------------------------------------------------------
  let scratch: HTMLCanvasElement | null = null;
  let img: ImageData | null = null;
  const ramp = (p: Pal, l: number, o: RGB) => {
    if (l < 0.5) {
      const k = Math.max(0, l * 2);
      o[0] = p.shade[0] + (p.base[0] - p.shade[0]) * k;
      o[1] = p.shade[1] + (p.base[1] - p.shade[1]) * k;
      o[2] = p.shade[2] + (p.base[2] - p.shade[2]) * k;
    } else {
      const k = Math.min(1.2, (l - 0.5) * 2);
      o[0] = p.base[0] + (p.lit[0] - p.base[0]) * k;
      o[1] = p.base[1] + (p.lit[1] - p.base[1]) * k;
      o[2] = p.base[2] + (p.lit[2] - p.base[2]) * k;
    }
  };
  const mixInto = (o: RGB, c: RGB, k: number) => {
    o[0] += (c[0] - o[0]) * k;
    o[1] += (c[1] - o[1]) * k;
    o[2] += (c[2] - o[2]) * k;
  };
  /** One ridge into a chunk: every pixel from its top (anti-aliased) down to its bottom or just under the ridge in front. */
  function raster(base: HTMLCanvasElement, top: number, T: Float32Array, B: Float32Array, F: Float32Array | null, shade: (cx: number, y: number, dy: number, o: RGB) => void) {
    const cols = base.width;
    const rows = base.height;
    if (!scratch || scratch.width !== cols || scratch.height !== rows) {
      scratch = mk(cols, rows);
      img = scratch.getContext('2d')!.createImageData(cols, rows);
    }
    const d = img!.data;
    d.fill(0);
    const o: RGB = [0, 0, 0];
    for (let cx = 0; cx < cols; cx++) {
      const t = T[cx + 1];
      const b = B[cx + 1];
      const f = F ? F[cx + 1] + 3 / res : Infinity;
      const yEnd = Math.min(b, f);
      const py0 = Math.max(0, Math.floor((t - top) * res));
      const py1 = Math.min(rows, Math.ceil((yEnd - top) * res));
      for (let py = py0; py < py1; py++) {
        const y0 = top + py / res;
        const a = Math.min(clamp01((y0 + 1 / res - t) * res), clamp01((b - y0) * res));
        if (a <= 0) continue;
        const y = y0 + 0.5 / res;
        shade(cx, y, Math.max(0, y - t), o);
        const i = (py * cols + cx) * 4;
        d[i] = o[0];
        d[i + 1] = o[1];
        d[i + 2] = o[2];
        d[i + 3] = a * 255;
      }
    }
    scratch.getContext('2d')!.putImageData(img!, 0, 0);
    base.getContext('2d')!.drawImage(scratch, 0, 0);
  }
  const colsOf = (c: Chunk) => c.base.width;
  const Lof = (c: Chunk, cx: number) => c.L0 + (cx - PAD + 0.5) / res;
  /** A plane function sampled for every column (and one more each side, for slopes). */
  const sample = (c: Chunk, f: (L: number) => number) => {
    const n = colsOf(c);
    const a = new Float32Array(n + 2);
    for (let cx = -1; cx <= n; cx++) a[cx + 1] = f(Lof(c, cx));
    return a;
  };
  const facing = (T: Float32Array, k = 2.4) => {
    const n = T.length;
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = (T[Math.min(n - 1, i + 1)] - T[Math.max(0, i - 1)]) * res * 0.5;
      f[i] = Math.tanh(s * lxc * k);
    }
    return f;
  };
  type Col = { L: number; pa: Pal; pb: Pal; k: number; ra: Region; rb: Region };
  const colInfo = (c: Chunk, s: number): Col[] => {
    const out: Col[] = [];
    for (let cx = -1; cx <= colsOf(c); cx++) {
      const L = Lof(c, cx);
      const g = land.regionAt(L / s);
      out.push({ L, pa: PALS[g.a], pb: PALS[g.b], k: g.k, ra: g.a, rb: g.b });
    }
    return out;
  };
  const weight = (ci: Col, r: Region) => (ci.ra === r ? 1 - ci.k : 0) + (ci.rb === r ? ci.k : 0);
  const tmpA: RGB = [0, 0, 0];
  const tmpB: RGB = [0, 0, 0];
  /** The colour of grass at a light, blended across a region's border. */
  const grass = (ci: Col, l: number, o: RGB) => {
    ramp(ci.pa, l, o);
    if (ci.k > 0.002) {
      ramp(ci.pb, l, tmpB);
      mixInto(o, tmpB, ci.k);
    }
  };

  // ---- the planes -------------------------------------------------------------------------------------
  const ROCK = raw('#8c887c');
  const ROCKLIT = raw('#c4beae');
  const SNOW = raw('#f6f8fc');
  const SNOWSH = raw('#a8b8d4');
  const SAND = raw('#e0d0a4');
  const HEATHER = raw('#8a5a74');
  const BRACKEN = raw('#a8743e');
  const PATH = raw('#bca47c');
  const RUT = raw('#8a7456');
  const FOREST = raw('#3a5a4a');

  function paintBack(c: Chunk) {
    const [top] = BAND.back;
    const T0 = sample(c, (L) => land.backTop(0, L));
    const T1 = sample(c, (L) => land.backTop(1, L));
    const INF = new Float32Array(T0.length).fill(Infinity);
    const F0 = facing(T0, 1.6);
    const F1 = facing(T1, 1.6);
    const snowLine = HY - GH * 0.1;
    const peakBase = raw('#7a86a0');
    const peakLit = raw('#c4cede');
    const peakSh = raw('#4a5674');
    raster(c.base, top, T0, INF, T1, (cx, y, dy, o) => {
      const L = Lof(c, cx);
      const f = F0[cx + 1];
      // Spurs and gullies: a fold field that drifts sideways with depth, so the folds run down from each summit.
      const drift = (n1(L / (160 * pu), S + 5) - 0.5) * 2.4;
      const q = (L + dy * drift) / (150 * pu);
      const e = 0.06;
      const h0 = ridged(q, S + 6);
      const h1 = ridged(q + e, S + 6);
      const ff = Math.tanh(((h1 - h0) / e) * -lxc * 1.1);
      const gully = smoothstep(0.55, 0.25, h0);
      const tex = n2(L / (7 * pu), y / (3 * pu), S + 1) - 0.5;
      const lit = 0.5 + f * 0.25 + ff * 0.32 - gully * 0.18 + tex * 0.1 - smoothstep(0, 160 * u, dy) * 0.12;
      const k = clamp01(lit);
      o[0] = peakSh[0] + (peakLit[0] - peakSh[0]) * k;
      o[1] = peakSh[1] + (peakLit[1] - peakSh[1]) * k;
      o[2] = peakSh[2] + (peakLit[2] - peakSh[2]) * k;
      mixInto(o, peakBase, 0.15);
      // Snow above the line: thick on the lit faces, thinning down the gullies in streaks.
      const sl = snowLine + (n2(L / (34 * pu), y / (20 * pu), S + 2) - 0.5) * GH * 0.05 + (ff > 0 ? GH * 0.02 : -GH * 0.01) - gully * GH * 0.03;
      if (y < sl + 10 * u) {
        const sn = smoothstep(sl + 8 * u, sl - 4 * u, y) * (1 - gully * 0.55) * (0.7 + 0.3 * smoothstep(0.3, 0.6, n2(L / (4 * pu), y / (12 * pu), S + 3)));
        const sk2 = clamp01(0.45 + ff * 0.5 + f * 0.2);
        tmpA[0] = SNOWSH[0] + (SNOW[0] - SNOWSH[0]) * sk2;
        tmpA[1] = SNOWSH[1] + (SNOW[1] - SNOWSH[1]) * sk2;
        tmpA[2] = SNOWSH[2] + (SNOW[2] - SNOWSH[2]) * sk2;
        mixInto(o, tmpA, sn);
      }
      mixInto(o, HAZE_RGB, 0.18 + smoothstep(HY - GH * 0.1, HY + GH * 0.02, y) * 0.4);
    });
    const r0 = raw('#5c7a8a');
    const r1 = raw('#8aa6b0');
    raster(c.base, top, T1, INF, null, (cx, y, dy, o) => {
      const L = Lof(c, cx);
      const f = F1[cx + 1];
      const tex = n2(L / (12 * pu), y / (6 * pu), S + 4) - 0.5;
      const k = clamp01(0.45 + f * 0.35 + tex * 0.25 + Math.exp(-dy / (8 * u)) * 0.2);
      o[0] = r0[0] + (r1[0] - r0[0]) * k;
      o[1] = r0[1] + (r1[1] - r0[1]) * k;
      o[2] = r0[2] + (r1[2] - r0[2]) * k;
      mixInto(o, HAZE_RGB, 0.3 + smoothstep(0, 30 * u, dy) * 0.25);
    });
  }

  function paintFar(c: Chunk) {
    const [top] = BAND.far;
    const T0 = sample(c, (L) => land.farTop(0, L));
    const T1 = sample(c, (L) => land.farTop(1, L));
    const INF = new Float32Array(T0.length).fill(Infinity);
    const Fs = [facing(T0, 2), facing(T1, 2)];
    const p = PALS.meadow;
    const ridge = (k: number) => (cx: number, y: number, dy: number, o: RGB) => {
      const L = Lof(c, cx);
      const f = Fs[k][cx + 1];
      const tex = n2(L / (7 * pu), y / (3 * pu), S + 10 + k) - 0.5;
      ramp(p, 0.46 + f * 0.3 + tex * 0.18 + Math.exp(-dy / (6 * u)) * 0.2 - smoothstep(0, 40 * u, dy) * 0.15, o);
      const fo = n2(L / (26 * pu), y / (10 * pu), S + 12 + k);
      if (fo > 0.56) mixInto(o, FOREST, smoothstep(0.56, 0.62, fo) * 0.8);
      else if (fo < 0.3) mixInto(o, p.fields[Math.floor(hash(Math.floor(L / (30 * pu)), Math.floor(dy / (6 * pu)), S) * 4)], 0.4);
      mixInto(o, HAZE_RGB, k ? 0.3 : 0.44);
    };
    raster(c.base, top, T0, INF, T1, ridge(0));
    raster(c.base, top, T1, INF, null, ridge(1));
    // Woods on the crests, villages, and the far towns.
    const g = c.base.getContext('2d')!;
    const hz = (col: string, k: number) => mix(col, '#b8cee4', k);
    const L0 = c.L0 - 40 * pu;
    const L1 = c.L0 + CW + 40 * pu;
    const cw = 9 * pu;
    for (let i = Math.floor(L0 / cw); i <= Math.ceil(L1 / cw); i++) {
      const h = hash(i, 11, S);
      const L = (i + hash(i, 12, S)) * cw;
      const k = h < 0.5 ? 1 : 0;
      const t = land.farTop(k, L);
      if (k === 0 && land.farTop(1, L) < t + 2 * u) continue;
      const fo = n2(L / (26 * pu), (t + 4 * u) / (10 * pu), S + 12 + k);
      if (fo < 0.5 && hash(i, 13, S) > 0.15) continue;
      const x = (L - c.L0) * res + PAD;
      const s = (k ? 5 : 3.6) * pu * (0.7 + hash(i, 14, S) * 0.6);
      g.fillStyle = hz(leafAlt[0], k ? 0.42 : 0.55);
      g.beginPath();
      g.ellipse(x, (t - top + s * 0.25) * res, s * res * 0.6, s * res * 0.55, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hz(leafAlt[2], k ? 0.45 : 0.58);
      g.beginPath();
      g.ellipse(x + lxc * s * res * 0.2, (t - top) * res, s * res * 0.3, s * res * 0.3, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.save();
    g.scale(res, res);
    g.translate(-c.L0 + PAD / res, -top);
    for (const tw of land.farTownsIn(L0, L1)) {
      const y = land.farTop(1, tw.L);
      const n = Math.round(6 + tw.size * 8);
      for (let q = 0; q < n; q++) {
        const hx = tw.L + (hash(tw.seed, q) - 0.5) * 60 * pu * tw.size;
        const hy = land.farTop(1, hx) + 1 * pu + Math.abs(hx - tw.L) * 0.04;
        const w = (3 + hash(tw.seed, q, 1) * 2.4) * pu;
        P.house(g, hx - w / 2, hy, w, lxc, tw.seed + q, { wall: hz(['#e0d4bc', '#d8c8a8', '#c8c0b0'][q % 3], 0.35), roof: hz(['#a85a44', '#7a6458', '#5a6070'][q % 3], 0.35), tall: 1.2, steep: 1.2 }, q % 2 ? c.ink : null);
      }
      // The spire, and the town's wall.
      const sw = 3 * pu;
      g.fillStyle = hz('#c8c0b0', 0.35);
      g.fillRect(tw.L - sw / 2, y - 16 * pu * tw.size, sw, 16 * pu * tw.size);
      g.fillStyle = hz('#5a6070', 0.3);
      g.beginPath();
      g.moveTo(tw.L - sw * 0.7, y - 16 * pu * tw.size);
      g.lineTo(tw.L, y - 28 * pu * tw.size);
      g.lineTo(tw.L + sw * 0.7, y - 16 * pu * tw.size);
      g.fill();
    }
    g.restore();
  }

  type MidProp = { kind: string; L: number; dy: number; s: number; seed: number; style?: P.HouseStyle };
  const SZ = MIDS.map((_, k) => Math.pow(midS(k) / 0.22, 0.85));
  function midProps(k: number, L0: number, L1: number): MidProp[] {
    const out: MidProp[] = [];
    const sz = SZ[k];
    const sk = midS(k);
    const cw = 15 * pu * sz;
    const WALLS = ['#ece4d0', '#e6d8bc', '#d8ccb8', '#f0e8dc', '#cfc2a8'];
    const ROOF = ['#b0563e', '#8a5a44', '#5c6270', '#a86c48', '#6c4a3e'];
    const BRIGHT = ['#f0e4cc', '#e8c8a8', '#c8d8e0', '#f2dcc0', '#e0b8a0', '#d8e0c8'];
    const front = k >= NMID - 2;
    for (let i = Math.floor(L0 / cw); i <= Math.ceil(L1 / cw); i++) {
      const L = (i + hash(i, 32 + k * 9, S)) * cw;
      const Xc = L / sk;
      const rg = regionPick(Xc, hash(i, 33 + k * 9, S));
      const seed = Math.floor(hash(i, 34 + k * 9, S) * 1e6);
      const dy = hash(i, 35 + k * 9, S);
      const seg = land.route[land.segAt(Xc)];
      const centre = seg ? Math.abs(Xc - (seg.x0 + seg.x1) / 2) / ((seg.x1 - seg.x0) / 2) : 1;
      const pr = hash(i, 36 + k * 9, S);
      const big = hash(i, 37 + k * 9, S);
      const push = (kind: string, size: number, extra: Partial<MidProp> = {}) => out.push({ kind, L, dy, s: size * sz * pu, seed, ...extra });
      if (front && (rg === 'town' || rg === 'coast') && seg && seg.region === rg && centre < (rg === 'coast' ? 0.38 : 0.45)) {
        // The town: houses packed up its hill, steep roofs; a church at the heart.
        const steep = rg === 'coast' ? 1.75 : 1.4;
        const n = centre < 0.22 ? 3 : 2;
        for (let q = 0; q < n; q++)
          out.push({ kind: 'house', L: L + (q - 1) * cw * 0.33, dy: 0.05 + q * 0.3 + hash(i, 40 + q, S) * 0.15, s: (7 + hash(i, 50 + q, S) * 3.5) * pu * sz, seed: seed + q, style: { wall: (rg === 'coast' ? BRIGHT : WALLS)[Math.floor(hash(i, 60 + q, S) * 5)], roof: ROOF[Math.floor(hash(i, 70 + q, S) * 5)], tall: 1.35 + hash(i, 80 + q, S) * 0.5, steep, timber: rg === 'town' && hash(i, 90 + q, S) < 0.4 } });
        if (k === NMID - 2 && centre < 0.02) out.push({ kind: 'church', L, dy: 0.02, s: 10 * pu * sz, seed });
        continue;
      }
      if (rg === 'coast' && k === NMID - 1 && seg && Math.abs(centre - 0.62) < 0.03 && pr < 0.6) {
        out.push({ kind: 'lighthouse', L, dy: 0.02, s: 22 * pu * sz, seed });
        continue;
      }
      switch (rg) {
        case 'meadow':
        case 'town':
          if (pr < 0.26) push('tree', 11 + big * 9);
          else if (pr < 0.31) push('poplar', 18 + big * 9);
          else if (pr < 0.33) push('house', 8, { style: { wall: WALLS[seed % 5], roof: ROOF[seed % 5], tall: 1, steep: 1 } });
          else if (pr < 0.355) push('hay', 4.5);
          else if (pr < 0.359) push('windmill', 20);
          else if (pr < 0.361) push('church', 9);
          break;
        case 'moor':
          if (pr < 0.05) push('tor', 14 + big * 10);
          else if (pr < 0.1) push('tree2', 8 + big * 6);
          else if (pr < 0.11) push('house', 7, { style: { wall: '#b8b0a0', roof: '#5c5a58', tall: 0.9, steep: 0.9 } });
          break;
        case 'lake':
          if (pr < 0.42) push('pine', 15 + big * 12);
          else if (pr < 0.52) push('tree', 11 + big * 8);
          else if (pr < 0.525) push('house', 7, { style: { wall: '#e8dcc4', roof: '#6c4a3e', tall: 0.9, steep: 1 } });
          break;
        case 'coast':
          if (pr < 0.08) push('tree2', 9);
          else if (pr < 0.11) push('house', 7, { style: { wall: '#f0ece0', roof: '#5c6270', tall: 0.9, steep: 1 } });
          break;
        case 'mountain':
          if (pr < 0.5) push('pine', 15 + big * 14);
          else if (pr < 0.58) push('boulder', 5 + big * 6);
          break;
        case 'flowers':
          if (pr < 0.1) push('tree', 11 + big * 8);
          else if (pr < 0.115) push('house', 8, { style: { wall: '#f0e8dc', roof: '#b0563e', tall: 1, steep: 1.1 } });
          else if (pr < 0.12) push('windmill', 20);
          break;
      }
    }
    return out;
  }

  const MHAZE = [0.24, 0.17, 0.11, 0.06, 0.025];
  const MFIELD = [0.45, 0.65, 0.85, 1, 1];
  function paintMid(c: Chunk, k: number) {
    const [top] = BAND[MIDS[k]];
    const sz = SZ[k];
    const R = sample(c, (L) => land.midRidge(k, L)[0]);
    const B = sample(c, (L) => land.midRidge(k, L)[1]);
    const F = facing(R, 2.2);
    const ci = colInfo(c, midS(k));
    const g = c.base.getContext('2d')!;
    const hz = MHAZE[k];
    const depth = 60 * pu * sz;
    raster(c.base, top, R, B, null, (cx, y, dy, o) => {
      const info = ci[cx + 1];
      const L = info.L;
      const f = F[cx + 1];
      const brush = n2(L / (4.5 * pu * sz), y / (1.6 * pu * sz), S + 20 + k) - 0.5;
      const mott = n2(L / (34 * pu * sz), y / (18 * pu * sz), S + 23 + k) - 0.5;
      const l = 0.5 + 0.3 * f + 0.22 * Math.exp(-dy / (8 * pu * sz)) - 0.32 * smoothstep(0, depth, dy) + brush * 0.14 + mott * 0.12;
      grass(info, l, o);
      // The patchwork: fields in rows that open out down the slope, hedges (or walls) between.
      const fs = (info.pa.fs * (1 - info.k) + info.pb.fs * info.k) * MFIELD[k];
      if (fs > 0.02 && dy > 1.5 * pu) {
        const v = Math.sqrt(dy / (2.6 * pu * sz)) + (n1(L / (80 * pu * sz), S + 30 + k) - 0.5) * 1.4;
        const row = Math.floor(v);
        const fw = (24 + hash(row, k, S + 31) * 40) * pu * sz * (0.6 + Math.min(1.4, dy / depth));
        const Lw = L + hash(row, k, S + 32) * 400 * pu + Math.sin(row * 1.7 + L / (200 * pu)) * 6 * pu * sz;
        const col = Math.floor(Lw / fw);
        const fx = Lw / fw - col;
        const fy = v - row;
        const rowH = Math.max(0.5, v * 2.6 * pu * sz);
        const hw = 0.7 / res + 0.3 * pu * sz;
        const p = hash(col, row, S + 33 + k) < info.k ? info.pb : info.pa;
        const fc = p.fields[Math.floor(hash(col, row, S + 34 + k) * p.fields.length)];
        const lf = 0.62 + 0.5 * l;
        tmpA[0] = fc[0] * lf;
        tmpA[1] = fc[1] * lf;
        tmpA[2] = fc[2] * lf;
        mixInto(o, tmpA, fs * (0.65 + 0.35 * smoothstep(0.2, 0.5, hash(col, row, S + 35))));
        const edge = Math.min(fx, 1 - fx) * fw < hw || Math.min(fy, 1 - fy) * rowH < hw;
        if (edge && hash(col, row, S + 36) < 0.9) {
          const hl = p.walls ? 0.8 + 0.4 * l : 0.7 + 0.5 * l;
          tmpA[0] = Math.min(255, p.hedge[0] * hl);
          tmpA[1] = Math.min(255, p.hedge[1] * hl);
          tmpA[2] = Math.min(255, p.hedge[2] * hl);
          mixInto(o, tmpA, Math.min(1, fs * 1.6) * 0.85);
        }
      }
      const mw = weight(info, 'mountain');
      if (mw > 0) {
        const rk = n2(L / (20 * pu * sz), y / (14 * pu * sz), S + 40 + k);
        const rr = smoothstep(0.55, 0.65, rk + Math.abs(f) * 0.3) * mw;
        if (rr > 0) {
          const rl = clamp01(0.4 + f * 0.5 + brush * 0.3);
          tmpA[0] = ROCK[0] + (ROCKLIT[0] - ROCK[0]) * rl;
          tmpA[1] = ROCK[1] + (ROCKLIT[1] - ROCK[1]) * rl;
          tmpA[2] = ROCK[2] + (ROCKLIT[2] - ROCK[2]) * rl;
          mixInto(o, tmpA, rr);
        }
        if (k < 2 && R[cx + 1] < HY - GH * 0.08 && dy < 22 * pu * sz * (0.5 + rk)) mixInto(o, f > 0 ? SNOW : SNOWSH, mw * 0.9);
      }
      const hw2 = weight(info, 'moor');
      if (hw2 > 0) {
        const hv = n2(L / (16 * pu * sz), y / (8 * pu * sz), S + 44 + k);
        if (hv > 0.55) mixInto(o, hv > 0.7 ? BRACKEN : HEATHER, smoothstep(0.55, 0.62, hv) * hw2 * 0.6);
      }
      const bot = B[cx + 1];
      if (bot < Infinity && bot - y < 1.8 * pu * sz) mixInto(o, SAND, 0.85);
      mixInto(o, HAZE_RGB, hz);
    });
    g.save();
    g.scale(res, res);
    g.translate(-c.L0 + PAD / res, -top);
    for (const p of midProps(k, c.L0 - 50 * pu * sz, c.L0 + CW + 50 * pu * sz).sort((a, b) => a.dy - b.dy)) drawMidProp(g, p, k, c);
    g.restore();
  }
  function drawMidProp(g: CanvasRenderingContext2D, p: MidProp, k: number, c: Chunk) {
    const [t, b] = land.midRidge(k, p.L);
    if (t >= b - 2 * pu) return;
    const y = t + 1.2 * pu * SZ[k] + p.dy * Math.min(b - t - 2 * pu, 26 * pu * SZ[k]);
    const hz = MHAZE[k] + 0.02;
    const H = (col: string) => mix(col, '#b8cee4', hz);
    const L3 = (a: [string, string, string]): [string, string, string] => [H(a[0]), H(a[1]), H(a[2])];
    switch (p.kind) {
      case 'tree': P.treeClump(g, p.L, y, p.s, lxc, p.seed, L3(p.seed % 4 === 0 ? leafAlt : leaf)); break;
      case 'tree2': P.treeClump(g, p.L, y, p.s, lxc, p.seed, L3(leafAlt), { tall: 0.8 }); break;
      case 'poplar': P.poplar(g, p.L, y, p.s, lxc, p.seed, L3(leaf)); break;
      case 'pine': P.pine(g, p.L, y, p.s, lxc, p.seed, L3(pineLeaf)); break;
      case 'house': P.house(g, p.L - p.s / 2, y, p.s, lxc, p.seed, { ...p.style!, wall: H(p.style!.wall), roof: H(p.style!.roof) }, c.ink); break;
      case 'church': P.church(g, p.L - p.s / 2, y, p.s, lxc, p.seed, c.ink); break;
      case 'windmill': P.windmill(g, p.L, y, p.s, lxc, c.ink); break;
      case 'hay': P.haystack(g, p.L, y, p.s, lxc); break;
      case 'tor': P.tor(g, p.L, y, p.s, lxc, p.seed); break;
      case 'boulder': P.boulder(g, p.L, y, p.s, lxc, p.seed); break;
      case 'lighthouse': P.lighthouse(g, p.L, y, p.s, lxc, c.ink); break;
    }
  }

  function paintNear(c: Chunk) {
    const [top] = BAND.near;
    const T = sample(c, (L) => land.nearY(L));
    const INF = new Float32Array(T.length).fill(Infinity);
    const Fc = facing(T, 3);
    const ci = colInfo(c, 1);
    raster(c.base, top, T, INF, null, (cx, y, dz, o) => {
      const info = ci[cx + 1];
      const L = info.L;
      const f = Fc[cx + 1];
      const blade = n2(L / (1.5 * pu), y / (6 * pu), S + 50) - 0.5;
      const clump = n2(L / (12 * pu), y / (8 * pu), S + 51) - 0.5;
      const mott = n2(L / (70 * pu), y / (40 * pu), S + 52) - 0.5;
      const l = 0.56 + 0.26 * f + 0.24 * Math.exp(-dz / (7 * pu)) - 0.2 * smoothstep(0, 260 * pu, dz) + blade * 0.24 + clump * 0.16 + mott * 0.12;
      grass(info, l, o);
      o[0] += mott * 18;
      o[2] -= mott * 10;
      const mw = weight(info, 'moor');
      if (mw > 0) {
        const hv = n2(L / (40 * pu), y / (22 * pu), S + 53);
        if (hv > 0.5) {
          tmpA[0] = HEATHER[0] * (0.7 + l * 0.5);
          tmpA[1] = HEATHER[1] * (0.7 + l * 0.5);
          tmpA[2] = HEATHER[2] * (0.7 + l * 0.5);
          mixInto(o, tmpA, smoothstep(0.5, 0.58, hv) * mw * 0.7);
        }
      }
      const rw = weight(info, 'mountain');
      if (rw > 0) {
        const rk = n2(L / (30 * pu), y / (24 * pu), S + 54);
        if (rk > 0.6) {
          const rl = clamp01(0.4 + f * 0.4 + blade * 0.4 + Math.exp(-(rk - 0.6) * 20) * -0.2);
          tmpA[0] = ROCK[0] + (ROCKLIT[0] - ROCK[0]) * rl;
          tmpA[1] = ROCK[1] + (ROCKLIT[1] - ROCK[1]) * rl;
          tmpA[2] = ROCK[2] + (ROCKLIT[2] - ROCK[2]) * rl;
          mixInto(o, tmpA, smoothstep(0.6, 0.64, rk) * rw);
        }
      }
      const fw = weight(info, 'flowers');
      if (fw > 0) {
        const fv = n2(L / (80 * pu), y / (20 * pu), S + 55);
        const band = Math.floor(fv * 6);
        const fc = PALS.flowers.fields[(band + Math.floor(L / (900 * pu))) % PALS.flowers.fields.length];
        const sp = n2(L / (1.8 * pu), y / (1.6 * pu), S + 56);
        tmpA[0] = fc[0] * (0.7 + l * 0.4);
        tmpA[1] = fc[1] * (0.7 + l * 0.4);
        tmpA[2] = fc[2] * (0.7 + l * 0.4);
        mixInto(o, tmpA, fw * smoothstep(0.35, 0.7, sp) * 0.8 * smoothstep(0, 8 * pu, dz));
      }
      // The cart track along the hillside.
      const tw = (weight(info, 'meadow') + weight(info, 'town') + weight(info, 'flowers') + weight(info, 'coast')) * 0.9;
      if (tw > 0) {
        const py = GH * (0.085 + 0.03 * Math.sin(L / (700 * pu))) + (n1(L / (240 * pu), S + 57) - 0.5) * 20 * pu;
        const wdt = 9 * pu * (1 + py / (GH * 0.1));
        const dd = Math.abs(dz - py);
        if (dd < wdt) {
          const edge = 1 - smoothstep(wdt * 0.6, wdt, dd);
          tmpA[0] = PATH[0] * (0.8 + l * 0.3);
          tmpA[1] = PATH[1] * (0.8 + l * 0.3);
          tmpA[2] = PATH[2] * (0.8 + l * 0.3);
          mixInto(o, tmpA, edge * tw * (0.75 + blade * 0.4));
          if (Math.abs(dd - wdt * 0.45) < 1.2 * pu) mixInto(o, RUT, 0.4 * tw);
        }
      }
      mixInto(o, HAZE_RGB, 0.04 * (1 - smoothstep(0, 40 * pu, dz)));
    });
    // On the crest and the slope: trees, bushes, rocks, walls and fences, flowers.
    const g = c.base.getContext('2d')!;
    g.save();
    g.scale(res, res);
    g.translate(-c.L0 + PAD / res, -top);
    const cw = 46 * pu;
    const items: { y: number; draw: () => void }[] = [];
    const L0 = c.L0 - 160 * pu;
    const L1 = c.L0 + CW + 160 * pu;
    for (let i = Math.floor(L0 / cw); i <= Math.ceil(L1 / cw); i++) {
      const L = (i + hash(i, 61, S)) * cw;
      const rg = regionPick(L, hash(i, 62, S));
      const pr = hash(i, 63, S);
      const seed = Math.floor(hash(i, 64, S) * 1e6);
      const crest = land.nearY(L);
      const dzr = hash(i, 65, S);
      const dz = GH * (0.012 + dzr * dzr * 0.17);
      const sc = 1 + dz / (GH * 0.15);
      const y = crest + dz;
      if (pr < (rg === 'meadow' || rg === 'flowers' ? 0.07 : rg === 'lake' || rg === 'town' ? 0.05 : rg === 'moor' ? 0.025 : 0.02)) {
        const s = (70 + hash(i, 66, S) * 70) * pu;
        const yy = crest + 2 * pu;
        const kind = rg === 'mountain' || (rg === 'lake' && pr < 0.03) ? 'pine' : 'tree';
        items.push({ y: yy - 1000, draw: () => (kind === 'pine' ? P.pine(g, L, yy, s * 1.2, lxc, seed, pineLeaf) : P.treeClump(g, L, yy, s, lxc, seed, rg === 'moor' ? leafAlt : leaf, { tall: rg === 'moor' ? 0.85 : 1.05 })) });
      } else if (pr < 0.16) {
        const s = (14 + hash(i, 66, S) * 18) * pu * sc;
        items.push({ y, draw: () => P.boulder(g, L, y, s, lxc, seed, rg === 'moor' || rg === 'mountain' ? '#8e897e' : '#9a9486') });
      } else if (pr < 0.26 && (rg === 'moor' || rg === 'coast')) {
        // A dry-stone wall running from the crest down the hill toward us.
        const pts: [number, number][] = [];
        const a = (hash(i, 67, S) - 0.5) * 1.4;
        for (let q = 0; q <= 10; q++) {
          const dzq = (q / 10) * GH * 0.2;
          const Lq = L + a * dzq * 2.4 + Math.sin(q * 0.9 + i) * 6 * pu;
          pts.push([Lq, land.nearY(Lq) + dzq + 1 * pu]);
        }
        items.push({ y: crest, draw: () => P.wall(g, pts.map(([px, py2], q) => [px, py2 - q * 0] as [number, number]), 9 * pu, lxc) });
      } else if (pr < 0.3 && (rg === 'meadow' || rg === 'town')) {
        const pts: [number, number][] = [];
        for (let q = 0; q < 7; q++) {
          const Lq = L + q * 22 * pu;
          pts.push([Lq, land.nearY(Lq) + dz + q * 1.5 * pu]);
        }
        items.push({ y, draw: () => P.fence(g, pts, 16 * pu * sc) });
      } else if (pr < 0.5) {
        const s = (12 + hash(i, 66, S) * 10) * pu * sc;
        items.push({ y, draw: () => P.treeClump(g, L, y + s * 0.1, s, lxc, seed, rg === 'moor' ? leafAlt : leaf, { shadow: true, tall: 0.5, trunk: '#3a3024' }) });
      }
      // Flowers everywhere it is green, and thick in the flower fields.
      const fl = rg === 'flowers' ? 26 : rg === 'meadow' || rg === 'lake' ? 8 : rg === 'moor' ? 3 : rg === 'coast' ? 6 : 3;
      const fcols = rg === 'moor' ? ['#c890c0', '#f0e060'] : rg === 'coast' ? ['#f0a0b8', '#ffffff', '#f8e070'] : rg === 'flowers' ? ['#f6d040', '#ffffff', '#f08cb0', '#b090e0', '#ff5040', '#ffb040'] : ['#ffffff', '#f8e050', '#f0a0c0', '#c0a0f0'];
      const fy = crest + GH * (0.02 + hash(i, 68, S) * 0.16);
      items.push({ y: fy, draw: () => P.flowers(g, L, fy, cw * 1.2, GH * 0.03, 1.5 * pu * (1 + (fy - crest) / (GH * 0.12)), seed, fcols, fl) });
    }
    for (const it of items.sort((a, b) => a.y - b.y)) it.draw();
    g.restore();
  }

  function paintFore(c: Chunk) {
    const [top] = BAND.fore;
    const g = c.base.getContext('2d')!;
    g.save();
    g.scale(res, res);
    g.translate(-c.L0 + PAD / res, -top);
    const L0 = c.L0 - 80 * pu;
    const L1 = c.L0 + CW + 80 * pu;
    // The bank of grass along the bottom.
    const p = PALS.meadow;
    const dark = `rgb(${p.shade.map((v) => Math.round(v * 0.62)).join(',')})`;
    const midc = `rgb(${p.shade.map((v) => Math.round(v * 0.85)).join(',')})`;
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(L0, GH + 10);
    for (let L = L0; L <= L1; L += 3 * pu) g.lineTo(L, foreTop(L));
    g.lineTo(L1, GH + 10);
    g.fill();
    const cols: [string, string, string] = [dark, midc, `rgb(${p.base.map((v) => Math.round(v * 0.9)).join(',')})`];
    const cw = 14 * pu;
    for (let i = Math.floor(L0 / cw); i <= Math.ceil(L1 / cw); i++) {
      const L = (i + hash(i, 81, S)) * cw;
      const y = foreTop(L) + 4 * pu;
      const pr = hash(i, 82, S);
      const seed = Math.floor(hash(i, 83, S) * 1e6);
      if (pr < 0.025) P.boulder(g, L, y + 6 * pu, (30 + hash(i, 84, S) * 30) * pu, lxc, seed, '#7e7a70');
      else if (pr < 0.05) P.treeClump(g, L, y + 10 * pu, (40 + hash(i, 84, S) * 30) * pu, lxc, seed, ['#1e3a24', '#2e5430', '#4e7a3a'], { shadow: false, tall: 0.45 });
      P.tuft(g, L, y + 2 * pu, (26 + hash(i, 85, S) * 34) * pu, lxc, seed, cols, (hash(i, 86, S) - 0.5) * 0.4);
      if (hash(i, 87, S) < 0.2) P.flowers(g, L, y - 14 * pu, cw, 10 * pu, 2.4 * pu, seed, ['#ffffff', '#f8e050', '#f0a0c0'], 3);
    }
    g.restore();
  }

  // ---- chunks: made as they come into view, coloured by the hour a plane at a time ------------------------
  const chunks = new Map<string, Chunk>();
  const PAINT: Record<PlaneId, (c: Chunk) => void> = { back: paintBack, far: paintFar, m0: (c) => paintMid(c, 0), m1: (c) => paintMid(c, 1), m2: (c) => paintMid(c, 2), m3: (c) => paintMid(c, 3), m4: (c) => paintMid(c, 4), near: paintNear, fore: paintFore };
  function make(plane: PlaneId, i: number): Chunk {
    const [top, bottom] = BAND[plane];
    const w = Math.ceil(CW * res) + PAD * 2;
    const h = Math.ceil((bottom - top) * res);
    const c: Chunk = { plane, i, L0: i * CW, base: mk(w, h), out: mk(w, h), stamp: null, hz: -1, ink: { lights: [], mills: [], smokes: [] } };
    PAINT[plane](c);
    chunks.set(`${plane}:${i}`, c);
    return c;
  }
  const ORDER: PlaneId[] = ['back', 'far', 'm0', 'm1', 'm2', 'm3', 'm4', 'near', 'fore'];
  let turn = 0;
  const hazeNow = (plane: PlaneId) => {
    const mist = Math.max(0, 1 - Math.abs(world.day - 0.3) / 0.06) * 0.6;
    return HAZE[plane] * (1 + mist + world.rain * 0.8 + world.storm * 0.5) + (plane[0] === 'm' ? mist * 0.05 + world.rain * 0.05 : 0);
  };
  function tint(c: Chunk, amb: RGB, hz: number) {
    c.stamp = amb;
    c.hz = hz;
    const o = c.out.getContext('2d')!;
    const { width: w, height: h } = c.out;
    o.globalCompositeOperation = 'copy';
    o.drawImage(c.base, 0, 0);
    o.globalCompositeOperation = 'multiply';
    o.fillStyle = E.L.amb;
    o.fillRect(0, 0, w, h);
    o.globalCompositeOperation = 'destination-in';
    o.drawImage(c.base, 0, 0);
    if (hz > 0.005) {
      o.globalCompositeOperation = 'source-atop';
      o.globalAlpha = Math.min(0.9, hz);
      o.fillStyle = E.L.haze;
      o.fillRect(0, 0, w, h);
      o.globalAlpha = 1;
    }
    o.globalCompositeOperation = 'source-over';
  }
  const stale = (c: Chunk, amb: RGB, hz: number) => !c.stamp || Math.abs(c.stamp[0] - amb[0]) + Math.abs(c.stamp[1] - amb[1]) + Math.abs(c.stamp[2] - amb[2]) > 5 || Math.abs(c.hz - hz) > 0.015;
  const rangeOf = (plane: PlaneId): [number, number] => {
    const s = PLANES[plane].s;
    const a = world.X * s - GW / 2 - 30;
    return [Math.floor(a / CW), Math.floor((a + GW + 60) / CW)];
  };
  /** Make what is needed now (and one ahead, a chunk a frame), drop what is behind, and recolour one plane for the hour. */
  function update(jumped: boolean) {
    let made = 0;
    const amb = hexRgb(E.L.amb);
    for (const plane of ORDER) {
      const [i0, i1] = rangeOf(plane);
      for (let i = i0; i <= i1; i++) if (!chunks.has(`${plane}:${i}`)) make(plane, i);
      const ahead = dir > 0 ? i1 + 1 : i0 - 1;
      const behindA = dir > 0 ? i0 - 1 : i1 + 1;
      if (!made && !chunks.has(`${plane}:${ahead}`)) {
        make(plane, ahead);
        made++;
      }
      void behindA;
      for (const [key, c] of chunks) if (c.plane === plane && (c.i < i0 - 2 || c.i > i1 + 2)) chunks.delete(key);
    }
    // A plane whose chunks have never been coloured, or all of them after a jump; else one plane a frame.
    for (const plane of ORDER) {
      const hz = hazeNow(plane);
      const list = [...chunks.values()].filter((c) => c.plane === plane);
      if (jumped || list.some((c) => !c.stamp)) {
        for (const c of list) tint(c, amb, hz);
      }
    }
    const plane = ORDER[turn++ % ORDER.length];
    const hz = hazeNow(plane);
    const list = [...chunks.values()].filter((c) => c.plane === plane);
    if (list.some((c) => stale(c, amb, hz))) for (const c of list) tint(c, amb, hz);
  }
  function drawPlane(ctx: CanvasRenderingContext2D, plane: PlaneId) {
    const s = PLANES[plane].s;
    const [top, bottom] = BAND[plane];
    const [i0, i1] = rangeOf(plane);
    for (let i = i0; i <= i1; i++) {
      const c = chunks.get(`${plane}:${i}`);
      if (!c) continue;
      const sx = GW / 2 + dir * (c.L0 - world.X * s);
      const w = c.out.width / res;
      const h = bottom - top;
      if (dir > 0) ctx.drawImage(c.out, sx - PAD / res, top, w, h);
      else {
        ctx.save();
        ctx.translate(sx, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(c.out, -PAD / res, top, w, h);
        ctx.restore();
      }
    }
  }
  const each = (plane: PlaneId, fn: (c: Chunk, sx: (L: number) => number) => void) => {
    const s = PLANES[plane].s;
    const [i0, i1] = rangeOf(plane);
    for (let i = i0; i <= i1; i++) {
      const c = chunks.get(`${plane}:${i}`);
      if (c) fn(c, (L) => GW / 2 + dir * (L - world.X * s));
    }
  };

  // ---- the live parts --------------------------------------------------------------------------------------
  /** Windows lit at dusk, a lighthouse's lamp; the sails of the mills; smoke from cottage chimneys. */
  function drawLive(ctx: CanvasRenderingContext2D, plane: PlaneId) {
    const lamp = clamp01((E.night - 0.15) / 0.5);
    const hz = plane === 'far' ? 0.5 : 0.15;
    each(plane, (c, sx) => {
      for (const [L, y] of c.ink.smokes) {
        if (c.ink.smokes.length > 30) break;
        const x = sx(L);
        if (x < -40 || x > GW + 40) continue;
        for (let k = 0; k < 4; k++) {
          const q = ((E.t * 0.12 + hash(Math.round(L), k)) % 1 + 1) % 1;
          const rr = (2 + q * 7) * pu * (plane === 'far' ? 0.5 : 1);
          ctx.globalAlpha = 0.28 * (1 - q) * Math.min(1, q * 5);
          ctx.drawImage(E.soft(E.lit(mix('#e4e0d8', '#b8cee4', hz))), x + q * world.wind * 1.2 - rr, y - q * 30 * pu - rr, rr * 2, rr * 2);
        }
      }
      ctx.globalAlpha = 1;
      for (const [L, y, r] of c.ink.mills) {
        const x = sx(L);
        if (x < -60 || x > GW + 60) continue;
        const a0 = E.t * 0.8 * (1 + Math.abs(world.wind) / (30 * u)) + L;
        ctx.strokeStyle = E.lit(mix('#6a5040', '#b8cee4', hz));
        ctx.fillStyle = E.lit(mix('#e8e0d0', '#b8cee4', hz));
        ctx.lineWidth = Math.max(0.6, r * 0.04);
        for (let k = 0; k < 4; k++) {
          const a = a0 + (k * Math.PI) / 2;
          const ex = x + Math.cos(a) * r;
          const ey = y + Math.sin(a) * r;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          const px = -Math.sin(a) * r * 0.16;
          const py = Math.cos(a) * r * 0.16;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25);
          ctx.lineTo(ex, ey);
          ctx.lineTo(ex + px, ey + py);
          ctx.lineTo(x + Math.cos(a) * r * 0.25 + px, y + Math.sin(a) * r * 0.25 + py);
          ctx.fill();
        }
      }
      if (lamp > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [i, [L, y, r]] of c.ink.lights.entries()) {
          const on = hash(c.i, i, 7) < 0.85 - Math.max(0, world.day < 0.25 ? 0.25 - world.day : 0) * 2;
          if (!on) continue;
          const x = sx(L);
          if (x < -20 || x > GW + 20) continue;
          const fl = 0.85 + 0.15 * Math.sin(E.t * 3 + i * 7);
          E.glow(x, y, r * (plane === 'far' ? 1.5 : 1.2), '#ffb860', lamp * 0.7 * fl);
          ctx.fillStyle = rgba('#ffe0a0', lamp * 0.9);
          ctx.fillRect(x - r * 0.14, y - r * 0.16, r * 0.28, r * 0.3);
        }
        ctx.restore();
      }
    });
  }

  function drawWater(ctx: CanvasRenderingContext2D) {
    const s = midS(0);
    const bottom = GY + GH * 0.04;
    const sp = sunPos(world.day, GW, HY, world.sunSide);
    const mp = sunPos(world.day, GW, HY, world.sunSide > 0 ? -1 : 1, true);
    const L = E.L;
    for (const w of land.watersIn(world.X * s - GW * 4, world.X * s + GW * 4)) {
      // The water shows wherever any drowned ridge has sunk: the widest of their spans on the screen.
      let left = Infinity;
      let right = -Infinity;
      for (let k = 0; k < NMID - 1; k++) {
        const sk = midS(k);
        const xa = GW / 2 + dir * ((w.seg.x0 - land.BLEND) * sk - world.X * sk);
        const xb = GW / 2 + dir * ((w.seg.x1 + land.BLEND) * sk - world.X * sk);
        left = Math.min(left, xa, xb);
        right = Math.max(right, xa, xb);
      }
      left = Math.max(-20, left);
      right = Math.min(GW + 20, right);
      if (right <= left) continue;
      const y0 = w.level;
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, y0, right - left, bottom - y0);
      ctx.clip();
      const deep = E.lit(w.sea ? '#2e6a9c' : '#3a6a88');
      const wg = ctx.createLinearGradient(0, y0, 0, bottom);
      wg.addColorStop(0, mix(L.low, deep, 0.25));
      wg.addColorStop(0.25, mix(L.mid, deep, 0.45));
      wg.addColorStop(1, mix(L.top, deep, 0.6));
      ctx.fillStyle = wg;
      ctx.fillRect(left, y0, right - left, bottom - y0);
      // The hills and mountains upside down in it.
      ctx.save();
      ctx.globalAlpha = w.sea ? 0.25 : 0.55;
      ctx.translate(0, y0 * 2);
      ctx.scale(1, -1);
      drawPlane(ctx, 'back');
      drawPlane(ctx, 'far');
      ctx.restore();
      ctx.globalAlpha = 1;
      const tint = ctx.createLinearGradient(0, y0, 0, bottom);
      tint.addColorStop(0, rgba(mix(L.low, deep, 0.3), 0.15));
      tint.addColorStop(1, rgba(deep, 0.55));
      ctx.fillStyle = tint;
      ctx.fillRect(left, y0, right - left, bottom - y0);
      // The path of the sun (or the moon) on the water, broken into ripples.
      const src = sp.up && E.night < 0.6 ? { x: sp.x, col: L.sun, a: 0.55 + goldenOf(world.day) * 0.4 } : mp.up && E.night > 0.4 ? { x: mp.x, col: '#dfe6f8', a: 0.4 * E.night } : null;
      const veil = 1 - world.storm * 0.85;
      ctx.lineCap = 'round';
      for (let k = 0; k < 90; k++) {
        const q = hash(k, 3, S);
        const yy = y0 + 1 + Math.pow(q, 1.6) * (bottom - y0) * 0.95;
        const depth = (yy - y0) / (bottom - y0);
        const near = src ? Math.exp(-Math.pow((hash(k, 4, S) - 0.5) * 6, 2)) : 0;
        const x = src && near > 0.2 ? src.x + (hash(k, 4, S) - 0.5) * (20 + depth * 220) * u : left + hash(k, 5, S) * (right - left);
        const len = (4 + depth * 26 + hash(k, 6, S) * 10) * u;
        const tw = 0.5 + 0.5 * Math.sin(E.t * (1.2 + hash(k, 7, S) * 2) + k);
        const col = src && near > 0.2 ? src.col : mix(L.low, '#ffffff', 0.3);
        ctx.strokeStyle = rgba(E.night > 0.6 && !(src && near > 0.2) ? mix(L.low, L.mid, 0.5) : col, (src && near > 0.2 ? src.a * near : 0.2) * tw * veil);
        ctx.lineWidth = Math.max(0.7, (0.6 + depth * 1.6) * u);
        const drift = Math.sin(E.t * 0.4 + k) * 4 * u;
        ctx.beginPath();
        ctx.moveTo(x - len / 2 + drift, yy);
        ctx.lineTo(x + len / 2 + drift, yy);
        ctx.stroke();
      }
      if (w.sea) {
        // The bright line of the horizon, whitecaps, and boats.
        ctx.fillStyle = rgba(mix(L.low, '#ffffff', 0.4), 0.5 * veil);
        ctx.fillRect(left, y0, right - left, Math.max(1, 1.2 * u));
        for (let k = 0; k < 4; k++) {
          const bx = left + (((hash(w.seg.seed, k) * (right - left) + E.t * (3 + k) * u * Math.sign(world.wind || 1)) % (right - left)) + (right - left)) % (right - left);
          const by = y0 + (0.12 + hash(w.seg.seed, k, 2) * 0.5) * (bottom - y0) * 0.5;
          const bs = (6 + (by - y0) * 0.12) * pu;
          boat(ctx, bx, by, bs, hash(w.seg.seed, k, 3));
        }
      }
      ctx.restore();
    }
  }
  function boat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, h: number) {
    const rock = Math.sin(E.t * 1.3 + h * 20) * 0.08;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rock);
    ctx.fillStyle = E.lit('#5a3e30');
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.2);
    ctx.lineTo(s, -s * 0.2);
    ctx.lineTo(s * 0.7, s * 0.1);
    ctx.lineTo(-s * 0.7, s * 0.1);
    ctx.fill();
    ctx.fillStyle = E.lit(h < 0.5 ? '#f4eee0' : '#d8744a');
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.25);
    ctx.lineTo(0, -s * 1.6);
    ctx.lineTo(s * 0.8 * (h < 0.3 ? -1 : 1), -s * 0.3);
    ctx.fill();
    ctx.restore();
    if (E.night > 0.4) E.glow(x, y - s * 0.3, 6 * u, '#ffc070', E.night * 0.6);
  }

  /** The near crest as a path, across the screen (for clipping the grass's wind and the cloud shadows). */
  function nearPath() {
    const p = new Path2D();
    p.moveTo(-40, GH + 10);
    for (let x = -40; x <= GW + 40; x += 6) p.lineTo(x, land.nearY(world.X + dir * (x - GW / 2)));
    p.lineTo(GW + 40, GH + 10);
    p.closePath();
    return p;
  }
  /** The wind running through the grass: long pale bands rolling over the hill, the gusts of a touch. */
  function drawGrassWind(ctx: CanvasRenderingContext2D, path: Path2D) {
    const wk = clamp01(Math.abs(world.wind) / (24 * u)) * (1 - E.night * 0.6);
    if (wk < 0.05) return;
    ctx.save();
    ctx.clip(path);
    const span = GW + 900 * pu;
    const lit = E.lit(mix(hexToStr(PALS.meadow.lit), '#f4ffd0', 0.45));
    const spr = E.soft(lit);
    const n = phone ? 10 : 18;
    for (let i = 0; i < n; i++) {
      const x = ((hash(i, 91, S) * span + world.drift * 2.4 - dir * world.X) % span + span) % span - 450 * pu;
      const dz = GH * (0.01 + Math.pow(hash(i, 92, S), 1.4) * 0.19);
      const y = land.nearY(world.X + dir * (x - GW / 2)) + dz;
      const w = (160 + hash(i, 93, S) * 200) * pu * (0.8 + dz / (GH * 0.1));
      const h = w * 0.11;
      const puls = 0.6 + 0.4 * Math.sin(E.t * 0.9 + i * 2.1);
      ctx.globalAlpha = 0.2 * wk * puls;
      ctx.drawImage(spr, x - w / 2, y - h / 2, w, h);
    }
    for (const gq of world.gusts) {
      const age = E.t - gq.t0;
      const x = gq.x + Math.sign(world.wind || 1) * age * 160 * u;
      ctx.globalAlpha = 0.3 * (1 - age / 8);
      for (let k = 0; k < 4; k++) {
        const y = land.GY + GH * (0.02 + k * 0.04);
        ctx.drawImage(spr, x - 200 * pu, y - 14 * pu, 400 * pu, 28 * pu);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  const hexToStr = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  /** Long blades of grass in front of everything, bending with the wind and the waves of it. */
  const blades = Array.from({ length: phone ? 70 : 150 }, (_, i) => ({ c: hash(i, 95, S), h: 0.5 + hash(i, 96, S) * 0.8, w: hash(i, 97, S), col: Math.floor(hash(i, 98, S) * 3), head: hash(i, 99, S) < 0.18 }));
  function drawBlades(ctx: CanvasRenderingContext2D) {
    const s = PLANES.fore.s;
    const span = GW + 200 * pu;
    const p = PALS.meadow;
    const cols = [E.lit(hexToStr(p.shade.map((v) => v * 0.7) as RGB)), E.lit(hexToStr(p.base.map((v) => v * 0.82) as RGB)), E.lit(hexToStr(p.lit.map((v) => v * 0.85) as RGB))];
    const wind = world.wind / (30 * u);
    ctx.lineCap = 'round';
    for (const b of blades) {
      const x = ((b.c * span - dir * world.X * s) % span + span) % span - 100 * pu;
      const L = world.X * s + dir * (x - GW / 2);
      const y = foreTop(L) + 8 * pu;
      const h = b.h * GH * 0.11 * (phone ? 0.8 : 1);
      const wave = Math.sin(E.t * 1.4 - x * 0.012 * Math.sign(world.wind || 1) + b.c * 3) * 0.5 + 0.5;
      const lean = wind * (0.25 + wave * 0.35) + Math.sin(E.t * 2.3 + b.c * 40) * 0.05;
      const tx = x + Math.sin(lean) * h;
      const ty = y - Math.cos(lean) * h;
      ctx.strokeStyle = cols[b.col];
      ctx.lineWidth = (1.4 + b.w * 1.6) * pu;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.sin(lean * 0.4) * h * 0.5, y - h * 0.55, tx, ty);
      ctx.stroke();
      if (b.head) {
        ctx.fillStyle = E.lit(world.season === 'autumn' || world.season === 'late' ? '#d8c078' : '#c8d488');
        ctx.beginPath();
        ctx.ellipse(tx, ty, 2.2 * pu, 7 * pu, lean, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return { update, drawPlane, drawLive, drawWater, drawGrassWind, drawBlades, nearPath, foreTop, BAND, pu, lxc, chunkCount: () => chunks.size };
}
