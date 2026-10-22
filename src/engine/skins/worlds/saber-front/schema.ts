import type { Schema } from '../../../core/schema';

export const SABER_FRONT_SCHEMA = {
  view: { type: 'enum', values: ['scene', 'map'], default: 'scene', label: 'View: the battlefield from the ridge, or the same battle on a commander\'s holo-table' },
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole battlefield (drifting in for big moments, or still), or following the fighting up close' },
  field: { type: 'enum', values: ['seed', 'arena', 'crystal', 'jungle', 'platform', 'canyon'], default: 'seed', label: 'Battlefield: drawn by the seed, or one of the five' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How big the battle is' },
  labels: { type: 'boolean', default: true, label: 'Call-outs and the radio' },
  hud: { type: 'boolean', default: true, label: 'The title and the war record' },
} satisfies Schema;
