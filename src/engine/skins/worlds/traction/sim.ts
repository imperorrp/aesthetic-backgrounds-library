/**
 * # Traction: predator cities on tracks hunt the smaller towns across a churned-up plain.
 *
 * On screen, at a glance: a colossal traction city, tiers stacked like a wedding cake (furnaces
 * and chimneys at the bottom, tenements, terraces, gardens, a cathedral on the crown), grinding
 * over the mud on giant caterpillar tracks with its jaws at the front; smaller towns on wheels and
 * tracks roaming round it, and fleeing; airships flitting; crows; mud thrown up by the tracks;
 * ruins of the ancient world sticking out of the mud; a great shield-wall on the mountains far
 * away, with the static settlements behind it.
 * The camera: alongside the city, as if from a scout airship flying with it: the plain slides
 * past, near mud fast and the far wall slowly. The whole scene, always. (Or, with view=map, the
 * same hunt plotted on the navigator's survey chart.)
 *
 * Always happening (the floor):
 * - The city grinds forward: its tracks turning, its tiers swaying, smoke from every chimney,
 *   thousands of windows lit at night; tread marks behind it in the mud.
 * - Towns come over the horizon and roam the plain; traders' airships cross and tie up at the
 *   city's air-quay; crows follow the city; the radio talks.
 * - The hunt (build-up, climax, aftermath): the lookouts sight a town and the rangefinders lock on
 *   it; the horn; the city speeds up and the town runs. The city opens its jaws, takes the town and
 *   drags it into its gut, where it is stripped and vanishes; the city slows to digest, its gut
 *   glowing, and a new chimney is lit (and smokes for the rest of the day). The towns that saw it
 *   scatter. Or the town gets away: over the ridge, or simply faster.
 *
 * The cast (each seed draws some; tags):
 * - raid [threat] the Static Accord (the anti-traction league) strikes from the air: the lookouts
 *   call the formation, then rockets, flak, fires on the tiers, an airship down in flames; the
 *   fires leave burnt scars on the tiers that are patched, slowly, under scaffolding.
 * - duel [threat] a rival city comes up out of the haze; broadsides; one breaks off, burning.
 * - bulwark [threat, rare] the city strays in range of the shield-wall: a ranging shot, then
 *   salvos walking in across the plain; shell craters left on the ground; the city veers off.
 * - front [weather] a weather front (a blizzard on the snow): rain, lightning, the plain turned to
 *   soup, standing water in every rut long after.
 * - lights [night] by night the city's searchlights sweep the plain, and what they find it hunts.
 * - breakdown [life] a town throws a track and stops; its crew work at it; it limps on, or not.
 * - harbour [trade] a sky harbour floats near; the city sells its salvage there, traders to and fro.
 * - relic [wonder, legendary] the ground heaves and something colossal of the ancient world comes up.
 * - scavengers [life] spider-legged scavenger towns follow in the city's tracks.
 * - herd [life] a herd of suburbs scatters across the plain before the city's horn.
 * Quotas: 4–6 in all; 1–2 threats; 0–1 weather.
 *
 * Events: common: a town over the horizon, a trader at the air-quay, a chase, a town eaten or
 * away; uncommon: a raid, a front, a breakdown, a sale at the sky harbour, searchlights find a
 * town; rare: an airship shot down, a duel, the shield-wall's guns, a herd; legendary: a relic.
 * What keeps it going: new towns always arrive over the horizon; the city never stops; every town
 * eaten is a new chimney and every raid a scar, and the plain behind is lost to sight as new plain
 * comes up ahead.
 * What changes with the seed: the city (its name, tiers, crown, tracks, colours, which way it
 * goes), the land (mud, salt flat, steppe, snow) and the air (ochre, ash, rust, peat), the hour it
 * starts, the ruins, the cast and so which events can happen at all, the names.
 * A touch: on a town, the lookouts see it too and the city turns for it; on the mud, a flare goes
 * up and a town comes to see; in the sky, the crows scatter.
 * Phone: the same plain, the city filling the width, fewer towns and ships.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import { CITY_NAMES, cityPlan, HARBOUR_NAMES, LEAGUE_NAMES, REGIONS, SCAV_NAMES, strikePoint, TOWN_NAMES, TRADER_NAMES } from './design';
import type { City, CityTop, Ctx, Fx, FxKind, Land, Mood, RelicKind, Ship, ShipKind, Town, TownKind, TractionOptions, TractionWorld } from './types';

const DAY_LEN = 900;
const LINES = {
  lookout: ['All quiet on the plain.', 'Tracks steady. Full ahead.', 'Nothing on the horizon but mud.', 'Wind from the west, smoke clear of the tiers.', 'The Gut reports all furnaces lit.', 'Tier three, keep those lamps trimmed.', 'The Lord Mayor wants meat by nightfall.', 'Steer two points to starboard.', 'Mind the old ruts, they\'ll throw a track.'],
  hunt: ['Town to the fore! All tracks to full!', 'Stoke the furnaces!', 'Open the jaws!', 'Don\'t lose her in the mud.', 'She\'s running. Let her run.', 'Range closing. Steady.'],
  prey: ['It\'s seen us! Run!', 'More coal! More coal!', 'Dump the ballast!', 'All hands to the engines!', 'Run for the ridge!', 'It\'s gaining on us.', 'Look at the size of it…'],
  roam: ['Fine weather for moving.', 'Tracks holding up.', 'Keep well clear of the big one.', 'Trade tomorrow, if we live.', 'Mud\'s deep out here.', 'Steer wide of the ruins.', 'Fuel for two days, no more.'],
  trader: ['Salt and springs, bound east.', 'Fair winds and a good price.', 'Watch the updraught off those chimneys.', 'Trading at the air-quay within the hour.', 'Gas cells holding.', 'No guns aboard. Honest traders.'],
  league: ['For the Accord!', 'Rockets away!', 'Go for the engines.', 'Break left, break left!', 'Flak! Take her up!', 'No more towns go into that gut.'],
  broken: ['The track\'s gone!', 'Get the crews out.', 'We\'re sitting ducks out here.', 'How long to fix it?', 'Hammer it, then!'],
};

export function createTraction(seed: string | number, W: number, H: number, opts: TractionOptions): TractionWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'traction');
  const shotR: Rng = forkRng(seed, 'traction-shots');
  const g: Genome = createGenome(seed, 'traction');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const phone = GW < GH;
  const traffic = Math.max(0.3, Math.min(2.5, opts.traffic));
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];
  let ids = 1;

  const mood = g.weighted<Mood>({ ochre: 4, ash: 3, rust: 3, peat: 2 });
  const land = g.weighted<Land>({ mud: 5, salt: 2, steppe: 3, snow: 2 });
  const HY = Math.round(GH * (phone ? 0.5 : g.range(0.43, 0.47)));
  const NY = Math.round(GH * 0.93);
  const M0 = 0.13;
  const cl = (d: number) => Math.min(1, d);
  const yOf = (d: number) => HY + (NY - HY) * Math.pow(1 - cl(d), 2);
  const mOf = (d: number) => M0 + (1 - M0) * Math.pow(1 - cl(d), 2);
  const sx = (gx: number, d: number) => GW / 2 + (gx - world.scroll) * mOf(d);
  /** Back from the picture to the plain. */
  const dOfY = (y: number) => 1 - Math.sqrt(Math.max(0, (y - HY) / (NY - HY)));
  const dir: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const cityD = phone ? 0.28 : 0.3;
  const mC = mOf(cityD);
  const cityLen = (GW * (phone ? 0.86 : 0.56)) / mC;
  const top = g.weighted<CityTop>({ cathedral: 4, dome: 3, spires: 2, ziggurat: 2 });
  const city: City = {
    id: ids++, name: g.pick(CITY_NAMES), gx: 0, d: cityD, dir, speed: 16 * u, cruise: 16 * u * g.range(0.85, 1.2), len: cityLen, tiers: Number(g.weighted({ 4: 2, 5: 4, 6: 2 } as Record<string, number>)), top,
    tracks: Number(g.weighted({ 2: 2, 3: 4, 4: 1 } as Record<string, number>)),
    seed: Math.floor(g.unit() * 1e6), pop: Math.round(g.range(40, 120)) * 1000, eaten: 0, chimneys: g.int(4, 6), jaw: 0, gut: 0.2, tread: 0,
    state: 'roam', t0: 0, hurt: 0, fires: [], scars: [], gunT: -99, hornT: -99, beams: [], rival: false, line: '', lineT: -99,
  };
  const plan = cityPlan(city.seed, city.tiers, city.top, city.tracks);
  /** Ground units per city unit. */
  const cu = (c: City) => c.len / 1000;
  const ridgeD = g.range(0.66, 0.74);
  const T = (s: string) => s.toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase()).replace(/'S\b/g, "'s");
  const CN = T(city.name);

  // eslint-disable-next-line prefer-const
  let world: TractionWorld;
  world = {
    t: 0, W, H, GW, GH, u, phone, bus,
    director: createDirector(forkRng(seed, 'traction-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    region: g.pick(REGIONS), mood, land, cast: [], castIds: [],
    day: g.range(0.3, 0.72), dayLen: DAY_LEN,
    HY, NY, ridgeD, scroll: 0, sunSide: g.chance(0.5) ? 1 : -1,
    yOf, mOf, sx,
    city, rival: null, towns: [], ships: [], harbour: null, flocks: [], fx: [], relics: [], wrecks: [], trails: [], craters: [], bulwark: { t: -99, k: 0 },
    rain: 0, wind: g.range(-1, 1) * 8, flash: 0, wet: land === 'salt' ? 0.1 : g.range(0.2, 0.5),
    hunt: { phase: 'none', town: -1, t0: 0, outcome: 'catch' },
    eatenTotal: 0, escaped: 0,
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    labels: [], beats: [], radio: [], chronicle: [],
    step, nudge,
    counts: () => ({
      towns: world.towns.filter((q) => q.state !== 'gone' && q.state !== 'eaten').length,
      ships: world.ships.length,
      eaten: world.eatenTotal,
      chimneys: city.chimneys,
      scars: city.scars.length,
      relics: world.relics.length,
      flocks: world.flocks.length,
      fx: world.fx.length,
      fires: city.fires.length,
      trails: world.trails.length,
    }),
  };

  // ---- the verbs -----------------------------------------------------------------------------------
  const cityY = (c: City, ly: number) => yOf(c.d) + ly * cu(c) * mOf(c.d);
  const cityX = (c: City, lx: number) => sx(c.gx + c.dir * lx * cu(c), c.d);
  const cityGx = (c: City, lx: number) => c.gx + c.dir * lx * cu(c);
  function establish(): { x: number; y: number; zoom: number } {
    if (world && shotR() < 0.55) return { x: cityX(city, 200), y: cityY(city, -260), zoom: 1.7 };
    return { x: GW / 2, y: GH / 2, zoom: 1 };
  }
  const say = (text: string, gx: number, d: number, kicker?: string) => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 8)) return;
    const x = sx(gx, d);
    const y = yOf(d);
    world.labels.push({ text, x, y, gx, d, t0: world.t, color: kicker ? '#fcd9a0' : '#efe6d2' });
    if (world.labels.length > 8) world.labels.shift();
    if (kicker) {
      world.beats.push({ kicker, text, t0: world.t, gx, d });
      if (world.beats.length > 6) world.beats.shift();
    }
    bus.emit({ type: 'say', text, x, y, priority: kicker ? 'high' : 'medium' });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, day: world.day, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };
  const speak = (who: { name: string; line: string; lineT: number }, line: string) => {
    who.line = line;
    who.lineT = world.t;
    world.radio.push({ who: T(who.name), text: line, t0: world.t });
    if (world.radio.length > 8) world.radio.shift();
    bus.emit({ type: 'radio', text: line, weight: 0.05, priority: 'low' });
  };
  const look = (why: string, gx: number, d: number, alt: number, zoom: number, hold: number, priority: number) => world.director.look(why, sx(gx, d), yOf(d) - alt * mOf(d), zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: FxKind, gx: number, d: number, alt: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 700) return;
    world.fx.push({ kind, gx, d, alt, vx: 0, valt: 0, t0: world.t, dur: 2, r: 10 * u, color: '#6a5a48', seed: Math.floor(r() * 1e6), on: 0, ...extra });
  };
  const whenWords = (d: number) => (d < 0.21 ? 'in the night' : d < 0.3 ? 'at dawn' : d < 0.46 ? 'in the morning' : d < 0.54 ? 'at noon' : d < 0.7 ? 'in the afternoon' : d < 0.78 ? 'at dusk' : d < 0.9 ? 'in the evening' : 'in the night');
  const night = () => world.day < 0.23 || world.day > 0.79;
  /** The visible ground span at a depth, in ground x: [left, right]. */
  const span = (d: number): [number, number] => [world.scroll - GW / 2 / mOf(d), world.scroll + GW / 2 / mOf(d)];
  const ahead = (d: number, k: number) => world.scroll + dir * k * (GW / 2 / mOf(d));
  const usedNames = new Set<string>();
  const freshName = (list: readonly string[]) => {
    for (let k = 0; k < 8; k++) {
      const n = pick(list);
      if (!usedNames.has(n)) {
        usedNames.add(n);
        if (usedNames.size > 18) usedNames.delete(usedNames.values().next().value as string);
        return n;
      }
    }
    return pick(list);
  };

  function spawnTown(kind: TownKind, gx: number, d: number, extra: Partial<Town> = {}): Town {
    const small = kind === 'suburb';
    const len = cityLen * (small ? 0.07 + r() * 0.03 : kind === 'scav' ? 0.11 + r() * 0.04 : 0.1 + r() * 0.12);
    const speed = (kind === 'suburb' ? 22 : kind === 'scav' ? 18 : kind === 'sail' ? 20 : 12) * u * (0.8 + r() * 0.4);
    const tw: Town = {
      id: ids++, name: freshName(kind === 'scav' ? SCAV_NAMES : TOWN_NAMES), kind, gx, d, vx: 0, vd: 0, speed, dir: r() < 0.5 ? 1 : -1, state: 'arrive', t0: world.t,
      len, tiers: small ? 1 : kind === 'scav' ? 1 + Math.floor(r() * 2) : 1 + Math.floor(r() * 3), pop: Math.round((small ? 200 : 600) + r() * (small ? 600 : 4000)), seed: Math.floor(r() * 1e6),
      eat: 0, run: 'none', top: speed * 1.6, smoke: 0, roll: r() * 10, line: '', lineT: -99, ...extra,
    };
    tw.vx = tw.dir * tw.speed;
    world.towns.push(tw);
    world.trails.push({ id: tw.id, w: tw.len * 0.035, gauge: 0.006, pts: [[tw.gx, tw.d]], tread: tw.kind === 'tracked' || tw.kind === 'mining' });
    return tw;
  }
  function spawnShip(kind: ShipKind, gx: number, d: number, alt: number, extra: Partial<Ship> = {}): Ship {
    const big = kind === 'hauler' || kind === 'league';
    const s: Ship = {
      id: ids++, name: freshName(kind === 'league' || kind === 'gunboat' ? LEAGUE_NAMES : TRADER_NAMES), kind, gx, d, alt, vx: 0, dir: 1, state: 'cruise', t0: world.t,
      len: (big ? 150 : kind === 'balloon' ? 60 : kind === 'gunboat' ? 80 : 110) * u * (0.85 + r() * 0.3), seed: Math.floor(r() * 1e6), tx: gx, td: d, talt: alt, fire: 0, bob: r() * 6, line: '', lineT: -99, ...extra,
    };
    world.ships.push(s);
    return s;
  }
  const ctx: Ctx = { world, r, say, emit, chronicle, speak, look, after, town: spawnTown, ship: spawnShip, fx };
  const townX = (t: Town) => sx(t.gx, t.d);
  const townY = (t: Town) => yOf(t.d);
  const cityFront = (c: City) => c.gx + c.dir * c.len * 0.5;
  /** The gap from the city's jaws to a town's tail, along the way it goes. */
  const gapTo = (c: City, t: Town) => c.dir * (t.gx - c.dir * t.len * 0.5 - cityFront(c));
  const onScreen = (gx: number, d: number, pad = 0) => {
    const x = sx(gx, d);
    return x > -pad && x < GW + pad;
  };
  const prey = (t: Town) => t.state === 'roam' && t.kind !== 'scav' && t.len < cityLen * 0.2 && t.d > 0.08 && t.d < ridgeD - 0.04 && gapTo(city, t) > city.len * 0.06 && onScreen(t.gx, t.d, -30 * u);
  /** Burn a scar where a fire was; scars are patched, slowly, under scaffolding. */
  const scar = (c: City, lx: number, ly: number, rr: number) => {
    c.scars.push({ lx, ly, r: rr, t0: world.t });
    if (c.scars.length > 24) c.scars.shift();
  };

  // ---- the hunt ------------------------------------------------------------------------------------
  const hunt = world.hunt;
  let lastAte = -99;
  function startHunt(t: Town, outcome: 'catch' | 'escape', why: string) {
    Object.assign(hunt, { phase: 'sighted', town: t.id, t0: world.t, outcome });
    t.state = 'flee';
    t.t0 = world.t;
    t.run = outcome === 'catch' ? 'none' : t.d > cityD + 0.12 || r() < 0.5 ? 'ridge' : 'ahead';
    t.top = outcome === 'catch' ? city.cruise * 2.4 * (0.62 + r() * 0.12) : city.cruise * 2.4 * (1.15 + r() * 0.2);
    city.state = 'hunt';
    city.hornT = world.t;
    say(why, t.gx, t.d, 'The hunt');
    emit('sighted', townX(t), townY(t), 0.6);
    emit('horn', cityX(city, 0), cityY(city, -300), 0.4);
    speak(city, pick(LINES.hunt));
    after(3, () => speak(t, pick(LINES.prey)));
    look('sighted', (t.gx + city.gx) / 2, cityD, city.len * 0.3, 1.3, 10, 6);
    for (const f of world.flocks) f.scatter = world.t;
  }
  function huntStep(dt: number) {
    const t = world.towns.find((q) => q.id === hunt.town);
    if (hunt.phase === 'none') {
      if (city.state === 'roam' && world.t > 14 && !world.rival && world.t - lastAte > 40) {
        const cands = world.towns.filter(prey);
        const easy = cands.find((q) => q.smoke > 0.5);
        if ((easy || cands.length) && world.director.want('chase', easy ? 0.3 : 0.5, easy ? 40 : 60)) {
          const tg = easy ?? cands.sort((a, b) => gapTo(city, a) - gapTo(city, b))[0];
          startHunt(tg, easy || r() < 0.62 ? 'catch' : 'escape', easy ? `${CN} smells a crippled town: ${T(tg.name)}` : `${CN}'s lookouts sight ${T(tg.name)}`);
        } else if (!cands.length && world.towns.filter((q) => q.state === 'arrive' || q.state === 'roam').length < 7 && world.director.want('lure', 0.15, 45)) {
          // Nothing to hunt in sight: one comes over the horizon ahead.
          const d = 0.45 + r() * 0.15;
          const tw = spawnTown(r() < 0.3 ? 'suburb' : r() < 0.5 ? 'tracked' : 'wheeled', ahead(0.97, 0.3 + r() * 0.4), 0.97, { state: 'arrive', vd: -0.014 });
          tw.dir = dir;
          tw.vx = dir * tw.speed * 0.5;
          (tw as Town & { goal?: number }).goal = d;
          say(`${T(tw.name)} comes over the horizon`, tw.gx, tw.d);
          emit('arrive', townX(tw), townY(tw), 0.3);
        }
      }
      return;
    }
    if (!t || t.state === 'gone') {
      endHunt();
      return;
    }
    const age = world.t - hunt.t0;
    const gap = gapTo(city, t);
    if (hunt.phase === 'sighted') {
      city.speed += (city.cruise * 1.3 - city.speed) * dt * 0.5;
      if (age > 4) {
        hunt.phase = 'chase';
        hunt.t0 = world.t;
        city.state = 'chase';
        say(`${T(t.name)} runs for it`, t.gx, t.d);
        emit('chase', townX(t), townY(t), 0.7);
      }
    } else if (hunt.phase === 'chase') {
      city.speed += (city.cruise * 2.4 - city.speed) * dt * 0.25;
      if (hunt.outcome === 'catch') {
        // It cannot outrun her: she steers onto its line and closes.
        t.d += (cityD - 0.014 - t.d) * dt * 0.12;
        if (gap < city.len * 0.35 && city.jaw < 0.05 && age > 6) {
          city.jaw = 0.06;
          say(`${CN} opens its jaws`, cityFront(city), cityD, 'The hunt');
          emit('jaws', cityX(city, 470), cityY(city, -120), 0.7);
          look('jaws', cityGx(city, 250), cityD, city.len * 0.28, 1.4, 14, 8);
        }
        if (t.smoke < 0.3 && gap < city.len * 0.5 && age > 10 && r() < dt * 0.15) {
          t.top *= 0.8;
          t.smoke = 0.4;
          speak(t, pick(['The engines! She\'s losing steam!', 'We\'ve blown a boiler!', 'No more coal!']));
          emit('falter', townX(t), townY(t), 0.3);
        }
        if (gap <= 0) {
          hunt.phase = 'jaws';
          hunt.t0 = world.t;
          t.state = 'caught';
          t.t0 = world.t;
          t.d = cityD - 0.012;
          say(`The jaws of ${CN} close on ${T(t.name)}`, cityFront(city), cityD, 'The hunt');
          emit('caught', cityX(city, 470), cityY(city, -120), 1);
          look('caught', cityGx(city, 250), cityD, city.len * 0.28, 1.5, 16, 9);
          speak(t, 'We\'re taken! We\'re taken!');
          world.director.note(0.4);
        } else if (age > 110) {
          hunt.outcome = 'escape';
          t.top = city.cruise * 3;
        }
      } else {
        if (t.run === 'ridge') t.d += (ridgeD + 0.06 - t.d) * dt * 0.05;
        if (t.smoke < 0.1 && age > 8 && r() < dt * 0.1) {
          t.smoke = 0.12;
          speak(t, 'Dump the ballast! Everything overboard!');
          say(`${T(t.name)} dumps its ballast and pulls ahead`, t.gx, t.d);
          emit('ballast', townX(t), townY(t), 0.4);
          for (let k = 0; k < 10; k++) fx('debris', t.gx - t.dir * t.len * 0.4, t.d, 30 * u, { vx: -t.dir * (10 + r() * 20) * u + t.vx, valt: (20 + r() * 30) * u, dur: 2.5, r: 4 * u, color: '#3a2e24' });
        }
        const hidden = t.d > ridgeD + 0.01;
        if (hidden || gap > (GW / mOf(t.d)) * 0.6 || age > 120) escape(t, hidden ? `${T(t.name)} escapes over the ridge` : `${T(t.name)} outruns ${CN}`);
      }
    } else if (hunt.phase === 'jaws') {
      // Dragged up the lower jaw and into the gut.
      t.eat = Math.min(1, age / 9);
      city.speed += (city.cruise * 0.8 - city.speed) * dt * 0.5;
      t.gx = cityFront(city) + city.dir * t.len * (0.5 - t.eat * 1.15);
      if (r() < dt * 12) fx('spark', cityFront(city) - city.dir * 20 * u, cityD - 0.01, (40 + r() * 50) * u, { vx: (r() - 0.5) * 60 * u, valt: (20 + r() * 50) * u, dur: 0.8, r: 2 * u, color: '#ffd27a' });
      if (t.eat >= 1) {
        hunt.phase = 'gut';
        hunt.t0 = world.t;
        t.state = 'eaten';
        say(`${T(t.name)} is dragged into the gut`, cityGx(city, 380), cityD);
        emit('gut', cityX(city, 380), cityY(city, -140), 0.6);
        speak(city, pick(['Strip her! Every rivet!', 'Gut crews to the new arrival.', 'A fine fat meal.']));
      }
    } else if (hunt.phase === 'gut') {
      // Stripped in the gut: the furnaces roar, sparks out of every vent; she slows to digest.
      city.gut = Math.min(1, city.gut + dt * 0.3);
      city.speed += (city.cruise * 0.6 - city.speed) * dt * 0.3;
      if (r() < dt * 8) fx('spark', (r() - 0.5) * 800, cityD - 0.012, 200 + r() * 40, { vx: (r() - 0.5) * 60, valt: 40 + r() * 60, dur: 1.2, r: 2 * u, color: '#ffb050', on: city.id });
      if (age > 16) {
        hunt.phase = 'strip';
        hunt.t0 = world.t;
        city.chimneys = Math.min(plan.chimneys.length, city.chimneys + 1);
        city.eaten++;
        world.eatenTotal++;
        city.pop += Math.round(t.pop * 0.6);
        lastAte = world.t;
        const [lx] = plan.chimneys[city.chimneys - 1] ?? [0, -300];
        say(`A new chimney is lit on ${CN}`, cityGx(city, lx), cityD, 'Aftermath');
        emit('chimney', cityX(city, lx), cityY(city, -300), 0.6);
        look('chimney', cityGx(city, lx * 0.5), cityD, city.len * 0.3, 1.4, 10, 7);
        chronicle(`Ate the town of ${T(t.name)} ${whenWords(world.day)}; ${t.pop.toLocaleString('en-GB')} souls taken aboard.`);
        world.towns = world.towns.filter((q) => q !== t);
        world.trails = world.trails.filter((q) => q.id !== t.id);
        // The towns that saw it scatter.
        for (const q of world.towns) if (q.state === 'roam' && q.kind !== 'scav' && onScreen(q.gx, q.d)) {
          q.vx = (dir * (q.gx - city.gx) > 0 ? dir : -dir) * q.speed * 1.6;
          q.dir = q.vx > 0 ? 1 : -1;
          q.vd = 0.004 + r() * 0.004;
        }
      }
    } else if (hunt.phase === 'strip') {
      city.gut = Math.max(0.2, city.gut - dt * 0.05);
      if (age > 12) endHunt();
    }
  }
  function escape(t: Town, line: string) {
    t.state = 'escaped';
    t.t0 = world.t;
    world.escaped++;
    say(line, t.gx, t.d, 'The hunt');
    emit('escaped', townX(t), townY(t), 0.6);
    chronicle(`${T(t.name)} got away ${whenWords(world.day)}.`);
    speak(city, pick(['Let it go. There\'s always another.', 'Blast it! All tracks slow.', 'The Lord Mayor will not be pleased.']));
    endHunt();
  }
  function endHunt() {
    Object.assign(hunt, { phase: 'none', town: -1, t0: world.t });
    if (city.state !== 'duel') city.state = 'roam';
  }

  // ---- the cast library ---------------------------------------------------------------------------
  const LIBRARY: SystemDef<Ctx>[] = [
    {
      id: 'raid', label: 'raids of the Accord', weight: 6, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        let raiders: Ship[] = [];
        let slots: [number, number][] = [];
        let t0 = 0;
        let phase: 'none' | 'warn' | 'attack' = 'none';
        let downed = 0;
        let nextShot = 0;
        let burning = false;
        return {
          id: 'raid',
          step(dt) {
            // The aftermath: fire crews at work until the last fire is out.
            if (burning && phase === 'none' && !city.fires.length) {
              burning = false;
              c.say(`The last fire on ${CN} is out; the scars stay`, city.gx, cityD);
              c.emit('fireout', cityX(city, 0), cityY(city, -300), 0.2);
            }
            if (phase === 'none') {
              if (w.t < 70 || hunt.phase === 'jaws' || hunt.phase === 'gut' || w.rival || !w.director.want('raid', 0.7, 300)) return;
              const n = phone ? 2 : 3 + Math.floor(c.r() * 2);
              t0 = w.t;
              downed = 0;
              phase = 'warn';
              const side: 1 | -1 = c.r() < 0.5 ? 1 : -1;
              const d = cityD + 0.02 + c.r() * 0.06;
              raiders = [];
              slots = [];
              for (let k = 0; k < n; k++) {
                // A V: the lead, and the others stepped back (away from the city) and down, either side.
                const rank = Math.ceil(k / 2);
                const sl: [number, number] = k === 0 ? [0, 0] : [side * rank * 140 * u, (k % 2 ? 1 : -1) * rank * 45 * u - rank * 20 * u];
                slots.push(sl);
                const s = c.ship(k === 0 || c.r() < 0.4 ? 'league' : 'gunboat', w.scroll + side * (GW / 2 / mOf(d) + 150 * u) + sl[0], d, (560 + c.r() * 60) * u + sl[1], { state: 'attack', dir: side > 0 ? -1 : 1 });
                s.tx = city.gx + side * city.len * 0.35;
                s.talt = 580 * u;
                raiders.push(s);
              }
              const lead = raiders[0];
              c.say(`Airships off the ${side === dir ? 'bow' : 'stern'}: the Static Accord`, lead.gx, lead.d, 'The raid');
              c.emit('raidwarn', sx(lead.gx, lead.d), yOf(lead.d) - lead.alt * mOf(lead.d), 0.6);
              c.after(1, () => c.speak(city, 'Action stations! All guns to the sky!'));
              return;
            }
            const age = w.t - t0;
            raiders = raiders.filter((s) => w.ships.includes(s));
            const live = raiders.filter((s) => s.state === 'attack');
            // Formation: the lead flies the run, the rest hold their slots until the attack breaks up.
            const lead = live[0];
            if (lead && age < 12) {
              for (const [i, s] of raiders.entries()) {
                if (s === lead || s.state !== 'attack') continue;
                s.tx = lead.tx + slots[i][0];
                s.talt = lead.talt + slots[i][1];
              }
            }
            if (phase === 'warn' && age > 8) {
              phase = 'attack';
              c.say(`The Accord's airships strike at ${CN}`, city.gx, cityD, 'The raid');
              c.emit('raid', cityX(city, 0), cityY(city, -400), 0.9);
              c.look('raid', city.gx, cityD, 420 * u, 1.4, 16, 8);
              c.speak(lead ?? city, pick(LINES.league, c.r));
            }
            if (phase === 'attack' && age > 12 && age < 13) {
              for (const s of live) {
                s.tx = city.gx + (c.r() - 0.5) * city.len * 0.9;
                s.talt = (380 + c.r() * 260) * u;
              }
            }
            if (phase === 'attack') {
              nextShot -= dt;
              if (live.length && nextShot <= 0 && age < 75) {
                nextShot = 1.6 + c.r() * 2.4;
                const s = pick(live, c.r);
                const [lx, ly] = strikePoint(plan, c.r(), c.r());
                c.fx('rocket', s.gx, s.d, s.alt, { dur: 1.6, r: 3 * u, color: '#ffcf80', vx: lx, valt: ly, on: city.id });
                c.emit('rocket', sx(s.gx, s.d), yOf(s.d) - s.alt * mOf(s.d), 0.25);
                if (c.r() < 0.25) c.speak(s, pick(LINES.league, c.r));
                c.after(1.6, () => {
                  city.fires.push({ lx, ly, t0: w.t, dur: 40 + c.r() * 50, r: 14 + c.r() * 16 });
                  city.hurt = Math.min(1, city.hurt + 0.05);
                  burning = true;
                  c.fx('flash', lx, cityD - 0.015, -ly, { dur: 0.6, r: 40 * u, on: city.id, color: '#ffd090' });
                  for (let k = 0; k < 6; k++) c.fx('debris', lx, cityD - 0.015, -ly, { vx: (c.r() - 0.5) * 60, valt: 20 + c.r() * 50, dur: 2, r: 3 * u, color: '#2a2420', on: city.id });
                  c.emit('hit', cityX(city, lx), cityY(city, ly), 0.45);
                });
              }
              if (live.length && c.r() < dt * 2.5) {
                const s = pick(live, c.r);
                city.gunT = w.t;
                c.fx('flak', s.gx + (c.r() - 0.5) * 120 * u, s.d, s.alt + (c.r() - 0.5) * 80 * u, { dur: 2.2, r: 14 * u, color: '#2a2622' });
                c.emit('flak', sx(s.gx, s.d), yOf(s.d) - s.alt * mOf(s.d), 0.1);
                if (s.fire === 0 && downed < 2 && c.r() < 0.06 && w.director.want('shotdown', 0.6, 60)) {
                  s.fire = 0.1;
                  c.emit('burning', sx(s.gx, s.d), yOf(s.d) - s.alt * mOf(s.d), 0.6);
                  c.speak(s, 'We\'re hit! Gas cells alight!');
                }
              }
              for (const s of live) {
                if (s.fire <= 0) continue;
                s.fire = Math.min(1, s.fire + dt * 0.15);
                if (s.fire > 0.6) {
                  s.state = 'fall';
                  s.t0 = w.t;
                  downed++;
                  c.say(`${T(s.name)} goes down in flames`, s.gx, s.d, 'The raid');
                  c.emit('shotdown', sx(s.gx, s.d), yOf(s.d) - s.alt * mOf(s.d), 0.9);
                  c.chronicle(`Shot down the Accord's ${T(s.name)} ${whenWords(w.day)}.`);
                }
              }
              if (age > 80 || (age > 24 && !live.length)) {
                for (const s of live) {
                  s.state = 'leave';
                  s.t0 = w.t;
                  s.tx = w.scroll + (c.r() < 0.5 ? 1 : -1) * GW * 2 / mOf(s.d);
                  s.talt = 700 * u;
                }
                if (live.length) {
                  c.say('The Accord\'s airships turn for home', live[0].gx, live[0].d, 'Aftermath');
                  c.emit('withdraw', GW / 2, HY - 120 * u, 0.3);
                }
                c.chronicle(`Raided by the Accord ${whenWords(w.day)}${city.fires.length ? `; ${city.fires.length} fire${city.fires.length === 1 ? '' : 's'} on the tiers` : ''}.`);
                raiders = [];
                phase = 'none';
              }
            }
          },
          counts: () => ({ raiders: raiders.length }),
        };
      },
    },
    {
      id: 'duel', label: 'a rival city', weight: 4, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        let shots = 0;
        let next = 0;
        return {
          id: 'duel',
          step(dt) {
            const rv = w.rival;
            if (!rv) {
              if (w.t < 150 || hunt.phase !== 'none' || !w.director.want('duel', 0.85, 900)) return;
              const d = 0.62 + c.r() * 0.05;
              const len = cityLen * (0.9 + c.r() * 0.25);
              const names = CITY_NAMES.filter((n) => n !== city.name);
              w.rival = {
                id: ids++, name: pick(names, c.r), gx: ahead(d, 1.3) + dir * len * 0.6, d: 0.92, dir: dir === 1 ? -1 : 1, speed: 0, cruise: city.cruise, len, tiers: 4 + Math.floor(c.r() * 2), top: pick(['cathedral', 'dome', 'spires', 'ziggurat'] as CityTop[], c.r), tracks: 2 + Math.floor(c.r() * 2),
                seed: Math.floor(c.r() * 1e6), pop: 60000, eaten: 0, chimneys: 5 + Math.floor(c.r() * 5), jaw: 0, gut: 0.3, tread: 0, state: 'duel', t0: w.t, hurt: 0, fires: [], scars: [], gunT: -99, hornT: w.t, beams: [], rival: true, line: '', lineT: -99,
              };
              (w.rival as City & { goalD?: number }).goalD = d;
              shots = 0;
              city.state = 'duel';
              city.hornT = w.t;
              c.say(`Another city on the horizon: ${T(w.rival.name)}`, w.rival.gx, w.rival.d, 'The duel');
              c.emit('duel', GW / 2, yOf(0.9), 0.9);
              c.after(3, () => c.speak(city, 'Beat to quarters! Guns to the fore!'));
              return;
            }
            const age = w.t - rv.t0;
            const goalD = (rv as City & { goalD?: number }).goalD ?? 0.62;
            if (rv.state === 'duel') {
              // Up out of the haze, head on; then alongside to trade broadsides.
              rv.d += (goalD - rv.d) * dt * 0.05;
              const rx = sx(rv.gx, rv.d);
              const want = GW * (0.5 + dir * 0.22);
              const k = (rx - want) * dir;
              rv.speed = k > 40 * u ? -dir * 4 * u : dir * city.speed;
              rv.gx += rv.speed * dt;
              if (k < 60 * u && rv.d < goalD + 0.03) {
                rv.dir = dir;
                next -= dt;
                if (next <= 0) {
                  next = 2 + c.r() * 2.5;
                  shots++;
                  if (shots === 1) {
                    c.say(`${CN} and ${T(rv.name)} trade broadsides`, rv.gx, rv.d, 'The duel');
                    c.look('duel', (rv.gx + city.gx) / 2, (rv.d + cityD) / 2, 300 * u, 1.3, 20, 8);
                  }
                  const fromRival = c.r() < 0.5;
                  const from = fromRival ? rv : city;
                  const to = fromRival ? city : rv;
                  const P = cityPlan(to.seed, to.tiers, to.top, to.tracks);
                  const [lx, ly] = strikePoint(P, c.r(), c.r());
                  const Pf = cityPlan(from.seed, from.tiers, from.top, from.tracks);
                  const gun = Pf.guns[Math.floor(c.r() * Pf.guns.length)];
                  from.gunT = w.t;
                  c.fx('shell', from.gx + from.dir * gun[0] * cu(from), from.d, -gun[1] * cu(from), { dur: 2.2, r: 3 * u, color: '#ffe0a0', vx: lx, valt: ly, on: to.id });
                  c.emit('broadside', sx(from.gx, from.d), yOf(from.d) - 200 * u * mOf(from.d), 0.4);
                  c.after(2.2, () => {
                    if (to.rival && w.rival !== to) return;
                    to.fires.push({ lx, ly, t0: w.t, dur: 50 + c.r() * 40, r: 14 + c.r() * 14 });
                    to.hurt = Math.min(1, to.hurt + (to.rival ? 0.09 : 0.04));
                    c.fx('flash', lx, to.d - 0.01, -ly, { dur: 0.7, r: 50 * u, on: to.id, color: '#ffd090' });
                    c.emit('hit', sx(to.gx + to.dir * lx * cu(to), to.d), yOf(to.d) + ly * cu(to) * mOf(to.d), 0.4);
                  });
                  if (shots === 3) c.speak(rv, pick([`Strike your colours, ${CN}!`, 'Your gut is empty and your guns are old.', 'This is our hunting ground.'], c.r));
                  if (shots === 5) c.speak(city, pick(['Hit her again! Same place!', 'Tier two, return fire!', 'She\'s burning along her works.'], c.r));
                }
              }
              if (rv.hurt > 0.6 || age > 150) {
                rv.state = 'retreat';
                rv.t0 = w.t;
                city.state = hunt.phase === 'none' ? 'roam' : city.state;
                c.say(`${T(rv.name)} breaks off, burning`, rv.gx, rv.d, 'Aftermath');
                c.emit('breakoff', sx(rv.gx, rv.d), yOf(rv.d), 0.8);
                c.chronicle(`Fought ${T(rv.name)} ${whenWords(w.day)}; she broke off, burning.`);
                c.speak(city, 'Let her go. We have better meat to catch.');
              }
            } else if (rv.state === 'retreat') {
              rv.speed += (dir * city.speed * 0.2 - rv.speed) * dt * 0.2;
              rv.gx += rv.speed * dt;
              rv.d = Math.min(0.99, rv.d + dt * 0.002);
              if (w.t - rv.t0 > 120 || !onScreen(rv.gx, rv.d, rv.len * mOf(rv.d))) w.rival = null;
            }
            rv.tread += Math.abs(rv.speed) * dt;
          },
        };
      },
    },
    {
      id: 'bulwark', label: 'the guns of the shield-wall', weight: 2, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        let t0 = -1;
        let shells = 0;
        let next = 0;
        const land = (gx: number, d: number, big: number) => {
          w.craters.push({ gx, d, r: (40 + c.r() * 40) * u * big, t0: w.t });
          if (w.craters.length > 30) w.craters.shift();
          c.fx('flash', gx, d, 10 * u, { dur: 0.7, r: 110 * u * big, color: '#ffc080' });
          for (let k = 0; k < 18; k++) c.fx('mud', gx + (c.r() - 0.5) * 60 * u, d, 0, { vx: (c.r() - 0.5) * 80 * u, valt: (60 + c.r() * 140) * u * big, dur: 2.5 + c.r(), r: (10 + c.r() * 14) * u, color: '#4a3a2c' });
          c.emit('shellfall', sx(gx, d), yOf(d), 0.5);
        };
        return {
          id: 'bulwark',
          step(dt) {
            if (t0 < 0) {
              if (w.t < 240 || hunt.phase === 'jaws' || hunt.phase === 'gut' || w.rival || !w.director.want('bulwark', 0.8, 1000)) return;
              t0 = w.t;
              shells = 0;
              next = 0;
              w.bulwark = { t: w.t, k: 1 };
              // The ranging shot: well off the mark.
              c.say(`${CN} strays in range of the shield-wall; its guns are ranging`, ahead(0.99, 0.2), 0.99, 'The shield-wall');
              c.after(4, () => land(city.gx + dir * city.len * 1.1, 0.55, 0.7));
              c.after(6, () => c.speak(city, 'Hard about! Get us out of range of that wall!'));
              return;
            }
            const age = w.t - t0;
            next -= dt;
            if (age > 10 && age < 46 && next <= 0) {
              next = 4 + c.r() * 4;
              shells++;
              w.bulwark = { t: w.t, k: 1 };
              c.emit('wallgun', GW / 2, HY, 0.3);
              // Salvos walking in on her: nearer each time.
              const q = Math.min(1, shells / 6);
              const gx = city.gx + dir * city.len * (0.9 - q * 0.6) + (c.r() - 0.5) * 300 * u;
              const d = cityD + 0.25 - q * 0.2 + (c.r() - 0.5) * 0.06;
              c.after(3, () => land(gx, d, 1));
              if (shells === 5 && c.r() < 0.6) {
                c.after(3.4, () => {
                  const [lx, ly] = strikePoint(plan, c.r(), c.r() * 0.3);
                  city.fires.push({ lx, ly, t0: w.t, dur: 60, r: 22 });
                  c.fx('flash', lx, cityD - 0.015, -ly, { dur: 0.8, r: 60 * u, on: city.id, color: '#ffd090' });
                  c.say(`A shell from the wall strikes ${CN}`, city.gx, cityD, 'The shield-wall');
                  c.emit('hit', cityX(city, lx), cityY(city, ly), 0.6);
                });
              }
            }
            if (age > 30) city.speed += (city.cruise * 2 - city.speed) * dt * 0.2;
            if (age > 52) {
              t0 = -1;
              w.bulwark.k = 0;
              c.say(`${CN} runs out of range of the wall`, city.gx, cityD, 'Aftermath');
              c.emit('outofrange', GW / 2, HY, 0.3);
              c.chronicle(`Under the guns of the shield-wall ${whenWords(w.day)}; ran for it.`);
            }
          },
        };
      },
    },
    {
      id: 'front', label: 'weather fronts', weight: 5, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let on = false;
        return {
          id: 'front',
          step(dt) {
            if (!on && w.rain <= 0 && w.t > 50 && w.director.want('front', 0.5, 360)) {
              on = true;
              until = w.t + 70 + c.r() * 60;
              w.wind = (c.r() < 0.5 ? 1 : -1) * (20 + c.r() * 14);
              c.say(land === 'snow' ? 'A blizzard comes over the plain' : 'A weather front rolls in across the plain', w.scroll, 0.9, 'The weather');
              c.emit('front', GW / 2, HY, 0.6);
              c.chronicle(`A front came over ${T(w.region)} ${whenWords(w.day)}.`);
            }
            if (!on) return;
            if (w.t < until) {
              w.rain = Math.min(1, w.rain + dt / 25);
              if (land !== 'snow' && c.r() < dt * 0.12 * w.rain) {
                w.flash = 1;
                c.emit('thunder', GW * (0.2 + c.r() * 0.6), HY * 0.4, 0.3);
              }
              if (w.rain > 0.6 && w.director.want('rainline', 0.1, 30)) {
                c.say(pick(['The mud runs like porridge under the tracks', 'The towns bog down in the soup', 'The gutters of the tiers pour over the edge'], c.r), w.scroll, 0.4);
                c.emit('squall', GW / 2, HY, 0.1);
              }
            } else {
              w.rain = Math.max(0, w.rain - dt / 35);
              if (w.rain === 0) {
                on = false;
                w.wind = (c.r() - 0.5) * 14;
                c.say('The front passes; the plain steams', w.scroll, 0.6, 'The weather');
                c.emit('clear', GW / 2, HY, 0.2);
              }
            }
          },
          counts: () => ({ rain: w.rain > 0 ? 1 : 0 }),
        };
      },
    },
    {
      id: 'lights', label: 'searchlights by night', weight: 5, tags: ['night'],
      create: (c) => {
        const w = c.world;
        const n = phone ? 2 : 3;
        for (let k = 0; k < n; k++) city.beams.push({ a: c.r() * 6, v: 0.08 + c.r() * 0.08, gx: 0, d: 0.5 });
        let lock = -1;
        let lockT = 0;
        return {
          id: 'lights',
          step(dt) {
            const on = night() && w.rain < 0.7;
            city.beams.forEach((b, k) => {
              b.a += dt * b.v;
              const tw = lock >= 0 && k === 0 ? w.towns.find((q) => q.id === lock) : null;
              if (tw) {
                b.gx += (tw.gx - b.gx) * Math.min(1, dt * 3);
                b.d += (tw.d - b.d) * Math.min(1, dt * 3);
              } else {
                b.gx = w.scroll + Math.sin(b.a + k * 2.1) * (GW * 0.48) / mOf(0.4);
                b.d = 0.4 + Math.sin(b.a * 0.7 + k) * 0.3;
              }
            });
            if (!on) {
              lock = -1;
              return;
            }
            if (lock >= 0) {
              if (w.t - lockT > 14 || !w.towns.some((q) => q.id === lock)) lock = -1;
              return;
            }
            for (const b of city.beams) {
              const tw = w.towns.find((q) => (q.state === 'roam' || q.state === 'broken') && Math.abs(q.gx - b.gx) < q.len * 0.6 && Math.abs(q.d - b.d) < 0.05);
              if (tw && w.director.want('found', 0.4, 50)) {
                lock = tw.id;
                lockT = w.t;
                city.beams[0].gx = b.gx;
                city.beams[0].d = b.d;
                c.say(`The searchlights find ${T(tw.name)}`, tw.gx, tw.d, 'Night');
                c.emit('found', townX(tw), townY(tw), 0.5);
                c.speak(tw, pick(['Lights out! All lights out!', 'They\'ve seen us.', 'Keep still and pray.'], c.r));
                if (hunt.phase === 'none' && prey(tw) && city.state === 'roam') c.after(2, () => hunt.phase === 'none' && prey(tw) && startHunt(tw, c.r() < 0.7 ? 'catch' : 'escape', `${CN} turns for ${T(tw.name)} in the dark`));
                break;
              }
            }
          },
        };
      },
    },
    {
      id: 'breakdown', label: 'breakdowns', weight: 5, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'breakdown',
          step(dt) {
            for (const tw of w.towns) {
              if (tw.state !== 'broken') continue;
              tw.smoke = Math.max(0.6, tw.smoke);
              if (c.r() < dt * 4) c.fx('steam', tw.gx + (c.r() - 0.5) * tw.len * 0.5, tw.d, tw.len * 0.4, { vx: w.wind * 0.3, valt: (20 + c.r() * 14) * u, dur: 3, r: 8 * u, color: '#d8d4cc' });
              if (w.t - tw.t0 > 55 && hunt.town !== tw.id) {
                tw.state = 'roam';
                tw.smoke = 0.15;
                tw.vx = tw.dir * tw.speed * 0.6;
                c.say(`${T(tw.name)} limps on, patched`, tw.gx, tw.d);
                c.emit('repaired', townX(tw), townY(tw), 0.3);
              }
            }
            if (w.t < 40 || !w.director.want('breakdown', 0.4, 150)) return;
            const tw = w.towns.find((q) => q.state === 'roam' && q.kind !== 'scav' && onScreen(q.gx, q.d, -60 * u));
            if (!tw) return;
            tw.state = 'broken';
            tw.t0 = w.t;
            tw.vx = 0;
            tw.vd = 0;
            c.say(`${T(tw.name)} throws a track and stops dead`, tw.gx, tw.d, 'Breakdown');
            c.emit('breakdown', townX(tw), townY(tw), 0.5);
            c.speak(tw, pick(LINES.broken, c.r));
          },
        };
      },
    },
    {
      id: 'harbour', label: 'a sky harbour', weight: 4, tags: ['trade'],
      create: (c) => {
        const w = c.world;
        let sale = false;
        return {
          id: 'harbour',
          step(dt) {
            const hb = w.harbour;
            if (!hb) {
              if (w.t < 60 || !w.director.want('harbour', 0.45, 420)) return;
              const d = cityD + 0.12 + c.r() * 0.1;
              w.harbour = { name: pick(HARBOUR_NAMES, c.r), gx: ahead(d, 1.4), d, alt: (phone ? 760 : 560) * u * (0.9 + c.r() * 0.2), t0: w.t, state: 'arrive', seed: Math.floor(c.r() * 1e6), tx: 0 };
              sale = false;
              c.say(`The sky harbour ${T(w.harbour.name)} drifts in on the wind`, w.harbour.gx, d);
              c.emit('harbour', GW / 2, HY - 200 * u, 0.4);
              return;
            }
            const want = city.gx + dir * city.len * (phone ? 0.05 : 0.32);
            if (hb.state === 'arrive') {
              hb.gx += (want - hb.gx) * dt * 0.05 + dir * city.speed * dt;
              if (Math.abs(hb.gx - want) < 60 * u) {
                hb.state = 'moored';
                hb.t0 = w.t;
              }
            } else if (hb.state === 'moored') {
              hb.gx = want + Math.sin(w.t * 0.1) * 30 * u;
              if (!sale && w.t - hb.t0 > 12) {
                sale = true;
                const goods = pick(['the salvage of its last meal', 'two hundred tons of scrap', 'brass, glass and old-tech', 'a hold of coal and salt', 'the engines of a town it ate'], c.r);
                c.say(`${CN} sells ${goods} at ${T(hb.name)}`, hb.gx, hb.d, 'The sky harbour');
                c.emit('sale', sx(hb.gx, hb.d), yOf(hb.d) - hb.alt * mOf(hb.d), 0.5);
                c.look('sale', hb.gx, hb.d, hb.alt, 1.6, 10, 5);
                c.chronicle(`Traded at the sky harbour ${T(hb.name)} ${whenWords(w.day)}.`);
                for (let k = 0; k < 2; k++) {
                  c.after(k * 6, () => {
                    if (!w.harbour) return;
                    const s = c.ship(k ? 'hauler' : 'trader', hb.gx, hb.d, hb.alt - 60 * u, { state: 'dock', dir: dir === 1 ? -1 : 1 });
                    s.td = cityD + 0.012;
                    s.talt = -plan.tiers[plan.tiers.length - 1].top * cu(city) + 40 * u;
                    s.t0 = w.t;
                  });
                }
              }
              if (w.t - hb.t0 > 150) {
                hb.state = 'leave';
                hb.t0 = w.t;
                c.say(`${T(hb.name)} casts off and drifts away`, hb.gx, hb.d);
                c.emit('castoff', sx(hb.gx, hb.d), yOf(hb.d) - hb.alt * mOf(hb.d), 0.2);
              }
            } else {
              hb.gx += dir * city.speed * dt * 0.4;
              hb.alt += dt * 4 * u;
              if (!onScreen(hb.gx, hb.d, 600 * u) || w.t - hb.t0 > 200) w.harbour = null;
            }
          },
        };
      },
    },
    {
      id: 'relic', label: 'relics of the ancients', weight: 3, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'relic',
          step() {
            if (w.t < 200 || w.relics.some((q) => q.k < 1) || !w.director.want('relic', 0.85, 1100)) return;
            const d = 0.42 + c.r() * 0.18;
            const kind = pick(['colossus', 'dish', 'tower', 'ring', 'hull'] as RelicKind[], c.r);
            const names: Record<RelicKind, string> = { colossus: 'a colossus of the Ancients', dish: 'a great dish of the Ancients', tower: 'a glass tower of the Ancients', ring: 'a fallen ring from the sky', hull: 'the hull of an ancient sky-ship' };
            const rl = { id: ids++, kind, gx: ahead(d, 0.35 + c.r() * 0.2), d, t0: w.t, k: 0, seed: Math.floor(c.r() * 1e6), name: names[kind] };
            w.relics.push(rl);
            c.say(`The mud heaves: ${rl.name} comes up out of the plain`, rl.gx, d, 'A relic');
            c.emit('relic', sx(rl.gx, d), yOf(d), 1);
            c.look('relic', rl.gx, d, 120 * u, 1.6, 22, 9);
            c.chronicle(`The plain gave up ${rl.name} ${whenWords(w.day)}.`);
            c.after(4, () => c.speak(city, 'All stop! Look at that! Old-tech, tons of it!'));
            for (let k = 0; k < 30; k++) c.fx('mud', rl.gx + (c.r() - 0.5) * 300 * u, d, 0, { vx: (c.r() - 0.5) * 50 * u, valt: (40 + c.r() * 80) * u, dur: 3 + c.r() * 2, r: (12 + c.r() * 16) * u, color: '#5a4a3a' });
            if (w.castIds.includes('scavengers')) c.after(15, () => {
              const tw = c.town('scav', w.scroll - dir * GW / 2 / mOf(d + 0.05) - 100 * u, d + 0.04, { state: 'scavenge', dir });
              tw.vx = dir * (city.speed + 14 * u);
              (tw as Town & { goal?: number }).goal = rl.gx;
              c.say(`Scavengers scuttle in for the relic: ${T(tw.name)}`, tw.gx, tw.d);
              c.emit('scavenge', townX(tw), townY(tw), 0.3);
            });
          },
        };
      },
    },
    {
      id: 'scavengers', label: 'scavenger towns', weight: 5, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'scavengers',
          step() {
            if (w.t < 30 || w.towns.filter((q) => q.kind === 'scav').length >= (phone ? 1 : 2) || !w.director.want('scavs', 0.3, 140)) return;
            const d = 0.08 + c.r() * 0.12;
            const tw = c.town('scav', w.scroll - dir * (GW / 2 / mOf(d) + 120 * u), d, { state: 'roam', dir });
            tw.vx = dir * (city.speed * 1.08);
            c.say(`A scavenger town follows in ${CN}'s tracks: ${T(tw.name)}`, tw.gx, tw.d);
            c.emit('scavenge', townX(tw), townY(tw), 0.3);
            c.after(5, () => c.speak(tw, pick(['Pickings in the big one\'s wake.', 'Stay behind it, never in front.', 'A wreck, off the port legs!'], c.r)));
          },
        };
      },
    },
    {
      id: 'herd', label: 'herds of suburbs', weight: 3, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'herd',
          step() {
            if (w.t < 90 || hunt.phase !== 'none' || !w.director.want('herd', 0.5, 420)) return;
            const d = 0.45 + c.r() * 0.15;
            const gx0 = ahead(d, 0.8);
            const n = phone ? 3 : 4 + Math.floor(c.r() * 3);
            for (let k = 0; k < n; k++) {
              const tw = c.town('suburb', gx0 + dir * k * 90 * u + (c.r() - 0.5) * 60 * u, d + (c.r() - 0.5) * 0.1, { state: 'roam' });
              tw.dir = dir === 1 ? -1 : 1;
              tw.vx = tw.dir * tw.speed * 0.5;
            }
            c.say('A herd of suburbs grazes on the plain ahead', gx0, d, 'The herd');
            c.emit('herd', sx(gx0, d), yOf(d), 0.5);
            c.after(8, () => {
              for (const tw of w.towns) if (tw.kind === 'suburb' && tw.state === 'roam') {
                tw.vx = (c.r() < 0.5 ? 1 : -1) * tw.speed * 1.5;
                tw.dir = tw.vx > 0 ? 1 : -1;
                tw.vd = (c.r() - 0.4) * 0.02;
              }
              c.say(`${CN}'s horn, and the herd scatters`, gx0, d);
              c.emit('scatter', sx(gx0, d), yOf(d), 0.4);
              city.hornT = w.t;
            });
          },
        };
      },
    },
  ];
  const RULE = { total: [4, 6] as [number, number], quota: { threat: [1, 2] as [number, number], weather: [0, 1] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((dd) => dd.def.create(ctx, dd.params, g.fork(dd.def.id)));
  world.cast = drawn.map((dd) => dd.def.label ?? dd.def.id);
  world.castIds = drawn.map((dd) => dd.def.id);

  // ---- the plain at the start: towns roaming, traders aloft, crows -------------------------------------
  world.trails.push({ id: city.id, w: city.len * 0.05, gauge: 0.02, pts: [[city.gx - dir * GW * 3, cityD], [city.gx, cityD]], tread: true });
  const nTowns = Math.round((phone ? 3 : 5) * Math.min(1.4, traffic));
  for (let k = 0; k < nTowns; k++) {
    const d = 0.08 + r() * 0.6;
    const [l, rr] = span(d);
    const kind: TownKind = pick(['wheeled', 'wheeled', 'tracked', 'tracked', 'suburb', 'mining', 'sail'] as TownKind[]);
    let gx = l + (0.06 + r() * 0.88) * (rr - l);
    if (Math.abs(d - cityD) < 0.07) gx = city.gx + (r() < 0.5 ? 1 : -1) * (city.len * 0.62 + r() * 200 * u);
    const tw = spawnTown(kind, gx, d, { state: 'roam' });
    tw.vx = tw.dir * tw.speed * (0.4 + r() * 0.6);
  }
  const nShips = phone ? 2 : 3;
  for (let k = 0; k < nShips; k++) {
    const d = 0.2 + r() * 0.6;
    const [l, rr] = span(d);
    const s = spawnShip(pick(['trader', 'balloon', 'hauler', 'clipper'] as ShipKind[]), l + r() * (rr - l), d, (200 + r() * 380) * u);
    s.dir = r() < 0.5 ? 1 : -1;
    s.vx = s.dir * (14 + r() * 20) * u;
  }
  for (let k = 0; k < (phone ? 1 : 2); k++) world.flocks.push({ id: ids++, gx: city.gx + (r() - 0.5) * city.len, d: cityD - 0.05 - r() * 0.1, alt: (260 + r() * 200) * u, vx: dir * city.cruise, n: 9 + Math.floor(r() * 10), seed: Math.floor(r() * 1e6), scatter: -99, spread: 1 });

  // ---- the city ---------------------------------------------------------------------------------------
  let camOff = 0;
  function cityStep(dt: number) {
    if (city.state === 'roam' || city.state === 'duel') city.speed += (city.cruise * (world.rain > 0.5 ? 0.75 : 1) - city.speed) * dt * 0.3;
    city.gx += dir * city.speed * dt;
    city.tread += city.speed * dt;
    // The camera rides alongside, a little back when the chase is on (to see ahead), drifting.
    const want = hunt.phase === 'chase' || hunt.phase === 'sighted' ? -dir * GW * (phone ? 0.04 : 0.14) / mC : world.rival ? -dir * GW * 0.12 / mC : Math.sin(world.t * 0.011) * GW * 0.05 / mC;
    camOff += (want - camOff) * dt * 0.15;
    world.scroll = city.gx + camOff;
    const open = (hunt.phase === 'chase' && city.jaw > 0) || hunt.phase === 'jaws';
    city.jaw += ((open ? 1 : 0) - city.jaw) * dt * (open ? 0.5 : 0.8);
    if (city.jaw > 0.5 && r() < dt * 10) fx('mud', cityFront(city) + dir * 10 * u, cityD - 0.012, 0, { vx: dir * (30 + r() * 40) * u + dir * city.speed, valt: (30 + r() * 50) * u, dur: 1.5 + r(), r: (8 + r() * 10) * u, color: '#4a3a2c' });
    city.gut = Math.max(0.2, city.gut - dt * 0.01);
    for (const c of [city, world.rival]) {
      if (!c) continue;
      for (const f of c.fires) if (world.t - f.t0 >= f.dur) scar(c, f.lx, f.ly, f.r * 1.3);
      c.fires = c.fires.filter((f) => world.t - f.t0 < f.dur);
      if (!c.fires.length) c.hurt = Math.max(0, c.hurt - dt * 0.004);
      // Patched in the end: a scar is gone after a long while (scaffolding over it from halfway).
      c.scars = c.scars.filter((q) => world.t - q.t0 < 1500);
    }
    if (world.t - city.hornT > 140 && city.state === 'roam' && world.director.want('horn', 0.1, 120)) {
      city.hornT = world.t;
      emit('horn', cityX(city, 0), cityY(city, -300), 0.2);
      for (const f of world.flocks) f.scatter = world.t;
    }
  }

  // ---- the towns ----------------------------------------------------------------------------------
  let nextTown = 8;
  function townsStep(dt: number) {
    nextTown -= dt * traffic;
    const live = world.towns.filter((q) => q.state !== 'eaten' && q.state !== 'gone').length;
    if (nextTown <= 0) {
      nextTown = 14 + r() * 16;
      if (live < (phone ? 4 : 8)) {
        const fromHorizon = r() < 0.6;
        const goal = 0.1 + r() * 0.55;
        const d = fromHorizon ? 0.97 : goal;
        const kind: TownKind = pick(['wheeled', 'wheeled', 'tracked', 'tracked', 'suburb', 'mining', 'sail'] as TownKind[]);
        const gx = fromHorizon ? ahead(d, (r() - 0.3) * 0.9) : ahead(d, 1) + dir * 200 * u;
        const tw = spawnTown(kind, gx, d, { state: fromHorizon ? 'arrive' : 'roam' });
        if (fromHorizon) {
          tw.vd = -0.01 - r() * 0.006;
          (tw as Town & { goal?: number }).goal = goal;
          say(`${T(tw.name)} comes over the horizon`, tw.gx, tw.d);
          emit('arrive', townX(tw), townY(tw), 0.2);
        } else {
          tw.dir = dir === 1 ? -1 : 1;
          tw.vx = tw.dir * tw.speed * (0.4 + r() * 0.5);
        }
      }
    }
    for (const tw of world.towns) {
      const goal = (tw as Town & { goal?: number }).goal;
      if (tw.state === 'arrive') {
        tw.d += tw.vd * dt;
        tw.gx += tw.vx * dt;
        if (goal !== undefined && tw.d <= goal) {
          tw.state = 'roam';
          tw.vd = 0;
        }
      } else if (tw.state === 'roam') {
        if (r() < dt * 0.03) {
          tw.vx = (r() < 0.6 ? tw.dir : -tw.dir) * tw.speed * (0.3 + r() * 0.7);
          tw.dir = tw.vx >= 0 ? 1 : -1;
          tw.vd = (r() - 0.5) * 0.006;
        }
        if (Math.abs(tw.d - cityD) < 0.05 && Math.abs(tw.gx - city.gx) < city.len * 0.7) tw.vd = tw.d < cityD ? -0.006 : 0.006;
        if (tw.d < 0.06) tw.vd = Math.abs(tw.vd) + 0.001;
        if (tw.d > ridgeD - 0.03) tw.vd = -Math.abs(tw.vd) - 0.001;
        if (tw.kind !== 'scav' && Math.abs(tw.d - cityD) < 0.1 && dir * (tw.gx - city.gx) > 0 && gapTo(city, tw) < city.len * 0.2) {
          tw.vx = dir * tw.speed * 1.4;
          tw.dir = dir;
        }
        if (tw.kind === 'scav') tw.vx += (dir * city.speed * 1.02 - tw.vx) * dt * 0.1;
        tw.gx += tw.vx * dt;
        tw.d += tw.vd * dt;
        tw.smoke = Math.max(0, tw.smoke - dt * 0.01);
      } else if (tw.state === 'flee') {
        const want = tw.top * (hunt.phase === 'sighted' ? 0.6 : 1);
        tw.vx += (dir * want - tw.vx) * dt * 0.4;
        tw.dir = dir;
        tw.gx += tw.vx * dt;
        if (r() < dt * 6) fx('mud', tw.gx - dir * tw.len * 0.45, tw.d, 0, { vx: -dir * 20 * u + tw.vx * 0.5, valt: (14 + r() * 20) * u, dur: 1.4, r: (4 + r() * 5) * u, color: '#4a3a2c' });
      } else if (tw.state === 'caught' || tw.state === 'eaten') {
        tw.vx = city.speed * dir;
      } else if (tw.state === 'escaped') {
        tw.gx += tw.vx * dt;
        if (tw.run === 'ridge') tw.d = Math.min(0.99, tw.d + dt * 0.01);
      } else if (tw.state === 'scavenge') {
        tw.gx += tw.vx * dt;
        if (goal !== undefined && dir * (tw.gx - goal) > -60 * u) {
          tw.vx = 0;
          if (r() < dt * 3) fx('spark', goal + (r() - 0.5) * 120 * u, tw.d - 0.02, (20 + r() * 60) * u, { vx: (r() - 0.5) * 30 * u, valt: 20 * u, dur: 0.7, r: 2 * u, color: '#ffd27a' });
        }
      }
      tw.roll += Math.abs(tw.vx) * dt;
      tw.d = Math.max(0.04, Math.min(0.99, tw.d));
    }
    world.towns = world.towns.filter((tw) => {
      if (hunt.town === tw.id) return true;
      const x = sx(tw.gx, tw.d);
      const behind = dir * (x - GW / 2) < -GW * 0.5 - tw.len * mOf(tw.d) - 60 * u;
      const farAhead = dir * (x - GW / 2) > GW * 1.6;
      const lost = tw.state === 'escaped' && (world.t - tw.t0 > 40 || !onScreen(tw.gx, tw.d, 200 * u));
      const keep = !(behind || farAhead || lost);
      if (!keep) world.trails = world.trails.filter((q) => q.id !== tw.id);
      return keep;
    });
  }

  // ---- the airships and the crows -------------------------------------------------------------------
  let nextShip = 12;
  const quay = () => city.gx + dir * (plan.tiers[plan.tiers.length - 1].x1 - 16) * cu(city);
  function shipsStep(dt: number) {
    nextShip -= dt * traffic;
    if (nextShip <= 0) {
      nextShip = 16 + r() * 18;
      if (world.ships.filter((s) => s.kind !== 'league' && s.kind !== 'gunboat').length < (phone ? 2 : 4)) {
        const d = 0.15 + r() * 0.7;
        const side: 1 | -1 = r() < 0.5 ? 1 : -1;
        const kind = pick(['trader', 'trader', 'balloon', 'hauler', 'clipper'] as ShipKind[]);
        const s = spawnShip(kind, world.scroll + side * (GW / 2 / mOf(d) + 150 * u), d, (180 + r() * 420) * u * (phone ? 1.4 : 1));
        s.dir = side > 0 ? -1 : 1;
        s.vx = s.dir * (16 + r() * 22) * u + dir * city.speed * (r() < 0.5 ? 1 : 0.3);
        // Some come to trade at the city's air-quay.
        if (r() < 0.45 && Math.abs(d - cityD) < 0.3) {
          s.state = 'dock';
          s.td = cityD + 0.012;
          s.talt = -plan.tiers[plan.tiers.length - 1].top * cu(city) + 30 * u;
        }
        emit('airship', sx(s.gx, s.d), yOf(d) - s.alt * mOf(d), 0.15);
      }
    }
    for (const s of world.ships) {
      s.bob += dt;
      const age = world.t - s.t0;
      if (s.state === 'cruise') {
        s.gx += s.vx * dt;
        s.dir = s.vx - dir * city.speed * 0.5 >= 0 ? 1 : -1;
        s.alt += Math.sin(world.t * 0.2 + s.seed) * dt * 3 * u;
      } else if (s.state === 'dock') {
        // In to the air-quay mast on the crown; a while there; away.
        const tx = quay() + (s.id % 2 ? -1 : 1) * 30 * u;
        const dx = tx - s.gx;
        const moored = Math.abs(dx) < 20 * u && Math.abs(s.talt - s.alt) < 10 * u;
        if (!moored) {
          s.gx += Math.sign(dx) * Math.min(Math.abs(dx), (30 * u + city.speed) * dt) + dir * city.speed * dt * 0.9;
          s.d += (s.td - s.d) * dt * 0.2;
          s.alt += (s.talt - s.alt) * dt * 0.3;
          s.dir = dx >= 0 ? 1 : -1;
          s.t0 = world.t;
        } else {
          s.gx = tx;
          if (age > 0.01 && age < dt * 1.5) {
            say(`${T(s.name)} ties up at ${CN}'s air-quay`, s.gx, s.d);
            emit('dock', sx(s.gx, s.d), yOf(s.d) - s.alt * mOf(s.d), 0.3);
            speak(s, pick(LINES.trader));
          }
          if (age > 28) {
            s.state = 'cruise';
            s.vx = -dir * (20 + r() * 10) * u + dir * city.speed;
            s.alt += 2 * u;
            emit('undock', sx(s.gx, s.d), yOf(s.d) - s.alt * mOf(s.d), 0.15);
          }
        }
      } else if (s.state === 'attack') {
        const dx = s.tx - s.gx;
        s.gx += Math.sign(dx) * Math.min(Math.abs(dx), 60 * u * dt) + dir * city.speed * dt;
        s.dir = Math.abs(dx) > 20 * u ? (dx > 0 ? 1 : -1) : s.dir;
        s.alt += (s.talt - s.alt) * dt * 0.3;
        if (Math.abs(dx) < 30 * u && r() < dt * 0.25) {
          s.tx = city.gx + (r() - 0.5) * city.len * 0.9;
          s.talt = (360 + r() * 300) * u;
        }
        if (s.fire > 0 && r() < dt * 8) fx('smoke', s.gx, s.d, s.alt, { vx: world.wind * 0.3 * u, valt: 12 * u, dur: 3, r: 10 * u, color: '#2a2420' });
      } else if (s.state === 'fall') {
        s.alt -= dt * (40 + age * 30) * u;
        s.gx += s.dir * dt * 30 * u + dir * city.speed * dt * 0.5;
        s.fire = Math.min(1, s.fire + dt * 0.3);
        if (r() < dt * 14) fx('fire', s.gx + (r() - 0.5) * s.len * 0.4, s.d, s.alt, { vx: 0, valt: 20 * u, dur: 1, r: 14 * u, color: '#ff7a20' });
        if (r() < dt * 8) fx('smoke', s.gx, s.d, s.alt, { vx: world.wind * 0.3 * u, valt: 16 * u, dur: 4, r: 14 * u, color: '#2a2420' });
        if (s.alt <= 0) {
          s.state = 'gone';
          world.wrecks.push({ id: ids++, kind: 'ship', gx: s.gx, d: s.d, t0: world.t, seed: s.seed, smoke: 1, len: s.len });
          world.craters.push({ gx: s.gx, d: s.d, r: s.len * 0.5, t0: world.t });
          fx('flash', s.gx, s.d, 10 * u, { dur: 0.8, r: 90 * u, color: '#ffb060' });
          for (let k = 0; k < 14; k++) fx(k < 7 ? 'fire' : 'mud', s.gx + (r() - 0.5) * 60 * u, s.d, 0, { vx: (r() - 0.5) * 70 * u, valt: (20 + r() * 60) * u, dur: 1.5 + r(), r: (8 + r() * 10) * u, color: k < 7 ? '#ff7a20' : '#4a3a2c' });
          emit('crash', sx(s.gx, s.d), yOf(s.d), 0.8);
        }
      } else if (s.state === 'leave') {
        const dx = s.tx - s.gx;
        s.gx += Math.sign(dx) * 70 * u * dt;
        s.dir = dx > 0 ? 1 : -1;
        s.alt += (s.talt - s.alt) * dt * 0.2;
        if (age > 40) s.state = 'gone';
      }
    }
    world.ships = world.ships.filter((s) => s.state !== 'gone' && !(s.state === 'cruise' && !onScreen(s.gx, s.d, s.len * 2 + 300 * u) && world.t - s.t0 > 8));
    for (const f of world.flocks) {
      const wantX = city.gx + Math.sin(world.t * 0.05 + f.seed) * city.len * 0.4;
      f.vx += ((wantX - f.gx) * 0.02 + dir * city.speed - f.vx) * dt * 0.3;
      f.gx += f.vx * dt;
      f.spread += ((world.t - f.scatter < 6 ? 3 : 1) - f.spread) * dt * 0.8;
    }
  }

  // ---- the tracks in the mud ---------------------------------------------------------------------------
  function trailsStep() {
    const behindEdge = (d: number) => world.scroll - dir * (GW / 2 / mOf(d) + 400 * u);
    for (const tr of world.trails) {
      const tw = tr.id === city.id ? city : world.towns.find((q) => q.id === tr.id);
      if (!tw) continue;
      const last = tr.pts[tr.pts.length - 1];
      const moving = tr.id === city.id ? true : (tw as Town).state !== 'broken' && (tw as Town).state !== 'arrive';
      if (tr.id !== city.id && (tw as Town).state === 'arrive') tr.pts = [[tw.gx, tw.d]];
      if (moving && Math.hypot(tw.gx - last[0], (tw.d - last[1]) * 2000 * u) > 26 * u) tr.pts.push([tw.gx, tw.d]);
      while (tr.pts.length > 2 && dir * (tr.pts[1][0] - behindEdge(tr.pts[1][1])) < 0) tr.pts.shift();
      if (tr.pts.length > 260) tr.pts.splice(0, tr.pts.length - 260);
    }
    world.craters = world.craters.filter((c) => onScreen(c.gx, c.d, 600 * u) || dir * (c.gx - world.scroll) > 0);
  }

  // ---- the weather, the fx, the wrecks and relics ----------------------------------------------------
  function weather(dt: number) {
    world.flash = Math.max(0, world.flash - dt * 2.5);
    world.bulwark.k = Math.max(0, world.bulwark.k - dt * 1.5);
    world.wind += (Math.sin(world.t * 0.03) * 6 - world.wind) * dt * (world.rain > 0 ? 0.02 : 0.05);
    world.wet = Math.max(land === 'salt' ? 0.05 : 0.15, Math.min(1, world.wet + (world.rain * 0.9 - (world.wet - 0.2) * 0.05) * dt * 0.02));
    for (const rl of world.relics) rl.k = Math.min(1, (world.t - rl.t0) / 24);
    world.relics = world.relics.filter((rl) => rl.k < 1 || onScreen(rl.gx, rl.d, 900 * u) || dir * (rl.gx - world.scroll) > 0);
    for (const wk of world.wrecks) {
      wk.smoke = Math.max(0, wk.smoke - dt / 200);
      if (wk.smoke > 0 && r() < dt * 3 * wk.smoke) fx('smoke', wk.gx + (r() - 0.5) * 20 * u, wk.d, 10 * u, { vx: world.wind * 0.4 * u, valt: (10 + r() * 8) * u, dur: 5, r: (8 + r() * 6) * u, color: '#2e2a26' });
    }
    world.wrecks = world.wrecks.filter((wk) => onScreen(wk.gx, wk.d, 600 * u) || dir * (wk.gx - world.scroll) > 0);
    for (const f of world.fx) {
      if (f.kind === 'rocket' || f.kind === 'shell') continue;
      f.gx += f.vx * dt;
      f.alt += f.valt * dt;
      if (f.kind === 'mud' || f.kind === 'clod' || f.kind === 'debris' || f.kind === 'spark') f.valt -= dt * 90 * u;
      else if (f.kind === 'smoke' || f.kind === 'steam') f.valt *= 1 - dt * 0.2;
      if (f.alt < 0) {
        f.alt = 0;
        f.vx *= 0.5;
        f.valt = 0;
      }
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
  }

  // ---- the radio ------------------------------------------------------------------------------------
  let nextVoice = 5;
  function voices(dt: number) {
    nextVoice -= dt;
    if (nextVoice > 0) return;
    nextVoice = 6 + r() * 7;
    const roll = r();
    const hunted = world.towns.find((q) => q.id === hunt.town);
    if (hunted && hunted.state === 'flee' && roll < 0.6) {
      if (r() < 0.5 && world.t - hunted.lineT > 6) speak(hunted, pick(LINES.prey));
      else speak(city, pick(LINES.hunt));
    } else if (roll < 0.35 && world.t - city.lineT > 10) speak(city, pick(LINES.lookout));
    else {
      const ships = world.ships.filter((s) => (s.state === 'cruise' || s.state === 'dock') && world.t - s.lineT > 12 && onScreen(s.gx, s.d));
      const towns = world.towns.filter((q) => (q.state === 'roam' || q.state === 'broken') && world.t - q.lineT > 12 && onScreen(q.gx, q.d));
      if (ships.length && r() < 0.5) speak(pick(ships), pick(LINES.trader));
      else if (towns.length) {
        const tw = pick(towns);
        speak(tw, tw.state === 'broken' ? pick(LINES.broken) : pick(LINES.roam));
      }
    }
  }

  // ---- the hours -------------------------------------------------------------------------------------
  const RITES: [number, string, string][] = [
    [0.25, 'Dawn over the hunting ground; the towns wake and move', 'Dawn'],
    [0.5, `Noon: the Gut of ${CN} rings for the change of shift`, ''],
    [0.76, `Dusk: the lamps are lit, tier on tier, all over ${CN}`, 'Dusk'],
    [0.04, 'The dead of night; only the furnaces and the tracks', ''],
  ];
  const rited = new Set<string>();
  function rites() {
    const dayNo = Math.floor(world.t / world.dayLen + world.day);
    for (const [at, text, kick] of RITES) {
      const key = `${dayNo}:${at}`;
      if (rited.has(key) || Math.abs(world.day - at) > 0.004) continue;
      rited.add(key);
      say(text, world.scroll, 0.9, kick || undefined);
      emit('hour', GW / 2, HY, 0.1);
    }
    if (rited.size > 40) rited.clear();
  }

  // ---- a touch --------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 2.5) return null;
    lastNudge = world.t;
    if (y < HY) {
      if (!world.flocks.length) return null;
      for (const q of world.flocks) q.scatter = world.t;
      emit('birds', x, y, 0.2);
      say('The crows scatter from the chimneys', world.scroll, cityD);
      return 'The crows scatter from the chimneys';
    }
    const d = Math.max(0.02, Math.min(0.97, dOfY(y)));
    const gx = world.scroll + (x - GW / 2) / mOf(d);
    const tw = world.towns.find((q) => Math.abs(q.gx - gx) < q.len * 0.8 && Math.abs(q.d - d) < 0.06 && q.state === 'roam');
    if (tw && hunt.phase === 'none' && city.state === 'roam' && prey(tw)) {
      const line = `The lookouts see it too: ${CN} turns for ${T(tw.name)}`;
      startHunt(tw, r() < 0.6 ? 'catch' : 'escape', line);
      return line;
    }
    fx('flash', gx, d, 200 * u, { dur: 3, r: 30 * u, color: '#ff6a4a' });
    emit('flare', x, y, 0.3);
    if (world.towns.length < (phone ? 5 : 9)) {
      const nt = spawnTown(pick(['wheeled', 'tracked', 'suburb', 'sail'] as TownKind[]), gx + dir * (GW * 0.3) / mOf(0.97), 0.97, { state: 'arrive', vd: -0.014 });
      nt.vx = (gx > nt.gx ? 1 : -1) * nt.speed * 0.5;
      nt.dir = nt.vx > 0 ? 1 : -1;
      (nt as Town & { goal?: number }).goal = Math.max(0.08, Math.min(ridgeD - 0.05, d));
    }
    const line = 'A flare goes up from the mud; a town comes to see';
    say(line, gx, d);
    return line;
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
    cityStep(dt);
    huntStep(dt);
    townsStep(dt);
    shipsStep(dt);
    for (const s of systems) s.step?.(dt);
    trailsStep();
    weather(dt);
    voices(dt);
    rites();
    world.labels = world.labels.filter((l) => world.t - l.t0 < 30);
    world.radio = world.radio.filter((l) => world.t - l.t0 < 20);
  }

  return world;
}
