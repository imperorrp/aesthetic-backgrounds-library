/**
 * Fleet simulation. A fleet is a leader that follows a planned curve plus wingmen
 * that hold formation slots on springs. Plans are cubic Hermite curves from the
 * leader's current position and velocity to where it is going, so the drawn
 * prediction is simply the unflown part of the same curve: trail, ship, and
 * prediction are one continuous path, and the prediction is always true.
 *
 * Fleets live on the same map plane as systems and structures, so when a freighter
 * docks at a station it is actually at that station on screen.
 */
import type { Rng } from '../../rng';
import type { Anomaly, Fleet, FleetPlan, FleetPurpose, FleetTarget, Ship, StarSystem, Structure, SystemState } from './types';
import { FORMATIONS, SHIP_SPECS, type Formation } from './ships';
import { SHIP_CLASSES, type ShipClass, type StructureRole, type UniversePack } from './universe';

export type SimView = { left: number; right: number; top: number; bottom: number };
export type FleetEventKind = 'approach' | 'dock' | 'depart' | 'jump' | 'arrive' | 'launch' | 'cargo' | 'survey';
export type FleetEvent = { kind: FleetEventKind; fleet: Fleet; target?: string };
export type FleetCtx = {
  rng: Rng;
  t: number;
  view: SimView;
  emit(e: FleetEvent): void;
  nextId(): number;
};

const DEFAULT_CLASS_COLORS: Record<ShipClass, string> = {
  fighter: '#06b6d4',
  scout: '#f59e0b',
  freighter: '#10b981',
  cruiser: '#3b82f6',
  carrier: '#818cf8',
  capital: '#e2e8f0',
};
const CLASS_WEIGHT: Record<ShipClass, number> = { fighter: 0.3, scout: 0.2, freighter: 0.25, cruiser: 0.14, carrier: 0.07, capital: 0.04 };
const TRAIL_SAMPLES = 26;
const TRAIL_INTERVAL = 0.2;
const DOCK_ROLES: readonly StructureRole[] = ['dock', 'shipyard', 'mine'];

export const shipColor = (pack: UniversePack, cls: ShipClass, faction: number): string =>
  pack.colorBy === 'class'
    ? pack.classColors?.[cls] ?? DEFAULT_CLASS_COLORS[cls]
    : pack.factions[faction]?.color ?? DEFAULT_CLASS_COLORS[cls];

export const classLabel = (pack: UniversePack, cls: ShipClass): string => pack.ships?.[cls] ?? cls.toUpperCase();

// ---- plan math ------------------------------------------------------------------------------

/** Evaluate a plan at normalized s (0..1). Writes x, y, vx, vy into `out`. */
export function evalPlanAt(p: FleetPlan, s: number, out: number[]): void {
  const u = Math.max(0, Math.min(1, s));
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  const T = p.T;
  out[0] = h00 * p.p0x + h10 * T * p.v0x + h01 * p.p1x + h11 * T * p.v1x;
  out[1] = h00 * p.p0y + h10 * T * p.v0y + h01 * p.p1y + h11 * T * p.v1y;
  out[2] = (d00 * p.p0x + d10 * T * p.v0x + d01 * p.p1x + d11 * T * p.v1x) / T;
  out[3] = (d00 * p.p0y + d10 * T * p.v0y + d01 * p.p1y + d11 * T * p.v1y) / T;
}

function makePlan(x: number, y: number, vx: number, vy: number, tx: number, ty: number, v1x: number, v1y: number, speed: number, t: number): FleetPlan {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  let sx = vx;
  let sy = vy;
  const s0 = Math.hypot(sx, sy);
  if (s0 < speed * 0.2) {
    // From rest: ease out toward the target.
    sx = ux * speed * 0.35;
    sy = uy * speed * 0.35;
  } else {
    const k = Math.min(1, speed / s0);
    sx *= k;
    sy *= k;
    // Heading away: shrink the tangent so the turn is a hook, not a loop.
    if ((sx * ux + sy * uy) / (Math.hypot(sx, sy) || 1) < -0.2) {
      sx *= 0.4;
      sy *= 0.4;
    }
  }
  const T = Math.max(1.4, (d / speed) * 1.2);
  return { p0x: x, p0y: y, v0x: sx, v0y: sy, p1x: tx, p1y: ty, v1x, v1y, T, t0: t };
}

/**
 * The points a fleet's leader will pass through over the next `horizon` seconds,
 * starting at its current position, as flat x,y pairs.
 */
export function predictPath(f: Fleet, t: number, horizon: number, step: number, out: number[]): number[] {
  out.length = 0;
  const L = f.ships[0];
  out.push(L.x, L.y);
  if (f.mode === 'transit' && f.plan) {
    const p = f.plan;
    const sNow = (t - p.t0) / p.T;
    const sEnd = Math.min(1, sNow + horizon / p.T);
    if (sEnd <= sNow) return out;
    const n = Math.max(2, Math.ceil(((sEnd - sNow) * p.T) / step));
    const tmp = [0, 0, 0, 0];
    for (let i = 1; i <= n; i++) {
      evalPlanAt(p, sNow + ((sEnd - sNow) * i) / n, tmp);
      out.push(tmp[0], tmp[1]);
    }
  } else if (f.mode === 'orbit' && f.orbit) {
    const o = f.orbit;
    const sweep = Math.max(-1.6, Math.min(1.6, o.w * horizon));
    for (let i = 1; i <= 12; i++) {
      const a = o.ang + (sweep * i) / 12;
      out.push(o.cx + Math.cos(a) * o.r, o.cy + Math.sin(a) * o.r);
    }
  }
  return out;
}

// ---- spawning ---------------------------------------------------------------------------------

function weighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return items[0];
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function composition(cls: ShipClass, rng: Rng): { formation: Formation; wings: ShipClass[]; purpose: FleetPurpose } {
  switch (cls) {
    case 'fighter':
      return { formation: 'v', wings: Array<ShipClass>(2 + Math.floor(rng() * 3)).fill('fighter'), purpose: 'patrol' };
    case 'scout':
      return rng() < 0.7 ? { formation: 'solo', wings: [], purpose: 'survey' } : { formation: 'line', wings: ['scout'], purpose: 'survey' };
    case 'freighter':
      return { formation: 'column', wings: Array<ShipClass>(1 + Math.floor(rng() * 3)).fill('freighter'), purpose: 'cargo' };
    case 'cruiser':
      return { formation: 'escort', wings: ['fighter', 'fighter'], purpose: 'transit' };
    case 'carrier':
      return { formation: 'escort', wings: ['fighter', 'fighter', 'fighter'], purpose: 'transit' };
    case 'capital':
      return { formation: 'escort', wings: ['cruiser', 'cruiser', 'fighter', 'fighter'], purpose: 'transit' };
  }
}

export type SpawnOptions = {
  cls?: ShipClass;
  faction?: number;
  purpose?: FleetPurpose;
  callsign?: string;
  /** Start invisible and fade in (launches, gate arrivals). */
  fadeIn?: boolean;
};

export function spawnFleet(world: SystemState, c: FleetCtx, at: { x: number; y: number; vx: number; vy: number }, opts: SpawnOptions = {}): Fleet {
  const { rng } = c;
  const pack = world.universe;
  const factions = pack.factions.length ? pack.factions : [{ name: 'UNKNOWN', prefix: 'UNK', color: '#22d3ee' }];

  let faction = opts.faction;
  let cls = opts.cls;
  if (faction === undefined) {
    const allowed = factions.map((f, i) => ({ f, i })).filter(({ f }) => !cls || !f.classes || f.classes.includes(cls));
    faction = (weighted(rng, allowed.length ? allowed : factions.map((f, i) => ({ f, i })), ({ f }) => f.weight ?? 1) ?? { i: 0 }).i;
  }
  if (!cls) {
    const flies = factions[faction]?.classes?.length ? factions[faction].classes! : SHIP_CLASSES;
    cls = weighted(rng, flies, (k) => CLASS_WEIGHT[k]) ?? 'fighter';
  }

  const comp = composition(cls, rng);
  const classes: ShipClass[] = [cls, ...comp.wings];
  const spacing = Math.max(...classes.map((k) => SHIP_SPECS[k].size)) * 1.35 + 4;
  const heading = Math.atan2(at.vy, at.vx);
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const slots = FORMATIONS[comp.formation];
  const ships: Ship[] = classes.map((k, i) => {
    const slot: [number, number] = i === 0 ? [0, 0] : [slots[(i - 1) % slots.length][0], slots[(i - 1) % slots.length][1]];
    const lx = slot[0] * spacing;
    const ly = slot[1] * spacing;
    return {
      cls: k,
      color: shipColor(pack, k, faction!),
      x: at.x + lx * cos - ly * sin,
      y: at.y + lx * sin + ly * cos,
      vx: at.vx,
      vy: at.vy,
      heading,
      slot,
    };
  });

  const id = c.nextId();
  const prefix = factions[faction]?.prefix ?? 'FLT';
  const fleet: Fleet = {
    id: `F${id}`,
    callsign: opts.callsign ?? `${prefix}-${100 + Math.floor(rng() * 900)}`,
    cls,
    faction,
    purpose: opts.purpose ?? comp.purpose,
    ships,
    formation: comp.formation,
    spacing,
    mode: 'transit',
    trail: [],
    lastSample: c.t,
    showLabel: rng() > 0.3,
    fade: opts.fadeIn ? 0 : 1,
    fadeTo: 1,
    visits: 0,
    maxVisits: comp.purpose === 'transit' ? 2 : 2 + Math.floor(rng() * 3),
    surveyed: [],
  };
  return fleet;
}

// ---- targets ----------------------------------------------------------------------------------

const inReach = (x: number, y: number, v: SimView, margin: number) =>
  x > v.left - margin && x < v.right + margin && y > v.top - margin && y < v.bottom + margin;

const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

export const allStructures = (world: SystemState): Structure[] =>
  world.systems.length ? [...world.structures, ...world.systems.flatMap((s) => s.structures)] : world.structures;

const structureTarget = (s: Structure): FleetTarget => ({ kind: 'structure', id: s.id, x: s.x, y: s.y, label: s.label, role: s.role });
const systemTarget = (s: StarSystem): FleetTarget => ({ kind: 'system', id: s.id, x: s.x, y: s.y, label: s.name });
const anomalyTarget = (a: Anomaly): FleetTarget => ({ kind: 'anomaly', id: a.id, x: a.x, y: a.y, label: a.text });

/** Pick among the nearest few, so fleets do not all queue at one place. */
function nearestOf<T extends { x: number; y: number }>(rng: Rng, items: T[], x: number, y: number, k = 3): T | undefined {
  if (!items.length) return undefined;
  const sorted = [...items].sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y));
  return sorted[Math.floor(rng() * Math.min(k, sorted.length))];
}

function exitTarget(f: Fleet, c: FleetCtx): FleetTarget {
  const L = f.ships[0];
  const v = c.view;
  const r = c.rng();
  // The map scrolls left, so most traffic leaves that way; some leaves up, down, or ahead.
  if (r < 0.45) return { kind: 'exit', x: v.left - 160, y: Math.max(v.top + 40, Math.min(v.bottom - 40, L.y + (c.rng() - 0.5) * 300)) };
  if (r < 0.65) return { kind: 'exit', x: L.x + (c.rng() - 0.3) * 400, y: v.top - 140 };
  if (r < 0.85) return { kind: 'exit', x: L.x + (c.rng() - 0.3) * 400, y: v.bottom + 140 };
  return { kind: 'exit', x: v.right + 180, y: Math.max(v.top + 40, Math.min(v.bottom - 40, L.y + (c.rng() - 0.5) * 300)) };
}

export function chooseTarget(f: Fleet, world: SystemState, c: FleetCtx): FleetTarget {
  const L = f.ships[0];
  if (f.visits >= f.maxVisits) return exitTarget(f, c);
  const here = f.target?.id;
  const structs = allStructures(world).filter((s) => s.id !== here && inReach(s.x, s.y, c.view, 80));
  const byRole = (...roles: StructureRole[]) => structs.filter((s) => roles.includes(s.role));

  switch (f.purpose) {
    case 'cargo': {
      // Mines and docks alternate: load at a mine, unload at a dock or yard.
      const fromMine = f.target?.role === 'mine';
      const next = nearestOf(c.rng, fromMine ? byRole('dock', 'shipyard') : byRole('mine'), L.x, L.y, 2)
        ?? nearestOf(c.rng, byRole('dock', 'shipyard', 'mine'), L.x, L.y, 2);
      return next ? structureTarget(next) : exitTarget(f, c);
    }
    case 'patrol': {
      const posts = [...byRole('defense', 'gate', 'relay').map(structureTarget), ...world.systems.filter((s) => s.id !== here && inReach(s.x, s.y, c.view, 40)).map(systemTarget)];
      return nearestOf(c.rng, posts, L.x, L.y, 3) ?? exitTarget(f, c);
    }
    case 'survey': {
      const fresh = world.anomalies.filter((a) => !f.surveyed.includes(a.id) && inReach(a.x, a.y, c.view, 60));
      const a = nearestOf(c.rng, fresh, L.x, L.y, 2);
      if (a) return anomalyTarget(a);
      const odd = nearestOf(c.rng, byRole('mystery', 'wreck', 'hazard'), L.x, L.y, 2);
      return odd ? structureTarget(odd) : exitTarget(f, c);
    }
    case 'transit':
    default: {
      const gates = byRole('gate');
      if (gates.length && c.rng() < 0.45) return structureTarget(nearestOf(c.rng, gates, L.x, L.y, 2)!);
      const systems = world.systems.filter((s) => s.id !== here && inReach(s.x, s.y, c.view, 40));
      const pick = nearestOf(c.rng, [...systems.map(systemTarget), ...byRole('dock', 'giant').map(structureTarget)], L.x, L.y, 3);
      return pick ?? exitTarget(f, c);
    }
  }
}

/** How close a fleet sits to a target when it berths or orbits there. */
function standoff(f: Fleet, t: FleetTarget, world: SystemState): number {
  if (t.kind === 'system') {
    const sys = world.systems.find((s) => s.id === t.id);
    const outer = sys ? Math.max(0, ...sys.planets.map((p) => p.orbitRadius ?? 0)) : 30;
    return outer + 14 + SHIP_SPECS[f.cls].size * 0.5;
  }
  if (t.kind === 'anomaly') return 26;
  if (t.role === 'defense') return 42;
  if (t.role && DOCK_ROLES.includes(t.role)) return 20;
  return 30;
}

/** Set a new plan from the leader's current state to `target`. */
export function goTo(f: Fleet, target: FleetTarget, world: SystemState, c: FleetCtx): void {
  const L = f.ships[0];
  const speed = SHIP_SPECS[f.cls].speed;
  let px = target.x;
  let py = target.y;
  let v1x = 0;
  let v1y = 0;
  if (target.kind === 'exit' || target.kind === 'point') {
    const d = Math.hypot(px - L.x, py - L.y) || 1;
    v1x = ((px - L.x) / d) * speed;
    v1y = ((py - L.y) / d) * speed;
  } else {
    const r = standoff(f, target, world);
    const ang = Math.atan2(L.y - target.y, L.x - target.x);
    px = target.x + Math.cos(ang) * r;
    py = target.y + Math.sin(ang) * r;
    const docking = target.kind === 'structure' && target.role && (DOCK_ROLES.includes(target.role) || target.role === 'gate');
    if (docking) {
      // Arrive slow and pointed at the berth.
      v1x = -Math.cos(ang) * speed * 0.2;
      v1y = -Math.sin(ang) * speed * 0.2;
    } else {
      // Arrive tangent to the orbit, turning the way we already lean.
      const cross = (L.x - target.x) * L.vy - (L.y - target.y) * L.vx;
      const dir = cross >= 0 ? 1 : -1;
      v1x = -Math.sin(ang) * speed * 0.7 * dir;
      v1y = Math.cos(ang) * speed * 0.7 * dir;
    }
  }
  f.plan = makePlan(L.x, L.y, L.vx, L.vy, px, py, v1x, v1y, speed, c.t);
  f.target = target;
  f.mode = 'transit';
}

// ---- stepping ---------------------------------------------------------------------------------

function arrive(f: Fleet, world: SystemState, c: FleetCtx): void {
  const tg = f.target;
  const L = f.ships[0];
  f.visits++;
  if (!tg || tg.kind === 'exit') {
    f.mode = 'gone';
    return;
  }
  if (tg.kind === 'point') {
    goTo(f, chooseTarget(f, world, c), world, c);
    return;
  }
  const struct = tg.kind === 'structure' ? allStructures(world).find((s) => s.id === tg.id) : undefined;
  if (struct && struct.role === 'gate') {
    f.mode = 'jumping';
    f.jumpAt = c.t + 0.8;
    f.fadeTo = 0;
    struct.flashAt = c.t;
    c.emit({ kind: 'jump', fleet: f, target: struct.label });
    return;
  }
  if (struct && DOCK_ROLES.includes(struct.role)) {
    f.mode = 'docked';
    f.dockedUntil = c.t + 4 + c.rng() * 5;
    f.fadeTo = 0.5;
    struct.flashAt = c.t;
    L.vx = 0;
    L.vy = 0;
    c.emit({ kind: 'dock', fleet: f, target: struct.label });
    return;
  }
  // Everything else: hold an orbit for a while.
  const r = Math.max(14, Math.hypot(L.x - tg.x, L.y - tg.y));
  const cross = (L.x - tg.x) * L.vy - (L.y - tg.y) * L.vx;
  const speed = SHIP_SPECS[f.cls].speed * 0.55;
  f.orbit = {
    cx: tg.x,
    cy: tg.y,
    r,
    ang: Math.atan2(L.y - tg.y, L.x - tg.x),
    w: (speed / r) * (cross >= 0 ? 1 : -1),
    until: c.t + (tg.kind === 'anomaly' ? 5 + c.rng() * 3 : 6 + c.rng() * 6),
  };
  f.mode = 'orbit';
  if (tg.kind === 'anomaly') {
    f.surveyed.push(tg.id!);
    c.emit({ kind: 'survey', fleet: f, target: tg.label });
  }
}

function depart(f: Fleet, world: SystemState, c: FleetCtx): void {
  const L = f.ships[0];
  if (f.mode === 'docked') {
    c.emit({ kind: 'depart', fleet: f, target: f.target?.label });
    f.fadeTo = 1;
    // Push off the berth, away from the structure.
    if (f.target) {
      const ang = Math.atan2(L.y - f.target.y, L.x - f.target.x);
      const sp = SHIP_SPECS[f.cls].speed * 0.3;
      L.vx = Math.cos(ang) * sp;
      L.vy = Math.sin(ang) * sp;
    }
  }
  f.orbit = undefined;
  goTo(f, chooseTarget(f, world, c), world, c);
}

function jump(f: Fleet, world: SystemState, c: FleetCtx): void {
  const from = f.target?.id;
  const gates = allStructures(world).filter((s) => s.role === 'gate' && s.id !== from && inReach(s.x, s.y, c.view, -20));
  const dest = gates.length ? gates[Math.floor(c.rng() * gates.length)] : undefined;
  if (!dest) {
    f.mode = 'gone';
    return;
  }
  const ang = c.rng() * Math.PI * 2;
  const sp = SHIP_SPECS[f.cls].speed * 0.5;
  for (const s of f.ships) {
    const jitter = f.spacing * 0.6;
    s.x = dest.x + Math.cos(ang) * 22 + (c.rng() - 0.5) * jitter;
    s.y = dest.y + Math.sin(ang) * 22 + (c.rng() - 0.5) * jitter;
    s.vx = Math.cos(ang) * sp;
    s.vy = Math.sin(ang) * sp;
    s.heading = ang;
  }
  f.trail = [];
  f.fade = 0;
  f.fadeTo = 1;
  dest.flashAt = c.t;
  f.target = structureTarget(dest);
  c.emit({ kind: 'arrive', fleet: f, target: dest.label });
  goTo(f, chooseTarget(f, world, c), world, c);
}

const tmp = [0, 0, 0, 0];

const turnToward = (a: number, b: number, k: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
};

/** Advance one fleet by `dt` seconds. */
export function stepFleet(f: Fleet, world: SystemState, c: FleetCtx, dt: number): void {
  const L = f.ships[0];
  f.fade += (f.fadeTo - f.fade) * Math.min(1, dt * 2.5);

  switch (f.mode) {
    case 'transit': {
      const p = f.plan;
      if (!p) {
        goTo(f, chooseTarget(f, world, c), world, c);
        break;
      }
      evalPlanAt(p, (c.t - p.t0) / p.T, tmp);
      L.x = tmp[0];
      L.y = tmp[1];
      L.vx = tmp[2];
      L.vy = tmp[3];
      if (c.t - p.t0 >= p.T) arrive(f, world, c);
      break;
    }
    case 'orbit': {
      const o = f.orbit!;
      o.ang += o.w * dt;
      L.x = o.cx + Math.cos(o.ang) * o.r;
      L.y = o.cy + Math.sin(o.ang) * o.r;
      L.vx = -Math.sin(o.ang) * o.r * o.w;
      L.vy = Math.cos(o.ang) * o.r * o.w;
      if (c.t >= o.until) depart(f, world, c);
      break;
    }
    case 'docked':
      if (c.t >= (f.dockedUntil ?? 0)) depart(f, world, c);
      break;
    case 'jumping':
      if (c.t >= (f.jumpAt ?? 0)) jump(f, world, c);
      break;
  }
  if ((f.mode as string) === 'gone') return;

  const lspeed = Math.hypot(L.vx, L.vy);
  if (lspeed > 1.5) L.heading = turnToward(L.heading, Math.atan2(L.vy, L.vx), dt * 6);

  // Wingmen: springs toward their slot (or a berth around the dock when docked).
  const cos = Math.cos(L.heading);
  const sin = Math.sin(L.heading);
  const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
  const h = dt / steps;
  for (let i = 1; i < f.ships.length; i++) {
    const s = f.ships[i];
    let tx: number;
    let ty: number;
    if (f.mode === 'docked' && f.target) {
      const a = (i / (f.ships.length - 1)) * Math.PI * 1.2 + Math.atan2(L.y - f.target.y, L.x - f.target.x) - Math.PI * 0.6;
      const r = 20 + i * 3;
      tx = f.target.x + Math.cos(a) * r;
      ty = f.target.y + Math.sin(a) * r;
    } else {
      const lx = s.slot[0] * f.spacing;
      const ly = s.slot[1] * f.spacing;
      tx = L.x + lx * cos - ly * sin;
      ty = L.y + lx * sin + ly * cos;
    }
    const k = SHIP_SPECS[s.cls].agility ** 2 * 0.8;
    const damp = 2 * Math.sqrt(k) * 0.9;
    for (let n = 0; n < steps; n++) {
      s.vx += (k * (tx - s.x) - damp * (s.vx - L.vx)) * h;
      s.vy += (k * (ty - s.y) - damp * (s.vy - L.vy)) * h;
      s.x += s.vx * h;
      s.y += s.vy * h;
    }
    const sp = Math.hypot(s.vx, s.vy);
    s.heading = turnToward(s.heading, sp > 2 ? Math.atan2(s.vy, s.vx) : L.heading, dt * 5);
  }

  // Trail: the leader's real past, sampled on sim time.
  if (c.t - f.lastSample >= TRAIL_INTERVAL) {
    f.lastSample = c.t;
    if (f.mode === 'docked') {
      f.trail.splice(0, 2);
    } else {
      f.trail.push(L.x, L.y);
      if (f.trail.length > TRAIL_SAMPLES * 2) f.trail.splice(0, 2);
    }
  }

  // Leave once past the exit, or once the map has scrolled far past the fleet.
  const v = c.view;
  if (f.target?.kind === 'exit' && !inReach(L.x, L.y, v, 60)) f.mode = 'gone';
  if (L.x < v.left - 500) f.mode = 'gone';
}
