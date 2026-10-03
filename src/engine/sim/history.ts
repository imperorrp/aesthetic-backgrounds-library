/**
 * History: a short memory of where things were, for echoes and replays.
 *
 * Every `every` seconds the owner records a snapshot of some points (ships, bodies). The
 * ring keeps the last `capacity` snapshots. `near(t)` returns the snapshot closest to a
 * past time, which is enough to replay a region as a stuttering ghost film (four frames
 * a second reads as old footage, which is the point).
 *
 *   const h = createHistory(64, 0.25);
 *   h.record(t, ships.map((s) => ({ x: s.x, y: s.y, a: s.heading, kind: s.cls, color: s.color })));
 *   h.near(t - 8)   // { t, items } from about eight seconds ago
 */

export type Trace = { x: number; y: number; a: number; kind: string; color: string };
export type Snapshot = { t: number; items: Trace[] };

export type History = {
  /** Record now, if `every` seconds have passed since the last record. */
  record(t: number, items: Trace[]): void;
  /** The snapshot nearest a time, or null when memory does not reach that far. */
  near(t: number): Snapshot | null;
  /** How far back memory reaches (sim time of the oldest snapshot). */
  readonly oldest: number;
  readonly size: number;
};

export function createHistory(capacity = 64, every = 0.25): History {
  const ring: Snapshot[] = [];
  let last = -Infinity;
  return {
    record(t, items) {
      if (t - last < every) return;
      last = t;
      ring.push({ t, items });
      if (ring.length > capacity) ring.shift();
    },
    near(t) {
      if (!ring.length || t < ring[0].t - every) return null;
      let best = ring[0];
      for (const s of ring) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
      return best;
    },
    get oldest() {
      return ring.length ? ring[0].t : Infinity;
    },
    get size() {
      return ring.length;
    },
  };
}
