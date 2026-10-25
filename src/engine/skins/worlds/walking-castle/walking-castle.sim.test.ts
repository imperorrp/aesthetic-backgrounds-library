// @vitest-environment node
/**
 * The Walking Castle against the bar, headless: it runs and keeps happening, seeds differ, a phone
 * works, a touch is answered (on the castle, on the grass, in the sky), a seed replays, and the map
 * view runs the same sim.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { WALKING_CASTLE_SCHEMA } from './schema';
import { createWalkingCastle } from './sim';

const skin: BackgroundSkin = { id: 'walking-castle-test', schema: WALKING_CASTLE_SCHEMA, mount };
const run = (seconds: number, seed = 'castle-1', width = 1280, height = 800, options?: unknown) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30, options });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say');

describe('walking-castle (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // It walks: miles and steps go up.
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.miles).toBeGreaterThan(0);
    expect(last.steps).toBeGreaterThan(50);
  });

  it('draws a different cast and country for different seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createWalkingCastle(`castle-${s}`, 1280, 800, { pace: 1 }));
    expect(new Set(worlds.map((w) => w.castIds.join(','))).size).toBeGreaterThan(2);
    expect(new Set(worlds.map((w) => `${w.homeland}:${w.season}`)).size).toBeGreaterThan(2);
    expect(new Set(worlds.map((w) => w.castle.name)).size).toBeGreaterThan(2);
  });

  it('fits a phone', () => {
    const r = run(120, 'castle-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.steps).toBeGreaterThan(0);
  });

  it('answers a touch: the door on the castle, larks on the grass, something in the sky', () => {
    const w = createWalkingCastle('castle-touch', 1280, 800, { pace: 1 });
    w.step(1);
    expect(w.nudge(w.castle.x, w.castle.y - 60 * w.castle.cs)).toMatch(/door|tickles/i);
    w.step(3);
    expect(w.nudge(w.castle.x + w.GW * 0.3, w.land.nearY(w.X + w.castle.dir * w.GW * 0.3) + 20)).toMatch(/grass/);
    w.step(3);
    expect(w.nudge(w.GW * 0.1, 10)).toBeTruthy();
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'castle-replay');
    const b = run(120, 'castle-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });

  it('runs the same sim on the map', () => {
    const a = run(90, 'castle-map', 1280, 800, { view: 'map' });
    const b = run(90, 'castle-map', 1280, 800, { view: 'scene' });
    expect(a.threw).toBeUndefined();
    expect(a.log.map((e) => e.text)).toEqual(b.log.map((e) => e.text));
  });
});
