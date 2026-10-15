// @vitest-environment node
/**
 * Foundry against the bar, headless: it builds itself and keeps building, items flow, research
 * advances, mines move as the ore runs out, seeds differ, a phone gets a whole (smaller)
 * factory, a touch is answered, and a seed replays.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareSkins, runHeadless } from '../../../../dev/headless';
import { createFoundry } from './sim';

const run = (seconds: number, seed = 'fd-1', width = 1280, height = 800) => runHeadless({ skin: 'foundry', seconds, seed, width, height, sampleEvery: 60 });

beforeAll(async () => {
  await prepareSkins();
});

describe('foundry (headless)', { timeout: 300_000 }, () => {
  it('builds itself, keeps building, and researches', () => {
    const r = run(900);
    expect(r.threw).toBeUndefined();
    expect(r.problems).toEqual([]);
    const types = new Set(r.log.map((e) => e.type));
    for (const t of ['built', 'belt', 'research', 'firstgear', 'firstcircuit']) expect(types, t).toContain(t);
    const counts = r.samples.map((s) => s.counts);
    const last = counts[counts.length - 1];
    const mid = counts[Math.floor(counts.length / 2)];
    expect(last.machines).toBeGreaterThan(mid.machines);
    expect(last.items).toBeGreaterThan(50);
    expect(last.level).toBeGreaterThanOrEqual(3);
    // Something new is built through the last five minutes.
    expect(r.log.filter((e) => e.type === 'built' && e.t > 600).length).toBeGreaterThan(3);
  });

  it('draws a different land and cast for different seeds', () => {
    const ws = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => createFoundry(`fd-${s}`, 1280, 800, { pace: 1 }));
    expect(new Set(ws.map((w) => w.castIds.join(','))).size).toBeGreaterThan(2);
    expect(new Set(ws.map((w) => w.fields.map((f) => f.name).join(','))).size).toBe(6);
  });

  it('fits a phone', () => {
    const r = run(300, 'fd-phone', 390, 844);
    expect(r.threw).toBeUndefined();
    expect(r.samples[r.samples.length - 1].counts.machines).toBeGreaterThan(8);
  });

  it('answers a touch: overtime on a machine, a mine on a field', () => {
    const w = createFoundry('fd-touch', 1280, 800, { pace: 1 });
    for (let i = 0; i < 30 * 90; i++) w.step(1 / 30);
    const m = w.machines.find((x) => x.state === 'work' && x.kind === 'furnace')!;
    expect(w.nudge((m.c + 1) * w.T, (m.r + 1) * w.T)).toMatch(/OVERTIME/);
    for (let i = 0; i < 30 * 4; i++) w.step(1 / 30);
    const ore = w.oreType.findIndex((v, i) => v === 1 && w.occ[i] === -1);
    expect(w.nudge(((ore % w.cols) + 0.5) * w.T, (Math.floor(ore / w.cols) + 0.5) * w.T)).toMatch(/MINE/);
  });

  it('replays identically for the same seed', () => {
    const a = run(200, 'fd-replay');
    const b = run(200, 'fd-replay');
    expect(a.log.map((e) => `${e.t.toFixed(3)} ${e.text}`)).toEqual(b.log.map((e) => `${e.t.toFixed(3)} ${e.text}`));
  });
});
