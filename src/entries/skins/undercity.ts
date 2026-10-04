/**
 * `space-background-engine/skins/undercity`: registers and exports the cyberpunk city skin.
 * The city itself loads the first time it mounts; `prepareUndercity()` loads it ahead.
 */
import { registerSkin } from '../../engine/core/registry';
import { undercitySkin, prepareUndercity, UNDERCITY_SCHEMA } from '../../engine/skins/undercity';

registerSkin(undercitySkin);

export { undercitySkin, prepareUndercity, UNDERCITY_SCHEMA };
