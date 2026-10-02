import { describe, expect, it } from 'vitest';
import { paletteFromTokens, paletteToTokens } from './tokens';
import { derivePalette, HARMONIES, harmonyHues, PALETTES, resolvePalette } from './palette';
import { contrastRatio, hexToOklch, parseHex } from './color';

describe('paletteToTokens', () => {
  it('emits DTCG color tokens under a group', () => {
    const t = paletteToTokens(PALETTES['void-cyan']) as Record<string, Record<string, { $type: string; $value: string }>>;
    expect(t.bge.accent).toMatchObject({ $type: 'color', $value: '#06b6d4' });
    expect(t.bge.bg.$value).toBe('#030308');
    expect(t.bge['accent-2'].$type).toBe('color');
  });

  it('round-trips through paletteFromTokens', () => {
    const p = derivePalette({ from: '#ff7a1a', theme: 'light' });
    const spec = paletteFromTokens(paletteToTokens(p));
    expect(spec).toMatchObject({ from: p.accent, theme: 'light', bg: p.bg, ink: p.ink });
  });
});

describe('paletteFromTokens', () => {
  it('reads Style Dictionary nesting with `value`', () => {
    const spec = paletteFromTokens({ color: { brand: { primary: { value: '#7c3aed' } }, neutral: { 900: { value: '#111111' } } } });
    expect(spec).toEqual({ from: '#7c3aed', theme: 'dark' });
  });

  it('reads a flat map and infers a light theme from the background', () => {
    const spec = paletteFromTokens({ primary: '#2563eb', background: '#ffffff', text: '#0f172a' });
    expect(spec).toEqual({ from: '#2563eb', theme: 'light', bg: '#ffffff', ink: '#0f172a' });
  });

  it('keeps brand surface and text only when they contrast', () => {
    const spec = paletteFromTokens({ accent: '#2563eb', background: '#ffffff', text: '#eeeeee' });
    expect(spec).toEqual({ from: '#2563eb', theme: 'light' });
  });

  it('fails clearly when there is no usable color', () => {
    expect(() => paletteFromTokens({ spacing: { sm: '4px' } })).toThrow(/no accent, brand, or primary/);
  });
});

describe('palette harmonies', () => {
  const hue = (hex: string) => hexToOklch(hex)!.h;
  const gap = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  it('places secondary hues at the harmony offsets', () => {
    const accent = '#2563eb';
    const base = hue(derivePalette({ from: accent }).accent);
    const [a2, a3] = harmonyHues(derivePalette({ from: accent }).accent, 'triadic', 'dark');
    expect(gap(hue(a2), base)).toBeGreaterThan(100);
    expect(gap(hue(a3), base)).toBeGreaterThan(100);
    const [s2, s3] = harmonyHues(derivePalette({ from: accent }).accent, 'analogous', 'dark');
    expect(gap(hue(s2), base)).toBeLessThan(40);
    expect(gap(hue(s3), base)).toBeLessThan(40);
  });

  it('keeps every harmony hue legible on its background', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const harmony of HARMONIES) {
        const p = derivePalette({ from: '#ff7a1a', theme, harmony });
        for (const hex of [p.accent2, p.accent3]) {
          expect(contrastRatio(parseHex(hex)!, parseHex(p.bg)!), `${theme}/${harmony} ${hex}`).toBeGreaterThan(2.2);
        }
      }
    }
  });

  it('fills harmony fields on built-ins and hand-written palettes without changing existing fields', () => {
    expect(PALETTES.amber.accent2).toMatch(/^#[0-9a-f]{6}$/);
    const derived = derivePalette({ from: '#ff7a1a' });
    const { accent2: _a, accent2Rgb: _b, accent3: _c, accent3Rgb: _d, harmony: _h, ...legacy } = derived;
    const filled = resolvePalette(legacy as never);
    expect(filled.accent).toBe(derived.accent);
    expect(filled.accent2).toBe(derived.accent2);
  });
});
