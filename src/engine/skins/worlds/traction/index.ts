/**
 * Traction's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountTraction } from './paint';
import { TRACTION_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountTraction(host, resolveOptions(TRACTION_SCHEMA, host.options));
}
