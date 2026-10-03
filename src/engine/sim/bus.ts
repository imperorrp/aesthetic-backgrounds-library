/**
 * The event bus: one stream of "what just happened" for the whole simulation.
 *
 * Producers (fleets, combat, mechanics, services) emit; consumers subscribe:
 *   - the director points the camera at interesting events
 *   - audio turns events into sound
 *   - history and chatter react to them
 *   - tooling (lab seek, the headless runner, the studio debug panel) reads the log
 *
 * Events are plain objects. Positional events carry world `x`, `y` (and `z`); `weight`
 * (0..1) says how much an event matters, which the director and audio both use.
 * `follow` lets the camera track a moving subject for as long as it exists.
 *
 * Known types (anything else is fine too; plugins add their own):
 *   say            a line of text on the map (`text`, `priority`)
 *   launch dock depart jump arrive cargo survey approach   fleet life
 *   explosion      a ship or thing blew up (`size`)
 *   lost           a fleet was wiped out
 *   combat         a fight started (`follow` the attacker)
 *   raid capture bombard song breach armada flare surge storm ...   mechanic beats
 */

export type WorldEvent = {
  type: string;
  /** Sim time, stamped by the bus. */
  t?: number;
  x?: number;
  y?: number;
  z?: number;
  /** 0..1 importance: camera interest, audio loudness. Default 0.2. */
  weight?: number;
  text?: string;
  color?: string;
  priority?: 'low' | 'medium' | 'high';
  /** Where the subject is now, for as long as it exists (null when gone). */
  follow?: () => { x: number; y: number; z?: number } | null;
  [key: string]: unknown;
};

export type Listener = (e: WorldEvent) => void;

export type Bus = {
  emit(e: WorldEvent): void;
  /** Subscribe to one type, or '*' for everything. Returns an unsubscribe. */
  on(type: string, fn: Listener): () => void;
  /** Logged events at or after sim time `t`, oldest first (from a ring of the last `capacity`). */
  since(t: number): WorldEvent[];
  /** The ring, oldest first. */
  readonly log: readonly WorldEvent[];
  /** Total events ever emitted (the ring forgets; this does not). */
  readonly seq: number;
};

export function createBus(clock: () => number, capacity = 400): Bus {
  const listeners = new Map<string, Set<Listener>>();
  const log: WorldEvent[] = [];
  let seq = 0;
  let depth = 0;

  const call = (set: Set<Listener> | undefined, e: WorldEvent) => {
    if (!set) return;
    for (const fn of set) fn(e);
  };

  return {
    emit(e) {
      e.t ??= clock();
      log.push(e);
      if (log.length > capacity) log.splice(0, log.length - capacity);
      seq++;
      // A listener that emits is fine; a loop that never ends is not.
      if (depth > 8) return;
      depth++;
      try {
        call(listeners.get(e.type), e);
        call(listeners.get('*'), e);
      } finally {
        depth--;
      }
    },
    on(type, fn) {
      let set = listeners.get(type);
      if (!set) listeners.set(type, (set = new Set()));
      set.add(fn);
      return () => set!.delete(fn);
    },
    since(t) {
      let i = log.length;
      while (i > 0 && (log[i - 1].t ?? 0) >= t) i--;
      return log.slice(i);
    },
    get log() {
      return log;
    },
    get seq() {
      return seq;
    },
  };
}
