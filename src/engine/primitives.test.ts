import { describe, expect, it } from 'vitest';
import { createManualScheduler } from './core/scheduler';
import { contrastRatio, hexToOklch, oklchToHex, parseHex, relativeLuminance, toHex } from './color';
import { derivePalette, paletteVars, resolvePalette, rgba } from './palette';
import { createNoise2D } from './noise';
import { resolveBackgroundConfig } from './config';
import { createRng, forkRng } from './rng';

describe('manual scheduler', () => {
  it('runs callbacks only on advance and supports cancel', () => {
    const s = createManualScheduler();
    const seen: number[] = [];
    s.request((t) => seen.push(t));
    const cancelled = s.request((t) => seen.push(-t));
    s.cancel(cancelled);
    expect(s.pending()).toBe(1);
    s.advance(16);
    expect(seen).toEqual([16]);
    expect(s.now()).toBe(16);
    s.step(3, 10);
    expect(s.now()).toBe(46);
  });
});

describe('color', () => {
  it('parses and formats hex', () => {
    expect(parseHex('#06b6d4')).toEqual({ r: 6, g: 182, b: 212 });
    expect(parseHex('fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('nope')).toBeNull();
    expect(toHex({ r: 6, g: 182, b: 212 })).toBe('#06b6d4');
  });

  it('round-trips through OKLCH within rounding error', () => {
    for (const hex of ['#06b6d4', '#d4a017', '#a78bfa', '#123456', '#f87171']) {
      const back = parseHex(oklchToHex(hexToOklch(hex)!))!;
      const orig = parseHex(hex)!;
      expect(Math.abs(back.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21, 1);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe('palette', () => {
  it('resolves ids, objects, hex strings, and unknowns', () => {
    expect(resolvePalette('amber').id).toBe('amber');
    expect(resolvePalette(undefined).id).toBe('void-cyan');
    expect(resolvePalette('not-a-palette').id).toBe('void-cyan');
    expect(resolvePalette('#ff7a1a').id).toBe('custom');
    expect(resolvePalette({ from: '#ff7a1a', theme: 'light' }).theme).toBe('light');
    const obj = resolvePalette('violet');
    expect(resolvePalette(obj)).toBe(obj);
  });

  it('derives a legible dark palette from a brand color', () => {
    const p = derivePalette({ from: '#ff7a1a' });
    const bg = parseHex(p.bg)!;
    const ink = parseHex(p.ink)!;
    const accent = parseHex(p.accent)!;
    expect(relativeLuminance(bg)).toBeLessThan(0.03);
    expect(contrastRatio(ink, bg)).toBeGreaterThan(12);
    expect(contrastRatio(accent, bg)).toBeGreaterThan(4);
    expect(p.accentRgb).toMatch(/^\d+ \d+ \d+$/);
    expect(p.inkRgb.split(' ')).toHaveLength(3);
    expect(parseHex(p.hazard)).not.toBeNull();
  });

  it('derives a light palette when asked', () => {
    const p = derivePalette({ from: '#2563eb', theme: 'light' });
    expect(relativeLuminance(parseHex(p.bg)!)).toBeGreaterThan(0.85);
    expect(contrastRatio(parseHex(p.ink)!, parseHex(p.bg)!)).toBeGreaterThan(10);
    expect(contrastRatio(parseHex(p.accent)!, parseHex(p.bg)!)).toBeGreaterThan(3);
  });

  it('emits prefixed CSS variables with a hue shift relative to the default accent', () => {
    const vars = paletteVars(resolvePalette('void-cyan'));
    expect(Object.keys(vars).every((k) => k.startsWith('--bge-'))).toBe(true);
    expect(vars['--bge-hue-shift']).toBe('0deg');
    const amber = paletteVars(resolvePalette('amber'))['--bge-hue-shift'];
    expect(Number.parseInt(amber, 10)).toBeLessThan(-100);
  });

  it('formats rgba from either triplet style', () => {
    expect(rgba('6 182 212', 0.5)).toBe('rgba(6, 182, 212, 0.5)');
    expect(rgba('6, 182, 212')).toBe('rgba(6, 182, 212, 1)');
  });
});

describe('noise', () => {
  it('is seeded, bounded, and smooth', () => {
    const a = createNoise2D(createRng('n'));
    const b = createNoise2D(createRng('n'));
    const c = createNoise2D(createRng('m'));
    let min = Infinity;
    let max = -Infinity;
    let differs = false;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const v = a.noise2(x * 0.37, y * 0.29);
        expect(v).toBe(b.noise2(x * 0.37, y * 0.29));
        if (v !== c.noise2(x * 0.37, y * 0.29)) differs = true;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    expect(differs).toBe(true);
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.5);
    const near = Math.abs(a.noise2(3.0, 4.0) - a.noise2(3.001, 4.0));
    expect(near).toBeLessThan(0.05);
    const f = a.fbm2(1.2, 3.4, 5);
    expect(f).toBeGreaterThanOrEqual(-1);
    expect(f).toBeLessThanOrEqual(1);
  });
});

describe('config', () => {
  it('clamps intensity and resolves the palette object', () => {
    const c = resolveBackgroundConfig({ intensity: 3, palette: 'amber', targetFps: 0 });
    expect(c.intensity).toBe(1);
    expect(c.palette.id).toBe('amber');
    expect(c.motion).toBe('auto');
    expect(c.adaptiveQuality).toBe(true);
    expect(c.targetFps).toBe(1);
    expect(resolveBackgroundConfig({ intensity: -1 }).intensity).toBe(0);
  });

  it('forks independent streams', () => {
    expect(forkRng('s', 'a')()).toBe(forkRng('s', 'a')());
    expect(forkRng('s', 'a')()).not.toBe(forkRng('s', 'b')());
    expect(forkRng('s', 'a')()).not.toBe(createRng('s')());
  });
});
