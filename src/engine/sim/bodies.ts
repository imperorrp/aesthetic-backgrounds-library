/**
 * Bodies: long, flexible things that are not ships. Leviathans, tendrils, worms, a
 * generation ark of linked hulls.
 *
 * A body is a head that steers and a chain of segments that follow it at a fixed
 * spacing. Each segment is pulled to exactly `spacing` behind the one before it
 * ("follow the leader"), which is stable, cheap, and bends like a spine. The head turns
 * at a limited rate, so a big body sweeps wide arcs instead of pivoting.
 *
 *   const b = createBody('leviathan', x, y, 36, 14, Math.PI, nextId++);
 *   seek(b, tx, ty, 18, 0.25, dt);   // or wander(...) or circle(...)
 *   stepBody(b, dt);                  // segments follow the head
 *   b.seg[i * 2], b.seg[i * 2 + 1]    // segment positions, head first
 *
 * Shapes and colors are the renderer's business; this module only moves points.
 */

export type Body = {
  id: number;
  kind: string;
  /** Head position and heading (radians). */
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** Segment centers as flat x,y pairs, head first. */
  seg: Float32Array;
  readonly n: number;
  spacing: number;
  /** Seconds alive, and a free phase for animation. */
  age: number;
  phase: number;
  /** Anything the owning mechanic wants to keep on the body. */
  data: Record<string, unknown>;
};

/**
 * id is the caller's: keep a counter per world (never a module-level one), so two
 * mounts with the same seed number their bodies the same way and replay identically.
 */
export function createBody(kind: string, x: number, y: number, n: number, spacing: number, heading: number, id = 0): Body {
  const seg = new Float32Array(n * 2);
  // Laid out straight behind the head.
  for (let i = 0; i < n; i++) {
    seg[i * 2] = x - Math.cos(heading) * spacing * i;
    seg[i * 2 + 1] = y - Math.sin(heading) * spacing * i;
  }
  return { id, kind, x, y, heading, speed: 0, seg, n, spacing, age: 0, phase: 0, data: {} };
}

/** Turn the head toward an angle, at most `turn` radians per second. */
export function turnToward(b: Body, angle: number, turn: number, dt: number): void {
  let d = angle - b.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  b.heading += Math.max(-turn * dt, Math.min(turn * dt, d));
}

/** Swim toward a point. */
export function seek(b: Body, tx: number, ty: number, speed: number, turn: number, dt: number): void {
  turnToward(b, Math.atan2(ty - b.y, tx - b.x), turn, dt);
  b.speed = speed;
}

/** Drift on a slowly changing heading: `noise(t)` in -1..1 steers. */
export function wander(b: Body, noise: number, speed: number, turn: number, dt: number): void {
  b.heading += noise * turn * dt;
  b.speed = speed;
}

/** Circle a point at radius r (direction 1 or -1). */
export function circle(b: Body, cx: number, cy: number, r: number, speed: number, dir: number, turn: number, dt: number): void {
  const a = Math.atan2(b.y - cy, b.x - cx);
  const d = Math.hypot(b.x - cx, b.y - cy);
  // Tangent, bent inward or outward toward the ring.
  const correction = Math.max(-0.8, Math.min(0.8, (d - r) / r));
  turnToward(b, a + (Math.PI / 2) * dir + correction * dir, turn, dt);
  b.speed = speed;
}

/**
 * Move the head along its heading, then pull each segment to `spacing` behind the one
 * before it. `sway` (radians) adds a slow side-to-side swim to the head.
 */
export function stepBody(b: Body, dt: number, sway = 0): void {
  b.age += dt;
  b.phase += dt;
  const h = b.heading + Math.sin(b.phase * 0.9) * sway;
  b.x += Math.cos(h) * b.speed * dt;
  b.y += Math.sin(h) * b.speed * dt;
  const s = b.seg;
  s[0] = b.x;
  s[1] = b.y;
  for (let i = 1; i < b.n; i++) {
    const dx = s[i * 2] - s[i * 2 - 2];
    const dy = s[i * 2 + 1] - s[i * 2 - 1];
    const d = Math.hypot(dx, dy) || 1;
    s[i * 2] = s[i * 2 - 2] + (dx / d) * b.spacing;
    s[i * 2 + 1] = s[i * 2 - 1] + (dy / d) * b.spacing;
  }
}

/** Unit normal at segment i (perpendicular to the spine), for drawing widths and fins. */
export function normalAt(b: Body, i: number): [number, number] {
  const s = b.seg;
  const a = Math.max(0, i - 1);
  const c = Math.min(b.n - 1, i + 1);
  const tx = s[a * 2] - s[c * 2];
  const ty = s[a * 2 + 1] - s[c * 2 + 1];
  const d = Math.hypot(tx, ty) || 1;
  return [-ty / d, tx / d];
}
