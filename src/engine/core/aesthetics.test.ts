// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import '../../lib';
import { resolveBackgroundConfig, withConfigDefaults } from '../config';
import { autoShadeStrength, lightState, quietnessAt, QUIET_FEATHER } from './legibility';
import { mount } from './mount';
import { createManualScheduler } from './scheduler';
import { transition } from './transition';
import { createBackground } from './createBackground';
import type { BackgroundSkin } from './skin';
import { installCanvasStub, recorderFor } from '../../test/canvas-stub';

beforeAll(() => installCanvasStub());
afterEach(() => {
  document.body.innerHTML = '';
});

describe('scene light', () => {
  it('is seeded from the upper corners and stable per seed', () => {
    for (const seed of ['a', 'b', 'orion-7', 'harbor-11', 'x9']) {
      const { angle } = resolveBackgroundConfig({ seed }).light;
      const upperLeft = angle >= 200 && angle <= 235;
      const upperRight = angle >= 305 && angle <= 340;
      expect(upperLeft || upperRight, `${seed}: ${angle}`).toBe(true);
      expect(resolveBackgroundConfig({ seed }).light.angle).toBe(angle);
    }
  });

  it('honours an explicit angle and clamps warmth', () => {
    const l = resolveBackgroundConfig({ seed: 's', light: { angle: -90, warmth: 4 } }).light;
    expect(l.angle).toBe(270);
    expect(l.warmth).toBe(1);
  });

  it('merges a caller light over preset defaults per field', () => {
    const merged = withConfigDefaults({ light: { warmth: -0.35 } }, { light: { angle: 300, warmth: undefined } });
    expect(merged.light).toEqual({ warmth: -0.35, angle: 300 });
    expect(withConfigDefaults({ light: { warmth: 0.5 } }, {}).light).toEqual({ warmth: 0.5 });
  });

  it('places the key light inside the frame along its direction', () => {
    const up = lightState(270, 0);
    expect(up.dx).toBeCloseTo(0, 5);
    expect(up.dy).toBeCloseTo(-1, 5);
    expect(up.y).toBeLessThan(0.1);
    expect(up.x).toBeCloseTo(0.5, 5);
    const left = lightState(180, 0);
    expect(left.x).toBeLessThan(0.1);
  });
});

describe('quiet zones', () => {
  const rect = { x: 100, y: 100, width: 200, height: 100 };
  it('is 1 inside, fades to 0 by the feather distance', () => {
    expect(quietnessAt([rect], 150, 150)).toBe(1);
    const near = quietnessAt([rect], 300 + QUIET_FEATHER * 0.25, 150);
    const far = quietnessAt([rect], 300 + QUIET_FEATHER * 0.75, 150);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(quietnessAt([rect], 300 + QUIET_FEATHER + 1, 150)).toBe(0);
    expect(quietnessAt([], 150, 150)).toBe(0);
  });

  it('feeds host.quiet from config quiet rects', () => {
    let quietAtCenter = -1;
    let quietAtCorner = -1;
    const probe: BackgroundSkin = {
      id: 'quiet-probe',
      mount(host) {
        return {
          resize() {},
          frame() {
            quietAtCenter = host.quiet(host.viewport.width / 2, host.viewport.height / 2);
            quietAtCorner = host.quiet(2, 2);
          },
          destroy() {},
        };
      },
    };
    const s = createManualScheduler();
    const h = mount(document.body, { skin: probe, scheduler: s, quiet: [{ x: 0.3, y: 0.3, width: 0.4, height: 0.4 }] });
    s.step(1);
    expect(quietAtCenter).toBe(1);
    expect(quietAtCorner).toBe(0);
    expect(h.composition().quiet).toHaveLength(1);
    h.destroy();
  });
});

describe('automatic shade', () => {
  const auto = resolveBackgroundConfig({}).legibility;
  it('is off at or below intensity 0.55 and grows to 0.45', () => {
    expect(autoShadeStrength(auto, 0.45)).toBe(0);
    expect(autoShadeStrength(auto, 0.55)).toBe(0);
    expect(autoShadeStrength(auto, 1)).toBeCloseTo(0.45, 5);
    expect(autoShadeStrength(auto, 0.775)).toBeCloseTo(0.225, 5);
  });

  it('respects off and fixed strengths', () => {
    expect(autoShadeStrength(resolveBackgroundConfig({ legibility: 'off' }).legibility, 1)).toBe(0);
    expect(autoShadeStrength(resolveBackgroundConfig({ legibility: { strength: 0.2 } }).legibility, 0.1)).toBe(0.2);
  });
});

describe('transitions', () => {
  it('reveals the next scene by its own clock and then removes the old one', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const s1 = createManualScheduler();
    const from = mount(box, { skin: 'deep-field', seed: 'a', scheduler: s1, adaptiveQuality: false });
    const s2 = createManualScheduler();
    const { handle, done } = transition(from, { skin: 'calm-mesh', seed: 'a', scheduler: s2, adaptiveQuality: false }, { duration: 1, kind: 'crossfade' });
    expect(box.querySelectorAll('.bg-engine-root')).toHaveLength(2);
    expect(handle.root.style.opacity).toBe('0');
    s2.step(30, 1000 / 60);
    const mid = Number(handle.root.style.opacity);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
    s2.step(40, 1000 / 60);
    await done;
    expect(box.querySelectorAll('.bg-engine-root')).toHaveLength(1);
    expect(handle.root.style.opacity).toBe('');
    handle.destroy();
  });

  it('opens an iris from the incoming key light', () => {
    const s = createManualScheduler();
    const from = mount(document.body, { skin: 'deep-field', seed: 'a', scheduler: createManualScheduler() });
    const { handle } = transition(from, { skin: 'calm-mesh', seed: 'b', scheduler: s, motion: 'full', light: { angle: 225 } }, { kind: 'iris', duration: 1 });
    s.step(20, 1000 / 60);
    expect(handle.root.style.clipPath).toMatch(/^circle\(/);
    const light = handle.composition().light;
    expect(handle.root.style.clipPath).toContain(`${(light.x * 100).toFixed(1)}%`);
    handle.destroy();
  });

  it('swaps instantly with motion off', async () => {
    const from = mount(document.body, { skin: 'deep-field', scheduler: createManualScheduler() });
    const { handle, done } = transition(from, { skin: 'calm-mesh', motion: 'off', scheduler: createManualScheduler() });
    await done;
    expect(document.querySelectorAll('.bg-engine-root')).toHaveLength(1);
    handle.destroy();
  });
});

describe('moments', () => {
  const run = (seed: string, frames: number) => {
    const wrapper = document.createElement('div');
    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    const s = createManualScheduler();
    const h = createBackground(canvas, {
      skin: 'scene',
      options: { layers: [{ use: 'moments', with: { rate: 6, kinds: 'mixed' } }] },
      scheduler: s,
      config: { seed, adaptiveQuality: false, motion: 'full' },
    });
    s.step(frames);
    const rec = recorderFor(canvas);
    const out = { hash: rec.hash, calls: rec.calls };
    h.destroy();
    return out;
  };

  it('fires events deterministically per seed', () => {
    const quiet = run('m-1', 60); // before the first event (3 s minimum)
    const a = run('m-1', 900);
    const b = run('m-1', 900);
    expect(a.hash).toBe(b.hash);
    expect(a.calls).toBeGreaterThan(quiet.calls + 100);
    expect(run('m-2', 900).hash).not.toBe(a.hash);
  });
});
