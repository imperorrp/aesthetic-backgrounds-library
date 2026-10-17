/**
 * What is hung on an airship, bolted to her and trailing behind her (see ./design for which she has),
 * drawn in her own frame (+x her bow): nacelles on their struts with their propellers turning (seen
 * edge-on, the blades flicker long and short), ducted fans, pusher screws; an open engine car with
 * its pistons pumping, its flywheel and crank turning; gear housings; copper pipe runs with valves
 * and a gauge whose needle trembles; boiler exhausts; gas cells and a lattice nose; a dorsal walkway
 * and a gun turret; an aerial; an advertising banner, or a hoist of signal flags; an observation
 * basket on its cable; the anchor, the rope ladder when she is moored; paddle wheels; a deck crane
 * with its hydraulic ram and a crate swinging.
 */
import { designOf, dimsOf, hsh, stacksOf } from './design';
import { hexA, type Env } from './env';
import type { Ship } from './types';

export type Tones = { hi: string; body: string; dark: string; acc: string; glass: string };

export function envelope(c: CanvasRenderingContext2D, L: number, Hh: number, x0 = 0, y0 = 0) {
  c.beginPath();
  c.moveTo(x0 + L * 0.5, y0);
  c.bezierCurveTo(x0 + L * 0.5, y0 - Hh * 0.58, x0 + L * 0.36, y0 - Hh * 0.5, x0 + L * 0.2, y0 - Hh * 0.5);
  c.lineTo(x0 - L * 0.25, y0 - Hh * 0.5);
  c.bezierCurveTo(x0 - L * 0.42, y0 - Hh * 0.5, x0 - L * 0.5, y0 - Hh * 0.18, x0 - L * 0.54, y0);
  c.bezierCurveTo(x0 - L * 0.5, y0 + Hh * 0.18, x0 - L * 0.42, y0 + Hh * 0.5, x0 - L * 0.25, y0 + Hh * 0.5);
  c.lineTo(x0 + L * 0.2, y0 + Hh * 0.5);
  c.bezierCurveTo(x0 + L * 0.36, y0 + Hh * 0.5, x0 + L * 0.5, y0 + Hh * 0.58, x0 + L * 0.5, y0);
  c.closePath();
}

/** A propeller seen from the side: a faint disc, and its blades flickering long and short as they turn. */
export function prop(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, col: string, blades = 3) {
  c.fillStyle = hexA(col, 0.13);
  c.beginPath();
  c.ellipse(x, y, Math.max(0.6, r * 0.12), r, 0, 0, Math.PI * 2);
  c.fill();
  const a = t * 7.3 + x * 0.37;
  c.strokeStyle = hexA(col, 0.8);
  c.lineCap = 'round';
  c.lineWidth = Math.max(0.6, r * 0.17);
  c.beginPath();
  for (let k = 0; k < blades; k++) {
    const yy = Math.cos(a + (k * Math.PI * 2) / blades) * r;
    c.moveTo(x, y);
    c.lineTo(x + Math.sin(a + k) * r * 0.05, y + yy);
  }
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, Math.max(0.5, r * 0.14), 0, Math.PI * 2);
  c.fill();
}

/** A toothed wheel. */
export function gear(c: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, a: number, col: string, hub: string) {
  c.fillStyle = col;
  c.beginPath();
  for (let k = 0; k < teeth; k++) {
    const a0 = a + (k / teeth) * Math.PI * 2;
    const a1 = a + ((k + 0.5) / teeth) * Math.PI * 2;
    c.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    c.lineTo(x + Math.cos(a0 + 0.08) * r * 1.16, y + Math.sin(a0 + 0.08) * r * 1.16);
    c.lineTo(x + Math.cos(a1 - 0.08) * r * 1.16, y + Math.sin(a1 - 0.08) * r * 1.16);
    c.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
  }
  c.closePath();
  c.fill();
  c.fillStyle = hub;
  c.beginPath();
  c.arc(x, y, r * 0.62, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = Math.max(0.4, r * 0.14);
  c.beginPath();
  for (let k = 0; k < 4; k++) {
    const q = a + (k * Math.PI) / 2;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(q) * r * 0.62, y + Math.sin(q) * r * 0.62);
  }
  c.stroke();
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, r * 0.18, 0, Math.PI * 2);
  c.fill();
}

/** A gear and its mate, meshed (the second turns the other way, slower or faster by their sizes). */
export function gearPair(c: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, ang: number, a: number, col: string, hub: string) {
  const d = (r1 + r2) * 1.08;
  const t1 = Math.max(6, Math.round(r1 * 1.4));
  const t2 = Math.max(6, Math.round((t1 * r2) / r1));
  gear(c, x, y, r1, t1, a, col, hub);
  gear(c, x + Math.cos(ang) * d, y + Math.sin(ang) * d, r2, t2, (-a * r1) / r2 + Math.PI / t2, col, hub);
}

/** A piston: its cylinder fixed above, its rod pumping down out of it. */
export function piston(c: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, ph: number, body: string, rod: string, hi: string) {
  const ext = len * (0.55 + 0.45 * Math.sin(ph));
  c.fillStyle = rod;
  c.fillRect(x - w * 0.16, y + len * 0.5, w * 0.32, ext);
  c.fillStyle = body;
  c.fillRect(x - w / 2, y, w, len * 0.6);
  c.fillStyle = hi;
  c.fillRect(x - w / 2, y, w * 0.25, len * 0.6);
  c.fillStyle = body;
  c.fillRect(x - w * 0.62, y - w * 0.12, w * 1.24, w * 0.24);
  c.fillRect(x - w * 0.62, y + len * 0.56, w * 1.24, w * 0.2);
  c.fillRect(x - w * 0.3, y + len * 0.5 + ext - w * 0.1, w * 0.6, w * 0.3);
}

/** Text the right way round whichever way she faces. */
function flatText(E: Env, s: Ship, text: string, x: number, y: number, px: number, color: string, italic = false) {
  if (px < 4.5) return;
  const c = E.ctx;
  c.save();
  c.translate(x, y);
  c.scale(s.dir, 1);
  c.fillStyle = color;
  c.font = E.serif(px, italic);
  c.textAlign = 'center';
  c.fillText(text, 0, 0);
  c.restore();
}

const COPPER = '#a0603a';
const BRASS = '#b8913e';

/** What is behind her body: the banner she tows, her signal hoist, struts, the aerial's wires, the basket's cable. */
export function rigBehind(E: Env, s: Ship, T: Tones, t: number) {
  const d = designOf(s);
  const c = E.ctx;
  const L = s.len;
  const D = dimsOf(s.kind, L);
  const lw = Math.max(0.3, L * 0.0016);
  const envBot = D.env ? D.env.y + D.env.h * 0.5 : D.gTop;
  const envTop = D.env ? D.env.y - D.env.h * 0.5 : D.gTop;
  if (d.banner && L > 50 * E.u) {
    // Towed on two lines from the tail: a long ribbon, rippling, with the words on it.
    const bx = D.env ? D.env.x - D.env.l * 0.54 - L * 0.07 : -L * 0.56;
    const by = (D.env ? D.env.y : D.gTop) + L * 0.02;
    const bl = L * 0.8;
    const bh = Math.max(L * 0.055, 6 * E.u);
    const wav = (x: number) => Math.sin(t * 3.2 - x / (L * 0.12) + s.id) * bh * 0.22 * Math.min(1, (bx - x) / (L * 0.3));
    c.strokeStyle = hexA(T.dark, 0.95);
    c.lineWidth = Math.max(0.6, lw * 1.5);
    c.beginPath();
    c.moveTo(-L * 0.5, (D.env ? D.env.y : D.gTop) + L * 0.005);
    c.lineTo(bx, by);
    c.moveTo(-L * 0.5, (D.env ? D.env.y : D.gTop) + L * 0.02);
    c.lineTo(bx, by + bh);
    c.stroke();
    const cream = E.tone('#e8dcc0', s.f, 0.35);
    c.fillStyle = cream;
    c.beginPath();
    c.moveTo(bx, by + wav(bx));
    for (let x = bx; x >= bx - bl; x -= bl / 20) c.lineTo(x, by + wav(x));
    // The tail of it: a swallowtail.
    c.lineTo(bx - bl - bh * 0.6, by + bh * 0.5 + wav(bx - bl));
    for (let x = bx - bl; x <= bx; x += bl / 20) c.lineTo(x, by + bh + wav(x));
    c.closePath();
    c.fill();
    c.fillStyle = hexA(E.tone('#7f1d1d', s.f, 0.1), 0.85);
    c.fillRect(bx - bl * 0.02, by + wav(bx) - 0.5, bl * 0.02, bh + 1);
    const px = Math.min(bh * 0.66, (bl * 1.7) / Math.max(8, d.banner.length));
    flatText(E, s, d.banner, bx - bl / 2, by + bh * 0.5 + px * 0.34 + wav(bx - bl / 2), px, E.tone('#5a1410', s.f, 0.05));
  }
  if (d.flags && L > 60 * E.u) {
    const top: [number, number] = s.kind === 'dreadnought' ? [L * 0.11, -L * 0.32] : s.kind === 'galleon' ? [L * 0.02, -L * 0.41] : [L * 0.1, envTop - L * 0.05];
    const ends: [number, number][] = [[L * 0.47, D.gTop - L * 0.01], [-L * 0.46, D.gTop - L * 0.02]];
    const cols = ['#b91c1c', '#e7e5e4', '#1e3a8a', '#d4a017', '#14532d', '#111111'];
    for (const [ex, ey] of ends) {
      c.strokeStyle = hexA(T.dark, 0.6);
      c.lineWidth = lw * 0.8;
      c.beginPath();
      c.moveTo(top[0], top[1]);
      c.lineTo(ex, ey);
      c.stroke();
      const n = 9;
      for (let k = 1; k < n; k++) {
        const q = k / n;
        const x = top[0] + (ex - top[0]) * q;
        const y = top[1] + (ey - top[1]) * q + Math.sin(q * Math.PI) * L * 0.01;
        const fs = L * 0.012;
        c.fillStyle = E.tone(cols[Math.floor(hsh(s.seed, k + ex) * cols.length)], s.f, 0.25);
        c.beginPath();
        c.moveTo(x - fs, y);
        c.lineTo(x + fs, y);
        c.lineTo(x + Math.sin(t * 5 + k) * fs * 0.3, y + fs * 2.2);
        c.fill();
      }
    }
  }
  if (d.aerial && D.env) {
    const ax = L * 0.1;
    c.strokeStyle = hexA(T.dark, 0.75);
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(ax, envTop + L * 0.004);
    c.lineTo(ax, envTop - L * 0.07);
    c.moveTo(ax, envTop - L * 0.065);
    c.lineTo(L * 0.42, envTop + D.env.h * 0.12);
    c.moveTo(ax, envTop - L * 0.065);
    c.lineTo(-L * 0.4, envTop + D.env.h * 0.06);
    c.moveTo(ax - L * 0.012, envTop - L * 0.05);
    c.lineTo(ax + L * 0.012, envTop - L * 0.05);
    c.stroke();
  }
  if (d.basket && D.env) {
    const sway = Math.sin(t * 0.7 + s.id) * L * 0.012;
    const bx = -L * 0.1;
    const by = D.gBot + L * 0.2;
    c.strokeStyle = hexA(T.dark, 0.65);
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(bx, envBot);
    c.lineTo(bx + sway, by);
    c.stroke();
    c.fillStyle = T.dark;
    c.beginPath();
    c.moveTo(bx + sway - L * 0.022, by);
    c.lineTo(bx + sway + L * 0.022, by);
    c.lineTo(bx + sway + L * 0.012, by + L * 0.03);
    c.lineTo(bx + sway - L * 0.012, by + L * 0.03);
    c.fill();
    c.fillStyle = T.acc;
    c.fillRect(bx + sway - L * 0.022, by, L * 0.044, L * 0.005);
    c.fillStyle = T.glass;
    c.fillRect(bx + sway - L * 0.012, by + L * 0.008, L * 0.024, L * 0.008);
  }
  for (const n of d.nacelles) {
    if (n.kind === 'pusher' || !D.env) continue;
    const x = L * n.at;
    const y = envBot + n.drop * D.env.h * 0.5;
    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(0.5, L * 0.004);
    c.beginPath();
    c.moveTo(x - L * 0.03, envBot - D.env.h * 0.08);
    c.lineTo(x, y);
    c.lineTo(x + L * 0.03, envBot - D.env.h * 0.06);
    c.stroke();
  }
}

/** What is in front: the gas cells, the nose, the dorsal walk and turret, her nacelles, engine car, gears, pipes, exhausts, paddles, crane, anchor, ladder. */
export function rigFront(E: Env, s: Ship, T: Tones, t: number) {
  const d = designOf(s);
  const c = E.ctx;
  const L = s.len;
  const D = dimsOf(s.kind, L);
  const fine = L > 70 * E.u;
  const lw = Math.max(0.3, L * 0.0016);
  const night = E.night();
  const copper = E.tone(COPPER, s.f, 0.3);
  const brass = E.tone(BRASS, s.f, 0.35);
  const ph = t * 5 + s.id;
  if (D.env && s.kind !== 'galleon') {
    const ev = D.env;
    if (fine && (d.cells || d.nose)) {
      c.save();
      envelope(c, ev.l, ev.h, ev.x, ev.y);
      c.clip();
      if (d.cells) {
        for (let q = 1; q <= d.cells; q++) {
          const x = -ev.l * 0.48 + (q * ev.l * 0.92) / (d.cells + 1);
          c.strokeStyle = hexA(T.dark, 0.32);
          c.lineWidth = Math.max(0.5, L * 0.004);
          c.beginPath();
          c.moveTo(x - L * 0.006, ev.y - ev.h * 0.6);
          c.quadraticCurveTo(x + L * 0.012, ev.y, x - L * 0.006, ev.y + ev.h * 0.6);
          c.stroke();
          c.strokeStyle = hexA(T.hi, 0.35);
          c.lineWidth = lw;
          c.beginPath();
          c.moveTo(x + L * 0.004, ev.y - ev.h * 0.6);
          c.quadraticCurveTo(x + L * 0.022, ev.y, x + L * 0.004, ev.y + ev.h * 0.6);
          c.stroke();
        }
      }
      if (d.nose) {
        // The nose cap left open: the rigid frame shows, rings and girders and their bracing.
        const nx = ev.x + ev.l * 0.36;
        c.fillStyle = hexA(T.dark, 0.55);
        c.fillRect(nx, ev.y - ev.h, ev.l * 0.2, ev.h * 2);
        c.strokeStyle = hexA(T.hi, 0.55);
        c.lineWidth = lw;
        c.beginPath();
        for (let k = 0; k < 4; k++) {
          const x = nx + k * ev.l * 0.035;
          c.moveTo(x, ev.y - ev.h);
          c.lineTo(x, ev.y + ev.h);
        }
        for (let k = -3; k <= 3; k++) {
          const y = ev.y + (k * ev.h) / 7;
          c.moveTo(nx, y);
          c.lineTo(ev.x + ev.l * 0.52, ev.y + y * 0.2);
        }
        for (let k = 0; k < 6; k++) {
          const y = ev.y - ev.h * 0.5 + (k * ev.h) / 6;
          c.moveTo(nx, y);
          c.lineTo(nx + ev.l * 0.035, y + ev.h / 6);
        }
        c.stroke();
      }
      c.restore();
    }
    if (d.spine && fine) {
      const top = ev.y - ev.h * 0.5;
      c.strokeStyle = hexA(T.dark, 0.8);
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(-ev.l * 0.25, top - L * 0.012);
      c.lineTo(ev.l * 0.2, top - L * 0.012);
      for (let x = -ev.l * 0.25; x <= ev.l * 0.2; x += L * 0.025) {
        c.moveTo(x, top);
        c.lineTo(x, top - L * 0.012);
      }
      c.stroke();
    }
    if (d.dorsal) {
      const x = ev.l * 0.05;
      const top = ev.y - ev.h * 0.5;
      c.fillStyle = T.dark;
      c.beginPath();
      c.arc(x, top + L * 0.004, L * 0.022, Math.PI, 0);
      c.fill();
      c.strokeStyle = T.dark;
      c.lineWidth = Math.max(0.6, L * 0.005);
      const recoil = t - s.gun < 0.3 ? -L * 0.008 : 0;
      c.beginPath();
      c.moveTo(x + L * 0.01, top - L * 0.01);
      c.lineTo(x + L * 0.07 + recoil, top - L * 0.02);
      c.moveTo(x + L * 0.01, top - L * 0.004);
      c.lineTo(x + L * 0.07 + recoil, top - L * 0.012);
      c.stroke();
    }
    if (fine && s.reg) flatText(E, s, s.reg, -ev.l * 0.5, ev.y + ev.h * 0.78, Math.max(4, ev.h * 0.16), hexA(T.hi, 0.75));
    // Her nacelles, on their struts, their screws turning.
    for (const n of d.nacelles) {
      const sz = L * 0.05 * n.size;
      if (n.kind === 'pusher') {
        const x = ev.x - ev.l * 0.585;
        c.fillStyle = T.dark;
        c.fillRect(x, ev.y - sz * 0.12, ev.l * 0.05, sz * 0.24);
        prop(c, x, ev.y, ev.h * 0.42, t + s.id, T.hi, 4);
        continue;
      }
      const x = L * n.at;
      const y = ev.y + ev.h * 0.5 + n.drop * ev.h * 0.5;
      c.fillStyle = T.dark;
      c.beginPath();
      c.moveTo(x + sz * 0.7, y);
      c.quadraticCurveTo(x + sz * 0.6, y - sz * 0.32, x - sz * 0.2, y - sz * 0.3);
      c.lineTo(x - sz * 0.8, y - sz * 0.12);
      c.lineTo(x - sz * 0.8, y + sz * 0.12);
      c.lineTo(x - sz * 0.2, y + sz * 0.3);
      c.quadraticCurveTo(x + sz * 0.6, y + sz * 0.32, x + sz * 0.7, y);
      c.fill();
      c.fillStyle = T.hi;
      c.fillRect(x - sz * 0.6, y - sz * 0.26, sz * 1.1, Math.max(0.4, sz * 0.06));
      if (fine) {
        // Its cooling fins, and an exhaust.
        c.fillStyle = hexA(T.hi, 0.5);
        for (let k = 0; k < 4; k++) c.fillRect(x - sz * 0.1 + k * sz * 0.14, y - sz * 0.28, Math.max(0.4, sz * 0.05), sz * 0.56);
        c.fillStyle = copper;
        c.fillRect(x - sz * 0.95, y + sz * 0.08, sz * 0.3, Math.max(0.5, sz * 0.09));
      }
      const pr = sz * 0.75;
      if (n.kind === 'ducted') {
        prop(c, x + sz * 0.8, y, pr * 0.85, t + n.at, T.hi, 4);
        c.strokeStyle = T.dark;
        c.lineWidth = Math.max(0.6, sz * 0.12);
        c.beginPath();
        c.ellipse(x + sz * 0.8, y, Math.max(0.8, sz * 0.18), pr, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (n.kind === 'twin') {
        prop(c, x + sz * 0.75, y, pr, t + n.at, T.hi, 2);
        prop(c, x - sz * 0.85, y, pr * 0.8, -t - n.at, T.hi, 2);
      } else prop(c, x + sz * 0.75, y, pr, t + n.at, T.hi, 3);
    }
    // The engine car: open-framed, its pistons pumping, the crank and flywheel turning, a pusher screw.
    if (d.engineCar) {
      const cx = -L * 0.24;
      const cy = ev.y + ev.h * 0.5 + L * 0.012;
      const cw = L * 0.13;
      const chh = L * 0.075;
      c.strokeStyle = T.dark;
      c.lineWidth = Math.max(0.5, L * 0.003);
      c.beginPath();
      c.moveTo(cx - cw * 0.3, ev.y + ev.h * 0.45);
      c.lineTo(cx - cw * 0.4, cy);
      c.moveTo(cx + cw * 0.3, ev.y + ev.h * 0.45);
      c.lineTo(cx + cw * 0.4, cy);
      c.stroke();
      c.fillStyle = hexA(T.dark, 0.85);
      c.fillRect(cx - cw / 2, cy + chh * 0.82, cw, chh * 0.2);
      c.fillRect(cx - cw / 2, cy, cw, chh * 0.12);
      if (fine) {
        const n = 3;
        for (let k = 0; k < n; k++) piston(c, cx - cw * 0.32 + k * cw * 0.2, cy + chh * 0.12, chh * 0.42, cw * 0.11, ph * 1.4 + (k * Math.PI * 2) / n, T.body, brass, T.hi);
        // The flywheel, and the crank under the pistons.
        const fx = cx + cw * 0.32;
        const fy = cy + chh * 0.5;
        const fr = chh * 0.34;
        c.strokeStyle = T.dark;
        c.lineWidth = Math.max(0.5, fr * 0.2);
        c.beginPath();
        c.arc(fx, fy, fr, 0, Math.PI * 2);
        c.stroke();
        c.lineWidth = Math.max(0.3, fr * 0.08);
        c.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = ph * 1.4 + (k * Math.PI) / 3;
          c.moveTo(fx, fy);
          c.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr);
        }
        c.stroke();
        c.strokeStyle = brass;
        c.lineWidth = Math.max(0.4, L * 0.0025);
        c.beginPath();
        c.moveTo(cx - cw * 0.4, cy + chh * 0.78);
        c.lineTo(fx, fy);
        c.stroke();
        if (night > 0.05 || s.fire > 0) E.glow(cx - cw * 0.05, cy + chh * 0.7, cw * 0.4, '#ff8a2a', 0.35 * Math.max(night, 0.3));
      } else {
        c.fillStyle = T.body;
        c.fillRect(cx - cw * 0.4, cy + chh * 0.12, cw * 0.8, chh * 0.7);
      }
      c.fillStyle = copper;
      c.fillRect(cx - L * 0.004, cy - L * 0.004, L * 0.008, L * 0.02);
      prop(c, cx - cw * 0.6, cy + chh * 0.5, chh * 0.6, t * 1.3 + s.id, T.hi, 4);
      c.strokeStyle = T.dark;
      c.lineWidth = Math.max(0.4, L * 0.003);
      c.beginPath();
      c.moveTo(cx - cw * 0.5, cy + chh * 0.5);
      c.lineTo(cx - cw * 0.6, cy + chh * 0.5);
      c.stroke();
    }
    if (d.ladder && s.state === 'moored') {
      const lx = (D.gx0 + D.gx1) / 2;
      const ll = L * 0.18;
      c.strokeStyle = hexA(T.dark, 0.8);
      c.lineWidth = lw;
      const sw = Math.sin(t * 0.9 + s.id) * L * 0.008;
      c.beginPath();
      c.moveTo(lx - L * 0.008, D.gBot);
      c.lineTo(lx - L * 0.008 + sw, D.gBot + ll);
      c.moveTo(lx + L * 0.008, D.gBot);
      c.lineTo(lx + L * 0.008 + sw, D.gBot + ll);
      for (let k = 1; k < 9; k++) {
        const q = k / 9;
        c.moveTo(lx - L * 0.008 + sw * q, D.gBot + ll * q);
        c.lineTo(lx + L * 0.008 + sw * q, D.gBot + ll * q);
      }
      c.stroke();
    }
  }
  // Gears in a housing on her flank: a port, and two wheels meshing behind it.
  if (d.gears && fine && s.kind !== 'balloon' && s.kind !== 'scout') {
    const gx = D.env && s.kind !== 'galleon' ? D.gx0 + (D.gx1 - D.gx0) * 0.25 : D.gx0 + (D.gx1 - D.gx0) * 0.62;
    const gy = D.env && s.kind !== 'galleon' ? (D.gTop + D.gBot) / 2 + (D.gBot - D.gTop) * 0.05 : D.gTop + (D.gBot - D.gTop) * 0.45;
    const gr = Math.min((D.gBot - D.gTop) * 0.32, L * 0.03);
    c.fillStyle = T.glass;
    c.beginPath();
    c.arc(gx + gr * 0.5, gy, gr * 1.55, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(gx + gr * 0.5, gy, gr * 1.55, 0, Math.PI * 2);
    c.clip();
    gearPair(c, gx - gr * 0.2, gy + gr * 0.1, gr * 0.8, gr * 0.5, -0.4, t * 1.6 + s.id, brass, E.tone('#3a2c1c', s.f));
    c.restore();
    c.strokeStyle = brass;
    c.lineWidth = Math.max(0.5, gr * 0.16);
    c.beginPath();
    c.arc(gx + gr * 0.5, gy, gr * 1.55, 0, Math.PI * 2);
    c.stroke();
  }
  // Copper pipes along her keel: flanges, a valve wheel, a gauge with its needle trembling.
  if (d.pipes && fine) {
    const y = D.env && s.kind !== 'galleon' ? D.gBot + L * 0.006 : D.gTop + (D.gBot - D.gTop) * 0.82;
    const x0 = D.env && s.kind !== 'galleon' ? D.gx0 - L * 0.02 : D.gx0 + L * 0.08;
    const x1 = D.env && s.kind !== 'galleon' ? D.gx1 - L * 0.01 : D.gx1 - L * 0.1;
    const pw = Math.max(0.6, L * 0.006);
    c.fillStyle = copper;
    c.fillRect(x0, y, x1 - x0, pw);
    c.fillRect(x0 + L * 0.02, y + pw * 1.6, x1 - x0 - L * 0.04, pw * 0.8);
    c.fillStyle = E.tone('#5a3018', s.f);
    for (let x = x0 + L * 0.03; x < x1; x += L * 0.045) c.fillRect(x, y - pw * 0.3, pw * 0.7, pw * 2.9);
    const vx = x0 + (x1 - x0) * 0.4;
    c.strokeStyle = E.tone('#7f1d1d', s.f, 0.2);
    c.lineWidth = Math.max(0.4, pw * 0.4);
    c.beginPath();
    c.arc(vx, y - pw * 1.6, pw * 1.4, 0, Math.PI * 2);
    c.moveTo(vx - pw * 1.4, y - pw * 1.6);
    c.lineTo(vx + pw * 1.4, y - pw * 1.6);
    c.stroke();
    const gx = x0 + (x1 - x0) * 0.7;
    const gr = pw * 2;
    c.fillStyle = E.tone('#e8dcc0', s.f, 0.3);
    c.beginPath();
    c.arc(gx, y - gr, gr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = brass;
    c.lineWidth = Math.max(0.3, gr * 0.2);
    c.stroke();
    const na = -Math.PI * 0.8 + 0.9 + Math.sin(t * 2.3 + s.id) * 0.15 + Math.sin(t * 17) * 0.05;
    c.strokeStyle = E.tone('#111111', s.f);
    c.lineWidth = Math.max(0.3, gr * 0.12);
    c.beginPath();
    c.moveTo(gx, y - gr);
    c.lineTo(gx + Math.cos(na) * gr * 0.8, y - gr + Math.sin(na) * gr * 0.8);
    c.stroke();
  }
  // Boiler exhausts (under an envelope) or funnels (on a deck).
  for (const [sx, sy] of stacksOf(s)) {
    if (D.env && s.kind !== 'galleon' && d.engineCar && Math.abs(sx + L * 0.24) < 1) continue;
    const slung = !!D.env && s.kind !== 'galleon';
    const sw = Math.max(0.8, L * 0.012);
    c.fillStyle = slung ? copper : T.dark;
    if (slung) {
      c.beginPath();
      c.moveTo(D.gx0, sy - sw * 0.5);
      c.lineTo(sx, sy - sw * 0.8);
      c.lineTo(sx - sw * 0.4, sy - sw * 1.4);
      c.lineTo(sx - sw * 0.6, sy + sw * 0.2);
      c.lineTo(D.gx0, sy + sw * 0.5);
      c.fill();
    } else {
      c.fillRect(sx - sw, sy, sw * 2, D.gTop - sy);
      c.fillStyle = T.acc;
      c.fillRect(sx - sw * 1.1, sy + (D.gTop - sy) * 0.15, sw * 2.2, (D.gTop - sy) * 0.12);
      c.fillStyle = T.hi;
      c.fillRect(sx - sw * 1.2, sy, sw * 2.4, Math.max(0.5, sw * 0.35));
    }
  }
  // Paddle wheels on her flanks, threshing the air.
  if (d.paddles && (!D.env || s.kind === 'galleon')) {
    const wheels = s.kind === 'galleon' ? [-0.04] : [-0.18];
    for (const px of wheels) {
      const wx = L * px;
      const wy = D.gTop + (D.gBot - D.gTop) * 0.45;
      const wr = (D.gBot - D.gTop) * 0.62;
      const a = t * 1.8 + s.id;
      c.strokeStyle = T.dark;
      c.lineWidth = Math.max(0.5, wr * 0.07);
      c.beginPath();
      c.arc(wx, wy, wr, 0, Math.PI * 2);
      for (let k = 0; k < 10; k++) {
        const q = a + (k * Math.PI) / 5;
        c.moveTo(wx, wy);
        c.lineTo(wx + Math.cos(q) * wr * 1.15, wy + Math.sin(q) * wr * 1.15);
      }
      c.stroke();
      c.fillStyle = T.body;
      for (let k = 0; k < 10; k++) {
        const q = a + (k * Math.PI) / 5;
        c.save();
        c.translate(wx + Math.cos(q) * wr, wy + Math.sin(q) * wr);
        c.rotate(q);
        c.fillRect(-wr * 0.02, -wr * 0.2, wr * 0.22, wr * 0.4);
        c.restore();
      }
      // The housing over its top half, with its sunburst.
      c.fillStyle = T.body;
      c.beginPath();
      c.arc(wx, wy, wr * 1.28, Math.PI, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = hexA(T.acc, 0.9);
      c.lineWidth = Math.max(0.4, wr * 0.05);
      c.beginPath();
      for (let k = 1; k < 8; k++) {
        const q = Math.PI + (k * Math.PI) / 8;
        c.moveTo(wx + Math.cos(q) * wr * 0.3, wy + Math.sin(q) * wr * 0.3);
        c.lineTo(wx + Math.cos(q) * wr * 1.2, wy + Math.sin(q) * wr * 1.2);
      }
      c.stroke();
      c.fillStyle = brass;
      c.beginPath();
      c.arc(wx, wy, wr * 0.2, 0, Math.PI * 2);
      c.fill();
    }
  }
  // A deck crane, its jib lifted by a hydraulic ram, a crate swinging under it.
  if (d.crane && !D.env && fine) {
    const bx = s.kind === 'dreadnought' ? -L * 0.36 : -L * 0.12;
    const by = D.gTop - (s.kind === 'dreadnought' ? 0 : L * 0.01);
    const lift = 0.5 + 0.5 * Math.sin(t * 0.35 + s.id);
    const ang = -0.6 - lift * 0.5;
    const jl = L * 0.2;
    const tipX = bx + Math.cos(ang) * jl;
    const tipY = by - L * 0.04 + Math.sin(ang) * jl;
    c.fillStyle = T.dark;
    c.fillRect(bx - L * 0.01, by - L * 0.04, L * 0.02, L * 0.04);
    c.strokeStyle = T.dark;
    c.lineWidth = Math.max(0.6, L * 0.006);
    c.beginPath();
    c.moveTo(bx, by - L * 0.04);
    c.lineTo(tipX, tipY);
    c.stroke();
    const rx = bx + Math.cos(ang) * jl * 0.45;
    const ry = by - L * 0.04 + Math.sin(ang) * jl * 0.45;
    c.strokeStyle = brass;
    c.lineWidth = Math.max(0.6, L * 0.007);
    c.beginPath();
    c.moveTo(bx + L * 0.02, by);
    c.lineTo(rx, ry);
    c.stroke();
    c.strokeStyle = T.hi;
    c.lineWidth = Math.max(0.3, L * 0.003);
    c.beginPath();
    c.moveTo(bx + L * 0.02, by);
    c.lineTo((bx + L * 0.02 + rx) / 2, (by + ry) / 2);
    c.stroke();
    const sw = Math.sin(t * 1.1 + s.id) * L * 0.01;
    const cyy = tipY + L * (0.06 + 0.06 * (1 - lift));
    c.strokeStyle = hexA(T.dark, 0.8);
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.lineTo(tipX + sw, cyy);
    c.stroke();
    c.fillStyle = E.tone(['#7a3a22', '#3a5a3a', '#8a6a2a'][s.seed % 3], s.f, 0.15);
    c.fillRect(tipX + sw - L * 0.02, cyy, L * 0.04, L * 0.03);
  }
  if (d.anchor && fine) {
    const ax = (D.env && s.kind !== 'galleon' ? D.gx1 : D.gx1 - L * 0.05) - L * 0.01;
    const ay = D.gBot;
    const drop = s.state === 'moored' ? L * 0.16 : L * 0.05;
    c.strokeStyle = hexA(T.dark, 0.85);
    c.lineWidth = Math.max(0.4, L * 0.002);
    c.setLineDash([Math.max(1, L * 0.004), Math.max(0.6, L * 0.002)]);
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(ax, ay + drop);
    c.stroke();
    c.setLineDash([]);
    const ar = L * 0.014;
    c.lineWidth = Math.max(0.5, L * 0.004);
    c.beginPath();
    c.moveTo(ax, ay + drop);
    c.lineTo(ax, ay + drop + ar * 2);
    c.moveTo(ax - ar, ay + drop + ar * 0.4);
    c.lineTo(ax + ar, ay + drop + ar * 0.4);
    c.moveTo(ax - ar * 1.2, ay + drop + ar * 1.3);
    c.quadraticCurveTo(ax, ay + drop + ar * 2.6, ax + ar * 1.2, ay + drop + ar * 1.3);
    c.stroke();
  }
  // Steering vanes at her stern, trimming.
  if (d.vanes && fine) {
    const vx = D.env && s.kind !== 'galleon' ? -L * 0.44 : D.gx0 + L * 0.04;
    const vy = D.env && s.kind !== 'galleon' ? D.env.y : (D.gTop + D.gBot) / 2;
    const a = Math.sin(t * 0.6 + s.id) * 0.35;
    c.fillStyle = T.dark;
    for (let k = -1; k <= 1; k++) {
      c.save();
      c.translate(vx, vy + k * L * 0.018);
      c.rotate(a);
      c.fillRect(-L * 0.03, -Math.max(0.4, L * 0.0025), L * 0.06, Math.max(0.8, L * 0.005));
      c.restore();
    }
  }
}
