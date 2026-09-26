/**
 * Procedural background engine (internal barrel used by the playground).
 * The published surface is `src/lib.ts`, `src/element.ts`, and `src/react-entry.tsx`.
 *
 * Core: createBackground + BackgroundSkin.
 * Default skin: void-tactical (extracted sci-fi sector look).
 * React: BackgroundCanvas is a thin adapter. Prefer createBackground for new hosts.
 */

export { createBackground, MAX_DPR } from './core/createBackground';
export type { CreateBackgroundOptions } from './core/createBackground';
export { mount } from './core/mount';
export type { MountOptions, MountHandle } from './core/mount';
export { registerSkin, getSkin, listSkins, resolveSkin } from './core/registry';
export { injectEngineFonts } from './core/fonts';
export type { BackgroundSkin, BackgroundHandle, SkinHost, SkinInstance, SkinLayerContext, Camera, Viewport } from './core/skin';

export { builtInSkins, voidTacticalSkin, driftingDustSkin, matrixRainSkin } from './skins';
export type { VoidTacticalOptions, NetworkSkinOptions, MatrixSkinOptions } from './skins';
export { default as BackgroundCanvas } from './BackgroundCanvas';
export type { BackgroundCanvasProps } from './BackgroundCanvas';
export { default as CursorTrail } from './CursorTrail';

export { resolveBackgroundConfig, DETAIL_OPTIONS, LABEL_DENSITY_OPTIONS } from './config';
export type { BackgroundConfig, ResolvedBackgroundConfig, LabelDensity } from './config';
export { applyPalette, resolvePalette, rgba, PALETTES, PALETTE_OPTIONS, DEFAULT_PALETTE_ID } from './palette';
export type { PaletteId, Palette } from './palette';
export { createRng, hashSeed, mulberry32, randomSeedString } from './rng';
export type { Rng } from './rng';

export { ParticleHero } from './particles/ParticleHero';
export type { ParticleHeroProps } from './particles/ParticleHero';
export { useParticleCanvas } from './particles/useParticleCanvas';
export type { ParticleCanvasOptions } from './particles/useParticleCanvas';
