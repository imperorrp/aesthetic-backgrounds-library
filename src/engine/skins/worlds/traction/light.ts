/**
 * Traction's light: the hours of the hunting ground in four airs, the painter's environment
 * (a colour at a depth, at this hour), and the sprites everything big is baked into.
 *
 * A sprite is painted once in its own colours under a plain white light (top-lit: roofs and
 * ledges light, undersides dark), with its lit windows on a picture of their own and its edges
 * toward the sky on a third; then tinted by the hour (the colours multiplied by the light, the
 * haze of its distance laid over) whenever the light has moved on. At night the windows come up.
 */
import { hexA, mixRgb } from '../../instruments/kit';
import type { Mood } from './types';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, clamp01(k));
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};
export const posmod = (a: number, n: number) => ((a % n) + n) % n;
export { hexA };
export const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// ---- the hours ----------------------------------------------------------------------------------
/** top/mid/low: the sky; haze: the air at the horizon; amb: the light things are lit by; ink: the deepest shadow; sun: the sun's (or moon's) colour. */
export type Light = { top: string; mid: string; low: string; haze: string; amb: string; ink: string; sun: string; rim: number; cloud: string };
const KEYS: [number, Light][] = [
  [0.0, { top: '#05070d', mid: '#0b1120', low: '#18203a', haze: '#141a2c', amb: '#33405c', ink: '#05060a', sun: '#a8b8d8', rim: 0.3, cloud: '#1a2032' }],
  [0.2, { top: '#0a0e1a', mid: '#161c30', low: '#3a3244', haze: '#2a2836', amb: '#3c4258', ink: '#08080c', sun: '#c0a0a0', rim: 0.25, cloud: '#2a2a3a' }],
  [0.26, { top: '#34345a', mid: '#9a5c4c', low: '#f0a464', haze: '#b07860', amb: '#c88a6c', ink: '#1c1418', sun: '#ffb070', rim: 1, cloud: '#c8846a' }],
  [0.33, { top: '#6a7e98', mid: '#b4a28a', low: '#e8cca0', haze: '#bca688', amb: '#e8d4b8', ink: '#2a2420', sun: '#ffe0b0', rim: 0.8, cloud: '#d8c4a8' }],
  [0.5, { top: '#7a90a8', mid: '#b8b4a4', low: '#dcd2bc', haze: '#c2b8a4', amb: '#fff6e6', ink: '#302a24', sun: '#fff4dc', rim: 0.5, cloud: '#e4dccc' }],
  [0.67, { top: '#6c7c94', mid: '#b4a088', low: '#e6c69a', haze: '#c0a688', amb: '#f0d8b8', ink: '#2c2420', sun: '#ffdcaa', rim: 0.8, cloud: '#dcc0a0' }],
  [0.745, { top: '#3a3256', mid: '#a05844', low: '#f4945a', haze: '#b4705a', amb: '#d08060', ink: '#1e1416', sun: '#ffa060', rim: 1, cloud: '#c87458' }],
  [0.8, { top: '#151426', mid: '#3e2a3c', low: '#784238', haze: '#3e2e34', amb: '#5a4454', ink: '#0c0a10', sun: '#e08060', rim: 0.5, cloud: '#3a2a34' }],
  [0.87, { top: '#070912', mid: '#0e1424', low: '#1e2438', haze: '#181c2c', amb: '#34405a', ink: '#05060a', sun: '#a8b8d8', rim: 0.3, cloud: '#1c2232' }],
  [1.0, { top: '#05070d', mid: '#0b1120', low: '#18203a', haze: '#141a2c', amb: '#33405c', ink: '#05060a', sun: '#a8b8d8', rim: 0.3, cloud: '#1a2032' }],
];
/** The airs: the same hours in another hunting ground. */
export const MOODS: Record<Mood, { hue: number; pull: number; sat: number; lum: number; label: string; mud: [string, string, string]; grass: string }> = {
  ochre: { hue: 34, pull: 0.15, sat: 1.05, lum: 1, label: 'the ochre plain', mud: ['#5a4630', '#8a7050', '#3a2c1e'], grass: '#7a7040' },
  ash: { hue: 215, pull: 0.45, sat: 0.6, lum: 0.96, label: 'the ash plain', mud: ['#4a4644', '#7a7470', '#2a2826'], grass: '#5a5a48' },
  rust: { hue: 12, pull: 0.45, sat: 1.25, lum: 0.92, label: 'the rust plain', mud: ['#5e3a2a', '#8e5c40', '#3a2018'], grass: '#7a5a3a' },
  peat: { hue: 95, pull: 0.3, sat: 0.85, lum: 0.95, label: 'the peat plain', mud: ['#3e3a28', '#6a644a', '#26241a'], grass: '#5a6a38' },
};
const toHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
};
const fromHsl = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('')}`;
};
const shift = (hex: string, A: (typeof MOODS)[Mood], k = 1) => {
  const [h, s, l] = toHsl(hex);
  let dh = ((A.hue - h + 540) % 360) - 180;
  if (s < 0.04) dh = 0;
  const far = Math.abs(dh) > 80;
  const hue = far ? h : (h + dh * A.pull * k + 360) % 360;
  const sat = far ? s * (1 - 0.35 * A.pull * k) : s * (1 + (A.sat - 1) * k);
  return fromHsl(hue, clamp01(sat), clamp01(l * (1 + (A.lum - 1) * k)));
};
const MOOD_KEYS: Record<Mood, [number, Light][]> = Object.fromEntries(
  (Object.keys(MOODS) as Mood[]).map((m) => {
    const A = MOODS[m];
    return [m, KEYS.map(([d, L]) => [d, { ...L, top: shift(L.top, A, 0.6), mid: shift(L.mid, A), low: shift(L.low, A), haze: shift(L.haze, A), amb: shift(L.amb, A, 0.5), ink: shift(L.ink, A, 0.5), sun: shift(L.sun, A, 0.3), cloud: shift(L.cloud, A) }] as [number, Light])];
  }),
) as Record<Mood, [number, Light][]>;

export function lightAt(day: number, mood: Mood, rain: number): Light {
  const K = MOOD_KEYS[mood];
  let a = K[0];
  let b = K[K.length - 1];
  for (let i = 0; i < K.length - 1; i++)
    if (day >= K[i][0] && day <= K[i + 1][0]) {
      a = K[i];
      b = K[i + 1];
      break;
    }
  const k = (day - a[0]) / Math.max(1e-6, b[0] - a[0]);
  const c = (x: keyof Light) => mix(a[1][x] as string, b[1][x] as string, k);
  const grey = mix(c('haze'), '#5a5e66', 0.6);
  return {
    top: mix(c('top'), mix(grey, '#2a2e36', 0.4), rain * 0.7),
    mid: mix(c('mid'), grey, rain * 0.75),
    low: mix(c('low'), grey, rain * 0.7),
    haze: mix(c('haze'), grey, rain * 0.7),
    amb: mix(c('amb'), mix(c('amb'), '#8890a0', 0.5), rain * 0.6),
    ink: c('ink'),
    sun: c('sun'),
    rim: (a[1].rim + (b[1].rim - a[1].rim) * k) * (1 - rain * 0.75),
    cloud: mix(c('cloud'), mix(grey, '#3a3e46', 0.5), rain * 0.8),
  };
}
export const nightOf = (d: number) => clamp01(d > 0.3 && d < 0.72 ? 0 : d <= 0.21 || d >= 0.85 ? 1 : d < 0.5 ? (0.3 - d) / 0.09 : (d - 0.72) / 0.13);
export const goldenOf = (d: number) => Math.max(0, 1 - Math.abs(d - 0.265) / 0.05) + Math.max(0, 1 - Math.abs(d - 0.745) / 0.05);

const HOURS = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];
export function timeWords(day: number): string {
  const mins = Math.round((day * 24 * 60) / 15) * 15;
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const part = (hh: number) => (hh < 5 ? 'IN THE NIGHT' : hh < 12 ? 'IN THE MORNING' : hh < 18 ? 'IN THE AFTERNOON' : hh < 21 ? 'IN THE EVENING' : 'IN THE NIGHT');
  const name = (hh: number) => (hh === 12 ? 'NOON' : hh === 0 ? 'MIDNIGHT' : HOURS[hh % 12]);
  if (m === 0) return h === 12 || h === 0 ? name(h) : `${name(h)} ${part(h)}`;
  const words = m === 15 ? 'A QUARTER PAST' : m === 30 ? 'HALF PAST' : 'A QUARTER TO';
  if (m > 30) h = (h + 1) % 24;
  return `${words} ${name(h)}${h === 12 || h === 0 ? '' : ` ${part(h)}`}`;
}

// ---- the painter's environment -----------------------------------------------------------------------
export type Env = {
  ctx: CanvasRenderingContext2D;
  u: number;
  t: number;
  day: number;
  L: Light;
  night: number;
  rain: number;
  wind: number;
  /** How thick the air is at a depth (0 near, 1 the horizon), 0..1. */
  hazeOf(d: number): number;
  hazeCol(d: number): string;
  /** A colour at a depth: lit by the hour, faded into the haze (lift: toward the sun). */
  tone(c: string, d: number, lift?: number): string;
  glow(x: number, y: number, r: number, color: string, a: number): void;
  soft(color: string): HTMLCanvasElement;
  serif(px: number, italic?: boolean): string;
};

export function createEnv(ctx: CanvasRenderingContext2D, u: number, mood: Mood) {
  const glowCache = new Map<string, HTMLCanvasElement>();
  const softCache = new Map<string, HTMLCanvasElement>();
  const mulC = (a: string, b: string) => {
    const [r1, g1, b1] = mixRgb(a, a, 0);
    const [r2, g2, b2] = mixRgb(b, b, 0);
    return `#${[(r1 * r2) / 255, (g1 * g2) / 255, (b1 * b2) / 255].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  };
  const E: Env & { set(t: number, day: number, rain: number, wind: number): void } = {
    ctx, u, t: 0, day: 0.4, L: lightAt(0.4, mood, 0), night: 0, rain: 0, wind: 0,
    hazeOf: (d) => clamp01(Math.pow(clamp01(d), 1.35) * (0.86 + E.rain * 0.1) + E.rain * 0.12 * clamp01(d + 0.3)),
    hazeCol: (d) => mix(E.L.haze, E.L.low, clamp01(d - 0.6) * 0.8),
    tone: (c, d, lift = 0) => mix(mix(mulC(c, E.L.amb), E.L.sun, lift * E.L.rim * (1 - E.night * 0.7) * 0.5), E.hazeCol(d), E.hazeOf(d)),
    glow(x, y, rad, color, a) {
      if (a <= 0.01 || rad <= 0) return;
      let c = glowCache.get(color);
      if (!c) {
        c = mk(64, 64);
        const g = c.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, hexA(color, 1));
        gr.addColorStop(0.3, hexA(color, 0.35));
        gr.addColorStop(1, hexA(color, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        glowCache.set(color, c);
      }
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(c, x - rad, y - rad, rad * 2, rad * 2);
      ctx.globalAlpha = prev;
    },
    soft(color) {
      const q = color.replace(/[0-9a-f]{2}/gi, (h) => Math.min(255, Math.round(parseInt(h, 16) / 10) * 10).toString(16).padStart(2, '0'));
      let c = softCache.get(q);
      if (!c) {
        c = mk(64, 64);
        const g = c.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, hexA(q, 0.95));
        gr.addColorStop(0.5, hexA(q, 0.55));
        gr.addColorStop(1, hexA(q, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        if (softCache.size > 300) softCache.clear();
        softCache.set(q, c);
      }
      return c;
    },
    serif: (px, italic = false) => `${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`,
    set(t, day, rain, wind) {
      E.t = t;
      E.day = day;
      E.rain = rain;
      E.wind = wind;
      E.night = nightOf(day) * (1 - rain * 0.2);
      E.L = lightAt(day, mood, rain);
    },
  };
  return E;
}

// ---- sprites ------------------------------------------------------------------------------------------
export type Sprite = {
  /** The colours under white light; lit windows; the edges toward the sky (white where lit). */
  base: HTMLCanvasElement; win: HTMLCanvasElement | null; rim: HTMLCanvasElement | null;
  tint: HTMLCanvasElement; rimT: HTMLCanvasElement | null;
  /** Where the sprite's origin is on it (px), and its pixels per unit. */
  ox: number; oy: number; res: number;
  at: { day: number; rain: number; d: number };
};
export function sprite(w: number, h: number, ox: number, oy: number, res: number, wins = true, rims = true): Sprite & { g: CanvasRenderingContext2D; wg: CanvasRenderingContext2D | null; rg: CanvasRenderingContext2D | null } {
  const base = mk(w, h);
  const win = wins ? mk(w, h) : null;
  const rim = rims ? mk(w, h) : null;
  const g = base.getContext('2d')!;
  const wg = win ? win.getContext('2d')! : null;
  const rg = rim ? rim.getContext('2d')! : null;
  for (const c of [g, wg, rg]) {
    if (!c) continue;
    c.translate(ox, oy);
    c.scale(res, res);
  }
  return { base, win, rim, tint: mk(w, h), rimT: rims ? mk(w, h) : null, ox, oy, res, at: { day: -1, rain: 0, d: 0 }, g, wg, rg };
}
/** Bring a sprite's tint up to the hour at depth d. */
export function tintSprite(E: Env, s: Sprite, d: number, grade?: (t: CanvasRenderingContext2D, w: number, h: number) => void) {
  const t = s.tint.getContext('2d')!;
  const w = s.tint.width;
  const h = s.tint.height;
  t.globalCompositeOperation = 'source-over';
  t.globalAlpha = 1;
  t.clearRect(0, 0, w, h);
  t.drawImage(s.base, 0, 0);
  t.globalCompositeOperation = 'multiply';
  t.fillStyle = E.L.amb;
  t.fillRect(0, 0, w, h);
  t.globalCompositeOperation = 'destination-in';
  t.drawImage(s.base, 0, 0);
  const hz = E.hazeOf(d);
  if (hz > 0.01) {
    t.globalCompositeOperation = 'source-atop';
    t.globalAlpha = hz;
    t.fillStyle = E.hazeCol(d);
    t.fillRect(0, 0, w, h);
    t.globalAlpha = 1;
  }
  if (grade) {
    t.globalCompositeOperation = 'source-atop';
    grade(t, w, h);
    t.globalAlpha = 1;
  }
  t.globalCompositeOperation = 'source-over';
  if (s.rim && s.rimT) {
    const r = s.rimT.getContext('2d')!;
    r.globalCompositeOperation = 'source-over';
    r.clearRect(0, 0, w, h);
    r.drawImage(s.rim, 0, 0);
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = E.L.sun;
    r.fillRect(0, 0, w, h);
    r.globalCompositeOperation = 'source-over';
  }
  s.at = { day: E.day, rain: E.rain, d };
}
/** How far the light has moved on since a sprite was tinted (over 1: tint now). */
export function drift(E: Env, s: Sprite, d: number) {
  if (s.at.day < 0) return 9;
  const dd = Math.abs(E.day - s.at.day);
  return Math.max(Math.min(dd, 1 - dd) * 120, Math.abs(E.rain - s.at.rain) * 10, Math.abs(d - s.at.d) * 20);
}
/** Draw a sprite with its origin at (x, y), scaled by k (screen px per sprite unit / res), flipped for dir. */
export function drawSprite(E: Env, s: Sprite, x: number, y: number, k: number, dir: 1 | -1, lit = 1, windows = 1) {
  const c = E.ctx;
  const sc = k / s.res;
  c.save();
  c.translate(x, y);
  c.scale(dir * sc, sc);
  c.drawImage(s.tint, -s.ox, -s.oy);
  if (s.rimT && lit > 0.02) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = clamp01(lit);
    c.drawImage(s.rimT, -s.ox, -s.oy);
  }
  if (s.win && windows > 0.02) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = clamp01(windows);
    c.drawImage(s.win, -s.ox, -s.oy);
  }
  c.restore();
}
