import { resolveBackgroundConfig, withConfigDefaults, type BackgroundConfig, type MotionMode } from '../config';
import { createRng, forkRng } from '../rng';
import { createNoise2D } from '../noise';
import { resolveSkin } from './registry';
import { createRafScheduler, type Scheduler } from './scheduler';
import type { BackgroundHandle, BackgroundSkin, FrameInfo, HostViewport, PointerState, SkinHost, Viewport } from './skin';

export type CreateBackgroundOptions<T = any> = {
  config?: BackgroundConfig;
  /** Skin object or registered id. Defaults to the registered `void-tactical` skin. */
  skin?: BackgroundSkin<T> | string;
  options?: T;
  /** Frame scheduler + clock. Defaults to requestAnimationFrame; inject a manual one for tests. */
  scheduler?: Scheduler;
};

/** Backing-store pixel ratio cap: retina sharpness without 4x fill cost on 3x phones. */
export const MAX_DPR = 1.5;
/** Largest frame delta handed to skins, in seconds. Tab switches and stalls clamp here. */
export const MAX_DT = 0.1;
/** Below this width the host reports `viewport.isMobile`. */
export const MOBILE_BREAKPOINT = 768;

const CANVAS_STYLE = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';

/**
 * Framework-free mount. Pass a canvas (or a container — a canvas is created).
 * React, Svelte, or a static page can all call this.
 *
 * The host owns: sizing (ResizeObserver, DPR), the frame loop and its clock,
 * motion policy (`prefers-reduced-motion`), pausing when hidden or offscreen,
 * pointer tracking, and a frame-time quality governor. The skin owns the picture.
 */
export function createBackground<T = any>(
  target: HTMLCanvasElement | HTMLElement,
  options: CreateBackgroundOptions<T> = {},
): BackgroundHandle {
  const canvas = ensureCanvas(target);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('2D canvas context unavailable');

  const skin = resolveSkin<T>(options.skin);
  const resolved = resolveBackgroundConfig(withConfigDefaults(skin.defaults, options.config));
  const palette = resolved.palette;
  const seed = resolved.seed;
  const rng = createRng(seed);
  const scheduler = options.scheduler ?? createRafScheduler();
  const perf = typeof performance !== 'undefined' ? performance : { now: () => Date.now() };

  // ---- live host state -------------------------------------------------------------------
  const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const viewport: HostViewport = {
    width: 1,
    height: 1,
    dpr: 1,
    isMobile: false,
    isTouch: coarsePointer || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0),
  };
  const pointer: PointerState = { x: 0, y: 0, nx: 0.5, ny: 0.5, vx: 0, vy: 0, active: false, down: false, idle: Infinity };

  const reducedQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const computeMotion = (): MotionMode => {
    if (resolved.motion !== 'auto') return resolved.motion;
    return reducedQuery?.matches ? 'reduced' : 'full';
  };
  const state = { motion: computeMotion(), quality: 1 };

  const host: SkinHost<T> = {
    canvas,
    ctx,
    rng,
    fork: (label) => forkRng(seed, label),
    noise: createNoise2D(forkRng(seed, 'noise')),
    config: resolved,
    palette,
    options: options.options as T,
    viewport,
    pointer,
    get motion() {
      return state.motion;
    },
    get intensity() {
      return state.motion === 'reduced' ? Math.min(resolved.intensity, 0.5) : resolved.intensity;
    },
    get quality() {
      return state.quality;
    },
  };

  // ---- sizing ----------------------------------------------------------------------------
  let destroyed = false;
  let instance: ReturnType<BackgroundSkin<T>['mount']> | null = null;

  const measure = (): Viewport => {
    let w = canvas.clientWidth;
    let h = canvas.clientHeight;
    const parent = canvas.parentElement;
    if ((!w || !h) && parent) {
      w = w || parent.clientWidth;
      h = h || parent.clientHeight;
    }
    return {
      width: Math.max(1, w || window.innerWidth),
      height: Math.max(1, h || window.innerHeight),
    };
  };

  /** Size the backing store and update `viewport`. Returns true when the CSS size changed. */
  const syncSize = (): boolean => {
    const next = measure();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const backingW = Math.max(1, Math.round(next.width * dpr));
    const backingH = Math.max(1, Math.round(next.height * dpr));
    if (canvas.width !== backingW || canvas.height !== backingH) {
      // Assigning width/height resets the context state, so the transform is set after.
      canvas.width = backingW;
      canvas.height = backingH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    viewport.dpr = dpr;
    if (next.width === viewport.width && next.height === viewport.height) return false;
    viewport.width = next.width;
    viewport.height = next.height;
    viewport.isMobile = next.width < MOBILE_BREAKPOINT;
    return true;
  };

  const applySize = () => {
    if (destroyed || !instance) return;
    if (!syncSize()) return;
    instance.resize({ width: viewport.width, height: viewport.height });
    if (state.motion === 'off') renderOnce();
  };

  // The skin sees the real size at mount time; world generation depends on it.
  syncSize();
  instance = skin.mount(host);
  // Guarantee: resize() runs once before the first frame.
  instance.resize({ width: viewport.width, height: viewport.height });

  // ---- frame loop ------------------------------------------------------------------------
  const interval = 1000 / resolved.targetFps;
  // Frame-time budget for the governor: leave headroom for the page, but do not
  // start trimming until a frame is clearly over its share.
  const budgetMs = interval * 0.75;
  let running = false;
  let handle = 0;
  let startTime = -1;
  let lastTs = -1;
  let frameIndex = 0;
  let costEma = 0;

  const governor = (costMs: number) => {
    costEma = costEma === 0 ? costMs : costEma * 0.9 + costMs * 0.1;
    if (costEma > budgetMs && state.quality > 0.4) {
      state.quality = Math.max(0.4, +(state.quality - 0.04).toFixed(2));
      costEma = budgetMs * 0.8; // hysteresis: wait for new samples before stepping again
    } else if (costEma < budgetMs * 0.35 && state.quality < 1) {
      state.quality = Math.min(1, +(state.quality + 0.01).toFixed(2));
    }
  };

  const renderFrame = (timestamp: number) => {
    if (startTime < 0) startTime = timestamp;
    const rawDt = lastTs < 0 ? interval : timestamp - lastTs;
    lastTs = timestamp;
    const dt = Math.min(Math.max(rawDt, 0), MAX_DT * 1000) / 1000;
    const info: FrameInfo = { t: (timestamp - startTime) / 1000, dt, frame: frameIndex++, timestamp };

    pointer.idle += dt;
    const decay = Math.exp(-dt * 6);
    pointer.vx *= decay;
    pointer.vy *= decay;

    const began = perf.now();
    instance!.frame(info);
    if (resolved.adaptiveQuality) governor(perf.now() - began);
  };

  const loop = (timestamp: number) => {
    if (!running || destroyed) return;
    if (lastTs < 0 || timestamp - lastTs >= interval - 0.5) {
      renderFrame(timestamp);
    }
    handle = scheduler.request(loop);
  };

  let userPaused = false;
  const pauseWhenHidden = resolved.pauseWhenHidden;
  let hidden = pauseWhenHidden && typeof document !== 'undefined' && document.hidden;
  let offscreen = false;

  const shouldRun = () => !destroyed && !userPaused && !hidden && !offscreen && state.motion !== 'off';

  const sync = () => {
    const want = shouldRun();
    if (want && !running) {
      running = true;
      lastTs = -1; // fresh delta after a pause
      handle = scheduler.request(loop);
    } else if (!want && running) {
      running = false;
      scheduler.cancel(handle);
    }
  };

  const renderOnce = () => {
    if (destroyed) return;
    renderFrame(scheduler.now());
  };

  // ---- environment listeners -------------------------------------------------------------
  const onVisibility = () => {
    hidden = pauseWhenHidden && document.hidden;
    sync();
  };
  const onMotionChange = () => {
    const prev = state.motion;
    state.motion = computeMotion();
    if (prev !== state.motion) {
      sync();
      if (state.motion === 'off') renderOnce();
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (pointer.active && pointer.idle > 0) {
      const dtS = Math.max(pointer.idle, 1 / 240);
      pointer.vx = (x - pointer.x) / dtS;
      pointer.vy = (y - pointer.y) / dtS;
    }
    pointer.x = x;
    pointer.y = y;
    pointer.nx = rect.width ? x / rect.width : 0.5;
    pointer.ny = rect.height ? y / rect.height : 0.5;
    pointer.active = true;
    pointer.idle = 0;
  };
  const onPointerDown = () => {
    pointer.down = true;
  };
  const onPointerUp = () => {
    pointer.down = false;
  };

  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => applySize());
    resizeObserver.observe(canvas);
  }
  let intersection: IntersectionObserver | undefined;
  if (pauseWhenHidden && typeof IntersectionObserver !== 'undefined') {
    intersection = new IntersectionObserver(
      ([entry]) => {
        offscreen = !entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    intersection.observe(canvas);
  }
  window.addEventListener('resize', applySize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reducedQuery?.addEventListener?.('change', onMotionChange);

  if (state.motion === 'off') renderOnce();
  sync();

  return {
    canvas,
    pause() {
      userPaused = true;
      sync();
    },
    resume() {
      userPaused = false;
      sync();
    },
    renderOnce,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      scheduler.cancel(handle);
      resizeObserver?.disconnect();
      intersection?.disconnect();
      window.removeEventListener('resize', applySize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedQuery?.removeEventListener?.('change', onMotionChange);
      instance?.destroy();
    },
  };
}

function ensureCanvas(target: HTMLCanvasElement | HTMLElement): HTMLCanvasElement {
  if (target instanceof HTMLCanvasElement) {
    // A bare canvas has an intrinsic 300x150 box. Let it fill its parent unless the caller sized it.
    if (!target.style.width) target.style.width = '100%';
    if (!target.style.height) target.style.height = '100%';
    if (!target.style.display) target.style.display = 'block';
    return target;
  }
  const existing = target.querySelector('canvas');
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.className = 'bg-engine-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = CANVAS_STYLE;
  if (window.getComputedStyle(target).position === 'static') {
    target.style.position = 'relative';
  }
  target.appendChild(canvas);
  return canvas;
}
