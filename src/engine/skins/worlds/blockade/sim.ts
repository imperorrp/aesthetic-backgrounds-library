/**
 * # Blockade: a fleet holds a planet under blockade, and the planet does not give in.
 *
 * On screen, at a glance: a great planet filling the lower part of the frame (lit limb, the glow
 * of its air, cloud bands, city lights on the night side, a terminator that moves); a moon or two,
 * rings on some; the blockading fleet in orbit above it in depth (wedge cruisers, long
 * dreadnoughts, carriers with their launch bays lit, frigates on patrol, tenders); fighter wings
 * looping; shuttles running down to the surface and burning in; merchant ships held at the
 * picket line; a station growing in its frame.
 * The camera: high in orbit, looking down the line of ships toward the limb.
 *
 * Always happening (the floor):
 * - The line holds station: running lights, engines idling, the slow drift of the capitals.
 * - Frigates patrol their lanes and turn at the markers; fighter wings loop, launch and land.
 * - Shuttles go down (re-entry glow) and come up from the surface; merchants arrive, are scanned
 *   at the picket and sent down or turned back; tenders bring segments to the station, and it grows.
 * - The orbit turns: day, the sun setting behind the limb (the fleet goes dark), night with the
 *   cities lit, sunrise over the air. Debris falls, and burns up as meteors.
 *
 * The cast (each seed draws some):
 * - runners [threat, forced] a blockade runner dashes for the air (or up out of it); the pickets
 *   and fighters chase; it gets through, is shot to pieces (wreck and debris), or is taken in a tractor beam.
 * - battle [threat] a sortie from the night side: home frigates and fighters against the line;
 *   ships burn and break; the wrecks and debris stay and fall, slowly, into the air.
 * - jumps [arrival] reinforcements drop out of the lane (a streak, a flash); old ships are relieved.
 * - broadside [war] a capital ship fires everything at a defence platform rising from the planet.
 * - bombard [war] fire on the surface: flashes on the night side, and the fires after.
 * - flare [weather] the star flares: the light, the static, and after it aurora over the limb.
 * - eclipse [wonder] a moon's shadow crosses the planet's face.
 * - convoy [life] heavier merchant traffic; ships seized as prizes.
 * - groundfire [threat] the planet's great gun fires up, and a ship goes dark.
 * - flagship [legendary] the flagship itself, a ship the size of a city, passes down the line.
 * - salvage [life] tenders work the wrecks.
 * Quotas: 5–7 in all; 1–2 threats.
 *
 * Events: common: a shuttle down or up, a merchant cleared or turned back, a segment placed, a
 * patrol turning, a wing launched, a meteor; uncommon: a runner, a jump, a flare, a broadside;
 * rare: a battle, a capital ship lost, the great gun; legendary: the flagship.
 * What keeps it going: losses are replaced by jumps; wrecks fall and burn; the station grows by
 * stages; the orbit turns; runners keep coming.
 * What changes with the seed: the planet (ocean, desert, ice, gas giant, lava, city world), its
 * star, moons and rings; the fleet's faction and the shape of its hulls; the station; the cast.
 * A touch: on the planet, a shuttle goes down to that spot; in space, the nearest wing or
 * frigate goes to see what is there.
 * Phone: the same planet, closer; fewer ships in the line.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef, type SystemInstance } from '../../../kit';
import {
  CLS_WORD, ESCORT_NAMES, FLEET_NAMES, FLEETS, HOME_NAMES, HOMES, KLASS, LINES, MERCHANT_NAMES, MOON_NAMES, PLANET_KINDS, PLANET_NAMES,
  planetLook, RUNNER_NAMES, STARS, STATION_NAMES, STATS, SYSTEMS, WINGS, type FleetLook, type PlanetKind,
} from './design';
import type { BlockOptions, BlockWorld, Bolt, Cls, Ctx, Fx, FxKind, Planet, Ship, Side, V3 } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const norm = (v: V3): V3 => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const titled = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
/** "THE " before a name, unless it has one. */
const the = (n: string) => (n.startsWith('THE ') ? n : `THE ${n}`);
const theT = (n: string) => titled(the(n));

export function createBlockade(seed: string | number, W: number, H: number, opts: BlockOptions): BlockWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'blk');
  const shotR: Rng = forkRng(seed, 'blk-shots');
  const g: Genome = createGenome(seed, 'blk');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.46, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const phone = GW < GH;
  const traffic = clamp(opts.traffic, 0.3, 2.5);
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];
  let ids = 1;

  // ---- the planet, its star, its moons ------------------------------------------------------------
  const kind = g.weighted<PlanetKind>({ ocean: 5, desert: 3, ice: 3, gas: 3, lava: 2, city: 3 });
  void PLANET_KINDS;
  const pLook = planetLook(g.fork('planet'), kind);
  const star = g.weighted({ 0: 4, 1: 2, 2: 3, 3: 2, 4: 1 } as Record<'0' | '1' | '2' | '3' | '4', number>);
  const fleetLook: FleetLook = g.pick(FLEETS);
  const pname = g.pick(PLANET_NAMES);
  const homeBase = g.pick(HOMES);
  const homeLook: FleetLook = { ...homeBase, name: `THE ${pname} HOME FLEET`, short: `${pname}` };
  const R = phone ? GW * g.range(0.95, 1.25) : GW * g.range(0.82, 1.2);
  const limb = GH * (phone ? g.range(0.57, 0.64) : g.range(0.55, 0.63));
  const cx = GW * (0.5 + g.range(-0.1, 0.1));
  const cy = limb + R;
  const tiltA = g.range(0.1, 0.38);
  const tiltB = g.range(0, Math.PI * 2);
  const A = norm([Math.sin(tiltA) * Math.cos(tiltB), Math.sin(tiltA) * Math.sin(tiltB), Math.cos(tiltA)]);
  const t0v: V3 = Math.abs(A[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const B1 = norm([t0v[0] - dot(t0v, A) * A[0], t0v[1] - dot(t0v, A) * A[1], t0v[2] - dot(t0v, A) * A[2]]);
  const B2 = cross(A, B1);
  const spin = g.chance(0.5) ? 1 : -1;
  const planet: Planet = {
    cx, cy, R, atmo: kind === 'gas' ? g.range(0.018, 0.026) : g.range(0.012, 0.02), A, B1, B2,
    omega: spin * g.range(0.0011, 0.002), cloudOmega: spin * g.range(0.0014, 0.0028),
  };
  const limbY = (x: number) => {
    const dx = x - cx;
    return Math.abs(dx) >= R ? Infinity : cy - Math.sqrt(R * R - dx * dx);
  };
  const laneY = (x: number, y0: number) => {
    const Rl = cy - y0;
    const dx = Math.min(Math.abs(x - cx), Rl * 0.98);
    return cy - Math.sqrt(Rl * Rl - dx * dx);
  };
  const surf = (lat: number, lon: number): V3 => {
    const a = lon + planet.omega * world.t;
    const cl = Math.cos(lat);
    const ca = Math.cos(a) * cl;
    const sa = Math.sin(a) * cl;
    const sl = Math.sin(lat);
    const v: V3 = [ca * B1[0] + sa * B2[0] + sl * A[0], ca * B1[1] + sa * B2[1] + sl * A[1], ca * B1[2] + sa * B2[2] + sl * A[2]];
    return [cx + R * v[0], cy + R * v[1], v[2]];
  };
  const latLon = (x: number, y: number): [number, number] | null => {
    const nx = (x - cx) / R;
    const ny = (y - cy) / R;
    const rr = nx * nx + ny * ny;
    if (rr >= 1) return null;
    const n: V3 = [nx, ny, Math.sqrt(1 - rr)];
    return [Math.asin(clamp(dot(n, A), -1, 1)), Math.atan2(dot(n, B2), dot(n, B1)) - planet.omega * world.t];
  };
  // The orbit: the star goes round. Its path crosses behind the planet (the orbital night) where it
  // passes the limb; the tilt is drawn so that line falls just under the limb at the frame's edges.
  const F = (phone ? GH * 0.55 : GW * 0.9);
  const eyeY = limb - GH * 0.12;
  const edgeDrop = limbY(phone ? 0 : GW * 0.02) - limb;
  const iota = Math.atan((GH * 0.12 + clamp(edgeDrop * g.range(0.25, 0.75), 30 * u, GH * 0.3)) / F);
  const orbitT = g.range(1500, 2300);
  // Start where the light is good: from the side, or with the star low in the sky; never in the deep of the night.
  const theta0 = g.pick([g.range(-0.5, 0.5), g.range(Math.PI - 0.5, Math.PI + 0.5), g.range(Math.PI + 0.55, Math.PI + 0.95), g.range(2 * Math.PI - 0.95, 2 * Math.PI - 0.55), g.range(0.6, 1.2)]);

  const nMoons = kind === 'gas' ? g.int(1, 2) : g.int(phone ? 0 : 1, 2);
  const moonNames = g.shuffle(MOON_NAMES);
  const moons = Array.from({ length: Math.max(kind === 'gas' ? 1 : 0, nMoons) }, (_, i) => ({
    name: moonNames[i],
    x: GW * (i === 0 ? g.range(0.55, 0.9) : g.range(0.1, 0.45)) * (g.chance(0.5) ? 1 : 1),
    y: limb * g.range(0.2, 0.62),
    r: (kind === 'gas' && i === 0 ? g.range(34, 62) : g.range(9, 24)) * u * (phone ? 1.3 : 1),
    seed: Math.floor(g.unit() * 1e6),
    tint: g.pick(['#b8b0a8', '#c8c0b0', '#a8b0b8', '#c0a890', '#d8d0c8', '#9a8e84']),
    vx: g.range(-0.25, 0.25) * u,
  }));
  const ringsOn = g.chance(kind === 'gas' ? 0.65 : kind === 'ice' ? 0.35 : 0.14);
  const rb = R + GH * g.range(0.1, 0.3);
  const rings = ringsOn ? { b: rb, a: rb * g.range(1.15, 1.5), tilt: (g.chance(0.5) ? 1 : -1) * g.range(0.12, 0.3), inner: g.range(0.7, 0.84), outer: 1, tint: g.pick(['#d8c8a8', '#c8c0b8', '#b8a890', '#e0d8cc', '#a8b8c8']) } : null;

  // eslint-disable-next-line prefer-const
  let world: BlockWorld;
  const sideOfStation = g.chance(0.5) ? 1 : -1;
  const stationKind = g.chance(phone ? 0.75 : 0.55) ? 'wheel' : 'ring';
  world = {
    t: 0, W, H, GW, GH, u, phone, bus,
    director: createDirector(forkRng(seed, 'blk-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    name: pname, system: g.pick(SYSTEMS),
    planetLook: pLook, star: STARS[Number(star)], fleet: fleetLook, home: homeLook,
    cast: [], castIds: [],
    planet, limb, orbitT, theta0, iota,
    L: [0, 0, 1], sun: { x: 0, y: 0, r: 14 * u, vis: 1, up: false }, light: 1, hour: 0,
    moons, rings,
    ships: [], bolts: [], fx: [], debris: [], meteors: [], wrecks: [], scars: [],
    station: {
      kind: stationKind, name: g.pick(STATION_NAMES),
      x: stationKind === 'wheel' ? GW * (0.5 + sideOfStation * g.range(0.24, 0.34)) : cx,
      y: stationKind === 'wheel' ? limb * g.range(0.34, 0.52) : limb - GH * g.range(0.035, 0.07),
      z: stationKind === 'wheel' ? g.range(0.32, 0.5) : 0.9,
      seed: Math.floor(g.unit() * 1e6), plan: stationKind === 'wheel' ? 12 : 14, built: 0, work: 0, stage: 0, lit: 0, t0: 0,
    },
    flare: 0, aurora: 0, static: 0, eclipse: null, groundGun: null,
    alarm: 0, alarmWhy: '',
    tally: { through: 0, caught: 0, killed: 0, lost: 0, kills: 0, landed: 0, inspected: 0, seized: 0, jumps: 0 },
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    labels: [], chronicle: [], radio: [],
    war: { stores: g.range(0.35, 0.75), anger: g.range(0.05, 0.3), resolve: g.range(0.55, 0.85), day: g.int(9, 240), stage: 'calm', stageT: 0 },
    backdrop: g.weighted({ band: 4, nebula: 3, core: 2, sparse: 2 }),
    skyTint: g.pick([['#6a7aa8', '#c89a7a'], ['#7a5aa8', '#4a8ab0'], ['#a86a5a', '#d8b080'], ['#4a7a9a', '#7ac0b0'], ['#8a6ab8', '#d88aa8'], ['#5a6a8a', '#9aa8c0']] as [string, string][]),
    mOf: (z: number) => 1 / (1 + 5.5 * Math.max(-0.1, z)),
    limbY, laneY, surf, latLon,
    step, nudge,
    counts: () => {
      const live = world.ships.filter(alive);
      return {
        ships: live.length,
        capitals: live.filter((s) => s.side === 'fleet' && isCapital(s.cls)).length,
        escorts: live.filter((s) => s.side === 'fleet' && s.cls === 'frigate').length,
        fighters: live.filter((s) => s.cls === 'fighter').length,
        shuttles: live.filter((s) => s.cls === 'shuttle').length,
        merchants: live.filter((s) => s.side === 'merchant').length,
        home: live.filter((s) => s.side === 'home').length,
        wrecks: world.wrecks.length,
        debris: world.debris.length,
        built: world.station.built,
        bolts: world.bolts.length,
        fx: world.fx.length,
        landed: world.tally.landed,
      };
    },
  };
  // Built partway already: a station the fleet has been working on.
  world.station.built = Math.floor(world.station.plan * g.range(0.3, 0.6));
  const mOf = world.mOf;

  // ---- the verbs -------------------------------------------------------------------------------------
  function establish(): { x: number; y: number; zoom: number } {
    const big = world?.ships?.filter((s) => s.side === 'fleet' && isCapital(s.cls) && s.state === 'station' && s.z < 0.5);
    if (big?.length && shotR() < 0.45) {
      const s = big[Math.floor(shotR() * big.length)];
      return { x: s.x, y: s.y, zoom: 1.6 };
    }
    return { x: GW / 2, y: GH / 2, zoom: 1 };
  }
  const say = (text: string, x: number, y: number, color = '#e8eef8', pri = 2) => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    world.labels.push({ text, x, y, t0: world.t, color, pri });
    if (world.labels.length > 8) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, priority: pri >= 2 ? 'high' : 'medium' });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };
  const speak = (who: Ship, line: string, pri = 1) => {
    who.line = line;
    who.lineT = world.t;
    world.radio.push({ t: world.t, id: who.id, name: who.name, side: who.side, cls: who.cls, text: line, pri: world.alarm && pri < 2 ? pri + 0.5 : pri });
    if (world.radio.length > 16) world.radio.shift();
    bus.emit({ type: 'radio', text: line, weight: 0.05, priority: 'low' });
  };
  const look = (why: string, x: number, y: number, zoom: number, hold: number, priority: number) => world.director.look(why, x, y, zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: FxKind, x: number, y: number, z: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 700) return;
    world.fx.push({ kind, x, y, z, vx: 0, vy: 0, t0: world.t, dur: 1, r: 10 * u, color: '#ffd8a0', seed: Math.floor(r() * 1e6), x2: x, y2: y, rot: 0, ...extra });
  };
  const used = new Set<string>();
  const nameFrom = (list: readonly string[]) => {
    const free = list.filter((n) => !used.has(n));
    const n = free.length ? pick(free) : `${pick(list)} ${['II', 'III', 'IV', 'V'][Math.floor(r() * 4)]}`;
    used.add(n);
    return n;
  };
  const wingNo = { n: 0 };
  function nameFor(cls: Cls, side: Side): string {
    if (side === 'merchant') return nameFrom(MERCHANT_NAMES);
    if (side === 'runner') return nameFrom(RUNNER_NAMES);
    if (side === 'home') return cls === 'fighter' ? 'HOME FIGHTER' : cls === 'platform' ? `${pname} GUN ${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'][Math.floor(r() * 5)]}` : nameFrom(HOME_NAMES);
    if (cls === 'shuttle') return `SHUTTLE ${Math.floor(10 + r() * 89)}`;
    if (cls === 'fighter') return 'FIGHTER';
    if (cls === 'frigate' || cls === 'tender' || cls === 'corvette') return nameFrom(ESCORT_NAMES);
    if (cls === 'flagship') return pick(['THE EMPRESS OF HOURS', 'THE SUN IN IRON', 'THE CROWN ETERNAL', 'THE LAST WORD OF GOD', 'THE HIGH THRONE']);
    return nameFrom(FLEET_NAMES);
  }
  function spawn(cls: Cls, side: Side, x: number, y: number, z: number, extra: Partial<Ship> = {}): Ship {
    const st = STATS[cls];
    const s: Ship = {
      id: ids++, name: '', cls, side, seed: Math.floor(r() * 1e6), x, y, z, vx: 0, vy: 0, dir: 1, turn: 0, state: 'station', t0: world.t,
      hp: st.hp, maxHp: st.hp, tx: x, ty: y, tz: z, speed: st.speed * (0.9 + r() * 0.2), hx: x, hy: y, phase: r() * 6.28,
      thrust: 0.3, shieldT: -99, dmg: 0, target: -1, gunT: world.t + r() * 2, home: -1, slot: 0, line: '', lineT: -99,
      lat: 0, lon: 0, sx: x, sy: y, sz: z, dur: 0, klass: '', job: '', tag: '', dark: false, ...extra,
    };
    if (!s.name) s.name = nameFor(cls, side);
    if (!s.klass) s.klass = KLASS[cls] ? `${pick(KLASS[cls]!)}-CLASS ${CLS_WORD[cls]}` : CLS_WORD[cls];
    if (cls === 'freighter') s.klass = pick(KLASS.freighter!);
    if (cls === 'platform') s.klass = pick(KLASS.platform!);
    world.ships.push(s);
    return s;
  }
  const alive = (s: Ship) => s.state !== 'dead' && s.state !== 'dying' && s.hp > 0;
  const isCapital = (c: Cls) => c === 'dreadnought' || c === 'cruiser' || c === 'carrier' || c === 'flagship';
  const lenOf = (s: Ship) => STATS[s.cls].len * u * mOf(s.z);
  const byId = (id: number) => world.ships.find((q) => q.id === id);
  const entryX = (dir: 1 | -1, off: number) => (dir > 0 ? -off : GW + off);
  /** The lane (its height at the centre) that passes through (x, y). */
  const laneThrough = (x: number, y: number) => cy - Math.hypot(cy - y, x - cx);
  /** The sky band where ships of depth z sit: far ones near the limb, near ones anywhere above it. */
  const skyY = (z: number, R0: Rng = r) => {
    const top = GH * (phone ? 0.12 : 0.13);
    const bot = limb - GH * (0.02 + 0.05 * (1 - z));
    const far = clamp((z - 0.5) / 0.5, 0, 1);
    return top + (bot - top) * (far * 0.55 + (1 - far * 0.55) * R0());
  };

  function fire(from: Ship, to: Ship | null, kind: Bolt['kind'], extra: Partial<Bolt> = {}): Bolt | null {
    if (world.bolts.length > 260) return null;
    const m = mOf(from.z);
    const L0 = lenOf(from);
    const off = (r() - 0.5) * L0 * (isCapital(from.cls) ? 0.7 : 0.3);
    const x0 = from.x + off;
    const y0 = from.y - (isCapital(from.cls) ? 0.08 * L0 * r() : 0);
    let x1 = extra.x1 ?? from.x;
    let y1 = extra.y1 ?? from.y;
    let z1 = extra.z1 ?? from.z;
    let hit = false;
    if (to) {
      const tl = lenOf(to);
      const acc = to.cls === 'fighter' ? 0.2 : to.cls === 'corvette' || to.cls === 'shuttle' ? 0.32 : to.cls === 'frigate' || to.cls === 'freighter' || to.cls === 'tender' ? 0.55 : 0.85;
      hit = extra.hit ?? r() < acc * (kind === 'missile' ? 1.4 : 1);
      const spread = hit ? tl * 0.3 : tl * (0.8 + r() * 1.2);
      x1 = to.x + to.vx * 0.4 + (r() - 0.5) * spread;
      y1 = to.y + to.vy * 0.4 + (r() - 0.5) * spread * 0.4;
      z1 = to.z;
    }
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const speed = (kind === 'heavy' ? 700 : kind === 'missile' ? 260 : kind === 'beam' || kind === 'ion' ? 1e9 : 1100) * u * (0.6 + 0.4 * m);
    const b: Bolt = {
      kind, x0, y0, z0: from.z, x1, y1, z1, t0: world.t, dur: Math.max(kind === 'beam' || kind === 'ion' ? 0.5 : 0.08, dist / speed),
      color: from.side === 'fleet' ? world.fleet.bolt : world.home.bolt, from: from.id, to: to ? to.id : -1,
      dmg: kind === 'heavy' ? 4 : kind === 'missile' ? 5 : kind === 'beam' ? 8 : kind === 'ion' ? 20 : 1, hit, done: false, lat: NaN, lon: NaN, ...extra,
    };
    b.hit = extra.hit ?? hit;
    world.bolts.push(b);
    if (kind === 'heavy' || kind === 'beam') fx('muzzle', x0, y0, from.z, { dur: 0.25, r: (kind === 'beam' ? 26 : 14) * u * m * 2, color: b.color });
    return b;
  }
  function boom(s: Ship, big: boolean) {
    const m = mOf(s.z);
    const L0 = lenOf(s);
    fx('flash', s.x, s.y, s.z, { dur: big ? 1.6 : 0.7, r: (big ? 0.9 : 0.6) * L0 + 30 * u * m, color: '#fff0d0' });
    fx('ring', s.x, s.y, s.z, { dur: big ? 2.6 : 1.2, r: (big ? 1.4 : 0.9) * L0 + 40 * u * m, color: '#ffd8a0' });
    const n = big ? 26 : Math.max(4, Math.round(L0 / (8 * u)));
    for (let k = 0; k < Math.min(30, n); k++) {
      const a = r() * Math.PI * 2;
      const v = (40 + r() * 160) * u * m * (big ? 1.4 : 1);
      fx(k % 3 === 0 ? 'fire' : k % 3 === 1 ? 'spark' : 'shard', s.x + (r() - 0.5) * L0 * 0.6, s.y + (r() - 0.5) * L0 * 0.12, s.z, { vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, dur: 0.8 + r() * (big ? 2.4 : 1.2), r: (6 + r() * 14) * u * m * (big ? 2.2 : 1), color: k % 2 ? '#ffb050' : '#ff7a30', rot: r() * 6 });
    }
    for (let k = 0; k < (big ? 4 : 1); k++) fx('smoke', s.x + (r() - 0.5) * L0 * 0.5, s.y, s.z, { vx: (r() - 0.5) * 20 * u * m, vy: (r() - 0.5) * 10 * u * m, dur: 6 + r() * 6, r: (30 + r() * 50) * u * m * (big ? 2 : 1), color: '#2a2422' });
    // The pieces that stay: debris in orbit, and for anything big, the wreck itself.
    const nd = big ? 34 : s.cls === 'fighter' || s.cls === 'shuttle' ? 3 : 10;
    for (let k = 0; k < nd && world.debris.length < 320; k++) {
      const a = r() * Math.PI * 2;
      const v = (6 + r() * 30) * u * m;
      world.debris.push({ x: s.x + (r() - 0.5) * L0 * 0.7, y: s.y + (r() - 0.5) * L0 * 0.1, z: s.z + (r() - 0.5) * 0.04, vx: Math.cos(a) * v + s.vx * 0.3, vy: Math.sin(a) * v * 0.5, rot: r() * 6, vr: (r() - 0.5) * 2, size: (1.5 + r() * (big ? 9 : 4)) * u * m * 2, seed: Math.floor(r() * 1e6), t0: world.t, hot: 1 });
    }
    if (s.cls !== 'fighter' && s.cls !== 'shuttle' && world.wrecks.length < 7) {
      world.wrecks.push({ id: ids++, name: s.name, cls: s.cls, side: s.side, seed: s.seed, len: STATS[s.cls].len, dir: s.dir, x: s.x, y: s.y, z: s.z, vx: s.vx * 0.3 + (r() - 0.5) * 3 * u, vy: (r() - 0.3) * 2 * u, t0: world.t, cut: 0.3 + r() * 0.4, spin: (r() - 0.5) * 0.03, part: (2 + r() * 4) * u * m, fire: 1, fall: 0 });
    }
    emit(big ? 'capitallost' : 'explosion', s.x, s.y, big ? 1 : s.cls === 'fighter' ? 0.25 : 0.5);
    s.state = 'dead';
    s.hp = 0;
  }
  const ctx: Ctx = { world, r, say, emit, chronicle, speak: (w, l, p = 2) => speak(w, l, p), ship: spawn, fire, boom, fx, look, after, pick: (a) => pick(a) };

  // ---- the line: capital ships on station, frigates on their lanes, wings, tenders --------------------
  const fleetDir: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const capitalCls = (R0: Rng): Cls => {
    const k = R0();
    return k < 0.42 ? 'cruiser' : k < 0.72 ? 'dreadnought' : 'carrier';
  };
  function placeCapitals() {
    const n = phone ? 3 : 4 + Math.floor(r() * 3);
    const zs: number[] = [];
    zs.push(phone ? 0.2 + r() * 0.08 : 0.07 + r() * 0.08);
    for (let i = 1; i < n; i++) zs.push(0.28 + ((i - 1) / Math.max(1, n - 2)) * 0.62 + (r() - 0.5) * 0.08);
    const slots = g.fork('slots').shuffle(Array.from({ length: n }, (_, i) => (i + 0.5) / n));
    let carriers = 0;
    zs.forEach((z, i) => {
      let cls = i === 0 ? (r() < 0.6 ? 'cruiser' : 'dreadnought') : capitalCls(r);
      if (i === n - 1 && carriers === 0 && !phone) cls = 'carrier';
      if (cls === 'carrier') carriers++;
      const x = GW * (0.06 + 0.88 * slots[i]) + (r() - 0.5) * GW * 0.06;
      const heroLow = i === 0 && r() < 0.5;
      const y = i === 0 ? (heroLow ? limb + GH * (phone ? 0.06 : 0.04 + r() * 0.06) : GH * (phone ? 0.3 : 0.24 + r() * 0.08)) : skyY(z);
      const s = spawn(cls as Cls, 'fleet', x, y, z, { dir: r() < 0.82 ? fleetDir : (-fleetDir as 1 | -1), state: 'station', job: 'ON STATION' });
      s.hx = x;
      s.hy = y;
    });
  }
  function placeEscorts() {
    const n = phone ? 2 : 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const z = 0.18 + r() * 0.62;
      const y0 = skyY(z);
      const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
      const x = GW * (0.1 + r() * 0.8);
      const s = spawn('frigate', 'fleet', x, laneY(x, y0), z, { dir, state: 'patrol', hy: y0, tx: dir > 0 ? GW * (0.85 + r() * 0.3) : GW * (0.15 - r() * 0.3), job: 'ON PATROL' });
      s.sx = GW * (0.15 - r() * 0.3);
      s.sy = GW * (0.85 + r() * 0.3);
    }
  }
  // The picket: a frigate holding at the checkpoint where merchants are scanned.
  let picket: Ship | null = null;
  function placePicket() {
    const side = -sideOfStation;
    const z = 0.3 + r() * 0.2;
    const x = GW * (0.5 + side * (0.12 + r() * 0.14));
    const y = skyY(z);
    picket = spawn('frigate', 'fleet', x, y, z, { dir: (side > 0 ? -1 : 1) as 1 | -1, state: 'station', job: 'PICKET · CHECKPOINT' });
    picket.hx = x;
    picket.hy = y;
  }
  const wings: { id: number; name: string; cx: number; cy: number; z: number; rx: number; ry: number; a: number; speed: number; carrier: number; out: boolean; side: Side; until: number; tx: number; ty: number }[] = [];
  function launchWing(carrier: Ship, n: number, side: Side = 'fleet', where?: { x: number; y: number; z: number }) {
    const name = `${WINGS[wingNo.n++ % WINGS.length]} FLIGHT`;
    const z = where ? where.z : clamp(carrier.z - 0.05 + (r() - 0.5) * 0.2, 0.05, 0.85);
    const w = { id: ids++, name, cx: where ? where.x : clamp(carrier.x + (r() - 0.5) * GW * 0.4, GW * 0.1, GW * 0.9), cy: where ? where.y : clamp(carrier.y + (r() - 0.6) * GH * 0.2, GH * 0.12, limb), z, rx: (160 + r() * 200) * u, ry: (50 + r() * 70) * u, a: r() * 6, speed: (0.35 + r() * 0.25) * (r() < 0.5 ? 1 : -1), carrier: carrier.id, out: true, side, until: world.t + 70 + r() * 80, tx: 0, ty: 0 };
    wings.push(w);
    for (let k = 0; k < n; k++) {
      const f = spawn('fighter', side, carrier.x + (r() - 0.5) * lenOf(carrier) * 0.2, carrier.y + lenOf(carrier) * 0.05, carrier.z, { state: 'launch', home: w.id, slot: k, name: `${name.split(' ')[0]} ${k + 1}`, dir: carrier.dir, job: name, t0: world.t + k * 0.5 });
      f.vx = carrier.dir * 30 * u * mOf(f.z);
    }
    return w;
  }
  function placeWings() {
    const carriers = world.ships.filter((s) => s.side === 'fleet' && isCapital(s.cls));
    const n = phone ? 1 : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n && carriers.length; i++) {
      const c = carriers.find((q) => q.cls === 'carrier') && i === 0 ? carriers.find((q) => q.cls === 'carrier')! : pick(carriers);
      const w = launchWing(c, 3 + Math.floor(r() * 2));
      // Already out at the start.
      for (const f of world.ships.filter((q) => q.home === w.id)) {
        f.state = 'wing';
        f.x = w.cx + (r() - 0.5) * w.rx;
        f.y = w.cy + (r() - 0.5) * w.ry;
        f.z = w.z;
      }
    }
  }
  function placeTenders() {
    const n = phone ? 1 : 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const z = 0.35 + r() * 0.3;
      spawn('tender', 'fleet', GW * (0.2 + r() * 0.6), skyY(z), z, { state: 'transit', job: 'TENDER · TO THE STATION', tag: 'idle' });
    }
  }
  function placePlatforms() {
    const n = r() < 0.6 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const x = GW * (0.15 + r() * 0.7);
      const y = limbY(x) - GH * (0.015 + r() * 0.03);
      spawn('platform', 'home', x, y, 0.9 + r() * 0.06, { state: 'station', job: 'ORBITAL GUN', dir: r() < 0.5 ? 1 : -1 });
    }
  }
  placeCapitals();
  placeEscorts();
  placePicket();
  placeWings();
  placeTenders();
  placePlatforms();

  // ---- the cast library ---------------------------------------------------------------------------------
  const LIBRARY: SystemDef<Ctx>[] = [
    { id: 'runners', label: 'runners', weight: 10, tags: ['threat'], create: (c) => runnerSystem(c) },
    { id: 'battle', label: 'sorties', weight: 6, tags: ['threat'], create: (c) => battleSystem(c) },
    { id: 'jumps', label: 'jumps', weight: 7, tags: ['arrival'], create: (c) => jumpSystem(c) },
    { id: 'broadside', label: 'broadsides', weight: 5, tags: ['war'], create: (c) => broadsideSystem(c) },
    { id: 'bombard', label: 'bombardment', weight: 4, tags: ['war'], create: (c) => bombardSystem(c) },
    { id: 'flare', label: 'flares', weight: 5, tags: ['weather'], create: (c) => flareSystem(c) },
    { id: 'eclipse', label: 'eclipses', weight: moons.length ? 4 : 0, tags: ['wonder'], create: (c) => eclipseSystem(c) },
    { id: 'convoy', label: 'convoys', weight: 5, tags: ['life'], create: (c) => convoySystem(c) },
    { id: 'groundfire', label: 'the great gun', weight: 3, tags: ['threat'], create: (c) => groundSystem(c) },
    { id: 'flagship', label: 'the flagship', weight: 2, tags: ['legendary'], create: (c) => flagshipSystem(c) },
    { id: 'salvage', label: 'salvage', weight: 4, tags: ['life'], create: (c) => salvageSystem(c) },
    { id: 'defection', label: 'defections', weight: 3, tags: ['rare'], create: (c) => defectSystem(c) },
  ];
  const RULE = { total: [5, 7] as [number, number], quota: { threat: [1, 2] as [number, number], legendary: [0, 1] as [number, number], rare: [0, 1] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE, ['runners']);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);
  const has = (id: string) => world.castIds.includes(id);

  // ---- motion ----------------------------------------------------------------------------------------------
  /** Steer toward a point (and a depth), at a speed given at scale 1; returns the distance left. */
  function steer(s: Ship, tx: number, ty: number, tz: number, speed: number, dt: number, grip = 1.4) {
    const m = mOf(s.z);
    const dx = tx - s.x;
    const dy = ty - s.y;
    const dist = Math.hypot(dx, dy);
    const v = Math.min(speed * u * m, dist * 0.8);
    const dvx = dist > 1e-3 ? (dx / dist) * v : 0;
    const dvy = dist > 1e-3 ? (dy / dist) * v : 0;
    const k = Math.min(1, dt * grip);
    s.vx += (dvx - s.vx) * k;
    s.vy += (dvy - s.vy) * k;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += (tz - s.z) * Math.min(1, dt * 0.4);
    return dist;
  }
  function face(s: Ship, dt: number) {
    const small = !isCapital(s.cls) && s.cls !== 'platform';
    if (s.turn > 0) {
      const dur = s.cls === 'fighter' ? 0.5 : s.cls === 'shuttle' || s.cls === 'corvette' ? 1 : isCapital(s.cls) ? 7 : 2.2;
      const before = s.turn;
      s.turn += dt / dur;
      if (before < 0.5 && s.turn >= 0.5) s.dir = (s.dir > 0 ? -1 : 1) as 1 | -1;
      if (s.turn >= 1) s.turn = 0;
      return;
    }
    if (!small && s.state !== 'leave') return;
    const want = s.vx > 6 * u * mOf(s.z) ? 1 : s.vx < -6 * u * mOf(s.z) ? -1 : s.dir;
    if (want !== s.dir) s.turn = 0.001;
  }
  function move(dt: number) {
    for (const s of world.ships) {
      const age = world.t - s.t0;
      const m = mOf(s.z);
      if (s.state === 'station') {
        const tx = s.hx + Math.sin(world.t * 0.021 + s.phase) * 14 * u * m;
        const ty = s.hy + Math.sin(world.t * 0.033 + s.phase * 1.3) * 6 * u * m;
        steer(s, tx, ty, s.tz, s.speed * 0.25, dt, 0.5);
        s.thrust += (0.25 - s.thrust) * dt;
      } else if (s.state === 'patrol') {
        const reach = Math.abs(s.x - s.tx) < 12 * u;
        if (reach) {
          s.tx = s.tx > GW / 2 ? s.sx : s.sy;
          if (r() < 0.25) speak(s, pick(LINES.patrol));
          if (r() < 0.3) emit('patrol', s.x, s.y, 0.08);
        }
        const nx = s.x + Math.sign(s.tx - s.x) * 30 * u;
        steer(s, nx, laneY(nx, s.hy), s.tz, s.speed * 0.7, dt, 0.6);
        s.thrust += (0.6 - s.thrust) * dt;
      } else if (s.state === 'transit' || s.state === 'leave' || s.state === 'chase' || s.state === 'attack') {
        if (s.state === 'chase' || s.state === 'attack') {
          const t = byId(s.target);
          if (t && alive(t)) {
            const off = s.state === 'attack' ? Math.sin(world.t * 0.4 + s.phase) * 160 * u * mOf(t.z) : -Math.sign(t.vx || 1) * 60 * u * mOf(t.z);
            s.tx = t.x + off;
            s.ty = t.y + (s.state === 'attack' ? Math.cos(world.t * 0.5 + s.phase) * 50 * u * mOf(t.z) : 0);
            s.tz = clamp(t.z + (s.state === 'attack' ? Math.sin(s.phase) * 0.12 : 0), 0.04, 1.2);
          } else if (s.side === 'fleet') {
            back(s);
            continue;
          }
        }
        const left = steer(s, s.tx, s.ty, s.tz, s.speed * (s.state === 'chase' ? 1.2 : 1), dt, s.cls === 'fighter' ? 2.4 : 1.2);
        s.thrust += ((s.state === 'chase' ? 1 : 0.8) - s.thrust) * dt * 2;
        if (s.state === 'leave' && (s.x < -400 * u || s.x > GW + 400 * u || left < 6 * u)) s.state = 'dead';
      } else if (s.state === 'hold') {
        s.vx *= 1 - Math.min(1, dt * 0.8);
        s.vy *= 1 - Math.min(1, dt * 0.8);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.thrust += (0.15 - s.thrust) * dt;
      } else if (s.state === 'wing' || s.state === 'launch') {
        const w = wings.find((q) => q.id === s.home);
        if (!w) {
          s.state = 'leave';
          s.tx = entryX(s.dir > 0 ? -1 : 1, 300 * u);
          continue;
        }
        if (s.state === 'launch') {
          if (age < 0) continue;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.thrust = 1;
          if (age > 2.2) s.state = 'wing';
          continue;
        }
        // The leader flies the loop; the others hold their places off its wing.
        const lx = w.cx + Math.cos(w.a) * w.rx;
        const ly = w.cy + Math.sin(w.a) * w.ry;
        const lz = clamp(w.z + Math.sin(w.a) * 0.06, 0.03, 1);
        const tang = Math.sign(-Math.sin(w.a) * w.speed) || 1;
        const sl = s.slot;
        const back2 = Math.ceil(sl / 2) * 26 * u * mOf(lz);
        const side2 = (sl % 2 ? 1 : -1) * Math.ceil(sl / 2) * 14 * u * mOf(lz);
        steer(s, lx - tang * back2, ly + side2, lz, s.speed, dt, 2.6);
        s.thrust += (0.8 - s.thrust) * dt * 2;
      } else if (s.state === 'land') {
        const c = byId(s.home);
        if (!c || !alive(c)) {
          s.state = 'leave';
          s.tx = entryX(s.dir > 0 ? -1 : 1, 300 * u);
          continue;
        }
        const left = steer(s, c.x, c.y + lenOf(c) * 0.05, c.z, s.speed * 0.8, dt, 2);
        if (left < 10 * u * mOf(c.z)) s.state = 'dead';
      } else if (s.state === 'descend' || s.state === 'ascend' || s.state === 'dash') {
        const k = clamp(age / s.dur, 0, 1);
        const p = surf(s.lat, s.lon);
        const e = s.state === 'ascend' ? 1 - k : k;
        const ease = e * e * (3 - 2 * e);
        let tx2 = s.tx;
        let ty2 = s.ty;
        let tz2 = s.tz;
        if (s.state === 'ascend') {
          const t = byId(s.target);
          if (t) {
            tx2 = t.x;
            ty2 = t.y;
            tz2 = t.z;
          }
        }
        // Down: from where it was to the point on the planet; up: the other way.
        const [ax, ay, az] = s.state === 'ascend' ? [p[0], p[1], 1.45] : [s.sx, s.sy, s.sz];
        const [bx, by, bz] = s.state === 'ascend' ? [tx2, ty2, tz2] : [p[0], p[1], 1.45];
        const q = s.state === 'ascend' ? 1 - ease : ease;
        const nx = ax + (bx - ax) * q;
        const ny = ay + (by - ay) * Math.pow(q, s.state === 'dash' ? 1 : 1.25);
        s.vx = (nx - s.x) / Math.max(dt, 1e-3);
        s.vy = (ny - s.y) / Math.max(dt, 1e-3);
        s.x = nx;
        s.y = ny;
        s.z = az + (bz - az) * q;
        s.thrust = s.state === 'dash' ? 1 : 0.7;
        if (k >= 1) {
          if (s.state === 'ascend') {
            s.state = s.cls === 'shuttle' ? 'land' : 'transit';
            s.home = s.target;
            s.tx = tx2;
            s.ty = ty2;
            s.tz = tz2;
          } else {
            s.state = 'dead';
            if (s.cls === 'shuttle' || s.side === 'merchant') world.tally.landed++;
          }
        }
      } else if (s.state === 'jumpout') {
        s.thrust = 1;
        s.vx += s.dir * dt * 40 * u * m;
        s.x += s.vx * dt;
        if (age > 4) {
          fx('jump', s.x, s.y, s.z, { x2: s.x + s.dir * GW * 1.4, y2: s.y, dur: 0.6, r: lenOf(s), color: world.fleet.engine });
          fx('flash', s.x, s.y, s.z, { dur: 0.5, r: lenOf(s) * 0.5, color: '#e8f0ff' });
          s.state = 'dead';
        }
      } else if (s.state === 'jumpin') {
        s.thrust = 1;
        const left = steer(s, s.tx, s.ty, s.tz, s.speed * 2, dt, 0.8);
        if (age > 6 || left < 6 * u) {
          s.state = 'station';
          s.hx = s.tx;
          s.hy = s.ty;
        }
      } else if (s.state === 'disabled') {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 1 - dt * 0.05;
        s.vy += dt * 0.02 * u;
        s.thrust = 0;
      } else if (s.state === 'tow') {
        const t = byId(s.target);
        if (!t) {
          s.state = 'dead';
          continue;
        }
        const left = steer(s, t.x, t.y + lenOf(t) * 0.06, t.z, 30, dt, 0.6);
        s.thrust = 0;
        if (left < lenOf(t) * 0.08) s.state = 'dead';
      } else if (s.state === 'dying') {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += dt * 0.5 * u * m;
        s.thrust = 0.1;
        const L0 = lenOf(s);
        if (r() < dt * 6) fx(r() < 0.5 ? 'fire' : 'spark', s.x + (r() - 0.5) * L0 * 0.8, s.y + (r() - 0.5) * L0 * 0.1, s.z, { vx: (r() - 0.5) * 50 * u * m, vy: (r() - 0.5) * 30 * u * m, dur: 0.6 + r(), r: (10 + r() * 20) * u * m * 2, color: '#ffa040' });
        if (r() < dt * 1.5) fx('flash', s.x + (r() - 0.5) * L0 * 0.8, s.y, s.z, { dur: 0.5, r: L0 * 0.3, color: '#ffd090' });
        if (age > s.dur) boom(s, true);
      }
      face(s, dt);
      s.dmg = Math.max(s.dmg, 1 - s.hp / s.maxHp);
    }
    world.ships = world.ships.filter((s) => s.state !== 'dead');
  }
  /** A fleet ship's job is done: back to its place. */
  function back(s: Ship) {
    s.target = -1;
    if (s.cls === 'fighter') {
      if (!wings.some((w) => w.id === s.home)) {
        s.state = 'leave';
        s.tx = entryX(s.dir > 0 ? -1 : 1, 300 * u);
      } else s.state = 'wing';
    } else if (isCapital(s.cls)) s.state = 'station';
    else if (s === picket) s.state = 'station';
    else {
      s.state = 'patrol';
      s.hy = laneThrough(s.x, s.y);
      s.tx = s.x > GW / 2 ? s.sx : s.sy;
    }
    s.job = s === picket ? 'PICKET · CHECKPOINT' : s.cls === 'frigate' ? 'ON PATROL' : s.job;
  }

  // ---- guns ------------------------------------------------------------------------------------------------
  function guns() {
    for (const s of world.ships) {
      if (!alive(s) || s.target < 0 || world.t < s.gunT || s.dark) continue;
      const t = byId(s.target);
      if (!t || !alive(t)) {
        if (s.side === 'fleet' && s.state !== 'chase' && s.state !== 'attack') s.target = -1;
        continue;
      }
      if (s.cls === 'fighter') {
        fire(s, t, 'laser');
        s.gunT = world.t + 0.35 + r() * 0.6;
      } else if (s.cls === 'frigate' || s.cls === 'corvette') {
        fire(s, t, r() < 0.25 && s.side === 'home' ? 'missile' : 'laser');
        s.gunT = world.t + 0.5 + r() * 0.9;
      } else if (isCapital(s.cls) || s.cls === 'platform') {
        fire(s, t, r() < 0.7 ? 'heavy' : 'laser');
        s.gunT = world.t + (s.cls === 'platform' ? 1.6 : 0.6) + r() * 1.4;
      }
    }
    for (const b of world.bolts) {
      if (b.done) continue;
      if (world.t - b.t0 < b.dur) continue;
      b.done = true;
      if (!isNaN(b.lat)) {
        const ps = surf(b.lat, b.lon);
        world.scars.push({ lat: b.lat, lon: b.lon, t0: world.t, size: (b.kind === 'beam' ? 1 : 0.6) * (0.8 + r() * 0.5), heat: 1 });
        if (world.scars.length > 60) world.scars.shift();
        emit('impact', ps[0], ps[1], 0.12);
        continue;
      }
      const t = byId(b.to);
      if (!t || !b.hit || !alive(t)) continue;
      t.hp -= b.dmg;
      t.shieldT = world.t;
      const m = mOf(t.z);
      fx(t.hp > t.maxHp * 0.35 && isCapital(t.cls) ? 'hit' : 'spark', b.x1, b.y1, t.z, { dur: 0.4, r: (14 + b.dmg * 4) * u * m * 1.5, color: t.hp > t.maxHp * 0.35 ? '#a8d8ff' : '#ffb060', vx: (r() - 0.5) * 30 * u * m, vy: (r() - 0.5) * 30 * u * m });
      if (t.hp <= 0) {
        const killer = byId(b.from);
        if (isCapital(t.cls)) {
          if (t.side === 'fleet') {
            world.tally.lost++;
            war({ resolve: -0.22 });
            chronicle(`${theT(t.name)} was lost${t.tag === 'battle' || world.alarm ? ' in the fighting' : ''}, and broke up in orbit.`);
          }
          t.state = 'dying';
          t.t0 = world.t;
          t.dur = 4 + r() * 2;
          t.hp = 0.001;
          t.target = -1;
          say(`${the(t.name)} IS BREAKING UP`, t.x, t.y - lenOf(t) * 0.2, '#fca5a5');
          look('dying', t.x, t.y, 1.6, 10, 9);
        } else {
          boom(t, false);
          if (killer && killer.side === 'fleet' && t.side !== 'fleet' && t.cls !== 'fighter') world.tally.kills++;
          if (t.side === 'fleet' && t.cls !== 'fighter') {
            world.tally.lost++;
            chronicle(`${theT(t.name)} was lost with all hands${t.tag === 'battle' ? ' in the sortie' : ''}.`);
          }
          if (killer && t.cls !== 'fighter' && r() < 0.6) speak(killer, killer.side === 'fleet' ? pick(['SPLASH ONE', 'TARGET DESTROYED', 'SHE\'S GONE', 'SCRATCH ONE']) : pick(['GOT ONE!', 'SHE\'S BURNING!', 'FOR HOME!']));
        }
      }
    }
    world.bolts = world.bolts.filter((b) => world.t - b.t0 < b.dur + (b.hit ? 0.05 : 0.35));
  }

  // ---- the sky: the orbit, the star, sunset and sunrise ---------------------------------------------------
  let wasUp = false;
  let wasLit = true;
  let skyReady = false;
  function sky(dt: number) {
    const th = theta0 + (2 * Math.PI * world.t) / orbitT;
    const ci = Math.cos(iota);
    const si = Math.sin(iota);
    world.L = norm([Math.cos(th), -Math.sin(th) * si, Math.sin(th) * ci]);
    world.hour = (((th / (2 * Math.PI)) % 1) + 1) % 1;
    const [lx, ly, lz] = world.L;
    const up = lz < -0.02;
    world.sun.up = up;
    if (up) {
      world.sun.x = GW / 2 + (lx / -lz) * F;
      world.sun.y = eyeY + (ly / -lz) * F;
      const d = Math.hypot(world.sun.x - cx, world.sun.y - cy);
      world.sun.vis = smooth(R - world.sun.r * 0.8, R + world.sun.r * 1.2, d);
    } else world.sun.vis = 1;
    world.light = world.sun.vis;
    // The moments of the orbit, said.
    const lit = world.light > 0.5;
    if (!skyReady) {
      skyReady = true;
      wasLit = lit;
      wasUp = up;
    }
    if (wasLit && !lit) {
      say(`THE SUN SETS BEHIND ${pname}. THE FLEET GOES INTO THE DARK`, world.sun.x, Math.min(world.sun.y, limb) - 60 * u, '#ffd0a0');
      emit('sunset', world.sun.x, limb, 0.3);
      look('sunset', clamp(world.sun.x, GW * 0.2, GW * 0.8), limb, 1.4, 14, 6);
      chronicle(`The fleet passed into the shadow of ${titled(pname)}, and showed only its running lights.`);
    } else if (!wasLit && lit && world.t > 1) {
      say(`SUNRISE OVER THE LIMB OF ${pname}`, world.sun.x, Math.min(world.sun.y, limb) - 60 * u, '#ffe0b0');
      emit('sunrise', world.sun.x, limb, 0.3);
      look('sunrise', clamp(world.sun.x, GW * 0.2, GW * 0.8), limb, 1.4, 14, 6);
    }
    if (up && !wasUp && world.t > 1 && world.sun.x > -GW * 0.2 && world.sun.x < GW * 1.2) {
      say('THE STAR CLIMBS INTO THE SKY BEYOND THE PLANET', clamp(world.sun.x, GW * 0.15, GW * 0.85), Math.min(world.sun.y, limb) - 60 * u, '#ffe8c0', 1);
      emit('starrise', world.sun.x, world.sun.y, 0.15);
    }
    wasUp = up;
    wasLit = lit;
    for (const mo of world.moons) {
      mo.x += mo.vx * dt;
      if (mo.x < -mo.r * 3) mo.x = GW + mo.r * 3;
      if (mo.x > GW + mo.r * 3) mo.x = -mo.r * 3;
    }
    world.flare = Math.max(0, world.flare - dt / 22);
    world.static = Math.max(0, world.static - dt / 14);
  }

  // ---- debris, wrecks, meteors -------------------------------------------------------------------------------
  function orbitals(dt: number) {
    for (const d of world.debris) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 1 - dt * 0.03;
      d.vy = d.vy * (1 - dt * 0.03) + dt * 0.03 * u;
      d.z = Math.min(1.2, d.z + dt * 0.0008);
      d.rot += d.vr * dt;
      d.hot = Math.max(0, d.hot - dt / 8);
    }
    const fall: typeof world.debris = [];
    world.debris = world.debris.filter((d) => {
      if (d.x < -200 * u || d.x > GW + 200 * u || d.y > GH + 50) return false;
      if (d.y > limbY(d.x) + 3 * u) {
        fall.push(d);
        return false;
      }
      return true;
    });
    for (const d of fall) {
      if (world.meteors.length > 40) break;
      const a = Math.atan2(cy - d.y, cx - d.x) + (r() - 0.5) * 0.9;
      const v = (60 + r() * 90) * u;
      world.meteors.push({ x: d.x, y: d.y, vx: Math.cos(a) * v * 0.6 + d.vx, vy: Math.abs(Math.sin(a)) * v, t0: world.t, dur: 1.2 + r() * 1.8, size: d.size, seed: d.seed });
      if (r() < 0.15) emit('meteor', d.x, d.y, 0.05);
    }
    for (const w of world.wrecks) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.vy += dt * 0.012 * u;
      w.vx *= 1 - dt * 0.004;
      w.part += dt * 0.6 * u * mOf(w.z);
      w.z = Math.min(1.2, w.z + dt * 0.0006);
      w.fire = Math.max(0.15, w.fire - dt / 200);
      const L0 = w.len * u * mOf(w.z);
      if (r() < dt * 1.2 * w.fire) fx(r() < 0.4 ? 'spark' : 'fire', w.x + (r() - 0.5) * L0 * 0.5, w.y + (r() - 0.5) * L0 * 0.06, w.z, { vx: (r() - 0.5) * 12 * u, vy: (r() - 0.5) * 8 * u, dur: 0.6 + r() * 0.8, r: (4 + r() * 8) * u * mOf(w.z) * 2, color: '#ff9a40' });
      if (r() < dt * 0.2 && world.debris.length < 320) world.debris.push({ x: w.x + (r() - 0.5) * L0 * 0.6, y: w.y, z: w.z, vx: (r() - 0.5) * 6 * u, vy: (r() - 0.5) * 2 * u, rot: r() * 6, vr: (r() - 0.5), size: (1.5 + r() * 3) * u * mOf(w.z) * 2, seed: Math.floor(r() * 1e6), t0: world.t, hot: 0 });
      if (w.fall > 0) w.z = Math.min(1.6, w.z + dt * 0.03);
      if (w.fall === 0 && w.y > limbY(w.x) - L0 * 0.1) {
        w.fall = world.t;
        say(`THE WRECK OF ${the(w.name)} FALLS INTO THE AIR OF ${pname}, AND BURNS`, w.x, w.y - 50 * u, '#ffc890');
        emit('burnup', w.x, w.y, 0.6);
        chronicle(`The wreck of the ${titled(w.name)} fell into the air of ${titled(pname)} and burned across the sky.`);
        look('burnup', w.x, w.y, 1.6, 10, 6);
      }
    }
    world.wrecks = world.wrecks.filter((w) => {
      if (w.fall > 0 && world.t - w.fall > 14) return false;
      return w.x > -600 * u && w.x < GW + 600 * u;
    });
    for (const m of world.meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    world.meteors = world.meteors.filter((m) => world.t - m.t0 < m.dur);
    for (const f of world.fx) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'shard' || f.kind === 'spark') {
        f.vx *= 1 - dt * 0.6;
        f.vy *= 1 - dt * 0.6;
      }
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
    for (const s of world.scars) s.heat = Math.max(0, 1 - (world.t - s.t0) / 600);
    world.scars = world.scars.filter((s) => s.heat > 0);
  }

  // ---- the floor: shuttles, merchants at the picket, tenders and the station, wings out and back ------------
  const capitals = () => world.ships.filter((s) => s.side === 'fleet' && isCapital(s.cls) && alive(s) && s.state === 'station' && !s.dark);
  /** A point on the visible face of the planet, a little below the limb (for things going down). */
  function groundPoint(x?: number): [number, number] | null {
    for (let k = 0; k < 8; k++) {
      const gx = x ?? GW * (0.12 + r() * 0.76);
      const top = limbY(gx);
      if (!isFinite(top)) continue;
      const gy = Math.min(GH - 10 * u, top + (GH - top) * (0.08 + r() * 0.35));
      const ll = latLon(gx, gy);
      if (ll) return ll;
    }
    return null;
  }
  let nextShuttle = 3 + r() * 6;
  function shuttles() {
    if (world.t < nextShuttle) return;
    nextShuttle = world.t + (14 + r() * 18) / traffic;
    const caps = capitals();
    if (!caps.length) return;
    const c = pick(caps);
    const gp = groundPoint();
    if (!gp) return;
    const up = r() < 0.45;
    const m = mOf(c.z);
    if (up) {
      const s = spawn('shuttle', 'fleet', 0, 0, 1.45, { state: 'ascend', lat: gp[0], lon: gp[1], target: c.id, dur: 28 + r() * 16, job: `UP FROM ${pname}`, t0: world.t });
      const p = surf(gp[0], gp[1]);
      s.x = p[0];
      s.y = p[1];
      s.dir = c.x > s.x ? 1 : -1;
      after(3, () => speak(s, pick(['WHEELS UP FROM THE SURFACE', 'CLIMBING OUT OF THE SOUP', 'ON OUR WAY UP', 'DOCKING IN FOUR MINUTES'])));
      emit('shuttle', p[0], p[1], 0.12);
    } else {
      const x0 = c.x + (r() - 0.5) * lenOf(c) * 0.3;
      const y0 = c.y + lenOf(c) * 0.06;
      const s = spawn('shuttle', 'fleet', x0, y0, c.z, { state: 'descend', lat: gp[0], lon: gp[1], sx: x0, sy: y0, sz: c.z, dur: 30 + r() * 18, job: `DOWN TO ${pname}`, t0: world.t, dir: r() < 0.5 ? 1 : -1 });
      after(2, () => speak(s, pick(LINES.shuttle)));
      if (r() < 0.35) say(`${s.name} LEAVES ${the(c.name)} FOR THE SURFACE`, x0, y0 - 40 * u * m, '#d8e4f0', 1);
      emit('shuttle', x0, y0, 0.12);
    }
  }
  let nextMerchant = 8 + r() * 10;
  function merchants() {
    const pk = picket && alive(picket) ? picket : null;
    if (pk && world.t > nextMerchant && world.ships.filter((s) => s.side === 'merchant' && s.state !== 'descend').length < (phone ? 1 : 2)) {
      nextMerchant = world.t + (55 + r() * 45) / traffic / (has('convoy') ? 1.6 : 1);
      const fromAbove = r() < 0.7;
      if (fromAbove) {
        const dir: 1 | -1 = pk.x > GW / 2 ? 1 : -1;
        const z = clamp(pk.z + (r() - 0.5) * 0.15, 0.2, 0.8);
        const s = spawn('freighter', 'merchant', entryX(dir, 260 * u), pk.y + (r() - 0.5) * 40 * u, z, { state: 'transit', dir, tx: pk.x - dir * (lenOf(pk) * 0.9 + 120 * u * mOf(z)), ty: pk.y + (r() - 0.5) * 30 * u, tz: z, job: 'INBOUND · TO THE PICKET', tag: 'in' });
        after(4, () => speak(s, pick(LINES.merchant)));
        emit('merchant', s.x, s.y, 0.15);
      } else {
        const gp = groundPoint();
        if (!gp) return;
        const s = spawn('freighter', 'merchant', 0, 0, 1.45, { state: 'ascend', lat: gp[0], lon: gp[1], target: pk.id, dur: 40, job: `OUTBOUND FROM ${pname}`, tag: 'out' });
        const p = surf(gp[0], gp[1]);
        s.x = p[0];
        s.y = p[1];
        s.dir = pk.x > s.x ? 1 : -1;
        emit('merchant', p[0], p[1], 0.15);
      }
    }
    for (const s of world.ships) {
      if (s.side !== 'merchant' || !alive(s)) continue;
      const age = world.t - s.t0;
      if (s.state === 'transit' && s.tag === 'in' && Math.hypot(s.x - s.tx, s.y - s.ty) < 12 * u) {
        s.state = 'hold';
        s.t0 = world.t;
        s.job = 'HELD AT THE PICKET · SCANNING';
        if (pk) speak(pk, pick(LINES.inspect.slice(0, 2)));
        emit('inspect', s.x, s.y, 0.2);
      } else if (s.state === 'transit' && s.tag === 'out' && pk && Math.hypot(s.x - pk.x, s.y - pk.y) < lenOf(pk) * 1.4) {
        s.state = 'hold';
        s.t0 = world.t;
        s.tag = 'outhold';
        s.job = 'OUTBOUND · SCANNING';
        speak(pk, pick(LINES.inspect.slice(0, 2)));
        emit('inspect', s.x, s.y, 0.2);
      } else if (s.state === 'hold') {
        if (pk && r() < 0.05) fx('scan', pk.x, pk.y, pk.z, { x2: s.x, y2: s.y, dur: 2.2, r: lenOf(s) * 0.5, color: world.fleet.port });
        if (age > 14 + (s.seed % 7)) {
          world.tally.inspected++;
          const roll = r();
          const seize = has('convoy') && roll < 0.22;
          const back2 = !seize && roll < (has('convoy') ? 0.45 : 0.32);
          if (seize && pk) {
            s.state = 'tow';
            const caps = capitals();
            s.target = caps.length ? pick(caps).id : pk.id;
            s.job = 'SEIZED AS A PRIZE';
            world.tally.seized++;
            war({ anger: 0.08, stores: -0.02 });
            speak(pk, 'PREPARE TO BE BOARDED');
            say(`${the(s.name)} IS SEIZED, AND TAKEN IN TOW`, s.x, s.y - 50 * u, '#fcd34d');
            emit('seized', s.x, s.y, 0.5);
            chronicle(`${theT(s.name)} was boarded at the picket and taken as a prize.`);
          } else if (back2) {
            s.state = 'leave';
            s.tx = entryX(s.x > GW / 2 ? -1 : 1, 500 * u);
            s.ty = s.y - 40 * u;
            s.job = 'TURNED BACK';
            war({ stores: -0.01, anger: 0.02 });
            if (pk) speak(pk, 'TURN BACK. THIS PORT IS CLOSED');
            after(2, () => speak(s, pick(['WE HAVE NOWHERE ELSE TO GO', 'THIS IS AN OUTRAGE', 'UNDERSTOOD. TURNING BACK', 'YOU\'LL STARVE THEM'])));
            emit('turnedback', s.x, s.y, 0.3);
            if (r() < 0.5) say(`${the(s.name)} IS TURNED BACK FROM THE LINE`, s.x, s.y - 50 * u, '#e8d0b0', 1);
          } else if (s.tag === 'outhold') {
            s.state = 'jumpout';
            s.t0 = world.t;
            s.dir = s.x > GW / 2 ? 1 : -1;
            s.job = 'CLEARED · OUTBOUND';
            if (pk) speak(pk, 'CLEARED. DEPART THE SYSTEM');
            emit('cleared', s.x, s.y, 0.2);
          } else {
            const gp = groundPoint();
            if (gp) {
              Object.assign(s, { state: 'descend', lat: gp[0], lon: gp[1], sx: s.x, sy: s.y, sz: s.z, dur: 45 + r() * 15, t0: world.t, job: `CLEARED · DOWN TO ${pname}` });
              war({ stores: 0.03 });
              if (pk) speak(pk, 'YOU ARE CLEARED TO PROCEED');
              emit('cleared', s.x, s.y, 0.25);
              if (r() < 0.5) say(`${the(s.name)} IS CLEARED DOWN TO ${pname}`, s.x, s.y - 50 * u, '#d8e4f0', 1);
            }
          }
        }
      }
    }
  }
  const st = world.station;
  function station(dt: number) {
    // The tenders: to a capital for a segment, then to the frame, and it is welded in.
    const target = () => ({ x: st.kind === 'wheel' ? st.x : GW * (0.12 + ((st.built % 14) / 14) * 0.76), y: st.kind === 'wheel' ? st.y : laneY(GW * (0.12 + ((st.built % 14) / 14) * 0.76), st.y), z: st.z });
    for (const s of world.ships) {
      if (s.cls !== 'tender' || !alive(s) || s.side !== 'fleet' || (s.tag !== 'idle' && s.tag !== 'load' && s.tag !== 'carry' && s.tag !== 'weld')) continue;
      const age = world.t - s.t0;
      if (s.tag === 'idle') {
        const caps = capitals();
        if (!caps.length) continue;
        const c = pick(caps);
        Object.assign(s, { tag: 'load', target: c.id, tx: c.x - c.dir * lenOf(c) * 0.3, ty: c.y + lenOf(c) * 0.12, tz: c.z - 0.02, state: 'transit', t0: world.t, job: `TENDER · TO ${the(c.name)}` });
      } else if (s.tag === 'load' && Math.hypot(s.x - s.tx, s.y - s.ty) < 10 * u) {
        if (s.state !== 'hold') {
          s.state = 'hold';
          s.t0 = world.t;
          s.job = 'TENDER · LOADING A SEGMENT';
        } else if (age > 8) {
          const p = target();
          Object.assign(s, { tag: 'carry', state: 'transit', tx: p.x + (r() - 0.5) * 60 * u, ty: p.y + 30 * u * mOf(p.z), tz: p.z - 0.03, t0: world.t, job: `TENDER · A SEGMENT FOR ${st.name}` });
          speak(s, pick(LINES.tender));
        }
      } else if (s.tag === 'carry' && Math.hypot(s.x - s.tx, s.y - s.ty) < 10 * u) {
        s.tag = 'weld';
        s.state = 'hold';
        s.t0 = world.t;
        s.job = 'TENDER · WELDING';
      } else if (s.tag === 'weld') {
        if (r() < dt * 8) fx('weld', s.x + (r() - 0.5) * 40 * u * mOf(s.z), s.y - 20 * u * mOf(s.z), s.z, { dur: 0.3 + r() * 0.3, r: 6 * u, color: '#cfe8ff', vx: (r() - 0.5) * 30 * u, vy: (r() - 0.5) * 30 * u });
        st.work = clamp(age / 12, 0, 1);
        if (age > 12) {
          st.work = 0;
          s.tag = 'idle';
          s.state = 'transit';
          if (st.built < st.plan) {
            st.built++;
            const p = target();
            emit('segment', p.x, p.y, 0.2);
            if (st.built === st.plan) {
              st.stage++;
              st.lit = world.t;
              say(st.stage === 1 ? `${st.name} IS COMPLETE. HER LIGHTS COME ON` : `${st.name} GROWS: THE ${['', 'FIRST', 'SECOND', 'THIRD'][st.stage]} STAGE IS DONE`, st.x, st.y - 90 * u * mOf(st.z), '#fde68a');
              emit('commissioned', st.x, st.y, 0.6);
              chronicle(st.stage === 1 ? `${titled(st.name)} was completed, and lit from end to end.` : `${titled(st.name)} was extended again; the yards are never idle.`);
              look('station', st.x, st.y, 1.5, 10, 6);
              // The next stage, planned; three stages, then she is refitted for ever.
              if (st.stage < 3) after(40, () => {
                st.plan += st.kind === 'wheel' ? [0, 8, 6][st.stage] : [0, 10, 6][st.stage];
                say(`WORK BEGINS ON THE NEXT STAGE OF ${st.name}`, st.x, st.y - 70 * u * mOf(st.z), '#e8eef8', 1);
              });
            } else if (r() < 0.4) say(`SEGMENT ${st.built} OF ${st.plan} IS WELDED INTO ${st.name}`, p.x, p.y - 60 * u * mOf(p.z), '#e8eef8', 1);
          }
        }
      }
    }
  }
  let nextWing = 40 + r() * 30;
  function wingsStep(dt: number) {
    for (const w of wings) {
      w.a += dt * w.speed;
      if (w.out && world.t > w.until && w.side === 'fleet' && !world.alarm) {
        w.out = false;
        const c = byId(w.carrier);
        for (const f of world.ships.filter((q) => q.home === w.id && q.state === 'wing')) {
          if (c && alive(c)) {
            f.state = 'land';
            f.home = c.id;
          } else {
            f.state = 'leave';
            f.tx = entryX(f.dir > 0 ? -1 : 1, 300 * u);
          }
        }
        const lead = world.ships.find((q) => q.home === c?.id && q.cls === 'fighter');
        if (lead) speak(lead, pick(['RETURNING TO THE NEST', 'ON THE DECK IN FIVE', 'BINGO FUEL. COMING HOME']));
        emit('recover', w.cx, w.cy, 0.12);
      }
    }
    for (let i = wings.length - 1; i >= 0; i--) if (!world.ships.some((q) => q.home === wings[i].id)) wings.splice(i, 1);
    if (world.t > nextWing) {
      nextWing = world.t + (45 + r() * 50) / traffic;
      if (wings.filter((w) => w.side === 'fleet').length < (phone ? 1 : 3)) {
        const caps = capitals().filter((q) => q.cls === 'carrier');
        const c = caps.length ? pick(caps) : pick(capitals().length ? capitals() : [null as unknown as Ship]);
        if (c) {
          const w = launchWing(c, 3 + Math.floor(r() * 2));
          say(`${w.name} LAUNCHES FROM ${the(c.name)}`, c.x, c.y - lenOf(c) * 0.15, '#d8e4f0', 1);
          emit('launch', c.x, c.y, 0.2);
        }
      }
    }
  }
  // Replacements: the line is never left short for long, even without a cast of jumps.
  let short = 0;
  function reinforce(dt: number) {
    const n = world.ships.filter((s) => s.side === 'fleet' && isCapital(s.cls) && s.cls !== 'flagship' && alive(s)).length;
    const want = phone ? 3 : 4;
    short = n < want ? short + dt : 0;
    if (short > (has('jumps') ? 60 : 110)) {
      short = 0;
      jumpIn(capitalCls(r), r() < 0.5 ? 1 : 0);
    }
    const esc = world.ships.filter((s) => s.side === 'fleet' && s.cls === 'frigate' && alive(s)).length;
    if (esc < (phone ? 2 : 3) && r() < dt / 60) {
      const z = 0.25 + r() * 0.5;
      const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
      const y0 = skyY(z);
      const s = spawn('frigate', 'fleet', entryX(dir, 300 * u), laneY(entryX(dir, 300 * u), y0), z, { dir, state: 'patrol', hy: y0, tx: dir > 0 ? GW * 1.1 : -GW * 0.1, job: 'ON PATROL' });
      s.sx = -GW * 0.1;
      s.sy = GW * 1.1;
      speak(s, 'JOINING THE PATROL LINE');
      emit('patrol', s.x, s.y, 0.1);
    }
    if (picket && !alive(picket)) {
      const pz = picket.z;
      const px = picket.hx;
      const py = picket.hy;
      picket = null;
      after(30, () => {
        picket = spawn('frigate', 'fleet', entryX(px > GW / 2 ? 1 : -1, 300 * u), py, pz, { state: 'transit', tx: px, ty: py, tz: pz, job: 'PICKET · CHECKPOINT' });
        picket.hx = px;
        picket.hy = py;
        after(20, () => {
          if (picket && alive(picket)) picket.state = 'station';
        });
      });
    }
  }
  /** A capital ship drops out of the lane: the streak, the flash, and she takes her place. */
  function jumpIn(cls: Cls, escorts: number, where?: { x: number; y: number; z: number }, extra: Partial<Ship> = {}): Ship {
    const z = where?.z ?? 0.3 + r() * 0.55;
    const x = where?.x ?? GW * (0.12 + r() * 0.76);
    const y = where?.y ?? skyY(z);
    const dir: 1 | -1 = r() < 0.8 ? fleetDir : (-fleetDir as 1 | -1);
    const s = spawn(cls, 'fleet', x - dir * 180 * u * mOf(z), y, z, { state: 'jumpin', tx: x, ty: y, tz: z, dir, job: 'JUMPING IN', ...extra });
    s.vx = dir * 260 * u * mOf(z);
    fx('jump', s.x, s.y, z, { x2: s.x - dir * GW * 1.3, y2: s.y, dur: 0.7, r: lenOf(s), color: world.fleet.engine });
    fx('flash', s.x, s.y, z, { dur: 0.9, r: lenOf(s) * 0.7, color: '#eef4ff' });
    fx('ring', s.x, s.y, z, { dur: 1.4, r: lenOf(s) * 0.9, color: world.fleet.engine });
    for (let k = 0; k < escorts; k++) {
      const ez = clamp(z + (r() - 0.5) * 0.2, 0.15, 0.95);
      const ex = x + (r() - 0.5) * 300 * u;
      const ey = skyY(ez);
      after(0.4 + k * 0.5, () => {
        const e = spawn('frigate', 'fleet', ex - dir * 100 * u, ey, ez, { state: 'patrol', dir, hy: ey, tx: dir > 0 ? GW * 1.1 : -GW * 0.1, job: 'ON PATROL' });
        e.sx = -GW * 0.1;
        e.sy = GW * 1.1;
        fx('jump', e.x, e.y, ez, { x2: e.x - dir * GW, y2: e.y, dur: 0.5, r: lenOf(e), color: world.fleet.engine });
        fx('flash', e.x, e.y, ez, { dur: 0.5, r: lenOf(e) * 0.6, color: '#eef4ff' });
      });
    }
    world.tally.jumps++;
    war({ resolve: 0.12 });
    emit('jumpin', x, y, 0.7);
    look('jumpin', x, y, 1.5, 10, 7);
    say(`${the(s.name)} JUMPS IN${escorts ? ` WITH ${escorts === 1 ? 'AN ESCORT' : `${escorts} ESCORTS`}` : ''}`, x, y - lenOf(s) * 0.25 - 30 * u, '#cfe0ff');
    after(2.5, () => speak(s, pick(LINES.jump)));
    return s;
  }

  // ---- the systems ------------------------------------------------------------------------------------------
  function runnerSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let runner: Ship | null = null;
    let fate: 'through' | 'killed' | 'caught' = 'through';
    let k0 = 0;
    let decided = false;
    let chasers: Ship[] = [];
    let next = 25 + c.r() * 20;
    return {
      id: 'runners',
      step() {
        if (!runner) {
          if (w.t < next || w.alarm || w.war.stage === 'contacts' || w.war.stage === 'sortie' || !w.director.want('runner', 0.6, 60)) return;
          const out = c.r() < 0.3;
          const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
          const z = 0.2 + c.r() * 0.45;
          const gp = groundPoint(GW * (0.5 + dir * (0.05 + c.r() * 0.3)));
          if (!gp) return;
          fate = c.r() < 0.42 ? 'through' : c.r() < 0.55 ? 'killed' : 'caught';
          k0 = 0.45 + c.r() * 0.3;
          decided = false;
          if (out) {
            runner = c.ship('corvette', 'runner', 0, 0, 1.45, { state: 'ascend', lat: gp[0], lon: gp[1], dur: 26 + c.r() * 6, tag: 'out', job: 'BREAKING OUT' });
            const tgt = c.ship('platform', 'runner', entryX(dir > 0 ? -1 : 1, 400 * u), skyY(z), z, { state: 'hold', name: 'MARKER', dark: true, tag: 'marker' });
            runner.target = tgt.id;
            const p = surf(gp[0], gp[1]);
            runner.x = p[0];
            runner.y = p[1];
            runner.dir = tgt.x > p[0] ? 1 : -1;
            c.say(`A SHIP CLIMBS OUT OF ${pname} AT FULL BURN. A RUNNER, BREAKING OUT`, p[0], limb - 40 * u, '#fca5a5');
          } else {
            const sx = entryX(dir, 200 * u);
            const sy = skyY(z) * (0.6 + c.r() * 0.3);
            runner = c.ship('corvette', 'runner', sx, sy, z, { state: 'dash', lat: gp[0], lon: gp[1], sx, sy, sz: z, dur: 30 + c.r() * 8, dir: (dir > 0 ? 1 : -1) as 1 | -1, tag: 'in', job: 'RUNNING THE BLOCKADE' });
            fx('jump', sx, sy, z, { x2: sx - dir * GW, y2: sy, dur: 0.5, r: 80 * u, color: w.home.engine });
            c.say(`A SHIP DROPS OUT OF THE LANE AND RUNS FOR ${pname}. A BLOCKADE RUNNER`, GW / 2, sy - 30 * u, '#fca5a5');
          }
          const rn = runner;
          c.emit('runner', rn.x, rn.y, 0.8);
          c.look('runner', rn.x, rn.y, 1.4, 10, 7);
          c.after(1.5, () => c.speak(rn, pick(LINES.runner)));
          w.alarm = w.t;
          w.alarmWhy = 'A RUNNER';
          // The pickets and the nearest wing go after her; the capitals fire.
          c.after(2.5 + c.r() * 2, () => {
            if (!runner || !alive(runner)) return;
            const free = w.ships.filter((s) => s.side === 'fleet' && alive(s) && (s.cls === 'frigate' || s.cls === 'fighter') && s.state !== 'jumpin' && s.state !== 'launch').sort((a, b) => Math.hypot(a.x - rn.x, a.y - rn.y) - Math.hypot(b.x - rn.x, b.y - rn.y));
            chasers = free.slice(0, phone ? 3 : 5);
            for (const s of chasers) {
              s.state = 'chase';
              s.target = rn.id;
              s.job = 'CHASING THE RUNNER';
            }
            const lead = chasers.find((q) => q.cls === 'frigate') ?? chasers[0];
            if (lead) c.speak(lead, pick(LINES.chase));
            for (const cap of capitals()) if (c.r() < 0.6) cap.target = rn.id;
            c.emit('chase', rn.x, rn.y, 0.5);
          });
          return;
        }
        const rn = runner;
        const age = w.t - rn.t0;
        const k = rn.state === 'dash' || rn.state === 'ascend' ? age / rn.dur : 1;
        // Most shots miss a runner; the fatal one does not.
        for (const b of w.bolts) if (b.to === rn.id && !b.done && w.t - b.t0 < 0.02 && fate !== 'killed') b.hit = b.hit && c.r() < 0.25;
        if (rn.hp < 2 && fate !== 'killed') rn.hp = 2;
        if (!decided && k > k0 && alive(rn)) {
          decided = true;
          if (fate === 'killed') {
            const sh = chasers.find((q) => alive(q)) ?? capitals()[0];
            if (sh) for (let i = 0; i < 3; i++) c.after(i * 0.3, () => alive(rn) && c.fire(sh, rn, sh.cls === 'fighter' ? 'laser' : 'heavy', { hit: true, dmg: 10 }));
          } else if (fate === 'caught') {
            const cap = capitals().sort((a, b) => Math.hypot(a.x - rn.x, a.y - rn.y) - Math.hypot(b.x - rn.x, b.y - rn.y))[0];
            if (cap) {
              rn.state = 'tow';
              rn.target = cap.id;
              rn.job = 'CAUGHT IN A TRACTOR BEAM';
              rn.vx *= 0.3;
              rn.vy *= 0.3;
              c.fx('tractor', cap.x, cap.y, cap.z, { x2: rn.x, y2: rn.y, dur: 14, r: lenOf(rn) * 0.6, color: '#a8d0ff', seed: rn.id });
              c.say(`${the(cap.name)} TAKES ${the(rn.name)} IN HER TRACTOR BEAM`, rn.x, rn.y - 50 * u, '#bfdbfe');
              c.speak(cap, 'TRACTOR LOCK. BRING HER IN');
              c.after(1.5, () => c.speak(rn, pick(['NO! NO, NOT LIKE THIS', 'ENGINES ARE NOT RESPONDING', 'WE\'RE CAUGHT'])));
              c.emit('caught', rn.x, rn.y, 0.7);
              w.tally.caught++;
              war({ stores: -0.04, anger: 0.06, resolve: 0.04 });
              c.chronicle(`The runner ${titled(rn.name)} was taken in a tractor beam by the ${titled(cap.name)}.`);
              finish();
            }
          }
        }
        if (!alive(rn) || rn.state === 'dead') {
          if (rn.hp <= 0) {
            w.tally.killed++;
            war({ anger: 0.13, stores: -0.02, resolve: 0.05 });
            c.say(`THE RUNNER ${rn.name} IS DESTROYED`, rn.x, rn.y - 40 * u, '#fca5a5');
            c.chronicle(`The runner ${titled(rn.name)} was shot to pieces short of the air.`);
          } else if (rn.tag === 'in') {
            w.tally.through++;
            war({ stores: 0.14, resolve: -0.12 });
            c.say(`${the(rn.name)} IS THROUGH THE LINE, AND INTO THE AIR OF ${pname}`, GW / 2, limb - 40 * u, '#fde68a');
            c.emit('through', rn.x, rn.y, 0.7);
            c.chronicle(`The runner ${titled(rn.name)} got through the line and down into the air of ${titled(pname)}.`);
          }
          finish();
          return;
        }
        if (rn.state === 'transit' && rn.tag === 'out') {
          // Out of the air: she makes for her jump point and goes.
          rn.state = 'jumpout';
          rn.t0 = w.t;
          rn.dir = rn.tx > rn.x ? 1 : -1;
          w.tally.through++;
          war({ resolve: -0.08 });
          c.say(`${the(rn.name)} BREAKS OUT, AND JUMPS AWAY`, rn.x, rn.y - 40 * u, '#fde68a');
          c.emit('through', rn.x, rn.y, 0.7);
          c.chronicle(`The runner ${titled(rn.name)} broke out from ${titled(pname)} and jumped away clean.`);
          finish();
        }
        if (rn.state === 'dash' && k > 0.72 && rn.lineT < w.t - 4) c.speak(rn, pick(['WE\'RE IN THE AIR! HOLD ON!', 'HEAT SHIELD, HEAT SHIELD!', 'ALMOST THERE']));
      },
      counts: () => ({ runner: runner ? 1 : 0 }),
    };
    function finish() {
      for (const s of chasers) if (alive(s) && s.target === runner?.id) back(s);
      for (const s of w.ships) if (s.side === 'fleet' && s.target === runner?.id) s.target = -1;
      w.ships = w.ships.filter((s) => s.tag !== 'marker');
      chasers = [];
      runner = null;
      w.alarm = 0;
      // The hungrier the planet, the sooner the next one tries.
      next = w.t + (22 + 70 * w.war.stores) * (0.7 + c.r() * 0.6);
    }
  }

  function battleSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let on = false;
    let t0 = 0;
    let dur = 0;
    let home: Ship[] = [];
    let doomed: Ship | null = null;
    let gather = 30;
    return {
      id: 'battle',
      step() {
        if (!on) {
          const wr = w.war;
          // The build-up: the planet gathers its courage, and the line sees it coming.
          if (wr.stage === 'calm' || wr.stage === 'aftermath') {
            if (wr.stage === 'aftermath' || w.t < 120 || w.alarm || !(wr.anger > 0.5 || (wr.stores < 0.2 && wr.anger > 0.3)) || !w.director.want('contacts', 0.6, 300)) return;
            wr.stage = 'contacts';
            wr.stageT = w.t;
            gather = 28 + c.r() * 20;
            w.alarm = w.t;
            w.alarmWhy = 'CONTACTS';
            c.say(`CONTACTS GATHERING ON THE NIGHT SIDE OF ${pname}`, GW / 2, limb - 40 * u, '#fcd34d');
            c.emit('contacts', GW / 2, limb, 0.5);
            const flag = capitals()[0];
            if (flag) c.speak(flag, pick(['ALL SHIPS, GENERAL QUARTERS', 'SOMETHING IS COMING UP. STAND TO', 'SCREEN TO THE LOW LANES']));
            // The screen: every wing out, every frigate down toward the limb.
            const carriers = capitals().filter((q) => q.cls === 'carrier');
            for (const cv of carriers.length ? carriers : capitals().slice(0, 1)) c.after(2 + c.r() * 4, () => alive(cv) && launchWing(cv, 4));
            for (const f of w.ships.filter((q) => q.side === 'fleet' && q.cls === 'frigate' && q.state === 'patrol')) f.hy = Math.max(f.hy, limb - GH * (0.05 + c.r() * 0.08));
            c.chronicle(`Contacts gathered under the clouds of ${titled(pname)}; the line stood to.`);
            return;
          }
          if (wr.stage !== 'contacts' || w.t - wr.stageT < gather) {
            if (wr.stage === 'contacts' && c.r() < 0.004) {
              const pk = w.ships.find((q) => q.side === 'fleet' && q.cls === 'frigate' && alive(q));
              if (pk) c.speak(pk, pick(['MOVEMENT IN THE CLOUDS', 'I COUNT FOUR. NO, SIX', 'ENGINE HEAT, LOW, GRID TWO', 'THEY\'RE SPOOLING UP DOWN THERE']));
            }
            return;
          }
          wr.stage = 'sortie';
          wr.stageT = w.t;
          on = true;
          t0 = w.t;
          dur = 75 + c.r() * 40;
          w.alarm = w.t;
          w.alarmWhy = 'A SORTIE';
          home = [];
          const n = phone ? 3 : 4 + Math.floor(c.r() * 3);
          const targets = w.ships.filter((s) => s.side === 'fleet' && alive(s) && s.cls !== 'shuttle' && s.cls !== 'fighter');
          for (let i = 0; i < n; i++) {
            const gp = groundPoint();
            if (!gp) continue;
            const t = pick(targets);
            const s = c.ship(c.r() < 0.5 ? 'frigate' : 'corvette', 'home', 0, 0, 1.45, { state: 'ascend', lat: gp[0], lon: gp[1], target: t?.id ?? -1, dur: 14 + c.r() * 8, tag: 'battle', job: 'SORTIE', t0: w.t + i * 1.5 });
            const p = surf(gp[0], gp[1]);
            s.x = p[0];
            s.y = p[1];
            home.push(s);
          }
          // Their fighters, and ours.
          const hw = launchWing(home[0] ?? w.ships[0], 4, 'home', { x: GW * (0.3 + c.r() * 0.4), y: limb - GH * 0.15, z: 0.4 });
          for (const f of w.ships.filter((q) => q.home === hw.id)) {
            const p = surf(home[0]?.lat ?? 0.3, home[0]?.lon ?? 0);
            Object.assign(f, { x: p[0] + (c.r() - 0.5) * 80 * u, y: p[1], z: 1.2, state: 'wing', tag: 'battle' });
          }
          c.say(`CONTACTS RISING FROM ${pname}! A SORTIE AGAINST THE LINE`, GW / 2, limb - 50 * u, '#fca5a5');
          c.emit('battle', GW / 2, limb, 1);
          c.look('battle', GW / 2, limb - GH * 0.15, 1.3, 20, 8);
          const flag = capitals()[0];
          if (flag) c.speak(flag, 'ALL SHIPS, BATTLE STATIONS');
          // Sometimes the sortie costs the line a capital ship.
          doomed = c.r() < 0.35 ? (capitals().filter((q) => q.z > 0.2).sort((a, b) => b.z - a.z)[0] ?? null) : null;
          return;
        }
        const age = w.t - t0;
        // Everyone in it picks someone to shoot.
        const fleetGuns = w.ships.filter((s) => s.side === 'fleet' && alive(s) && s.cls !== 'shuttle' && s.cls !== 'tender' && s.state !== 'jumpin');
        const theirs = w.ships.filter((s) => s.side === 'home' && alive(s) && s.tag === 'battle' && s.state !== 'ascend');
        if (age > 6 && age < dur) {
          for (const s of fleetGuns) {
            if (s.target >= 0 && byId(s.target) && alive(byId(s.target)!)) continue;
            if (!theirs.length) break;
            s.target = pick(theirs).id;
            if (s.cls === 'fighter' || (s.cls === 'frigate' && s !== picket)) {
              s.state = 'attack';
              s.job = 'ENGAGING';
            }
          }
          for (const s of theirs) {
            if (s.state === 'transit' || s.state === 'land') s.state = 'attack';
            if (!(s.target >= 0 && byId(s.target) && alive(byId(s.target)!))) {
              const t = pick(fleetGuns.length ? fleetGuns : [null as unknown as Ship]);
              if (t) s.target = t.id;
            }
          }
          // Their fighters too.
          for (const f of w.ships.filter((q) => q.side === 'home' && q.cls === 'fighter' && alive(q) && q.state === 'wing')) {
            if (age > 8 && fleetGuns.length) {
              f.state = 'attack';
              f.target = pick(fleetGuns).id;
            }
          }
          if (doomed && alive(doomed) && age > dur * 0.6) {
            const d = doomed;
            doomed = null;
            c.say(`A SALVO OF TORPEDOES STRIKES ${the(d.name)}`, d.x, d.y - lenOf(d) * 0.2, '#fca5a5');
            c.speak(d, 'WE\'RE HIT, WE\'RE HIT. REACTOR BREACH');
            const src = theirs[0] ?? null;
            for (let i = 0; i < 4; i++) c.after(i * 0.35, () => {
              if (!alive(d)) return;
              if (src && alive(src)) c.fire(src, d, 'missile', { hit: true, dmg: 14 });
              else d.hp -= 14;
            });
          }
          if (c.r() < 0.02) {
            const sp = pick([...theirs, ...fleetGuns]);
            if (sp) c.speak(sp, sp.side === 'home' ? pick(LINES.home) : pick(LINES.battle));
          }
        }
        if (age > dur || (age > 20 && !theirs.length && !home.some((s) => s.state === 'ascend' && alive(s)))) {
          on = false;
          w.alarm = 0;
          const left = theirs.length;
          for (const s of theirs) {
            const gp = groundPoint();
            if (gp) Object.assign(s, { state: 'descend', lat: gp[0], lon: gp[1], sx: s.x, sy: s.y, sz: s.z, dur: 18 + c.r() * 8, t0: w.t, target: -1, job: 'BREAKING OFF' });
          }
          for (const f of w.ships.filter((q) => q.side === 'home' && q.cls === 'fighter' && alive(q))) {
            const gp = groundPoint();
            if (gp) Object.assign(f, { state: 'descend', lat: gp[0], lon: gp[1], sx: f.x, sy: f.y, sz: f.z, dur: 14 + c.r() * 6, t0: w.t, target: -1 });
          }
          for (const s of w.ships) if (s.side === 'fleet' && (s.state === 'attack' || s.target >= 0)) back(s);
          c.say(left ? 'THE SORTIE BREAKS OFF, BACK INTO THE AIR' : 'THE SORTIE IS BROKEN. THE LINE HOLDS', GW / 2, limb - 50 * u, '#e8eef8');
          c.emit('battleover', GW / 2, limb, 0.5);
          c.chronicle(left ? `A sortie rose from ${titled(pname)} against the line, and broke off; the wrecks are still falling.` : `A sortie rose from ${titled(pname)} against the line and was destroyed to the last ship.`);
          home = [];
          w.war.stage = 'aftermath';
          w.war.stageT = w.t;
          w.war.anger = 0.08;
        }
      },
      counts: () => ({ battle: on ? 1 : 0 }),
    };
  }

  function jumpSystem(c: Ctx): SystemInstance {
    const w = c.world;
    return {
      id: 'jumps',
      step() {
        if (w.t < 40 || w.alarm) return;
        const caps = w.ships.filter((s) => s.side === 'fleet' && isCapital(s.cls) && s.cls !== 'flagship' && alive(s));
        const max = phone ? 4 : 7;
        // Reinforcements when the line is shaken or thin; reliefs now and then otherwise.
        const need = w.war.resolve < 0.55 || caps.length < max - 2;
        if (!w.director.want('jump', need ? 0.45 : 0.65, need ? 110 : 220)) return;
        if (caps.length >= max || (caps.length >= max - 2 && c.r() < 0.5)) {
          // A relief: an old ship goes home, and another takes her place.
          const old = caps.filter((s) => s.state === 'station' && s.z > 0.2).sort((a, b) => a.t0 - b.t0)[0];
          if (old) {
            old.state = 'jumpout';
            old.t0 = w.t;
            old.job = 'RELIEVED · JUMPING OUT';
            c.speak(old, pick(['RELIEVED ON STATION. GOING HOME', 'SHE\'S ALL YOURS', 'SEE YOU AT THE YARDS']));
            c.say(`${the(old.name)} IS RELIEVED, AND JUMPS FOR HOME`, old.x, old.y - lenOf(old) * 0.25, '#cfe0ff');
            c.emit('jumpout', old.x, old.y, 0.5);
            const spot = { x: old.hx, y: old.hy, z: old.z };
            c.after(14 + c.r() * 8, () => jumpIn(capitalCls(c.r), c.r() < 0.4 ? 1 : 0, spot));
            c.chronicle(`${theT(old.name)} was relieved on station and went home.`);
          }
        } else {
          const s = jumpIn(capitalCls(c.r), Math.floor(c.r() * 3));
          c.chronicle(`${theT(s.name)} jumped in to strengthen the line.`);
        }
      },
    };
  }

  function broadsideSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let next = 100 + c.r() * 60;
    return {
      id: 'broadside',
      step() {
        if (w.t < next || w.alarm) return;
        let tgt = w.ships.find((s) => s.side === 'home' && s.cls === 'platform' && alive(s));
        if (!tgt) {
          // A defence platform climbs out of the air: something to shoot at.
          if (!w.director.want('platform', 0.3, 160)) return;
          next = w.t + 50;
          const x = GW * (0.15 + c.r() * 0.7);
          const gp = groundPoint(x);
          if (!gp) return;
          const p = c.ship('platform', 'home', 0, 0, 1.45, { state: 'ascend', lat: gp[0], lon: gp[1], dur: 30, job: 'ORBITAL GUN · CLIMBING' });
          const marker = c.ship('platform', 'runner', x, limbY(x) - GH * (0.02 + c.r() * 0.03), 0.9, { state: 'hold', name: 'MARKER', dark: true, tag: 'marker' });
          p.target = marker.id;
          const pp = surf(gp[0], gp[1]);
          p.x = pp[0];
          p.y = pp[1];
          c.after(31, () => {
            w.ships = w.ships.filter((s) => s !== marker);
            if (alive(p)) {
              p.state = 'station';
              p.hx = p.x;
              p.hy = p.y;
              p.tz = p.z;
              p.target = -1;
              p.job = 'ORBITAL GUN';
            }
          });
          c.say(`A DEFENCE PLATFORM CLIMBS OUT OF THE AIR OF ${pname}`, pp[0], limb - 30 * u, '#fca5a5');
          c.emit('platform', pp[0], pp[1], 0.4);
          return;
        }
        if (tgt.state !== 'station' || !w.director.want('broadside', 0.6, 160)) return;
        next = w.t + 120 + c.r() * 100;
        const shooters = capitals().filter((q) => q.cls === 'dreadnought' || q.cls === 'cruiser');
        const s = shooters.sort((a, b) => a.z - b.z)[0] ?? capitals()[0];
        if (!s) return;
        const t = tgt;
        c.say(`${the(s.name)} TURNS HER BROADSIDE ON ${t.name}`, s.x, s.y - lenOf(s) * 0.25, '#fde68a');
        c.speak(s, pick(['ALL BATTERIES, FIRE AS SHE BEARS', 'FULL BROADSIDE. FIRE', 'GUNS, THE PLATFORM. FIRE']));
        c.emit('broadside', s.x, s.y, 0.8);
        c.look('broadside', (s.x + t.x) / 2, (s.y + t.y) / 2, 1.3, 9, 7);
        const L0 = lenOf(s);
        const n = 10 + Math.floor(c.r() * 6);
        for (let i = 0; i < n; i++) {
          c.after(i * 0.22, () => {
            if (!alive(s)) return;
            const x0 = s.x + s.dir * (-0.4 + (i / n) * 0.8) * L0;
            const b = c.fire(s, alive(t) ? t : null, i % 3 === 2 ? 'beam' : 'heavy', { hit: i > n * 0.5, dmg: 3, x1: t.x, y1: t.y, z1: t.z });
            if (b) {
              b.x0 = x0;
              b.y0 = s.y - L0 * 0.03;
            }
            c.fx('muzzle', x0, s.y - L0 * 0.03, s.z, { dur: 0.3, r: L0 * 0.08, color: '#fff2c8' });
          });
        }
        c.after(n * 0.22 + 1.5, () => {
          if (alive(t)) {
            t.hp = 0;
            c.boom(t, false);
          }
          c.chronicle(`${theT(s.name)} fired her full broadside and broke ${titled(t.name)} in pieces.`);
          c.say(`${t.name} BREAKS APART`, t.x, t.y - 40 * u, '#fca5a5');
        });
        // It answers, while it can.
        t.target = s.id;
      },
    };
  }

  function bombardSystem(c: Ctx): SystemInstance {
    const w = c.world;
    return {
      id: 'bombard',
      step() {
        // The admiral loses patience: when runners keep getting through, or in answer to the planet's anger.
        if (w.t < 120 || w.alarm || w.war.stage !== 'calm' || !(w.war.resolve < 0.5 || w.war.anger > 0.7) || !w.director.want('bombard', 0.7, 260)) return;
        const s = capitals().filter((q) => q.cls === 'dreadnought' || q.cls === 'cruiser').sort((a, b) => a.z - b.z)[0];
        if (!s) return;
        // Somewhere on the night side if there is one, a little way below the limb.
        let best: [number, number] | null = null;
        let bestD = 1;
        for (let k = 0; k < 12; k++) {
          const gp = groundPoint();
          if (!gp) continue;
          const p = surf(gp[0], gp[1]);
          const n: V3 = [(p[0] - cx) / R, (p[1] - cy) / R, p[2]];
          const d = dot(n, w.L);
          if (d < bestD) {
            bestD = d;
            best = gp;
          }
        }
        if (!best) return;
        const [lat0, lon0] = best;
        const n = 8 + Math.floor(c.r() * 7);
        const p0 = surf(lat0, lon0);
        c.say(`THE ADMIRAL ORDERS FIRE ON ${pname}`, p0[0], p0[1] - 60 * u, '#fca5a5');
        c.speak(s, pick(['FIRE MISSION AUTHORIZED', 'GUNS, YOU HAVE THE TARGETS', 'THEY WERE WARNED']));
        c.after(7, () => {
          c.say(`${the(s.name)} OPENS FIRE ON THE SURFACE`, p0[0], p0[1] - 60 * u, '#fca5a5');
          c.speak(s, pick(LINES.bombard));
        });
        war({ anger: 0.3, resolve: 0.25 });
        c.emit('bombard', p0[0], p0[1], 0.9);
        c.look('bombard', p0[0], p0[1] - GH * 0.05, 1.5, 14, 8);
        for (let i = 0; i < n; i++) {
          c.after(7 + i * (0.6 + c.r() * 0.6), () => {
            if (!alive(s)) return;
            const lat = lat0 + (c.r() - 0.5) * 0.03;
            const lon = lon0 + (c.r() - 0.5) * 0.05;
            const p = surf(lat, lon);
            c.fire(s, null, c.r() < 0.5 ? 'beam' : 'heavy', { x1: p[0], y1: p[1], z1: 1.4, lat, lon, dur: 0.6 + c.r() * 0.3 });
          });
        }
        c.chronicle(`${theT(s.name)} bombarded the surface of ${titled(pname)}; the fires burned through the night.`);
      },
    };
  }

  function flareSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let auroraT = -1;
    let auroraEnd = -1;
    return {
      id: 'flare',
      step(dt) {
        if (auroraT > 0) {
          if (w.t > auroraT && w.t < auroraEnd) w.aurora = Math.min(1, w.aurora + dt / 15);
          else if (w.t >= auroraEnd) w.aurora = Math.max(0, w.aurora - dt / 25);
          if (w.t > auroraT && w.t - auroraT < dt * 1.5) {
            c.say(`AURORA OVER ${pname}: THE FLARE REACHES THE AIR`, GW / 2, limb - 50 * u, '#a7f3d0');
            c.emit('aurora', GW / 2, limb, 0.5);
            c.look('aurora', GW / 2, limb, 1.3, 12, 6);
          }
          if (w.t > auroraEnd + 30) auroraT = -1;
          return;
        }
        if (w.t < 80 || w.alarm || !w.director.want('flare', 0.55, 420)) return;
        w.flare = 1;
        w.static = 1;
        auroraT = w.t + 18 + c.r() * 10;
        auroraEnd = auroraT + 70 + c.r() * 40;
        c.say(`${w.star.label.replace(/^AN? /, 'THE ')} FLARES. SENSORS WHITE ACROSS THE LINE`, w.sun.up ? clamp(w.sun.x, GW * 0.2, GW * 0.8) : GW / 2, GH * 0.25, '#fef3c7');
        c.emit('flare', GW / 2, GH * 0.2, 0.8);
        for (const s of capitals().slice(0, 2)) c.after(1 + c.r() * 3, () => c.speak(s, pick(LINES.flare)));
        c.chronicle(`The star flared; for a minute the whole line was blind, and then the aurora came up over ${titled(pname)}.`);
      },
    };
  }

  function eclipseSystem(c: Ctx): SystemInstance {
    const w = c.world;
    return {
      id: 'eclipse',
      step() {
        if (w.eclipse) {
          if (w.t - w.eclipse.t0 > w.eclipse.dur) w.eclipse = null;
          return;
        }
        // Only while the face toward us is lit.
        if (w.t < 60 || w.L[2] < 0.25 || !moons.length || !w.director.want('eclipse', 0.5, 600)) return;
        const mo = pick(moons);
        const dir = c.r() < 0.5 ? 1 : -1;
        const yA = limb + (GH - limb) * (0.15 + c.r() * 0.4);
        const yB = limb + (GH - limb) * (0.15 + c.r() * 0.4);
        w.eclipse = { t0: w.t, dur: 80, x0: dir > 0 ? -GW * 0.15 : GW * 1.15, y0: yA, x1: dir > 0 ? GW * 1.15 : -GW * 0.15, y1: yB, r: Math.max(70, mo.r * 4.5) * u + R * 0.05 };
        c.say(`THE SHADOW OF ${mo.name} CROSSES THE FACE OF ${pname}`, GW / 2, limb + 40 * u, '#e9d5ff');
        c.emit('eclipse', GW / 2, limb, 0.6);
        c.chronicle(`An eclipse: the shadow of ${titled(mo.name)} crossed ${titled(pname)}, and the cities lit under it.`);
      },
    };
  }

  function convoySystem(c: Ctx): SystemInstance {
    const w = c.world;
    return {
      id: 'convoy',
      step() {
        if (w.t < 90 || w.alarm || !w.director.want('convoy', 0.45, 300)) return;
        const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
        const z = 0.45 + c.r() * 0.3;
        const y = skyY(z);
        const n = 3 + Math.floor(c.r() * 2);
        const tgt = capitals()[0];
        for (let i = 0; i < n; i++) {
          c.after(i * 2.5, () => {
            const s = c.ship('freighter', 'merchant', entryX(dir, 200 * u), y + (c.r() - 0.5) * 30 * u, z + (c.r() - 0.5) * 0.05, { state: 'transit', dir, tx: GW / 2 + dir * (i - n / 2) * 140 * u, ty: y + (c.r() - 0.5) * 30 * u, tz: z, job: 'CONVOY · HELD BY ORDER', tag: 'in' });
            if (i === 0) c.after(5, () => c.speak(s, pick(LINES.merchant)));
          });
        }
        c.say(`A CONVOY OF ${n} COMES UP TO THE LINE, AND IS ORDERED TO HOLD`, GW / 2, y - 50 * u, '#e8d0b0');
        c.emit('convoy', GW / 2, y, 0.5);
        if (tgt) c.after(6, () => c.speak(tgt, 'CONVOY, HEAVE TO. YOU WILL BE INSPECTED IN TURN'));
      },
    };
  }

  function groundSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let victim: Ship | null = null;
    let wake = 0;
    return {
      id: 'groundfire',
      step() {
        if (victim) {
          if (w.t > wake) {
            const v = victim;
            victim = null;
            if (!alive(v)) return;
            if (c.r() < 0.7) {
              v.dark = false;
              v.state = 'station';
              v.hx = v.x;
              v.hy = v.y;
              v.job = 'ON STATION';
              c.say(`POWER IS RESTORED ON ${the(v.name)}`, v.x, v.y - lenOf(v) * 0.2, '#bbf7d0');
              c.speak(v, 'MAIN POWER RESTORED. RESUMING STATION');
              c.emit('restored', v.x, v.y, 0.3);
            } else {
              v.state = 'dying';
              v.t0 = w.t;
              v.dur = 5;
              v.hp = 0.001;
              w.tally.lost++;
              c.say(`${the(v.name)}'S REACTOR GOES CRITICAL`, v.x, v.y - lenOf(v) * 0.2, '#fca5a5');
              c.chronicle(`${theT(v.name)}, struck from the ground, never got her power back; her reactor went.`);
            }
          }
          return;
        }
        if (w.t < 200 || w.alarm || w.war.anger < 0.45 || w.war.stage !== 'calm' || !w.director.want('groundfire', 0.8, 700)) return;
        const t = capitals().filter((q) => q.z > 0.2)[0];
        const gp = groundPoint();
        if (!t || !gp) return;
        const p = surf(gp[0], gp[1]);
        w.groundGun = { lat: gp[0], lon: gp[1], t0: w.t, to: t.id };
        c.fx('flash', p[0], p[1], 1.4, { dur: 1.2, r: 120 * u, color: '#bfe0ff' });
        c.say(`GROUND FLASH! THE GREAT GUN OF ${pname} FIRES`, p[0], p[1] - 40 * u, '#bfdbfe');
        c.emit('groundfire', p[0], p[1], 1);
        c.look('groundfire', (p[0] + t.x) / 2, (p[1] + t.y) / 2, 1.3, 12, 9);
        c.after(0.8, () => {
          if (!alive(t)) return;
          t.dark = true;
          t.state = 'disabled';
          t.vx = (c.r() - 0.5) * 4 * u;
          t.vy = 0;
          t.hp = Math.max(1, t.hp - 10);
          t.shieldT = w.t;
          t.job = 'DEAD IN SPACE';
          for (let k = 0; k < 6; k++) c.fx('spark', t.x + (c.r() - 0.5) * lenOf(t) * 0.6, t.y, t.z, { dur: 1.2, r: 20 * u * mOf(t.z), color: '#bfe0ff', vx: (c.r() - 0.5) * 60 * u, vy: (c.r() - 0.5) * 30 * u });
          c.say(`${the(t.name)} IS HIT, AND GOES DARK`, t.x, t.y - lenOf(t) * 0.2, '#fca5a5');
          c.speak(t, pick(LINES.disabled));
          c.chronicle(`The great gun of ${titled(pname)} fired once and put out every light on the ${titled(t.name)}.`);
          victim = t;
          wake = w.t + 50 + c.r() * 40;
          // The line answers: fire on the gun.
          const s = capitals().find((q) => q !== t);
          if (s) for (let i = 0; i < 6; i++) c.after(3 + i * 0.7, () => {
            const pp = surf(gp[0] + (c.r() - 0.5) * 0.02, gp[1] + (c.r() - 0.5) * 0.03);
            c.fire(s, null, 'heavy', { x1: pp[0], y1: pp[1], z1: 1.4, lat: gp[0], lon: gp[1] });
          });
        });
        c.after(3, () => {
          w.groundGun = null;
        });
      },
    };
  }

  function flagshipSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let flag: Ship | null = null;
    return {
      id: 'flagship',
      step() {
        if (flag) {
          if (!alive(flag) || flag.state === 'dead') {
            flag = null;
            return;
          }
          if (flag.state === 'transit' && Math.abs(flag.x - flag.tx) < 30 * u) {
            flag.state = 'jumpout';
            flag.t0 = w.t;
            c.say(`${the(flag.name)} JUMPS AWAY`, flag.x, flag.y - lenOf(flag) * 0.2, '#e9d5ff', 1);
            c.emit('jumpout', flag.x, flag.y, 0.6);
          }
          return;
        }
        if (w.t < 420 || w.alarm || !w.director.want('flagship', 0.95, 1800)) return;
        const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
        const z = phone ? 0.25 : 0.13 + c.r() * 0.06;
        const y = GH * (0.2 + c.r() * 0.12);
        flag = jumpIn('flagship', 2, { x: dir > 0 ? GW * 0.05 : GW * 0.95, y, z });
        flag.dir = dir;
        flag.state = 'transit';
        flag.tx = dir > 0 ? GW + 900 * u : -900 * u;
        flag.ty = y;
        flag.tz = z;
        flag.speed = 14;
        flag.job = 'THE FLAGSHIP · PASSING DOWN THE LINE';
        c.say(`${the(flag.name)}, FLAGSHIP OF ${w.fleet.short}, PASSES DOWN THE LINE`, GW / 2, y + 120 * u, '#e9d5ff');
        c.emit('flagship', GW / 2, y, 1);
        for (const s of capitals()) c.after(2 + c.r() * 4, () => c.speak(s, pick(['ALL HANDS, SALUTE', 'MAN THE RAILS', 'HONOURS TO THE FLAG'])));
        c.chronicle(`${theT(flag.name)}, flagship of ${titled(w.fleet.short)}, passed down the line; every ship saluted.`);
      },
    };
  }

  function salvageSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let crew: Ship | null = null;
    return {
      id: 'salvage',
      step() {
        if (crew) {
          if (!alive(crew)) {
            crew = null;
            return;
          }
          const wk = w.wrecks.find((q) => q.id === crew!.target);
          if (crew.state === 'transit' && wk && Math.hypot(crew.x - crew.tx, crew.y - crew.ty) < 12 * u) {
            crew.state = 'hold';
            crew.t0 = w.t;
            crew.job = 'SALVAGE · CUTTING';
          }
          if (crew.state === 'hold' && wk) {
            crew.x += wk.vx * (1 / 30);
            crew.y += wk.vy * (1 / 30);
            if (c.r() < 0.25) c.fx('weld', crew.x + (c.r() - 0.5) * 30 * u * mOf(crew.z), crew.y + 10 * u * mOf(crew.z), crew.z, { dur: 0.3, r: 5 * u, color: '#ffe8b0', vx: (c.r() - 0.5) * 30 * u, vy: (c.r() - 0.5) * 30 * u });
          }
          if ((crew.state === 'hold' && w.t - crew.t0 > 40) || (!wk && crew.state !== 'leave')) {
            crew.state = 'leave';
            crew.tx = entryX(crew.x > GW / 2 ? 1 : -1, 400 * u);
            crew.job = 'SALVAGE · HOME WITH IT';
            c.chronicle(`Salvage crews cut what they could from a wreck before it fell.`);
          }
          return;
        }
        const wk = w.wrecks.find((q) => q.fall === 0 && w.t - q.t0 > 40);
        if (!wk || w.alarm || !w.director.want('salvage', 0.3, 200)) return;
        const dir: 1 | -1 = wk.x > GW / 2 ? 1 : -1;
        crew = c.ship('tender', 'fleet', entryX(dir, 300 * u), wk.y, wk.z, { state: 'transit', tx: wk.x + 30 * u, ty: wk.y + 20 * u * mOf(wk.z), tz: wk.z - 0.02, target: wk.id, job: 'SALVAGE · TO THE WRECK', tag: 'salvage' });
        c.say(`A SALVAGE TENDER GOES OUT TO THE WRECK OF ${the(wk.name)}`, wk.x, wk.y - 40 * u, '#e8eef8', 1);
        c.emit('salvage', wk.x, wk.y, 0.3);
      },
    };
  }

  function defectSystem(c: Ctx): SystemInstance {
    const w = c.world;
    let ship: Ship | null = null;
    let chasers: Ship[] = [];
    return {
      id: 'defection',
      step() {
        if (ship) {
          const s = ship;
          if (alive(s) && s.state !== 'dead') return;
          if (s.hp <= 0) {
            c.say(`${the(s.name)} IS DESTROYED BY HER OWN FLEET`, s.x, s.y - 40 * u, '#fca5a5');
            c.chronicle(`${theT(s.name)} broke from the line to go over to ${titled(pname)}, and was fired on by her own.`);
          } else {
            c.say(`${the(s.name)} REACHES THE AIR OF ${pname}. SHE HAS GONE OVER`, GW / 2, limb - 40 * u, '#fde68a');
            c.chronicle(`${theT(s.name)} mutinied, broke from the line and went down to ${titled(pname)}.`);
            war({ resolve: -0.15, stores: 0.05 });
          }
          for (const q of chasers) if (alive(q)) back(q);
          for (const q of w.ships) if (q.target === s.id) q.target = -1;
          chasers = [];
          ship = null;
          w.alarm = 0;
          return;
        }
        if (w.t < 300 || w.alarm || w.war.resolve > 0.4 || w.war.stage !== 'calm' || !w.director.want('defection', 0.8, 1500)) return;
        const f = w.ships.filter((q) => q.side === 'fleet' && q.cls === 'frigate' && q.state === 'patrol' && q.x > GW * 0.1 && q.x < GW * 0.9)[0];
        const gp = groundPoint();
        if (!f || !gp) return;
        Object.assign(f, { side: 'runner', tag: 'defect', state: 'dash', lat: gp[0], lon: gp[1], sx: f.x, sy: f.y, sz: f.z, dur: 34, t0: w.t, job: 'DEFECTING', target: -1 });
        ship = f;
        w.alarm = w.t;
        w.alarmWhy = 'A DEFECTION';
        c.say(`${the(f.name)} BREAKS FROM THE LINE AND RUNS FOR ${pname}`, f.x, f.y - 40 * u, '#fca5a5');
        c.speak(f, pick(['WE WON\'T DO IT. WE\'RE GOING DOWN TO THEM', 'THIS IS THE LAST ORDER WE TAKE', 'TELL THE ADMIRAL WE\'RE SORRY']));
        c.emit('defection', f.x, f.y, 0.9);
        c.look('defection', f.x, f.y, 1.5, 12, 8);
        const cap = capitals()[0];
        if (cap) c.after(2, () => c.speak(cap, pick(['HEAVE TO, OR WE FIRE', 'STOP HER', 'SHE\'S RUNNING. GUNS, TAKE HER'])));
        chasers = w.ships.filter((q) => q.side === 'fleet' && q.cls === 'frigate' && q.state === 'patrol' && alive(q)).slice(0, 2);
        for (const q of chasers) Object.assign(q, { state: 'chase', target: f.id, job: 'CHASING THE DEFECTOR' });
        for (const q of capitals()) if (c.r() < 0.5) q.target = f.id;
      },
    };
  }

  // ---- the radio ---------------------------------------------------------------------------------------------
  let nextVoice = 3;
  function voices(dt: number) {
    nextVoice -= dt;
    if (nextVoice > 0) return;
    nextVoice = 4 + r() * 6;
    const quiet = world.ships.filter((s) => alive(s) && world.t - s.lineT > 14 && s.cls !== 'platform' && s.name !== 'MARKER' && s.x > 0 && s.x < GW);
    if (!quiet.length) return;
    if (world.static > 0.3) {
      const s = pick(quiet);
      speak(s, pick(['...SAY AGAIN, YOU ARE BREAKING UP...', '...STATIC ON ALL CHANNELS...', '...NOTHING BUT NOISE...']), 0.5);
      return;
    }
    const s = pick(quiet);
    const line =
      s.side === 'merchant' ? pick(LINES.merchant)
        : s.cls === 'fighter' ? pick(LINES.fighter)
          : s.cls === 'shuttle' ? pick(LINES.shuttle)
            : s.cls === 'tender' ? pick(LINES.tender)
              : s === picket ? pick(LINES.inspect)
                : s.state === 'patrol' ? pick(LINES.patrol)
                  : s.side === 'home' ? pick(LINES.home)
                    : s.side === 'runner' ? pick(LINES.runner)
                      : world.alarm ? pick(LINES.battle) : pick(LINES.station);
    speak(s, line, 0);
  }

  // ---- a touch -----------------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 2.5) return null;
    lastNudge = world.t;
    const ll = latLon(x, y);
    if (ll) {
      const caps = capitals();
      if (!caps.length) return null;
      const c = caps.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      const s = spawn('shuttle', 'fleet', c.x, c.y + lenOf(c) * 0.06, c.z, { state: 'descend', lat: ll[0], lon: ll[1], sx: c.x, sy: c.y + lenOf(c) * 0.06, sz: c.z, dur: 26, job: 'DOWN TO THE MARK', dir: x > c.x ? 1 : -1 });
      const line = `${s.name}, CLEARED DOWN TO THAT GRID`;
      speak(c, line);
      say(`${the(c.name)} SENDS ${s.name} DOWN TO THE MARK`, x, y - 30 * u, '#d8e4f0');
      emit('shuttle', x, y, 0.3);
      return line;
    }
    const w = wings.find((q) => q.side === 'fleet' && q.out);
    if (w) {
      w.cx = clamp(x, GW * 0.05, GW * 0.95);
      w.cy = clamp(y, GH * 0.08, limb);
      w.until = Math.max(w.until, world.t + 30);
      fx('flash', x, y, w.z, { dur: 0.6, r: 30 * u, color: '#cfe8ff' });
      const line = `${w.name}, INVESTIGATE THAT CONTACT`;
      say(line, x, y - 30 * u, '#d8e4f0');
      emit('vector', x, y, 0.3);
      const lead = world.ships.find((q) => q.home === w.id && q.slot === 0);
      if (lead) after(1.5, () => speak(lead, 'COPY. VECTORING NOW'));
      return line;
    }
    const f = world.ships.filter((s) => s.side === 'fleet' && s.cls === 'frigate' && s.state === 'patrol')[0];
    if (f) {
      f.tx = x;
      const line = `${f.name}, CHECK THAT CONTACT`;
      say(line, x, y - 30 * u, '#d8e4f0');
      emit('vector', x, y, 0.3);
      return line;
    }
    return null;
  }

  // ---- the campaign: stores run down, anger builds, resolve wears and is restored ------------------------
  const day0 = world.war.day;
  function campaign(dt: number) {
    const w = world.war;
    w.stores = clamp(w.stores - dt * 0.0005, 0, 1);
    w.anger = clamp(w.anger + dt * 0.0009 * (1 - w.stores) - (w.anger > 0.3 ? dt * 0.0004 : 0), 0, 1);
    w.resolve = clamp(w.resolve + (0.7 - w.resolve) * dt * 0.002, 0, 1);
    w.day = day0 + Math.floor(world.t / orbitT);
    if (w.stage === 'aftermath' && world.t - w.stageT > 100) w.stage = 'calm';
  }
  const war = (d: Partial<Record<'stores' | 'anger' | 'resolve', number>>) => {
    const w = world.war;
    if (d.stores) w.stores = clamp(w.stores + d.stores, 0, 1);
    if (d.anger) w.anger = clamp(w.anger + d.anger, 0, 1);
    if (d.resolve) w.resolve = clamp(w.resolve + d.resolve, 0, 1);
  };

  function step(dt: number) {
    world.t += dt;
    campaign(dt);
    world.director.step(world.t, dt);
    for (let i = later.length - 1; i >= 0; i--)
      if (world.t >= later[i].at) {
        const { fn } = later[i];
        later.splice(i, 1);
        fn();
      }
    sky(dt);
    move(dt);
    guns();
    orbitals(dt);
    shuttles();
    merchants();
    station(dt);
    wingsStep(dt);
    reinforce(dt);
    for (const s of systems) s.step?.(dt);
    voices(dt);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
