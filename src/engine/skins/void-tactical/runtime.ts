import type { Structure, SystemState } from './types';
import {
  generateSystem,
  generateSingleSystem,
  generateSingleStructure,
  generateSingleFleet,
  generateSingleAnomaly,
} from './generators';
import { renderSystem } from './renderers';
import { createColorMapper, WORLD_SPEED_MULTIPLIER, type RenderFrame, type VoidStyle } from './renderers/utils';
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import { createOverlayStack } from './overlays/stack';
import { DEFAULT_OVERLAYS, type OverlayFlags, type OverlayId } from './overlays/flags';
import { resolveOptions, type Schema } from '../../core/schema';

/** Flat flags (matching the schema), calibration knobs, and/or a nested `layers` object; flat keys win. */
export type VoidTacticalOptions = Partial<Record<OverlayId, boolean>> &
  Partial<VoidStyle> & {
    /** Toggle the CSS atmosphere layers (gradient, mesh, grid, clouds, noise, mouse glow). */
    layers?: OverlayFlags;
  };

/** Defaults are the calibrated look: near-original color variety, heavier lines, compact sprites, quieter HUD, long trails. */
const STYLE_SCHEMA: Schema = {
  hueVariety: { type: 'number', min: 0, max: 1, default: 0.94, label: 'Hue variety', description: '0 pulls every entity into the palette family; 1 keeps the original rainbow' },
  lineWeight: { type: 'number', min: 0.5, max: 2, default: 1.7, label: 'Line weight' },
  spriteScale: { type: 'number', min: 0.7, max: 2.5, default: 0.95, label: 'Sprite scale', description: 'Size of the ASCII structure art' },
  hud: { type: 'number', min: 0, max: 1, default: 0.52, label: 'HUD opacity', description: 'Grid, sector links, labels, telemetry, and overlay text' },
  paths: { type: 'enum', values: ['dots', 'dashed', 'off'], default: 'dots', label: 'Fleet paths', description: 'Predicted-path rendering' },
  trails: { type: 'number', min: 0, max: 1, default: 0.92, label: 'Fleet trails' },
};

const OVERLAY_LABELS: Record<OverlayId, string> = {
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

const schema: Schema = {
  ...STYLE_SCHEMA,
  ...Object.fromEntries(
    (Object.keys(DEFAULT_OVERLAYS) as OverlayId[]).map((id) => [id, { type: 'boolean', default: DEFAULT_OVERLAYS[id], label: OVERLAY_LABELS[id] }]),
  ),
};

function overlayFlags(options?: VoidTacticalOptions): OverlayFlags {
  const flags: OverlayFlags = { ...options?.layers };
  for (const id of Object.keys(DEFAULT_OVERLAYS) as OverlayId[]) {
    const v = options?.[id];
    if (typeof v === 'boolean') flags[id] = v;
  }
  return flags;
}

/**
 * First skin: the extracted Bubble Galaxies landing background.
 * Streaming camera, weighted structures, fleets, ambient HUD.
 * Other skins should not need to know these types.
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
    const { ctx, rng, config, palette } = host;
    let width = host.viewport.width;
    let height = host.viewport.height;
    const frameRng = host.fork('frame');
    const style = resolveOptions(STYLE_SCHEMA, host.options) as unknown as VoidStyle;
    const colorOf = createColorMapper(palette, style.hueVariety);

    const simSettings = {
      labelDensity: config.detail,
      overlaySpawnRate: config.overlaySpawnRate,
      maxOverlays: config.maxOverlays,
    };

    const layout = {
      systemDist: 480,
      structDist: 320,
      maxSystems: 5,
      maxStructs: 12,
      maxFleets: 8,
      maxAnomalies: 5,
      starCount: 150,
    };

    const updateLayout = () => {
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1024;
      const area = width * height;
      const densityFactor = isMobile ? 4000 : 7000;
      // Intensity thins the population. The quality governor never touches entity
      // budgets (they define the skin); it only trims the star count, and gently.
      const d = config.density * (0.5 + 0.5 * host.intensity);
      layout.starCount = Math.max(40, Math.min(400, Math.floor((area / densityFactor) * d * Math.max(0.6, host.quality))));
      if (isMobile) {
        layout.systemDist = 240;
        layout.structDist = 180;
        layout.maxSystems = Math.max(1, Math.round(3 * d));
        layout.maxStructs = Math.max(2, Math.round(6 * d));
        layout.maxFleets = Math.max(1, Math.round(4 * d));
        layout.maxAnomalies = Math.max(1, Math.round(3 * d));
      } else if (isTablet) {
        layout.systemDist = 360;
        layout.structDist = 260;
        layout.maxSystems = Math.max(1, Math.round(4 * d));
        layout.maxStructs = Math.max(2, Math.round(8 * d));
        layout.maxFleets = Math.max(1, Math.round(6 * d));
        layout.maxAnomalies = Math.max(1, Math.round(4 * d));
      } else {
        layout.systemDist = 480;
        layout.structDist = 320;
        layout.maxSystems = Math.max(1, Math.round(5 * d));
        layout.maxStructs = Math.max(2, Math.round(12 * d));
        layout.maxFleets = Math.max(1, Math.round(8 * d));
        layout.maxAnomalies = Math.max(1, Math.round(5 * d));
      }
    };

    updateLayout();
    const recentKinds: Array<Structure['kind']> = [];
    const base = generateSystem(width, height, {
      starCount: layout.starCount,
      rng,
      populate: false,
      settings: simSettings,
      palette,
    });
    const world: SystemState = { ...base, systems: [], structures: [], settings: simSettings };
    const camera = { x: 0, y: 0 };
    const systemParallax = 0.25 * WORLD_SPEED_MULTIPLIER;

    // Spawn scheduling in sim milliseconds (FrameInfo.t * 1000)
    const scheduleDelay = (baseMs: number, variance: number) => baseMs + rng() * variance;
    let nowMs = 0;
    let lastSystemSpawn = 0;
    let lastStructureSpawn = 0;
    let lastFleetSpawn = 0;
    let lastAnomalySpawn = 0;
    let systemSpawnDelay = scheduleDelay(1000, 600);
    let structureSpawnDelay = scheduleDelay(700, 450);
    let fleetSpawnDelay = scheduleDelay(1500, 1000);
    let anomalySpawnDelay = scheduleDelay(2000, 1500);

    const placeSystem = () => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const spawnX = camera.x * systemParallax + rng() * width;
        const spawnY = rng() * height;
        const crowded = world.systems.some((existing) => {
          const dx = existing.x - spawnX;
          const dy = existing.y - spawnY;
          return Math.hypot(dx, dy) < layout.systemDist;
        });
        if (!crowded) {
          world.systems.push(generateSingleSystem(spawnX, spawnY, rng, palette));
          return;
        }
      }
      world.systems.push(generateSingleSystem(camera.x + rng() * width, rng() * height, rng, palette));
    };

    const placeStructure = () => {
      const exclude = Array.from(new Set(recentKinds.slice(-8))) as Array<Structure['kind']>;
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = camera.x * systemParallax + rng() * width;
        const y = rng() * height;
        const crowded = world.structures.some((existing) => Math.hypot(existing.x - x, existing.y - y) < layout.structDist);
        if (!crowded) {
          const next = generateSingleStructure(x, y, exclude, rng);
          world.structures.push(next);
          recentKinds.push(next.kind);
          if (recentKinds.length > 8) recentKinds.shift();
          return;
        }
      }
      const fallback = generateSingleStructure(camera.x * systemParallax + rng() * width, rng() * height, exclude, rng);
      world.structures.push(fallback);
      recentKinds.push(fallback.kind);
      if (recentKinds.length > 8) recentKinds.shift();
    };

    const placeFleet = () => {
      world.fleets.push(generateSingleFleet(
        camera.x * 0.7 + (rng() - 0.5) * width * 2,
        camera.y * 0.7 + (rng() - 0.5) * height * 2,
        rng,
        palette,
      ));
    };

    const placeAnomaly = () => {
      const parallax = 0.8 * WORLD_SPEED_MULTIPLIER;
      world.anomalies.push(generateSingleAnomaly(camera.x * parallax + rng() * width, rng() * height, rng));
    };

    const seedCount = width < 768 ? 2 : 3;
    for (let i = 0; i < seedCount; i++) placeSystem();
    for (let i = 0; i < layout.maxStructs; i++) placeStructure();
    for (let i = 0; i < layout.maxFleets; i++) placeFleet();
    for (let i = 0; i < layout.maxAnomalies; i++) placeAnomaly();

    let lastQuality = host.quality;

    return {
      resize(viewport: Viewport) {
        width = viewport.width;
        height = viewport.height;
        updateLayout();
        world.width = width;
        world.height = height;
        const stars = generateSystem(width, height, {
          starCount: layout.starCount,
          rng: host.fork(`stars:${width}x${height}`),
          populate: false,
          settings: simSettings,
          palette,
        });
        world.stars = stars.stars;
        world.constellations = stars.constellations;
      },
      frame(info: FrameInfo) {
        const frames = info.dt * 60;
        nowMs = info.t * 1000;

        if (Math.abs(host.quality - lastQuality) >= 0.1) {
          lastQuality = host.quality;
          updateLayout();
        }

        if (host.motion !== 'off') camera.x += config.cameraSpeed * host.intensity * frames;
        camera.y = 0;

        world.systems = world.systems.filter((s) => s.x - camera.x * systemParallax > -300);
        world.structures = world.structures.filter((s) => s.x - camera.x * systemParallax > -300);
        if (world.fleets.length > layout.maxFleets + 2) {
          world.fleets = world.fleets.filter((fleet) => {
            const screenX = fleet.x - camera.x * 0.7;
            const screenY = fleet.y - camera.y * 0.7;
            return screenX > -1000 && screenX < width + 1000 && screenY > -1000 && screenY < height + 1000;
          });
        }
        const anomParallax = 0.8 * WORLD_SPEED_MULTIPLIER;
        world.anomalies = world.anomalies.filter((a) => a.x - camera.x * anomParallax > -400);

        if (world.systems.length < layout.maxSystems && nowMs - lastSystemSpawn > systemSpawnDelay) {
          const spawnX = camera.x * systemParallax + width + 180 + rng() * 520;
          let spawnY = rng() * height;
          for (let n = 0; n < 10 && world.systems.some((s) => Math.hypot(s.x - spawnX, s.y - spawnY) < layout.systemDist); n++) {
            spawnY = rng() * height;
          }
          world.systems.push(generateSingleSystem(spawnX, spawnY, rng, palette));
          lastSystemSpawn = nowMs;
          systemSpawnDelay = scheduleDelay(1000, 600);
        }

        if (world.structures.length < layout.maxStructs && nowMs - lastStructureSpawn > structureSpawnDelay) {
          for (let attempt = 0; attempt < 12; attempt++) {
            const x = camera.x * systemParallax + width + 100 + rng() * 420;
            const y = rng() * height;
            if (world.structures.some((s) => Math.hypot(s.x - x, s.y - y) < layout.structDist)) continue;
            const exclude = Array.from(new Set(recentKinds.slice(-8))) as Array<Structure['kind']>;
            const next = generateSingleStructure(x, y, exclude, rng);
            world.structures.push(next);
            recentKinds.push(next.kind);
            if (recentKinds.length > 8) recentKinds.shift();
            lastStructureSpawn = nowMs;
            structureSpawnDelay = scheduleDelay(700, 450);
            break;
          }
        }

        if (world.fleets.length < layout.maxFleets && nowMs - lastFleetSpawn > fleetSpawnDelay) {
          placeFleet();
          lastFleetSpawn = nowMs;
          fleetSpawnDelay = scheduleDelay(1500, 1000);
        }

        if (world.anomalies.length < layout.maxAnomalies && nowMs - lastAnomalySpawn > anomalySpawnDelay) {
          for (let attempt = 0; attempt < 8; attempt++) {
            const x = camera.x * anomParallax + width + 100 + rng() * 400;
            const y = rng() * height;
            if (world.anomalies.some((a) => Math.hypot(a.x - x, a.y - y) < 150)) continue;
            world.anomalies.push(generateSingleAnomaly(x, y, rng));
            lastAnomalySpawn = nowMs;
            anomalySpawnDelay = scheduleDelay(2000, 1500);
            break;
          }
        }

        const frame: RenderFrame = {
          time: info.t,
          dt: info.dt,
          rng: frameRng,
          palette,
          style,
          intensity: host.intensity,
          color: colorOf,
        };
        ctx.clearRect(0, 0, width, height);
        renderSystem(ctx, world, camera, { width, height }, frame);
      },
      destroy() {},
    };
  },
};
