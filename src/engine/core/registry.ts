import type { BackgroundSkin } from './skin';

/**
 * String-id registry so hosts that cannot pass objects (the `<bg-engine>` element,
 * JSON configs, URL params) can still pick a skin: `mount(el, { skin: 'matrix-rain' })`.
 * Built-in skins register themselves when `space-background-engine` is imported;
 * the `space-background-engine/core` entry ships no skins, so import the ones you use.
 */
const skins = new Map<string, BackgroundSkin>();

export const DEFAULT_SKIN_ID = 'void-tactical';

export function registerSkin<T>(skin: BackgroundSkin<T>): BackgroundSkin<T> {
  skins.set(skin.id, skin as BackgroundSkin);
  return skin;
}

export function getSkin(id: string): BackgroundSkin | undefined {
  return skins.get(id);
}

export function listSkins(): string[] {
  return [...skins.keys()];
}

/** Accepts a skin object or a registered id. Falls back to the default skin id when nothing is given. */
export function resolveSkin<T>(
  skin: BackgroundSkin<T> | string | undefined | null,
  fallbackId: string = DEFAULT_SKIN_ID,
): BackgroundSkin<T> {
  if (skin && typeof skin !== 'string') return skin;
  const id = skin || fallbackId;
  const found = skins.get(id);
  if (!found) {
    const known = listSkins();
    const hint = skin
      ? 'Import the skin and pass the object, or call registerSkin() before mounting.'
      : `No skin given and "${fallbackId}" is not registered. Import "space-background-engine" (all built-ins) or "space-background-engine/skins/${fallbackId}".`;
    throw new Error(
      `Unknown skin "${id}". Registered skins: ${known.length ? known.join(', ') : '(none)'}. ${hint}`,
    );
  }
  return found as BackgroundSkin<T>;
}
