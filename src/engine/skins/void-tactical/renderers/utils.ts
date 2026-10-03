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
import { hexToOklch, oklchToHex, parseHex, toTriplet } from '../../../color';
import type { UniversePack } from '../universe';

export type CanvasContext = CanvasRenderingContext2D;

/** Calibration knobs resolved from the skin schema. */
export type VoidStyle = {
  /** 0 = every entity color pulled into the palette family, 1 = original rainbow. */
  hueVariety: number;
  /** Multiplier on stroke widths. */
  lineWeight: number;
  /** ASCII sprite height multiplier. */
  spriteScale: number;
  /** Ship silhouette size multiplier. */
  shipScale: number;
  /** Opacity of HUD text: labels, telemetry, chatter. */
  hud: number;
  /** Fleet predicted-path rendering. */
  paths: 'dots' | 'dashed' | 'off';
  /** Fleet history trail opacity. */
  trails: number;
  /** Periodic target lock on a contact. */
  lock: boolean;
};

/**
 * Per-frame context threaded through every renderer so nothing reads the wall clock,
 * `Math.random`, or CSS variables. `time`/`dt` are seconds since mount.
 */
export type RenderFrame = {
  time: number;
  dt: number;
  rng: Rng;
  palette: Palette;
  style: VoidStyle;
  /** Host intensity 0..1. */
  intensity: number;
  /** Map an authored entity color into the palette family per `style.hueVariety` (memoized). */
  color(hex: string): string;
  /** The universe this map belongs to. */
  pack: UniversePack;
  /** Screen x = world x - camera.x * parallax for the map plane. */
  parallax: number;
  /** Backing-store pixels per CSS pixel, for snapping text and sprites. */
  dpr: number;
};

export function accentRgba(palette: Palette, alpha = 1): string {
  return rgba(palette.accentRgb, alpha);
}

/** `rgba()` for any hex color. */
export function hexRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  return rgb ? rgba(toTriplet(rgb), alpha) : `rgba(255,255,255,${alpha})`;
}

/**
 * Build the color mapper for a frame: keeps each authored color's lightness, pulls
 * its hue toward the palette accent and its chroma toward the accent's chroma by
 * `1 - hueVariety`. Memoized per (hex, variety, accent).
 */
export function createColorMapper(palette: Palette, hueVariety: number): (hex: string) => string {
  const cache = new Map<string, string>();
  const accent = hexToOklch(palette.accent) ?? { l: 0.7, c: 0.12, h: 200 };
  const k = 1 - Math.max(0, Math.min(1, hueVariety));
  return (hex: string) => {
    const hit = cache.get(hex);
    if (hit) return hit;
    const src = hexToOklch(hex);
    let out = hex;
    if (src && k > 0) {
      // Near-greys keep their hue-lessness; only chromatic colors get pulled.
      if (src.c > 0.02) {
        let dh = accent.h - src.h;
        if (dh > 180) dh -= 360;
        if (dh < -180) dh += 360;
        out = oklchToHex({
          l: src.l,
          c: src.c + (Math.min(src.c, accent.c * 1.1) - src.c) * k * 0.6,
          h: (src.h + dh * k + 360) % 360,
        });
      }
    }
    cache.set(hex, out);
    return out;
  };
}

export const CHAR_SIZE = 14;
export const FONT = '12px "Orbit", monospace';
/** Base display height of ASCII sprites at spriteScale 1. */
export const SPRITE_BASE_HEIGHT = 30;

// Helper to snap to grid
export const snap = (val: number) => Math.floor(val / CHAR_SIZE) * CHAR_SIZE;

/** A sprite canvas at device resolution, with its size in CSS pixels. */
export type Sprite = HTMLCanvasElement & { cssW: number; cssH: number };

// ASCII Sprite Cache (module-level: sprites are pure functions of art + color + height + dpr)
const asciiCache = new Map<string, Sprite>();

/** Snap a CSS-pixel coordinate to the device pixel grid so text and 1px lines stay sharp. */
export const crispPx = (v: number, dpr = 1) => Math.round(v * dpr) / dpr;

/** Draw a sprite at its CSS size, snapped to device pixels. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, cx: number, cy: number, dpr = 1) {
  ctx.drawImage(s, crispPx(cx - s.cssW / 2, dpr), crispPx(cy - s.cssH / 2, dpr), s.cssW, s.cssH);
}

/**
 * Cached canvas sprite for a multi-line ASCII art structure, rendered directly at
 * the font size that yields `targetHeight` so glyphs stay crisp (no downscaling).
 */
export function getAsciiSprite(kind: string, color: string, targetHeight = SPRITE_BASE_HEIGHT, dpr = 1): Sprite {
  return getArtSprite(ASCII_ART[kind as StructureType] || ['?'], kind, color, targetHeight, dpr);
}

/**
 * Cached sprite for arbitrary ASCII art, rendered at device resolution: a soft glow
 * underneath and a sharp copy of the glyphs on top, so the art reads crisply.
 */
export function getArtSprite(art: readonly string[], id: string, color: string, targetHeight = SPRITE_BASE_HEIGHT, dpr = 1): Sprite {
  const lines = Math.max(1, art.length);
  const fontSize = Math.max(5, Math.min(18, Math.round((targetHeight / lines) * 0.92)));
  const scale = Math.max(1, Math.min(3, dpr));
  const key = `${id}|${art.join('\n')}|${color}|${fontSize}|${scale}`;
  const hit = asciiCache.get(key);
  if (hit) return hit;

  const lineHeight = Math.round(fontSize * 1.12);
  const c = document.createElement('canvas') as Sprite;
  const measure = c.getContext('2d')!;
  measure.font = `${fontSize}px "Orbit", "Syne Mono", ui-monospace, monospace`;
  let maxWidth = 0;
  for (const line of art) maxWidth = Math.max(maxWidth, measure.measureText(line).width);

  const pad = 4;
  c.cssW = Math.max(1, Math.ceil(maxWidth + pad * 2));
  c.cssH = Math.max(1, lines * lineHeight + pad * 2);
  c.width = Math.ceil(c.cssW * scale);
  c.height = Math.ceil(c.cssH * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.font = `${fontSize}px "Orbit", "Syne Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  const cx = c.cssW / 2;
  // Glow pass, then a crisp pass with no shadow.
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(2, fontSize * 0.45) * scale;
  ctx.globalAlpha = 0.55;
  art.forEach((line, i) => ctx.fillText(line, cx, pad + i * lineHeight));
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1;
  art.forEach((line, i) => ctx.fillText(line, cx, pad + i * lineHeight));
  asciiCache.set(key, c);
  return c;
}

/** Cached soft radial glow sprite for halos (avoids shadowBlur in the frame loop). */
const glowCache = new Map<string, HTMLCanvasElement>();
export function getGlowSprite(color: string, radius: number): HTMLCanvasElement {
  const r = Math.max(2, Math.round(radius));
  const key = `${color}|${r}`;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = r * 2;
  c.height = r * 2;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, hexRgba(color, 0.55));
  g.addColorStop(0.5, hexRgba(color, 0.18));
  g.addColorStop(1, hexRgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  glowCache.set(key, c);
  return c;
}

// Multiplier for the speed of world rendering (stars, systems, labels)
export const WORLD_SPEED_MULTIPLIER = 7;
