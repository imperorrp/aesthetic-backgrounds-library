// @vitest-environment node
/**
 * Deephold, sim-only on the headless host: the clan digs, builds, and goes down; seeds draw
 * different casts; each kind of thing below wakes when they dig near it; every mountain runs;
 * and a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';
import { compose, createGenome } from '../../kit';
import { CAST_RULE, DEEP_CAST } from './deep-cast';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'deephold', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('deephold (headless)', { timeout: 240_000 }, () => {
  it('the clan digs, builds, trades, and goes deep', () => {
    const r = run(900, 'c3');
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['strike', 'deeper', 'room', 'caravan']) expect(types, t).toContain(t);
    expect(r.samples[r.samples.length - 1].counts.deeps).toBeGreaterThanOrEqual(5);
  });

  it('seeds draw different casts, and "below" is sometimes nothing', () => {
    const casts = new Set<string>();
    const below = new Set<string>();
    for (let k = 0; k < 16; k++) {
      const cast = compose(createGenome(`cast-${k}`, 'deep-cast'), { mountain: 'iron', hazards: 1, below: 'any' }, DEEP_CAST, CAST_RULE);
      casts.add(cast.map((c) => c.def.id).sort().join(','));
      below.add(cast.find((c) => c.def.tags.includes('below'))!.def.id);
      expect(cast.filter((c) => c.def.tags.includes('below')).length).toBe(1);
    }
    expect(casts.size).toBe(16);
    expect(below.size).toBeGreaterThanOrEqual(4);
  });

  it('each thing below wakes when they dig near it', () => {
    const woke: Record<string, string[]> = { lich: ['lich'], engine: ['engine'], hive: ['hive'] };
    for (const [b, types] of Object.entries(woke)) {
      const r = run(1300, `b-${b}`, { below: b });
      expect(r.threw, b).toBeUndefined();
      const seen = new Set(r.log.map((e) => e.type));
      expect(types.some((t) => seen.has(t)), b).toBe(true);
    }
  });

  it('every mountain runs', () => {
    for (const mountain of ['iron', 'crystal', 'ember', 'drowned', 'frost']) {
      const r = run(240, `mt-${mountain}`, { mountain });
      expect(r.threw, mountain).toBeUndefined();
      expect(r.samples[r.samples.length - 1].counts.dwarves, mountain).toBeGreaterThan(0);
    }
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'replay', { hazards: 2 });
    const b = run(120, 'replay', { hazards: 2 });
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
