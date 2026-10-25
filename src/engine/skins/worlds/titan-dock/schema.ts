import type { Schema } from '../../../core/schema';

export const TITAN_DOCK_SCHEMA = {
  view: { type: 'enum', values: ['scene', 'map'], default: 'scene', label: 'View: the dock and the bay as a film frame, or the defence command\'s radar plot of the same coast' },
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole dock and bay (drifting in for the fights, or still), or following the action up close' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How busy the dock is (crews on the floor)' },
  labels: { type: 'boolean', default: true, label: 'Call-outs, name tags and the radio' },
  hud: { type: 'boolean', default: true, label: 'The title, the breach clock and the chronicle' },
} satisfies Schema;
