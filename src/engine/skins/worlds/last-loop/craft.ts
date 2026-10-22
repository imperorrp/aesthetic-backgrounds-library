/**
 * The handmade things of Last Loop, drawn in world units on a context already set to the world:
 * the sun (granulated, limb-darkened, with its prominences and flares, then collapsing), the wooden
 * ship and its flame, the probe cannon, the comet's two tails, the ocean giant's tornadoes, the thorn
 * planet's spikes, a campfire, a little house, music notes. All of it is shaded from where the sun is.
 */
import { hash } from '../../instruments/kit';

export type RGB = [number, number, number];
const TAU = Math.PI * 2;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const rgbA = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
export const mixRGB = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const toRGB = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** A granulation texture for the sun: bright cells and dark lanes, white so it multiplies in. */
export function makeGranules(rnd: () => number, size = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const pts = Array.from({ length: 420 }, () => [rnd() * size, rnd() * size]);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let d1 = 1e9;
      let d2 = 1e9;
      for (const [px, py] of pts) {
        let dx = Math.abs(i - px);
        let dy = Math.abs(j - py);
        if (dx > size / 2) dx = size - dx;
        if (dy > size / 2) dy = size - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
      const lane = clamp01((Math.sqrt(d2) - Math.sqrt(d1)) / 3);
      const v = 175 + 80 * Math.sqrt(lane) - 20 * clamp01(Math.sqrt(d1) / 12);
      const o = (j * size + i) * 4;
      img.data[o] = v;
      img.data[o + 1] = v * 0.94;
      img.data[o + 2] = v * 0.86;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export type SunLook = { r: number; age: number; color: RGB; flare: number; flareAng: number; collapse: number; spin: number };

/** The sun, at (x, y). */
export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, s: SunLook, t: number, gran: HTMLCanvasElement | null, px: number) {
  const { r, age, color } = s;
  if (r <= 0.2) return;
  const blue = s.collapse;
  const white: RGB = [255, 250, 236];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // The light around it: a wide soft halo and a tighter corona.
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * (5.5 - age * 1.5));
  halo.addColorStop(0, rgbA(color, 0.28 - age * 0.06));
  halo.addColorStop(0.25, rgbA(color, 0.09));
  halo.addColorStop(1, rgbA(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * (5.5 - age * 1.5), 0, TAU);
  ctx.fill();
  const cor = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.6);
  cor.addColorStop(0, rgbA(mixRGB(color, white, 0.4), 0.5));
  cor.addColorStop(1, rgbA(color, 0));
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.6, 0, TAU);
  ctx.fill();
  // Streamers in the corona: slow, long, faint.
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 3) * TAU + t * 0.004 * (i % 2 ? 1 : -1);
    const len = r * (1.5 + hash(i, 4) * 1.4 + 0.2 * Math.sin(t * 0.3 + i));
    const g = ctx.createLinearGradient(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.addColorStop(0, rgbA(color, 0.16 * (1 - blue)));
    g.addColorStop(1, rgbA(color, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = r * (0.18 + hash(i, 5) * 0.2);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.12) * len * 0.7, y + Math.sin(a + 0.12) * len * 0.7, x + Math.cos(a + 0.05) * len, y + Math.sin(a + 0.05) * len);
    ctx.stroke();
  }
  ctx.restore();

  // The disk: limb-darkened, the colour of its age.
  const core = mixRGB(color, white, 0.62 - age * 0.38 + blue * 0.3);
  const limb = mixRGB(color, [color[0] * 0.55, color[1] * 0.35, color[2] * 0.25], 0.55 - blue * 0.5);
  const dg = ctx.createRadialGradient(x - r * 0.12, y - r * 0.14, 0, x, y, r);
  dg.addColorStop(0, rgbA(core, 1));
  dg.addColorStop(0.55, rgbA(mixRGB(core, color, 0.7), 1));
  dg.addColorStop(0.9, rgbA(mixRGB(color, limb, 0.6), 1));
  dg.addColorStop(1, rgbA(limb, 1));
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  // The surface churning: soft bright and dark mottles drifting across the disk, bigger and slower
  // in the old red giant (painted, not cells: a glowing ball, not a biscuit).
  if (r > 6 * px && blue < 0.5) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.clip();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = hash(i, 9) * TAU + s.spin * (1 + hash(i, 12)) + Math.sin(t * 0.05 + i) * 0.3;
      const d = Math.sqrt(hash(i, 10)) * r * 0.8;
      const mx = x + Math.cos(a) * d;
      const my = y + Math.sin(a) * d * 0.85;
      const mr = r * (0.25 + hash(i, 11) * 0.3) * (1 + age * 0.5);
      const dark = i % 3 === 0;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      const c: RGB = dark ? [color[0] * 0.7, color[1] * 0.5, color[2] * 0.4] : mixRGB(color, white, 0.45);
      g.addColorStop(0, rgbA(c, dark ? 0.22 + age * 0.15 : 0.22));
      g.addColorStop(1, rgbA(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    ctx.restore();
  }
  void gran;
  // Prominences: arcs of fire standing on the limb.
  ctx.save();
  ctx.lineCap = 'round';
  const promCol = mixRGB(color, [230, 80, 40], 0.35);
  for (let i = 0; i < 5; i++) {
    const a = hash(i, 21) * TAU + t * 0.01;
    const w = 0.12 + hash(i, 22) * 0.15;
    const hgt = r * (0.18 + hash(i, 23) * 0.22) * (0.75 + 0.25 * Math.sin(t * 0.4 + i * 2));
    arc(ctx, x, y, r, a, w, hgt, rgbA(promCol, 0.42 * (1 - blue)), Math.max(px, r * 0.03));
  }
  if (s.flare > 0) {
    const f = s.flare;
    const grow = 1 - f;
    arc(ctx, x, y, r, s.flareAng, 0.22, r * (0.35 + grow * 1.1), rgbA(mixRGB(promCol, white, 0.4), f * 0.9), Math.max(px * 1.4, r * 0.06 * f));
    arc(ctx, x, y, r, s.flareAng + 0.05, 0.14, r * (0.25 + grow * 0.8), rgbA(white, f * 0.6), Math.max(px, r * 0.03 * f));
  }
  ctx.restore();
}
function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, w: number, h: number, style: string, lw: number) {
  const x0 = x + Math.cos(a - w) * r * 0.98;
  const y0 = y + Math.sin(a - w) * r * 0.98;
  const x1 = x + Math.cos(a + w) * r * 0.98;
  const y1 = y + Math.sin(a + w) * r * 0.98;
  const mx = x + Math.cos(a) * (r + h * 1.6);
  const my = y + Math.sin(a) * (r + h * 1.6);
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, x1, y1);
  ctx.stroke();
}

/**
 * The ship: a wooden rocket with a red nose, a round window, fins and legs, lit from the sun's side,
 * its thruster flame flickering. Nose along `ang`; `len` in world units.
 */
export function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, thrust: number, sunAng: number, t: number, legs: boolean, night: number, px: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const L = len;
  const Wd = L * 0.34;
  // The flame first, behind.
  if (thrust > 0.02) {
    const fl = L * (0.45 + 0.35 * thrust) * (0.85 + 0.15 * Math.sin(t * 47) + 0.08 * Math.sin(t * 91));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(-L * 0.55, 0, 0, -L * 0.55, 0, fl * 1.3);
    gl.addColorStop(0, `rgba(255,190,110,${(0.55 * thrust).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(-L * 0.55, 0, fl * 1.3, 0, TAU);
    ctx.fill();
    const fg = ctx.createLinearGradient(-L * 0.5, 0, -L * 0.5 - fl, 0);
    fg.addColorStop(0, 'rgba(255,250,220,0.95)');
    fg.addColorStop(0.35, 'rgba(255,190,90,0.85)');
    fg.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-L * 0.46, -Wd * 0.32);
    ctx.quadraticCurveTo(-L * 0.5 - fl * 0.5, -Wd * 0.25, -L * 0.5 - fl, 0);
    ctx.quadraticCurveTo(-L * 0.5 - fl * 0.5, Wd * 0.25, -L * 0.46, Wd * 0.32);
    ctx.fill();
    ctx.restore();
  }
  // Light from the sun's side, across the hull.
  const la = sunAng - ang;
  const lx = Math.cos(la);
  const ly = Math.sin(la);
  const hull = ctx.createLinearGradient(-lx * Wd, -ly * Wd, lx * Wd, ly * Wd);
  hull.addColorStop(0, '#3a2414');
  hull.addColorStop(0.55, '#8a5a32');
  hull.addColorStop(1, '#d8a46a');
  // Fins.
  ctx.fillStyle = '#b8502c';
  ctx.beginPath();
  ctx.moveTo(-L * 0.42, -Wd * 0.4);
  ctx.lineTo(-L * 0.56, -Wd * 0.95);
  ctx.lineTo(-L * 0.2, -Wd * 0.45);
  ctx.closePath();
  ctx.moveTo(-L * 0.42, Wd * 0.4);
  ctx.lineTo(-L * 0.56, Wd * 0.95);
  ctx.lineTo(-L * 0.2, Wd * 0.45);
  ctx.closePath();
  ctx.fill();
  if (legs) {
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = Math.max(px * 0.8, L * 0.035);
    ctx.beginPath();
    ctx.moveTo(-L * 0.3, -Wd * 0.4);
    ctx.lineTo(-L * 0.62, -Wd * 0.9);
    ctx.moveTo(-L * 0.3, Wd * 0.4);
    ctx.lineTo(-L * 0.62, Wd * 0.9);
    ctx.stroke();
  }
  // The hull: planks.
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-L * 0.48, -Wd * 0.42);
  ctx.lineTo(L * 0.22, -Wd * 0.5);
  ctx.quadraticCurveTo(L * 0.3, 0, L * 0.22, Wd * 0.5);
  ctx.lineTo(-L * 0.48, Wd * 0.42);
  ctx.quadraticCurveTo(-L * 0.54, 0, -L * 0.48, -Wd * 0.42);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,22,10,0.55)';
  ctx.lineWidth = Math.max(px * 0.5, L * 0.018);
  ctx.beginPath();
  for (const k of [-0.2, 0.15]) {
    ctx.moveTo(-L * 0.46, Wd * k);
    ctx.lineTo(L * 0.2, Wd * k * 1.1);
  }
  ctx.moveTo(-L * 0.1, -Wd * 0.48);
  ctx.lineTo(-L * 0.1, Wd * 0.48);
  ctx.stroke();
  // The nose cone.
  const nose = ctx.createLinearGradient(-lx * Wd, -ly * Wd, lx * Wd, ly * Wd);
  nose.addColorStop(0, '#5a1a10');
  nose.addColorStop(0.6, '#c4482a');
  nose.addColorStop(1, '#f08a5a');
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.moveTo(L * 0.2, -Wd * 0.5);
  ctx.quadraticCurveTo(L * 0.48, -Wd * 0.3, L * 0.6, 0);
  ctx.quadraticCurveTo(L * 0.48, Wd * 0.3, L * 0.2, Wd * 0.5);
  ctx.quadraticCurveTo(L * 0.28, 0, L * 0.2, -Wd * 0.5);
  ctx.fill();
  // The window: a brass ring and the cockpit's lamp.
  ctx.fillStyle = '#d8b060';
  ctx.beginPath();
  ctx.arc(L * 0.05, 0, Wd * 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = night > 0.4 ? '#ffe2a0' : '#9fd8f0';
  ctx.beginPath();
  ctx.arc(L * 0.05, 0, Wd * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** The probe cannon: a ring station with a long barrel turned to `aim`, panels, and a blinking lamp. */
export function drawStation(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, aim: number, sinE: number, sunAng: number, t: number, recoil: number, px: number) {
  const lx = Math.cos(sunAng);
  const ly = Math.sin(sunAng);
  ctx.save();
  ctx.translate(x, y);
  // Panels.
  ctx.fillStyle = '#2a3f6a';
  ctx.strokeStyle = '#8aa0c8';
  ctx.lineWidth = Math.max(px * 0.5, s * 0.04);
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.rect(sgn > 0 ? s * 1.05 : -s * 2.05, -s * 0.28, s, s * 0.56);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#9aa0a8';
  ctx.beginPath();
  ctx.moveTo(-s * 1.05, 0);
  ctx.lineTo(s * 1.05, 0);
  ctx.stroke();
  // The ring.
  ctx.lineWidth = Math.max(px, s * 0.22);
  const rg = ctx.createLinearGradient(-lx * s, -ly * s, lx * s, ly * s);
  rg.addColorStop(0, '#3a3e48');
  rg.addColorStop(1, '#d8dce4');
  ctx.strokeStyle = rg;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * Math.max(0.35, sinE), 0, 0, TAU);
  ctx.stroke();
  // The barrel, recoiling when it fires.
  ctx.rotate(aim);
  const back = recoil * s * 0.4;
  const bg = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
  bg.addColorStop(0, '#d0d4dc');
  bg.addColorStop(0.5, '#7a808c');
  bg.addColorStop(1, '#30343c');
  ctx.fillStyle = bg;
  ctx.fillRect(-s * 0.4 - back, -s * 0.22, s * 2.3, s * 0.44);
  ctx.fillStyle = '#c8a050';
  ctx.fillRect(s * 1.75 - back, -s * 0.28, s * 0.2, s * 0.56);
  ctx.fillRect(s * 0.6 - back, -s * 0.26, s * 0.12, s * 0.52);
  ctx.rotate(-aim);
  // The hub.
  const hg = ctx.createRadialGradient(-lx * s * 0.2, -ly * s * 0.2, 0, 0, 0, s * 0.45);
  hg.addColorStop(0, '#e8ecf2');
  hg.addColorStop(1, '#4a505c');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.45, 0, TAU);
  ctx.fill();
  if (Math.sin(t * 3) > 0.6) {
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(0, -s * 0.5, Math.max(px, s * 0.1), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The comet: an icy nucleus in its coma, a straight blue ion tail and a curved pale dust tail, both away from the sun. */
export function drawComet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, away: number, len: number, bend: number, t: number, px: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ax = Math.cos(away);
  const ay = Math.sin(away);
  const nx = -ay;
  const ny = ax;
  // Dust tail: wide and curved, trailing the orbit.
  const steps = 14;
  const dust: [number, number][] = [];
  const dust2: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const q = i / steps;
    const d = len * 0.8 * q;
    const off = bend * len * 0.25 * q * q;
    const w = r * (1.2 + q * 6);
    dust.push([x + ax * d + nx * (off + w), y + ay * d + ny * (off + w)]);
    dust2.push([x + ax * d + nx * (off - w), y + ay * d + ny * (off - w)]);
  }
  const dg = ctx.createLinearGradient(x, y, x + ax * len * 0.8, y + ay * len * 0.8);
  dg.addColorStop(0, 'rgba(255,240,215,0.42)');
  dg.addColorStop(1, 'rgba(255,220,180,0)');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(dust[0][0], dust[0][1]);
  for (const p of dust) ctx.lineTo(p[0], p[1]);
  for (let i = dust2.length - 1; i >= 0; i--) ctx.lineTo(dust2[i][0], dust2[i][1]);
  ctx.fill();
  // Ion tail: straight, narrow, blue, with streamers that shimmer.
  const ig = ctx.createLinearGradient(x, y, x + ax * len, y + ay * len);
  ig.addColorStop(0, 'rgba(170,220,255,0.7)');
  ig.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.moveTo(x + nx * r * 0.8, y + ny * r * 0.8);
  ctx.lineTo(x + ax * len + nx * r * 2.4, y + ay * len + ny * r * 2.4);
  ctx.lineTo(x + ax * len - nx * r * 2.4, y + ay * len - ny * r * 2.4);
  ctx.lineTo(x - nx * r * 0.8, y - ny * r * 0.8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,230,255,0.25)';
  ctx.lineWidth = Math.max(px * 0.6, r * 0.25);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * r * 0.9 + Math.sin(t * 1.3 + i * 2) * r * 0.4;
    ctx.moveTo(x + nx * o * 0.3, y + ny * o * 0.3);
    ctx.lineTo(x + ax * len * 0.9 + nx * o, y + ay * len * 0.9 + ny * o);
  }
  ctx.stroke();
  // The coma and the nucleus.
  const cg = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  cg.addColorStop(0, 'rgba(230,248,255,0.85)');
  cg.addColorStop(0.3, 'rgba(170,220,255,0.3)');
  cg.addColorStop(1, 'rgba(140,200,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#eef8ff';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(px, r * 0.8), 0, TAU);
  ctx.fill();
}

/** A tornado standing on the sea at (x, y), along the surface normal (nx, ny): a funnel of turning cloud. */
export function drawTornado(ctx: CanvasRenderingContext2D, x: number, y: number, nx: number, ny: number, h: number, t: number, seed: number, a: number, lit: number, px: number) {
  if (a <= 0.02) return;
  const tx = -ny;
  const ty = nx;
  const steps = 10;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const q = i / steps;
    const wob = Math.sin(q * 5 + t * 2.2 + seed) * h * 0.08 * q;
    const w = h * (0.04 + 0.22 * q * q);
    const cx = x + nx * h * q + tx * wob;
    const cy = y + ny * h * q + ty * wob;
    left.push([cx + tx * w, cy + ty * w]);
    right.push([cx - tx * w, cy - ty * w]);
  }
  const shade = 0.35 + 0.65 * lit;
  ctx.fillStyle = `rgba(${Math.round(150 + 90 * shade)},${Math.round(160 + 85 * shade)},${Math.round(165 + 80 * shade)},${(0.55 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.fill();
  // Bands of turning cloud.
  ctx.strokeStyle = `rgba(250,255,255,${(0.45 * a * shade).toFixed(3)})`;
  ctx.lineWidth = Math.max(px * 0.5, h * 0.025);
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const q = ((k / 5 + t * 0.35 + seed) % 1) * 0.9 + 0.08;
    const i = Math.floor(q * steps);
    const L = left[i];
    const R = right[i];
    ctx.moveTo(L[0], L[1]);
    ctx.quadraticCurveTo((L[0] + R[0]) / 2 + nx * h * 0.05, (L[1] + R[1]) / 2 + ny * h * 0.05, R[0], R[1]);
  }
  ctx.stroke();
  // Spray at the foot.
  ctx.fillStyle = `rgba(220,240,250,${(0.4 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x, y, h * 0.16, h * 0.07, Math.atan2(ty, tx), 0, TAU);
  ctx.fill();
}

/** A campfire on a slope: its glow on the ground, logs, a flickering flame, and a traveller beside it. */
export function drawCampfire(ctx: CanvasRenderingContext2D, x: number, y: number, nx: number, ny: number, s: number, fire: RGB, t: number, seed: number, night: number, a: number, px: number) {
  if (a <= 0.02) return;
  const flick = 0.75 + 0.15 * Math.sin(t * 11 + seed) + 0.1 * Math.sin(t * 23 + seed * 2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gr = s * (5 + 3 * night) * flick;
  const g = ctx.createRadialGradient(x, y, 0, x, y, gr);
  g.addColorStop(0, rgbA(fire, (0.5 + 0.4 * night) * a));
  g.addColorStop(0.3, rgbA(fire, (0.16 + 0.2 * night) * a));
  g.addColorStop(1, rgbA(fire, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, gr, 0, TAU);
  ctx.fill();
  ctx.restore();
  const tx = -ny;
  const ty = nx;
  ctx.globalAlpha = a;
  // Logs.
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = Math.max(px * 0.6, s * 0.35);
  ctx.beginPath();
  ctx.moveTo(x - tx * s, y - ty * s);
  ctx.lineTo(x + tx * s, y + ty * s);
  ctx.stroke();
  // The flame.
  const fh = s * 2.2 * flick;
  ctx.fillStyle = rgbA(mixRGB(fire, [255, 250, 210], 0.5), 0.95);
  ctx.beginPath();
  ctx.moveTo(x - tx * s * 0.6, y - ty * s * 0.6);
  ctx.quadraticCurveTo(x + nx * fh * 0.5 - tx * s * 0.5, y + ny * fh * 0.5 - ty * s * 0.5, x + nx * fh + tx * Math.sin(t * 9 + seed) * s * 0.3, y + ny * fh + ty * Math.sin(t * 9 + seed) * s * 0.3);
  ctx.quadraticCurveTo(x + nx * fh * 0.5 + tx * s * 0.5, y + ny * fh * 0.5 + ty * s * 0.5, x + tx * s * 0.6, y + ty * s * 0.6);
  ctx.fill();
  // A traveller sitting by it: a little figure with a hat.
  const fx = x + tx * s * 2.2;
  const fy = y + ty * s * 2.2;
  ctx.fillStyle = night > 0.5 ? '#2a1c14' : '#5a4434';
  ctx.beginPath();
  ctx.ellipse(fx + nx * s * 0.9, fy + ny * s * 0.9, s * 0.55, s * 0.9, Math.atan2(ny, nx), 0, TAU);
  ctx.fill();
  ctx.fillStyle = night > 0.5 ? '#3a2a1e' : '#8a6a50';
  ctx.beginPath();
  ctx.arc(fx + nx * s * 2, fy + ny * s * 2, s * 0.45, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Sparks going up.
  ctx.fillStyle = rgbA([255, 210, 140], 0.8 * a);
  for (let i = 0; i < 3; i++) {
    const q = (t * 0.6 + hash(seed, i) ) % 1;
    const sx = x + nx * s * (2 + q * 9) + tx * Math.sin(q * 9 + i) * s;
    const sy = y + ny * s * (2 + q * 9) + ty * Math.sin(q * 9 + i) * s;
    ctx.fillRect(sx - px * 0.5, sy - px * 0.5, px, px);
  }
}

/** A music note: a head, a stem, a flag (or two beamed). */
export function drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.16;
  const head = (hx: number, hy: number) => {
    ctx.beginPath();
    ctx.ellipse(hx, hy, s * 0.36, s * 0.26, -0.45, 0, TAU);
    ctx.fill();
  };
  if (kind === 1) {
    head(x - s * 0.45, y + s * 0.15);
    head(x + s * 0.45, y);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.13, y + s * 0.1);
    ctx.lineTo(x - s * 0.13, y - s * 1);
    ctx.moveTo(x + s * 0.77, y - s * 0.05);
    ctx.lineTo(x + s * 0.77, y - s * 1.15);
    ctx.stroke();
    ctx.lineWidth = s * 0.26;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.13, y - s * 1);
    ctx.lineTo(x + s * 0.77, y - s * 1.15);
    ctx.stroke();
    return;
  }
  head(x, y);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.32, y - s * 0.05);
  ctx.lineTo(x + s * 0.32, y - s * 1.1);
  ctx.stroke();
  if (kind === 2) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.32, y - s * 1.1);
    ctx.quadraticCurveTo(x + s * 0.85, y - s * 0.8, x + s * 0.7, y - s * 0.45);
    ctx.stroke();
  }
}

/** A thorny branch growing out of the limb at (x, y) along (nx, ny): a curved spine with thorns. */
export function drawThornBranch(ctx: CanvasRenderingContext2D, x: number, y: number, nx: number, ny: number, len: number, curl: number, color: string, px: number) {
  const tx = -ny;
  const ty = nx;
  const ex = x + nx * len + tx * curl * len;
  const ey = y + ny * len + ty * curl * len;
  const mx = x + nx * len * 0.5 - tx * curl * len * 0.3;
  const my = y + ny * len * 0.5 - ty * curl * len * 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(px * 0.7, len * 0.09);
  ctx.beginPath();
  ctx.moveTo(x - nx * len * 0.1, y - ny * len * 0.1);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();
  ctx.lineWidth = Math.max(px * 0.5, len * 0.04);
  ctx.beginPath();
  for (const q of [0.35, 0.6, 0.82]) {
    const bx = (1 - q) * (1 - q) * x + 2 * (1 - q) * q * mx + q * q * ex;
    const by = (1 - q) * (1 - q) * y + 2 * (1 - q) * q * my + q * q * ey;
    const side = q === 0.6 ? -1 : 1;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + (tx * side * 0.22 + nx * 0.12) * len, by + (ty * side * 0.22 + ny * 0.12) * len);
  }
  ctx.stroke();
}

/** A little house standing on a slope: walls, a pitched roof, a lit window at night. */
export function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, nx: number, ny: number, s: number, wall: string, roof: string, night: number, px: number) {
  const tx = -ny;
  const ty = nx;
  const p = (u: number, v: number): [number, number] => [x + tx * u * s + nx * v * s, y + ty * u * s + ny * v * s];
  ctx.fillStyle = wall;
  ctx.beginPath();
  for (const [u, v] of [[-0.5, 0], [0.5, 0], [0.5, 0.75], [-0.5, 0.75]] as [number, number][]) ctx.lineTo(...p(u, v));
  ctx.fill();
  ctx.fillStyle = roof;
  ctx.beginPath();
  for (const [u, v] of [[-0.65, 0.7], [0.65, 0.7], [0, 1.25]] as [number, number][]) ctx.lineTo(...p(u, v));
  ctx.fill();
  if (night > 0.3) {
    ctx.fillStyle = `rgba(255,214,130,${(0.9 * night).toFixed(3)})`;
    const [wx, wy] = p(0.05, 0.35);
    ctx.fillRect(wx - Math.max(px * 0.5, s * 0.12), wy - Math.max(px * 0.5, s * 0.12), Math.max(px, s * 0.24), Math.max(px, s * 0.24));
  }
}
