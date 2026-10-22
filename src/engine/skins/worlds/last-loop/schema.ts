import type { Schema } from '../../../core/schema';

export const LAST_LOOP_SCHEMA = {
  view: { type: 'enum', values: ['scene', 'map'], default: 'scene', label: 'View: the system as a lit orrery, or the same system as a hand-drawn chart from above' },
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole system (drifting in for big moments, or still), or following the ship up close' },
  loop: { type: 'number', min: 4, max: 30, step: 1, default: 22, label: 'Minutes in a loop, from waking to the supernova' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How busy the system is' },
  labels: { type: 'boolean', default: true, label: 'Subtitles, and the name of what they are about' },
  hud: { type: 'boolean', default: true, label: 'The title, the ship\'s log and the loop clock' },
} satisfies Schema;
