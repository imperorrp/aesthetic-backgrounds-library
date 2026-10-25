/**
 * A mech, drawn: a giant of armour plate on articulated limbs, three-quarters on, facing `dir`.
 *
 * Unit space: the mech is one unit tall, its feet at the origin, facing +x. Back to front: the far
 * arm, the far leg, the pelvis, the near leg, the abdomen and chest (the reactor in it, the
 * emblem on it), the far pauldron and its cannon, the conn-pod with its visor, the near arm with
 * its weapon, the near pauldron with its mark and its missile pods. Every plate is lit from the
 * key light's side, toned by the hour and the distance, edged by the rain. Plates torn by the
 * fight show their dark insides; a mech being built shows its frame where the plates are not on yet.
 */
import { hash } from '../../instruments/kit';
import { clamp01, hexA, mix, type Env } from './look';
import type { Mech } from './types';

export type Pose = {
  /** Walk phase and how far the stride is; the bob of breathing. */
  walk: number; stride: number;
  /** Arms: shoulder angle (0 hanging, + forward), elbow bend (+ forward). */
  near: [number, number]; far: [number, number];
  lean: number;
  /** Legs dangling on the cables, 0..1. */
  hang: number;
  /** The blade out, 0..1; the caster's muzzle, the elbow rocket's burn, 0..1. */
  blade: number; fire: number; rocket: number; shoulder: number;
  /** The visor and the core, 0..1 (a systems check flares them). */
  lights: number;
};

export const IDLE: Pose = { walk: 0, stride: 0, near: [0.12, 0.28], far: [0.1, 0.32], lean: 0, hang: 0, blade: 0, fire: 0, rocket: 0, shoulder: 0, lights: 1 };

const DIMS = {
  heavy: { chest: 0.4, hip: 0.25, thigh: 0.075, shin: 0.07, arm: 0.07, head: 0.1, pad: 0.15, legL: 0.23 },
  lean: { chest: 0.33, hip: 0.21, thigh: 0.06, shin: 0.058, arm: 0.058, head: 0.09, pad: 0.12, legL: 0.25 },
  broad: { chest: 0.46, hip: 0.26, thigh: 0.072, shin: 0.068, arm: 0.08, head: 0.085, pad: 0.17, legL: 0.225 },
};

type Lit = { lit: string; mid: string; dark: string; edge: string };

export function drawMech(E: Env, m: Mech, x: number, y: number, s: number, dir: number, p: Pose, o: { d: number; inside: boolean; from: number; t: number; water?: number | null; tilt?: number }) {
  const c = E.ctx;
  const D = DIMS[m.build];
  const T = (col: string, lift = 0) => (o.inside ? mix(col, '#000000', 0.08) : mix(E.tone(col, o.d, lift + 0.15), col, 0.3 * (1 - E.hazeOf(o.d))));
  const key = o.inside ? E.L.work : E.L.key;
  const keyA = o.inside ? 0.38 : 0.18 + E.L.rim * 0.25 + E.flash * 0.5;
  const ink = o.inside ? '#0a0806' : E.L.ink;
  const shade = (col: string): Lit => {
    const b = T(col);
    return { lit: mix(b, key, keyA), mid: b, dark: mix(b, ink, 0.55), edge: mix(mix(b, key, 0.6), '#ffffff', 0.15) };
  };
  const MAIN = shade(m.colors.main);
  const SEC = shade(m.colors.second);
  const TRIM = shade(m.colors.trim);
  const IRON = shade('#3a3e44');
  const JOINT = shade('#24272c');
  const lw = 1 / s;
  // The light comes from screen side `from`; in the mech's own space that is from * dir.
  const lx = o.from * dir;
  const built = m.built;
  let plateNo = 0;

  c.save();
  if (o.water != null) {
    c.beginPath();
    c.rect(x - s * 3, y - s * 4, s * 6, o.water - (y - s * 4));
    c.clip();
  }
  c.translate(x, y);
  if (o.tilt) c.rotate(-o.tilt * dir);
  c.scale(s * dir, s);
  c.lineJoin = 'round';
  c.lineCap = 'round';

  /** Fill a plate (a path already begun), lit across its box from the key side, edged on top. */
  const plate = (L: Lit, x0: number, y0: number, x1: number, y1: number, idx = plateNo++) => {
    if (built < 1 && hash(m.seed, idx, 5) > built * 1.25 - 0.1) {
      // Not on yet: the frame shows, a few struts and a brace.
      c.strokeStyle = hexA(T('#5a5e64'), 0.9);
      c.lineWidth = lw * 1.4;
      c.stroke();
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.moveTo(x1, y0);
      c.lineTo(x0, y1);
      c.strokeStyle = hexA(T('#3a3e44'), 0.8);
      c.stroke();
      return false;
    }
    const g = c.createLinearGradient(lx > 0 ? x1 : x0, y0, lx > 0 ? x0 : x1, y1);
    g.addColorStop(0, L.lit);
    g.addColorStop(0.5, L.mid);
    g.addColorStop(1, L.dark);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = hexA(ink, 0.55);
    c.lineWidth = lw * 1.1;
    c.stroke();
    return true;
  };
  const rimTop = (x0: number, x1: number, yy: number, a = 0.5) => {
    c.strokeStyle = hexA(MAIN.edge, a * (o.inside ? 0.8 : 0.35 + E.L.rim * 0.4 + E.flash));
    c.lineWidth = lw * 1.2;
    c.beginPath();
    c.moveTo(x0, yy);
    c.lineTo(x1, yy);
    c.stroke();
  };
  const panel = (x0: number, y0: number, x1: number, y1: number) => {
    c.strokeStyle = hexA(ink, 0.4);
    c.lineWidth = lw * 0.8;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  };
  const quad = (pts: number[]) => {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
  };
  /** A limb segment from a to b, w0 wide at a, w1 at b, as a plate. */
  const limb = (ax: number, ay: number, bx: number, by: number, w0: number, w1: number, L: Lit) => {
    const a = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    quad([ax + (cx * w0) / 2, ay + (cy * w0) / 2, bx + (cx * w1) / 2, by + (cy * w1) / 2, bx - (cx * w1) / 2, by - (cy * w1) / 2, ax - (cx * w0) / 2, ay - (cy * w0) / 2]);
    plate(L, Math.min(ax, bx) - w0 / 2, Math.min(ay, by), Math.max(ax, bx) + w0 / 2, Math.max(ay, by));
  };
  const joint = (jx: number, jy: number, r: number) => {
    c.beginPath();
    c.arc(jx, jy, r, 0, Math.PI * 2);
    plate(JOINT, jx - r, jy - r, jx + r, jy + r);
    c.fillStyle = hexA(IRON.lit, 0.6);
    c.beginPath();
    c.arc(jx - r * 0.25 * lx, jy - r * 0.25, r * 0.35, 0, Math.PI * 2);
    c.fill();
  };
  const torn = (part: keyof Mech['dmg'], cx0: number, cy0: number, w: number, h: number) => {
    const dm = m.dmg[part];
    if (dm < 0.12 || built < 1) return;
    const n = Math.ceil(dm * 4);
    for (let k = 0; k < n; k++) {
      const px = cx0 + (hash(m.seed, k, part.length * 7) - 0.5) * w;
      const py = cy0 + (hash(m.seed, k, part.length * 11) - 0.5) * h;
      const r = (0.018 + hash(m.seed, k, 3) * 0.03) * (0.6 + dm);
      c.beginPath();
      for (let q = 0; q < 9; q++) {
        const a = (q / 9) * Math.PI * 2;
        const rr = r * (0.55 + hash(m.seed, k * 13 + q, 9) * 0.6);
        if (q === 0) c.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8);
        else c.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8);
      }
      c.closePath();
      c.fillStyle = mix('#0c0a08', ink, 0.3);
      c.fill();
      c.strokeStyle = hexA('#ff9a40', 0.55 * (0.5 + 0.5 * Math.sin(o.t * 6 + k)));
      c.lineWidth = lw * 1.2;
      c.stroke();
      // Cables and ribs in the hole.
      c.strokeStyle = hexA('#6a5a48', 0.8);
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(px - r * 0.5, py - r * 0.3);
      c.lineTo(px + r * 0.4, py + r * 0.2);
      c.stroke();
    }
  };

  // ---- the legs (and where the body stands on them) ----------------------------------------------
  const hipY = -0.47;
  const legL = D.legL;
  const legs = [0, 1].map((k) => {
    const ph = p.walk + k * Math.PI;
    const swing = p.hang > 0 ? Math.sin(o.t * 0.8 + k * 1.3) * 0.08 * p.hang + (k ? 0.1 : -0.05) * p.hang : Math.sin(ph) * 0.38 * p.stride + (k ? 0.04 : -0.05);
    const bend = p.hang > 0 ? 0.25 * p.hang : Math.max(0, -Math.cos(ph)) * 0.6 * p.stride + 0.1;
    const hx = k ? 0.07 : -0.08;
    const kx = hx + Math.sin(swing) * legL;
    const ky = hipY + Math.cos(swing) * legL;
    const fx = kx + Math.sin(swing - bend) * legL * 1.05;
    const fy = ky + Math.cos(swing - bend) * legL * 1.05;
    return { hx, kx, ky, fx, fy, swing, bend };
  });
  const low = Math.max(legs[0].fy, legs[1].fy);
  const lift = p.hang > 0 ? 0 : -low;
  c.translate(0, lift + Math.sin(p.walk * 2) * 0.004 * p.stride);
  c.rotate(p.lean * 0.12);

  const drawLeg = (L: (typeof legs)[number], far: boolean) => {
    const Lc = far ? shade(mix(m.colors.main, '#000000', 0.25)) : MAIN;
    const Sc = far ? shade(mix(m.colors.second, '#000000', 0.25)) : SEC;
    // Thigh (with a piston alongside), knee guard, shin with its armour, the foot.
    limb(L.hx, hipY, L.kx, L.ky, D.thigh * 1.25, D.thigh, Sc);
    c.strokeStyle = hexA(IRON.lit, 0.8);
    c.lineWidth = lw * 2.2;
    c.beginPath();
    c.moveTo(L.hx + 0.03, hipY + 0.02);
    c.lineTo((L.hx + L.kx) / 2 + 0.035, (hipY + L.ky) / 2 + 0.02);
    c.stroke();
    joint(L.kx, L.ky, D.thigh * 0.55);
    limb(L.kx, L.ky, L.fx, L.fy - 0.02, D.shin * 1.35, D.shin * 1.1, Lc);
    // The shin's armour: a ridge, panel lines, a light.
    const mx = (L.kx + L.fx) / 2;
    const my = (L.ky + L.fy) / 2;
    panel(mx - D.shin * 0.5, my - 0.03, mx + D.shin * 0.5, my - 0.02);
    panel(mx - D.shin * 0.5, my + 0.03, mx + D.shin * 0.4, my + 0.035);
    if (!far) torn('legs', mx, my, D.shin, 0.12);
    // Knee cap.
    quad([L.kx - D.shin * 0.6, L.ky - 0.03, L.kx + D.shin * 0.75, L.ky - 0.02, L.kx + D.shin * 0.7, L.ky + 0.05, L.kx - D.shin * 0.4, L.ky + 0.045]);
    plate(TRIM, L.kx - D.shin * 0.6, L.ky - 0.03, L.kx + D.shin * 0.75, L.ky + 0.05);
    // Foot: a heel, a toe plate, ankle joint.
    const fx = L.fx;
    const fy = L.fy;
    const fa = p.hang > 0 ? 0.5 * p.hang : 0;
    c.save();
    c.translate(fx, fy);
    c.rotate(fa);
    quad([-0.07, 0, -0.06, -0.045, 0.03, -0.05, 0.11, -0.02, 0.12, 0]);
    plate(IRON, -0.07, -0.05, 0.12, 0);
    rimTop(-0.05, 0.05, -0.048, 0.4);
    c.fillStyle = hexA(ink, 0.6);
    c.fillRect(-0.07, -0.006, 0.19, 0.006);
    c.restore();
    joint(fx, fy - 0.045, D.shin * 0.42);
  };
  const drawArm = (side: 'near' | 'far', ang: [number, number], weapon: string | null) => {
    const far = side === 'far';
    const sx = far ? 0.16 : -0.19;
    const sy = -0.79;
    const ua = 0.2;
    const fa = 0.21;
    const a1 = ang[0];
    const a2 = ang[0] + ang[1];
    const ex = sx + Math.sin(a1) * ua;
    const ey = sy + Math.cos(a1) * ua;
    const wx = ex + Math.sin(a2) * fa;
    const wy = ey + Math.cos(a2) * fa;
    const Lc = far ? shade(mix(m.colors.main, '#000000', 0.28)) : MAIN;
    const Sc = far ? shade(mix(m.colors.second, '#000000', 0.28)) : SEC;
    limb(sx, sy, ex, ey, D.arm * 1.15, D.arm, Sc);
    joint(ex, ey, D.arm * 0.6);
    // The elbow rocket's ring, and its burn.
    if (p.rocket > 0.02 && !far) {
      const bx = ex - Math.sin(a2) * 0.06;
      const by = ey - Math.cos(a2) * 0.06;
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const len = (0.12 + k * 0.05) * p.rocket * (0.85 + 0.15 * Math.sin(o.t * 40 + k));
        c.fillStyle = hexA(k < 2 ? '#fff0c0' : '#ff8a30', 0.5 - k * 0.1);
        c.beginPath();
        c.moveTo(bx + Math.cos(a2) * 0.03, by - Math.sin(a2) * 0.03);
        c.lineTo(bx - Math.sin(a2) * len, by - Math.cos(a2) * len);
        c.lineTo(bx - Math.cos(a2) * 0.03, by + Math.sin(a2) * 0.03);
        c.fill();
      }
      c.restore();
    }
    // Forearm: a heavy housing (what kind depends on the weapon).
    const fw = D.arm * (weapon === 'plasma' ? 1.7 : 1.45);
    limb(ex, ey, wx, wy, fw, fw * 0.85, Lc);
    const along = (k: number, off: number): [number, number] => [ex + Math.sin(a2) * fa * k + Math.cos(a2) * off, ey + Math.cos(a2) * fa * k - Math.sin(a2) * off];
    for (const k of [0.3, 0.6]) {
      const [p0x, p0y] = along(k, -fw / 2);
      const [p1x, p1y] = along(k, fw / 2);
      panel(p0x, p0y, p1x, p1y);
    }
    if (!far) torn('armF', (ex + wx) / 2, (ey + wy) / 2, fw, 0.15);
    else torn('armB', (ex + wx) / 2, (ey + wy) / 2, fw, 0.15);
    if (weapon === 'plasma') {
      // Coils glowing in the core's colour along the caster; a muzzle at the wrist.
      for (const k of [0.25, 0.45, 0.65, 0.85]) {
        const [cx0, cy0] = along(k, -fw * 0.45);
        const [cx1, cy1] = along(k, fw * 0.45);
        c.strokeStyle = hexA(m.colors.core, (0.35 + 0.55 * p.fire) * p.lights);
        c.lineWidth = lw * 2;
        c.beginPath();
        c.moveTo(cx0, cy0);
        c.lineTo(cx1, cy1);
        c.stroke();
      }
      const [mx, my] = along(1.12, 0);
      if (p.fire > 0.02) {
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.restore();
        E.glow(mx, my, 0.12 + 0.12 * p.fire, m.colors.core, 0.9 * p.fire);
        E.glow(mx, my, 0.05, '#ffffff', p.fire);
      }
    }
    // Blade or chain blade: folded along the forearm, or out past the fist.
    if (weapon === 'sword' || weapon === 'chain') {
      const out = p.blade;
      const base = along(out > 0.5 ? 1.05 : 0.95, fw * 0.45);
      const ang2 = out > 0.5 ? a2 : a2 + Math.PI;
      const len = (weapon === 'chain' ? 0.44 : 0.4) * (out > 0.5 ? out : 0.75);
      const tx = base[0] + Math.sin(ang2) * len;
      const ty = base[1] + Math.cos(ang2) * len;
      const nx = Math.cos(ang2);
      const ny = -Math.sin(ang2);
      quad([base[0] + nx * 0.02, base[1] + ny * 0.02, tx + nx * 0.004, ty + ny * 0.004, tx - nx * 0.01, ty - ny * 0.01, base[0] - nx * 0.022, base[1] - ny * 0.022]);
      const bl = shade(weapon === 'chain' ? '#6a6e74' : '#b8c0c8');
      plate(bl, Math.min(base[0], tx), Math.min(base[1], ty), Math.max(base[0], tx), Math.max(base[1], ty));
      c.strokeStyle = hexA(weapon === 'chain' ? '#ffb070' : '#eef6ff', (0.4 + 0.5 * out) * (o.inside ? 0.8 : 0.4 + E.L.rim * 0.5 + E.flash));
      c.lineWidth = lw * 1.4;
      c.beginPath();
      c.moveTo(base[0] + nx * 0.02, base[1] + ny * 0.02);
      c.lineTo(tx, ty);
      c.stroke();
      if (weapon === 'chain') {
        c.fillStyle = hexA(ink, 0.7);
        for (let k = 1; k < 12; k++) {
          const q = k / 12;
          const qx = base[0] + (tx - base[0]) * q + nx * 0.022;
          const qy = base[1] + (ty - base[1]) * q + ny * 0.022;
          c.fillRect(qx - 0.005, qy - 0.005, 0.01, 0.01);
        }
      }
    }
    // The fist: a block with knuckle plates.
    c.save();
    c.translate(wx, wy);
    c.rotate(-a2);
    quad([-D.arm * 0.75, 0, D.arm * 0.75, 0, D.arm * 0.7, 0.085, -D.arm * 0.7, 0.085]);
    plate(IRON, -D.arm * 0.75, 0, D.arm * 0.75, 0.085);
    c.fillStyle = hexA(TRIM.mid, 0.9);
    c.fillRect(-D.arm * 0.7, 0.06, D.arm * 1.4, 0.02);
    c.restore();
  };

  // ---- back to front --------------------------------------------------------------------------------
  const ws = m.weapons;
  const armWeapon = ws.find((w) => w === 'plasma' || w === 'sword' || w === 'chain') ?? null;
  const farWeapon = ws.filter((w) => w === 'plasma' || w === 'sword' || w === 'chain')[1] ?? null;
  drawArm('far', p.far, farWeapon);
  // Far pauldron and the shoulder cannon behind the chest.
  const padW = D.pad;
  const fpx = 0.17;
  quad([fpx - padW * 0.55, -0.86, fpx + padW * 0.6, -0.87, fpx + padW * 0.7, -0.76, fpx - padW * 0.45, -0.74]);
  plate(shade(mix(m.colors.main, '#000000', 0.22)), fpx - padW * 0.55, -0.87, fpx + padW * 0.7, -0.74);
  if (ws.includes('cannon')) {
    const rec = p.shoulder * 0.03;
    c.save();
    c.translate(fpx, -0.9);
    quad([-0.06, 0.02, 0.07, 0.02, 0.08, -0.05, -0.05, -0.06]);
    plate(IRON, -0.06, -0.06, 0.08, 0.02);
    for (const b of [-0.035, -0.012]) {
      quad([0.06 - rec, b - 0.008, 0.24 - rec, b - 0.006, 0.24 - rec, b + 0.006, 0.06 - rec, b + 0.008]);
      plate(JOINT, 0.06, b - 0.008, 0.24, b + 0.008);
    }
    if (p.shoulder > 0.05) E.glow(0.26, -0.024, 0.1 * p.shoulder, '#ffd070', p.shoulder);
    c.restore();
  }
  drawLeg(legs[1], true);
  // Pelvis: a skirt of plates over the hips.
  quad([-D.hip * 0.62, -0.56, D.hip * 0.55, -0.56, D.hip * 0.6, -0.47, D.hip * 0.3, -0.42, -D.hip * 0.35, -0.42, -D.hip * 0.66, -0.47]);
  plate(SEC, -D.hip * 0.66, -0.56, D.hip * 0.6, -0.42);
  quad([-0.03, -0.55, 0.035, -0.55, 0.03, -0.43, -0.025, -0.43]);
  plate(TRIM, -0.03, -0.55, 0.035, -0.43);
  drawLeg(legs[0], false);
  // Abdomen: segmented plates, narrower.
  for (let k = 0; k < 3; k++) {
    const yy = -0.565 - k * 0.028;
    const w = D.chest * (0.42 + k * 0.03);
    quad([-w / 2 - 0.01, yy, w / 2, yy, w / 2 + 0.005, yy - 0.026, -w / 2 - 0.015, yy - 0.026]);
    plate(k % 2 ? IRON : JOINT, -w / 2, yy - 0.026, w / 2, yy);
  }
  // The chest: an armoured shell, the front face and a side face toward +x.
  const cw = D.chest;
  const cx0 = -cw * 0.58;
  const cx1 = cw * 0.36;
  const side = cw * 0.16;
  quad([cx0 + 0.02, -0.64, cx1, -0.64, cx1 + 0.02, -0.86, cx0 - 0.02, -0.87]);
  plate(MAIN, cx0 - 0.02, -0.87, cx1 + 0.02, -0.64);
  quad([cx1, -0.64, cx1 + side, -0.67, cx1 + side + 0.01, -0.85, cx1 + 0.02, -0.86]);
  plate(shade(mix(m.colors.main, '#000000', lx > 0 ? 0 : 0.3)), cx1, -0.86, cx1 + side, -0.64);
  // The upper chest: a collar of the second colour, a trim stripe.
  quad([cx0 - 0.015, -0.82, cx1 + 0.015, -0.81, cx1 + 0.02, -0.87, cx0 - 0.02, -0.875]);
  plate(SEC, cx0 - 0.02, -0.875, cx1 + 0.02, -0.81);
  rimTop(cx0, cx1 + side, -0.872, 0.8);
  c.fillStyle = hexA(TRIM.mid, 0.95);
  c.fillRect(cx0 + 0.01, -0.665, cx1 - cx0 - 0.02, 0.012);
  panel(cx0 + 0.02, -0.74, cx0 + cw * 0.3, -0.75);
  panel((cx0 + cx1) / 2, -0.66, (cx0 + cx1) / 2 + 0.005, -0.8);
  torn('chest', (cx0 + cx1) / 2 + 0.06, -0.74, cw * 0.7, 0.14);
  // The reactor: a ring with turning vanes, glowing.
  const rx = (cx0 + cx1) / 2 + 0.01;
  const ry = -0.745;
  const rr = cw * 0.17;
  if (built > 0.35) {
    c.fillStyle = mix('#0a0c10', ink, 0.3);
    c.beginPath();
    c.arc(rx, ry, rr, 0, Math.PI * 2);
    c.fill();
    const pulse = (0.75 + 0.25 * Math.sin(o.t * 2.4 + m.seed)) * p.lights * clamp01((built - 0.35) * 3) * (1 - m.dmg.chest * 0.4);
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(rx, ry, rr * 3.2, m.colors.core, 0.55 * pulse);
    c.fillStyle = hexA(m.colors.core, 0.85 * pulse);
    c.beginPath();
    c.arc(rx, ry, rr * 0.82, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.strokeStyle = hexA(mix(m.colors.core, '#000000', 0.6), 0.8);
    c.lineWidth = lw * 1.5;
    const spin = o.t * 1.5;
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = spin + (k / 6) * Math.PI * 2;
      c.moveTo(rx, ry);
      c.lineTo(rx + Math.cos(a) * rr * 0.8, ry + Math.sin(a) * rr * 0.8);
    }
    c.stroke();
    c.fillStyle = hexA('#ffffff', 0.85 * pulse);
    c.beginPath();
    c.arc(rx, ry, rr * 0.25, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = hexA(TRIM.mid, 0.9);
    c.lineWidth = lw * 2.4;
    c.beginPath();
    c.arc(rx, ry, rr, 0, Math.PI * 2);
    c.stroke();
  }
  // Nose art: the emblem on the left of the chest.
  if (built > 0.9) emblem(c, m.emblem, cx0 + cw * 0.18, -0.8, cw * 0.11, hexA(TRIM.lit, 0.95), hexA(ink, 0.8), lw);
  // The conn-pod: the head sunk between the shoulders, a visor slit glowing, antennae.
  const hw = D.head;
  const hy0 = -0.87;
  quad([-hw * 0.55, hy0, hw * 0.6, hy0, hw * 0.55, hy0 - 0.075, hw * 0.25, hy0 - 0.1, -hw * 0.45, hy0 - 0.095, -hw * 0.6, hy0 - 0.06]);
  plate(SEC, -hw * 0.6, hy0 - 0.1, hw * 0.6, hy0);
  torn('head', 0, hy0 - 0.05, hw, 0.06);
  const vis = p.lights * (1 - m.dmg.head * 0.5) * clamp01((built - 0.6) * 4);
  if (vis > 0.02) {
    c.fillStyle = hexA(m.colors.visor, 0.95 * vis);
    quad([-hw * 0.35, hy0 - 0.06, hw * 0.55, hy0 - 0.058, hw * 0.5, hy0 - 0.045, -hw * 0.35, hy0 - 0.047]);
    c.fill();
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(hw * 0.1, hy0 - 0.053, hw * 1.4, m.colors.visor, 0.45 * vis);
    c.restore();
  } else {
    c.fillStyle = hexA(ink, 0.8);
    c.fillRect(-hw * 0.35, hy0 - 0.06, hw * 0.9, 0.013);
  }
  c.strokeStyle = hexA(IRON.mid, 0.9);
  c.lineWidth = lw * 1.2;
  c.beginPath();
  c.moveTo(-hw * 0.3, hy0 - 0.095);
  c.lineTo(-hw * 0.4, hy0 - 0.15);
  c.moveTo(hw * 0.1, hy0 - 0.1);
  c.lineTo(hw * 0.12, hy0 - 0.13);
  c.stroke();
  drawArm('near', p.near, armWeapon);
  // The near pauldron: the biggest plate, the mark on it, the missile pods over it.
  const npx = -0.2;
  quad([npx - padW * 0.62, -0.75, npx - padW * 0.7, -0.84, npx - padW * 0.3, -0.9, npx + padW * 0.55, -0.89, npx + padW * 0.62, -0.78, npx + padW * 0.4, -0.73]);
  const padOk = plate(MAIN, npx - padW * 0.7, -0.9, npx + padW * 0.62, -0.73);
  rimTop(npx - padW * 0.3, npx + padW * 0.5, -0.892, 0.9);
  if (padOk) {
    c.fillStyle = hexA(TRIM.mid, 0.95);
    quad([npx - padW * 0.66, -0.795, npx + padW * 0.6, -0.79, npx + padW * 0.61, -0.775, npx - padW * 0.64, -0.78]);
    c.fill();
    // Hazard chevrons on the pauldron's edge.
    c.fillStyle = hexA(ink, 0.55);
    for (let k = 0; k < 4; k++) {
      const qx = npx - padW * 0.5 + k * padW * 0.28;
      quad([qx, -0.77, qx + padW * 0.08, -0.77, qx + padW * 0.14, -0.745, qx + padW * 0.06, -0.745]);
      c.fill();
    }
    mark(c, m.mark, npx, -0.832, padW * 0.42, hexA(TRIM.lit, 0.95), s);
  }
  if (ws.includes('missiles')) {
    c.save();
    c.translate(npx - padW * 0.1, -0.9);
    quad([-0.07, 0, 0.07, 0, 0.065, -0.06, -0.065, -0.06]);
    plate(IRON, -0.07, -0.06, 0.07, 0);
    for (let k = 0; k < 6; k++) {
      const hx2 = -0.05 + (k % 3) * 0.05;
      const hy2 = -0.045 + Math.floor(k / 3) * 0.025;
      c.fillStyle = p.shoulder > 0.2 && k < 6 * p.shoulder ? hexA('#ffb060', 0.95) : hexA(ink, 0.85);
      c.beginPath();
      c.arc(hx2, hy2, 0.008, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  // Running lights at the shoulders, blinking.
  const blink = Math.sin(o.t * 3 + m.seed) > 0.6 ? 1 : 0.15;
  if (built > 0.8) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(npx - padW * 0.62, -0.84, 0.035, '#ff4030', 0.9 * blink);
    E.glow(fpx + padW * 0.62, -0.84, 0.03, '#40ff80', 0.7 * blink);
    c.restore();
  }
  // The acid's burn, smoking on the plates.
  if (m.burn > 0.02) {
    c.fillStyle = hexA('#b0ff50', 0.35 * m.burn);
    c.beginPath();
    c.ellipse(0, -0.72, cw * 0.4, 0.09, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** The mark on the pauldron, in roman numerals (kept readable when the drawing is mirrored). */
function mark(c: CanvasRenderingContext2D, n: number, x: number, y: number, w: number, color: string, s: number) {
  const tr = c.getTransform();
  const mirrored = tr.a < 0;
  const px = w * s;
  if (px < 5) return;
  c.save();
  c.translate(x, y);
  c.scale(1 / s, 1 / s);
  if (mirrored) c.scale(-1, 1);
  c.font = `bold ${Math.round(px * 0.9)}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(10, n)] ?? String(n), 0, 0);
  c.restore();
}

/** Nose art: a star, shark's teeth, a sun, a bird, an anchor, a skull, a bolt, a rose. */
export function emblem(c: CanvasRenderingContext2D, kind: string, x: number, y: number, r: number, fg: string, bg: string, lw: number) {
  c.save();
  c.translate(x, y);
  c.fillStyle = bg;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = fg;
  c.strokeStyle = fg;
  c.lineWidth = lw * 1.4;
  c.beginPath();
  if (kind === 'star') {
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      const rr = k % 2 ? r * 0.38 : r * 0.85;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.fill();
  } else if (kind === 'teeth') {
    c.moveTo(-r * 0.9, -r * 0.1);
    for (let k = 0; k <= 6; k++) c.lineTo(-r * 0.9 + (k / 6) * r * 1.8, k % 2 ? r * 0.4 : -r * 0.1);
    c.lineTo(r * 0.9, -r * 0.3);
    c.lineTo(-r * 0.9, -r * 0.3);
    c.fill();
  } else if (kind === 'sun') {
    c.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      c.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      c.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    }
    c.stroke();
  } else if (kind === 'bird') {
    c.moveTo(-r * 0.9, -r * 0.1);
    c.quadraticCurveTo(-r * 0.4, -r * 0.6, 0, r * 0.1);
    c.quadraticCurveTo(r * 0.4, -r * 0.6, r * 0.9, -r * 0.1);
    c.quadraticCurveTo(r * 0.4, -r * 0.2, 0, r * 0.4);
    c.quadraticCurveTo(-r * 0.4, -r * 0.2, -r * 0.9, -r * 0.1);
    c.fill();
  } else if (kind === 'anchor') {
    c.moveTo(0, -r * 0.75);
    c.lineTo(0, r * 0.7);
    c.moveTo(-r * 0.35, -r * 0.4);
    c.lineTo(r * 0.35, -r * 0.4);
    c.moveTo(-r * 0.7, r * 0.2);
    c.quadraticCurveTo(0, r * 1.1, r * 0.7, r * 0.2);
    c.stroke();
  } else if (kind === 'skull') {
    c.arc(0, -r * 0.1, r * 0.55, 0, Math.PI * 2);
    c.fill();
    c.fillRect(-r * 0.3, r * 0.3, r * 0.6, r * 0.35);
    c.fillStyle = bg;
    c.beginPath();
    c.arc(-r * 0.22, -r * 0.1, r * 0.15, 0, Math.PI * 2);
    c.arc(r * 0.22, -r * 0.1, r * 0.15, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 'bolt') {
    c.moveTo(r * 0.2, -r * 0.85);
    c.lineTo(-r * 0.45, r * 0.1);
    c.lineTo(-r * 0.02, r * 0.1);
    c.lineTo(-r * 0.25, r * 0.85);
    c.lineTo(r * 0.45, -r * 0.15);
    c.lineTo(r * 0.02, -r * 0.15);
    c.closePath();
    c.fill();
  } else {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      c.moveTo(0, 0);
      c.arc(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.38, 0, Math.PI * 2);
    }
    c.fill();
  }
  c.restore();
}

/** The pose for what a mech is doing now: walking, carried, idle, and the fight's moves. */
export function poseOf(m: Mech, t: number): Pose {
  const p: Pose = { ...IDLE, near: [...IDLE.near] as [number, number], far: [...IDLE.far] as [number, number] };
  const breathe = Math.sin(t * 0.8 + m.seed) * 0.03;
  p.near[0] += breathe;
  p.far[0] -= breathe;
  if (m.state === 'walkout' || m.state === 'walkin') {
    p.walk = m.ph;
    p.stride = 0.9;
    p.near = [Math.sin(m.ph + Math.PI) * 0.3 + 0.1, 0.35];
    p.far = [Math.sin(m.ph) * 0.3 + 0.1, 0.35];
  }
  if (m.state === 'carried' || m.state === 'hook' || m.state === 'home' || m.state === 'drop') {
    const k = m.state === 'hook' ? 0.3 : 1;
    p.hang = k;
    p.near = [0.45 * k + 0.1, 0.4];
    p.far = [0.35 * k + 0.1, 0.4];
  }
  if (m.state === 'fight' || m.state === 'pickup') {
    // A guard: fists up.
    p.near = [0.75, 1.35];
    p.far = [0.95, 1.2];
    p.lean = 0.2;
    p.walk = m.ph * 0.6;
    p.stride = 0.12;
  }
  const a = m.act;
  if (!a) return p;
  const k = clamp01((t - a.t0) / a.dur);
  const ease = (v: number) => v * v * (3 - 2 * v);
  const env = (k0: number, k1: number, k2: number) => (k < k0 ? 0 : k < k1 ? ease((k - k0) / (k1 - k0)) : k < k2 ? 1 : 1 - ease(clamp01((k - k2) / (1 - k2))));
  const blendArm = (from: [number, number], to: [number, number], w: number): [number, number] => [from[0] + (to[0] - from[0]) * w, from[1] + (to[1] - from[1]) * w];
  switch (a.kind) {
    case 'punch':
    case 'rocket': {
      const wind = env(0, 0.35, 0.4) * (k < 0.45 ? 1 : 0);
      const hit = env(0.38, 0.5, 0.65);
      p.near = blendArm(blendArm(p.near, [-0.5, 1.6], wind), [1.5, 0.05], hit);
      p.lean = 0.2 + hit * 0.5 - wind * 0.2;
      if (a.kind === 'rocket') p.rocket = env(0.3, 0.42, 0.6);
      break;
    }
    case 'plasma':
    case 'test-fire': {
      const aim = env(0, 0.25, 0.85);
      p.near = blendArm(p.near, [1.5, 0], aim);
      p.fire = env(0.3, 0.5, 0.8) * (0.7 + 0.3 * Math.sin(t * 30));
      p.shoulder = a.kind === 'test-fire' && m.weapons[0] !== 'plasma' ? env(0.3, 0.45, 0.7) : 0;
      if (a.kind === 'test-fire' && (m.weapons[0] === 'fists')) p.rocket = env(0.3, 0.45, 0.7);
      break;
    }
    case 'cannon':
    case 'missiles':
      p.shoulder = env(0.35, 0.45, 0.75);
      p.lean = 0.1;
      break;
    case 'sword':
    case 'chain':
    case 'test-blade': {
      p.blade = env(0, 0.2, 0.85);
      const up = env(0, 0.35, 0.42) * (k < 0.48 ? 1 : 0);
      const cut = env(0.4, 0.55, 0.7);
      p.near = blendArm(blendArm(p.near, [2.7, 0.5], up), [1.0, 0.05], cut);
      p.lean = cut * 0.4;
      break;
    }
    case 'club': {
      const up = env(0, 0.45, 0.55) * (k < 0.6 ? 1 : 0);
      const swing = env(0.52, 0.66, 0.8);
      p.near = blendArm(blendArm(p.near, [2.9, 0.2], up), [1.2, 0.1], swing);
      p.far = blendArm(blendArm(p.far, [2.8, 0.25], up), [1.1, 0.15], swing);
      p.lean = swing * 0.5 - up * 0.2;
      break;
    }
    case 'raise':
      p.near = blendArm(p.near, [3.0, 0.1], env(0, 0.2, 0.8));
      p.far = [0.2, 0.4];
      p.lean = 0;
      break;
    case 'check':
      p.lights = 1 + 0.8 * Math.abs(Math.sin(t * 8)) * env(0, 0.1, 0.8);
      p.near = blendArm(p.near, [0.6, 1.4], env(0, 0.3, 0.7));
      break;
  }
  return p;
}

/** Where a mech's near hand is (for a ship held as a club), in its unit space before scaling. */
export function handOf(p: Pose, build: Mech['build']): [number, number] {
  void build;
  const a1 = p.near[0];
  const a2 = p.near[0] + p.near[1];
  const ex = -0.19 + Math.sin(a1) * 0.2;
  const ey = -0.79 + Math.cos(a1) * 0.2;
  return [ex + Math.sin(a2) * 0.25, ey + Math.cos(a2) * 0.25];
}
