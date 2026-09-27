/**
 * Frame scheduling + clock, injectable so the loop is deterministic in tests
 * and so hosts can drive frames themselves (e.g. an offscreen renderer).
 */
export type Scheduler = {
  /** Monotonic time in milliseconds. */
  now(): number;
  /** Schedule `cb` for the next frame; returns a cancel handle. */
  request(cb: (timestamp: number) => void): number;
  cancel(handle: number): void;
};

export function createRafScheduler(): Scheduler {
  const perf = typeof performance !== 'undefined' ? performance : { now: () => Date.now() };
  return {
    now: () => perf.now(),
    request: (cb) => requestAnimationFrame(cb),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}

export type ManualScheduler = Scheduler & {
  /** Advance the clock by `ms` and run every callback scheduled before this call. */
  advance(ms: number): void;
  /** Run `frames` frames of `frameMs` each. */
  step(frames: number, frameMs?: number): void;
  /** Number of callbacks currently waiting. */
  pending(): number;
};

/** A scheduler that only moves when told to. Frame callbacks run synchronously inside `advance`. */
export function createManualScheduler(start = 0): ManualScheduler {
  let time = start;
  let nextHandle = 1;
  let queue: { handle: number; cb: (t: number) => void }[] = [];
  return {
    now: () => time,
    request(cb) {
      const handle = nextHandle++;
      queue.push({ handle, cb });
      return handle;
    },
    cancel(handle) {
      queue = queue.filter((q) => q.handle !== handle);
    },
    advance(ms) {
      time += ms;
      const due = queue;
      queue = [];
      for (const { cb } of due) cb(time);
    },
    step(frames, frameMs = 1000 / 60) {
      for (let i = 0; i < frames; i++) this.advance(frameMs);
    },
    pending: () => queue.length,
  };
}
