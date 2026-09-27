/**
 * Procedural background engine (internal barrel used by the playground).
 * The published surface lives in `src/lib.ts`, `src/entries/*`, `src/element.ts`, and `src/react-entry.tsx`.
 */

export * from '../entries/core';
export * from '../entries/shader';

export {
  builtInSkins,
  voidTacticalSkin,
  driftingDustSkin,
  matrixRainSkin,
  voidLayers,
  voidAtmosphereLayer,
  voidStarsLayer,
  voidSystemsLayer,
  voidFleetsLayer,
  voidHudLayer,
  voidSectorPreset,
} from './skins';
export type { VoidTacticalOptions, NetworkSkinOptions, MatrixSkinOptions } from './skins';
export { voidTacticalLayer } from '../entries/skins/void-tactical';
export * from './layers';
export * from './presets';
export { default as BackgroundCanvas } from './BackgroundCanvas';
export type { BackgroundCanvasProps } from './BackgroundCanvas';
export { default as CursorTrail } from './CursorTrail';
export { LABEL_DENSITY_OPTIONS } from './config';

export { ParticleHero } from './particles/ParticleHero';
export type { ParticleHeroProps } from './particles/ParticleHero';
export { useParticleCanvas } from './particles/useParticleCanvas';
export type { ParticleCanvasOptions } from './particles/useParticleCanvas';
