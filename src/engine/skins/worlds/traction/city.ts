/**
 * A traction city, drawn: baked once, tier by tier, in city units (see ./design), then tinted by
 * the hour; and its moving parts drawn live over the bake.
 *
 * Baked: the hull (armour plates, ribs, portholes, vents, the city's name and crest along its
 * flank); each tier with its deck (a riveted girder slab with its railings), the pillars that
 * carry the tier above, and what stands on it: the works (saw-tooth sheds, foundry halls with
 * their doors aglow, cooling towers, gasholders, pipe racks, conveyors), the tenements (tall
 * blocks, water tanks, washing lines, painted adverts), the terraces (townhouses, dormers, a
 * church spire, a clock tower), the gardens (villas with columns, trees, glasshouses, a museum
 * dome), and the crown (a cathedral, a dome, a cluster of spires or a stepped temple, palaces, and
 * the air-quay mast). Every window is on the window picture, lit warm at night.
 *
 * Live: the caterpillar tracks (treads running round, road wheels and sprockets turning, mud
 * thrown up), the suspension rams, the jaws opening and the glow of the gut between them, the
 * chimneys (one more for each town eaten) and their smoke, the lifts going up and down, cranes,
 * pennants, guns firing, fires burning, and the searchlights.
 */
import { cityPlan, cityTop, hsh, type CityPlan, type Tier } from './design';
import { clamp01, drawSprite, drift, hexA, mix, sprite, tintSprite, type Env, type Sprite } from './light';
import type { City } from './types';

type G = CanvasRenderingContext2D;
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
export const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
};
const WARM = ['#ffcf8a', '#ffb866', '#ffe2a8', '#ffa24c', '#ffd79a', '#fff0c8'];

export type Pal = { hull: string; trim: string; brick: string[]; stone: string; roof: string; slate: string; copper: string; iron: string; rust: string; green: string; glass: string; paint: string };
const SCHEMES: Pal[] = [
  { hull: '#3a3632', trim: '#b08a48', brick: ['#8a4a36', '#7a5040', '#9a6048', '#6a4436'], stone: '#c4b8a0', roof: '#5a4a44', slate: '#4a5260', copper: '#6a9a88', iron: '#3e3a36', rust: '#8a5030', green: '#4a6a3a', glass: '#283038', paint: '#7a2a22' },
  { hull: '#2e3a32', trim: '#c8a058', brick: ['#7a4436', '#8e5a44', '#6a3e30', '#9a6e52'], stone: '#cfc4aa', roof: '#4a3e3a', slate: '#3e4650', copper: '#5e9282', iron: '#343a36', rust: '#7a4a2c', green: '#3e5e36', glass: '#22302e', paint: '#2a4a3a' },
  { hull: '#4a2a26', trim: '#c8a058', brick: ['#8a3e30', '#9a5038', '#7a4a3a', '#a86a4a'], stone: '#d0c0a0', roof: '#5e3a30', slate: '#46424a', copper: '#7aa08a', iron: '#3a302c', rust: '#9a5a34', green: '#4e6a3a', glass: '#2a2628', paint: '#6a1e1a' },
  { hull: '#262c36', trim: '#a8a8a0', brick: ['#6a5048', '#7a5a4c', '#5a4640', '#8a6a5a'], stone: '#bcb6a8', roof: '#3e3e44', slate: '#3a4250', copper: '#5a8a8a', iron: '#30343a', rust: '#7a4a34', green: '#3a5a44', glass: '#1e262e', paint: '#2a3a5a' },
];
export const palOf = (seed: number) => SCHEMES[Math.floor(hsh(seed, 3) * SCHEMES.length)];

// ---- drawing parts (city units; the bake's context is already scaled) --------------------------------
/** A face lit from above: lighter at the top, a little dark at its foot. */
export function face(g: G, x: number, y: number, w: number, h: number, c: string) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, shade(c, 1.1));
  gr.addColorStop(0.7, c);
  gr.addColorStop(1, shade(c, 0.72));
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
}
/** A grid of windows: dark glass on the bake, some of them lit on the window picture. */
export function windows(g: G, wg: G | null, R: () => number, x: number, y: number, w: number, h: number, ww: number, wh: number, sx: number, sy: number, lit = 0.55, arch = false) {
  const cols = Math.max(1, Math.floor((w - ww * 0.6) / sx));
  const rows = Math.max(1, Math.floor((h - wh * 0.6) / sy));
  const ox = x + (w - (cols - 1) * sx - ww) / 2;
  const oy = y + (h - (rows - 1) * sy - wh) / 2;
  const run = R() < 0.3;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const X = ox + i * sx;
      const Y = oy + j * sy;
      g.fillStyle = R() < 0.12 ? '#5a6470' : '#1c1a1a';
      if (arch) {
        g.beginPath();
        g.moveTo(X, Y + wh);
        g.lineTo(X, Y + ww * 0.5);
        g.arc(X + ww / 2, Y + ww * 0.5, ww / 2, Math.PI, 0);
        g.lineTo(X + ww, Y + wh);
        g.fill();
      } else g.fillRect(X, Y, ww, wh);
      if (wg && R() < (run && j === rows - 1 ? 0.9 : lit)) {
        wg.fillStyle = WARM[Math.floor(R() * WARM.length)];
        wg.globalAlpha = 0.55 + R() * 0.45;
        wg.fillRect(X, Y, ww, wh);
        wg.globalAlpha = 1;
      }
    }
}
function rimLine(rg: G | null, x0: number, y: number, x1: number, a = 0.8, w = 1.2) {
  if (!rg) return;
  rg.fillStyle = `rgba(255,255,255,${a})`;
  rg.fillRect(x0, y - w * 0.5, x1 - x0, w);
}
function gable(g: G, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x - w * 0.04, y);
  g.lineTo(x + w / 2, y - h);
  g.lineTo(x + w * 1.04, y);
  g.fill();
}
function rivets(g: G, x0: number, x1: number, y: number, step: number, c: string) {
  g.fillStyle = c;
  for (let x = x0; x < x1; x += step) g.fillRect(x, y, 0.9, 0.9);
}
function spire(g: G, rg: G | null, x: number, y: number, w: number, h: number, c: string) {
  g.fillStyle = c;
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.lineTo(x, y - h);
  g.lineTo(x + w / 2, y);
  g.fill();
  g.fillStyle = shade(c, 0.7);
  g.beginPath();
  g.moveTo(x, y - h);
  g.lineTo(x + w / 2, y);
  g.lineTo(x + w * 0.1, y);
  g.fill();
  if (rg) {
    rg.fillStyle = 'rgba(255,255,255,0.7)';
    rg.beginPath();
    rg.moveTo(x - w / 2, y);
    rg.lineTo(x, y - h);
    rg.lineTo(x - w * 0.3, y);
    rg.fill();
  }
}
function tree(g: G, rg: G | null, R: () => number, x: number, y: number, r: number, c: string) {
  g.fillStyle = '#3a2e24';
  g.fillRect(x - r * 0.08, y - r * 0.9, r * 0.16, r * 0.9);
  for (let k = 0; k < 5; k++) {
    const a = R() * Math.PI * 2;
    const rr = r * (0.45 + R() * 0.35);
    const px = x + Math.cos(a) * r * 0.4;
    const py = y - r * 1.3 + Math.sin(a) * r * 0.35;
    g.fillStyle = shade(c, 0.8 + R() * 0.4);
    g.beginPath();
    g.arc(px, py, rr, 0, Math.PI * 2);
    g.fill();
  }
  if (rg) {
    rg.fillStyle = 'rgba(255,255,255,0.35)';
    rg.beginPath();
    rg.arc(x - r * 0.2, y - r * 1.75, r * 0.4, 0, Math.PI * 2);
    rg.fill();
  }
}

// ---- the tiers ------------------------------------------------------------------------------------------
type Lot = { x: number; w: number; h: number; under: boolean };
function lotsOf(R: () => number, x0: number, x1: number, minW: number, maxW: number, gap: number, hMax: number, hMin: number, cover: [number, number] | null): Lot[] {
  const out: Lot[] = [];
  let x = x0 + 2;
  while (x < x1 - minW) {
    const w = Math.min(x1 - 2 - x, minW + R() * (maxW - minW));
    const mid = x + w / 2;
    const under = !!cover && mid > cover[0] && mid < cover[1];
    // Lower toward the tier's ends, so each tier's skyline is rounded like a tier of a cake.
    const q = (mid - x0) / Math.max(1, x1 - x0);
    const h = under ? hMax * (0.55 + R() * 0.3) : (hMin + R() * (hMax - hMin)) * (0.62 + 0.38 * Math.sin(Math.PI * Math.max(0, Math.min(1, q))));
    out.push({ x, w, h, under });
    x += w + gap * (0.3 + R());
  }
  return out;
}
function deck(g: G, rg: G | null, wg: G | null, P: Pal, t: Tier, R: () => number) {
  const x0 = t.x0;
  const x1 = t.x1;
  const th = t.deck - t.floor;
  face(g, x0, t.floor, x1 - x0, th, P.iron);
  // The girder face: a truss, plate seams, rivets; the railing along the top.
  g.strokeStyle = shade(P.iron, 0.6);
  g.lineWidth = 0.9;
  g.beginPath();
  for (let x = x0; x < x1; x += 12) {
    g.moveTo(x, t.floor + 2);
    g.lineTo(x + 6, t.deck - 2);
    g.lineTo(x + 12, t.floor + 2);
  }
  g.stroke();
  g.fillStyle = shade(P.iron, 1.35);
  g.fillRect(x0, t.floor, x1 - x0, 1.6);
  g.fillStyle = shade(P.iron, 0.5);
  g.fillRect(x0, t.deck - 1.6, x1 - x0, 1.6);
  rivets(g, x0 + 1, x1, t.floor + 2.6, 3, shade(P.iron, 1.5));
  rivets(g, x0 + 1, x1, t.deck - 3.2, 3, shade(P.iron, 1.5));
  g.fillStyle = shade(P.iron, 0.8);
  for (let x = x0; x < x1; x += 4) g.fillRect(x, t.floor - 3, 0.6, 3);
  g.fillRect(x0, t.floor - 3.2, x1 - x0, 0.7);
  rimLine(rg, x0, t.floor + 0.6, x1, 0.9, 1.4);
  // Ends capped, with a lamp.
  for (const [ex, s] of [[x0, -1], [x1, 1]] as const) {
    g.fillStyle = shade(P.iron, 0.8);
    g.beginPath();
    g.moveTo(ex, t.floor);
    g.lineTo(ex + s * 6, t.floor + th * 0.3);
    g.lineTo(ex + s * 4, t.deck);
    g.lineTo(ex, t.deck);
    g.fill();
    if (wg) {
      wg.fillStyle = '#ffe2a8';
      wg.fillRect(ex + s * 4 - 1, t.floor + 2, 2, 2);
    }
  }
  // Lamps along the deck's face.
  if (wg) for (let x = x0 + 10; x < x1 - 6; x += 22 + R() * 10) {
    wg.fillStyle = '#ffd79a';
    wg.fillRect(x, t.floor + th * 0.45, 1.4, 1.4);
  }
}
/** Under the tier above: the dark there, the pillars that carry it, the backs of buildings in its shadow. */
function underDeck(g: G, wg: G | null, P: Pal, t: Tier, above: Tier, R: () => number) {
  const x0 = Math.max(t.x0, above.x0);
  const x1 = Math.min(t.x1, above.x1);
  // The far wall: dark, full of small windows.
  g.fillStyle = shade(P.iron, 0.55);
  g.fillRect(x0, t.top, x1 - x0, t.floor - t.top);
  for (let x = x0 + 2; x < x1 - 6; x += 10 + R() * 8) {
    const w = 6 + R() * 10;
    const h = (t.floor - t.top) * (0.6 + R() * 0.4);
    g.fillStyle = shade(P.brick[Math.floor(R() * P.brick.length)], 0.45);
    g.fillRect(x, t.floor - h, w, h);
    windows(g, wg, R, x, t.floor - h, w, h, 1.6, 2, 3.4, 4.2, 0.5);
  }
  // Pillars to the deck above.
  for (let x = x0 + 14; x < x1 - 8; x += 48 + R() * 16) {
    g.fillStyle = shade(P.iron, 0.75);
    g.fillRect(x, t.top, 6, t.floor - t.top);
    g.fillStyle = shade(P.iron, 1.1);
    g.fillRect(x, t.top, 1.5, t.floor - t.top);
    g.fillStyle = shade(P.iron, 0.6);
    g.beginPath();
    g.moveTo(x - 6, t.top);
    g.lineTo(x + 12, t.top);
    g.lineTo(x + 6, t.top + 6);
    g.lineTo(x, t.top + 6);
    g.fill();
  }
}
function shadeUnder(g: G, t: Tier, above: Tier | undefined) {
  if (!above) return;
  const x0 = Math.max(t.x0, above.x0);
  const x1 = Math.min(t.x1, above.x1);
  const gr = g.createLinearGradient(0, t.top, 0, t.top + (t.floor - t.top) * 0.7);
  gr.addColorStop(0, 'rgba(10,8,8,0.62)');
  gr.addColorStop(1, 'rgba(10,8,8,0)');
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = gr;
  g.fillRect(x0, t.top, x1 - x0, t.floor - t.top);
  g.restore();
}

function works(g: G, wg: G | null, rg: G | null, P: Pal, t: Tier, above: Tier | undefined, R: () => number) {
  const cover: [number, number] | null = above ? [above.x0, above.x1] : null;
  const H = t.floor - t.top;
  if (above) underDeck(g, wg, P, t, above, R);
  for (const L of lotsOf(R, t.x0 + 4, t.x1 - 4, 30, 90, 2, H * 0.95, H * 0.55, cover)) {
    const y = t.floor - L.h;
    const kind = R();
    if (kind < 0.34) {
      // Saw-tooth sheds: brick walls, glazed north lights.
      face(g, L.x, y + L.h * 0.25, L.w, L.h * 0.75, P.brick[Math.floor(R() * P.brick.length)]);
      windows(g, wg, R, L.x + 2, y + L.h * 0.35, L.w - 4, L.h * 0.5, 3, 7, 7, 10, 0.6, true);
      const n = Math.max(2, Math.floor(L.w / 10));
      const tw = L.w / n;
      for (let k = 0; k < n; k++) {
        const x = L.x + k * tw;
        g.fillStyle = P.slate;
        g.beginPath();
        g.moveTo(x, y + L.h * 0.25);
        g.lineTo(x + tw, y + L.h * 0.25);
        g.lineTo(x + tw, y + L.h * 0.08);
        g.fill();
        g.fillStyle = '#2a3038';
        g.fillRect(x + tw - 1.6, y + L.h * 0.08, 1.6, L.h * 0.17);
        if (wg && R() < 0.7) {
          wg.fillStyle = '#ffb866';
          wg.fillRect(x + tw - 1.6, y + L.h * 0.1, 1.6, L.h * 0.14);
        }
        if (rg) {
          rg.fillStyle = 'rgba(255,255,255,0.75)';
          rg.beginPath();
          rg.moveTo(x, y + L.h * 0.25);
          rg.lineTo(x + tw, y + L.h * 0.08);
          rg.lineTo(x + tw, y + L.h * 0.08 + 1.2);
          rg.lineTo(x, y + L.h * 0.25 + 1.2);
          rg.fill();
        }
      }
    } else if (kind < 0.56) {
      // A foundry hall: a great gabled roof, a ventilator ridge, the doors open on the furnaces.
      const c = P.brick[Math.floor(R() * P.brick.length)];
      face(g, L.x, y + L.h * 0.3, L.w, L.h * 0.7, c);
      gable(g, L.x, y + L.h * 0.3, L.w, L.h * 0.26, P.roof);
      rimLine(rg, L.x + L.w * 0.1, y + L.h * 0.3 - L.h * 0.18, L.x + L.w * 0.5, 0.6);
      g.fillStyle = shade(P.roof, 0.7);
      g.fillRect(L.x + L.w * 0.3, y + L.h * 0.04, L.w * 0.4, L.h * 0.06);
      const doors = Math.max(1, Math.floor(L.w / 22));
      for (let k = 0; k < doors; k++) {
        const dx = L.x + (k + 0.5) * (L.w / doors) - 5;
        g.fillStyle = '#1a1210';
        g.beginPath();
        g.moveTo(dx, t.floor);
        g.lineTo(dx, t.floor - L.h * 0.38);
        g.arc(dx + 5, t.floor - L.h * 0.38, 5, Math.PI, 0);
        g.lineTo(dx + 10, t.floor);
        g.fill();
        if (wg) {
          const gr = wg.createLinearGradient(0, t.floor - L.h * 0.45, 0, t.floor);
          gr.addColorStop(0, 'rgba(255,140,50,0.4)');
          gr.addColorStop(1, 'rgba(255,190,90,1)');
          wg.fillStyle = gr;
          wg.fillRect(dx + 1, t.floor - L.h * 0.42, 8, L.h * 0.42);
        }
      }
      windows(g, wg, R, L.x + 2, y + L.h * 0.34, L.w - 4, L.h * 0.2, 2, 3, 5, 6, 0.7);
    } else if (kind < 0.68 && !L.under) {
      // A cooling tower.
      const cx = L.x + L.w / 2;
      const w = Math.min(L.w, 34);
      g.fillStyle = shade(P.stone, 0.82);
      g.beginPath();
      g.moveTo(cx - w / 2, t.floor);
      g.quadraticCurveTo(cx - w * 0.22, t.floor - L.h * 0.6, cx - w * 0.34, y);
      g.lineTo(cx + w * 0.34, y);
      g.quadraticCurveTo(cx + w * 0.22, t.floor - L.h * 0.6, cx + w / 2, t.floor);
      g.fill();
      const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.12)');
      gr.addColorStop(0.6, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = gr;
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(cx - w * 0.34, y, w * 0.68, 2);
      rimLine(rg, cx - w * 0.34, y + 0.5, cx + w * 0.34, 0.8);
    } else if (kind < 0.8) {
      // A gasholder in its guide frame.
      const cx = L.x + L.w / 2;
      const r = Math.min(L.w, L.h) * 0.42;
      g.fillStyle = shade(P.rust, 0.9);
      g.fillRect(cx - r, t.floor - r * 1.5, r * 2, r * 1.5);
      g.beginPath();
      g.ellipse(cx, t.floor - r * 1.5, r, r * 0.25, 0, Math.PI, 0);
      g.fill();
      g.strokeStyle = shade(P.iron, 0.9);
      g.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const x = cx - r * 1.1 + (k * r * 2.2) / 4;
        g.beginPath();
        g.moveTo(x, t.floor);
        g.lineTo(x, t.floor - r * 2);
        g.stroke();
      }
      for (let k = 1; k <= 3; k++) {
        g.beginPath();
        g.moveTo(cx - r * 1.1, t.floor - (k * r * 2) / 3);
        g.lineTo(cx + r * 1.1, t.floor - (k * r * 2) / 3);
        g.stroke();
      }
      rimLine(rg, cx - r, t.floor - r * 1.75, cx + r, 0.6);
    } else {
      // Pipe racks, tanks, a conveyor up the side.
      face(g, L.x, y + L.h * 0.45, L.w, L.h * 0.55, P.iron);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = shade(P.rust, 0.8 + k * 0.15);
        g.fillRect(L.x, y + L.h * (0.48 + k * 0.1), L.w, 2.2);
      }
      const tanks = Math.max(1, Math.floor(L.w / 16));
      for (let k = 0; k < tanks; k++) {
        const x = L.x + 3 + k * (L.w / tanks);
        g.fillStyle = shade(P.stone, 0.7);
        g.fillRect(x, y + L.h * 0.18, L.w / tanks - 5, L.h * 0.3);
        g.beginPath();
        g.ellipse(x + (L.w / tanks - 5) / 2, y + L.h * 0.18, (L.w / tanks - 5) / 2, 2, 0, Math.PI, 0);
        g.fill();
        rimLine(rg, x, y + L.h * 0.17, x + L.w / tanks - 5, 0.5);
      }
      g.strokeStyle = shade(P.iron, 1.2);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(L.x, t.floor - 2);
      g.lineTo(L.x + L.w, y + 2);
      g.stroke();
      windows(g, wg, R, L.x + 2, y + L.h * 0.6, L.w - 4, L.h * 0.35, 2, 2.5, 5, 6, 0.6);
    }
  }
  shadeUnder(g, t, above);
}

function tenements(g: G, wg: G | null, rg: G | null, P: Pal, t: Tier, above: Tier | undefined, R: () => number, ads: string[]) {
  const cover: [number, number] | null = above ? [above.x0, above.x1] : null;
  const H = t.floor - t.top;
  if (above) underDeck(g, wg, P, t, above, R);
  const lots = lotsOf(R, t.x0 + 3, t.x1 - 3, 18, 44, 0.5, H * 0.98, H * 0.62, cover);
  for (const L of lots) {
    const y = t.floor - L.h;
    const c = R() < 0.25 ? P.stone : P.brick[Math.floor(R() * P.brick.length)];
    face(g, L.x, y, L.w, L.h, c);
    // A cornice; shopfronts at the foot; windows in rows.
    g.fillStyle = shade(c, 1.25);
    g.fillRect(L.x - 0.8, y, L.w + 1.6, 1.8);
    rimLine(rg, L.x - 0.8, y + 0.5, L.x + L.w + 0.8, 0.85);
    g.fillStyle = shade(c, 0.6);
    g.fillRect(L.x, t.floor - 7, L.w, 7);
    if (wg && R() < 0.8) {
      wg.fillStyle = WARM[Math.floor(R() * WARM.length)];
      wg.globalAlpha = 0.9;
      wg.fillRect(L.x + 1.5, t.floor - 6, L.w - 3, 4.5);
      wg.globalAlpha = 1;
    }
    windows(g, wg, R, L.x + 1, y + 3, L.w - 2, L.h - 11, 2.6, 3.6, 5.4, 7, 0.5);
    // Roof furniture: chimney pots, a water tank on legs, an aerial.
    const rf = R();
    if (rf < 0.4) {
      for (let k = 0; k < 3; k++) {
        g.fillStyle = shade(c, 0.75);
        g.fillRect(L.x + 3 + k * (L.w / 3), y - 4, 2.4, 4);
      }
    } else if (rf < 0.7 && !L.under) {
      g.fillStyle = shade(P.iron, 1);
      g.fillRect(L.x + L.w * 0.3, y - 3, 1, 3);
      g.fillRect(L.x + L.w * 0.3 + 7, y - 3, 1, 3);
      g.fillStyle = '#5a4a3a';
      g.fillRect(L.x + L.w * 0.3 - 1, y - 9, 10, 6);
      g.beginPath();
      g.moveTo(L.x + L.w * 0.3 - 1.5, y - 9);
      g.lineTo(L.x + L.w * 0.3 + 4, y - 12);
      g.lineTo(L.x + L.w * 0.3 + 9.5, y - 9);
      g.fill();
      rimLine(rg, L.x + L.w * 0.3 - 1, y - 11.5, L.x + L.w * 0.3 + 4, 0.6, 1);
    } else if (!L.under && R() < 0.5 && ads.length) {
      // A painted advert on a frame.
      const aw = Math.min(L.w - 2, 30);
      g.fillStyle = shade(P.iron, 0.9);
      g.fillRect(L.x + 2, y - 2, 1, 2);
      g.fillRect(L.x + aw - 1, y - 2, 1, 2);
      g.fillStyle = P.paint;
      g.fillRect(L.x + 1, y - 10, aw, 8);
      g.fillStyle = '#e8dcc0';
      g.font = '5px Georgia, serif';
      g.textAlign = 'center';
      g.fillText(ads[Math.floor(R() * ads.length)], L.x + 1 + aw / 2, y - 4.2, aw - 2);
      if (wg) {
        wg.fillStyle = 'rgba(255,220,160,0.35)';
        wg.fillRect(L.x + 1, y - 10, aw, 8);
      }
    }
    // Balconies, a fire escape.
    if (R() < 0.35) {
      g.strokeStyle = shade(P.iron, 0.8);
      g.lineWidth = 0.6;
      for (let yy = y + 8; yy < t.floor - 10; yy += 7) {
        g.beginPath();
        g.moveTo(L.x + L.w - 6, yy);
        g.lineTo(L.x + L.w, yy);
        g.lineTo(L.x + L.w - 6, yy + 7);
        g.stroke();
      }
    }
  }
  // Washing lines across the gaps.
  g.strokeStyle = 'rgba(40,36,30,0.6)';
  g.lineWidth = 0.4;
  for (let k = 0; k + 1 < lots.length; k++) {
    if (R() > 0.3) continue;
    const a = lots[k];
    const b = lots[k + 1];
    const y = t.floor - Math.min(a.h, b.h) * (0.4 + R() * 0.4);
    g.beginPath();
    g.moveTo(a.x + a.w, y);
    g.quadraticCurveTo((a.x + a.w + b.x) / 2 + 3, y + 3, b.x + 6, y);
    g.stroke();
    for (let q = 0; q < 4; q++) {
      g.fillStyle = ['#e8e0d0', '#a83a2a', '#3a5a8a', '#d8c070'][Math.floor(R() * 4)];
      g.fillRect(a.x + a.w + 2 + q * 2.4, y + 0.6, 1.6, 2.4);
    }
  }
  shadeUnder(g, t, above);
}

function terraces(g: G, wg: G | null, rg: G | null, P: Pal, t: Tier, above: Tier | undefined, R: () => number) {
  const cover: [number, number] | null = above ? [above.x0, above.x1] : null;
  const H = t.floor - t.top;
  if (above) underDeck(g, wg, P, t, above, R);
  const lots = lotsOf(R, t.x0 + 3, t.x1 - 3, 12, 22, 0, H * 0.8, H * 0.5, cover);
  let landmark = Math.floor(R() * lots.length);
  for (const [i, L] of lots.entries()) {
    const roofH = L.h * 0.28;
    const y = t.floor - L.h + roofH;
    const c = R() < 0.45 ? mix(P.stone, '#e8dcc0', R() * 0.4) : P.brick[Math.floor(R() * P.brick.length)];
    if (i === landmark && !L.under) {
      // A church with a spire, or a clock tower.
      const tw = Math.min(L.w, 14);
      const cx = L.x + L.w / 2;
      face(g, cx - tw / 2, t.floor - H * 1.05, tw, H * 1.05, P.stone);
      windows(g, wg, R, cx - tw / 2, t.floor - H * 0.9, tw, H * 0.8, 2, 6, 5, 9, 0.6, true);
      if (R() < 0.5) {
        spire(g, rg, cx, t.floor - H * 1.05, tw * 1.05, H * 0.9, P.slate);
      } else {
        g.fillStyle = '#e8e0c8';
        g.beginPath();
        g.arc(cx, t.floor - H * 0.85, tw * 0.33, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#2a2420';
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(cx, t.floor - H * 0.85);
        g.lineTo(cx, t.floor - H * 0.85 - tw * 0.25);
        g.moveTo(cx, t.floor - H * 0.85);
        g.lineTo(cx + tw * 0.18, t.floor - H * 0.85);
        g.stroke();
        if (wg) {
          wg.fillStyle = 'rgba(255,236,190,0.85)';
          wg.beginPath();
          wg.arc(cx, t.floor - H * 0.85, tw * 0.33, 0, Math.PI * 2);
          wg.fill();
        }
        gable(g, cx - tw / 2, t.floor - H * 1.05, tw, H * 0.25, P.copper);
      }
      landmark = -1;
      continue;
    }
    face(g, L.x, y, L.w, L.h - roofH, c);
    gable(g, L.x, y, L.w, roofH, R() < 0.5 ? P.slate : P.roof);
    if (rg) {
      rg.fillStyle = 'rgba(255,255,255,0.7)';
      rg.beginPath();
      rg.moveTo(L.x - L.w * 0.04, y);
      rg.lineTo(L.x + L.w / 2, y - roofH);
      rg.lineTo(L.x + L.w / 2, y - roofH + 1.3);
      rg.lineTo(L.x, y + 1);
      rg.fill();
    }
    // A dormer, a chimney stack with pots.
    if (R() < 0.5) {
      g.fillStyle = shade(c, 0.9);
      g.fillRect(L.x + L.w * 0.35, y - roofH * 0.55, L.w * 0.3, roofH * 0.45);
      if (wg && R() < 0.6) {
        wg.fillStyle = WARM[Math.floor(R() * WARM.length)];
        wg.fillRect(L.x + L.w * 0.4, y - roofH * 0.45, L.w * 0.2, roofH * 0.3);
      }
    }
    g.fillStyle = shade(c, 0.8);
    g.fillRect(L.x + L.w * 0.78, y - roofH * 0.9, 2.4, roofH * 0.9);
    windows(g, wg, R, L.x + 1, y + 2, L.w - 2, L.h - roofH - 4, 2.4, 3.6, 5, 6.6, 0.5);
    // A shop's awning now and then.
    if (R() < 0.3) {
      g.fillStyle = ['#8a2a22', '#2a5a3a', '#2a3a6a', '#a8843a'][Math.floor(R() * 4)];
      g.beginPath();
      g.moveTo(L.x, t.floor - 6);
      g.lineTo(L.x + L.w, t.floor - 6);
      g.lineTo(L.x + L.w + 1.5, t.floor - 3.5);
      g.lineTo(L.x - 1.5, t.floor - 3.5);
      g.fill();
    }
  }
  // Street trees at the tier's open ends.
  for (let k = 0; k < 6; k++) {
    const x = t.x0 + 4 + R() * (t.x1 - t.x0 - 8);
    if (cover && x > cover[0] && x < cover[1]) continue;
    tree(g, rg, R, x, t.floor, 4 + R() * 2.5, P.green);
  }
  shadeUnder(g, t, above);
}

function gardens(g: G, wg: G | null, rg: G | null, P: Pal, t: Tier, above: Tier | undefined, R: () => number) {
  const cover: [number, number] | null = above ? [above.x0, above.x1] : null;
  const H = t.floor - t.top;
  if (above) underDeck(g, wg, P, t, above, R);
  // Trees all along first, then villas, a glasshouse, a museum dome.
  for (let x = t.x0 + 4; x < t.x1 - 4; x += 5 + R() * 6) tree(g, rg, R, x, t.floor, 4 + R() * 4, P.green);
  const lots = lotsOf(R, t.x0 + 8, t.x1 - 8, 24, 52, 8, H * 0.8, H * 0.45, cover);
  let museum = Math.floor(R() * lots.length);
  for (const [i, L] of lots.entries()) {
    const y = t.floor - L.h;
    if (i === museum && !L.under) {
      const cx = L.x + L.w / 2;
      face(g, L.x, t.floor - H * 0.5, L.w, H * 0.5, P.stone);
      for (let x = L.x + 2; x < L.x + L.w - 2; x += 4) {
        g.fillStyle = shade(P.stone, 1.15);
        g.fillRect(x, t.floor - H * 0.44, 1.6, H * 0.38);
      }
      g.fillStyle = shade(P.stone, 0.95);
      g.fillRect(L.x - 1, t.floor - H * 0.52, L.w + 2, 2);
      g.fillStyle = P.copper;
      g.beginPath();
      g.ellipse(cx, t.floor - H * 0.52, L.w * 0.32, H * 0.42, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(cx + L.w * 0.08, t.floor - H * 0.52, L.w * 0.24, H * 0.4, 0, Math.PI * 1.5, 0);
      g.fill();
      if (rg) {
        rg.fillStyle = 'rgba(255,255,255,0.6)';
        rg.beginPath();
        rg.ellipse(cx - L.w * 0.1, t.floor - H * 0.78, L.w * 0.12, H * 0.08, -0.4, 0, Math.PI * 2);
        rg.fill();
      }
      g.fillStyle = shade(P.stone, 1.1);
      g.fillRect(cx - 1.5, t.floor - H * 1.0, 3, H * 0.1);
      museum = -1;
      continue;
    }
    if (R() < 0.3) {
      // A glasshouse.
      g.fillStyle = 'rgba(150,180,170,0.85)';
      g.beginPath();
      g.moveTo(L.x, t.floor);
      g.lineTo(L.x, t.floor - L.h * 0.5);
      g.quadraticCurveTo(L.x + L.w / 2, t.floor - L.h * 1.1, L.x + L.w, t.floor - L.h * 0.5);
      g.lineTo(L.x + L.w, t.floor);
      g.fill();
      g.strokeStyle = 'rgba(240,240,230,0.6)';
      g.lineWidth = 0.5;
      for (let x = L.x + 3; x < L.x + L.w; x += 3) {
        g.beginPath();
        g.moveTo(x, t.floor);
        g.lineTo(x, t.floor - L.h * 0.75);
        g.stroke();
      }
      if (wg) {
        wg.fillStyle = 'rgba(200,255,200,0.45)';
        wg.fillRect(L.x + 1, t.floor - L.h * 0.5, L.w - 2, L.h * 0.5);
      }
      rimLine(rg, L.x + L.w * 0.25, t.floor - L.h * 0.9, L.x + L.w * 0.75, 0.9);
      continue;
    }
    // A villa: white columns, a pediment.
    const c = mix(P.stone, '#f0e8d8', 0.3 + R() * 0.4);
    face(g, L.x, y + L.h * 0.15, L.w, L.h * 0.85, c);
    gable(g, L.x, y + L.h * 0.15, L.w, L.h * 0.15, shade(c, 0.85));
    rimLine(rg, L.x, y + L.h * 0.15, L.x + L.w, 0.7);
    for (let x = L.x + 2; x < L.x + L.w - 1; x += 4) {
      g.fillStyle = shade(c, 1.15);
      g.fillRect(x, y + L.h * 0.25, 1.4, L.h * 0.7);
    }
    windows(g, wg, R, L.x + 2, y + L.h * 0.3, L.w - 4, L.h * 0.6, 2, 3.4, 4, 6, 0.6);
  }
  shadeUnder(g, t, above);
}

function crown(g: G, wg: G | null, rg: G | null, P: Pal, t: Tier, plan: CityPlan, top: City['top'], R: () => number) {
  const C = plan.crown;
  const base = t.floor;
  // Palaces and halls along the tier, a park, the air-quay mast at the front.
  for (let x = t.x0 + 3; x < t.x1 - 3; x += 4 + R() * 5) tree(g, rg, R, x, base, 3 + R() * 3, P.green);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? t.x0 + 6 : C.x + C.w / 2 + 6;
    const x1 = side < 0 ? C.x - C.w / 2 - 6 : t.x1 - 30;
    if (x1 - x0 < 16) continue;
    const h = (t.floor - t.top) * 0.85;
    face(g, x0, base - h, x1 - x0, h, mix(P.stone, '#e8dcc0', 0.3));
    g.fillStyle = P.slate;
    g.fillRect(x0 - 1, base - h - 4, x1 - x0 + 2, 4);
    rimLine(rg, x0 - 1, base - h - 3.6, x1 + 1, 0.8);
    for (let x = x0 + 3; x < x1 - 4; x += 24) {
      g.fillStyle = P.copper;
      g.beginPath();
      g.arc(x + 4, base - h - 4, 4, Math.PI, 0);
      g.fill();
    }
    windows(g, wg, R, x0 + 1, base - h + 3, x1 - x0 - 2, h - 5, 2.2, 4.6, 4.6, 7.4, 0.65, true);
  }
  const cx = C.x;
  const w = C.w;
  const h = C.h;
  if (top === 'cathedral') {
    // The nave with buttresses and lancets; the west front's two towers; the crossing spire.
    const naveH = h * 0.36;
    face(g, cx - w / 2, base - naveH, w, naveH, P.stone);
    gable(g, cx - w / 2, base - naveH, w, naveH * 0.35, P.slate);
    rimLine(rg, cx - w / 2, base - naveH - naveH * 0.18, cx, 0.7);
    for (let x = cx - w / 2 + 6; x < cx + w / 2 - 6; x += 10) {
      g.fillStyle = shade(P.stone, 0.8);
      g.fillRect(x, base - naveH * 0.85, 3, naveH * 0.85);
      spire(g, rg, x + 1.5, base - naveH * 0.85, 3.5, 7, shade(P.stone, 0.9));
    }
    windows(g, wg, R, cx - w / 2 + 3, base - naveH * 0.85, w - 6, naveH * 0.7, 3, 12, 10, 14, 0.85, true);
    for (const s of [-1, 1]) {
      const tx = cx + s * (w / 2 - 9);
      face(g, tx - 8, base - h * 0.62, 16, h * 0.62, shade(P.stone, 1.05));
      windows(g, wg, R, tx - 8, base - h * 0.58, 16, h * 0.5, 3, 9, 6, 12, 0.6, true);
      spire(g, rg, tx, base - h * 0.62, 15, h * 0.26, P.slate);
      for (const q of [-1, 1]) spire(g, rg, tx + q * 7, base - h * 0.62, 2.5, 8, shade(P.stone, 0.95));
    }
    // A rose window on the crossing.
    face(g, cx - 12, base - h * 0.55, 24, h * 0.55 - naveH * 0.5, P.stone);
    g.fillStyle = '#1c1a20';
    g.beginPath();
    g.arc(cx, base - h * 0.45, 7, 0, Math.PI * 2);
    g.fill();
    if (wg) {
      for (let k = 0; k < 12; k++) {
        wg.fillStyle = ['#ffcf8a', '#e8846a', '#8aa8e8', '#ffe2a8'][k % 4];
        wg.beginPath();
        wg.moveTo(cx, base - h * 0.45);
        wg.arc(cx, base - h * 0.45, 6.4, (k / 12) * Math.PI * 2, ((k + 0.8) / 12) * Math.PI * 2);
        wg.fill();
      }
    }
    spire(g, rg, cx, base - h * 0.55, 14, h * 0.45, P.slate);
    g.fillStyle = P.trim;
    g.fillRect(cx - 0.6, base - h - 6, 1.2, 6);
    g.fillRect(cx - 2.5, base - h - 4.5, 5, 1.2);
  } else if (top === 'dome') {
    const drumH = h * 0.36;
    face(g, cx - w / 2, base - h * 0.22, w, h * 0.22, P.stone);
    g.fillStyle = shade(P.stone, 1.1);
    gable(g, cx - w * 0.18, base - h * 0.22, w * 0.36, h * 0.08, shade(P.stone, 1.05));
    for (let x = cx - w * 0.16; x < cx + w * 0.16; x += 4) g.fillRect(x, base - h * 0.2, 1.6, h * 0.18);
    windows(g, wg, R, cx - w / 2 + 2, base - h * 0.2, w * 0.3, h * 0.16, 2.4, 4, 5, 7, 0.6);
    windows(g, wg, R, cx + w * 0.2, base - h * 0.2, w * 0.28, h * 0.16, 2.4, 4, 5, 7, 0.6);
    const dw = w * 0.5;
    face(g, cx - dw / 2, base - h * 0.22 - drumH, dw, drumH, shade(P.stone, 1.05));
    for (let x = cx - dw / 2 + 2; x < cx + dw / 2 - 1; x += 4.5) {
      g.fillStyle = shade(P.stone, 1.2);
      g.fillRect(x, base - h * 0.22 - drumH + 2, 1.6, drumH - 3);
    }
    windows(g, wg, R, cx - dw / 2 + 3, base - h * 0.22 - drumH + 3, dw - 6, drumH - 6, 2, 6, 4.5, 9, 0.8, true);
    const dy = base - h * 0.22 - drumH;
    g.fillStyle = P.copper;
    g.beginPath();
    g.ellipse(cx, dy, dw * 0.52, h * 0.3, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = 'rgba(20,30,28,0.35)';
    g.lineWidth = 0.6;
    for (let k = -3; k <= 3; k++) {
      g.beginPath();
      g.ellipse(cx, dy, Math.abs(k) * dw * 0.075 + 0.1, h * 0.3, 0, Math.PI * (k < 0 ? 1 : 1.5), Math.PI * (k < 0 ? 1.5 : 2));
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.ellipse(cx + dw * 0.12, dy, dw * 0.4, h * 0.29, 0, Math.PI * 1.5, 0);
    g.fill();
    if (rg) {
      rg.fillStyle = 'rgba(255,255,255,0.7)';
      rg.beginPath();
      rg.ellipse(cx - dw * 0.18, dy - h * 0.2, dw * 0.16, h * 0.07, -0.5, 0, Math.PI * 2);
      rg.fill();
    }
    face(g, cx - 4, dy - h * 0.3 - 12, 8, 12, P.stone);
    if (wg) {
      wg.fillStyle = '#ffe2a8';
      wg.fillRect(cx - 2.5, dy - h * 0.3 - 10, 5, 7);
    }
    g.fillStyle = P.trim;
    g.beginPath();
    g.arc(cx, dy - h * 0.3 - 13, 3, Math.PI, 0);
    g.fill();
    g.fillRect(cx - 0.6, dy - h * 0.3 - 22, 1.2, 9);
    for (const s of [-1, 1]) {
      const tx = cx + s * (w / 2 - 6);
      face(g, tx - 5, base - h * 0.52, 10, h * 0.3, P.stone);
      g.fillStyle = P.copper;
      g.beginPath();
      g.ellipse(tx, base - h * 0.52, 5, 6, 0, Math.PI, 0);
      g.fill();
      windows(g, wg, R, tx - 5, base - h * 0.5, 10, h * 0.25, 2, 5, 4, 7, 0.6, true);
    }
  } else if (top === 'spires') {
    // A guild cluster: slender towers of every height, sky-bridges between.
    const n = 6 + Math.floor(R() * 4);
    const xs: [number, number, number][] = [];
    for (let k = 0; k < n; k++) {
      const q = (k + 0.5) / n;
      const tx = cx - w / 2 + q * w + (R() - 0.5) * 6;
      const tw = 7 + R() * 7;
      const th = h * (0.35 + Math.pow(1 - Math.abs(q - 0.5) * 2, 1.4) * 0.6) * (0.85 + R() * 0.2);
      xs.push([tx, tw, th]);
    }
    xs.sort((a, b) => a[2] - b[2]);
    for (const [tx, tw, th] of xs) {
      const c = R() < 0.5 ? P.stone : shade(P.stone, 0.85);
      face(g, tx - tw / 2, base - th * 0.8, tw, th * 0.8, c);
      windows(g, wg, R, tx - tw / 2, base - th * 0.78, tw, th * 0.72, 1.8, 3.4, 3.6, 5.6, 0.65);
      g.fillStyle = shade(c, 1.2);
      g.fillRect(tx - tw / 2 - 1, base - th * 0.8 - 1.5, tw + 2, 1.5);
      spire(g, rg, tx, base - th * 0.8, tw * 0.9, th * 0.2, R() < 0.5 ? P.slate : P.copper);
      if (wg && R() < 0.5) {
        wg.fillStyle = '#ff8a6a';
        wg.fillRect(tx - 0.6, base - th - 1, 1.2, 1.2);
      }
    }
    g.strokeStyle = shade(P.iron, 1.1);
    g.lineWidth = 1.4;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = xs[k];
      const b = xs[k + 1];
      const y = base - Math.min(a[2], b[2]) * 0.5;
      g.beginPath();
      g.moveTo(a[0], y);
      g.lineTo(b[0], y);
      g.stroke();
    }
  } else {
    // A stepped temple with a beacon on top.
    const steps = 5;
    for (let k = 0; k < steps; k++) {
      const sw = w * (1 - k * 0.17);
      const sh = (h * 0.8) / steps;
      const y = base - (k + 1) * sh;
      face(g, cx - sw / 2, y, sw, sh, k % 2 ? P.stone : shade(P.stone, 0.88));
      rimLine(rg, cx - sw / 2, y + 0.5, cx + sw / 2, 0.85);
      windows(g, wg, R, cx - sw / 2 + 2, y + 2, sw - 4, sh - 3, 2, 3, 6, 5, 0.6);
      g.fillStyle = P.trim;
      g.fillRect(cx - sw / 2, y + sh - 1.2, sw, 1.2);
    }
    g.fillStyle = shade(P.stone, 1.1);
    g.fillRect(cx - 3, base - h * 0.8 - h * 0.14, 6, h * 0.14);
    g.fillStyle = P.trim;
    g.beginPath();
    g.moveTo(cx - 6, base - h * 0.94);
    g.lineTo(cx, base - h);
    g.lineTo(cx + 6, base - h * 0.94);
    g.fill();
  }
  // The air-quay: a lattice mooring mast at the front of the crown.
  const mx = t.x1 - 16;
  const mh = (t.floor - t.top) * 1.9;
  g.strokeStyle = shade(P.iron, 1.15);
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(mx - 5, base);
  g.lineTo(mx - 1.2, base - mh);
  g.moveTo(mx + 5, base);
  g.lineTo(mx + 1.2, base - mh);
  for (let y = base; y > base - mh; y -= 5) {
    const k = (base - y) / mh;
    const hw = 5 - k * 3.8;
    g.moveTo(mx - hw, y);
    g.lineTo(mx + hw * 0.8, y - 5);
  }
  g.stroke();
  g.fillStyle = P.trim;
  g.beginPath();
  g.arc(mx, base - mh, 2.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = shade(P.iron, 0.9);
  g.fillRect(mx - 9, base - mh * 0.55, 18, 1.6);
  if (wg) {
    wg.fillStyle = '#ff6a4a';
    wg.fillRect(mx - 0.8, base - mh - 4, 1.6, 1.6);
    wg.fillStyle = '#ffd79a';
    wg.fillRect(mx - 9, base - mh * 0.55 - 1.4, 18, 0.8);
  }
}

// ---- the hull ------------------------------------------------------------------------------------------
function hull(g: G, wg: G | null, rg: G | null, P: Pal, plan: CityPlan, name: string, R: () => number) {
  const { hullTop: yt, hullBot: yb, jawX } = plan;
  const H = yb - yt;
  // The plates: the stern raked under, the prow squared off at the jaws' hinges.
  const path = new Path2D();
  path.moveTo(-500, yt + 6);
  path.lineTo(-494, yt);
  path.lineTo(jawX, yt);
  path.lineTo(jawX + 8, yt + 6);
  path.lineTo(jawX + 8, yb - 4);
  path.lineTo(jawX, yb);
  path.lineTo(-470, yb);
  path.lineTo(-500, yb - H * 0.35);
  path.closePath();
  const gr = g.createLinearGradient(0, yt, 0, yb);
  gr.addColorStop(0, shade(P.hull, 1.35));
  gr.addColorStop(0.18, P.hull);
  gr.addColorStop(0.8, shade(P.hull, 0.8));
  gr.addColorStop(1, shade(P.hull, 0.55));
  g.fillStyle = gr;
  g.fill(path);
  g.save();
  g.clip(path);
  // Plate seams and rivets.
  for (let k = 1; k < 5; k++) {
    const y = yt + (H * k) / 5;
    g.fillStyle = shade(P.hull, 0.6);
    g.fillRect(-500, y, 1000, 0.8);
    g.fillStyle = shade(P.hull, 1.3);
    g.fillRect(-500, y + 0.8, 1000, 0.5);
    rivets(g, -500, jawX, y - 1.6, 3.2, shade(P.hull, 1.6));
  }
  // Ribs.
  for (let x = -480; x < jawX; x += 38) {
    g.fillStyle = shade(P.hull, 0.7);
    g.fillRect(x, yt, 4, H);
    g.fillStyle = shade(P.hull, 1.25);
    g.fillRect(x, yt, 1, H);
  }
  // Rust streaks running down from the seams.
  for (let k = 0; k < 40; k++) {
    const x = -490 + R() * (jawX + 480);
    const y = yt + R() * H * 0.8;
    const gg = g.createLinearGradient(0, y, 0, y + 20 + R() * 30);
    gg.addColorStop(0, hexA(P.rust, 0.5));
    gg.addColorStop(1, hexA(P.rust, 0));
    g.fillStyle = gg;
    g.fillRect(x, y, 1.5 + R() * 3, 50);
  }
  // A band of trim; portholes; the great vents of the gut; intakes.
  g.fillStyle = P.trim;
  g.fillRect(-500, yt + H * 0.16, jawX + 500, 2.4);
  for (let x = -470; x < jawX - 20; x += 13) {
    g.fillStyle = '#141212';
    g.beginPath();
    g.arc(x, yt + H * 0.3, 2.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shade(P.trim, 0.8);
    g.beginPath();
    g.arc(x, yt + H * 0.3, 2.9, 0, Math.PI * 2);
    g.arc(x, yt + H * 0.3, 2.2, 0, Math.PI * 2, true);
    g.fill();
    if (wg && R() < 0.6) {
      wg.fillStyle = WARM[Math.floor(R() * WARM.length)];
      wg.beginPath();
      wg.arc(x, yt + H * 0.3, 2, 0, Math.PI * 2);
      wg.fill();
    }
  }
  for (let x = -440; x < jawX - 60; x += 90 + R() * 40) {
    g.fillStyle = '#100c0a';
    g.fillRect(x, yt + H * 0.62, 26, H * 0.22);
    g.fillStyle = shade(P.hull, 0.5);
    for (let k = 0; k < 6; k++) g.fillRect(x, yt + H * 0.62 + k * (H * 0.22 / 6), 26, 1.2);
  }
  // Gantries and ladders along the flank.
  g.strokeStyle = shade(P.iron, 1.3);
  g.lineWidth = 0.7;
  for (let x = -460; x < jawX - 30; x += 140 + R() * 60) {
    g.beginPath();
    g.moveTo(x, yt);
    g.lineTo(x, yb);
    g.moveTo(x + 4, yt);
    g.lineTo(x + 4, yb);
    for (let y = yt + 3; y < yb; y += 4) {
      g.moveTo(x, y);
      g.lineTo(x + 4, y);
    }
    g.stroke();
  }
  g.fillStyle = shade(P.iron, 1.1);
  g.fillRect(-500, yt + H * 0.52, jawX + 500, 1.6);
  for (let x = -500; x < jawX; x += 6) g.fillRect(x, yt + H * 0.52 - 3, 0.5, 3);
  g.restore();
  rimLine(rg, -494, yt + 0.6, jawX, 0.95, 1.6);
  // The crest (the name is stencilled live, so it reads the right way round whichever way she goes).
  void name;
  g.save();
  const nx = -60;
  g.fillStyle = hexA(P.trim, 0.85);
  g.beginPath();
  g.moveTo(nx - 150, yt + H * 0.38);
  g.lineTo(nx - 140, yt + H * 0.38);
  g.lineTo(nx - 140, yt + H * 0.5);
  g.lineTo(nx - 145, yt + H * 0.55);
  g.lineTo(nx - 150, yt + H * 0.5);
  g.fill();
  g.restore();
  // The far side's hull is darker under the near: the bottom's shadow.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(-470, yb - 3, jawX + 470, 3);
}

// ---- the bake ---------------------------------------------------------------------------------------
export type CityArt = { key: string; hull: Sprite; tiers: Sprite[]; res: number; P: Pal };
const ADS = ['GUT-WORKS BEER', 'MORE COAL!', 'SALVAGE PAID CASH', 'TIER 3 LIDO', 'SKY-TRADE EXCHANGE', 'TONIC FOR THE LUNGS', 'THE MUNICIPAL OPERA', 'TRACKS GREASED WHILE U WAIT'];
export function bakeCity(c: City, res: number): CityArt {
  const plan = cityPlan(c.seed, c.tiers, c.top, c.tracks);
  const P = palOf(c.seed);
  const R = mulberry(c.seed + 11);
  const pad = 40;
  const hs = sprite((1020 + pad) * res, (plan.hullBot - plan.hullTop + 30) * res, (510 + pad / 2) * res, (-plan.hullTop + 15) * res, res, true, true);
  hull(hs.g, hs.wg, hs.rg, P, plan, c.name, R);
  const tiers: Sprite[] = [];
  for (const t of plan.tiers) {
    const above = plan.tiers[t.i + 1];
    const extra = t.kind === 'crown' ? plan.crown.h + 30 : t.kind === 'works' ? 20 : 30;
    // A tier's lifts hang down to the tier below: the bake reaches down that far.
    const below = plan.tiers[t.i - 1];
    const drop = below ? below.deck - t.deck + 4 : 6;
    const x0 = t.x0 - 40;
    const x1 = t.x1 + 40;
    const top = t.top - extra;
    const s = sprite((x1 - x0) * res, (t.deck + drop - top) * res, -x0 * res, -top * res, res, true, true);
    const g = s.g;
    if (below) {
      // Lift shafts down the face of the tier below, a lattice each.
      for (const [lx, lyb, lyt] of plan.lifts) {
        if (Math.abs(lyt - (t.top + 10)) > 1) continue;
        g.strokeStyle = shade(P.iron, 1.2);
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(lx - 3, lyb);
        g.lineTo(lx - 3, t.floor);
        g.moveTo(lx + 3, lyb);
        g.lineTo(lx + 3, t.floor);
        for (let y = lyb; y > t.floor; y -= 6) {
          g.moveTo(lx - 3, y);
          g.lineTo(lx + 3, y - 6);
        }
        g.stroke();
        void lyt;
      }
    }
    if (t.kind === 'works') works(g, s.wg, s.rg, P, t, above, R);
    else if (t.kind === 'tenements') tenements(g, s.wg, s.rg, P, t, above, R, ADS);
    else if (t.kind === 'terraces') terraces(g, s.wg, s.rg, P, t, above, R);
    else if (t.kind === 'gardens') gardens(g, s.wg, s.rg, P, t, above, R);
    else crown(g, s.wg, s.rg, P, t, plan, c.top, R);
    deck(g, s.rg, s.wg, P, t, R);
    tiers.push(s);
  }
  return { key: `${c.seed}:${c.chimneys}`, hull: hs, tiers, res, P };
}

// ---- drawing it, live -----------------------------------------------------------------------------------
export type CityDraw = {
  /** Where the city's origin (the middle of its length, on the mud) is, and px per city unit. */
  X: number; Y: number; k: number; d: number;
  /** The caught town, drawn in the jaws. */
  inside?: (c: CanvasRenderingContext2D) => void;
  wind: number; scrollV: number;
};
/** The tint of every sprite up to the hour; one at a time unless the light has jumped. */
/**
 * The tint of every sprite up to the hour; one at a time unless the light has jumped. Each is
 * graded as it is tinted: the dust of the tracks hanging round the hull and the works, the upper
 * tiers in the warm light, the end toward the sun lit and the far end in shadow.
 */
export function retintCity(E: Env, art: CityArt, d: number, all = false, sunFront = 1) {
  const list = [art.hull, ...art.tiers];
  const n = list.length;
  let did = false;
  for (const [i, s] of list.entries()) {
    const dr = drift(E, s, d);
    if (dr > 1 || (all && dr > 0.05) || (!did && dr > 0.15)) {
      const q = i / Math.max(1, n - 1);
      const dust = mix(E.hazeCol(0.4), E.L.low, 0.3);
      tintSprite(E, s, d, (t, w, h) => {
        const lit = E.L.rim * (1 - E.night * 0.75);
        const dk = (1 - q) * (1 - q) * 0.5;
        if (dk > 0.02) {
          const g = t.createLinearGradient(0, h, 0, h * 0.25);
          g.addColorStop(0, hexA(dust, dk));
          g.addColorStop(1, hexA(dust, 0));
          t.fillStyle = g;
          t.fillRect(0, 0, w, h);
        }
        if (lit > 0.05) {
          t.globalAlpha = 0.1 * lit * q;
          t.fillStyle = E.L.sun;
          t.fillRect(0, 0, w, h);
          t.globalAlpha = 1;
          const sg = t.createLinearGradient(sunFront > 0 ? w : 0, 0, sunFront > 0 ? 0 : w, 0);
          sg.addColorStop(0, hexA(E.L.sun, 0.16 * lit));
          sg.addColorStop(0.45, hexA(E.L.sun, 0));
          sg.addColorStop(0.7, hexA(E.L.ink, 0));
          sg.addColorStop(1, hexA(E.L.ink, 0.28 * lit + 0.08));
          t.fillStyle = sg;
          t.fillRect(0, 0, w, h);
        }
      });
      did = true;
    }
  }
}

function track(E: Env, P: Pal, x: number, len: number, th: number, tread: number, d: number) {
  const c = E.ctx;
  const r = th / 2;
  const x0 = x - len / 2;
  const x1 = x + len / 2;
  const body = E.tone(shade(P.iron, 0.7), d);
  const dark = E.tone(shade(P.iron, 0.4), d);
  const lit = E.tone(shade(P.iron, 1.5), d, 0.3);
  const mud = E.tone('#4a3a2a', d);
  // The belt.
  c.fillStyle = dark;
  c.beginPath();
  c.moveTo(x0 + r, -th);
  c.lineTo(x1 - r, -th);
  c.arc(x1 - r, -r, r, -Math.PI / 2, Math.PI / 2);
  c.lineTo(x0 + r, 0);
  c.arc(x0 + r, -r, r, Math.PI / 2, Math.PI * 1.5);
  c.fill();
  // Tread plates running round: along the bottom they stand still on the mud; along the top they go twice as fast.
  const step = 9;
  const perim = 2 * (len - 2 * r) + 2 * Math.PI * r;
  const n = Math.floor(perim / step);
  const off = ((tread % step) + step) % step;
  c.fillStyle = body;
  for (let i = 0; i < n; i++) {
    let s = (i * step + off * 2) % perim;
    let px: number;
    let py: number;
    let a: number;
    const top = len - 2 * r;
    if (s < top) {
      px = x1 - r - s;
      py = -th;
      a = 0;
    } else if ((s -= top) < Math.PI * r) {
      const q = s / r;
      px = x0 + r - Math.sin(q) * r;
      py = -r - Math.cos(q) * r;
      a = -q;
    } else if ((s -= Math.PI * r) < top) {
      px = x0 + r + s;
      py = 0;
      a = Math.PI;
    } else {
      s -= top;
      const q = s / r;
      px = x1 - r + Math.sin(q) * r;
      py = -r + Math.cos(q) * r;
      a = Math.PI - q;
    }
    c.save();
    c.translate(px, py);
    c.rotate(a);
    c.fillRect(-step * 0.42, -1.5, step * 0.84, 5);
    c.restore();
  }
  // The guard over the top run, caked with mud.
  c.fillStyle = body;
  c.fillRect(x0 + r * 0.4, -th - 7, len - r * 0.8, 6);
  c.fillStyle = lit;
  c.fillRect(x0 + r * 0.4, -th - 7, len - r * 0.8, 1.2);
  c.fillStyle = mud;
  for (let k = 0; k < 10; k++) {
    const mx = x0 + r + (hsh(x, k) * (len - 2 * r));
    c.beginPath();
    c.ellipse(mx, -th - 1, 6 + hsh(k, x) * 10, 2.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  // The road wheels, the sprocket and idler.
  const nW = Math.max(3, Math.floor((len - 2 * r) / (th * 0.62)));
  const wr = th * 0.3;
  const rot = -tread / wr;
  const wheel = (wx: number, wy: number, rr: number, teeth: boolean) => {
    c.fillStyle = body;
    c.beginPath();
    c.arc(wx, wy, rr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = dark;
    c.lineWidth = Math.max(0.6, rr * 0.12);
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = rot + (k * Math.PI) / 3;
      c.moveTo(wx + Math.cos(a) * rr * 0.25, wy + Math.sin(a) * rr * 0.25);
      c.lineTo(wx + Math.cos(a) * rr * 0.85, wy + Math.sin(a) * rr * 0.85);
    }
    c.stroke();
    if (teeth) {
      c.fillStyle = body;
      for (let k = 0; k < 12; k++) {
        const a = rot + (k * Math.PI) / 6;
        c.beginPath();
        c.arc(wx + Math.cos(a) * rr * 1.05, wy + Math.sin(a) * rr * 1.05, rr * 0.12, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.fillStyle = lit;
    c.beginPath();
    c.arc(wx, wy, rr * 0.22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = hexA(lit, 0.5);
    c.lineWidth = Math.max(0.5, rr * 0.08);
    c.beginPath();
    c.arc(wx, wy, rr * 0.92, Math.PI * 1.1, Math.PI * 1.7);
    c.stroke();
  };
  for (let k = 0; k < nW; k++) wheel(x0 + r + ((k + 0.5) * (len - 2 * r)) / nW, -wr - 3, wr, false);
  wheel(x0 + r, -r, r * 0.72, true);
  wheel(x1 - r, -r, r * 0.72, true);
}

export function drawCity(E: Env, art: CityArt, c: City, o: CityDraw) {
  const plan = cityPlan(c.seed, c.tiers, c.top, c.tracks);
  const ctx = E.ctx;
  const { k, d } = o;
  const t = E.t;
  const P = art.P;
  const lit = E.L.rim * (1 - E.night * 0.5) * (1 - E.hazeOf(d) * 0.6);
  const win = clamp01(E.night * 1.05 + 0.08 + E.rain * 0.25);
  const bump = Math.sin(c.tread * 0.045) * 0.5 + Math.sin(c.tread * 0.013) * 0.6;
  ctx.save();
  ctx.translate(o.X, o.Y);
  ctx.scale(c.dir * k, k);
  // Suspension rams from the bogies up to the hull.
  const ram = E.tone(shade(P.iron, 1.1), d, 0.2);
  const ramD = E.tone(shade(P.iron, 0.55), d);
  for (const b of plan.bogies) {
    for (let q = -1; q <= 1; q += 0.5) {
      const x = b.x + q * b.len * 0.36;
      const pump = Math.sin(c.tread * 0.05 + x * 0.1) * 1.5;
      ctx.fillStyle = ramD;
      ctx.fillRect(x - 5, plan.hullBot - 2, 10, -plan.trackH - 4 - plan.hullBot);
      ctx.fillStyle = ram;
      ctx.fillRect(x - 2.5, plan.hullBot, 5, -plan.trackH - plan.hullBot - 6 + pump);
    }
  }
  // The hull, the jaws and the gut between them.
  const hy = bump * 0.4;
  ctx.save();
  ctx.translate(0, hy);
  drawMouth(E, c, plan, P, d, o.inside);
  drawSpriteLocal(ctx, art.hull, lit, win);
  stencil(E, c, plan, P, d);
  // The gut's vents breathe with the furnaces.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let x = -440, n = 0; x < plan.jawX - 60 && n < 12; x += 105, n++) {
    const fl = 0.6 + 0.4 * Math.sin(t * 3 + x);
    E.glow(x + 13, plan.hullTop + (plan.hullBot - plan.hullTop) * 0.73, 22, '#ff8a3a', (0.2 + c.gut * 0.6) * fl * (0.4 + E.night * 0.6));
  }
  ctx.restore();
  drawJaws(E, c, plan, P, d);
  ctx.restore();
  // The tracks.
  for (const b of plan.bogies) track(E, P, b.x, b.len, plan.trackH, c.tread / (c.len / 1000) / 1, d);
  scarsOn(E, c, plan, d, -1);
  // The tiers, each swaying a little on its own.
  for (const [i, tr] of plan.tiers.entries()) {
    const sw = Math.sin(t * 0.33 + i * 0.9) * 0.45 * i + Math.sin(t * 0.9 + i) * 0.15 * i;
    ctx.save();
    ctx.translate(sw, hy + bump * 0.1 * i);
    drawSpriteLocal(ctx, art.tiers[i], lit, win);
    if (i === 0) chimneys(E, c, plan, P, d);
    lifts(E, c, plan, tr, d, i);
    if (i === plan.tiers.length - 1) pennants(E, c, plan, d, o.wind);
    scarsOn(E, c, plan, d, i);
    ctx.restore();
  }
  ctx.restore();
}
/** A sprite at the current (city-unit) transform. */
function drawSpriteLocal(c: CanvasRenderingContext2D, s: Sprite, lit: number, win: number) {
  c.save();
  c.scale(1 / s.res, 1 / s.res);
  c.drawImage(s.tint, -s.ox, -s.oy);
  if (s.rimT && lit > 0.02) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = clamp01(lit) * 0.75;
    c.drawImage(s.rimT, -s.ox, -s.oy);
  }
  if (s.win && win > 0.02) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = win;
    c.drawImage(s.win, -s.ox, -s.oy);
  }
  c.restore();
}

/** The city's name in great stencilled letters along the hull, the right way round. */
function stencil(E: Env, c: City, plan: CityPlan, P: Pal, d: number) {
  const ctx = E.ctx;
  const H = plan.hullBot - plan.hullTop;
  const px = H * 0.24;
  ctx.save();
  ctx.translate(-60, plan.hullTop + H * 0.53);
  ctx.scale(c.dir, 1);
  ctx.font = `700 ${px.toFixed(1)}px Georgia, "Times New Roman", serif`;
  ctx.letterSpacing = `${(px * 0.35).toFixed(1)}px`;
  ctx.textAlign = 'center';
  ctx.fillStyle = hexA(E.tone(P.trim, d, 0.3), 0.92);
  ctx.fillText(c.name, 0, 0);
  // The stencil's bridges, cut through the letters, and wear.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 0.9;
  const w = ctx.measureText(c.name).width;
  ctx.fillRect(-w / 2 - 10, -px * 0.42, w + 20, px * 0.07);
  ctx.globalAlpha = 0.35;
  for (let k = 0; k < 40; k++) ctx.fillRect(-w / 2 + hsh(c.seed, k) * w, -px * hsh(k, c.seed), 1.5 + hsh(k, 3) * 3, 1);
  ctx.restore();
  ctx.letterSpacing = '0px';
}
/** Burnt places where fires were: soot, dead windows; past halfway healed, scaffolding over them. */
function scarsOn(E: Env, c: City, plan: CityPlan, d: number, tier: number) {
  const ctx = E.ctx;
  for (const s of c.scars) {
    // Which tier is it on (-1 the hull)?
    const ti = plan.tiers.findIndex((t) => s.ly <= t.floor && s.ly >= t.top - 4);
    if (ti !== tier) continue;
    const age = E.t - s.t0;
    const heal = Math.min(1, age / 1500);
    const a = 1 - Math.max(0, heal - 0.6) / 0.4;
    const r = s.r * 1.6;
    const g = ctx.createRadialGradient(s.lx, s.ly - r * 0.3, 0, s.lx, s.ly - r * 0.3, r);
    g.addColorStop(0, hexA('#0e0a08', 0.85 * a));
    g.addColorStop(0.6, hexA('#1a1410', 0.5 * a));
    g.addColorStop(1, hexA('#1a1410', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(s.lx, s.ly - r * 0.3, r, r * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Blown-out roofs: a jag of broken rafters.
    ctx.strokeStyle = hexA('#0a0806', 0.8 * a);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const x = s.lx - r * 0.6 + k * r * 0.24;
      ctx.moveTo(x, s.ly - r * 0.5);
      ctx.lineTo(x + (hsh(s.lx, k) - 0.5) * 4, s.ly - r * (0.9 + hsh(k, s.ly) * 0.6));
    }
    ctx.stroke();
    // Smoke still curling from it for a while.
    if (age < 90) {
      ctx.globalAlpha = 0.35 * (1 - age / 90);
      const sp = E.soft(E.tone('#3a3430', d));
      for (let k = 0; k < 4; k++) {
        const q = (E.t * 0.2 + k / 4) % 1;
        const rr = (6 + q * 20);
        ctx.drawImage(sp, s.lx - rr + q * 14 * -c.dir, s.ly - r - q * 60 - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1;
    }
    if (heal > 0.35) {
      // Scaffolding: poles and boards, raw timber.
      const sa = Math.min(1, (heal - 0.35) * 5) * a;
      ctx.strokeStyle = hexA(E.tone('#c8a878', d, 0.3), 0.8 * sa);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let x = s.lx - r * 0.8; x <= s.lx + r * 0.8; x += r * 0.4) {
        ctx.moveTo(x, s.ly);
        ctx.lineTo(x, s.ly - r * 1.5);
      }
      for (let y = s.ly - 4; y > s.ly - r * 1.5; y -= r * 0.38) {
        ctx.moveTo(s.lx - r * 0.85, y);
        ctx.lineTo(s.lx + r * 0.85, y);
      }
      ctx.stroke();
    }
  }
}

function drawMouth(E: Env, c: City, plan: CityPlan, P: Pal, d: number, inside?: (ctx: CanvasRenderingContext2D) => void) {
  const ctx = E.ctx;
  const x0 = plan.jawX - 4;
  const x1 = 515;
  const yt = plan.hullTop + 4;
  const yb = -2;
  const open = c.jaw;
  if (open < 0.02 && !inside) return;
  // The throat: dark iron ribs going back into the furnace light of the gut.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 60, yt, x1 - x0 + 80, yb - yt);
  ctx.clip();
  const g = ctx.createLinearGradient(x0 - 60, 0, x1, 0);
  g.addColorStop(0, mix('#ff9a40', E.tone('#2a1a12', d), 0.4 - c.gut * 0.3));
  g.addColorStop(0.35, E.tone('#1a1210', d));
  g.addColorStop(1, E.tone('#0e0a08', d));
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 60, yt, x1 - x0 + 80, yb - yt);
  ctx.strokeStyle = E.tone(shade(P.iron, 0.8), d);
  ctx.lineWidth = 3;
  for (let x = x0 - 50; x < x1; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, yt);
    ctx.lineTo(x - 8, yb);
    ctx.stroke();
  }
  // The conveyor in its floor; the grabs hanging in the throat.
  ctx.fillStyle = E.tone('#2a2420', d);
  ctx.fillRect(x0 - 60, yb - 10, x1 - x0 + 80, 10);
  ctx.fillStyle = E.tone('#4a4036', d, 0.2);
  for (let x = x0 - 60 + ((E.t * 20) % 8); x < x1; x += 8) ctx.fillRect(x, yb - 10, 4, 2);
  ctx.strokeStyle = E.tone('#3a3430', d, 0.1);
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    const gx = x0 - 20 + k * 24;
    const gy = yt + 20 + Math.sin(E.t * 0.7 + k) * 8;
    ctx.beginPath();
    ctx.moveTo(gx, yt);
    ctx.lineTo(gx, gy);
    ctx.moveTo(gx - 6, gy + 8);
    ctx.lineTo(gx, gy);
    ctx.lineTo(gx + 6, gy + 8);
    ctx.stroke();
  }
  ctx.restore();
  if (inside) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 60, yt - 6, 1500, yb - yt + 8);
    ctx.clip();
    inside(ctx);
    ctx.restore();
  }
  if (c.gut > 0.3 || E.night > 0.3) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    E.glow(x0 - 20, (yt + yb) / 2, 70, '#ff8a3a', 0.25 + c.gut * 0.5);
    ctx.restore();
  }
}
function drawJaws(E: Env, c: City, plan: CityPlan, P: Pal, d: number) {
  const ctx = E.ctx;
  const open = c.jaw;
  const hx = plan.jawX + 4;
  const yt = plan.hullTop;
  const yb = plan.hullBot + 2;
  const mid = (yt + yb) / 2 + 14;
  const plate = E.tone(P.hull, d);
  const plateL = E.tone(shade(P.hull, 1.4), d, 0.3);
  const plateD = E.tone(shade(P.hull, 0.6), d);
  const tooth = E.tone('#b8b0a0', d, 0.2);
  // Upper jaw: hinged at the top of the prow, swings up.
  ctx.save();
  ctx.translate(hx, yt + 4);
  ctx.rotate(-open * 0.42);
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.lineTo(70, 4);
  ctx.lineTo(96, mid - yt - 4);
  ctx.lineTo(0, mid - yt - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = plateL;
  ctx.fillRect(-4, -4, 74, 2.5);
  ctx.fillStyle = plateD;
  ctx.fillRect(0, mid - yt - 12, 96, 8);
  ctx.fillStyle = tooth;
  for (let x = 4; x < 94; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, mid - yt - 4);
    ctx.lineTo(x + 4.5, mid - yt + 9);
    ctx.lineTo(x + 9, mid - yt - 4);
    ctx.fill();
  }
  ctx.strokeStyle = plateD;
  ctx.lineWidth = 1;
  for (let x = 14; x < 90; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x + 8, mid - yt - 12);
    ctx.stroke();
  }
  ctx.restore();
  // Lower jaw: a scoop hinged at the bottom of the prow, swings down to the mud.
  ctx.save();
  ctx.translate(hx, yb - 2);
  ctx.rotate(open * 0.5);
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.lineTo(92, 2);
  ctx.lineTo(98, mid - yb + 6);
  ctx.lineTo(0, mid - yb + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = plateL;
  ctx.fillRect(0, mid - yb + 6, 98, 2);
  ctx.fillStyle = tooth;
  for (let x = 4; x < 96; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, mid - yb + 6);
    ctx.lineTo(x + 4.5, mid - yb - 6);
    ctx.lineTo(x + 9, mid - yb + 6);
    ctx.fill();
  }
  ctx.restore();
  // The hinge drums.
  ctx.fillStyle = E.tone(shade(P.iron, 1.2), d, 0.2);
  for (const y of [yt + 4, yb - 2]) {
    ctx.beginPath();
    ctx.arc(hx, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function chimneys(E: Env, c: City, plan: CityPlan, P: Pal, d: number) {
  const ctx = E.ctx;
  const n = Math.min(c.chimneys, plan.chimneys.length);
  const brick = E.tone(P.brick[0], d);
  const brickL = E.tone(shade(P.brick[0], 1.3), d, 0.4);
  const band = E.tone(shade(P.iron, 0.9), d);
  for (let i = 0; i < n; i++) {
    const [x, foot, h] = plan.chimneys[i];
    const w0 = 9;
    const w1 = 6;
    ctx.fillStyle = brick;
    ctx.beginPath();
    ctx.moveTo(x - w0 / 2, foot);
    ctx.lineTo(x - w1 / 2, foot - h);
    ctx.lineTo(x + w1 / 2, foot - h);
    ctx.lineTo(x + w0 / 2, foot);
    ctx.fill();
    ctx.fillStyle = brickL;
    ctx.fillRect(x - w1 / 2, foot - h, 1.6, h);
    ctx.fillStyle = band;
    for (let q = 0.2; q < 1; q += 0.22) ctx.fillRect(x - (w0 - (w0 - w1) * q) / 2 - 0.5, foot - h * q, w0 - (w0 - w1) * q + 1, 1.6);
    ctx.fillRect(x - w1 / 2 - 1.2, foot - h - 2, w1 + 2.4, 2.6);
    // The newest is lit at its lip.
    if (i === n - 1 && c.eaten > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      E.glow(x, foot - h - 2, 14, '#ff9a4a', 0.5 + 0.3 * Math.sin(E.t * 4));
      ctx.restore();
    }
  }
}
/** Where the city's chimney tops are, in city units (for the smoke). */
export function chimneyTops(c: City): [number, number][] {
  const plan = cityPlan(c.seed, c.tiers, c.top, c.tracks);
  return plan.chimneys.slice(0, Math.min(c.chimneys, plan.chimneys.length)).map(([x, foot, h]) => [x, foot - h - 2]);
}
function lifts(E: Env, _c: City, plan: CityPlan, tr: Tier, d: number, i: number) {
  if (i === 0) return;
  const ctx = E.ctx;
  for (const [lx, lyb, lyt] of plan.lifts) {
    if (Math.abs(lyt - (tr.top + 10)) > 1) continue;
    const q = 0.5 + 0.5 * Math.sin(E.t * 0.12 + lx * 0.07);
    const y = lyb - 6 + (tr.floor - lyb + 6) * q;
    ctx.fillStyle = E.tone('#5a4a3a', d, 0.2);
    ctx.fillRect(lx - 3.2, y - 6, 6.4, 6);
    ctx.fillStyle = hexA('#ffd79a', 0.3 + E.night * 0.7);
    ctx.fillRect(lx - 2, y - 4.5, 4, 2.5);
  }
}
function pennants(E: Env, c: City, plan: CityPlan, d: number, wind: number) {
  const ctx = E.ctx;
  const C = plan.crown;
  const tip = cityTop(plan);
  const P = palOf(c.seed);
  const flap = (x: number, y: number, len: number, col: string) => {
    ctx.fillStyle = E.tone(col, d, 0.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const lean = -1 - wind * 0.01;
    for (let q = 0; q <= 6; q++) {
      const s = q / 6;
      ctx.lineTo(x + lean * len * s, y + Math.sin(E.t * 5 - s * 4) * 2 * s + s * 1.5);
    }
    for (let q = 6; q >= 0; q--) {
      const s = q / 6;
      ctx.lineTo(x + lean * len * s, y + 4 * (1 - s * 0.7) + Math.sin(E.t * 5 - s * 4) * 2 * s + s * 1.5);
    }
    ctx.fill();
  };
  flap(C.x, tip - 2, 22, P.paint);
  const T = plan.tiers[plan.tiers.length - 1];
  flap(T.x0 + 4, T.top - 8, 12, P.trim);
  ctx.fillStyle = E.tone(P.iron, d);
  ctx.fillRect(T.x0 + 3.5, T.top - 9, 1, 18);
}

/** The live lights: fires on the tiers, the gun flashes, the searchlights' lamps (in the light pass). */
export function cityFires(E: Env, c: City, X: number, Y: number, k: number, _d: number) {
  const ctx = E.ctx;
  for (const f of c.fires) {
    const age = E.t - f.t0;
    const life = clamp01(Math.min(age / 2, (f.dur - age) / 8));
    const x = X + c.dir * f.lx * k;
    const y = Y + f.ly * k;
    const r = f.r * k * (0.8 + 0.2 * Math.sin(E.t * 9 + f.lx));
    E.glow(x, y, r * 3, '#ff7a20', 0.5 * life);
    for (let q = 0; q < 4; q++) {
      const fx = x + (hsh(f.lx, q) - 0.5) * r;
      const fh = r * (0.8 + 0.6 * Math.sin(E.t * 11 + q * 2));
      ctx.fillStyle = hexA(q % 2 ? '#ffb040' : '#ff6a20', 0.75 * life);
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.25, y);
      ctx.quadraticCurveTo(fx - r * 0.1, y - fh * 0.6, fx + Math.sin(E.t * 7 + q) * r * 0.2, y - fh);
      ctx.quadraticCurveTo(fx + r * 0.15, y - fh * 0.5, fx + r * 0.25, y);
      ctx.fill();
    }
  }
  if (E.t - c.gunT < 0.25) {
    const plan = cityPlan(c.seed, c.tiers, c.top, c.tracks);
    for (const [gx, gy] of plan.guns) {
      if (hsh(gx, Math.floor(E.t * 8)) > 0.4) continue;
      E.glow(X + c.dir * gx * k, Y + gy * k, 26 * k, '#ffd090', 0.9);
    }
  }
}
export function lampsOf(c: City): [number, number][] {
  return cityPlan(c.seed, c.tiers, c.top, c.tracks).lamps;
}
export { drawSprite };
