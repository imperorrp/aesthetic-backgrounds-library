/**
 * Ironhaze's airships, drawn: each toned for its depth (shaded by the hour, faded by the haze).
 *
 * Zeppelins (ribbed envelopes, control cars, engine cars), scouts, the great liners (a long
 * promenade gondola, two decks of windows), ironclad dreadnoughts (turrets, funnels, masts, the
 * keel pods), sky-carriers (a flight deck and an island), sky-galleons (a wooden ship under sail,
 * hung from a long balloon), twin-hulled ships, gunships (rotors on top), haulers (their cargo
 * slung below), rusted hulks (ribs showing, patched balloons, a shanty on deck), fire tenders,
 * junk-rigged traders, balloons; and the fighters that dogfight in a battle.
 */
import { hexA, type Env } from './env';
import { envelope, prop, rigBehind, rigFront, type Tones } from './rig';
import type { Fighter, Ship } from './types';

function tonesOf(E: Env, s: Ship): Tones {
  return {
    hi: E.tone(s.colors[0], s.f, 0.4),
    body: E.tone(s.colors[0], s.f),
    dark: E.tone(s.colors[1], s.f),
    acc: E.tone(s.colors[2], s.f, 0.1),
    glass: E.tone('#1a1a1a', s.f),
  };
}
const hsh = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function rotor(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, col: string) {
  c.fillStyle = hexA(col, 0.22 + 0.12 * Math.sin(t * 30 + x));
  c.beginPath();
  c.ellipse(x, y, r, Math.max(0.6, r * 0.07), 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = hexA(col, 0.5);
  c.lineWidth = Math.max(0.5, r * 0.02);
  const a = (t * 14) % Math.PI;
  c.beginPath();
  c.moveTo(x - Math.cos(a) * r, y);
  c.lineTo(x + Math.cos(a) * r, y);
  c.stroke();
}
/** A ribbed, lit-from-above envelope. */
function bag(E: Env, s: Ship, T: Tones, L: number, Hh: number, x0 = 0, y0 = 0, band = false, patches = false) {
  const c = E.ctx;
  const gr = c.createLinearGradient(0, y0 - Hh / 2, 0, y0 + Hh / 2);
  gr.addColorStop(0, T.hi);
  gr.addColorStop(0.4, T.body);
  gr.addColorStop(1, T.dark);
  envelope(c, L, Hh, x0, y0);
  c.fillStyle = gr;
  c.fill();
  c.save();
  envelope(c, L, Hh, x0, y0);
  c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.14)';
  c.lineWidth = Math.max(0.4, L * 0.002);
  for (let k = -13; k <= 13; k++) {
    c.beginPath();
    c.moveTo(x0 + (k * L) / 27, y0 - Hh);
    c.lineTo(x0 + (k * L) / 27, y0 + Hh);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,250,235,0.1)';
  c.fillRect(x0 - L * 0.45, y0 - Hh * 0.42, L * 0.85, Hh * 0.1);
  if (band) {
    c.fillStyle = T.acc;
    c.fillRect(x0 - L * 0.6, y0 + Hh * 0.05, L * 1.2, Hh * 0.1);
  }
  if (patches) {
    for (let k = 0; k < 5; k++) {
      c.fillStyle = k % 2 ? hexA(T.acc, 0.3) : hexA(T.dark, 0.25);
      c.beginPath();
      c.roundRect(x0 + (hsh(s.seed, k) - 0.5) * L * 0.7, y0 + (hsh(s.seed, k + 9) - 0.55) * Hh * 0.8, L * 0.07, Hh * 0.22, Hh * 0.05);
      c.fill();
    }
  }
  if (s.fire > 0) {
    c.fillStyle = `rgba(20,10,6,${(0.6 * s.fire).toFixed(3)})`;
    c.fillRect(x0 - L * 0.6, y0 - Hh, L * 1.2 * s.fire, Hh * 2);
  }
  c.restore();
}
function fins(c: CanvasRenderingContext2D, T: Tones, L: number, Hh: number, x0 = 0, y0 = 0) {
  c.fillStyle = T.dark;
  c.beginPath();
  c.moveTo(x0 - L * 0.34, y0 - Hh * 0.44);
  c.lineTo(x0 - L * 0.5, y0 - Hh * 0.98);
  c.lineTo(x0 - L * 0.55, y0 - Hh * 0.98);
  c.lineTo(x0 - L * 0.54, y0 - Hh * 0.1);
  c.closePath();
  c.moveTo(x0 - L * 0.34, y0 + Hh * 0.44);
  c.lineTo(x0 - L * 0.5, y0 + Hh * 0.98);
  c.lineTo(x0 - L * 0.55, y0 + Hh * 0.98);
  c.lineTo(x0 - L * 0.54, y0 + Hh * 0.1);
  c.closePath();
  c.fill();
  c.fillStyle = T.acc;
  c.fillRect(x0 - L * 0.55, y0 - Hh * 0.98, L * 0.035, Hh * 0.5);
  c.fillRect(x0 - L * 0.55, y0 + Hh * 0.48, L * 0.035, Hh * 0.5);
}
function lettering(E: Env, s: Ship, T: Tones, text: string, x: number, y: number, px: number) {
  if (px < 5) return;
  const c = E.ctx;
  c.save();
  c.translate(x, y);
  c.scale(s.dir, 1);
  c.fillStyle = hexA(T.dark, 0.55);
  c.font = E.serif(px);
  c.textAlign = 'center';
  c.fillText(text, 0, 0);
  c.restore();
}
function enginePod(c: CanvasRenderingContext2D, T: Tones, x: number, y: number, L: number, Hh: number, t: number, hang: number) {
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(0.5, L * 0.003);
  c.beginPath();
  c.moveTo(x, y - hang);
  c.lineTo(x, y);
  c.stroke();
  c.fillStyle = T.dark;
  c.beginPath();
  c.ellipse(x, y + Hh * 0.04, L * 0.035, Hh * 0.09, 0, 0, Math.PI * 2);
  c.fill();
  prop(c, x - L * 0.04, y + Hh * 0.04, Hh * 0.2, t, T.hi);
}

function zeppelin(E: Env, s: Ship, T: Tones, t: number, scout: boolean) {
  const c = E.ctx;
  const L = s.len;
  const Hh = L * (scout ? 0.24 : 0.19);
  fins(c, T, L, Hh);
  bag(E, s, T, L, Hh, 0, 0, !scout && s.seed % 2 === 0);
  if (!scout && L > 70 * E.u) lettering(E, s, T, s.name, 0, Hh * 0.14, Hh * 0.26);
  c.fillStyle = T.dark;
  c.beginPath();
  c.roundRect(L * 0.1, Hh * 0.46, L * (scout ? 0.22 : 0.18), Hh * (scout ? 0.36 : 0.26), Hh * 0.1);
  c.fill();
  c.fillStyle = T.glass;
  c.fillRect(L * 0.13, Hh * 0.54, L * (scout ? 0.16 : 0.13), Hh * 0.08);
  for (const px of scout ? [-0.12] : [-0.06, -0.24, 0.02]) enginePod(c, T, L * px, Hh * 0.68, L, Hh, t, Hh * 0.22);
  if (scout && (s.state === 'attack' || s.team === 1)) {
    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(0.6, L * 0.012);
    c.beginPath();
    c.moveTo(L * 0.2, Hh * 0.7);
    c.lineTo(L * 0.42, Hh * 0.66);
    c.stroke();
  }
}

/** The great liner: a long sleek hull and, slung under it, two decks of promenade windows. */
function liner(E: Env, s: Ship, T: Tones, t: number) {
  const c = E.ctx;
  const L = s.len;
  const Hh = L * 0.15;
  fins(c, T, L, Hh);
  bag(E, s, T, L, Hh, 0, 0, true);
  lettering(E, s, T, s.name, -L * 0.05, -Hh * 0.08, Hh * 0.3);
  const gx0 = -L * 0.3;
  const gx1 = L * 0.3;
  const gy = Hh * 0.46;
  const gh = Hh * 0.62;
  c.fillStyle = T.body;
  c.beginPath();
  c.moveTo(gx0, gy);
  c.lineTo(gx1, gy);
  c.quadraticCurveTo(gx1 + L * 0.06, gy + gh * 0.4, gx1 - L * 0.02, gy + gh);
  c.lineTo(gx0 + L * 0.03, gy + gh);
  c.quadraticCurveTo(gx0 - L * 0.02, gy + gh * 0.5, gx0, gy);
  c.fill();
  c.fillStyle = T.dark;
  c.fillRect(gx0, gy + gh * 0.48, gx1 - gx0, gh * 0.06);
  c.fillStyle = T.acc;
  c.fillRect(gx0 + L * 0.01, gy + gh * 0.9, gx1 - gx0 - L * 0.03, gh * 0.06);
  c.fillStyle = T.glass;
  for (const row of [0.18, 0.62]) for (let x = gx0 + L * 0.02; x < gx1 - L * 0.02; x += L * 0.018) c.fillRect(x, gy + gh * row, L * 0.011, gh * 0.2);
  c.fillStyle = T.glass;
  c.beginPath();
  c.ellipse(gx1 + L * 0.015, gy + gh * 0.35, L * 0.02, gh * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  for (const px of [-0.4, -0.18, 0.36]) enginePod(c, T, L * px, Hh * 0.62, L, Hh, t, Hh * 0.2);
}

function dreadnought(E: Env, s: Ship, T: Tones, t: number, carrier: boolean) {
  const c = E.ctx;
  const L = s.len;
  const D = L * (carrier ? 0.075 : 0.1);
  const pods = carrier ? 8 : 4;
  for (let k = 0; k < pods; k++) {
    const px = -L * 0.34 + (k / (pods - 1)) * L * 0.62;
    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(0.6, L * 0.006);
    c.beginPath();
    c.moveTo(px, D * 0.8);
    c.lineTo(px - L * 0.015, D * 1.45);
    c.stroke();
    c.fillStyle = T.dark;
    c.beginPath();
    c.ellipse(px - L * 0.015, D * 1.5, L * 0.022, D * 0.14, 0, 0, Math.PI * 2);
    c.fill();
    prop(c, px - L * 0.04, D * 1.5, D * 0.3, t + k, T.hi);
  }
  prop(c, -L * 0.5, D * 0.5, D * 0.7, t, T.hi);
  const hull = () => {
    c.beginPath();
    c.moveTo(-L * 0.47, 0);
    c.lineTo(L * 0.44, 0);
    c.quadraticCurveTo(L * 0.49, D * 0.1, L * 0.53, D * 0.6);
    c.lineTo(L * 0.4, D * 0.92);
    c.lineTo(-L * 0.36, D);
    c.quadraticCurveTo(-L * 0.5, D * 0.85, -L * 0.48, D * 0.15);
    c.closePath();
  };
  const hg = c.createLinearGradient(0, 0, 0, D);
  hg.addColorStop(0, T.hi);
  hg.addColorStop(0.35, T.body);
  hg.addColorStop(1, T.dark);
  hull();
  c.fillStyle = hg;
  c.fill();
  c.save();
  hull();
  c.clip();
  c.fillStyle = T.acc;
  c.fillRect(-L * 0.6, D * 0.72, L * 1.2, D * 0.4);
  c.strokeStyle = 'rgba(0,0,0,0.22)';
  c.lineWidth = Math.max(0.4, L * 0.0015);
  for (const yy of [0.32, 0.6]) {
    c.beginPath();
    c.moveTo(-L * 0.6, D * yy);
    c.lineTo(L * 0.6, D * yy);
    c.stroke();
  }
  for (let k = -9; k <= 9; k++) {
    c.beginPath();
    c.moveTo((k * L) / 19, 0);
    c.lineTo((k * L) / 19, D);
    c.stroke();
  }
  c.fillStyle = T.glass;
  for (let k = 0; k < 24; k++) {
    c.beginPath();
    c.arc(-L * 0.4 + k * L * 0.034, D * 0.2, Math.max(0.5, D * 0.05), 0, Math.PI * 2);
    c.fill();
  }
  if (s.fire > 0) {
    c.fillStyle = `rgba(20,10,6,${(0.55 * s.fire).toFixed(3)})`;
    c.fillRect(-L * 0.6, -D, L * 1.2 * s.fire, D * 3);
  }
  c.restore();
  c.strokeStyle = T.hi;
  c.lineWidth = Math.max(0.4, L * 0.002);
  c.beginPath();
  c.moveTo(-L * 0.47, -D * 0.12);
  c.lineTo(L * 0.44, -D * 0.12);
  c.stroke();
  if (carrier) {
    c.fillStyle = T.body;
    c.fillRect(-L * 0.52, -D * 0.5, L * 1.02, D * 0.45);
    c.fillStyle = T.hi;
    c.fillRect(-L * 0.52, -D * 0.5, L * 1.02, D * 0.08);
    c.fillStyle = T.dark;
    for (let k = 0; k < 9; k++) c.fillRect(-L * 0.45 + k * L * 0.1, -D * 0.38, L * 0.05, D * 0.28);
    const ix = -L * 0.2;
    c.fillStyle = T.body;
    c.fillRect(ix, -D * 2.4, L * 0.12, D * 1.9);
    c.fillRect(ix + L * 0.02, -D * 3.2, L * 0.07, D * 0.8);
    c.fillStyle = T.glass;
    for (let r2 = 0; r2 < 4; r2++) c.fillRect(ix + L * 0.01, -D * 2.2 + r2 * D * 0.4, L * 0.1, D * 0.12);
    for (let k = 0; k < 4; k++) {
      c.fillStyle = T.dark;
      c.fillRect(ix + L * 0.14 + k * L * 0.035, -D * 2.2, L * 0.025, D * 1.7);
      c.fillStyle = T.acc;
      c.fillRect(ix + L * 0.14 + k * L * 0.035, -D * 2.0, L * 0.025, D * 0.15);
    }
    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(0.4, L * 0.0012);
    c.beginPath();
    c.moveTo(ix + L * 0.055, -D * 3.2);
    c.lineTo(ix + L * 0.055, -D * 4.6);
    c.moveTo(ix + L * 0.055, -D * 4.4);
    c.lineTo(L * 0.45, -D * 0.5);
    c.moveTo(ix + L * 0.055, -D * 4.4);
    c.lineTo(-L * 0.5, -D * 0.5);
    c.stroke();
    return;
  }
  superstructure(E, s, T, t, L, D, 3);
}
function superstructure(E: Env, s: Ship, T: Tones, t: number, L: number, D: number, funnels: number) {
  const c = E.ctx;
  c.fillStyle = T.body;
  c.fillRect(-L * 0.16, -D * 0.6, L * 0.32, D * 0.6);
  c.fillStyle = T.hi;
  c.fillRect(-L * 0.16, -D * 0.6, L * 0.32, D * 0.08);
  c.fillStyle = T.body;
  c.fillRect(L * 0.06, -D * 1.5, L * 0.09, D * 0.9);
  c.fillRect(L * 0.08, -D * 2.0, L * 0.05, D * 0.5);
  c.fillStyle = T.glass;
  c.fillRect(L * 0.065, -D * 1.35, L * 0.08, D * 0.14);
  c.fillRect(L * 0.085, -D * 1.9, L * 0.04, D * 0.12);
  for (let k = 0; k < funnels; k++) {
    const fx = -L * 0.02 - k * L * 0.065;
    c.fillStyle = T.dark;
    c.beginPath();
    c.moveTo(fx - L * 0.018, -D * 0.6);
    c.lineTo(fx - L * 0.024, -D * 1.9);
    c.lineTo(fx + L * 0.012, -D * 1.9);
    c.lineTo(fx + L * 0.018, -D * 0.6);
    c.fill();
    c.fillStyle = T.acc;
    c.fillRect(fx - L * 0.024, -D * 1.75, L * 0.036, D * 0.16);
    c.fillStyle = T.hi;
    c.fillRect(fx - L * 0.02, -D * 1.9, L * 0.004, D * 1.25);
  }
  const turret = (x: number, y: number, back: boolean) => {
    c.fillStyle = T.body;
    c.beginPath();
    c.roundRect(x - L * 0.035, y - D * 0.36, L * 0.07, D * 0.36, D * 0.1);
    c.fill();
    c.fillStyle = T.hi;
    c.fillRect(x - L * 0.03, y - D * 0.36, L * 0.06, D * 0.06);
    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(0.6, D * 0.08);
    c.beginPath();
    const d = back ? -1 : 1;
    const recoil = t - s.gun < 0.3 ? -L * 0.01 * d : 0;
    c.moveTo(x + d * L * 0.03, y - D * 0.22);
    c.lineTo(x + d * L * 0.13 + recoil, y - D * 0.28);
    c.moveTo(x + d * L * 0.03, y - D * 0.12);
    c.lineTo(x + d * L * 0.13 + recoil, y - D * 0.17);
    c.stroke();
  };
  turret(L * 0.25, 0, false);
  turret(L * 0.17, -D * 0.6, false);
  turret(-L * 0.3, 0, true);
  turret(-L * 0.22, -D * 0.6, true);
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(0.5, L * 0.003);
  c.beginPath();
  c.moveTo(L * 0.11, -D * 2.0);
  c.lineTo(L * 0.11, -D * 3.2);
  c.moveTo(-L * 0.24, -D * 0.6);
  c.lineTo(-L * 0.24, -D * 2.6);
  c.stroke();
  c.fillStyle = T.dark;
  c.fillRect(L * 0.095, -D * 2.85, L * 0.03, D * 0.2);
  c.lineWidth = Math.max(0.3, L * 0.001);
  c.strokeStyle = hexA(T.dark, 0.6);
  c.beginPath();
  c.moveTo(L * 0.11, -D * 3.2);
  c.lineTo(L * 0.46, -D * 0.05);
  c.moveTo(L * 0.11, -D * 3.2);
  c.lineTo(-L * 0.24, -D * 2.6);
  c.lineTo(-L * 0.47, -D * 0.05);
  c.stroke();
  const wave = Math.sin(t * 4 + s.id) * D * 0.08;
  c.fillStyle = E.tone(s.flag, s.f, 0.1);
  c.beginPath();
  c.moveTo(-L * 0.47, -D * 0.9);
  c.lineTo(-L * 0.53, -D * 0.85 + wave);
  c.lineTo(-L * 0.53, -D * 0.55 + wave);
  c.lineTo(-L * 0.47, -D * 0.6);
  c.fill();
  c.strokeStyle = T.dark;
  c.beginPath();
  c.moveTo(-L * 0.47, 0);
  c.lineTo(-L * 0.47, -D * 0.95);
  c.stroke();
}

/** A sky-galleon: an old ship of the line under full sail, hung from a long balloon. */
function galleon(E: Env, s: Ship, T: Tones, t: number) {
  const c = E.ctx;
  const L = s.len;
  const D = L * 0.12;
  const by = -L * 0.52;
  const wood = E.tone('#5a3a22', s.f, 0.15);
  const woodDk = E.tone('#2e1c10', s.f);
  const sail = E.tone('#d8ccb0', s.f, 0.35);
  // The balloon and its rigging.
  c.strokeStyle = hexA(T.dark, 0.6);
  c.lineWidth = Math.max(0.3, L * 0.0015);
  c.beginPath();
  for (let k = -4; k <= 4; k++) {
    c.moveTo((k * L) / 10, by + L * 0.07);
    c.lineTo((k * L) / 12, -D * 2.6);
  }
  c.stroke();
  bag(E, s, T, L * 0.86, L * 0.14, 0, by);
  // Masts and their square sails, bellied by the wind.
  const masts = [-0.22, 0.02, 0.24];
  masts.forEach((mx, k) => {
    const x = L * mx;
    const top = -D * (k === 1 ? 3.4 : 2.9);
    c.strokeStyle = woodDk;
    c.lineWidth = Math.max(0.6, L * 0.006);
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, top);
    c.stroke();
    for (let q = 0; q < 3; q++) {
      const y0 = top + (q * (-top - D * 0.3)) / 3 + D * 0.15;
      const hgt = (-top - D * 0.4) / 3 - D * 0.1;
      const hw = L * (0.07 - q * -0.012) * (k === 1 ? 1.1 : 1);
      c.fillStyle = sail;
      c.beginPath();
      c.moveTo(x - hw, y0);
      c.lineTo(x + hw, y0);
      c.quadraticCurveTo(x + hw + s.dir * L * 0.0, y0 + hgt * 0.5, x + hw * 1.05, y0 + hgt);
      c.lineTo(x - hw * 1.05, y0 + hgt);
      c.quadraticCurveTo(x - hw + L * 0.02, y0 + hgt * 0.5, x - hw, y0);
      c.fill();
      c.strokeStyle = hexA(woodDk, 0.8);
      c.lineWidth = Math.max(0.4, L * 0.003);
      c.beginPath();
      c.moveTo(x - hw * 1.1, y0);
      c.lineTo(x + hw * 1.1, y0);
      c.stroke();
    }
  });
  c.strokeStyle = hexA(woodDk, 0.6);
  c.lineWidth = Math.max(0.3, L * 0.0012);
  c.beginPath();
  c.moveTo(L * 0.24, -D * 2.9);
  c.lineTo(L * 0.58, -D * 0.4);
  c.moveTo(-L * 0.22, -D * 2.9);
  c.lineTo(-L * 0.48, -D * 0.9);
  c.stroke();
  // The hull: a high stern, a beakhead and bowsprit, two rows of gunports, the stern gallery.
  c.fillStyle = wood;
  c.beginPath();
  c.moveTo(L * 0.42, -D * 0.4);
  c.lineTo(L * 0.6, -D * 0.6);
  c.lineTo(L * 0.44, -D * 0.1);
  c.quadraticCurveTo(L * 0.36, D * 0.9, L * 0.1, D);
  c.lineTo(-L * 0.3, D);
  c.quadraticCurveTo(-L * 0.46, D * 0.6, -L * 0.48, -D * 1.1);
  c.lineTo(-L * 0.36, -D * 1.1);
  c.lineTo(-L * 0.34, -D * 0.5);
  c.lineTo(L * 0.42, -D * 0.4);
  c.fill();
  c.fillStyle = woodDk;
  c.fillRect(-L * 0.46, D * 0.1, L * 0.86, D * 0.12);
  c.fillStyle = T.acc;
  c.fillRect(-L * 0.46, -D * 0.25, L * 0.88, D * 0.1);
  c.fillStyle = woodDk;
  for (const row of [0.28, 0.58]) for (let x = -L * 0.38; x < L * 0.36; x += L * 0.045) c.fillRect(x, D * row, L * 0.018, D * 0.14);
  c.fillStyle = T.glass;
  for (let k = 0; k < 3; k++) c.fillRect(-L * 0.47 + k * L * 0.03, -D * 0.95, L * 0.02, D * 0.3);
  c.strokeStyle = woodDk;
  c.lineWidth = Math.max(0.5, L * 0.004);
  c.beginPath();
  c.moveTo(L * 0.5, -D * 0.5);
  c.lineTo(L * 0.7, -D * 1.1);
  c.stroke();
  prop(c, -L * 0.52, D * 0.2, D * 0.8, t, T.hi);
  const wave = Math.sin(t * 4 + s.id) * D * 0.15;
  c.fillStyle = E.tone(s.flag, s.f, 0.1);
  c.beginPath();
  c.moveTo(L * 0.02, -D * 3.4);
  c.lineTo(L * 0.1, -D * 3.3 + wave);
  c.lineTo(L * 0.02, -D * 3.15);
  c.fill();
}

/** Two hulls abreast, joined by a wing and a bridge between them. */
function twin(E: Env, s: Ship, T: Tones, t: number) {
  const c = E.ctx;
  const L = s.len;
  const Hh = L * 0.12;
  const back = { ...T, hi: E.tone(s.colors[0], Math.max(0.1, s.f - 0.06), 0.25), body: E.tone(s.colors[0], Math.max(0.1, s.f - 0.06)), dark: E.tone(s.colors[1], Math.max(0.1, s.f - 0.06)) };
  fins(c, back, L * 0.92, Hh, L * 0.05, -L * 0.1);
  bag(E, s, back, L * 0.92, Hh, L * 0.05, -L * 0.1);
  c.fillStyle = T.dark;
  c.beginPath();
  c.moveTo(-L * 0.16, -L * 0.06);
  c.lineTo(L * 0.2, -L * 0.06);
  c.lineTo(L * 0.14, L * 0.02);
  c.lineTo(-L * 0.12, L * 0.02);
  c.fill();
  c.fillStyle = T.body;
  c.beginPath();
  c.roundRect(-L * 0.06, Hh * 0.2, L * 0.16, Hh * 0.7, Hh * 0.2);
  c.fill();
  c.fillStyle = T.glass;
  c.fillRect(-L * 0.04, Hh * 0.4, L * 0.12, Hh * 0.14);
  fins(c, T, L, Hh);
  bag(E, s, T, L, Hh, 0, 0, true);
  lettering(E, s, T, s.name, -L * 0.1, Hh * 0.12, Hh * 0.32);
  for (const px of [-0.3, 0.28]) {
    c.fillStyle = T.dark;
    c.beginPath();
    c.ellipse(L * px, -L * 0.03, L * 0.04, Hh * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    prop(c, L * px - L * 0.05, -L * 0.03, Hh * 0.4, t + px, T.hi);
  }
}

/** A gunship: an armoured hull under two rotors, a gun turret under its chin. */
function gunship(E: Env, s: Ship, T: Tones, t: number) {
  const c = E.ctx;
  const L = s.len;
  const H = L * 0.24;
  for (const rx of [-0.22, 0.2]) {
    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(0.6, L * 0.012);
    c.beginPath();
    c.moveTo(L * rx, -H * 0.4);
    c.lineTo(L * rx, -H * 0.85);
    c.stroke();
    rotor(c, L * rx, -H * 0.88, L * 0.3, t, T.hi);
  }
  const body = () => {
    c.beginPath();
    c.moveTo(L * 0.42, -H * 0.05);
    c.quadraticCurveTo(L * 0.4, -H * 0.5, L * 0.1, -H * 0.5);
    c.lineTo(-L * 0.36, -H * 0.42);
    c.lineTo(-L * 0.5, -H * 0.15);
    c.lineTo(-L * 0.46, H * 0.12);
    c.lineTo(L * 0.2, H * 0.4);
    c.quadraticCurveTo(L * 0.42, H * 0.3, L * 0.42, -H * 0.05);
    c.closePath();
  };
  const gr = c.createLinearGradient(0, -H * 0.5, 0, H * 0.4);
  gr.addColorStop(0, T.hi);
  gr.addColorStop(0.4, T.body);
  gr.addColorStop(1, T.dark);
  body();
  c.fillStyle = gr;
  c.fill();
  c.save();
  body();
  c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.25)';
  c.lineWidth = Math.max(0.4, L * 0.004);
  for (let k = -4; k <= 4; k++) {
    c.beginPath();
    c.moveTo((k * L) / 9, -H);
    c.lineTo((k * L) / 9 + L * 0.03, H);
    c.stroke();
  }
  c.fillStyle = T.acc;
  c.fillRect(-L * 0.6, H * 0.02, L * 1.2, H * 0.08);
  c.restore();
  c.fillStyle = T.glass;
  c.beginPath();
  c.moveTo(L * 0.3, -H * 0.35);
  c.quadraticCurveTo(L * 0.4, -H * 0.3, L * 0.4, -H * 0.08);
  c.lineTo(L * 0.26, -H * 0.1);
  c.fill();
  c.fillStyle = T.dark;
  c.beginPath();
  c.arc(L * 0.22, H * 0.38, H * 0.14, 0, Math.PI);
  c.fill();
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(0.6, H * 0.06);
  c.beginPath();
  c.moveTo(L * 0.22, H * 0.44);
  c.lineTo(L * 0.46, H * 0.5);
  c.moveTo(L * 0.22, H * 0.48);
  c.lineTo(L * 0.44, H * 0.56);
  c.stroke();
  c.fillStyle = T.dark;
  c.fillRect(-L * 0.1, -H * 0.05, L * 0.3, H * 0.1);
  prop(c, -L * 0.52, -H * 0.12, H * 0.42, t, T.hi);
}

/** A hauler: a fat envelope, a keel frame, and its cargo swinging on the cables below. */
function hauler(E: Env, s: Ship, T: Tones, t: number) {
  const c = E.ctx;
  const L = s.len;
  const Hh = L * 0.27;
  fins(c, T, L, Hh);
  bag(E, s, T, L, Hh, 0, 0, false, true);
  lettering(E, s, T, s.name, 0, Hh * 0.08, Hh * 0.2);
  const ky = Hh * 0.5;
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(0.5, L * 0.004);
  c.beginPath();
  c.moveTo(-L * 0.32, ky);
  c.lineTo(L * 0.28, ky);
  c.moveTo(-L * 0.32, ky + Hh * 0.08);
  c.lineTo(L * 0.28, ky + Hh * 0.08);
  for (let x = -L * 0.32; x < L * 0.28; x += Hh * 0.08) {
    c.moveTo(x, ky + Hh * 0.08);
    c.lineTo(x + Hh * 0.04, ky);
  }
  c.stroke();
  const cols = ['#7a3a22', '#3a5a3a', '#5a5a5a', '#8a6a2a'];
  for (let k = 0; k < 4; k++) {
    const cx = -L * 0.24 + k * L * 0.14;
    const sw = Math.sin(t * 0.8 + k) * L * 0.006;
    const cy = ky + Hh * 0.08 + Hh * 0.28;
    c.strokeStyle = hexA(T.dark, 0.8);
    c.lineWidth = Math.max(0.3, L * 0.0015);
    c.beginPath();
    c.moveTo(cx - L * 0.03, ky + Hh * 0.08);
    c.lineTo(cx - L * 0.03 + sw, cy);
    c.moveTo(cx + L * 0.03, ky + Hh * 0.08);
    c.lineTo(cx + L * 0.03 + sw, cy);
    c.stroke();
    c.fillStyle = E.tone(cols[(k + s.seed) % 4], s.f, 0.1);
    c.fillRect(cx - L * 0.05 + sw, cy, L * 0.1, Hh * 0.22);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (let q = 1; q < 5; q++) c.fillRect(cx - L * 0.05 + sw + q * L * 0.02, cy, Math.max(0.4, L * 0.002), Hh * 0.22);
  }
  c.fillStyle = T.dark;
  c.beginPath();
  c.roundRect(L * 0.3, ky - Hh * 0.04, L * 0.12, Hh * 0.22, Hh * 0.06);
  c.fill();
  c.fillStyle = T.glass;
  c.fillRect(L * 0.32, ky + Hh * 0.02, L * 0.08, Hh * 0.07);
  for (const px of [-0.4, 0.38]) enginePod(c, T, L * px, Hh * 0.55, L, Hh, t, Hh * 0.1);
}

/** A rusted hulk: ribs showing, patched balloons, a shanty town on its deck. */
function hulk(E: Env, s: Ship, T: Tones, t: number) {
  const c = E.ctx;
  const L = s.len;
  const D = L * 0.12;
  bag(E, s, T, L * 0.5, L * 0.16, -L * 0.18, -L * 0.42, false, true);
  bag(E, s, { ...T, body: T.acc, hi: E.tone(s.colors[2], s.f, 0.4) }, L * 0.38, L * 0.14, L * 0.22, -L * 0.38, false, true);
  c.strokeStyle = hexA(T.dark, 0.7);
  c.lineWidth = Math.max(0.3, L * 0.0015);
  c.beginPath();
  for (let k = -4; k <= 4; k++) {
    c.moveTo((k * L) / 10, -L * 0.33);
    c.lineTo((k * L) / 11, -D * 0.6);
  }
  c.stroke();
  // The ribs of the hull, and what plating is left.
  const hullTop = -D * 0.2;
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(0.6, L * 0.006);
  c.beginPath();
  c.moveTo(-L * 0.46, hullTop);
  c.lineTo(L * 0.46, hullTop);
  c.quadraticCurveTo(L * 0.4, D, 0, D * 1.05);
  c.quadraticCurveTo(-L * 0.4, D, -L * 0.46, hullTop);
  c.stroke();
  c.lineWidth = Math.max(0.4, L * 0.004);
  for (let k = -9; k <= 9; k++) {
    const x = (k * L) / 20;
    const bot = D * (1.05 - Math.pow(k / 10, 2) * 0.9);
    c.beginPath();
    c.moveTo(x, hullTop);
    c.lineTo(x, bot);
    c.stroke();
  }
  for (let k = 0; k < 9; k++) {
    const x = (hsh(s.seed, k) - 0.5) * L * 0.8;
    const w = L * (0.05 + hsh(s.seed, k + 3) * 0.1);
    c.fillStyle = k % 3 ? T.body : T.acc;
    c.fillRect(x, hullTop + D * hsh(s.seed, k + 7) * 0.4, w, D * 0.35);
  }
  // The shanty on deck.
  for (let k = 0; k < 6; k++) {
    const x = -L * 0.36 + k * L * 0.13 + hsh(s.seed, k + 20) * L * 0.04;
    const h = D * (0.5 + hsh(s.seed, k + 30) * 1.1);
    c.fillStyle = k % 2 ? T.body : T.dark;
    c.fillRect(x, hullTop - h, L * 0.09, h);
    c.fillStyle = T.glass;
    c.fillRect(x + L * 0.02, hullTop - h * 0.7, L * 0.025, h * 0.3);
  }
  c.fillStyle = T.dark;
  c.fillRect(L * 0.06, hullTop - D * 2.4, L * 0.025, D * 2.4);
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(0.4, L * 0.003);
  c.beginPath();
  c.moveTo(-L * 0.3, hullTop);
  c.lineTo(-L * 0.3, hullTop - D * 2);
  c.lineTo(-L * 0.12, hullTop - D * 1.6);
  c.stroke();
  prop(c, -L * 0.5, D * 0.3, D * 0.7, t, T.hi);
}

/** A fire tender: a short red envelope over a water tank, its cannon pointing down. */
function tender(E: Env, s: Ship, T: Tones, t: number) {
  const c = E.ctx;
  const L = s.len;
  const Hh = L * 0.26;
  fins(c, T, L, Hh);
  bag(E, s, T, L, Hh, 0, 0, true);
  c.fillStyle = T.acc;
  for (const bx of [-0.2, 0.1]) c.fillRect(L * bx, -Hh * 0.5, L * 0.025, Hh);
  const ty = Hh * 0.55;
  c.fillStyle = T.body;
  c.beginPath();
  c.roundRect(-L * 0.25, ty, L * 0.5, Hh * 0.38, Hh * 0.18);
  c.fill();
  c.fillStyle = T.acc;
  c.fillRect(-L * 0.25, ty + Hh * 0.15, L * 0.5, Hh * 0.05);
  c.strokeStyle = T.dark;
  c.lineWidth = Math.max(0.6, Hh * 0.08);
  c.beginPath();
  c.moveTo(L * 0.2, ty + Hh * 0.3);
  c.lineTo(L * 0.32, ty + Hh * 0.62);
  c.stroke();
  lettering(E, s, T, s.name, 0, Hh * 0.1, Hh * 0.18);
  enginePod(c, T, -L * 0.36, Hh * 0.55, L, Hh, t, Hh * 0.1);
}

function junk(E: Env, s: Ship, T: Tones) {
  const c = E.ctx;
  const L = s.len;
  const D = L * 0.13;
  const by = -L * 0.42;
  const env = E.tone('#b9a47e', s.f, 0.3);
  const gr = c.createLinearGradient(0, by - L * 0.17, 0, by + L * 0.17);
  gr.addColorStop(0, E.tone('#d8c49c', s.f, 0.5));
  gr.addColorStop(0.5, env);
  gr.addColorStop(1, E.tone('#6a5a44', s.f));
  c.strokeStyle = hexA(T.dark, 0.7);
  c.lineWidth = Math.max(0.4, L * 0.003);
  c.beginPath();
  for (let k = -3; k <= 3; k++) {
    c.moveTo((k * L) / 9, by + L * 0.14);
    c.lineTo((k * L) / 11, -D * 0.4);
  }
  c.stroke();
  c.fillStyle = gr;
  c.beginPath();
  c.ellipse(0, by, L * 0.38, L * 0.17, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.ellipse(0, by, L * 0.38, L * 0.17, 0, 0, Math.PI * 2);
  c.clip();
  c.strokeStyle = 'rgba(40,28,18,0.3)';
  c.lineWidth = Math.max(0.4, L * 0.002);
  for (let k = -L; k < L; k += L * 0.05) {
    c.beginPath();
    c.moveTo(k, by - L * 0.2);
    c.lineTo(k + L * 0.3, by + L * 0.2);
    c.moveTo(k, by + L * 0.2);
    c.lineTo(k + L * 0.3, by - L * 0.2);
    c.stroke();
  }
  c.restore();
  for (const [mx, sc] of [[-L * 0.12, 1], [L * 0.16, 0.8]] as [number, number][]) {
    const top = -D * 2.6 * sc;
    c.fillStyle = T.acc;
    c.beginPath();
    c.moveTo(mx, -D * 0.3);
    c.lineTo(mx - L * 0.14 * sc, -D * 0.4);
    c.quadraticCurveTo(mx - L * 0.2 * sc, top * 0.6, mx - L * 0.1 * sc, top);
    c.lineTo(mx + L * 0.02, top - D * 0.2);
    c.closePath();
    c.fill();
    c.strokeStyle = hexA(T.dark, 0.7);
    c.lineWidth = Math.max(0.4, L * 0.003);
    for (let k = 1; k < 6; k++) {
      const yy = -D * 0.3 + ((top + D * 0.3) * k) / 6;
      c.beginPath();
      c.moveTo(mx, yy);
      c.lineTo(mx - L * (0.15 + 0.04 * Math.sin((k / 6) * Math.PI)) * sc, yy + D * 0.1);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(mx, -D * 0.2);
    c.lineTo(mx, top - D * 0.3);
    c.stroke();
  }
  c.fillStyle = T.dark;
  c.beginPath();
  c.moveTo(L * 0.46, -D * 0.5);
  c.quadraticCurveTo(L * 0.32, D, 0, D);
  c.quadraticCurveTo(-L * 0.34, D, -L * 0.46, -D * 0.9);
  c.lineTo(-L * 0.3, -D * 0.7);
  c.lineTo(-L * 0.28, -D * 0.2);
  c.lineTo(L * 0.46, -D * 0.5);
  c.fill();
  c.strokeStyle = hexA(T.hi, 0.35);
  c.lineWidth = Math.max(0.3, L * 0.002);
  for (let k = 1; k < 4; k++) {
    c.beginPath();
    c.moveTo(-L * 0.4, -D * 0.2 + k * D * 0.25);
    c.quadraticCurveTo(0, k * D * 0.28 + D * 0.1, L * 0.4, -D * 0.3 + k * D * 0.2);
    c.stroke();
  }
  c.fillStyle = T.acc;
  c.fillRect(-L * 0.44, -D * 0.95, L * 0.12, D * 0.12);
}
function balloonShip(E: Env, s: Ship, T: Tones) {
  const c = E.ctx;
  const r = s.len * 0.5;
  c.strokeStyle = hexA(T.dark, 0.7);
  c.lineWidth = Math.max(0.3, r * 0.03);
  c.beginPath();
  c.moveTo(-r * 0.55, r * 0.6);
  c.lineTo(-r * 0.25, r * 1.5);
  c.moveTo(r * 0.55, r * 0.6);
  c.lineTo(r * 0.25, r * 1.5);
  c.stroke();
  c.fillStyle = T.dark;
  c.fillRect(-r * 0.28, r * 1.5, r * 0.56, r * 0.4);
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.clip();
  for (let k = -4; k <= 4; k++) {
    c.fillStyle = k % 2 ? T.body : E.tone(s.colors[1], s.f, 0.2);
    c.fillRect((k - 0.5) * r * 0.25, -r, r * 0.25, r * 2);
  }
  const sh = c.createLinearGradient(-r, 0, r, 0);
  sh.addColorStop(0, 'rgba(255,240,210,0.15)');
  sh.addColorStop(1, 'rgba(0,0,0,0.35)');
  c.fillStyle = sh;
  c.fillRect(-r, -r, r * 2, r * 2);
  c.restore();
}

export function drawShip(E: Env, s: Ship, t: number) {
  const c = E.ctx;
  const T = tonesOf(E, s);
  c.save();
  c.translate(s.x, s.y + Math.sin(s.bob * 0.8) * s.len * 0.004);
  c.rotate(s.tilt);
  c.scale(s.dir, 1);
  const rigged = s.kind !== 'balloon' && s.kind !== 'carrier';
  if (rigged) rigBehind(E, s, T, t);
  switch (s.kind) {
    case 'zeppelin':
    case 'scout':
      zeppelin(E, s, T, t, s.kind === 'scout');
      break;
    case 'dreadnought':
    case 'carrier':
      dreadnought(E, s, T, t, s.kind === 'carrier');
      break;
    case 'liner':
      liner(E, s, T, t);
      break;
    case 'galleon':
      galleon(E, s, T, t);
      break;
    case 'twin':
      twin(E, s, T, t);
      break;
    case 'gunship':
      gunship(E, s, T, t);
      break;
    case 'hauler':
      hauler(E, s, T, t);
      break;
    case 'hulk':
      hulk(E, s, T, t);
      break;
    case 'tender':
      tender(E, s, T, t);
      break;
    case 'junk':
      junk(E, s, T);
      break;
    default:
      balloonShip(E, s, T);
  }
  if (rigged) rigFront(E, s, T, t);
  c.restore();
  shipLights(E, s, t);
}

/** Windows, running lights, the searchlight, and fire. */
function shipLights(E: Env, s: Ship, t: number) {
  const c = E.ctx;
  const night = E.night();
  const hz = E.hazeOf(s.f);
  const a = (1 - hz * 0.6) * Math.max(night, s.fire);
  if (a < 0.03 && E.world.t - s.horn > 1.5) return;
  const L = s.len;
  c.save();
  c.globalCompositeOperation = 'lighter';
  if (night > 0.05) {
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.tilt);
    c.scale(s.dir, 1);
    c.fillStyle = hexA('#ffc878', 0.85 * night * (1 - hz * 0.6));
    if (s.kind === 'zeppelin' || s.kind === 'scout') {
      const Hh = L * (s.kind === 'scout' ? 0.24 : 0.19);
      c.fillRect(L * 0.13, Hh * 0.54, L * (s.kind === 'scout' ? 0.16 : 0.13), Hh * 0.08);
    } else if (s.kind === 'liner') {
      const Hh = L * 0.15;
      const gy = Hh * 0.46;
      const gh = Hh * 0.62;
      for (const row of [0.18, 0.62]) for (let x = -L * 0.28; x < L * 0.28; x += L * 0.018) if (hsh(s.seed, x) < 0.8) c.fillRect(x, gy + gh * row, L * 0.011, gh * 0.2);
    } else if (s.kind === 'dreadnought' || s.kind === 'carrier') {
      const D = L * (s.kind === 'carrier' ? 0.075 : 0.1);
      for (let k = 0; k < 24; k++) if (hsh(s.id, k) < 0.7) c.fillRect(-L * 0.4 + k * L * 0.034 - D * 0.04, D * 0.16, D * 0.08, D * 0.08);
      if (s.kind === 'carrier') for (let k = 0; k < 9; k++) c.fillRect(-L * 0.45 + k * L * 0.1, -D * 0.36, L * 0.05, D * 0.22);
    } else if (s.kind === 'galleon') {
      const D = L * 0.12;
      for (let k = 0; k < 3; k++) c.fillRect(-L * 0.47 + k * L * 0.03, -D * 0.95, L * 0.02, D * 0.3);
      E.glow(-L * 0.48, -D * 1.2, L * 0.05, '#ffb050', 0.8 * night);
    } else if (s.kind === 'hauler' || s.kind === 'tender' || s.kind === 'twin') {
      c.fillRect(-L * 0.04, L * 0.04, L * 0.12, L * 0.02);
    } else if (s.kind === 'hulk') {
      for (let k = 0; k < 6; k++) if (hsh(s.seed, k) < 0.7) c.fillRect(-L * 0.34 + k * L * 0.13, -L * 0.05, L * 0.025, L * 0.02);
    } else if (s.kind === 'junk') {
      E.glow(-L * 0.44, -L * 0.13, L * 0.06, '#ffb050', 0.8 * night);
    }
    c.restore();
    const blink = Math.floor(t * 1.4 + s.id) % 2 === 0;
    E.glow(s.x + s.dir * L * 0.45, s.y + L * 0.03, L * 0.04 + 4 * E.u, '#ff4030', night * (blink ? 0.9 : 0.4) * (1 - hz * 0.6));
    E.glow(s.x - s.dir * L * 0.48, s.y, L * 0.03 + 3 * E.u, '#50e090', night * 0.6 * (1 - hz * 0.6));
    if (s.search && night > 0.3 && s.f > 0.35 && s.kind !== 'balloon') {
      const ox = s.x + s.dir * L * 0.18;
      const oy = s.y + L * 0.12;
      const ang = Math.PI / 2 + s.dir * (0.3 + Math.sin(t * 0.25 + s.id) * 0.45);
      const len = E.world.GH * 0.7 * E.world.m(s.f);
      const sp = 0.06;
      const lg = c.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
      lg.addColorStop(0, hexA('#fff1d0', 0.22 * night * (1 - hz * 0.7)));
      lg.addColorStop(1, hexA('#fff1d0', 0));
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(ox, oy);
      c.lineTo(ox + Math.cos(ang - sp) * len, oy + Math.sin(ang - sp) * len);
      c.lineTo(ox + Math.cos(ang + sp) * len, oy + Math.sin(ang + sp) * len);
      c.fill();
      E.glow(ox, oy, 8 * E.u * E.world.m(s.f), '#fff1d0', 0.8 * night);
    }
  }
  if (s.fire > 0) {
    for (let k = 0; k < 10; k++) {
      const x = s.x + (hsh(s.id, k) - 0.5) * L * 0.9 * s.fire;
      const fl = (0.6 + 0.4 * Math.sin(t * 11 + k * 2.1)) * s.fire;
      const y = s.y - L * 0.08;
      c.fillStyle = k % 2 ? 'rgba(251,146,60,0.75)' : 'rgba(253,224,71,0.65)';
      c.beginPath();
      c.moveTo(x - L * 0.025, y);
      c.quadraticCurveTo(x + Math.sin(t * 7 + k) * L * 0.02, y - L * 0.12 * fl, x + L * 0.025, y);
      c.fill();
    }
    E.glow(s.x, s.y, L * 0.5, '#ff7a20', 0.5 * s.fire);
  }
  if (E.world.t - s.horn < 1.5) E.glow(s.x, s.y, L * 0.3, '#fff1d0', 0.4 * (1 - (E.world.t - s.horn) / 1.5));
  c.restore();
}

/** A fighter: a little biplane, its prop a blur, turning to its heading. */
export function drawFighter(E: Env, fi: Fighter, t: number) {
  const c = E.ctx;
  const L = 24 * E.u * E.world.m(fi.f);
  const body = E.tone(fi.team ? '#2a2a2a' : '#7a3a2a', fi.f, 0.2);
  const wing = E.tone(fi.team ? '#4a4a48' : '#b8a888', fi.f, 0.3);
  const a = Math.atan2(fi.vy, fi.vx);
  c.save();
  c.translate(fi.x, fi.y);
  c.rotate(a);
  if (Math.abs(a) > Math.PI / 2) c.scale(1, -1);
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(L * 0.5, 0);
  c.quadraticCurveTo(L * 0.3, -L * 0.12, -L * 0.4, -L * 0.04);
  c.lineTo(-L * 0.5, -L * 0.2);
  c.lineTo(-L * 0.52, L * 0.04);
  c.quadraticCurveTo(L * 0.3, L * 0.12, L * 0.5, 0);
  c.fill();
  c.fillStyle = wing;
  c.fillRect(-L * 0.05, -L * 0.22, L * 0.24, L * 0.06);
  c.fillRect(-L * 0.08, L * 0.1, L * 0.26, L * 0.06);
  c.strokeStyle = body;
  c.lineWidth = Math.max(0.3, L * 0.03);
  c.beginPath();
  c.moveTo(L * 0.05, -L * 0.18);
  c.lineTo(L * 0.05, L * 0.12);
  c.stroke();
  c.fillStyle = hexA(wing, 0.35 + 0.2 * Math.sin(t * 50));
  c.beginPath();
  c.ellipse(L * 0.52, 0, L * 0.03, L * 0.2, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
