/**
 * The wallpaper page: one living background, full screen, nothing else.
 *
 * Settings come from an inline `window.__BGE_WALLPAPER__` (the offline file the studio
 * downloads) or the URL (`wallpaper.html?c=…`, for Lively, Plash, KDE, Wallpaper
 * Engine, or a browser). The last one is remembered, so a home-screen shortcut opens
 * the same world. 30 fps by default, paused while hidden, deaf to clicks unless asked.
 */
import { builtInSkins, mount, presets, standardLayers, type MountOptions } from '../lib';
// Every world, eagerly: the offline file has no server to fetch chunks from.
import '../engine/skins/void-tactical/packs';
import '../engine/skins/void-tactical/mechanics/all';
import '../engine/skins/undercity/city';
import { readWallpaperQuery, type WallpaperSettings } from './codec';

/**
 * Skins, layers, and presets register themselves on import. Naming them here keeps a
 * bundler from deciding the imports are unused and dropping the registration with them.
 */
export const registered = { skins: builtInSkins.length, layers: standardLayers.length, presets: presets.length };
// An app build drops entry exports, so read it too: otherwise the deployed page registers nothing.
document.documentElement.dataset.worlds = String(registered.skins + registered.layers + registered.presets);

declare global {
  interface Window {
    __BGE_WALLPAPER__?: WallpaperSettings;
  }
}

const LAST = 'bge.wallpaper.last';

function settings(): WallpaperSettings {
  const inline = window.__BGE_WALLPAPER__;
  if (inline?.config) return inline;
  const fromUrl = readWallpaperQuery(location.search, location.hash);
  if (fromUrl) {
    try {
      localStorage.setItem(LAST, JSON.stringify(fromUrl));
    } catch {
      /* private mode */
    }
    return fromUrl;
  }
  try {
    const last = JSON.parse(localStorage.getItem(LAST) ?? 'null') as WallpaperSettings | null;
    if (last?.config) return last;
  } catch {
    /* nothing saved */
  }
  return { config: { skin: 'void-tactical' } };
}

const s = settings();
const handle = mount(document.body, {
  ...(s.config as MountOptions),
  fonts: true,
  targetFps: s.fps ?? 30,
  pixelRatio: s.pr,
  interactive: s.interactive,
  legibility: 'off',
  pauseWhenHidden: true,
});
if (s.skip) handle.fastForward(Math.min(s.skip, 1800));

// In a plain browser tab: double-click for full screen, and say so once.
document.addEventListener('dblclick', () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
});
if (new URLSearchParams(location.search).get('hint') === '1') {
  const hint = document.createElement('div');
  hint.textContent = 'Double-click for full screen';
  hint.style.cssText =
    'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:5;padding:8px 14px;border-radius:999px;' +
    'background:rgba(5,8,14,.72);color:#e8f4f8;font:13px/1.2 system-ui,sans-serif;pointer-events:none;transition:opacity 1s';
  document.body.appendChild(hint);
  setTimeout(() => (hint.style.opacity = '0'), 3500);
  setTimeout(() => hint.remove(), 5000);
}
