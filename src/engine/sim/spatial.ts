/**
 * Spatial hash: a uniform grid of buckets for "what is near this point" queries.
 * Rebuild it each frame (clear + insert) for moving things; it is cheap at our counts
 * and turns O(n²) neighbour searches (boids, combat targeting, collisions) into ~O(n).
 *
 *   const grid = createSpatialHash<Rock>(64);
 *   grid.clear(); for (const r of rocks) grid.insert(r, r.x, r.y);
 *   grid.query(x, y, 80, out);   // items within 80 world units (exact distance check)
 */
export type SpatialHash<T> = {
  clear(): void;
  insert(item: T, x: number, y: number): void;
  /** Items within `r` of (x, y), appended to `out` (cleared first). Returns `out`. */
  query(x: number, y: number, r: number, out?: T[]): T[];
  readonly size: number;
};

export function createSpatialHash<T>(cell: number): SpatialHash<T> {
  const buckets = new Map<number, { item: T; x: number; y: number }[]>();
  let size = 0;
  // Cells are packed into one number; fine for |cx|, |cy| < 2^20.
  const key = (cx: number, cy: number) => (cx + 1048576) * 2097152 + (cy + 1048576);

  return {
    get size() {
      return size;
    },
    clear() {
      // Drop the buckets too: the map streams sideways forever, so old cells must not pile up.
      buckets.clear();
      size = 0;
    },
    insert(item, x, y) {
      const k = key(Math.floor(x / cell), Math.floor(y / cell));
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push({ item, x, y });
      size++;
    },
    query(x, y, r, out = []) {
      out.length = 0;
      const r2 = r * r;
      const x0 = Math.floor((x - r) / cell);
      const x1 = Math.floor((x + r) / cell);
      const y0 = Math.floor((y - r) / cell);
      const y1 = Math.floor((y + r) / cell);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const b = buckets.get(key(cx, cy));
          if (!b) continue;
          for (const e of b) if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r2) out.push(e.item);
        }
      }
      return out;
    },
  };
}
