/**
 * Void-tactical as separable layers. All canvas layers share one simulation per
 * mount (see `sharedVoidWorld`), so a scene can drop the HUD, dim the fleets, or
 * put grain between the systems and the text, while fleets still dock at the
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
import { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections, renderTargetLock } from './renderers/ui';
import { createLabelBoard } from './renderers/board';
import { FONT } from './renderers/utils';
import { ambientWords, OVERLAY_SCHEMA, overlayFlags, UNIVERSE_SCHEMA } from './runtime';
import { resolveStyle, sharedVoidWorld, STYLE_SCHEMA } from './world';
import { allStructures } from './fleets';

const pick = (keys: string[]): Schema => ({ ...UNIVERSE_SCHEMA, ...Object.fromEntries(keys.map((k) => [k, STYLE_SCHEMA[k]])) });

const TAGS = ['space', 'sci-fi', 'dark'];

/** CSS atmosphere: gradient plate, mesh constellations, tactical grid, background words, clouds, grain, mouse glow. */
export const voidAtmosphereLayer: Layer = {
  id: 'void-atmosphere',
  label: 'Void atmosphere (CSS)',
  description: 'The sector map\'s GPU-composited plate: gradient, mesh, grid, background words, clouds, grain, mouse glow.',
  tags: [...TAGS, 'base'],
  schema: { ...UNIVERSE_SCHEMA, ...OVERLAY_SCHEMA },
  dom(root, { options, config }) {
    const opts = options as Record<string, unknown>;
    const stack = createOverlayStack(root, overlayFlags(opts as Record<string, boolean>), { position: 'absolute', words: ambientWords(opts, config.seed) });
    return () => stack.destroy();
  },
  /** Export equivalent of the gradient plate and grid; the SVG wallpaper layers are omitted. */
  snapshot(ctx, viewport, { palette, options }) {
    const flags = overlayFlags(options as Record<string, boolean>);
    const { width, height } = viewport;
    if (flags.gradient !== false) {
      const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 2);
      g.addColorStop(0, palette.bg);
      g.addColorStop(0.55, `rgb(${palette.accentRgb.split(' ').join(', ')}, 0.07)`);
      g.addColorStop(1, `rgb(${palette.accentRgb.split(' ').join(', ')}, 0.12)`);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    if (flags.asciiGrid !== false) {
      ctx.save();
      ctx.strokeStyle = `rgba(${palette.accentRgb.split(' ').join(', ')}, 0.06)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += 60) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); }
      for (let y = 0; y < height; y += 60) { ctx.moveTo(0, y + 0.5); ctx.lineTo(width, y + 0.5); }
      ctx.stroke();
      ctx.restore();
    }
  },
};

export const voidStarsLayer: Layer = {
  id: 'void-stars',
  label: 'Void stars',
  description: 'The sector map\'s parallax star layer.',
  tags: [...TAGS, 'motion'],
  schema: { ...UNIVERSE_SCHEMA },
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
  description: 'Star systems with orbits and hex radars, the data lanes between them, and the structures.',
  tags: [...TAGS, 'structure'],
  schema: pick(['hueVariety', 'lineWeight', 'spriteScale', 'hud']),
  canvas(host) {
    const sim = sharedVoidWorld(host);
    const style = resolveStyle(host.options);
    const board = createLabelBoard();
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
        world.systems.forEach((sys) => renderStarSystem(ctx, sys, camera, viewport, world.settings, frame, board));
        renderSystemConnections(ctx, world.systems, camera, viewport, frame);
        renderStructures(ctx, allStructures(world), camera, viewport, world.settings, frame, board);
        board.flush(ctx, viewport);
      },
    };
  },
};

export const voidFleetsLayer: Layer = {
  id: 'void-fleets',
  label: 'Void fleets',
  description: 'Fleets in formation with trails and planned courses, plus the anomalies.',
  tags: [...TAGS, 'motion'],
  schema: pick(['hueVariety', 'lineWeight', 'shipScale', 'paths', 'trails', 'hud']),
  canvas(host) {
    const sim = sharedVoidWorld(host);
    const style = resolveStyle(host.options);
    const board = createLabelBoard();
    return {
      resize: (v) => sim.resize(v),
      frame(info) {
        sim.update(info);
        const { ctx } = host;
        const viewport = { width: sim.width, height: sim.height };
        const frame = sim.frameFor(info, style);
        ctx.font = FONT;
        ctx.textBaseline = 'top';
        renderAnomalies(ctx, sim.world, sim.camera, viewport, frame, board);
        renderFleets(ctx, sim.world, sim.camera, viewport, frame, board);
        board.flush(ctx, viewport);
      },
    };
  },
};

export const voidHudLayer: Layer = {
  id: 'void-hud',
  label: 'Void HUD',
  description: 'Sector grid, sector links, radio chatter, and the target lock.',
  tags: [...TAGS, 'hud'],
  schema: pick(['hud', 'lineWeight', 'hueVariety', 'lock']),
  canvas(host) {
    const sim = sharedVoidWorld(host);
    const style = resolveStyle(host.options);
    const board = createLabelBoard();
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
        renderTacticalOverlays(ctx, sim.world, sim.camera, viewport, frame, board);
        board.flush(ctx, viewport);
        renderTargetLock(ctx, sim.world, sim.camera, viewport, frame);
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
