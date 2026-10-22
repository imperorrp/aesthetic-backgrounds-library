import type { Schema } from '../../../core/schema';

export const WAR_RIG_SCHEMA = {
  view: { type: 'enum', values: ['scene', 'map'], default: 'scene', label: 'View: the chase side-on, or the waste from overhead with its dust wakes' },
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole chase (drifting in for big moments, or still), or riding up close with the action' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How big the war party is' },
  labels: { type: 'boolean', default: true, label: 'Call-outs and shouted lines' },
  hud: { type: 'boolean', default: true, label: 'The title and the chronicle' },
} satisfies Schema;
