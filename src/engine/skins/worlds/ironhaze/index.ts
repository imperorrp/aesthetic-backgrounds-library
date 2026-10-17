/**
 * Ironhaze's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountHaze } from './paint';
import { IRONHAZE_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountHaze(host, resolveOptions(IRONHAZE_SCHEMA, host.options));
}
