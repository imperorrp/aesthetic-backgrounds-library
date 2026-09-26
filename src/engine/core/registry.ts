import type { BackgroundSkin } from './skin';

/**
 * String-id registry so hosts that cannot pass objects (the `<bg-engine>` element,
 * JSON configs, URL params) can still pick a skin: `mount(el, { skin: 'matrix-rain' })`.
 * Built-in skins register themselves when `space-background-engine` is imported.
 */
const skins = new Map<string, BackgroundSkin>();

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

/** Accepts a skin object or a registered id. Falls back when nothing is given. */
export function resolveSkin<T>(
  skin: BackgroundSkin<T> | string | undefined,
  fallback: BackgroundSkin<T>,
): BackgroundSkin<T> {
  if (skin === undefined || skin === null || skin === '') return fallback;
  if (typeof skin !== 'string') return skin;
  const found = skins.get(skin);
  if (!found) {
    const known = listSkins();
    throw new Error(
      `Unknown skin "${skin}". Registered skins: ${known.length ? known.join(', ') : '(none)'}. ` +
        'Import the skin and pass the object, or call registerSkin() before mounting.',
    );
  }
  return found as BackgroundSkin<T>;
}
