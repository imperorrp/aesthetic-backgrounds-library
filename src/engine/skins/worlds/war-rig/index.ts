/**
 * War Rig's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountWarRig } from './paint';
import { WAR_RIG_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountWarRig(host, resolveOptions(WAR_RIG_SCHEMA, host.options));
}
