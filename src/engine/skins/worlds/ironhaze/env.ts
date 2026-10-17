/**
 * What Ironhaze's drawing modules share with its painter: the canvas, the world, and how a colour
 * looks at a depth at this hour.
 */
import type { HazeWorld } from './types';

export type Env = {
  ctx: CanvasRenderingContext2D;
  world: HazeWorld;
  u: number;
  /** A colour at a depth: shaded by the hour, faded into the haze by the distance (lift: toward the light). */
  tone(c: string, f: number, lift?: number): string;
  hazeOf(f: number): number;
  /** A soft additive light. */
  glow(x: number, y: number, r: number, color: string, a: number): void;
  night(): number;
  serif(px: number, italic?: boolean): string;
};

export function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
