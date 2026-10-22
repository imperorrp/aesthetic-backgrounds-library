// @vitest-environment node
/**
 * Traction against the bar, headless: it runs and keeps happening, the hunt goes round, seeds
 * differ, a phone works, a touch on the plain is answered, the map view runs the same sim, and a
 * seed replays.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { TRACTION_SCHEMA } from './schema';
import { createTraction } from './sim';

const skin: BackgroundSkin = { id: 'traction-test', schema: TRACTION_SCHEMA, mount };
const run = (seconds: number, seed = 'traction-1', width = 1280, height = 800, options?: unknown) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30, options });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say');

describe('traction (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // The hunt goes round: towns are sighted, and some are eaten or get away.
    expect(r.log.some((e) => e.type === 'sighted')).toBe(true);
    expect(r.log.some((e) => e.type === 'chimney' || e.type === 'escaped')).toBe(true);
  });

  it('draws a different world for different seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createTraction(`traction-${s}`, 1280, 800, { traffic: 1 }));
    expect(new Set(worlds.map((w) => w.castIds.join(','))).size).toBeGreaterThan(2);
    expect(new Set(worlds.map((w) => `${w.land}:${w.mood}:${w.city.top}:${w.city.tiers}`)).size).toBeGreaterThan(3);
  });

  it('fits a phone', () => {
    const r = run(120, 'traction-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.towns).toBeGreaterThan(0);
  });

  it('runs the same sim as a survey chart', () => {
    const r = run(120, 'traction-map', 1280, 800, { view: 'map' });
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
  });

  it('answers a touch on the plain, and in the sky', () => {
    const w = createTraction('traction-touch', 1280, 800, { traffic: 1 });
    w.step(1);
    expect(w.nudge(w.GW * 0.1, w.NY - 4)).toMatch(/flare|lookouts/i);
    w.step(4);
    expect(w.nudge(w.GW / 2, 5)).toMatch(/crows/i);
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'traction-replay');
    const b = run(120, 'traction-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
