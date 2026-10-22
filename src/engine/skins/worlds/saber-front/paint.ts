/**
 * Saber Front, painted: two painters for one battle.
 *
 * The scene (the default) is a matte painting of the battlefield from a ridge, like a frame from a
 * painted war film: a sky with its capital ships, its planets and its dogfights; the far things on
 * the horizon in layers of haze; the field below, lit per pixel; the armies on it, drawn as
 * themselves and sorted by distance; smoke columns leaning on the wind; bolts, blasts, engines and
 * blades as light; the ridge we stand on. Text belongs to the fiction: the radio as film subtitles,
 * the biggest moments as a title, and a small holo readout of the engagement in the corner.
 *
 * The map (`view: 'map'`) is the same battle on a commander's holo-table: see ./holo.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash } from '../../instruments/kit';
import { BOLT } from './fields';
import { drawCover, drawFacility, drawTrident, drawVehicle } from './armour';
import { drawBubble, drawDroid, drawGeonosian, drawKnight, drawMagna, drawRoller, drawTrooper, drawTwilek, drawWookiee, isSmall, type Pose } from './figures';
import { createHolo } from './holo';
import { bakeCapital, drawDome, drawFighter, drawGenerator, drawGunship, drawHexa, drawLander, drawSpider, drawWreck, type Lamp } from './machines';
import { bakeBackdrop, bakeGround, bakeHangarWalls, bakeRidge, bakeSky, clamp01, createEnv, hexA, mix, mk, posmod, ridgeTop, vnoise, type GroundBake } from './scene';
import { createSaberFront, dogfightAt } from './sim';
import type { Capital, SaberWorld, Side } from './types';

const VEHICLE_KINDS = new Set(['atrt', 'saber', 'barc', 'spha', 'aat', 'dsd', 'mtt', 'hailfire', 'crab']);

export type SaberPaintOptions = { traffic: number; camera: string; field: string; view: string; labels: boolean; hud: boolean };

/** The type of the battle's words: a clean, wide sans for titles and readouts, as on a film's cards. */
export const SANS = (px: number, weight = 500) => `${weight} ${px}px "Avenir Next", "Futura", "Century Gothic", "Segoe UI", ui-sans-serif, sans-serif`;
export const MONO = (px: number) => `${px}px "SFMono-Regular", "Menlo", "Consolas", ui-monospace, monospace`;

/** A radio line as a subtitle reads: sentence case, the proper names kept. */
export function sentence(text: string): string {
  const low = text.toLowerCase();
  return low
    .replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase())
    .replace(/\bi\b/g, 'I')
    .replace(/\bi'(m|ll|ve|d)\b/g, (m) => `I${m.slice(1)}`);
}

export function mountSaberFront(host: SkinHost, o: SaberPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: SaberWorld = createSaberFront(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera, field: o.field });
  const { GW, GH, u, HY } = world;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.35, closer: 1.8, maxZoom: 2.6 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const E = createEnv(ctx, world);
  const L = E.L;
  const lr = host.fork('saber-look');
  const seedN = Math.floor(lr() * 1e6);
  const ridgeSide = lr() < 0.5 ? 1 : -1;
  const holo = o.view === 'map' ? createHolo(host, world, { labels: o.labels, hud: o.hud }) : null;
  let baked: { sky: HTMLCanvasElement; back: HTMLCanvasElement; ground: GroundBake; ridge: HTMLCanvasElement; walls: HTMLCanvasElement | null } | null = null;
  let grain: HTMLCanvasElement | null = null;
  const caps = new Map<number, ReturnType<typeof bakeCapital> & { len: number }>();

  // ---- where things are on the picture -------------------------------------------------------------
  const px = (x: number, d: number) => world.xOf(x, d);
  /** The ground's own height under (x, d): hills and rises. */
  const gh = (x: number, d: number) => world.terrain.height(x, d);
  /** Up off the ground at depth d by `alt`, standing on the land's rise when x is given. */
  const py = (d: number, alt = 0, x?: number) => world.yOf(d) - (alt + (x === undefined ? 0 : gh(x, d))) * world.mOf(d);
  const mOf = (d: number) => world.mOf(d);
  /** Figures and machines are drawn a little larger than true, so they read at their distance. */
  const FIG = 54 * u * (world.phone ? 1.45 : 1);
  const MACH = u * 1.4 * (world.phone ? 1.3 : 1);
  const legion = world.legion.color;

  // ---- the armies --------------------------------------------------------------------------------------
  const lamps: Lamp[] = [];
  const blades: { seg: [number, number, number, number]; color: string; w: number }[] = [];
  function drawSoldier(s: SaberWorld['soldiers'][number]) {
    const m = mOf(s.d);
    const x = px(s.x, s.d);
    const y = py(s.d, s.alt, s.x);
    const h = FIG * m * (s.kind === 'super' ? 1.12 : s.kind === 'wookiee' ? 1.3 : s.kind === 'magna' ? 1.12 : s.kind === 'geonosian' ? 0.95 : 1);
    const age = world.t - s.t0;
    const moving = s.state === 'march' || s.state === 'charge' || s.state === 'retreat' || s.state === 'sneak' ? 1 : s.state === 'line' ? 0.15 * (1 - s.crouch) : 0;
    const p: Pose = { ph: s.ph, moving, crouch: s.crouch, fall: s.state === 'fall' ? Math.min(1, age / 0.6) : 0, dead: s.state === 'dead', firing: world.t - s.fireT < 0.08 ? 1 : 0, seed: s.seed };
    if (s.state === 'dead') {
      // The fallen fade into the field after a while.
      const fade = clamp01(1 - (age - 55) / 30);
      if (fade <= 0) return;
      ctx.globalAlpha = fade;
    } else if (s.alt <= 0) {
      ctx.fillStyle = hexA('#000000', 0.22 * (1 - E.hazeOf(s.d)) * (1 - L.night * 0.4));
      ctx.beginPath();
      ctx.ellipse(x - E.lx * h * 0.18, y, h * 0.22, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.kind === 'wookiee') drawWookiee(E, x, y, h, s.face, s.d, p, s.seed);
    else if (s.kind === 'twilek') drawTwilek(E, x, y, h, s.face, s.d, p, s.seed);
    else if (s.kind === 'geonosian') drawGeonosian(E, x, y, h, s.face, s.d, p, s.alt > 4 * u);
    else if (s.kind === 'magna') {
      const st = drawMagna(E, x, y, h, s.face, s.d, p);
      if (s.state !== 'dead') for (const [ex, ey] of [[st[0], st[1]], [st[2], st[3]]]) lamps.push({ x: ex, y: ey, r: h * 0.12, color: '#c8a0ff', a: 0.9 });
    } else if (s.side === 'ga') drawTrooper(E, x, y, h, s.face, s.d, p, { legion, kind: s.kind });
    else drawDroid(E, x, y, h, s.face, s.d, p, { kind: s.kind });
    if (s.kind === 'jet' && s.alt > 2 * u && s.state !== 'dead') {
      lamps.push({ x: x - s.face * h * 0.16, y: y - h * 0.32, r: h * 0.3, color: '#8ad0ff', a: 0.9 });
      lamps.push({ x: x - s.face * h * 0.16, y: y - h * 0.2, r: h * 0.2, color: '#ffffff', a: 0.7 });
    }
    ctx.globalAlpha = 1;
    if (p.firing && s.state !== 'dead') lamps.push({ x: x + s.face * h * 0.48, y: y - h * (s.crouch > 0.5 ? 0.42 : 0.6), r: h * 0.35, color: s.side === 'ga' ? BOLT.ga : BOLT.cf, a: 0.9 });
  }
  function drawKnightAt(k: SaberWorld['knights'][number]) {
    const m = mOf(k.d);
    const x = px(k.x, k.d);
    const y = py(k.d, 0, k.x);
    const h = FIG * m * (isSmall(k.name) ? 0.55 : k.four ? 1.25 : 1.05);
    ctx.fillStyle = hexA('#000000', 0.22 * (1 - E.hazeOf(k.d)));
    ctx.beginPath();
    ctx.ellipse(x, y, h * 0.22, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    const moving = k.state === 'lead' || k.state === 'withdraw' || (k.state === 'duel' && Math.abs(Math.sin(k.ph)) > 0.1) ? 1 : 0;
    const segs = drawKnight(E, x, y, h, k.face, k.d, { ph: k.ph, moving, crouch: 0, fall: 0, dead: false, firing: 0, seed: k.seed }, { name: k.name, robe: k.robe, blade: k.blade, swing: k.swing, lead: k.state === 'lead', twin: k.twin, four: k.four, dark: k.side === 'cf' });
    for (const sg of segs) blades.push({ seg: sg, color: k.blade, w: Math.max(1.2, h * 0.05) });
    if (world.t - k.parryT < 0.15) lamps.push({ x: segs[0][2], y: segs[0][3], r: h * 0.5, color: '#ffffff', a: 0.8 });
  }

  // ---- the machines ---------------------------------------------------------------------------------------
  function shadow(x: number, d: number, alt: number, w: number) {
    const m = mOf(d);
    const a = clamp01(0.35 - (alt * m) / (500 * u)) * (1 - L.night * 0.5) * (1 - E.hazeOf(d) * 0.7);
    if (a <= 0.02) return;
    ctx.fillStyle = hexA('#000000', a);
    ctx.beginPath();
    ctx.ellipse(px(x, d) - E.lx * alt * m * 0.4, py(d, 0, x), w * m * 0.5, w * m * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawWalkerAt(w: SaberWorld['walkers'][number]) {
    const m = mOf(w.d);
    const x = px(w.x, w.d);
    const y = py(w.d, w.alt, w.x);
    const s = MACH * m * (w.kind === 'hexa' ? 1 : 1.05);
    const fall = w.state === 'fall' ? clamp01((world.t - w.t0) / 3.4) : 0;
    const dx = px(w.aimX, w.aimD) - x;
    const dy = py(w.aimD) - y;
    const aim = w.aimX ? Math.max(-0.15, Math.min(0.5, Math.atan2(-dy, Math.abs(dx)) + 0.06)) : 0.08;
    const fire = clamp01(1 - (world.t - w.fireT) / 0.4);
    shadow(w.x, w.d, w.alt, w.kind === 'hexa' ? 170 * u : 150 * u);
    const o = { ph: w.ph, aim, fire, tilt: fall * fall * 0.35 * (w.seed % 2 ? 1 : -1), sink: fall * 18, seed: w.seed };
    const mouth = w.kind === 'hexa' ? drawHexa(E, x, y, s, w.face, w.d, { ...o, legion }) : drawSpider(E, x, y, s, w.face, w.d, o);
    if (fire > 0) lamps.push({ x: mouth[0], y: mouth[1], r: 40 * s * fire, color: w.side === 'ga' ? '#8ad0ff' : '#ff8a5a', a: fire });
    if (w.kind === 'spider') lamps.push({ x: x + w.face * 24 * s, y: y - 80 * s, r: 9 * s, color: '#ff3a2a', a: 0.7 });
    if (w.kind === 'hexa' && L.night > 0.4) lamps.push({ x: x + w.face * 76 * s, y: y - 44 * s, r: 30 * s, color: '#fff0c0', a: 0.35 * L.night });
  }
  function drawCraftAt(c: SaberWorld['crafts'][number]) {
    const m = mOf(c.d);
    const x = px(c.x, c.d);
    const y = py(c.d, c.alt);
    if (c.kind === 'trident') {
      drawTrident(E, x, py(c.d), MACH * m * 0.9, c.d, clamp01(1 + c.alt / (90 * u)), c.doors, lamps);
      return;
    }
    shadow(c.x, c.d, c.alt, c.kind === 'lander' ? 220 * u : 120 * u);
    if (c.kind === 'lander') drawLander(E, x, y, MACH * m * 0.85, c.face, c.d, { ramp: c.doors, alt: c.alt / u, seed: c.seed }, lamps);
    else {
      const sq = world.squads.find((q) => q.id === c.walker);
      drawGunship(E, x, y, MACH * m * 1.0, c.face, c.d, { legion, doors: c.doors, bank: c.bank * c.face, spin: c.spin, carrier: c.kind === 'carrier', seed: c.seed, firing: clamp01(1 - (world.t - c.fireT) / 0.1), crew: c.state === 'drop' ? c.cargo : sq ? sq.size : 0 }, lamps);
      // Rotor-wash dust when low, a searchlight at night.
      if (L.night > 0.5 && c.alt > 20 * u && c.state !== 'falling') {
        const gx = px(c.x + c.face * 60 * u, c.d);
        lamps.push({ x: gx, y: py(c.d), r: 50 * u * m, color: '#fff0d0', a: 0.18 * L.night });
      }
    }
  }
  function drawWreckAt(wk: SaberWorld['wrecks'][number]) {
    const m = mOf(wk.d);
    if (VEHICLE_KINDS.has(wk.kind)) {
      const tone = E.tone;
      E.tone = (c, d, lift = 0) => mix(tone(c, d, lift * 0.3), '#14100c', 0.6);
      ctx.save();
      const x = px(wk.x, wk.d);
      const y = py(wk.d, 0, wk.x);
      ctx.translate(x, y);
      ctx.rotate(0.08 * wk.face);
      drawVehicle(E, 0, 4 * u * m, MACH * m * 0.9, wk.face, wk.d, { kind: wk.kind, ph: 0, aim: -0.2, fire: 0, legion, doors: 0, seed: wk.seed, hover: 0, dead: true }, []);
      ctx.restore();
      E.tone = tone;
    } else drawWreck(E, wk.kind, px(wk.x, wk.d), py(wk.d, 0, wk.x), MACH * m, wk.face, wk.d, wk.seed, legion);
    if (wk.smoke > 0.3 && L.night > 0.2) lamps.push({ x: px(wk.x, wk.d), y: py(wk.d) - 10 * u * m, r: 60 * u * m, color: '#ff7a30', a: 0.35 * wk.smoke });
  }
  function drawStandard(sd: SaberWorld['standards'][number]) {
    const m = mOf(sd.d);
    const x = px(sd.x, sd.d);
    const y = py(sd.d, 0, sd.x);
    const h = FIG * m * 2.4;
    ctx.strokeStyle = E.tone('#2a2622', sd.d);
    ctx.lineWidth = Math.max(0.8, 2 * u * m);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    const wave = Math.sin(E.t * 3 + sd.seed) * 0.15;
    const col = E.tone(sd.side === 'ga' ? legion : '#3a3a7a', sd.d, 0.2);
    const col2 = E.tone(sd.side === 'ga' ? '#f0eee6' : '#d88a30', sd.d, 0.3);
    const fw = h * 0.45 * (world.wind >= 0 ? 1 : -1);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + fw * 0.5, y - h + h * wave * 0.3, x + fw, y - h + h * 0.05);
    ctx.lineTo(x + fw, y - h + h * 0.32);
    ctx.quadraticCurveTo(x + fw * 0.5, y - h + h * (0.3 - wave * 0.3), x, y - h + h * 0.3);
    ctx.fill();
    ctx.fillStyle = col2;
    ctx.fillRect(Math.min(x + fw * 0.25, x + fw * 0.55), y - h + h * 0.13, Math.abs(fw) * 0.3, h * 0.06);
  }

  // ---- the war machines -------------------------------------------------------------------------------------
  function drawVehicleAt(v: SaberWorld['vehicles'][number]) {
    const m = mOf(v.d);
    const x = px(v.x, v.d);
    const y = py(v.d, 0, v.x);
    const s = MACH * m * (v.kind === 'atrt' || v.kind === 'dsd' || v.kind === 'barc' ? 0.9 : 1);
    shadow(v.x, v.d, v.alt, (v.kind === 'mtt' ? 180 : v.kind === 'spha' ? 150 : 70) * u);
    let aim = 0.05;
    if (v.aimX) {
      const dx = px(v.aimX, v.aimD) - x;
      const dy = py(v.aimD, 0, v.aimX) - y;
      aim = Math.max(-0.2, Math.min(0.5, Math.atan2(-dy, Math.abs(dx))));
    }
    const fire = clamp01(1 - (world.t - v.fireT) / 0.3);
    const hover = v.alt > 0 ? (v.alt / u) * (0.8 + 0.2 * Math.sin(E.t * 3 + v.seed)) : 0;
    const muzzle = drawVehicle(E, x, y, s, v.face, v.d, { kind: v.kind, ph: v.ph, aim, fire, legion, doors: v.doors, seed: v.seed, hover }, lamps);
    if (fire > 0 && v.kind !== 'spha' && v.kind !== 'hailfire') lamps.push({ x: muzzle[0], y: muzzle[1], r: (v.kind === 'aat' || v.kind === 'saber' ? 40 : 18) * s * fire, color: v.side === 'ga' ? BOLT.ga : BOLT.cf, a: fire });
  }
  function drawMissile(mi: SaberWorld['missiles'][number], t: number) {
    const k = (t - mi.t0) / mi.dur;
    if (k < 0 || k > 1) return;
    const d = mi.d0 + (mi.d1 - mi.d0) * k;
    const x = mi.x0 + (mi.x1 - mi.x0) * k;
    const a = mi.a0 + (mi.a1 - mi.a0) * k + Math.sin(k * Math.PI) * 120 * u;
    E.glow(px(x, d), py(d, a, x), 12 * u, '#ffb060', 0.9);
    E.glow(px(x, d), py(d, a, x), 4 * u, '#ffffff', 0.9);
  }
  // ---- smoke, fire, dust: the air of the battle ------------------------------------------------------------
  function drawFx(f: SaberWorld['fx'][number]) {
    const age = world.t - f.t0;
    if (age < 0) return;
    const k = age / f.dur;
    const m = mOf(f.d);
    const x = px(f.x, f.d);
    const y = py(f.d, f.alt, f.x);
    const r = f.r * m * 1.8;
    if (f.kind === 'smoke' || f.kind === 'dust') {
      const base = f.kind === 'smoke' ? E.tone(f.color, f.d) : E.tone(mix(L.ground2, L.haze, 0.3), f.d, 0.3);
      const a = (f.kind === 'smoke' ? 0.5 : 0.32) * Math.pow(1 - k, 1.1) * Math.min(1, age * 3);
      const s = r * (1.2 + k * 3);
      ctx.globalAlpha = a;
      ctx.drawImage(E.soft(base), x - s / 2, y - s / 2, s, s * 0.85);
      if (f.kind === 'smoke' && L.rim > 0.3) {
        // The side toward the light, lit.
        ctx.globalAlpha = a * 0.45 * L.rim * (1 - L.night * 0.6);
        ctx.drawImage(E.soft(E.tone(mix(f.color, L.sun, 0.5), f.d, 0.6)), x - s / 2 + E.lx * s * 0.18, y - s * 0.55, s * 0.8, s * 0.6);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === 'blast') {
      // The fireball: hot at the heart, rolling up into dark smoke.
      const s = r * (0.6 + k * 1.4);
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.drawImage(E.soft(mix('#ffcc70', '#3a2a20', k * 1.2)), x - s, y - s * 1.3, s * 2, s * 1.7);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'debris') {
      ctx.fillStyle = E.tone(f.color, f.d);
      ctx.fillRect(x, y, Math.max(1, f.r * m), Math.max(1, f.r * m));
    }
  }
  function drawFxLight(f: SaberWorld['fx'][number]) {
    const age = world.t - f.t0;
    const k = age / f.dur;
    const m = mOf(f.d);
    const x = px(f.x, f.d);
    const y = py(f.d, f.alt, f.x);
    if (f.kind === 'fire') {
      E.glow(x, y, f.r * m * 2.6, '#ff8a30', 0.75 * (1 - k));
      E.glow(x, y, f.r * m * 1.1, '#ffe0a0', 0.6 * (1 - k));
    } else if (f.kind === 'flash') {
      E.glow(x, y, f.r * m * (1 + k), f.color === '#5a5450' ? '#ffd8a0' : f.color, (1 - k) * 0.95);
      E.pool(x, py(f.d), f.r * m * 2.4, '#ff9a50', (1 - k) * (0.35 + L.night * 0.5));
    } else if (f.kind === 'blast') E.glow(x, y, f.r * m * 2, '#ffb060', (1 - k) * 0.6);
    else if (f.kind === 'spark') {
      ctx.strokeStyle = hexA(f.color, 1 - k);
      ctx.lineWidth = Math.max(0.8, 1.4 * u * m);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - f.vx * 0.02 * m, y + f.valt * 0.02 * m);
      ctx.stroke();
      E.glow(x, y, 8 * u * m, f.color, (1 - k) * 0.6);
    }
  }
  /** A bolt: a short bright streak with a coloured halo, travelling. */
  function drawBolt(b: SaberWorld['bolts'][number], t: number) {
    const k = (t - b.t0) / b.dur;
    if (k < 0 || k > 1) return;
    const at = (q: number): [number, number] => {
      const qq = Math.max(0, Math.min(1, q));
      const d = b.d0 + (b.d1 - b.d0) * qq;
      const bx = b.x0 + (b.x1 - b.x0) * qq;
      return [px(bx, d), py(d, b.a0 + (b.a1 - b.a0) * qq, bx)];
    };
    const [x1, y1] = at(k);
    const m = mOf(b.d0 + (b.d1 - b.d0) * k);
    const [xa, ya] = at(k - 0.02);
    const dl = Math.hypot(x1 - xa, y1 - ya) || 1;
    const len = (b.kind === 'cannon' ? 60 : b.kind === 'turret' ? 40 : 30) * u * Math.max(0.3, m);
    const x0 = x1 - ((x1 - xa) / dl) * len;
    const y0 = y1 - ((y1 - ya) / dl) * len;
    const col = b.side === 'ga' ? BOLT.ga : BOLT.cf;
    const w = (b.kind === 'cannon' ? 5 : 2.4) * u * Math.max(0.4, m);
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA(col, 0.55);
    ctx.lineWidth = w * 2.6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = hexA(mix(col, '#ffffff', 0.45), 1);
    ctx.lineWidth = w * 0.9;
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (b.kind === 'cannon') E.glow(x1, y1, 26 * u * m, col, 0.7);
  }
  function drawShell(s: SaberWorld['shells'][number], t: number) {
    const k = (t - s.t0) / s.dur;
    if (k < 0 || k > 1) return;
    const at = (q: number): [number, number] => {
      const d = s.d0 + (s.d1 - s.d0) * q;
      const sx2 = s.x0 + (s.x1 - s.x0) * q;
      return [px(sx2, d), py(d, 4 * s.apex * q * (1 - q), sx2)];
    };
    const [x, y] = at(k);
    const col = s.side === 'ga' ? '#9ad8ff' : '#ffa060';
    ctx.strokeStyle = hexA(col, 0.35);
    ctx.lineWidth = 2.4 * u;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const q = Math.max(0, k - 0.12 + (i / 8) * 0.12);
      const [qx, qy] = at(q);
      if (i === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    }
    ctx.stroke();
    E.glow(x, y, 14 * u, col, 0.9);
    E.glow(x, y, 4 * u, '#ffffff', 0.9);
  }

  // ---- the sky's things ------------------------------------------------------------------------------------
  const capLen = (c: Capital) => (c.kind === 'wedge' ? 330 : c.kind === 'frigate' ? 340 : 170) * u;
  function drawCapital(c: Capital) {
    let b = caps.get(c.id);
    const len = capLen(c);
    if (!b) {
      const haze = clamp01(0.62 - c.s0 * 0.45);
      b = { ...bakeCapital(E, c.kind, Math.ceil(len * c.s0 * 1.7 * 1.6), haze, c.seed, mk), len };
      caps.set(c.id, b);
    }
    const scale = (len * c.s) / (len * c.s0 * 1.7 * 1.6) * 1;
    const cw = b.canvas.width * scale;
    const ch = b.canvas.height * scale;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.falling > 0) ctx.rotate(c.face * c.falling * 0.35);
    ctx.scale(c.face, 1);
    ctx.drawImage(b.canvas, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
    // Its lights, its engines; hits and fire on it.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ps = scale * (b.canvas.width / (b.ox * 2));
    for (const [i, [lx, ly]] of b.lights.entries()) {
      const tw = 0.5 + 0.5 * Math.sin(E.t * (0.6 + (i % 5) * 0.3) + i);
      const engine = i < 3 && (c.kind === 'wedge' || c.kind === 'frigate');
      const a = engine ? 0.9 : 0.3 + tw * 0.4;
      E.glow(c.x + c.face * lx * ps, c.y + ly * ps, (engine ? 14 : 3) * u * c.s * 1.6, engine ? (c.side === 'ga' ? '#8ad0ff' : '#ff9a60') : '#ffe8c0', a);
    }
    if (world.t - c.hitT < 0.4) for (let i = 0; i < 3; i++) E.glow(c.x + (hash(Math.floor(world.t * 7), i) - 0.5) * len * c.s * 0.8, c.y + (hash(i, Math.floor(world.t * 7)) - 0.5) * len * c.s * 0.08, 30 * u * c.s, '#ffb070', 0.8);
    if (c.falling > 0) for (let i = 0; i < 6; i++) E.glow(c.x + (hash(c.seed, i) - 0.5) * len * c.s * 0.7, c.y + (hash(i, c.seed) - 0.6) * 20 * u * c.s, (20 + hash(i, 3) * 30) * u * c.s, '#ff7a30', 0.6 + 0.3 * Math.sin(E.t * 9 + i));
    ctx.restore();
    if (c.falling > 0) {
      // A trail of black smoke behind her as she goes.
      for (let i = 0; i < 14; i++) {
        const q = i / 14;
        const sx = c.x - c.face * q * 220 * u - (world.wind * q * 4);
        const sy = c.y - q * 140 * u * c.falling;
        const s = (30 + q * 90) * u * c.s;
        ctx.globalAlpha = 0.35 * (1 - q);
        ctx.drawImage(E.soft(mix('#1e1a18', L.haze, 0.3)), sx - s / 2, sy - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    }
  }
  /** Where a capital ship came down: a broken hull standing up over the horizon, and its smoke, for good. */
  function drawHulk(hk: SaberWorld['hulks'][number]) {
    const s = hk.s * u;
    const age = world.t - hk.t0;
    const col = mix(mix('#2a2826', L.ink, 0.4), mix(L.haze, L.low, 0.4), 0.45);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(hk.x - 160 * s, HY + 2);
    ctx.lineTo(hk.x - 60 * s, HY - 70 * s);
    ctx.lineTo(hk.x - 20 * s, HY - 64 * s);
    ctx.lineTo(hk.x + 10 * s, HY - 120 * s);
    ctx.lineTo(hk.x + 40 * s, HY - 30 * s);
    ctx.lineTo(hk.x + 150 * s, HY + 2);
    ctx.fill();
    if (age < 3) E.glow(hk.x, HY - 40 * u, (300 + age * 200) * u, '#ffd090', (1 - age / 3) * 0.9);
  }
  /** Its smoke stands up over everything on the horizon. */
  function drawHulkSmoke(hk: SaberWorld['hulks'][number]) {
    const s = hk.s * u;
    const smoke = mix(mix('#2a2420', L.haze, 0.35), L.mid, 0.15);
    for (let i = 0; i < 18; i++) {
      const q = posmod(i / 18 + E.t * 0.012, 1);
      const sx = hk.x + (hash(i, 2) - 0.5) * 30 * u + world.wind * q * 20 + Math.sin(E.t * 0.2 + i) * 10 * u * q;
      const sy = HY - 60 * s - q * HY * 0.7;
      const r = (40 + q * 180) * u * Math.max(0.6, hk.s);
      ctx.globalAlpha = 0.62 * Math.pow(1 - q, 1.1) * Math.min(1, q * 8);
      ctx.drawImage(E.soft(smoke), sx - r, sy - r * 0.8, r * 2, r * 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    E.glow(hk.x, HY - 30 * s, 90 * u * hk.s, '#ff7a30', 0.35 + 0.15 * Math.sin(E.t * 3));
    ctx.restore();
  }
  function drawSky(t: number) {
    const fighterHaze = (s: number) => clamp01(0.5 - s * 0.4) * (1 - L.night * 0.3);
    for (const df of world.dogfights) {
      const over = df.state === 'over';
      for (const chaser of [false, true]) {
        const side: Side = chaser ? (df.chased === 'ga' ? 'cf' : 'ga') : df.chased;
        if (over && df.winner !== side) continue;
        const p = dogfightAt(df, t, chaser);
        const s = df.s * u * 0.85;
        if (over) {
          const k = (t - df.downT) / 5;
          drawFighter(E, p.x + (t - df.downT) * 140 * u * Math.cos(p.ang) * k, p.y - k * 60 * u, s, p.ang - k * 0.5, side, { legion, haze: fighterHaze(df.s) }, lamps);
        } else drawFighter(E, p.x, p.y, s, p.ang, side, { legion, haze: fighterHaze(df.s) }, lamps);
        // A faint contrail behind each.
        ctx.strokeStyle = hexA(mix(L.low, '#ffffff', 0.4), 0.12 * (1 - L.night * 0.5));
        ctx.lineWidth = 1.2 * u;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const q = dogfightAt(df, t - i * 0.12, chaser);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
      }
    }
    for (const f of world.flybys) {
      const ang = Math.atan2(f.vy, f.vx);
      for (let i = 0; i < f.n; i++) {
        const ox = -Math.sign(f.vx) * i * 26 * u * f.s;
        const oy = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 14 * u * f.s;
        drawFighter(E, f.x + ox, f.y + oy, f.s * u * (f.kind === 'bomber' ? 1.3 : 0.85), ang, f.side, { legion, bomber: f.kind === 'bomber', haze: fighterHaze(f.s) }, lamps);
      }
    }
    for (const sf of world.skyfalls) {
      const age = t - sf.t0;
      for (let i = 0; i < 6; i++) {
        const q = i / 6;
        const r = (6 + q * 20 + age * 2) * u * sf.s;
        ctx.globalAlpha = 0.4 * (1 - q) * clamp01(1 - age / 14);
        ctx.drawImage(E.soft(mix('#2a2422', L.haze, 0.3)), sf.x - sf.vx * q * 0.4 - r / 2, sf.y - sf.vy * q * 0.4 - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
      lamps.push({ x: sf.x, y: sf.y, r: 14 * u * sf.s, color: '#ff8a30', a: 0.8 * clamp01(1 - age / 10) });
      if (age < 0.6) lamps.push({ x: sf.x, y: sf.y, r: 60 * u * sf.s, color: '#ffd090', a: 1 - age / 0.6 });
    }
  }
  function drawSkyBolts(t: number) {
    for (const b of world.skybolts) {
      const k = (t - b.t0) / b.dur;
      if (k < 0 || k > 1) continue;
      const k0 = Math.max(0, k - 0.35);
      const x1 = b.x0 + (b.x1 - b.x0) * k;
      const y1 = b.y0 + (b.y1 - b.y0) * k;
      const x0 = b.x0 + (b.x1 - b.x0) * k0;
      const y0 = b.y0 + (b.y1 - b.y0) * k0;
      ctx.strokeStyle = hexA(b.color, 0.5);
      ctx.lineWidth = 2.2 * u * b.w;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = hexA('#ffffff', 0.8);
      ctx.lineWidth = 0.7 * u * b.w;
      ctx.stroke();
    }
  }
  /** Far off, beyond the fighting we can see: flashes and tracer at the horizon, all the time. */
  function drawFarBattle(t: number) {
    const n = world.phone ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const slot = Math.floor(t * 0.7 + i * 0.37);
      const k = posmod(t * 0.7 + i * 0.37, 1);
      const x = GW * hash(slot, i, 5);
      const y = HY + (2 + hash(slot, i, 6) * 14) * u;
      if (hash(slot, i, 7) < 0.5) E.glow(x, y, (20 + hash(slot, i, 8) * 30) * u, '#ffb070', (1 - k) * 0.5);
      else {
        const col = hash(slot, i, 9) < 0.5 ? BOLT.ga : BOLT.cf;
        ctx.strokeStyle = hexA(col, (1 - k) * 0.7);
        ctx.lineWidth = 1 * u;
        ctx.beginPath();
        ctx.moveTo(x + k * 40 * u, y - k * 4 * u);
        ctx.lineTo(x + k * 40 * u + 8 * u, y - k * 4 * u - 1 * u);
        ctx.stroke();
      }
    }
  }

  // ---- weather ------------------------------------------------------------------------------------------
  function drawFogBands(t: number) {
    if (world.fog <= 0.05) return;
    const col = mix(L.haze, '#c8d0d0', 0.15);
    for (let i = 0; i < 9; i++) {
      const d = 0.15 + (i / 9) * 0.7;
      const y = py(d) - 8 * u * mOf(d);
      const w = GW * 0.6;
      const x = posmod(hash(i, 3) * GW + t * (6 + i) * u, GW + w) - w / 2;
      ctx.globalAlpha = world.fog * 0.28 * (0.5 + d * 0.5);
      ctx.drawImage(E.soft(col), x - w / 2, y - 30 * u * mOf(d), w, 60 * u * mOf(d) + 10 * u);
    }
    ctx.globalAlpha = 1;
  }
  function drawRain(t: number) {
    const k = world.rain;
    if (k <= 0.02) return;
    const n = Math.round(260 * k * (world.phone ? 0.5 : 1));
    const slant = 0.25 + world.wind * 0.01;
    ctx.strokeStyle = hexA(mix(L.low, '#ffffff', 0.4), 0.22 + 0.1 * k);
    ctx.lineWidth = Math.max(0.8, 1 * u);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 0.8 + hash(i, 1) * 0.5;
      const x = posmod(hash(i, 2) * GW + t * 120 * slant * sp, GW + 40) - 20;
      const y = posmod(hash(i, 3) * GH + t * 900 * u * sp, GH + 60) - 30;
      const len = (14 + hash(i, 4) * 12) * u * sp;
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant * len, y + len);
    }
    ctx.stroke();
  }
  function drawDust(t: number) {
    const k = world.dust;
    if (k <= 0.05) return;
    const col = mix(L.ground2, L.haze, 0.4);
    ctx.fillStyle = hexA(col, 0.35 * k);
    ctx.fillRect(0, 0, GW, GH);
    for (let i = 0; i < 24; i++) {
      const y = HY + hash(i, 1) * (GH - HY) * 0.9;
      const w = (200 + hash(i, 2) * 400) * u;
      const x = posmod(hash(i, 3) * GW + t * (80 + hash(i, 4) * 60) * u * Math.sign(world.wind || 1), GW + w) - w / 2;
      ctx.globalAlpha = 0.25 * k;
      ctx.drawImage(E.soft(col), x - w / 2, y - 20 * u, w, 40 * u);
    }
    ctx.globalAlpha = 1;
  }
  function drawLightning() {
    const k = world.lightning;
    if (k <= 0.02) return;
    const seed = Math.floor(world.t * 0.5);
    const x0 = GW * (0.15 + hash(seed, 1) * 0.7);
    ctx.strokeStyle = hexA('#e8f0ff', k);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    let x = x0;
    let y = 0;
    ctx.moveTo(x, y);
    for (let i = 0; i < 12; i++) {
      x += (hash(seed, i + 3) - 0.5) * 60 * u;
      y += HY / 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = hexA('#d8e4ff', 0.25 * k);
    ctx.fillRect(0, 0, GW, GH);
  }

  // ---- the command post on the ridge: we stand with them -------------------------------------------------
  const postX = GW * (ridgeSide > 0 ? 0.9 : 0.1);
  const toField: 1 | -1 = ridgeSide > 0 ? -1 : 1;
  function drawPost(t: number) {
    const h = 108 * u;
    const at = (dx: number) => postX + dx * toField;
    const ground = (x: number) => ridgeTop(world, x, ridgeSide, seedN + 7) + 3 * u;
    // The officer with the field glasses, the kneeling trooper, the signaller with his aerial.
    const fig = (dx: number, kind: string, crouch: number, hh: number) => {
      const x = at(dx);
      drawTrooper(E, x, ground(x), hh, toField, 0, { ph: 0, moving: 0, crouch, fall: 0, dead: false, firing: 0, seed: 1 }, { legion, kind });
    };
    // Against the battle's light they are dark shapes with a rim of it.
    ctx.save();
    const tone = E.tone;
    E.tone = (c, d, lift = 0) => mix(tone(c, d, lift * 0.5), L.ink, 0.5 - L.night * 0.2);
    fig(-60 * u, 'trooper', 1, h * 0.92);
    fig(0, 'officer', 0, h);
    const sx = at(48 * u);
    fig(48 * u, 'heavy', 0, h * 0.96);
    E.tone = tone;
    ctx.restore();
    ctx.strokeStyle = E.tone('#202022', 0);
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.moveTo(sx - toField * 20 * u, ground(sx) - h * 0.75);
    ctx.lineTo(sx - toField * 30 * u, ground(sx) - h * 1.25);
    ctx.stroke();
    // The glasses at the officer's visor.
    const ox = at(0);
    ctx.fillStyle = E.tone('#18181a', 0);
    ctx.fillRect(ox + toField * h * 0.1 - (toField < 0 ? h * 0.12 : 0), ground(ox) - h * 0.86, h * 0.12, h * 0.05);
    // A field holo-projector at their feet, flickering blue.
    const hx = at(-30 * u);
    const hy = ground(hx);
    ctx.fillStyle = E.tone('#2a2c30', 0);
    ctx.fillRect(hx - 9 * u, hy - 6 * u, 18 * u, 6 * u);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.75 + 0.25 * Math.sin(t * 17) * Math.sin(t * 5);
    const cone = ctx.createLinearGradient(0, hy - 50 * u, 0, hy - 6 * u);
    cone.addColorStop(0, hexA('#7fd6ff', 0.05 * fl));
    cone.addColorStop(1, hexA('#7fd6ff', 0.3 * fl));
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(hx - 3 * u, hy - 6 * u);
    ctx.lineTo(hx - 22 * u, hy - 50 * u);
    ctx.lineTo(hx + 22 * u, hy - 50 * u);
    ctx.lineTo(hx + 3 * u, hy - 6 * u);
    ctx.fill();
    ctx.strokeStyle = hexA('#9ae0ff', 0.6 * fl);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(hx, hy - 50 * u, 22 * u, 5 * u, 0, 0, Math.PI * 2);
    ctx.stroke();
    E.glow(hx, hy - 30 * u, 40 * u, '#7fd6ff', 0.35 * fl);
    ctx.restore();
  }

  // ---- the frame ------------------------------------------------------------------------------------------
  function bake() {
    const r = host.fork('saber-bake');
    baked = { sky: bakeSky(world, E, r), back: bakeBackdrop(world, E, r), ground: bakeGround(world, E, seedN), ridge: bakeRidge(world, E, ridgeSide, seedN + 7), walls: world.style === 'hangar' ? bakeHangarWalls(world, E) : null };
  }
  function paint(t: number) {
    E.t = t;
    if (!baked) bake();
    const B = baked!;
    lamps.length = 0;
    blades.length = 0;
    ctx.save();
    ctx.fillStyle = L.top;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(B.sky, 0, 0);
    for (const hk of world.hulks) drawHulk(hk);
    for (const c of world.capitals) drawCapital(c);
    if (world.jump) {
      const a = world.t - world.jump.t0;
      if (a < 2) {
        const k = a / 2;
        ctx.strokeStyle = hexA('#e8f0ff', 1 - k);
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.moveTo(world.jump.x - (1 - k) * 900 * u, world.jump.y);
        ctx.lineTo(world.jump.x, world.jump.y);
        ctx.stroke();
        E.glow(world.jump.x, world.jump.y, 200 * u * world.jump.s, '#c8e0ff', (1 - k) * 0.8);
      }
    }
    drawSky(t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawSkyBolts(t);
    for (const l of lamps) E.glow(l.x, l.y, l.r, l.color, l.a);
    ctx.restore();
    lamps.length = 0;
    ctx.drawImage(B.back, 0, 0);
    for (const hk of world.hulks) drawHulkSmoke(hk);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawFarBattle(t);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(B.ground.canvas, 0, B.ground.top, GW, GH - B.ground.top);
    // Scorched ground: old fires, craters, the worn earth of the front.
    for (const s of world.scorches) {
      const age = world.t - s.t0;
      const m = mOf(s.d);
      const a = (0.1 + 0.16 * clamp01(1 - age / 300)) * (1 - E.hazeOf(s.d) * 0.6);
      const sx0 = px(s.x, s.d);
      const sy0 = py(s.d, 0, s.x);
      const rx = s.r * m * 1.2;
      ctx.globalAlpha = a * 2.2;
      ctx.drawImage(E.soft(mix(L.ink, '#1a1410', 0.4)), sx0 - rx, sy0 - rx * 0.24, rx * 2, rx * 0.48);
      ctx.globalAlpha = 1;
      if (age < 60) E.pool(px(s.x, s.d), py(s.d), s.r * m * 0.9, '#ff7a30', 0.2 * (1 - age / 60) * (0.3 + L.night));
    }
    if (B.walls) ctx.drawImage(B.walls, 0, 0);
    // Everything on the field, far to near.
    type Item = { d: number; draw: () => void };
    const list: Item[] = [];
    for (const c of world.terrain.cover) list.push({ d: c.d, draw: () => drawCover(E, c, px(c.x, c.d), py(c.d, 0, c.x), mOf(c.d) * u * 1.2, world.gaDir, legion, lamps) });
    for (const fc of world.terrain.facilities) list.push({ d: fc.d + 0.004, draw: () => drawFacility(E, fc, px(fc.x, fc.d), py(fc.d, 0, fc.x), mOf(fc.d) * MACH * 0.75, fc.side === 'ga' ? world.gaDir : (-world.gaDir as 1 | -1), legion, t, lamps) });
    for (const v of world.vehicles) list.push({ d: v.d - 0.001, draw: () => drawVehicleAt(v) });
    for (const sd of world.standards) list.push({ d: sd.d, draw: () => drawStandard(sd) });
    for (const wk of world.wrecks) list.push({ d: wk.d + 0.001, draw: () => drawWreckAt(wk) });
    for (const s of world.soldiers) list.push({ d: s.d, draw: () => drawSoldier(s) });
    for (const k of world.knights) list.push({ d: k.d, draw: () => drawKnightAt(k) });
    for (const w of world.walkers) list.push({ d: w.d, draw: () => drawWalkerAt(w) });
    for (const ro of world.rollers) {
      list.push({
        d: ro.d,
        draw: () => {
          const m = mOf(ro.d);
          const x = px(ro.x, ro.d);
          const y = py(ro.d);
          const s = FIG * m * 0.95;
          drawRoller(E, x, y, s, world.gaDir > 0 ? -1 : 1, ro.d, { state: ro.state, k: (world.t - ro.t0) / 1.2, spin: ro.spin, shield: ro.shield });
          if (ro.state === 'shield') drawBubble(E, x, y, s, Math.min(1, ro.shield));
          if (world.t - ro.fireT < 0.1) lamps.push({ x: x + (world.gaDir > 0 ? -1 : 1) * s * 0.5, y: y - s * 0.6, r: s * 0.5, color: BOLT.cf, a: 0.9 });
        },
      });
    }
    for (const c of world.crafts) list.push({ d: c.d - 0.002, draw: () => drawCraftAt(c) });
    for (const f of world.fx) list.push({ d: f.d - 0.003, draw: () => drawFx(f) });
    const sh = world.shield;
    if (sh) {
      list.push({ d: sh.gd, draw: () => drawGenerator(E, px(sh.gx, sh.gd), py(sh.gd), MACH * mOf(sh.gd) * 1.2, sh.gd, sh.up) });
      list.push({
        d: sh.d - 0.2,
        draw: () => {
          const x = px(sh.x, sh.d);
          const rx = px(sh.x + sh.r, sh.d) - x;
          drawDome(E, x, py(sh.d), rx, sh.r * mOf(sh.d) * 0.85, sh.up, sh.flick, '#7ab8ff');
        },
      });
    }
    list.sort((a, b) => b.d - a.d);
    for (const it of list) it.draw();
    drawFogBands(t);
    // The light of the battle: bolts, shells, fire, engines, blades, flares.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of world.bolts) drawBolt(b, t);
    for (const m of world.missiles) drawMissile(m, t);
    for (const b of world.beams) {
      const k = (t - b.t0) / b.dur;
      if (k < 0 || k > 1) continue;
      const a = Math.sin(k * Math.PI);
      ctx.lineCap = 'round';
      ctx.strokeStyle = hexA(b.color, 0.45 * a);
      ctx.lineWidth = b.w * 3 * u;
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.x1, b.y1);
      ctx.stroke();
      ctx.strokeStyle = hexA('#ffe0d0', 0.9 * a);
      ctx.lineWidth = b.w * 0.8 * u;
      ctx.stroke();
      ctx.lineCap = 'butt';
      E.glow(b.x0, b.y0, 40 * u, b.color, a);
      E.glow(b.x1, b.y1, 60 * u, b.color, a * 0.8);
    }
    for (const s of world.shells) drawShell(s, t);
    for (const f of world.fx) drawFxLight(f);
    for (const l of lamps) E.glow(l.x, l.y, l.r, l.color, l.a);
    for (const b of blades) {
      const [x0, y0, x1, y1] = b.seg;
      ctx.lineCap = 'round';
      ctx.strokeStyle = hexA(b.color, 0.5);
      ctx.lineWidth = b.w * 3.2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = hexA(b.color, 0.9);
      ctx.lineWidth = b.w * 1.4;
      ctx.stroke();
      E.glow((x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) * 0.9, b.color, 0.35);
      ctx.lineCap = 'butt';
    }
    for (const fl of world.flares) {
      const age = world.t - fl.t0;
      const k = clamp01(age / 1.5) * clamp01((fl.dur - age) / 4);
      const flick = 0.85 + 0.15 * Math.sin(E.t * 23 + fl.t0);
      const x = px(fl.x, fl.d);
      const y = py(fl.d, fl.alt);
      E.glow(x, y, 40 * u, '#fff4d0', k * flick);
      E.glow(x, y, 380 * u * mOf(fl.d), '#fff0c0', 0.22 * k * flick * L.night);
      E.pool(x, py(fl.d), 700 * u * mOf(fl.d), '#fff0c8', 0.25 * k * flick * L.night);
    }
    ctx.restore();
    drawRain(t);
    drawDust(t);
    drawLightning();
    ctx.drawImage(B.ridge, 0, 0);
    drawPost(t);
    ctx.restore();
    grade(t);
    words();
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
      const step = Math.floor(t * 12);
      ctx.translate((step * 37) % 128, (step * 53) % 128);
      ctx.fillStyle = pat;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.38, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, hexA(L.ink, 0));
    vg.addColorStop(1, hexA(L.ink, 0.5 + L.night * 0.15));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- words: the radio as subtitles, the biggest moments as a title, the holo readout ----------------------
  /** Lines of text wrapped to a width, at most `max` lines. */
  function wrap(text: string, width: number, max: number): string[] {
    const words = text.split(' ');
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width > width && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    if (out.length > max) {
      const keep = out.slice(0, max);
      keep[max - 1] = fitText(ctx, `${keep[max - 1]} ${out.slice(max).join(' ')}`, width);
      return keep;
    }
    return out;
  }
  /** A soft dark band behind text, so it reads over any sky and any hour. */
  function band(x: number, y: number, w: number, h: number, a: number) {
    const g = ctx.createLinearGradient(x - w / 2 - 40, 0, x + w / 2 + 40, 0);
    g.addColorStop(0, 'rgba(6,8,12,0)');
    g.addColorStop(0.18, `rgba(6,8,12,${(0.62 * a).toFixed(3)})`);
    g.addColorStop(0.82, `rgba(6,8,12,${(0.62 * a).toFixed(3)})`);
    g.addColorStop(1, 'rgba(6,8,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2 - 40, y, w + 80, h);
  }
  function words() {
    const small = W < 600;
    ctx.textBaseline = 'alphabetic';
    // The title: the biggest moment now, wide-spaced caps across the top of the sky.
    if (o.labels) {
      const l = world.labels[world.labels.length - 1];
      if (l) {
        const age = world.t - l.t0;
        const a = clamp01(Math.min(age * 2.5, (5 - age) / 1)) ;
        if (a > 0) {
          const px2 = small ? 15 : 22;
          ctx.font = SANS(px2, 600);
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${small ? 2 : 4}px`;
          const lines = wrap(l.text, W - 48, 2);
          const y0 = small ? 92 : 74;
          const lh = px2 + 8;
          const wmax = Math.max(...lines.map((s) => ctx.measureText(s).width));
          band(W / 2, y0 - px2 - 6, wmax, lines.length * lh + 10, a);
          ctx.textAlign = 'center';
          ctx.fillStyle = hexA(mix(l.color, '#ffffff', 0.55), a);
          lines.forEach((s, i) => fillCrisp(ctx, s, W / 2, y0 + i * lh));
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
        }
      }
      // The radio, as a film's subtitles: one line at a time, low in the frame, the speaker named.
      const rl = world.radio[world.radio.length - 1];
      if (rl) {
        const age = world.t - rl.t0;
        const a = clamp01(Math.min(age * 5, (3.8 - age) / 0.5));
        if (a > 0) {
          const fs = small ? 15 : 19;
          ctx.font = SANS(fs, 500);
          const lines = wrap(sentence(rl.text), Math.min(W - 40, 720), 2);
          const lh = fs + 7;
          const yb = H - (small ? 22 : 24) - (lines.length - 1) * lh;
          ctx.font = SANS(small ? 10 : 11, 700);
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '2px';
          const who = rl.who;
          ctx.font = SANS(fs, 500);
          const wmax = Math.max(...lines.map((s) => ctx.measureText(s).width));
          band(W / 2, yb - fs - 20, wmax, lines.length * lh + 26, a);
          ctx.textAlign = 'center';
          ctx.font = SANS(small ? 10 : 11, 700);
          ctx.fillStyle = hexA(rl.side === 'ga' ? '#9ad4ff' : '#ffb488', a * 0.95);
          fillCrisp(ctx, fitText(ctx, who, W - 40), W / 2, yb - fs - 3);
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
          ctx.font = SANS(fs, 500);
          ctx.fillStyle = hexA('#fbf8f0', a);
          lines.forEach((s, i) => fillCrisp(ctx, s, W / 2, yb + i * lh));
        }
      }
    }
    if (o.hud) readout();
    ctx.textAlign = 'left';
  }
  /** The holo readout: the battle's name, the engagement and its phase, and the line between the armies. */
  function readout() {
    const small = W < 600;
    const x = 16;
    const y = 16;
    const w = Math.min(small ? 220 : 270, W - 32);
    const h = 52;
    const holoC = '#8fd8ff';
    const level = 0.6 + 0.4 * host.intensity;
    ctx.fillStyle = 'rgba(4,10,18,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hexA(holoC, 0.35 * level);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // Scanlines, the projector's flicker.
    ctx.fillStyle = hexA(holoC, 0.04);
    for (let yy = y + 2; yy < y + h; yy += 3) ctx.fillRect(x + 1, yy, w - 2, 1);
    ctx.textAlign = 'left';
    ctx.font = SANS(small ? 10 : 11, 700);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '1.5px';
    ctx.fillStyle = hexA('#e8f6ff', 0.95 * level);
    fillCrisp(ctx, fitText(ctx, world.place.replace(/^THE /, ''), w - 16), x + 8, y + 15);
    const a = world.act;
    const phase = a.phase === 'buildup' ? (a.attacker === 'ga' ? 'MASSING TO ATTACK' : 'DROIDS MASSING') : a.phase === 'clash' ? 'THE LINES ENGAGED' : a.phase === 'climax' ? 'THE DECISIVE HOUR' : 'THE AFTERMATH';
    ctx.font = SANS(small ? 9 : 10, 600);
    ctx.fillStyle = hexA(holoC, 0.85 * level);
    fillCrisp(ctx, fitText(ctx, `${a.title} · ${phase}`, w - 16), x + 8, y + 29);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
    // The tug of war: where the front stands between the two armies.
    const bx = x + 8;
    const bw = w - 16;
    const by = y + 38;
    const k = clamp01(world.xOf(world.front, 0.25) / GW);
    const gaK = world.gaDir > 0 ? k : 1 - k;
    ctx.fillStyle = hexA('#4aa8ff', 0.75 * level);
    ctx.fillRect(bx, by, bw * gaK, 5);
    ctx.fillStyle = hexA('#ff7a4a', 0.75 * level);
    ctx.fillRect(bx + bw * gaK, by, bw * (1 - gaK), 5);
    ctx.fillStyle = hexA('#ffffff', 0.95);
    ctx.fillRect(bx + bw * gaK - 1, by - 2, 2, 9);
    ctx.font = MONO(9);
    ctx.fillStyle = hexA('#bfe6ff', 0.8 * level);
    const ga = world.soldiers.filter((s) => s.side === 'ga' && s.state !== 'dead' && s.state !== 'fall').length;
    const cf = world.soldiers.filter((s) => s.side === 'cf' && s.state !== 'dead' && s.state !== 'fall').length;
    void ga;
    void cf;
  }

  // ---- the map, or the scene ------------------------------------------------------------------------------
  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => (holo ? holo.project(x, y) : [SX(x), SY(y)]),
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => (holo ? holo.unproject(x, y) : [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y]),
    after: (dt) => {
      framing.update(dt, world.t, world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => (holo ? holo.paint(t, W, H) : paint(t)),
    ambience: () => (world.act.phase === 'climax' ? 0.95 : world.act.phase === 'aftermath' ? 0.35 : 0.7),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}

void ridgeTop;
void vnoise;
