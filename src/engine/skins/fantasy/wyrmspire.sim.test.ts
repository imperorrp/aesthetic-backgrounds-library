// @vitest-environment node
/**
 * Wyrmspire, sim-only on the headless host. The living vale (the default): the valley is busy
 * from the first seconds; drakes hunt and harry, the wyrm raids, beacons are lit and roofs
 * burn and are rebuilt; the valley keeps building; each land brings its own breath; casts
 * differ; a seed replays. The first version still runs as `style: 'classic'`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';
import { compose, createGenome } from '../../kit';
import { VALE_CAST } from './vale/sim';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'wyrmspire', seconds, seed, options, sampleEvery: 10 });

beforeAll(async () => {
  await prepareSkins();
});

describe('wyrmspire vale (headless)', { timeout: 240_000 }, () => {
  it('busy from the start; the wyrm and its brood raid; the valley rebuilds and keeps building', () => {
    const r = run(900, 'orion-7');
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const first = r.samples[1].counts;
    expect(first.working).toBeGreaterThan(40);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['timber', 'house', 'beacon', 'bell', 'taken']) expect(types, t).toContain(t);
    expect(['raid', 'harass'].some((t) => types.has(t))).toBe(true);
    // Something notable in the first minute.
    expect(r.log.some((e) => e.t < 60 && e.type === 'say')).toBe(true);
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.people).toBeGreaterThan(60);
    expect(last.buildings).toBeGreaterThan(40);
  });

  it('each land brings its own breath', () => {
    const breaths = new Set<string>();
    for (const valley of ['alpine', 'canyon', 'fen', 'ashland', 'fjord']) {
      const r = run(500, `land-${valley}`, { valley, wrath: 3 });
      expect(r.threw, valley).toBeUndefined();
      for (const e of r.log) if (e.type?.endsWith('breath') || e.type === 'dragonfire') breaths.add(e.type);
    }
    expect(breaths.size).toBeGreaterThanOrEqual(2);
  });

  it('seeds draw different casts', () => {
    const casts = new Set<string>();
    for (let k = 0; k < 12; k++) {
      const cast = compose(createGenome(`cast-${k}`, 'vale'), { biome: 'alpine', wrath: 1 }, VALE_CAST, { total: [6, 9], quota: { brood: [1, 1], foe: [0, 2], pageant: [1, 2], trade: [1, 2], nature: [0, 1], help: [1, 1] } });
      casts.add(cast.map((c) => c.def.id).sort().join(','));
    }
    expect(casts.size).toBeGreaterThanOrEqual(9);
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'replay', { wrath: 3 });
    const b = run(120, 'replay', { wrath: 3 });
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});

describe('wyrmspire classic (headless)', { timeout: 120_000 }, () => {
  it('still runs: the wyrm hunts, the valley has seasons and a lord', () => {
    const r = run(600, 'v-fjord', { valley: 'fjord', style: 'classic' });
    expect(r.threw).toBeUndefined();
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['hunt', 'dragon', 'policy']) expect(types, t).toContain(t);
  });
});
