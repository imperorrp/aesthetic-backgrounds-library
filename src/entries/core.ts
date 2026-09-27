/**
 * `space-background-engine/core`: the host without any skins.
 * Pair it with one or more `space-background-engine/skins/*` imports (they self-register).
 */
export { mount } from '../engine/core/mount';
export type { MountOptions, MountHandle } from '../engine/core/mount';
export { createBackground, MAX_DPR, MAX_DT, MOBILE_BREAKPOINT } from '../engine/core/createBackground';
export type { CreateBackgroundOptions } from '../engine/core/createBackground';
export { registerSkin, getSkin, listSkins, resolveSkin, DEFAULT_SKIN_ID } from '../engine/core/registry';
export { createRafScheduler, createManualScheduler } from '../engine/core/scheduler';
export type { Scheduler, ManualScheduler } from '../engine/core/scheduler';
export { injectEngineFonts, ENGINE_FONTS_URL } from '../engine/core/fonts';
export type {
  BackgroundSkin,
  BackgroundHandle,
  SkinHost,
  SkinInstance,
  SkinLayerContext,
  FrameInfo,
  HostViewport,
  PointerState,
  Viewport,
  Camera,
} from '../engine/core/skin';
export {
  applyPalette,
  resolvePalette,
  derivePalette,
  paletteVars,
  rgba,
  PALETTES,
  PALETTE_OPTIONS,
  DEFAULT_PALETTE_ID,
} from '../engine/palette';
export type { PaletteId, Palette, PaletteSpec, PaletteFrom, PaletteTheme } from '../engine/palette';
export { resolveBackgroundConfig, DETAIL_OPTIONS } from '../engine/config';
export type {
  BackgroundConfig,
  ResolvedBackgroundConfig,
  LabelDensity,
  MotionMode,
  MotionPreference,
} from '../engine/config';
export { randomSeedString, createRng, forkRng, hashSeed, mulberry32, pick, randRange, randInt, token } from '../engine/rng';
export type { Rng } from '../engine/rng';
export { createNoise2D } from '../engine/noise';
export type { Noise2D } from '../engine/noise';
export {
  parseHex,
  toHex,
  toTriplet,
  rgbToOklch,
  oklchToRgb,
  oklchToHex,
  hexToOklch,
  hslHue,
  relativeLuminance,
  contrastRatio,
  mixOklch,
} from '../engine/color';
export type { Rgb, Oklch } from '../engine/color';
