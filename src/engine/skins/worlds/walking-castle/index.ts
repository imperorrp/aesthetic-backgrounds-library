/**
 * The Walking Castle's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountWalkingCastle } from './paint';
import { WALKING_CASTLE_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountWalkingCastle(host, resolveOptions(WALKING_CASTLE_SCHEMA, host.options));
}
