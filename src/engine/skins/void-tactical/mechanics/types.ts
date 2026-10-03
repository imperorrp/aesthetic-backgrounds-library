/**
 * Mechanics: pluggable simulation for the sector map. A mechanic owns some piece of
 * what happens (raids, mining, storms, a war, a singing star), with its own entities,
 * events, and drawing, and a schema of tunable parameters. A universe pack lists the
 * mechanics it runs; the studio can switch them on and off and tune them; anyone can
 * register new ones with `registerMechanic`.
 */
import type { Rng } from '../../../rng';
import type { Schema } from '../../../core/schema';
import type { SkinHost } from '../../../core/skin';
import type { Fleet, Ship, Structure, SystemState } from '../types';
import type { SpawnOptions, SimView } from '../fleets';
import type { UniversePack } from '../universe';
import type { RenderFrame } from '../renderers/utils';
import type { LabelBoard } from '../renderers/board';
import type { Fx } from './fx';
import type { View } from '../../../sim/view';
import type { Bus, WorldEvent } from '../../../sim/bus';

/**
 * Where a mechanic draws, bottom to top:
 *   ground  just above the stars: terrain, dust, territory washes
 *   under   under the systems and structures: fronts, belts, currents
 *   mid     among the structures, under the ships: rings, routes, markers
 *   over    over the ships: beams, explosions, alerts
 *   hud     on top of everything, after the labels
 *
 * Mechanic passes run inside the camera transform: draw in MAP SPACE (`api.screenX(x)`,
 * world `y`), exactly as if the camera never moved, and the director's pan and zoom
 * apply on their own. Label requests made through the `board` argument use map space too.
 */
export type MechanicPass = 'ground' | 'under' | 'mid' | 'over' | 'hud';

export type MechanicSpawn = SpawnOptions & {
  /** Paint every hull this color (raiders, a faction at war). */
  color?: string;
  tag?: string;
  hostile?: boolean;
  /** Take over the leader's movement each frame; the formation follows. */
  steer?: (f: Fleet, dt: number) => void;
  /** Arrive with warp streaks instead of flying in. */
  warpIn?: boolean;
};

export type MechanicApi = {
  readonly world: SystemState;
  readonly host: SkinHost;
  readonly rng: Rng;
  readonly pack: UniversePack;
  readonly fx: Fx;
  /** Sim time in seconds. */
  readonly t: number;
  /** 0..1 slow activity curve. */
  readonly tension: number;
  readonly width: number;
  readonly height: number;
  /** The base frame on the main plane, in world units. */
  view(): SimView;
  /** World x to map-space x (what mechanic draw passes use; see `MechanicPass`). */
  screenX(x: number): number;
  /** Inside the base frame (the populated area), regardless of where the director looks. */
  onScreen(x: number, y: number, margin?: number): boolean;
  /** The live camera: projection, zoom, depth. Most mechanics never need it. */
  readonly camera: View;
  /** The event stream. Emit what happens (with x, y, weight) so the camera, audio, and tooling react. */
  readonly bus: Bus;
  emit(e: WorldEvent): void;
  /** A `follow` function for events about a fleet: where its leader is, until it is gone. */
  follow(f: Fleet): NonNullable<WorldEvent['follow']>;
  /**
   * A shared, per-world service, created on first use: `api.use('economy', () => createEconomy(api))`.
   * Every mechanic that asks for the same key gets the same instance.
   */
  use<T>(key: string, create: () => T): T;
  /** Extra per-frame work (services register theirs here); runs after the mechanics. */
  onUpdate(fn: (dt: number) => void): void;
  /** Extra drawing at a pass (services register theirs here); runs before the mechanics' own. */
  onDraw(pass: MechanicPass, fn: (ctx: CanvasRenderingContext2D, frame: RenderFrame, board?: LabelBoard) => void): void;
  /** 0..1 nearness to page content, at a map-plane point. */
  quiet(x: number, y: number): number;
  /** Put a line of chatter on the map. */
  say(text: string, x: number, y: number, color: string, opts?: { priority?: 'low' | 'medium' | 'high'; followId?: string; duration?: number }): void;
  spawnFleet(at: { x: number; y: number; vx: number; vy: number }, opts?: MechanicSpawn): Fleet;
  /** Send a fleet back to its normal life (stop steering, pick a destination). */
  release(f: Fleet): void;
  /** Hurt a ship; destroys it (explosion, debris, maybe a wreck) at zero. */
  damage(f: Fleet, ship: Ship, amount: number): void;
  structures(): Structure[];
  addStructure(s: Pick<Structure, 'x' | 'y' | 'label' | 'role' | 'art' | 'color'> & Partial<Structure>): Structure;
  removeStructure(id: string): void;
};

export type MechanicInstance = {
  update?(dt: number): void;
  draw?(ctx: CanvasRenderingContext2D, pass: MechanicPass, frame: RenderFrame, board?: LabelBoard): void;
};

export type Mechanic = {
  id: string;
  label: string;
  description: string;
  schema: Schema;
  create(api: MechanicApi, params: Record<string, unknown>): MechanicInstance;
};

/** A pack's (or the studio's) reference to a mechanic. */
export type MechanicRef = { use: string; with?: Record<string, unknown>; enabled?: boolean };

const registry = new Map<string, Mechanic>();
export function registerMechanic(m: Mechanic): Mechanic {
  registry.set(m.id, m);
  return m;
}
export const getMechanic = (id: string) => registry.get(id);
export const listMechanics = () => [...registry.values()];

/** Steering helpers for mechanic-controlled leaders. */
export function steerToward(s: Ship, tx: number, ty: number, speed: number, accel: number, dt: number, slowRadius = 0): void {
  const dx = tx - s.x;
  const dy = ty - s.y;
  const d = Math.hypot(dx, dy) || 1;
  const want = slowRadius > 0 ? speed * Math.min(1, d / slowRadius) : speed;
  const k = Math.min(1, accel * dt);
  s.vx += ((dx / d) * want - s.vx) * k;
  s.vy += ((dy / d) * want - s.vy) * k;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

export function steerOrbit(s: Ship, cx: number, cy: number, r: number, speed: number, dir: number, accel: number, dt: number): void {
  const dx = s.x - cx;
  const dy = s.y - cy;
  const d = Math.hypot(dx, dy) || 1;
  // Tangent plus a radial correction toward the ring.
  const tx = (-dy / d) * dir;
  const ty = (dx / d) * dir;
  const pull = (r - d) / r;
  const k = Math.min(1, accel * dt);
  s.vx += ((tx + (dx / d) * pull * 1.6) * speed - s.vx) * k;
  s.vy += ((ty + (dy / d) * pull * 1.6) * speed - s.vy) * k;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

/** Hull points per class. */
export const HULL: Record<string, number> = { fighter: 2, scout: 2, freighter: 4, cruiser: 7, carrier: 9, capital: 14 };
