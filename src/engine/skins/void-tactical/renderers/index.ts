/**
 * Background Renderers Module
 *
 * @description Draw order for the sector map: stars, systems, lanes, structures,
 * grid, anomalies, fleets, chatter, labels, then the target lock on top. Labels
 * from every part go through one board so none overlap.
 *
 * Every renderer receives a `RenderFrame` (time, dt, seeded rng, palette, pack) so
 * the picture is a pure function of seed + elapsed time.
 * @module
 */

import type { SystemState } from '../types';
import { FONT, type RenderFrame } from './utils';
import { renderStars, renderGrids } from './background';
import { renderCelestialBodies, renderStarSystem, renderStructures } from './celestial';
import { renderFleets, renderAnomalies } from './entities';
import { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections, renderTargetLock } from './ui';
import { createLabelBoard } from './board';
import { allStructures } from '../fleets';

const board = createLabelBoard();

type DrawPass = (ctx: CanvasRenderingContext2D, pass: 'ground' | 'under' | 'mid' | 'over' | 'hud', frame: RenderFrame, board?: ReturnType<typeof createLabelBoard>) => void;

export const renderSystem = (
  ctx: CanvasRenderingContext2D,
  system: SystemState,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
  mechanics?: DrawPass,
) => {
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  renderStars(ctx, system.stars, camera, viewport, frame);
  mechanics?.(ctx, 'ground', frame, board);
  mechanics?.(ctx, 'under', frame, board);
  renderCelestialBodies(ctx, system.celestialBodies, camera, viewport, frame);
  for (const sys of system.systems) renderStarSystem(ctx, sys, camera, viewport, system.settings, frame, board);
  renderSystemConnections(ctx, system.systems, camera, viewport, frame);
  renderStructures(ctx, allStructures(system), camera, viewport, system.settings, frame, board);
  renderGrids(ctx, camera, viewport, frame);
  renderSectorConnections(ctx, camera, viewport, frame);
  renderAnomalies(ctx, system, camera, viewport, frame, board);
  mechanics?.(ctx, 'mid', frame, board);
  renderFleets(ctx, system, camera, viewport, frame, board);
  mechanics?.(ctx, 'over', frame, board);
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  renderTelemetry(ctx, system.telemetry, system.settings, frame);
  renderTacticalOverlays(ctx, system, camera, viewport, frame, board);
  board.flush(ctx, viewport, frame.dpr);
  renderTargetLock(ctx, system, camera, viewport, frame);
  mechanics?.(ctx, 'hud', frame);
};

export { renderStars, renderConstellations, renderGrids } from './background';
export { renderCelestialBodies, renderStarSystem, renderStructures } from './celestial';
export { renderFleets, renderAnomalies } from './entities';
export { renderTacticalOverlays, renderTelemetry, renderSystemConnections, renderSectorConnections, renderTargetLock } from './ui';
export { createLabelBoard } from './board';
export { getAsciiSprite, getArtSprite, getGlowSprite, snap, CHAR_SIZE, FONT, SPRITE_BASE_HEIGHT } from './utils';
export type { RenderFrame, VoidStyle } from './utils';
