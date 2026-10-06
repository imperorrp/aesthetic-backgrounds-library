/**
 * The fantasy worlds' shells: tiny, registered with the built-ins. Each world loads the
 * first time it mounts (see ../lazy.ts).
 *
 *   shieldwall   pitched battles between peoples, side-on or from above, in pixel sprites
 *   ages         a thousand years of a continent from above: kingdoms rise, war, and fall
 *   war-table    one war's campaign on a parchment map: ink orders and painted tokens
 *   wyrmspire    a valley under a dragon's spire, seen from a watchtower
 *   deephold     a dwarven kingdom in cutaway: rival holds, highways, wars, a dragon, and what sleeps below
 *   leylines     mage towers on a map of glowing lines: power flows, storms, duels, rifts
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
  fog: { type: 'boolean', default: true, label: 'Fog of war' },
} satisfies Schema;

export const warTableSkin = lazySkin(
  {
    id: 'war-table',
    label: 'War table',
    description: 'A campaign on a parchment map: orders in ink, painted tokens moved by an unseen hand, sealed dispatches that can be taken or forged, the fog of what the council cannot see, the light of the seasons, and the wax seal of a peace.',
    tags: ['fantasy', 'map', 'parchment', 'light', 'medieval', 'calm'],
    crisp: true,
    schema: WAR_TABLE_SCHEMA,
    defaults: { palette: { from: '#7a4b23', theme: 'light' }, intensity: 0.7 },
  },
  () => import('./table'),
);

export const WYRMSPIRE_SCHEMA = {
  valley: { type: 'enum', values: ['any', 'alpine', 'fjord', 'canyon', 'fen', 'ashland'], default: 'any', label: 'The land' },
  wrath: { type: 'number', min: 0, max: 3, default: 1, label: 'How restless the wyrm is' },
  knights: { type: 'number', min: 0, max: 2, default: 1, label: 'Knights who ride out' },
  villages: { type: 'number', min: 2, max: 4, step: 1, default: 3, label: 'Villages' },
  time: { type: 'enum', values: ['cycle', 'dusk', 'night'], default: 'cycle', label: 'Time of day' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'The valley, the wyrm, the chronicle' },
} satisfies Schema;

export const wyrmspireSkin = lazySkin(
  {
    id: 'wyrmspire',
    label: 'Wyrmspire',
    description: 'A valley under a wyrm’s spire, through a watchtower’s spyglass: a different land and breed of wyrm each seed; herds, harvests, caravans, and festivals; a wyrm that basks, hunts, hoards, and raids; a lord who fortifies, pays tribute, or sends heroes up the spire path.',
    tags: ['fantasy', 'dragon', 'pixel', 'medieval', 'dark', 'calm'],
    crisp: true,
    schema: WYRMSPIRE_SCHEMA,
    defaults: { palette: { from: '#f97316' }, intensity: 0.75 },
  },
  () => import('./wyrm'),
);

export const DEEPHOLD_SCHEMA = {
  style: { type: 'enum', values: ['kingdom', 'classic'], default: 'kingdom', label: 'Style (a range of rival holds, or the single hold)' },
  holds: { type: 'enum', values: ['any', '2', '3', '4'], default: 'any', label: 'How many holds (kingdom)' },
  mountain: { type: 'enum', values: ['any', 'iron', 'crystal', 'frost', 'ember', 'drowned'], default: 'any', label: 'The mountain' },
  depth: { type: 'number', min: 0.3, max: 2, default: 1, label: 'How greedily they dig (classic)' },
  hazards: { type: 'number', min: 0, max: 2, default: 1, label: 'Floods, magma, cave-ins, goblins' },
  below: { type: 'enum', values: ['any', 'sleeper', 'lich', 'engine', 'hive', 'nothing'], default: 'any', label: 'What lies below' },
  scale: { type: 'number', min: 0.5, max: 2, default: 1, label: 'Scale (how big the mountain, how many dwarves)' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'The hold, its stores, the chronicle' },
} satisfies Schema;

export const deepholdSkin = lazySkin(
  {
    id: 'deephold',
    label: 'Deephold',
    description: 'A dwarven kingdom in cutaway: a range of mountains with two to four rival holds, each building its own way (ladders, lifts, or stairs; arched, domed, or vaulted halls; torches, braziers, crystal, or lava), and never stopping. They dig deeper, carve great halls and galleries of kings, cut highways to each other, trade, go to war, and fall and are retaken; a dragon comes over the peaks; and something below may wake. Each seed draws its own cast.',
    tags: ['fantasy', 'pixel', 'cutaway', 'dwarves', 'dark', 'busy'],
    crisp: true,
    schema: DEEPHOLD_SCHEMA,
    defaults: { palette: { from: '#f59e0b' }, intensity: 0.75 },
  },
  () => import('./deep'),
);

export const LEYLINES_SCHEMA = {
  style: { type: 'enum', values: ['ink', 'classic'], default: 'ink', label: 'Style' },
  land: { type: 'enum', values: ['any', 'isles', 'steppe', 'forest', 'desert', 'tundra', 'marsh', 'mountains'], default: 'any', label: 'The land' },
  scale: { type: 'number', min: 0.5, max: 2, default: 1, label: 'Scale (how much is going on)' },
  orders: { type: 'number', min: 2, max: 6, step: 1, default: 4, label: 'Orders of mages' },
  storms: { type: 'number', min: 0, max: 2, default: 1, label: 'Arcane storms' },
  rifts: { type: 'number', min: 0, max: 2, default: 1, label: 'Rifts' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'The orders, the moons, the chronicle' },
} satisfies Schema;

export const leylinesSkin = lazySkin(
  {
    id: 'leylines',
    label: 'Leylines',
    description: 'A land at night and the lines of power under it: orders of mages raising towers on the wells, power pulsing along the lines, duels fought along them, arcane storms, the convergence of the moons, and rifts that must be closed.',
    tags: ['fantasy', 'magic', 'map', 'glow', 'dark', 'calm'],
    crisp: true,
    schema: LEYLINES_SCHEMA,
    defaults: { palette: { from: '#a78bfa' }, intensity: 0.75 },
  },
  () => import('./ley'),
);
