/**
 * The small things that give the giants their size: heavy-lift helicopters and patrols, the
 * ships of the harbour, the crews on the floor and the scaffolds, the tugs and trucks.
 *
 * Each is drawn at (x, y) with a scale `k` (1 at the dock), facing `dir`, toned for its distance.
 */
import { hash } from '../../instruments/kit';
import { hexA, mix, type Env } from './look';
import type { Heli, Person, Ship, Vehicle } from './types';

/** A heavy-lift helicopter: a long fuselage, tail boom, the rotor's blur and its blades, beacons. */
export function drawHeli(E: Env, h: Heli, x: number, y: number, k: number, d: number, t: number) {
  const c = E.ctx;
  const u = E.u * k;
  const body = E.tone(h.role === 'patrol' ? '#3e4a40' : '#6a6c62', d, 0.25);
  const dark = E.tone('#1c2024', d, 0);
  const lit = mix(body, E.L.key, 0.3 + E.flash * 0.5);
  c.save();
  c.translate(x, y);
  c.scale(h.dir, 1);
  const tilt = h.state === 'out' || h.state === 'home' ? 0.08 : 0;
  c.rotate(tilt);
  // Tail boom and fin.
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(-14 * u, -4 * u);
  c.lineTo(-44 * u, -6 * u);
  c.lineTo(-44 * u, -2 * u);
  c.lineTo(-14 * u, 4 * u);
  c.fill();
  c.fillStyle = dark;
  c.beginPath();
  c.moveTo(-40 * u, -6 * u);
  c.lineTo(-47 * u, -15 * u);
  c.lineTo(-43 * u, -15 * u);
  c.lineTo(-37 * u, -5 * u);
  c.fill();
  // Fuselage: a long rounded body, the cockpit glass forward.
  const g = c.createLinearGradient(0, -10 * u, 0, 9 * u);
  g.addColorStop(0, lit);
  g.addColorStop(0.5, body);
  g.addColorStop(1, dark);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-18 * u, -8 * u);
  c.lineTo(14 * u, -9 * u);
  c.quadraticCurveTo(26 * u, -7 * u, 28 * u, 1 * u);
  c.quadraticCurveTo(24 * u, 8 * u, 12 * u, 8 * u);
  c.lineTo(-16 * u, 7 * u);
  c.quadraticCurveTo(-21 * u, 0, -18 * u, -8 * u);
  c.fill();
  c.fillStyle = hexA(mix(E.L.key, '#9ac8e0', 0.4), 0.55 + E.L.night * 0.2);
  c.beginPath();
  c.moveTo(18 * u, -6 * u);
  c.quadraticCurveTo(25 * u, -4 * u, 26 * u, 0);
  c.lineTo(17 * u, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = hexA(dark, 0.7);
  c.lineWidth = Math.max(0.5, 0.8 * u);
  c.beginPath();
  c.moveTo(-6 * u, -8 * u);
  c.lineTo(-6 * u, 7 * u);
  c.moveTo(6 * u, -8.5 * u);
  c.lineTo(6 * u, 7.5 * u);
  c.stroke();
  // Stripe and the number.
  c.fillStyle = hexA(E.tone(h.role === 'patrol' ? '#c8b040' : '#e8a020', d, 0.2), 0.9);
  c.fillRect(-14 * u, -1 * u, 26 * u, 2 * u);
  // Gear, the engine hump, the mast.
  c.fillStyle = dark;
  c.fillRect(-8 * u, -12 * u, 18 * u, 4 * u);
  c.fillRect(0, -15 * u, 2 * u, 4 * u);
  c.fillRect(-12 * u, 8 * u, 2 * u, 3 * u);
  c.fillRect(10 * u, 8 * u, 2 * u, 3 * u);
  c.fillRect(-14 * u, 11 * u, 28 * u, 1.2 * u);
  // The rotor: a thin disc of blur, two blades caught in it.
  const R = 38 * u;
  const spin = h.rotor;
  if (spin > 0.4) {
    c.fillStyle = hexA(mix(E.L.key, E.L.haze, 0.5), 0.12 * spin);
    c.beginPath();
    c.ellipse(1 * u, -15 * u, R, 2.6 * u, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = hexA(dark, 0.9);
  c.lineWidth = Math.max(0.6, 1.4 * u);
  c.beginPath();
  for (let b = 0; b < 2; b++) {
    const a = h.ph * (0.3 + spin * 2.5) + b * Math.PI;
    const ex = Math.cos(a) * R;
    c.moveTo(1 * u - ex, -15 * u - Math.sin(a) * 1.5 * u);
    c.lineTo(1 * u + ex, -15 * u + Math.sin(a) * 1.5 * u);
  }
  c.stroke();
  // Tail rotor.
  c.strokeStyle = hexA(dark, 0.6);
  c.beginPath();
  c.arc(-45 * u, -8 * u, 5 * u, 0, Math.PI * 2);
  c.stroke();
  // Beacons: red on the belly, white strobe on the tail.
  const blink = Math.sin(t * 4 + h.seed) > 0.7 ? 1 : 0;
  c.save();
  c.globalCompositeOperation = 'lighter';
  E.glow(2 * u, 9 * u, 6 * u, '#ff3020', 0.4 + 0.6 * blink);
  E.glow(-46 * u, -15 * u, 5 * u, '#ffffff', Math.sin(t * 6 + h.seed * 2) > 0.85 ? 1 : 0);
  if (h.lamp && E.L.night + E.storm * 0.4 > 0.25) E.glow(22 * u, 6 * u, 7 * u, '#fff4d8', 0.9);
  c.restore();
  c.restore();
}

/** The cone of a searchlight from (x, y) down to a pool at (tx, ty). */
export function drawBeam(E: Env, x: number, y: number, tx: number, ty: number, r: number, a: number) {
  if (a <= 0.01) return;
  const c = E.ctx;
  const g = c.createLinearGradient(x, y, tx, ty);
  g.addColorStop(0, hexA('#fff4dc', 0.35 * a));
  g.addColorStop(1, hexA('#fff4dc', 0.04 * a));
  c.fillStyle = g;
  const ang = Math.atan2(ty - y, tx - x) + Math.PI / 2;
  c.beginPath();
  c.moveTo(x + Math.cos(ang) * 2, y + Math.sin(ang) * 2);
  c.lineTo(tx + Math.cos(ang) * r, ty + Math.sin(ang) * r * 0.3);
  c.lineTo(tx - Math.cos(ang) * r, ty - Math.sin(ang) * r * 0.3);
  c.lineTo(x - Math.cos(ang) * 2, y - Math.sin(ang) * 2);
  c.closePath();
  c.fill();
  c.fillStyle = hexA('#fff4dc', 0.18 * a);
  c.beginPath();
  c.ellipse(tx, ty, r, r * 0.25, 0, 0, Math.PI * 2);
  c.fill();
}

/** A ship in the harbour: hull, what is on its deck by kind, its superstructure and lights. */
export function drawShip(E: Env, s: Ship, x: number, y: number, k: number, d: number, t: number, opts: { held?: boolean; angle?: number } = {}) {
  const c = E.ctx;
  const L = s.len * k;
  const Hh = L * (s.kind === 'tug' ? 0.2 : s.kind === 'trawler' ? 0.14 : 0.075);
  const hull = E.tone(s.kind === 'ferry' ? '#d8d8d0' : s.kind === 'tanker' ? '#5a2a24' : s.kind === 'tug' ? '#b83a28' : '#2a3a4a', d, 0.15);
  const red = E.tone('#8a2a20', d);
  const white = E.tone('#d8d8d0', d, 0.3);
  const dark = E.tone('#14181c', d);
  c.save();
  c.translate(x, y);
  if (opts.angle) c.rotate(opts.angle);
  if (s.state === 'sunk') {
    c.rotate(0.25 * s.dir);
    c.translate(0, s.heel * Hh * 3);
  }
  c.scale(s.dir, 1);
  // Hull.
  c.fillStyle = hull;
  c.beginPath();
  c.moveTo(-L / 2, -Hh);
  c.lineTo(L / 2 - Hh * 0.5, -Hh);
  c.lineTo(L / 2, -Hh * 1.3);
  c.lineTo(L / 2 - Hh * 1.2, Hh * 0.4);
  c.lineTo(-L / 2 + Hh * 0.4, Hh * 0.4);
  c.closePath();
  c.fill();
  if (s.kind !== 'ferry' && s.kind !== 'tug') {
    c.fillStyle = red;
    c.fillRect(-L / 2 + Hh * 0.4, Hh * 0.05, L - Hh * 1.6, Hh * 0.35);
  }
  // On deck.
  if (s.kind === 'container') {
    const cols = Math.floor(L / (Hh * 1.1));
    for (let i = 1; i < cols - 2; i++)
      for (let j = 0; j < 3; j++) {
        if (hash(s.seed, i, j) < 0.2) continue;
        c.fillStyle = E.tone(['#b83a28', '#2a6a9a', '#d8a020', '#3a7a4a', '#8a8a8a', '#c86a20'][Math.floor(hash(s.seed, i, j + 9) * 6)], d, 0.15);
        c.fillRect(-L / 2 + i * Hh * 1.1, -Hh - (j + 1) * Hh * 0.55, Hh * 1.05, Hh * 0.52);
      }
    c.fillStyle = white;
    c.fillRect(-L / 2 + Hh * 0.6, -Hh * 3.4, Hh * 1.4, Hh * 2.4);
  } else if (s.kind === 'tanker') {
    c.strokeStyle = E.tone('#8a8a80', d, 0.2);
    c.lineWidth = Math.max(0.5, Hh * 0.12);
    c.beginPath();
    c.moveTo(-L * 0.3, -Hh * 1.25);
    c.lineTo(L * 0.4, -Hh * 1.25);
    c.stroke();
    c.fillStyle = white;
    c.fillRect(-L / 2 + Hh * 0.4, -Hh * 3, Hh * 1.6, Hh * 2);
  } else if (s.kind === 'ferry') {
    c.fillStyle = white;
    c.fillRect(-L * 0.38, -Hh * 2.6, L * 0.7, Hh * 1.6);
    c.fillRect(-L * 0.25, -Hh * 3.6, L * 0.4, Hh * 1);
    c.fillStyle = hexA(E.L.night > 0.3 ? '#ffe0a0' : '#2a3440', 0.9);
    for (let i = 0; i < 14; i++) c.fillRect(-L * 0.36 + i * L * 0.048, -Hh * 2.2, L * 0.025, Hh * 0.4);
  } else if (s.kind === 'tug') {
    c.fillStyle = white;
    c.fillRect(-L * 0.1, -Hh * 2.2, L * 0.35, Hh * 1.2);
    c.fillStyle = dark;
    c.fillRect(-L * 0.25, -Hh * 2.0, L * 0.1, Hh * 1.0);
  } else if (s.kind === 'barge') {
    c.strokeStyle = E.tone('#d8a020', d, 0.2);
    c.lineWidth = Math.max(0.6, Hh * 0.25);
    c.beginPath();
    c.moveTo(-L * 0.1, -Hh);
    c.lineTo(L * 0.15, -Hh * 6);
    c.lineTo(L * 0.4, -Hh * 3);
    c.stroke();
    c.fillStyle = white;
    c.fillRect(-L * 0.45, -Hh * 2.2, L * 0.18, Hh * 1.2);
  } else {
    c.fillStyle = white;
    c.fillRect(-L * 0.3, -Hh * 2.2, L * 0.3, Hh * 1.2);
    c.strokeStyle = dark;
    c.lineWidth = Math.max(0.5, Hh * 0.12);
    c.beginPath();
    c.moveTo(L * 0.15, -Hh);
    c.lineTo(L * 0.1, -Hh * 4.5);
    c.lineTo(L * 0.4, -Hh * 1.2);
    c.stroke();
  }
  // Lights: masthead, the bridge's windows, port and starboard.
  c.save();
  c.globalCompositeOperation = 'lighter';
  const n = E.L.night * 0.8 + E.storm * 0.2;
  E.glow(-L / 2 + Hh, -Hh * 3.6, Hh * 1.2, '#ffffff', 0.5 + 0.4 * n);
  E.glow(L / 2 - Hh, -Hh * 1.5, Hh * 0.9, s.dir > 0 ? '#40ff70' : '#ff4030', 0.5 * n + 0.2);
  if (s.state === 'harvest') E.glow(0, -Hh * 2, Hh * 4, '#ffe8b0', 0.35 + 0.1 * Math.sin(t * 7));
  c.restore();
  c.restore();
}

/** One of the crew: legs, a hi-vis body, a hard hat; a welder crouched with the torch's light. */
export function drawPerson(E: Env, p: Person, h: number, weld: number, inside: boolean) {
  const c = E.ctx;
  const x = p.x;
  const y = p.y;
  const vest = inside ? (p.seed % 3 === 0 ? '#e8a020' : p.seed % 3 === 1 ? '#c8d020' : '#d86020') : E.tone('#e8a020', 0, 0.3);
  const dark = inside ? '#20242a' : E.tone('#20242a', 0);
  const crouch = p.job === 'weld' ? 0.35 : 0;
  const sw = Math.sin(p.ph) * 0.5 * (crouch ? 0.2 : 1);
  c.save();
  c.translate(x, y);
  c.scale(p.dir, 1);
  c.strokeStyle = dark;
  c.lineCap = 'round';
  c.lineWidth = Math.max(0.6, h * 0.14);
  const hip = -h * (0.45 - crouch * 0.2);
  c.beginPath();
  c.moveTo(0, hip);
  c.lineTo(Math.sin(sw) * h * 0.25, 0);
  c.moveTo(0, hip);
  c.lineTo(-Math.sin(sw) * h * 0.25 - crouch * h * 0.2, 0);
  c.stroke();
  c.fillStyle = vest;
  c.fillRect(-h * 0.12, hip - h * 0.38, h * 0.24, h * 0.4);
  c.fillStyle = hexA('#f0f0e0', 0.8);
  c.fillRect(-h * 0.12, hip - h * 0.2, h * 0.24, h * 0.05);
  c.strokeStyle = vest;
  c.lineWidth = Math.max(0.5, h * 0.1);
  c.beginPath();
  c.moveTo(h * 0.05, hip - h * 0.32);
  c.lineTo(h * 0.25, hip - h * (weld ? 0.3 : 0.1));
  c.stroke();
  c.fillStyle = '#c8a080';
  c.beginPath();
  c.arc(0, hip - h * 0.48, h * 0.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = p.hat;
  c.beginPath();
  c.arc(0, hip - h * 0.52, h * 0.12, Math.PI, 0);
  c.fill();
  c.restore();
  if (weld > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(x + p.dir * h * 0.3, y + hip - h * 0.25, h * 1.8 * weld, '#bfe4ff', 0.8 * weld);
    E.glow(x + p.dir * h * 0.3, y + hip - h * 0.25, h * 0.5, '#ffffff', weld);
    c.restore();
  }
}

/** A tug, a forklift or a flatbed on the dock's floor, its amber beacon turning. */
export function drawVehicle(E: Env, v: Vehicle, y: number, u: number, t: number) {
  const c = E.ctx;
  const L = (v.kind === 'truck' ? 46 : v.kind === 'fork' ? 18 : 24) * u;
  const H = (v.kind === 'truck' ? 12 : 10) * u;
  c.save();
  c.translate(v.x, y);
  c.scale(v.dir, 1);
  c.fillStyle = v.kind === 'fork' ? '#d8a020' : v.kind === 'tug' ? '#c85a20' : '#4a5a6a';
  c.fillRect(-L / 2, -H, L, H * 0.7);
  c.fillStyle = '#2a2e34';
  c.fillRect(L * (v.kind === 'truck' ? 0.2 : 0), -H * 1.6, L * 0.3, H * 0.7);
  c.fillStyle = hexA('#a8d0e8', 0.6);
  c.fillRect(L * (v.kind === 'truck' ? 0.22 : 0.03), -H * 1.5, L * 0.24, H * 0.35);
  c.fillStyle = '#14161a';
  for (const wx of [-L * 0.32, L * 0.32]) {
    c.beginPath();
    c.arc(wx, -H * 0.25, H * 0.28, 0, Math.PI * 2);
    c.fill();
  }
  if (v.kind === 'fork') {
    c.fillStyle = '#3a3e44';
    c.fillRect(L / 2, -H * 1.8, 2 * u, H * 1.8);
    c.fillRect(L / 2, -H * 0.3, L * 0.5, 1.5 * u);
    if (v.load) {
      c.fillStyle = '#8a6a3a';
      c.fillRect(L / 2 + 1 * u, -H * 1.1, L * 0.5, H * 0.8);
    }
  }
  if (v.kind === 'truck' && v.load) {
    c.fillStyle = '#6a7078';
    c.beginPath();
    c.moveTo(-L / 2, -H);
    c.lineTo(L * 0.15, -H);
    c.lineTo(L * 0.1, -H * 2.2);
    c.lineTo(-L * 0.45, -H * 1.8);
    c.closePath();
    c.fill();
    c.fillStyle = hexA('#e8c040', 0.8);
    c.fillRect(-L * 0.4, -H * 1.6, L * 0.4, 1.5 * u);
  }
  c.restore();
  c.save();
  c.globalCompositeOperation = 'lighter';
  E.glow(v.x, y - (v.kind === 'truck' ? 1.7 : 1.7) * H, 8 * u, '#ffa020', 0.5 + 0.5 * Math.max(0, Math.sin(t * 6 + v.seed)));
  c.restore();
}
