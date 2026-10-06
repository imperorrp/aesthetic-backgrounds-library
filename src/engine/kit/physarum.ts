/**
 * Physarum: many simple movers that follow and lay a trail, so that networks grow.
 *
 * Each agent senses its own species' trail ahead, ahead-left, and ahead-right, turns
 * toward the strongest, steps, and deposits. Trails blur and fade. From that alone come
 * veins, loops, and transport networks that link food sources (Jones 2010), the way
 * slime mold links oat flakes. With several species that avoid one another's trails,
 * they become territories with living borders.
 *
 * Struct-of-arrays for speed; positions are in field cells.
 */
import type { Rng } from '../rng';
import { Field } from './field';

export type Species = {
  /** Sensor angle and distance, turn angle (radians, cells). */
  sa: number;
  sd: number;
  ra: number;
  speed: number;
  deposit: number;
  /** Trail blur rate and the fraction kept each step. */
  diffuse: number;
  keep: number;
  /** How much other species' trails repel (0 ignore .. 1 strong). */
  repel: number;
  /** Random turn per step (radians). */
  jitter: number;
};

export type Physarum = {
  trails: Field[];
  /** Every species' trail summed (after each step). */
  total: Field;
  /** Each species' largest trail value (after each step). */
  max: Float32Array;
  species: Species[];
  n: number;
  x: Float32Array;
  y: Float32Array;
  a: Float32Array;
  s: Uint8Array;
  alive: Uint8Array;
  /** Add an agent of species `s` at (x, y), heading `a`. Returns its index, or -1 if full. */
  spawn(s: number, x: number, y: number, a: number): number;
  kill(i: number): void;
  count(s?: number): number;
  /**
   * One step. `bias(x, y, s)` adds to what agents sense (food, fear, walls as -Infinity);
   * `steer(i)` may return an extra turn for agent i (storms, rifts).
   */
  step(bias?: (x: number, y: number, s: number) => number, steer?: (i: number) => number): void;
};

export function createPhysarum(w: number, h: number, species: Species[], capacity: number, rng: Rng): Physarum {
  const trails = species.map(() => new Field(w, h));
  const total = new Field(w, h);
  const max = new Float32Array(species.length);
  const counts = new Int32Array(species.length);
  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const a = new Float32Array(capacity);
  const s = new Uint8Array(capacity);
  const alive = new Uint8Array(capacity);
  const free: number[] = [];
  for (let i = capacity - 1; i >= 0; i--) free.push(i);
  const p: Physarum = {
    trails,
    total,
    max,
    species,
    n: capacity,
    x,
    y,
    a,
    s,
    alive,
    spawn(sp, px, py, pa) {
      const i = free.pop();
      if (i === undefined) return -1;
      x[i] = px;
      y[i] = py;
      a[i] = pa;
      s[i] = sp;
      alive[i] = 1;
      counts[sp]++;
      return i;
    },
    kill(i) {
      if (!alive[i]) return;
      alive[i] = 0;
      counts[s[i]]--;
      free.push(i);
    },
    count(sp) {
      if (sp !== undefined) return counts[sp];
      let c = 0;
      for (let k = 0; k < counts.length; k++) c += counts[k];
      return c;
    },
    step(bias, steer) {
      const ns = species.length;
      // Own trail, less the others' (the total less one's own), scaled by how much they repel.
      const sense = (sp: number, px: number, py: number) => {
        const own = trails[sp].sample(px, py);
        const rep = species[sp].repel;
        let v = rep > 0 ? own * (1 + rep) - total.sample(px, py) * rep : own;
        if (bias) v += bias(px, py, sp);
        return v;
      };
      for (let i = 0; i < capacity; i++) {
        if (!alive[i]) continue;
        const sp = s[i];
        const P = species[sp];
        const ai = a[i];
        const xi = x[i];
        const yi = y[i];
        const f = sense(sp, xi + Math.cos(ai) * P.sd, yi + Math.sin(ai) * P.sd);
        const l = sense(sp, xi + Math.cos(ai - P.sa) * P.sd, yi + Math.sin(ai - P.sa) * P.sd);
        const r = sense(sp, xi + Math.cos(ai + P.sa) * P.sd, yi + Math.sin(ai + P.sa) * P.sd);
        let na = ai;
        if (f >= l && f >= r) na += 0;
        else if (f < l && f < r) na += (rng() < 0.5 ? -1 : 1) * P.ra;
        else if (l > r) na -= P.ra;
        else na += P.ra;
        na += (rng() - 0.5) * P.jitter;
        if (steer) na += steer(i);
        const nx = xi + Math.cos(na) * P.speed;
        const ny = yi + Math.sin(na) * P.speed;
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1 || (bias && bias(nx, ny, sp) === -Infinity)) {
          a[i] = rng() * Math.PI * 2;
          continue;
        }
        x[i] = nx;
        y[i] = ny;
        a[i] = na;
        trails[sp].data[(ny | 0) * w + (nx | 0)] += P.deposit;
      }
      const td = total.data;
      td.fill(0);
      for (let k = 0; k < ns; k++) {
        // A species with no movers and a faded trail costs nothing.
        if (!counts[k] && max[k] < 1e-3) {
          max[k] = 0;
          continue;
        }
        max[k] = trails[k].diffuse(species[k].diffuse, species[k].keep);
        const d = trails[k].data;
        for (let i = 0; i < td.length; i++) td[i] += d[i];
      }
    },
  };
  return p;
}
