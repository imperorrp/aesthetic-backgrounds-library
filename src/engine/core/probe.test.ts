// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { probeContrast } from './probe';

/** jsdom's canvas returns no pixels; we install a tiny context that serves a fixed image. */
function canvasWithPixels(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = {
    getImageData(sx: number, sy: number, sw: number, sh: number) {
      const data = new Uint8ClampedArray(sw * sh * 4);
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const [r, g, b, a] = fill(sx + x, sy + y);
          const i = (y * sw + x) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
      return { data, width: sw, height: sh };
    },
  };
  (canvas as unknown as { getContext: () => unknown }).getContext = () => ctx;
  return canvas;
}

beforeAll(() => {
  // no-op: each test builds its own canvas
});

describe('probeContrast', () => {
  it('reports high contrast for white text over a dark plate', () => {
    const c = canvasWithPixels(64, 64, () => [8, 10, 16, 255]);
    const r = probeContrast(c, { x: 0, y: 0, width: 64, height: 64 }, '#ffffff', { stride: 4 });
    expect(r.samples).toBe(256);
    expect(r.meanContrast).toBeGreaterThan(15);
    expect(r.worstContrast).toBeGreaterThan(15);
    expect(r.failingShare).toBe(0);
  });

  it('flags the share of bright pixels that would fail behind white text', () => {
    const c = canvasWithPixels(64, 64, (x) => (x < 32 ? [8, 10, 16, 255] : [220, 230, 240, 255]));
    const r = probeContrast(c, { x: 0, y: 0, width: 64, height: 64 }, '#ffffff', { stride: 4, threshold: 4.5 });
    expect(r.failingShare).toBeCloseTo(0.5, 1);
    expect(r.worstContrast).toBeLessThan(1.5);
    expect(r.maxLuminance).toBeGreaterThan(0.7);
  });

  it('treats transparent pixels as black and respects the rect', () => {
    const c = canvasWithPixels(100, 100, (x, y) => (x >= 50 && y >= 50 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const dark = probeContrast(c, { x: 0, y: 0, width: 50, height: 50 }, '#ffffff', { stride: 5 });
    const bright = probeContrast(c, { x: 50, y: 50, width: 50, height: 50 }, '#ffffff', { stride: 5 });
    expect(dark.meanLuminance).toBe(0);
    expect(dark.failingShare).toBe(0);
    expect(bright.failingShare).toBe(1);
  });
});
