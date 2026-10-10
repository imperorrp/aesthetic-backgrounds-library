/**
 * Worlds built on the kit (src/engine/kit) that are not fantasy: each a lazy shell here (id,
 * label, schema) and its world in a chunk of its own. The template (./template) is not
 * registered; `pnpm create-world` copies it.
 */
import { lazySkin } from '../lazy';
import { SILENT_RUNNING_SCHEMA } from './silent-running/schema';

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

export const worldSkins = [silentRunningSkin] as const;
