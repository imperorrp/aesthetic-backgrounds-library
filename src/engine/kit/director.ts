/**
 * The director: pacing and the camera.
 *
 * Worlds no longer fire their big moments on timers. They report how much is going on
 * (`note`), and ask the director whether now is the time for something (`want`). The
 * director follows an arc, a target tension over time (calm, build, peak, release,
 * shaped per seed), and says yes when the world is calmer than the arc wants, the kind
 * is off cooldown, and it hasn't been seen too recently (novelty). Never long without
 * something; never two peaks at once.
 *
 * It also owns where the camera wants to be: `look` requests with a priority, and calm
 * wandering shots when nothing asks.
 */
import type { Rng } from '../rng';

export type Arc = 'swell' | 'waves' | 'slowburn' | 'restless';
export const ARCS: Arc[] = ['swell', 'waves', 'slowburn', 'restless'];

export type Shot = { x: number; y: number; zoom: number; until: number; why: string; priority: number };

export type Director = {
  /** Target tension now, 0..1. */
  tension(): number;
  /** Measured activity, 0..1 (smoothed from `note`). */
  readonly activity: number;
  /** Report something happening, of weight 0..1. */
  note(weight: number): void;
  /**
   * Should the world start something of `kind` (salience 0..1) now? True at most once per
   * call site's cooldown; records it when true.
   */
  want(kind: string, salience: number, cooldown: number): boolean;
  /** How many seconds since `kind` last happened (Infinity if never). */
  since(kind: string): number;
  /** Ask the camera to look; a request of lower priority does not cut a higher one short. */
  look(why: string, x: number, y: number, zoom: number, dur: number, priority: number): void;
  readonly shot: Shot;
  step(t: number, dt: number): void;
};

export function createDirector(rng: Rng, opts: { arc: Arc; period: number; floor?: number; establish: () => Omit<Shot, 'until' | 'priority' | 'why'> }): Director {
  let t = 0;
  let activity = 0;
  const last = new Map<string, number>();
  const recent: string[] = [];
  const phase0 = rng();
  const floor = opts.floor ?? 0.15;
  const shape = (u: number): number => {
    switch (opts.arc) {
      case 'swell':
        // Slow rise to a peak three quarters in, then a fall.
        return u < 0.75 ? (u / 0.75) ** 2 : 1 - ((u - 0.75) / 0.25) ** 0.6;
      case 'waves':
        return 0.5 + 0.5 * Math.sin(u * Math.PI * 4 - Math.PI / 2);
      case 'slowburn':
        return u ** 3;
      default:
        return 0.5 + 0.3 * Math.sin(u * Math.PI * 6) + 0.2 * Math.sin(u * Math.PI * 14 + 1);
    }
  };
  const d: Director = {
    tension: () => floor + (1 - floor) * Math.max(0, Math.min(1, shape(((t / opts.period) + phase0) % 1))),
    get activity() {
      return activity;
    },
    note(w) {
      activity = Math.min(1.5, activity + w);
    },
    want(kind, salience, cooldown) {
      const ago = d.since(kind);
      if (ago < cooldown) return false;
      // Big things only near the top of the arc; small things whenever it's quiet.
      const room = d.tension() - activity;
      if (room < salience * 0.6 - 0.15) return false;
      // Seen recently: less likely.
      const seen = recent.filter((k) => k === kind).length;
      if (rng() > 1 / (1 + seen * 1.5)) return false;
      last.set(kind, t);
      recent.push(kind);
      if (recent.length > 8) recent.shift();
      return true;
    },
    since: (kind) => (last.has(kind) ? t - last.get(kind)! : Infinity),
    look(why, x, y, zoom, dur, priority) {
      const s = d.shot;
      if (t < s.until && s.priority > priority) return;
      shot = { x, y, zoom, until: t + dur, why, priority };
    },
    get shot() {
      return shot;
    },
    step(now, dt) {
      t = now;
      activity *= Math.exp(-dt / 12);
      if (t >= shot.until) {
        const e = opts.establish();
        shot = { ...e, until: t + 10 + rng() * 8, why: 'establish', priority: 0 };
      }
    },
  };
  let shot: Shot = { ...opts.establish(), until: 0, why: 'establish', priority: 0 };
  return d;
}

/** A camera that eases toward the director's shot, kept inside the world. */
export function createCamera(w: number, h: number, maxZoom = 1.6) {
  const cam = { x: w / 2, y: h / 2, zoom: 1 };
  return {
    cam,
    follow(shot: { x: number; y: number; zoom: number }, dt: number, view: { W: number; H: number }) {
      const zoom = Math.max(1, Math.min(maxZoom, shot.zoom));
      cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 0.45);
      const k = Math.min(1, dt * 0.6);
      cam.x += (shot.x - cam.x) * k;
      cam.y += (shot.y - cam.y) * k;
      const hw = view.W / 2 / cam.zoom;
      const hh = view.H / 2 / cam.zoom;
      cam.x = Math.max(hw, Math.min(w - hw, cam.x));
      cam.y = Math.max(hh, Math.min(h - hh, cam.y));
    },
    sx: (x: number, W: number) => (x - cam.x) * cam.zoom + W / 2,
    sy: (y: number, H: number) => (y - cam.y) * cam.zoom + H / 2,
  };
}
