/**
 * War Rig, painted: the chase side-on, like a frame from the film, with the ground running away
 * under it.
 *
 * Back to front: the sky (the sun or the moon, stars, dust); the horizon's mesas and their mirage;
 * the buttes and towers; the canyon wall when we are in the canyon; the dunes; the ground plane
 * (./land); then everything on or over the ground sorted by depth: props, wrecks, the pursuers and
 * the rig (each with its shadow and its dust), what flies (lances, bombs, bodies, wheels), smoke
 * and fire. Then the light pass, added: exhaust flames, headlights by night, muzzle flashes,
 * tracers, fireballs, the guitar's flame, lightning. The storm over it all; the grade; the
 * call-outs, the name tags with their shouted lines, and the HUD with its chronicle.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, typed } from '../../instruments/kit';
import { clamp01, createEnv, goldenOf, hash, heatOf, hexA, mix, posmod } from './env';
import { createLand, dustOf } from './land';
import { createMap } from './map';
import { createWarRig, KINDS, RIG } from './sim';
import type { Fx, Kind, Vehicle, WarWorld } from './types';
import { drawMachine, figure, HEIGHT, mats, POINTS, wheel, type Look } from './vehicles';

export type WarPaintOptions = { view: string; traffic: number; camera: string; labels: boolean; hud: boolean };

const FONT = (px: number, weight = 600) => `${weight} ${px}px "Oswald", "Bebas Neue", "Arial Narrow", "Roboto Condensed", Impact, sans-serif`;
const TYPE = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;

export function mountWarRig(host: SkinHost, o: WarPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: WarWorld = createWarRig(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera });
  const { GW, GH, u, HY } = world;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.3, closer: 1.8, maxZoom: 2.6 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const E = createEnv(ctx, u, world.grade);
  const lr = host.fork('rig-look');
  const tseed = Math.floor(lr() * 1e6);
  const land = createLand(E, world, tseed);
  const mapView = o.view === 'map';
  const map = createMap(E, world, land, tseed);
  /** The map's own camera: the director's shots moved into the map's frame. */
  const mapDirector = {
    get shot() {
      const s = world.director.shot;
      const z = (s.y - world.HY - world.A) / world.DB;
      return { ...s, x: map.mx(s.x, Math.max(-0.5, Math.min(1.5, z))), y: map.my(Math.max(-0.5, Math.min(1.5, z))) };
    },
  } as unknown as typeof world.director;
  let grain: HTMLCanvasElement | null = null;
  const U = u * world.VS;

  const dOf = (z: number) => clamp01(Math.pow(clamp01(1 - world.mOf(z)), 1.3) * 0.75);
  const yAt = (z: number, alt = 0) => world.yOf(z) - alt * world.mOf(z);

  // ---- the machines ---------------------------------------------------------------------------------
  const beatOf = (t: number) => Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 2.1)), 6);
  function lookOf(v: Vehicle, t: number): Look {
    return {
      kind: v.kind, clan: v.clan, seed: v.seed, t, boost: v.boost, pole: v.pole, boarder: v.boarder,
      beat: v.kind === 'howler' ? beatOf(t) : 0, burnt: false, crew: true,
      bob: Math.sin(t * 6.3 + v.seed) * 0.9 + Math.sin(t * 13.1 + v.seed * 2) * 0.45,
    };
  }
  /** A shadow on the ground toward us, away from the light; a pool under anything in the air. */
  function shadow(x: number, z: number, alt: number, L: number, Hh: number) {
    const s = world.sOf(z);
    const y = world.yOf(z);
    const a = 0.42 * (1 - E.night * 0.45) * (1 - E.storm * 0.5) * clamp01(1 - alt / (300 * U));
    if (a < 0.02) return;
    const away = E.keyX > x ? -1 : 1;
    const low = 0.5 + goldenOf(world.day) * 0.6;
    const len = Hh * s * 0.22 * low;
    const w = (L / 2) * s * (1 - clamp01(alt / (400 * U)) * 0.4);
    ctx.fillStyle = hexA(E.tone('#0e2228', 0.1, 0), a);
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.92 + away * len * 1.4, y + len * 0.5 + 2 * u);
    ctx.lineTo(x - w * 0.92 + away * len * 1.4, y + len * 0.5 + 2 * u);
    ctx.closePath();
    ctx.fill();
  }
  /** Dust off the wheels: a stream of puffs left behind on the road at its speed, rising and spreading. */
  function plume(x: number, z: number, wheelsX: number[], size: number, seed: number, strength = 1) {
    const m = world.mOf(z);
    const y = world.yOf(z);
    const speed = world.V * m;
    const bog = world.region === 'bog';
    const col = E.tone(dustOf(world.region), dOf(z) * 0.6, 0.45);
    const colLit = E.tone(dustOf(world.region), dOf(z) * 0.6, 0.95);
    const spr = E.soft(col);
    const sprL = E.soft(colLit);
    const N = 9;
    const life = bog ? 0.8 : 1.7;
    const k0 = (1 - E.storm * 0.4) * strength;
    for (const [wi, wx] of wheelsX.entries()) {
      for (let k = 0; k < N; k++) {
        const a = posmod(E.t / life + k / N + hash(seed, wi, 3) * 0.3, 1);
        const age = a * life;
        const px = x + wx - speed * age * 0.9 + Math.sin(E.t * 2 + k + seed) * 3 * u * m;
        const r = (10 + age * 64) * u * m * size * (bog ? 0.5 : 1);
        const py = y - (3 + age * 22) * u * m * size - r * 0.25;
        const al = 0.46 * Math.pow(1 - a, 1.3) * Math.min(1, a * 10) * k0;
        ctx.globalAlpha = al;
        ctx.drawImage(spr, px - r, py - r * 0.7, r * 2, r * 1.4);
        ctx.globalAlpha = al * 0.5 * E.L.rim * (1 - E.night * 0.6);
        ctx.drawImage(sprL, px - r * 0.8 + (E.keyX > px ? r * 0.25 : -r * 0.25), py - r * 0.75, r * 1.6, r * 1.1);
      }
    }
    ctx.globalAlpha = 1;
  }
  /**
   * The cloud the whole war party raises: a bank of dust behind and above the pack, rolling back
   * along the road, lit on its crown by the low sun and dark in its belly.
   */
  function dustBank() {
    const pack = world.vehicles.filter((v) => v.alt < 5 && v.x > -200 * u && v.x < GW + 200 * u && v.state !== 'stuck');
    const strength = clamp01(pack.length / 6) * (world.region === 'bog' ? 0.25 : 1) * (1 - E.storm * 0.5);
    if (strength < 0.03) return;
    const rig = world.rig;
    const front = Math.max(rig.x, ...pack.map((v) => v.x));
    const col = E.tone(dustOf(world.region), 0.45, 0.35);
    const belly = E.tone(mix(dustOf(world.region), '#4a3020', 0.45), 0.4, 0.05);
    const crown = E.tone(dustOf(world.region), 0.3, 1);
    const spr = E.soft(col);
    const sprB = E.soft(belly);
    const sprC = E.soft(crown);
    const base = world.yOf(0.2);
    const N = 34;
    const life = 7;
    for (let k = 0; k < N; k++) {
      const a = posmod(E.t / life + k / N, 1);
      const m = world.mOf(0.15);
      const x = front - 80 * u - world.V * m * a * life * 0.55 + Math.sin(k * 1.7) * 60 * u;
      const r = (90 + a * 260 + hash(k, 3, tseed) * 80) * u;
      const y = base - r * 0.35 - a * 120 * u;
      const al = strength * 0.42 * Math.pow(1 - a, 0.8) * Math.min(1, a * 6);
      ctx.globalAlpha = al;
      ctx.drawImage(sprB, x - r, y - r * 0.55, r * 2, r * 1.2);
      ctx.globalAlpha = al * 0.85;
      ctx.drawImage(spr, x - r * 0.9, y - r * 0.75, r * 1.8, r * 1.1);
      ctx.globalAlpha = al * 0.55 * E.L.rim * (1 - E.night * 0.7);
      ctx.drawImage(sprC, x - r * 0.7 + (E.keyX > x ? r * 0.2 : -r * 0.2), y - r * 0.85, r * 1.4, r * 0.8);
    }
    ctx.globalAlpha = 1;
  }
  function drawVehicle(v: Vehicle) {
    const K = KINDS[v.kind];
    const s = world.sOf(v.z);
    const air = v.state === 'crash' || v.state === 'flung' || v.state === 'jump' || v.state === 'rim';
    if (v.state !== 'rim') shadow(v.x, v.z, v.alt, K.L, HEIGHT[v.kind]);
    const y = yAt(v.z, v.alt);
    const M = mats(E, dOf(v.z), v.clan, v.seed, v.x);
    const lk = lookOf(v, E.t);
    if (v.state === 'stuck') {
      lk.boost = 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(v.x - K.L * s, y - 200 * s, K.L * 2 * s, 200 * s + 1);
      ctx.clip();
      drawMachine(E, M, lk, v.x, y + v.sink * HEIGHT[v.kind] * 0.8 * s, s, Math.sin(E.t * 2 + v.seed) * 0.04 + v.sink * 0.1);
      ctx.restore();
      ctx.fillStyle = hexA(E.tone('#2a2a20', dOf(v.z), 0.2), 0.8);
      ctx.beginPath();
      ctx.ellipse(v.x, y, (K.L / 2 + 8) * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    drawMachine(E, M, lk, v.x, y, s, v.rot);
    if (!air && v.x > -100 * u && v.x < GW + 100 * u) {
      const ws = POINTS[v.kind].wheels;
      const xs = [ws[0][0] * s];
      if (ws.length > 2 || v.kind === 'bike' || v.kind === 'buggy') xs.push(ws[ws.length - 1][0] * s);
      plume(v.x, v.z, xs, K.L > 120 ? 1.4 : K.L < 50 ? 0.7 : 1, v.seed, 0.9 + v.boost * 0.4);
    }
  }
  function drawRig() {
    const rig = world.rig;
    const s = world.sOf(rig.z);
    const shake = Math.sin(E.t * 47) * rig.knock * 2.5 * u;
    const x = rig.x + shake;
    shadow(x, rig.z, 0, RIG.L, 110);
    const M = mats(E, dOf(rig.z), 'rig', 7, x);
    const lk: Look = { kind: 'rig', clan: 'rig', seed: 7, t: E.t, boost: 0.5 + 0.5 * Math.sin(E.t * 0.7), pole: 0, boarder: false, beat: 0, burnt: false, crew: true, bob: Math.sin(E.t * 4.1) * 0.8 + Math.sin(E.t * 9.3) * 0.4 + rig.knock * 2, rig: { variant: rig.variant, cargo: rig.cargo, name: rig.name, marks: rig.marks, kills: rig.kills, flip: world.flip } };
    const y = world.yOf(rig.z);
    drawMachine(E, M, lk, x, y, s, rig.knock * 0.012 * Math.sin(E.t * 30));
    // The crew on the tank, and any boarders fighting them.
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    for (const c of rig.crew) {
      if (c.role === 'driver') continue;
      const thrown = c.role === 'lancer' && c.t0 - E.t > 4;
      const pose = c.role === 'gunner' ? 'gun' : c.role === 'lancer' ? (thrown ? 'throw' : 'stand') : 'stand';
      figure(E, M, c.at, -c.up + 2 + lk.bob, 22, pose, E.t * 1.3 + c.seed, { dir: c.aim < 0 ? -1 : 1, lance: c.role === 'lancer', mask: true, aim: 0.3 });
      if (c.role === 'gunner' && c.at > -100) {
        // The mounted gun over the shield.
        ctx.strokeStyle = M.steelD;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(c.at - 6 * (c.aim || 1), -c.up - 14 + lk.bob);
        ctx.lineTo(c.at + 16 * (c.aim || 1), -c.up - 17 + lk.bob);
        ctx.stroke();
      }
    }
    for (const b of rig.boarders) figure(E, mats(E, dOf(0.5), 'party', b.seed, x), b.at / s, -98 + lk.bob, 22, 'fight', E.t * 3 + b.seed, { paint: true, dir: -1 });
    ctx.restore();
    // Smoke from the stacks, black and thick, left behind.
    const m = world.mOf(rig.z);
    const spr = E.soft(E.tone('#2a2420', dOf(rig.z) * 0.6, 0.05));
    for (const [px, py] of [[57, -126], [51, -126]]) {
      for (let k = 0; k < 8; k++) {
        const a = posmod(E.t / 1.6 + k / 8 + px * 0.01, 1);
        const sx = x + px * s - world.V * m * a * 1.6 * 0.8;
        const sy = y + (py + lk.bob) * s - a * 60 * u * m;
        const r = (6 + a * 40) * u * m;
        ctx.globalAlpha = 0.45 * Math.pow(1 - a, 1.2);
        ctx.drawImage(spr, sx - r, sy - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
    plume(x, rig.z, [-130 * s, -96 * s, 64 * s, 132 * s], 1.5, 7, 1.1);
    // The leak: a jet out of the tank and down onto the road behind.
    if (rig.leak > 0) {
      const lx = x + rig.leakAt * s;
      const ly = y - 60 * s;
      const col = rig.cargo === 'fuel' ? E.tone('#1a120c', 0.2, 0.3) : E.tone('#9ad8f0', 0.2, 0.8);
      ctx.strokeStyle = hexA(col, 0.85 * rig.leak);
      ctx.lineWidth = 3 * s * rig.leak;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.quadraticCurveTo(lx - 30 * s, ly - 6 * s + Math.sin(E.t * 20) * 2 * s, lx - 70 * s, y);
      ctx.stroke();
      ctx.fillStyle = hexA(col, 0.5 * rig.leak);
      ctx.beginPath();
      ctx.ellipse(lx - 120 * s, y + 3 * s, 60 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawWreck(wk: WarWorld['wrecks'][number]) {
    const s = world.sOf(wk.z);
    const M = mats(E, dOf(wk.z), wk.clan, wk.seed, wk.x, true);
    const lk: Look = { kind: wk.kind, clan: wk.clan, seed: wk.seed, t: 0, boost: 0, pole: 0.9, boarder: false, beat: 0, burnt: true, crew: false, bob: 0 };
    const y = world.yOf(wk.z);
    ctx.fillStyle = hexA(E.tone('#140c08', dOf(wk.z)), 0.5);
    ctx.beginPath();
    ctx.ellipse(wk.x, y + 1, (KINDS[wk.kind].L / 2 + 10) * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    drawMachine(E, M, lk, wk.x, y + (wk.rot !== 0 ? 6 * s : 0), s, wk.rot);
  }

  // ---- what flies, and the fx --------------------------------------------------------------------------
  function drawFx(f: Fx) {
    const age = E.t - f.t0;
    if (age < 0) return;
    const k = clamp01(age / f.dur);
    const m = world.mOf(f.z);
    const x = f.x;
    const y = yAt(f.z, f.alt);
    const d = dOf(f.z);
    switch (f.kind) {
      case 'smoke': {
        const r = f.r * (1 + k * 2.4) * (0.6 + m * 0.6);
        ctx.globalAlpha = 0.55 * Math.pow(1 - k, 1.1) * Math.min(1, age * 4);
        ctx.drawImage(E.soft(E.tone(f.color, d * 0.7, 0.1)), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        break;
      }
      case 'dust': {
        const r = f.r * (1 + k * 1.8) * m;
        ctx.globalAlpha = 0.45 * (1 - k);
        ctx.drawImage(E.soft(E.tone(dustOf(world.region), d, 0.5)), x - r, y - r * 0.7, r * 2, r * 1.4);
        ctx.globalAlpha = 1;
        break;
      }
      case 'boom': {
        // The body of a fireball: dark orange to soot as it climbs.
        const r = f.r * (0.7 + k * 1.3) * (0.6 + m * 0.6);
        const col = k < 0.35 ? mix('#ffd060', '#ff6a1a', k / 0.35) : mix('#c03a10', '#2a1a14', (k - 0.35) / 0.65);
        ctx.globalAlpha = 0.9 * (1 - k * 0.6);
        ctx.drawImage(E.soft(col), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        break;
      }
      case 'debris': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.rot + age * 9);
        ctx.fillStyle = E.tone(f.color, d, 0.3);
        const r = f.r * m * 1.4;
        ctx.fillRect(-r, -r * 0.5, r * 2, r);
        ctx.restore();
        break;
      }
      case 'body': {
        const M = mats(E, d, 'party', f.seed, x);
        figure(E, M, x, y, 20 * U * m * 0.42, 'tumble', f.rot + age * 2, { paint: true });
        break;
      }
      case 'wheel': {
        const M = mats(E, d, 'party', f.seed, x, true);
        wheel(E, M, x, y, f.r * m, age * 14, { spokes: 5 });
        break;
      }
      case 'spray':
      case 'mud': {
        ctx.fillStyle = hexA(E.tone(f.color, d, f.kind === 'spray' ? 0.6 : 0.1), 0.8 * (1 - k));
        ctx.beginPath();
        ctx.ellipse(x, y, f.r * m * 1.4, f.r * m * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
  }
  function fxLight(f: Fx) {
    const age = E.t - f.t0;
    if (age < 0) return;
    const k = clamp01(age / f.dur);
    const m = world.mOf(f.z);
    const x = f.x;
    const y = yAt(f.z, f.alt);
    if (f.kind === 'boom') E.glow(x, y, f.r * (1 + k) * 2.2 * (0.6 + m * 0.6), k < 0.3 ? '#ffd890' : '#ff7a28', 0.75 * (1 - k));
    else if (f.kind === 'flash') E.glow(x, y, f.r * (0.6 + k * 1.2) * (0.5 + m * 0.7), '#fff0c0', 0.95 * (1 - k));
    else if (f.kind === 'fire') E.glow(x, y, f.r * 2.6 * (0.6 + m * 0.5), '#ff8a30', 0.7 * (1 - k));
    else if (f.kind === 'spark') {
      ctx.strokeStyle = hexA(f.color, 1 - k);
      ctx.lineWidth = Math.max(0.8, 1.4 * u * m);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - f.vx * 0.03, y + f.valt * 0.03 * m);
      ctx.stroke();
    }
  }
  function drawMissile(ms: WarWorld['missiles'][number]) {
    const m = world.mOf(ms.z);
    const x = ms.x;
    const y = yAt(ms.z, ms.alt);
    const s = world.sOf(ms.z);
    const ang = Math.atan2(-ms.valt * m, ms.vx + 1e-6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (ms.kind === 'lance') {
      ctx.strokeStyle = E.tone('#3a2a20', 0.2, 0.3);
      ctx.lineWidth = Math.max(0.8, 1 * s);
      ctx.beginPath();
      ctx.moveTo(-26 * s, 0);
      ctx.lineTo(4 * s, 0);
      ctx.stroke();
      ctx.fillStyle = E.tone('#d8a040', 0.2, 0.5);
      ctx.fillRect(2 * s, -1.6 * s, 6 * s, 3.2 * s);
      ctx.fillStyle = E.tone('#c8ccd0', 0.2, 0.8);
      ctx.beginPath();
      ctx.moveTo(8 * s, -1.6 * s);
      ctx.lineTo(12 * s, 0);
      ctx.lineTo(8 * s, 1.6 * s);
      ctx.fill();
    } else if (ms.kind === 'bomb') {
      ctx.fillStyle = E.tone('#1a1614', 0.2, 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (ms.kind === 'shell') {
      ctx.fillStyle = E.tone('#5a5048', 0.2, 0.5);
      ctx.fillRect(-4 * s, -1.4 * s, 8 * s, 2.8 * s);
    }
    ctx.restore();
  }
  function missileLight(ms: WarWorld['missiles'][number]) {
    const m = world.mOf(ms.z);
    const x = ms.x;
    const y = yAt(ms.z, ms.alt);
    if (ms.kind === 'flare') {
      E.glow(x, y, 160 * u * m, '#ff5a3a', 0.35);
      E.glow(x, y, 26 * u * m, '#ffd0b0', 0.95);
    } else if (ms.kind === 'shell') E.glow(x, y, 20 * u * m, '#ffd080', 0.9);
    else E.glow(x, y, 10 * u * m * (1 + 0.4 * Math.sin(E.t * 40 + ms.seed)), '#ffb050', 0.85);
  }
  function shots() {
    for (const sh of world.shots) {
      const k = (E.t - sh.t0) / sh.dur;
      if (k < 0 || k > 1) continue;
      const p = (q: number): [number, number] => {
        const z = sh.z0 + (sh.z1 - sh.z0) * q;
        return [sh.x0 + (sh.x1 - sh.x0) * q, yAt(z, sh.a0 + (sh.a1 - sh.a0) * q)];
      };
      const [x1, y1] = p(k);
      const [x0, y0] = p(Math.max(0, k - 0.3));
      ctx.strokeStyle = hexA(sh.color, 0.95);
      ctx.lineWidth = Math.max(1, 1.6 * u);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (k < 0.3) {
        const [mx, my] = p(0);
        E.glow(mx, my, 22 * u * world.mOf(sh.z0), '#ffe0a0', 0.9 * (1 - k / 0.3));
      }
    }
  }
  function bolts() {
    for (const b of world.bolts) {
      const k = (E.t - b.t0) / 0.6;
      if (k < 0 || k > 1) continue;
      const gx = b.x;
      const gy = world.yOf(b.z);
      const a = (1 - k) * (0.6 + 0.4 * Math.sin(k * 40));
      const path = (seed: number, x0: number, y0: number, x1: number, y1: number, n: number) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let i = 1; i <= n; i++) {
          const q = i / n;
          ctx.lineTo(x0 + (x1 - x0) * q + (i < n ? (hash(seed, i) - 0.5) * 60 * u : 0), y0 + (y1 - y0) * q);
        }
      };
      ctx.strokeStyle = hexA('#b8a8ff', 0.5 * a);
      ctx.lineWidth = 7 * u;
      path(b.seed, gx + (hash(b.seed, 99) - 0.5) * 200 * u, -10, gx, gy, 12);
      ctx.stroke();
      ctx.strokeStyle = hexA('#ffffff', a);
      ctx.lineWidth = 2 * u;
      ctx.stroke();
      for (let br = 0; br < 3; br++) {
        const q = 0.3 + hash(b.seed, br, 5) * 0.4;
        const sx0 = gx + (hash(b.seed, 99) - 0.5) * 200 * u * (1 - q);
        const sy0 = gy * q;
        ctx.lineWidth = 1.2 * u;
        path(b.seed + br * 7, sx0, sy0, sx0 + (hash(b.seed, br, 6) - 0.5) * 220 * u, sy0 + 80 * u + hash(b.seed, br, 7) * 120 * u, 5);
        ctx.stroke();
      }
      E.glow(gx, gy, 140 * u, '#c8b8ff', a * 0.8);
    }
  }
  /** Exhaust flames, headlights and tail-lights, the guitar's flame: the machines' own light. */
  function machineLight(kind: Kind | 'rig', x: number, z: number, y: number, s: number, boost: number, seed: number, rot: number, extra = 0) {
    const P = POINTS[kind];
    const night = E.night;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const at = (px: number, py: number): [number, number] => [x + (px * cr - py * sr) * s, y + (px * sr + py * cr) * s];
    // Flames from the pipes: on the throttle, and in bursts.
    const burst = hash(Math.floor(E.t * 7), seed) < boost * 0.45 + extra;
    if (burst) {
      for (const [px, py, a] of P.pipes) {
        const [fx, fy] = at(px, py);
        const dx = -Math.cos(a + rot);
        const dy = Math.sin(a + rot);
        const len = (10 + hash(Math.floor(E.t * 20), seed, px) * 14) * s * (kind === 'rig' ? 1.6 : 1);
        for (let k = 0; k < 4; k++) {
          const q = k / 3;
          E.glow(fx + dx * len * q, fy + dy * len * q, (6 - q * 3) * s * (kind === 'rig' ? 1.6 : 1), q < 0.4 ? '#ffe6a0' : '#ff7a20', 0.85 - q * 0.4);
        }
      }
    }
    if (night > 0.05 || E.storm > 0.3) {
      const lit = Math.max(night, E.storm * 0.8);
      for (const [px, py] of P.lamps) {
        const [lx, ly] = at(px, py);
        E.glow(lx, ly, 12 * s, '#fff0c8', 0.9 * lit);
        // The beam ahead along the road.
        const m = world.mOf(z);
        const gy = world.yOf(z);
        const len = 260 * u * m * (kind === 'rig' ? 1.4 : 1);
        const g = ctx.createLinearGradient(lx, 0, lx + len, 0);
        g.addColorStop(0, hexA('#ffe8c0', 0.22 * lit));
        g.addColorStop(1, hexA('#ffe8c0', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(lx, ly - 2 * s);
        ctx.lineTo(lx + len, ly - 18 * s);
        ctx.lineTo(lx + len, gy + 10 * s);
        ctx.lineTo(lx, ly + 2 * s);
        ctx.fill();
      }
      for (const [px, py] of P.tail) {
        const [tx, ty] = at(px, py);
        E.glow(tx, ty, 8 * s, '#ff2a1a', 0.8 * lit);
      }
    }
  }

  // ---- the frame ----------------------------------------------------------------------------------
  function paint(t: number) {
    const [kx, ky, isSun] = land.keyLight();
    E.set(t, world.day, world.storm, kx, ky, isSun);
    ctx.save();
    // A seed whose convoy runs the other way: the whole scene mirrored (the words are not).
    if (world.flip) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    if (mapView) {
      map.paint();
      ctx.restore();
      if (world.flash > 0) {
        ctx.fillStyle = `rgba(220,210,255,${(0.2 * world.flash).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      grade(t);
      words(t);
      return;
    }
    land.sky();
    const heat = heatOf(world.day) * (1 - world.storm);
    land.ground();
    land.horizon(heat);
    land.farPlane();
    land.canyonWall();
    land.dunePlane();
    // Everything on or over the ground, far to near.
    type D = { z: number; draw: () => void; light?: () => void };
    const list: D[] = [];
    for (const p of land.props()) list.push(p);
    list.push({ z: -0.06, draw: dustBank });
    for (const wk of world.wrecks) list.push({ z: wk.z - 0.001, draw: () => drawWreck(wk), light: wk.burn > 0.2 ? () => E.glow(wk.x, yAt(wk.z, 16 * U), 50 * u * world.mOf(wk.z) * wk.burn, '#ff7a28', 0.6 * wk.burn * (0.8 + 0.2 * Math.sin(E.t * 13 + wk.seed))) : undefined });
    for (const v of world.vehicles) {
      if (v.x < -400 * u || v.x > GW + 400 * u) continue;
      const s = world.sOf(v.z);
      const y = yAt(v.z, v.alt);
      const playing = v.kind === 'howler' && E.t - v.playT < 3.2 && posmod(E.t - v.playT, 0.7) < 0.42 ? 1 : 0;
      list.push({
        z: v.z,
        draw: () => drawVehicle(v),
        light: v.state === 'stuck' ? undefined : () => {
          machineLight(v.kind, v.x, v.z, y, s, v.boost, v.seed, v.rot, v.state === 'crash' || v.state === 'flung' ? 0.5 : 0);
          if (v.kind === 'howler') guitarFlame(v.x, y, s, playing);
        },
      });
    }
    const rig = world.rig;
    list.push({ z: rig.z, draw: drawRig, light: () => machineLight('rig', rig.x, rig.z, world.yOf(rig.z) + Math.sin(E.t * 4.1) * 0.8 * world.sOf(rig.z), world.sOf(rig.z), 0.3 + rig.knock, 7, 0) });
    for (const f of world.fx) list.push({ z: f.z + 0.002, draw: () => drawFx(f), light: () => fxLight(f) });
    for (const ms of world.missiles) list.push({ z: ms.z + 0.003, draw: () => drawMissile(ms), light: () => missileLight(ms) });
    list.sort((a, b) => a.z - b.z);
    const lights: (() => void)[] = [];
    for (const it of list) {
      it.draw();
      if (it.light) lights.push(it.light);
    }
    land.mist();
    // Heat on the road ahead: the air wavers over the salt.
    if (heat > 0.1) {
      ctx.strokeStyle = hexA(E.L.low, 0.08 * heat);
      ctx.lineWidth = 2 * u;
      for (let k = 0; k < 6; k++) {
        const yy = HY + 4 * u + k * 5 * u;
        ctx.beginPath();
        for (let x = 0; x <= GW; x += 16) ctx.lineTo(x, yy + Math.sin(x * 0.03 + E.t * 4 + k) * 1.5 * u);
        ctx.stroke();
      }
    }
    // The light pass.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) l();
    shots();
    bolts();
    ctx.restore();
    storm();
    ctx.restore();
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(220,210,255,${(0.28 * world.flash).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    grade(t);
    words(t);
  }
  function guitarFlame(x: number, y: number, s: number, on: number) {
    if (!on) return;
    const gx = x + 118 * s;
    const gy = y - 52 * s;
    for (let k = 0; k < 8; k++) {
      const q = k / 7;
      const wob = Math.sin(E.t * 30 + k) * 3 * s;
      E.glow(gx + q * 70 * s, gy - q * 30 * s + wob, (8 + q * 14) * s, q < 0.3 ? '#fff0b0' : '#ff6a18', 0.9 - q * 0.5);
    }
  }
  /** The toxic storm: a wall of orange murk, whirlwinds, things in the air. */
  function storm() {
    const st = world.storm;
    if (st <= 0.01) return;
    const col = E.tone('#a8582a', 0.5, 0.4);
    const dark = E.tone('#3a2014', 0.5, 0);
    const spr = E.soft(col);
    const sprD = E.soft(dark);
    for (let k = 0; k < 26; k++) {
      const span = GW * 1.5;
      const x = posmod(hash(k, 1, tseed) * span + E.t * (160 + hash(k, 2, tseed) * 200) * u, span) - GW * 0.25;
      const y = HY * 0.2 + hash(k, 3, tseed) * GH * 0.8;
      const r = (160 + hash(k, 4, tseed) * 260) * u;
      ctx.globalAlpha = st * (0.18 + hash(k, 5, tseed) * 0.2);
      ctx.drawImage(k % 3 ? spr : sprD, x - r, y - r * 0.5, r * 2, r);
    }
    // Whirlwinds round the eye.
    for (let w = 0; w < 2; w++) {
      const cx = world.stormX + (w ? -GW * 0.35 : 0);
      for (let k = 0; k < 18; k++) {
        const q = k / 17;
        const yy = world.yOf(0.3) - q * GH * 0.8;
        const sw = Math.sin(E.t * 3 + q * 6 + w) * (20 + q * 80) * u;
        const r = (30 + q * 120) * u;
        ctx.globalAlpha = st * 0.32 * (1 - q * 0.5);
        ctx.drawImage(k % 2 ? sprD : spr, cx + sw - r, yy - r * 0.35, r * 2, r * 0.7);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = hexA(E.tone('#4a2410', 0.5), st * 0.3);
    ctx.fillRect(-20, -20, GW + 40, GH + 40);
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
      ctx.globalAlpha = 0.07;
      const step = Math.floor(t * 12);
      ctx.translate((step * 37) % 128, (step * 53) % 128);
      ctx.fillStyle = pat;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.32, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(14,8,4,0)');
    vg.addColorStop(1, `rgba(14,8,4,${(0.5 + E.night * 0.15).toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- words: a title card for the big moments, subtitles for what is shouted, the rig's plate ----------
  const small = () => W < 600;
  /** Text with a dark outline under it, as film subtitles are set: legible over sun, salt and night alike. */
  function outlined(text: string, x: number, y: number, fill: string, a: number, stroke = 4) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(8,5,3,${(0.85 * a).toFixed(3)})`;
    ctx.lineWidth = stroke;
    ctx.strokeText(text, Math.round(x), Math.round(y));
    ctx.fillStyle = hexA(fill, a);
    fillCrisp(ctx, text, x, y);
  }
  const TONES = { fire: ['#ffcf6a', '#ff8a3a'], cold: ['#d8f0ff', '#8ac8e0'], dust: ['#f6e2c0', '#d8a878'] } as const;
  function titleCard(t: number) {
    const tc = world.titles[world.titles.length - 1];
    if (!tc) return;
    const age = t - tc.t0;
    const life = 6.5;
    if (age < 0 || age > life) return;
    const a = Math.min(1, age * 2.2, (life - age) / 1.2);
    const [c0, c1] = TONES[tc.tone];
    const big = small() ? 26 : 40;
    const y = Math.round(H * (small() ? 0.2 : 0.16));
    ctx.textAlign = 'center';
    // A torn strip of dark behind it, wider than the words.
    ctx.font = FONT(big, 700);
    const head = fitText(ctx, tc.head.split('').join(String.fromCharCode(8202)), W - 40);
    const hw = ctx.measureText(head).width;
    const g = ctx.createLinearGradient(W / 2 - hw / 2 - 90, 0, W / 2 + hw / 2 + 90, 0);
    g.addColorStop(0, 'rgba(10,6,3,0)');
    g.addColorStop(0.2, `rgba(10,6,3,${(0.5 * a).toFixed(3)})`);
    g.addColorStop(0.8, `rgba(10,6,3,${(0.5 * a).toFixed(3)})`);
    g.addColorStop(1, 'rgba(10,6,3,0)');
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - hw / 2 - 90, y - big - 8, hw + 180, big + (small() ? 34 : 44));
    // The head slides in a little as it arrives.
    const slide = (1 - Math.min(1, age * 2)) * 12;
    outlined(head, W / 2, y + slide * 0.3, c0, a, 5);
    ctx.fillStyle = hexA(c1, 0.8 * a);
    ctx.fillRect(W / 2 - Math.min(hw, 220) / 2, y + 7, Math.min(hw, 220) * Math.min(1, age * 1.5), 2);
    ctx.font = TYPE(small() ? 13 : 17, true);
    outlined(fitText(ctx, tc.sub, W - 40), W / 2, y + (small() ? 26 : 32), '#f6ead2', a * 0.95, 3);
    ctx.textAlign = 'left';
  }
  const WHO: Record<string, string> = { rig: '#ffcf6a', party: '#f0e6d6', rival: '#9fe0f0', ravens: '#d8c8b0', ally: '#c8e8a8' };
  function subtitles(t: number) {
    const sb = world.subs[world.subs.length - 1];
    if (!sb) return;
    const age = t - sb.t0;
    const life = 3.4;
    if (age < 0 || age > life) return;
    const a = Math.min(1, age * 5, (life - age) / 0.5);
    ctx.textAlign = 'center';
    const y = H - (small() ? 34 : 42);
    ctx.font = FONT(small() ? 12 : 14, 600);
    const who = sb.who.split('').join(String.fromCharCode(8202));
    outlined(fitText(ctx, who, W - 40), W / 2, y - (small() ? 22 : 28), WHO[sb.clan] ?? '#f0e6d6', a * 0.9, 3);
    ctx.font = FONT(small() ? 18 : 25, 700);
    outlined(fitText(ctx, typed(sb.text, age, 60, t), W - 32), W / 2, y, '#ffffff', a, 5);
    ctx.textAlign = 'left';
  }
  /** The rig's plate, top left: her name stencilled, the odometer, the tank's gauge, the hour's dial, the tally. */
  function plate(t: number) {
    void t;
    const level = 0.65 + 0.35 * host.intensity;
    const k = small() ? 0.8 : 1;
    const x0 = 16;
    const y0 = 16;
    ctx.font = FONT(Math.round(20 * k), 700);
    const w = Math.min(W - 32, Math.max(300 * k, ctx.measureText(world.rig.name.split('').join(String.fromCharCode(8202))).width + 80 * k));
    const h = 70 * k;
    // A riveted steel plate, sun-bleached, dark enough to hold its letters.
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, `rgba(48,40,34,${(0.82 * level).toFixed(3)})`);
    g.addColorStop(1, `rgba(20,16,13,${(0.82 * level).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 + 6, y0);
    ctx.lineTo(x0 + w, y0);
    ctx.lineTo(x0 + w - 8, y0 + h);
    ctx.lineTo(x0, y0 + h);
    ctx.lineTo(x0, y0 + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255,200,140,${(0.25 * level).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = `rgba(220,200,170,${(0.5 * level).toFixed(3)})`;
    for (const [rx, ry] of [[x0 + 6, y0 + 6], [x0 + w - 8, y0 + 6], [x0 + 6, y0 + h - 6], [x0 + w - 14, y0 + h - 6]]) ctx.fillRect(rx - 1, ry - 1, 2, 2);
    const rig = world.rig;
    ctx.textAlign = 'left';
    ctx.font = FONT(Math.round(20 * k), 700);
    ctx.fillStyle = hexA('#ffcf6a', 0.95 * level);
    fillCrisp(ctx, fitText(ctx, rig.name.split('').join(String.fromCharCode(8202)), w - 70 * k), x0 + 12, y0 + 26 * k);
    // The dial of the hours: the sun or the moon round a ring.
    const dx = x0 + w - 34 * k;
    const dy = y0 + 24 * k;
    const dr = 14 * k;
    ctx.strokeStyle = `rgba(240,220,190,${(0.6 * level).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(dx - dr, dy);
    ctx.lineTo(dx + dr, dy);
    ctx.stroke();
    const ang = Math.PI / 2 + world.day * Math.PI * 2;
    const day = world.day > 0.25 && world.day < 0.75;
    ctx.fillStyle = day ? '#ffb040' : '#cfe0ff';
    ctx.beginPath();
    ctx.arc(dx + Math.cos(ang) * dr, dy + Math.sin(ang) * dr, 4 * k, 0, Math.PI * 2);
    ctx.fill();
    // The odometer.
    ctx.font = FONT(Math.round(13 * k), 600);
    const km = String(Math.floor(world.km)).padStart(4, '0');
    const ox = x0 + 12;
    const oy = y0 + 50 * k;
    ctx.fillStyle = 'rgba(10,8,6,0.85)';
    ctx.fillRect(ox - 3, oy - 13 * k, 4 * 11 * k + 6, 17 * k);
    ctx.fillStyle = hexA('#f6ead2', 0.95 * level);
    for (let i = 0; i < 4; i++) fillCrisp(ctx, km[i], ox + i * 11 * k, oy);
    ctx.font = FONT(Math.round(9 * k), 600);
    ctx.fillStyle = hexA('#d8b88a', 0.85 * level);
    fillCrisp(ctx, 'KM', ox + 46 * k, oy);
    // The tank gauge, in segments; red when it leaks.
    const gx = ox + 66 * k;
    const gw = Math.max(40, w - 66 * k - 120 * k);
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const on = i < Math.round(rig.load * segs);
      ctx.fillStyle = on ? (rig.leak > 0 && Math.sin(t * 8) > 0 ? '#ff5a3a' : rig.cargo === 'fuel' ? '#ffb040' : '#7ad0f0') : 'rgba(255,255,255,0.12)';
      ctx.fillRect(gx + (i * gw) / segs, oy - 10 * k, gw / segs - 2, 10 * k);
    }
    ctx.fillStyle = hexA('#d8b88a', 0.85 * level);
    fillCrisp(ctx, rig.cargo === 'fuel' ? 'FUEL' : 'WATER', gx, oy + 9 * k);
    // The tally: cars put over, in white fives.
    const tx = gx + gw + 10 * k;
    ctx.strokeStyle = hexA('#f6ead2', 0.9 * level);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const n = Math.min(30, rig.kills);
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / 5);
      const gx2 = tx + (grp % 3) * 14 * k;
      const gy2 = oy - 12 * k + Math.floor(grp / 3) * 0;
      const j = i % 5;
      if (j < 4) {
        ctx.moveTo(gx2 + j * 2.6 * k, gy2);
        ctx.lineTo(gx2 + j * 2.6 * k, gy2 + 10 * k);
      } else {
        ctx.moveTo(gx2 - 1, gy2 + 8 * k);
        ctx.lineTo(gx2 + 9 * k, gy2 + 2 * k);
      }
    }
    ctx.stroke();
    if (rig.kills > 30) {
      ctx.fillStyle = hexA('#f6ead2', 0.9 * level);
      fillCrisp(ctx, `+${rig.kills - 30}`, tx + 44 * k, oy - 2);
    }
  }
  function words(t: number) {
    if (o.hud) plate(t);
    if (o.labels) {
      titleCard(t);
      subtitles(t);
    }
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [world.flip ? W - SX(x) : SX(x), SY(y)],
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => {
      const wx = ((world.flip ? W - x : x) - W / 2) / cam.zoom + cam.x;
      const wy = (y - H / 2) / cam.zoom + cam.y;
      if (!mapView) return [wx, wy];
      // From the map back to the scene's frame, where the sim's touch lives.
      const z = (wy - map.my(0.5)) / (map.my(1.5) - map.my(0.5)) + 0.5;
      return [GW / 2 + ((wx - GW / 2) * world.mOf(z)) / map.k, world.yOf(z)];
    },
    after: (dt) => {
      framing.update(dt, world.t, mapView ? mapDirector : world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => paint(t),
    ambience: () => (world.storm > 0.3 ? 0.95 : world.vehicles.length > 4 ? 0.8 : 0.45),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      E.clear();
      land.clear();
      map.clear();
    },
  });
}
