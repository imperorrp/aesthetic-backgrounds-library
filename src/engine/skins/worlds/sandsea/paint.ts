/**
 * Sandsea, painted: the open sand from a rock ledge, like a matte painting with the machines
 * and the worm moving in it.
 *
 * The sand is terrain (./terrain): a dune field lit by the sun per sample, rendered in slabs of
 * distance. Back to front: the sky (sun or moons, stars); the mesas on the horizon; the old one;
 * then each slab of sand, far to near, with what stands or flies in it drawn after it (outcrops,
 * the glint of spice, thumpers, wrecks, worms, crawlers and their plumes, the folk, dust devils,
 * carryalls, ornithopters, dust and smoke); sand streaming on the wind; the rock we watch from
 * and its watchers; the storm over it all; the grade; the radio, call-outs and the HUD.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash, typed } from '../../instruments/kit';
import { AIRS, clamp01, createDEnv, drawCarryall, drawCrawler, drawDevil, drawFolk, drawSky, drawStorm, drawThopter, drawWorm, goldenOf, heatOf, hexA, mix, mk, posmod, timeWords } from './desert';
import { createSandsea } from './sim';
import { createDuneField, createTerrain, vnoise, type Terrain, type TerrainLight } from './terrain';
import type { SandWorld } from './types';

export type SandPaintOptions = { traffic: number; camera: string; labels: boolean; hud: boolean };

const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;

export function mountSandsea(host: SkinHost, o: SandPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: SandWorld = createSandsea(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera });
  const { GW, GH, u, HY, NY } = world;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.3, closer: 1.8, maxZoom: 2.6 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const E = createDEnv(ctx, u, 0.8);
  const lr = host.fork('sand-look');
  const stars = Array.from({ length: 260 }, () => [lr(), lr(), lr()] as [number, number, number]);
  const moons: [number, number] = [lr(), lr()];
  const tseed = Math.floor(lr() * 1e6);
  let grain: HTMLCanvasElement | null = null;

  // ---- the sand: a dune field, rendered in slabs of distance ------------------------------------------
  const field = createDuneField(tseed, u);
  /** The picture's own perspective, not clamped: a little nearer than the foot of the ledge is under the near sand. */
  const yE = (d: number) => HY + (NY - HY) * Math.pow(1 - d, 2);
  const mE = (d: number) => 0.08 + 0.92 * Math.pow(1 - d, 2);
  const mid = GW / 2;
  const groundX = (sx: number, d: number) => mid + (sx - mid) / (0.35 + 0.65 * Math.pow(1 - d, 2));
  const dNear = -(Math.sqrt((GH + 20 * u - HY) / (NY - HY)) - 1);
  const SLABS = [dNear, 0.05, 0.11, 0.18, 0.26, 0.35, 0.45, 0.57, 0.72, 0.86];
  let terrain: Terrain | null = null;
  const bowls = (): TerrainLight['bowls'] => world.craters.map((c) => [c.x, field.zOf(c.d), 150 * u * c.size, 60 * u * c.size * (1 - clamp01((world.t - c.t0) / 600))] as [number, number, number, number]);
  /** Where the light comes from now: the sun across the sky, or the moon. */
  const lightDir = (): [number, number, number] => {
    const sk = (world.day - 0.25) / 0.5;
    const day = sk > -0.02 && sk < 1.02;
    const k = clamp01(day ? sk : (((world.day + 0.5) % 1) - 0.25) / 0.5);
    // The light on the sand stays low all day (licence: the sky's sun climbs, the dunes keep their shadows).
    const el = Math.max(0.06, Math.min(0.5, Math.sin(k * Math.PI) * (day ? 1.15 : 0.8)));
    const sxk = world.sunSide > 0 ? 0.1 + 0.8 * k : 0.9 - 0.8 * k;
    // Out in front of us and to one side: the slip faces, which face us, stand against the light.
    const x = (sxk - 0.5) * 1.8 * Math.cos(el) + (world.sunSide > 0 ? 0.2 : -0.2) * Math.cos(el);
    const y = Math.sin(el);
    const z = 0.85 * Math.cos(el);
    const n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  };
  const terrainLight = (): TerrainLight => {
    const L = E.light;
    const gold = goldenOf(world.day);
    return {
      L: lightDir(),
      sand: L.sand,
      lit: mix(L.sand, L.sun, 0.22 + gold * 0.25),
      shade: mix(mix(L.sand, L.top, 0.45), L.ink, 0.5 + gold * 0.12),
      haze: mix(L.haze, L.low, 0.55),
      hazeOf: (d) => E.hazeOf(d) * 0.95,
      stains: world.patches.map((p) => [p.x, field.zOf(p.d), p.r * 1.5, p.spice * 0.85] as [number, number, number, number]),
      bowls: bowls(),
    };
  };
  const slabOfD = (d: number) => {
    let k = 0;
    while (k + 1 < SLABS.length && d >= SLABS[k + 1]) k++;
    return k;
  };
  /** The sand's height under ground (x, d). */
  const gh = (x: number, d: number) => (terrain ? terrain.groundH(x, d, bowls()) : 0);

  // ---- rock: the horizon's mesas, outcrops out on the sand -----------------------------------------
  const mesaSeed = Math.floor(lr() * 1e6);
  const mesaAt = (x: number, k: number) => {
    const n = vnoise(x / (180 * u) + k * 31, k * 7.7, mesaSeed);
    const plateau = clamp01((n - 0.52) * 5);
    const crag = vnoise(x / (40 * u), k * 3.3, mesaSeed + 9) * 0.25;
    return (plateau * (0.75 + crag) + vnoise(x / (700 * u), k, mesaSeed + 3) * 0.25) * (k ? 26 : 44) * u;
  };
  const outcrops = Array.from({ length: 2 + Math.floor(lr() * 2) }, (_, i) => ({ x: GW * (0.12 + lr() * 0.76), d: 0.42 + lr() * 0.38, w: (260 + lr() * 420) * u, h: (90 + lr() * 140) * u, seed: Math.floor(lr() * 1e6), flat: lr() < 0.55, i }));
  function drawMesas() {
    for (const k of [1, 0]) {
      const base = HY + (k ? -1 : 0.5) * u;
      const col = mix(mix(E.light.haze, E.light.top, k ? 0.12 : 0.28), E.light.ink, k ? 0.05 : 0.14);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-20, base + 2);
      for (let x = -20; x <= GW + 20; x += 4) ctx.lineTo(x, base - mesaAt(x, k));
      ctx.lineTo(GW + 20, base + 2);
      ctx.fill();
      // The faces toward the light, a little lit.
      if (!k && E.light.rim > 0.2) {
        const [lx] = lightDir();
        ctx.strokeStyle = hexA(mix(E.light.sun, col, 0.5), 0.35 * E.light.rim);
        ctx.lineWidth = Math.max(0.6, 1 * u);
        ctx.beginPath();
        for (let x = -20; x <= GW + 20; x += 4) {
          const s = mesaAt(x + 4, k) - mesaAt(x, k);
          if (s * lx < -0.6 * u) {
            ctx.moveTo(x, base - mesaAt(x, k));
            ctx.lineTo(x, base - mesaAt(x, k) * 0.4);
          }
        }
        ctx.stroke();
      }
    }
  }
  function drawOutcrop(oc: (typeof outcrops)[number]) {
    const m = world.mOf(oc.d);
    const x = px(oc.x, oc.d);
    const y = world.yOf(oc.d) - gh(oc.x, oc.d) * m;
    const w = oc.w * m;
    const h = oc.h * m;
    const [lx] = lightDir();
    const rock = E.tone('#6a4a36', oc.d, 0.1);
    const lit = E.tone('#b8845a', oc.d, 0.45);
    const dark = E.tone('#2a1c16', oc.d, 0);
    const pts: [number, number][] = [];
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      const edge = Math.min(q, 1 - q);
      const prof = oc.flat ? clamp01(edge * 7) : Math.pow(Math.sin(q * Math.PI), 0.6);
      const crag = (hash(oc.seed, i) - 0.5) * 0.18 + (oc.flat ? 0 : Math.sin(q * 9 + oc.seed) * 0.06);
      pts.push([x - w / 2 + q * w, y - h * prof * (0.86 + crag)]);
    }
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + 4 * m * u);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(x + w / 2, y + 4 * m * u);
    ctx.fill();
    // The face toward the light, and the face away; and the vertical joints of the rock.
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(lx > 0 ? 1 : 0, hexA(lit, 0.85 * (0.4 + E.light.rim * 0.6)));
    g.addColorStop(0.5, hexA(rock, 0));
    g.addColorStop(lx > 0 ? 0 : 1, hexA(dark, 0.7));
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y - h * 1.1, w, h * 1.2);
    ctx.strokeStyle = hexA(dark, 0.45);
    ctx.lineWidth = Math.max(0.5, 1.2 * u * m);
    for (let i = 1; i < 12; i++) {
      const q = hash(oc.seed, i, 3);
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + q * w, y - h);
      ctx.lineTo(x - w / 2 + q * w + (hash(oc.seed, i, 4) - 0.5) * 10 * u * m, y);
      ctx.stroke();
    }
    // Strata across it.
    ctx.strokeStyle = hexA(lit, 0.18);
    for (let i = 1; i < 6; i++) {
      const yy = y - h * (i / 6) * 0.9;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, yy);
      ctx.lineTo(x + w / 2, yy + (hash(oc.seed, i, 5) - 0.5) * 6 * u * m);
      ctx.stroke();
    }
    ctx.restore();
    // Sand piled at its foot.
    const sand = E.tone(E.light.sand, oc.d, 0.25);
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.75, y + 6 * u * m);
    ctx.quadraticCurveTo(x - w * 0.45, y - h * 0.12, x - w * 0.3, y - h * 0.05);
    ctx.lineTo(x + w * 0.3, y - h * 0.08);
    ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.14, x + w * 0.8, y + 6 * u * m);
    ctx.fill();
  }

  // ---- the things on the sand ---------------------------------------------------------------------
  const px = (x: number, d: number) => world.xOf(x, d);
  /** Up off the sand at (x, d) by `alt`, standing on the dunes when x is given. */
  const py = (d: number, alt = 0, x?: number) => world.yOf(d) - (alt + (x === undefined ? 0 : gh(x, d))) * world.mOf(d);
  /** The machines are drawn larger than true, so they read at their distance. */
  const MC = 2.0;
  const MA = 1.75;
  const MT = 1.45;
  const shadow = (x: number, d: number, alt: number, w: number) => {
    const m = world.mOf(d);
    const a = clamp01(0.4 - (alt * m) / (400 * u)) * (1 - E.night * 0.6) * (1 - E.hazeOf(d) * 0.7);
    if (a <= 0.02) return;
    const [lx, ly] = lightDir();
    ctx.fillStyle = hexA(E.tone(mix(E.light.sand, E.light.ink, 0.55), d), a);
    ctx.beginPath();
    ctx.ellipse(px(x, d) - (lx / Math.max(0.15, ly)) * alt * m * 0.35, py(d, 0, x), w * m * 0.5, w * m * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  function drawPatchGlints(p: SandWorld['patches'][number]) {
    if (E.night > 0.6) return;
    const m = world.mOf(p.d);
    const x = px(p.x, p.d);
    const y = py(p.d, 0, p.x);
    const rx = p.r * m * (0.35 + 0.65 * Math.pow(1 - p.d, 2)) * 1.4;
    const ry = p.r * m * 0.28;
    ctx.fillStyle = hexA(mix('#ffd8a0', E.light.sun, 0.5), 0.7 * (1 - E.night) * p.spice);
    for (let k = 0; k < 18; k++) {
      const a = hash(p.id, k) * Math.PI * 2;
      const rr = Math.sqrt(hash(p.id, k, 1));
      const tw = 0.5 + 0.5 * Math.sin(E.t * (2 + hash(p.id, k, 2) * 3) + k);
      if (tw < 0.65) continue;
      ctx.fillRect(x + Math.cos(a) * rx * rr, y + Math.sin(a) * ry * rr, Math.max(1, 1.6 * u * m), Math.max(1, 1.6 * u * m));
    }
  }
  function drawThumper(th: SandWorld['thumpers'][number]) {
    const m = world.mOf(th.d);
    const x = px(th.x, th.d);
    const y = py(th.d, 0, th.x);
    const h = 16 * u * m * 2;
    const beat = Math.pow(Math.abs(Math.sin(E.t * 4)), 6);
    ctx.fillStyle = E.tone('#3a2e22', th.d);
    ctx.fillRect(x - h * 0.08, y - h, h * 0.16, h);
    ctx.fillStyle = E.tone('#8a6a3a', th.d, 0.3);
    ctx.fillRect(x - h * 0.2, y - h - h * 0.25 + beat * h * 0.2, h * 0.4, h * 0.25);
    ctx.strokeStyle = hexA(E.tone(E.light.sand, th.d, 0.3), 0.35 * (1 - beat));
    ctx.lineWidth = Math.max(0.5, u * m);
    ctx.beginPath();
    ctx.ellipse(x, y, h * (0.6 + beat * 1.2), h * (0.15 + beat * 0.3), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  /** The plume off a working crawler: spice and sand thrown up and leaning away on the wind, lit on the sun's side. */
  function drawPlume(x: number, y: number, m: number, d: number, strength: number) {
    if (strength <= 0.02) return;
    const [lx] = lightDir();
    const H = 420 * u * m * (0.35 + 0.65 * strength);
    const lean = (world.wind / 30) * 0.6 + 0.18;
    const dark = E.tone(mix(E.light.sand, '#6a3416', 0.5), d, 0.05);
    const lit = E.tone(mix(E.light.sand, '#c8783a', 0.35), d, 0.55);
    const sprD = E.soft(dark);
    const sprL = E.soft(lit);
    const n = 30;
    for (let i = 0; i < n; i++) {
      const q = posmod(i / n + E.t * 0.03, 1);
      const yy = y - q * H;
      const xx = x + lean * q * q * H * 1.3 + Math.sin(E.t * 0.35 + i * 1.7) * q * 22 * u * m;
      const r = (18 + q * 150) * u * m;
      const a = 0.42 * Math.pow(1 - q, 0.9) * Math.min(1, q * 10) * strength;
      ctx.globalAlpha = a;
      ctx.drawImage(sprD, xx - r, yy - r * 0.8, r * 2, r * 1.6);
      ctx.globalAlpha = a * 0.75 * (0.4 + E.light.rim * 0.6) * (1 - E.night * 0.7);
      ctx.drawImage(sprL, xx - r + lx * r * 0.35, yy - r * 0.85, r * 1.7, r * 1.4);
    }
    ctx.globalAlpha = 1;
  }
  function drawCrawlerAt(cr: SandWorld['crawlers'][number]) {
    const m = world.mOf(cr.d);
    const lost = cr.state === 'lost';
    const sink = lost ? Math.min(1, (world.t - cr.t0) / 3) : 0;
    const ground = py(cr.d, 0, cr.x);
    if (cr.alt > 2) shadow(cr.x, cr.d, cr.alt, 150 * u * MC);
    const y = cr.alt > 2 ? py(cr.d, cr.alt, cr.x) : ground;
    ctx.save();
    if (sink > 0) {
      ctx.beginPath();
      ctx.rect(px(cr.x, cr.d) - 300 * u * m * MC, ground - 300 * u * m * MC, 600 * u * m * MC, 300 * u * m * MC + 4 * u * m);
      ctx.clip();
    }
    drawCrawler(E, px(cr.x, cr.d), y + sink * 60 * u * m * MC, m * MC, cr.dir, cr.d, { working: cr.state === 'working', lit: true, seed: cr.seed, tilt: sink * 0.6 * cr.dir });
    ctx.restore();
    const working = cr.state === 'working' ? 1 : world.op.phase === 'calling' && cr.id === world.op.crawler ? 0.5 : 0;
    drawPlume(px(cr.x, cr.d) - cr.dir * 30 * u * m * MC, y - 40 * u * m * MC, m, cr.d, working);
  }
  function drawCarryallAt(ca: SandWorld['carryalls'][number]) {
    const cr = world.crawlers.find((q) => q.id === ca.crawler);
    const slung = cr && (cr.state === 'slung' || cr.state === 'lifting' || (ca.state === 'lower' && cr.alt > 0));
    const hooked = cr && !slung && (ca.state === 'lift' && ca.alt <= 75 * u);
    shadow(ca.x, ca.d, ca.alt, 190 * u * MA);
    const m = world.mOf(ca.d);
    const cables: [number, number] | null = slung || hooked ? [px(cr!.x, cr!.d), py(cr!.d, cr!.alt, cr!.x) - 36 * u * m * MC] : null;
    drawCarryall(E, px(ca.x, ca.d), py(ca.d, ca.alt, ca.x), m * MA, ca.dir, ca.d, { seed: ca.seed, lit: true, cables, bank: ca.state === 'inbound' || ca.state === 'away' ? 0.04 : 0 });
  }
  function drawThopterAt(th: SandWorld['thopters'][number]) {
    const m = world.mOf(th.d);
    if (th.state === 'wreck') return;
    if (th.alt > 2) shadow(th.x, th.d, th.alt, 60 * u * MT);
    const lx = th.x + th.dir * 160 * u + Math.sin(E.t * 0.7 + th.seed) * 80 * u;
    const lamp: [number, number] | null = th.lamp && E.night > 0.1 && th.state === 'cross' ? [px(lx, th.d), py(th.d, 0, lx)] : null;
    drawThopter(E, px(th.x, th.d), py(th.d, th.alt, th.x), m * MT, th.dir, th.d, { seed: th.seed, lit: th.role !== 'smuggler', beat: th.beat, landed: th.state === 'landed', bank: th.state === 'circle' ? 0.12 : th.state === 'falling' ? 0.5 : 0, lamp });
  }
  function drawWormAt(wm: SandWorld['worms'][number]) {
    const pose = wm.state === 'gone' ? 'submerge' : wm.state;
    drawWorm(E, { x: px(wm.x, wm.d), y: py(wm.d, 0, wm.x), m: world.mOf(wm.d) * 1.8, dir: wm.dir, pose, k: wm.k, d: wm.d, size: wm.size, riders: wm.riders, seed: wm.seed });
  }
  function drawPartyAt(p: SandWorld['parties'][number]) {
    for (const mb of [...p.members].sort((a, b) => a.dd - b.dd)) {
      const d = Math.max(-0.05, p.d + mb.dd);
      const m = world.mOf(Math.max(0, d));
      const gx = p.x + mb.dx * (p.dir > 0 ? 1 : -1) * -1;
      const x = px(gx, d);
      const y = py(d, 0, gx);
      const crouch = p.state === 'crouch' ? Math.min(1, (world.t - p.t0) * 2) : p.state === 'salvage' || p.state === 'meet' ? 0.5 + 0.5 * Math.sin(E.t * 0.8 + mb.seed) : 0;
      drawFolk(E, x, y, 24 * u * m * 1.5, p.dir, Math.max(0, d), { phase: mb.ph, crouch, seed: mb.seed, pack: mb.pack, weapon: mb.weapon, child: mb.child });
    }
  }
  function drawWreckAt(wk: SandWorld['wrecks'][number]) {
    const m = world.mOf(wk.d);
    const x = px(wk.x, wk.d);
    const y = py(wk.d, 0, wk.x);
    if (wk.stripped < 1) drawThopter(E, x, y - 4 * u * m, m * MT * 0.95, 1, wk.d, { seed: wk.seed, lit: false, beat: 0, landed: true, bank: -0.35 });
    ctx.fillStyle = hexA(E.tone('#1a1410', wk.d), 0.35 * (1 - wk.stripped * 0.5));
    ctx.beginPath();
    ctx.ellipse(x, y, 70 * u * m, 11 * u * m, 0, 0, Math.PI * 2);
    ctx.fill();
    if (wk.stripped > 0) {
      ctx.strokeStyle = hexA(E.tone('#2e2a26', wk.d), 0.9);
      ctx.lineWidth = Math.max(0.6, 1.5 * u * m);
      ctx.beginPath();
      ctx.moveTo(x - 30 * u * m, y);
      ctx.lineTo(x + 20 * u * m, y - 6 * u * m);
      ctx.moveTo(x - 10 * u * m, y - 2 * u * m);
      ctx.lineTo(x - 4 * u * m, y - 18 * u * m);
      ctx.stroke();
    }
  }
  function drawFx(f: SandWorld['fx'][number]) {
    const age = world.t - f.t0;
    if (age < 0) return;
    const k = age / f.dur;
    const m = world.mOf(f.d);
    const x = px(f.x, f.d);
    const y = py(f.d, f.alt, f.x);
    const r = f.r * m * 1.9;
    if (f.kind === 'dust' || f.kind === 'sand' || f.kind === 'smoke' || f.kind === 'spice') {
      const base = f.kind === 'smoke' ? E.tone(f.color, f.d) : f.kind === 'spice' ? E.tone(mix(E.light.sand, '#b05a20', 0.5), f.d, 0.3) : E.tone(E.light.sand, f.d, 0.4);
      const a = (f.kind === 'smoke' ? 0.4 : 0.45) * Math.pow(1 - k, 1.2) * Math.min(1, age * 3);
      const s = r * (1.4 + k * 2.2);
      ctx.globalAlpha = a;
      ctx.drawImage(E.soft(base), x - s / 2, y - s / 2, s, s * 0.8);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'glint') {
      ctx.fillStyle = hexA(f.color, 1 - k);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  function drawFxLight(f: SandWorld['fx'][number]) {
    const age = world.t - f.t0;
    const k = age / f.dur;
    const m = world.mOf(f.d);
    const x = px(f.x, f.d);
    const y = py(f.d, f.alt, f.x);
    if (f.kind === 'fire') E.glow(x, y, f.r * m * 2.4, '#ff7a20', 0.7 * (1 - k));
    else if (f.kind === 'flash') E.glow(x, y, f.r * m * (1 + k * 2), '#ffd090', (1 - k) * 0.9);
  }
  function drawBlow() {
    const b = world.blow;
    if (!b) return;
    const age = world.t - b.t0;
    const k = 1 - clamp01(age / 18);
    const m = world.mOf(b.d);
    drawPlume(px(b.x, b.d), py(b.d, 0, b.x), m * 1.4, b.d, Math.min(1, age / 2) * k);
  }
  function drawOldOne() {
    const oo = world.oldOne;
    if (!oo) return;
    const age = world.t - oo.t0;
    const k = clamp01(age / oo.dur);
    drawWorm(E, { x: px(oo.x, 0.96), y: world.yOf(0.96) + 2 * u, m: world.mOf(0.96), dir: 1, pose: 'surface', k, d: 0.96, size: 16, seed: 7 });
  }
  /** Sand streaming low over the near dunes when the wind is up. */
  function drawDrift() {
    const w = Math.abs(world.wind);
    if (w < 8 || world.storm > 0.5) return;
    const dir = Math.sign(world.wind);
    const spr = E.soft(E.tone(E.light.sand, 0.1, 0.2));
    const n = Math.floor(6 + w * 0.4);
    for (let k = 0; k < n; k++) {
      const d = 0.02 + hash(k, 41) * 0.35;
      const span = GW * 1.4;
      const gx = -GW * 0.2 + posmod(hash(k, 42) * span + E.t * (40 + w * 6) * dir * (0.6 + hash(k, 43)), span);
      const m = world.mOf(d);
      const x = px(gx, d);
      const y = py(d, 2 * u, gx);
      const len = (60 + w * 4) * u * m * (0.6 + hash(k, 44));
      ctx.globalAlpha = (0.05 + w * 0.002) * (1 - d);
      ctx.drawImage(spr, x - len / 2, y - len * 0.12, len, len * 0.24);
    }
    ctx.globalAlpha = 1;
  }
  // The rock we stand on: a basalt promontory on one side, the near sand running out below it on the other.
  const side = world.ledge.side;
  const rockX0 = side > 0 ? GW * 0.58 : -20;
  const rockX1 = side > 0 ? GW + 20 : GW * 0.42;
  const tip = side > 0 ? rockX0 : rockX1;
  /** The top of the promontory at x: low at its tip, rising to the screen's edge. */
  const rockTop = (x: number) => {
    const q = clamp01(Math.abs(x - tip) / (GW * 0.42));
    return NY + 26 * u - Math.pow(q, 0.7) * 70 * u + Math.sin(x * 0.05) * 3 * u + (vnoise(x / (14 * u), 0, mesaSeed + 5) - 0.5) * 7 * u;
  };
  function drawLedge() {
    const [lx] = lightDir();
    const rock = E.tone('#2a1e18', 0, 0.02);
    const lit = E.tone('#8a6448', 0, 0.45);
    const path = new Path2D();
    path.moveTo(rockX0, GH + 20);
    if (side > 0) {
      path.lineTo(tip - 40 * u, GH + 20);
      path.quadraticCurveTo(tip - 10 * u, rockTop(tip) + 40 * u, tip, rockTop(tip));
    } else path.lineTo(rockX0, rockTop(rockX0));
    for (let x = side > 0 ? tip : rockX0; side > 0 ? x <= rockX1 : x <= tip; x += 6) path.lineTo(x, rockTop(x));
    if (side < 0) {
      path.quadraticCurveTo(tip + 10 * u, rockTop(tip) + 40 * u, tip + 40 * u, GH + 20);
    } else path.lineTo(rockX1, GH + 20);
    path.closePath();
    ctx.fillStyle = rock;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    // The face toward the sand catches the light; the rest in shadow; ledges and cracks.
    const fg = ctx.createLinearGradient(tip, 0, side > 0 ? rockX1 : rockX0, 0);
    fg.addColorStop(0, hexA(lit, (0.25 + 0.45 * E.light.rim) * (lx * -side > 0 ? 1 : 0.5)));
    fg.addColorStop(0.35, hexA(rock, 0));
    ctx.fillStyle = fg;
    ctx.fillRect(-20, NY - 120 * u, GW + 40, GH);
    const tg = ctx.createLinearGradient(0, NY - 60 * u, 0, NY + 30 * u);
    tg.addColorStop(0, hexA(lit, 0.4 * E.light.rim));
    tg.addColorStop(1, hexA(lit, 0));
    ctx.fillStyle = tg;
    ctx.fillRect(-20, NY - 60 * u, GW + 40, 90 * u);
    ctx.strokeStyle = hexA('#000000', 0.4);
    ctx.lineWidth = Math.max(0.6, 1.2 * u);
    for (let k = 0; k < 22; k++) {
      const x = rockX0 + hash(k, 21) * (rockX1 - rockX0);
      const y = rockTop(x) + 10 * u + hash(k, 22) * (GH - rockTop(x));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (hash(k, 23) - 0.5) * 70 * u, y + (hash(k, 24) - 0.2) * 40 * u);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = hexA(mix(lit, E.light.sun, 0.4), 0.3 + 0.5 * E.light.rim);
    ctx.lineWidth = Math.max(0.8, 1.6 * u);
    ctx.beginPath();
    for (let x = side > 0 ? tip : rockX0; side > 0 ? x <= rockX1 : x <= tip; x += 6) {
      if (x === (side > 0 ? tip : rockX0)) ctx.moveTo(x, rockTop(x));
      else ctx.lineTo(x, rockTop(x));
    }
    ctx.stroke();
    // The watchers, and a stake with a pennant telling the wind.
    for (const w of world.watchers) {
      const wy = rockTop(w.x) + 2 * u;
      const glass = w.glass && (world.worms.length || world.op.phase === 'calling' || world.oldOne) ? 1 : 0;
      drawFolk(E, w.x, wy, 52 * u, side > 0 ? -1 : 1, 0, { phase: Math.sin(E.t * 0.3 + w.seed) * 0.1, crouch: glass ? 0 : 0.05, seed: w.seed, pack: false, weapon: w.seed % 2 === 0 });
      if (glass) {
        ctx.strokeStyle = E.tone('#1a1612', 0);
        ctx.lineWidth = Math.max(0.8, 1.8 * u);
        ctx.beginPath();
        ctx.moveTo(w.x, wy - 47 * u);
        ctx.lineTo(w.x + (side > 0 ? -1 : 1) * 12 * u, wy - 49 * u);
        ctx.stroke();
      }
    }
    const sx = GW * (side > 0 ? 0.92 : 0.08);
    const sy = rockTop(sx);
    ctx.fillStyle = E.tone('#3a2e22', 0, 0.1);
    ctx.fillRect(sx - 1.5 * u, sy - 80 * u, 3 * u, 80 * u);
    const wv = world.wind / 40;
    ctx.fillStyle = E.tone('#b4542e', 0, 0.3);
    ctx.beginPath();
    ctx.moveTo(sx, sy - 80 * u);
    ctx.quadraticCurveTo(sx + wv * 30 * u, sy - 76 * u + Math.sin(E.t * 6) * 2 * u, sx + wv * 44 * u, sy - 70 * u + Math.sin(E.t * 7) * 3 * u);
    ctx.lineTo(sx + wv * 40 * u, sy - 66 * u);
    ctx.quadraticCurveTo(sx + wv * 24 * u, sy - 70 * u, sx, sy - 68 * u);
    ctx.fill();
    if (E.night > 0.1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      E.glow(sx, sy - 82 * u, 16 * u, '#ffb060', 0.6 * E.night);
      ctx.restore();
    }
  }

  // ---- the frame ------------------------------------------------------------------------------------
  let lightT = -99;
  let litDay = -1;
  let litStorm = 0;
  function sand() {
    const jumped = Math.abs(((world.day - litDay + 1.5) % 1) - 0.5) > 0.025 || Math.abs(world.storm - litStorm) > 0.25;
    if (!terrain || jumped) {
      // The first frame, or the clock jumped (fast-forward): all of it now.
      if (!terrain) {
        const res = Math.min(0.55, Math.max(0.38, 720 / GW));
        terrain = createTerrain(field, { W: GW, x0: 0, x1: GW, top: HY - 60 * u, bottom: GH, res, dNear, yOf: yE, mOf: mE, groundX, slabs: SLABS }, mk);
      }
      terrain.full(terrainLight());
      lightT = world.t;
      litDay = world.day;
      litStorm = world.storm;
      return;
    }
    // Otherwise a pass every few seconds, spread over many frames so none of them stalls.
    if (world.t - lightT > 5 && terrain.work(terrainLight, Math.ceil(terrain.cols / 18))) {
      lightT = world.t;
      litDay = world.day;
      litStorm = world.storm;
    }
  }
  function paint(t: number) {
    E.set(t, world.day, world.air, world.storm, world.wind, world.dust);
    sand();
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    drawSky(E, { W: GW, H: GH, horizon: HY, stars, moons, sunX: (k) => GW * (world.sunSide > 0 ? 0.1 + 0.8 * k : 0.9 - 0.8 * k) });
    drawMesas();
    drawOldOne();
    // Everything on the sand, by its slab.
    type D = { d: number; draw: () => void; light?: () => void };
    const list: D[] = [];
    for (const oc of outcrops) list.push({ d: oc.d, draw: () => drawOutcrop(oc) });
    for (const p of world.patches) list.push({ d: p.d, draw: () => drawPatchGlints(p) });
    for (const th of world.thumpers) list.push({ d: th.d, draw: () => drawThumper(th) });
    for (const wk of world.wrecks) list.push({ d: wk.d, draw: () => drawWreckAt(wk) });
    for (const wm of world.worms) list.push({ d: wm.d, draw: () => drawWormAt(wm) });
    for (const cr of world.crawlers) list.push({ d: cr.d, draw: () => drawCrawlerAt(cr) });
    for (const p of world.parties) list.push({ d: p.d, draw: () => drawPartyAt(p) });
    for (const dv of world.devils) list.push({ d: dv.d, draw: () => drawDevil(E, px(dv.x, dv.d), py(dv.d, 0, dv.x), dv.h * world.mOf(dv.d), dv.d, clamp01((world.t - dv.t0) / dv.dur)) });
    for (const ca of world.carryalls) list.push({ d: ca.d - 0.0001, draw: () => drawCarryallAt(ca) });
    for (const th of world.thopters) list.push({ d: th.d - 0.0002, draw: () => drawThopterAt(th) });
    for (const f of world.fx) list.push({ d: f.d - 0.0003, draw: () => drawFx(f), light: () => drawFxLight(f) });
    if (world.blow) list.push({ d: world.blow.d - 0.0003, draw: drawBlow });
    const bySlab: D[][] = SLABS.map(() => []);
    for (const it of list) bySlab[slabOfD(it.d)].push(it);
    const lights: (() => void)[] = [];
    const T = terrain!;
    const top = HY - 60 * u;
    for (let k = SLABS.length - 1; k >= 0; k--) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(T.canvases[k], 0, top, GW, GH - top);
      for (const it of bySlab[k].sort((a, b) => b.d - a.d)) {
        it.draw();
        if (it.light) lights.push(it.light);
      }
    }
    drawDrift();
    // The mirage: the sky lying on the sand at the horizon in the heat.
    const heat = heatOf(world.day) * (1 - world.storm);
    if (heat > 0.05) {
      const g = ctx.createLinearGradient(0, HY - 3 * u, 0, HY + 10 * u);
      g.addColorStop(0, hexA(E.light.low, 0));
      g.addColorStop(0.4, hexA(E.light.low, 0.7 * heat));
      g.addColorStop(1, hexA(E.light.low, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, HY - 3 * u, GW, 13 * u);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) l();
    ctx.restore();
    drawLedge();
    drawStorm(E, GW, GH, HY, world.storm, world.xOf(world.stormFront, 0.4), world.stormDir, world.flash);
    if (world.flash > 0 && world.storm < 0.1) {
      ctx.fillStyle = `rgba(255,230,200,${(0.18 * world.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, GW, GH);
    }
    ctx.restore();
    grade(t);
    labels(t);
    hud(t);
  }

  function grade(t: number) {
    if (!grain) {
      grain = document.createElement('canvas');
      grain.width = grain.height = 128;
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
      ctx.globalAlpha = 0.06;
      const step = Math.floor(t * 10);
      ctx.translate((step * 37) % 128, (step * 53) % 128);
      ctx.fillStyle = pat;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(20,12,6,0)');
    vg.addColorStop(1, `rgba(20,12,6,${(0.42 + E.night * 0.2).toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- words ----------------------------------------------------------------------------------------
  function labels(t: number) {
    if (!o.labels) return;
    ctx.font = SERIF(13, true);
    ctx.textAlign = 'center';
    const placed: [number, number, number][] = [];
    for (const l of [...world.labels].reverse()) {
      const age = t - l.t0;
      const text = fitText(ctx, typed(l.text, age, 45, t), W - 48);
      const w = ctx.measureText(text).width;
      const x = Math.max(w / 2 + 16, Math.min(W - w / 2 - 16, SX(l.x)));
      let y = Math.max(96, Math.min(H - 80, SY(l.y)));
      for (let k = 0; k < 4 && placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + w) / 2 + 8 && Math.abs(qy - y) < 20); k++) y -= 20;
      placed.push([x, y, w]);
      const a = Math.min(1, age * 3, (6 - age) / 1.5);
      const sg = ctx.createLinearGradient(x - w / 2 - 24, 0, x + w / 2 + 24, 0);
      sg.addColorStop(0, 'rgba(12,8,4,0)');
      sg.addColorStop(0.15, `rgba(12,8,4,${(0.55 * a).toFixed(3)})`);
      sg.addColorStop(0.85, `rgba(12,8,4,${(0.55 * a).toFixed(3)})`);
      sg.addColorStop(1, 'rgba(12,8,4,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x - w / 2 - 24, y - 15, w + 48, 21);
      ctx.fillStyle = hexA(l.color, a);
      fillCrisp(ctx, text, x, y);
    }
    tags(t, placed);
    ctx.textAlign = 'left';
  }

  /** Who is who on the sand: a name over each machine and party near enough, what it is doing, and what is heard on the radio. */
  function tags(t: number, placed: [number, number, number][]) {
    type Tag = { x: number; y: number; name: string; sub: string; line: string; lineT: number; pri: number; warn: boolean };
    const list: Tag[] = [];
    const op = world.op;
    for (const cr of world.crawlers) {
      if (cr.state === 'wreck') continue;
      const m = world.mOf(cr.d);
      const status = cr.state === 'lost' ? 'TAKEN' : cr.state === 'slung' ? 'SLUNG, INBOUND' : cr.state === 'lifting' ? 'LIFTING' : op.alarm > 0 ? `WORMSIGN · ${Math.max(0, Math.round(op.eta))} SECONDS` : `HOLD ${Math.round(cr.hold * 100)}%`;
      list.push({ x: SX(px(cr.x, cr.d)), y: SY(py(cr.d, cr.alt) - 60 * u * m), name: cr.name, sub: `SPICE CRAWLER · CREW ${cr.crew} · ${status}`, line: cr.line, lineT: cr.lineT, pri: 1 + (op.alarm > 0 ? 1 : 0) + (t - cr.lineT < 5 ? 1 : 0), warn: op.alarm > 0 || cr.state === 'lost' });
    }
    for (const ca of world.carryalls) {
      if (ca.state === 'off') continue;
      const m = world.mOf(ca.d);
      const status = ca.state === 'standoff' ? 'STANDING OFF' : ca.state === 'lift' ? 'COMING IN FOR THE LIFT' : ca.state === 'rise' ? 'LIFTING' : ca.state === 'away' ? 'AWAY TO THE REFINERY' : ca.state === 'lower' ? 'SETTING HER DOWN' : 'INBOUND';
      list.push({ x: SX(px(ca.x, ca.d)), y: SY(py(ca.d, ca.alt) - 50 * u * m), name: ca.name, sub: `CARRYALL · ${status}`, line: ca.line, lineT: ca.lineT, pri: 0.8 + (t - ca.lineT < 5 ? 1 : 0), warn: false });
    }
    for (const th of world.thopters) {
      if (th.state === 'off' || th.state === 'wreck' || th.d > 0.8) continue;
      const m = world.mOf(th.d);
      const kind = th.role === 'spotter' ? 'SPOTTER' : th.role === 'patrol' ? 'COMPANY PATROL' : th.role === 'smuggler' ? 'LANDER, NO MARKINGS' : 'RESCUE';
      const status = th.state === 'circle' ? 'CIRCLING' : th.state === 'landed' ? 'DOWN ON THE SAND' : th.state === 'falling' ? 'GOING DOWN' : th.state === 'land' ? 'LANDING' : th.state === 'takeoff' ? 'LIFTING OFF' : 'CROSSING';
      list.push({ x: SX(px(th.x, th.d)), y: SY(py(th.d, th.alt) - 30 * u * m), name: th.name, sub: `${kind} · ${status}`, line: th.line, lineT: th.lineT, pri: 0.4 + (t - th.lineT < 5 ? 1 : 0) + (th.state === 'falling' ? 2 : 0), warn: th.state === 'falling' });
    }
    for (const p of world.parties) {
      if (p.x < -50 * u || p.x > GW + 50 * u) continue;
      const m = world.mOf(p.d);
      const status = p.state === 'crouch' ? 'STILL, UNTIL IT PASSES' : p.state === 'salvage' ? 'AT THE WRECK' : p.state === 'meet' ? 'TRADING' : p.state === 'mount' ? 'MOUNTING' : p.state === 'wait' ? 'WAITING' : 'CROSSING';
      list.push({ x: SX(px(p.x, p.d)), y: SY(world.yOf(p.d) - 40 * u * m), name: 'THE DESERT FOLK', sub: `${p.members.length} WALKERS · ${status}`, line: p.line, lineT: p.lineT, pri: 0.5 + (t - p.lineT < 5 ? 1 : 0), warn: false });
    }
    for (const wm of world.worms) {
      if (wm.state === 'gone' || wm.state === 'submerge') continue;
      const m = world.mOf(wm.d);
      const status = wm.state === 'sign' ? `WORMSIGN · ${Math.round(wm.speed / u)} METRES A SECOND` : wm.state === 'strike' ? 'STRIKING' : wm.state === 'ridden' ? 'RIDDEN' : 'SURFACED';
      list.push({ x: SX(px(wm.x, wm.d)), y: SY(world.yOf(wm.d) - (wm.state === 'strike' ? 200 : 90) * u * m * wm.size), name: wm.size > 1.2 ? 'A GREAT WORM' : 'A WORM', sub: status, line: '', lineT: -99, pri: 2.5, warn: true });
    }
    list.sort((a, b) => b.pri - a.pri);
    let shown = 0;
    for (const g of list) {
      if (shown >= 7) break;
      if (g.x < 30 || g.x > W - 30) continue;
      const edge = clamp01(Math.min(g.x - 30, W - 30 - g.x) / 90);
      ctx.font = SERIF(11);
      const nw = ctx.measureText(g.name).width;
      ctx.font = SERIF(9);
      const sw = ctx.measureText(g.sub).width;
      const w = Math.max(nw, sw);
      let y = Math.max(72, Math.min(H - 60, g.y));
      for (let k = 0; k < 4 && placed.some(([qx, qy, qw]) => Math.abs(qx - g.x) < (qw + w) / 2 + 8 && Math.abs(qy - (y - 14)) < 24); k++) y -= 24;
      if (placed.some(([qx, qy, qw]) => Math.abs(qx - g.x) < (qw + w) / 2 + 8 && Math.abs(qy - (y - 14)) < 24)) continue;
      placed.push([g.x, y - 14, w]);
      shown++;
      const a = edge * 0.9;
      ctx.strokeStyle = hexA('#efe6d2', 0.45 * a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(g.x) + 0.5, y - 3);
      ctx.lineTo(Math.round(g.x) + 0.5, Math.max(y - 3, Math.min(H, g.y)));
      ctx.stroke();
      const bg = ctx.createLinearGradient(g.x - w / 2 - 14, 0, g.x + w / 2 + 14, 0);
      bg.addColorStop(0, 'rgba(12,8,4,0)');
      bg.addColorStop(0.2, `rgba(12,8,4,${(0.42 * a).toFixed(3)})`);
      bg.addColorStop(0.8, `rgba(12,8,4,${(0.42 * a).toFixed(3)})`);
      bg.addColorStop(1, 'rgba(12,8,4,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(g.x - w / 2 - 14, y - 28, w + 28, 26);
      ctx.font = SERIF(11);
      ctx.fillStyle = hexA(g.warn ? '#fcd0a0' : '#f3e9d2', a);
      fillCrisp(ctx, g.name, g.x, y - 15);
      ctx.font = SERIF(9);
      ctx.fillStyle = hexA(g.warn ? '#e8b080' : '#cdbf9c', a * 0.9);
      fillCrisp(ctx, g.sub, g.x, y - 5);
      const age = t - g.lineT;
      if (g.line && age < 5) {
        ctx.font = SERIF(12, true);
        const text = `“${typed(g.line, age, 40, t)}”`;
        const lw = ctx.measureText(`“${g.line}”`).width;
        const la = Math.min(1, age * 4, (5 - age) / 0.8) * edge;
        const ly = y - 34;
        const lg = ctx.createLinearGradient(g.x - lw / 2 - 16, 0, g.x + lw / 2 + 16, 0);
        lg.addColorStop(0, 'rgba(12,8,4,0)');
        lg.addColorStop(0.15, `rgba(12,8,4,${(0.55 * la).toFixed(3)})`);
        lg.addColorStop(0.85, `rgba(12,8,4,${(0.55 * la).toFixed(3)})`);
        lg.addColorStop(1, 'rgba(12,8,4,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(g.x - lw / 2 - 16, ly - 13, lw + 32, 18);
        ctx.fillStyle = hexA('#fde68a', la);
        fillCrisp(ctx, text, Math.max(lw / 2 + 12, Math.min(W - lw / 2 - 12, g.x)), ly);
        placed.push([g.x, ly, lw]);
      }
    }
  }

  function hud(t: number) {
    if (!o.hud) return;
    const level = 0.55 + 0.45 * host.intensity;
    ctx.textAlign = 'left';
    ctx.font = SERIF(15);
    ctx.fillStyle = hexA('#f3e9d2', 0.92 * level);
    fillCrisp(ctx, fitText(ctx, `SANDSEA · ${world.name}`, W - 32), 16, 26);
    ctx.font = SERIF(10);
    ctx.fillStyle = hexA('#cdbf9c', 0.85 * level);
    const windWords = Math.abs(world.wind) < 6 ? 'STILL AIR' : Math.abs(world.wind) < 18 ? 'A LIGHT WIND' : Math.abs(world.wind) < 32 ? 'A STRONG WIND' : 'A GALE';
    const cond = world.storm > 0.3 ? 'A SANDSTORM' : heatOf(world.day) > 0.5 ? 'THE HEAT OF THE DAY' : E.night > 0.5 ? 'THE COLD OF THE NIGHT' : goldenOf(world.day) > 0.3 ? 'THE LOW SUN' : windWords;
    fillCrisp(ctx, fitText(ctx, `${timeWords(world.day)} · ${AIRS[world.air].label.toUpperCase()} · ${cond}`, W - 32), 16, 42);
    const working = world.crawlers.filter((c) => c.state === 'working').length;
    fillCrisp(ctx, fitText(ctx, `${Math.round(world.tonnes)} TONNES OF SPICE BROUGHT IN · ${world.lost} CRAWLER${world.lost === 1 ? '' : 'S'} LOST · ${working ? 'A CRAWLER ON THE SAND' : 'THE SAND IS EMPTY'} · ${world.cast.map((c) => c.toUpperCase()).join(' · ')}`, W - 32), 16, 56);
    ctx.font = SERIF(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#f3e9d2', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [SX(x), SY(y)],
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y],
    after: (dt) => {
      framing.update(dt, world.t, world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => paint(t),
    ambience: () => (world.storm > 0.3 ? 0.9 : world.worms.length ? 0.8 : 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
