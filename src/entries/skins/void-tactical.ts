/** `space-background-engine/skins/void-tactical`: registers and exports the default sci-fi sector skin. */
import { registerSkin } from '../../engine/core/registry';
import { voidTacticalSkin } from '../../engine/skins/void-tactical/runtime';

registerSkin(voidTacticalSkin);

export { voidTacticalSkin };
export type { VoidTacticalOptions } from '../../engine/skins/void-tactical/runtime';
export type { OverlayFlags, OverlayId } from '../../engine/skins/void-tactical/overlays/flags';
