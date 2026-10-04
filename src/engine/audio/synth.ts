/**
 * Synth voices: every sound the soundscape makes, built from oscillators, colored noise,
 * filters, and envelopes. No samples, so the module stays a few KB.
 *
 * A voice schedules its nodes at time `at` into `out` (the soundscape's per-voice chain:
 * distance filter, panner, sends) and stops them itself. `gain` is the peak level; `freq`
 * turns semitones above the palette's root into Hz; `echo(amount)` sends the voice to the
 * shared ping-pong delay.
 *
 *   boom     a brown-noise body under a closing lowpass, a pink-noise crack, a sub drop
 *   ping     a soft-attack tone with faint upper partials; echoes go to the delay
 *   bell     two-operator FM with a detuned twin, so it shimmers as it decays
 *   sweep    a filtered oscillator gliding through a bandpass, with vibrato when long
 *   whoosh   pink noise through a sweeping bandpass
 *   thump    a pitched-down sine with a click and a little body
 *   choir    detuned saws with vibrato through three vowel formants
 *   crackle  grains of pink noise at varying speeds through one bandpass
 */

export type Cue =
  | { kind: 'boom'; dur?: number; tone?: number; sub?: number }
  | { kind: 'ping'; note?: number; wave?: OscillatorType; dur?: number; then?: number; echoes?: number }
  | { kind: 'bell'; note?: number; ratio?: number; dur?: number; chord?: number[] }
  | { kind: 'sweep'; from: number; to: number; dur?: number; wave?: OscillatorType; q?: number }
  | { kind: 'whoosh'; from: number; to: number; dur?: number }
  | { kind: 'thump'; dur?: number; pitch?: number }
  | { kind: 'choir'; note?: number; chord?: number[]; dur?: number; vowel?: 'ah' | 'oo' | 'ee' }
  | { kind: 'crackle'; dur?: number; rate?: number; tone?: number };

export type NoiseColor = 'white' | 'pink' | 'brown';

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
  /** Send a node to the shared echo (ping-pong delay) at this level. */
  echo: (node: AudioNode, amount: number) => void;
};

const SILENT = 0.0001;
const noiseBuffers = new WeakMap<BaseAudioContext, Record<NoiseColor, AudioBuffer>>();

/**
 * Four seconds each of white, pink (Kellet's filter: equal energy per octave, softer than
 * white), and brown (integrated white: deep, like surf or a distant engine) noise, made
 * once per context.
 */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  let set = noiseBuffers.get(ctx);
  if (!set) {
    const len = ctx.sampleRate * 4;
    const make = () => ctx.createBuffer(1, len, ctx.sampleRate);
    const white = make();
    const pink = make();
    const brown = make();
    const w = white.getChannelData(0);
    const p = pink.getChannelData(0);
    const b = brown.getChannelData(0);
    let s = 22222;
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    let last = 0;
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647;
      const x = (s / 2147483647) * 2 - 1;
      w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179;
      b1 = 0.99332 * b1 + x * 0.0750759;
      b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856;
      b4 = 0.55 * b4 + x * 0.5329522;
      b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
      b6 = x * 0.115926;
      last = (last + 0.02 * x) / 1.02;
      b[i] = last * 3.5;
    }
    set = { white, pink, brown };
    noiseBuffers.set(ctx, set);
  }
  return set[color];
}

/** Attack to `peak`, then an exponential fall to silence. */
function envelope(p: AudioParam, at: number, peak: number, attack: number, decay: number): void {
  p.setValueAtTime(SILENT, at);
  p.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), at + attack);
  p.exponentialRampToValueAtTime(SILENT, at + attack + decay);
}

function amp(v: VoiceContext, peak: number, attack: number, decay: number, to: AudioNode = v.out): GainNode {
  const g = v.ctx.createGain();
  envelope(g.gain, v.at, peak, attack, decay);
  g.connect(to);
  return g;
}

function noise(v: VoiceContext, color: NoiseColor, at: number, dur: number, rate = 1): AudioBufferSourceNode {
  const src = v.ctx.createBufferSource();
  src.buffer = noiseBuffer(v.ctx, color);
  src.playbackRate.value = rate;
  src.start(at, v.rnd() * 3);
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

function filter(v: VoiceContext, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
  const f = v.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(hz, v.at);
  f.Q.value = q;
  return f;
}

const VOWELS: Record<'ah' | 'oo' | 'ee', [number, number, number][]> = {
  // [formant Hz, bandwidth Hz, level]
  ah: [[730, 90, 1], [1090, 110, 0.5], [2440, 170, 0.22]],
  oo: [[300, 60, 1], [870, 90, 0.35], [2240, 150, 0.12]],
  ee: [[280, 60, 1], [2250, 120, 0.4], [3000, 200, 0.25]],
};

/** Play one cue. Returns how long it rings, so the caller can count voices. */
export function playCue(v: VoiceContext, c: Cue): number {
  switch (c.kind) {
    case 'boom': {
      const dur = c.dur ?? 1.2;
      // The body: deep noise under a lowpass that closes as it dies away.
      const lp = filter(v, 'lowpass', c.tone ?? 1400, 0.5);
      lp.frequency.exponentialRampToValueAtTime(55, v.at + dur);
      noise(v, 'brown', v.at, dur).connect(lp).connect(amp(v, v.gain * 1.5, 0.006, dur));
      // The crack: a breath of brighter noise at the very start.
      const hp = filter(v, 'highpass', 1600, 0.6);
      noise(v, 'pink', v.at, 0.12).connect(hp).connect(amp(v, v.gain * 0.45, 0.002, 0.09));
      if (c.sub) {
        const o = osc(v, 'sine', 64, v.at, dur);
        o.frequency.exponentialRampToValueAtTime(27, v.at + dur * 0.8);
        o.connect(amp(v, v.gain * c.sub, 0.012, dur * 0.85));
      }
      return dur;
    }
    case 'ping': {
      const dur = c.dur ?? 0.3;
      const hz = v.freq(c.note ?? v.pick());
      const wave = c.wave ?? 'sine';
      const tones: [number, number][] = [[hz, 0]];
      if (c.then !== undefined) tones.push([hz * 2 ** (c.then / 12), dur * 0.7]);
      const bus = v.ctx.createGain();
      bus.connect(v.out);
      // Square and saw are tamed by a lowpass a few harmonics up.
      let into: AudioNode = bus;
      if (wave !== 'sine') {
        const lp = filter(v, 'lowpass', hz * 5, 0.5);
        lp.connect(bus);
        into = lp;
      }
      for (const [f, delay] of tones) {
        const at = v.at + delay;
        const g = v.ctx.createGain();
        envelope(g.gain, at, v.gain, 0.006, dur * 1.2);
        g.connect(into);
        osc(v, wave, f, at, dur * 1.25).connect(g);
        if (wave === 'sine') {
          // Faint upper partials make a pure tone glassy rather than thin.
          const g2 = v.ctx.createGain();
          envelope(g2.gain, at, v.gain * 0.1, 0.004, dur * 0.6);
          g2.connect(into);
          osc(v, 'sine', f * 2.01, at, dur).connect(g2);
        }
      }
      if (c.echoes) v.echo(bus, Math.min(0.75, 0.2 * c.echoes));
      return dur * 1.3 + (c.then !== undefined ? dur : 0) + (c.echoes ? 1.5 : 0);
    }
    case 'bell': {
      const dur = c.dur ?? 2.4;
      const chord = c.chord ?? [0];
      const lp = filter(v, 'lowpass', 7000, 0.4);
      lp.connect(v.out);
      for (const n of chord) {
        const hz = v.freq((c.note ?? v.pick()) + n);
        for (const [detune, level] of [[1, 1], [1.0021, 0.55]] as const) {
          const carrier = osc(v, 'sine', hz * detune, v.at, dur);
          // The strike: a bright inharmonic modulator that fades fast, under a slower one.
          const mod = osc(v, 'sine', hz * (c.ratio ?? 1.41), v.at, dur);
          const depth = v.ctx.createGain();
          envelope(depth.gain, v.at, hz * 1.8, 0.002, dur * 0.45);
          mod.connect(depth).connect(carrier.frequency);
          const mod2 = osc(v, 'sine', hz * 3.76, v.at, dur * 0.2);
          const depth2 = v.ctx.createGain();
          envelope(depth2.gain, v.at, hz * 0.6, 0.001, dur * 0.12);
          mod2.connect(depth2).connect(carrier.frequency);
          carrier.connect(amp(v, (v.gain * level * 0.72) / Math.sqrt(chord.length), 0.003, dur, lp));
        }
      }
      return dur;
    }
    case 'sweep': {
      const dur = c.dur ?? 0.8;
      const o = osc(v, c.wave ?? 'sawtooth', c.from, v.at, dur);
      o.frequency.exponentialRampToValueAtTime(c.to, v.at + dur);
      if (dur > 0.8) {
        // A siren's waver.
        const lfo = osc(v, 'sine', 5.5, v.at, dur);
        const depth = v.ctx.createGain();
        depth.gain.value = Math.min(c.from, c.to) * 0.012;
        lfo.connect(depth).connect(o.frequency);
      }
      const lp = filter(v, 'lowpass', Math.max(c.from, c.to) * 3, 0.5);
      const bp = filter(v, 'bandpass', Math.sqrt(c.from * c.to), c.q ?? 1.5);
      const g = v.ctx.createGain();
      g.gain.setValueAtTime(SILENT, v.at);
      g.gain.exponentialRampToValueAtTime(v.gain, v.at + Math.min(0.08, dur * 0.2));
      g.gain.setValueAtTime(v.gain, v.at + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(SILENT, v.at + dur);
      g.connect(v.out);
      o.connect(lp).connect(bp).connect(g);
      return dur;
    }
    case 'whoosh': {
      const dur = c.dur ?? 1.4;
      const bp = filter(v, 'bandpass', c.from, 1.2);
      bp.frequency.exponentialRampToValueAtTime(c.to, v.at + dur);
      const lp = filter(v, 'lowpass', Math.max(c.from, c.to) * 1.6, 0.5);
      const g = v.ctx.createGain();
      g.gain.setValueAtTime(0, v.at);
      g.gain.linearRampToValueAtTime(v.gain * 2.2, v.at + dur * 0.45);
      g.gain.linearRampToValueAtTime(0, v.at + dur);
      g.connect(v.out);
      noise(v, 'pink', v.at, dur).connect(bp).connect(lp).connect(g);
      return dur;
    }
    case 'thump': {
      const dur = c.dur ?? 0.45;
      const pitch = c.pitch ?? 120;
      const o = osc(v, 'sine', pitch, v.at, dur);
      o.frequency.exponentialRampToValueAtTime(38, v.at + 0.13);
      o.connect(amp(v, v.gain, 0.003, dur));
      const body = osc(v, 'triangle', pitch * 1.5, v.at, dur * 0.4);
      body.frequency.exponentialRampToValueAtTime(pitch * 0.6, v.at + 0.1);
      body.connect(amp(v, v.gain * 0.18, 0.002, dur * 0.3));
      const bp = filter(v, 'bandpass', 3200, 0.8);
      noise(v, 'pink', v.at, 0.04).connect(bp).connect(amp(v, v.gain * 0.35, 0.0015, 0.025));
      return dur;
    }
    case 'choir': {
      const dur = c.dur ?? 3.5;
      const bus = v.ctx.createGain();
      bus.gain.setValueAtTime(0, v.at);
      bus.gain.linearRampToValueAtTime(v.gain, v.at + dur * 0.35);
      bus.gain.setValueAtTime(v.gain, v.at + dur * 0.62);
      bus.gain.linearRampToValueAtTime(0, v.at + dur);
      const lp = filter(v, 'lowpass', 3600, 0.5);
      lp.connect(v.out);
      bus.connect(lp);
      // Three formants in parallel shape the saws into a vowel.
      const formants = VOWELS[c.vowel ?? 'ah'].map(([f, bw, level]) => {
        const bp = filter(v, 'bandpass', f, f / bw);
        const g = v.ctx.createGain();
        g.gain.value = level * 1.8;
        bp.connect(g).connect(bus);
        return bp;
      });
      const vib = osc(v, 'sine', 5.1 + v.rnd() * 0.6, v.at, dur);
      for (const n of c.chord ?? [0, 7]) {
        const hz = v.freq((c.note ?? v.pick()) + n);
        const depth = v.ctx.createGain();
        depth.gain.value = hz * 0.0045;
        vib.connect(depth);
        for (const cents of [-11, 0, 9]) {
          const o = osc(v, 'sawtooth', hz, v.at, dur);
          o.detune.value = cents + (v.rnd() - 0.5) * 4;
          depth.connect(o.frequency);
          for (const f of formants) o.connect(f);
        }
      }
      return dur;
    }
    case 'crackle': {
      const dur = c.dur ?? 0.8;
      const n = Math.max(1, Math.round(dur * (c.rate ?? 18)));
      const bp = filter(v, 'bandpass', c.tone ?? 2200, 0.7);
      bp.connect(v.out);
      for (let i = 0; i < n; i++) {
        const at = v.at + v.rnd() * dur;
        const g = v.ctx.createGain();
        // Grains are short and band-limited, so each one runs hot to be heard at all.
        envelope(g.gain, at, v.gain * 4 * (0.35 + v.rnd() * 0.65), 0.001, 0.02 + v.rnd() * 0.05);
        g.connect(bp);
        noise(v, 'pink', at, 0.09, 0.6 + v.rnd()).connect(g);
      }
      return dur;
    }
  }
}
