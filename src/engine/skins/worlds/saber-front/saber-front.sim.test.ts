// @vitest-environment node
/**
 * Saber Front against the bar, headless: it runs and keeps happening, seeds differ, a phone works,
 * a touch on the field is answered, and a seed replays.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { SABER_FRONT_SCHEMA } from './schema';
import { createSaberFront } from './sim';

const skin: BackgroundSkin = { id: 'saber-front-test', schema: SABER_FRONT_SCHEMA, mount };
const run = (seconds: number, seed = 'saber-1', width = 1280, height = 800) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30 });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say' && e.type !== 'radio');

describe('saber front (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // Both lines are still standing after ten minutes: the losses are made good.
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.ga).toBeGreaterThan(10);
    expect(last.cf).toBeGreaterThan(10);
    expect(last.fallen).toBeGreaterThan(50);
  });

  it('draws a different cast for different seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createSaberFront(`saber-${s}`, 1280, 800, { traffic: 1 }));
    expect(new Set(worlds.map((w) => w.castIds.join(','))).size).toBeGreaterThan(2);
    expect(new Set(worlds.map((w) => w.field)).size).toBeGreaterThan(1);
  });

  it('fits a phone', () => {
    const r = run(120, 'saber-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.ga).toBeGreaterThan(4);
    expect(last.cf).toBeGreaterThan(4);
  });

  it('answers a touch on the field, and not on the sky', () => {
    const w = createSaberFront('saber-touch', 1280, 800, { traffic: 1 });
    w.step(1);
    expect(w.nudge(w.GW / 2, (w.HY + w.NY) / 2)).toMatch(/STRIKE/);
    w.step(4);
    expect(w.nudge(w.GW / 2, 5)).toBeNull();
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'saber-replay');
    const b = run(120, 'saber-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
