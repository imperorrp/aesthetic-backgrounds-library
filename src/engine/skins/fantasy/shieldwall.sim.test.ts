// @vitest-environment node
/**
 * Shieldwall, sim-only on the headless host: a war's worth of battles in seconds. Checks it
 * runs clean, that battles have their beats and end, that a dragon can come and be slain,
 * and that a seed replays exactly in both views.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'shieldwall', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('shieldwall (headless)', { timeout: 60_000 }, () => {
  it('fights battles to an end: volleys, the lines meeting, charges, a victory, the next battle', () => {
    const r = run(260);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['volley', 'impact', 'clash', 'charge', 'victory', 'newbattle']) expect(types, t).toContain(t);
  });

  it('a dragon comes when called for, and can be brought down', () => {
    const seen = new Set<string>();
    const done = () => seen.has('dragon') && (seen.has('dragonslain') || seen.has('dragonleaves'));
    // Stop at the first seed that shows both: each run is a few hundred seconds of a war.
    for (const seed of ['d1', 'd2', 'd3', 'd4']) {
      for (const e of run(200, seed, { dragons: 3 }).log) seen.add(e.type ?? '');
      if (done()) break;
    }
    expect(seen).toContain('dragon');
    expect(seen.has('dragonslain') || seen.has('dragonleaves')).toBe(true);
  }, 150_000);

  it('replays identically for the same seed, from either view', () => {
    for (const view of ['side', 'above']) {
      const a = run(70, 'replay', { view });
      const b = run(70, 'replay', { view });
      expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
    }
  });
});
