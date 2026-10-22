/**
 * The Walking Castle's country, without a canvas: the route of regions the castle walks through,
 * the shape of the land in each plane of depth, and what stands on it (by a hash, so the painter
 * and the sim agree on where every tree, town and lake is without keeping lists).
 *
 * Planes: the land is painted in five planes of depth, each scrolling at its own rate `s` as the
 * castle walks (`X` is how far it has walked, in the near plane's units). A point on a plane has a
 * plane coordinate `L`; on screen it is at `x = GW/2 + dir·(L − X·s)`. The region a plane shows at
 * `L` is the region of the route at `L / s`: where the castle will be when that point is in front of it.
 */

export type Region = 'meadow' | 'moor' | 'lake' | 'coast' | 'mountain' | 'flowers' | 'town';
export type Segment = { region: Region; x0: number; x1: number; name: string; seed: number; market?: boolean; stop?: boolean };
export type PlaneId = 'back' | 'far' | 'm0' | 'm1' | 'm2' | 'm3' | 'm4' | 'near' | 'fore';
/** The middle distance: five ridges of hills, each a plane of its own (a multiplane camera). */
export const MIDS = ['m0', 'm1', 'm2', 'm3', 'm4'] as const;
export const NMID = MIDS.length;
export const PLANES: Record<PlaneId, { s: number; id: number }> = {
  back: { s: 0.02, id: 1 },
  far: { s: 0.06, id: 2 },
  m0: { s: 0.1, id: 3 },
  m1: { s: 0.15, id: 4 },
  m2: { s: 0.22, id: 5 },
  m3: { s: 0.31, id: 6 },
  m4: { s: 0.44, id: 7 },
  near: { s: 1, id: 8 },
  fore: { s: 1.45, id: 9 },
};
export const midS = (k: number) => PLANES[MIDS[k]].s;

// ---- noise -------------------------------------------------------------------------------------
export const hash = (a: number, b = 0, c = 0): number => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
const sm = (f: number) => f * f * (3 - 2 * f);
/** Smooth value noise in 1D, 0..1. */
export function n1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i, seed);
  const b = hash(i + 1, seed);
  return a + (b - a) * sm(f);
}
/** Three octaves, 0..1. */
export function fbm1(x: number, seed: number): number {
  return (n1(x, seed) * 0.57 + n1(x * 2.03 + 7.1, seed + 1) * 0.29 + n1(x * 4.1 + 3.3, seed + 2) * 0.14);
}
/** Ridged noise for peaks, 0..1. */
export function ridged(x: number, seed: number): number {
  let v = 0;
  let a = 0.55;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    v += a * (1 - Math.abs(n1(x * f, seed + o * 11) * 2 - 1));
    f *= 2.1;
    a *= 0.48;
  }
  return v / 1.05;
}
/** Smooth value noise in 2D, 0..1. */
export function n2(x: number, y: number, seed: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = sm(x - i);
  const fy = sm(y - j);
  const a = hash(i, j, seed);
  const b = hash(i + 1, j, seed);
  const c = hash(i, j + 1, seed);
  const d = hash(i + 1, j + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const smoothstep = (a: number, b: number, v: number) => sm(clamp01((v - a) / (b - a)));

// ---- the names ---------------------------------------------------------------------------------
const NAMES: Record<Region, string[]> = {
  meadow: ['THE WOLDS OF ESKDALE', 'THE LONG MEADOWS', 'THE DOWNS ABOVE WENDLE', 'THE GREEN BELOW BRACKET HILL', 'THE HAYFIELDS OF ORMSBY', 'THE VALE OF LITTLE ASH', 'THE PASTURES OF CROWLEA', 'THE DOWNS OF HOLLINSIDE'],
  moor: ['HARROWDEN MOOR', 'THE GREY FELLS', 'BLACKMIRE MOOR', 'THE HIGH HEATH', 'TORLEY COMMON', 'THE MOORS OF SKELL', 'WINTERSET MOOR', 'THE HEATHER BACKS'],
  lake: ['LAKE ELLENMERE', 'THE MIRROR WATER', 'LOCH ANNET', 'SWANMERE', 'THE STILL TARN', 'LAKE ORREN', 'GLASSWATER', 'THE TARN OF STARS'],
  coast: ['THE COAST AT GULLHAVEN', 'THE CLIFFS OF SALTMERE', 'THE BAY OF BRINEWICK', 'THE HARBOUR AT CRAB\'S END', 'THE SHORE BELOW PENWITH STEEP', 'THE COAST AT MERROWPORT'],
  mountain: ['THE PASS OF CARRICK FELL', 'THE SHOULDER OF OLD GRIM', 'THE HIGH ROAD OVER SKARN', 'THE CRAGS OF ALDERHORN', 'THE STEEPS OF WINDLE PIKE', 'THE COL OF THE TWO SISTERS'],
  flowers: ['THE FLOWER FIELDS OF BLUEBELL HOLLOW', 'THE MEADOW OF LONG SUMMERS', 'THE POPPY DOWNS', 'THE BUTTERCUP VALE', 'THE LAVENDER LEAS', 'THE FIELDS OF HEARTSEASE'],
  town: ['UPPER DREWE', 'BRAMBLEFORD', 'MOSSBY CROSS', 'THISTLEDOWN', 'FENNICK MARKET', 'ROOKHAVEN', 'APPLETHWAITE', 'KESTLE ON THE HILL'],
};
export const FAR_TOWNS = ['ASHFORD', 'GREYMOUTH', 'HALLOW END', 'CORVAN', 'MARRICK', 'DUNSTOW', 'ELVERSHAM', 'TOLLBURN', 'STARLING CROSS', 'WICKHAM DOWN'];

export type Land = ReturnType<typeof createLand>;

/** The country for one seed: its route (filled by the sim as the castle walks) and its shapes. */
export function createLand(seed: number, GW: number, GH: number, u: number, phone: boolean, opts: { peaks: number; hills: number; rolling: number; horizon: number }) {
  const HY = Math.round(GH * ((phone ? 0.5 : 0.47) + opts.horizon));
  const GY = Math.round(GH * ((phone ? 0.79 : 0.8) + opts.horizon * 0.3));
  const seaY = HY;
  const lakeY = Math.round(HY + GH * 0.035);
  const route: Segment[] = [];
  const S = (k: number) => seed * 31 + k;

  /** The segment of the route at castle distance Xc, and how far into the next (or from the last) it blends. */
  function segAt(Xc: number): number {
    let lo = 0;
    let hi = route.length - 1;
    if (hi < 0) return -1;
    if (Xc < route[0].x0) return 0;
    if (Xc >= route[hi].x0) return hi;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (route[mid].x0 <= Xc) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
  const BLEND = 520 * u;
  /** The region at Xc, blended near the borders: a, b and how much of b (0..1). */
  function regionAt(Xc: number): { a: Region; b: Region; k: number; seg: Segment | null } {
    const i = segAt(Xc);
    if (i < 0) return { a: 'meadow', b: 'meadow', k: 0, seg: null };
    const s = route[i];
    const next = route[i + 1];
    const prev = route[i - 1];
    if (next && Xc > s.x1 - BLEND) return { a: s.region, b: next.region, k: smoothstep(s.x1 - BLEND, s.x1 + BLEND, Xc) * 0.5, seg: s };
    if (prev && Xc < s.x0 + BLEND) return { a: s.region, b: prev.region, k: (1 - smoothstep(s.x0 - BLEND, s.x0 + BLEND, Xc)) * 0.5, seg: s };
    return { a: s.region, b: s.region, k: 0, seg: s };
  }
  /** How much of region `r` there is at Xc, 0..1. */
  const weightOf = (r: Region, Xc: number) => {
    const g = regionAt(Xc);
    return (g.a === r ? 1 - g.k : 0) + (g.b === r ? g.k : 0);
  };

  // ---- the near plane: the crest the castle walks on ----------------------------------------------
  const nearOf = (r: Region, L: number, seg: Segment | null): number => {
    const base = (fbm1(L / (1100 * u), S(1)) - 0.5) * 2;
    const small = (n1(L / (260 * u), S(2)) - 0.5) * 2;
    switch (r) {
      case 'meadow': return (base * 30 + small * 8) * u * opts.rolling;
      case 'moor': return (base * 22 + small * 10 + (n1(L / (90 * u), S(3)) - 0.5) * 6) * u;
      case 'lake': return (base * 8 + small * 3 - 10) * u;
      case 'coast': return (base * 14 + small * 6 + 6) * u;
      case 'flowers': return (base * 20 + small * 5) * u;
      case 'town': return (base * 22 + small * 6) * u;
      case 'mountain': {
        const q = seg ? clamp01((L - seg.x0) / Math.max(1, seg.x1 - seg.x0)) : 0;
        return (Math.pow(Math.sin(q * Math.PI), 2) * 150 + base * 16 + small * 10 + (n1(L / (70 * u), S(4)) - 0.5) * 8) * u;
      }
    }
  };
  /** The height of the near crest above GY at near-plane coordinate L. */
  function nearH(L: number): number {
    const g = regionAt(L);
    // The climb blends with its own segment's shape on both sides of the border.
    const ha = nearOf(g.a, L, g.seg);
    if (g.k <= 0) return ha;
    const i = segAt(L);
    const other = g.b === route[i + 1]?.region && L > (g.seg?.x1 ?? 0) - BLEND ? route[i + 1] : route[i - 1] ?? null;
    const hb = nearOf(g.b, L, other);
    return ha + (hb - ha) * g.k;
  }
  const nearY = (L: number) => GY - nearH(L);

  // ---- the middle distance: five ridges, lakes and the sea --------------------------------------
  type RidgeP = { off: number; amp: number; wave: number };
  const ridges = (off: number[], amp: number[], wave: number[]): RidgeP[] => off.map((o, k) => ({ off: o, amp: amp[k], wave: wave[k] }));
  const OFF = [0.012, 0.042, 0.08, 0.128, 0.19];
  const MID: Record<Region, RidgeP[]> = {
    meadow: ridges(OFF, [34, 40, 48, 56, 62], [560, 500, 450, 410, 380]),
    moor: ridges(OFF, [26, 30, 36, 40, 44], [700, 600, 520, 460, 420]),
    lake: ridges(OFF, [34, 40, 46, 52, 56], [560, 500, 450, 410, 380]),
    coast: ridges(OFF, [28, 32, 38, 46, 52], [600, 520, 460, 420, 400]),
    mountain: ridges([-0.05, -0.02, 0.025, 0.075, 0.14], [150, 130, 112, 96, 84], [420, 360, 320, 290, 270]),
    flowers: ridges(OFF.map((o) => o + 0.004), [28, 34, 40, 46, 52], [640, 560, 500, 450, 420]),
    town: ridges(OFF, [32, 38, 46, 54, 62], [580, 500, 440, 400, 360]),
  };
  /** How high a mid plane's band must reach, and how low (for the painter's chunks). */
  const midBand = (k: number): [number, number] => {
    const top = HY + Math.min(...Object.values(MID).map((m) => m[k].off)) * GH - 170 * u * Math.max(1, opts.hills);
    const below = k < NMID - 1 ? HY + Math.max(...Object.values(MID).map((m) => m[k + 1].off)) * GH + 14 * u : GY + GH * 0.04;
    return [top, Math.max(below, lakeY + 4 * u)];
  };
  const ridgeOf = (r: Region, k: number, Ll: number) => {
    const p = MID[r][k];
    const n = r === 'mountain' ? ridged(Ll / (p.wave * u), S(10 + k)) : fbm1(Ll / (p.wave * u), S(10 + k));
    return HY + p.off * GH - n * p.amp * u * (r === 'mountain' ? 1 : opts.hills);
  };
  const last = NMID - 1;
  /** Where a ridge sinks to over water: a far shore, the ridges between drowned, a near bank (or the town's hill on the coast). */
  const sunk = (r: Region, k: number, Ll: number) => {
    if (r === 'lake') {
      if (k === 0) return lakeY - (5 + n1(Ll / (60 * u), S(20)) * 10) * u;
      if (k < last) return lakeY + 400 * u;
      return lakeY + GH * 0.1 + (n1(Ll / (90 * u), S(21)) - 0.5) * 18 * u;
    }
    if (k === 1 || k === 2) {
      const isl = clamp01((n1(Ll / (200 * u), S(22 + k)) - 0.74) * 6);
      return isl > 0 ? seaY - isl * (14 + k * 10) * u : seaY + 400 * u;
    }
    if (k < last) return seaY + 400 * u;
    return seaY + GH * 0.07 - fbm1(Ll / (300 * u), S(23)) * 34 * u;
  };
  const waterOf = (r: Region) => (r === 'lake' || r === 'coast' ? 1 : 0);
  /** Ridge k's top and bottom (the bottom is the waterline where it stands in water) at its plane coordinate Ll. */
  function midRidge(k: number, Ll: number): [number, number] {
    const g = regionAt(Ll / midS(k));
    const one = (r: Region) => (waterOf(r) ? sunk(r, k, Ll) : ridgeOf(r, k, Ll));
    const ta = one(g.a);
    const tb = g.k > 0 ? one(g.b) : ta;
    const top = ta + (tb - ta) * g.k;
    const wa = waterOf(g.a) * (1 - g.k) + waterOf(g.b) * g.k;
    const level = g.a === 'coast' || g.b === 'coast' ? seaY : lakeY;
    const bottom = wa > 0.001 && k < last ? level : Infinity;
    return [top, bottom];
  }
  /** The stretches of water, in the farthest ridge's coordinates (where they first show). */
  function watersIn(L0: number, L1: number): { L0: number; L1: number; level: number; sea: boolean; seg: Segment }[] {
    const out: { L0: number; L1: number; level: number; sea: boolean; seg: Segment }[] = [];
    const s0 = midS(0);
    for (const s of route) {
      if (s.region !== 'lake' && s.region !== 'coast') continue;
      const a = (s.x0 - BLEND) * s0;
      const b = (s.x1 + BLEND) * s0;
      if (b < L0 || a > L1) continue;
      out.push({ L0: a, L1: b, level: s.region === 'coast' ? seaY : lakeY, sea: s.region === 'coast', seg: s });
    }
    return out;
  }

  // ---- the far hills and the mountains: the same everywhere, by the seed ------------------------
  function farTop(k: number, Ll: number): number {
    if (k === 0) return HY - GH * 0.018 - fbm1(Ll / (520 * u), S(30)) * 46 * u * opts.hills - n1(Ll / (120 * u), S(31)) * 8 * u;
    return HY + GH * 0.012 - fbm1(Ll / (380 * u), S(32)) * 34 * u * opts.hills - n1(Ll / (90 * u), S(33)) * 6 * u;
  }
  function backTop(k: number, Ll: number): number {
    if (k === 0) {
      const pk = ridged(Ll / (520 * u), S(40));
      return HY - GH * 0.03 - Math.pow(pk, 1.6) * GH * 0.2 * opts.peaks - n1(Ll / (60 * u), S(41)) * 5 * u;
    }
    return HY - GH * 0.012 - fbm1(Ll / (430 * u), S(42)) * GH * 0.07 * (0.5 + opts.peaks * 0.5) - n1(Ll / (80 * u), S(43)) * 5 * u;
  }

  // ---- the far towns (the war comes to them) -----------------------------------------------------
  const FARCELL = 900 * u;
  /** Towns on the far hills in [L0, L1] (far coordinates): where, their name, how big. */
  function farTownsIn(L0: number, L1: number): { L: number; name: string; size: number; seed: number }[] {
    const out: { L: number; name: string; size: number; seed: number }[] = [];
    for (let i = Math.floor(L0 / FARCELL) - 1; i <= Math.ceil(L1 / FARCELL); i++) {
      if (hash(i, S(50)) > 0.5) continue;
      const L = (i + 0.2 + hash(i, S(51)) * 0.6) * FARCELL;
      if (L < L0 || L > L1) continue;
      out.push({ L, name: FAR_TOWNS[Math.floor(hash(i, S(52)) * FAR_TOWNS.length)], size: 0.7 + hash(i, S(53)) * 0.6, seed: Math.floor(hash(i, S(54)) * 1e6) });
    }
    return out;
  }

  const nameFor = (r: Region, k: number) => NAMES[r][Math.floor(hash(k, S(60)) * NAMES[r].length)];

  return {
    seed, GW, GH, u, HY, GY, seaY, lakeY, route, BLEND, phone,
    segAt, regionAt, weightOf, nearH, nearY, midRidge, midBand, watersIn, farTop, backTop, farTownsIn, nameFor,
  };
}
