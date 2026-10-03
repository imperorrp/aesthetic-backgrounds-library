/**
 * Celestial Rendering Module
 *
 * @description Star systems, planets, and structures. Structures sit in a soft disc
 * and ring of their own color (the original look), and each role has a quiet idle
 * animation: shipyards build, docks blink, gates turn, relays ping, defenses sweep,
 * giants wear a turning bezel. Docking, launches, and jumps flash the ring.
 * @module
 */

import type { SimSettings, SystemState, StarSystem, Structure } from '../types';
import { accentRgba, depthAlpha, drawSprite, FONT, getArtSprite, getGlowSprite, hexRgba, SPRITE_BASE_HEIGHT, type CanvasContext, type RenderFrame } from './utils';
import { shouldGlitchLabels, shouldShowPlanetLabel, shouldShowStructureLabel, shouldShowSystemLabel } from '../labels';
import type { Rng } from '../../../rng';
import { rgba } from '../../../palette';
import type { LabelBoard } from './board';
import { hash2 } from '../anomaly-art';

const glitchText = (text: string, rng: Rng) => {
  if (rng() > 0.02) return text;
  const chars = text.split('');
  const idx = Math.floor(rng() * chars.length);
  const glyphs = '+-/|<>[]#%&*';
  chars[idx] = glyphs[Math.floor(rng() * glyphs.length)];
  return chars.join('');
};

const LABEL_FONT = 'bold 10px "Orbit", "Syne Mono", ui-monospace, monospace';
const RARITY_PRIORITY = { common: 3, uncommon: 4, rare: 5, legendary: 6 } as const;

export const renderCelestialBodies = (
  ctx: CanvasContext,
  bodies: SystemState['celestialBodies'],
  _camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
) => {
  const frames = frame.dt * 60;
  // Background bodies wrap around the screen at 0.8 of the map's parallax.
  const camX = (frame.view.x - viewport.width / 2) * 0.8;
  const camY = (frame.view.y - viewport.height / 2) * 0.8;
  for (const body of bodies) {
    if (body.orbitRadius && body.orbitSpeed && body.orbitCenterX !== undefined && body.orbitCenterY !== undefined) {
      body.orbitAngle = (body.orbitAngle || 0) + body.orbitSpeed * frames;
      body.x = body.orbitCenterX + Math.cos(body.orbitAngle) * body.orbitRadius;
      body.y = body.orbitCenterY + Math.sin(body.orbitAngle) * body.orbitRadius;
    }
    const relX = body.x - camX;
    const posX = ((relX % viewport.width) + viewport.width) % viewport.width;
    const posY = (((body.y - camY) % viewport.height) + viewport.height) % viewport.height;
    const color = frame.color(body.color);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(posX, posY, body.size, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Ring radius for a structure's art at the current sprite scale. */
export const structureRadius = (img: { cssW: number; cssH: number }) => Math.max(img.cssW, img.cssH) * 0.5 + 3;

function roleEffects(ctx: CanvasContext, s: Structure, gx: number, gy: number, R: number, color: string, frame: RenderFrame) {
  const t = frame.time;
  const lw = frame.style.lineWeight;
  ctx.save();
  switch (s.role) {
    case 'shipyard': {
      // Scaffold arcs crawling around the slip.
      ctx.strokeStyle = hexRgba(color, 0.32);
      ctx.lineWidth = lw;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -t * 8;
      ctx.beginPath();
      ctx.arc(gx, gy, R + 5, s.spin + t * 0.1, s.spin + t * 0.1 + Math.PI * 1.3);
      ctx.stroke();
      break;
    }
    case 'dock': {
      // Four berth lights, blinking in turn.
      for (let i = 0; i < 4; i++) {
        const ang = s.spin + (i * Math.PI) / 2;
        const on = Math.floor(t * 1.5 + i) % 4 === 0;
        ctx.fillStyle = hexRgba(color, on ? 0.95 : 0.3);
        ctx.beginPath();
        ctx.arc(gx + Math.cos(ang) * R, gy + Math.sin(ang) * R, on ? 1.6 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'mine': {
      // Haulers' lights circling the pit.
      ctx.fillStyle = hexRgba(color, 0.6);
      for (let i = 0; i < 3; i++) {
        const ang = s.spin + t * 0.55 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(gx + Math.cos(ang) * (R + 4), gy + Math.sin(ang) * (R + 4), 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'gate': {
      // Six turning segments; they burn bright when a ship goes through.
      const flash = s.flashAt !== undefined ? Math.max(0, 1 - (t - s.flashAt) / 1.4) : 0;
      ctx.strokeStyle = hexRgba(color, 0.45 + 0.5 * flash);
      ctx.lineWidth = lw * (1 + flash);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a0 = s.spin + t * 0.35 + (i * Math.PI) / 3;
        ctx.moveTo(gx + Math.cos(a0) * (R + 5), gy + Math.sin(a0) * (R + 5));
        ctx.arc(gx, gy, R + 5, a0, a0 + Math.PI / 5);
      }
      ctx.stroke();
      if (flash > 0) {
        const glow = getGlowSprite(color, R * 1.6);
        ctx.globalAlpha = flash;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glow, gx - glow.width / 2, gy - glow.height / 2);
      }
      break;
    }
    case 'relay': {
      const k = ((t + s.spin) % 3.6) / 3.6;
      ctx.strokeStyle = hexRgba(color, 0.35 * (1 - k));
      ctx.lineWidth = lw * 0.8;
      ctx.beginPath();
      ctx.arc(gx, gy, R + k * 32, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'defense': {
      // A narrow sensor wedge turning slowly.
      const a0 = s.spin + t * 0.5;
      const span = 0.38;
      ctx.fillStyle = hexRgba(color, 0.07);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.arc(gx, gy, R + 30, a0 - span, a0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexRgba(color, 0.3);
      ctx.lineWidth = lw * 0.8;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(a0) * R, gy + Math.sin(a0) * R);
      ctx.lineTo(gx + Math.cos(a0) * (R + 30), gy + Math.sin(a0) * (R + 30));
      ctx.stroke();
      break;
    }
    case 'giant': {
      // A bezel of ticks, turning very slowly.
      const r = R + 7;
      ctx.strokeStyle = hexRgba(color, 0.32);
      ctx.lineWidth = lw * 0.8;
      ctx.beginPath();
      for (let i = 0; i < 36; i++) {
        const ang = s.spin + t * 0.04 + (i * Math.PI) / 18;
        const len = i % 3 === 0 ? 5 : 2.5;
        ctx.moveTo(gx + Math.cos(ang) * r, gy + Math.sin(ang) * r);
        ctx.lineTo(gx + Math.cos(ang) * (r + len), gy + Math.sin(ang) * (r + len));
      }
      ctx.stroke();
      break;
    }
    case 'hazard': {
      // Beams or an accretion ring, depending on the object's shape.
      if (s.art.length <= 4) {
        const ang = s.spin + t * 0.9;
        ctx.strokeStyle = hexRgba(color, 0.28);
        ctx.lineWidth = lw * 0.8;
        ctx.beginPath();
        for (const dir of [0, Math.PI]) {
          ctx.moveTo(gx + Math.cos(ang + dir) * R, gy + Math.sin(ang + dir) * R);
          ctx.lineTo(gx + Math.cos(ang + dir) * (R + 34), gy + Math.sin(ang + dir) * (R + 34));
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = hexRgba(color, 0.22);
        ctx.lineWidth = lw;
        ctx.setLineDash([2, 6]);
        ctx.lineDashOffset = -t * 6;
        ctx.beginPath();
        ctx.ellipse(gx, gy, R + 9, (R + 9) * 0.45, s.spin, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

export const renderStructures = (
  ctx: CanvasContext,
  structures: Structure[],
  _camera: { x: number; y: number },
  viewport: { width: number; height: number },
  settings: SimSettings | undefined,
  frame: RenderFrame,
  board?: LabelBoard,
) => {
  const v = frame.view;
  const spriteHeight = SPRITE_BASE_HEIGHT * frame.style.spriteScale;
  const density = settings?.labelDensity ?? 'low';
  const t = frame.time;
  const lw = frame.style.lineWeight;
  const hudText = 0.4 + 0.6 * frame.style.hud;
  // Far first, so nearer structures draw over them.
  const ordered = structures.some((s) => s.z) ? [...structures].sort((a, b) => (b.z ?? 0) - (a.z ?? 0)) : structures;

  for (const s of ordered) {
    const z = s.z ?? 0;
    const k = v.scale(z);
    const gx = v.sx(s.x, z);
    const gy = v.sy(s.y, z);
    if (gx < -160 || gx > viewport.width + 160 || gy < -160 || gy > viewport.height + 160) continue;

    const color = frame.color(s.color || frame.palette.accent);
    const boost = s.rarity === 'legendary' ? 1.35 : s.rarity === 'rare' ? 1.15 : 1;
    // The unzoomed sprite sets the size; at other scales draw the nearest raster, stretched
    // the last few percent, so zooming is smooth and zoom 1 stays pixel-exact.
    const base = getArtSprite(s.art, s.kind, color, spriteHeight * boost, frame.dpr);
    const img = k === 1 ? base : getArtSprite(s.art, s.kind, color, spriteHeight * boost * k, frame.dpr);
    const fit = k === 1 ? 1 : (base.cssH * k) / img.cssH;
    const R = structureRadius(base) * k;
    const flash = s.flashAt !== undefined ? Math.max(0, 1 - (t - s.flashAt) / 1.2) : 0;
    ctx.save();
    ctx.globalAlpha = depthAlpha(z);

    // Disc and ring in the structure's own color.
    ctx.fillStyle = hexRgba(color, 0.1 + 0.12 * flash);
    ctx.beginPath();
    ctx.arc(gx, gy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexRgba(color, 0.34 + 0.4 * flash);
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.arc(gx, gy, R, 0, Math.PI * 2);
    ctx.stroke();
    if (flash > 0) {
      const k = 1 - flash;
      ctx.strokeStyle = hexRgba(color, 0.55 * flash);
      ctx.beginPath();
      ctx.arc(gx, gy, R + k * 26, 0, Math.PI * 2);
      ctx.stroke();
    }

    roleEffects(ctx, s, gx, gy, R, color, frame);

    if (s.role === 'wreck') {
      // A slow tumble.
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(Math.sin(t * 0.25 + s.spin) * 0.3);
      ctx.drawImage(img, (-img.cssW * fit) / 2, (-img.cssH * fit) / 2, img.cssW * fit, img.cssH * fit);
      ctx.restore();
    } else {
      if (s.role === 'mystery' && hash2(Math.floor(t * 6), s.id.length + Math.floor(s.spin * 100)) < 0.08) {
        // Now and then the object does not sit still.
        const a = ctx.globalAlpha;
        ctx.globalAlpha = a * 0.45;
        drawSprite(ctx, img, gx + 2 * k, gy - k, frame.dpr, fit);
        ctx.globalAlpha = a;
      }
      drawSprite(ctx, img, gx, gy, frame.dpr, fit);
    }
    ctx.restore();

    board?.reserve(gx, gy, R);
    // Far structures keep their names only while the map is not crowded.
    if (board && shouldShowStructureLabel(density, s.rarity) && z < 0.95) {
      board.add({
        text: shouldGlitchLabels(density) ? glitchText(s.label, frame.rng) : s.label,
        x: gx,
        y: gy,
        offset: R + 1,
        color,
        alpha: 0.88 * hudText * depthAlpha(z),
        font: LABEL_FONT,
        priority: (RARITY_PRIORITY[s.rarity] ?? 3) - (z > 0 ? 2 : 0),
        spots: ['below', 'above', 'right', 'left'],
      });
    }
  }
};

export const renderStarSystem = (
  ctx: CanvasContext,
  sys: StarSystem,
  _camera: { x: number; y: number },
  viewport: { width: number; height: number },
  settings: SimSettings | undefined,
  frame: RenderFrame,
  board?: LabelBoard,
) => {
  const v = frame.view;
  const z = sys.z ?? 0;
  const k = v.scale(z);
  const sx = v.sx(sys.x, z);
  const sy = v.sy(sys.y, z);
  if (sx < -120 || sx > viewport.width + 120 || sy < -120 || sy > viewport.height + 120) return;

  const starColor = frame.color(sys.starColor);
  const lw = frame.style.lineWeight;
  ctx.save();
  ctx.globalAlpha = depthAlpha(z);

  // Hexagon radar (slowly rotating) with cleared corners; behind the star.
  {
    const hexRadius = (sys.starRadius * 4 + 20) * k;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(frame.time * 0.2);
    ctx.strokeStyle = accentRgba(frame.palette, 0.2);
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
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
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.arc(hexRadius * Math.cos(angle), hexRadius * Math.sin(angle), 5 * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // Star with a soft corona (cached sprite).
  const corona = getGlowSprite(starColor, sys.starRadius * 7 * k);
  ctx.drawImage(corona, sx - corona.width / 2, sy - corona.height / 2);
  ctx.fillStyle = starColor;
  ctx.beginPath();
  ctx.arc(sx, sy, sys.starRadius * k, 0, Math.PI * 2);
  ctx.fill();

  // Orbits in one stroke.
  ctx.strokeStyle = rgba(frame.palette.inkRgb, 0.14);
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  for (const p of sys.planets) {
    if (!p.orbitRadius) continue;
    ctx.moveTo(sx + p.orbitRadius * k, sy);
    ctx.arc(sx, sy, p.orbitRadius * k, 0, Math.PI * 2);
  }
  ctx.stroke();

  const timeMs = frame.time * 1000;
  for (const p of sys.planets) {
    if (!p.orbitRadius) continue;
    const phase = (p.orbitPhase || 0) + (p.orbitSpeed || 0) * timeMs;
    const px = sx + Math.cos(phase) * p.orbitRadius * k;
    const py = sy + Math.sin(phase) * p.orbitRadius * k;
    ctx.fillStyle = frame.color(p.color);
    ctx.beginPath();
    ctx.arc(px, py, p.radius * k, 0, Math.PI * 2);
    ctx.fill();
    if (p.radius > 2 && z < 0.5 && shouldShowPlanetLabel(settings?.labelDensity ?? 'low')) {
      ctx.fillStyle = rgba(frame.palette.inkRgb, 0.55 * (0.4 + 0.6 * frame.style.hud));
      ctx.font = '8px "Orbit", monospace';
      ctx.fillText(p.type === 'planet' ? 'P' : p.type === 'moon' ? 'M' : 'A', px + p.radius * k + 2, py + (p.radius * k) / 2);
      ctx.font = FONT;
    }
  }
  ctx.restore();

  if (board && shouldShowSystemLabel(settings?.labelDensity ?? 'low')) {
    board.add({
      text: sys.name,
      x: sx,
      y: sy,
      offset: sys.starRadius * k + 8,
      color: frame.palette.ink,
      alpha: 0.85 * (0.4 + 0.6 * frame.style.hud) * depthAlpha(z),
      font: 'bold 11px "Orbit", "Syne Mono", ui-monospace, monospace',
      priority: z > 0 ? 3 : 4,
      spots: ['below', 'above', 'right', 'left'],
    });
  }
};
