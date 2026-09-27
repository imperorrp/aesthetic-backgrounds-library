/** `space-background-engine/skins/drifting-dust`: registers and exports the particle-network skin. */
import { registerSkin } from '../../engine/core/registry';
import { driftingDustSkin } from '../../engine/skins/drifting-dust';

registerSkin(driftingDustSkin);

export { driftingDustSkin };
export type { NetworkSkinOptions } from '../../engine/skins/drifting-dust';
