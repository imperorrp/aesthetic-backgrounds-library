/**
 * Built-in skins. Importing this module registers them by id so
 * `mount(el, { skin: 'matrix-rain' })` and `<bg-engine skin="matrix-rain">` work,
 * along with void-tactical's part layers and the `void-sector` preset.
 */
import { registerSkin } from '../core/registry';
import type { BackgroundSkin } from '../core/skin';
import { voidTacticalSkin } from './void-tactical/runtime';
import { driftingDustSkin } from './drifting-dust';
import { matrixRainSkin } from './matrix-rain';
import { localSkins } from './local';
import { instrumentSkins, sonarSkin, atcRadarSkin, seismicSkin, abyssalSkin, marsRadarSkin } from './instruments';
import { undercitySkin, prepareUndercity } from './undercity';
import { shieldwallSkin, agesSkin, warTableSkin, wyrmspireSkin, deepholdSkin, leylinesSkin } from './fantasy';
import { petriSkin } from './petri';

export const builtInSkins: readonly BackgroundSkin[] = [voidTacticalSkin, undercitySkin, shieldwallSkin, agesSkin, warTableSkin, wyrmspireSkin, deepholdSkin, leylinesSkin, ...instrumentSkins, petriSkin, driftingDustSkin, matrixRainSkin, ...localSkins];
builtInSkins.forEach((skin) => registerSkin(skin));

export { voidTacticalSkin, undercitySkin, prepareUndercity, shieldwallSkin, agesSkin, warTableSkin, wyrmspireSkin, deepholdSkin, leylinesSkin, petriSkin, driftingDustSkin, matrixRainSkin, instrumentSkins, sonarSkin, atcRadarSkin, seismicSkin, abyssalSkin, marsRadarSkin };
export type { VoidTacticalOptions } from './void-tactical/runtime';
export type { NetworkSkinOptions } from './drifting-dust';
export type { MatrixSkinOptions } from './matrix-rain';
export {
  voidLayers,
  voidAtmosphereLayer,
  voidStarsLayer,
  voidSystemsLayer,
  voidFleetsLayer,
  voidHudLayer,
  voidSectorPreset,
} from './void-tactical/layers';
