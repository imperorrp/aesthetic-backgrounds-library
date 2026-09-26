import type { Rng } from '../rng';
import type { ResolvedBackgroundConfig } from '../config';
import type { Palette } from '../palette';

export type Camera = { x: number; y: number };
export type Viewport = { width: number; height: number };

export type SkinHost<T = any> = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Seeded PRNG. Use this instead of Math.random so a seed reproduces the same world. */
  rng: Rng;
  config: ResolvedBackgroundConfig;
  /** Resolved palette tokens. Read colors from here rather than from CSS variables. */
  palette: Palette;
  options?: T;
};

/** What a skin receives when `mount()` asks it for DOM layers behind the canvas. */
export type SkinLayerContext<T = any> = {
  config: ResolvedBackgroundConfig;
  palette: Palette;
  options?: T;
};

/**
 * A skin is a self-contained background: it owns world state, camera, spawn, and draw.
 * The host only sizes the canvas and ticks the frame loop.
 */
export type BackgroundSkin<T = any> = {
  id: string;
  mount(host: SkinHost<T>): SkinInstance;
  /**
   * Optional GPU-friendly DOM layers (CSS gradients, SVG textures, grain) that
   * `mount()` places behind the canvas inside the engine root. Return a cleanup.
   */
  layers?(root: HTMLElement, context: SkinLayerContext<T>): () => void;
};

export type SkinInstance = {
  resize(viewport: Viewport): void;
  frame(timestamp: number): void;
  destroy(): void;
};

export type BackgroundHandle = {
  canvas: HTMLCanvasElement;
  destroy(): void;
};
