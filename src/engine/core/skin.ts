import type { Rng } from '../rng';
import type { ResolvedBackgroundConfig } from '../config';

export type Camera = { x: number; y: number };
export type Viewport = { width: number; height: number };

export type SkinHost = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rng: Rng;
  config: ResolvedBackgroundConfig;
};

/**
 * A skin is a self-contained background: it owns world state, camera, spawn, and draw.
 * The host only sizes the canvas and ticks the frame loop.
 */
export type BackgroundSkin = {
  id: string;
  mount(host: SkinHost): SkinInstance;
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
