// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBackground } from './createBackground';
import { createManualScheduler } from './scheduler';
import { createRng } from '../rng';
import type { BackgroundSkin, FrameInfo, SkinHost } from './skin';
import { installCanvasStub } from '../../test/canvas-stub';

/** Host loop behavior under an injectable clock: dt, throttling, pause, motion policy, pointer, governor. */

type Rec = { hosts: SkinHost[]; frames: FrameInfo[]; resizes: number };

function stubSkin(onFrame?: (info: FrameInfo, host: SkinHost) => void): { skin: BackgroundSkin; rec: Rec } {
  const rec: Rec = { hosts: [], frames: [], resizes: 0 };
  const skin: BackgroundSkin = {
    id: 'loop-stub',
    mount(host) {
      rec.hosts.push(host);
      return {
        resize() {
          rec.resizes++;
        },
        frame(info) {
          rec.frames.push(info);
          onFrame?.(info, host);
        },
        destroy() {},
      };
    },
  };
  return { skin, rec };
}

function canvasInBody(): HTMLCanvasElement {
  const wrapper = document.createElement('div');
  const canvas = document.createElement('canvas');
  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);
  return canvas;
}

let hiddenFlag = false;

beforeAll(() => {
  installCanvasStub();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hiddenFlag });
});

afterEach(() => {
  hiddenFlag = false;
  document.body.innerHTML = '';
});

describe('frame loop', () => {
  it('runs one frame per scheduler tick with dt in seconds and t from mount', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { seed: 't', adaptiveQuality: false } });

    expect(rec.frames).toHaveLength(0);
    s.step(60);
    expect(rec.frames).toHaveLength(60);
    expect(rec.frames[0].t).toBe(0);
    expect(rec.frames[0].frame).toBe(0);
    for (const f of rec.frames) expect(f.dt).toBeCloseTo(1 / 60, 5);
    expect(rec.frames[59].t).toBeCloseTo(59 / 60, 5);
    expect(rec.frames[59].frame).toBe(59);
    handle.destroy();
  });

  it('honors targetFps without changing elapsed time', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), {
      skin,
      scheduler: s,
      config: { seed: 't', targetFps: 30, adaptiveQuality: false },
    });
    s.step(60);
    expect(rec.frames.length).toBeGreaterThanOrEqual(29);
    expect(rec.frames.length).toBeLessThanOrEqual(31);
    const total = rec.frames.reduce((sum, f) => sum + f.dt, 0);
    expect(total).toBeCloseTo(rec.frames[rec.frames.length - 1].t + rec.frames[0].dt, 2);
    for (const f of rec.frames.slice(1)) expect(f.dt).toBeCloseTo(1 / 30, 3);
    handle.destroy();
  });

  it('passes skin events to onEvent listeners, but not during fast-forward, and every step at a time scale', () => {
    const { skin } = stubSkin((info, host) => {
      if (host.events?.active) host.events.emit({ type: 'tick', weight: 0.5, pan: 0, near: 1, size: info.frame });
    });
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { adaptiveQuality: false } });
    const heard: number[] = [];
    s.step(3);
    expect(heard).toHaveLength(0);
    const off = handle.onEvent((e) => heard.push(e.size ?? -1));
    s.step(3);
    expect(heard).toHaveLength(3);
    handle.fastForward(1);
    expect(heard).toHaveLength(3);
    // Time scale is live time, faster: every step reports, not just the drawn one.
    handle.setTimeScale(4);
    s.step(1);
    expect(heard).toHaveLength(7);
    off();
    s.step(3);
    expect(heard).toHaveLength(7);
    handle.destroy();
  });

  it('clamps dt after a long stall', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { adaptiveQuality: false } });
    s.step(1);
    s.advance(5000);
    expect(rec.frames[1].dt).toBe(0.1);
    handle.destroy();
  });

  it('pauses and resumes without a dt spike', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { adaptiveQuality: false } });
    s.step(5);
    handle.pause();
    s.step(10);
    expect(rec.frames).toHaveLength(5);
    expect(s.pending()).toBe(0);
    handle.resume();
    s.step(1);
    expect(rec.frames).toHaveLength(6);
    expect(rec.frames[5].dt).toBeCloseTo(1 / 60, 5);
    handle.destroy();
  });

  it('stops when the document is hidden and restarts when shown', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { adaptiveQuality: false } });
    s.step(3);
    hiddenFlag = true;
    document.dispatchEvent(new Event('visibilitychange'));
    s.step(10);
    expect(rec.frames).toHaveLength(3);
    hiddenFlag = false;
    document.dispatchEvent(new Event('visibilitychange'));
    s.step(2);
    expect(rec.frames).toHaveLength(5);
    handle.destroy();
  });

  it('renders exactly one frame when motion is off, and more on demand', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { motion: 'off', adaptiveQuality: false } });
    expect(rec.frames).toHaveLength(1);
    expect(rec.hosts[0].motion).toBe('off');
    s.step(30);
    expect(rec.frames).toHaveLength(1);
    handle.renderOnce();
    expect(rec.frames).toHaveLength(2);
    handle.destroy();
  });

  it('halves intensity under reduced motion', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { motion: 'reduced', intensity: 0.9 } });
    expect(rec.hosts[0].motion).toBe('reduced');
    expect(rec.hosts[0].intensity).toBe(0.5);
    handle.destroy();
    const full = createBackground(canvasInBody(), { skin, scheduler: s, config: { motion: 'full', intensity: 0.9 } });
    expect(rec.hosts[1].intensity).toBe(0.9);
    full.destroy();
  });

  it('does not schedule frames after destroy', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { adaptiveQuality: false } });
    s.step(2);
    handle.destroy();
    s.step(5);
    expect(rec.frames).toHaveLength(2);
    expect(s.pending()).toBe(0);
  });
});

describe('host inputs', () => {
  it('tracks the pointer relative to the canvas and decays velocity while idle', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { adaptiveQuality: false } });
    const pointer = rec.hosts[0].pointer;
    expect(pointer.active).toBe(false);

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 40 }));
    expect(pointer.active).toBe(true);
    expect(pointer.x).toBe(100);
    expect(pointer.y).toBe(40);
    expect(pointer.idle).toBe(0);

    s.step(3);
    expect(pointer.idle).toBeCloseTo(3 / 60, 5);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 160, clientY: 40 }));
    expect(pointer.vx).toBeGreaterThan(0);
    const v = pointer.vx;
    s.step(6);
    expect(pointer.vx).toBeLessThan(v);

    window.dispatchEvent(new MouseEvent('pointerdown'));
    expect(pointer.down).toBe(true);
    window.dispatchEvent(new MouseEvent('pointerup'));
    expect(pointer.down).toBe(false);
    handle.destroy();
  });

  it('exposes forked rng streams and seeded noise', () => {
    const { skin, rec } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { seed: 'orion-7' } });
    const host = rec.hosts[0];
    expect(host.fork('stars')()).toBe(createRng('orion-7::stars')());
    expect(host.fork('stars')()).not.toBe(host.fork('fleets')());
    const n = host.noise.noise2(1.5, 2.5);
    expect(n).toBeGreaterThanOrEqual(-1);
    expect(n).toBeLessThanOrEqual(1);
    expect(host.noise.noise2(1.5, 2.5)).toBe(n);
    handle.destroy();
  });

  it('lowers quality when frames run over budget', () => {
    const spin = (ms: number) => {
      const end = performance.now() + ms;
      while (performance.now() < end) { /* burn */ }
    };
    const { skin, rec } = stubSkin(() => spin(25));
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { targetFps: 60, adaptiveQuality: true } });
    expect(rec.hosts[0].quality).toBe(1);
    s.step(25);
    expect(rec.hosts[0].quality).toBeLessThan(1);
    expect(rec.hosts[0].quality).toBeGreaterThanOrEqual(0.3);
    handle.destroy();
  });

  it('leaves quality alone when adaptive quality is disabled', () => {
    const spin = (ms: number) => {
      const end = performance.now() + ms;
      while (performance.now() < end) { /* burn */ }
    };
    const { skin, rec } = stubSkin(() => spin(20));
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { adaptiveQuality: false } });
    s.step(10);
    expect(rec.hosts[0].quality).toBe(1);
    handle.destroy();
  });

  it('never touches Math.random on the host side', () => {
    const spy = vi.spyOn(Math, 'random');
    const { skin } = stubSkin();
    const s = createManualScheduler();
    const handle = createBackground(canvasInBody(), { skin, scheduler: s, config: { seed: 'fixed', adaptiveQuality: false } });
    s.step(20);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    handle.destroy();
  });
});

describe('nudges', () => {
  const nudgeSkin = () => {
    const calls: [number, number][] = [];
    const skin: BackgroundSkin = {
      id: 'nudge-stub',
      mount() {
        return {
          resize() {},
          frame() {},
          nudge(x, y) {
            calls.push([x, y]);
            return 'A STONE IS THROWN';
          },
          destroy() {},
        };
      },
    };
    return { skin, calls };
  };
  const press = (type: string, x: number, y: number, target: EventTarget = document.body) =>
    target.dispatchEvent(Object.assign(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })));
  const sized = (canvas: HTMLCanvasElement) => {
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return canvas;
  };

  it('handle.nudge reaches the skin and returns what it said', () => {
    const { skin, calls } = nudgeSkin();
    const handle = createBackground(canvasInBody(), { skin, scheduler: createManualScheduler(), config: { seed: 'n' } });
    expect(handle.nudge(40, 30)).toBe('A STONE IS THROWN');
    expect(calls).toEqual([[40, 30]]);
    handle.destroy();
  });

  it('a click on the page nudges only with config.nudges, and a drag does not', () => {
    const off = nudgeSkin();
    const a = createBackground(sized(canvasInBody()), { skin: off.skin, scheduler: createManualScheduler(), config: { seed: 'n' } });
    press('pointerdown', 50, 50);
    press('pointerup', 50, 50);
    expect(off.calls).toHaveLength(0);
    a.destroy();

    const on = nudgeSkin();
    const b = createBackground(sized(canvasInBody()), { skin: on.skin, scheduler: createManualScheduler(), config: { seed: 'n', nudges: true } });
    press('pointerdown', 50, 50);
    press('pointerup', 51, 50);
    expect(on.calls).toEqual([[51, 50]]);
    press('pointerdown', 50, 50);
    press('pointerup', 90, 50);
    expect(on.calls).toHaveLength(1);
    // A click on page content (a link, a paragraph) is the page's, not the world's.
    const p = document.createElement('p');
    document.body.appendChild(p);
    press('pointerdown', 50, 50, p);
    press('pointerup', 50, 50, p);
    expect(on.calls).toHaveLength(1);
    b.destroy();
  });
});
