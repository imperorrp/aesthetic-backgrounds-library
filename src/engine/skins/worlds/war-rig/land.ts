/**
 * The waste, painted: the sky (the sun or a big moon, stars, dust), the far planes in true
 * perspective (mesas on the horizon, buttes and rock towers, the canyon wall, the dunes), the
 * ground itself as a plane running away under the convoy, and the things standing on it (rocks,
 * bones, dead trees, husks of old cars, telegraph poles, salt mounds, reeds and the stilt folk in
 * the bog).
 *
 * The ground is one textured plane: per region a grey texture (cracked salt, rippled sand,
 * gravel, rock, mud with pools) is baked per pixel the first time it is needed, in the ground's
 * own units, and each row of the screen draws it overlaid on the hour's colour, scaled by that
 * row's depth and slid by the distance run. Everything uses the sim's perspective: a thing at
 * depth z sits at `yOf(z)`, is `mOf(z)` big, and slides back at `V · mOf(z)`.
 *
 * The planes take their region from the road as it was when they came in at the right edge, so
 * a canyon wall arrives from ahead and passes behind.
 */
import { clamp01, hash, hexA, mix, mk, posmod, goldenOf, heatOf, type Env } from './env';
import { figure, mats } from './vehicles';
import type { Region, WarWorld } from './types';

/** Smooth value noise, periodic in x with period `px` (in lattice steps); 0..1. */
function pnoise(x: number, y: number, s: number, px = 1 << 20): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const X0 = posmod(xi, px);
  const X1 = posmod(xi + 1, px);
  const a = hash(X0, yi, s);
  const b = hash(X1, yi, s);
  const c = hash(X0, yi + 1, s);
  const d = hash(X1, yi + 1, s);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (k: number) => k * k * (3 - 2 * k);

const GROUND: Record<Region, string> = { flats: '#f0d2aa', dunes: '#ec8c40', towers: '#d47c42', canyon: '#b2643a', bog: '#3e4030' };
const DUST: Record<Region, string> = { flats: '#f0dcc0', dunes: '#f0a868', towers: '#e0a070', canyon: '#c88a60', bog: '#3a3828' };
export const dustOf = (r: Region) => DUST[r];

export function createLand(E: Env, world: WarWorld, seed: number) {
  const { GW, GH, HY, A, DB, u } = world;
  const c = E.ctx;
  const cx = GW / 2;
  const P = 1024;
  /** Rows of the ground: depth scale at a screen y. */
  const mAtY = (y: number) => Math.max(0.001, (y - HY) / (A + DB));
  /** Depth z of a plane of scale m. */
  const zOfM = (m: number) => (m * (A + DB) - A) / DB;
  /** Screen x of ground coordinate G at depth scale m. */
  const sx = (G: number, m: number) => cx + (G - world.dist) * m;

  // ---- regions: which road, and how much of it, at a distance -----------------------------------
  const RAMP = 2600 * u;
  /** Weights of the regions at a distance run (the legs blend over a short ramp). */
  function regionMix(d: number): [Region, number][] {
    const legs = world.legs;
    let i = legs.length - 1;
    while (i > 0 && legs[i].at > d) i--;
    const cur = legs[i];
    const k = i > 0 ? clamp01((d - cur.at) / RAMP) : 1;
    if (k >= 1 || i === 0) return [[cur.kind, 1]];
    return [[legs[i - 1].kind, 1 - smooth(k)], [cur.kind, smooth(k)]];
  }
  /** The road under a plane's feature, as it was when the feature came in at the right edge. */
  const entryMix = (G: number, m: number) => regionMix(G - (GW + 60 * u - cx) / m);

  // ---- the sky ---------------------------------------------------------------------------------
  const lr = (k: number) => hash(seed, k, 911);
  const stars = Array.from({ length: 240 }, (_, i) => [lr(i * 3), lr(i * 3 + 1), lr(i * 3 + 2)] as [number, number, number]);
  const sunSide = lr(999) < 0.5 ? 1 : -1;
  /** Where the key light is: the sun by day, the moon by night (world x, y), and which it is. */
  function keyLight(): [number, number, number] {
    const sk = (world.day - 0.25) / 0.5;
    if (sk > -0.03 && sk < 1.03) {
      const k = clamp01(sk);
      const x = GW * (sunSide > 0 ? 0.12 + 0.76 * k : 0.88 - 0.76 * k);
      const y = HY + 14 * u - Math.sin(k * Math.PI) * HY * 0.82;
      return [x, y, 1];
    }
    const mk2 = clamp01((((world.day + 0.5) % 1) - 0.25) / 0.5);
    const x = GW * (sunSide > 0 ? 0.2 + 0.6 * mk2 : 0.8 - 0.6 * mk2);
    const y = HY + 30 * u - Math.sin(mk2 * Math.PI) * HY * 0.7;
    return [x, y, 0];
  }
  function sky() {
    const L = E.L;
    const sg = c.createLinearGradient(0, 0, 0, HY);
    sg.addColorStop(0, L.top);
    sg.addColorStop(0.55, L.mid);
    sg.addColorStop(1, L.low);
    c.fillStyle = sg;
    c.fillRect(-20, -20, GW + 40, HY + 40);
    const veil = 1 - E.storm * 0.9;
    if (E.night > 0.05) {
      for (const [x0, y0, k] of stars) {
        const tw = 0.6 + 0.4 * Math.sin(E.t * (0.7 + k * 2) + k * 50);
        c.fillStyle = `rgba(235,240,255,${(E.night * (0.15 + k * 0.75) * tw * veil * (1 - y0 * 0.6)).toFixed(3)})`;
        const sz = (k > 0.93 ? 2 : 1.1) * Math.max(0.7, u);
        c.fillRect(x0 * GW, y0 * HY * 0.95, sz, sz);
      }
    }
    const [kx, ky, isSun] = keyLight();
    const gold = goldenOf(world.day);
    if (isSun) {
      // A huge, hot sun; red and enormous on the horizon.
      const r = (40 + gold * 34) * u;
      E.glow(kx, ky, (380 + gold * 260) * u, L.sun, 0.5 * veil);
      E.glow(kx, ky, r * 3.2, mix('#fff4e0', L.sun, 0.4), 0.6 * veil);
      c.fillStyle = hexA(mix('#fffaf0', L.sun, 0.25 + gold * 0.6), 0.97 * veil);
      c.beginPath();
      c.arc(kx, ky, r, 0, Math.PI * 2);
      c.fill();
    } else {
      // A big moon with its seas.
      const r = 64 * u;
      const mv = clamp01(E.night * 1.2) * veil;
      E.glow(kx, ky, r * 5, mix('#9cc4f0', L.sun, 0.3), 0.32 * mv);
      E.glow(kx, ky, r * 1.9, '#d8e8ff', 0.35 * mv);
      c.fillStyle = hexA(mix('#e8f0ff', L.sun, 0.25), 0.96 * mv);
      c.beginPath();
      c.arc(kx, ky, r, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.beginPath();
      c.arc(kx, ky, r, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = hexA('#7a8aa8', 0.32 * mv);
      for (let q = 0; q < 9; q++) {
        c.beginPath();
        c.ellipse(kx + (lr(q + 40) - 0.5) * r * 1.3, ky + (lr(q + 60) - 0.5) * r * 1.3, r * (0.1 + lr(q + 80) * 0.28), r * (0.08 + lr(q + 90) * 0.2), lr(q) * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = hexA('#203050', 0.25 * mv);
      c.beginPath();
      c.arc(kx + r * 0.35, ky - r * 0.1, r * 1.02, 0, Math.PI * 2);
      c.arc(kx + r * 2, ky, r * 1.4, 0, Math.PI * 2, true);
      c.fill();
      c.restore();
    }
    // Long streaks of dust in the air, lit by the low light.
    const streak = E.soft(mix(L.low, L.sun, 0.25));
    for (let k = 0; k < 7; k++) {
      const y = HY * (0.25 + lr(k + 200) * 0.6);
      const w = GW * (0.4 + lr(k + 210) * 0.6);
      const x = posmod(lr(k + 220) * GW * 1.6 - E.t * (2 + k) * u - world.dist * 0.004, GW * 1.6) - GW * 0.3;
      c.globalAlpha = (0.08 + gold * 0.1) * (1 - E.night * 0.6) * veil;
      c.drawImage(streak, x, y - 10 * u, w, 20 * u + lr(k + 230) * 20 * u);
    }
    c.globalAlpha = 1;
    // The glare along the horizon under the light.
    const hg = c.createLinearGradient(0, HY - 90 * u, 0, HY);
    hg.addColorStop(0, hexA(L.low, 0));
    hg.addColorStop(1, hexA(mix(L.low, L.sun, 0.4), 0.5 * veil));
    c.fillStyle = hg;
    c.fillRect(-20, HY - 90 * u, GW + 40, 90 * u);
  }

  // ---- the far planes ----------------------------------------------------------------------------
  /** The horizon: a line of mesas and ranges, very far (and its mirage in the heat). */
  const H0 = { m: 0.04 };
  const horizonH = (G: number, reg: Region) => {
    const n = pnoise(G / (900 * u), 1, seed + 11);
    const plateau = clamp01((pnoise(G / (2200 * u), 3, seed + 12) - 0.45) * 4);
    const crag = pnoise(G / (260 * u), 5, seed + 13) * 0.3;
    if (reg === 'dunes') return (0.3 + n * 0.5) * 900 * u;
    if (reg === 'bog') return (0.1 + n * 0.25) * 600 * u;
    const tall = reg === 'towers' || reg === 'canyon' ? 1.6 : 1;
    return (plateau * (0.75 + crag) * 2600 + n * 700) * u * tall;
  };
  function horizon(heat: number) {
    const m = H0.m;
    const base = HY + 1;
    const col = E.tone(mix(E.L.haze, '#7a5a4a', 0.25), 0.94);
    const pts: [number, number][] = [];
    for (let x = -20; x <= GW + 20; x += 5) {
      const G = world.dist + (x - cx) / m;
      let h = 0;
      for (const [rg, w] of entryMix(G, m)) h += horizonH(G, rg) * w;
      pts.push([x, base - h * m]);
    }
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(-20, base + 2);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(GW + 20, base + 2);
    c.fill();
    // The mirage: the far land lying upside down in the heat, wavering.
    if (heat > 0.05) {
      c.fillStyle = hexA(mix(col, E.L.low, 0.4), 0.4 * heat);
      c.beginPath();
      c.moveTo(-20, base);
      for (const [x, y] of pts) c.lineTo(x + Math.sin(E.t * 3 + x * 0.05) * 2 * u, base + (base - y) * 0.45 + Math.sin(E.t * 5 + x * 0.11) * 1.2 * u);
      c.lineTo(GW + 20, base);
      c.fill();
    }
  }
  /** Buttes and rock towers at the far plane, lit on the light's side, banded with strata. */
  const FAR = { m: 0.1, spacing: 1500 };
  function farPlane() {
    const m = FAR.m;
    const z = zOfM(m);
    const d = 0.82;
    const base = world.yOf(z);
    const sp = FAR.spacing * u;
    const g0 = world.dist + (-200 * u - cx) / m;
    const g1 = world.dist + (GW + 200 * u - cx) / m;
    const [kx] = keyLight();
    const rock = E.tone('#8a5a3c', d, 0.05);
    const lit = E.tone('#d08a54', d, 0.7);
    const dark = E.tone('#3a2a2a', d, 0);
    for (let i = Math.floor(g0 / sp); i <= Math.ceil(g1 / sp); i++) {
      if (hash(i, 7, seed) < 0.18) continue;
      const G = i * sp + hash(i, 1, seed) * sp * 0.8;
      const mixes = entryMix(G, m);
      const reg = mixes[mixes.length - 1][0];
      const w0 = mixes[mixes.length - 1][1];
      let kind: 'butte' | 'needle' | 'mesa' | 'none' = 'none';
      const roll = hash(i, 2, seed);
      if (reg === 'towers') kind = roll < 0.55 ? 'needle' : 'butte';
      else if (reg === 'canyon') kind = 'mesa';
      else if (reg === 'flats') kind = roll < 0.3 ? 'butte' : roll < 0.45 ? 'needle' : 'none';
      else if (reg === 'dunes') kind = roll < 0.2 ? 'butte' : 'none';
      if (kind === 'none') continue;
      const x = sx(G, m);
      const hu = (kind === 'needle' ? 1800 + hash(i, 3, seed) * 2200 : kind === 'mesa' ? 2400 + hash(i, 3, seed) * 1200 : 1100 + hash(i, 3, seed) * 1400) * u * clamp01(w0 * 1.5);
      const wu = (kind === 'needle' ? 260 + hash(i, 4, seed) * 260 : kind === 'mesa' ? 2600 + hash(i, 4, seed) * 1600 : 900 + hash(i, 4, seed) * 1300) * u;
      const h = hu * m;
      const w = wu * m;
      if (x + w < -20 || x - w > GW + 20 || h < 2) continue;
      // The profile: talus skirts, steep sides, a flat cap (or a needle's broken top).
      const path = new Path2D();
      const n = 20;
      path.moveTo(x - w * 0.75, base + 2);
      for (let k = 0; k <= n; k++) {
        const q = k / n;
        const e = Math.min(q, 1 - q) * 2;
        const prof = kind === 'needle' ? Math.pow(clamp01(e * 1.6), 0.5) * (0.9 + hash(i, k, 5) * 0.1) : clamp01(e * 3.2) * (0.94 + hash(i, k, 5) * 0.06);
        const skirt = 0.18 * clamp01(1 - e * 3);
        path.lineTo(x - w * 0.5 + q * w, base - h * Math.max(prof, skirt));
      }
      path.lineTo(x + w * 0.75, base + 2);
      path.closePath();
      c.fillStyle = rock;
      c.fill(path);
      c.save();
      c.clip(path);
      const lx = kx > x ? 1 : -1;
      const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(lx > 0 ? 1 : 0, hexA(lit, 0.75 * (0.3 + E.L.rim * 0.7)));
      g.addColorStop(0.55, hexA(rock, 0));
      g.addColorStop(lx > 0 ? 0 : 1, hexA(dark, 0.55));
      c.fillStyle = g;
      c.fillRect(x - w, base - h - 4, w * 2, h + 8);
      c.strokeStyle = hexA(dark, 0.3);
      c.lineWidth = Math.max(0.6, 1.2 * u);
      for (let k = 1; k < 7; k++) {
        const yy = base - h * (k / 7);
        c.beginPath();
        c.moveTo(x - w, yy);
        c.lineTo(x + w, yy + (hash(i, k, 6) - 0.5) * 4 * u);
        c.stroke();
      }
      c.restore();
      // Haze at their feet.
      const hz = c.createLinearGradient(0, base - h * 0.5, 0, base);
      hz.addColorStop(0, hexA(E.L.haze, 0));
      hz.addColorStop(1, hexA(E.L.haze, 0.55));
      c.fillStyle = hz;
      c.fillRect(x - w * 0.8, base - h * 0.5, w * 1.6, h * 0.5 + 2);
    }
  }
  /** The canyon wall (only in the canyon): the far side of the pass, its rim at the height the bikers ride. */
  const ZW = -0.42;
  const rimH = 1400 * u;
  function canyonWall() {
    const m = world.mOf(ZW);
    const base = world.yOf(ZW);
    const d = 0.55;
    const pts: [number, number, number][] = [];
    let any = false;
    for (let x = -20; x <= GW + 24; x += 6) {
      const G = world.dist + (x - cx) / m;
      let w = 0;
      for (const [rg, k] of entryMix(G, m)) if (rg === 'canyon') w += k;
      const notch = pnoise(G / (300 * u), 2, seed + 21);
      const h = w <= 0 ? 0 : rimH * smooth(clamp01(w * 1.4)) * (notch < 0.18 ? 0.86 : 1) + (pnoise(G / (60 * u), 4, seed + 22) - 0.5) * 30 * u;
      if (h > 0) any = true;
      pts.push([x, base - Math.max(0, h) * m, G]);
    }
    if (!any) return;
    const path = new Path2D();
    path.moveTo(-20, base + 4);
    for (const [x, y] of pts) path.lineTo(x, y);
    path.lineTo(GW + 24, base + 4);
    path.closePath();
    const rock = E.tone('#9a5634', d, 0.05);
    const shade = E.tone('#3a2626', d, 0);
    const lit = E.tone('#e09060', d, 0.8);
    c.fillStyle = c.createLinearGradient(0, base - rimH * m, 0, base);
    (c.fillStyle as CanvasGradient).addColorStop(0, mix(rock, lit, 0.2));
    (c.fillStyle as CanvasGradient).addColorStop(0.5, rock);
    (c.fillStyle as CanvasGradient).addColorStop(1, mix(rock, shade, 0.55));
    c.fill(path);
    c.save();
    c.clip(path);
    // Strata, bands of harder rock that catch the light; vertical joints; the shadows of buttresses.
    for (let k = 0; k < 9; k++) {
      const yy = base - rimH * m * (0.08 + k * 0.105);
      c.fillStyle = hexA(k % 2 ? shade : lit, k % 2 ? 0.16 : 0.12 * (0.4 + E.L.rim));
      c.fillRect(-20, yy, GW + 40, rimH * m * 0.03 * (1 + (k % 3)));
    }
    const sp = 140 * u;
    const g0 = world.dist + (-20 - cx) / m;
    for (let i = Math.floor(g0 / sp); i < Math.floor(g0 / sp) + Math.ceil((GW + 40) / (sp * m)) + 2; i++) {
      const x = sx(i * sp + hash(i, 1, seed) * sp * 0.5, m);
      const ww = (20 + hash(i, 2, seed) * 60) * u * m * 4;
      c.fillStyle = hexA(shade, 0.25 + hash(i, 3, seed) * 0.2);
      c.beginPath();
      c.moveTo(x, base - rimH * m * 1.05);
      c.lineTo(x + ww * 0.4, base - rimH * m * 0.6);
      c.lineTo(x + ww, base + 4);
      c.lineTo(x + ww * 0.2, base + 4);
      c.fill();
      c.strokeStyle = hexA(shade, 0.4);
      c.lineWidth = Math.max(0.6, 1.4 * u * m * 3);
      c.beginPath();
      c.moveTo(x - ww * 0.3, base - rimH * m);
      c.lineTo(x - ww * 0.25 + (hash(i, 4, seed) - 0.5) * 10 * u, base);
      c.stroke();
    }
    c.restore();
    // The rim, catching the light.
    c.strokeStyle = hexA(mix(lit, E.L.sun, 0.4), 0.35 + 0.5 * E.L.rim);
    c.lineWidth = Math.max(1, 2 * u);
    c.beginPath();
    pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    // Talus at its foot.
    const tg = c.createLinearGradient(0, base - 40 * u, 0, base + 6 * u);
    tg.addColorStop(0, hexA(E.tone('#a86a44', 0.5, 0.2), 0));
    tg.addColorStop(1, hexA(E.tone('#a86a44', 0.5, 0.2), 0.9));
    c.fillStyle = tg;
    c.fillRect(-20, base - 40 * u, GW + 40, 46 * u);
  }
  /** The dunes and swells between the road and the far plane. */
  const DZ = -0.28;
  function dunePlane() {
    const m = world.mOf(DZ);
    const base = world.yOf(DZ);
    const d = 0.5;
    const pts: [number, number][] = [];
    for (let x = -20; x <= GW + 24; x += 4) {
      const G = world.dist + (x - cx) / m;
      let amp = 0;
      for (const [rg, w] of entryMix(G, m)) amp += w * (rg === 'dunes' ? 520 : rg === 'flats' ? 50 : rg === 'bog' ? 30 : rg === 'canyon' ? 120 : 160);
      const n1 = pnoise(G / (700 * u), 9, seed + 31);
      const n2 = pnoise(G / (190 * u), 10, seed + 32);
      // A dune's shape: long windward back, sharp crest, steep slip face.
      const ph = posmod(G / (900 * u) + n1 * 0.6, 1);
      const prof = ph < 0.78 ? ph / 0.78 : Math.pow(1 - (ph - 0.78) / 0.22, 1.4);
      const h = amp * u * (0.35 * n1 + 0.55 * prof * n1 + 0.1 * n2);
      pts.push([x, base - h * m]);
    }
    const reg = world.region;
    const col = E.tone(GROUND[reg === 'bog' ? 'bog' : reg === 'canyon' ? 'canyon' : 'dunes'], d, 0.25);
    const g = c.createLinearGradient(0, base - 520 * u * m, 0, base + 10 * u);
    g.addColorStop(0, E.tone(GROUND.dunes, d, 0.7));
    g.addColorStop(0.5, col);
    g.addColorStop(1, mix(col, E.L.haze, 0.3));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-20, base + 10 * u);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(GW + 24, base + 10 * u);
    c.fill();
    // Slip faces in the teal shade, crests lit.
    const shade = E.tone(mix(GROUND.dunes, '#204858', 0.55), d, 0);
    c.fillStyle = hexA(shade, 0.45);
    c.beginPath();
    let open = false;
    for (let k = 1; k < pts.length; k++) {
      const [x, y] = pts[k];
      const falling = y - pts[k - 1][1] > 0.25 * u;
      if (falling && !open) {
        c.moveTo(pts[k - 1][0], pts[k - 1][1]);
        open = true;
      }
      if (open) c.lineTo(x, y);
      if (!falling && open) {
        c.lineTo(x, Math.min(base + 6 * u, y + 30 * u * m * 4));
        c.lineTo(pts[k - 1][0] - 10 * u, Math.min(base + 6 * u, y + 34 * u * m * 4));
        c.closePath();
        open = false;
      }
    }
    c.fill();
    c.strokeStyle = hexA(E.tone(E.L.sun, 0.3, 1), 0.25 + 0.4 * E.L.rim);
    c.lineWidth = Math.max(0.6, 1.2 * u);
    c.beginPath();
    pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    const hz = c.createLinearGradient(0, base - 20 * u, 0, base + 12 * u);
    hz.addColorStop(0, hexA(E.L.haze, 0));
    hz.addColorStop(1, hexA(E.L.haze, 0.35));
    c.fillStyle = hz;
    c.fillRect(-20, base - 20 * u, GW + 44, 32 * u);
  }

  // ---- the ground: a textured plane in perspective --------------------------------------------
  const TH = Math.ceil(GH - HY) + 2;
  const tex = new Map<Region, { canvas: HTMLCanvasElement; pat: CanvasPattern | null }>();
  const K = 340 * u;
  const lanes = [0.06, 0.3, 0.46, 0.54, 0.72, 0.94];
  function bake(reg: Region) {
    const cv = mk(P, TH);
    const g = cv.getContext('2d')!;
    const img = g.createImageData(P, TH);
    const sd = seed + reg.length * 97;
    const cell = 64;
    const nCells = P / cell;
    for (let row = 0; row < TH; row++) {
      const m = Math.max(0.004, row / (A + DB));
      const Z = K / m;
      const fade = clamp01((m - 0.06) / 0.35);
      // Tyre tracks along the lanes: compacted sand, darker, with lighter berms.
      const zr = (row - A) / DB;
      let track = 0;
      for (const lz of lanes) {
        const dz = Math.abs(zr - lz) * DB * (1 / Math.max(0.2, m));
        if (dz < 5) track = Math.max(track, 1 - dz / 5);
        else if (dz < 9) track = Math.min(track, -0.4 * (1 - (dz - 5) / 4));
      }
      for (let col = 0; col < P; col++) {
        const X = col;
        let v = 128;
        const grain = (hash(col, row, sd) - 0.5) * 14;
        if (reg === 'flats') {
          // Cracked salt: polygons, dark cracks with raised lips.
          const fx = X / cell;
          const fz = Z / (cell * 0.8);
          const ix = Math.floor(fx);
          const iz = Math.floor(fz);
          let f1 = 9;
          let f2 = 9;
          let id = 0;
          for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++) {
              const cxi = posmod(ix + a, nCells);
              const px = ix + a + hash(cxi, iz + b, sd);
              const pz = iz + b + hash(cxi, iz + b, sd + 1);
              const dd = Math.hypot(fx - px, (fz - pz) * 1.1);
              if (dd < f1) {
                f2 = f1;
                f1 = dd;
                id = hash(cxi, iz + b, sd + 2);
              } else if (dd < f2) f2 = dd;
            }
          const edge = (f2 - f1) * cell;
          v = 146 + (id - 0.5) * 26 + pnoise(X / 40, Z / 40, sd + 3, P / 40) * 14;
          if (edge < 2.2 / Math.max(0.5, m * 1.4)) v -= 74;
          else if (edge < 6) v += 14 * (1 - edge / 6);
          v += grain;
        } else if (reg === 'dunes') {
          const warp = pnoise(X / 90, Z / 120, sd + 4, Math.round(P / 90)) * 40;
          v = 128 + Math.sin((X * 0.55 + Z * 0.9 + warp) / 6) * 16 + (pnoise(X / 256, Z / 300, sd + 5, P / 256) - 0.5) * 40 + grain;
        } else if (reg === 'towers' || reg === 'canyon') {
          const big = reg === 'canyon' ? 1.6 : 1;
          v = 124 + (pnoise(X / 128, Z / 128, sd + 6, P / 128) - 0.5) * 50 * big + grain * 1.3;
          const sx0 = Math.floor(X / (10 * big));
          const sz0 = Math.floor(Z / (10 * big));
          const hs = hash(posmod(sx0, Math.round(P / (10 * big))), sz0, sd + 7);
          if (hs < 0.07 * big) {
            const fy = (Z / (10 * big)) % 1;
            v = fy < 0.45 ? 186 : 64;
          }
          const crack = Math.abs(pnoise(X / 70, Z / 70, sd + 8, Math.round(P / 70)) - 0.5);
          if (crack < 0.012) v -= 50;
        } else {
          // Bog: black mud, standing pools that hold the sky, reeds.
          const n = pnoise(X / 110, Z / 90, sd + 9, Math.round(P / 110));
          v = 104 + (pnoise(X / 30, Z / 30, sd + 10, Math.round(P / 30)) - 0.5) * 30 + grain;
          if (n > 0.64) v = 150 + (n - 0.64) * 120 + Math.sin(X * 0.08 + Z * 0.02) * 6;
          else if (n > 0.6) v = 76;
          if (hash(Math.floor(X / 3), Math.floor(Z / 14), sd + 11) < 0.025) v = 50;
        }
        if (reg !== 'bog') v += track * -26;
        v = 128 + (v - 128) * fade;
        const o = (row * P + col) * 4;
        const q = Math.max(0, Math.min(255, v));
        img.data[o] = img.data[o + 1] = img.data[o + 2] = q;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return { canvas: cv, pat: c.createPattern(cv, 'repeat') };
  }
  const texOf = (reg: Region) => {
    let t = tex.get(reg);
    if (!t) {
      t = bake(reg);
      tex.set(reg, t);
    }
    return t;
  };
  /** Where a leg's edge is on the ground (a line across the road, coming in from the right at the far rows). */
  const edgeG = (at: number) => at + (GW - cx) / 0.12;
  function ground() {
    const legs = world.legs;
    const cur = legs[legs.length - 1];
    const prev = legs.length > 1 ? legs[legs.length - 2] : cur;
    const Ge = edgeG(cur.at);
    const regs: Region[] = prev === cur ? [cur.kind] : [prev.kind, cur.kind];
    const cols = new Map<Region, string[]>();
    for (const rg of regs) cols.set(rg, Array.from({ length: 17 }, (_, i) => E.tone(GROUND[rg], 0.9 - i * 0.056, 0.55 - i * 0.012)));
    const mat = typeof DOMMatrix !== 'undefined' ? new DOMMatrix() : null;
    let y = HY;
    while (y < GH + 2) {
      const bh = Math.max(1, Math.round(1 + ((y - HY) / (GH - HY)) * 3));
      const m = mAtY(y + bh / 2);
      const ci = Math.min(16, Math.floor(clamp01(m / 1.3) * 16.99));
      // The leg's edge on this row, ragged.
      let xb = prev === cur ? -1e9 : sx(Ge + (pnoise((y - HY) / 34, 1, seed + 41) - 0.5) * 700 * u + (pnoise((y - HY) / 9, 3, seed + 42) - 0.5) * 120 * u, m);
      xb = Math.max(-20, Math.min(GW + 20, xb));
      const spans: [Region, number, number][] = prev === cur ? [[cur.kind, -20, GW + 20]] : [[prev.kind, -20, xb], [cur.kind, xb, GW + 20]];
      for (const [rg, x0, x1] of spans) {
        if (x1 <= x0) continue;
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = cols.get(rg)![ci];
        c.fillRect(x0, y, x1 - x0, bh);
        if (m > 0.05) {
          const t = texOf(rg);
          if (t.pat && mat) {
            mat.a = m;
            mat.d = 1;
            mat.e = cx - posmod(world.dist, P) * m;
            mat.f = HY;
            t.pat.setTransform(mat);
            c.globalCompositeOperation = 'overlay';
            c.fillStyle = t.pat;
            c.fillRect(x0, y, x1 - x0, bh);
          }
        }
      }
      y += bh;
    }
    c.globalCompositeOperation = 'source-over';
    // The far ground hazed; the glare of the light on the flats toward it.
    const hz = c.createLinearGradient(0, HY, 0, world.yOf(0.3));
    hz.addColorStop(0, hexA(E.L.haze, 0.95));
    hz.addColorStop(0.35, hexA(E.L.haze, 0.35));
    hz.addColorStop(1, hexA(E.L.haze, 0));
    c.fillStyle = hz;
    c.fillRect(-20, HY, GW + 40, world.yOf(0.3) - HY);
    const [kx, , isSun] = keyLight();
    const sheen = (cur.kind === 'flats' || cur.kind === 'bog' ? 1 : 0.4) * (isSun ? 0.35 : 0.3 * E.night);
    if (sheen > 0.02) {
      c.save();
      c.globalCompositeOperation = isSun ? 'soft-light' : 'screen';
      c.translate(kx, world.yOf(-0.3));
      c.scale(1, 0.22);
      const rg = c.createRadialGradient(0, 0, 0, 0, 0, GW * 0.5);
      rg.addColorStop(0, hexA(E.L.sun, sheen));
      rg.addColorStop(1, hexA(E.L.sun, 0));
      c.fillStyle = rg;
      c.fillRect(-GW, -GW * 0.6, GW * 2, GW * 1.2);
      c.restore();
    }
  }

  // ---- things standing on the ground -------------------------------------------------------------
  type PropKind = 'rock' | 'spire' | 'bones' | 'husk' | 'pole' | 'tree' | 'tyres' | 'totem' | 'salt' | 'reeds' | 'stilt' | 'tuft' | 'drum' | 'boulder';
  const PROPS: Record<Region, [PropKind, number][]> = {
    flats: [['salt', 4], ['bones', 2], ['husk', 1.5], ['pole', 2.5], ['totem', 1], ['tyres', 1], ['drum', 1], ['rock', 1]],
    dunes: [['tuft', 4], ['bones', 1.5], ['husk', 1], ['rock', 1], ['tree', 1.2]],
    towers: [['rock', 3], ['spire', 2], ['boulder', 2], ['tree', 1], ['totem', 1], ['bones', 1]],
    canyon: [['boulder', 4], ['rock', 4], ['bones', 1]],
    bog: [['reeds', 5], ['tree', 3], ['stilt', 1.4], ['drum', 0.5]],
  };
  /** Strips of props at depths beyond the road and in front of it; the nearest pass fast and big. */
  const STRIPS = [
    { z: -0.62, spacing: 520, k: 1, density: 0.5 },
    { z: -0.36, spacing: 380, k: 1, density: 0.55 },
    { z: -0.14, spacing: 300, k: 1, density: 0.6 },
    { z: 1.16, spacing: 360, k: 1, density: 0.5 },
    { z: 1.42, spacing: 520, k: 1.2, density: 0.45 },
  ];
  type Prop = { z: number; draw: () => void; light?: () => void };
  /** The props standing in a stretch of ground (shared by the scene and the map, so both see the same road). */
  type PropSpec = { kind: PropKind; G: number; z: number; ps: number; reg: Region; G2?: number };
  function propSpecs(range: (m: number) => [number, number]): PropSpec[] {
    const out: PropSpec[] = [];
    for (const [si, st] of STRIPS.entries()) {
      const m = world.mOf(st.z);
      const sp = st.spacing * u;
      const [g0, g1] = range(m);
      for (let i = Math.floor(g0 / sp); i <= Math.ceil(g1 / sp); i++) {
        if (hash(i, si, seed + 51) > st.density) continue;
        const G = i * sp + hash(i, si + 10, seed) * sp * 0.7;
        const mixes = entryMix(G, 0.4);
        const reg = hash(i, si + 30, seed) < mixes[0][1] ? mixes[0][0] : mixes[mixes.length - 1][0];
        const opts = PROPS[reg];
        const tot = opts.reduce((s, o) => s + o[1], 0);
        let x = hash(i, si + 20, seed) * tot;
        let kind: PropKind = opts[0][0];
        for (const [k, w] of opts) {
          x -= w;
          if (x <= 0) {
            kind = k;
            break;
          }
        }
        // Nothing tall in front of the road: it would stand across the picture.
        if (st.z > 1 && (kind === 'pole' || kind === 'spire' || kind === 'tree' || kind === 'stilt' || kind === 'totem')) kind = reg === 'bog' ? 'reeds' : reg === 'dunes' ? 'tuft' : 'rock';
        const z = st.z + (hash(i, si + 40, seed) - 0.5) * 0.08;
        const ps = i * 131 + si * 7 + seed;
        out.push({ kind, G, z, ps, reg, G2: kind === 'pole' && st.z < 0 ? (i + 1) * sp + hash(i + 1, si + 10, seed) * sp * 0.7 : undefined });
      }
    }
    return out;
  }
  function props(): Prop[] {
    const out: Prop[] = [];
    for (const p of propSpecs((m) => [world.dist + (-160 * u * m * 3 - cx) / m, world.dist + (GW + 160 * u * m * 3 - cx) / m])) {
      const { kind, G, z, ps, reg, G2 } = p;
      out.push({ z, draw: () => prop(kind, G, z, ps, reg), light: kind === 'stilt' || kind === 'totem' ? () => propLight(kind, G, z, ps) : undefined });
      // Wires to the next pole along, sagging.
      if (G2 !== undefined) out.push({ z: z + 0.001, draw: () => wire(G, G2, z) });
    }
    return out;
  }
  function wire(G1: number, G2: number, z: number) {
    const m = world.mOf(z);
    const y = world.yOf(z) - 120 * u * m * 2.4;
    const x1 = sx(G1, m);
    const x2 = sx(G2, m);
    if (Math.max(x1, x2) < -20 || Math.min(x1, x2) > GW + 20) return;
    c.strokeStyle = hexA(E.tone('#1a1412', 0.4), 0.6);
    c.lineWidth = Math.max(0.5, 0.8 * u);
    c.beginPath();
    c.moveTo(x1, y);
    c.quadraticCurveTo((x1 + x2) / 2, y + 16 * u * m, x2, y);
    c.stroke();
  }
  function prop(kind: PropKind, G: number, z: number, ps: number, reg: Region) {
    const m = world.mOf(z);
    const s = u * world.VS * m;
    const x = sx(G, m);
    const y = world.yOf(z);
    if (x < -200 * s || x > GW + 200 * s) return;
    const d = clamp01(1 - m) * 0.85;
    const near = z > 1;
    const H = (k: number) => hash(ps, k);
    const rock = E.tone(reg === 'canyon' ? '#8a4e30' : '#9a6440', d, 0.08);
    const rockL = E.tone('#e0a06a', d, 0.8);
    const dark = E.tone('#2a1e1a', d, 0);
    const bone = E.tone('#e8dcc4', d, 0.5);
    // A shadow on the ground toward us.
    const shadow = (w: number) => {
      c.fillStyle = hexA(E.tone('#1a2a30', d, 0), 0.3 * (1 - E.night * 0.5));
      c.beginPath();
      c.ellipse(x + w * 0.1, y + 2 * s, w * 0.7, w * 0.12 + 2 * s, 0, 0, Math.PI * 2);
      c.fill();
    };
    // The nearest strip runs by fast: smear it along the road.
    const blur = near ? clamp01(world.V / (300 * u)) : 0;
    c.save();
    c.translate(x, y);
    if (blur > 0 && z > 1.3) {
      c.globalAlpha = 0.9;
    }
    switch (kind) {
      case 'rock':
      case 'boulder': {
        const w = (kind === 'boulder' ? 40 + H(1) * 40 : 14 + H(1) * 22) * s;
        const h = w * (0.5 + H(2) * 0.4);
        shadow(w);
        const p = new Path2D();
        p.moveTo(-w / 2, 1);
        for (let k = 0; k <= 8; k++) {
          const a = Math.PI + (k / 8) * Math.PI;
          p.lineTo(Math.cos(a) * w * 0.5 * (0.85 + H(k + 3) * 0.2), Math.sin(a) * h * (0.8 + H(k + 12) * 0.3));
        }
        p.closePath();
        c.fillStyle = vg(-h, 0, [[0, rockL], [0.25, rock], [1, dark]]);
        c.fill(p);
        c.strokeStyle = hexA(dark, 0.4);
        c.lineWidth = Math.max(0.5, s * 0.8);
        c.beginPath();
        c.moveTo(-w * 0.1, -h * 0.8);
        c.lineTo(w * 0.05, -h * 0.2);
        c.stroke();
        break;
      }
      case 'spire': {
        const w = (18 + H(1) * 14) * s;
        const h = (90 + H(2) * 90) * s;
        shadow(w);
        c.fillStyle = vg(-h, 0, [[0, rockL], [0.1, rock], [1, dark]]);
        c.beginPath();
        c.moveTo(-w, 0);
        c.lineTo(-w * 0.5, -h * 0.6);
        c.lineTo(-w * 0.7, -h * 0.85);
        c.lineTo(-w * 0.2, -h);
        c.lineTo(w * 0.4, -h * 0.9);
        c.lineTo(w * 0.35, -h * 0.55);
        c.lineTo(w, 0);
        c.fill();
        c.strokeStyle = hexA(dark, 0.35);
        c.lineWidth = Math.max(0.5, s);
        for (let k = 1; k < 5; k++) {
          c.beginPath();
          c.moveTo(-w * 0.7, -h * k * 0.2);
          c.lineTo(w * 0.7, -h * k * 0.2 + 2 * s);
          c.stroke();
        }
        break;
      }
      case 'bones': {
        shadow(20 * s);
        c.strokeStyle = bone;
        c.lineWidth = Math.max(0.6, 1.6 * s);
        c.beginPath();
        for (let k = 0; k < 5; k++) {
          c.moveTo(-10 * s + k * 4 * s, 0);
          c.quadraticCurveTo(-8 * s + k * 4 * s, -10 * s, -2 * s + k * 3 * s, -11 * s);
        }
        c.moveTo(-12 * s, -1 * s);
        c.lineTo(10 * s, -2 * s);
        c.stroke();
        c.fillStyle = bone;
        c.beginPath();
        c.ellipse(14 * s, -3 * s, 5 * s, 3.4 * s, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = bone;
        c.beginPath();
        c.moveTo(12 * s, -5 * s);
        c.quadraticCurveTo(8 * s, -14 * s, 2 * s, -12 * s);
        c.stroke();
        break;
      }
      case 'husk': {
        // An old car, rusted out and half in the sand.
        const w = 70 * s;
        shadow(w);
        c.rotate((H(1) - 0.5) * 0.25);
        const rust = E.tone('#6a3420', d, 0.15);
        const rustL = E.tone('#c06a36', d, 0.7);
        c.fillStyle = vg(-30 * s, 0, [[0, rustL], [0.2, rust], [1, dark]]);
        c.beginPath();
        c.moveTo(-w / 2, 0);
        c.lineTo(-w / 2, -12 * s);
        c.lineTo(-w * 0.2, -14 * s);
        c.lineTo(-w * 0.12, -26 * s);
        c.lineTo(w * 0.18, -26 * s);
        c.lineTo(w * 0.26, -14 * s);
        c.lineTo(w / 2, -11 * s);
        c.lineTo(w / 2, 0);
        c.fill();
        c.fillStyle = dark;
        c.fillRect(-w * 0.08, -23 * s, w * 0.1, 8 * s);
        c.fillRect(w * 0.06, -23 * s, w * 0.1, 8 * s);
        c.beginPath();
        c.arc(-w * 0.3, -2 * s, 8 * s, Math.PI, 0);
        c.arc(w * 0.3, -2 * s, 8 * s, Math.PI, 0);
        c.fill();
        break;
      }
      case 'pole': {
        const h = 120 * s;
        c.fillStyle = vg(-h, 0, [[0, E.tone('#6a5040', d, 0.6)], [0.3, E.tone('#4a3424', d, 0.1)], [1, dark]]);
        c.fillRect(-2 * s, -h, 4 * s, h);
        c.fillRect(-14 * s, -h + 8 * s, 28 * s, 3 * s);
        c.fillStyle = E.tone('#c8d8e0', d, 0.6);
        c.fillRect(-13 * s, -h + 6 * s, 2 * s, 2 * s);
        c.fillRect(11 * s, -h + 6 * s, 2 * s, 2 * s);
        if (H(3) < 0.4) {
          // A crow on top.
          c.fillStyle = dark;
          c.beginPath();
          c.ellipse(0, -h - 3 * s, 4 * s, 2.4 * s, -0.2, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'tree': {
        const h = (50 + H(1) * 60) * s;
        const wood = reg === 'bog' ? E.tone('#1a1c18', d, 0.05) : E.tone('#4a3428', d, 0.15);
        c.strokeStyle = wood;
        c.lineCap = 'round';
        const branch = (x0: number, y0: number, a: number, len: number, wdt: number, depth: number) => {
          const x1 = x0 + Math.sin(a) * len;
          const y1 = y0 - Math.cos(a) * len;
          c.lineWidth = Math.max(0.5, wdt);
          c.beginPath();
          c.moveTo(x0, y0);
          c.lineTo(x1, y1);
          c.stroke();
          if (depth > 0) {
            branch(x1, y1, a - 0.4 - H(depth * 3) * 0.3, len * 0.7, wdt * 0.65, depth - 1);
            branch(x1, y1, a + 0.35 + H(depth * 3 + 1) * 0.3, len * 0.62, wdt * 0.6, depth - 1);
          }
        };
        branch(0, 0, (H(2) - 0.5) * 0.3, h * 0.45, 5 * s, 3);
        c.lineCap = 'butt';
        if (reg === 'bog') {
          c.strokeStyle = hexA(E.tone('#4a5a3a', d, 0.2), 0.6);
          c.lineWidth = Math.max(0.5, s);
          for (let k = 0; k < 4; k++) {
            c.beginPath();
            c.moveTo((H(k + 20) - 0.5) * h * 0.6, -h * (0.5 + H(k + 30) * 0.3));
            c.lineTo((H(k + 20) - 0.5) * h * 0.6 + Math.sin(E.t + k) * s, -h * 0.25);
            c.stroke();
          }
        }
        break;
      }
      case 'tyres': {
        shadow(26 * s);
        for (let k = 0; k < 4; k++) {
          c.fillStyle = E.tone('#1a1716', d, 0.1);
          c.beginPath();
          c.ellipse(0, -5 * s - k * 7 * s, 13 * s, 4 * s, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = E.tone('#5a5048', d, 0.6);
          c.lineWidth = Math.max(0.5, s * 0.8);
          c.beginPath();
          c.ellipse(0, -7 * s - k * 7 * s, 13 * s, 4 * s, 0, Math.PI, 0);
          c.stroke();
        }
        break;
      }
      case 'totem': {
        // A skull on a stick, a warning at the edge of someone's land.
        const h = 60 * s;
        c.fillStyle = E.tone('#3a2a20', d, 0.2);
        c.fillRect(-1.5 * s, -h, 3 * s, h);
        c.fillRect(-10 * s, -h + 10 * s, 20 * s, 2.5 * s);
        c.fillStyle = bone;
        c.beginPath();
        c.arc(0, -h - 4 * s, 6 * s, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = dark;
        c.fillRect(-3.5 * s, -h - 5 * s, 2.5 * s, 2.5 * s);
        c.fillRect(1 * s, -h - 5 * s, 2.5 * s, 2.5 * s);
        c.strokeStyle = E.tone('#a83a24', d, 0.4);
        c.lineWidth = Math.max(0.5, 2 * s);
        c.beginPath();
        c.moveTo(8 * s, -h + 11 * s);
        c.quadraticCurveTo(14 * s, -h + 18 * s + Math.sin(E.t * 4 + ps) * 2 * s, 18 * s, -h + 24 * s);
        c.stroke();
        break;
      }
      case 'salt': {
        const w = (20 + H(1) * 30) * s;
        const h = w * (0.4 + H(2) * 0.5);
        const salt = E.tone('#f4ece0', d, 0.6);
        c.fillStyle = vg(-h, 0, [[0, E.tone('#ffffff', d, 1)], [0.3, salt], [1, E.tone('#8aa0a8', d, 0)]]);
        c.beginPath();
        c.moveTo(-w / 2, 0);
        for (let k = 0; k < 5; k++) {
          c.lineTo(-w / 2 + (k + 0.5) * (w / 5), -h * (0.5 + H(k + 4) * 0.5));
          c.lineTo(-w / 2 + (k + 1) * (w / 5), -h * 0.25 * H(k + 9));
        }
        c.lineTo(w / 2, 0);
        c.fill();
        break;
      }
      case 'reeds': {
        const n = 7 + Math.floor(H(1) * 6);
        c.strokeStyle = E.tone(reg === 'bog' ? '#3a4a2a' : '#8a7a40', d, 0.25);
        c.lineWidth = Math.max(0.5, 1.1 * s);
        c.beginPath();
        for (let k = 0; k < n; k++) {
          const bx = (H(k + 2) - 0.5) * 30 * s;
          const h = (16 + H(k + 20) * 22) * s;
          const sw = Math.sin(E.t * 1.6 + k + ps) * 3 * s;
          c.moveTo(bx, 0);
          c.quadraticCurveTo(bx + sw * 0.4, -h * 0.5, bx + sw, -h);
        }
        c.stroke();
        break;
      }
      case 'tuft': {
        c.strokeStyle = E.tone('#b89a50', d, 0.5);
        c.lineWidth = Math.max(0.5, 0.9 * s);
        c.beginPath();
        for (let k = 0; k < 9; k++) {
          const a = -0.9 + (k / 8) * 1.8 + Math.sin(E.t * 2 + ps) * 0.08;
          c.moveTo(0, 0);
          c.lineTo(Math.sin(a) * 12 * s, -Math.cos(a) * (10 + H(k) * 8) * s);
        }
        c.stroke();
        break;
      }
      case 'drum': {
        shadow(12 * s);
        c.fillStyle = vg(-18 * s, 0, [[0, E.tone('#c86a30', d, 0.7)], [0.25, E.tone('#8a3a20', d, 0.1)], [1, dark]]);
        c.fillRect(-6 * s, -18 * s, 12 * s, 18 * s);
        c.fillStyle = hexA(dark, 0.6);
        c.fillRect(-6 * s, -12 * s, 12 * s, 1.2 * s);
        c.fillRect(-6 * s, -6 * s, 12 * s, 1.2 * s);
        break;
      }
      case 'stilt': {
        // One of the stilt folk wading the bog on long legs, a lantern on a pole.
        const h = 90 * s;
        const ph = E.t * 1.4 + ps;
        const M = mats(E, d, 'rival', ps, x);
        c.strokeStyle = E.tone('#2a2420', d, 0.2);
        c.lineWidth = Math.max(0.5, 1.6 * s);
        c.beginPath();
        c.moveTo(-6 * s + Math.sin(ph) * 8 * s, 0);
        c.lineTo(0, -h * 0.62);
        c.lineTo(6 * s - Math.sin(ph) * 8 * s, 0);
        c.stroke();
        figure(E, M, 0, -h * 0.6, 30 * s, 'stand', ph, { mask: true });
        c.strokeStyle = E.tone('#3a3028', d, 0.2);
        c.beginPath();
        c.moveTo(8 * s, -h * 0.75);
        c.lineTo(14 * s, -h * 1.15);
        c.stroke();
        c.fillStyle = E.tone('#ffb050', 0, 0.9);
        c.fillRect(13 * s, -h * 1.15, 3.5 * s, 4.5 * s);
        break;
      }
    }
    c.restore();
  }
  function propLight(kind: PropKind, G: number, z: number, ps: number) {
    const m = world.mOf(z);
    const s = u * world.VS * m;
    const x = sx(G, m);
    const y = world.yOf(z);
    if (kind === 'stilt') {
      const fl = 0.8 + 0.2 * Math.sin(E.t * 9 + ps);
      E.glow(x + 15 * s, y - 90 * s * 1.13, 26 * s, '#ffb050', (0.4 + 0.6 * E.night) * fl);
    }
  }
  const vg = (y0: number, y1: number, stops: [number, string][]) => {
    const g = c.createLinearGradient(0, y0, 0, y1);
    for (const [k, col] of stops) g.addColorStop(k, col);
    return g;
  };

  /** Mist low on the bog, and the night's cold ground fog. */
  function mist() {
    const bogW = regionMix(world.dist).find(([r]) => r === 'bog')?.[1] ?? 0;
    const a = bogW * 0.5 + E.night * 0.08;
    if (a < 0.02) return;
    const spr = E.soft(E.tone('#a8c0d8', 0.5, 0.4));
    for (let k = 0; k < 14; k++) {
      const z = -0.4 + hash(k, 1, seed) * 1.6;
      const m = world.mOf(z);
      const span = GW * 1.6;
      const x = posmod(hash(k, 2, seed) * span - world.dist * m * 0.9 - E.t * 6 * u, span) - GW * 0.3;
      const w = (300 + hash(k, 3, seed) * 400) * u * m;
      c.globalAlpha = a * (0.4 + 0.3 * Math.sin(E.t * 0.3 + k));
      c.drawImage(spr, x - w / 2, world.yOf(z) - w * 0.12, w, w * 0.2);
    }
    c.globalAlpha = 1;
  }

  return { keyLight, sky, horizon, farPlane, canyonWall, dunePlane, ground, props, propSpecs, mist, regionMix, heatOf, pnoise, clear: () => tex.clear() };
}
