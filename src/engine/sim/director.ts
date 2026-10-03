/**
 * The director: a camera operator that watches the event bus and, now and then, leans
 * in on whatever is happening (a raid, a capture, an armada), lingers, and lets go.
 *
 *   steady     the classic fixed framing; only input (if enabled) moves it
 *   director   occasional, gentle moves: a slight push-in toward big events, and every
 *              so often an establishing drift on its own
 *   cinematic  frequent, deeper moves that track moving subjects
 *
 * Input (all optional, the only non-deterministic part):
 *   lean       the camera leans a few percent toward the pointer
 *   scroll     page scroll travels along the map (handled by the world's base drift)
 *   gesture    wheel zoom and drag pan, which hand control back after a few idle seconds
 *
 * Every move is a critically damped spring on (x, y, zoom), so the camera never jerks.
 * The view clamps the camera inside the base frame, so nothing unpopulated shows.
 */
import type { Bus, WorldEvent } from './bus';
import type { View } from './view';

export type CameraMode = 'steady' | 'director' | 'cinematic';

export type Focus = {
  x: number;
  y: number;
  z: number;
  weight: number;
  type: string;
  label?: string;
  since: number;
  until: number;
  follow?: WorldEvent['follow'];
};

export type DirectorInput = {
  /** Pointer in normalized canvas coordinates, if leaning is on. */
  pointer?: { nx: number; ny: number; active: boolean; idle: number };
  /** Wheel zoom factor and drag pan (screen px) since the last update. */
  gesture?: { zoom: number; panX: number; panY: number };
};

export type Director = {
  update(dt: number, t: number, input?: DirectorInput): void;
  /** What the camera is on right now, if anything. */
  readonly focus: Focus | null;
  readonly mode: CameraMode;
};

type Tuning = { threshold: number; pull: number; zoom: number; omega: number; dwell: number; idleGap: [number, number] };
const TUNING: Record<Exclude<CameraMode, 'steady'>, Tuning> = {
  // Gentle: only strong events, small push-in, an establishing move every minute or so.
  director: { threshold: 0.55, pull: 0.5, zoom: 0.2, omega: 0.7, dwell: 7, idleGap: [45, 80] },
  // Eager: more events qualify, deeper zoom, tracks subjects, shorter gaps.
  cinematic: { threshold: 0.35, pull: 0.9, zoom: 0.5, omega: 0.95, dwell: 9, idleGap: [18, 35] },
};

/** Event types never worth a camera move. */
const IGNORE = new Set(['say', 'dock', 'depart', 'approach', 'survey', 'cargo']);

export function createDirector(view: View, bus: Bus, mode: CameraMode, rng: () => number): Director {
  let focus: Focus | null = null;
  let cooldownUntil = 0;
  let nextLook = 0;
  let nextIdleMove = mode === 'steady' ? Infinity : 12 + rng() * 20;
  // Spring state: the camera's offset from the base frame (so the drift never makes it
  // lag), and its zoom.
  let px = 0;
  let py = 0;
  let pz = view.zoom;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  // User gesture state: an extra zoom and offset that relax after idle.
  let userZoom = 1;
  let userX = 0;
  let userY = 0;
  let userIdle = Infinity;

  const tune = mode === 'steady' ? null : TUNING[mode];

  /** Best candidate among recent events, or null. */
  const bestEvent = (t: number): Focus | null => {
    let best: Focus | null = null;
    for (const e of bus.since(t - 1.5)) {
      if (IGNORE.has(e.type) || e.x === undefined || e.y === undefined) continue;
      const z = e.z ?? 0;
      const b = view.baseBounds(z, -60);
      if (e.x < b.left || e.x > b.right || e.y < b.top || e.y > b.bottom) continue;
      const w = Math.min(1, (e.weight ?? 0.2) * (e.follow ? 1.15 : 1));
      if (!best || w > best.weight) best = { x: e.x, y: e.y, z, weight: w, type: e.type, label: e.text, since: t, until: 0, follow: e.follow };
    }
    return best;
  };

  const spring = (p: number, v: number, target: number, omega: number, dt: number): [number, number] => {
    // Critically damped: no overshoot, eases in and out.
    const a = omega * omega * (target - p) - 2 * omega * v;
    v += a * dt;
    return [p + v * dt, v];
  };

  return {
    get focus() {
      return focus;
    },
    mode,
    update(dt, t, input) {
      if (tune) {
        // 1. Track, extend, or end the current focus.
        if (focus) {
          if (focus.follow) {
            const p = focus.follow();
            if (p) {
              focus.x = p.x;
              focus.y = p.y;
              focus.z = p.z ?? focus.z;
            } else focus.until = Math.min(focus.until, t + 1.5);
          }
          if (t > focus.until) {
            focus = null;
            cooldownUntil = t + 4;
            nextIdleMove = t + tune.idleGap[0] + rng() * (tune.idleGap[1] - tune.idleGap[0]);
          }
        }
        // 2. Look at what just happened, four times a second.
        if (t >= nextLook) {
          nextLook = t + 0.25;
          const c = bestEvent(t);
          if (c && c.weight >= tune.threshold && t >= cooldownUntil && (!focus || (c.weight > focus.weight * 1.6 && t - focus.since > 3))) {
            c.until = t + tune.dwell + c.weight * 6;
            focus = c;
          }
        }
        // 3. On its own, sometimes: an establishing drift toward a recent quiet event or anywhere.
        if (!focus && t >= nextIdleMove && t >= cooldownUntil) {
          const recent = bus.since(t - 20).filter((e) => e.x !== undefined && e.y !== undefined && !IGNORE.has(e.type));
          const pick = recent.length ? recent[Math.floor(rng() * recent.length)] : null;
          const b = view.baseBounds(0, -120);
          focus = {
            x: pick?.x ?? b.left + rng() * (b.right - b.left),
            y: pick?.y ?? b.top + rng() * (b.bottom - b.top),
            z: pick?.z ?? 0,
            weight: 0.45,
            type: 'establishing',
            since: t,
            until: t + 9 + rng() * 5,
          };
        }
      }

      // 4. Targets, as offsets from the base frame: pulled toward the focus, leaning
      // toward the pointer.
      let tx = 0;
      let ty = 0;
      let tz = 1;
      if (focus && tune) {
        tx = (focus.x - view.baseX) * tune.pull;
        ty = (focus.y - view.baseY) * tune.pull;
        tz = 1 + tune.zoom * focus.weight;
      }
      const p = input?.pointer;
      if (p?.active && p.idle < 4) {
        tx += (p.nx - 0.5) * view.width * 0.05;
        ty += (p.ny - 0.5) * view.height * 0.05;
      }
      // 5. User gestures win while active and relax back after a few idle seconds.
      const g = input?.gesture;
      if (g && (g.zoom !== 1 || g.panX || g.panY)) {
        userZoom = Math.max(1, Math.min(1.8, userZoom * g.zoom));
        userX -= g.panX / pz;
        userY -= g.panY / pz;
        userIdle = 0;
      } else userIdle += dt;
      if (userIdle > 6) {
        const k = Math.min(1, dt * 0.8);
        userZoom += (1 - userZoom) * k;
        userX -= userX * k;
        userY -= userY * k;
      }
      tz *= userZoom;
      tx += userX;
      ty += userY;

      // 6. Springs, sub-stepped so a long frame cannot overshoot.
      const omega = tune?.omega ?? 1.2;
      const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        [px, vx] = spring(px, vx, tx, omega, h);
        [py, vy] = spring(py, vy, ty, omega, h);
        [pz, vz] = spring(pz, vz, tz, omega, h);
      }
      // The view clamps the camera inside the base frame; read the clamped result back so
      // the spring never winds up against the edge.
      view.setCamera(view.baseX + px, view.baseY + py, pz);
      px = view.x - view.baseX;
      py = view.y - view.baseY;
      pz = view.zoom;
    },
  };
}
