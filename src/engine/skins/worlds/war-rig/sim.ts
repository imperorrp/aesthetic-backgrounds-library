/**
 * # War Rig: a tanker truck runs across the wasteland with a war party of hot rods on its tail.
 *
 * On screen, at a glance: the rig (an armoured tractor hauling a great tank, gunners on its back)
 * side-on in the middle of the road; spiked hot rods, ram trucks and buggies jockeying around it
 * in a cloud of dust; a polecat swinging a boarder over the tank on a long pole; the war drums on
 * the music truck behind, its guitarist spitting flame; the salt flats running away under it all
 * toward rock towers on the horizon, under a blazing orange sun (or a big blue moon).
 * The camera: riding alongside the convoy; the ground runs away to the left, the whole chase in frame.
 *
 * Always happening (the floor):
 * - The convoy rolls: wheels turning, suspension bouncing, dust from every wheel, the ground
 *   and the far planes sliding by at their depths; the pursuers change places, pull alongside,
 *   fall back.
 * - Gunfire both ways; explosive lances thrown at the tank and the rig's own lances thrown back;
 *   rams; a car hit enough goes over, burns, and its wreck slides away behind; a new one comes up
 *   from behind to take its place. Shouted lines from every cab.
 *
 * The cast (each seed draws some; tag them):
 * - poles [war] polecats: cars with long sway poles, boarders swung onto the tank and fought off.
 * - howler [war] the music truck: a wall of speakers, drummers, a guitarist on a bungee spitting flame.
 * - crusher [war] a tank on monster-truck wheels that shells the rig.
 * - porcupine [war] spiked beetles that scrape along the rig's flank.
 * - buggies [war] buggies in threes, fast and thin-skinned.
 * - storm [weather] a toxic storm: a wall of orange dust, lightning, cars flung skyward.
 * - canyon [terrain] a canyon ambush: bikers on the rim, jumping over the rig, dropping bombs.
 * - bog [terrain] a night crossing of a bog: the convoy slows, pursuers bog down and sink; stilt folk in the mist.
 * - rivals [threat] a rival clan cuts in from ahead and fights everyone for the tank.
 * - warlord [legendary] the warlord rides out himself on his throne-car.
 * Quotas: 4–7 in all; 2–4 war; 0–1 weather; 0–2 terrain; 0–1 threat.
 *
 * Events: common: a lance, a burst of fire, a boarder, a car going over and exploding (every
 * minute or so); uncommon: the tank holed and leaking, a ram, the storm, the canyon, the bog,
 * rivals; rare: the lull at dawn and the regroup, the music truck wrecked; legendary: the warlord.
 * What keeps it going: wrecks are left behind and new pursuers come up from behind; the tank is
 * patched; the road runs from flats to dunes to towers to canyon and on; days and nights pass.
 * What changes with the seed: the grade (orange-and-teal, crimson, umber, chrome), the rig and its
 * driver, the warlord and his clan, the rivals, the cargo (fuel or water), the cast, the road.
 * A touch: on the road, the rig's lancer throws at the car nearest the touch (or a flare goes up).
 * Phone: the same chase, smaller; fewer pursuers.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import type { Clan, Ctx, Fx, FxKind, Grade, Kind, Missile, MissileKind, Phase, Region, Rig, Title, Vehicle, VState, WarOptions, WarWorld } from './types';

/** What each kind of vehicle is: length and height in vehicle units, how much it takes, how fast it closes. */
export const KINDS: Record<Kind, { L: number; H: number; hp: number; speed: number; crew: number; gun: boolean; lance: boolean; label: string }> = {
  hotrod: { L: 76, H: 32, hp: 3, speed: 110, crew: 2, gun: false, lance: true, label: 'HOT ROD' },
  porcupine: { L: 64, H: 40, hp: 4, speed: 92, crew: 2, gun: false, lance: true, label: 'PORCUPINE' },
  polecat: { L: 86, H: 36, hp: 3, speed: 96, crew: 3, gun: false, lance: false, label: 'POLECAT' },
  howler: { L: 156, H: 92, hp: 14, speed: 70, crew: 6, gun: false, lance: false, label: 'WAR DRUMS' },
  crusher: { L: 108, H: 72, hp: 10, speed: 72, crew: 3, gun: true, lance: false, label: 'MONSTER TANK' },
  bike: { L: 40, H: 30, hp: 1, speed: 150, crew: 2, gun: false, lance: true, label: 'BIKE' },
  buggy: { L: 58, H: 32, hp: 2, speed: 135, crew: 2, gun: true, lance: false, label: 'BUGGY' },
  ram: { L: 96, H: 44, hp: 5, speed: 86, crew: 3, gun: false, lance: true, label: 'RAM TRUCK' },
  throne: { L: 132, H: 84, hp: 20, speed: 70, crew: 4, gun: true, lance: true, label: 'THE WARLORD\'S CAR' },
  drifter: { L: 88, H: 40, hp: 12, speed: 120, crew: 1, gun: true, lance: true, label: 'A DRIFTER' },
};
/** The rig: tractor and tank, in vehicle units. */
export const RIG = { L: 300, H: 96, tank0: -150, tank1: 40, cab: 112 };

const RIGS = ['THE IRON SOW', 'MOTHER LODE', 'OLD THIRST', 'THE GUZZLING SAINT', 'BIG HEIFER', 'THE LONG MERCY', 'THE WIDOW\'S DOWRY', 'SAINT DIESEL', 'THE BLACK MARY', 'GRANDMOTHER TANK'];
const DRIVERS = ['HAULMASTER ODRA', 'HAULMASTER KESS', 'CAPTAIN VELL', 'HAULMASTER JUNE CARDAN', 'OLD MOTHER ASH', 'HAULMASTER RIX', 'HAULMASTER TOMAS GRAY', 'HAULMASTER IDA PELL'];
const WARLORDS = ['THE CARBURETTOR KING', 'BARON SUMP', 'LORD PISTONHEART', 'THE OLD CHROME', 'GRANDDAD GASKET', 'THE BLOWER PRINCE', 'THE GREASE BISHOP', 'KING CAMSHAFT'];
const PARTIES = ['THE CHALK BOYS', 'THE PISTONLINGS', 'THE SUMP KIN', 'THE GASKET LADS', 'THE TAILPIPE CHOIR', 'THE SPARK CHILDREN'];
const HOMES = ['THE WELLHEAD', 'THE STACKS', 'THE OIL CHAPEL', 'THE SUMP', 'THE IRON TEAT', 'THE DERRICK'];
const BOUNDS = ['THE GREEN WELL', 'THE SALT CHAPEL', 'THE FAR PUMP', 'THE LAST ORCHARD', 'THE BLUE WATER', 'THE COLD SPRINGS'];
const RIVALS = ['THE RUSTBACKS', 'THE SCRAPJAW CLAN', 'THE TIN SAINTS', 'THE RED AXLES', 'THE BONE SHAKERS'];
const RAVENS = ['THE CANYON RAVENS', 'THE CLIFF DOGS', 'THE ROCKFALL BOYS', 'THE HIGH WHEELS'];
const STILTS = ['THE STILT FOLK', 'THE MUD CROWS', 'THE LONG-LEGS'];
const NAMES: Record<Kind, string[]> = {
  hotrod: ['SNAKE EYES', 'THE KNUCKLE', 'BLOWFLY', 'HELLCAT', 'THE SPOON', 'RED DEVIL', 'GASSER', 'CHROME BABY', 'LUCKY BONES', 'THE SKILLET', 'WIDOWMAKER', 'HOT JOHNNY'],
  porcupine: ['THE HEDGEHOG', 'PINCUSHION', 'THISTLE', 'THE URCHIN', 'BRAMBLE'],
  polecat: ['THE STORK', 'LONG JIM', 'SWING LOW', 'THE HERON', 'HIGH HANG', 'THE CRANE'],
  howler: ['THE HOWLER', 'THE BIG NOISE', 'THE CHOIR', 'THUNDERBOX'],
  crusher: ['THE BIGFOOT', 'CRUSHER', 'MOUNTAIN', 'THE GRINDER'],
  bike: ['RAVEN'],
  buggy: ['SKIPJACK', 'MOSQUITO', 'SCAMP', 'THE FLEA', 'GADFLY', 'DUNE RAT', 'SPARROWHAWK'],
  ram: ['THE BULL', 'BATTERHEAD', 'IRONJAW', 'THE PLOUGH', 'OLD BRICK'],
  throne: ['THE THRONE'],
  drifter: ['THE DRIFTER'],
};
const REGION_NAMES: Record<Region, string[]> = {
  flats: ['THE SALT PAN', 'THE WHITE FLATS', 'THE CRACKED MILE', 'THE DRY LAKE'],
  dunes: ['THE DUNE SEA', 'THE ORANGE DUNES', 'THE DRIFTS'],
  towers: ['THE TOWERS', 'THE STONE FOREST', 'THE NEEDLES'],
  canyon: ['THE GUT', 'THE RAVEN PASS', 'THE NARROWS'],
  bog: ['THE BLACK BOG', 'THE SINKING MILE', 'THE MIRE'],
};
const LINES = {
  party: ['FULL THROTTLE INTO GLORY!', 'SEE ME FLY!', 'I GO TO THE BIG GARAGE!', 'CHROME AND THUNDER!', 'BURN BRIGHT, BURN LOUD!', 'SING ME INTO THE ENGINE!', 'THE ROAD REMEMBERS!', 'GIVE ME THE JUICE!', 'THE TANK IS OURS!', 'LOUDER! LOUDER!', 'POUR IT ON!', 'REMEMBER MY NAME!', 'HOLD THE LINE, BOYS!', 'ALL THE WAY TO THE WELL!'],
  rig: ['KEEP HER STEADY!', 'TWO ON THE LEFT!', 'GUNNER, THE POLECAT!', 'SHE\'S HOLDING', 'MORE COMING UP BEHIND', 'EYES ON THE HORIZON', 'FLOOR IT', 'NOBODY TOUCHES THE TANK', 'LANCE! GET DOWN!', 'GOOD SHOT!', 'HOLD ON TO SOMETHING', 'WATCH THE FLANK', 'RELOAD! RELOAD!', 'NOT TODAY'],
  rival: ['THAT TANK IS OURS, SUMP RATS!', 'CUT THEM OFF!', 'TAKE THE RIG, BURN THE REST!', 'RUST AND RUIN!', 'OUT OF OUR ROAD!'],
  ravens: ['FROM THE ROCKS!', 'DROP THEM! DROP THEM!', 'RAVENS, FLY!', 'OVER THE TOP!', 'HIT THE TANK!'],
  board: ['BOARDER ON THE TANK!', 'GET HIM OFF!', 'HE\'S ON THE CATWALK!'],
  hit: ['WE\'RE HIT!', 'SHE\'S BURNING ON THE LEFT!', 'PLATES ARE HOLDING!', 'THAT ONE RANG THE TANK'],
};
const ONES = ['TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'NINE', 'TEN', 'TWELVE'];
export const GRADE_LABEL: Record<Grade, string> = { blaze: 'orange and teal', crimson: 'the red waste', umber: 'the brown waste', chrome: 'black and chrome' };

const DAY_LEN = 900;

export function createWarRig(seed: string | number, W: number, H: number, opts: WarOptions): WarWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'rig');
  const shotR: Rng = forkRng(seed, 'rig-shots');
  const g: Genome = createGenome(seed, 'rig');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const phone = GW < GH;
  const traffic = Math.max(0.3, Math.min(2.5, opts.traffic));
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];
  let ids = 1;

  const grade = g.weighted<Grade>({ blaze: 6, crimson: 3, umber: 2, chrome: 1 });
  const HY = Math.round(GH * (phone ? g.range(0.42, 0.5) : g.range(0.34, 0.47)));
  const ground = GH - HY;
  const A = ground * (phone ? 0.3 : 0.36);
  const DB = phone ? ground * 0.42 : Math.min(ground * 0.44, 300 * u);
  const VS = phone ? 2.4 : 2.85;
  const mOf = (z: number) => Math.max(0.02, (A + DB * z) / (A + DB));
  const yOf = (z: number) => HY + A + DB * z;
  const sOf = (z: number) => u * VS * mOf(z);
  /** Ground units per vehicle unit (altitudes are in ground units). */
  const U = u * VS;
  const V0 = 330 * u;
  const G = 520 * u;
  const regionWeights = { flats: g.range(1, 4), dunes: g.range(1, 4), towers: g.range(1, 4) };
  const names = {
    warlord: g.pick(WARLORDS), party: g.pick(PARTIES), home: g.pick(HOMES), bound: g.pick(BOUNDS),
    rivals: g.pick(RIVALS), ravens: g.pick(RAVENS), stilts: g.pick(STILTS),
  };
  const regionNames = Object.fromEntries((Object.keys(REGION_NAMES) as Region[]).map((k) => [k, g.pick(REGION_NAMES[k])])) as Record<Region, string>;
  const firstRegion = g.weighted<'flats' | 'dunes' | 'towers'>(regionWeights);
  const rigX = GW * (phone ? 0.56 : g.range(0.56, 0.64));
  const LANDMARKS = ['derricks', 'pylons', 'arch', 'ship', 'statue', 'dish'];
  const rig: Rig = {
    name: g.pick(RIGS), driver: g.pick(DRIVERS), cargo: g.chance(0.6) ? 'fuel' : 'water', variant: g.chance(0.6) ? 'tanker' : 'twin', marks: [], kills: 0,
    x: rigX, z: 0.5, hp: 100, load: g.range(0.7, 0.95), leak: 0, leakAt: 0, leakT: 0, boarders: [],
    crew: [
      { role: 'driver', at: 92, up: 56, seed: Math.floor(g.unit() * 1e6), t0: 0, aim: 0 },
      { role: 'gunner', at: -48, up: 104, seed: Math.floor(g.unit() * 1e6), t0: 0, aim: 0 },
      { role: 'gunner', at: -138, up: 84, seed: Math.floor(g.unit() * 1e6), t0: 0, aim: 0 },
      { role: 'lancer', at: 6, up: 98, seed: Math.floor(g.unit() * 1e6), t0: 0, aim: 0 },
      ...(phone ? [] : [{ role: 'lookout' as const, at: -96, up: 100, seed: Math.floor(g.unit() * 1e6), t0: 0, aim: 0 }]),
    ],
    knock: 0, horn: 0, line: '', lineT: -99,
  };

  // eslint-disable-next-line prefer-const
  let world: WarWorld;
  world = {
    t: 0, W, H, GW, GH, u, bus,
    director: createDirector(forkRng(seed, 'rig-director'), { arc: g.pick(ARCS), period: g.range(300, 600), floor: 0.3, establish: () => establish() }),
    grade, cast: [], castIds: [], names,
    day: g.pick([0.31, 0.38, 0.45, 0.55, 0.63, 0.69, 0.9]) + g.range(-0.02, 0.02), dayLen: DAY_LEN,
    HY, A, DB, VS, yOf, mOf, sOf,
    V: V0, dist: 0, region: firstRegion, legs: [{ at: -1e9, kind: firstRegion }], regionName: regionNames[firstRegion],
    rig, vehicles: [], wrecks: [], shots: [], missiles: [], fx: [], bolts: [],
    storm: 0, stormX: GW * 1.5, flash: 0, lull: 0, chant: 0,
    km: g.range(40, 260), wrecked: 0, repelled: 0, leaks: 0,
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    labels: [], chronicle: [], titles: [], subs: [], phase: 'stalk', phaseT: 0,
    flip: g.chance(0.4), landmarks: g.subset(LANDMARKS, 1, 2), haze: g.range(0, 1),
    step, nudge,
    counts: () => ({
      pursuers: world.vehicles.filter((v) => v.state !== 'crash' && v.state !== 'flung').length,
      wrecks: world.wrecks.length,
      wrecked: world.wrecked,
      fx: world.fx.length,
      missiles: world.missiles.length,
      km: Math.round(world.km),
      load: Math.round(world.rig.load * 100),
      hp: Math.round(world.rig.hp),
      boarders: world.rig.boarders.length,
      storm: world.storm > 0.05 ? 1 : 0,
    }),
  };

  // ---- the verbs -----------------------------------------------------------------------------------
  function establish(): { x: number; y: number; zoom: number } {
    if (world && shotR() < 0.4) return { x: world.rig.x, y: yOf(0.5) - 50 * U * mOf(0.5), zoom: 1.6 };
    return { x: GW / 2, y: GH / 2, zoom: 1 };
  }
  const say = (text: string, x: number, y: number, color = '#f6e6c8') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    world.labels.push({ text, x, y, t0: world.t, color });
    if (world.labels.length > 4) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, priority: 'high' });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    if (weight >= 0.2) world.director.note(weight * 0.25);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };
  /** A shouted line: on the speaker, and as a subtitle when the screen is free for one. */
  const speak = (who: { line: string; lineT: number }, line: string, force = false) => {
    who.line = line;
    who.lineT = world.t;
    bus.emit({ type: 'shout', text: line, weight: 0.05, priority: 'low' });
    const last = world.subs[world.subs.length - 1];
    if (!force && last && world.t - last.t0 < 3.2) return;
    const v = who as Partial<Vehicle>;
    const isRig = (who as unknown) === world.rig;
    const name = isRig ? world.rig.driver : v.kind === 'throne' ? world.names.warlord : v.kind === 'howler' ? `${v.name}'S GUITARIST` : (v.name ?? '');
    world.subs.push({ who: name, text: line, t0: world.t, clan: isRig ? 'rig' : (v.clan ?? 'party') });
    if (world.subs.length > 6) world.subs.shift();
  };
  /** A title card for a big moment: one at a time, the newest wins. */
  const title = (head: string, sub: string, tone: Title['tone'] = 'fire') => {
    const last = world.titles[world.titles.length - 1];
    if (last && last.head === head && world.t - last.t0 < 30) return;
    world.titles.push({ head, sub, t0: world.t, tone });
    if (world.titles.length > 4) world.titles.shift();
  };
  const yAt = (x: number, z: number, alt = 0) => {
    void x;
    return yOf(z) - alt * mOf(z);
  };
  const look = (why: string, x: number, z: number, zoom: number, hold: number, priority: number) => world.director.look(why, x, yAt(x, z, 40 * U), zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: FxKind, x: number, z: number, alt: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 700) return;
    world.fx.push({ kind, x, z, alt, vx: 0, vz: 0, valt: 0, t0: world.t, dur: 1.5, r: 10 * u, color: '#c08050', seed: Math.floor(r() * 1e6), rot: r() * 6.28, ...extra });
  };
  /** How fast the ground runs back at depth z. */
  const back = (z: number) => -world.V * mOf(z);
  /** An explosion: the flash, the fireball, the smoke, things thrown. `grounded` ones are left behind on the road. */
  const boom = (x: number, z: number, alt: number, size: number, grounded: boolean) => {
    const drift = grounded ? back(z) : 0;
    fx('flash', x, z, alt, { dur: 0.35, r: 90 * u * size, vx: drift });
    for (let k = 0; k < Math.round(4 + size * 5); k++) fx('boom', x + (r() - 0.5) * 30 * u * size, z, alt + r() * 20 * u * size, { vx: drift + (r() - 0.5) * 60 * u * size, valt: (30 + r() * 90) * u * size, dur: 0.7 + r() * 0.7, r: (16 + r() * 22) * u * size });
    for (let k = 0; k < Math.round(3 + size * 4); k++) fx('smoke', x + (r() - 0.5) * 40 * u * size, z, alt + 20 * u * size, { vx: drift * 0.7 + (r() - 0.5) * 30 * u, valt: (25 + r() * 40) * u, dur: 2.5 + r() * 2.5, r: (18 + r() * 18) * u * size, color: '#2a2220', t0: world.t + r() * 0.4 });
    for (let k = 0; k < Math.round(4 + size * 6); k++) fx(r() < 0.6 ? 'debris' : 'spark', x, z, alt + 10 * u, { vx: drift * 0.5 + (r() - 0.5) * 320 * u * size, valt: (120 + r() * 300) * u * size, vz: (r() - 0.5) * 0.3, dur: 1 + r() * 1.2, r: (2 + r() * 4) * u * size, color: r() < 0.5 ? '#4a4038' : '#ffcc66' });
  };
  function spawn(kind: Kind, clan: Clan, extra: Partial<Vehicle> = {}): Vehicle {
    const K = KINDS[kind];
    const nm = kind === 'bike' ? `RAVEN ${pick(ONES)}` : pick(NAMES[kind]);
    const name = world.vehicles.some((v) => v.name === nm) ? `${nm} ${pick(ONES)}` : nm;
    const z = phone ? 0.1 + r() * 0.85 : 0.04 + r() * 0.94;
    const v: Vehicle = {
      id: ids++, kind, clan, name, seed: Math.floor(r() * 1e6),
      x: -K.L * sOf(z) * 0.7 - r() * 120 * u, z, vx: (60 + r() * 40) * u, tx: GW * 0.2, tz: z, state: 'arrive', t0: world.t,
      alt: 0, valt: 0, rot: 0, vrot: 0, hp: K.hp, maxHp: K.hp, crew: K.crew,
      boost: 1, gunT: world.t + 2 + r() * 3, lanceT: world.t + 4 + r() * 4, playT: world.t + 6 + r() * 8, slotT: world.t + 4 + r() * 4,
      pole: 0, poleTo: 0, boarder: kind === 'polecat', sink: 0, line: '', lineT: -99, ...extra,
    };
    world.vehicles.push(v);
    return v;
  }
  /** Throw something on an arc from (x, z, alt) to land on (tx, tz, talt) after `flight` seconds. */
  function missile(kind: MissileKind, from: Vehicle | null, x: number, z: number, alt: number, tx: number, tz: number, talt: number, flight: number, target: number) {
    const m: Missile = {
      id: ids++, kind, x, z, alt, vx: (tx - x) / flight, vz: (tz - z) / flight, valt: (talt - alt) / flight + 0.5 * G * flight,
      t0: world.t, T: flight, target, from: from ? from.id : 0, seed: Math.floor(r() * 1e6),
    };
    world.missiles.push(m);
  }
  function crash(v: Vehicle, how: 'flip' | 'blast' | 'fling') {
    if (v.state === 'crash' || v.state === 'flung') return;
    v.state = how === 'fling' ? 'flung' : 'crash';
    v.t0 = world.t;
    v.hp = 0;
    const L = KINDS[v.kind].L;
    const big = L > 120 ? 1.6 : L > 80 ? 1.2 : 1;
    if (how === 'flip') {
      v.valt = (240 + r() * 160) * u;
      v.vrot = (r() < 0.5 ? -1 : 1) * (3 + r() * 3) / big;
      v.vx = -(40 + r() * 60) * u;
      fx('spark', v.x, v.z, 4 * u, { vx: back(v.z) * 0.3, valt: 80 * u, dur: 0.6, r: 3 * u, color: '#ffd080' });
    } else if (how === 'blast') {
      boom(v.x, v.z, 20 * U, big * 1.3, false);
      v.valt = (360 + r() * 200) * u / big;
      v.vrot = (r() < 0.5 ? -1 : 1) * (4 + r() * 4) / big;
      v.vx = -(20 + r() * 80) * u;
      fx('wheel', v.x, v.z, 10 * U, { vx: (r() - 0.5) * 200 * u, valt: (300 + r() * 200) * u, dur: 2.4, r: 10 * U * (big > 1 ? 1.4 : 1), vz: (r() - 0.5) * 0.4 });
    } else {
      v.valt = (520 + r() * 260) * u / Math.sqrt(big);
      v.vrot = (r() < 0.5 ? -1 : 1) * (1.5 + r() * 2.5);
      v.vx = (r() - 0.6) * 160 * u;
    }
    world.wrecked++;
    for (let k = 0; k < v.crew; k++) if (r() < 0.6) fx('body', v.x + (r() - 0.5) * L * sOf(v.z) * 0.5, v.z, 20 * U, { vx: (r() - 0.5) * 200 * u, valt: (160 + r() * 240) * u, dur: 1.8 + r(), r: 1, vz: (r() - 0.5) * 0.3 });
  }
  function setRegion(kind: Region) {
    if (world.region === kind) return;
    world.region = kind;
    world.regionName = regionNames[kind];
    world.legs.push({ at: world.dist, kind });
    if (world.legs.length > 8) world.legs.shift();
  }
  const ctx: Ctx = { world, r, say, emit, chronicle, speak, spawn, fx, boom, missile, crash, look, after, setRegion, title };
  const alive = (v: Vehicle) => v.state !== 'crash' && v.state !== 'flung' && v.state !== 'stuck';
  const onRoad = (v: Vehicle) => alive(v) && v.state !== 'jump' && v.state !== 'rim';
  const rigHalf = () => (RIG.L / 2) * sOf(0.5);
  const rigFront = () => rig.x + rigHalf();
  const rigRear = () => rig.x - rigHalf();
  const titled = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const theName = (v: Vehicle) => (v.name.startsWith('THE ') ? v.name : v.name);

  // ---- the roster: what the war party fields ----------------------------------------------------
  const roster: Partial<Record<Kind, number>> = { hotrod: 5, ram: 2, bike: 1.5 };
  const caps: Partial<Record<Kind, number>> = { polecat: 2, crusher: 1, howler: 1, ram: 2, porcupine: 2, throne: 1 };

  // ---- the cast library ---------------------------------------------------------------------------
  const LIBRARY: SystemDef<Ctx>[] = [
    {
      id: 'poles', label: 'the polecats', weight: 7, tags: ['war'],
      create: () => {
        roster.polecat = 3;
        return { id: 'poles' };
      },
    },
    {
      id: 'howler', label: 'the war drums', weight: 9, tags: ['war'],
      create: (c) => {
        const w = c.world;
        let gone = -999;
        let nextRiff = 20;
        return {
          id: 'howler',
          step() {
            const h = w.vehicles.find((v) => v.kind === 'howler');
            if (!h) {
              if (w.lull > 0 || w.t - gone < 70 || w.t < 6) return;
              gone = w.t;
              const v = c.spawn('howler', 'party', { z: phone ? 0.15 : 0.12 + c.r() * 0.15, x: -200 * u });
              v.z = v.tz = phone ? 0.15 : 0.12 + c.r() * 0.15;
              if (w.t > 30) {
                c.say(`${v.name} COMES UP BEHIND, DRUMS BEATING`, GW * 0.2, yAt(0, v.z, 120 * U), '#ffd27a');
                c.emit('drums', GW * 0.2, yOf(v.z), 0.4);
              }
              return;
            }
            if (!alive(h)) {
              gone = w.t;
              return;
            }
            if (w.t > nextRiff && h.x > 0) {
              nextRiff = w.t + 9 + c.r() * 10;
              h.playT = w.t;
              c.emit('riff', h.x, yOf(h.z), 0.25);
              if (c.r() < 0.45) c.say(pick(['THE GUITAR SPITS FIRE', 'THE DRUMS POUND, AND THE WAR PARTY HOWLS', 'A RIFF LIKE A ROCKSLIDE, AND A JET OF FLAME', 'THE SPEAKER WALL SHAKES THE SAND']), h.x, yAt(h.x, h.z, 130 * U), '#ffd27a');
            }
          },
          counts: () => ({ howler: w.vehicles.some((v) => v.kind === 'howler') ? 1 : 0 }),
        };
      },
    },
    {
      id: 'crusher', label: 'the monster tank', weight: 3, tags: ['war'],
      create: () => {
        roster.crusher = 1.2;
        return { id: 'crusher' };
      },
    },
    {
      id: 'porcupine', label: 'the porcupines', weight: 3, tags: ['war'],
      create: () => {
        roster.porcupine = 2.5;
        return { id: 'porcupine' };
      },
    },
    {
      id: 'buggies', label: 'the buggies', weight: 5, tags: ['war'],
      create: () => {
        roster.buggy = 3;
        return { id: 'buggies' };
      },
    },
    {
      id: 'storm', label: 'the toxic storm', weight: 6, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let on = false;
        let nextBolt = 0;
        let nextFling = 0;
        return {
          id: 'storm',
          step(dt) {
            if (!on) {
              if (w.t < 70 || w.region === 'canyon' || w.region === 'bog' || w.lull > 0 || !w.director.want('storm', 0.6, 400)) return;
              on = true;
              until = w.t + 55 + c.r() * 35;
              w.stormX = GW * 1.6;
              c.say('A TOXIC STORM ON THE ROAD AHEAD. THE RIG DRIVES STRAIGHT INTO IT', GW * 0.7, HY - 40 * u, '#ffb070');
              c.title('THE TOXIC STORM', `${rig.name} drives straight into it to shake them off`, 'dust');
              c.emit('storm', GW * 0.8, HY, 0.8);
              c.chronicle(`${titled(rig.name)} drove into a toxic storm to shake the war party, and the sky went orange and black.`);
              c.after(3, () => c.speak(rig, pick(['INTO THE STORM! HOLD ON!', 'SHUT THE VENTS! WE GO THROUGH!', 'THEY WON\'T FOLLOW US IN THERE'], c.r)));
              return;
            }
            const rising = w.t < until;
            w.storm = rising ? Math.min(1, w.storm + dt / 14) : Math.max(0, w.storm - dt / 16);
            // The eye comes down the road at us, sits over the rig, and passes behind.
            w.stormX += ((rising ? GW * 0.45 : -GW * 0.8) - w.stormX) * dt * 0.08;
            if (w.storm > 0.35 && w.t > nextBolt) {
              nextBolt = w.t + 0.8 + c.r() * 1.8;
              const victim = w.vehicles.filter((v) => onRoad(v) && v.x > 0 && v.x < GW).sort(() => c.r() - 0.5)[0];
              const hit = !!victim && c.r() < 0.3;
              const x = hit ? victim.x : GW * (0.05 + c.r() * 0.9);
              const z = hit ? victim.z : -0.3 + c.r() * 1.2;
              w.bolts.push({ x, z, t0: w.t, seed: Math.floor(c.r() * 1e6), hit });
              w.flash = 1;
              c.emit('lightning', x, yOf(z), 0.25);
              if (hit && victim) {
                c.crash(victim, 'fling');
                c.boom(victim.x, victim.z, 10 * U, 1.2, false);
                c.say(`LIGHTNING TAKES ${theName(victim)} AND THROWS IT AT THE SKY`, victim.x, yAt(victim.x, victim.z, 80 * U), '#ffd8a0');
                c.look('bolt', victim.x, victim.z, 1.5, 6, 7);
              } else if (z > -0.1 && z < 1.1) c.boom(x, z, 0, 0.7, true);
            }
            if (w.storm > 0.6 && w.t > nextFling) {
              nextFling = w.t + 4 + c.r() * 5;
              const v = w.vehicles.filter((q) => onRoad(q) && q.x > 0 && q.x < GW && q.kind !== 'howler' && q.kind !== 'throne').sort(() => c.r() - 0.5)[0];
              if (v) {
                c.crash(v, 'fling');
                c.say(`THE STORM PICKS UP ${theName(v)} LIKE A LEAF`, v.x, yAt(v.x, v.z, 90 * U), '#ffd8a0');
                c.emit('flung', v.x, yOf(v.z), 0.7);
                c.look('flung', v.x, v.z, 1.5, 6, 7);
                if (c.r() < 0.5) c.speak(v, pick(['SEE ME FLY!', 'I\'M FLYING! I\'M FLYIIING!', 'WITNESS— NO, REMEMBER ME!'], c.r));
              }
            }
            if (w.storm > 0.5 && w.director.want('stormline', 0.1, 14)) {
              c.say(pick(['THE SKY IS A WALL OF ORANGE DUST', 'WHIRLWINDS WALK THROUGH THE WAR PARTY', 'THE RIG\'S LAMPS ARE THE ONLY LIGHT', 'SAND LIKE BULLETS ON THE ARMOUR', 'A CAR GOES BY IN THE AIR, UPSIDE DOWN'], c.r), GW / 2, HY - 30 * u, '#ffc890');
              c.emit('gust', GW / 2, HY, 0.1);
            }
            if (!rising && w.storm <= 0) {
              on = false;
              w.stormX = GW * 1.6;
              c.say('THE RIG COMES OUT OF THE STORM, SCOURED TO THE METAL', rig.x, yAt(rig.x, 0.5, 130 * U), '#f6e6c8');
              c.emit('stormend', rig.x, yOf(0.5), 0.3);
            }
          },
          counts: () => ({ stormy: on ? 1 : 0 }),
        };
      },
    },
    {
      id: 'canyon', label: 'the canyon ambush', weight: 6, tags: ['terrain'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let on = false;
        let nextBike = 0;
        let nextRock = 0;
        let prev: Region = w.region;
        return {
          id: 'canyon',
          step() {
            if (!on) {
              if (w.t < 40 || w.region === 'bog' || w.storm > 0.05 || w.lull > 0 || !w.director.want('canyon', 0.55, 320)) return;
              on = true;
              prev = w.region;
              c.setRegion('canyon');
              until = w.t + 75 + c.r() * 35;
              nextBike = w.t + 12;
              c.say(`INTO ${w.regionName}. ${names.ravens} WAIT ON THE RIM`, GW * 0.6, HY - 40 * u, '#ffd27a');
              c.title(w.regionName, `${titled(names.ravens)} wait on the rim`, 'fire');
              c.emit('canyon', GW / 2, HY, 0.5);
              c.chronicle(`The road ran into ${titled(w.regionName)}, and ${titled(names.ravens)} came down off the rim.`);
              c.after(2, () => c.speak(rig, pick(['CANYON! WATCH THE RIM!', 'BIKES UP TOP!', 'KEEP YOUR HEADS DOWN IN THE PASS'], c.r)));
              return;
            }
            if (w.t > until) {
              on = false;
              c.setRegion(prev === 'canyon' || prev === 'bog' ? 'flats' : prev);
              c.say('OUT OF THE CANYON AND ONTO THE OPEN WASTE', GW / 2, HY - 30 * u, '#f6e6c8');
              c.emit('canyonend', GW / 2, HY, 0.2);
              for (const v of w.vehicles) if (v.state === 'rim') Object.assign(v, { state: 'leave', tx: -400 * u });
              return;
            }
            // Bikers come along the rim and go over it, over the rig.
            const zRim = -0.42;
            if (w.t > nextBike && w.t < until - 10) {
              nextBike = w.t + (phone ? 4 : 2.2) + c.r() * 2.5;
              if (w.vehicles.filter((v) => v.state === 'rim' || v.state === 'jump').length < (phone ? 3 : 6)) {
                const v = c.spawn('bike', 'ravens', { state: 'rim', z: zRim, tz: zRim, x: -60 * u, alt: rimAlt(), vx: (90 + c.r() * 60) * u, tx: GW * (0.15 + c.r() * 0.6) });
                v.playT = w.t + 3 + c.r() * 4;
                if (c.r() < 0.3) c.speak(v, pick(LINES.ravens, c.r));
              }
            }
            if (w.t > nextRock && w.t < until - 6) {
              nextRock = w.t + 6 + c.r() * 9;
              const x = GW * (0.1 + c.r() * 0.8);
              for (let k = 0; k < 5; k++) c.fx('debris', x + (c.r() - 0.5) * 60 * u, zRim + 0.02, rimAlt() * (0.8 + c.r() * 0.2), { vx: (c.r() - 0.5) * 40 * u + back(zRim) * 0.2, vz: 0.25 + c.r() * 0.35, valt: c.r() * 60 * u, dur: 2.2, r: (6 + c.r() * 10) * U, color: '#6a4a36' });
              c.after(1.6, () => c.boom(x, 0.05 + c.r() * 0.2, 0, 0.8, true));
              if (c.r() < 0.4) c.say('ROCKS COME DOWN OFF THE RIM', x, yAt(x, zRim, rimAlt()), '#f6e6c8');
              c.emit('rockfall', x, yOf(0), 0.3);
            }
          },
          counts: () => ({ canyon: on ? 1 : 0 }),
        };
      },
    },
    {
      id: 'bog', label: 'the bog by night', weight: 4, tags: ['terrain'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let on = false;
        let prev: Region = w.region;
        return {
          id: 'bog',
          step(dt) {
            const night = w.day < 0.2 || w.day > 0.8;
            if (!on) {
              if (!night || w.region === 'canyon' || w.storm > 0.05 || !w.director.want('bog', 0.5, 420)) return;
              on = true;
              prev = w.region;
              c.setRegion('bog');
              until = w.t + 70 + c.r() * 30;
              c.say(`THE ROAD RUNS INTO ${w.regionName} IN THE DARK`, GW / 2, HY - 40 * u, '#bcd4f0');
              c.title(w.regionName, 'If we stop, we sink', 'cold');
              c.emit('bog', GW / 2, HY, 0.5);
              c.chronicle(`By night ${titled(rig.name)} crossed ${titled(w.regionName)}, and the bog took what followed her.`);
              c.after(4, () => c.speak(rig, pick(['LOW GEAR. KEEP HER MOVING', 'DON\'T STOP. IF WE STOP WE SINK', 'WINCH READY!'], c.r)));
              c.after(14, () => c.say(`${names.stilts} WATCH FROM THE MIST ON THEIR STILTS`, GW * 0.3, HY - 20 * u, '#bcd4f0'));
              return;
            }
            if (w.t > until) {
              on = false;
              c.setRegion(prev === 'bog' || prev === 'canyon' ? 'flats' : prev);
              c.say('HARD GROUND AGAIN. THE RIG SHAKES OFF THE MUD', GW / 2, HY - 30 * u, '#d8e4f0');
              c.emit('bogend', GW / 2, HY, 0.2);
              return;
            }
            for (const v of w.vehicles) {
              if (!onRoad(v) || v.x < 0 || v.x > GW || v.kind === 'bike') continue;
              if (c.r() < dt * (v.kind === 'crusher' || v.kind === 'howler' ? 0.004 : 0.022)) {
                v.state = 'stuck';
                v.t0 = w.t;
                c.say(`${theName(v)} BOGS DOWN AND STARTS TO SINK`, v.x, yAt(v.x, v.z, 50 * U), '#bcd4f0');
                c.emit('stuck', v.x, yOf(v.z), 0.5);
                c.speak(v, pick(['DIG! DIG!', 'WE\'RE GOING DOWN!', 'PUSH, YOU MAGGOTS!', 'DON\'T LEAVE ME!'], c.r));
                c.look('stuck', v.x, v.z, 1.4, 6, 6);
              }
            }
          },
          counts: () => ({ bog: on ? 1 : 0 }),
        };
      },
    },
    {
      id: 'rivals', label: 'a rival clan', weight: 5, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'rivals',
          step() {
            if (w.t < 80 || w.lull > 0 || w.vehicles.some((v) => v.clan === 'rival') || !w.director.want('rivals', 0.55, 300)) return;
            const n = phone ? 2 : 3 + Math.floor(c.r() * 2);
            const kinds: Kind[] = ['hotrod', 'ram', 'buggy', 'hotrod', 'crusher'];
            for (let k = 0; k < n; k++) {
              const v = c.spawn(kinds[k], 'rival', { x: GW + (80 + k * 120) * u, vx: -(80 + c.r() * 40) * u });
              v.tx = GW * (0.15 + c.r() * 0.7);
              if (k === 0) c.after(3, () => c.speak(v, pick(LINES.rival, c.r)));
            }
            c.say(`${names.rivals} CUT IN FROM AHEAD. THEY WANT THE TANK TOO`, GW * 0.8, HY - 30 * u, '#9fd8e8');
            c.title(names.rivals, 'cut in from ahead. They want the tank too', 'cold');
            c.emit('rivals', GW * 0.85, yOf(0.5), 0.7);
            c.look('rivals', GW * 0.75, 0.5, 1.3, 8, 6);
            c.chronicle(`${titled(names.rivals)} came in from ahead, and fought ${titled(names.party)} for the tank.`);
          },
          counts: () => ({ rivals: w.vehicles.filter((v) => v.clan === 'rival').length }),
        };
      },
    },
    {
      id: 'drifter', label: 'a drifter', weight: 2.5, tags: ['wonder'],
      create: () => ({ id: 'drifter' }),
    },
    {
      id: 'warlord', label: 'the warlord himself', weight: 2, tags: ['legendary'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'warlord',
          step() {
            if (w.t < 240 || w.lull > 0 || w.vehicles.some((v) => v.kind === 'throne') || !w.director.want('warlord', 0.9, 1100)) return;
            const v = c.spawn('throne', 'party', { x: -260 * u, z: 0.45, tz: 0.45, vx: 50 * u });
            v.name = 'THE THRONE';
            c.say(`${names.warlord} RIDES OUT HIMSELF ON THE THRONE`, GW * 0.25, HY - 30 * u, '#ffd27a');
            c.title(names.warlord, `rides out himself from ${titled(names.home)}`, 'fire');
            c.emit('warlord', GW * 0.2, yOf(0.45), 1);
            c.look('warlord', GW * 0.22, 0.45, 1.5, 12, 8);
            c.chronicle(`${titled(names.warlord)} himself rode out from ${titled(names.home)} on his throne-car, to take back what was his.`);
            w.chant = 1;
            c.after(4, () => c.speak(v, pick(['MY TANK! MY ROAD! MY RIG!', 'BRING HER BACK TO ME!', 'GLORY TO THE ONE WHO TAKES HER!'], c.r)));
          },
        };
      },
    },
  ];
  const RULE = { total: [4, 7] as [number, number], quota: { war: [2, 4] as [number, number], weather: [0, 1] as [number, number], terrain: [0, 2] as [number, number], threat: [0, 1] as [number, number], legendary: [0, 1] as [number, number], wonder: [0, 1] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE, []);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);
  /** The canyon rim's height over the road, in ground units. */
  function rimAlt() {
    return 1400 * u;
  }

  // ---- the chase: the war party, kept up to strength ------------------------------------------------
  const pickKind = (): Kind => {
    const ok = (Object.keys(roster) as Kind[]).filter((k) => (caps[k] ?? 99) > world.vehicles.filter((v) => v.kind === k && v.clan === 'party').length);
    const total = ok.reduce((s, k) => s + (roster[k] ?? 0), 0);
    let x = r() * total;
    for (const k of ok) {
      x -= roster[k] ?? 0;
      if (x <= 0) return k;
    }
    return 'hotrod';
  };
  let nextSpawn = 0;
  let lowSince = -1;
  function strength() {
    return Math.round((phone ? 4 : 7) * traffic * (world.region === 'bog' ? 0.75 : 1));
  }
  function chase() {
    const party = world.vehicles.filter((v) => v.clan === 'party' && alive(v) && v.state !== 'leave');
    // Fewer than it should be: another comes up from behind (never during the lull).
    if (world.lull <= 0 && world.t > nextSpawn && party.length < strength()) {
      nextSpawn = world.t + (world.t < 8 ? 0.8 : (world.phase === 'assault' ? 1.5 : world.phase === 'aftermath' ? 9 : 3) + r() * 4) / traffic;
      const kind = pickKind();
      const n = kind === 'buggy' ? 3 : 1;
      for (let k = 0; k < n; k++) {
        const v = spawn(kind, 'party', k ? { x: -(150 + k * 90) * u } : {});
        // At the start the war party is already on us, spread out behind and beside.
        if (world.t < 8) {
          v.x = GW * (0.04 + r() * 0.5);
          v.state = 'chase';
          v.vx = 0;
        }
        if (k === 0 && world.t > 8 && r() < 0.35) after(2, () => speak(v, pick(LINES.party)));
      }
      if (world.t > 20 && r() < 0.3) {
        const v = world.vehicles[world.vehicles.length - 1];
        say(`${theName(v)} COMES UP FROM BEHIND TO JOIN THE CHASE`, GW * 0.1, yAt(0, v.z, 60 * U), '#f6e6c8');
        emit('arrive', 0, yOf(v.z), 0.15);
      }
    }
    // The war party hurt badly and thin on the ground: it regroups and comes on again together.
    if (party.length < Math.max(2, strength() - 4) && world.lull <= 0) {
      if (lowSince < 0) lowSince = world.t;
      if (world.t - lowSince > 20 && world.director.want('regroup', 0.5, 200)) regroup('Thinned out, the war party fell back, regrouped behind a ridge, and came on again in a wedge.');
    } else lowSince = -1;
  }
  function regroup(text: string) {
    world.lull = 0;
    world.chant = 1;
    const n = Math.max(4, strength());
    for (let k = 0; k < n; k++) {
      const kind = k === 0 && world.castIds.includes('howler') && !world.vehicles.some((v) => v.kind === 'howler') ? 'howler' : pickKind();
      const v = spawn(kind, 'party', { x: -(120 + k * 70) * u - r() * 60 * u, vx: 90 * u });
      v.z = v.tz = 0.08 + (k / Math.max(1, n - 1)) * 0.86;
      v.tx = GW * (0.12 + r() * 0.3);
    }
    say(`${names.party} REGROUP AND COME ON AGAIN, CHANTING`, GW * 0.2, HY - 30 * u, '#ffd27a');
    title('THEY COME AGAIN', `${titled(names.party)}, regrouped, chanting`, 'fire');
    emit('regroup', GW * 0.15, yOf(0.5), 0.8);
    look('regroup', GW * 0.25, 0.5, 1.3, 10, 7);
    chronicle(text);
    lowSince = -1;
    nextSpawn = world.t + 10;
  }

  /** Where a pursuer wants to be: behind the rig, alongside on either side, or (a few) ahead. */
  function slot(v: Vehicle) {
    const K = KINDS[v.kind];
    const half = (K.L / 2) * sOf(v.z);
    if (v.kind === 'howler') {
      v.tx = GW * (0.1 + r() * 0.16);
      v.tz = phone ? 0.12 : 0.06 + r() * 0.2;
      return;
    }
    if (v.clan === 'ally') {
      v.tx = rigRear() + r() * (rigFront() - rigRear()) * 0.6;
      v.tz = 0.84 + r() * 0.14;
      return;
    }
    if (world.phase === 'stalk' || world.phase === 'aftermath') {
      v.tx = half + 10 * u + r() * Math.max(10 * u, rigRear() - half * 2 - 120 * u) * 0.8;
      v.tz = r();
      return;
    }
    if (v.kind === 'throne') {
      v.tx = GW * (0.16 + r() * 0.14);
      v.tz = 0.3 + r() * 0.4;
      return;
    }
    const roll = r();
    if (roll < (phone ? 0.75 : 0.58)) {
      v.tx = half + 10 * u + r() * Math.max(10 * u, rigRear() - half * 2 - 40 * u);
      v.tz = r();
    } else if (roll < 0.93) {
      v.tx = rigRear() + r() * (rigFront() - rigRear());
      v.tz = r() < 0.5 ? r() * 0.22 : 0.8 + r() * 0.2;
    } else {
      v.tx = Math.min(GW - half - 20 * u, rigFront() + half + 30 * u + r() * 200 * u);
      v.tz = r() < 0.5 ? r() * 0.25 : 0.75 + r() * 0.25;
    }
    if (phone) v.tz = Math.max(0.1, v.tz);
  }

  // ---- the vehicles: driving, jockeying, fighting ----------------------------------------------
  function drive(dt: number) {
    const rf = rigFront();
    const rr = rigRear();
    for (const v of world.vehicles) {
      const K = KINDS[v.kind];
      const S = sOf(v.z);
      const half = (K.L / 2) * S;
      if (v.state === 'crash' || v.state === 'flung') {
        const age = world.t - v.t0;
        v.alt += v.valt * dt;
        v.valt -= G * dt * (v.state === 'flung' ? 0.55 : 1);
        v.rot += v.vrot * dt;
        v.x += (v.vx + back(v.z) * (v.state === 'flung' ? 0.4 : 0.6)) * dt;
        if (v.state === 'flung') v.x += (world.stormX > v.x ? -1 : 1) * 40 * u * dt * world.storm;
        if (r() < dt * 14) fx('smoke', v.x, v.z, v.alt + 10 * U, { vx: back(v.z), valt: 20 * u, dur: 2, r: 12 * u, color: '#2a2420' });
        if (r() < dt * 8) fx('fire', v.x, v.z, v.alt + 8 * U, { vx: back(v.z) * 0.5, valt: 30 * u, dur: 0.6, r: 10 * u });
        if (v.alt <= 0 && v.valt < 0 && age > 0.3) {
          // Down: it burns where it lands, and the road leaves it behind.
          const big = K.L > 120 ? 1.8 : K.L > 80 ? 1.3 : 1;
          boom(v.x, v.z, 8 * U, big, true);
          world.wrecks.push({ id: ids++, kind: v.kind, clan: v.clan, x: v.x, z: Math.max(-0.1, Math.min(1.15, v.z)), t0: world.t, seed: v.seed, rot: Math.abs(Math.sin(v.rot)) > 0.5 ? (Math.sin(v.rot) > 0 ? 0.5 : -0.5) : Math.cos(v.rot) < 0 ? Math.PI : 0, burn: 1 });
          emit('wreck', v.x, yOf(v.z), 0.5);
          v.state = 'leave';
          v.x = -1e5;
        }
        continue;
      }
      if (v.state === 'stuck') {
        v.x += back(v.z) * dt;
        v.sink = Math.min(1, v.sink + dt / 14);
        if (r() < dt * 6) fx('mud', v.x + (r() - 0.5) * half, v.z, 2 * u, { vx: back(v.z) + (r() - 0.5) * 60 * u, valt: (40 + r() * 80) * u, dur: 0.9, r: 4 * u, color: '#2a2a20' });
        if (v.sink >= 1 || v.x < -half * 2) {
          if (v.sink >= 1) {
            world.wrecked++;
            emit('sunk', v.x, yOf(v.z), 0.3);
          }
          v.state = 'leave';
          v.x = -1e5;
        }
        continue;
      }
      if (v.state === 'rim') {
        // Along the canyon's rim, then over.
        const dx = v.tx - v.x;
        v.vx += Math.max(-80 * u * dt, Math.min(80 * u * dt, dx * 0.8 - v.vx));
        v.x += v.vx * dt;
        v.alt = rimAlt();
        if (world.t > v.playT && Math.abs(dx) < 80 * u) {
          v.state = 'jump';
          v.t0 = world.t;
          const land = 0.62 + r() * 0.36;
          const T = 2.3 + r() * 0.6;
          v.tz = land;
          v.vx = (rig.x + (r() - 0.3) * rigHalf() * 1.6 - v.x) / T;
          v.valt = (0 - v.alt) / T + 0.5 * G * 0.5 * T;
          v.vrot = (v.tz - v.z) / T;
          v.boost = 1;
          if (r() < 0.5) speak(v, pick(LINES.ravens));
          emit('jump', v.x, yOf(v.z) - v.alt * mOf(v.z), 0.3);
        }
        continue;
      }
      if (v.state === 'jump') {
        const age = world.t - v.t0;
        v.x += v.vx * dt;
        v.z += v.vrot * dt;
        v.alt += v.valt * dt;
        v.valt -= G * 0.5 * dt;
        v.rot = Math.sin(age * 1.4) * 0.25 - 0.1;
        // Over the tank: let the bomb go.
        if (v.lanceT > 0 && Math.abs(v.x - rig.x) < rigHalf() * 0.7 && v.alt > RIG.H * U * 1.2) {
          v.lanceT = 0;
          missile('bomb', v, v.x, v.z, v.alt - 10 * U, rig.x + (r() - 0.5) * rigHalf(), 0.5, 70 * U, 0.8, -1);
          emit('bomb', v.x, yOf(v.z) - v.alt * mOf(v.z), 0.3);
        }
        if (v.alt <= 0 && v.valt < 0) {
          v.alt = 0;
          v.rot = 0;
          v.z = v.tz;
          if (r() < 0.3) {
            crash(v, 'blast');
            say(`${v.name} COMES DOWN WRONG`, v.x, yAt(v.x, v.z, 40 * U), '#ffb080');
          } else {
            v.state = 'chase';
            v.t0 = world.t;
            v.vx = 0;
            for (let k = 0; k < 6; k++) fx('dust', v.x + (r() - 0.5) * half * 2, v.z, 0, { vx: back(v.z) * 0.6, valt: (20 + r() * 40) * u, dur: 1.6, r: (16 + r() * 12) * u });
            slot(v);
          }
        }
        continue;
      }
      // On the road: re-slot now and then; attack runs; falling back; leaving.
      if (v.state === 'arrive' && v.x > 0) {
        v.state = 'chase';
        slot(v);
      }
      if (v.state === 'chase' && world.t > v.slotT) {
        v.slotT = world.t + 5 + r() * 9;
        slot(v);
      }
      if (v.state === 'attack' && world.t - v.t0 > (v.kind === 'polecat' ? 20 : 13)) {
        v.state = 'fallback';
        v.t0 = world.t;
        v.tx = Math.max(half, rr - half - (60 + r() * 200) * u);
      }
      if (v.state === 'fallback' && (world.t - v.t0 > 7 || Math.abs(v.x - v.tx) < 20 * u)) {
        v.state = 'chase';
        v.slotT = world.t + 3;
      }
      if (v.state === 'leave' && v.clan !== 'ally') v.tx = -600 * u;
      // Passing the rig: get out of its lane first.
      let tx = v.tx;
      const inLane = Math.abs(v.z - 0.5) < 0.24;
      const overlapping = v.x + half > rr - 12 * u && v.x - half < rf + 12 * u;
      const wantsPast = v.tx + half > rr && v.tx - half < rf;
      if (inLane && (wantsPast || overlapping)) {
        if (Math.abs(v.tz - 0.5) < 0.26) v.tz = v.z < 0.5 ? 0.18 : 0.84;
        if (!overlapping) tx = Math.min(tx, rr - half - 14 * u);
      }
      const top = K.speed * u;
      const want = Math.max(-top * 0.7, Math.min(top, (tx - v.x) * 0.55));
      const acc = (v.kind === 'bike' || v.kind === 'buggy' ? 90 : 55) * u;
      const dv = Math.max(-acc * dt, Math.min(acc * dt, want - v.vx));
      v.vx += dv;
      v.x += v.vx * dt;
      if (overlapping && inLane && !(v.state === 'attack' && v.kind === 'ram')) v.x = v.x < rig.x ? Math.min(v.x, rr - half - 12 * u) : Math.max(v.x, rf + half + 12 * u);
      v.z += Math.max(-0.09 * dt, Math.min(0.09 * dt, v.tz - v.z)) * (v.kind === 'bike' ? 1.6 : 1);
      v.boost += ((dv > acc * dt * 0.5 ? 1 : v.vx > 20 * u ? 0.6 : 0.15) - v.boost) * Math.min(1, dt * 4);
      if (r() < dt * 0.1) v.boost = 1;
      // A polecat's pole: upright and swaying, or over the tank with its boarder.
      if (v.kind === 'polecat') {
        const over = v.state === 'attack' && Math.abs(v.x - (rig.x + (RIG.tank0 + RIG.tank1) * 0.5 * sOf(0.5))) < rigHalf() * 0.55 && v.z < 0.3;
        v.poleTo = over && v.boarder ? 1.05 : Math.sin(world.t * 0.9 + v.seed) * 0.25 + (v.state === 'attack' ? 0.4 : 0.05);
        v.pole += (v.poleTo - v.pole) * Math.min(1, dt * (over ? 1.4 : 2.2));
        if (over && v.boarder && v.pole > 1) {
          v.boarder = false;
          v.playT = world.t + 18 + r() * 10;
          rig.boarders.push({ at: rig.x + (r() - 0.5) * 60 * u - rig.x, t0: world.t, seed: Math.floor(r() * 1e6) });
          say(`A BOARDER SWINGS DOWN OFF ${theName(v)} ONTO THE TANK`, rig.x, yAt(rig.x, 0.5, 130 * U), '#ffd27a');
          emit('boarder', rig.x, yOf(0.5) - 100 * U, 0.6);
          look('boarder', rig.x, 0.5, 1.6, 8, 6);
          speak(rig, pick(LINES.board));
          after(1.5, () => speak(v, pick(['GOT HIM ON! GOT HIM ON!', 'SWING, BROTHER, SWING!', 'THE TANK! GET TO THE TANK!'])));
          v.t0 = Math.min(v.t0, world.t - 14);
        }
        if (!v.boarder && world.t > v.playT && v.state !== 'attack' && v.x < rr) v.boarder = true;
      }
      if (v.x < -half * 3 && v.state === 'leave') v.x = -1e5;
      if (v.clan === 'ravens' && world.t - v.t0 > 40 && v.state === 'chase') {
        v.state = 'leave';
        v.t0 = world.t;
      }
      if (v.clan === 'rival' && world.t - v.t0 > 150 && v.state === 'chase') {
        v.state = 'leave';
        v.t0 = world.t;
      }
    }
    // Room on the road: cars at a depth keep apart; a hard knock may put one over.
    const road = world.vehicles.filter((v) => onRoad(v) && v.x > -500 * u);
    for (let i = 0; i < road.length; i++) {
      for (let j = i + 1; j < road.length; j++) {
        const a = road[i];
        const b = road[j];
        if (Math.abs(a.z - b.z) > 0.11) continue;
        const need = ((KINDS[a.kind].L + KINDS[b.kind].L) / 2) * sOf((a.z + b.z) / 2) * 0.92;
        const dx = b.x - a.x;
        const over = need - Math.abs(dx);
        if (over <= 0) continue;
        const s = dx >= 0 ? 1 : -1;
        const rel = Math.abs(a.vx - b.vx);
        a.x -= (s * over) / 2;
        b.x += (s * over) / 2;
        const t = a.vx;
        a.vx = b.vx * 0.6 + a.vx * 0.4;
        b.vx = t * 0.6 + b.vx * 0.4;
        if (rel > 50 * u && r() < 0.5) {
          fx('spark', (a.x + b.x) / 2, (a.z + b.z) / 2, 12 * U, { vx: back(a.z) * 0.2, valt: 60 * u, dur: 0.5, r: 3 * u, color: '#ffd080' });
          const weak = KINDS[a.kind].L < KINDS[b.kind].L ? a : b;
          if (r() < 0.25 && world.director.want('clip', 0.3, 25) && weak.x > 0 && weak.x < GW) {
            crash(weak, 'flip');
            const other = weak === a ? b : a;
            say(`${theName(other)} CLIPS ${theName(weak)} AND IT GOES OVER`, weak.x, yAt(weak.x, weak.z, 50 * U), '#ffb080');
            emit('crash', weak.x, yOf(weak.z), 0.7);
            look('clip', weak.x, weak.z, 1.5, 6, 6);
          }
        }
      }
    }
    world.vehicles = world.vehicles.filter((v) => v.x > -9e4);
  }

  /** The director sends a pursuer in on a run at the rig. */
  function attacks() {
    if (world.lull > 0 || world.storm > 0.7 || world.phase === 'aftermath') return;
    const busy = world.vehicles.filter((v) => v.state === 'attack').length;
    const cap = world.phase === 'stalk' ? 1 : world.phase === 'assault' ? (phone ? 3 : 5) : phone ? 2 : 3;
    const cool = world.phase === 'stalk' ? 9 : world.phase === 'assault' ? 1.2 : phone ? 6 : 3.5;
    if (busy >= cap || !world.director.want(world.phase === 'assault' ? 'charge' : 'run', 0.2, cool)) return;
    const pool = world.vehicles.filter((v) => v.state === 'chase' && v.kind !== 'howler' && v.clan !== 'ally' && v.x > 0 && (v.kind !== 'polecat' || v.boarder));
    if (!pool.length) return;
    const v = pool[Math.floor(r() * pool.length)];
    v.state = 'attack';
    v.t0 = world.t;
    const tank = rig.x + ((RIG.tank0 + RIG.tank1) / 2) * sOf(0.5);
    if (v.kind === 'polecat') {
      v.tx = tank + (r() - 0.5) * 40 * u;
      v.tz = 0.08 + r() * 0.14;
    } else if (v.kind === 'ram') {
      v.tx = rig.x + (r() - 0.4) * rigHalf();
      v.tz = r() < 0.5 ? 0.2 : 0.8;
    } else {
      v.tx = rigRear() + r() * (rigFront() - rigRear());
      v.tz = r() < 0.5 ? 0.04 + r() * 0.2 : 0.78 + r() * 0.22;
    }
    if (phone) v.tz = Math.max(0.1, v.tz);
    if (r() < 0.5) speak(v, v.clan === 'rival' ? pick(LINES.rival) : pick(LINES.party));
  }

  function fight(dt: number) {
    const rS = sOf(0.5);
    const tankX0 = rig.x + RIG.tank0 * rS;
    const tankX1 = rig.x + RIG.tank1 * rS;
    // The rig's gunners and lancer.
    for (const c of rig.crew) {
      if (c.role !== 'gunner' && c.role !== 'lancer') continue;
      if (world.t < c.t0) continue;
      const cx = rig.x + c.at * rS;
      const ca = c.up * U;
      const range = c.role === 'lancer' ? 300 * u : GW * 0.55;
      const targets = world.vehicles.filter((v) => (onRoad(v) || v.state === 'jump') && v.clan !== 'ally' && v.x > 0 && v.x < GW && Math.abs(v.x - cx) < range && v.kind !== 'howler');
      if (!targets.length) {
        c.t0 = world.t + 0.5;
        continue;
      }
      targets.sort((a, b) => (a.state === 'attack' ? 0 : 1) - (b.state === 'attack' ? 0 : 1) || Math.abs(a.x - cx) - Math.abs(b.x - cx));
      const v = targets[r() < 0.7 ? 0 : Math.floor(r() * targets.length)];
      c.aim = v.x < cx ? -1 : 1;
      if (c.role === 'gunner') {
        c.t0 = world.t + 1.3 + r() * 1.8;
        const close = v.state === 'attack' || v.state === 'jump';
        const hit = r() < (close ? 0.24 : 0.07) * (world.storm > 0.5 ? 0.5 : 1);
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const lead = k * 0.08;
          world.shots.push({ x0: cx, z0: 0.5, a0: ca, x1: v.x + (hit ? 0 : (r() - 0.5) * 120 * u), z1: v.z, a1: v.alt + (hit ? KINDS[v.kind].H * 0.5 * U : r() * 60 * U), t0: world.t + lead, dur: 0.16 + Math.abs(v.x - cx) / (4000 * u), color: '#ffe6a0', hit: hit && k === n - 1 });
        }
        if (hit) {
          v.hp -= 0.5;
          after(0.3, () => fx('spark', v.x, v.z, KINDS[v.kind].H * 0.5 * U, { vx: back(v.z) * 0.1, valt: 50 * u, dur: 0.4, r: 3 * u, color: '#ffe0a0' }));
          if (v.hp <= 0) after(0.35, () => down(v, 'gunner'));
        }
        if (r() < 0.25) emit('gunfire', cx, yOf(0.5) - ca * rS, 0.06);
      } else {
        c.t0 = world.t + 7 + r() * 7;
        if (Math.abs(v.x - cx) > 260 * u || v.state === 'jump') continue;
        const hit = r() < 0.4;
        missile('lance', null, cx, 0.5, ca, v.x + v.vx * 0.9 + (hit ? 0 : (r() - 0.5) * 120 * u), v.z, hit ? 15 * U : 0, 0.9, hit ? v.id : 0);
        emit('lance', cx, yOf(0.5) - ca * rS, 0.2);
        if (r() < 0.3) speak(rig, pick(['LANCE AWAY!', 'EAT THAT!', 'ONE FOR YOU!']));
      }
    }
    // The pursuers: guns, lances, shells, bombs; at the rig, or at each other when clans meet.
    const rivalsOut = world.vehicles.some((v) => (v.clan === 'rival' || v.clan === 'ally') && onRoad(v));
    for (const v of world.vehicles) {
      if (!onRoad(v) || v.x < 0 || v.x > GW || v.state === 'leave' || world.lull > 0) continue;
      const K = KINDS[v.kind];
      const foes = rivalsOut ? world.vehicles.filter((q) => onRoad(q) && q.clan !== v.clan && !(v.clan === 'ally' && q.clan === 'ally') && q.x > 0 && q.x < GW && Math.abs(q.x - v.x) < 500 * u) : [];
      const atRig = v.clan !== 'ally' && (!foes.length || r() < 0.55);
      if (v.clan === 'ally' && !foes.length) continue;
      if ((K.gun || v.clan === 'rival') && world.t > v.gunT) {
        v.gunT = world.t + 2 + r() * 3;
        const tx = atRig ? tankX0 + r() * (rig.x + RIG.L * 0.45 * rS - tankX0) : foes[0].x;
        const tz = atRig ? 0.5 : foes[0].z;
        const ta = atRig ? (30 + r() * 60) * U : KINDS[foes[0].kind].H * 0.5 * U;
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) world.shots.push({ x0: v.x + (K.L * 0.1) * sOf(v.z), z0: v.z, a0: K.H * 0.9 * U, x1: tx + (r() - 0.5) * 20 * u, z1: tz, a1: ta, t0: world.t + k * 0.09, dur: 0.18, color: v.clan === 'rival' ? '#a8f0ff' : '#ffb070', hit: true });
        if (atRig) {
          after(0.25, () => fx('spark', tx, 0.5, ta, { vx: 0, valt: 40 * u, dur: 0.35, r: 3 * u, color: '#ffe0a0' }));
          rig.hp = Math.max(5, rig.hp - 0.3);
        } else if (r() < 0.2) {
          const f = foes[0];
          f.hp -= 1;
          if (f.hp <= 0) after(0.3, () => down(f, 'clan'));
        }
      }
      if (v.state !== 'attack' && v.kind !== 'crusher' && v.clan !== 'ally') continue;
      // Lances and bombs, close in; the monster tank's gun, from anywhere.
      if (world.t > v.lanceT) {
        if (v.kind === 'crusher') {
          v.lanceT = world.t + 7 + r() * 5;
          const hit = r() < 0.5;
          const tx = hit ? tankX0 + r() * (tankX1 - tankX0) : rig.x + (r() - 0.5) * GW * 0.5;
          missile('shell', v, v.x + K.L * 0.4 * sOf(v.z), v.z, K.H * 0.8 * U, tx, hit ? 0.5 : r(), hit ? (40 + r() * 40) * U : 0, 0.7, hit ? -1 : 0);
          fx('flash', v.x + K.L * 0.5 * sOf(v.z), v.z, K.H * 0.8 * U, { dur: 0.25, r: 40 * u });
          for (let k = 0; k < 3; k++) fx('smoke', v.x + K.L * 0.5 * sOf(v.z), v.z, K.H * 0.8 * U, { vx: back(v.z) * 0.5, valt: 20 * u, dur: 1.6, r: 14 * u, color: '#5a4a40' });
          emit('cannon', v.x, yOf(v.z), 0.35);
          if (r() < 0.3) say(`${theName(v)} FIRES ITS GUN AT THE RIG`, v.x, yAt(v.x, v.z, 90 * U), '#ffb080');
          continue;
        }
        if (!K.lance || (v.clan !== 'ally' && Math.abs(v.x - rig.x) > rigHalf() + 140 * u)) continue;
        v.lanceT = world.t + 3 + r() * 4;
        const hit = r() < 0.6 * (world.storm > 0.5 ? 0.5 : 1);
        const tx = hit ? rig.x + (r() - 0.5) * rigHalf() * 1.7 : rig.x + (r() - 0.5) * rigHalf() * 2.4;
        if (atRig || !foes.length) {
          missile(v.kind === 'bike' ? 'bomb' : 'lance', v, v.x, v.z, (K.H + 16) * U, tx, hit ? 0.5 : v.z * 0.5 + 0.25, hit ? (30 + r() * 60) * U : 0, 0.75 + r() * 0.3, hit ? -1 : 0);
        } else {
          const f = foes[0];
          missile('lance', v, v.x, v.z, (K.H + 16) * U, f.x + f.vx * 0.8, f.z, 10 * U, 0.8, f.id);
        }
        emit('lance', v.x, yOf(v.z), 0.2);
        if (r() < 0.35) speak(v, pick(v.clan === 'rival' ? LINES.rival : LINES.party));
      }
      // A ram truck, alongside: into the rig's flank.
      if (v.kind === 'ram' && world.t > v.playT && Math.abs(v.x - rig.x) < rigHalf() * 0.8) {
        v.tz = v.z < 0.5 ? 0.31 : 0.69;
        if (Math.abs(v.z - 0.5) < 0.2) {
          v.playT = world.t + 8 + r() * 6;
          rig.knock = 1;
          rig.hp = Math.max(5, rig.hp - 3);
          for (let k = 0; k < 8; k++) fx('spark', v.x + (r() - 0.5) * 40 * u, (v.z + 0.5) / 2, (10 + r() * 30) * U, { vx: back(0.5) * 0.3 + (r() - 0.5) * 100 * u, valt: (40 + r() * 120) * u, dur: 0.6, r: 3 * u, color: '#ffd080' });
          v.tz = v.z < 0.5 ? 0.1 : 0.9;
          v.vx = -40 * u;
          emit('ram', v.x, yOf(0.5), 0.5);
          if (r() < 0.3) {
            crash(v, 'flip');
            say(`${theName(v)} RAMS THE RIG, BOUNCES OFF AND GOES OVER`, v.x, yAt(v.x, v.z, 60 * U), '#ffb080');
            look('ram', v.x, v.z, 1.5, 6, 7);
          } else {
            say(`${theName(v)} RAMS THE RIG`, v.x, yAt(v.x, v.z, 60 * U), '#ffd27a');
            speak(rig, pick(['HOLD HER! HOLD HER!', 'SHE\'S HEAVIER THAN YOU, BOY', 'PUSH BACK!']));
          }
        }
      }
    }
    // Boarders on the tank: fought off, or they blow it.
    for (const b of [...rig.boarders]) {
      if (world.t - b.t0 < 5 + (b.seed % 5)) continue;
      rig.boarders = rig.boarders.filter((q) => q !== b);
      if (r() < 0.72) {
        world.repelled++;
        fx('body', rig.x + b.at, 0.5, RIG.H * U, { vx: back(0.5) * 0.6 + (r() - 0.5) * 80 * u, valt: (120 + r() * 120) * u, dur: 1.8, r: 1, vz: r() < 0.5 ? -0.25 : 0.35 });
        say('THE CREW THROWS THE BOARDER OFF THE TANK', rig.x + b.at, yAt(rig.x, 0.5, 140 * U), '#f6e6c8');
        emit('repelled', rig.x + b.at, yOf(0.5) - 100 * U, 0.3);
        speak(rig, pick(['OFF MY TANK!', 'AND STAY OFF!', 'NEXT!']));
      } else {
        boom(rig.x + b.at, 0.5, RIG.H * U * 0.9, 1, false);
        rig.knock = 1;
        rig.hp = Math.max(5, rig.hp - 8);
        say('THE BOARDER BLOWS HIMSELF UP ON THE TANK', rig.x + b.at, yAt(rig.x, 0.5, 140 * U), '#ffb080');
        emit('blast', rig.x + b.at, yOf(0.5), 0.8);
        look('blast', rig.x, 0.5, 1.5, 6, 7);
        holed(rig.x + b.at, 0.9);
      }
    }
    // The tank holed and leaking, until the crew plugs it.
    if (rig.leak > 0) {
      rig.load = Math.max(0.12, rig.load - dt * 0.004 * rig.leak);
      if (world.t - rig.leakT > 22 + (rig.leakT % 10)) {
        rig.leak = Math.max(0, rig.leak - dt * 0.5);
        if (rig.leak === 0) {
          say('THE CREW PLUGS THE HOLE IN THE TANK', rig.x + rig.leakAt * rS, yAt(rig.x, 0.5, 130 * U), '#f6e6c8');
          rig.marks.push({ at: rig.leakAt, up: 62, kind: 'patch', t0: world.t, seed: Math.floor(r() * 1e6) });
          emit('plugged', rig.x, yOf(0.5), 0.3);
          speak(rig, 'PLUGGED! SHE\'S HOLDING');
        }
      }
    }
    if (rig.load < 0.3 && world.director.want('reserve', 0.3, 300)) {
      rig.load = Math.min(1, rig.load + 0.4);
      say('THE CREW OPENS THE RESERVE TANKS', rig.x, yAt(rig.x, 0.5, 130 * U), '#f6e6c8');
      emit('reserve', rig.x, yOf(0.5), 0.2);
    }
    rig.hp = Math.min(100, rig.hp + dt * 0.6);
    rig.knock = Math.max(0, rig.knock - dt * 2.5);
    rig.horn = Math.max(0, rig.horn - dt);
  }
  /** A scar where the rig was hit, kept: the oldest scorch goes when there are too many. */
  function mark(x: number, alt: number, kind: 'scorch' | 'lance') {
    const at = (x - rig.x) / sOf(0.5);
    if (at < -150 || at > 150) return;
    const up = Math.max(20, Math.min(110, alt / U));
    rig.marks.push({ at, up, kind, t0: world.t, seed: Math.floor(r() * 1e6) });
    if (rig.marks.length > 22) {
      const i = rig.marks.findIndex((q) => q.kind !== 'patch');
      rig.marks.splice(i < 0 ? 0 : i, 1);
    }
  }
  /** A hit on the tank may hole it. */
  function holed(x: number, chance: number) {
    const rS = sOf(0.5);
    const at = (x - rig.x) / rS;
    if (at < RIG.tank0 || at > RIG.tank1 || rig.leak > 0 || r() > chance || !world.director.want('leak', 0.3, 70)) return;
    rig.leak = 1;
    rig.leakAt = at;
    rig.leakT = world.t;
    world.leaks++;
    const what = rig.cargo === 'fuel' ? 'FUEL' : 'WATER';
    say(`THE TANK IS HOLED. ${what} POURS OUT ONTO THE ROAD`, x, yAt(x, 0.5, 120 * U), '#ffb080');
    title('THE TANK IS HOLED', `${what.toLowerCase()} pours out onto the road behind`, 'fire');
    emit('leak', x, yOf(0.5), 0.7);
    look('leak', x, 0.5, 1.7, 8, 7);
    chronicle(`A lance holed ${titled(rig.name)}'s tank, and ${rig.cargo === 'fuel' ? 'fuel' : 'water'} ran out onto the road behind her until the crew plugged it.`);
    after(1.2, () => speak(rig, pick(['WE\'RE LEAKING! PLUG IT!', 'THE TANK! GET ON THE TANK!', 'SHE\'S BLEEDING!'])));
  }
  /** A pursuer shot to pieces. */
  function down(v: Vehicle, by: string) {
    if (!onRoad(v) && v.state !== 'jump') return;
    const blast = by === 'lance' || r() < 0.4;
    crash(v, blast ? 'blast' : 'flip');
    const text = blast ? pick([`${theName(v)} GOES UP IN A BALL OF FIRE`, `${theName(v)} EXPLODES`, `A LANCE FINDS ${theName(v)}`]) : pick([`${theName(v)} FLIPS END OVER END`, `${theName(v)} GOES OVER`, `${theName(v)} CARTWHEELS INTO THE DUST`]);
    say(text, v.x, yAt(v.x, v.z, 60 * U), '#ffb080');
    emit('crash', v.x, yOf(v.z), 0.7);
    look('crash', v.x, v.z, 1.5, 6, by === 'lance' ? 7 : 5);
    if (r() < 0.35) chronicle(`${titled(v.name)} of ${titled(v.clan === 'rival' ? names.rivals : v.clan === 'ravens' ? names.ravens : names.party)} went over at kilometre ${Math.round(world.km)}${v.kind === 'howler' ? ', and the drums stopped for a while' : ''}.`);
    if (v.kind === 'throne') {
      chronicle(`${titled(names.warlord)}'s throne went over in flames, and the war party wailed.`);
      title('THE THRONE FALLS', `${titled(names.warlord)} goes over in flames`, 'fire');
    }
    if (v.kind === 'howler') title('THE DRUMS STOP', `${titled(v.name)} goes over`, 'fire');
    if (v.clan !== 'ally' && world.vehicles.some((q) => q === v)) rig.kills += by === 'gunner' || by === 'lance' ? 1 : 0;
    if (r() < 0.4) after(1, () => speak(rig, pick(['GOOD SHOT!', 'ONE DOWN!', 'SCRATCH ONE!', 'NEXT!'])));
  }

  // ---- what flies: lances, bombs, shells, flares --------------------------------------------------
  function missiles(dt: number) {
    for (const m of world.missiles) {
      m.x += m.vx * dt;
      m.z += m.vz * dt;
      m.alt += m.valt * dt;
      m.valt -= G * dt;
      if (m.kind === 'flare') {
        if (world.t - m.t0 > 0.9 && m.valt < 0) m.valt = Math.max(m.valt, -40 * u);
        if (world.t - m.t0 > 7) m.alt = -2;
        continue;
      }
      if (r() < dt * 30) fx('smoke', m.x, m.z, m.alt, { vx: back(m.z) * 0.3, valt: 4 * u, dur: 0.7, r: 4 * u, color: '#6a6058' });
      const tgt = m.target > 0 ? world.vehicles.find((v) => v.id === m.target) : null;
      if (world.t - m.t0 < m.T && m.alt > 0) continue;
      const at = Math.max(0, m.alt);
      m.alt = -1;
      const size = m.kind === 'shell' ? 1.2 : m.kind === 'bomb' ? 1 : 0.8;
      if (m.target === -1) {
        boom(m.x, 0.5, at, size, false);
        rig.knock = 1;
        rig.hp = Math.max(5, rig.hp - (m.kind === 'shell' ? 8 : m.kind === 'bomb' ? 6 : 4));
        mark(m.x, at, m.kind === 'lance' && r() < 0.45 ? 'lance' : 'scorch');
        emit('hit', m.x, yOf(0.5), 0.5);
        if (r() < 0.35) speak(rig, pick(LINES.hit));
        holed(m.x, m.kind === 'lance' ? 0.5 : 0.65);
      } else if (tgt && onRoad(tgt) && Math.abs(tgt.x - m.x) < KINDS[tgt.kind].L * sOf(tgt.z)) {
        boom(m.x, tgt.z, Math.max(at, 12 * U), size, false);
        tgt.hp -= 3;
        if (tgt.hp <= 0) down(tgt, 'lance');
        else if (r() < 0.5) speak(tgt, pick(['I\'M HIT! STILL ROLLING!', 'IS THAT ALL?', 'BURNING! STILL BURNING!']));
      } else boom(m.x, Math.max(-0.1, Math.min(1.1, m.z)), 0, size * 0.8, true);
    }
    world.missiles = world.missiles.filter((m) => m.alt >= 0 || (m.kind === 'flare' && m.alt > -2));
  }

  // ---- the wrecks, the fx, the road ------------------------------------------------------------
  let nextLeg = 90 + r() * 60;
  function road(dt: number) {
    const target = V0 * (world.region === 'bog' ? 0.5 : 1) * (world.storm > 0.5 ? 0.85 : 1) * (world.lull > 0 ? 0.85 : 1);
    world.V += (target - world.V) * Math.min(1, dt * 0.3);
    world.dist += world.V * dt;
    world.km += (dt * 0.024 * world.V) / V0;
    // The road changes under us: flats, dunes, towers, in the seed's proportions.
    if (world.t > nextLeg && world.region !== 'canyon' && world.region !== 'bog') {
      nextLeg = world.t + 100 + r() * 90;
      const options = (['flats', 'dunes', 'towers'] as const).filter((k) => k !== world.region);
      const total = options.reduce((s, k) => s + regionWeights[k], 0);
      let x = r() * total;
      let next: Region = options[0];
      for (const k of options) {
        x -= regionWeights[k];
        if (x <= 0) {
          next = k;
          break;
        }
      }
      setRegion(next);
      say(next === 'flats' ? `OUT ONTO ${world.regionName}, CRACKED WHITE TO THE EDGE OF THE WORLD` : next === 'dunes' ? `INTO ${world.regionName}, THE CONVOY SWIMMING THROUGH THE SAND` : `THROUGH ${world.regionName}, ROCK STACKS STANDING ON THE WASTE`, GW / 2, HY - 30 * u, '#f6e6c8');
      emit('leg', GW / 2, HY, 0.15);
    }
    for (const wk of world.wrecks) {
      wk.x += back(wk.z) * dt;
      wk.burn = Math.max(0, wk.burn - dt / 40);
      if (wk.burn > 0.1 && r() < dt * 5 * wk.burn) fx('smoke', wk.x + (r() - 0.5) * 20 * u, wk.z, 15 * U, { vx: back(wk.z) * 0.8, valt: (20 + r() * 20) * u, dur: 3.5, r: (10 + r() * 8) * u, color: '#262020' });
      if (wk.burn > 0.3 && r() < dt * 4 * wk.burn) fx('fire', wk.x + (r() - 0.5) * 30 * u, wk.z, 6 * U, { vx: back(wk.z), valt: 30 * u, dur: 0.5, r: 8 * u });
    }
    world.wrecks = world.wrecks.filter((wk) => wk.x > -400 * u);
    // The leak, out onto the road behind.
    if (rig.leak > 0 && r() < dt * 30) fx('spray', rig.x + rig.leakAt * sOf(0.5), 0.5, 40 * U, { vx: back(0.5) * 0.25 - 60 * u, valt: (r() - 0.3) * 40 * u, dur: 0.9, r: 4 * u, color: rig.cargo === 'fuel' ? '#1a1410' : '#8ad0e8' });
    for (const f of world.fx) {
      if (world.t < f.t0) continue;
      f.x += f.vx * dt;
      f.z += f.vz * dt;
      f.alt += f.valt * dt;
      if (f.kind === 'debris' || f.kind === 'spark' || f.kind === 'body' || f.kind === 'wheel' || f.kind === 'mud' || f.kind === 'spray') {
        f.valt -= G * dt;
        f.rot += dt * 8;
        if (f.alt < 0) {
          f.alt = 0;
          f.valt = -f.valt * 0.3;
          f.vx = f.vx * 0.5 + back(f.z) * 0.5;
          if (f.kind === 'wheel') f.vx = back(f.z) * 0.6;
        }
      }
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
    world.shots = world.shots.filter((s) => world.t - s.t0 < s.dur);
    world.bolts = world.bolts.filter((b) => world.t - b.t0 < 0.6);
    world.flash = Math.max(0, world.flash - dt * 3);
  }

  // ---- the shouting -----------------------------------------------------------------------------
  let nextVoice = 3;
  function voices(dt: number) {
    nextVoice -= dt;
    if (nextVoice > 0) return;
    nextVoice = 2.5 + r() * 4;
    const near = world.vehicles.filter((v) => onRoad(v) && v.x > 40 * u && v.x < GW - 40 * u && world.t - v.lineT > 10);
    const roll = r();
    if (world.lull > 0) {
      if (world.t - rig.lineT > 8) speak(rig, pick(['THEY\'RE FALLING BACK', 'BREATHE. DRINK. RELOAD.', 'THEY\'LL BE BACK BY NOON', 'CHECK THE TANK. CHECK THE TYRES.', 'LISTEN. NO DRUMS.']));
      return;
    }
    if (roll < 0.35 && world.t - rig.lineT > 6) speak(rig, rig.boarders.length ? pick(LINES.board) : pick(LINES.rig));
    else if (near.length) {
      const v = near[Math.floor(r() * near.length)];
      speak(v, v.clan === 'rival' ? pick(LINES.rival) : v.clan === 'ravens' ? pick(LINES.ravens) : v.kind === 'howler' ? pick(['LOUDER!', 'PLAY! PLAY THEM TO THEIR GRAVES!', 'THE DRUMS! HEAR THE DRUMS!']) : pick(LINES.party));
    }
  }

  // ---- the hours: the lull at dawn, the regroup, the hour lines ------------------------------------
  const RITES: [number, string, string][] = [
    [0.265, 'DAWN COMES UP RED OVER THE WASTE', '#ffc890'],
    [0.5, 'NOON. THE SALT BURNS WHITE AND THE ENGINES BURN HOTTER', '#fff0d0'],
    [0.735, 'THE SUN GOES DOWN BEHIND THE CONVOY', '#ffb070'],
    [0.82, 'THE MOON COMES UP, HUGE AND BLUE', '#bcd4f0'],
    [0.04, 'DEEP NIGHT. HEADLIGHTS ON THE WASTE', '#bcd4f0'],
  ];
  const rited = new Set<string>();
  let lullUntil = 0;
  function rites() {
    const dayNo = Math.floor(world.t / world.dayLen + world.day);
    for (const [at, text, color] of RITES) {
      const key = `${dayNo}:${at}`;
      if (rited.has(key) || Math.abs(world.day - at) > 0.004) continue;
      rited.add(key);
      if (world.storm > 0.3) continue;
      say(text, GW / 2, HY - 50 * u, color);
      emit('hour', GW / 2, HY, 0.1);
    }
    if (rited.size > 40) rited.clear();
    // At first light the war party falls back to lick its wounds; then comes on again.
    const lullKey = `lull:${dayNo}`;
    if (world.day > 0.27 && world.day < 0.3 && !rited.has(lullKey) && world.lull <= 0 && world.storm < 0.1 && world.region !== 'canyon' && world.t > 30) {
      rited.add(lullKey);
      world.lull = 1;
      lullUntil = world.t + 38 + r() * 14;
      for (const v of world.vehicles) if (onRoad(v) && v.clan === 'party') Object.assign(v, { state: 'leave', t0: world.t });
      say('A LULL AT DAWN. THE WAR PARTY FALLS BACK OUT OF RANGE', GW * 0.3, HY - 30 * u, '#ffc890');
      title('FIRST LIGHT', 'The war party falls back out of range', 'dust');
      emit('lull', GW * 0.3, HY, 0.4);
      chronicle(`At dawn the war party fell back out of range, and for a while there was only the engine and the road.`);
    }
    if (world.lull > 0) {
      if (r() < 0.02) emit('quiet', rig.x, yOf(0.5), 0.02);
      if (world.t > lullUntil) regroup('The war party came on again out of the sunrise, chanting, the drums in front.');
    }
    world.chant = Math.max(0, world.chant - 1 / (30 * 30));
  }

  // ---- the story: the war party stalks, harries, throws everything, falls back ----------------------
  const PHASE_LEN: Record<Phase, [number, number]> = { stalk: [22, 40], harry: [55, 100], assault: [32, 48], aftermath: [22, 34] };
  let phaseEnd = 20 + r() * 15;
  let lastAssault = -60;
  function setPhase(p: Phase) {
    world.phase = p;
    world.phaseT = world.t;
    const [a, b] = PHASE_LEN[p];
    phaseEnd = world.t + a + r() * (b - a);
    if (p === 'assault') {
      world.chant = 1;
      title('ALL OF THEM AT ONCE', `${titled(names.party)} throw everything at ${titled(rig.name)}`, 'fire');
      say(`${names.party} THROW EVERYTHING AT THE RIG`, GW * 0.3, HY - 30 * u, '#ffd27a');
      emit('assault', GW * 0.3, yOf(0.5), 0.9);
      look('assault', rig.x - rigHalf(), 0.5, 1.3, 12, 7);
      chronicle(`Near kilometre ${Math.round(world.km)}, ${titled(names.party)} threw everything they had at ${titled(rig.name)}.`);
      after(2, () => speak(rig, pick(['HERE THEY COME. ALL OF THEM.', 'HOLD ON TO SOMETHING!', 'GUNNERS! EVERYTHING YOU\'VE GOT!']), true));
    } else if (p === 'aftermath') {
      const burning = world.wrecks.length;
      title('THE DUST SETTLES', burning ? `${burning === 1 ? 'a wreck burns' : `${burning} wrecks burn`} on the road behind` : 'the war party falls back to lick its wounds', 'dust');
      say('THE WAR PARTY FALLS BACK, AND THE DUST SETTLES', GW * 0.3, HY - 30 * u, '#f6e6c8');
      emit('aftermath', GW * 0.3, yOf(0.5), 0.3);
      for (const v of world.vehicles) if (v.clan === 'party' && (v.state === 'attack' || v.state === 'chase')) Object.assign(v, { state: 'fallback', t0: world.t, tx: Math.max(40 * u, rigRear() - (200 + r() * 300) * u) });
      after(3, () => speak(rig, pick(['CHECK THE TANK. CHECK THE TYRES.', 'WHO\'S HIT? SOUND OFF.', 'THEY\'LL BE BACK. THEY\'RE ALWAYS BACK.', 'PATCH WHAT YOU CAN.']), true));
    } else if (p === 'stalk') {
      emit('drums', GW * 0.15, yOf(0.2), 0.2);
      after(4, () => speak(rig, pick(['DRUMS. HEAR THEM?', 'THEY\'RE MASSING BEHIND US', 'EYES BACK. THEY\'RE COMING UP AGAIN']), true));
    } else emit('harry', GW * 0.2, yOf(0.5), 0.2);
  }
  function story() {
    if (world.lull > 0) {
      world.phase = 'stalk';
      phaseEnd = world.t + 30;
      return;
    }
    if (world.t < phaseEnd) return;
    const p = world.phase;
    if (p === 'stalk') setPhase('harry');
    else if (p === 'harry') {
      // The climax comes at the top of the arc, or at the latest when it has been too long.
      const since = world.t - lastAssault;
      if (world.t > 60 && world.storm < 0.2 && since > 140 && (world.director.tension() > 0.62 || since > 320)) {
        lastAssault = world.t;
        setPhase('assault');
      }
      else phaseEnd = world.t + 10;
    } else if (p === 'assault') setPhase('aftermath');
    else setPhase('stalk');
  }
  /** A drifter (rare, and only on some roads): comes out of the dust and takes the rig's side for a while. */
  let drifterT = -1;
  function drifter() {
    if (!world.castIds.includes('drifter')) return;
    const d = world.vehicles.find((v) => v.kind === 'drifter');
    if (!d) {
      if (world.t < 180 || world.lull > 0 || world.phase !== 'harry' || !world.director.want('drifter', 0.6, 900)) return;
      const v = spawn('drifter', 'ally', { x: -160 * u, z: 0.9, tz: 0.9, vx: 120 * u });
      drifterT = world.t;
      title('A DRIFTER', `comes out of the dust and takes ${titled(rig.name)}'s side`, 'dust');
      say('A DRIFTER COMES OUT OF THE DUST AND TAKES THE RIG\'S SIDE', GW * 0.2, HY - 30 * u, '#f6e6c8');
      emit('drifter', GW * 0.1, yOf(0.9), 0.8);
      look('drifter', GW * 0.3, 0.9, 1.4, 10, 7);
      chronicle(`A drifter came out of the dust near kilometre ${Math.round(world.km)} and fought beside ${titled(rig.name)} for a while.`);
      after(5, () => speak(v, pick(['NEED A HAND, HAULMASTER?', 'I\'LL TAKE THE NEAR SIDE.', 'DON\'T SHOOT. I\'M WITH YOU.']), true));
      return;
    }
    if (d.state === 'chase' && world.t - drifterT > 110) {
      d.state = 'leave';
      d.t0 = world.t;
      d.tx = GW + 600 * u;
      speak(d, pick(['GOOD LUCK, HAULMASTER.', 'THIS IS WHERE I TURN OFF.', 'SEE YOU AT THE WELL.']), true);
    }
    if (d.state === 'leave' && d.x > GW + 300 * u) d.x = -1e5;
  }

  // ---- a touch ------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 2 || y < HY) return null;
    lastNudge = world.t;
    const z = Math.max(-0.2, Math.min(1.2, (y - HY - A) / DB));
    const rS = sOf(0.5);
    const cx = rig.x + 6 * rS;
    const ca = 98 * U;
    let best: Vehicle | null = null;
    let bd = 160 * u;
    for (const v of world.vehicles) {
      if (!onRoad(v) || v.clan === 'ally') continue;
      const vy = yOf(v.z) - (KINDS[v.kind].H / 2) * sOf(v.z);
      const d = Math.hypot(v.x - x, vy - y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    if (best) {
      const T = 0.6 + Math.abs(best.x - cx) / (900 * u);
      missile('lance', null, cx, 0.5, ca, best.x + best.vx * T, best.z, 15 * U, T, best.id);
      const text = `THE RIG'S LANCER THROWS AT ${theName(best)}`;
      say(text, best.x, yAt(best.x, best.z, 70 * U), '#ffd27a');
      emit('lance', cx, yOf(0.5), 0.3);
      speak(rig, 'LANCE AWAY!');
      return text;
    }
    missile('flare', null, cx, 0.5, ca, x, z, 260 * u, 1.4, 0);
    const text = 'A FLARE GOES UP OVER THE WASTE';
    say(text, x, y - 30 * u, '#ffd27a');
    emit('flare', x, y, 0.2);
    return text;
  }

  function step(dt: number) {
    world.t += dt;
    world.day = (world.day + dt / world.dayLen) % 1;
    world.director.step(world.t, dt);
    for (let i = later.length - 1; i >= 0; i--)
      if (world.t >= later[i].at) {
        const { fn } = later[i];
        later.splice(i, 1);
        fn();
      }
    road(dt);
    chase();
    attacks();
    drive(dt);
    fight(dt);
    missiles(dt);
    for (const s of systems) s.step?.(dt);
    story();
    drifter();
    voices(dt);
    rites();
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}

/** For the painter and the tests. */
export type { Vehicle, VState };
