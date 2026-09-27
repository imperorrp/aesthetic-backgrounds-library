import { renderSystem } from './renderers';
import type { VoidStyle } from './renderers/utils';
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import { createOverlayStack } from './overlays/stack';
import { DEFAULT_OVERLAYS, type OverlayFlags, type OverlayId } from './overlays/flags';
import type { Schema } from '../../core/schema';
import { createVoidWorld, resolveStyle, STYLE_SCHEMA } from './world';

/** Flat flags (matching the schema), calibration knobs, and/or a nested `layers` object; flat keys win. */
export type VoidTacticalOptions = Partial<Record<OverlayId, boolean>> &
  Partial<VoidStyle> & {
    /** Toggle the CSS atmosphere layers (gradient, mesh, grid, clouds, noise, mouse glow). */
    layers?: OverlayFlags;
  };

export const OVERLAY_LABELS: Record<OverlayId, string> = {
  gradient: 'Space gradient',
  mesh: 'Mesh constellations',
  asciiGrid: 'Tactical grid',
  ascii1: 'ASCII map 1',
  ascii2: 'ASCII map 2',
  clouds: 'Dust clouds',
  noise: 'Noise grain',
  starfield: 'CSS starfield',
  mouseGlow: 'Mouse glow',
};

export const OVERLAY_SCHEMA: Schema = Object.fromEntries(
  (Object.keys(DEFAULT_OVERLAYS) as OverlayId[]).map((id) => [id, { type: 'boolean', default: DEFAULT_OVERLAYS[id], label: OVERLAY_LABELS[id] }]),
);

const schema: Schema = { ...STYLE_SCHEMA, ...OVERLAY_SCHEMA };

export function overlayFlags(options?: VoidTacticalOptions): OverlayFlags {
  const flags: OverlayFlags = { ...options?.layers };
  for (const id of Object.keys(DEFAULT_OVERLAYS) as OverlayId[]) {
    const v = options?.[id];
    if (typeof v === 'boolean') flags[id] = v;
  }
  return flags;
}

/**
 * First skin: the extracted Bubble Galaxies landing background as one unit.
 * Streaming camera, weighted structures, fleets, ambient HUD. The same world
 * also drives the `void-*` layers for scenes that want the parts separately.
 *
 * Deterministic: world generation draws from `host.rng`, per-frame randomness from a
 * forked stream, and all timing from `FrameInfo`, so one seed replays identically.
 */
export const voidTacticalSkin: BackgroundSkin<VoidTacticalOptions> = {
  id: 'void-tactical',
  label: 'Void tactical',
  description: 'Streaming sci-fi sector map: systems, structures, fleets, and an ambient HUD.',
  tags: ['space', 'sci-fi', 'dark', 'busy'],
  schema,
  /** Calibrated defaults: dense, detailed, and held back to 45% presence so page content leads. */
  defaults: { palette: 'void-cyan', intensity: 0.45, density: 1.5, detail: 'high' },
  layers(root, { options }) {
    const stack = createOverlayStack(root, overlayFlags(options), { position: 'absolute' });
    return () => stack.destroy();
  },
  mount(host: SkinHost<VoidTacticalOptions>) {
    const { ctx } = host;
    const style = resolveStyle(host.options);
    const sim = createVoidWorld(host);
    return {
      resize(viewport: Viewport) {
        sim.resize(viewport);
      },
      frame(info: FrameInfo) {
        sim.update(info);
        const { width, height } = sim;
        ctx.clearRect(0, 0, width, height);
        renderSystem(ctx, sim.world, sim.camera, { width, height }, sim.frameFor(info, style));
      },
      destroy() {},
    };
  },
};
