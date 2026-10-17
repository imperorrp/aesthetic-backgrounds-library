import type { Schema } from '../../../core/schema';

export const BRASSWIND_SCHEMA = {
  camera: { type: 'enum', values: ['drift', 'still', 'follow', 'director'], default: 'drift', label: 'Camera: the whole city (drifting in for big moments, or still), or following the ships up close' },
  traffic: { type: 'number', min: 0.4, max: 2.5, step: 0.1, default: 1, label: 'How busy the sky is' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'The plaque and the chronicle' },
} satisfies Schema;
