/**
 * Undercity: a 2.5D cyberpunk city at night, in the rain.
 *
 * Three parallax layers of streamed, procedurally generated buildings (a far skyline of
 * megatowers, mid towers with corp data fortresses, and a near megastructure cut open:
 * stacked levels with terraces, markets, stairs, and shopfronts on a wet street), air
 * traffic in lanes between the layers, maglev trains, crowds, steam, and rain. Over it
 * all, the net: netrunners jack in from their apartments, trace a path to a corp tower,
 * fight its ICE, and either breach it (the tower glitches, its ads are hijacked, the
 * district can go dark) or flatline (and the police come for the body).
 *
 * This module is the shell: tiny, registered with the built-in skins. The city itself
 * (city.ts and friends) loads the first time one mounts, so a page that never shows
 * Undercity never downloads it.
 */
import type { BackgroundSkin, SkinHost, SkinInstance, Viewport } from '../../core/skin';
import type { Schema } from '../../core/schema';

export const UNDERCITY_SCHEMA = {
  speed: { type: 'number', min: 0, max: 3, default: 1, label: 'How fast the city drifts past' },
  rain: { type: 'number', min: 0, max: 1.5, default: 0.8, label: 'Rain' },
  traffic: { type: 'number', min: 0, max: 2, default: 1, label: 'Air traffic' },
  crowd: { type: 'number', min: 0, max: 2, default: 1, label: 'Crowds' },
  net: { type: 'number', min: 0, max: 3, default: 1.2, label: 'Netruns per minute' },
  overlay: { type: 'boolean', default: true, label: 'Show the net' },
  hud: { type: 'boolean', default: true, label: 'Terminal readout' },
} satisfies Schema;

type MountCity = (host: SkinHost) => SkinInstance;
let impl: MountCity | null = null;

/** city.ts hands over its mount function when it loads. */
export function provideUndercity(m: MountCity): void {
  impl = m;
}

/** Load the city ahead of time (the harnesses do, so frame 0 is the real first frame). */
export async function prepareUndercity(): Promise<void> {
  if (!impl) await import('./city');
}

export const undercitySkin: BackgroundSkin = {
  id: 'undercity',
  label: 'Undercity',
  description: 'A 2.5D cyberpunk city at night: layered towers and an open megastructure, air traffic, trains, crowds, rain, and netrunners breaching corp ICE.',
  tags: ['city', 'cyberpunk', 'neon', 'rain', 'dark', 'busy'],
  crisp: true,
  schema: UNDERCITY_SCHEMA,
  defaults: { palette: { from: '#f472b6' }, intensity: 0.7 },
  mount(host: SkinHost) {
    if (impl) return impl(host);
    return deferred(host);
  },
  prepare: prepareUndercity,
};

/** Show the night plate while the city loads, then hand over. */
function deferred(host: SkinHost): SkinInstance {
  let inner: SkinInstance | null = null;
  let size: Viewport = { width: host.viewport.width, height: host.viewport.height };
  let destroyed = false;
  void prepareUndercity().then(() => {
    if (destroyed || !impl) return;
    inner = impl(host);
    inner.resize(size);
  });
  return {
    resize(v) {
      size = v;
      inner?.resize(v);
    },
    frame(info) {
      if (inner) inner.frame(info);
      else {
        host.ctx.fillStyle = host.palette.bg;
        host.ctx.fillRect(0, 0, size.width, size.height);
      }
    },
    advance: (info) => inner?.advance?.(info),
    inspect: () => inner?.inspect?.(),
    destroy() {
      destroyed = true;
      inner?.destroy();
    },
  };
}
