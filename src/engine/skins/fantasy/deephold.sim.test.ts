// @vitest-environment node
/**
 * Deephold, sim-only on the headless host: the clan digs, builds, and goes down; the rock
 * answers (floods, cave-ins, caverns); what sleeps below stirs; every mountain runs; and a
 * seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'deephold', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('deephold (headless)', { timeout: 180_000 }, () => {
  it('the clan digs, builds, trades, and goes deep, and the rock answers', () => {
    const r = run(1000, 'm-frost', { mountain: 'frost' });
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['strike', 'deeper', 'room', 'caravan']) expect(types, t).toContain(t);
    expect(['flood', 'cavein', 'firedamp', 'magma', 'cavern', 'ruin'].some((t) => types.has(t))).toBe(true);
    expect(['stir', 'sleeperwakes'].some((t) => types.has(t))).toBe(true);
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.deeps).toBeGreaterThanOrEqual(5);
  });

  it('every mountain runs', () => {
    for (const mountain of ['iron', 'crystal', 'ember', 'drowned']) {
      const r = run(300, `mt-${mountain}`, { mountain });
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
