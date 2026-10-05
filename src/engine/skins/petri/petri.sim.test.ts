// @vitest-environment node
/**
 * Petri, sim-only on the headless host. Checks that life organizes (organisms form,
 * divide, and engulf), that the technician works, and that a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'orion-7', options: Record<string, unknown> = {}) => runHeadless({ skin: 'petri', seconds, seed, options });

beforeAll(async () => {
  await prepareSkins();
});

describe('petri (headless)', { timeout: 60_000 }, () => {
  it('life organizes: organisms form, divide, swallow each other; the technician drops and shifts', () => {
    const r = run(200);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['emerge', 'division', 'engulf', 'drop', 'mutation']) expect(types, t).toContain(t);
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.organisms).toBeGreaterThan(2);
  });

  it('replays identically for the same seed', () => {
    const a = run(40, 'replay');
    const b = run(40, 'replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
