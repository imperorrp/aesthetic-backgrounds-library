/**
 * UI Rendering Module
 *
 * @description The HUD: data lanes between systems, sector links, radio chatter
 * (typed out), telemetry, and the periodic target lock.
 *
 * Determinism: all randomness comes from `frame.rng`, all time from `frame.time`/`frame.dt`.
 * @module
 */

import type { SimSettings, SystemState, StarSystem } from '../types';
import { accentRgba, crispPx, getArtSprite, hexRgba, SPRITE_BASE_HEIGHT, WORLD_SPEED_MULTIPLIER, type CanvasContext, type RenderFrame } from './utils';
import { shouldShowTelemetry } from '../labels';
import type { LabelBoard } from './board';
import { allStructures } from '../fleets';
import { SHIP_SPECS } from '../ships';
import { structureRadius } from './celestial';

/** HUD lines keep their original strength; the `hud` knob trims them only partly. */
const lineLevel = (frame: RenderFrame) => 0.55 + 0.45 * frame.style.hud;

// --- System Network Visualization ---
export const renderSystemConnections = (
  ctx: CanvasContext,
  systems: StarSystem[],
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
) => {
  const points = systems
    .map((sys) => ({ x: sys.x - camera.x * frame.parallax, y: sys.y }))
    .filter((p) => p.x > -400 && p.x < viewport.width + 400);
  const lanes = frame.pack.look?.lanes ?? 'straight';
  if (points.length < 2 || lanes === 'none') return;
  const level = lineLevel(frame);
  const lw = frame.style.lineWeight;
  // Curved song lines bow to one side; straight lanes are the original data links.
  const path = (i: number, j: number) => {
    const a = points[i];
    const b = points[j];
    ctx.moveTo(a.x, a.y);
    if (lanes === 'curved') {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const bow = ((i + j) % 2 ? 1 : -1) * 0.28;
      ctx.quadraticCurveTo(mx - (b.y - a.y) * bow, my + (b.x - a.x) * bow, b.x, b.y);
    } else ctx.lineTo(b.x, b.y);
  };

  const links: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      if (dx * dx + dy * dy < 800 * 800) links.push([i, j]);
    }
  }
  if (!links.length) return;

  // The lane itself, pulsing like the original.
  const pulse = 0.3 + Math.sin(frame.time * 3) * 0.2;
  ctx.strokeStyle = accentRgba(frame.palette, pulse * level);
  ctx.lineWidth = lw * 1.3;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (const [i, j] of links) path(i, j);
  ctx.stroke();

  // Packets riding it.
  ctx.strokeStyle = accentRgba(frame.palette, 0.45 * level);
  ctx.lineWidth = lw * 1.3;
  ctx.setLineDash([3, 26]);
  ctx.lineDashOffset = -frame.time * 30;
  ctx.beginPath();
  for (const [i, j] of links) path(i, j);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  ctx.fillStyle = accentRgba(frame.palette, Math.min(1, pulse * 1.5) * level);
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
};

// --- Sector Network Visualization ---
export const renderSectorConnections = (
  ctx: CanvasContext,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
) => {
  const sectorSize = 2000;
  const parallax = 0.15 * WORLD_SPEED_MULTIPLIER;
  const maxDistance = sectorSize * 1.5;
  const points: { x: number; y: number }[] = [];
  const startX = Math.floor((camera.x * parallax - viewport.width / 2) / sectorSize) * sectorSize;
  const endX = Math.ceil((camera.x * parallax + viewport.width / 2) / sectorSize) * sectorSize;
  const startY = Math.floor((camera.y * parallax - viewport.height / 2) / sectorSize) * sectorSize;
  const endY = Math.ceil((camera.y * parallax + viewport.height / 2) / sectorSize) * sectorSize;
  for (let x = startX; x <= endX; x += sectorSize) {
    for (let y = startY; y <= endY; y += sectorSize) {
      const screenX = x - camera.x * parallax;
      const screenY = y - camera.y * parallax;
      if (screenX > -100 && screenX < viewport.width + 100 && screenY > -100 && screenY < viewport.height + 100) points.push({ x: screenX, y: screenY });
    }
  }
  if (points.length < 2) return;
  const level = lineLevel(frame);
  ctx.strokeStyle = accentRgba(frame.palette, 0.25 * level);
  ctx.lineWidth = frame.style.lineWeight * 0.8;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (dist <= maxDistance && (points[i].x + points[i].y + points[j].x + points[j].y) % 1000 < 300) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
      }
    }
  }
  ctx.stroke();
  ctx.fillStyle = accentRgba(frame.palette, 0.4 * level);
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Radio chatter and event lines, typed out and placed so they never overlap. */
export const renderTacticalOverlays = (
  _ctx: CanvasContext,
  system: SystemState,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
  board?: LabelBoard,
) => {
  if (!board) return;
  const off = camera.x * frame.parallax;
  const hudText = 0.4 + 0.6 * frame.style.hud;
  for (const o of system.overlays) {
    const x = o.x - off;
    const y = o.y;
    if (x < -100 || x > viewport.width + 100 || y < -100 || y > viewport.height + 100) continue;
    const age = o.duration - o.lifetime;
    const fade = Math.min(1, o.lifetime / 600) * Math.min(1, age / 250);
    const shown = Math.min(o.text.length, Math.floor((age / 1000) * 46));
    if (shown <= 0) continue;
    const typing = shown < o.text.length;
    const cursor = typing && Math.floor(frame.time * 8) % 2 === 0 ? '█' : '';
    board.add({
      text: o.text.slice(0, shown) + cursor,
      x,
      y,
      offset: o.followId ? 12 : 0,
      color: o.color.startsWith('#') ? o.color : frame.palette.ink,
      alpha: Math.max(0, fade) * hudText * (o.priority === 'low' ? 0.7 : 0.95),
      font: '10px "Orbit", "Syne Mono", ui-monospace, monospace',
      priority: o.priority === 'high' ? 8 : o.priority === 'medium' ? 7 : 1,
      spots: o.followId ? ['se', 'ne', 'below', 'above', 'right'] : ['exact', 'below', 'above'],
      tick: true,
    });
  }
};

/** Brackets close in on a contact, hold while its data types out, then let go. */
export const renderTargetLock = (
  ctx: CanvasContext,
  system: SystemState,
  camera: { x: number; y: number },
  viewport: { width: number; height: number },
  frame: RenderFrame,
) => {
  const lock = system.lock;
  if (!lock || !frame.style.lock) return;
  const off = camera.x * frame.parallax;
  let x = 0;
  let y = 0;
  let r = 12;
  let live: string | null = null;
  if (lock.kind === 'fleet') {
    const f = system.fleets.find((fl) => fl.id === lock.id);
    if (!f) return;
    const L = f.ships[0];
    x = L.x - off;
    y = L.y;
    r = Math.max(10, f.ships.length > 1 ? f.spacing * 1.3 : SHIP_SPECS[f.cls].size * 0.8) * frame.style.shipScale;
    const hdg = Math.round((((Math.atan2(L.vy, L.vx) * 180) / Math.PI + 450) % 360));
    live = `HDG ${String(hdg).padStart(3, '0')}°  SPD ${Math.round(Math.hypot(L.vx, L.vy))}`;
  } else {
    const s = allStructures(system).find((st) => st.id === lock.id);
    if (!s) return;
    x = s.x - off;
    y = s.y;
    const boost = s.rarity === 'legendary' ? 1.35 : s.rarity === 'rare' ? 1.15 : 1;
    r = structureRadius(getArtSprite(s.art, s.kind, frame.color(s.color ?? '#ffffff'), SPRITE_BASE_HEIGHT * frame.style.spriteScale * boost, frame.dpr)) + 6;
  }
  if (x < -40 || x > viewport.width + 40) return;

  const age = frame.time - lock.start;
  const left = lock.duration - age;
  const easeOut = (k: number) => 1 - (1 - k) ** 3;
  const closing = Math.min(1, age / 0.55);
  const opening = left < 0.45 ? 1 - left / 0.45 : 0;
  const h = r * (2.4 - 1.4 * easeOut(closing)) * (1 + 0.6 * opening);
  const alpha = Math.min(1, age / 0.3) * (1 - opening);
  if (alpha <= 0.01) return;
  const ink = frame.palette.ink;
  const accent = frame.palette.accent;
  const lw = frame.style.lineWeight;

  ctx.save();
  ctx.lineWidth = lw * 1.1;
  ctx.strokeStyle = hexRgba(accent, 0.9 * alpha);
  const arm = Math.max(4, h * 0.35);
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const cx = x + sx * h;
    const cy = y + sy * h;
    ctx.moveTo(cx - sx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy - sy * arm);
  }
  ctx.stroke();
  // A center tick once locked.
  if (closing >= 1) {
    const blink = Math.floor(age * 3) % 2 === 0 ? 0.9 : 0.4;
    ctx.fillStyle = hexRgba(accent, blink * alpha);
    ctx.fillRect(x - 1, y - h - 6, 2, 3);
  }

  // Data block, typed out after the brackets settle.
  if (closing >= 1) {
    const lines = live ? [...lock.lines, live] : lock.lines;
    const typed = Math.floor((age - 0.55) * 48);
    const font = '10px "Orbit", "Syne Mono", ui-monospace, monospace';
    ctx.font = font;
    ctx.textBaseline = 'middle';
    const lh = 12;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const toRight = x + h + 26 + widest < viewport.width - 8;
    const bx = toRight ? x + h + 22 : x - h - 22 - widest;
    const by = Math.max(10, Math.min(viewport.height - lines.length * lh - 10, y - h));
    // A dark panel so the block reads over anything beneath it.
    ctx.fillStyle = hexRgba(frame.palette.bg, 0.62 * alpha);
    ctx.fillRect(bx - 4, by - 2, widest + 10, lines.length * lh + 4);
    // Leader from the corner to the block.
    ctx.strokeStyle = hexRgba(accent, 0.55 * alpha);
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(x + (toRight ? h : -h), y - h);
    ctx.lineTo(toRight ? bx - 6 : bx + widest + 6, by + lh / 2);
    ctx.stroke();
    ctx.fillStyle = hexRgba(accent, 0.6 * alpha);
    ctx.fillRect(toRight ? bx - 6 : bx + widest + 5, by, 1, lines.length * lh);
    let budget = typed;
    lines.forEach((line, i) => {
      if (budget <= 0) return;
      const shown = line.slice(0, budget);
      budget -= line.length;
      const cursor = budget < 0 && Math.floor(age * 8) % 2 === 0 ? '█' : '';
      ctx.fillStyle = hexRgba(i === 0 ? accent : ink, (i === 0 ? 0.95 : 0.8) * alpha);
      ctx.fillText(shown + cursor, crispPx(bx, frame.dpr), crispPx(by + lh / 2 + i * lh, frame.dpr));
    });
  }
  ctx.restore();
};

export const renderTelemetry = (
  ctx: CanvasContext,
  telemetry: SystemState['telemetry'],
  settings: SimSettings | undefined,
  frame: RenderFrame,
) => {
  if (!shouldShowTelemetry(settings?.labelDensity ?? 'low')) return;
  const frames = frame.dt * 60;
  for (const item of telemetry) {
    item.age += frames;
    if (item.age > item.maxAge) {
      item.age = 0;
      item.x = frame.rng() * 1400;
      item.y = frame.rng() * 800;
    }
    const opacity = Math.min(1, (item.maxAge - item.age) / 50) * frame.style.hud;
    ctx.fillStyle = accentRgba(frame.palette, opacity);
    ctx.fillText(item.text, item.x, item.y);
  }
};
