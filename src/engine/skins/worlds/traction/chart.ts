/**
 * Traction, as the navigator's survey chart (view=map): the same hunt, plotted from above on the
 * chart table of the city's bridge.
 *
 * Cream drafting paper, foxed at the edges, with a survey grid that slides past as the city goes
 * (columns lettered, rows numbered). The plain in contours and a wash of relief; low ground
 * stippled as mire, salt or snow; old shell craters; the ruins of the ancients as surveyor's
 * pictograms; the ridge hachured across the chart; along the top, the shield-wall drawn as a
 * fortification line under the hachured mountains, with the static towns behind it.
 *
 * On it, in ink and wash: the city in plan (its hull, its nested tiers, its crown, its tracks, its
 * jaws, its chimneys smoking), tread marks as dashed double lines, towns as plan symbols with their
 * names hand-lettered and an arrow for their course, airships with their shadows, the sky harbour,
 * craters and wrecks, fires, rockets and shell arcs; the hunt as a red pursuit line with range
 * rings; searchlight cones at night; rain hatching in a front; notes pencilled where things
 * happened, the story's beats in red. At night, the chart lies under the lamp.
 */
import { cityPlan, hsh, TOWN_KIND_NAMES } from './design';
import { clamp01, hexA, mk, type Env } from './light';
import { vnoise } from './ground';
import { ruinsIn } from './ruins';
import type { City, Town, TractionWorld } from './types';

const PAPER = '#e9dfc6';
const INK = '#3a2a1c';
const RED = '#a8321e';
const BLUE = '#4a6a86';
const GREEN = '#6a7a4a';
const PENCIL = '#6a5a48';
const serif = (px: number, italic = false, weight = '') => `${weight ? `${weight} ` : ''}${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;

export function createChart(world: TractionWorld, seed: number) {
  const { u } = world;
  const city = world.city;
  let relief: HTMLCanvasElement | null = null;
  let paperTex: HTMLCanvasElement | null = null;
  let reliefW = 0;
  let builtFor = '';

  // ---- the chart's frame ---------------------------------------------------------------------------
  let W = 0;
  let H = 0;
  let S = 1;
  let top = 0;
  let bot = 0;
  const X = (gx: number) => W / 2 + (gx - world.scroll) * S;
  const Y = (d: number) => bot - ((d + 0.02) / 1.02) * (bot - top);
  const dOf = (y: number) => ((bot - y) / (bot - top)) * 1.02 - 0.02;
  /** Pixels per unit of depth on the chart, and ground units of depth that makes (to keep shapes square). */
  const dPx = () => (bot - top) / 1.02;
  function frame(w: number, h: number) {
    W = w;
    H = h;
    const phone = w < h;
    S = (w * (phone ? 0.62 : 0.46)) / city.len;
    top = h * (phone ? 0.2 : 0.2);
    bot = h * (phone ? 0.88 : 0.9);
  }

  // ---- the paper and the relief, baked -------------------------------------------------------------------
  function bake() {
    builtFor = `${W}x${H}`;
    // Paper: fibres, foxing, the stains of a long hunt.
    paperTex = mk(W, H);
    const p = paperTex.getContext('2d')!;
    p.fillStyle = PAPER;
    p.fillRect(0, 0, W, H);
    const img = p.getImageData(0, 0, W, H);
    for (let i = 0; i < W * H; i++) {
      const x = i % W;
      const y = (i / W) | 0;
      const n = (vnoise(x / 3, y / 3, seed + 50) - 0.5) * 10 + (vnoise(x / 60, y / 60, seed + 51) - 0.5) * 14;
      img.data[i * 4] += n;
      img.data[i * 4 + 1] += n;
      img.data[i * 4 + 2] += n * 0.9;
    }
    p.putImageData(img, 0, 0);
    for (let k = 0; k < 14; k++) {
      const x = hsh(seed, k) * W;
      const y = hsh(k, seed) * H;
      const r = (20 + hsh(seed + 1, k) * 80) * (W / 1280);
      const g = p.createRadialGradient(x, y, r * 0.6, x, y, r);
      g.addColorStop(0, 'rgba(150,110,60,0)');
      g.addColorStop(0.85, 'rgba(150,110,60,0.12)');
      g.addColorStop(1, 'rgba(150,110,60,0)');
      p.fillStyle = g;
      p.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const vg = p.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(120,80,40,0)');
    vg.addColorStop(1, 'rgba(120,80,40,0.35)');
    p.fillStyle = vg;
    p.fillRect(0, 0, W, H);
    // The relief: contours and a wash, periodic across three chart-widths.
    reliefW = Math.round(W * 3);
    const res = 0.5;
    const rw = Math.ceil(reliefW * res);
    const rh = Math.ceil((bot - top + 40) * res);
    relief = mk(rw, rh);
    const r = relief.getContext('2d')!;
    const data = r.createImageData(rw, rh);
    const hgt = new Float32Array(rw * rh);
    const per = (sc: number) => Math.max(1, Math.round(rw / sc));
    for (let j = 0; j < rh; j++)
      for (let i = 0; i < rw; i++) {
        let v = 0;
        let a = 1;
        let sc = 170;
        for (let o = 0; o < 3; o++) {
          v += (vnoise(i / sc, j / sc + o * 17, seed + 60 + o, per(sc)) - 0.5) * a;
          a *= 0.5;
          sc /= 2.1;
        }
        hgt[j * rw + i] = v;
      }
    const land = world.land;
    const lowC = land === 'salt' ? [236, 230, 214] : land === 'snow' ? [240, 240, 236] : land === 'steppe' ? [214, 204, 160] : [196, 176, 140];
    for (let j = 0; j < rh; j++)
      for (let i = 0; i < rw; i++) {
        const h = hgt[j * rw + i];
        const hr = hgt[j * rw + ((i + 1) % rw)];
        const hd = hgt[Math.min(rh - 1, j + 1) * rw + i];
        const shade = (h - hr) * 6 + (h - hd) * 4;
        const o = (j * rw + i) * 4;
        const low = clamp01(-h * 3);
        // A wash: the low ground darker and the colour of what lies there; the slopes shaded from the north-west.
        data.data[o] = lowC[0] - low * 30 + shade * 120;
        data.data[o + 1] = lowC[1] - low * 26 + shade * 120;
        data.data[o + 2] = lowC[2] - low * 20 + shade * 110;
        data.data[o + 3] = 70 + low * 50;
        // Contours.
        const step = 0.07;
        const c0 = Math.floor(h / step);
        if (c0 !== Math.floor(hr / step) || c0 !== Math.floor(hd / step)) {
          const index = c0 % 5 === 0;
          data.data[o] = 120;
          data.data[o + 1] = 84;
          data.data[o + 2] = 50;
          data.data[o + 3] = index ? 150 : 60;
        }
      }
    r.putImageData(data, 0, 0);
    // Marks for low ground: mire dashes, salt stipple, snow left white; tussocks on the steppe.
    r.strokeStyle = land === 'salt' ? 'rgba(140,130,110,0.5)' : 'rgba(74,106,134,0.55)';
    r.lineWidth = 0.6;
    for (let k = 0; k < rw * rh * 0.004; k++) {
      const i = Math.floor(hsh(seed + 70, k) * rw);
      const j = Math.floor(hsh(k, seed + 70) * rh);
      const h = hgt[j * rw + i];
      if (land === 'steppe') {
        if (h < -0.02) continue;
        r.strokeStyle = 'rgba(106,122,74,0.6)';
        r.beginPath();
        r.moveTo(i - 1.5, j);
        r.lineTo(i - 0.5, j - 2);
        r.moveTo(i, j);
        r.lineTo(i, j - 2.6);
        r.moveTo(i + 1.5, j);
        r.lineTo(i + 0.5, j - 2);
        r.stroke();
        continue;
      }
      if (h > -0.08) continue;
      r.beginPath();
      if (land === 'salt') r.arc(i, j, 0.5, 0, Math.PI * 2);
      else {
        r.moveTo(i - 2, j);
        r.lineTo(i + 2, j);
      }
      r.stroke();
    }
  }

  // ---- the furniture ------------------------------------------------------------------------------------
  function grid(c: CanvasRenderingContext2D) {
    const cell = 140 * (W / 1280) / S;
    const i0 = Math.floor((world.scroll - W / 2 / S) / cell);
    const i1 = Math.ceil((world.scroll + W / 2 / S) / cell);
    c.strokeStyle = hexA(BLUE, 0.22);
    c.lineWidth = 1;
    c.font = serif(10, false, '600');
    c.fillStyle = hexA(BLUE, 0.7);
    c.textAlign = 'center';
    for (let i = i0; i <= i1; i++) {
      const x = Math.round(X(i * cell)) + 0.5;
      c.beginPath();
      c.moveTo(x, top - 10);
      c.lineTo(x, H);
      c.stroke();
      const letter = String.fromCharCode(65 + (((i % 26) + 26) % 26));
      c.fillText(`${letter}${Math.floor(i / 26) + 40}`, X((i + 0.5) * cell), H - 6);
    }
    const rows = 6;
    c.textAlign = 'left';
    for (let k = 0; k <= rows; k++) {
      const y = Math.round(top + ((bot - top) * k) / rows) + 0.5;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(W, y);
      c.stroke();
      if (k < rows) c.fillText(String(k + 1), 6, y + ((bot - top) / rows) / 2 + 3);
    }
  }
  function wall(c: CanvasRenderingContext2D, E: Env) {
    // Mountains hachured above, the wall's line with its bastions, the static towns behind.
    const y = top - 6;
    const off = world.scroll * S * 0.15;
    c.strokeStyle = hexA(INK, 0.55);
    c.lineWidth = 0.8;
    for (let x = -((off % 9) + 9); x < W + 9; x += 9) {
      const gx = x + off;
      const hgt = (18 + vnoise(gx / 70, 3, seed + 80) * 40 + vnoise(gx / 20, 4, seed + 81) * 12) * (H / 900);
      c.beginPath();
      c.moveTo(x, y - 12);
      c.lineTo(x + 4, y - 12 - hgt);
      c.lineTo(x + 8, y - 12);
      c.stroke();
      if (vnoise(gx / 70, 3, seed + 80) > 0.6) {
        c.beginPath();
        c.moveTo(x + 2.5, y - 12 - hgt * 0.7);
        c.lineTo(x + 4, y - 12 - hgt);
        c.lineTo(x + 5.5, y - 12 - hgt * 0.7);
        c.stroke();
      }
    }
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(W, y);
    c.stroke();
    c.lineWidth = 1;
    for (let x = -((off % 14) + 14); x < W + 14; x += 14) {
      c.strokeRect(x, y - 4, 5, 4);
    }
    for (let x = -((off % 120) + 120); x < W + 120; x += 120) {
      const gx = Math.round((x + off) / 120);
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(x - 7, y);
      c.lineTo(x, y - 9);
      c.lineTo(x + 7, y);
      c.lineTo(x, y + 6);
      c.fill();
      if (hsh(gx, seed) < 0.4) {
        // A static town: a cluster of squares and a temple dot.
        c.fillStyle = hexA(RED, 0.7);
        for (let k = 0; k < 5; k++) c.fillRect(x + 20 + hsh(gx, k) * 30, y - 18 - hsh(k, gx) * 14, 3, 3);
      }
    }
    const lit = world.bulwark.k;
    if (lit > 0.05) {
      c.fillStyle = hexA('#ff7a30', lit);
      for (let k = 0; k < 4; k++) c.fillRect(W * (0.2 + k * 0.2), y - 3, 6, 3);
    }
    c.font = serif(Math.round(11 * (H / 900) + 3), true);
    c.fillStyle = hexA(INK, 0.85);
    c.textAlign = 'center';
    c.letterSpacing = '3px';
    c.fillText(W < 600 ? 'THE SHIELD-WALL' : 'THE SHIELD-WALL OF THE STATIC TOWNS', W < 600 ? W / 2 : W * 0.62, y + 18);
    c.letterSpacing = '0px';
    void E;
  }
  function ridge(c: CanvasRenderingContext2D) {
    const y0 = Y(world.ridgeD);
    c.strokeStyle = hexA(INK, 0.6);
    c.lineWidth = 0.8;
    const step = 6;
    const off = (world.scroll * S) % step;
    for (let x = -off; x < W; x += step) {
      const gx = world.scroll + (x - W / 2) / S;
      const yy = y0 + Math.sin(gx * 0.002 + seed) * 10 * (H / 900) + Math.sin(gx * 0.0007) * 16 * (H / 900);
      const len = 6 + vnoise(gx / 200, 1, seed + 90) * 8;
      c.beginPath();
      c.moveTo(x, yy);
      c.lineTo(x + 1.5, yy + len);
      c.stroke();
    }
    c.font = serif(11, true);
    c.fillStyle = hexA(INK, 0.7);
    c.textAlign = 'left';
    c.fillText('the ridge', 12, y0 - 6);
  }
  function cartouche(c: CanvasRenderingContext2D, phone: boolean) {
    const name = city.name;
    const t1 = `A SURVEY OF ${world.region}`;
    c.font = serif(phone ? 14 : 17, false, '600');
    c.letterSpacing = '2px';
    const w1 = c.measureText(t1).width;
    c.letterSpacing = '0px';
    const w = Math.min(W - 28, Math.max(w1, 200) + 40);
    const h = phone ? 50 : 56;
    const x = 14;
    const y = 12;
    c.fillStyle = hexA('#f3ecd8', 0.92);
    c.fillRect(x, y, w, h);
    c.strokeStyle = INK;
    c.lineWidth = 1.5;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.lineWidth = 0.6;
    c.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.letterSpacing = '2px';
    c.fillText(t1, x + w / 2, y + (phone ? 24 : 27), w - 20);
    c.letterSpacing = '0px';
    c.font = serif(phone ? 11 : 12, true);
    c.fillStyle = hexA(INK, 0.8);
    c.fillText(`kept on the bridge of ${name.charAt(0)}${name.slice(1).toLowerCase()} · the chart moves with her`, x + w / 2, y + (phone ? 41 : 45), w - 20);
    return [x, y, w, h] as const;
  }
  function compass(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    c.strokeStyle = INK;
    c.fillStyle = INK;
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x, y, r * 0.8, 0, Math.PI * 2);
    c.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
      const long = k % 2 === 0;
      const l = r * (long ? 1.1 : 0.6);
      c.beginPath();
      c.moveTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      c.lineTo(x + Math.cos(a + 0.25) * r * 0.15, y + Math.sin(a + 0.25) * r * 0.15);
      c.lineTo(x + Math.cos(a - 0.25) * r * 0.15, y + Math.sin(a - 0.25) * r * 0.15);
      c.closePath();
      if (k === 0) {
        c.fillStyle = RED;
        c.fill();
        c.fillStyle = INK;
      } else if (long) c.fill();
      else c.stroke();
    }
    c.font = serif(10, false, '600');
    c.textAlign = 'center';
    c.fillText('N', x, y - r * 1.25);
    // A scale bar: a league.
    const lg = 1200 * u * S;
    c.lineWidth = 1;
    const bx = x - lg / 2;
    const by = y + r * 1.7;
    for (let k = 0; k < 4; k++) {
      c.fillStyle = k % 2 ? PAPER : INK;
      c.fillRect(bx + (k * lg) / 4, by, lg / 4, 3);
    }
    c.strokeRect(bx, by, lg, 3);
    c.font = serif(9, true);
    c.fillStyle = INK;
    c.fillText('one league', x, by + 13);
  }

  // ---- what moves on it -------------------------------------------------------------------------------------
  /** The city in plan: hull, tracks either side, tiers nested inside, the crown, the jaws, chimneys. */
  function cityPlanView(c: CanvasRenderingContext2D, cc: City, E: Env, rival: boolean) {
    const P = cityPlan(cc.seed, cc.tiers, cc.top, cc.tracks);
    const L = cc.len * S;
    const Wd = L * 0.26;
    const cx = X(cc.gx);
    const cy = Y(cc.d);
    c.save();
    c.translate(cx, cy);
    c.scale(cc.dir, 1);
    const k = L / 1000;
    // Tracks, either side.
    c.fillStyle = hexA(INK, 0.75);
    for (const b of P.bogies) for (const s of [-1, 1]) {
      c.fillRect(b.x * k - (b.len * k) / 2, s > 0 ? Wd * 0.3 : -Wd * 0.46, b.len * k, Wd * 0.16);
    }
    c.strokeStyle = hexA(PAPER, 0.6);
    c.lineWidth = 0.6;
    const off = ((cc.tread * S) % 4) * cc.dir;
    for (const b of P.bogies) for (const s of [-1, 1]) {
      for (let x = b.x * k - (b.len * k) / 2 + off; x < b.x * k + (b.len * k) / 2; x += 4) {
        c.beginPath();
        c.moveTo(x, s > 0 ? Wd * 0.3 : -Wd * 0.46);
        c.lineTo(x, s > 0 ? Wd * 0.46 : -Wd * 0.3);
        c.stroke();
      }
    }
    // The hull: a long plate, squared at the jaws.
    const wash = rival ? '#b08a7a' : '#a89a80';
    c.fillStyle = hexA(wash, 0.85);
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-L / 2, -Wd * 0.32);
    c.lineTo(P.jawX * k, -Wd * 0.38);
    c.lineTo(L / 2 - 4, -Wd * 0.2 - cc.jaw * Wd * 0.12);
    c.lineTo(L / 2 - 4, Wd * 0.2 + cc.jaw * Wd * 0.12);
    c.lineTo(P.jawX * k, Wd * 0.38);
    c.lineTo(-L / 2, Wd * 0.32);
    c.closePath();
    c.fill();
    c.stroke();
    // Tiers nested, each a little lighter; the decks' edges inked.
    for (const t of P.tiers) {
      const q = (t.i + 1) / (P.tiers.length + 1);
      const ww = Wd * (0.6 - q * 0.38);
      c.fillStyle = hexA(t.kind === 'gardens' ? '#8a9a6a' : t.kind === 'works' ? '#8a6a52' : '#c8b896', 0.75);
      c.fillRect(t.x0 * k, -ww / 2, (t.x1 - t.x0) * k, ww);
      c.lineWidth = 0.7;
      c.strokeRect(t.x0 * k, -ww / 2, (t.x1 - t.x0) * k, ww);
      // Streets: a hatch of blocks.
      c.strokeStyle = hexA(INK, 0.25);
      c.beginPath();
      for (let x = t.x0 * k + 4; x < t.x1 * k; x += 6) {
        c.moveTo(x, -ww / 2);
        c.lineTo(x, ww / 2);
      }
      c.stroke();
      c.strokeStyle = INK;
    }
    // The crown: a cross in a circle.
    const C = P.crown;
    c.fillStyle = hexA(RED, 0.8);
    c.beginPath();
    c.arc(C.x * k, 0, Math.max(3, Wd * 0.08), 0, Math.PI * 2);
    c.fill();
    // Chimneys, with their smoke trailing.
    for (const [x] of P.chimneys.slice(0, Math.min(cc.chimneys, P.chimneys.length))) {
      const y = (hsh(x, cc.seed) - 0.5) * Wd * 0.5;
      c.fillStyle = INK;
      c.beginPath();
      c.arc(x * k, y, 1.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = hexA('#5a5048', 0.12);
      for (let q = 1; q < 6; q++) {
        c.beginPath();
        c.arc(x * k - q * 7, y - q * 2 + Math.sin(E.t + q + x) * 2, 2 + q * 1.6, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Scars and fires.
    for (const s of cc.scars) {
      c.strokeStyle = hexA('#2a1a10', 0.7);
      c.lineWidth = 0.8;
      const sx0 = s.lx * k;
      const sy0 = (hsh(s.lx, s.ly) - 0.5) * Wd * 0.4;
      c.beginPath();
      for (let q = 0; q < 6; q++) {
        c.moveTo(sx0 - 3 + q * 1.2, sy0 - 3);
        c.lineTo(sx0 - 6 + q * 1.2, sy0 + 3);
      }
      c.stroke();
      c.strokeStyle = INK;
    }
    for (const f of cc.fires) {
      c.fillStyle = hexA('#e0502a', 0.6 + 0.3 * Math.sin(E.t * 8 + f.lx));
      c.beginPath();
      c.arc(f.lx * k, (hsh(f.lx, f.ly) - 0.5) * Wd * 0.4, Math.max(2.5, f.r * k * 0.35), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // The name, lettered along her.
    c.font = serif(Math.max(12, Math.min(22, L * 0.035)), false, '700');
    c.letterSpacing = `${Math.round(L * 0.012)}px`;
    c.textAlign = 'center';
    c.fillStyle = hexA(rival ? RED : INK, 0.9);
    c.fillText(cc.name, cx, cy - Wd * 0.6 - 6);
    c.letterSpacing = '0px';
  }
  function townSym(c: CanvasRenderingContext2D, t: Town, prey: boolean, E: Env) {
    const x = X(t.gx);
    const y = Y(t.d);
    const L = Math.max(10, t.len * S);
    const w = L * 0.36;
    c.save();
    c.translate(x, y);
    c.scale(t.dir, 1);
    c.fillStyle = hexA(prey ? RED : t.kind === 'scav' ? '#6a6058' : GREEN, prey ? 0.55 : 0.45);
    c.strokeStyle = INK;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-L / 2, -w / 2);
    c.lineTo(L / 2 - w * 0.3, -w / 2);
    c.lineTo(L / 2, 0);
    c.lineTo(L / 2 - w * 0.3, w / 2);
    c.lineTo(-L / 2, w / 2);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = hexA(INK, 0.6);
    for (let k = 0; k < 4; k++) c.fillRect(-L * 0.35 + k * L * 0.16, -w * 0.18, L * 0.1, w * 0.36);
    if (t.kind === 'scav') {
      c.strokeStyle = INK;
      for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
        const lx = -L * 0.3 + k * L * 0.3;
        const ph = Math.sin(t.roll * 0.05 + k * 2) * 3;
        c.beginPath();
        c.moveTo(lx, s * w * 0.5);
        c.lineTo(lx + 4 + ph, s * (w * 0.5 + 6));
        c.stroke();
      }
    }
    c.restore();
    // Its course: an arrow as long as a minute's run is far.
    const v = t.vx - (t.state === 'flee' ? 0 : 0);
    if (Math.abs(v) > 1 && t.state !== 'caught' && t.state !== 'broken') {
      const len = Math.min(120, Math.abs(v) * S * 8);
      c.strokeStyle = hexA(prey ? RED : INK, 0.7);
      c.lineWidth = 1;
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(x + Math.sign(v) * L * 0.55, y);
      c.lineTo(x + Math.sign(v) * (L * 0.55 + len), y + t.vd * 60 * dPx() * 0.15);
      c.stroke();
      c.setLineDash([]);
      const ex = x + Math.sign(v) * (L * 0.55 + len);
      c.beginPath();
      c.moveTo(ex, y);
      c.lineTo(ex - Math.sign(v) * 5, y - 3);
      c.lineTo(ex - Math.sign(v) * 5, y + 3);
      c.closePath();
      c.fillStyle = hexA(prey ? RED : INK, 0.7);
      c.fill();
    }
    if (t.state === 'broken') {
      c.strokeStyle = RED;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x - 5, y - 5);
      c.lineTo(x + 5, y + 5);
      c.moveTo(x + 5, y - 5);
      c.lineTo(x - 5, y + 5);
      c.stroke();
    }
    // Its name, hand-lettered beside it.
    c.font = serif(prey ? 13 : 11, true, prey ? '600' : '');
    c.textAlign = 'left';
    c.fillStyle = hexA(prey ? RED : INK, 0.85);
    c.fillText(t.name.charAt(0) + t.name.slice(1).toLowerCase(), x + 4, y - w / 2 - 5);
    if (prey || L > 30) {
      c.font = serif(9);
      c.fillStyle = hexA(PENCIL, 0.8);
      c.fillText(`${TOWN_KIND_NAMES[t.kind].toLowerCase()} · ${t.pop.toLocaleString('en-GB')}`, x + 4, y + w / 2 + 11);
    }
    void E;
  }

  function draw(E: Env, ctx: CanvasRenderingContext2D, w: number, h: number) {
    frame(w, h);
    if (!relief || builtFor !== `${W}x${H}`) bake();
    const phone = W < H;
    ctx.drawImage(paperTex!, 0, 0);
    // The relief, sliding with the city.
    const off = (((world.scroll * S) % reliefW) + reliefW) % reliefW;
    for (let x = -off; x < W; x += reliefW) ctx.drawImage(relief!, x, top - 20, reliefW, bot - top + 40);
    grid(ctx);
    // Craters of the ancients and of this week's shelling.
    ctx.strokeStyle = hexA(INK, 0.5);
    ctx.lineWidth = 0.8;
    const cell = 300;
    for (let i = Math.floor((world.scroll - W / 2 / S) / (cell / S)); i <= Math.ceil((world.scroll + W / 2 / S) / (cell / S)); i++) {
      if (hsh(i, seed + 3) > 0.45) continue;
      const gx = (i + hsh(i, seed + 4)) * (cell / S);
      const d = 0.05 + hsh(seed + 5, i) * 0.9;
      const r = 4 + hsh(i, seed + 6) * 10;
      ctx.beginPath();
      ctx.arc(X(gx), Y(d), r, 0, Math.PI * 2);
      ctx.stroke();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(X(gx) + Math.cos(a) * r, Y(d) + Math.sin(a) * r);
        ctx.lineTo(X(gx) + Math.cos(a) * (r + 3), Y(d) + Math.sin(a) * (r + 3));
        ctx.stroke();
      }
    }
    for (const cr of world.craters) {
      const r = Math.max(5, cr.r * S);
      ctx.fillStyle = hexA('#3a2a1c', 0.25);
      ctx.beginPath();
      ctx.arc(X(cr.gx), Y(cr.d), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexA(RED, 0.7);
      ctx.stroke();
    }
    ridge(ctx);
    wall(ctx, E);
    // The ruins, as surveyor's pictograms.
    for (const lane of [0, 1, 2, 3]) {
      for (const rn of ruinsIn(seed, u, world.scroll - W / 2 / S - 200, world.scroll + W / 2 / S + 200, lane, [city.d - 0.06, city.d + 0.03])) {
        const x = X(rn.gx);
        const y = Y(rn.d);
        ctx.strokeStyle = hexA(INK, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (rn.kind === 'pylon' || rn.kind === 'mast' || rn.kind === 'turbine') {
          ctx.moveTo(x - 4, y + 4);
          ctx.lineTo(x, y - 6);
          ctx.lineTo(x + 4, y + 4);
          ctx.moveTo(x - 3, y);
          ctx.lineTo(x + 3, y);
        } else if (rn.kind === 'wheel') {
          ctx.arc(x, y, 5, Math.PI, 0);
          ctx.moveTo(x, y);
          ctx.lineTo(x - 4, y - 3);
          ctx.moveTo(x, y);
          ctx.lineTo(x + 4, y - 3);
        } else if (rn.kind === 'block' || rn.kind === 'tank') {
          ctx.rect(x - 4, y - 4, 8, 8);
          ctx.moveTo(x - 4, y - 4);
          ctx.lineTo(x + 4, y + 4);
        } else {
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.moveTo(x - 5, y + 5);
          ctx.lineTo(x + 5, y + 5);
        }
        ctx.stroke();
        if (rn.size > 1.25 && !phone) {
          ctx.font = serif(8, true);
          ctx.fillStyle = hexA(PENCIL, 0.75);
          ctx.textAlign = 'center';
          ctx.fillText(`ruin (${rn.kind === 'block' ? 'a tower' : rn.kind === 'wheel' ? 'old town' : 'ancient'})`, x, y + 15);
        }
      }
    }
    for (const rl of world.relics) {
      const x = X(rl.gx);
      const y = Y(rl.d);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 9 + rl.k * 6, 0, Math.PI * 2);
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x + 6, y + 6);
      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x - 6, y + 6);
      ctx.stroke();
      ctx.font = serif(12, true, '600');
      ctx.fillStyle = RED;
      ctx.textAlign = 'center';
      ctx.fillText(rl.name.replace(/^a /, 'A ').replace(/^the /, 'The '), x, y - 20);
    }
    // Tread marks.
    ctx.lineWidth = 0.8;
    for (const tr of world.trails) {
      const isCity = tr.id === city.id;
      for (const s of isCity ? [-1, 1] : [0]) {
        ctx.setLineDash(isCity ? [6, 3] : [2, 3]);
        ctx.strokeStyle = hexA(INK, isCity ? 0.5 : 0.35);
        ctx.beginPath();
        let first = true;
        for (const [gx, d] of tr.pts) {
          const x = X(gx);
          const y = Y(d) + s * city.len * S * 0.3 * 0.5;
          if (first) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          first = false;
        }
        if (isCity) ctx.lineTo(X(city.gx), Y(city.d) + s * city.len * S * 0.15);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // Wrecks.
    for (const wk of world.wrecks) {
      const x = X(wk.gx);
      const y = Y(wk.d);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x - 3, y - 4);
      ctx.lineTo(x - 3, y + 4);
      ctx.moveTo(x + 3, y - 4);
      ctx.lineTo(x + 3, y + 4);
      ctx.stroke();
      ctx.font = serif(9, true);
      ctx.fillStyle = hexA(PENCIL, 0.8);
      ctx.textAlign = 'center';
      ctx.fillText('wreck', x, y + 14);
    }
    // The hunt: a red pursuit line with range rings, from her jaws to the prey.
    const hunt = world.hunt;
    const prey = world.towns.find((q) => q.id === hunt.town);
    if (prey && (hunt.phase === 'sighted' || hunt.phase === 'chase')) {
      const jx = X(city.gx + city.dir * city.len * 0.5);
      const jy = Y(city.d);
      const px = X(prey.gx);
      const py = Y(prey.d);
      ctx.strokeStyle = hexA(RED, 0.85);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const k of [0.25, 0.5, 0.75]) {
        const rx = jx + (px - jx) * k;
        const ry = jy + (py - jy) * k;
        ctx.beginPath();
        ctx.moveTo(rx - 4, ry - 4);
        ctx.lineTo(rx + 4, ry + 4);
        ctx.stroke();
      }
      const rr = 14 + ((E.t * 20) % 30);
      ctx.strokeStyle = hexA(RED, 1 - (rr - 14) / 30);
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.stroke();
      const gap = Math.max(0, city.dir * (prey.gx - city.dir * prey.len * 0.5 - (city.gx + city.dir * city.len * 0.5)));
      ctx.font = serif(12, true, '600');
      ctx.fillStyle = RED;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(gap / u)} yds`, (jx + px) / 2, (jy + py) / 2 - 8);
      if (prey.run === 'ridge') {
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + city.dir * 60, Y(world.ridgeD + 0.03));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Searchlights at night: yellow wash cones from her crown.
    if (city.beams.length && E.night > 0.3) {
      for (const b of city.beams) {
        ctx.fillStyle = hexA('#e8c040', 0.18 * E.night);
        ctx.beginPath();
        ctx.moveTo(X(city.gx), Y(city.d));
        const bx = X(b.gx);
        const by = Y(b.d);
        ctx.lineTo(bx - 18, by - 10);
        ctx.lineTo(bx + 18, by + 10);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Towns, the rival, the city.
    for (const t of world.towns) {
      if (t.state === 'eaten') continue;
      const x = X(t.gx);
      if (x < -60 || x > W + 60 || t.d > 0.99) continue;
      townSym(ctx, t, t.id === hunt.town, E);
    }
    if (world.rival) cityPlanView(ctx, world.rival, E, true);
    cityPlanView(ctx, city, E, false);
    // The air: ships (their shadows on the chart, a line up to them), the harbour.
    for (const s of world.ships) {
      const x = X(s.gx);
      const y = Y(s.d);
      if (x < -80 || x > W + 80) continue;
      const lift = Math.min(60, s.alt * S * 0.25);
      ctx.strokeStyle = hexA(PENCIL, 0.4);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - lift);
      ctx.stroke();
      ctx.fillStyle = hexA(INK, 0.15);
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(5, s.len * S * 0.5), 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const red = s.kind === 'league' || s.kind === 'gunboat';
      ctx.fillStyle = hexA(red ? RED : '#c8b080', 0.85);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(x, y - lift, Math.max(6, s.len * S * 0.5), Math.max(2.5, s.len * S * 0.13), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (s.state === 'fall' || s.fire > 0) {
        ctx.fillStyle = hexA('#e0502a', 0.8);
        ctx.beginPath();
        ctx.arc(x, y - lift, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!phone || red) {
        ctx.font = serif(9, true);
        ctx.fillStyle = hexA(red ? RED : PENCIL, 0.85);
        ctx.textAlign = 'center';
        ctx.fillText(s.name.charAt(0) + s.name.slice(1).toLowerCase(), x, y - lift - 8);
      }
    }
    if (world.harbour) {
      const hb = world.harbour;
      const x = X(hb.gx);
      const y = Y(hb.d) - 40;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.fillStyle = hexA('#c8b080', 0.8);
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
        ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
        ctx.stroke();
      }
      ctx.font = serif(11, true, '600');
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.fillText(`${hb.name.charAt(0)}${hb.name.slice(1).toLowerCase()} (sky harbour)`, x, y - 28);
    }
    // Rockets and shells: dotted arcs; hits as ink stars.
    for (const f of world.fx) {
      const age = world.t - f.t0;
      if (f.kind === 'rocket' || f.kind === 'shell') {
        const to = f.on === city.id ? city : world.rival;
        if (!to) continue;
        const tx = X(to.gx + to.dir * f.vx * (to.len / 1000));
        const ty = Y(to.d);
        const fx0 = X(f.gx);
        const fy0 = Y(f.d) - (f.kind === 'rocket' ? 30 : 0);
        const q = Math.min(1, age / f.dur);
        ctx.strokeStyle = hexA(RED, 0.7);
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.quadraticCurveTo((fx0 + tx) / 2, Math.min(fy0, ty) - 40, fx0 + (tx - fx0) * q, fy0 + (ty - fy0) * q - Math.sin(q * Math.PI) * 20);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (f.kind === 'flash' && !f.on && age < 1) {
        const x = X(f.gx);
        const y = Y(f.d);
        ctx.strokeStyle = hexA(RED, 1 - age);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
          ctx.lineTo(x + Math.cos(a) * (8 + age * 10), y + Math.sin(a) * (8 + age * 10));
        }
        ctx.stroke();
      }
    }
    // Rain hatching in a front.
    if (world.rain > 0.05) {
      ctx.strokeStyle = hexA(BLUE, 0.35 * world.rain);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      const off2 = (E.t * 30) % 14;
      for (let x = -H; x < W; x += 14) {
        ctx.moveTo(x + off2, top);
        ctx.lineTo(x + off2 + (bot - top) * 0.4, bot);
      }
      ctx.stroke();
    }
    // Notes pencilled where things happened; the beats in red ink.
    const cw = city.len * S;
    const placed: [number, number, number][] = [-3, -2, -1, 0, 1, 2, 3].map((k) => [X(city.gx), Y(city.d) + k * cw * 0.045, cw * 1.05] as [number, number, number]);
    ctx.textAlign = 'center';
    for (const l of [...world.labels].reverse()) {
      const age = world.t - l.t0;
      if (age > 26) continue;
      const beat = world.beats.some((b) => b.text === l.text);
      const x = Math.max(80, Math.min(W - 80, X(l.gx)));
      let y = Math.max(top + 30, Math.min(bot - 10, Y(Math.min(0.98, l.d)) - 30));
      ctx.font = serif(beat ? 13 : 11, true, beat ? '600' : '');
      const w = Math.min(ctx.measureText(l.text).width, W * 0.5);
      for (let k = 0; k < 6 && placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + w) / 2 + 10 && Math.abs(qy - y) < 18); k++) y += 18;
      if (placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + w) / 2 + 10 && Math.abs(qy - y) < 18)) continue;
      placed.push([x, y, w]);
      const a = Math.min(1, age * 2) * clamp01((26 - age) / 6);
      ctx.fillStyle = hexA(PAPER, 0.75 * a);
      ctx.fillRect(x - w / 2 - 4, y - 12, w + 8, 16);
      ctx.fillStyle = hexA(beat ? RED : PENCIL, a);
      ctx.fillText(l.text, x, y, W * 0.5);
      if (phone && placed.length >= 2) break;
    }
    // The furniture over it all.
    cartouche(ctx, phone);
    if (!phone) compass(ctx, W - 70, H - 90, 30);
    // At night the chart lies under the bridge's lamp.
    if (E.night > 0.05) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.55, Math.min(W, H) * 0.15, W * 0.5, H * 0.55, Math.hypot(W, H) * 0.65);
      g.addColorStop(0, `rgba(255,190,110,${(0.06 * E.night).toFixed(3)})`);
      g.addColorStop(1, `rgba(30,18,8,${(0.6 * E.night).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** From a point on the chart (screen px) back to the scene's world coordinates (for a touch). */
  const unproject = (x: number, y: number): [number, number] => {
    const gx = world.scroll + (x - W / 2) / S;
    const d = Math.max(0.02, Math.min(0.97, dOf(y)));
    if (y < top) return [world.sx(gx, d), world.HY - 50];
    return [world.sx(gx, d), world.yOf(d)];
  };
  const project = (wx: number, wy: number): [number, number] => {
    const d = 1 - Math.sqrt(Math.max(0, (wy - world.HY) / (world.NY - world.HY)));
    const gx = world.scroll + (wx - world.GW / 2) / world.mOf(d);
    return [X(gx), Y(d)];
  };
  return { draw, unproject, project };
}
