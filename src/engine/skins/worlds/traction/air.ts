/**
 * What flies over the hunting ground, drawn: trading airships (cigar envelopes with their
 * gondolas and engine pods), traders' balloons, cargo haulers with their nets, sky clippers, the
 * red airships and gunboats of the Static Accord with their rocket racks; the sky harbour (gas
 * cells over a ring of docks, warehouses and cranes, ships moored round it); the crows.
 *
 * A ship's own units: its length L in px, +x forward (the bow), y down, its centre at 0.
 */
import { hsh } from './design';
import { clamp01, hexA, type Env } from './light';
import { shade } from './city';
import type { Flock, Harbour, Ship } from './types';

const COLS: Record<Ship['kind'], [string, string, string][]> = {
  trader: [['#c8b48a', '#6a4a30', '#8a2a22'], ['#b8a890', '#4a3a2a', '#2a5a7a'], ['#d0a868', '#5a3a28', '#3a6a4a']],
  balloon: [['#c84a30', '#e8d8b0', '#4a3020'], ['#3a6a9a', '#e8d8b0', '#3a2a1a'], ['#d8a038', '#7a2a2a', '#3a2a1a']],
  hauler: [['#9a9080', '#4a4038', '#7a6a3a'], ['#8a7a68', '#3a3028', '#6a3a2a']],
  clipper: [['#e0d4b8', '#3a4a5a', '#a83a2a'], ['#d8ccb0', '#5a3a2a', '#2a6a5a']],
  league: [['#9a2a22', '#e8d8b0', '#d8b048'], ['#7a2426', '#d8c8a0', '#c8a040']],
  gunboat: [['#8a2a24', '#3a2a24', '#d8b048']],
};

function envelope(c: CanvasRenderingContext2D, L: number, H: number, x0 = 0, y0 = 0) {
  c.beginPath();
  c.moveTo(x0 + L * 0.5, y0);
  c.bezierCurveTo(x0 + L * 0.5, y0 - H * 0.62, x0 + L * 0.2, y0 - H * 0.5, x0, y0 - H * 0.5);
  c.bezierCurveTo(x0 - L * 0.3, y0 - H * 0.5, x0 - L * 0.5, y0 - H * 0.25, x0 - L * 0.5, y0);
  c.bezierCurveTo(x0 - L * 0.5, y0 + H * 0.25, x0 - L * 0.3, y0 + H * 0.5, x0, y0 + H * 0.5);
  c.bezierCurveTo(x0 + L * 0.2, y0 + H * 0.5, x0 + L * 0.5, y0 + H * 0.62, x0 + L * 0.5, y0);
  c.closePath();
}
function bag(E: Env, L: number, H: number, body: string, d: number, x0 = 0, y0 = 0, band?: string) {
  const c = E.ctx;
  const g = c.createLinearGradient(0, y0 - H / 2, 0, y0 + H / 2);
  g.addColorStop(0, E.tone(shade(body, 1.3), d, 0.5));
  g.addColorStop(0.45, E.tone(body, d, 0.1));
  g.addColorStop(1, E.tone(shade(body, 0.55), d));
  envelope(c, L, H, x0, y0);
  c.fillStyle = g;
  c.fill();
  c.save();
  envelope(c, L, H, x0, y0);
  c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.16)';
  c.lineWidth = Math.max(0.4, L * 0.004);
  for (let k = -9; k <= 9; k++) {
    c.beginPath();
    c.moveTo(x0 + (k * L) / 19, y0 - H);
    c.lineTo(x0 + (k * L) / 19, y0 + H);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(x0 - L / 2, y0);
  c.lineTo(x0 + L / 2, y0);
  c.stroke();
  if (band) {
    c.fillStyle = E.tone(band, d, 0.1);
    c.fillRect(x0 - L * 0.6, y0 + H * 0.06, L * 1.2, H * 0.12);
  }
  c.fillStyle = hexA(E.L.sun, 0.18 * E.L.rim * (1 - E.night * 0.7));
  c.fillRect(x0 - L * 0.4, y0 - H * 0.42, L * 0.75, H * 0.09);
  c.restore();
}
function fins(E: Env, L: number, H: number, col: string, d: number, x0 = 0, y0 = 0) {
  const c = E.ctx;
  c.fillStyle = E.tone(col, d);
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(x0 - L * 0.3, y0 + s * H * 0.4);
    c.lineTo(x0 - L * 0.5, y0 + s * H * 0.95);
    c.lineTo(x0 - L * 0.56, y0 + s * H * 0.95);
    c.lineTo(x0 - L * 0.52, y0 + s * H * 0.12);
    c.closePath();
    c.fill();
  }
}
function prop(E: Env, x: number, y: number, r: number, d: number, col: string) {
  const c = E.ctx;
  c.fillStyle = hexA(E.tone(col, d, 0.3), 0.25 + 0.15 * Math.sin(E.t * 40 + x));
  c.beginPath();
  c.ellipse(x, y, Math.max(0.5, r * 0.12), r, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = E.tone(col, d);
  c.lineWidth = Math.max(0.4, r * 0.12);
  const a = E.t * 25;
  c.beginPath();
  c.moveTo(x, y - Math.cos(a) * r);
  c.lineTo(x, y + Math.cos(a) * r);
  c.stroke();
}
function gondola(E: Env, x0: number, x1: number, y: number, h: number, col: string, d: number, lights: number) {
  const c = E.ctx;
  c.fillStyle = E.tone(col, d);
  c.beginPath();
  c.moveTo(x0, y);
  c.lineTo(x1, y);
  c.lineTo(x1 - h * 0.6, y + h);
  c.lineTo(x0 + h * 0.3, y + h);
  c.closePath();
  c.fill();
  c.fillStyle = E.tone('#1a1a1c', d);
  const n = Math.max(2, Math.floor((x1 - x0) / Math.max(2, h * 0.7)));
  for (let k = 0; k < n; k++) {
    const wx = x0 + ((k + 0.5) * (x1 - x0 - h * 0.6)) / n;
    c.fillRect(wx, y + h * 0.25, h * 0.35, h * 0.32);
  }
  if (lights > 0.05) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = hexA('#ffcf8a', lights);
    for (let k = 0; k < n; k++) {
      const wx = x0 + ((k + 0.5) * (x1 - x0 - h * 0.6)) / n;
      if (hsh(k, x0) < 0.7) c.fillRect(wx, y + h * 0.25, h * 0.35, h * 0.32);
    }
    c.restore();
  }
}

export function drawShip(E: Env, s: Ship, X: number, Y: number, L: number, d: number) {
  const c = E.ctx;
  const [body, dark, acc] = COLS[s.kind][s.seed % COLS[s.kind].length];
  const lights = clamp01(E.night * 1.1);
  const tilt = s.state === 'fall' ? Math.min(0.9, (E.t - s.t0) * 0.25) * s.dir : Math.sin(s.bob * 0.6) * 0.02;
  c.save();
  c.translate(X, Y + Math.sin(s.bob * 0.8) * L * 0.01);
  c.rotate(tilt);
  c.scale(s.dir, 1);
  if (s.kind === 'balloon') {
    const r = L * 0.42;
    c.strokeStyle = E.tone(dark, d);
    c.lineWidth = Math.max(0.3, L * 0.01);
    c.beginPath();
    c.moveTo(-r * 0.6, r * 0.6);
    c.lineTo(-r * 0.3, r * 1.55);
    c.moveTo(r * 0.6, r * 0.6);
    c.lineTo(r * 0.3, r * 1.55);
    c.moveTo(0, r);
    c.lineTo(0, r * 1.55);
    c.stroke();
    c.fillStyle = E.tone('#5a4030', d);
    c.fillRect(-r * 0.36, r * 1.55, r * 0.72, r * 0.38);
    c.fillStyle = E.tone('#e8d8b0', d, 0.3);
    c.beginPath();
    c.moveTo(r * 0.36, r * 1.5);
    c.lineTo(r * 0.9, r * 1.7);
    c.lineTo(r * 0.36, r * 1.85);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.clip();
    for (let k = -4; k <= 4; k++) {
      c.fillStyle = E.tone(k % 2 ? body : dark, d, 0.15);
      c.fillRect((k - 0.5) * r * 0.25, -r, r * 0.25, r * 2);
    }
    const sh = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r);
    sh.addColorStop(0, hexA(E.L.sun, 0.3 * E.L.rim * (1 - E.night * 0.6)));
    sh.addColorStop(0.7, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.4)');
    c.fillStyle = sh;
    c.fillRect(-r, -r, r * 2, r * 2);
    c.restore();
    if (lights > 0.05) E.glow(0, r * 1.72, L * 0.12, '#ffcf8a', lights * 0.8);
  } else {
    const slim = s.kind === 'clipper' || s.kind === 'gunboat' ? 0.17 : s.kind === 'hauler' ? 0.3 : 0.22;
    const H = L * slim;
    fins(E, L, H, dark, d);
    bag(E, L, H, body, d, 0, 0, s.kind === 'league' || s.kind === 'trader' ? acc : undefined);
    if (s.kind === 'league' || s.kind === 'gunboat') {
      // The Accord's crest: a gold sun on the red.
      c.fillStyle = E.tone(acc, d, 0.3);
      c.beginPath();
      c.arc(L * 0.12, -H * 0.05, H * 0.17, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = E.tone(acc, d, 0.3);
      c.lineWidth = Math.max(0.4, H * 0.03);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(L * 0.12 + Math.cos(a) * H * 0.22, -H * 0.05 + Math.sin(a) * H * 0.22);
        c.lineTo(L * 0.12 + Math.cos(a) * H * 0.3, -H * 0.05 + Math.sin(a) * H * 0.3);
        c.stroke();
      }
    }
    // Rigging down to the gondola.
    const gy = H * 0.56;
    c.strokeStyle = hexA(E.tone(dark, d), 0.7);
    c.lineWidth = Math.max(0.3, L * 0.004);
    c.beginPath();
    for (const q of [-0.2, -0.05, 0.1, 0.22]) {
      c.moveTo(L * q, H * 0.45);
      c.lineTo(L * q * 0.7, gy);
    }
    c.stroke();
    if (s.kind === 'hauler') {
      gondola(E, -L * 0.12, L * 0.18, gy, H * 0.22, dark, d, lights);
      // The cargo slung below in its net.
      c.strokeStyle = E.tone(dark, d);
      c.beginPath();
      c.moveTo(-L * 0.04, gy + H * 0.22);
      c.lineTo(-L * 0.1, gy + H * 0.55);
      c.moveTo(L * 0.1, gy + H * 0.22);
      c.lineTo(L * 0.16, gy + H * 0.55);
      c.stroke();
      c.fillStyle = E.tone(acc, d, 0.1);
      c.fillRect(-L * 0.12, gy + H * 0.55, L * 0.3, H * 0.4);
      c.strokeStyle = hexA(E.tone('#1a1410', d), 0.6);
      c.beginPath();
      for (let k = 0; k <= 6; k++) {
        c.moveTo(-L * 0.12 + (k * L * 0.3) / 6, gy + H * 0.55);
        c.lineTo(-L * 0.12 + (k * L * 0.3) / 6, gy + H * 0.95);
      }
      c.stroke();
    } else if (s.kind === 'clipper') {
      // A little wooden hull, a sail on a boom.
      c.fillStyle = E.tone('#5a3a24', d);
      c.beginPath();
      c.moveTo(-L * 0.26, gy);
      c.lineTo(L * 0.3, gy);
      c.lineTo(L * 0.22, gy + H * 0.32);
      c.lineTo(-L * 0.2, gy + H * 0.32);
      c.fill();
      c.fillStyle = E.tone('#e8dcc4', d, 0.4);
      c.beginPath();
      c.moveTo(-L * 0.32, gy - H * 0.1);
      c.lineTo(-L * 0.5, gy + H * 0.5);
      c.lineTo(-L * 0.3, gy + H * 0.4);
      c.fill();
    } else {
      const big = s.kind === 'league' ? 0.28 : 0.2;
      gondola(E, -L * big, L * big, gy, H * 0.28, s.kind === 'league' || s.kind === 'gunboat' ? '#3a2a24' : dark, d, lights);
      if (s.kind === 'league' || s.kind === 'gunboat') {
        // Rocket racks under the gondola.
        c.fillStyle = E.tone('#2a2420', d);
        c.fillRect(-L * 0.12, gy + H * 0.28, L * 0.24, H * 0.1);
        c.fillStyle = E.tone('#c8b080', d, 0.2);
        for (let k = 0; k < 5; k++) c.fillRect(-L * 0.11 + k * L * 0.05, gy + H * 0.34, L * 0.035, H * 0.04);
      }
    }
    // Engine pods with their airscrews.
    for (const q of s.kind === 'clipper' ? [-0.35] : [-0.3, 0.05]) {
      c.fillStyle = E.tone(dark, d);
      c.beginPath();
      c.ellipse(L * q, H * 0.5, L * 0.04, H * 0.11, 0, 0, Math.PI * 2);
      c.fill();
      prop(E, L * q - L * 0.045, H * 0.5, H * 0.2, d, '#2a2420');
    }
  }
  // On fire.
  if (s.fire > 0) {
    const fk = s.fire;
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) E.glow((hsh(s.seed, k) - 0.5) * L * 0.8 * fk, (hsh(k, s.seed) - 0.6) * L * 0.15, L * 0.15 * (0.6 + fk), '#ff7a20', 0.6 * fk);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
  // Running lights.
  if (lights > 0.1 && s.state !== 'fall') {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const blink = Math.sin(E.t * 3 + s.seed) > 0.2 ? 1 : 0.3;
    E.glow(X + s.dir * L * 0.48, Y, L * 0.06 + 2, '#ff5a4a', lights * blink);
    E.glow(X - s.dir * L * 0.48, Y, L * 0.06 + 2, '#7aff9a', lights * 0.7);
    c.restore();
  }
}

/** The sky harbour at (X, Y) (the middle of its deck), k px per harbour unit (its deck is 200 across). */
export function drawHarbour(E: Env, _hb: Harbour, X: number, Y: number, k: number, d: number) {
  const c = E.ctx;
  const t = E.t;
  const lights = clamp01(E.night * 1.1 + 0.05);
  c.save();
  c.translate(X, Y + Math.sin(t * 0.4) * 2 * k);
  c.scale(k, k);
  // Gas cells over it, tied down with cables.
  const cells = [[-70, -80, 90], [0, -100, 120], [70, -78, 86], [-30, -130, 70], [40, -128, 64]];
  c.strokeStyle = E.tone('#2a2420', d);
  c.lineWidth = 0.6;
  for (const [cx, cy] of cells) {
    c.beginPath();
    c.moveTo(cx - 20, cy + 14);
    c.lineTo(cx * 0.8 - 16, -6);
    c.moveTo(cx + 20, cy + 14);
    c.lineTo(cx * 0.8 + 16, -6);
    c.stroke();
  }
  for (const [i, [cx, cy, w]] of cells.entries()) bag(E, w, w * 0.36, ['#b8a888', '#a89878', '#c8b898', '#9a8a70', '#b0a080'][i], d, cx, cy, i === 1 ? '#7a3a2a' : undefined);
  // The deck: a ring of iron with warehouses, a tavern, cranes; the docks reaching out.
  c.fillStyle = E.tone('#3a3430', d);
  c.beginPath();
  c.moveTo(-100, 0);
  c.lineTo(100, 0);
  c.lineTo(84, 14);
  c.lineTo(-84, 14);
  c.closePath();
  c.fill();
  c.fillStyle = E.tone('#5a5048', d, 0.3);
  c.fillRect(-100, -1, 200, 2);
  c.fillStyle = E.tone('#2a2420', d);
  c.beginPath();
  c.moveTo(-40, 14);
  c.lineTo(40, 14);
  c.lineTo(0, 30);
  c.fill();
  const houses: [number, number, number, string][] = [[-90, 16, 18, '#8a5a40'], [-70, 22, 14, '#a89878'], [-46, 14, 22, '#7a4a3a'], [-22, 26, 30, '#c8b898'], [12, 18, 18, '#6a4a3a'], [34, 22, 16, '#a89070'], [58, 20, 24, '#8a6a4a']];
  for (const [hx, hw, hh, col] of houses) {
    c.fillStyle = E.tone(col, d, 0.1);
    c.fillRect(hx, -hh, hw, hh);
    c.fillStyle = E.tone('#4a3e3a', d);
    c.beginPath();
    c.moveTo(hx - 1, -hh);
    c.lineTo(hx + hw / 2, -hh - 6);
    c.lineTo(hx + hw + 1, -hh);
    c.fill();
    c.fillStyle = E.tone('#1a1818', d);
    for (let wx = hx + 2; wx < hx + hw - 3; wx += 5) for (let wy = -hh + 4; wy < -3; wy += 6) c.fillRect(wx, wy, 2, 3);
    if (lights > 0.05) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = hexA('#ffcf8a', lights);
      for (let wx = hx + 2; wx < hx + hw - 3; wx += 5) for (let wy = -hh + 4; wy < -3; wy += 6) if (hsh(wx, wy) < 0.6) c.fillRect(wx, wy, 2, 3);
      c.restore();
    }
  }
  // Docks with ships moored at them, and cranes swinging cargo.
  c.strokeStyle = E.tone('#4a4038', d, 0.1);
  c.lineWidth = 2;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 100, 2);
    c.lineTo(s * 140, 2);
    c.stroke();
    c.lineWidth = 1;
    const sw = Math.sin(t * 0.3 + s) * 6;
    c.beginPath();
    c.moveTo(s * 96, 0);
    c.lineTo(s * 96, -40);
    c.lineTo(s * 124 + sw, -36);
    c.lineTo(s * 124 + sw, -14);
    c.stroke();
    c.fillStyle = E.tone('#7a6a4a', d, 0.1);
    c.fillRect(s * 124 + sw - 4, -14, 8, 6);
    c.lineWidth = 2;
  }
  // The harbour's name on a board.
  c.fillStyle = E.tone('#2a2420', d);
  c.fillRect(-36, 4, 72, 8);
  c.restore();
  if (lights > 0.05) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) E.glow(X + s * 140 * k, Y + 2 * k, 8 * k, '#ffd79a', lights);
    E.glow(X, Y + 30 * k, 10 * k, '#ff6a4a', lights * (Math.sin(t * 2) > 0 ? 1 : 0.3));
    c.restore();
  }
}

export function drawFlock(E: Env, f: Flock, X: number, Y: number, m: number) {
  const c = E.ctx;
  c.strokeStyle = E.tone('#141210', 0.3);
  c.lineWidth = Math.max(0.7, 1.3 * m * E.u);
  c.beginPath();
  for (let i = 0; i < f.n; i++) {
    const a = E.t * (0.25 + hsh(f.seed, i) * 0.3) * (hsh(i, f.seed) < 0.5 ? 1 : -1) + i * 2.4;
    const rr = (40 + hsh(f.seed + 1, i) * 120) * m * E.u * f.spread;
    const x = X + Math.cos(a) * rr;
    const y = Y + Math.sin(a * 1.3) * rr * 0.35 - (f.spread - 1) * 30 * m * E.u * hsh(i, 3);
    const s = (4 + hsh(f.seed + 2, i) * 2) * m * E.u;
    const flap = Math.sin(E.t * 9 + i * 1.7) * s * 0.6;
    c.moveTo(x - s, y - flap);
    c.quadraticCurveTo(x - s * 0.4, y - s * 0.1, x, y + s * 0.15);
    c.quadraticCurveTo(x + s * 0.4, y - s * 0.1, x + s, y - flap);
  }
  c.stroke();
}
