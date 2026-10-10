/**
 * Moments: pictures of the worlds, kept in the browser.
 *
 * When something uncommon or rarer is seen for the first time, the studio waits a beat (so the
 * event is on screen) and keeps a picture of it and a two-second clip. You can also keep one
 * by hand (K). Each moment remembers what is needed to go back: the studio's own link (which
 * holds the world, its options and the seed), the world's time, and the window size the world
 * was made for.
 *
 * Going back is a replay, not a recording: the link replays the seed up to that time. Worlds
 * are made for their screen and live frames are not fixed steps, so a replay comes close to
 * the picture but is not always the same frame. The viewer says so.
 *
 * The list is in localStorage; the pictures, which are larger, in IndexedDB.
 */
import type { Rarity } from './witness';

export type Moment = {
  id: string;
  /** Epoch ms. */
  at: number;
  world: string;
  source: string;
  seed: string;
  /** The world's time when it happened, in sim seconds. */
  t: number;
  /** The studio link (no `t`). */
  href: string;
  /** The window it was seen in. */
  w: number;
  h: number;
  /** A first sighting (with its event), or one kept by hand. */
  kind: 'first' | 'kept';
  type?: string;
  name: string;
  line?: string;
  rarity?: Rarity;
  detail?: string;
  /** False until the journal has shown it. */
  seen: boolean;
  /** A two-second clip exists. */
  clip?: boolean;
};

export type MomentImages = { still: Blob; clip?: Blob };

const KEY = 'bge.moments.v1';
const CAP = 40;

/** How far before the event a link starts, so the replay shows it coming. */
export const LEAD_IN = 6;

export type Moments = ReturnType<typeof createMoments>;

export function createMoments(storage: Storage | null = null, images: ImageStore | null = null) {
  let list: Moment[] = [];
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? '[]') as Moment[];
    if (Array.isArray(raw)) list = raw.filter((m) => m && typeof m.id === 'string');
  } catch {
    /* nothing kept */
  }
  const listeners = new Set<() => void>();
  const commit = (next: Moment[]) => {
    const dropped = list.filter((m) => !next.some((x) => x.id === m.id));
    list = next;
    try {
      storage?.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage full or blocked: kept for this visit */
    }
    for (const m of dropped) void images?.remove(m.id);
    for (const fn of listeners) fn();
  };
  return {
    get list(): readonly Moment[] {
      return list;
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Moments the journal has not shown yet. */
    get unseen(): number {
      return list.filter((m) => !m.seen).length;
    },
    async add(m: Moment, pics?: MomentImages) {
      if (pics) await images?.put(m.id, pics);
      commit([...list.filter((x) => x.id !== m.id), m].slice(-CAP));
    },
    markSeen() {
      if (list.some((m) => !m.seen)) commit(list.map((m) => (m.seen ? m : { ...m, seen: true })));
    },
    remove(id: string) {
      commit(list.filter((x) => x.id !== id));
    },
    clear() {
      commit([]);
    },
    images(id: string): Promise<MomentImages | undefined> {
      return images ? images.get(id) : Promise.resolve(undefined);
    },
  };
}

/** The link to a moment: its studio link, starting a little before it happened. */
export function momentLink(m: Pick<Moment, 'href' | 't'>): string {
  const u = new URL(m.href);
  u.searchParams.set('t', String(Math.max(0, Math.round(m.t - LEAD_IN))));
  return u.toString();
}

/** Same window size, give or take a scrollbar. */
export const sameSize = (m: Pick<Moment, 'w' | 'h'>, w: number, h: number) => Math.abs(m.w - w) <= 24 && Math.abs(m.h - h) <= 24;

// ---- pictures ---------------------------------------------------------------------------

export type ImageStore = {
  put(id: string, pics: MomentImages): Promise<void>;
  get(id: string): Promise<MomentImages | undefined>;
  remove(id: string): Promise<void>;
};

/** Pictures in IndexedDB. Null when there is none (private modes, old browsers). */
export function idbImages(name = 'vivarium-moments'): ImageStore | null {
  if (typeof indexedDB === 'undefined') return null;
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('img');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const req = fn(d.transaction('img', mode).objectStore('img'));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  return {
    put: (id, pics) => run('readwrite', (s) => s.put(pics, id)).then(() => undefined, () => undefined),
    get: (id) => run<MomentImages | undefined>('readonly', (s) => s.get(id)).catch(() => undefined),
    remove: (id) => run('readwrite', (s) => s.delete(id)).then(() => undefined, () => undefined),
  };
}

// ---- capture ------------------------------------------------------------------------------

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));

/** The canvas, scaled to `maxW` wide, on the world's dark (the canvas itself may be clear). */
function shrink(canvas: HTMLCanvasElement, maxW: number): HTMLCanvasElement | null {
  const k = Math.min(1, maxW / Math.max(1, canvas.width));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(canvas.width * k));
  c.height = Math.max(1, Math.round(canvas.height * k));
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#05070b';
  g.fillRect(0, 0, c.width, c.height);
  try {
    g.drawImage(canvas, 0, 0, c.width, c.height);
  } catch {
    return null;
  }
  return c;
}

/** A JPEG still of the canvas. */
export async function still(canvas: HTMLCanvasElement, maxW = 960): Promise<Blob | null> {
  const c = shrink(canvas, maxW);
  return c ? toBlob(c, 'image/jpeg', 0.82) : null;
}

/**
 * A short clip of the canvas as it plays: `frames` frames, `everyMs` apart, `maxW` wide.
 * Resolves to the frames (RGBA); encode with `encodeGif`. Stops early if `cancelled()`.
 */
export function burst(canvas: HTMLCanvasElement, o: { frames?: number; everyMs?: number; maxW?: number; cancelled?: () => boolean } = {}): Promise<ImageData[]> {
  const { frames = 14, everyMs = 150, maxW = 400, cancelled } = o;
  return new Promise((resolve) => {
    const got: ImageData[] = [];
    const take = () => {
      if (cancelled?.()) return resolve(got);
      const c = shrink(canvas, maxW);
      const g = c?.getContext('2d');
      if (!c || !g) return resolve(got);
      got.push(g.getImageData(0, 0, c.width, c.height));
      if (got.length >= frames) resolve(got);
      else setTimeout(take, everyMs);
    };
    take();
  });
}
