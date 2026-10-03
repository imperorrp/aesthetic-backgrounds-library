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

/** Where a mechanic draws: under the systems, among the ships, or over everything. */
export type MechanicPass = 'under' | 'mid' | 'over';

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
  view(): SimView;
  /** Map-plane x to screen x. */
  screenX(x: number): number;
  onScreen(x: number, y: number, margin?: number): boolean;
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
