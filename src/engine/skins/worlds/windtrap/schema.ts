import type { Schema } from '../../../core/schema';

export const WINDTRAP_SCHEMA = {
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole cliff (drifting in for big moments, or still), or following the people of the hold up close' },
  people: { type: 'number', min: 0.5, max: 2, step: 0.1, default: 1, label: 'How many live in the hold' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'The title, the water count and the log' },
} satisfies Schema;
