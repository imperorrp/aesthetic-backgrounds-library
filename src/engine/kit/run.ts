/**
 * Running a world as a skin: the plumbing every world had copied.
 *
 * Give it a DOM-free sim (time, a bus, a fixed step, counts) and a painter, and it returns
 * the SkinInstance: clamped dt, motion off, a fixed simulation step, `advance` for the
 * headless runner and fast-forward, `inspect` for the lab and tests, events forwarded to
 * sound with pan and nearness from where they happened on screen, and an ambience pulse.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../core/skin';
import type { Bus } from '../sim/bus';

export type RunnableSim = {
  readonly t: number;
  bus: Bus;
  step(dt: number): void;
  counts(): Record<string, number>;
  /** Optional: a visitor touched the world at (x, y), in world coordinates. Return the line said, or null. */
  nudge?(x: number, y: number): string | null;
};

export function runWorld(
  host: SkinHost,
  sim: RunnableSim,
  opts: {
    /** Fixed sim step in seconds (the sim always advances in these). */
    dt: number;
    /** Where a world point is on screen now. */
    project(x: number, y: number): [number, number];
    /** The world point under a screen point now (for nudges). */
    unproject?(x: number, y: number): [number, number];
    paint(t: number, dt: number): void;
    /** 0..1 how loud the bed should be now. */
    ambience?(): number;
    /** Things to do each frame after the sim steps, before painting (camera). */
    after?(dt: number): void;
    resize?(v: Viewport): void;
    destroy?(): void;
  },
): SkinInstance {
  let acc = 0;
  let nextAmbience = 0;
  sim.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const W = host.viewport.width;
    const H = host.viewport.height;
    const [x, y] = typeof e.x === 'number' && typeof e.y === 'number' ? opts.project(e.x, e.y) : [W / 2, H / 2];
    const near = x > -60 && x < W + 60 && y > -60 && y < H + 60 ? 1 : 0.35;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near, text: e.text, color: e.color, priority: e.priority });
  });
  const step = (info: FrameInfo) => {
    const dt = host.motion === 'off' ? 0 : Math.min(info.dt, 0.1);
    acc += dt;
    let n = 0;
    while (acc >= opts.dt && n < 8) {
      acc -= opts.dt;
      sim.step(opts.dt);
      n++;
    }
    if (n === 8) acc = 0;
    opts.after?.(dt);
    if (sim.t >= nextAmbience && host.events?.active) {
      nextAmbience = sim.t + 2;
      host.events.emit({ type: 'ambience', weight: opts.ambience?.() ?? 0.4, pan: 0, near: 1 });
    }
    return dt;
  };
  return {
    resize(v) {
      opts.resize?.(v);
    },
    frame(info) {
      const dt = step(info);
      opts.paint(sim.t + acc, dt);
    },
    advance(info) {
      step(info);
    },
    nudge(x, y) {
      if (!sim.nudge || !opts.unproject || host.motion === 'off') return null;
      const [wx, wy] = opts.unproject(x, y);
      return sim.nudge(wx, wy);
    },
    inspect(): SkinInspection {
      return {
        t: sim.t,
        counts: sim.counts(),
        log: sim.bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: sim.bus.seq,
      };
    },
    destroy() {
      opts.destroy?.();
    },
  };
}
