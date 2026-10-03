/**
 * Synth voices: every sound the soundscape makes, built from oscillators, noise, filters,
 * and envelopes. No samples, so the module stays a few KB.
 *
 * A voice schedules its nodes at time `at` into `out` (a panner the soundscape made for
 * it) and stops them itself. `gain` is the peak level; `freq` turns semitones above the
 * palette's root into Hz.
 *
 *   boom     noise through a closing lowpass, with a sub drop        explosions
 *   ping     a short tone, optionally a second one and echoes        radio, alerts, signals
 *   bell     two-operator FM, slightly inharmonic                    captures, songs, births
 *   sweep    an oscillator gliding through a bandpass                sirens, surges, beams
 *   whoosh   noise through a sweeping bandpass                       jumps, flares, wind
 *   thump    a pitched-down sine with a click                        docks, artillery, hits
 *   choir    detuned saws through vowel formants                     the Choir, horns
 *   crackle  a scatter of tiny noise grains                          gunfire, mines, static
 */

export type Cue =
  | { kind: 'boom'; dur?: number; tone?: number; sub?: number }
  | { kind: 'ping'; note?: number; wave?: OscillatorType; dur?: number; then?: number; echoes?: number }
  | { kind: 'bell'; note?: number; ratio?: number; dur?: number; chord?: number[] }
  | { kind: 'sweep'; from: number; to: number; dur?: number; wave?: OscillatorType; q?: number }
  | { kind: 'whoosh'; from: number; to: number; dur?: number }
  | { kind: 'thump'; dur?: number; pitch?: number }
  | { kind: 'choir'; note?: number; chord?: number[]; dur?: number; vowel?: 'ah' | 'oo' }
  | { kind: 'crackle'; dur?: number; rate?: number; tone?: number };

export type VoiceContext = {
  ctx: BaseAudioContext;
  out: AudioNode;
  at: number;
  gain: number;
  /** Semitones above the palette root, to Hz. */
  freq: (semitones: number) => number;
  /** A note from the palette's scale, for cues that leave `note` unset. */
  pick: () => number;
  rnd: () => number;
};

const SILENT = 0.0001;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, made once per context. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < d.length; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = (s / 2147483647) * 2 - 1;
    }
    noiseBuffers.set(ctx, b);
  }
  return b;
}

/** Attack to `peak`, then an exponential fall to silence. */
function envelope(p: AudioParam, at: number, peak: number, attack: number, decay: number): void {
  p.setValueAtTime(SILENT, at);
  p.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), at + attack);
  p.exponentialRampToValueAtTime(SILENT, at + attack + decay);
}

function amp(v: VoiceContext, peak: number, attack: number, decay: number): GainNode {
  const g = v.ctx.createGain();
  envelope(g.gain, v.at, peak, attack, decay);
  g.connect(v.out);
  return g;
}

function noiseSource(v: VoiceContext, at: number, dur: number): AudioBufferSourceNode {
  const src = v.ctx.createBufferSource();
  src.buffer = noiseBuffer(v.ctx);
  src.start(at, v.rnd() * 1.5);
  src.stop(at + dur + 0.05);
  return src;
}

function osc(v: VoiceContext, type: OscillatorType, hz: number, at: number, dur: number): OscillatorNode {
  const o = v.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(hz, at);
  o.start(at);
  o.stop(at + dur + 0.05);
  return o;
}

function filter(v: VoiceContext, type: BiquadFilterType, hz: number, q = 1): BiquadFilterNode {
  const f = v.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(hz, v.at);
  f.Q.value = q;
  return f;
}

/** Play one cue. Returns how long it rings, so the caller can count voices. */
export function playCue(v: VoiceContext, c: Cue): number {
  switch (c.kind) {
    case 'boom': {
      const dur = c.dur ?? 1.2;
      const lp = filter(v, 'lowpass', c.tone ?? 1600, 0.7);
      lp.frequency.exponentialRampToValueAtTime(70, v.at + dur);
      noiseSource(v, v.at, dur).connect(lp).connect(amp(v, v.gain, 0.006, dur));
      if (c.sub) {
        const o = osc(v, 'sine', 72, v.at, dur);
        o.frequency.exponentialRampToValueAtTime(26, v.at + dur * 0.8);
        o.connect(amp(v, v.gain * c.sub, 0.01, dur * 0.8));
      }
      return dur;
    }
    case 'ping': {
      const dur = c.dur ?? 0.3;
      const hz = v.freq(c.note ?? v.pick());
      const echoes = c.echoes ?? 0;
      // The tone, then (optionally) a second tone, then fading repeats.
      const tones: [number, number, number][] = [[hz, 0, 1]];
      if (c.then !== undefined) tones.push([hz * 2 ** (c.then / 12), dur * 0.7, 1]);
      for (let i = 1; i <= echoes; i++) tones.push([hz, i * 0.22, 0.45 ** i]);
      for (const [f, delay, k] of tones) {
        const at = v.at + delay;
        const g = v.ctx.createGain();
        envelope(g.gain, at, v.gain * k, 0.004, dur);
        g.connect(v.out);
        osc(v, c.wave ?? 'sine', f, at, dur).connect(g);
      }
      return dur + (echoes ? echoes * 0.22 : 0) + (c.then !== undefined ? dur : 0);
    }
    case 'bell': {
      const dur = c.dur ?? 2.4;
      for (const n of c.chord ?? [0]) {
        const hz = v.freq((c.note ?? v.pick()) + n);
        const carrier = osc(v, 'sine', hz, v.at, dur);
        const mod = osc(v, 'sine', hz * (c.ratio ?? 1.41), v.at, dur);
        const depth = v.ctx.createGain();
        envelope(depth.gain, v.at, hz * 2.2, 0.002, dur * 0.6);
        mod.connect(depth).connect(carrier.frequency);
        carrier.connect(amp(v, v.gain / Math.sqrt((c.chord ?? [0]).length), 0.004, dur));
      }
      return dur;
    }
    case 'sweep': {
      const dur = c.dur ?? 0.8;
      const o = osc(v, c.wave ?? 'sawtooth', c.from, v.at, dur);
      o.frequency.exponentialRampToValueAtTime(c.to, v.at + dur);
      const bp = filter(v, 'bandpass', Math.sqrt(c.from * c.to), c.q ?? 1.5);
      o.connect(bp).connect(amp(v, v.gain, 0.02, dur));
      return dur;
    }
    case 'whoosh': {
      const dur = c.dur ?? 1.4;
      const bp = filter(v, 'bandpass', c.from, 2.5);
      bp.frequency.exponentialRampToValueAtTime(c.to, v.at + dur);
      const g = v.ctx.createGain();
      g.gain.setValueAtTime(SILENT, v.at);
      g.gain.linearRampToValueAtTime(v.gain, v.at + dur * 0.45);
      g.gain.linearRampToValueAtTime(0, v.at + dur);
      g.connect(v.out);
      noiseSource(v, v.at, dur).connect(bp).connect(g);
      return dur;
    }
    case 'thump': {
      const dur = c.dur ?? 0.45;
      const o = osc(v, 'sine', c.pitch ?? 120, v.at, dur);
      o.frequency.exponentialRampToValueAtTime(36, v.at + 0.16);
      o.connect(amp(v, v.gain, 0.003, dur));
      const hp = filter(v, 'highpass', 2500);
      noiseSource(v, v.at, 0.03).connect(hp).connect(amp(v, v.gain * 0.4, 0.001, 0.03));
      return dur;
    }
    case 'choir': {
      const dur = c.dur ?? 3.5;
      const [f1, f2] = c.vowel === 'oo' ? [360, 820] : [720, 1150];
      const bus = v.ctx.createGain();
      bus.gain.setValueAtTime(SILENT, v.at);
      bus.gain.linearRampToValueAtTime(v.gain, v.at + dur * 0.35);
      bus.gain.setValueAtTime(v.gain, v.at + dur * 0.6);
      bus.gain.linearRampToValueAtTime(0, v.at + dur);
      bus.connect(v.out);
      const a = filter(v, 'bandpass', f1, 5);
      const b = filter(v, 'bandpass', f2, 7);
      a.connect(bus);
      b.connect(bus);
      for (const n of c.chord ?? [0, 7]) {
        const hz = v.freq((c.note ?? v.pick()) + n);
        for (const cents of [-9, 8]) {
          const o = osc(v, 'sawtooth', hz, v.at, dur);
          o.detune.value = cents;
          o.connect(a);
          o.connect(b);
        }
      }
      return dur;
    }
    case 'crackle': {
      const dur = c.dur ?? 0.8;
      const n = Math.max(1, Math.round(dur * (c.rate ?? 18)));
      const hp = filter(v, 'highpass', c.tone ?? 1200, 0.8);
      hp.connect(v.out);
      for (let i = 0; i < n; i++) {
        const at = v.at + v.rnd() * dur;
        const g = v.ctx.createGain();
        envelope(g.gain, at, v.gain * (0.4 + v.rnd() * 0.6), 0.001, 0.03 + v.rnd() * 0.05);
        g.connect(hp);
        noiseSource(v, at, 0.09).connect(g);
      }
      return dur;
    }
  }
}
