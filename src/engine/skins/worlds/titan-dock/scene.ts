/**
 * Out of doors: the storm sky, the rift, the sea, and the city across the bay.
 *
 * The clouds are baked once as masks (a body and its underside, from tileable noise) and tinted
 * by the hour every frame, scrolling on the wind; lightning lights their undersides. The sea is a
 * gradient under rows of waves, each row a line of crests heaving with the swell, smaller and
 * closer together toward the horizon, with the rift's light and the city's lights on it. The city
 * is baked in bands of distance (the land, the quay, buildings with their windows, the harbour's
 * cranes, the bridge, the headland) so that what is out on the water goes between them; a band
 * is baked again when the light has moved on, a building falls, or the bridge comes down.
 */
import { hash } from '../../instruments/kit';
import { vnoise } from '../sandsea/terrain';
import { clamp01, hexA, mix, mk, MOODS, type Env } from './look';
import type { Building, DockWorld } from './types';

export const BANDS = [-0.5, 0.1, 0.17, 0.24, 0.31, 0.39, 0.48, 0.58, 0.7, 0.84, 1.01];
export const bandOf = (d: number) => {
  let k = 0;
  while (k + 1 < BANDS.length - 1 && d >= BANDS[k + 1]) k++;
  return k;
};

export function createScene(E: Env, w: DockWorld, seed: number) {
  const { GW, HY, NY, u } = w;
  const c = E.ctx;
  const M = MOODS[w.mood];

  // ---- the sky --------------------------------------------------------------------------------------
  const CR = 0.25;
  const cw = Math.ceil(GW * CR);
  const chh = Math.ceil((HY + 20 * u) * CR);
  let body: HTMLCanvasElement | null = null;
  let under: HTMLCanvasElement | null = null;
  let tb: HTMLCanvasElement | null = null;
  let tu: HTMLCanvasElement | null = null;
  function bakeClouds() {
    body = mk(cw, chh);
    under = mk(cw, chh);
    const bi = body.getContext('2d')!.createImageData(cw, chh);
    const ui = under.getContext('2d')!.createImageData(cw, chh);
    const sc = 1 / (120 * u * CR);
    const dens = (i: number, j: number) => {
      const f = (x: number) => {
        let n = 0;
        let a = 0.55;
        let fq = 1;
        for (let o = 0; o < 4; o++) {
          n += vnoise(x * sc * fq, j * sc * fq * 2.2, seed + o * 17) * a;
          a *= 0.5;
          fq *= 2.1;
        }
        return n;
      };
      // Tileable across: blend the field with itself one width over.
      const v = ((cw - i) * f(i) + i * f(i - cw)) / cw;
      const hgt = j / chh;
      return clamp01((v - 0.42 + hgt * 0.12) * 2.6) * (0.55 + 0.45 * (1 - hgt * 0.4));
    };
    const D = new Float32Array(cw * chh);
    for (let j = 0; j < chh; j++) for (let i = 0; i < cw; i++) D[j * cw + i] = dens(i, j);
    for (let j = 0; j < chh; j++)
      for (let i = 0; i < cw; i++) {
        const v = D[j * cw + i];
        const below = j + 3 < chh ? D[(j + 3) * cw + i] : 0;
        const o = (j * cw + i) * 4;
        bi.data[o] = bi.data[o + 1] = bi.data[o + 2] = 255;
        bi.data[o + 3] = Math.round(v * 255);
        ui.data[o] = ui.data[o + 1] = ui.data[o + 2] = 255;
        ui.data[o + 3] = Math.round(clamp01((v - below) * 3 + v * 0.15) * 255 * v);
      }
    body.getContext('2d')!.putImageData(bi, 0, 0);
    under.getContext('2d')!.putImageData(ui, 0, 0);
    tb = mk(cw, chh);
    tu = mk(cw, chh);
  }
  const tint = (src: HTMLCanvasElement, dst: HTMLCanvasElement, color: string) => {
    const g = dst.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cw, chh);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, cw, chh);
  };
  const riftCol = M.rift;

  function sky(t: number) {
    if (!body) bakeClouds();
    const L = E.L;
    const g = c.createLinearGradient(0, 0, 0, HY);
    g.addColorStop(0, L.top);
    g.addColorStop(0.6, L.mid);
    g.addColorStop(1, L.low);
    c.fillStyle = g;
    c.fillRect(-20, -20, GW + 40, HY + 40);
    // The city's glow on the low cloud by night, over the far shore.
    if (L.night > 0.05) {
      const cx = w.coastX(0.6) + 200 * u;
      const gg = c.createRadialGradient(cx, HY, 0, cx, HY, GW * 0.5);
      gg.addColorStop(0, hexA(L.glow, 0.28 * L.night));
      gg.addColorStop(1, hexA(L.glow, 0));
      c.fillStyle = gg;
      c.fillRect(-20, -20, GW + 40, HY + 40);
    }
    // The rift's light in the sky above it.
    const pulse = 0.35 + 0.25 * Math.sin(t * 0.7) + w.riftPulse * 0.8 + w.alarm * 0.3;
    const rg = c.createRadialGradient(w.riftX, HY, 0, w.riftX, HY, 260 * u);
    rg.addColorStop(0, hexA(riftCol, 0.32 * pulse));
    rg.addColorStop(1, hexA(riftCol, 0));
    c.fillStyle = rg;
    c.fillRect(w.riftX - 280 * u, HY - 280 * u, 560 * u, 290 * u);
    // Clouds: the dark body, the lit underside (the city, the rift, the lightning), drifting.
    const dark = mix(L.ink, L.mid, 0.35 + (1 - L.night) * 0.3);
    const lit = mix(mix(L.low, L.glow, L.night * 0.35), '#e8f0ff', w.flash * 0.7);
    tint(body!, tb!, dark);
    tint(under!, tu!, lit);
    const off = ((t * 3 * u * (0.6 + w.storm) * (w.wind >= 0 ? 1 : -1)) % GW + GW) % GW;
    c.imageSmoothingEnabled = true;
    for (const k of [-1, 0]) {
      c.globalAlpha = 0.9;
      c.drawImage(tb!, off + k * GW, -10 * u, GW, HY + 20 * u);
      c.globalAlpha = 0.45 + L.night * 0.25 + w.flash * 0.5;
      c.drawImage(tu!, off + k * GW, -10 * u, GW, HY + 20 * u);
    }
    c.globalAlpha = 1;
    // Rain curtains hanging from the cloud.
    c.fillStyle = hexA(mix(L.haze, L.mid, 0.5), 0.12 + w.rain * 0.12);
    for (let k = 0; k < 6; k++) {
      const x = ((hash(k, 3, seed) * GW + t * 6 * u * (k % 2 ? 1 : 0.7)) % (GW + 300 * u)) - 150 * u;
      const wd = (120 + hash(k, 4, seed) * 200) * u;
      const gr = c.createLinearGradient(0, HY * 0.3, 0, HY);
      gr.addColorStop(0, hexA(L.haze, 0));
      gr.addColorStop(1, hexA(L.haze, 0.18 * w.rain));
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(x, HY * 0.3);
      c.lineTo(x + wd, HY * 0.3);
      c.lineTo(x + wd - 40 * u * w.wind, HY);
      c.lineTo(x - 40 * u * w.wind, HY);
      c.fill();
    }
    // Lightning.
    const b = w.bolt;
    if (b) {
      const age = w.t - b.t0;
      const a = clamp01(1 - age * 2.2) * (age < 0.06 || (age > 0.12 && age < 0.2) ? 1 : 0.5);
      const pts: [number, number][] = [];
      let x = b.x + (hash(b.seed, 1) - 0.5) * 80 * u;
      const n = 14;
      for (let k = 0; k <= n; k++) {
        const y = b.y0 + ((b.y1 - b.y0) * k) / n;
        pts.push([x, y]);
        x += (hash(b.seed, k, 2) - 0.5) * 40 * u + (b.x - x) * 0.15;
      }
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const [lw2, al] of [[9, 0.12], [4, 0.3], [1.6, 1]] as const) {
        c.strokeStyle = hexA(lw2 > 2 ? '#a8c8ff' : '#ffffff', al * a);
        c.lineWidth = lw2 * u;
        c.beginPath();
        pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
        for (let k = 3; k < n; k += 4) {
          const [px, py] = pts[k];
          c.moveTo(px, py);
          c.lineTo(px + (hash(b.seed, k, 5) - 0.5) * 120 * u, py + 40 * u);
        }
        c.stroke();
      }
      c.restore();
    }
  }

  // ---- the sea ------------------------------------------------------------------------------------
  /** The waves at (x, row) now. */
  const wave = (x: number, j: number, m: number, t: number) => {
    const sw = 0.5 + w.swell;
    return (Math.sin(x / (34 * u * Math.max(0.15, m)) + t * 0.9 + j * 1.7) * 0.6 + Math.sin(x / (13 * u * Math.max(0.15, m)) - t * 1.6 + j * 0.9) * 0.4) * 5 * u * m * sw;
  };
  const rows: { y: number; d: number; m: number; j: number }[] = [];
  {
    let y = HY + 1.2;
    let j = 0;
    while (y < w.GH + 30 * u) {
      const kk = (y - HY) / (NY - HY);
      const d = 1 - Math.sqrt(Math.max(0, kk));
      const m = 0.06 + 0.94 * (1 - d) * (1 - d);
      rows.push({ y, d, m, j: j++ });
      y += Math.max(1.4, 9 * u * m);
    }
  }
  function sea(t: number, near: boolean, x0: number) {
    const L = E.L;
    const top = near ? NY - 6 * u : HY;
    const bot = near ? w.GH + 20 : NY + 4 * u;
    const g = c.createLinearGradient(0, HY, 0, w.GH);
    g.addColorStop(0, mix(L.haze, L.low, 0.4));
    g.addColorStop(0.12, mix(L.sea, L.haze, 0.45));
    g.addColorStop(0.5, L.sea);
    g.addColorStop(1, L.deep);
    c.fillStyle = g;
    c.fillRect(x0, top, GW + 20 - x0, bot - top);
    // The rift's light lying on the water far out; the city's lights in it.
    if (!near) {
      const pulse = 0.4 + 0.25 * Math.sin(t * 0.7) + w.riftPulse * 0.9 + w.alarm * 0.3;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.translate(w.riftX, HY + 3 * u);
      c.scale(1, 0.12);
      E.glow(0, 0, 200 * u, riftCol, 0.5 * pulse);
      c.restore();
      if (L.night > 0.05) {
        const cx = w.coastX(0.4);
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.translate(cx, w.yOf(0.4));
        c.scale(1.6, 0.35);
        E.glow(0, 0, 240 * u, L.glow, 0.25 * L.night * (1 - w.evac * 0.4));
        c.restore();
      }
    }
    // Rows of waves: a dark trough under each line of crests.
    const crest = mix(L.crest, L.key, w.flash * 0.6);
    for (const r of rows) {
      if (near ? r.y < top : r.y > bot) continue;
      const step = Math.max(6, 22 * u * r.m);
      const a = clamp01(0.15 + r.m * 0.7);
      c.strokeStyle = hexA(L.deep, 0.35 * a);
      c.lineWidth = Math.max(0.8, 3.2 * u * r.m);
      c.beginPath();
      for (let x = x0; x <= GW + step; x += step) {
        const yy = r.y + wave(x, r.j, r.m, t) + 2 * u * r.m;
        if (x === x0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      }
      c.stroke();
      c.strokeStyle = hexA(crest, (0.18 + 0.25 * r.m) * (0.6 + w.storm * 0.4) * (1 - E.hazeOf(r.d) * 0.7));
      c.lineWidth = Math.max(0.5, 1.2 * u * r.m);
      c.beginPath();
      for (let x = x0; x <= GW + step; x += step) {
        const yy = r.y + wave(x, r.j, r.m, t);
        if (x === x0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      }
      c.stroke();
      // Whitecaps where the wind tears the crests.
      if (w.storm > 0.3 && r.m > 0.2) {
        c.fillStyle = hexA(mix('#e8f0f4', L.ink, L.night * 0.5), 0.5 * (w.storm - 0.3));
        for (let k = 0; k < 6; k++) {
          const ph = hash(r.j, k, seed);
          const x = x0 + ((ph * (GW - x0) + t * 20 * u * (0.5 + ph)) % (GW - x0));
          if (Math.sin(t * 1.3 + ph * 20) < 0.6) continue;
          c.fillRect(x, r.y + wave(x, r.j, r.m, t) - 1.5 * u * r.m, 10 * u * r.m, 1.6 * u * r.m);
        }
      }
    }
  }

  // ---- the city, in bands -----------------------------------------------------------------------------
  type Band = { canvas: HTMLCanvasElement | null; x: number; y: number; w: number; h: number; key: string; lights: [number, number, string][] };
  const bands: Band[] = BANDS.slice(0, -1).map(() => ({ canvas: null, x: 0, y: 0, w: 0, h: 0, key: '', lights: [] }));
  const RES = 1;
  const tall = 1050 * u;
  function bandBox(k: number) {
    const d0 = Math.max(0, BANDS[k]);
    const d1 = Math.min(1, BANDS[k + 1]);
    const x = Math.max(0, Math.min(w.coastX(d1), w.bridgeX0) - 260 * u * w.mOf(d1));
    const y = Math.max(-20, w.yOf(d1) - tall * w.mOf(d0));
    const y1 = w.yOf(d0) + 8 * u;
    return { x, y, w: GW + 10 - x, h: Math.max(4, y1 - y), d0, d1 };
  }
  const inBand = (d: number, k: number) => d >= BANDS[k] && d < BANDS[k + 1];
  function bandKey(k: number) {
    const bs = w.buildings.filter((b) => inBand(b.d, k));
    const lightKey = `${Math.round(w.day * 200)}:${Math.round(w.storm * 4)}:${w.evac > 0.5 ? 1 : 0}`;
    const bridge = inBand(w.bridgeD, k) ? (w.bridgeBroken > 0 ? 'B' : 'b') : '';
    return `${lightKey}|${bs.map((b) => (b.fall >= 1 ? 2 : b.fall > 0 ? 1 : 0)).join('')}|${bridge}`;
  }
  function bake(k: number) {
    const B = bands[k];
    const bx = bandBox(k);
    B.x = bx.x;
    B.y = bx.y;
    B.w = bx.w;
    B.h = bx.h;
    if (!B.canvas || B.canvas.width !== Math.ceil(bx.w * RES) || B.canvas.height !== Math.ceil(bx.h * RES)) B.canvas = mk(bx.w * RES, bx.h * RES);
    const g = B.canvas.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, B.canvas.width, B.canvas.height);
    g.setTransform(RES, 0, 0, RES, -bx.x * RES, -bx.y * RES);
    B.lights = [];
    const d0 = bx.d0;
    const d1 = bx.d1;
    const dm = (d0 + d1) / 2;
    // The land behind the waterfront, and the quay's edge.
    if (d0 < 1) {
      g.fillStyle = E.tone('#2a2e30', dm, 0.1);
      g.beginPath();
      g.moveTo(w.coastX(d1), w.yOf(d1));
      for (let q = 1; q >= 0; q -= 0.1) {
        const dd = d0 + (d1 - d0) * q;
        g.lineTo(w.coastX(dd), w.yOf(dd));
      }
      g.lineTo(GW + 20, w.yOf(d0));
      g.lineTo(GW + 20, w.yOf(d1));
      g.closePath();
      g.fill();
      g.strokeStyle = E.tone('#8a8a82', dm, 0.4);
      g.lineWidth = Math.max(0.6, 3 * u * w.mOf(dm));
      g.beginPath();
      g.moveTo(w.coastX(d1), w.yOf(d1));
      g.lineTo(w.coastX(d0), w.yOf(d0));
      g.stroke();
      // The quay wall's face down to the water.
      g.fillStyle = E.tone('#3a3c3a', dm, 0.1);
      g.beginPath();
      g.moveTo(w.coastX(d1), w.yOf(d1));
      g.lineTo(w.coastX(d0), w.yOf(d0));
      g.lineTo(w.coastX(d0), w.yOf(d0) + 6 * u * w.mOf(d0));
      g.lineTo(w.coastX(d1), w.yOf(d1) + 6 * u * w.mOf(d1));
      g.closePath();
      g.fill();
      // A fjord's far wall: dark rock rising from behind the town, waterfalls down it.
      if (w.setting === 'fjord') {
        const rockC = E.tone('#2a2e2c', dm, 0.08);
        g.fillStyle = rockC;
        g.beginPath();
        const steps = 12;
        const top = (dd: number, i: number) => w.yOf(dd) - (420 + vnoise(i * 0.7, dd * 8, seed + 21) * 360) * u * w.mOf(dd);
        g.moveTo(w.coastX(d1) + 40 * u * w.mOf(d1), w.yOf(d1));
        for (let i = 0; i <= steps; i++) {
          const dd = d1 + ((d0 - d1) * i) / steps;
          g.lineTo(w.coastX(dd) + (60 + i * 6) * u * w.mOf(dd), top(dd, i));
        }
        g.lineTo(GW + 20, top(d0, steps));
        g.lineTo(GW + 20, w.yOf(d1));
        g.closePath();
        g.fill();
        g.fillStyle = hexA(mix('#dfe8ee', E.L.ink, E.L.night * 0.5), 0.35);
        for (let q = 0; q < 2; q++) {
          if (hash(k, q, 31) < 0.5) continue;
          const dd = d0 + (d1 - d0) * hash(k, q, 32);
          const fx = w.coastX(dd) + (90 + hash(k, q, 33) * 120) * u * w.mOf(dd);
          g.fillRect(fx, top(dd, 6), 3 * u * w.mOf(dd), w.yOf(dd) - top(dd, 6));
        }
      }
      // Containers stacked on the quay, and street lamps.
      for (let q = 0; q < 10; q++) {
        const dd = d0 + (d1 - d0) * hash(k, q, 3);
        const m = w.mOf(dd);
        const x = w.coastX(dd) + (14 + hash(k, q, 4) * 40) * u * m;
        const y = w.yOf(dd);
        for (let s = 0; s < 1 + Math.floor(hash(k, q, 5) * 3); s++) {
          g.fillStyle = E.tone(['#a83a28', '#2a5a8a', '#c89020', '#3a6a42', '#7a7a7a'][Math.floor(hash(k, q, 6 + s) * 5)], dd, 0.15);
          g.fillRect(x, y - (s + 1) * 7 * u * m, 22 * u * m, 6.4 * u * m);
        }
        if (q % 3 === 0) B.lights.push([x - 6 * u * m, y - 26 * u * m, '#ffc070']);
      }
    }
    // Far: the skyline beyond and the hills.
    if (d1 > 1) {
      g.fillStyle = E.tone('#3a4048', 0.97);
      g.beginPath();
      g.moveTo(-20, HY + 2);
      for (let x = -20; x <= GW + 20; x += 8) g.lineTo(x, HY - (vnoise(x / (160 * u), 0, seed + 9) * 22 + 4) * u);
      g.lineTo(GW + 20, HY + 2);
      g.fill();
      const x0 = w.coastX(0.84) - 120 * u;
      for (let x = x0; x < GW; x += (6 + hash(Math.round(x), 1, seed) * 10) * u) {
        const h = (8 + hash(Math.round(x), 2, seed) ** 2 * 50) * u;
        g.fillStyle = E.tone('#2a3038', 0.93);
        g.fillRect(x, HY - h, 7 * u, h + 1);
        if (E.L.night > 0.2 && hash(Math.round(x), 3, seed) < 0.6 && w.evac < 0.5) B.lights.push([x + 3 * u, HY - h * 0.6, M.glow]);
      }
    }
    // The headland and its lighthouse, at the bridge's far end.
    if (inBand(w.bridgeD + 0.02, k)) {
      const dd = w.bridgeD + 0.02;
      const m = w.mOf(dd);
      const hx = w.bridgeX0;
      const y = w.yOf(dd);
      g.fillStyle = E.tone('#2e3230', dd, 0.1);
      g.beginPath();
      g.moveTo(hx - 200 * u * m, y + 2);
      g.quadraticCurveTo(hx - 120 * u * m, y - 70 * u * m, hx - 30 * u * m, y - 60 * u * m);
      g.quadraticCurveTo(hx + 20 * u * m, y - 50 * u * m, hx + 60 * u * m, y + 2);
      g.fill();
      g.fillStyle = E.tone('#d8d4c8', dd, 0.3);
      g.fillRect(hx - 80 * u * m, y - 130 * u * m, 12 * u * m, 72 * u * m);
      g.fillStyle = E.tone('#a83020', dd, 0.2);
      g.fillRect(hx - 80 * u * m, y - 108 * u * m, 12 * u * m, 8 * u * m);
    }
    // The buildings, far to near.
    for (const b of w.buildings) {
      if (!inBand(b.d, k) || (b.fall > 0 && b.fall < 1)) continue;
      drawBuilding(g, b, B.lights, b.fall >= 1);
    }
    // The bridge.
    if (inBand(w.bridgeD, k)) drawBridge(g, B.lights);
    B.key = bandKey(k);
  }

  /** A building at its place, into a band (or live, falling). */
  function drawBuilding(g: CanvasRenderingContext2D, b: Building, lights: [number, number, string][] | null, rubble: boolean, fall = 0) {
    const m = w.mOf(b.d);
    const bw = b.w * m;
    const bh = b.h * m;
    const x = b.x - bw / 2;
    const y = w.yOf(b.d);
    const dark = E.L.night > 0.3;
    if (rubble) {
      g.fillStyle = E.tone('#4a4844', b.d, 0.1);
      g.beginPath();
      g.moveTo(x - bw * 0.2, y);
      for (let q = 0; q <= 8; q++) g.lineTo(x - bw * 0.2 + (q / 8) * bw * 1.4, y - bh * (0.06 + hash(b.seed, q) * 0.12));
      g.lineTo(x + bw * 1.2, y);
      g.fill();
      g.fillStyle = E.tone('#3a3a38', b.d);
      g.fillRect(x + bw * 0.2, y - bh * 0.25, bw * 0.25, bh * 0.25);
      return;
    }
    g.save();
    if (fall > 0) {
      g.translate(b.x, y);
      g.rotate((hash(b.seed, 9) < 0.5 ? -1 : 1) * fall * 0.5);
      g.translate(-b.x, -y + fall * fall * bh * 0.9);
      g.beginPath();
      g.rect(x - bw, y - bh * 2, bw * 3, bh * 2 - fall * fall * bh * 0.9 + 1);
      g.clip();
    }
    if (b.kind === 'rig' || b.kind === 'stack' || b.kind === 'tank' || b.kind === 'house') {
      industry(g, b, x, y, bw, bh, m, lights);
      g.restore();
      return;
    }
    if (b.kind === 'crane') {
      // A container crane: two legs, a boom out over the water, red and white.
      const red = E.tone('#b8382a', b.d, 0.2);
      const white = E.tone('#d8d8d0', b.d, 0.3);
      g.strokeStyle = red;
      g.lineWidth = Math.max(0.6, 5 * u * m);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + bw * 0.1, y - bh * 0.75);
      g.moveTo(x + bw, y);
      g.lineTo(x + bw * 0.9, y - bh * 0.75);
      g.stroke();
      g.strokeStyle = white;
      g.lineWidth = Math.max(0.6, 4 * u * m);
      g.beginPath();
      g.moveTo(x - bw * 1.6, y - bh * 0.72);
      g.lineTo(x + bw * 1.3, y - bh * 0.76);
      g.moveTo(x + bw * 0.5, y - bh);
      g.lineTo(x - bw * 1.4, y - bh * 0.73);
      g.moveTo(x + bw * 0.5, y - bh);
      g.lineTo(x + bw * 1.2, y - bh * 0.76);
      g.moveTo(x + bw * 0.5, y - bh);
      g.lineTo(x + bw * 0.5, y - bh * 0.75);
      g.stroke();
      if (lights) lights.push([x - bw * 1.6, y - bh * 0.72, '#ff3020'], [x + bw * 0.5, y - bh, '#ff3020']);
      g.restore();
      return;
    }
    const base = b.kind === 'tower' ? (hash(b.seed, 1) < 0.5 ? '#2a3a4a' : '#3a4450') : b.kind === 'spire' ? '#4a5260' : b.kind === 'slab' ? '#5a5650' : '#6a6458';
    const col = E.tone(base, b.d, 0.15);
    const side = mix(col, E.L.ink, 0.35);
    // The body, with a darker side face toward the dock.
    g.fillStyle = col;
    if (b.kind === 'spire') {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + bw * 0.08, y - bh * 0.82);
      g.lineTo(x + bw * 0.5, y - bh);
      g.lineTo(x + bw * 0.92, y - bh * 0.82);
      g.lineTo(x + bw, y);
      g.fill();
    } else g.fillRect(x, y - bh, bw, bh);
    g.fillStyle = side;
    g.fillRect(x, y - bh * (b.kind === 'spire' ? 0.82 : 1), Math.max(1, bw * 0.18), bh * (b.kind === 'spire' ? 0.82 : 1));
    // The lit edge (the city's glow from below by night, the sky by day).
    g.fillStyle = hexA(dark ? E.L.glow : E.L.key, dark ? 0.12 : 0.18 * E.L.rim);
    g.fillRect(x + bw - Math.max(1, bw * 0.08), y - bh, Math.max(1, bw * 0.08), bh);
    // Windows: a grid, some lit; dark in an evacuation.
    const cols = Math.max(2, Math.floor(bw / (7 * u * m + 1.5)));
    const rowsN = Math.max(3, Math.floor(bh / (9 * u * m + 1.5)));
    const ww = (bw * 0.8) / cols;
    const wh = (bh * 0.85) / rowsN;
    const evac = w.evac > 0.5;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rowsN; j++) {
        const wx = x + bw * 0.12 + i * ww;
        const wy = y - bh * 0.95 + j * wh;
        if (b.kind === 'spire' && j < rowsN * 0.2) continue;
        const on = hash(b.seed, i * 31 + j, 7) < b.lit * (evac ? 0.15 : 1) * (0.3 + E.L.night * 0.7);
        if (on) g.fillStyle = hexA(hash(b.seed, i, j) < 0.7 ? mix('#ffd8a0', E.L.glow, 0.3) : '#c8e0ff', 0.55 + E.L.night * 0.4);
        else g.fillStyle = hexA(mix(col, E.L.ink, 0.5), 0.6);
        g.fillRect(wx, wy, Math.max(0.6, ww * 0.6), Math.max(0.6, wh * 0.45));
      }
    // On the roof: tanks, a mast with its red light.
    g.fillStyle = side;
    if (b.kind !== 'spire') g.fillRect(x + bw * 0.6, y - bh - 6 * u * m, bw * 0.2, 6 * u * m);
    if (b.h > 400 * u && lights) lights.push([x + bw * 0.5, y - bh - (b.kind === 'spire' ? 0 : 14 * u * m), '#ff3020']);
    if (b.kind === 'tower' && b.h > 400 * u) {
      g.strokeStyle = side;
      g.lineWidth = Math.max(0.5, 1.5 * u * m);
      g.beginPath();
      g.moveTo(x + bw * 0.5, y - bh);
      g.lineTo(x + bw * 0.5, y - bh - 14 * u * m);
      g.stroke();
    }
    g.restore();
  }

  /** The rigs, the refinery's tanks and flare stacks, a fjord town's houses. */
  function industry(g: CanvasRenderingContext2D, b: Building, x: number, y: number, bw: number, bh: number, m: number, lights: [number, number, string][] | null) {
    const steel = E.tone('#6a6a64', b.d, 0.2);
    const dark = E.tone('#1e2226', b.d);
    if (b.kind === 'rig') {
      // Four legs into the sea, a deck, the derrick's lattice, a crane, the flare boom.
      const deck = y - bh * 0.45;
      g.fillStyle = E.tone('#c8a020', b.d, 0.2);
      for (const lx of [0.1, 0.35, 0.65, 0.9]) g.fillRect(x + bw * lx - bw * 0.025, deck, bw * 0.05, y - deck + 4 * u * m);
      g.strokeStyle = E.tone('#8a7a40', b.d, 0.1);
      g.lineWidth = Math.max(0.5, 1.4 * u * m);
      g.beginPath();
      for (const [a, c2] of [[0.1, 0.35], [0.65, 0.9]]) {
        g.moveTo(x + bw * a, deck + (y - deck) * 0.2);
        g.lineTo(x + bw * c2, y);
        g.moveTo(x + bw * c2, deck + (y - deck) * 0.2);
        g.lineTo(x + bw * a, y);
      }
      g.stroke();
      g.fillStyle = steel;
      g.fillRect(x - bw * 0.04, deck - bh * 0.12, bw * 1.08, bh * 0.12);
      g.fillStyle = E.tone('#d8d4c8', b.d, 0.3);
      g.fillRect(x + bw * 0.05, deck - bh * 0.28, bw * 0.3, bh * 0.16);
      g.fillStyle = dark;
      g.fillRect(x + bw * 0.62, deck - bh * 0.2, bw * 0.3, bh * 0.08);
      g.strokeStyle = E.tone('#b84030', b.d, 0.2);
      g.lineWidth = Math.max(0.5, 1.2 * u * m);
      g.beginPath();
      const dx0 = x + bw * 0.5;
      g.moveTo(dx0 - bw * 0.1, deck - bh * 0.12);
      g.lineTo(dx0, y - bh);
      g.lineTo(dx0 + bw * 0.1, deck - bh * 0.12);
      for (let k = 1; k < 7; k++) {
        const yy = deck - bh * 0.12 - ((deck - bh * 0.12 - (y - bh)) * k) / 7;
        const ww = bw * 0.1 * (1 - k / 7);
        g.moveTo(dx0 - ww, yy);
        g.lineTo(dx0 + ww, yy);
      }
      g.moveTo(x + bw, deck - bh * 0.1);
      g.lineTo(x + bw * 1.45, deck - bh * 0.5);
      g.stroke();
      if (lights) lights.push([x + bw * 1.45, deck - bh * 0.5, 'flame'], [dx0, y - bh, '#ff3020'], [x + bw * 0.2, deck - bh * 0.2, '#ffd8a0']);
    } else if (b.kind === 'stack') {
      g.fillStyle = E.tone('#8a8a84', b.d, 0.2);
      g.fillRect(x, y - bh, bw, bh);
      g.fillStyle = E.tone('#b83a2a', b.d, 0.2);
      for (let k = 0; k < 3; k++) g.fillRect(x, y - bh + k * bh * 0.08, bw, bh * 0.04);
      if (lights) lights.push([x + bw / 2, y - bh - 4 * u * m, hash(b.seed, 3) < 0.5 ? 'flame' : '#ff3020']);
    } else if (b.kind === 'tank') {
      const tg = g.createLinearGradient(x, 0, x + bw, 0);
      const col = E.tone(hash(b.seed, 1) < 0.5 ? '#d8d4c8' : '#a8a49a', b.d, 0.25);
      tg.addColorStop(0, mix(col, E.L.ink, 0.35));
      tg.addColorStop(0.6, col);
      tg.addColorStop(1, mix(col, E.L.ink, 0.2));
      g.fillStyle = tg;
      g.fillRect(x, y - bh, bw, bh);
      g.fillStyle = mix(col, '#ffffff', 0.1);
      g.beginPath();
      g.ellipse(x + bw / 2, y - bh, bw / 2, bw * 0.1, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = hexA(E.L.ink, 0.4);
      g.lineWidth = Math.max(0.5, u * m);
      g.beginPath();
      g.moveTo(x + bw * 0.8, y);
      g.lineTo(x + bw * 0.95, y - bh);
      g.stroke();
      if (lights && hash(b.seed, 2) < 0.5) lights.push([x + bw / 2, y - bh - bw * 0.1, '#ffd8a0']);
    } else {
      // A fjord town's house: a steep roof, a lit window.
      const wall = E.tone(['#c8b8a0', '#a84a3a', '#d8d0c0', '#4a6a7a', '#c89a4a'][b.seed % 5], b.d, 0.25);
      g.fillStyle = wall;
      g.fillRect(x, y - bh * 0.6, bw, bh * 0.6);
      g.fillStyle = E.tone('#2a2e30', b.d);
      g.beginPath();
      g.moveTo(x - bw * 0.08, y - bh * 0.6);
      g.lineTo(x + bw / 2, y - bh);
      g.lineTo(x + bw * 1.08, y - bh * 0.6);
      g.fill();
      const on = hash(b.seed, 4) < b.lit * (0.3 + E.L.night * 0.7) * (w.evac > 0.5 ? 0.2 : 1);
      g.fillStyle = on ? hexA('#ffd8a0', 0.9) : hexA(E.L.ink, 0.6);
      g.fillRect(x + bw * 0.3, y - bh * 0.45, bw * 0.15, bh * 0.15);
      g.fillRect(x + bw * 0.6, y - bh * 0.45, bw * 0.15, bh * 0.15);
    }
  }

  function drawBridge(g: CanvasRenderingContext2D, lights: [number, number, string][]) {
    const d = w.bridgeD;
    const m = w.mOf(d);
    const y = w.yOf(d);
    const x0 = w.bridgeX0;
    const x1 = w.bridgeX1;
    const L = x1 - x0;
    const deckY = y - 70 * u * m;
    const tw = [x0 + L * 0.22, x1 - L * 0.22];
    const top = y - 300 * u * m;
    const steel = E.tone('#8a4a3a', d, 0.25);
    const deck = E.tone('#4a4e52', d, 0.1);
    const broken = w.bridgeBroken > 0;
    const gap0 = x0 + L * 0.4;
    const gap1 = x0 + L * 0.6;
    // Towers.
    for (const tx of tw) {
      g.fillStyle = steel;
      g.fillRect(tx - 5 * u * m, top, 4 * u * m, y - top);
      g.fillRect(tx + 2 * u * m, top, 4 * u * m, y - top);
      g.fillRect(tx - 5 * u * m, top + 20 * u * m, 11 * u * m, 4 * u * m);
      g.fillRect(tx - 5 * u * m, deckY - 30 * u * m, 11 * u * m, 4 * u * m);
      lights.push([tx, top - 2 * u * m, '#ff3020']);
    }
    // The main cable: anchor, tower, a sag between, tower, anchor; suspenders down to the deck.
    const cable = (x: number) => {
      if (x < tw[0]) return deckY - ((x - x0) / (tw[0] - x0)) * (deckY - top);
      if (x > tw[1]) return deckY - ((x1 - x) / (x1 - tw[1])) * (deckY - top);
      const q = (x - tw[0]) / (tw[1] - tw[0]);
      return top + (1 - (2 * q - 1) ** 2) * (deckY - top) * 0.82;
    };
    g.strokeStyle = steel;
    g.lineWidth = Math.max(0.6, 2 * u * m);
    g.beginPath();
    for (let x = x0; x <= x1; x += 4) {
      if (broken && x > gap0 && x < gap1) {
        g.lineTo(gap0, cable(gap0) + 40 * u * m);
        x = gap1;
        g.moveTo(gap1, cable(gap1) + 40 * u * m);
      }
      if (x === x0) g.moveTo(x, cable(x));
      else g.lineTo(x, cable(x));
    }
    g.stroke();
    g.lineWidth = Math.max(0.4, 0.7 * u * m);
    g.beginPath();
    for (let x = x0 + 8 * u * m; x < x1; x += 9 * u * m) {
      if (broken && x > gap0 && x < gap1) continue;
      g.moveTo(x, cable(x));
      g.lineTo(x, deckY);
    }
    g.stroke();
    // The deck, its piers at the ends.
    g.fillStyle = deck;
    if (broken) {
      g.fillRect(x0, deckY, gap0 - x0, 8 * u * m);
      g.fillRect(gap1, deckY, x1 - gap1, 8 * u * m);
      g.save();
      g.translate(gap0, deckY);
      g.rotate(0.6);
      g.fillRect(0, 0, 60 * u * m, 7 * u * m);
      g.restore();
    } else g.fillRect(x0, deckY, L, 8 * u * m);
    g.fillStyle = E.tone('#3a3e40', d);
    g.fillRect(x0 - 6 * u * m, deckY, 12 * u * m, y - deckY);
  }

  /** Bake the bands that need it: all on the first frame, then one a frame. */
  function city(all: boolean) {
    let n = all ? 99 : 1;
    for (let k = BANDS.length - 2; k >= 0 && n > 0; k--) {
      if (!bands[k].canvas || bands[k].key !== bandKey(k)) {
        bake(k);
        n--;
      }
    }
  }
  function drawBand(k: number, t: number) {
    const B = bands[k];
    if (!B.canvas) return;
    c.drawImage(B.canvas, B.x, B.y, B.w, B.h);
    // What moves in it: falling buildings, the lights (blinking reds), cars on the bridge, the lighthouse.
    for (const b of w.buildings) if (inBand(b.d, k) && b.fall > 0 && b.fall < 1) drawBuilding(c, b, null, false, b.fall);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const [lx, ly, col] of B.lights) {
      if (col === 'flame') {
        const fl = 0.75 + 0.25 * Math.sin(t * 9 + lx) * Math.sin(t * 5.3 + ly);
        const r = 14 * u * (0.5 + w.mOf((BANDS[k] + BANDS[k + 1]) / 2));
        E.glow(lx, ly - r * 0.4, r * 2.2 * fl, '#ff7a20', 0.55);
        E.glow(lx, ly - r * 0.3, r * 0.7 * fl, '#ffe0a0', 0.9);
        continue;
      }
      const red = col === '#ff3020';
      const a = red ? (Math.sin(t * 2 + lx * 0.01) > 0.3 ? 0.9 : 0.15) : (0.5 + E.L.night * 0.5) * (1 - w.evac * 0.5);
      E.glow(lx, ly, (red ? 6 : 9) * u * (0.5 + w.mOf((BANDS[k] + BANDS[k + 1]) / 2)), col, a);
    }
    if (inBand(w.bridgeD, k)) {
      const d = w.bridgeD;
      const m = w.mOf(d);
      const deckY = w.yOf(d) - 70 * u * m;
      const L = w.bridgeX1 - w.bridgeX0;
      for (let q = 0; q < 14; q++) {
        const dir = q % 2 ? 1 : -1;
        const ph = ((t * 0.02 * (0.7 + hash(q, 1) * 0.6) * dir + hash(q, 2)) % 1 + 1) % 1;
        const x = w.bridgeX0 + ph * L;
        if (w.bridgeBroken > 0 && ph > 0.36 && ph < 0.64) continue;
        if (w.evac > 0.6 && dir < 0) continue;
        E.glow(x, deckY - 1 * u * m, 4 * u * m + 1, dir > 0 ? '#fff4d0' : '#ff4030', 0.8);
      }
    }
    if (inBand(w.bridgeD + 0.02, k) && E.L.night + w.storm * 0.5 > 0.3) {
      const dd = w.bridgeD + 0.02;
      const m = w.mOf(dd);
      const lx = w.bridgeX0 - 74 * u * m;
      const ly = w.yOf(dd) - 132 * u * m;
      const a = t * 0.8;
      const reach = Math.cos(a) * 260 * u * m;
      c.fillStyle = hexA('#fff4d0', 0.12 * Math.abs(Math.sin(a)) + 0.05);
      c.beginPath();
      c.moveTo(lx, ly);
      c.lineTo(lx + reach, ly - 12 * u * m);
      c.lineTo(lx + reach, ly + 12 * u * m);
      c.fill();
      E.glow(lx, ly, 12 * u * m, '#fff4d0', 0.9);
    }
    c.restore();
  }

  return { sky, sea, city, drawBand, rows, wave };
}
