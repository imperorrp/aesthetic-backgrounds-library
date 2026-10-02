/**
 * `space-background-engine/svelte`: a Svelte action. Zero dependencies, because a
 * Svelte action is just `(node, params) => ({ update, destroy })`.
 *
 * @example
 * <script>
 *   import { background } from 'space-background-engine/svelte';
 * </script>
 * <div class="hero" use:background={{ skin: 'aurora-night', intensity: 0.6 }} />
 */
import { mount, type MountHandle, type MountOptions } from '../engine/core/mount';
// Registers built-in skins, layers, and presets so ids resolve.
export { builtInSkins } from '../engine/skins';
export { presets } from '../engine/presets';

const keyOf = (o: MountOptions) =>
  JSON.stringify({ ...o, skin: typeof o.skin === 'string' ? o.skin : o.skin?.id, scheduler: undefined, exposeTokens: o.exposeTokens === true });

export function background(node: HTMLElement, options: MountOptions = {}) {
  let handle: MountHandle = mount(node, options);
  let key = keyOf(options);
  return {
    update(next: MountOptions = {}) {
      const nextKey = keyOf(next);
      if (nextKey === key) return;
      key = nextKey;
      handle.destroy();
      handle = mount(node, next);
    },
    destroy() {
      handle.destroy();
    },
  };
}

export type { MountOptions, MountHandle };
