// @vitest-environment node
/**
 * The template world against the bar, headless: it runs and never stops, something happens in
 * the first minute, seeds differ, a phone gets a whole (smaller) pond, a touch is answered,
 * and a seed replays. Copy these checks with the world; tighten them as the world grows.
 */
import { describe, expect, it } from 'vitest';
import { runHeadless } from '../../../../dev/headless';
import { createPond } from './sim';
import { templatePondSkin } from './index';

const run = (seconds: number, seed = 'pond-1', width = 1280, height = 800) => runHeadless({ skin: templatePondSkin, seconds, seed, width, height, sampleEvery: 30 });
const events = (log: { t: number; type?: string }[]) =>log.filter((e) => e.type && e.type !== 'say');

describe('the template pond (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    // Never a long quiet: the longest gap between events stays under two minutes.
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
  });

  it('draws a different cast for different seeds', () => {
    const casts = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createPond(`pond-${s}`, 1280, 800, { frogs: 6 }).castIds.join(',')));
    expect(casts.size).toBeGreaterThan(2);
  });

  it('fits a phone', () => {
    const r = run(120, 'pond-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.pads).toBeGreaterThan(4);
  });

  it('answers a touch on the water, and not on the bank', () => {
    const w = createPond('pond-touch', 1280, 800, { frogs: 6 });
    w.step(1);
    expect(w.nudge(w.cx, w.cy)).toMatch(/STONE|HERON/);
    w.step(4);
    expect(w.nudge(5, 5)).toBeNull();
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'pond-replay');
    const b = run(120, 'pond-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
