// @vitest-environment node
/**
 * Nudges: a visitor touches a world and the nearest thing answers. Each flagship world
 * answers in its own words, and only once every few seconds.
 */
import { describe, expect, it } from 'vitest';
import { createNoise2D } from '../../noise';
import { forkRng } from '../../rng';
import { createKingdom } from './kingdom/sim';
import { createRealm } from './realm/sim';
import { createVale } from './vale/sim';

const run = (w: { step(dt: number): void }, seconds: number) => {
  for (let i = 0; i < seconds * 30; i++) w.step(1 / 30);
};

describe('nudges', () => {
  it('Wyrmspire: a village builds, the town feasts, and the valley waits a moment between', () => {
    const w = createVale('nudge-vale', 1280, 800, { valley: 'any', wrath: 1, knights: 4, villages: 3 });
    run(w, 5);
    const village = w.settlements.find((s) => s.kind === 'village')!;
    const said = w.nudge(village.x, w.groundY(village.z));
    expect(said).toMatch(/GO OUT FOR WOOD/);
    expect(w.nudge(village.x, w.groundY(village.z))).toBeNull();
    run(w, 5);
    const town = w.settlements.find((s) => s.kind === 'town')!;
    expect(w.nudge(town.x, w.groundY(town.z))).toMatch(/RING FOR A FEAST/);
    expect(w.festival).toBeGreaterThan(w.t);
  });

  it('Deephold: traders on the slopes, a feast in the rooms, a vein in the rock', () => {
    const k = createKingdom('nudge-deep', 1280, 800, { mountain: 'iron', holds: 2, hazards: 1, below: 'any', scale: 1 });
    run(k, 60);
    const h = k.holds[0];
    const c = h.gateC;
    expect(k.nudge(c * k.CELL, (k.surface[c] - 4) * k.CELL)).toMatch(/TRADERS SET OUT/);
    run(k, 5);
    // Plain rock well below the surface, away from the shaft.
    let rock = -1;
    for (let i = 0; i < k.mat.length && rock < 0; i++) {
      const cc = i % k.cols;
      const rr = Math.floor(i / k.cols);
      if (rr > k.surface[cc] + 8 && k.mat[i] >= 4 && k.mat[i] <= 6 && k.roomAt[i] < 0) rock = i;
    }
    expect(rock).toBeGreaterThanOrEqual(0);
    const said = k.nudge(k.cellX(rock), k.cellY(rock) - k.CELL / 2);
    expect(said).toMatch(/ROCK/);
    expect(k.mat[rock]).toBeGreaterThanOrEqual(9);
  });

  it('Leylines: a village builds a cottage, and open land answers', () => {
    const w = createRealm('nudge-ley', 1280, 800, { land: 'any', orders: 3, storms: 1, rifts: 1, scale: 1 }, createNoise2D(forkRng('nudge-ley', 'noise')));
    run(w, 5);
    const v = w.sites.find((s) => s.kind === 'village' && !s.tower);
    if (v) {
      const before = v.cottages.length;
      const said = w.nudge(v.x, v.y);
      expect(said).not.toBeNull();
      if (said?.includes('COTTAGE')) expect(v.cottages.length).toBe(before + 1);
      run(w, 5);
    }
    // Somewhere on dry land far from any site.
    let spot: [number, number] | null = null;
    for (let y = 60; y < w.GH - 60 && !spot; y += 37)
      for (let x = 60; x < w.GW - 60 && !spot; x += 41)
        if (!w.water[w.cellAt(x, y)] && w.sites.every((s) => Math.hypot(s.x - x, s.y - y) > 200)) spot = [x, y];
    if (spot) expect(w.nudge(spot[0], spot[1])).toMatch(/STORM|SHIMMERS/);
  });
});
