import type { Schema } from '../../../core/schema';

export const SANDSEA_SCHEMA = {
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole desert (drifting in for big moments, or still), or following the crawlers and the worm up close' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How busy the sand is' },
  labels: { type: 'boolean', default: true, label: 'Call-outs and the radio' },
  hud: { type: 'boolean', default: true, label: 'The title and the log' },
} satisfies Schema;
