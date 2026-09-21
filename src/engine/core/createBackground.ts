import { resolveBackgroundConfig, type BackgroundConfig } from '../config';
import { createRng } from '../rng';
import { applyPalette } from '../palette';
import { voidTacticalSkin } from '../skins/void-tactical/runtime';
import type { BackgroundHandle, BackgroundSkin, Viewport } from './skin';

export type CreateBackgroundOptions<T = any> = {
  config?: BackgroundConfig;
  /** Defaults to the void-tactical skin. Swap this to run a different background. */
  skin?: BackgroundSkin<T>;
  options?: T;
};

/**
 * Framework-free mount. Pass a canvas (or a container — a canvas is created).
 * React, Svelte, or a static page can all call this.
 */
export function createBackground<T = any>(
  target: HTMLCanvasElement | HTMLElement,
  options: CreateBackgroundOptions<T> = {},
): BackgroundHandle {
  const canvas = ensureCanvas(target);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('2D canvas context unavailable');

  const resolved = resolveBackgroundConfig(options.config);
  if (resolved.palette) applyPalette(resolved.palette);

  const rng = createRng(resolved.seed);
  const skin = options.skin ?? voidTacticalSkin;

  const instance = skin.mount({ canvas, ctx, rng, config: resolved, options: options.options as T });

  let width = 0;
  let height = 0;
  let raf = 0;
  let lastFrame = 0;
  const interval = 1000 / resolved.targetFps;

  const applySize = () => {
    const next: Viewport = {
      width: canvas.clientWidth || window.innerWidth,
      height: canvas.clientHeight || window.innerHeight,
    };
    width = next.width;
    height = next.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    instance.resize(next);
  };

  const loop = (timestamp: number) => {
    if (timestamp - lastFrame >= interval) {
      lastFrame = timestamp;
      instance.frame(timestamp);
    }
    raf = requestAnimationFrame(loop);
  };

  window.addEventListener('resize', applySize);
  applySize();
  raf = requestAnimationFrame(loop);

  return {
    canvas,
    destroy() {
      window.removeEventListener('resize', applySize);
      cancelAnimationFrame(raf);
      instance.destroy();
    },
  };
}

function ensureCanvas(target: HTMLCanvasElement | HTMLElement): HTMLCanvasElement {
  if (target instanceof HTMLCanvasElement) return target;
  const existing = target.querySelector('canvas');
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.className = 'bg-engine-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  target.appendChild(canvas);
  return canvas;
}
