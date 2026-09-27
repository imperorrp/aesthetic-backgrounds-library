// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createBackground } from './createBackground';
import { mount } from './mount';
import { createManualScheduler } from './scheduler';
import { registerLayer, type Layer } from './layer';
import { createPreset, sceneSkin, type Scene } from './scene';
import { installCanvasStub } from '../../test/canvas-stub';
import { presets } from '../presets';

type Log = { id: string; canvas: HTMLCanvasElement; opacity: number; blend: string; options: unknown }[];

function fakeLayer(id: string, surface: 'shared' | 'own', log: Log): Layer {
  return {
    id,
    label: id,
    surface,
    schema: { size: { type: 'number', min: 0, max: 10, default: 2 } },
    dom(root) {
      const el = document.createElement('div');
      el.className = `dom-${id}`;
      root.appendChild(el);
      return () => el.remove();
    },
    canvas(host) {
      return {
        frame() {
          log.push({ id, canvas: host.canvas, opacity: host.opacity, blend: host.blend, options: host.options });
        },
      };
    },
  };
}

function canvasInBody(): HTMLCanvasElement {
  const wrapper = document.createElement('div');
  const canvas = document.createElement('canvas');
  wrapper.appendChild(canvas);
  document.body.appendChild(wrapper);
  return canvas;
}

beforeAll(() => {
  installCanvasStub();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('scene skin', () => {
  it('runs enabled layers in order with their opacity, blend, and validated options', () => {
    const log: Log = [];
    registerLayer(fakeLayer('t-shared', 'shared', log));
    registerLayer(fakeLayer('t-own', 'own', log));
    const scene: Scene = {
      layers: [
        { use: 't-own', with: { size: 50 }, opacity: 0.5, blend: 'lighter' },
        { use: 't-shared', enabled: false },
        { use: 't-shared', with: { size: 'oops' } },
      ],
    };
    const canvas = canvasInBody();
    const s = createManualScheduler();
    const handle = createBackground(canvas, { skin: sceneSkin, options: scene, scheduler: s, config: { adaptiveQuality: false } });
    s.step(2);
    expect(log.map((l) => l.id)).toEqual(['t-own', 't-shared', 't-own', 't-shared']);
    expect(log[0].canvas).not.toBe(canvas); // own surface
    expect(log[1].canvas).toBe(canvas); // shared surface
    expect(log[0]).toMatchObject({ opacity: 0.5, blend: 'lighter', options: { size: 10 } });
    expect(log[1]).toMatchObject({ opacity: 1, blend: 'source-over', options: { size: 2 } });
    handle.destroy();
  });

  it('places DOM layers behind the canvas and cleans them up', () => {
    const log: Log = [];
    registerLayer(fakeLayer('t-dom', 'shared', log));
    const handle = mount(document.body, { skin: 'scene', options: { layers: [{ use: 't-dom' }] } as Scene });
    const el = handle.root.querySelector('.dom-t-dom');
    expect(el).not.toBeNull();
    expect(el!.compareDocumentPosition(handle.canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    handle.destroy();
    expect(document.querySelector('.dom-t-dom')).toBeNull();
  });

  it('names known layers when a reference is unknown', () => {
    expect(() =>
      createBackground(canvasInBody(), { skin: sceneSkin, options: { layers: [{ use: 'nope' }] }, scheduler: createManualScheduler() }),
    ).toThrow(/Unknown layer "nope".*gradient-base/);
  });
});

describe('presets', () => {
  it('register as skins and apply their config defaults beneath caller config', () => {
    const calm = presets.find((p) => p.id === 'calm-mesh')!;
    let seenPalette: string | undefined;
    let seenTheme: string | undefined;
    let seenIntensity: number | undefined;
    const probe = createPreset({
      id: 'probe-preset',
      label: 'probe',
      config: calm.defaults,
      scene: { layers: [] },
    });
    const original = probe.mount;
    probe.mount = (host) => {
      seenPalette = host.palette.id;
      seenTheme = host.palette.theme;
      seenIntensity = host.intensity;
      return original(host);
    };
    const a = mount(document.body, { skin: probe });
    expect(seenPalette).toBe('custom');
    expect(seenTheme).toBe('light');
    expect(seenIntensity).toBe(0.8);
    a.destroy();
    const b = mount(document.body, { skin: probe, palette: 'amber', intensity: 0.3 });
    expect(seenPalette).toBe('amber');
    expect(seenIntensity).toBe(0.3);
    b.destroy();
  });

  it.each(presets.map((p) => [p.id, p] as const))('%s mounts and runs', (_id, preset) => {
    const s = createManualScheduler();
    const handle = mount(document.body, { skin: preset, seed: 'preset-test', scheduler: s, adaptiveQuality: false });
    expect(handle.root.querySelector('canvas')).not.toBeNull();
    s.step(30);
    handle.destroy();
  });

  it('exposes at least one light-theme preset and four distinct niches', () => {
    expect(presets.some((p) => p.defaults?.palette && typeof p.defaults.palette === 'object' && 'theme' in p.defaults.palette && p.defaults.palette.theme === 'light')).toBe(true);
    const niches = new Set(presets.flatMap((p) => p.tags ?? []).filter((t) => ['saas', 'terminal', 'space', 'data', 'nature', 'editorial'].includes(t)));
    expect(niches.size).toBeGreaterThanOrEqual(4);
  });
});
