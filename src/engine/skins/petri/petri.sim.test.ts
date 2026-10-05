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

  it('cells eat and starve, the hunters hunt, and a contamination is sterilized', () => {
    const r = run(600);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['hunt', 'contamination', 'sterilize', 'refocus']) expect(types, t).toContain(t);
    // Some die where the food runs out, but the dish never empties.
    const dead = r.samples.map((s) => s.counts.dead);
    expect(Math.max(...dead)).toBeGreaterThan(0);
    expect(r.samples[r.samples.length - 1].counts.organisms).toBeGreaterThan(0);
  });

  it('a Lenia culture: Orbia glide, meet, and are inoculated again', () => {
    const r = run(240, 'orion-7', { medium: 'lenia' });
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['emerge', 'drop']) expect(types, t).toContain(t);
    expect(types.has('engulf') || types.has('dissolve')).toBe(true);
    expect(r.samples.some((s) => s.counts.creatures > 0)).toBe(true);
  });

  it('replays identically for the same seed, in either medium', () => {
    for (const medium of ['particles', 'lenia']) {
      const a = run(40, 'replay', { medium });
      const b = run(40, 'replay', { medium });
      expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
    }
  });
});
