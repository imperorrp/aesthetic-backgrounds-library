import type { Schema } from '../../../core/schema';

export const SILENT_RUNNING_SCHEMA = {
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole scene (drifting in for big moments, or still), or following the action up close' },
  traffic: { type: 'number', min: 0.4, max: 2, step: 0.1, default: 1, label: 'How busy the lanes are' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'Chronicle' },
} satisfies Schema;
