// @vitest-environment node
/**
 * Leylines, sim-only on the headless host. The ink world (the default): the orders' lines
 * grow and hold wells; each seed draws its own cast of phenomena, and casts differ across
 * seeds; a seed replays. The classic world still runs as `style: 'classic'`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';
import { createGenome, compose } from '../../kit';
import { LIBRARY } from './ink/systems';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'leylines', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('leylines ink (headless)', { timeout: 180_000 }, () => {
  it('the orders grow lines and hold wells; the cast does things', () => {
    const r = run(150, 'i4');
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.orders).toBeGreaterThanOrEqual(2);
    expect(last.held).toBeGreaterThan(last.wells * 0.5);
    const types = new Set(r.log.map((e) => e.type));
    expect(types.has('claim') || types.has('reach')).toBe(true);
    // Something from the cast, not only the orders.
    const cast = [...types].filter((t) => !!t && !['claim', 'reach', 'say'].includes(t));
    expect(cast.length).toBeGreaterThanOrEqual(2);
  });

  it('seeds draw different casts', () => {
    const casts = new Set<string>();
    for (let k = 0; k < 12; k++) {
      const g = createGenome(`cast-${k}`, 'ink');
      const world = { opts: { storms: 1, rifts: 1 }, land: { isles: 0.2, steppe: 0.2, forest: 0.2, desert: 0.1, tundra: 0.1, marsh: 0.1, mountains: 0.1 }, wells: [], medium: 'night' };
      casts.add(compose(g, world as never, LIBRARY, { total: [3, 7], quota: { weather: [0, 2], calamity: [0, 2], wonder: [0, 2], life: [1, 3] } }).map((c) => c.def.id).sort().join(','));
    }
    expect(casts.size).toBeGreaterThanOrEqual(10);
  });

  it('replays identically for the same seed', () => {
    const a = run(60, 'replay');
    const b = run(60, 'replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});

describe('leylines classic (headless)', { timeout: 120_000 }, () => {
  it('still runs', () => {
    const r = run(300, 'l3', { style: 'classic' });
    expect(r.threw).toBeUndefined();
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['tower', 'duel']) expect(types, t).toContain(t);
  });
});
