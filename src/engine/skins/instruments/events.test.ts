// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createBackground } from '../../core/createBackground';
import { createManualScheduler } from '../../core/scheduler';
import type { BackgroundSkin, SkinEvent } from '../../core/skin';
import { installCanvasStub, recorderFor } from '../../../test/canvas-stub';
import { abyssalSkin, atcRadarSkin, marsRadarSkin, seismicSkin, sonarSkin } from './index';

/**
 * The instruments report their moments through `handle.onEvent` so a sound palette can
 * play them. Each must report the moments that reliably happen early, and listening
 * must not change what is drawn.
 */

const FRAME_MS = 100; // 10 fps keeps this quick; dt sits at the host's clamp, not over it

function run(skin: BackgroundSkin, seconds: number, listen: boolean) {
  const wrapper = document.createElement('div');
  // A small screen: the recording canvas stub makes every draw call cost.
  Object.defineProperty(wrapper, 'clientWidth', { value: 640 });
  Object.defineProperty(wrapper, 'clientHeight', { value: 400 });
  const canvas = document.createElement('canvas');
  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);
  const scheduler = createManualScheduler();
  const handle = createBackground(canvas, { skin, scheduler, config: { seed: 'orion-7', adaptiveQuality: false, motion: 'full' } });
  const heard: SkinEvent[] = [];
  if (listen) handle.onEvent((e) => heard.push(e));
  scheduler.step((seconds * 1000) / FRAME_MS, FRAME_MS);
  const hash = recorderFor(canvas).hash;
  handle.destroy();
  return { heard, hash };
}

beforeAll(() => {
  installCanvasStub();
});

afterEach(() => {
  document.body.innerHTML = '';
});

/** Moments each instrument reaches on any seed, and how many seconds that takes at most. */
const cases: [BackgroundSkin, number, string[]][] = [
  // The first torpedo is always at 14 s; its decoy detonates 28 s later.
  [sonarSkin, 45, ['torpedo', 'turn', 'decoy', 'detonation']],
  [atcRadarSkin, 30, ['transmit', 'sweep']],
  // The opening quake's first aftershock lands by 20 s.
  [seismicSkin, 22, ['aftershock']],
  // A cascade by 8 s; the first giant and vent field each by 80 s.
  [abyssalSkin, 82, ['flash', 'giant', 'vent']],
  // A drive at once, a dust devil at 2 s, a helicopter flight by 18 s.
  [marsRadarSkin, 20, ['drive', 'devil', 'flight']],
];

describe.each(cases.map(([skin, seconds, types]) => [skin.id, skin, seconds, types] as const))('%s', (_id, skin, seconds, types) => {
  it('reports its moments as events, and draws the same whether or not anyone listens', () => {
    const on = run(skin, seconds, true);
    const seen = [...new Set(on.heard.map((e) => e.type))];
    for (const type of types) expect(seen, `heard: ${seen.join(', ')}`).toContain(type);
    for (const e of on.heard) {
      expect(e.weight).toBeGreaterThanOrEqual(0);
      expect(e.weight).toBeLessThanOrEqual(1);
      expect(Number.isFinite(e.pan) && Math.abs(e.pan) <= 1).toBe(true);
    }
    expect(on.hash).toBe(run(skin, seconds, false).hash);
  }, 30_000);
});
