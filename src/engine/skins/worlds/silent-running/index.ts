/**
 * Silent Running's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountSea } from './paint';
import { SILENT_RUNNING_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountSea(host, resolveOptions(SILENT_RUNNING_SCHEMA, host.options));
}
