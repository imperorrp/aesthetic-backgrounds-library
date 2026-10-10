// @vitest-environment node
/**
 * Silent Running against the bar, headless: it runs and keeps happening, the hunt plays out
 * (torpedoes, pings, charges), seeds differ, a phone gets a whole sea, a buoy is answered on
 * the water and not on land, and a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../../dev/headless';
import { createSea } from './sim';

const run = (seconds: number, seed = 'sr-1', width = 1280, height = 800) => runHeadless({ skin: 'silent-running', seconds, seed, width, height, sampleEvery: 30 });

beforeAll(async () => {
  await prepareSkins();
});

describe('silent running (headless)', { timeout: 300_000 }, () => {
  it('runs, keeps happening, and the hunt plays out', () => {
    const r = run(900);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const ev = r.log.filter((e) => e.type && e.type !== 'say');
    const types = new Set(ev.map((e) => e.type));
    for (const t of ['active', 'convoy', 'torpedo']) expect(types, t).toContain(t);
    expect(ev.filter((e) => e.t < 30).length).toBeGreaterThan(0);
    const times = [0, ...ev.map((e) => e.t), 900];
    expect(Math.max(...times.slice(1).map((t, i) => t - times[i]))).toBeLessThan(60);
    // Merchants keep sailing to the end.
    expect(r.samples[r.samples.length - 1].counts.merchants).toBeGreaterThan(0);
  });

  it('draws different seas and casts for different seeds', () => {
    const seas = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createSea(`sr-${s}`, 1280, 800, { traffic: 1 }));
    expect(new Set(seas.map((w) => w.castIds.join(','))).size).toBeGreaterThan(2);
    expect(new Set(seas.map((w) => w.ports.map((p) => p.name).join(','))).size).toBeGreaterThan(3);
    for (const w of seas) expect(w.lanes.length).toBeGreaterThan(0);
  });

  it('fits a phone', () => {
    const r = run(180, 'sr-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.log.filter((e) => e.type && e.type !== 'say').length).toBeGreaterThan(5);
  });

  it('answers a touch on the water, not on land', () => {
    const w = createSea('sr-touch', 1280, 800, { traffic: 1 });
    w.step(1);
    let sea: [number, number] | null = null;
    let land: [number, number] | null = null;
    for (let y = 20; y < w.GH && (!sea || !land); y += 23)
      for (let x = 20; x < w.GW && (!sea || !land); x += 29) {
        if (w.landAt(x, y)) land ??= [x, y];
        else sea ??= [x, y];
      }
    if (land) expect(w.nudge(land[0], land[1])).toBeNull();
    expect(w.nudge(sea![0], sea![1])).toMatch(/BUOY/);
  });

  it('replays identically for the same seed', () => {
    const a = run(150, 'sr-replay');
    const b = run(150, 'sr-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
