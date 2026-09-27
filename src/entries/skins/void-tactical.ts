/** `space-background-engine/skins/void-tactical`: registers and exports the default sci-fi sector skin, and the same skin as a scene layer. */
import { registerSkin } from '../../engine/core/registry';
import { fromSkin, registerLayer } from '../../engine/core/layer';
import { voidTacticalSkin } from '../../engine/skins/void-tactical/runtime';

registerSkin(voidTacticalSkin);

/** The full sector map as one scene layer (private surface). */
export const voidTacticalLayer = registerLayer(
  fromSkin(voidTacticalSkin, {
    label: 'Void tactical (skin)',
    description: 'The full sci-fi sector map as one layer.',
    tags: ['space', 'sci-fi', 'busy'],
  }),
);

export { voidTacticalSkin };
export type { VoidTacticalOptions } from '../../engine/skins/void-tactical/runtime';
export type { OverlayFlags, OverlayId } from '../../engine/skins/void-tactical/overlays/flags';
