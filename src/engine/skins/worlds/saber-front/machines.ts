/**
 * The machines of the battle, each drawn with its real shape: the six-legged assault walker (a long
 * armoured body in two sections, six jointed legs in a tripod gait, the great gun on its back), the
 * spider walker (a domed body slung between four long arched legs, the cannon underneath), the troop
 * gunship (bulbous canopy, bubble turrets on the wing roots, the bay doors that slide open on the
 * squad inside, its engines), the Confederacy's lander (a pod under a great hooked wing, the ramp in
 * its belly), starfighters (the Grand Army's arrowheads, the droids' forked vultures, bombers), the
 * capital ships (a wedge cruiser with its twin bridge towers, a long-spined frigate with its great
 * prow, a core sphere), wrecks, and the shield generator under its dome.
 *
 * Shapes on the ground are drawn from the foot at (x, y), at scale `s` (world px per unit), facing
 * `f`; colours toned for distance `d`. Lights (engines, lamps, glowing gun mouths) are returned or
 * drawn in the light pass by the painter.
 */
import type { Env } from './scene';
import { hexA, mix } from './scene';

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
const hsh = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export type Lamp = { x: number; y: number; r: number; color: string; a: number };

// ---- the six-legged assault walker ---------------------------------------------------------------------
/** The walker: 1 unit is about 1/140 of its length. Returns where its gun's mouth is. */
export function drawHexa(E: Env, x: number, y: number, s: number, f: number, d: number, o: { ph: number; legion: string; aim: number; fire: number; tilt?: number; sink?: number; wreck?: boolean; seed: number }): [number, number] {
  const g = E.ctx;
  const hull = E.tone('#c4c2b8', d, 0.08);
  const hullLit = E.tone('#f0eee4', d, 0.45);
  const hullDark = E.tone('#6a6a66', d, 0);
  const metal = E.tone('#4a4a4c', d, 0);
  const mark = E.tone(o.legion, d, 0.15);
  const glass = E.tone('#1a2230', d, 0);
  const lit = E.lx * f;
  g.save();
  g.translate(x, y + (o.sink ?? 0) * s);
  g.scale(f * s, s);
  if (o.tilt) g.rotate(o.tilt);
  const bodyY = -40;
  // The legs: three on the far side (darker), the body, three on the near side.
  const legAt = [-46, -4, 38];
  const leg = (i: number, near: boolean) => {
    const hip = legAt[i];
    const phase = o.ph * Math.PI * 2 + (i % 2 ? Math.PI : 0) + (near ? 0 : Math.PI);
    const lift = o.wreck ? 0 : Math.max(0, Math.sin(phase)) * 6;
    const stride = o.wreck ? (i - 1) * 10 : Math.cos(phase) * 9;
    // The thigh goes up and out from the hip to a knee standing above the hull's belly; the shin comes down to a broad pad.
    const fx = hip + 14 + stride;
    const kx = hip + 9 + stride * 0.35;
    const ky = o.wreck ? bodyY + 14 : bodyY - 12 - lift * 0.3;
    const col = near ? hull : hullDark;
    seg(g, [hip, bodyY + 2, kx, ky], near ? 10 : 9, col);
    seg(g, [kx, ky, fx, -4 - lift], near ? 8 : 7, col);
    seg(g, [kx + 3, ky + 6, fx + 2, -10 - lift], 2.5, metal);
    g.fillStyle = near ? hullDark : metal;
    g.beginPath();
    g.arc(kx, ky, near ? 6 : 5, 0, Math.PI * 2);
    g.fill();
    if (near) {
      g.fillStyle = hexA(hullLit, 0.7);
      g.beginPath();
      g.arc(kx - 1, ky - 2, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    poly(g, [fx - 9, -lift, fx + 9, -lift, fx + 6, -6 - lift, fx - 6, -6 - lift], near ? hullDark : metal);
  };
  for (let i = 0; i < 3; i++) leg(i, false);
  // The rear section, the joint, the forward section with its sloped nose and viewports.
  poly(g, [-74, bodyY - 22, -14, bodyY - 24, -12, bodyY + 4, -72, bodyY + 6, -78, bodyY - 6], hull);
  poly(g, [-10, bodyY - 26, 52, bodyY - 26, 72, bodyY - 10, 70, bodyY + 4, -8, bodyY + 6], hull);
  poly(g, [-14, bodyY - 18, -10, bodyY - 18, -10, bodyY + 2, -14, bodyY + 2], metal);
  // Light on the top and the face toward it; shade under.
  g.fillStyle = hexA(hullLit, 0.7);
  g.fillRect(-74, bodyY - 24, 60, 4);
  g.fillRect(-10, bodyY - 28, 62, 4);
  g.fillStyle = hexA(hullDark, 0.75);
  g.fillRect(-72, bodyY - 2, 58, 7);
  g.fillRect(-8, bodyY - 2, 76, 7);
  if (lit > 0) poly(g, [52, bodyY - 26, 72, bodyY - 10, 70, bodyY - 4, 50, bodyY - 20], hexA(hullLit, 0.6));
  // Panel lines, the legion's bands, the viewports.
  g.strokeStyle = hexA(hullDark, 0.8);
  g.lineWidth = 0.8;
  for (const px of [-60, -44, -28, 6, 22, 38]) {
    g.beginPath();
    g.moveTo(px, bodyY - 22);
    g.lineTo(px, bodyY + 2);
    g.stroke();
  }
  g.fillStyle = mark;
  g.fillRect(-70, bodyY - 12, 52, 3);
  g.fillRect(-6, bodyY - 12, 54, 3);
  poly(g, [56, bodyY - 20, 66, bodyY - 12, 64, bodyY - 9, 54, bodyY - 16], glass);
  g.fillStyle = glass;
  g.fillRect(30, bodyY - 20, 5, 4);
  g.fillRect(38, bodyY - 20, 5, 4);
  // Chin guns.
  g.fillStyle = metal;
  g.fillRect(64, bodyY - 2, 14, 3);
  g.fillRect(-80, bodyY - 4, 8, 3);
  // The great gun on its turret, laid toward its mark.
  const tx = -30;
  const ty = bodyY - 26;
  poly(g, [tx - 14, ty, tx + 14, ty, tx + 10, ty - 10, tx - 10, ty - 10], hullDark);
  g.save();
  g.translate(tx, ty - 10);
  g.rotate(-o.aim);
  poly(g, [-12, -6, 10, -6, 12, 4, -12, 4], hull);
  g.fillStyle = hexA(hullLit, 0.6);
  g.fillRect(-12, -6, 22, 2);
  g.fillStyle = metal;
  g.fillRect(8, -3, 46 - o.fire * 5, 4);
  g.fillRect(50 - o.fire * 5, -4, 6, 6);
  g.restore();
  for (let i = 0; i < 3; i++) leg(i, true);
  g.restore();
  const ma = -o.aim;
  return [x + f * s * (tx + Math.cos(ma) * 56), y + s * (ty - 10 + Math.sin(ma) * 56)];
}

// ---- the spider walker --------------------------------------------------------------------------------
export function drawSpider(E: Env, x: number, y: number, s: number, f: number, d: number, o: { ph: number; aim: number; fire: number; tilt?: number; sink?: number; wreck?: boolean; seed: number }): [number, number] {
  const g = E.ctx;
  const shell = E.tone('#a89070', d, 0.1);
  const lit = E.tone('#e8d0a8', d, 0.5);
  const dark = E.tone('#4a3c2c', d, 0);
  const metal = E.tone('#2e2a26', d, 0);
  g.save();
  g.translate(x, y + (o.sink ?? 0) * s);
  g.scale(f * s, s);
  if (o.tilt) g.rotate(o.tilt);
  const by = o.wreck ? -22 : -78;
  // Four long arched legs: up to a high knee, then down to the foot, far out.
  const leg = (i: number, near: boolean) => {
    const side = i < 2 ? -1 : 1;
    const ph = o.ph * Math.PI * 2 + i * 1.6;
    const lift = o.wreck ? 0 : Math.max(0, Math.sin(ph)) * 8;
    const fx = side * (near ? 70 : 58) + (o.wreck ? side * 20 : Math.cos(ph) * 8);
    const kx = side * (near ? 38 : 30);
    const ky = o.wreck ? by - 12 : by - 46;
    seg(g, [side * 12, by, kx, ky], near ? 9 : 8, near ? shell : dark);
    seg(g, [kx, ky, fx, -lift], near ? 7 : 6, near ? shell : dark);
    seg(g, [kx, ky, fx * 0.7 + kx * 0.3, ky * 0.55 - lift * 0.45], 2.5, metal);
    g.fillStyle = metal;
    g.beginPath();
    g.arc(kx, ky, near ? 5.5 : 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = near ? lit : shell;
    g.beginPath();
    g.arc(kx - 1, ky - 1.5, 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = near ? dark : metal;
    g.beginPath();
    g.ellipse(fx, -lift - 2, 5, 2.4, 0, 0, Math.PI * 2);
    g.fill();
  };
  leg(0, false);
  leg(3, false);
  // The domed body, the cannon slung under it, the eye.
  g.fillStyle = shell;
  g.beginPath();
  g.ellipse(0, by, 38, 27, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA(dark, 0.75);
  g.beginPath();
  g.ellipse(0, by + 7, 38, 20, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = hexA(lit, 0.8);
  g.beginPath();
  g.ellipse(E.lx * f * 12, by - 15, 18, 7, 0, 0, Math.PI * 2);
  g.fill();
  // The sensor collar round its middle, and its antennae.
  g.fillStyle = metal;
  g.fillRect(-38, by - 2, 76, 5);
  seg(g, [-8, by - 26, -14, by - 40], 1.5, metal);
  seg(g, [6, by - 26, 10, by - 44], 1.5, metal);
  g.strokeStyle = hexA(dark, 0.8);
  g.lineWidth = 0.9;
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.ellipse(0, by, Math.abs(i) * 7 + 3, 22, 0, -Math.PI * 0.45, Math.PI * 0.45);
    g.stroke();
  }
  g.save();
  g.translate(10, by + 18);
  g.rotate(-o.aim);
  g.fillStyle = metal;
  g.fillRect(-6, -5, 16, 10);
  g.fillRect(8, -3, 52 - o.fire * 6, 6);
  g.fillStyle = dark;
  g.fillRect(52 - o.fire * 6, -4, 8, 8);
  g.restore();
  g.fillStyle = '#ff3a2a';
  g.beginPath();
  g.arc(24, by - 2, 3.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffb0a0';
  g.fillRect(24, by - 3, 1.5, 1.5);
  leg(1, true);
  leg(2, true);
  g.restore();
  const ma = -o.aim;
  return [x + f * s * (10 + Math.cos(ma) * 60), y + s * (by + 18 + Math.sin(ma) * 60)];
}

// ---- the troop gunship ------------------------------------------------------------------------------------
/** The gunship, in side view; 1 unit is about 1/120 of its length. Pushes its lamps (engines, turrets, searchlight). */
export function drawGunship(E: Env, x: number, y: number, s: number, f: number, d: number, o: { legion: string; doors: number; bank: number; spin: number; carrier: boolean; seed: number; firing: number; crew: number }, lamps: Lamp[]) {
  const g = E.ctx;
  const hull = E.tone('#c8c8b4', d, 0.1);
  const lit = E.tone('#f4f2e0', d, 0.45);
  const dark = E.tone('#5a6050', d, 0);
  const olive = E.tone('#7a8460', d, 0.1);
  const metal = E.tone('#2e3030', d, 0);
  const mark = E.tone(o.legion, d, 0.2);
  const glass = E.tone('#2a3a48', d, 0.3);
  g.save();
  g.translate(x, y);
  g.scale(f * s, s);
  g.rotate(o.bank + Math.sin(o.spin) * 0.5);
  // The far wing and its turret (darker), the tail fin.
  poly(g, [-10, -16, 14, -16, -26, -38, -34, -36], dark);
  poly(g, [-50, -6, -38, -6, -54, -30, -62, -28], olive);
  // The hull: a long body, a rounded nose, a tapering tail.
  g.fillStyle = hull;
  g.beginPath();
  g.moveTo(-60, -8);
  g.lineTo(-60, 6);
  g.lineTo(28, 12);
  g.quadraticCurveTo(58, 12, 62, 0);
  g.quadraticCurveTo(58, -14, 34, -16);
  g.lineTo(-30, -14);
  g.closePath();
  g.fill();
  // Shade underneath, light on top; the olive panels and the legion's stripe.
  g.fillStyle = hexA(dark, 0.7);
  g.beginPath();
  g.moveTo(-60, 2);
  g.lineTo(28, 8);
  g.quadraticCurveTo(54, 9, 60, 2);
  g.quadraticCurveTo(58, 12, 28, 12);
  g.lineTo(-60, 6);
  g.fill();
  g.fillStyle = hexA(lit, 0.6);
  g.fillRect(-28, -14, 60, 3);
  g.fillStyle = olive;
  g.fillRect(-56, -6, 18, 8);
  g.fillRect(36, -12, 10, 6);
  g.fillStyle = mark;
  g.fillRect(-36, -11, 70, 2.5);
  poly(g, [44, -6, 56, -6, 52, 2, 44, 2], mark);
  // The canopy.
  g.fillStyle = glass;
  g.beginPath();
  g.moveTo(40, -14);
  g.quadraticCurveTo(56, -14, 60, -4);
  g.lineTo(46, -4);
  g.closePath();
  g.fill();
  g.fillStyle = hexA('#c8e0ff', 0.35);
  g.fillRect(48, -12, 6, 2);
  // The bay: doors slide back on the squad inside.
  if (!o.carrier) {
    const open = o.doors;
    g.fillStyle = metal;
    g.fillRect(-20, -10, 40 * open, 16);
    if (open > 0.2) {
      const body = E.tone('#e0ded6', d, 0);
      for (let i = 0; i < Math.min(o.crew, 4); i++) {
        const cx = -14 + i * 9;
        if (cx > -20 + 40 * open - 4) continue;
        g.fillStyle = body;
        g.fillRect(cx, -6, 5, 10);
        g.beginPath();
        g.arc(cx + 2.5, -8, 2.6, 0, Math.PI * 2);
        g.fill();
      }
      lamps.push({ x: x + f * s * (40 * open * 0.5 - 20), y: y - 2 * s, r: 18 * s, color: '#ffd8a0', a: 0.25 * open * (0.3 + E.night) });
    }
    g.fillStyle = hull;
    g.fillRect(-20 + 40 * open, -10, 40 * (1 - open) + 2, 16);
    g.strokeStyle = hexA(dark, 0.9);
    g.lineWidth = 0.8;
    g.strokeRect(-20, -10, 42, 16);
  } else {
    // Clamps for the walker.
    g.fillStyle = metal;
    for (const cx of [-34, -6, 22]) g.fillRect(cx, 10, 4, 10);
  }
  // The near wing, swept, with its bubble turret on the root.
  poly(g, [-14, -14, 16, -14, -18, -40, -30, -38], hull);
  poly(g, [-30, -38, -18, -40, -16, -36, -28, -34], mark);
  g.fillStyle = hexA(lit, 0.6);
  g.fillRect(-14, -14, 30, 2);
  g.fillStyle = metal;
  g.beginPath();
  g.arc(0, 4, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = glass;
  g.beginPath();
  g.arc(0, 4, 5.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA('#d8f0ff', 0.45);
  g.beginPath();
  g.arc(-1.6, 2.4, 1.8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = metal;
  g.fillRect(4, 3, 10, 2);
  // The tail: fin, engines.
  poly(g, [-58, -8, -46, -8, -62, -30, -68, -28], hull);
  g.fillStyle = metal;
  g.fillRect(-66, -6, 8, 10);
  g.fillRect(-28, -22, 12, 6);
  g.restore();
  const c = Math.cos(o.bank);
  lamps.push({ x: x - f * s * 66 * c, y: y + s * -1, r: 9 * s, color: '#9ad8ff', a: 0.9 });
  lamps.push({ x: x - f * s * 22, y: y - s * 19, r: 6 * s, color: '#9ad8ff', a: 0.6 });
  if (o.firing > 0) lamps.push({ x: x + f * s * 14, y: y + 4 * s, r: 10 * s, color: '#7ad0ff', a: o.firing });
  // Running lights, red and green.
  const blink = Math.sin(E.t * 4 + o.seed) > 0.6 ? 1 : 0.2;
  lamps.push({ x: x - f * s * 30, y: y - s * 38, r: 4 * s, color: '#ff4030', a: blink });
}

// ---- the Confederacy's lander -----------------------------------------------------------------------------
/** The lander: a pod under a great hooked wing; 1 unit is about 1/240 of its span. */
export function drawLander(E: Env, x: number, y: number, s: number, f: number, d: number, o: { ramp: number; alt: number; seed: number }, lamps: Lamp[]) {
  const g = E.ctx;
  const shell = E.tone('#b09a78', d, 0.1);
  const lit = E.tone('#e8d4b0', d, 0.45);
  const dark = E.tone('#5a4a38', d, 0);
  const blue = E.tone('#3a5470', d, 0.1);
  const metal = E.tone('#2a2622', d, 0);
  g.save();
  g.translate(x, y);
  g.scale(f * s, s);
  // Landing legs, out when it is low.
  const legs = Math.max(0, 1 - o.alt / 60);
  if (legs > 0)
    for (const lx of [-50, 40]) {
      seg(g, [lx, -30, lx + (lx < 0 ? -10 : 10), -30 + 30 * legs], 4, metal);
      g.fillStyle = metal;
      g.fillRect(lx + (lx < 0 ? -16 : 4), -2 - 30 * (1 - legs), 12, 3);
    }
  // The great wing, arched over the pod, hooked down at both ends.
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-120, -40);
  g.quadraticCurveTo(-110, -96, 0, -104);
  g.quadraticCurveTo(110, -96, 120, -40);
  g.lineTo(108, -38);
  g.quadraticCurveTo(96, -84, 0, -90);
  g.quadraticCurveTo(-96, -84, -108, -38);
  g.closePath();
  g.fill();
  g.fillStyle = shell;
  g.beginPath();
  g.moveTo(-112, -50);
  g.quadraticCurveTo(-104, -98, 0, -106);
  g.quadraticCurveTo(104, -98, 112, -50);
  g.lineTo(100, -54);
  g.quadraticCurveTo(92, -88, 0, -94);
  g.quadraticCurveTo(-92, -88, -100, -54);
  g.closePath();
  g.fill();
  g.fillStyle = hexA(lit, 0.6);
  g.beginPath();
  g.ellipse(E.lx * f * 30, -103, 50, 3, 0, 0, Math.PI * 2);
  g.fill();
  // Its engines' pods at the hooks.
  for (const ex of [-114, 114]) {
    g.fillStyle = blue;
    g.beginPath();
    g.ellipse(ex, -44, 8, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  // The struts to the pod.
  seg(g, [-30, -92, -24, -60], 5, dark);
  seg(g, [30, -92, 24, -60], 5, dark);
  // The pod: a long rounded body, the cockpit forward, panels, the ramp in its belly.
  g.fillStyle = shell;
  g.beginPath();
  g.ellipse(0, -44, 64, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA(dark, 0.7);
  g.beginPath();
  g.ellipse(0, -38, 62, 12, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = hexA(lit, 0.6);
  g.beginPath();
  g.ellipse(0, -56, 44, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = blue;
  g.fillRect(-40, -50, 70, 4);
  g.fillStyle = E.tone('#1a2028', d, 0.2);
  g.beginPath();
  g.ellipse(54, -48, 10, 6, -0.2, 0, Math.PI * 2);
  g.fill();
  if (o.ramp > 0) {
    g.fillStyle = '#100c08';
    g.fillRect(-26, -34, 40, 10);
    poly(g, [-26, -26, 14, -26, 14 + 22 * o.ramp, -26 + 26 * o.ramp, -26 + 22 * o.ramp, -26 + 26 * o.ramp], shell);
    lamps.push({ x: x + f * s * -6, y: y - 30 * s, r: 30 * s, color: '#ffc080', a: 0.4 * o.ramp * (0.4 + E.night) });
  }
  g.restore();
  for (const ex of [-114, 114]) lamps.push({ x: x + f * s * ex, y: y - 34 * s, r: 14 * s, color: '#ff9a50', a: 0.5 + (o.alt > 1 ? 0.4 : 0) });
}

// ---- the sky's fighters ------------------------------------------------------------------------------------
/** A starfighter at (x, y), heading `ang`, `s` its scale (1 is about 26 px long at u = 1). */
export function drawFighter(E: Env, x: number, y: number, s: number, ang: number, side: 'ga' | 'cf', o: { legion: string; bomber?: boolean; haze: number }, lamps: Lamp[]) {
  const g = E.ctx;
  const ink = E.L.ink;
  const tone = (c: string, k = 0) => mix(mix(mix(c, ink, 0.2 + E.night * 0.5), E.L.sun, k * (1 - E.night * 0.5)), E.L.mid, o.haze);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(s, s * (Math.cos(ang) < 0 ? -1 : 1));
  if (side === 'ga') {
    const hull = tone('#e0e0d8', 0.2);
    const dark = tone('#6a6a68');
    const mark = tone(o.legion, 0.2);
    if (o.bomber) {
      poly(g, [16, 0, -10, -10, -14, -9, -12, 0, -14, 9, -10, 10], hull);
      poly(g, [6, -2, -12, -16, -16, -15, -8, -2], dark);
      g.fillStyle = mark;
      g.fillRect(-8, -1.5, 14, 3);
    } else {
      // An arrowhead: a long dart with swept wings and a cockpit bubble.
      poly(g, [16, 0, 4, -2.2, -10, -9, -13, -8, -9, -1.5, -12, 0, -9, 1.5, -13, 8, -10, 9, 4, 2.2], hull);
      poly(g, [-4, -5.5, -10, -9, -13, -8, -7, -3.5], mark);
      poly(g, [-4, 5.5, -10, 9, -13, 8, -7, 3.5], dark);
      g.fillStyle = tone('#1a2a3a', 0.3);
      g.fillRect(2, -1, 5, 2);
    }
    lamps.push({ x: x - Math.cos(ang) * 12 * s, y: y - Math.sin(ang) * 12 * s, r: 7 * s, color: '#8ad0ff', a: 0.8 * (1 - o.haze * 0.6) });
  } else {
    // A vulture droid: a narrow body, four claw-wings forked fore and aft, a blue eye.
    const hull = tone('#9a8466', 0.15);
    const dark = tone('#4a3c2c');
    poly(g, [12, 0, 4, -2, -10, -1.5, -10, 1.5, 4, 2], hull);
    for (const sy of [-1, 1]) {
      poly(g, [2, sy * 1.5, 12, sy * 9, 10, sy * 10, -2, sy * 3], sy < 0 ? hull : dark);
      poly(g, [-2, sy * 1.5, -12, sy * 10, -14, sy * 9, -6, sy * 1.5], sy < 0 ? hull : dark);
    }
    g.fillStyle = '#7ab8ff';
    g.fillRect(8, -0.8, 2, 1.6);
    lamps.push({ x: x - Math.cos(ang) * 10 * s, y: y - Math.sin(ang) * 10 * s, r: 6 * s, color: '#ff9a50', a: 0.7 * (1 - o.haze * 0.6) });
  }
  g.restore();
}

// ---- the capital ships, baked ---------------------------------------------------------------------------------
/** A capital ship painted to its own canvas (at `px` pixels long), lit for the hour and hazed for its depth. */
export function bakeCapital(E: Env, kind: 'wedge' | 'frigate' | 'core', px: number, haze: number, seed: number, mk: (w: number, h: number) => HTMLCanvasElement): { canvas: HTMLCanvasElement; ox: number; oy: number; lights: [number, number][] } {
  const W = Math.ceil(px * 1.1);
  const H = Math.ceil(px * (kind === 'core' ? 1.1 : 0.42));
  const c = mk(W, H);
  const g = c.getContext('2d')!;
  const L = E.L;
  const tone = (col: string, k = 0) => mix(mix(mix(col, L.ink, 0.15 + L.night * 0.5), L.sun, k * (1 - L.night * 0.4)), mix(L.mid, L.low, 0.4), haze);
  const lights: [number, number][] = [];
  const s = px / 100;
  const ox = W / 2;
  const oy = H / 2;
  g.translate(ox, oy);
  g.scale(s, s);
  const rnd = (i: number) => hsh(seed, i);
  if (kind === 'wedge') {
    // A dagger in profile, seen a little from below: the dorsal hull lit, the ventral face dark.
    const top = tone('#c8c6c0', 0.35);
    const flank = tone('#8a8884', 0.05);
    const belly = tone('#4a4a4c');
    const red = tone('#a83a30', 0.15);
    poly(g, [50, 2, -46, -6, -48, 6, -40, 9], belly);
    poly(g, [50, 2, -46, -6, -46, -10], flank);
    poly(g, [50, 1, -10, -9, -46, -10, -46, -6], top);
    g.fillStyle = red;
    g.beginPath();
    g.moveTo(50, 2);
    g.lineTo(-46, -6);
    g.lineTo(-46, -4.6);
    g.lineTo(48, 2.6);
    g.fill();
    // Rows of panels and the hangar slot.
    g.fillStyle = hexA(tone('#2a2a2c'), 0.6);
    for (let i = 0; i < 70; i++) {
      const q = rnd(i);
      const x = -44 + q * 86;
      const y = -6 + (q * 86 * 8) / 96 - rnd(i + 99) * 3;
      g.fillRect(x, y, 1 + rnd(i + 7) * 3, 0.5);
    }
    g.fillStyle = hexA('#ffe8b0', 0.7);
    g.fillRect(-20, 3.5, 30, 1);
    // The twin bridge towers aft.
    for (const [tx, w] of [[-34, 5], [-28, 5]] as [number, number][]) {
      poly(g, [tx - w / 2, -8, tx + w / 2, -8, tx + w / 2 - 1, -17, tx - w / 2 + 1, -17], flank);
      g.fillStyle = top;
      g.fillRect(tx - w / 2 - 1.5, -19, w + 3, 2.4);
      g.fillStyle = hexA('#ffe0a0', 0.8);
      g.fillRect(tx - w / 2, -18.4, w, 0.6);
    }
    // Engines.
    g.fillStyle = tone('#2a2a2c');
    g.fillRect(-49, -9, 4, 16);
    for (const y of [-6, -1, 4]) lights.push([-49, y]);
    for (let i = 0; i < 18; i++) lights.push([-40 + rnd(i + 300) * 80, -4 + rnd(i + 400) * 6]);
  } else if (kind === 'frigate') {
    // A long spine, a huge prow, a comm tower over it, an engine cluster aft.
    const hull = tone('#9a8a70', 0.2);
    const dark = tone('#4a4034');
    const lit = tone('#d8c8a8', 0.45);
    g.fillStyle = dark;
    g.fillRect(-46, -2.5, 70, 5);
    g.fillStyle = hull;
    g.fillRect(-46, -2.5, 70, 2);
    // The prow: a tall rounded head.
    g.fillStyle = hull;
    g.beginPath();
    g.moveTo(18, -9);
    g.quadraticCurveTo(46, -10, 52, -1);
    g.quadraticCurveTo(50, 11, 18, 12);
    g.quadraticCurveTo(24, 1, 18, -9);
    g.fill();
    g.fillStyle = hexA(lit, 0.6);
    g.beginPath();
    g.ellipse(36, -6.5, 12, 2, 0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(20, 6);
    g.quadraticCurveTo(46, 8, 50, 2);
    g.quadraticCurveTo(48, 11, 18, 12);
    g.fill();
    // Gun ports along the prow, the comm tower and its dish.
    g.fillStyle = hexA(dark, 0.8);
    for (let i = 0; i < 6; i++) g.fillRect(24 + i * 4, -3, 2, 1.2);
    g.fillStyle = dark;
    g.fillRect(30, -24, 1.6, 15);
    g.fillStyle = hull;
    g.beginPath();
    g.ellipse(31, -25, 5, 1.6, 0, 0, Math.PI * 2);
    g.fill();
    // Ribs along the spine, guns.
    g.fillStyle = dark;
    for (let i = 0; i < 9; i++) g.fillRect(-40 + i * 7, -5, 2, 10);
    // Engines aft.
    g.fillStyle = hull;
    g.fillRect(-52, -7, 10, 14);
    lights.push([-53, -3], [-53, 3]);
    for (let i = 0; i < 14; i++) lights.push([24 + rnd(i + 200) * 22, -8 + rnd(i + 500) * 18]);
  } else {
    // A core sphere with its equatorial band and its legs.
    const hull = tone('#8a7a64', 0.2);
    const dark = tone('#3a3028');
    const gr = g.createRadialGradient(E.lx * 12, -14, 4, 0, 0, 40);
    gr.addColorStop(0, tone('#d8c8a8', 0.5));
    gr.addColorStop(0.6, hull);
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = dark;
    g.fillRect(-40, -3, 80, 6);
    g.strokeStyle = hexA(dark, 0.6);
    g.lineWidth = 0.6;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(0, 0, Math.abs(i) * 12 + 2, 40, 0, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const a = rnd(i) * Math.PI * 2;
      lights.push([Math.cos(a) * 38, 0]);
    }
  }
  return { canvas: c, ox: ox / s, oy: oy / s, lights: lights.map(([x, y]) => [x * s, y * s] as [number, number]) };
}

// ---- wrecks ---------------------------------------------------------------------------------------------------
export function drawWreck(E: Env, kind: string, x: number, y: number, s: number, f: number, d: number, seed: number, legion: string) {
  const g = E.ctx;
  const burnt = (c: string) => E.tone(mix(c, '#1a1612', 0.55), d, 0.05);
  if (kind === 'hexa') {
    drawHexa(E, x, y, s, f, d, { ph: 0, legion: mix(legion, '#222222', 0.6), aim: -0.3, fire: 0, tilt: 0.12, sink: 6, wreck: true, seed });
    g.fillStyle = hexA('#140e0a', 0.55);
    g.beginPath();
    g.ellipse(x, y + 2 * s, 90 * s, 7 * s, 0, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'spider') {
    drawSpider(E, x, y, s, f, d, { ph: 0, aim: 0.4, fire: 0, sink: 4, wreck: true, seed, tilt: -0.15 });
  } else if (kind === 'gunship') {
    g.save();
    g.translate(x, y);
    g.scale(f * s, s);
    g.rotate(0.25);
    poly(g, [-50, -14, 10, -16, 30, -6, 34, 4, -48, 6], burnt('#c8c8b4'));
    poly(g, [10, -16, 40, -10, 46, 0, 34, 4], burnt('#5a6050'));
    poly(g, [-20, -16, -8, -16, -30, -32, -40, -30], burnt('#c8c8b4'));
    g.fillStyle = '#100c0a';
    g.fillRect(-26, -10, 22, 12);
    g.restore();
  } else if (kind === 'roller') {
    g.fillStyle = burnt('#8a6a44');
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(x + (hsh(seed, i) - 0.5) * 30 * s, y - 2 * s, (3 + hsh(seed, i + 9) * 4) * s, 2 * s, hsh(seed, i + 4) * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'lander') {
    drawLander(E, x, y + 20 * s, s * 0.6, f, d, { ramp: 0, alt: 0, seed }, []);
  } else if (kind === 'generator') {
    g.strokeStyle = burnt('#6a6050');
    g.lineWidth = Math.max(1, 3 * s);
    g.beginPath();
    g.moveTo(x - 30 * s, y);
    g.lineTo(x - 10 * s, y - 34 * s);
    g.lineTo(x + 4 * s, y - 20 * s);
    g.moveTo(x + 24 * s, y);
    g.lineTo(x + 12 * s, y - 28 * s);
    g.stroke();
    g.fillStyle = hexA('#120c08', 0.6);
    g.beginPath();
    g.ellipse(x, y, 44 * s, 7 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** The shield generator: a pylon and its dish, lit by the dome. */
export function drawGenerator(E: Env, x: number, y: number, s: number, d: number, up: number) {
  const g = E.ctx;
  const metal = E.tone('#8a8070', d, 0.15);
  const dark = E.tone('#3a3430', d, 0);
  const lit = E.tone('#d8d0b8', d, 0.45);
  poly(g, [x - 22 * s, y, x + 22 * s, y, x + 12 * s, y - 14 * s, x - 12 * s, y - 14 * s], dark);
  g.fillStyle = metal;
  g.fillRect(x - 5 * s, y - 52 * s, 10 * s, 40 * s);
  g.fillStyle = hexA(lit, 0.6);
  g.fillRect(x + E.lx * 2 * s - 1.5 * s, y - 52 * s, 3 * s, 40 * s);
  g.fillStyle = metal;
  g.beginPath();
  g.ellipse(x, y - 56 * s, 20 * s, 7 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA('#9ad0ff', 0.6 + 0.4 * up);
  g.beginPath();
  g.ellipse(x, y - 58 * s, 10 * s, 3 * s, 0, 0, Math.PI * 2);
  g.fill();
  for (const sx of [-1, 1]) {
    g.strokeStyle = dark;
    g.lineWidth = Math.max(0.6, 2 * s);
    g.beginPath();
    g.moveTo(x + sx * 5 * s, y - 30 * s);
    g.lineTo(x + sx * 18 * s, y - 2 * s);
    g.stroke();
  }
}

/** The dome: a great translucent hemisphere over the droids' rear, flickering where it is struck. */
export function drawDome(E: Env, x: number, y: number, rx: number, ry: number, up: number, flick: number, accent: string) {
  if (up <= 0.01) return;
  const g = E.ctx;
  const h = ry * up;
  const a = 0.6 + flick * 0.4;
  const gr = g.createRadialGradient(x, y - h * 0.3, rx * 0.1, x, y, rx);
  gr.addColorStop(0, hexA(accent, 0.02 * a));
  gr.addColorStop(0.7, hexA(accent, 0.08 * a));
  gr.addColorStop(1, hexA(accent, 0.26 * a));
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y, rx, h, 0, Math.PI, Math.PI * 2);
  g.ellipse(x, y, rx, h * 0.18, 0, 0, Math.PI);
  g.fill();
  // The lattice of the field: lines of latitude and longitude, shimmering.
  g.strokeStyle = hexA(accent, (0.12 + flick * 0.3) * (0.7 + 0.3 * Math.sin(E.t * 3)));
  g.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    g.beginPath();
    g.ellipse(x, y, rx * (i / 6), h, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const k = i / 4;
    g.beginPath();
    g.ellipse(x, y - h * k, rx * Math.sqrt(1 - k * k), h * 0.18 * Math.sqrt(1 - k * k), 0, Math.PI, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = hexA('#e0f0ff', 0.4 * a);
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(x, y, rx, h, 0, Math.PI, Math.PI * 2);
  g.stroke();
}
