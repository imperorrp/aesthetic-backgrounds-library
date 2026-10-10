/**
 * Ages: a thousand years of a continent, seen from above. No DOM here.
 *
 * The land is a hex grid (sim/cells.ts) with elevation, moisture, rivers, and fertility.
 * Kingdoms start as a hearth each. Settlements grow (hamlet → village → town → city →
 * capital) with the food of the land around them, send settlers out to found new ones,
 * and roads follow. Territory is each settlement's reach. Neighbors grow tense along
 * their borders; wars bring armies marching to battles and sieges, and towns change
 * hands. Eras turn every two centuries or so: walls, ships on the sea, wonders.
 * Plagues travel the roads. Hordes come from the edge of the map and sometimes settle.
 * Big kingdoms split in civil war; small ones fall. A dragon may come down from the
 * mountains. When the last era ends, the age ends, and a new land rises.
 *
 * Each kingdom has a ruling house and a ruler; reigns end, heirs take the crown, and now
 * and then a house dies out (sometimes into a war of succession). Caravans walk the roads
 * between friendly towns and ships sail between ports; trade feeds growth, and the busy
 * roads wear wider. Wonders take decades to raise. The land changes under the people:
 * woods near towns are cleared for fields, volcanoes wake, rivers flood. What happens is
 * kept as history, year by year, for the ribbon along the bottom of the map.
 *
 * The hex grid is the sim's alone: the painter draws the land, borders, roads, and rivers
 * as smooth shapes over it.
 *
 * Time: `year` advances `speed` years per second.
 */
import { forkRng, type Rng } from '../../rng';
import { createBus, type Bus } from '../../sim/bus';
import { createHexGrid, type Cell, type HexGrid } from '../../sim/cells';
import type { Noise2D } from '../../noise';
import { makeFaction, placeName, titled, type Faction, type People } from './names';

export type Terrain = 'deep' | 'sea' | 'coast' | 'plain' | 'forest' | 'hill' | 'mountain';

export type Tile = Cell & {
  terrain: Terrain;
  elev: number;
  moist: number;
  /** Food the land gives, 0..1. */
  fert: number;
  river: boolean;
  road: boolean;
  town: Town | null;
  /** Ownership by reach (recomputed every few years). */
  kingdom: Kingdom | null;
  /** Caravans that have passed (roads wear wider with use). */
  traffic: number;
  /** A wood cleared for fields. */
  cleared: boolean;
  /** A volcano that has woken: the year it erupted. */
  erupted: number;
  /** A river's next tile downstream, and how many streams have joined it here. */
  down: Tile | null;
  flow: number;
};

export type Ruler = { name: string; title: string; n: number; since: number };

export type Kingdom = {
  id: number;
  name: string;
  short: string;
  color: string;
  dark: string;
  faction: Faction;
  towns: Town[];
  capital: Town | null;
  wealth: number;
  founded: number;
  fallen: boolean;
  /** Hordes have no towns until they take one. */
  horde: boolean;
  /** Ids of kingdoms it is at war with, and since when. */
  wars: Map<number, number>;
  tension: Map<number, number>;
  unrest: number;
  /** The ruling house, the one on the throne, and when the reign ends. */
  house: string;
  ruler: Ruler;
  reignEnds: number;
  /** How many rulers have had each name (for regnal numbers). */
  names: Map<string, number>;
};

export type Tier = 0 | 1 | 2 | 3 | 4;
export const TIERS = ['HAMLET', 'VILLAGE', 'TOWN', 'CITY', 'CAPITAL'] as const;

export type Town = {
  id: number;
  name: string;
  tile: Tile;
  owner: Kingdom;
  pop: number;
  tier: Tier;
  founded: number;
  walls: boolean;
  wonder: string | null;
  /** The year it will stand (negative once it does), when work began, and which design. */
  wonderAt: number;
  wonderStart: number;
  wonderKind: number;
  /** Trade lately (caravans and ships in): it feeds growth. */
  trade: number;
  plague: number;
  burning: number;
  ruined: boolean;
  besieged: boolean;
  /** Houses: offsets from the tile center, fixed at founding (tier decides how many show). */
  houses: [number, number][];
  seed: number;
};

export type Walker = {
  id: number;
  kind: 'settlers' | 'army' | 'ship' | 'caravan';
  owner: Kingdom;
  path: Tile[];
  /** Position along the path, in tiles. */
  at: number;
  x: number;
  y: number;
  /** Armies: how many men. */
  size: number;
  target: Town | null;
  state: 'march' | 'siege' | 'battle' | 'home' | 'sail';
  since: number;
  enemy: Walker | null;
};

export type Mark = {
  kind: 'battle' | 'fire' | 'plague' | 'found' | 'razed' | 'wonder' | 'dragonfire' | 'schism' | 'volcano' | 'flood';
  x: number;
  y: number;
  t0: number;
  dur: number;
  color: string;
  seed: number;
  /** A flood's reach: the river tiles under water. */
  pts?: [number, number][];
};
export type Label = { text: string; x: number; y: number; color: string; t0: number; dur: number };
/** A line of history, for the ribbon: when, what kind, whose color. */
export type Moment = { year: number; kind: string; color: string; text: string };

export type AgesOptions = { speed: number; kingdoms: number; wars: number; disasters: number; dragons: number };

export const ERAS = ['THE HEARTH YEARS', 'THE BRONZE DAWN', 'THE IRON CENTURIES', 'THE HIGH CROWNS', 'THE YEARS OF SAIL AND POWDER', 'THE LAMP AGE'];
export const ERA_YEARS = 210;
/** The years an age runs before it ends (if nothing ends it sooner). */
export const AGE_YEARS = ERAS.length * ERA_YEARS + 60;
/** Wonders, each with its own shape (the painter draws them by index). */
export const WONDERS = ['THE GREAT LIGHTHOUSE', 'THE SKY CATHEDRAL', 'THE HANGING GARDENS', 'THE COLOSSUS', 'THE LIBRARY OF ALL THINGS', 'THE STAIR OF KINGS', 'THE WHITE OBSERVATORY'];

const HOUSES = ['VALLOR', 'DARROW', 'ASHFORD', 'MERRIN', 'KESTREL', 'THORNE', 'ALDER', 'HALE', 'CRANE', 'VANE', 'MORROW', 'STRAND', 'IVERS', 'GALE', 'RAVENSCAR', 'ORME'];
/** Names, and whether they take the crown as a king (0) or a queen (1). */
const NAMES: [string, 0 | 1][] = [
  ['ALDRIC', 0], ['MAEVE', 1], ['OSWIN', 0], ['BRANNA', 1], ['EDRIC', 0], ['ISOLDE', 1], ['CORWIN', 0], ['ELSPETH', 1], ['HAKON', 0], ['SIGRID', 1],
  ['ROWAN', 0], ['TAMSIN', 1], ['ULRIC', 0], ['YSOLDE', 1], ['BERIC', 0], ['GWEN', 1], ['LEOFRIC', 0], ['AVERIL', 1], ['TOMAS', 0], ['ELLA', 1],
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const regnal = (r: Ruler) => `${r.title} ${r.name}${r.n > 1 ? ` ${ROMAN[Math.min(12, r.n)]}` : ''}`;

export type AgesWorld = {
  t: number;
  year: number;
  era: number;
  W: number;
  H: number;
  /** The land's generation (a new land after each age ends). */
  gen: number;
  bus: Bus;
  grid: HexGrid;
  tiles: Tile[];
  kingdoms: Kingdom[];
  towns: Town[];
  walkers: Walker[];
  marks: Mark[];
  labels: Label[];
  dragon: { x: number; y: number; tx: number; ty: number; state: 'come' | 'burn' | 'go'; t0: number; target: Town | null; flip: boolean } | null;
  chronicle: { t: number; text: string }[];
  /** Bumped when borders or roads change (the painter re-renders its cache). */
  version: number;
  /** Bumped when the land itself changes (a new age). */
  landVersion: number;
  /** Bumped when woods are cleared or a volcano wakes (the painter redraws its woods and peaks). */
  landEdits: number;
  /** This age's history, oldest first. */
  history: Moment[];
  ending: number;
  unified: Kingdom | null;
  /** The land's elevation and moisture at any point (the tiles sample it at their centers). */
  elevAt(x: number, y: number): { elev: number; moist: number };
  /** The size the land was made for (the view scales it to the screen after a resize). */
  readonly landW: number;
  readonly landH: number;
  step(dt: number): void;
  resize(W: number, H: number): void;
  counts(): Record<string, number>;
};

const PEOPLES: People[] = ['kingdom', 'kingdom', 'kingdom', 'fey', 'horde', 'hollow'];
const KINGDOM_TITLES = ['THE KINGDOM OF', 'THE MARCH OF', 'THE DUCHY OF', 'THE REALM OF', 'THE FREE CITIES OF', 'THE CROWN OF'];

export function createAgesWorld(seed: string | number, W: number, H: number, noise: Noise2D, opts: AgesOptions): AgesWorld {
  const bus = createBus(() => world.t);
  let ids = 1;
  let r: Rng = forkRng(seed, 'ages-0');
  // The land's noise offset and the size it was made for (set by makeLand).
  let off = 0;
  let landW = W;
  let landH = H;

  const world: AgesWorld = {
    t: 0,
    year: 0,
    era: 0,
    W,
    H,
    gen: 0,
    bus,
    grid: null as unknown as HexGrid,
    tiles: [],
    kingdoms: [],
    towns: [],
    walkers: [],
    marks: [],
    labels: [],
    dragon: null,
    chronicle: [],
    version: 0,
    landVersion: 0,
    landEdits: 0,
    history: [],
    ending: -1,
    unified: null,
    elevAt: (x, y) => land(x, y),
    get landW() {
      return landW;
    },
    get landH() {
      return landH;
    },
    step,
    resize(w, h) {
      // The land keeps its shape; only the view changes size. A new age fits the new size.
      world.W = w;
      world.H = h;
    },
    counts() {
      return { year: Math.floor(world.year), era: world.era, kingdoms: world.kingdoms.filter((k) => !k.fallen && !k.horde).length, towns: world.towns.filter((t) => !t.ruined).length, armies: world.walkers.filter((w) => w.kind === 'army').length, ships: world.walkers.filter((w) => w.kind === 'ship').length, caravans: world.walkers.filter((w) => w.kind === 'caravan').length };
    },
  };

  // ---- telling -----------------------------------------------------------------------------

  const say = (text: string, x: number, y: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 4)) return;
    world.labels.push({ text, x, y, color, t0: world.t, dur: 5 });
    if (world.labels.length > 8) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, color, priority });
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text: `${Math.floor(world.year)}. ${text}` });
    if (world.chronicle.length > 6) world.chronicle.shift();
  };
  const emit = (type: string, x: number, y: number, weight: number, extra: Record<string, unknown> = {}) => bus.emit({ type, x, y, weight, ...extra });
  const mark = (kind: Mark['kind'], x: number, y: number, dur: number, color: string) => {
    const m: Mark = { kind, x, y, t0: world.t, dur, color, seed: Math.floor(r() * 1e6) };
    world.marks.push(m);
    return m;
  };
  const T = (s: string) => titled(s);
  /** Keep it in the age's history (the ribbon). */
  const remember = (kind: string, color: string, text: string) => {
    world.history.push({ year: world.year, kind, color, text });
    if (world.history.length > 400) world.history.shift();
  };

  // ---- the land ------------------------------------------------------------------------------

  /** An island continent: noise, pulled down toward the edges. */
  function land(x: number, y: number) {
    const dx = (x - landW / 2) / (landW * 0.55);
    const dy = (y - landH / 2) / (landH * 0.55);
    const edge = Math.min(1, Math.hypot(dx, dy * 1.1));
    const e = noise.noise2(x * 0.0035 + off, y * 0.0035) * 0.6 + noise.noise2(x * 0.011 + off, y * 0.011 + 7) * 0.3 + noise.noise2(x * 0.03, y * 0.03 + off) * 0.1;
    return { elev: e * 0.9 + 0.35 - edge * edge * 1.15, moist: noise.noise2(x * 0.006 + 50 + off, y * 0.006 - 20) * 0.5 + 0.5 };
  }

  function makeLand() {
    const size = Math.max(15, Math.min(26, Math.round(Math.min(world.W, world.H) / 30)));
    off = r() * 1000;
    landW = world.W;
    landH = world.H;
    const grid = createHexGrid(size, (_q, _r, x, y) => {
      const { elev, moist } = land(x, y);
      const terrain: Terrain = elev < -0.18 ? 'deep' : elev < 0 ? 'sea' : elev < 0.05 ? 'coast' : elev > 0.55 ? 'mountain' : elev > 0.36 ? 'hill' : moist > 0.58 ? 'forest' : 'plain';
      const fert = terrain === 'plain' ? 0.8 + moist * 0.2 : terrain === 'coast' ? 0.6 : terrain === 'forest' ? 0.45 : terrain === 'hill' ? 0.35 : 0;
      return { terrain, elev, moist, fert, river: false, road: false, town: null, kingdom: null, traffic: 0, cleared: false, erupted: -1, down: null, flow: 0 } as Partial<Cell>;
    });
    const tiles: Tile[] = [];
    grid.forEachIn({ left: -size, right: world.W + size, top: -size, bottom: world.H + size }, (c) => tiles.push(c as Tile));
    // Rivers: from high ground, downhill to the sea.
    const highs = tiles.filter((t) => t.terrain === 'mountain' || (t.terrain === 'hill' && t.moist > 0.55));
    for (let i = 0; i < Math.min(9, highs.length); i++) {
      let cur: Tile | undefined = highs[Math.floor(r() * highs.length)];
      for (let n = 0; cur && n < 60; n++) {
        if (cur.terrain === 'sea' || cur.terrain === 'deep') break;
        const joined = cur.river;
        cur.river = true;
        cur.flow++;
        if (cur.terrain === 'plain' || cur.terrain === 'forest' || cur.terrain === 'coast') cur.fert = Math.min(1, cur.fert + 0.25);
        const next: Tile = (grid.neighbors(cur) as Tile[]).reduce((a, b) => (b.elev < a.elev ? b : a));
        if (next.elev >= cur.elev) {
          // A lake: let it spill through the lowest edge anyway, but not forever.
          cur.elev -= 0.02;
          break;
        }
        cur.down = next;
        // Joined an existing river: the rest of the way is already carved, but carries more.
        if (joined) {
          for (let d: Tile | null = next, k = 0; d && k < 60; d = d.down, k++) d.flow++;
          break;
        }
        cur = next;
      }
    }
    world.grid = grid;
    world.tiles = tiles;
    world.landVersion++;
  }

  const onLand = (t: Tile) => t.terrain !== 'sea' && t.terrain !== 'deep';
  const inView = (t: Tile) => t.x > 10 && t.x < world.W - 10 && t.y > 10 && t.y < world.H - 10;
  const hexDist = (a: Tile, b: Tile) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

  /** A path over land (or sea, for ships), cheapest by terrain; null when there is none. */
  function path(a: Tile, b: Tile, sea = false): Tile[] | null {
    const cost = (t: Tile) => (sea ? (t.terrain === 'sea' || t.terrain === 'deep' || t === b ? 1 : Infinity) : !onLand(t) ? Infinity : t.road ? 0.4 : t.terrain === 'mountain' ? 6 : t.terrain === 'hill' ? 2 : t.terrain === 'forest' ? 1.6 : 1);
    const key = (t: Tile) => `${t.q},${t.r}`;
    const dist = new Map<string, number>([[key(a), 0]]);
    const prev = new Map<string, Tile>();
    const open: Tile[] = [a];
    let guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if ((dist.get(key(open[i])) ?? 0) + hexDist(open[i], b) < (dist.get(key(open[bi])) ?? 0) + hexDist(open[bi], b)) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === b) break;
      for (const n of world.grid.neighbors(cur) as Tile[]) {
        if (!inView(n) && n !== b) continue;
        const c = cost(n);
        if (!Number.isFinite(c)) continue;
        const d = (dist.get(key(cur)) ?? 0) + c;
        if (d < (dist.get(key(n)) ?? Infinity)) {
          dist.set(key(n), d);
          prev.set(key(n), cur);
          if (!open.includes(n)) open.push(n);
        }
      }
    }
    if (!prev.has(key(b)) && a !== b) return null;
    const out: Tile[] = [b];
    let cur = b;
    while (cur !== a) {
      cur = prev.get(key(cur))!;
      out.push(cur);
    }
    return out.reverse();
  }

  // ---- kingdoms and towns -------------------------------------------------------------------

  function newKingdom(at: Tile, people: People, horde = false): Kingdom {
    const used = new Set(world.kingdoms.filter((k) => !k.fallen).map((k) => k.color));
    let f = makeFaction(people, r);
    for (let i = 0; i < 6 && used.has(f.color); i++) f = makeFaction(PEOPLES[Math.floor(r() * PEOPLES.length)], r);
    const place = placeName(r);
    const name = horde ? f.name : `${KINGDOM_TITLES[Math.floor(r() * KINGDOM_TITLES.length)]} ${place}`;
    const k: Kingdom = {
      id: ids++, name, short: horde ? f.name.replace(/^THE /, '') : place, color: f.color, dark: f.dark, faction: f, towns: [], capital: null, wealth: 0, founded: world.year, fallen: false, horde, wars: new Map(), tension: new Map(), unrest: 0,
      house: HOUSES[Math.floor(r() * HOUSES.length)], ruler: { name: '', title: '', n: 1, since: world.year }, reignEnds: 0, names: new Map(),
    };
    crown(k);
    world.kingdoms.push(k);
    void at;
    return k;
  }

  /** A new ruler for a kingdom, of its house: a name, a title, a regnal number, a reign's length. */
  function crown(k: Kingdom) {
    const [name, queen] = NAMES[Math.floor(r() * NAMES.length)];
    const p = k.faction.people;
    const title = p === 'horde' ? 'KHAN' : p === 'hollow' ? (queen ? 'THE PALE QUEEN' : 'THE PALE KING') : p === 'fey' ? (queen ? 'THE LADY' : 'THE LORD') : queen ? 'QUEEN' : 'KING';
    const n = (k.names.get(name) ?? 0) + 1;
    k.names.set(name, n);
    k.ruler = { name, title, n, since: world.year };
    k.reignEnds = world.year + 14 + r() * 42;
  }

  /** Reigns end: an heir takes the crown, or the house dies out (sometimes into a war). */
  function successions() {
    const live = world.kingdoms.filter((k) => !k.fallen && !k.horde && k.towns.length);
    const top = [...live].sort((a, b) => b.towns.length - a.towns.length)[0];
    for (const k of live) {
      if (world.year < k.reignEnds) continue;
      const was = regnal(k.ruler);
      const c = k.capital?.tile;
      if (r() < 0.06) {
        // The line ends. A new house takes the throne; a big realm may split over it.
        const old = k.house;
        let house = HOUSES[Math.floor(r() * HOUSES.length)];
        if (house === old) house = HOUSES[(HOUSES.indexOf(house) + 5) % HOUSES.length];
        k.house = house;
        k.names = new Map();
        crown(k);
        say(`THE HOUSE OF ${old} ENDS`, c?.x ?? world.W / 2, (c?.y ?? world.H / 2) - 30, k.color, 'medium');
        emit('dynastyends', c?.x ?? world.W / 2, c?.y ?? world.H / 2, 0.55, { color: k.color });
        chronicle(`${T(was)} died without an heir. The house of ${T(old)} ended; ${T(regnal(k.ruler))} of the house of ${T(house)} took the crown of ${T(k.short)}.`);
        remember('dynastyends', k.color, `The house of ${T(old)} ends`);
        if (k.towns.length >= 6 && r() < 0.45) schism(k, `A WAR OF SUCCESSION IN ${k.short}`);
        continue;
      }
      crown(k);
      // Only the great realms' successions make the chronicle; every crown passing would drown it.
      if (k === top) {
        chronicle(`${T(was)} of ${T(k.short)} died. ${T(regnal(k.ruler))} took the crown.`);
        emit('succession', c?.x ?? world.W / 2, c?.y ?? world.H / 2, 0.2, { color: k.color });
      }
    }
  }

  function found(k: Kingdom, tile: Tile, name = placeName(r)): Town {
    const town: Town = {
      id: ids++, name, tile, owner: k, pop: 12, tier: 0, founded: world.year, walls: false, wonder: null, wonderAt: 0, wonderStart: 0, wonderKind: 0, trade: 0, plague: 0, burning: 0, ruined: false, besieged: false,
      houses: Array.from({ length: 14 }, (_, i) => {
        const a = r() * Math.PI * 2;
        const d = i === 0 ? 0 : (0.25 + 0.75 * Math.sqrt(r())) * world.grid.size * (i < 4 ? 0.7 : i < 8 ? 1.1 : 1.5);
        return [Math.cos(a) * d, Math.sin(a) * d * 0.75] as [number, number];
      }),
      seed: Math.floor(r() * 1e6),
    };
    tile.town = town;
    k.towns.push(town);
    world.towns.push(town);
    if (!k.capital) k.capital = town;
    return town;
  }

  /** Is this a good place for a new town: fertile, on land, not too close to another. */
  const siteScore = (t: Tile) => {
    if (!onLand(t) || t.terrain === 'mountain' || !inView(t) || t.town) return -1;
    for (const o of world.towns) if (!o.ruined && hexDist(o.tile, t) < 3) return -1;
    let food = t.fert * 2;
    for (const n of world.grid.neighbors(t) as Tile[]) food += n.fert + (n.terrain === 'sea' || n.terrain === 'coast' ? 0.3 : 0);
    return food + (t.river ? 1 : 0);
  };

  function settleKingdoms(n: number) {
    const sites = world.tiles.filter((t) => siteScore(t) > 4).sort((a, b) => siteScore(b) - siteScore(a));
    for (let i = 0; i < n; i++) {
      // Spread out: the best site far enough from the others.
      const pick = sites.find((s) => world.towns.every((t) => hexDist(t.tile, s) > 7) && siteScore(s) > 0);
      if (!pick) break;
      const k = newKingdom(pick, PEOPLES[Math.floor(r() * PEOPLES.length)]);
      const town = found(k, pick);
      town.pop = 30 + r() * 20;
      emit('founded', pick.x, pick.y, 0.3, { color: k.color });
    }
  }

  // ---- territory and roads ------------------------------------------------------------------

  let nextTerritory = 0;
  function territory() {
    for (const t of world.tiles) t.kingdom = null;
    const reach = [1.5, 2.2, 3, 3.8, 4.6];
    for (const t of world.tiles) {
      if (!onLand(t)) continue;
      let best: Kingdom | null = null;
      let bv = 0;
      for (const town of world.towns) {
        if (town.ruined) continue;
        const d = hexDist(town.tile, t);
        const R = reach[town.tier];
        if (d > R) continue;
        const v = Math.sqrt(town.pop) / (1 + d);
        if (v > bv) {
          bv = v;
          best = town.owner;
        }
      }
      t.kingdom = best;
    }
    world.version++;
  }

  function buildRoad(a: Town, b: Town) {
    const p = path(a.tile, b.tile);
    if (!p || p.length > 18) return;
    for (const t of p) t.road = true;
    world.version++;
  }

  // ---- walkers: settlers, armies, ships -----------------------------------------------------

  const walkerPos = (w: Walker) => {
    const i = Math.min(w.path.length - 1, Math.floor(w.at));
    const j = Math.min(w.path.length - 1, i + 1);
    const k = w.at - i;
    w.x = w.path[i].x + (w.path[j].x - w.path[i].x) * k;
    w.y = w.path[i].y + (w.path[j].y - w.path[i].y) * k;
  };

  function sendSettlers(k: Kingdom, from: Town) {
    let best: Tile | null = null;
    let bv = 4;
    for (const t of world.tiles) {
      if (hexDist(t, from.tile) > 7 || hexDist(t, from.tile) < 3) continue;
      if (t.kingdom && t.kingdom !== k) continue;
      const v = siteScore(t) - hexDist(t, from.tile) * 0.15;
      if (v > bv) {
        bv = v;
        best = t;
      }
    }
    if (!best) return;
    const p = path(from.tile, best);
    if (!p) return;
    world.walkers.push({ id: ids++, kind: 'settlers', owner: k, path: p, at: 0, x: from.tile.x, y: from.tile.y, size: 3, target: null, state: 'march', since: world.year, enemy: null });
  }

  function raiseArmy(k: Kingdom, foe: Kingdom) {
    // From the town nearest the enemy, to the enemy town nearest it.
    let pair: [Town, Town] | null = null;
    let bd = Infinity;
    for (const a of k.towns) {
      if (a.ruined) continue;
      for (const b of foe.towns) {
        if (b.ruined) continue;
        const d = hexDist(a.tile, b.tile);
        if (d < bd) {
          bd = d;
          pair = [a, b];
        }
      }
    }
    if (!pair || bd > 16) return;
    const p = path(pair[0].tile, pair[1].tile);
    if (!p) return;
    const size = Math.round(40 + Math.sqrt(pair[0].pop) * 8 + k.wealth * 0.05);
    k.wealth *= 0.6;
    world.walkers.push({ id: ids++, kind: 'army', owner: k, path: p, at: 0, x: pair[0].tile.x, y: pair[0].tile.y, size, target: pair[1], state: 'march', since: world.year, enemy: null });
    if (r() < 0.5) say(`${k.short} MARCHES ON ${pair[1].name}`, pair[0].tile.x, pair[0].tile.y - 20, k.color, 'low');
    emit('march', pair[0].tile.x, pair[0].tile.y, 0.3, { color: k.color });
  }

  function sendShip(k: Kingdom) {
    const ports = k.towns.filter((t) => !t.ruined && t.tier >= 2 && (world.grid.neighbors(t.tile) as Tile[]).some((n) => n.terrain === 'sea' || n.terrain === 'deep'));
    if (ports.length < 1) return;
    const others = world.towns.filter((t) => !t.ruined && t.tier >= 1 && (world.grid.neighbors(t.tile) as Tile[]).some((n) => n.terrain === 'sea' || n.terrain === 'deep'));
    const a = ports[Math.floor(r() * ports.length)];
    const b = others[Math.floor(r() * others.length)];
    if (!b || a === b) return;
    const sa = (world.grid.neighbors(a.tile) as Tile[]).find((n) => n.terrain === 'sea' || n.terrain === 'deep');
    const sb = (world.grid.neighbors(b.tile) as Tile[]).find((n) => n.terrain === 'sea' || n.terrain === 'deep');
    if (!sa || !sb) return;
    const p = path(sa, sb, true);
    if (!p || p.length < 4) return;
    world.walkers.push({ id: ids++, kind: 'ship', owner: k, path: p, at: 0, x: sa.x, y: sa.y, size: 1, target: b, state: 'sail', since: world.year, enemy: null });
  }

  function walkers(dy: number) {
    for (let i = world.walkers.length - 1; i >= 0; i--) {
      const w = world.walkers[i];
      if (w.owner.fallen && w.kind !== 'army') {
        world.walkers.splice(i, 1);
        continue;
      }
      const tile = w.path[Math.min(w.path.length - 1, Math.floor(w.at))];
      // Ships are faster each era (oars, then sail, then tall ships).
      const base = w.kind === 'ship' ? 1.2 + world.era * 0.15 : w.kind === 'settlers' ? 0.55 : w.kind === 'caravan' ? 0.6 : 0.7;
      const speed = base * (tile.road ? 1.6 : tile.terrain === 'forest' || tile.terrain === 'hill' ? 0.6 : 1);
      if (w.state === 'march' || w.state === 'sail' || w.state === 'home') {
        const was = Math.floor(w.at);
        w.at = Math.min(w.path.length - 1, w.at + speed * dy);
        // Caravans wear the road they walk.
        if (w.kind === 'caravan' && Math.floor(w.at) !== was) {
          const t = w.path[Math.floor(w.at)];
          if (t.road && Math.floor(t.traffic + 1) % 6 === 0) world.version++;
          t.traffic++;
        }
        walkerPos(w);
        if (w.at >= w.path.length - 1) arrive(w, i);
      } else if (w.state === 'siege') siege(w, i, dy);
      else if (w.state === 'battle') fight(w, dy);
    }
    // Armies of enemies that meet, fight.
    const armies = world.walkers.filter((w) => w.kind === 'army' && w.state === 'march');
    for (let a = 0; a < armies.length; a++) {
      for (let b = a + 1; b < armies.length; b++) {
        const x = armies[a];
        const y = armies[b];
        if (x.owner === y.owner || !atWar(x.owner, y.owner)) continue;
        if (Math.hypot(x.x - y.x, x.y - y.y) > world.grid.size * 1.6) continue;
        x.state = y.state = 'battle';
        x.enemy = y;
        y.enemy = x;
        x.since = y.since = world.year;
        say(`BATTLE OF ${placeName(r)}`, (x.x + y.x) / 2, (x.y + y.y) / 2 - 18, '#fde68a', 'medium');
        mark('battle', (x.x + y.x) / 2, (x.y + y.y) / 2, 6, '#fde68a');
        emit('battle', (x.x + y.x) / 2, (x.y + y.y) / 2, 0.6);
      }
    }
  }

  const atWar = (a: Kingdom, b: Kingdom) => a.wars.has(b.id) || b.wars.has(a.id) || a.horde || b.horde;

  function arrive(w: Walker, i: number) {
    const end = w.path[w.path.length - 1];
    if (w.kind === 'settlers') {
      world.walkers.splice(i, 1);
      if (siteScore(end) < 0 || (end.kingdom && end.kingdom !== w.owner)) return;
      const town = found(w.owner, end);
      const from = w.owner.towns.filter((t) => t !== town && !t.ruined).sort((a, b) => hexDist(a.tile, end) - hexDist(b.tile, end))[0];
      if (from) buildRoad(from, town);
      territory();
      mark('found', end.x, end.y, 3, w.owner.color);
      say(`${town.name} IS FOUNDED`, end.x, end.y - 16, w.owner.color, 'low');
      emit('founded', end.x, end.y, 0.3, { color: w.owner.color });
    } else if (w.kind === 'ship') {
      world.walkers.splice(i, 1);
      w.owner.wealth += 20;
      if (w.target && !w.target.ruined) w.target.trade += 1.5;
      emit('trade', end.x, end.y, 0.15);
    } else if (w.kind === 'caravan') {
      world.walkers.splice(i, 1);
      w.owner.wealth += 8;
      if (w.target && !w.target.ruined) {
        w.target.trade += 1;
        w.target.owner.wealth += 4;
      }
    } else if (w.kind === 'army') {
      if (w.state === 'home' || !w.target || w.target.ruined || w.target.owner === w.owner) {
        world.walkers.splice(i, 1);
        return;
      }
      w.state = 'siege';
      w.since = world.year;
      w.target.besieged = true;
      if (r() < 0.6) say(`THE SIEGE OF ${w.target.name}`, end.x, end.y - 22, w.owner.color, 'medium');
      emit('siege', end.x, end.y, 0.5, { color: w.owner.color });
    }
  }

  function fight(w: Walker, dy: number) {
    const e = w.enemy;
    if (!e || !world.walkers.includes(e)) {
      w.state = 'march';
      w.enemy = null;
      return;
    }
    if (w.id > e.id) return; // one side runs the fight
    const lossA = (e.size * 0.08 + r() * 6) * dy;
    const lossB = (w.size * 0.08 + r() * 6) * dy;
    w.size -= lossA;
    e.size -= lossB;
    if (world.year - w.since < 3 && w.size > 8 && e.size > 8) return;
    const [win, lose] = w.size >= e.size ? [w, e] : [e, w];
    win.state = 'march';
    win.enemy = null;
    lose.enemy = null;
    lose.state = 'home';
    lose.path = lose.path.slice(0, Math.max(1, Math.floor(lose.at) + 1)).reverse();
    lose.at = 0;
    if (lose.size < 8) world.walkers.splice(world.walkers.indexOf(lose), 1);
    say(`${win.owner.short} WINS THE FIELD`, win.x, win.y - 18, win.owner.color, 'low');
    emit('victory', win.x, win.y, 0.5, { color: win.owner.color });
  }

  function siege(w: Walker, i: number, dy: number) {
    const town = w.target;
    if (!town || town.ruined || town.owner === w.owner) {
      world.walkers.splice(i, 1);
      if (town) town.besieged = false;
      return;
    }
    const defense = 20 + Math.sqrt(town.pop) * 6 + (town.walls ? 60 : 0);
    w.size -= dy * (town.walls ? 3 : 1.5) * (0.5 + r());
    if (w.size < 6) {
      world.walkers.splice(i, 1);
      town.besieged = false;
      say(`THE SIEGE OF ${town.name} IS BROKEN`, town.tile.x, town.tile.y - 20, town.owner.color, 'low');
      emit('siegebroken', town.tile.x, town.tile.y, 0.4);
      return;
    }
    if (r() > dy * 0.04 * (w.size / defense)) return;
    // The town falls.
    world.walkers.splice(i, 1);
    town.besieged = false;
    const old = town.owner;
    if (w.owner.horde && town.tier <= 1) {
      raze(town, w.owner);
      return;
    }
    transfer(town, w.owner);
    town.pop *= 0.6;
    town.burning = world.year + 6;
    say(`${town.name} FALLS TO ${w.owner.short}`, town.tile.x, town.tile.y - 22, w.owner.color, 'high');
    emit('captured', town.tile.x, town.tile.y, 0.7, { color: w.owner.color });
    chronicle(`${T(town.name)} fell to ${T(w.owner.name)}.`);
    if (w.owner.horde) {
      // A horde that takes a town settles into a kingdom.
      w.owner.horde = false;
      w.owner.name = `THE ${w.owner.short} DOMINION`;
      say(`${w.owner.short} SETTLES`, town.tile.x, town.tile.y - 40, w.owner.color, 'high');
      emit('settles', town.tile.x, town.tile.y, 0.6);
      chronicle(`The ${T(w.owner.short)} came out of the wild and settled at ${T(town.name)}.`);
    }
    if (old.capital === town) old.capital = old.towns.filter((t) => !t.ruined).sort((a, b) => b.pop - a.pop)[0] ?? null;
    checkFall(old);
  }

  function transfer(town: Town, to: Kingdom) {
    const from = town.owner;
    from.towns = from.towns.filter((t) => t !== town);
    to.towns.push(town);
    town.owner = to;
    if (!to.capital) to.capital = town;
    territory();
  }

  function raze(town: Town, by: Kingdom) {
    town.ruined = true;
    town.tile.town = null;
    town.owner.towns = town.owner.towns.filter((t) => t !== town);
    mark('razed', town.tile.x, town.tile.y, 12, '#ef4444');
    say(`${town.name} IS RAZED`, town.tile.x, town.tile.y - 20, '#fca5a5', 'high');
    emit('razed', town.tile.x, town.tile.y, 0.7);
    chronicle(`${T(by.name)} burned ${T(town.name)} to the ground.`);
    if (town.tier >= 2) remember('razed', '#ef4444', `${T(town.name)} razed`);
    const old = town.owner;
    if (old.capital === town) old.capital = old.towns.filter((t) => !t.ruined).sort((a, b) => b.pop - a.pop)[0] ?? null;
    territory();
    checkFall(old);
  }

  function checkFall(k: Kingdom) {
    if (k.fallen || k.horde) return;
    if (k.towns.some((t) => !t.ruined)) return;
    k.fallen = true;
    for (const o of world.kingdoms) {
      o.wars.delete(k.id);
      k.wars.delete(o.id);
    }
    const c = world.towns.find((t) => t.owner === k) ?? null;
    say(`${k.name} IS NO MORE`, c?.tile.x ?? world.W / 2, (c?.tile.y ?? world.H / 2) - 30, '#e7e5e4', 'high');
    emit('fall', c?.tile.x ?? world.W / 2, c?.tile.y ?? world.H / 2, 0.7);
    chronicle(`${T(k.name)} fell, after ${Math.floor(world.year - k.founded)} years.`);
    remember('fall', '#e7e5e4', `${T(k.name)} falls`);
  }

  // ---- diplomacy ------------------------------------------------------------------------------

  function borders(): Map<string, number> {
    const out = new Map<string, number>();
    for (const t of world.tiles) {
      if (!t.kingdom) continue;
      for (const n of world.grid.neighbors(t) as Tile[]) {
        if (!n.kingdom || n.kingdom === t.kingdom || n.kingdom.id < t.kingdom.id) continue;
        const key = `${t.kingdom.id}:${n.kingdom.id}`;
        out.set(key, (out.get(key) ?? 0) + 1);
      }
    }
    return out;
  }

  let nextDiplomacy = 0;
  function diplomacy(dy: number) {
    if (world.year < nextDiplomacy) return;
    nextDiplomacy = world.year + 2;
    const live = world.kingdoms.filter((k) => !k.fallen && !k.horde);
    for (const [key, len] of borders()) {
      const [a, b] = key.split(':').map((id) => live.find((k) => k.id === Number(id)));
      if (!a || !b) continue;
      const at = a.wars.get(b.id);
      if (at === undefined) {
        // Tension builds slowly along a shared border; a peace leaves it negative (a truce).
        const tension = (a.tension.get(b.id) ?? 0) + 2 * 0.0016 * Math.min(4, len / 4) * opts.wars * (0.5 + r());
        a.tension.set(b.id, tension);
        if (tension > 1 && world.year > 160) {
          a.wars.set(b.id, world.year);
          b.wars.set(a.id, world.year);
          a.tension.set(b.id, 0);
          const c = a.capital?.tile ?? b.capital?.tile;
          say(`WAR · ${a.short} AND ${b.short}`, c?.x ?? world.W / 2, (c?.y ?? world.H / 2) - 30, '#fca5a5', 'high');
          emit('war', c?.x ?? world.W / 2, c?.y ?? world.H / 2, 0.6);
          chronicle(`War between ${T(a.name)} and ${T(b.name)}.`);
          remember('war', '#ef4444', `War: ${T(a.short)} and ${T(b.short)}`);
        }
      } else if (world.year - at > 35 + r() * 50) {
        a.wars.delete(b.id);
        b.wars.delete(a.id);
        a.tension.set(b.id, -0.6 - r() * 0.6);
        const c = a.capital?.tile;
        say(`PEACE · ${a.short} AND ${b.short}`, c?.x ?? world.W / 2, (c?.y ?? world.H / 2) - 30, '#bbf7d0', 'medium');
        emit('peace', c?.x ?? world.W / 2, c?.y ?? world.H / 2, 0.4);
        chronicle(`${T(a.name)} and ${T(b.name)} made peace.`);
      }
    }
    // At war: raise armies now and then.
    for (const k of live) {
      for (const [id] of k.wars) {
        const foe = world.kingdoms.find((o) => o.id === id);
        if (!foe || foe.fallen) {
          k.wars.delete(id);
          continue;
        }
        const out = world.walkers.filter((w) => w.kind === 'army' && w.owner === k).length;
        if (out < 2 && r() < 0.12) raiseArmy(k, foe);
      }
    }
    void dy;
  }

  // ---- growth, wonders, and troubles --------------------------------------------------------

  function grow(dy: number) {
    for (const k of world.kingdoms) {
      if (k.fallen || k.horde) continue;
      k.unrest = Math.max(0, k.unrest + dy * (k.towns.length > 9 ? 0.004 * (k.towns.length - 9) : -0.01));
      for (const town of k.towns) {
        if (town.ruined) continue;
        let food = town.tile.fert * 2;
        for (const n of world.grid.neighbors(town.tile) as Tile[]) food += n.fert + (n.terrain === 'sea' || n.terrain === 'coast' ? 0.25 : 0);
        // Trade feeds a town past what its own fields can: rich towns visibly outgrow the rest.
        const rich = 1 + Math.min(0.7, town.trade * 0.06);
        const cap = food * (60 + world.era * 45) * (town === k.capital ? 1.6 : 1) * (town.plague > 0 ? 0.5 : 1) * rich;
        town.pop += town.pop * 0.035 * (1 - town.pop / cap) * dy * (town.besieged ? 0 : 1);
        town.pop = Math.max(4, town.pop);
        town.plague = Math.max(0, town.plague - dy * 0.05);
        town.trade = Math.max(0, town.trade - dy * 0.02 * town.trade);
        k.wealth += town.pop * 0.002 * dy;
        const tier = (town === k.capital && town.pop > 260 ? 4 : town.pop > 420 ? 3 : town.pop > 150 ? 2 : town.pop > 45 ? 1 : 0) as Tier;
        if (tier > town.tier) {
          town.tier = tier;
          if (tier >= 2 && world.era >= 1) town.walls = true;
          if (tier === 3) {
            say(`${town.name} BECOMES A CITY`, town.tile.x, town.tile.y - 22, k.color, 'medium');
            emit('city', town.tile.x, town.tile.y, 0.45, { color: k.color });
          }
          territory();
        }
        if (town.tier < tier) town.tier = tier;
        // A capital at its height (or a great trading city) begins a wonder; it takes decades.
        const wonders = world.towns.filter((o) => o.wonder && !o.ruined).length;
        if ((town === k.capital || town.trade > 4) && town.tier >= 3 && world.era >= 2 && !town.wonder && town.pop > 380 && wonders < 4 && r() < dy * 0.004) {
          // A design no one else in this age has built.
          const used = new Set(world.towns.filter((o) => o.wonder).map((o) => o.wonderKind));
          const free = WONDERS.map((_, i) => i).filter((i) => !used.has(i));
          if (free.length) {
            town.wonderKind = free[Math.floor(r() * free.length)];
            town.wonder = WONDERS[town.wonderKind];
            town.wonderStart = world.year;
            town.wonderAt = world.year + 40 + r() * 35;
            say(`WORK BEGINS ON ${town.wonder}`, town.tile.x, town.tile.y - 30, '#fde68a', 'medium');
            emit('wonderbegun', town.tile.x, town.tile.y, 0.35);
            chronicle(`In ${T(town.name)}, work began on ${T(town.wonder)}.`);
          }
        }
        if (town.wonder && town.wonderAt > 0 && world.year >= town.wonderAt) {
          town.wonderAt = -1;
          mark('wonder', town.tile.x, town.tile.y, 8, '#fde68a');
          say(`${town.wonder} STANDS IN ${town.name}`, town.tile.x, town.tile.y - 34, '#fde68a', 'high');
          emit('wonder', town.tile.x, town.tile.y, 0.75);
          chronicle(`${T(town.wonder)} was raised in ${T(town.name)}, after ${Math.round(world.year - town.wonderStart)} years.`);
          remember('wonder', '#fde68a', `${T(town.wonder)} stands in ${T(town.name)}`);
        }
      }
      // Settlers go out from the best-fed town.
      const settling = world.walkers.some((w) => w.kind === 'settlers' && w.owner === k);
      const home = k.towns.filter((t) => !t.ruined && t.pop > 40).sort((a, b) => b.pop - a.pop)[0];
      if (!settling && home && r() < dy * 0.14) sendSettlers(k, home);
      // Trade: caravans on the roads, and ships once there are ports (oared at first).
      if (r() < dy * 0.1 && world.walkers.filter((w) => w.kind === 'caravan').length < 24) sendCaravan(k);
      if (world.era >= 1 && r() < dy * (0.025 + world.era * 0.01) && world.walkers.filter((w) => w.kind === 'ship').length < 10) sendShip(k);
    }
  }

  let nextTrouble = 30;
  function troubles() {
    if (world.year < nextTrouble) return;
    nextTrouble = world.year + (25 + r() * 40) / Math.max(0.2, opts.disasters);
    const live = world.towns.filter((t) => !t.ruined);
    const roll = r();
    if (roll < 0.18 && live.length > 4) {
      // Plague, carried by the roads, from some crowded town.
      const crowded = live.filter((t) => t.tier >= 2 && t.plague === 0);
      const start = crowded[Math.floor(r() * crowded.length)];
      if (!start) return;
      start.plague = 1;
      start.pop *= 0.65;
      for (const t of live) if (t !== start && t.tile.road && hexDist(t.tile, start.tile) < 9 && r() < 0.6) {
        t.plague = 0.8;
        t.pop *= 0.7;
        mark('plague', t.tile.x, t.tile.y, 10, '#84cc16');
      }
      mark('plague', start.tile.x, start.tile.y, 12, '#84cc16');
      say(`PLAGUE IN ${start.name}`, start.tile.x, start.tile.y - 22, '#bef264', 'high');
      emit('plague', start.tile.x, start.tile.y, 0.7);
      chronicle(`Plague came to ${T(start.name)} and spread along the roads.`);
      remember('plague', '#84cc16', `Plague in ${T(start.name)}`);
    } else if (roll < 0.5) {
      const t = live[Math.floor(r() * live.length)];
      if (!t || t.tier < 1) return;
      t.burning = world.year + 5;
      t.pop *= 0.8;
      mark('fire', t.tile.x, t.tile.y, 6, '#f97316');
      say(`${t.name} BURNS`, t.tile.x, t.tile.y - 20, '#fdba74', 'medium');
      emit('fire', t.tile.x, t.tile.y, 0.55);
    } else if (roll < 0.72) {
      // A horde from the edge of the map.
      const edge = world.tiles.filter((t) => onLand(t) && inView(t) && (t.x < world.W * 0.12 || t.x > world.W * 0.88 || t.y < world.H * 0.12 || t.y > world.H * 0.88) && !t.kingdom);
      const from = edge[Math.floor(r() * edge.length)];
      const prey = live.filter((t) => from && hexDist(t.tile, from) < 14).sort((a, b) => hexDist(a.tile, from!) - hexDist(b.tile, from!))[0];
      if (!from || !prey) return;
      const p = path(from, prey.tile);
      if (!p) return;
      const k = newKingdom(from, r() < 0.5 ? 'horde' : 'hollow', true);
      world.walkers.push({ id: ids++, kind: 'army', owner: k, path: p, at: 0, x: from.x, y: from.y, size: 90 + r() * 70, target: prey, state: 'march', since: world.year, enemy: null });
      say(`A HORDE · ${k.name}`, from.x, from.y - 20, k.color, 'high');
      emit('horde', from.x, from.y, 0.6);
      chronicle(`${T(k.name)} came out of the wild.`);
      remember('horde', k.color, `${T(k.name)} comes out of the wild`);
    } else if (roll < 0.8) {
      // Civil war in a kingdom grown too big.
      const big = world.kingdoms.filter((k) => !k.fallen && !k.horde && k.towns.length >= 8).sort((a, b) => b.unrest - a.unrest)[0];
      if (big) schism(big);
    } else if (roll < 0.9) {
      // The land itself: a volcano wakes, or a river floods.
      if (r() < 0.45) volcano();
      else flood();
    } else if (r() < 0.6 * opts.dragons) {
      // A dragon from the mountains.
      const peaks = world.tiles.filter((t) => t.terrain === 'mountain' && inView(t));
      const lair = peaks[Math.floor(r() * peaks.length)];
      const prey = live.filter((t) => t.tier >= 1 && lair && hexDist(t.tile, lair) < 16)[0];
      if (!lair || !prey) return;
      world.dragon = { x: lair.x, y: lair.y, tx: prey.tile.x, ty: prey.tile.y, state: 'come', t0: world.t, target: prey, flip: prey.tile.x < lair.x };
      say('A DRAGON WAKES IN THE MOUNTAINS', lair.x, lair.y - 20, '#fb923c', 'high');
      emit('dragon', lair.x, lair.y, 0.8);
    }
  }

  /** A realm splits: its far towns rise under a rival and go to war with the crown. */
  function schism(big: Kingdom, cry?: string) {
    if (!big.capital) return;
    const far = [...big.towns].filter((t) => !t.ruined && t !== big.capital).sort((a, b) => hexDist(b.tile, big.capital!.tile) - hexDist(a.tile, big.capital!.tile));
    const rebels = far.slice(0, Math.floor(far.length / 2));
    if (rebels.length < 2) return;
    const k = newKingdom(rebels[0].tile, big.faction.people);
    k.name = `THE FREE ${rebels[0].name}`;
    k.short = rebels[0].name;
    for (const t of rebels) transfer(t, k);
    k.capital = rebels[0];
    big.unrest = 0;
    k.wars.set(big.id, world.year);
    big.wars.set(k.id, world.year);
    mark('schism', rebels[0].tile.x, rebels[0].tile.y, 8, k.color);
    say(cry ?? `CIVIL WAR · ${k.short} RISES AGAINST ${big.short}`, rebels[0].tile.x, rebels[0].tile.y - 26, k.color, 'high');
    emit('schism', rebels[0].tile.x, rebels[0].tile.y, 0.7);
    chronicle(`${T(rebels[0].name)} and ${rebels.length - 1} other towns rose against ${T(big.name)}.`);
    remember('schism', k.color, `${T(rebels[0].name)} rises against ${T(big.short)}`);
  }

  /** A mountain wakes: fire and ash on the towns below; the ash makes good fields after. */
  function volcano() {
    const peaks = world.tiles.filter((t) => t.terrain === 'mountain' && inView(t) && t.erupted < 0);
    const peak = peaks[Math.floor(r() * peaks.length)];
    if (!peak) return;
    peak.erupted = world.year;
    world.landEdits++;
    mark('volcano', peak.x, peak.y, 26, '#f97316');
    for (const t of world.towns) {
      if (t.ruined) continue;
      const d = hexDist(t.tile, peak);
      if (d > 4) continue;
      t.pop *= 0.55 + d * 0.08;
      t.burning = world.year + 8;
    }
    for (const t of world.tiles) if (onLand(t) && hexDist(t, peak) <= 3 && t.terrain !== 'mountain') t.fert = Math.min(1, t.fert + 0.15);
    const name = placeName(r);
    say(`MOUNT ${name} WAKES`, peak.x, peak.y - 26, '#fb923c', 'high');
    emit('volcano', peak.x, peak.y, 0.85);
    chronicle(`Mount ${T(name)} woke, and ash fell on the towns below it.`);
    remember('volcano', '#f97316', `Mount ${T(name)} wakes`);
  }

  /** A river breaks its banks along a stretch: the towns on it lose people and harvests. */
  function flood() {
    const rivers = world.tiles.filter((t) => t.river && t.flow >= 2 && inView(t));
    const start = rivers[Math.floor(r() * rivers.length)];
    if (!start) return;
    const pts: [number, number][] = [];
    let hit = 0;
    for (let t: Tile | null = start, k = 0; t && k < 8; t = t.down, k++) {
      pts.push([t.x, t.y]);
      for (const n of [t, ...(world.grid.neighbors(t) as Tile[])]) {
        if (n.town && !n.town.ruined) {
          n.town.pop *= 0.8;
          hit++;
        }
      }
    }
    if (pts.length < 3) return;
    const m = mark('flood', start.x, start.y, 14, '#60a5fa');
    m.pts = pts;
    say(hit ? 'THE RIVER FLOODS' : 'THE RIVER RUNS HIGH', start.x, start.y - 22, '#93c5fd', hit ? 'high' : 'medium');
    emit('flood', start.x, start.y, hit ? 0.6 : 0.35);
    if (hit) {
      chronicle(`The river flooded ${hit} town${hit > 1 ? 's' : ''} along its banks.`);
      remember('flood', '#60a5fa', 'The river floods');
    }
  }

  /** The land under the people: woods around the big towns are cleared for fields. */
  function clearing() {
    let changed = false;
    for (const town of world.towns) {
      if (town.ruined || town.tier < 2) continue;
      // The reach of the axe grows with the town and the age.
      const reach = town.tier >= 3 || world.era >= 3 ? 2 : 1;
      for (const t of world.grid.neighbors(town.tile) as Tile[]) {
        const ring = reach > 1 ? [t, ...(world.grid.neighbors(t) as Tile[])] : [t];
        for (const n of ring) {
          if (n.terrain !== 'forest' || n.cleared || r() > 0.35) continue;
          n.cleared = true;
          n.terrain = 'plain';
          n.fert = Math.max(n.fert, 0.75);
          changed = true;
        }
      }
    }
    if (changed) world.landEdits++;
  }

  /** Caravans between friendly towns, along the roads. */
  function sendCaravan(k: Kingdom) {
    const from = k.towns.filter((t) => !t.ruined && t.tier >= 1 && t.tile.road);
    const a = from[Math.floor(r() * from.length)];
    if (!a) return;
    const to = world.towns.filter((t) => !t.ruined && t !== a && t.tile.road && !atWar(k, t.owner) && hexDist(t.tile, a.tile) <= 12 && hexDist(t.tile, a.tile) >= 3);
    const b = to[Math.floor(r() * to.length)];
    if (!b) return;
    const p = path(a.tile, b.tile);
    // Only along a road the whole way (mostly): a caravan does not cut across the wild.
    if (!p || p.filter((t) => t.road).length < p.length * 0.7) return;
    world.walkers.push({ id: ids++, kind: 'caravan', owner: k, path: p, at: 0, x: a.tile.x, y: a.tile.y, size: 1, target: b, state: 'march', since: world.year, enemy: null });
  }

  function dragonStep(dt: number) {
    const d = world.dragon;
    if (!d) return;
    const speed = 70 * dt;
    if (d.state === 'come') {
      const dx = d.tx - d.x;
      const dy = d.ty - d.y;
      const len = Math.hypot(dx, dy);
      d.flip = dx < 0;
      if (len < 6) {
        d.state = 'burn';
        d.t0 = world.t;
        const town = d.target;
        if (town && !town.ruined) {
          town.burning = world.year + 8;
          town.pop *= 0.5;
          mark('dragonfire', town.tile.x, town.tile.y, 6, '#f97316');
          say(`THE DRAGON BURNS ${town.name}`, town.tile.x, town.tile.y - 24, '#fb923c', 'high');
          emit('dragonfire', town.tile.x, town.tile.y, 0.85);
          chronicle(`A dragon burned ${T(town.name)}.`);
          remember('dragon', '#fb923c', `A dragon burns ${T(town.name)}`);
        }
      } else {
        d.x += (dx / len) * speed;
        d.y += (dy / len) * speed;
      }
    } else if (d.state === 'burn') {
      d.x += Math.cos(world.t * 2) * speed * 0.5;
      d.y += Math.sin(world.t * 2) * speed * 0.3;
      if (world.t - d.t0 > 4) {
        d.state = 'go';
        d.tx = d.x < world.W / 2 ? -100 : world.W + 100;
        d.ty = d.y - 200;
      }
    } else {
      const dx = d.tx - d.x;
      const dy = d.ty - d.y;
      const len = Math.hypot(dx, dy);
      d.flip = dx < 0;
      d.x += (dx / len) * speed * 1.3;
      d.y += (dy / len) * speed * 1.3;
      if (len < 10) world.dragon = null;
    }
  }

  // ---- eras and the end of an age -----------------------------------------------------------

  function eras() {
    const era = Math.min(ERAS.length - 1, Math.floor(world.year / ERA_YEARS));
    if (era !== world.era) {
      world.era = era;
      const c = world.kingdoms.filter((k) => !k.fallen && !k.horde).sort((a, b) => b.towns.length - a.towns.length)[0]?.capital?.tile;
      say(ERAS[era], c?.x ?? world.W / 2, (c?.y ?? world.H / 2) - 40, '#fde68a', 'high');
      emit('era', world.W / 2, world.H / 2, 0.6);
      chronicle(`${T(ERAS[era])} began.`);
      remember('era', '#fde68a', T(ERAS[era]));
      for (const t of world.towns) if (!t.ruined && t.tier >= 2 && era >= 1) t.walls = true;
    }
    // One crown over (nearly) every town: unification.
    const live = world.towns.filter((t) => !t.ruined);
    const top = world.kingdoms.filter((k) => !k.fallen && !k.horde).sort((a, b) => b.towns.length - a.towns.length)[0];
    if (!world.unified && top && live.length >= 12 && top.towns.length / live.length > 0.85) {
      world.unified = top;
      const c = top.capital?.tile;
      say(`${top.name} RULES ALL THE LAND`, c?.x ?? world.W / 2, (c?.y ?? world.H / 2) - 40, '#fde68a', 'high');
      emit('unified', c?.x ?? world.W / 2, c?.y ?? world.H / 2, 0.9);
      chronicle(`${T(top.name)} united the land, under ${T(regnal(top.ruler))} of the house of ${T(top.house)}.`);
      remember('unified', '#fde68a', `${T(top.short)} rules all the land`);
    }
    if (world.ending < 0 && (world.year > ERAS.length * ERA_YEARS + 60 || (world.unified && world.year > 0 && r() < 0.0004))) {
      world.ending = world.t;
      say('THE AGE ENDS', world.W / 2, world.H / 2, '#e7e5e4', 'high');
      emit('ageends', world.W / 2, world.H / 2, 0.7);
      chronicle('The age ended. The land was quiet a long time.');
    }
    if (world.ending >= 0 && world.t - world.ending > 5) newAge();
  }

  function newAge() {
    world.gen++;
    r = forkRng(seed, `ages-${world.gen}`);
    world.year = 0;
    world.era = 0;
    world.kingdoms = [];
    world.towns = [];
    world.walkers = [];
    world.marks = [];
    world.labels = [];
    world.dragon = null;
    world.unified = null;
    world.ending = -1;
    world.history = [];
    nextTrouble = 30;
    nextClearing = 40;
    nextDiplomacy = 0;
    nextTerritory = 0;
    makeLand();
    settleKingdoms(Math.round(opts.kingdoms));
    territory();
    say('A NEW LAND', world.W / 2, world.H / 2, '#fde68a', 'medium');
    emit('newage', world.W / 2, world.H / 2, 0.4);
  }

  // ---- the frame ------------------------------------------------------------------------------

  let nextClearing = 40;

  function step(dt: number) {
    world.t += dt;
    const dy = dt * opts.speed * 2.5;
    if (world.ending < 0) {
      world.year += dy;
      grow(dy);
      walkers(dy);
      diplomacy(dy);
      troubles();
      successions();
      if (world.year >= nextClearing) {
        nextClearing = world.year + 15;
        clearing();
      }
      if (world.year >= nextTerritory) {
        nextTerritory = world.year + 3;
        territory();
      }
    }
    dragonStep(dt);
    eras();
    for (let i = world.marks.length - 1; i >= 0; i--) if (world.t - world.marks[i].t0 > world.marks[i].dur) world.marks.splice(i, 1);
    for (let i = world.labels.length - 1; i >= 0; i--) if (world.t - world.labels[i].t0 > world.labels[i].dur) world.labels.splice(i, 1);
  }

  makeLand();
  settleKingdoms(Math.round(opts.kingdoms));
  territory();
  // The first hearths have a head start, so the opening frames already show villages and roads.
  for (let i = 0; i < 120; i++) {
    world.year += 0.5;
    grow(0.5);
    walkers(0.5);
  }
  territory();
  // What the head start said is history already: start with a clear map, and reigns that
  // began then end later (not all at once in the first frames).
  world.labels = [];
  world.marks = [];
  for (const k of world.kingdoms) k.reignEnds = world.year + 8 + r() * 40;
  nextTrouble = world.year + 15 + r() * 25;
  const k0 = world.kingdoms[0];
  chronicle(`${world.kingdoms.length} peoples lit their first hearths${k0 ? `, ${T(k0.name)} among them` : ''}.`);
  return world;
}

export const tierName = (t: Tier) => TIERS[t];
export type { Faction };
