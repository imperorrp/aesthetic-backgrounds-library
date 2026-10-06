// @vitest-environment node
/**
 * Deephold's kingdom (the default style), sim-only on the headless host: the clans dig,
 * build, trade, and go down, and never stop; something happens within the first minute;
 * the holds go to war, cut highways, carve faces; each thing below wakes when they dig near
 * it; every mountain runs; a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'deephold', seconds, seed, options, sampleEvery: 60 });

beforeAll(async () => {
  await prepareSkins();
});

describe('deephold kingdom (headless)', { timeout: 300_000 }, () => {
  it('the clans dig, build, trade, and keep building', () => {
    const r = run(1200, 'k3');
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['strike', 'deeper', 'room', 'caravan', 'migrants', 'grandwork', 'highway']) expect(types, t).toContain(t);
    const counts = r.samples.map((s) => s.counts);
    const last = counts[counts.length - 1];
    expect(last.holds).toBeGreaterThanOrEqual(2);
    expect(last.deepest).toBeGreaterThanOrEqual(6);
    // Never stagnates: rooms keep coming through the last ten minutes.
    const mid = counts[Math.floor(counts.length / 2)];
    expect(last.rooms).toBeGreaterThan(mid.rooms + 10);
    // Something to see early.
    expect(r.log.filter((e) => e.t < 60 && e.type !== 'say' && e.type !== 'strike').length).toBeGreaterThan(3);
  });

  it('each thing below wakes when they dig near it', () => {
    for (const [below, types] of [['lich', ['lich']], ['engine', ['engine']], ['hive', ['hive']], ['sleeper', ['sleeperwakes']]] as [string, string[]][]) {
      const r = run(1500, `kb-${below}`, { below });
      expect(r.threw, below).toBeUndefined();
      const seen = new Set(r.log.map((e) => e.type));
      expect(types.some((t) => seen.has(t)), below).toBe(true);
    }
  });

  it('every mountain runs, with two to four holds', () => {
    for (const [k, mountain] of ['iron', 'crystal', 'ember', 'drowned', 'frost'].entries()) {
      const r = run(240, `kmt-${mountain}`, { mountain, holds: String(2 + (k % 3)) });
      expect(r.threw, mountain).toBeUndefined();
      const last = r.samples[r.samples.length - 1].counts;
      expect(last.holds, mountain).toBe(2 + (k % 3));
      expect(last.dwarves, mountain).toBeGreaterThan(20);
    }
  });

  it('replays identically for the same seed', () => {
    const a = run(150, 'replay', { hazards: 2 });
    const b = run(150, 'replay', { hazards: 2 });
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
