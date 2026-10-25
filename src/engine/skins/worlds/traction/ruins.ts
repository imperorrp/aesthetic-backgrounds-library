/**
 * The ancient world sticking out of the mud, drawn: the bones of the plain.
 *
 * Ruins are not kept by the sim: there is one (or none) in every stretch of plain, decided by a
 * hash of where it is, so the plain is the same plain however far the city goes, and endless.
 * Pylons bent over, half-buried tower blocks with their window holes and their rods, wind
 * turbines with a blade gone, a broken overpass on its piers, a fallen stone hand, gas tanks
 * crumpled, the great wheel of a town eaten long ago, an arch; and the colossal relics the sim
 * does keep, rising out of the heaving mud.
 */
import { hsh } from './design';
import { hexA, type Env } from './light';
import type { Relic, RelicKind } from './types';

export type RuinKind = 'pylon' | 'block' | 'turbine' | 'overpass' | 'hand' | 'tank' | 'wheel' | 'arch' | 'mast';
export type Ruin = { key: number; kind: RuinKind; gx: number; d: number; size: number; seed: number; lean: number };
const KINDS: RuinKind[] = ['pylon', 'block', 'block', 'turbine', 'overpass', 'hand', 'tank', 'wheel', 'wheel', 'arch', 'mast', 'pylon'];

/** The ruins in sight: one per stretch of plain, per lane of depth. */
export function ruinsIn(seed: number, u: number, x0: number, x1: number, lane: number, avoid: [number, number]): Ruin[] {
  const out: Ruin[] = [];
  const cell = (380 + lane * 260) * u;
  for (let i = Math.floor(x0 / cell); i <= Math.ceil(x1 / cell); i++) {
    const h = hsh(i * 7.31 + lane * 101, seed);
    if (h > 0.5) continue;
    const dLo = [0.06, 0.38, 0.55, 0.78][lane];
    const dHi = [0.2, 0.52, 0.7, 0.95][lane];
    const d = dLo + hsh(i, seed + lane * 13) * (dHi - dLo);
    if (d > avoid[0] && d < avoid[1]) continue;
    out.push({ key: i * 10 + lane, kind: KINDS[Math.floor(hsh(seed + lane, i * 3.7) * KINDS.length)], gx: (i + 0.15 + hsh(i, seed + 3) * 0.7) * cell, d, size: 0.7 + hsh(i, seed + 5) * 0.8, seed: Math.floor(hsh(i, seed + 7) * 1e6), lean: (hsh(i, seed + 9) - 0.5) * 0.5 });
  }
  return out;
}

/** A ruin standing at (X, Y) on the mud, s px per ground unit. */
export function drawRuin(E: Env, r: Ruin, X: number, Y: number, s: number) {
  const c = E.ctx;
  const d = r.d;
  const k = s * r.size * E.u;
  const conc = E.tone('#8a8478', d, 0.2);
  const concD = E.tone('#4a4640', d);
  const rust = E.tone('#6a4430', d, 0.1);
  const rustD = E.tone('#3a2a20', d);
  const mud = E.tone('#3a3024', d);
  c.save();
  c.translate(X, Y);
  c.rotate(r.lean * 0.35);
  const R = (q: number) => hsh(r.seed, q);
  if (r.kind === 'pylon') {
    const h = 120 * k;
    const w = 30 * k;
    c.strokeStyle = rustD;
    c.lineWidth = Math.max(0.6, 1.6 * k);
    const bend = (R(1) - 0.3) * 0.9;
    const pt = (q: number, side: number): [number, number] => {
      const y = -h * q;
      const ww = w * (1 - q * 0.75) * side;
      const bx = q > 0.55 ? Math.sin(bend) * (q - 0.55) * h * 1.2 : 0;
      return [ww + bx, y + (q > 0.55 ? (1 - Math.cos(bend)) * (q - 0.55) * h : 0)];
    };
    c.beginPath();
    for (const sd of [-1, 1]) {
      const a = pt(0, sd);
      c.moveTo(a[0], a[1]);
      for (let q = 0.1; q <= 1.001; q += 0.1) {
        const p = pt(q, sd);
        c.lineTo(p[0], p[1]);
      }
    }
    for (let q = 0; q < 1; q += 0.1) {
      const a = pt(q, -1);
      const b = pt(q + 0.1, 1);
      const a2 = pt(q, 1);
      const b2 = pt(q + 0.1, -1);
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.moveTo(a2[0], a2[1]);
      c.lineTo(b2[0], b2[1]);
    }
    // The cross-arms and a dangling cable.
    const arm = pt(0.78, 0);
    c.moveTo(arm[0] - w * 1.4, arm[1]);
    c.lineTo(arm[0] + w * 1.4, arm[1]);
    c.stroke();
    c.lineWidth = Math.max(0.4, 0.7 * k);
    c.beginPath();
    c.moveTo(arm[0] + w * 1.3, arm[1]);
    c.quadraticCurveTo(arm[0] + w * 2.6, arm[1] + h * 0.3, arm[0] + w * 3.4, -2 * k);
    c.stroke();
  } else if (r.kind === 'block') {
    // A tower block sunk to its middle in the mud, tilted, window holes, rods out of the top.
    const w = 64 * k;
    const h = (90 + R(2) * 80) * k;
    c.rotate(r.lean * 0.4);
    c.fillStyle = conc;
    c.beginPath();
    c.moveTo(-w / 2, 6 * k);
    c.lineTo(-w / 2, -h);
    for (let q = 0; q <= 6; q++) c.lineTo(-w / 2 + (q * w) / 6, -h - (R(q + 10) - 0.3) * 14 * k);
    c.lineTo(w / 2, 6 * k);
    c.fill();
    c.fillStyle = concD;
    c.fillRect(w * 0.18, -h, w * 0.32, h + 6 * k);
    c.fillStyle = E.tone('#14120f', d);
    for (let y = -h + 8 * k; y < -4 * k; y += 11 * k)
      for (let x = -w / 2 + 5 * k; x < w / 2 - 6 * k; x += 10 * k) if (R(x * 3 + y) < 0.85) c.fillRect(x, y, 5 * k, 6 * k);
    c.strokeStyle = rustD;
    c.lineWidth = Math.max(0.4, 0.9 * k);
    c.beginPath();
    for (let q = 0; q < 7; q++) {
      const x = -w / 2 + R(q + 30) * w;
      c.moveTo(x, -h + 2 * k);
      c.lineTo(x + (R(q + 40) - 0.5) * 10 * k, -h - (8 + R(q + 50) * 16) * k);
    }
    c.stroke();
  } else if (r.kind === 'turbine') {
    const h = 150 * k;
    c.fillStyle = conc;
    c.beginPath();
    c.moveTo(-4 * k, 0);
    c.lineTo(-2 * k, -h);
    c.lineTo(2 * k, -h);
    c.lineTo(4 * k, 0);
    c.fill();
    c.fillStyle = concD;
    c.fillRect(-3 * k, -h - 4 * k, 12 * k, 7 * k);
    c.strokeStyle = conc;
    c.lineCap = 'round';
    c.lineWidth = Math.max(0.8, 2.6 * k);
    const a0 = R(3) * 6.28 + E.t * 0.02 * (R(4) < 0.2 ? 1 : 0);
    c.beginPath();
    for (let q = 0; q < 3; q++) {
      if (q === 2 && R(5) < 0.7) continue;
      const a = a0 + (q * Math.PI * 2) / 3;
      const len = (q === 1 && R(6) < 0.5 ? 30 : 62) * k;
      c.moveTo(0, -h);
      c.lineTo(Math.cos(a) * len, -h + Math.sin(a) * len);
    }
    c.stroke();
    c.lineCap = 'butt';
  } else if (r.kind === 'overpass') {
    const w = 260 * k;
    const h = 50 * k;
    c.fillStyle = conc;
    c.beginPath();
    c.moveTo(-w / 2, -h);
    c.lineTo(w / 2 - 20 * k, -h);
    c.lineTo(w / 2, -h + 10 * k);
    c.lineTo(w / 2 - 6 * k, -h + 14 * k);
    c.lineTo(-w / 2 + 10 * k, -h + 12 * k);
    c.lineTo(-w / 2 - 6 * k, -h + 18 * k);
    c.closePath();
    c.fill();
    c.fillStyle = concD;
    c.fillRect(-w / 2, -h + 9 * k, w - 10 * k, 3 * k);
    for (const q of [-0.32, 0.05, 0.36]) {
      c.fillStyle = conc;
      c.fillRect(w * q - 6 * k, -h + 12 * k, 12 * k, h - 12 * k);
      c.fillStyle = concD;
      c.fillRect(w * q + 2 * k, -h + 12 * k, 4 * k, h - 12 * k);
    }
    // The rail, bent, and a rusted sign.
    c.strokeStyle = rustD;
    c.lineWidth = Math.max(0.4, 0.8 * k);
    c.beginPath();
    c.moveTo(-w / 2, -h - 4 * k);
    c.lineTo(w * 0.2, -h - 4 * k);
    c.lineTo(w * 0.3, -h - 12 * k);
    c.stroke();
    c.fillStyle = E.tone('#3a5a4a', d, 0.1);
    c.fillRect(-w * 0.1, -h - 22 * k, 36 * k, 14 * k);
  } else if (r.kind === 'hand') {
    // A stone hand reaching out of the mud, fingers broken.
    const sc = 1.3 * k;
    c.fillStyle = E.tone('#9a9488', d, 0.3);
    c.beginPath();
    c.moveTo(-26 * sc, 2);
    c.quadraticCurveTo(-30 * sc, -50 * sc, -20 * sc, -80 * sc);
    c.lineTo(22 * sc, -84 * sc);
    c.quadraticCurveTo(30 * sc, -40 * sc, 26 * sc, 2);
    c.fill();
    const fingers = [[-18, 34], [-6, 44], [6, 40], [17, 30]];
    for (const [i, [fx, fl]] of fingers.entries()) {
      const broken = R(i + 60) < 0.4;
      c.beginPath();
      c.roundRect((fx - 5) * sc, (-84 - (broken ? fl * 0.45 : fl)) * sc, 10 * sc, (broken ? fl * 0.45 : fl) * sc + 4 * sc, 4 * sc);
      c.fill();
    }
    c.beginPath();
    c.ellipse(-30 * sc, -60 * sc, 7 * sc, 20 * sc, -0.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hexA(E.tone('#2a2620', d), 0.5);
    c.fillRect(6 * sc, -84 * sc, 16 * sc, 86 * sc);
  } else if (r.kind === 'tank') {
    const w = 70 * k;
    const h = 46 * k;
    c.fillStyle = rust;
    c.beginPath();
    c.moveTo(-w / 2, 0);
    c.lineTo(-w / 2, -h * 0.8);
    c.quadraticCurveTo(-w * 0.1, -h * 1.15, w * 0.15, -h * 0.7);
    c.lineTo(w * 0.32, -h);
    c.lineTo(w / 2, -h * 0.85);
    c.lineTo(w / 2, 0);
    c.fill();
    c.strokeStyle = rustD;
    c.lineWidth = Math.max(0.4, k);
    for (let q = 1; q < 4; q++) {
      c.beginPath();
      c.moveTo(-w / 2, -h * q * 0.22);
      c.lineTo(w / 2, -h * q * 0.22);
      c.stroke();
    }
    c.fillStyle = rustD;
    c.fillRect(w * 0.1, -h * 0.6, w * 0.3, h * 0.6);
  } else if (r.kind === 'wheel') {
    // The great wheel of a town eaten long ago, half sunk.
    const rr = 70 * k;
    c.strokeStyle = rustD;
    c.lineWidth = Math.max(1, 6 * k);
    c.beginPath();
    c.arc(0, rr * 0.35, rr, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
    c.lineWidth = Math.max(0.5, 2 * k);
    c.beginPath();
    for (let q = 0; q < 6; q++) {
      const a = Math.PI * (1.12 + q * 0.15);
      c.moveTo(0, rr * 0.35);
      c.lineTo(Math.cos(a) * rr, rr * 0.35 + Math.sin(a) * rr);
    }
    c.stroke();
    c.fillStyle = rust;
    for (let q = 0; q < 10; q++) {
      const a = Math.PI * (1.05 + q * 0.09);
      c.fillRect(Math.cos(a) * rr * 1.04 - 3 * k, rr * 0.35 + Math.sin(a) * rr * 1.04 - 3 * k, 6 * k, 6 * k);
    }
  } else if (r.kind === 'arch') {
    const w = 80 * k;
    const h = 70 * k;
    c.fillStyle = conc;
    c.beginPath();
    c.moveTo(-w / 2, 0);
    c.lineTo(-w / 2, -h);
    c.lineTo(w * 0.2, -h);
    c.lineTo(w * 0.3, -h + 10 * k);
    c.lineTo(w / 2, -h + 6 * k);
    c.lineTo(w / 2, 0);
    c.lineTo(w * 0.28, 0);
    c.lineTo(w * 0.28, -h * 0.55);
    c.arc(0, -h * 0.55, w * 0.28, 0, Math.PI, true);
    c.lineTo(-w * 0.28, 0);
    c.closePath();
    c.fill();
    c.fillStyle = concD;
    c.fillRect(w * 0.28, -h + 6 * k, w * 0.22, h - 6 * k);
  } else {
    // A radio mast with its stays, snapped.
    const h = 170 * k;
    c.strokeStyle = rustD;
    c.lineWidth = Math.max(0.5, 1.2 * k);
    c.beginPath();
    c.moveTo(-3 * k, 0);
    c.lineTo(0, -h * 0.6);
    c.lineTo(h * 0.25, -h * 0.82);
    c.moveTo(3 * k, 0);
    c.lineTo(1.5 * k, -h * 0.6);
    c.stroke();
    c.lineWidth = Math.max(0.3, 0.5 * k);
    c.beginPath();
    c.moveTo(0, -h * 0.5);
    c.lineTo(-60 * k, 0);
    c.moveTo(0, -h * 0.5);
    c.lineTo(50 * k, 0);
    c.stroke();
  }
  // Mud banked round its foot.
  c.rotate(-r.lean * 0.35);
  c.fillStyle = mud;
  c.beginPath();
  c.ellipse(0, 1, 46 * k * r.size, 6 * k, 0, Math.PI, 0);
  c.fill();
  c.restore();
}

/** A colossal relic at (X, Y), s px per ground unit, risen k (0..1). */
export function drawRelic(E: Env, rl: Relic, X: number, Y: number, s: number) {
  const c = E.ctx;
  const d = rl.d;
  const k = s * E.u * 3.2;
  const rise = 1 - Math.pow(1 - rl.k, 2);
  const kind: RelicKind = rl.kind;
  const metal = E.tone('#7a7870', d, 0.3);
  const metalD = E.tone('#3a3834', d);
  const glass = E.tone('#5a7a84', d, 0.4);
  const H = (kind === 'tower' ? 170 : kind === 'colossus' ? 120 : 90) * k;
  c.save();
  c.beginPath();
  c.rect(X - 400 * k, Y - H * 2, 800 * k, H * 2 + 2);
  c.clip();
  c.translate(X, Y + (1 - rise) * H * 1.05);
  const R = (q: number) => hsh(rl.seed, q);
  if (kind === 'colossus') {
    // The head and shoulders of a giant statue in a helmet, eyes empty, a crack across it.
    c.fillStyle = E.tone('#8e8a7e', d, 0.3);
    c.beginPath();
    c.moveTo(-90 * k, 0);
    c.quadraticCurveTo(-80 * k, -50 * k, -36 * k, -58 * k);
    c.lineTo(-30 * k, -80 * k);
    c.quadraticCurveTo(-34 * k, -124 * k, 0, -128 * k);
    c.quadraticCurveTo(34 * k, -124 * k, 30 * k, -80 * k);
    c.lineTo(36 * k, -58 * k);
    c.quadraticCurveTo(80 * k, -50 * k, 90 * k, 0);
    c.fill();
    c.fillStyle = metalD;
    c.fillRect(-16 * k, -100 * k, 10 * k, 5 * k);
    c.fillRect(6 * k, -100 * k, 10 * k, 5 * k);
    c.fillRect(-2 * k, -92 * k, 4 * k, 12 * k);
    c.fillStyle = hexA(E.tone('#24221e', d), 0.5);
    c.beginPath();
    c.moveTo(0, -128 * k);
    c.quadraticCurveTo(34 * k, -124 * k, 30 * k, -80 * k);
    c.lineTo(36 * k, -58 * k);
    c.quadraticCurveTo(80 * k, -50 * k, 90 * k, 0);
    c.lineTo(10 * k, 0);
    c.fill();
    c.strokeStyle = metalD;
    c.lineWidth = Math.max(0.6, 1.4 * k);
    c.beginPath();
    c.moveTo(-26 * k, -118 * k);
    c.lineTo(-8 * k, -96 * k);
    c.lineTo(-14 * k, -70 * k);
    c.lineTo(4 * k, -40 * k);
    c.stroke();
  } else if (kind === 'dish') {
    c.fillStyle = metal;
    c.fillRect(-8 * k, -60 * k, 16 * k, 60 * k);
    c.save();
    c.translate(0, -62 * k);
    c.rotate(-0.5 + R(1) * 0.3);
    c.beginPath();
    c.ellipse(0, 0, 80 * k, 30 * k, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = metalD;
    c.beginPath();
    c.ellipse(0, 0, 80 * k, 10 * k, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = metal;
    c.lineWidth = Math.max(0.5, 1.5 * k);
    c.beginPath();
    c.moveTo(-60 * k, -4 * k);
    c.lineTo(0, -60 * k);
    c.lineTo(60 * k, -4 * k);
    c.stroke();
    c.restore();
  } else if (kind === 'tower') {
    // A tower of glass and steel, leaning, its panes catching the light.
    c.rotate(0.12 * (R(2) < 0.5 ? 1 : -1));
    c.fillStyle = metalD;
    c.fillRect(-26 * k, -170 * k, 52 * k, 172 * k);
    for (let y = -166; y < 0; y += 8)
      for (let x = -22; x < 22; x += 8) {
        c.fillStyle = R(x * 7 + y) < 0.2 ? E.tone('#1a1a1a', d) : hexA(glass, 0.7 + R(x + y * 3) * 0.3);
        c.fillRect(x * k, y * k, 6 * k, 6 * k);
      }
    c.fillStyle = hexA(E.L.sun, 0.25 * E.L.rim);
    c.fillRect(-26 * k, -170 * k, 8 * k, 172 * k);
  } else if (kind === 'ring') {
    c.strokeStyle = metal;
    c.lineWidth = 18 * k;
    c.beginPath();
    c.arc(0, 40 * k, 130 * k, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    c.strokeStyle = metalD;
    c.lineWidth = 4 * k;
    c.beginPath();
    c.arc(0, 40 * k, 120 * k, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    for (let q = 0; q < 9; q++) {
      const a = Math.PI * (1.15 + q * 0.085);
      c.fillStyle = q % 2 ? glass : metalD;
      c.fillRect(Math.cos(a) * 130 * k - 4 * k, 40 * k + Math.sin(a) * 130 * k - 4 * k, 8 * k, 8 * k);
    }
  } else {
    // The hull of an ancient sky-ship, ribs and plates, nose down in the mud.
    c.rotate(-0.25);
    c.fillStyle = metal;
    c.beginPath();
    c.moveTo(-120 * k, 10 * k);
    c.quadraticCurveTo(-60 * k, -70 * k, 80 * k, -40 * k);
    c.lineTo(110 * k, -20 * k);
    c.lineTo(100 * k, 10 * k);
    c.fill();
    c.strokeStyle = metalD;
    c.lineWidth = Math.max(0.6, 2 * k);
    for (let q = 0; q < 9; q++) {
      const x = -100 * k + q * 22 * k;
      c.beginPath();
      c.moveTo(x, 8 * k);
      c.lineTo(x + 6 * k, -50 * k + Math.abs(q - 4) * 6 * k);
      c.stroke();
    }
    c.fillStyle = E.tone('#1a1a1a', d);
    for (let q = 0; q < 6; q++) c.fillRect(-60 * k + q * 22 * k, -30 * k, 6 * k, 4 * k);
  }
  c.restore();
  // The heaving mud round it while it rises.
  if (rl.k < 1) {
    c.fillStyle = E.tone('#3a2e22', d);
    for (let q = 0; q < 12; q++) {
      const a = (q / 12) * Math.PI;
      c.beginPath();
      c.ellipse(X + Math.cos(a) * 120 * k * (0.5 + R(q + 20) * 0.6), Y - Math.sin(E.t * 3 + q) * 3 * k * (1 - rl.k), 16 * k, 5 * k, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
}
