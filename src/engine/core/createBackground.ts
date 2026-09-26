import { resolveBackgroundConfig, type BackgroundConfig } from '../config';
import { createRng } from '../rng';
import { applyPalette, resolvePalette } from '../palette';
import { voidTacticalSkin } from '../skins/void-tactical/runtime';
import { resolveSkin } from './registry';
import type { BackgroundHandle, BackgroundSkin, Viewport } from './skin';

export type CreateBackgroundOptions<T = any> = {
  config?: BackgroundConfig;
  /** Skin object or registered id. Defaults to the void-tactical skin. */
  skin?: BackgroundSkin<T> | string;
  options?: T;
};

/** Backing-store pixel ratio cap: retina sharpness without 4x fill cost on 3x phones. */
export const MAX_DPR = 1.5;

const CANVAS_STYLE = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';

/**
 * Framework-free mount. Pass a canvas (or a container — a canvas is created).
 * React, Svelte, or a static page can all call this.
 *
 * Sizing: the canvas is measured from its CSS box (falling back to its parent,
 * then the window) and re-measured through a ResizeObserver, so it follows its
 * container, not just the window.
 */
export function createBackground<T = any>(
  target: HTMLCanvasElement | HTMLElement,
  options: CreateBackgroundOptions<T> = {},
): BackgroundHandle {
  const canvas = ensureCanvas(target);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('2D canvas context unavailable');

  const resolved = resolveBackgroundConfig(options.config);
  const palette = resolvePalette(resolved.palette);
  if (resolved.palette) applyPalette(resolved.palette);

  const rng = createRng(resolved.seed);
  const skin = resolveSkin(options.skin, voidTacticalSkin as BackgroundSkin<T>);

  const instance = skin.mount({ canvas, ctx, rng, config: resolved, palette, options: options.options as T });

  let width = 0;
  let height = 0;
  let raf = 0;
  let lastFrame = 0;
  let destroyed = false;
  const interval = 1000 / resolved.targetFps;

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

  const applySize = () => {
    if (destroyed) return;
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
    if (next.width === width && next.height === height) return;
    width = next.width;
    height = next.height;
    instance.resize(next);
  };

  const loop = (timestamp: number) => {
    if (destroyed) return;
    if (timestamp - lastFrame >= interval) {
      lastFrame = timestamp;
      instance.frame(timestamp);
    }
    raf = requestAnimationFrame(loop);
  };

  let observer: ResizeObserver | undefined;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => applySize());
    observer.observe(canvas);
  }
  window.addEventListener('resize', applySize);
  applySize();
  raf = requestAnimationFrame(loop);

  return {
    canvas,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      window.removeEventListener('resize', applySize);
      cancelAnimationFrame(raf);
      instance.destroy();
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
