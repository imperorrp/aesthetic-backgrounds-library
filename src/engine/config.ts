import { hashSeed, randomSeedString } from './rng';
import { resolvePalette, type Palette, type PaletteSpec } from './palette';

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
};

export type ResolvedBackgroundConfig = {
  seed: string;
  seedHash: number;
  density: number;
  detail: LabelDensity;
  labelDensity: LabelDensity;
  cameraSpeed: number;
  targetFps: number;
  overlaySpawnRate: number;
  maxOverlays: number;
  palette: Palette;
  intensity: number;
  motion: MotionPreference;
  adaptiveQuality: boolean;
  pauseWhenHidden: boolean;
};

const LABEL_OVERLAYS: Record<LabelDensity, { rate: number; max: number }> = {
  none: { rate: 0, max: 0 },
  low: { rate: 0.012, max: 2 },
  medium: { rate: 0.04, max: 4 },
  high: { rate: 0.08, max: 8 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function resolveBackgroundConfig(config: BackgroundConfig = {}): ResolvedBackgroundConfig {
  const seed = config.seed === undefined || config.seed === ''
    ? randomSeedString()
    : String(config.seed);
  const detail = config.detail ?? config.labelDensity ?? 'low';
  const overlay = LABEL_OVERLAYS[detail];
  const density = clamp(config.density ?? 1, 0.25, 2);

  return {
    seed,
    seedHash: hashSeed(seed),
    density,
    detail,
    labelDensity: detail,
    cameraSpeed: config.cameraSpeed ?? 0.25,
    targetFps: clamp(config.targetFps ?? 60, 1, 240),
    overlaySpawnRate: overlay.rate,
    maxOverlays: overlay.max,
    palette: resolvePalette(config.palette),
    intensity: clamp(config.intensity ?? 1, 0, 1),
    motion: config.motion ?? 'auto',
    adaptiveQuality: config.adaptiveQuality ?? true,
    pauseWhenHidden: config.pauseWhenHidden ?? true,
  };
}

/** Layer `defaults` (e.g. a skin's preferred palette) beneath caller config; undefined caller keys do not override. */
export function withConfigDefaults(defaults: Partial<BackgroundConfig> | undefined, config: BackgroundConfig = {}): BackgroundConfig {
  if (!defaults) return config;
  const defined: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) if (v !== undefined) defined[k] = v;
  return { ...defaults, ...defined } as BackgroundConfig;
}

export const DETAIL_OPTIONS: { value: LabelDensity; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** @deprecated Use DETAIL_OPTIONS */
export const LABEL_DENSITY_OPTIONS = DETAIL_OPTIONS;
