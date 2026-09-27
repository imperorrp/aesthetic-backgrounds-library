/**
 * Studio helpers kept out of the component: history, seeded "randomize within taste",
 * content-box measurement, and the export paths (PNG with DOM layers, WebM loop).
 */
import {
  createManualScheduler,
  createRng,
  getLayer,
  mount,
  randomSeedString,
  resolvePalette,
  resolveBackgroundConfig,
  schemaDefaults,
  snapshotScene,
  type FieldSchema,
  type PaletteSpec,
  type Scene,
  type SceneLayer,
  type Schema,
} from '../engine';

/** Bounded undo/redo over immutable snapshots. */
export class History<T> {
  #past: T[] = [];
  #future: T[] = [];
  #limit: number;
  constructor(limit = 60) {
    this.#limit = limit;
  }
  push(prev: T): void {
    this.#past.push(prev);
    if (this.#past.length > this.#limit) this.#past.shift();
    this.#future.length = 0;
  }
  undo(current: T): T | null {
    const prev = this.#past.pop();
    if (prev === undefined) return null;
    this.#future.push(current);
    return prev;
  }
  redo(current: T): T | null {
    const next = this.#future.pop();
    if (next === undefined) return null;
    this.#past.push(current);
    return next;
  }
  get canUndo(): boolean {
    return this.#past.length > 0;
  }
  get canRedo(): boolean {
    return this.#future.length > 0;
  }
}

/**
 * Perturb options inside their schema ranges. `amount` 0..1 is the share of each
 * range a value may move; enums and booleans flip only at higher amounts, so a
 * small nudge stays recognisably the same design.
 */
export function jitterOptions(schema: Schema, values: Record<string, unknown>, rng: () => number, amount = 0.25): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [key, field] of Object.entries(schema) as [string, FieldSchema][]) {
    const current = values[key] ?? field.default;
    switch (field.type) {
      case 'number': {
        const span = (field.max - field.min) * amount;
        const next = (typeof current === 'number' ? current : field.default) + (rng() * 2 - 1) * span;
        const clamped = Math.max(field.min, Math.min(field.max, next));
        out[key] = field.step && field.step >= 1 ? Math.round(clamped) : Math.round(clamped * 1000) / 1000;
        break;
      }
      case 'boolean':
        out[key] = rng() < amount * 0.5 ? !current : current;
        break;
      case 'enum':
        out[key] = rng() < amount * 0.6 ? field.values[Math.floor(rng() * field.values.length)] : current;
        break;
      default:
        break; // colors and strings stay: they carry the palette relationship
    }
  }
  return out;
}

/** Jitter every layer's options in a scene, keeping the stack, opacities, and blends. */
export function jitterScene(scene: Scene, seed: string, amount = 0.25): Scene {
  const rng = createRng(seed);
  return {
    layers: scene.layers.map((ref: SceneLayer) => {
      const layer = getLayer(ref.use);
      if (!layer) return ref;
      const base = { ...schemaDefaults(layer.schema), ...(ref.with ?? {}) };
      return { ...ref, with: jitterOptions(layer.schema, base, rng, amount) };
    }),
  };
}

export const randomSeed = randomSeedString;

/** Boxes of the page's own content, in canvas CSS pixels, for content-aware shading. */
export function measureContentBoxes(canvas: HTMLCanvasElement, selector = 'main, article, [data-bg-content]'): DOMRect[] {
  const host = canvas.getBoundingClientRect();
  return [...document.querySelectorAll<HTMLElement>(selector)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 40 && r.height > 40)
    .map((r) => new DOMRect(r.left - host.left, r.top - host.top, r.width, r.height));
}

/** A `content-shade` layer ref covering the union of the page's content boxes. */
export function contentShadeFor(canvas: HTMLCanvasElement, strength = 0.45): SceneLayer | null {
  const boxes = measureContentBoxes(canvas);
  if (!boxes.length) return null;
  const host = canvas.getBoundingClientRect();
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.right));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  const pad = 40;
  const w = Math.min(host.width, right - left + pad * 2);
  const h = Math.min(host.height, bottom - top + pad * 2);
  return {
    use: 'content-shade',
    with: {
      x: Math.max(0, Math.min(1, (left + right) / 2 / host.width)),
      y: Math.max(0, Math.min(1, (top + bottom) / 2 / host.height)),
      width: Math.max(0.1, Math.min(1, w / host.width)),
      height: Math.max(0.1, Math.min(1, h / host.height)),
      strength,
      feather: 160,
    },
  };
}

export type ExportOptions = {
  skin: string;
  scene: Scene | null;
  seed: string;
  palette: PaletteSpec;
  intensity: number;
  density?: number;
  detail?: string;
  options?: Record<string, unknown>;
  width: number;
  height: number;
};

/** Mount offscreen with a manual clock so an export is reproducible and unthrottled. */
function offscreenMount(o: ExportOptions, frames: number) {
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-99999px;top:0;width:${o.width}px;height:${o.height}px;pointer-events:none`;
  document.body.appendChild(box);
  const scheduler = createManualScheduler();
  const handle = mount(box, {
    skin: o.skin,
    seed: o.seed,
    palette: o.palette,
    intensity: o.intensity,
    density: o.density,
    detail: o.detail as never,
    options: (o.scene ?? o.options) as never,
    scheduler,
    adaptiveQuality: false,
    pauseWhenHidden: false,
    motion: 'full',
  });
  scheduler.step(frames);
  return { box, handle, scheduler };
}

/**
 * Still image including DOM layers (grain, scanlines, CSS plates) via each layer's
 * `snapshot()`, so the file matches what the page shows.
 */
export async function exportImage(o: ExportOptions, frames = 240, type: 'image/png' | 'image/webp' = 'image/png'): Promise<Blob> {
  const { box, handle } = offscreenMount(o, frames);
  try {
    const out = document.createElement('canvas');
    out.width = o.width;
    out.height = o.height;
    const ctx = out.getContext('2d')!;
    const config = resolveBackgroundConfig({ seed: o.seed, palette: o.palette, intensity: o.intensity });
    snapshotScene(ctx, o.scene ?? undefined, { config, palette: resolvePalette(o.palette) }, handle.canvas, { width: o.width, height: o.height });
    return await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), type, 0.95));
  } finally {
    handle.destroy();
    box.remove();
  }
}

/**
 * Record a loop by stepping the manual clock at a fixed rate and capturing the
 * canvas stream, so the video is frame-exact regardless of machine speed.
 */
export async function exportVideo(
  o: ExportOptions,
  { seconds = 8, fps = 30, onProgress }: { seconds?: number; fps?: number; onProgress?: (p: number) => void } = {},
): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is not available in this browser');
  const { box, handle, scheduler } = offscreenMount(o, 60);
  try {
    const stream = handle.canvas.captureStream(0);
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((res) => (rec.onstop = () => res()));
    rec.start();
    const total = Math.round(seconds * fps);
    for (let i = 0; i < total; i++) {
      scheduler.step(1, 1000 / fps);
      track.requestFrame();
      onProgress?.((i + 1) / total);
      // Yield so the encoder can drain; keeps memory flat on long captures.
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    rec.stop();
    await done;
    return new Blob(chunks, { type: mime });
  } finally {
    handle.destroy();
    box.remove();
  }
}

export function download(blob: Blob, filename: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
