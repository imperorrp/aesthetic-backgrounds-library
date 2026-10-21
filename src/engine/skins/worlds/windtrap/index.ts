/**
 * Windtrap's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountWindtrap } from './paint';
import { WINDTRAP_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountWindtrap(host, resolveOptions(WINDTRAP_SCHEMA, host.options));
}
