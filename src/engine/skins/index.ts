/**
 * Built-in skins. Importing this module registers them by id so
 * `mount(el, { skin: 'matrix-rain' })` and `<bg-engine skin="matrix-rain">` work.
 */
import { registerSkin } from '../core/registry';
import type { BackgroundSkin } from '../core/skin';
import { voidTacticalSkin } from './void-tactical/runtime';
import { driftingDustSkin } from './drifting-dust';
import { matrixRainSkin } from './matrix-rain';

export const builtInSkins: readonly BackgroundSkin[] = [voidTacticalSkin, driftingDustSkin, matrixRainSkin];
builtInSkins.forEach((skin) => registerSkin(skin));

export { voidTacticalSkin, driftingDustSkin, matrixRainSkin };
export type { VoidTacticalOptions } from './void-tactical/runtime';
export type { NetworkSkinOptions } from './drifting-dust';
export type { MatrixSkinOptions } from './matrix-rain';
