/**
 * `space-background-engine/skins/fantasy`: registers and exports the fantasy worlds:
 * Shieldwall (battles, side-on or from above), Ages (a continent's thousand years), the
 * War Table (a campaign on parchment), Wyrmspire (a valley under a dragon's spire), Deephold
 * (a dwarf hold in cutaway), and Leylines (orders of mages on the lines of power).
 * Each world loads the first time it mounts; `skin.prepare()` loads it ahead.
 */
import { registerSkin } from '../../engine/core/registry';
import { agesSkin, shieldwallSkin, warTableSkin, wyrmspireSkin, deepholdSkin, leylinesSkin, AGES_SCHEMA, SHIELDWALL_SCHEMA, WAR_TABLE_SCHEMA, WYRMSPIRE_SCHEMA, DEEPHOLD_SCHEMA, LEYLINES_SCHEMA } from '../../engine/skins/fantasy';

registerSkin(shieldwallSkin);
registerSkin(agesSkin);
registerSkin(warTableSkin);
registerSkin(wyrmspireSkin);
registerSkin(deepholdSkin);
registerSkin(leylinesSkin);

export { shieldwallSkin, agesSkin, warTableSkin, wyrmspireSkin, deepholdSkin, leylinesSkin, SHIELDWALL_SCHEMA, AGES_SCHEMA, WAR_TABLE_SCHEMA, WYRMSPIRE_SCHEMA, DEEPHOLD_SCHEMA, LEYLINES_SCHEMA };
