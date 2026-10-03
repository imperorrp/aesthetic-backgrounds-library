/**
 * Shared parts for the instrument skins: color helpers, a deterministic hash, typed
 * text, tick rulers, and a phosphor buffer (a private canvas that fades over time,
 * so things painted by a sweep glow and then decay, as on a real scope).
 */
import { parseHex, toTriplet } from '../../color';
import { rgba } from '../../palette';

export const MONO = '"Syne Mono", "Orbit", ui-monospace, "SFMono-Regular", Menlo, monospace';
export const mono = (px: number, weight = '') => `${weight ? `${weight} ` : ''}${px}px ${MONO}`;

/** `rgba()` for a hex color. */
export function hexA(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  return rgb ? rgba(toTriplet(rgb), Math.max(0, Math.min(1, alpha))) : `rgba(255,255,255,${alpha})`;
}

/** Mix two hex colors (0 = a, 1 = b) into an rgb triplet. */
export function mixRgb(a: string, b: string, k: number): [number, number, number] {
  const x = parseHex(a) ?? { r: 0, g: 0, b: 0 };
  const y = parseHex(b) ?? { r: 255, g: 255, b: 255 };
  return [x.r + (y.r - x.r) * k, x.g + (y.g - x.g) * k, x.b + (y.b - x.b) * k];
}

/** fillText on whole device pixels (reads the canvas scale), so small type stays sharp. */
export function fillCrisp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  const d = ctx.getTransform?.().a || 1;
  ctx.fillText(text, Math.round(x * d) / d, Math.round(y * d) / d);
}

/** Integer hash to [0, 1). */
export const hash = (a: number, b = 0, c = 0): number => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** Text revealed at `cps` characters per second, with a block cursor while typing. */
export function typed(text: string, age: number, cps = 40, t = age): string {
  const n = Math.floor(Math.max(0, age) * cps);
  if (n >= text.length) return text;
  return text.slice(0, n) + (Math.floor(t * 8) % 2 === 0 ? '█' : '');
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/** A private canvas that keeps what is painted on it and fades it each frame. */
export type Phosphor = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  resize(width: number, height: number, dpr: number): void;
  /** Fade toward transparent with half-life `halfLife` seconds. */
  decay(dt: number, halfLife: number): void;
  draw(target: CanvasRenderingContext2D, width: number, height: number, composite?: GlobalCompositeOperation): void;
};

export function createPhosphor(): Phosphor {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let carry = 0;
  return {
    ctx,
    canvas,
    resize(width, height, dpr) {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    decay(dt, halfLife) {
      // Accumulate tiny fades so very small dt still decays (8-bit alpha rounds them away).
      carry += dt;
      if (carry < 1 / 30) return;
      const keep = Math.pow(0.5, carry / halfLife);
      carry = 0;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${1 - keep})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
    draw(target, width, height, composite = 'lighter') {
      target.save();
      target.globalCompositeOperation = composite;
      target.drawImage(canvas, 0, 0, width, height);
      target.restore();
    },
  };
}

/** Fill the canvas with the palette background and a soft vignette toward the edges. */
export function plate(ctx: CanvasRenderingContext2D, width: number, height: number, bg: string, tint: string, cx = 0.5, cy = 0.5, strength = 0.12) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const r = Math.hypot(width, height) * 0.6;
  const g = ctx.createRadialGradient(width * cx, height * cy, 0, width * cx, height * cy, r);
  g.addColorStop(0, hexA(tint, strength));
  g.addColorStop(0.6, hexA(tint, strength * 0.35));
  g.addColorStop(1, hexA(bg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

/** Faint horizontal scan lines over an area, for a CRT feel. */
export function scanlines(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, alpha: number, gap = 3) {
  ctx.fillStyle = hexA(color, alpha);
  for (let y = 0; y < height; y += gap) ctx.fillRect(0, y, width, 1);
}

/** Fictional five-letter navigation fix names. */
export function fixName(seed: number): string {
  const c = 'BCDFGKLMNPRSTVZ';
  const v = 'AEIOU';
  const pick = (s: string, k: number) => s[Math.floor(hash(seed, k) * s.length)];
  return `${pick(c, 1)}${pick(v, 2)}${pick(c, 3)}${pick(v, 4)}${pick(c, 5)}`;
}
