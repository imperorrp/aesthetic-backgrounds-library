// @vitest-environment node
/**
 * Undercity, sim-only on the headless host: minutes of city in well under a second or two.
 * Checks it runs clean, replays exactly, and that the net actually gets used.
 */
import { describe, expect, it } from 'vitest';
import { runHeadless } from '../../../dev/headless';

const run = (seconds: number, seed = 'neon-3') => runHeadless({ skin: 'undercity', seconds, seed });

describe('undercity (headless)', { timeout: 30_000 }, () => {
  it('runs four minutes without problems, and the net is busy', () => {
    const r = run(240);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['train', 'jackin', 'ice']) expect(types, t).toContain(t);
    expect(types.has('breach') || types.has('flatline')).toBe(true);
  });

  it('replays identically for the same seed', () => {
    const a = run(60, 'replay');
    const b = run(60, 'replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
