/**
 * War Rig's light: the hours of the waste in a cinema grade (blazing orange where the sun falls,
 * teal in the shadows by day; deep blue under a big moon by night), four grades a seed can shoot
 * in, and the painter's environment: colours toned by the hour and the distance, cached glows and
 * soft sprites. Painter-only; the canvases are made the first time they are asked for.
 */
import { hash, hexA, mixRgb } from '../../instruments/kit';
import type { Grade } from './types';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const posmod = (a: number, n: number) => ((a % n) + n) % n;
export const mix = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, clamp01(k));
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};
export { hash, hexA };

export type Light = {
  /** The sky, top to horizon. */
  top: string; mid: string; low: string;
  /** The key light (sun or moon), the ground in it, the fill in the shadows (teal by day), the far haze, the darkest dark. */
  sun: string; ground: string; fill: string; haze: string; ink: string;
  /** How hard the key light rims things, 0..1. */
  rim: number;
};
const KEYS: [number, Light][] = [
  [0.0, { top: '#02060f', mid: '#071830', low: '#12355a', sun: '#a8d0f8', ground: '#22405e', fill: '#061428', haze: '#123452', ink: '#02060e', rim: 0.55 }],
  [0.2, { top: '#050c1e', mid: '#132447', low: '#3a3a5e', sun: '#c8b8d8', ground: '#2a3650', fill: '#0a1830', haze: '#2a2e4c', ink: '#03060e', rim: 0.35 }],
  [0.26, { top: '#1c3054', mid: '#a4503c', low: '#ffa860', sun: '#ff9a50', ground: '#a86a42', fill: '#1a3c50', haze: '#d88a5c', ink: '#120c12', rim: 1 }],
  [0.33, { top: '#1b5878', mid: '#dc8448', low: '#ffc888', sun: '#ffcf90', ground: '#d4884a', fill: '#1d5464', haze: '#eaa672', ink: '#1a1212', rim: 0.9 }],
  [0.5, { top: '#196884', mid: '#e89a52', low: '#ffdca4', sun: '#fff0d4', ground: '#e69850', fill: '#24606c', haze: '#f2bc8a', ink: '#201612', rim: 0.65 }],
  [0.66, { top: '#175674', mid: '#ea8a42', low: '#ffbe78', sun: '#ffd48c', ground: '#dc8640', fill: '#1d5262', haze: '#eea468', ink: '#1c1210', rim: 0.9 }],
  [0.735, { top: '#1a2850', mid: '#c4442a', low: '#ff7a32', sun: '#ff6a2a', ground: '#a24a28', fill: '#1a3448', haze: '#d25c38', ink: '#140a0c', rim: 1 }],
  [0.8, { top: '#081230', mid: '#24285a', low: '#5e3854', sun: '#d88a78', ground: '#33304a', fill: '#0a142a', haze: '#33294a', ink: '#04050e', rim: 0.4 }],
  [0.87, { top: '#02060f', mid: '#071830', low: '#12355a', sun: '#a8d0f8', ground: '#22405e', fill: '#061428', haze: '#123452', ink: '#02060e', rim: 0.55 }],
  [1.0, { top: '#02060f', mid: '#071830', low: '#12355a', sun: '#a8d0f8', ground: '#22405e', fill: '#061428', haze: '#123452', ink: '#02060e', rim: 0.55 }],
];

// ---- grades: the same hours shot on another stock -------------------------------------------------
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
/** A grade: warm hues pulled toward `warm`, cool ones toward `cool`, saturation and contrast scaled. */
const GRADES: Record<Grade, { warm: number; cool: number; pull: number; sat: number; con: number }> = {
  blaze: { warm: 28, cool: 192, pull: 0.15, sat: 1.05, con: 1 },
  crimson: { warm: 8, cool: 200, pull: 0.55, sat: 1.15, con: 1.05 },
  umber: { warm: 30, cool: 40, pull: 0.45, sat: 0.6, con: 1 },
  chrome: { warm: 30, cool: 210, pull: 0.3, sat: 0.12, con: 1.12 },
};
export function graded(hex: string, grade: Grade): string {
  const G = GRADES[grade];
  const [h, s, l] = toHsl(hex);
  const warm = h < 110 || h > 300;
  const to = warm ? G.warm : G.cool;
  const dh = ((to - h + 540) % 360) - 180;
  const hue = (h + dh * G.pull + 360) % 360;
  const lum = clamp01(0.5 + (l - 0.5) * G.con);
  return fromHsl(hue, clamp01(s * G.sat), lum);
}
const GRADED: Record<Grade, [number, Light][]> = Object.fromEntries(
  (Object.keys(GRADES) as Grade[]).map((gr) => [gr, KEYS.map(([d, L]) => [d, { ...L, top: graded(L.top, gr), mid: graded(L.mid, gr), low: graded(L.low, gr), sun: graded(L.sun, gr), ground: graded(L.ground, gr), fill: graded(L.fill, gr), haze: graded(L.haze, gr), ink: graded(L.ink, gr) }] as [number, Light])]),
) as Record<Grade, [number, Light][]>;

export function lightAt(day: number, grade: Grade, storm: number): Light {
  const K = GRADED[grade];
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
  // The toxic storm: everything into a choking orange-brown murk.
  const murk = graded('#6a3a1a', grade);
  return {
    top: mix(c('top'), mix(murk, '#1a0e08', 0.5), storm * 0.85),
    mid: mix(c('mid'), murk, storm * 0.8),
    low: mix(c('low'), mix(murk, '#c06a2a', 0.4), storm * 0.75),
    sun: mix(c('sun'), '#ffb070', storm * 0.5),
    ground: mix(c('ground'), murk, storm * 0.5),
    fill: mix(c('fill'), '#2a1a12', storm * 0.6),
    haze: mix(c('haze'), murk, storm * 0.85),
    ink: c('ink'),
    rim: (a[1].rim + (b[1].rim - a[1].rim) * k) * (1 - storm * 0.7),
  };
}
export const nightOf = (d: number) => clamp01(d > 0.29 && d < 0.72 ? 0 : d <= 0.2 || d >= 0.85 ? 1 : d < 0.5 ? (0.29 - d) / 0.09 : (d - 0.72) / 0.13);
export const goldenOf = (d: number) => Math.max(0, 1 - Math.abs(d - 0.27) / 0.05) + Math.max(0, 1 - Math.abs(d - 0.735) / 0.05);
export const heatOf = (d: number) => clamp01(1 - Math.abs(d - 0.55) / 0.2);

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

export const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export type Env = {
  ctx: CanvasRenderingContext2D;
  u: number;
  t: number;
  day: number;
  grade: Grade;
  L: Light;
  night: number;
  storm: number;
  /** Where the key light is in the sky (world x, y), and whether it is the sun (1) or the moon (0). */
  keyX: number;
  keyY: number;
  sunUp: number;
  /** A colour at a distance (0 near, 1 the horizon): toward the shadow fill, lit by the key light by `lift` (0..1), faded into the haze. */
  tone(c: string, d: number, lift?: number): string;
  hazeOf(d: number): number;
  glow(x: number, y: number, r: number, color: string, a: number): void;
  soft(color: string): HTMLCanvasElement;
  /** A grade-aware colour for a material (so chrome stays chrome in a red waste). */
  g(c: string): string;
};

/** The painter's environment; `set` it each frame with the hour and the weather. */
export function createEnv(ctx: CanvasRenderingContext2D, u: number, grade: Grade) {
  const glowCache = new Map<string, HTMLCanvasElement>();
  const softCache = new Map<string, HTMLCanvasElement>();
  const gradeCache = new Map<string, string>();
  const toneCache = new Map<string, string>();
  const E: Env & { set(t: number, day: number, storm: number, keyX: number, keyY: number, sunUp: number): void; clear(): void } = {
    ctx, u, t: 0, day: 0.4, grade, L: lightAt(0.4, grade, 0), night: 0, storm: 0, keyX: 0, keyY: 0, sunUp: 1,
    g(c) {
      let v = gradeCache.get(c);
      if (!v) {
        v = graded(c, grade);
        gradeCache.set(c, v);
      }
      return v;
    },
    tone(c, d, lift = 0) {
      const key = `${c}|${Math.round(d * 40)}|${Math.round(lift * 20)}`;
      let v = toneCache.get(key);
      if (v) return v;
      const L = E.L;
      const base = mix(E.g(c), L.fill, 0.28 + E.night * 0.5);
      const lit = mix(base, L.sun, lift * 0.6 * (1 - E.night * 0.55));
      v = mix(lit, L.haze, E.hazeOf(d));
      if (toneCache.size > 4000) toneCache.clear();
      toneCache.set(key, v);
      return v;
    },
    hazeOf: (d) => clamp01(Math.pow(clamp01(d), 1.5) * 0.9 + E.storm * (0.25 + d * 0.6)),
    glow(x, y, rad, color, a) {
      if (a <= 0.01 || rad <= 0) return;
      let c = glowCache.get(color);
      if (!c) {
        c = mk(64, 64);
        const g = c.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, hexA(color, 1));
        gr.addColorStop(0.3, hexA(color, 0.4));
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
        gr.addColorStop(0.45, hexA(q, 0.6));
        gr.addColorStop(1, hexA(q, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        if (softCache.size > 300) softCache.clear();
        softCache.set(q, c);
      }
      return c;
    },
    set(t, day, storm, keyX, keyY, sunUp) {
      E.t = t;
      if (Math.abs(day - E.day) > 0.0005 || Math.abs(storm - E.storm) > 0.004) toneCache.clear();
      E.day = day;
      E.storm = storm;
      E.night = nightOf(day) * (1 - storm * 0.2);
      E.L = lightAt(day, grade, storm);
      E.keyX = keyX;
      E.keyY = keyY;
      E.sunUp = sunUp;
    },
    clear() {
      glowCache.clear();
      softCache.clear();
      toneCache.clear();
    },
  };
  return E;
}
