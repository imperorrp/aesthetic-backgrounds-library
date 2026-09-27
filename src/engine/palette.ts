import { hexToOklch, hslHue, oklchToHex, parseHex, toTriplet } from './color';

export type PaletteId = 'void-cyan' | 'amber' | 'violet';
export type PaletteTheme = 'dark' | 'light';

export type Palette = {
  /** Built-in id, or `custom` for derived palettes. */
  id: PaletteId | 'custom';
  label: string;
  theme: PaletteTheme;
  bg: string;
  ink: string;
  /** Space-separated RGB triplet of `ink`, for `rgb(var(--x) / a)`. */
  inkRgb: string;
  inkDim: string;
  accent: string;
  /** Space-separated RGB triplet, e.g. "6 182 212". Use `rgba()` to turn it into a CSS color. */
  accentRgb: string;
  hazard: string;
  hazardRgb: string;
};

/** Derive a full palette from one brand color. */
export type PaletteFrom = { from: string; theme?: PaletteTheme; label?: string };

/** Anything `palette` accepts: a built-in id, a full token object, or a brand color to derive from. */
export type PaletteSpec = PaletteId | Palette | PaletteFrom | string;

export const DEFAULT_PALETTE_ID: PaletteId = 'void-cyan';

export const PALETTES: Record<PaletteId, Palette> = {
  'void-cyan': {
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
  },
  amber: {
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
  },
  violet: {
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
  },
};

export const PALETTE_OPTIONS: { value: PaletteId; label: string }[] = (
  Object.values(PALETTES).map((p) => ({ value: p.id as PaletteId, label: p.label }))
);

/** Hue of the default accent; CSS layers drawn in cyan are hue-rotated by the difference. */
const REFERENCE_ACCENT_HUE = hslHue(parseHex(PALETTES['void-cyan'].accent)!);

/**
 * Build a coherent palette from a single accent color using OKLCH:
 * near-black (or near-white) background tinted toward the accent, ink with a
 * hint of the hue, and a hazard color across the wheel.
 */
export function derivePalette(spec: PaletteFrom): Palette {
  const accentLch = hexToOklch(spec.from);
  if (!accentLch) throw new Error(`derivePalette: "${spec.from}" is not a hex color`);
  const theme = spec.theme ?? 'dark';
  const h = accentLch.h;
  const dark = theme === 'dark';

  const bg = oklchToHex({ l: dark ? 0.14 : 0.985, c: dark ? 0.018 : 0.006, h });
  const ink = oklchToHex({ l: dark ? 0.95 : 0.22, c: 0.012, h });
  const inkDim = oklchToHex({ l: dark ? 0.72 : 0.45, c: 0.03, h });
  // Keep the accent legible on the background: lift it in dark themes, deepen in light ones.
  const accent = oklchToHex({
    l: dark ? Math.max(accentLch.l, 0.62) : Math.min(accentLch.l, 0.58),
    c: Math.max(accentLch.c, 0.09),
    h,
  });
  const hazard = oklchToHex({ l: dark ? 0.7 : 0.55, c: 0.19, h: (h + 150) % 360 });

  const rgbOf = (hex: string) => toTriplet(parseHex(hex)!);
  return {
    id: 'custom',
    label: spec.label ?? `Derived from ${spec.from}`,
    theme,
    bg,
    ink,
    inkRgb: rgbOf(ink),
    inkDim,
    accent,
    accentRgb: rgbOf(accent),
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
  return spec;
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
    '--bge-hazard': p.hazard,
    '--bge-hazard-rgb': p.hazardRgb,
    '--bge-hue-shift': `${Math.round(accentHue - REFERENCE_ACCENT_HUE)}deg`,
  };
}

/**
 * Writes the palette as `--bge-*` custom properties (plus `data-bge-palette`) on an element.
 * `mount()` calls this on the engine root; pages that style their own chrome with the
 * palette can call it on `document.documentElement`.
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
