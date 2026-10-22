/**
 * Last Loop's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountLastLoop } from './paint';
import { LAST_LOOP_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountLastLoop(host, resolveOptions(LAST_LOOP_SCHEMA, host.options));
}
