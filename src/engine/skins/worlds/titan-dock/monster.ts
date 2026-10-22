/**
 * The monsters out of the rift, drawn: five kinds, each its own anatomy, all of them heavy, dark
 * and wet, with the rift's light in them (eyes, mouths, the seams of the hide, the veins).
 *
 * Unit space as for the mechs: one unit tall standing, feet at the origin, facing +x. Every mass
 * is a smooth closed shape through a few points, filled dark with the light on its top and its
 * underside in shadow, its hide scaled, a rim of light along its back. The crab is a high
 * serrated shell on six spider legs, with two great claws; the winged one a stooped brute whose
 * folded wings stand over its back like spires and spread to fly; the horned one hunched forward
 * under a knife of a crest; the glowing-veined one an ape-like giant laced with light, its throat
 * full of acid; the serpent a heavy body in the water and a long neck in an S, frilled and finned.
 */
import { hash } from '../../instruments/kit';
import { clamp01, hexA, mix, type Env } from './look';
import type { Monster } from './types';

export type Beast = {
  /** Lunge forward, rear up (0..1), jaw open, the front limb's reach, the wings out, the tail's swing, the throat's glow. */
  lunge: number; rear: number; jaw: number; reach: number; wing: number; tail: number; throat: number; walk: number; pinch: number;
};

export function beastOf(q: Monster, t: number): Beast {
  const b: Beast = { lunge: 0, rear: 0, jaw: 0.12 + 0.08 * Math.sin(t * 1.3 + q.seed), reach: 0, wing: q.flying, tail: Math.sin(t * 0.9 + q.seed) * 0.3, throat: 0.2, walk: q.ph, pinch: 0.4 + 0.3 * Math.sin(t * 2 + q.seed) };
  if (q.state === 'rising' || (q.state === 'advance' && Math.sin(t * 0.4 + q.seed) > 0.85)) {
    // The roar.
    b.rear = 0.7;
    b.jaw = 0.6 + 0.4 * Math.abs(Math.sin(t * 3));
  }
  const a = q.act;
  if (!a) return b;
  const k = clamp01((t - a.t0) / a.dur);
  const env = (k0: number, k1: number, k2: number) => (k < k0 ? 0 : k < k1 ? (k - k0) / (k1 - k0) : k < k2 ? 1 : 1 - clamp01((k - k2) / (1 - k2)));
  switch (a.kind) {
    case 'claw':
    case 'smash':
      b.rear = env(0, 0.4, 0.5) * (k < 0.5 ? 1 : 0) * (a.kind === 'smash' ? 1 : 0.5);
      b.reach = env(0.42, 0.55, 0.7);
      b.lunge = b.reach * 0.08;
      b.jaw = 0.5;
      break;
    case 'bite':
      b.rear = env(0, 0.35, 0.45) * (k < 0.48 ? 1 : 0) * 0.6;
      b.lunge = env(0.42, 0.52, 0.65) * 0.16;
      b.jaw = k < 0.5 ? env(0, 0.4, 1) : 1 - env(0.5, 0.55, 1);
      break;
    case 'acid':
      b.rear = env(0, 0.4, 0.5) * 0.7;
      b.throat = 0.2 + env(0.1, 0.45, 0.6) * 0.8;
      b.jaw = env(0.35, 0.5, 0.7);
      b.lunge = env(0.45, 0.52, 0.7) * 0.05;
      break;
    case 'charge':
      b.lunge = env(0.35, 0.55, 0.7) * 0.3;
      b.rear = -0.3 * env(0.2, 0.45, 0.7);
      b.jaw = 0.6;
      break;
    case 'pincer':
      b.reach = env(0.2, 0.5, 0.75);
      b.pinch = k < 0.5 ? 1 : 0;
      break;
    case 'wing':
      b.wing = Math.max(b.wing, env(0, 0.25, 0.9));
      b.rear = 0.4;
      b.reach = env(0.5, 0.6, 0.8);
      break;
    case 'tail':
      b.tail = -1 + 2 * env(0.35, 0.55, 0.8);
      b.lunge = -0.04;
      break;
  }
  return b;
}

type Pt = [number, number];

export function drawMonster(E: Env, q: Monster, x: number, y: number, s: number, dir: number, b: Beast, o: { d: number; from: number; t: number; water?: number | null; tilt?: number; left?: number }) {
  const c = E.ctx;
  // Kept a little out of the night's ink, so the hide still reads against the dark sea.
  const T = (col: string, lift = 0) => mix(E.tone(col, o.d, lift + 0.2), col, 0.3 * (1 - E.hazeOf(o.d)));
  const ink = E.L.ink;
  const hide = T(q.colors.hide);
  const dark = T(q.colors.dark);
  const belly = T(q.colors.belly);
  const haze = E.hazeOf(o.d);
  const key = mix(E.L.key, E.L.glow, E.L.night * 0.5);
  const glow = q.colors.glow;
  const lw = 1 / s;
  const dead = q.state === 'dying' || q.state === 'carcass';
  const glowA = (dead ? Math.max(0, 0.6 - (o.t - q.t0) * 0.02) : 0.95) * (1 - haze * 0.6);
  c.save();
  if (o.water != null) {
    c.beginPath();
    c.rect(x - s * 4, y - s * 4, s * 8, o.water - (y - s * 4));
    c.clip();
  }
  c.translate(x, y);
  if (o.tilt) c.rotate(-o.tilt * dir);
  c.scale(s * dir, s);
  c.translate(b.lunge, 0);
  c.lineJoin = 'round';
  c.lineCap = 'round';

  /** A smooth closed shape through the points (Catmull-Rom as curves). */
  const smooth = (pts: Pt[], closed = true) => {
    const n = pts.length;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    if (closed) c.closePath();
  };
  const box = (pts: Pt[]) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [px, py] of pts) {
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
    return { x0, y0, x1, y1 };
  };
  /** A mass of the body: dark, lit from above, its underside in shadow, scaled, rimmed with light. */
  const mass = (pts: Pt[], o2: { base?: string; far?: boolean; scales?: number; seams?: Pt[][]; seed?: number } = {}) => {
    const base = o2.far ? mix(o2.base ?? hide, ink, 0.45) : o2.base ?? hide;
    const bb = box(pts);
    smooth(pts);
    const g = c.createLinearGradient(0, bb.y0, 0, bb.y1);
    g.addColorStop(0, mix(base, key, 0.22 + E.flash * 0.4));
    g.addColorStop(0.45, base);
    g.addColorStop(1, mix(base, ink, 0.55));
    c.fillStyle = g;
    c.fill();
    c.save();
    c.clip();
    // The belly's shadow and the light along the top.
    const sh = c.createRadialGradient((bb.x0 + bb.x1) / 2, bb.y1, 0, (bb.x0 + bb.x1) / 2, bb.y1, (bb.x1 - bb.x0) * 0.7);
    sh.addColorStop(0, hexA(ink, 0.55));
    sh.addColorStop(1, hexA(ink, 0));
    c.fillStyle = sh;
    c.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
    // Scales: rows of small arcs.
    const sc = o2.scales ?? 0.035;
    if (sc > 0 && s * sc > 3) {
      c.strokeStyle = hexA(mix(base, ink, 0.6), 0.5);
      c.lineWidth = lw;
      c.beginPath();
      let row = 0;
      for (let yy = bb.y0; yy < bb.y1; yy += sc * 0.8) {
        for (let xx = bb.x0 + (row % 2) * sc * 0.5; xx < bb.x1; xx += sc) {
          if (hash(o2.seed ?? q.seed, Math.round(xx * 100), Math.round(yy * 100)) < 0.35) continue;
          c.moveTo(xx - sc * 0.45, yy);
          c.quadraticCurveTo(xx, yy + sc * 0.5, xx + sc * 0.45, yy);
        }
        row++;
      }
      c.stroke();
    }
    c.restore();
    // Rim light on the upper edge, from the city and the lightning.
    smooth(pts);
    const rg = c.createLinearGradient(0, bb.y0, 0, bb.y0 + (bb.y1 - bb.y0) * 0.6);
    rg.addColorStop(0, hexA(mix(key, glow, 0.25), (0.55 + E.flash * 0.4) * (1 - haze) * (o2.far ? 0.4 : 1)));
    rg.addColorStop(1, hexA(key, 0));
    c.strokeStyle = rg;
    c.lineWidth = lw * 2;
    c.stroke();
    c.strokeStyle = hexA(ink, 0.5);
    c.lineWidth = lw;
    for (const sm of o2.seams ?? []) seam(sm, o2.far ? 0.3 : 0.7);
  };
  /** A line of the rift's light in the hide. */
  const seam = (path: Pt[], a = 0.6, w = 1.8) => {
    if (glowA <= 0) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const pulse = 0.75 + 0.25 * Math.sin(o.t * 2 + q.seed);
    c.strokeStyle = hexA(glow, a * 0.35 * glowA * pulse);
    c.lineWidth = lw * w * 3;
    smooth(path, false);
    c.stroke();
    c.strokeStyle = hexA(mix(glow, '#ffffff', 0.3), a * glowA * pulse);
    c.lineWidth = lw * w;
    c.stroke();
    c.restore();
  };
  const eye = (ex: number, ey: number, r: number) => {
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(ex, ey, r * 6, glow, 0.7 * glowA);
    c.fillStyle = hexA(mix(glow, '#ffffff', 0.6), glowA);
    c.beginPath();
    c.ellipse(ex, ey, r * 1.4, r * 0.6, -0.25, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };
  /** A limb: a tapered mass from a to b. */
  const limb = (a: Pt, bpt: Pt, w0: number, w1: number, far = false, base?: string) => {
    const an = Math.atan2(bpt[1] - a[1], bpt[0] - a[0]) + Math.PI / 2;
    const cx = Math.cos(an);
    const cy = Math.sin(an);
    mass([[a[0] + (cx * w0) / 2, a[1] + (cy * w0) / 2], [(a[0] + bpt[0]) / 2 + (cx * (w0 + w1)) / 3.6, (a[1] + bpt[1]) / 2 + (cy * (w0 + w1)) / 3.6], [bpt[0] + (cx * w1) / 2, bpt[1] + (cy * w1) / 2], [bpt[0] - (cx * w1) / 2, bpt[1] - (cy * w1) / 2], [(a[0] + bpt[0]) / 2 - (cx * (w0 + w1)) / 4.4, (a[1] + bpt[1]) / 2 - (cy * (w0 + w1)) / 4.4], [a[0] - (cx * w0) / 2, a[1] - (cy * w0) / 2]], { far, scales: 0.03, base });
  };
  const claws = (hx: number, hy: number, ang: number, len: number, n = 3) => {
    c.fillStyle = T('#d8d0c0', 0.2);
    for (let k = 0; k < n; k++) {
      const a = ang + (k - (n - 1) / 2) * 0.35;
      c.beginPath();
      c.moveTo(hx + Math.cos(a + 1.4) * len * 0.12, hy + Math.sin(a + 1.4) * len * 0.12);
      c.quadraticCurveTo(hx + Math.cos(a) * len * 0.8, hy + Math.sin(a) * len * 0.8 - len * 0.1, hx + Math.cos(a + 0.4) * len, hy + Math.sin(a + 0.4) * len);
      c.lineTo(hx + Math.cos(a - 1.4) * len * 0.12, hy + Math.sin(a - 1.4) * len * 0.12);
      c.fill();
    }
  };
  /** Jaws hinged at (hx, hy): upper and lower, teeth between, the mouth's light. */
  const jaws = (hx: number, hy: number, len: number, open: number, ang = 0) => {
    c.save();
    c.translate(hx, hy);
    c.rotate(ang);
    const op = open * 0.6;
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(len * 0.4, len * 0.05, len * (0.4 + open * 0.6), glow, (0.25 + 0.6 * open) * glowA);
    c.restore();
    // Lower jaw.
    c.save();
    c.rotate(op * 0.5);
    mass([[0, 0], [len * 0.55, len * 0.06], [len * 1.0, len * 0.04], [len * 0.95, len * 0.16], [len * 0.4, len * 0.24], [0, len * 0.18]], { base: belly, scales: 0 });
    c.fillStyle = T('#e8e0d0', 0.3);
    for (let k = 1; k < 7; k++) {
      const tx = (k / 7) * len * 0.92;
      c.beginPath();
      c.moveTo(tx - len * 0.035, len * 0.05);
      c.lineTo(tx, len * (-0.05 - hash(q.seed, k) * 0.05));
      c.lineTo(tx + len * 0.035, len * 0.05);
      c.fill();
    }
    c.restore();
    // Upper jaw and snout.
    c.save();
    c.rotate(-op * 0.25);
    c.fillStyle = T('#e8e0d0', 0.3);
    for (let k = 1; k < 7; k++) {
      const tx = (k / 7) * len * 0.95;
      c.beginPath();
      c.moveTo(tx - len * 0.035, -len * 0.02);
      c.lineTo(tx, len * (0.08 + hash(q.seed, k, 2) * 0.05));
      c.lineTo(tx + len * 0.035, -len * 0.02);
      c.fill();
    }
    mass([[0, -len * 0.3], [len * 0.5, -len * 0.26], [len * 1.08, -len * 0.08], [len * 1.02, 0], [len * 0.4, 0.0], [0, len * 0.02]], { scales: 0.025 });
    c.restore();
    c.restore();
  };

  const L = o.left ?? 1;
  const walk = b.walk;
  if (q.kind === 'horned') {
    // Hunched forward over its arms, a knife of a crest over its head, plates down its back.
    const far: Pt = [0.08, -0.7];
    limb(far, [0.24 + b.reach * 0.1, -0.42], 0.13, 0.1, true);
    limb([0.24 + b.reach * 0.1, -0.42], [0.42 + b.reach * 0.25, -0.18 - b.reach * 0.12], 0.1, 0.09, true);
    for (const side of [1, 0]) {
      const ph = walk + side * Math.PI;
      limb([-0.16 + side * 0.12, -0.42], [-0.14 + Math.sin(ph) * 0.05 + side * 0.12, 0.02], 0.2, 0.15, side === 1);
    }
    const rear = b.rear * 0.08;
    const body: Pt[] = [[-0.42, -0.36], [-0.46, -0.56], [-0.3, -0.8 - rear], [-0.04, -0.93 - rear], [0.18, -0.88 - rear], [0.34, -0.76 - rear], [0.44, -0.62 - rear * 0.5], [0.36, -0.48], [0.22, -0.36], [-0.05, -0.3], [-0.28, -0.3]];
    // Plates down the back.
    for (let k = 0; k < 8; k++) {
      const v = 0.08 + k * 0.1;
      const bx = -0.44 + v * 0.75;
      const by = -0.6 - Math.sin(v * Math.PI) * 0.33 - rear;
      const h = 0.06 + Math.sin(v * Math.PI) * 0.07;
      mass([[bx - 0.05, by + 0.03], [bx - 0.01, by - h], [bx + 0.05, by + 0.03]], { base: dark, scales: 0 });
    }
    mass(body, { scales: 0.035, seams: [[[-0.36, -0.5], [-0.15, -0.62], [0.1, -0.66], [0.3, -0.6]], [[-0.3, -0.42], [-0.05, -0.5], [0.18, -0.48]]] });
    // The head, low and forward; the crest, a long blade forward and up.
    const hx = 0.4;
    const hy = -0.62 - rear * 0.5;
    jaws(hx, hy, 0.24, b.jaw, 0.15 - b.rear * 0.3);
    mass([[hx - 0.06, hy - 0.02], [hx + 0.04, hy - 0.12], [hx + 0.5, hy - 0.32], [hx + 0.58, hy - 0.36], [hx + 0.28, hy - 0.16], [hx + 0.12, hy - 0.02]], { base: T('#9a9488', 0.1), scales: 0 });
    c.strokeStyle = hexA(mix('#ffffff', glow, 0.3), 0.6 * (1 - haze));
    c.lineWidth = lw * 1.5;
    c.beginPath();
    c.moveTo(hx + 0.04, hy - 0.12);
    c.lineTo(hx + 0.58, hy - 0.36);
    c.stroke();
    eye(hx + 0.1, hy - 0.08, 0.012);
    // Near arm, thick, clawed.
    const ra = b.reach;
    limb([0.18, -0.68], [0.32 + ra * 0.18, -0.42 - ra * 0.1], 0.15, 0.12);
    limb([0.32 + ra * 0.18, -0.42 - ra * 0.1], [0.5 + ra * 0.32, -0.2 - ra * 0.25], 0.12, 0.1);
    claws(0.5 + ra * 0.32, -0.2 - ra * 0.25, 0.6 - ra * 0.8, 0.12);
  } else if (q.kind === 'crab') {
    // Six legs, jointed and spiked, down into the water; a high serrated shell; claws raised.
    for (let k = 0; k < 3; k++)
      for (const side of [1, 0]) {
        const ph = walk + k * 2.1 + side * Math.PI;
        const hx = -0.38 + k * 0.3 + (side ? 0.06 : 0);
        const kx = hx + (side ? 0.2 : -0.16) + Math.sin(ph) * 0.05;
        const ky = -0.74 + Math.cos(ph) * 0.03;
        limb([hx, -0.44], [kx, ky], 0.08, 0.06, side === 1);
        limb([kx, ky], [kx + (side ? 0.16 : -0.06), 0.04], 0.06, 0.025, side === 1);
      }
    const cw = 0.64;
    const shell: Pt[] = [];
    for (let k = 0; k <= 14; k++) {
      const a = Math.PI + (k / 14) * Math.PI;
      const rr = 1 + (k % 2 ? 0.06 : -0.02);
      shell.push([Math.cos(a) * cw * rr, -0.46 + Math.sin(a) * 0.42 * rr - b.rear * 0.04]);
    }
    shell.push([cw * 0.8, -0.38], [0, -0.32], [-cw * 0.85, -0.38]);
    mass(shell, { scales: 0.045, seams: [[[-0.46, -0.56], [-0.2, -0.72], [0.12, -0.74], [0.4, -0.6]], [[-0.3, -0.45], [0, -0.52], [0.3, -0.45]]] });
    // Ridges across the shell.
    c.strokeStyle = hexA(ink, 0.5);
    c.lineWidth = lw * 1.5;
    for (let k = 1; k < 4; k++) {
      c.beginPath();
      c.ellipse(0, -0.46, cw * (k / 4), 0.42 * (k / 4), 0, Math.PI * 1.08, Math.PI * 1.92);
      c.stroke();
    }
    for (const [sx, sy, h] of [[-0.48, -0.74, 0.1], [-0.22, -0.86, 0.13], [0.04, -0.89, 0.15], [0.28, -0.82, 0.12], [0.48, -0.68, 0.09]] as const) mass([[sx - 0.04, sy + 0.04], [sx + 0.02, sy - h], [sx + 0.05, sy + 0.04]], { base: dark, scales: 0 });
    // Eyes on stalks, the mouthparts glowing under the lip.
    for (const k of [0, 1]) {
      c.strokeStyle = dark;
      c.lineWidth = lw * 4;
      c.beginPath();
      c.moveTo(0.4 + k * 0.08, -0.56);
      c.lineTo(0.44 + k * 0.1, -0.72);
      c.stroke();
      eye(0.44 + k * 0.1, -0.73, 0.016);
    }
    jaws(0.52, -0.42, 0.16, b.jaw, 0.4);
    // Two great claws.
    for (const side of [0, 1]) {
      const reach = side ? b.reach : b.reach * 0.4;
      const far = side === 0;
      const sx = 0.48 - side * 0.04;
      const sy = -0.5 + side * 0.04;
      const ex = sx + 0.2 + reach * 0.25;
      const ey = sy - 0.18 + reach * 0.06;
      limb([sx, sy], [ex, ey], 0.12, 0.1, far);
      const cx2 = ex + 0.18 + reach * 0.12;
      mass([[ex - 0.02, ey - 0.08], [cx2, ey - 0.12], [cx2 + 0.06, ey], [cx2, ey + 0.1], [ex, ey + 0.08]], { far, scales: 0.03 });
      const open = (side ? b.pinch : 0.3) * 0.5;
      for (const jw of [-1, 1]) mass([[cx2 - 0.02, ey + jw * 0.02], [cx2 + 0.14, ey + jw * (0.08 + open * 0.08)], [cx2 + 0.24, ey + jw * open * 0.14], [cx2 + 0.08, ey + jw * 0.03]], { far, base: jw < 0 ? hide : dark, scales: 0 });
    }
  } else if (q.kind === 'winged') {
    // Folded wings stand over its back like spires; spread, they fill the sky.
    const lean = 0.3 - b.rear * 0.35;
    const wingDraw = (far: boolean) => {
      const w = b.wing;
      const flap = w > 0.3 ? Math.sin(o.t * 4.5 + q.seed) * 0.3 * w : 0;
      const root: Pt = [-0.02, -0.76];
      const tips: Pt[] = [];
      for (let k = 0; k < 4; k++) {
        // Folded: the fingers up and back. Spread: fanned wide.
        const folded = -Math.PI / 2 - 0.35 - k * 0.12;
        const spread = -Math.PI / 2 + 0.5 - k * 0.55;
        const a = folded + (spread - folded) * w - flap + (far ? 0.12 : 0);
        const len = (0.5 + w * (0.5 - k * 0.07)) * (far ? 0.85 : 1);
        tips.push([root[0] + Math.cos(a) * len * (0.7 + w * 0.6), root[1] + Math.sin(a) * len]);
      }
      c.beginPath();
      c.moveTo(root[0], root[1]);
      tips.forEach(([tx, ty], i) => {
        if (i === 0) c.lineTo(tx, ty);
        else {
          const [px2, py2] = tips[i - 1];
          c.quadraticCurveTo((px2 + tx) / 2 + 0.03, (py2 + ty) / 2 + 0.1, tx, ty);
        }
      });
      c.quadraticCurveTo(-0.25, -0.5, -0.1, -0.58);
      c.closePath();
      const mem = far ? mix(dark, ink, 0.5) : mix(dark, hide, 0.35);
      const mg = c.createLinearGradient(0, -1.4, 0, -0.5);
      mg.addColorStop(0, hexA(mix(mem, key, 0.15), 0.96));
      mg.addColorStop(1, hexA(mem, 0.96));
      c.fillStyle = mg;
      c.fill();
      c.strokeStyle = hexA(far ? ink : mix(hide, key, 0.3), 0.95);
      c.lineWidth = lw * 2.4;
      c.beginPath();
      for (const [tx, ty] of tips) {
        c.moveTo(root[0], root[1]);
        c.quadraticCurveTo((root[0] + tx) / 2 + 0.03, (root[1] + ty) / 2, tx, ty);
      }
      c.stroke();
      if (!far) for (const [tx, ty] of tips) seam([[root[0], root[1]], [(root[0] + tx) / 2 + 0.03, (root[1] + ty) / 2], [tx, ty]], 0.3, 1.2);
      c.fillStyle = T('#d8d0c0', 0.2);
      for (const [tx, ty] of tips) {
        c.beginPath();
        c.arc(tx, ty, 0.012, 0, Math.PI * 2);
        c.fill();
      }
    };
    wingDraw(true);
    for (const side of [1, 0]) {
      const ph = walk + side * Math.PI;
      limb([-0.06 + side * 0.08, -0.5], [0.06 + Math.sin(ph) * 0.06, -0.26], 0.15, 0.1, side === 1);
      limb([0.06 + Math.sin(ph) * 0.06, -0.26], [-0.04 + Math.sin(ph) * 0.08, 0.02], 0.09, 0.06, side === 1);
    }
    mass([[-0.12, -0.46], [-0.52, -0.42 + b.tail * 0.08], [-0.9, -0.28 + b.tail * 0.2], [-0.5, -0.34 + b.tail * 0.08], [-0.12, -0.38]], { scales: 0.03 });
    c.save();
    c.translate(0, -0.5);
    c.rotate(lean);
    mass([[-0.2, 0.02], [-0.24, -0.18], [-0.08, -0.34], [0.12, -0.33], [0.2, -0.16], [0.17, 0.03], [-0.02, 0.06]], { scales: 0.035, seams: [[[-0.12, -0.04], [-0.02, -0.18], [0.1, -0.26]]] });
    c.restore();
    // The neck and the head, crested.
    const hx = 0.32 + b.lunge * 0.5;
    const hy = -0.9 - b.rear * 0.12;
    mass([[0.02, -0.74], [0.12, -0.92], [hx - 0.04, hy - 0.06], [hx + 0.04, hy + 0.04], [0.2, -0.78], [0.14, -0.64]], { scales: 0.025 });
    for (let k = 0; k < 4; k++) mass([[hx - 0.06 - k * 0.05, hy - 0.03], [hx - 0.12 - k * 0.06, hy - 0.16 + k * 0.02], [hx - 0.02 - k * 0.05, hy - 0.04]], { base: dark, scales: 0 });
    jaws(hx - 0.02, hy, 0.2, b.jaw, 0.2 - b.rear * 0.4);
    eye(hx + 0.04, hy - 0.04, 0.011);
    wingDraw(false);
    limb([0.1, -0.7], [0.22 + b.reach * 0.2, -0.56 - b.reach * 0.05], 0.06, 0.045);
    claws(0.22 + b.reach * 0.2, -0.56 - b.reach * 0.05, 0.8, 0.06);
  } else if (q.kind === 'veined') {
    // Upright, ape-built: thick legs, a broad back, long arms, a head that splits; a net of light.
    limb([0.12, -0.78], [0.26 + b.reach * 0.1, -0.5], 0.13, 0.11, true);
    limb([0.26 + b.reach * 0.1, -0.5], [0.32 + b.reach * 0.25, -0.2 - b.reach * 0.15], 0.11, 0.12, true);
    for (const side of [1, 0]) {
      const ph = walk + side * Math.PI;
      limb([-0.06 + side * 0.1, -0.46], [0.0 + Math.sin(ph) * 0.05 + side * 0.06, -0.22], 0.18, 0.14, side === 1);
      limb([0.0 + Math.sin(ph) * 0.05 + side * 0.06, -0.22], [Math.sin(ph) * 0.07 + side * 0.06, 0.02], 0.14, 0.12, side === 1);
    }
    const r2 = b.rear * 0.06;
    mass([[-0.2, -0.42], [-0.3, -0.66], [-0.18, -0.88 - r2], [0.04, -0.98 - r2], [0.22, -0.9 - r2], [0.28, -0.7], [0.2, -0.46], [0, -0.38]], { scales: 0.04 });
    for (let k = 0; k < 11; k++) {
      const pts: Pt[] = [];
      let vx = -0.2 + hash(q.seed, k) * 0.38;
      let vy = -0.44 - hash(q.seed, k, 1) * 0.1;
      for (let j = 0; j < 5; j++) {
        pts.push([vx, vy]);
        vx += (hash(q.seed, k * 7 + j, 2) - 0.5) * 0.1;
        vy -= 0.06 + hash(q.seed, k * 7 + j, 3) * 0.05;
      }
      seam(pts, 0.85, 1.4);
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(0.2, -0.78, 0.14 + 0.1 * b.throat, '#c8ff5a', (0.25 + 0.7 * b.throat) * glowA);
    c.restore();
    const hx = 0.2;
    const hy = -0.92 - r2;
    jaws(hx, hy + 0.02, 0.17, b.jaw, 0.15 - b.rear * 0.4);
    mass([[hx - 0.08, hy - 0.02], [hx - 0.02, hy - 0.11], [hx + 0.12, hy - 0.08], [hx + 0.14, hy - 0.01], [hx, hy + 0.02]], { scales: 0 });
    eye(hx + 0.07, hy - 0.05, 0.012);
    const ra = b.reach;
    limb([-0.04, -0.82], [0.14 + ra * 0.2, -0.58 - ra * 0.12], 0.15, 0.12);
    limb([0.14 + ra * 0.2, -0.58 - ra * 0.12], [0.22 + ra * 0.38, -0.3 - ra * 0.32], 0.12, 0.14);
    claws(0.22 + ra * 0.38, -0.3 - ra * 0.32, 1.2 - ra, 0.08);
    seam([[-0.02, -0.8], [0.14 + ra * 0.2, -0.58 - ra * 0.12], [0.22 + ra * 0.38, -0.32 - ra * 0.32]], 0.7, 1.3);
  } else {
    // The serpent: coils behind, a heavy body in the water, a long neck in an S, frills and fins.
    for (let k = 0; k < 3; k++) {
      const cx2 = -0.6 - k * 0.3;
      const h = 0.2 - k * 0.04 + Math.sin(o.t * 0.8 + k + b.tail) * 0.02;
      mass([[cx2 - 0.15, 0], [cx2 - 0.1, -h], [cx2 + 0.1, -h], [cx2 + 0.15, 0]], { scales: 0.03 });
      mass([[cx2 - 0.03, -h + 0.02], [cx2, -h - 0.07], [cx2 + 0.04, -h + 0.02]], { base: dark, scales: 0 });
    }
    mass([[-0.5, -0.06], [-0.4, -0.34], [0, -0.44], [0.32, -0.34], [0.42, -0.06]], { scales: 0.04, seams: [[[-0.36, -0.2], [-0.1, -0.32], [0.2, -0.28]]] });
    const hx = 0.34 + b.lunge * 0.6;
    const hy = -1.0 - b.rear * 0.1 + Math.sin(o.t * 0.7 + q.seed) * 0.02;
    const spine: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const v = k / 10;
      spine.push([0.06 + (hx - 0.06) * v + Math.sin(v * Math.PI * 1.6) * 0.14 * (1 - v * 0.4), -0.32 + (hy + 0.32) * v]);
    }
    const left: Pt[] = spine.map(([px2, py2], i): Pt => [px2 - 0.1 * (1 - (i / 10) * 0.5), py2]);
    const right: Pt[] = spine.map(([px2, py2], i): Pt => [px2 + 0.1 * (1 - (i / 10) * 0.5), py2]).reverse();
    for (let k = 2; k < 10; k += 2) {
      const [fx2, fy2] = spine[k];
      mass([[fx2 - 0.08, fy2 + 0.02], [fx2 - 0.2, fy2 - 0.05], [fx2 - 0.08, fy2 - 0.06]], { base: mix(dark, glow, 0.12), scales: 0 });
    }
    mass([...left, ...right], { scales: 0.03, seams: [spine.filter((_, i) => i % 2 === 0).map(([px2, py2]) => [px2 + 0.03, py2] as Pt)] });
    // The frill, fanned behind the head.
    c.save();
    const fg = c.createRadialGradient(hx - 0.04, hy, 0, hx - 0.04, hy, 0.2);
    fg.addColorStop(0, hexA(mix(dark, glow, 0.35), 0.95));
    fg.addColorStop(1, hexA(mix(dark, glow, 0.1), 0.9));
    c.fillStyle = fg;
    c.beginPath();
    c.moveTo(hx - 0.04, hy);
    for (let k = 0; k <= 8; k++) {
      const a = -Math.PI * 0.95 + (k / 8) * Math.PI * 0.9;
      const rr = k % 2 ? 0.15 : 0.19;
      c.lineTo(hx - 0.04 + Math.cos(a) * rr, hy + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.restore();
    jaws(hx, hy + 0.01, 0.17, b.jaw, 0.1 - b.rear * 0.4);
    mass([[hx - 0.07, hy], [hx - 0.02, hy - 0.08], [hx + 0.12, hy - 0.06], [hx + 0.14, hy], [hx + 0.02, hy + 0.02]], { scales: 0 });
    eye(hx + 0.06, hy - 0.035, 0.011);
    if (b.throat > 0.3) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      E.glow(hx - 0.02, hy + 0.06, 0.12, '#c8ff5a', b.throat * 0.8);
      c.restore();
    }
  }
  // A carcass being cut up: the ribs showing where the salvage crews have been.
  if (L < 0.95) {
    c.strokeStyle = hexA(T('#d8d0c0', 0.2), 0.9);
    c.lineWidth = lw * 2.5;
    const n = Math.floor((1 - L) * 10);
    for (let k = 0; k < n; k++) {
      const rx = -0.35 + k * 0.08;
      c.beginPath();
      c.moveTo(rx, -0.3);
      c.quadraticCurveTo(rx + 0.05, -0.6, rx + 0.02, -0.72);
      c.stroke();
    }
  }
  c.restore();
}
