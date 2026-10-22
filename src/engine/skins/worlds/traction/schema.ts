import type { Schema } from '../../../core/schema';

export const TRACTION_SCHEMA = {
  view: { type: 'enum', values: ['scene', 'map'], default: 'scene', label: 'The scene from alongside the city, or the navigator\'s survey chart of the same hunt' },
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole hunting ground (drifting in for big moments, or still), or following the hunt up close' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How busy the plain is' },
  labels: { type: 'boolean', default: true, label: 'Call-outs, name tags and the radio' },
  hud: { type: 'boolean', default: true, label: 'The title and the chronicle' },
} satisfies Schema;
