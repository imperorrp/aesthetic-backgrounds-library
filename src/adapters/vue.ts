/**
 * `space-background-engine/vue`: a Vue 3 directive and plugin. Zero dependencies,
 * because a directive is a plain object of lifecycle hooks.
 *
 * @example
 * import { createApp } from 'vue';
 * import { BackgroundPlugin } from 'space-background-engine/vue';
 * createApp(App).use(BackgroundPlugin).mount('#app');
 *
 * <section class="hero" v-background="{ skin: 'calm-mesh', palette: '#4f6df5' }" />
 */
import { mount, type MountHandle, type MountOptions } from '../engine/core/mount';
export { builtInSkins } from '../engine/skins';
export { presets } from '../engine/presets';

type Binding = { value?: MountOptions; oldValue?: MountOptions | null };
type El = HTMLElement & { __bgEngine?: { handle: MountHandle; key: string } };

const keyOf = (o: MountOptions = {}) =>
  JSON.stringify({ ...o, skin: typeof o.skin === 'string' ? o.skin : o.skin?.id, scheduler: undefined, exposeTokens: o.exposeTokens === true });

export const vBackground = {
  mounted(el: El, binding: Binding) {
    el.__bgEngine = { handle: mount(el, binding.value ?? {}), key: keyOf(binding.value) };
  },
  updated(el: El, binding: Binding) {
    const state = el.__bgEngine;
    const key = keyOf(binding.value);
    if (!state || state.key === key) return;
    state.handle.destroy();
    el.__bgEngine = { handle: mount(el, binding.value ?? {}), key };
  },
  unmounted(el: El) {
    el.__bgEngine?.handle.destroy();
    delete el.__bgEngine;
  },
};

/** `app.use(BackgroundPlugin)` registers `v-background` globally. */
export const BackgroundPlugin = {
  install(app: { directive(name: string, def: unknown): unknown }) {
    app.directive('background', vBackground);
  },
};

export type { MountOptions, MountHandle };
