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
 *   4. shape it by distance: far events are darker and sit deeper in the reverb
 *   5. pan it to where it happened across the screen; tonal cues land on the palette's
 *      grid (a quiet pulse) so the result sounds composed rather than random
 *
 * Under every event, a palette's drone (stereo, slowly breathing) and an optional noise
 * bed (rain, wind, a hull's hum) play while the soundscape runs. 'ambience' events (a
 * weight from 0 to 1, e.g. how hard it is raining) open the bed and brighten the drone.
 * Big hits duck the bed for a moment, the way a mix makes room for an explosion.
 *
 * The graph:
 *   voice → distance lowpass → panner ─┬→ dry ─────────────────┐
 *                                      ├→ reverb send → room ──┤
 *                                      └→ delay send → echoes ─┤
 *   drone + bed → duck ────────────────────────────────────────┤
 *                                                              ▼
 *        mix → rumble cut → soft saturation → glue compressor → limiter → volume → out
 */
import type { SkinEvent } from '../core/skin';
import { noiseBuffer, playCue, type Cue } from './synth';
import { soundPaletteFor, type SoundPalette } from './palettes';

export { SOUND_PALETTES, registerSoundPalette, soundPaletteFor } from './palettes';
export type { Binding, SoundPalette } from './palettes';
export type { Cue } from './synth';

export type SoundscapeOptions = {
  /** A palette id ('void', 'saltwind', 'choir', 'siege', 'undercity', 'sonar', ..., or your own) or a palette. Default 'void'. */
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
/** Cue kinds that are notes (and so land on the grid); impacts and noise play at once. */
const TONAL = new Set(['ping', 'bell', 'choir']);

type Bus = {
  mix: GainNode;
  master: GainNode;
  reverb: ConvolverNode;
  reverbIn: GainNode;
  delayIn: GainNode;
  delays: [DelayNode, DelayNode];
  duck: GainNode;
};

export function createSoundscape(opts: SoundscapeOptions = {}): Soundscape {
  let palette = typeof opts.palette === 'object' ? opts.palette : soundPaletteFor(opts.palette);
  let volume = clamp01(opts.volume ?? 0.6);
  let ctx: AudioContext | null = null;
  let bus: Bus | null = null;
  let bed: { stop(): void; ambience(k: number): void } | null = null;
  let detach: (() => void) | null = null;
  let playing = false;
  let ambience = 0.5;
  const last = new Map<string, number>();
  let ringing: number[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const freq = (semitones: number) => palette.root * 2 ** (semitones / 12);
  const pick = () => palette.scale[Math.floor(rnd() * palette.scale.length)];

  /**
   * A room: stereo noise, decorrelated per channel, after a short pre-delay, with a few
   * early reflections, decaying 60 dB over `seconds`, and losing its highs faster than its
   * lows (a one-pole lowpass that closes as the tail goes on), as real rooms do.
   */
  const impulse = (c: BaseAudioContext, seconds: number) => {
    const rate = c.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const pre = Math.floor(rate * 0.018);
    const b = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      let energy = 0;
      for (let i = pre; i < len; i++) {
        const x = (i - pre) / (len - pre);
        const k = 0.35 + 0.6 * x;
        lp = lp * k + (rnd() * 2 - 1) * (1 - k);
        let s = lp * Math.exp(-6.9 * x) * (1 + 1.6 * (1 - k));
        // Early reflections: a sparse scatter in the first 70 ms.
        if (i < pre + rate * 0.07 && rnd() < 0.002) s += (rnd() * 2 - 1) * 0.6;
        d[i] = s;
        energy += s * s;
      }
      const norm = 1 / Math.sqrt(Math.max(1e-9, energy / rate));
      for (let i = 0; i < len; i++) d[i] *= norm * 0.35;
    }
    return b;
  };

  const build = () => {
    const c = opts.context ?? new AudioContext({ latencyHint: 'playback' });
    // The master chain.
    const rumble = c.createBiquadFilter();
    rumble.type = 'highpass';
    rumble.frequency.value = 28;
    rumble.Q.value = 0.6;
    const sat = c.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.3) / Math.tanh(1.3);
    }
    sat.curve = curve;
    sat.oversample = '2x';
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 12;
    glue.ratio.value = 3;
    glue.attack.value = 0.02;
    glue.release.value = 0.35;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    const master = c.createGain();
    master.gain.value = 0;
    const mix = c.createGain();
    mix.connect(rumble).connect(sat).connect(glue).connect(limiter).connect(master).connect(c.destination);
    // The room, with its mud cut.
    const reverbIn = c.createGain();
    const reverb = c.createConvolver();
    reverb.buffer = impulse(c, palette.space);
    const roomCut = c.createBiquadFilter();
    roomCut.type = 'highpass';
    roomCut.frequency.value = 160;
    reverbIn.connect(reverb).connect(roomCut).connect(mix);
    // Echoes: a ping-pong delay, darker with each repeat.
    const delayIn = c.createGain();
    const dl = c.createDelay(2);
    const dr = c.createDelay(2);
    const fbl = c.createGain();
    const fbr = c.createGain();
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    fbl.gain.value = 0.38;
    fbr.gain.value = 0.38;
    const merger = c.createChannelMerger(2);
    delayIn.connect(dl);
    dl.connect(damp).connect(fbl).connect(dr);
    dr.connect(fbr).connect(dl);
    dl.connect(merger, 0, 0);
    dr.connect(merger, 0, 1);
    const delayOut = c.createGain();
    delayOut.gain.value = 0.7;
    merger.connect(delayOut).connect(mix);
    merger.connect(reverbIn);
    const duck = c.createGain();
    duck.connect(mix);
    bus = { mix, master, reverb, reverbIn, delayIn, delays: [dl, dr], duck };
    ctx = c;
    tune();
  };

  /** Fit the room and the echo to the palette. */
  const tune = () => {
    if (!ctx || !bus) return;
    bus.reverb.buffer = impulse(ctx, palette.space);
    const time = palette.echo ?? 0.34;
    bus.delays[0].delayTime.value = time;
    bus.delays[1].delayTime.value = time;
  };

  /** The drone (three detuned voices per note, spread across the stereo field) and the noise bed. */
  const startBed = () => {
    if (!ctx || !bus) return;
    const c = ctx;
    const b = bus;
    const t = c.currentTime;
    const d = palette.drone;
    /** Everything to stop later; `oscs` still need starting (the bed's noise starts itself). */
    const stops: AudioScheduledSourceNode[] = [];
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    let filter: BiquadFilterNode | null = null;
    if (d) {
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(d.level, t + 5);
      gains.push(g);
      filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = d.cutoff;
      filter.Q.value = 0.9;
      // It breathes: a slow wobble on the filter and a slower one on the level.
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.04 + d.wobble * 0.06;
      const depth = c.createGain();
      depth.gain.value = d.cutoff * 0.45 * d.wobble;
      lfo.connect(depth).connect(filter.frequency);
      const breath = c.createGain();
      const blfo = c.createOscillator();
      blfo.frequency.value = 0.07;
      const bdepth = c.createGain();
      bdepth.gain.value = 0.18;
      blfo.connect(bdepth).connect(breath.gain);
      oscs.push(lfo, blfo);
      d.notes.forEach((n) => {
        for (const [cents, pan] of [[-7, -0.55], [0, 0], [6, 0.55]] as const) {
          const o = c.createOscillator();
          o.type = d.wave;
          o.frequency.value = freq(n);
          o.detune.value = cents * (0.4 + d.wobble);
          const p = c.createStereoPanner();
          p.pan.value = pan;
          o.connect(p).connect(filter!);
          oscs.push(o);
        }
      });
      filter.connect(breath).connect(g);
      g.connect(b.duck);
      const send = c.createGain();
      send.gain.value = palette.wet;
      g.connect(send).connect(b.reverbIn);
    }
    let bedGain: GainNode | null = null;
    const bd = palette.bed;
    if (bd) {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, bd.noise);
      src.loop = true;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = bd.lo;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = bd.hi;
      bedGain = c.createGain();
      bedGain.gain.setValueAtTime(0, t);
      bedGain.gain.linearRampToValueAtTime(bd.level * (bd.follow ? 0.3 + 0.7 * ambience : 1), t + 4);
      // Rain and wind are wide: decorrelate the channels with a few ms of delay on one side.
      const split = c.createChannelSplitter(2);
      const merge = c.createChannelMerger(2);
      const wide = c.createDelay(0.05);
      wide.delayTime.value = 0.011;
      src.connect(hp).connect(lp).connect(bedGain);
      bedGain.connect(split);
      split.connect(merge, 0, 0);
      split.connect(wide, 0).connect(merge, 0, 1);
      merge.connect(b.duck);
      src.start(t, rnd() * 3);
      stops.push(src);
      gains.push(bedGain);
    }
    for (const o of oscs) {
      o.start(t);
      stops.push(o);
    }
    bed = {
      stop() {
        const now = c.currentTime;
        for (const g of gains) {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.linearRampToValueAtTime(0, now + 1.5);
        }
        for (const s of stops) s.stop(now + 1.6);
      },
      ambience(k) {
        const now = c.currentTime;
        if (filter && d) filter.frequency.setTargetAtTime(d.cutoff * (0.7 + 0.6 * k), now, 2);
        if (bedGain && bd?.follow) bedGain.gain.setTargetAtTime(bd.level * (0.3 + 0.7 * k), now, 1.5);
      },
    };
  };

  const fade = (to: number, seconds: number) => {
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    bus.master.gain.cancelScheduledValues(now);
    bus.master.gain.setValueAtTime(bus.master.gain.value, now);
    bus.master.gain.linearRampToValueAtTime(to, now + seconds);
  };

  const onVisibility = () => {
    if (!ctx || !playing) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  const play = (e: SkinEvent) => {
    if (!playing || !ctx || !bus) return;
    if (e.type === 'ambience') {
      ambience = clamp01(e.weight);
      bed?.ambience(ambience);
      return;
    }
    const b = palette.cues[e.type];
    if (!b) return;
    if (b.only && (e.priority === 'low' || e.priority === undefined || (b.only === 'high' && e.priority !== 'high'))) return;
    const c = ctx;
    const now = c.currentTime;
    if (now - (last.get(e.type) ?? -Infinity) < (b.every ?? 0.1)) return;
    ringing = ringing.filter((end) => end > now);
    if (ringing.length >= MAX_RINGING) return;
    // Explosions scale with what blew up.
    const k = e.size ? Math.min(1.6, 0.5 + e.size * 0.5) : 1;
    const near = clamp01(e.near ?? 1);
    const gain = (b.gain ?? 0.1) * (0.4 + 0.6 * clamp01(e.weight)) * (0.25 + 0.75 * near) * k;
    if (gain < 0.003) return;
    last.set(e.type, now);
    // Distance: far away is darker, quieter in the dry signal, and deeper in the room.
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900 + 17000 * near * near;
    lp.Q.value = 0.5;
    const pan = c.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, e.pan * 0.85));
    lp.connect(pan);
    const dry = c.createGain();
    dry.gain.value = 0.55 + 0.45 * near;
    pan.connect(dry).connect(bus.mix);
    const wet = c.createGain();
    wet.gain.value = palette.wet * (0.6 + 0.9 * (1 - near));
    pan.connect(wet).connect(bus.reverbIn);
    const sends: AudioNode[] = [lp, pan, dry, wet];
    const echo = (node: AudioNode, amount: number) => {
      const s = c.createGain();
      s.gain.value = amount;
      node.connect(s).connect(bus!.delayIn);
      sends.push(s);
    };
    let longest = 0;
    for (const cue of Array.isArray(b.cue) ? b.cue : [b.cue]) {
      const shaped: Cue = cue.kind === 'boom' && k !== 1 ? { ...cue, dur: (cue.dur ?? 1.2) * k } : cue;
      // Notes land on the palette's quiet pulse, if it has one.
      let at = now + 0.012;
      if (palette.grid && TONAL.has(cue.kind)) at = Math.ceil(at / palette.grid) * palette.grid;
      longest = Math.max(longest, at - now + playCue({ ctx: c, out: lp, at, gain, freq, pick, rnd, echo }, shaped));
    }
    ringing.push(now + longest);
    // Big hits make room for themselves: the beds dip and come back.
    if (gain > 0.12 && (Array.isArray(b.cue) ? b.cue : [b.cue]).some(isImpact)) {
      const g = bus.duck.gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(0.5, now, 0.02);
      g.setTargetAtTime(1, now + 0.25, 0.9);
    }
    // Let the graph drop this voice once it has rung out.
    setTimeout(() => {
      for (const n of sends) n.disconnect();
    }, (longest + palette.space + 2) * 1000);
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
      try {
        await ctx!.resume();
      } catch {
        // An offline context (the sound check) cannot resume before it renders.
      }
      if (playing) return;
      playing = true;
      fade(volume, 1);
      startBed();
    },
    stop() {
      if (!playing || !ctx) return;
      playing = false;
      fade(0, 0.5);
      bed?.stop();
      bed = null;
      const c = ctx;
      setTimeout(() => {
        if (!playing) void c.suspend();
      }, 1800);
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
      tune();
      if (playing) {
        bed?.stop();
        startBed();
      }
    },
    play,
    destroy() {
      detach?.();
      playing = false;
      bed?.stop();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      if (ctx && !opts.context) void ctx.close();
      ctx = null;
      bus = null;
    },
  };
}

function isImpact(c: Cue): boolean {
  return c.kind === 'boom' || c.kind === 'thump';
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}
