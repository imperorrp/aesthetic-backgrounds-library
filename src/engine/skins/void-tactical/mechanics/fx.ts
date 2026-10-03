/**
 * Effects shared by every mechanic: explosions (flash, shockwave, sparks, debris),
 * tracers, beams, homing missiles with smoke trails, warp streaks, and rings. All
 * positions are on the map plane (world x, screen y); all motion is by `dt`; all
 * randomness comes from the stream the world passes in.
 */
import type { Rng } from '../../../rng';
import { hexRgba } from '../renderers/utils';

type P = { x: number; y: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Debris = { x: number; y: number; vx: number; vy: number; ang: number; spin: number; len: number; life: number; max: number; color: string };
type Flash = { x: number; y: number; r: number; life: number; max: number; color: string };
type Ring = { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string; width: number };
type Tracer = { x0: number; y0: number; x1: number; y1: number; life: number; max: number; color: string };
type Beam = { from: () => P | null; to: () => P | null; life: number; max: number; color: string; width: number };
type Streak = { x: number; y: number; ang: number; len: number; life: number; max: number; color: string; inbound: boolean };
type Missile = {
  x: number; y: number; vx: number; vy: number;
  target: () => P | null; color: string; speed: number; life: number;
  trail: number[]; onHit?: (x: number, y: number) => void; dead: boolean;
};

export type Fx = {
  explode(x: number, y: number, color: string, size?: number): void;
  ring(x: number, y: number, color: string, r1: number, dur?: number, r0?: number, width?: number): void;
  flash(x: number, y: number, color: string, r: number, dur?: number): void;
  tracer(x0: number, y0: number, x1: number, y1: number, color: string): void;
  beam(from: () => P | null, to: () => P | null, color: string, dur?: number, width?: number): void;
  missile(x: number, y: number, vx: number, vy: number, target: () => P | null, color: string, onHit?: (x: number, y: number) => void, speed?: number): void;
  warp(x: number, y: number, ang: number, color: string, inbound: boolean): void;
  sparks(x: number, y: number, color: string, n: number, speed?: number): void;
  /** Missiles in flight, so point defense can shoot them down. */
  missiles(): readonly { x: number; y: number; dead: boolean; kill(): void }[];
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D, offX: number, alpha: number): void;
  readonly busy: number;
};

export function createFx(rng: Rng): Fx {
  const sparks: Spark[] = [];
  const debris: Debris[] = [];
  const flashes: Flash[] = [];
  const rings: Ring[] = [];
  const tracers: Tracer[] = [];
  const beams: Beam[] = [];
  const streaks: Streak[] = [];
  const missiles: Missile[] = [];
  const cap = <T,>(list: T[], n: number) => {
    if (list.length > n) list.splice(0, list.length - n);
  };

  const fx: Fx = {
    get busy() {
      return sparks.length + missiles.length + beams.length;
    },
    sparks(x, y, color, n, speed = 60) {
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2;
        const s = speed * (0.3 + rng() * 0.9);
        const max = 0.35 + rng() * 0.7;
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: max, max, color, size: 0.8 + rng() * 1.2 });
      }
      cap(sparks, 900);
    },
    explode(x, y, color, size = 1) {
      fx.flash(x, y, '#ffffff', 10 * size, 0.25);
      fx.flash(x, y, color, 22 * size, 0.55);
      fx.ring(x, y, color, 46 * size, 0.8, 4, 1.4);
      fx.sparks(x, y, color, Math.round(14 * size), 90 * size);
      fx.sparks(x, y, '#fff7d6', Math.round(6 * size), 140 * size);
      for (let i = 0; i < Math.round(4 * size); i++) {
        const a = rng() * Math.PI * 2;
        const s = 10 + rng() * 28;
        const max = 4 + rng() * 6;
        debris.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, ang: rng() * 6, spin: (rng() - 0.5) * 6, len: 2 + rng() * 4 * size, life: max, max, color });
      }
      cap(debris, 300);
    },
    ring(x, y, color, r1, dur = 0.8, r0 = 2, width = 1) {
      rings.push({ x, y, r0, r1, life: dur, max: dur, color, width });
      cap(rings, 200);
    },
    flash(x, y, color, r, dur = 0.35) {
      flashes.push({ x, y, r, life: dur, max: dur, color });
      cap(flashes, 120);
    },
    tracer(x0, y0, x1, y1, color) {
      tracers.push({ x0, y0, x1, y1, life: 0.16, max: 0.16, color });
      cap(tracers, 300);
    },
    beam(from, to, color, dur = 0.6, width = 1.6) {
      beams.push({ from, to, life: dur, max: dur, color, width });
      cap(beams, 60);
    },
    missile(x, y, vx, vy, target, color, onHit, speed = 150) {
      missiles.push({ x, y, vx, vy, target, color, speed, life: 6, trail: [], onHit, dead: false });
      cap(missiles, 120);
    },
    warp(x, y, ang, color, inbound) {
      for (let i = 0; i < 9; i++) {
        const off = (rng() - 0.5) * 18;
        streaks.push({ x: x + Math.cos(ang + Math.PI / 2) * off, y: y + Math.sin(ang + Math.PI / 2) * off, ang, len: 40 + rng() * 90, life: 0.5, max: 0.5, color, inbound });
      }
      fx.flash(x, y, color, 18, 0.4);
      cap(streaks, 200);
    },
    missiles() {
      return missiles.map((m) => ({ x: m.x, y: m.y, dead: m.dead, kill: () => (m.dead = true) }));
    },
    update(dt) {
      const age = <T extends { life: number }>(list: T[]) => {
        for (let i = list.length - 1; i >= 0; i--) if ((list[i].life -= dt) <= 0) list.splice(i, 1);
      };
      for (const s of sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 1 - Math.min(1, dt * 2.2);
        s.vy *= 1 - Math.min(1, dt * 2.2);
      }
      for (const d of debris) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 1 - Math.min(1, dt * 0.25);
        d.vy *= 1 - Math.min(1, dt * 0.25);
        d.ang += d.spin * dt;
      }
      for (const m of missiles) {
        if (m.dead) continue;
        m.life -= dt;
        const t = m.target();
        if (t) {
          // Proportional homing: turn the velocity toward the target, accelerate to cruise.
          const dx = t.x - m.x;
          const dy = t.y - m.y;
          const d = Math.hypot(dx, dy) || 1;
          const want = { x: (dx / d) * m.speed, y: (dy / d) * m.speed };
          const k = Math.min(1, dt * 2.6);
          m.vx += (want.x - m.vx) * k;
          m.vy += (want.y - m.vy) * k;
          if (d < 6) {
            m.dead = true;
            m.onHit?.(m.x, m.y);
          }
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.trail.push(m.x, m.y);
        if (m.trail.length > 36) m.trail.splice(0, 2);
        if (m.life <= 0) {
          m.dead = true;
          fx.sparks(m.x, m.y, m.color, 5, 40);
        }
      }
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        if (m.dead && m.trail.length) m.trail.splice(0, 4);
        if (m.dead && !m.trail.length) missiles.splice(i, 1);
      }
      age(sparks);
      age(debris);
      age(flashes);
      age(rings);
      age(tracers);
      age(beams);
      age(streaks);
    },
    draw(ctx, offX, alpha) {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.lineCap = 'round';
      // Missile smoke and bodies.
      for (const m of missiles) {
        const n = m.trail.length / 2;
        for (let i = 1; i < n; i++) {
          const k = i / n;
          ctx.strokeStyle = hexRgba(m.color, 0.5 * k * alpha);
          ctx.lineWidth = 0.6 + k * 1.2;
          ctx.beginPath();
          ctx.moveTo(m.trail[i * 2 - 2] - offX, m.trail[i * 2 - 1]);
          ctx.lineTo(m.trail[i * 2] - offX, m.trail[i * 2 + 1]);
          ctx.stroke();
        }
        if (!m.dead) {
          ctx.fillStyle = hexRgba('#ffffff', 0.95 * alpha);
          ctx.fillRect(m.x - offX - 1, m.y - 1, 2, 2);
        }
      }
      // Debris: tumbling slivers.
      for (const d of debris) {
        const a = (d.life / d.max) * alpha;
        ctx.strokeStyle = hexRgba(d.color, 0.7 * a);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x - offX - Math.cos(d.ang) * d.len, d.y - Math.sin(d.ang) * d.len);
        ctx.lineTo(d.x - offX + Math.cos(d.ang) * d.len, d.y + Math.sin(d.ang) * d.len);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const b of beams) {
        const p = b.from();
        const q = b.to();
        if (!p || !q) continue;
        const k = b.life / b.max;
        const flicker = 0.7 + 0.3 * Math.sin(b.life * 90);
        ctx.strokeStyle = hexRgba(b.color, 0.35 * k * alpha);
        ctx.lineWidth = b.width * 3;
        ctx.beginPath();
        ctx.moveTo(p.x - offX, p.y);
        ctx.lineTo(q.x - offX, q.y);
        ctx.stroke();
        ctx.strokeStyle = hexRgba('#ffffff', 0.85 * k * flicker * alpha);
        ctx.lineWidth = b.width * 0.7;
        ctx.stroke();
      }
      for (const t of tracers) {
        const k = 1 - t.life / t.max;
        const hx = t.x0 + (t.x1 - t.x0) * k;
        const hy = t.y0 + (t.y1 - t.y0) * k;
        const tx = t.x0 + (t.x1 - t.x0) * Math.max(0, k - 0.35);
        const ty = t.y0 + (t.y1 - t.y0) * Math.max(0, k - 0.35);
        ctx.strokeStyle = hexRgba(t.color, 0.95 * alpha);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tx - offX, ty);
        ctx.lineTo(hx - offX, hy);
        ctx.stroke();
      }
      for (const s of streaks) {
        const k = s.life / s.max;
        const grow = s.inbound ? k : 1 - k;
        const len = s.len * (0.2 + grow);
        ctx.strokeStyle = hexRgba(s.color, 0.8 * k * alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x - offX, s.y);
        ctx.lineTo(s.x - offX - Math.cos(s.ang) * len * (s.inbound ? 1 : -1), s.y - Math.sin(s.ang) * len * (s.inbound ? 1 : -1));
        ctx.stroke();
      }
      for (const s of sparks) {
        const a = (s.life / s.max) * alpha;
        ctx.fillStyle = hexRgba(s.color, a);
        ctx.fillRect(s.x - offX - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      for (const f of flashes) {
        const k = f.life / f.max;
        const g = ctx.createRadialGradient(f.x - offX, f.y, 0, f.x - offX, f.y, f.r * (1.2 - k * 0.4));
        g.addColorStop(0, hexRgba(f.color, 0.85 * k * alpha));
        g.addColorStop(1, hexRgba(f.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x - offX, f.y, f.r * (1.2 - k * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const r of rings) {
        const k = 1 - r.life / r.max;
        const ease = 1 - (1 - k) ** 2;
        ctx.strokeStyle = hexRgba(r.color, 0.6 * (1 - k) * alpha);
        ctx.lineWidth = r.width;
        ctx.beginPath();
        ctx.arc(r.x - offX, r.y, r.r0 + (r.r1 - r.r0) * ease, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
  return fx;
}
