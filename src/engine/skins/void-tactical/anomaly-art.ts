/**
 * Animated ASCII anomalies. Each style is a tiny procedural animation drawn with
 * monospace glyphs inside a ring in the anomaly's own color, with a sonar ping that
 * expands from the ring every few seconds. Everything is a function of time and a
 * per-anomaly phase, so it replays exactly.
 */
import type { AnomalyStyle } from './universe';
import { hexRgba } from './renderers/utils';

export const ANOMALY_RING = 13;
const GLYPH_FONT = '10px "Syne Mono", "Orbit", ui-monospace, monospace';
const SMALL_FONT = '8px "Syne Mono", "Orbit", ui-monospace, monospace';

/** Integer hash to [0, 1). */
export const hash2 = (a: number, b: number): number => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

type Glyph = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number, color: string, a: number) => void;

const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, alpha: number) => {
  ctx.fillStyle = hexRgba(color, alpha);
  ctx.fillText(s, x, y);
};

const rows = (ctx: CanvasRenderingContext2D, lines: readonly string[], x: number, y: number, color: string, alpha: number, lh = 8) => {
  const top = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => text(ctx, l, x, top + i * lh, color, alpha));
};

const GLYPHS: Record<AnomalyStyle, Glyph> = {
  // Concentric ripples spreading from a point.
  wave(ctx, x, y, t, seed, c, a) {
    const frames = ['·', '( · )', '(( · ))', '( ( · ) )'];
    const f = Math.floor(t * 2.2 + seed * 4) % frames.length;
    ctx.font = f === 3 ? SMALL_FONT : GLYPH_FONT;
    text(ctx, frames[f], x, y, c, a);
  },

  // A jagged tear whose edges glitch and throw sparks.
  rift(ctx, x, y, t, seed, c, a) {
    ctx.font = GLYPH_FONT;
    const step = Math.floor(t * 3 + seed * 9);
    const flip = step % 2;
    for (let i = 0; i < 4; i++) {
      const zig = (i + flip) % 2;
      const glitch = hash2(step, i + seed * 97) < 0.12;
      const ch = glitch ? '#%&*'[Math.floor(hash2(i, step) * 4)] : zig ? '/' : '\\';
      text(ctx, ch, x + (zig ? -1.5 : 1.5), y + (i - 1.5) * 7, c, a * (glitch ? 0.6 : 1));
    }
    ctx.font = SMALL_FONT;
    for (let k = 0; k < 2; k++) {
      const h = hash2(step + k * 31, seed * 13 + k);
      if (h < 0.55) text(ctx, k ? '+' : '·', x + (hash2(step, k + 5) - 0.5) * 18, y + (hash2(k, step + 9) - 0.5) * 22, c, a * 0.7);
    }
  },

  // Matter spiralling inward to a point.
  singularity(ctx, x, y, t, seed, c, a) {
    ctx.font = SMALL_FONT;
    for (let ring = 0; ring < 2; ring++) {
      const k = (t * 0.35 + ring * 0.5 + seed) % 1;
      const r = 11 - k * 9;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + t * (1.2 + k * 2.5) + ring;
        text(ctx, k > 0.65 ? ':' : '.', x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.85, c, a * (0.35 + 0.65 * k));
      }
    }
    ctx.font = GLYPH_FONT;
    text(ctx, 'o', x, y, c, a);
  },

  // A field of flickering quantum noise.
  cloud(ctx, x, y, t, seed, c, a) {
    ctx.font = SMALL_FONT;
    const step = Math.floor(t * 5);
    const chars = ' ·.:∴∵';
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 4; col++) {
        const h = hash2(step + r * 7 + col * 13, seed * 101);
        const ch = chars[Math.floor(h * chars.length)];
        if (ch !== ' ') text(ctx, ch, x + (col - 1.5) * 5.5, y + (r - 1) * 6.5, c, a * (0.4 + 0.6 * hash2(col, step + r)));
      }
    }
  },

  // An hourglass that drains and turns over.
  temporal(ctx, x, y, t, seed, c, a) {
    ctx.font = SMALL_FONT;
    const frames = [
      ['\\###/', ' \\#/ ', '  :  ', ' / \\ ', '/___\\'],
      ['\\_##/', ' \\#/ ', '  :  ', ' /:\\ ', '/_#_\\'],
      ['\\__#/', ' \\:/ ', '  :  ', ' /#\\ ', '/_##\\'],
      ['\\___/', ' \\ / ', '  :  ', ' /#\\ ', '/###\\'],
    ];
    const f = Math.floor(t * 1.4 + seed * 4) % frames.length;
    rows(ctx, frames[f], x, y, c, a, 5.5);
  },

  // A star that keeps flaring.
  burst(ctx, x, y, t, seed, c, a) {
    ctx.font = GLYPH_FONT;
    const frames = [
      [' . ', '.+.', ' . '],
      ['\\|/', '-*-', '/|\\'],
      ['\\ /', ' * ', '/ \\'],
      ['\\|/', '-*-', '/|\\'],
    ];
    const f = Math.floor(t * 2.6 + seed * 4) % frames.length;
    rows(ctx, frames[f], x, y, c, a * (f === 1 ? 1 : 0.8), 7);
  },

  // A signal waveform scrolling through.
  psionic(ctx, x, y, t, seed, c, a) {
    ctx.font = SMALL_FONT;
    const wave = '~∿-~∿~-∿~∿-~';
    const o = Math.floor(t * 7 + seed * 12);
    for (let r = 0; r < 2; r++) {
      let s = '';
      for (let i = 0; i < 5; i++) s += wave[(o + i + r * 3) % wave.length];
      text(ctx, s, x, y + (r - 0.5) * 7, c, a * (r ? 0.6 : 1));
    }
  },

  // A glyph that cannot settle on a shape.
  exotic(ctx, x, y, t, seed, c, a) {
    const glyphs = ['◇', '◈', '◆', '◈'];
    ctx.font = GLYPH_FONT;
    text(ctx, glyphs[Math.floor(t * 2 + seed * 4) % glyphs.length], x, y, c, a);
    ctx.font = SMALL_FONT;
    for (let i = 0; i < 3; i++) {
      const ang = t * (0.9 + i * 0.4) + i * 2.1 + seed * 6;
      text(ctx, '·', x + Math.cos(ang) * 8, y + Math.sin(ang) * 8, c, a * 0.7);
    }
  },
};

/**
 * Draw an anomaly centered at (x, y). `seed` (0..1) desynchronizes anomalies of the
 * same style; `alpha` scales everything (fade in/out, HUD level).
 */
export function drawAnomaly(
  ctx: CanvasRenderingContext2D,
  style: AnomalyStyle,
  x: number,
  y: number,
  t: number,
  seed: number,
  color: string,
  alpha: number,
  lineWeight = 1,
): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Soft core, ring, and the four ticks of a sensor reticle.
  ctx.fillStyle = hexRgba(color, 0.08 * alpha);
  ctx.beginPath();
  ctx.arc(x, y, ANOMALY_RING, 0, Math.PI * 2);
  ctx.fill();
  const breathe = 0.75 + 0.25 * Math.sin(t * 1.7 + seed * 6.28);
  ctx.strokeStyle = hexRgba(color, 0.55 * alpha * breathe);
  ctx.lineWidth = lineWeight;
  ctx.beginPath();
  ctx.arc(x, y, ANOMALY_RING, 0, Math.PI * 2);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.moveTo(x + Math.cos(ang) * (ANOMALY_RING + 2), y + Math.sin(ang) * (ANOMALY_RING + 2));
    ctx.lineTo(x + Math.cos(ang) * (ANOMALY_RING + 5), y + Math.sin(ang) * (ANOMALY_RING + 5));
  }
  ctx.stroke();

  // Sonar ping.
  const period = 2.8;
  const k = ((t + seed * period) % period) / period;
  if (k < 0.85) {
    ctx.strokeStyle = hexRgba(color, 0.4 * alpha * (1 - k / 0.85));
    ctx.beginPath();
    ctx.arc(x, y, ANOMALY_RING + k * 26, 0, Math.PI * 2);
    ctx.stroke();
  }

  GLYPHS[style](ctx, x, y, t, seed, color, alpha);
  ctx.restore();
}
