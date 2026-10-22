/**
 * The small towns, drawn: each baked once from its seed (a hull, one to three tiers of houses,
 * a chimney, a church tower or a windmill), its moving parts live: great spoked wheels, track
 * units, six spider legs for a scavenger town (and its grabs), a bucket-wheel for a mining town,
 * sails for a sail town; smoke, steam when broken down, lamps at night.
 *
 * Town units: 100 from tail to bow, x forward, y up from the mud negative (see ./design).
 */
import { townPlan, type TownPlan } from './design';
import { face, mulberry, palOf, shade, windows } from './city';
import { clamp01, drift, hexA, sprite, tintSprite, type Env, type Sprite } from './light';
import type { Town } from './types';

const SCAV: { hull: string; rust: string } = { hull: '#3a3028', rust: '#7a4a2a' };

export function bakeTown(t: Town, res: number): Sprite {
  const plan = townPlan(t.seed, t.kind, t.tiers);
  const P = palOf(t.seed);
  const R = mulberry(t.seed + 5);
  const top = Math.min(...plan.tiers.map((q) => q.top), plan.hullTop) - 40;
  const s = sprite(150 * res, (-top + 10) * res, 75 * res, -top * res, res, true, true);
  const g = s.g;
  const wg = s.wg;
  const rg = s.rg!;
  const scav = t.kind === 'scav';
  const hullC = scav ? SCAV.hull : R() < 0.5 ? P.hull : shade(P.brick[0], 0.7);
  // The hull: a boat-shaped bed of iron, with a ram or a cow-catcher at the bow.
  g.fillStyle = hullC;
  g.beginPath();
  g.moveTo(-50, plan.hullTop);
  g.lineTo(46, plan.hullTop);
  g.lineTo(scav ? 56 : 52, plan.hullTop + (plan.hullBot - plan.hullTop) * 0.5);
  g.lineTo(44, plan.hullBot);
  g.lineTo(-46, plan.hullBot);
  g.closePath();
  g.fill();
  const gr = g.createLinearGradient(0, plan.hullTop, 0, plan.hullBot);
  gr.addColorStop(0, 'rgba(255,255,255,0.15)');
  gr.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = gr;
  g.fill();
  g.fillStyle = scav ? SCAV.rust : P.trim;
  g.fillRect(-50, plan.hullTop + 2, 96, 1.4);
  for (let x = -44; x < 44; x += 7) {
    g.fillStyle = '#151210';
    g.fillRect(x, plan.hullTop + 5, 2.2, 2.2);
    if (wg && R() < 0.5) {
      wg.fillStyle = '#ffcf8a';
      wg.fillRect(x, plan.hullTop + 5, 2.2, 2.2);
    }
  }
  rg.fillStyle = 'rgba(255,255,255,0.8)';
  rg.fillRect(-50, plan.hullTop - 0.6, 96, 1.4);
  if (scav) {
    // Rust patches and a crane boom with grabs over the bow.
    for (let k = 0; k < 8; k++) {
      g.fillStyle = hexA(SCAV.rust, 0.5);
      g.fillRect(-46 + R() * 86, plan.hullTop + R() * 10, 4 + R() * 8, 3 + R() * 4);
    }
  }
  // The tiers: houses, a chapel, a windmill, chimneys.
  for (const [i, tr] of plan.tiers.entries()) {
    g.fillStyle = shade(P.iron, 0.9);
    g.fillRect(tr.x0, tr.floor, tr.x1 - tr.x0, 3);
    rg.fillStyle = 'rgba(255,255,255,0.8)';
    rg.fillRect(tr.x0, tr.floor - 0.4, tr.x1 - tr.x0, 1);
    let x = tr.x0 + 1;
    const h = tr.floor - tr.top;
    while (x < tr.x1 - 5) {
      const w = Math.min(tr.x1 - 1 - x, 6 + R() * 10);
      const hh = h * (0.55 + R() * 0.45);
      const c = scav ? shade(SCAV.hull, 0.9 + R() * 0.6) : R() < 0.35 ? P.stone : P.brick[Math.floor(R() * P.brick.length)];
      face(g, x, tr.floor - hh, w, hh, c);
      const roof = R() < 0.6;
      if (roof) {
        g.fillStyle = R() < 0.5 ? P.slate : P.roof;
        g.beginPath();
        g.moveTo(x - 0.6, tr.floor - hh);
        g.lineTo(x + w / 2, tr.floor - hh - Math.min(6, w * 0.5));
        g.lineTo(x + w + 0.6, tr.floor - hh);
        g.fill();
        rg.fillStyle = 'rgba(255,255,255,0.6)';
        rg.fillRect(x, tr.floor - hh - Math.min(6, w * 0.5) * 0.6, w * 0.5, 0.9);
      } else {
        rg.fillStyle = 'rgba(255,255,255,0.7)';
        rg.fillRect(x, tr.floor - hh - 0.4, w, 0.9);
      }
      windows(g, wg, R, x + 0.6, tr.floor - hh + 1.6, w - 1.2, hh - 2.4, 1.4, 1.8, 3, 3.6, scav ? 0.25 : 0.55);
      x += w + (R() < 0.3 ? 1.5 : 0.3);
    }
    if (i === plan.tiers.length - 1 && !scav) {
      const cx = (tr.x0 + tr.x1) / 2 + (R() - 0.5) * 10;
      const kind = R();
      if (kind < 0.35) {
        // A chapel tower with a little spire.
        face(g, cx - 3, tr.floor - h * 1.6, 6, h * 1.6, P.stone);
        g.fillStyle = P.slate;
        g.beginPath();
        g.moveTo(cx - 3.5, tr.floor - h * 1.6);
        g.lineTo(cx, tr.floor - h * 2.3);
        g.lineTo(cx + 3.5, tr.floor - h * 1.6);
        g.fill();
        rg.fillStyle = 'rgba(255,255,255,0.7)';
        rg.fillRect(cx - 3, tr.floor - h * 1.6, 1, h * 1.6);
      } else if (kind < 0.6) {
        // A town hall with a clock and a copper cap.
        face(g, cx - 7, tr.floor - h * 1.3, 14, h * 1.3, P.stone);
        g.fillStyle = P.copper;
        g.beginPath();
        g.arc(cx, tr.floor - h * 1.3, 7, Math.PI, 0);
        g.fill();
        g.fillStyle = '#e8e0c8';
        g.beginPath();
        g.arc(cx, tr.floor - h * 0.95, 2.4, 0, Math.PI * 2);
        g.fill();
        if (wg) {
          wg.fillStyle = 'rgba(255,236,190,0.8)';
          wg.beginPath();
          wg.arc(cx, tr.floor - h * 0.95, 2.4, 0, Math.PI * 2);
          wg.fill();
        }
      }
    }
  }
  // A smokestack aft.
  const T0 = plan.tiers[0];
  g.fillStyle = scav ? SCAV.rust : shade(P.iron, 1.1);
  g.fillRect(T0.x0 + 3, T0.floor - (T0.floor - T0.top) * 1.9, 4.4, (T0.floor - T0.top) * 1.9);
  g.fillStyle = '#1a1614';
  g.fillRect(T0.x0 + 2.4, T0.floor - (T0.floor - T0.top) * 1.9 - 1.5, 5.6, 1.5);
  if (scav) {
    // Red eyes at the bow: the lamps of a scavenger.
    if (wg) {
      wg.fillStyle = '#ff4a2a';
      wg.fillRect(48, plan.hullTop + 4, 2.4, 2.4);
      wg.fillRect(43, plan.hullTop + 4, 2.4, 2.4);
    }
  }
  return s;
}

export type TownArt = { s: Sprite; plan: TownPlan };
export function townArt(t: Town, res: number, arts: Map<number, TownArt>): TownArt {
  let a = arts.get(t.id);
  if (!a) {
    a = { s: bakeTown(t, res), plan: townPlan(t.seed, t.kind, t.tiers) };
    if (arts.size > 60) arts.delete(arts.keys().next().value as number);
    arts.set(t.id, a);
  }
  return a;
}

function spokeWheel(E: Env, x: number, y: number, r: number, rot: number, d: number, iron: string) {
  const c = E.ctx;
  const rim = E.tone(shade(iron, 0.7), d);
  const hub = E.tone(shade(iron, 1.3), d, 0.3);
  c.strokeStyle = rim;
  c.lineWidth = Math.max(0.8, r * 0.16);
  c.beginPath();
  c.arc(x, y, r * 0.92, 0, Math.PI * 2);
  c.stroke();
  // Cleats round the rim.
  c.fillStyle = rim;
  for (let k = 0; k < 14; k++) {
    const a = rot + (k / 14) * Math.PI * 2;
    c.fillRect(x + Math.cos(a) * r - r * 0.06, y + Math.sin(a) * r - r * 0.06, r * 0.12, r * 0.12);
  }
  c.lineWidth = Math.max(0.5, r * 0.06);
  c.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = rot + (k / 8) * Math.PI * 2;
    c.moveTo(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15);
    c.lineTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88);
  }
  c.stroke();
  c.fillStyle = hub;
  c.beginPath();
  c.arc(x, y, r * 0.18, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = hexA(E.tone('#e8dcc0', d, 0.5), 0.25 * E.L.rim);
  c.lineWidth = Math.max(0.5, r * 0.06);
  c.beginPath();
  c.arc(x, y, r * 0.95, Math.PI * 1.1, Math.PI * 1.6);
  c.stroke();
}
function smallTrack(E: Env, x0: number, x1: number, h: number, roll: number, d: number, iron: string) {
  const c = E.ctx;
  const r = h / 2;
  c.fillStyle = E.tone(shade(iron, 0.45), d);
  c.beginPath();
  c.moveTo(x0 + r, -h);
  c.lineTo(x1 - r, -h);
  c.arc(x1 - r, -r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(x0 + r, 0);
  c.arc(x0 + r, -r, r, Math.PI / 2, Math.PI * 1.5);
  c.fill();
  c.fillStyle = E.tone(shade(iron, 0.8), d);
  const step = 3;
  const off = (roll * 2) % step;
  for (let x = x0 + r + off; x < x1 - r; x += step) {
    c.fillRect(x, -h - 0.4, step * 0.6, 1.4);
    c.fillRect(x1 + x0 - x - step * 0.6, -1, step * 0.6, 1.4);
  }
  const n = Math.max(2, Math.floor((x1 - x0) / (h * 0.8)));
  for (let k = 0; k < n; k++) {
    const wx = x0 + r + (k * (x1 - x0 - 2 * r)) / Math.max(1, n - 1);
    c.fillStyle = E.tone(shade(iron, 1.1), d, 0.2);
    c.beginPath();
    c.arc(wx, -r, r * 0.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = E.tone(shade(iron, 0.5), d);
    c.beginPath();
    c.arc(wx, -r, r * 0.2, 0, Math.PI * 2);
    c.fill();
  }
}

/** A town at (X, Y) (the middle of its length, on the mud), k px per town unit. */
export function drawTown(E: Env, t: Town, art: TownArt, X: number, Y: number, k: number, d: number, clip?: [number, number, number, number]) {
  const c = E.ctx;
  const s = art.s;
  const plan = art.plan;
  const P = palOf(t.seed);
  if (drift(E, s, d) > 1) tintSprite(E, s, d);
  const roll = t.roll / Math.max(1e-3, t.len / 100);
  const broken = t.state === 'broken';
  const jolt = broken ? 0 : Math.sin(roll * 0.4) * 0.5;
  c.save();
  c.translate(X, Y);
  if (clip) {
    c.beginPath();
    c.rect(clip[0] - X, clip[1] - Y, clip[2], clip[3]);
    c.clip();
  }
  c.scale(t.dir * k, k);
  const tilt = broken ? 0.04 : 0;
  c.rotate(tilt);
  // Behind: the far legs of a scavenger, the far wheels (darker).
  if (plan.legs) legs(E, t, plan, d, roll, true);
  if (plan.drill) bucketWheel(E, t, plan, d, roll);
  c.save();
  c.translate(0, jolt);
  c.save();
  c.scale(1 / s.res, 1 / s.res);
  c.drawImage(s.tint, -s.ox, -s.oy);
  c.globalCompositeOperation = 'lighter';
  const lit = E.L.rim * (1 - E.night * 0.5) * (1 - E.hazeOf(d) * 0.6);
  if (s.rimT && lit > 0.02) {
    c.globalAlpha = clamp01(lit) * 0.7;
    c.drawImage(s.rimT, -s.ox, -s.oy);
  }
  const dark = t.state === 'flee' && E.night > 0.5 ? 0.25 : 1;
  const win = clamp01((E.night * 1.0 + 0.06) * dark);
  if (s.win && win > 0.02) {
    c.globalAlpha = win;
    c.drawImage(s.win, -s.ox, -s.oy);
  }
  c.restore();
  c.restore();
  if (plan.mast) sails(E, t, plan, d);
  if (plan.wheels.length) {
    for (const w of plan.wheels) spokeWheel(E, w.x, -w.r, w.r, roll / w.r, d, P.iron);
  } else if (!plan.legs) {
    smallTrack(E, -46, -4, -plan.hullBot - 2, roll, d, P.iron);
    smallTrack(E, 2, 44, -plan.hullBot - 2, roll, d, P.iron);
  }
  if (plan.legs) legs(E, t, plan, d, roll, false);
  c.restore();
}
function legs(E: Env, t: Town, plan: TownPlan, d: number, roll: number, far: boolean) {
  const c = E.ctx;
  const col = E.tone(far ? '#241c16' : '#4a3a2c', d, far ? 0 : 0.15);
  c.strokeStyle = col;
  c.lineCap = 'round';
  const moving = t.vx !== 0 || t.state === 'roam';
  for (let k = 0; k < 3; k++) {
    const hx = -32 + k * 32 + (far ? 6 : 0);
    const hy = plan.hullBot + 2;
    const ph = roll * 0.12 + k * 2.1 + (far ? Math.PI : 0);
    const sw = moving ? Math.sin(ph) : 0;
    const lift = moving ? Math.max(0, Math.cos(ph)) * 6 : 0;
    const fx = hx + 10 + sw * 12;
    const kx = (hx + fx) / 2 + 10;
    const ky = hy - 14 - lift * 0.5;
    c.lineWidth = far ? 2.6 : 3.4;
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(kx, ky);
    c.lineTo(fx, -lift);
    c.stroke();
    c.fillStyle = col;
    c.beginPath();
    c.arc(kx, ky, 2.4, 0, Math.PI * 2);
    c.fill();
  }
  if (!far) {
    // The grab on its boom, over the bow.
    c.lineWidth = 2;
    const sway = Math.sin(E.t * 0.8 + t.seed) * 0.2;
    c.beginPath();
    c.moveTo(40, plan.hullTop);
    c.lineTo(64, plan.hullTop - 22);
    c.lineTo(66 + sway * 10, plan.hullBot + 4);
    c.stroke();
    c.beginPath();
    c.moveTo(60 + sway * 10, plan.hullBot + 12);
    c.lineTo(66 + sway * 10, plan.hullBot + 4);
    c.lineTo(72 + sway * 10, plan.hullBot + 12);
    c.stroke();
  }
  c.lineCap = 'butt';
}
function bucketWheel(E: Env, _t: Town, plan: TownPlan, d: number, roll: number) {
  const c = E.ctx;
  const r = 24;
  const cx = 58;
  const cy = plan.hullBot - 2;
  c.strokeStyle = E.tone('#5a4a36', d, 0.1);
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(30, plan.hullTop);
  c.lineTo(cx, cy);
  c.stroke();
  const rot = E.t * 0.8 + roll * 0.02;
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  for (let k = 0; k < 8; k++) {
    const a = rot + (k / 8) * Math.PI * 2;
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.stroke();
  c.fillStyle = E.tone('#7a5a3a', d, 0.2);
  for (let k = 0; k < 10; k++) {
    const a = rot + (k / 10) * Math.PI * 2;
    c.save();
    c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    c.rotate(a);
    c.fillRect(-2, -3, 6, 6);
    c.restore();
  }
}
function sails(E: Env, t: Town, plan: TownPlan, d: number) {
  const c = E.ctx;
  const top = plan.tiers[plan.tiers.length - 1].top;
  const mx = 10;
  c.strokeStyle = E.tone('#3a2e24', d);
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(mx, plan.hullTop);
  c.lineTo(mx, top - 50);
  c.stroke();
  const belly = 6 + Math.sin(E.t * 0.6 + t.seed) * 2 + Math.abs(E.wind) * 0.15;
  const canvas = E.tone('#e8dcc4', d, 0.4);
  c.fillStyle = canvas;
  c.beginPath();
  c.moveTo(mx, top - 48);
  c.quadraticCurveTo(mx + belly + 18, top - 30, mx + 2, top - 6);
  c.lineTo(mx, top - 6);
  c.fill();
  c.beginPath();
  c.moveTo(mx - 2, top - 44);
  c.quadraticCurveTo(mx - 26 - belly, top - 22, mx - 4, top - 2);
  c.lineTo(mx - 2, top - 2);
  c.fill();
  c.fillStyle = hexA(E.tone('#7a2a22', d), 0.8);
  c.fillRect(mx - 22, top - 26, 18, 3);
}
