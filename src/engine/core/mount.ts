import { applyPalette, resolvePalette } from '../palette';
import { resolveBackgroundConfig, type BackgroundConfig } from '../config';
import { voidTacticalSkin } from '../skins/void-tactical/runtime';
import { createBackground } from './createBackground';
import { injectEngineFonts } from './fonts';
import { resolveSkin } from './registry';
import type { BackgroundHandle, BackgroundSkin } from './skin';

export type MountOptions<T = any> = BackgroundConfig & {
  /** Skin object or registered id (e.g. `'matrix-rain'`). Defaults to void-tactical. */
  skin?: BackgroundSkin<T> | string;
  /** Skin-specific options, validated by the skin. */
  options?: T;
  /** Stack z-index. Default 0 so page content can sit above. */
  zIndex?: number;
  /** Load the engine's display fonts (Orbit, Syne Mono) from Google Fonts. Default false: no network requests. */
  fonts?: boolean;
};

export type MountHandle = BackgroundHandle & {
  root: HTMLElement;
};

const ROOT_STYLE = 'inset:0;pointer-events:none;overflow:hidden;';
const CANVAS_STYLE = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:10;';

/**
 * One-call site background. Creates a `.bg-engine-root` inside the target, asks the
 * skin for its DOM layers (gradients, grain), then runs the canvas loop on top.
 * Everything is `pointer-events: none` so the host page stays clickable.
 *
 * @example
 * mount(document.body, { seed: 'orion-7', detail: 'low' })
 * mount('#hero', { skin: 'matrix-rain', options: { fontSize: 14 } })
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
    ...config
  } = options;

  // Resolve once so a random seed is shared by the DOM layers and the canvas.
  const resolved = resolveBackgroundConfig(config);
  const palette = resolvePalette(resolved.palette);
  applyPalette(palette.id);
  if (fonts) injectEngineFonts();

  const skin = resolveSkin(skinInput, voidTacticalSkin as BackgroundSkin<T>);

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
  });

  let destroyed = false;
  return {
    canvas: loop.canvas,
    root,
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
