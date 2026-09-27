/** `space-background-engine/skins/matrix-rain`: registers and exports the glyph-rain skin. */
import { registerSkin } from '../../engine/core/registry';
import { matrixRainSkin } from '../../engine/skins/matrix-rain';

registerSkin(matrixRainSkin);

export { matrixRainSkin };
export type { MatrixSkinOptions } from '../../engine/skins/matrix-rain';
