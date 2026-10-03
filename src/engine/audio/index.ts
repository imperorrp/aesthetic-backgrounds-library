/**
 * Sound for backgrounds: opt-in, generated, a few KB.
 *
 *   import { createSoundscape } from 'space-background-engine/audio';
 *
 *   const sound = createSoundscape({ palette: 'siege', volume: 0.5 });
 *   sound.attach(handle);                       // any mount handle: listens to handle.onEvent
 *   button.onclick = () => sound.start();       // browsers allow audio only after a gesture
 *   sound.setPalette('choir'); sound.setVolume(0.3); sound.stop(); sound.destroy();
 *
 * What it does with each event:
 *   1. find the palette's binding for the event type; no binding, no sound
 *   2. skip it if the same binding sounded too recently (`every`) or too much is ringing
 *   3. loudness = binding gain × (0.4 + 0.6 × weight) × nearness × volume
 *   4. pan it to where it happened across the screen, play its cue(s), and send some of
 *      it to a generated reverb
 * A palette's drone plays underneath while the soundscape runs. Audio suspends while
 * the tab is hidden.
 */
import type { SkinEvent } from '../core/skin';
import { playCue, type Cue } from './synth';
import { soundPaletteFor, type SoundPalette } from './palettes';

export { SOUND_PALETTES, registerSoundPalette, soundPaletteFor } from './palettes';
export type { Binding, SoundPalette } from './palettes';
export type { Cue } from './synth';

export type SoundscapeOptions = {
  /** A palette id ('void', 'saltwind', 'choir', 'siege', or your own) or a palette. Default 'void'. */
  palette?: string | SoundPalette;
  /** 0..1. Default 0.6. */
  volume?: number;
  /** Bring your own AudioContext (otherwise one is made on `start`). */
  context?: AudioContext;
};

export type Soundscape = {
  /** Listen to a handle's events (detaching from any previous one). Returns a detach function. */
  attach(source: { onEvent(listener: (e: SkinEvent) => void): () => void }): () => void;
  /** Start sound. Call it from a click or key press: browsers block audio until a gesture. */
  start(): Promise<void>;
  /** Fade out and suspend. */
  stop(): void;
  readonly playing: boolean;
  setVolume(v: number): void;
  setPalette(p: string | SoundPalette): void;
  /** Sound one event by hand (your own triggers, or trying a palette). */
  play(e: SkinEvent): void;
  destroy(): void;
};

/** At most this many cues ring at once; past it, new ones are dropped. */
const MAX_RINGING = 24;

export function createSoundscape(opts: SoundscapeOptions = {}): Soundscape {
  let palette = typeof opts.palette === 'object' ? opts.palette : soundPaletteFor(opts.palette);
  let volume = clamp01(opts.volume ?? 0.6);
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let wetIn: GainNode | null = null;
  let reverb: ConvolverNode | null = null;
  let drone: { stop(): void } | null = null;
  let detach: (() => void) | null = null;
  let playing = false;
  const last = new Map<string, number>();
  let ringing: number[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const freq = (semitones: number) => palette.root * 2 ** (semitones / 12);
  const pick = () => palette.scale[Math.floor(rnd() * palette.scale.length)];

  /** A decaying stereo noise tail: a cheap, convincing room. */
  const impulse = (c: AudioContext, seconds: number) => {
    const len = Math.max(1, Math.floor(c.sampleRate * seconds));
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * (1 - i / len) ** 3;
    }
    return b;
  };

  /** master → compressor → speakers; a reverb send beside the dry path. */
  const build = () => {
    const c = opts.context ?? new AudioContext();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.connect(c.destination);
    master = c.createGain();
    master.gain.value = 0;
    master.connect(comp);
    reverb = c.createConvolver();
    reverb.buffer = impulse(c, palette.space);
    wetIn = c.createGain();
    wetIn.gain.value = palette.wet;
    wetIn.connect(reverb).connect(master);
    ctx = c;
  };

  const startDrone = () => {
    const d = palette.drone;
    if (!d || !ctx || !master || !wetIn) return;
    const c = ctx;
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(d.level, t + 4);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = d.cutoff;
    lp.Q.value = 2;
    // A slow wobble on the filter keeps the bed breathing.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.04 + d.wobble * 0.08;
    const depth = c.createGain();
    depth.gain.value = d.cutoff * 0.5 * d.wobble;
    lfo.connect(depth).connect(lp.frequency);
    const oscs = d.notes.map((n, i) => {
      const o = c.createOscillator();
      o.type = d.wave;
      o.frequency.value = freq(n);
      o.detune.value = (i % 2 ? 7 : -7) * d.wobble;
      o.connect(lp);
      return o;
    });
    lp.connect(g);
    g.connect(master);
    g.connect(wetIn);
    for (const o of [...oscs, lfo]) o.start(t);
    drone = {
      stop() {
        const now = c.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + 1.5);
        for (const o of [...oscs, lfo]) o.stop(now + 1.6);
      },
    };
  };

  const fade = (to: number, seconds: number) => {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(to, now + seconds);
  };

  const onVisibility = () => {
    if (!ctx || !playing) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  const play = (e: SkinEvent) => {
    if (!playing || !ctx || !wetIn || !master) return;
    const b = palette.cues[e.type];
    if (!b) return;
    if (b.only && (e.priority === 'low' || e.priority === undefined || (b.only === 'high' && e.priority !== 'high'))) return;
    const now = ctx.currentTime;
    if (now - (last.get(e.type) ?? -Infinity) < (b.every ?? 0.1)) return;
    ringing = ringing.filter((end) => end > now);
    if (ringing.length >= MAX_RINGING) return;
    // Explosions scale with what blew up.
    const k = e.size ? Math.min(1.6, 0.5 + e.size * 0.5) : 1;
    const gain = (b.gain ?? 0.1) * (0.4 + 0.6 * clamp01(e.weight)) * clamp01(e.near ?? 1) * k;
    if (gain < 0.003) return;
    last.set(e.type, now);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, e.pan * 0.8));
    pan.connect(master);
    const send = ctx.createGain();
    send.gain.value = 1;
    pan.connect(send).connect(wetIn);
    let longest = 0;
    for (const cue of Array.isArray(b.cue) ? b.cue : [b.cue]) {
      const c: Cue = cue.kind === 'boom' && k !== 1 ? { ...cue, dur: (cue.dur ?? 1.2) * k } : cue;
      longest = Math.max(longest, playCue({ ctx, out: pan, at: now + 0.01, gain, freq, pick, rnd }, c));
    }
    ringing.push(now + longest);
    // Let the graph drop this voice once it has rung out.
    setTimeout(() => {
      pan.disconnect();
      send.disconnect();
    }, (longest + palette.space + 0.5) * 1000);
  };

  return {
    attach(source) {
      detach?.();
      const off = source.onEvent(play);
      detach = () => {
        off();
        detach = null;
      };
      return detach;
    },
    async start() {
      if (!ctx) build();
      await ctx!.resume();
      if (playing) return;
      playing = true;
      fade(volume, 0.8);
      startDrone();
    },
    stop() {
      if (!playing || !ctx) return;
      playing = false;
      fade(0, 0.4);
      drone?.stop();
      drone = null;
      const c = ctx;
      setTimeout(() => {
        if (!playing) void c.suspend();
      }, 1700);
    },
    get playing() {
      return playing;
    },
    setVolume(v) {
      volume = clamp01(v);
      if (playing) fade(volume, 0.2);
    },
    setPalette(p) {
      const next = typeof p === 'object' ? p : soundPaletteFor(p);
      if (next === palette) return;
      palette = next;
      if (ctx && reverb && wetIn) {
        reverb.buffer = impulse(ctx, palette.space);
        wetIn.gain.value = palette.wet;
      }
      if (playing) {
        drone?.stop();
        startDrone();
      }
    },
    play,
    destroy() {
      detach?.();
      playing = false;
      drone?.stop();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      if (ctx && !opts.context) void ctx.close();
      ctx = null;
    },
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}
