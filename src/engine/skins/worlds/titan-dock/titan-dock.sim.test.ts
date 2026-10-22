// @vitest-environment node
/**
 * Titan Dock against the bar, headless: it runs and keeps happening, a breach comes in the first
 * minutes and is fought, seeds differ (setting and cast), a phone works, a touch is answered on
 * a mech, on the water and not in the sky, and a seed replays.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { TITAN_DOCK_SCHEMA } from './schema';
import { createTitanDock } from './sim';

const skin: BackgroundSkin = { id: 'titan-dock-test', schema: TITAN_DOCK_SCHEMA, mount };
const run = (seconds: number, seed = 'dock-1', width = 1280, height = 800, options?: Record<string, unknown>) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30, options });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say');

describe('titan dock (headless)', { timeout: 180_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // The round goes round: a breach, a monster surfaces, a mech is dropped into the surf.
    const kinds = new Set(ev.map((e) => e.type));
    for (const k of ['alarm', 'surface', 'launch', 'drop']) expect(kinds.has(k)).toBe(true);
  });

  it('draws different settings and casts for different seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((s) => createTitanDock(`dock-${s}`, 1280, 800, { traffic: 1 }));
    expect(new Set(worlds.map((w) => w.castIds.join(','))).size).toBeGreaterThan(4);
    expect(new Set(worlds.map((w) => w.setting)).size).toBeGreaterThan(2);
  });

  it('fits a phone, and the map view runs the same sim', () => {
    const r = run(120, 'dock-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.mechs).toBeGreaterThan(0);
    const m = run(120, 'dock-phone', 390, 844, { view: 'map' });
    expect(m.threw).toBeUndefined();
    expect(m.log.map((e) => e.text)).toEqual(r.log.map((e) => e.text));
  });

  it('answers a touch on a mech and on the water, and not in the sky', () => {
    const w = createTitanDock('dock-touch', 1280, 800, { traffic: 1 });
    w.step(1);
    const m = w.mechs[0];
    expect(w.nudge(m.x, w.standY - m.H * 0.5)).toMatch(/SYSTEMS CHECK/);
    w.step(4);
    expect(w.nudge(w.GW * 0.75, (w.HY + w.NY) / 2)).toMatch(/FLARE/);
    w.step(4);
    expect(w.nudge(w.GW * 0.75, 5)).toBeNull();
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'dock-replay');
    const b = run(120, 'dock-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
