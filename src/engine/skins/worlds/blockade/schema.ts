import type { Schema } from '../../../core/schema';

export const BLOCKADE_SCHEMA = {
  view: { type: 'enum', values: ['scene', 'map'], default: 'scene', label: 'View: the fleet over the planet, or the flagship\'s orbital plot of the same blockade' },
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole line and the planet (drifting in for big moments, or still), or following the action up close' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How busy the lanes are' },
  labels: { type: 'boolean', default: true, label: 'Call-outs and the radio' },
  hud: { type: 'boolean', default: true, label: 'The title and the chronicle' },
} satisfies Schema;
