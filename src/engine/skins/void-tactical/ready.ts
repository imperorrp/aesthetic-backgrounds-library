/**
 * Readiness: a sector map can start once its universe pack and every mechanic it runs
 * are loaded. Both load on demand, so mounting may have to wait a moment (the skin shows
 * the plain plate meanwhile). Harnesses and tests call `prepareVoidTactical` first to
 * start exactly on frame 0.
 */
import { isUniverseReady, loadUniverse, resolveUniverse } from './universe';
import { loadMechanics, mechanicsReady, type MechanicRef } from './mechanics';

type Options = { universe?: unknown; pack?: unknown; mechanics?: unknown } | undefined;

/** The universe id a mount asks for (an inline pack needs no loading). */
export function universeIdOf(options: Options): string | undefined {
  return !options?.pack && typeof options?.universe === 'string' ? options.universe : undefined;
}

/** The mechanic ids a mount will run: its own list, or its pack's. The pack must be loaded. */
function mechanicIds(options: Options): string[] {
  const refs = (Array.isArray(options?.mechanics) ? options.mechanics : resolveUniverse(options as never).mechanics ?? []) as MechanicRef[];
  return refs.filter((r) => r && r.enabled !== false).map((r) => r.use);
}

export function isVoidReady(options: Options): boolean {
  return isUniverseReady(universeIdOf(options)) && mechanicsReady(mechanicIds(options));
}

/** Load the universe and the mechanics a mount needs. Resolves immediately when they are loaded. */
export async function prepareVoidTactical(options?: Options): Promise<void> {
  const id = universeIdOf(options);
  if (id) await loadUniverse(id);
  await loadMechanics(mechanicIds(options));
}
