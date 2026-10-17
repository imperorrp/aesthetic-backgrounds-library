/**
 * Ironhaze: a city of iron and smoke, drifting past through the fog, without end.
 *
 * On screen, at a glance: a great city in five planes of depth, each further into the haze, the
 * view drifting rightward along it forever (the near planes passing faster than the far ones):
 * far towers and spires as pale shapes in the smoke; now and then a Great Spire with its clock
 * over everything (each built its own way: a gothic needle, an onion crown, art-deco steps, a
 * great gear of a clock, an iron lattice, twin spires); the middle city with its viaduct and
 * skybridges; the near rooftops with their walkways, refineries, blast furnaces, skydocks and lift
 * towers; and the iron of the promenade we walk along. In a tiered city, the undercity below the
 * decks. Floating islands and air platforms hang in the sky; zeppelins, liners, dreadnoughts,
 * sky-galleons, twin-hulled ships, gunships, haulers, junks, hulks and scouts cross at every depth
 * and moor at the masts, the skydocks and the platforms. People cross the bridges, walk the
 * walkways and the viaduct's footway, work the catwalks under the decks, and stroll with us.
 *
 * The city is streamed: each plane is built in chunks from (seed, plane, chunk) alone, ahead of
 * the view, and let go behind it, so a seed's city is always the same city.
 *
 * Always happening: ships come and go and moor; trains run; every chimney smokes; the foundries
 * pour; the clocks strike, and at noon the Great Clock's automata come out; crows circle the
 * Spire; lamps and windows light at dusk, and the searchlights sweep at night.
 * The cast (per seed, see ./systems): battles in the sky, air raids by night, walker sieges, the
 * armada, raiders, the iron walkers, the walking fortress, floating citadels, the sky-carrier,
 * launches, parades, fires and the fire tenders, risings, storms, pea-soupers, lanterns, the moon.
 * A touch: on a ship, its horn and its searchlight; on a clock, it strikes; on a walker, its
 * siren; on the rooftops, the foundries pour; in the sky, a flare.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome } from '../../../kit';
import { stacksOf } from './design';
import { frameDeck, riserOf, STATIONS } from './machines';
import { LIBRARY, RULE, titled } from './systems';
import type {
  BKind, BridgeKind, Building, Chunk, ClockStyle, Ctx, Fire, Frame, HazeOptions, HazeWorld, Layer, Layout, Machine, MachineKind, Mast, Mood, PathKind,
  Person, Platform, PlatformKind, Ship, ShipKind, Sign, SignKind, Walker, WalkerKind,
} from './types';

export type * from './types';
export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;

const CITIES = ['VELGRAD', 'ASHENBURG', 'GRAVENHOLT', 'MORROWGATE', 'HALLOWMERE', 'SAINT ISOLDE', 'CALDERHAVEN', 'OSTERMARK', 'NOVA CARTHAGO', 'BLACKWATER', 'KESSELHEIM', 'THE IRON CROWN'];
const NAMES: Record<ShipKind, readonly string[]> = {
  zeppelin: ['GRAF ORLOK', 'HINDENMARK', 'VATERLAND', 'SCHWALBE', 'KONIGIN LUISE', 'OSTWIND', 'ADLERHORST', 'NORDSTERN', 'SACHSEN', 'VIKTORIA'],
  dreadnought: ['IRON DUKE', 'INVINCIBLE', 'LEVIATHAN', 'TEMERAIRE', 'GOLIATH', 'COLOSSUS', 'BEHEMOTH', 'WARSPITE', 'THUNDERER', 'DREADNOUGHT', 'INFLEXIBLE', 'AGAMEMNON'],
  junk: ['GOLDEN LOTUS', 'JADE TIGER', 'RED PHOENIX', 'SILK WIND', 'PEARL OF THE EAST', 'WANDERING CRANE'],
  scout: ['WASP', 'HORNET', 'KESTREL', 'GADFLY', 'MERLIN', 'SWIFT', 'MAYFLY', 'CORSAIR'],
  carrier: ['CITADEL OF THE AIR', 'GLORIANA', 'EMPRESS', 'IRON MOUNTAIN'],
  balloon: ['BALLOON'],
  liner: ['QUEEN OF THE AIR', 'LUSITANIA', 'MAURETANIA', 'IMPERATOR', 'OLYMPIC', 'BRITANNIC', 'AQUITANIA', 'CELESTIA'],
  galleon: ['SOVEREIGN', 'GOLDEN HIND', 'REVENGE', 'ARK ROYAL', 'VICTORY', 'SANTA CLARA'],
  twin: ['SISTERS', 'CASTOR AND POLLUX', 'GEMINI', 'TWINS'],
  gunship: ['WARHAWK', 'FURY', 'HARRIER', 'TEMPEST', 'GORGON'],
  hauler: ['ATLAS', 'BURDEN', 'PACKHORSE', 'OX', 'MULE', 'GREY GOOSE', 'PATIENCE'],
  hulk: ['RUSTED SAINT', 'OLD BONES', 'SCRAP KING', 'MAGPIE', 'RAG-AND-BONE'],
  tender: ['FIRE TENDER No. 4', 'FIRE TENDER No. 9', 'WATER BEARER', 'ST. FLORIAN'],
};
const LEN: Record<ShipKind, number> = { zeppelin: 320, dreadnought: 380, junk: 210, scout: 120, carrier: 900, balloon: 46, liner: 440, galleon: 300, twin: 340, gunship: 160, hauler: 300, hulk: 360, tender: 200 };
const SPEED: Record<ShipKind, number> = { zeppelin: 36, dreadnought: 27, junk: 29, scout: 70, carrier: 15, balloon: 9, liner: 33, galleon: 25, twin: 31, gunship: 56, hauler: 22, hulk: 18, tender: 46 };
const REG = ['R', 'L', 'Z', 'HMA', 'LZ', 'SK', 'No.'];
const KIND_LINES: Partial<Record<ShipKind, readonly string[]>> = {
  dreadnought: ['GUN CREWS, STAND EASY', 'ALL TURRETS TRAIN TO PORT', 'SIGNAL THE SQUADRON: KEEP STATION', 'RANGE-FINDERS UP', 'FLAG HOIST: ENGLAND EXPECTS'],
  liner: ['DINNER IS SERVED IN THE GRAND SALOON', 'PASSENGERS ARE REMINDED: NO SMOKING ON THE PROMENADE', 'LADIES AND GENTLEMEN, THE CITY BELOW', 'THE BAND WILL PLAY ON THE UPPER DECK'],
  hauler: ['MIND THE CARGO SLINGS', 'FOUR HUNDRED TONS OF COAL, AND LATE', 'EASE THE WINCHES', 'SHE RIDES LOW TODAY'],
  galleon: ['ALL HANDS ALOFT!', 'MAKE SAIL!', 'PADDLES TO FULL STEAM', 'RUN OUT THE GUNS'],
  junk: ['SILK AND TEA FOR THE MARKETS', 'TRIM THE BATTENS', 'LANTERNS FOR THE EVENING'],
  hulk: ['ANYTHING FOR SCRAP?', 'PATCH THE NUMBER TWO BAG AGAIN', 'RAG AND BONE! RAG AND BONE!'],
  scout: ['TALLY-HO', 'NOTHING ON THE HORIZON, SIR', 'CLIMBING TO FIVE THOUSAND'],
  gunship: ['ROTORS AT FULL PITCH', 'GUNNER, KEEP YOUR EYES OPEN', 'COMING ABOUT'],
  tender: ['PUMPS READY', 'WATER TANKS FULL', 'ON STATION'],
  zeppelin: ['VENT NUMBER THREE CELL', 'MAIL FOR THE CITY', 'ELEVATOR MAN, HOLD HER LEVEL'],
};
const LINES: Record<string, readonly string[]> = {
  cruise: ['ALL AHEAD, FULL STEAM', 'STEADY AS SHE GOES', 'MIND THE SPIRES, HELMSMAN', 'MORE COAL TO THE BOILERS!', 'PRESSURE AT NINETY POUNDS', 'TRIM THE BALLAST, FORWARD', 'TWO BELLS, AND ALL\'S WELL', 'WIND\'S FRESHENING FROM THE EAST', 'ENGINE ROOM, HALF AHEAD', 'GOVERNOR\'S STICKING AGAIN', 'OIL THE CRANKS', 'BLOW DOWN THE BOILERS'],
  approach: ['STAND BY THE MOORING LINES', 'SLOW AHEAD... GENTLY NOW', 'LINES AWAY!', 'VALVE GAS, THREE SECONDS', 'REVERSE PORT ENGINE'],
  moored: ['PASSENGERS ASHORE', 'TAKING ON COAL AND WATER', 'HOIST THE CARGO', 'MAIL SACKS DOWN', 'TOP UP THE GAS CELLS', 'ALL VISITORS ASHORE'],
  depart: ['CAST OFF FORE AND AFT', 'UP SHIP!', 'DROP BALLAST', 'ALL ENGINES AHEAD'],
  battle: ['FIRE AS SHE BEARS!', 'BROADSIDE, NOW!', 'HARD ABOUT!', 'DAMAGE TO THE AFT CELL', 'RELOAD! RELOAD!', 'HOLD THE LINE'],
  attack: ['CLOSE WITH HER!', 'GUNS FREE!'],
  burning: ['FIRE IN THE GAS CELLS!', 'ABANDON SHIP!', 'MAYDAY, MAYDAY', 'PUMPS! WHERE ARE THE PUMPS?'],
  spray: ['PUMPS AT FULL PRESSURE', 'ON THE FIRE, LADS!'],
};
const WALKER_LINES = ['LEFT... RIGHT... LEFT...', 'BOILER PRESSURE RISING', 'MIND THE TRAM LINES', 'STEP LIGHTLY, SHE\'S OLD', 'HALT FOR THE CROSSING', 'COMING THROUGH!', 'GYROS STEADY', 'KNEE JOINT\'S SQUEALING AGAIN', 'STOKE HER UP', 'DELIVERY FOR THE FOUNDRY QUARTER', 'WATCH YOUR FEET DOWN THERE'];
const WALKER_NAMES = ['GOLIATH', 'OLD SMOKY', 'BRASS JACK', 'THE DEACON', 'IRON MAUD', 'STOMPER', 'BIG BERTHA', 'TITAN', 'LADY GRIT', 'THE WIDOW', 'COGSWORTH', 'RUSTY', 'GRANDFATHER', 'THE BISHOP', 'MAGNIFICENT'];
export const WALKER_KINDS: Record<WalkerKind, string> = { biped: 'IRON WALKER', quad: 'LAND-CRAWLER', tripod: 'TRIPOD', colossus: 'WALKING FORTRESS', strider: 'STRIDER', crawler: 'LAND-SHIP', hexapod: 'IRON BEETLE' };
const SURNAMES = ['KESSEL', 'HARGREAVE', 'ASHFORD', 'MORROW', 'PIKE', 'GRIMSHAW', 'VANCE', 'HOLLOWAY', 'DRAKE', 'THORNE', 'COGSWORTH', 'BLACKWOOD'];
const TRADES = ['IRONWORKS', 'BOILERMAKERS', 'ENGINE WORKS', 'FOUNDRY', 'RIVETS & BOLTS', 'CHAIN WORKS', 'GASWORKS', 'LOCOMOTIVES', 'PNEUMATICS'];
const BOARDS = [
  'HOTEL MAJESTIC', 'GRAND HOTEL', 'PNEUMATIC POST', 'AERODROME', 'THEATRE ROYAL', 'LYCEUM', 'PUBLIC BATHS', 'CAFE AUTOMAT', 'TELEGRAPH OFFICE', 'COGSWORTH CLOCKS',
  'BLACKWATER STOUT', 'GAS COMPANY', 'TRAMWAYS', 'SAVINGS BANK', 'EMPORIUM', 'PAWNBROKER', 'MUSIC HALL', 'DANCING NIGHTLY', 'OYSTER BAR', 'ELECTRIC THEATRE',
  'AIRSHIP TICKETS', 'COAL & COKE', 'STEAM LAUNDRY', 'BRASS FOUNDERS', 'ROOMS TO LET', 'GIN PALACE', 'AUTOMATA REPAIRED', 'GALVANIC CURES',
];
const TALL = ['HOTEL', 'BAR', 'GIN', 'CAFE', 'BATHS', 'BANK', 'DANCE', 'THEATRE', 'OPEN', 'ROOMS', 'CINEMA', 'GRILL'];
const HP: Record<ShipKind, number> = { zeppelin: 4, dreadnought: 9, junk: 3, scout: 2, carrier: 20, balloon: 1, liner: 6, galleon: 5, twin: 7, gunship: 3, hauler: 4, hulk: 5, tender: 3 };
const COLORS: Record<ShipKind, [string, string, string][]> = {
  zeppelin: [['#b8ab90', '#4a3f35', '#7f1d1d'], ['#a39a88', '#3b3530', '#1e3a5f'], ['#8f8676', '#2f2a26', '#14532d'], ['#c4b496', '#4b3b2a', '#7c2d12']],
  dreadnought: [['#4b4a48', '#2a2827', '#7f1d1d'], ['#5a4a3e', '#2b221c', '#a16207'], ['#3f4548', '#1f2326', '#7f1d1d']],
  junk: [['#7a4a26', '#3a2412', '#c2410c'], ['#6b3a22', '#2e1a0e', '#b45309']],
  scout: [['#6b6258', '#2e2a26', '#7f1d1d'], ['#8a7a5e', '#3a3026', '#1e3a5f']],
  carrier: [['#4a4744', '#25221f', '#a16207']],
  balloon: [['#b45309', '#e7d3b0', '#3a2a1c'], ['#7f1d1d', '#e7d3b0', '#3a2a1c'], ['#1e3a5f', '#d6c7a6', '#3a2a1c']],
  liner: [['#e2d8c2', '#2a2420', '#7f1d1d'], ['#d8d0be', '#1f2a36', '#a16207'], ['#cfc4ae', '#3a1f1a', '#1e3a5f']],
  galleon: [['#c9b48a', '#4a2a16', '#7f1d1d'], ['#b9a47e', '#3a2412', '#1e3a5f']],
  twin: [['#7a6a58', '#2f2a26', '#a16207'], ['#6a7270', '#262a2c', '#7f1d1d']],
  gunship: [['#5a5248', '#24201c', '#7f1d1d'], ['#4a5048', '#1f2420', '#a16207']],
  hauler: [['#8a7a62', '#3a3026', '#b45309'], ['#7a705e', '#2e2a24', '#14532d']],
  hulk: [['#6a4a34', '#2a1a12', '#8a3a1a'], ['#5a4636', '#24180e', '#7a5a2a']],
  tender: [['#9a2a1e', '#2a1a14', '#d4a03a']],
};
/** The streets of the planes, per layout: parallax, and street level (of the world's height). */
const PLANES: Record<Layout, [number, number][]> = {
  canyon: [[0.2, 0.6], [0.38, 0.68], [0.56, 0.78], [0.76, 0.9], [1.0, 1.02]],
  harbour: [[0.2, 0.6], [0.38, 0.68], [0.56, 0.78], [0.76, 0.9], [1.0, 1.02]],
  heights: [[0.2, 0.6], [0.38, 0.68], [0.56, 0.78], [0.76, 0.9], [1.0, 1.02]],
  tiers: [[0.2, 0.52], [0.38, 0.58], [0.56, 0.66], [0.76, 0.72], [1.0, 1.02]],
};
/** Chunk widths, as shares of the world's width. */
const CWK = [0.5, 0.5, 0.5, 0.5, 1];
/** How fast the view drifts (near-plane units a second, at speed 1). */
const DRIFT = 50;
const MIX: Partial<Record<BKind, number>>[] = [
  { gothic: 2, block: 5, stack: 1, deco: 1.4, dome: 1.2, factory: 0.5, cathedral: 0.5, arcology: 0.6, lift: 0.3 },
  { gothic: 2.2, block: 4, stack: 1.4, deco: 1.6, dome: 1, factory: 0.8, cathedral: 0.7, arcology: 0.7, lift: 0.5, observatory: 0.3, gasholder: 0.4 },
  { gothic: 1.8, block: 3.6, stack: 2, deco: 1.4, dome: 0.7, factory: 1.1, refinery: 0.8, blast: 0.5, cathedral: 0.5, lift: 0.6, skydock: 0.6, observatory: 0.3, gasholder: 0.6, arcology: 0.5 },
  { gothic: 1, block: 3.6, stack: 2.4, deco: 0.8, dome: 0.4, factory: 1.5, refinery: 1, blast: 0.8, lift: 0.6, skydock: 0.6, gasholder: 0.6 },
];
const WIDTH: Record<BKind, [number, number]> = {
  gothic: [46, 90], block: [70, 130], stack: [46, 80], deco: [50, 90], dome: [110, 150], factory: [150, 240], refinery: [180, 260], blast: [120, 160], cathedral: [150, 200],
  clock: [56, 74], skydock: [70, 96], lift: [26, 40], arcology: [120, 180], observatory: [70, 100], gasholder: [70, 110], spire: [150, 150], quay: [70, 130],
};
const HEIGHT: Record<BKind, [number, number]> = {
  gothic: [0.14, 0.34], block: [0.1, 0.2], stack: [0.14, 0.3], deco: [0.16, 0.34], dome: [0.12, 0.2], factory: [0.06, 0.1], refinery: [0.07, 0.11], blast: [0.16, 0.24], cathedral: [0.13, 0.2],
  clock: [0.24, 0.34], skydock: [0.26, 0.38], lift: [0.3, 0.46], arcology: [0.3, 0.48], observatory: [0.1, 0.15], gasholder: [0.07, 0.11], spire: [0, 0], quay: [0.05, 0.1],
};
const STYLES: ClockStyle[] = ['needle', 'onion', 'deco', 'gear', 'lattice', 'twin'];
const posmod = (a: number, n: number) => ((a % n) + n) % n;

export function createHaze(seed: string | number, W: number, H: number, opts: HazeOptions): HazeWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'haze');
  const shotR: Rng = forkRng(seed, 'haze-shots');
  const g: Genome = createGenome(seed, 'haze');
  // A world needs some size to stream (a hidden page can report none).
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const traffic = Math.max(0.3, Math.min(2.5, opts.traffic));
  const drift = DRIFT * u * Math.max(0, Math.min(3, opts.speed ?? 1));
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];
  const m = (f: number) => 0.3 + 0.7 * f;
  let ids = 1;

  const layout = g.weighted<Layout>({ canyon: 4, harbour: 3, heights: 3, tiers: 4 });
  const mood = g.weighted<Mood>({ amber: 4, verdigris: 3, ashen: 3, rust: 2 });
  const side: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const planes = PLANES[layout];
  const groundAt = (f: number) => {
    for (let k = 0; k < planes.length - 1; k++) {
      const [f0, b0] = planes[k];
      const [f1, b1] = planes[k + 1];
      if (f <= f1) return GH * (b0 + ((Math.max(f0, f) - f0) / (f1 - f0)) * (b1 - b0));
    }
    return GH * planes[planes.length - 1][1];
  };
  const frame: Frame = layout === 'harbour' ? 'balcony' : layout === 'tiers' ? g.weighted<'gantry' | 'balcony' | 'station'>({ gantry: 3, balcony: 1, station: 1 }) : g.weighted<'balcony' | 'station' | 'bridge'>({ balcony: 3, station: 3, bridge: 2 });
  const spireEvery = 3;
  const spireOffset = g.int(0, spireEvery - 1);
  const viaductY = layout === 'heights' ? null : Math.round(GH * planes[2][1] - GH * g.range(0.07, 0.1) * (layout === 'tiers' ? 0.8 : 1));

  // eslint-disable-next-line prefer-const
  let world: HazeWorld;
  world = {
    t: 0, W, H, GW, GH, u, bus,
    director: createDirector(forkRng(seed, 'haze-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    name: g.pick(CITIES), layout, mood, frame, side, year: g.int(1896, 1931), season: g.int(0, 3), cast: [], castIds: [],
    day: g.range(0.3, 0.42),
    scroll: 0, drift,
    vx: (f, frac) => world.scroll * f + GW * frac,
    inView: (x, f, margin = 0.1) => x > world.scroll * f - GW * margin && x < world.scroll * f + GW * (1 + margin),
    layers: planes.map(([f, baseK], i) => ({ i, f, base: Math.round(GH * baseK), m: m(f), cw: GW * CWK[i], viaduct: i === 2 ? viaductY : null, buildings: [], bridges: [], walkways: [], cliffs: [], machines: [], signs: [] }) as Layer),
    chunks: planes.map(() => new Map<number, Chunk>()),
    version: 0,
    masts: [], platforms: [], islands: [], under: null,
    ships: [], walkers: [], fighters: [], trains: [], seaShips: [], gondolas: [], paths: new Map(), people: [],
    fx: [], bolts: [], flocks: [], fires: [], guns: [],
    sea: layout === 'harbour' ? Math.round(GH * 0.84) : null,
    clock: null, clocks: [],
    storm: 0, fog: 0, wind: g.range(-1, 1) * 12, pour: 0, moon: 0, lanterns: -1, pyres: [],
    search: null, bunting: 0, unrest: 0, automata: 0,
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    labels: [], chronicle: [], m, groundAt,
    step, nudge,
    counts: () => ({
      ships: world.ships.filter((s) => s.alive).length,
      moored: world.ships.filter((s) => s.alive && s.state === 'moored').length,
      walkers: world.walkers.filter((w) => w.state !== 'down').length,
      fighters: world.fighters.length,
      people: world.people.length,
      fires: world.fires.filter((f) => world.t < f.until).length,
      buildings: world.layers.reduce((n, l) => n + l.buildings.length, 0),
      fx: world.fx.length,
    }),
  };
  const vx = world.vx;

  const say = (text: string, x: number, y: number, f: number, color = '#efe3c8') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    world.labels.push({ text, x, y, f, t0: world.t, color });
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
  /** Where the camera (in the view's own terms) must be to put a point at depth f in the middle. */
  const nearOf = (x: number, y: number, f: number): [number, number] => [GW / 2 + (x - GW / 2 - world.scroll * f) / Math.max(0.3, f), GH / 2 + (y - GH / 2) / Math.max(0.3, f)];
  const look = (id: string, x: number, y: number, f: number, zoom: number, hold: number, priority: number) => {
    const [nx, ny] = nearOf(x, y, f);
    world.director.look(id, nx, ny, zoom, hold, priority);
  };

  // ---- the city, a chunk at a time ---------------------------------------------------------------
  const addPath = (layer: number, f: number, x0: number, x1: number, y: number, kind: PathKind, ch: Chunk | null) => {
    if (x1 - x0 < 30 * u) return -1;
    const id = ids++;
    world.paths.set(id, { id, layer, f, x0, x1, y, kind });
    ch?.paths.push(id);
    return id;
  };
  const addMast = (layer: number, f: number, x: number, y: number, sideOf: -1 | 0 | 1, platform: number, ch: Chunk | null) => {
    const id = ids++;
    world.masts.push({ id, layer, f, x, y, ship: -1, platform, side: sideOf });
    ch?.masts.push(id);
    return id;
  };
  const person = (path: number, R: Rng, extra: Partial<Person> = {}): Person => {
    const p = world.paths.get(path);
    if (!p) return null as unknown as Person;
    const q: Person = { path, u: R(), speed: (14 + R() * 12) * u * m(p.f), dir: R() < 0.5 ? 1 : -1, kind: Math.floor(R() * 6), wait: 0, stand: p.kind === 'frame' ? R() < 0.6 : R() < 0.15, flag: 0, seed: Math.floor(R() * 1e6), ...extra };
    world.people.push(q);
    return q;
  };
  const makeBuilding = (li: number, kind: BKind, x: number, w: number, h: number, gnd: number, R: Rng, ch: Chunk): Building => {
    const L = world.layers[li];
    const s = L.m * u;
    const b: Building = { id: ids++, layer: li, kind, x, w, h: Math.round(h), base: gnd, seed: Math.floor(R() * 1e9), chimneys: [], masts: [], clock: null, foundry: false, beacon: null, gun: null, flare: null };
    const top = gnd - b.h;
    if (kind === 'factory') {
      const n = 2 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) b.chimneys.push([x + w * (0.12 + (k / n) * 0.8), top - GH * (0.08 + R() * 0.08) * L.m, Math.max(3, 7 * s)]);
      b.foundry = R() < 0.7;
    } else if (kind === 'blast') {
      b.chimneys.push([x + w * 0.82, top - GH * 0.1 * L.m, Math.max(3, 8 * s)]);
      b.foundry = true;
    } else if (kind === 'refinery') {
      b.chimneys.push([x + w * 0.2, top - GH * 0.12 * L.m, Math.max(3, 6 * s)]);
      b.flare = [x + w * 0.9, top - GH * 0.16 * L.m];
    } else if (kind === 'block' || kind === 'stack' || kind === 'quay' || kind === 'arcology') {
      const n = Math.floor(R() * 3);
      for (let k = 0; k < n; k++) b.chimneys.push([x + w * (0.15 + R() * 0.7), top - 18 * s, Math.max(2, 5 * s)]);
    }
    if ((kind === 'gothic' || kind === 'deco' || kind === 'lift' || kind === 'arcology') && b.h > GH * 0.18) b.beacon = [x + w / 2, top - (kind === 'gothic' ? 0.9 * w : kind === 'lift' ? 14 * s : 0.5 * w)];
    if (kind === 'skydock') {
      const n = 2 + (R() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const sd: -1 | 1 = k % 2 ? 1 : -1;
        b.masts.push(addMast(li, L.f, x + w / 2 + sd * (w * 0.5 + 34 * s), top + b.h * (0.12 + k * 0.24), sd, -1, ch));
      }
      b.beacon = [x + w / 2, top - 30 * s];
    }
    return b;
  };
  const clockOn = (b: Building, style: ClockStyle, great: boolean) => {
    const L = world.layers[b.layer];
    const top = b.base - b.h;
    if (great) {
      const cr = b.w * (style === 'gear' ? 0.42 : style === 'twin' ? 0.26 : 0.36);
      b.clock = { x: b.x + b.w / 2, y: b.base - b.h * (style === 'lattice' ? 0.5 : style === 'deco' ? 0.66 : 0.62), r: cr, f: L.f, layer: b.layer, style, top, great: true };
      b.beacon = [b.x + b.w / 2, top - 4];
    } else {
      const cr = b.w * (style === 'gear' ? 0.42 : 0.34);
      b.clock = { x: b.x + b.w / 2, y: top + b.h * (style === 'lattice' ? 0.45 : 0.2), r: cr, f: L.f, layer: b.layer, style, top: top - b.w * 1.2, great: false };
    }
  };

  function makeChunk(i: number, k: number): Chunk {
    const L = world.layers[i];
    const cw = L.cw;
    const x0 = k * cw;
    const x1 = x0 + cw;
    const f = L.f;
    const s = L.m * u;
    const R = forkRng(seed, `haze-${i}-${k}`);
    const ch: Chunk = { i, k, x0, x1, buildings: [], bridges: [], walkways: [], cliffs: [], cables: [], under: null, masts: [], paths: [], machines: [], signs: [] };
    if (i === 4) {
      const fy = frameDeck(frame, GH, u);
      const p = addPath(4, frame === 'bridge' || frame === 'gantry' ? 1 : 0.995, x0 + cw * 0.04, x1 - cw * 0.04, fy, 'frame', ch);
      if (p >= 0) for (let q = 0; q < 3 + Math.floor(R() * 3); q++) person(p, R);
      return ch;
    }
    if (layout === 'heights' && (i === 1 || i === 2)) {
      let x = x0 - cw * R() * 0.2;
      while (x < x1) {
        const w = cw * (0.36 + R() * 0.32);
        ch.cliffs.push([x, x + w, Math.round(L.base - GH * (0.08 + R() * 0.12) * (i === 1 ? 1.2 : 1))]);
        x += w + cw * (0.08 + R() * 0.16);
      }
    }
    const groundOf = (x: number) => {
      for (const [a, b, top] of ch.cliffs) if (x >= a && x <= b) return top;
      return layout === 'heights' && (i === 1 || i === 2) ? null : L.base;
    };
    const openWater = layout === 'harbour' && i === 3 && R() < 0.55;
    if (!openWater) {
      for (let x = x0 + R() * 6 * s; x < x1; ) {
        const gnd = groundOf(x + 20 * s);
        if (gnd === null) {
          x += 20 * s;
          continue;
        }
        const wt = MIX[i];
        let roll = R() * Object.values(wt).reduce((a, b) => a + (b ?? 0), 0);
        let kind: BKind = 'block';
        for (const key in wt) if ((roll -= wt[key as BKind] ?? 0) <= 0) {
          kind = key as BKind;
          break;
        }
        if (layout === 'harbour' && i === 3) kind = R() < 0.45 ? 'quay' : R() < 0.6 ? 'block' : 'stack';
        const [w0, w1] = WIDTH[kind];
        const w = (w0 + R() * (w1 - w0)) * s;
        const [h0, h1] = HEIGHT[kind];
        const spike = 0.45 + Math.pow(R(), 2.4) * 1.6;
        // Canyons: near towers rise and fall in long waves, so streets open and close as we pass.
        const wave = 0.5 + 0.5 * Math.sin(x / (GW * 0.37) + k * 0.3);
        const tall = layout === 'canyon' && i === 3 ? 0.4 + wave * 1.1 : i === 3 ? 0.55 + R() * 0.35 : (0.65 + R() * 0.3) * (kind === 'gothic' || kind === 'deco' ? spike : 0.95);
        let h = GH * (h0 + R() * (h1 - h0)) * tall * (i === 0 ? 1.15 : 1);
        if (i === 3 && layout !== 'canyon') h *= layout === 'tiers' ? 0.7 : 0.8;
        ch.buildings.push(makeBuilding(i, kind, x, w, h, gnd, R, ch));
        x += w + (R() < 0.25 ? R() * 30 * s : -R() * 4 * s);
      }
    }
    // Every few chunks of the second plane, a Great Spire, each in its own style.
    if (i === 1 && posmod(k, spireEvery) === spireOffset) {
      const style = STYLES[posmod(k * 7 + Math.floor(R() * 6), 6)];
      const w = (style === 'gear' ? 190 : style === 'twin' ? 200 : 150) * s;
      const x = x0 + cw * (0.25 + R() * 0.35);
      ch.buildings = ch.buildings.filter((b) => b.x + b.w < x - w * 0.7 || b.x > x + w * 1.7);
      const gnd = layout === 'heights' ? Math.min(...ch.cliffs.map((c) => c[2]), L.base) : L.base;
      const sp = makeBuilding(i, 'spire', x, w, gnd - GH * (0.05 + R() * 0.05), gnd, R, ch);
      clockOn(sp, style, true);
      ch.buildings.push(sp);
      if (layout === 'heights') ch.cliffs.push([x - w * 0.8, x + w * 1.8, gnd]);
    }
    // Now and then, a clock tower in the middle or near city.
    if ((i === 2 || i === 3) && R() < 0.3) {
      const cands = ch.buildings.filter((b) => b.kind === 'block');
      const b0 = cands[Math.floor(R() * cands.length)];
      if (b0) {
        const w = (56 + R() * 18) * s;
        const c = makeBuilding(i, 'clock', b0.x + b0.w / 2 - w / 2, w, GH * (0.24 + R() * 0.1) * (i === 3 ? 0.75 : 1), b0.base, R, ch);
        clockOn(c, STYLES[Math.floor(R() * 6)], false);
        ch.buildings.push(c);
      }
    }
    // A mooring mast on the tallest tower of the chunk.
    if (i >= 1 && R() < (i === 1 ? 0.22 : i === 2 ? 0.45 : 0.4)) {
      const cands = ch.buildings.filter((b) => (b.kind === 'deco' || b.kind === 'gothic' || b.kind === 'block') && b.x > x0 + cw * 0.1 && b.x + b.w < x1 - cw * 0.1).sort((a, b) => a.base - a.h - (b.base - b.h));
      const b = cands[0];
      if (b) {
        const mx = b.x + b.w / 2;
        const top = b.base - b.h - 70 * L.m * u;
        b.masts.push(addMast(i, f, mx, top, 0, -1, ch));
        b.beacon = [mx, top - 6 * L.m * u];
      }
    }
    if ((i === 2 || i === 3) && R() < 0.75) {
      const roofs = ch.buildings.filter((b) => (b.kind === 'block' || b.kind === 'deco' || b.kind === 'arcology') && !b.masts.length);
      const b = roofs[Math.floor(R() * roofs.length)];
      if (b) b.gun = [b.x + b.w * (0.3 + R() * 0.4), b.base - b.h];
    }
    const bs = ch.buildings.filter((b) => b.kind !== 'spire').sort((a, b) => a.x - b.x);
    for (let q = 0; q < bs.length - 1; q++) {
      const a = bs[q];
      const b = bs[q + (R() < 0.25 && q < bs.length - 2 ? 2 : 1)];
      if (i >= 1 && R() < 0.4 && a.h > GH * 0.12 * L.m && b.h > GH * 0.12 * L.m) {
        const y = Math.max(a.base - a.h, b.base - b.h) + (14 + R() * 40) * s;
        const kind: BridgeKind = pick(['covered', 'covered', 'truss', 'arch'], R);
        ch.bridges.push([a.x + a.w * 0.5, b.x + b.w * 0.5, Math.round(y), kind]);
        addPath(i, f, a.x + a.w * 0.6, b.x + b.w * 0.4, y, 'bridge', ch);
      }
    }
    if (i >= 2) {
      for (let q = 0; q < bs.length - 1 && ch.walkways.length < (i === 3 ? 3 : 2); q++) {
        const a = bs[q];
        const b = bs[q + 1];
        if (R() > 0.3) continue;
        const lo = Math.max(a.base - a.h, b.base - b.h);
        const y = lo + (a.base - lo) * (0.2 + R() * 0.4);
        if (y > L.base - 20 * s) continue;
        ch.walkways.push([a.x + a.w * 0.2, b.x + b.w * 0.8, Math.round(y)]);
        addPath(i, f, a.x + a.w * 0.2, b.x + b.w * 0.8, y, 'walk', ch);
      }
    }
    if (i >= 1) furnish(ch, L, bs, R);
    if (L.viaduct !== null) addPath(i, f, x0, x1, L.viaduct, 'via', ch);
    if ((i === 2 || i === 3) && R() < 0.5) {
      const tall = bs.filter((b) => b.h > GH * 0.14 * L.m);
      if (tall.length >= 2) {
        const a = tall[0];
        const b = tall[tall.length - 1];
        if (b.x - a.x > cw * 0.3) {
          const cable: [number, number, number, number] = [a.x + a.w * 0.8, a.base - a.h + 14 * s, b.x + b.w * 0.2, b.base - b.h * 0.55];
          ch.cables.push(cable);
          world.gondolas.push({ cable, layer: i, u: R(), dir: 1, wait: 0, chunk: `${i}:${k}` });
        }
      }
    }
    if (layout === 'tiers' && i === 3) {
      const deck = L.base;
      const floor = GH;
      const part = { catwalks: [] as [number, number, number][], lifts: [] as [number, number, number][], furnaces: [] as [number, number, number, number][], vents: [] as [number, number][], arches: [] as [number, number][] };
      for (let x = x0 + cw * R() * 0.3; x < x1; x += cw * (0.34 + R() * 0.14)) part.arches.push([x, (14 + R() * 10) * u]);
      for (let q = 0; q < 4; q++) {
        const y = deck + (floor - deck) * (0.18 + R() * 0.55);
        const a = x0 + cw * R() * 0.7;
        const b = Math.min(x1 + cw * 0.2, a + cw * (0.25 + R() * 0.5));
        part.catwalks.push([a, b, Math.round(y)]);
        const p = addPath(3, 0.76, a + 6 * u, b - 6 * u, y, 'under', ch);
        if (p >= 0) for (let n = 0; n < 2; n++) person(p, R);
      }
      for (let q = 0; q < 2; q++) part.lifts.push([x0 + cw * (0.15 + q * 0.5 + R() * 0.2), deck + 8 * u, floor - GH * 0.05]);
      for (let q = 0; q < 3; q++) part.furnaces.push([x0 + cw * R(), floor - GH * (0.04 + R() * 0.08), (24 + R() * 30) * u, (14 + R() * 16) * u]);
      for (let q = 0; q < 5; q++) part.vents.push([x0 + cw * R(), deck + (floor - deck) * (0.1 + R() * 0.8)]);
      ch.under = part;
      // The engines that keep the decks up: on the floor, on the walls, between the catwalks.
      const us = u * 0.9;
      const floorY = floor - GH * 0.02;
      for (let q = 0; q < 4; q++) {
        const kind = pick(['beam', 'hammer', 'flywheel', 'gears', 'beam', 'governor', 'elevator'] as MachineKind[], R);
        const x = x0 + cw * (0.1 + q * 0.22 + R() * 0.1);
        const y = kind === 'gears' ? deck + (floor - deck) * (0.3 + R() * 0.3) : kind === 'flywheel' ? floorY - 24 * us : floorY;
        ch.machines.push({ kind, layer: 3, x, y, x2: x + 50 * us, y2: kind === 'elevator' ? deck + 20 * us : y - 46 * us, s: us, seed: Math.floor(R() * 1e6) });
      }
      const cw0 = part.catwalks[0];
      if (cw0) ch.machines.push({ kind: 'pipes', layer: 3, x: cw0[0], y: cw0[2] - 30 * us, x2: cw0[1], y2: cw0[2] - 12 * us, s: us, seed: Math.floor(R() * 1e6) });
    }
    for (const id of ch.paths) {
      const p = world.paths.get(id)!;
      if (p.kind === 'under') continue;
      const n = p.kind === 'via' ? 3 : 2 + Math.floor(R() * 2);
      for (let q = 0; q < n; q++) person(id, R);
    }
    return ch;
  }
  /** The machinery out on the roofs and walls of a chunk, and the words painted and hung on them. */
  function furnish(ch: Chunk, L: Layer, bs: Building[], R: Rng) {
    const i = L.i;
    const s = L.m * u * 1.3;
    const mach = (kind: MachineKind, x: number, y: number, x2 = x, y2 = y) => ch.machines.push({ kind, layer: i, x, y, x2, y2, s, seed: Math.floor(R() * 1e6) } as Machine);
    const sign = (kind: SignKind, x: number, y: number, w: number, h: number, text: string) => ch.signs.push({ kind, layer: i, x, y, w, h, text, seed: Math.floor(R() * 1e6) } as Sign);
    for (const b of bs) {
      const top = b.base - b.h;
      const k = b.kind;
      // Words.
      if (k === 'factory' || k === 'blast' || k === 'refinery') {
        if (R() < 0.75) sign('painted', b.x + b.w / 2, top + Math.min(b.h * 0.18, 30 * s), b.w * 0.82, Math.max(9 * s, Math.min(b.h * 0.18, 22 * s)), `${pick(SURNAMES, R)} & SONS · ${pick(TRADES, R)}`);
      } else if (k === 'gasholder') {
        if (R() < 0.6) sign('painted', b.x + b.w / 2, top + b.h * 0.35, b.w * 0.6, Math.max(8 * s, b.h * 0.2), pick(['GAS', 'GAS & COKE', 'GASLIGHT CO.'], R));
      } else if (k === 'block' || k === 'stack' || k === 'deco' || k === 'arcology' || k === 'quay') {
        const roll = R();
        if (b.w < 70 * s && b.h > GH * 0.12 * L.m && roll < 0.3) {
          const text = pick(TALL, R);
          const sh = Math.min(b.h * 0.45, text.length * 13 * s);
          sign('tall', b.x + (R() < 0.5 ? b.w - 6 * s : 6 * s), top + b.h * 0.12, 11 * s, sh, text);
        } else if (roll < 0.5) {
          const text = pick(BOARDS, R);
          const w = Math.min(b.w * 0.9, Math.max(50 * s, text.length * 8 * s));
          sign(R() < 0.45 ? 'neon' : 'board', b.x + b.w / 2, top + Math.min(b.h * 0.12, 26 * s), w, 13 * s, text);
        } else if (roll < 0.6 && i >= 2) {
          const text = pick(BOARDS, R);
          sign('hanging', b.x + b.w * (R() < 0.5 ? 0.15 : 0.85), top + b.h * (0.45 + R() * 0.3), Math.max(30 * s, text.length * 5.4 * s), 9 * s, text);
        }
      }
      if (i < 2) continue;
      // Machines.
      if (k === 'factory') {
        if (R() < 0.6) mach('beam', b.x + b.w * (0.3 + R() * 0.4), top);
        else if (R() < 0.5) mach('hammer', b.x + b.w * (0.25 + R() * 0.5), top);
        if (R() < 0.35) mach('gears', b.x + b.w * (0.2 + R() * 0.3), top + b.h * 0.55);
      } else if (k === 'blast' || k === 'refinery') {
        if (R() < 0.55) {
          const x = b.x + b.w * (0.15 + R() * 0.2);
          mach('flywheel', x, top + 6 * s, x + 46 * s, top - 34 * s);
        }
        if (R() < 0.3) mach('governor', b.x + b.w * 0.6, top);
      } else if (k === 'block' || k === 'stack' || k === 'quay') {
        const roll = R();
        if (roll < 0.1) mach('crane', b.x + b.w * (0.3 + R() * 0.4), top);
        else if (roll < 0.18) mach('governor', b.x + b.w * (0.3 + R() * 0.4), top);
        else if (roll < 0.28) mach('gears', b.x + b.w * 0.5, top + b.h * (0.25 + R() * 0.3));
        else if (roll < 0.36 && b.h > GH * 0.1 * L.m) mach('elevator', b.x + (R() < 0.5 ? 8 * s : b.w - 8 * s), top + b.h * 0.85, top + b.h * 0.85, top - 8 * s);
        else if (roll < 0.44) mach('beam', b.x + b.w / 2, top);
      }
    }
    // Pipes from building to building, and a pneumatic tube slung between two towers.
    for (let q = 0; q < bs.length - 1; q++) {
      const a = bs[q];
      const b = bs[q + 1];
      if (i < 2 || R() > 0.3 || b.x - (a.x + a.w) > 60 * s) continue;
      const ya = a.base - a.h * (0.25 + R() * 0.4);
      const yb = b.base - b.h * (0.2 + R() * 0.4);
      if (ya < a.base - a.h + 10 * s || yb < b.base - b.h + 10 * s) continue;
      mach('pipes', a.x + a.w * 0.6, ya, b.x + b.w * 0.4, yb);
    }
    const tall = bs.filter((b) => b.h > GH * 0.14 * L.m && b.kind !== 'spire');
    if (i >= 2 && tall.length >= 2 && R() < 0.6) {
      const a = tall[Math.floor(R() * (tall.length - 1))];
      const b = tall.find((q) => q.x - (a.x + a.w) > 40 * s && q.x - (a.x + a.w) < L.cw * 0.45);
      if (b) mach('tube', a.x + a.w, a.base - a.h * (0.6 + R() * 0.2), b.x, b.base - b.h * (0.55 + R() * 0.2));
    }
  }
  function dropChunk(ch: Chunk) {
    const masts = new Set(ch.masts);
    for (const s of world.ships) if (masts.has(s.mast)) s.alive = false;
    world.masts = world.masts.filter((mm) => !masts.has(mm.id));
    const paths = new Set(ch.paths);
    for (const id of paths) world.paths.delete(id);
    world.people = world.people.filter((p) => !paths.has(p.path));
    const key = `${ch.i}:${ch.k}`;
    world.gondolas = world.gondolas.filter((gd) => gd.chunk !== key);
  }
  function rebuild() {
    for (const L of world.layers) {
      const cs = [...world.chunks[L.i].values()].sort((a, b) => a.k - b.k);
      L.buildings = cs.flatMap((c) => c.buildings);
      L.bridges = cs.flatMap((c) => c.bridges);
      L.walkways = cs.flatMap((c) => c.walkways);
      L.cliffs = cs.flatMap((c) => c.cliffs);
      L.machines = cs.flatMap((c) => c.machines);
      L.signs = cs.flatMap((c) => c.signs);
    }
    world.clocks = world.layers.flatMap((L) => L.buildings.filter((b) => b.clock).map((b) => b.clock!));
    world.guns = world.layers.flatMap((L) => L.buildings.filter((b) => b.gun).map((b) => [L.i, b.gun![0], b.gun![1]] as [number, number, number]));
    if (layout === 'tiers') {
      const parts = [...world.chunks[3].values()].map((c) => c.under!).filter(Boolean);
      world.under = {
        deck: world.layers[3].base, floor: GH,
        catwalks: parts.flatMap((p) => p.catwalks), lifts: parts.flatMap((p) => p.lifts), furnaces: parts.flatMap((p) => p.furnaces), vents: parts.flatMap((p) => p.vents), arches: parts.flatMap((p) => p.arches),
      };
    }
    world.version++;
  }
  function stream() {
    let changed = false;
    for (const L of world.layers) {
      const map = world.chunks[L.i];
      const a = Math.floor(vx(L.f, -0.3) / L.cw) - 1;
      const b = Math.floor(vx(L.f, 1.3) / L.cw) + 1;
      for (let k = a; k <= b; k++)
        if (!map.has(k)) {
          map.set(k, makeChunk(L.i, k));
          changed = true;
        }
      for (const [k, ch] of map)
        if (k < a || k > b) {
          dropChunk(ch);
          map.delete(k);
          changed = true;
        }
    }
    if (changed) rebuild();
    // The Great Spire is whichever is nearest the middle of the view.
    const f1 = world.layers[1].f;
    const mid = vx(f1, 0.5);
    const great = world.clocks.filter((c) => c.great).sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid))[0] ?? null;
    if (great !== world.clock) {
      world.clock = great;
      if (great) {
        if (!world.flocks.length) for (let k = 0; k < 2; k++) world.flocks.push({ x: great.x, y: great.y - great.r * 3, f: great.f + 0.04, n: 10 + Math.floor(r() * 8), seed: Math.floor(r() * 999), scatter: 0, home: [0, 0] });
        world.flocks.forEach((fl, k) => {
          fl.home = [great.x + (k - 0.5) * 60 * u, great.top + great.r * (1 + k * 1.5)];
          fl.f = great.f + 0.04;
        });
      }
    }
  }

  // ---- the sky: islands and air platforms, streamed ahead of the view --------------------------------
  function addIsland(f: number, x: number) {
    const iw = (160 + r() * 260) * u * m(f);
    world.islands.push({ id: ids++, f, x, y: GH * (0.12 + r() * 0.22), w: iw, seed: Math.floor(r() * 1e6), vx: (r() - 0.5) * 2 * u, hold: 0, moving: false });
  }
  function addPlatform(f: number, x: number) {
    const w = (240 + r() * 160) * u * m(f);
    const kind: PlatformKind = pick(['dock', 'dock', 'garden', 'fort', 'market']);
    const y = GH * (0.22 + r() * 0.16);
    const p: Platform = { id: ids++, f, x, y, w, kind, seed: Math.floor(r() * 1e6), masts: [], path: -1 };
    if (kind === 'dock') for (const sd of [-1, 1] as const) p.masts.push(addMast(-1, f, x + sd * (w / 2 + 26 * u * m(f)), y - 30 * u * m(f), sd, p.id, null));
    p.path = addPath(-1, f, x - w * 0.42, x + w * 0.42, y, 'deck', null);
    for (let q = 0; q < 3; q++) if (p.path >= 0) person(p.path, r);
    world.platforms.push(p);
  }
  const islandF = () => (layout === 'heights' ? 0.15 + r() * 0.4 : 0.14 + r() * 0.2);
  const platformF = () => 0.32 + r() * 0.36;
  const islandsWanted = layout === 'heights' ? 4 : 1.2;
  const platformsWanted = layout === 'heights' ? 2.4 : 1.4;
  function skyStream(first: boolean) {
    const live = (x: number, f: number) => x > vx(f, -0.4) && x < vx(f, 1.5);
    const isl = world.islands.filter((is) => !is.moving && live(is.x, is.f)).length;
    if (isl < islandsWanted && (first || r() < 0.01)) {
      const f = islandF();
      addIsland(f, first ? vx(f, r()) : vx(f, 1.2 + r() * 0.2));
    }
    const pl = world.platforms.filter((p) => live(p.x, p.f)).length;
    if (pl < platformsWanted && (first || r() < 0.01)) {
      const f = platformF();
      let x = first ? vx(f, 0.12 + r() * 0.76) : vx(f, 1.25 + r() * 0.2);
      for (let j = 0; j < 6 && world.platforms.some((p) => Math.abs(p.x - x) < GW * 0.22); j++) x += GW * 0.25;
      addPlatform(f, x);
    }
    world.islands = world.islands.filter((is) => is.moving || is.x > vx(is.f, -0.5));
    for (const p of world.platforms.filter((q) => q.x < vx(q.f, -0.6))) {
      const ms = new Set(p.masts);
      for (const s of world.ships) if (ms.has(s.mast)) s.alive = false;
      world.masts = world.masts.filter((mm) => !ms.has(mm.id));
      world.paths.delete(p.path);
      world.people = world.people.filter((q) => q.path !== p.path);
    }
    world.platforms = world.platforms.filter((q) => q.x >= vx(q.f, -0.6));
  }

  stream();
  for (let k = 0; k < 6; k++) skyStream(true);

  // ---- ships ------------------------------------------------------------------------------------
  /** Into a drifting view: from behind only if it can outrun the drift, else from ahead. */
  const entry = (f: number, dir: 1 | -1, speed: number, off: number) => (dir > 0 && speed > drift * f * 1.1 ? vx(f, 0) - off : vx(f, 1) + off);
  function spawn(kind: ShipKind, f: number, extra: Partial<Ship> = {}): Ship {
    const dir: 1 | -1 = extra.dir ?? (r() < 0.5 ? 1 : -1);
    const len = LEN[kind] * u * m(f) * (0.85 + r() * 0.3);
    const speed = SPEED[kind] * u * m(f) * (0.85 + r() * 0.3);
    const others = CITIES.filter((c) => c !== world.name);
    const s: Ship = {
      id: ids++, kind, name: pick(NAMES[kind]), f, x: entry(f, dir, speed, len * 0.6), y: GH * (0.08 + r() * 0.36) + (1 - f) * GH * 0.1, dir,
      speed, len, state: 'cruise', t0: world.t, mast: -1, target: -1, fire: 0, tilt: 0, bob: r() * 10,
      colors: pick(COLORS[kind]), flag: pick(['#7f1d1d', '#1e3a5f', '#a16207', '#14532d', '#e7e5e4']), fleet: false, search: r() < 0.5 ? 1 : 0, alive: true, horn: -99,
      team: 0, hp: HP[kind], gun: -99, seed: Math.floor(r() * 1e6),
      reg: `${pick(REG)}-${10 + Math.floor(r() * 140)}`,
      bound: kind === 'hulk' ? 'SALVAGE, BY THE TON' : kind === 'tender' ? 'CITY FIRE BRIGADE' : r() < 0.6 ? `BOUND FOR ${pick(others)}` : `IN FROM ${pick(others)}`,
      line: '', lineT: -99,
      ...extra,
    };
    world.ships.push(s);
    world.ships.sort((a, b) => a.f - b.f);
    return s;
  }
  const MOORS: ShipKind[] = ['zeppelin', 'scout', 'liner', 'hauler', 'twin', 'galleon', 'junk'];
  const mastOf = (id: number) => world.masts.find((mm) => mm.id === id);
  const dockAt = (s: Ship, mm: Mast): [number, number] => [mm.x - s.dir * (s.len * 0.5 + 4 * u * m(s.f)), mm.y + s.len * 0.09];
  const berth = (s: Ship, mm: Mast) => {
    s.dir = mm.side !== 0 ? (mm.side < 0 ? 1 : -1) : mm.x > s.x ? 1 : -1;
  };
  const SKY_MIX: Partial<Record<ShipKind, number>> = { zeppelin: 3, dreadnought: 1.6, junk: 1.1, scout: 2, balloon: 0.8, liner: 1.4, galleon: 1.2, twin: 0.8, gunship: 0.9, hauler: 1.4, hulk: 0.5 };
  const kindRoll = (): ShipKind => {
    let t = 0;
    for (const k in SKY_MIX) t += SKY_MIX[k as ShipKind] ?? 0;
    let x = r() * t;
    for (const k in SKY_MIX) if ((x -= SKY_MIX[k as ShipKind] ?? 0) <= 0) return k as ShipKind;
    return 'zeppelin';
  };
  for (const mm of world.masts) {
    if (world.inView(mm.x, mm.f, -0.05) && r() < 0.45) {
      const s = spawn(pick(['zeppelin', 'zeppelin', 'liner', 'hauler', 'scout'] as ShipKind[]), mm.f);
      s.x = mm.x;
      berth(s, mm);
      if (mm.side === 0) s.dir = r() < 0.5 ? 1 : -1;
      [s.x, s.y] = dockAt(s, mm);
      s.state = 'moored';
      s.mast = mm.id;
      s.t0 = -r() * 30;
      mm.ship = s.id;
    }
  }
  for (let k = 0; k < Math.round(10 * traffic); k++) {
    const f = 0.18 + r() * 0.8;
    const s = spawn(kindRoll(), f);
    s.x = vx(f, r());
  }
  // Trains on the viaduct, the harbour's shipping.
  if (viaductY !== null) for (let k = 0; k < 2; k++) world.trains.push({ layer: 2, x: vx(world.layers[2].f, r()), dir: k ? -1 : 1, cars: 4 + Math.floor(r() * 5), speed: (70 + r() * 30) * u * world.layers[2].m });
  if (world.sea !== null) {
    for (let k = 0; k < 3; k++) {
      const f = 0.62 + r() * 0.24;
      const kind = pick(['ironclad', 'steamer', 'tug'] as const);
      world.seaShips.push({ id: ids++, f, x: vx(f, r()), dir: r() < 0.5 ? 1 : -1, speed: (kind === 'tug' ? 26 : 15) * u * m(f), len: (kind === 'ironclad' ? 300 : kind === 'steamer' ? 220 : 80) * u * m(f), kind, funnels: kind === 'ironclad' ? 3 : kind === 'steamer' ? 2 : 1 });
    }
  }

  // ---- walkers, fire, shells (for the cast) ----------------------------------------------------
  const W_H: Record<WalkerKind, number> = { biped: 290, quad: 230, tripod: 360, colossus: 640, strider: 430, crawler: 250, hexapod: 200 };
  const W_V: Record<WalkerKind, number> = { biped: 19, quad: 22, tripod: 26, colossus: 8, strider: 29, crawler: 11, hexapod: 26 };
  function spawnWalker(kind: WalkerKind, f: number, extra: Partial<Walker> = {}): Walker {
    const dir: 1 | -1 = extra.dir ?? (r() < 0.5 ? 1 : -1);
    const h = W_H[kind] * u * m(f) * (0.85 + r() * 0.3);
    const speed = W_V[kind] * u * m(f) * (0.9 + r() * 0.2);
    const wk: Walker = {
      id: ids++, kind, f, x: entry(f, dir, speed, h), dir, phase: r() * 6, speed, h, gun: -99, siren: -99, alive: true, seed: Math.floor(r() * 1e6),
      team: 0, hp: kind === 'colossus' ? 30 : kind === 'crawler' ? 12 : 6, state: 'walk', t0: world.t,
      name: kind === 'colossus' ? 'THE CITADEL' : `${pick(WALKER_NAMES)} · No. ${1 + Math.floor(r() * 40)}`, line: '', lineT: -99, ambient: false,
      ...extra,
    };
    world.walkers.push(wk);
    world.walkers.sort((a, b) => a.f - b.f);
    return wk;
  }
  function blast(x: number, y: number, f: number, size: number) {
    const sz = size * u * m(f);
    world.fx.push({ kind: 'flash', f, x, y, vx: 0, vy: 0, t0: world.t, dur: 0.8, r: 30 * sz, color: '#ffb060', seed: 0 });
    for (let k = 0; k < 10; k++) world.fx.push({ kind: 'debris', f, x, y, vx: (r() - 0.5) * 160 * m(f), vy: -r() * 140 * m(f), t0: world.t, dur: 1.4, r: 1.6, color: r() < 0.5 ? '#fb923c' : '#3a2a20', seed: k });
    for (let k = 0; k < 4; k++) world.fx.push({ kind: 'smoke', f, x: x + (r() - 0.5) * 20 * sz, y: y - k * 6 * sz, vx: world.wind * m(f), vy: -10 * m(f), t0: world.t + k * 0.1, dur: 9, r: 12 * sz, color: '#2a2420', seed: 0 });
    emit('blast', x, y, Math.min(1, 0.3 + size * 0.2));
  }
  function ignite(layer: number, x: number, y: number, w: number, dur: number): Fire {
    const f = layer >= 0 ? world.layers[layer].f : 0.6;
    const fire: Fire = { layer, f, x, y, w, t0: world.t, until: world.t + dur, out: false };
    world.fires.push(fire);
    return fire;
  }
  function shoot(x0: number, y0: number, x1: number, y1: number, f: number, speed: number, color = '#ffd27a', burst: 0 | 1 | 2 = 0, size = 1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const dur = Math.max(0.15, d / Math.max(1, speed));
    world.fx.push({ kind: 'shell', f, x: x0, y: y0, vx: (x1 - x0) / dur, vy: (y1 - y0) / dur, t0: world.t, dur, r: size, color, seed: burst });
  }
  function crowd(n: number, kinds: PathKind[], flag: number) {
    const ps = [...world.paths.values()].filter((p) => kinds.includes(p.kind) && (p.kind === 'via' || p.kind === 'frame' || world.inView((p.x0 + p.x1) / 2, p.f, 0)));
    for (let k = 0; k < n && ps.length; k++) {
      const p = ps[Math.floor(r() * ps.length)];
      const q = person(p.id, r, { flag, stand: r() < 0.3, kind: flag === 2 ? 3 : Math.floor(r() * 6) });
      // On an endless path, put them where they can be seen.
      if (p.kind === 'via' || p.kind === 'frame') q.u = r();
    }
  }

  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => {
    later.push({ at: world.t + delay, fn });
  };
  const speak = (who: Ship | Walker, line: string) => {
    who.line = line;
    who.lineT = world.t;
  };
  const ctx: Ctx = { world, r, say, emit, chronicle, spawn, walker: spawnWalker, look, blast, ignite, shoot, crowd, after, entry, speak };
  // The city's own walkers, about their work in the streets from the start.
  const AMBIENT: WalkerKind[] = ['biped', 'quad', 'tripod', 'strider', 'crawler', 'hexapod', 'biped', 'strider'];
  const ambientWanted = Math.max(1, Math.round(1.5 * traffic + (layout === 'heights' ? 0 : 0.5)));
  for (let k = 0; k < ambientWanted; k++) {
    const wk = spawnWalker(pick(AMBIENT), 0.56 + r() * 0.18, { ambient: true });
    wk.x = vx(wk.f, 0.15 + r() * 0.7);
  }
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);

  /** A quiet shot worth following (in the view's own terms): a near ship, a walker, a clock. Its own rng. */
  function establish(): { x: number; y: number; zoom: number } {
    if (!world?.ships) return { x: GW / 2, y: GH / 2, zoom: 1 };
    const wk = world.walkers.find((x) => world.inView(x.x, x.f, 0) && x.state !== 'down');
    if (wk && shotR() < 0.5) {
      const [x, y] = nearOf(wk.x, groundAt(wk.f) - wk.h * 0.6, wk.f);
      return { x, y, zoom: 1.7 };
    }
    const pool = world.ships.filter((s) => s.alive && s.f >= 0.7 && world.inView(s.x, s.f, -0.1));
    const s = pool[Math.floor(shotR() * pool.length)];
    if (s && shotR() < 0.7) {
      const [x, y] = nearOf(s.x, s.y + s.len * 0.1, s.f);
      return { x, y, zoom: 1.6 + shotR() * 0.5 };
    }
    const cks = world.clocks.filter((c) => world.inView(c.x, c.f, -0.1));
    const ck = cks[Math.floor(shotR() * cks.length)];
    if (ck) {
      const [x, y] = nearOf(ck.x, ck.y, ck.f);
      return { x, y, zoom: 1.8 };
    }
    return { x: GW / 2, y: GH / 2, zoom: 1 };
  }

  // ---- the ships at work ------------------------------------------------------------------------
  const freeMast = (s: Ship) => world.masts.filter((mm) => mm.ship < 0 && Math.abs(mm.f - s.f) < 0.12 && world.inView(mm.x, mm.f, -0.05)).sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0];
  function shipStep(s: Ship, dt: number) {
    s.bob += dt;
    const wind = world.wind * (0.2 + world.storm) * m(s.f);
    const off = !world.inView(s.x, s.f, 0.2 + s.len / GW);
    switch (s.state) {
      case 'cruise': {
        s.x += s.dir * s.speed * dt + wind * dt * 0.2;
        s.y += Math.sin(s.bob * 0.3) * 1.5 * m(s.f) * dt;
        s.tilt *= 1 - Math.min(1, dt);
        if (MOORS.includes(s.kind) && !s.fleet && s.team === 0 && world.storm < 0.4 && world.inView(s.x, s.f, -0.08) && world.t - s.t0 > 8 && r() < dt * 0.05) {
          const mm = freeMast(s);
          if (mm) {
            mm.ship = s.id;
            s.mast = mm.id;
            s.state = 'approach';
            s.t0 = world.t;
            berth(s, mm);
          }
        }
        if (off && world.t - s.t0 > 5) s.alive = false;
        break;
      }
      case 'approach': {
        const mm = mastOf(s.mast);
        if (!mm) {
          s.state = 'cruise';
          break;
        }
        const [tx, ty] = dockAt(s, mm);
        const dx = tx - s.x;
        const dy = ty - s.y;
        const d = Math.hypot(dx, dy);
        const v = Math.min(s.speed, Math.max(4 * u * m(s.f), d * 0.4));
        if (d > 1.5) {
          s.x += (dx / d) * v * dt;
          s.y += (dy / d) * v * dt;
          s.tilt = Math.max(-0.05, Math.min(0.05, (dy / Math.max(1, d)) * 0.15));
        } else {
          s.state = 'moored';
          s.t0 = world.t;
          s.tilt = 0;
          emit('moor', mm.x, mm.y, 0.15);
          if (s.f > 0.6 && r() < 0.4) say(`THE ${s.name} MOORS ${mm.platform >= 0 ? 'AT THE AIR PLATFORM' : mm.side ? 'AT THE SKYDOCK' : 'AT THE MAST'}`, mm.x, mm.y - 30 * u * m(s.f), s.f);
        }
        break;
      }
      case 'moored': {
        const mm = mastOf(s.mast);
        if (!mm) {
          s.alive = false;
          break;
        }
        s.y = dockAt(s, mm)[1] + Math.sin(s.bob * 0.5) * 1.2 * u * m(s.f) + world.storm * Math.sin(s.bob * 3) * 2 * u;
        s.tilt = Math.sin(s.bob * 0.4) * 0.01;
        if (world.t - s.t0 > 45 + (s.id % 5) * 12 && world.storm < 0.4) {
          s.state = 'depart';
          s.t0 = world.t;
          mm.ship = -1;
          s.mast = -1;
          s.dir = (s.dir * -1) as 1 | -1;
          emit('depart', s.x, s.y, 0.15);
        }
        break;
      }
      case 'depart': {
        s.x += s.dir * s.speed * Math.min(1, (world.t - s.t0) / 8) * dt;
        s.y -= 3 * u * m(s.f) * dt;
        if (off) s.alive = false;
        break;
      }
      case 'attack':
      case 'battle':
      case 'spray':
        s.y += Math.sin(s.bob * 0.4) * 1.2 * m(s.f) * dt;
        break;
      case 'burning': {
        s.fire = Math.min(1, s.fire + dt * 0.15);
        s.x += s.dir * s.speed * 0.4 * dt;
        s.tilt += (0.12 * s.dir - s.tilt) * dt * 0.2;
        s.y += 4 * u * m(s.f) * dt * s.fire;
        if (r() < dt * 8) world.fx.push({ kind: 'smoke', f: s.f, x: s.x + (r() - 0.5) * s.len * 0.6, y: s.y - s.len * 0.1, vx: world.wind, vy: -12 * m(s.f), t0: world.t, dur: 9, r: s.len * 0.07, color: '#1c1917', seed: 0 });
        if (world.t - s.t0 > 14) {
          s.state = 'falling';
          s.t0 = world.t;
          say(`THE ${s.name} GOES DOWN INTO THE LOWER CITY`, s.x, s.y, s.f, '#fdba74');
          chronicle(`The ${titled(s.name)} burned, and went down into the lower city.`);
        }
        break;
      }
      case 'falling': {
        s.y += (14 + (world.t - s.t0) * 6) * u * m(s.f) * dt;
        s.tilt += (0.45 * s.dir - s.tilt) * dt * 0.3;
        s.x += s.dir * s.speed * 0.2 * dt;
        if (r() < dt * 10) world.fx.push({ kind: 'smoke', f: s.f, x: s.x + (r() - 0.5) * s.len * 0.5, y: s.y, vx: world.wind, vy: -14 * m(s.f), t0: world.t, dur: 10, r: s.len * 0.08, color: '#1c1917', seed: 0 });
        const floor = groundAt(s.f) - 20 * u;
        if (s.y > floor) {
          s.alive = false;
          world.fx.push({ kind: 'flash', f: s.f, x: s.x, y: floor, vx: 0, vy: 0, t0: world.t, dur: 1.4, r: s.len * 0.8, color: '#fdba74', seed: 0 });
          for (let k = 0; k < 20; k++) world.fx.push({ kind: 'debris', f: s.f, x: s.x, y: floor, vx: (r() - 0.5) * 200 * m(s.f), vy: -r() * 180 * m(s.f), t0: world.t, dur: 1.6, r: 2 * m(s.f), color: '#fb923c', seed: k });
          world.pyres.push([s.x, floor, s.f, world.t + 70]);
          emit('crash', s.x, floor, 0.9);
        }
        break;
      }
    }
    if (s.fire > 0 && r() < dt * 6) world.fx.push({ kind: 'fire', f: s.f, x: s.x + (r() - 0.5) * s.len * 0.7, y: s.y - s.len * 0.12, vx: (r() - 0.5) * 10, vy: -20 * m(s.f), t0: world.t, dur: 1.2, r: s.len * 0.05, color: '#f97316', seed: 0 });
    if ((s.kind === 'dreadnought' || s.kind === 'carrier' || s.kind === 'liner' || s.kind === 'hulk' || s.kind === 'galleon') && s.state !== 'falling' && r() < dt * (s.kind === 'carrier' ? 5 : 2.2)) {
      const fx = s.x + s.dir * s.len * (s.kind === 'liner' ? r() * 0.3 - 0.05 : r() * 0.3 - 0.12);
      world.fx.push({ kind: 'smoke', f: s.f, x: fx, y: s.y - s.len * (s.kind === 'liner' ? 0.17 : 0.2), vx: -s.dir * s.speed * 0.6 + world.wind, vy: -6 * m(s.f), t0: world.t, dur: 7, r: s.len * 0.035, color: s.kind === 'liner' ? '#6a625a' : '#2b2622', seed: 0 });
    }
  }

  function traffic_() {
    const alive = world.ships.filter((s) => s.alive && !s.fleet && s.team === 0 && s.kind !== 'carrier' && s.kind !== 'tender' && world.inView(s.x, s.f, 0.3));
    if (alive.length < Math.round(10 * traffic) && r() < 0.05) spawn(kindRoll(), 0.18 + r() * 0.8);
  }

  // ---- the city at work -----------------------------------------------------------------------
  let nextPour = 60 + r() * 60;
  let pourUntil = -1;
  let lastHour = Math.floor(world.day * 24);
  function cityStep(dt: number) {
    const prevDay = world.day;
    world.day = (world.day + dt / 240) % 1;
    if (world.day < prevDay) {
      world.season = (world.season + 1) % 4;
      if (world.season === 0) world.year++;
    }
    const night = world.day < 0.22 || world.day > 0.8;
    for (const l of world.layers) {
      const rate = [0.06, 0.1, 0.16, 0.22, 0][l.i];
      for (const b of l.buildings) {
        if (!world.inView(b.x, l.f, 0.15)) continue;
        for (const [cx, cy, cw] of b.chimneys) {
          const heavy = b.kind === 'factory' || b.kind === 'blast' || b.kind === 'refinery';
          if (r() < dt * rate * (heavy ? 3.5 + world.pour * 4 : 1)) {
            world.fx.push({ kind: 'smoke', f: l.f, x: cx, y: cy, vx: world.wind * l.m + (r() - 0.5) * 4, vy: -(10 + r() * 8) * l.m, t0: world.t, dur: heavy ? 16 + r() * 8 : 8 + r() * 5, r: cw * (heavy ? 1.4 : 1), color: heavy ? '#2e2823' : '#5c554c', seed: Math.floor(r() * 99) });
          }
        }
        if (b.kind === 'refinery' && r() < dt * 0.6) world.fx.push({ kind: 'steam', f: l.f, x: b.x + b.w * 0.55, y: b.base - b.h - 20 * u * l.m, vx: world.wind * l.m, vy: -14 * l.m, t0: world.t, dur: 7, r: 14 * u * l.m, color: '#e8e4dc', seed: 0 });
      }
    }
    if (world.under) for (const [vxx, vy] of world.under.vents) if (world.inView(vxx, 0.76, 0) && r() < dt * 0.5) world.fx.push({ kind: 'steam', f: 0.76, x: vxx, y: vy, vx: (r() - 0.5) * 8, vy: -16 * u, t0: world.t, dur: 3.5, r: 8 * u, color: '#e8e4dc', seed: 0 });
    if (world.t > nextPour) {
      nextPour = world.t + 160 + r() * 140;
      pourUntil = world.t + 30;
      const fs = world.layers.flatMap((l) => l.buildings.filter((b) => b.foundry && world.inView(b.x, l.f, 0)));
      const b = fs[Math.floor(r() * fs.length)];
      if (b) {
        const l = world.layers[b.layer];
        say('THE FOUNDRIES POUR, AND THE SKY OVER THE IRONWORKS TURNS RED', b.x + b.w / 2, b.base - b.h - 60 * u * l.m, l.f, '#fdba74');
        emit('pour', b.x + b.w / 2, b.base - b.h, 0.5);
      }
    }
    world.pour += ((world.t < pourUntil ? 1 : 0) - world.pour) * Math.min(1, dt * 0.25);
    if (world.pour > 0.2) {
      for (const l of world.layers)
        for (const b of l.buildings)
          if (b.foundry && world.inView(b.x, l.f, 0.1) && r() < dt * 3 * world.pour) world.fx.push({ kind: 'spark', f: l.f, x: b.x + b.w * (0.2 + r() * 0.6), y: b.base - b.h - 4 * u * l.m, vx: (r() - 0.5) * 60 * l.m, vy: -(30 + r() * 60) * l.m, t0: world.t, dur: 1.2, r: 1.4, color: '#fdba74', seed: 0 });
    }
    const hour = Math.floor(world.day * 24);
    if (hour !== lastHour) {
      lastHour = hour;
      if (hour % 3 === 0) for (const ck of world.clocks) if (world.inView(ck.x, ck.f, 0.1)) world.fx.push({ kind: 'bell', f: ck.f, x: ck.x, y: ck.y, vx: 0, vy: 0, t0: world.t + (ck.great ? 0 : 0.6), dur: 3, r: ck.r, color: '#fde68a', seed: 0 });
      const ck = world.clock;
      if (ck && hour % 3 === 0 && world.inView(ck.x, ck.f, 0)) {
        for (const fl of world.flocks) fl.scatter = 6;
        emit('chime', ck.x, ck.y, 0.3);
        if (hour % 6 === 0) say(`THE GREAT CLOCK STRIKES ${['TWELVE', 'SIX', 'TWELVE', 'SIX'][Math.floor(hour / 6)]}${hour === 12 ? ', AND ITS AUTOMATA COME OUT' : ''}`, ck.x, ck.y - ck.r * 2, ck.f, '#fde68a');
      }
    }
    world.automata += ((world.day > 0.49 && world.day < 0.53 ? 1 : 0) - world.automata) * Math.min(1, dt * 0.6);
    world.pyres = world.pyres.filter((p) => p[3] > world.t);
    for (const [x, y, f] of world.pyres) if (r() < dt * 3) world.fx.push({ kind: 'smoke', f, x: x + (r() - 0.5) * 20 * u, y, vx: world.wind * m(f), vy: -14 * m(f), t0: world.t, dur: 14, r: 10 * u * m(f), color: '#191512', seed: 0 });
    for (const fire of world.fires) {
      if (world.t >= fire.until) continue;
      if (r() < dt * 7) world.fx.push({ kind: 'fire', f: fire.f, x: fire.x + (r() - 0.5) * fire.w, y: fire.y - r() * fire.w * 0.3, vx: (r() - 0.5) * 6, vy: -18 * m(fire.f), t0: world.t, dur: 1.4, r: fire.w * 0.18, color: '#f97316', seed: 0 });
      if (r() < dt * 4) world.fx.push({ kind: 'smoke', f: fire.f, x: fire.x + (r() - 0.5) * fire.w * 0.6, y: fire.y - fire.w * 0.3, vx: world.wind * m(fire.f), vy: -16 * m(fire.f), t0: world.t, dur: 13, r: fire.w * 0.25, color: '#1c1714', seed: 0 });
    }
    world.fires = world.fires.filter((fr) => world.t < fr.until + 2 && fr.x > vx(fr.f, -0.5));
    for (const tr of world.trains) {
      const l = world.layers[tr.layer];
      tr.x += tr.dir * tr.speed * dt;
      const len = tr.cars * 34 * u * l.m + 40 * u * l.m;
      if (tr.x < vx(l.f, -0.3) - len || tr.x > vx(l.f, 1.3) + len) {
        tr.x = tr.dir > 0 ? vx(l.f, -0.2) - len : vx(l.f, 1.2) + len;
        tr.cars = 4 + Math.floor(r() * 5);
      }
      if (r() < dt * 4 && l.viaduct !== null) world.fx.push({ kind: 'smoke', f: l.f, x: tr.x + tr.dir * 20 * u * l.m, y: l.viaduct - 24 * u * l.m, vx: -tr.dir * tr.speed * 0.5 + world.wind, vy: -10 * l.m, t0: world.t, dur: 6, r: 5 * u * l.m, color: '#cfc8bd', seed: 0 });
    }
    for (const gd of world.gondolas) {
      if (gd.wait > 0) {
        gd.wait -= dt;
        continue;
      }
      gd.u += gd.dir * dt * 0.05;
      if (gd.u > 1 || gd.u < 0) {
        gd.u = Math.max(0, Math.min(1, gd.u));
        gd.dir = (gd.dir * -1) as 1 | -1;
        gd.wait = 6;
      }
    }
    for (const s of world.seaShips) {
      s.x += s.dir * s.speed * dt;
      if (s.x < vx(s.f, -0.3) - s.len || s.x > vx(s.f, 1.3) + s.len) s.x = s.dir > 0 ? vx(s.f, -0.2) - s.len : vx(s.f, 1.2) + s.len;
      if (r() < dt * s.funnels * 1.2) world.fx.push({ kind: 'smoke', f: s.f, x: s.x + s.dir * s.len * (0.1 - r() * 0.2), y: (world.sea ?? GH) + (s.f - 0.6) * GH * 0.4 - s.len * 0.2, vx: -s.dir * s.speed + world.wind * m(s.f), vy: -8 * m(s.f), t0: world.t, dur: 9, r: s.len * 0.04, color: '#2b2622', seed: 0 });
    }
    for (const is of world.islands) {
      if (is.moving) {
        const mid = Math.abs(is.x - vx(is.f, 0.5)) < GW * 0.12;
        if (mid && is.hold > 0) {
          is.hold -= dt;
          is.x += drift * is.f * dt;
        } else is.x += is.vx * dt;
        if (!world.inView(is.x, is.f, 0.6 + is.w / GW)) is.moving = false;
      } else is.x += is.vx * dt;
    }
    for (const fl of world.flocks) {
      fl.scatter = Math.max(0, fl.scatter - dt);
      const a = world.t * 0.4 + fl.seed;
      const rad = (fl.scatter > 0 ? 140 : 60) * u * m(fl.f);
      const tx = fl.home[0] + Math.cos(a) * rad;
      const ty = fl.home[1] + Math.sin(a * 1.3) * rad * 0.4 - (fl.scatter > 0 ? 30 * u : 0);
      fl.x += (tx - fl.x) * Math.min(1, dt * 0.5);
      fl.y += (ty - fl.y) * Math.min(1, dt * 0.5);
    }
    for (const s of world.ships) if (night && s.search === 0 && r() < dt * 0.01) s.search = 1;
    for (const p of world.people) {
      const path = world.paths.get(p.path);
      if (!path) continue;
      if (p.wait > 0) {
        p.wait -= dt;
        continue;
      }
      if (p.stand) {
        if (r() < dt * 0.03) p.stand = false;
        continue;
      }
      const len = Math.max(1, path.x1 - path.x0);
      p.u += (p.dir * p.speed * dt) / len;
      if (p.u > 1 || p.u < 0) {
        p.u = Math.max(0, Math.min(1, p.u));
        p.dir = (p.dir * -1) as 1 | -1;
        p.wait = 1 + r() * 4;
      }
      if (r() < dt * (path.kind === 'frame' ? 0.08 : 0.02)) p.stand = true;
    }
    // The crowds of a parade or a rising go home after.
    if (world.bunting < 0.05 && world.unrest < 0.05) {
      const extra = world.people.filter((p) => p.flag > 0);
      if (extra.length && r() < dt * 2) world.people.splice(world.people.indexOf(extra[0]), 1);
    }
    for (const wk of world.walkers) {
      const gy = groundAt(wk.f);
      if (wk.state === 'fall') {
        if (world.t - wk.t0 > 3) {
          wk.state = 'down';
          wk.t0 = world.t;
          blast(wk.x + wk.dir * wk.h * 0.6, gy, wk.f, 4);
          world.pyres.push([wk.x + wk.dir * wk.h * 0.5, gy, wk.f, world.t + 60]);
        }
        continue;
      }
      if (wk.state === 'down') {
        if (world.t - wk.t0 > 70 || !world.inView(wk.x, wk.f, 0.5)) wk.alive = false;
        continue;
      }
      if (wk.state === 'walk') {
        wk.phase += dt * (wk.speed / (wk.h * 0.35)) * 1.4;
        wk.x += wk.dir * wk.speed * dt;
        if (Math.floor(wk.phase / Math.PI) !== Math.floor((wk.phase - dt * 0.5) / Math.PI) && r() < 0.6) {
          for (let k = 0; k < 3; k++) world.fx.push({ kind: 'steam', f: wk.f, x: wk.x + (r() - 0.5) * wk.h * 0.4, y: gy, vx: (r() - 0.5) * 20, vy: -8, t0: world.t, dur: 3, r: wk.h * 0.06, color: '#d6d3d1', seed: k });
          emit('stomp', wk.x, gy, wk.kind === 'colossus' ? 0.3 : 0.08);
        }
      }
      if (r() < dt * (wk.kind === 'colossus' ? 4 : 1.2)) world.fx.push({ kind: 'smoke', f: wk.f, x: wk.x - wk.dir * wk.h * 0.12, y: gy - wk.h * 1.02, vx: world.wind, vy: -10, t0: world.t, dur: 8, r: wk.h * 0.05, color: '#3b342e', seed: 0 });
      if (!world.inView(wk.x, wk.f, 0.2 + (wk.h * 3) / GW)) wk.alive = false;
    }
    world.walkers = world.walkers.filter((x) => x.alive);
    for (const fi of world.fighters) {
      fi.phase += dt;
      fi.x += fi.vx * dt;
      fi.y += fi.vy * dt;
      if (!world.inView(fi.x, fi.f, 0.3) || fi.y > GH || fi.y < -300) fi.alive = false;
    }
    world.fighters = world.fighters.filter((x) => x.alive);
    machinery(dt);
    voices(dt);
    // The city's own walkers: always some about, coming in ahead as the view drifts on.
    const about = world.walkers.filter((x) => x.ambient && x.state === 'walk').length;
    if (about < ambientWanted && r() < dt * 0.25) spawnWalker(pick(AMBIENT), 0.56 + r() * 0.18, { ambient: true });
  }

  /** Steam: from the machines at work, from the ships' exhausts and funnels. */
  function machinery(dt: number) {
    for (const L of world.layers) {
      for (const mc of L.machines) {
        if (!world.inView(mc.x, L.f, 0.05)) continue;
        const s = mc.s;
        let at: [number, number] | null = null;
        let rate = 0;
        if (mc.kind === 'beam') {
          at = [mc.x - 40 * s, mc.y - 30 * s];
          rate = 0.9;
        } else if (mc.kind === 'hammer') {
          at = [mc.x, mc.y - 70 * s];
          rate = 0.7;
        } else if (mc.kind === 'pipes') {
          at = [(mc.x + mc.x2) / 2, mc.y];
          rate = 0.35;
        } else if (mc.kind === 'tube') {
          at = [mc.x, mc.y - 10 * s];
          rate = 0.15;
        } else if (mc.kind === 'governor' || mc.kind === 'flywheel') {
          at = [mc.x, mc.y - 10 * s];
          rate = 0.2;
        }
        if (at && r() < dt * rate) world.fx.push({ kind: 'steam', f: L.f, x: at[0], y: at[1], vx: (r() - 0.5) * 10 * s + world.wind * 0.3, vy: -(14 + r() * 10) * s, t0: world.t, dur: 2.5 + r() * 2, r: 5 * s, color: '#e8e4dc', seed: 0 });
      }
    }
    // The promenade's stations vent, now one, now the other, with a shriek of the whistle.
    const deck = frameDeck(frame, GH, u);
    for (let o = Math.floor(vx(1, 0) / GW) * GW; o < vx(1, 1) + GW; o += GW)
      for (const at of STATIONS) {
        const x = o + GW * at;
        if (!world.inView(x, 1, 0) || r() > dt * 0.35) continue;
        for (let k = 0; k < 4; k++) world.fx.push({ kind: 'steam', f: 1, x: x + (r() - 0.5) * 6 * u, y: deck - riserOf(u) - 32 * u, vx: (r() - 0.5) * 16 * u + world.wind * 0.3, vy: -(30 + r() * 20) * u, t0: world.t + k * 0.12, dur: 2.5 + r(), r: 7 * u, color: '#e8e4dc', seed: 0 });
      }
    for (const s of world.ships) {
      if (!s.alive || s.state === 'falling' || !world.inView(s.x, s.f, 0)) continue;
      for (const [lx, ly] of stacksOf(s)) {
        if (r() > dt * 1.6) continue;
        const x = s.x + s.dir * lx;
        world.fx.push({ kind: r() < 0.5 ? 'steam' : 'smoke', f: s.f, x, y: s.y + ly, vx: -s.dir * s.speed * 0.5 + world.wind, vy: -6 * m(s.f), t0: world.t, dur: 4 + r() * 3, r: s.len * 0.022, color: '#4a443e', seed: 0 });
      }
    }
  }

  /** Now and then, someone aboard a near ship, or in a walker, says something we can hear. */
  let nextVoice = 2;
  function voices(dt: number) {
    nextVoice -= dt;
    if (nextVoice > 0) return;
    nextVoice = 1.6 + r() * 2.4;
    const ships = world.ships.filter((s) => s.alive && s.f >= 0.45 && s.kind !== 'balloon' && world.inView(s.x, s.f, -0.06) && world.t - s.lineT > 9);
    const walkers = world.walkers.filter((x) => (x.state === 'walk' || x.state === 'fire') && world.inView(x.x, x.f, -0.06) && world.t - x.lineT > 9);
    if (walkers.length && (r() < 0.3 || !ships.length)) {
      const wk = walkers[Math.floor(r() * walkers.length)];
      speak(wk, wk.state === 'fire' ? pick(['FIRE!', 'RELOAD THE MAIN GUN', 'TARGET THE ROOF GUNS', 'HOLD HERE, AND SHELL THEM']) : wk.kind === 'colossus' ? pick(['THE CITADEL PASSES', 'ALL BATTERIES, STAND BY', 'STOKERS, MORE STEAM']) : pick(WALKER_LINES));
      return;
    }
    if (!ships.length) return;
    const s = ships.sort((a, b) => b.f - a.f)[Math.floor(Math.pow(r(), 1.6) * ships.length)];
    const own = KIND_LINES[s.kind];
    const pool = s.state === 'cruise' && own && r() < 0.5 ? own : LINES[s.state] ?? LINES.cruise;
    speak(s, pick(pool));
  }

  /** A touch, in the view's own terms: the painter's camera says where that is at each depth. */
  let lastNudge = -Infinity;
  function nudge(x1: number, y1: number): string | null {
    if (world.t - lastNudge < 2.5) return null;
    const v = world.view;
    const sx = (x1 - v.x) * v.zoom;
    const sy = (y1 - v.y) * v.zoom;
    const at = (f: number): [number, number] => {
      const z = v.fit * (1 + (v.zoom / v.fit - 1) * f);
      const cx = GW / 2 + world.scroll * f + (v.x - GW / 2) * f;
      const cy = GH / 2 + (v.y - GH / 2) * f;
      return [sx / z + cx, sy / z + cy];
    };
    for (const s of [...world.ships].reverse()) {
      if (!s.alive) continue;
      const [x, y] = at(s.f);
      if (Math.abs(x - s.x) < s.len * 0.55 && Math.abs(y - s.y) < s.len * 0.22) {
        lastNudge = world.t;
        s.horn = world.t;
        s.search = 1;
        const text = `THE ${s.name} SOUNDS ITS HORN`;
        say(text, s.x, s.y - s.len * 0.3, s.f);
        emit('horn', s.x, s.y, 0.4);
        return text;
      }
    }
    for (const wk of world.walkers) {
      const [x, y] = at(wk.f);
      const gy = groundAt(wk.f);
      if (Math.abs(x - wk.x) < wk.h * 0.5 && y > gy - wk.h * 1.1 && y < gy) {
        lastNudge = world.t;
        wk.siren = world.t;
        say('THE WALKER SOUNDS ITS SIREN', wk.x, gy - wk.h * 1.15, wk.f, '#fca5a5');
        emit('siren', wk.x, gy - wk.h, 0.5);
        return 'THE WALKER SOUNDS ITS SIREN';
      }
    }
    for (const ck of world.clocks) {
      const [x, y] = at(ck.f);
      if (Math.abs(x - ck.x) < ck.r * 2.4 && y > ck.top && y < ck.y + ck.r * 6) {
        lastNudge = world.t;
        world.fx.push({ kind: 'bell', f: ck.f, x: ck.x, y: ck.y, vx: 0, vy: 0, t0: world.t, dur: 3, r: ck.r, color: '#fde68a', seed: 0 });
        for (const fl of world.flocks) fl.scatter = 6;
        const text = ck.great ? 'THE GREAT CLOCK STRIKES' : 'A CLOCK STRIKES IN THE TOWN';
        say(text, ck.x, ck.y - ck.r * 2, ck.f, '#fde68a');
        emit('chime', ck.x, ck.y, 0.4);
        return text;
      }
    }
    lastNudge = world.t;
    const [x3, y3] = at(0.76);
    if (y3 > groundAt(0.76) - GH * 0.2) {
      pourUntil = world.t + 20;
      say('THE FOUNDRIES POUR', x3, y3 - 40 * u, 0.76, '#fdba74');
      emit('pour', x3, y3, 0.4);
      return 'THE FOUNDRIES POUR';
    }
    const [fx1, fy1] = at(1);
    world.fx.push({ kind: 'flare', f: 1, x: fx1, y: fy1, vx: 0, vy: -30 * u, t0: world.t, dur: 4, r: 4 * u, color: '#f87171', seed: 0 });
    const s = world.ships.filter((q) => q.alive && q.f > 0.5).sort((a, b) => Math.abs(a.x - at(a.f)[0]) - Math.abs(b.x - at(b.f)[0]))[0];
    if (s) s.search = 1;
    say('A FLARE GOES UP OVER THE ROOFTOPS', fx1, fy1 - 20 * u, 1, '#fca5a5');
    emit('flare', fx1, fy1, 0.3);
    return 'A FLARE GOES UP OVER THE ROOFTOPS';
  }

  function step(dt: number) {
    world.t += dt;
    world.scroll += drift * dt;
    stream();
    skyStream(false);
    world.director.step(world.t, dt);
    cityStep(dt);
    traffic_();
    for (const s of world.ships) if (s.alive) shipStep(s, dt);
    for (const sy of systems) sy.step?.(dt);
    for (let k = later.length - 1; k >= 0; k--)
      if (later[k].at <= world.t) {
        const d = later.splice(k, 1)[0];
        d.fn();
      }
    for (const f of world.fx) {
      if (world.t < f.t0) continue;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'debris' || f.kind === 'spark' || f.kind === 'bomb' || f.kind === 'water' || f.kind === 'confetti' || f.kind === 'firework') f.vy += (f.kind === 'confetti' ? 20 : f.kind === 'firework' ? 60 : 120) * dt;
      if (f.kind === 'confetti') f.vx += Math.sin(world.t * 3 + f.seed) * 20 * dt;
      if (f.kind === 'smoke' || f.kind === 'steam' || f.kind === 'flak') {
        f.vx += (world.wind * 0.8 - f.vx) * dt * 0.2;
        f.vy *= 1 - dt * 0.05;
        f.r += dt * (f.kind === 'smoke' ? 1.6 : f.kind === 'flak' ? 3 : 2.4) * u * m(f.f);
      }
      if (f.kind === 'lantern') f.x += Math.sin(world.t * 0.5 + f.seed) * 3 * dt;
      if (f.kind === 'shell' && world.t - f.t0 + dt >= f.dur && f.seed > 0) {
        if (f.seed === 1) {
          world.fx.push({ kind: 'flak', f: f.f, x: f.x, y: f.y, vx: 0, vy: 0, t0: world.t, dur: 4, r: 6 * u * m(f.f) * f.r, color: '#2a2622', seed: 0 });
          world.fx.push({ kind: 'flash', f: f.f, x: f.x, y: f.y, vx: 0, vy: 0, t0: world.t, dur: 0.25, r: 12 * u * m(f.f) * f.r, color: '#ffd27a', seed: 0 });
        } else blast(f.x, f.y, f.f, f.r);
        f.seed = 0;
      }
      if (f.kind === 'bomb' && f.seed > 0 && f.y > groundAt(f.f) - 10 * u) {
        f.seed = 0;
        f.dur = 0;
        blast(f.x, f.y, f.f, 3);
        const L = world.layers.slice(0, 4).reduce((a, b) => (Math.abs(b.f - f.f) < Math.abs(a.f - f.f) ? b : a));
        const b = L.buildings.find((q) => f.x > q.x && f.x < q.x + q.w);
        if (b && r() < 0.5) ignite(L.i, b.x + b.w / 2, b.base - b.h * (0.3 + r() * 0.5), b.w * 0.6, 40 + r() * 30);
      }
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur && f.x > vx(f.f, -0.4));
    if (world.fx.length > 1600) world.fx.splice(0, world.fx.length - 1600);
    world.bolts = world.bolts.filter((b) => world.t - b.t0 < 0.5);
    world.ships = world.ships.filter((s) => s.alive);
    for (const mm of world.masts) if (mm.ship >= 0 && !world.ships.some((s) => s.id === mm.ship)) mm.ship = -1;
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
