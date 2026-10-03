/**
 * The mechanic registry. Built-in mechanics load on demand: each id maps to the module
 * that registers it, and a world waits for the ones its universe runs before starting.
 * So a site pays only for what its universe does. `registerMechanic` adds your own
 * (loaded already); import `./all` to load every built-in at once (the studio does).
 */
import { registerMechanicLoader } from './types';

const BUILT_IN: Record<string, () => Promise<unknown>> = {
  skirmish: () => import('./combat'),
  events: () => import('./events'),
  economy: () => import('./economy'),
  police: () => import('./police'),
  gates: () => import('./gates'),
  relays: () => import('./relays'),
  asteroids: () => import('./asteroids'),
  storms: () => import('./storms'),
  wardens: () => import('./wardens'),
  warfront: () => import('./warfront'),
  front: () => import('./war'),
  artillery: () => import('./siege'),
  duels: () => import('./siege'),
  truces: () => import('./siege'),
  mines: () => import('./siege'),
  song: () => import('./choir'),
  flocks: () => import('./choir'),
  maw: () => import('./choir'),
  cartography: () => import('./choir'),
  leviathans: () => import('./leviathans'),
  echoes: () => import('./echoes'),
  cradles: () => import('./cradles'),
  restless: () => import('./restless'),
  dread: () => import('./dread'),
};
for (const [id, load] of Object.entries(BUILT_IN)) registerMechanicLoader(id, load);

export { registerMechanic, registerMechanicLoader, getMechanic, listMechanics, loadMechanics, mechanicsReady, steerToward, steerOrbit } from './types';
export type { Mechanic, MechanicApi, MechanicInstance, MechanicPass, MechanicRef, MechanicSpawn } from './types';
export type { Fx } from './fx';
