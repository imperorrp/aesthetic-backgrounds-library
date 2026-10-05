/**
 * Petri: artificial life under a microscope. The shell (registered with the built-ins);
 * the dish loads the first time one mounts (see ../lazy.ts).
 */
import type { Schema } from '../../core/schema';
import { lazySkin } from '../lazy';

export const PETRI_SCHEMA = {
  medium: { type: 'enum', values: ['particles', 'lenia'], default: 'particles', label: 'Medium' },
  stain: { type: 'enum', values: ['fluorescent', 'darkfield', 'phase'], default: 'fluorescent', label: 'Stain' },
  species: { type: 'number', min: 3, max: 7, step: 1, default: 6, label: 'Species' },
  life: { type: 'number', min: 0.4, max: 1.6, default: 1, label: 'How much life' },
  predators: { type: 'boolean', default: true, label: 'A hunting strain' },
  drops: { type: 'number', min: 0, max: 2, default: 1, label: 'The technician (drops, reagents)' },
  tracking: { type: 'boolean', default: true, label: 'Track specimens' },
  notebook: { type: 'boolean', default: true, label: 'Lab notebook and chart' },
  hud: { type: 'boolean', default: true, label: 'Instrument readout' },
} satisfies Schema;

export const petriSkin = lazySkin(
  {
    id: 'petri',
    label: 'Petri dish',
    description: 'Artificial life under a microscope: strains that feed, hunt, divide, engulf, and colonize, a contamination at the rim, a drifting focus, and a notebook naming what is found; or a Lenia culture of gliding creatures.',
    tags: ['instrument', 'science', 'life', 'biology', 'dark', 'organic'],
    crisp: true,
    schema: PETRI_SCHEMA,
    defaults: { palette: { from: '#4ade80' }, intensity: 0.75 },
  },
  () => import('./dish'),
);
