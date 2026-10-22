/**
 * Titan Dock's mount: the world chunk the lazy shell (../index.ts) loads.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { resolveOptions } from '../../../core/schema';
import { mountTitanDock } from './paint';
import { TITAN_DOCK_SCHEMA } from './schema';

export function mount(host: SkinHost): SkinInstance {
  return mountTitanDock(host, resolveOptions(TITAN_DOCK_SCHEMA, host.options));
}
