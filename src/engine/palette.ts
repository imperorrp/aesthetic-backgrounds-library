import { contrastRatio, hexToOklch, hslHue, oklchToHex, parseHex, toTriplet } from './color';

export type PaletteId = 'void-cyan' | 'amber' | 'violet';
export type PaletteTheme = 'dark' | 'light';

/**
 * How the secondary hues relate to the accent:
 * - `analogous`: neighbours at ±30° (calm, cohesive; the default)
 * - `complementary`: the opposite hue plus a near-complement (tension, poster-like)
 * - `split`: the two hues either side of the complement (lively but balanced)
 * - `triadic`: three evenly spaced hues (playful, high energy)
 * - `mono`: the accent hue at other lightness and chroma (restrained, editorial)
 */
export type Harmony = 'analogous' | 'complementary' | 'split' | 'triadic' | 'mono';
export const HARMONIES: Harmony[] = ['analogous', 'complementary', 'split', 'triadic', 'mono'];

export type Palette = {
  /** Built-in id, or `custom` for derived palettes. */
  id: PaletteId | 'custom';
  label: string;
  theme: PaletteTheme;
  harmony: Harmony;
  bg: string;
  ink: string;
  /** Space-separated RGB triplet of `ink`, for `rgb(var(--x) / a)`. */
  inkRgb: string;
  inkDim: string;
  accent: string;
  /** Space-separated RGB triplet, e.g. "6 182 212". Use `rgba()` to turn it into a CSS color. */
  accentRgb: string;
  /** Second and third hues from the harmony, tuned to sit at the accent's weight on this background. */
  accent2: string;
  accent2Rgb: string;
  accent3: string;
  accent3Rgb: string;
  hazard: string;
  hazardRgb: string;
};

/** Derive a full palette from one brand color, optionally keeping the brand's own surface and text. */
export type PaletteFrom = {
  from: string;
  theme?: PaletteTheme;
  harmony?: Harmony;
  /** Keep this background instead of deriving one (must contrast with `ink`). */
  bg?: string;
  /** Keep this text color instead of deriving one. */
  ink?: string;
  label?: string;
};

/** Anything `palette` accepts: a built-in id, a full token object, or a brand color to derive from. */
export type PaletteSpec = PaletteId | Palette | PaletteFrom | string;

export const DEFAULT_PALETTE_ID: PaletteId = 'void-cyan';

const rgbOf = (hex: string) => toTriplet(parseHex(hex)!);

const HARMONY_OFFSETS: Record<Exclude<Harmony, 'mono'>, [number, number]> = {
  analogous: [-30, 30],
  complementary: [180, 150],
  split: [150, 210],
  triadic: [120, 240],
};

/** Secondary hues for a harmony, matched in visual weight to the accent on this theme. */
export function harmonyHues(accent: string, harmony: Harmony, theme: PaletteTheme): [string, string] {
  const a = hexToOklch(accent) ?? { l: 0.7, c: 0.12, h: 200 };
  const dark = theme === 'dark';
  if (harmony === 'mono') {
    return [
      oklchToHex({ l: dark ? Math.min(0.88, a.l + 0.16) : Math.max(0.3, a.l - 0.16), c: a.c * 0.6, h: a.h }),
      oklchToHex({ l: dark ? Math.max(0.42, a.l - 0.18) : Math.min(0.72, a.l + 0.14), c: Math.min(0.32, a.c * 1.15), h: a.h }),
    ];
  }
  const [o2, o3] = HARMONY_OFFSETS[harmony];
  const l = dark ? Math.max(0.6, Math.min(0.8, a.l)) : Math.max(0.42, Math.min(0.6, a.l));
  const c = Math.max(0.08, Math.min(0.2, a.c));
  return [oklchToHex({ l, c, h: (a.h + o2 + 360) % 360 }), oklchToHex({ l, c, h: (a.h + o3 + 360) % 360 })];
}

/** Fill harmony fields on a palette that predates them (or was hand-written). */
function withHarmony<P extends Omit<Palette, 'harmony' | 'accent2' | 'accent2Rgb' | 'accent3' | 'accent3Rgb'> & Partial<Palette>>(p: P, harmony: Harmony = 'analogous'): Palette {
  const h = p.harmony ?? harmony;
  const [a2, a3] = p.accent2 && p.accent3 ? [p.accent2, p.accent3] : harmonyHues(p.accent, h, p.theme);
  return { ...p, harmony: h, accent2: a2, accent2Rgb: rgbOf(a2), accent3: a3, accent3Rgb: rgbOf(a3) } as Palette;
}

export const PALETTES: Record<PaletteId, Palette> = {
  'void-cyan': withHarmony({
    id: 'void-cyan',
    label: 'Void cyan',
    theme: 'dark',
    bg: '#030308',
    ink: '#e8f4f8',
    inkRgb: '232 244 248',
    inkDim: '#9bb4c0',
    accent: '#06b6d4',
    accentRgb: '6 182 212',
    hazard: '#f87171',
    hazardRgb: '248 113 113',
  }),
  amber: withHarmony({
    id: 'amber',
    label: 'Amber analog',
    theme: 'dark',
    bg: '#070604',
    ink: '#f4ecd8',
    inkRgb: '244 236 216',
    inkDim: '#b8a888',
    accent: '#d4a017',
    accentRgb: '212 160 23',
    hazard: '#e11d48',
    hazardRgb: '225 29 72',
  }),
  violet: withHarmony({
    id: 'violet',
    label: 'Violet void',
    theme: 'dark',
    bg: '#06040c',
    ink: '#ece8f8',
    inkRgb: '236 232 248',
    inkDim: '#a89cc8',
    accent: '#a78bfa',
    accentRgb: '167 139 250',
    hazard: '#fb7185',
    hazardRgb: '251 113 133',
  }),
};

export const PALETTE_OPTIONS: { value: PaletteId; label: string }[] = (
  Object.values(PALETTES).map((p) => ({ value: p.id as PaletteId, label: p.label }))
);

/** Hue of the default accent; CSS layers drawn in cyan are hue-rotated by the difference. */
const REFERENCE_ACCENT_HUE = hslHue(parseHex(PALETTES['void-cyan'].accent)!);

/**
 * Build a coherent palette from a single accent color using OKLCH:
 * near-black (or near-white) background tinted toward the accent, ink with a
 * hint of the hue, a hazard color across the wheel, and two harmony hues.
 * `bg`/`ink` from a brand's tokens are kept when they contrast enough.
 */
export function derivePalette(spec: PaletteFrom): Palette {
  const accentLch = hexToOklch(spec.from);
  if (!accentLch) throw new Error(`derivePalette: "${spec.from}" is not a hex color`);
  const theme = spec.theme ?? 'dark';
  const h = accentLch.h;
  const dark = theme === 'dark';

  let bg = oklchToHex({ l: dark ? 0.14 : 0.985, c: dark ? 0.018 : 0.006, h });
  let ink = oklchToHex({ l: dark ? 0.95 : 0.22, c: 0.012, h });
  const brandBg = spec.bg && parseHex(spec.bg);
  const brandInk = spec.ink && parseHex(spec.ink);
  if (brandBg && brandInk && contrastRatio(brandBg, brandInk) >= 4.5) {
    bg = spec.bg!;
    ink = spec.ink!;
  }
  const inkDim = oklchToHex({ l: dark ? 0.72 : 0.45, c: 0.03, h });
  // Keep the accent legible on the background: lift it in dark themes, deepen in light ones.
  const accent = oklchToHex({
    l: dark ? Math.max(accentLch.l, 0.62) : Math.min(accentLch.l, 0.58),
    c: Math.max(accentLch.c, 0.09),
    h,
  });
  const hazard = oklchToHex({ l: dark ? 0.7 : 0.55, c: 0.19, h: (h + 150) % 360 });
  const harmony = spec.harmony ?? 'analogous';
  const [accent2, accent3] = harmonyHues(accent, harmony, theme);

  return {
    id: 'custom',
    label: spec.label ?? `Derived from ${spec.from}`,
    theme,
    harmony,
    bg,
    ink,
    inkRgb: rgbOf(ink),
    inkDim,
    accent,
    accentRgb: rgbOf(accent),
    accent2,
    accent2Rgb: rgbOf(accent2),
    accent3,
    accent3Rgb: rgbOf(accent3),
    hazard,
    hazardRgb: rgbOf(hazard),
  };
}

/** Resolves a palette spec (id, token object, `{ from }`, or a bare hex string) to tokens. */
export function resolvePalette(spec?: PaletteSpec | null): Palette {
  if (!spec) return PALETTES[DEFAULT_PALETTE_ID];
  if (typeof spec === 'string') {
    if (spec in PALETTES) return PALETTES[spec as PaletteId];
    if (parseHex(spec)) return derivePalette({ from: spec });
    return PALETTES[DEFAULT_PALETTE_ID];
  }
  if ('from' in spec) return derivePalette(spec);
  return spec.accent2 && spec.harmony ? spec : withHarmony(spec);
}

/** Turns an RGB triplet ("6 182 212" or "6, 182, 212") into an rgba() color string. */
export function rgba(rgbTriplet: string, alpha = 1): string {
  const parts = rgbTriplet.trim().split(/[\s,]+/).slice(0, 3).join(', ');
  return `rgba(${parts}, ${alpha})`;
}

/** CSS custom properties the engine writes. All prefixed so they never collide with a host page. */
export function paletteVars(p: Palette): Record<string, string> {
  const accentHue = hslHue(parseHex(p.accent) ?? { r: 6, g: 182, b: 212 });
  return {
    '--bge-bg': p.bg,
    '--bge-ink': p.ink,
    '--bge-ink-rgb': p.inkRgb,
    '--bge-ink-dim': p.inkDim,
    '--bge-accent': p.accent,
    '--bge-accent-rgb': p.accentRgb,
    '--bge-accent2': p.accent2,
    '--bge-accent2-rgb': p.accent2Rgb,
    '--bge-accent3': p.accent3,
    '--bge-accent3-rgb': p.accent3Rgb,
    '--bge-hazard': p.hazard,
    '--bge-hazard-rgb': p.hazardRgb,
    '--bge-hue-shift': `${Math.round(accentHue - REFERENCE_ACCENT_HUE)}deg`,
  };
}

/**
 * Writes the palette as `--bge-*` custom properties (plus `data-bge-palette`) on an element.
 * `mount()` calls this on the engine root; pages that style their own chrome with the
 * palette can call it on `document.documentElement` (or pass `exposeTokens: true` to mount).
 */
export function applyPalette(spec: PaletteSpec, target: HTMLElement = document.documentElement): Palette {
  const p = resolvePalette(spec);
  for (const [name, value] of Object.entries(paletteVars(p))) {
    target.style.setProperty(name, value);
  }
  target.dataset.bgePalette = p.id;
  target.dataset.bgeTheme = p.theme;
  return p;
}

/** Remove what `applyPalette` wrote (used when `mount` exposed tokens on the page). */
export function clearPalette(target: HTMLElement = document.documentElement, p?: Palette): void {
  for (const name of Object.keys(paletteVars(p ?? PALETTES[DEFAULT_PALETTE_ID]))) target.style.removeProperty(name);
  delete target.dataset.bgePalette;
  delete target.dataset.bgeTheme;
}
