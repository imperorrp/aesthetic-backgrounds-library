// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mount } from './mount';
import { createBackground } from './createBackground';
import { registerSkin, resolveSkin, listSkins } from './registry';
import type { BackgroundSkin, SkinHost, SkinLayerContext } from './skin';
import { builtInSkins } from '../skins';

/**
 * jsdom has no layout or canvas. These tests cover the DOM contract of mount():
 * structure, styles, skin resolution, layer hooks, sizing fallbacks, and cleanup.
 */

type Recorded = {
  hosts: SkinHost[];
  layerContexts: SkinLayerContext[];
  resizes: { width: number; height: number }[];
  destroyed: number;
  layersDestroyed: number;
};

function makeStubSkin(id = 'stub'): { skin: BackgroundSkin; rec: Recorded } {
  const rec: Recorded = { hosts: [], layerContexts: [], resizes: [], destroyed: 0, layersDestroyed: 0 };
  const skin: BackgroundSkin = {
    id,
    layers(root, context) {
      rec.layerContexts.push(context);
      const el = document.createElement('div');
      el.className = 'stub-layer';
      root.appendChild(el);
      return () => {
        el.remove();
        rec.layersDestroyed++;
      };
    },
    mount(host) {
      rec.hosts.push(host);
      return {
        resize(v) {
          rec.resizes.push({ ...v });
        },
        frame() {},
        destroy() {
          rec.destroyed++;
        },
      };
    },
  };
  return { skin, rec };
}

beforeAll(() => {
  // Minimal 2D context: property sets land on the object, method calls are no-ops.
  const fakeCtx = new Proxy({} as Record<string, unknown>, {
    get(target, key) {
      if (key in target) return target[key as string];
      return () => undefined;
    },
    set(target, key, value) {
      target[key as string] = value;
      return true;
    },
  });
  HTMLCanvasElement.prototype.getContext = (() => fakeCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
});

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('#bg-engine-styles, link[data-bg-engine-fonts]').forEach((n) => n.remove());
});

describe('skin registry', () => {
  it('registers the built-in skins by id', () => {
    for (const skin of builtInSkins) {
      expect(listSkins()).toContain(skin.id);
      expect(resolveSkin(skin.id, builtInSkins[0])).toBe(skin);
    }
  });

  it('passes skin objects through and falls back when nothing is given', () => {
    const { skin } = makeStubSkin('pass-through');
    expect(resolveSkin(skin, builtInSkins[0])).toBe(skin);
    expect(resolveSkin(undefined, skin)).toBe(skin);
    expect(resolveSkin('', skin)).toBe(skin);
  });

  it('names the known skins when an id is unknown', () => {
    expect(() => resolveSkin('nope', builtInSkins[0])).toThrow(/Unknown skin "nope".*void-tactical/);
  });
});

describe('mount()', () => {
  it('builds a fixed root and a canvas that fills it on the page body', () => {
    const { skin } = makeStubSkin();
    const handle = mount(document.body, { skin, seed: 'test' });

    expect(handle.root.parentElement).toBe(document.body);
    expect(handle.root.className).toBe('bg-engine-root');
    expect(handle.root.style.position).toBe('fixed');
    expect(handle.root.style.pointerEvents).toBe('none');

    const canvas = handle.canvas;
    expect(canvas.parentElement).toBe(handle.root);
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    expect(canvas.style.pointerEvents).toBe('none');
    handle.destroy();
  });

  it('positions a static container and uses an absolute root inside it', () => {
    const box = document.createElement('section');
    document.body.appendChild(box);
    const { skin } = makeStubSkin();
    const handle = mount(box, { skin });
    expect(box.style.position).toBe('relative');
    expect(handle.root.style.position).toBe('absolute');
    handle.destroy();
  });

  it('accepts a selector and a registered skin id', () => {
    const box = document.createElement('div');
    box.id = 'hero';
    document.body.appendChild(box);
    const { skin, rec } = makeStubSkin('registered-stub');
    registerSkin(skin);
    const handle = mount('#hero', { skin: 'registered-stub' });
    expect(rec.hosts).toHaveLength(1);
    handle.destroy();
    expect(() => mount('#missing', { skin })).toThrow(/no element matches/);
  });

  it('mounts skin layers behind the canvas and shares one resolved seed with the canvas host', () => {
    const { skin, rec } = makeStubSkin();
    const handle = mount(document.body, { skin });

    const layer = handle.root.querySelector('.stub-layer');
    expect(layer).not.toBeNull();
    expect(layer!.compareDocumentPosition(handle.canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(rec.layerContexts).toHaveLength(1);
    expect(rec.hosts).toHaveLength(1);
    expect(rec.layerContexts[0].config.seed).toBe(rec.hosts[0].config.seed);
    expect(rec.layerContexts[0].palette.id).toBe('void-cyan');
    handle.destroy();
  });

  it('gives the skin host resolved palette values', () => {
    const { skin, rec } = makeStubSkin();
    const handle = mount(document.body, { skin, palette: 'amber' });
    expect(rec.hosts[0].palette.id).toBe('amber');
    expect(rec.hosts[0].palette.accentRgb).toBe('212 160 23');
    expect(document.documentElement.dataset.palette).toBe('amber');
    handle.destroy();
  });

  it('falls back to the window size when the canvas has no layout box', () => {
    const { skin, rec } = makeStubSkin();
    const handle = mount(document.body, { skin });
    // jsdom reports 0 for clientWidth/Height, so the host must fall back to innerWidth/innerHeight.
    expect(rec.resizes[0]).toEqual({ width: window.innerWidth, height: window.innerHeight });
    expect(handle.canvas.width).toBe(Math.round(window.innerWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
    handle.destroy();
  });

  it('injects the void-tactical overlay stack styles and layers by default', () => {
    const handle = mount(document.body, { seed: 'orion-7' });
    expect(document.getElementById('bg-engine-styles')).not.toBeNull();
    const stack = handle.root.querySelector('.ambient-stack') as HTMLElement | null;
    expect(stack).not.toBeNull();
    expect(stack!.style.position).toBe('absolute');
    expect(stack!.querySelector('.space-gradient-base')).not.toBeNull();
    expect(stack!.querySelector('.noise-texture')).not.toBeNull();
    handle.destroy();
    expect(document.querySelector('.ambient-stack')).toBeNull();
  });

  it('lets void-tactical options turn overlay layers off', () => {
    const handle = mount(document.body, { options: { layers: { noise: false, mouseGlow: false } } });
    const stack = handle.root.querySelector('.ambient-stack')!;
    expect(stack.querySelector('.noise-texture')).toBeNull();
    expect(stack.querySelector('.mouse-glow-layer')).toBeNull();
    expect(stack.querySelector('.space-gradient-base')).not.toBeNull();
    handle.destroy();
  });

  it('loads fonts only when asked', () => {
    const { skin } = makeStubSkin();
    const a = mount(document.body, { skin });
    expect(document.querySelector('link[data-bg-engine-fonts]')).toBeNull();
    a.destroy();
    const b = mount(document.body, { skin, fonts: true });
    expect(document.querySelector('link[data-bg-engine-fonts]')).not.toBeNull();
    b.destroy();
  });

  it('tears everything down on destroy', () => {
    const { skin, rec } = makeStubSkin();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const handle = mount(document.body, { skin });
    handle.destroy();
    handle.destroy(); // idempotent

    expect(document.querySelector('.bg-engine-root')).toBeNull();
    expect(rec.destroyed).toBe(1);
    expect(rec.layersDestroyed).toBe(1);
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('createBackground()', () => {
  it('lets a bare canvas fill its parent instead of staying at 300x150', () => {
    const wrapper = document.createElement('div');
    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    const { skin } = makeStubSkin();
    const handle = createBackground(canvas, { skin });
    expect(canvas.style.width).toBe('100%');
    expect(canvas.style.height).toBe('100%');
    handle.destroy();
  });

  it('creates and positions a canvas inside a container', () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    const { skin } = makeStubSkin();
    const handle = createBackground(wrapper, { skin });
    expect(handle.canvas.parentElement).toBe(wrapper);
    expect(handle.canvas.style.position).toBe('absolute');
    expect(wrapper.style.position).toBe('relative');
    handle.destroy();
  });
});
