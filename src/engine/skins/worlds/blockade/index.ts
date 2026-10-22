/**
 * Blockade's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountBlockade } from './paint';
import { BLOCKADE_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountBlockade(host, resolveOptions(BLOCKADE_SCHEMA, host.options));
}
