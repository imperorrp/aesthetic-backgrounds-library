import { applyPalette } from '../palette';
import { createBackground, type CreateBackgroundOptions } from './createBackground';
import { createOverlayStack, injectEngineFonts, injectEngineStyles } from '../overlays/stack';
import type { OverlayFlags } from '../overlays/flags';
import type { BackgroundConfig } from '../config';
import type { BackgroundHandle, BackgroundSkin } from './skin';

export type MountOptions = BackgroundConfig & {
  skin?: BackgroundSkin;
  layers?: OverlayFlags;
  /** Stack z-index. Default 0 so page content can sit above. */
  zIndex?: number;
  /** Load Orbit / Syne Mono from Google Fonts. Default true. */
  fonts?: boolean;
};

export type MountHandle = BackgroundHandle & {
  root: HTMLElement;
};

/**
 * One-call site background. Injects styles, palette, overlay stack, and the
 * canvas loop. The stack is pointer-events: none so the host page stays clickable.
 *
 * @example
 * mount(document.body, { seed: 'orion-7', detail: 'low' })
 */
export function mount(
  target: string | HTMLElement = document.body,
  options: MountOptions = {},
): MountHandle {
  const el = resolveTarget(target);
  const {
    skin,
    layers,
    zIndex = 0,
    fonts = true,
    ...config
  } = options;

  injectEngineStyles();
  if (fonts) injectEngineFonts();
  applyPalette(config.palette ?? 'void-cyan');

  const positioned = window.getComputedStyle(el).position;
  if (el === document.body || el === document.documentElement) {
    // body: overlay is a fixed child
  } else if (positioned === 'static') {
    el.style.position = 'relative';
  }

  const stack = createOverlayStack(el, layers);
  const root = stack.root;
  if (el === document.body || el === document.documentElement) {
    root.style.position = 'fixed';
  } else {
    root.style.position = 'absolute';
  }
  root.style.inset = '0';
  root.style.zIndex = String(zIndex);
  root.style.pointerEvents = 'none';
  root.style.overflow = 'hidden';

  const canvas = document.createElement('canvas');
  canvas.className = 'space-sim-canvas bg-engine-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  root.appendChild(canvas);

  const loop = createBackground(canvas, {
    skin,
    config,
  } satisfies CreateBackgroundOptions);

  return {
    canvas: loop.canvas,
    root,
    destroy() {
      loop.destroy();
      stack.destroy();
    },
  };
}

function resolveTarget(target: string | HTMLElement): HTMLElement {
  if (typeof target === 'string') {
    const found = document.querySelector<HTMLElement>(target);
    if (!found) throw new Error(`mount: no element matches "${target}"`);
    return found;
  }
  return target;
}
