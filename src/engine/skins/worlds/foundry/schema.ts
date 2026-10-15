import type { Schema } from '../../../core/schema';

export const FOUNDRY_SCHEMA = {
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole scene (drifting in for big moments, or still), or following the action up close' },
  pace: { type: 'number', min: 0.5, max: 3, step: 0.1, default: 1, label: 'How fast the factory works and grows' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'Chronicle' },
} satisfies Schema;
