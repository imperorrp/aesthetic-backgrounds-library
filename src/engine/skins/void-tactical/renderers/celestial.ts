/**
 * Celestial Rendering Module
 *
 * @description Rendering functions for celestial bodies (planets, asteroids, moons), star systems, and structures.
 * Colors flow through `frame.color()` so entities sit inside the palette family by default.
 * @module
 */

import type { SimSettings, SystemState, StarSystem, Structure } from '../types';
import {
  accentRgba,
  FONT,
  getAsciiSprite,
  getGlowSprite,
  hexRgba,
  SPRITE_BASE_HEIGHT,
  WORLD_SPEED_MULTIPLIER,
  type CanvasContext,
  type RenderFrame,
} from './utils';
import { shouldGlitchLabels, shouldShowPlanetLabel, shouldShowStructureLabel, shouldShowSystemLabel } from '../labels';
import type { Rng } from '../../../rng';
import { rgba } from '../../../palette';

// Helper: glitch text effect for occasional distortion on structure labels
const glitchText = (text: string, rng: Rng) => {
  if (rng() > 0.02) return text; // 98% normal
  const chars = text.split('');
  const idx = Math.floor(rng() * chars.length);
  const glyphs = '+-/|<>[]#%&*';
  chars[idx] = glyphs[Math.floor(rng() * glyphs.length)];
  return chars.join('');
};

const LABEL_FONT = 'bold 10px "Orbit", "Syne Mono", ui-monospace, monospace';

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
    if (body.orbitRadius && body.orbitSpeed && body.orbitCenterX !== undefined && body.orbitCenterY !== undefined) {
      body.orbitAngle = (body.orbitAngle || 0) + body.orbitSpeed * frames;
      body.x = body.orbitCenterX + Math.cos(body.orbitAngle) * body.orbitRadius;
      body.y = body.orbitCenterY + Math.sin(body.orbitAngle) * body.orbitRadius;
    }

    const relX = body.x - (camera.x * parallaxFactorBodies * WORLD_SPEED_MULTIPLIER);
    const relY = body.y - (camera.y * parallaxFactorBodies * WORLD_SPEED_MULTIPLIER);
    const posX = ((relX % viewport.width) + viewport.width) % viewport.width;
    const posY = ((relY % viewport.height) + viewport.height) % viewport.height;
    const color = frame.color(body.color);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(posX, posY, body.size, 0, Math.PI * 2);
    ctx.fill();

    if (body.type === 'planet') {
      const glow = getGlowSprite(color, body.size * 3);
      ctx.drawImage(glow, posX - glow.width / 2, posY - glow.height / 2);
    }

    if (body.size > 5) {
      ctx.fillStyle = rgba(frame.palette.inkRgb, 0.7 * frame.style.hud);
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
  const spriteHeight = SPRITE_BASE_HEIGHT * frame.style.spriteScale;
  const density = settings?.labelDensity ?? 'low';

  structures.forEach(s => {
    const gx = s.x - camera.x * parallax;
    const gy = s.y - camera.y * parallax;
    if (gx < -200 || gx > viewport.width + 200 || gy < -200 || gy > viewport.height + 200) return;

    const color = frame.color(s.color || frame.palette.accent);
    // Rare structures get larger art so the ontology reads at a glance.
    const sizeBoost = 0.8 + Math.min(1.2, s.size / 20);
    const img = getAsciiSprite(s.kind, color, spriteHeight * sizeBoost);

    // Soft halo (cached radial sprite) instead of a flat disc.
    const glow = getGlowSprite(color, Math.max(img.width, img.height) * 0.9);
    ctx.save();
    ctx.globalAlpha = 0.55 * (0.6 + 0.4 * frame.intensity);
    ctx.drawImage(glow, gx - glow.width / 2, gy - glow.height / 2);
    ctx.restore();

    ctx.drawImage(img, gx - img.width / 2, gy - img.height / 2);

    // Tactical bracket corners around the art (HUD feel without a box).
    if (frame.style.hud > 0.05) {
      const hw = img.width / 2 + 4;
      const hh = img.height / 2 + 4;
      const arm = Math.max(3, Math.min(hw, hh) * 0.3);
      ctx.strokeStyle = hexRgba(color, 0.35 * frame.style.hud);
      ctx.lineWidth = frame.style.lineWeight;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const cx = gx + sx * hw;
        const cy = gy + sy * hh;
        ctx.moveTo(cx - sx * arm, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy - sy * arm);
      }
      ctx.stroke();
    }

    if (shouldShowStructureLabel(density, s.kind)) {
      ctx.save();
      ctx.font = LABEL_FONT;
      ctx.fillStyle = hexRgba(color, 0.9 * frame.style.hud);
      ctx.textAlign = 'center';
      const label = s.kind.replace(/_/g, ' ').toUpperCase();
      const drawn = shouldGlitchLabels(density) ? glitchText(label, frame.rng) : label;
      ctx.fillText(drawn, gx, gy + img.height / 2 + 10);
      ctx.restore();
    }

    if (s.kind === 'dyson_sphere' || s.kind === 'black_hole' || s.kind === 'ringworld') {
      // Slow accretion ring for the giants.
      ctx.save();
      ctx.strokeStyle = hexRgba(color, 0.12);
      ctx.lineWidth = frame.style.lineWeight;
      ctx.setLineDash([2, 6]);
      ctx.lineDashOffset = -frame.time * 6;
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(img.width, img.height) * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
  if (sx < -100 || sx > viewport.width + 100 || sy < -100 || sy > viewport.height + 100) return;

  const starColor = frame.color(sys.starColor);
  const lw = frame.style.lineWeight;

  // Hexagon radar (slowly rotating) with cleared corners; behind the star.
  {
    const hexRadius = sys.starRadius * 4 + 20;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(frame.time * 0.2);
    ctx.strokeStyle = accentRgba(frame.palette, 0.22 * frame.style.hud);
    ctx.lineWidth = lw;
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
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'black';
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60 * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(hexRadius * Math.cos(angle), hexRadius * Math.sin(angle), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Radar sweep: a bright arc segment travelling the ring, counter to the hex rotation.
    ctx.rotate(-frame.time * 0.2 - frame.time * 0.9);
    ctx.strokeStyle = accentRgba(frame.palette, 0.55 * frame.style.hud);
    ctx.lineWidth = lw * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, hexRadius + 4, 0, Math.PI / 5);
    ctx.stroke();
    ctx.restore();
  }

  // Star with a soft corona (cached sprite).
  const corona = getGlowSprite(starColor, sys.starRadius * 7);
  ctx.drawImage(corona, sx - corona.width / 2, sy - corona.height / 2);
  ctx.fillStyle = starColor;
  ctx.beginPath();
  ctx.arc(sx, sy, sys.starRadius, 0, Math.PI * 2);
  ctx.fill();

  // Orbits in one stroke.
  ctx.strokeStyle = rgba(frame.palette.inkRgb, 0.13);
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  sys.planets.forEach((p) => {
    if (p.orbitRadius) {
      ctx.moveTo(sx + p.orbitRadius, sy);
      ctx.arc(sx, sy, p.orbitRadius, 0, Math.PI * 2);
    }
  });
  ctx.stroke();

  const timeMs = frame.time * 1000;
  sys.planets.forEach((p) => {
    if (!p.orbitRadius) return;
    const phase = (p.orbitPhase || 0) + (p.orbitSpeed || 0) * timeMs;
    const px = sx + Math.cos(phase) * p.orbitRadius;
    const py = sy + Math.sin(phase) * p.orbitRadius;
    ctx.fillStyle = frame.color(p.color);
    ctx.beginPath();
    ctx.arc(px, py, p.radius, 0, Math.PI * 2);
    ctx.fill();

    if (p.radius > 2 && shouldShowPlanetLabel(settings?.labelDensity ?? 'low')) {
      ctx.fillStyle = rgba(frame.palette.inkRgb, 0.8 * frame.style.hud);
      ctx.font = '8px "Orbit", monospace';
      const label = p.type === 'planet' ? 'P' : p.type === 'moon' ? 'M' : 'A';
      ctx.fillText(label, px + p.radius + 2, py + p.radius / 2);
      ctx.font = FONT;
    }
  });

  if (shouldShowSystemLabel(settings?.labelDensity ?? 'low')) {
    ctx.save();
    ctx.font = 'bold 11px "Orbit", monospace';
    ctx.fillStyle = rgba(frame.palette.inkRgb, 0.85 * frame.style.hud);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const shortId = (sys.id || '').replace(/^sys-/, '').toUpperCase().slice(0, 4) || 'SYS';
    ctx.fillText(`SYS ${shortId}`, sx, sy + sys.starRadius + 12);
    ctx.restore();
  }
};
