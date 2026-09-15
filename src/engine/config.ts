import { hashSeed, randomSeedString } from './rng';
import type { LabelDensity } from './types';
import type { PaletteId } from './palette';

export type { LabelDensity };

export type BackgroundConfig = {
  /** Same seed → same generated field. */
  seed?: string | number;
  /** Population multiplier. Default 1. */
  density?: number;
  /** Annotation / HUD budget. Default `low`. */
  detail?: LabelDensity;
  /** @deprecated Use `detail`. */
  labelDensity?: LabelDensity;
  /** Per-frame camera pan in world units. Default 0.25. */
  cameraSpeed?: number;
  /** Animation cap. Default 60. */
  targetFps?: number;
  palette?: PaletteId;
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
  palette?: PaletteId;
};

const LABEL_OVERLAYS: Record<LabelDensity, { rate: number; max: number }> = {
  none: { rate: 0, max: 0 },
  low: { rate: 0.012, max: 2 },
  medium: { rate: 0.04, max: 4 },
  high: { rate: 0.08, max: 8 },
};

export function resolveBackgroundConfig(config: BackgroundConfig = {}): ResolvedBackgroundConfig {
  const seed = config.seed === undefined || config.seed === ''
    ? randomSeedString()
    : String(config.seed);
  const detail = config.detail ?? config.labelDensity ?? 'low';
  const overlay = LABEL_OVERLAYS[detail];
  const density = Math.max(0.25, Math.min(2, config.density ?? 1));

  return {
    seed,
    seedHash: hashSeed(seed),
    density,
    detail,
    labelDensity: detail,
    cameraSpeed: config.cameraSpeed ?? 0.25,
    targetFps: config.targetFps ?? 60,
    overlaySpawnRate: overlay.rate,
    maxOverlays: overlay.max,
    palette: config.palette,
  };
}

export const DETAIL_OPTIONS: { value: LabelDensity; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** @deprecated Use DETAIL_OPTIONS */
export const LABEL_DENSITY_OPTIONS = DETAIL_OPTIONS;
