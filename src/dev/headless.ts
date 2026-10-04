/**
 * Headless runner: mount a skin on a host with no canvas and step it sim-only.
 *
 * Used by `scripts/sim.mjs` (a CLI that prints what happened) and by node-environment
 * tests. Nothing here draws, so a minute of simulation takes about a second. Only
 * skins whose `mount` and `advance` stay off the DOM work here (the sector map does;
 * the instruments build offscreen canvases at mount and do not).
 *
 *   const report = runHeadless({ skin: 'void-tactical', options: { universe: 'choir' }, seconds: 120 });
 *   report.log      // every line said on the map, with its sim time
 *   report.samples  // entity counts every `sampleEvery` seconds
 *   report.problems // invariant breaks (NaN, empty fleets, runaway counts, failed plugins)
 */
import '../lib';
// Every universe, eagerly: the runner works synchronously.
import '../engine/skins/void-tactical/packs';
import '../engine/skins/void-tactical/mechanics/all';
import '../engine/skins/undercity/city';
import { resolveBackgroundConfig, withConfigDefaults, type BackgroundConfig } from '../engine/config';
import { createRng, forkRng } from '../engine/rng';
import { createNoise2D } from '../engine/noise';
import { lightState } from '../engine/core/legibility';
import { resolveSkin } from '../engine/core/registry';
import type { BackgroundSkin, FrameInfo, HostViewport, PointerState, SkinHost, SkinInspection } from '../engine/core/skin';

export type HeadlessOptions = {
  /** Skin object or registered id. */
  skin: BackgroundSkin | string;
  seed?: string;
  options?: unknown;
  config?: BackgroundConfig;
  width?: number;
  height?: number;
  seconds: number;
  /** Fixed step in seconds. Default 1/60, the same as a browser frame. */
  step?: number;
  /** Seconds between count samples. Default 5. */
  sampleEvery?: number;
};

export type HeadlessReport = {
  seconds: number;
  frames: number;
  msPerFrame: number;
  log: { t: number; text: string; kind?: string; type?: string }[];
  samples: { t: number; counts: Record<string, number> }[];
  problems: string[];
  /** The error that stopped the run, if one did. */
  threw?: string;
};

/** A 2D context that accepts every call and draws nothing. Mount code may touch it; drawing never runs. */
function nullContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, key) => (key === 'measureText' ? () => ({ width: 0 }) : key === 'canvas' ? null : noop),
    set: () => true,
  });
}

/** Everything a skin reads from its host, with no DOM behind it. */
export function createHeadlessHost(o: Pick<HeadlessOptions, 'seed' | 'options' | 'config' | 'width' | 'height'> & { defaults?: BackgroundSkin['defaults'] }): SkinHost {
  const resolved = resolveBackgroundConfig(withConfigDefaults(o.defaults, { motion: 'full', adaptiveQuality: false, ...o.config, seed: o.seed ?? 'orion-7' }));
  const seed = resolved.seed;
  const viewport: HostViewport = { width: o.width ?? 1280, height: o.height ?? 800, dpr: 1, isMobile: (o.width ?? 1280) < 768, isTouch: false };
  const pointer: PointerState = { x: 0, y: 0, nx: 0.5, ny: 0.5, vx: 0, vy: 0, active: false, down: false, idle: Infinity };
  return {
    canvas: null as unknown as HTMLCanvasElement,
    ctx: nullContext(),
    rng: createRng(seed),
    fork: (label) => forkRng(seed, label),
    noise: createNoise2D(forkRng(seed, 'noise')),
    config: resolved,
    palette: resolved.palette,
    options: o.options,
    viewport,
    pointer,
    scroll: { y: 0 },
    takeGesture: () => ({ zoom: 1, panX: 0, panY: 0 }),
    motion: 'full',
    intensity: resolved.intensity,
    quality: 1,
    light: lightState(resolved.light.angle, resolved.light.warmth),
    quiet: () => 0,
  };
}

/** Mount, step sim-only for `seconds`, and report what happened. Never throws; a crash is in `threw`. */
export function runHeadless(o: HeadlessOptions): HeadlessReport {
  const skin = resolveSkin(o.skin);
  const step = o.step ?? 1 / 60;
  const sampleEvery = o.sampleEvery ?? 5;
  const host = createHeadlessHost({ ...o, defaults: skin.defaults });
  const samples: HeadlessReport['samples'] = [];
  const log: HeadlessReport['log'] = [];
  const problems = new Set<string>();
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let frames = 0;
  let threw: string | undefined;
  let seen = 0;
  /** Pull log entries logged since the last look (the skin keeps only a recent window). */
  const collect = (i: SkinInspection | undefined) => {
    if (!i) return;
    const fresh = Math.min(i.seq - seen, i.log.length);
    for (const e of i.log.slice(i.log.length - fresh)) log.push(e);
    seen = i.seq;
    for (const p of i.problems ?? []) problems.add(p);
  };
  const began = now();
  try {
    const inst = skin.mount(host);
    inst.resize({ width: host.viewport.width, height: host.viewport.height });
    const run = inst.advance ? inst.advance.bind(inst) : inst.frame.bind(inst);
    const total = Math.round(o.seconds / step);
    let nextLook = 0;
    let nextSample = 0;
    for (let i = 0; i < total; i++) {
      const info: FrameInfo = { t: i * step, dt: step, frame: i, timestamp: i * step * 1000 };
      run(info);
      frames++;
      if (info.t >= nextLook && inst.inspect) {
        const look = inst.inspect();
        collect(look);
        if (look && info.t >= nextSample) {
          samples.push({ t: info.t, counts: { ...look.counts } });
          nextSample += sampleEvery;
        }
        nextLook += 1;
      }
    }
    collect(inst.inspect?.());
    inst.destroy();
  } catch (err) {
    threw = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  }
  return {
    seconds: frames * step,
    frames,
    msPerFrame: frames ? (now() - began) / frames : 0,
    log,
    samples,
    problems: [...problems],
    threw,
  };
}
