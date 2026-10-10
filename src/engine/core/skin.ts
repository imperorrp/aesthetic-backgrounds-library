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
  /** Live: the page's vertical scroll in CSS px, for scroll-linked scenes. */
  readonly scroll: { y: number };
  /**
   * Wheel zoom and drag pan since the last call (identity unless `config.interactive`).
   * Skins with a camera read it once per frame.
   */
  takeGesture(): { zoom: number; panX: number; panY: number };
  /** Where a skin reports what happens, for sound and other reactions (`handle.onEvent`). */
  events?: SkinEvents;
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
  /**
   * Text-heavy skins: render at full device resolution (up to 2x) and never let the
   * quality governor lower the backing-store scale, so small type stays sharp.
   */
  crisp?: boolean;
  mount(host: SkinHost<T>): SkinInstance;
  /**
   * Skins that load their world on first mount: fetch it now, so the first frame is the
   * real first frame (harnesses, exports, and pages that want no placeholder await this).
   */
  prepare?(): Promise<void>;
  /**
   * Optional GPU-friendly DOM layers (CSS gradients, SVG textures, grain) that
   * `mount()` places behind the canvas inside the engine root. Return a cleanup.
   */
  layers?(root: HTMLElement, context: SkinLayerContext<T>): () => void;
};

export type SkinInstance = {
  resize(viewport: Viewport): void;
  frame(info: FrameInfo): void;
  /**
   * Optional sim-only step: everything `frame` does except drawing. The host uses it
   * to fast-forward (time scale above 1, `fastForward`, the lab, the headless runner).
   * Skins without it are fast-forwarded through `frame`.
   */
  advance?(info: FrameInfo): void;
  /**
   * Optional debug snapshot for the lab, the headless runner, and the studio's debug
   * panel: entity counts and a log of what happened. Never used for drawing.
   */
  inspect?(): SkinInspection | undefined;
  /**
   * Optional: someone clicked the world at (x, y), in canvas CSS pixels. Answer in the
   * world's own way and return the line it said, or null to let the click pass unanswered.
   */
  nudge?(x: number, y: number): string | null;
  destroy(): void;
};

/** Something that happened in a skin: a raid, an explosion, a song. Sound binds to these. */
export type SkinEvent = {
  type: string;
  /** 0..1: how much it matters (how loud, for sound). */
  weight: number;
  /** -1 (left edge) to 1 (right edge): where across the screen it happened. */
  pan: number;
  /** 0..1: 1 on screen and up front; less off screen or far behind. */
  near: number;
  text?: string;
  color?: string;
  /** Size of the thing (explosions). */
  size?: number;
  priority?: 'low' | 'medium' | 'high';
};

/**
 * The host's outlet for skin events. `active` is false while nobody listens (or during
 * `fastForward`; time-scaled steps report), so skins can skip the work of reporting.
 */
export type SkinEvents = { readonly active: boolean; emit(e: SkinEvent): void };

/** What a skin reports about itself for tooling. `log` grows; `seq` counts every entry ever logged. */
export type SkinInspection = {
  t: number;
  counts: Record<string, number>;
  log: readonly { t: number; text: string; kind?: string; type?: string }[];
  seq: number;
  /** Problems the skin noticed (NaN positions, runaway counts, failed plugins). */
  problems?: string[];
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
  /**
   * Run the simulation forward without drawing, `step` seconds at a time, then carry on
   * from there. Stops early when `until` returns true. Returns the seconds simulated.
   * Deterministic: the same calls on the same seed reach the same world.
   */
  fastForward(seconds: number, opts?: { step?: number; until?: (info: FrameInfo) => boolean }): number;
  /** Simulated seconds per real second (1, 2, 4, 8, 16). Extra steps are sim-only. */
  setTimeScale(scale: number): void;
  /** The skin's debug snapshot, when it offers one. */
  inspect(): SkinInspection | undefined;
  /**
   * What happens, as it happens (skins that report events: the sector map). Silent during
   * fast-forward. Returns an unsubscribe function. The audio entry listens here.
   */
  onEvent(listener: (e: SkinEvent) => void): () => void;
  /**
   * Nudge the world at (x, y), in CSS pixels from the canvas's top left: a ring shows
   * where, and worlds that answer do something there. Returns what the world said, or
   * null. With `config.nudges`, clicks on empty page area call this.
   */
  nudge(x: number, y: number): string | null;
  destroy(): void;
};
