import { describe, expect, it } from 'vitest';
import { resolveColor, resolveOptions, schemaDefaults } from './schema';
import { resolvePalette } from '../palette';

const schema = {
  count: { type: 'number', min: 1, max: 10, default: 4 },
  glow: { type: 'boolean', default: true },
  style: { type: 'enum', values: ['dots', 'lines'], default: 'dots' },
  color: { type: 'color', default: 'accent' },
  label: { type: 'string', default: 'hi' },
} as const;

describe('schema', () => {
  it('produces defaults', () => {
    expect(schemaDefaults(schema)).toEqual({ count: 4, glow: true, style: 'dots', color: 'accent', label: 'hi' });
  });

  it('fills, clamps, and rejects without throwing', () => {
    const out = resolveOptions(schema, { count: 99, glow: 'false', style: 'hexagons', color: '', label: 7 });
    expect(out).toEqual({ count: 10, glow: false, style: 'dots', color: 'accent', label: 'hi' });
    expect(resolveOptions(schema, { count: '3' }).count).toBe(3);
    expect(resolveOptions(schema, { count: -5 }).count).toBe(1);
    expect(resolveOptions(schema, null).count).toBe(4);
    expect(resolveOptions(schema, { style: 'lines', color: '#ff0000' })).toMatchObject({ style: 'lines', color: '#ff0000' });
  });

  it('resolves color tokens and hex against the palette', () => {
    const p = resolvePalette('amber');
    expect(resolveColor('accent', p)).toEqual({ hex: p.accent, rgb: p.accentRgb });
    expect(resolveColor('ink', p).rgb).toBe(p.inkRgb);
    expect(resolveColor('bg', p).hex).toBe(p.bg);
    expect(resolveColor('#0000ff', p)).toEqual({ hex: '#0000ff', rgb: '0 0 255' });
    expect(resolveColor('nonsense', p)).toEqual({ hex: p.accent, rgb: p.accentRgb });
  });
});
