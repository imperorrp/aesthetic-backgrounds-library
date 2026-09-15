/**
 * Procedural background engine.
 *
 * Core: createBackground + BackgroundSkin.
 * Default skin: void-tactical (extracted sci-fi sector look).
 * React: BackgroundCanvas is a thin adapter. Prefer createBackground for new hosts.
 */

export { createBackground } from './core/createBackground';
export type { CreateBackgroundOptions } from './core/createBackground';
export type { BackgroundSkin, BackgroundHandle, SkinHost, SkinInstance, Camera, Viewport } from './core/skin';

export { voidTacticalSkin } from './skins/void-tactical/runtime';

export { default as BackgroundCanvas } from './BackgroundCanvas';
export type { BackgroundCanvasProps } from './BackgroundCanvas';
export { default as CursorTrail } from './CursorTrail';
export { AmbientOverlays } from './AmbientOverlays';
export type { AmbientLayerFlags } from './AmbientOverlays';

export { resolveBackgroundConfig, DETAIL_OPTIONS, LABEL_DENSITY_OPTIONS } from './config';
export type { BackgroundConfig, ResolvedBackgroundConfig, LabelDensity } from './config';
export { applyPalette, PALETTES, PALETTE_OPTIONS } from './palette';
export type { PaletteId, Palette } from './palette';
export { createRng, hashSeed, mulberry32, randomSeedString } from './rng';
export type { Rng } from './rng';

export { ParticleHero } from './particles/ParticleHero';
export type { ParticleHeroProps } from './particles/ParticleHero';
export { useParticleCanvas } from './particles/useParticleCanvas';
export type { ParticleCanvasOptions } from './particles/useParticleCanvas';

export {
  generateSystem,
  generateSingleSystem,
  generateSingleStructure,
  generateSingleFleet,
  generateSingleAnomaly,
} from './generators';
export type { GenerateSystemOptions } from './generators';

export { renderSystem } from './renderers';
export {
  renderStars,
  renderConstellations,
  renderGrids,
  renderCelestialBodies,
  renderStarSystem,
  renderNodes,
  renderFleets,
  renderAnomalies,
  renderTacticalOverlays,
  renderTelemetry,
  renderSystemConnections,
  renderSectorConnections,
  getAsciiSprite,
} from './renderers';
export { WORLD_SPEED_MULTIPLIER } from './renderers/utils';

export type {
  Point,
  Star,
  Constellation,
  Fleet,
  Planet,
  Structure,
  StarSystem,
  SystemNode,
  Telemetry,
  CelestialBody,
  Anomaly,
  TacticalElement,
  SystemState,
  SimSettings,
} from './types';
