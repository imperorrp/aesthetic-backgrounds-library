/**
 * Built-in mechanics. Importing this module registers them; `registerMechanic` adds
 * your own, and a universe pack (or the studio) turns them on by id.
 */
import './combat';
import './events';
import './asteroids';
import './storms';
import './choir';
import './warfront';

export { registerMechanic, getMechanic, listMechanics, steerToward, steerOrbit } from './types';
export type { Mechanic, MechanicApi, MechanicInstance, MechanicPass, MechanicRef, MechanicSpawn } from './types';
export type { Fx } from './fx';
