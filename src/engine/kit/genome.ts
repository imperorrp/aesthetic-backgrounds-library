/**
 * A seed's genome: the draws that make one world unlike another.
 *
 * Variety should be continuous, not a list of five. Instead of picking "the fen" from a
 * table, draw how much of each archetype the world is (`blend`), jitter every constant a
 * little (`jitter`), and draw ranges with a shape (`range`, `lognormal`). Archetypes become
 * regions of a space, and seeds land everywhere in it, including between regions.
 *
 * Colors come from the host palette by harmony, in OKLCH, so worlds sit with the page
 * they are on and still differ by seed (`hues`).
 */
import { forkRng, type Rng } from '../rng';
import { hexToOklch, oklchToHex, type Oklch } from '../color';

export type Genome = {
  rng: Rng;
  /** 0..1 */
  unit(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  /** Mostly near `median`, occasionally far: e^(N(ln median, sigma)). */
  lognormal(median: number, sigma: number): number;
  /** A normal draw, clamped to ±3 sigma. */
  normal(mean: number, sigma: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Pick a key by weight: `weighted({ ink: 3, glass: 1 })`. */
  weighted<K extends string>(weights: Record<K, number>): K;
  /** A random subset of n items (n drawn between min and max). */
  subset<T>(items: readonly T[], min: number, max: number): T[];
  /** How much of each archetype (weights summing to 1, mostly one or two dominant). */
  blend<K extends string>(keys: readonly K[], spread?: number): Record<K, number>;
  /** Multiply by a factor near 1: every constant a little different per seed. */
  jitter(v: number, amount?: number): number;
  shuffle<T>(items: readonly T[]): T[];
  /** `n` hues around the accent, by a harmony, as OKLCH, with lightness/chroma set for the medium. */
  hues(accent: string, n: number, opts?: { spread?: number; l?: number; c?: number }): string[];
  /** A child genome for a subsystem (its draws don't disturb the parent's). */
  fork(label: string): Genome;
};

export function createGenome(seed: string | number, label = 'genome'): Genome {
  const rng = forkRng(seed, label);
  const g: Genome = {
    rng,
    unit: () => rng(),
    range: (a, b) => a + rng() * (b - a),
    int: (a, b) => a + Math.floor(rng() * (b - a + 1)),
    lognormal: (median, sigma) => median * Math.exp(g.normal(0, sigma)),
    normal(mean, sigma) {
      const u = Math.max(1e-9, rng());
      const v = rng();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return mean + Math.max(-3, Math.min(3, z)) * sigma;
    },
    chance: (p) => rng() < p,
    pick: (items) => items[Math.floor(rng() * items.length)],
    weighted(weights) {
      const keys = Object.keys(weights) as (keyof typeof weights)[];
      const total = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0);
      let x = rng() * total;
      for (const k of keys) {
        x -= Math.max(0, weights[k]);
        if (x <= 0) return k;
      }
      return keys[keys.length - 1];
    },
    subset(items, min, max) {
      return g.shuffle(items).slice(0, g.int(min, Math.min(max, items.length)));
    },
    blend(keys, spread = 1.6) {
      // Exponentials raised to a power: a Dirichlet-ish draw that favors one or two.
      const raw = keys.map(() => (-Math.log(Math.max(1e-9, rng()))) ** spread);
      const sum = raw.reduce((s, v) => s + v, 0);
      return Object.fromEntries(keys.map((k, i) => [k, raw[i] / sum])) as Record<(typeof keys)[number], number>;
    },
    jitter: (v, amount = 0.15) => v * (1 + (rng() * 2 - 1) * amount),
    shuffle(items) {
      const a = [...items];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    hues(accent, n, opts = {}) {
      const base: Oklch = hexToOklch(accent) ?? { l: 0.7, c: 0.15, h: 200 };
      const spread = opts.spread ?? g.pick([40, 70, 120, 150]);
      const start = base.h + g.range(-20, 20);
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        // Around the wheel from the accent, alternating sides, with a little drift.
        const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        const h = (start + side * (spread / Math.max(1, Math.ceil((n - 1) / 2))) + g.range(-8, 8) + 360) % 360;
        out.push(oklchToHex({ l: opts.l ?? g.range(0.7, 0.82), c: opts.c ?? g.range(0.12, 0.19), h }));
      }
      return out;
    },
    fork: (l) => createGenome(`${String(seed)}:${label}`, l),
  };
  return g;
}
