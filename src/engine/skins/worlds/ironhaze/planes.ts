/**
 * Ironhaze's planes, built: each plane of the city painted once in values only (a grey picture:
 * 128 is the plane's own colour, lighter is lit stone and iron, darker is shadow and the dark of a
 * window), with its lit windows on a picture of their own, and its rims (the edges toward the
 * light). The painter tints them by the hour and the fog.
 *
 * What is built here: gothic towers, tenements, shanty stacks, art-deco towers, domes, cathedrals,
 * arcologies, observatories, lift towers, skydocks with their berths, factories, refineries,
 * blast furnaces, gasholders, quays; clock towers in six styles (and the Great Spire, the grandest
 * of each); skybridges (covered galleries, trusses, arches), walkways, the viaduct, cables, rock
 * tables; the undercity under a tiered city's deck; and the four places we watch from.
 */
import type { Building, Chunk, Clock, HazeWorld, Layer, UnderPart } from './types';

/** A grey value, for the planes' value pictures (128 is the colour itself). */
export const V = (n: number) => `rgb(${n},${n},${n})`;
const WARM = ['#ffcf8a', '#ffb866', '#ffe2a8', '#ffa24c', '#ffd79a'];

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Tinted = { d: number; fog: number; storm: number };
/** One chunk of one plane, painted: its value picture, its windows, and the things on it that light or move. */
export type Tile = {
  i: number; k: number; x0: number; x1: number; res: number; y0: number; h: number;
  shade: HTMLCanvasElement; win: HTMLCanvasElement; tint: HTMLCanvasElement; rimT: HTMLCanvasElement; at: Tinted;
  /** Foundry mouths and furnaces: x, y, w, h. */
  glows: [number, number, number, number][];
  lamps: [number, number][];
  spots: [number, number][];
  falls: [number, number, number][];
  /** Lift shafts: x, top, bottom. */
  lifts: [number, number, number][];
  flares: [number, number][];
};

const RES = [0.42, 0.52, 0.66, 0.82, 0.95];

export const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

type G = CanvasRenderingContext2D;

export function createTiles(world: HazeWorld) {
  const { GW, GH, u } = world;

  // ---- small parts ----------------------------------------------------------------------------------
  const pinnacle = (g: G, x: number, y: number, w: number, h: number, v: number) => {
    g.fillStyle = V(v);
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x, y - h);
    g.lineTo(x + w / 2, y);
    g.fill();
    g.beginPath();
    g.arc(x, y - h, Math.max(0.4, w * 0.18), 0, Math.PI * 2);
    g.fill();
  };
  const lancet = (g: G, x: number, y: number, w: number, h: number) => {
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + w * 0.6);
    g.lineTo(x + w / 2, y);
    g.lineTo(x + w, y + w * 0.6);
    g.lineTo(x + w, y + h);
    g.closePath();
    g.fill();
  };
  const arched = (g: G, x: number, y: number, w: number, h: number) => {
    g.fillRect(x, y + w / 2, w, h - w / 2);
    g.beginPath();
    g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    g.fill();
  };
  const spireShape = (g: G, cx: number, baseY: number, bw: number, h: number, s: number) => {
    g.fillStyle = V(124);
    g.beginPath();
    g.moveTo(cx - bw / 2, baseY);
    g.lineTo(cx, baseY - h);
    g.lineTo(cx + bw / 2, baseY);
    g.fill();
    g.fillStyle = V(98);
    g.beginPath();
    g.moveTo(cx, baseY - h);
    g.lineTo(cx + bw / 2, baseY);
    g.lineTo(cx + bw * 0.06, baseY);
    g.fill();
    g.fillStyle = V(150);
    for (let k = 1; k < 6; k++) {
      const y = baseY - (h * k) / 6;
      const half = (bw / 2) * (1 - k / 6);
      g.fillRect(cx - half, y, half * 2, Math.max(0.5, 0.7 * s));
    }
    const step = Math.max(2.4 * s, h / 14);
    for (let d = step; d < h - step; d += step) {
      const half = (bw / 2) * (1 - d / h);
      const y = baseY - d;
      for (const sx of [-1, 1]) {
        g.fillStyle = V(sx < 0 ? 140 : 104);
        g.beginPath();
        g.moveTo(cx + sx * half, y);
        g.lineTo(cx + sx * (half + 1.6 * s), y - 1.2 * s);
        g.lineTo(cx + sx * (half - 0.2 * s), y - 2.4 * s);
        g.fill();
      }
    }
    if (h > 30 * s) {
      const ly = baseY - h * 0.28;
      const half = (bw / 2) * 0.72;
      for (const sx of [-0.5, 0.5]) {
        const lx = cx + sx * half;
        pinnacle(g, lx, ly, 3.6 * s, 4 * s, 136);
        g.fillStyle = V(132);
        g.fillRect(lx - 1.8 * s, ly, 3.6 * s, 4 * s);
        g.fillStyle = V(58);
        g.fillRect(lx - 0.7 * s, ly + 0.8 * s, 1.4 * s, 2.6 * s);
      }
    }
    g.fillStyle = V(150);
    g.fillRect(cx - 0.35 * s, baseY - h - 9 * s, Math.max(0.5, 0.7 * s), 9 * s);
    g.fillRect(cx - 2.2 * s, baseY - h - 6.4 * s, 4.4 * s, Math.max(0.5, 0.7 * s));
    g.beginPath();
    g.arc(cx, baseY - h, Math.max(0.5, 1 * s), 0, Math.PI * 2);
    g.fill();
  };
  const onion = (g: G, cx: number, y: number, w: number, h: number, s: number) => {
    g.fillStyle = V(138);
    g.beginPath();
    g.moveTo(cx - w * 0.32, y);
    g.bezierCurveTo(cx - w * 0.66, y - h * 0.42, cx - w * 0.06, y - h * 0.62, cx, y - h);
    g.bezierCurveTo(cx + w * 0.06, y - h * 0.62, cx + w * 0.66, y - h * 0.42, cx + w * 0.32, y);
    g.fill();
    g.fillStyle = V(104);
    g.beginPath();
    g.moveTo(cx, y);
    g.lineTo(cx + w * 0.32, y);
    g.bezierCurveTo(cx + w * 0.66, y - h * 0.42, cx + w * 0.06, y - h * 0.62, cx, y - h);
    g.fill();
    g.strokeStyle = V(156);
    g.lineWidth = Math.max(0.4, 0.6 * s);
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(cx + k * w * 0.1, y);
      g.quadraticCurveTo(cx + k * w * 0.2, y - h * 0.45, cx, y - h);
      g.stroke();
    }
    g.fillStyle = V(160);
    g.fillRect(cx - 0.4 * s, y - h - 10 * s, Math.max(0.5, 0.8 * s), 10 * s);
    g.fillRect(cx - 2.4 * s, y - h - 7 * s, 4.8 * s, Math.max(0.5, 0.7 * s));
  };
  const cornice = (g: G, x: number, y: number, w: number, s: number) => {
    g.fillStyle = V(162);
    g.fillRect(x - s, y, w + 2 * s, Math.max(0.6, 1.3 * s));
    g.fillStyle = V(82);
    g.fillRect(x - s, y + 1.3 * s, w + 2 * s, Math.max(0.5, 0.9 * s));
  };
  const chimneyStack = (g: G, cx: number, top: number, bottom: number, cw: number, s: number, tall: boolean) => {
    const h = bottom - top;
    g.fillStyle = V(116);
    g.beginPath();
    g.moveTo(cx - cw * (tall ? 0.75 : 0.5), bottom);
    g.lineTo(cx - cw * 0.5, top);
    g.lineTo(cx + cw * 0.5, top);
    g.lineTo(cx + cw * (tall ? 0.75 : 0.5), bottom);
    g.fill();
    g.fillStyle = V(92);
    g.fillRect(cx + cw * 0.12, top, cw * 0.38, h);
    if (tall) {
      g.fillStyle = V(150);
      for (let y = top + 6 * s; y < bottom - 4 * s; y += 18 * s) g.fillRect(cx - cw * 0.55, y, cw * 1.1, Math.max(0.6, 1.1 * s));
    }
    g.fillStyle = V(84);
    g.fillRect(cx - cw * 0.65, top - 1.6 * s, cw * 1.3, 1.8 * s);
    if (!tall) {
      g.fillStyle = V(104);
      for (let k = 0; k < 3; k++) g.fillRect(cx - cw * 0.45 + k * cw * 0.33, top - 3.4 * s, cw * 0.2, 2 * s);
    }
  };
  const lattice = (g: G, x0: number, x1: number, yTop: number, yBot: number, s: number, v = 92, cell = 8) => {
    g.strokeStyle = V(v);
    g.lineWidth = Math.max(0.4, 0.7 * s);
    g.beginPath();
    g.moveTo(x0, yBot);
    g.lineTo(x0, yTop);
    g.moveTo(x1, yBot);
    g.lineTo(x1, yTop);
    const st = cell * s;
    for (let y = yBot; y > yTop + st * 0.5; y -= st) {
      g.moveTo(x0, y);
      g.lineTo(x1, y - st);
      g.moveTo(x1, y);
      g.lineTo(x0, y - st);
      g.moveTo(x0, y);
      g.lineTo(x1, y);
    }
    g.stroke();
  };
  const truss = (g: G, x0: number, x1: number, y: number, d: number, s: number, v = 96) => {
    g.strokeStyle = V(v);
    g.lineWidth = Math.max(0.5, 0.9 * s);
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.moveTo(x0, y + d);
    g.lineTo(x1, y + d);
    for (let x = x0; x < x1; x += d) {
      g.moveTo(x, y + d);
      g.lineTo(Math.min(x1, x + d / 2), y);
      g.lineTo(Math.min(x1, x + d), y + d);
    }
    g.stroke();
  };
  const lit = (wg: G, R: () => number, strong = false) => {
    wg.fillStyle = strong ? (R() < 0.5 ? '#9a4c1e' : '#b0642a') : WARM[Math.floor(R() * WARM.length)];
  };
  const rail = (g: G, x0: number, x1: number, y: number, s: number, v = 150) => {
    g.strokeStyle = V(v);
    g.lineWidth = Math.max(0.4, 0.5 * s);
    g.beginPath();
    g.moveTo(x0, y - 4 * s);
    g.lineTo(x1, y - 4 * s);
    for (let x = x0; x <= x1; x += 2.6 * s) {
      g.moveTo(x, y - 4 * s);
      g.lineTo(x, y);
    }
    g.stroke();
  };

  // ---- buildings --------------------------------------------------------------------------------------
  function gothic(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const tiers = 2 + (b.seed % 2);
    const fr = tiers === 3 ? [0.52, 0.3, 0.18] : [0.62, 0.38];
    let y = b.base;
    let x = b.x;
    let w = b.w;
    const rose = R() < 0.25 && b.layer >= 1;
    for (let k = 0; k < tiers; k++) {
      const th = b.h * fr[k];
      const top = y - th;
      g.fillStyle = V(124 + Math.floor(R() * 10));
      g.fillRect(x, top, w, th);
      g.fillStyle = V(100);
      g.fillRect(x + w * 0.77, top, w * 0.23, th);
      const bw = Math.max(1.4, w * 0.08);
      for (const bx of [x - bw * 0.5, x + w - bw * 0.5]) {
        g.fillStyle = V(bx < x + w / 2 ? 142 : 94);
        g.fillRect(bx, top + th * 0.05, bw, th * 0.95);
        g.fillStyle = V(156);
        for (let q = 1; q < 4; q++) g.fillRect(bx - bw * 0.2, top + (th * q) / 4, bw * 1.4, Math.max(0.5, 0.8 * s));
        pinnacle(g, bx + bw / 2, top + th * 0.05, bw * 1.05, bw * 3.4, 134);
      }
      const cols = Math.max(1, Math.floor((w - 4 * s) / (7 * s)));
      const rows = Math.max(1, Math.floor(th / (15 * s)));
      const cw = (w - 4 * s) / cols;
      const rh = th / rows;
      for (let rr = 0; rr < rows; rr++)
        for (let c = 0; c < cols; c++) {
          const wx = x + 2 * s + c * cw + cw * 0.3;
          const ww = cw * 0.4;
          const wy = top + rr * rh + rh * 0.2;
          const wh = rh * 0.6;
          if (rose && k === 0 && rr < 2 && Math.abs(wx - (x + w / 2)) < w * 0.3) continue;
          g.fillStyle = V(56);
          lancet(g, wx, wy, ww, wh);
          g.fillStyle = V(150);
          g.fillRect(wx - 0.3 * s, wy + wh, ww + 0.6 * s, Math.max(0.4, 0.6 * s));
          if (R() < litP) {
            lit(wg, R);
            lancet(wg, wx, wy, ww, wh);
          }
        }
      if (rose && k === 0) roseWindow(g, wg, x + w / 2, top + Math.min(w * 0.28, th * 0.18) * 1.4, Math.min(w * 0.28, th * 0.18), s);
      cornice(g, x, top, w, s);
      for (let px = x + 2.5 * s; px < x + w - s; px += 4 * s) pinnacle(g, px, top, 1.3 * s, 3 * s, 132);
      y = top;
      x += w * 0.12;
      w *= 0.76;
    }
    const cx = x + w / 2;
    const peak = b.beacon ? b.beacon[1] : y - w * (1.4 + R() * 0.8);
    if (b.masts.length) return mastOn(g, cx, y, b, s);
    if (b.seed % 3 !== 0) spireShape(g, cx, y, w * 0.86, y - peak, s);
    else {
      g.fillStyle = V(122);
      g.fillRect(cx - w * 0.28, y - w * 0.7, w * 0.56, w * 0.7);
      g.fillStyle = V(56);
      for (let q = 0; q < 3; q++) lancet(g, cx - w * 0.22 + q * w * 0.16, y - w * 0.6, w * 0.08, w * 0.42);
      for (const px of [x, x + w * 0.33, x + w * 0.67, x + w]) pinnacle(g, px, y, w * 0.12, w * 0.7, 136);
      g.fillStyle = V(126);
      g.beginPath();
      g.moveTo(cx - w * 0.2, y - w * 0.7);
      g.lineTo(cx, peak);
      g.lineTo(cx + w * 0.2, y - w * 0.7);
      g.fill();
    }
  }
  function roseWindow(g: G, wg: G, rx: number, ry: number, rr: number, s: number) {
    g.fillStyle = V(150);
    g.beginPath();
    g.arc(rx, ry, rr * 1.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = V(54);
    g.beginPath();
    g.arc(rx, ry, rr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = V(140);
    g.lineWidth = Math.max(0.4, 0.5 * s);
    for (let q = 0; q < 12; q++) {
      const a = (q / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + Math.cos(a) * rr, ry + Math.sin(a) * rr);
      g.stroke();
    }
    g.beginPath();
    g.arc(rx, ry, rr * 0.45, 0, Math.PI * 2);
    g.stroke();
    const glass = ['#6a3420', '#344068', '#806030', '#3e5434', '#4e2a44'];
    for (let q = 0; q < 12; q++) {
      wg.fillStyle = glass[q % glass.length];
      wg.beginPath();
      wg.moveTo(rx, ry);
      wg.arc(rx, ry, rr * 0.9, (q / 12) * Math.PI * 2 + 0.04, ((q + 1) / 12) * Math.PI * 2 - 0.04);
      wg.fill();
    }
  }

  /** A mooring mast: a lattice needle on the roof, its ring and docking arm at the top. */
  function mastOn(g: G, cx: number, roof: number, b: Building, s: number) {
    const mm = world.masts.find((q) => q.id === b.masts[0]);
    if (!mm) return;
    const top = mm.y;
    const bw = 12 * s;
    g.strokeStyle = V(96);
    g.lineWidth = Math.max(0.6, 1.4 * s);
    g.beginPath();
    g.moveTo(cx - bw / 2, roof);
    g.lineTo(cx - 1.4 * s, top + 6 * s);
    g.moveTo(cx + bw / 2, roof);
    g.lineTo(cx + 1.4 * s, top + 6 * s);
    g.stroke();
    g.lineWidth = Math.max(0.4, 0.6 * s);
    const n = Math.max(3, Math.floor((roof - top) / (8 * s)));
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const y0 = roof - ((roof - top - 6 * s) * k) / n;
      const y1 = roof - ((roof - top - 6 * s) * (k + 1)) / n;
      const h0 = bw / 2 - ((bw / 2 - 1.4 * s) * k) / n;
      const h1 = bw / 2 - ((bw / 2 - 1.4 * s) * (k + 1)) / n;
      g.moveTo(cx - h0, y0);
      g.lineTo(cx + h1, y1);
      g.moveTo(cx + h0, y0);
      g.lineTo(cx - h1, y1);
    }
    g.stroke();
    g.fillStyle = V(140);
    g.fillRect(cx - 11 * s, top + 6 * s, 22 * s, Math.max(0.6, 1.4 * s));
    g.fillStyle = V(90);
    g.fillRect(cx - 9 * s, top + 7.4 * s, 18 * s, 3 * s);
    rail(g, cx - 10 * s, cx + 10 * s, top + 6 * s, s * 0.6);
    g.fillStyle = V(112);
    g.beginPath();
    g.moveTo(cx - 3 * s, top + 6 * s);
    g.lineTo(cx, top - 2 * s);
    g.lineTo(cx + 3 * s, top + 6 * s);
    g.fill();
    g.fillStyle = V(150);
    g.fillRect(cx - 0.3 * s, top - 12 * s, Math.max(0.4, 0.6 * s), 10 * s);
  }

  function block(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    const { x, w } = b;
    g.fillStyle = V(118 + Math.floor(R() * 18));
    g.fillRect(x, top, w, b.h);
    g.fillStyle = V(98);
    g.fillRect(x + w * 0.82, top, w * 0.18, b.h);
    const fh = 12 * s;
    const floors = Math.max(1, Math.floor(b.h / fh));
    const cols = Math.max(1, Math.floor((w - 4 * s) / (7 * s)));
    const cw = (w - 4 * s) / cols;
    const bay = R() < 0.4;
    for (let fl = 0; fl < floors; fl++) {
      const fy = b.base - (fl + 1) * fh;
      if (fl % 4 === 3) cornice(g, x, fy + fh, w, s * 0.7);
      if (fl === 0) {
        g.fillStyle = V(62);
        g.fillRect(x + 2 * s, fy + fh * 0.25, w - 4 * s, fh * 0.75);
        if (R() < 0.75) {
          lit(wg, R);
          wg.fillRect(x + 3 * s, fy + fh * 0.32, w * (0.3 + R() * 0.5), fh * 0.6);
        }
        continue;
      }
      for (let c = 0; c < cols; c++) {
        const wx = x + 2 * s + c * cw + cw * 0.28;
        const ww = cw * 0.44;
        const wy = fy + fh * 0.22;
        const wh = fh * 0.56;
        g.fillStyle = V(60);
        if (fl % 2 && R() < 0.3) arched(g, wx, wy, ww, wh);
        else g.fillRect(wx, wy, ww, wh);
        g.fillStyle = V(152);
        g.fillRect(wx - 0.4 * s, wy - 1 * s, ww + 0.8 * s, Math.max(0.4, 0.8 * s));
        if (R() < litP) {
          lit(wg, R);
          wg.fillRect(wx, wy, ww, wh);
        }
      }
      if (bay && fl > 1 && fl < floors - 1) {
        // Bay windows: a bow of glass jutting from the middle.
        g.fillStyle = V(132);
        g.fillRect(x + w * 0.38, fy + fh * 0.1, w * 0.24, fh * 0.9);
        g.fillStyle = V(64);
        g.fillRect(x + w * 0.41, fy + fh * 0.25, w * 0.18, fh * 0.5);
        if (R() < litP * 1.4) {
          lit(wg, R);
          wg.fillRect(x + w * 0.41, fy + fh * 0.25, w * 0.18, fh * 0.5);
        }
      }
    }
    if (R() < 0.5 && floors > 3) {
      const fx = x + (R() < 0.5 ? w * 0.06 : w * 0.6);
      const fw = w * 0.32;
      g.strokeStyle = V(70);
      g.lineWidth = Math.max(0.4, 0.7 * s);
      g.beginPath();
      for (let fl = 1; fl < floors; fl++) {
        const fy = b.base - fl * fh;
        g.moveTo(fx, fy);
        g.lineTo(fx + fw, fy);
        if (fl < floors - 1) {
          g.moveTo(fl % 2 ? fx + 1 : fx + fw - 1, fy);
          g.lineTo(fl % 2 ? fx + fw - 1 : fx + 1, fy - fh);
        }
      }
      g.stroke();
    }
    if (R() < 0.55) {
      const rh = 12 * s;
      g.fillStyle = V(94);
      g.beginPath();
      g.moveTo(x - s, top);
      g.lineTo(x + 4 * s, top - rh);
      g.lineTo(x + w - 4 * s, top - rh);
      g.lineTo(x + w + s, top);
      g.fill();
      g.fillStyle = V(150);
      g.fillRect(x + 4 * s, top - rh, w - 8 * s, Math.max(0.5, 0.8 * s));
      for (let dx = x + 7 * s; dx < x + w - 9 * s; dx += 12 * s) {
        g.fillStyle = V(122);
        g.fillRect(dx, top - rh * 0.75, 5 * s, rh * 0.6);
        g.beginPath();
        g.moveTo(dx - 0.6 * s, top - rh * 0.75);
        g.lineTo(dx + 2.5 * s, top - rh * 1.05);
        g.lineTo(dx + 5.6 * s, top - rh * 0.75);
        g.fill();
        g.fillStyle = V(58);
        g.fillRect(dx + 1.2 * s, top - rh * 0.62, 2.6 * s, rh * 0.42);
        if (R() < litP) {
          lit(wg, R);
          wg.fillRect(dx + 1.2 * s, top - rh * 0.62, 2.6 * s, rh * 0.42);
        }
      }
    } else {
      g.fillStyle = V(146);
      g.fillRect(x - s, top - 3 * s, w + 2 * s, 3 * s);
      const roll = R();
      if (w > 36 * s && roll < 0.45) {
        const tx = x + w * (0.2 + R() * 0.5);
        g.strokeStyle = V(78);
        g.lineWidth = Math.max(0.5, 0.8 * s);
        g.beginPath();
        g.moveTo(tx, top - 3 * s);
        g.lineTo(tx + 2 * s, top - 12 * s);
        g.moveTo(tx + 10 * s, top - 3 * s);
        g.lineTo(tx + 8 * s, top - 12 * s);
        g.moveTo(tx + 1 * s, top - 7 * s);
        g.lineTo(tx + 9 * s, top - 7 * s);
        g.stroke();
        g.fillStyle = V(110);
        g.fillRect(tx, top - 22 * s, 10 * s, 10 * s);
        g.fillStyle = V(136);
        for (let q = 0; q < 3; q++) g.fillRect(tx, top - 20 * s + q * 3.5 * s, 10 * s, Math.max(0.4, 0.5 * s));
        g.fillStyle = V(100);
        g.beginPath();
        g.moveTo(tx - 0.8 * s, top - 22 * s);
        g.lineTo(tx + 5 * s, top - 27 * s);
        g.lineTo(tx + 10.8 * s, top - 22 * s);
        g.fill();
      } else if (roll < 0.7) {
        const sw = w * 0.7;
        const sx = x + w * 0.15;
        g.strokeStyle = V(80);
        g.lineWidth = Math.max(0.4, 0.6 * s);
        g.beginPath();
        for (let q = 0; q <= 4; q++) {
          g.moveTo(sx + (sw * q) / 4, top - 3 * s);
          g.lineTo(sx + (sw * q) / 4, top - 10 * s);
        }
        g.stroke();
        g.fillStyle = V(140);
        g.fillRect(sx, top - 20 * s, sw, 10 * s);
        g.fillStyle = V(100);
        g.fillRect(sx + 1.5 * s, top - 18.5 * s, sw - 3 * s, 7 * s);
        if (R() < 0.6) {
          wg.fillStyle = '#a8642a';
          wg.fillRect(sx + 1.5 * s, top - 18.5 * s, sw - 3 * s, 7 * s);
        }
      }
    }
    if (b.gun) gunMount(g, b.gun[0], top - 3 * s, s);
    for (const [cx, cy, cw] of b.chimneys) chimneyStack(g, cx, cy, top, cw, s, false);
  }
  /** An anti-aircraft gun behind sandbags on a roof. */
  function gunMount(g: G, x: number, y: number, s: number) {
    g.fillStyle = V(110);
    g.beginPath();
    g.ellipse(x, y, 8 * s, 3 * s, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = V(96);
    g.fillRect(x - 3 * s, y - 6 * s, 6 * s, 4 * s);
    g.strokeStyle = V(84);
    g.lineWidth = Math.max(0.6, 1.2 * s);
    g.beginPath();
    g.moveTo(x, y - 4 * s);
    g.lineTo(x + 8 * s, y - 14 * s);
    g.stroke();
  }

  function stack(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    let y = b.base;
    let prevW = b.w;
    let px = b.x;
    const cx = b.x + b.w / 2;
    while (y > top + 6 * s) {
      const bh = Math.min(y - top, (12 + R() * 22) * s);
      const bw = b.w * (0.62 + R() * 0.5);
      const bx = Math.max(b.x - b.w * 0.1, Math.min(b.x + b.w * 1.1 - bw, cx - bw / 2 + (R() - 0.5) * b.w * 0.16));
      g.fillStyle = V(108 + Math.floor(R() * 34));
      g.fillRect(bx, y - bh, bw, bh);
      g.fillStyle = V(92);
      g.fillRect(bx + bw * 0.8, y - bh, bw * 0.2, bh);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let py = y - bh + 3 * s; py < y; py += 3 * s) g.fillRect(bx, py, bw, Math.max(0.3, 0.4 * s));
      g.fillStyle = V(76);
      g.fillRect(bx, y - 1.4 * s, bw, 1.4 * s);
      g.fillStyle = V(150);
      g.fillRect(bx - 0.5 * s, y - bh, bw + s, Math.max(0.5, 0.8 * s));
      if (bw > prevW * 0.95 || bx < px - 2 * s) {
        g.strokeStyle = V(74);
        g.lineWidth = Math.max(0.4, 0.8 * s);
        g.beginPath();
        g.moveTo(bx + 1 * s, y);
        g.lineTo(bx + 7 * s, y + 8 * s);
        g.moveTo(bx + bw - 1 * s, y);
        g.lineTo(bx + bw - 7 * s, y + 8 * s);
        g.stroke();
      }
      const ww = (2.6 + R() * 2) * s;
      const wh = Math.min(bh * 0.5, (4 + R() * 3) * s);
      const nw = Math.max(1, Math.floor((bw - 4 * s) / (ww * 2.2)));
      const wy = y - bh + (bh - wh) * 0.45;
      for (let k = 0; k < nw; k++) {
        if (R() < 0.25) continue;
        const wx = bx + 2.5 * s + k * ((bw - 5 * s) / nw) + ((bw - 5 * s) / nw - ww) / 2;
        g.fillStyle = V(58);
        g.fillRect(wx, wy, ww, wh);
        g.fillStyle = V(146);
        g.fillRect(wx - 0.4 * s, wy + wh, ww + 0.8 * s, Math.max(0.4, 0.7 * s));
        if (R() < litP * 1.2) {
          lit(wg, R);
          wg.fillRect(wx, wy, ww, wh);
        }
      }
      if (R() < 0.4) rail(g, bx - 2 * s, bx + bw + 2 * s, y, s);
      if (R() < 0.25 && y - bh > top + 10 * s) {
        g.fillStyle = V(92);
        g.beginPath();
        g.moveTo(bx - 1.5 * s, y - bh);
        g.lineTo(bx + bw / 2, y - bh - bw * 0.22);
        g.lineTo(bx + bw + 1.5 * s, y - bh);
        g.fill();
      }
      if (R() < 0.2) {
        // Washing on a line, or a sign hung out.
        g.strokeStyle = V(80);
        g.lineWidth = Math.max(0.3, 0.4 * s);
        g.beginPath();
        g.moveTo(bx + bw, y - bh * 0.7);
        g.lineTo(bx + bw + 10 * s, y - bh * 0.6);
        g.stroke();
        g.fillStyle = V(150);
        for (let q = 0; q < 3; q++) g.fillRect(bx + bw + 2 * s + q * 3 * s, y - bh * 0.66 + q * 0.4 * s, 2 * s, 3 * s);
      }
      prevW = bw;
      px = bx;
      y -= bh;
    }
    g.strokeStyle = V(84);
    g.lineWidth = Math.max(0.5, 1.2 * s);
    g.beginPath();
    g.moveTo(b.x + b.w * 0.12, b.base);
    g.lineTo(b.x + b.w * 0.12, top + 10 * s);
    g.stroke();
    const ch = R();
    if (ch < 0.4) {
      g.strokeStyle = V(90);
      g.lineWidth = Math.max(0.4, 0.6 * s);
      g.beginPath();
      g.moveTo(cx, top);
      g.lineTo(cx + 2 * s, top - 26 * s);
      for (let q = 1; q < 4; q++) {
        g.moveTo(cx + (q / 4) * 2 * s - 4 * s, top - q * 6 * s);
        g.lineTo(cx + (q / 4) * 2 * s + 4 * s, top - q * 6 * s);
      }
      g.stroke();
    } else if (ch < 0.65) {
      g.fillStyle = V(118);
      g.beginPath();
      g.ellipse(cx, top, b.w * 0.22, b.w * 0.2, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = V(150);
      g.fillRect(cx - 0.3 * s, top - b.w * 0.2 - 8 * s, Math.max(0.4, 0.6 * s), 8 * s);
    } else if (ch < 0.85) {
      const wy = top - 14 * s;
      g.strokeStyle = V(96);
      g.lineWidth = Math.max(0.4, 0.8 * s);
      g.beginPath();
      g.moveTo(cx, top);
      g.lineTo(cx, wy);
      for (let q = 0; q < 8; q++) {
        const a = (q / 8) * Math.PI * 2;
        g.moveTo(cx, wy);
        g.lineTo(cx + Math.cos(a) * 7 * s, wy + Math.sin(a) * 7 * s);
      }
      g.stroke();
      g.beginPath();
      g.arc(cx, wy, 7 * s, 0, Math.PI * 2);
      g.stroke();
    }
    for (const [ccx, cy, cw] of b.chimneys) chimneyStack(g, ccx, cy, top + 4 * s, cw, s, false);
  }

  function deco(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const steps = 3 + (b.seed % 2);
    const fr = steps === 4 ? [0.46, 0.26, 0.17, 0.11] : [0.55, 0.28, 0.17];
    let x = b.x;
    let w = b.w;
    let y = b.base;
    for (let k = 0; k < steps; k++) {
      const th = b.h * fr[k];
      const top = y - th;
      g.fillStyle = V(122 + Math.floor(R() * 8));
      g.fillRect(x, top, w, th);
      for (let rx = x + 2 * s; rx < x + w - 2 * s; rx += 4.5 * s) {
        g.fillStyle = V(152);
        g.fillRect(rx, top, Math.max(0.5, 0.9 * s), th);
        g.fillStyle = V(58);
        const seg = 13 * s;
        for (let sy = top + 3 * s; sy < y - 3 * s; sy += seg) {
          g.fillRect(rx + 1.5 * s, sy, Math.max(0.5, 1.4 * s), seg * 0.7);
          if (R() < litP * 0.7) {
            lit(wg, R);
            wg.fillRect(rx + 1.5 * s, sy, Math.max(0.5, 1.4 * s), seg * 0.7);
          }
        }
      }
      g.fillStyle = V(96);
      g.fillRect(x + w * 0.8, top, w * 0.2, th);
      g.fillStyle = V(164);
      g.fillRect(x - 0.5 * s, top, w + s, Math.max(0.6, 1.4 * s));
      for (const sx of [x, x + w]) {
        g.fillStyle = V(140);
        g.beginPath();
        g.moveTo(sx - 1.5 * s, top);
        g.lineTo(sx, top - 6 * s);
        g.lineTo(sx + 1.5 * s, top);
        g.fill();
      }
      y = top;
      x += w * 0.14;
      w *= 0.72;
    }
    const cx = x + w / 2;
    if (b.masts.length) return mastOn(g, cx, y, b, s);
    if (b.gun) gunMount(g, cx, y, s);
    const peak = b.beacon ? b.beacon[1] : y - w * 1.2;
    let sy = y;
    let sw = w;
    for (let k = 0; k < 3; k++) {
      const sh = (y - peak) * 0.14;
      g.fillStyle = V(130 - k * 6);
      g.fillRect(cx - sw / 2, sy - sh, sw, sh);
      g.fillStyle = V(160);
      g.fillRect(cx - sw / 2, sy - sh, sw, Math.max(0.5, 0.8 * s));
      sy -= sh;
      sw *= 0.66;
    }
    g.fillStyle = V(140);
    g.beginPath();
    g.moveTo(cx - sw / 2, sy);
    g.lineTo(cx, peak);
    g.lineTo(cx + sw / 2, sy);
    g.fill();
    g.strokeStyle = V(150);
    g.lineWidth = Math.max(0.4, 0.6 * s);
    g.beginPath();
    g.ellipse(cx, sy - (sy - peak) * 0.4, sw * 0.9, sw * 0.25, 0, 0, Math.PI * 2);
    g.stroke();
  }

  function dome(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const { x, w } = b;
    const hallH = b.h * 0.55;
    const ht = b.base - hallH;
    g.fillStyle = V(126);
    g.fillRect(x, ht, w, hallH);
    g.fillStyle = V(58);
    g.fillRect(x + 4 * s, ht + hallH * 0.25, w - 8 * s, hallH * 0.75);
    for (let cx = x + 4 * s; cx <= x + w - 4 * s; cx += 7 * s) {
      g.fillStyle = V(156);
      g.fillRect(cx - 1.4 * s, ht + hallH * 0.22, 2.8 * s, hallH * 0.78);
      g.fillStyle = V(108);
      g.fillRect(cx + 0.6 * s, ht + hallH * 0.22, 0.8 * s, hallH * 0.78);
    }
    if (R() < litP * 1.4) {
      wg.fillStyle = '#9a5e2a';
      for (let cx = x + 5.4 * s; cx < x + w - 6 * s; cx += 7 * s) wg.fillRect(cx, ht + hallH * 0.45, 4.2 * s, hallH * 0.4);
    }
    cornice(g, x, ht + hallH * 0.2, w, s);
    g.fillStyle = V(138);
    g.beginPath();
    g.moveTo(x + w * 0.25, ht + hallH * 0.2);
    g.lineTo(x + w / 2, ht);
    g.lineTo(x + w * 0.75, ht + hallH * 0.2);
    g.fill();
    for (const sx of [x + 2 * s, x + w - 2 * s]) {
      g.fillStyle = V(96);
      g.fillRect(sx - 1 * s, ht - 6 * s, 2 * s, 6 * s);
      g.beginPath();
      g.arc(sx, ht - 7 * s, 1.2 * s, 0, Math.PI * 2);
      g.fill();
    }
    domeTop(g, wg, x + w / 2, ht, w * 0.5, b.h * 0.18, b.h * 0.27, s, litP, R);
  }
  function domeTop(g: G, wg: G, cx: number, ht: number, dw: number, dh: number, ry: number, s: number, litP: number, R: () => number) {
    const dt = ht - dh;
    g.fillStyle = V(122);
    g.fillRect(cx - dw / 2, dt, dw, dh);
    for (let k = 0; k < 6; k++) {
      const wx = cx - dw / 2 + dw * (0.08 + k * 0.15);
      g.fillStyle = V(58);
      lancet(g, wx, dt + dh * 0.25, dw * 0.07, dh * 0.6);
      if (R() < litP) {
        lit(wg, R);
        lancet(wg, wx, dt + dh * 0.25, dw * 0.07, dh * 0.6);
      }
    }
    const rx = dw * 0.56;
    g.fillStyle = V(134);
    g.beginPath();
    g.ellipse(cx, dt, rx, ry, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = V(104);
    g.beginPath();
    g.ellipse(cx, dt, rx, ry, 0, -Math.PI / 2, 0);
    g.lineTo(cx, dt);
    g.fill();
    g.strokeStyle = V(160);
    g.lineWidth = Math.max(0.4, 0.6 * s);
    for (let k = 1; k < 6; k++) {
      g.beginPath();
      g.ellipse(cx, dt, rx * (k / 6), ry, 0, Math.PI, Math.PI * 1.5);
      g.stroke();
    }
    g.strokeStyle = V(86);
    for (let k = 1; k < 6; k++) {
      g.beginPath();
      g.ellipse(cx, dt, rx * (k / 6), ry, 0, Math.PI * 1.5, Math.PI * 2);
      g.stroke();
    }
    const lt = dt - ry;
    g.fillStyle = V(124);
    g.fillRect(cx - 3 * s, lt - 8 * s, 6 * s, 8 * s);
    g.fillStyle = V(58);
    g.fillRect(cx - 1.6 * s, lt - 6.5 * s, 1.2 * s, 5 * s);
    g.fillRect(cx + 0.4 * s, lt - 6.5 * s, 1.2 * s, 5 * s);
    g.fillStyle = V(140);
    g.beginPath();
    g.ellipse(cx, lt - 8 * s, 3.6 * s, 3 * s, 0, Math.PI, 0);
    g.fill();
    g.fillRect(cx - 0.3 * s, lt - 20 * s, Math.max(0.4, 0.6 * s), 10 * s);
  }

  function cathedral(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const { x, w } = b;
    const top = b.base - b.h;
    const towersLeft = R() < 0.5;
    // The nave, its buttresses and its clerestory.
    g.fillStyle = V(124);
    g.fillRect(x, top + b.h * 0.3, w, b.h * 0.7);
    g.fillStyle = V(100);
    g.beginPath();
    g.moveTo(x, top + b.h * 0.3);
    g.lineTo(x + w / 2, top + b.h * 0.08);
    g.lineTo(x + w, top + b.h * 0.3);
    g.fill();
    g.strokeStyle = V(150);
    g.lineWidth = Math.max(0.4, 0.6 * s);
    g.beginPath();
    g.moveTo(x, top + b.h * 0.3);
    g.lineTo(x + w / 2, top + b.h * 0.08);
    g.stroke();
    for (let k = 0; k <= 6; k++) {
      const bx = x + (w * k) / 6;
      g.fillStyle = V(k % 2 ? 140 : 110);
      g.fillRect(bx - 2 * s, top + b.h * 0.38, 4 * s, b.h * 0.62);
      pinnacle(g, bx, top + b.h * 0.38, 4.4 * s, 10 * s, 134);
      if (k < 6) {
        const wx = bx + w / 12 - 2.5 * s;
        g.fillStyle = V(54);
        lancet(g, wx, top + b.h * 0.45, 5 * s, b.h * 0.35);
        if (R() < 0.6) {
          wg.fillStyle = R() < 0.5 ? '#9a4a2c' : '#b8883c';
          lancet(wg, wx, top + b.h * 0.45, 5 * s, b.h * 0.35);
        }
      }
    }
    // The west front: twin towers and the rose between them, or a crossing tower with a spire.
    const fx = towersLeft ? x : x + w - w * 0.38;
    const fw = w * 0.38;
    for (const tx of [fx, fx + fw - fw * 0.32]) {
      const th = b.h * (1.2 + R() * 0.2);
      g.fillStyle = V(128);
      g.fillRect(tx, b.base - th, fw * 0.32, th);
      g.fillStyle = V(98);
      g.fillRect(tx + fw * 0.24, b.base - th, fw * 0.08, th);
      for (let q = 0; q < 3; q++) {
        g.fillStyle = V(56);
        lancet(g, tx + fw * 0.1, b.base - th + 8 * s + q * th * 0.28, fw * 0.12, th * 0.18);
      }
      cornice(g, tx, b.base - th, fw * 0.32, s);
      spireShape(g, tx + fw * 0.16, b.base - th, fw * 0.3, th * 0.6, s);
    }
    g.fillStyle = V(130);
    g.fillRect(fx + fw * 0.3, top + b.h * 0.15, fw * 0.4, b.h * 0.85);
    roseWindow(g, wg, fx + fw * 0.5, top + b.h * 0.35, fw * 0.16, s);
    g.fillStyle = V(50);
    lancet(g, fx + fw * 0.42, b.base - b.h * 0.3, fw * 0.16, b.h * 0.3);
    g.fillStyle = V(138);
    g.beginPath();
    g.moveTo(fx + fw * 0.3, top + b.h * 0.15);
    g.lineTo(fx + fw * 0.5, top);
    g.lineTo(fx + fw * 0.7, top + b.h * 0.15);
    g.fill();
    // The crossing tower.
    const cx = towersLeft ? x + w * 0.7 : x + w * 0.3;
    g.fillStyle = V(126);
    g.fillRect(cx - w * 0.06, top - b.h * 0.1, w * 0.12, b.h * 0.4);
    spireShape(g, cx, top - b.h * 0.1, w * 0.12, b.h * 0.9, s);
    if (R() < litP * 2) {
      lit(wg, R);
      wg.fillRect(x + w * 0.2, b.base - b.h * 0.2, w * 0.1, b.h * 0.15);
    }
  }

  function arcology(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    let y = b.base;
    const top = b.base - b.h;
    const cx = b.x + b.w / 2;
    let tier = 0;
    while (y > top + 20 * s) {
      const th = Math.min(y - top, b.h * (0.12 + R() * 0.1));
      const tw = b.w * (1 - (tier / 8) * 0.6) * (0.85 + R() * 0.25);
      const tx = cx - tw / 2 + (R() - 0.5) * b.w * 0.08;
      g.fillStyle = V(118 + Math.floor(R() * 20));
      g.fillRect(tx, y - th, tw, th);
      g.fillStyle = V(94);
      g.fillRect(tx + tw * 0.8, y - th, tw * 0.2, th);
      // Its overhanging floor, on brackets.
      g.fillStyle = V(150);
      g.fillRect(tx - 6 * s, y - th, tw + 12 * s, 2.4 * s);
      g.strokeStyle = V(84);
      g.lineWidth = Math.max(0.4, 0.8 * s);
      g.beginPath();
      for (const sx of [tx - 5 * s, tx + tw + 5 * s]) {
        g.moveTo(sx, y - th + 2.4 * s);
        g.lineTo(sx + (sx < cx ? 6 : -6) * s, y - th + 10 * s);
      }
      g.stroke();
      rail(g, tx - 6 * s, tx + tw + 6 * s, y - th, s);
      const rows = Math.max(1, Math.floor(th / (11 * s)));
      for (let rr = 0; rr < rows; rr++) {
        for (let wx = tx + 3 * s; wx < tx + tw - 4 * s; wx += 6 * s) {
          const wy = y - th + 5 * s + rr * 11 * s;
          if (wy > y - 4 * s) continue;
          g.fillStyle = V(58);
          arched(g, wx, wy, 3 * s, 6 * s);
          if (R() < litP * 1.3) {
            lit(wg, R);
            arched(wg, wx, wy, 3 * s, 6 * s);
          }
        }
      }
      if (R() < 0.35) {
        // A roof garden: trees in tubs.
        for (let q = 0; q < 4; q++) {
          const gx = tx + tw * (0.15 + q * 0.22);
          g.fillStyle = V(90);
          g.beginPath();
          g.arc(gx, y - th - 4 * s, 4 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (R() < 0.3) {
        g.fillStyle = V(132);
        g.beginPath();
        g.ellipse(tx + tw * (0.2 + R() * 0.6), y - th, tw * 0.12, tw * 0.1, 0, Math.PI, 0);
        g.fill();
      }
      y -= th;
      tier++;
    }
    g.fillStyle = V(136);
    g.beginPath();
    g.ellipse(cx, y, b.w * 0.18, b.w * 0.26, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = V(104);
    g.beginPath();
    g.ellipse(cx, y, b.w * 0.18, b.w * 0.26, 0, -Math.PI / 2, 0);
    g.lineTo(cx, y);
    g.fill();
    g.fillStyle = V(150);
    g.fillRect(cx - 0.4 * s, y - b.w * 0.26 - 16 * s, Math.max(0.5, 0.8 * s), 16 * s);
    g.strokeStyle = V(84);
    g.lineWidth = Math.max(0.5, 1.2 * s);
    g.beginPath();
    g.moveTo(b.x + b.w * 0.08, b.base);
    g.lineTo(b.x + b.w * 0.08, top + b.h * 0.3);
    g.moveTo(b.x + b.w * 0.92, b.base);
    g.lineTo(b.x + b.w * 0.92, top + b.h * 0.5);
    g.stroke();
    for (const [ccx, cy, cw] of b.chimneys) chimneyStack(g, ccx, cy, top + 6 * s, cw, s, false);
  }

  function lift(g: G, wg: G, b: Building, s: number, P: Tile) {
    const top = b.base - b.h;
    const cx = b.x + b.w / 2;
    g.fillStyle = V(116);
    g.fillRect(b.x, b.base - 30 * s, b.w, 30 * s);
    lattice(g, b.x + b.w * 0.1, b.x + b.w * 0.9, top, b.base - 30 * s, s, 92, 9);
    g.strokeStyle = V(78);
    g.lineWidth = Math.max(0.5, 1 * s);
    g.beginPath();
    g.moveTo(cx - 3 * s, top);
    g.lineTo(cx - 3 * s, b.base - 30 * s);
    g.moveTo(cx + 3 * s, top);
    g.lineTo(cx + 3 * s, b.base - 30 * s);
    g.stroke();
    g.fillStyle = V(126);
    g.fillRect(b.x - 6 * s, top - 14 * s, b.w + 12 * s, 14 * s);
    g.fillStyle = V(58);
    for (let wx = b.x - 3 * s; wx < b.x + b.w + 3 * s; wx += 6 * s) g.fillRect(wx, top - 11 * s, 3 * s, 7 * s);
    wg.fillStyle = '#ffcf8a';
    wg.fillRect(b.x - 3 * s, top - 11 * s, b.w + 6 * s, 7 * s);
    g.fillStyle = V(140);
    g.beginPath();
    g.moveTo(b.x - 8 * s, top - 14 * s);
    g.lineTo(cx, top - 22 * s);
    g.lineTo(b.x + b.w + 8 * s, top - 14 * s);
    g.fill();
    g.fillStyle = V(58);
    g.fillRect(b.x + b.w * 0.25, b.base - 22 * s, b.w * 0.5, 22 * s);
    P.lifts.push([cx, top, b.base - 30 * s]);
  }

  function skydock(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    const cx = b.x + b.w / 2;
    // The core: a riveted iron tower with a lattice skin.
    g.fillStyle = V(116);
    g.fillRect(b.x + b.w * 0.2, top, b.w * 0.6, b.h);
    g.fillStyle = V(94);
    g.fillRect(b.x + b.w * 0.6, top, b.w * 0.2, b.h);
    for (let y = top + 6 * s; y < b.base; y += 12 * s) {
      g.fillStyle = V(60);
      g.fillRect(b.x + b.w * 0.28, y, b.w * 0.44, 5 * s);
      if (R() < litP * 1.2) {
        lit(wg, R);
        wg.fillRect(b.x + b.w * 0.28, y, b.w * 0.44, 5 * s);
      }
    }
    lattice(g, b.x, b.x + b.w * 0.2, top + 20 * s, b.base, s, 96, 10);
    lattice(g, b.x + b.w * 0.8, b.x + b.w, top + 20 * s, b.base, s, 96, 10);
    // Each berth: a trussed arm out to a cradle the ship lies in.
    for (const mi of b.masts) {
      const mm = world.masts.find((q) => q.id === mi);
      if (!mm) continue;
      const sd = mm.side;
      const ax = cx + sd * b.w * 0.5;
      const len = Math.abs(mm.x - ax);
      truss(g, Math.min(ax, mm.x), Math.max(ax, mm.x), mm.y - 4 * s, 6 * s, s, 90);
      g.strokeStyle = V(86);
      g.lineWidth = Math.max(0.5, 1 * s);
      g.beginPath();
      g.moveTo(ax, mm.y + 30 * s);
      g.lineTo(ax + sd * len * 0.7, mm.y + 2 * s);
      g.stroke();
      // The cradle: a hoop of iron, open to the ship.
      g.lineWidth = Math.max(0.6, 1.4 * s);
      g.beginPath();
      g.arc(mm.x, mm.y + 8 * s, 10 * s, Math.PI * 0.6, Math.PI * 2.4);
      g.stroke();
      g.fillStyle = V(140);
      g.fillRect(mm.x - 4 * s, mm.y - 6 * s, 8 * s, 4 * s);
    }
    g.fillStyle = V(130);
    g.fillRect(b.x - 4 * s, top - 6 * s, b.w + 8 * s, 6 * s);
    rail(g, b.x - 4 * s, b.x + b.w + 4 * s, top - 6 * s, s);
    g.strokeStyle = V(90);
    g.lineWidth = Math.max(0.5, 0.9 * s);
    g.beginPath();
    g.moveTo(cx, top - 6 * s);
    g.lineTo(cx, top - 30 * s);
    g.moveTo(cx - 20 * s, top - 26 * s);
    g.lineTo(cx + 30 * s, top - 26 * s);
    g.moveTo(cx, top - 34 * s);
    g.lineTo(cx + 30 * s, top - 26 * s);
    g.moveTo(cx + 26 * s, top - 26 * s);
    g.lineTo(cx + 26 * s, top - 12 * s);
    g.stroke();
  }

  function observatory(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    g.fillStyle = V(124);
    g.fillRect(b.x, top + b.h * 0.3, b.w, b.h * 0.7);
    g.fillStyle = V(98);
    g.fillRect(b.x + b.w * 0.8, top + b.h * 0.3, b.w * 0.2, b.h * 0.7);
    for (let k = 0; k < 4; k++) {
      const wx = b.x + b.w * (0.12 + k * 0.2);
      g.fillStyle = V(58);
      arched(g, wx, top + b.h * 0.45, b.w * 0.08, b.h * 0.3);
      if (R() < litP) {
        lit(wg, R);
        arched(wg, wx, top + b.h * 0.45, b.w * 0.08, b.h * 0.3);
      }
    }
    cornice(g, b.x, top + b.h * 0.3, b.w, s);
    const cx = b.x + b.w / 2;
    const rx = b.w * 0.42;
    g.fillStyle = V(140);
    g.beginPath();
    g.ellipse(cx, top + b.h * 0.3, rx, rx * 0.9, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = V(106);
    g.beginPath();
    g.ellipse(cx, top + b.h * 0.3, rx, rx * 0.9, 0, -Math.PI / 2, 0);
    g.lineTo(cx, top + b.h * 0.3);
    g.fill();
    g.fillStyle = V(50);
    g.save();
    g.translate(cx, top + b.h * 0.3);
    g.rotate(-0.5);
    g.fillRect(-2.5 * s, -rx * 0.92, 5 * s, rx * 0.92);
    g.fillStyle = V(150);
    g.fillRect(-1.6 * s, -rx * 1.25, 3.2 * s, rx * 0.7);
    g.restore();
  }

  function gasholder(g: G, b: Building, s: number) {
    const top = b.base - b.h;
    g.fillStyle = V(112);
    g.fillRect(b.x + 3 * s, top + b.h * 0.25, b.w - 6 * s, b.h * 0.75);
    g.fillStyle = V(94);
    g.fillRect(b.x + b.w * 0.7, top + b.h * 0.25, b.w * 0.3 - 3 * s, b.h * 0.75);
    g.fillStyle = V(138);
    g.beginPath();
    g.ellipse(b.x + b.w / 2, top + b.h * 0.25, b.w / 2 - 3 * s, 4 * s, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = V(86);
    g.lineWidth = Math.max(0.5, 1 * s);
    g.beginPath();
    for (let k = 0; k <= 6; k++) {
      g.moveTo(b.x + (b.w * k) / 6, b.base);
      g.lineTo(b.x + (b.w * k) / 6, top);
    }
    for (let y = top; y < b.base; y += 12 * s) {
      g.moveTo(b.x, y);
      g.lineTo(b.x + b.w, y);
    }
    for (let k = 0; k < 6; k++)
      for (let y = top; y < b.base - 12 * s; y += 24 * s) {
        g.moveTo(b.x + (b.w * k) / 6, y);
        g.lineTo(b.x + (b.w * (k + 1)) / 6, y + 12 * s);
      }
    g.stroke();
  }

  function factory(g: G, wg: G, b: Building, s: number, litP: number, P: Tile) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    const { x, w } = b;
    for (const [cx, cy, cw] of b.chimneys) chimneyStack(g, cx, cy, top + 4 * s, cw, s, true);
    if (R() < 0.45) {
      const [a, c] = [b.chimneys[0], b.chimneys[b.chimneys.length - 1]];
      const py = top - (top - Math.max(a[1], c[1])) * 0.35;
      g.strokeStyle = V(88);
      g.lineWidth = Math.max(0.6, 1.6 * s);
      g.beginPath();
      g.moveTo(a[0], py);
      g.lineTo(c[0], py);
      g.stroke();
    }
    g.fillStyle = V(120);
    g.fillRect(x, top, w, b.h);
    g.fillStyle = V(96);
    g.fillRect(x + w * 0.85, top, w * 0.15, b.h);
    const teeth = Math.max(2, Math.floor(w / (16 * s)));
    const tw = w / teeth;
    for (let k = 0; k < teeth; k++) {
      const tx = x + k * tw;
      g.fillStyle = V(104);
      g.beginPath();
      g.moveTo(tx, top);
      g.lineTo(tx + tw, top - 10 * s);
      g.lineTo(tx + tw, top);
      g.fill();
      g.fillStyle = V(56);
      g.fillRect(tx + tw - 2.4 * s, top - 9 * s, 2.2 * s, 9 * s);
      if (b.foundry || R() < litP) {
        lit(wg, R, b.foundry);
        wg.fillRect(tx + tw - 2.4 * s, top - 9 * s, 2.2 * s, 9 * s);
      }
    }
    const nwin = Math.max(2, Math.floor(w / (11 * s)));
    for (let k = 0; k < nwin; k++) {
      const wx = x + 4 * s + k * ((w - 8 * s) / nwin);
      const ww = ((w - 8 * s) / nwin) * 0.55;
      g.fillStyle = V(56);
      arched(g, wx, top + b.h * 0.2, ww, b.h * 0.55);
      if ((b.foundry && R() < 0.6) || R() < litP) {
        lit(wg, R, b.foundry);
        arched(wg, wx, top + b.h * 0.2, ww, b.h * 0.55);
      }
    }
    if (b.foundry) {
      const gx = x + w * (0.3 + R() * 0.3);
      const gw = w * 0.07;
      const gh = b.h * 0.42;
      g.fillStyle = V(40);
      g.fillRect(gx, b.base - gh, gw, gh);
      P.glows.push([gx, b.base - gh, gw, gh]);
    }
    if (R() < 0.5) {
      // A conveyor gantry climbing to the roof.
      const gx = R() < 0.5 ? x - 30 * s : x + w + 30 * s;
      g.strokeStyle = V(92);
      g.lineWidth = Math.max(0.6, 1.4 * s);
      g.beginPath();
      g.moveTo(gx, b.base);
      g.lineTo(gx < x ? x + 10 * s : x + w - 10 * s, top - 4 * s);
      g.stroke();
      truss(g, Math.min(gx, x + 10 * s), Math.max(gx, x + 10 * s), top + b.h * 0.3, 4 * s, s * 0.6, 100);
    }
    if (R() < 0.35) {
      const cx = x + w * (0.1 + R() * 0.8);
      const ch = b.h + 40 * s;
      g.strokeStyle = V(90);
      g.lineWidth = Math.max(0.5, 0.9 * s);
      g.beginPath();
      g.moveTo(cx - 3 * s, b.base);
      g.lineTo(cx - 1.5 * s, b.base - ch);
      g.moveTo(cx + 3 * s, b.base);
      g.lineTo(cx + 1.5 * s, b.base - ch);
      for (let y = b.base; y > b.base - ch + 6 * s; y -= 6 * s) {
        g.moveTo(cx - 3 * s, y);
        g.lineTo(cx + 3 * s, y - 6 * s);
      }
      g.moveTo(cx - 14 * s, b.base - ch);
      g.lineTo(cx + 40 * s, b.base - ch);
      g.moveTo(cx, b.base - ch - 8 * s);
      g.lineTo(cx + 40 * s, b.base - ch);
      g.moveTo(cx, b.base - ch - 8 * s);
      g.lineTo(cx - 14 * s, b.base - ch);
      g.moveTo(cx + 30 * s, b.base - ch);
      g.lineTo(cx + 30 * s, b.base - ch + 20 * s);
      g.stroke();
    }
  }

  /** A refinery: tanks, a pipe rack, distillation columns, a cooling tower, and the flare stack. */
  function refinery(g: G, wg: G, b: Building, s: number, litP: number, P: Tile) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    const { x, w } = b;
    for (const [cx, cy, cw] of b.chimneys) chimneyStack(g, cx, cy, b.base - b.h * 0.4, cw, s, true);
    // The cooling tower: a waisted shell.
    const ctx0 = x + w * 0.5;
    const cth = b.h * 1.8;
    const cw = w * 0.2;
    g.fillStyle = V(134);
    g.beginPath();
    g.moveTo(ctx0 - cw, b.base);
    g.quadraticCurveTo(ctx0 - cw * 0.45, b.base - cth * 0.6, ctx0 - cw * 0.62, b.base - cth);
    g.lineTo(ctx0 + cw * 0.62, b.base - cth);
    g.quadraticCurveTo(ctx0 + cw * 0.45, b.base - cth * 0.6, ctx0 + cw, b.base);
    g.fill();
    g.fillStyle = V(104);
    g.beginPath();
    g.moveTo(ctx0 + cw * 0.15, b.base);
    g.quadraticCurveTo(ctx0 + cw * 0.15, b.base - cth * 0.6, ctx0 + cw * 0.12, b.base - cth);
    g.lineTo(ctx0 + cw * 0.62, b.base - cth);
    g.quadraticCurveTo(ctx0 + cw * 0.45, b.base - cth * 0.6, ctx0 + cw, b.base);
    g.fill();
    g.strokeStyle = V(110);
    g.lineWidth = Math.max(0.4, 0.6 * s);
    for (let k = 1; k < 6; k++) {
      const yy = b.base - (cth * k) / 6;
      g.beginPath();
      g.moveTo(ctx0 - cw * 0.7, yy);
      g.lineTo(ctx0 + cw * 0.7, yy);
      g.stroke();
    }
    // Tanks, with domed tops and ladders.
    for (let k = 0; k < 3; k++) {
      const tx = x + w * (0.05 + k * 0.13);
      const tw = w * 0.11;
      const th = b.h * (0.6 + R() * 0.4);
      g.fillStyle = V(126);
      g.fillRect(tx, b.base - th, tw, th);
      g.fillStyle = V(100);
      g.fillRect(tx + tw * 0.7, b.base - th, tw * 0.3, th);
      g.fillStyle = V(144);
      g.beginPath();
      g.ellipse(tx + tw / 2, b.base - th, tw / 2, tw * 0.18, 0, Math.PI, 0);
      g.fill();
      g.strokeStyle = V(84);
      g.lineWidth = Math.max(0.3, 0.5 * s);
      g.beginPath();
      for (let yy = b.base - th; yy < b.base; yy += 4 * s) {
        g.moveTo(tx + tw * 0.2, yy);
        g.lineTo(tx + tw * 0.35, yy);
      }
      g.stroke();
    }
    // Distillation columns with their platforms.
    for (let k = 0; k < 2; k++) {
      const px = x + w * (0.7 + k * 0.08);
      const ph = b.h * (1.4 + R() * 0.5);
      g.fillStyle = V(122);
      g.fillRect(px - 3 * s, b.base - ph, 6 * s, ph);
      g.fillStyle = V(150);
      for (let yy = b.base - ph + 8 * s; yy < b.base; yy += 14 * s) {
        g.fillRect(px - 6 * s, yy, 12 * s, 1.2 * s);
        if (R() < litP * 2) {
          wg.fillStyle = '#ffd08a';
          wg.fillRect(px - 5 * s, yy - 1.4 * s, 1.4 * s, 1.4 * s);
        }
      }
    }
    // The pipe rack: a bundle of pipes on frames, all the way along.
    const ry = b.base - b.h * 0.35;
    g.strokeStyle = V(88);
    g.lineWidth = Math.max(0.5, 1.1 * s);
    g.beginPath();
    for (let q = 0; q < 3; q++) {
      g.moveTo(x, ry + q * 2.6 * s);
      g.lineTo(x + w, ry + q * 2.6 * s);
    }
    for (let px = x + 6 * s; px < x + w; px += 18 * s) {
      g.moveTo(px, ry);
      g.lineTo(px, b.base);
    }
    g.stroke();
    // The flare stack.
    if (b.flare) {
      const [fx, fy] = b.flare;
      g.strokeStyle = V(96);
      g.lineWidth = Math.max(0.6, 1.4 * s);
      g.beginPath();
      g.moveTo(fx, b.base);
      g.lineTo(fx, fy);
      g.stroke();
      lattice(g, fx - 3 * s, fx + 3 * s, fy + 10 * s, b.base, s * 0.6, 100, 8);
      P.flares.push([fx, fy]);
    }
    g.fillStyle = V(118);
    g.fillRect(x + w * 0.42, b.base - b.h * 0.3, w * 0.28, b.h * 0.3);
    g.fillStyle = V(56);
    g.fillRect(x + w * 0.46, b.base - b.h * 0.22, w * 0.08, b.h * 0.12);
    void top;
  }

  /** A blast furnace: the furnace, its skip incline, the stoves, the downcomer, the cast house. */
  function blast(g: G, wg: G, b: Building, s: number, P: Tile) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    const { x, w } = b;
    for (const [cx, cy, cw] of b.chimneys) chimneyStack(g, cx, cy, b.base - b.h * 0.3, cw, s, true);
    // The stoves: tall domed cylinders.
    for (let k = 0; k < 3; k++) {
      const sx = x + w * (0.56 + k * 0.1);
      const sh = b.h * 0.75;
      g.fillStyle = V(124);
      g.fillRect(sx, b.base - sh, w * 0.08, sh);
      g.fillStyle = V(100);
      g.fillRect(sx + w * 0.055, b.base - sh, w * 0.025, sh);
      g.fillStyle = V(140);
      g.beginPath();
      g.ellipse(sx + w * 0.04, b.base - sh, w * 0.04, w * 0.04, 0, Math.PI, 0);
      g.fill();
    }
    // The furnace itself: a tapering stack in its iron frame.
    const fx = x + w * 0.3;
    const fw = w * 0.2;
    g.fillStyle = V(116);
    g.beginPath();
    g.moveTo(fx - fw / 2, b.base - b.h * 0.15);
    g.lineTo(fx - fw * 0.32, top + b.h * 0.15);
    g.lineTo(fx + fw * 0.32, top + b.h * 0.15);
    g.lineTo(fx + fw / 2, b.base - b.h * 0.15);
    g.fill();
    g.fillStyle = V(94);
    g.fillRect(fx + fw * 0.1, top + b.h * 0.15, fw * 0.22, b.h * 0.7);
    lattice(g, fx - fw * 0.6, fx + fw * 0.6, top, b.base, s, 92, 10);
    g.fillStyle = V(130);
    g.fillRect(fx - fw * 0.3, top - 6 * s, fw * 0.6, 8 * s);
    // The downcomer: a great bent pipe from the top to the dust catcher.
    g.strokeStyle = V(108);
    g.lineWidth = Math.max(1, 4 * s);
    g.beginPath();
    g.moveTo(fx, top);
    g.quadraticCurveTo(fx - fw, top - 10 * s, fx - fw * 1.3, top + b.h * 0.3);
    g.lineTo(fx - fw * 1.3, b.base - b.h * 0.3);
    g.stroke();
    g.fillStyle = V(120);
    g.fillRect(fx - fw * 1.55, b.base - b.h * 0.35, fw * 0.5, b.h * 0.35);
    // The skip incline, up to the throat.
    g.strokeStyle = V(92);
    g.lineWidth = Math.max(0.6, 1.2 * s);
    g.beginPath();
    g.moveTo(x + w * 0.02, b.base);
    g.lineTo(fx - fw * 0.2, top + 2 * s);
    g.moveTo(x + w * 0.06, b.base);
    g.lineTo(fx - fw * 0.15, top + 6 * s);
    g.stroke();
    // The cast house, where the iron runs.
    g.fillStyle = V(110);
    g.fillRect(x + w * 0.15, b.base - b.h * 0.15, w * 0.4, b.h * 0.15);
    g.fillStyle = V(40);
    const mx = fx - fw * 0.25;
    g.fillRect(mx, b.base - b.h * 0.12, fw * 0.5, b.h * 0.12);
    P.glows.push([mx, b.base - b.h * 0.12, fw * 0.5, b.h * 0.12]);
    for (let k = 0; k < 4; k++) {
      lit(wg, R, true);
      wg.fillRect(x + w * (0.18 + k * 0.08), b.base - b.h * 0.1, w * 0.03, b.h * 0.05);
    }
  }

  function quay(g: G, wg: G, b: Building, s: number, litP: number) {
    const R = mulberry(b.seed);
    const top = b.base - b.h;
    const { x, w } = b;
    g.fillStyle = V(120);
    g.fillRect(x, top, w, b.h);
    g.fillStyle = V(132);
    g.beginPath();
    g.moveTo(x - 1 * s, top);
    g.lineTo(x + w / 2, top - w * 0.3);
    g.lineTo(x + w + 1 * s, top);
    g.fill();
    g.fillStyle = V(96);
    g.beginPath();
    g.moveTo(x + w / 2, top - w * 0.3);
    g.lineTo(x + w + 1 * s, top);
    g.lineTo(x + w / 2, top);
    g.fill();
    const fh = 13 * s;
    for (let y = b.base - fh; y > top; y -= fh) {
      g.fillStyle = V(56);
      g.fillRect(x + w * 0.42, y + fh * 0.15, w * 0.16, fh * 0.8);
      if (R() < litP) {
        lit(wg, R);
        wg.fillRect(x + w * 0.42, y + fh * 0.15, w * 0.16, fh * 0.8);
      }
      for (const wx of [x + w * 0.12, x + w * 0.74]) {
        g.fillStyle = V(60);
        g.fillRect(wx, y + fh * 0.3, w * 0.12, fh * 0.45);
        if (R() < litP) {
          lit(wg, R);
          wg.fillRect(wx, y + fh * 0.3, w * 0.12, fh * 0.45);
        }
      }
    }
    g.fillStyle = V(84);
    g.fillRect(x + w / 2 - 0.6 * s, top - w * 0.26, 1.2 * s, w * 0.26);
    g.fillRect(x + w / 2, top - w * 0.24, 10 * s, 1.4 * s);
  }

  // ---- clock towers: six styles, and the Great Spire the grandest of each ----------------------------
  function clockTower(g: G, wg: G, b: Building, s: number) {
    const ck = b.clock as Clock;
    const R = mulberry(b.seed);
    const great = ck.great;
    const cx = ck.x;
    const cr = ck.r;
    const top = great ? b.base - b.h : ck.top;
    const w = b.w;
    const stageBot = ck.y + cr * 1.5;
    const stageTop = ck.y - cr * 1.5;
    const shaftW = great ? w * 0.66 : w * 0.82;
    const style = ck.style;
    // The base: grand ones get a nave, a palace, setbacks, a fortress or legs.
    if (great) {
      if (style === 'needle' || style === 'twin') nave(g, wg, b, s, cx, w, stageBot + (b.base - stageBot) * 0.45);
      else if (style === 'onion') palace(g, wg, cx, b.base, w * 1.6, (b.base - stageBot) * 0.45, s, R);
      else if (style === 'deco') setbacks(g, wg, cx, b.base, w * 1.3, (b.base - stageBot) * 0.55, s, R);
      else if (style === 'gear') fortress(g, wg, cx, b.base, w * 1.4, (b.base - stageBot) * 0.5, s, R);
    }
    if (style === 'lattice') return latticeTower(g, wg, b, s, ck, top);
    // The shaft, in tiers, up to the clock.
    let ty = great ? b.base - (b.base - stageBot) * (style === 'deco' ? 0.55 : 0.45) : b.base;
    let tw = shaftW;
    const tiers = great ? 3 : 2;
    for (let k = 0; k < tiers; k++) {
      const th = (ty - stageBot) / (tiers - k);
      const tt = ty - th;
      g.fillStyle = V(124);
      g.fillRect(cx - tw / 2, tt, tw, th);
      g.fillStyle = V(98);
      g.fillRect(cx + tw * 0.26, tt, tw * 0.24, th);
      if (style === 'deco') {
        for (let rx = cx - tw / 2 + 2 * s; rx < cx + tw / 2 - 2 * s; rx += 4.5 * s) {
          g.fillStyle = V(152);
          g.fillRect(rx, tt, Math.max(0.5, 0.9 * s), th);
          g.fillStyle = V(56);
          g.fillRect(rx + 1.5 * s, tt + 4 * s, Math.max(0.5, 1.4 * s), th - 8 * s);
          if (R() < 0.3) {
            lit(wg, R);
            wg.fillRect(rx + 1.5 * s, tt + 4 * s, Math.max(0.5, 1.4 * s), th - 8 * s);
          }
        }
      } else {
        for (const sx of [-1, 1]) {
          const bx = cx + (sx * tw) / 2;
          g.fillStyle = V(sx < 0 ? 142 : 92);
          g.fillRect(bx - 2.5 * s, tt + 4 * s, 5 * s, th - 4 * s);
          if (style !== 'gear') pinnacle(g, bx, tt + 4 * s, 5.5 * s, (style === 'onion' ? 10 : 18) * s, 134);
        }
        const cols = Math.max(2, Math.floor(tw / (12 * s)));
        for (let c = 0; c < cols; c++) {
          const wx = cx - tw / 2 + 5 * s + c * ((tw - 10 * s) / cols);
          g.fillStyle = V(54);
          (style === 'onion' ? arched : lancet)(g, wx, tt + th * 0.2, ((tw - 10 * s) / cols) * 0.5, th * 0.62);
          if (R() < 0.4) {
            lit(wg, R);
            (style === 'onion' ? arched : lancet)(wg, wx, tt + th * 0.2, ((tw - 10 * s) / cols) * 0.5, th * 0.62);
          }
        }
      }
      cornice(g, cx - tw / 2, tt, tw, s);
      ty = tt;
      tw *= style === 'gear' ? 0.98 : 0.92;
    }
    // The clock stage.
    const sw = style === 'gear' ? cr * 2.9 : cr * 3;
    g.fillStyle = V(130);
    g.fillRect(cx - sw / 2, stageTop, sw, stageBot - stageTop);
    g.fillStyle = V(100);
    g.fillRect(cx + sw * 0.3, stageTop, sw * 0.2, stageBot - stageTop);
    if (style === 'gear') {
      // A great gear for a face: its teeth, its rim, and the dark behind where the works turn.
      g.fillStyle = V(148);
      const teeth = 28;
      g.beginPath();
      for (let k = 0; k < teeth; k++) {
        const a0 = (k / teeth) * Math.PI * 2;
        const a1 = ((k + 0.5) / teeth) * Math.PI * 2;
        const ro = cr * 1.42;
        const ri = cr * 1.26;
        g.lineTo(ck.x + Math.cos(a0) * ri, ck.y + Math.sin(a0) * ri);
        g.lineTo(ck.x + Math.cos(a0 + 0.03) * ro, ck.y + Math.sin(a0 + 0.03) * ro);
        g.lineTo(ck.x + Math.cos(a1 - 0.03) * ro, ck.y + Math.sin(a1 - 0.03) * ro);
        g.lineTo(ck.x + Math.cos(a1) * ri, ck.y + Math.sin(a1) * ri);
      }
      g.closePath();
      g.fill();
      g.fillStyle = V(104);
      g.beginPath();
      g.arc(ck.x, ck.y, cr * 1.24, 0, Math.PI * 2);
      g.fill();
    } else {
      for (const sx of [-1, 1]) {
        const bx = cx + (sx * sw) / 2;
        g.fillStyle = V(sx < 0 ? 146 : 90);
        g.fillRect(bx - 3.5 * s, stageTop - 6 * s, 7 * s, stageBot - stageTop + 6 * s);
        if (style === 'needle' || style === 'twin') pinnacle(g, bx, stageTop - 6 * s, 7.5 * s, 28 * s, 136);
        else if (style === 'onion') onion(g, bx, stageTop - 6 * s, 12 * s, 16 * s, s);
      }
      g.fillStyle = V(160);
      g.beginPath();
      g.arc(ck.x, ck.y, cr * 1.18, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = V(46);
    g.beginPath();
    g.arc(ck.x, ck.y, cr * 1.04, 0, Math.PI * 2);
    g.fill();
    if (great) {
      // The gallery the automata come out on.
      g.fillStyle = V(150);
      g.fillRect(cx - sw * 0.6, stageBot - 2 * s, sw * 1.2, 2.4 * s);
      rail(g, cx - sw * 0.6, cx + sw * 0.6, stageBot - 2 * s, s);
      g.fillStyle = V(50);
      for (const sx of [-1, 1]) arched(g, cx + sx * sw * 0.42 - 3 * s, stageBot - 14 * s, 6 * s, 12 * s);
    }
    cornice(g, cx - sw / 2, stageTop, sw, s * 1.3);
    // The crown.
    const lw = sw * 0.72;
    if (style === 'needle') {
      const lh = cr * 2.6;
      const lt = stageTop - lh;
      openLantern(g, cx, lt, lw, lh, s);
      spireShape(g, cx, lt, lw * 0.82, lt - top, s * 1.2);
    } else if (style === 'twin') {
      g.fillStyle = V(128);
      g.beginPath();
      g.moveTo(cx - sw / 2, stageTop);
      g.lineTo(cx, stageTop - cr * 2.2);
      g.lineTo(cx + sw / 2, stageTop);
      g.fill();
      for (const sx of [-1, 1]) {
        const tx = cx + sx * (sw / 2 + w * 0.12);
        const tb = stageBot + (b.base - stageBot) * 0.3;
        g.fillStyle = V(126);
        g.fillRect(tx - w * 0.1, tb - (tb - stageTop) - cr, w * 0.2, tb - stageTop + cr);
        g.fillStyle = V(56);
        for (let q = 0; q < 4; q++) lancet(g, tx - w * 0.04, stageTop + q * cr * 1.2, w * 0.08, cr * 0.8);
        spireShape(g, tx, stageTop - cr, w * 0.2, stageTop - cr - top, s);
      }
    } else if (style === 'onion') {
      const dh = cr * 1.6;
      g.fillStyle = V(124);
      g.fillRect(cx - lw / 2, stageTop - dh, lw, dh);
      g.fillStyle = V(54);
      for (let q = 0; q < 3; q++) arched(g, cx - lw * 0.35 + q * lw * 0.27, stageTop - dh * 0.8, lw * 0.14, dh * 0.6);
      const oh = (stageTop - dh - top) * 0.55;
      onion(g, cx, stageTop - dh, lw * 1.25, oh, s * 1.2);
      g.fillStyle = V(122);
      g.fillRect(cx - lw * 0.18, stageTop - dh - oh - 2 * s, lw * 0.36, (stageTop - dh - oh - top) * 0.45);
      onion(g, cx, stageTop - dh - oh - 2 * s + (stageTop - dh - oh - top) * 0.05 - (stageTop - dh - oh - top) * 0.4, lw * 0.5, (stageTop - dh - oh - top) * 0.45, s);
    } else if (style === 'deco') {
      let sy = stageTop;
      let swd = sw;
      for (let k = 0; k < 4; k++) {
        const sh = (stageTop - top) * 0.12;
        g.fillStyle = V(132 - k * 4);
        g.fillRect(cx - swd / 2, sy - sh, swd, sh);
        g.fillStyle = V(160);
        g.fillRect(cx - swd / 2, sy - sh, swd, Math.max(0.5, 0.9 * s));
        for (const sx of [-1, 1]) {
          g.fillStyle = V(144);
          g.beginPath();
          g.moveTo(cx + (sx * swd) / 2, sy);
          g.lineTo(cx + sx * (swd / 2 + 4 * s), sy - sh * 1.4);
          g.lineTo(cx + sx * (swd / 2 - 2 * s), sy - sh);
          g.fill();
        }
        sy -= sh;
        swd *= 0.7;
      }
      g.fillStyle = V(148);
      g.beginPath();
      g.moveTo(cx - swd / 2, sy);
      g.lineTo(cx, top);
      g.lineTo(cx + swd / 2, sy);
      g.fill();
      g.strokeStyle = V(156);
      g.lineWidth = Math.max(0.4, 0.6 * s);
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.28;
        g.beginPath();
        g.moveTo(cx, sy);
        g.lineTo(cx + Math.cos(a) * swd * 1.5, sy + Math.sin(a) * swd * 1.5);
        g.stroke();
      }
    } else if (style === 'gear') {
      g.fillStyle = V(124);
      g.fillRect(cx - sw * 0.55, stageTop - cr * 0.9, sw * 1.1, cr * 0.9);
      for (let x = cx - sw * 0.55; x < cx + sw * 0.55; x += 7 * s) {
        g.fillStyle = V(140);
        g.fillRect(x, stageTop - cr * 0.9 - 5 * s, 4 * s, 5 * s);
      }
      g.fillStyle = V(120);
      g.fillRect(cx - lw * 0.25, stageTop - cr * 0.9 - (stageTop - cr * 0.9 - top) * 0.5, lw * 0.5, (stageTop - cr * 0.9 - top) * 0.5);
      spireShape(g, cx, stageTop - cr * 0.9 - (stageTop - cr * 0.9 - top) * 0.5, lw * 0.55, (stageTop - cr * 0.9 - top) * 0.5, s);
    }
  }
  function openLantern(g: G, cx: number, lt: number, lw: number, lh: number, s: number) {
    g.fillStyle = V(128);
    g.fillRect(cx - lw / 2, lt, lw, lh);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 4; k++) lancet(g, cx - lw / 2 + lw * (0.08 + k * 0.235), lt + lh * 0.18, lw * 0.13, lh * 0.66);
    g.globalCompositeOperation = 'source-over';
    for (const sx of [-1, 1]) pinnacle(g, cx + (sx * lw) / 2, lt, 6 * s, 26 * s, 138);
    cornice(g, cx - lw / 2, lt, lw, s);
  }
  function nave(g: G, wg: G, b: Building, s: number, cx: number, w: number, naveTop: number) {
    const R = mulberry(b.seed + 1);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const px = cx + side * (w * 0.78 + k * w * 0.2);
        const ptop = naveTop + (b.base - naveTop) * (0.08 + k * 0.18);
        g.fillStyle = V(side < 0 ? 136 : 98);
        g.fillRect(px - 3 * s, ptop, 6 * s, b.base - ptop);
        pinnacle(g, px, ptop, 6.5 * s, 22 * s, 134);
        g.strokeStyle = V(side < 0 ? 132 : 100);
        g.lineWidth = Math.max(0.8, 2.6 * s);
        g.beginPath();
        g.moveTo(px, ptop + 14 * s);
        g.quadraticCurveTo(cx + side * w * 0.55, ptop - 6 * s, cx + side * w * 0.42, ptop - 10 * s + k * 4 * s);
        g.stroke();
      }
    }
    g.fillStyle = V(126);
    g.fillRect(cx - w * 0.5, naveTop, w, b.base - naveTop);
    g.fillStyle = V(100);
    g.fillRect(cx + w * 0.26, naveTop, w * 0.24, b.base - naveTop);
    for (let k = 0; k < 5; k++) {
      const wx = cx - w * 0.42 + k * w * 0.18;
      g.fillStyle = V(54);
      lancet(g, wx, naveTop + 30 * s, w * 0.07, (b.base - naveTop) * 0.5);
      wg.fillStyle = '#8a5a2c';
      if (R() < 0.5) lancet(wg, wx, naveTop + 30 * s, w * 0.07, (b.base - naveTop) * 0.5);
    }
    roseWindow(g, wg, cx, naveTop + w * 0.2 + 4 * s, w * 0.2, s);
    cornice(g, cx - w * 0.5, naveTop, w, s);
    for (let px = cx - w * 0.5; px <= cx + w * 0.5; px += 6 * s) pinnacle(g, px, naveTop, 2 * s, 6 * s, 134);
  }
  function palace(g: G, wg: G, cx: number, base: number, w: number, h: number, s: number, R: () => number) {
    const top = base - h;
    g.fillStyle = V(126);
    g.fillRect(cx - w / 2, top, w, h);
    g.fillStyle = V(100);
    g.fillRect(cx + w * 0.3, top, w * 0.2, h);
    for (let x = cx - w / 2 + 4 * s; x < cx + w / 2 - 4 * s; x += 9 * s) {
      for (let y = top + 8 * s; y < base - 8 * s; y += 16 * s) {
        g.fillStyle = V(56);
        arched(g, x, y, 4 * s, 9 * s);
        if (R() < 0.3) {
          lit(wg, R);
          arched(wg, x, y, 4 * s, 9 * s);
        }
      }
    }
    cornice(g, cx - w / 2, top, w, s);
    for (const sx of [-0.42, -0.2, 0.2, 0.42]) {
      const tx = cx + sx * w;
      g.fillStyle = V(122);
      g.fillRect(tx - 5 * s, top - 18 * s, 10 * s, 18 * s);
      onion(g, tx, top - 18 * s, 14 * s, 20 * s, s);
    }
  }
  function setbacks(g: G, wg: G, cx: number, base: number, w: number, h: number, s: number, R: () => number) {
    let y = base;
    let ww = w;
    for (let k = 0; k < 3; k++) {
      const th = h / 3;
      g.fillStyle = V(124);
      g.fillRect(cx - ww / 2, y - th, ww, th);
      for (let rx = cx - ww / 2 + 2 * s; rx < cx + ww / 2 - 2 * s; rx += 5 * s) {
        g.fillStyle = V(150);
        g.fillRect(rx, y - th, Math.max(0.5, 0.9 * s), th);
        if (R() < 0.25) {
          lit(wg, R);
          wg.fillRect(rx + 1.6 * s, y - th + 4 * s, 1.4 * s, th - 8 * s);
        }
      }
      g.fillStyle = V(98);
      g.fillRect(cx + ww * 0.3, y - th, ww * 0.2, th);
      g.fillStyle = V(164);
      g.fillRect(cx - ww / 2, y - th, ww, Math.max(0.6, 1.4 * s));
      y -= th;
      ww *= 0.82;
    }
  }
  function fortress(g: G, wg: G, cx: number, base: number, w: number, h: number, s: number, R: () => number) {
    const top = base - h;
    g.fillStyle = V(120);
    g.fillRect(cx - w / 2, top, w, h);
    g.fillStyle = V(96);
    g.fillRect(cx + w * 0.28, top, w * 0.22, h);
    for (let x = cx - w / 2; x < cx + w / 2; x += 8 * s) {
      g.fillStyle = V(140);
      g.fillRect(x, top - 6 * s, 5 * s, 6 * s);
    }
    for (const sx of [-0.5, 0.5]) {
      const tx = cx + sx * w;
      g.fillStyle = V(130);
      g.beginPath();
      g.moveTo(tx - 12 * s, base);
      g.lineTo(tx - 9 * s, top - 30 * s);
      g.lineTo(tx + 9 * s, top - 30 * s);
      g.lineTo(tx + 12 * s, base);
      g.fill();
      for (let x = tx - 9 * s; x < tx + 9 * s; x += 5 * s) {
        g.fillStyle = V(144);
        g.fillRect(x, top - 34 * s, 3 * s, 4 * s);
      }
    }
    for (let y = top + 10 * s; y < base - 10 * s; y += 18 * s)
      for (let x = cx - w / 2 + 10 * s; x < cx + w / 2 - 10 * s; x += 14 * s) {
        g.fillStyle = V(56);
        g.fillRect(x, y, 2.6 * s, 8 * s);
        if (R() < 0.3) {
          lit(wg, R);
          wg.fillRect(x, y, 2.6 * s, 8 * s);
        }
      }
  }
  /** An iron lattice tower: four legs on arches, its platforms, the clock in a ring at the middle. */
  function latticeTower(g: G, wg: G, b: Building, s: number, ck: Clock, top: number) {
    const cx = ck.x;
    const wB = b.w * (ck.great ? 1.6 : 1.1);
    const at = (y: number) => {
      const k = (b.base - y) / (b.base - top);
      return wB * Math.pow(1 - k, 1.6) * 0.5 + 2 * s;
    };
    g.strokeStyle = V(100);
    g.lineWidth = Math.max(0.8, 2.4 * s);
    g.beginPath();
    for (const sd of [-1, 1]) {
      g.moveTo(cx + sd * at(b.base), b.base);
      for (let y = b.base; y > top; y -= 6 * s) g.lineTo(cx + sd * at(y), y);
    }
    g.stroke();
    g.lineWidth = Math.max(0.4, 0.8 * s);
    g.beginPath();
    for (let y = b.base; y > top + 8 * s; y -= 10 * s) {
      const a = at(y);
      const c = at(y - 10 * s);
      g.moveTo(cx - a, y);
      g.lineTo(cx + c, y - 10 * s);
      g.moveTo(cx + a, y);
      g.lineTo(cx - c, y - 10 * s);
    }
    g.stroke();
    // The great arch between the legs.
    const ay = b.base - (b.base - top) * 0.12;
    g.lineWidth = Math.max(0.8, 2 * s);
    g.beginPath();
    g.moveTo(cx - at(b.base) * 0.85, b.base);
    g.quadraticCurveTo(cx, ay - (b.base - ay) * 0.6, cx + at(b.base) * 0.85, b.base);
    g.stroke();
    for (const fy of [0.12, 0.3, 0.62]) {
      const y = b.base - (b.base - top) * fy;
      const a = at(y);
      g.fillStyle = V(130);
      g.fillRect(cx - a - 6 * s, y - 4 * s, a * 2 + 12 * s, 6 * s);
      g.fillStyle = V(58);
      for (let x = cx - a - 4 * s; x < cx + a + 4 * s; x += 5 * s) g.fillRect(x, y - 2.6 * s, 2.4 * s, 2.6 * s);
      wg.fillStyle = '#ffcf8a';
      wg.fillRect(cx - a - 4 * s, y - 2.6 * s, a * 2 + 8 * s, 2.6 * s);
      rail(g, cx - a - 6 * s, cx + a + 6 * s, y - 4 * s, s);
    }
    g.strokeStyle = V(150);
    g.lineWidth = Math.max(0.8, cr2(ck) * 0.18);
    g.beginPath();
    g.arc(ck.x, ck.y, ck.r * 1.15, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = V(46);
    g.beginPath();
    g.arc(ck.x, ck.y, ck.r * 1.04, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = V(150);
    g.fillRect(cx - 0.5 * s, top - 30 * s, Math.max(0.5, 1 * s), 30 * s);
  }
  const cr2 = (ck: Clock) => ck.r;

  // ---- the city's connections -------------------------------------------------------------------------
  function bridges(g: G, wg: G, list: Chunk['bridges'], s: number, P: Tile) {
    for (const [x0, x1, y, kind] of list) {
      const span = x1 - x0;
      if (kind === 'covered') {
        // A glazed gallery with a pitched roof, lit from inside.
        const gh = 11 * s;
        g.fillStyle = V(118);
        g.fillRect(x0, y - gh, span, gh + 3 * s);
        g.fillStyle = V(138);
        g.beginPath();
        g.moveTo(x0 - 2 * s, y - gh);
        g.lineTo(x0 + span * 0.02, y - gh - 5 * s);
        g.lineTo(x1 - span * 0.02, y - gh - 5 * s);
        g.lineTo(x1 + 2 * s, y - gh);
        g.fill();
        for (let x = x0 + 3 * s; x < x1 - 4 * s; x += 6 * s) {
          g.fillStyle = V(58);
          arched(g, x, y - gh + 2 * s, 3.6 * s, gh - 4 * s);
          wg.fillStyle = '#ffcf8a';
          if ((x * 7) % 5 < 3.4) arched(wg, x, y - gh + 2 * s, 3.6 * s, gh - 4 * s);
        }
        g.strokeStyle = V(96);
        g.lineWidth = Math.max(0.5, 0.9 * s);
        g.beginPath();
        g.moveTo(x0, y + 3 * s);
        g.quadraticCurveTo((x0 + x1) / 2, y + 3 * s + span * 0.1, x1, y + 3 * s);
        for (let x = x0 + span * 0.1; x < x1; x += span * 0.1) {
          const dy = Math.sin(((x - x0) / span) * Math.PI) * span * 0.05;
          g.moveTo(x, y + 3 * s);
          g.lineTo(x, y + 3 * s + dy);
        }
        g.stroke();
      } else if (kind === 'truss') {
        g.fillStyle = V(118);
        g.fillRect(x0, y, span, 4 * s);
        g.fillStyle = V(156);
        g.fillRect(x0, y, span, Math.max(0.5, 0.8 * s));
        truss(g, x0, x1, y - 9 * s, 9 * s, s, 92);
        rail(g, x0, x1, y, s * 0.8);
      } else {
        // A stone arch, a little bridge of the old town hung between towers.
        g.fillStyle = V(126);
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        g.lineTo(x1, y + 8 * s);
        g.quadraticCurveTo((x0 + x1) / 2, y + 8 * s - span * 0.0 + span * 0.02, x0, y + 8 * s);
        g.lineTo(x0, y);
        g.fill();
        g.fillStyle = V(126);
        g.beginPath();
        g.moveTo(x0, y + 6 * s);
        g.quadraticCurveTo((x0 + x1) / 2, y + 6 * s + span * 0.12, x1, y + 6 * s);
        g.lineTo(x1, y + 14 * s + span * 0.04);
        g.quadraticCurveTo((x0 + x1) / 2, y + 14 * s + span * 0.2, x0, y + 14 * s + span * 0.04);
        g.fill();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        g.moveTo(x0 + 4 * s, y + 14 * s + span * 0.04);
        g.quadraticCurveTo((x0 + x1) / 2, y + 8 * s, x1 - 4 * s, y + 14 * s + span * 0.04);
        g.lineTo(x1 - 4 * s, y + 40 * s + span * 0.2);
        g.lineTo(x0 + 4 * s, y + 40 * s + span * 0.2);
        g.fill();
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = V(150);
        g.fillRect(x0, y - 3 * s, span, 3 * s);
        for (let x = x0; x < x1; x += 5 * s) g.fillRect(x, y - 6 * s, 2.4 * s, 3 * s);
      }
      P.lamps.push([(x0 + x1) / 2, y - 8 * s]);
    }
  }
  function walkways(g: G, list: Chunk['walkways'], s: number, P: Tile) {
    for (const [x0, x1, y] of list) {
      g.fillStyle = V(118);
      g.fillRect(x0, y, x1 - x0, 2.4 * s);
      g.fillStyle = V(150);
      g.fillRect(x0, y, x1 - x0, Math.max(0.4, 0.6 * s));
      rail(g, x0, x1, y, s * 0.9);
      g.strokeStyle = V(84);
      g.lineWidth = Math.max(0.4, 0.7 * s);
      g.beginPath();
      for (let x = x0 + 6 * s; x < x1; x += 22 * s) {
        g.moveTo(x, y + 2.4 * s);
        g.lineTo(x + 7 * s, y + 10 * s);
      }
      // A stair down from one end.
      const sx = x0 + 3 * s;
      for (let k = 0; k < 6; k++) {
        g.moveTo(sx - k * 2.4 * s, y + k * 3 * s);
        g.lineTo(sx - k * 2.4 * s - 2.4 * s, y + k * 3 * s);
      }
      g.stroke();
      P.lamps.push([x1 - 4 * s, y - 6 * s]);
    }
  }
  function viaduct(g: G, L: Layer, s: number, P: Tile, tx0: number, tx1: number) {
    if (L.viaduct === null) return;
    const y = L.viaduct;
    const span = 46 * s;
    const pw = 7 * s;
    const bottom = L.base + 40 * u;
    for (let x0 = Math.floor(tx0 / span) * span - span; x0 < tx1 + span; x0 += span) {
      g.fillStyle = V(116);
      g.fillRect(x0 - pw / 2, y + 6 * s, pw, bottom - y);
      g.fillStyle = V(92);
      g.fillRect(x0 + pw * 0.1, y + 6 * s, pw * 0.4, bottom - y);
      const ar = (span - pw) / 2;
      const ys = y + 6 * s + ar + 5 * s;
      g.fillStyle = V(120);
      g.beginPath();
      g.moveTo(x0 + pw / 2, y + 6 * s);
      g.lineTo(x0 + span - pw / 2, y + 6 * s);
      g.lineTo(x0 + span - pw / 2, ys);
      g.arc(x0 + span / 2, ys, ar, 0, Math.PI, true);
      g.closePath();
      g.fill();
      g.strokeStyle = V(152);
      g.lineWidth = Math.max(0.4, 0.8 * s);
      g.beginPath();
      g.arc(x0 + span / 2, ys, ar, Math.PI, Math.PI * 1.5);
      g.stroke();
    }
    g.fillStyle = V(128);
    g.fillRect(tx0 - 20, y, tx1 - tx0 + 40, 6 * s);
    g.fillStyle = V(160);
    g.fillRect(tx0 - 20, y, tx1 - tx0 + 40, Math.max(0.6, 1.1 * s));
    g.fillStyle = V(84);
    g.fillRect(tx0 - 20, y + 5 * s, tx1 - tx0 + 40, Math.max(0.5, 1 * s));
    g.strokeStyle = V(96);
    g.lineWidth = Math.max(0.4, 0.5 * s);
    g.beginPath();
    const post = span * 0.5;
    for (let x = Math.floor(tx0 / post) * post; x < tx1 + post; x += post) {
      g.moveTo(x, y);
      g.lineTo(x, y - 14 * s);
    }
    g.moveTo(tx0 - 20, y - 12 * s);
    g.lineTo(tx1 + 20, y - 12 * s);
    g.stroke();
    for (let x = Math.ceil(tx0 / (span * 3)) * span * 3; x < tx1; x += span * 3) P.lamps.push([x, y - 5 * s]);
  }
  function cables(g: G, list: Chunk['cables'], s: number) {
    g.strokeStyle = V(70);
    g.lineWidth = Math.max(0.5, 0.7 * s);
    for (const [ax, ay, bx, by] of list) {
      for (const d of [0, 3 * s]) {
        g.beginPath();
        g.moveTo(ax, ay + d);
        g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + Math.abs(bx - ax) * 0.08 + d, bx, by + d);
        g.stroke();
      }
    }
  }
  function cliffs(g: G, list: Chunk['cliffs'], s: number, P: Tile) {
    for (const [x0, x1, top] of list) {
      const R = mulberry(Math.round(x0 * 7 + top));
      g.fillStyle = V(104);
      g.beginPath();
      g.moveTo(x0 - 10 * s, GH);
      for (let k = 0; k <= 8; k++) g.lineTo(x0 + (R() - 0.3) * 18 * s - k * 2 * s, top + ((GH - top) * k) / 8 + (R() - 0.5) * 10 * s);
      g.lineTo(x0, top);
      for (let x = x0; x <= x1; x += 8 * s) g.lineTo(x, top + (R() - 0.5) * 2 * s);
      g.lineTo(x1, top);
      for (let k = 8; k >= 0; k--) g.lineTo(x1 + (R() - 0.3) * 18 * s + k * 2 * s, top + ((GH - top) * k) / 8 + (R() - 0.5) * 10 * s);
      g.lineTo(x1 + 10 * s, GH);
      g.closePath();
      g.fill();
      g.strokeStyle = V(126);
      g.lineWidth = Math.max(0.5, 1 * s);
      for (let k = 0; k < 14; k++) {
        const y = top + 10 * s + R() * (GH - top) * 0.7;
        const x = x0 + R() * (x1 - x0);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (20 + R() * 60) * s, y + (R() - 0.5) * 4 * s);
        g.stroke();
      }
      g.strokeStyle = V(70);
      for (let k = 0; k < 10; k++) {
        const x = x0 + R() * (x1 - x0);
        const y = top + R() * (GH - top) * 0.5;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (R() - 0.5) * 10 * s, y + 14 * s + R() * 30 * s);
        g.stroke();
      }
      if (R() < 0.6) P.falls.push([R() < 0.5 ? x0 + 4 * s : x1 - 4 * s, top + 3 * s, (GH - top) * 0.6]);
    }
  }

  /** Under the deck of a tiered city: the far wall and its galleries (continuous along the city). */
  function underWall(g: G, tx0: number, tx1: number) {
    const s = u * 0.9;
    const deck = world.layers[3].base;
    const floor = GH;
    g.fillStyle = V(62);
    g.fillRect(tx0 - 20, deck, tx1 - tx0 + 40, floor - deck);
    const step = 18 * s;
    for (let y = deck + 30 * s; y < floor - 20 * s; y += 28 * s) {
      g.fillStyle = V(78);
      g.fillRect(tx0 - 20, y, tx1 - tx0 + 40, 2 * s);
      g.fillStyle = V(70);
      for (let x = Math.floor(tx0 / step) * step + ((y * 3) % step); x < tx1 + step; x += step) g.fillRect(x, y - 20 * s, 2.4 * s, 20 * s);
    }
  }
  /** One chunk's undercity: shacks, pipes, the piers holding up the deck, catwalks, lifts, furnaces. */
  function underChunk(g: G, wg: G, ch: Chunk, P: Tile) {
    const part: UnderPart | null = ch.under;
    if (!part) return;
    const s = u * 0.9;
    const R = mulberry(ch.k * 7919 + 13);
    const deck = world.layers[3].base;
    const floor = GH;
    const cw = ch.x1 - ch.x0;
    for (let k = 0; k < 350; k++) {
      const x = ch.x0 + R() * cw;
      const y = deck + 20 * s + R() * (floor - deck - 30 * s);
      g.fillStyle = V(60);
      g.fillRect(x, y, 2.4 * s, 3.4 * s);
      if (R() < 0.45) {
        lit(wg, R);
        wg.fillRect(x, y, 2.4 * s, 3.4 * s);
      }
    }
    for (let k = 0; k < 45; k++) {
      const x = ch.x0 + R() * cw;
      const w = (14 + R() * 26) * s;
      const h = (10 + R() * 16) * s;
      const y = deck + (floor - deck) * (0.2 + R() * 0.7);
      g.fillStyle = V(110 + Math.floor(R() * 34));
      g.fillRect(x, y - h, w, h);
      g.fillStyle = V(84);
      g.beginPath();
      g.moveTo(x - 2 * s, y - h);
      g.lineTo(x + w * (0.3 + R() * 0.4), y - h - 5 * s);
      g.lineTo(x + w + 2 * s, y - h);
      g.fill();
      g.fillStyle = V(56);
      g.fillRect(x + w * 0.3, y - h * 0.7, w * 0.3, h * 0.35);
      if (R() < 0.6) {
        lit(wg, R);
        wg.fillRect(x + w * 0.3, y - h * 0.7, w * 0.3, h * 0.35);
      }
    }
    g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const y = deck + (floor - deck) * (0.1 + R() * 0.8);
      const x0 = ch.x0 + R() * cw * 0.6;
      const x1 = x0 + cw * (0.3 + R() * 0.6);
      const rr = (2 + R() * 4) * s;
      const drop = (R() - 0.3) * 60 * s;
      g.strokeStyle = V(70);
      g.lineWidth = rr * 2 + 1.4 * s;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.lineTo(x1, y + drop);
      g.stroke();
      g.strokeStyle = V(122);
      g.lineWidth = rr * 2;
      g.stroke();
      g.strokeStyle = V(150);
      g.lineWidth = rr * 0.5;
      g.beginPath();
      g.moveTo(x0, y - rr * 0.5);
      g.lineTo(x1, y - rr * 0.5);
      g.stroke();
      g.fillStyle = V(96);
      for (let x = x0 + 20 * s; x < x1; x += 50 * s) g.fillRect(x - rr * 1.3, y - rr * 1.3, rr * 2.6, rr * 2.6);
    }
    g.lineCap = 'butt';
    for (const [ax, hw] of part.arches) {
      g.fillStyle = V(128);
      g.beginPath();
      g.moveTo(ax - hw * 1.6, floor);
      g.lineTo(ax - hw, deck + 30 * s);
      g.quadraticCurveTo(ax, deck + 10 * s, ax + hw, deck + 30 * s);
      g.lineTo(ax + hw * 1.6, floor);
      g.fill();
      g.fillStyle = V(92);
      g.fillRect(ax + hw * 0.2, deck + 20 * s, hw * 0.6, floor - deck);
      g.fillStyle = V(150);
      for (let y = deck + 40 * s; y < floor; y += 26 * s) g.fillRect(ax - hw * 1.2, y, hw * 2.4, 1.4 * s);
      g.strokeStyle = V(104);
      g.lineWidth = Math.max(0.8, 3 * s);
      for (const sd of [-1, 1]) {
        g.beginPath();
        g.moveTo(ax + sd * hw, deck + 40 * s);
        g.quadraticCurveTo(ax + sd * hw * 3, deck + 8 * s, ax + sd * hw * 5, deck + 4 * s);
        g.stroke();
      }
    }
    for (const [x0, x1, y] of part.catwalks) {
      g.fillStyle = V(118);
      g.fillRect(x0, y, x1 - x0, 2.6 * s);
      rail(g, x0, x1, y, s);
      g.strokeStyle = V(80);
      g.lineWidth = Math.max(0.4, 0.6 * s);
      g.beginPath();
      for (let x = x0 + 10 * s; x < x1; x += 40 * s) {
        g.moveTo(x, y);
        g.lineTo(x, deck);
      }
      g.stroke();
      P.lamps.push([(x0 + x1) / 2, y - 7 * s]);
    }
    for (const [lx, y0, y1] of part.lifts) {
      lattice(g, lx - 6 * s, lx + 6 * s, y0, y1, s, 96, 8);
      P.lifts.push([lx, y0, y1]);
    }
    for (const [fx, fy, fw, fh] of part.furnaces) {
      g.fillStyle = V(108);
      g.beginPath();
      g.moveTo(fx - fw * 0.6, floor);
      g.lineTo(fx - fw * 0.5, fy);
      g.quadraticCurveTo(fx, fy - fh * 0.6, fx + fw * 0.5, fy);
      g.lineTo(fx + fw * 0.6, floor);
      g.fill();
      g.fillStyle = V(40);
      g.fillRect(fx - fw * 0.2, fy + fh * 0.2, fw * 0.4, floor - fy - fh * 0.2);
      P.glows.push([fx - fw * 0.2, fy + fh * 0.2, fw * 0.4, Math.min(fh, floor - fy - fh * 0.2)]);
      chimneyStack(g, fx, fy - fh * 1.6, fy, fw * 0.16, s, true);
    }
  }
  /** The deck's underside: girders and rivets, everything hanging from it. */
  function underDeck(g: G, tx0: number, tx1: number) {
    const s = u * 0.9;
    const deck = world.layers[3].base;
    g.fillStyle = V(112);
    g.fillRect(tx0 - 20, deck - 4 * s, tx1 - tx0 + 40, 22 * s);
    g.fillStyle = V(156);
    g.fillRect(tx0 - 20, deck - 4 * s, tx1 - tx0 + 40, 2 * s);
    g.fillStyle = V(84);
    g.fillRect(tx0 - 20, deck + 16 * s, tx1 - tx0 + 40, 2 * s);
    g.fillStyle = V(80);
    const step = 24 * s;
    for (let x = Math.floor(tx0 / step) * step; x < tx1 + step; x += step) {
      g.fillRect(x, deck + 12 * s, 4 * s, 10 * s);
      g.fillRect(x - 6 * s, deck + 20 * s, 16 * s, 2 * s);
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = Math.floor(tx0 / (6 * s)) * 6 * s + 4 * s; x < tx1; x += 6 * s) g.fillRect(x, deck + 5 * s, 0.8 * s, 0.8 * s);
    g.fillStyle = V(52);
    g.fillRect(tx0 - 20, GH - 4 * s, tx1 - tx0 + 40, 8 * s);
  }

  /** The place we watch from: a balustrade, a station's iron, a bridge, or a gantry over the undercity. */
  function frame(g: G, wg: G, P: Tile) {
    const s = u * 1.2;
    /** A step that goes into the width a whole number of times. */
    const even = (step: number) => GW / Math.max(1, Math.round(GW / step));
    const side = world.side;
    const lamp = (x: number, y: number, h: number) => {
      g.fillStyle = V(110);
      g.fillRect(x - 3 * s, y - 8 * s, 6 * s, 8 * s);
      g.fillRect(x - 1.6 * s, y - h, 3.2 * s, h);
      g.fillStyle = V(140);
      for (let k = 1; k < 4; k++) g.fillRect(x - 2.2 * s, y - (h * k) / 4, 4.4 * s, 1.2 * s);
      g.strokeStyle = V(110);
      g.lineWidth = 1.2 * s;
      g.beginPath();
      g.moveTo(x, y - h);
      g.quadraticCurveTo(x + 10 * s, y - h - 6 * s, x + 14 * s, y - h + 2 * s);
      g.moveTo(x, y - h);
      g.quadraticCurveTo(x - 10 * s, y - h - 6 * s, x - 14 * s, y - h + 2 * s);
      g.stroke();
      for (const lx of [x - 14 * s, x + 14 * s, x]) {
        const ly = lx === x ? y - h - 4 * s : y - h + 2 * s;
        g.fillStyle = V(96);
        g.beginPath();
        g.moveTo(lx - 4 * s, ly);
        g.lineTo(lx + 4 * s, ly);
        g.lineTo(lx + 3 * s, ly + 9 * s);
        g.lineTo(lx - 3 * s, ly + 9 * s);
        g.fill();
        g.fillStyle = V(60);
        g.fillRect(lx - 2.4 * s, ly + 1.2 * s, 4.8 * s, 6.6 * s);
        wg.fillStyle = '#ffd08a';
        wg.fillRect(lx - 2.4 * s, ly + 1.2 * s, 4.8 * s, 6.6 * s);
        g.fillStyle = V(110);
        g.beginPath();
        g.moveTo(lx - 5 * s, ly);
        g.lineTo(lx, ly - 5 * s);
        g.lineTo(lx + 5 * s, ly);
        g.fill();
        P.lamps.push([lx, ly + 4 * s]);
      }
    };
    const column = (cx: number, from: number) => {
      g.fillStyle = V(112);
      g.fillRect(cx - 22 * s, from, 44 * s, GH + 40 - from);
      g.fillStyle = V(94);
      g.fillRect(cx + 6 * s, from, 16 * s, GH + 40 - from);
      g.fillStyle = V(150);
      for (let yy = from + 40 * s; yy < GH; yy += 120 * s) {
        g.fillRect(cx - 26 * s, yy, 52 * s, 5 * s);
        for (let k = -2; k <= 2; k++) g.fillRect(cx + k * 8 * s - 0.8 * s, yy + 8 * s, 1.6 * s, 1.6 * s);
      }
    };
    if (world.frame === 'balcony') {
      const y = GH * 0.93;
      g.fillStyle = V(116);
      g.fillRect(-GW * 0.2, y + 44 * s, GW * 1.4, GH);
      g.fillStyle = V(140);
      g.fillRect(-GW * 0.2, y + 40 * s, GW * 1.4, 5 * s);
      for (let x = 0; x < GW + 20 * s; x += even(15 * s)) {
        g.fillStyle = V(122);
        g.beginPath();
        g.moveTo(x - 2.4 * s, y + 40 * s);
        g.quadraticCurveTo(x - 6 * s, y + 28 * s, x - 2 * s, y + 20 * s);
        g.quadraticCurveTo(x - 4.5 * s, y + 13 * s, x - 2 * s, y + 7 * s);
        g.lineTo(x + 2 * s, y + 7 * s);
        g.quadraticCurveTo(x + 4.5 * s, y + 13 * s, x + 2 * s, y + 20 * s);
        g.quadraticCurveTo(x + 6 * s, y + 28 * s, x + 2.4 * s, y + 40 * s);
        g.fill();
        g.fillStyle = V(98);
        g.fillRect(x + 0.6 * s, y + 8 * s, 1.6 * s, 32 * s);
      }
      g.fillStyle = V(132);
      g.fillRect(-GW * 0.2, y, GW * 1.4, 8 * s);
      g.fillStyle = V(170);
      g.fillRect(-GW * 0.2, y, GW * 1.4, 1.6 * s);
      g.fillStyle = V(92);
      g.fillRect(-GW * 0.2, y + 7 * s, GW * 1.4, 1.4 * s);
      for (const fx of [0.12, 0.88]) lamp(GW * fx, y, 120 * s);
      const tx = side > 0 ? GW * 0.24 : GW * 0.76;
      g.strokeStyle = V(96);
      g.lineWidth = 1.8 * s;
      g.beginPath();
      g.moveTo(tx, y - 30 * s);
      g.lineTo(tx - 12 * s, y);
      g.moveTo(tx, y - 30 * s);
      g.lineTo(tx + 12 * s, y);
      g.moveTo(tx, y - 30 * s);
      g.lineTo(tx, y);
      g.stroke();
      g.save();
      g.translate(tx, y - 32 * s);
      g.rotate(side > 0 ? -0.38 : Math.PI + 0.38);
      g.fillStyle = V(140);
      g.fillRect(-14 * s, -3.4 * s, 50 * s, 6.8 * s);
      g.fillStyle = V(170);
      g.fillRect(-14 * s, -3.4 * s, 50 * s, 1.6 * s);
      g.fillStyle = V(110);
      g.fillRect(30 * s, -4.6 * s, 6 * s, 9.2 * s);
      g.restore();
      const cx = side > 0 ? GW * 0.985 : GW * 0.015;
      column(cx, -20);
      g.strokeStyle = V(112);
      g.lineWidth = 3 * s;
      g.beginPath();
      g.moveTo(cx, GH * 0.3);
      g.lineTo(cx - side * 70 * s, GH * 0.3);
      g.moveTo(cx, GH * 0.3 + 30 * s);
      g.quadraticCurveTo(cx - side * 40 * s, GH * 0.3 + 26 * s, cx - side * 60 * s, GH * 0.3);
      g.stroke();
      g.lineWidth = 1 * s;
      g.beginPath();
      g.moveTo(cx - side * 64 * s, GH * 0.3);
      g.lineTo(cx - side * 64 * s, GH * 0.3 + 22 * s);
      g.stroke();
      lampHanging(g, wg, P, cx - side * 64 * s, GH * 0.3 + 22 * s, s);
    } else if (world.frame === 'station') {
      const ry = GH * 0.07;
      g.fillStyle = V(108);
      g.fillRect(-GW * 0.2, -20, GW * 1.4, ry + 20);
      g.fillStyle = V(140);
      g.fillRect(-GW * 0.2, ry - 4 * s, GW * 1.4, 4 * s);
      for (let x = 0; x < GW + 20; x += even(12 * s)) {
        g.fillStyle = V(108);
        g.beginPath();
        g.moveTo(x, ry);
        g.lineTo(x + 6 * s, ry + 14 * s);
        g.lineTo(x + 12 * s, ry);
        g.fill();
        g.fillStyle = V(60);
        g.beginPath();
        g.arc(x + 6 * s, ry + 5 * s, 1.8 * s, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = V(150);
      g.lineWidth = 0.8 * s;
      for (let x = 0; x < GW; x += even(40 * s)) {
        g.beginPath();
        g.moveTo(x, -20);
        g.lineTo(x + 20 * s, ry - 4 * s);
        g.stroke();
      }
      for (const cx of [GW * 0.03, GW * 0.97]) {
        g.fillStyle = V(116);
        g.fillRect(cx - 14 * s, ry, 28 * s, GH);
        g.fillStyle = V(94);
        g.fillRect(cx + 4 * s, ry, 10 * s, GH);
        g.fillStyle = V(150);
        g.fillRect(cx - 20 * s, ry + 4 * s, 40 * s, 8 * s);
        const dir = cx < GW / 2 ? 1 : -1;
        g.strokeStyle = V(116);
        g.lineWidth = 2.4 * s;
        g.beginPath();
        g.moveTo(cx, ry + 120 * s);
        g.quadraticCurveTo(cx + dir * 10 * s, ry + 20 * s, cx + dir * 120 * s, ry + 4 * s);
        g.stroke();
        g.lineWidth = 1.2 * s;
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.arc(cx + dir * (24 + k * 22) * s, ry + (40 - k * 8) * s, (10 - k * 1.5) * s, 0, Math.PI * 2);
          g.stroke();
        }
      }
      for (const fx of [0.3, 0.7]) {
        const hx = GW * fx;
        g.strokeStyle = V(100);
        g.lineWidth = 1 * s;
        g.beginPath();
        g.moveTo(hx, ry);
        g.lineTo(hx, ry + 50 * s);
        g.stroke();
        lampHanging(g, wg, P, hx, ry + 50 * s, s);
      }
      const y = GH * 0.94;
      g.fillStyle = V(118);
      g.fillRect(-GW * 0.2, y + 30 * s, GW * 1.4, GH);
      g.fillStyle = V(138);
      g.fillRect(-GW * 0.2, y, GW * 1.4, 4 * s);
      g.fillRect(-GW * 0.2, y + 26 * s, GW * 1.4, 4 * s);
      g.strokeStyle = V(118);
      g.lineWidth = 1.4 * s;
      for (let x = 0; x < GW + 20; x += even(22 * s)) {
        g.beginPath();
        g.moveTo(x, y + 4 * s);
        g.lineTo(x, y + 26 * s);
        g.stroke();
        g.beginPath();
        g.arc(x + 11 * s, y + 10 * s, 5 * s, Math.PI * 0.5, Math.PI * 2.2);
        g.stroke();
        g.beginPath();
        g.arc(x + 11 * s, y + 20 * s, 5 * s, -Math.PI * 0.5, Math.PI * 1.2);
        g.stroke();
      }
    } else if (world.frame === 'bridge') {
      const y = GH * 0.92;
      g.fillStyle = V(112);
      g.fillRect(-GW * 0.2, y, GW * 1.4, GH);
      g.fillStyle = V(150);
      g.fillRect(-GW * 0.2, y, GW * 1.4, 2 * s);
      g.strokeStyle = V(116);
      g.lineWidth = 5 * s;
      const span = GW / 2;
      for (let x0 = 0; x0 < GW; x0 += span) {
        const arch = (x: number) => y - Math.sin(((x - x0) / span) * Math.PI) * GH * 0.12;
        g.beginPath();
        g.moveTo(x0, arch(x0));
        for (let x = x0; x <= x0 + span; x += 8) g.lineTo(x, arch(x));
        g.stroke();
        g.lineWidth = 1.6 * s;
        g.beginPath();
        const bay = span / Math.max(1, Math.round(span / (20 * s)));
        for (let x = x0 + bay; x < x0 + span; x += bay) {
          g.moveTo(x, y);
          g.lineTo(x, arch(x));
          g.moveTo(x, y);
          g.lineTo(x + bay, arch(x + bay));
        }
        g.stroke();
        g.lineWidth = 5 * s;
      }
      // The piers, at every join (both edges, so the repeat meets whole).
      g.fillStyle = V(120);
      for (let x0 = 0; x0 <= GW; x0 += span) g.fillRect(x0 - 10 * s, y - GH * 0.03, 20 * s, GH * 0.03 + 4 * s);
      for (const fx of [0.2, 0.62]) lamp(GW * fx, y, 70 * s);
    } else {
      // A gantry over the undercity: a grated deck on trusses, its railing, a pillar and chains.
      const y = GH * 0.955;
      g.fillStyle = V(110);
      g.fillRect(-GW * 0.2, y, GW * 1.4, GH);
      g.fillStyle = V(146);
      g.fillRect(-GW * 0.2, y, GW * 1.4, 2 * s);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < GW; x += even(4 * s)) g.fillRect(x, y + 3 * s, 1 * s, 10 * s);
      truss(g, 0, GW, y - 24 * s, even(24 * s), s, 112);
      g.fillStyle = V(132);
      g.fillRect(-GW * 0.2, y - 26 * s, GW * 1.4, 3 * s);
      const cx = side > 0 ? GW * 0.94 : GW * 0.06;
      column(cx, -20);
      g.strokeStyle = V(100);
      g.lineWidth = 1.2 * s;
      for (let k = 0; k < 3; k++) {
        const hx = cx - side * (40 + k * 26) * s;
        g.beginPath();
        for (let yy = -10; yy < GH * (0.35 + k * 0.12); yy += 5 * s) {
          g.moveTo(hx, yy);
          g.lineTo(hx, yy + 3.5 * s);
        }
        g.stroke();
      }
      g.lineCap = 'round';
      g.strokeStyle = V(104);
      g.lineWidth = 7 * s;
      g.beginPath();
      g.moveTo(-20, y - 40 * s);
      g.lineTo(GW + 20, y - 40 * s);
      g.stroke();
      g.strokeStyle = V(150);
      g.lineWidth = 1.6 * s;
      g.beginPath();
      g.moveTo(-20, y - 42.5 * s);
      g.lineTo(GW + 20, y - 42.5 * s);
      g.stroke();
      g.lineCap = 'butt';
      for (const fx of [0.3, 0.7]) lamp(GW * fx, y - 26 * s, 60 * s);
    }
  }
  function lampHanging(g: G, wg: G, P: Tile, x: number, y: number, s: number) {
    g.fillStyle = V(104);
    g.beginPath();
    g.moveTo(x - 7 * s, y + 3 * s);
    g.lineTo(x, y - 3 * s);
    g.lineTo(x + 7 * s, y + 3 * s);
    g.fill();
    g.fillStyle = V(96);
    g.beginPath();
    g.moveTo(x - 6 * s, y + 3 * s);
    g.lineTo(x + 6 * s, y + 3 * s);
    g.lineTo(x + 4 * s, y + 16 * s);
    g.lineTo(x - 4 * s, y + 16 * s);
    g.fill();
    g.fillStyle = V(60);
    g.fillRect(x - 4 * s, y + 5 * s, 8 * s, 9 * s);
    wg.fillStyle = '#ffd08a';
    wg.fillRect(x - 4 * s, y + 5 * s, 8 * s, 9 * s);
    P.lamps.push([x, y + 10 * s]);
  }

  // ---- the tiles -------------------------------------------------------------------------------------
  function compress(cv: HTMLCanvasElement, k: number) {
    const c = cv.getContext('2d')!;
    const img = c.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const v = d[i];
      if (v > 128) d[i] = d[i + 1] = d[i + 2] = 128 + (v - 128) * k;
    }
    c.putImageData(img, 0, 0);
  }
  function alloc(i: number, k: number, x0: number, x1: number, y0: number, res: number): Tile {
    const h = GH - y0;
    const w = (x1 - x0) * res;
    return {
      i, k, x0, x1, res, y0, h,
      shade: mk(w, h * res), win: mk(w, h * res), tint: mk(w, h * res), rimT: mk(w / 2, (h * res) / 2), at: { d: -1, fog: 0, storm: 0 },
      glows: [], lamps: [], spots: [], falls: [], lifts: [], flares: [],
    };
  }
  const sinkOf = (): Tile => ({ i: 0, k: 0, x0: 0, x1: 0, res: 1, y0: 0, h: 0, shade: null!, win: null!, tint: null!, rimT: null!, at: { d: 0, fog: 0, storm: 0 }, glows: [], lamps: [], spots: [], falls: [], lifts: [], flares: [] });

  /** A chunk of a plane, painted with its neighbours (so what crosses its edges is whole). */
  function tile(ch: Chunk, around: Chunk[]): Tile {
    const i = ch.i;
    const L: Layer = world.layers[i];
    const res = RES[i];
    const s = L.m * u;
    const pad = 300 * u;
    const near = (c: Chunk) => c.buildings.filter((b) => b.x < ch.x1 + pad && b.x + b.w > ch.x0 - pad);
    let minTop = GH;
    for (const c of around) {
      for (const b of near(c)) {
        const extra = b.kind === 'gothic' || b.kind === 'deco' || b.kind === 'spire' || b.kind === 'clock' || b.kind === 'cathedral' ? b.w * 2.4 + 40 * u : b.kind === 'refinery' || b.kind === 'blast' ? b.h * 1.2 : 70 * u;
        minTop = Math.min(minTop, b.base - b.h - extra, ...b.chimneys.map((q) => q[1] - 10 * u), b.clock ? b.clock.top - 30 * u : GH);
      }
      for (const id of c.masts) {
        const mm = world.masts.find((q) => q.id === id);
        if (mm) minTop = Math.min(minTop, mm.y - 30 * u);
      }
      for (const cl of c.cliffs) minTop = Math.min(minTop, cl[2] - 20 * u);
    }
    if (L.viaduct !== null) minTop = Math.min(minTop, L.viaduct - 40 * u);
    const y0 = Math.max(0, Math.floor(minTop - 20 * u));
    const P = alloc(i, ch.k, ch.x0, ch.x1, y0, res);
    const sink = sinkOf();
    const own = (c: Chunk) => (c === ch ? P : sink);
    const g = P.shade.getContext('2d')!;
    const wg = P.win.getContext('2d')!;
    g.setTransform(res, 0, 0, res, -ch.x0 * res, -y0 * res);
    wg.setTransform(res, 0, 0, res, -ch.x0 * res, -y0 * res);
    const litP = [0.07, 0.11, 0.17, 0.26, 0][i];
    const tiers = world.layout === 'tiers' && i === 3;
    if (tiers) {
      underWall(g, ch.x0, ch.x1);
      for (const c of around) underChunk(g, wg, c, own(c));
      underDeck(g, ch.x0, ch.x1);
    } else if (!(world.layout === 'heights' && (i === 1 || i === 2)) && !(world.layout === 'harbour' && i === 3)) {
      g.fillStyle = V(112);
      g.fillRect(ch.x0 - 20, L.base - 4 * u, ch.x1 - ch.x0 + 40, GH);
    }
    for (const c of around) cliffs(g, c.cliffs, s, own(c));
    const order = (k: string) => (k === 'factory' || k === 'refinery' || k === 'blast' ? -1 : 0);
    const all = around.flatMap((c) => near(c).map((b) => [b, c] as const)).sort(([a], [b]) => order(a.kind) - order(b.kind) || a.h - b.h);
    for (const [b, c] of all) {
      const T = own(c);
      if (b.kind === 'gothic') gothic(g, wg, b, s, litP);
      else if (b.kind === 'block') block(g, wg, b, s, litP);
      else if (b.kind === 'stack') stack(g, wg, b, s, litP);
      else if (b.kind === 'deco') deco(g, wg, b, s, litP);
      else if (b.kind === 'dome') dome(g, wg, b, s, litP);
      else if (b.kind === 'factory') factory(g, wg, b, s, litP, T);
      else if (b.kind === 'refinery') refinery(g, wg, b, s, litP, T);
      else if (b.kind === 'blast') blast(g, wg, b, s, T);
      else if (b.kind === 'cathedral') cathedral(g, wg, b, s, litP);
      else if (b.kind === 'arcology') arcology(g, wg, b, s, litP);
      else if (b.kind === 'lift') lift(g, wg, b, s, T);
      else if (b.kind === 'skydock') skydock(g, wg, b, s, litP);
      else if (b.kind === 'observatory') observatory(g, wg, b, s, litP);
      else if (b.kind === 'gasholder') gasholder(g, b, s);
      else if (b.kind === 'quay') quay(g, wg, b, s, litP);
      else if (b.kind === 'spire' || b.kind === 'clock') clockTower(g, wg, b, s);
      if (b.base < L.base + 60 * u && !tiers) {
        g.fillStyle = V(110);
        g.fillRect(b.x, b.base, b.w, L.base + 60 * u - b.base);
      }
      if ((b.kind === 'deco' || b.kind === 'gothic' || b.kind === 'skydock') && b.beacon && i >= 2 && T.spots.length < 1 && mulberry(b.seed + 3)() < 0.5) T.spots.push(b.beacon);
    }
    for (const c of around) {
      bridges(g, wg, c.bridges, s, own(c));
      walkways(g, c.walkways, s, own(c));
      cables(g, c.cables, s);
    }
    viaduct(g, L, s, P, ch.x0, ch.x1);
    // Painted: strokes over the stone, lighter above, darker toward the street.
    g.globalCompositeOperation = 'source-atop';
    const R = mulberry(i * 977 + ch.k * 31 + 13);
    const n = (2400 * res * (ch.x1 - ch.x0)) / GW;
    for (let k = 0; k < n; k++) {
      const x = ch.x0 + R() * (ch.x1 - ch.x0);
      const y = y0 + R() * P.h;
      const v = R() < 0.5 ? 80 : 170;
      g.strokeStyle = `rgba(${v},${v},${v},${(0.05 + R() * 0.08).toFixed(3)})`;
      g.lineWidth = (1 + R() * 3) * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (R() - 0.5) * 10 * s, y + (R() - 0.3) * 14 * s);
      g.stroke();
    }
    const vg = g.createLinearGradient(0, y0, 0, L.base);
    vg.addColorStop(0, 'rgba(255,255,255,0.1)');
    vg.addColorStop(0.6, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = vg;
    g.fillRect(ch.x0, y0, ch.x1 - ch.x0, P.h);
    g.globalCompositeOperation = 'source-over';
    compress(P.shade, 0.7);
    return P;
  }

  /** The promenade we walk along: one width of it, repeated as we go. */
  function frameTile(): Tile {
    const P = alloc(4, 0, 0, GW, 0, RES[4]);
    const g = P.shade.getContext('2d')!;
    const wg = P.win.getContext('2d')!;
    g.setTransform(RES[4], 0, 0, RES[4], 0, 0);
    wg.setTransform(RES[4], 0, 0, RES[4], 0, 0);
    frame(g, wg, P);
    compress(P.shade, 0.8);
    return P;
  }

  return { tile, frameTile };
}
