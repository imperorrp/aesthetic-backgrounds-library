/**
 * Leviathans: vast, slow, segmented things that migrate across the map.
 *
 * Each is a body from `sim/bodies.ts`: a head that wanders and a long spine that follows.
 * It is drawn as a dark, ribbed hull outlined in light, with rows of photophores that
 * pulse in waves toward the tail, eyes, mandibles, and long feelers. Wisps circle it like
 * pilot fish. Ships scatter out of its way; the camera tends to follow it.
 */
import type { Fleet } from '../types';
import { createBody, normalAt, seek, stepBody, type Body } from '../../../sim/bodies';
import { hexRgba } from '../renderers/utils';
import { colorParam } from './combat';
import { registerMechanic, steerToward } from './types';

type Wisp = { seg: number; a: number; r: number; w: number };

/** Thickness along the spine: a blunt head, a broad shoulder, a long tapering tail. */
const girth = (u: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.65))), 0.85);

/** Draw one leviathan in map space. `mx` maps world x to map space. */
export function drawLeviathan(ctx: CanvasRenderingContext2D, b: Body, mx: (x: number) => number, t: number, R0: number, line: string, glow: string, alpha = 1): void {
  const n = b.n;
  const s = b.seg;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const [nx, ny] = normalAt(b, i);
    const r = R0 * girth(i / (n - 1)) + 1.5;
    left.push(mx(s[i * 2]) + nx * r, s[i * 2 + 1] + ny * r);
    right.push(mx(s[i * 2]) - nx * r, s[i * 2 + 1] - ny * r);
  }
  ctx.save();
  // Presence: a broad soft glow along the spine.
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexRgba(glow, 0.05 * alpha);
  ctx.lineWidth = R0 * 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(mx(s[0]), s[1]);
  for (let i = 2; i < n; i += 2) ctx.lineTo(mx(s[i * 2]), s[i * 2 + 1]);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // The hull: near-black, outlined in light.
  ctx.beginPath();
  ctx.moveTo(left[0], left[1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i * 2], left[i * 2 + 1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i * 2], right[i * 2 + 1]);
  ctx.closePath();
  ctx.fillStyle = `rgba(4,2,10,${0.88 * alpha})`;
  ctx.fill();
  ctx.strokeStyle = hexRgba(line, 0.55 * alpha);
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Ribs: plates across the back, every few segments.
  ctx.strokeStyle = hexRgba(line, 0.28 * alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 2; i < n - 2; i += 3) {
    ctx.moveTo(left[i * 2], left[i * 2 + 1]);
    ctx.quadraticCurveTo(mx(s[(i - 1) * 2]), s[(i - 1) * 2 + 1], right[i * 2], right[i * 2 + 1]);
  }
  ctx.stroke();
  // Spines along one flank.
  ctx.beginPath();
  for (let i = 3; i < n - 4; i += 4) {
    const [nx, ny] = normalAt(b, i);
    const r = R0 * girth(i / (n - 1)) + 1.5;
    const x = mx(s[i * 2]) + nx * r;
    const y = s[i * 2 + 1] + ny * r;
    ctx.moveTo(x, y);
    ctx.lineTo(x + nx * (6 + r * 0.4), y + ny * (6 + r * 0.4));
  }
  ctx.stroke();
  // Photophores: two rows of lights, pulsing in waves that run toward the tail.
  for (let i = 1; i < n - 1; i += 2) {
    const k = Math.max(0, Math.sin(t * 2.2 - i * 0.45));
    if (k < 0.05) continue;
    const [nx, ny] = normalAt(b, i);
    const r = (R0 * girth(i / (n - 1)) + 1.5) * 0.62;
    for (const side of [1, -1]) {
      const x = mx(s[i * 2]) + nx * r * side;
      const y = s[i * 2 + 1] + ny * r * side;
      ctx.fillStyle = hexRgba(glow, (0.25 + 0.7 * k) * alpha);
      ctx.fillRect(x - 1, y - 1, 2, 2);
      if (k > 0.7) {
        ctx.fillStyle = hexRgba(glow, 0.12 * k * alpha);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Head: eyes, mandibles, and feelers sweeping ahead.
  const hx = mx(s[0]);
  const hy = s[1];
  const h = b.heading;
  const fx = Math.cos(h);
  const fy = Math.sin(h);
  const [nx, ny] = [-fy, fx];
  const eyeR = R0 * 0.45;
  for (const side of [1, -1]) {
    const ex = hx + fx * R0 * 0.25 + nx * eyeR * side;
    const ey = hy + fy * R0 * 0.25 + ny * eyeR * side;
    ctx.fillStyle = hexRgba('#ffffff', 0.9 * alpha);
    ctx.fillRect(ex - 1, ey - 1, 2, 2);
    ctx.fillStyle = hexRgba(glow, 0.25 * alpha);
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = hexRgba(line, 0.6 * alpha);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const side of [1, -1]) {
    const bx = hx + nx * R0 * 0.5 * side;
    const by = hy + ny * R0 * 0.5 * side;
    const bite = 0.35 + 0.25 * Math.sin(t * 1.6);
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + fx * R0 * 0.9, by + fy * R0 * 0.9, hx + fx * R0 * 1.3 + nx * R0 * bite * side, hy + fy * R0 * 1.3 + ny * R0 * bite * side);
  }
  ctx.stroke();
  ctx.strokeStyle = hexRgba(line, 0.3 * alpha);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const side = k % 2 ? 1 : -1;
    const len = R0 * (2.4 + k * 0.6);
    const sway = Math.sin(t * 0.9 + k * 1.7) * 0.6;
    const x0 = hx + nx * R0 * 0.3 * side;
    const y0 = hy + ny * R0 * 0.3 * side;
    const cx = x0 + fx * len * 0.5 + nx * len * (0.25 * side + sway * 0.3);
    const cy = y0 + fy * len * 0.5 + ny * len * (0.25 * side + sway * 0.3);
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x0 + fx * len + nx * len * sway * 0.5, y0 + fy * len + ny * len * sway * 0.5);
  }
  ctx.stroke();
  // Tail fan.
  const ti = n - 1;
  const [tx, ty] = [mx(s[ti * 2]), s[ti * 2 + 1]];
  const ta = Math.atan2(s[ti * 2 + 1] - s[(ti - 2) * 2 + 1], s[ti * 2] - s[(ti - 2) * 2]);
  ctx.strokeStyle = hexRgba(line, 0.4 * alpha);
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    const a = ta + k * 0.35 + Math.sin(t * 1.3) * 0.15;
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(a) * R0 * 1.2, ty + Math.sin(a) * R0 * 1.2);
  }
  ctx.stroke();
  ctx.restore();
}

registerMechanic({
  id: 'leviathans',
  label: 'Leviathans',
  description: 'Vast, slow, segmented things migrate across the map with wisps circling them; ships scatter from their path.',
  schema: {
    every: { type: 'number', min: 20, max: 300, default: 80, label: 'Seconds between sightings' },
    size: { type: 'number', min: 0.5, max: 1.8, default: 1, label: 'Size' },
    color: { type: 'color', default: '#c4b5fd', label: 'Outline' },
    glow: { type: 'color', default: '#67e8f9', label: 'Lights' },
    name: { type: 'string', default: 'LEVIATHAN', label: 'What it is called' },
  },
  create(api, p) {
    const bodies: (Body & { data: { wisps: Wisp[]; R0: number; target: { x: number; y: number } } })[] = [];
    const size = Number(p.size) || 1;
    const name = String(p.name || 'LEVIATHAN').toUpperCase().slice(0, 18);
    let next = api.t + 6 + api.rng() * 10;
    let nextId = 1;
    const scared = new Map<Fleet, number>();

    const spawn = () => {
      const v = api.view();
      // Mostly swims with the map's drift, so it stays a while.
      const fromLeft = api.rng() < 0.7;
      const y = api.height * (0.2 + api.rng() * 0.6);
      // Head just past the edge, so it starts entering at once.
      const x = fromLeft ? v.left - 30 : v.right + 30;
      const heading = fromLeft ? (api.rng() - 0.5) * 0.4 : Math.PI + (api.rng() - 0.5) * 0.4;
      const n = Math.round(34 * size);
      const b = createBody('leviathan', x, y, n, 13 * size, heading, nextId++) as (typeof bodies)[number];
      b.data = {
        wisps: Array.from({ length: 14 }, () => ({ seg: Math.floor(api.rng() * n * 0.6), a: api.rng() * Math.PI * 2, r: 30 + api.rng() * 40, w: (api.rng() < 0.5 ? -1 : 1) * (0.8 + api.rng()) })),
        R0: 26 * size,
        target: { x: fromLeft ? v.right + 900 : v.left - 900, y: api.height * (0.25 + api.rng() * 0.5) },
      };
      bodies.push(b);
      api.say(`SOMETHING VAST · ${name} · MOVING`, fromLeft ? v.left + 120 : v.right - 120, y, colorParam(api, p.color, '#c4b5fd'), { priority: 'high', duration: 5200 });
      api.emit({ type: 'leviathan', x: fromLeft ? v.left + 100 : v.right - 100, y, weight: 0.95, follow: () => (bodies.includes(b) ? { x: b.x, y: b.y } : null) });
    };

    const scare = (f: Fleet, b: Body) => {
      if (f.steer || scared.has(f)) return;
      scared.set(f, api.t + 3.5);
      f.steer = (fl, dt) => {
        const me = fl.ships[0];
        steerToward(me, me.x + (me.x - b.x) * 2, me.y + (me.y - b.y) * 2, 90, 2.5, dt);
      };
      api.say(`${f.callsign} · EVADING`, f.ships[0].x, f.ships[0].y, f.ships[0].color, { priority: 'low', followId: f.id, duration: 2400 });
    };

    return {
      update(dt) {
        if (api.t >= next && bodies.length < 2) {
          spawn();
          next = api.t + (Number(p.every) || 80) * (0.7 + api.rng() * 0.6);
        }
        const v = api.view();
        for (let i = bodies.length - 1; i >= 0; i--) {
          const b = bodies[i];
          // A slow, sinuous migration toward a point well past the far edge.
          // Faster than the map drifts, so it crosses the view in about half a minute.
          seek(b, b.data.target.x, b.data.target.y + Math.sin(api.t * 0.07 + b.id) * 160, 30 * Math.sqrt(size), 0.18, dt);
          stepBody(b, dt, 0.35);
          for (const w of b.data.wisps) w.a += (w.w * dt * 60) / w.r;
          // Ships give it room.
          for (const f of api.world.fleets) {
            const L = f.ships[0];
            if (!L || f.z > 0.1) continue;
            for (let k = 0; k < b.n; k += 4) {
              if (Math.hypot(L.x - b.seg[k * 2], L.y - b.seg[k * 2 + 1]) < b.data.R0 * 4) {
                scare(f, b);
                break;
              }
            }
          }
          // Gone once it is well past the view.
          const tailX = b.seg[(b.n - 1) * 2];
          if ((b.heading > -Math.PI / 2 && b.heading < Math.PI / 2 ? tailX > v.right + 500 : tailX < v.left - 500) || b.age > 400) bodies.splice(i, 1);
        }
        for (const [f, until] of scared) {
          if (api.t < until && f.mode !== 'gone') continue;
          scared.delete(f);
          if (f.mode !== 'gone' && f.ships.length) api.release(f);
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'mid') return;
        const line = colorParam(api, p.color, '#c4b5fd');
        const glow = colorParam(api, p.glow, '#67e8f9');
        for (const b of bodies) {
          drawLeviathan(ctx, b, api.screenX, frame.time, b.data.R0, line, glow);
          // Wisps circling it like pilot fish.
          ctx.fillStyle = hexRgba(glow, 0.85);
          for (const w of b.data.wisps) {
            const sx = b.seg[w.seg * 2];
            const sy = b.seg[w.seg * 2 + 1];
            ctx.fillRect(api.screenX(sx + Math.cos(w.a) * w.r) - 1, sy + Math.sin(w.a) * w.r * 0.7 - 1, 2, 2);
          }
        }
      },
    };
  },
});
