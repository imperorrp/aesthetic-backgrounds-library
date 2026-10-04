/**
 * The fantasy worlds' shells: tiny, registered with the built-ins. Each world loads the
 * first time it mounts (see ../lazy.ts).
 *
 *   shieldwall   pitched battles between peoples, side-on or from above, in pixel sprites
 *   ages         a thousand years of a continent from above: kingdoms rise, war, and fall
 */
import type { Schema } from '../../core/schema';
import { lazySkin } from '../lazy';

export const SHIELDWALL_SCHEMA = {
  view: { type: 'enum', values: ['side', 'above'], default: 'side', label: 'View' },
  troops:{ type: 'number', min: 0.3, max: 2, default: 1, label: 'Army size' },
  magic: { type: 'number', min: 0, max: 2, default: 1, label: 'Magic' },
  dragons: { type: 'number', min: 0, max: 3, default: 1, label: 'Dragons' },
  weather: { type: 'enum', values: ['any', 'clear', 'rain', 'snow', 'fog', 'night'], default: 'any', label: 'Weather' },
  camera: { type: 'enum', values: ['follow', 'still'], default: 'follow', label: 'Camera' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'Chronicle' },
} satisfies Schema;

export const shieldwallSkin = lazySkin(
  {
    id: 'shieldwall',
    label: 'Shieldwall',
    description: 'Pitched battles in pixel sprites, side-on: shieldwalls, volleys, cavalry charges, mages, duelling lords, and sometimes a dragon. A war of five battles, then a new one.',
    tags: ['fantasy', 'battle', 'pixel', 'medieval', 'dark', 'busy'],
    crisp: true,
    schema: SHIELDWALL_SCHEMA,
    defaults: { palette: { from: '#d6a85c' }, intensity: 0.75 },
  },
  () => import('./battle'),
);

export const AGES_SCHEMA = {
  speed: { type: 'number', min: 0.25, max: 4, default: 1, label: 'Pace of history' },
  kingdoms: { type: 'number', min: 2, max: 8, step: 1, default: 5, label: 'Peoples at the start' },
  wars: { type: 'number', min: 0, max: 2, default: 1, label: 'How warlike' },
  disasters: { type: 'number', min: 0, max: 2, default: 1, label: 'Plagues, fires, hordes' },
  dragons: { type: 'number', min: 0, max: 2, default: 1, label: 'Dragons' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'Year, peoples, chronicle' },
} satisfies Schema;

export const agesSkin = lazySkin(
  {
    id: 'ages',
    label: 'Ages',
    description: 'A thousand years of a continent from above: hearths become cities, roads and borders spread, wars and sieges, plagues and hordes, wonders, and lights in the dark.',
    tags: ['fantasy', 'empire', 'map', 'pixel', 'dark', 'slow'],
    crisp: true,
    schema: AGES_SCHEMA,
    defaults: { palette: { from: '#e2b866' }, intensity: 0.75 },
  },
  () => import('./ages'),
);
