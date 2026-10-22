/**
 * Walking Castle, painted: a frame from a hand-painted film, or the same walk on a travel map.
 *
 * The scene, back to front: the sky (sun or a big moon, stars, shooting stars), the far cumulus,
 * the mountains, the war's guns flashing beyond them, the big cumulus, the far hills (their towns,
 * burning and in ruins, the bombers over them, another walking house), the lakes and the sea, the
 * middle country (fields and hedges, towns, windmills, its sheep, a wreck, a struck tree), the
 * shadows of the clouds, the near hill (the wind in its grass, tar, puddles, people on the road,
 * sheep, the tar men), the castle and its smoke and steam, the ships overhead, the grass in front;
 * rain and lightning; then the words: a title card for the big moments, and what is said, as
 * subtitles. No tags, no log on the screen: the picture tells the rest.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp } from '../../instruments/kit';
import { createCastlePainter } from './castle';
import { drawBomber, drawFlock, drawGunboat, drawHen, drawWalkingHouse, drawPuddle, drawRuin, drawSheep, drawStain, drawStruck, drawTarMan, drawWalker, drawWreck } from './figures';
import { clamp01, hash, midS, MIDS, PLANES } from './land';
import { createMapPainter } from './map';
import { createScenery } from './scenery';
import { nightOf, createWalkingCastle } from './sim';
import { bakeCloud, bakeMoon, createEnv, drawBolt, drawRain, drawRainbow, drawSky, drawStars, goldenOf, mix, rgba, tintCloud, type CloudBake } from './sky';
import type { CastleWorld } from './types';

export type CastlePaintOptions = { view: string; pace: number; camera: string; labels: boolean; hud: boolean };

export const SERIF = (px: number, italic = false, weight = '') => `${italic ? 'italic ' : ''}${weight ? `${weight} ` : ''}${px}px "Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;

export function mountWalkingCastle(host: SkinHost, o: CastlePaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: CastleWorld = createWalkingCastle(host.config.seed, W, H, { pace: o.pace, camera: o.camera });
  const { GW, GH, u, land } = world;
  const { HY } = land;
  const dir = world.castle.dir;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.3, closer: 1.8, maxZoom: 2.6 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const E = createEnv(ctx, u);
  const lr = host.fork('castle-look');
  const stars = Array.from({ length: 320 }, () => [lr(), lr(), lr()] as [number, number, number]);
  const moonPhase = lr();
  let moon: HTMLCanvasElement | null = null;
  const dpr = Math.max(1, Math.min(2, host.viewport.dpr || 1));
  const res = Math.max(0.5, Math.min(1.25, Math.min(W / GW, H / GH) * dpr));
  const isMap = o.view === 'map';
  let scenery: ReturnType<typeof createScenery> | null = null;
  let castleP: ReturnType<typeof createCastlePainter> | null = null;
  let mapP: ReturnType<typeof createMapPainter> | null = null;

  // ---- clouds: heaps of cumulus at three depths, drifting on the wind ---------------------------------
  type Cloud = { x0: number; y: number; w: number; h: number; s: number; k: number; kind: 'heap' | 'flat' | 'tower'; seed: number; bake: CloudBake | null; tier: number };
  const clouds: Cloud[] = [];
  const cu = world.phone ? u * 1.7 : u;
  const nFar = world.phone ? 4 : 7;
  for (let i = 0; i < nFar; i++) clouds.push({ x0: lr(), y: HY - GH * (0.025 + lr() * 0.09), w: (260 + lr() * 280) * cu, h: (60 + lr() * 50) * cu, s: 0.008, k: 0.25, kind: 'flat', seed: Math.floor(lr() * 1e6), bake: null, tier: 0 });
  const nMid = world.phone ? 3 : 5;
  for (let i = 0; i < nMid; i++) clouds.push({ x0: (i + lr() * 0.6) / nMid, y: HY - GH * (0.12 + lr() * 0.1), w: (460 + lr() * 360) * cu, h: (230 + lr() * 160) * cu, s: 0.025, k: 0.55, kind: lr() < 0.3 ? 'tower' : 'heap', seed: Math.floor(lr() * 1e6), bake: null, tier: 1 });
  const nNear = world.phone ? 2 : 3;
  for (let i = 0; i < nNear; i++) clouds.push({ x0: (i + lr() * 0.5) / nNear, y: GH * (0.16 + lr() * 0.12), w: (700 + lr() * 500) * cu, h: (300 + lr() * 160) * cu, s: 0.05, k: 0.9, kind: 'heap', seed: Math.floor(lr() * 1e6), bake: null, tier: 2 });
  const cloudX = (c: Cloud) => {
    const span = GW + c.w * 2;
    return ((((c.x0 * span + world.drift * c.k - dir * world.X * c.s) % span) + span) % span) - c.w;
  };
  function drawClouds(tier: number) {
    const L = E.L;
    const gold = goldenOf(world.day);
    for (const c of clouds) {
      if (c.tier !== tier) continue;
      if (!c.bake) c.bake = bakeCloud(c.seed, c.w, c.h, c.kind, world.sunSide, Math.min(0.5, res * 0.55));
      const shade = mix(L.cloudShade, L.haze, tier === 0 ? 0.35 : 0.1);
      tintCloud(c.bake, shade, L.cloudLit, mix(L.sun, '#ffffff', 0.4), 0.35 + gold * 0.6);
      const x = cloudX(c);
      ctx.globalAlpha = (tier === 0 ? 0.85 : 0.97) * (1 - world.storm * 0.35);
      ctx.drawImage(c.bake.out, x + c.bake.ox, c.y - c.h + c.bake.oy, c.bake.dw, c.bake.dh);
    }
    ctx.globalAlpha = 1;
  }
  /** The storm's own cloud: a low dark ceiling over everything. */
  function drawStormCloud() {
    const k = world.storm;
    if (k <= 0.02) return;
    const col = mix(E.L.cloudShade, '#20242e', 0.5);
    const g = ctx.createLinearGradient(0, 0, 0, HY);
    g.addColorStop(0, rgba(col, 0.9 * k));
    g.addColorStop(0.7, rgba(col, 0.55 * k));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-GW, -GH, GW * 3, HY + GH);
    const spr = E.soft(mix(col, E.L.cloudLit, 0.15));
    for (let i = 0; i < 14; i++) {
      const span = GW * 1.6;
      const x = ((((hash(i, 1) * span + world.drift * 0.8) % span) + span) % span) - GW * 0.3;
      const y = HY * (0.15 + hash(i, 2) * 0.55);
      const w = (300 + hash(i, 3) * 400) * cu;
      ctx.globalAlpha = 0.5 * k;
      ctx.drawImage(spr, x - w / 2, y - w * 0.18, w, w * 0.36);
    }
    ctx.globalAlpha = 1;
  }
  function drawCloudShadows() {
    const sun = (1 - E.night) * (1 - world.storm);
    if (sun < 0.1) return;
    const spr = E.soft('#283848');
    for (const c of clouds) {
      if (c.tier === 0) continue;
      const x = cloudX(c) + c.w / 2 - world.sunSide * c.w * 0.3;
      const y = c.tier === 2 ? land.GY + GH * 0.06 : HY + GH * 0.12;
      const w = c.w * (c.tier === 2 ? 1.2 : 0.8);
      ctx.globalAlpha = 0.16 * sun;
      ctx.drawImage(spr, x - w / 2, y - w * 0.07, w, w * 0.14);
    }
    ctx.globalAlpha = 1;
  }

  // ---- what moves, by plane -----------------------------------------------------------------------
  const hazeOfS = (s: number) => (s < 0.1 ? 0.45 : s < 0.3 ? 0.2 : s < 0.6 ? 0.08 : 0);
  function drawFx(sMin: number, sMax: number) {
    for (const f of world.fx) {
      if (f.s < sMin || f.s >= sMax) continue;
      const age = E.t - f.t0;
      if (age < 0) continue;
      const k = clamp01(age / f.dur);
      const hz = hazeOfS(f.s);
      if (f.kind === 'smoke' || f.kind === 'steam' || f.kind === 'dust') {
        const r = f.r * (1 + k * f.grow);
        const a = (f.kind === 'steam' ? 0.55 : f.kind === 'dust' ? 0.4 : 0.42) * Math.pow(1 - k, 1.3) * Math.min(1, age * 4);
        const base = E.lit(mix(f.color, '#b8cee4', hz));
        ctx.globalAlpha = a;
        ctx.drawImage(E.soft(base), f.x - r, f.y - r, r * 2, r * 2);
        // The lit top of each puff.
        if (f.kind !== 'dust' && E.L.rim > 0.2) {
          ctx.globalAlpha = a * 0.5 * E.L.rim * (1 - E.night);
          ctx.drawImage(E.soft(mix(E.L.cloudLit, base, 0.3)), f.x - r * 0.7 + world.sunSide * r * 0.2, f.y - r * 0.9, r * 1.4, r * 1.2);
        }
        ctx.globalAlpha = 1;
      } else if (f.kind === 'ring') {
        ctx.strokeStyle = rgba(E.lit(f.color), 0.6 * (1 - k));
        ctx.lineWidth = f.r * 0.35;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * (1 + k * f.grow), f.r * 0.45 * (1 + k * f.grow), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'petal' || f.kind === 'leaf') {
        ctx.fillStyle = E.lit(f.color);
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(E.t * 3 + f.seed);
        ctx.fillRect(-f.r, -f.r * 0.4, f.r * 2, f.r * 0.8);
        ctx.restore();
      } else if (f.kind === 'tracer') {
        ctx.strokeStyle = rgba(f.color, 0.9 * (1 - k));
        ctx.lineWidth = f.r;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x - f.vx * 0.04, f.y - f.vy * 0.04);
        ctx.stroke();
      } else if (f.kind === 'flak') {
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.drawImage(E.soft(E.lit('#5a5050')), f.x - f.r * (1 + k), f.y - f.r * (1 + k), f.r * 2 * (1 + k), f.r * 2 * (1 + k));
        ctx.globalAlpha = 1;
      } else if (f.kind === 'bomb') {
        ctx.fillStyle = E.lit(f.color);
        ctx.fillRect(f.x - f.r, f.y - f.r * 1.6, f.r * 2, f.r * 3.2);
      } else if (f.kind === 'splash') {
        ctx.fillStyle = rgba(E.lit(f.color), 0.7 * (1 - k));
        ctx.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r);
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of world.fx) {
      if (f.s < sMin || f.s >= sMax) continue;
      const age = E.t - f.t0;
      const k = clamp01(age / f.dur);
      if (f.kind === 'spark') E.glow(f.x, f.y, f.r * 2.5, f.color, 0.9 * (1 - k));
      else if (f.kind === 'fire') E.glow(f.x, f.y, f.r * 3, f.color, 0.75 * (1 - k));
      else if (f.kind === 'flash') E.glow(f.x, f.y, f.r * (1 + k * 1.5), f.color, (1 - k) * 0.9);
      else if (f.kind === 'firefly') {
        const tw = 0.5 + 0.5 * Math.sin(E.t * 4 + f.seed);
        E.glow(f.x, f.y, f.r * 5, f.color, tw * Math.min(1, age, (f.dur - age)) * E.night);
      }
    }
    ctx.restore();
  }
  const nearY = (x: number) => land.nearY(world.X + dir * (x - GW / 2));
  function drawMarksFar() {
    const s = PLANES.far.s;
    for (const b of [...world.ruins, ...world.burning]) {
      const x = world.xOf(b.L, s);
      if (x < -60 || x > GW + 60) continue;
      const burning = world.burning.includes(b) && E.t >= b.t0;
      drawRuin(E, x, land.farTop(1, b.L) + 1 * u, 9 * u * (world.phone ? 1.4 : 1), b.seed, 0.4, burning ? clamp01((b.until - E.t) / 60) : 0.08 * E.night);
      // A pall of smoke that stays over a ruin.
      if (!burning) {
        const spr = E.soft(E.lit('#5a5658'));
        for (let k = 0; k < 4; k++) {
          const q = (((E.t * 0.04 + k / 4) % 1) + 1) % 1;
          const r = (8 + q * 30) * u;
          ctx.globalAlpha = 0.25 * (1 - q);
          ctx.drawImage(spr, x + q * world.wind * 4 - r, land.farTop(1, b.L) - q * 90 * u - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (world.hen) {
      const x = world.xOf(world.hen.L + (E.t - world.hen.t0) * 6 * u, s);
      const L = world.hen.L + (E.t - world.hen.t0) * 6 * u;
      drawHen(E, x, land.farTop(1, L) + 1 * u, 14 * u * (world.phone ? 1.4 : 1), E.t, 0.35);
    }
    // The guns beyond the hills: flashes along the horizon.
    if (world.guns > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const on = Math.pow(Math.max(0, Math.sin(E.t * (1.3 + k * 0.7) + k * 4)), 18);
        if (on < 0.05) continue;
        const x = GW * hash(k, 77, Math.floor(E.t / 9));
        E.glow(x, HY - 4 * u, 70 * u, '#ff9a50', on * world.guns * (0.3 + E.night * 0.6));
      }
      ctx.restore();
    }
  }
  /** What is on ridge k: the wreck on the middle ridge, the struck tree and the sheep on the nearest. */
  function drawMarksMid(k: number) {
    const s = midS(k);
    const ph = world.phone ? 1.4 : 1;
    if (k === 2) for (const m of world.wrecks) {
      const x = world.xOf(m.L, s);
      if (x > -40 && x < GW + 40) drawWreck(E, x, land.midRidge(2, m.L)[0] + 2 * u, 12 * u * ph, m.seed, 0.1);
    }
    for (const nb of world.neighbours) {
      if (nb.k !== k) continue;
      const x = world.xOf(nb.L, s);
      if (x < -200 * u || x > GW + 200 * u) continue;
      const [t] = land.midRidge(k, nb.L);
      drawWalkingHouse(E, nb.kind, x, t + 4 * u, 78 * u * ph * Math.pow(s / 0.31, 0.9), E.t + nb.seed, k === 3 ? 0.06 : 0.03, nb.seed, world.sunSide);
    }
    if (k !== 4) return;
    for (const m of world.struck) {
      const x = world.xOf(m.L, s);
      if (x > -40 && x < GW + 40) drawStruck(E, x, land.midRidge(4, m.L)[0] + 2 * u, 40 * u * ph, m.seed, 0.03, clamp01(1 - (E.t - m.t0) / 60));
    }
    for (const sh of world.sheep) {
      if (sh.plane !== 'mid') continue;
      const L = world.X * s + dir * (sh.x - GW / 2);
      const [t, b] = land.midRidge(4, L);
      const y = t + 3 * u + sh.dz * 30 * u;
      if (y > b || y > land.GY) continue;
      drawSheep(E, sh, sh.x, y, 6 * u * ph, world.sunSide, 0.03);
    }
  }
  function drawNearBack() {
    const sky = mix(E.L.mid, E.L.low, 0.5);
    for (const m of world.puddles) {
      const x = world.xOf(m.L, 1);
      if (x < -60 || x > GW + 60) continue;
      const y = nearY(x) + (m.dz ?? 0);
      const sc = 1 + (m.dz ?? 0) / (GH * 0.1);
      if (m.k < 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        E.glow(x, y, 26 * u, '#ffd080', 0.5 * clamp01(1 - (E.t - m.t0) / 120) + 0.15 * E.night);
        ctx.restore();
        ctx.fillStyle = rgba('#2a2018', 0.6);
        ctx.beginPath();
        ctx.ellipse(x, y, 16 * u, 3.5 * u, 0, 0, Math.PI * 2);
        ctx.fill();
      } else drawPuddle(E, x, y, 26 * u * sc * m.k, m.seed, sky, world.rain);
    }
    for (const m of world.stains) {
      const x = world.xOf(m.L, 1);
      if (x < -60 || x > GW + 60) continue;
      const y = nearY(x) + (m.dz ?? 0);
      drawStain(E, x, y, 18 * u * (1 + (m.dz ?? 0) / (GH * 0.1)) * m.k, m.seed, clamp01(1 - (E.t - m.t0) / 200));
    }
  }
  /** Sheep, people and tar men on the near hill, back to front by how far down the slope they are. */
  function drawNearFigures(front: boolean) {
    type It = { dz: number; draw: () => void };
    const items: It[] = [];
    const sc = (dz: number) => 1 + dz / (GH * 0.12);
    const split = GH * 0.012;
    for (const sh of world.sheep) {
      if (sh.plane !== 'near' || (sh.dz >= split) !== front) continue;
      items.push({ dz: sh.dz, draw: () => drawSheep(E, sh, sh.x, nearY(sh.x) + sh.dz, 15 * u * sc(sh.dz) * (world.phone ? 1.3 : 1), world.sunSide, 0) });
    }
    if (front) {
      for (const w of world.walkers) items.push({ dz: w.dz, draw: () => drawWalker(E, w, w.x, nearY(w.x) + w.dz, 18 * u * sc(w.dz) * (world.phone ? 1.3 : 1)) });
      for (const tm of world.tar) items.push({ dz: tm.dz, draw: () => drawTarMan(E, tm, tm.x, nearY(tm.x) + tm.dz, 22 * u * sc(tm.dz) * (world.phone ? 1.3 : 1)) });
    }
    for (const it of items.sort((a, b) => a.dz - b.dz)) it.draw();
  }
  function drawShips(sMin: number, sMax: number) {
    for (const sh of world.ships) {
      if (sh.s < sMin || sh.s >= sMax) continue;
      const hz = hazeOfS(sh.s);
      const m = sh.m * u * (world.phone ? 1.4 : 1);
      if (sh.kind === 'bomber') drawBomber(E, sh, sh.x, sh.y, m * 1.6, hz, world.sunSide);
      else drawGunboat(E, sh, sh.x, sh.y, m * 1.4, hz);
      if (E.night > 0.4 && sh.kind === 'bomber') {
        // A searchlight swinging down from the gondola.
        const a = Math.sin(E.t * 0.4 + sh.seed) * 0.5;
        const len = GH * 0.5;
        const g = ctx.createLinearGradient(sh.x, sh.y, sh.x + Math.sin(a) * len, sh.y + len);
        g.addColorStop(0, rgba('#e8f0ff', 0.22 * E.night));
        g.addColorStop(1, rgba('#e8f0ff', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x + Math.sin(a - 0.08) * len, sh.y + len);
        ctx.lineTo(sh.x + Math.sin(a + 0.08) * len, sh.y + len);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawFlocks(sMin: number, sMax: number) {
    for (const f of world.flocks) if (f.s >= sMin && f.s < sMax) drawFlock(E, f, world.sunSide);
  }

  // ---- the frame ------------------------------------------------------------------------------------
  let lastDay = -1;
  function scene() {
    if (!scenery) scenery = createScenery(world, E, res);
    if (!castleP) castleP = createCastlePainter(world, E, Math.min(3, res * world.castle.cs * 2.2));
    const jumped = lastDay < 0 || Math.abs(((world.day - lastDay + 1.5) % 1) - 0.5) > 0.02;
    lastDay = world.day;
    scenery.update(jumped);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    if (!moon) moon = bakeMoon(moonPhase);
    drawSky(E, { GW, GH, HY, stars, side: world.sunSide, moonPhase, moonSprite: () => moon! });
    drawStars(E, world.stars);
    drawClouds(0);
    scenery.drawPlane(ctx, 'back');
    drawRainbow(E, GW, GH, HY, world.sunSide, world.rainbow);
    drawClouds(1);
    drawStormCloud();
    drawMarksFar();
    scenery.drawPlane(ctx, 'far');
    scenery.drawLive(ctx, 'far');
    drawMarksFar();
    drawShips(0, 0.15);
    drawFx(0, 0.065);
    drawFlocks(0, 0.3);
    scenery.drawWater(ctx);
    // The middle distance, ridge by ridge, with what moves at each depth between them.
    for (const [k, id] of MIDS.entries()) {
      scenery.drawPlane(ctx, id);
      scenery.drawLive(ctx, id);
      drawMarksMid(k);
      drawFx(k ? midS(k) - 0.01 : 0.065, k < MIDS.length - 1 ? midS(k + 1) - 0.01 : 0.6);
    }
    drawCloudShadows();
    scenery.drawPlane(ctx, 'near');
    const np = scenery.nearPath();
    scenery.drawGrassWind(ctx, np);
    if (world.wet > 0.05) {
      // Wet grass after rain: the sky's light lying on the hill.
      ctx.save();
      np(ctx);
      ctx.clip();
      const g = ctx.createLinearGradient(0, land.GY - 60 * u, 0, GH);
      g.addColorStop(0, rgba(E.L.low, 0.14 * world.wet));
      g.addColorStop(1, rgba(E.L.low, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, land.GY - 200 * u, GW, GH);
      ctx.restore();
    }
    drawNearBack();
    drawNearFigures(false);
    drawClouds(2);
    castleP.shadow(ctx);
    castleP.draw(ctx);
    drawNearFigures(true);
    drawFx(0.6, 1.3);
    drawFlocks(0.3, 2);
    drawShips(0.15, 2);
    scenery.drawPlane(ctx, 'fore');
    scenery.drawBlades(ctx);
    drawFx(1.3, 9);
    drawRain(E, GW, GH, world.rain, world.wind);
    if (world.bolt) drawBolt(E, world.bolt.x, -20, world.bolt.y, world.bolt.seed, E.t - world.bolt.t0);
    if (world.mist > 0.02) {
      const g = ctx.createLinearGradient(0, HY - GH * 0.05, 0, land.GY);
      g.addColorStop(0, rgba(E.L.haze, 0));
      g.addColorStop(0.5, rgba(E.L.haze, 0.35 * world.mist));
      g.addColorStop(1, rgba(E.L.haze, 0.1 * world.mist));
      ctx.fillStyle = g;
      ctx.fillRect(-GW, HY - GH * 0.05, GW * 3, land.GY - HY + GH * 0.05);
    }
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(235,240,255,${(0.22 * world.flash).toFixed(3)})`;
      ctx.fillRect(-GW, -GH, GW * 3, GH * 3);
    }
    ctx.restore();
    grade();
  }
  function grade() {
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.42, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(20,14,24,0)');
    vg.addColorStop(1, `rgba(20,14,24,${(0.28 + E.night * 0.2).toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- words: a film's title cards and subtitles --------------------------------------------------------
  function words(t: number) {
    const small = W < 600;
    if (o.hud && !isMap) {
      const cd = world.cards[world.cards.length - 1];
      if (cd) {
        const age = t - cd.t0;
        const a = clamp01(Math.min(age / 1.2, (9 - age) / 1.6));
        if (a > 0.01) {
          const ts = Math.round(Math.max(22, Math.min(42, W * 0.028)));
          const ss = Math.round(ts * 0.5);
          const x = small ? W / 2 : Math.round(Math.max(24, W * 0.04));
          const y = Math.round(Math.max(ts + 18, H * 0.075));
          ctx.textAlign = small ? 'center' : 'left';
          ctx.font = SERIF(ts, true, '500');
          const title = fitText(ctx, cd.title, W - 48);
          const tw = ctx.measureText(title).width;
          ctx.font = SERIF(ss, true);
          const sub = cd.sub ? fitText(ctx, cd.sub, W - 48) : '';
          const sw = sub ? ctx.measureText(sub).width : 0;
          const bw = Math.max(tw, sw) + ts * 2.4;
          const bx = small ? x - bw / 2 : x - ts * 1.2;
          const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          bg.addColorStop(0, 'rgba(14,10,16,0)');
          bg.addColorStop(0.2, `rgba(14,10,16,${(0.42 * a).toFixed(3)})`);
          bg.addColorStop(0.8, `rgba(14,10,16,${(0.42 * a).toFixed(3)})`);
          bg.addColorStop(1, 'rgba(14,10,16,0)');
          ctx.fillStyle = bg;
          ctx.fillRect(bx, y - ts * 1.15, bw, ts * 1.3 + (sub ? ss * 1.7 : 0));
          // The title, a hairline flourish under it, the line beneath.
          const rise = (1 - a) * 6;
          ctx.font = SERIF(ts, true, '500');
          ctx.fillStyle = `rgba(10,6,10,${(0.6 * a).toFixed(3)})`;
          fillCrisp(ctx, title, x + 1, y + 1.5 + rise);
          ctx.fillStyle = `rgba(252,244,226,${a.toFixed(3)})`;
          fillCrisp(ctx, title, x, y + rise);
          const lx0 = small ? x - tw * 0.3 : x;
          ctx.strokeStyle = `rgba(232,200,140,${(0.7 * a).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx0, y + ts * 0.3 + rise);
          ctx.lineTo(lx0 + tw * (small ? 0.6 : 0.45) * a, y + ts * 0.3 + rise);
          ctx.stroke();
          if (sub) {
            ctx.font = SERIF(ss, true);
            ctx.fillStyle = `rgba(10,6,10,${(0.6 * a).toFixed(3)})`;
            fillCrisp(ctx, sub, x + 1, y + ts * 0.3 + ss * 1.25 + 1 + rise);
            ctx.fillStyle = `rgba(240,226,200,${(0.95 * a).toFixed(3)})`;
            fillCrisp(ctx, sub, x, y + ts * 0.3 + ss * 1.25 + rise);
          }
        }
      }
    }
    if (o.labels) {
      const s = world.subs.find((q) => t >= q.t0 && t < q.t0 + q.dur);
      if (s) {
        const age = t - s.t0;
        const a = clamp01(Math.min(age / 0.25, (s.dur - age) / 0.35));
        const fs = Math.round(Math.max(15, Math.min(23, W * 0.0165)));
        const ns = Math.round(fs * 0.72);
        ctx.textAlign = 'left';
        ctx.font = SERIF(fs);
        const name = s.who.toUpperCase();
        const line = fitText(ctx, s.line, W * 0.86 - name.length * ns * 0.7);
        const lw = ctx.measureText(line).width;
        ctx.font = SERIF(ns, false, '600');
        const nw = ctx.measureText(name).width + ns * 0.8;
        const total = nw + lw;
        const x0 = Math.round(W / 2 - total / 2);
        const y = Math.round(isMap && mapP ? mapP.subY() : H - Math.max(26, H * 0.055));
        ctx.fillStyle = `rgba(12,8,12,${(0.5 * a).toFixed(3)})`;
        ctx.beginPath();
        ctx.roundRect(x0 - fs * 0.8, y - fs * 1.05, total + fs * 1.6, fs * 1.55, fs * 0.4);
        ctx.fill();
        ctx.fillStyle = `rgba(240,196,120,${a.toFixed(3)})`;
        fillCrisp(ctx, name, x0, y - 1);
        ctx.font = SERIF(fs);
        ctx.fillStyle = `rgba(255,250,238,${a.toFixed(3)})`;
        fillCrisp(ctx, line, x0 + nw, y);
      }
    }
    ctx.textAlign = 'left';
  }

  function paint(t: number) {
    E.set(t, world.day, world.storm, nightOf(world.day) * (1 - world.storm * 0.3));
    if (isMap) {
      if (!mapP) mapP = createMapPainter(world, E, { W: () => W, H: () => H, hud: o.hud });
      mapP.paint(t);
    } else scene();
    words(t);
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => (isMap && mapP ? mapP.project(x, y) : [SX(x), SY(y)]),
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => (isMap && mapP ? mapP.unproject(x, y) : [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y]),
    after: (dt) => {
      framing.update(dt, world.t, world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => paint(t),
    ambience: () => (world.storm > 0.3 ? 0.9 : world.ships.length || world.tar.length ? 0.8 : 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
