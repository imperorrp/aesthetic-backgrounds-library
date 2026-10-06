/**
 * Color ramps: a gradient through color stops, as a 256-entry RGB lookup, interpolated in
 * OKLCH (so midtones stay vivid instead of going grey). Fields are drawn through ramps.
 */
import { hexToOklch, mixOklch, oklchToRgb } from '../color';

export type Ramp = Uint8ClampedArray;

/** Stops are [position 0..1, hex]. */
export function makeRamp(stops: [number, string][]): Ramp {
  const out = new Uint8ClampedArray(256 * 3);
  const s = [...stops].sort((a, b) => a[0] - b[0]);
  const lab = s.map(([, h]) => hexToOklch(h) ?? { l: 0, c: 0, h: 0 });
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const span = Math.max(1e-6, s[k + 1][0] - s[k][0]);
    const u = Math.max(0, Math.min(1, (t - s[k][0]) / span));
    const { r, g, b } = oklchToRgb(mixOklch(lab[k], lab[k + 1], u));
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}

/** A glowing ink ramp for one color: black → deep → the color → near white. */
export function inkRamp(color: string, deep = '#05040a', hot = '#fffaf0'): Ramp {
  const c = hexToOklch(color) ?? { l: 0.7, c: 0.15, h: 200 };
  const dark = { l: c.l * 0.35, c: c.c * 0.9, h: c.h };
  const toHex = (o: { l: number; c: number; h: number }) => {
    const { r, g, b } = oklchToRgb(o);
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  };
  return makeRamp([
    [0, deep],
    [0.25, toHex(dark)],
    [0.62, color],
    [1, hot],
  ]);
}
