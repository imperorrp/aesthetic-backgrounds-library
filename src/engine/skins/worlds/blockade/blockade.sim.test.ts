// @vitest-environment node
/**
 * Blockade against the bar, headless: it runs and keeps happening, seeds differ, a phone works,
 * a touch on the planet and in space is answered, a seed replays, and the map view runs the same sim.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { BLOCKADE_SCHEMA } from './schema';
import { createBlockade } from './sim';

const skin: BackgroundSkin = { id: 'blockade-test', schema: BLOCKADE_SCHEMA, mount };
const run = (seconds: number, seed = 'blk-1', width = 1280, height = 800, options?: Record<string, unknown>) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30, options });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say');

describe('blockade (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // The line holds: capital ships on station at the end, and traffic has gone down to the planet.
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.capitals).toBeGreaterThan(0);
    expect(last.landed).toBeGreaterThan(0);
  });

  it('draws a different world for different seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createBlockade(`blk-${s}`, 1280, 800, { traffic: 1 }));
    expect(new Set(worlds.map((w) => w.castIds.join(','))).size).toBeGreaterThan(2);
    expect(new Set(worlds.map((w) => w.planetLook.kind)).size).toBeGreaterThan(1);
  });

  it('fits a phone', () => {
    const r = run(120, 'blk-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.ships).toBeGreaterThan(0);
  });

  it('answers a touch: a shuttle down to the planet, a patrol out into space', () => {
    const w = createBlockade('blk-touch', 1280, 800, { traffic: 1 });
    w.step(1);
    expect(w.nudge(w.planet.cx, w.limbY(w.planet.cx) + 60)).toMatch(/CLEARED DOWN/);
    w.step(4);
    expect(w.nudge(w.GW * 0.3, w.GH * 0.2)).toMatch(/INVESTIGATE|CHECK/);
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'blk-replay');
    const b = run(120, 'blk-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });

  it('runs the same sim under the map view', () => {
    const a = run(90, 'blk-map');
    const b = run(90, 'blk-map', 1280, 800, { view: 'map' });
    expect(b.threw).toBeUndefined();
    expect(a.log.map((e) => e.text)).toEqual(b.log.map((e) => e.text));
  });
});
