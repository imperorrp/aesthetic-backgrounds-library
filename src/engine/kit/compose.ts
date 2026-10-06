/**
 * Composition: each seed draws its own cast of systems from a library.
 *
 * This is what makes the sector map's universes play differently (35 mechanics,
 * recombined per pack), generalized: a world declares a library of systems (threats,
 * wonders, weather, life, economies, rituals), each with odds, tags, exclusions, needs,
 * and per-seed parameters; `compose` draws a cast for one seed. One seed gets two
 * threats and no weather, the next a wonder, a plague, and a migration, the next almost
 * nothing but a slow beautiful ecology. Quotas per tag keep casts sane (0–2 threats,
 * say), and `none` is a real outcome.
 *
 * Systems are plain objects; a world steps and paints the ones it drew.
 */
import type { Genome } from './genome';

export type SystemDef<W, P = unknown> = {
  id: string;
  /** Human name, for the HUD and the chronicle ("a lich in the old halls"). */
  label?: string;
  /** Relative odds of being drawn (may depend on the seed: the land, the scale). */
  weight: number | ((g: Genome, w: W) => number);
  tags: string[];
  /** Ids or tags that can't share a world with this one. */
  excludes?: string[];
  /** Ids or tags that must already be in the cast. */
  requires?: string[];
  /** Per-seed parameters. */
  params?(g: Genome, w: W): P;
  create(w: W, p: P, g: Genome): SystemInstance;
};

export type SystemInstance = {
  id: string;
  step?(dt: number): void;
  /** Paint in a named pass (each world names its passes). */
  paint?(pass: string, ctx: CanvasRenderingContext2D): void;
  counts?(): Record<string, number>;
  /** One line for the HUD while it matters (or null). */
  status?(): string | null;
};

export type CastRule = {
  /** How many systems in total (drawn between). */
  total: [number, number];
  /** Per tag: [min, max] in the cast. */
  quota?: Record<string, [number, number]>;
};

export type Cast<W> = { def: SystemDef<W, any>; params: unknown }[];

/** Draw a cast for one seed. Deterministic for the genome. */
export function compose<W>(g: Genome, w: W, library: SystemDef<W, any>[], rule: CastRule, forced: string[] = []): Cast<W> {
  const cast: Cast<W> = [];
  const has = (key: string) => cast.some((c) => c.def.id === key || c.def.tags.includes(key));
  const tagCount = (tag: string) => cast.filter((c) => c.def.tags.includes(tag)).length;
  const fits = (d: SystemDef<W, any>) => {
    if (cast.some((c) => c.def.id === d.id)) return false;
    if (d.excludes?.some(has)) return false;
    if (cast.some((c) => c.def.excludes?.some((x) => x === d.id || d.tags.includes(x)))) return false;
    if (d.requires && !d.requires.every(has)) return false;
    for (const t of d.tags) {
      const q = rule.quota?.[t];
      if (q && tagCount(t) >= q[1]) return false;
    }
    return true;
  };
  const add = (d: SystemDef<W, any>) => cast.push({ def: d, params: d.params ? d.params(g.fork(d.id), w) : undefined });
  const weightOf = (d: SystemDef<W, any>) => Math.max(0, typeof d.weight === 'function' ? d.weight(g, w) : d.weight);
  const draw = (pool: SystemDef<W, any>[]) => {
    const ok = pool.filter((d) => fits(d) && weightOf(d) > 0);
    if (!ok.length) return null;
    const total = ok.reduce((s, d) => s + weightOf(d), 0);
    let x = g.unit() * total;
    for (const d of ok) {
      x -= weightOf(d);
      if (x <= 0) return d;
    }
    return ok[ok.length - 1];
  };
  for (const id of forced) {
    const d = library.find((x) => x.id === id);
    if (d && fits(d)) add(d);
  }
  // Meet each tag's minimum first, then fill to the drawn total.
  for (const [tag, [min]] of Object.entries(rule.quota ?? {})) {
    while (tagCount(tag) < min) {
      const d = draw(library.filter((x) => x.tags.includes(tag)));
      if (!d) break;
      add(d);
    }
  }
  const total = g.int(rule.total[0], rule.total[1]);
  while (cast.length < total) {
    const d = draw(library);
    if (!d) break;
    add(d);
  }
  return cast;
}
