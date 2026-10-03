/**
 * Ship silhouettes. Each class is a small vector hull pointing along +x in unit
 * space (nose at x = 1), scaled to the class size and rotated to the heading.
 * Drawn as paths every frame so they stay crisp at any angle.
 */
import type { ShipClass } from './universe';
import { getGlowSprite, hexRgba } from './renderers/utils';

export type ShipSpec = {
  /** Hull length in px (nose to tail). */
  size: number;
  /** Cruise speed in map px per second. */
  speed: number;
  /** Turn responsiveness of wingmen (spring stiffness). */
  agility: number;
  /** Closed polygons in unit space. */
  hull: number[][];
  /** Open strokes for detail (spines, decks), in unit space. */
  detail?: number[][];
  /** Engine nozzle positions (unit space), for the exhaust glow. */
  engines: number[][];
};

export const SHIP_SPECS: Record<ShipClass, ShipSpec> = {
  // Swept dart.
  fighter: {
    size: 10.5,
    speed: 46,
    agility: 7,
    hull: [[1, 0, -0.7, 0.62, -0.35, 0, -0.7, -0.62]],
    engines: [[-0.42, 0]],
  },
  // Needle with a sensor mast.
  scout: {
    size: 10.5,
    speed: 56,
    agility: 8,
    hull: [[1, 0, 0.1, 0.2, -0.85, 0.16, -0.85, -0.16, 0.1, -0.2]],
    detail: [[0.1, 0, -0.2, 0.55], [-0.2, 0.55, -0.45, 0.55]],
    engines: [[-0.85, 0]],
  },
  // Spine with container blocks and a cab.
  freighter: {
    size: 15,
    speed: 20,
    agility: 3,
    hull: [
      [1, 0, 0.72, 0.2, 0.55, 0.2, 0.55, -0.2, 0.72, -0.2],
      [0.42, 0.34, 0.08, 0.34, 0.08, -0.34, 0.42, -0.34],
      [-0.02, 0.34, -0.36, 0.34, -0.36, -0.34, -0.02, -0.34],
      [-0.46, 0.34, -0.8, 0.34, -0.8, -0.34, -0.46, -0.34],
    ],
    detail: [[0.55, 0, -0.95, 0]],
    engines: [[-0.95, 0.16], [-0.95, -0.16]],
  },
  // Long hull with an engine block and a dorsal ridge.
  cruiser: {
    size: 20,
    speed: 26,
    agility: 3.5,
    hull: [[1, 0, 0.55, 0.2, -0.55, 0.24, -0.62, 0.36, -1, 0.36, -1, -0.36, -0.62, -0.36, -0.55, -0.24, 0.55, -0.2]],
    detail: [[0.6, 0, -0.5, 0]],
    engines: [[-1, 0.2], [-1, -0.2]],
  },
  // Flat deck with an island.
  carrier: {
    size: 22,
    speed: 21,
    agility: 2.5,
    hull: [[0.92, 0.3, 1, 0.12, 1, -0.12, 0.92, -0.3, -1, -0.3, -1, 0.3]],
    detail: [[0.8, 0.1, -0.85, 0.1], [0.8, -0.1, -0.85, -0.1], [-0.2, 0.3, -0.2, 0.48, -0.45, 0.48, -0.45, 0.3]],
    engines: [[-1, 0.18], [-1, 0], [-1, -0.18]],
  },
  // Hammerhead dreadnought.
  capital: {
    size: 29,
    speed: 15,
    agility: 1.8,
    hull: [[1, 0.42, 0.78, 0.42, 0.62, 0.16, -0.7, 0.26, -1, 0.14, -1, -0.14, -0.7, -0.26, 0.62, -0.16, 0.78, -0.42, 1, -0.42, 0.9, 0]],
    detail: [[0.62, 0, -0.8, 0], [0.2, 0.18, 0.2, -0.18], [-0.3, 0.22, -0.3, -0.22]],
    engines: [[-1, 0.08], [-1, -0.08]],
  },
};

const poly = (ctx: CanvasRenderingContext2D, pts: number[]) => {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
};

/**
 * Draw one ship. `flicker` (0..1) varies the exhaust; `thrust` (0..1) scales it.
 * Line widths are divided by the scale so strokes stay ~1 px.
 */
export function drawShip(
  ctx: CanvasRenderingContext2D,
  cls: ShipClass,
  x: number,
  y: number,
  heading: number,
  color: string,
  alpha: number,
  thrust: number,
  flicker: number,
  scale = 1,
): void {
  const spec = SHIP_SPECS[cls];
  const s = (spec.size / 2) * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);

  // Exhaust: short additive plumes behind each nozzle (a cached glow, stretched).
  if (thrust > 0.05 && alpha > 0.05) {
    ctx.globalCompositeOperation = 'lighter';
    const len = s * (0.55 + 0.5 * thrust) * (0.8 + 0.4 * flicker);
    const glow = getGlowSprite(color, 16);
    const wide = Math.max(1.4, s * 0.22);
    ctx.globalAlpha = Math.min(1, alpha * thrust * 0.9);
    for (const [ex, ey] of spec.engines) {
      ctx.drawImage(glow, ex * s - len * 1.45, ey * s - wide, len * 2, wide * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  // Body: a dark core with a bright rim reads as a silhouette on any background.
  ctx.beginPath();
  for (const p of spec.hull) {
    poly(ctx, p);
    ctx.closePath();
  }
  ctx.fillStyle = hexRgba(color, 0.32 * alpha);
  ctx.fill();
  ctx.lineWidth = 1.15 / s;
  ctx.strokeStyle = hexRgba(color, 0.95 * alpha);
  ctx.stroke();
  if (spec.detail) {
    ctx.beginPath();
    for (const d of spec.detail) poly(ctx, d);
    ctx.lineWidth = 0.8 / s;
    ctx.strokeStyle = hexRgba(color, 0.55 * alpha);
    ctx.stroke();
  }
  ctx.restore();
}

/** Formation slots (leader-local: -x is behind, Â±y is the flanks), in units of ship spacing. */
export const FORMATIONS = {
  solo: [] as number[][],
  v: [[-1, -1], [-1, 1], [-2, -2], [-2, 2], [-3, -3], [-3, 3]],
  line: [[0, -1], [0, 1], [0, -2], [0, 2]],
  column: [[-1, 0], [-2, 0], [-3, 0], [-4, 0], [-5, 0]],
  echelon: [[-1, 1], [-2, 2], [-3, 3], [-4, 4]],
  escort: [[-0.6, -1.3], [-0.6, 1.3], [-1.8, -1.6], [-1.8, 1.6]],
} as const;

export type Formation = keyof typeof FORMATIONS;
