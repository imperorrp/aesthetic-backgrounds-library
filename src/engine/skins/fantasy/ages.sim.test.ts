// @vitest-environment node
/**
 * Ages, sim-only on the headless host: centuries in seconds. Checks it runs clean, that
 * history has its beats (towns founded, wars, falls, eras), and that a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'ages', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('ages (headless)', { timeout: 60_000 }, () => {
  it('a long history: towns founded and grown, wars and peace, towns taken, eras turning', () => {
    const r = run(420);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['founded', 'war', 'siege', 'captured', 'peace', 'era']) expect(types, t).toContain(t);
  });

  it('crowns pass, trade moves, wonders take decades, and the age keeps its history', () => {
    const r = run(600);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['succession', 'trade', 'wonderbegun', 'wonder']) expect(types, t).toContain(t);
    expect(r.samples.some((s) => (s.counts.caravans ?? 0) > 0)).toBe(true);
    // A wonder is begun well before it stands.
    const begun = r.log.find((e) => e.type === 'wonderbegun')!;
    const done = r.log.find((e) => e.type === 'wonder')!;
    expect(done.t - begun.t).toBeGreaterThan(10);
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'replay');
    const b = run(120, 'replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
