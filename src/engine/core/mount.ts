import { applyPalette } from '../palette';
import { resolveBackgroundConfig, withConfigDefaults, type BackgroundConfig } from '../config';
import { createBackground } from './createBackground';
import { injectEngineFonts } from './fonts';
import { resolveSkin } from './registry';
import type { Scheduler } from './scheduler';
import type { BackgroundHandle, BackgroundSkin } from './skin';

export type MountOptions<T = any> = BackgroundConfig & {
  /** Skin object or registered id (e.g. `'matrix-rain'`). Defaults to the registered `void-tactical`. */
  skin?: BackgroundSkin<T> | string;
  /** Skin-specific options, validated by the skin. */
  options?: T;
  /** Stack z-index. Default 0 so page content can sit above. */
  zIndex?: number;
  /** Load the engine's display fonts (Orbit, Syne Mono) from Google Fonts. Default false: no network requests. */
  fonts?: boolean;
  /** Frame scheduler + clock override (tests, offscreen rendering). */
  scheduler?: Scheduler;
};

export type MountHandle = BackgroundHandle & {
  root: HTMLElement;
};

const ROOT_STYLE = 'inset:0;pointer-events:none;overflow:hidden;';
const CANVAS_STYLE = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:10;';

/**
 * One-call site background. Creates a `.bg-engine-root` inside the target, writes the
 * palette as scoped `--bge-*` variables on it, asks the skin for its DOM layers
 * (gradients, grain), then runs the canvas loop on top. Everything is
 * `pointer-events: none` so the host page stays clickable.
 *
 * @example
 * mount(document.body, { seed: 'orion-7', detail: 'low' })
 * mount('#hero', { skin: 'matrix-rain', palette: '#ff7a1a', intensity: 0.6 })
 */
export function mount<T = any>(
  target: string | HTMLElement = document.body,
  options: MountOptions<T> = {},
): MountHandle {
  const el = resolveTarget(target);
  const {
    skin: skinInput,
    options: skinOptions,
    zIndex = 0,
    fonts = false,
    scheduler,
    ...config
  } = options;

  const skin = resolveSkin<T>(skinInput);

  // Resolve once so a random seed is shared by the DOM layers and the canvas.
  // The skin's defaults sit beneath whatever the caller actually set.
  const resolved = resolveBackgroundConfig(withConfigDefaults(skin.defaults, config));
  const palette = resolved.palette;
  if (fonts) injectEngineFonts();

  const isPage = el === document.body || el === document.documentElement;
  if (!isPage && window.getComputedStyle(el).position === 'static') {
    el.style.position = 'relative';
  }

  const root = document.createElement('div');
  root.className = 'bg-engine-root';
  root.setAttribute('aria-hidden', 'true');
  root.style.cssText = ROOT_STYLE;
  root.style.position = isPage ? 'fixed' : 'absolute';
  root.style.zIndex = String(zIndex);
  applyPalette(palette, root);
  el.appendChild(root);

  const layerCleanup = skin.layers?.(root, { config: resolved, palette, options: skinOptions });

  const canvas = document.createElement('canvas');
  canvas.className = 'bg-engine-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = CANVAS_STYLE;
  root.appendChild(canvas);

  const loop = createBackground<T>(canvas, {
    skin,
    config: resolved,
    options: skinOptions,
    scheduler,
  });

  let destroyed = false;
  return {
    canvas: loop.canvas,
    root,
    pause: () => loop.pause(),
    resume: () => loop.resume(),
    renderOnce: () => loop.renderOnce(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      loop.destroy();
      layerCleanup?.();
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
