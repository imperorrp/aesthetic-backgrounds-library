/**
 * `space-background-engine/skins/void-tactical`: registers and exports the default
 * sci-fi sector skin, its part layers (`void-atmosphere`, `void-stars`,
 * `void-systems`, `void-fleets`, `void-hud`), the `void-sector` preset built from
 * them, and the whole skin as a single scene layer.
 */
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
export {
  voidLayers,
  voidAtmosphereLayer,
  voidStarsLayer,
  voidSystemsLayer,
  voidFleetsLayer,
  voidHudLayer,
  voidSectorPreset,
} from '../../engine/skins/void-tactical/layers';
export type { VoidTacticalOptions } from '../../engine/skins/void-tactical/runtime';
export {
  registerUniverse,
  getUniverse,
  listUniverses,
  validateUniverse,
  universePrompt,
  VOID_PACK,
  SALTWIND_PACK,
  CHOIR_PACK,
} from '../../engine/skins/void-tactical/universe';
export type { UniversePack, UniverseValidation, ShipClass, AnomalyStyle, StructureRole } from '../../engine/skins/void-tactical/universe';
export { githubUniverse, packFromGithub, GithubUniverseError } from '../../engine/skins/void-tactical/github';
export type { OverlayFlags, OverlayId } from '../../engine/skins/void-tactical/overlays/flags';
