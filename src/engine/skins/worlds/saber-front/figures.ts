/**
 * The people of the battle, drawn as themselves: troopers in white armour with their legion's
 * markings (T-visored helmets, belts, carbines; officers with a coloured pauldron, heavies with a
 * repeater and pack, commandos in grey), the Confederacy's tan battle droids (long snouted heads on
 * thin necks, skinny limbs, backpacks; commanders with yellow markings; bulky super droids with
 * wrist guns), knights in robes with their blades, and the rolling shield droids.
 *
 * Each figure is drawn in its own frame: the foot at (x, y), `h` tall, facing `f` (+1 right). The
 * light comes from `E.lx`; the colours are toned for the figure's distance `d`.
 */
import type { Env } from './scene';
import { hexA, mix } from './scene';

type G = CanvasRenderingContext2D;
export type Pose = { ph: number; moving: number; crouch: number; fall: number; dead: boolean; firing: number; seed: number };

const limb = (g: G, x0: number, y0: number, x1: number, y1: number, w: number, col: string) => {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
};
const limb2 = (g: G, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, w: number, col: string) => {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
};

/** Where a figure's gun points from (for the muzzle flash), relative to its foot, in units of h. */
export const MUZZLE = { trooper: [0.44, -0.62], droid: [0.42, -0.6], super: [0.36, -0.58] } as const;

/** Falling and lying: the frame rotates about the foot. */
function fallFrame(g: G, x: number, y: number, h: number, f: number, p: Pose) {
  g.translate(x, y);
  if (p.fall > 0 || p.dead) {
    const k = p.dead ? 1 : p.fall;
    const ease = k * k;
    g.translate(-f * ease * h * 0.25, 0);
    g.rotate(-f * ease * Math.PI * 0.5 * ((p.seed % 2) * 2 - 1 > 0 ? 1 : 1));
  }
  g.scale(f, 1);
}

export function drawTrooper(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose, o: { legion: string; kind: string }) {
  const g = E.ctx;
  if (h < 2) return;
  const armor = E.tone(o.kind === 'commando' ? '#8a8e84' : '#e8e6de', d, 0.05);
  const armorLit = E.tone(o.kind === 'commando' ? '#b0b4a8' : '#ffffff', d, 0.4);
  const armorDark = E.tone(o.kind === 'commando' ? '#4a4e48' : '#a4a6a4', d, 0);
  const under = E.tone('#1e1e22', d, 0);
  const visor = E.tone('#101418', d, 0);
  const mark = E.tone(o.legion, d, 0.15);
  const lit = E.lx * f;
  g.save();
  fallFrame(g, x, y, h, f, p);
  if (p.dead) {
    // Lying where he fell: a body on its back, armour catching the light.
    g.restore();
    g.save();
    g.translate(x, y);
    g.scale(f, 1);
    const lw = h * 0.95;
    g.fillStyle = hexA('#000000', 0.25 * (1 - E.hazeOf(d)));
    g.beginPath();
    g.ellipse(0, 0, lw * 0.55, h * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    limb(g, -lw * 0.45, -h * 0.03, -lw * 0.05, -h * 0.05, h * 0.1, armor);
    g.fillStyle = armor;
    g.beginPath();
    g.ellipse(lw * 0.12, -h * 0.07, lw * 0.2, h * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mark;
    g.fillRect(lw * 0.04, -h * 0.13, lw * 0.08, h * 0.04);
    g.fillStyle = armorDark;
    g.beginPath();
    g.arc(lw * 0.42, -h * 0.07, h * 0.08, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = visor;
    g.fillRect(lw * 0.42, -h * 0.1, h * 0.06, h * 0.035);
    limb(g, lw * 0.25, -h * 0.12, lw * 0.5, -h * 0.02, h * 0.04, under);
    g.restore();
    return;
  }
  const c = p.crouch;
  const sw = Math.sin(p.ph) * p.moving;
  const legL = h * 0.46;
  const hipY = -legL * (1 - c * 0.42) - Math.abs(Math.cos(p.ph)) * p.moving * h * 0.025;
  const torsoH = h * 0.3;
  const shY = hipY - torsoH;
  const lean = p.moving * 0.12 + c * 0.05;
  const shX = lean * torsoH;
  // Legs: the far one first (darker), then the near one.
  const knee = (s: number) => {
    if (c > 0.5) return s > 0 ? [h * 0.18, hipY + h * 0.02, h * 0.17, 0] : [-h * 0.04, hipY + h * 0.16, -h * 0.2, 0];
    const a = s * sw * 0.55;
    const kx = Math.sin(a) * legL * 0.5;
    const ky = hipY + Math.cos(a) * legL * 0.5;
    const fx2 = kx + Math.sin(a - Math.max(0, -s * sw) * 0.6) * legL * 0.5;
    return [kx, ky, fx2, 0];
  };
  for (const s of [-1, 1]) {
    const [kx, ky, fx2, fy] = knee(s);
    const col = s < 0 ? armorDark : armor;
    limb2(g, 0, hipY, kx, ky, fx2, fy - h * 0.03, h * 0.105, col);
    g.fillStyle = s < 0 ? under : armorDark;
    g.fillRect(fx2 - h * 0.04, -h * 0.05, h * 0.12, h * 0.05);
    g.fillStyle = under;
    g.beginPath();
    g.arc(kx, ky, h * 0.035, 0, Math.PI * 2);
    g.fill();
  }
  // A heavy's pack; the far arm.
  if (o.kind === 'jet') {
    // The jetpack, its twin nozzles.
    g.fillStyle = armorDark;
    g.fillRect(shX - h * 0.22, shY + h * 0.0, h * 0.11, torsoH * 0.8);
    g.fillStyle = under;
    g.fillRect(shX - h * 0.2, shY + torsoH * 0.78, h * 0.08, h * 0.05);
  }
  if (o.kind === 'arc') {
    // The kama, a cloth skirt in the legion's colour over the thighs.
    g.fillStyle = hexA(mark, 0.9);
    g.beginPath();
    g.moveTo(-h * 0.12, hipY - h * 0.02);
    g.lineTo(h * 0.11, hipY - h * 0.02);
    g.lineTo(h * 0.08, hipY + h * 0.18);
    g.lineTo(-h * 0.16, hipY + h * 0.16);
    g.fill();
  }
  if (o.kind === 'heavy' || o.kind === 'commando') {
    g.fillStyle = armorDark;
    g.fillRect(shX - h * 0.2, shY + h * 0.02, h * 0.1, torsoH * 0.75);
  }
  limb2(g, shX - h * 0.02, shY + h * 0.05, shX + h * 0.1, shY + h * 0.14, shX + h * 0.22, shY + h * 0.1, h * 0.075, armorDark);
  // The torso: chest plate, abdomen, belt.
  g.fillStyle = armor;
  g.beginPath();
  g.moveTo(-h * 0.1, hipY);
  g.lineTo(shX - h * 0.12, shY + h * 0.02);
  g.quadraticCurveTo(shX, shY - h * 0.03, shX + h * 0.12, shY + h * 0.03);
  g.lineTo(h * 0.09, hipY);
  g.closePath();
  g.fill();
  // Shade the side away from the light; light the near edge.
  g.fillStyle = hexA(armorDark, 0.75);
  g.beginPath();
  if (lit > 0) {
    g.moveTo(-h * 0.1, hipY);
    g.lineTo(shX - h * 0.12, shY + h * 0.02);
    g.lineTo(shX - h * 0.04, shY + h * 0.03);
    g.lineTo(-h * 0.03, hipY);
  } else {
    g.moveTo(h * 0.09, hipY);
    g.lineTo(shX + h * 0.12, shY + h * 0.03);
    g.lineTo(shX + h * 0.04, shY + h * 0.03);
    g.lineTo(h * 0.02, hipY);
  }
  g.fill();
  g.fillStyle = under;
  g.fillRect(-h * 0.1, hipY - h * 0.035, h * 0.2, h * 0.045);
  g.fillStyle = hexA(under, 0.6);
  g.fillRect(-h * 0.06, shY + torsoH * 0.5, h * 0.13, h * 0.012);
  // The legion's mark on the chest; an officer's pauldron.
  g.fillStyle = mark;
  if (o.kind === 'officer' || o.kind === 'arc') {
    g.beginPath();
    g.ellipse(shX - h * 0.02, shY + h * 0.03, h * 0.09, h * 0.05, -0.2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(shX - h * 0.05, shY + h * 0.08, h * 0.12, h * 0.03);
  if (o.kind !== 'commando') g.fillRect(-h * 0.02, hipY - h * 0.1, h * 0.03, h * 0.08);
  // The rifle and the near arm.
  const gunL = o.kind === 'heavy' ? h * 0.44 : h * 0.34;
  const gunY = shY + h * (c > 0.5 ? 0.11 : 0.12);
  g.fillStyle = under;
  g.fillRect(shX - h * 0.04, gunY - h * 0.025, gunL, o.kind === 'heavy' ? h * 0.06 : h * 0.042);
  g.fillRect(shX + gunL * 0.35, gunY, h * 0.03, h * 0.07);
  limb2(g, shX + h * 0.02, shY + h * 0.05, shX + h * 0.08, shY + h * 0.16, shX + h * 0.16, gunY + h * 0.01, h * 0.08, armor);
  // The helmet: a dome with the T of the visor toward the enemy, the legion's stripe on top.
  const hx = shX + h * 0.03;
  const hy = shY - h * 0.1;
  const hr = h * 0.095;
  g.fillStyle = armor;
  g.beginPath();
  g.ellipse(hx, hy, hr * 1.05, hr * 1.1, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA(armorLit, 0.85);
  g.beginPath();
  g.ellipse(hx + lit * hr * 0.3, hy - hr * 0.45, hr * 0.5, hr * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = armorDark;
  g.fillRect(hx - hr * 1.05, hy + hr * 0.4, hr * 1.4, hr * 0.5);
  g.fillStyle = visor;
  g.fillRect(hx + hr * 0.25, hy - hr * 0.15, hr * 0.85, hr * 0.32);
  g.fillRect(hx + hr * 0.62, hy - hr * 0.1, hr * 0.3, hr * 0.85);
  g.fillStyle = mark;
  g.fillRect(hx - hr * 0.7, hy - hr * 0.95, hr * 1.2, hr * 0.28);
  if (o.kind === 'commando') {
    g.fillStyle = under;
    g.fillRect(hx - hr * 0.2, hy - hr * 1.6, hr * 0.12, hr * 0.7);
  }
  g.restore();
}

export function drawDroid(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose, o: { kind: string }) {
  const g = E.ctx;
  if (h < 2) return;
  if (o.kind === 'super') return drawSuper(E, x, y, h, f, d, p);
  const bx = o.kind === 'bx';
  const tan = E.tone(bx ? '#7a7466' : '#b8945e', d, 0.08);
  const tanLit = E.tone(bx ? '#c8c0b0' : '#ead0a0', d, 0.45);
  const tanDark = E.tone(bx ? '#3a3830' : '#5a4630', d, 0);
  const joint = E.tone('#3a3024', d, 0);
  const mark = E.tone('#e8c030', d, 0.2);
  const lit = E.lx * f;
  const W = Math.max(0.8, h * 0.045);
  g.save();
  if (p.dead) {
    // In pieces: the body on its side, the head apart from it, an arm.
    g.translate(x, y);
    g.scale(f, 1);
    const k = (p.seed % 5) / 5;
    g.fillStyle = hexA('#000000', 0.2 * (1 - E.hazeOf(d)));
    g.beginPath();
    g.ellipse(0, 0, h * 0.4, h * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    limb(g, -h * 0.35, -h * 0.02, -h * 0.02, -h * 0.04, W, tanDark);
    g.fillStyle = tan;
    g.save();
    g.translate(h * 0.08, -h * 0.07);
    g.rotate(1.3 + k * 0.3);
    g.fillRect(-h * 0.06, -h * 0.11, h * 0.12, h * 0.2);
    g.restore();
    g.fillStyle = tanDark;
    g.fillRect(h * 0.2, -h * 0.12, h * 0.06, h * 0.08);
    g.fillStyle = tan;
    g.beginPath();
    g.ellipse(h * (0.42 + k * 0.2), -h * 0.045, h * 0.1, h * 0.04, 0.3, 0, Math.PI * 2);
    g.fill();
    limb(g, h * 0.1, -h * 0.1, h * 0.3, -h * 0.02, W * 0.8, tanDark);
    g.restore();
    return;
  }
  fallFrame(g, x, y, h, f, p);
  const sw = Math.sin(p.ph) * p.moving;
  const hipY = -h * 0.44;
  // Thin legs, the knees a little bent, lockstep.
  for (const s of [-1, 1]) {
    const a = s * sw * 0.5;
    const kx = Math.sin(a) * h * 0.22 + h * 0.03;
    const ky = hipY + h * 0.22;
    const fx2 = Math.sin(a) * h * 0.3 - h * 0.02;
    limb2(g, 0, hipY, kx, ky, fx2, -h * 0.02, W, s < 0 ? tanDark : tan);
    g.fillStyle = s < 0 ? tanDark : tan;
    g.fillRect(fx2 - h * 0.02, -h * 0.03, h * 0.09, h * 0.03);
  }
  // Pelvis, spine, chest plate (wide at the top), the pack behind.
  g.fillStyle = tanDark;
  g.fillRect(-h * 0.05, hipY - h * 0.03, h * 0.1, h * 0.05);
  limb(g, 0, hipY, h * 0.02, hipY - h * 0.1, W, joint);
  g.fillStyle = tanDark;
  g.fillRect(-h * 0.16, hipY - h * 0.27, h * 0.09, h * 0.16);
  g.fillStyle = tan;
  g.beginPath();
  g.moveTo(-h * 0.08, hipY - h * 0.28);
  g.lineTo(h * 0.11, hipY - h * 0.26);
  g.lineTo(h * 0.05, hipY - h * 0.09);
  g.lineTo(-h * 0.03, hipY - h * 0.09);
  g.closePath();
  g.fill();
  g.fillStyle = hexA(lit > 0 ? tanLit : tanDark, 0.7);
  g.fillRect(lit > 0 ? h * 0.02 : -h * 0.07, hipY - h * 0.27, h * 0.06, h * 0.06);
  if (o.kind === 'commander') {
    g.fillStyle = mark;
    g.fillRect(-h * 0.06, hipY - h * 0.25, h * 0.14, h * 0.04);
  }
  // Arms out to the rifle.
  const gy = hipY - h * 0.2;
  limb2(g, h * 0.02, hipY - h * 0.25, h * 0.09, gy + h * 0.06, h * 0.2, gy, W * 0.9, tanDark);
  g.fillStyle = joint;
  g.fillRect(h * 0.08, gy - h * 0.02, h * 0.32, h * 0.035);
  g.fillRect(h * 0.14, gy, h * 0.03, h * 0.06);
  limb2(g, h * 0.05, hipY - h * 0.25, h * 0.14, gy + h * 0.07, h * 0.24, gy + h * 0.01, W * 0.9, tan);
  // The neck, and the long head pointing forward and down.
  const nx = h * 0.04;
  const ny = hipY - h * 0.28;
  limb(g, nx, ny, nx + h * 0.02, ny - h * 0.12, W * 0.9, joint);
  const hx = nx + h * 0.02;
  const hy = ny - h * 0.14;
  if (bx) {
    // A commando droid's small round head, its eye.
    g.fillStyle = tan;
    g.beginPath();
    g.arc(hx + h * 0.02, hy, h * 0.055, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd080';
    g.fillRect(hx + h * 0.04, hy - h * 0.01, h * 0.02, h * 0.02);
    g.restore();
    return;
  }
  g.fillStyle = tan;
  g.beginPath();
  g.moveTo(hx - h * 0.05, hy - h * 0.03);
  g.quadraticCurveTo(hx, hy - h * 0.07, hx + h * 0.06, hy - h * 0.03);
  g.lineTo(hx + h * 0.17, hy + h * 0.03);
  g.lineTo(hx + h * 0.15, hy + h * 0.05);
  g.lineTo(hx - h * 0.03, hy + h * 0.03);
  g.closePath();
  g.fill();
  g.fillStyle = hexA(tanLit, 0.6);
  g.fillRect(hx - h * 0.03, hy - h * 0.05, h * 0.08, h * 0.02);
  g.fillStyle = joint;
  g.beginPath();
  g.arc(hx + h * 0.03, hy, h * 0.017, 0, Math.PI * 2);
  g.fill();
  if (o.kind === 'commander') {
    g.fillStyle = mark;
    g.fillRect(hx - h * 0.04, hy - h * 0.045, h * 0.05, h * 0.06);
  }
  g.restore();
}

function drawSuper(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose) {
  const g = E.ctx;
  const body = E.tone('#3e4656', d, 0.1);
  const lit = E.tone('#7a8498', d, 0.45);
  const dark = E.tone('#1e222a', d, 0);
  g.save();
  if (p.dead) {
    g.translate(x, y);
    g.scale(f, 1);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, -h * 0.08, h * 0.32, h * 0.1, 0.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = dark;
    g.fillRect(h * 0.25, -h * 0.06, h * 0.15, h * 0.06);
    g.restore();
    return;
  }
  fallFrame(g, x, y, h, f, p);
  const sw = Math.sin(p.ph) * p.moving;
  const hipY = -h * 0.42;
  for (const s of [-1, 1]) {
    const a = s * sw * 0.45;
    limb2(g, 0, hipY, Math.sin(a) * h * 0.2 + h * 0.04, hipY + h * 0.22, Math.sin(a) * h * 0.26, -h * 0.03, h * 0.09, s < 0 ? dark : body);
  }
  // The great chest, hunched; the small head sunk in it.
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-h * 0.14, hipY);
  g.quadraticCurveTo(-h * 0.24, hipY - h * 0.3, -h * 0.02, hipY - h * 0.4);
  g.quadraticCurveTo(h * 0.2, hipY - h * 0.38, h * 0.16, hipY - h * 0.12);
  g.lineTo(h * 0.08, hipY);
  g.fill();
  g.fillStyle = hexA(lit, 0.6);
  g.beginPath();
  g.ellipse(E.lx * f * h * 0.05, hipY - h * 0.33, h * 0.12, h * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = dark;
  g.fillRect(h * 0.02, hipY - h * 0.47, h * 0.09, h * 0.08);
  // Arms with the guns in the wrists.
  limb2(g, h * 0.06, hipY - h * 0.3, h * 0.14, hipY - h * 0.16, h * 0.3, hipY - h * 0.18, h * 0.08, body);
  g.fillStyle = dark;
  g.fillRect(h * 0.24, hipY - h * 0.215, h * 0.14, h * 0.06);
  g.restore();
}

/** How each Jedi and Separatist leader looks: skin, hair or headgear, and anything that marks them out at a glance. */
type Look = { skin: string; hair: string; head: 'hair' | 'bald' | 'montrals' | 'lekku' | 'tentacles' | 'mask' | 'cone' | 'yoda' | 'beard' | 'grievous' | 'ventress' | 'dooku' | 'krell'; tunic?: string };
const LOOKS: Record<string, Look> = {
  'ANAKIN SKYWALKER': { skin: '#d8a888', hair: '#5a3a22', head: 'hair', tunic: '#2a2226' },
  'OBI-WAN KENOBI': { skin: '#e0b090', hair: '#9a5a2a', head: 'beard' },
  'AHSOKA TANO': { skin: '#d8743a', hair: '#e8e8f0', head: 'montrals', tunic: '#7a3a32' },
  'MACE WINDU': { skin: '#5a3a28', hair: '#2a1c14', head: 'bald' },
  YODA: { skin: '#8aa868', hair: '#d8d8c8', head: 'yoda' },
  'KI-ADI-MUNDI': { skin: '#e0b090', hair: '#e8e0d0', head: 'cone' },
  'PLO KOON': { skin: '#c8783a', hair: '#2a2a2a', head: 'mask' },
  'LUMINARA UNDULI': { skin: '#a8b078', hair: '#1a1a2a', head: 'hair' },
  'KIT FISTO': { skin: '#4a9a5a', hair: '#3a8a4a', head: 'tentacles' },
  'AAYLA SECURA': { skin: '#5a9ad8', hair: '#5a9ad8', head: 'lekku' },
  'SHAAK TI': { skin: '#d84a3a', hair: '#e8e8f0', head: 'montrals' },
  'QUINLAN VOS': { skin: '#c89868', hair: '#3a2a1a', head: 'hair' },
  'PONG KRELL': { skin: '#7a8a6a', hair: '#5a6a4a', head: 'krell' },
  'GENERAL GRIEVOUS': { skin: '#e8e0d0', hair: '#c8a878', head: 'grievous' },
  'ASAJJ VENTRESS': { skin: '#d8d8d0', hair: '#1a1a1a', head: 'ventress', tunic: '#1a1a20' },
  'COUNT DOOKU': { skin: '#d8b8a0', hair: '#c8c8c8', head: 'dooku', tunic: '#2a2228' },
};
export const isSmall = (name: string) => name === 'YODA';

export function drawKnight(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose, o: { name: string; robe: string; blade: string; swing: number; lead: boolean; twin: boolean; four?: boolean; dark: boolean }): [number, number, number, number][] {
  const g = E.ctx;
  const look = LOOKS[o.name] ?? { skin: o.dark ? '#b8b0a8' : '#c89a78', hair: '#4a3424', head: 'hair' };
  const robe = E.tone(o.robe, d, 0.1);
  const robeDark = E.tone(mix(o.robe, '#000000', 0.4), d, 0);
  const tunic = E.tone(look.tunic ?? (o.dark ? '#3a3238' : '#c8b898'), d, 0.2);
  const skin = E.tone(look.skin, d, 0.25);
  const hair = E.tone(look.hair, d, 0.05);
  const boot = E.tone('#2a2420', d, 0);
  const grievous = look.head === 'grievous';
  const sw = Math.sin(p.ph) * p.moving;
  const hipY = -h * 0.47;
  const shY = hipY - h * 0.3;
  const blades: [number, number, number, number][] = [];
  g.save();
  g.translate(x, y);
  g.scale(f, 1);
  if (grievous) {
    // The general: a hunched cyborg, bone-white armour on grey limbs, a cape, the mask.
    const bone = E.tone('#e8e0d0', d, 0.3);
    const metal = E.tone('#5a5a60', d, 0.1);
    for (const sd of [-1, 1]) {
      const a = sd * sw * 0.6;
      limb2(g, 0, hipY, Math.sin(a) * h * 0.2 + h * 0.06, hipY + h * 0.26, Math.sin(a) * h * 0.3, -h * 0.02, h * 0.05, metal);
      g.fillStyle = metal;
      g.beginPath();
      g.moveTo(Math.sin(a) * h * 0.3 - h * 0.06, 0);
      g.lineTo(Math.sin(a) * h * 0.3 + h * 0.08, 0);
      g.lineTo(Math.sin(a) * h * 0.3, -h * 0.05);
      g.fill();
    }
    g.fillStyle = robeDark;
    g.beginPath();
    g.moveTo(-h * 0.06, shY);
    g.quadraticCurveTo(-h * (0.26 + p.moving * 0.2), hipY, -h * (0.22 + p.moving * 0.3), -h * 0.06);
    g.lineTo(-h * 0.02, hipY);
    g.fill();
    g.fillStyle = bone;
    g.beginPath();
    g.moveTo(-h * 0.08, hipY);
    g.lineTo(-h * 0.06, shY + h * 0.02);
    g.quadraticCurveTo(h * 0.06, shY - h * 0.05, h * 0.12, shY + h * 0.05);
    g.lineTo(h * 0.06, hipY);
    g.fill();
    g.fillStyle = metal;
    g.fillRect(-h * 0.02, hipY - h * 0.12, h * 0.06, h * 0.12);
    // The mask, the yellow eyes.
    g.fillStyle = bone;
    g.beginPath();
    g.moveTo(h * 0.04, shY - h * 0.02);
    g.lineTo(h * 0.13, shY - h * 0.08);
    g.lineTo(h * 0.11, shY - h * 0.2);
    g.lineTo(h * 0.02, shY - h * 0.2);
    g.closePath();
    g.fill();
    g.fillStyle = '#ffe050';
    g.fillRect(h * 0.08, shY - h * 0.15, h * 0.03, h * 0.015);
  } else {
    // The legs, in boots, under the robe.
    for (const sd of [-1, 1]) {
      const a = sd * sw * 0.7;
      limb2(g, 0, hipY, Math.sin(a) * h * 0.24, hipY + h * 0.24, Math.sin(a) * h * 0.34, -h * 0.03, h * 0.07, sd < 0 ? robeDark : boot);
    }
    // The cloak flying out behind when they run.
    g.fillStyle = robeDark;
    g.beginPath();
    g.moveTo(-h * 0.04, shY);
    g.quadraticCurveTo(-h * (0.2 + p.moving * 0.25), hipY, -h * (0.18 + p.moving * 0.35), -h * (0.08 + p.moving * 0.12));
    g.lineTo(h * 0.04, hipY + h * 0.1);
    g.fill();
    // The robe and the tunic, the belt.
    g.fillStyle = robe;
    g.beginPath();
    g.moveTo(-h * 0.1, shY);
    g.lineTo(h * 0.1, shY);
    g.lineTo(h * 0.13, hipY + h * 0.18);
    g.lineTo(-h * 0.15, hipY + h * 0.16);
    g.closePath();
    g.fill();
    g.fillStyle = tunic;
    g.beginPath();
    g.moveTo(-h * 0.02, shY);
    g.lineTo(h * 0.07, shY);
    g.lineTo(h * 0.03, hipY);
    g.fill();
    g.fillStyle = boot;
    g.fillRect(-h * 0.1, hipY - h * 0.02, h * 0.2, h * 0.035);
    // The head: each to their own.
    const hx0 = h * 0.02;
    const hy0 = shY - h * 0.08;
    const hr = h * 0.065;
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(hx0, hy0, hr * 0.92, hr * 1.08, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hair;
    switch (look.head) {
      case 'hair':
      case 'beard':
        g.beginPath();
        g.ellipse(hx0 - hr * 0.15, hy0 - hr * 0.45, hr, hr * 0.75, 0, Math.PI * 0.9, Math.PI * 2.1);
        g.fill();
        g.fillRect(hx0 - hr * 1.0, hy0 - hr * 0.5, hr * 0.5, hr * 1.4);
        if (look.head === 'beard') {
          g.beginPath();
          g.ellipse(hx0 + hr * 0.25, hy0 + hr * 0.75, hr * 0.6, hr * 0.45, 0, 0, Math.PI);
          g.fill();
        }
        break;
      case 'montrals':
        // Two horns up, lekku down, white and blue striped.
        g.beginPath();
        g.moveTo(hx0 - hr * 0.6, hy0 - hr * 0.6);
        g.quadraticCurveTo(hx0 - hr * 0.9, hy0 - hr * 2.2, hx0 - hr * 0.1, hy0 - hr * 2.4);
        g.quadraticCurveTo(hx0 - hr * 0.2, hy0 - hr * 1.4, hx0 + hr * 0.2, hy0 - hr * 0.8);
        g.fill();
        g.beginPath();
        g.moveTo(hx0 - hr * 0.8, hy0);
        g.quadraticCurveTo(hx0 - hr * 1.4, hy0 + hr * 1.8, hx0 - hr * 0.6, hy0 + hr * 2.6);
        g.lineTo(hx0 - hr * 0.2, hy0 + hr * 0.6);
        g.fill();
        g.fillStyle = E.tone('#3a5aa8', d, 0.1);
        g.fillRect(hx0 - hr * 0.7, hy0 - hr * 1.6, hr * 0.4, hr * 0.25);
        break;
      case 'lekku':
        g.beginPath();
        g.moveTo(hx0 - hr * 0.7, hy0 - hr * 0.2);
        g.quadraticCurveTo(hx0 - hr * 1.8, hy0 + hr * 2, hx0 - hr * 1.2, hy0 + hr * 3.6);
        g.lineTo(hx0 - hr * 0.6, hy0 + hr * 3.4);
        g.quadraticCurveTo(hx0 - hr * 1.0, hy0 + hr * 1.6, hx0 - hr * 0.1, hy0 + hr * 0.4);
        g.fill();
        g.fillStyle = E.tone('#4a3424', d, 0);
        g.fillRect(hx0 - hr * 0.8, hy0 - hr * 0.8, hr * 1.4, hr * 0.3);
        break;
      case 'tentacles':
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.moveTo(hx0 - hr * 0.5, hy0 - hr * 0.5 + i * hr * 0.2);
          g.quadraticCurveTo(hx0 - hr * 1.6, hy0 + i * hr * 0.4, hx0 - hr * (1.1 + i * 0.15), hy0 + hr * (1.4 + i * 0.4));
          g.lineWidth = hr * 0.35;
          g.strokeStyle = hair;
          g.stroke();
        }
        break;
      case 'mask':
        g.fillStyle = E.tone('#2a2a2a', d, 0.1);
        g.fillRect(hx0 - hr * 0.1, hy0 - hr * 0.3, hr * 1.1, hr * 0.9);
        g.fillStyle = E.tone('#8a8a90', d, 0.3);
        g.fillRect(hx0 + hr * 0.6, hy0 - hr * 0.2, hr * 0.35, hr * 0.25);
        break;
      case 'cone':
        g.fillStyle = skin;
        g.beginPath();
        g.ellipse(hx0 - hr * 0.1, hy0 - hr * 1.2, hr * 0.85, hr * 1.6, -0.15, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = hair;
        g.beginPath();
        g.ellipse(hx0 + hr * 0.3, hy0 + hr * 0.8, hr * 0.5, hr * 0.5, 0, 0, Math.PI);
        g.fill();
        break;
      case 'yoda':
        // Great ears out to the sides.
        g.fillStyle = skin;
        g.beginPath();
        g.moveTo(hx0 - hr * 0.6, hy0 - hr * 0.1);
        g.lineTo(hx0 - hr * 2.4, hy0 - hr * 0.9);
        g.lineTo(hx0 - hr * 0.7, hy0 + hr * 0.4);
        g.fill();
        g.beginPath();
        g.moveTo(hx0 + hr * 0.4, hy0 - hr * 0.1);
        g.lineTo(hx0 + hr * 1.6, hy0 - hr * 0.8);
        g.lineTo(hx0 + hr * 0.5, hy0 + hr * 0.4);
        g.fill();
        g.fillStyle = hair;
        g.fillRect(hx0 - hr * 0.5, hy0 - hr * 1.0, hr * 0.8, hr * 0.2);
        break;
      case 'ventress':
        g.fillStyle = E.tone('#e8e8e0', d, 0.4);
        g.beginPath();
        g.ellipse(hx0, hy0 - hr * 0.2, hr * 0.95, hr * 1.1, 0, Math.PI, Math.PI * 2);
        g.fill();
        break;
      case 'dooku':
        g.beginPath();
        g.ellipse(hx0 - hr * 0.2, hy0 - hr * 0.5, hr * 0.9, hr * 0.6, 0, Math.PI, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(hx0 + hr * 0.25, hy0 + hr * 0.7, hr * 0.45, hr * 0.5, 0, 0, Math.PI);
        g.fill();
        break;
      case 'krell':
        g.fillStyle = skin;
        g.beginPath();
        g.ellipse(hx0 + hr * 0.2, hy0 + hr * 0.4, hr * 1.1, hr * 0.8, 0, 0, Math.PI);
        g.fill();
        break;
      default:
        break;
    }
  }
  // The arms and the blade: held high and forward on the charge, across the body in guard, swinging when it turns a bolt.
  const sx = h * 0.05;
  const sy = shY + h * 0.05;
  const guard = o.lead ? -1.25 : -0.55;
  const ang = guard + o.swing * 0.9;
  const curved = look.head === 'dooku';
  const bl = h * 0.62;
  const arm = (a: number, reach: number, flip: number) => {
    const hx = sx + Math.cos(a + 0.6 * flip) * h * reach;
    const hy = sy + Math.sin(a + 0.6 * flip) * h * reach + h * 0.06;
    limb2(g, sx, sy, (sx + hx) / 2 + h * 0.03, (sy + hy) / 2 + h * 0.05, hx, hy, h * 0.06, grievous ? E.tone('#5a5a60', d, 0.1) : robe);
    g.fillStyle = E.tone('#8a8a90', d, 0.3);
    g.fillRect(hx - h * 0.02, hy - h * 0.02, h * 0.04, h * 0.05);
    const ba = a + (curved ? 0.15 : 0);
    const bx = hx + Math.cos(ba) * bl;
    const by = hy + Math.sin(ba) * bl;
    g.strokeStyle = '#ffffff';
    g.lineWidth = Math.max(1, h * 0.03);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(bx, by);
    g.stroke();
    blades.push([x + f * hx, y + hy, x + f * bx, y + by]);
  };
  arm(ang, 0.18, 1);
  if (o.twin) arm(ang + 2.4 + o.swing * 0.5, 0.16, -1);
  if (o.four) {
    // Grievous's other two arms, wheeling.
    const sp = p.ph * 2;
    arm(-0.2 + Math.sin(sp) * 0.9, 0.2, 1);
    arm(-2.6 + Math.cos(sp) * 0.9, 0.2, -1);
  }
  g.lineCap = 'butt';
  g.restore();
  return blades;
}

/** A Wookiee warrior: tall, shaggy, a bowcaster, a bandolier. */
export function drawWookiee(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose, seed: number) {
  const g = E.ctx;
  const fur = E.tone(seed % 3 === 0 ? '#5a3e28' : seed % 3 === 1 ? '#6e5236' : '#4a3424', d, 0.1);
  const furLit = E.tone('#a8865e', d, 0.45);
  const dark = E.tone('#2a1c12', d, 0);
  g.save();
  if (p.dead) {
    g.translate(x, y);
    g.scale(f, 1);
    g.fillStyle = fur;
    g.beginPath();
    g.ellipse(0, -h * 0.08, h * 0.45, h * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  fallFrame(g, x, y, h, f, p);
  const sw = Math.sin(p.ph) * p.moving;
  const hipY = -h * 0.42;
  for (const s of [-1, 1]) {
    const a = s * sw * 0.6;
    limb2(g, 0, hipY, Math.sin(a) * h * 0.2, hipY + h * 0.22, Math.sin(a) * h * 0.28, -h * 0.02, h * 0.1, s < 0 ? dark : fur);
  }
  // The great shaggy body, ragged at the edges.
  g.fillStyle = fur;
  g.beginPath();
  g.moveTo(-h * 0.12, hipY + h * 0.04);
  for (let i = 0; i <= 8; i++) {
    const q = i / 8;
    g.lineTo(-h * 0.13 - Math.sin(q * 9 + seed) * h * 0.02, hipY - q * h * 0.36);
  }
  g.quadraticCurveTo(h * 0.02, hipY - h * 0.46, h * 0.14, hipY - h * 0.34);
  for (let i = 8; i >= 0; i--) {
    const q = i / 8;
    g.lineTo(h * 0.13 + Math.sin(q * 7 + seed) * h * 0.02, hipY - q * h * 0.34);
  }
  g.closePath();
  g.fill();
  g.fillStyle = hexA(furLit, 0.45);
  g.fillRect(E.lx * f > 0 ? h * 0.04 : -h * 0.1, hipY - h * 0.34, h * 0.06, h * 0.3);
  // The bandolier.
  g.strokeStyle = E.tone('#8a7a5a', d, 0.3);
  g.lineWidth = h * 0.03;
  g.beginPath();
  g.moveTo(-h * 0.1, hipY - h * 0.34);
  g.lineTo(h * 0.1, hipY - h * 0.04);
  g.stroke();
  // The head, the snout.
  g.fillStyle = fur;
  g.beginPath();
  g.ellipse(h * 0.04, hipY - h * 0.45, h * 0.075, h * 0.085, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = dark;
  g.fillRect(h * 0.08, hipY - h * 0.45, h * 0.04, h * 0.03);
  // The bowcaster, held forward.
  const gy = hipY - h * 0.25;
  limb2(g, h * 0.05, hipY - h * 0.32, h * 0.12, gy + h * 0.04, h * 0.2, gy, h * 0.07, fur);
  g.fillStyle = dark;
  g.fillRect(h * 0.08, gy - h * 0.02, h * 0.32, h * 0.04);
  g.strokeStyle = E.tone('#6a6a6a', d, 0.2);
  g.lineWidth = Math.max(0.6, h * 0.015);
  g.beginPath();
  g.moveTo(h * 0.3, gy - h * 0.07);
  g.quadraticCurveTo(h * 0.26, gy, h * 0.3, gy + h * 0.07);
  g.stroke();
  g.restore();
}

/** A Twi'lek freedom fighter: slim, in leathers, the head-tails hanging behind. */
export function drawTwilek(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose, seed: number) {
  const g = E.ctx;
  const skins = ['#5a8ad0', '#6aa85a', '#c85a4a', '#d8a868', '#9a6ab8'];
  const skin = E.tone(skins[seed % skins.length], d, 0.25);
  const cloth = E.tone(seed % 2 ? '#8a6a48' : '#6a5a4a', d, 0.15);
  const dark = E.tone('#2a2018', d, 0);
  g.save();
  if (p.dead) {
    g.translate(x, y);
    g.scale(f, 1);
    g.fillStyle = cloth;
    g.beginPath();
    g.ellipse(0, -h * 0.06, h * 0.4, h * 0.07, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  fallFrame(g, x, y, h, f, p);
  const sw = Math.sin(p.ph) * p.moving;
  const c = p.crouch;
  const hipY = -h * 0.46 * (1 - c * 0.35);
  for (const s of [-1, 1]) {
    const a = s * sw * 0.6;
    limb2(g, 0, hipY, Math.sin(a) * h * 0.22, hipY + h * 0.23 * (1 - c * 0.3), Math.sin(a) * h * 0.3, -h * 0.02, h * 0.06, s < 0 ? dark : cloth);
  }
  const shY = hipY - h * 0.28;
  g.fillStyle = cloth;
  g.beginPath();
  g.moveTo(-h * 0.08, hipY);
  g.lineTo(-h * 0.09, shY);
  g.lineTo(h * 0.09, shY);
  g.lineTo(h * 0.07, hipY);
  g.fill();
  g.fillStyle = dark;
  g.fillRect(-h * 0.08, hipY - h * 0.03, h * 0.16, h * 0.03);
  // Head and lekku.
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(h * 0.02, shY - h * 0.08, h * 0.055, h * 0.065, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-h * 0.02, shY - h * 0.1);
  g.quadraticCurveTo(-h * 0.12, shY + h * 0.02, -h * 0.08, shY + h * 0.18);
  g.lineTo(-h * 0.04, shY + h * 0.16);
  g.quadraticCurveTo(-h * 0.06, shY + h * 0.02, h * 0.01, shY - h * 0.06);
  g.fill();
  // A rifle.
  const gy = shY + h * 0.1;
  limb2(g, h * 0.02, shY + h * 0.04, h * 0.1, gy + h * 0.04, h * 0.16, gy, h * 0.05, skin);
  g.fillStyle = dark;
  g.fillRect(h * 0.04, gy - h * 0.02, h * 0.3, h * 0.035);
  g.restore();
}

/** A Geonosian warrior: a winged insect with a long head, thin limbs, a sonic blaster; wings a blur when it flies. */
export function drawGeonosian(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose, flying: boolean) {
  const g = E.ctx;
  const shell = E.tone('#8a5a3a', d, 0.15);
  const lit = E.tone('#d0905a', d, 0.45);
  const dark = E.tone('#3a2418', d, 0);
  g.save();
  if (p.dead) {
    g.translate(x, y);
    g.scale(f, 1);
    g.fillStyle = shell;
    g.beginPath();
    g.ellipse(0, -h * 0.06, h * 0.3, h * 0.07, 0.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  fallFrame(g, x, y, h, f, p);
  const hipY = -h * 0.42;
  const shY = hipY - h * 0.24;
  // Wings: two pairs, a translucent blur beating.
  const beat = flying ? Math.sin(p.ph) : -0.6;
  g.fillStyle = hexA(E.tone('#c8d8c0', d, 0.4), flying ? 0.35 : 0.6);
  for (const k of [0, 0.4]) {
    g.beginPath();
    g.moveTo(-h * 0.04, shY + h * 0.04);
    g.quadraticCurveTo(-h * 0.35, shY - h * (0.1 + beat * 0.25 + k * 0.2), -h * 0.5, shY + h * (0.1 - beat * 0.3 + k * 0.1));
    g.quadraticCurveTo(-h * 0.3, shY + h * 0.12, -h * 0.04, shY + h * 0.08);
    g.fill();
  }
  // Legs, dangling when it flies.
  for (const s of [-1, 1]) {
    const a = flying ? 0.3 + s * 0.1 : s * Math.sin(p.ph) * p.moving * 0.5;
    limb2(g, 0, hipY, Math.sin(a) * h * 0.18 + h * 0.06, hipY + h * 0.22, Math.sin(a) * h * 0.24 - h * 0.02, -h * 0.02, h * 0.04, s < 0 ? dark : shell);
  }
  // Thorax, abdomen.
  g.fillStyle = shell;
  g.beginPath();
  g.ellipse(-h * 0.03, hipY + h * 0.02, h * 0.08, h * 0.1, 0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(0, shY + h * 0.1, h * 0.07, h * 0.13, -0.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hexA(lit, 0.6);
  g.fillRect(h * 0.0, shY + h * 0.02, h * 0.03, h * 0.12);
  // The long head forward, the eyes.
  g.fillStyle = shell;
  g.beginPath();
  g.moveTo(h * 0.0, shY - h * 0.02);
  g.quadraticCurveTo(h * 0.12, shY - h * 0.14, h * 0.2, shY - h * 0.05);
  g.lineTo(h * 0.06, shY + h * 0.04);
  g.fill();
  g.fillStyle = dark;
  g.fillRect(h * 0.08, shY - h * 0.09, h * 0.04, h * 0.03);
  // The sonic blaster.
  limb2(g, h * 0.02, shY + h * 0.06, h * 0.08, shY + h * 0.14, h * 0.16, shY + h * 0.12, h * 0.035, shell);
  g.fillStyle = dark;
  g.fillRect(h * 0.1, shY + h * 0.1, h * 0.18, h * 0.035);
  g.restore();
}

/** A MagnaGuard: tall and dark, a ragged cape and head-wrap, the electrostaff glowing at both ends. Returns the staff's ends. */
export function drawMagna(E: Env, x: number, y: number, h: number, f: number, d: number, p: Pose): [number, number, number, number] {
  const g = E.ctx;
  const body = E.tone('#3a3a40', d, 0.1);
  const cape = E.tone('#2a2420', d, 0);
  const lit = E.tone('#7a7a84', d, 0.4);
  const sw = Math.sin(p.ph) * p.moving;
  g.save();
  if (p.dead) {
    g.translate(x, y);
    g.scale(f, 1);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, -h * 0.07, h * 0.42, h * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return [x, y, x, y];
  }
  fallFrame(g, x, y, h, f, p);
  const hipY = -h * 0.46;
  const shY = hipY - h * 0.32;
  for (const s of [-1, 1]) {
    const a = s * sw * 0.7;
    limb2(g, 0, hipY, Math.sin(a) * h * 0.22, hipY + h * 0.24, Math.sin(a) * h * 0.32, -h * 0.02, h * 0.05, body);
  }
  g.fillStyle = cape;
  g.beginPath();
  g.moveTo(-h * 0.06, shY);
  g.quadraticCurveTo(-h * (0.2 + p.moving * 0.2), hipY, -h * (0.16 + p.moving * 0.25), -h * 0.12);
  g.lineTo(h * 0.02, hipY);
  g.fill();
  g.fillStyle = body;
  g.fillRect(-h * 0.07, shY, h * 0.14, h * 0.32);
  g.fillStyle = hexA(lit, 0.5);
  g.fillRect(-h * 0.02, shY + h * 0.02, h * 0.04, h * 0.25);
  g.fillStyle = cape;
  g.beginPath();
  g.ellipse(h * 0.01, shY - h * 0.08, h * 0.06, h * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ff4030';
  g.fillRect(h * 0.03, shY - h * 0.09, h * 0.03, h * 0.015);
  const a = -0.5 + Math.sin(p.ph * 0.5) * 0.4 * p.moving;
  const len = h * 0.6;
  const cx = h * 0.1;
  const cy = shY + h * 0.12;
  const x0 = cx - Math.cos(a) * len * 0.5;
  const y0 = cy - Math.sin(a) * len * 0.5;
  const x1 = cx + Math.cos(a) * len * 0.5;
  const y1 = cy + Math.sin(a) * len * 0.5;
  g.strokeStyle = E.tone('#5a5a60', d, 0.2);
  g.lineWidth = Math.max(1, h * 0.025);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.restore();
  return [x + f * x0, y + y0, x + f * x1, y + y1];
}

export function drawRoller(E: Env, x: number, y: number, s: number, f: number, d: number, o: { state: string; k: number; spin: number; shield: number }): void {
  const g = E.ctx;
  const bronze = E.tone('#8a6a44', d, 0.15);
  const lit = E.tone('#d0a868', d, 0.5);
  const dark = E.tone('#3a2c20', d, 0);
  g.save();
  g.translate(x, y);
  g.scale(f, 1);
  if (o.state === 'roll' || (o.state === 'deploy' && o.k < 0.3)) {
    const r = s * 0.3;
    g.fillStyle = bronze;
    g.beginPath();
    g.arc(0, -r, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = dark;
    g.lineWidth = Math.max(0.6, s * 0.03);
    for (let i = 0; i < 3; i++) {
      const a = o.spin + (i * Math.PI) / 3;
      g.beginPath();
      g.moveTo(Math.cos(a) * r, -r + Math.sin(a) * r);
      g.lineTo(-Math.cos(a) * r, -r - Math.sin(a) * r);
      g.stroke();
    }
    g.fillStyle = hexA(lit, 0.55);
    g.beginPath();
    g.ellipse(-E.lx * f * r * -0.3, -r * 1.45, r * 0.45, r * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return;
  }
  const k = o.state === 'deploy' ? Math.min(1, (o.k - 0.3) / 0.7) : 1;
  const bodyY = -s * (0.25 + 0.4 * k);
  // Three spindly legs.
  for (const [lx, w] of [[-0.25, 1], [0.05, 0.8], [0.3, 1]] as [number, number][]) limb2(g, lx * s * 0.3, bodyY, lx * s * 0.8, bodyY + s * 0.25 * k, lx * s * 1.1, 0, Math.max(0.8, s * 0.05 * w), lx < 0 ? dark : bronze);
  // The curled shell, the head tucked under it, the twin guns.
  g.fillStyle = bronze;
  g.beginPath();
  g.moveTo(-s * 0.25, bodyY + s * 0.05);
  g.quadraticCurveTo(-s * 0.3, bodyY - s * 0.35, s * 0.05, bodyY - s * 0.36);
  g.quadraticCurveTo(s * 0.3, bodyY - s * 0.32, s * 0.25, bodyY - s * 0.06);
  g.lineTo(s * 0.05, bodyY + s * 0.08);
  g.closePath();
  g.fill();
  g.strokeStyle = hexA(dark, 0.7);
  g.lineWidth = Math.max(0.5, s * 0.02);
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.arc(s * 0.0, bodyY + s * 0.02, s * (0.1 * i), Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
  g.fillStyle = hexA(lit, 0.6);
  g.beginPath();
  g.ellipse(-s * 0.05, bodyY - s * 0.3, s * 0.15, s * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = dark;
  g.fillRect(s * 0.15, bodyY - s * 0.08, s * 0.35 * k, s * 0.045);
  g.fillRect(s * 0.15, bodyY + s * 0.0, s * 0.35 * k, s * 0.045);
  g.fillStyle = hexA('#ff4030', 0.9);
  g.fillRect(s * 0.2, bodyY - s * 0.17, s * 0.04, s * 0.04);
  g.restore();
}

/** A roller's bubble shield: a shimmering dome round it. */
export function drawBubble(E: Env, x: number, y: number, s: number, a: number) {
  if (a <= 0.02) return;
  const g = E.ctx;
  const r = s * 0.85;
  const gr = g.createRadialGradient(x, y - r * 0.5, r * 0.2, x, y - r * 0.5, r);
  gr.addColorStop(0, 'rgba(120,180,255,0)');
  gr.addColorStop(0.75, `rgba(120,180,255,${(0.1 * a).toFixed(3)})`);
  gr.addColorStop(1, `rgba(170,215,255,${(0.45 * a).toFixed(3)})`);
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(x, y - r * 0.45, r, r * 0.9, 0, Math.PI, Math.PI * 2);
  g.ellipse(x, y - r * 0.45, r, r * 0.25, 0, 0, Math.PI);
  g.fill();
  g.strokeStyle = `rgba(190,225,255,${(0.6 * a * (0.7 + 0.3 * Math.sin(E.t * 9 + x))).toFixed(3)})`;
  g.lineWidth = Math.max(0.6, s * 0.02);
  g.beginPath();
  g.ellipse(x, y - r * 0.45, r, r * 0.9, 0, Math.PI, Math.PI * 2);
  g.stroke();
}
