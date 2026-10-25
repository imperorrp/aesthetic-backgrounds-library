/**
 * Blockade, painted: a frame from a space-opera film. High in orbit, the line of ships against
 * the black, the great curve of the planet's lit limb below, the star low over the air or hidden
 * behind it.
 *
 * Back to front: the deep sky (a galaxy's band or a nebula, baked once); the star and its glare;
 * the moons, lit per sample; the rings; the planet (./planet) and what happens on it (fires where
 * it was struck, a moon's shadow, the aurora, meteors, the great gun); then everything in orbit,
 * far to near: the station, ships (baked, lit sprites from ./ships, with their engines, running
 * lights, shields, fires and stencilled names), wrecks breaking apart, debris, bolts, explosions;
 * the flare's light; the grade; and the words (./text). The `view: map` option paints the same
 * sim as an orbital plot instead (./mapview).
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, runWorld, type CameraMode } from '../../../kit';
import { hash } from '../../instruments/kit';
import { STATS, type FleetLook } from './design';
import { at, type Design } from './hulls';
import { createMapPainter } from './mapview';
import { createPlanetPainter, type PlanetPainter } from './planet';
import { createShipArt, css, rgbOf, type Lighting } from './ships';
import { bakeCurtain, bakeRings, bakeSky, createGlows, createMoonArt, mkCanvas } from './sky';
import { createBlockade } from './sim';
import { createText, DISPLAY, hexToRgba } from './text';
import type { BlockWorld, Bolt, Fx, Ship, Wreck } from './types';

export type BlockPaintOptions = { traffic: number; camera: string; labels: boolean; hud: boolean; view: string };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MERCHANT: FleetLook = { name: 'MERCHANT', short: 'MERCHANT', prefix: 'MV', hull: '#8a7a68', hull2: '#5a5048', trim: '#c8902a', engine: '#ffc890', window: '#ffe0a8', bolt: '#ffffff', style: 'slab', port: '#ff4a2a', star: '#4aff6a', strobe: '#fff0d0' };
const RUNNER: FleetLook = { name: 'RUNNER', short: 'RUNNER', prefix: 'RN', hull: '#4a4a52', hull2: '#2e2e36', trim: '#e07a2a', engine: '#ffb070', window: '#ffd8a0', bolt: '#ffb070', style: 'curved', port: '#ff4a2a', star: '#4aff6a', strobe: '#ffffff' };

export function mountBlockade(host: SkinHost, o: BlockPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: BlockWorld = createBlockade(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera });
  const { GW, GH, u, planet } = world;
  const mapView = o.view === 'map';
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.3, closer: 1.8, maxZoom: 2.4 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const lr = host.fork('blk-look');
  const lookSeed = Math.floor(lr() * 1e6);
  const art = createShipArt();
  const glows = createGlows();
  const moonArt = createMoonArt();
  const text = createText(world);
  const map = createMapPainter(world, art, glows, lookSeed);
  let sky: HTMLCanvasElement | null = null;
  let rings: HTMLCanvasElement | null = null;
  let curtain: HTMLCanvasElement | null = null;
  let grain: HTMLCanvasElement | null = null;
  let planetP: PlanetPainter | null = null;
  const starRGB = rgbOf(world.star.color);
  const atmoRGB = rgbOf(world.planetLook.atmo);
  const lookOf = (s: { side: Ship['side']; tag?: string }) => (s.tag === 'defect' ? world.fleet : s.side === 'fleet' ? world.fleet : s.side === 'home' ? world.home : s.side === 'merchant' ? MERCHANT : RUNNER);
  const mOf = world.mOf;
  const fogOf = (z: number) => Math.pow(clamp((z - 0.18) / 0.82, 0, 1), 1.25) * 0.5;
  let lastPaint = -1;

  // ---- light -----------------------------------------------------------------------------------------
  function lighting(): Lighting {
    const S = world.light * (1 + world.flare * 0.7);
    const night = 1 - world.light;
    // The planet's day side below lights the bellies; when the star is behind it, the air's ring rims them.
    const shineK = (clamp(-world.L[1] * 1.4 + 0.3, 0, 1) * 0.32 * world.light + 0.05 + Math.pow(Math.max(0, -world.L[2]), 2) * 0.35) * (1 + world.flare);
    return {
      L: world.L, S, star: starRGB,
      amb: [0.06 + 0.04 * night, 0.065 + 0.05 * night, 0.09 + 0.08 * night],
      shine: [atmoRGB[0] * shineK, atmoRGB[1] * shineK, atmoRGB[2] * shineK],
    };
  }

  // ---- the sky, the star, moons, rings ----------------------------------------------------------------
  function drawSun() {
    const s = world.sun;
    if (!s.up) return;
    const g = glows.glow(world.star.glare);
    const near = s.x > -GW * 0.4 && s.x < GW * 1.4;
    if (!near) return;
    const vis = Math.max(0.15, s.vis);
    const R = 260 * u * (1 + world.flare);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * vis;
    ctx.drawImage(g, s.x - R, s.y - R, R * 2, R * 2);
    ctx.globalAlpha = 0.9 * vis;
    ctx.drawImage(glows.glow(world.star.color), s.x - s.r * 3, s.y - s.r * 3, s.r * 6, s.r * 6);
    // A thin flare across: the lens of the eye that sees it.
    ctx.globalAlpha = 0.35 * vis;
    ctx.drawImage(g, s.x - R * 2.2, s.y - 2.5 * u, R * 4.4, 5 * u);
    ctx.restore();
    ctx.fillStyle = css(starRGB.map((v) => Math.min(1, v * 1.05)) as [number, number, number]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  /** The star at the limb: where it sets or rises, the air blazes along the edge. */
  function drawLimbFlare() {
    const s = world.sun;
    if (!s.up) return;
    const ly = world.limbY(s.x);
    const d = Math.abs(Math.hypot(s.x - planet.cx, s.y - planet.cy) - planet.R);
    const k = clamp(1 - d / (90 * u), 0, 1);
    if (k <= 0 || !isFinite(ly)) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = glows.glow(world.star.glare);
    const yy = Math.min(s.y, ly);
    ctx.globalAlpha = 0.85 * k;
    ctx.drawImage(g, s.x - 520 * u, yy - 9 * u, 1040 * u, 18 * u);
    ctx.globalAlpha = 0.7 * k;
    ctx.drawImage(glows.glow('#ffffff'), s.x - 40 * u, yy - 40 * u, 80 * u, 80 * u);
    ctx.globalAlpha = 0.45 * k;
    ctx.drawImage(glows.glow(world.planetLook.dusk), s.x - 300 * u, yy - 60 * u, 600 * u, 120 * u);
    ctx.restore();
  }
  function drawMoons() {
    for (const mo of world.moons) {
      const c = moonArt(mo, world.L, 1);
      ctx.drawImage(c, mo.x - c.width / 2, mo.y - c.height / 2);
    }
  }
  function drawRings() {
    if (!world.rings) return;
    if (!rings) rings = bakeRings(world, lookSeed);
    if (!rings) return;
    const back = Math.pow(Math.max(0, -world.L[2]), 2);
    ctx.globalAlpha = clamp(0.2 + 0.45 * world.light * (0.5 + 0.5 * Math.max(0, world.L[2])) + back * 0.4, 0.12, 0.75);
    ctx.drawImage(rings, 0, 0, GW, GH);
    ctx.globalAlpha = 1;
  }

  // ---- on the planet ------------------------------------------------------------------------------------
  function drawScars() {
    const P = planetP!;
    ctx.save();
    for (const sc of world.scars) {
      const p = world.surf(sc.lat, sc.lon);
      if (p[2] < 0.05) continue;
      const age = world.t - sc.t0;
      const fore = 0.25 + 0.75 * p[2];
      const night = clamp((0.15 - P.lightAt(p[0], p[1])) / 0.3, 0, 1);
      const sz = sc.size * 26 * u * fore;
      if (age < 1.4) {
        ctx.globalCompositeOperation = 'lighter';
        const k = 1 - age / 1.4;
        ctx.globalAlpha = k;
        ctx.drawImage(glows.glow('#fff4d8'), p[0] - sz * 3, p[1] - sz * 3 * fore, sz * 6, sz * 6 * fore);
        ctx.globalAlpha = k * 0.6;
        ctx.strokeStyle = '#ffd8a0';
        ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        ctx.ellipse(p[0], p[1], sz * (1 + age * 3), sz * (1 + age * 3) * fore * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Smoke by day, fire by night.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = sc.heat * 0.45 * (1 - night * 0.6);
      ctx.drawImage(glows.soft('#2a2420'), p[0] - sz * 2.2 + age * 0.02 * u, p[1] - sz * 1.4 * fore, sz * 4.4, sz * 2.4 * fore);
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.75 + 0.25 * Math.sin(world.t * 7 + sc.lat * 400);
      ctx.globalAlpha = sc.heat * (0.25 + night * 0.75) * fl;
      ctx.drawImage(glows.glow('#ff7a2a'), p[0] - sz * 1.4, p[1] - sz * 0.8 * fore, sz * 2.8, sz * 1.6 * fore);
      ctx.globalAlpha = sc.heat * night * 0.8 * fl;
      for (let k = 0; k < 4; k++) {
        const ox = (hash(Math.floor(sc.lat * 1e5), k) - 0.5) * sz * 2;
        const oy = (hash(Math.floor(sc.lon * 1e5), k) - 0.5) * sz * fore;
        ctx.drawImage(glows.glow('#ffc060'), p[0] + ox - sz * 0.3, p[1] + oy - sz * 0.3, sz * 0.6, sz * 0.6);
      }
    }
    ctx.restore();
  }
  function drawEclipse() {
    const e = world.eclipse;
    if (!e) return;
    const k = (world.t - e.t0) / e.dur;
    const x = e.x0 + (e.x1 - e.x0) * k;
    const y = e.y0 + (e.y1 - e.y0) * k;
    const fade = Math.min(1, k * 8, (1 - k) * 8);
    ctx.save();
    ctx.beginPath();
    ctx.arc(planet.cx, planet.cy, planet.R, 0, Math.PI * 2);
    ctx.clip();
    const sq = 0.55;
    ctx.translate(x, y);
    ctx.scale(1, sq);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 1.8);
    g.addColorStop(0, `rgba(0,0,4,${0.82 * fade})`);
    g.addColorStop(0.3, `rgba(0,0,6,${0.7 * fade})`);
    g.addColorStop(0.62, `rgba(4,2,10,${0.3 * fade})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-e.r * 1.8, -e.r * 1.8, e.r * 3.6, e.r * 3.6);
    ctx.restore();
    // Under the shadow, the cities come on.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const city = world.planetLook.city;
    for (let i = 0; i < 70 * world.planetLook.cityK; i++) {
      const a = hash(i, 5) * Math.PI * 2;
      const rr = Math.sqrt(hash(i, 6)) * e.r * 0.55;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * sq;
      if (py < world.limbY(px) + 3) continue;
      ctx.globalAlpha = 0.6 * fade * hash(i, 7);
      const s = (1 + hash(i, 8) * 2) * u;
      ctx.drawImage(glows.glow(city), px - s * 2, py - s * 2, s * 4, s * 4);
    }
    ctx.restore();
  }
  function drawAurora() {
    if (world.aurora <= 0.01) return;
    if (!curtain) curtain = bakeCurtain('#5affa0', '#c060ff');
    const P = planetP!;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const step = 5 * u;
    for (let x = -step; x < GW + step; x += step) {
      const ly = world.limbY(x);
      if (!isFinite(ly)) continue;
      const night = clamp((0.25 - P.lightAt(x, ly + 4)) / 0.4, 0.15, 1);
      const n = 0.5 + 0.5 * Math.sin(x * 0.011 + world.t * 0.3) * Math.sin(x * 0.0037 - world.t * 0.17 + 2);
      const h = (40 + 90 * n) * u * world.aurora;
      ctx.globalAlpha = world.aurora * night * (0.25 + 0.5 * n) * (0.8 + 0.2 * Math.sin(world.t * 3 + x * 0.05));
      ctx.drawImage(curtain, x, ly - h + 6 * u, step + 1, h);
    }
    ctx.restore();
  }
  function drawGroundGun() {
    const gg = world.groundGun;
    if (!gg) return;
    const age = world.t - gg.t0;
    const p = world.surf(gg.lat, gg.lon);
    const t = world.ships.find((s) => s.id === gg.to);
    if (!t || age > 1.6) return;
    const k = Math.min(1, age * 3) * Math.max(0, 1 - (age - 0.8) / 0.8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(150,200,255,${0.5 * k})`;
    ctx.lineWidth = 14 * u;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(240,250,255,${0.95 * k})`;
    ctx.lineWidth = 3.5 * u;
    ctx.stroke();
    ctx.globalAlpha = k;
    ctx.drawImage(glows.glow('#cfe6ff'), p[0] - 70 * u, p[1] - 40 * u, 140 * u, 80 * u);
    ctx.drawImage(glows.glow('#ffffff'), t.x - 50 * u, t.y - 50 * u, 100 * u, 100 * u);
    ctx.restore();
  }
  function drawMeteors() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of world.meteors) {
      const k = (world.t - m.t0) / m.dur;
      const a = Math.sin(Math.min(1, k) * Math.PI);
      const len = Math.hypot(m.vx, m.vy) * 0.5;
      const dx = m.vx / (Math.hypot(m.vx, m.vy) || 1);
      const dy = m.vy / (Math.hypot(m.vx, m.vy) || 1);
      const g = ctx.createLinearGradient(m.x, m.y, m.x - dx * len, m.y - dy * len);
      g.addColorStop(0, `rgba(255,236,200,${0.9 * a})`);
      g.addColorStop(0.3, `rgba(255,150,70,${0.5 * a})`);
      g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, m.size * 0.5);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - dx * len, m.y - dy * len);
      ctx.stroke();
      ctx.globalAlpha = a;
      const s = Math.max(4, m.size * 2.2);
      ctx.drawImage(glows.glow('#ffd8a0'), m.x - s, m.y - s, s * 2, s * 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---- the station -------------------------------------------------------------------------------------
  function drawStation(lt: Lighting) {
    const st = world.station;
    const m = mOf(st.z);
    const fog = fogOf(st.z);
    const hull = rgbOf(world.fleet.hull);
    const hull2 = rgbOf(world.fleet.hull2);
    const shade = (base: number[], nx: number, ny: number, nz: number) => {
      const d = Math.max(0, nx * lt.L[0] - ny * lt.L[1] + nz * lt.L[2]) * lt.S;
      const v = [0, 1, 2].map((i) => base[i] * (lt.amb[i] + lt.star[i] * d * 1.1 + lt.shine[i] * Math.max(0, -ny)));
      return css(v.map((x, i) => x * (1 - fog) + [0.1, 0.15, 0.26][i] * fog) as [number, number, number]);
    };
    const lit = world.t - st.lit < 3 ? 0.5 + 0.5 * Math.sin((world.t - st.lit) * 20) : 1;
    const builtLights = st.stage >= 1 || st.built > st.plan * 0.6;
    const winA = (builtLights ? 0.85 : 0.35) * lit;
    const scaffold = (x0: number, y0: number, x1: number, y1: number, th: number) => {
      ctx.strokeStyle = shade(hull2, 0, 0.5, 0.8);
      ctx.lineWidth = Math.max(0.6, 1.1 * u * m);
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const nl = Math.hypot(nx, ny) || 1;
      const ox = (nx / nl) * th * 0.5;
      const oy = (ny / nl) * th * 0.5;
      ctx.beginPath();
      ctx.moveTo(x0 + ox, y0 + oy);
      ctx.lineTo(x1 + ox, y1 + oy);
      ctx.moveTo(x0 - ox, y0 - oy);
      ctx.lineTo(x1 - ox, y1 - oy);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const a = i / n;
        const b = (i + 1) / n;
        ctx.moveTo(x0 + (x1 - x0) * a + ox, y0 + (y1 - y0) * a + oy);
        ctx.lineTo(x0 + (x1 - x0) * b - ox, y0 + (y1 - y0) * b - oy);
      }
      ctx.stroke();
    };
    if (st.kind === 'wheel') {
      const R0 = 180 * u * m;
      const e = 0.3;
      const segs = 12;
      const built = Math.min(segs, st.built);
      const seg = (i: number, front: boolean) => {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        const isFront = Math.sin(mid) > 0;
        if (isFront !== front) return;
        const x0 = st.x + Math.cos(a0) * R0;
        const y0 = st.y + Math.sin(a0) * R0 * e;
        const x1 = st.x + Math.cos(a1) * R0;
        const y1 = st.y + Math.sin(a1) * R0 * e;
        const th = 16 * u * m;
        if (i < built || (i === built && world.station.work > 0)) {
          const part = i < built ? 1 : world.station.work;
          if (i === built) scaffold(x0, y0, x1, y1, th);
          const nx = Math.cos(mid);
          const nz = Math.sin(mid);
          ctx.strokeStyle = shade(hull, nx, 0, nz);
          ctx.lineWidth = th;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.ellipse(st.x, st.y, R0, R0 * e, 0, a0, a0 + (a1 - a0) * part);
          ctx.stroke();
          ctx.strokeStyle = shade(hull, nx * 0.5, 0.85, nz * 0.5);
          ctx.lineWidth = th * 0.35;
          ctx.beginPath();
          ctx.ellipse(st.x, st.y - th * 0.45, R0, R0 * e, 0, a0, a0 + (a1 - a0) * part);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = Math.max(0.5, u * m);
          ctx.beginPath();
          ctx.moveTo(x0, y0 - th / 2);
          ctx.lineTo(x0, y0 + th / 2);
          ctx.stroke();
          if (part >= 1 && winA > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = hexToRgba(world.fleet.window, winA * (front ? 1 : 0.5));
            for (let k = 0; k < 8; k++) {
              if (hash(i, k, st.seed) < 0.3) continue;
              const a = a0 + ((k + 0.5) / 8) * (a1 - a0);
              ctx.fillRect(st.x + Math.cos(a) * R0, st.y + Math.sin(a) * R0 * e + th * 0.1, Math.max(1, 2.2 * u * m), Math.max(1, 1.4 * u * m));
            }
            ctx.restore();
          }
        } else scaffold(x0, y0, x1, y1, th * 0.8);
      };
      const spokes = (front: boolean) => {
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          if (Math.sin(a) > 0 !== front) continue;
          if (built < (k + 1) * 3) continue;
          ctx.strokeStyle = shade(hull2, Math.cos(a), 0.3, Math.sin(a));
          ctx.lineWidth = 5 * u * m;
          ctx.beginPath();
          ctx.moveTo(st.x, st.y);
          ctx.lineTo(st.x + Math.cos(a) * R0, st.y + Math.sin(a) * R0 * e);
          ctx.stroke();
        }
      };
      for (let i = 0; i < segs; i++) seg(i, false);
      spokes(false);
      // Docking arms (the second stage) and solar wings (the third).
      const arms = clamp(st.built - 12, 0, 8);
      for (let k = 0; k < arms; k++) {
        const side = k % 2 ? 1 : -1;
        const len = (R0 * 1.25 + Math.floor(k / 2) * 30 * u * m) * side;
        const yy = st.y + (Math.floor(k / 2) - 1.5) * 12 * u * m;
        ctx.fillStyle = shade(hull2, 0, 0.3, 1);
        ctx.fillRect(Math.min(st.x, st.x + len), yy - 2.5 * u * m, Math.abs(len), 5 * u * m);
        ctx.fillStyle = shade(hull, 0, 0, 1);
        ctx.fillRect(st.x + len - 10 * u * m * side - 5 * u * m, yy - 6 * u * m, 10 * u * m, 12 * u * m);
      }
      const wings = clamp(st.built - 20, 0, 6);
      for (let k = 0; k < wings; k++) {
        const up = k % 2 ? 1 : -1;
        const yy = st.y + up * (60 + Math.floor(k / 2) * 46) * u * m;
        const gr = ctx.createLinearGradient(0, yy - 20 * u * m, 0, yy + 20 * u * m);
        gr.addColorStop(0, shade([0.25, 0.32, 0.55], 0, 0.6, 0.8));
        gr.addColorStop(1, shade([0.12, 0.16, 0.3], 0, -0.4, 0.9));
        ctx.fillStyle = gr;
        ctx.fillRect(st.x - 70 * u * m, yy - 18 * u * m, 140 * u * m, 36 * u * m);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = Math.max(0.5, u * m);
        for (let j = 1; j < 7; j++) {
          ctx.beginPath();
          ctx.moveTo(st.x - 70 * u * m + j * 20 * u * m, yy - 18 * u * m);
          ctx.lineTo(st.x - 70 * u * m + j * 20 * u * m, yy + 18 * u * m);
          ctx.stroke();
        }
      }
      // The hub: a drum with a spire.
      const hw = 34 * u * m;
      const hh = 120 * u * m;
      const hg = ctx.createLinearGradient(st.x - hw / 2, 0, st.x + hw / 2, 0);
      hg.addColorStop(0, shade(hull, -0.9, 0, 0.4));
      hg.addColorStop(0.5, shade(hull, 0, 0, 1));
      hg.addColorStop(1, shade(hull, 0.9, 0, 0.4));
      ctx.fillStyle = hg;
      ctx.fillRect(st.x - hw / 2, st.y - hh * 0.6, hw, hh);
      ctx.fillStyle = shade(hull2, 0, 0.9, 0.4);
      ctx.beginPath();
      ctx.ellipse(st.x, st.y - hh * 0.6, hw / 2, hw * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(hull2, 0, 0.5, 0.8);
      ctx.lineWidth = Math.max(0.7, 1.4 * u * m);
      ctx.beginPath();
      ctx.moveTo(st.x, st.y - hh * 0.6);
      ctx.lineTo(st.x, st.y - hh * 1.05);
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexToRgba(world.fleet.window, winA);
      for (let k = 0; k < 14; k++) if (hash(k, st.seed) > 0.35) ctx.fillRect(st.x - hw * 0.35 + (k % 3) * hw * 0.3, st.y - hh * 0.5 + Math.floor(k / 3) * hh * 0.17, Math.max(1, 3 * u * m), Math.max(1, 2 * u * m));
      const blink = Math.sin(world.t * 3 + st.seed) > 0.6;
      if (blink) {
        const s = 14 * u * m + 4;
        ctx.drawImage(glows.glow(world.fleet.port), st.x - s, st.y - hh * 1.05 - s, s * 2, s * 2);
      }
      ctx.restore();
      spokes(true);
      for (let i = 0; i < segs; i++) seg(i, true);
    } else {
      // An orbital ring, built across the sky above the limb.
      const x0 = GW * 0.12;
      const x1 = GW * 0.88;
      const n = 14;
      const th = 9 * u * m * 1.6;
      const band = (yOff: number, from: number, count: number) => {
        for (let i = 0; i < count; i++) {
          const a = x0 + ((x1 - x0) * i) / count;
          const b = x0 + ((x1 - x0) * (i + 1)) / count;
          const idx = from + i;
          const ya = world.laneY(a, st.y) + yOff;
          const yb = world.laneY(b, st.y) + yOff;
          const done = idx < st.built;
          const working = idx === st.built;
          if (!done && !working) {
            scaffold(a, ya, b, yb, th * 0.7);
            continue;
          }
          if (working) scaffold(a, ya, b, yb, th * 0.8);
          const part = done ? 1 : world.station.work;
          const bx = a + (b - a) * part;
          const by = ya + (yb - ya) * part;
          ctx.strokeStyle = shade(hull, 0, 0, 1);
          ctx.lineWidth = th;
          ctx.beginPath();
          ctx.moveTo(a, ya);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.strokeStyle = shade(hull, 0, 0.9, 0.4);
          ctx.lineWidth = th * 0.35;
          ctx.beginPath();
          ctx.moveTo(a, ya - th * 0.45);
          ctx.lineTo(bx, by - th * 0.45);
          ctx.stroke();
          if (done && winA > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = hexToRgba(world.fleet.window, winA);
            for (let k = 0; k < 6; k++) if (hash(idx, k, st.seed) > 0.3) ctx.fillRect(a + ((k + 0.5) / 6) * (b - a), ya + ((k + 0.5) / 6) * (yb - ya), Math.max(1, 2 * u * m), Math.max(1, 1.2 * u * m));
            ctx.restore();
          }
        }
      };
      // The tethers down to the planet (the third stage), behind; the bands.
      const teth = clamp(st.built - 24, 0, 6);
      for (let k = 0; k < teth; k++) {
        const x = x0 + ((k + 0.5) / 6) * (x1 - x0);
        const y = world.laneY(x, st.y);
        ctx.strokeStyle = shade(hull2, 0, 0, 1);
        ctx.lineWidth = Math.max(0.8, 2 * u * m);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, world.limbY(x) + 30 * u);
        ctx.stroke();
        const cy2 = y + ((world.t * 6 + k * 40) % (world.limbY(x) - y));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glows.glow(world.fleet.window), x - 4 * u, cy2 - 4 * u, 8 * u, 8 * u);
        ctx.restore();
      }
      band(0, 0, n);
      if (st.built > 14) band(-th * 2.6, 14, Math.min(10, st.built - 13));
    }
  }

  // ---- ships ---------------------------------------------------------------------------------------------
  const trails = new Map<number, { x: number; y: number }[]>();
  let trailT = 0;
  function sampleTrails(t: number) {
    if (t - trailT < 0.07) return;
    trailT = t;
    const live = new Set<number>();
    for (const s of world.ships) {
      if (s.cls !== 'fighter' && s.cls !== 'shuttle' && s.cls !== 'corvette' && !(s.z > 0.95)) continue;
      live.add(s.id);
      let tr = trails.get(s.id);
      if (!tr) trails.set(s.id, (tr = []));
      tr.push({ x: s.x, y: s.y });
      if (tr.length > 16) tr.shift();
    }
    for (const id of trails.keys()) if (!live.has(id)) trails.delete(id);
  }
  function blinkOn(kind: string, t: number, seed: number) {
    const ph = (t + (seed % 100) * 0.037) % (kind === 'strobe' ? 1.7 : kind === 'beacon' ? 2.4 : 2);
    if (kind === 'strobe') return ph < 0.06 || (ph > 0.2 && ph < 0.26) ? 1 : 0;
    if (kind === 'beacon') return Math.max(0, Math.sin((ph / 2.4) * Math.PI * 2)) ** 3;
    return ph < 1.1 ? 1 : 0.15;
  }
  function drawShip(s: Ship, lt: Lighting, speaker: number) {
    const m = mOf(s.z);
    const Lp = STATS[s.cls].len * u * m;
    if (s.name === 'MARKER') return;
    const look = lookOf(s);
    const d: Design = art.design(s.cls, look, s.seed, s.side === 'merchant');
    const t = world.t;
    const tr = trails.get(s.id);
    const inAir = s.z > 1.0 && world.latLon(s.x, s.y) !== null;
    const heat = inAir ? clamp((s.z - 1.0) / 0.25, 0, 1) : 0;
    if (tr && tr.length > 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        ctx.strokeStyle = heat > 0.05 ? `rgba(255,${Math.round(150 + 60 * k)},90,${0.5 * k * heat})` : hexToRgba(look.engine, 0.22 * k * (s.thrust + 0.2));
        ctx.lineWidth = Math.max(0.6, (heat > 0.05 ? 5 * heat : 1.6) * u * m * 3 * k);
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (Lp < 3.5) {
      ctx.fillStyle = hexToRgba(look.hull, 0.8);
      ctx.fillRect(s.x - 1, s.y - 0.5, 2, 1);
    } else {
      const fog = fogOf(Math.min(1, s.z));
      const kind = s.dark ? 'wreck' : 'body';
      const body = art.sprite(d, Lp, lt, fog, s.dir, kind);
      const sq = Math.max(0.1, Math.abs(Math.cos(s.turn * Math.PI)));
      if (body) {
        const k = Lp / body.Lp;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(s.dir * sq * k, k);
        if (s.state === 'dying') ctx.rotate(Math.sin(world.t * 0.5 + s.seed) * 0.02 * (world.t - s.t0));
        ctx.globalAlpha = s.state === 'tow' ? 0.9 : 1;
        ctx.drawImage(body.c, -body.ax, -body.ay);
        if (!s.dark) {
          const glow = art.sprite(d, Lp, lt, fog, s.dir, 'glow');
          if (glow) {
            ctx.globalAlpha = 1 - fog * 0.4;
            ctx.drawImage(glow.c, -glow.ax, -glow.ay);
          }
        }
        ctx.restore();
      }
      // Engines, running lights.
      if (!s.dark) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(s.dir * sq, 1);
        ctx.globalCompositeOperation = 'lighter';
        const eg = glows.glow(look.engine);
        const fl = 0.85 + 0.15 * Math.sin(t * 31 + s.seed);
        for (const e of d.engines) {
          const ex = -(0.5 + e.len) * Lp;
          const ey = e.y * Lp;
          const r0 = Math.max(1.2, e.r * Lp);
          const len = r0 * (2 + s.thrust * 9) * fl;
          ctx.globalAlpha = 0.5 + s.thrust * 0.5;
          ctx.drawImage(eg, ex - len, ey - r0 * 1.6, len * 1.15, r0 * 3.2);
          ctx.globalAlpha = 0.9;
          ctx.drawImage(glows.glow('#ffffff'), ex - r0 * 1.2, ey - r0 * 0.9, r0 * 2, r0 * 1.8);
        }
        if (Lp > 14) {
          for (const l of art.lights(d)) {
            const on = s.side === 'fleet' && world.ships.some((q) => q.cls === 'flagship' && q.state === 'transit') && l.kind === 'strobe' ? (Math.floor(t * 2) % 2 ? 1 : 0) : blinkOn(l.kind, t, s.seed);
            if (on < 0.05) continue;
            const col = l.kind === 'port' ? look.port : l.kind === 'star' ? look.star : l.kind === 'strobe' ? look.strobe : look.port;
            const r = Math.max(2.5, 0.012 * Lp + 2) * (l.kind === 'strobe' ? 1.6 : 1);
            ctx.globalAlpha = on;
            ctx.drawImage(glows.glow(col), l.x * Lp - r, -l.y * Lp - r, r * 2, r * 2);
          }
        }
        ctx.restore();
      }
      // A capital ship's name, stencilled on her side (lit by floodlights in the dark).
      if (Lp > 240 && (s.side === 'fleet' || s.side === 'home') && !s.dark && s.cls !== 'tender') {
        const nx = 0.12 * s.dir * Lp * sq;
        const hh = (at(d.top, 0.62) + at(d.bot, 0.62)) * Lp;
        const ny = -at(d.top, 0.62) * Lp + hh * 0.42;
        const px = Math.max(9, Math.min(22, Lp * 0.024));
        ctx.save();
        ctx.font = `700 ${px}px "Electrolize", "Arial Narrow", "Inter", sans-serif`;
        (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px * 0.25}px`;
        ctx.textAlign = 'center';
        const name = `${look.prefix} ${s.name}`;
        const lit = clamp(world.light * (0.4 + 0.6 * Math.max(0, world.L[2] + 0.4)), 0, 1);
        if (lit < 0.6) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (0.6 - lit) * 0.6 * (1 - fogOf(s.z));
          const w = ctx.measureText(name).width;
          ctx.drawImage(glows.soft('#fff0d0'), s.x + nx - w * 0.7, s.y + ny - px * 1.6, w * 1.4, px * 2.4);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = (0.35 + 0.45 * Math.max(lit, 0.5)) * (1 - fogOf(s.z));
        ctx.fillStyle = '#eef0ea';
        ctx.fillText(name, s.x + nx, s.y + ny + px * 0.35);
        ctx.restore();
      }
      // Damage: fires and venting.
      if (s.dmg > 0.25 || s.state === 'dying') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const n = s.state === 'dying' ? 5 : 2;
        for (let i = 0; i < n; i++) {
          const fx = (hash(s.seed, i) - 0.5) * Lp * 0.8;
          const fy = (hash(s.seed, i, 2) - 0.6) * Lp * 0.06;
          const r = (6 + hash(s.seed, i, 3) * 10) * u * m * 2 * (0.7 + 0.3 * Math.sin(t * 9 + i));
          ctx.globalAlpha = 0.8;
          ctx.drawImage(glows.glow('#ff8a30'), s.x + fx - r, s.y + fy - r, r * 2, r * 2);
        }
        ctx.restore();
      }
      if (t - s.shieldT < 0.45) {
        const k = 1 - (t - s.shieldT) / 0.45;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k * 0.55;
        const hh = (d.up + d.down) * Lp;
        ctx.drawImage(glows.soft('#8ac8ff'), s.x - Lp * 0.62, s.y - hh * 0.9, Lp * 1.24, hh * 1.8);
        ctx.restore();
      }
    }
    if (heat > 0.02) {
      // Re-entry: a sheath of plasma round the nose.
      const r = (10 + 26 * heat) * u * Math.max(0.35, m * 2.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = heat;
      ctx.drawImage(glows.glow('#ffb060'), s.x - r, s.y - r, r * 2, r * 2);
      ctx.drawImage(glows.glow('#ffffff'), s.x - r * 0.3, s.y - r * 0.3, r * 0.6, r * 0.6);
      ctx.restore();
    }
    if (speaker === s.id && o.labels) brackets(s.x, s.y, Math.max(16 * u, Lp * 0.55), Math.max(10 * u, Lp * 0.12), s.side === 'fleet' ? world.fleet.trim : s.side === 'home' ? world.home.trim : '#f0a050');
  }
  /** Thin corner brackets round whoever is speaking, so the subtitle has a face. */
  function brackets(x: number, y: number, hw: number, hh: number, color: string) {
    const c = Math.min(hw, hh) * 0.5 + 4;
    ctx.save();
    ctx.strokeStyle = hexToRgba(color, 0.75);
    ctx.lineWidth = 1.2 / Math.max(0.5, cam.zoom);
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(x + sx * hw, y + sy * hh - sy * c);
      ctx.lineTo(x + sx * hw, y + sy * hh);
      ctx.lineTo(x + sx * hw - sx * c, y + sy * hh);
    }
    ctx.stroke();
    ctx.restore();
  }
  function drawWreck(w: Wreck, lt: Lighting) {
    const m = mOf(w.z);
    const Lp = w.len * u * m;
    const look = w.side === 'fleet' ? world.fleet : w.side === 'home' ? world.home : w.side === 'merchant' ? MERCHANT : RUNNER;
    const d = art.design(w.cls, look, w.seed, w.side === 'merchant');
    const spr = art.sprite(d, Lp, lt, fogOf(Math.min(1, w.z)), w.dir, 'wreck');
    if (!spr) return;
    const age = world.t - w.t0;
    const k = Lp / spr.Lp;
    const burn = w.fall > 0 ? clamp((world.t - w.fall) / 14, 0, 1) : 0;
    const cutX = spr.ax + (w.cut - 0.5) * spr.Lp * w.dir;
    for (const piece of [0, 1]) {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.scale(k, k);
      const sgn = piece ? 1 : -1;
      ctx.translate(sgn * w.part / k, sgn * w.part * 0.3 / k);
      ctx.rotate(sgn * w.spin * age);
      ctx.scale(w.dir, 1);
      ctx.beginPath();
      // Jagged break.
      const cx0 = cutX - spr.ax;
      const top = -spr.ay;
      const bot = spr.h - spr.ay;
      if (piece === 0) {
        ctx.moveTo(-spr.ax, top);
        for (let i = 0; i <= 6; i++) ctx.lineTo(cx0 + (hash(w.seed, i) - 0.5) * spr.Lp * 0.04, top + ((bot - top) * i) / 6);
        ctx.lineTo(-spr.ax, bot);
      } else {
        ctx.moveTo(spr.w - spr.ax, top);
        for (let i = 0; i <= 6; i++) ctx.lineTo(cx0 + (hash(w.seed, i) - 0.5) * spr.Lp * 0.04, top + ((bot - top) * i) / 6);
        ctx.lineTo(spr.w - spr.ax, bot);
      }
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = 1 - burn * 0.9;
      ctx.drawImage(spr.c, -spr.ax, -spr.ay);
      ctx.restore();
    }
    // Fire along the break.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bx = w.x + (w.cut - 0.5) * Lp * w.dir;
    for (let i = 0; i < 3; i++) {
      const r = (8 + 10 * hash(w.seed, i, 9)) * u * m * 2 * (0.6 + 0.4 * Math.sin(world.t * 6 + i * 2)) * (0.4 + w.fire);
      ctx.globalAlpha = 0.7 * w.fire;
      ctx.drawImage(glows.glow('#ff9040'), bx - r + (i - 1) * Lp * 0.03, w.y - r + (i - 1) * Lp * 0.02, r * 2, r * 2);
    }
    if (burn > 0) {
      const r = Lp * (0.4 + burn * 0.5);
      ctx.globalAlpha = Math.sin(burn * Math.PI) * 0.9;
      ctx.drawImage(glows.glow('#ffb060'), w.x - r, w.y - r * 0.4, r * 2, r * 0.8);
      ctx.drawImage(glows.glow('#ffffff'), w.x - r * 0.3, w.y - r * 0.12, r * 0.6, r * 0.24);
      // Fragments streaming behind as it burns.
      for (let i = 0; i < 6; i++) {
        const q = (burn * 3 + i / 6) % 1;
        const fx = w.x - q * 160 * u * w.dir + (hash(w.seed, i, 4) - 0.5) * 40 * u;
        const fy = w.y - q * 40 * u + (hash(w.seed, i, 5) - 0.5) * 20 * u;
        ctx.globalAlpha = (1 - q) * 0.8;
        ctx.drawImage(glows.glow('#ffa050'), fx - 6 * u, fy - 6 * u, 12 * u, 12 * u);
      }
    }
    ctx.restore();
  }
  function drawDebris(lt: Lighting) {
    const base = rgbOf(world.fleet.hull2);
    for (const d of world.debris) {
      const s = d.size;
      const c = Math.cos(d.rot);
      const sn = Math.sin(d.rot);
      const lit = 0.25 + 0.75 * Math.max(0, c * lt.L[0] - sn * lt.L[1]) * lt.S;
      ctx.fillStyle = css([base[0] * lit + 0.03, base[1] * lit + 0.03, base[2] * lit + 0.05], 0.95 * (1 - fogOf(Math.min(1, d.z)) * 0.6));
      ctx.beginPath();
      ctx.moveTo(d.x + c * s, d.y + sn * s);
      ctx.lineTo(d.x - sn * s * 0.6, d.y + c * s * 0.6);
      ctx.lineTo(d.x - c * s * 0.8, d.y - sn * s * 0.5);
      ctx.closePath();
      ctx.fill();
      if (d.hot > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = d.hot;
        ctx.drawImage(glows.glow('#ff9040'), d.x - s * 2, d.y - s * 2, s * 4, s * 4);
        ctx.restore();
      }
    }
  }
  function drawBolt(b: Bolt) {
    const t = world.t;
    const k = (t - b.t0) / b.dur;
    const m = mOf(b.z0 + (b.z1 - b.z0) * Math.min(1, k));
    const dx = b.x1 - b.x0;
    const dy = b.y1 - b.y0;
    const dist = Math.hypot(dx, dy) || 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (b.kind === 'beam' || b.kind === 'ion') {
      const a = Math.max(0, 1 - k);
      ctx.strokeStyle = hexToRgba(b.color, 0.45 * a);
      ctx.lineWidth = Math.max(1.5, 9 * u * m);
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.x1, b.y1);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`;
      ctx.lineWidth = Math.max(0.8, 2.5 * u * m);
      ctx.stroke();
      ctx.globalAlpha = a;
      const r = 30 * u * Math.max(m, 0.3);
      ctx.drawImage(glows.glow(b.color), b.x1 - r, b.y1 - r, r * 2, r * 2);
      ctx.restore();
      return;
    }
    const kk = Math.min(b.hit ? 1 : 1.5, k);
    const hx = b.x0 + dx * kk;
    const hy = b.y0 + dy * kk;
    const fade = b.hit ? 1 : clamp((1.5 - k) / 0.5, 0, 1);
    if (b.kind === 'missile') {
      ctx.strokeStyle = `rgba(200,200,210,${0.18 * fade})`;
      ctx.lineWidth = Math.max(0.6, 1.5 * u * m);
      ctx.beginPath();
      ctx.moveTo(b.x0 + dx * Math.max(0, kk - 0.4), b.y0 + dy * Math.max(0, kk - 0.4));
      ctx.lineTo(hx, hy);
      ctx.stroke();
      const r = 8 * u * Math.max(m, 0.4);
      ctx.globalAlpha = fade;
      ctx.drawImage(glows.glow('#ffd8a0'), hx - r, hy - r, r * 2, r * 2);
    } else {
      const len = (b.kind === 'heavy' ? 70 : 34) * u * Math.max(m, 0.3);
      const tx = hx - (dx / dist) * len;
      const ty = hy - (dy / dist) * len;
      ctx.strokeStyle = hexToRgba(b.color, 0.55 * fade);
      ctx.lineWidth = Math.max(1, (b.kind === 'heavy' ? 7 : 3.5) * u * m);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * fade})`;
      ctx.lineWidth = Math.max(0.6, (b.kind === 'heavy' ? 2.4 : 1.2) * u * m);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawFx(f: Fx) {
    const age = world.t - f.t0;
    const k = age / f.dur;
    if (k < 0 || k > 1) return;
    ctx.save();
    if (f.kind === 'smoke') {
      ctx.globalAlpha = 0.5 * (1 - k) * Math.min(1, age * 2);
      const r = f.r * (0.6 + k * 1.2);
      ctx.drawImage(glows.soft(f.color), f.x - r, f.y - r, r * 2, r * 2);
      ctx.restore();
      return;
    }
    if (f.kind === 'shard') {
      ctx.fillStyle = `rgba(60,58,60,${1 - k})`;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot + age * 4);
      ctx.fillRect(-f.r * 0.3, -f.r * 0.1, f.r * 0.6, f.r * 0.2);
      ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    if (f.kind === 'flash' || f.kind === 'muzzle' || f.kind === 'hit') {
      const a = Math.pow(1 - k, 2);
      const r = f.r * (0.7 + k * 0.6);
      ctx.globalAlpha = a;
      ctx.drawImage(glows.glow(f.color), f.x - r, f.y - r, r * 2, r * 2);
      if (f.kind === 'flash') ctx.drawImage(glows.glow('#ffffff'), f.x - r * 0.3, f.y - r * 0.3, r * 0.6, r * 0.6);
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = hexToRgba(f.color, 0.55 * (1 - k));
      ctx.lineWidth = Math.max(1, f.r * 0.05 * (1 - k));
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r * Math.sqrt(k), f.r * Math.sqrt(k) * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'fire') {
      const r = f.r * (0.5 + k);
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.drawImage(glows.glow(k < 0.3 ? '#ffe0a0' : f.color), f.x - r, f.y - r, r * 2, r * 2);
    } else if (f.kind === 'spark' || f.kind === 'weld') {
      ctx.strokeStyle = hexToRgba(f.color, 1 - k);
      ctx.lineWidth = Math.max(0.6, f.r * 0.12);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x - f.vx * 0.08, f.y - f.vy * 0.08);
      ctx.stroke();
      if (f.kind === 'weld') {
        ctx.globalAlpha = (1 - k) * (0.5 + 0.5 * Math.sin(age * 60));
        ctx.drawImage(glows.glow('#e0f0ff'), f.x - f.r * 2, f.y - f.r * 2, f.r * 4, f.r * 4);
      }
    } else if (f.kind === 'jump') {
      // The streak: a line of light from far behind, drawn in to the ship.
      const q = Math.min(1, k * 1.6);
      const tx = f.x2 + (f.x - f.x2) * q;
      const ty = f.y2 + (f.y - f.y2) * q;
      const g = ctx.createLinearGradient(tx, ty, f.x, f.y);
      g.addColorStop(0, hexToRgba(f.color, 0));
      g.addColorStop(1, hexToRgba('#ffffff', 0.95 * (1 - k)));
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, f.r * 0.04 * (1 - k * 0.5));
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
    } else if (f.kind === 'scan') {
      const a = Math.sin(k * Math.PI) * 0.22;
      const sweep = Math.sin(age * 3) * f.r * 0.6;
      ctx.fillStyle = hexToRgba(f.color, a);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x2 + sweep, f.y2 - f.r * 0.5);
      ctx.lineTo(f.x2 + sweep, f.y2 + f.r * 0.5);
      ctx.closePath();
      ctx.fill();
    } else if (f.kind === 'tractor') {
      const tgt = world.ships.find((q) => q.id === f.seed);
      if (tgt) {
        const a = Math.min(1, age * 2) * (1 - Math.max(0, k - 0.85) / 0.15) * 0.3;
        const g = ctx.createLinearGradient(f.x, f.y, tgt.x, tgt.y);
        g.addColorStop(0, hexToRgba(f.color, a));
        g.addColorStop(1, hexToRgba(f.color, a * 0.4));
        ctx.fillStyle = g;
        const w = f.r;
        const nx = -(tgt.y - f.y);
        const ny = tgt.x - f.x;
        const nl = Math.hypot(nx, ny) || 1;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(tgt.x + (nx / nl) * w, tgt.y + (ny / nl) * w);
        ctx.lineTo(tgt.x - (nx / nl) * w, tgt.y - (ny / nl) * w);
        ctx.closePath();
        ctx.fill();
        // Bands of the field running down the beam.
        ctx.strokeStyle = hexToRgba('#e0f0ff', a * 1.2);
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const q = ((age * 0.6 + i / 4) % 1);
          const x = tgt.x + (f.x - tgt.x) * q;
          const y = tgt.y + (f.y - tgt.y) * q;
          const ww = w * (1 - q);
          ctx.beginPath();
          ctx.moveTo(x + (nx / nl) * ww, y + (ny / nl) * ww);
          ctx.lineTo(x - (nx / nl) * ww, y - (ny / nl) * ww);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ---- the frame -------------------------------------------------------------------------------------------
  function scene(t: number) {
    const jumped = Math.abs(t - lastPaint) > 2;
    lastPaint = t;
    art.frame(jumped ? 999 : 3);
    if (!sky) sky = bakeSky(world, lookSeed, world.backdrop, world.skyTint[0], world.skyTint[1]);
    if (!planetP) planetP = createPlanetPainter(world, lookSeed);
    sampleTrails(t);
    const lt = lighting();
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(sky, 0, 0, GW, GH);
    drawSun();
    drawMoons();
    drawRings();
    planetP.draw(ctx, t);
    drawScars();
    drawEclipse();
    drawAurora();
    drawMeteors();
    drawGroundGun();
    drawLimbFlare();
    // Everything in orbit, far to near.
    type D = { z: number; draw: () => void };
    const list: D[] = [];
    list.push({ z: world.station.z, draw: () => drawStation(lt) });
    const speaker = text.speaker();
    for (const s of world.ships) list.push({ z: s.z, draw: () => drawShip(s, lt, speaker) });
    for (const w of world.wrecks) list.push({ z: w.z, draw: () => drawWreck(w, lt) });
    list.push({ z: 0.55, draw: () => drawDebris(lt) });
    for (const b of world.bolts) list.push({ z: b.z0 + (b.z1 - b.z0) * Math.min(1, (world.t - b.t0) / b.dur) - 0.001, draw: () => drawBolt(b) });
    for (const f of world.fx) list.push({ z: f.z - 0.002, draw: () => drawFx(f) });
    list.sort((a, b) => b.z - a.z);
    for (const it of list) it.draw();
    // The flare: the whole sky goes white for a moment.
    if (world.flare > 0.01) {
      const sx = world.sun.up ? clamp(world.sun.x, -GW * 0.2, GW * 1.2) : GW / 2;
      const sy = world.sun.up ? world.sun.y : -GH * 0.2;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, GW);
      g.addColorStop(0, hexToRgba(world.star.color, 0.55 * world.flare));
      g.addColorStop(1, hexToRgba(world.star.glare, 0.08 * world.flare));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GW, GH);
      ctx.restore();
    }
    ctx.restore();
  }
  function grade(t: number) {
    if (!grain) {
      grain = mkCanvas(128, 128);
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
      const step = Math.floor(t * 12);
      ctx.translate((step * 37) % 128, (step * 53) % 128);
      ctx.fillStyle = pat;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.4, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,4,0)');
    vg.addColorStop(1, 'rgba(0,0,4,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  function paint(t: number) {
    ctx.fillStyle = '#020309';
    ctx.fillRect(0, 0, W, H);
    if (mapView) map.draw(ctx, W, H, t, { zoom: cam.zoom, x: cam.x, y: cam.y });
    else {
      scene(t);
      grade(t);
    }
    text.draw(ctx, W, H, t, { labels: o.labels, hud: o.hud, level: 0.6 + 0.4 * host.intensity, mapMode: mapView });
    void DISPLAY;
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => (mapView ? map.project(x, y, W, H) : [SX(x), SY(y)]),
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => (mapView ? map.unproject(x, y, W, H) : [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y]),
    after: (dt) => {
      framing.update(dt, world.t, world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => paint(t),
    ambience: () => (world.alarm ? 0.9 : world.flare > 0.2 ? 0.8 : 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
