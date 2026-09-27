/**
 * Skins scaffolded with `pnpm create-skin <id>` register here. The scaffold appends
 * an import and an array entry; remove both to retire a skin. Keep this file small
 * and let each skin live in its own folder.
 */
import type { BackgroundSkin } from '../core/skin';

import { exampleMotesSkin } from './example-motes';
// create-skin:imports

export const localSkins: readonly BackgroundSkin[] = [
  exampleMotesSkin,
  // create-skin:entries
];
