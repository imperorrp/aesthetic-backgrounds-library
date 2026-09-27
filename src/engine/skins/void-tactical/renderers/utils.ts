/**
 * Rendering Utilities Module
 *
 * @description Shared utilities and helpers for canvas rendering operations.
 * @module
 */

import { ASCII_ART } from './art';
import type { StructureType } from './art';
import type { Rng } from '../../../rng';
import { rgba, type Palette } from '../../../palette';

export type CanvasContext = CanvasRenderingContext2D;

/**
 * Per-frame context threaded through every renderer so nothing reads the wall clock,
 * `Math.random`, or CSS variables. `time`/`dt` are seconds since mount.
 */
export type RenderFrame = {
  time: number;
  dt: number;
  rng: Rng;
  palette: Palette;
};

export function accentRgba(palette: Palette, alpha = 1): string {
  return rgba(palette.accentRgb, alpha);
}

export const CHAR_SIZE = 14;
export const FONT = '12px "Orbit", monospace';
export const ASCII_FONT_SIZE = 6; // Slightly smaller font since the art is now larger
export const ASCII_LINE_HEIGHT = 7;
export const ASCII_TARGET_DISPLAY_HEIGHT = CHAR_SIZE * 2; // target pixel height to display ascii sprites

// Helper to snap to grid
export const snap = (val: number) => Math.floor(val / CHAR_SIZE) * CHAR_SIZE;

// ASCII Sprite Cache (module-level: sprites are pure functions of kind + color)
const asciiCache = new Map<string, HTMLCanvasElement>();

/**
 * Generates a cached canvas sprite for a multi-line ASCII art structure.
 * Uses a very small font size for detailed "icon-like" appearance.
 */
export function getAsciiSprite(kind: string, color: string) {
  // We'll compute a scale such that the final returned canvas does not exceed target height.
  const keyBase = `${kind}-${color}`;

  const art = ASCII_ART[kind as StructureType] || ["?"];

  // 1. Measure dimensions
  const c = document.createElement('canvas');
  const cx = c.getContext('2d')!;
  cx.font = `${ASCII_FONT_SIZE}px "Orbit", monospace`;

  // Find widest line
  let maxWidth = 0;
  art.forEach(line => {
    const w = cx.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  });

  // Set canvas size (with padding)
  c.width = Math.ceil(maxWidth + 4);
  c.height = Math.ceil((art.length * ASCII_LINE_HEIGHT) + 4);

  // 2. Draw
  // Re-get context after resize (safety)
  const ctx = c.getContext('2d')!;
  ctx.font = `${ASCII_FONT_SIZE}px "Orbit", monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';

  // Optional: Subtle background glow behind the ASCII to make it pop against stars
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;

  ctx.fillStyle = color;

  const centerX = c.width / 2;
  art.forEach((line, i) => {
    ctx.fillText(line, centerX, 2 + (i * ASCII_LINE_HEIGHT));
  });

  // Now scale down if needed to fit our target height to keep ascii icons visually consistent
  const scale = Math.min(1, ASCII_TARGET_DISPLAY_HEIGHT / c.height);
  const key = `${keyBase}-${Math.round(scale * 100)}`;
  if (asciiCache.has(key)) return asciiCache.get(key)!;

  if (scale < 1) {
    const scaled = document.createElement('canvas');
    scaled.width = Math.max(1, Math.round(c.width * scale));
    scaled.height = Math.max(1, Math.round(c.height * scale));
    const sc = scaled.getContext('2d')!;
    // draw scaled
    sc.imageSmoothingEnabled = true;
    sc.drawImage(c, 0, 0, scaled.width, scaled.height);
    asciiCache.set(key, scaled);
    return scaled;
  }

  asciiCache.set(key, c);
  return c;
}

// Multiplier for the speed of world rendering (stars, systems, labels)
export const WORLD_SPEED_MULTIPLIER = 7;
