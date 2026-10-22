/**
 * # Titan Dock: a giant-robot defence base on a stormy coast, in cutaway, and the sea in front of it where monsters come out of a rift.
 *
 * On screen, at a glance: the dock cut open like a section drawing: three or four giant mechs
 * standing in their bays on yellow gantries, crews on the scaffolds with welding sparks, cranes
 * running on the ceiling with plates and arms on their hooks, the breach clock over the bays,
 * helicopters on the roof deck, the great rolling door to the sea; outside, a rainy, heaving
 * sea under lightning, a city across the bay with its harbour, cranes, ships and a suspension
 * bridge, and far out on the horizon the rift glowing on the seabed.
 * The camera: the whole dock and the bay beside it.
 *
 * Always happening (the floor):
 * - Crews at work: welders on the platforms, tugs and trucks on the floor, the gantry lifts going
 *   up and down, cranes carrying parts to the bays; mechs being refitted and mended.
 * - The sea heaving, the rain, the wind, lightning; patrol helicopters over the bay with their
 *   searchlights; ships in the harbour, cars on the bridge, the city's lights.
 * - The breach clock ticking down to the next monster.
 *
 * The round, paced by the clock and the director:
 * - ALARM: the clock runs out, the rift flares, the alarm lights turn; a monster SURFACES out by
 *   the rift (crab-backed, winged, horned, glowing-veined or serpent-necked; a SURGE number).
 * - LAUNCH: the door rolls up, a mech walks out onto the apron, the lift team of heavy
 *   helicopters hooks it on cables, carries it out over the bay and drops it into the surf.
 * - THE FIGHT in the surf off the harbour: punches with weight, elbow rockets, plasma, cannon,
 *   swords and chain blades; claws, bites, acid, charges, wings and tails; a ship swung as a club;
 *   the mech downed and up again; buildings brought down behind it.
 * - THE END: the monster killed (glowing blue blood on the water, the carcass left to the salvage
 *   crews), or the mech lost (the pods away, the city evacuated, the monster loose in the
 *   harbour until a second mech goes out or it goes back to the sea).
 * - AFTERMATH: the lift team brings the mech home damaged; it is mended over the next minutes; a
 *   lost mech is rebuilt in its bay, a new mark; the clock is reset.
 *
 * The cast (each seed draws some):
 * - squalls [weather] storms that break over the dock: lightning on the mast, the surf over the apron.
 * - fog [weather] sea fog rolling in, the foghorn, searchlights in it.
 * - convoy [harbour] ships in and out of the harbour, tugs alongside.
 * - bonetrade [harbour] the bone merchants' barges at a carcass by night.
 * - testfire [dock] weapons tests in the bays.
 * - refits [dock] new weapons and new marks fitted by the cranes.
 * - doubles [threat] double events: two monsters at once, and two mechs out.
 * - skitters [threat] small Surge-1 things washed up on the harbour beach, hunted by the patrols.
 * - fireworks [wonder] the city lights fireworks over the harbour after a kill.
 * - research [wonder] the lab samples each carcass and revises the clock.
 * - whales [life] whales in the bay, and they leave before a breach.
 * - drills [life] the city's shelter drills, sirens and all.
 * Quotas: 4–6 in all; weather 1–2, threat 0–1.
 *
 * What keeps it going: monsters come and are killed or go back; mechs go out and come back
 * damaged and are mended, or are lost and rebuilt; buildings fall and are rebuilt; the clock resets.
 * What changes with the seed: which side the dock stands, the mood of the light, its name and the
 * city's, the mechs (names, marks, liveries, weapons, emblems, builds), the monsters this coast
 * sees, the cast.
 * A touch: on a mech in its bay, a systems check; on the water, a flare and the searchlights on it;
 * on a monster, the shore guns.
 * Phone: two bays and a taller sky, the same bay and city.
 */
import { createBus, type Bus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import type { Build, Building, Crane, DockOptions, DockWorld, Emblem, Fx, FxKind, Mech, MechAct, Monster, MonsterKind, Mood, Person, Setting, Ship, Weapon } from './types';

export const DOCKS = ['HALVERSUND', 'PORT ARDEN', 'GREYWATER', 'SAINT OSRIC', 'KESTREL BAY', 'MARROWHAVEN', 'NORTHGATE', 'CAPE LANTERN', 'IRONQUAY', 'SALT HARBOUR', 'VESSEL POINT', 'LOWHAVEN'];
const PROGRAMMES = ['THE BULWARK PROGRAMME', 'THE TIDEGUARD COMMAND', 'THE BREAKWATER CORPS', 'THE SEAWARD DEFENCE PACT', 'THE COASTAL TITAN AUTHORITY'];
const MECH_NAMES = ['IRON VESPER', 'COPPER SAINT', 'ORION MAUL', 'NORTHERN BASTION', 'SCARLET HALYARD', 'ATLAS RECKONER', 'GALE SOVEREIGN', 'HELIOS WARDEN', 'BLACKWATER VIGIL', 'SILVER CATARACT', 'MAGPIE THUNDER', 'KESTREL ANVIL', 'LANTERN QUEEN', 'BRONZE MERIDIAN', 'HALCYON BREAKER', 'OSPREY DIRGE', 'CINDER ABBOT', 'MOONLIT HALBERD'];
const PILOTS = ['VOSS', 'MARCH', 'KELL', 'OKAFOR', 'TORRES', 'BRAND', 'STROM', 'DELACROIX', 'MORROW', 'ARDEN', 'PIKE', 'HALE', 'SOLBERG', 'KANE', 'ROWE', 'DEVRIES', 'ISHIDA', 'NAVARRO', 'QUINN', 'ABARA'];
const MONSTER_NAMES = ['GRIEFJAW', 'HOLLOWBACK', 'SALTWIDOW', 'CINDERMAW', 'THORNCRAB', 'MIREWING', 'GLASSHORN', 'VEINLIGHT', 'RUSTFANG', 'BRINEKING', 'STILTSPINE', 'ASHGULLET', 'COILSHARD', 'NETTLEHEAD', 'GLOAMCLAW', 'TIDEMOTHER', 'SKULLREEF', 'LAMPREY QUEEN', 'BARNACLE SAINT', 'WRECKHOOK'];
const KIND_WORDS: Record<MonsterKind, string> = { crab: 'CRAB-BACKED', winged: 'WINGED', horned: 'HORNED', veined: 'GLOWING-VEINED', serpent: 'SERPENT-NECKED' };
const LIVERIES: [string, string, string][] = [
  ['#33507a', '#c4c9d0', '#d8a520'], ['#7e2222', '#2c2c32', '#e2b448'], ['#465f3e', '#b4a684', '#e07a22'], ['#c6c2b6', '#3c424a', '#cf2e2a'],
  ['#c8741e', '#2e3238', '#eadcbc'], ['#2a6a70', '#e4dfd2', '#efb030'], ['#4c505a', '#a83428', '#e6d6ae'], ['#5c3e6c', '#bcbcc6', '#46cfe0'],
];
const CORES = ['#7ad8ff', '#ffb050', '#ff6a3a', '#9cff9a', '#c8a0ff'];
const EMBLEMS: Emblem[] = ['star', 'teeth', 'sun', 'bird', 'anchor', 'skull', 'bolt', 'rose'];
const BUILDS: Build[] = ['heavy', 'lean', 'broad'];
const HIDES: [string, string, string, string][] = [
  ['#3a4a48', '#141c1e', '#58e8ff', '#5a6a5a'], ['#4a3a34', '#1a1210', '#7af0ff', '#7a5a48'], ['#2e3442', '#0e1018', '#4adcff', '#4a5468'],
  ['#3c4432', '#12160e', '#9cff6a', '#5a6448'], ['#4a2e3a', '#160c12', '#ff6ad8', '#6a4252'], ['#3a3a3e', '#101012', '#6affd0', '#56565c'],
];

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n: number) => ROMAN[Math.max(0, Math.min(10, n))] ?? String(n);

type Ctx = {
  world: DockWorld; r: Rng;
  say(text: string, x: number, y: number, color?: string): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  look(why: string, x: number, y: number, zoom: number, hold: number, priority: number): void;
  fx(kind: FxKind, x: number, y: number, d: number, extra?: Partial<Fx>): void;
  seaY(x: number, d: number, alt?: number): number;
  radio(m: Mech, line: string): void;
  control(line: string): void;
  caption(text: string, sub?: string, color?: string): void;
};

export function createTitanDock(seed: string | number, W: number, H: number, opts: DockOptions): DockWorld {
  const bus: Bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'dock');
  const shotR: Rng = forkRng(seed, 'dock-shots');
  const g: Genome = createGenome(seed, 'dock');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const phone = GW < GH;
  const u = Math.max(0.42, Math.min(1.15, Math.min(GW, GH * 1.6) / 1600));
  const traffic = Math.max(0.4, Math.min(2.5, opts.traffic));
  let ids = 1;

  // ---- the layout ------------------------------------------------------------------------------------
  const mood = g.weighted<Mood>({ sodium: 3, teal: 3, violet: 2, grey: 2 });
  const setting = g.weighted<Setting>({ harbour: 4, fjord: 2, refinery: 2, island: 2 });
  const flip = g.chance(0.5);
  const roof0 = Math.round(GH * (phone ? 0.3 : 0.13));
  const floorY = Math.round(GH * (phone ? 0.7 : 0.8));
  const wallT = Math.round(34 * u);
  const doorX = Math.round(GW * (phone ? 0.56 : g.range(0.42, 0.47)));
  const x0 = Math.round(26 * u);
  const HY = Math.round(GH * (phone ? 0.44 : g.range(0.42, 0.46)));
  const NY = floorY + Math.round(58 * u);
  const yOf = (d: number) => HY + (NY - HY) * (1 - d) * (1 - d);
  const mOf = (d: number) => 0.06 + 0.94 * (1 - d) * (1 - d);
  // The far shore: a harbour city's waterfront across the bay; a fjord's near wall; a refinery's quays; an island's far-off coast.
  const shoreK = setting === 'island' ? 1.3 : setting === 'fjord' ? 0.98 : 1.03;
  const shoreR = (setting === 'fjord' ? 0.26 : setting === 'island' ? 0.38 : 0.33) * (phone ? 0.9 : 1);
  const coastX = (d: number) => GW * shoreK - ((d - 0.04) / 0.72) * GW * shoreR;
  const dockDX = Math.round((phone ? 56 : 100) * u);
  const dockDY = Math.round((phone ? 30 : 54) * u);
  const standY = floorY - dockDY * 0.5;
  const apronX = doorX + wallT / 2 + dockDX + Math.round((phone ? 70 : 120) * u);
  const nBays = phone ? 2 : (g.chance(0.3) ? 2 : 3) + (GW / GH >= 1.75 ? 1 : 0);
  const laneW = Math.round((phone ? 46 : 120) * u);
  const laneX = doorX - wallT / 2 - laneW;
  const bayW = (laneX - (x0 + 20 * u)) / nBays;
  const bays = Array.from({ length: nBays }, (_, i) => ({ x: x0 + 20 * u + (i + 0.5) * bayW, w: bayW }));
  const mechH = Math.min((floorY - roof0 - 40 * u) * 0.7, bayW * 1.42);
  // The hangar is as tall as its giants need: narrow bays make a squat dock under more sky.
  const ceilY = Math.round(Math.max(roof0 + 40 * u, floorY - dockDY * 0.5 - mechH / 0.68));
  const roofY = ceilY - Math.round(40 * u);
  const deckY = roofY - dockDY * 0.5;
  const pads = (phone ? [x0 + bayW * 0.55, x0 + bayW * 1.5] : Array.from({ length: Math.min(4, nBays + 1) }, (_, i) => x0 + 60 * u + ((laneX - x0 - 60 * u) * (i + 0.5)) / Math.min(4, nBays + 1))).map((x) => x + dockDX * 0.5);
  const riftX = GW * g.range(0.62, 0.74);
  const bridgeD = g.range(0.5, 0.6);
  const bridge = setting === 'harbour' || (setting === 'fjord' && g.chance(0.5));
  // On a phone the fight comes into the foreground, in front of the dock, where a tall frame has room for it.
  const fightD = phone ? g.range(-0.07, -0.03) : g.range(0.15, 0.23);
  const fightX = (d: number) => Math.min(coastX(d) - mechH * mOf(d) * 0.55, GW * (phone ? 0.8 : 0.84));
  const doorTop = ceilY + (floorY - ceilY) * 0.1;

  // eslint-disable-next-line prefer-const
  let world: DockWorld;
  world = {
    t: 0, W, H, GW, GH, u, phone, bus,
    director: createDirector(forkRng(seed, 'dock-director'), { arc: g.pick(ARCS), period: g.range(420, 780), establish: () => establish() }),
    name: g.pick(DOCKS), programme: g.pick(PROGRAMMES), mood, setting, flip, cast: [], castIds: [],
    day: g.weighted({ night: 5, dusk: 2, dawn: 2, day: 2 }) === 'night' ? g.range(0.86, 1.12) % 1 : g.range(0.22, 0.8), dayLen: 1500,
    x0, doorX, wallT, floorY, ceilY, roofY, apronX, dx: dockDX, dy: dockDY, standY, deckY, door: 0, doorTop, bays, laneX, pads,
    HY, NY, yOf, mOf, coastX, fightX, riftX, bridge, bridgeD, bridgeX0: Math.min(GW * g.range(0.74, 0.8), coastX(bridgeD) - 160 * u), bridgeX1: coastX(bridgeD), bridgeBroken: 0,
    mechs: [], monsters: [], helis: [], ships: [], buildings: [], crew: [], cranes: [], lifts: [], vehicles: [], fx: [],
    phase: 'quiet', breachT: 0, clock: g.range(32, 55), alarm: 0, evac: 0, riftPulse: 0, fightD,
    rain: g.range(0.45, 0.9), wind: g.range(-1, 1), storm: g.range(0.2, 0.6), flash: 0, bolt: null, fog: 0, swell: 0.5, fireworks: 0,
    kills: 0, lost: 0, breaches: 0, doubles: 0, buildingsLost: 0, overloads: 0,
    captions: [], subs: [], marks: [],
    control: { line: '', lineT: -99 },
    labels: [], chronicle: [],
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    step, nudge,
    counts: () => ({
      ready: world.mechs.filter((m) => m.state === 'bay' && m.hp >= READY).length,
      out: world.mechs.filter((m) => out(m)).length,
      mechs: world.mechs.length,
      monsters: world.monsters.filter((q) => alive(q)).length,
      crew: world.crew.length,
      helis: world.helis.length,
      ships: world.ships.filter((s) => s.state !== 'sunk').length,
      standing: world.buildings.filter((b) => b.fall < 1).length,
      kills: world.kills,
      lost: world.lost,
      fx: world.fx.length,
    }),
  };
  const READY = 0.55;
  const alive = (q: Monster) => q.state === 'rising' || q.state === 'advance' || q.state === 'fight' || q.state === 'rampage';
  const out = (m: Mech) => m.state !== 'bay' && m.state !== 'lost' && m.state !== 'building';

  // ---- the verbs -------------------------------------------------------------------------------------
  const seaY = (x: number, d: number, alt = 0) => {
    void x;
    return yOf(d) - alt * mOf(d);
  };
  function establish(): { x: number; y: number; zoom: number } {
    const busy = world?.mechs?.filter((m) => m.state === 'bay' && m.hp < 1) ?? [];
    const k = shotR();
    if (busy.length && k < 0.5) {
      const m = busy[Math.floor(shotR() * busy.length)];
      return { x: m.x, y: floorY - mechH * 0.5, zoom: 2.2 };
    }
    if (k < 0.75) return { x: doorX * 0.5, y: (ceilY + floorY) / 2, zoom: 1.6 };
    return { x: (doorX + GW) / 2, y: HY, zoom: 1.4 };
  }
  const say = (text: string, x: number, y: number, color = '#e8eef2') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    world.labels.push({ text, x, y, t0: world.t, color });
    if (world.labels.length > 5) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, priority: 'high' });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };
  const look = (why: string, x: number, y: number, zoom: number, hold: number, priority: number) => world.director.look(why, x, y, zoom, hold, priority);
  const fx = (kind: FxKind, x: number, y: number, d: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 700) return;
    world.fx.push({ kind, x, y, d, vx: 0, vy: 0, t0: world.t, dur: 1, r: 3 * u, color: '#ffd890', seed: Math.floor(r() * 1e6), ...extra });
  };
  /** A line on the radio: queued after whatever is being said, as subtitles are. */
  const sub = (who: string, text: string) => {
    const subs = world.subs;
    if (subs.some((q) => q.text === text && world.t - q.t0 < 20)) return;
    while (subs.length && subs[0].t0 + subs[0].dur < world.t) subs.shift();
    if (subs.length >= 3) return;
    const last = subs[subs.length - 1];
    const t0 = last ? Math.max(world.t, last.t0 + last.dur) : world.t;
    subs.push({ who, text, t0, dur: Math.max(3.2, 1.2 + text.length * 0.06) });
  };
  const radio = (m: Mech, line: string) => {
    m.line = line;
    m.lineT = world.t;
    sub(`${m.name}${m.pilots ? ` · ${m.pilots[0]} & ${m.pilots[1]}` : ''}`, line);
  };
  const control = (line: string) => {
    world.control = { line, lineT: world.t };
    sub(`${world.name} CONTROL`, line);
  };
  /** A title card, for the moments that matter: one at a time, queued. */
  const caption = (text: string, subline = '', color = '#f2f4f6') => {
    const cs = world.captions;
    while (cs.length && cs[0].t0 + cs[0].dur < world.t) cs.shift();
    if (cs.some((q) => q.text === text) || cs.length >= 3) return;
    const last = cs[cs.length - 1];
    cs.push({ text, sub: subline, t0: last ? Math.max(world.t, last.t0 + last.dur) : world.t, dur: 5.5, color });
  };
  const titled = (s: string) => s.toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase());
  const ctx: Ctx = { world, r, say, emit, chronicle, look, fx, seaY, radio, control, caption };
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];

  // ---- the mechs -------------------------------------------------------------------------------------
  const mg = g.fork('roster');
  const nameDeck = mg.shuffle(MECH_NAMES);
  const pilotDeck = mg.shuffle(PILOTS);
  const liveryDeck = mg.shuffle(LIVERIES);
  let nameNo = 0;
  let markTop = 0;
  function newMech(bay: number, mark: number): Mech {
    const lv = liveryDeck[(nameNo + bay) % liveryDeck.length];
    const name = nameDeck[nameNo % nameDeck.length];
    nameNo++;
    const build = BUILDS[Math.floor(r() * BUILDS.length)];
    const ws: Weapon[] = [];
    const primary = pick<Weapon>(['plasma', 'sword', 'cannon', 'chain', 'missiles', 'fists', 'plasma', 'sword']);
    ws.push(primary);
    if (r() < 0.7) {
      const second = pick<Weapon>(['plasma', 'cannon', 'missiles', 'sword', 'chain']);
      if (second !== primary) ws.push(second);
    }
    markTop = Math.max(markTop, mark);
    return {
      id: ids++, name, mark, build, seed: Math.floor(r() * 1e6),
      colors: { main: lv[0], second: lv[1], trim: lv[2], core: pick(CORES), visor: r() < 0.6 ? '#a8ecff' : '#ffd27a' },
      weapons: ws, emblem: pick(EMBLEMS), pilots: [pilotDeck[(nameNo * 2) % pilotDeck.length], pilotDeck[(nameNo * 2 + 1) % pilotDeck.length]],
      bay, state: 'bay', t0: 0, x: bays[bay].x, d: 0, alt: NY - standY, dir: 1, H: mechH * (0.94 + r() * 0.1),
      hp: 1, kills: 0, sorties: 0, dmg: { head: 0, chest: 0, armF: 0, armB: 0, legs: 0 }, repair: 0, ph: r() * 6, act: null, tilt: 0, wade: 0, burn: 0,
      line: '', lineT: -99, built: 1,
    };
  }
  for (let b = 0; b < nBays; b++) {
    const m = newMech(b, 2 + Math.floor(r() * 4));
    // Some come to the seed already battered, and are on the scaffolds.
    if (r() < 0.45) {
      m.hp = 0.35 + r() * 0.5;
      damage(m, 1 - m.hp, true);
    }
    world.mechs.push(m);
  }

  function damage(m: Mech, amount: number, spread = false) {
    const parts = ['head', 'chest', 'armF', 'armB', 'legs'] as const;
    const n = spread ? 5 : 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const p = parts[Math.floor(r() * parts.length)];
      m.dmg[p] = Math.min(1, m.dmg[p] + amount * (spread ? 1 : 2.2) * (0.6 + r() * 0.8));
    }
  }

  // ---- the monsters ------------------------------------------------------------------------------
  const kindsHere: MonsterKind[] = g.fork('monsters').subset(['crab', 'winged', 'horned', 'veined', 'serpent'] as MonsterKind[], 3, 5);
  const monsterDeck = g.fork('monster-names').shuffle(MONSTER_NAMES);
  let monsterNo = 0;
  function newMonster(second = false): Monster {
    const kind = kindsHere[Math.floor(r() * kindsHere.length)];
    // Categories climb a little as the war goes on, and a second monster is the smaller.
    const base = 1 + Math.floor(r() * 3) + (world.breaches > 3 && r() < 0.4 ? 1 : 0) + (world.breaches > 8 && r() < 0.25 ? 1 : 0);
    const cat = Math.max(1, Math.min(5, second ? base - 1 : base));
    const hide = pick(HIDES);
    const hp0 = 0.9 + cat * 0.32;
    const name = monsterDeck[monsterNo++ % monsterDeck.length];
    return {
      id: ids++, name, kind, cat, seed: Math.floor(r() * 1e6),
      colors: { hide: hide[0], dark: hide[1], glow: kind === 'veined' ? pick(['#5af0ff', '#9cff6a', '#ff7ae0']) : hide[2], belly: hide[3] },
      x: riftX + (r() - 0.5) * 80 * u, d: 0.84 + r() * 0.06, alt: 0, dir: -1, H: mechH * (0.82 + cat * 0.1) * (kind === 'crab' ? 0.78 : kind === 'serpent' ? 1.05 : 1),
      hp: hp0, hp0, state: 'rising', t0: world.t, ph: r() * 6, act: null, tilt: 0, left: 1, flying: 0, second,
    };
  }

  // ---- the city across the bay -----------------------------------------------------------------------
  const cg = g.fork('city');
  {
    // Rows of buildings back from the waterfront: a city's towers, a fjord town's houses under the cliff, a refinery's
    // tanks and stacks, an island's far city; the harbour's cranes on the quay.
    type K = Building['kind'];
    const mixOf: Record<Setting, Partial<Record<K, number>>> = {
      harbour: { tower: 3, block: 4, spire: 1, slab: 2 },
      fjord: { house: 6, block: 2, spire: 0.4 },
      refinery: { tank: 4, stack: 2, block: 2, slab: 1 },
      island: { tower: 3, block: 3, slab: 2 },
    };
    const dims = (kind: K): [number, number] => {
      switch (kind) {
        case 'crane': return [70, 210];
        case 'spire': return [46, setting === 'fjord' ? cg.range(160, 220) : cg.range(620, 980)];
        case 'tower': return [cg.range(60, 110), cg.range(380, 760)];
        case 'slab': return [cg.range(80, 160), cg.range(260, 420)];
        case 'house': return [cg.range(30, 50), cg.range(34, 60)];
        case 'tank': return [cg.range(70, 120), cg.range(60, 100)];
        case 'stack': return [22, cg.range(260, 420)];
        default: return [cg.range(80, 160), setting === 'fjord' ? cg.range(60, 120) : cg.range(130, 280)];
      }
    };
    for (let d = 0.06; d < 0.8; d += cg.range(0.018, 0.03)) {
      const cx = coastX(d);
      const m = mOf(d);
      let x = cx + cg.range(30, 70) * u * m;
      for (let k = 0; k < (setting === 'fjord' ? 4 : 6) && x < GW + 60 * u; k++) {
        const kind: K = k === 0 && setting !== 'fjord' && cg.chance(setting === 'refinery' ? 0.45 : 0.3) ? 'crane' : cg.weighted(mixOf[setting] as Record<K, number>);
        const [w0, h0] = dims(kind);
        const w = w0 * u;
        const h = h0 * u * (1 + (1 - d) * 0.2);
        world.buildings.push({ id: ids++, x: x + (w * m) / 2, d, w, h, seed: Math.floor(cg.unit() * 1e6), kind, fall: 0, t0: -99, lit: cg.range(0.3, 0.9) });
        x += w * m + cg.range(4, 30) * u * m;
      }
    }
    // Far out: the island's oil rigs on their legs, in the open sea where the fights are.
    if (setting === 'island') {
      for (let k = 0; k < (phone ? 2 : 3); k++) {
        const d = fightD + 0.06 + k * 0.09;
        world.buildings.push({ id: ids++, x: fightX(d) + (k % 2 ? 0.5 : -0.2) * mechH * mOf(d) + mechH * 0.3, d, w: 150 * u, h: 230 * u, seed: Math.floor(cg.unit() * 1e6), kind: 'rig', fall: 0, t0: -99, lit: 0.8 });
      }
    }
    world.buildings.sort((a, b) => b.d - a.d);
  }
  // Ships in the harbour, moored along the waterfront; a tug or two about.
  for (let k = 0; k < (setting === 'island' ? 0 : phone ? 2 : 4); k++) {
    const d = 0.14 + k * 0.11 + cg.range(-0.02, 0.02);
    const kind = setting === 'fjord' ? cg.pick(['ferry', 'trawler', 'trawler'] as const) : setting === 'refinery' ? cg.pick(['tanker', 'tanker', 'container'] as const) : cg.pick(['container', 'tanker', 'container', 'ferry', 'trawler'] as const);
    const len = kind === 'trawler' ? 90 : kind === 'ferry' ? 160 : 260;
    world.ships.push({ id: ids++, kind, x: coastX(d) - (len * u * mOf(d)) / 2 - 16 * u * mOf(d), d, dir: cg.chance(0.5) ? 1 : -1, speed: 0, len: len * u, seed: Math.floor(cg.unit() * 1e6), state: 'moored', t0: 0, tx: 0, heel: 0 });
  }
  world.ships.push({ id: ids++, kind: 'tug', x: GW * 0.75, d: 0.2, dir: -1, speed: 14 * u, len: 50 * u, seed: 7, state: 'sail', t0: 0, tx: GW * 0.6, heel: 0 });

  // ---- the helicopters: the deck's lift team, the patrols -------------------------------------------
  const nLift = phone ? 4 : 6;
  const HELI_NAMES = ['LIFT ONE', 'LIFT TWO', 'LIFT THREE', 'LIFT FOUR', 'LIFT FIVE', 'LIFT SIX'];
  const roofAlt = NY - deckY;
  for (let k = 0; k < nLift; k++) {
    const onPad = k < pads.length;
    world.helis.push({
      id: ids++, name: HELI_NAMES[k], role: 'deck', x: onPad ? pads[k] : -200 * u, d: 0, alt: onPad ? roofAlt : roofAlt + 200 * u, dir: 1, seed: Math.floor(r() * 1e6),
      rotor: onPad ? 0.15 : 1, lamp: false, pad: onPad ? k : -1, state: onPad ? 'parked' : 'hold', t0: 0, tx: 0, td: 0, talt: 0, cx: 0, cd: 0, ph: r() * 6, slot: k, cable: 0,
    });
  }
  for (let k = 0; k < (phone ? 1 : 2); k++) {
    world.helis.push({
      id: ids++, name: k ? 'PATROL TWO' : 'PATROL ONE', role: 'patrol', x: GW * (0.6 + k * 0.15), d: 0.18 + k * 0.2, alt: (150 + k * 40) * u, dir: k ? -1 : 1, seed: Math.floor(r() * 1e6),
      rotor: 1, lamp: true, pad: -1, state: 'circle', t0: 0, tx: 0, td: 0, talt: 0, cx: GW * (0.64 + k * 0.12), cd: 0.2 + k * 0.22, ph: r() * 6, slot: -1, cable: 0,
    });
  }

  // ---- the crews ---------------------------------------------------------------------------------
  const HATS = ['#f0c020', '#f07a1a', '#e8e8e0', '#2a8ad8', '#e83a2a'];
  const levelsOf = (m: Mech) => {
    void m;
    return [standY - mechH * 0.3, standY - mechH * 0.56, standY - mechH * 0.8];
  };
  const nCrew = Math.round((phone ? 14 : 30) * traffic);
  for (let k = 0; k < nCrew; k++) {
    const deck = k < (phone ? 1 : 3);
    const p: Person = { id: ids++, x: deck ? pads[k % pads.length] : x0 + r() * (laneX - x0), y: deck ? deckY : standY, dir: r() < 0.5 ? 1 : -1, seed: Math.floor(r() * 1e6), ph: r() * 6, job: deck ? 'marshal' : 'walk', tx: 0, ty: standY, at: -1, t0: 0, hat: pick(HATS), speed: (14 + r() * 8) * u };
    world.crew.push(p);
    plan(p);
  }
  for (let k = 0; k < Math.max(2, nBays - (phone ? 0 : 1)); k++) world.cranes.push({ id: ids++, x: bays[k % nBays].x, tx: bays[k % nBays].x, hook: 0.2, thook: 0.2, load: 'none', state: 'idle', t0: r() * 6, bay: k % nBays, seed: Math.floor(r() * 1e6) });
  for (let b = 0; b < nBays; b++) world.lifts.push({ id: ids++, bay: b, side: b % 2 ? 1 : -1, y: standY - r() * mechH * 0.8, ty: standY, t0: 0 });
  for (let k = 0; k < (phone ? 2 : 4); k++) world.vehicles.push({ id: ids++, x: x0 + r() * (laneX - x0), tx: x0 + r() * (laneX - x0), dir: 1, kind: pick(['tug', 'fork', 'truck'] as const), seed: Math.floor(r() * 1e6), wait: r() * 4, load: r() < 0.5 });

  /** A new job for one of the crew: weld where the mending is, walk the floor, mind the door, marshal the deck. */
  function plan(p: Person) {
    const hurt = world.mechs.filter((m) => m.state === 'bay' && m.hp < 1).concat(world.mechs.filter((m) => m.state === 'building'));
    const roll = r();
    p.t0 = world.t;
    if (p.job === 'marshal') {
      p.tx = pads[Math.floor(r() * pads.length)] + (r() - 0.5) * 50 * u;
      p.ty = deckY;
      return;
    }
    if (roll < 0.5 && world.mechs.some((m) => m.state === 'bay' || m.state === 'building')) {
      // Weld on a platform at a mech's side (where the mending is, mostly).
      const ms = hurt.length && r() < 0.8 ? hurt : world.mechs.filter((m) => m.state === 'bay' || m.state === 'building');
      const m = ms[Math.floor(r() * ms.length)];
      const lv = levelsOf(m);
      const side = r() < 0.5 ? -1 : 1;
      p.job = 'weld';
      p.at = m.id;
      p.tx = m.x + side * (m.H * (m.build === 'broad' ? 0.24 : 0.2) + 4 * u) + (r() - 0.5) * 10 * u;
      p.ty = r() < 0.25 ? standY : lv[Math.floor(r() * lv.length)];
      p.dir = side > 0 ? -1 : 1;
      return;
    }
    if (roll < 0.62) {
      p.job = 'watch';
      p.tx = laneX + r() * (doorX - wallT / 2 - laneX - 6 * u);
      p.ty = standY;
      return;
    }
    p.job = 'walk';
    p.tx = x0 + 10 * u + r() * (laneX - x0);
    p.ty = standY;
  }

  // ---- the cast library -----------------------------------------------------------------------------
  const bay0 = () => bays[0];
  const LIBRARY: SystemDef<Ctx>[] = [
    {
      id: 'squalls', label: 'squalls', weight: 6, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        return {
          id: 'squalls',
          step(dt) {
            if (until <= w.t && w.t > 30 && w.director.want('squall', 0.35, 150)) {
              until = w.t + 50 + c.r() * 50;
              c.say('A SQUALL COMES IN OFF THE SEA', (doorX + GW) / 2, HY - 40 * u, '#cfe0ea');
              c.emit('squall', (doorX + GW) / 2, HY, 0.4);
            }
            const target = w.t < until ? 1 : 0.35;
            w.storm += (target - w.storm) * Math.min(1, dt * 0.08);
            w.rain += ((w.t < until ? 1 : 0.6) - w.rain) * Math.min(1, dt * 0.05);
            // The mast takes a strike; the surf comes over the apron.
            if (w.t < until && c.r() < dt * 0.012) {
              w.flash = 1;
              w.bolt = { x: doorX - 60 * u, y0: 0, y1: roofY - 70 * u, seed: Math.floor(c.r() * 1e6), t0: w.t };
              c.say('LIGHTNING ON THE DOCK\'S MAST', doorX - 60 * u, roofY - 90 * u, '#e8f0ff');
              c.emit('strike', doorX - 60 * u, roofY, 0.3);
            }
            if (w.t < until && c.r() < dt * 0.03) {
              for (let k = 0; k < 8; k++) c.fx('spray', doorX + wallT / 2 + c.r() * (apronX - doorX), floorY - 4 * u, -1, { vx: (c.r() - 0.6) * 40 * u, vy: -(60 + c.r() * 80) * u, dur: 1.4, r: (8 + c.r() * 10) * u, color: '#dfeaf0' });
              c.emit('surf', apronX, floorY, 0.1);
            }
          },
        };
      },
    },
    {
      id: 'fog', label: 'sea fog', weight: 4, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let horn = 0;
        return {
          id: 'fog',
          step(dt) {
            if (until <= w.t && w.t > 60 && w.director.want('fog', 0.3, 300)) {
              until = w.t + 90 + c.r() * 90;
              c.say('SEA FOG ROLLS IN OVER THE BAY', (doorX + GW) / 2, HY - 30 * u, '#d8e0e4');
              c.emit('fog', (doorX + GW) / 2, HY, 0.3);
            }
            w.fog += ((w.t < until ? 1 : 0) - w.fog) * Math.min(1, dt * 0.06);
            if (w.fog > 0.5 && w.t > horn) {
              horn = w.t + 25 + c.r() * 15;
              c.emit('foghorn', coastX(0.3), yOf(0.3), 0.15);
              c.say('THE FOGHORN ON THE HARBOUR WALL', coastX(0.35), yOf(0.35) - 40 * u, '#d8e0e4');
            }
          },
        };
      },
    },
    {
      id: 'convoy', label: 'the convoys', weight: 5, tags: ['harbour'],
      create: (c) => {
        const w = c.world;
        let next = 40;
        return {
          id: 'convoy',
          step() {
            if (w.t < next || w.phase === 'fight') return;
            next = w.t + 90 + c.r() * 90;
            const moored = w.ships.filter((s) => s.state === 'moored' && s.kind !== 'tug');
            if (moored.length > 2 && c.r() < 0.5) {
              const s = moored[Math.floor(c.r() * moored.length)];
              s.state = 'sail';
              s.dir = -1;
              s.speed = 12 * u;
              s.tx = -400 * u;
              c.say(`A ${s.kind === 'tanker' ? 'TANKER' : s.kind === 'ferry' ? 'FERRY' : 'CONTAINER SHIP'} PUTS OUT FROM THE HARBOUR`, s.x, seaY(s.x, s.d) - 50 * u * mOf(s.d), '#d8e4ea');
              c.emit('ship-out', s.x, seaY(s.x, s.d), 0.2);
            } else {
              const d = 0.16 + c.r() * 0.36;
              const kind = c.r() < 0.5 ? 'container' : c.r() < 0.5 ? 'tanker' : 'ferry';
              const len = (kind === 'ferry' ? 160 : 260) * u;
              const s: Ship = { id: ids++, kind, x: doorX + 40 * u, d, dir: 1, speed: 14 * u, len, seed: Math.floor(c.r() * 1e6), state: 'sail', t0: w.t, tx: coastX(d) - (len * mOf(d)) / 2 - 16 * u * mOf(d), heel: 0 };
              w.ships.push(s);
              c.say(`A CONVOY COMES IN UNDER ESCORT`, (doorX + GW) / 2, yOf(s.d) - 40 * u, '#d8e4ea');
              c.emit('ship-in', s.x, seaY(s.x, s.d), 0.2);
            }
          },
        };
      },
    },
    {
      id: 'bonetrade', label: 'the bone merchants', weight: 3, tags: ['harbour'],
      create: (c) => {
        const w = c.world;
        let done = -1;
        return {
          id: 'bonetrade',
          step() {
            const carcass = w.monsters.find((q) => q.state === 'carcass' && q.left < 0.8 && q.left > 0.3);
            if (!carcass || done === carcass.id) return;
            done = carcass.id;
            const s: Ship = { id: ids++, kind: 'barge', x: carcass.x - 300 * u * mOf(carcass.d), d: Math.min(0.8, carcass.d + 0.04), dir: 1, speed: 10 * u, len: 120 * u, seed: Math.floor(c.r() * 1e6), state: 'sail', t0: w.t, tx: carcass.x - carcass.H * 0.4 * mOf(carcass.d), heel: 0 };
            w.ships.push(s);
            c.say(`THE BONE MERCHANTS' BARGE COMES FOR ${carcass.name}`, s.x, seaY(s.x, s.d) - 50 * u * mOf(s.d), '#c8f0e8');
            c.emit('smuggle', s.x, seaY(s.x, s.d), 0.3);
            c.chronicle(`The bone merchants came by barge for what was left of ${titled(carcass.name)}; nobody stopped them.`);
          },
        };
      },
    },
    {
      id: 'testfire', label: 'weapons tests', weight: 5, tags: ['dock'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'testfire',
          step() {
            if (w.phase !== 'quiet' || w.clock < 30 || !w.director.want('test', 0.3, 110)) return;
            const ms = w.mechs.filter((m) => m.state === 'bay' && m.hp > 0.8);
            const m = ms[Math.floor(c.r() * ms.length)];
            if (!m) return;
            const wpn = m.weapons[0];
            m.act = { kind: wpn === 'sword' || wpn === 'chain' ? 'test-blade' : 'test-fire', t0: w.t, dur: 3, hit: false, power: 0.5 };
            const what = wpn === 'plasma' ? 'PLASMA CASTER' : wpn === 'cannon' ? 'SHOULDER CANNON' : wpn === 'missiles' ? 'MISSILE PODS' : wpn === 'sword' ? 'BLADE' : wpn === 'chain' ? 'CHAIN BLADE' : 'ELBOW ROCKETS';
            c.say(`${m.name}: ${what} TEST, ALL GREEN`, m.x, floorY - m.H * 1.05, '#ffe2a0');
            c.emit('test', m.x, floorY - m.H * 0.6, 0.25);
            c.radio(m, `${what} CYCLING. LOOKS GOOD FROM HERE.`);
          },
        };
      },
    },
    {
      id: 'refits', label: 'refits', weight: 4, tags: ['dock'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'refits',
          step() {
            if (w.phase !== 'quiet' || !w.director.want('refit', 0.3, 200)) return;
            const ms = w.mechs.filter((m) => m.state === 'bay');
            const m = ms[Math.floor(c.r() * ms.length)];
            if (!m) return;
            const add = (['plasma', 'cannon', 'missiles', 'sword', 'chain'] as Weapon[]).find((x) => !m.weapons.includes(x) && c.r() < 0.5);
            if (!add) return;
            if (m.weapons.length >= 2) m.weapons.shift();
            m.weapons.push(add);
            const cr = w.cranes[Math.floor(c.r() * w.cranes.length)];
            if (cr) Object.assign(cr, { state: 'fetch', bay: m.bay, load: add === 'plasma' ? 'core' : add === 'cannon' || add === 'missiles' ? 'barrel' : 'arm', t0: w.t, tx: laneX - 30 * u });
            const what = add === 'plasma' ? 'A PLASMA CASTER' : add === 'cannon' ? 'A SHOULDER CANNON' : add === 'missiles' ? 'MISSILE PODS' : add === 'sword' ? 'A BLADE' : 'A CHAIN BLADE';
            c.say(`THE CRANES FIT ${m.name} WITH ${what}`, m.x, floorY - m.H * 1.05, '#ffe2a0');
            c.emit('refit', m.x, floorY - m.H, 0.3);
            c.chronicle(`${titled(m.name)} was refitted with ${what.toLowerCase()}.`);
          },
        };
      },
    },
    {
      id: 'doubles', label: 'double events', weight: 3, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        const decided = new Set<number>();
        return {
          id: 'doubles',
          step() {
            // A second monster after the first, now and then, once the war is under way.
            const first = w.monsters.find((q) => q.state === 'rising' && !q.second && w.t - q.t0 > 4 && w.t - q.t0 < 5);
            if (!first || decided.has(first.id)) return;
            decided.add(first.id);
            if (w.breaches < 3 || w.monsters.some((q) => q.second && alive(q)) || c.r() > 0.25) return;
            const q = newMonster(true);
            q.x = first.x + (c.r() < 0.5 ? -1 : 1) * 160 * u;
            w.monsters.push(q);
            w.doubles++;
            c.caption('DOUBLE EVENT', `${q.name} · SURGE ${roman(q.cat)} · BEHIND ${first.name}`, '#ff9a8a');
            c.say(`DOUBLE EVENT! ${q.name} SURFACES BEHIND IT: SURGE-${q.cat}`, q.x, seaY(q.x, q.d) - q.H * mOf(q.d), '#ff9a8a');
            c.emit('double', q.x, seaY(q.x, q.d), 0.8);
            c.chronicle(`A double event: ${titled(q.name)} came through behind ${titled(first.name)}.`);
            c.control('DOUBLE EVENT. SECOND MECH TO THE APRON.');
            queue++;
          },
        };
      },
    },
    {
      id: 'skitters', label: 'skitters on the beach', weight: 4, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        let hunt: { x: number; d: number; t0: number } | null = null;
        return {
          id: 'skitters',
          step(dt) {
            if (!hunt) {
              if (w.phase !== 'quiet' || w.t < 50 || !w.director.want('skitter', 0.35, 220)) return;
              const d = 0.12 + c.r() * 0.15;
              hunt = { x: coastX(d) - 20 * u, d, t0: w.t };
              c.say('SKITTERS ON THE HARBOUR BEACH: SURGE-1, THREE OF THEM', hunt.x, seaY(hunt.x, d) - 60 * u, '#ffb0a0');
              c.emit('skitter', hunt.x, seaY(hunt.x, d), 0.4);
              const p = w.helis.find((h) => h.role === 'patrol');
              if (p) Object.assign(p, { cx: hunt.x - 60 * u, cd: d });
              return;
            }
            const age = w.t - hunt.t0;
            if (age > 6 && age < 14 && c.r() < dt * 6) {
              const p = w.helis.find((h) => h.role === 'patrol');
              if (p) c.fx('tracer', p.x, seaY(p.x, p.d, p.alt), p.d, { tx: hunt.x + (c.r() - 0.5) * 30 * u, ty: seaY(hunt.x, hunt.d), dur: 0.25, color: '#ffd070' });
              c.fx('splash', hunt.x + (c.r() - 0.5) * 40 * u, seaY(hunt.x, hunt.d), hunt.d, { dur: 0.8, r: 8 * u });
            }
            if (age > 15) {
              c.say('THE PATROL GUNS THE SKITTERS DOWN', hunt.x, seaY(hunt.x, hunt.d) - 60 * u, '#e8eef2');
              c.emit('gunrun', hunt.x, seaY(hunt.x, hunt.d), 0.3);
              const p = w.helis.find((h) => h.role === 'patrol');
              if (p) Object.assign(p, { cx: GW * 0.66, cd: 0.22 });
              hunt = null;
            }
          },
          counts: () => ({ skitters: hunt ? 3 : 0 }),
        };
      },
    },
    {
      id: 'fireworks', label: 'fireworks over the harbour', weight: 4, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        let seen = 0;
        return {
          id: 'fireworks',
          step(dt) {
            if (w.kills > seen && w.phase === 'quiet') {
              seen = w.kills;
              w.fireworks = 1;
              c.say('THE CITY LIGHTS FIREWORKS OVER THE HARBOUR', coastX(0.45), yOf(0.45) - 200 * u * mOf(0.45), '#ffd0f0');
              c.emit('fireworks', coastX(0.45), yOf(0.45), 0.4);
            }
            if (w.fireworks <= 0) return;
            w.fireworks = Math.max(0, w.fireworks - dt / 50);
            if (c.r() < dt * 2.2) {
              const d = 0.3 + c.r() * 0.35;
              const x = coastX(d) + (40 + c.r() * 200) * u * mOf(d);
              c.fx('firework', x, seaY(x, d, (300 + c.r() * 300) * u), d, { dur: 2.2, r: (40 + c.r() * 50) * u, color: c.r() < 0.33 ? '#ff7ab0' : c.r() < 0.5 ? '#7ad8ff' : '#ffe07a' });
              if (c.r() < 0.3) c.emit('bang', x, seaY(x, d), 0.06);
            }
          },
        };
      },
    },
    {
      id: 'research', label: 'the rift lab', weight: 4, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        let done = -1;
        return {
          id: 'research',
          step() {
            const carcass = w.monsters.find((q) => q.state === 'carcass' && q.left < 0.9);
            if (!carcass || done === carcass.id || w.phase !== 'quiet') return;
            done = carcass.id;
            const sooner = c.r() < 0.5;
            w.clock = Math.max(25, w.clock * (sooner ? 0.7 : 1.25));
            c.say(`THE LAB READS ${carcass.name}'S BLOOD: THE CLOCK IS REVISED ${sooner ? 'DOWN' : 'UP'}`, laneX - 60 * u, ceilY + 40 * u, '#b8f0ff');
            c.emit('revise', laneX, ceilY, 0.3);
            c.chronicle(`The rift lab sampled ${titled(carcass.name)} and revised the breach clock ${sooner ? 'down' : 'up'}.`);
            c.control(`CLOCK REVISED ${sooner ? 'DOWN' : 'UP'}. ${sooner ? 'THE NEXT ONE COMES SOONER.' : 'WE HAVE A LITTLE LONGER.'}`);
          },
        };
      },
    },
    {
      id: 'whales', label: 'whales in the bay', weight: 3, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'whales',
          step() {
            if (w.phase !== 'quiet' || w.t < 40) return;
            if (w.clock < 25 && w.clock > 24 && w.director.want('whales-flee', 0.2, 200)) {
              c.say('THE WHALES LEAVE THE BAY. THEY KNOW', GW * 0.7, yOf(0.4) - 30 * u, '#cfe8f0');
              c.emit('omen', GW * 0.7, yOf(0.4), 0.3);
              return;
            }
            if (w.clock > 60 && w.director.want('whales', 0.25, 180)) {
              const d = 0.3 + c.r() * 0.3;
              const x = doorX + (0.2 + c.r() * 0.4) * (coastX(d) - doorX);
              for (let k = 0; k < 3; k++) c.fx('spray', x + k * 40 * u * mOf(d), seaY(x, d), d, { vy: -40 * u, dur: 2, r: 14 * u, color: '#e8f0f4', tx: 1 });
              c.say('WHALES SPOUTING IN THE BAY', x, seaY(x, d) - 40 * u, '#cfe8f0');
              c.emit('whales', x, seaY(x, d), 0.2);
            }
          },
        };
      },
    },
    {
      id: 'drills', label: 'shelter drills', weight: 3, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'drills',
          step() {
            if (w.phase !== 'quiet' || w.clock < 60 || !w.director.want('drill', 0.3, 260)) return;
            w.evac = Math.max(w.evac, 0.6);
            c.say('A SHELTER DRILL IN THE CITY: THE SIRENS ON THE WATERFRONT', coastX(0.3), yOf(0.3) - 160 * u * mOf(0.3), '#ffd8a0');
            c.emit('drill', coastX(0.3), yOf(0.3), 0.3);
          },
        };
      },
    },
  ];
  const RULE = { total: [4, 6] as [number, number], quota: { weather: [1, 2] as [number, number], threat: [0, 1] as [number, number], wonder: [0, 1] as [number, number], harbour: [0, 2] as [number, number], dock: [0, 2] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);
  void bay0;

  // ---- the round: the clock, the alarm, the launch, the fight, the way home ------------------------
  /** Mechs still to send out this round. */
  let queue = 0;
  /** The mech the lift team is on now (out or home), and what it is doing. */
  let lifting: Mech | null = null;
  let liftJob: 'out' | 'home' | null = null;
  const said = new Set<string>();
  function sayOnce(key: string, fn: () => void) {
    if (said.has(key)) return;
    said.add(key);
    fn();
  }
  
  function readyMech(): Mech | null {
    const ms = world.mechs.filter((m) => m.state === 'bay').sort((a, b) => b.hp - a.hp);
    if (!ms.length) return null;
    return ms[0].hp >= 0.5 ? ms[0] : null;
  }

  function breach() {
    world.phase = 'alarm';
    world.breaches++;
    world.alarm = 1;
    world.breachT = world.t;
    world.riftPulse = 1;
    said.clear();
    const q = newMonster();
    world.monsters.push(q);
    queue = 1;
    say('BREACH ALERT! THE RIFT IS OPEN', laneX - 40 * u, ceilY + 30 * u, '#ff8a7a');
    caption('BREACH', `THE RIFT IS OPEN · BREACH ${world.breaches} AT ${world.name}`, '#ff9a8a');
    emit('alarm', laneX, ceilY + 40 * u, 0.9);
    control('ALL HANDS, BREACH ALERT. THIS IS NOT A DRILL.');
    look('rift', riftX, HY, 1.6, 8, 7);
  }

  function round(dt: number) {
    world.alarm = Math.max(0, world.alarm - dt / (world.phase === 'alarm' || world.phase === 'launch' ? 60 : 6));
    world.riftPulse = Math.max(0, world.riftPulse - dt / 30);
    world.evac = Math.max(0, world.evac - dt / 90);
    if (world.phase === 'quiet') {
      world.clock -= dt;
      const c = world.clock;
      for (const mark of [60, 30, 10]) {
        if (c < mark && c + dt >= mark) {
          say(mark === 10 ? 'THE BREACH CLOCK: TEN SECONDS' : `THE BREACH CLOCK: ${mark} SECONDS TO THE NEXT ONE`, laneX - 40 * u, ceilY + 30 * u, mark === 10 ? '#ffb0a0' : '#e8eef2');
          emit('clock', laneX, ceilY + 40 * u, 0.15);
          if (mark === 30) control('THIRTY SECONDS. PILOTS TO THE CONN-PODS.');
          world.riftPulse = Math.max(world.riftPulse, 0.4);
        }
      }
      if (c <= 0 && (world.director.want('breach', 0.6, 40) || c < -20)) breach();
      return;
    }
    // The monsters: when to send the mechs, and when the round is over.
    const live = world.monsters.filter(alive);
    if (queue > 0 && !lifting) {
      const m = readyMech();
      if (m) {
        queue--;
        launch(m);
      } else if (!world.mechs.some((x) => out(x))) {
        queue = 0;
        sayOnce('nomech', () => {
          say('NO MECH FIT TO FIGHT. THE CITY IS ON ITS OWN', laneX - 40 * u, ceilY + 30 * u, '#ff8a7a');
          chronicle('There was no mech fit to send; the city was evacuated and waited.');
          world.evac = 1;
          emit('evac', coastX(0.3), yOf(0.3), 0.6);
        });
      } else queue = 0;
    }
    if (world.phase === 'alarm' && world.mechs.some((m) => m.state === 'walkout' || m.state === 'hook' || m.state === 'carried')) world.phase = 'launch';
    if ((world.phase === 'launch' || world.phase === 'alarm') && world.mechs.some((m) => m.state === 'fight')) world.phase = 'fight';
    if (world.phase !== 'aftermath' && !live.length && world.t > 5) {
      world.phase = 'aftermath';
      queue = 0;
      control('THE BAY IS CLEAR. BRING THEM HOME.');
    }
    if (world.phase === 'aftermath' && !world.mechs.some((m) => out(m)) && !lifting) {
      world.phase = 'quiet';
      world.clock = 150 + r() * 130;
      say(`THE CLOCK IS RESET: ${Math.floor(world.clock / 60)} MINUTES ${Math.round(world.clock % 60)} SECONDS TO THE NEXT`, laneX - 40 * u, ceilY + 30 * u, '#e8eef2');
      emit('reset', laneX, ceilY + 40 * u, 0.3);
      control('CLOCK IS RESET. STAND DOWN, AND GET THEM MENDED.');
    }
    // Mechs at sea with nothing left to fight wait to be picked up.
    if (!lifting) {
      const wait = world.mechs.find((m) => (m.state === 'fight' || m.state === 'victory') && !live.length);
      if (wait && world.t - wait.t0 > 4) pickup(wait);
    }
  }

  function launch(m: Mech) {
    lifting = m;
    liftJob = 'out';
    m.state = 'walkout';
    m.t0 = world.t;
    m.act = null;
    m.sorties++;
    m.dir = 1;
    for (const p of world.crew) if (p.at === m.id) plan(p);
    say(`${m.name} TO THE APRON. THE DOORS ARE OPENING`, m.x, floorY - m.H * 1.08, '#ffe2a0');
    emit('launch', m.x, floorY - m.H * 0.5, 0.7);
    radio(m, pick([`${m.name}, PILOTS ${m.pilots[0]} AND ${m.pilots[1]}. TETHER IS STABLE.`, 'HANDSHAKE IS GREEN. WALKING HER OUT.', `MARK ${roman(m.mark)} READY. LET'S GO TO WORK.`]));
    control('DOORS OPENING. CLEAR THE LANE.');
    look('launch', (m.x + apronX) / 2, floorY - m.H * 0.6, 1.6, 14, 7);
    for (const h of world.helis.filter((q) => q.role === 'deck')) {
      h.state = 'spinup';
      h.t0 = world.t + h.slot * 0.6;
    }
  }

  function pickup(m: Mech) {
    lifting = m;
    liftJob = 'home';
    m.state = 'pickup';
    m.t0 = world.t;
    m.act = null;
    for (const h of world.helis.filter((q) => q.role === 'deck')) {
      h.state = 'spinup';
      h.t0 = world.t + h.slot * 0.5;
    }
    say(`THE LIFT TEAM GOES OUT FOR ${m.name}`, m.x, seaY(m.x, m.d, m.H * 1.1), '#e8eef2');
    emit('pickup', m.x, seaY(m.x, m.d), 0.4);
    radio(m, pick(['DOCK, WE COULD USE A RIDE HOME.', 'SHE\'S LIMPING. BRING THE CABLES.', 'WE\'RE DONE HERE. COME AND GET US.']));
  }

  /** Where the lift team's helicopter k sits over the mech it carries. */
  function slotOf(m: Mech, k: number): [number, number, number] {
    const mm = mOf(m.d);
    const n = nLift;
    const dx = (k - (n - 1) / 2) * m.H * 0.2;
    const above = m.H * (0.32 + (k % 2) * 0.12 + Math.abs(k - (n - 1) / 2) * 0.03);
    void mm;
    return [m.x + dx, m.d + (k % 2 ? 0.004 : -0.004), m.alt + m.H + above];
  }

  function lift(dt: number) {
    const m = lifting;
    const team = world.helis.filter((h) => h.role === 'deck');
    const hooked = () => team.every((h) => h.state === 'hold');
    if (m && liftJob === 'out') {
      const age = world.t - m.t0;
      if (m.state === 'walkout' && world.door >= 0.85) {
        const tx = apronX - 40 * u;
        const sp = 30 * u * (m.H / 440);
        m.x += Math.min(tx - m.x, sp * dt);
        m.ph += dt * 1.9;
        if (Math.floor(m.ph / Math.PI) !== Math.floor((m.ph - dt * 1.9) / Math.PI)) {
          emit('step', m.x, floorY, 0.08);
          for (let k = 0; k < 3; k++) fx('dust', m.x + (r() - 0.5) * m.H * 0.2, floorY - 4 * u, -1, { vx: (r() - 0.5) * 30 * u, vy: -10 * u, dur: 1.4, r: 14 * u, color: '#a8a49c' });
        }
        if (tx - m.x < 1) {
          m.state = 'hook';
          m.t0 = world.t;
          m.d = 0;
          m.alt = NY - standY;
          say('LIFT TEAM, HOOK UP', m.x, floorY - m.H * 1.3, '#e8eef2');
          control('LIFT TEAM, HOOK UP.');
          emit('hook', m.x, floorY - m.H, 0.3);
        }
      } else if (m.state === 'hook') {
        for (const h of team) if (h.state === 'hold') h.cable = Math.min(1, h.cable + dt * 0.5);
        if (hooked() && team.every((h) => h.cable >= 1) && age > 4) {
          m.state = 'carried';
          m.t0 = world.t;
          say(`${m.name} IS AIRBORNE ON THE CABLES`, m.x, floorY - m.H * 1.4, '#ffe2a0');
          emit('lift', m.x, floorY - m.H, 0.6);
          look('carry', (m.x + fightX(world.fightD)) / 2, (floorY + yOf(world.fightD)) / 2 - m.H * 0.6, 1.4, 16, 7);
        }
      } else if (m.state === 'carried') {
        const target = world.monsters.filter(alive)[0];
        const fd = world.fightD;
        const tx = target && target.d < fd + 0.08 ? target.x + 0.9 * mechH * mOf(fd) : fightX(fd);
        const k = Math.min(1, age / 16);
        const ease = k * k * (3 - 2 * k);
        // Up off the apron, out over the bay, a little lower toward the drop.
        m.d = fd * ease;
        m.x = apronX - 40 * u + (Math.min(tx, fightX(fd)) - (apronX - 40 * u)) * ease;
        m.alt = (NY - standY) * (1 - ease) + Math.sin(k * Math.PI) * m.H * 0.25 + ease * m.H * 0.18;
        m.ph += dt * 0.7;
        if (k >= 1) {
          m.state = 'drop';
          m.t0 = world.t;
          say('CABLES AWAY! DROP!', m.x, seaY(m.x, m.d, m.alt + m.H * 1.3), '#ffe2a0');
          radio(m, pick(['DROPPING!', 'HERE WE GO!', 'BRACE, BRACE!']));
          emit('drop', m.x, seaY(m.x, m.d), 0.5);
          for (const h of team) {
            h.state = 'home';
            h.cable = 0;
            h.t0 = world.t;
          }
        }
      } else if (m.state === 'drop') {
        const target = -m.H * (0.2 + r() * 0.0);
        m.alt -= dt * m.H * 1.6;
        if (m.alt <= target) {
          m.alt = target;
          m.wade = 0.2;
          m.state = 'fight';
          m.t0 = world.t;
          m.dir = -1;
          for (let k = 0; k < 18; k++) fx('splash', m.x + (r() - 0.5) * m.H * 0.4 * mOf(m.d), seaY(m.x, m.d), m.d, { vx: (r() - 0.5) * 80 * u, vy: -(80 + r() * 160) * u, dur: 1.6 + r(), r: (10 + r() * 16) * u, color: '#e8f2f6' });
          fx('ring', m.x, seaY(m.x, m.d), m.d, { dur: 3, r: m.H * 0.5 });
          say(`${m.name} IS IN THE WATER`, m.x, seaY(m.x, m.d, m.H * 1.1), '#ffe2a0');
          caption(m.name, `MARK ${roman(m.mark)} · IN THE WATER`, '#ffe2a0');
          radio(m, pick(['FEET WET. EYES ON THE TARGET.', 'WE\'RE IN. COME ON THEN.', 'IN THE SURF. THE HARBOUR IS BEHIND US.']));
          emit('splash', m.x, seaY(m.x, m.d), 0.6);
          chronicle(`${titled(m.name)} went out on the cables and was dropped into the surf off the harbour.`);
          lifting = null;
          liftJob = null;
        }
      }
    } else if (m && liftJob === 'home') {
      const age = world.t - m.t0;
      if (m.state === 'pickup') {
        // Wait for the team over it, then up and back to the apron.
        for (const h of team) if (h.state === 'hold') h.cable = Math.min(1, h.cable + dt * 0.5);
        if (hooked() && team.every((h) => h.cable >= 1)) {
          if (m.alt < 0) m.alt = Math.min(0, m.alt + dt * m.H * 0.25);
          else {
            m.state = 'home';
            m.t0 = world.t;
            m.wade = 0;
            emit('lift', m.x, seaY(m.x, m.d), 0.4);
            look('home', (m.x + apronX) / 2, floorY - m.H, 1.3, 12, 6);
            (m as { from?: [number, number] }).from = [m.x, m.d];
          }
        }
        void age;
      } else if (m.state === 'home') {
        const from = (m as { from?: [number, number] }).from ?? [m.x, m.d];
        const k = Math.min(1, age / 16);
        const ease = k * k * (3 - 2 * k);
        m.d = from[1] * (1 - ease);
        m.x = from[0] + (apronX - 40 * u - from[0]) * ease;
        m.alt = (NY - standY) * ease + Math.sin(k * Math.PI) * m.H * 0.3;
        m.dir = -1;
        if (k >= 1) {
          m.state = 'walkin';
          m.t0 = world.t;
          m.alt = NY - standY;
          m.d = 0;
          for (const h of team) {
            h.state = 'home';
            h.cable = 0;
            h.t0 = world.t;
          }
          say(`${m.name} IS HOME${m.hp < 0.5 ? ', AND BADLY HURT' : ''}`, m.x, floorY - m.H * 1.2, '#ffe2a0');
          emit('home', m.x, floorY, 0.4);
          lifting = null;
          liftJob = null;
        }
      }
    }
    // Walking in, back to the bay; the door comes down behind.
    for (const w of world.mechs) {
      if (w.state !== 'walkin') continue;
      if (world.door < 0.85) continue;
      const tx = bays[w.bay].x;
      const sp = 20 * u * (w.H / 440);
      w.x += Math.max(tx - w.x, -sp * dt);
      w.ph += dt * 1.6;
      w.dir = -1;
      if (Math.floor(w.ph / Math.PI) !== Math.floor((w.ph - dt * 1.6) / Math.PI)) emit('step', w.x, floorY, 0.06);
      if (w.x - tx < 1) {
        w.state = 'bay';
        w.t0 = world.t;
        w.dir = 1;
        w.ph = 0;
        say(`${w.name} IS BACK IN BAY ${w.bay + 1}. THE CREWS GO TO WORK ON HER`, w.x, floorY - w.H * 1.08, '#ffe2a0');
        emit('docked', w.x, floorY, 0.3);
        for (const p of world.crew) if (r() < 0.4) plan(p);
      }
    }
    // The door: up for anything going through, down otherwise.
    const want = world.mechs.some((x) => x.state === 'walkout' || x.state === 'hook' || x.state === 'walkin' || (x.state === 'home' && world.t - x.t0 > 6) || (x.state === 'carried' && world.t - x.t0 < 3)) ? 1 : 0;
    const was = world.door;
    world.door += Math.sign(want - world.door) * Math.min(Math.abs(want - world.door), dt / 6);
    if (was < 0.02 && world.door >= 0.02) emit('doors', doorX, floorY, 0.4);
  }

  // ---- the helicopters --------------------------------------------------------------------------------
  function helis(dt: number) {
    const team = world.helis.filter((h) => h.role === 'deck');
    for (const h of world.helis) {
      h.ph += dt * (6 + h.rotor * 16);
      if (h.role === 'patrol') {
        // Round and round over the bay, the searchlight on the water.
        h.rotor = 1;
        const rad = 160 * u * (0.6 + mOf(h.cd));
        const a = world.t * 0.07 * (h.id % 2 ? 1 : -1) + h.seed;
        const tx = h.cx + Math.cos(a) * rad;
        const td = Math.max(0.08, Math.min(0.8, h.cd + Math.sin(a) * 0.08));
        h.dir = Math.cos(a + Math.PI / 2) * (h.id % 2 ? 1 : -1) > 0 ? 1 : -1;
        h.x += (tx - h.x) * Math.min(1, dt * 0.5);
        h.d += (td - h.d) * Math.min(1, dt * 0.5);
        h.alt += ((130 + (h.id % 3) * 30) * u - h.alt) * Math.min(1, dt * 0.3);
        continue;
      }
      if (h.role !== 'deck') continue;
      const m = lifting;
      if (h.state === 'parked') {
        h.rotor = Math.max(0.12, h.rotor - dt * 0.2);
        continue;
      }
      if (h.state === 'spinup') {
        if (world.t < h.t0) continue;
        h.rotor = Math.min(1, h.rotor + dt * 0.5);
        if (h.rotor >= 1) h.state = 'out';
        continue;
      }
      if (h.state === 'out' || h.state === 'hold') {
        if (!m) {
          h.state = 'home';
          continue;
        }
        const [sx, sd, salt] = slotOf(m, h.slot);
        const k = Math.min(1, dt * (h.state === 'hold' ? 3 : 0.9));
        h.x += (sx - h.x) * k;
        h.d += (sd - h.d) * k;
        h.alt += (salt - h.alt) * k;
        h.dir = m.state === 'home' || m.state === 'pickup' ? -1 : 1;
        if (h.state === 'out' && Math.abs(sx - h.x) < 10 * u && Math.abs(salt - h.alt) < 12 * u && Math.abs(sd - h.d) < 0.01) h.state = 'hold';
        continue;
      }
      if (h.state === 'home') {
        // Back to its pad on the roof (or off to the airfield beyond).
        const tx = h.pad >= 0 ? pads[h.pad] : -260 * u;
        const talt = h.pad >= 0 ? roofAlt : roofAlt + 220 * u;
        const k = Math.min(1, dt * 0.6);
        h.x += (tx - h.x) * k;
        h.d += (0 - h.d) * k;
        h.alt += (talt + (Math.abs(tx - h.x) > 20 * u ? 80 * u : 0) - h.alt) * k;
        h.dir = tx > h.x ? 1 : -1;
        if (Math.abs(tx - h.x) < 3 * u && Math.abs(talt - h.alt) < 6 * u) {
          h.state = h.pad >= 0 ? 'parked' : 'hold';
          if (h.pad < 0) h.state = 'parked';
          h.x = tx;
          h.alt = talt;
          h.d = 0;
          h.dir = 1;
        }
      }
    }
    void team;
  }

  // ---- the fight ------------------------------------------------------------------------------------
  function strike(a: Mech | Monster, kind: string, dur: number, power: number) {
    a.act = { kind, t0: world.t, dur, hit: false, power } as MechAct;
  }
  const top = (a: Mech | Monster) => seaY(a.x, a.d, a.alt + a.H * 0.9);
  const mid = (a: Mech | Monster) => seaY(a.x, a.d, a.alt + a.H * 0.6);
  const nextOf = new Map<number, number>();

  function fight(dt: number) {
    const fd = world.fightD;
    const mm = mOf(fd);
    for (const q of world.monsters) {
      q.ph += dt * (q.state === 'advance' || q.state === 'rampage' || q.state === 'retreat' ? 1.4 : 0.6);
      const age = world.t - q.t0;
      if (q.state === 'rising') {
        q.alt = -q.H * (1 - Math.min(1, age / 7)) * 0.9 - q.H * 0.18 * Math.min(1, age / 7);
        if (r() < dt * 10) fx('spray', q.x + (r() - 0.5) * q.H * 0.5 * mOf(q.d), seaY(q.x, q.d), q.d, { vy: -(40 + r() * 60) * u, vx: (r() - 0.5) * 40 * u, dur: 1.5, r: (16 + r() * 20) * u, color: '#dfeaf0' });
        if (age > 1.5) {
          sayOnce(`surf-${q.id}`, () => {
            if (q.second) return;
            say(`${q.name} SURFACES: A SURGE-${q.cat}, ${KIND_WORDS[q.kind]}`, q.x, seaY(q.x, q.d, q.H * 0.9), '#ff9a8a');
            caption(`CODENAME ${q.name}`, `SURGE ${roman(q.cat)} · ${KIND_WORDS[q.kind]}${q.cat >= 5 ? ' · THE LARGEST YET' : ''}`, '#ff9a8a');
            emit('surface', q.x, seaY(q.x, q.d), 0.9);
            chronicle(`${titled(q.name)}, a Surge-${q.cat}, came through the rift ${KIND_WORDS[q.kind].toLowerCase()}.`);
            control(`CODENAME ${q.name}. SURGE-${q.cat}. HEADING FOR THE HARBOUR.`);
            look('surface', q.x, seaY(q.x, q.d, q.H * 0.5), 1.8, 10, 8);
          });
        }
        if (age > 7) {
          q.state = 'advance';
          q.t0 = world.t;
          q.alt = -q.H * 0.18;
        }
        continue;
      }
      if (q.state === 'advance') {
        // Toward the harbour; to the mech if one is in the water.
        const foe = world.mechs.filter((m) => m.state === 'fight').sort((a, b) => Math.abs(a.x - q.x) - Math.abs(b.x - q.x))[0];
        const gap = 0.85 * mechH * mm;
        const tx = foe ? foe.x - gap * (q.second ? 1.05 : 1) : fightX(fd) - gap;
        const td = fd + (q.second ? 0.015 : 0);
        const sp = (10 + q.cat) * u * (0.4 + mOf(q.d)) * 0.8;
        const dd = td - q.d;
        q.d += Math.sign(dd) * Math.min(Math.abs(dd), dt * 0.016);
        q.x += Math.sign(tx - q.x) * Math.min(Math.abs(tx - q.x), sp * dt);
        q.dir = 1;
        q.alt += (-q.H * (0.12 + 0.1 * clamp01((0.6 - q.d) / 0.3)) - q.alt) * Math.min(1, dt);
        if (r() < dt * 4) fx('spray', q.x + (r() - 0.5) * q.H * 0.3 * mOf(q.d), seaY(q.x, q.d), q.d, { vy: -30 * u, vx: (r() - 0.5) * 30 * u, dur: 1.2, r: 12 * u, color: '#dfeaf0' });
        const coming = world.mechs.some((m) => m.state === 'walkout' || m.state === 'hook' || m.state === 'carried' || m.state === 'drop');
        if (Math.abs(dd) < 0.01 && Math.abs(tx - q.x) < 8 * u && (foe || !coming)) {
          q.state = foe ? 'fight' : 'rampage';
          q.t0 = world.t;
          if (!foe) {
            say(`${q.name} REACHES THE HARBOUR. EVACUATE THE WATERFRONT`, q.x, top(q) - 20 * u, '#ff9a8a');
            world.evac = 1;
            emit('evac', q.x, mid(q), 0.6);
          }
        }
        continue;
      }
      if (q.state === 'rampage') {
        // Nothing to stop it: it wades into the harbour and pulls the waterfront down.
        const foe = world.mechs.find((m) => m.state === 'fight');
        if (foe) {
          q.state = 'fight';
          q.t0 = world.t;
          continue;
        }
        const tx = coastX(q.d) - q.H * mOf(q.d) * 0.25;
        q.x += Math.sign(tx - q.x) * Math.min(Math.abs(tx - q.x), 10 * u * dt);
        if (!q.act && world.t > (nextOf.get(q.id) ?? 0)) {
          strike(q, 'smash', 2.2, 1);
          nextOf.set(q.id, world.t + 6 + r() * 4);
        }
        if (q.act && !q.act.hit && world.t - q.act.t0 > q.act.dur * 0.55) {
          q.act.hit = true;
          topple(q.x + q.H * mOf(q.d) * 0.4, q.d, q.name);
          if (world.bridge && world.bridgeBroken <= 0 && r() < 0.2) {
            world.bridgeBroken = 1;
            caption('THE BRIDGE IS DOWN', `${q.name} BROKE ITS MIDDLE SPAN`, '#ffb0a0');
            say(`${q.name} BRINGS DOWN THE MIDDLE OF THE BRIDGE`, (world.bridgeX0 + world.bridgeX1) / 2, seaY(0, bridgeD, 160 * u), '#ffb0a0');
            emit('bridge', (world.bridgeX0 + world.bridgeX1) / 2, yOf(bridgeD), 0.8);
            chronicle(`${titled(q.name)} brought down the middle span of the bridge.`);
          }
        }
        if (q.act && world.t - q.act.t0 > q.act.dur) q.act = null;
        world.evac = 1;
        if (age > 40 && !queue && !lifting) {
          q.state = 'retreat';
          q.t0 = world.t;
          say(`${q.name} TURNS BACK FOR THE RIFT`, q.x, top(q) - 20 * u, '#e8eef2');
          emit('retreat', q.x, mid(q), 0.5);
          chronicle(`${titled(q.name)} tore up the waterfront and went back to the sea.`);
        }
        continue;
      }
      if (q.state === 'retreat') {
        q.d += dt * 0.012;
        q.x += (riftX - q.x) * Math.min(1, dt * 0.03);
        q.dir = -1;
        q.alt -= dt * q.H * 0.02 * clamp01((q.d - 0.6) / 0.2);
        if (q.d > 0.86) q.state = 'gone';
        continue;
      }
      if (q.state === 'dying') {
        q.tilt = Math.min(1.45, q.tilt + dt * 0.7);
        q.alt = Math.max(-q.H * 0.45, q.alt - dt * q.H * 0.1);
        if (r() < dt * 12) fx('blood', q.x + (r() - 0.5) * q.H * 0.6 * mOf(q.d), seaY(q.x, q.d), q.d, { dur: 40 + r() * 30, r: (30 + r() * 60) * u, color: q.colors.glow });
        if (age > 4) {
          q.state = 'carcass';
          q.t0 = world.t;
        }
        continue;
      }
      if (q.state === 'carcass') {
        // The salvage crews go at it; it is gone in a few minutes.
        const crews = world.ships.filter((s) => s.state === 'harvest').length;
        if (world.phase === 'quiet' && !crews) {
          sayOnce(`harvest-${q.id}`, () => {
            for (let k = 0; k < 2; k++) {
              const s: Ship = { id: ids++, kind: k ? 'trawler' : 'barge', x: doorX + 40 * u, d: q.d + (k ? 0.03 : -0.02), dir: 1, speed: 12 * u, len: (k ? 80 : 130) * u, seed: Math.floor(r() * 1e6), state: 'harvest', t0: world.t, tx: q.x + (k ? 1 : -1) * q.H * mOf(q.d) * 0.55, heel: 0 };
              world.ships.push(s);
            }
            say(`THE SALVAGE CREWS GO OUT TO ${q.name}'S CARCASS`, q.x, seaY(q.x, q.d, q.H * 0.5), '#b8f0ff');
            emit('harvest', q.x, seaY(q.x, q.d), 0.4);
          });
        }
        if (crews) {
          q.left = Math.max(0, q.left - dt / 200);
          if (r() < dt * 5) fx('spark', q.x + (r() - 0.5) * q.H * 0.5 * mOf(q.d), seaY(q.x, q.d, q.H * 0.1 * q.left), q.d, { vx: (r() - 0.5) * 40 * u, vy: -40 * u, dur: 0.5, color: '#ffe0a0' });
        }
        if (q.left <= 0 || world.t - q.t0 > 600) {
          q.state = 'gone';
          for (const s of world.ships) if (s.state === 'harvest') Object.assign(s, { state: 'sail', tx: -400 * u, dir: -1 });
          say(`THE LAST OF ${q.name} IS TOWED AWAY; HER BONES STAY IN THE BAY`, q.x, seaY(q.x, q.d, 40 * u), '#b8f0ff');
          mark('bones', q.x, q.d, q.name, q.seed, q.H / mechH, { main: q.colors.hide, second: q.colors.dark, trim: q.colors.glow });
          chronicle(`The salvage crews finished with ${titled(q.name)}; the ribs are left standing in the bay.`);
          emit('towed', q.x, seaY(q.x, q.d), 0.2);
        }
        continue;
      }
    }
    world.monsters = world.monsters.filter((q) => q.state !== 'gone');

    // Each mech in the water fights the nearest monster, and each monster the nearest mech.
    for (const m of world.mechs) {
      if (m.state === 'victory') {
        m.ph += dt * 0.3;
        if (world.t - m.t0 > 5 && world.monsters.some((q) => q.state === 'fight' || q.state === 'advance' || q.state === 'rampage')) {
          m.state = 'fight';
          m.t0 = world.t;
          radio(m, 'ONE DOWN. WHERE IS THE OTHER ONE?');
        }
        if (m.act && world.t - m.act.t0 > m.act.dur) m.act = null;
        continue;
      }
      if (m.state === 'sinking') {
        m.tilt = Math.min(1.5, m.tilt + dt * 0.4) * Math.sign(m.tilt || 1);
        m.alt -= dt * m.H * 0.08;
        if (r() < dt * 8) fx('smoke', m.x + (r() - 0.5) * m.H * 0.3 * mOf(m.d), seaY(m.x, m.d, m.alt + m.H * 0.4), m.d, { vx: 10 * u, vy: -30 * u, dur: 4, r: 30 * u, color: '#3a3836' });
        if (world.t - m.t0 > 9) {
          m.state = 'lost';
          m.t0 = world.t;
          m.built = 0;
        }
        continue;
      }
      if (m.state !== 'fight') continue;
      m.ph += dt * 0.8;
      const foes = world.monsters.filter((q) => q.state === 'fight' || q.state === 'advance' || q.state === 'rampage');
      const q = foes.sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x))[0];
      if (m.tilt > 0.05 && !m.act) {
        // Down in the surf: get up.
        m.tilt = Math.max(0, m.tilt - dt * 0.35);
        if (m.tilt === 0) {
          say(`${m.name} IS UP AGAIN`, m.x, top(m) - 20 * u, '#ffe2a0');
          radio(m, pick(['ON OUR FEET. AGAIN.', 'UP! GET UP! WE\'RE UP.', 'NOT TODAY. NOT IN MY HARBOUR.']));
          emit('up', m.x, mid(m), 0.4);
        }
        continue;
      }
      // Hold the line between it and the city.
      const hold = Math.min(fightX(m.d), q ? q.x + 0.87 * mechH * mOf(m.d) : fightX(m.d));
      m.x += Math.sign(hold - m.x) * Math.min(Math.abs(hold - m.x), 12 * u * dt);
      m.dir = q && q.x < m.x ? -1 : 1;
      if (m.burn > 0) {
        m.burn = Math.max(0, m.burn - dt / 12);
        if (r() < dt * 6) fx('acid', m.x + (r() - 0.5) * m.H * 0.25 * mOf(m.d), mid(m), m.d, { vy: -20 * u, dur: 1.4, r: 10 * u, color: '#c8ff6a' });
      }
      if (m.hp < 0.4 && r() < dt * 3) fx('smoke', m.x + (r() - 0.5) * m.H * 0.2 * mOf(m.d), top(m), m.d, { vx: 12 * u, vy: -24 * u, dur: 3, r: 18 * u, color: '#4a4846' });
      if (!q || q.state !== 'fight') continue;
      if (!m.act && world.t > (nextOf.get(m.id) ?? 0) && !(q.act && world.t - q.act.t0 < q.act.dur * 0.7)) {
        const moves: [string, number, number][] = [['punch', 1.5, 3], ['rocket', 2.4, 1.2]];
        for (const wpn of m.weapons) {
          if (wpn === 'plasma') moves.push(['plasma', 2.2, 2.2]);
          if (wpn === 'cannon') moves.push(['cannon', 2, 1.6]);
          if (wpn === 'missiles') moves.push(['missiles', 2.2, 1.6]);
          if (wpn === 'sword') moves.push(['sword', 2, 2.2]);
          if (wpn === 'chain') moves.push(['chain', 2.2, 2]);
          if (wpn === 'fists') moves.push(['rocket', 2.4, 2]);
        }
        const ship = world.ships.find((s) => s.state === 'moored' && s.kind !== 'tug' && Math.abs(s.d - m.d) < 0.12);
        if (ship && !said.has('club') && world.t - m.t0 > 12 && r() < 0.3) moves.push(['club', 4.2, 3]);
        const total = moves.reduce((s2, x) => s2 + x[2], 0);
        let roll = r() * total;
        let mv = moves[0];
        for (const x of moves) {
          roll -= x[2];
          if (roll <= 0) {
            mv = x;
            break;
          }
        }
        strike(m, mv[0], mv[1], 1);
        if (mv[0] === 'club' && ship) {
          said.add('club');
          ship.state = 'held';
          ship.t0 = world.t;
          say(`${m.name} TEARS A SHIP FROM ITS MOORINGS!`, m.x, top(m) - 30 * u, '#ffe2a0');
          radio(m, 'IT\'S INSURED. PROBABLY.');
          emit('club', m.x, mid(m), 0.8);
          look('club', (m.x + q.x) / 2, mid(m), 1.9, 8, 9);
        }
        if (mv[0] === 'plasma' || mv[0] === 'sword' || mv[0] === 'chain') radio(m, mv[0] === 'plasma' ? pick(['PLASMA CASTER, HOT!', 'CHARGING... FIRE!', 'LIGHT HIM UP!']) : pick(['SWORD OUT!', 'BLADE! NOW!', 'LET\'S CARVE HIM UP.']));
        if (mv[0] === 'rocket') radio(m, pick(['ELBOW ROCKET!', 'FULL THRUST, RIGHT ARM!', 'THIS ONE IS FOR THE HARBOUR!']));
        nextOf.set(m.id, world.t + mv[1] + 0.6 + r() * 1.4);
      }
      if (m.act && !m.act.hit && world.t - m.act.t0 > m.act.dur * (m.act.kind === 'club' ? 0.62 : 0.5)) resolveMech(m, q);
      if (m.act && world.t - m.act.t0 > m.act.dur) m.act = null;
    }
    for (const q of world.monsters) {
      if (q.state !== 'fight') continue;
      const foes = world.mechs.filter((m) => m.state === 'fight');
      const m = foes.sort((a, b) => Math.abs(a.x - q.x) - Math.abs(b.x - q.x))[0];
      if (!m) {
        q.state = 'rampage';
        q.t0 = world.t;
        continue;
      }
      const gap = 0.85 * mechH * mOf(q.d);
      const tx = m.x - gap * (q.second ? 1.15 : 1);
      if (!q.act || q.act.kind !== 'charge') q.x += Math.sign(tx - q.x) * Math.min(Math.abs(tx - q.x), 14 * u * dt);
      q.dir = m.x > q.x ? 1 : -1;
      q.flying = Math.max(0, q.flying - dt * 0.6);
      if (!q.act && world.t > (nextOf.get(q.id) ?? 0) && !(m.act && world.t - m.act.t0 < m.act.dur * 0.7)) {
        const moves: [string, number, number][] = [['claw', 1.6, 3], ['bite', 1.8, 2]];
        if (q.kind === 'veined' || q.kind === 'serpent') moves.push(['acid', 2, 2.4]);
        if (q.kind === 'horned' || q.kind === 'crab') moves.push(['charge', 2.6, 2]);
        if (q.kind === 'crab') moves.push(['pincer', 2.2, 2.4]);
        if (q.kind === 'winged') moves.push(['wing', 4, 2.2]);
        if (q.kind === 'serpent' || q.kind === 'horned') moves.push(['tail', 1.8, 2]);
        const total = moves.reduce((s2, x) => s2 + x[2], 0);
        let roll = r() * total;
        let mv = moves[0];
        for (const x of moves) {
          roll -= x[2];
          if (roll <= 0) {
            mv = x;
            break;
          }
        }
        strike(q, mv[0], mv[1], 0.6 + q.cat * 0.14);
        nextOf.set(q.id, world.t + mv[1] + 0.8 + r() * 1.6 - q.cat * 0.15);
      }
      if (q.act?.kind === 'wing') q.flying = Math.min(1, q.flying + dt * 1.2);
      if (q.act && !q.act.hit && world.t - q.act.t0 > q.act.dur * (q.act.kind === 'wing' ? 0.6 : 0.5)) resolveMonster(q, m);
      if (q.act && world.t - q.act.t0 > q.act.dur) q.act = null;
    }
    // A held ship goes where the arm goes, and then into the sea.
    for (const s of world.ships) {
      if (s.state === 'held' && world.t - s.t0 > 6) {
        s.state = 'sunk';
        s.t0 = world.t;
      }
    }
  }

  function resolveMech(m: Mech, q: Monster) {
    const a = m.act!;
    a.hit = true;
    const k = a.kind;
    const dmg = k === 'punch' ? 0.09 : k === 'rocket' ? 0.17 : k === 'plasma' ? 0.2 : k === 'cannon' ? 0.13 : k === 'missiles' ? 0.15 : k === 'sword' ? 0.22 : k === 'chain' ? 0.2 : k === 'club' ? 0.32 : 0.1;
    const hit = r() < (k === 'club' ? 0.95 : k === 'plasma' || k === 'missiles' || k === 'cannon' ? 0.8 : 0.72);
    const mm = mOf(q.d);
    const hx = q.x + q.H * mm * 0.15;
    const hy = mid(q);
    if (k === 'plasma') for (let n = 0; n < 3; n++) fx('plasma', m.x - m.H * mm * 0.3, mid(m), m.d, { tx: hx + (r() - 0.5) * 20 * u, ty: hy + (r() - 0.5) * 30 * u, dur: 0.35 + n * 0.12, color: m.colors.core, r: 9 * u });
    if (k === 'cannon' || k === 'missiles') for (let n = 0; n < 6; n++) fx('tracer', m.x - m.H * mm * 0.1, top(m), m.d, { tx: hx + (r() - 0.5) * 40 * u, ty: hy + (r() - 0.5) * 50 * u, dur: 0.3 + n * 0.08, color: k === 'cannon' ? '#ffd070' : '#ffa060', r: k === 'missiles' ? 4 * u : 2 * u });
    if (!hit) {
      fx('splash', hx - 60 * u * mm, seaY(q.x, q.d), q.d, { vy: -120 * u, dur: 1.4, r: 20 * u, color: '#e8f2f6' });
      emit('miss', hx, hy, 0.15);
      return;
    }
    q.hp -= dmg;
    q.x -= (k === 'club' || k === 'rocket' ? 30 : 12) * u * mm;
    for (let n = 0; n < 10; n++) fx('blood', hx + (r() - 0.5) * 30 * u * mm, hy + (r() - 0.5) * 40 * u * mm, q.d, { vx: -(40 + r() * 80) * u, vy: -(20 + r() * 60) * u, dur: 1 + r(), r: (4 + r() * 5) * u, color: q.colors.glow });
    fx('flash', hx, hy, q.d, { dur: 0.35, r: (k === 'plasma' ? 80 : 50) * u * mm, color: k === 'plasma' ? m.colors.core : '#fff0c0' });
    emit(k === 'punch' ? 'punch' : k, hx, hy, k === 'punch' ? 0.35 : 0.5);
    if (k === 'club') {
      say(`${m.name} SWINGS THE SHIP INTO ${q.name}`, hx, top(q) - 30 * u, '#ffe2a0');
      chronicle(`${titled(m.name)} swung a ship as a club into ${titled(q.name)}.`);
    } else if (dmg >= 0.17 && r() < 0.45) {
      const words = k === 'plasma' ? 'PLASMA CASTER' : k === 'rocket' ? 'ELBOW ROCKET' : k === 'sword' ? 'BLADE' : k === 'chain' ? 'CHAIN BLADE' : k === 'missiles' ? 'MISSILES' : 'CANNON';
      say(`${m.name}'S ${words} HITS HOME`, hx, top(q) - 20 * u, '#ffe2a0');
    }
    if (q.hp <= 0) {
      q.state = 'dying';
      q.t0 = world.t;
      q.act = null;
      m.kills++;
      world.kills++;
      m.state = 'victory';
      m.t0 = world.t;
      m.act = { kind: 'raise', t0: world.t, dur: 5, hit: true, power: 1 };
      say(`${q.name} IS DOWN. BLUE BLOOD IN THE SURF`, q.x, top(q) - 30 * u, '#9af0ff');
      caption(`${q.name} IS DOWN`, `KILL ${world.kills} FOR ${world.name} · ${m.name}'S ${m.kills === 1 ? 'FIRST' : `${m.kills}${m.kills === 2 ? 'ND' : m.kills === 3 ? 'RD' : 'TH'}`}`, '#9af0ff');
      radio(m, pick(['THAT\'S A KILL. TELL THE CITY IT CAN SLEEP.', 'TARGET DOWN. TARGET DOWN!', 'HE\'S DONE. STAND DOWN THE SIRENS.']));
      emit('kill', q.x, mid(q), 1);
      chronicle(`${titled(m.name)} killed ${titled(q.name)} (Surge-${q.cat}) in the surf off the harbour.`);
      control(`CONFIRMED KILL ON ${q.name}. WELL DONE, ${m.name}.`);
      look('kill', (m.x + q.x) / 2, mid(q), 1.9, 10, 9);
    }
  }

  function resolveMonster(q: Monster, m: Mech) {
    const a = q.act!;
    a.hit = true;
    const k = a.kind;
    const mm = mOf(m.d);
    const base = k === 'claw' ? 0.08 : k === 'bite' ? 0.11 : k === 'acid' ? 0.1 : k === 'charge' ? 0.14 : k === 'pincer' ? 0.13 : k === 'wing' ? 0.18 : k === 'tail' ? 0.1 : 0.08;
    const dmg = base * a.power * (0.55 + r() * 0.3);
    const hit = r() < (k === 'acid' ? 0.8 : 0.66);
    const hx = m.x - m.H * mm * 0.12;
    const hy = mid(m);
    if (k === 'acid') for (let n = 0; n < 8; n++) fx('acid', q.x + q.H * mOf(q.d) * 0.3, top(q), q.d, { tx: hx + (r() - 0.5) * 30 * u, ty: hy + (r() - 0.5) * 50 * u, dur: 0.5 + n * 0.05, color: '#c8ff5a', r: 5 * u });
    if (!hit) {
      emit('miss', hx, hy, 0.15);
      if (k === 'acid' && r() < 0.6) {
        topple(m.x + m.H * mm * 0.6, m.d, q.name);
      }
      return;
    }
    m.hp -= dmg;
    const part = k === 'pincer' ? 'armF' : k === 'bite' ? (r() < 0.5 ? 'head' : 'armF') : k === 'tail' || k === 'charge' ? (r() < 0.5 ? 'legs' : 'chest') : r() < 0.5 ? 'chest' : 'armB';
    m.dmg[part] = Math.min(1, m.dmg[part] + dmg * 2.6);
    for (let n = 0; n < 12; n++) fx('spark', hx + (r() - 0.5) * 30 * u * mm, hy + (r() - 0.5) * 40 * u * mm, m.d, { vx: (r() - 0.3) * 160 * u, vy: -(40 + r() * 120) * u, dur: 0.6 + r() * 0.5, color: '#ffd890' });
    fx('flash', hx, hy, m.d, { dur: 0.3, r: 50 * u * mm, color: '#ffe0b0' });
    if (k === 'acid') m.burn = 1;
    m.x += (k === 'charge' || k === 'wing' ? 50 : 14) * u * mm;
    emit(k, hx, hy, 0.45);
    if (r() < 0.55) radio(m, k === 'acid' ? pick(['ACID ON THE PLATES! VENTING!', 'IT\'S EATING THROUGH THE HULL!']) : k === 'pincer' ? pick(['IT HAS THE ARM! IT HAS THE ARM!', 'LEFT ARM IS GONE OFF THE BOARD!']) : k === 'wing' ? 'IT\'S LIFTING US! WE\'RE OFF THE GROUND!' : pick(['HULL BREACH, CHEST PLATE!', 'TAKING A BEATING OUT HERE!', 'POWER\'S FLICKERING. HOLD IT TOGETHER.', 'WE\'RE OKAY. WE\'RE OKAY.']));
    // Thrown back into the waterfront: something comes down behind.
    if (m.x > coastX(m.d) - m.H * mm * 0.3) {
      topple(coastX(m.d) + 20 * u * mm, m.d, m.name);
      m.x = coastX(m.d) - m.H * mm * 0.32;
    }
    if (m.hp <= 0 && q.hp > q.hp0 * 0.4 && r() < 0.18) {
      // The last stand: the pilots overload the reactor in its arms.
      world.overloads++;
      m.state = 'sinking';
      m.t0 = world.t;
      m.tilt = 0.3;
      m.act = null;
      world.lost++;
      q.hp = 0;
      q.state = 'dying';
      q.t0 = world.t;
      q.act = null;
      world.kills++;
      for (let n = 0; n < 40; n++) fx('splash', m.x + (r() - 0.5) * m.H * mm, seaY(m.x, m.d), m.d, { vx: (r() - 0.5) * 200 * u, vy: -(100 + r() * 300) * u, dur: 2 + r() * 2, r: (16 + r() * 30) * u, color: '#e8f2f6' });
      fx('flash', m.x, mid(m), m.d, { dur: 2.5, r: 600 * u * mm, color: m.colors.core });
      fx('ring', m.x, seaY(m.x, m.d), m.d, { dur: 5, r: m.H * 1.4 });
      world.flash = 1;
      radio(m, pick(['OVERLOADING THE CORE. TELL THEM WE HELD.', 'REACTOR TO MAXIMUM. GET CLEAR, EVERYONE.']));
      caption('OVERLOAD', `${m.name} TOOK ${q.name} WITH HER`, '#fff0c0');
      say(`${m.name} OVERLOADS HER REACTOR AND TAKES ${q.name} WITH HER`, m.x, top(m) - 30 * u, '#fff0c0');
      emit('overload', m.x, mid(m), 1);
      chronicle(`${titled(m.name)}'s pilots overloaded her reactor in ${titled(q.name)}'s grip; both went down, and the pods came up.`);
      mark('wreck', m.x, m.d, m.name, m.seed, 1, m.colors);
      for (let n = 0; n < 2; n++) fx('flare', m.x + (n ? 1 : -1) * 10 * u, top(m), m.d, { vx: (n ? 1 : -1) * 30 * u, vy: -140 * u, dur: 6, r: 6 * u, color: '#ff7040' });
      look('overload', m.x, mid(m), 1.9, 12, 10);
      return;
    }
    if (m.hp <= 0) {
      m.state = 'sinking';
      m.t0 = world.t;
      m.tilt = 0.2;
      m.act = null;
      world.lost++;
      world.evac = 1;
      say(`${m.name} IS LOST. THE PODS ARE AWAY`, m.x, top(m) - 30 * u, '#ff8a7a');
      caption(`${m.name} IS LOST`, 'THE PODS ARE AWAY · EVACUATE THE WATERFRONT', '#ff8a7a');
      mark('wreck', m.x, m.d, m.name, m.seed, 1, m.colors);
      radio(m, pick(['REACTOR\'S GOING! EJECT, EJECT!', 'WE CAN\'T HOLD HER! PUNCH OUT!']));
      emit('lost', m.x, mid(m), 1);
      chronicle(`${titled(m.name)} was lost to ${titled(q.name)}; her pilots, ${titled(m.pilots[0])} and ${titled(m.pilots[1])}, came down in the pods.`);
      control(`${m.name} IS DOWN. EVACUATE THE WATERFRONT. GET ME ANOTHER MECH.`);
      for (let n = 0; n < 2; n++) fx('flare', m.x + (n ? 1 : -1) * 10 * u, top(m), m.d, { vx: (n ? 1 : -1) * 30 * u, vy: -140 * u, dur: 6, r: 6 * u, color: '#ff7040' });
      look('lost', m.x, mid(m), 1.9, 10, 9);
      queue = Math.max(queue, world.monsters.some((x) => alive(x)) ? 1 : 0);
      return;
    }
    if ((dmg >= 0.12 || k === 'charge' || k === 'wing') && r() < 0.5) {
      m.tilt = 1.3;
      m.act = null;
      say(`${m.name} IS DOWN IN THE SURF`, m.x, top(m) - 20 * u, '#ffb0a0');
      radio(m, pick(['WE\'RE DOWN! GET UP, GET UP!', 'SHE\'S ON HER BACK! RIGHT HER!']));
      emit('downed', m.x, mid(m), 0.6);
      for (let n = 0; n < 16; n++) fx('splash', m.x + (r() - 0.5) * m.H * mm * 0.8, seaY(m.x, m.d), m.d, { vx: (r() - 0.5) * 100 * u, vy: -(60 + r() * 140) * u, dur: 1.4 + r(), r: (10 + r() * 16) * u, color: '#e8f2f6' });
    }
  }

  /** A lasting mark in the bay: bones, a wreck. The oldest go under at last. */
  function mark(kind: 'bones' | 'wreck', x: number, d: number, name: string, seed2: number, size: number, colors: { main: string; second: string; trim: string }) {
    world.marks.push({ kind, x, d, seed: seed2, t0: world.t, name, size, colors });
    const of = world.marks.filter((k) => k.kind === kind);
    if (of.length > (kind === 'bones' ? 4 : 3)) world.marks.splice(world.marks.indexOf(of[0]), 1);
  }

  /** A building near (x, d) comes down. */
  function topple(x: number, d: number, by: string) {
    const b = world.buildings.filter((q) => q.fall === 0 && q.kind !== 'crane' && Math.abs(q.d - d) < 0.12 && q.x > x - 120 * u).sort((a, c) => Math.abs(a.x - x) + Math.abs(a.d - d) * 2000 * u - Math.abs(c.x - x) - Math.abs(c.d - d) * 2000 * u)[0];
    if (!b) return;
    b.fall = 0.01;
    b.t0 = world.t;
    world.buildingsLost++;
    world.evac = 1;
    const m = mOf(b.d);
    for (let n = 0; n < 14; n++) fx('dust', b.x + (r() - 0.5) * b.w * m, seaY(b.x, b.d, b.h * 0.2 * r()), b.d, { vx: (r() - 0.5) * 50 * u, vy: -(10 + r() * 30) * u, dur: 5 + r() * 3, r: (30 + r() * 40) * u, color: '#8a8278' });
    say(`A ${b.kind === 'tower' || b.kind === 'spire' ? 'TOWER' : 'BLOCK'} ON THE WATERFRONT COMES DOWN`, b.x, seaY(b.x, b.d, b.h + 40 * u), '#ffb0a0');
    emit('collapse', b.x, seaY(b.x, b.d), 0.7);
    if (r() < 0.4) chronicle(`A ${b.kind === 'tower' || b.kind === 'spire' ? 'tower' : 'block'} on the waterfront came down in the fight with ${titled(by)}.`);
  }

  // ---- the dock's own life ------------------------------------------------------------------------
  let nextShift = 90 + r() * 60;
  function dock(dt: number) {
    // Mending: the crews and the cranes bring a mech back plate by plate.
    for (const m of world.mechs) {
      if (m.state === 'bay') {
        m.ph += dt * 0.2;
        if (m.act && world.t - m.act.t0 > m.act.dur) m.act = null;
        if (m.hp < 1) {
          const welders = world.crew.filter((p) => p.job === 'weld' && p.at === m.id).length;
          const rate = (1 / 260) * (0.5 + Math.min(1, welders / 4));
          const was = m.hp;
          m.hp = Math.min(1, m.hp + dt * rate);
          for (const k of Object.keys(m.dmg) as (keyof Mech['dmg'])[]) m.dmg[k] = Math.max(0, m.dmg[k] - dt * rate * 1.3);
          m.burn = 0;
          if (was < READY && m.hp >= READY) {
            say(`${m.name} IS FIT TO FIGHT AGAIN`, m.x, floorY - m.H * 1.08, '#bff0c0');
            emit('fit', m.x, floorY - m.H, 0.2);
          }
          if (m.hp >= 1) {
            say(`${m.name} IS MENDED, EVERY PLATE`, m.x, floorY - m.H * 1.08, '#bff0c0');
            emit('repaired', m.x, floorY - m.H, 0.3);
            chronicle(`The crews finished mending ${titled(m.name)} in bay ${m.bay + 1}.`);
          }
        }
      }
      if (m.state === 'lost' && world.t - m.t0 > 20 && world.phase === 'quiet') {
        // A new one in the empty bay: the frame first, then the plates.
        const nm = newMech(m.bay, markTop + 1);
        nm.state = 'building';
        nm.built = 0;
        nm.hp = 0;
        world.mechs[world.mechs.indexOf(m)] = nm;
        say(`IN BAY ${m.bay + 1} THEY BEGIN A NEW MECH: MARK ${roman(nm.mark)}`, nm.x, floorY - nm.H * 1.05, '#ffe2a0');
        emit('frame', nm.x, floorY - nm.H * 0.5, 0.4);
        chronicle(`Work began in bay ${m.bay + 1} on a Mark ${roman(nm.mark)} to replace ${titled(m.name)}.`);
      }
      if (m.state === 'building') {
        m.built = Math.min(1, m.built + dt / 420);
        m.hp = m.built;
        if (m.built >= 1) {
          m.state = 'bay';
          m.hp = 1;
          say(`${m.name}, MARK ${roman(m.mark)}, IS COMMISSIONED IN BAY ${m.bay + 1}`, m.x, floorY - m.H * 1.08, '#ffe2a0');
          caption(`${m.name}`, `MARK ${roman(m.mark)} · COMMISSIONED IN BAY ${m.bay + 1}`, '#ffe2a0');
          emit('commissioned', m.x, floorY - m.H, 0.6);
          chronicle(`${titled(m.name)}, a new Mark ${roman(m.mark)}, was commissioned; ${titled(m.pilots[0])} and ${titled(m.pilots[1])} will take her out.`);
          look('commission', m.x, floorY - m.H * 0.5, 2, 10, 6);
        }
      }
    }
    // The crews.
    for (const p of world.crew) {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      if (Math.abs(dy) > 1) {
        // To another level: walk to the gantry's ladder, then climb.
        const ladder = ladderX(p);
        if (Math.abs(ladder - p.x) > 2) {
          p.x += Math.sign(ladder - p.x) * Math.min(Math.abs(ladder - p.x), p.speed * dt);
          p.dir = ladder > p.x ? 1 : -1;
          p.ph += dt * 8;
          p.job = p.job === 'climb' ? 'walk' : p.job;
        } else {
          p.y += Math.sign(dy) * Math.min(Math.abs(dy), p.speed * 0.8 * dt);
          p.ph += dt * 6;
        }
        continue;
      }
      if (Math.abs(dx) > 2) {
        p.x += Math.sign(dx) * Math.min(Math.abs(dx), p.speed * dt);
        p.dir = dx > 0 ? 1 : -1;
        p.ph += dt * 8;
        continue;
      }
      if (p.job === 'weld' && r() < dt * 2.4) {
        const m = world.mechs.find((x) => x.id === p.at);
        if (m && (m.state === 'bay' || m.state === 'building')) {
          for (let k = 0; k < 3; k++) fx('spark', p.x - p.dir * -6 * u, p.y - 8 * u, -1, { vx: (r() - 0.5) * 60 * u, vy: -(10 + r() * 50) * u, dur: 0.4 + r() * 0.5, color: '#ffe8a0' });
          if (r() < 0.04) emit('weld', p.x, p.y, 0.04);
        }
      }
      if (world.t - p.t0 > 12 + r() * 30) plan(p);
    }
    // The cranes: fetch a part from the floor, carry it to a bay, lower it to the mech.
    for (const c of world.cranes) cranes(c, dt);
    // The gantry lifts.
    for (const l of world.lifts) {
      const m = world.mechs.find((x) => x.bay === l.bay);
      if (Math.abs(l.ty - l.y) < 1) {
        if (world.t > l.t0) {
          const lv = m ? levelsOf(m) : [standY - mechH * 0.5];
          l.ty = r() < 0.3 ? standY : lv[Math.floor(r() * lv.length)];
          l.t0 = world.t + 4 + r() * 8;
        }
      } else l.y += Math.sign(l.ty - l.y) * Math.min(Math.abs(l.ty - l.y), 26 * u * dt);
    }
    // The vehicles on the floor.
    for (const v of world.vehicles) {
      if (v.wait > 0) {
        v.wait -= dt;
        continue;
      }
      const dx = v.tx - v.x;
      if (Math.abs(dx) < 2) {
        v.wait = 2 + r() * 6;
        v.tx = x0 + 20 * u + r() * (laneX - x0 - 10 * u);
        v.load = !v.load;
        continue;
      }
      v.dir = dx > 0 ? 1 : -1;
      v.x += Math.sign(dx) * Math.min(Math.abs(dx), (v.kind === 'truck' ? 30 : 22) * u * dt);
    }
    if (world.t > nextShift) {
      nextShift = world.t + 120 + r() * 80;
      const lines = ['SHIFT CHANGE ON THE FLOOR', 'THE NIGHT CREW COMES ON', 'COFFEE ON THE GANTRIES', 'A PLATE GOES UP ON THE CRANE', 'THE TUGS BRING THE NEW PLATES IN'];
      const at = bays[Math.floor(r() * nBays)];
      say(pick(lines), at.x, ceilY + 60 * u, '#e8eef2');
      emit('shift', at.x, floorY, 0.15);
      for (const p of world.crew) if (r() < 0.5) plan(p);
    }
  }
  function ladderX(p: Person) {
    const m = world.mechs.find((x) => x.id === p.at);
    const b = m ? bays[m.bay] : bays.reduce((a, c) => (Math.abs(c.x - p.x) < Math.abs(a.x - p.x) ? c : a));
    return p.tx < b.x ? b.x - b.w * 0.47 : b.x + b.w * 0.47;
  }
  function cranes(c: Crane, dt: number) {
    const sp = 40 * u;
    const hookSp = 0.25;
    c.x += Math.sign(c.tx - c.x) * Math.min(Math.abs(c.tx - c.x), sp * dt);
    c.hook += Math.sign(c.thook - c.hook) * Math.min(Math.abs(c.thook - c.hook), hookSp * dt);
    const there = Math.abs(c.tx - c.x) < 1 && Math.abs(c.thook - c.hook) < 0.01;
    if (!there) return;
    if (c.state === 'idle') {
      if (world.t < c.t0) return;
      // Pick up a part from the floor by the lane (the tugs bring them).
      c.state = 'fetch';
      c.bay = Math.floor(r() * nBays);
      c.tx = Math.min(laneX - 20 * u, Math.max(x0 + 30 * u, bays[c.bay].x + (r() < 0.5 ? -1 : 1) * bays[c.bay].w * 0.5));
      c.thook = 0.95;
      c.load = 'none';
    } else if (c.state === 'fetch') {
      const m = world.mechs.find((x) => x.bay === c.bay);
      const hurt = m && m.hp < 1;
      c.load = hurt ? (m!.dmg.armF > 0.3 || m!.dmg.armB > 0.3 ? 'arm' : m!.dmg.head > 0.3 ? 'head' : 'plate') : r() < 0.3 ? 'barrel' : r() < 0.5 ? 'core' : 'plate';
      if (m?.state === 'building') c.load = r() < 0.5 ? 'plate' : 'arm';
      c.state = 'carry';
      c.thook = 0.15;
      c.tx = bays[c.bay].x + (r() - 0.5) * bays[c.bay].w * 0.3;
    } else if (c.state === 'carry') {
      c.state = 'lower';
      c.thook = 0.35 + r() * 0.3;
    } else if (c.state === 'lower') {
      const m = world.mechs.find((x) => x.bay === c.bay);
      if (m && (m.state === 'bay' || m.state === 'building')) {
        for (let k = 0; k < 6; k++) fx('spark', c.x + (r() - 0.5) * 30 * u, ceilY + (floorY - ceilY) * c.hook + 10 * u, -1, { vx: (r() - 0.5) * 80 * u, vy: -(10 + r() * 60) * u, dur: 0.6, color: '#ffe8a0' });
        emit('crane', c.x, ceilY + (floorY - ceilY) * c.hook, 0.06);
        if (m.state === 'bay' && m.hp < 1) m.hp = Math.min(1, m.hp + 0.02);
        if (m.state === 'building') m.built = Math.min(1, m.built + 0.015);
        if (r() < 0.08) say(c.load === 'arm' ? `A NEW ARM GOES ONTO ${m.name}` : c.load === 'head' ? `THE CONN-POD IS SWUNG ONTO ${m.name}` : c.load === 'core' ? `A REACTOR CORE IS LOWERED INTO ${m.name}` : `PLATES GO UP ONTO ${m.name}`, c.x, ceilY + 50 * u, '#ffe2a0');
      }
      c.state = 'idle';
      c.load = 'none';
      c.thook = 0.12;
      c.t0 = world.t + 3 + r() * 6;
    }
  }

  // ---- the sea, the city, the weather ----------------------------------------------------------------
  let nextBolt = 10 + r() * 10;
  function sea(dt: number) {
    world.day = (world.day + dt / world.dayLen) % 1;
    world.wind += ((Math.sin(world.t * 0.03) * 0.6 + Math.sin(world.t * 0.011 + 1) * 0.4) * (0.6 + world.storm) - world.wind) * dt * 0.1;
    world.swell += ((0.4 + world.storm * 0.6) - world.swell) * dt * 0.05;
    if (!world.castIds.includes('squalls')) {
      world.storm += ((0.35 + 0.25 * Math.sin(world.t * 0.004)) - world.storm) * dt * 0.02;
      world.rain += ((0.55 + 0.3 * Math.sin(world.t * 0.006 + 2)) - world.rain) * dt * 0.02;
    }
    world.flash = Math.max(0, world.flash - dt * 2.5);
    if (world.bolt && world.t - world.bolt.t0 > 0.5) world.bolt = null;
    if (world.t > nextBolt) {
      nextBolt = world.t + (6 + r() * 20) / (0.4 + world.storm);
      if (world.storm > 0.25) {
        const x = doorX + r() * (GW - doorX);
        world.bolt = { x, y0: 0, y1: HY + r() * 30 * u, seed: Math.floor(r() * 1e6), t0: world.t };
        world.flash = 0.7 + r() * 0.3;
        emit('thunder', x, HY, 0.12);
      }
    }
    // Ships: sailing to where they are going; a held one swung; a sunk one going under.
    for (const s of world.ships) {
      if (s.state === 'sail' || s.state === 'harvest') {
        const dx = s.tx - s.x;
        if (Math.abs(dx) < 2) {
          if (s.state === 'sail') {
            if (s.tx < 0 || s.kind === 'tug') {
              if (s.kind === 'tug') s.tx = s.tx < GW * 0.7 ? coastX(s.d) - 60 * u : doorX + 60 * u;
              else s.state = 'sunk';
            } else s.state = 'moored';
          }
        } else {
          s.dir = dx > 0 ? 1 : -1;
          s.x += Math.sign(dx) * Math.min(Math.abs(dx), s.speed * (0.4 + mOf(s.d)) * dt);
        }
      }
      if (s.state === 'sunk') s.heel = Math.min(1, s.heel + dt / 8);
    }
    world.ships = world.ships.filter((s) => !(s.state === 'sunk' && s.heel >= 1) && s.x > -500 * u);
    // Fallen buildings: dust, then rubble; rebuilt (scaffolds and all) after a long while.
    for (const b of world.buildings) {
      if (b.fall > 0 && b.fall < 1) b.fall = Math.min(1, b.fall + dt / 6);
      if (b.fall >= 1 && world.t - b.t0 > 900 && world.phase === 'quiet') {
        b.fall = 0;
        b.t0 = -99;
        if (r() < 0.2) say('ACROSS THE BAY, A FALLEN TOWER IS BUILT AGAIN', b.x, seaY(b.x, b.d, b.h), '#e8eef2');
      }
    }
    if (world.bridgeBroken > 0) world.bridgeBroken = Math.max(0, world.bridgeBroken - dt / 1200);
    if (world.fireworks > 0 && !world.castIds.includes('fireworks')) world.fireworks = 0;
    // Effects.
    for (const f of world.fx) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'spark' || f.kind === 'splash' || f.kind === 'blood' || f.kind === 'spray' || f.kind === 'debris') f.vy += (f.d < 0 ? 240 : 200 * Math.max(0.3, mOf(f.d))) * u * dt;
      if (f.kind === 'flare') f.vy += 40 * u * dt;
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
  }

  // ---- a touch ----------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 3) return null;
    // On a mech in its bay: a systems check.
    const m = world.mechs.find((q) => q.state === 'bay' && Math.abs(x - q.x) < q.H * 0.25 && y < floorY && y > standY - q.H);
    if (m) {
      lastNudge = world.t;
      m.act = { kind: 'check', t0: world.t, dur: 3, hit: true, power: 1 };
      const line = `${m.name} RUNS A SYSTEMS CHECK: ${m.hp >= 1 ? 'ALL GREEN' : `${Math.round(m.hp * 100)}% AND MENDING`}`;
      say(line, m.x, floorY - m.H * 1.08, '#ffe2a0');
      emit('nudge', x, y, 0.2);
      radio(m, `${m.pilots[0]} HERE. ${m.hp >= 1 ? 'SHE\'S READY WHEN YOU ARE.' : 'GIVE THE CREWS A FEW MORE MINUTES.'}`);
      return line;
    }
    // On a monster: the shore guns.
    const q = world.monsters.find((z) => alive(z) && Math.abs(x - z.x) < z.H * mOf(z.d) * 0.5 && Math.abs(y - mid(z)) < z.H * mOf(z.d) * 0.6);
    if (q) {
      lastNudge = world.t;
      for (let k = 0; k < 8; k++) fx('tracer', apronX, floorY - 20 * u, 0.02, { tx: q.x + (r() - 0.5) * 30 * u, ty: mid(q) + (r() - 0.5) * 40 * u, dur: 0.4 + k * 0.08, color: '#ffd070', r: 2 * u });
      q.hp -= 0.03;
      const line = `THE SHORE GUNS OPEN UP ON ${q.name}`;
      say(line, q.x, top(q) - 20 * u, '#ffd070');
      emit('nudge', x, y, 0.3);
      return line;
    }
    // On the water: a flare, and the patrols put their lights on it.
    if (y > HY && x > doorX + wallT) {
      lastNudge = world.t;
      const k = clamp01((y - HY) / (NY - HY));
      const d = Math.max(0.02, 1 - Math.sqrt(k));
      fx('flare', x, seaY(x, d, 200 * u), d, { vy: 10 * u, dur: 8, r: 6 * u, color: '#ff8050' });
      for (const h of world.helis.filter((z) => z.role === 'patrol')) Object.assign(h, { cx: x, cd: d });
      const line = 'A FLARE OVER THE WATER. THE PATROLS TURN THEIR LIGHTS ON IT';
      say(line, x, y - 40 * u, '#ffc0a0');
      emit('nudge', x, y, 0.2);
      return line;
    }
    return null;
  }

  function step(dt: number) {
    world.t += dt;
    world.director.step(world.t, dt);
    round(dt);
    lift(dt);
    helis(dt);
    fight(dt);
    dock(dt);
    sea(dt);
    for (const s of systems) s.step?.(dt);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
