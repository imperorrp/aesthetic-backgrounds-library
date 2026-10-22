// @vitest-environment node
/**
 * War Rig against the bar, headless: it runs and keeps happening, seeds differ, a phone works,
 * a touch on the road is answered (and not one in the sky), and a seed replays.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { WAR_RIG_SCHEMA } from './schema';
import { createWarRig } from './sim';

const skin: BackgroundSkin = { id: 'war-rig-test', schema: WAR_RIG_SCHEMA, mount };
const run = (seconds: number, seed = 'rig-1', width = 1280, height = 800, options?: unknown) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30, options });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say' && e.type !== 'shout');

describe('war-rig (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // The road runs on, and the war party pays for it.
    const last = r.samples[r.samples.length - 1].counts;
    expect(last.km).toBeGreaterThan(r.samples[0].counts.km);
    expect(last.wrecked).toBeGreaterThan(0);
  });

  it('draws a different cast and road for different seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createWarRig(`rig-${s}`, 1280, 800, { traffic: 1 }));
    expect(new Set(worlds.map((w) => w.castIds.join(','))).size).toBeGreaterThan(2);
    expect(new Set(worlds.map((w) => `${w.grade}:${w.flip}:${w.rig.variant}`)).size).toBeGreaterThan(2);
  });

  it('tells a story: the war party stalks, harries, assaults and falls back', () => {
    const w = createWarRig('rig-story', 1280, 800, { traffic: 1 });
    const seen = new Set<string>();
    for (let i = 0; i < 30 * 900; i++) {
      w.step(1 / 30);
      seen.add(w.phase);
    }
    expect(seen.has('assault')).toBe(true);
    expect(seen.has('aftermath')).toBe(true);
    expect(w.rig.marks.length).toBeGreaterThan(0);
  });

  it('fits a phone, in both views', () => {
    for (const view of ['scene', 'map']) {
      const r = run(120, 'rig-phone', 390, 844, { view });
      expect(r.threw).toBeUndefined();
      expect(r.samples[r.samples.length - 1].counts.pursuers).toBeGreaterThan(0);
    }
  });

  it('answers a touch on the road, and not on the sky', () => {
    const w = createWarRig('rig-touch', 1280, 800, { traffic: 1 });
    for (let i = 0; i < 30 * 20; i++) w.step(1 / 30);
    expect(w.nudge(w.GW / 2, w.yOf(0.6))).toMatch(/LANCER|FLARE/);
    w.step(3);
    expect(w.nudge(w.GW / 2, 5)).toBeNull();
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'rig-replay');
    const b = run(120, 'rig-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
