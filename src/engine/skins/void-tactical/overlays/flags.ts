export type OverlayId =
  | 'gradient'
  | 'mesh'
  | 'asciiGrid'
  | 'ascii1'
  | 'ascii2'
  | 'clouds'
  | 'noise'
  | 'starfield'
  | 'mouseGlow';

export type OverlayFlags = Partial<Record<OverlayId, boolean>>;

export const DEFAULT_OVERLAYS: Record<OverlayId, boolean> = {
  gradient: true,
  mesh: true,
  asciiGrid: true,
  ascii1: true,
  ascii2: true,
  clouds: true,
  noise: true,
  starfield: false,
  mouseGlow: true,
};

export const OVERLAY_CLASS: Record<Exclude<OverlayId, 'mouseGlow'>, string> = {
  gradient: 'space-gradient-base',
  mesh: 'mesh-gradient-layer',
  asciiGrid: 'ascii-grid-base',
  ascii1: 'ascii-layer-1',
  ascii2: 'ascii-layer-2',
  clouds: 'ascii-clouds',
  noise: 'noise-texture',
  starfield: 'starfield-layer',
};
