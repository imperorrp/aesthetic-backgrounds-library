/**
 * Undercity's mount. One frame:
 *
 *   step    scroll the camera, stream buildings in and out, move life, run the net
 *   paint   sky → lightning → searchlights → far towers → haze → air lane 0 → mid towers
 *           → the maglev → haze → air lanes 1-2 → near stacks → cables → the wet street
 *           (reflections, steam, crowds) → police → the net → labels → rain → HUD
 *
 * Importing this module hands the mount to the shell (index.ts).
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { fillCrisp, hash, hexA, mono, typed } from '../instruments/kit';
import { UNDERCITY_SCHEMA, provideUndercity } from './index';
import { createCity, LAYERS, type Building } from './world';
import { createPainter, paintSky, PAD, ROOF_ROOM, FONT, type Painter } from './paint';
import { createLife } from './life';
import { adText, createNet } from './net';

const DISTRICTS = ['KABUKI ROW', 'THE STACKS', 'NEON MILE', 'OLD PORT', 'GLASSWORKS', 'THE SPRAWL', 'LANTERN QUARTER', 'ASHFALL', 'HOLLOW MARKET'];
/** Camera drift, near-layer pixels per second. */
const DRIFT = 14;

export function mountCity(host: SkinHost): SkinInstance {
  const o = resolveOptions(UNDERCITY_SCHEMA, host.options) as { speed: number; rain: number; traffic: number; crowd: number; net: number; overlay: boolean; hud: boolean };
  const { ctx, palette } = host;
  const accent = palette.accent;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const city = createCity(host.config.seed, W, H);
  const reduced = () => host.motion === 'reduced';
  const life = createLife(city, host.fork('life'), host.noise, { traffic: o.traffic, crowd: o.crowd, rain: o.rain }, reduced);
  const net = createNet(city, host.fork('net'), life, { rate: o.net, overlay: o.overlay });
  // Canvases are made on the first draw: the headless runner steps the city without a DOM.
  let painter: Painter | null = null;
  let sky: HTMLCanvasElement | null = null;
  let nextKeep = 0;
  let nextAmbience = 0;

  // What happens, out to the host (sound binds here).
  city.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const x = typeof e.x === 'number' ? e.x : W / 2;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near: 1, text: e.text, color: e.color, priority: e.priority });
  });
  city.stream();

  const step = (info: FrameInfo) => {
    const dt = host.motion === 'off' ? 0 : info.dt;
    city.t = info.t;
    city.cam += dt * DRIFT * o.speed * (reduced() ? 0.5 : 1);
    const streamed = city.stream();
    life.update(dt);
    net.update(dt, streamed);
    // How hard it is raining, for sound: the rain bed follows it.
    if (city.t >= nextAmbience && host.events?.active) {
      nextAmbience = city.t + 2;
      host.events.emit({ type: 'ambience', weight: life.wet, pan: 0, near: 1 });
    }
    for (let i = city.labels.length - 1; i >= 0; i--) if (city.t - city.labels[i].t0 > city.labels[i].dur) city.labels.splice(i, 1);
  };

  /** A building: its canvas (sliced and shifted while glitching), then its live parts. */
  const drawBuilding = (p: Painter, b: Building, t: number, level: number) => {
    const c = p.building(b);
    const x = Math.round(city.sx(b.layer, b.x) - PAD);
    const top = Math.round(city.baseY(b.layer) - b.h - ROOF_ROOM);
    const w = b.w + PAD * 2;
    const h = b.h + ROOF_ROOM;
    if (x > W || x + w < 0) return;
    const glitching = t < b.glitchUntil;
    if (glitching) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const off = (hash(b.seed, i, Math.floor(t * 14)) - 0.5) * 16;
        ctx.drawImage(c, 0, (i / n) * c.height, c.width, c.height / n, x + off, top + (i / n) * h, w, h / n);
      }
      for (let i = 0; i < 4; i++) {
        const k = hash(b.seed, i + 9, Math.floor(t * 10));
        ctx.fillStyle = hexA(i % 2 ? '#22d3ee' : '#f472b6', 0.35);
        ctx.fillRect(x + PAD + k * b.w * 0.8, top + ROOF_ROOM + hash(i, b.seed, Math.floor(t * 10)) * b.h, 6 + k * 20, 2 + k * 4);
      }
    } else ctx.drawImage(c, x, top, w, h);
    const bodyTop = top + ROOF_ROOM;
    const base = bodyTop + b.h;
    const lit = b.dark < 0.5;
    // Aircraft warning lights on the masts.
    for (const [mx, mh] of b.masts) {
      if ((t + hash(b.seed, Math.floor(mx)) * 2) % 1.6 > 0.3) continue;
      ctx.fillStyle = hexA('#ef4444', 0.9);
      ctx.fillRect(x + PAD + mx - 1, bodyTop - mh - 1, 2.5, 2.5);
    }
    // A holo ad panel: dark glass, a slogan (or a hijacker's message), scanlines.
    if (b.ad && lit) {
      const ax = x + PAD + 3;
      const aw = b.w - 6;
      const ah = b.ad.h;
      const ay = base - b.ad.y - ah / 2;
      ctx.fillStyle = 'rgba(4,3,12,0.75)';
      ctx.fillRect(ax, ay, aw, ah);
      const text = adText(b, t);
      const hijacked = !!b.hijacked;
      const color = hijacked ? (Math.floor(t * 6) % 2 ? '#4ade80' : '#ef4444') : b.ad.color;
      const size = Math.max(7, Math.min(ah * 0.45, (aw / Math.max(4, text.length)) * 1.5));
      ctx.font = `${Math.round(size)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = hexA(color, (0.75 + 0.2 * Math.sin(t * 3 + b.seed)) * level);
      const jitter = hijacked ? (hash(b.seed, Math.floor(t * 12)) - 0.5) * 6 : 0;
      fillCrisp(ctx, text, ax + aw / 2 + jitter, ay + ah / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = ay; y < ay + ah; y += 3) ctx.fillRect(ax, y, aw, 1);
      ctx.strokeStyle = hexA(color, 0.35 * level);
      ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
    }
    // Neon, with the odd flicker.
    if (lit) {
      for (const s of b.signs) {
        const f = hash(s.seed, Math.floor(t * 9));
        if (f < 0.035) continue;
        const spr = p.sign(s.text, s.color, s.size, s.vertical);
        const sw = spr.width / p.dpr;
        const sh = spr.height / p.dpr;
        ctx.globalAlpha = (f < 0.08 ? 0.45 : 1) * level;
        if (s.vertical) ctx.drawImage(spr, Math.round(x + PAD + s.x - sw / 2), Math.round(base - s.y - sh), sw, sh);
        else ctx.drawImage(spr, Math.round(x + PAD + s.x), Math.round(base - s.y - sh / 2), sw, sh);
        ctx.globalAlpha = 1;
      }
    }
    // The grid is down here.
    if (b.dark > 0.02) {
      ctx.fillStyle = `rgba(3,2,10,${(0.84 * b.dark).toFixed(3)})`;
      ctx.fillRect(x + PAD, bodyTop - 2, b.w, b.h + 2);
    }
  };

  /** Smog over a layer: lighter and more of it the farther away. */
  const haze = (L: number) => {
    const f = LAYERS[L].fog;
    const g = ctx.createLinearGradient(0, 0, 0, city.baseY(L));
    g.addColorStop(0, hexA('#1e1b4b', f * 0.25));
    g.addColorStop(1, hexA(accent, f * 0.22));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, city.baseY(L));
  };

  const searchlights = (t: number) => {
    ctx.save();
    for (const [fx, ph] of [[0.28, 0], [0.71, 2.1]] as const) {
      const x = W * fx;
      const y = city.baseY(0);
      const a = -Math.PI / 2 + Math.sin(t * 0.21 + ph) * 0.5;
      const len = H * 0.9;
      const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.addColorStop(0, hexA('#e0e7ff', 0.1));
      g.addColorStop(1, hexA('#e0e7ff', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a - 0.05) * len, y + Math.sin(a - 0.05) * len);
      ctx.lineTo(x + Math.cos(a + 0.05) * len, y + Math.sin(a + 0.05) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  /** Cables sagging between neighbouring stacks. */
  const cables = () => {
    const list = city.visible[2];
    ctx.save();
    ctx.strokeStyle = 'rgba(2,1,6,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      const ax = city.sx(2, a.x + a.w);
      const bx = city.sx(2, b.x);
      if (bx < -50 || ax > W + 50) continue;
      for (let k = 0; k < 2; k++) {
        if (hash(a.seed, k, 31) < 0.35) continue;
        const ay = city.baseY(2) - Math.min(a.h, b.h) * (0.4 + 0.4 * hash(a.seed, k, 32));
        const by = ay + (hash(b.seed, k) - 0.5) * 20;
        const sag = 18 + 26 * hash(a.seed, k, 33);
        ctx.moveTo(ax - 4, ay);
        ctx.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + sag, bx + 4, by);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  /** The wet street: asphalt, the neon above it reflected and smeared. */
  const street = (p: Painter, t: number, level: number) => {
    const base = Math.round(city.baseY(2));
    const g = ctx.createLinearGradient(0, base, 0, H);
    g.addColorStop(0, '#0b0918');
    g.addColorStop(1, '#040308');
    ctx.fillStyle = g;
    ctx.fillRect(0, base, W, H - base);
    ctx.save();
    for (const b of city.visible[2]) {
      if (b.dark > 0.5) continue;
      const x = city.sx(2, b.x);
      if (x > W || x + b.w < 0) continue;
      // Light spilling from the shopfront.
      const lv = b.levels?.[0];
      if (lv?.open) {
        ctx.fillStyle = hexA(lv.lantern, 0.08 * level);
        ctx.fillRect(x + 4, base, b.w - 8, (H - base) * 0.9);
      }
      const s = b.signs[0];
      if (!s || s.vertical) continue;
      const spr = p.sign(s.text, s.color, s.size, false);
      const sw = spr.width / p.dpr;
      const sh = spr.height / p.dpr;
      ctx.save();
      ctx.globalAlpha = 0.2 * level * (0.8 + 0.2 * Math.sin(t * 2 + b.seed));
      ctx.translate(Math.round(x + s.x), base + s.y * 0.6);
      ctx.scale(1, -0.6);
      ctx.drawImage(spr, 0, -sh / 2, sw, sh);
      ctx.restore();
    }
    ctx.restore();
  };

  const labels = (t: number, level: number) => {
    ctx.save();
    ctx.font = mono(9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (let i = city.labels.length - 1; i >= 0; i--) {
      const l = city.labels[i];
      const age = t - l.t0;
      if (age > l.dur) {
        city.labels.splice(i, 1);
        continue;
      }
      const x = city.sx(l.b.layer, l.b.x + l.ox);
      const y = city.baseY(l.b.layer) - l.b.h + l.oy;
      const a = Math.min(1, (l.dur - age) / 0.8) * level;
      const text = typed(l.text, age, 45, t);
      const w = ctx.measureText(text).width;
      const tx = Math.max(6, Math.min(W - w - 6, x + 8));
      ctx.fillStyle = `rgba(4,3,12,${(0.6 * a).toFixed(3)})`;
      ctx.fillRect(tx - 3, y - 10, w + 6, 13);
      ctx.fillStyle = hexA(l.color, 0.95 * a);
      fillCrisp(ctx, text, tx, y);
    }
    ctx.restore();
  };

  const hud = (t: number, level: number) => {
    ctx.save();
    ctx.font = mono(9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const district = DISTRICTS[Math.floor(city.cam / 1500) % DISTRICTS.length];
    const head = `UNDERCITY // ${district} // RAIN ${Math.round(life.wet * 100)}% // NET LOAD ${Math.round(net.load * 100)}%`;
    const hw = ctx.measureText(head).width;
    ctx.fillStyle = 'rgba(4,3,12,0.7)';
    ctx.fillRect(10, 10, hw + 10, 15);
    ctx.fillStyle = hexA('#22d3ee', 0.85 * level);
    fillCrisp(ctx, head, 15, 21);
    const lines = city.term.slice(-5);
    lines.forEach((l, i) => {
      const y = H - 14 - (lines.length - 1 - i) * 13;
      const text = `> ${typed(l.text, t - l.t, 40, t)}`;
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(4,3,12,0.7)';
      ctx.fillRect(10, y - 10, w + 10, 13);
      ctx.fillStyle = hexA(l.color, 0.85 * level * (i === lines.length - 1 ? 1 : 0.7));
      fillCrisp(ctx, text, 15, y);
    });
    ctx.restore();
  };

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      city.resize(W, H);
      painter?.clear();
      sky = null;
      city.stream();
    },
    frame(info: FrameInfo) {
      step(info);
      const t = city.t;
      const level = 0.55 + 0.45 * host.intensity;
      painter ??= createPainter(host.viewport.dpr);
      sky ??= paintSky(W, H, palette.bg, accent, (x, y) => host.noise.noise2(x, y));
      if (t >= nextKeep) {
        nextKeep = t + 2;
        painter.keep(new Set(city.visible.flat().map((b) => b.id)));
      }
      ctx.drawImage(sky, 0, 0, W, H);
      life.drawSky(ctx);
      searchlights(t);
      for (const b of city.visible[0]) drawBuilding(painter, b, t, level);
      haze(0);
      life.drawLane(ctx, 0);
      for (const b of city.visible[1]) drawBuilding(painter, b, t, level);
      life.drawRail(ctx);
      haze(1);
      life.drawLane(ctx, 1);
      life.drawLane(ctx, 2);
      for (const b of city.visible[2]) drawBuilding(painter, b, t, level);
      cables();
      street(painter, t, level);
      life.drawStreet(ctx);
      life.drawPolice(ctx);
      net.draw(ctx, level);
      labels(t, level);
      life.drawRain(ctx);
      if (o.hud) hud(t, level);
    },
    advance(info: FrameInfo) {
      step(info);
    },
    inspect(): SkinInspection {
      return {
        t: city.t,
        counts: { far: city.visible[0].length, mid: city.visible[1].length, near: city.visible[2].length, ...life.counts(), ...net.counts(), labels: city.labels.length },
        log: city.bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: city.bus.seq,
      };
    },
    destroy() {
      painter?.clear();
    },
  };
}

provideUndercity(mountCity);
