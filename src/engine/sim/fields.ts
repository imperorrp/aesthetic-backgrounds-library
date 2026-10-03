/**
 * Fields: the invisible currents of a world. Wind across a dust plain, a storm front's
 * gusts, the pull around a maw, slow tides of plasma. Anything that drifts (rocks,
 * spores, wisps, rain, smoke, ships caught in weather) asks the field which way to go.
 *
 * A field is a sum of sources, each a vector function of position and time with its
 * own strength envelope:
 *
 *   uniform  steady wind in one direction
 *   band     a moving front: strong inside a band that sweeps across the map
 *   vortex   swirl (and optional inward pull) around a point
 *   noise    smooth, curling currents from 2D noise (divergence-free, so nothing piles up)
 *
 *   const field = createField(noise);
 *   const wind = field.add({ kind: 'uniform', angle: Math.PI, strength: 12 });
 *   field.add({ kind: 'vortex', x, y, radius: 220, strength: 40, pull: 0.3 });
 *   field.sample(x, y, t, out)   // out.x, out.y in world units per second
 *   field.remove(wind)
 */
import type { Noise2D } from '../noise';

export type FieldSource =
  | { kind: 'uniform'; angle: number; strength: number }
  | {
      kind: 'band';
      /** Direction the front travels (radians). */
      angle: number;
      /** Where the band's center is along that direction at time t (world units). */
      at: (t: number) => number;
      width: number;
      strength: number;
    }
  | { kind: 'vortex'; x: number; y: number; radius: number; strength: number; /** 0..1 share of inward pull. */ pull?: number }
  | { kind: 'noise'; scale: number; strength: number; /** Seconds per full change of the pattern. */ period?: number };

export type FieldHandle = { source: FieldSource; weight: number };

export type Field = {
  /** Add a source; `weight` (0..1) can be changed later to fade it in and out. */
  add(source: FieldSource, weight?: number): FieldHandle;
  remove(h: FieldHandle): void;
  readonly sources: readonly FieldHandle[];
  /** The flow at a point, in world units per second, written into `out`. */
  sample(x: number, y: number, t: number, out?: { x: number; y: number }): { x: number; y: number };
};

export function createField(noise: Noise2D): Field {
  const sources: FieldHandle[] = [];

  return {
    sources,
    add(source, weight = 1) {
      const h = { source, weight };
      sources.push(h);
      return h;
    },
    remove(h) {
      const i = sources.indexOf(h);
      if (i >= 0) sources.splice(i, 1);
    },
    sample(x, y, t, out = { x: 0, y: 0 }) {
      out.x = 0;
      out.y = 0;
      for (const { source: s, weight } of sources) {
        if (weight <= 0) continue;
        switch (s.kind) {
          case 'uniform':
            out.x += Math.cos(s.angle) * s.strength * weight;
            out.y += Math.sin(s.angle) * s.strength * weight;
            break;
          case 'band': {
            const ux = Math.cos(s.angle);
            const uy = Math.sin(s.angle);
            const d = x * ux + y * uy - s.at(t);
            const k = Math.max(0, 1 - Math.abs(d) / (s.width / 2));
            // Gusty inside the front: the strength wavers along it.
            const gust = 0.75 + 0.25 * noise.noise2((x * -uy + y * ux) * 0.004, t * 0.3);
            out.x += ux * s.strength * k * gust * weight;
            out.y += uy * s.strength * k * gust * weight;
            break;
          }
          case 'vortex': {
            const dx = x - s.x;
            const dy = y - s.y;
            const r = Math.hypot(dx, dy) || 1;
            if (r > s.radius * 2) break;
            // Strongest at the radius, fading inside and out.
            const k = (r / s.radius) * Math.exp(1 - r / s.radius);
            const pull = s.pull ?? 0;
            out.x += ((-dy / r) * (1 - pull) - (dx / r) * pull) * s.strength * k * weight;
            out.y += ((dx / r) * (1 - pull) - (dy / r) * pull) * s.strength * k * weight;
            break;
          }
          case 'noise': {
            // Curl of a scalar noise potential: flows that swirl and never converge.
            const e = 0.5;
            const sc = s.scale;
            const tt = t / (s.period ?? 60);
            const n = (px: number, py: number) => noise.noise2(px * sc + tt, py * sc - tt * 0.7);
            const dndy = (n(x, y + e) - n(x, y - e)) / (2 * e);
            const dndx = (n(x + e, y) - n(x - e, y)) / (2 * e);
            const norm = 1 / (sc || 1);
            out.x += dndy * norm * s.strength * weight;
            out.y += -dndx * norm * s.strength * weight;
            break;
          }
        }
      }
      return out;
    },
  };
}
