/**
 * Entity Rendering Module
 *
 * @description Draws fleets (trail, planned course, ships in formation) and
 * anomalies from the simulation state. Nothing here mutates the world; the
 * simulation lives in `fleets.ts` and `world.ts`.
 * @module
 */

import type { SystemState } from '../types';
import { hexRgba, type CanvasContext, type RenderFrame } from './utils';
import { shouldShowAnomalyScanline, shouldShowAnomalyText, shouldShowFleetLabel } from '../labels';
import { classLabel, predictPath } from '../fleets';
import { drawShip, SHIP_SPECS } from '../ships';
import { ANOMALY_RING, drawAnomaly, hash2 } from '../anomaly-art';
import type { LabelBoard } from './board';

const LABEL_FONT = '10px "Orbit", "Syne Mono", ui-monospace, monospace';
const SMALL_FONT = '9px "Orbit", "Syne Mono", ui-monospace, monospace';
const path: number[] = [];

/** Stroke a flat x,y polyline in `groups` chunks whose alpha ramps from a0 to a1. */
function strokeRamp(ctx: CanvasContext, pts: number[], color: string, a0: number, a1: number, groups: number) {
  const n = pts.length / 2;
  if (n < 2) return;
  for (let g = 0; g < groups; g++) {
    const from = Math.floor((g * (n - 1)) / groups);
    const to = Math.floor(((g + 1) * (n - 1)) / groups);
    if (to <= from) continue;
    const k = groups === 1 ? 1 : g / (groups - 1);
    ctx.strokeStyle = hexRgba(color, a0 + (a1 - a0) * k);
    ctx.beginPath();
    ctx.moveTo(pts[from * 2], pts[from * 2 + 1]);
    for (let i = from + 1; i <= to; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
    ctx.stroke();
  }
}

export const renderFleets = (
  ctx: CanvasContext,
  world: SystemState,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
  board?: LabelBoard,
) => {
  const off = camera.x * frame.parallax;
  const lw = frame.style.lineWeight;
  const density = world.settings.labelDensity;
  const t = frame.time;
  const hudText = 0.4 + 0.6 * frame.style.hud;

  ctx.save();
  ctx.lineCap = 'round';
  for (const f of world.fleets) {
    const L = f.ships[0];
    const lx = L.x - off;
    const ly = L.y;
    if (lx < -160 || lx > viewport.width + 160 || ly < -160 || ly > viewport.height + 160) continue;
    const a = Math.max(0, Math.min(1, f.fade));
    const color = frame.color(L.color);

    // Trail: where the leader has actually been, ending at the ship.
    if (frame.style.trails > 0.02 && f.trail.length >= 4 && a > 0.05) {
      path.length = 0;
      for (let i = 0; i < f.trail.length; i += 2) path.push(f.trail[i] - off, f.trail[i + 1]);
      path.push(lx, ly);
      ctx.lineWidth = lw;
      ctx.setLineDash([2, 4]);
      strokeRamp(ctx, path, color, 0.06 * a * frame.style.trails, 0.5 * a * frame.style.trails, 4);
      ctx.setLineDash([]);
    }

    // Course: the unflown part of the same plan, starting at the ship.
    if (frame.style.paths !== 'off' && (f.mode === 'transit' || f.mode === 'orbit') && a > 0.3) {
      predictPath(f, t, 3.2, 5, path);
      for (let i = 0; i < path.length; i += 2) path[i] -= off;
      if (frame.style.paths === 'dashed') {
        ctx.lineWidth = lw;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -t * 10;
        strokeRamp(ctx, path, color, 0.55 * a, 0.08 * a, 4);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      } else {
        // Dots at even spacing along the course, fading with distance.
        let acc = 0;
        const spacing = 7;
        const n = path.length / 2;
        for (let i = 1; i < n; i++) {
          const x0 = path[i * 2 - 2];
          const y0 = path[i * 2 - 1];
          const seg = Math.hypot(path[i * 2] - x0, path[i * 2 + 1] - y0);
          let d = spacing - acc;
          while (d <= seg) {
            const u = d / seg;
            const k = 1 - i / n;
            ctx.fillStyle = hexRgba(color, (0.5 * k + 0.06) * a);
            ctx.beginPath();
            ctx.arc(x0 + (path[i * 2] - x0) * u, y0 + (path[i * 2 + 1] - y0) * u, (0.55 + 0.8 * k) * lw, 0, Math.PI * 2);
            ctx.fill();
            d += spacing;
          }
          acc = (acc + seg) % spacing;
        }
      }
      // Where the plan ends inside the horizon, mark the destination.
      if (f.mode === 'transit' && f.plan && f.target && f.target.kind !== 'exit' && f.plan.t0 + f.plan.T - t < 3.2) {
        const ex = f.plan.p1x - off;
        const ey = f.plan.p1y;
        ctx.strokeStyle = hexRgba(color, 0.45 * a);
        ctx.lineWidth = lw * 0.8;
        ctx.beginPath();
        ctx.moveTo(ex - 3, ey);
        ctx.lineTo(ex + 3, ey);
        ctx.moveTo(ex, ey - 3);
        ctx.lineTo(ex, ey + 3);
        ctx.stroke();
      }
    }

    // Ships: wingmen first, leader on top.
    const thrustBase = f.mode === 'docked' ? 0 : f.mode === 'orbit' ? 0.45 : 1;
    const seed = hash2(f.ships.length, f.id.length + f.callsign.charCodeAt(0));
    for (let i = f.ships.length - 1; i >= 0; i--) {
      const s = f.ships[i];
      const spec = SHIP_SPECS[s.cls];
      const sp = Math.hypot(s.vx, s.vy);
      const thrust = thrustBase * Math.max(0.25, Math.min(1, sp / spec.speed));
      const flicker = 0.5 + 0.5 * Math.sin(t * 23 + i * 1.7 + seed * 40);
      drawShip(ctx, s.cls, s.x - off, s.y, s.heading, frame.color(s.color), a, thrust, flicker, frame.style.shipScale);
      board?.reserve(s.x - off, s.y, spec.size * 0.45 * frame.style.shipScale);
    }

    const locked = world.lock?.kind === 'fleet' && world.lock.id === f.id && frame.style.lock;
    if (board && shouldShowFleetLabel(density, f.showLabel) && a > 0.4 && !locked) {
      const cls = classLabel(frame.pack, f.cls);
      board.add({
        // Named fleets ("PUSH API", "PR #12") already say what they are.
        text: f.callsign.startsWith(cls) || /[ #]/.test(f.callsign) ? f.callsign : `${cls} ${f.callsign}`,
        x: lx,
        y: ly,
        offset: SHIP_SPECS[f.cls].size * 0.5 * frame.style.shipScale + 4,
        color: frame.palette.ink,
        alpha: 0.72 * hudText * a,
        font: LABEL_FONT,
        priority: f.cls === 'capital' ? 5 : 2,
        spots: ['ne', 'se', 'right', 'above', 'below', 'left'],
      });
    }
  }
  ctx.restore();
};

export const renderAnomalies = (
  ctx: CanvasContext,
  world: SystemState,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
  board?: LabelBoard,
) => {
  const off = camera.x * frame.parallax;
  const density = world.settings.labelDensity;
  const hudText = 0.4 + 0.6 * frame.style.hud;
  for (const a of world.anomalies) {
    const x = a.x - off;
    const y = a.y;
    if (x < -60 || x > viewport.width + 60 || y < -60 || y > viewport.height + 60) continue;
    const fadeIn = Math.max(0, Math.min(1, (frame.time - a.born) / 1.4));
    const color = frame.color(a.color);
    const alpha = fadeIn * 0.9;

    if (shouldShowAnomalyScanline(density)) {
      ctx.fillStyle = hexRgba(color, 0.035 * fadeIn);
      ctx.fillRect(x, 0, 1, viewport.height);
    }
    drawAnomaly(ctx, a.style, x, y, frame.time, a.seed, color, alpha, frame.style.lineWeight * 0.8);
    board?.reserve(x, y, ANOMALY_RING + 3);
    if (board && shouldShowAnomalyText(density)) {
      board.add({
        text: a.text,
        x,
        y,
        offset: ANOMALY_RING + 5,
        color,
        alpha: 0.8 * hudText * fadeIn,
        font: SMALL_FONT,
        priority: 3,
        spots: ['below', 'above', 'right', 'left'],
      });
    }
  }
};
