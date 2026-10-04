/**
 * The void-tactical simulation, separated from drawing so the monolithic skin and
 * the per-part layers (`void-stars`, `void-systems`, `void-fleets`, `void-hud`) run
 * the same world. Layers in one scene share a single world instance.
 *
 * Systems, structures, fleets, and anomalies all live on one map plane, so ships
 * really reach the stations they dock at. Structures act: shipyards launch fleets,
 * mines send convoys to docks, gates bring arrivals. A slow tension curve makes the
 * sector alternate between quiet stretches and busy ones.
 *
 * Randomness order is load-bearing: everything draws from seeded streams in a fixed
 * sequence, so a seed replays identically across the skin and the layer stack.
 */
import type { Fleet, Ship, Structure, SystemState, LabelDensity, TacticalElement } from './types';
import type { StructureRole } from './universe';
import { createFx } from './mechanics/fx';
import { getMechanic, type MechanicApi, type MechanicInstance, type MechanicPass, type MechanicRef, type MechanicSpawn } from './mechanics';
import { ASCII_ART } from './renderers/art';
import type { LabelBoard } from './renderers/board';
import { generateSystem, generateSingleSystem, generateSingleStructure, generateSingleAnomaly } from './generators';
import { allStructures, chooseTarget, classLabel, goTo, spawnFleet, stepFleet, type FleetCtx, type FleetEvent, type SimView } from './fleets';
import { createColorMapper, WORLD_SPEED_MULTIPLIER, type RenderFrame, type VoidStyle } from './renderers/utils';
import { DEFAULT_EVENTS, resolveUniverse, type ShipClass, type UniversePack } from './universe';
import { isVoidReady, prepareVoidTactical } from './ready';
import { SHIP_SPECS } from './ships';
import type { FrameInfo, SkinHost, SkinInspection, Viewport } from '../../core/skin';
import { resolveOptions, type Schema } from '../../core/schema';
import { createView, type View } from '../../sim/view';
import { createBus, type Bus, type WorldEvent } from '../../sim/bus';
import { createDirector, type CameraMode } from '../../sim/director';

/** Screen x = world x - camera.x * MAP_PARALLAX for everything on the map plane. */
export const MAP_PARALLAX = 0.25 * WORLD_SPEED_MULTIPLIER;

/** HUD text budget per detail level. */
const OVERLAY_BUDGET: Record<LabelDensity, { rate: number; max: number }> = {
  none: { rate: 0, max: 0 },
  low: { rate: 0.012, max: 3 },
  medium: { rate: 0.03, max: 5 },
  high: { rate: 0.05, max: 8 },
};

/** Calibration knobs. Defaults are the calibrated look: near-original color variety, heavier lines, compact sprites, quieter HUD, long trails. */
export const STYLE_SCHEMA: Schema = {
  hueVariety: { type: 'number', min: 0, max: 1, default: 0.94, label: 'Hue variety', description: '0 pulls every entity into the palette family; 1 keeps the original rainbow' },
  lineWeight: { type: 'number', min: 0.5, max: 2, default: 1.4, label: 'Line weight' },
  spriteScale: { type: 'number', min: 0.5, max: 2.5, default: 0.8, label: 'Sprite scale', description: 'Size of the ASCII structure art' },
  shipScale: { type: 'number', min: 0.6, max: 2, default: 1, label: 'Ship size' },
  hud: { type: 'number', min: 0, max: 1, default: 0.6, label: 'HUD opacity', description: 'Labels, telemetry, and chatter text' },
  paths: { type: 'enum', values: ['dashed', 'dots', 'off'], default: 'dashed', label: 'Fleet paths', description: 'How the planned course ahead of each fleet is drawn' },
  trails: { type: 'number', min: 0, max: 1, default: 0.9, label: 'Fleet trails' },
  lock: { type: 'boolean', default: true, label: 'Target lock', description: 'Brackets close on a contact every half minute while its data types out' },
};

/** How the camera behaves: the director leans in on events; input options add the pointer. */
export const CAMERA_SCHEMA: Schema = {
  camera: {
    type: 'enum',
    values: ['steady', 'director', 'cinematic'],
    default: 'director',
    label: 'Camera',
    description: 'Steady: the classic fixed framing. Director: now and then it leans in on something happening. Cinematic: it chases the action.',
  },
  lean: { type: 'boolean', default: true, label: 'Lean toward the pointer', description: 'The camera drifts a few percent toward the mouse' },
  scroll: { type: 'boolean', default: false, label: 'Travel with the page scroll', description: 'Scrolling down the page carries the map forward through the sector' },
};

/** Fleet events as camera interest and sound weight (0..1). */
const FLEET_EVENT_WEIGHT: Record<string, number> = { launch: 0.3, jump: 0.35, arrive: 0.35, cargo: 0.15, survey: 0.2, dock: 0.1, depart: 0.1, approach: 0.1 };

export function resolveStyle(options: unknown): VoidStyle {
  return resolveOptions(STYLE_SCHEMA, options) as unknown as VoidStyle;
}

export type VoidWorld = {
  world: SystemState;
  /** The drift accumulator (the classic camera); `view` is what is actually drawn. */
  camera: { x: number; y: number };
  view: View;
  bus: Bus;
  readonly width: number;
  readonly height: number;
  /** Advance spawning, fleets, culling, and the camera by one frame. Idempotent per `info.frame`. */
  update(info: FrameInfo): void;
  resize(viewport: Viewport): void;
  /** Per-frame render context for a given style (each layer may calibrate differently). */
  frameFor(info: FrameInfo, style: VoidStyle): RenderFrame;
  /** Draw the universe's mechanics (and, in the `over` pass, effects) at one depth. */
  drawPass(ctx: CanvasRenderingContext2D, pass: MechanicPass, frame: RenderFrame, board?: LabelBoard): void;
  /** Counts, the log of everything said on the map, and any problems, for tooling. */
  inspect(): SkinInspection;
};

const fill = (template: string, target?: string) => template.replace(/\{target\}/i, target ?? 'UNKNOWN');

export function createVoidWorld(host: SkinHost): VoidWorld {
  const { rng, config, palette } = host;
  const pack: UniversePack = resolveUniverse(host.options as { universe?: unknown; pack?: unknown });
  const look = { lanes: 'straight', grid: 'crosses', traffic: 1, anomalies: 1, depth: 0.35, ...pack.look };
  let width = host.viewport.width;
  let height = host.viewport.height;
  const frameRng = host.fork('frame');
  const fleetRng = host.fork('fleets');
  const chatterRng = host.fork('chatter');
  const mappers = new Map<number, (hex: string) => string>();
  const colorFor = (hueVariety: number) => {
    let m = mappers.get(hueVariety);
    if (!m) {
      m = createColorMapper(palette, hueVariety);
      mappers.set(hueVariety, m);
    }
    return m;
  };

  const budget = OVERLAY_BUDGET[config.detail] ?? OVERLAY_BUDGET.low;
  const simSettings = { labelDensity: config.detail, overlaySpawnRate: budget.rate, maxOverlays: budget.max };

  const layout = { systemDist: 480, structDist: 300, maxSystems: 5, maxStructs: 12, maxFleets: 8, maxAnomalies: 5, starCount: 150 };
  const updateLayout = () => {
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const area = width * height;
    const densityFactor = isMobile ? 4000 : 7000;
    // Intensity thins the population. The quality governor only trims stars, gently.
    const d = config.density * (0.5 + 0.5 * host.intensity);
    layout.starCount = Math.max(40, Math.min(400, Math.floor((area / densityFactor) * d * Math.max(0.6, host.quality))));
    const scale = isMobile ? 0.5 : isTablet ? 0.75 : 1;
    layout.systemDist = 480 * scale;
    layout.structDist = 300 * scale;
    const scenery = look.scenery ?? 1;
    layout.maxSystems = scenery > 0 ? Math.max(1, Math.round(5 * scale * d * scenery)) : 0;
    layout.maxStructs = scenery > 0 ? Math.max(2, Math.round(12 * scale * d * scenery)) : 0;
    layout.maxFleets = look.traffic > 0 ? Math.max(2, Math.round(8 * scale * d * look.traffic)) : 0;
    layout.maxAnomalies = look.anomalies > 0 ? Math.max(1, Math.round(5 * scale * d * look.anomalies)) : 0;
  };
  updateLayout();

  const world: SystemState = generateSystem(width, height, { starCount: layout.starCount, rng, settings: simSettings, palette, universe: pack });
  const camera = { x: 0, y: 0 };
  const P = MAP_PARALLAX;
  const nextId = () => ++world.seq;
  /** The base frame on the main plane, in world units (spawning, culling, fleet reach). */
  const view = (): SimView => ({ left: camera.x * P, right: camera.x * P + width, top: 0, bottom: height });

  // ---- camera, events, director ----------------------------------------------------------------
  const cam = createView(width, height);
  const bus = createBus(() => now);
  const opts = (host.options ?? {}) as { camera?: unknown; lean?: unknown; scroll?: unknown };
  let lastScrollY = host.scroll?.y ?? 0;
  let nextAmbience = 0;
  const cameraMode: CameraMode = opts.camera === 'steady' || opts.camera === 'cinematic' ? opts.camera : 'director';
  const director = createDirector(cam, bus, cameraMode, host.fork('director'));
  // Report what happens to the host (sound binds here): where on screen, and how near.
  bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const z = e.z ?? 0;
    const sx = typeof e.x === 'number' ? cam.sx(e.x, z) : width / 2;
    const sy = typeof e.y === 'number' ? cam.sy(e.y, z) : height / 2;
    const onScreen = sx > -40 && sx < width + 40 && sy > -40 && sy < height + 40;
    out.emit({
      type: e.type,
      weight: e.weight ?? 0.2,
      pan: Math.max(-1, Math.min(1, (sx / Math.max(1, width)) * 2 - 1)),
      near: (onScreen ? 1 : 0.35) / (1 + z),
      text: e.text,
      color: e.color,
      size: typeof e.size === 'number' ? e.size : undefined,
      priority: e.priority,
    });
  });
  /** Base-frame screen position at depth z (ignores the director): for reach and culling. */
  const baseSx = (x: number, z = 0) => width / 2 + (x - cam.baseX) / (1 + z);
  const baseSy = (y: number, z = 0) => height / 2 + (y - cam.baseY) / (1 + z);
  const syncBase = () => cam.setBase(camera.x * P + width / 2, height / 2);
  syncBase();

  let now = 0;
  let systemIndex = 0;
  let rosterIndex = 0;
  const recentKinds: string[] = [];
  const recentRoles: StructureRole[] = [];
  const recentAnomalies: string[] = [];

  /** Problems noticed along the way (failed mechanics), for `inspect()`. */
  const problems: string[] = [];

  // ---- overlays (event text and ambient chatter) -------------------------------------------
  const say = (el: Omit<TacticalElement, 'id' | 'lifetime' | 'createdAt' | 'anchor' | 'type'> & { type?: TacticalElement['type'] }) => {
    if (!silent) bus.emit({ type: 'say', text: el.text, priority: el.priority, x: el.x, y: el.y, color: el.color });
    if (world.settings.maxOverlays <= 0) return;
    if (world.overlays.length >= world.settings.maxOverlays) {
      // Events outrank ambient chatter: replace the oldest low-priority line.
      if (el.priority === 'low') return;
      const i = world.overlays.findIndex((o) => o.priority === 'low');
      if (i < 0) return;
      world.overlays.splice(i, 1);
    }
    world.overlays.push({ ...el, type: el.type ?? 'info', id: `ov-${nextId()}`, lifetime: el.duration, anchor: 'world', createdAt: now * 1000 });
  };

  let silent = false;
  /** Where a fleet's leader is now, while it exists: lets the camera track it. */
  const followFleet = (f: Fleet) => () => (f.mode !== 'gone' && f.ships[0] ? { x: f.ships[0].x, y: f.ships[0].y, z: f.z } : null);
  const onEvent = (e: FleetEvent) => {
    if (silent) return;
    const L = e.fleet.ships[0];
    bus.emit({ type: e.kind, x: L.x, y: L.y, z: e.fleet.z, weight: FLEET_EVENT_WEIGHT[e.kind] ?? 0.1, color: L.color, follow: followFleet(e.fleet), fleet: e.fleet.id, at: e.targetId });
    const template = pack.events?.[e.kind] ?? DEFAULT_EVENTS[e.kind];
    say({
      text: `${e.fleet.callsign} ${fill(template, e.target)}`,
      x: L.x,
      y: L.y,
      priority: e.kind === 'dock' || e.kind === 'jump' || e.kind === 'arrive' ? 'high' : 'medium',
      color: e.fleet.ships[0].color,
      followId: e.fleet.id,
      duration: 3600,
      type: 'fleet',
    });
  };
  const fleetFrame = { sx: baseSx, sy: baseSy, get width() { return width; }, get height() { return height; } };
  const ctx = (): FleetCtx => ({ rng: fleetRng, t: now, view: view(), frame: fleetFrame, emit: onEvent, nextId });

  // ---- placement ---------------------------------------------------------------------------
  const pushStructure = (next: Structure) => {
    world.structures.push(next);
    recentKinds.push(next.kind);
    recentRoles.push(next.role);
    if (recentKinds.length > 8) recentKinds.shift();
    if (recentRoles.length > 8) recentRoles.shift();
  };
  const newStructure = (x: number, y: number) => {
    const s = generateSingleStructure(x, y, recentKinds, rng, pack, recentRoles, nextId());
    s.nextAction = now + 4 + rng() * 14;
    return s;
  };
  const newSystem = (x: number, y: number) => generateSingleSystem(x, y, rng, palette, pack, systemIndex++);

  /**
   * Depth for new scenery: most of it on the main plane, `look.depth` of it farther back
   * (two planes, 0.55 and 1.1). Far scenery covers more world for the same screen, so it
   * is placed and spaced in units scaled by (1 + z).
   */
  const depthFor = (r: number) => (look.depth > 0 && r < look.depth ? (r < look.depth * 0.55 ? 0.55 : 1.1) : 0);
  /** Same plane, roughly: things only crowd each other on their own plane. */
  const samePlane = (a: number | undefined, b: number) => Math.abs((a ?? 0) - b) < 0.3;

  const placeSystem = () => {
    const z = depthFor(rng());
    const k = 1 + z;
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = cam.baseX + (rng() - 0.5) * width * k;
      const y = height / 2 + (rng() - 0.5) * height * k;
      if (!world.systems.some((s) => samePlane(s.z, z) && Math.hypot(s.x - x, s.y - y) < layout.systemDist * k)) {
        const sys = newSystem(x, y);
        sys.z = z;
        world.systems.push(sys);
        return;
      }
    }
  };
  const placeStructure = () => {
    // Keep clear of other structures and of system cores; give up rather than overlap.
    const z = depthFor(rng());
    const k = 1 + z;
    for (let attempt = 0; attempt < 24; attempt++) {
      const x = cam.baseX + (rng() - 0.5) * (width - 80) * k;
      const y = height / 2 + (rng() - 0.5) * (height - 80) * k;
      if (world.structures.some((s) => samePlane(s.z, z) && Math.hypot(s.x - x, s.y - y) < layout.structDist * 0.6 * k)) continue;
      if (world.systems.some((s) => samePlane(s.z, z) && Math.hypot(s.x - x, s.y - y) < 70 * k)) continue;
      const s = newStructure(x, y);
      s.z = z;
      pushStructure(s);
      return;
    }
  };
  const placeAnomaly = (x: number, y: number) => {
    const a = generateSingleAnomaly(x, y, rng, pack, now, recentAnomalies, nextId());
    recentAnomalies.push(a.text);
    if (recentAnomalies.length > 6) recentAnomalies.shift();
    world.anomalies.push(a);
  };

  const seedCount = layout.maxSystems === 0 ? 0 : width < 768 ? 2 : 3;
  if (layout.maxSystems === 0) {
    // Empty space: the universe's mechanics fill it.
    world.systems = [];
    world.structures = [];
  }
  for (let i = 0; i < seedCount; i++) placeSystem();
  for (let i = 0; i < layout.maxStructs; i++) placeStructure();
  for (let i = 0; i < layout.maxAnomalies; i++) placeAnomaly(camera.x * P + rng() * width, 30 + rng() * (height - 60));

  // ---- fleets ---------------------------------------------------------------------------------
  /** The next named fleet not already on the map; about half of launches stay generic traffic. */
  const rosterNext = (): { cls?: ShipClass; faction?: number; callsign?: string } => {
    const roster = pack.fleets;
    if (!roster?.length || fleetRng() < 0.45) return {};
    for (let k = 0; k < roster.length; k++) {
      const r = roster[(rosterIndex + k) % roster.length];
      if (world.fleets.some((f) => f.callsign === r.name)) continue;
      rosterIndex = (rosterIndex + k + 1) % roster.length;
      return { cls: r.cls, faction: r.faction, callsign: r.name };
    }
    return {};
  };
  const launch = (at: { x: number; y: number; vx: number; vy: number }, opts: Parameters<typeof spawnFleet>[3] = {}) => {
    const c = ctx();
    // Named (data-driven) fleets fill launches that do not force a class.
    const f = spawnFleet(world, c, at, opts.cls ? opts : { ...rosterNext(), ...opts });
    world.fleets.push(f);
    goTo(f, chooseTarget(f, world, c), world, c);
    return f;
  };

  /** A fleet entering from an edge, already moving. */
  const enterFromEdge = () => {
    const v = view();
    const r = fleetRng();
    let x: number, y: number;
    if (r < 0.55) {
      x = v.right + 40;
      y = 40 + fleetRng() * (height - 80);
    } else if (r < 0.78) {
      x = v.left + fleetRng() * width;
      y = -40;
    } else {
      x = v.left + fleetRng() * width;
      y = height + 40;
    }
    const tx = v.left + width * (0.25 + fleetRng() * 0.5);
    const ty = height * (0.25 + fleetRng() * 0.5);
    const d = Math.hypot(tx - x, ty - y) || 1;
    const sp = 30;
    launch({ x, y, vx: ((tx - x) / d) * sp, vy: ((ty - y) / d) * sp });
  };

  // Seed the map mid-story: fleets already underway, run for a few seconds before frame 0.
  {
    const n = layout.maxFleets === 0 ? 0 : Math.max(2, Math.round(layout.maxFleets * 0.7));
    for (let i = 0; i < n; i++) {
      const x = camera.x * P + width * (0.1 + fleetRng() * 0.8);
      const y = height * (0.1 + fleetRng() * 0.8);
      const ang = fleetRng() * Math.PI * 2;
      launch({ x, y, vx: Math.cos(ang) * 25, vy: Math.sin(ang) * 25 });
    }
    silent = true;
    for (let k = 0; k < 120; k++) {
      now = -4 + k / 30;
      const c = ctx();
      for (const f of world.fleets) stepFleet(f, world, c, 1 / 30);
      world.fleets = world.fleets.filter((f) => f.mode !== 'gone');
    }
    silent = false;
    now = 0;
  }

  // ---- timers ---------------------------------------------------------------------------------
  const delay = (base: number, variance: number) => base + rng() * variance;
  let lastSystemSpawn = 0;
  let lastStructureSpawn = 0;
  let lastAnomalySpawn = 0;
  let systemSpawnDelay = delay(1, 0.6);
  let structureSpawnDelay = delay(0.7, 0.45);
  let anomalySpawnDelay = delay(2, 1.5);
  let nextEdgeFleet = delay(2, 3);
  let nextLock = delay(7, 6);

  const tensionAt = (t: number) => Math.max(0, Math.min(1, 0.5 + 0.6 * host.noise.fbm2(t / 110, 7.7, 3)));

  /** Inside the base frame (not the zoomed camera), so behavior never depends on the director. */
  const visibleOnScreen = (x: number, y: number, margin = 0, z = 0) => {
    const sx = baseSx(x, z);
    const sy = baseSy(y, z);
    return sx > margin && sx < width - margin && sy > margin && sy < height - margin;
  };

  // ---- structure behaviors ----------------------------------------------------------------------
  const runStructures = (rate: number) => {
    for (const s of allStructures(world)) {
      if (now < s.nextAction) continue;
      const z = s.z ?? 0;
      if (!visibleOnScreen(s.x, s.y, 30, z)) {
        s.nextAction = now + 2;
        continue;
      }
      if (world.managedRoles?.has(s.role)) {
        s.nextAction = now + 5;
        continue;
      }
      const busy = look.traffic <= 0 || world.fleets.filter((f) => !f.tag).length >= layout.maxFleets + 3;
      switch (s.role) {
        case 'shipyard': {
          if (!busy) {
            const ang = fleetRng() * Math.PI * 2;
            const f = launch({ x: s.x + Math.cos(ang) * 16, y: s.y + Math.sin(ang) * 16, vx: Math.cos(ang) * 12, vy: Math.sin(ang) * 12 }, { fadeIn: true, z });
            s.flashAt = now;
            onEvent({ kind: 'launch', fleet: f, target: s.label, targetId: s.id });
          }
          s.nextAction = now + delay(14, 14) / rate;
          break;
        }
        case 'mine': {
          const docks = allStructures(world).filter((d) => (d.role === 'dock' || d.role === 'shipyard') && Math.hypot(d.x - s.x, d.y - s.y) < 1100);
          if (!busy && docks.length) {
            const dest = docks[Math.floor(fleetRng() * docks.length)];
            const ang = Math.atan2(dest.y - s.y, dest.x - s.x);
            const c = ctx();
            const f = spawnFleet(world, c, { x: s.x + Math.cos(ang) * 18, y: s.y + Math.sin(ang) * 18, vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8 }, { cls: 'freighter', purpose: 'cargo', fadeIn: true, z });
            world.fleets.push(f);
            f.target = { kind: 'structure', id: s.id, x: s.x, y: s.y, z, label: s.label, role: 'mine' };
            goTo(f, { kind: 'structure', id: dest.id, x: dest.x, y: dest.y, z: dest.z ?? 0, label: dest.label, role: dest.role }, world, c);
            s.flashAt = now;
            onEvent({ kind: 'cargo', fleet: f, target: dest.label, targetId: dest.id });
          }
          s.nextAction = now + delay(16, 14) / rate;
          break;
        }
        case 'gate': {
          if (!busy) {
            const ang = fleetRng() * Math.PI * 2;
            const cls: ShipClass = (['cruiser', 'carrier', 'freighter', 'fighter', 'capital'] as const)[Math.floor(fleetRng() * 5)];
            const f = launch({ x: s.x + Math.cos(ang) * 20, y: s.y + Math.sin(ang) * 20, vx: Math.cos(ang) * 14, vy: Math.sin(ang) * 14 }, { cls, fadeIn: true, z });
            s.flashAt = now;
            onEvent({ kind: 'arrive', fleet: f, target: s.label, targetId: s.id });
          }
          s.nextAction = now + delay(22, 18) / rate;
          break;
        }
        default:
          s.nextAction = now + 30;
      }
    }
  };
  // ---- ambient chatter ----------------------------------------------------------------------------
  const chatter = (rate: number, frames: number) => {
    const p = world.settings.overlaySpawnRate * frames * rate;
    if (p <= 0 || chatterRng() >= p) return;
    const v = view();
    const onScreen = <T extends { x: number; y: number; z?: number }>(items: T[]) => items.filter((i) => visibleOnScreen(i.x, i.y, 40, i.z ?? 0));
    const structs = onScreen(allStructures(world));
    const fleets = onScreen(world.fleets.map((f) => ({ f, x: f.ships[0].x, y: f.ships[0].y, z: f.z })));
    const systems = onScreen(world.systems);
    const roll = chatterRng();
    const line = (lines: string[]) => (lines.length ? lines[Math.floor(chatterRng() * lines.length)] : '');
    const ox = (chatterRng() - 0.5) * 160;
    const oy = (chatterRng() - 0.5) * 120;
    if (roll < 0.4 && structs.length) {
      const s = structs[Math.floor(chatterRng() * structs.length)];
      const text = line(s.chatter.length && chatterRng() < 0.75 ? s.chatter : pack.chatter.structure);
      if (text) say({ text, x: s.x + ox * 0.6, y: s.y + 24 + Math.abs(oy) * 0.4, priority: 'low', color: s.color ?? palette.accent, duration: 4200 });
    } else if (roll < 0.62 && fleets.length) {
      const { f } = fleets[Math.floor(chatterRng() * fleets.length)];
      const text = line(pack.chatter.fleet);
      if (text) say({ text: `${f.callsign} · ${text}`, x: f.ships[0].x, y: f.ships[0].y, priority: 'low', color: f.ships[0].color, followId: f.id, duration: 3800 });
    } else if (roll < 0.8 && systems.length) {
      const s = systems[Math.floor(chatterRng() * systems.length)];
      const text = line(pack.chatter.science);
      if (text) say({ text, x: s.x + ox, y: s.y + oy, priority: 'low', color: palette.ink, duration: 4200 });
    } else {
      const text = line(chatterRng() < 0.5 ? pack.chatter.mystery : pack.chatter.system);
      if (text) say({ text, x: v.left + width * (0.1 + chatterRng() * 0.8), y: height * (0.1 + chatterRng() * 0.8), priority: 'low', color: palette.accent, duration: 4600 });
    }
  };

  // ---- target lock ------------------------------------------------------------------------------
  const pickLock = () => {
    const quiet = (x: number, y: number, z = 0) => host.quiet(cam.sx(x, z), cam.sy(y, z));
    // Locks stay on the main plane, where the action is.
    const fleets = world.fleets.filter((f) => f.mode !== 'docked' && f.fade > 0.8 && f.z < 0.2 && visibleOnScreen(f.ships[0].x, f.ships[0].y, 90) && quiet(f.ships[0].x, f.ships[0].y) < 0.3);
    const structs = allStructures(world).filter((s) => !s.z && visibleOnScreen(s.x, s.y, 90) && quiet(s.x, s.y) < 0.3);
    const pickFleet = fleets.length && (frameRng() < 0.65 || !structs.length);
    if (pickFleet) {
      const f = fleets[Math.floor(frameRng() * fleets.length)];
      const fac = pack.factions[f.faction]?.name ?? 'UNKNOWN';
      world.lock = {
        kind: 'fleet',
        id: f.id,
        start: now,
        duration: 5.5 + frameRng() * 2,
        lines: [`TRK ${f.callsign}`, `CLS ${classLabel(pack, f.cls)}${f.ships.length > 1 ? ` ×${f.ships.length}` : ''}`, `FAC ${fac}`],
      };
    } else if (structs.length) {
      const s = structs[Math.floor(frameRng() * structs.length)];
      const status = s.chatter.length ? s.chatter[Math.floor(frameRng() * s.chatter.length)] : 'NO RESPONSE';
      world.lock = {
        kind: 'structure',
        id: s.id,
        start: now,
        duration: 5.5 + frameRng() * 2,
        lines: [`OBJ ${s.label}`, `TYP ${s.role.toUpperCase()} · ${s.rarity.toUpperCase()}`, status],
      };
    }
  };

  // ---- mechanics ----------------------------------------------------------------------------------
  const fx = createFx(host.fork('fx'));
  const mechRng = host.fork('mechanics');

  const makeStructure = (s: Pick<Structure, 'x' | 'y' | 'label' | 'role' | 'art' | 'color'> & Partial<Structure>): Structure => ({
    id: `mech-${nextId()}`,
    kind: s.kind ?? s.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    rarity: 'uncommon',
    chatter: [],
    size: 8,
    spin: mechRng() * Math.PI * 2,
    nextAction: now + 9999,
    ...s,
  });

  /** Hurt a ship; at zero hull it explodes, and a big enough one leaves a wreck. */
  const damageShip = (f: Fleet, s: Ship, n: number) => {
    s.hp -= n;
    if (s.hp > 0) return;
    const i = f.ships.indexOf(s);
    if (i < 0) return;
    const size = { fighter: 0.7, scout: 0.7, freighter: 1.1, cruiser: 1.5, carrier: 1.7, capital: 2.3 }[s.cls];
    fx.explode(s.x, s.y, s.color, size);
    bus.emit({ type: 'explosion', x: s.x, y: s.y, z: f.z, size, weight: Math.min(1, 0.2 + size * 0.25), color: s.color });
    f.ships.splice(i, 1);
    if (!f.ships.length) {
      f.mode = 'gone';
      bus.emit({ type: 'lost', x: s.x, y: s.y, z: f.z, weight: 0.5, color: s.color });
      say({ text: `${f.callsign} LOST`, x: s.x, y: s.y, color: s.color, priority: 'high', duration: 4200, type: 'fleet' });
      if (size >= 1.1 && world.structures.filter((st) => st.role === 'wreck').length < 6) {
        world.structures.push(
          makeStructure({
            x: s.x,
            y: s.y,
            label: `WRECK · ${f.callsign}`,
            role: 'wreck',
            art: ASCII_ART.derelict_hulk,
            color: '#94a3b8',
            kind: 'derelict_hulk',
            chatter: ['STILL BURNING', 'NO LIFE SIGNS', 'BLACK BOX PINGING', 'SALVAGE CLAIMED'],
          }),
        );
      }
    } else if (i === 0) {
      // The next ship takes the lead and keeps the course.
      f.ships[0].slot = [0, 0];
      if (!f.steer && f.target) {
        const c = ctx();
        goTo(f, f.target, world, c);
      }
    }
  };

  const mechSpawn = (at: { x: number; y: number; vx: number; vy: number }, o: MechanicSpawn = {}) => {
    const c = ctx();
    const f = spawnFleet(world, c, at, o);
    f.tag = o.tag ?? 'event';
    f.hostile = o.hostile;
    if (o.steer) f.steer = o.steer;
    else goTo(f, chooseTarget(f, world, c), world, c);
    if (o.warpIn) {
      fx.warp(at.x, at.y, Math.atan2(at.vy, at.vx) || 0, f.ships[0].color, true);
      f.fade = 0;
      f.fadeTo = 1;
    }
    world.fleets.push(f);
    return f;
  };

  // Services attach lazily through `api.use`, with their own update and draw hooks.
  const services = new Map<string, unknown>();
  const serviceUpdates: ((dt: number) => void)[] = [];
  const serviceDraws: { pass: MechanicPass; fn: (c: CanvasRenderingContext2D, frame: RenderFrame, board?: LabelBoard) => void }[] = [];

  const api: MechanicApi = {
    world,
    host,
    rng: mechRng,
    pack,
    fx,
    camera: cam,
    bus,
    emit: (e: WorldEvent) => bus.emit(e),
    follow: followFleet,
    use<T>(key: string, create: () => T): T {
      if (!services.has(key)) services.set(key, create());
      return services.get(key) as T;
    },
    onUpdate: (fn) => serviceUpdates.push(fn),
    onDraw: (pass, fn) => serviceDraws.push({ pass, fn }),
    get t() {
      return now;
    },
    get tension() {
      return world.tension;
    },
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    view,
    screenX: (x) => x - camera.x * P,
    onScreen: (x, y, margin = 0) => visibleOnScreen(x, y, margin),
    quiet: (x, y) => host.quiet(cam.sx(x), cam.sy(y)),
    say: (text, x, y, color, o = {}) => {
      // An alert worth hearing is worth a look: high-priority lines double as camera interest.
      if (o.priority === 'high') {
        const f = o.followId ? world.fleets.find((fl) => fl.id === o.followId) : undefined;
        bus.emit({ type: 'alert', x, y, weight: 0.55, color, follow: f ? followFleet(f) : undefined });
      }
      say({ text, x, y, color, priority: o.priority ?? 'medium', followId: o.followId, duration: o.duration ?? 4000, type: 'fleet' });
    },
    spawnFleet: mechSpawn,
    release: (f) => {
      f.steer = null;
      f.fadeTo = 1;
      const c = ctx();
      goTo(f, chooseTarget(f, world, c), world, c);
    },
    goTo: (f, s) => {
      f.steer = null;
      f.fadeTo = 1;
      goTo(f, { kind: 'structure', id: s.id, x: s.x, y: s.y, z: s.z ?? 0, label: s.label, role: s.role }, world, ctx());
    },
    damage: damageShip,
    structures: () => allStructures(world),
    addStructure: (s) => {
      const st = makeStructure(s);
      world.structures.push(st);
      return st;
    },
    removeStructure: (id) => {
      world.structures = world.structures.filter((s) => s.id !== id);
    },
  };

  // The studio (or a caller) may override the pack's mechanics.
  const refs: MechanicRef[] = Array.isArray((host.options as { mechanics?: unknown } | undefined)?.mechanics)
    ? ((host.options as { mechanics: MechanicRef[] }).mechanics)
    : pack.mechanics ?? [];
  let mechs: MechanicInstance[] = [];
  /** A mechanic that throws is dropped, with one warning, instead of taking the scene down. */
  const drop = (m: MechanicInstance | string, err: unknown) => {
    const id = typeof m === 'string' ? m : mechIds.get(m);
    console.warn(`[void-tactical] mechanic "${id}" failed and was switched off:`, err);
    problems.push(`mechanic ${id} threw at t=${now.toFixed(2)}: ${err instanceof Error ? err.message : String(err)}`);
    if (typeof m !== 'string') mechs = mechs.filter((x) => x !== m);
  };
  const mechIds = new Map<MechanicInstance, string>();
  for (const ref of refs) {
    if (!ref || ref.enabled === false) continue;
    const m = getMechanic(ref.use);
    if (!m) continue;
    try {
      const inst = m.create(api, resolveOptions(m.schema, ref.with ?? {}) as Record<string, unknown>);
      mechIds.set(inst, m.id);
      mechs.push(inst);
    } catch (err) {
      drop(m.id, err);
    }
  }

  let lastQuality = host.quality;
  let lastFrame = -1;

  /** Mechanic label requests arrive in map space; the board works in screen space. */
  const mapBoard = (board: LabelBoard): LabelBoard => {
    const left = () => camera.x * P;
    return {
      add: (r) => board.add({ ...r, x: cam.sx(r.x + left()), y: cam.sy(r.y), offset: r.offset * cam.zoom }),
      reserve: (x, y, r) => board.reserve(cam.sx(x + left()), cam.sy(y), r * cam.zoom),
      flush: (c, v, dpr) => board.flush(c, v, dpr),
    };
  };

  return {
    world,
    camera,
    view: cam,
    bus,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    resize(viewport) {
      if (viewport.width === width && viewport.height === height && world.width === width) return;
      width = viewport.width;
      height = viewport.height;
      cam.resize(width, height);
      syncBase();
      updateLayout();
      world.width = width;
      world.height = height;
      const stars = generateSystem(width, height, { starCount: layout.starCount, rng: host.fork(`stars:${width}x${height}`), settings: simSettings, palette, universe: pack });
      world.stars = stars.stars;
      world.constellations = stars.constellations;
    },
    update(info) {
      if (info.frame === lastFrame) return;
      lastFrame = info.frame;
      const frames = info.dt * 60;
      now = info.t;

      if (Math.abs(host.quality - lastQuality) >= 0.1) {
        lastQuality = host.quality;
        updateLayout();
      }

      world.tension = tensionAt(now);
      // The sector's mood, for sound: busier stretches open the bed and brighten the drone.
      if (now >= nextAmbience && host.events?.active) {
        nextAmbience = now + 2;
        host.events.emit({ type: 'ambience', weight: world.tension, pan: 0, near: 1 });
      }
      const rate = 0.55 + 1.05 * world.tension;

      if (host.motion !== 'off') camera.x += config.cameraSpeed * host.intensity * frames * (look.drift ?? 1);
      // Scroll-linked travel: scrolling down carries the map forward (never back, since the
      // map only populates ahead).
      const scrollY = host.scroll?.y ?? 0;
      if (opts.scroll === true && scrollY > lastScrollY) camera.x += ((scrollY - lastScrollY) * 0.7) / P;
      lastScrollY = scrollY;
      camera.y = 0;
      const left = camera.x * P;
      // The base frame follows the drift; the director moves the camera inside it.
      syncBase();
      director.update(info.dt, now, {
        pointer: opts.lean === false ? undefined : host.pointer,
        gesture: host.takeGesture?.(),
      });

      // Cull whatever has scrolled off the left of the base frame (per depth).
      world.systems = world.systems.filter((s) => baseSx(s.x, s.z) > -300);
      world.structures = world.structures.filter((s) => baseSx(s.x, s.z) > -300);
      world.anomalies = world.anomalies.filter((a) => a.x - left > -200);

      // New scenery appears just past the right edge, on its own plane.
      if (world.systems.length < layout.maxSystems && now - lastSystemSpawn > systemSpawnDelay) {
        const z = depthFor(rng());
        const k = 1 + z;
        const x = cam.baseX + (width / 2 + 180 + rng() * 520) * k;
        let y = height / 2 + (rng() - 0.5) * height * k;
        for (let n = 0; n < 10 && world.systems.some((s) => samePlane(s.z, z) && Math.hypot(s.x - x, s.y - y) < layout.systemDist * k); n++) y = height / 2 + (rng() - 0.5) * height * k;
        const sys = newSystem(x, y);
        sys.z = z;
        world.systems.push(sys);
        lastSystemSpawn = now;
        systemSpawnDelay = delay(1, 0.6);
      }

      if (world.structures.length < layout.maxStructs && now - lastStructureSpawn > structureSpawnDelay) {
        const z = depthFor(rng());
        const k = 1 + z;
        for (let attempt = 0; attempt < 12; attempt++) {
          const x = cam.baseX + (width / 2 + 100 + rng() * 420) * k;
          const y = height / 2 + (rng() - 0.5) * height * k;
          if (world.structures.some((s) => samePlane(s.z, z) && Math.hypot(s.x - x, s.y - y) < layout.structDist * 0.6 * k)) continue;
          if (world.systems.some((s) => samePlane(s.z, z) && Math.hypot(s.x - x, s.y - y) < 70 * k)) continue;
          const s = newStructure(x, y);
          s.z = z;
          pushStructure(s);
          lastStructureSpawn = now;
          structureSpawnDelay = delay(0.7, 0.45);
          break;
        }
      }

      if (world.anomalies.length < layout.maxAnomalies && now - lastAnomalySpawn > anomalySpawnDelay) {
        for (let attempt = 0; attempt < 8; attempt++) {
          const x = left + width + 100 + rng() * 400;
          const y = 30 + rng() * (height - 60);
          if (world.anomalies.some((a) => Math.hypot(a.x - x, a.y - y) < 150)) continue;
          placeAnomaly(x, y);
          lastAnomalySpawn = now;
          anomalySpawnDelay = delay(2, 1.5);
          break;
        }
      }

      // Fleets enter from the edges between structure launches; busier when tension is high.
      if (now >= nextEdgeFleet) {
        if (world.fleets.filter((f) => !f.tag).length < layout.maxFleets) enterFromEdge();
        nextEdgeFleet = now + delay(2.5, 3.5) / rate;
      }
      runStructures(rate);

      if (host.motion !== 'off' && info.dt > 0) {
        const c = ctx();
        for (const f of world.fleets) stepFleet(f, world, c, info.dt);
        world.fleets = world.fleets.filter((f: Fleet) => f.mode !== 'gone');
        // Drop destroyed fleets after each mechanic, so the next one never sees an empty hull list.
        for (const m of mechs) {
          try {
            m.update?.(info.dt);
          } catch (err) {
            drop(m, err);
          }
          world.fleets = world.fleets.filter((f: Fleet) => f.mode !== 'gone' && f.ships.length > 0);
        }
        for (const fn of serviceUpdates) fn(info.dt);
        // Missiles land during the effects update, so it can destroy fleets too.
        fx.update(info.dt);
        world.fleets = world.fleets.filter((f: Fleet) => f.mode !== 'gone' && f.ships.length > 0);
      }

      // Overlays age by real elapsed time; fleet-bound lines follow their fleet.
      const elapsed = info.dt * 1000;
      world.overlays = world.overlays.filter((o) => (o.lifetime -= elapsed) > 0);
      for (const o of world.overlays) {
        if (!o.followId) continue;
        const f = world.fleets.find((fl) => fl.id === o.followId);
        if (f?.ships[0]) {
          o.x = f.ships[0].x;
          o.y = f.ships[0].y;
          o.z = f.z;
        } else {
          o.followId = undefined;
        }
      }
      chatter(rate, frames);

      // Target lock.
      if (world.lock && now > world.lock.start + world.lock.duration) world.lock = null;
      if (world.lock) {
        const l = world.lock;
        const alive = l.kind === 'fleet' ? world.fleets.some((f) => f.id === l.id) : allStructures(world).some((s) => s.id === l.id);
        if (!alive) world.lock = null;
      }
      if (!world.lock && now >= nextLock && world.settings.labelDensity !== 'none') {
        pickLock();
        nextLock = now + delay(18, 16) / rate;
      }
    },
    drawPass(c2d, pass, frame, board) {
      const left = camera.x * P;
      const b = board ? mapBoard(board) : undefined;
      c2d.save();
      // Map space (world x - left, world y) → the camera. With the director idle this is
      // the identity, so mechanics draw exactly as they did with a fixed camera. The hud
      // pass is screen space: tickers and readouts stay put while the camera moves.
      if (pass !== 'hud') {
        c2d.translate(width / 2, height / 2);
        c2d.scale(cam.zoom, cam.zoom);
        c2d.translate(-(cam.x - left), -cam.y);
      }
      for (const d of serviceDraws) {
        if (d.pass !== pass) continue;
        c2d.save();
        d.fn(c2d, frame, b);
        c2d.restore();
      }
      for (const m of mechs) {
        c2d.save();
        try {
          m.draw?.(c2d, pass, frame, b);
        } catch (err) {
          drop(m, err);
        }
        c2d.restore();
      }
      if (pass === 'over') fx.draw(c2d, left, 1);
      c2d.restore();
    },
    inspect() {
      // Invariants worth shouting about: non-finite positions and runaway populations.
      const issues = [...problems];
      for (const f of world.fleets) {
        for (const s of f.ships) if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) issues.push(`fleet ${f.callsign} has a non-finite position at t=${now.toFixed(2)}`);
        if (!f.ships.length) issues.push(`fleet ${f.callsign} has no ships at t=${now.toFixed(2)}`);
      }
      if (world.fleets.length > 120) issues.push(`runaway fleets: ${world.fleets.length}`);
      if (world.structures.length > 80) issues.push(`runaway structures: ${world.structures.length}`);
      const byTag: Record<string, number> = {};
      for (const f of world.fleets) byTag[`fleets.${f.tag ?? 'traffic'}`] = (byTag[`fleets.${f.tag ?? 'traffic'}`] ?? 0) + 1;
      return {
        t: now,
        counts: {
          fleets: world.fleets.length,
          ships: world.fleets.reduce((n, f) => n + f.ships.length, 0),
          structures: allStructures(world).length,
          far: allStructures(world).filter((s) => s.z).length + world.systems.filter((s) => s.z).length,
          systems: world.systems.length,
          anomalies: world.anomalies.length,
          overlays: world.overlays.length,
          fx: fx.busy,
          zoom: Math.round(cam.zoom * 100) / 100,
          ...byTag,
        },
        // Lines said on the map, plus every typed event as `[type]` (for seeking by type).
        log: bus.log.map((e) => ({ t: e.t ?? 0, text: e.text && e.type === 'say' ? e.text : `[${e.type}]${e.text ? ` ${e.text}` : ''}`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: bus.seq,
        problems: issues,
      };
    },
    frameFor(info, style) {
      return {
        time: info.t,
        dt: info.dt,
        rng: frameRng,
        palette,
        style,
        intensity: host.intensity,
        color: colorFor(style.hueVariety),
        pack,
        parallax: MAP_PARALLAX,
        dpr: host.viewport.dpr,
        view: cam,
        seed: host.config.seedHash,
      };
    },
  };
}

/**
 * One world per mounted background, shared by every void layer in the scene.
 * Keyed on the resolved config object, which every layer host inherits from the
 * scene host through its prototype chain.
 */
const shared = new WeakMap<object, VoidWorld>();

/** The shared world, or null while a lazily loaded universe is still on its way. */
export function sharedVoidWorld(host: SkinHost): VoidWorld | null {
  const key = host.config as object;
  let w = shared.get(key);
  if (!w) {
    const o = host.options as { universe?: unknown; pack?: unknown; mechanics?: unknown } | undefined;
    if (!isVoidReady(o)) {
      void prepareVoidTactical(o);
      return null;
    }
    w = createVoidWorld(host);
    shared.set(key, w);
  }
  return w;
}

export { SHIP_SPECS };
