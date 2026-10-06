// @vitest-environment node
/**
 * Leylines, sim-only on the headless host. The realm (the default): towers rise on the wells,
 * mages are out on the land, rival mages duel, and something big happens within minutes;
 * every land runs; casts differ across seeds; a seed replays. The ink world and the classic
 * world still run as `style: 'ink'` and `style: 'classic'`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';
import { createGenome, compose } from '../../kit';
import { LIBRARY } from './ink/systems';
import { REALM_CAST } from './realm/sim';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'leylines', seconds, seed, options, sampleEvery: 10 });

beforeAll(async () => {
  await prepareSkins();
});

describe('leylines realm (headless)', { timeout: 240_000 }, () => {
  it('towers rise, mages work the land, rivals duel, and the big things come', () => {
    const r = run(600, 'fen-2');
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['tower', 'duel']) expect(types, t).toContain(t);
    const big = ['war', 'dragon', 'rift', 'storm', 'ritual', 'comet', 'artifact', 'towerfalls'].filter((t) => types.has(t));
    expect(big.length).toBeGreaterThanOrEqual(3);
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.mages).toBeGreaterThan(30);
    // Busy from the start: towers going up in the first minute.
    expect(r.log.some((e) => e.type === 'tower' && e.t < 60)).toBe(true);
  });

  it('every land runs', () => {
    for (const land of ['isles', 'steppe', 'forest', 'desert', 'tundra', 'marsh', 'mountains']) {
      const r = run(120, `land-${land}`, { land });
      expect(r.threw, land).toBeUndefined();
      expect(r.samples[r.samples.length - 1].counts.towers, land).toBeGreaterThan(1);
    }
  });

  it('seeds draw different casts', () => {
    const casts = new Set<string>();
    for (let k = 0; k < 12; k++) {
      const cast = compose(createGenome(`cast-${k}`, 'realm'), { land: 'forest', storms: 1, rifts: 1 }, REALM_CAST, { total: [6, 9], quota: { weather: [1, 1], calamity: [1, 2], sky: [1, 2], beasts: [1, 2], folk: [1, 2], moons: [1, 1] } });
      casts.add(cast.map((c) => c.def.id).sort().join(','));
    }
    expect(casts.size).toBeGreaterThanOrEqual(9);
  });

  it('replays identically for the same seed', () => {
    const a = run(90, 'replay');
    const b = run(90, 'replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});

describe('leylines ink (headless)', { timeout: 180_000 }, () => {
  it('the orders grow lines and hold wells', () => {
    const r = run(150, 'i4', { style: 'ink' });
    expect(r.threw).toBeUndefined();
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.orders).toBeGreaterThanOrEqual(2);
    expect(last.held).toBeGreaterThan(last.wells * 0.5);
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
});

describe('leylines classic (headless)', { timeout: 120_000 }, () => {
  it('still runs', () => {
    const r = run(300, 'l3', { style: 'classic' });
    expect(r.threw).toBeUndefined();
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['tower', 'duel']) expect(types, t).toContain(t);
  });
});
