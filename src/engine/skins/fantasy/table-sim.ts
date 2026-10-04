/**
 * The War Table: one war's campaign, played out on a map by an unseen hand. No DOM here.
 *
 * The map: a coast and its towns, joined by roads. Two or three realms hold the towns.
 * Armies are tokens of some strength that move town to town along the roads. Each month
 * the realms give orders: march on a weak town, meet an army, relieve a siege. Tokens
 * that meet fight (strength and luck); a token left alone at an enemy town lays siege
 * until it falls. Realms raise new tokens at their capitals. In winter the armies go to
 * winter quarters. The war ends when a realm loses its capital or the war has worn
 * everyone out: a peace is sealed, and the next campaign is unrolled on a new map.
 *
 * Time: a month every `MONTH` seconds.
 */
import { forkRng, type Rng } from '../../rng';
import { createBus, type Bus } from '../../sim/bus';
import type { Noise2D } from '../../noise';
import { placeName, titled } from './names';

export const MONTH = 3.2;
export const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const WINTER = new Set([11, 0, 1]);

export type Realm = { id: number; name: string; short: string; color: string; ink: string; capital: TTown | null; out: boolean; arms: 'lion' | 'tower' | 'star' | 'oak' };
export type TTown = { id: number; name: string; x: number; y: number; owner: Realm; capital: boolean; walls: number; siege: number; links: TTown[]; burned: number };
export type Token = {
  id: number;
  realm: Realm;
  strength: number;
  kind: 'foot' | 'horse' | 'king';
  at: TTown;
  /** Moving: from `at` toward `to`, `k` of the way (0..1), started at `t0`. */
  to: TTown | null;
  k: number;
  t0: number;
  dur: number;
  /** Where it was headed in the end (an order can be several roads long). */
  goal: TTown | null;
  route: TTown[];
  x: number;
  y: number;
  fallenAt: number;
};
/** An order on the map, in ink: from, through, to. Drawn as it is given, fading after. */
export type Arrow = { pts: [number, number][]; color: string; t0: number; realm: Realm };
export type Note = { text: string; x: number; y: number; t0: number; ink: string; angle: number };
export type Blot = { kind: 'battle' | 'burn' | 'seal' | 'plague' | 'dragon'; x: number; y: number; t0: number; color: string; seed: number; text?: string };

export type TableOptions = { realms: number; pace: number; dragons: number };

export type TableWorld = {
  t: number;
  month: number;
  year: number;
  W: number;
  H: number;
  /** The campaign (a new map for each). */
  n: number;
  bus: Bus;
  name: string;
  realms: Realm[];
  towns: TTown[];
  tokens: Token[];
  arrows: Arrow[];
  notes: Note[];
  blots: Blot[];
  /** The land: elevation at any point, for drawing the coast. */
  elevAt(x: number, y: number): number;
  /** Set when a peace is sealed; the next campaign follows a few seconds later. */
  sealed: number;
  winter: boolean;
  dragon: { x: number; y: number; tx: number; ty: number; t0: number; target: TTown | null } | null;
  version: number;
  step(dt: number): void;
  resize(W: number, H: number): void;
  counts(): Record<string, number>;
};

const REALM_NAMES = ['THE CROWN OF', 'THE DUCHY OF', 'THE MARCH OF', 'THE FREE CITY OF', 'THE PRINCIPALITY OF', 'THE EARLDOM OF'];
const INKS: [string, string][] = [
  ['#9a3b2a', '#5e2015'],
  ['#2f4b7c', '#1c2e4d'],
  ['#3f6b3b', '#243e22'],
  ['#7a5a1e', '#4a3610'],
];
const ARMS: Realm['arms'][] = ['lion', 'tower', 'star', 'oak'];

export function createTableWorld(seed: string | number, W: number, H: number, noise: Noise2D, opts: TableOptions): TableWorld {
  const bus = createBus(() => world.t);
  let r: Rng = forkRng(seed, 'table-0');
  let ids = 1;
  let off = 0;
  let nextMonth = MONTH;

  const world: TableWorld = {
    t: 0,
    month: 3,
    year: 1240,
    W,
    H,
    n: 0,
    bus,
    name: '',
    realms: [],
    towns: [],
    tokens: [],
    arrows: [],
    notes: [],
    blots: [],
    elevAt: (x, y) => land(x, y),
    sealed: -1,
    winter: false,
    dragon: null,
    version: 0,
    step,
    resize(w, h) {
      world.W = w;
      world.H = h;
    },
    counts() {
      return { month: world.month, tokens: world.tokens.filter((k) => k.fallenAt < 0).length, towns: world.towns.length, arrows: world.arrows.length, notes: world.notes.length };
    },
  };

  // ---- telling -----------------------------------------------------------------------------

  /** A note in the margin of history: handwritten on the map, and said on the bus. */
  const note = (text: string, x: number, y: number, ink: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    world.notes.push({ text, x, y, t0: world.t, ink, angle: (r() - 0.5) * 0.12 });
    if (world.notes.length > 9) world.notes.shift();
    bus.emit({ type: 'say', text, x, y, color: ink, priority });
  };
  const emit = (type: string, x: number, y: number, weight: number) => bus.emit({ type, x, y, weight });
  const dateline = () => `the ${ordinal(1 + Math.floor(r() * 27))} of ${titled(MONTHS[world.month])}`;
  const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

  // ---- the map ---------------------------------------------------------------------------------

  function land(x: number, y: number) {
    const dx = (x - world.W / 2) / (world.W * 0.62);
    const dy = (y - world.H / 2) / (world.H * 0.62);
    const edge = Math.hypot(dx, dy * 0.9);
    const e = noise.noise2(x * 0.0028 + off, y * 0.0028) * 0.6 + noise.noise2(x * 0.009 + off, y * 0.009 + 5) * 0.28 + noise.noise2(x * 0.03, y * 0.03 + off) * 0.12;
    return e * 0.9 + 0.42 - edge * edge * 1.1;
  }

  function newCampaign() {
    r = forkRng(seed, `table-${world.n}`);
    off = r() * 1000;
    world.realms = [];
    world.towns = [];
    world.tokens = [];
    world.arrows = [];
    world.notes = [];
    world.blots = [];
    world.dragon = null;
    world.sealed = -1;
    world.month = 2 + Math.floor(r() * 3);
    world.name = placeName(r);
    // Towns: well apart, on land, in from the edges.
    const margin = 70;
    for (let tries = 0; tries < 900 && world.towns.length < 16; tries++) {
      const x = margin + r() * (world.W - margin * 2);
      const y = margin + 30 + r() * (world.H - margin * 2 - 30);
      if (land(x, y) < 0.08) continue;
      if (world.towns.some((t) => Math.hypot(t.x - x, t.y - y) < Math.min(world.W, world.H) * 0.13)) continue;
      world.towns.push({ id: ids++, name: placeName(r), x, y, owner: null as unknown as Realm, capital: false, walls: 1 + Math.floor(r() * 3), siege: 0, links: [], burned: -1 });
    }
    // Roads: each town to its nearest few, over land; then join any islands of towns.
    const overLand = (a: TTown, b: TTown) => {
      for (let i = 1; i < 10; i++) if (land(a.x + ((b.x - a.x) * i) / 10, a.y + ((b.y - a.y) * i) / 10) < 0.02) return false;
      return true;
    };
    const link = (a: TTown, b: TTown) => {
      if (a === b || a.links.includes(b)) return;
      a.links.push(b);
      b.links.push(a);
    };
    for (const a of world.towns) {
      const near = world.towns.filter((b) => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
      let n = 0;
      for (const b of near) {
        if (n >= 2) break;
        if (overLand(a, b)) {
          link(a, b);
          n++;
        }
      }
    }
    // Every town reachable from the first (a ferry where the land breaks).
    const seen = new Set<TTown>();
    const visit = (t: TTown) => {
      if (seen.has(t)) return;
      seen.add(t);
      t.links.forEach(visit);
    };
    if (world.towns[0]) visit(world.towns[0]);
    for (const t of world.towns) {
      if (seen.has(t)) continue;
      const nearest = [...seen].sort((p, q) => Math.hypot(p.x - t.x, p.y - t.y) - Math.hypot(q.x - t.x, q.y - t.y))[0];
      if (nearest) link(t, nearest);
      visit(t);
    }
    // Realms: split the towns around two or three seats, as far apart as they can be.
    const n = Math.max(2, Math.min(3, Math.round(opts.realms)));
    const seats: TTown[] = [];
    const sorted = [...world.towns].sort((a, b) => a.x - b.x);
    seats.push(sorted[0]);
    while (seats.length < n) {
      const far = world.towns.filter((t) => !seats.includes(t)).sort((a, b) => Math.min(...seats.map((s) => Math.hypot(s.x - b.x, s.y - b.y))) - Math.min(...seats.map((s) => Math.hypot(s.x - a.x, s.y - a.y))))[0];
      seats.push(far);
    }
    const inks = [...INKS].sort(() => r() - 0.5);
    seats.forEach((s, i) => {
      const realm: Realm = { id: ids++, name: `${REALM_NAMES[Math.floor(r() * REALM_NAMES.length)]} ${s.name}`, short: s.name, color: inks[i][0], ink: inks[i][1], capital: s, out: false, arms: ARMS[i % ARMS.length] };
      world.realms.push(realm);
      s.capital = true;
      s.walls = 4;
    });
    for (const t of world.towns) {
      const best = world.realms.reduce((a, b) => (Math.hypot(a.capital!.x - t.x, a.capital!.y - t.y) <= Math.hypot(b.capital!.x - t.x, b.capital!.y - t.y) ? a : b));
      t.owner = best;
    }
    // Opening armies: a king's token at each seat, and a few more in its towns.
    for (const realm of world.realms) {
      token(realm, realm.capital!, 3, 'king');
      const mine = world.towns.filter((t) => t.owner === realm && !t.capital);
      for (let i = 0; i < Math.min(3, mine.length); i++) token(realm, mine[Math.floor(r() * mine.length)], 1 + Math.floor(r() * 3), r() < 0.3 ? 'horse' : 'foot');
    }
    world.version++;
    const [a, b] = world.realms;
    if (a && b) note(`The War of ${titled(world.name)} · ${titled(a.short)} against ${titled(b.short)}${world.realms[2] ? ` and ${titled(world.realms[2].short)}` : ''}`, world.W / 2, world.H * 0.12, '#3b2a1a', 'medium');
    emit('campaign', world.W / 2, world.H / 2, 0.4);
  }

  function token(realm: Realm, at: TTown, strength: number, kind: Token['kind']): Token {
    const k: Token = { id: ids++, realm, strength, kind, at, to: null, k: 0, t0: 0, dur: 0, goal: null, route: [], x: at.x, y: at.y, fallenAt: -1 };
    world.tokens.push(k);
    return k;
  }

  const live = () => world.tokens.filter((k) => k.fallenAt < 0);

  // ---- orders --------------------------------------------------------------------------------

  /** The shortest road route between two towns (towns, not counting the start). */
  function route(a: TTown, b: TTown): TTown[] {
    const prev = new Map<TTown, TTown>();
    const q: TTown[] = [a];
    const seen = new Set([a]);
    while (q.length) {
      const cur = q.shift()!;
      if (cur === b) break;
      for (const n of cur.links) {
        if (seen.has(n)) continue;
        seen.add(n);
        prev.set(n, cur);
        q.push(n);
      }
    }
    const out: TTown[] = [];
    for (let cur: TTown | undefined = b; cur && cur !== a; cur = prev.get(cur)) out.unshift(cur);
    return out;
  }

  function orders() {
    for (const realm of world.realms) {
      if (realm.out) continue;
      // Pieces already laying siege stay at it.
      const mine = live().filter((k) => k.realm === realm && !k.to && !(k.at.owner !== realm && k.at.siege > 0));
      for (const k of mine) {
        if (r() < 0.35) continue;
        // Kings stay home unless the seat is lost.
        if (k.kind === 'king' && k.at.owner === realm && r() < 0.85) continue;
        // Targets: enemy towns, weakest and nearest; a besieged town of ours first.
        const threatened = world.towns.find((t) => t.owner === realm && t.siege > 0 && Math.hypot(t.x - k.x, t.y - k.y) < world.W * 0.35);
        let goal: TTown | null = threatened ?? null;
        if (!goal) {
          const enemy = world.towns.filter((t) => t.owner !== realm && !t.owner.out);
          goal = enemy.sort((a, b) => score(k, a) - score(k, b))[0] ?? null;
        }
        if (!goal || goal === k.at) continue;
        const path = route(k.at, goal);
        if (!path.length) continue;
        k.goal = goal;
        k.route = path.slice(0, 3);
        world.arrows.push({ pts: [[k.x, k.y], ...k.route.map((t) => [t.x, t.y] as [number, number])], color: realm.color, t0: world.t, realm });
        if (world.arrows.length > 24) world.arrows.shift();
        emit('order', k.x, k.y, 0.2);
        moveNext(k);
      }
    }
  }

  const score = (k: Token, t: TTown) => Math.hypot(t.x - k.x, t.y - k.y) / (world.W * 0.25) + t.walls * 0.3 + garrison(t) * 0.5 - (t.capital ? 0.4 : 0);
  const garrison = (t: TTown) => live().filter((k) => k.at === t && !k.to && k.realm === t.owner).reduce((s, k) => s + k.strength, 0);

  function moveNext(k: Token) {
    const next = k.route.shift();
    if (!next) {
      k.goal = null;
      return;
    }
    k.to = next;
    k.k = 0;
    k.t0 = world.t;
    k.dur = (Math.hypot(next.x - k.at.x, next.y - k.at.y) / 70) * (k.kind === 'horse' ? 0.6 : 1) * MONTH * 0.6 / Math.max(0.3, opts.pace);
  }

  // ---- the hand moves the pieces -------------------------------------------------------------

  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

  function moves() {
    for (const k of live()) {
      if (!k.to) {
        // Stacks on one town fan out a little, so each piece can be seen.
        const here = live().filter((o) => o.at === k.at && !o.to);
        const i = here.indexOf(k);
        const tx = k.at.x + (here.length > 1 ? (i - (here.length - 1) / 2) * 16 : 0);
        const ty = k.at.y + 14;
        k.x += (tx - k.x) * 0.15;
        k.y += (ty - k.y) * 0.15;
        continue;
      }
      if (world.winter) continue;
      k.k = Math.min(1, (world.t - k.t0) / Math.max(0.1, k.dur));
      const e = ease(k.k);
      k.x = k.at.x + (k.to.x - k.at.x) * e;
      k.y = k.at.y + 14 + (k.to.y - k.at.y) * e;
      if (k.k >= 1) {
        k.at = k.to;
        k.to = null;
        arriveAt(k);
        if (k.fallenAt < 0 && k.at.owner !== k.realm) continue; // stays to besiege
        moveNext(k);
      }
    }
  }

  function arriveAt(k: Token) {
    const town = k.at;
    // Enemies here: battle.
    const foes = live().filter((o) => o !== k && o.at === town && !o.to && o.realm !== k.realm);
    if (foes.length) {
      battle(k, foes[0]);
      return;
    }
    if (town.owner !== k.realm && town.siege === 0) {
      town.siege = 0.01;
      note(`${titled(k.realm.short)} lays siege to ${titled(town.name)}`, town.x, town.y - 26, k.realm.ink, 'low');
      emit('siege', town.x, town.y, 0.4);
    }
  }

  function battle(a: Token, b: Token) {
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const rollA = a.strength * (a.kind === 'horse' ? 1.3 : a.kind === 'king' ? 1.5 : 1) * (0.5 + r());
    const rollB = b.strength * (b.kind === 'horse' ? 1.3 : b.kind === 'king' ? 1.5 : 1) * (0.5 + r()) * (b.at.owner === b.realm ? 1 + b.at.walls * 0.12 : 1);
    const [win, lose] = rollA >= rollB ? [a, b] : [b, a];
    lose.strength -= 1 + (r() < 0.4 ? 1 : 0);
    win.strength -= r() < 0.35 ? 1 : 0;
    world.blots.push({ kind: 'battle', x, y, t0: world.t, color: '#3b2a1a', seed: Math.floor(r() * 1e6) });
    note(`Battle of ${titled(lose.at.name)}, ${dateline()}`, x, y + 30, '#3b2a1a', 'medium');
    emit('battle', x, y, 0.6);
    for (const k of [win, lose]) {
      if (k.strength > 0) continue;
      fall(k);
    }
    if (lose.fallenAt < 0) {
      // The loser falls back toward its own town.
      const home = lose.at.links.find((t) => t.owner === lose.realm) ?? lose.at.links[0];
      if (home) {
        lose.route = [home];
        lose.goal = home;
        moveNext(lose);
      }
    }
  }

  function fall(k: Token) {
    k.fallenAt = world.t;
    if (k.kind === 'king') {
      note(`The King of ${titled(k.realm.short)} is taken`, k.x, k.y - 34, '#5e2015', 'high');
      emit('kingtaken', k.x, k.y, 0.85);
    } else emit('lost', k.x, k.y, 0.4);
  }

  function sieges(dt: number) {
    for (const town of world.towns) {
      if (town.siege <= 0) continue;
      const besiegers = live().filter((k) => k.at === town && !k.to && k.realm !== town.owner);
      if (!besiegers.length) {
        town.siege = 0;
        continue;
      }
      if (world.winter) continue;
      town.siege += (dt / MONTH) * besiegers.reduce((s, k) => s + k.strength, 0) * 0.12;
      if (town.siege < town.walls) continue;
      // The town falls.
      const by = besiegers[0].realm;
      const old = town.owner;
      town.owner = by;
      town.siege = 0;
      town.walls = Math.max(1, town.walls - 1);
      world.version++;
      note(`${titled(town.name)} falls to ${titled(by.short)}`, town.x, town.y - 30, by.ink, 'high');
      emit('captured', town.x, town.y, 0.7);
      if (r() < 0.3) {
        town.burned = world.t;
        world.blots.push({ kind: 'burn', x: town.x, y: town.y, t0: world.t, color: '#3b2a1a', seed: Math.floor(r() * 1e6) });
        emit('burned', town.x, town.y, 0.5);
      }
      if (town.capital && old.capital === town) {
        // A seat taken: that realm is out of the war.
        old.out = true;
        note(`${titled(old.name)} yields`, town.x, town.y + 40, old.ink, 'high');
        emit('yields', town.x, town.y, 0.8);
      }
    }
  }

  // ---- the turn of the months ---------------------------------------------------------------

  let monthsAtWar = 0;
  function newMonth() {
    world.month = (world.month + 1) % 12;
    if (world.month === 0) world.year++;
    monthsAtWar++;
    const winter = WINTER.has(world.month);
    if (winter && !world.winter) {
      note('Winter quarters', world.W * 0.5, world.H * 0.86, '#334155', 'medium');
      emit('winter', world.W / 2, world.H / 2, 0.4);
    }
    if (!winter && world.winter) {
      note(`${titled(MONTHS[world.month])}, ${world.year}. The roads open`, world.W * 0.5, world.H * 0.86, '#3b2a1a', 'low');
      emit('spring', world.W / 2, world.H / 2, 0.3);
    }
    world.winter = winter;
    if (winter) return;
    // Levies: each realm raises a token at its seat now and then, more with more towns.
    for (const realm of world.realms) {
      if (realm.out || !realm.capital || realm.capital.owner !== realm) continue;
      const held = world.towns.filter((t) => t.owner === realm).length;
      if (r() < 0.12 + held * 0.015 && live().filter((k) => k.realm === realm).length < 8) {
        token(realm, realm.capital, 1 + Math.floor(r() * 2), r() < 0.35 ? 'horse' : 'foot');
        emit('levy', realm.capital.x, realm.capital.y, 0.25);
      }
    }
    // Now and then: plague in a camp, a town that turns its coat, a dragon.
    if (r() < 0.04) {
      const camp = live().filter((k) => k.strength > 1)[Math.floor(r() * live().length)];
      if (camp) {
        camp.strength -= 1;
        world.blots.push({ kind: 'plague', x: camp.x, y: camp.y, t0: world.t, color: '#57534e', seed: Math.floor(r() * 1e6) });
        note('Sickness in the camp', camp.x, camp.y + 32, '#3b2a1a', 'low');
        emit('sickness', camp.x, camp.y, 0.35);
      }
    } else if (r() < 0.03) {
      const t = world.towns.filter((x) => !x.capital && x.siege > 0)[0] ?? world.towns.filter((x) => !x.capital)[Math.floor(r() * world.towns.length)];
      const to = world.realms.filter((x) => t && x !== t.owner && !x.out)[0];
      if (t && to) {
        t.owner = to;
        t.siege = 0;
        world.version++;
        note(`${titled(t.name)} turns its coat`, t.x, t.y - 30, to.ink, 'high');
        emit('betrayal', t.x, t.y, 0.6);
      }
    } else if (r() < 0.012 * opts.dragons && !world.dragon) {
      const prey = world.towns[Math.floor(r() * world.towns.length)];
      if (prey) {
        const fromLeft = r() < 0.5;
        world.dragon = { x: fromLeft ? -60 : world.W + 60, y: world.H * (0.2 + r() * 0.5), tx: prey.x, ty: prey.y, t0: world.t, target: prey };
        note('Here be dragons', fromLeft ? 90 : world.W - 90, world.dragon.y - 30, '#5e2015', 'high');
        emit('dragon', world.dragon.x, world.dragon.y, 0.8);
      }
    }
    orders();
    // The end of the war.
    const standing = world.realms.filter((x) => !x.out);
    if (world.sealed < 0 && (standing.length <= 1 || monthsAtWar > 30 + r() * 12)) seal(standing);
  }

  function seal(standing: Realm[]) {
    world.sealed = world.t;
    const winner = standing.length === 1 ? standing[0] : [...standing].sort((a, b) => world.towns.filter((t) => t.owner === b).length - world.towns.filter((t) => t.owner === a).length)[0];
    const x = world.W * 0.72;
    const y = world.H * 0.7;
    world.blots.push({ kind: 'seal', x, y, t0: world.t, color: winner.color, seed: Math.floor(r() * 1e6), text: winner.short });
    note(`The Peace of ${titled(world.name)}, ${titled(MONTHS[world.month])} ${world.year}${standing.length === 1 ? `. ${titled(winner.short)} has won` : ''}`, x, y + 56, '#3b2a1a', 'high');
    emit('peace', x, y, 0.8);
  }

  function dragonStep(dt: number) {
    const d = world.dragon;
    if (!d) return;
    const dx = d.tx - d.x;
    const dy = d.ty - d.y;
    const len = Math.hypot(dx, dy);
    if (len > 6) {
      d.x += (dx / len) * 80 * dt;
      d.y += (dy / len) * 80 * dt;
      return;
    }
    if (d.target) {
      const t = d.target;
      t.burned = world.t;
      t.walls = 1;
      world.blots.push({ kind: 'dragon', x: t.x, y: t.y, t0: world.t, color: '#5e2015', seed: Math.floor(r() * 1e6) });
      for (const k of live()) if (k.at === t && !k.to) k.strength = Math.max(0, k.strength - 2);
      for (const k of live()) if (k.strength <= 0) fall(k);
      note(`A dragon burned ${titled(t.name)}`, t.x, t.y - 34, '#5e2015', 'high');
      emit('dragonfire', t.x, t.y, 0.85);
      d.target = null;
      d.tx = d.x < world.W / 2 ? world.W + 80 : -80;
      d.ty = d.y - 100;
    } else world.dragon = null;
  }

  // ---- the frame -----------------------------------------------------------------------------

  function step(dt: number) {
    world.t += dt * Math.max(0.3, opts.pace);
    if (world.sealed >= 0) {
      if (world.t - world.sealed > 9) {
        world.n++;
        monthsAtWar = 0;
        newCampaign();
        nextMonth = world.t + MONTH;
      }
      return;
    }
    if (world.t >= nextMonth) {
      nextMonth = world.t + MONTH;
      newMonth();
    }
    moves();
    sieges(dt * Math.max(0.3, opts.pace));
    dragonStep(dt);
    // Battles on the road: tokens of enemies that pass each other.
    const moving = live().filter((k) => k.to);
    for (let i = 0; i < moving.length; i++) {
      for (let j = i + 1; j < moving.length; j++) {
        const a = moving[i];
        const b = moving[j];
        if (a.realm === b.realm || Math.hypot(a.x - b.x, a.y - b.y) > 14) continue;
        if (a.fallenAt >= 0 || b.fallenAt >= 0 || !a.to || !b.to) continue;
        note('Ambush on the road', (a.x + b.x) / 2, (a.y + b.y) / 2 + 28, '#3b2a1a', 'medium');
        emit('ambush', a.x, a.y, 0.5);
        // Both stop: each counts as at whichever end of its road it was nearer.
        for (const k of [a, b]) {
          if (k.k > 0.5) k.at = k.to!;
          k.to = null;
          k.route = [];
        }
        battle(b, a);
      }
    }
    for (let i = world.tokens.length - 1; i >= 0; i--) if (world.tokens[i].fallenAt >= 0 && world.t - world.tokens[i].fallenAt > 3) world.tokens.splice(i, 1);
    for (let i = world.notes.length - 1; i >= 0; i--) if (world.t - world.notes[i].t0 > 26) world.notes.splice(i, 1);
  }

  newCampaign();
  // The first orders are given at once, so the opening frames have arrows in ink.
  orders();
  return world;
}
