export type LabelDensity = 'none' | 'low' | 'medium' | 'high';
export type PaletteId = 'void-cyan' | 'amber' | 'violet';
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

export type Palette = {
  id: PaletteId;
  label: string;
  bg: string;
  ink: string;
  inkDim: string;
  accent: string;
  accentRgb: string;
  hazard: string;
  hazardRgb: string;
};

export type BackgroundConfig = {
  seed?: string | number;
  density?: number;
  detail?: LabelDensity;
  labelDensity?: LabelDensity;
  cameraSpeed?: number;
  targetFps?: number;
  palette?: PaletteId;
};

export type ResolvedBackgroundConfig = {
  seed: string;
  seedHash: number;
  density: number;
  detail: LabelDensity;
  labelDensity: LabelDensity;
  cameraSpeed: number;
  targetFps: number;
  overlaySpawnRate: number;
  maxOverlays: number;
  palette?: PaletteId;
};

export type Rng = () => number;

export type Camera = { x: number; y: number };
export type Viewport = { width: number; height: number };

export type SkinHost = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rng: Rng;
  config: ResolvedBackgroundConfig;
};

export type SkinInstance = {
  resize(viewport: Viewport): void;
  frame(timestamp: number): void;
  destroy(): void;
};

export type BackgroundSkin = {
  id: string;
  mount(host: SkinHost): SkinInstance;
};

export type BackgroundHandle = {
  canvas: HTMLCanvasElement;
  destroy(): void;
};

export type CreateBackgroundOptions = {
  config?: BackgroundConfig;
  skin?: BackgroundSkin;
};

export type MountOptions = BackgroundConfig & {
  skin?: BackgroundSkin;
  layers?: OverlayFlags;
  zIndex?: number;
  fonts?: boolean;
};

export type MountHandle = BackgroundHandle & {
  root: HTMLElement;
};

export const voidTacticalSkin: BackgroundSkin;
export const PALETTES: Record<PaletteId, Palette>;
export const PALETTE_OPTIONS: { value: PaletteId; label: string }[];
export const DETAIL_OPTIONS: { value: LabelDensity; label: string }[];

export function mount(target?: string | HTMLElement, options?: MountOptions): MountHandle;
export function createBackground(
  target: HTMLCanvasElement | HTMLElement,
  options?: CreateBackgroundOptions,
): BackgroundHandle;
export function applyPalette(id: PaletteId, target?: HTMLElement): void;
export function resolveBackgroundConfig(config?: BackgroundConfig): ResolvedBackgroundConfig;
export function randomSeedString(): string;
export function createRng(seed: string | number): Rng;
