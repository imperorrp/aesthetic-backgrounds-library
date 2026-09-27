/**
 * `space-background-engine`: batteries included. The core host plus every built-in skin,
 * registered by id. For a smaller bundle import `space-background-engine/core` and only
 * the `space-background-engine/skins/*` you use.
 */
export * from './entries/core';
export {
  builtInSkins,
  voidTacticalSkin,
  driftingDustSkin,
  matrixRainSkin,
} from './engine/skins';
export type { VoidTacticalOptions, NetworkSkinOptions, MatrixSkinOptions } from './engine/skins';
export type { OverlayFlags, OverlayId } from './engine/skins/void-tactical/overlays/flags';
