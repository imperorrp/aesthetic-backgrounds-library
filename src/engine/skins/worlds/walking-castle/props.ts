/**
 * What stands on the land, drawn once into the planes: trees (round clumps, poplars, pines,
 * autumn ones), cottages and farms, the steep-roofed houses of the towns, churches and windmills,
 * tors and boulders, haystacks, walls and fences, a lighthouse, grass and flowers. All in noon
 * colours (the planes are coloured by the hour afterwards), lit from `lx` (+1 the light from the right).
 */
import { hash } from './land';
import { mix, rgba } from './sky';

type G = CanvasRenderingContext2D;
export type Ink = { lights: [number, number, number][]; mills: [number, number, number][]; smokes: [number, number][] };

const R = (seed: number, k: number) => hash(seed, k, 901);

export function treeClump(g: G, x: number, y: number, s: number, lx: number, seed: number, leaf: [string, string, string], opts: { shadow?: boolean; trunk?: string; tall?: number } = {}) {
  const tall = opts.tall ?? 1;
  const [dark, mid, lit] = leaf;
  if (opts.shadow !== false) {
    g.fillStyle = 'rgba(30,50,30,0.28)';
    g.beginPath();
    g.ellipse(x - lx * s * 0.5, y + s * 0.03, s * 0.75, s * 0.12, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = opts.trunk ?? '#4a3a2c';
  g.beginPath();
  g.moveTo(x - s * 0.06, y);
  g.lineTo(x - s * 0.035, y - s * 0.45 * tall);
  g.lineTo(x + s * 0.035, y - s * 0.45 * tall);
  g.lineTo(x + s * 0.06, y);
  g.fill();
  const n = 7 + Math.floor(R(seed, 1) * 4);
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI - Math.PI;
    const rr = s * (0.26 + R(seed, i + 2) * 0.14);
    blobs.push([x + Math.cos(a) * s * 0.36 + (R(seed, i + 20) - 0.5) * s * 0.12, y - s * 0.55 * tall + Math.sin(a) * s * 0.3 * tall - R(seed, i + 40) * s * 0.06, rr]);
  }
  blobs.push([x, y - s * 0.72 * tall, s * 0.34]);
  g.fillStyle = dark;
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx, by + br * 0.1, br, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = mid;
  for (const [bx, by, br] of blobs) {
    g.beginPath();
    g.arc(bx + lx * br * 0.16, by - br * 0.1, br * 0.82, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = lit;
  for (const [i, [bx, by, br]] of blobs.entries()) {
    if ((bx - x) * lx < -s * 0.15 && i % 2) continue;
    g.beginPath();
    g.arc(bx + lx * br * 0.32, by - br * 0.32, br * 0.46, 0, Math.PI * 2);
    g.fill();
  }
  // Dabs of light and holes of shade, like a brush.
  if (s > 10) {
    for (let k = 0; k < 10; k++) {
      const b = blobs[Math.floor(R(seed, 60 + k) * blobs.length)];
      const a = R(seed, 80 + k) * Math.PI * 2;
      g.fillStyle = k % 3 === 0 ? dark : mix(lit, '#fff8d0', 0.25);
      g.beginPath();
      g.arc(b[0] + Math.cos(a) * b[2] * 0.6, b[1] + Math.sin(a) * b[2] * 0.6, Math.max(0.6, b[2] * 0.16), 0, Math.PI * 2);
      g.fill();
    }
  }
}

export function poplar(g: G, x: number, y: number, s: number, lx: number, seed: number, leaf: [string, string, string]) {
  const [dark, mid, lit] = leaf;
  g.fillStyle = 'rgba(30,50,30,0.25)';
  g.beginPath();
  g.ellipse(x - lx * s * 0.3, y, s * 0.3, s * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  const w = s * 0.17;
  for (const [col, off, k] of [[dark, 0, 1], [mid, lx * w * 0.2, 0.85], [lit, lx * w * 0.45, 0.45]] as const) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x + off * 0.5, y - s * 1.05);
    g.bezierCurveTo(x + off + w * k * 1.2, y - s * 0.8, x + off + w * k, y - s * 0.12, x + off * 0.4, y - s * 0.06);
    g.bezierCurveTo(x + off - w * k, y - s * 0.12, x + off - w * k * 1.1, y - s * 0.8, x + off * 0.5, y - s * 1.05);
    g.fill();
  }
  void seed;
}

export function pine(g: G, x: number, y: number, s: number, lx: number, seed: number, leaf: [string, string, string]) {
  const [dark, mid, lit] = leaf;
  g.fillStyle = '#3a2e26';
  g.fillRect(x - s * 0.03, y - s * 0.2, s * 0.06, s * 0.2);
  const tiers = 4 + Math.floor(R(seed, 1) * 3);
  for (let i = 0; i < tiers; i++) {
    const q = i / tiers;
    const ty = y - s * 0.14 - q * s * 0.8;
    const w = s * (0.34 - q * 0.26) * (0.9 + R(seed, i + 3) * 0.25);
    const h = s * 0.32;
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(x - w, ty);
    g.lineTo(x, ty - h);
    g.lineTo(x + w, ty);
    g.quadraticCurveTo(x, ty + h * 0.12, x - w, ty);
    g.fill();
    g.fillStyle = mid;
    g.beginPath();
    g.moveTo(x, ty - h);
    g.lineTo(x + lx * w, ty);
    g.quadraticCurveTo(x + lx * w * 0.5, ty + h * 0.06, x, ty);
    g.fill();
    if (s > 14) {
      g.strokeStyle = lit;
      g.lineWidth = Math.max(0.5, s * 0.02);
      g.beginPath();
      g.moveTo(x + lx * w * 0.15, ty - h * 0.8);
      g.lineTo(x + lx * w * 0.85, ty - h * 0.08);
      g.stroke();
    }
  }
}

export type HouseStyle = { wall: string; roof: string; tall: number; steep: number; timber?: boolean };
export function house(g: G, x: number, y: number, w: number, lx: number, seed: number, st: HouseStyle, ink: Ink | null) {
  const h = w * 0.62 * st.tall;
  const roofH = w * 0.5 * st.steep;
  const side = w * 0.42;
  // The gable end faces us; the side wall in shade or light.
  const sx = lx > 0 ? x - side : x + w;
  const wallSide = mix(st.wall, '#3a3a48', lx > 0 ? 0.35 : 0.1);
  const wallFront = mix(st.wall, '#3a3a48', lx > 0 ? 0.05 : 0.3);
  g.fillStyle = 'rgba(30,40,30,0.3)';
  g.fillRect(x - side * 0.6 * lx - w * 0.1, y - 1, w * 1.5, Math.max(1, w * 0.08));
  g.fillStyle = wallSide;
  g.fillRect(lx > 0 ? x - side : x + w, y - h, side, h);
  g.fillStyle = wallFront;
  g.fillRect(x, y - h, w, h);
  if (st.timber && w > 9) {
    g.strokeStyle = 'rgba(60,40,30,0.75)';
    g.lineWidth = Math.max(0.5, w * 0.05);
    g.strokeRect(x + 0.3, y - h + 0.3, w - 0.6, h - 0.6);
    g.beginPath();
    g.moveTo(x, y - h * 0.5);
    g.lineTo(x + w, y - h * 0.5);
    g.moveTo(x, y);
    g.lineTo(x + w * 0.5, y - h * 0.5);
    g.lineTo(x + w, y);
    g.stroke();
  }
  // The roof: the side slope (long, lit or not) and the gable.
  const roofLit = mix(st.roof, '#fff0d8', 0.18);
  const roofDark = mix(st.roof, '#202030', 0.3);
  g.fillStyle = lx > 0 ? roofDark : roofLit;
  g.beginPath();
  g.moveTo(x + w / 2, y - h - roofH);
  g.lineTo(sx + (lx > 0 ? 0 : side) + (lx > 0 ? -w * 0.06 : w * 0.06), y - h + w * 0.04);
  g.lineTo(lx > 0 ? x : x + w, y - h + w * 0.04);
  g.closePath();
  g.fill();
  g.fillStyle = lx > 0 ? mix(st.roof, '#fff0d8', 0.05) : roofDark;
  g.beginPath();
  g.moveTo(x - w * 0.08, y - h + w * 0.04);
  g.lineTo(x + w / 2, y - h - roofH);
  g.lineTo(x + w * 1.08, y - h + w * 0.04);
  g.closePath();
  g.fill();
  if (lx > 0) {
    g.fillStyle = roofLit;
    g.beginPath();
    g.moveTo(x + w / 2, y - h - roofH);
    g.lineTo(x + w * 1.08, y - h + w * 0.04);
    g.lineTo(x + w * 0.8, y - h + w * 0.04);
    g.closePath();
    g.fill();
  }
  // A chimney, windows, a door.
  const cx = x + w * (0.2 + R(seed, 3) * 0.55);
  g.fillStyle = mix(st.wall, '#6a4a3a', 0.5);
  g.fillRect(cx - w * 0.06, y - h - roofH * 0.9, w * 0.12, roofH * 0.55);
  if (ink && R(seed, 4) < 0.6) ink.smokes.push([cx, y - h - roofH * 0.9]);
  if (w > 5) {
    const ww = Math.max(0.8, w * 0.14);
    const rows = st.tall > 1.3 ? 2 : 1;
    for (let r = 0; r < rows; r++)
      for (const q of [0.22, 0.64]) {
        const wx = x + w * q;
        const wy = y - h * (0.72 - r * 0.38);
        g.fillStyle = '#3a3440';
        g.fillRect(wx, wy, ww, ww * 1.2);
        if (ink && R(seed, 10 + r * 3 + q * 10) < 0.7) ink.lights.push([wx + ww / 2, wy + ww * 0.6, ww * 2.6]);
      }
    g.fillStyle = '#5a3a2a';
    g.fillRect(x + w * 0.44, y - h * 0.34, w * 0.14, h * 0.34);
  }
}

export function church(g: G, x: number, y: number, w: number, lx: number, seed: number, ink: Ink | null) {
  house(g, x, y, w, lx, seed, { wall: '#d8d0bc', roof: '#5a5a66', tall: 0.9, steep: 0.9 }, null);
  const tw = w * 0.42;
  const tx = x - tw * 0.2;
  const th = w * 1.25;
  g.fillStyle = mix('#cec6b0', '#3a3a48', lx > 0 ? 0.05 : 0.3);
  g.fillRect(tx, y - th, tw, th);
  g.fillStyle = mix('#cec6b0', '#3a3a48', lx > 0 ? 0.35 : 0.05);
  g.fillRect(lx > 0 ? tx : tx + tw * 0.6, y - th, tw * 0.4, th);
  g.fillStyle = '#4e5260';
  g.beginPath();
  g.moveTo(tx - tw * 0.08, y - th);
  g.lineTo(tx + tw / 2, y - th - w * 1.1);
  g.lineTo(tx + tw * 1.08, y - th);
  g.fill();
  g.fillStyle = '#7a8090';
  g.beginPath();
  g.moveTo(tx + tw / 2, y - th - w * 1.1);
  g.lineTo(tx + tw * (lx > 0 ? 1.08 : -0.08), y - th);
  g.lineTo(tx + tw / 2, y - th);
  g.fill();
  if (ink) ink.lights.push([tx + tw / 2, y - th * 0.7, tw * 1.6]);
}

export function windmill(g: G, x: number, y: number, s: number, lx: number, ink: Ink | null) {
  const h = s;
  const bw = s * 0.34;
  g.fillStyle = 'rgba(30,40,30,0.3)';
  g.beginPath();
  g.ellipse(x - lx * s * 0.3, y, s * 0.4, s * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e2d8c2';
  g.beginPath();
  g.moveTo(x - bw / 2, y);
  g.lineTo(x - bw * 0.32, y - h);
  g.lineTo(x + bw * 0.32, y - h);
  g.lineTo(x + bw / 2, y);
  g.fill();
  g.fillStyle = 'rgba(60,50,60,0.35)';
  g.beginPath();
  g.moveTo(x - lx * bw / 2, y);
  g.lineTo(x - lx * bw * 0.32, y - h);
  g.lineTo(x - lx * bw * 0.05, y - h);
  g.lineTo(x - lx * bw * 0.08, y);
  g.fill();
  g.fillStyle = '#6a4a3a';
  g.beginPath();
  g.ellipse(x, y - h, bw * 0.42, bw * 0.3, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#3a3440';
  g.fillRect(x - bw * 0.07, y - h * 0.4, bw * 0.14, bw * 0.2);
  if (ink) {
    ink.mills.push([x, y - h + bw * 0.05, s * 0.75]);
    ink.lights.push([x, y - h * 0.32, bw * 0.6]);
  }
}

export function tor(g: G, x: number, y: number, s: number, lx: number, seed: number) {
  const n = 3 + Math.floor(R(seed, 1) * 4);
  for (let i = 0; i < n; i++) {
    const bw = s * (0.35 + R(seed, i + 2) * 0.35);
    const bh = s * (0.22 + R(seed, i + 9) * 0.2);
    const bx = x + (i - n / 2) * s * 0.28 + (R(seed, i + 15) - 0.5) * s * 0.15;
    const by = y - (i % 3) * bh * 0.7 * (R(seed, i + 30) < 0.6 ? 1 : 0);
    const r = Math.min(bw, bh) * 0.35;
    g.fillStyle = '#7a766c';
    g.beginPath();
    g.roundRect(bx - bw / 2, by - bh, bw, bh, r);
    g.fill();
    g.fillStyle = '#a8a294';
    g.beginPath();
    g.roundRect(bx - bw / 2 + (lx > 0 ? bw * 0.3 : 0), by - bh, bw * 0.7, bh * 0.4, r);
    g.fill();
    g.fillStyle = 'rgba(40,40,40,0.35)';
    g.fillRect(bx - bw / 2 + (lx > 0 ? 0 : bw * 0.7), by - bh * 0.6, bw * 0.3, bh * 0.6);
  }
}

export function boulder(g: G, x: number, y: number, s: number, lx: number, seed: number, col = '#8e897e') {
  g.fillStyle = 'rgba(30,40,30,0.3)';
  g.beginPath();
  g.ellipse(x - lx * s * 0.3, y, s * 0.7, s * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  const pts: [number, number][] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const r = s * (0.45 + R(seed, i) * 0.18);
    pts.push([x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 0.9]);
  }
  g.fillStyle = mix(col, '#2a2a30', 0.35);
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  g.fill();
  g.fillStyle = col;
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px + lx * s * 0.08, py + s * 0.04) : g.moveTo(px + lx * s * 0.08, py)));
  g.lineTo(x + lx * s * 0.3, y - s * 0.1);
  g.closePath();
  g.fill();
  g.fillStyle = mix(col, '#fff4e0', 0.35);
  g.beginPath();
  g.ellipse(x + lx * s * 0.2, y - s * 0.36, s * 0.3, s * 0.12, lx * 0.2, 0, Math.PI * 2);
  g.fill();
  // Moss and lichen.
  g.fillStyle = 'rgba(110,140,60,0.5)';
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.arc(x + (R(seed, 20 + k) - 0.5) * s, y - s * 0.1 - R(seed, 30 + k) * s * 0.3, s * 0.08, 0, Math.PI * 2);
    g.fill();
  }
}

export function haystack(g: G, x: number, y: number, s: number, lx: number) {
  g.fillStyle = 'rgba(30,40,30,0.3)';
  g.beginPath();
  g.ellipse(x - lx * s * 0.4, y, s * 0.6, s * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b89a48';
  g.beginPath();
  g.ellipse(x, y - s * 0.05, s * 0.42, s * 0.5, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#e0c870';
  g.beginPath();
  g.ellipse(x + lx * s * 0.12, y - s * 0.12, s * 0.26, s * 0.38, 0, Math.PI, 0);
  g.fill();
}

export function lighthouse(g: G, x: number, y: number, s: number, lx: number, ink: Ink | null) {
  const w0 = s * 0.2;
  const w1 = s * 0.13;
  const h = s;
  g.fillStyle = '#ece6da';
  g.beginPath();
  g.moveTo(x - w0, y);
  g.lineTo(x - w1, y - h);
  g.lineTo(x + w1, y - h);
  g.lineTo(x + w0, y);
  g.fill();
  g.fillStyle = '#c0443a';
  for (const q of [0.2, 0.5, 0.8]) {
    const yy = y - h * q;
    const ww = w0 + (w1 - w0) * q;
    g.fillRect(x - ww, yy - h * 0.07, ww * 2, h * 0.12);
  }
  g.fillStyle = 'rgba(40,40,60,0.3)';
  g.beginPath();
  g.moveTo(x - lx * w0, y);
  g.lineTo(x - lx * w1, y - h);
  g.lineTo(x - lx * w1 * 0.2, y - h);
  g.lineTo(x - lx * w0 * 0.2, y);
  g.fill();
  g.fillStyle = '#3a3a44';
  g.fillRect(x - w1 * 1.1, y - h - s * 0.14, w1 * 2.2, s * 0.14);
  g.fillStyle = '#c0443a';
  g.beginPath();
  g.moveTo(x - w1 * 1.2, y - h - s * 0.14);
  g.lineTo(x, y - h - s * 0.24);
  g.lineTo(x + w1 * 1.2, y - h - s * 0.14);
  g.fill();
  if (ink) ink.lights.push([x, y - h - s * 0.07, s * 0.9]);
}

/** A dry-stone wall along a line, stones and a lit top. */
export function wall(g: G, pts: [number, number][], h: number, lx: number) {
  if (pts.length < 2) return;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#6e6a62';
  g.lineWidth = h;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y - h / 2) : g.moveTo(x, y - h / 2)));
  g.stroke();
  g.strokeStyle = '#a8a294';
  g.lineWidth = h * 0.35;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y - h * 0.85) : g.moveTo(x, y - h * 0.85)));
  g.stroke();
  if (h > 3) {
    g.fillStyle = 'rgba(40,36,34,0.5)';
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const n = Math.max(1, Math.floor(Math.hypot(bx - ax, by - ay) / (h * 0.9)));
      for (let k = 0; k < n; k++) {
        const q = (k + 0.5) / n;
        g.fillRect(ax + (bx - ax) * q, ay + (by - ay) * q - h * (0.25 + (k % 2) * 0.3), Math.max(0.5, h * 0.12), Math.max(0.5, h * 0.12));
      }
    }
  }
  void lx;
}

export function fence(g: G, pts: [number, number][], h: number) {
  g.strokeStyle = '#6a5040';
  g.lineWidth = Math.max(0.7, h * 0.1);
  g.beginPath();
  for (const [x, y] of pts) {
    g.moveTo(x, y);
    g.lineTo(x, y - h);
  }
  for (const k of [0.45, 0.85]) {
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y - h * k) : g.moveTo(x, y - h * k)));
  }
  g.stroke();
}

/** A tuft of grass: blades from one root, the near ones lit. */
export function tuft(g: G, x: number, y: number, s: number, lx: number, seed: number, cols: [string, string, string], lean = 0) {
  const n = 7 + Math.floor(R(seed, 1) * 8);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (R(seed, i + 2) - 0.5) * 1.1 + lean;
    const len = s * (0.5 + R(seed, i + 30) * 0.6);
    const ex = x + Math.sin(a) * len;
    const ey = y - Math.cos(a) * len;
    const col = i % 3 === 0 ? cols[0] : (ex - x) * lx > 0 ? cols[2] : cols[1];
    g.strokeStyle = col;
    g.lineWidth = Math.max(0.6, s * 0.06 * (1 - i / n * 0.4));
    g.beginPath();
    g.moveTo(x + (R(seed, i + 60) - 0.5) * s * 0.2, y);
    g.quadraticCurveTo(x + Math.sin(a) * len * 0.3, y - Math.cos(a) * len * 0.6, ex, ey);
    g.stroke();
  }
}

export function flowers(g: G, x: number, y: number, w: number, h: number, s: number, seed: number, cols: string[], n: number) {
  for (let i = 0; i < n; i++) {
    const fx = x + (R(seed, i) - 0.5) * w;
    const fy = y + (R(seed, i + 500) - 0.5) * h;
    const c = cols[Math.floor(R(seed, i + 900) * cols.length)];
    const r = s * (0.6 + R(seed, i + 1300) * 0.6);
    g.fillStyle = mix(c, '#202020', 0.35);
    g.beginPath();
    g.arc(fx, fy + r * 0.3, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c;
    g.beginPath();
    g.arc(fx, fy, r, 0, Math.PI * 2);
    g.fill();
    if (r > 1.6) {
      g.fillStyle = rgba('#fff8c0', 0.9);
      g.beginPath();
      g.arc(fx, fy, r * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  }
}
