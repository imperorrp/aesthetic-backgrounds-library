/**
 * Test helper: jsdom has no 2D canvas. This installs a recording stub context so
 * DOM tests can run skins and compare draw-call streams for determinism.
 *
 * Every method call and property assignment is folded into a rolling hash.
 * Gradients record their geometry and color stops. When a canvas is drawn into
 * another (`drawImage`), the source canvas's current hash is folded in, so
 * private layer surfaces contribute to the composite hash.
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
        if (a instanceof HTMLCanvasElement) {
          const rec = recorders.get(a);
          return `canvas(${a.width}x${a.height}#${rec ? rec.hash.toString(16) : '-'})`;
        }
        if ('__gradient' in (a as Record<string, unknown>)) return (a as { __gradient: string }).__gradient;
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
  const gradient = (kind: string, args: unknown[]) => {
    const stops: string[] = [];
    const g = {
      __gradient: '',
      addColorStop(offset: number, color: string) {
        stops.push(`${offset.toFixed(3)}:${color}`);
        g.__gradient = `${kind}(${serialize(args)})[${stops.join('|')}]`;
      },
    };
    g.__gradient = `${kind}(${serialize(args)})[]`;
    return g;
  };
  const props: Record<string, unknown> = {};
  return new Proxy(props, {
    get(target, key: string) {
      if (key === 'canvas') return canvas;
      if (key === 'measureText') return (text: string) => ({ width: String(text).length * 6 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...args: unknown[]) => gradient(key, args);
      }
      if (key === 'createPattern') return () => ({ __gradient: 'pattern' });
      if (key === 'getImageData') {
        return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      }
      if (key === 'createImageData') {
        return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      }
      if (key === 'putImageData') {
        // Fold the pixels into the hash so image-based skins are covered by determinism tests.
        return (img: { data: Uint8ClampedArray }, x: number, y: number) => {
          let h = 0;
          for (let i = 0; i < img.data.length; i += 7) h = (Math.imul(h, 31) + img.data[i]) | 0;
          record(`putImageData(${h},${x},${y})`);
        };
      }
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key in target) return target[key];
      return (...args: unknown[]) => record(`${key}(${serialize(args)})`);
    },
    set(target, key: string, value) {
      record(`${key}=${value && typeof value === 'object' && '__gradient' in value ? (value as { __gradient: string }).__gradient : String(value)}`);
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
