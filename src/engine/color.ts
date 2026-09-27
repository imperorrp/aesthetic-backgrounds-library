/**
 * Small color toolkit: hex <-> sRGB <-> OKLCH, mixing, and contrast.
 * OKLCH is used for palette derivation because equal steps look equal.
 */

export type Rgb = { r: number; g: number; b: number }; // 0..255
export type Oklch = { l: number; c: number; h: number }; // l 0..1, c ~0..0.4, h degrees

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function parseHex(hex: string): Rgb | null {
  const m = hex.trim().replace(/^#/, '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** "6 182 212" style triplet for use in `rgb(var(--x) / a)`. */
export function toTriplet({ r, g, b }: Rgb): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

const srgbToLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (v: number) => {
  const c = clamp01(v);
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
};

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const A = Math.cos(hr) * c;
  const B = Math.sin(hr) * c;
  const l_ = l + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = l - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = l - 0.0894841775 * A - 1.291485548 * B;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const b = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

/** OKLCH -> hex, pulling chroma in until the color fits in sRGB. */
export function oklchToHex(color: Oklch): string {
  let c = color.c;
  for (let i = 0; i < 12; i++) {
    const rgb = oklchToRgb({ ...color, c });
    const inGamut = [rgb.r, rgb.g, rgb.b].every((v) => v >= -0.5 && v <= 255.5);
    if (inGamut) return toHex(rgb);
    c *= 0.85;
  }
  return toHex(oklchToRgb({ ...color, c: 0 }));
}

export function hexToOklch(hex: string): Oklch | null {
  const rgb = parseHex(hex);
  return rgb ? rgbToOklch(rgb) : null;
}

/** HSL hue in degrees; useful for CSS `hue-rotate` deltas. */
export function hslHue({ r, g, b }: Rgb): number {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear mix in OKLCH (shortest hue path). `t` 0 -> a, 1 -> b. */
export function mixOklch(a: Oklch, b: Oklch, t: number): Oklch {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return { l: a.l + (b.l - a.l) * t, c: a.c + (b.c - a.c) * t, h: (a.h + dh * t + 360) % 360 };
}
