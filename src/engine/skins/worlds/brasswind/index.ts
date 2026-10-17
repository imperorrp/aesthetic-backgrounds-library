/**
 * Brasswind's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountBrass } from './paint';
import { BRASSWIND_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountBrass(host, resolveOptions(BRASSWIND_SCHEMA, host.options));
}
