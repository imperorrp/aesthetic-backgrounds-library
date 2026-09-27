/**
 * Background Rendering Module
 *
 * @description Rendering functions for deep space background elements (stars, constellations, grids).
 * @module
 */

import type { SystemState } from '../types';
import { accentRgba, CHAR_SIZE, WORLD_SPEED_MULTIPLIER, type RenderFrame } from './utils';

import type { CanvasContext } from './utils';

export const renderStars = (
  ctx: CanvasContext,
  stars: SystemState['stars'],
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  frame: RenderFrame,
) => {
  const parallaxFactorStars = 0.5; // Horizontal parallax multiplier for stars

  // Render each star using modulo wrapping across the viewport so stars
  // always reappear on the right when they pass the left edge. This keeps
  // the same star identities and relative layout (mod viewport size).
  stars.forEach(star => {
    // Compute star position relative to camera with parallax
    const relX = star.x - (camera.x * parallaxFactorStars * WORLD_SPEED_MULTIPLIER);
    const relY = star.y - (camera.y * parallaxFactorStars * WORLD_SPEED_MULTIPLIER);

    // Wrap horizontally and vertically into viewport space
    const wrappedX = ((relX % viewport.width) + viewport.width) % viewport.width;
    const wrappedY = ((relY % viewport.height) + viewport.height) % viewport.height;

    // Twinkle effect (smooth per-star brightness modulation, phase offset by position)
    const twinkle = 0.5 + Math.sin(frame.time * star.twinkle + star.x * 0.01) * 0.5;
    ctx.save();
    ctx.fillStyle = star.color;
    ctx.globalAlpha = Math.max(0, Math.min(1, twinkle * star.brightness));

    // Draw the star at the wrapped position (fractional positions preserved)
    ctx.beginPath();
    ctx.arc(wrappedX, wrappedY, star.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

export const renderConstellations = (
  ctx: CanvasContext,
  constellations: SystemState['constellations'],
  stars: SystemState['stars'],
  camera: { x: number, y: number },
  viewport: { width: number, height: number }
) => {
  const parallaxFactorConst = 0.05; // Subtle parallax for constellations

  constellations.forEach(constellation => {
    ctx.strokeStyle = constellation.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    // Draw lines between connected stars
    for (let i = 0; i < constellation.stars.length - 1; i++) {
      const star1 = stars.find(s => s.id === constellation.stars[i]);
      const star2 = stars.find(s => s.id === constellation.stars[i + 1]);

      if (star1 && star2) {
        // Render at multiple positions for looping
        for (let offsetX = -viewport.width; offsetX <= viewport.width; offsetX += viewport.width) {
          for (let offsetY = -viewport.height; offsetY <= viewport.height; offsetY += viewport.height) {
            const x1 = star1.x - (camera.x * parallaxFactorConst * WORLD_SPEED_MULTIPLIER) + offsetX;
            const y1 = star1.y - (camera.y * parallaxFactorConst * WORLD_SPEED_MULTIPLIER) + offsetY;
            const x2 = star2.x - (camera.x * parallaxFactorConst * WORLD_SPEED_MULTIPLIER) + offsetX;
            const y2 = star2.y - (camera.y * parallaxFactorConst * WORLD_SPEED_MULTIPLIER) + offsetY;

            if (x1 >= -50 && x1 <= viewport.width + 50 && y1 >= -50 && y1 <= viewport.height + 50 &&
                x2 >= -50 && x2 <= viewport.width + 50 && y2 >= -50 && y2 <= viewport.height + 50) {
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
        }
      }
    }

    ctx.globalAlpha = 1.0;
  });
};

export const renderGrids = (
  ctx: CanvasContext,
  camera: { x: number, y: number },
  viewport: { width: number, height: number },
  frame: RenderFrame,
) => {
  // 1. RENDER SECTOR GRID (Background Layer)
  ctx.fillStyle = accentRgba(frame.palette, 0.1);
  const parallaxFactorGrid = 0.1;
  const gridOffsetX = (camera.x * parallaxFactorGrid * WORLD_SPEED_MULTIPLIER) % (CHAR_SIZE * 6);
  const gridOffsetY = (camera.y * parallaxFactorGrid * WORLD_SPEED_MULTIPLIER) % (CHAR_SIZE * 6);

  for (let x = -gridOffsetX; x < viewport.width; x += CHAR_SIZE * 6) {
    for (let y = -gridOffsetY; y < viewport.height; y += CHAR_SIZE * 6) {
      ctx.fillText('+', x, y);
    }
  }

  // 1.5 RENDER HEX GRID (Optional "Strategy" Fluff)
  // Simplified as dots for now to keep performance high
  ctx.fillStyle = accentRgba(frame.palette, 0.05);
  for (let x = -gridOffsetX; x < viewport.width; x += CHAR_SIZE * 12) {
    for (let y = -gridOffsetY; y < viewport.height; y += CHAR_SIZE * 12) {
      if ((x + y) % 2 === 0) ctx.fillText('·', x + CHAR_SIZE * 3, y + CHAR_SIZE * 3);
    }
  }
};
