/**
 * Ironhaze's walkers, drawn: iron machines on legs, toned for their depth, their feet in the fog.
 *
 * Bipeds (a riveted boiler-cabin on two legs, a cannon arm, stacks, a searchlight; knees forward
 * or back), land-crawlers (a hull on four spider legs with a turret), tripods (a domed head on
 * three long legs, cables hanging, a green lamp), striders (a cabin on stilts), land-ships (a
 * hull on tracks, funnels and a great gun), iron beetles (six legs, a segmented shell, lamp
 * eyes), and the walking fortress (a castle on four pillar legs, towers, flags and batteries).
 * A walker that is hit falls over, and lies smoking in the street.
 */
import { hexA, type Env } from './env';
import type { Walker } from './types';

type Pal = { iron: string; hi: string; dk: string; red: string; brass: string; glass: string };

function limb(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, col: string) {
  const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
  const cx = Math.cos(a);
  const cy = Math.sin(a);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x0 + (cx * w0) / 2, y0 + (cy * w0) / 2);
  c.lineTo(x1 + (cx * w1) / 2, y1 + (cy * w1) / 2);
  c.lineTo(x1 - (cx * w1) / 2, y1 - (cy * w1) / 2);
  c.lineTo(x0 - (cx * w0) / 2, y0 - (cy * w0) / 2);
  c.closePath();
  c.fill();
}
/** A leg: thigh, a piston alongside it, a knee, a shin, a foot with toes. */
function leg(c: CanvasRenderingContext2D, P: Pal, hx: number, hy: number, kx: number, ky: number, fx: number, fy: number, w: number, col: string, footW: number) {
  limb(c, hx, hy, kx, ky, w, w * 0.8, col);
  limb(c, kx, ky, fx, fy - footW * 0.12, w * 0.75, w * 0.55, col);
  c.strokeStyle = P.hi;
  c.lineWidth = Math.max(0.4, w * 0.18);
  c.beginPath();
  c.moveTo(hx + w * 0.4, hy + w * 0.2);
  c.lineTo((hx + kx) / 2 + w * 0.4, (hy + ky) / 2);
  c.stroke();
  c.fillStyle = P.dk;
  c.beginPath();
  c.arc(kx, ky, w * 0.62, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = P.brass;
  c.beginPath();
  c.arc(kx, ky, w * 0.22, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(fx - footW * 0.55, fy);
  c.lineTo(fx - footW * 0.4, fy - footW * 0.22);
  c.lineTo(fx + footW * 0.35, fy - footW * 0.22);
  c.lineTo(fx + footW * 0.6, fy);
  c.closePath();
  c.fill();
  c.fillStyle = P.dk;
  for (const tx of [-0.45, 0.05, 0.5]) c.fillRect(fx + footW * tx - footW * 0.06, fy - footW * 0.05, footW * 0.12, footW * 0.05);
}
function rivets(c: CanvasRenderingContext2D, P: Pal, x0: number, x1: number, y: number, step: number, r: number) {
  c.fillStyle = P.hi;
  for (let x = x0; x <= x1; x += step) c.fillRect(x - r / 2, y - r / 2, r, r);
}
function stacks(c: CanvasRenderingContext2D, P: Pal, x: number, y: number, h: number, w: number, n: number) {
  for (let k = 0; k < n; k++) {
    c.fillStyle = k ? P.dk : P.iron;
    c.fillRect(x + k * w * 1.5, y - h * (1 - k * 0.2), w, h * (1 - k * 0.2));
    c.fillStyle = P.hi;
    c.fillRect(x + k * w * 1.5 - w * 0.15, y - h * (1 - k * 0.2), w * 1.3, w * 0.25);
  }
}

function biped(c: CanvasRenderingContext2D, P: Pal, wk: Walker, t: number) {
  const H = wk.h;
  const ph = wk.phase;
  const back = wk.seed % 2 === 0;
  const bob = Math.abs(Math.sin(ph)) * H * 0.02;
  for (const side of [0, 1]) {
    const p = ph + side * Math.PI;
    const hx = side ? H * 0.06 : -H * 0.06;
    const hy = -H * 0.55 + bob;
    const fx = hx + Math.sin(p) * H * 0.17;
    const fy = -Math.max(0, -Math.cos(p)) * H * 0.06;
    const kx = (hx + fx) / 2 + (back ? -H * 0.1 : H * 0.08);
    const ky = (hy + fy) / 2 - H * 0.02;
    leg(c, P, hx, hy, kx, ky, fx, fy, H * (side ? 0.065 : 0.058), side ? P.iron : P.dk, H * 0.17);
  }
  c.save();
  c.translate(0, bob);
  c.rotate(Math.sin(ph * 2) * 0.015);
  // The hip block.
  c.fillStyle = P.dk;
  c.beginPath();
  c.roundRect(-H * 0.14, -H * 0.6, H * 0.28, H * 0.1, H * 0.03);
  c.fill();
  // The cabin: a riveted boiler, sloped at the front.
  c.fillStyle = P.iron;
  c.beginPath();
  c.moveTo(-H * 0.22, -H * 0.53);
  c.lineTo(-H * 0.24, -H * 0.92);
  c.quadraticCurveTo(-H * 0.22, -H * 1.02, -H * 0.1, -H * 1.02);
  c.lineTo(H * 0.1, -H * 1.02);
  c.lineTo(H * 0.21, -H * 0.88);
  c.lineTo(H * 0.2, -H * 0.53);
  c.closePath();
  c.fill();
  const gr = c.createLinearGradient(-H * 0.24, 0, H * 0.21, 0);
  gr.addColorStop(0, 'rgba(255,240,210,0.1)');
  gr.addColorStop(0.5, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.25)');
  c.fillStyle = gr;
  c.fill();
  c.fillStyle = P.hi;
  c.fillRect(-H * 0.22, -H * 1.015, H * 0.31, H * 0.012);
  for (let k = 1; k < 4; k++) {
    c.fillStyle = P.dk;
    c.fillRect(-H * 0.23, -H * 0.53 - k * H * 0.12, H * 0.43, H * 0.008);
    rivets(c, P, -H * 0.21, H * 0.18, -H * 0.53 - k * H * 0.12 + H * 0.016, H * 0.04, H * 0.008);
  }
  // Its vision slit, its emblem, its ladder.
  c.fillStyle = P.dk;
  c.fillRect(H * 0.06, -H * 0.89, H * 0.13, H * 0.025);
  c.fillStyle = P.red;
  c.beginPath();
  c.arc(-H * 0.1, -H * 0.74, H * 0.045, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = P.hi;
  c.fillRect(-H * 0.12, -H * 0.745, H * 0.04, H * 0.01);
  c.strokeStyle = P.dk;
  c.lineWidth = Math.max(0.3, H * 0.006);
  c.beginPath();
  c.moveTo(-H * 0.2, -H * 0.55);
  c.lineTo(-H * 0.2, -H * 0.85);
  c.moveTo(-H * 0.17, -H * 0.55);
  c.lineTo(-H * 0.17, -H * 0.85);
  for (let y = -H * 0.58; y > -H * 0.85; y -= H * 0.03) {
    c.moveTo(-H * 0.2, y);
    c.lineTo(-H * 0.17, y);
  }
  c.stroke();
  stacks(c, P, -H * 0.2, -H * 1.0, H * 0.18, H * 0.04, 2);
  // The searchlight on top, and the cannon arm.
  c.fillStyle = P.dk;
  c.beginPath();
  c.roundRect(H * 0.0, -H * 1.08, H * 0.09, H * 0.06, H * 0.02);
  c.fill();
  const recoil = t - wk.gun < 0.3 ? -H * 0.04 : 0;
  c.fillStyle = P.dk;
  c.beginPath();
  c.arc(H * 0.18, -H * 0.66, H * 0.05, 0, Math.PI * 2);
  c.fill();
  limb(c, H * 0.18, -H * 0.66, H * 0.62 + recoil, -H * 0.62, H * 0.04, H * 0.028, P.dk);
  c.fillStyle = P.iron;
  c.fillRect(H * 0.56 + recoil, -H * 0.645, H * 0.07, H * 0.05);
  limb(c, H * 0.18, -H * 0.58, H * 0.36, -H * 0.5, H * 0.03, H * 0.02, P.iron);
  c.strokeStyle = P.dk;
  c.lineWidth = H * 0.012;
  c.beginPath();
  c.moveTo(H * 0.36, -H * 0.5);
  c.lineTo(H * 0.42, -H * 0.48);
  c.moveTo(H * 0.36, -H * 0.5);
  c.lineTo(H * 0.41, -H * 0.54);
  c.moveTo(0, -H * 1.0);
  c.lineTo(H * 0.02, -H * 1.22);
  c.stroke();
  c.restore();
}

function quad(c: CanvasRenderingContext2D, P: Pal, wk: Walker, t: number) {
  const H = wk.h;
  const ph = wk.phase;
  const bob = Math.abs(Math.sin(ph)) * H * 0.015;
  for (const [hx, side] of [[-H * 0.26, 1], [H * 0.24, 1], [-H * 0.3, 0], [H * 0.28, 0]] as [number, number][]) {
    const p = ph + (hx > 0 ? 0 : Math.PI) + side * Math.PI * 0.5;
    const out = hx > 0 ? 1 : -1;
    const hy = -H * 0.58 + bob;
    const fx = hx + out * H * 0.24 + Math.sin(p) * H * 0.12;
    const fy = -Math.max(0, -Math.cos(p)) * H * 0.06;
    leg(c, P, hx, hy, hx + out * H * 0.2, hy - H * 0.2, fx, fy, H * (side ? 0.045 : 0.055), side ? P.dk : P.iron, H * 0.1);
  }
  c.save();
  c.translate(0, bob);
  c.fillStyle = P.iron;
  c.beginPath();
  c.moveTo(-H * 0.42, -H * 0.5);
  c.lineTo(-H * 0.46, -H * 0.82);
  c.lineTo(H * 0.18, -H * 0.86);
  c.lineTo(H * 0.42, -H * 0.72);
  c.lineTo(H * 0.38, -H * 0.5);
  c.closePath();
  c.fill();
  c.fillStyle = P.hi;
  c.fillRect(-H * 0.42, -H * 0.84, H * 0.6, H * 0.015);
  c.fillStyle = P.dk;
  for (let k = 0; k < 7; k++) c.fillRect(-H * 0.4 + k * H * 0.12, -H * 0.8, H * 0.006, H * 0.28);
  rivets(c, P, -H * 0.4, H * 0.34, -H * 0.54, H * 0.05, H * 0.01);
  c.fillStyle = P.iron;
  c.beginPath();
  c.roundRect(-H * 0.12, -H * 1.0, H * 0.3, H * 0.17, H * 0.05);
  c.fill();
  const recoil = t - wk.gun < 0.3 ? -H * 0.05 : 0;
  limb(c, H * 0.16, -H * 0.92, H * 0.74 + recoil, -H * 0.96, H * 0.035, H * 0.025, P.dk);
  stacks(c, P, -H * 0.4, -H * 0.82, H * 0.2, H * 0.05, 2);
  c.fillStyle = P.red;
  c.fillRect(-H * 0.3, -H * 0.72, H * 0.08, H * 0.08);
  c.fillStyle = P.dk;
  c.fillRect(H * 0.04, -H * 0.95, H * 0.1, H * 0.02);
  c.restore();
}

function tripod(c: CanvasRenderingContext2D, P: Pal, wk: Walker, t: number) {
  const H = wk.h;
  const ph = wk.phase;
  for (let k = 0; k < 3; k++) {
    const p = ph + (k * Math.PI * 2) / 3;
    const hx = (k - 1) * H * 0.05;
    const hy = -H * 0.82;
    const fx = hx + Math.sin(p) * H * 0.22 + (k - 1) * H * 0.2;
    const fy = -Math.max(0, -Math.cos(p)) * H * 0.06;
    const kx = (hx + fx) / 2 + (k - 1) * H * 0.12;
    const ky = (hy + fy) / 2 - H * 0.08;
    leg(c, P, hx, hy, kx, ky, fx, fy, H * 0.026, k === 1 ? P.dk : P.iron, H * 0.07);
  }
  c.fillStyle = P.iron;
  c.beginPath();
  c.moveTo(-H * 0.18, -H * 0.82);
  c.quadraticCurveTo(-H * 0.2, -H * 1.06, 0, -H * 1.1);
  c.quadraticCurveTo(H * 0.2, -H * 1.06, H * 0.18, -H * 0.82);
  c.closePath();
  c.fill();
  c.fillStyle = P.hi;
  c.fillRect(-H * 0.14, -H * 1.02, H * 0.28, H * 0.01);
  c.fillStyle = P.dk;
  c.fillRect(-H * 0.18, -H * 0.84, H * 0.36, H * 0.03);
  c.beginPath();
  c.arc(H * 0.1, -H * 0.94, H * 0.035, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = P.dk;
  c.lineWidth = H * 0.006;
  for (let k = 0; k < 5; k++) {
    c.beginPath();
    c.moveTo(-H * 0.12 + k * H * 0.06, -H * 0.82);
    c.quadraticCurveTo(-H * 0.1 + k * H * 0.06 + Math.sin(t + k) * H * 0.05, -H * 0.62, -H * 0.12 + k * H * 0.065 + Math.sin(t * 0.7 + k) * H * 0.04, -H * 0.48);
    c.stroke();
  }
  limb(c, H * 0.14, -H * 0.9, H * 0.34, -H * 0.86, H * 0.03, H * 0.02, P.dk);
}

function strider(c: CanvasRenderingContext2D, P: Pal, wk: Walker) {
  const H = wk.h;
  const ph = wk.phase;
  const bob = Math.abs(Math.sin(ph)) * H * 0.02;
  for (const side of [0, 1]) {
    const p = ph + side * Math.PI;
    const hx = 0;
    const hy = -H * 0.86 + bob;
    const fx = hx + Math.sin(p) * H * 0.2;
    const fy = -Math.max(0, -Math.cos(p)) * H * 0.05;
    const kx = (hx + fx) / 2 - H * 0.14;
    const ky = (hy + fy) / 2 - H * 0.05;
    leg(c, P, hx, hy, kx, ky, fx, fy, H * (side ? 0.026 : 0.022), side ? P.iron : P.dk, H * 0.08);
  }
  c.save();
  c.translate(0, bob);
  c.fillStyle = P.iron;
  c.beginPath();
  c.moveTo(-H * 0.14, -H * 0.86);
  c.lineTo(-H * 0.12, -H * 1.0);
  c.lineTo(H * 0.1, -H * 1.0);
  c.lineTo(H * 0.18, -H * 0.92);
  c.lineTo(H * 0.12, -H * 0.84);
  c.closePath();
  c.fill();
  c.fillStyle = P.dk;
  c.fillRect(H * 0.04, -H * 0.95, H * 0.12, H * 0.025);
  c.fillStyle = P.hi;
  c.fillRect(-H * 0.12, -H * 0.995, H * 0.2, H * 0.008);
  limb(c, H * 0.12, -H * 0.88, H * 0.3, -H * 0.86, H * 0.022, H * 0.016, P.dk);
  c.strokeStyle = P.dk;
  c.lineWidth = H * 0.005;
  c.beginPath();
  c.moveTo(-H * 0.06, -H * 1.0);
  c.lineTo(-H * 0.07, -H * 1.14);
  c.moveTo(-H * 0.06, -H * 0.84);
  c.lineTo(-H * 0.05, -H * 0.72);
  c.stroke();
  c.fillStyle = P.dk;
  c.fillRect(-H * 0.08, -H * 0.72, H * 0.06, H * 0.05);
  c.restore();
}

function crawler(c: CanvasRenderingContext2D, P: Pal, wk: Walker, t: number) {
  const H = wk.h;
  const L = H * 2.3;
  const roll = wk.x / (H * 0.08);
  // The tracks and their road wheels.
  c.fillStyle = P.dk;
  c.beginPath();
  c.roundRect(-L * 0.5, -H * 0.3, L, H * 0.3, H * 0.15);
  c.fill();
  c.strokeStyle = P.iron;
  c.lineWidth = Math.max(0.4, H * 0.01);
  for (let k = 0; k < 9; k++) {
    const wx = -L * 0.42 + k * L * 0.105;
    c.beginPath();
    c.arc(wx, -H * 0.13, H * 0.09, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(wx + Math.cos(roll) * H * 0.09, -H * 0.13 + Math.sin(roll) * H * 0.09);
    c.lineTo(wx - Math.cos(roll) * H * 0.09, -H * 0.13 - Math.sin(roll) * H * 0.09);
    c.stroke();
  }
  c.fillStyle = P.hi;
  const off = (roll * H * 0.02) % (H * 0.05);
  for (let x = -L * 0.48 + off; x < L * 0.48; x += H * 0.05) c.fillRect(x, -H * 0.3, H * 0.02, H * 0.012);
  // The hull, its plating and its portholes.
  c.fillStyle = P.iron;
  c.beginPath();
  c.moveTo(-L * 0.48, -H * 0.3);
  c.lineTo(-L * 0.45, -H * 0.62);
  c.lineTo(L * 0.36, -H * 0.62);
  c.lineTo(L * 0.5, -H * 0.42);
  c.lineTo(L * 0.48, -H * 0.3);
  c.closePath();
  c.fill();
  c.fillStyle = P.hi;
  c.fillRect(-L * 0.45, -H * 0.63, L * 0.8, H * 0.012);
  c.fillStyle = P.dk;
  for (let k = 0; k < 12; k++) c.fillRect(-L * 0.42 + k * L * 0.07, -H * 0.6, H * 0.006, H * 0.28);
  for (let k = 0; k < 10; k++) {
    c.beginPath();
    c.arc(-L * 0.38 + k * L * 0.075, -H * 0.5, H * 0.018, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = P.red;
  c.fillRect(-L * 0.42, -H * 0.42, L * 0.84, H * 0.03);
  // The superstructure: bridge, funnels, the great gun, a crane.
  c.fillStyle = P.iron;
  c.fillRect(-L * 0.1, -H * 0.9, L * 0.16, H * 0.28);
  c.fillRect(-L * 0.06, -H * 1.04, L * 0.08, H * 0.14);
  c.fillStyle = P.dk;
  c.fillRect(-L * 0.08, -H * 0.84, L * 0.12, H * 0.04);
  c.fillRect(-L * 0.04, -H * 1.0, L * 0.04, H * 0.03);
  stacks(c, P, -L * 0.3, -H * 0.62, H * 0.38, H * 0.06, 2);
  c.fillStyle = P.iron;
  c.beginPath();
  c.roundRect(L * 0.14, -H * 0.8, L * 0.14, H * 0.18, H * 0.05);
  c.fill();
  const recoil = t - wk.gun < 0.3 ? -H * 0.06 : 0;
  limb(c, L * 0.27, -H * 0.72, L * 0.56 + recoil, -H * 0.78, H * 0.05, H * 0.035, P.dk);
  c.strokeStyle = P.dk;
  c.lineWidth = H * 0.012;
  c.beginPath();
  c.moveTo(-L * 0.42, -H * 0.62);
  c.lineTo(-L * 0.36, -H * 1.0);
  c.lineTo(-L * 0.52, -H * 0.86);
  c.lineTo(-L * 0.52, -H * 0.7);
  c.stroke();
}

function hexapod(c: CanvasRenderingContext2D, P: Pal, wk: Walker) {
  const H = wk.h;
  const ph = wk.phase;
  for (const near of [0, 1]) {
    for (let k = 0; k < 3; k++) {
      const p = ph + (k % 2 ? Math.PI : 0) + near * Math.PI;
      const hx = (k - 1) * H * 0.3;
      const hy = -H * 0.42;
      const fx = hx + (k - 1) * H * 0.18 + Math.sin(p) * H * 0.1;
      const fy = -Math.max(0, -Math.cos(p)) * H * 0.06;
      leg(c, P, hx, hy, hx + (k - 1) * H * 0.12, -H * 0.72, fx, fy, H * (near ? 0.045 : 0.038), near ? P.iron : P.dk, H * 0.08);
    }
    if (!near) {
      // The shell goes between the far legs and the near ones.
      c.fillStyle = P.iron;
      c.beginPath();
      c.ellipse(0, -H * 0.5, H * 0.48, H * 0.2, 0, Math.PI, 0);
      c.lineTo(H * 0.48, -H * 0.42);
      c.lineTo(-H * 0.48, -H * 0.42);
      c.fill();
      c.strokeStyle = P.dk;
      c.lineWidth = Math.max(0.4, H * 0.01);
      for (let q = -2; q <= 2; q++) {
        c.beginPath();
        c.moveTo(q * H * 0.16, -H * 0.42);
        c.quadraticCurveTo(q * H * 0.12, -H * 0.62, q * H * 0.06, -H * 0.69);
        c.stroke();
      }
      c.fillStyle = P.hi;
      c.beginPath();
      c.ellipse(-H * 0.1, -H * 0.62, H * 0.25, H * 0.04, -0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = P.dk;
      c.beginPath();
      c.ellipse(H * 0.5, -H * 0.46, H * 0.12, H * 0.09, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = P.dk;
      c.lineWidth = H * 0.025;
      c.beginPath();
      c.moveTo(H * 0.58, -H * 0.42);
      c.quadraticCurveTo(H * 0.7, -H * 0.4, H * 0.68, -H * 0.3);
      c.stroke();
      c.fillStyle = P.red;
      c.fillRect(-H * 0.05, -H * 0.5, H * 0.06, H * 0.05);
    }
  }
}

/** The walking fortress: a castle on four pillar legs, its towers, flags and batteries. */
function colossus(c: CanvasRenderingContext2D, P: Pal, wk: Walker, t: number) {
  const H = wk.h;
  const ph = wk.phase;
  const bob = Math.abs(Math.sin(ph)) * H * 0.008;
  for (const [hx, near] of [[-H * 0.3, 0], [H * 0.3, 0], [-H * 0.36, 1], [H * 0.36, 1]] as [number, number][]) {
    const p = ph + (hx > 0 ? 0 : Math.PI) + near * Math.PI * 0.5;
    const hy = -H * 0.5 + bob;
    const fx = hx + Math.sin(p) * H * 0.06;
    const fy = -Math.max(0, -Math.cos(p)) * H * 0.025;
    leg(c, P, hx, hy, hx + H * 0.02 * Math.sign(hx), (hy + fy) / 2, fx, fy, H * (near ? 0.08 : 0.07), near ? P.iron : P.dk, H * 0.14);
  }
  c.save();
  c.translate(0, bob);
  // The belly, with chains hanging.
  c.fillStyle = P.dk;
  c.beginPath();
  c.moveTo(-H * 0.48, -H * 0.56);
  c.quadraticCurveTo(0, -H * 0.38, H * 0.48, -H * 0.56);
  c.fill();
  c.strokeStyle = P.dk;
  c.lineWidth = Math.max(0.4, H * 0.004);
  for (let k = 0; k < 5; k++) {
    const x = -H * 0.3 + k * H * 0.15;
    c.beginPath();
    c.moveTo(x, -H * 0.47);
    c.quadraticCurveTo(x + Math.sin(t * 0.5 + k) * H * 0.02, -H * 0.36, x, -H * 0.28);
    c.stroke();
  }
  // The keep and its walls.
  c.fillStyle = P.iron;
  c.fillRect(-H * 0.48, -H * 0.86, H * 0.96, H * 0.32);
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fillRect(H * 0.24, -H * 0.86, H * 0.24, H * 0.32);
  for (let x = -H * 0.48; x < H * 0.48; x += H * 0.04) {
    c.fillStyle = P.iron;
    c.fillRect(x, -H * 0.89, H * 0.025, H * 0.03);
  }
  c.fillStyle = P.hi;
  c.fillRect(-H * 0.48, -H * 0.86, H * 0.96, H * 0.006);
  // The batteries along its side.
  for (let k = 0; k < 6; k++) {
    const gx = -H * 0.4 + k * H * 0.15;
    c.fillStyle = P.dk;
    c.fillRect(gx, -H * 0.8, H * 0.05, H * 0.035);
    limb(c, gx + H * 0.05, -H * 0.783, gx + H * 0.12, -H * 0.79, H * 0.014, H * 0.01, P.dk);
  }
  c.fillStyle = P.red;
  c.fillRect(-H * 0.48, -H * 0.7, H * 0.96, H * 0.012);
  // Windows, in rows.
  c.fillStyle = P.glass;
  for (let r = 0; r < 2; r++) for (let x = -H * 0.44; x < H * 0.44; x += H * 0.05) c.fillRect(x, -H * 0.66 + r * H * 0.05, H * 0.015, H * 0.025);
  // Towers: round ones at the corners, a great one in the middle.
  for (const [tx, tw, th, cap] of [[-H * 0.44, 0.1, 0.28, 0], [H * 0.44, 0.1, 0.24, 1], [-H * 0.16, 0.08, 0.2, 1], [H * 0.1, 0.14, 0.42, 2]] as [number, number, number, number][]) {
    const x0 = tx - (H * tw) / 2;
    const top = -H * 0.86 - H * th;
    c.fillStyle = P.iron;
    c.fillRect(x0, top, H * tw, H * th);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(x0 + H * tw * 0.65, top, H * tw * 0.35, H * th);
    c.fillStyle = P.glass;
    for (let y = top + H * 0.04; y < -H * 0.88; y += H * 0.07) c.fillRect(tx - H * 0.008, y, H * 0.016, H * 0.03);
    c.fillStyle = P.dk;
    if (cap === 0) {
      c.beginPath();
      c.moveTo(x0 - H * 0.01, top);
      c.lineTo(tx, top - H * 0.12);
      c.lineTo(x0 + H * tw + H * 0.01, top);
      c.fill();
    } else if (cap === 1) {
      for (let x = x0; x < x0 + H * tw; x += H * 0.025) c.fillRect(x, top - H * 0.02, H * 0.015, H * 0.02);
    } else {
      c.beginPath();
      c.ellipse(tx, top, H * tw * 0.5, H * 0.07, 0, Math.PI, 0);
      c.fill();
      c.fillRect(tx - H * 0.004, top - H * 0.16, H * 0.008, H * 0.1);
    }
    const wave = Math.sin(t * 3 + tx) * H * 0.01;
    c.strokeStyle = P.dk;
    c.lineWidth = Math.max(0.4, H * 0.004);
    c.beginPath();
    c.moveTo(tx, top - (cap === 0 ? H * 0.12 : H * 0.02));
    c.lineTo(tx, top - H * 0.2);
    c.stroke();
    c.fillStyle = P.red;
    c.beginPath();
    c.moveTo(tx, top - H * 0.2);
    c.lineTo(tx + H * 0.07, top - H * 0.18 + wave);
    c.lineTo(tx, top - H * 0.15);
    c.fill();
  }
  stacks(c, P, H * 0.26, -H * 0.86, H * 0.2, H * 0.03, 3);
  c.restore();
}

export function drawWalker(E: Env, wk: Walker, t: number) {
  const c = E.ctx;
  const f = wk.f;
  const P: Pal = {
    iron: E.tone('#3a3530', f, 0.15),
    hi: E.tone('#6a6258', f, 0.35),
    dk: E.tone('#24201c', f),
    red: E.tone(wk.team ? '#2a2a2a' : '#8a1c14', f, 0.1),
    brass: E.tone('#8a6a3a', f, 0.3),
    glass: E.tone('#141210', f),
  };
  if (wk.team === 1) {
    P.iron = E.tone('#2e3032', f, 0.12);
    P.dk = E.tone('#18191a', f);
  }
  const gy = E.world.groundAt(f);
  const H = wk.h;
  c.save();
  c.translate(wk.x, gy);
  c.scale(wk.dir, 1);
  if (wk.state === 'fall' || wk.state === 'down') {
    const k = wk.state === 'down' ? 1 : Math.min(1, (E.world.t - wk.t0) / 3);
    c.translate(H * 0.1, 0);
    c.rotate(k * k * Math.PI * 0.48);
    c.translate(-H * 0.1, wk.state === 'down' ? H * 0.06 : 0);
  }
  c.lineCap = 'round';
  switch (wk.kind) {
    case 'biped':
      biped(c, P, wk, t);
      break;
    case 'quad':
      quad(c, P, wk, t);
      break;
    case 'tripod':
      tripod(c, P, wk, t);
      break;
    case 'strider':
      strider(c, P, wk);
      break;
    case 'crawler':
      crawler(c, P, wk, t);
      break;
    case 'hexapod':
      hexapod(c, P, wk);
      break;
    case 'colossus':
      colossus(c, P, wk, t);
      break;
  }
  c.lineCap = 'butt';
  c.restore();
  if (wk.state === 'down') return;
  // Its eyes and lamps; its siren.
  const hz = E.hazeOf(f);
  const night = E.night();
  c.save();
  c.globalCompositeOperation = 'lighter';
  const eye: Record<string, [number, number, string]> = {
    biped: [0.13, 0.88, '#ffb060'], quad: [0.09, 0.94, '#ffb060'], tripod: [0.1, 0.94, '#a7f3d0'], strider: [0.1, 0.94, '#ffd08a'],
    crawler: [-0.05, 0.98, '#ffd08a'], hexapod: [0.55, 0.47, '#ff6040'], colossus: [0.1, 1.2, '#ffd08a'],
  };
  const [ex, ey, col] = eye[wk.kind];
  const x = wk.x + wk.dir * H * ex;
  const y = gy - H * ey;
  E.glow(x, y, H * 0.06, col, (0.5 + night * 0.5) * (1 - hz * 0.5));
  if (wk.kind === 'colossus' && night > 0.1) {
    c.fillStyle = hexA('#ffc878', 0.7 * night * (1 - hz * 0.5));
    for (let r = 0; r < 2; r++) for (let q = 0; q < 18; q++) if ((q * 7 + r * 3 + wk.seed) % 5 < 3) c.fillRect(wk.x + wk.dir * (-H * 0.44 + q * H * 0.05), gy - H * 0.66 + r * H * 0.05, H * 0.015, H * 0.025);
  }
  if (wk.kind === 'biped' && night > 0.3) {
    // Its searchlight, sweeping the street ahead.
    const ox = wk.x + wk.dir * H * 0.08;
    const oy = gy - H * 1.05;
    const a = Math.PI / 2 - wk.dir * (0.7 + Math.sin(t * 0.4 + wk.seed) * 0.3);
    const len = H * 1.4;
    const lg = c.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
    lg.addColorStop(0, hexA('#fff1d0', 0.25 * night * (1 - hz * 0.5)));
    lg.addColorStop(1, hexA('#fff1d0', 0));
    c.fillStyle = lg;
    c.beginPath();
    c.moveTo(ox, oy);
    c.lineTo(ox + Math.cos(a - 0.12) * len, oy + Math.sin(a - 0.12) * len);
    c.lineTo(ox + Math.cos(a + 0.12) * len, oy + Math.sin(a + 0.12) * len);
    c.fill();
  }
  if (wk.kind === 'tripod') E.glow(wk.x + wk.dir * H * 0.34, gy - H * 0.86, H * 0.05, '#86efac', 0.6 * (1 - hz * 0.5));
  if (E.world.t - wk.siren < 2) E.glow(x, y, H * 0.5, '#ff4030', 0.5 * (1 - (E.world.t - wk.siren) / 2));
  c.restore();
}
