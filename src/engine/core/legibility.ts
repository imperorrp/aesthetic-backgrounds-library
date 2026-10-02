/**
 * Content awareness: find the page's text boxes over the canvas, answer "how quiet
 * should this point be" for layers, and paint a feathered shade behind content.
 *
 * Everything here is measured from layout, never from pixels, so it is cheap and
 * does not force GPU readbacks.
 */
import type { LightState, PxRect } from './skin';
import type { NormRect, ResolvedLegibility } from '../config';

/** Distance over which quietness falls from 1 to 0 outside a zone, in CSS px. */
export const QUIET_FEATHER = 90;
/** Shade feather in CSS px. */
const SHADE_FEATHER = 140;
/** Content boxes smaller than this in either dimension are ignored (icons, chips). */
const MIN_BOX = 40;

export function lightState(angleDeg: number, warmth: number): LightState {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // Key light sits most of the way to the edge along the direction, inside the frame.
  const reach = 0.46;
  return { angle: angleDeg, dx, dy, x: 0.5 + dx * reach, y: 0.5 + dy * reach, warmth };
}

/** Visible content boxes intersecting the canvas, in canvas CSS px. */
export function measureContent(canvas: HTMLCanvasElement, legibility: ResolvedLegibility, root: Element | null): PxRect[] {
  if (legibility.mode === 'off' || typeof document === 'undefined') return [];
  const host = canvas.getBoundingClientRect();
  if (!host.width || !host.height) return [];
  const out: PxRect[] = [];
  let nodes: NodeListOf<HTMLElement>;
  try {
    nodes = document.querySelectorAll<HTMLElement>(legibility.selector);
  } catch {
    return [];
  }
  for (const el of nodes) {
    // Skip the engine's own nodes, and any container the background is mounted in
    // (mounting into <main> must not mark the whole canvas as content).
    if ((root && root.contains(el)) || el.contains(canvas)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < MIN_BOX || r.height < MIN_BOX) continue;
    const x0 = Math.max(r.left, host.left);
    const y0 = Math.max(r.top, host.top);
    const x1 = Math.min(r.right, host.right);
    const y1 = Math.min(r.bottom, host.bottom);
    if (x1 - x0 < MIN_BOX || y1 - y0 < MIN_BOX) continue;
    out.push({ x: x0 - host.left, y: y0 - host.top, width: x1 - x0, height: y1 - y0 });
  }
  return out;
}

export function quietRectsPx(quiet: NormRect[], width: number, height: number): PxRect[] {
  return quiet.map((q) => ({ x: q.x * width, y: q.y * height, width: q.width * width, height: q.height * height }));
}

/** 1 inside any rect, smoothly to 0 at `QUIET_FEATHER` px outside. */
export function quietnessAt(rects: PxRect[], x: number, y: number): number {
  let best = 0;
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.width));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.height));
    if (dx === 0 && dy === 0) return 1;
    const d = Math.hypot(dx, dy);
    if (d >= QUIET_FEATHER) continue;
    const t = 1 - d / QUIET_FEATHER;
    const q = t * t * (3 - 2 * t);
    if (q > best) best = q;
  }
  return best;
}

/** Automatic shade: none at or below intensity 0.55, rising to 0.45 at full intensity. */
export function autoShadeStrength(legibility: ResolvedLegibility, intensity: number): number {
  if (legibility.mode === 'off') return 0;
  if (legibility.mode === 'fixed') return legibility.strength;
  const t = Math.max(0, Math.min(1, (intensity - 0.55) / 0.45));
  return t * 0.45;
}

/**
 * A full-canvas sprite holding a feathered shade over the given rects, in `color`.
 * Rebuilt only when the rects, size, strength, or color change.
 */
export function createShadePainter() {
  let sprite: HTMLCanvasElement | null = null;
  let key = '';
  return function paint(ctx: CanvasRenderingContext2D, rects: PxRect[], width: number, height: number, dpr: number, strength: number, rgb: string) {
    if (!rects.length || strength <= 0) return;
    const k = `${width}x${height}@${dpr}|${strength.toFixed(3)}|${rgb}|${rects.map((r) => `${r.x | 0},${r.y | 0},${r.width | 0},${r.height | 0}`).join(';')}`;
    if (!sprite || k !== key) {
      key = k;
      sprite = sprite ?? document.createElement('canvas');
      sprite.width = Math.max(1, Math.round(width * dpr));
      sprite.height = Math.max(1, Math.round(height * dpr));
      const sc = sprite.getContext('2d');
      if (!sc) return;
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      sc.clearRect(0, 0, width, height);
      const fill = `rgba(${rgb.split(' ').join(', ')}, ${strength})`;
      // Draw each rect far offscreen and let only its blurred shadow land in place:
      // a soft-edged shade with no hard border, at the cost of one blur per rebuild.
      sc.shadowColor = fill;
      sc.shadowBlur = SHADE_FEATHER;
      sc.shadowOffsetX = 100000;
      sc.fillStyle = '#000';
      for (const r of rects) {
        const pad = SHADE_FEATHER * 0.25;
        sc.fillRect(r.x - pad - 100000, r.y - pad, r.width + pad * 2, r.height + pad * 2);
      }
    }
    ctx.drawImage(sprite, 0, 0, width, height);
  };
}
