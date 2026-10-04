/**
 * The soundscape against a fake AudioContext that only counts what gets made: which
 * events sound, which are filtered or rate-limited, and that the drone runs while playing.
 */
import { describe, expect, it } from 'vitest';
import { createSoundscape, SOUND_PALETTES, soundPaletteFor } from './index';
import type { SkinEvent } from '../core/skin';

class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  pan = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  playbackRate = new FakeParam();
  type = '';
  buffer: unknown = null;
  constructor(private ctx: FakeContext, readonly kind: string) {
    ctx.made[kind] = (ctx.made[kind] ?? 0) + 1;
  }
  connect<T>(n: T): T {
    return n;
  }
  disconnect() {}
  start() {
    this.ctx.started++;
  }
  stop() {}
}

class FakeContext {
  made: Record<string, number> = {};
  started = 0;
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  state = 'suspended';
  createGain = () => new FakeNode(this, 'gain');
  createOscillator = () => new FakeNode(this, 'osc');
  createBufferSource = () => new FakeNode(this, 'noise');
  createBiquadFilter = () => new FakeNode(this, 'filter');
  createStereoPanner = () => new FakeNode(this, 'pan');
  createConvolver = () => new FakeNode(this, 'reverb');
  createDynamicsCompressor = () => new FakeNode(this, 'comp');
  createBuffer = (channels: number, length: number) => ({ getChannelData: () => new Float32Array(length), numberOfChannels: channels });
  resume = async () => {
    this.state = 'running';
  };
  suspend = async () => {
    this.state = 'suspended';
  };
  close = async () => {};
}

const ev = (type: string, extra: Partial<SkinEvent> = {}): SkinEvent => ({ type, weight: 0.8, pan: 0, near: 1, ...extra });

const setup = async (palette = 'void') => {
  const ctx = new FakeContext();
  const sound = createSoundscape({ palette, context: ctx as unknown as AudioContext });
  await sound.start();
  return { ctx, sound };
};

describe('soundscape', () => {
  it('starts the drone and sounds bound events, panned', async () => {
    const { ctx, sound } = await setup();
    const oscBefore = ctx.made.osc ?? 0;
    expect(oscBefore).toBeGreaterThan(0); // the drone
    sound.play(ev('explosion', { size: 2 }));
    expect(ctx.made.pan).toBe(1);
    expect(ctx.made.noise).toBeGreaterThan(0);
    sound.destroy();
  });

  it('ignores events with no binding, low-priority lines, and anything while stopped', async () => {
    const { ctx, sound } = await setup();
    sound.play(ev('nothing-like-this'));
    sound.play(ev('say', { priority: 'low' }));
    sound.play(ev('say', { priority: 'medium' }));
    expect(ctx.made.pan ?? 0).toBe(0);
    sound.play(ev('say', { priority: 'high' }));
    expect(ctx.made.pan).toBe(1);
    sound.stop();
    sound.play(ev('explosion'));
    expect(ctx.made.pan).toBe(1);
    sound.destroy();
  });

  it('rate-limits a busy event type, and lets it through again later', async () => {
    const { ctx, sound } = await setup();
    for (let i = 0; i < 10; i++) sound.play(ev('combat'));
    expect(ctx.made.pan).toBe(1);
    ctx.currentTime += 2;
    sound.play(ev('combat'));
    expect(ctx.made.pan).toBe(2);
    sound.destroy();
  });

  it('skips what is too faint to hear', async () => {
    const { ctx, sound } = await setup();
    sound.play(ev('launch', { weight: 0, near: 0.02 }));
    expect(ctx.made.pan ?? 0).toBe(0);
    sound.destroy();
  });

  it('has a palette per universe and falls back to the sector map', () => {
    for (const id of ['void', 'saltwind', 'choir', 'siege', 'hive', 'lastfleet', 'cradle']) expect(soundPaletteFor(id).id).toBe(id);
    expect(soundPaletteFor('nowhere')).toBe(SOUND_PALETTES.void);
    expect(SOUND_PALETTES.siege.cues.bombard).toBeTruthy();
    expect(SOUND_PALETTES.choir.cues.song).toBeTruthy();
  });

  it('switching palettes restarts the drone in the new key', async () => {
    const { ctx, sound } = await setup('void');
    const before = ctx.made.osc;
    sound.setPalette('choir');
    expect(ctx.made.osc).toBeGreaterThan(before);
    sound.destroy();
  });

  it('follows whatever it is attached to, one source at a time', async () => {
    const { ctx, sound } = await setup();
    const listeners = new Set<(e: SkinEvent) => void>();
    const source = { onEvent: (fn: (e: SkinEvent) => void) => (listeners.add(fn), () => listeners.delete(fn)) };
    sound.attach(source);
    sound.attach(source);
    expect(listeners.size).toBe(1);
    for (const fn of listeners) fn(ev('capture'));
    expect(ctx.made.pan).toBe(1);
    sound.destroy();
    expect(listeners.size).toBe(0);
  });
});
