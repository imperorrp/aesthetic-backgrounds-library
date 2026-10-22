import type { Schema } from '../../../core/schema';

export const WALKING_CASTLE_SCHEMA = {
  view: { type: 'enum', values: ['scene', 'map'], default: 'scene', label: 'View: the castle walking through the country, or the same walk on a painted travel map' },
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole country (drifting in for big moments, or still), or following the castle up close' },
  pace: { type: 'number', min: 0.5, max: 2, step: 0.1, default: 1, label: 'How fast the castle walks' },
  labels: { type: 'boolean', default: true, label: 'What is said, as subtitles' },
  hud: { type: 'boolean', default: true, label: 'Title cards (and the diary on the map)' },
} satisfies Schema;
