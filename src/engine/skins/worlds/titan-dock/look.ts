/**
 * Titan Dock's light: the hours of a stormy coast in four moods, and what the drawing shares.
 *
 * The hours run night, grey dawn, a storm-lit day, a red dusk, night again. A mood is the same
 * hours under another sky: sodium (the city's orange under the clouds), teal (sea-green night,
 * amber lights), violet (neon on the clouds), grey (cold, white lights). Outside things are toned
 * by the hour and faded by distance into the rain-haze; the dock's inside keeps its own work
 * lights.
 */
import { hexA, mixRgb } from '../../instruments/kit';
import type { Mood } from './types';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, clamp01(k));
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};
export { hexA };
export const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export type Light = {
  /** The sky: top, middle, at the horizon. */
  top: string; mid: string; low: string;
  /** The sea near and deep, the crest of a wave, the haze of the rain at a distance. */
  sea: string; deep: string; crest: string; haze: string;
  /** The darkest ink of the hour, the light on things (sun or sky), the city's glow under the clouds. */
  ink: string; key: string; glow: string;
  /** The interior's work lights. */
  work: string;
  rim: number; night: number;
};

type Key = Omit<Light, 'glow' | 'work' | 'night'>;
const KEYS: [number, Key][] = [
  [0.0, { top: '#05080d', mid: '#0b141c', low: '#1a2a34', sea: '#0c171e', deep: '#04090c', crest: '#3a5a68', haze: '#16242c', ink: '#03060a', key: '#8aa4b8', rim: 0.3 }],
  [0.2, { top: '#070b12', mid: '#121a26', low: '#2a3442', sea: '#101a24', deep: '#060a10', crest: '#46606e', haze: '#1e2834', ink: '#05070c', key: '#9aaabe', rim: 0.3 }],
  [0.27, { top: '#2a3040', mid: '#5a5462', low: '#b4847a', sea: '#2e3640', deep: '#121820', crest: '#8a8c94', haze: '#6a6670', ink: '#121418', key: '#e8b8a0', rim: 0.7 }],
  [0.36, { top: '#46525c', mid: '#6c7a82', low: '#98a4a8', sea: '#3c4c54', deep: '#1a2428', crest: '#a8b8bc', haze: '#7c888c', ink: '#161c20', key: '#e8eef0', rim: 0.55 }],
  [0.6, { top: '#4a5660', mid: '#6e7c84', low: '#9aa6aa', sea: '#3e4e56', deep: '#1a2428', crest: '#aabcc0', haze: '#7e8a8e', ink: '#161c20', key: '#eef2f4', rim: 0.5 }],
  [0.72, { top: '#2e3446', mid: '#6a4a52', low: '#d2784a', sea: '#2e3038', deep: '#12141a', crest: '#b88a70', haze: '#6e5a5a', ink: '#120e12', key: '#ffb880', rim: 0.85 }],
  [0.8, { top: '#0c1018', mid: '#20202e', low: '#4a3a44', sea: '#141a22', deep: '#070a0e', crest: '#5a5a66', haze: '#2a2a34', ink: '#06070c', key: '#a8a4c0', rim: 0.35 }],
  [0.86, { top: '#05080d', mid: '#0b141c', low: '#1a2a34', sea: '#0c171e', deep: '#04090c', crest: '#3a5a68', haze: '#16242c', ink: '#03060a', key: '#8aa4b8', rim: 0.3 }],
  [1.0, { top: '#05080d', mid: '#0b141c', low: '#1a2a34', sea: '#0c171e', deep: '#04090c', crest: '#3a5a68', haze: '#16242c', ink: '#03060a', key: '#8aa4b8', rim: 0.3 }],
];
/** Each mood: a tint pulled into the sky and the sea (more by night), the city's glow, the dock's lamps. */
export const MOODS: Record<Mood, { tint: string; pull: number; glow: string; work: string; rift: string; label: string }> = {
  sodium: { tint: '#5a3a1e', pull: 0.35, glow: '#ff9a3c', work: '#ffc078', rift: '#5ae0ff', label: 'sodium night' },
  teal: { tint: '#0e4a4c', pull: 0.45, glow: '#ffa24a', work: '#ffd49a', rift: '#3af0ff', label: 'sea-green night' },
  violet: { tint: '#3a1e58', pull: 0.45, glow: '#ff58c0', work: '#e8d0ff', rift: '#60f0ff', label: 'neon night' },
  grey: { tint: '#28323c', pull: 0.25, glow: '#cfe0ff', work: '#eaf2ff', rift: '#ff9a40', label: 'cold grey' },
};
export const nightOf = (d: number) => clamp01(d > 0.33 && d < 0.68 ? 0 : d <= 0.22 || d >= 0.84 ? 1 : d < 0.5 ? (0.33 - d) / 0.11 : (d - 0.68) / 0.16);

export function lightAt(day: number, mood: Mood, storm: number): Light {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++)
    if (day >= KEYS[i][0] && day <= KEYS[i + 1][0]) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  const k = (day - a[0]) / Math.max(1e-6, b[0] - a[0]);
  const M = MOODS[mood];
  const night = nightOf(day);
  const pull = M.pull * (0.45 + 0.55 * night);
  const c = (x: keyof Key, p = 1) => mix(mix(a[1][x] as string, b[1][x] as string, k), M.tint, pull * p);
  const grey = '#3a4246';
  return {
    top: mix(c('top'), grey, storm * 0.2),
    mid: mix(c('mid'), grey, storm * 0.15),
    low: mix(c('low', 0.6), mix(grey, M.glow, night * 0.3), storm * 0.15 + night * 0.25),
    sea: c('sea', 0.8),
    deep: c('deep', 0.6),
    crest: c('crest', 0.5),
    haze: mix(c('haze', 0.6), grey, storm * 0.25),
    ink: c('ink', 0.4),
    key: c('key', 0.2),
    glow: M.glow,
    work: M.work,
    rim: (a[1].rim + (b[1].rim - a[1].rim) * k) * (1 - storm * 0.3),
    night,
  };
}

const HOURS = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];
/** The hour as a clock on the wall reads it: 03:40. */
export function clockOf(day: number): string {
  const mins = Math.floor(day * 24 * 60);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
export function partOf(day: number): string {
  const h = Math.floor(day * 24) % 24;
  void HOURS;
  return h < 5 ? 'THE SMALL HOURS' : h < 8 ? 'DAWN' : h < 12 ? 'MORNING' : h < 17 ? 'AFTERNOON' : h < 20 ? 'DUSK' : 'NIGHT';
}

/** What the drawing shares: the light now, the tone of a thing at a distance, glows and soft sprites. */
export type Env = {
  ctx: CanvasRenderingContext2D; u: number; t: number; day: number; L: Light; storm: number; flash: number; mood: Mood;
  /** A colour out of doors at distance d (0 near, 1 the horizon): in the ink of the hour, faded into the haze (lift: toward the light). */
  tone(c: string, d: number, lift?: number): string;
  hazeOf(d: number): number;
  glow(x: number, y: number, r: number, color: string, a: number): void;
  soft(color: string): HTMLCanvasElement;
  set(t: number, day: number, storm: number, flash: number, fog: number): void;
};

export function createEnv(ctx: CanvasRenderingContext2D, u: number, mood: Mood): Env {
  const glowCache = new Map<string, HTMLCanvasElement>();
  const softCache = new Map<string, HTMLCanvasElement>();
  let fogK = 0;
  const E: Env = {
    ctx, u, t: 0, day: 0, L: lightAt(0, mood, 0), storm: 0, flash: 0, mood,
    tone: (c, d, lift = 0) => {
      const lit = mix(mix(c, E.L.ink, 0.18 + E.L.night * 0.5), E.L.key, lift * (0.5 + E.L.rim * 0.5) * (1 - E.L.night * 0.5) + E.flash * 0.35);
      return mix(lit, E.L.haze, E.hazeOf(d));
    },
    hazeOf: (d) => clamp01(Math.pow(clamp01(d), 1.3) * (0.82 + E.storm * 0.15) + fogK * (0.2 + d * 0.7)),
    glow(x, y, rad, color, a) {
      if (a <= 0.01 || rad <= 0.5) return;
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
        if (glowCache.size > 120) glowCache.clear();
        glowCache.set(color, c);
      }
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(c, x - rad, y - rad, rad * 2, rad * 2);
      ctx.globalAlpha = prev;
    },
    soft(color) {
      const q = color.replace(/[0-9a-f]{2}/gi, (h) => Math.min(255, Math.round(parseInt(h, 16) / 12) * 12).toString(16).padStart(2, '0'));
      let c = softCache.get(q);
      if (!c) {
        c = mk(64, 64);
        const g = c.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, hexA(q, 0.9));
        gr.addColorStop(0.5, hexA(q, 0.45));
        gr.addColorStop(1, hexA(q, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        if (softCache.size > 200) softCache.clear();
        softCache.set(q, c);
      }
      return c;
    },
    set(t, day, storm, flash, fog) {
      E.t = t;
      E.day = day;
      E.storm = storm;
      E.flash = flash;
      fogK = fog;
      E.L = lightAt(day, mood, storm);
    },
  };
  return E;
}
