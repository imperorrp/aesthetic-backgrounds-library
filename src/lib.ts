export { mount } from './engine/core/mount';
export type { MountOptions, MountHandle } from './engine/core/mount';
export { createBackground, MAX_DPR } from './engine/core/createBackground';
export type { CreateBackgroundOptions } from './engine/core/createBackground';
export { registerSkin, getSkin, listSkins, resolveSkin } from './engine/core/registry';
export { injectEngineFonts, ENGINE_FONTS_URL } from './engine/core/fonts';
export type {
  BackgroundSkin,
  BackgroundHandle,
  SkinHost,
  SkinInstance,
  SkinLayerContext,
  Viewport,
  Camera,
} from './engine/core/skin';
export {
  builtInSkins,
  voidTacticalSkin,
  driftingDustSkin,
  matrixRainSkin,
} from './engine/skins';
export type { VoidTacticalOptions, NetworkSkinOptions, MatrixSkinOptions } from './engine/skins';
export type { OverlayFlags, OverlayId } from './engine/skins/void-tactical/overlays/flags';
export { applyPalette, resolvePalette, rgba, PALETTES, PALETTE_OPTIONS, DEFAULT_PALETTE_ID } from './engine/palette';
export type { PaletteId, Palette } from './engine/palette';
export { resolveBackgroundConfig, DETAIL_OPTIONS } from './engine/config';
export type { BackgroundConfig, ResolvedBackgroundConfig, LabelDensity } from './engine/config';
export { randomSeedString, createRng, hashSeed, mulberry32, pick, randRange, randInt, token } from './engine/rng';
export type { Rng } from './engine/rng';
