// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { background } from './svelte';
import { BackgroundPlugin, vBackground } from './vue';
import { mount } from '../engine/core/mount';
import { installCanvasStub } from '../test/canvas-stub';

beforeAll(() => installCanvasStub());
afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
});

const box = () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
};

describe('svelte action', () => {
  it('mounts, remounts only on real changes, and destroys', () => {
    const el = box();
    const action = background(el, { skin: 'calm-mesh', seed: 'a' });
    const first = el.querySelector('.bg-engine-root');
    expect(first).not.toBeNull();
    action.update({ skin: 'calm-mesh', seed: 'a' });
    expect(el.querySelector('.bg-engine-root')).toBe(first);
    action.update({ skin: 'aurora-night', seed: 'a' });
    expect(el.querySelector('.bg-engine-root')).not.toBe(first);
    expect(el.querySelectorAll('.bg-engine-root')).toHaveLength(1);
    action.destroy();
    expect(el.querySelector('.bg-engine-root')).toBeNull();
  });
});

describe('vue directive', () => {
  it('follows the mounted/updated/unmounted lifecycle', () => {
    const el = box();
    vBackground.mounted(el, { value: { skin: 'deep-field', seed: 'v' } });
    const first = el.querySelector('.bg-engine-root');
    expect(first).not.toBeNull();
    vBackground.updated(el, { value: { skin: 'deep-field', seed: 'v' } });
    expect(el.querySelector('.bg-engine-root')).toBe(first);
    vBackground.updated(el, { value: { skin: 'deep-field', seed: 'w' } });
    expect(el.querySelector('.bg-engine-root')).not.toBe(first);
    vBackground.unmounted(el);
    expect(el.querySelector('.bg-engine-root')).toBeNull();
  });

  it('registers as a plugin', () => {
    const registered: Record<string, unknown> = {};
    BackgroundPlugin.install({ directive: (name, def) => (registered[name] = def) });
    expect(registered.background).toBe(vBackground);
  });
});

describe('exposeTokens', () => {
  it('writes palette tokens on <html> and removes them on destroy', () => {
    const handle = mount(box(), { skin: 'calm-mesh', exposeTokens: true });
    const html = document.documentElement;
    expect(html.style.getPropertyValue('--bge-accent')).toMatch(/^#/);
    expect(html.style.getPropertyValue('--bge-accent2-rgb')).toMatch(/^\d+ \d+ \d+$/);
    expect(html.dataset.bgeTheme).toBe('light');
    handle.destroy();
    expect(html.style.getPropertyValue('--bge-accent')).toBe('');
    expect(html.dataset.bgeTheme).toBeUndefined();
  });

  it('can target a specific element', () => {
    const target = box();
    const handle = mount(box(), { skin: 'deep-field', exposeTokens: target });
    expect(target.style.getPropertyValue('--bge-bg')).toMatch(/^#/);
    expect(document.documentElement.style.getPropertyValue('--bge-bg')).toBe('');
    handle.destroy();
  });
});
