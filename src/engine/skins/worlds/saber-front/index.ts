/**
 * Saber Front's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountSaberFront } from './paint';
import { SABER_FRONT_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountSaberFront(host, resolveOptions(SABER_FRONT_SCHEMA, host.options));
}
