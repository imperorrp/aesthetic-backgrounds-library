import { forkRng, hashSeed, randomSeedString } from './rng';
import { resolvePalette, type Palette, type PaletteSpec } from './palette';

/** A rectangle in normalized canvas coordinates (0..1). */
export type NormRect = { x: number; y: number; width: number; height: number };

/**
 * One light for the whole scene, so plates, glows, vignettes, and shaders agree on
 * where it comes from. `angle` is in degrees on screen (0 = right, 90 = down,
 * 270 = up); `warmth` from -1 (cool) to 1 (warm) tints glows.
 */
export type LightConfig = { angle?: number; warmth?: number };

/**
 * Keep page text legible. `auto` (default) finds visible `main`, `article`, and
 * `[data-bg-content]` boxes over the canvas, makes layers recede there, and adds a
 * feathered shade that grows with `intensity` above 0.55. `off` disables both.
 */
export type LegibilityConfig = 'auto' | 'off' | { selector?: string; strength?: number };

export type LabelDensity = 'none' | 'low' | 'medium' | 'high';

/** `auto` follows `prefers-reduced-motion`; the others force a mode. */
export type MotionPreference = 'auto' | 'full' | 'reduced' | 'off';
export type MotionMode = 'full' | 'reduced' | 'off';

export type BackgroundConfig = {
  /** Same seed → same generated field. */
  seed?: string | number;
  /** Population multiplier. Default 1. */
  density?: number;
  /** Annotation / HUD budget. Default `low`. */
  detail?: LabelDensity;
  /** @deprecated Use `detail`. */
  labelDensity?: LabelDensity;
  /** Drift speed in world units per frame at 60 fps. Default 0.25. */
  cameraSpeed?: number;
  /** Animation cap. Default 60. Changing it does not change animation speed. */
  targetFps?: number;
  /** Built-in id, token object, `{ from: '#brand' }`, or a bare hex color. */
  palette?: PaletteSpec;
  /** One knob for how much the background asserts itself: scales motion, density, and contrast in skins. 0..1, default 1. */
  intensity?: number;
  /** Motion policy. Default `auto` (honors `prefers-reduced-motion`). */
  motion?: MotionPreference;
  /** Lower `host.quality` when frames run long, raise it back when they recover. Default true. */
  adaptiveQuality?: boolean;
  /** Stop the loop while the tab is hidden or the canvas is offscreen. Default true; disable for offscreen rendering or test harnesses. */
  pauseWhenHidden?: boolean;
  /** Scene light. Default: seeded, from the upper left or upper right, neutral warmth. */
  light?: LightConfig;
  /** Content-aware shading and receding layers behind page text. Default `auto`. */
  legibility?: LegibilityConfig;
  /** Extra zones where layers recede (negative space), in normalized canvas coordinates. */
  quiet?: NormRect[];
  /**
   * Let the background take the wheel (zoom) and drags on empty page areas (pan), for
   * wallpaper-like pages. Default false: the page keeps every gesture.
   */
  interactive?: boolean;
};

export type ResolvedLegibility = { mode: 'auto' | 'off' | 'fixed'; selector: string; strength: number };

export type ResolvedBackgroundConfig = {
  seed: string;
  seedHash: number;
  density: number;
  detail: LabelDensity;
  labelDensity: LabelDensity;
  cameraSpeed: number;
  targetFps: number;
  palette: Palette;
  intensity: number;
  motion: MotionPreference;
  adaptiveQuality: boolean;
  pauseWhenHidden: boolean;
  light: { angle: number; warmth: number };
  legibility: ResolvedLegibility;
  quiet: NormRect[];
  interactive: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const DEFAULT_CONTENT_SELECTOR = 'main, article, [data-bg-content]';

/**
 * Seeded key light: from the upper left (200..235 degrees) or upper right
 * (305..340 degrees). Corners, never top center, so the brightest glow does not
 * sit behind a typical headline.
 */
function seededLightAngle(seed: string): number {
  const r = forkRng(seed, 'light');
  const side = r() < 0.5;
  return side ? 200 + r() * 35 : 305 + r() * 35;
}

function resolveLegibility(l: LegibilityConfig | undefined): ResolvedLegibility {
  if (l === 'off') return { mode: 'off', selector: DEFAULT_CONTENT_SELECTOR, strength: 0 };
  if (!l || l === 'auto') return { mode: 'auto', selector: DEFAULT_CONTENT_SELECTOR, strength: -1 };
  return {
    mode: l.strength === undefined ? 'auto' : 'fixed',
    selector: l.selector ?? DEFAULT_CONTENT_SELECTOR,
    strength: l.strength === undefined ? -1 : clamp(l.strength, 0, 1),
  };
}

export function resolveBackgroundConfig(config: BackgroundConfig = {}): ResolvedBackgroundConfig {
  const seed = config.seed === undefined || config.seed === ''
    ? randomSeedString()
    : String(config.seed);
  const detail = config.detail ?? config.labelDensity ?? 'low';
  const density = clamp(config.density ?? 1, 0.25, 2);

  return {
    seed,
    seedHash: hashSeed(seed),
    density,
    detail,
    labelDensity: detail,
    cameraSpeed: config.cameraSpeed ?? 0.25,
    targetFps: clamp(config.targetFps ?? 60, 1, 240),
    palette: resolvePalette(config.palette),
    intensity: clamp(config.intensity ?? 1, 0, 1),
    motion: config.motion ?? 'auto',
    adaptiveQuality: config.adaptiveQuality ?? true,
    pauseWhenHidden: config.pauseWhenHidden ?? true,
    light: {
      angle: (((config.light?.angle ?? seededLightAngle(seed)) % 360) + 360) % 360,
      warmth: clamp(config.light?.warmth ?? 0, -1, 1),
    },
    legibility: resolveLegibility(config.legibility),
    quiet: (config.quiet ?? []).map((q) => ({
      x: clamp(q.x, 0, 1),
      y: clamp(q.y, 0, 1),
      width: clamp(q.width, 0, 1),
      height: clamp(q.height, 0, 1),
    })),
    interactive: config.interactive ?? false,
  };
}

/** Layer `defaults` (e.g. a skin's preferred palette) beneath caller config; undefined caller keys do not override. */
export function withConfigDefaults(defaults: Partial<BackgroundConfig> | undefined, config: BackgroundConfig = {}): BackgroundConfig {
  if (!defaults) return config;
  const definedOf = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
  const merged = { ...defaults, ...definedOf(config) } as BackgroundConfig;
  // The light merges per field, so a caller pinning only the angle keeps a preset's warmth.
  if (defaults.light && config.light) merged.light = { ...defaults.light, ...definedOf(config.light) };
  return merged;
}

export const DETAIL_OPTIONS: { value: LabelDensity; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** @deprecated Use DETAIL_OPTIONS */
export const LABEL_DENSITY_OPTIONS = DETAIL_OPTIONS;
