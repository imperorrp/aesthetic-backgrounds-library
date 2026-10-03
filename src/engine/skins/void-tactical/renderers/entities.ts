/**
 * Entity Rendering Module
 *
 * @description Draws fleets (trail, planned course, ships in formation) and
 * anomalies from the simulation state. Nothing here mutates the world; the
 * simulation lives in `fleets.ts` and `world.ts`.
 * @module
 */

import type { SystemState } from '../types';
import { crispPx, depthAlpha, hexRgba, type CanvasContext, type RenderFrame } from './utils';
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
  _camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
  board?: LabelBoard,
) => {
  const v = frame.view;
  const lw = frame.style.lineWeight;
  const density = world.settings.labelDensity;
  const t = frame.time;
  const hudText = 0.4 + 0.6 * frame.style.hud;
  // Far fleets first, so near ones pass in front of them.
  const fleets = world.fleets.some((f) => f.z) ? [...world.fleets].sort((a, b) => b.z - a.z) : world.fleets;

  ctx.save();
  ctx.lineCap = 'round';
  for (const f of fleets) {
    const L = f.ships[0];
    const z = f.z;
    const k = v.scale(z);
    const lx = v.sx(L.x, z);
    const ly = v.sy(L.y, z);
    if (lx < -160 || lx > viewport.width + 160 || ly < -160 || ly > viewport.height + 160) continue;
    const a = Math.max(0, Math.min(1, f.fade)) * depthAlpha(z);
    const color = frame.color(L.color);

    // Trail: where the leader has actually been, ending at the ship.
    if (frame.style.trails > 0.02 && f.trail.length >= 4 && a > 0.05) {
      path.length = 0;
      for (let i = 0; i < f.trail.length; i += 2) path.push(v.sx(f.trail[i], z), v.sy(f.trail[i + 1], z));
      path.push(lx, ly);
      ctx.lineWidth = lw;
      ctx.setLineDash([2, 4]);
      strokeRamp(ctx, path, color, 0.06 * a * frame.style.trails, 0.5 * a * frame.style.trails, 4);
      ctx.setLineDash([]);
    }

    // Course: the unflown part of the same plan, starting at the ship.
    if (frame.style.paths !== 'off' && (f.mode === 'transit' || f.mode === 'orbit') && a > 0.3) {
      predictPath(f, t, 3.2, 5, path);
      for (let i = 0; i < path.length; i += 2) {
        path[i] = v.sx(path[i], z);
        path[i + 1] = v.sy(path[i + 1], z);
      }
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
        const ex = v.sx(f.plan.p1x, f.plan.z1);
        const ey = v.sy(f.plan.p1y, f.plan.z1);
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

    // Ships: wingmen first, leader on top. A hatchling is drawn small and grows.
    const thrustBase = f.mode === 'docked' ? 0 : f.mode === 'orbit' ? 0.45 : 1;
    const g = f.grow ? Math.min(1, Math.max(0, (t - f.grow.at) / f.grow.dur)) : 1;
    const growth = f.grow ? 0.22 + 0.78 * g * g * (3 - 2 * g) : 1;
    const seed = hash2(f.ships.length, f.id.length + f.callsign.charCodeAt(0));
    for (let i = f.ships.length - 1; i >= 0; i--) {
      const s = f.ships[i];
      const spec = SHIP_SPECS[s.cls];
      const sp = Math.hypot(s.vx, s.vy);
      const thrust = thrustBase * Math.max(0.25, Math.min(1, sp / spec.speed));
      const flicker = 0.5 + 0.5 * Math.sin(t * 23 + i * 1.7 + seed * 40);
      drawShip(ctx, s.cls, v.sx(s.x, z), v.sy(s.y, z), s.heading, frame.color(s.color), a, thrust, flicker, frame.style.shipScale * k * growth);
      board?.reserve(v.sx(s.x, z), v.sy(s.y, z), spec.size * 0.45 * frame.style.shipScale * k);
    }

    // Cargo: a short string of glowing pods behind each hull, in the color of the load.
    if (f.cargo && a > 0.2) {
      const pods = Math.max(1, Math.min(3, Math.ceil(f.cargo.amount / 15)));
      const c = frame.color(f.cargo.color);
      for (const s of f.ships) {
        const hx = Math.cos(s.heading);
        const hy = Math.sin(s.heading);
        const sx = v.sx(s.x, z);
        const sy = v.sy(s.y, z);
        for (let i = 0; i < pods; i++) {
          const d = (SHIP_SPECS[s.cls].size * 0.55 + 2.5 + i * 4.4) * frame.style.shipScale * k;
          const px = sx - hx * d;
          const py = sy - hy * d;
          ctx.fillStyle = hexRgba(c, 0.22 * a);
          ctx.beginPath();
          ctx.arc(px, py, 3.4 * k, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = hexRgba(c, 0.9 * a);
          ctx.fillRect(px - 1.4 * k, py - 1.4 * k, 2.8 * k, 2.8 * k);
        }
      }
    }

    const locked = world.lock?.kind === 'fleet' && world.lock.id === f.id && frame.style.lock;
    if (board && shouldShowFleetLabel(density, f.showLabel) && a > 0.4 && !locked && z < 0.8) {
      const cls = classLabel(frame.pack, f.cls);
      board.add({
        // Named fleets ("PUSH API", "PR #12") already say what they are.
        text: f.callsign.startsWith(cls) || /[ #]/.test(f.callsign) ? f.callsign : `${cls} ${f.callsign}`,
        x: lx,
        y: ly,
        offset: SHIP_SPECS[f.cls].size * 0.5 * frame.style.shipScale * k + 4,
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
  _camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
  board?: LabelBoard,
) => {
  const v = frame.view;
  const k = v.zoom;
  const density = world.settings.labelDensity;
  const hudText = 0.4 + 0.6 * frame.style.hud;
  for (const a of world.anomalies) {
    const x = v.sx(a.x);
    const y = v.sy(a.y);
    if (x < -60 || x > viewport.width + 60 || y < -60 || y > viewport.height + 60) continue;
    const fadeIn = Math.max(0, Math.min(1, (frame.time - a.born) / 1.4));
    const color = frame.color(a.color);
    const alpha = fadeIn * 0.9;

    if (shouldShowAnomalyScanline(density)) {
      ctx.fillStyle = hexRgba(color, 0.035 * fadeIn);
      ctx.fillRect(x, 0, 1, viewport.height);
    }
    if (k === 1) {
      drawAnomaly(ctx, a.style, crispPx(x, frame.dpr), crispPx(y, frame.dpr), frame.time, a.seed, color, alpha, frame.style.lineWeight * 0.8);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      drawAnomaly(ctx, a.style, 0, 0, frame.time, a.seed, color, alpha, (frame.style.lineWeight * 0.8) / k);
      ctx.restore();
    }
    board?.reserve(x, y, (ANOMALY_RING + 3) * k);
    if (board && shouldShowAnomalyText(density)) {
      board.add({
        text: a.text,
        x,
        y,
        offset: ANOMALY_RING * k + 5,
        color,
        alpha: 0.8 * hudText * fadeIn,
        font: SMALL_FONT,
        priority: 3,
        spots: ['below', 'above', 'right', 'left'],
      });
    }
  }
};
