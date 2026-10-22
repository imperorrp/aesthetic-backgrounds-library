/**
 * Saber Front's stage, painted once: the light of the seed's hour, the sky (stars, moons and planets,
 * the sun, clouds), the far things on the horizon (spires and the arena, crystal towers, giant trees,
 * a city on stilts in the sea, canyon walls and a walled city), the ground per pixel (sand, paving,
 * moss, deck plates, red rock, each in perspective, lit and hazed), and the ridge we watch from.
 *
 * Everything here is baked on the first paint into canvases the painter lays down each frame; the
 * hour does not change, so they never need painting again. Shapes are in world pixels; the ground's
 * own units are the sim's (x across, d into the distance).
 */
import { hexA, mixRgb } from '../../instruments/kit';
import { FIELDS, type FieldLight } from './fields';
import type { SaberWorld } from './types';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mix = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, clamp01(k));
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};
export { hexA };
export const posmod = (a: number, n: number) => ((a % n) + n) % n;
export const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// ---- noise -----------------------------------------------------------------------------------------
const h2 = (x: number, y: number, s: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const hh = h2;
export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s);
  const b = h2(xi + 1, yi, s);
  const c = h2(xi, yi + 1, s);
  const d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(x: number, y: number, s: number, oct = 4, detail = 1): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    const k = i < 2 ? 1 : detail;
    v += vnoise(x * f, y * f, s + i * 17) * a * k;
    n += a * k;
    a *= 0.5;
    f *= 2.03;
  }
  return v / Math.max(1e-6, n);
}

// ---- the painter's environment -------------------------------------------------------------------------
export type Env = {
  ctx: CanvasRenderingContext2D;
  u: number;
  t: number;
  L: FieldLight;
  night: number;
  /** Which way the light falls across the field: +1 from the right. */
  lx: number;
  /** A colour at a distance d (0 near, 1 horizon): in the ink of the hour, faded into the haze (lift: toward the light). */
  tone(c: string, d: number, lift?: number): string;
  hazeOf(d: number): number;
  glow(x: number, y: number, r: number, color: string, a: number): void;
  /** A pool of light on the ground (a squashed glow). */
  pool(x: number, y: number, r: number, color: string, a: number): void;
  soft(color: string): HTMLCanvasElement;
};

export function createEnv(ctx: CanvasRenderingContext2D, world: SaberWorld): Env {
  const L = FIELDS[world.field].hours[world.hour];
  const glowCache = new Map<string, HTMLCanvasElement>();
  const softCache = new Map<string, HTMLCanvasElement>();
  const toneCache = new Map<string, string>();
  const glowOf = (color: string) => {
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
    return c;
  };
  const hazeOf = (d: number) => clamp01(Math.pow(clamp01(d), 1.5) * 0.82 * L.hazeK + world.fog * 0.25 * clamp01(d) + world.dust * 0.4 * (0.3 + clamp01(d) * 0.7));
  const E: Env = {
    ctx, u: world.u, t: 0, L, night: L.night, lx: L.lx,
    hazeOf,
    tone(c, d, lift = 0) {
      const dq = Math.round(clamp01(d) * 40);
      const key = `${c}|${dq}|${Math.round(lift * 20)}|${Math.round(world.dust * 10)}|${Math.round(world.fog * 10)}`;
      let v = toneCache.get(key);
      if (!v) {
        const dd = dq / 40;
        const inked = mix(c, L.ink, 0.12 + L.night * 0.5);
        const lit = mix(inked, L.sun, lift * (0.6 - L.night * 0.3));
        v = mix(lit, mix(L.haze, L.low, (1 - dd) * 0.2), hazeOf(dd));
        if (toneCache.size > 4000) toneCache.clear();
        toneCache.set(key, v);
      }
      return v;
    },
    glow(x, y, r, color, a) {
      if (a <= 0.01 || r <= 0.3) return;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glowOf(color), x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = prev;
    },
    pool(x, y, r, color, a) {
      if (a <= 0.01 || r <= 0.3) return;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glowOf(color), x - r, y - r * 0.3, r * 2, r * 0.6);
      ctx.globalAlpha = prev;
    },
    soft(color) {
      const q = color.replace(/[0-9a-f]{2}/gi, (h) => Math.min(255, Math.round(parseInt(h, 16) / 10) * 10).toString(16).padStart(2, '0'));
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
        if (softCache.size > 300) softCache.clear();
        softCache.set(q, c);
      }
      return c;
    },
  };
  return E;
}

// ---- the sky -------------------------------------------------------------------------------------------
type R = () => number;
/** A cloud of soft lobes: dark above, lit beneath (or the other way), toward the light. */
function cloud(g: CanvasRenderingContext2D, R: R, cx: number, cy: number, w: number, h: number, top: string, lit: string, a: number, flat = 0.5) {
  const n = Math.max(6, Math.round(w / Math.max(4, h * 0.5)));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const q = i / (n - 1);
      const x = cx - w / 2 + q * w + (R() - 0.5) * h * 0.6;
      const bulge = Math.sin(q * Math.PI);
      const rr = h * (0.35 + bulge * 0.6) * (0.7 + R() * 0.5);
      const y = cy - (pass ? rr * 0.15 : rr * 0.45) * (1 - flat * 0.5) + (R() - 0.5) * h * 0.2;
      const col = pass ? lit : top;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, hexA(col, a * (pass ? 0.55 : 0.85)));
      gr.addColorStop(0.6, hexA(col, a * (pass ? 0.25 : 0.5)));
      gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y + (pass ? rr * 0.2 : 0), rr * 1.5, rr * (0.55 + flat * 0.1), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

export function bakeSky(world: SaberWorld, E: Env, R: R): HTMLCanvasElement {
  const { GW, HY, u } = world;
  const H = HY + 40 * u;
  const c = mk(GW, H);
  const g = c.getContext('2d')!;
  const L = E.L;
  const sg = g.createLinearGradient(0, 0, 0, HY);
  sg.addColorStop(0, L.top);
  sg.addColorStop(0.6, L.mid);
  sg.addColorStop(1, L.low);
  g.fillStyle = sg;
  g.fillRect(0, 0, GW, H);
  const field = world.style;
  // Stars, and the nebula's band, by night.
  if (L.night > 0.35) {
    const n = Math.round(GW * HY / (1800 * u * u));
    for (let i = 0; i < n; i++) {
      const x = R() * GW;
      const y = Math.pow(R(), 1.4) * HY * 0.95;
      const k = R();
      const fade = (1 - y / HY) * L.night;
      g.fillStyle = `rgba(235,240,255,${(fade * (0.2 + k * 0.75)).toFixed(3)})`;
      const s = k > 0.97 ? 2.2 * u : k > 0.85 ? 1.5 * u : 1 * u;
      g.fillRect(x, y, s, s);
    }
    const band = field === 'jungle' ? '#3a6a5a' : field === 'crystal' ? '#5a4ab0' : '#4a3a7a';
    for (let i = 0; i < 40; i++) {
      const q = R();
      const x = GW * (0.1 + q * 0.9);
      const y = HY * (0.05 + q * 0.5) + (R() - 0.5) * HY * 0.18;
      const rr = (60 + R() * 140) * u;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, hexA(R() < 0.3 ? L.accent : band, 0.07 * L.night));
      gr.addColorStop(1, hexA(band, 0));
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }
  // A planet hanging in the sky: a ringed giant, pale by day.
  if (field === 'hangar') {
    // Coruscant below the ship: the curve of a world that is all city, lit gold to its edge.
    const cr = GW * 1.4;
    const cy = HY * 0.74 + cr;
    const pg = g.createRadialGradient(GW * 0.5, cy, cr * 0.8, GW * 0.5, cy, cr);
    pg.addColorStop(0, '#120c10');
    pg.addColorStop(0.92, '#2a1a20');
    pg.addColorStop(1, hexA('#8ab8ff', 0.6));
    g.fillStyle = pg;
    g.beginPath();
    g.arc(GW * 0.5, cy, cr, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(GW * 0.5, cy, cr, 0, Math.PI * 2);
    g.clip();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2600; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 1.3;
      const rr = cr * (0.86 + R() * 0.14);
      const x = GW * 0.5 + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      g.fillStyle = hexA(R() < 0.8 ? '#ffc870' : '#ffe8c0', 0.2 + R() * 0.5);
      g.fillRect(x, y, 1.2 * u, 1.2 * u);
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();
  } else if (field !== 'platform') {
    const px = GW * (L.lx > 0 ? 0.12 + R() * 0.2 : 0.68 + R() * 0.2);
    const py = HY * (0.18 + R() * 0.14);
    const pr = (field === 'crystal' ? 120 : 80 + R() * 60) * u;
    const a = field === 'canyon' ? 0.32 : field === 'arena' ? 0.45 : 0.8;
    const pc = field === 'crystal' ? '#8a9ad8' : field === 'jungle' ? '#a8c8b0' : '#e0c8b0';
    g.save();
    g.globalAlpha = a;
    const pg = g.createRadialGradient(px - L.lx * pr * 0.4, py - pr * 0.3, pr * 0.1, px, py, pr);
    pg.addColorStop(0, mix(pc, '#ffffff', 0.3));
    pg.addColorStop(0.7, pc);
    pg.addColorStop(1, mix(pc, L.top, 0.7));
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, Math.PI * 2);
    g.fill();
    // Its bands.
    g.save();
    g.clip();
    for (let i = 0; i < 9; i++) {
      g.fillStyle = hexA(i % 2 ? mix(pc, L.ink, 0.3) : mix(pc, '#ffffff', 0.2), 0.25);
      const by = py - pr + (i / 9) * pr * 2 + R() * 6 * u;
      g.fillRect(px - pr, by, pr * 2, pr * (0.06 + R() * 0.08));
    }
    // The night side.
    const ng = g.createLinearGradient(px + L.lx * pr, 0, px - L.lx * pr, 0);
    ng.addColorStop(0, hexA(L.top, 0));
    ng.addColorStop(0.55, hexA(L.top, 0.3));
    ng.addColorStop(1, hexA(L.top, 0.92));
    g.fillStyle = ng;
    g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    g.restore();
    // The rings, tilted.
    g.strokeStyle = hexA(mix(pc, '#ffffff', 0.4), 0.5);
    for (const [k, w] of [[1.55, 3], [1.75, 1.6], [1.95, 4]] as [number, number][]) {
      g.lineWidth = w * u;
      g.beginPath();
      g.ellipse(px, py, pr * k, pr * k * 0.22, -0.22, Math.PI * 0.94, Math.PI * 2.06);
      g.stroke();
    }
    g.restore();
    if (field === 'crystal' || field === 'jungle') {
      // A small moon beside it.
      const mx = px + (L.lx > 0 ? 1 : -1) * pr * 2.6;
      const my = py + pr * 0.6;
      g.fillStyle = hexA('#d8dce8', 0.8);
      g.beginPath();
      g.arc(mx, my, 14 * u, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hexA(L.top, 0.7);
      g.beginPath();
      g.arc(mx - L.lx * 6 * u, my - 2 * u, 13 * u, 0, Math.PI * 2);
      g.fill();
    }
  }
  // The sun (or the moon by night) and its glare.
  if (L.sunAt) {
    const sx = GW * L.sunAt[0];
    const sy = HY * L.sunAt[1];
    const glow = (r: number, col: string, a: number) => {
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
      gr.addColorStop(0, hexA(col, a));
      gr.addColorStop(0.3, hexA(col, a * 0.35));
      gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr;
      g.fillRect(sx - r, sy - r, r * 2, r * 2);
    };
    glow(L.sunR * 9 * u, L.sun, 0.45);
    glow(L.sunR * 3 * u, mix(L.sun, '#ffffff', 0.4), 0.6);
    g.fillStyle = mix(L.sun, '#fffaf0', L.night > 0.5 ? 0.5 : 0.65);
    g.beginPath();
    g.arc(sx, sy, L.sunR * u, 0, Math.PI * 2);
    g.fill();
    if (L.night > 0.5) {
      // Maria on the moon.
      g.fillStyle = hexA(L.ink, 0.12);
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(sx + (R() - 0.5) * L.sunR * u, sy + (R() - 0.5) * L.sunR * u, L.sunR * u * (0.15 + R() * 0.2), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // Clouds, by the field's weather.
  const sunX = L.sunAt ? GW * L.sunAt[0] : GW / 2;
  const litOf = (x: number, k: number) => mix(L.low, L.sun, clamp01(k * (1 - Math.abs(x - sunX) / GW)));
  if (field === 'platform') {
    for (let i = 0; i < 70; i++) {
      const y = HY * Math.pow(R(), 0.8) * 0.95;
      const x = R() * GW;
      const w = (200 + R() * 500) * u;
      const top = mix(L.top, L.ink, 0.35 + R() * 0.2);
      cloud(g, R, x, y, w, (40 + R() * 70) * u * (0.6 + y / HY), top, mix(L.mid, L.low, y / HY), 0.75, 0.7);
    }
  } else if (field === 'arena') {
    for (let i = 0; i < 16; i++) {
      const y = HY * (0.35 + R() * 0.5);
      const x = R() * GW;
      cloud(g, R, x, y, (260 + R() * 600) * u, (10 + R() * 14) * u, mix(L.mid, L.top, 0.4), litOf(x, 0.9), 0.6, 1);
    }
  } else if (field === 'hangar') {
    // Open space: no clouds, only the flak bursts the painter adds.
  } else if (field === 'canyon' || field === 'beach') {
    for (let i = 0; i < 9; i++) {
      const y = HY * (0.2 + R() * 0.45);
      const x = R() * GW;
      cloud(g, R, x, y, (160 + R() * 260) * u, (30 + R() * 30) * u, mix(L.mid, L.top, 0.2), mix('#ffffff', litOf(x, 0.6), 0.5), 0.55, 0.4);
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const y = HY * (0.25 + R() * 0.6);
      const x = R() * GW;
      cloud(g, R, x, y, (240 + R() * 420) * u, (14 + R() * 20) * u, mix(L.top, L.ink, 0.3), mix(L.mid, L.accent, 0.25), 0.55, 0.8);
    }
  }
  return c;
}

// ---- the horizon: what stands beyond the field --------------------------------------------------------------
/** The far things, on a transparent canvas the size of the sky, standing on the horizon. */
export function bakeBackdrop(world: SaberWorld, E: Env, R: R): HTMLCanvasElement {
  const { GW, HY, u } = world;
  const H = HY + 60 * u;
  const c = mk(GW, H);
  const g = c.getContext('2d')!;
  const L = E.L;
  const lx = L.lx;
  /** The colour of rock (or glass, or wood) at a far layer k (0 farthest). */
  const far = (base: string, k: number) => mix(mix(base, L.ink, 0.25 + L.night * 0.4), mix(L.haze, L.low, 0.4), 0.78 - k * 0.24);
  const lit = (base: string, k: number) => mix(far(base, k), L.sun, (0.25 + L.rim * 0.3) * (1 - L.night * 0.6));
  const field = world.style;
  if (field === 'arena') {
    // Low mesas far off, then fields of spires, and the arena itself.
    for (const k of [0, 1]) {
      g.fillStyle = far('#8a5040', k * 0.5);
      g.beginPath();
      g.moveTo(0, HY + 2);
      for (let x = 0; x <= GW; x += 4) g.lineTo(x, HY - (clamp01((vnoise(x / (160 * u), k * 9, 7) - 0.45) * 4) * 30 + vnoise(x / (40 * u), k, 8) * 6) * u * (k ? 0.7 : 1));
      g.lineTo(GW, HY + 2);
      g.fill();
    }
    const arenaX = GW * (0.25 + R() * 0.5);
    for (const k of [0, 1, 2]) {
      const n = Math.round((k === 0 ? 26 : k === 1 ? 16 : 9) * GW / (1600 * u));
      for (let i = 0; i < n; i++) {
        const x = R() * GW;
        if (k === 1 && Math.abs(x - arenaX) < 160 * u) continue;
        spire(g, R, x, HY + (k * 3 + 2) * u, (8 + R() * 16 + k * 8) * u, (40 + R() * 120 + k * 70) * u * (0.6 + R() * 0.6), far('#9a5a40', k), lit('#c07a50', k), lx);
      }
      if (k === 1) colosseum(g, R, arenaX, HY + 4 * u, 260 * u, 46 * u, far('#a86848', 1), lit('#d09060', 1), lx, L.night);
    }
  } else if (field === 'crystal') {
    for (const k of [0, 1, 2]) {
      const n = Math.round((k === 0 ? 30 : k === 1 ? 20 : 12) * GW / (1600 * u));
      for (let i = 0; i < n; i++) {
        const x = R() * GW;
        const w = (16 + R() * 34 + k * 10) * u;
        const h = Math.min(HY * 0.62, (50 + R() * 170 + k * 50) * u * (0.5 + Math.sin((x / GW) * Math.PI) * 0.6));
        tower(g, R, x, HY + (k * 2 + 2) * u, w, h, far('#3a4a8a', k), lit('#6a88d0', k), L.accent, lx, k, L.night);
      }
      // A skybridge or two between the towers.
      if (k === 1)
        for (let i = 0; i < 3; i++) {
          const x = R() * GW;
          const y = HY - (60 + R() * 120) * u;
          g.fillStyle = far('#2a3060', k);
          g.fillRect(x, y, (80 + R() * 120) * u, 3 * u);
          g.fillStyle = hexA(L.accent, 0.5);
          for (let j = 0; j < 8; j++) g.fillRect(x + j * 14 * u, y + 1 * u, 3 * u, 1 * u);
        }
    }
    // The city's glow along the horizon.
    const hg = g.createLinearGradient(0, HY - 80 * u, 0, HY);
    hg.addColorStop(0, hexA(L.accent, 0));
    hg.addColorStop(1, hexA(L.accent, 0.18));
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = hg;
    g.fillRect(0, HY - 80 * u, GW, 80 * u);
    g.globalCompositeOperation = 'source-over';
  } else if (field === 'jungle') {
    for (const k of [0, 1, 2]) {
      // The canopy line.
      g.fillStyle = far('#1e3a24', k);
      g.beginPath();
      g.moveTo(0, HY + 4);
      for (let x = 0; x <= GW; x += 5) g.lineTo(x, HY - (14 + k * 16 + fbm(x / (60 * u), k * 5, 31, 3) * (30 + k * 30)) * u);
      g.lineTo(GW, HY + 4);
      g.fill();
      const n = Math.round((k === 0 ? 10 : k === 1 ? 8 : 6) * GW / (1600 * u));
      for (let i = 0; i < n; i++) {
        const x = R() * GW;
        const felucia = world.field === 'felucia';
        const caps = felucia ? ['#d86a9a', '#e8a040', '#4ab8a8', '#c84a6a'] : ['#2a3a4a', '#3a2a4a'];
        if (R() < FIELDS[world.field].fungi) fungus(g, R, x, HY + (k * 3 + 3) * u, (60 + R() * 90 + k * 50) * u * (felucia ? 1.4 : 1), far(felucia ? '#c8b8a0' : '#3a4a3a', k), far(caps[Math.floor(R() * caps.length)], k * 0.8 + (felucia ? 0.6 : 0)), L.accent, lx, k);
        else bigTree(g, R, x, HY + (k * 3 + 3) * u, (90 + R() * 140 + k * 70) * u, far('#26382a', k), lit('#4a6a44', k), lx, k);
      }
      // Mist in the trees.
      const mg = g.createLinearGradient(0, HY - (40 + k * 30) * u, 0, HY);
      mg.addColorStop(0, hexA(L.haze, 0));
      mg.addColorStop(1, hexA(mix(L.haze, '#c8d8d0', 0.25), 0.45));
      g.fillStyle = mg;
      g.fillRect(0, HY - (40 + k * 30) * u, GW, (40 + k * 30) * u + 4);
    }
    // Glowing things in the dark of the trees.
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 80; i++) {
      g.fillStyle = hexA(L.accent, 0.25 + R() * 0.4);
      g.fillRect(R() * GW, HY - R() * 120 * u, 1.6 * u, 1.6 * u);
    }
    g.globalCompositeOperation = 'source-over';
  } else if (field === 'beach') {
    // The lagoon to the horizon, Wookiee tree-cities on its far shore, the great wroshyr trees.
    const wg = g.createLinearGradient(0, HY - 6 * u, 0, HY + 4);
    wg.addColorStop(0, far('#6a8a98', 0.3));
    wg.addColorStop(1, far('#4a6a78', 0.5));
    g.fillStyle = wg;
    g.fillRect(0, HY - 6 * u, GW, 10 * u);
    for (const k of [0, 1, 2]) {
      const n = Math.round((k === 0 ? 7 : k === 1 ? 5 : 4) * GW / (1600 * u));
      for (let i = 0; i < n; i++) wroshyr(g, R, R() * GW, HY - (k === 0 ? 4 : 0) * u + k * 2 * u, (140 + R() * 120 + k * 120) * u, far('#3a3426', k), lit('#7a6a48', k), L.accent, lx, L.night, k);
      const mg = g.createLinearGradient(0, HY - (60 + k * 40) * u, 0, HY);
      mg.addColorStop(0, hexA(L.haze, 0));
      mg.addColorStop(1, hexA(mix(L.haze, '#e0e8e0', 0.2), 0.35));
      g.fillStyle = mg;
      g.fillRect(0, HY - (60 + k * 40) * u, GW, (60 + k * 40) * u + 4);
    }
  } else if (field === 'hangar') {
    // The hangar's far end: the ceiling with its light strips and gantries; the mouth open on space, its magnetic field shimmering.
    const mx0 = GW * 0.14;
    const mx1 = GW * 0.86;
    const my0 = HY * 0.22;
    const metal = mix('#2a2e36', L.ink, 0.3);
    const metalLit = mix('#5a606c', L.sun, 0.1);
    g.fillStyle = metal;
    g.beginPath();
    g.rect(0, 0, GW, HY + 60 * u);
    g.rect(mx0, my0, mx1 - mx0, HY - my0);
    g.fill('evenodd');
    // Panels and ribs on the back wall and ceiling.
    g.strokeStyle = hexA('#000000', 0.45);
    g.lineWidth = 1;
    for (let x = 0; x < GW; x += 40 * u) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, my0);
      g.stroke();
    }
    for (let y = 10 * u; y < my0; y += 22 * u) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(GW, y);
      g.stroke();
    }
    g.fillStyle = metalLit;
    g.fillRect(mx0 - 8 * u, my0 - 8 * u, mx1 - mx0 + 16 * u, 8 * u);
    g.fillRect(mx0 - 8 * u, my0, 8 * u, HY - my0);
    g.fillRect(mx1, my0, 8 * u, HY - my0);
    // Light strips along the ceiling, warning stripes round the mouth.
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const y = my0 * (0.2 + i * 0.2);
      g.fillStyle = hexA(L.accent, 0.35);
      g.fillRect(GW * 0.1, y, GW * 0.8, 2 * u);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 30; i++) {
      g.fillStyle = i % 2 ? '#d8b030' : '#1a1a1a';
      g.fillRect(mx0 + (i / 30) * (mx1 - mx0), my0 - 3 * u, (mx1 - mx0) / 30, 3 * u);
    }
    // The magnetic field across the mouth: a faint blue sheen and its edge.
    const fg = g.createLinearGradient(0, my0, 0, HY);
    fg.addColorStop(0, 'rgba(120,180,255,0.06)');
    fg.addColorStop(1, 'rgba(120,180,255,0.12)');
    g.fillStyle = fg;
    g.fillRect(mx0, my0, mx1 - mx0, HY - my0);
    // Gantries hanging from the ceiling, and a crane.
    for (let i = 0; i < 3; i++) {
      const x = GW * (0.2 + i * 0.3);
      g.fillStyle = mix(metal, '#000000', 0.2);
      g.fillRect(x - 3 * u, 0, 6 * u, my0 + 20 * u);
      g.fillRect(x - 40 * u, my0 + 20 * u, 80 * u, 6 * u);
      g.fillStyle = hexA(L.accent, 0.8);
      g.fillRect(x - 30 * u, my0 + 26 * u, 6 * u, 3 * u);
      g.fillRect(x + 24 * u, my0 + 26 * u, 6 * u, 3 * u);
    }
  } else if (field === 'platform') {
    // The sea at the horizon, and the stilt city standing in it.
    for (const k of [0, 1]) {
      const n = Math.round((k ? 7 : 12) * GW / (1600 * u));
      for (let i = 0; i < n; i++) stilts(g, R, R() * GW, HY + 2 * u, (k ? 40 : 22) * u * (0.7 + R() * 0.6), (k ? 70 : 40) * u * (0.7 + R() * 0.7), far('#4a5560', k + 0.5), lit('#8a98a0', k + 0.5), L.accent, lx, L.night);
    }
  } else {
    // Canyon walls rising either side, and the walled city in the gap between them.
    const cityX = GW * (0.35 + R() * 0.3);
    for (const k of [0, 1]) {
      g.fillStyle = far('#7a4030', k);
      g.beginPath();
      g.moveTo(0, HY + 4);
      for (let x = 0; x <= GW; x += 4) {
        const e = Math.min(x, GW - x) / GW;
        const wall = Math.pow(clamp01(1 - (e * 2.2 + (Math.abs(x - cityX) < 300 * u ? 0.4 : 0))), 1.3) * (k ? 300 : 200) * u;
        g.lineTo(x, HY - wall - (vnoise(x / (30 * u), k, 41) * 18 + 10) * u * (k ? 1.4 : 1));
      }
      g.lineTo(GW, HY + 4);
      g.fill();
      // Strata, and the faces toward the light.
      g.save();
      g.clip();
      for (let i = 0; i < 30; i++) {
        g.fillStyle = hexA(i % 2 ? lit('#c07050', k) : far('#4a2418', k), 0.25);
        const y = HY - i * 11 * u - R() * 4 * u;
        g.fillRect(0, y, GW, (2 + R() * 3) * u);
      }
      const fg = g.createLinearGradient(0, 0, GW, 0);
      fg.addColorStop(lx > 0 ? 0 : 1, hexA(lit('#e09a68', k), 0.35));
      fg.addColorStop(0.5, hexA(far('#7a4030', k), 0));
      fg.addColorStop(lx > 0 ? 1 : 0, hexA(far('#2a1410', k), 0.4));
      g.fillStyle = fg;
      g.fillRect(0, 0, GW, H);
      g.restore();
    }
    walledCity(g, R, cityX, HY + 4 * u, 420 * u, far('#b08a68', 1.4), lit('#e8c098', 1.4), L.accent, lx, L.night, u);
  }
  return c;
}

function spire(g: CanvasRenderingContext2D, R: R, x: number, base: number, w: number, h: number, col: string, lit: string, lx: number) {
  const n = 14;
  const L: [number, number][] = [];
  const Rt: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    // Waisted pillars with a flared cap, eroded at the edges.
    const prof = w * (0.55 + 0.45 * Math.abs(Math.sin(q * 3 + x)) * 0.6 + (q > 0.85 ? (q - 0.85) * 4 : 0) - q * 0.25);
    const j = (R() - 0.5) * w * 0.18;
    L.push([x - prof / 2 + j, base - q * h]);
    Rt.push([x + prof / 2 + j, base - q * h]);
  }
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (const p of L) g.lineTo(p[0], p[1]);
  for (const p of [...Rt].reverse()) g.lineTo(p[0], p[1]);
  g.closePath();
  g.fill();
  // The face toward the light.
  g.fillStyle = hexA(lit, 0.7);
  g.beginPath();
  const side = lx > 0 ? Rt : L;
  g.moveTo(side[0][0], side[0][1]);
  for (const p of side) g.lineTo(p[0], p[1]);
  for (const p of [...side].reverse()) g.lineTo(p[0] - lx * w * 0.22, p[1]);
  g.fill();
  g.fillStyle = hexA(col, 0.6);
  for (let i = 1; i < 5; i++) g.fillRect(x - w * 0.4, base - h * (i / 5) - R() * 4, w * 0.8, 1.2);
}

function colosseum(g: CanvasRenderingContext2D, R: R, x: number, base: number, w: number, h: number, col: string, lit: string, lx: number, night: number) {
  // The back of the ring, the front wall with its arches, the rim.
  g.fillStyle = mix(col, '#000000', 0.15);
  g.beginPath();
  g.ellipse(x, base - h, w / 2, h * 0.32, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - w / 2, base - h);
  g.ellipse(x, base - h, w / 2, h * 0.32, 0, Math.PI, 0, true);
  g.lineTo(x + w / 2, base);
  g.ellipse(x, base, w / 2, h * 0.3, 0, 0, Math.PI);
  g.closePath();
  g.fill();
  const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  lg.addColorStop(lx > 0 ? 1 : 0, hexA(lit, 0.8));
  lg.addColorStop(0.5, hexA(lit, 0));
  g.fillStyle = lg;
  g.fill();
  // Arches, in two tiers.
  for (const [tier, k] of [[0.3, 0.42], [0.72, 0.32]] as [number, number][]) {
    const n = 22;
    for (let i = 1; i < n; i++) {
      const a = Math.PI * (i / n);
      const ax = x - Math.cos(a) * w * 0.48;
      const ay = base - h * tier + Math.sin(a) * h * 0.28;
      const aw = w * 0.018 * Math.sin(a);
      g.fillStyle = hexA('#100808', 0.75);
      g.beginPath();
      g.moveTo(ax - aw, ay);
      g.lineTo(ax - aw, ay - h * k * 0.5);
      g.arc(ax, ay - h * k * 0.5, aw, Math.PI, 0);
      g.lineTo(ax + aw, ay);
      g.fill();
      if (night > 0.3 && R() < 0.3) {
        g.fillStyle = hexA('#ff9a50', 0.6 * night);
        g.fillRect(ax - aw * 0.5, ay - h * k * 0.3, aw, h * k * 0.25);
      }
    }
  }
  g.strokeStyle = hexA(lit, 0.6);
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(x, base - h, w / 2, h * 0.32, 0, Math.PI * 0.05, Math.PI * 0.95);
  g.stroke();
}

function tower(g: CanvasRenderingContext2D, R: R, x: number, base: number, w: number, h: number, col: string, lit: string, accent: string, lx: number, k: number, night: number) {
  const top = base - h;
  const cut = R();
  const peak = cut < 0.45 ? h * (0.12 + R() * 0.2) : 0;
  const broken = R() < 0.15;
  // Two faces of a prism: the lit one and the dark one, split off-centre.
  const split = x + (R() - 0.5) * w * 0.3;
  const shape = (x0: number, x1: number, fill: string) => {
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(x0, base);
    g.lineTo(x0, top + (cut > 0.7 ? (x0 < split ? 1 : -1) * w * 0.4 : 0) + (broken ? R() * h * 0.2 : 0));
    if (peak) g.lineTo(split, top - peak);
    g.lineTo(x1, top + (cut > 0.7 ? (x1 < split ? 1 : -1) * w * 0.4 : 0) + (broken ? R() * h * 0.2 : 0));
    g.lineTo(x1, base);
    g.fill();
  };
  shape(x - w / 2, split, lx < 0 ? lit : col);
  shape(split, x + w / 2, lx > 0 ? lit : mix(col, '#000000', 0.2));
  // Seams that glow, and windows.
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = hexA(accent, (0.25 + night * 0.35) * (0.5 + k * 0.25));
  g.fillRect(split - 0.6, top + 4, 1.2, h - 4);
  const rows = Math.floor(h / 9);
  for (let i = 1; i < rows; i++)
    for (let j = 0; j < 3; j++) {
      if (R() > 0.3 + night * 0.25) continue;
      g.fillStyle = hexA(R() < 0.7 ? accent : '#ffe0a0', 0.2 + R() * 0.4 * night);
      g.fillRect(x - w * 0.4 + j * w * 0.3, base - i * 9, Math.max(1, w * 0.12), 2);
    }
  g.globalCompositeOperation = 'source-over';
  if (R() < 0.3) {
    g.strokeStyle = col;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(split, top - peak);
    g.lineTo(split, top - peak - h * 0.25);
    g.stroke();
    g.fillStyle = hexA('#ff4040', 0.8);
    g.fillRect(split - 1, top - peak - h * 0.25 - 1, 2, 2);
  }
}

function bigTree(g: CanvasRenderingContext2D, R: R, x: number, base: number, h: number, col: string, lit: string, lx: number, k: number) {
  const tw = h * (0.05 + R() * 0.03);
  // The trunk, flaring into buttress roots.
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - tw * 2.4, base);
  g.quadraticCurveTo(x - tw * 0.8, base - h * 0.1, x - tw * 0.6, base - h * 0.3);
  g.lineTo(x - tw * 0.45, base - h * 0.9);
  g.lineTo(x + tw * 0.45, base - h * 0.9);
  g.lineTo(x + tw * 0.6, base - h * 0.3);
  g.quadraticCurveTo(x + tw * 0.8, base - h * 0.1, x + tw * 2.4, base);
  g.fill();
  g.fillStyle = hexA(lit, 0.5);
  g.fillRect(x + (lx > 0 ? tw * 0.1 : -tw * 0.5), base - h * 0.85, tw * 0.35, h * 0.75);
  // The crown: lobes of leaves, lit on top.
  const cy = base - h * 0.9;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = h * (0.1 + R() * 0.08);
    const ox = Math.cos(a) * h * 0.18;
    const oy = Math.sin(a) * h * 0.07 - h * 0.04;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x + ox, cy + oy, rr * 1.3, rr * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hexA(lit, 0.35 + k * 0.1);
    g.beginPath();
    g.ellipse(x + ox + lx * rr * 0.3, cy + oy - rr * 0.35, rr * 0.8, rr * 0.35, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Vines.
  g.strokeStyle = hexA(col, 0.9);
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const vx = x + (R() - 0.5) * h * 0.4;
    g.beginPath();
    g.moveTo(vx, cy);
    g.quadraticCurveTo(vx + 4, cy + h * 0.2, vx - 2, cy + h * (0.25 + R() * 0.3));
    g.stroke();
  }
}

/** A wroshyr tree of Kashyyyk: a vast trunk rising out of the lagoon, branches spreading like hands, Wookiee platforms and lights in it. */
function wroshyr(g: CanvasRenderingContext2D, R: R, x: number, base: number, h: number, col: string, lit: string, accent: string, lx: number, night: number, k: number) {
  const tw = h * (0.07 + R() * 0.03);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - tw * 1.8, base);
  g.quadraticCurveTo(x - tw * 0.6, base - h * 0.3, x - tw * 0.5, base - h * 0.75);
  g.lineTo(x + tw * 0.5, base - h * 0.75);
  g.quadraticCurveTo(x + tw * 0.6, base - h * 0.3, x + tw * 1.8, base);
  g.fill();
  g.fillStyle = hexA(lit, 0.45);
  g.fillRect(x + (lx > 0 ? tw * 0.05 : -tw * 0.45), base - h * 0.72, tw * 0.35, h * 0.7);
  // Branches spreading up from the top, the canopy on them.
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.35;
    const bx = x + Math.cos(a) * h * 0.3;
    const by = base - h * 0.72 + Math.sin(a) * h * 0.25;
    g.strokeStyle = col;
    g.lineWidth = tw * 0.4;
    g.beginPath();
    g.moveTo(x, base - h * 0.7);
    g.quadraticCurveTo(x + Math.cos(a) * h * 0.12, base - h * 0.85, bx, by);
    g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(bx, by, h * (0.12 + R() * 0.06), h * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hexA(lit, 0.3);
    g.beginPath();
    g.ellipse(bx + lx * h * 0.03, by - h * 0.02, h * 0.07, h * 0.02, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Platforms round the trunk, with lights.
  for (let i = 0; i < 3; i++) {
    const py = base - h * (0.2 + i * 0.17);
    g.fillStyle = col;
    g.fillRect(x - tw * 2, py, tw * 4, tw * 0.25);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = hexA(accent, (0.25 + night * 0.5) * (0.5 + k * 0.2));
    for (let j = 0; j < 4; j++) g.fillRect(x - tw * 1.6 + j * tw, py - tw * 0.3, tw * 0.2, tw * 0.2);
    g.globalCompositeOperation = 'source-over';
  }
}

function fungus(g: CanvasRenderingContext2D, R: R, x: number, base: number, h: number, col: string, cap: string, accent: string, lx: number, k: number) {
  const sw = h * 0.07;
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - sw * 1.6, base);
  g.quadraticCurveTo(x - sw * 0.5, base - h * 0.5, x - sw * 0.6, base - h);
  g.lineTo(x + sw * 0.6, base - h);
  g.quadraticCurveTo(x + sw * 0.5, base - h * 0.5, x + sw * 1.6, base);
  g.fill();
  const cw = h * (0.35 + R() * 0.2);
  g.fillStyle = cap;
  g.beginPath();
  g.ellipse(x, base - h, cw, cw * 0.32, 0, Math.PI, Math.PI * 2);
  g.quadraticCurveTo(x, base - h + cw * 0.12, x - cw, base - h);
  g.fill();
  // The gills glow.
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = hexA(accent, 0.25 + k * 0.1);
  g.beginPath();
  g.ellipse(x, base - h + 1, cw * 0.9, cw * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 6; i++) {
    g.fillStyle = hexA(accent, 0.5);
    g.beginPath();
    g.arc(x + (R() - 0.5) * cw * 1.4, base - h - R() * cw * 0.2, 1.5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  void lx;
}

function stilts(g: CanvasRenderingContext2D, R: R, x: number, base: number, w: number, h: number, col: string, lit: string, accent: string, lx: number, night: number) {
  // Thin legs into the sea, a domed pod on them, an aerial.
  g.strokeStyle = col;
  g.lineWidth = Math.max(1, w * 0.05);
  g.beginPath();
  for (const k of [-0.3, 0, 0.3]) {
    g.moveTo(x + k * w, base);
    g.lineTo(x + k * w * 0.6, base - h);
  }
  g.stroke();
  const py = base - h;
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, py, w / 2, w * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(x, py - w * 0.05, w * 0.36, w * 0.3, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA(lit, 0.6);
  g.beginPath();
  g.ellipse(x + lx * w * 0.12, py - w * 0.14, w * 0.16, w * 0.12, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    g.fillStyle = hexA(accent, 0.3 + night * 0.5);
    g.fillRect(x - w * 0.4 + (i / 6) * w * 0.8, py + 1, w * 0.06, 1.4);
  }
  g.globalCompositeOperation = 'source-over';
  if (R() < 0.6) {
    g.strokeStyle = col;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, py - w * 0.3);
    g.lineTo(x, py - w * 0.3 - h * 0.4);
    g.stroke();
    g.fillStyle = hexA('#ff5040', 0.9);
    g.fillRect(x - 1, py - w * 0.3 - h * 0.4 - 1, 2.4, 2.4);
  }
}

function walledCity(g: CanvasRenderingContext2D, R: R, x: number, base: number, w: number, col: string, lit: string, accent: string, lx: number, night: number, u: number) {
  // The plateau it stands on.
  g.fillStyle = mix(col, '#000000', 0.15);
  g.beginPath();
  g.moveTo(x - w * 0.7, base);
  g.lineTo(x - w * 0.55, base - 40 * u);
  g.lineTo(x + w * 0.55, base - 44 * u);
  g.lineTo(x + w * 0.7, base);
  g.fill();
  const top = base - 42 * u;
  // Domes and towers behind the wall.
  for (let i = 0; i < 16; i++) {
    const bx = x + (R() - 0.5) * w * 0.9;
    const bh = (20 + R() * 50) * u;
    const bw = (12 + R() * 26) * u;
    g.fillStyle = mix(col, '#000000', 0.08 + R() * 0.1);
    g.fillRect(bx - bw / 2, top - bh, bw, bh);
    if (R() < 0.5) {
      g.beginPath();
      g.arc(bx, top - bh, bw / 2, Math.PI, 0);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(bx - bw * 0.2, top - bh);
      g.lineTo(bx, top - bh - bw);
      g.lineTo(bx + bw * 0.2, top - bh);
      g.fill();
    }
    g.fillStyle = hexA(lit, 0.45);
    g.fillRect(bx + (lx > 0 ? bw * 0.15 : -bw / 2), top - bh, bw * 0.35, bh);
    for (let j = 0; j < 4; j++) {
      if (R() > 0.4 + night * 0.4) continue;
      g.fillStyle = hexA(accent, 0.4 + night * 0.4);
      g.fillRect(bx - bw * 0.3 + R() * bw * 0.5, top - bh + 4 * u + R() * bh * 0.7, 1.6 * u, 2 * u);
    }
  }
  // The wall, crenellated, with its towers and the gate.
  const wh = 22 * u;
  g.fillStyle = col;
  g.fillRect(x - w / 2, top - wh, w, wh);
  for (let cx = x - w / 2; cx < x + w / 2; cx += 7 * u) g.fillRect(cx, top - wh - 4 * u, 4 * u, 4 * u);
  g.fillStyle = hexA(lit, 0.35);
  g.fillRect(x - w / 2, top - wh, w, 3 * u);
  for (let i = 0; i <= 6; i++) {
    const tx = x - w / 2 + (i / 6) * w;
    g.fillStyle = mix(col, '#000000', 0.1);
    g.fillRect(tx - 7 * u, top - wh - 16 * u, 14 * u, wh + 16 * u);
    g.fillStyle = hexA(lit, 0.5);
    g.fillRect(tx + (lx > 0 ? 2 : -7) * u, top - wh - 16 * u, 5 * u, wh + 16 * u);
    g.fillStyle = hexA('#100808', 0.7);
    g.fillRect(tx - 2 * u, top - wh - 10 * u, 4 * u, 5 * u);
  }
  g.fillStyle = hexA('#120a08', 0.85);
  g.beginPath();
  g.moveTo(x - 10 * u, top);
  g.lineTo(x - 10 * u, top - 12 * u);
  g.arc(x, top - 12 * u, 10 * u, Math.PI, 0);
  g.lineTo(x + 10 * u, top);
  g.fill();
}

// ---- the ground, per pixel ------------------------------------------------------------------------------
export type GroundBake = { canvas: HTMLCanvasElement; top: number; res: number };
export function bakeGround(world: SaberWorld, E: Env, seed: number): GroundBake {
  const { GW, GH, HY, NY, u } = world;
  const res = Math.min(0.75, Math.max(0.45, 900 / GW));
  const top = HY - 2;
  const w = Math.ceil(GW * res);
  const h = Math.ceil((GH - top) * res);
  const c = mk(w, h);
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  const L = E.L;
  const near = rgbOf(L.ground);
  const near2 = rgbOf(L.ground2);
  const farC = rgbOf(L.far);
  const haze = rgbOf(mix(L.haze, L.low, 0.35));
  const ink = rgbOf(L.ink);
  const sun = rgbOf(L.sun);
  const acc = rgbOf(L.accent);
  const sky = rgbOf(mix(L.low, L.mid, 0.5));
  const field = world.style;
  const S = 1 / u;
  const fOf = (d: number) => 0.3 + 0.7 * Math.pow(1 - clamp01(d), 2);
  const deckEnd = 0.8;
  // The ground in perspective, with its rises: each column marched from near to far (a voxel-space
  // painter), so a hill stands up against what lies behind it and hides it.
  const Hh = world.terrain.height;
  const lx = E.lx;
  for (let i = 0; i < w; i++) {
    let ymin = h;
    const sx = i / res;
    for (let j = h - 1; j >= 0; j--) {
      const y = top + j / res;
      const k = (y - HY) / (NY - HY);
      const d = k <= 0 ? 1 : 1 - Math.sqrt(k);
      const dd = clamp01(d);
      const detail = clamp01(1.2 - dd * 1.4);
      const Z = d * 1400;
      const hz = clamp01(Math.pow(dd, 1.5) * 0.82 * L.hazeK + world.fog * 0.2 * dd);
      const X = (GW / 2 + (sx - GW / 2) / fOf(d)) * S;
      const hh = d < 0.98 ? Hh(X * u, d) : 0;
      const yS = y - hh * (0.06 + 0.94 * Math.pow(1 - dd, 2));
      const jS = Math.max(0, Math.floor((yS - top) * res));
      if (jS >= ymin) continue;
      let r = 0;
      let gg = 0;
      let b = 0;
      let shade = 1;
      let mixK = 0;
      let wet = 0;
      let glint = 0;
      if (field === 'arena' || field === 'canyon') {
        const big = fbm(X / 700, Z / 420, seed, 3);
        const bigX = fbm((X + 12) / 700, Z / 420, seed, 3);
        shade = 0.86 + Math.max(-0.22, Math.min(0.22, (bigX - big) * 45 * -E.lx)) + (big - 0.5) * 0.25;
        const rip = Math.sin(X / 11 + Z / 34 + fbm(X / 90, Z / 90, seed + 3, 2) * 9);
        mixK = clamp01(0.45 + (fbm(X / 70, Z / 70, seed + 5, 4, detail) - 0.5) * 1.6);
        shade += rip * 0.05 * detail * (field === 'arena' ? 1 : 0.4);
        const rock = fbm(X / 40, Z / 40, seed + 9, 3, detail);
        if (rock > 0.72) {
          shade *= 0.86 - (rock - 0.72) * 1.2;
          mixK = 1;
        }
        const peb = vnoise(X / 5, Z / 5, seed + 15);
        if (detail > 0.3) shade *= peb > 0.92 ? 0.78 : peb > 0.86 ? 1.1 : 1;
        if (field === 'canyon') {
          const strata = Math.sin(Z / 28 + fbm(X / 200, Z / 50, seed + 11, 2) * 6);
          shade += strata * 0.05 * detail;
          if (vnoise(X / 14, Z / 14, seed + 13) > 0.86) shade *= 0.6;
        }
      } else if (field === 'crystal') {
        const tile = 64;
        const fx = X / tile;
        const fz = Z / (tile * 0.8);
        const ex = Math.min(fx - Math.floor(fx), Math.ceil(fx) - fx);
        const ez = Math.min(fz - Math.floor(fz), Math.ceil(fz) - fz);
        const tv = h2(Math.floor(fx), Math.floor(fz), seed);
        mixK = tv * 0.6 + fbm(X / 50, Z / 50, seed + 2, 3, detail) * 0.4;
        shade = 0.9 + (tv - 0.5) * 0.25;
        if (Math.min(ex, ez) < 0.04 * (1 + dd * 2)) shade *= 0.55;
        // Cracked and broken paving, and shards of crystal underfoot.
        const crack = fbm(X / 120, Z / 120, seed + 7, 4, detail);
        if (Math.abs(crack - 0.5) < 0.012) shade *= 0.5;
        if (fbm(X / 160, Z / 160, seed + 8, 3) > 0.64) {
          wet = 0.55;
          shade *= 0.8;
        }
        if (vnoise(X / 5, Z / 5, seed + 9) > 0.93) glint = 0.7 * detail;
      } else if (field === 'jungle') {
        const moss = fbm(X / 80, Z / 80, seed, 4, detail);
        mixK = clamp01((moss - 0.4) * 2.5);
        shade = 0.75 + moss * 0.4;
        const mud = fbm(X / 200, Z / 160, seed + 4, 3);
        if (mud > 0.6) {
          wet = clamp01((mud - 0.6) * 8) * 0.7;
          shade *= 0.7;
        }
        // Roots across the floor.
        const root = Math.abs(fbm(X / 150, Z / 90, seed + 6, 3) - 0.5);
        if (root < 0.02) shade *= 0.55;
        if (vnoise(X / 3, Z / 3, seed + 8) > 0.97) glint = 0.6 * detail;
      } else if (field === 'beach') {
        // Dry sand near, wet sand, the shallows of the lagoon, a line of foam where they meet.
        const shore = 0.5 + (fbm(X / 400, 0, seed + 2, 2) - 0.5) * 0.12;
        const ripple = Math.sin(X / 9 + Z / 40 + fbm(X / 80, Z / 80, seed + 3, 2) * 7);
        mixK = clamp01(0.4 + (fbm(X / 60, Z / 60, seed + 4, 3, detail) - 0.5) * 1.4);
        shade = 0.92 + ripple * 0.04 * detail;
        if (d > shore) {
          wet = d > shore + 0.03 ? 0.85 : 0.4;
          shade *= 0.75;
          if (Math.abs(d - shore - 0.03) < 0.006 + 0.004 * Math.sin(X / 30)) glint = 0.6;
        } else if (d > shore - 0.08) {
          wet = 0.3;
          shade *= 0.85;
        }
        if (vnoise(X / 12, Z / 12, seed + 9) > 0.9 && detail > 0.3) shade *= 0.7;
      } else if (field === 'hangar') {
        // The hangar deck: plates, rivets, painted guide lanes, oil.
        const px = X / 110;
        const pz = Z / 80;
        const ex = Math.min(px - Math.floor(px), Math.ceil(px) - px);
        const ez = Math.min(pz - Math.floor(pz), Math.ceil(pz) - pz);
        const tv = h2(Math.floor(px), Math.floor(pz), seed);
        mixK = tv * 0.6;
        shade = 0.84 + (tv - 0.5) * 0.16 + (fbm(X / 30, Z / 30, seed + 1, 3, detail) - 0.5) * 0.14;
        if (Math.min(ex, ez * 1.4) < 0.025 * (1 + dd * 3)) shade *= 0.6;
        if (ex < 0.06 && ez < 0.08 && detail > 0.4) shade *= 1.15;
        const lane = Math.abs((((X % 700) + 700) % 700) - 350);
        if (lane < 7 && detail > 0.1) r = 2;
        if (fbm(X / 120, Z / 90, seed + 5, 3) > 0.66) {
          wet = 0.35;
          shade *= 0.8;
        }
      } else if (field === 'platform') {
        if (d > deckEnd) {
          // The sea beyond the deck's edge.
          const wv = fbm(X / 60, Z / 12, seed + 3, 3);
          r = 0;
          mixK = 0;
          shade = 0.55 + wv * 0.35;
          wet = 0.9;
        } else {
          const px = X / 130;
          const pz = Z / 90;
          const ex = Math.min(px - Math.floor(px), Math.ceil(px) - px);
          const ez = Math.min(pz - Math.floor(pz), Math.ceil(pz) - pz);
          const tv = h2(Math.floor(px), Math.floor(pz), seed);
          mixK = tv * 0.7;
          shade = 0.86 + (tv - 0.5) * 0.18 + (fbm(X / 30, Z / 30, seed + 1, 3, detail) - 0.5) * 0.18;
          if (Math.min(ex, ez * 1.4) < 0.025 * (1 + dd * 3)) shade *= 0.6;
          // Rivets at the plate corners, painted landing circles, hazard stripes at the edge.
          if (ex < 0.06 && ez < 0.08 && detail > 0.4) shade *= 1.15;
          const ring = Math.abs(Math.hypot((X % 900) - 450, ((Z + 300) % 700) - 350) - 220);
          if (ring < 9 && detail > 0.2) {
            r = 1;
          }
          if (deckEnd - d < 0.025) r = Math.sin(X / 18) > 0 ? 2 : 3;
          const puddle = fbm(X / 140, Z / 110, seed + 5, 3);
          if (puddle > 0.58) wet = clamp01((puddle - 0.58) * 6) * 0.85;
          else wet = 0.18;
        }
      }
      // The slopes of the rises: lit toward the light, shaded away from it, brighter as they face us.
      if (hh > 0.3 * u) {
        const e = 8 * u;
        const hX = (Hh(X * u + e, d) - Hh(X * u - e, d)) / (2 * e);
        const hZ = (Hh(X * u, d + 0.006) - Hh(X * u, d - 0.006)) / (0.012 * 1400 * u);
        shade *= Math.max(0.55, Math.min(1.45, 1 - hX * lx * 2.4 + hZ * 1.4));
      }
      // The base colour, its second tone, and paint on the deck.
      let base: [number, number, number];
      if (field === 'platform' && r === 1) base = [196, 180, 120];
      else if ((field === 'platform' || field === 'hangar') && r === 2) base = [200, 160, 40];
      else if (field === 'platform' && r === 3) base = [30, 30, 30];
      else if (field === 'platform' && d > deckEnd) base = [Math.round(sky[0] * 0.5 + ink[0] * 0.5), Math.round(sky[1] * 0.5 + ink[1] * 0.5), Math.round(sky[2] * 0.55 + ink[2] * 0.45)];
      else base = [near[0] + (near2[0] - near[0]) * mixK, near[1] + (near2[1] - near[1]) * mixK, near[2] + (near2[2] - near[2]) * mixK];
      // Far ground takes the far colour.
      const fk = clamp01(dd * 1.3);
      r = base[0] + (farC[0] - base[0]) * fk;
      gg = base[1] + (farC[1] - base[1]) * fk;
      b = base[2] + (farC[2] - base[2]) * fk;
      r *= shade;
      gg *= shade;
      b *= shade;
      // Wet ground holds the sky.
      if (wet > 0) {
        const sh = 0.5 + 0.5 * vnoise(X / 8, Z / 3, seed + 21);
        r += (sky[0] * (0.7 + sh * 0.5) - r) * wet * 0.6;
        gg += (sky[1] * (0.7 + sh * 0.5) - gg) * wet * 0.6;
        b += (sky[2] * (0.7 + sh * 0.5) - b) * wet * 0.6;
      }
      if (glint > 0) {
        r += (acc[0] - r) * glint;
        gg += (acc[1] - gg) * glint;
        b += (acc[2] - b) * glint;
      }
      // The light along the ground toward the sun, low; the haze; the shadow under the ridge.
      const sunK = L.rim * 0.12 * (1 - L.night) * (1 - dd * 0.5);
      r += (sun[0] - r) * sunK;
      gg += (sun[1] - gg) * sunK;
      b += (sun[2] - b) * sunK;
      r += (haze[0] - r) * hz;
      gg += (haze[1] - gg) * hz;
      b += (haze[2] - b) * hz;
      if (d < 0.08) {
        const sk = clamp01((0.08 - d) / 0.2) * 0.4;
        r += (ink[0] - r) * sk;
        gg += (ink[1] - gg) * sk;
        b += (ink[2] - b) * sk;
      }
      for (let jj = jS; jj < ymin; jj++) {
        const o = (jj * w + i) * 4;
        img.data[o] = r;
        img.data[o + 1] = gg;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
      ymin = jS;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, top, res };
}

// ---- the ridge we watch from ------------------------------------------------------------------------------
/** The top of the ridge at x: a ragged lip, rising into a shoulder of rock on one side. */
export function ridgeTop(world: SaberWorld, x: number, side: number, seed: number) {
  const { GW, NY, u } = world;
  const e = side > 0 ? x / GW : 1 - x / GW;
  const shoulder = Math.pow(clamp01((e - 0.74) / 0.2), 1.3) * 120 * u;
  // Aboard ship it is a catwalk: straight, stepping up to a gantry at the corner.
  if (world.style === 'hangar') return NY + 14 * u - (e > 0.8 ? 70 * u : 0);
  return NY + 14 * u - shoulder - (fbm(x / (60 * u), 1, seed, 4) - 0.5) * 22 * u - (vnoise(x / (9 * u), 2, seed + 1) - 0.5) * 5 * u;
}
export function bakeRidge(world: SaberWorld, E: Env, side: number, seed: number): HTMLCanvasElement {
  const { GW, GH, u } = world;
  const c = mk(GW, GH);
  const g = c.getContext('2d')!;
  const L = E.L;
  const rock = mix(mix(L.ground, L.ink, 0.62), '#1a1614', 0.3);
  const litC = mix(mix(L.ground2, L.sun, 0.3), L.ink, 0.25 + L.night * 0.4);
  const path = new Path2D();
  path.moveTo(-10, GH + 10);
  for (let x = -10; x <= GW + 10; x += 4) path.lineTo(x, ridgeTop(world, x, side, seed));
  path.lineTo(GW + 10, GH + 10);
  path.closePath();
  g.fillStyle = rock;
  g.fill(path);
  g.save();
  g.clip(path);
  // Texture: the rock's grain, ledges and cracks; light on the faces toward it.
  const top = Math.min(...Array.from({ length: 40 }, (_, i) => ridgeTop(world, (i / 39) * GW, side, seed)));
  for (let y = top; y < GH; y += 3) {
    for (let x = 0; x < GW; x += 3) {
      const n = fbm(x / (26 * u), y / (12 * u), seed + 3, 3);
      if (n > 0.58) {
        g.fillStyle = hexA(litC, (n - 0.58) * 0.9);
        g.fillRect(x, y, 3, 3);
      } else if (n < 0.36) {
        g.fillStyle = hexA('#000000', (0.36 - n) * 1.4);
        g.fillRect(x, y, 3, 3);
      }
    }
  }
  const fade = g.createLinearGradient(0, top, 0, GH);
  fade.addColorStop(0, hexA(litC, 0.15));
  fade.addColorStop(1, hexA('#000000', 0.45));
  g.fillStyle = fade;
  g.fillRect(0, top, GW, GH - top);
  g.restore();
  g.strokeStyle = hexA(mix(litC, L.sun, 0.4), 0.35 + L.rim * 0.4 * (1 - L.night * 0.5));
  g.lineWidth = Math.max(1, 1.6 * u);
  g.beginPath();
  for (let x = -10; x <= GW + 10; x += 4) {
    const y = ridgeTop(world, x, side, seed);
    if (x === -10) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  if (world.style === 'hangar') {
    // Deck plating on the catwalk's face and a railing along its edge.
    g.save();
    g.clip(path);
    g.fillStyle = mix('#2a2e36', L.ink, 0.3);
    g.fillRect(0, 0, GW, GH);
    g.strokeStyle = hexA('#000000', 0.5);
    for (let x = 0; x < GW; x += 60 * u) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, GH);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = mix('#5a606c', L.sun, 0.1);
    g.lineWidth = 2 * u;
    for (let x = 0; x <= GW; x += 34 * u) {
      const y = ridgeTop(world, x, side, seed);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - 26 * u);
      g.stroke();
    }
    g.beginPath();
    for (let x = 0; x <= GW; x += 4) {
      const y = ridgeTop(world, x, side, seed) - 26 * u;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    return c;
  }
  // Sandbags along the lip, a broken droid's head, a helmet and a cracked barricade.
  const bagC = mix(mix('#8a7a5a', L.ink, 0.3 + L.night * 0.45), L.haze, 0.05);
  const bx0 = GW * (side > 0 ? 0.06 : 0.62);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 12 - row * 2; i++) {
      const x = bx0 + (i + row * 0.5) * 22 * u;
      const y = ridgeTop(world, x, side, seed) + 4 * u - row * 9 * u;
      g.fillStyle = bagC;
      g.beginPath();
      g.ellipse(x, y, 12 * u, 6 * u, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hexA(mix(bagC, L.sun, 0.35), 0.5);
      g.beginPath();
      g.ellipse(x + E.lx * 2 * u, y - 2.5 * u, 8 * u, 2.4 * u, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = hexA('#000000', 0.35);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - 9 * u, y);
      g.lineTo(x + 9 * u, y);
      g.stroke();
    }
  return c;
}

// ---- the hangar's walls -----------------------------------------------------------------------------------
/** Inside a ship: the bay's side walls running back to its mouth in perspective, panelled, lit, with a control gallery. */
export function bakeHangarWalls(world: SaberWorld, E: Env): HTMLCanvasElement {
  const { GW, GH, HY, u } = world;
  const c = mk(GW, GH);
  const g = c.getContext('2d')!;
  const L = E.L;
  const mx0 = GW * 0.14;
  const mx1 = GW * 0.86;
  const my0 = HY * 0.22;
  const metal = mix('#2e323a', L.ink, 0.25);
  for (const side of [-1, 1]) {
    const mx = side < 0 ? mx0 : mx1;
    const ex = side < 0 ? -GW * 0.12 : GW * 1.12;
    const sx = side < 0 ? 0 : GW;
    const wall = new Path2D();
    wall.moveTo(sx, 0);
    wall.lineTo(mx, my0);
    wall.lineTo(mx, HY);
    wall.lineTo(ex, GH);
    wall.lineTo(sx, GH);
    wall.closePath();
    const wg = g.createLinearGradient(sx, 0, mx, 0);
    wg.addColorStop(0, mix(metal, '#000000', 0.35));
    wg.addColorStop(1, mix(metal, L.sun, 0.06));
    g.fillStyle = wg;
    g.fill(wall);
    g.save();
    g.clip(wall);
    // Ribs running back to the mouth, and the lines of the panels converging on it.
    g.strokeStyle = hexA('#000000', 0.5);
    g.lineWidth = 1.2;
    for (let i = 1; i < 10; i++) {
      const q = i / 10;
      g.beginPath();
      g.moveTo(sx, GH * q);
      g.lineTo(mx, my0 + (HY - my0) * q);
      g.stroke();
    }
    for (let i = 1; i < 14; i++) {
      const q = Math.pow(i / 14, 1.6);
      const x = mx + (sx - mx) * q;
      g.strokeStyle = hexA(i % 3 === 0 ? '#5a606c' : '#000000', 0.5);
      g.lineWidth = i % 3 === 0 ? 3 * u * (0.3 + q) : 1;
      g.beginPath();
      g.moveTo(x, my0 * (1 - q));
      g.lineTo(x, HY + (GH - HY) * q);
      g.stroke();
    }
    // The control gallery's lit windows high on the wall; warning lights low.
    g.globalCompositeOperation = 'lighter';
    for (let i = 2; i < 12; i++) {
      const q = Math.pow(i / 14, 1.6);
      const x = mx + (sx - mx) * q;
      const y = my0 * (1 - q) + (HY - my0) * 0.35 + q * GH * 0.12;
      g.fillStyle = hexA('#9ad0ff', 0.35);
      g.fillRect(x - 6 * u * (0.3 + q), y, 12 * u * (0.3 + q), 5 * u * (0.3 + q));
      g.fillStyle = hexA(L.accent, 0.55);
      g.fillRect(x - 2 * u, HY + (GH - HY) * q * 0.9 - 6 * u, 4 * u * (0.3 + q), 3 * u);
    }
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }
  return c;
}
