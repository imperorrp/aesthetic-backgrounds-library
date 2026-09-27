/**
 * Legibility probe: sample the composited canvas behind a content rectangle and
 * report how readable text of a given color would be there. Use it in tests,
 * in the playground, or in a `skin:check` script; it is not part of the frame loop.
 */
import { contrastRatio, parseHex, relativeLuminance, type Rgb } from '../color';

export type ProbeRect = { x: number; y: number; width: number; height: number };

export type ContrastReport = {
  /** Mean relative luminance of the sampled area (0..1). */
  meanLuminance: number;
  /** Brightest sampled luminance. */
  maxLuminance: number;
  /** WCAG contrast of `textColor` against the mean sampled color. */
  meanContrast: number;
  /** WCAG contrast against the least favorable sample. */
  worstContrast: number;
  /** Share of samples whose contrast with the text falls below `threshold`. */
  failingShare: number;
  samples: number;
};

export function probeContrast(
  canvas: HTMLCanvasElement,
  rect: ProbeRect,
  textColor: string | Rgb = '#ffffff',
  { stride = 4, threshold = 4.5 }: { stride?: number; threshold?: number } = {},
): ContrastReport {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('probeContrast: 2D context unavailable');
  const text = typeof textColor === 'string' ? parseHex(textColor) ?? { r: 255, g: 255, b: 255 } : textColor;
  const sx = Math.max(0, Math.floor(rect.x));
  const sy = Math.max(0, Math.floor(rect.y));
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.floor(rect.width)));
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.floor(rect.height)));
  const data = ctx.getImageData(sx, sy, sw, sh).data;

  let sum = 0;
  let max = 0;
  let worst = Infinity;
  let failing = 0;
  let n = 0;
  let acc: Rgb = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < sh; y += stride) {
    for (let x = 0; x < sw; x += stride) {
      const i = (y * sw + x) * 4;
      const a = data[i + 3] / 255;
      // Composite over black for transparent pixels (canvas over a dark page); callers
      // with light pages should probe the composited screenshot instead.
      const px: Rgb = { r: data[i] * a, g: data[i + 1] * a, b: data[i + 2] * a };
      const lum = relativeLuminance(px);
      const ratio = contrastRatio(text, px);
      sum += lum;
      if (lum > max) max = lum;
      if (ratio < worst) worst = ratio;
      if (ratio < threshold) failing++;
      acc = { r: acc.r + px.r, g: acc.g + px.g, b: acc.b + px.b };
      n++;
    }
  }
  const mean: Rgb = n ? { r: acc.r / n, g: acc.g / n, b: acc.b / n } : { r: 0, g: 0, b: 0 };
  return {
    meanLuminance: n ? sum / n : 0,
    maxLuminance: max,
    meanContrast: contrastRatio(text, mean),
    worstContrast: n ? worst : 21,
    failingShare: n ? failing / n : 0,
    samples: n,
  };
}
