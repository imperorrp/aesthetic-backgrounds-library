import type { Rng } from '../rng';
import type { Noise2D } from '../noise';
import type { BackgroundConfig, MotionMode, ResolvedBackgroundConfig } from '../config';
import type { Palette } from '../palette';
import type { Schema } from './schema';

export type Camera = { x: number; y: number };
export type Viewport = { width: number; height: number };

/** Live viewport facts, updated by the host on resize. */
export type HostViewport = Viewport & {
  dpr: number;
  isMobile: boolean;
  isTouch: boolean;
};

/** Live pointer state in canvas CSS pixels, updated by the host. `active` is false until the pointer is seen. */
export type PointerState = {
  x: number;
  y: number;
  /** Normalized 0..1 within the canvas. */
  nx: number;
  ny: number;
  /** Velocity in px/s, smoothed. */
  vx: number;
  vy: number;
  active: boolean;
  down: boolean;
  /** Seconds since the pointer last moved. */
  idle: number;
};

/**
 * The scene light, resolved once per mount. `dx`/`dy` is the unit vector from the
 * canvas center toward the light; `x`/`y` is where the key light sits (0..1).
 */
export type LightState = {
  angle: number;
  dx: number;
  dy: number;
  x: number;
  y: number;
  /** -1 cool .. 1 warm. */
  warmth: number;
};

/** An axis-aligned rectangle in canvas CSS pixels. */
export type PxRect = { x: number; y: number; width: number; height: number };

/** What the host knows about layout around the canvas, for inspection and studio overlays. */
export type CompositionState = {
  light: LightState;
  /** Visible page content over the canvas (from `legibility`). */
  content: PxRect[];
  /** Explicit quiet zones from config. */
  quiet: PxRect[];
  /** Current automatic shade strength behind content (0 when none). */
  shade: number;
};

/** Timing for one frame. `t` and `dt` are seconds; `dt` is clamped so tab switches do not explode motion. */
export type FrameInfo = {
  t: number;
  dt: number;
  frame: number;
  /** Raw scheduler timestamp in ms, for skins that need it. */
  timestamp: number;
};

export type SkinHost<T = any> = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Seeded PRNG. Use this instead of Math.random so a seed reproduces the same world. */
  rng: Rng;
  /** Independent seeded stream for a subsystem, so consumers do not perturb one another. */
  fork(label: string): Rng;
  /** Seeded 2D simplex noise + fbm. */
  noise: Noise2D;
  config: ResolvedBackgroundConfig;
  /** Resolved palette tokens. Read colors from here rather than from CSS variables. */
  palette: Palette;
  options?: T;
  /** Live: current size, dpr, device hints. */
  readonly viewport: HostViewport;
  /** Live: pointer relative to the canvas. */
  readonly pointer: PointerState;
  /** Live: `full`, `reduced` (honor by slowing/simplifying), or `off` (host renders a single frame). */
  readonly motion: MotionMode;
  /** Live: 0..1 user knob for how present the background should be. */
  readonly intensity: number;
  /** Live: 0..1 quality governor output; lower it means frames were running long. */
  readonly quality: number;
  /** The scene light. Layers that draw glows, plates, or shading should read it. */
  readonly light: LightState;
  /**
   * How much a point (canvas CSS px) should recede: 1 inside page content or an
   * explicit quiet zone, falling to 0 a short distance outside. Multiply alpha or
   * density by `1 - k * quiet(x, y)` to leave negative space behind text.
   */
  quiet(x: number, y: number): number;
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
 *
 * Rules that keep skins portable and deterministic: no `Math.random`, `Date.now`,
 * `performance.now`, or timers; move by `info.dt`; read colors from `host.palette`;
 * release everything in `destroy()`.
 */
export type BackgroundSkin<T = any> = {
  id: string;
  label?: string;
  description?: string;
  /** Mood/niche tags for galleries and agents. */
  tags?: string[];
  /** Declares `options` so playgrounds, attributes, and agents can drive them. */
  schema?: Schema;
  /** Config applied beneath the caller's config when this skin is mounted (palette, intensity, motion...). */
  defaults?: Partial<BackgroundConfig>;
  mount(host: SkinHost<T>): SkinInstance;
  /**
   * Optional GPU-friendly DOM layers (CSS gradients, SVG textures, grain) that
   * `mount()` places behind the canvas inside the engine root. Return a cleanup.
   */
  layers?(root: HTMLElement, context: SkinLayerContext<T>): () => void;
};

export type SkinInstance = {
  resize(viewport: Viewport): void;
  frame(info: FrameInfo): void;
  destroy(): void;
};

export type BackgroundHandle = {
  canvas: HTMLCanvasElement;
  /** Stop scheduling frames (state is kept). */
  pause(): void;
  /** Resume after `pause()`. No-op if running. */
  resume(): void;
  /** Render exactly one frame now, e.g. while paused or with `motion: 'off'`. */
  renderOnce(): void;
  /** Called after every rendered frame with its timing. Returns an unsubscribe function. */
  onFrame(listener: (info: FrameInfo) => void): () => void;
  /** Light, measured content boxes, quiet zones, and shade strength right now. */
  composition(): CompositionState;
  destroy(): void;
};
