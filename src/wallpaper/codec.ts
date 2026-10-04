/**
 * How a wallpaper travels: the same object you would pass to `mount()`, as base64url
 * JSON in `?c=`, plus a few page settings. Shared by the studio (which writes links and
 * files) and the wallpaper page (which reads them). No engine imports, so the studio
 * can use it without pulling the runtime in.
 */

export type WallpaperSettings = {
  /** The `mount()` config: skin, seed, palette, options, and the rest. */
  config: Record<string, unknown>;
  /** Frame cap. Default 30: a wallpaper runs all day. */
  fps?: number;
  /** Fixed backing pixels per CSS pixel (0 or absent: the device's, capped). */
  pr?: number;
  /** Seconds to simulate before the first frame, so the world is already busy. */
  skip?: number;
  /** Let the wheel zoom and drags pan. */
  interactive?: boolean;
};

export function encodeConfig(config: Record<string, unknown>): string {
  const json = JSON.stringify(config);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeConfig(b64: string): Record<string, unknown> | null {
  try {
    const json = decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))));
    const out = JSON.parse(json) as unknown;
    return out && typeof out === 'object' && !Array.isArray(out) ? (out as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The query string for a wallpaper page: `c=…&fps=30`. */
export function wallpaperQuery(s: WallpaperSettings): string {
  const q = new URLSearchParams();
  q.set('c', encodeConfig(s.config));
  if (s.fps) q.set('fps', String(s.fps));
  if (s.pr) q.set('pr', String(s.pr));
  if (s.skip) q.set('skip', String(s.skip));
  if (s.interactive) q.set('i', '1');
  return q.toString();
}

/** Read a wallpaper page's settings from its query (or hash, for hosts that drop queries). */
export function readWallpaperQuery(search: string, hash = ''): WallpaperSettings | null {
  const q = new URLSearchParams(search || hash.replace(/^#/, ''));
  const c = q.get('c');
  const config = c ? decodeConfig(c) : null;
  if (!config) return null;
  const num = (k: string) => {
    const v = Number(q.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  return { config, fps: num('fps'), pr: num('pr'), skip: num('skip'), interactive: q.get('i') === '1' };
}
