/**
 * A skin whose world loads the first time it mounts. The shell (this, plus the skin's
 * metadata and schema) is tiny and ships with the built-ins; the world is a separate
 * chunk, so a page that never shows it never downloads it.
 *
 *   export const battleSkin = lazySkin({ id: 'shieldwall', label: '…', schema }, () => import('./battle'));
 *
 * The chunk exports `mount(host)`. Until it arrives, the skin paints its plate (the
 * palette background). `skin.prepare()` loads it ahead, so harnesses start on frame 0.
 */
import type { BackgroundSkin, SkinHost, SkinInstance, Viewport } from '../core/skin';

type World = { mount(host: SkinHost): SkinInstance };

export function lazySkin<T = any>(meta: Omit<BackgroundSkin<T>, 'mount' | 'prepare'>, load: () => Promise<World>): BackgroundSkin<T> {
  let world: World | null = null;
  let loading: Promise<void> | null = null;
  const prepare = () =>
    (loading ??= load().then((m) => {
      world = m;
    }));
  return {
    ...meta,
    prepare,
    mount(host) {
      if (world) return world.mount(host);
      // Plate first, then hand over once the world has loaded.
      let inner: SkinInstance | null = null;
      let size: Viewport = { width: host.viewport.width, height: host.viewport.height };
      let destroyed = false;
      void prepare().then(() => {
        if (destroyed || !world) return;
        inner = world.mount(host);
        inner.resize(size);
      });
      return {
        resize(v) {
          size = v;
          inner?.resize(v);
        },
        frame(info) {
          if (inner) inner.frame(info);
          else {
            host.ctx.fillStyle = host.palette.bg;
            host.ctx.fillRect(0, 0, size.width, size.height);
          }
        },
        advance: (info) => inner?.advance?.(info),
        inspect: () => inner?.inspect?.(),
        destroy() {
          destroyed = true;
          inner?.destroy();
        },
      };
    },
  };
}
