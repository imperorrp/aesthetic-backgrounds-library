/**
 * `space-background-engine`: batteries included. The core host, every built-in skin,
 * the standard layer library, and the curated presets, all registered by id.
 * For a smaller bundle import `space-background-engine/core` plus only the
 * `space-background-engine/skins/*`, `/layers`, or `/presets` you use.
 */
export * from './entries/core';
export * from './entries/shader';
export * from './entries/manifest';
export * from './entries/tokens';
export {
  builtInSkins,
  voidTacticalSkin,
  driftingDustSkin,
  matrixRainSkin,
} from './engine/skins';
export type { VoidTacticalOptions, NetworkSkinOptions, MatrixSkinOptions } from './engine/skins';
export type { OverlayFlags, OverlayId } from './engine/skins/void-tactical/overlays/flags';
export { voidTacticalLayer } from './entries/skins/void-tactical';
export * from './engine/layers';
export * from './engine/presets';
