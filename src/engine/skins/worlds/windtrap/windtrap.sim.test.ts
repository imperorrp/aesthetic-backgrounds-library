// @vitest-environment node
/**
 * Windtrap against the bar, headless: it runs and keeps happening, seeds differ, a phone works,
 * a touch in a chamber is answered, and a seed replays.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { WINDTRAP_SCHEMA } from './schema';
import { createWindtrap } from './sim';

const skin: BackgroundSkin = { id: 'windtrap-test', schema: WINDTRAP_SCHEMA, mount };
const run = (seconds: number, seed = 'hold-1', width = 1280, height = 800) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30 });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say');

describe('windtrap (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    expect(r.samples[r.samples.length - 1].counts.people).toBeGreaterThan(5);
  });

  it('draws a different cast for different seeds', () => {
    const casts = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createWindtrap(`hold-${s}`, 1280, 800, { people: 1 }).castIds.join(',')));
    expect(casts.size).toBeGreaterThan(2);
  });

  it('fits a phone', () => {
    const r = run(120, 'hold-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.chambers).toBeGreaterThan(5);
  });

  it('answers a touch in a chamber', () => {
    const w = createWindtrap('hold-touch', 1280, 800, { people: 1 });
    w.step(1);
    const hall = w.chambers.find((c) => c.kind === 'hall')!;
    expect(w.nudge(hall.x + hall.w / 2, hall.y + hall.h / 2)).toMatch(/HALL/);
    w.step(4);
    expect(w.nudge(w.side > 0 ? w.cx1 - 5 : w.cx0 + 5, 5)).toBeNull();
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'hold-replay');
    const b = run(120, 'hold-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
