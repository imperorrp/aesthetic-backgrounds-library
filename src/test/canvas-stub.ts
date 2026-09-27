/**
 * Test helper: jsdom has no 2D canvas. This installs a recording stub context so
 * DOM tests can run skins and compare draw-call streams for determinism.
 */
import { hashSeed } from '../engine/rng';

export type CanvasRecorder = {
  /** Rolling hash of every draw call and property assignment, in order. */
  hash: number;
  calls: number;
};

const recorders = new WeakMap<HTMLCanvasElement, CanvasRecorder>();
const contexts = new WeakMap<HTMLCanvasElement, unknown>();

const serialize = (args: unknown[]): string =>
  args
    .map((a) => {
      if (typeof a === 'number') return a.toFixed(3);
      if (typeof a === 'string') return a;
      if (Array.isArray(a)) return a.join(',');
      if (a && typeof a === 'object') {
        if (a instanceof HTMLCanvasElement) return `canvas(${a.width}x${a.height})`;
        return '[obj]';
      }
      return String(a);
    })
    .join(',');

function makeContext(canvas: HTMLCanvasElement) {
  const rec: CanvasRecorder = { hash: 2166136261, calls: 0 };
  recorders.set(canvas, rec);
  const record = (line: string) => {
    rec.hash = Math.imul(rec.hash ^ hashSeed(line), 16777619) >>> 0;
    rec.calls++;
  };
  const props: Record<string, unknown> = {};
  return new Proxy(props, {
    get(target, key: string) {
      if (key === 'canvas') return canvas;
      if (key === 'measureText') return (text: string) => ({ width: String(text).length * 6 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient' || key === 'createPattern') {
        return () => ({ addColorStop() {} });
      }
      if (key === 'getImageData') {
        return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      }
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key in target) return target[key];
      return (...args: unknown[]) => record(`${key}(${serialize(args)})`);
    },
    set(target, key: string, value) {
      record(`${key}=${String(value)}`);
      target[key] = value;
      return true;
    },
  });
}

/** Replace `HTMLCanvasElement.prototype.getContext` with a recording stub (idempotent). */
export function installCanvasStub(): void {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let ctx = contexts.get(this);
    if (!ctx) {
      ctx = makeContext(this);
      contexts.set(this, ctx);
    }
    return ctx;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  if (typeof window.requestAnimationFrame !== 'function') {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
  }
}

/** Recorder for a canvas that has had `getContext` called. */
export function recorderFor(canvas: HTMLCanvasElement): CanvasRecorder {
  const rec = recorders.get(canvas);
  if (!rec) throw new Error('no recorder: getContext was never called on this canvas');
  return rec;
}
