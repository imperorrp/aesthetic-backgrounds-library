/**
 * Void-tactical as separable layers. All canvas layers share one simulation per
 * mount (see `sharedVoidWorld`), so a scene can drop the HUD, dim the fleets, or
 * put grain between the systems and the text, while fleets still steer toward the
 * structures the systems layer draws.
 */
import type { Layer } from '../../core/layer';
import { registerLayer } from '../../core/layer';
import { registerPreset, type PresetSkin } from '../../core/scene';
import type { Schema } from '../../core/schema';
import { createOverlayStack } from './overlays/stack';
import { renderStars, renderGrids } from './renderers/background';
import { renderCelestialBodies, renderStarSystem, renderStructures } from './renderers/celestial';
import { renderFleets, renderAnomalies } from './renderers/entities';
import { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections } from './renderers/ui';
import { FONT } from './renderers/utils';
import { OVERLAY_SCHEMA, overlayFlags } from './runtime';
import { resolveStyle, sharedVoidWorld, STYLE_SCHEMA } from './world';

const pick = (keys: string[]): Schema => Object.fromEntries(keys.map((k) => [k, STYLE_SCHEMA[k]]));

const TAGS = ['space', 'sci-fi', 'dark'];

/** CSS atmosphere: gradient plate, mesh constellations, tactical grid, ASCII wallpaper, clouds, grain, mouse glow. */
export const voidAtmosphereLayer: Layer = {
  id: 'void-atmosphere',
  label: 'Void atmosphere (CSS)',
  description: 'The sector map\'s GPU-composited plate: gradient, mesh, grid, ASCII wallpaper, clouds, grain, mouse glow.',
  tags: [...TAGS, 'base'],
  schema: OVERLAY_SCHEMA,
  dom(root, { options }) {
    const stack = createOverlayStack(root, overlayFlags(options as Record<string, boolean>), { position: 'absolute' });
    return () => stack.destroy();
  },
};

export const voidStarsLayer: Layer = {
  id: 'void-stars',
  label: 'Void stars',
  description: 'The sector map\'s parallax star layer.',
  tags: [...TAGS, 'motion'],
  schema: {},
  canvas(host) {
    const sim = sharedVoidWorld(host);
    const style = resolveStyle({});
    return {
      resize: (v) => sim.resize(v),
      frame(info) {
        sim.update(info);
        host.ctx.font = FONT;
        host.ctx.textBaseline = 'top';
        renderStars(host.ctx, sim.world.stars, sim.camera, { width: sim.width, height: sim.height }, sim.frameFor(info, style));
      },
    };
  },
};

export const voidSystemsLayer: Layer = {
  id: 'void-systems',
  label: 'Void systems',
  description: 'Star systems with orbits and hex radars, the data lanes between them, and ASCII structures.',
  tags: [...TAGS, 'structure'],
  schema: pick(['hueVariety', 'lineWeight', 'spriteScale', 'hud']),
  canvas(host) {
    const sim = sharedVoidWorld(host);
    const style = resolveStyle(host.options);
    return {
      resize: (v) => sim.resize(v),
      frame(info) {
        sim.update(info);
        const { ctx } = host;
        const viewport = { width: sim.width, height: sim.height };
        const frame = sim.frameFor(info, style);
        const { world, camera } = sim;
        ctx.font = FONT;
        ctx.textBaseline = 'top';
        renderCelestialBodies(ctx, world.celestialBodies, camera, viewport, frame);
        world.systems.forEach((sys) => renderStarSystem(ctx, sys, camera, viewport, world.settings, frame));
        renderSystemConnections(ctx, world.systems, camera, viewport, frame);
        const structures = [...world.structures, ...world.systems.flatMap((s) => s.structures)];
        renderStructures(ctx, structures, camera, viewport, world.settings, frame);
      },
    };
  },
};

export const voidFleetsLayer: Layer = {
  id: 'void-fleets',
  label: 'Void fleets',
  description: 'Fleets with AI states, trails, predicted paths, and anomaly markers.',
  tags: [...TAGS, 'motion'],
  schema: pick(['hueVariety', 'lineWeight', 'paths', 'trails', 'hud']),
  canvas(host) {
    const sim = sharedVoidWorld(host);
    const style = resolveStyle(host.options);
    return {
      resize: (v) => sim.resize(v),
      frame(info) {
        sim.update(info);
        const { ctx } = host;
        const viewport = { width: sim.width, height: sim.height };
        const frame = sim.frameFor(info, style);
        ctx.font = FONT;
        ctx.textBaseline = 'top';
        renderFleets(ctx, sim.world.fleets, sim.world.systems, sim.camera, viewport, sim.world, frame);
        renderAnomalies(ctx, sim.world.anomalies, sim.camera, viewport, sim.world.settings, frame);
      },
    };
  },
};

export const voidHudLayer: Layer = {
  id: 'void-hud',
  label: 'Void HUD',
  description: 'Sector grid, sector links, telemetry, and the ambient chatter overlays.',
  tags: [...TAGS, 'hud'],
  schema: pick(['hud', 'lineWeight', 'hueVariety']),
  canvas(host) {
    const sim = sharedVoidWorld(host);
    const style = resolveStyle(host.options);
    return {
      resize: (v) => sim.resize(v),
      frame(info) {
        sim.update(info);
        const { ctx } = host;
        const viewport = { width: sim.width, height: sim.height };
        const frame = sim.frameFor(info, style);
        ctx.font = FONT;
        ctx.textBaseline = 'top';
        renderGrids(ctx, sim.camera, viewport, frame);
        renderSectorConnections(ctx, sim.camera, viewport, frame);
        renderTelemetry(ctx, sim.world.telemetry, sim.world.settings, frame);
        renderTacticalOverlays(ctx, sim.world, sim.camera, viewport, frame);
      },
    };
  },
};

export const voidLayers: readonly Layer[] = [voidAtmosphereLayer, voidStarsLayer, voidSystemsLayer, voidFleetsLayer, voidHudLayer];
voidLayers.forEach((layer) => registerLayer(layer));

/** The skin rebuilt from its layers, so every part is toggleable and re-orderable in a scene. */
export const voidSectorPreset: PresetSkin = registerPreset({
  id: 'void-sector',
  label: 'Void sector (layers)',
  description: 'Void tactical composed from its layers: atmosphere, stars, systems, fleets, HUD. Reorder or drop any of them.',
  tags: ['space', 'sci-fi', 'dark', 'flagship'],
  config: { palette: 'void-cyan', intensity: 0.45, density: 1.5, detail: 'high' },
  scene: {
    layers: [
      { use: 'void-atmosphere' },
      { use: 'void-stars' },
      { use: 'void-systems' },
      { use: 'void-fleets' },
      { use: 'void-hud' },
    ],
  },
});
