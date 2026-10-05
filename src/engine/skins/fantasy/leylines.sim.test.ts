// @vitest-environment node
/**
 * Leylines, sim-only on the headless host: power flows, the orders build and fight along
 * the lines, storms cross, the moons converge, rifts open and are closed; every land runs;
 * and a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'leylines', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('leylines (headless)', { timeout: 120_000 }, () => {
  it('the orders build and duel; storms, the convergence, and a rift come and go', () => {
    const r = run(900, 'l3');
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['tower', 'duel', 'storm', 'convergence']) expect(types, t).toContain(t);
    expect(['towerfalls', 'turned'].some((t) => types.has(t))).toBe(true);
    expect(types.has('rift') && types.has('riftclosed')).toBe(true);
  });

  it('every land runs', () => {
    for (const land of ['isles', 'steppe', 'forest', 'desert', 'tundra']) {
      const r = run(200, `land-${land}`, { land });
      expect(r.threw, land).toBeUndefined();
      expect(r.samples[r.samples.length - 1].counts.towers, land).toBeGreaterThan(2);
    }
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'replay', { storms: 2, rifts: 2 });
    const b = run(120, 'replay', { storms: 2, rifts: 2 });
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
