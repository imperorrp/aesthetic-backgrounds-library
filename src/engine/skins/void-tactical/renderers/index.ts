/**
 * Background Renderers Module
 *
 * @description Main rendering orchestrator and exports for all background rendering functions. This module coordinates the
 * rendering order for stars, systems, structures, fleets, anomalies, and UI overlays.
 *
 * Every renderer receives a `RenderFrame` (time, dt, seeded rng, palette) so the picture is a
 * pure function of seed + elapsed time and never touches the wall clock or `Math.random`.
 * @module
 */

import type { SystemState } from '../types';
import { FONT, type RenderFrame } from './utils';
import { renderStars, renderGrids } from './background';
import { renderCelestialBodies, renderStarSystem, renderStructures } from './celestial';
import { renderFleets, renderAnomalies } from './entities';
import { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections } from './ui';

export const renderSystem = (
  ctx: CanvasRenderingContext2D,
  system: SystemState,
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  frame: RenderFrame,
) => {
  ctx.font = FONT;
  ctx.textBaseline = 'top';

  // 0. RENDER STARS (Deep Background Layer)
  renderStars(ctx, system.stars, camera, viewport, frame);

  // 0.5 RENDER CONSTELLATIONS (Star Connections) - DISABLED
  // renderConstellations(ctx, system.constellations, system.stars, camera, viewport);

  // 0.7 RENDER CELESTIAL BODIES (Planets, Asteroids, Moons)
  renderCelestialBodies(ctx, system.celestialBodies, camera, viewport, frame);

  // 0.8 RENDER STAR SYSTEMS (Stars with orbiting planets)
  system.systems.forEach(sys => renderStarSystem(ctx, sys, camera, viewport, system.settings, frame));

  // 0.82 RENDER SYSTEM CONNECTIONS (Network overlay)
  renderSystemConnections(ctx, system.systems || [], camera, viewport, frame);

  // 0.85 RENDER GLOBAL STRUCTURES (Independent + System-bound)
  const allStructures = [
    ...(system.structures || []),
    ...system.systems.flatMap(s => s.structures || [])
  ];
  renderStructures(ctx, allStructures, camera, viewport, system.settings, frame);

  // 1. RENDER SECTOR GRID (Background Layer)
  renderGrids(ctx, camera, viewport, frame);

  // 1.1 RENDER SECTOR CONNECTIONS (Network overlay)
  renderSectorConnections(ctx, camera, viewport, frame);

  // 2. RENDER NODES & CONNECTIONS (Mid Layer) - DISABLED
  // renderNodes(ctx, system.nodes, camera, viewport, frame);

  // 3. RENDER FLEETS (Mid-Foreground Layer)
  renderFleets(ctx, system.fleets, system.systems, camera, viewport, system, frame);

  // 4. RENDER ANOMALIES (Foreground Layer)
  renderAnomalies(ctx, system.anomalies, camera, viewport, system.settings, frame);

  // 5. RENDER TELEMETRY (UI Layer - No Parallax)
  renderTelemetry(ctx, system.telemetry, system.settings, frame);

  // 5.5 RENDER TACTICAL OVERLAYS (Text)
  renderTacticalOverlays(ctx, system, camera, viewport, frame);
};

// Re-export all individual renderers for direct access if needed
export { renderStars, renderConstellations, renderGrids } from './background';
export { renderCelestialBodies, renderStarSystem } from './celestial';
export { renderNodes, renderFleets, renderAnomalies } from './entities';
export { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections } from './ui';
export { getAsciiSprite, snap, CHAR_SIZE, FONT, ASCII_FONT_SIZE, ASCII_LINE_HEIGHT } from './utils';
export type { RenderFrame } from './utils';
