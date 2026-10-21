// @vitest-environment node
/**
 * Sandsea against the bar, headless: it runs and keeps happening, seeds differ, a phone works,
 * a touch on the sand is answered, and a seed replays.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { SANDSEA_SCHEMA } from './schema';
import { createSandsea } from './sim';

const skin: BackgroundSkin = { id: 'sandsea-test', schema: SANDSEA_SCHEMA, mount };
const run = (seconds: number, seed = 'sand-1', width = 1280, height = 800) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30 });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say');

describe('sandsea (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // The harvest goes round: spice comes in.
    expect(r.samples[r.samples.length - 1].counts.tonnes).toBeGreaterThan(0);
  });

  it('draws a different cast for different seeds', () => {
    const casts = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createSandsea(`sand-${s}`, 1280, 800, { traffic: 1 }).castIds.join(',')));
    expect(casts.size).toBeGreaterThan(2);
  });

  it('fits a phone', () => {
    const r = run(120, 'sand-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.patches).toBeGreaterThan(0);
  });

  it('answers a touch on the sand, and not on the sky', () => {
    const w = createSandsea('sand-touch', 1280, 800, { traffic: 1 });
    w.step(1);
    expect(w.nudge(w.GW / 2, (w.HY + w.NY) / 2)).toMatch(/THUMPER/);
    w.step(4);
    expect(w.nudge(w.GW / 2, 5)).toBeNull();
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'sand-replay');
    const b = run(120, 'sand-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
