/**
 * `space-background-engine/skins/petri`: registers and exports the Petri dish skin. The dish
 * loads the first time it mounts; `petriSkin.prepare()` loads it ahead.
 */
import { registerSkin } from '../../engine/core/registry';
import { petriSkin, PETRI_SCHEMA } from '../../engine/skins/petri';

registerSkin(petriSkin);

export { petriSkin, PETRI_SCHEMA };
