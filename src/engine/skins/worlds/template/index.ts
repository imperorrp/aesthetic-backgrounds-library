/**
 * The template world as a skin. `pnpm create-world <id>` copies this folder, renames the
 * skin, and registers the copy in src/engine/skins/local.ts. The template itself is not
 * registered: it is here to be copied, and its test keeps it working.
 */
import type { BackgroundSkin } from '../../../core/skin';
import { resolveOptions, type Schema } from '../../../core/schema';
import { mountPond } from './paint';

export const POND_SCHEMA = {
  camera: { type: 'enum', values: ['drift', 'still', 'director'], default: 'drift', label: 'Camera: the whole scene drifting in for big moments, perfectly still, or following the action' },
  frogs: { type: 'number', min: 1, max: 12, step: 1, default: 6, label: 'Frogs to begin with' },
  labels: { type: 'boolean', default: true, label: 'Call-outs' },
  hud: { type: 'boolean', default: true, label: 'Chronicle' },
} satisfies Schema;

export const templatePondSkin: BackgroundSkin = {
  id: 'template-pond',
  label: 'The Pond (template)',
  description: 'The template world: a pond where frogs hop between lily pads, a heron hunts, rain falls, and the lotus opens.',
  tags: ['world', 'template'],
  schema: POND_SCHEMA,
  crisp: true,
  defaults: { palette: { from: '#7dd3fc' }, intensity: 0.8 },
  mount: (host) => mountPond(host, resolveOptions(POND_SCHEMA, host.options)),
};
