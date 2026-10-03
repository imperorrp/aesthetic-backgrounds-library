// @vitest-environment node
/** The renderer-agnostic sim modules: view, bus, director, spatial hash. Pure logic, no DOM. */
import { describe, expect, it } from 'vitest';
import { createView, MAX_ZOOM } from './view';
import { createBus } from './bus';
import { createDirector } from './director';
import { createSpatialHash } from './spatial';
import { createRng } from '../rng';

describe('view', () => {
  it('is the classic framing at rest: screen x = x - left, screen y = y', () => {
    const v = createView(1000, 600);
    v.setBase(300 + 500, 300); // the old camera had left = 300
    expect(v.sx(450)).toBeCloseTo(150);
    expect(v.sy(42)).toBeCloseTo(42);
    expect(v.scale()).toBe(1);
  });

  it('projects depth: far points are smaller and closer to the center', () => {
    const v = createView(1000, 600);
    expect(v.scale(1)).toBeCloseTo(0.5);
    expect(v.sx(v.x + 200, 1)).toBeCloseTo(500 + 100);
    expect(v.wx(v.sx(1234, 0.55), 0.55)).toBeCloseTo(1234);
    expect(v.wy(v.sy(-80, 1.1), 1.1)).toBeCloseTo(-80);
  });

  it('keeps the camera inside the base frame: zoom in only, no peeking past the edges', () => {
    const v = createView(1000, 600);
    v.setCamera(v.baseX + 5000, v.baseY, 0.5);
    expect(v.zoom).toBe(1);
    expect(v.x).toBe(v.baseX);
    v.setCamera(v.baseX + 5000, v.baseY - 5000, 99);
    expect(v.zoom).toBe(MAX_ZOOM);
    const b = v.bounds();
    const base = v.baseBounds();
    expect(b.left).toBeGreaterThanOrEqual(base.left - 1e-9);
    expect(b.right).toBeLessThanOrEqual(base.right + 1e-9);
    expect(b.top).toBeGreaterThanOrEqual(base.top - 1e-9);
  });
});

describe('bus', () => {
  it('stamps time, logs, notifies typed and wildcard listeners, and forgets old events', () => {
    let t = 0;
    const bus = createBus(() => t, 3);
    const seen: string[] = [];
    bus.on('raid', (e) => seen.push(`raid@${e.t}`));
    bus.on('*', (e) => seen.push(`*${e.type}`));
    for (const type of ['a', 'raid', 'b', 'c']) {
      t += 1;
      bus.emit({ type });
    }
    expect(seen).toEqual(['*a', 'raid@2', '*raid', '*b', '*c']);
    expect(bus.log.map((e) => e.type)).toEqual(['raid', 'b', 'c']);
    expect(bus.seq).toBe(4);
    expect(bus.since(3).map((e) => e.type)).toEqual(['b', 'c']);
  });

  it('survives a listener that emits in a loop', () => {
    const bus = createBus(() => 0);
    bus.on('ping', () => bus.emit({ type: 'ping' }));
    expect(() => bus.emit({ type: 'ping' })).not.toThrow();
  });
});

describe('director', () => {
  const run = (mode: 'steady' | 'director' | 'cinematic', events: { at: number; x: number; y: number; weight: number }[], seconds: number) => {
    const view = createView(1000, 600);
    let t = 0;
    const bus = createBus(() => t);
    const d = createDirector(view, bus, mode, createRng('dir'));
    let maxZoom = 1;
    let pending = [...events];
    for (let i = 0; i < seconds * 60; i++) {
      t = i / 60;
      for (const e of pending.filter((p) => p.at <= t)) bus.emit({ type: 'raid', ...e });
      pending = pending.filter((p) => p.at > t);
      d.update(1 / 60, t);
      maxZoom = Math.max(maxZoom, view.zoom);
    }
    return { view, maxZoom, d };
  };

  it('steady never moves', () => {
    const r = run('steady', [{ at: 1, x: 900, y: 500, weight: 1 }], 10);
    expect(r.maxZoom).toBe(1);
    expect(r.view.x).toBe(r.view.baseX);
  });

  it('leans in on a big event, then lets go', () => {
    const r = run('cinematic', [{ at: 1, x: 850, y: 450, weight: 1 }], 40);
    expect(r.maxZoom).toBeGreaterThan(1.2);
    expect(r.view.zoom).toBeLessThan(1.05);
  });

  it('ignores small events in director mode', () => {
    const r = run('director', [{ at: 1, x: 850, y: 450, weight: 0.2 }], 8);
    expect(r.maxZoom).toBeLessThan(1.01);
  });
});

describe('spatial hash', () => {
  it('finds exactly the items within the radius', () => {
    const grid = createSpatialHash<number>(50);
    const pts: [number, number][] = [];
    const rng = createRng('grid');
    for (let i = 0; i < 400; i++) pts.push([rng() * 1000 - 500, rng() * 1000 - 500]);
    pts.forEach(([x, y], i) => grid.insert(i, x, y));
    const found = grid.query(10, -20, 120).sort((a, b) => a - b);
    const brute = pts.map(([x, y], i) => [i, Math.hypot(x - 10, y + 20)] as const).filter(([, d]) => d <= 120).map(([i]) => i);
    expect(found).toEqual(brute);
  });
});
