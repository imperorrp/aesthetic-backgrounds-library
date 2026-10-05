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
  undercitySkin,
  prepareUndercity,
  shieldwallSkin,
  agesSkin,
  warTableSkin,
  wyrmspireSkin,
  deepholdSkin,
  petriSkin,
  driftingDustSkin,
  matrixRainSkin,
} from './engine/skins';
export type { VoidTacticalOptions, NetworkSkinOptions, MatrixSkinOptions } from './engine/skins';
export type { OverlayFlags, OverlayId } from './engine/skins/void-tactical/overlays/flags';
export {
  voidTacticalLayer,
  registerUniverse,
  registerUniverseLoader,
  getUniverse,
  listUniverses,
  loadUniverse,
  isUniverseReady,
  validateUniverse,
  universePrompt,
  registerMechanic,
  registerMechanicLoader,
  loadMechanics,
  prepareVoidTactical,
  getMechanic,
  listMechanics,
  steerToward,
  steerOrbit,
} from './entries/skins/void-tactical';
export type { UniversePack, UniverseMeta, UniverseValidation, Mechanic, MechanicApi, MechanicRef } from './entries/skins/void-tactical';
export * from './engine/layers';
export * from './engine/presets';
