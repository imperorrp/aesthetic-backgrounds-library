/**
 * The Walking Castle's light and sky: the colours of each hour (sky, the light on the land, the
 * haze, the clouds' lit tops and shaded bellies), the painter's shared kit (soft and glow sprites,
 * colour arithmetic), the sky itself (gradient, sun, a big moon, stars, shooting stars, the
 * rainbow), the cumulus (each baked once into three masks and coloured by the hour), rain and
 * lightning.
 */
import { clamp01, hash, n2, smoothstep } from './land';

export type RGB = [number, number, number];
export const hexRgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbHex = (c: RGB) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
export const mixRgb = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const mix = (a: string, b: string, k: number) => rgbHex(mixRgb(hexRgb(a), hexRgb(b), clamp01(k)));
/** A colour seen in a light: multiplied, channel by channel. */
export const mul = (a: string, b: string) => {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return rgbHex([(x[0] * y[0]) / 255, (x[1] * y[1]) / 255, (x[2] * y[2]) / 255]);
};
export const rgba = (h: string, a: number) => {
  const [r, g, b] = hexRgb(h);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

// ---- the hours ---------------------------------------------------------------------------------------
export type Light = { top: string; mid: string; low: string; sun: string; amb: string; haze: string; cloudLit: string; cloudShade: string; rim: number };
const KEYS: [number, Light][] = [
  [0.0, { top: '#050a1e', mid: '#0c1734', low: '#1c2c4e', sun: '#dfe6f4', amb: '#3a4a7a', haze: '#18243f', cloudLit: '#56688e', cloudShade: '#1a2440', rim: 0.3 }],
  [0.2, { top: '#0c1434', mid: '#262c54', low: '#584a6c', sun: '#e8c0b0', amb: '#56587e', haze: '#363858', cloudLit: '#86788e', cloudShade: '#363656', rim: 0.3 }],
  [0.26, { top: '#3c5a94', mid: '#c48c94', low: '#ffc48e', sun: '#ffc27c', amb: '#f8c6b0', haze: '#d4a4a0', cloudLit: '#ffd0aa', cloudShade: '#8a6e92', rim: 1 }],
  [0.33, { top: '#2f78cc', mid: '#7cb4ea', low: '#d6e8f2', sun: '#fff6e2', amb: '#fff4e6', haze: '#c4d6e8', cloudLit: '#ffffff', cloudShade: '#98a8cc', rim: 0.7 }],
  [0.5, { top: '#2a6fc8', mid: '#6eaae8', low: '#cae2f4', sun: '#ffffff', amb: '#ffffff', haze: '#bcd2ec', cloudLit: '#ffffff', cloudShade: '#a2b2d4', rim: 0.45 }],
  [0.64, { top: '#2e70c2', mid: '#78ace0', low: '#dce6ea', sun: '#fff2d6', amb: '#fff2de', haze: '#cad6e2', cloudLit: '#fff9ee', cloudShade: '#a0a6cc', rim: 0.7 }],
  [0.705, { top: '#3e64a8', mid: '#c8a894', low: '#ffc47e', sun: '#ffb262', amb: '#ffd4a0', haze: '#e6b48e', cloudLit: '#ffd49c', cloudShade: '#9a7a9c', rim: 1 }],
  [0.745, { top: '#28326e', mid: '#a45c7c', low: '#ff8c5a', sun: '#ff7c40', amb: '#d6948a', haze: '#a46c80', cloudLit: '#ff9c6c', cloudShade: '#684872', rim: 1 }],
  [0.8, { top: '#121a40', mid: '#383060', low: '#764a62', sun: '#e8b0a0', amb: '#666088', haze: '#3a3254', cloudLit: '#846888', cloudShade: '#282446', rim: 0.4 }],
  [0.86, { top: '#050a1e', mid: '#0c1734', low: '#1c2c4e', sun: '#dfe6f4', amb: '#3a4a7a', haze: '#18243f', cloudLit: '#56688e', cloudShade: '#1a2440', rim: 0.3 }],
  [1.0, { top: '#050a1e', mid: '#0c1734', low: '#1c2c4e', sun: '#dfe6f4', amb: '#3a4a7a', haze: '#18243f', cloudLit: '#56688e', cloudShade: '#1a2440', rim: 0.3 }],
];
export function lightAt(day: number, storm: number): Light {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++)
    if (day >= KEYS[i][0] && day <= KEYS[i + 1][0]) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  const k = (day - a[0]) / Math.max(1e-6, b[0] - a[0]);
  const c = (x: Exclude<keyof Light, 'rim'>) => mix(a[1][x], b[1][x], k);
  const s = clamp01(storm);
  const dim = (col: string, grey: string, w: number) => mix(col, mul(grey, c('amb')), s * w);
  return {
    top: dim(c('top'), '#4a5466', 0.85),
    mid: dim(c('mid'), '#6a7484', 0.85),
    low: dim(c('low'), '#8c96a2', 0.8),
    sun: c('sun'),
    amb: mix(c('amb'), mul('#8c94a4', c('amb')), s * 0.7),
    haze: dim(c('haze'), '#8a929e', 0.7),
    cloudLit: dim(c('cloudLit'), '#9ea4ae', 0.75),
    cloudShade: dim(c('cloudShade'), '#4a5262', 0.8),
    rim: (a[1].rim + (b[1].rim - a[1].rim) * k) * (1 - s * 0.85),
  };
}
export const goldenOf = (d: number) => Math.max(0, 1 - Math.abs(d - 0.265) / 0.05) + Math.max(0, 1 - Math.abs(d - 0.725) / 0.05);

const HOURS = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];
export function timeWords(day: number): string {
  const mins = Math.round((day * 24 * 60) / 15) * 15;
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const part = (hh: number) => (hh < 5 ? 'IN THE NIGHT' : hh < 12 ? 'IN THE MORNING' : hh < 18 ? 'IN THE AFTERNOON' : hh < 21 ? 'IN THE EVENING' : 'AT NIGHT');
  const name = (hh: number) => (hh === 12 ? 'NOON' : hh === 0 ? 'MIDNIGHT' : HOURS[hh % 12]);
  if (m === 0) return h === 12 || h === 0 ? name(h) : `${name(h)} ${part(h)}`;
  const words = m === 15 ? 'A QUARTER PAST' : m === 30 ? 'HALF PAST' : 'A QUARTER TO';
  if (m > 30) h = (h + 1) % 24;
  return `${words} ${name(h)}${h === 12 || h === 0 ? '' : ` ${part(h)}`}`;
}

// ---- the painter's kit ----------------------------------------------------------------------------------
export const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};
export type Env = {
  ctx: CanvasRenderingContext2D; u: number; t: number; day: number; L: Light; night: number; storm: number;
  glow(x: number, y: number, r: number, color: string, a: number): void;
  soft(color: string): HTMLCanvasElement;
  /** A colour of the land (a noon colour), seen in the light of the hour. */
  lit(c: string): string;
};
export function createEnv(ctx: CanvasRenderingContext2D, u: number) {
  const glowCache = new Map<string, HTMLCanvasElement>();
  const softCache = new Map<string, HTMLCanvasElement>();
  const litCache = new Map<string, string>();
  const E: Env & { set(t: number, day: number, storm: number, night: number): void } = {
    ctx, u, t: 0, day: 0.4, L: lightAt(0.4, 0), night: 0, storm: 0,
    glow(x, y, rad, color, a) {
      if (a <= 0.01 || rad <= 0) return;
      let c = glowCache.get(color);
      if (!c) {
        c = mk(64, 64);
        const g = c.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, rgba(color, 1));
        gr.addColorStop(0.3, rgba(color, 0.4));
        gr.addColorStop(1, rgba(color, 0));
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
        gr.addColorStop(0, rgba(q, 0.95));
        gr.addColorStop(0.55, rgba(q, 0.55));
        gr.addColorStop(1, rgba(q, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        if (softCache.size > 240) softCache.clear();
        softCache.set(q, c);
      }
      return c;
    },
    lit(c) {
      const key = c + E.L.amb;
      let v = litCache.get(key);
      if (!v) {
        v = mul(c, E.L.amb);
        if (litCache.size > 2000) litCache.clear();
        litCache.set(key, v);
      }
      return v;
    },
    set(t, day, storm, night) {
      E.t = t;
      E.day = day;
      E.storm = storm;
      E.night = night;
      E.L = lightAt(day, storm);
    },
  };
  return E;
}

// ---- the sky -------------------------------------------------------------------------------------------
export type SkyStar = [number, number, number];
/** Where the sun (or the moon) is: 0..1 across its arc, its position, and whether it is up. */
export function sunPos(day: number, GW: number, HY: number, side: 1 | -1, moon = false) {
  const k = ((moon ? (day + 0.5) % 1 : day) - 0.25) / 0.5;
  const kk = clamp01(k);
  const x = GW * (side > 0 ? 0.12 + 0.76 * kk : 0.88 - 0.76 * kk);
  const y = HY + 20 - Math.sin(kk * Math.PI) * HY * (moon ? 0.78 : 0.86);
  return { k, x, y, up: k > -0.05 && k < 1.05 };
}

export function drawSky(E: Env, o: { GW: number; GH: number; HY: number; stars: SkyStar[]; side: 1 | -1; moonPhase: number; moonSprite: () => HTMLCanvasElement }) {
  const { ctx, L, night, u } = E;
  const { GW, GH, HY } = o;
  const sg = ctx.createLinearGradient(0, 0, 0, HY + 10);
  sg.addColorStop(0, L.top);
  sg.addColorStop(0.5, L.mid);
  sg.addColorStop(1, L.low);
  ctx.fillStyle = sg;
  ctx.fillRect(-GW, -GH, GW * 3, HY + GH + 10);
  const veil = 1 - E.storm * 0.92;
  // Stars, and the milky way at the deep of the night.
  if (night > 0.05) {
    if (night > 0.6) {
      ctx.save();
      ctx.translate(GW * 0.5, HY * 0.45);
      ctx.rotate(-0.5 * o.side);
      for (let k = 0; k < 40; k++) {
        const x = (hash(k, 3) - 0.5) * GW * 1.4;
        const y = (hash(k, 4) - 0.5) * HY * 0.18;
        const r = (60 + hash(k, 5) * 120) * u;
        ctx.globalAlpha = 0.05 * (night - 0.6) * 2.5 * veil;
        ctx.drawImage(E.soft('#8090c0'), x - r, y - r * 0.4, r * 2, r * 0.8);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    for (const [x0, y0, k] of o.stars) {
      const tw = 0.55 + 0.45 * Math.sin(E.t * (0.7 + k * 2.3) + k * 50);
      const a = night * (0.25 + k * 0.75) * tw * veil * (1 - smoothstep(HY * 0.6, HY, y0 * HY) * 0.7);
      if (a < 0.03) continue;
      ctx.fillStyle = `rgba(250,248,255,${a.toFixed(3)})`;
      const s = k > 0.94 ? 2.2 * u : k > 0.7 ? 1.5 * u : 1 * u;
      ctx.fillRect(x0 * GW, y0 * HY, s, s);
      if (k > 0.97) {
        ctx.fillRect(x0 * GW - 2 * s, y0 * HY + s * 0.25, s * 5, s * 0.5);
        ctx.fillRect(x0 * GW + s * 0.25, y0 * HY - 2 * s, s * 0.5, s * 5);
      }
    }
  }
  // The sun: a soft white disc high up, a big red one low.
  const sp = sunPos(E.day, GW, HY, o.side);
  const gold = goldenOf(E.day);
  if (sp.up) {
    E.glow(sp.x, sp.y, (360 + gold * 260) * u, L.sun, 0.35 * veil);
    E.glow(sp.x, sp.y, 110 * u, '#fffaf0', 0.5 * veil * (1 - gold * 0.4));
    ctx.fillStyle = rgba(mix('#fffdf6', L.sun, 0.3 + gold * 0.6), 0.98 * veil);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, (24 + gold * 16) * u, 0, Math.PI * 2);
    ctx.fill();
    const hg = ctx.createLinearGradient(0, HY - 90 * u, 0, HY + 10);
    hg.addColorStop(0, rgba(L.sun, 0));
    hg.addColorStop(1, rgba(L.sun, (0.18 + gold * 0.3) * veil));
    ctx.fillStyle = hg;
    ctx.fillRect(-GW, HY - 90 * u, GW * 3, 100 * u);
  }
  // The moon: big, pale, with its seas; a halo.
  const mp = sunPos(E.day, GW, HY, o.side > 0 ? -1 : 1, true);
  if (mp.up && night > 0.1) {
    const a = night * veil;
    const r = 46 * u;
    E.glow(mp.x, mp.y, r * 5, '#9aa8d0', 0.25 * a);
    E.glow(mp.x, mp.y, r * 2.2, '#dfe6f8', 0.25 * a);
    ctx.globalAlpha = a;
    ctx.drawImage(o.moonSprite(), mp.x - r, mp.y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }
}

/** The moon's face, baked once: seas and craters, lit a little more on one side. */
export function bakeMoon(phase: number): HTMLCanvasElement {
  const S = 128;
  const c = mk(S, S);
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5) / (S / 2) - 1;
      const dy = (y + 0.5) / (S / 2) - 1;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      const seas = n2(dx * 2.2 + 5, dy * 2.2 + phase * 9, 7) * 0.6 + n2(dx * 5, dy * 5, 8) * 0.4;
      const crater = Math.pow(n2(dx * 11, dy * 11, 9), 6) * 0.5;
      const limb = Math.sqrt(1 - d * d);
      let v = 0.92 - smoothstep(0.45, 0.7, seas) * 0.22 - crater * 0.2;
      v *= 0.78 + 0.22 * limb;
      const i = (y * S + x) * 4;
      img.data[i] = 236 * v;
      img.data[i + 1] = 234 * v;
      img.data[i + 2] = 226 * v;
      img.data[i + 3] = 255 * clamp01((1 - d) * S * 0.5);
    }
  g.putImageData(img, 0, 0);
  return c;
}

export function drawStars(E: Env, stars: { x: number; y: number; vx: number; vy: number; t0: number; dur: number; fall: boolean }[]) {
  const { ctx } = E;
  for (const s of stars) {
    const k = (E.t - s.t0) / s.dur;
    if (k < 0 || k > 1) continue;
    const a = Math.sin(k * Math.PI) * (s.fall ? 1 : 0.9);
    const len = 0.12;
    const g = ctx.createLinearGradient(s.x - s.vx * len, s.y - s.vy * len, s.x, s.y);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(1, `rgba(255,248,230,${a.toFixed(3)})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = (s.fall ? 2.4 : 1.6) * E.u;
    ctx.beginPath();
    ctx.moveTo(s.x - s.vx * len, s.y - s.vy * len);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    E.glow(s.x, s.y, (s.fall ? 14 : 8) * E.u, '#fff4d8', a);
  }
}

export function drawRainbow(E: Env, GW: number, GH: number, HY: number, side: 1 | -1, k: number) {
  if (k <= 0.01) return;
  const { ctx } = E;
  const cx = GW * (0.5 - side * 0.12);
  const cy = HY + GH * 0.34;
  const R = GH * 0.62;
  const cols = ['#ff4a3a', '#ff9a30', '#ffe040', '#60d050', '#40a0ff', '#5a50d0', '#9a50c0'];
  const w = GH * 0.011;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const a = k * (1 - E.night) * 0.42;
  for (const [i, c] of cols.entries()) {
    ctx.strokeStyle = rgba(c, a);
    ctx.lineWidth = w * 1.3;
    ctx.beginPath();
    ctx.arc(cx, cy, R - i * w, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  // The faint second bow outside it.
  for (const [i, c] of [...cols].reverse().entries()) {
    ctx.strokeStyle = rgba(c, a * 0.3);
    ctx.lineWidth = w * 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.17 - i * w * 1.1, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.restore();
}

// ---- the clouds ----------------------------------------------------------------------------------------
export type CloudBake = { w: number; h: number; ox: number; oy: number; dw: number; dh: number; body: HTMLCanvasElement; lit: HTMLCanvasElement; rim: HTMLCanvasElement; out: HTMLCanvasElement; stamp: string };
/**
 * A cumulus, rasterised once: puffs heaped on a flat base. Each pixel takes the normal of the
 * puff on top there (a sphere), lit from the sun's side and above, darker toward the flat belly
 * and in the creases between puffs. Three masks: the body, how lit, and the silver rim.
 */
export function bakeCloud(seed: number, w: number, h: number, kind: 'heap' | 'flat' | 'tower', lx: number, res: number): CloudBake {
  const W = Math.max(8, Math.ceil(w * res));
  const H = Math.max(8, Math.ceil(h * res));
  const R = (k: number) => hash(seed, k, 77);
  const puffs: [number, number, number][] = [];
  const base = H * 0.86;
  const n = kind === 'flat' ? 9 : kind === 'tower' ? 12 : 10;
  for (let i = 0; i < n; i++) {
    const q = (i + 0.5) / n;
    const bell = Math.pow(Math.sin(q * Math.PI), kind === 'flat' ? 0.4 : 0.8);
    const r = H * (kind === 'flat' ? 0.22 + R(i) * 0.14 : 0.18 + R(i) * 0.12 + bell * 0.14) * (kind === 'tower' ? 0.9 : 1);
    const x = W * (0.08 + q * 0.84) + (R(i + 40) - 0.5) * W * 0.06;
    const y = base - r * 0.55 - bell * H * (kind === 'flat' ? 0.06 : kind === 'tower' ? 0.42 : 0.26) * (0.7 + R(i + 80) * 0.5);
    puffs.push([x, y, Math.min(r, H * 0.5)]);
  }
  // Cauliflower heads on the bigger puffs.
  const extra = kind === 'flat' ? 3 : kind === 'tower' ? 14 : 9;
  for (let i = 0; i < extra; i++) {
    const p = puffs[Math.floor(R(i + 120) * puffs.length)];
    const a = -Math.PI * (0.15 + R(i + 160) * 0.7);
    const r = p[2] * (0.45 + R(i + 200) * 0.3);
    puffs.push([p[0] + Math.cos(a) * p[2] * 0.75, p[1] + Math.sin(a) * p[2] * 0.75, r]);
  }
  // Fit the canvas to the puffs (they heap up past the nominal box), with a margin.
  const pad = 4;
  const bx0 = Math.min(...puffs.map((p) => p[0] - p[2] * 1.2)) - pad;
  const by0 = Math.min(...puffs.map((p) => p[1] - p[2] * 1.2)) - pad;
  const bx1 = Math.max(...puffs.map((p) => p[0] + p[2] * 1.2)) + pad;
  for (const p of puffs) {
    p[0] -= bx0;
    p[1] -= by0;
  }
  return rasterCloud(seed, puffs, Math.ceil(bx1 - bx0), Math.ceil(base - by0 + pad + 4), base - by0, kind, lx, res, w, h, bx0 / res, by0 / res);
}
function rasterCloud(seed: number, puffs: [number, number, number][], W: number, H: number, base: number, kind: 'heap' | 'flat' | 'tower', lx: number, res: number, w: number, h: number, ox: number, oy: number): CloudBake {
  const mkM = () => mk(W, H);
  const body = mkM();
  const lit = mkM();
  const rim = mkM();
  // A soft union of the puffs as a height field (so the light rolls over their joins), then lit by its slope.
  const meanR = puffs.reduce((a, p) => a + p[2], 0) / puffs.length;
  const K = 5 / meanR;
  const hf = new Float32Array(W * H);
  const edgeW = new Float32Array(W * H);
  const edgeNoise = kind === 'flat' ? 0.09 : 0.13;
  const fr = 4 * res + 2;
  for (let y = 0; y < H; y++) {
    if (y > base + 3) break;
    for (let x = 0; x < W; x++) {
      const wob = (n2(x / fr, y / fr, seed) - 0.5) * edgeNoise + (n2(x / (fr * 3), y / (fr * 3), seed + 1) - 0.5) * edgeNoise;
      let sum = 0;
      for (let i = 0; i < puffs.length; i++) {
        const [px, py, pr] = puffs[i];
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 > pr * pr) continue;
        const hh = Math.sqrt(pr * pr - d2);
        sum += Math.expm1(Math.min(40, hh * K));
      }
      if (sum <= 0) continue;
      const hu = Math.log1p(sum) / K;
      hf[y * W + x] = Math.max(0.0001, hu);
      // The silhouette frays with the noise; the light does not.
      edgeW[y * W + x] = wob * meanR * 1.6;
    }
  }
  const ib = body.getContext('2d')!.createImageData(W, H);
  const il = lit.getContext('2d')!.createImageData(W, H);
  const ir = rim.getContext('2d')!.createImageData(W, H);
  const Lx = lx * 0.62;
  const Ly = -0.66;
  const Lz = 0.42;
  const nl = Math.hypot(Lx, Ly, Lz);
  const at = (x: number, y: number) => hf[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hv = hf[y * W + x];
      if (hv <= 0) continue;
      const nx = -(at(x + 1, y) - at(x - 1, y)) * 0.5;
      const ny = -(at(x, y + 1) - at(x, y - 1)) * 0.5;
      const n = Math.hypot(nx, ny, 1);
      const raw = (nx * Lx + ny * Ly + Lz) / (n * nl);
      const belly = smoothstep(base - H * 0.45, base, y);
      let l = smoothstep(0.15, 0.75, raw) * (1 - belly * 0.8);
      l = clamp01(l + (n2(x / (2.5 * res + 1), y / (2.5 * res + 1), seed + 3) - 0.5) * 0.1);
      const cover = clamp01((hv + edgeW[y * W + x]) / 1.4) * (1 - smoothstep(base - 1, base + 3, y));
      if (cover <= 0) continue;
      const i4 = (y * W + x) * 4;
      ib.data[i4 + 3] = 255 * cover;
      il.data[i4 + 3] = 255 * cover * l;
      const edge = 1 - smoothstep(0, 4 * res + 2, hv);
      ir.data[i4 + 3] = 255 * cover * edge * clamp01((nx / n) * lx * 1.4 - (ny / n) * 0.6 + 0.1) * (1 - belly);
      ib.data[i4] = ib.data[i4 + 1] = ib.data[i4 + 2] = 255;
      il.data[i4] = il.data[i4 + 1] = il.data[i4 + 2] = 255;
      ir.data[i4] = ir.data[i4 + 1] = ir.data[i4 + 2] = 255;
    }
  }
  body.getContext('2d')!.putImageData(ib, 0, 0);
  lit.getContext('2d')!.putImageData(il, 0, 0);
  rim.getContext('2d')!.putImageData(ir, 0, 0);
  return { w, h, ox, oy, dw: W / res, dh: H / res, body, lit, rim, out: mkM(), stamp: '' };
}

let tmp: HTMLCanvasElement | null = null;
/** Colour a cloud's masks for the hour into its `out` picture. */
export function tintCloud(c: CloudBake, shade: string, litCol: string, rimCol: string, rimA: number) {
  const key = shade + litCol + rimCol + rimA.toFixed(2);
  if (c.stamp === key) return;
  c.stamp = key;
  const W = c.out.width;
  const H = c.out.height;
  if (!tmp || tmp.width < W || tmp.height < H) tmp = mk(Math.max(W, tmp?.width ?? 0), Math.max(H, tmp?.height ?? 0));
  const o = c.out.getContext('2d')!;
  const t = tmp.getContext('2d')!;
  o.globalCompositeOperation = 'source-over';
  o.clearRect(0, 0, W, H);
  o.drawImage(c.body, 0, 0);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = shade;
  o.fillRect(0, 0, W, H);
  o.globalCompositeOperation = 'source-over';
  const layer = (mask: HTMLCanvasElement, col: string, a: number) => {
    if (a <= 0.01) return;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, W, H);
    t.drawImage(mask, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = col;
    t.fillRect(0, 0, W, H);
    o.globalAlpha = a;
    o.drawImage(tmp!, 0, 0, W, H, 0, 0, W, H);
    o.globalAlpha = 1;
  };
  layer(c.lit, litCol, 1);
  layer(c.rim, rimCol, rimA);
}

// ---- rain and lightning --------------------------------------------------------------------------------
export function drawRain(E: Env, GW: number, GH: number, rain: number, wind: number) {
  if (rain <= 0.02) return;
  const { ctx, u } = E;
  const slant = Math.max(-0.6, Math.min(0.6, wind / (60 * u)));
  // A veil over the far country first.
  const vg = ctx.createLinearGradient(0, 0, 0, GH);
  vg.addColorStop(0, rgba(E.lit('#9aa4b4'), 0.0));
  vg.addColorStop(0.5, rgba(E.lit('#9aa4b4'), 0.18 * rain));
  vg.addColorStop(1, rgba(E.lit('#9aa4b4'), 0.08 * rain));
  ctx.fillStyle = vg;
  ctx.fillRect(-GW, 0, GW * 3, GH);
  const n = Math.floor(260 * rain * Math.min(1.6, GW / 1600 + 0.4));
  const col = E.lit('#dfe6ee');
  for (const [layer, len, a, sp] of [[0, 18, 0.22, 1], [1, 34, 0.32, 1.6]] as const) {
    ctx.strokeStyle = rgba(col, a * rain * (0.5 + E.L.rim * 0.2 + 0.3));
    ctx.lineWidth = (layer ? 1.3 : 0.8) * u;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const fall = (900 + hash(i, layer, 2) * 300) * u * sp;
      const y = ((hash(i, layer, 3) * GH + E.t * fall) % (GH + 60 * u)) - 30 * u;
      const x = ((hash(i, layer, 4) * GW * 1.3 + y * slant) % (GW * 1.3)) - GW * 0.15;
      ctx.moveTo(x, y);
      ctx.lineTo(x + slant * len * u, y + len * u);
    }
    ctx.stroke();
  }
}
export function drawBolt(E: Env, x: number, top: number, bottom: number, seed: number, age: number) {
  if (age > 0.5) return;
  const { ctx, u } = E;
  const a = 1 - age / 0.5;
  const pts: [number, number][] = [[x, top]];
  let cx = x;
  const n = 14;
  for (let i = 1; i <= n; i++) {
    cx += (hash(seed, i) - 0.5) * 40 * u;
    pts.push([cx, top + ((bottom - top) * i) / n]);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, al] of [[6, 0.15], [2.4, 0.5], [1, 1]] as const) {
    ctx.strokeStyle = `rgba(230,236,255,${(al * a).toFixed(3)})`;
    ctx.lineWidth = w * u;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
  ctx.restore();
}
