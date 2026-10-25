/**
 * Traction, painted: the hunting ground from alongside the great city, like a matte painting
 * that moves.
 *
 * Back to front: the sky (sun or moon, stars, clouds, the smoke of the city drifting in it); the
 * far mountains with the shield-wall at their feet and the static towns behind it; the mud of the
 * plain (./ground), sliding past in perspective, and the tread marks over it; then everything on
 * the plain by its depth: ruins, relics, wrecks, towns, the rival, airships and the sky harbour,
 * crows, fx; the ridge between the far plain and the near (a town over it is out of sight); the
 * great city itself (./city) with the town in its jaws, its smoke and the mud off its tracks; the
 * light pass (fires, gun flashes, searchlights, sparks); rain and lightning; the grade; call-outs,
 * name tags with the radio, and the HUD with its chronicle.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash, typed } from '../../instruments/kit';
import { drawFlock, drawHarbour, drawShip } from './air';
import { bakeCity, chimneyTops, cityFires, drawCity, lampsOf, retintCity, type CityArt } from './city';
import { cityPlan, TOWN_KIND_NAMES } from './design';
import { createChart } from './chart';
import { createGround, type Ground } from './ground';
import { clamp01, createEnv, drift, goldenOf, hexA, mix, mk, MOODS, posmod, sprite, tintSprite, type Sprite } from './light';
import { drawRelic, drawRuin, ruinsIn } from './ruins';
import { createTraction } from './sim';
import { drawTown, townArt, type TownArt } from './towns';
import type { City, Fx, Town, TractionWorld } from './types';

export type TractionPaintOptions = { view: string; traffic: number; camera: string; labels: boolean; hud: boolean };

const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;

type Cloud = { s: Sprite; f: number; x: number; y: number; w: number; h: number; v: number };

export function mountTraction(host: SkinHost, o: TractionPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: TractionWorld = createTraction(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera });
  const { GW, GH, u, HY, NY } = world;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.3, closer: 1.9, maxZoom: 2.6 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const E = createEnv(ctx, u, world.mood);
  const lr = host.fork('traction-look');
  const lookSeed = Math.floor(lr() * 1e6);
  const stars = Array.from({ length: 240 }, () => [lr(), lr(), lr()] as [number, number, number]);
  let grain: HTMLCanvasElement | null = null;
  let ground: Ground | null = null;
  let cityArt: CityArt | null = null;
  let rivalArt: CityArt | null = null;
  const towns = new Map<number, TownArt>();
  const clouds: Cloud[] = [];
  const city = world.city;
  const { sx, yOf, mOf } = world;
  const kOf = (c: City) => (c.len * mOf(c.d)) / 1000;
  const cityRes = Math.min(1.6, Math.max(0.9, 1.25 * (kOf(city) < 0.6 ? 1.3 : 1))) * kOf(city);

  function setup() {
    ground = createGround(world, lookSeed);
    cityArt = bakeCity(city, cityRes);
    retintCity(E, cityArt, city.d, true, world.sunSide * city.dir);
    tintSprite(E, ground.pan, 0.8);
    // Clouds: soft heaps, baked grey, tinted by the hour.
    for (let k = 0; k < 8; k++) {
      const w = (380 + lr() * 620) * u;
      const h = w * (0.2 + lr() * 0.1);
      const res = 0.3;
      const s = sprite(w * res, h * res, 0, 0, res, false, false);
      const g = s.g;
      const n = 30 + Math.floor(lr() * 20);
      for (let q = 0; q < n; q++) {
        const px = w * (0.05 + lr() * 0.9);
        const e = Math.max(0.15, 1 - Math.abs(px / w - 0.5) * 1.8);
        const rr = h * (0.12 + lr() * 0.22) * Math.sqrt(e);
        const py = h * 0.8 - rr * (0.3 + lr() * 0.8) * (0.4 + e);
        const gr = g.createRadialGradient(px - rr * 0.2, py - rr * 0.35, rr * 0.05, px, py, rr);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)');
        gr.addColorStop(0.6, 'rgba(225,225,225,0.6)');
        gr.addColorStop(1, 'rgba(200,200,200,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(px, py, rr * 1.6, rr, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = 'source-atop';
      const bg = g.createLinearGradient(0, h * 0.4, 0, h);
      bg.addColorStop(0, 'rgba(150,150,150,0)');
      bg.addColorStop(1, 'rgba(120,120,128,0.8)');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      clouds.push({ s, f: 0.03 + lr() * 0.08, x: lr() * GW * 2, y: HY * (0.06 + lr() * 0.6), w, h, v: (2 + lr() * 5) * u });
    }
  }
  function tintCloud(c: Cloud) {
    const t = c.s.tint.getContext('2d')!;
    const w = c.s.tint.width;
    const h = c.s.tint.height;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, w, h);
    t.drawImage(c.s.base, 0, 0);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = mix(E.L.cloud, '#ffffff', 0.15 * (1 - E.night));
    t.fillRect(0, 0, w, h);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(c.s.base, 0, 0);
    t.globalCompositeOperation = 'source-atop';
    const lg = t.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, hexA(E.L.sun, 0.25 + goldenOf(E.day) * 0.35));
    lg.addColorStop(0.55, hexA(E.L.sun, 0));
    t.fillStyle = lg;
    t.fillRect(0, 0, w, h);
    t.globalCompositeOperation = 'source-over';
    c.s.at = { day: E.day, rain: E.rain, d: 0 };
  }

  // ---- placing things ------------------------------------------------------------------------------
  const cityXY = (c: City): [number, number, number] => [sx(c.gx, c.d), yOf(c.d), kOf(c)];
  const townXY = (t: Town): [number, number, number] => [sx(t.gx, t.d), yOf(t.d), (t.len * mOf(t.d)) / 100];
  const fxXY = (f: Fx): [number, number, number] => {
    if (f.on) {
      const c = f.on === city.id ? city : world.rival?.id === f.on ? world.rival : null;
      if (c) {
        const [X, Y, k] = cityXY(c);
        return [X + c.dir * f.gx * k, Y - f.alt * k, k * 2];
      }
    }
    const m = mOf(f.d);
    return [sx(f.gx, f.d), yOf(f.d) - f.alt * m, m];
  };
  const SHIP_K = 1.8;

  // ---- the sky ----------------------------------------------------------------------------------------
  function sky(x0: number, x1: number) {
    const L = E.L;
    const sg = ctx.createLinearGradient(0, 0, 0, HY);
    sg.addColorStop(0, L.top);
    sg.addColorStop(0.6, L.mid);
    sg.addColorStop(1, L.low);
    ctx.fillStyle = sg;
    ctx.fillRect(x0, -20, x1 - x0, HY + 22);
    const veil = 1 - E.rain * 0.85;
    if (E.night > 0.05) {
      for (const [a, b, k] of stars) {
        const tw = 0.6 + 0.4 * Math.sin(E.t * (0.7 + k * 2) + k * 50);
        ctx.fillStyle = `rgba(240,240,250,${(E.night * (0.15 + k * 0.7) * tw * veil).toFixed(3)})`;
        const s = k > 0.93 ? 2 * u : 1.1 * u;
        ctx.fillRect(a * GW, b * HY * 0.92, s, s);
      }
    }
    const sk = (E.day - 0.25) / 0.5;
    const gold = goldenOf(E.day);
    const sunX = (q: number) => GW * (world.sunSide > 0 ? 0.12 + 0.76 * q : 0.88 - 0.76 * q);
    if (sk > -0.05 && sk < 1.05) {
      const q = clamp01(sk);
      const x = sunX(q);
      const y = HY + 8 * u - Math.sin(q * Math.PI) * HY * 0.82;
      E.glow(x, y, (260 + gold * 220) * u, L.sun, 0.45 * veil);
      E.glow(x, y, 90 * u, '#fff4e0', 0.5 * veil);
      ctx.fillStyle = hexA(mix('#fff8ec', L.sun, 0.35 + gold * 0.5), 0.95 * veil);
      ctx.beginPath();
      ctx.arc(x, y, (22 + gold * 18) * u, 0, Math.PI * 2);
      ctx.fill();
    }
    const mk2 = (((E.day + 0.5) % 1) - 0.25) / 0.5;
    if (mk2 > -0.05 && mk2 < 1.05 && E.night > 0.1) {
      const q = clamp01(mk2);
      const x = sunX(1 - q);
      const y = HY - Math.sin(q * Math.PI) * HY * 0.74;
      const r = 20 * u;
      E.glow(x, y, r * 4, '#c8d0e0', 0.25 * E.night * veil);
      ctx.fillStyle = hexA('#e8e4da', 0.95 * E.night * veil);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA(L.top, 0.85 * E.night * veil);
      ctx.beginPath();
      ctx.arc(x + r * 0.45, y - r * 0.15, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shafts of sun through the smoke, low in the sky.
    if (sk > 0 && sk < 1 && L.rim > 0.4 && E.rain < 0.5) {
      const q = clamp01(sk);
      const x = sunX(q);
      const y = HY + 8 * u - Math.sin(q * Math.PI) * HY * 0.82;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 2 + (k - 2.5) * 0.16 + Math.sin(E.t * 0.02 + k) * 0.03 + (x < GW / 2 ? -0.25 : 0.25);
        const len = GH * 1.1;
        const wd = 0.035 + hash(k, 9) * 0.03;
        const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.addColorStop(0, hexA(L.sun, 0.09 * (L.rim - 0.4) * veil));
        g.addColorStop(1, hexA(L.sun, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a - wd) * len, y + Math.sin(a - wd) * len);
        ctx.lineTo(x + Math.cos(a + wd) * len, y + Math.sin(a + wd) * len);
        ctx.fill();
      }
      ctx.restore();
    }
    // Clouds: more and lower in a front.
    for (const c of clouds) {
      if (drift(E, c.s, 0) > 0.5) {
        tintCloud(c);
        break;
      }
    }
    for (const [i, c] of clouds.entries()) {
      if (i > 4 + E.rain * 4) continue;
      const span = GW * 2 + c.w;
      const x = posmod(c.x - world.scroll * c.f - E.t * c.v, span) - c.w;
      const y = c.y + E.rain * HY * 0.1;
      ctx.globalAlpha = 0.75 + E.rain * 0.25;
      ctx.drawImage(c.s.tint, x, y, c.w * (1 + E.rain * 0.3), c.h * (1 + E.rain * 0.5));
    }
    ctx.globalAlpha = 1;
    // The horizon's haze, lying over the far land.
    const hg = ctx.createLinearGradient(0, HY - 70 * u, 0, HY + 4);
    hg.addColorStop(0, hexA(L.haze, 0));
    hg.addColorStop(1, hexA(L.haze, 0.6));
    ctx.fillStyle = hg;
    ctx.fillRect(x0, HY - 70 * u, x1 - x0, 74 * u);
  }

  // ---- smoke ------------------------------------------------------------------------------------------
  /** A plume from (x, y) leaning back from the way the city goes and on the wind. */
  function plume(x: number, y: number, s: number, d: number, seed: number, dark: number, strength = 1) {
    const lean = -city.dir * (0.5 + city.speed / (30 * u)) + world.wind / 30;
    const col = E.tone(mix('#3a3430', '#8a8070', 1 - dark), d);
    const lit = E.tone(mix('#8a7e70', '#e8dcc8', 0.5), d, 0.5);
    const sD = E.soft(col);
    const sL = E.soft(lit);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const q = posmod(i / n + E.t * 0.045 + hash(seed, 1) * 0.5, 1);
      const yy = y - q * 260 * s;
      const xx = x + lean * q * q * 420 * s + Math.sin(E.t * 0.5 + i * 1.9 + seed) * q * 20 * s;
      const r = (10 + q * 110) * s;
      const a = 0.42 * Math.pow(1 - q, 1.1) * Math.min(1, q * 8) * strength * (1 - E.rain * 0.4);
      ctx.globalAlpha = a;
      ctx.drawImage(sD, xx - r, yy - r * 0.8, r * 2, r * 1.6);
      ctx.globalAlpha = a * 0.5 * E.L.rim * (1 - E.night * 0.8);
      ctx.drawImage(sL, xx - r * 0.9, yy - r * 0.95, r * 1.6, r * 1.2);
    }
    ctx.globalAlpha = 1;
  }
  function cityPlumes(c: City) {
    const [X, Y, k] = cityXY(c);
    const s = k * 0.55;
    for (const [i, [lx, ly]] of chimneyTops(c).entries()) {
      const px = X + c.dir * lx * k;
      const py = Y + ly * k;
      plume(px, py, s * (0.8 + hash(c.seed, i) * 0.5), c.d - 0.001, c.seed + i * 17, 0.3 + hash(i, c.seed) * 0.5, 1);
    }
    if (c.hurt > 0.3) plume(X, Y - 200 * k, s * 1.4, c.d, c.seed + 99, 0.9, c.hurt);
  }
  /** Mud and water thrown up off the tracks, behind each bogie. */
  function mudSpray(c: City) {
    const [X, Y, k] = cityXY(c);
    const plan = cityPlan(c.seed, c.tiers, c.top, c.tracks);
    const v = c.speed / (16 * u);
    const wet = world.wet;
    const col = E.tone(mix(MOODS[world.mood].mud[2], '#2a2018', 0.4), c.d);
    const puff = E.soft(E.tone(MOODS[world.mood].mud[1], c.d));
    for (const [bi, b] of plan.bogies.entries()) {
      const rx = X + c.dir * (b.x - b.len / 2 + 10) * k;
      const n = Math.round(14 * (0.4 + v * 0.6) * (0.6 + wet));
      for (let i = 0; i < n; i++) {
        const q = posmod(E.t * (0.9 + v * 0.4) + i / n + bi * 0.37, 1);
        const sp = hash(i, bi + c.seed);
        const vx = -c.dir * (40 + sp * 90) * k * (0.6 + v * 0.5);
        const vy = -(60 + hash(bi, i) * 110) * k * (0.5 + wet * 0.6);
        const tt = q * 1.2;
        const px = rx + vx * tt;
        const py = Y - 6 * k + vy * tt + 160 * k * tt * tt;
        if (py > Y) continue;
        ctx.fillStyle = col;
        const r = (1.6 + sp * 2.8) * k * 1.6;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // The dust (or the snow, or the salt) the tracks throw up, rolling away behind and hanging in the air.
      const dustC = world.land === 'snow' ? '#e8ecf0' : world.land === 'salt' ? '#e0d8c8' : MOODS[world.mood].mud[1];
      const dSpr = E.soft(E.tone(dustC, c.d, 0.25));
      const lSpr = E.soft(E.tone(mix(dustC, E.L.sun, 0.4), c.d, 0.6));
      const nB = 9;
      for (let i = 0; i < nB; i++) {
        const q = posmod(E.t * 0.05 * (0.6 + v * 0.5) + i / nB + bi * 0.21, 1);
        const r = (40 + q * 160) * k * (0.7 + hash(i, bi) * 0.6);
        const bx = rx - c.dir * (q * 520 * k + 20 * k) + Math.sin(E.t * 0.3 + i) * 12 * k;
        const by = Y - 14 * k - q * 90 * k - r * 0.25;
        const a = 0.34 * Math.pow(1 - q, 1.3) * Math.min(1, q * 6) * (0.45 + v * 0.4) * (1.1 - wet * 0.5);
        ctx.globalAlpha = a;
        ctx.drawImage(dSpr, bx - r, by - r * 0.6, r * 2, r * 1.2);
        ctx.globalAlpha = a * 0.5 * E.L.rim * (1 - E.night * 0.8);
        ctx.drawImage(lSpr, bx - r * 0.8 - world.sunSide * r * 0.2, by - r * 0.75, r * 1.6, r * 0.9);
      }
      ctx.globalAlpha = 0.3 * (0.4 + v * 0.6) * (0.5 + wet);
      const r = 60 * k;
      ctx.drawImage(puff, rx - c.dir * r * 0.8 - r, Y - r * 0.9, r * 2, r * 1.1);
      ctx.globalAlpha = 1;
    }
  }

  // ---- the tracks in the mud ------------------------------------------------------------------------------
  function trails() {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-50, HY, GW + 100, GH - HY + 20);
    ctx.clip();
    const dark = E.tone(MOODS[world.mood].mud[2], 0.3);
    const water = E.tone('#8a96a4', 0.3, 0.4);
    for (const tr of world.trails) {
      if (tr.pts.length < 2) continue;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        let first = true;
        let px = 0;
        let py = 0;
        for (const [gx, d] of tr.pts) {
          const dd = d + side * tr.gauge;
          const x = sx(gx, dd);
          const y = yOf(dd);
          if (first || Math.abs(y - py) > 12 * u || Math.abs(x - px) > 90 * u) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          px = x;
          py = y;
          first = false;
        }
        const [lg, ld] = tr.pts[tr.pts.length - 1];
        const isCity = tr.id === city.id;
        if (isCity) ctx.lineTo(sx(city.gx, city.d + side * tr.gauge), yOf(city.d + side * tr.gauge));
        void lg;
        const m = mOf(ld);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = hexA(dark, isCity ? 0.5 : 0.28);
        ctx.lineWidth = Math.max(1.5, tr.w * m * (isCity ? 0.9 : 1.4));
        ctx.stroke();
        if (tr.tread || isCity) {
          ctx.setLineDash([Math.max(1, 4 * m * u), Math.max(1, 5 * m * u)]);
          ctx.strokeStyle = hexA(dark, 0.6);
          ctx.lineWidth = Math.max(0.6, tr.w * m * 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (world.wet > 0.5) {
          ctx.strokeStyle = hexA(water, (world.wet - 0.5) * 0.5);
          ctx.lineWidth = Math.max(0.5, tr.w * m * 0.2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ---- the fx -----------------------------------------------------------------------------------------------
  function drawFx(f: Fx) {
    const age = world.t - f.t0;
    if (age < 0) return;
    const k = age / f.dur;
    if (f.kind === 'rocket' || f.kind === 'shell') {
      const c = f.on === city.id ? city : world.rival?.id === f.on ? world.rival : null;
      if (!c) return;
      const m0 = mOf(f.d);
      const x0 = sx(f.gx, f.d);
      const y0 = yOf(f.d) - f.alt * m0;
      const [X, Y, kc] = cityXY(c);
      const x1 = X + c.dir * f.vx * kc;
      const y1 = Y + f.valt * kc;
      const arc = f.kind === 'shell' ? Math.hypot(x1 - x0, y1 - y0) * 0.35 : 30 * u;
      const pos = (q: number): [number, number] => [x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * arc];
      const [px, py] = pos(k);
      ctx.strokeStyle = hexA(E.tone('#b8b0a0', 0.3), 0.5 * (1 - k * 0.5));
      ctx.lineWidth = Math.max(0.8, 2 * m0 * u);
      ctx.beginPath();
      const [ax, ay] = pos(Math.max(0, k - 0.35));
      ctx.moveTo(ax, ay);
      for (let q = Math.max(0, k - 0.35); q <= k; q += 0.05) {
        const p = pos(q);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.lineTo(px, py);
      ctx.stroke();
      lightsQ.push(() => E.glow(px, py, 10 * u, f.color, 0.9));
      return;
    }
    const [x, y, m] = fxXY(f);
    const r = f.r * m * 1.6;
    if (f.kind === 'mud' || f.kind === 'smoke' || f.kind === 'steam' || f.kind === 'flak') {
      const base = f.kind === 'steam' ? E.tone('#d8d4cc', f.d, 0.4) : f.kind === 'mud' ? E.tone(f.color, f.d) : E.tone(f.color, f.d);
      const a = (f.kind === 'steam' ? 0.35 : f.kind === 'flak' ? 0.7 : 0.5) * Math.pow(1 - k, 1.2) * Math.min(1, age * 4);
      const s = r * (1.2 + k * (f.kind === 'flak' ? 1.4 : 2.2));
      ctx.globalAlpha = a;
      ctx.drawImage(E.soft(base), x - s / 2, y - s / 2, s, s * 0.85);
      ctx.globalAlpha = 1;
      if (f.kind === 'flak' && age < 0.2) lightsQ.push(() => E.glow(x, y, r * 2, '#ffd090', 1 - age * 5));
      if (f.kind === 'mud' && f.alt > 0) {
        ctx.fillStyle = E.tone(f.color, f.d);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.8, r * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (f.kind === 'debris' || f.kind === 'clod') {
      ctx.fillStyle = E.tone(f.color, f.d);
      ctx.fillRect(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.6);
    } else if (f.kind === 'spark') {
      lightsQ.push(() => {
        ctx.fillStyle = hexA(f.color, 1 - k);
        ctx.fillRect(x - 1, y - 1, Math.max(1.5, r * 0.5), Math.max(1.5, r * 0.5));
      });
    } else if (f.kind === 'fire') {
      lightsQ.push(() => E.glow(x, y, r * 2.2, '#ff7a20', 0.7 * (1 - k)));
    } else if (f.kind === 'flash') {
      lightsQ.push(() => E.glow(x, y, r * (1 + k * 1.5), f.color, (1 - k) * 0.95));
    }
  }
  let lightsQ: (() => void)[] = [];

  // ---- searchlights ------------------------------------------------------------------------------------------
  function beams() {
    if (!city.beams.length || E.night < 0.2 || world.rain > 0.7) return;
    const [X, Y, k] = cityXY(city);
    const lamps = lampsOf(city);
    const a = clamp01((E.night - 0.2) * 2) * (1 - world.rain);
    city.beams.forEach((b, i) => {
      const [lx, ly] = lamps[i % lamps.length];
      const x0 = X + city.dir * lx * k;
      const y0 = Y + ly * k;
      const x1 = sx(b.gx, b.d);
      const y1 = yOf(b.d);
      const m = mOf(b.d);
      const rr = 130 * m * u;
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(255,244,210,${(0.3 * a).toFixed(3)})`);
      g.addColorStop(1, `rgba(255,244,210,${(0.06 * a).toFixed(3)})`);
      ctx.fillStyle = g;
      const ang = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x0 - Math.cos(ang) * 2, y0 - Math.sin(ang) * 2);
      ctx.lineTo(x1 - Math.cos(ang) * rr, y1 - Math.sin(ang) * rr * 0.3);
      ctx.lineTo(x1 + Math.cos(ang) * rr, y1 + Math.sin(ang) * rr * 0.3);
      ctx.lineTo(x0 + Math.cos(ang) * 2, y0 + Math.sin(ang) * 2);
      ctx.fill();
      // A brighter core down the middle of the cone.
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1 - Math.cos(ang) * rr * 0.35, y1 - Math.sin(ang) * rr * 0.1);
      ctx.lineTo(x1 + Math.cos(ang) * rr * 0.35, y1 + Math.sin(ang) * rr * 0.1);
      ctx.fill();
      ctx.fillStyle = `rgba(255,240,200,${(0.35 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x1, y1, rr * 1.1, rr * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      E.glow(x0, y0, 14 * k, '#fff4d0', a);
    });
  }

  // ---- rain and lightning ------------------------------------------------------------------------------------
  function rain(x0: number, x1: number) {
    const R = world.rain;
    if (R <= 0.02) return;
    ctx.strokeStyle = hexA(mix(E.L.haze, '#d8e0e8', 0.4), 0.35 * R);
    ctx.lineWidth = Math.max(0.6, 1 * u);
    const n = Math.floor(260 * R * (GW / 1600));
    const lean = world.wind * 0.012;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const h1 = hash(i, 1);
      const len = (18 + hash(i, 2) * 26) * u;
      const y = posmod(h1 * GH + E.t * (900 + hash(i, 3) * 300) * u, GH + len) - len;
      const x = x0 + posmod(hash(i, 4) * (x1 - x0) + y * lean, x1 - x0);
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * lean, y + len);
    }
    ctx.stroke();
    // Splashes on the near mud.
    ctx.strokeStyle = hexA('#c8d0d8', 0.3 * R);
    for (let i = 0; i < n * 0.3; i++) {
      const q = posmod(E.t * 2 + hash(i, 7), 1);
      const y = HY + (NY - HY) * (0.4 + hash(i, 8) * 0.65);
      const x = x0 + hash(i, 9) * (x1 - x0);
      ctx.beginPath();
      ctx.ellipse(x, y, (2 + q * 6) * u, (0.6 + q * 1.6) * u, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (world.flash > 0.3) {
      // A bolt, somewhere along the horizon.
      const bx = GW * (0.15 + hash(Math.floor(world.t), 3) * 0.7);
      ctx.strokeStyle = `rgba(240,240,255,${(world.flash * 0.9).toFixed(3)})`;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      let x = bx;
      let y = 0;
      ctx.moveTo(x, y);
      for (let k = 0; k < 9; k++) {
        x += (hash(k, Math.floor(world.t * 3)) - 0.5) * 60 * u;
        y += HY / 9;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(220,225,255,${(0.2 * world.flash).toFixed(3)})`;
      ctx.fillRect(x0, -20, x1 - x0, GH + 40);
    }
  }

  // ---- the frame ------------------------------------------------------------------------------------------
  let ready = false;
  const mapView = o.view === 'map';
  const chart = mapView ? createChart(world, lookSeed) : null;
  function paint(t: number) {
    E.set(t, world.day, world.rain, world.wind);
    if (chart) {
      chart.draw(E, ctx, W, H);
      words(t);
      return;
    }
    if (!ready) {
      ready = true;
      setup();
    }
    const G = ground!;
    // Bring what the light has left behind up to the hour, a little each frame.
    retintCity(E, cityArt!, city.d, false, world.sunSide * city.dir);
    if (world.rival) {
      if (!rivalArt) rivalArt = bakeCity(world.rival, Math.max(0.5, kOf(world.rival) * 1.25));
      retintCity(E, rivalArt, world.rival.d, false, world.sunSide * world.rival.dir);
    } else rivalArt = null;
    if (drift(E, G.pan, 0.8) > 0.3) tintSprite(E, G.pan, 0.8);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    const vx0 = cam.x - W / 2 / cam.zoom - 4;
    const vx1 = cam.x + W / 2 / cam.zoom + 4;
    const vy0 = cam.y - H / 2 / cam.zoom - 4;
    const vy1 = cam.y + H / 2 / cam.zoom + 4;
    lightsQ = [];
    sky(vx0, vx1);
    G.drawPanorama(E, world.scroll, vx0, vx1);
    G.draw(E, world.scroll, vx0, vx1, Math.max(HY, vy0), Math.min(GH + 20, vy1));
    trails();

    type D = { d: number; draw: () => void };
    const list: D[] = [];
    const lanes: [number, number][] = [[0, 0.5], [1, 0.45], [2, 0.6], [3, 0.85]];
    for (const [lane, dm] of lanes) {
      const m = mOf(dm);
      for (const rn of ruinsIn(lookSeed, u, world.scroll + (vx0 - GW / 2) / m - 400 * u, world.scroll + (vx1 - GW / 2) / m + 400 * u, lane, [city.d - 0.06, city.d + 0.03]))
        list.push({ d: rn.d, draw: () => drawRuin(E, rn, sx(rn.gx, rn.d), yOf(rn.d) + 2 * u * mOf(rn.d), mOf(rn.d)) });
    }
    for (const rl of world.relics) list.push({ d: rl.d, draw: () => drawRelic(E, rl, sx(rl.gx, rl.d), yOf(rl.d), mOf(rl.d)) });
    for (const wk of world.wrecks)
      list.push({
        d: wk.d,
        draw: () => {
          const m = mOf(wk.d);
          const x = sx(wk.gx, wk.d);
          const y = yOf(wk.d);
          ctx.strokeStyle = E.tone('#2a2420', wk.d);
          ctx.lineWidth = Math.max(0.6, 2 * m * u);
          ctx.beginPath();
          for (let k = 0; k < 7; k++) {
            const q = (k / 6 - 0.5) * wk.len * m * SHIP_K;
            ctx.moveTo(x + q, y);
            ctx.quadraticCurveTo(x + q * 1.1, y - (14 + (k % 3) * 5) * m * u, x + q * 0.9 + 4 * m * u, y - (24 - Math.abs(k - 3) * 4) * m * u);
          }
          ctx.stroke();
          ctx.fillStyle = hexA(E.tone('#1a1410', wk.d), 0.5);
          ctx.beginPath();
          ctx.ellipse(x, y, wk.len * m * SHIP_K * 0.6, 6 * m * u, 0, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    for (const tw of world.towns) {
      if (tw.state === 'caught' || tw.state === 'eaten') continue;
      list.push({
        d: tw.d,
        draw: () => {
          const [X, Y, k] = townXY(tw);
          if (X < vx0 - tw.len * 2 || X > vx1 + tw.len * 2) return;
          const art = townArt(tw, Math.min(2.4, Math.max(0.5, k * 1.4)), towns);
          drawTown(E, tw, art, X, Y, k, tw.d);
          if (tw.smoke > 0.05 || tw.state === 'flee') plume(X - tw.dir * 30 * k, Y - 60 * k, k * 0.6, tw.d, tw.seed, 0.7, tw.state === 'flee' ? 0.7 : tw.smoke);
          else plume(X - tw.dir * 36 * k, Y - 70 * k, k * 0.35, tw.d, tw.seed, 0.4, 0.5);
        },
      });
    }
    const rv = world.rival;
    if (rv && rivalArt) {
      list.push({
        d: rv.d,
        draw: () => {
          const [X, Y, k] = cityXY(rv);
          drawCity(E, rivalArt!, rv, { X, Y, k, d: rv.d, wind: world.wind, scrollV: rv.speed });
          cityPlumes(rv);
          mudSpray(rv);
          lightsQ.push(() => cityFires(E, rv, X, Y, k, rv.d));
        },
      });
    }
    const T0 = ctx.getTransform();
    list.push({
      d: city.d,
      draw: () => {
        const [X, Y, k] = cityXY(city);
        const caught = world.towns.find((q) => q.state === 'caught');
        const inside = caught
          ? () => {
              ctx.save();
              ctx.setTransform(T0);
              const [tx, ty, tk] = townXY(caught);
              drawTown(E, caught, townArt(caught, Math.min(2.4, Math.max(0.5, tk * 1.4)), towns), tx, ty - caught.eat * 30 * k, tk, caught.d);
              ctx.restore();
            }
          : undefined;
        drawCity(E, cityArt!, city, { X, Y, k, d: city.d, inside, wind: world.wind, scrollV: city.speed });
        cityPlumes(city);
        mudSpray(city);
        lightsQ.push(() => cityFires(E, city, X, Y, k, city.d));
      },
    });
    for (const s of world.ships)
      list.push({
        d: s.d - 0.02,
        draw: () => {
          const m = mOf(s.d);
          drawShip(E, s, sx(s.gx, s.d), yOf(s.d) - s.alt * m, s.len * m * SHIP_K, s.d);
        },
      });
    const hb = world.harbour;
    if (hb) list.push({ d: hb.d - 0.03, draw: () => drawHarbour(E, hb, sx(hb.gx, hb.d), yOf(hb.d) - hb.alt * mOf(hb.d), mOf(hb.d) * u * 1.5, hb.d) });
    for (const f of world.flocks) list.push({ d: f.d - 0.02, draw: () => drawFlock(E, f, sx(f.gx, f.d), yOf(f.d) - f.alt * mOf(f.d), mOf(f.d)) });
    for (const f of world.fx) list.push({ d: f.d - 0.001, draw: () => drawFx(f) });
    list.sort((a, b) => b.d - a.d);
    let ridged = false;
    for (const it of list) {
      if (!ridged && it.d < world.ridgeD) {
        ridged = true;
        G.drawRidge(E, world.scroll, vx0, vx1, () => undefined);
      }
      it.draw();
    }
    if (!ridged) G.drawRidge(E, world.scroll, vx0, vx1, () => undefined);
    // The light pass.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    beams();
    for (const l of lightsQ) l();
    ctx.restore();
    rain(vx0, vx1);
    ctx.restore();
    grade(t);
    words(t);
  }

  function grade(t: number) {
    if (!grain) {
      grain = mk(128, 128);
      const g = grain.getContext('2d')!;
      const img = g.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) {
        const v = 128 + (lr() - 0.5) * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    const pat = ctx.createPattern(grain, 'repeat');
    if (pat) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.05;
      const step = Math.floor(t * 10);
      ctx.translate((step * 37) % 128, (step * 53) % 128);
      ctx.fillStyle = pat;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(14,10,8,0)');
    vg.addColorStop(1, `rgba(14,10,8,${(0.4 + E.night * 0.2).toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- words: the plaque, the rangefinder, the intertitles, the subtitles, the log ---------------------------
  const INK = 'rgba(14,10,7,';
  const CREAM = '#f4ead6';
  const BRASS = '#d8b46a';
  const small = () => W < 600;
  const rr = (x: number, y: number, w: number, h: number, a: number) => {
    ctx.fillStyle = `${INK}${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();
  };
  /** Spaced capitals, centred or left at x. */
  const caps = (text: string, x: number, y: number, px: number, color: string, align: CanvasTextAlign = 'left') => {
    ctx.font = `600 ${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;
    ctx.letterSpacing = `${(px * 0.18).toFixed(1)}px`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    fillCrisp(ctx, text.toUpperCase(), x, y);
    ctx.letterSpacing = '0px';
  };
  const capsW = (text: string, px: number) => {
    ctx.font = `600 ${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;
    ctx.letterSpacing = `${(px * 0.18).toFixed(1)}px`;
    const w = ctx.measureText(text.toUpperCase()).width;
    ctx.letterSpacing = '0px';
    return w;
  };
  const clock = (day: number) => {
    const m = Math.round((day * 24 * 60) / 5) * 5;
    const h = Math.floor(m / 60) % 24;
    return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  };
  /** Wrap a line to a width, in the current font. */
  const wrap = (text: string, max: number): string[] => {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > max) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  let plaqueRect: [number, number, number, number] = [0, 0, 0, 0];
  let logRect: [number, number, number, number] = [0, 0, 0, 0];
  /** The city's plaque: its name stencilled, where it hunts, the hour on a dial, and the gut's ledger. */
  function plaque() {
    const level = 0.6 + 0.4 * host.intensity;
    const nameS = small() ? 17 : 21;
    const x = 14;
    const y = 12;
    const nw = capsW(city.name, nameS);
    ctx.font = SERIF(small() ? 11 : 12, true);
    const sub = `hunting ${world.region.toLowerCase()}`;
    const sw = ctx.measureText(sub).width;
    const w = Math.max(nw, sw, 150) + 64;
    const h = small() ? 70 : 78;
    plaqueRect = [x, y, w, h];
    ctx.save();
    ctx.globalAlpha = level;
    rr(x, y, w, h, 0.62);
    ctx.strokeStyle = hexA(BRASS, 0.55);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
    caps(city.name, x + 12, y + 28, nameS, CREAM);
    ctx.font = SERIF(small() ? 11 : 12, true);
    ctx.textAlign = 'left';
    ctx.fillStyle = hexA('#d8ccb0', 0.95);
    fillCrisp(ctx, sub, x + 12, y + 45);
    // The hour on a dial: day above, night below, the hand going round once a day.
    const cx = x + w - 26;
    const cy = y + 24;
    const R = 13;
    ctx.fillStyle = '#e8d8b0';
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1e2436';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    const a = (world.day - 0.25) * Math.PI * 2 + Math.PI;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.85);
    ctx.stroke();
    ctx.fillStyle = E.night > 0.5 ? '#e8e4da' : '#f0b050';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.85, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = SERIF(9, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA('#d8ccb0', 0.9);
    fillCrisp(ctx, clock(world.day), cx, cy + R + 11);
    // The gut's ledger: a chimney for every chimney lit, a notch for every town eaten.
    const ly = y + h - 13;
    ctx.textAlign = 'left';
    let lx = x + 12;
    for (let k = 0; k < city.chimneys; k++) {
      ctx.fillStyle = k >= city.chimneys - city.eaten ? '#f0a050' : hexA(BRASS, 0.75);
      ctx.fillRect(lx, ly - 9, 3, 9);
      ctx.fillRect(lx - 0.6, ly - 10, 4.2, 1.6);
      lx += 6;
    }
    lx += 6;
    ctx.font = SERIF(10, true);
    ctx.fillStyle = hexA('#d8ccb0', 0.9);
    const tally = `${world.eatenTotal} eaten${world.escaped ? ` · ${world.escaped} got away` : ''}${city.scars.length ? ` · ${city.scars.length} scar${city.scars.length === 1 ? '' : 's'}` : ''}`;
    fillCrisp(ctx, fitText(ctx, tally, x + w - 10 - lx), lx, ly);
    ctx.restore();
  }
  /** The navigator's log, top right: the last entries with their hours. Not on a phone. */
  function log(t: number) {
    logRect = [0, 0, 0, 0];
    if (small()) return;
    const lines = world.chronicle.slice(-2);
    if (!lines.length) return;
    const maxW = Math.min(420, W * 0.34);
    ctx.font = SERIF(12, true);
    const rows = lines.map((l) => `${clock(l.day)} — ${l.text}`).flatMap((s, i) => wrap(s, maxW).map((q) => [q, i] as const));
    const w = Math.max(...rows.map(([q]) => ctx.measureText(q).width)) + 24;
    const h = rows.length * 16 + 26;
    const x = W - w - 14;
    const y = 12;
    logRect = [x, y, w, h];
    rr(x, y, w, h, 0.5);
    caps("navigator's log", x + 12, y + 15, 9, hexA(BRASS, 0.9));
    rows.forEach(([q, i], k) => {
      const age = t - lines[i].t;
      ctx.font = SERIF(12, true);
      ctx.textAlign = 'left';
      ctx.fillStyle = hexA(CREAM, Math.min(1, age * 2) * (i === lines.length - 1 ? 0.95 : 0.6));
      fillCrisp(ctx, q, x + 12, y + 32 + k * 16);
    });
  }
  /** The bottom of the frame: a beat of the story as an intertitle; between beats, the radio as subtitles. */
  function bottom(t: number) {
    const beat = [...world.beats].reverse().find((b) => t - b.t0 < 6.5);
    const maxW = Math.min(W - 40, 760);
    if (beat) {
      const age = t - beat.t0;
      const a = Math.min(1, age * 2.5, (6.5 - age) / 1);
      const px = small() ? 17 : 21;
      ctx.font = SERIF(px, true);
      const rows = wrap(typed(beat.text, age, 60, t), maxW);
      const full = wrap(beat.text, maxW);
      const w = Math.max(...full.map((q) => ctx.measureText(q).width), capsW(beat.kicker, 10)) + 70;
      const h = full.length * (px + 6) + 34;
      const y = H - h - (small() ? 22 : 26);
      const g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
      g.addColorStop(0, `${INK}0)`);
      g.addColorStop(0.12, `${INK}${(0.7 * a).toFixed(3)})`);
      g.addColorStop(0.88, `${INK}${(0.7 * a).toFixed(3)})`);
      g.addColorStop(1, `${INK}0)`);
      ctx.fillStyle = g;
      ctx.fillRect(W / 2 - w / 2, y, w, h);
      ctx.fillStyle = hexA(BRASS, 0.6 * a);
      ctx.fillRect(W / 2 - w * 0.3, y + 0.5, w * 0.6, 1);
      ctx.fillRect(W / 2 - w * 0.3, y + h - 1.5, w * 0.6, 1);
      caps(beat.kicker, W / 2, y + 17, 10, hexA(BRASS, a), 'center');
      ctx.font = SERIF(px, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = hexA(CREAM, a);
      rows.forEach((q, i) => fillCrisp(ctx, q, W / 2, y + 26 + px + i * (px + 6)));
      return;
    }
    const line = [...world.radio].reverse().find((l) => t - l.t0 < 4.8);
    if (!line) return;
    const age = t - line.t0;
    const a = Math.min(1, age * 3, (4.8 - age) / 0.6);
    const px = small() ? 15 : 17;
    ctx.font = SERIF(px, true);
    const rows = wrap(`“${line.text}”`, maxW - 40);
    const ww = Math.max(...rows.map((q) => ctx.measureText(q).width), capsW(line.who, 10));
    const h = rows.length * (px + 5) + 20;
    const y = H - h - (small() ? 22 : 26);
    rr(W / 2 - ww / 2 - 16, y, ww + 32, h + 4, 0.62 * a);
    caps(line.who, W / 2, y + 13, 9, hexA(BRASS, a), 'center');
    ctx.font = SERIF(px, true);
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(CREAM, a);
    rows.forEach((q, i) => fillCrisp(ctx, typed(q, age - i * 0.5, 50, t), W / 2, y + 16 + px + i * (px + 5)));
  }
  /** The rangefinder's lock: closing brackets on the prey (or the raid's lead, or the rival), and a readout. */
  function lock(t: number) {
    type L = { x: number; y: number; w: number; h: number; name: string; sub: string; t0: number; red: boolean };
    let L: L | null = null;
    const kmh = (v: number) => Math.round((Math.abs(v) / u) * 0.9);
    const hunt = world.hunt;
    const prey = world.towns.find((q) => q.id === hunt.town);
    if (prey && hunt.phase !== 'gut' && hunt.phase !== 'strip') {
      const [X, Y, k] = townXY(prey);
      const gap = Math.max(0, city.dir * (prey.gx - city.dir * prey.len * 0.5 - (city.gx + city.dir * city.len * 0.5)));
      const range = hunt.phase === 'jaws' ? 'IN THE JAWS' : `${Math.round(gap / u)} YDS`;
      L = { x: SX(X), y: SY(Y - 45 * k), w: 110 * k * cam.zoom, h: 100 * k * cam.zoom, name: prey.name, sub: `${TOWN_KIND_NAMES[prey.kind]} · ${prey.pop.toLocaleString('en-GB')} SOULS · ${kmh(prey.vx)} KM/H · ${range}`, t0: hunt.t0, red: true };
    } else {
      const lead = world.ships.find((s) => (s.kind === 'league' || s.kind === 'gunboat') && s.state === 'attack');
      if (lead && t - lead.t0 < 30) {
        const m = mOf(lead.d);
        const L0 = lead.len * m * 1.8;
        L = { x: SX(sx(lead.gx, lead.d)), y: SY(yOf(lead.d) - lead.alt * m), w: L0 * 1.2 * cam.zoom, h: L0 * 0.6 * cam.zoom, name: lead.name, sub: `AIRSHIP OF THE STATIC ACCORD · ROCKETS · ALT ${Math.round(lead.alt / u)} FT`, t0: lead.t0, red: true };
      } else if (world.rival && world.rival.state === 'duel') {
        const rv = world.rival;
        const [X, Y, k] = cityXY(rv);
        L = { x: SX(X), y: SY(Y - 330 * k), w: 1000 * k * cam.zoom, h: 700 * k * cam.zoom, name: rv.name, sub: `TRACTION CITY · ${rv.tiers} TIERS · ${rv.hurt > 0.3 ? 'BURNING' : 'GUNS RUN OUT'}`, t0: rv.t0, red: true };
      }
    }
    if (!L) return;
    const age = t - L.t0;
    const e = 1 - Math.pow(1 - Math.min(1, age / 0.7), 3);
    const pad = (1 - e) * 40 + 6;
    const hw = L.w / 2 + pad;
    const hh = L.h / 2 + pad;
    const col = hexA(L.red ? '#ff8a6a' : CREAM, 0.85 * Math.min(1, age * 3));
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    const c = Math.min(14, hw * 0.4);
    ctx.beginPath();
    for (const [sxn, syn] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const bx = L.x + sxn * hw;
      const by = L.y + syn * hh;
      ctx.moveTo(bx, by - syn * c);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx - sxn * c, by);
    }
    ctx.stroke();
    if (age < 0.5) return;
    // The readout: up in the sky on the target's side, under the plaque or the log, clear of the city.
    ctx.font = SERIF(10);
    const sub = fitText(ctx, L.sub, Math.min(W - 40, 420));
    const w = Math.max(capsW(L.name, 12), ctx.measureText(sub).width) + 22;
    const h = 36;
    const left = L.x < W / 2;
    const x = left ? Math.max(10, plaqueRect[0]) : Math.min(W - w - 10, W - 14 - w);
    const under = left ? plaqueRect : logRect;
    const y = Math.max(10, under[2] > 0 ? under[1] + under[3] + 10 : 14);
    const a = Math.min(1, (age - 0.5) * 3);
    rr(x, y, w, h, 0.72 * a);
    ctx.fillStyle = hexA(L.red ? '#ff8a6a' : BRASS, 0.8 * a);
    ctx.fillRect(x, y, 2, h);
    ctx.strokeStyle = hexA(L.red ? '#ff8a6a' : CREAM, 0.4 * a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L.x, y > L.y ? L.y + hh : L.y - hh);
    ctx.lineTo(Math.max(x, Math.min(x + w, L.x)), y > L.y ? y : y + h);
    ctx.stroke();
    caps(typed(L.name, age - 0.5, 30, t), x + 11, y + 15, 12, hexA(CREAM, a));
    ctx.font = SERIF(10);
    ctx.textAlign = 'left';
    ctx.fillStyle = hexA('#e0cfa8', a);
    fillCrisp(ctx, typed(sub, age - 0.8, 50, t), x + 11, y + 29);
  }
  function words(t: number) {
    if (o.hud && mapView) {
      plaqueRect = [0, 0, 0, 0];
      log(t);
    } else if (o.hud) {
      plaque();
      log(t);
    } else {
      plaqueRect = [0, 0, 0, 0];
      logRect = [0, 0, 0, 0];
    }
    if (o.labels) {
      if (!mapView) lock(t);
      bottom(t);
    }
    ctx.textAlign = 'left';
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => (chart ? chart.project(x, y) : [SX(x), SY(y)]),
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => (chart ? chart.unproject(x, y) : [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y]),
    after: (dt) => {
      framing.update(dt, world.t, world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => paint(t),
    ambience: () => (world.hunt.phase !== 'none' ? 0.85 : world.rain > 0.3 ? 0.8 : 0.45),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
