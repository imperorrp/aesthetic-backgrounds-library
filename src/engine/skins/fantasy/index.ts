/**
 * The fantasy worlds' shells: tiny, registered with the built-ins. Each world loads the
 * first time it mounts (see ../lazy.ts).
 *
 *   shieldwall   pitched battles between peoples, side-on or from above, in pixel sprites
 *   ages         a thousand years of a continent from above: kingdoms rise, war, and fall
 *   war-table    one war's campaign on a parchment map: ink orders and painted tokens
 */
import type { Schema } from '../../core/schema';
import { lazySkin } from '../lazy';

export const SHIELDWALL_SCHEMA = {
  view: { type: 'enum', values: ['side', 'above'], default: 'side', label: 'View' },
  battles: { type: 'enum', values: ['any', 'field', 'siege'], default: 'any', label: 'Battles' },
  troops: { type: 'number', min: 0.3, max: 2, default: 1, label: 'Army size' },
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
    description: 'Pitched battles and sieges in pixel sprites: shieldwalls, volleys, cavalry charges, towers at the walls, mages, standards, night fighting by torchlight, and sometimes a dragon. A war of five battles, then a new one.',
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

export const WAR_TABLE_SCHEMA = {
  realms: { type: 'number', min: 2, max: 3, step: 1, default: 2, label: 'Realms at war' },
  pace: { type: 'number', min: 0.3, max: 3, default: 1, label: 'Pace of the campaign' },
  dragons: { type: 'number', min: 0, max: 3, default: 1, label: 'Dragons' },
  candle: { type: 'boolean', default: true, label: 'Candlelight' },
  notes: { type: 'boolean', default: true, label: 'Notes in the margin' },
} satisfies Schema;

export const warTableSkin = lazySkin(
  {
    id: 'war-table',
    label: 'War table',
    description: 'A campaign on a parchment map: orders drawn in ink, painted tokens moved by an unseen hand, sieges counted in ticks, battles and burnings, winter quarters, and the wax seal of a peace.',
    tags: ['fantasy', 'map', 'parchment', 'light', 'medieval', 'calm'],
    crisp: true,
    schema: WAR_TABLE_SCHEMA,
    defaults: { palette: { from: '#7a4b23', theme: 'light' }, intensity: 0.7 },
  },
  () => import('./table'),
);
