/**
 * Sandsea's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountSandsea } from './paint';
import { SANDSEA_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountSandsea(host, resolveOptions(SANDSEA_SCHEMA, host.options));
}
