/**
 * Painting the city. Everything static about a building (its body, windows, levels,
 * terraces, stairs, roof) is rasterized once into a small canvas at device resolution and
 * stamped every frame; only what changes (neon, ads, blinking masts, outages, glitches)
 * is drawn live. Neon signs are glowing sprites, made once per text and color.
 *
 * Canvases are cached by building id and dropped when the building scrolls away.
 */
import { hash, hexA } from '../instruments/kit';
import type { Building } from './world';
import { LAYERS } from './world';

/** Extra room above the body for the roof's things. */
export const ROOF_ROOM = 40;
export const PAD = 3;
const BODY = [
  ['#1b1638', '#120f28'],
  ['#110e22', '#0a0817'],
  ['#0b0915', '#06050c'],
];
export const FONT = '"Syne Mono", "Orbit", ui-monospace, monospace';

export type Painter = {
  /** The building's canvas, painted on first use. */
  building(b: Building): HTMLCanvasElement;
  /** A neon sign sprite; draw it centered on the sign's anchor. */
  sign(text: string, color: string, size: number, vertical: boolean): HTMLCanvasElement;
  /** Forget canvases for buildings no longer around. */
  keep(ids: Set<string>): void;
  clear(): void;
  readonly dpr: number;
};

export function createPainter(dpr: number): Painter {
  const cache = new Map<string, HTMLCanvasElement>();
  const signs = new Map<string, HTMLCanvasElement>();
  const d = Math.max(1, Math.min(2, dpr));

  const canvas = (w: number, h: number, scale: number) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    return { c, g };
  };

  const paint = (b: Building) => {
    const spec = LAYERS[b.layer];
    // Far layers are seen through smog; they can be a little soft, and cost less.
    const scale = b.layer === 2 ? d : b.layer === 1 ? Math.min(d, 1.5) : 1;
    const { c, g } = canvas(b.w + PAD * 2, b.h + ROOF_ROOM, scale);
    const top = ROOF_ROOM;
    const x0 = PAD;
    const [c0, c1] = BODY[b.layer];
    const body = g.createLinearGradient(0, top, 0, top + b.h);
    body.addColorStop(0, c0);
    body.addColorStop(1, c1);
    g.fillStyle = body;
    g.fillRect(x0, top, b.w, b.h);
    // Neon spill on one edge.
    g.fillStyle = hexA(b.hue, b.layer === 2 ? 0.3 : 0.22);
    g.fillRect(x0, top, 1, b.h);
    if (b.levels) paintLevels(g, b, x0, top);
    else paintWindows(g, b, x0, top, b.h, spec.win);
    paintRoof(g, b, x0, top);
    return c;
  };

  return {
    dpr: d,
    building(b) {
      let c = cache.get(b.id);
      if (!c) {
        c = paint(b);
        cache.set(b.id, c);
      }
      return c;
    },
    sign(text, color, size, vertical) {
      const key = `${text}|${color}|${size}|${vertical ? 1 : 0}`;
      let c = signs.get(key);
      if (!c) {
        const glow = 6;
        const cw = vertical ? size + glow * 2 + 2 : text.length * size * 0.66 + glow * 2 + 6;
        const ch = vertical ? text.length * (size + 1) + glow * 2 + 4 : size + glow * 2 + 4;
        const made = canvas(cw, ch, d);
        const g = made.g;
        g.font = `${size}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        // Glow once, here, so live frames only stamp the result.
        g.shadowColor = color;
        g.shadowBlur = glow;
        g.fillStyle = color;
        const draw = () => {
          if (vertical) for (let i = 0; i < text.length; i++) g.fillText(text[i], cw / 2, glow + 2 + size / 2 + i * (size + 1));
          else g.fillText(text, cw / 2, ch / 2);
        };
        draw();
        g.shadowBlur = 0;
        g.fillStyle = hexA('#ffffff', 0.85);
        g.globalAlpha = 0.55;
        draw();
        c = made.c;
        signs.set(key, c);
      }
      return c;
    },
    keep(ids) {
      for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
    },
    clear() {
      cache.clear();
    },
  };
}

/** A tower's face: a grid of windows, some lit warm, a few cool, a few in its neon. */
function paintWindows(g: CanvasRenderingContext2D, b: Building, x0: number, top: number, h: number, win: [number, number]) {
  const [ww, wh] = win;
  const gx = ww + 2;
  const gy = wh + 3;
  const cols = Math.max(1, Math.floor((b.w - 6) / gx));
  const rows = Math.max(1, Math.floor((h - 8) / gy));
  const ox = x0 + (b.w - cols * gx) / 2 + 1;
  for (let r = 0; r < rows; r++) {
    // Whole floors are sometimes dark, sometimes all lit: offices keep hours.
    const floor = hash(b.seed, r, 7);
    const floorLit = floor < 0.12 ? 0 : floor > 0.93 ? 1 : b.lit;
    for (let c = 0; c < cols; c++) {
      const k = hash(b.seed, c, r);
      if (k >= floorLit) continue;
      const tone = hash(b.seed + 3, c, r);
      g.fillStyle = tone < 0.68 ? hexA('#fde68a', 0.5 + 0.4 * k) : tone < 0.9 ? hexA('#bae6fd', 0.45 + 0.4 * k) : hexA(b.hue, 0.75);
      g.fillRect(ox + c * gx, top + 5 + r * gy, ww, wh);
    }
  }
}

/** A near-layer stack, cut open: closed floors of windows, open terraces, a shopfront, stairs. */
function paintLevels(g: CanvasRenderingContext2D, b: Building, x0: number, top: number) {
  const levels = b.levels!;
  const bottom = top + b.h;
  levels.forEach((lv, i) => {
    const y1 = bottom - lv.y;
    const y0 = y1 - lv.h;
    if (lv.open) {
      // The inside, lit warm from its lanterns, then the back wall's doors and shutters.
      const inside = g.createLinearGradient(0, y0, 0, y1);
      inside.addColorStop(0, hexA(lv.lantern, i === 0 ? 0.34 : 0.22));
      inside.addColorStop(1, hexA(lv.lantern, 0.05));
      g.fillStyle = '#05040a';
      g.fillRect(x0 + 2, y0 + 3, b.w - 4, lv.h - 3);
      g.fillStyle = inside;
      g.fillRect(x0 + 2, y0 + 3, b.w - 4, lv.h - 3);
      g.strokeStyle = hexA('#000000', 0.55);
      g.lineWidth = 1;
      for (let x = x0 + 10 + hash(b.seed, i) * 20; x < x0 + b.w - 10; x += 22 + hash(b.seed, i, Math.floor(x)) * 18) {
        g.strokeRect(Math.round(x) + 0.5, y0 + lv.h * 0.35, 9, lv.h * 0.65 - 3);
      }
      // Lanterns along the ceiling.
      for (let x = x0 + 8; x < x0 + b.w - 6; x += 13) {
        if (hash(b.seed, Math.floor(x), i + 40) < 0.45) continue;
        g.fillStyle = hexA(lv.lantern, 0.85);
        g.beginPath();
        g.arc(x, y0 + 9, 2, 0, Math.PI * 2);
        g.fill();
      }
      // A stall: a striped awning over a counter.
      if (lv.awning) {
        const ax = x0 + 8 + hash(b.seed, i, 3) * Math.max(1, b.w - 70);
        const aw = 40 + hash(b.seed, i, 4) * 26;
        for (let k = 0; k < aw; k += 6) {
          g.fillStyle = hexA(k % 12 === 0 ? lv.awning : '#f8fafc', 0.55);
          g.fillRect(ax + k, y1 - lv.h * 0.55, 6, 5);
        }
        g.fillStyle = hexA('#000000', 0.7);
        g.fillRect(ax, y1 - lv.h * 0.3, aw, lv.h * 0.3 - 2);
        g.fillStyle = hexA(lv.awning, 0.4);
        g.fillRect(ax, y1 - lv.h * 0.3, aw, 1);
      }
      // People, standing about.
      const people = Math.floor(hash(b.seed, i, 9) * 4);
      g.fillStyle = '#030208';
      for (let k = 0; k < people; k++) {
        const px = x0 + 10 + hash(b.seed, i, k + 20) * (b.w - 20);
        const ph = 9 + hash(b.seed, k, i) * 3;
        g.fillRect(px, y1 - ph - 2, 3, ph);
        g.beginPath();
        g.arc(px + 1.5, y1 - ph - 4, 2, 0, Math.PI * 2);
        g.fill();
      }
      // Railing (not on the ground floor) and pillars.
      if (i > 0) {
        g.strokeStyle = hexA('#94a3b8', 0.35);
        g.beginPath();
        g.moveTo(x0, y1 - 9);
        g.lineTo(x0 + b.w, y1 - 9);
        for (let x = x0 + 3; x < x0 + b.w; x += 6) {
          g.moveTo(x + 0.5, y1 - 9);
          g.lineTo(x + 0.5, y1 - 1);
        }
        g.stroke();
      }
      g.fillStyle = BODY[2][0];
      for (let x = x0; x < x0 + b.w; x += 58) g.fillRect(x, y0, 4, lv.h);
      g.fillRect(x0 + b.w - 4, y0, 4, lv.h);
    } else {
      paintWindows(g, b, x0, y0, lv.h, [4, 6]);
    }
    // The floor slab, overhanging a little, with a pipe run under it.
    g.fillStyle = '#1c1a2e';
    g.fillRect(x0 - 2, y1 - 2, b.w + 4, 3);
    if (i > 0 && hash(b.seed, i, 11) < 0.6) {
      g.strokeStyle = hexA('#475569', 0.6);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x0, y0 + 4);
      g.lineTo(x0 + b.w, y0 + 4);
      g.stroke();
      g.lineWidth = 1;
    }
  });
  // Stairs zigzag up one side.
  if (hash(b.seed, 77) < 0.55 && levels.length > 1) {
    const side = hash(b.seed, 78) < 0.5;
    const sx = side ? x0 + b.w - 16 : x0 + 2;
    g.strokeStyle = hexA('#94a3b8', 0.4);
    g.beginPath();
    for (let i = 1; i < levels.length; i++) {
      const y1 = bottom - levels[i].y;
      const y0 = y1 - levels[i].h;
      g.moveTo(sx, y1);
      g.lineTo(sx + 14, y0 + levels[i].h * 0.5);
      g.lineTo(sx, y0 + 4);
    }
    g.stroke();
  }
}

function paintRoof(g: CanvasRenderingContext2D, b: Building, x0: number, top: number) {
  const body = BODY[b.layer][0];
  g.fillStyle = body;
  g.strokeStyle = hexA('#64748b', 0.5);
  g.lineWidth = 1;
  switch (b.roof) {
    case 'stepped': {
      const w1 = b.w * 0.7;
      const w2 = b.w * 0.4;
      g.fillRect(x0 + (b.w - w1) / 2, top - 10, w1, 10);
      g.fillRect(x0 + (b.w - w2) / 2, top - 18, w2, 8);
      break;
    }
    case 'spire': {
      g.beginPath();
      g.moveTo(x0 + b.w * 0.3, top);
      g.lineTo(x0 + b.w / 2, top - 34);
      g.lineTo(x0 + b.w * 0.7, top);
      g.closePath();
      g.fill();
      break;
    }
    case 'dish': {
      g.beginPath();
      g.arc(x0 + b.w * 0.6, top - 6, 7, Math.PI * 0.15, Math.PI * 1.15);
      g.stroke();
      g.fillRect(x0 + b.w * 0.6 - 1, top - 6, 2, 6);
      break;
    }
    case 'antenna': {
      for (const [mx, mh] of b.masts) {
        g.beginPath();
        g.moveTo(x0 + mx + 0.5, top);
        g.lineTo(x0 + mx + 0.5, top - mh);
        g.moveTo(x0 + mx - 3, top - mh * 0.6);
        g.lineTo(x0 + mx + 4, top - mh * 0.6);
        g.stroke();
      }
      break;
    }
    case 'crown': {
      // A corp tower: an angular crown and a lit band under it.
      g.beginPath();
      g.moveTo(x0, top);
      g.lineTo(x0 + b.w * 0.15, top - 22);
      g.lineTo(x0 + b.w * 0.35, top - 10);
      g.lineTo(x0 + b.w * 0.5, top - 36);
      g.lineTo(x0 + b.w * 0.65, top - 10);
      g.lineTo(x0 + b.w * 0.85, top - 22);
      g.lineTo(x0 + b.w, top);
      g.closePath();
      g.fill();
      g.strokeStyle = hexA(b.hue, 0.6);
      g.stroke();
      g.fillStyle = hexA(b.hue, 0.5);
      g.fillRect(x0, top + 4, b.w, 2);
      break;
    }
    case 'clutter': {
      // Rooftop life: AC boxes, a water tank, a dish.
      for (let k = 0; k < 3; k++) {
        const bx = x0 + 6 + hash(b.seed, k, 50) * (b.w - 26);
        const bw = 8 + hash(b.seed, k, 51) * 10;
        const bh = 5 + hash(b.seed, k, 52) * 6;
        g.fillRect(bx, top - bh, bw, bh);
      }
      if (hash(b.seed, 53) < 0.6) {
        const tx = x0 + b.w * (0.2 + hash(b.seed, 54) * 0.6);
        g.fillRect(tx, top - 18, 12, 12);
        g.fillRect(tx + 2, top - 6, 2, 6);
        g.fillRect(tx + 8, top - 6, 2, 6);
      }
      break;
    }
    default:
      break;
  }
}

/** The sky: a smog gradient lit from below by the city, and clouds (a low-resolution noise field, stretched). */
export function paintSky(W: number, H: number, bg: string, glow: string, noise: (x: number, y: number) => number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(W / 4));
  c.height = Math.max(1, Math.ceil(H / 4));
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, bg);
  grad.addColorStop(0.55, hexA(glow, 0.16));
  grad.addColorStop(0.8, hexA(glow, 0.3));
  grad.addColorStop(1, hexA(glow, 0.12));
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const v = noise(x * 0.025, y * 0.06) * 0.5 + 0.5;
      const k = Math.max(0, v - 0.45) * 60 * (1 - y / c.height) ** 0.5;
      const i = (y * c.width + x) * 4;
      img.data[i] += k * 0.8;
      img.data[i + 1] += k * 0.5;
      img.data[i + 2] += k * 1.1;
    }
  g.putImageData(img, 0, 0);
  return c;
}
