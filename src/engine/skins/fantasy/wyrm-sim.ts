/**
 * Wyrmspire: a valley, its people, and the wyrm that lives in the spire above it. No DOM.
 *
 * Every seed is a different valley: one of five lands (alpine, fjord, canyon, fen, ashland)
 * with its own houses, water, trees, and weather, and a wyrm of one of five breeds (fire,
 * frost, storm, venom, shadow), each with its own way of doing harm.
 *
 * The valley lives on its own. The year turns through planting, harvest, and winter (with a
 * festival of lanterns on a midwinter night). Shepherds move their herds between pastures,
 * caravans come up the road to market, boats work the water, and villages left in peace grow.
 *
 * The wyrm lives too, by hunger, wrath, and greed. It basks on the spire in the sun, patrols
 * the sky, hunts the herds and carries off what it catches, collects the tribute left at
 * the foot of its spire, and raids a village when its wrath is up: in passes, while the
 * knights ride out, mages ward the roofs, archers loose, and the ballistae (if any are built)
 * throw their bolts. Robbed, it goes on a rampage through every village in turn.
 *
 * The valley answers through its lord, whose temper (bold, cautious, greedy) sets his
 * policy as the years go: endure, fortify (ballista towers), appease (tribute each season),
 * or hunt. A hunt is a quest: a lone hero climbing the spire path to the cave, a hunting
 * party, or a wizard trying to bind the wyrm in chains of light. Thieves climb to the hoard
 * by night. Eggs hatch; rivals come; a wyrm brought down is in time replaced by another.
 *
 * The sim also says where the camera should look (`focus`): the painter follows it.
 *
 * Space: x along the valley (0..BW, wider than the screen), z depth into it (0 far, 1 near),
 * h height above the ground. The spire stands at the far edge, its path zigzagging up to the
 * cave; `sy(z)` is the ground's screen y at zoom 1.
 */
import { forkRng, type Rng } from '../../rng';
import { createBus, type Bus } from '../../sim/bus';
import { dragonName, heroName, makeFaction, placeName, titled, type Faction } from './names';

export type Biome = 'alpine' | 'fjord' | 'canyon' | 'fen' | 'ashland';
export type Breed = 'fire' | 'frost' | 'storm' | 'venom' | 'shadow';
export type Policy = 'endure' | 'fortify' | 'appease' | 'hunt' | 'peace';

const BIOMES: Biome[] = ['alpine', 'fjord', 'canyon', 'fen', 'ashland'];
/** Which breeds each land breeds. */
const BREEDS: Record<Biome, Breed[]> = {
  alpine: ['frost', 'storm', 'fire'],
  fjord: ['storm', 'frost', 'fire'],
  canyon: ['fire', 'storm', 'shadow'],
  fen: ['venom', 'shadow', 'storm'],
  ashland: ['fire', 'shadow', 'venom'],
};
export const BREED_NAMES: Record<Breed, string> = { fire: 'A FIRE WYRM', frost: 'A FROST WYRM', storm: 'A STORM DRAKE', venom: 'A VENOM WYRM', shadow: 'A SHADOW WYRM' };
export const LAND_NAMES: Record<Biome, string> = { alpine: 'THE HIGH VALLEY OF', fjord: 'THE FJORD OF', canyon: 'THE RED CANYON OF', fen: 'THE FEN OF', ashland: 'THE ASHLANDS OF' };
export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;

export type Person = {
  id: number;
  kind: 'villager' | 'knight' | 'mage' | 'archer' | 'hero' | 'thief' | 'wizard' | 'shepherd';
  name?: string;
  x: number;
  z: number;
  h: number;
  tx: number;
  tz: number;
  home: Village | null;
  alive: boolean;
  deadAt: number;
  anim: number;
  facing: 1 | -1;
  cd: number;
  swingUntil: number;
  variant: number;
  wait: number;
  /** Climbing the spire path: how far up (0..1), and which way. */
  climb: number;
  frozen: boolean;
  /** Carries a lantern (the festival) or a torch. */
  light: boolean;
};

export type House = { id: number; village: Village; x: number; z: number; variant: number; burning: number; ruined: number; frozen: number; ward: number };
export type Village = { id: number; name: string; x: number; z: number; houses: House[]; raided: number; wealth: number; walls: boolean };
export type Field = { x: number; z: number; w: number; d: number; withered: number; burnt: number };
export type Herd = { id: number; x: number; z: number; tx: number; tz: number; animals: { dx: number; dz: number; alive: boolean; seed: number }[]; pasture: string; kind: 'sheep' | 'cattle' | 'goats' };
export type Cart = { id: number; kind: 'market' | 'harvest' | 'tribute'; x: number; z: number; tx: number; tz: number; speed: number; done: boolean; seed: number };
export type Boat = { id: number; k: number; dir: 1 | -1; speed: number; big: boolean };
export type Ballista = { id: number; x: number; z: number; cd: number; burning: number; ruined: boolean };

export type Wyrm = {
  name: string;
  breed: Breed;
  size: number;
  x: number;
  z: number;
  h: number;
  vx: number;
  state: 'sleep' | 'wake' | 'fly' | 'dive' | 'climb' | 'home' | 'fall' | 'dead' | 'duel' | 'away' | 'bask' | 'patrol' | 'hunt' | 'carry' | 'collect' | 'fightcave' | 'gone';
  mode: 'raid' | 'rage' | 'hunt' | 'patrol' | 'bask' | 'collect' | 'none';
  hp: number;
  hpMax: number;
  target: Village | null;
  prey: Herd | null;
  passes: number;
  t0: number;
  breathing: boolean;
  wing: number;
  rival: boolean;
  mother: Wyrm | null;
  raids: number;
  hunger: number;
  wrath: number;
  /** The villages left to burn on a rampage. */
  rampage: Village[];
  /** Carrying a beast in its claws. */
  carrying: boolean;
  /** Gone from the valley until. */
  awayUntil: number;
};

export type Shot = { kind: 'arrow' | 'bolt' | 'ballista'; x0: number; z0: number; h0: number; x1: number; z1: number; h1: number; t0: number; dur: number; hit: boolean; done: boolean };
export type Fx = { kind: 'fire' | 'smoke' | 'ward' | 'flash' | 'crater' | 'frost' | 'gas' | 'pall' | 'strike' | 'lantern' | 'rune' | 'chains' | 'sparks' | 'gold'; x: number; z: number; h: number; t0: number; dur: number; r: number; seed: number };
export type Label = { text: string; x: number; z: number; h: number; color: string; t0: number; dur: number };
export type Quest = { kind: 'hero' | 'party' | 'binding' | 'thieves'; t0: number; stage: 'travel' | 'climb' | 'fight' | 'ritual' | 'descend' | 'done'; who: Person[]; name: string };

export type WyrmOptions = { wrath: number; knights: number; villages: number; time: string; valley: string };

export type WyrmWorld = {
  t: number;
  W: number;
  H: number;
  /** The valley's width (wider than the screen: the camera pans along it). */
  BW: number;
  bus: Bus;
  name: string;
  biome: Biome;
  faction: Faction;
  lord: { name: string; temper: 'bold' | 'cautious' | 'greedy' };
  policy: Policy;
  villages: Village[];
  fields: Field[];
  herds: Herd[];
  carts: Cart[];
  boats: Boat[];
  ballistae: Ballista[];
  castle: { x: number; z: number };
  spire: { x: number; caveH: number; topH: number; path: [number, number][] };
  /** Where the tribute is left, and how much lies there; the hoard in the cave. */
  tribute: number;
  hoard: number;
  /** The wyrm is bound by a wizard's chains until. */
  bound: number;
  /** Swords of heroes who died on the ledge. */
  swords: number;
  people: Person[];
  wyrms: Wyrm[];
  quest: Quest | null;
  shots: Shot[];
  fx: Fx[];
  labels: Label[];
  chronicle: { t: number; text: string }[];
  /** Time of day 0..1 (0 midnight), the season 0..3, the year. */
  day: number;
  season: number;
  year: number;
  weather: 'clear' | 'rain' | 'snow' | 'fog' | 'dust' | 'ash' | 'storm';
  /** Where to look: the painter's camera follows it. */
  focus: { x: number; z: number; h: number; zoom: number; until: number; why: string };
  raids: number;
  readonly groundTop: number;
  readonly groundBottom: number;
  sy(z: number): number;
  /** The river's centre at depth z (a world x), and its half-width. */
  riverX(z: number): number;
  riverW(z: number): number;
  /** A point on the spire path (k 0..1): world x and height. */
  pathAt(k: number): [number, number];
  step(dt: number): void;
  resize(W: number, H: number): void;
  counts(): Record<string, number>;
};

const DAY = 120;
const SEASON = 180;

export function createWyrmWorld(seed: string | number, W: number, H: number, opts: WyrmOptions): WyrmWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'wyrm');
  let ids = 1;
  const faction = makeFaction('kingdom', r);
  const biome = (BIOMES as string[]).includes(opts.valley) ? (opts.valley as Biome) : BIOMES[Math.floor(r() * BIOMES.length)];
  const BW = Math.max(1900, W * 1.75);
  const tempers = ['bold', 'cautious', 'greedy'] as const;

  const world: WyrmWorld = {
    t: 0,
    W,
    H,
    BW,
    bus,
    name: placeName(r),
    biome,
    faction,
    lord: { name: heroName(r), temper: tempers[Math.floor(r() * 3)] },
    policy: 'endure',
    villages: [],
    fields: [],
    herds: [],
    carts: [],
    boats: [],
    ballistae: [],
    castle: { x: BW * 0.09, z: 0.42 },
    spire: { x: BW * 0.84, caveH: H * 0.3, topH: H * 0.42, path: [] },
    tribute: 0,
    hoard: 200 + Math.floor(r() * 800),
    bound: -1,
    swords: 0,
    people: [],
    wyrms: [],
    quest: null,
    shots: [],
    fx: [],
    labels: [],
    chronicle: [],
    day: opts.time === 'night' ? 0.02 : opts.time === 'dusk' ? 0.78 : 0.3,
    season: Math.floor(r() * 4),
    year: 1100 + Math.floor(r() * 300),
    weather: 'clear',
    focus: { x: BW * 0.62, z: 0.5, h: 0, zoom: 1, until: 0, why: 'valley' },
    raids: 0,
    get groundTop() {
      return world.H * 0.58;
    },
    get groundBottom() {
      return world.H * 0.93;
    },
    sy: (z) => world.groundTop + z * (world.groundBottom - world.groundTop),
    riverX: (z) => world.spire.x - 90 + (world.BW * 0.04 - world.spire.x + 90) * z + Math.sin(z * 6 + riverPhase) * 70,
    riverW: (z) => (biome === 'fjord' ? 26 : biome === 'canyon' ? 7 : 9) + z * (biome === 'fjord' ? 70 : 20),
    pathAt(k) {
      const p = world.spire.path;
      const f = Math.max(0, Math.min(p.length - 1.001, k * (p.length - 1)));
      const i = Math.floor(f);
      const u = f - i;
      return [p[i][0] + (p[i + 1][0] - p[i][0]) * u, p[i][1] + (p[i + 1][1] - p[i][1]) * u];
    },
    step,
    resize(w, h) {
      world.W = w;
      world.H = h;
      world.spire.caveH = h * 0.3;
      world.spire.topH = h * 0.42;
      makePath();
    },
    counts() {
      const awake = world.wyrms.filter((d) => d.state !== 'sleep' && d.state !== 'dead' && d.state !== 'gone').length;
      return {
        villagers: world.people.filter((p) => p.alive && p.kind === 'villager').length,
        knights: world.people.filter((p) => p.alive && (p.kind === 'knight' || p.kind === 'archer' || p.kind === 'mage')).length,
        houses: world.villages.reduce((s, v) => s + v.houses.filter((h) => h.ruined < 0).length, 0),
        wyrms: world.wyrms.filter((d) => d.state !== 'dead' && d.state !== 'gone').length,
        awake,
        raids: world.raids,
        herd: world.herds.reduce((s, h) => s + h.animals.filter((a) => a.alive).length, 0),
        ballistae: world.ballistae.filter((b) => !b.ruined).length,
        hoard: Math.round(world.hoard),
      };
    },
  };
  const riverPhase = r() * 6;

  // ---- telling ---------------------------------------------------------------------------------

  const say = (text: string, x: number, z: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium', h = 50) => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 4)) return;
    world.labels.push({ text, x, z, h, color, t0: world.t, dur: 5 });
    if (world.labels.length > 8) world.labels.shift();
    bus.emit({ type: 'say', text, x, y: world.sy(z) - h, color, priority });
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 6) world.chronicle.shift();
  };
  const emit = (type: string, x: number, z: number, weight: number) => bus.emit({ type, x, y: world.sy(z), weight });
  const T = titled;
  /** Ask the camera to look somewhere, for a while; a more important sight wins. */
  const PRIORITY: Record<string, number> = { valley: 0, life: 1, caravan: 1, bask: 2, festival: 3, patrol: 3, hunt: 4, quest: 5, raid: 6, duel: 7, slain: 8 };
  const look = (why: string, x: number, z: number, h: number, zoom: number, dur: number) => {
    const f = world.focus;
    if (world.t < f.until && (PRIORITY[f.why] ?? 0) > (PRIORITY[why] ?? 0)) return;
    world.focus = { x, z, h, zoom, until: world.t + dur, why };
  };
  const said = new Set<string>();
  const once = (k: string) => (said.has(k) ? false : (said.add(k), true));

  // ---- the valley ------------------------------------------------------------------------------

  function makePath() {
    // The path up the spire: zigzags from its foot (on the near side of the river) to the cave.
    const path: [number, number][] = [];
    const sx = world.spire.x;
    const legs = 7;
    for (let k = 0; k <= legs; k++) path.push([sx + (k % 2 ? 46 : -64) * (1 - (k / legs) * 0.55) + (k === legs ? 64 * 0.45 : 0), (k / legs) * world.spire.caveH]);
    path[0] = [sx - 110, 0];
    world.spire.path = path;
  }
  makePath();

  const nVillages = Math.max(2, Math.min(4, Math.round(opts.villages)));
  const villageName = (): string => {
    let n = placeName(r);
    for (let k = 0; k < 5 && world.villages.some((v) => v.name === n); k++) n = placeName(r);
    return n;
  };
  for (let i = 0; i < nVillages; i++) {
    const x = BW * (0.22 + (i / Math.max(1, nVillages - 1)) * 0.48) + (r() - 0.5) * BW * 0.04;
    const z = 0.3 + r() * 0.5;
    const v: Village = { id: ids++, name: villageName(), x, z, houses: [], raided: 0, wealth: r(), walls: false };
    const n = 4 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) addHouse(v);
    world.villages.push(v);
    for (let k = 0; k < 4 + Math.floor(r() * 4); k++) person('villager', x + (r() - 0.5) * 80, z + (r() - 0.5) * 0.1, v);
  }
  function addHouse(v: Village) {
    const h: House = { id: ids++, village: v, x: v.x + (r() - 0.5) * (90 + v.houses.length * 6), z: Math.max(0.06, Math.min(0.94, v.z + (r() - 0.5) * 0.24)), variant: Math.floor(r() * 3), burning: -1, ruined: -1, frozen: -1, ward: -1 };
    if (Math.abs(h.x - world.riverX(h.z)) < world.riverW(h.z) + 14) h.x += world.riverW(h.z) * 2 + 20;
    v.houses.push(h);
    v.houses.sort((a, b) => a.z - b.z);
    return h;
  }
  // Fields around the villages.
  for (const v of world.villages) {
    for (let k = 0; k < 6; k++) {
      const x = v.x + (r() - 0.5) * 340;
      const z = Math.max(0.03, Math.min(0.92, v.z + (r() - 0.5) * 0.45));
      if (Math.abs(x - world.riverX(z)) < world.riverW(z) + 40) continue;
      world.fields.push({ x, z, w: 40 + r() * 70, d: 0.03 + r() * 0.04, withered: -1, burnt: -1 });
    }
  }
  // Pastures and their herds, with a shepherd each.
  const beast: Herd['kind'] = biome === 'alpine' ? 'goats' : biome === 'canyon' || biome === 'ashland' ? 'cattle' : 'sheep';
  for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
    const x = BW * (0.2 + r() * 0.55);
    const z = 0.15 + r() * 0.7;
    const herd: Herd = { id: ids++, x, z, tx: x, tz: z, animals: [], pasture: `${placeName(r).replace(/(FORD|MERE|VALE|HOLD|WICK|BY|TON)$/, '')} ${['LEA', 'FOLD', 'DOWNS', 'MEADOW'][i % 4]}`, kind: beast };
    for (let k = 0; k < 6 + Math.floor(r() * 6); k++) herd.animals.push({ dx: (r() - 0.5) * 50, dz: (r() - 0.5) * 0.08, alive: true, seed: Math.floor(r() * 1e6) });
    world.herds.push(herd);
    const sh = person('shepherd', x - 20, z, null);
    sh.tx = x;
    sh.tz = z;
  }
  // Boats, where there is water for them.
  if (biome === 'fjord' || biome === 'fen' || biome === 'alpine') for (let i = 0; i < (biome === 'fjord' ? 3 : 1); i++) world.boats.push({ id: ids++, k: 0.3 + r() * 0.6, dir: r() < 0.5 ? 1 : -1, speed: 0.01 + r() * 0.01, big: biome === 'fjord' && i === 0 });

  function person(kind: Person['kind'], x: number, z: number, home: Village | null): Person {
    const p: Person = { id: ids++, kind, x, z, h: 0, tx: x, tz: z, home, alive: true, deadAt: -1, anim: r() * 4, facing: r() < 0.5 ? 1 : -1, cd: r() * 2, swingUntil: -1, variant: Math.floor(r() * 3), wait: r() * 6, climb: 0, frozen: false, light: false };
    world.people.push(p);
    return p;
  }

  function newWyrm(rival = false, size = 1, mother: Wyrm | null = null): Wyrm {
    const breeds = BREEDS[biome];
    const breed = mother ? mother.breed : breeds[Math.floor(r() * breeds.length)];
    const d: Wyrm = {
      name: size < 1 ? `THE WYRMLING OF ${(mother?.name ?? 'THE SPIRE').replace(/^THE /, '')}` : dragonName(r), breed, size,
      x: rival ? world.BW + 120 : world.spire.x, z: 0.02, h: rival ? 260 : 0, vx: rival ? -110 : 0,
      state: rival ? 'fly' : 'sleep', mode: 'none', hp: 20 * size, hpMax: 20 * size, target: null, prey: null, passes: 0, t0: world.t, breathing: false, wing: 0, rival, mother, raids: 0,
      hunger: 0.2 + r() * 0.3, wrath: 0.3 + r() * 0.4, rampage: [], carrying: false, awayUntil: -1,
    };
    // No two wyrms in the valley share a name.
    for (let k = 0; k < 8 && world.wyrms.some((o) => o.name === d.name); k++) d.name = dragonName(r);
    world.wyrms.push(d);
    return d;
  }

  // ---- the year ------------------------------------------------------------------------------

  const night = () => world.day < 0.22 || world.day > 0.84;
  let lastSeason = world.season;

  function seasons() {
    const yt = world.t / SEASON;
    world.season = (lastSeasonBase + Math.floor(yt)) % 4;
    if (world.season === lastSeason) return;
    lastSeason = world.season;
    if (world.season === 0) world.year++;
    const name = SEASONS[world.season];
    say(`${name} IN ${world.name}`, world.BW * 0.5, 0.2, '#e7dcc4', 'low', 120);
    emit(name.toLowerCase(), world.BW * 0.5, 0.5, 0.25);
    // Spring heals the withered fields; autumn sends the harvest in; winter brings snow up high.
    if (world.season === 0) for (const f of world.fields) {
      f.withered = -1;
      f.burnt = -1;
    }
    if (world.season === 2) {
      for (const v of world.villages) if (v.houses.some((h) => h.ruined < 0)) cart('harvest', v.x, v.z, world.castle.x, world.castle.z);
      say('THE HARVEST COMES IN', world.villages[0].x, world.villages[0].z, '#fde68a', 'low', 90);
      emit('harvest', world.villages[0].x, world.villages[0].z, 0.3);
    }
    // Appeasing: a tribute cart each season to the foot of the spire.
    if (world.policy === 'appease') tributeCart();
    weatherRoll();
    policyTurn();
  }
  const lastSeasonBase = world.season;

  function weatherRoll() {
    const w = world.season === 3;
    const roll = r();
    world.weather =
      biome === 'alpine' ? (w ? 'snow' : roll < 0.25 ? 'fog' : roll < 0.4 ? 'rain' : 'clear')
      : biome === 'fjord' ? (roll < 0.35 ? 'rain' : roll < 0.6 ? 'fog' : w && roll < 0.8 ? 'snow' : 'clear')
      : biome === 'canyon' ? (roll < 0.3 ? 'dust' : 'clear')
      : biome === 'fen' ? (roll < 0.5 ? 'fog' : roll < 0.7 ? 'rain' : 'clear')
      : roll < 0.6 ? 'ash' : 'clear';
    // A storm drake brings its own weather.
    if (world.wyrms.some((d) => d.breed === 'storm' && d.state !== 'dead' && d.state !== 'gone') && r() < 0.3) world.weather = 'storm';
  }

  function cart(kind: Cart['kind'], x: number, z: number, tx: number, tz: number) {
    world.carts.push({ id: ids++, kind, x, z, tx, tz, speed: kind === 'market' ? 22 : 16, done: false, seed: Math.floor(r() * 1e6) });
  }

  function tributeCart() {
    const v = world.villages[Math.floor(r() * world.villages.length)];
    cart('tribute', v.x, v.z, world.spire.path[0][0] - 20, 0.05);
    say(`${v.name} SENDS TRIBUTE TO THE SPIRE`, v.x, v.z, '#fde68a', 'medium', 90);
    emit('tribute', v.x, v.z, 0.4);
    look('caravan', v.x, v.z, 0, 1.25, 10);
  }

  function life(dt: number) {
    const threat = world.wyrms.find((d) => ['fly', 'dive', 'climb', 'hunt', 'patrol', 'carry'].includes(d.state));
    const winter = world.season === 3;
    for (const p of world.people) {
      if (!p.alive || p.frozen) continue;
      if (p.kind === 'villager' && p.home) {
        const v = p.home;
        if (threat && (Math.abs(threat.x - v.x) < 340 || threat.state === 'patrol')) {
          // Run: away from the wyrm, toward the castle; under a shadow wyrm's pall, anywhere.
          p.tx = world.castle.x + (p.id % 7) * 6;
          p.tz = world.castle.z + 0.05 + (p.id % 5) * 0.02;
          p.wait = 0;
        } else if (p.wait > 0) p.wait -= dt;
        else if (Math.hypot(p.tx - p.x, (p.tz - p.z) * 200) < 3) {
          p.wait = 4 + r() * 10;
          if (festival > world.t) {
            p.tx = v.x + (r() - 0.5) * 30;
            p.tz = v.z + (r() - 0.5) * 0.05;
          } else if (night() || winter) {
            const hs = v.houses[p.id % v.houses.length];
            p.tx = hs.x;
            p.tz = hs.z + 0.02;
          } else {
            const f = world.fields[(p.id * 7) % world.fields.length];
            p.tx = f ? f.x + (r() - 0.5) * f.w : v.x + (r() - 0.5) * 200;
            p.tz = f ? f.z : v.z;
          }
        }
        p.light = festival > world.t;
        walk(p, threat ? 46 : 16, dt);
      } else if (p.kind === 'shepherd') {
        const herd = world.herds[p.id % world.herds.length];
        if (herd) {
          p.tx = herd.x - 24;
          p.tz = herd.z;
        }
        walk(p, 14, dt);
      }
    }
    // Herds graze, and move to new grass now and then.
    for (const h of world.herds) {
      if (Math.hypot(h.tx - h.x, (h.tz - h.z) * 200) < 2) {
        if (r() < dt * 0.04) {
          h.tx = Math.max(world.BW * 0.15, Math.min(world.BW * 0.78, h.x + (r() - 0.5) * 300));
          h.tz = Math.max(0.1, Math.min(0.9, h.z + (r() - 0.5) * 0.3));
        }
      } else {
        const dx = h.tx - h.x;
        const dz = (h.tz - h.z) * 200;
        const len = Math.hypot(dx, dz);
        h.x += (dx / len) * 6 * dt;
        h.z += ((dz / len) * 6 * dt) / 200;
      }
      for (const a of h.animals) a.dx += Math.sin(world.t * 0.3 + a.seed) * dt * 0.8;
    }
    // Carts on the road.
    if (r() < dt * 0.018 && !threat) {
      const v = world.villages[Math.floor(r() * world.villages.length)];
      cart('market', -40, 0.62, v.x, v.z);
      if (r() < 0.3) look('caravan', world.BW * 0.15, 0.62, 0, 1.15, 8);
    }
    for (const c of world.carts) {
      const dx = c.tx - c.x;
      const dz = (c.tz - c.z) * 200;
      const len = Math.hypot(dx, dz);
      if (len < 3) {
        c.done = true;
        if (c.kind === 'tribute') {
          world.tribute += 150 + r() * 250;
          world.fx.push({ kind: 'gold', x: c.x, z: c.z, h: 0, t0: world.t, dur: 9999, r: 8, seed: c.id });
        }
        if (c.kind === 'market') {
          const v = world.villages.find((x) => Math.abs(x.x - c.tx) < 2);
          if (v) v.wealth += 0.25;
        }
        continue;
      }
      c.x += (dx / len) * c.speed * dt;
      c.z += ((dz / len) * c.speed * dt) / 200;
    }
    world.carts = world.carts.filter((c) => !c.done);
    for (const b of world.boats) {
      b.k += b.dir * b.speed * dt;
      if (b.k > 0.98 || b.k < 0.15) b.dir = (b.dir * -1) as 1 | -1;
    }
    // Villages left in peace prosper and grow.
    for (const v of world.villages) {
      v.wealth += dt * 0.004;
      if (v.wealth > 1.5 && v.houses.length < 11 && !threat) {
        v.wealth -= 1;
        addHouse(v);
        person('villager', v.x, v.z, v);
        say(`${v.name} GROWS`, v.x, v.z, '#bbf7d0', 'low', 80);
        emit('grows', v.x, v.z, 0.25);
      }
    }
    // The festival of lanterns, on a midwinter night.
    if (winter && night() && festival < 0 && world.day > 0.88 && r() < dt * 0.05 && !threat) {
      const v = world.villages[Math.floor(r() * world.villages.length)];
      festival = world.t + 20;
      for (let k = 0; k < 18; k++) world.fx.push({ kind: 'lantern', x: v.x + (r() - 0.5) * 120, z: v.z + (r() - 0.5) * 0.1, h: 0, t0: world.t + r() * 6, dur: 18, r: 3, seed: Math.floor(r() * 1e6) });
      say(`THE FESTIVAL OF LANTERNS AT ${v.name}`, v.x, v.z, '#fde68a', 'medium', 100);
      emit('festival', v.x, v.z, 0.45);
      look('festival', v.x, v.z, 40, 1.4, 16);
    }
    if (festival > 0 && world.t > festival + 60) festival = -1;
  }
  let festival = -1;

  function walk(p: Person, speed: number, dt: number) {
    const dx = p.tx - p.x;
    const dz = (p.tz - p.z) * 200;
    const len = Math.hypot(dx, dz);
    if (len < 1) return;
    const m = Math.min(len, speed * dt);
    p.x += (dx / len) * m;
    p.z += ((dz / len) * m) / 200;
    p.anim += dt * (p.kind === 'knight' ? 10 : 6);
    if (Math.abs(dx) > 1) p.facing = dx > 0 ? 1 : -1;
  }

  // ---- the lord ---------------------------------------------------------------------------------

  /** Each season the lord looks at how things stand, and his temper decides what he does. */
  function policyTurn() {
    const d = resident();
    if (!d) {
      if (world.policy !== 'peace') {
        world.policy = 'peace';
        announce('THE VALLEY IS AT PEACE');
      }
      return;
    }
    const losses = world.villages.reduce((s, v) => s + v.raided, 0);
    const temper = world.lord.temper;
    let next: Policy = world.policy;
    if (world.policy === 'peace') next = 'endure';
    else if (losses >= 1 && world.policy === 'endure') next = temper === 'greedy' ? 'appease' : 'fortify';
    else if (losses >= 3 && world.policy === 'fortify') next = temper === 'cautious' ? 'appease' : 'hunt';
    else if (world.policy === 'appease' && (world.hoard > 2500 || losses >= 5)) next = 'hunt';
    if (next !== world.policy) {
      world.policy = next;
      const says: Record<Policy, string> = { endure: 'THE VALLEY ENDURES', fortify: 'THE LORD ORDERS BALLISTAE BUILT', appease: 'THE COUNCIL VOTES TRIBUTE', hunt: 'A HUNT IS DECLARED', peace: 'THE VALLEY IS AT PEACE' };
      announce(says[next]);
    }
    // Policies act.
    if (world.policy === 'fortify' || world.policy === 'hunt') buildBallista();
    if (world.policy === 'hunt' && !world.quest && world.bound < world.t) startQuest();
  }

  function announce(text: string) {
    say(text, world.castle.x, world.castle.z, world.faction.color, 'high', 110);
    emit('policy', world.castle.x, world.castle.z, 0.45);
    chronicle(`${T(world.lord.name)} of ${T(world.name)}: ${T(text.toLowerCase())}.`);
  }

  function buildBallista() {
    if (world.ballistae.filter((b) => !b.ruined).length >= 4) return;
    const v = world.villages[world.ballistae.length % world.villages.length];
    const b: Ballista = { id: ids++, x: v.x + (r() < 0.5 ? -1 : 1) * (70 + r() * 40), z: Math.max(0.08, Math.min(0.9, v.z - 0.12)), cd: 0, burning: -1, ruined: false };
    world.ballistae.push(b);
    say(`A BALLISTA TOWER RISES AT ${v.name}`, b.x, b.z, world.faction.color, 'low', 90);
    emit('ballista', b.x, b.z, 0.35);
  }

  // ---- quests ------------------------------------------------------------------------------------

  function startQuest(kind?: Quest['kind']) {
    const k: Quest['kind'] = kind ?? (['hero', 'hero', 'party', 'binding'] as const)[Math.floor(r() * 4)];
    const c = world.castle;
    const who: Person[] = [];
    let name = heroName(r);
    if (k === 'hero') {
      const h = person('hero', c.x, c.z, null);
      h.name = name;
      who.push(h);
      say(`${name} RIDES FOR THE SPIRE`, c.x, c.z, '#fde68a', 'high', 90);
      emit('hero', c.x, c.z, 0.6);
      chronicle(`${T(name)} rode out alone to the spire of ${T(world.name)}.`);
    } else if (k === 'party') {
      name = `${world.lord.name}'S HUNT`;
      for (let i = 0; i < 6; i++) who.push(person('knight', c.x + i * 4, c.z, null));
      who.push(person('mage', c.x, c.z, null));
      say('A HUNTING PARTY RIDES FOR THE SPIRE', c.x, c.z, '#fde68a', 'high', 90);
      emit('huntparty', c.x, c.z, 0.6);
      chronicle(`${T(world.lord.name)} led a hunting party to the spire.`);
    } else if (k === 'binding') {
      name = `${['ISOLDE', 'MORVEN', 'THE GREY MAGISTER', 'OLD CADOC'][Math.floor(r() * 4)]}`;
      const w = person('wizard', c.x, c.z, null);
      w.name = name;
      who.push(w, person('mage', c.x, c.z, null), person('mage', c.x, c.z, null));
      say(`${name} GOES TO BIND THE WYRM`, c.x, c.z, '#c4b5fd', 'high', 90);
      emit('binding', c.x, c.z, 0.55);
      chronicle(`${T(name)} went to the spire to bind its wyrm.`);
    } else {
      name = 'THIEVES';
      const v = world.villages[Math.floor(r() * world.villages.length)];
      for (let i = 0; i < 3; i++) {
        const th = person('thief', v.x, v.z, null);
        th.light = false;
        who.push(th);
      }
    }
    // To the foot of the path.
    for (const p of who) {
      p.tx = world.spire.path[0][0] - 10 - who.indexOf(p) * 8;
      p.tz = 0.04;
    }
    world.quest = { kind: k, t0: world.t, stage: 'travel', who, name };
  }

  function quest(dt: number) {
    const q = world.quest;
    if (!q) return;
    const alive = q.who.filter((p) => p.alive);
    const d = resident();
    const lead = alive[0];
    if (!alive.length) {
      endQuest(false);
      return;
    }
    switch (q.stage) {
      case 'travel': {
        for (const p of alive) walk(p, p.kind === 'knight' || p.kind === 'hero' ? 34 : 20, dt);
        // Thieves wait for night.
        if (q.kind === 'thieves' && !night()) break;
        if (alive.every((p) => Math.abs(p.x - p.tx) < 4)) {
          q.stage = q.kind === 'binding' ? 'ritual' : 'climb';
          q.t0 = world.t;
          if (q.kind === 'thieves') {
            say('SHAPES ON THE SPIRE PATH, BY NIGHT', lead.x, 0.04, '#94a3b8', 'medium', 60);
            emit('thieves', lead.x, 0.04, 0.4);
          } else if (q.kind !== 'binding') {
            say(`${q.kind === 'hero' ? q.name : 'THE HUNT'} BEGINS THE CLIMB`, lead.x, 0.04, '#fde68a', 'medium', 60);
            emit('climb', lead.x, 0.04, 0.4);
          }
        }
        look('quest', lead.x, 0.05, 20, 1.3, 4);
        break;
      }
      case 'climb': {
        // Up the zigzag path, in single file.
        for (const [i, p] of alive.entries()) {
          p.climb = Math.min(1, p.climb + dt * (q.kind === 'thieves' ? 0.034 : 0.026) * (i === 0 ? 1 : 0.98));
          const [x, h] = world.pathAt(Math.max(0, p.climb - i * 0.02));
          p.facing = x > p.x ? 1 : -1;
          p.x = x;
          p.h = h;
          p.z = 0.012;
          p.anim += dt * 5;
        }
        const [lx, lh] = world.pathAt(lead.climb);
        look('quest', lx, 0, lh, 1.6, 4);
        if (lead.climb >= 1) {
          q.stage = 'fight';
          q.t0 = world.t;
          if (q.kind === 'thieves') {
            // In, past the sleeping wyrm, to the gold.
            if (d && d.state === 'sleep' && r() < 0.5) {
              const take = Math.min(world.hoard * 0.4, 300 + r() * 500);
              world.hoard -= take;
              say(`THIEVES MAKE OFF WITH ${Math.round(take)} CROWNS`, world.spire.x, 0, '#fde68a', 'high', world.spire.caveH + 40);
              emit('theft', world.spire.x, 0, 0.6);
              chronicle(`Thieves climbed to the hoard of ${T(d.name)} and got away with ${Math.round(take)} crowns.`);
              d.wrath += 1.2;
              rampagePending = world.t + 20;
              q.stage = 'descend';
            } else if (d) {
              wakeAt(d);
              for (const p of alive) die(p, 'fire');
              say('THE THIEVES WAKE THE WYRM', world.spire.x, 0, '#fca5a5', 'high', world.spire.caveH + 40);
              emit('caught', world.spire.x, 0, 0.7);
              chronicle(`Thieves woke ${T(d.name)}. They did not come down.`);
              d.wrath += 0.6;
              endQuest(false);
            }
          } else if (d && d.state === 'sleep') {
            d.state = 'fightcave';
            d.t0 = world.t;
            say(`${q.kind === 'hero' ? q.name : 'THE HUNT'} FACES ${d.name} AT THE CAVE`, world.spire.x, 0, '#fde68a', 'high', world.spire.caveH + 50);
            emit('cavefight', world.spire.x, 0, 0.8);
          } else {
            // The cave is empty: they wait, and come down.
            q.stage = 'descend';
          }
        }
        break;
      }
      case 'fight': {
        look('quest', world.spire.x, 0, world.spire.caveH, 1.75, 4);
        if (!d) {
          q.stage = 'descend';
          break;
        }
        // Sparks and fire at the cave mouth, for a while; then it is decided.
        if (r() < dt * 3) world.fx.push({ kind: 'sparks', x: world.spire.x - 14 + r() * 28, z: 0, h: world.spire.caveH + r() * 10, t0: world.t, dur: 0.4, r: 6, seed: Math.floor(r() * 1e6) });
        if (r() < dt * 1.2) d.breathing = true;
        for (const p of alive) p.swingUntil = world.t + 0.2;
        if (world.t - q.t0 < 9) break;
        const might = q.kind === 'party' ? alive.length * 0.12 : 0.22;
        const roll = r() + (1 - d.hp / d.hpMax) * 0.3;
        if (roll < might + 0.12) {
          d.hp = 0;
          slay(d, q.kind === 'hero' ? `${q.name}'s sword` : 'the hunt');
          q.stage = 'descend';
        } else if (roll < might + 0.5) {
          d.hp = Math.max(1, d.hp * 0.4);
          d.state = 'away';
          d.vx = 170;
          d.h = world.spire.caveH;
          d.x = world.spire.x;
          d.awayUntil = world.t + SEASON * 1.5;
          say(`${d.name} FLEES THE VALLEY, WOUNDED`, world.spire.x, 0, '#fde68a', 'high', world.spire.caveH + 60);
          emit('wyrmflees', world.spire.x, 0, 0.75);
          chronicle(`${q.kind === 'hero' ? T(q.name) : 'The hunt'} drove ${T(d.name)} from the spire, for a time.`);
          q.stage = 'descend';
        } else {
          for (const p of alive) if (r() < (q.kind === 'party' ? 0.7 : 1)) die(p, 'fire');
          if (q.kind === 'hero') {
            world.swords++;
            say(`${q.name} FALLS AT THE CAVE`, world.spire.x, 0, '#fca5a5', 'high', world.spire.caveH + 60);
            emit('herofalls', world.spire.x, 0, 0.7);
            chronicle(`${T(q.name)} died at the cave of ${T(d.name)}. The sword is still on the ledge.`);
          } else {
            say('THE HUNT IS BROKEN AT THE CAVE', world.spire.x, 0, '#fca5a5', 'high', world.spire.caveH + 60);
            emit('herofalls', world.spire.x, 0, 0.7);
            chronicle(`The hunt was broken at the cave of ${T(d.name)}.`);
          }
          d.wrath += 0.6;
          d.state = 'sleep';
          endQuest(false);
        }
        break;
      }
      case 'ritual': {
        // A circle of runes at the foot of the spire, chains of light climbing to the cave.
        look('quest', world.spire.path[0][0], 0.04, 60, 1.35, 4);
        for (const p of alive) p.swingUntil = world.t + 0.3;
        if (r() < dt * 2) world.fx.push({ kind: 'rune', x: world.spire.path[0][0] + (r() - 0.5) * 60, z: 0.04, h: 0, t0: world.t, dur: 3, r: 4, seed: Math.floor(r() * 1e6) });
        if (once(`chains-${q.t0}`)) world.fx.push({ kind: 'chains', x: world.spire.path[0][0], z: 0.02, h: 0, t0: world.t, dur: 26, r: 1, seed: 7 });
        if (!d) {
          // Nothing left in the spire to bind.
          endQuest(false);
          break;
        }
        if (world.t - q.t0 < 24) break;
        if (r() < 0.55) {
          world.bound = world.t + SEASON * 2;
          if (d.state !== 'sleep') d.state = 'home';
          say(`${d.name} IS BOUND IN CHAINS OF LIGHT`, world.spire.x, 0, '#c4b5fd', 'high', world.spire.caveH + 60);
          emit('bound', world.spire.x, 0, 0.75);
          chronicle(`${T(q.name)} bound ${T(d.name)} in its spire.`);
          endQuest(true);
        } else {
          wakeAt(d);
          d.wrath += 1;
          for (const p of alive) if (p.kind === 'wizard' || r() < 0.5) die(p, 'fire');
          say('THE BINDING FAILS', world.spire.path[0][0], 0.04, '#fca5a5', 'high', 90);
          emit('bindingfails', world.spire.path[0][0], 0.04, 0.7);
          chronicle(`${T(q.name)}'s binding failed, and the wyrm woke angry.`);
          endQuest(false);
        }
        break;
      }
      case 'descend': {
        for (const [i, p] of alive.entries()) {
          p.climb = Math.max(0, p.climb - dt * 0.05);
          const [x, h] = world.pathAt(p.climb + i * 0.02);
          p.x = x;
          p.h = h;
          p.anim += dt * 5;
        }
        if (alive.every((p) => p.climb <= 0)) {
          for (const p of alive) {
            p.h = 0;
            p.tx = world.castle.x;
            p.tz = world.castle.z;
          }
          endQuest(true);
        }
        break;
      }
      default:
        break;
    }
  }

  function endQuest(_ok: boolean) {
    const q = world.quest;
    if (!q) return;
    for (const p of q.who) if (p.alive) {
      p.h = 0;
      p.climb = 0;
      p.tx = world.castle.x;
      p.tz = world.castle.z;
    }
    world.quest = null;
  }

  // ---- the wyrm ----------------------------------------------------------------------------------

  const resident = () => world.wyrms.find((d) => !d.rival && d.size >= 1 && d.state !== 'dead' && d.state !== 'gone');

  function wakeAt(d: Wyrm) {
    d.state = 'wake';
    d.t0 = world.t;
    d.mode = 'raid';
    d.target = richest();
    d.passes = 0;
  }
  const richest = () => [...world.villages].sort((a, b) => b.houses.filter((h) => h.ruined < 0).length - a.houses.filter((h) => h.ruined < 0).length || a.raided - b.raided)[0];

  /** What the wyrm wants, when it wakes: to eat, to burn, to look at its valley, to sit in the sun. */
  function decide(d: Wyrm) {
    if (world.bound > world.t || d.awayUntil > world.t) return;
    if (opts.wrath <= 0) return;
    const pulse = r();
    let mode: Wyrm['mode'] = 'none';
    if (rampagePending > 0 && world.t > rampagePending) {
      mode = 'rage';
      rampagePending = -1;
    } else if (d.wrath > 1.1 || (d.hunger > 0.75 && !world.herds.some((h) => h.animals.some((a) => a.alive)))) mode = 'raid';
    else if (d.hunger > 0.6) mode = world.tribute > 0 && night() ? 'collect' : 'hunt';
    else if (world.tribute > 0 && night() && pulse < 0.3) mode = 'collect';
    else if (!night() && pulse < 0.18 * opts.wrath && world.weather === 'clear') mode = 'bask';
    else if (pulse < 0.12 * opts.wrath) mode = 'patrol';
    else if (d.wrath > 0.7 && pulse < 0.3 * opts.wrath) mode = 'raid';
    if (mode === 'none') return;
    d.mode = mode;
    d.t0 = world.t;
    d.passes = 0;
    if (mode === 'bask') {
      d.state = 'bask';
      say(`${d.name} BASKS ON THE SPIRE`, world.spire.x, 0, '#fdba74', 'low', world.spire.topH + 20);
      emit('bask', world.spire.x, 0, 0.3);
      look('bask', world.spire.x, 0, world.spire.topH - 30, 1.5, 12);
      return;
    }
    // Everything else starts with the wyrm leaving its cave.
    d.state = 'wake';
    if (mode === 'raid' || mode === 'rage') {
      d.rampage = mode === 'rage' ? [...world.villages].sort(() => r() - 0.5) : [];
      d.target = mode === 'rage' ? d.rampage.shift()! : richest();
      say(`${d.name} WAKES ${mode === 'rage' ? 'IN A RAGE' : 'IN THE SPIRE'}`, world.spire.x, 0, '#fb923c', 'high', world.spire.caveH + 60);
      emit(mode === 'rage' ? 'rage' : 'wake', world.spire.x, 0, 0.85);
      say('THE WATCH SOUNDS THE HORN', world.castle.x, world.castle.z, '#fde68a', 'medium', 120);
      emit('horn', world.castle.x, world.castle.z, 0.5);
      if (d.target) muster(d.target);
      look('raid', world.spire.x, 0, world.spire.caveH, 1.4, 5);
      if (mode === 'rage') chronicle(`Robbed, ${T(d.name)} went from village to village in a rage.`);
    } else {
      look(mode === 'patrol' ? 'patrol' : 'hunt', world.spire.x, 0, world.spire.caveH, 1.2, 4);
    }
  }
  let rampagePending = -1;

  function muster(v: Village) {
    if (opts.knights <= 0) return;
    const n = Math.round(6 * opts.knights);
    const c = world.castle;
    for (let i = 0; i < n; i++) {
      const p = person('knight', c.x + (r() - 0.5) * 20, c.z + (r() - 0.5) * 0.06, null);
      p.tx = v.x + (r() - 0.5) * 120;
      p.tz = Math.max(0.05, Math.min(0.95, v.z + (r() - 0.5) * 0.25));
    }
    for (let i = 0; i < Math.max(1, Math.round(2 * opts.knights)); i++) {
      const p = person('mage', c.x, c.z + 0.04, null);
      p.tx = v.x + (r() - 0.5) * 60;
      p.tz = v.z + (r() - 0.5) * 0.1;
    }
    for (let i = 0; i < Math.round(4 * opts.knights); i++) {
      const p = person('archer', c.x, c.z + 0.02, null);
      p.tx = v.x - 60 - r() * 80;
      p.tz = Math.max(0.05, Math.min(0.95, v.z + (r() - 0.5) * 0.3));
    }
    say(`${world.lord.name} RIDES OUT`, c.x, c.z, faction.color, 'medium', 70);
    emit('ride', c.x, c.z, 0.5);
  }

  function wyrms(dt: number) {
    for (const d of world.wyrms) {
      d.wing += dt * (d.state === 'fall' ? 18 : d.state === 'sleep' || d.state === 'dead' || d.state === 'gone' ? 0 : d.state === 'bask' ? 1.5 : 7);
      if (d.state !== 'fightcave') d.breathing = false;
      d.hunger = Math.min(1.2, d.hunger + dt * 0.0035 * (d.breed === 'fire' ? 1.2 : 1));
      // Long asleep, a wyrm grows restless; out and about, it settles.
      d.wrath = d.state === 'sleep' ? Math.min(2, d.wrath + dt * 0.005 * opts.wrath) : Math.max(0, d.wrath - dt * 0.002);
      switch (d.state) {
        case 'sleep':
          d.hp = Math.min(d.hpMax, d.hp + dt * 0.05);
          break;
        case 'wake':
          if (world.t - d.t0 > 3) {
            d.state = d.mode === 'patrol' ? 'patrol' : d.mode === 'hunt' ? 'hunt' : d.mode === 'collect' ? 'collect' : 'fly';
            d.t0 = world.t;
            d.h = world.spire.caveH;
            d.vx = -60;
            if (d.mode === 'hunt') {
              const herds = world.herds.filter((h) => h.animals.some((a) => a.alive));
              d.prey = herds[Math.floor(r() * herds.length)] ?? null;
              if (!d.prey) d.state = 'home';
            }
          }
          break;
        case 'bask':
          // On the top of the spire, wings half open, a while.
          d.x = world.spire.x + 4;
          d.h = world.spire.topH;
          d.z = 0;
          d.vx = Math.sin(world.t * 0.2) > 0 ? 1 : -1;
          if (world.t - d.t0 > 22) {
            d.state = 'sleep';
            d.h = 0;
            d.x = world.spire.x;
          }
          break;
        case 'patrol': {
          // A long loop high over the valley; the valley holds its breath.
          const age = world.t - d.t0;
          const k = age / 34;
          d.x = world.spire.x - Math.sin(k * Math.PI) * world.BW * 0.7;
          d.vx = -Math.cos(k * Math.PI) * 120;
          d.h = world.spire.caveH * 0.8 + Math.sin(k * 9) * 30;
          d.z = 0.2 + Math.sin(k * Math.PI) * 0.4;
          if (once(`patrol-${Math.floor(d.t0)}`)) {
            say(`${d.name} PATROLS THE VALLEY`, d.x, d.z, '#fdba74', 'medium', d.h + 30);
            emit('patrol', d.x, d.z, 0.45);
          }
          look('patrol', d.x, d.z, d.h, 1.05, 3);
          if (k >= 1) {
            d.state = 'sleep';
            d.h = 0;
            d.x = world.spire.x;
          }
          break;
        }
        case 'hunt': {
          // Down on a herd: one pass, and away with what it can carry.
          const h = d.prey;
          if (!h) {
            d.state = 'home';
            break;
          }
          d.vx += (Math.sign(h.x - d.x) * 150 - d.vx) * dt * 1.5;
          d.x += d.vx * dt;
          d.z += (h.z - d.z) * dt * 1.2;
          const close = Math.abs(h.x - d.x);
          d.h += ((close < 160 ? 12 : 120) - d.h) * dt * 1.8;
          look('hunt', d.x, d.z, d.h, 1.45, 3);
          if (close < 20 && d.h < 30) {
            const taken = h.animals.filter((a) => a.alive).slice(0, d.size >= 1 ? 2 : 1);
            for (const a of taken) a.alive = false;
            d.carrying = true;
            d.hunger = Math.max(0, d.hunger - 0.55);
            d.state = 'carry';
            d.t0 = world.t;
            const what = h.kind === 'goats' ? 'GOATS' : h.kind === 'cattle' ? 'CATTLE' : 'SHEEP';
            say(`${d.name} TAKES ${what} FROM ${h.pasture}`, h.x, h.z, '#fdba74', 'medium', 80);
            emit('hunt', h.x, h.z, 0.55);
            if (once(`hunt-chron-${Math.floor(world.t / 200)}`)) chronicle(`${T(d.name)} took ${what.toLowerCase()} from ${T(h.pasture)}.`);
            // The shepherds lose heart, and the flock is made up from the villages, slowly.
            setTimeout0(() => h.animals.push({ dx: (r() - 0.5) * 40, dz: (r() - 0.5) * 0.06, alive: true, seed: Math.floor(r() * 1e6) }), 60);
          }
          break;
        }
        case 'carry':
        case 'collect':
        case 'home': {
          if (d.state === 'collect') {
            // To the tribute at the foot of the spire, and up with it.
            const tx = world.spire.path[0][0] - 20;
            d.vx += (Math.sign(tx - d.x) * 100 - d.vx) * dt * 1.5;
            d.x += d.vx * dt;
            d.z += (0.05 - d.z) * dt;
            d.h += (14 - d.h) * dt;
            look('hunt', d.x, d.z, d.h, 1.35, 3);
            if (Math.abs(tx - d.x) < 12) {
              d.hunger = Math.max(0, d.hunger - 0.4);
              world.hoard += world.tribute;
              say(`${d.name} TAKES THE TRIBUTE`, d.x, d.z, '#fde68a', 'medium', 60);
              emit('collect', d.x, d.z, 0.45);
              world.tribute = 0;
              world.fx = world.fx.filter((f) => f.kind !== 'gold');
              d.wrath = Math.max(0, d.wrath - 0.4);
              d.state = 'home';
            }
            break;
          }
          d.vx += (Math.sign(world.spire.x - d.x) * 140 - d.vx) * dt * 1.5;
          d.x += d.vx * dt;
          d.z += (0.02 - d.z) * dt * 0.8;
          d.h += (world.spire.caveH - d.h) * dt * 0.6;
          if (Math.abs(world.spire.x - d.x) < 12 && Math.abs(d.h - world.spire.caveH) < 30) {
            const wasRaid = d.mode === 'raid' || d.mode === 'rage';
            d.state = 'sleep';
            d.x = world.spire.x;
            d.h = 0;
            d.carrying = false;
            if (wasRaid) {
              d.wrath = Math.max(0, d.wrath - 0.9);
              d.raids++;
              world.raids++;
              recall();
            }
            d.mode = 'none';
            if (d.size < 1 && d.raids >= 2) {
              d.state = 'away';
              d.vx = 160;
              d.h = 240;
              say(`${d.name} FLIES OFF TO FIND ITS OWN SPIRE`, d.x, 0, '#fdba74', 'medium', 240);
              emit('fledge', d.x, 0, 0.5);
            }
            if (d.size >= 1 && d.raids >= 2 && !world.wyrms.some((o) => o.mother === d && o.state !== 'dead' && o.state !== 'away' && o.state !== 'gone') && r() < 0.25) {
              newWyrm(false, 0.6, d);
              say('AN EGG HATCHES IN THE SPIRE', world.spire.x, 0, '#fde68a', 'high', world.spire.caveH + 40);
              emit('hatch', world.spire.x, 0, 0.75);
              look('quest', world.spire.x, 0, world.spire.caveH, 1.7, 8);
              chronicle(`An egg hatched in the spire above ${T(world.name)}.`);
            }
          }
          break;
        }
        case 'fly': {
          const v = d.target;
          const foe = d.rival ? resident() : null;
          if (d.rival && foe) {
            if (foe.state === 'sleep' || foe.state === 'bask') {
              foe.state = 'fly';
              foe.target = null;
              foe.h = world.spire.caveH;
            }
            if (Math.abs(foe.x - d.x) < 160) {
              d.state = 'duel';
              foe.state = 'duel';
              d.t0 = foe.t0 = world.t;
              say('TWO DRAGONS FIGHT OVER THE VALLEY', (d.x + foe.x) / 2, 0.3, '#fb923c', 'high', 280);
              emit('dragonfight', (d.x + foe.x) / 2, 0.3, 0.9);
              chronicle(`${T(d.name)} came over the mountains for ${T(foe.name)}'s spire.`);
            } else {
              d.vx += (Math.sign(foe.x - d.x) * 120 - d.vx) * dt;
              d.x += d.vx * dt;
            }
            look('duel', d.x, 0.3, d.h, 1.05, 3);
            break;
          }
          if (!v) {
            const rv = world.wyrms.find((o) => o.rival && o.state === 'fly');
            if (!rv) {
              d.state = 'home';
              break;
            }
            d.vx += (Math.sign(rv.x - d.x) * 90 - d.vx) * dt;
            d.x += d.vx * dt;
            d.h += (210 - d.h) * dt;
            d.z += (0.3 - d.z) * dt * 0.5;
            break;
          }
          const tx = v.x - Math.sign(v.x - d.x || 1) * 160;
          d.vx += (Math.sign(tx - d.x) * 130 - d.vx) * dt * 1.5;
          d.x += d.vx * dt;
          d.z += (v.z - d.z) * dt * 0.8;
          d.h += (130 - d.h) * dt;
          look('raid', d.x, d.z, d.h, 1.1, 3);
          if (Math.abs(tx - d.x) < 30) dive(d);
          break;
        }
        case 'dive': {
          const v = d.target!;
          d.x += d.vx * dt;
          d.h += (36 * d.size + 10 - d.h) * dt * 2.4;
          d.breathing = d.h < 70 && Math.abs(d.x - v.x) < 120;
          if (d.breathing) breathe(d, dt);
          look('raid', d.x, d.z, d.h, 1.2, 3);
          if ((d.vx > 0 && d.x > v.x + 170) || (d.vx < 0 && d.x < v.x - 170)) {
            d.passes++;
            d.state = 'climb';
            d.t0 = world.t;
          }
          break;
        }
        case 'climb': {
          d.h += (170 - d.h) * dt * 1.2;
          d.x += d.vx * dt;
          d.vx += (-Math.sign(d.vx) * 130 - d.vx) * dt * 0.8;
          // A ballista nearby draws its fire.
          if (world.t - d.t0 > 3) {
            const v = d.target!;
            const standing = v.houses.filter((h) => h.ruined < 0 && h.burning < 0 && h.frozen < 0).length;
            if (d.hp < d.hpMax * 0.5 || d.passes >= 3 + Math.floor(d.size * 2) || standing === 0) {
              const driven = d.hp < d.hpMax * 0.5;
              if (d.mode === 'rage' && d.rampage.length && !driven) {
                d.target = d.rampage.shift()!;
                d.passes = 0;
                d.state = 'fly';
                break;
              }
              d.state = 'home';
              d.wrath = Math.max(0, d.wrath - 0.6);
              if (driven && d.size >= 1) {
                d.wrath += 0.4;
                say(`${d.name} IS DRIVEN OFF`, d.x, d.z, faction.color, 'high', d.h + 30);
                emit('driven', d.x, d.z, 0.7);
                chronicle(`The knights of ${T(world.name)} drove ${T(d.name)} back to the spire.`);
              } else if (d.size >= 1) {
                say(`${d.name} RETURNS TO THE SPIRE`, d.x, d.z, '#fdba74', 'medium', d.h + 30);
                emit('sated', d.x, d.z, 0.4);
              }
            } else dive(d);
          }
          break;
        }
        case 'away':
          d.x += d.vx * dt;
          d.h += 30 * dt;
          if (d.x > world.BW + 200 || d.x < -200) {
            if (d.awayUntil > world.t) {
              d.state = 'gone';
            } else d.state = 'dead';
          }
          break;
        case 'gone':
          // Away a season and more; then back, angry.
          if (world.t > d.awayUntil && resident()) {
            // Another has its spire: it comes back to fight for it.
            d.rival = true;
            d.state = 'fly';
            d.x = world.BW + 120;
            d.h = 260;
            d.vx = -110;
            d.hp = d.hpMax;
            d.awayUntil = -1;
            say(`${d.name} COMES BACK FOR ITS SPIRE`, world.BW - 60, 0.1, '#fb923c', 'high', 240);
            emit('rival', world.BW - 60, 0.1, 0.7);
          } else if (world.t > d.awayUntil) {
            d.state = 'sleep';
            d.x = world.spire.x;
            d.h = 0;
            d.hp = d.hpMax;
            d.wrath += 0.8;
            d.awayUntil = -1;
            say(`${d.name} RETURNS TO ITS SPIRE`, world.spire.x, 0, '#fb923c', 'high', world.spire.caveH + 60);
            emit('returns', world.spire.x, 0, 0.6);
            chronicle(`${T(d.name)} came back to the spire, healed.`);
          }
          break;
        case 'duel':
          duel(d, dt);
          break;
        case 'fightcave':
          // In the cave mouth, facing the ledge where the path comes up.
          d.x = world.spire.x - 8;
          d.h = world.spire.caveH;
          d.z = 0;
          d.vx = 1;
          break;
        case 'fall':
          d.h -= (60 + (world.t - d.t0) * 160) * dt;
          d.x += d.vx * dt * 0.5;
          look('slain', d.x, d.z, Math.max(0, d.h), 1.3, 6);
          if (d.h <= 0) {
            d.h = 0;
            d.state = 'dead';
            d.t0 = world.t;
            world.fx.push({ kind: 'crater', x: d.x, z: d.z, h: 0, t0: world.t, dur: 400, r: 60 * d.size, seed: 3 });
            world.fx.push({ kind: 'smoke', x: d.x, z: d.z, h: 0, t0: world.t, dur: 30, r: 40, seed: 5 });
            for (const p of world.people) if (p.alive && Math.abs(p.x - d.x) < 40 && Math.abs(p.z - d.z) < 0.08) die(p, 'crush');
          }
          break;
        default:
          break;
      }
      if (d.mother && d.size < 1 && d.state === 'sleep' && d.mother.state === 'fly' && d.mother.mode === 'raid') {
        d.state = 'fly';
        d.h = world.spire.caveH;
        d.target = d.mother.target;
        d.mode = 'raid';
      }
    }
    // A wyrm brought down: in time another takes the spire.
    if (!resident()) {
      if (vacantSince < 0) vacantSince = world.t;
      if (world.t - vacantSince > 110) {
        vacantSince = -1;
        const d = newWyrm();
        say(`${d.name}, ${BREED_NAMES[d.breed]}, TAKES THE EMPTY SPIRE`, world.spire.x, 0, '#fb923c', 'high', world.spire.caveH + 60);
        emit('newwyrm', world.spire.x, 0, 0.6);
        look('quest', world.spire.x, 0, world.spire.caveH, 1.4, 8);
        chronicle(`${T(d.name)}, ${T(BREED_NAMES[d.breed].toLowerCase())}, came to the empty spire above ${T(world.name)}.`);
        world.policy = 'endure';
        for (const v of world.villages) v.raided = 0;
      }
    } else vacantSince = -1;
  }
  let vacantSince = -1;

  /** Deferred bits of story (in sim time, deterministic). */
  const later: { at: number; fn: () => void }[] = [];
  const setTimeout0 = (fn: () => void, s: number) => later.push({ at: world.t + s, fn });

  function dive(d: Wyrm) {
    const v = d.target!;
    d.state = 'dive';
    d.vx = Math.sign(v.x - d.x || 1) * (150 + r() * 30);
    d.z = Math.max(0.08, Math.min(0.92, v.z + (r() - 0.5) * 0.2));
    if (d.passes === 0) {
      say(`${d.name} FALLS ON ${v.name}`, v.x, v.z, '#fb923c', 'high', 160);
      emit('dragon', v.x, v.z, 0.85);
      v.raided++;
    }
  }

  let breathTick = 0;
  /** The breed decides what the breath does. */
  function breathe(d: Wyrm, dt: number) {
    breathTick -= dt;
    if (breathTick > 0) return;
    breathTick = d.breed === 'storm' ? 0.35 : 0.12;
    const fx = d.x + Math.sign(d.vx) * 30 * d.size;
    const kind = d.breed === 'frost' ? 'frost' : d.breed === 'venom' ? 'gas' : d.breed === 'shadow' ? 'pall' : d.breed === 'storm' ? 'strike' : 'fire';
    world.fx.push({ kind, x: fx + (d.breed === 'storm' ? (r() - 0.5) * 60 : 0), z: d.z, h: 0, t0: world.t, dur: kind === 'gas' ? 14 : kind === 'pall' ? 10 : kind === 'frost' ? 20 : kind === 'strike' ? 0.5 : 1.4, r: 22 * d.size, seed: Math.floor(r() * 1e6) });
    const firstWord: Record<Breed, string> = { fire: 'BURNS', frost: 'IS FROZEN', storm: 'IS STRUCK BY LIGHTNING', venom: 'CHOKES IN VENOM', shadow: 'GOES DARK' };
    const event: Record<Breed, string> = { fire: 'dragonfire', frost: 'frostbreath', storm: 'stormbreath', venom: 'venombreath', shadow: 'shadowbreath' };
    for (const v of world.villages) for (const h of v.houses) {
      if (h.ruined >= 0 || h.burning >= 0 || h.frozen >= 0 || Math.abs(h.x - fx) > 30 || Math.abs(h.z - d.z) > 0.12) continue;
      if (h.ward > world.t) {
        world.fx.push({ kind: 'flash', x: h.x, z: h.z, h: 20, t0: world.t, dur: 0.4, r: 30, seed: h.id });
        if (r() < 0.2 && once(`warded-${Math.floor(world.t / 10)}`)) {
          say('THE WARD HOLDS', h.x, h.z, '#fde68a', 'medium', 60);
          emit('wardholds', h.x, h.z, 0.5);
        }
        continue;
      }
      if (r() > 0.6 * d.size) continue;
      if (d.breed === 'frost') h.frozen = world.t;
      else if (d.breed === 'venom') {
        if (r() < 0.4) h.burning = world.t;
      } else h.burning = world.t;
      if (once(`breath-${v.id}-${world.raids}`)) {
        say(`${v.name} ${firstWord[d.breed]}`, v.x, v.z, '#fca5a5', 'high', 110);
        emit(event[d.breed], v.x, v.z, 0.85);
      }
    }
    // The fields: venom withers them, fire burns them.
    for (const f of world.fields) {
      if (Math.abs(f.x - fx) > f.w / 2 + 20 || Math.abs(f.z - d.z) > 0.1) continue;
      if (d.breed === 'venom') f.withered = world.t;
      else if (d.breed === 'fire' || d.breed === 'shadow') f.burnt = world.t;
    }
    for (const p of world.people) {
      if (!p.alive || Math.abs(p.x - fx) > 24 || Math.abs(p.z - d.z) > 0.09) continue;
      if (world.villages.some((v) => v.houses.some((h) => h.ward > world.t && Math.abs(h.x - p.x) < 40 && Math.abs(h.z - p.z) < 0.1))) continue;
      if (r() < 0.45) die(p, d.breed === 'frost' ? 'frost' : 'fire');
    }
    // Ballistae in the breath burn.
    for (const b of world.ballistae) if (!b.ruined && Math.abs(b.x - fx) < 30 && Math.abs(b.z - d.z) < 0.12 && r() < 0.4) {
      b.burning = world.t;
      b.ruined = true;
    }
  }

  function die(p: Person, how: 'fire' | 'frost' | 'crush') {
    p.alive = false;
    p.deadAt = world.t;
    p.frozen = how === 'frost';
  }

  function duel(d: Wyrm, dt: number) {
    const foe = world.wyrms.find((o) => o !== d && o.state === 'duel');
    if (!foe) {
      d.state = d.rival ? 'away' : 'home';
      d.vx = d.rival ? 160 : d.vx;
      return;
    }
    const cxm = (d.x + foe.x) / 2;
    const age = world.t - d.t0;
    const a = age * 1.4 + (d.rival ? Math.PI : 0);
    d.x += (cxm + Math.cos(a) * 110 - d.x) * dt * 2;
    d.h += (200 + Math.sin(a * 1.3) * 60 - d.h) * dt * 2;
    d.vx = -Math.sin(a) * 140;
    look('duel', cxm, 0.3, d.h, 1.15, 3);
    if (Math.floor(age * 2) % 3 === 0 && Math.abs(d.x - foe.x) < 160) {
      d.breathing = true;
      if (r() < dt * 1.4) foe.hp -= 1 + r();
    }
    if (d.hp <= 0) {
      if (r() < 0.35) {
        d.state = 'fall';
        d.t0 = world.t;
        say(`${d.name} FALLS FROM THE SKY`, d.x, d.z, '#fde68a', 'high', d.h + 40);
        emit('dragonslain', d.x, d.z, 1);
        chronicle(`${T(d.name)} fell in the air fight over ${T(world.name)}.`);
      } else {
        d.state = d.rival ? 'away' : 'home';
        d.vx = d.rival ? 170 : d.vx;
        d.hp = Math.max(d.hp, 2);
        say(`${d.name} BREAKS OFF AND FLEES`, d.x, d.z, '#fdba74', 'medium', d.h + 40);
        emit('driven', d.x, d.z, 0.5);
      }
      if (foe.rival && !d.rival && d.state === 'fall') {
        // The newcomer won: the spire is its now.
        foe.rival = false;
        foe.state = 'home';
        foe.wrath = 0.6;
        say(`${foe.name} TAKES THE SPIRE`, foe.x, foe.z, '#fb923c', 'high', foe.h + 40);
        emit('newwyrm', world.spire.x, 0, 0.6);
        chronicle(`${T(foe.name)} took the spire above ${T(world.name)} for its own.`);
        world.policy = 'endure';
        for (const v of world.villages) v.raided = 0;
      } else {
        foe.state = foe.rival ? 'away' : 'home';
        if (foe.rival) foe.vx = 170;
      }
    }
  }

  // ---- the defenders ---------------------------------------------------------------------------

  function defenders(dt: number) {
    const target = world.wyrms.find((d) => ['dive', 'climb', 'fly'].includes(d.state) && !d.rival && d.target);
    for (const p of world.people) {
      if (!p.alive || !['knight', 'mage', 'archer'].includes(p.kind)) continue;
      if (world.quest?.who.includes(p)) continue;
      walk(p, p.kind === 'knight' ? 64 : 26, dt);
      p.cd -= dt;
      if (!target) continue;
      const dx = Math.abs(target.x - p.x);
      if (p.kind === 'archer' && p.cd <= 0 && target.h < 220 && dx < 360) {
        p.cd = 2.2 + r() * 1.5;
        p.swingUntil = world.t + 0.5;
        const lead = 1 + dx / 500;
        world.shots.push({ kind: 'arrow', x0: p.x, z0: p.z, h0: 14, x1: target.x + target.vx * lead, z1: target.z, h1: target.h, t0: world.t, dur: lead, hit: r() < 0.36, done: false });
      }
      if (p.kind === 'mage' && p.cd <= 0) {
        p.cd = 5 + r() * 4;
        p.swingUntil = world.t + 0.8;
        const v = target.target!;
        const hs = v.houses.filter((h) => h.ruined < 0 && h.ward < world.t).sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x));
        if (target.h > 80 && hs.length) {
          for (const h of hs.slice(0, 2)) h.ward = world.t + 10;
          world.fx.push({ kind: 'ward', x: hs[0].x, z: hs[0].z, h: 0, t0: world.t, dur: 10, r: 46, seed: hs[0].id });
          if (once(`ward-${world.raids}-${v.id}`)) {
            say('A WARD OVER THE ROOFS', hs[0].x, hs[0].z, '#fde68a', 'low', 70);
            emit('ward', hs[0].x, hs[0].z, 0.45);
          }
        } else if (target.h < 120 && dx < 300) {
          world.shots.push({ kind: 'bolt', x0: p.x, z0: p.z, h0: 30, x1: target.x, z1: target.z, h1: target.h, t0: world.t, dur: 0.3, hit: r() < 0.6, done: false });
          emit('lightning', target.x, target.z, 0.5);
        }
      }
      if (p.kind === 'knight' && target.h < 50 && dx < 50 && Math.abs(target.z - p.z) < 0.12 && p.cd <= 0) {
        p.cd = 2.5;
        p.swingUntil = world.t + 0.4;
        if (r() < 0.35) hurt(target, 3, 'lance');
      }
      if (p.kind === 'knight') {
        p.tx = target.x - Math.sign(target.vx) * 40;
        p.tz = target.z + ((p.id % 5) - 2) * 0.03;
      }
    }
    // The ballistae throw their bolts at a wyrm in range.
    for (const b of world.ballistae) {
      if (b.ruined || !target) continue;
      b.cd -= dt;
      if (b.cd > 0 || Math.abs(target.x - b.x) > 420 || target.h > 260) continue;
      b.cd = 5 + r() * 2;
      const lead = 0.6 + Math.abs(target.x - b.x) / 900;
      world.shots.push({ kind: 'ballista', x0: b.x, z0: b.z, h0: 34, x1: target.x + target.vx * lead, z1: target.z, h1: target.h, t0: world.t, dur: lead, hit: r() < 0.4, done: false });
      if (once(`ballista-${world.raids}`)) {
        say('THE BALLISTAE LOOSE', b.x, b.z, world.faction.color, 'medium', 90);
        emit('ballistafire', b.x, b.z, 0.5);
      }
    }
    for (const s of world.shots) {
      if (s.done || world.t < s.t0 + s.dur) continue;
      s.done = true;
      if (!s.hit || !target) continue;
      hurt(target, s.kind === 'ballista' ? 3 : s.kind === 'bolt' ? 2.5 : 0.8, s.kind);
    }
    for (let i = world.shots.length - 1; i >= 0; i--) if (world.shots[i].done && world.t > world.shots[i].t0 + world.shots[i].dur + 0.5) world.shots.splice(i, 1);
  }

  function hurt(d: Wyrm, dmg: number, by: string) {
    if (d.state === 'fall' || d.state === 'dead') return;
    d.hp -= dmg;
    d.wrath += dmg * 0.02;
    if (d.hp > 0) return;
    slay(d, by === 'lance' ? 'the lances' : by === 'bolt' ? 'the mages' : by === 'ballista' ? 'a ballista bolt' : 'the bows');
  }

  function slay(d: Wyrm, by: string) {
    d.state = 'fall';
    d.t0 = world.t;
    if (d.h <= 0) d.h = world.spire.caveH;
    say(`${d.name} IS SLAIN`, d.x, d.z, '#fde68a', 'high', d.h + 50);
    emit('dragonslain', d.x, d.z, 1);
    chronicle(`${T(by)} brought down ${T(d.name)}. The hoard of ${Math.round(world.hoard)} crowns went to ${T(world.lord.name)}.`);
    world.hoard = 0;
    look('slain', d.x, d.z, d.h, 1.3, 8);
  }

  function recall() {
    for (const p of world.people) {
      if (!p.alive) continue;
      if (['knight', 'mage', 'archer'].includes(p.kind)) {
        p.tx = world.castle.x + (r() - 0.5) * 20;
        p.tz = world.castle.z;
      } else if (p.home) {
        p.tx = p.home.x + (r() - 0.5) * 60;
        p.tz = p.home.z;
      }
    }
  }

  // ---- the frame ---------------------------------------------------------------------------------

  let nextThink = 25 + r() * 20;
  let nextRival = 500 + r() * 500;
  let nextThieves = 100 + r() * 260;
  let nextHero = 220 + r() * 300;
  // The opening shot holds a while on the valley and its spire.
  let calm = -14;
  function step(dt: number) {
    world.t += dt;
    if (opts.time === 'cycle') world.day = (world.day + dt / DAY) % 1;
    seasons();
    for (let i = later.length - 1; i >= 0; i--) if (world.t >= later[i].at) {
      later[i].fn();
      later.splice(i, 1);
    }
    const d = resident();
    // Thieves are no one's policy: some nights, with gold in the cave, they come.
    if (d && world.t >= nextThieves && night() && !world.quest && world.hoard > 250 && world.bound < world.t) {
      nextThieves = world.t + 420 + r() * 480;
      startQuest('thieves');
    }
    // Nor are wandering heroes and wizards, who come for the glory, or the gold.
    if (d && world.t >= nextHero && !night() && !world.quest && world.bound < world.t && d.state === 'sleep') {
      nextHero = world.t + 360 + r() * 420;
      startQuest(r() < 0.6 ? 'hero' : 'binding');
    }
    if (d && d.state === 'sleep' && world.t >= nextThink) {
      nextThink = world.t + 6 + r() * 6;
      if (world.t >= nextRival && r() < 0.3) {
        nextRival = world.t + 600 + r() * 600;
        const rival = newWyrm(true);
        say(`${rival.name}, ${BREED_NAMES[rival.breed]}, COMES OVER THE MOUNTAINS`, world.BW - 60, 0.1, '#fb923c', 'high', 240);
        emit('rival', world.BW - 60, 0.1, 0.7);
      } else decide(d);
    }
    life(dt);
    wyrms(dt);
    defenders(dt);
    quest(dt);
    // A quiet valley still has something to look at: the camera wanders along it.
    calm += dt;
    if (world.t > world.focus.until && calm > 9) {
      calm = 0;
      const pick = r();
      if (pick < 0.35 && world.herds.length) {
        const h = world.herds[Math.floor(r() * world.herds.length)];
        look('life', h.x, h.z, 0, 1.25, 9);
      } else if (pick < 0.7) {
        const v = world.villages[Math.floor(r() * world.villages.length)];
        look('life', v.x, v.z, 10, 1.2, 9);
      } else look('valley', world.BW * (0.55 + r() * 0.12), 0.4, 30, 1, 12);
    }
    // Burning houses burn out; frozen ones thaw, cracked; ruins are rebuilt.
    for (const v of world.villages) {
      for (const h of v.houses) {
        if (h.burning >= 0 && world.t - h.burning > 14) {
          h.burning = -1;
          h.ruined = world.t;
          world.fx.push({ kind: 'smoke', x: h.x, z: h.z, h: 0, t0: world.t, dur: 16, r: 22, seed: h.id });
        }
        if (h.frozen >= 0 && world.t - h.frozen > 40) {
          h.frozen = -1;
          if (r() < 0.4) h.ruined = world.t;
        }
        if (h.ruined >= 0 && world.t - h.ruined > 70 + (h.id % 7) * 4) {
          h.ruined = -1;
          if (once(`rebuild-${v.id}-${Math.floor(world.t / 60)}`)) {
            say(`${v.name} IS REBUILT`, v.x, v.z, '#bbf7d0', 'low', 80);
            emit('rebuild', v.x, v.z, 0.3);
          }
        }
      }
    }
    for (let i = world.people.length - 1; i >= 0; i--) {
      const p = world.people[i];
      if (!p.alive && world.t - p.deadAt > 30) {
        world.people.splice(i, 1);
        if (p.kind === 'villager' && p.home) person('villager', p.home.x, p.home.z, p.home);
        continue;
      }
      if (p.alive && ['knight', 'mage', 'archer', 'hero', 'wizard'].includes(p.kind) && !world.quest?.who.includes(p) && !world.wyrms.some((w) => ['fly', 'dive', 'climb'].includes(w.state)) && Math.abs(p.x - world.castle.x) < 8 && Math.abs(p.z - world.castle.z) < 0.03) world.people.splice(i, 1);
      if (p.alive && p.kind === 'thief' && !world.quest?.who.includes(p) && Math.abs(p.x - world.castle.x) < 8) world.people.splice(i, 1);
    }
    for (let i = world.fx.length - 1; i >= 0; i--) if (world.t - world.fx[i].t0 > world.fx[i].dur) world.fx.splice(i, 1);
    for (let i = world.labels.length - 1; i >= 0; i--) if (world.t - world.labels[i].t0 > world.labels[i].dur) world.labels.splice(i, 1);
    for (let i = world.wyrms.length - 1; i >= 0; i--) if (world.wyrms[i].state === 'dead' && world.t - world.wyrms[i].t0 > 120) world.wyrms.splice(i, 1);
  }

  weatherRoll();
  const first = newWyrm();
  chronicle(`${T(first.name)}, ${T(BREED_NAMES[first.breed].toLowerCase())}, sleeps in the spire above ${T(LAND_NAMES[biome].toLowerCase())} ${T(world.name)}.`);
  return world;
}
