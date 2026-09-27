/**
 * Entity Rendering Module
 *
 * @description Rendering functions for interactive entities (fleets, nodes, anomalies).
 * @module
 *
 * @performance
 * - Reduced simulation steps for fleet path projection (15 steps).
 * - Optimized nearest system checks (modulo 5 frames).
 * - Uses modulo arithmetic for coordinate wrapping.
 * - Batched rendering for trails and connections.
 *
 * Determinism: all randomness comes from `frame.rng`, all time from `frame.time`/`frame.dt`.
 */

import type { SystemState, StarSystem, SimSettings } from '../types';
import { FONT, WORLD_SPEED_MULTIPLIER, hexRgba, type CanvasContext, type RenderFrame } from './utils';
import { emitOverlay } from './ui';
import { rgba } from '../../../palette';

/** Break a polyline where consecutive points jump more than half the viewport (a wrap), so no line crosses the screen. */
const strokeBroken = (ctx: CanvasContext, pts: { x: number; y: number }[], viewport: { width: number; height: number }) => {
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[i - 1];
    const jump = prev && (Math.abs(p.x - prev.x) > viewport.width / 2 || Math.abs(p.y - prev.y) > viewport.height / 2);
    if (!pen || jump) {
      ctx.moveTo(p.x, p.y);
      pen = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
};
import { shouldShowAnomalyScanline, shouldShowAnomalyText, shouldShowFleetLabel } from '../labels';

export const renderNodes = (
  ctx: CanvasContext,
  nodes: SystemState['nodes'],
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  frame: RenderFrame,
) => {
  const parallaxFactorNodes = 0.3;

  // Draw connections first
  ctx.strokeStyle = rgba(frame.palette.accentRgb, 0.1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  nodes.forEach(node => {
    for (let offsetX = -2*viewport.width; offsetX <= 2*viewport.width; offsetX += viewport.width) {
      for (let offsetY = -2*viewport.height; offsetY <= 2*viewport.height; offsetY += viewport.height) {
        const startX = node.x - camera.x * parallaxFactorNodes * WORLD_SPEED_MULTIPLIER + offsetX;
        const startY = node.y - camera.y * parallaxFactorNodes * WORLD_SPEED_MULTIPLIER + offsetY;

        node.connections.forEach(targetId => {
          const target = nodes.find(n => n.id === targetId);
          if (target) {
            // For connections, only draw if both nodes are close
            const endX = target.x - camera.x * parallaxFactorNodes * WORLD_SPEED_MULTIPLIER + offsetX;
            const endY = target.y - camera.y * parallaxFactorNodes * WORLD_SPEED_MULTIPLIER + offsetY;
            if (Math.abs(startX - endX) < viewport.width / 2 && Math.abs(startY - endY) < viewport.height / 2) {
              ctx.moveTo(startX + 7, startY + 7);
              ctx.lineTo(endX + 7, endY + 7);
            }
          }
        });
      }
    }
  });
  ctx.stroke();

  // Draw nodes
  nodes.forEach(node => {
    for (let offsetX = -2*viewport.width; offsetX <= 2*viewport.width; offsetX += viewport.width) {
      for (let offsetY = -2*viewport.height; offsetY <= 2*viewport.height; offsetY += viewport.height) {
        const baseX = node.x - (camera.x * parallaxFactorNodes * WORLD_SPEED_MULTIPLIER) + offsetX;
        const baseY = node.y - (camera.y * parallaxFactorNodes * WORLD_SPEED_MULTIPLIER) + offsetY;

        if (baseX >= -50 && baseX <= viewport.width + 50 &&
            baseY >= -50 && baseY <= viewport.height + 50) {

          ctx.fillStyle = frame.palette.accent;
          ctx.font = FONT;
          ctx.fillText(node.glyph, baseX, baseY);

          // Label
          ctx.fillStyle = rgba(frame.palette.accentRgb, 0.5);
          ctx.font = '10px "Orbit", monospace';
          ctx.fillText(node.name, baseX + 14, baseY);
        }
      }
    }
  });
};

export const renderFleets = (
  ctx: CanvasContext,
  fleets: SystemState['fleets'],
  systems: SystemState['systems'],
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  system: SystemState,
  frame: RenderFrame,
) => {
  const parallaxFactorFleets = 0.7;
  const time = frame.time; // seconds since mount
  const rng = frame.rng;
  const frames = frame.dt * 60; // motion constants below are "per frame at 60 fps"

  fleets.forEach(fleet => {
    // Fleet AI State Machine

    // Find potential targets: planets and structures (not just star systems)
    interface TargetInfo {
      type: 'planet' | 'structure';
      system: StarSystem;
      planet?: any;
      structure?: any;
      distance: number;
    }
    let bestTarget: TargetInfo | null = null;

    systems.forEach(starSystem => {
      // Check planets in this system
      starSystem.planets.forEach((planet, planetIndex) => {
        // Calculate planet position relative to star system
        const planetX = starSystem.x + (planet.orbitRadius || 0) * Math.cos((planet.orbitPhase || 0) + time * (planet.orbitSpeed || 0));
        const planetY = starSystem.y + (planet.orbitRadius || 0) * Math.sin((planet.orbitPhase || 0) + time * (planet.orbitSpeed || 0));

        const distance = Math.sqrt((fleet.x - planetX) ** 2 + (fleet.y - planetY) ** 2);

        // Prioritize closer targets, but also consider type preferences
        const isBetterTarget = !bestTarget ||
          distance < bestTarget.distance ||
          (distance < bestTarget.distance * 1.5 && rng() < 0.3); // Some randomness

        if (isBetterTarget && distance < 300) { // Only consider reasonably close targets
          bestTarget = {
            type: 'planet',
            system: starSystem,
            planet: { ...planet, x: planetX, y: planetY, index: planetIndex },
            distance
          };
        }
      });

      // Check structures in this system (stations, shipyards, etc.)
      starSystem.structures.forEach((structure, structureIndex) => {
        const distance = Math.sqrt((fleet.x - structure.x) ** 2 + (fleet.y - structure.y) ** 2);

        // Stations and shipyards are more attractive targets
        const isBetterTarget = !bestTarget ||
          (structure.kind === 'station' || structure.kind === 'shipyard') && distance < bestTarget.distance * 1.2 ||
          distance < bestTarget.distance;

        if (isBetterTarget && distance < 250) { // Stations have smaller attraction radius
          bestTarget = {
            type: 'structure',
            system: starSystem,
            structure: { ...structure, index: structureIndex },
            distance
          };
        }
      });
    });

    // AI State Transitions - Make cruising much more common
    if (fleet.state === 'cruising') {
      // Only 5% chance per frame to start approaching a target (much less frequent)
      if (bestTarget !== null) {
        const targetInfo: TargetInfo = bestTarget; // Capture the non-null value with explicit type
        if (rng() < 0.05 && targetInfo.distance < 200) {
          fleet.state = 'approaching';
          const target = targetInfo as TargetInfo;
          if (target.type === 'planet' && target.planet) {
            fleet.targetId = `${target.system.id}-planet-${target.planet.index}`;
            fleet.approachTarget = { x: target.planet.x, y: target.planet.y };
          } else if (target.type === 'structure' && target.structure) {
            fleet.targetId = `${target.system.id}-structure-${target.structure.index}`;
            fleet.approachTarget = { x: target.structure.x, y: target.structure.y };
          }
          fleet.targetType = target.type;

          // Emit overlay for approaching
          const targetName = target.type === 'planet' ? 'PLANET' : target.structure?.kind.toUpperCase() || 'TARGET';
          emitOverlay(system, {
            text: `APPROACHING ${targetName}`,
            x: fleet.x,
            y: fleet.y - 20,
            type: 'fleet',
            priority: 'medium',
            color: fleet.color,
            followId: fleet.id,
            anchor: 'world',
            duration: 3000
          });
        }
      }
    } else if (fleet.state === 'approaching') {
      const currentDistance = fleet.approachTarget ?
        Math.sqrt((fleet.x - fleet.approachTarget.x) ** 2 + (fleet.y - fleet.approachTarget.y) ** 2) : Infinity;

      if (!fleet.approachTarget || currentDistance > 300) {
        // Lost target or too far, go back to cruising
        fleet.state = 'cruising';
        fleet.targetId = undefined;
        fleet.approachTarget = undefined;
        fleet.targetType = undefined;
      } else if (currentDistance < (fleet.targetType === 'structure' ? 25 : 35)) {
        // Close enough - either orbit or dock based on target type
        if (fleet.targetType === 'structure' || rng() < 0.7) {
          fleet.state = 'docking'; // Most ships dock at stations/planets

          // Emit overlay for docking
          const targetName = fleet.targetType === 'structure' ? 'STATION' : 'PLANET';
          emitOverlay(system, {
            text: `DOCKING @ ${targetName}`,
            x: fleet.x,
            y: fleet.y - 20,
            type: 'fleet',
            priority: 'high',
            color: fleet.color,
            glow: true,
            followId: fleet.id,
            anchor: 'world',
            duration: 4000
          });
        } else {
          fleet.state = 'orbiting'; // Some ships just orbit
        }
      }
    } else if (fleet.state === 'orbiting') {
      const currentDistance = fleet.approachTarget ?
        Math.sqrt((fleet.x - fleet.approachTarget.x) ** 2 + (fleet.y - fleet.approachTarget.y) ** 2) : Infinity;

      if (!fleet.approachTarget || currentDistance > 100) {
        // Too far, go back to approaching
        fleet.state = 'approaching';
      } else if (rng() < 0.002) { // Very rare chance to decide to dock
        fleet.state = 'docking';
      } else if (rng() < 0.01) { // Small chance to just leave
        fleet.state = 'launching';
        const angle = Math.atan2(fleet.y - (fleet.approachTarget.y), fleet.x - (fleet.approachTarget.x));
        fleet.vx = Math.cos(angle) * 1.5;
        fleet.vy = Math.sin(angle) * 1.5;

        // Emit overlay for launching
        emitOverlay(system, {
          text: `LAUNCHING`,
          x: fleet.x,
          y: fleet.y - 20,
          type: 'fleet',
          priority: 'medium',
          color: fleet.color,
          followId: fleet.id,
          anchor: 'world',
          duration: 2500
        });
      }
    } else if (fleet.state === 'docking') {
      const currentDistance = fleet.approachTarget ?
        Math.sqrt((fleet.x - fleet.approachTarget.x) ** 2 + (fleet.y - fleet.approachTarget.y) ** 2) : Infinity;

      if (!fleet.approachTarget || currentDistance > 80) {
        // Too far, go back to orbiting
        fleet.state = 'orbiting';
        fleet.dockedUntil = undefined;
      } else if (fleet.approachTarget && currentDistance < 8) {
        // Successfully docked. Stay docked 3-8 s of sim time, then depart.
        if (fleet.dockedUntil === undefined) {
          fleet.dockedUntil = time + 3 + rng() * 5;
        } else if (time >= fleet.dockedUntil) {
          fleet.dockedUntil = undefined;
          fleet.state = 'launching';
          const angle = Math.atan2(fleet.y - fleet.approachTarget.y, fleet.x - fleet.approachTarget.x);
          fleet.vx = Math.cos(angle) * 2;
          fleet.vy = Math.sin(angle) * 2;

          // Emit overlay for launching from dock
          emitOverlay(system, {
            text: `DEPARTING`,
            x: fleet.x,
            y: fleet.y - 20,
            type: 'fleet',
            priority: 'medium',
            color: fleet.color,
            followId: fleet.id,
            anchor: 'world',
            duration: 3000
          });
        }
      }
    } else if (fleet.state === 'launching') {
      const currentDistance = fleet.approachTarget ?
        Math.sqrt((fleet.x - fleet.approachTarget.x) ** 2 + (fleet.y - fleet.approachTarget.y) ** 2) : Infinity;

      if (fleet.approachTarget && currentDistance > 120) {
        // Far enough, go back to cruising
        fleet.state = 'cruising';
        fleet.targetId = undefined;
        fleet.approachTarget = undefined;
        fleet.targetType = undefined;
      }
    }

    // Movement based on AI state
    let moveX = 0;
    let moveY = 0;

    if (fleet.state === 'cruising') {
      // Chaotic movement as before
      const primaryWave = Math.sin(time * fleet.curvature + fleet.curvePhase) * 4;
      const secondaryWave = Math.sin(time * fleet.curvature * 2.7 + fleet.curvePhase * 1.3) * 2.5;
      const tertiaryWave = Math.sin(time * fleet.curvature * 0.4 + fleet.curvePhase * 2.1) * 3.2;
      const chaosWave = Math.sin(time * fleet.curvature * 5.3 + fleet.curvePhase * 0.7) * 1.8;

      const noiseSeed = parseInt(fleet.id.split('-')[1]) || 0;
      const noiseX = Math.sin(time * 0.7 + noiseSeed) * 2.1;
      const noiseY = Math.cos(time * 0.9 + noiseSeed * 1.3) * 1.7;

      moveX = fleet.vx + (primaryWave + secondaryWave + tertiaryWave + chaosWave + noiseX) * fleet.curveDirection * 1.2;
      moveY = fleet.vy + (primaryWave * 0.7 + secondaryWave * 1.2 + tertiaryWave * 0.9 + chaosWave * 1.1 + noiseY) * fleet.curveDirection * 1.2;
    } else if (fleet.state === 'approaching') {
      // Move toward target with some chaos
      if (fleet.approachTarget) {
        const dx = fleet.approachTarget.x - fleet.x;
        const dy = fleet.approachTarget.y - fleet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          const speed = fleet.targetType === 'structure' ? 1.2 : 1.5; // Slower approach to structures
          moveX = (dx / distance) * speed;
          moveY = (dy / distance) * speed;
        }
        // Add some chaos to approach
        moveX += Math.sin(time * 2 + fleet.curvePhase) * 0.3;
        moveY += Math.cos(time * 2.3 + fleet.curvePhase) * 0.3;
      }
    } else if (fleet.state === 'orbiting') {
      // Orbit around target (planet or structure)
      if (fleet.approachTarget) {
        const dx = fleet.x - fleet.approachTarget.x;
        const dy = fleet.y - fleet.approachTarget.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const orbitSpeed = 0.015; // Slower, more realistic orbits
        const tangentX = -dy / distance;
        const tangentY = dx / distance;

        moveX = tangentX * orbitSpeed * (fleet.targetType === 'structure' ? 30 : 45); // Smaller orbits around structures
        moveY = tangentY * orbitSpeed * (fleet.targetType === 'structure' ? 30 : 45);

        // Maintain orbit distance
        const targetDistance = fleet.targetType === 'structure' ? 25 : 40;
        const distanceCorrection = (targetDistance - distance) * 0.008;
        moveX += (dx / distance) * distanceCorrection;
        moveY += (dy / distance) * distanceCorrection;
      }
    } else if (fleet.state === 'docking') {
      // Move toward target for docking (slower, more precise)
      if (fleet.approachTarget) {
        const dx = fleet.approachTarget.x - fleet.x;
        const dy = fleet.approachTarget.y - fleet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          const speed = fleet.targetType === 'structure' ? 0.6 : 0.8; // Very slow docking approach
          moveX = (dx / distance) * speed;
          moveY = (dy / distance) * speed;
        }
      }
    } else if (fleet.state === 'launching') {
      // Continue in launch direction with decreasing chaos
      moveX = fleet.vx * 0.98; // Slow down over time
      moveY = fleet.vy * 0.98;
      // Add minimal chaos to launch
      moveX += Math.sin(time * 3 + fleet.curvePhase) * 0.2;
      moveY += Math.cos(time * 3.2 + fleet.curvePhase) * 0.2;
    }

    // Apply movement, scaled by real elapsed time
    fleet.x += moveX * frames;
    fleet.y += moveY * frames;

    // Wrap around
    if (fleet.x < 0) fleet.x += system.width;
    if (fleet.x > system.width) fleet.x -= system.width;
    if (fleet.y < 0) fleet.y += system.height;
    if (fleet.y > system.height) fleet.y -= system.height;

    // History for trails - longer trails for better visibility
    if (rng() > 0.3) { // More frequent updates
      fleet.history.push({ x: fleet.x, y: fleet.y });
      if (fleet.history.length > 20) fleet.history.shift(); // Increased from 10 to 20
    }

    // Render at multiple positions for seamless looping
    for (let offsetX = -2*viewport.width; offsetX <= 2*viewport.width; offsetX += viewport.width) {
      for (let offsetY = -2*viewport.height; offsetY <= 2*viewport.height; offsetY += viewport.height) {
        const baseX = fleet.x - (camera.x * parallaxFactorFleets) + offsetX;
        const baseY = fleet.y - (camera.y * parallaxFactorFleets) + offsetY;

        // Only render if within viewport bounds
        if (baseX >= -50 && baseX <= viewport.width + 50 &&
            baseY >= -50 && baseY <= viewport.height + 50) {

          const fleetColor = frame.color(fleet.color);
          const lw = frame.style.lineWeight;

          // History trail: dotted, fading, never drawn across a wrap.
          if (fleet.history.length > 1 && frame.style.trails > 0.02) {
            ctx.strokeStyle = fleetColor;
            ctx.globalAlpha = 0.45 * frame.style.trails;
            ctx.setLineDash([2, 4]);
            ctx.lineWidth = lw;
            const pts = fleet.history.map((p) => ({
              x: p.x - camera.x * parallaxFactorFleets + offsetX,
              y: p.y - camera.y * parallaxFactorFleets + offsetY,
            }));
            strokeBroken(ctx, pts, viewport);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;
          }

          // Predicted path: collected as points, drawn per style below.
          const proj: { x: number; y: number }[] = [{ x: baseX, y: baseY }];

          // Project future path - extended further
          // OPTIMIZATION 1: Drastically reduce simulation steps
          // 15 steps is enough to show a "heading". 80 is overkill for a background effect.
          const futureSteps = 15; // Was 30/80
          const timeStep = 0.5;   // Increase step size to cover more distance with fewer steps
          let futureX = fleet.x;
          let futureY = fleet.y;
          let futureState = fleet.state;
          let futureApproachTarget = fleet.approachTarget;
          let futureVx = fleet.vx;
          let futureVy = fleet.vy;
          const currentTime = time;

          for (let i = 1; i <= futureSteps; i++) {
            const projectedTime = currentTime + i * timeStep;

            // Simulate AI state transitions for projection
            let nearestSystemForProjection: StarSystem | null = null;
            let nearestDistanceForProjection = Infinity;

            // OPTIMIZATION 2: Only check for nearest systems at the start or end
            // Checking every single step is too expensive.
            if (i % 5 === 0) {
              systems.forEach(starSystem => {
                const distance = Math.sqrt((futureX - starSystem.x) ** 2 + (futureY - starSystem.y) ** 2);
                if (distance < nearestDistanceForProjection) {
                  nearestDistanceForProjection = distance;
                  nearestSystemForProjection = starSystem;
                }
              });
            }

            // AI State Transitions for projection
            if (futureState === 'cruising') {
              if (nearestSystemForProjection && nearestDistanceForProjection < 150) {
                futureState = 'approaching';
                futureApproachTarget = { x: (nearestSystemForProjection as StarSystem).x, y: (nearestSystemForProjection as StarSystem).y };
              }
            } else if (futureState === 'approaching') {
              if (!nearestSystemForProjection || nearestDistanceForProjection > 200) {
                futureState = 'cruising';
                futureApproachTarget = undefined;
              } else if (nearestDistanceForProjection < 50) {
                futureState = 'orbiting';
              }
            } else if (futureState === 'orbiting') {
              if (!nearestSystemForProjection || nearestDistanceForProjection > 80) {
                futureState = 'approaching';
              }
            } else if (futureState === 'docking') {
              if (!nearestSystemForProjection || nearestDistanceForProjection > 100) {
                futureState = 'orbiting';
              } else if (nearestSystemForProjection && nearestDistanceForProjection < 15) {
                futureState = 'launching';
                const angle = Math.atan2(futureY - (nearestSystemForProjection as StarSystem).y, futureX - (nearestSystemForProjection as StarSystem).x);
                futureVx = Math.cos(angle) * 2;
                futureVy = Math.sin(angle) * 2;
              }
            } else if (futureState === 'launching') {
              if (nearestSystemForProjection && nearestDistanceForProjection > 100) {
                futureState = 'cruising';
                futureApproachTarget = undefined;
              }
            }

            // Movement based on AI state for projection
            let moveX = 0;
            let moveY = 0;

            if (futureState === 'cruising') {
              const primaryWave = Math.sin(projectedTime * fleet.curvature + fleet.curvePhase) * 4;
              const secondaryWave = Math.sin(projectedTime * fleet.curvature * 2.7 + fleet.curvePhase * 1.3) * 2.5;
              const tertiaryWave = Math.sin(projectedTime * fleet.curvature * 0.4 + fleet.curvePhase * 2.1) * 3.2;
              const chaosWave = Math.sin(projectedTime * fleet.curvature * 5.3 + fleet.curvePhase * 0.7) * 1.8;

              const noiseSeed = parseInt(fleet.id.split('-')[1]) || 0;
              const noiseX = Math.sin(projectedTime * 0.7 + noiseSeed) * 2.1;
              const noiseY = Math.cos(projectedTime * 0.9 + noiseSeed * 1.3) * 1.7;

              moveX = fleet.vx + (primaryWave + secondaryWave + tertiaryWave + chaosWave + noiseX) * fleet.curveDirection * 1.2;
              moveY = fleet.vy + (primaryWave * 0.7 + secondaryWave * 1.2 + tertiaryWave * 0.9 + chaosWave * 1.1 + noiseY) * fleet.curveDirection * 1.2;
            } else if (futureState === 'approaching') {
              if (futureApproachTarget) {
                const dx = futureApproachTarget.x - futureX;
                const dy = futureApproachTarget.y - futureY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 0) {
                  const speed = 1.5;
                  moveX = (dx / distance) * speed;
                  moveY = (dy / distance) * speed;
                }
                moveX += Math.sin(projectedTime * 2 + fleet.curvePhase) * 0.5;
                moveY += Math.cos(projectedTime * 2.3 + fleet.curvePhase) * 0.5;
              }
            } else if (futureState === 'orbiting') {
              if (nearestSystemForProjection) {
                const dx = futureX - (nearestSystemForProjection as StarSystem).x;
                const dy = futureY - (nearestSystemForProjection as StarSystem).y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const orbitSpeed = 0.02;
                const tangentX = -dy / distance;
                const tangentY = dx / distance;

                moveX = tangentX * orbitSpeed * 50;
                moveY = tangentY * orbitSpeed * 50;

                const targetDistance = 40;
                const distanceCorrection = (targetDistance - distance) * 0.01;
                moveX += (dx / distance) * distanceCorrection;
                moveY += (dy / distance) * distanceCorrection;
              }
            } else if (futureState === 'docking') {
              if (nearestSystemForProjection) {
                const dx = (nearestSystemForProjection as StarSystem).x - futureX;
                const dy = (nearestSystemForProjection as StarSystem).y - futureY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance > 0) {
                  const speed = 0.8;
                  moveX = (dx / distance) * speed;
                  moveY = (dy / distance) * speed;
                }
              }
            } else if (futureState === 'launching') {
              moveX = futureVx + Math.sin(projectedTime * 3 + fleet.curvePhase) * 0.3;
              moveY = futureVy + Math.cos(projectedTime * 3.2 + fleet.curvePhase) * 0.3;
            }

            futureX += moveX;
            futureY += moveY;

            // Wrap around for seamless projection
            if (futureX < 0) futureX += system.width;
            if (futureX > system.width) futureX -= system.width;
            if (futureY < 0) futureY += system.height;
            if (futureY > system.height) futureY -= system.height;

            // Convert to screen coordinates
            proj.push({
              x: futureX - camera.x * parallaxFactorFleets + offsetX,
              y: futureY - camera.y * parallaxFactorFleets + offsetY,
            });
          }

          if (frame.style.paths === 'dashed') {
            ctx.strokeStyle = fleetColor;
            ctx.globalAlpha = 0.3;
            ctx.setLineDash([4, 8]);
            ctx.lineWidth = lw;
            strokeBroken(ctx, proj, viewport);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;
          } else if (frame.style.paths === 'dots') {
            // Waypoint dots that fade with distance; wraps simply leave a gap.
            for (let i = 1; i < proj.length; i++) {
              const p = proj[i];
              const q = proj[i - 1];
              if (Math.abs(p.x - q.x) > viewport.width / 2 || Math.abs(p.y - q.y) > viewport.height / 2) break;
              const k = 1 - i / proj.length;
              ctx.fillStyle = hexRgba(fleetColor, 0.5 * k + 0.05);
              ctx.beginPath();
              ctx.arc(p.x, p.y, (0.6 + 0.9 * k) * lw, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Render Ship (smooth movement, no snapping)
          ctx.fillStyle = fleetColor;
          ctx.fillText(fleet.glyph, baseX, baseY);

          if (shouldShowFleetLabel(system.settings?.labelDensity ?? 'low', fleet.showLabel)) {
            ctx.font = '10px "Orbit", monospace';
            ctx.fillStyle = rgba(frame.palette.inkRgb, 0.8 * frame.style.hud);
            const label = fleet.type ? `${fleet.type.toUpperCase()} ${fleet.id}` : fleet.id;
            // Offset label to avoid overlap with glyph; also offset slightly by fleet index modulo to reduce collisions
            const idxOffset = (fleet.id ? parseInt(fleet.id.replace(/[^0-9]/g, ''), 10) % 4 : 0);
            const labelYOffset = -8 - idxOffset * 10;
            ctx.fillText(label, baseX + 18, baseY + labelYOffset);
            ctx.font = FONT;
          }
        }
      }
    }
  });
};

export const renderAnomalies = (
  ctx: CanvasContext,
  anomalies: SystemState['anomalies'],
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  settings: SimSettings | undefined,
  frame: RenderFrame,
) => {
  const parallaxFactorAnomalies = 0.8;
  const hazard = frame.palette.hazard;
  anomalies.forEach(anomaly => {
    const alpha = (0.5 + Math.sin(frame.time * 2) * 0.3) * (0.5 + 0.5 * frame.style.hud);
    // Text alpha pulses independently for dramatic effect
    const textAlpha = (0.7 + Math.sin(frame.time * 3 + 1.5) * 0.25) * frame.style.hud;

    for (let offsetX = -2*viewport.width; offsetX <= 2*viewport.width; offsetX += viewport.width) {
      for (let offsetY = -2*viewport.height; offsetY <= 2*viewport.height; offsetY += viewport.height) {
        const baseX = anomaly.x - (camera.x * parallaxFactorAnomalies * WORLD_SPEED_MULTIPLIER) + offsetX;
        const baseY = anomaly.y - (camera.y * parallaxFactorAnomalies * WORLD_SPEED_MULTIPLIER) + offsetY;

        if (baseX >= -50 && baseX <= viewport.width + 50 &&
            baseY >= -50 && baseY <= viewport.height + 50) {

          // Render anomaly icon in the palette's hazard color
          ctx.fillStyle = hexRgba(hazard, alpha);
          ctx.fillText('[ ! ]', baseX, baseY);

          const density = settings?.labelDensity ?? 'low';
          if (shouldShowAnomalyText(density)) {
            ctx.font = '10px "Orbit", monospace';
            ctx.fillStyle = hexRgba(hazard, textAlpha);
            const textOffset = 15;
            const textToDraw = anomaly.text || 'UNKNOWN ANOMALY';
            ctx.fillText(textToDraw, baseX - 40, baseY + textOffset);
            ctx.font = FONT;
          }

          if (shouldShowAnomalyScanline(density)) {
            ctx.fillStyle = hexRgba(hazard, alpha * 0.1);
            ctx.fillRect(baseX + 6, 0, 1, viewport.height);
          }
        }
      }
    }
  });
};
