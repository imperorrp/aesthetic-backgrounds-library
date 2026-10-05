// @vitest-environment node
/**
 * The War Table, sim-only on the headless host. Checks that campaigns run clean and end
 * in a sealed peace, that towns change hands, and that a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'war-table', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('war table (headless)', { timeout: 60_000 }, () => {
  it('campaigns: orders, battles, sieges, towns taken, winters, a peace, the next campaign', () => {
    const r = run(300);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['order', 'battle', 'siege', 'captured', 'winter', 'peace', 'campaign']) expect(types, t).toContain(t);
  });

  it('dispatches ride out; some are taken on the road, and a few are forged', () => {
    const r = run(900);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['dispatch', 'intercepted', 'forgery']) expect(types, t).toContain(t);
  });

  it('three realms play as well as two', () => {
    const r = run(150, 'three', { realms: 3 });
    expect(r.threw).toBeUndefined();
    expect(new Set(r.log.map((e) => e.type))).toContain('battle');
  });

  it('replays identically for the same seed', () => {
    const a = run(90, 'replay');
    const b = run(90, 'replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
