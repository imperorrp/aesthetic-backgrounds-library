/**
 * Background Renderers Module
 *
 * @description Main rendering orchestrator and exports for all background rendering functions. This module coordinates the
 * rendering order for stars, systems, structures, fleets, anomalies, and UI overlays.
 *
 * Notes:
 * - Updated to render BOTH top-level independent structures and system-bound structures.
 * @module
 */

import type { SystemState } from '../types';
import { FONT } from './utils';
import { renderStars, renderGrids } from './background';
import { renderCelestialBodies, renderStarSystem, renderStructures } from './celestial';
import { renderFleets, renderAnomalies } from './entities';
import { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections } from './ui';

export const renderSystem = (
  ctx: CanvasRenderingContext2D,
  system: SystemState,
  camera: { x: number, y: number },
  viewport: { width: number, height: number }
) => {
  ctx.font = FONT;
  ctx.textBaseline = 'top';

  // 0. RENDER STARS (Deep Background Layer)
  renderStars(ctx, system.stars, camera, viewport);

  // 0.5 RENDER CONSTELLATIONS (Star Connections) - DISABLED
  // renderConstellations(ctx, system.constellations, system.stars, camera, viewport);

  // 0.7 RENDER CELESTIAL BODIES (Planets, Asteroids, Moons)
  renderCelestialBodies(ctx, system.celestialBodies, camera, viewport);

  // 0.8 RENDER STAR SYSTEMS (Stars with orbiting planets)
  system.systems.forEach(sys => renderStarSystem(ctx, sys, camera, viewport, system.settings));

  // 0.82 RENDER SYSTEM CONNECTIONS (Network overlay)
  renderSystemConnections(ctx, system.systems || [], camera, viewport);

  // 0.85 RENDER GLOBAL STRUCTURES (Independent + System-bound)
  // FIX: Combine top-level structures (floating in deep space) with system-local structures
  const allStructures = [
    ...(system.structures || []), 
    ...system.systems.flatMap(s => s.structures || [])
  ];
  renderStructures(ctx, allStructures, camera, viewport, system.settings);

  // 1. RENDER SECTOR GRID (Background Layer)
  renderGrids(ctx, camera, viewport);

  // 1.1 RENDER SECTOR CONNECTIONS (Network overlay)
  renderSectorConnections(ctx, camera, viewport);

  // 2. RENDER NODES & CONNECTIONS (Mid Layer) - DISABLED
  // renderNodes(ctx, system.nodes, camera, viewport);

  // 3. RENDER FLEETS (Mid-Foreground Layer)
  renderFleets(ctx, system.fleets, system.systems, camera, viewport, system);

  // 4. RENDER ANOMALIES (Foreground Layer)
  renderAnomalies(ctx, system.anomalies, camera, viewport, system.settings);

  // 5. RENDER TELEMETRY (UI Layer - No Parallax)
  renderTelemetry(ctx, system.telemetry, system.settings);

  // 5.5 RENDER TACTICAL OVERLAYS (Text)
  renderTacticalOverlays(ctx, system, camera, viewport);
};

// Re-export all individual renderers for direct access if needed
export { renderStars, renderConstellations, renderGrids } from './background';
export { renderCelestialBodies, renderStarSystem } from './celestial';
export { renderNodes, renderFleets, renderAnomalies } from './entities';
export { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections } from './ui';
export { getAsciiSprite, snap, CHAR_SIZE, FONT, ASCII_FONT_SIZE, ASCII_LINE_HEIGHT } from './utils';