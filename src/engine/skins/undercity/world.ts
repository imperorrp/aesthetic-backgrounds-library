/**
 * The city's model: three parallax layers of buildings, streamed in chunks as the camera
 * drifts, plus the event bus and the labels said on the map.
 *
 * Space: each layer has its own x (layer pixels). The camera scroll `cam` is in near-layer
 * pixels; layer L sits at screen x = x - cam * k(L), so far layers move slower (parallax).
 * A building stands on its layer's ground line (`baseY`), `h` pixels tall.
 *
 * A chunk's buildings come from a stream forked by (layer, chunk index), so the city is
 * the same for a seed whatever order chunks are visited in, and a chunk that scrolls away
 * and back is rebuilt identically.
 */
import { forkRng, type Rng } from '../../rng';
import { createBus, type Bus } from '../../sim/bus';

export type LayerSpec = {
  /** Parallax: how fast this layer moves relative to the near one. */
  k: number;
  /** Ground line as a share of the height. */
  base: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  gapMin: number;
  gapMax: number;
  /** Window size in pixels. */
  win: [number, number];
  /** How much the smog swallows this layer, 0..1. */
  fog: number;
  chunk: number;
};

export const LAYERS: LayerSpec[] = [
  { k: 0.16, base: 0.74, minH: 0.3, maxH: 0.72, minW: 34, maxW: 82, gapMin: 2, gapMax: 14, win: [2, 3], fog: 0.6, chunk: 360 },
  { k: 0.42, base: 0.88, minH: 0.24, maxH: 0.62, minW: 56, maxW: 124, gapMin: 6, gapMax: 26, win: [3, 4], fog: 0.3, chunk: 420 },
  { k: 1, base: 0.962, minH: 0.18, maxH: 0.46, minW: 120, maxW: 250, gapMin: 0, gapMax: 16, win: [4, 6], fog: 0, chunk: 520 },
];

export const NEON = ['#f472b6', '#22d3ee', '#a78bfa', '#facc15', '#4ade80', '#fb7185', '#60a5fa', '#f97316'];
const SHOPS = ['RAMEN', 'NOODLES', 'CLINIC', 'PAWN', 'HOTEL', 'BAR', 'ARCADE', 'CHROME', 'DATA', 'OPEN 24H', 'NO VACANCY', 'KARAOKE', 'PHARMACY', 'IMPLANTS', 'SUSHI', 'LIQUOR', 'REPAIR', 'CAPSULES', 'DUMPLINGS', 'TATTOO', 'CYBERDOC', 'BODEGA', 'DANCE', 'CASINO'];
const VERTICAL = ['HOTEL', 'BAR', 'CLUB', 'OPEN', 'DOJO', 'ROBOT', 'LOVE', 'MOTEL', 'NOODLE', 'CHROME'];
export const CORPS = ['KAGEMORI', 'HELIX ORBITAL', 'NOVAKINE', 'SABLE DYNAMICS', 'MERIDIAN BIO', 'ZAIBATSU 9', 'ORACLE HEAVY', 'TESSERACT'];
export const ADS = ['BE MORE', 'UPGRADE YOUR EYES', 'SLEEP IS OPTIONAL', 'NEW LUNGS 40% OFF', 'FORGET SAFELY', 'TRUST THE CLOUD', 'LIVE FOREVER*', 'BUY THE SKY', 'OWN NOTHING', 'SMILE · YOU ARE SEEN'];

export type Sign = { text: string; x: number; y: number; vertical: boolean; color: string; size: number; seed: number };

/** One level of a near-layer stack, from the street up: `y` is its floor's height above the ground. */
export type Level = { y: number; h: number; open: boolean; awning: string | null; lantern: string };

export type Roof = 'flat' | 'antenna' | 'stepped' | 'spire' | 'dish' | 'crown' | 'clutter';

export type Building = {
  id: string;
  layer: number;
  x: number;
  w: number;
  h: number;
  roof: Roof;
  /** Share of windows lit, and a seed for which ones. */
  lit: number;
  seed: number;
  /** The neon that rims it and tints its windows. */
  hue: string;
  signs: Sign[];
  /** Near-layer stacks only. */
  levels: Level[] | null;
  /** A corp data fortress (mid layer): the netrunners' target. */
  corp: string | null;
  /** A holo ad panel on its face. */
  ad: { y: number; h: number; text: string; color: string } | null;
  /** Antenna tops (x offset, height above roof), for blinking lights. */
  masts: [number, number][];
  /** Runtime: outage darkness, glitching, and a hijacked ad. */
  dark: number;
  darkAt: number;
  restoreAt: number;
  glitchUntil: number;
  hijacked: string | null;
  hijackUntil: number;
};

/** A line said on the map, attached to a building so it moves with it. */
export type Label = { text: string; b: Building; ox: number; oy: number; color: string; t0: number; dur: number };

export type City = {
  W: number;
  H: number;
  /** Camera scroll in near-layer pixels. */
  cam: number;
  t: number;
  seed: string | number;
  bus: Bus;
  chunks: Map<number, Building[]>[];
  /** Buildings in (or just around) the view, per layer, back to front. */
  visible: Building[][];
  labels: Label[];
  /** Terminal lines for the HUD, oldest first. */
  term: { t: number; text: string; color: string }[];
  /** Layer x to screen x. */
  sx(layer: number, x: number): number;
  baseY(layer: number): number;
  /** Stream chunks in and out around the view. True when the set of buildings changed. */
  stream(): boolean;
  resize(W: number, H: number): void;
  /** Say something: on the bus, on the map near a building, and in the terminal. */
  say(text: string, b: Building | null, ox: number, oy: number, color: string, opts?: { priority?: 'low' | 'medium' | 'high'; term?: boolean; dur?: number }): void;
  emit(type: string, x: number, y: number, weight: number, extra?: Record<string, unknown>): void;
};

/** Build one chunk's buildings. Pure: the same (seed, layer, index, H) always gives the same chunk. */
export function genChunk(seed: string | number, L: number, i: number, H: number): Building[] {
  const s = LAYERS[L];
  const r: Rng = forkRng(seed, `uc-${L}-${i}`);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const out: Building[] = [];
  let x = i * s.chunk + r() * s.gapMax;
  const end = (i + 1) * s.chunk;
  let n = 0;
  while (x < end) {
    const w = s.minW + r() * (s.maxW - s.minW);
    const h = H * (s.minH + r() ** 1.3 * (s.maxH - s.minH));
    const hue = pick(NEON);
    const b: Building = {
      id: `${L}-${i}-${n++}`,
      layer: L,
      x,
      w,
      h,
      roof: L === 2 ? 'clutter' : pick(['flat', 'antenna', 'antenna', 'stepped', 'spire', 'dish'] as const),
      lit: L === 0 ? 0.14 + r() * 0.18 : L === 1 ? 0.14 + r() * 0.24 : 0.3 + r() * 0.3,
      seed: Math.floor(r() * 1e9),
      hue,
      signs: [],
      levels: null,
      corp: null,
      ad: null,
      masts: [],
      dark: 0,
      darkAt: Infinity,
      restoreAt: Infinity,
      glitchUntil: -1,
      hijacked: null,
      hijackUntil: -1,
    };
    if (b.roof === 'antenna') {
      const m = 1 + Math.floor(r() * 2);
      for (let k = 0; k < m; k++) b.masts.push([w * (0.25 + 0.5 * r()), 10 + r() * (L === 0 ? 30 : 22)]);
    }
    if (L === 2) {
      // A stack: levels from the street up; the ground floor is a shopfront.
      const levels: Level[] = [];
      let y = 0;
      while (y < h - 30) {
        const lh = y === 0 ? 40 + r() * 14 : 44 + r() * 30;
        if (y + lh > h) break;
        const open = y === 0 || r() < 0.38;
        levels.push({ y, h: lh, open, awning: open && r() < 0.6 ? pick(NEON) : null, lantern: pick(['#fbbf24', '#fb7185', '#f472b6', '#fde68a']) });
        y += lh;
      }
      b.h = Math.max(y, 60);
      b.levels = levels;
      b.signs.push({ text: pick(SHOPS), x: w * (0.15 + r() * 0.4), y: 10 + r() * 8, vertical: false, color: pick(NEON), size: 9 + Math.floor(r() * 3), seed: Math.floor(r() * 1e6) });
      if (r() < 0.55 && levels.length > 2) b.signs.push({ text: pick(VERTICAL), x: r() < 0.5 ? 6 : w - 14, y: levels[1].y + 8, vertical: true, color: pick(NEON), size: 10, seed: Math.floor(r() * 1e6) });
      if (r() < 0.3) b.signs.push({ text: pick(SHOPS), x: w * 0.2, y: b.h + 6, vertical: false, color: pick(NEON), size: 12, seed: Math.floor(r() * 1e6) });
    } else {
      if (L === 1 && r() < 0.45) b.signs.push({ text: pick(VERTICAL), x: r() < 0.5 ? 3 : w - 12, y: h * (0.35 + r() * 0.4), vertical: true, color: pick(NEON), size: 9, seed: Math.floor(r() * 1e6) });
      if (h > H * 0.36 && w > 44 && r() < (L === 0 ? 0.22 : 0.3)) {
        const ah = Math.min(70, h * 0.18);
        b.ad = { y: h * (0.55 + r() * 0.25), h: ah, text: pick(ADS), color: pick(NEON) };
      }
    }
    out.push(b);
    x += w + s.gapMin + r() * (s.gapMax - s.gapMin);
  }
  // Some mid chunks hold a corp tower: the tallest, made taller, crowned, and wired.
  if (L === 1 && r() < 0.7 && out.length) {
    const t = out.reduce((a, c) => (c.h > a.h ? c : a));
    t.h = Math.min(H * 0.8, t.h * 1.2);
    t.corp = pick(CORPS);
    t.roof = 'crown';
    t.masts = [];
    t.signs = [];
    t.ad = { y: t.h * 0.7, h: Math.min(64, t.h * 0.14), text: t.corp, color: pick(NEON) };
  }
  return out;
}

export function createCity(seed: string | number, W: number, H: number): City {
  const bus = createBus(() => city.t);
  const city: City = {
    W,
    H,
    cam: 0,
    t: 0,
    seed,
    bus,
    chunks: LAYERS.map(() => new Map()),
    visible: LAYERS.map(() => []),
    labels: [],
    term: [],
    sx: (L, x) => x - city.cam * LAYERS[L].k,
    baseY: (L) => city.H * LAYERS[L].base,
    stream() {
      let changed = false;
      LAYERS.forEach((s, L) => {
        const left = city.cam * s.k - s.maxW - 40;
        const right = city.cam * s.k + city.W + 40;
        const first = Math.floor(left / s.chunk);
        const last = Math.floor(right / s.chunk);
        const map = city.chunks[L];
        for (let i = first; i <= last; i++) {
          if (!map.has(i)) {
            map.set(i, genChunk(seed, L, i, city.H));
            changed = true;
          }
        }
        for (const i of map.keys()) {
          if (i < first - 1 || i > last + 1) {
            map.delete(i);
            changed = true;
          }
        }
        const vis: Building[] = [];
        for (let i = first; i <= last; i++) for (const b of map.get(i) ?? []) if (b.x + b.w > left && b.x < right) vis.push(b);
        city.visible[L] = vis;
      });
      return changed;
    },
    resize(w, h) {
      const rebuild = h !== city.H;
      city.W = w;
      city.H = h;
      if (rebuild) for (const m of city.chunks) m.clear();
    },
    say(text, b, ox, oy, color, opts = {}) {
      if (b) city.labels.push({ text, b, ox, oy, color, t0: city.t, dur: opts.dur ?? 4.5 });
      if (city.labels.length > 14) city.labels.shift();
      if (opts.term !== false) {
        city.term.push({ t: city.t, text, color });
        if (city.term.length > 6) city.term.shift();
      }
      const x = b ? city.sx(b.layer, b.x + ox) : city.W / 2;
      const y = b ? city.baseY(b.layer) - b.h + oy : city.H / 2;
      bus.emit({ type: 'say', text, x, y, color, priority: opts.priority ?? 'low' });
    },
    emit(type, x, y, weight, extra) {
      bus.emit({ type, x, y, weight, ...extra });
    },
  };
  return city;
}
