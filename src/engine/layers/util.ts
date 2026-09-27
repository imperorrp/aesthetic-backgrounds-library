/** Shared helpers for the standard layer library. */
import { hexToOklch, oklchToHex, parseHex, toTriplet } from '../color';
import type { LayerHost } from '../core/layer';
import { resolveColor, type ResolvedColor } from '../core/schema';

export const TAU = Math.PI * 2;

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export function color(host: LayerHost, value: string): ResolvedColor {
  return resolveColor(value, host.palette);
}

export const rgbaOf = (c: ResolvedColor, alpha: number) => `rgba(${c.rgb.split(' ').join(', ')}, ${alpha})`;

/** Shift a hex color's hue in OKLCH and optionally override lightness/chroma. */
export function shiftHue(hex: string, degrees: number, l?: number, c?: number): string {
  const lch = hexToOklch(hex);
  if (!lch) return hex;
  return oklchToHex({ l: l ?? lch.l, c: c ?? lch.c, h: (lch.h + degrees + 360) % 360 });
}

export function tripletOf(hex: string): string {
  const rgb = parseHex(hex);
  return rgb ? toTriplet(rgb) : '128 128 128';
}

/** Cached soft radial sprite for cheap glows (no shadowBlur in the frame loop). */
const spriteCache = new Map<string, HTMLCanvasElement>();
export function glowSprite(rgb: string, radius: number, falloff = 1): HTMLCanvasElement {
  const key = `${rgb}|${radius}|${falloff}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const size = Math.max(2, Math.ceil(radius * 2));
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  const parts = rgb.split(' ').join(', ');
  g.addColorStop(0, `rgba(${parts}, 1)`);
  g.addColorStop(Math.min(0.99, 0.35 / falloff), `rgba(${parts}, 0.45)`);
  g.addColorStop(1, `rgba(${parts}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

/** Wrap a coordinate into [0, size). */
export const wrap = (v: number, size: number) => ((v % size) + size) % size;

/** Frames elapsed at 60 fps, for motion constants written per-frame. */
export const frames60 = (dt: number) => dt * 60;
