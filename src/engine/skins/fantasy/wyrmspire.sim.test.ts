// @vitest-environment node
/**
 * Wyrmspire, sim-only on the headless host: the wyrm hunts and raids; the valley lives
 * through its seasons; the lord turns policy; quests go up the spire; each land has its own
 * wyrms; and a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'wyrmspire', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('wyrmspire (headless)', { timeout: 120_000 }, () => {
  it('the wyrm hunts and raids; the valley has seasons and a lord; someone goes up the spire', () => {
    const r = run(1200, 'v-fjord', { valley: 'fjord' });
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['hunt', 'wake', 'horn', 'dragon', 'rebuild', 'grows', 'harvest', 'winter', 'policy']) expect(types, t).toContain(t);
    expect(['hero', 'huntparty', 'binding', 'thieves'].some((t) => types.has(t))).toBe(true);
    expect(['driven', 'sated', 'dragonslain', 'wyrmflees', 'bound'].some((t) => types.has(t))).toBe(true);
  });

  it('each land brings its own wyrms and their breath', () => {
    const breaths = new Set<string>();
    for (const valley of ['alpine', 'canyon', 'fen', 'ashland']) {
      const r = run(400, `land-${valley}`, { valley, wrath: 3 });
      expect(r.threw).toBeUndefined();
      for (const e of r.log) if (e.type?.endsWith('breath') || e.type === 'dragonfire') breaths.add(e.type);
    }
    expect(breaths.size).toBeGreaterThanOrEqual(2);
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'replay', { wrath: 3 });
    const b = run(120, 'replay', { wrath: 3 });
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
