/**
 * `space-background-engine/skins/fantasy`: registers and exports the fantasy worlds:
 * Shieldwall (battles, side-on or from above), Ages (a continent's thousand years), and the
 * War Table (a campaign on parchment). Each world loads the first time it mounts;
 * `skin.prepare()` loads it ahead.
 */
import { registerSkin } from '../../engine/core/registry';
import { agesSkin, shieldwallSkin, warTableSkin, AGES_SCHEMA, SHIELDWALL_SCHEMA, WAR_TABLE_SCHEMA } from '../../engine/skins/fantasy';

registerSkin(shieldwallSkin);
registerSkin(agesSkin);
registerSkin(warTableSkin);

export { shieldwallSkin, agesSkin, warTableSkin, SHIELDWALL_SCHEMA, AGES_SCHEMA, WAR_TABLE_SCHEMA };
