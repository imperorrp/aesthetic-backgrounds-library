// @vitest-environment node
/**
 * Long runs of every built-in universe, sim-only on the headless host: no canvas, no
 * jsdom, so a minute of simulation costs well under a second. These catch logic bugs
 * (crashes, NaN positions, empty fleets, runaway counts, failing mechanics) and check
 * that each universe actually does its thing.
 */
import { describe, expect, it } from 'vitest';
import { runHeadless } from '../../../dev/headless';

const run = (universe: string, seconds: number, seed = 'long-run') =>
  runHeadless({ skin: 'void-tactical', options: { universe }, seconds, seed });

// Minutes of simulation per test: fine alone, but slower when the whole suite runs in parallel.
describe('universes, long runs (headless)', { timeout: 30_000 }, () => {
  for (const universe of ['void', 'saltwind', 'choir', 'siege', 'hive', 'lastfleet', 'cradle']) {
    it(`${universe}: 90 s without problems`, () => {
      const r = run(universe, 90);
      expect(r.threw).toBeUndefined();
      expect(r.problems).toEqual([]);
      expect(r.log.length).toBeGreaterThan(20);
    });
  }

  it('replays identically for the same seed', () => {
    const a = run('siege', 30, 'replay');
    const b = run('siege', 30, 'replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });

  it('each universe tells its own story', () => {
    const said = (u: string) => run(u, 90).log.map((e) => e.text).join('\n');
    expect(said('saltwind')).toMatch(/CLAIM|ORE|DUST/);
    expect(said('siege')).toMatch(/OFFENSIVE|TARGET PAINTED|VOLLEY|FALLS TO/);
    expect(said('choir')).toMatch(/CHOIR SINGS|WISPS/);
    expect(said('hive')).toMatch(/SPORE BURST|PURGE FLEET/);
    expect(said('lastfleet')).toMatch(/STRAGGLER|BIRTH ABOARD|FUEL SKIM/);
    expect(said('cradle')).toMatch(/IGNITES|PLANETS FORMED/);
  });

  it('the new universes play out: the bloom spreads and is burned, the fleet is chased, stars live and die', () => {
    const hive = new Set(run('hive', 200).log.map((e) => e.type));
    for (const t of ['spores', 'purge', 'bloom']) expect(hive, t).toContain(t);
    const fleet = new Set(run('lastfleet', 200).log.map((e) => e.type));
    for (const t of ['straggler', 'pursuit', 'birth', 'skim']) expect(fleet, t).toContain(t);
    const cradle = new Set(run('cradle', 200).log.map((e) => e.type));
    for (const t of ['collapse', 'ignite', 'planets', 'life', 'civilization']) expect(cradle, t).toContain(t);
  });

  it('the siege fights over ground: offensives, spotting, a duel, a truce, cells changing hands', () => {
    const types = new Set(run('siege', 240).log.map((e) => e.type));
    for (const t of ['offensive', 'spot', 'bombard', 'duel', 'truce', 'truce-end']) expect(types, t).toContain(t);
    expect(types.has('front') || types.has('capture')).toBe(true);
  });
});
