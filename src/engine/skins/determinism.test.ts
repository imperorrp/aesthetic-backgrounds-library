// @vitest-environment jsdom
import '../../test/load-all';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBackground } from '../core/createBackground';
import { createManualScheduler } from '../core/scheduler';
import { installCanvasStub, recorderFor } from '../../test/canvas-stub';
import { builtInSkins, voidSectorPreset } from './index';
import { presets } from '../presets';
import type { BackgroundSkin } from '../core/skin';

/**
 * Two instances of a skin with the same seed, driven by identical manual clocks,
 * must issue byte-for-byte identical draw-call streams. This is what makes
 * screenshots reproducible and permalinks meaningful.
 */

const FRAMES = 240; // 4 s at 60 fps

function run(skin: BackgroundSkin, seed: string, frames = FRAMES) {
  const wrapper = document.createElement('div');
  const canvas = document.createElement('canvas');
  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);
  const scheduler = createManualScheduler();
  const handle = createBackground(canvas, {
    skin,
    scheduler,
    config: { seed, adaptiveQuality: false, motion: 'full', detail: 'high' },
  });
  scheduler.step(frames);
  const rec = recorderFor(canvas);
  const result = { hash: rec.hash, calls: rec.calls };
  handle.destroy();
  return result;
}

beforeAll(() => {
  installCanvasStub();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const subjects: readonly BackgroundSkin[] = [...builtInSkins, voidSectorPreset, ...presets];

describe.each(subjects.map((s) => [s.id, s] as const))('%s', (_id, skin) => {
  it('replays identically for the same seed', () => {
    const a = run(skin, 'orion-7');
    const b = run(skin, 'orion-7');
    expect(a.calls).toBeGreaterThan(FRAMES);
    expect(a.calls).toBe(b.calls);
    expect(a.hash).toBe(b.hash);
    // Busy skins issue millions of recorded calls; the default 5 s is too tight under parallel load.
  }, 30_000);

  it('diverges for a different seed', () => {
    const a = run(skin, 'orion-7', 60);
    const b = run(skin, 'orion-8', 60);
    expect(a.hash).not.toBe(b.hash);
  });

  it('never calls Math.random or reads the wall clock while running', () => {
    const random = vi.spyOn(Math, 'random');
    const dateNow = vi.spyOn(Date, 'now');
    run(skin, 'fixed-seed', 120);
    expect(random).not.toHaveBeenCalled();
    expect(dateNow).not.toHaveBeenCalled();
    random.mockRestore();
    dateNow.mockRestore();
  });
});
