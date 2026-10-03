import { renderSystem } from './renderers';
import type { VoidStyle } from './renderers/utils';
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import { createOverlayStack } from './overlays/stack';
import { DEFAULT_OVERLAYS, type OverlayFlags, type OverlayId } from './overlays/flags';
import type { Schema } from '../../core/schema';
import { createVoidWorld, resolveStyle, STYLE_SCHEMA } from './world';
import { listUniverses, resolveUniverse, type UniversePack } from './universe';
import { forkRng } from '../../rng';

/** Flat flags (matching the schema), calibration knobs, and/or a nested `layers` object; flat keys win. */
export type VoidTacticalOptions = Partial<Record<OverlayId, boolean>> &
  Partial<VoidStyle> & {
    /** Toggle the CSS atmosphere layers (gradient, mesh, grid, clouds, noise, mouse glow). */
    layers?: OverlayFlags;
    /** A registered universe id (`void`, `saltwind`, `choir`, or your own via `registerUniverse`). */
    universe?: string;
    /** An inline universe pack (for example, one an AI wrote). Wins over `universe`. */
    pack?: UniversePack | Record<string, unknown>;
  };

export const OVERLAY_LABELS: Record<OverlayId, string> = {
  gradient: 'Space gradient',
  mesh: 'Mesh constellations',
  asciiGrid: 'Tactical grid',
  ascii1: 'Background words (far)',
  ascii2: 'Background words (near)',
  clouds: 'Dust clouds',
  noise: 'Noise grain',
  starfield: 'CSS starfield',
  mouseGlow: 'Mouse glow',
};

export const OVERLAY_SCHEMA: Schema = Object.fromEntries(
  (Object.keys(DEFAULT_OVERLAYS) as OverlayId[]).map((id) => [id, { type: 'boolean', default: DEFAULT_OVERLAYS[id], label: OVERLAY_LABELS[id] }]),
);

export const UNIVERSE_SCHEMA: Schema = {
  universe: {
    type: 'enum',
    values: listUniverses().map((u) => u.id),
    default: 'void',
    label: 'Universe',
    description: 'Whose map this is: names, factions, structures, chatter, background words',
  },
};

const schema: Schema = { ...UNIVERSE_SCHEMA, ...STYLE_SCHEMA, ...OVERLAY_SCHEMA };

export function overlayFlags(options?: VoidTacticalOptions): OverlayFlags {
  const flags: OverlayFlags = { ...options?.layers };
  for (const id of Object.keys(DEFAULT_OVERLAYS) as OverlayId[]) {
    const v = options?.[id];
    if (typeof v === 'boolean') flags[id] = v;
  }
  return flags;
}

/** The pack's ambient lines in a seeded order, so each seed shows different words. */
export function ambientWords(options: VoidTacticalOptions | undefined, seed: string | number): string[] {
  const words = [...resolveUniverse(options).ambient];
  const rng = forkRng(seed, 'ambient');
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words;
}

/**
 * The sector map: a streaming tactical chart where fleets fly in formation between
 * structures that do things, anomalies pulse, and the HUD chatters. What world it
 * is comes from a universe pack.
 *
 * Deterministic: world generation draws from `host.rng`, per-frame randomness from
 * forked streams, and all timing from `FrameInfo`, so one seed replays identically.
 */
export const voidTacticalSkin: BackgroundSkin<VoidTacticalOptions> = {
  id: 'void-tactical',
  label: 'Void tactical',
  description: 'A living sci-fi sector map: fleets in formation, working structures, anomalies, and an ambient HUD.',
  tags: ['space', 'sci-fi', 'dark', 'busy'],
  schema,
  /** Dense, detailed, and held back to 45% presence so page content leads. */
  defaults: { palette: 'void-cyan', intensity: 0.45, density: 1.5, detail: 'high' },
  layers(root, { options, config }) {
    const stack = createOverlayStack(root, overlayFlags(options), { position: 'absolute', words: ambientWords(options, config.seed) });
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
