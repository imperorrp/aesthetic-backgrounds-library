/**
 * Celestial Rendering Module
 *
 * @description Rendering functions for celestial bodies (planets, asteroids, moons) and star systems.
 * @module
 */

import type { SimSettings, SystemState, StarSystem, Structure } from '../types';
import { accentRgba, FONT, getAsciiSprite, WORLD_SPEED_MULTIPLIER, type CanvasContext, type RenderFrame } from './utils';
import { shouldGlitchLabels, shouldShowPlanetLabel, shouldShowStructureLabel, shouldShowSystemLabel } from '../labels';
import type { Rng } from '../../../rng';

// Helper: glitch text effect for occasional distortion on structure labels
const glitchText = (text: string, rng: Rng) => {
  if (rng() > 0.02) return text; // 98% normal
  const chars = text.split('');
  const idx = Math.floor(rng() * chars.length);
  const glyphs = "Ã€Ã Ã‚ÃƒÃ„Ã…Ã†Ã‡ÃˆÃ‰ÃŠÃ‹ÃŒÃ ÃŽÃ Ã +-/|<>[]"; // stylistic glyphs
  chars[idx] = glyphs[Math.floor(rng() * glyphs.length)];
  return chars.join('');
};

export const renderCelestialBodies = (
  ctx: CanvasContext,
  bodies: SystemState['celestialBodies'],
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  frame: RenderFrame,
) => {
  const parallaxFactorBodies = 0.2;
  const frames = frame.dt * 60;

  bodies.forEach(body => {
    // Update orbiting bodies logic (Keep existing logic)
    if (body.orbitRadius && body.orbitSpeed && body.orbitCenterX !== undefined && body.orbitCenterY !== undefined) {
      body.orbitAngle = (body.orbitAngle || 0) + body.orbitSpeed * frames;
      body.x = body.orbitCenterX + Math.cos(body.orbitAngle) * body.orbitRadius;
      body.y = body.orbitCenterY + Math.sin(body.orbitAngle) * body.orbitRadius;
    }

    // Calculate position relative to camera once
    const relX = body.x - (camera.x * parallaxFactorBodies * WORLD_SPEED_MULTIPLIER);
    const relY = body.y - (camera.y * parallaxFactorBodies * WORLD_SPEED_MULTIPLIER);

    // Wrap to viewport using Modulo to avoid nested loops
    const wrappedX = ((relX % viewport.width) + viewport.width) % viewport.width;
    const wrappedY = ((relY % viewport.height) + viewport.height) % viewport.height;

    const posX = wrappedX;
    const posY = wrappedY;

    // Draw body
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(posX, posY, body.size, 0, Math.PI * 2);
    ctx.fill();

    // Add glow effect for planets
    if (body.type === 'planet') {
      ctx.save();
      ctx.shadowColor = body.color;
      ctx.shadowBlur = body.size * 2;
      ctx.beginPath();
      ctx.arc(posX, posY, body.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Add label for larger bodies
    if (body.size > 5) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px "Orbit", monospace';
      const label = body.type === 'planet' ? 'PLANET' : body.type === 'moon' ? 'MOON' : 'ASTEROID';
      ctx.fillText(label, posX + body.size + 5, posY + body.size / 2);
      ctx.font = FONT;
    }
  });
};

export const renderStructures = (
  ctx: CanvasContext,
  structures: Structure[],
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  settings: SimSettings | undefined,
  frame: RenderFrame,
) => {
  const parallax = 0.25 * WORLD_SPEED_MULTIPLIER;

  structures.forEach(s => {
    // Calculate position relative to camera
    const relX = s.x - camera.x * parallax;
    const relY = s.y - camera.y * parallax;

    // No wrapping for structures - they are fixed in the world and scroll by
    // Cull if off-screen (with buffer)
    if (relX < -200 || relX > viewport.width + 200 || relY < -200 || relY > viewport.height + 200) return;

    const gx = relX;
    const gy = relY;

    // Draw once
    const img = getAsciiSprite(s.kind, s.color || '#fff');

    // Draw subtle halo for all structures
    ctx.save();
    ctx.shadowColor = s.color || '#fff';
    ctx.shadowBlur = 2;
    ctx.globalAlpha = 0.1; // Very dim and transparent
    ctx.fillStyle = s.color || '#fff';
    ctx.beginPath();
    ctx.arc(gx, gy, img.width * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw centered
    ctx.drawImage(img, gx - img.width/2, gy - img.height/2);

    const density = settings?.labelDensity ?? 'low';
    if (shouldShowStructureLabel(density, s.kind)) {
      ctx.save();
      ctx.font = 'bold 10px "Orbit", monospace';
      ctx.fillStyle = s.color || '#ffffff';
      ctx.textAlign = 'center';
      const label = s.kind.replace(/_/g, ' ').toUpperCase();
      const drawn = shouldGlitchLabels(density) ? glitchText(label, frame.rng) : label;
      ctx.fillText(drawn, gx, gy + img.height/2 + 12);
      ctx.restore();
    }

    // OPTIONAL: Add specific effects for special types
    if (s.kind === 'dyson_sphere' || s.kind === 'black_hole') {
      // Subtle rotation or pulse could go here, but simple is better for performance
      ctx.strokeStyle = s.color || '#fff';
      ctx.globalAlpha = 0.05;
      ctx.beginPath();
      ctx.arc(gx, gy, s.size * 1.5, 0, Math.PI*2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  });
};

export const renderStarSystem = (
  ctx: CanvasContext,
  sys: StarSystem,
  camera: {x:number,y:number},
  viewport: {width:number,height:number},
  settings: SimSettings | undefined,
  frame: RenderFrame,
) => {
  const parallax = 0.25 * WORLD_SPEED_MULTIPLIER;
  const sx = sys.x - camera.x * parallax;
  const sy = sys.y - camera.y * parallax;

  // Quick cull
  if (sx < -100 || sx > viewport.width + 100 || sy < -100 || sy > viewport.height + 100) return;

  // Hexagon radar (slowly rotating) — behind the star, tactical visual
  {
    const hexRadius = sys.starRadius * 4 + 20; // Radius relative to star
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(frame.time * 0.2);
    ctx.strokeStyle = accentRgba(frame.palette, 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 * Math.PI) / 180;
      const hx = hexRadius * Math.cos(angle);
      const hy = hexRadius * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();

    // Bracket effect: clear small arcs at each corner
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'black';
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(hexRadius * Math.cos(angle), hexRadius * Math.sin(angle), 5, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
    // Reset globalCompositeOperation to default to avoid affecting other draws
    ctx.globalCompositeOperation = 'source-over';
  }

  // Star
  ctx.save();
  ctx.fillStyle = sys.starColor;
  ctx.beginPath();
  ctx.arc(sx, sy, sys.starRadius, 0, Math.PI*2);
  ctx.fill();

  // subtle glow (cheap)
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(sx, sy, sys.starRadius * 6, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Planets (orbit visualization when system in view)
  // Batch orbit drawing: beginPath once, draw all orbits, then stroke once.
  ctx.strokeStyle = 'rgba(130,200,220,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  sys.planets.forEach((p) => {
    if (p.orbitRadius) {
      // Just trace the path here
      ctx.moveTo(sx + p.orbitRadius, sy); // Move to start of arc to avoid connecting lines
      ctx.arc(sx, sy, p.orbitRadius, 0, Math.PI*2);
    }
  });

  // Single draw call for all orbits in the system
  ctx.stroke();

  // Draw planets and labels
  const timeMs = frame.time * 1000;
  sys.planets.forEach((p) => {
    if (p.orbitRadius) {
      // compute planet position
      const phase = (p.orbitPhase || 0) + (p.orbitSpeed || 0) * timeMs;
      const px = sx + Math.cos(phase) * p.orbitRadius;
      const py = sy + Math.sin(phase) * p.orbitRadius;

      // planet body (no grid snapping here)
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.radius, 0, Math.PI*2);
      ctx.fill();

      if (p.radius > 2 && shouldShowPlanetLabel(settings?.labelDensity ?? 'low')) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '8px "Orbit", monospace';
        const label = p.type === 'planet' ? 'P' : p.type === 'moon' ? 'M' : 'A';
        ctx.fillText(label, px + p.radius + 2, py + p.radius / 2);
        ctx.font = FONT;
      }

      // station landing ring if structure nearby — small visual
    }
  });

  ctx.restore();

  if (shouldShowSystemLabel(settings?.labelDensity ?? 'low')) {
    ctx.save();
    ctx.font = 'bold 11px "Orbit", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const shortId = (sys.id || '').replace(/^sys-/, '').toUpperCase().slice(0, 4) || 'SYS';
    ctx.fillText(`SYS ${shortId}`, sx, sy + sys.starRadius + 12);
    ctx.restore();
  }
};
