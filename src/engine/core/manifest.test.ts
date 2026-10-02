// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import '../../lib';
import {
  describeRegistry,
  manifestOf,
  presetFromManifest,
  registerPresetManifest,
  sceneCost,
  validatePresetManifest,
  type PresetManifest,
} from './manifest';
import { getSkin } from './registry';
import { mount } from './mount';
import { createManualScheduler } from './scheduler';
import { presets } from '../presets';
import { installCanvasStub } from '../../test/canvas-stub';

const good: PresetManifest = {
  id: 'test-ember',
  label: 'Test ember',
  tags: ['warm'],
  config: { palette: { from: '#f97316' }, intensity: 0.6 },
  scene: {
    layers: [
      { use: 'gradient-base', with: { tint: 0.3 } },
      { use: 'particles-drift', with: { count: 40, glow: 0.8, color: 'accent' }, blend: 'lighter', opacity: 0.8 },
      { use: 'grain' },
    ],
  },
};

beforeAll(() => installCanvasStub());
afterEach(() => {
  document.body.innerHTML = '';
});

describe('validatePresetManifest', () => {
  it('accepts a well-formed manifest', () => {
    const r = validatePresetManifest(good);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('reports every problem with a path', () => {
    const r = validatePresetManifest({
      id: 'Bad Id',
      label: '',
      config: { intensity: 3, light: { angle: 'up' } as never, legibility: 'loud' as never },
      scene: {
        layers: [
          { use: 'nope' },
          { use: 'grid', with: { style: 'hexagons' } },
          { use: 'vignette', opacity: 2, blend: 'plasma' },
        ],
      },
    });
    expect(r.ok).toBe(false);
    const text = r.errors.join('\n');
    expect(text).toMatch(/^id:/m);
    expect(text).toMatch(/^label:/m);
    expect(text).toMatch(/config\.intensity/);
    expect(text).toMatch(/config\.light/);
    expect(text).toMatch(/config\.legibility/);
    expect(text).toMatch(/scene\.layers\[0\]\.use: unknown layer "nope"/);
    expect(text).toMatch(/scene\.layers\[1\]\.with\.style: "hexagons" is not one of dots, lines, cross/);
    expect(text).toMatch(/scene\.layers\[2\]\.opacity/);
    expect(text).toMatch(/scene\.layers\[2\]\.blend/);
  });

  it('warns rather than fails on values that will be clamped or ignored', () => {
    const r = validatePresetManifest({
      ...good,
      scene: { layers: [{ use: 'starfield', with: { density: 9, sparkle: true } }] },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.join('\n')).toMatch(/density: 9 is outside 0\.\.2/);
    expect(r.warnings.join('\n')).toMatch(/no option "sparkle"/);
  });

  it('rejects manifests from a newer format', () => {
    expect(validatePresetManifest({ ...good, manifestVersion: 99 }).ok).toBe(false);
  });
});

describe('presets from manifests', () => {
  it('builds, registers, and mounts a third-party preset by id', () => {
    const skin = registerPresetManifest(good);
    expect(getSkin('test-ember')).toBe(skin);
    expect(skin.tags).toContain('community');
    const s = createManualScheduler();
    const handle = mount(document.body, { skin: 'test-ember', seed: 'm', scheduler: s, adaptiveQuality: false });
    expect(handle.root.dataset.bgePalette).toBe('custom');
    expect(handle.root.querySelector('.bge-grain')).not.toBeNull();
    s.step(10);
    handle.destroy();
  });

  it('throws with all errors for an invalid manifest', () => {
    expect(() => presetFromManifest({ id: 'x', scene: { layers: [] } })).toThrow(/Invalid preset manifest[\s\S]*label[\s\S]*scene\.layers/);
  });

  it('round-trips a built-in preset through manifestOf', () => {
    const calm = presets.find((p) => p.id === 'calm-mesh')!;
    const m = manifestOf(calm, { id: 'calm-mesh-copy' });
    expect(validatePresetManifest(m).ok).toBe(true);
    const copy = presetFromManifest(m);
    expect(copy.scene).toEqual(calm.scene);
    expect(copy.defaults).toEqual(calm.defaults);
  });
});

describe('registry descriptions', () => {
  it('describes every skin, preset, and layer with a cost tier', () => {
    const entries = describeRegistry();
    const kinds = new Set(entries.map((e) => e.kind));
    expect(kinds).toEqual(new Set(['skin', 'preset', 'layer']));
    expect(entries.find((e) => e.id === 'nebula')?.cost).toBe('gpu');
    expect(entries.find((e) => e.id === 'flow-field')?.cost).toBe('medium');
    expect(entries.find((e) => e.id === 'vignette')?.cost).toBe('low');
    expect(entries.find((e) => e.id === 'calm-mesh')?.themes).toEqual(['light']);
    expect(entries.every((e) => typeof e.label === 'string' && e.label.length > 0)).toBe(true);
  });

  it('rates a scene by its most expensive enabled layer', () => {
    expect(sceneCost({ layers: [{ use: 'vignette' }, { use: 'nebula' }] })).toBe('gpu');
    expect(sceneCost({ layers: [{ use: 'vignette' }, { use: 'nebula', enabled: false }] })).toBe('low');
  });

  it('accepts every committed community manifest', () => {
    const dir = resolve(__dirname, '../../../registry/community');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const r = validatePresetManifest(JSON.parse(readFileSync(resolve(dir, file), 'utf8')));
      expect(r.errors, file).toEqual([]);
    }
  });
});
