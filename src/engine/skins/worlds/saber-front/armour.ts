/**
 * The war machines of the ground battle and the works of the field, each drawn as itself.
 *
 * Republic: the AT-RT (a clone riding a two-legged scout walker), the TX-130 saber tank (a wedge on
 * repulsors, twin cannons), the BARC speeder (a long bike with a sidecar gunner), the SPHA-T (a long
 * artillery walker carrying one enormous cannon). Separatist: the AAT (the rounded battle tank with its
 * turret gun), the dwarf spider droid, the MTT (the great bulbous transport whose face opens on a rack of
 * droids), the hailfire droid (two great hoops and its rocket pods), the crab droid, and the trident
 * assault ship coming up out of the sea.
 *
 * The works: sandbags, plasteel barricades, trenches, tank traps, rock, spires, crystal, ruins, logs,
 * crates and pylons, consoles and fuel tanks and parked fighters in a hangar; the Republic's command post
 * and bunker; the Separatist command tower, foundry, anti-air battery and blast doors.
 *
 * All drawn from the foot at (x, y), at scale `s` (world px per unit), facing `f`; colours toned for
 * distance `d`. Lights are pushed to `lamps` for the painter's light pass.
 */
import type { Env } from './scene';
import { hexA, mix } from './scene';
import type { Lamp } from './machines';
import type { Cover, Facility } from './terrain';

type G = CanvasRenderingContext2D;
const seg = (g: G, pts: number[], w: number, col: string) => {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
};
const poly = (g: G, pts: number[], col: string) => {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
};
const ell = (g: G, x: number, y: number, rx: number, ry: number, col: string, a0 = 0, a1 = Math.PI * 2) => {
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0, a1);
  g.fill();
};
const hsh = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export type VehicleLook = { kind: string; ph: number; aim: number; fire: number; legion: string; doors: number; seed: number; hover: number; dead?: boolean };

/** A vehicle, by kind. Returns the muzzle point in world pixels (for the flash). */
export function drawVehicle(E: Env, x: number, y: number, s: number, f: number, d: number, o: VehicleLook, lamps: Lamp[]): [number, number] {
  const g = E.ctx;
  const T = (c: string, lift = 0) => E.tone(c, d, lift);
  const lit = E.lx * f;
  g.save();
  g.translate(x, y);
  g.scale(f * s, s);
  let muzzle: [number, number] = [0, -20];
  const hover = o.hover;
  switch (o.kind) {
    case 'atrt': {
      // Two reverse-jointed legs, a small body, a clone in the saddle, a repeating cannon under the chin.
      const hull = T('#c8c6bc', 0.15);
      const dark = T('#5a5a58');
      for (const sd of [1, -1]) {
        const ph = o.ph * Math.PI * 2 + (sd > 0 ? 0 : Math.PI);
        const lift = Math.max(0, Math.sin(ph)) * 5;
        const fx = Math.cos(ph) * 8;
        seg(g, [0, -30, -8 + fx * 0.3, -16 - lift * 0.5, fx + 2, -lift], sd > 0 ? 4 : 3.4, sd > 0 ? hull : dark);
        poly(g, [fx - 4, -lift, fx + 7, -lift, fx + 5, -3 - lift, fx - 2, -3 - lift], dark);
      }
      poly(g, [-10, -36, 10, -38, 14, -30, -8, -27], hull);
      ell(g, 2, -33, 3, 3, dark);
      g.fillStyle = dark;
      g.fillRect(8, -30, 14, 2.4);
      // The rider.
      const armor = T('#e8e6de', 0.1);
      g.fillStyle = armor;
      g.fillRect(-4, -48, 6, 11);
      ell(g, 0, -51, 3.4, 3.6, armor);
      g.fillStyle = T('#101418');
      g.fillRect(1, -52, 2.6, 1.2);
      g.fillStyle = T(o.legion, 0.2);
      g.fillRect(-3, -54.5, 5, 1.2);
      muzzle = [22, -29];
      break;
    }
    case 'saber': {
      // A wedge on repulsors: the hull, the canopy, twin cannons on the flanks, the turret.
      const hull = T('#d0cec4', 0.12);
      const top = T('#f0eee6', 0.45);
      const dark = T('#4e5052');
      const mark = T(o.legion, 0.2);
      const yb = -10 - hover;
      poly(g, [-40, yb, 34, yb, 44, yb - 8, 36, yb - 16, -34, yb - 18, -42, yb - 10], hull);
      poly(g, [-34, yb - 18, 36, yb - 16, 30, yb - 20, -28, yb - 22], top);
      poly(g, [-40, yb, 34, yb, 30, yb + 3, -36, yb + 3], dark);
      g.fillStyle = mark;
      g.fillRect(-30, yb - 12, 50, 2.5);
      // The turret and its twin barrels.
      poly(g, [-14, yb - 22, 10, yb - 22, 6, yb - 30, -10, yb - 30], hull);
      g.save();
      g.translate(4, yb - 27);
      g.rotate(-o.aim);
      g.fillStyle = dark;
      g.fillRect(0, -3, 30 - o.fire * 4, 2);
      g.fillRect(0, 1, 30 - o.fire * 4, 2);
      g.restore();
      // The canopy.
      poly(g, [18, yb - 16, 30, yb - 14, 26, yb - 19, 18, yb - 19], T('#28384a', 0.3));
      // Side cannons.
      g.fillStyle = dark;
      g.fillRect(20, yb - 6, 22, 2);
      lamps.push({ x: x + f * s * -10, y: y + s * (yb + 4), r: 18 * s, color: '#9ad8ff', a: 0.35 });
      muzzle = [4 + Math.cos(-o.aim) * 30, yb - 27 + Math.sin(-o.aim) * 30];
      break;
    }
    case 'barc': {
      // The long speeder: twin forward prongs, the rider leaning in, a gunner's sidecar.
      const hull = T('#b8b6ac', 0.15);
      const dark = T('#3a3a3a');
      const yb = -8 - hover;
      poly(g, [-26, yb, 22, yb - 2, 34, yb - 4, 22, yb - 7, -22, yb - 8, -30, yb - 4], hull);
      seg(g, [20, yb - 6, 40, yb - 9], 2, dark);
      seg(g, [20, yb - 3, 40, yb - 5], 2, dark);
      ell(g, -4, yb + 2, 12, 3, dark);
      const armor = T('#e8e6de', 0.1);
      g.fillStyle = armor;
      g.fillRect(-6, yb - 16, 7, 9);
      ell(g, 0, yb - 18, 3.2, 3.4, armor);
      g.fillStyle = T(o.legion, 0.2);
      g.fillRect(-4, yb - 21, 5, 1.2);
      lamps.push({ x: x - f * s * 30, y: y + s * (yb - 4), r: 10 * s, color: '#9ad8ff', a: 0.7 });
      muzzle = [40, yb - 8];
      break;
    }
    case 'spha': {
      // A long armoured body on its many short legs, carrying one enormous gun, laid high.
      const hull = T('#c4c2b8', 0.1);
      const top = T('#eceae0', 0.45);
      const dark = T('#4a4a4c');
      for (let i = 0; i < 6; i++) {
        const lx = -60 + i * 22;
        const ph = o.ph * Math.PI * 2 + i;
        seg(g, [lx, -26, lx + 6, -14 - Math.max(0, Math.sin(ph)) * 2, lx + 2, 0], 4, i % 2 ? dark : hull);
      }
      poly(g, [-70, -26, 60, -26, 66, -38, -66, -42], hull);
      poly(g, [-66, -42, 66, -38, 60, -44, -60, -46], top);
      g.fillStyle = T(o.legion, 0.2);
      g.fillRect(-50, -34, 90, 3);
      // The great gun.
      g.save();
      g.translate(-30, -46);
      g.rotate(-0.42);
      poly(g, [-20, -8, 120, -6, 120, 6, -20, 8], hull);
      g.fillStyle = dark;
      g.fillRect(110, -7, 14, 14);
      g.fillStyle = T('#ff6040', 0.6);
      g.fillRect(118, -3, 6, 6);
      g.restore();
      muzzle = [-30 + Math.cos(-0.42) * 124, -46 + Math.sin(-0.42) * 124];
      if (o.fire > 0) lamps.push({ x: x + f * s * muzzle[0], y: y + s * muzzle[1], r: 60 * s * o.fire, color: '#ff4030', a: o.fire });
      break;
    }
    case 'aat': {
      // The AAT: a rounded hull on repulsors, side pods and laser cannons, the turret with its long gun, blue panels on tan.
      const hull = T('#a8946e', 0.12);
      const lt = T('#e0cca0', 0.5);
      const dark = T('#4a3e2c');
      const blue = T('#3a4a6a', 0.1);
      const yb = -8 - hover;
      g.fillStyle = hull;
      g.beginPath();
      g.moveTo(-40, yb);
      g.quadraticCurveTo(-44, yb - 18, -20, yb - 22);
      g.lineTo(26, yb - 20);
      g.quadraticCurveTo(46, yb - 14, 44, yb);
      g.closePath();
      g.fill();
      ell(g, lit > 0 ? 10 : -10, yb - 19, 20, 3, hexA(lt, 0.6));
      poly(g, [-40, yb, 44, yb, 38, yb + 4, -36, yb + 4], dark);
      // The forward pods and their small cannons.
      ell(g, 34, yb - 8, 10, 7, hull);
      g.fillStyle = dark;
      g.fillRect(40, yb - 10, 14, 2);
      g.fillRect(40, yb - 6, 12, 2);
      g.fillStyle = blue;
      g.fillRect(-26, yb - 14, 16, 5);
      g.fillRect(-4, yb - 14, 16, 5);
      // The turret and main gun.
      ell(g, -6, yb - 24, 15, 7, hull);
      g.save();
      g.translate(0, yb - 26);
      g.rotate(-o.aim);
      g.fillStyle = dark;
      g.fillRect(0, -2, 42 - o.fire * 5, 4);
      g.fillRect(38 - o.fire * 5, -3, 5, 6);
      g.restore();
      lamps.push({ x: x + f * s * 0, y: y + s * (yb + 5), r: 22 * s, color: '#ffb070', a: 0.3 });
      muzzle = [Math.cos(-o.aim) * 44, yb - 26 + Math.sin(-o.aim) * 44];
      break;
    }
    case 'dsd': {
      // A dwarf spider droid: a round body on four legs, the long blaster forward, the red eye.
      const shell = T('#7a6a56', 0.12);
      const dark = T('#2e2822');
      for (const [lx, sd] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
        const ph = o.ph * Math.PI * 2 + lx * 1.5 + sd;
        const lift = Math.max(0, Math.sin(ph)) * 3;
        seg(g, [lx * 4, -14, lx * 12, -20, lx * 18 + Math.cos(ph) * 2, -lift], sd < 0 ? 2.4 : 3, sd < 0 ? dark : shell);
      }
      ell(g, 0, -16, 10, 8, shell);
      ell(g, lit * 3, -20, 5, 2.4, hexA(T('#c8b090', 0.5), 0.6));
      g.fillStyle = dark;
      g.fillRect(8, -17, 18, 2.6);
      ell(g, 9, -14, 2, 2, '#ff3a2a');
      muzzle = [26, -16];
      break;
    }
    case 'mtt': {
      // The great bulbous transport: long hull, the face, the doors opening on the rack of droids.
      const hull = T('#a88e66', 0.12);
      const lt = T('#e8d2a8', 0.5);
      const dark = T('#4a3c2a');
      const blue = T('#3a4a6a', 0.1);
      const yb = -10 - hover;
      g.fillStyle = hull;
      g.beginPath();
      g.moveTo(-80, yb);
      g.quadraticCurveTo(-86, yb - 40, -40, yb - 52);
      g.lineTo(40, yb - 50);
      g.quadraticCurveTo(80, yb - 44, 84, yb - 18);
      g.quadraticCurveTo(84, yb, 70, yb);
      g.closePath();
      g.fill();
      ell(g, 0, yb - 49, 40, 4, hexA(lt, 0.6));
      poly(g, [-80, yb, 70, yb, 64, yb + 5, -74, yb + 5], dark);
      g.fillStyle = blue;
      for (let i = 0; i < 5; i++) g.fillRect(-60 + i * 22, yb - 32, 12, 6);
      // The face: the bulb, the "eyes".
      ell(g, 72, yb - 26, 16, 18, hull);
      ell(g, 80, yb - 30, 4, 3, dark);
      ell(g, 80, yb - 20, 4, 3, dark);
      if (o.doors > 0) {
        // The face splits and swings open; the rack slides out with the droids folded on it.
        const k = o.doors;
        g.fillStyle = '#120e0a';
        g.fillRect(60, yb - 44, 26 * k, 40);
        g.fillStyle = T('#5a4a36');
        g.fillRect(64 + 30 * k, yb - 38, 30 * k, 4);
        for (let i = 0; i < 4; i++) {
          g.fillStyle = T('#b8945e', 0.1);
          g.fillRect(66 + 30 * k + i * 6 * k, yb - 34, 2.5, 10);
        }
        lamps.push({ x: x + f * s * 72, y: y + s * (yb - 24), r: 30 * s, color: '#ffc080', a: 0.35 * k });
      }
      muzzle = [86, yb - 14];
      break;
    }
    case 'hailfire': {
      // Two great hoops, the slim body between them, a rocket pod each side, the red eye.
      const hull = T('#7a6a56', 0.12);
      const dark = T('#2a2420');
      const rot = o.ph * 2;
      for (const [cx, near] of [[-6, false], [6, true]] as [number, boolean][]) {
        g.strokeStyle = near ? hull : dark;
        g.lineWidth = 4;
        g.beginPath();
        g.ellipse(cx, -22, 20, 22, 0, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = dark;
        g.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const a = rot + (i * Math.PI) / 3;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * 18, -22 + Math.sin(a) * 20);
          g.lineTo(cx + Math.cos(a) * 21, -22 + Math.sin(a) * 23);
          g.stroke();
        }
        if (!near) {
          ell(g, 0, -24, 8, 6, hull);
          poly(g, [-4, -30, 10, -30, 12, -38, -2, -38], T('#5a4a3a'));
          for (let i = 0; i < 3; i++) ell(g, 0 + i * 4, -34, 1.3, 1.3, T('#d8c8a0', 0.4));
          seg(g, [6, -24, 22, -30], 2, hull);
          ell(g, 22, -30, 2.5, 2.5, '#ff3a2a');
        }
      }
      muzzle = [4, -38];
      break;
    }
    case 'crab': {
      // A crab droid: a broad flat shell on pointed legs, twin blasters, eyes in a row.
      const shell = T('#6a6450', 0.12);
      const dark = T('#2a2620');
      for (let i = 0; i < 3; i++)
        for (const sd of [-1, 1]) {
          const lx = -14 + i * 14;
          const ph = o.ph * Math.PI * 2 + i * 2 + sd;
          const lift = Math.max(0, Math.sin(ph)) * 3;
          seg(g, [lx, -14, lx + sd * 6, -22, lx + sd * 10, -lift], sd < 0 ? 2.4 : 3, sd < 0 ? dark : shell);
        }
      g.fillStyle = shell;
      g.beginPath();
      g.moveTo(-26, -14);
      g.quadraticCurveTo(0, -30, 26, -14);
      g.lineTo(20, -10);
      g.lineTo(-20, -10);
      g.fill();
      for (let i = 0; i < 3; i++) ell(g, 14 + i * 3, -18, 1.4, 1.4, '#ff4a30');
      g.fillStyle = dark;
      g.fillRect(18, -14, 14, 2);
      muzzle = [32, -13];
      break;
    }
    default:
      break;
  }
  g.restore();
  return [x + f * s * muzzle[0], y + s * muzzle[1]];
}

/** A trident assault ship rising out of the sea: a tall body, four claws reaching for the rail. */
export function drawTrident(E: Env, x: number, y: number, s: number, d: number, rise: number, doors: number, lamps: Lamp[]) {
  const g = E.ctx;
  const hull = E.tone('#6a7078', d, 0.12);
  const dark = E.tone('#2a2e34', d, 0);
  const lit = E.tone('#a8b0b8', d, 0.45);
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // Clip at the deck's edge: below is sea.
  g.beginPath();
  g.rect(-200, -400, 400, 400);
  g.clip();
  const up = rise * 140;
  // Claws.
  for (const sd of [-1, 1])
    for (const k of [0, 1]) {
      const bx = sd * (14 + k * 8);
      seg(g, [bx, 40 - up, bx + sd * (20 + k * 10), -10 - up + 60, bx + sd * (30 + k * 12), 30 - up + 60], k ? 4 : 5, k ? dark : hull);
    }
  // The body.
  poly(g, [-16, 60 - up, 16, 60 - up, 12, -40 - up + 60, 0, -60 - up + 60, -12, -40 - up + 60], hull);
  g.fillStyle = hexA(lit, 0.6);
  g.fillRect(E.lx > 0 ? 4 : -9, -30 - up + 60, 5, 80);
  for (let i = 0; i < 4; i++) ell(g, 0, -20 + i * 18 - up + 60, 4, 3, i === 0 ? '#ff4a30' : dark);
  if (doors > 0) lamps.push({ x, y: y - (up - 40) * s, r: 30 * s, color: '#ff9a60', a: 0.4 * doors });
  g.restore();
}

// ---- the field's works ---------------------------------------------------------------------------------
/** A piece of cover. `m` is the scale at its distance (world px per ground unit). */
export function drawCover(E: Env, c: Cover, x: number, y: number, m: number, f: number, legion: string, lamps: Lamp[]) {
  const g = E.ctx;
  const d = c.d;
  const T = (col: string, lift = 0) => E.tone(col, d, lift);
  const w = c.w * m;
  const h = c.h * m;
  const lx = E.lx;
  const broken = c.hp <= 0;
  const shadow = () => ell(g, x - lx * w * 0.15, y + 1, w * 0.6, Math.max(1, w * 0.08), hexA('#000000', 0.25 * (1 - E.hazeOf(d))));
  switch (c.kind) {
    case 'sandbags': {
      shadow();
      const bag = T('#9a8a64', 0.15);
      const bagLit = T('#d8c8a0', 0.5);
      const rows = broken ? 1 : 3;
      for (let rI = 0; rI < rows; rI++) {
        const n = Math.max(2, Math.round((w / (h * 0.9)) * (1 - rI * 0.2)));
        for (let i = 0; i < n; i++) {
          const bx = x - w / 2 + (i + 0.5 + rI * 0.25) * (w / n) * (1 - rI * 0.15);
          const by = y - h * 0.18 - rI * h * 0.32;
          ell(g, bx, by, (w / n) * 0.56, h * 0.2, bag);
          ell(g, bx + lx * w * 0.01, by - h * 0.07, (w / n) * 0.36, h * 0.07, hexA(bagLit, 0.55));
        }
      }
      break;
    }
    case 'barricade': {
      shadow();
      if (c.side === 'cf') {
        // Separatist blast walls: dark durasteel slabs, orange-marked.
        const slab = T('#4a4440', 0.1);
        const n = broken ? 1 : 3;
        for (let i = 0; i < n; i++) {
          const bx = x - w / 2 + (i / 3) * w;
          poly(E.ctx, [bx, y, bx + w * 0.3, y, bx + w * 0.28, y - h, bx + w * 0.04, y - h * 0.94], slab);
          g.fillStyle = T('#c8702a', 0.2);
          g.fillRect(bx + w * 0.06, y - h * 0.6, w * 0.18, h * 0.08);
          g.fillStyle = hexA(T('#8a847c', 0.4), 0.6);
          g.fillRect(bx + (lx > 0 ? w * 0.22 : w * 0.04), y - h * 0.98, w * 0.05, h * 0.9);
        }
      } else {
        // Republic plasteel barriers: grey panels on struts, yellow and black bands.
        const panel = T('#8a8e92', 0.12);
        const n = broken ? 1 : 3;
        for (let i = 0; i < n; i++) {
          const bx = x - w / 2 + (i / 3) * w + w * 0.02;
          poly(g, [bx, y - h * 0.15, bx + w * 0.3, y - h * 0.15, bx + w * 0.3, y - h, bx, y - h], panel);
          g.fillStyle = T('#d8b030', 0.25);
          g.fillRect(bx, y - h * 0.9, w * 0.3, h * 0.12);
          g.fillStyle = T('#202020');
          for (let k = 0; k < 4; k++) g.fillRect(bx + k * w * 0.075, y - h * 0.9, w * 0.035, h * 0.12);
          g.fillStyle = T('#3a3a3a');
          g.fillRect(bx + w * 0.04, y - h * 0.15, w * 0.03, h * 0.15);
          g.fillRect(bx + w * 0.23, y - h * 0.15, w * 0.03, h * 0.15);
        }
      }
      break;
    }
    case 'trench': {
      // A dark cut in the ground with a heaped lip toward the enemy, and sandbags on it.
      ell(g, x, y + h * 0.1, w * 0.55, h * 0.45, hexA(T('#100c08'), 0.85));
      const lip = T(E.L.ground2, 0.2);
      g.fillStyle = lip;
      g.beginPath();
      g.moveTo(x - w * 0.55, y - h * 0.1);
      g.quadraticCurveTo(x, y - h * 1.1, x + w * 0.55, y - h * 0.1);
      g.lineTo(x + w * 0.5, y + h * 0.05);
      g.quadraticCurveTo(x, y - h * 0.4, x - w * 0.5, y + h * 0.05);
      g.fill();
      const bag = T('#9a8a64', 0.15);
      for (let i = 0; i < 6; i++) ell(g, x - w * 0.4 + i * w * 0.16, y - h * 0.7 - Math.sin((i / 5) * Math.PI) * h * 0.25, w * 0.08, h * 0.22, bag);
      void f;
      break;
    }
    case 'tanktrap': {
      shadow();
      const steel = T('#5a5450', 0.15);
      const n = broken ? 1 : 3;
      for (let i = 0; i < n; i++) {
        const bx = x - w / 2 + (i + 0.5) * (w / 3);
        seg(g, [bx - h * 0.5, y, bx + h * 0.5, y - h], Math.max(1, h * 0.12), steel);
        seg(g, [bx + h * 0.5, y, bx - h * 0.5, y - h], Math.max(1, h * 0.12), steel);
        seg(g, [bx, y + h * 0.05, bx, y - h * 0.9], Math.max(1, h * 0.1), T('#3a3430'));
      }
      break;
    }
    case 'crate':
    case 'console':
    case 'fuel': {
      shadow();
      if (c.kind === 'fuel') {
        const tank = T('#8a3a2a', 0.15);
        for (const k of [-0.25, 0.25]) {
          ell(g, x + k * w, y - h * 0.5, w * 0.2, h * 0.5, tank);
          ell(g, x + k * w + lx * w * 0.06, y - h * 0.6, w * 0.06, h * 0.32, hexA(T('#e8a080', 0.5), 0.6));
        }
        g.fillStyle = T('#d8d0c0', 0.3);
        g.fillRect(x - w * 0.45, y - h * 0.55, w * 0.9, h * 0.06);
      } else if (c.kind === 'console') {
        poly(g, [x - w / 2, y, x + w / 2, y, x + w * 0.4, y - h, x - w * 0.4, y - h * 0.8], T('#3a3e46', 0.1));
        for (let i = 0; i < 6; i++) {
          g.fillStyle = hexA(i % 2 ? '#ff8040' : '#60c0ff', 0.8);
          g.fillRect(x - w * 0.3 + i * w * 0.1, y - h * 0.7, w * 0.05, h * 0.06);
        }
        lamps.push({ x, y: y - h * 0.7, r: w * 0.5, color: '#60c0ff', a: 0.25 });
      } else {
        const side = T('#6a7078', 0.1);
        const top = T('#a8b0b8', 0.45);
        poly(g, [x - w / 2, y, x + w / 2, y, x + w / 2, y - h, x - w / 2, y - h], side);
        poly(g, [x - w / 2, y - h, x - w / 2 + w * 0.15, y - h - h * 0.2, x + w / 2 + w * 0.15, y - h - h * 0.2, x + w / 2, y - h], top);
        g.fillStyle = T('#c8a030', 0.2);
        g.fillRect(x - w / 2, y - h * 0.55, w, h * 0.1);
      }
      break;
    }
    case 'pylon': {
      g.fillStyle = T('#3a4048', 0.1);
      g.fillRect(x - w * 0.06, y - h * 2, w * 0.12, h * 2);
      g.fillRect(x - w * 0.25, y - h * 2, w * 0.5, h * 0.1);
      lamps.push({ x, y: y - h * 2.05, r: w * 0.8, color: E.L.accent, a: 0.5 * (0.4 + E.night) });
      break;
    }
    case 'fighter': {
      // A parked starfighter on the deck: a V-wing for the Republic, a vulture droid folded on its legs for the droids.
      shadow();
      if (c.side === 'ga') {
        poly(g, [x - w / 2, y - h * 0.3, x + w / 2, y - h * 0.4, x + w * 0.2, y - h * 0.55, x - w * 0.4, y - h * 0.5], T('#d8d6ce', 0.2));
        poly(g, [x - w * 0.1, y - h * 0.5, x - w * 0.3, y - h * 1.3, x - w * 0.2, y - h * 1.3, x + w * 0.05, y - h * 0.5], T('#b8b6ae', 0.1));
        g.fillStyle = T(legion, 0.2);
        g.fillRect(x - w * 0.3, y - h * 0.45, w * 0.3, h * 0.06);
        seg(g, [x - w * 0.2, y - h * 0.3, x - w * 0.2, y], 1.5, T('#3a3a3a'));
        seg(g, [x + w * 0.2, y - h * 0.35, x + w * 0.2, y], 1.5, T('#3a3a3a'));
      } else {
        const hull = T('#8a7458', 0.15);
        for (const sd of [-1, 1]) seg(g, [x + sd * w * 0.15, y - h * 0.6, x + sd * w * 0.45, y - h * 0.1, x + sd * w * 0.5, y], Math.max(1, h * 0.12), hull);
        poly(g, [x - w * 0.25, y - h * 0.55, x + w * 0.35, y - h * 0.6, x + w * 0.2, y - h * 0.8, x - w * 0.2, y - h * 0.75], hull);
        ell(g, x + w * 0.3, y - h * 0.65, 2, 2, '#7ab8ff');
      }
      break;
    }
    default:
      // The land's own: rock, boulders, spires, crystal, ruins, logs, stumps, fungi, walls, reef rocks.
      drawNatural(E, c, x, y, w, h, lamps);
  }
  if (broken) {
    for (let i = 0; i < 5; i++) ell(g, x + (hsh(c.seed, i) - 0.5) * w, y - 1, w * 0.06, h * 0.08, T('#3a3430'));
  }
}

function drawNatural(E: Env, c: Cover, x: number, y: number, w: number, h: number, lamps: Lamp[]) {
  const g = E.ctx;
  const d = c.d;
  const T = (col: string, lift = 0) => E.tone(col, d, lift);
  const lx = E.lx;
  const style = c.kind;
  const rockish = style === 'rock' || style === 'boulder' || style === 'spire' || style === 'wall' || style === 'reef';
  ell(g, x - lx * w * 0.25, y + 1, w * 0.65, Math.max(1, w * 0.1), hexA('#000000', 0.28 * (1 - E.hazeOf(d))));
  if (rockish) {
    const base = T(style === 'reef' ? '#4a4a48' : style === 'wall' ? '#a07a58' : '#8a5a3c', 0.05);
    const litC = T(style === 'reef' ? '#9a9a90' : style === 'wall' ? '#e0b088' : '#e0a068', 0.5);
    const dark = T('#2a1810');
    const n = 12;
    g.fillStyle = base;
    g.beginPath();
    g.moveTo(x - w / 2, y + 1);
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      const prof = style === 'spire' ? 0.55 + 0.25 * Math.sin(q * 5 + c.seed) : style === 'wall' ? (hsh(c.seed, i) < 0.3 ? 0.5 : 1) : Math.pow(Math.sin(q * Math.PI), 0.55);
      const hh = style === 'spire' ? h * Math.pow(Math.sin(q * Math.PI), 0.25) : h * prof * (0.85 + hsh(c.seed, i) * 0.25);
      g.lineTo(x - w / 2 + q * w + (style === 'spire' ? (0.5 - q) * w * 0.4 : 0), y - hh);
    }
    g.lineTo(x + w / 2, y + 1);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(lx > 0 ? 1 : 0, hexA(litC, 0.75 * (0.4 + E.L.rim * 0.6)));
    gr.addColorStop(0.55, hexA(litC, 0));
    gr.addColorStop(lx > 0 ? 0 : 1, hexA(dark, 0.55));
    g.fillStyle = gr;
    g.fillRect(x - w, y - h * 1.2, w * 2, h * 1.3);
    g.fillStyle = hexA(dark, 0.35);
    for (let i = 1; i < 5; i++) g.fillRect(x - w, y - h * (i / 5) + hsh(c.seed, i) * 3, w * 2, Math.max(0.5, h * 0.02));
    if (style === 'wall') for (let i = 0; i < 3; i++) g.fillRect(x - w * 0.3 + i * w * 0.25, y - h * 0.7, w * 0.08, h * 0.25);
    g.restore();
    if (style === 'reef') ell(g, x, y + 2, w * 0.7, h * 0.12, hexA(T('#8ab8c8', 0.4), 0.4));
    return;
  }
  if (style === 'crystal' || style === 'ruin') {
    if (style === 'ruin') {
      // A broken wall of the city, its windows blown out, crystal growing through it.
      const stone = T('#4a5478', 0.1);
      const face = T('#8a98c8', 0.45);
      g.fillStyle = stone;
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x - w / 2, y - h * 0.8);
      for (let i = 0; i <= 6; i++) g.lineTo(x - w / 2 + (i / 6) * w, y - h * (0.6 + hsh(c.seed, i) * 0.4));
      g.lineTo(x + w / 2, y);
      g.fill();
      g.fillStyle = hexA(face, 0.5);
      g.fillRect(lx > 0 ? x + w * 0.3 : x - w / 2, y - h * 0.8, w * 0.2, h * 0.8);
      g.fillStyle = T('#0c0e1a');
      for (let i = 0; i < 3; i++) g.fillRect(x - w * 0.35 + i * w * 0.25, y - h * 0.6, w * 0.12, h * 0.2);
    }
    for (let i = 0; i < 4; i++) {
      const ox = (hsh(c.seed, i) - 0.5) * w * 0.8;
      const ch = h * (style === 'ruin' ? 0.35 : 0.5 + hsh(c.seed, i + 3) * 0.6);
      const cw = Math.max(1.5, w * 0.12);
      const lean = (hsh(c.seed, i + 7) - 0.5) * 0.7;
      const tx = x + ox + Math.sin(lean) * ch;
      poly(g, [x + ox - cw / 2, y, tx - cw / 2, y - ch, tx, y - ch - cw, tx + cw / 2, y - ch, x + ox + cw / 2, y], T('#4a6ab8', 0.1));
      poly(g, [x + ox, y, tx, y - ch - cw, tx + (lx > 0 ? cw / 2 : -cw / 2), y - ch, x + ox + (lx > 0 ? cw / 2 : -cw / 2), y], hexA(T('#9ac8ff', 0.5), 0.6));
      lamps.push({ x: tx, y: y - ch * 0.6, r: cw * 4, color: E.L.accent, a: 0.2 * (0.4 + E.night) });
    }
    return;
  }
  if (style === 'log' || style === 'stump') {
    const bark = T('#3a2e22', 0.05);
    const litC = T('#7a6a4a', 0.4);
    if (style === 'log') {
      ell(g, x, y - h * 0.45, w * 0.5, h * 0.45, bark);
      ell(g, x, y - h * 0.7, w * 0.42, h * 0.12, hexA(litC, 0.5));
      ell(g, x + w * 0.5, y - h * 0.45, h * 0.2, h * 0.42, T('#8a6a48', 0.3));
      ell(g, x + w * 0.5, y - h * 0.45, h * 0.1, h * 0.22, T('#5a4430', 0.1));
    } else {
      poly(g, [x - w * 0.4, y, x + w * 0.4, y, x + w * 0.3, y - h * 1.4, x + w * 0.1, y - h * 1.2, x - w * 0.15, y - h * 1.5, x - w * 0.3, y - h * 1.3], bark);
      g.fillStyle = hexA(litC, 0.5);
      g.fillRect(lx > 0 ? x + w * 0.1 : x - w * 0.3, y - h * 1.3, w * 0.15, h * 1.25);
    }
    return;
  }
  if (style === 'fungus') {
    const stem = T('#c8b8a8', 0.2);
    const capC = T(E.L.accent === '#ff9ad0' || E.L.accent === '#ffb0e0' ? '#d86a9a' : '#6a8aa8', 0.15);
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * w * 0.3;
      const fh = h * (1.4 + hsh(c.seed, i) * 1.4);
      const cw = w * (0.2 + hsh(c.seed, i + 4) * 0.2);
      g.fillStyle = stem;
      g.fillRect(x + ox - cw * 0.12, y - fh, cw * 0.24, fh);
      ell(g, x + ox, y - fh, cw, cw * 0.4, capC, Math.PI, Math.PI * 2);
      ell(g, x + ox + lx * cw * 0.2, y - fh - cw * 0.2, cw * 0.5, cw * 0.12, hexA(T('#ffffff', 0.5), 0.3));
      lamps.push({ x: x + ox, y: y - fh + 2, r: cw * 1.4, color: E.L.accent, a: 0.25 * (0.3 + E.night) });
    }
  }
}

/** The armies' works: the Republic's command post and bunker; the Separatists' tower, foundry, battery and blast doors. */
export function drawFacility(E: Env, fc: Facility, x: number, y: number, m: number, f: number, legion: string, t: number, lamps: Lamp[]) {
  const g = E.ctx;
  const d = fc.d;
  const T = (col: string, lift = 0) => E.tone(col, d, lift);
  const s = m * fc.s;
  const ruin = fc.state === 'ruin';
  const lx = E.lx;
  ell(g, x - lx * 20 * s, y + 2 * s, 110 * s, 12 * s, hexA('#000000', 0.25 * (1 - E.hazeOf(d))));
  g.save();
  g.translate(x, y);
  g.scale(f * s, s);
  const blink = (px: number, py: number, color: string, k = 1) => {
    if (Math.sin(t * 3 + fc.seed) > 0.3) lamps.push({ x: x + f * px * s, y: y + py * s, r: 10 * s * k, color, a: 0.9 });
  };
  switch (fc.kind) {
    case 'post': {
      // Prefab shelters with rounded roofs, a comm mast, a holo-table glowing between them, the legion's banner.
      const wall = T('#b8b8b0', 0.12);
      const roof = T('#e0e0d8', 0.4);
      const dark = T('#3a3c40');
      for (const [hx, w] of [[-60, 60], [20, 70]] as [number, number][]) {
        if (ruin && hx > 0) {
          poly(g, [hx - w / 2, 0, hx + w / 2, 0, hx + w * 0.3, -14, hx - w * 0.2, -24], T('#2a2826'));
          continue;
        }
        g.fillStyle = wall;
        g.fillRect(hx - w / 2, -30, w, 30);
        g.fillStyle = roof;
        g.beginPath();
        g.ellipse(hx, -30, w / 2, 10, 0, Math.PI, Math.PI * 2);
        g.fill();
        g.fillStyle = dark;
        g.fillRect(hx - 6, -20, 12, 20);
        g.fillStyle = T(legion, 0.2);
        g.fillRect(hx - w / 2, -16, w, 3);
        g.fillStyle = hexA('#ffe0a0', 0.6 * (0.4 + E.night));
        g.fillRect(hx + w * 0.25, -24, 6, 4);
      }
      seg(g, [70, 0, 70, -110], 2, dark);
      seg(g, [62, -90, 78, -90], 1.5, dark);
      seg(g, [64, -70, 76, -70], 1.5, dark);
      blink(70, -112, '#ff4030');
      // The holo-table.
      g.fillStyle = dark;
      g.fillRect(-18, -12, 16, 12);
      lamps.push({ x: x + f * -10 * s, y: y - 22 * s, r: 26 * s, color: '#7fd6ff', a: 0.55 + 0.2 * Math.sin(t * 9) });
      // The banner.
      seg(g, [-100, 0, -100, -70], 1.6, dark);
      poly(g, [-100, -70, -76, -66, -100, -54], T(legion, 0.25));
      break;
    }
    case 'bunker': {
      const conc = T('#8a8678', 0.12);
      const lt = T('#d8d0c0', 0.45);
      g.fillStyle = conc;
      g.beginPath();
      g.moveTo(-50, 0);
      g.lineTo(-40, -30);
      g.lineTo(40, -32);
      g.lineTo(50, 0);
      g.fill();
      g.fillStyle = hexA(lt, 0.5);
      g.fillRect(-40, -32, 80, 4);
      if (!ruin) {
        g.fillStyle = '#100c08';
        g.fillRect(-20, -22, 50, 6);
        lamps.push({ x: x + f * 5 * s, y: y - 19 * s, r: 16 * s, color: '#ffb060', a: 0.4 });
      } else poly(g, [-40, -30, -10, -44, 10, -30], T('#2a2826'));
      break;
    }
    case 'tower': {
      // The Separatist command tower: a tall tapered spire on a flared base, a bulb of antennae at its crown, red lights.
      const hull = T('#7a6a5a', 0.12);
      const lt = T('#d8c0a0', 0.45);
      const dark = T('#2a2420');
      if (ruin) {
        poly(g, [-34, 0, 34, 0, 18, -40, 6, -60, -4, -46, -14, -70, -22, -36], dark);
        break;
      }
      poly(g, [-34, 0, 34, 0, 14, -40, 10, -190, -10, -190, -14, -40], hull);
      g.fillStyle = hexA(lt, 0.5);
      g.fillRect(lx > 0 ? 2 : -9, -186, 7, 150);
      ell(g, 0, -200, 22, 14, hull);
      ell(g, lx * 6, -206, 10, 4, hexA(lt, 0.6));
      seg(g, [0, -214, 0, -250], 2, dark);
      seg(g, [-14, -206, -26, -236], 1.5, dark);
      seg(g, [14, -206, 26, -232], 1.5, dark);
      for (let i = 0; i < 5; i++) blink(i % 2 ? 9 : -9, -60 - i * 28, '#ff3a2a', 0.8);
      blink(0, -252, '#ff3a2a', 1.4);
      g.fillStyle = hexA('#ffb060', 0.5 * (0.4 + E.night));
      for (let i = 0; i < 6; i++) g.fillRect(-4, -170 + i * 22, 8, 3);
      break;
    }
    case 'factory': {
      // The Geonosian foundry: a great organic mound with chimney spires and furnace mouths glowing.
      const shell = T('#9a6a48', 0.1);
      const lt = T('#e0a070', 0.45);
      g.fillStyle = shell;
      g.beginPath();
      g.moveTo(-140, 0);
      g.quadraticCurveTo(-130, -110, -40, -130);
      g.quadraticCurveTo(40, -150, 110, -90);
      g.quadraticCurveTo(150, -40, 150, 0);
      g.fill();
      g.fillStyle = hexA(lt, 0.4);
      g.beginPath();
      g.ellipse(lx * 40, -120, 60, 12, 0, 0, Math.PI * 2);
      g.fill();
      for (const cx of [-60, 10, 70]) {
        poly(g, [cx - 8, -110, cx + 8, -112, cx + 4, -190, cx - 4, -190], shell);
        if (!ruin) lamps.push({ x: x + f * cx * s, y: y - 192 * s, r: 16 * s, color: '#ff8a40', a: 0.5 });
      }
      for (const cx of [-80, -20, 40, 100]) {
        g.fillStyle = '#100804';
        g.beginPath();
        g.ellipse(cx, -26, 14, 18, 0, Math.PI, Math.PI * 2);
        g.fill();
        if (!ruin) lamps.push({ x: x + f * cx * s, y: y - 22 * s, r: 30 * s, color: '#ff7a30', a: 0.6 + 0.2 * Math.sin(t * 2 + cx) });
      }
      break;
    }
    case 'battery': {
      // The anti-air battery: a turret on a platform, two long barrels laid up at the sky.
      const hull = T('#6a5e50', 0.12);
      const dark = T('#2a2420');
      poly(g, [-40, 0, 40, 0, 32, -14, -32, -14], hull);
      if (ruin) {
        seg(g, [-10, -14, 30, -6], 4, dark);
        break;
      }
      ell(g, 0, -20, 18, 10, hull);
      g.save();
      g.translate(0, -24);
      g.rotate(-1);
      g.fillStyle = dark;
      g.fillRect(0, -6, 60, 4);
      g.fillRect(0, 2, 60, 4);
      g.restore();
      blink(0, -22, '#ff3a2a', 0.6);
      break;
    }
    case 'hangar-door': {
      // The blast doors at the back of the bay, half open, red light spilling out.
      const metal = T('#4a4c54', 0.12);
      const dark = T('#16181c');
      g.fillStyle = metal;
      g.fillRect(-120, -200, 240, 200);
      g.fillStyle = dark;
      g.fillRect(-60, -160, 120, 160);
      g.fillStyle = T('#5a5c64', 0.2);
      g.fillRect(-60, -160, 30, 160);
      g.fillRect(30, -160, 30, 160);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = T('#d8b030', 0.2);
        g.fillRect(-120 + i * 40, -200, 20, 8);
      }
      lamps.push({ x, y: y - 80 * s, r: 120 * s, color: '#ff4030', a: 0.35 });
      blink(-90, -180, '#ff3a2a');
      blink(90, -180, '#ff3a2a');
      break;
    }
    default:
      break;
  }
  g.restore();
  void mix;
}
