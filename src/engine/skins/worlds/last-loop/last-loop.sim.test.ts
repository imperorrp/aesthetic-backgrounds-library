// @vitest-environment node
/**
 * Last Loop against the bar, headless: it runs and keeps happening, seeds differ, a phone works,
 * a touch is answered, a seed replays, and a loop ends in a supernova and begins again restored.
 */
import { describe, expect, it } from 'vitest';
import type { BackgroundSkin } from '../../../core/skin';
import { runHeadless } from '../../../../dev/headless';
import { mount } from './index';
import { LAST_LOOP_SCHEMA } from './schema';
import { createLastLoop } from './sim';

const skin: BackgroundSkin = { id: 'last-loop-test', schema: LAST_LOOP_SCHEMA, mount };
const run = (seconds: number, seed = 'loop-1', width = 1280, height = 800, options?: unknown) => runHeadless({ skin, seconds, seed, width, height, sampleEvery: 30, options });
const events = (log: { t: number; type?: string }[]) => log.filter((e) => e.type && e.type !== 'say');

describe('last loop (headless)', { timeout: 120_000 }, () => {
  it('runs, keeps happening, and is busy from the start', () => {
    const r = run(600);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = events(r.log);
    expect(ev.filter((e) => e.t < 60).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 600];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(120);
    // The ship flies, and the probe goes out.
    expect(ev.some((e) => e.type === 'launch')).toBe(true);
    expect(ev.some((e) => e.type === 'probe')).toBe(true);
  });

  it('ends a loop in a supernova and wakes again with everything restored', () => {
    const w = createLastLoop('loop-end', 1280, 800, { loop: 4, traffic: 1 });
    const first = w.loop;
    const types = new Set<string>();
    w.bus.on('*', (e) => types.add(e.type));
    let sawNova = false;
    let gone = 0;
    for (let i = 0; i < 30 * 250; i++) {
      w.step(1 / 30);
      if (w.phase === 'nova') sawNova = true;
      gone = Math.max(gone, w.bodies.filter((b) => b.gone).length);
    }
    expect(sawNova).toBe(true);
    expect(types.has('supernova')).toBe(true);
    expect(gone).toBeGreaterThan(5);
    expect(w.loop).toBe(first + 1);
    expect(w.bodies.every((b) => !b.gone)).toBe(true);
    expect(w.sand).toBeGreaterThan(0.9);
  });

  it('draws a different cast for different seeds', () => {
    const casts = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createLastLoop(`loop-${s}`, 1280, 800, { loop: 22, traffic: 1 }).castIds.join(',')));
    expect(casts.size).toBeGreaterThan(2);
  });

  it('fits a phone', () => {
    const r = run(120, 'loop-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.bodies).toBeGreaterThan(8);
  });

  it('answers a touch near a planet', () => {
    const w = createLastLoop('loop-touch', 1280, 800, { loop: 22, traffic: 1 });
    w.step(1);
    const o = w.bodies[w.ocean];
    expect(w.nudge(o.x, o.y)).toMatch(/course/i);
    w.step(0.5);
    expect(w.nudge(o.x, o.y)).toBeNull();
  });

  it('draws the same sim as a chart, headless', () => {
    const r = run(60, 'loop-map', 1280, 800, { view: 'map' });
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
  });

  it('replays identically for the same seed', () => {
    const a = run(120, 'loop-replay');
    const b = run(120, 'loop-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
