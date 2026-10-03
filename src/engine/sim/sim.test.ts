// @vitest-environment node
/** The renderer-agnostic sim modules: view, bus, director, spatial hash. Pure logic, no DOM. */
import { describe, expect, it } from 'vitest';
import { createView, MAX_ZOOM } from './view';
import { createBus } from './bus';
import { createDirector } from './director';
import { createSpatialHash } from './spatial';
import { createLedger } from './economy';
import { createNetwork } from './signals';
import { createField } from './fields';
import { createBody, seek, stepBody } from './bodies';
import { createHistory } from './history';
import { createRng } from '../rng';
import { createNoise2D } from '../noise';

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

describe('ledger', () => {
  it('produces, consumes, reports shortages, moves goods, and prices scarcity', () => {
    const l = createLedger(['ore', 'food']);
    l.add('mine', { cap: 100, makes: { ore: 2 } });
    l.add('dock', { cap: 100, uses: { food: 1 }, stock: { food: 10 } });
    for (let i = 0; i < 60; i++) l.tick(0.5);
    expect(l.get('mine')!.stock.ore).toBeCloseTo(60);
    expect(l.get('dock')!.stock.food).toBe(0);
    expect(l.shortages()).toEqual([{ id: 'dock', good: 'food', need: 1 }]);
    expect(l.take('mine', 'ore', 25)).toBe(25);
    expect(l.give('dock', 'ore', 500)).toBe(100);
    expect(l.price('food')).toBeGreaterThan(l.price('ore'));
  });
});

describe('signal network', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 100, y: 0 },
    { id: 'c', x: 200, y: 0 },
    { id: 'd', x: 900, y: 0 },
  ];

  it('links nearest neighbours in range and routes hop by hop', () => {
    const net = createNetwork();
    net.setNodes(nodes, 150, 2);
    expect(net.route('a', 'c')).toEqual(['a', 'b', 'c']);
    expect(net.route('a', 'd')).toBeNull();
    let arrived = false;
    net.send('a', 'c', { color: '#fff', speed: 100, onArrive: () => (arrived = true) });
    let t = 0;
    const hops: string[] = [];
    for (let i = 0; i < 60 && !arrived; i++) {
      t += 0.1;
      hops.push(...net.update(0.1, t).hops.map((h) => h.node));
    }
    expect(hops).toEqual(['b']);
    expect(arrived).toBe(true);
    expect(net.packets.length).toBe(0);
  });

  it('broadcasts outward in rings', () => {
    const net = createNetwork();
    net.setNodes(nodes, 150, 2);
    const w = net.broadcast('a', { color: '#f00', hopTime: 0.5 })!;
    expect([...w.depth.entries()]).toEqual([['a', 0], ['b', 1], ['c', 2]]);
  });
});

describe('flow field', () => {
  it('sums sources: wind, a moving band, a vortex, and divergence-free noise', () => {
    const field = createField(createNoise2D(createRng('field')));
    const out = { x: 0, y: 0 };
    field.add({ kind: 'uniform', angle: 0, strength: 10 });
    expect(field.sample(5, 5, 0, out)).toEqual({ x: 10, y: expect.closeTo(0) });
    const band = field.add({ kind: 'band', angle: 0, at: (t) => t * 100, width: 50, strength: 20 });
    expect(field.sample(300, 0, 3, out).x).toBeGreaterThan(20);
    expect(field.sample(900, 0, 3, out).x).toBeCloseTo(10);
    field.remove(band);
    const v = field.add({ kind: 'vortex', x: 0, y: 0, radius: 100, strength: 30 });
    const s = field.sample(100, 0, 0, out);
    expect(s.y).toBeGreaterThan(20); // swirling counter-clockwise in screen space at the radius
    field.remove(v);
  });
});

describe('bodies', () => {
  it('a spine follows its head at a fixed spacing and turns at a limited rate', () => {
    const b = createBody('worm', 0, 0, 10, 5, 0);
    for (let i = 0; i < 300; i++) {
      seek(b, 0, 400, 40, 0.8, 1 / 60);
      stepBody(b, 1 / 60);
    }
    for (let i = 1; i < b.n; i++) expect(Math.hypot(b.seg[i * 2] - b.seg[i * 2 - 2], b.seg[i * 2 + 1] - b.seg[i * 2 - 1])).toBeCloseTo(5, 4);
    // Heading turned from 0 toward the target, but not instantly (0.8 rad/s for 5 s caps it).
    expect(b.heading).toBeGreaterThan(0.5);
    expect(b.y).toBeGreaterThan(0);
  });
});

describe('history', () => {
  it('records at its cadence, forgets the oldest, and finds the nearest past moment', () => {
    const h = createHistory(4, 0.25);
    for (let i = 0; i <= 40; i++) h.record(i * 0.1, [{ x: i, y: 0, a: 0, kind: 'fighter', color: '#fff' }]);
    expect(h.size).toBe(4);
    expect(h.near(3.2)?.items[0].x).toBe(33);
    expect(h.near(0.5)).toBeNull();
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
