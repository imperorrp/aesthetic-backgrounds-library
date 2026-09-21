import { applyPalette } from '../palette';
import { createBackground, type CreateBackgroundOptions } from './createBackground';
import type { BackgroundConfig } from '../config';
import type { BackgroundHandle, BackgroundSkin } from './skin';

export type MountOptions<T = any> = BackgroundConfig & {
  skin?: BackgroundSkin<T>;
  options?: T;
  /** Stack z-index. Default 0 so page content can sit above. */
  zIndex?: number;
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
export function mount<T = any>(
  target: string | HTMLElement = document.body,
  options: MountOptions<T> = {},
): MountHandle {
  const el = resolveTarget(target);
  const {
    skin,
    options: skinOptions,
    zIndex = 0,
    ...config
  } = options;

  applyPalette(config.palette ?? 'void-cyan');

  const positioned = window.getComputedStyle(el).position;
  if (el === document.body || el === document.documentElement) {
    // body: overlay is a fixed child
  } else if (positioned === 'static') {
    el.style.position = 'relative';
  }

  const root = document.createElement('div');
  root.className = 'bg-engine-root';
  el.appendChild(root);
  
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
    options: skinOptions,
  } satisfies CreateBackgroundOptions<T>);

  return {
    canvas: loop.canvas,
    root,
    destroy() {
      loop.destroy();
      root.remove();
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
