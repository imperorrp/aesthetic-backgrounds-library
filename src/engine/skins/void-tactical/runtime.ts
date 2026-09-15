import type { Structure, SystemState } from '../../types';
import {
  generateSystem,
  generateSingleSystem,
  generateSingleStructure,
  generateSingleFleet,
  generateSingleAnomaly,
} from '../../generators';
import { renderSystem } from '../../renderers';
import { WORLD_SPEED_MULTIPLIER } from '../../renderers/utils';
import { createRng } from '../../rng';
import type { BackgroundSkin, SkinHost, Viewport } from '../../core/skin';

/**
 * First skin: the extracted Bubble Galaxies landing background.
 * Streaming camera, weighted structures, fleets, ambient HUD.
 * Other skins should not need to know these types.
 */
export const voidTacticalSkin: BackgroundSkin = {
  id: 'void-tactical',
  mount(host: SkinHost) {
    const { canvas, ctx, rng, config } = host;
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;

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
      const d = config.density;
      layout.starCount = Math.max(40, Math.min(400, Math.floor((area / densityFactor) * d)));
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
    });
    const world: SystemState = { ...base, systems: [], structures: [], settings: simSettings };
    const camera = { x: 0, y: 0 };
    const systemParallax = 0.25 * WORLD_SPEED_MULTIPLIER;

    const scheduleDelay = (baseMs: number, variance: number) => baseMs + rng() * variance;
    let lastSystemSpawn = Date.now();
    let lastStructureSpawn = Date.now();
    let lastFleetSpawn = Date.now();
    let lastAnomalySpawn = Date.now();
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
          world.systems.push(generateSingleSystem(spawnX, spawnY, rng));
          return;
        }
      }
      world.systems.push(generateSingleSystem(camera.x + rng() * width, rng() * height, rng));
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
      ));
    };

    const placeAnomaly = () => {
      const parallax = 0.8 * WORLD_SPEED_MULTIPLIER;
      world.anomalies.push(generateSingleAnomaly(camera.x * parallax + rng() * width, rng() * height, rng));
    };

    const seed = width < 768 ? 2 : 3;
    for (let i = 0; i < seed; i++) placeSystem();
    for (let i = 0; i < layout.maxStructs; i++) placeStructure();
    for (let i = 0; i < layout.maxFleets; i++) placeFleet();
    for (let i = 0; i < layout.maxAnomalies; i++) placeAnomaly();

    const reduceMotion = () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      resize(viewport: Viewport) {
        width = viewport.width;
        height = viewport.height;
        updateLayout();
        world.width = width;
        world.height = height;
        const stars = generateSystem(width, height, {
          starCount: layout.starCount,
          rng: createRng(`${config.seed}:stars:${width}x${height}`),
          populate: false,
          settings: simSettings,
        });
        world.stars = stars.stars;
        world.constellations = stars.constellations;
      },
      frame() {
        if (!reduceMotion()) camera.x += config.cameraSpeed;
        camera.y = 0;
        const now = Date.now();

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

        if (world.systems.length < layout.maxSystems && now - lastSystemSpawn > systemSpawnDelay) {
          const spawnX = camera.x * systemParallax + width + 180 + rng() * 520;
          let spawnY = rng() * height;
          for (let n = 0; n < 10 && world.systems.some((s) => Math.hypot(s.x - spawnX, s.y - spawnY) < layout.systemDist); n++) {
            spawnY = rng() * height;
          }
          world.systems.push(generateSingleSystem(spawnX, spawnY, rng));
          lastSystemSpawn = now;
          systemSpawnDelay = scheduleDelay(1000, 600);
        }

        if (world.structures.length < layout.maxStructs && now - lastStructureSpawn > structureSpawnDelay) {
          for (let attempt = 0; attempt < 12; attempt++) {
            const x = camera.x * systemParallax + width + 100 + rng() * 420;
            const y = rng() * height;
            if (world.structures.some((s) => Math.hypot(s.x - x, s.y - y) < layout.structDist)) continue;
            const exclude = Array.from(new Set(recentKinds.slice(-8))) as Array<Structure['kind']>;
            const next = generateSingleStructure(x, y, exclude, rng);
            world.structures.push(next);
            recentKinds.push(next.kind);
            if (recentKinds.length > 8) recentKinds.shift();
            lastStructureSpawn = now;
            structureSpawnDelay = scheduleDelay(700, 450);
            break;
          }
        }

        if (world.fleets.length < layout.maxFleets && now - lastFleetSpawn > fleetSpawnDelay) {
          placeFleet();
          lastFleetSpawn = now;
          fleetSpawnDelay = scheduleDelay(1500, 1000);
        }

        if (world.anomalies.length < layout.maxAnomalies && now - lastAnomalySpawn > anomalySpawnDelay) {
          for (let attempt = 0; attempt < 8; attempt++) {
            const x = camera.x * anomParallax + width + 100 + rng() * 400;
            const y = rng() * height;
            if (world.anomalies.some((a) => Math.hypot(a.x - x, a.y - y) < 150)) continue;
            world.anomalies.push(generateSingleAnomaly(x, y, rng));
            lastAnomalySpawn = now;
            anomalySpawnDelay = scheduleDelay(2000, 1500);
            break;
          }
        }

        ctx.clearRect(0, 0, width, height);
        renderSystem(ctx, world, camera, { width, height });
      },
      destroy() {},
    };
  },
};
