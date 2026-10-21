/**
 * The desert, shared by Sandsea (the open sand) and Windtrap (the hold in the cliff): the light of
 * its hours and its airs, the sky with its sun and two moons, the dunes in their bands, the
 * sandworm in all its states, the machines that work the sand (crawlers, carryalls,
 * ornithopters), the desert folk, and the storm.
 *
 * Space here is the painter's: world pixels on the screen, and a distance `d` (0 near, 1 the
 * horizon) that fades a colour into the desert haze. Everything takes a scale `m` (1 near).
 */
import { hash, hexA, mixRgb } from '../../instruments/kit';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, clamp01(k));
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};
export const posmod = (a: number, n: number) => ((a % n) + n) % n;
export { hexA };

// ---- the light through the day ---------------------------------------------------------------
export type Light = { top: string; mid: string; low: string; sand: string; sun: string; haze: string; ink: string; rim: number };
const KEYS: [number, Light][] = [
  [0.0, { top: '#05070f', mid: '#0a1022', low: '#151c36', sand: '#242a46', sun: '#b8c4e0', haze: '#141a30', ink: '#06080f', rim: 0.35 }],
  [0.21, { top: '#0c1026', mid: '#1e2040', low: '#4a3850', sand: '#2e2c42', sun: '#d8a090', haze: '#302a44', ink: '#0a0a16', rim: 0.3 }],
  [0.27, { top: '#3a3868', mid: '#a86050', low: '#f0ac6a', sand: '#a87050', sun: '#ffb070', haze: '#c08868', ink: '#2a1a1c', rim: 1 }],
  [0.34, { top: '#7a9cc4', mid: '#c8bca8', low: '#f0ddb8', sand: '#d4a470', sun: '#fff0d0', haze: '#dcc4a0', ink: '#3a2e24', rim: 0.8 }],
  [0.5, { top: '#98b4d4', mid: '#e4dccc', low: '#fff2dc', sand: '#e6c08a', sun: '#ffffff', haze: '#ece0c8', ink: '#4a3a2a', rim: 0.45 }],
  [0.66, { top: '#86a4cc', mid: '#dccbb0', low: '#f8e2bc', sand: '#deb078', sun: '#fff2d4', haze: '#e0c8a4', ink: '#3e3024', rim: 0.75 }],
  [0.73, { top: '#4a3c70', mid: '#bc6650', low: '#ff9850', sand: '#b46a48', sun: '#ff9050', haze: '#c88060', ink: '#2c1a1a', rim: 1 }],
  [0.79, { top: '#181838', mid: '#4e3454', low: '#8c5048', sand: '#4c3a48', sun: '#e08060', haze: '#3c2c3c', ink: '#100c16', rim: 0.45 }],
  [0.86, { top: '#06081a', mid: '#0c1226', low: '#182040', sand: '#262c4a', sun: '#b8c4e0', haze: '#161c34', ink: '#06080f', rim: 0.35 }],
  [1.0, { top: '#05070f', mid: '#0a1022', low: '#151c36', sand: '#242a46', sun: '#b8c4e0', haze: '#141a30', ink: '#06080f', rim: 0.35 }],
];
/** The airs: the same hours in another desert. */
export type Air = 'bone' | 'rose' | 'ochre' | 'ash';
export const AIRS: Record<Air, { hue: number; pull: number; sat: number; lum: number; label: string }> = {
  bone: { hue: 38, pull: 0, sat: 1, lum: 1, label: 'the white desert' },
  rose: { hue: 10, pull: 0.5, sat: 1.25, lum: 0.94, label: 'the red desert' },
  ochre: { hue: 42, pull: 0.5, sat: 1.3, lum: 0.96, label: 'the yellow desert' },
  ash: { hue: 220, pull: 0.5, sat: 0.55, lum: 0.9, label: 'the grey desert' },
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
const shift = (hex: string, A: (typeof AIRS)[Air], k = 1) => {
  const [h, s, l] = toHsl(hex);
  let dh = ((A.hue - h + 540) % 360) - 180;
  if (s < 0.04) dh = 0;
  // A colour far round the wheel (a blue sky in a yellow air) is not turned through green to get
  // there: it only greys toward the air, which keeps the sky a sky.
  const far = Math.abs(dh) > 70;
  const hue = far ? h : (h + dh * A.pull * k + 360) % 360;
  const sat = far ? s * (1 - 0.45 * A.pull * k) : s * (1 + (A.sat - 1) * k);
  return fromHsl(hue, clamp01(sat), clamp01(l * (1 + (A.lum - 1) * k)));
};
const AIR_KEYS: Record<Air, [number, Light][]> = Object.fromEntries(
  (Object.keys(AIRS) as Air[]).map((a) => {
    const A = AIRS[a];
    return [a, KEYS.map(([d, L]) => [d, { ...L, top: shift(L.top, A, 0.7), mid: shift(L.mid, A), low: shift(L.low, A), sand: shift(L.sand, A), haze: shift(L.haze, A), ink: shift(L.ink, A, 0.5), sun: shift(L.sun, A, 0.3) }] as [number, Light])];
  }),
) as Record<Air, [number, Light][]>;

export function lightAt(day: number, air: Air, storm: number): Light {
  const K = AIR_KEYS[air];
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
  // A storm's dust: everything toward the colour of the sand in the air.
  const dust = mix(c('sand'), '#8a6a44', 0.5);
  return {
    top: mix(c('top'), dust, storm * 0.7),
    mid: mix(c('mid'), dust, storm * 0.75),
    low: mix(c('low'), dust, storm * 0.7),
    sand: mix(c('sand'), dust, storm * 0.4),
    sun: c('sun'),
    haze: mix(c('haze'), dust, storm * 0.8),
    ink: c('ink'),
    rim: (a[1].rim + (b[1].rim - a[1].rim) * k) * (1 - storm * 0.8),
  };
}
export const nightOf = (d: number) => clamp01(d > 0.3 && d < 0.72 ? 0 : d <= 0.21 || d >= 0.86 ? 1 : d < 0.5 ? (0.3 - d) / 0.09 : (d - 0.72) / 0.14);
export const goldenOf = (d: number) => Math.max(0, 1 - Math.abs(d - 0.27) / 0.05) + Math.max(0, 1 - Math.abs(d - 0.73) / 0.05);
/** How hot it is, 0..1: the heat of the day, for the shimmer and the heat haze. */
export const heatOf = (d: number) => clamp01(1 - Math.abs(d - 0.56) / 0.2);

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

// ---- what the drawing shares ------------------------------------------------------------------
export type DEnv = {
  ctx: CanvasRenderingContext2D;
  u: number;
  t: number;
  day: number;
  light: Light;
  night: number;
  storm: number;
  wind: number;
  /** A colour at a distance (0 near, 1 the horizon): in the ink of the hour, faded into the haze (lift: toward the sun). */
  tone(c: string, d: number, lift?: number): string;
  hazeOf(d: number): number;
  glow(x: number, y: number, r: number, color: string, a: number): void;
  soft(color: string): HTMLCanvasElement;
};

export const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

/** The painter's environment; `set` it each frame with the hour and the weather. */
export function createDEnv(ctx: CanvasRenderingContext2D, u: number, hazeK = 0.85) {
  const glowCache = new Map<string, HTMLCanvasElement>();
  const softCache = new Map<string, HTMLCanvasElement>();
  const E: DEnv & { set(t: number, day: number, air: Air, storm: number, wind: number, dust: number): void } = {
    ctx, u, t: 0, day: 0.4, light: lightAt(0.4, 'bone', 0), night: 0, storm: 0, wind: 0,
    tone: (c, d, lift = 0) => mix(mix(mix(c, E.light.ink, 0.2 + E.night * 0.55), E.light.sun, lift * (1 - E.night * 0.7)), mix(E.light.haze, E.light.low, (1 - d) * 0.3), E.hazeOf(d)),
    hazeOf: (d) => clamp01(Math.pow(clamp01(d), 1.6) * hazeK + dustK * (0.3 + d * 0.6)),
    glow(x, y, rad, color, a) {
      if (a <= 0.01 || rad <= 0) return;
      let c = glowCache.get(color);
      if (!c) {
        c = mk(64, 64);
        const g = c.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, hexA(color, 1));
        gr.addColorStop(0.35, hexA(color, 0.35));
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
      const q = color.replace(/[0-9a-f]{2}/gi, (h) => Math.min(255, Math.round(parseInt(h, 16) / 12) * 12).toString(16).padStart(2, '0'));
      let c = softCache.get(q);
      if (!c) {
        c = mk(64, 64);
        const g = c.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, hexA(q, 0.9));
        gr.addColorStop(0.5, hexA(q, 0.5));
        gr.addColorStop(1, hexA(q, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        if (softCache.size > 200) softCache.clear();
        softCache.set(q, c);
      }
      return c;
    },
    set(t, day, air, storm, wind, dust) {
      E.t = t;
      E.day = day;
      E.storm = storm;
      E.wind = wind;
      E.night = nightOf(day) * (1 - storm * 0.3);
      E.light = lightAt(day, air, storm);
      dustK = dust;
    },
  };
  let dustK = 0;
  return E;
}

// ---- the sky ----------------------------------------------------------------------------------
export type SkyOpts = { horizon: number; W: number; H: number; stars: [number, number, number][]; moons: [number, number]; sunX?: (k: number) => number; moonX?: (k: number) => number };
/** The sky down to the horizon: its gradient, the stars, the sun with its glare (or the two moons). */
export function drawSky(E: DEnv, o: SkyOpts) {
  const { ctx, light, night } = E;
  const { W, H, horizon } = o;
  const sg = ctx.createLinearGradient(0, 0, 0, horizon);
  sg.addColorStop(0, light.top);
  sg.addColorStop(0.55, light.mid);
  sg.addColorStop(1, light.low);
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);
  const veil = (1 - E.storm * 0.9) * (1 - E.hazeOf(0.2) * 0.3);
  if (night > 0.1 && E.storm < 0.7) {
    for (const [x0, y0, k] of o.stars) {
      const tw = 0.6 + 0.4 * Math.sin(E.t * (0.8 + k * 2) + k * 40);
      ctx.fillStyle = `rgba(240,240,250,${(night * (0.2 + k * 0.7) * tw * veil).toFixed(3)})`;
      const sz = k > 0.92 ? 2 * E.u : 1.1 * E.u;
      ctx.fillRect(x0 * W, y0 * horizon * 0.98, sz, sz);
    }
  }
  // The sun: a huge disc at noon, white; a red one on the horizon.
  const sk = (E.day - 0.25) / 0.5;
  const gold = goldenOf(E.day);
  if (sk > -0.04 && sk < 1.04) {
    const sx = o.sunX ? o.sunX(clamp01(sk)) : W * (0.08 + 0.84 * clamp01(sk));
    const sy = horizon + 10 * E.u - Math.sin(clamp01(sk) * Math.PI) * horizon * 0.86;
    E.glow(sx, sy, (300 + gold * 200) * E.u, light.sun, 0.45 * veil);
    E.glow(sx, sy, 120 * E.u, '#fff6e8', 0.55 * veil);
    ctx.fillStyle = hexA(mix('#fff8ee', light.sun, 0.4 + gold * 0.5), 0.96 * veil);
    ctx.beginPath();
    ctx.arc(sx, sy, (30 + gold * 22) * E.u, 0, Math.PI * 2);
    ctx.fill();
    // The glare on the horizon under it by day.
    const hg = ctx.createLinearGradient(0, horizon - 60 * E.u, 0, horizon);
    hg.addColorStop(0, hexA(light.sun, 0));
    hg.addColorStop(1, hexA(light.sun, 0.35 * (1 - gold * 0.5) * veil * (1 - night)));
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - 60 * E.u, W, 60 * E.u);
  }
  // Two moons at night: a big one and a small one, each in its phase.
  const mk2 = (((E.day + 0.5) % 1) - 0.25) / 0.5;
  if (mk2 > -0.05 && mk2 < 1.05 && night > 0.15) {
    const mv = night * (1 - E.storm * 0.9);
    for (const [i, phase] of o.moons.entries()) {
      const k = clamp01(mk2 + (i ? 0.16 : 0));
      const mx = o.moonX ? o.moonX(k) : W * (0.1 + 0.8 * k) + (i ? W * 0.07 : 0);
      const my = horizon - Math.sin(k * Math.PI) * horizon * (i ? 0.62 : 0.8) + (i ? 20 * E.u : 0);
      const r = (i ? 11 : 24) * E.u;
      E.glow(mx, my, r * 3.4, mix('#d8dce8', light.sun, 0.2), 0.3 * mv);
      ctx.fillStyle = hexA(i ? '#d8ccb8' : '#e8e4da', 0.95 * mv);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      // The phase: the dark side as a disc of sky slid across.
      ctx.fillStyle = hexA(mix(light.top, light.mid, 0.4), 0.92 * mv);
      ctx.beginPath();
      ctx.arc(mx + r * 1.1 * Math.cos(phase * Math.PI * 2), my + r * 0.3 * Math.sin(phase * Math.PI * 2), r * 1.02, 0, Math.PI * 2);
      ctx.fill();
      if (!i) {
        ctx.fillStyle = hexA('#8a8478', 0.18 * mv);
        for (let q = 0; q < 6; q++) {
          ctx.beginPath();
          ctx.arc(mx + (hash(q, 1) - 0.5) * r * 1.1, my + (hash(q, 2) - 0.5) * r * 1.1, r * (0.08 + hash(q, 3) * 0.16), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

// ---- the dunes --------------------------------------------------------------------------------
/** A crest line: tall, sharp-topped dunes with smaller ones between, by a seed. Returns 0..1 at x. */
export function duneCrest(seed: number, scale: number) {
  const R = (k: number) => hash(seed, k);
  // One long swell of great dunes, and two smaller orders of them on its back: smooth, so the slip faces are long.
  const parts = Array.from({ length: 3 }, (_, i) => ({ w: (0.35 + i * 0.9 + R(i) * 0.3) / scale, p: R(i + 10) * 7, a: [1, 0.3, 0.1][i], k: i === 0 ? 1.6 : 1.3 }));
  return (x: number) => {
    let v = 0;
    let n = 0;
    for (const p of parts) {
      v += p.a * Math.pow(0.5 + 0.5 * Math.sin(x * p.w * 0.011 + p.p), p.k);
      n += p.a;
    }
    return v / n;
  };
}

/**
 * One band of dunes at a distance: the crest, the sand below it (to `bottom`), the slip faces in
 * shadow on the side away from the sun, ripples near, and sand streaming off the crests in wind.
 */
export function drawDunes(E: DEnv, o: { x0: number; x1: number; base: number; amp: number; crest: (x: number) => number; d: number; bottom: number; sunSide: number; seed: number; ripples?: boolean }) {
  const { ctx } = E;
  const { x0, x1, base, amp, crest, d, bottom } = o;
  const step = Math.max(2, 6 * (1 - d));
  const yAt = (x: number) => base - amp * crest(x);
  const lit = E.tone(E.light.sand, d, 0.5 + goldenOf(E.day) * 0.3);
  const shade = E.tone(mix(E.light.sand, E.light.ink, 0.45), d, 0);
  const deep = E.tone(mix(E.light.sand, E.light.ink, 0.35), d, 0);
  // The sand: lit at the crests, darker into the troughs.
  const g = ctx.createLinearGradient(0, base - amp, 0, bottom);
  g.addColorStop(0, lit);
  g.addColorStop(0.45, E.tone(E.light.sand, d, 0.2));
  g.addColorStop(1, E.tone(mix(E.light.sand, E.light.ink, 0.22), d, 0.02));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, yAt(x));
  ctx.lineTo(x1 + step, bottom);
  ctx.closePath();
  ctx.fill();
  // The slip faces: every face that falls away from the sun lies in shadow, deepest under the crest.
  // Three layers of it, each shallower, so the shadow is sharp at the crest and soft toward the trough.
  const depth = amp * 0.7;
  let runStart = -1;
  const minRun = Math.max(step * 3, 36 * E.u * (0.3 + 0.7 * (1 - d)));
  const flush = (xEnd: number) => {
    if (runStart < 0 || xEnd - runStart < minRun) {
      runStart = -1;
      return;
    }
    const run = xEnd - runStart;
    // Fade the run in at both ends, so no shadow starts with an edge.
    const ease = (q: number) => Math.min(1, q * 4, (1 - q) * 4);
    for (const [layer, a] of [[1, 0.2], [0.6, 0.22], [0.3, 0.26]] as const) {
      ctx.fillStyle = hexA(shade, a * (0.7 + E.light.rim * 0.3));
      ctx.beginPath();
      for (let x = runStart; x <= xEnd; x += step) ctx.lineTo(x, yAt(x));
      for (let x = xEnd; x >= runStart; x -= step) {
        const q = (x - runStart) / Math.max(1, run);
        const atCrest = o.sunSide > 0 ? q : 1 - q;
        ctx.lineTo(x, Math.min(bottom, yAt(x) + depth * layer * (0.2 + 0.8 * atCrest) * ease(q)));
      }
      ctx.closePath();
      ctx.fill();
    }
    runStart = -1;
  };
  for (let x = x0; x <= x1 + step; x += step) {
    const dy = yAt(x + step) - yAt(x);
    const lee = dy * o.sunSide < -0.015 * step;
    if (lee && runStart < 0) runStart = x;
    else if (!lee && runStart >= 0) flush(x);
  }
  flush(x1 + step);
  // The crest line itself: a thread of light on the sun side, dark on the other.
  ctx.lineWidth = Math.max(0.5, 1.2 * E.u * (1 - d));
  ctx.strokeStyle = hexA(E.tone(E.light.sun, d, 0.6), 0.35 * E.light.rim * (1 - d * 0.5));
  ctx.beginPath();
  for (let x = x0; x <= x1 + step; x += step) {
    const y = yAt(x);
    if (x === x0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Ripples, near: fine lines following the slope.
  if (o.ripples && d < 0.5) {
    ctx.strokeStyle = hexA(deep, 0.14 * (1 - d * 1.5));
    ctx.lineWidth = Math.max(0.4, 0.7 * E.u);
    ctx.beginPath();
    const rows = 7;
    for (let r = 1; r <= rows; r++) {
      const off = ((bottom - base) * r) / (rows + 1) + amp * 0.6;
      for (let x = x0; x <= x1; x += step * 2) {
        const y = yAt(x) + off + Math.sin(x * 0.05 + r * 2 + o.seed) * 3 * E.u;
        if (y > bottom) continue;
        if (x === x0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  // Sand off the crests, in wind.
  const w = Math.abs(E.wind);
  if (w > 3 && d < 0.75) {
    const dir = Math.sign(E.wind);
    const spr = E.soft(E.tone(E.light.sand, d, 0.5));
    for (let k = 0; k < 14; k++) {
      const cx = x0 + ((hash(o.seed, k) * (x1 - x0) + E.t * w * 6 * dir) % (x1 - x0) + (x1 - x0)) % (x1 - x0);
      // Only where the crest is high.
      if (crest(cx) < 0.62) continue;
      const y = yAt(cx);
      const len = (30 + w * 2.5) * E.u * (1 - d);
      const ph = posmod(E.t * 0.9 + hash(o.seed, k, 1) * 3, 1);
      ctx.globalAlpha = (0.25 + w * 0.01) * (1 - ph) * (1 - d);
      ctx.drawImage(spr, cx + dir * len * ph - len * 0.5, y - len * 0.25 - ph * 10 * E.u, len, len * 0.5);
    }
    ctx.globalAlpha = 1;
  }
}

// ---- the sandworm -----------------------------------------------------------------------------
export type WormPose = 'sign' | 'surface' | 'strike' | 'submerge' | 'ridden';
/**
 * The worm. `sign`: the sand mounding and running as it comes, a ripple like a bow wave.
 * `surface`: a length of it cresting out of the sand and back in. `strike`: the head rising
 * straight up, the mouth open (rings of crystal teeth) around what it takes; `k` is how far.
 * `ridden`: surfaced and running with riders along its back.
 */
export function drawWorm(E: DEnv, o: { x: number; y: number; m: number; dir: number; pose: WormPose; k: number; d: number; size: number; riders?: number; seed: number }) {
  const { ctx } = E;
  const { x, y, m, dir, pose, k, d, size } = o;
  const L = 420 * size * m * E.u;
  const R = 34 * size * m * E.u;
  const body = E.tone('#6a5848', d, 0.1);
  const dark = E.tone('#30241c', d, 0);
  const hi = E.tone('#a08870', d, 0.5);
  const sandC = E.tone(E.light.sand, d, 0.3);
  if (pose === 'sign') {
    // The mound running under the sand: a long wake of broken sand behind, the mound itself with
    // its shadowed back, and the sand it throws ahead of it.
    const w = L * 0.7;
    const h = R * 1.6 * clamp01(k);
    const wake = L * 1.6;
    const wg = ctx.createLinearGradient(x - dir * wake, 0, x, 0);
    wg.addColorStop(0, hexA(E.tone(mix(E.light.sand, E.light.ink, 0.3), d), 0));
    wg.addColorStop(1, hexA(E.tone(mix(E.light.sand, E.light.ink, 0.3), d), 0.45));
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(x - dir * wake, y);
    ctx.quadraticCurveTo(x - dir * wake * 0.5, y - h * 0.35, x, y - h * 0.3);
    ctx.lineTo(x, y + h * 0.25);
    ctx.quadraticCurveTo(x - dir * wake * 0.5, y + h * 0.3, x - dir * wake, y);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, hexA(E.tone(E.light.sand, d, 0.6), 0.95));
    g.addColorStop(1, hexA(E.tone(mix(E.light.sand, E.light.ink, 0.35), d), 0.8));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6 * dir, y + h * 0.1);
    ctx.quadraticCurveTo(x - w * 0.2 * dir, y - h * 0.9, x + w * 0.2 * dir, y - h);
    ctx.quadraticCurveTo(x + w * 0.45 * dir, y - h * 0.9, x + w * 0.55 * dir, y + h * 0.1);
    ctx.fill();
    // The back of the mound away from the sun.
    ctx.fillStyle = hexA(E.tone(mix(E.light.sand, E.light.ink, 0.5), d), 0.4);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6 * dir, y + h * 0.1);
    ctx.quadraticCurveTo(x - w * 0.2 * dir, y - h * 0.9, x + w * 0.2 * dir, y - h);
    ctx.quadraticCurveTo(x - w * 0.1 * dir, y - h * 0.5, x - w * 0.6 * dir, y + h * 0.1);
    ctx.fill();
    const spr = E.soft(sandC);
    for (let q = 0; q < 7; q++) {
      const ph = posmod(E.t * 1.4 + q * 0.15, 1);
      const px = x + dir * (w * 0.6 - ph * w * 1.2) + (hash(o.seed, q) - 0.5) * w * 0.3;
      const s = R * (1.6 + ph * 2);
      ctx.globalAlpha = 0.5 * (1 - ph) * clamp01(k);
      ctx.drawImage(spr, px - s / 2, y - h - s * 0.5 - ph * R * 1.5, s, s * 0.7);
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (pose === 'surface' || pose === 'ridden') {
    // An arc of the body out of the sand: segments, each a ring.
    const span = L * (pose === 'ridden' ? 1 : 0.8);
    const lift = R * 2.2 * (pose === 'ridden' ? 1 : Math.sin(clamp01(k) * Math.PI));
    const segs = 18;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const q = i / segs;
      const px = x + (q - 0.5) * span * dir;
      const py = y - Math.sin(q * Math.PI) * lift + R * 0.3;
      const pr = R * (0.55 + 0.45 * Math.sin(q * Math.PI)) * (q < 0.12 && pose === 'ridden' ? 1.1 : 1);
      pts.push([px, py, pr]);
    }
    // Sand it throws up, both ends.
    const spr = E.soft(sandC);
    for (const end of [0, segs]) {
      const [px, py] = pts[end];
      for (let q = 0; q < 4; q++) {
        const ph = posmod(E.t * 1.1 + q * 0.25 + end, 1);
        const s = R * (1.5 + ph * 2);
        ctx.globalAlpha = 0.4 * (1 - ph);
        ctx.drawImage(spr, px - s / 2, py - s * 0.5 - ph * R * 1.5, s, s * 0.7);
      }
    }
    ctx.globalAlpha = 1;
    // The body, back to front.
    for (let i = segs; i >= 0; i--) {
      const [px, py, pr] = pts[i];
      if (py + pr < y - lift * 1.2) continue;
      const g = ctx.createRadialGradient(px - pr * 0.35 * o.dir, py - pr * 0.4, pr * 0.1, px, py, pr);
      g.addColorStop(0, hi);
      g.addColorStop(0.55, body);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      // The ring's edge.
      ctx.strokeStyle = hexA(dark, 0.6);
      ctx.lineWidth = Math.max(0.5, pr * 0.08);
      ctx.beginPath();
      ctx.arc(px, py, pr * 0.98, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Riders along the back, with their hooks.
    if (pose === 'ridden' && o.riders) {
      const ink = E.tone('#1a1410', d);
      for (let r = 0; r < o.riders; r++) {
        const q = 0.3 + (r / Math.max(1, o.riders - 1)) * 0.45;
        const i = Math.round(q * segs);
        const [px, py, pr] = pts[i];
        const h = Math.max(3, pr * 0.42);
        ctx.fillStyle = ink;
        ctx.fillRect(px - h * 0.14, py - pr - h, h * 0.28, h);
        ctx.beginPath();
        ctx.arc(px, py - pr - h, h * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(0.5, h * 0.06);
        ctx.beginPath();
        ctx.moveTo(px, py - pr - h * 0.6);
        ctx.lineTo(px + dir * h * 0.9, py - pr - h * 1.1);
        ctx.stroke();
      }
    }
    return;
  }
  if (pose === 'strike') {
    // The head rising straight up out of the sand, the mouth open toward us.
    const rise = clamp01(k);
    const H = R * 5.5 * Math.sin(Math.min(1, rise) * Math.PI * 0.5);
    const rr = R * 1.5 * (0.7 + 0.3 * rise);
    const spr = E.soft(sandC);
    for (let q = 0; q < 10; q++) {
      const a = (q / 10) * Math.PI * 2;
      const ph = posmod(E.t * 0.8 + q * 0.1, 1);
      const s = R * (2 + ph * 3);
      ctx.globalAlpha = 0.5 * (1 - ph) * rise;
      ctx.drawImage(spr, x + Math.cos(a) * rr * (1 + ph * 1.5) - s / 2, y - s * 0.4 - ph * R * 2 + Math.sin(a) * R * 0.4, s, s * 0.6);
    }
    ctx.globalAlpha = 1;
    // The neck: rings up to the head.
    for (let i = 0; i < 8; i++) {
      const q = i / 8;
      const py = y - H * q;
      const pr = rr * (0.8 + 0.2 * q);
      const g = ctx.createLinearGradient(x - pr, 0, x + pr, 0);
      g.addColorStop(0, dark);
      g.addColorStop(0.4, body);
      g.addColorStop(0.7, hi);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, py, pr, pr * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - pr, py - H / 8, pr * 2, H / 8 + 1);
      ctx.strokeStyle = hexA(dark, 0.5);
      ctx.lineWidth = Math.max(0.5, pr * 0.05);
      ctx.beginPath();
      ctx.ellipse(x, py, pr, pr * 0.32, 0, 0, Math.PI);
      ctx.stroke();
    }
    // The mouth: a dark gullet in rings of crystal teeth.
    const my = y - H;
    const open = clamp01((rise - 0.3) / 0.5);
    const mr = rr * (0.9 + 0.25 * open);
    const gg = ctx.createRadialGradient(x, my, mr * 0.05, x, my, mr);
    gg.addColorStop(0, '#060302');
    gg.addColorStop(0.5, E.tone('#2a1410', d));
    gg.addColorStop(1, body);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(x, my, mr, mr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA(E.tone('#e8e0d0', d, 0.6), 0.9);
    for (let ring = 0; ring < 3; ring++) {
      const rk = 0.95 - ring * 0.2;
      const n = 22 - ring * 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.2;
        const tx = x + Math.cos(a) * mr * rk;
        const ty = my + Math.sin(a) * mr * 0.8 * rk;
        const tl = mr * (0.14 - ring * 0.03) * (0.6 + open * 0.4);
        ctx.beginPath();
        ctx.moveTo(tx + Math.sin(a) * tl * 0.25, ty - Math.cos(a) * tl * 0.25);
        ctx.lineTo(tx - Math.cos(a) * tl, ty - Math.sin(a) * tl * 0.8);
        ctx.lineTo(tx - Math.sin(a) * tl * 0.25, ty + Math.cos(a) * tl * 0.25);
        ctx.fill();
      }
    }
    return;
  }
  // submerge: the crater it leaves, filling.
  const w = L * 0.35 * (1 + k * 0.4);
  const depth = R * 0.9 * (1 - k * 0.8);
  const g = ctx.createRadialGradient(x, y, 0, x, y, w);
  g.addColorStop(0, hexA(E.tone(mix(E.light.sand, E.light.ink, 0.5), d), 0.75 * (1 - k)));
  g.addColorStop(1, hexA(E.tone(E.light.sand, d), 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w, depth, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---- the machines -----------------------------------------------------------------------------
/**
 * A spice harvester: a factory on tracks. Four track units under a deep armoured hull with a
 * sloped prow, the intake drum turning under its hood at the front, the control tower aft with
 * its window band and mast, the exhaust stacks, rows of port lights, floodlights at night.
 */
export function drawCrawler(E: DEnv, x: number, y: number, m: number, dir: number, d: number, o: { working: boolean; lit: boolean; seed: number; tilt?: number }) {
  const { ctx } = E;
  const L = 160 * m * E.u;
  const H = 50 * m * E.u;
  const hull = E.tone('#8a7e70', d, 0.2);
  const hullD = E.tone('#4e463e', d, 0.05);
  const dark = E.tone('#26221e', d, 0);
  const hi = E.tone('#d4c8ac', d, 0.55);
  const rust = E.tone('#8a4a30', d, 0.15);
  const night = E.night;
  const work = o.working ? 1 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.tilt ?? 0);
  ctx.scale(dir, 1);
  // The far track units (behind, darker), then the near ones.
  const pod = (px: number, w: number, h: number, far: boolean) => {
    ctx.fillStyle = far ? E.tone('#1a1714', d) : dark;
    ctx.beginPath();
    ctx.roundRect(px - w / 2, -h, w, h, h * 0.45);
    ctx.fill();
    if (far) return;
    ctx.fillStyle = E.tone('#56504a', d, 0.15);
    const n = 5;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(px - w * 0.38 + (i / (n - 1)) * w * 0.76, -h * 0.45, h * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = dark;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(px - w * 0.38 + (i / (n - 1)) * w * 0.76, -h * 0.45, h * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    // The tread's grousers, running.
    ctx.strokeStyle = hexA(hi, 0.3);
    ctx.lineWidth = Math.max(0.5, h * 0.06);
    ctx.beginPath();
    const ph = work * E.t * 3;
    for (let i = 0; i < 16; i++) {
      const tx = px - w / 2 + posmod((i / 16) * w + ph * w * 0.06, w);
      ctx.moveTo(tx, -h);
      ctx.lineTo(tx, -h * 0.86);
    }
    ctx.stroke();
  };
  const ph = H * 0.42;
  pod(-L * 0.28, L * 0.36, ph, true);
  pod(L * 0.2, L * 0.36, ph, true);
  // The undercarriage between the tracks, in shadow.
  ctx.fillStyle = hexA(dark, 0.9);
  ctx.fillRect(-L * 0.46, -ph * 1.25, L * 0.86, ph * 0.5);
  // The hull: deep, with a sloped prow and a raked stern.
  const top = -H * 1.35;
  const body = new Path2D();
  body.moveTo(-L * 0.5, -ph * 1.05);
  body.lineTo(-L * 0.47, top);
  body.lineTo(L * 0.22, top);
  body.lineTo(L * 0.42, -H * 0.95);
  body.lineTo(L * 0.44, -ph * 1.05);
  body.closePath();
  const hg = ctx.createLinearGradient(0, top, 0, -ph);
  hg.addColorStop(0, hi);
  hg.addColorStop(0.18, hull);
  hg.addColorStop(1, hullD);
  ctx.fillStyle = hg;
  ctx.fill(body);
  // Plates and seams, a band, the rust of the years.
  ctx.strokeStyle = hexA(dark, 0.4);
  ctx.lineWidth = Math.max(0.4, H * 0.015);
  ctx.beginPath();
  for (let i = 1; i < 9; i++) {
    const px = -L * 0.47 + i * L * 0.08;
    ctx.moveTo(px, top + H * 0.04);
    ctx.lineTo(px, -ph * 1.05);
  }
  ctx.moveTo(-L * 0.48, top + (top - -ph) * -0.45);
  ctx.lineTo(L * 0.34, top + (top - -ph) * -0.45);
  ctx.stroke();
  ctx.fillStyle = hexA(E.tone('#b4542e', d, 0.2), 0.75);
  ctx.fillRect(-L * 0.47, top + H * 0.36, L * 0.83, H * 0.07);
  ctx.fillStyle = hexA(rust, 0.45);
  for (let i = 0; i < 6; i++) ctx.fillRect(-L * 0.44 + hash(o.seed, i) * L * 0.74, top + H * 0.1 + hash(o.seed, i, 1) * H * 0.6, L * 0.025, H * 0.12 * (0.5 + hash(o.seed, i, 2)));
  // Port lights along the hull.
  for (let i = 0; i < 12; i++) {
    const lx = -L * 0.42 + i * L * 0.06;
    ctx.fillStyle = o.lit && night > 0.1 ? hexA('#ffd890', 0.4 + 0.6 * night) : E.tone('#1a1c22', d);
    ctx.fillRect(lx, top + H * 0.2, L * 0.022, H * 0.07);
  }
  // The control tower aft, its window band, the mast; the stacks behind it.
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-L * 0.36, top);
  ctx.lineTo(-L * 0.34, top - H * 0.62);
  ctx.lineTo(-L * 0.12, top - H * 0.62);
  ctx.lineTo(-L * 0.08, top);
  ctx.fill();
  ctx.fillStyle = hexA(hi, 0.55);
  ctx.fillRect(-L * 0.34, top - H * 0.62, L * 0.22, H * 0.05);
  ctx.fillStyle = o.lit && night > 0.1 ? hexA('#ffe0a0', 0.9) : E.tone('#22262e', d, 0.1);
  ctx.fillRect(-L * 0.33, top - H * 0.5, L * 0.2, H * 0.14);
  ctx.strokeStyle = hexA(hi, 0.7);
  ctx.lineWidth = Math.max(0.5, H * 0.025);
  ctx.beginPath();
  ctx.moveTo(-L * 0.2, top - H * 0.62);
  ctx.lineTo(-L * 0.2, top - H * 1.3);
  ctx.moveTo(-L * 0.24, top - H * 1.1);
  ctx.lineTo(-L * 0.16, top - H * 1.1);
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const sx = -L * 0.46 + k * L * 0.035;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx - H * 0.06, top - H * (0.75 + k * 0.08));
    ctx.lineTo(sx + L * 0.022 - H * 0.06, top - H * (0.75 + k * 0.08));
    ctx.lineTo(sx + L * 0.022, top);
    ctx.fill();
  }
  // The intake: a hood over the drum, the drum's blades turning, the sand going in.
  ctx.fillStyle = hullD;
  ctx.beginPath();
  ctx.moveTo(L * 0.36, -H * 1.05);
  ctx.lineTo(L * 0.62, -H * 0.62);
  ctx.lineTo(L * 0.62, -H * 0.42);
  ctx.lineTo(L * 0.4, -H * 0.55);
  ctx.closePath();
  ctx.fill();
  const dx = L * 0.54;
  const dy = -H * 0.22;
  const dr = H * 0.3;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(dx, dy, dr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexA(hi, 0.55);
  ctx.lineWidth = Math.max(0.6, dr * 0.12);
  ctx.beginPath();
  const turn = work * E.t * 2.4;
  for (let k = 0; k < 8; k++) {
    const a = turn + (k / 8) * Math.PI * 2;
    ctx.moveTo(dx + Math.cos(a) * dr * 0.25, dy + Math.sin(a) * dr * 0.25);
    ctx.lineTo(dx + Math.cos(a) * dr * 0.95, dy + Math.sin(a) * dr * 0.95);
  }
  ctx.stroke();
  ctx.strokeStyle = hexA(dark, 0.9);
  ctx.lineWidth = Math.max(0.6, H * 0.04);
  ctx.beginPath();
  ctx.moveTo(L * 0.4, -ph * 1.05);
  ctx.lineTo(dx, dy);
  ctx.stroke();
  pod(-L * 0.28, L * 0.36, ph, false);
  pod(L * 0.2, L * 0.36, ph, false);
  ctx.restore();
  if (o.lit && night > 0.1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    E.glow(x + dir * L * 0.62, y - H * 0.55, H * 2.4, '#ffe0a8', 0.6 * night);
    E.glow(x + dir * L * 0.9, y - H * 0.1, H * 3, '#ffe0a8', 0.25 * night);
    E.glow(x - dir * L * 0.2, y - H * 2.6, H * 0.35, '#ff4030', (0.5 + 0.5 * Math.sin(E.t * 3)) * night);
    ctx.restore();
  }
}

/** A carryall: a wide-winged lifter with four ducted fans, a sling bay underneath. `cables` to a load (x, y) in the same frame. */
export function drawCarryall(E: DEnv, x: number, y: number, m: number, dir: number, d: number, o: { seed: number; lit: boolean; cables?: [number, number] | null; bank?: number }) {
  const { ctx } = E;
  const L = 190 * m * E.u;
  const H = 30 * m * E.u;
  const hull = E.tone('#8a8072', d, 0.2);
  const dark = E.tone('#2e2a26', d, 0);
  const hi = E.tone('#c4b89c', d, 0.5);
  const stripe = E.tone(['#b4542e', '#1e4a6a', '#a08828'][o.seed % 3], d, 0.2);
  if (o.cables) {
    ctx.strokeStyle = hexA(dark, 0.85);
    ctx.lineWidth = Math.max(0.6, H * 0.05);
    ctx.beginPath();
    for (const cx of [-L * 0.3, -L * 0.1, L * 0.1, L * 0.3]) {
      ctx.moveTo(x + cx * dir, y + H * 0.4);
      ctx.lineTo(o.cables[0] + cx * dir * 0.6, o.cables[1]);
    }
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((o.bank ?? 0) * dir);
  ctx.scale(dir, 1);
  // Fan ducts, outboard on the wing, fore and aft pairs.
  const fan = (fx: number, fy: number, r: number) => {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(fx, fy, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA(hi, 0.25 + 0.2 * Math.abs(Math.sin(E.t * 40 + fx)));
    ctx.beginPath();
    ctx.ellipse(fx, fy, r * 0.82, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  };
  // The wing: a wide plank over the hull.
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-L * 0.62, -H * 0.8);
  ctx.lineTo(L * 0.62, -H * 0.8);
  ctx.lineTo(L * 0.58, -H * 0.55);
  ctx.lineTo(-L * 0.58, -H * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hexA(hi, 0.5);
  ctx.fillRect(-L * 0.62, -H * 0.8, L * 1.24, H * 0.05);
  fan(-L * 0.5, -H * 0.95, L * 0.1);
  fan(L * 0.5, -H * 0.95, L * 0.1);
  // The hull: a deep body, tapered aft, with the sling bay open below.
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-L * 0.42, -H * 0.6);
  ctx.lineTo(L * 0.4, -H * 0.6);
  ctx.lineTo(L * 0.48, -H * 0.2);
  ctx.lineTo(L * 0.42, H * 0.4);
  ctx.lineTo(-L * 0.36, H * 0.4);
  ctx.lineTo(-L * 0.46, -H * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = stripe;
  ctx.fillRect(-L * 0.36, -H * 0.05, L * 0.76, H * 0.1);
  ctx.fillStyle = hexA(dark, 0.6);
  ctx.fillRect(-L * 0.3, H * 0.15, L * 0.6, H * 0.25);
  // Cockpit glazing forward.
  ctx.fillStyle = o.lit && E.night > 0.1 ? hexA('#ffd890', 0.85) : E.tone('#1a1c22', d);
  ctx.beginPath();
  ctx.moveTo(L * 0.3, -H * 0.55);
  ctx.lineTo(L * 0.42, -H * 0.55);
  ctx.lineTo(L * 0.46, -H * 0.2);
  ctx.lineTo(L * 0.3, -H * 0.2);
  ctx.fill();
  // Tail fins.
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-L * 0.42, -H * 0.6);
  ctx.lineTo(-L * 0.5, -H * 1.5);
  ctx.lineTo(-L * 0.36, -H * 1.5);
  ctx.lineTo(-L * 0.28, -H * 0.6);
  ctx.fill();
  ctx.fillStyle = stripe;
  ctx.fillRect(-L * 0.47, -H * 1.4, L * 0.1, H * 0.2);
  fan(-L * 0.2, H * 0.45, L * 0.08);
  fan(L * 0.2, H * 0.45, L * 0.08);
  ctx.restore();
  if (E.night > 0.1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const blink = Math.floor(E.t * 1.5 + o.seed) % 2 === 0;
    if (blink) E.glow(x - dir * L * 0.45, y - H * 1.4, H * 0.5, '#ff4030', 0.8 * E.night);
    E.glow(x + dir * L * 0.6, y - H * 0.8, H * 0.4, '#60ff80', 0.6 * E.night);
    E.glow(x - dir * L * 0.6, y - H * 0.8, H * 0.4, '#ff6060', 0.6 * E.night);
    if (o.lit) E.glow(x, y + H * 1.2, H * 3, '#ffe0a0', 0.25 * E.night);
    ctx.restore();
  }
}

/** An ornithopter: a slim body, two pairs of wings beating (or folded, landed), a tail. */
export function drawThopter(E: DEnv, x: number, y: number, m: number, dir: number, d: number, o: { seed: number; lit: boolean; beat: number; landed?: boolean; bank?: number; smoke?: boolean; lamp?: [number, number] | null }) {
  const { ctx } = E;
  const L = 70 * m * E.u;
  const body = E.tone('#6e665c', d, 0.2);
  const dark = E.tone('#262220', d, 0);
  const hi = E.tone('#b8ac94', d, 0.5);
  const wing = hexA(E.tone('#9a9080', d, 0.35), 0.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((o.bank ?? 0) * dir);
  ctx.scale(dir, 1);
  // The wings: two pairs, long and narrow, beating with a lag between pairs.
  const flap = o.landed ? -0.9 : Math.sin(o.beat) * 0.75;
  const flap2 = o.landed ? -1.0 : Math.sin(o.beat - 0.9) * 0.7;
  ctx.strokeStyle = wing;
  ctx.lineCap = 'round';
  for (const [wx, f, len] of [[L * 0.1, flap, L * 0.75], [-L * 0.08, flap2, L * 0.65]] as const) {
    ctx.lineWidth = Math.max(0.8, L * 0.045);
    ctx.beginPath();
    ctx.moveTo(wx, -L * 0.04);
    ctx.quadraticCurveTo(wx + L * 0.1, -L * 0.04 - f * len * 0.5, wx + L * 0.25 * (o.landed ? 1 : 0.5), -L * 0.04 - f * len);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx, -L * 0.02);
    ctx.quadraticCurveTo(wx + L * 0.1, -L * 0.02 - f * len * 0.5 * 0.8, wx + L * 0.25 * (o.landed ? 1 : 0.5), -L * 0.02 - f * len * 0.8 - L * 0.1);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // The body: a teardrop with a glazed nose and a tail boom.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(L * 0.45, 0);
  ctx.quadraticCurveTo(L * 0.3, -L * 0.14, -L * 0.05, -L * 0.1);
  ctx.lineTo(-L * 0.5, -L * 0.03);
  ctx.lineTo(-L * 0.5, L * 0.02);
  ctx.lineTo(-L * 0.05, L * 0.08);
  ctx.quadraticCurveTo(L * 0.3, L * 0.12, L * 0.45, 0);
  ctx.fill();
  ctx.fillStyle = hexA(hi, 0.5);
  ctx.fillRect(-L * 0.05, -L * 0.1, L * 0.3, L * 0.02);
  ctx.fillStyle = o.lit && E.night > 0.1 ? hexA('#ffd890', 0.85) : E.tone('#1a1c22', d);
  ctx.beginPath();
  ctx.moveTo(L * 0.42, -L * 0.01);
  ctx.quadraticCurveTo(L * 0.3, -L * 0.12, L * 0.14, -L * 0.1);
  ctx.lineTo(L * 0.16, -L * 0.02);
  ctx.fill();
  // The tail: a fin and planes.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-L * 0.4, -L * 0.03);
  ctx.lineTo(-L * 0.52, -L * 0.18);
  ctx.lineTo(-L * 0.5, -L * 0.03);
  ctx.fill();
  ctx.fillRect(-L * 0.52, -L * 0.04, L * 0.16, L * 0.02);
  // Skids when landed.
  if (o.landed) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.6, L * 0.02);
    ctx.beginPath();
    ctx.moveTo(L * 0.2, L * 0.08);
    ctx.lineTo(L * 0.22, L * 0.2);
    ctx.lineTo(-L * 0.22, L * 0.2);
    ctx.lineTo(-L * 0.2, L * 0.08);
    ctx.stroke();
  }
  ctx.restore();
  if (E.night > 0.1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (Math.floor(E.t * 2 + o.seed) % 3 === 0) E.glow(x - dir * L * 0.5, y - L * 0.16, L * 0.1, '#ff4030', 0.9 * E.night);
    ctx.restore();
  }
  if (o.lamp) {
    // A searchlight down to a point on the sand.
    const [lx, ly] = o.lamp;
    const a = Math.atan2(ly - y, lx - x);
    const len = Math.hypot(lx - x, ly - y);
    const sp = 0.05;
    const g = ctx.createLinearGradient(x, y, lx, ly);
    g.addColorStop(0, hexA('#e8f0ff', 0.22 * Math.max(E.night, 0.3)));
    g.addColorStop(1, hexA('#e8f0ff', 0.05));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - sp) * len, y + Math.sin(a - sp) * len);
    ctx.lineTo(x + Math.cos(a + sp) * len, y + Math.sin(a + sp) * len);
    ctx.fill();
    ctx.fillStyle = hexA('#f0f4ff', 0.3);
    ctx.beginPath();
    ctx.ellipse(lx, ly, len * sp * 1.6, len * sp * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- the desert folk ---------------------------------------------------------------------------
/**
 * One of the desert folk: a hooded robe over a close suit, a face mask, a pack; walking without
 * rhythm (`phase` runs unevenly), or crouched still. `h` is the height.
 */
export function drawFolk(E: DEnv, x: number, y: number, h: number, dir: number, d: number, o: { phase: number; crouch: number; seed: number; robe?: string; pack?: boolean; weapon?: boolean; child?: boolean }) {
  const { ctx } = E;
  const robe = E.tone(o.robe ?? ['#5a4634', '#3e3a40', '#6a5a46', '#4a3c38', '#2e2a30'][o.seed % 5], d, 0.1);
  const dark = E.tone('#1a1612', d, 0);
  const skin = E.tone('#a8805a', d, 0.3);
  const H = h * (o.child ? 0.62 : 1);
  const cr = clamp01(o.crouch);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // Legs: the uneven step.
  const sw = (1 - cr) * Math.sin(o.phase) * 0.42;
  ctx.strokeStyle = dark;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.6, H * 0.08);
  const hip = -H * (0.44 - cr * 0.2);
  ctx.beginPath();
  ctx.moveTo(0, hip);
  ctx.lineTo(Math.sin(sw) * H * 0.4, hip + Math.cos(sw) * H * 0.42);
  ctx.moveTo(0, hip);
  ctx.lineTo(Math.sin(-sw) * H * 0.4 - cr * H * 0.2, hip + Math.cos(sw) * H * 0.42);
  ctx.stroke();
  // The robe: a hooded cloak, flaring to the knees, blown by the wind.
  const blow = (E.wind / 30) * H * 0.15 * (1 - cr);
  const top = -H * (0.95 - cr * 0.3);
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-H * 0.1, top);
  ctx.lineTo(H * 0.1, top);
  ctx.lineTo(H * 0.17 + blow, -H * 0.3 + cr * H * 0.15);
  ctx.lineTo(-H * 0.2 + blow * 1.6, -H * 0.28 + cr * H * 0.15);
  ctx.closePath();
  ctx.fill();
  // The hood and the mask: a dark face with the eyes' slit.
  ctx.beginPath();
  ctx.arc(0, top - H * 0.02, H * 0.11, Math.PI * 0.9, Math.PI * 2.1);
  ctx.lineTo(H * 0.1, top + H * 0.08);
  ctx.lineTo(-H * 0.1, top + H * 0.08);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(H * 0.03, top, H * 0.065, H * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.fillRect(H * 0.0, top - H * 0.03, H * 0.07, H * 0.02);
  // A pack, a weapon.
  if (o.pack) {
    ctx.fillStyle = hexA(dark, 0.8);
    ctx.beginPath();
    ctx.roundRect(-H * 0.2, top + H * 0.12, H * 0.12, H * 0.22, H * 0.03);
    ctx.fill();
  }
  if (o.weapon) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.5, H * 0.03);
    ctx.beginPath();
    ctx.moveTo(H * 0.06, -H * 0.55);
    ctx.lineTo(H * 0.14, -H * 1.1);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- the storm ---------------------------------------------------------------------------------
/**
 * A sandstorm: a wall of dust coming on from one side (`front` is where its leading edge is, in
 * screen x; `dir` which way it moves), the sky and ground lost in it, grit streaming, and now
 * and then a flash of static in the cloud.
 */
export function drawStorm(E: DEnv, W: number, H: number, horizon: number, storm: number, front: number, dir: number, flash: number) {
  if (storm <= 0.01) return;
  const { ctx } = E;
  const dust = mix(E.light.sand, '#7a5a3a', 0.45);
  const dustD = mix(dust, E.light.ink, 0.5);
  // The wall: tall soft masses stacked along the front, taller than the sky.
  const spr = E.soft(mix(dust, E.light.low, 0.2));
  const sprD = E.soft(dustD);
  const wallW = W * 0.55;
  for (let k = 0; k < 26; k++) {
    const q = hash(k, 5);
    const bx = front - dir * q * wallW;
    const by = horizon - (0.1 + hash(k, 6) * 0.9) * horizon * 1.1 + Math.sin(E.t * 0.3 + k) * 10 * E.u;
    const s = (260 + hash(k, 7) * 360) * E.u * (0.6 + storm * 0.6);
    ctx.globalAlpha = 0.5 * storm * (0.5 + 0.5 * (1 - q));
    ctx.drawImage(k % 3 === 0 ? sprD : spr, bx - s / 2, by - s / 2, s, s * 1.3);
  }
  // Everything behind the front, dimmed to dust.
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(front, 0, front - dir * wallW * 0.5, 0);
  g.addColorStop(0, hexA(dust, 0.15 * storm));
  g.addColorStop(1, hexA(dust, 0.85 * storm));
  ctx.fillStyle = g;
  ctx.fillRect(dir > 0 ? -W : front, 0, dir > 0 ? front + W : W * 2, H);
  // Grit, everywhere in front of it.
  ctx.strokeStyle = hexA(mix(dust, '#ffffff', 0.2), 0.3 * storm);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 220 * storm; k++) {
    const x = posmod(hash(k, 1) * W * 1.2 + E.t * (260 + hash(k, 2) * 200) * dir, W * 1.2) - W * 0.1;
    const y = posmod(hash(k, 3) * H + E.t * 30 * (hash(k, 4) - 0.5), H);
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * 14, y + 1.5);
  }
  ctx.stroke();
  if (flash > 0) {
    ctx.fillStyle = `rgba(230,220,255,${(0.2 * flash * storm).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** A dust devil: a twisting column of sand, leaning with the wind. */
export function drawDevil(E: DEnv, x: number, y: number, h: number, d: number, k: number) {
  const { ctx } = E;
  const spr = E.soft(E.tone(E.light.sand, d, 0.4));
  const a = Math.sin(k * Math.PI);
  for (let i = 0; i < 12; i++) {
    const q = i / 12;
    const w = h * (0.08 + q * 0.22);
    const px = x + Math.sin(E.t * 6 + q * 9) * w * 0.3 + (E.wind / 30) * h * q * 0.3;
    const py = y - q * h;
    ctx.globalAlpha = 0.5 * a * (1 - q * 0.6);
    ctx.drawImage(spr, px - w, py - w * 0.6, w * 2, w * 1.2);
  }
  ctx.globalAlpha = 1;
}
