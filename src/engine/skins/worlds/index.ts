/**
 * Worlds built on the kit (src/engine/kit) that are not fantasy: each a lazy shell here (id,
 * label, schema) and its world in a chunk of its own. The template (./template) is not
 * registered; `pnpm create-world` copies it.
 */
import { lazySkin } from '../lazy';
import { SILENT_RUNNING_SCHEMA } from './silent-running/schema';
import { FOUNDRY_SCHEMA } from './foundry/schema';
import { BRASSWIND_SCHEMA } from './brasswind/schema';
import { IRONHAZE_SCHEMA } from './ironhaze/schema';

export const silentRunningSkin = lazySkin(
  {
    id: 'silent-running',
    label: 'Silent Running',
    description:
      'A sea at war on a listening station\'s chart: convoys on the lanes, raiders that stalk them unheard, destroyers that ping and hunt, whales, gales, and the wrecks that stay on the seabed.',
    tags: ['world', 'sea', 'sonar', 'war'],
    crisp: true,
    schema: SILENT_RUNNING_SCHEMA,
    defaults: { palette: { from: '#22d3ee' }, intensity: 0.8 },
  },
  () => import('./silent-running'),
);

export const foundrySkin = lazySkin(
  {
    id: 'foundry',
    label: 'Foundry',
    description:
      'A factory that builds itself: miners on the ore fields, furnaces, assemblers and labs, belts full of ore and plates, construction bots, research, and in time a rocket.',
    tags: ['world', 'factory', 'automation'],
    crisp: true,
    schema: FOUNDRY_SCHEMA,
    defaults: { palette: { from: '#f59e0b' }, intensity: 0.8 },
  },
  () => import('./foundry'),
);

export const brasswindSkin = lazySkin(
  {
    id: 'brasswind',
    label: 'Brasswind',
    description:
      'A skyport city of brass and steam: airships at the mooring masts, trams on the viaducts, smoke from the works, sky pirates and the Admiralty\'s corvettes, storms on the masts, races round the spires, and fireworks at night.',
    tags: ['world', 'steampunk', 'airships', 'city'],
    crisp: true,
    schema: BRASSWIND_SCHEMA,
    defaults: { palette: { from: '#c9a227' }, intensity: 0.85 },
  },
  () => import('./brasswind'),
);

export const ironhazeSkin = lazySkin(
  {
    id: 'ironhaze',
    label: 'Ironhaze',
    description:
      'A city of iron and smoke in five planes of fog, like a matte painting: the Great Spire and its clock, zeppelins and ironclad dreadnoughts at every depth, iron walkers striding through the streets, floating citadels on their chains, foundries pouring, trains on the viaduct.',
    tags: ['world', 'steampunk', 'dieselpunk', 'airships', 'city'],
    crisp: true,
    schema: IRONHAZE_SCHEMA,
    defaults: { palette: { from: '#b08a5a' }, intensity: 0.85 },
  },
  () => import('./ironhaze'),
);

export const worldSkins = [silentRunningSkin, foundrySkin, brasswindSkin, ironhazeSkin] as const;
