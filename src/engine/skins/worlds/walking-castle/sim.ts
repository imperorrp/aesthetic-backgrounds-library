/**
 * # Walking Castle: a wizard's ramshackle castle on iron hen's legs, walking across a painted country.
 *
 * On screen, at a glance: the castle in the middle, a heap of turrets, cottages, chimneys and pipes
 * on a round iron hull with a face at the bow, striding on two iron hen's legs (smoke from its
 * chimneys, steam from its pipes at every step); the crest of a green hill under its feet and tall
 * grass in front, bending in the wind; rolling country behind (fields and hedges, moors with stone
 * walls, a mountain lake, a seaside town of steep roofs), mountains beyond; big cumulus clouds;
 * sheep, rooks and swallows; at night stars and a big moon.
 * The camera: on the next hill, watching it walk by; the whole country in view. A second view, the
 * map, is the same walk on a painted travel map, the road drawn on as it goes.
 *
 * Always happening (the floor):
 * - The walk: it strides at a gentle pace, the land scrolling under it in five planes of depth; the
 *   body bobs and rocks, feet plant with dust, vents puff steam, chimneys smoke.
 * - The road: meadows, moors, lakes, coast, mountain passes, flower fields and market towns, each
 *   with a title card as it begins; the day turns, dawn, noon, sunset, moonrise.
 * - The door: its dial turns to a colour and it opens on somewhere else (blue a port, red a royal
 *   city, green a flower field, black a city at war by night); someone goes through, or comes home.
 * - The household: a wizard, an apprentice, a housekeeper on the balconies and the deck (washing
 *   out, a spyglass), and the fire spirit in the hearth, who talks (as subtitles); sheep scatter
 *   from the feet; birds go over.
 *
 * The cast (each seed draws some; each a story with a build-up, a climax and what it leaves):
 * - war [threat] guns flash beyond the hills by night and a scout goes over; then the fleet:
 *   bat-winged bombers for a far town, interceptors that fight their gunboats overhead with
 *   tracer; gunboats nose round the castle till it hides in its own smoke. After: the town burns,
 *   then stands in ruins with its smoke; a wreck smoulders on a hillside; refugees on the road; scorch on the castle.
 * - tarmen [threat] tar bubbling in the grass behind it; then the tar men rise and run after it,
 *   one catching a foot. After: black stains in the grass, tar on a leg, a limp for a while.
 * - storm [weather] the sky darkens and the washing comes in; rain, lightning that strikes a tree
 *   on the hills (it burns, then stands black). After: puddles, wet light, mist, a rainbow.
 * - showers [weather] a summer shower and a rainbow.
 * - lakes [journey] it stops by a mountain lake at sundown; the household comes out to watch.
 * - mountain [journey] the road climbs a pass, slow, to the top, and down.
 * - market [town] market day in a town it passes; the apprentice comes back with bunting for it.
 * - flowers [season] the flower fields in bloom, petals on the wind; flowers in its window boxes after.
 * - starfall [wonder] a shower of falling stars, one landing hissing in the meadow.
 * - fireflies [life] fireflies over the grass at dusk.
 * - hencottage [legendary] another walking house on hen's legs crosses the far hills, and they whistle.
 * Quotas: 4–6 in all; 1–2 threat; 1–2 weather.
 *
 * Events: common: the door, a new region, sheep scattering, the spirit flaring, a shooting star;
 * uncommon: the war fleet, the tar men, a storm, a rainbow, market day, the lake at sundown;
 * rare: a ship shot down, the starfall; legendary: the hen-legged cottage.
 * What keeps it going: the road goes on, drawn as it walks; each region and hour brings its own;
 * the war comes and goes; marks build up on the land behind and on the castle itself.
 * What changes with the seed: the castle (hull, cottages, turrets, roofs, chimneys, pipes, colours),
 * the homeland (northern moors and lakes, southern meadows and flowers, the coast, the highlands),
 * its weather's temper, the season, the vantage, which way it walks, the cast, all the names.
 * A touch: on the castle, the door opens; on the grass, larks go up (fireflies by night); on the
 * far fields, a gust; in the sky, a smoke ring by day or a shooting star by night.
 * Phone: the same country, taller and narrower: a bigger castle, more sky.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import { createDesign } from './design';
import { createLand, midS, PLANES, clamp01, type Region, type Segment } from './land';
import type { Arc, Castle, CastleOptions, CastleWorld, Ctx, Flock, Fx, FxKind, Mark, Member, Place, Sheep, Ship, TarMan } from './types';

const CASTLE_NAMES = ['The Ramble', 'Old Clattershanks', 'The Wandering Hall', 'Highstride', 'The Hen-Footed House', 'The Walking Keep', 'Great Trudge', 'The Iron Hen', 'The Roving House', 'Mister Stomp'];
const WIZARDS = ['Orrin Vale', 'Jesper Moth', 'Aldous Wren', 'Tobin Sloe', 'Caspian Drove', 'Lucan Ferris', 'Ivo Marchbank', 'Emrys Cole'];
const APPRENTICES = ['Wat', 'Nibs', 'Cormac', 'Pip', 'Tamsin', 'Bram', 'Hob', 'Letty'];
const KEEPERS = ['Old Mag', 'Granny Hollis', 'Aunt Berry', 'Mistress Dowling', 'Nan Tilly', 'Goody Parr'];
const SPIRITS = ['Smoulder', 'Kindle', 'Emberly', 'Wick', 'Tinderjack', 'Old Coals', 'Flint', 'Cinderbox'];
const PORTS = ['Gullhaven', 'Saltmere', 'Brinewick', 'Merrowport'];
const ROYALS = ['Esterhall', 'High Corvain', 'Valmont', 'Aurelle'];
const WARS = ['the burning city', 'Grimholt at war', 'the city under the guns', 'Ashmouth'];
const FIELDS = ['the summer hollow', 'the meadow of long ago', 'Bellweather Field', 'the hidden vale'];
const LINES = {
  spirit: ['Left foot. Right foot. Left foot…', 'Who put a wet log on me?', 'I could walk us to the sea by teatime.', 'More coal, or we stop here for ever.', 'Mind the sheep. Mind the sheep!', 'My hearth, my rules.', 'Sixty leagues of fire in a teacup, that’s me.', 'Don’t open the windows, I’ll gutter.', 'Hum, hum, hummm.', 'I smell bacon. Somebody’s frying bacon.', 'All this walking and nobody thanks the fire.', 'My knees! Well. The castle’s knees.'],
  spiritRain: ['Rain! Shut everything! Shut it!', 'I hate rain. I hate it.', 'If that chimney leaks on me again…'],
  spiritNight: ['Everyone asleep but me.', 'The stars are out. Show-offs.', 'I’ll walk all night. I always do.'],
  keeper: ['This floor hasn’t seen a broom in a hundred years.', 'The washing will be dry by noon in this wind.', 'Wipe your feet, whoever you are.', 'Tea? There’s always tea.', 'What a view. What a mess, but what a view.', 'Hold still, castle, I’m hanging sheets.'],
  apprentice: ['Sheep! Hundreds of them!', 'I can see for miles from up here.', 'Master says not to touch the black.', 'One spell. Just one, please?', 'The clouds look like castles.', 'I’m going to be a wizard one day.'],
  wizard: ['We go where the wind is kind.', 'Nobody answers the door on black.', 'I’ll be back before dawn.', 'Keep the fire fed.', 'The king can find another wizard.', 'Lovely country. Let’s not stay.'],
  war: ['They’re bombing the towns again.', 'Keep low. Keep smoking.', 'That’s the king’s fleet. Or the other king’s.', 'Don’t wave at them!'],
  guns: ['Hear that? Guns, over the hills.', 'There’s fire on the sky to the east.', 'The war’s come this way again.'],
  tar: ['They’re back! Faster, castle!', 'Hold on to something!', 'Not the tar men. Not again.', 'Kick them off! Kick!'],
  sunset: ['Look at that. Just look.', 'The water’s gone gold.', 'We’ll stay till the first star.'],
  after: ['Those poor people.', 'Nobody wins a war. Nobody.', 'Keep walking. Just keep walking.'],
};
const DOOR: Omit<Place, 'name'>[] = [
  { col: '#4a7ac8', label: 'blue', kind: 'port' },
  { col: '#c8443a', label: 'red', kind: 'royal' },
  { col: '#5aa05a', label: 'green', kind: 'flowers' },
  { col: '#24222a', label: 'black', kind: 'war' },
];
const HOMELANDS: Record<string, { fav: Partial<Record<Region, number>>; temper: [number, number]; label: string }> = {
  north: { fav: { moor: 3.5, lake: 2.2, mountain: 1.2, meadow: 1.4, coast: 0.6, flowers: 0.3, town: 0.8 }, temper: [1.1, 1.6], label: 'the northern fells' },
  south: { fav: { meadow: 3.5, flowers: 2, town: 1.8, lake: 0.8, moor: 0.6, coast: 1, mountain: 0.3 }, temper: [0.5, 0.9], label: 'the southern downs' },
  coast: { fav: { coast: 3, town: 1.6, meadow: 2, moor: 1, lake: 0.6, flowers: 0.8, mountain: 0.3 }, temper: [0.9, 1.3], label: 'the western coast' },
  high: { fav: { mountain: 2.4, lake: 2.4, moor: 1.6, meadow: 1.4, coast: 0.4, flowers: 0.6, town: 0.6 }, temper: [0.8, 1.4], label: 'the high country' },
};

const DAY_LEN = 840;
const STRIDE = 120;
const BETA = 0.64;
const STAND = 138;
export const nightOf = (d: number) => clamp01(d > 0.3 && d < 0.7 ? 0 : d <= 0.2 || d >= 0.82 ? 1 : d < 0.5 ? (0.3 - d) / 0.1 : (d - 0.7) / 0.12);
const titled = (s: string) => s.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\b(Of|The|At|On|Below|Over|Above|To)\b(?!$)/g, (q) => q.toLowerCase()).replace(/^./, (q) => q.toUpperCase());

export function createWalkingCastle(seed: string | number, W: number, H: number, opts: CastleOptions): CastleWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'castle');
  const shotR: Rng = forkRng(seed, 'castle-shots');
  const g: Genome = createGenome(seed, 'castle');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.3, Math.min(1.2, Math.min(GW, GH * 1.6) / 1600));
  const phone = GW < GH;
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];
  let ids = 1;

  const homeland = g.weighted({ north: 3, south: 3, coast: 2, high: 2 });
  const home = HOMELANDS[homeland];
  const season = g.weighted(homeland === 'north' || homeland === 'high' ? { spring: 2, summer: 3, late: 3, autumn: 2.5 } : { spring: 3, summer: 4, late: 2, autumn: 1 });
  const temper = g.range(home.temper[0], home.temper[1]);
  const land = createLand(Math.floor(g.unit() * 1e6), GW, GH, u, phone, {
    peaks: homeland === 'high' ? g.range(1.0, 1.35) : homeland === 'south' ? g.range(0.4, 0.8) : g.range(0.6, 1.2),
    hills: homeland === 'south' ? g.range(0.7, 1.05) : g.range(0.9, 1.35),
    rolling: g.range(0.7, 1.3),
    horizon: g.range(-0.035, 0.045),
  });
  const design = createDesign(g.fork('design'));
  const dir: 1 | -1 = g.chance(0.6) ? 1 : -1;
  const cs = u * (phone ? 1.6 : 1.0) * g.range(0.92, 1.08);
  const pace = Math.max(0.4, Math.min(2.2, opts.pace));
  const PACE = 34 * cs * pace;
  const fav = Object.fromEntries((Object.keys(home.fav) as Region[]).map((k) => [k, (home.fav[k] ?? 1) * g.range(0.7, 1.3)])) as Record<Region, number>;
  const places: Place[] = DOOR.map((d) => ({ ...d, name: d.kind === 'port' ? g.pick(PORTS) : d.kind === 'royal' ? g.pick(ROYALS) : d.kind === 'war' ? g.pick(WARS) : g.pick(FIELDS) }));
  const member = (role: Member['role'], name: string): Member => ({ id: ids++, name, role, where: 'in', spot: 0, act: '', t0: 0, line: '', lineT: -99, seed: Math.floor(g.unit() * 1e6) });
  const wizard = g.pick(WIZARDS);
  const household = [member('spirit', g.pick(SPIRITS)), member('wizard', wizard), member('apprentice', g.pick(APPRENTICES)), member('keeper', g.pick(KEEPERS))];
  const spirit = () => household[0];

  const castle: Castle = {
    name: g.pick(CASTLE_NAMES), wizard,
    x: GW / 2, y: land.GY - STAND * cs, cs, dir, tilt: 0, bob: 0,
    phase: g.unit(), speed: PACE, want: 1, pace,
    feet: [{ L: 0, L0: 0, lift: 0, planted: true }, { L: 0, L0: 0, lift: 0, planted: true }],
    steps: 0, miles: 0,
    door: { state: 'shut', t0: 0, place: 0, dial: 0, open: 0, next: 14 + g.range(0, 10), who: -1 },
    flare: 0, belch: 0, stopped: false, stopUntil: 0, why: '', limp: 0, washing: true,
    marks: { scorch: 0, patches: 0, tar: 0, flowers: 0, bunting: 0, soot: 0 },
    line: '', lineT: -99,
  };

  // eslint-disable-next-line prefer-const
  let world: CastleWorld;
  world = {
    t: 0, W, H, GW, GH, u, phone, bus,
    director: createDirector(forkRng(seed, 'castle-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    land, design, castle, places, household, cast: [], castIds: [],
    homeland: home.label, season, temper, sunSide: g.chance(0.5) ? 1 : -1,
    day: g.pick([0.3, 0.34, 0.42, 0.5, 0.56, 0.62, 0.67, 0.9]),
    dayLen: DAY_LEN, days: 0,
    X: 0, region: 'meadow', seg: null,
    sheep: [], flocks: [], ships: [], tar: [], fx: [], stars: [], gusts: [], walkers: [],
    burning: [], ruins: [], wrecks: [], struck: [], stains: [], puddles: [], arcs: [],
    rain: 0, storm: 0, flash: 0, bolt: null, rainbow: 0, wind: g.range(10, 26) * u * (g.chance(0.5) ? 1 : -1), wet: 0, mist: 0, guns: 0,
    drift: 0, bloom: 0, hen: null, market: null,
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    cards: [], subs: [], chronicle: [],
    step, nudge,
    xOf: (L, s) => GW / 2 + dir * (L - world.X * s),
    counts: () => ({
      miles: Math.round(castle.miles * 10) / 10,
      steps: castle.steps,
      sheep: world.sheep.length,
      flocks: world.flocks.length,
      ships: world.ships.length,
      tar: world.tar.length,
      fx: world.fx.length,
      marks: world.ruins.length + world.wrecks.length + world.struck.length + world.stains.length + world.puddles.length,
      doors: doorsOpened,
    }),
  };

  // ---- the verbs -----------------------------------------------------------------------------------
  function establish(): { x: number; y: number; zoom: number } {
    if (world && shotR() < 0.55) return { x: castle.x, y: castle.y - 90 * cs, zoom: 1.9 };
    return { x: GW / 2, y: GH / 2, zoom: 1 };
  }
  /** Into the log only: what happened, in a line. */
  const say = (text: string) => bus.emit({ type: 'say', text, priority: 'medium' });
  /** A title card on the screen, for a big moment, and into the log. */
  const card = (title: string, sub = '') => {
    if (world.cards.some((q) => q.title === title && world.t - q.t0 < 30)) return;
    world.cards.push({ title, sub, t0: world.t });
    if (world.cards.length > 3) world.cards.shift();
    bus.emit({ type: 'say', text: sub ? `${title}: ${sub}` : title, priority: 'high' });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, day: world.days + 1, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };
  /** Something said: a subtitle at the foot of the screen (one at a time; a queue keeps them apart). */
  const speak = (who: { name: string; line?: string; lineT?: number }, line: string, dur = 0) => {
    const last = world.subs[world.subs.length - 1];
    const start = last ? Math.max(world.t, last.t0 + last.dur + 0.4) : world.t;
    if (start - world.t > 8) return;
    if ('line' in who) {
      who.line = line;
      who.lineT = start;
    }
    world.subs.push({ who: who.name, line, t0: start, dur: dur || Math.max(3, 1.4 + line.length * 0.07) });
    if (world.subs.length > 6) world.subs.shift();
    bus.emit({ type: 'voice', text: `${who.name}: ${line}`, weight: 0.05, priority: 'low' });
  };
  const look = (why: string, x: number, y: number, zoom: number, hold: number, priority: number) => world.director.look(why, x, y, zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: FxKind, x: number, y: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 900) return;
    world.fx.push({ kind, x, y, vx: 0, vy: 0, s: 1, t0: world.t, dur: 3, r: 8 * u, color: '#d8d4cc', seed: Math.floor(r() * 1e6), grow: 1, ...extra });
  };
  /** A point on the castle (castle units) in the world now. */
  const at = (lx: number, ly: number): [number, number] => {
    const c = Math.cos(castle.tilt);
    const s = Math.sin(castle.tilt);
    const x = lx * dir;
    return [castle.x + (x * c - ly * s) * cs, castle.y + (x * s + ly * c) * cs];
  };
  const night = () => nightOf(world.day);
  const ctx: Ctx = { world, r, say, card, emit, chronicle, speak, fx, look, after, spirit };
  let doorsOpened = 0;
  const edge = (side: 1 | -1, off: number) => GW / 2 + side * (GW / 2 + off);
  const ahead = dir;
  const landL = (x: number) => world.X + dir * (x - GW / 2);
  const planeL = (x: number, s: number) => world.X * s + dir * (x - GW / 2);
  const someone = () => {
    const m = household.slice(1).filter((q) => q.where !== 'out');
    return m.length ? pick(m) : spirit();
  };
  const arc = (id: string, phase: Arc['phase']) => {
    const a = world.arcs.find((q) => q.id === id);
    if (a) {
      a.phase = phase;
      a.t0 = world.t;
    } else world.arcs.push({ id, phase, t0: world.t });
  };
  const endArc = (id: string) => (world.arcs = world.arcs.filter((q) => q.id !== id));

  // ---- the cast library ---------------------------------------------------------------------------
  const visibleFarTown = () => {
    const s = PLANES.far.s;
    const towns = land.farTownsIn(world.X * s - GW * 0.32, world.X * s + GW * 0.32);
    return towns.find((tw) => ![...world.burning, ...world.ruins].some((b) => Math.abs(b.L - tw.L) < 40 * u)) ?? null;
  };
  function spawnShip(kind: Ship['kind'], side: 0 | 1, x: number, y: number, s: number, vx: number, extra: Partial<Ship> = {}): Ship {
    const m = kind === 'bomber' ? 0.16 + s * 1.5 : 0.22 + s * 0.85;
    const sh: Ship = { id: ids++, kind, side, name: '', x, y, s, m, vx, vy: 0, dir: vx > 0 ? 1 : -1, state: 'pass', t0: world.t, seed: Math.floor(r() * 1e6), beat: r() * 6, hp: kind === 'bomber' ? 6 : 3, target: NaN, foe: -1, dropped: 0, fired: 0, ...extra };
    world.ships.push(sh);
    return sh;
  }
  const LIBRARY: SystemDef<Ctx>[] = [
    {
      id: 'war', label: 'the war', weight: 10, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        let phase: 'idle' | 'rumour' | 'raid' | 'after' = 'idle';
        let t0 = 0;
        let town: { L: number; name: string } | null = null;
        let hid = false;
        return {
          id: 'war',
          step(dt) {
            const age = w.t - t0;
            if (phase === 'idle') {
              w.guns = Math.max(0, w.guns - dt / 20);
              if (w.t < 30 || w.storm > 0.4 || !w.director.want('war', 0.5, 330)) return;
              phase = 'rumour';
              t0 = w.t;
              arc('war', 'build');
              c.after(6, () => c.speak(someone(), pick(LINES.guns, r)));
              // A lone scout high over, ahead of them.
              const side: 1 | -1 = r() < 0.5 ? 1 : -1;
              spawnShip('gunboat', 0, edge(side, 60 * u), GH * 0.12, 0.25, -side * 40 * u);
              c.say('Guns flash beyond the hills; a scout goes over.');
              c.emit('guns', GW / 2, land.HY, 0.3);
              return;
            }
            if (phase === 'rumour') {
              w.guns = Math.min(1, w.guns + dt / 10);
              if (age < 40) return;
              phase = 'raid';
              t0 = w.t;
              hid = false;
              arc('war', 'peak');
              const side: 1 | -1 = r() < 0.5 ? 1 : -1;
              const tw = visibleFarTown();
              town = tw ? { L: tw.L, name: tw.name } : null;
              // The bombers far off over the far hills, for the town, with their escort.
              const nb = phone ? 2 : 3;
              for (let k = 0; k < nb; k++) spawnShip('bomber', 0, edge(side, (80 + k * 80) * u), land.HY - GH * (0.1 + r() * 0.08), PLANES.far.s, -side * (16 + r() * 4) * u, { target: town ? town.L : NaN });
              // A great one overhead, low and slow, and its gunboats.
              spawnShip('bomber', 0, edge(side, 300 * u), GH * (phone ? 0.15 : 0.12), 0.42, -side * 22 * u);
              const ng = (phone ? 2 : 3) + Math.floor(r() * 2);
              for (let k = 0; k < ng; k++) spawnShip('gunboat', 0, edge(side, (140 + k * 70) * u), GH * (0.18 + r() * 0.1), 0.5 + r() * 0.2, -side * (34 + r() * 10) * u);
              // The other side's interceptors come in from the far edge to meet them.
              c.after(14, () => {
                if (phase !== 'raid') return;
                const ni = 2 + Math.floor(r() * 3);
                for (let k = 0; k < ni; k++) spawnShip('gunboat', 1, edge(-side as 1 | -1, (60 + k * 60) * u), GH * (0.14 + r() * 0.12), 0.5 + r() * 0.2, side * (52 + r() * 12) * u, { state: 'fight' });
                c.emit('dogfight', GW / 2, GH * 0.2, 0.6);
                c.look('dogfight', GW / 2, GH * 0.25, 1.35, 14, 6);
              });
              c.card('The War Fleet', town ? `making for ${town.name}` : 'high and slow, over the hills');
              c.emit('fleet', GW / 2, GH * 0.2, 0.7);
              c.look('fleet', GW / 2, GH * 0.3, 1.3, 12, 6);
              c.after(5, () => c.speak(someone(), pick(LINES.war, r)));
              // Some come down to look at the castle.
              if (r() < 0.65) c.after(22 + r() * 8, () => {
                const gb = w.ships.filter((q) => q.kind === 'gunboat' && q.side === 0 && q.state === 'pass').slice(0, 2);
                for (const q of gb) Object.assign(q, { state: 'look', t0: w.t, s: 1, m: 0.62 });
                if (gb.length) {
                  c.emit('gunboats', castle.x, castle.y - 200 * cs, 0.6);
                  c.look('gunboats', castle.x, castle.y - 150 * cs, 1.6, 12, 6);
                  c.speak(household[1].where === 'out' ? someone() : household[1], 'Gunboats. Don’t anybody wave.');
                }
              });
              return;
            }
            if (phase === 'raid') {
              w.guns = Math.max(0.3, w.guns - dt / 30);
              // Gunboats about the castle: they fire a burst; the spirit hides the castle in smoke.
              const lk = w.ships.filter((q) => q.state === 'look');
              if (lk.length && !hid && lk.every((q) => w.t - q.t0 > 12)) {
                hid = true;
                castle.belch = 1;
                if (r() < 0.6) {
                  castle.marks.scorch = Math.min(4, castle.marks.scorch + 1);
                  for (let k = 0; k < 10; k++) {
                    const [hx, hy] = at(-60 + r() * 160, -80 - r() * 140);
                    c.fx('spark', hx, hy, { vx: (r() - 0.5) * 60 * u, vy: -(20 + r() * 40) * u, dur: 0.8, r: 2 * u, color: '#ffc060' });
                  }
                  c.emit('shots', castle.x, castle.y, 0.5);
                }
                c.speak(spirit(), 'Smoke! I’ll give them smoke!');
                c.emit('hide', castle.x, castle.y, 0.5);
                for (const q of lk) Object.assign(q, { state: 'leave', t0: w.t, vx: (r() < 0.5 ? 1 : -1) * (90 + r() * 40) * u });
                c.chronicle('Gunboats came down to look at the castle; it hid in its own smoke until they went away.');
              }
              if (age > 75 && !w.ships.some((q) => q.state === 'bomb' || q.state === 'look' || q.state === 'fight')) {
                phase = 'after';
                t0 = w.t;
                arc('war', 'after');
                // The road fills with people walking away from it.
                const n = phone ? 3 : 5;
                for (let k = 0; k < n; k++) w.walkers.push({ id: ids++, x: edge(ahead, (40 + k * 55) * u), dz: GH * (0.075 + r() * 0.02), dir: (-ahead) as 1 | -1, ph: r() * 6, kind: k === 0 ? 'cart' : k === 3 ? 'goat' : k % 2 ? 'child' : 'walker', seed: Math.floor(r() * 1e6) });
                c.after(8, () => c.speak(household[3].where !== 'out' ? household[3] : spirit(), pick(LINES.after, r)));
                if (town) c.chronicle(`${town.name} burned on the far hills; the people came down the road with what they could carry.`);
              }
              return;
            }
            if (age > 80) {
              phase = 'idle';
              endArc('war');
            }
          },
          counts: () => ({ war: phase === 'idle' ? 0 : 1 }),
        };
      },
    },
    {
      id: 'tarmen', label: 'the tar men', weight: 7, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        let phase: 'idle' | 'signs' | 'chase' | 'after' = 'idle';
        let t0 = 0;
        return {
          id: 'tarmen',
          step(dt) {
            const age = w.t - t0;
            castle.marks.tar = Math.max(0, castle.marks.tar - dt / 600);
            castle.limp = Math.max(0, castle.limp - dt / 90);
            if (phase === 'idle') {
              if (w.t < 50 || castle.stopped || w.region === 'coast' || w.region === 'lake' || w.storm > 0.5 || !w.director.want('tar', 0.55, 280)) return;
              phase = 'signs';
              t0 = w.t;
              arc('tar', 'build');
              // Tar bubbling up in the grass behind it.
              for (let k = 0; k < 4; k++) w.stains.push({ L: landL(castle.x - dir * GW * (0.18 + k * 0.07)), dz: GH * (0.02 + r() * 0.07), t0: w.t, until: w.t + 900, k: 0.6 + r() * 0.4, seed: Math.floor(r() * 1e6) });
              c.after(5, () => c.speak(household[2].where !== 'out' ? household[2] : spirit(), 'Is that… tar? In the grass?'));
              c.say('Black tar bubbles up in the grass behind it.');
              return;
            }
            if (phase === 'signs') {
              if (age < 16) return;
              phase = 'chase';
              t0 = w.t;
              arc('tar', 'peak');
              const n = (phone ? 3 : 4) + Math.floor(r() * 3);
              for (let k = 0; k < n; k++) {
                const tm: TarMan = { id: ids++, x: castle.x - dir * (GW * (0.26 + r() * 0.1) + k * 30 * u), dz: GH * (0.015 + r() * 0.07), ph: r() * 6, state: 'rise', t0: w.t + k * 0.4, seed: Math.floor(r() * 1e6), size: 0.85 + r() * 0.35, vx: 0 };
                w.tar.push(tm);
              }
              c.card('The Tar Men', 'out of the grass, and running');
              c.emit('tarmen', castle.x - dir * GW * 0.3, land.GY, 0.7);
              c.look('tarmen', castle.x - dir * GW * 0.12, land.GY - 80 * u, 1.5, 14, 6);
              c.after(4, () => {
                castle.want = 1.9;
                c.speak(spirit(), pick(LINES.tar, r));
              });
              return;
            }
            if (phase === 'chase') {
              const live = w.tar.filter((q) => q.state !== 'melt');
              if (age > 45 || (!live.length && age > 8)) {
                for (const q of live) Object.assign(q, { state: 'melt', t0: w.t });
                castle.want = 1;
                castle.limp = 1;
                castle.marks.tar = 1;
                phase = 'after';
                t0 = w.t;
                arc('tar', 'after');
                c.after(3, () => c.speak(household[3].where !== 'out' ? household[3] : spirit(), 'Look at that leg. Tar to the knee.'));
                c.after(9, () => c.speak(spirit(), 'I’m limping. Well. We’re limping.'));
                c.chronicle('The tar men came after the castle out of the grass; it outran them, with tar to the knee.');
              }
              return;
            }
            if (age > 60) {
              phase = 'idle';
              endArc('tar');
            }
          },
          counts: () => ({ chasing: phase === 'chase' ? 1 : 0 }),
        };
      },
    },
    {
      id: 'storm', label: 'the storms', weight: () => 5 * temper, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let phase: 'idle' | 'gather' | 'storm' | 'clear' = 'idle';
        let until = 0;
        let struck = false;
        return {
          id: 'storm',
          step(dt) {
            if (phase === 'idle') {
              if (w.t < 70 || w.rain > 0.05 || !w.director.want('storm', 0.6, 400 / temper)) return;
              phase = 'gather';
              until = w.t + 30;
              struck = false;
              arc('storm', 'build');
              c.after(6, () => {
                castle.washing = false;
                c.speak(household[3].where !== 'out' ? household[3] : spirit(), 'Bring the washing in! Quick!');
              });
              for (let k = 0; k < 2; k++) c.after(k * 6, () => spawnFlock('swallows'));
              c.say('The sky darkens, and the wind gets up.');
              return;
            }
            if (phase === 'gather') {
              w.storm = Math.min(0.5, w.storm + dt / 50);
              if (w.t > until) {
                phase = 'storm';
                until = w.t + 70 + r() * 50;
                arc('storm', 'peak');
                c.card(`A Storm over ${titled(regionName())}`);
                c.emit('storm', GW / 2, GH * 0.2, 0.6);
                c.after(8, () => c.speak(spirit(), pick(LINES.spiritRain, r)));
              }
              return;
            }
            if (phase === 'storm') {
              w.storm = Math.min(1, w.storm + dt / 25);
              w.rain = Math.min(1, w.rain + dt / 18);
              if (w.storm > 0.6 && r() < dt * 0.13) {
                w.flash = 1;
                const x = GW * (0.08 + r() * 0.84);
                const strike = !struck && w.t > until - 50 && r() < 0.5;
                const y = strike ? land.midRidge(4, planeL(x, midS(4)))[0] : land.HY - GH * 0.01;
                w.bolt = { x, y, t0: w.t, seed: Math.floor(r() * 1e6) };
                c.emit('thunder', x, land.HY, 0.4);
                if (strike) {
                  struck = true;
                  w.struck.push({ L: planeL(x, midS(4)), t0: w.t, until: w.t + 1500, k: 1, seed: Math.floor(r() * 1e6) });
                  c.emit('struck', x, y, 0.7);
                  c.look('struck', x, y, 1.6, 8, 6);
                  c.after(1.5, () => c.speak(someone(), 'It hit the old tree! Look, it’s burning!'));
                  c.chronicle('Lightning struck a tree on the hills as the castle walked through the storm.');
                }
              }
              if (w.t > until) {
                phase = 'clear';
                arc('storm', 'after');
              }
              return;
            }
            w.storm = Math.max(0, w.storm - dt / 30);
            w.rain = Math.max(0, w.rain - dt / 24);
            w.wet = Math.min(1, w.wet + dt / 10);
            w.mist = Math.min(0.8, w.mist + dt / 30);
            if (w.storm <= 0 && w.rain <= 0) {
              phase = 'idle';
              endArc('storm');
              // Puddles on the hillside, and a rainbow if the sun is out.
              for (let k = 0; k < (phone ? 4 : 7); k++) w.puddles.push({ L: landL(GW * r()), dz: GH * (0.02 + r() * 0.14), t0: w.t, until: w.t + 600, k: 0.6 + r() * 0.6, seed: Math.floor(r() * 1e6) });
              c.after(20, () => {
                castle.washing = true;
              });
              rainbowAfter();
            }
          },
          counts: () => ({ storm: phase === 'idle' ? 0 : 1 }),
        };
      },
    },
    {
      id: 'showers', label: 'summer showers', weight: () => 6 / Math.max(0.6, temper), tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let phase = 0;
        let until = 0;
        return {
          id: 'showers',
          step(dt) {
            if (phase === 0) {
              const day = w.day > 0.3 && w.day < 0.68;
              if (w.t < 40 || !day || w.rain > 0.05 || w.storm > 0.1 || !w.director.want('shower', 0.35, 240)) return;
              phase = 1;
              until = w.t + 35 + r() * 25;
              c.say('A summer shower blows over.');
              c.emit('shower', GW / 2, GH * 0.2, 0.35);
              c.after(4, () => c.speak(spirit(), pick(LINES.spiritRain, r)));
              return;
            }
            if (phase === 1) {
              w.rain = Math.min(0.55, w.rain + dt / 10);
              w.storm = Math.min(0.3, w.storm + dt / 20);
              if (w.t > until) phase = 2;
            } else {
              w.rain = Math.max(0, w.rain - dt / 12);
              w.storm = Math.max(0, w.storm - dt / 15);
              w.wet = Math.min(0.7, w.wet + dt / 10);
              if (w.rain <= 0 && w.storm <= 0) {
                phase = 0;
                rainbowAfter(0.9);
              }
            }
          },
        };
      },
    },
    {
      id: 'lakes', label: 'the lakes at sundown', weight: 6, tags: ['journey'],
      create: (c) => {
        const w = c.world;
        let done = -1;
        return {
          id: 'lakes',
          step() {
            const sg = w.seg;
            if (!sg || sg.region !== 'lake' || !sg.stop || done === sg.seed) return;
            const q = (w.X - sg.x0) / (sg.x1 - sg.x0);
            if (q < 0.42 || w.day < 0.64 || w.day > 0.8) return;
            done = sg.seed;
            stopFor(80 + r() * 20, 'by the lake');
            arc('lake', 'peak');
            c.card(titled(sg.name), 'at sundown');
            c.emit('lake', castle.x, castle.y, 0.6);
            c.look('lake', castle.x + dir * GW * 0.12, land.lakeY, 1.35, 20, 6);
            c.chronicle(`We stopped by ${titled(sg.name)} and watched the sun go down over the water.`);
            for (const m of household.slice(1)) if (m.where === 'in') c.after(2 + r() * 8, () => goOut(m, r() < 0.5 ? 'deck' : 'balcony', 'watch'));
            c.after(10, () => c.speak(household[3].where !== 'out' ? household[3] : spirit(), pick(LINES.sunset, r)));
            c.after(70, () => endArc('lake'));
          },
        };
      },
    },
    {
      id: 'mountain', label: 'the mountain passes', weight: 4, tags: ['journey'],
      create: (c) => {
        const w = c.world;
        let top = -1;
        return {
          id: 'mountain',
          step() {
            const sg = w.seg;
            if (!sg || sg.region !== 'mountain' || top === sg.seed) return;
            const q = (w.X - sg.x0) / (sg.x1 - sg.x0);
            if (q < 0.5) return;
            top = sg.seed;
            c.card(`The Top of ${titled(sg.name).replace(/^The /, 'the ')}`, 'the whole country below');
            c.emit('summit', castle.x, castle.y, 0.6);
            c.look('summit', GW / 2, GH * 0.45, 1.2, 14, 6);
            c.after(3, () => c.speak(spirit(), 'Downhill! Finally! Mind you don’t trip.'));
            c.chronicle(`We climbed ${titled(sg.name)} and came down the other side.`);
          },
        };
      },
    },
    {
      id: 'market', label: 'market days', weight: 5, tags: ['town'],
      create: (c) => {
        const w = c.world;
        let done = -1;
        return {
          id: 'market',
          step() {
            const sg = w.seg;
            if (w.market && (w.seg !== w.market.seg || w.t - w.market.t0 > 150)) w.market = null;
            if (!sg || sg.region !== 'town' || !sg.market || done === sg.seed) return;
            const q = (w.X - sg.x0) / (sg.x1 - sg.x0);
            if (q < 0.2) return;
            done = sg.seed;
            w.market = { seg: sg, t0: w.t };
            const tx = w.xOf((sg.x0 + sg.x1) * 0.5 * midS(4), midS(4));
            c.card(`Market Day in ${titled(sg.name)}`, 'bunting, stalls and a band');
            c.emit('market', tx, land.HY, 0.5);
            c.look('market', tx, land.HY + GH * 0.06, 1.6, 14, 5);
            castle.want = 0.55;
            c.after(30, () => {
              if (castle.want === 0.55) castle.want = 1;
            });
            c.after(4, () => c.speak(household[2], 'Can we stop? Just for a pie? One pie?'));
            c.after(10, () => c.speak(spirit(), 'No pies. We’re walking.'));
            // The apprentice slips down and comes back with bunting for the castle.
            c.after(40, () => {
              castle.marks.bunting = 1;
              c.speak(household[2], 'I got bunting! For the castle!');
              c.chronicle(`It was market day in ${titled(sg.name)}; ${household[2].name} came back with bunting for the castle.`);
            });
          },
          counts: () => ({ market: w.market ? 1 : 0 }),
        };
      },
    },
    {
      id: 'flowers', label: 'the flower fields', weight: 5, tags: ['season'],
      create: (c) => {
        const w = c.world;
        let said = -1;
        return {
          id: 'flowers',
          step(dt) {
            const inBloom = w.region === 'flowers' || (w.seg?.region === 'meadow' && w.day > 0.3 && w.day < 0.7 && season !== 'autumn');
            w.bloom += ((inBloom ? (w.region === 'flowers' ? 1 : 0.35) : 0) - w.bloom) * dt * 0.05;
            if (w.region === 'flowers' && w.seg && said !== w.seg.seed && w.X - w.seg.x0 > 400 * u) {
              said = w.seg.seed;
              c.emit('bloom', castle.x, castle.y, 0.4);
              c.after(5, () => c.speak(household[3].where !== 'out' ? household[3] : household[2], 'Oh, will you smell that.'));
              c.after(30, () => {
                castle.marks.flowers = 1;
                c.speak(household[3].where !== 'out' ? household[3] : household[2], 'Flowers in every window box. There.');
              });
            }
          },
        };
      },
    },
    {
      id: 'starfall', label: 'the falling stars', weight: 3, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let landed = false;
        return {
          id: 'starfall',
          step(dt) {
            if (w.t < until) {
              if (r() < dt * 1.6) shootingStar(false);
              if (!landed && until - w.t < 12) {
                landed = true;
                const x = castle.x + dir * GW * (0.15 + r() * 0.2);
                shootingStar(true, x);
                c.after(1.4, () => {
                  for (let k = 0; k < 14; k++) c.fx('spark', x, land.GY + GH * 0.04, { vx: (r() - 0.5) * 60 * u, vy: -(30 + r() * 60) * u, dur: 1 + r(), r: 3 * u, color: '#ffe8a0' });
                  c.fx('flash', x, land.GY + GH * 0.04, { dur: 1.2, r: 60 * u, color: '#ffe8b0' });
                  w.puddles.push({ L: landL(x), dz: GH * 0.04, t0: w.t, until: w.t + 900, k: -1, seed: 7 });
                  c.emit('starland', x, land.GY, 0.6);
                  c.speak(household[2].where !== 'out' ? household[2] : spirit(), 'One landed! Right there, in the grass!');
                });
              }
              if (w.t >= until - dt) endArc('starfall');
              return;
            }
            if (night() < 0.8 || w.storm > 0.2 || w.t < 120 || !w.director.want('starfall', 0.8, 900)) return;
            until = w.t + 35;
            landed = false;
            arc('starfall', 'peak');
            c.card('A Shower of Falling Stars');
            c.emit('starfall', GW / 2, GH * 0.2, 0.8);
            c.look('starfall', GW / 2, GH * 0.35, 1.2, 20, 7);
            c.after(4, () => c.speak(household[2].where !== 'out' ? household[2] : spirit(), 'Wish! Quick, everybody wish!'));
            c.chronicle('A shower of falling stars came down over the night country, and one landed in the meadow.');
          },
        };
      },
    },
    {
      id: 'fireflies', label: 'fireflies', weight: 4, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'fireflies',
          step(dt) {
            const dusk = night() > 0.3 && w.storm < 0.3 && w.rain < 0.2 && (w.region === 'meadow' || w.region === 'lake' || w.region === 'flowers');
            if (dusk && r() < dt * 3) {
              const x = GW * r();
              c.fx('firefly', x, land.nearY(landL(x)) + GH * (0.01 + r() * 0.15), { vx: (r() - 0.5) * 8 * u, vy: -(r() * 4) * u, dur: 6 + r() * 6, r: 2 * u, color: '#e8ff90' });
            }
          },
        };
      },
    },
    {
      id: 'hencottage', label: 'the hen-legged cottage', weight: 1.2, tags: ['legendary'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'hencottage',
          step() {
            if (w.hen) {
              if (w.t - w.hen.t0 > w.hen.dur) {
                w.hen = null;
                endArc('hen');
              }
              return;
            }
            if (w.t < 200 || night() > 0.6 || w.storm > 0.2 || !w.director.want('hen', 0.9, 1500)) return;
            const s = PLANES.far.s;
            w.hen = { L: world.X * s + GW * 0.3, t0: w.t, dur: 80 };
            arc('hen', 'peak');
            c.card('Another Walking House', 'on hen’s legs, over the far hills');
            c.emit('hen', GW / 2 + dir * GW * 0.3, land.HY, 1);
            c.look('hen', GW / 2 + dir * GW * 0.25, land.HY, 1.6, 18, 8);
            c.after(5, () => {
              castle.belch = 0.5;
              c.speak(spirit(), 'Wheeep! Hello over there! Wheeep!');
              for (const [vx, vy] of design.vents) {
                const [x, y] = at(vx, vy);
                for (let k = 0; k < 4; k++) c.fx('steam', x, y, { vx: (r() - 0.5) * 30 * u, vy: -(40 + r() * 30) * u, dur: 2, r: 8 * cs, color: '#ffffff' });
              }
            });
            c.chronicle('Another walking house crossed the far hills on hen’s legs. We whistled, and it whistled back.');
          },
        };
      },
    },
  ];
  const RULE = { total: [4, 6] as [number, number], quota: { threat: [1, 2] as [number, number], weather: [1, 2] as [number, number], legendary: [0, 1] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);
  const has = (id: string) => world.castIds.includes(id);

  // ---- the route -------------------------------------------------------------------------------------
  const routeR = forkRng(seed, 'castle-route');
  const LEN: Record<Region, [number, number]> = { meadow: [3000, 4600], moor: [3000, 4200], lake: [3600, 4400], coast: [5000, 6400], mountain: [4600, 5600], flowers: [3400, 4200], town: [3000, 3800] };
  let segNo = 0;
  const dayAt = (Xc: number) => (world.day + (Xc - world.X) / PACE / DAY_LEN) % 1;
  function append() {
    const last = land.route[land.route.length - 1];
    const x0 = last ? last.x1 : -16000 * u;
    const w: Record<Region, number> = { ...fav };
    if (has('lakes')) w.lake += 1.5;
    if (has('mountain')) w.mountain += 2.2;
    if (has('flowers')) w.flowers += 2.2;
    if (has('market')) w.town += 1.6;
    let region: Region = 'meadow';
    if (last) {
      w[last.region] = 0;
      if (last.region === 'lake') w.coast = 0;
      if (last.region === 'coast') w.lake = 0;
      const len = (LEN.lake[0] + LEN.lake[1]) * 0.5 * u;
      const dayThen = dayAt(x0 + len * 0.5);
      // The lake at sundown: if it will be there at sundown, it is a lake.
      if (has('lakes') && last.region !== 'coast' && dayThen > 0.64 && dayThen < 0.74) region = 'lake';
      else {
        const keys = Object.keys(w) as Region[];
        const total = keys.reduce((a, k) => a + w[k], 0);
        let q = routeR() * total;
        for (const k of keys) {
          q -= w[k];
          if (q <= 0) {
            region = k;
            break;
          }
        }
      }
    } else {
      // Where it starts: the homeland's own country.
      const keys = (Object.keys(fav) as Region[]).filter((k) => k !== 'lake' && k !== 'coast' && k !== 'mountain');
      region = keys.sort((a, b) => fav[b] - fav[a])[routeR() < 0.7 ? 0 : 1];
    }
    const [a, b] = LEN[region];
    const len = (a + routeR() * (b - a)) * u * (last ? 1 : 4);
    const sx0 = last ? x0 : -len * 0.3;
    const sg: Segment = { region, x0: sx0, x1: sx0 + len, name: land.nameFor(region, segNo++), seed: Math.floor(routeR() * 1e6) };
    if (region === 'lake') sg.stop = dayAt(sx0 + len * 0.5) > 0.6 && dayAt(sx0 + len * 0.5) < 0.78;
    if (region === 'town') sg.market = has('market') && dayAt(sx0 + len * 0.3) > 0.3 && dayAt(sx0 + len * 0.3) < 0.7;
    land.route.push(sg);
  }
  const LOOK_AHEAD = () => (GW + 1400 * u) / midS(0) + 2000 * u;
  function ensureRoute() {
    while (!land.route.length || land.route[land.route.length - 1].x1 < world.X + LOOK_AHEAD() * 1.15) append();
    while (land.route.length > 3 && land.route[1].x1 < world.X - LOOK_AHEAD() * 1.6) land.route.shift();
  }
  ensureRoute();
  const regionName = () => world.seg?.name ?? 'the country';

  // ---- the castle -------------------------------------------------------------------------------------
  const hipL = (k: 0 | 1) => landL(castle.x + dir * (k ? design.hips.far[0] : design.hips.near[0]) * cs);
  for (const k of [0, 1] as const) {
    const p = (castle.phase + k * 0.5) % 1;
    const f = castle.feet[k];
    const S = STRIDE * cs;
    if (p < BETA) {
      f.L = hipL(k) + S / 2 - (p / BETA) * S;
      f.planted = true;
    } else {
      const q = (p - BETA) / (1 - BETA);
      f.L = hipL(k) - S / 2 + q * S;
      f.planted = false;
      f.L0 = hipL(k) - S / 2;
    }
  }
  let groundY = land.nearY(world.X);
  function stopFor(sec: number, why: string) {
    castle.want = 0;
    castle.stopUntil = world.t + sec;
    castle.why = why;
  }
  let sitting = 0;
  function walk(dt: number) {
    if (castle.want === 0 && world.t > castle.stopUntil && castle.stopUntil > 0) {
      castle.want = 1;
      castle.stopUntil = 0;
      castle.stopped = false;
      emit('walkon', castle.x, castle.y, 0.3);
      speak(spirit(), 'Up we get. Off we go.');
      for (const m of household.slice(1)) if (m.where === 'deck' || m.where === 'balcony') after(1 + r() * 4, () => goIn(m));
    }
    const slope = (land.nearY(world.X + 60 * u) - land.nearY(world.X - 60 * u)) / (120 * u);
    const climb = Math.max(0.55, 1 + slope * 2.5);
    const flare = castle.flare > 0.3 ? 1.5 : 1;
    const limp = 1 - castle.limp * 0.3;
    let target = PACE * castle.want * (castle.want > 0 ? climb * flare * limp : 0);
    if (target === 0) {
      const p = castle.phase;
      const both = (p >= 0.02 && p < BETA - 0.5) || (p >= 0.52 && p < BETA);
      if (!both || castle.speed > PACE * 0.3) target = PACE * 0.28;
      if (both && castle.speed <= PACE * 0.3) {
        castle.speed = 0;
        castle.stopped = true;
      }
    }
    if (!castle.stopped) castle.speed += (target - castle.speed) * Math.min(1, dt * 0.7);
    sitting = castle.stopped ? Math.min(1, sitting + dt / 3) : Math.max(0, sitting - dt / 1.5);
    const x0 = castle.x;
    castle.x = GW / 2 - dir * GW * (phone ? 0.02 : 0.05) + Math.sin(world.t / 83) * GW * (phone ? 0.02 : 0.04);
    // The limp: the near foot hurries through its step.
    const lim = castle.limp * 0.35 * Math.sin(castle.phase * Math.PI * 2);
    const dX = castle.speed * dt;
    world.X += dX;
    castle.miles += dX / (2400 * u);
    const ground = dX + dir * (castle.x - x0);
    if (ground > 0) castle.phase = (castle.phase + ((ground * BETA) / (STRIDE * cs)) * (1 + lim)) % 1;
    const S = STRIDE * cs;
    for (const k of [0, 1] as const) {
      const f = castle.feet[k];
      const p = (castle.phase + k * 0.5) % 1;
      const hl = hipL(k);
      if (p < BETA) {
        if (!f.planted) {
          f.planted = true;
          f.lift = 0;
          f.L = hl + S / 2;
          touchdown(k);
        }
      } else {
        if (f.planted) {
          f.planted = false;
          f.L0 = f.L;
        }
        const q = (p - BETA) / (1 - BETA);
        const e = q * q * (3 - 2 * q);
        f.L = f.L0 + (hl + S / 2 - f.L0) * e;
        f.lift = Math.sin(q * Math.PI) * 34 * (0.6 + 0.4 * Math.min(1.5, castle.speed / PACE)) * (k === 0 ? 1 - castle.limp * 0.4 : 1);
      }
    }
    const gy = (land.nearY(castle.feet[0].L) + land.nearY(castle.feet[1].L)) / 2;
    groundY += (gy - groundY) * Math.min(1, dt * 2.5);
    const moving = castle.stopped ? 0 : Math.min(1, castle.speed / (PACE * 0.5));
    const bob = Math.cos(4 * Math.PI * (castle.phase - 0.06)) * 5 * moving + castle.limp * 4 * Math.max(0, Math.sin(castle.phase * Math.PI * 2)) * moving;
    castle.bob = bob;
    // Sitting down by the lake, it folds its legs a little.
    castle.y = groundY - STAND * cs + bob * cs + sitting * 22 * cs;
    castle.tilt = (Math.sin(2 * Math.PI * castle.phase * 2 + 0.6) * 0.012 * moving + slope * 0.25 + castle.limp * 0.02 * Math.sin(castle.phase * Math.PI * 2)) * dir;
    castle.flare = Math.max(0, castle.flare - dt / 14);
    castle.belch = Math.max(0, castle.belch - dt / 9);
    castle.marks.soot = Math.max(0, castle.marks.soot - dt / 900);
    // The housekeeper patches the scorch, in time.
    if (castle.marks.scorch > 0 && r() < dt / 240) {
      castle.marks.scorch--;
      castle.marks.patches = Math.min(6, castle.marks.patches + 1);
      if (world.t - household[3].lineT > 20 && household[3].where !== 'out') speak(household[3], 'There. Patched. Good as new. Nearly.');
    }
    const thick = 1 + castle.flare * 3 + castle.belch * 6;
    for (const ch of design.chimneys) {
      if (r() > dt * 1.4 * thick) continue;
      const [x, y] = at(ch.x + ch.w / 2, ch.y - 2);
      const belch = castle.belch > 0.1;
      fx('smoke', x, y, { vx: world.wind * 0.35 + (r() - 0.5) * 6 * u, vy: -(18 + r() * 10 + castle.flare * 20) * u, dur: 5 + r() * 3 + castle.belch * 4, r: (6 + r() * 3) * cs * (belch ? 2 : 1), color: belch ? '#4a4648' : ch.smoke, grow: belch ? 4 : 3 });
      if (castle.flare > 0.2 && r() < 0.5) fx('spark', x, y, { vx: (r() - 0.5) * 30 * u, vy: -(40 + r() * 40) * u, dur: 1 + r(), r: 2 * u, color: '#ffc060' });
    }
    if (night() > 0.5 && r() < dt * 0.6) {
      const ch = design.chimneys[0];
      const [x, y] = at(ch.x + ch.w / 2, ch.y - 2);
      fx('spark', x, y, { vx: (r() - 0.5) * 16 * u, vy: -(30 + r() * 20) * u, dur: 1.4, r: 1.6 * u, color: '#ffb050' });
    }
    door(dt);
  }
  function touchdown(k: 0 | 1) {
    castle.steps++;
    const f = castle.feet[k];
    const x = world.xOf(f.L, 1);
    const y = land.nearY(f.L);
    const hard = Math.min(1.6, castle.speed / PACE);
    const muddy = world.rain > 0.3 || world.wet > 0.4;
    for (let q = 0; q < 4; q++) fx('dust', x + (r() - 0.5) * 40 * cs, y - 2 * u, { vx: (r() - 0.5) * 30 * u - dir * 8 * u, vy: -(4 + r() * 8) * u, dur: 1.6 + r(), r: (6 + r() * 6) * cs * hard * (muddy ? 0.6 : 1), color: muddy ? '#7a6a58' : '#c8b898', grow: 2 });
    if (muddy) for (let q = 0; q < 5; q++) fx('splash', x + (r() - 0.5) * 30 * cs, y - 2 * u, { vx: (r() - 0.5) * 50 * u, vy: -(30 + r() * 30) * u, dur: 0.6, r: 1.5 * u, color: '#c8d4e0' });
    const vs = design.vents;
    if (vs.length) {
      const [vx, vy] = vs[castle.steps % vs.length];
      const [px, py] = at(vx, vy);
      fx('steam', px, py, { vx: -dir * (20 + r() * 16) * u + world.wind * 0.3, vy: -(16 + r() * 12) * u, dur: 1.8, r: 5 * cs, color: '#f4f2ee', grow: 3 });
    }
    const [kx, ky] = at(k ? design.hips.far[0] + 30 : design.hips.near[0] + 30, 60);
    if (r() < 0.6) fx('steam', kx, ky, { vx: -dir * (14 + r() * 10) * u, vy: -(6 + r() * 6) * u, dur: 1.2, r: 4 * cs, color: '#ffffff', grow: 2.5 });
    for (const sh of world.sheep) {
      if (sh.plane !== 'near' || sh.state === 'flee') continue;
      if (Math.abs(sh.x - x) < 120 * cs && sh.dz < GH * 0.09) {
        sh.state = 'flee';
        sh.t0 = world.t;
        sh.vx = Math.sign(sh.x - x || 1) * (40 + r() * 30) * u;
        if (world.director.want('sheep', 0.12, 50)) {
          say('The sheep scatter from its feet.');
          emit('sheep', x, y, 0.2);
          if (r() < 0.4) speak(spirit(), 'Sorry! Sorry, sheep!');
        }
      }
    }
  }

  // ---- the door ---------------------------------------------------------------------------------------
  function openDoor(place: number, who = -1) {
    const d = castle.door;
    if (d.state !== 'shut') return false;
    d.state = 'turning';
    d.t0 = world.t;
    d.dial = d.place;
    d.place = place;
    d.who = who;
    return true;
  }
  function door(dt: number) {
    const d = castle.door;
    const age = world.t - d.t0;
    if (d.state === 'shut') {
      d.open = Math.max(0, d.open - dt * 2);
      if (world.t < d.next) return;
      d.next = world.t + 30 + r() * 40;
      if (!world.director.want('door', 0.15, 24)) return;
      const wiz = household[1];
      const n = night();
      let place = 0;
      let who = -1;
      if (wiz.where === 'out' && wiz.act === 'war' && n < 0.5) {
        place = 3;
        who = wiz.id;
      } else if (n > 0.6 && wiz.where !== 'out' && r() < 0.5) {
        place = 3;
        who = wiz.id;
      } else {
        place = pick([0, 0, 1, 2], r);
        who = place === 0 ? household[2].id : place === 1 ? wiz.id : household[3].id;
      }
      openDoor(place, who);
    } else if (d.state === 'turning') {
      if (age > 1.8) {
        d.state = 'open';
        d.t0 = world.t;
        doorsOpened++;
        const p = places[d.place];
        const m = household.find((q) => q.id === d.who);
        const [x, y] = at(design.door.x + design.door.w / 2, design.door.y);
        say(`The dial turns to ${p.label}; the door opens on ${p.name}.`);
        emit('door', x, y, 0.35);
        look('door', x, y - 20 * cs, 2.4, 9, 4);
        if (m) {
          if (m.where === 'out') {
            m.where = 'in';
            after(1.2, () => speak(m, p.kind === 'war' ? 'Home. Don’t ask.' : p.kind === 'port' ? 'Fish! And a loaf, and the news.' : p.kind === 'flowers' ? 'Flowers for every room.' : 'Home. What a day.'));
            if (p.kind === 'war') castle.marks.soot = 1;
          } else if (m.where === 'in' && r() < 0.7) {
            m.where = 'out';
            m.act = p.kind;
            m.t0 = world.t;
            after(1.2, () => speak(m, p.kind === 'war' ? 'Don’t wait up.' : p.kind === 'port' ? 'Back soon! I’m getting fish.' : p.kind === 'royal' ? 'The king again. What now?' : 'I’ll bring back an armful.'));
            if (p.kind === 'war') chronicle(`By night ${m.name} went out by the black door, to the war.`);
          }
        }
      }
    } else if (d.state === 'open') {
      d.open = Math.min(1, d.open + dt * 1.6);
      if (age > 8 + (d.place === 3 ? 2 : 0)) {
        d.state = 'closing';
        d.t0 = world.t;
      }
    } else if (d.state === 'closing') {
      d.open = Math.max(0, d.open - dt * 1.4);
      if (d.open <= 0) d.state = 'shut';
    }
    for (const m of household) {
      if (m.where !== 'out' || world.t - m.t0 < (m.act === 'war' ? 220 : 90)) continue;
      if (m.act === 'war' && night() > 0.5 && world.t - m.t0 < 400) continue;
      if (d.state === 'shut' && world.t > d.next - 20) {
        d.next = world.t + 40 + r() * 30;
        openDoor(DOOR.findIndex((q) => q.kind === m.act), m.id);
      }
    }
  }

  // ---- the household -----------------------------------------------------------------------------------
  function goOut(m: Member, where: 'deck' | 'balcony', act: string) {
    if (m.where !== 'in') return;
    m.where = where;
    m.spot = where === 'balcony' ? Math.floor(r() * Math.max(1, design.balconies.length)) : 0;
    m.act = act;
    m.t0 = world.t;
  }
  function goIn(m: Member) {
    if (m.where === 'deck' || m.where === 'balcony') {
      m.where = 'in';
      m.t0 = world.t;
    }
  }
  let nextVoice = 7;
  let nextOut = 20;
  function voices(dt: number) {
    nextOut -= dt;
    if (nextOut < 0) {
      nextOut = 25 + r() * 30;
      const m = pick(household.slice(1), r);
      if (m.where === 'in' && world.rain < 0.3 && world.storm < 0.4) {
        const act = m.role === 'keeper' ? pick(['wash', 'sweep', 'beat'], r) : m.role === 'apprentice' ? pick(['spyglass', 'wave', 'fish'], r) : pick(['look', 'pipe'], r);
        goOut(m, m.role === 'keeper' && act === 'wash' ? 'balcony' : r() < 0.5 ? 'deck' : 'balcony', act);
      } else if ((m.where === 'deck' || m.where === 'balcony') && !castle.stopped) goIn(m);
    }
    if (world.rain > 0.4) for (const m of household) if ((m.where === 'deck' || m.where === 'balcony') && r() < dt * 0.5) goIn(m);
    // Something said every so often (subtitles keep themselves apart).
    nextVoice -= dt;
    if (nextVoice > 0) return;
    nextVoice = 11 + r() * 10;
    const sp = spirit();
    const out = household.slice(1).filter((m) => (m.where === 'deck' || m.where === 'balcony') && world.t - m.lineT > 20);
    const roll = r();
    if (world.tar.some((q) => q.state === 'chase')) speak(pick([sp, ...household.slice(1).filter((m) => m.where !== 'out')], r), pick(LINES.tar, r));
    else if (world.ships.length && roll < 0.5) speak(out.length ? pick(out, r) : sp, pick(LINES.war, r));
    else if (out.length && roll < 0.55) {
      const m = pick(out, r);
      speak(m, castle.stopped ? pick(LINES.sunset, r) : m.role === 'keeper' ? pick(LINES.keeper, r) : m.role === 'apprentice' ? pick(LINES.apprentice, r) : pick(LINES.wizard, r));
    } else if (world.t - sp.lineT > 14) {
      speak(sp, world.rain > 0.3 ? pick(LINES.spiritRain, r) : night() > 0.6 && r() < 0.5 ? pick(LINES.spiritNight, r) : pick(LINES.spirit, r));
    }
  }
  let nextFlare = 70 + r() * 60;
  function flares() {
    if (world.t < nextFlare) return;
    nextFlare = world.t + 90 + r() * 90;
    if (castle.stopped || !world.director.want('flare', 0.35, 100)) return;
    castle.flare = 1;
    castle.marks.soot = Math.min(1, castle.marks.soot + 0.3);
    const sp = spirit();
    const [x, y] = at(design.hearth.x, design.hearth.y);
    say(`${sp.name} flares up in the hearth, and every chimney belches.`);
    emit('flare', x, y, 0.5);
    look('flare', castle.x, castle.y - 120 * cs, 2, 8, 6);
    speak(sp, pick(['Wheee! Hold on to your hats!', 'Who wants to go fast?', 'That was a good log. A very good log.', 'Feel that? That’s me, that is.'], r));
  }

  // ---- the life of the country -------------------------------------------------------------------------
  let nextFlock = 8 + r() * 8;
  let nextSheep = 0;
  const grazing = (rg: Region) => rg === 'meadow' || rg === 'moor' || rg === 'flowers' || rg === 'mountain' || rg === 'lake';
  function spawnSheep(x: number, plane: 'near' | 'mid', n: number) {
    const base = plane === 'near' ? GH * (0.02 + r() * 0.1) : r();
    for (let k = 0; k < n; k++) {
      const sh: Sheep = { id: ids++, x: x + (r() - 0.5) * (plane === 'near' ? 160 : 60) * u, dz: plane === 'near' ? Math.max(GH * 0.006, base + (r() - 0.5) * GH * 0.05) : clamp01(base + (r() - 0.5) * 0.2), plane, dir: r() < 0.5 ? 1 : -1, ph: r() * 6, state: 'graze', t0: world.t - r() * 10, seed: Math.floor(r() * 1e6), black: r() < 0.06, lamb: r() < 0.2, vx: 0 };
      world.sheep.push(sh);
    }
  }
  function life(dt: number, dX: number) {
    nextSheep -= dX;
    if (nextSheep < 0) {
      nextSheep = (500 + r() * 900) * u;
      const L = landL(edge(ahead, 80 * u));
      if (grazing(land.regionAt(L).a) && world.sheep.filter((q) => q.plane === 'near').length < (phone ? 10 : 18)) spawnSheep(edge(ahead, 60 * u + r() * 100 * u), 'near', 2 + Math.floor(r() * (phone ? 4 : 7)));
      const Lm = planeL(edge(ahead, 40 * u), midS(4)) / midS(4);
      if (grazing(land.regionAt(Lm).a) && r() < 0.7 && world.sheep.filter((q) => q.plane === 'mid').length < 30) spawnSheep(edge(ahead, 40 * u), 'mid', 3 + Math.floor(r() * 8));
    }
    for (const sh of world.sheep) {
      const s = sh.plane === 'near' ? 1 : midS(4);
      sh.x -= dir * dX * s;
      const age = world.t - sh.t0;
      if (sh.state === 'flee') {
        sh.x += sh.vx * dt;
        sh.dz = Math.min(GH * 0.16, sh.dz + dt * 8 * u);
        sh.ph += dt * 9;
        sh.dir = sh.vx > 0 ? 1 : -1;
        if (age > 3 + (sh.seed % 3)) {
          sh.state = 'graze';
          sh.t0 = world.t;
        }
      } else if (sh.state === 'walk') {
        sh.x += sh.dir * 6 * u * dt * (sh.plane === 'near' ? 1 : 0.3);
        sh.ph += dt * 4;
        if (age > 4) {
          sh.state = 'graze';
          sh.t0 = world.t;
        }
      } else if (age > 6 + (sh.seed % 9) && r() < dt * 0.3) {
        sh.state = 'walk';
        sh.t0 = world.t;
        if (r() < 0.4) sh.dir = sh.dir > 0 ? -1 : 1;
      }
    }
    world.sheep = world.sheep.filter((sh) => Math.abs(sh.x - GW / 2) < GW / 2 + 300 * u);
    // People on the road (after the war): walking the other way, slowly.
    for (const wk of world.walkers) {
      wk.x -= dir * dX;
      wk.x += wk.dir * (wk.kind === 'cart' ? 9 : 11) * u * dt;
      wk.ph += dt * 4;
    }
    world.walkers = world.walkers.filter((wk) => Math.abs(wk.x - GW / 2) < GW / 2 + 400 * u);
    nextFlock -= dt;
    if (nextFlock < 0) {
      nextFlock = (phone ? 22 : 14) + r() * 18;
      if (world.flocks.length < 4 && world.storm < 0.6) {
        const kind: Flock['kind'] = world.region === 'coast' ? (r() < 0.7 ? 'gulls' : 'geese') : night() > 0.6 ? 'geese' : pick(['rooks', 'geese', 'swallows', 'starlings', 'rooks'], r);
        spawnFlock(kind);
      }
    }
    for (const f of world.flocks) {
      f.x += f.vx * dt - dir * dX * f.s;
      f.y += f.vy * dt;
      for (const b of f.birds) b.ph += dt * (f.kind === 'geese' ? 5 : f.kind === 'gulls' ? 3.5 : 9);
      if (f.kind === 'swallows') {
        f.vx += (castle.x - f.x) * dt * 0.05 + Math.sin(world.t * 0.7 + f.seed) * 20 * u * dt;
        f.vy = Math.sin(world.t * 1.3 + f.seed) * 30 * u;
      }
      if (f.kind === 'starlings') for (const [i, b] of f.birds.entries()) {
        b.dx += Math.sin(world.t * 0.8 + i * 0.7) * dt * 12 * u;
        b.dy += Math.cos(world.t * 0.6 + i * 1.1) * dt * 8 * u;
      }
    }
    world.flocks = world.flocks.filter((f) => world.t - f.t0 < 90 && Math.abs(f.x - GW / 2) < GW / 2 + 500 * u);
  }
  function spawnFlock(kind: Flock['kind'], x?: number, y?: number) {
    const side: 1 | -1 = r() < 0.5 ? 1 : -1;
    const n = kind === 'geese' ? 7 + Math.floor(r() * 9) : kind === 'swallows' ? 3 + Math.floor(r() * 4) : kind === 'starlings' ? 30 + Math.floor(r() * 30) : 5 + Math.floor(r() * 10);
    const s = kind === 'swallows' ? 1 : kind === 'geese' ? 0.15 + r() * 0.2 : 0.3 + r() * 0.4;
    const m = kind === 'swallows' ? 1 : 0.35 + s * 0.8;
    const sx = x ?? edge(side, 60 * u);
    const sy = y ?? (kind === 'swallows' ? land.GY - 60 * u : GH * (0.1 + r() * 0.25));
    const birds = Array.from({ length: n }, (_, i) => {
      if (kind === 'geese') {
        const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        return { x: Math.abs(k) * 16 * u * side, y: Math.abs(k) * 7 * u + (k < 0 ? 2 * u : 0), ph: r() * 6, dx: 0, dy: 0 };
      }
      return { x: (r() - 0.5) * (kind === 'starlings' ? 120 : 80) * u, y: (r() - 0.5) * (kind === 'starlings' ? 50 : 40) * u, ph: r() * 6, dx: 0, dy: 0 };
    });
    const f: Flock = { id: ids++, kind, x: sx, y: sy, vx: x !== undefined ? (r() - 0.5) * 60 * u : -side * (kind === 'geese' ? 30 : kind === 'gulls' ? 20 : 26) * u, vy: x !== undefined ? -30 * u : 0, s, m, birds, t0: world.t, seed: Math.floor(r() * 1e6) };
    world.flocks.push(f);
    return f;
  }

  // ---- the war in the air, the tar men -------------------------------------------------------------------
  function ships(dt: number, dX: number) {
    for (const sh of world.ships) {
      sh.beat += dt * (sh.kind === 'bomber' ? 2.2 : 7);
      sh.x += sh.vx * dt - dir * dX * sh.s;
      sh.y += sh.vy * dt;
      const age = world.t - sh.t0;
      if (sh.state === 'pass' && Number.isFinite(sh.target)) {
        const tx = world.xOf(sh.target, PLANES.far.s);
        if (Math.abs(sh.x - tx) < 30 * u) {
          sh.state = 'bomb';
          sh.t0 = world.t;
          if (!world.burning.some((b) => Math.abs(b.L - sh.target) < 40 * u)) {
            const town = land.farTownsIn(sh.target - 1, sh.target + 1)[0];
            const name = town?.name ?? 'the town';
            card(`${name} Is Burning`);
            emit('bombing', tx, land.HY, 0.8);
            look('bombing', tx, land.HY - 30 * u, 1.8, 14, 7);
            world.burning.push({ L: sh.target, name, t0: world.t + 3, until: world.t + 200 + r() * 120, k: 1, seed: Math.floor(r() * 1e6) });
          }
        }
      }
      if (sh.state === 'bomb') {
        if (r() < dt * 2.4 && sh.dropped < 12) {
          sh.dropped++;
          fx('bomb', sh.x, sh.y + 6 * u, { vx: sh.vx * 0.6, vy: 10 * u, s: sh.s, dur: 3, r: 1.5 * u, color: '#2a2628' });
        }
        if (age > 9) {
          sh.state = 'leave';
          sh.t0 = world.t;
        }
      } else if (sh.state === 'look') {
        const tx = castle.x + Math.sin(world.t * 0.4 + sh.seed) * 220 * cs;
        const ty = castle.y - (280 + Math.sin(world.t * 0.6 + sh.seed) * 60) * cs;
        sh.vx += ((tx - sh.x) * 0.4 - sh.vx) * dt;
        sh.y += (ty - sh.y) * dt * 0.4;
        sh.dir = sh.vx > 0 ? 1 : -1;
      } else if (sh.state === 'fight') {
        // An interceptor: after the nearest of the other side at its depth, firing tracer when close.
        let foe = world.ships.find((q) => q.id === sh.foe && q.state !== 'fall' && q.state !== 'leave');
        if (!foe) {
          const cands = world.ships.filter((q) => q.side !== sh.side && q.kind === 'gunboat' && (q.state === 'pass' || q.state === 'fight') && Math.abs(q.s - sh.s) < 0.4);
          foe = cands.sort((a, b) => Math.abs(a.x - sh.x) - Math.abs(b.x - sh.x))[0];
          sh.foe = foe ? foe.id : -1;
          if (foe && foe.state === 'pass') Object.assign(foe, { state: 'fight', foe: sh.id });
        }
        if (foe) {
          const dx = foe.x - sh.x + Math.sin(world.t * 0.8 + sh.seed) * 60 * u;
          const dy = foe.y - sh.y + Math.cos(world.t * 0.7 + sh.seed) * 30 * u;
          sh.vx += (Math.sign(dx) * 70 * u - sh.vx) * dt * 0.8;
          sh.vy += (Math.sign(dy) * Math.min(30 * u, Math.abs(dy)) - sh.vy) * dt;
          sh.dir = sh.vx > 0 ? 1 : -1;
          if (Math.abs(dx) < 220 * u && Math.abs(dy) < 70 * u && r() < dt * 3) {
            sh.fired++;
            const sp = 600 * u;
            const d = Math.hypot(dx, dy) || 1;
            fx('tracer', sh.x + sh.dir * 12 * sh.m * u, sh.y, { vx: (dx / d) * sp, vy: (dy / d) * sp, s: sh.s, dur: Math.min(0.5, d / sp), r: 1.4 * u, color: sh.side ? '#ffe08a' : '#ffa070' });
            if (r() < 0.12) {
              foe.hp--;
              fx('flak', foe.x, foe.y, { s: foe.s, dur: 0.5, r: 6 * u, color: '#ffd090' });
              if (foe.hp <= 0) {
                foe.state = 'fall';
                foe.t0 = world.t;
                emit('downed', foe.x, foe.y, 0.7);
                look('downed', foe.x, foe.y + 60 * u, 1.4, 8, 7);
                say('A gunboat is hit, and goes down burning behind the hills.');
              }
            }
          }
        } else if (age > 25) {
          sh.state = 'leave';
          sh.t0 = world.t;
          sh.vx = sh.dir * 70 * u;
        }
        if (age > 60) sh.state = 'leave';
      } else if (sh.state === 'fall') {
        sh.vy += 26 * u * dt;
        sh.vx *= Math.exp(-dt * 0.3);
        if (r() < dt * 14) fx('smoke', sh.x, sh.y, { s: sh.s, vx: world.wind * 0.2, vy: -6 * u, dur: 5, r: 5 * u * sh.m * 2, color: '#3a3436', grow: 3 });
        if (r() < dt * 6) fx('fire', sh.x, sh.y, { s: sh.s, dur: 0.5, r: 5 * u * sh.m * 2, color: '#ff8a30' });
        const Lm = planeL(sh.x, midS(2));
        if (sh.y > land.midRidge(2, Lm)[0]) {
          sh.state = 'leave';
          sh.y = 99999;
          world.wrecks.push({ L: Lm, t0: world.t, until: world.t + 1500, k: 1, seed: sh.seed });
          fx('flash', sh.x, land.midRidge(2, Lm)[0], { s: midS(2), dur: 0.9, r: 50 * u, color: '#ffc080' });
          chronicle('A gunboat came down burning on the hills; we saw its smoke for miles.');
        }
      } else if (sh.state === 'leave') {
        sh.y -= dt * 10 * u;
      }
    }
    world.ships = world.ships.filter((sh) => sh.y < 9999 && Math.abs(sh.x - GW / 2) < GW / 2 + 600 * u && world.t - sh.t0 < 220);
    for (const b of world.burning) {
      if (world.t < b.t0) continue;
      const x = world.xOf(b.L, PLANES.far.s);
      const y = land.farTop(1, b.L);
      const heat = clamp01((b.until - world.t) / 60);
      if (r() < dt * 2.2 * heat) fx('smoke', x + (r() - 0.5) * 24 * u, y, { vx: world.wind * 0.12, vy: -(5 + r() * 4) * u, s: PLANES.far.s, dur: 14 + r() * 8, r: (5 + r() * 4) * u, color: '#3a3634', grow: 5 });
      if (r() < dt * 1.2 * heat) fx('fire', x + (r() - 0.5) * 26 * u, y - 2 * u, { vy: -2 * u, s: PLANES.far.s, dur: 1.4 + r(), r: (3 + r() * 3) * u, color: '#ff8030' });
    }
    // A town burnt out is a ruin, with a thread of smoke, for as long as it is in sight.
    for (const b of world.burning) if (world.t >= b.until) world.ruins.push({ ...b, t0: world.t, until: world.t + 3600 });
    world.burning = world.burning.filter((b) => world.t < b.until);
    const keep = (m: Mark, s: number) => world.t < m.until && Math.abs(world.xOf(m.L, s) - GW / 2) < GW * 1.2;
    world.ruins = world.ruins.filter((m) => keep(m, PLANES.far.s));
    world.wrecks = world.wrecks.filter((m) => keep(m, midS(2)));
    world.struck = world.struck.filter((m) => keep(m, midS(4)));
    world.stains = world.stains.filter((m) => keep(m, 1));
    world.puddles = world.puddles.filter((m) => keep(m, 1));
    // Smoke from what still smoulders.
    for (const wk of world.wrecks) {
      const k = clamp01(1 - (world.t - wk.t0) / 900);
      if (r() < dt * 1.5 * k) fx('smoke', world.xOf(wk.L, midS(2)), land.midRidge(2, wk.L)[0], { s: midS(2), vx: world.wind * 0.2, vy: -(6 + r() * 4) * u, dur: 10, r: 4 * u, color: '#4a4446', grow: 4 });
    }
    for (const st of world.struck) {
      const age = world.t - st.t0;
      const x = world.xOf(st.L, midS(4));
      const y = land.midRidge(4, st.L)[0];
      if (age < 60 && r() < dt * 6) fx('fire', x + (r() - 0.5) * 8 * u, y - 14 * u - r() * 10 * u, { s: midS(4), vy: -8 * u, dur: 0.8, r: 4 * u, color: '#ff9030' });
      if (age < 300 && r() < dt * 2 * clamp01(1 - age / 300)) fx('smoke', x, y - 20 * u, { s: midS(4), vx: world.wind * 0.2, vy: -(6 + r() * 4) * u, dur: 8, r: 3 * u, color: '#5a5456', grow: 4 });
    }
  }
  function tarMen(dt: number, dX: number) {
    for (const tm of world.tar) {
      const age = world.t - tm.t0;
      tm.x -= dir * dX;
      if (age < 0) continue;
      tm.ph += dt * 6;
      if (tm.state === 'rise') {
        if (age > 2.2) {
          tm.state = 'chase';
          tm.t0 = world.t;
        }
      } else if (tm.state === 'chase') {
        const run = PACE * (1.25 + (tm.seed % 7) * 0.03);
        tm.x += dir * run * dt;
        if (r() < dt * 3) fx('splash', tm.x, land.nearY(landL(tm.x)) + tm.dz, { vx: -dir * 20 * u, vy: -20 * u, dur: 0.7, r: 2 * u, color: '#2a2224' });
        if (r() < dt * 0.25) world.stains.push({ L: landL(tm.x), dz: tm.dz, t0: world.t, until: world.t + 900, k: 0.4, seed: Math.floor(r() * 1e6) });
        const near = castle.feet.map((f) => world.xOf(f.L, 1));
        if (near.some((fx0) => Math.abs(fx0 - tm.x) < 26 * cs) && tm.dz < GH * 0.05 && !world.tar.some((q) => q.state === 'cling')) {
          tm.state = 'cling';
          tm.t0 = world.t;
          emit('cling', tm.x, land.GY, 0.4);
          speak(spirit(), 'One’s got my foot! Get off! Get off!');
        }
        if (Math.abs(tm.x - castle.x) > GW * 0.7) {
          tm.state = 'melt';
          tm.t0 = world.t;
        }
      } else if (tm.state === 'cling') {
        const f = castle.feet[0];
        tm.x = world.xOf(f.L, 1);
        if (age > 3 && f.lift > 20) {
          tm.state = 'melt';
          tm.t0 = world.t;
          tm.vx = -dir * 80 * u;
          emit('kick', tm.x, land.GY, 0.4);
          after(0.5, () => speak(spirit(), 'And stay off!'));
        }
      } else {
        tm.x += tm.vx * dt;
        tm.vx *= Math.exp(-dt * 2);
      }
    }
    world.tar = world.tar.filter((tm) => !(tm.state === 'melt' && world.t - tm.t0 > 3.5));
  }

  // ---- the sky -----------------------------------------------------------------------------------------
  function rainbowAfter(p = 0.75) {
    if (world.day < 0.3 || world.day > 0.7 || r() > p) return;
    world.rainbow = 0.0001;
    after(5, () => {
      card(`A Rainbow over ${titled(regionName())}`);
      emit('rainbow', GW / 2, GH * 0.2, 0.6);
      look('rainbow', GW / 2, GH * 0.4, 1.15, 14, 6);
      speak(household[2].where !== 'out' ? household[2] : household[3], 'A rainbow! A double one, nearly!');
    });
  }
  let rainbowUp = 0;
  function shootingStar(fall: boolean, toX?: number) {
    const side = r() < 0.5 ? 1 : -1;
    const x = toX !== undefined ? toX - side * 260 * u : GW * (0.1 + r() * 0.8);
    const y = GH * (0.04 + r() * 0.22);
    const sp = (420 + r() * 300) * u;
    const ang = 0.35 + r() * 0.4;
    world.stars.push({ x, y, vx: side * Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t0: world.t, dur: fall ? 1.4 : 0.8 + r() * 0.6, fall });
  }
  let nextStar = 30;
  function sky(dt: number) {
    world.flash = Math.max(0, world.flash - dt * 2.5);
    if (world.bolt && world.t - world.bolt.t0 > 0.5) world.bolt = null;
    const base = Math.sign(world.wind || 1) * (14 + Math.sin(world.t * 0.021) * 8 + Math.sin(world.t * 0.067) * 5) * u * (0.8 + temper * 0.3);
    world.wind += (base * (1 + world.storm * 2.5) - world.wind) * dt * 0.1;
    world.drift += world.wind * dt;
    if (world.rain <= 0.01) world.wet = Math.max(0, world.wet - dt / 200);
    world.mist = Math.max(0, world.mist - dt / 160);
    if (world.rainbow > 0) {
      rainbowUp += dt;
      world.rainbow = rainbowUp < 70 ? Math.min(1, world.rainbow + dt / 8) : Math.max(0, world.rainbow - dt / 12);
      if (world.rainbow <= 0) rainbowUp = 0;
    }
    nextStar -= dt;
    if (nextStar < 0 && night() > 0.75 && world.storm < 0.2) {
      nextStar = 30 + r() * 50;
      shootingStar(false);
      if (world.director.want('star', 0.12, 60)) {
        say('A shooting star.');
        emit('star', GW / 2, GH * 0.1, 0.25);
        if (r() < 0.3) speak(someone(), 'A shooting star. Make a wish.');
      }
    }
    for (const s of world.stars) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    world.stars = world.stars.filter((s) => world.t - s.t0 < s.dur);
    world.gusts = world.gusts.filter((q) => world.t - q.t0 < 8);
  }
  function effects(dt: number, dX: number) {
    for (const f of world.fx) {
      f.x += f.vx * dt - dir * dX * f.s;
      f.y += f.vy * dt;
      if (f.kind === 'smoke' || f.kind === 'steam') {
        f.vx += (world.wind * 0.6 - f.vx) * dt * 0.3;
        f.vy *= Math.exp(-dt * 0.25);
      } else if (f.kind === 'spark' || f.kind === 'splash') f.vy += 70 * u * dt;
      else if (f.kind === 'bomb') {
        f.vy += 40 * u * dt;
        const L = (f.x - GW / 2) * dir + world.X * f.s;
        if (f.y >= land.farTop(1, L)) {
          f.dur = 0;
          fx('flash', f.x, f.y, { s: f.s, dur: 0.7, r: 26 * u, color: '#ffc080' });
          fx('smoke', f.x, f.y, { s: f.s, vy: -6 * u, dur: 10, r: 6 * u, color: '#4a4442', grow: 4 });
          emit('blast', f.x, f.y, 0.15);
        }
      } else if (f.kind === 'petal' || f.kind === 'leaf') {
        f.vx += (world.wind * 1.4 - f.vx) * dt * 0.8;
        f.vy = Math.sin(world.t * 2 + f.seed) * 10 * u;
      } else if (f.kind === 'firefly') {
        f.vx += Math.sin(world.t * 1.3 + f.seed) * dt * 10 * u;
        f.vy += Math.cos(world.t * 1.1 + f.seed * 0.7) * dt * 8 * u;
      }
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
    const k = world.bloom * (1 - world.rain);
    if (k > 0.05 && r() < dt * 14 * k) fx('petal', world.wind > 0 ? -20 * u : GW + 20 * u, land.GY - r() * GH * 0.3 + GH * 0.15, { vx: world.wind, dur: 14, r: 2.4 * u, s: 1.2, color: pick(['#ffffff', '#ffd0e0', '#ffe890', '#f0a0c0', '#d8c8ff'], r) });
    if (season === 'autumn' && world.rain < 0.5 && r() < dt * 1.5) fx('leaf', world.wind > 0 ? -20 * u : GW + 20 * u, land.GY - r() * GH * 0.3, { vx: world.wind, dur: 14, r: 3 * u, s: 1.2, color: pick(['#c8743a', '#e0a040', '#a85030'], r) });
  }

  // ---- the hours and the regions -----------------------------------------------------------------------
  const rited = new Set<string>();
  let lastSeg = -1;
  function rites() {
    const dayNo = Math.floor(world.t / world.dayLen + world.day);
    const RITES: [number, string][] = [[0.25, 'dawn'], [0.72, 'sunset'], [0.8, 'moon']];
    for (const [atDay, kind] of RITES) {
      const key = `${dayNo}:${atDay}`;
      if (rited.has(key) || Math.abs(world.day - atDay) > 0.004) continue;
      rited.add(key);
      emit('hour', GW / 2, GH * 0.2, 0.1);
      if (kind === 'dawn') {
        say('Dawn.');
        if (world.days > 0) card(`The ${['Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'][Math.min(5, world.days - 1)]} Day`, `${titled(regionName())}, at dawn`);
      } else if (kind === 'sunset') {
        say('The sun goes down, and the windows light one by one.');
        if (world.storm < 0.4) speak(spirit(), 'Lamps on, everyone. Lamps on.');
      } else {
        say('The moon comes up, big as a cartwheel.');
      }
    }
    if (rited.size > 40) rited.clear();
    // A new region underfoot: its title card.
    const i = land.segAt(world.X);
    const sg = land.route[i] ?? null;
    if (sg && sg.seed !== lastSeg && world.X > sg.x0 + 200 * u) {
      const first = lastSeg === -1;
      lastSeg = sg.seed;
      world.seg = sg;
      world.region = sg.region;
      const subs: Record<Region, string> = {
        meadow: 'green and rolling, and full of sheep',
        moor: 'heather and stone walls',
        lake: 'still as glass',
        coast: 'down to the sea',
        mountain: 'the road begins to climb',
        flowers: 'the flower fields',
        town: 'steep roofs and a market square',
      };
      card(titled(sg.name), first ? `${titled(castle.name)} walks ${home.label}` : subs[sg.region]);
      emit('region', castle.x, castle.y, 0.3);
      if (!first && r() < 0.6) chronicle(`We walked ${sg.region === 'coast' ? 'down to the sea at' : sg.region === 'mountain' ? 'up into' : sg.region === 'town' ? 'past' : 'into'} ${titled(sg.name)}.`);
      if (first) chronicle(`${titled(castle.name)} set out across ${home.label}, ${season === 'late' ? 'at the end of summer' : `in the ${season}`}.`);
    } else if (sg && world.seg !== sg && lastSeg === sg.seed) world.seg = sg;
  }

  // ---- a touch ---------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 2.5) return null;
    lastNudge = world.t;
    const lx = ((x - castle.x) * dir) / cs;
    const ly = (y - castle.y) / cs;
    if (lx > -230 && lx < 220 && ly > design.top - 20 && ly < 40) {
      const next = (castle.door.place + 1) % places.length;
      emit('touch', x, y, 0.3);
      if (openDoor(next)) {
        const p = places[next];
        return `The dial turns to ${p.label}: the door opens on ${p.name}`;
      }
      speak(spirit(), 'Hey! That tickles!');
      return 'Hey! That tickles!';
    }
    const ny = land.nearY(landL(x));
    if (y > ny - 6 * u) {
      const n = night() > 0.5;
      if (n) for (let k = 0; k < 16; k++) fx('firefly', x + (r() - 0.5) * 80 * u, y + (r() - 0.5) * 30 * u, { vx: (r() - 0.5) * 20 * u, vy: -(4 + r() * 10) * u, dur: 5 + r() * 4, r: 2 * u, color: '#e8ff90' });
      else spawnFlock('starlings', x, y - 10 * u).birds.splice(14);
      for (const sh of world.sheep) if (sh.plane === 'near' && Math.abs(sh.x - x) < 140 * u) Object.assign(sh, { state: 'flee', t0: world.t, vx: Math.sign(sh.x - x || 1) * 50 * u });
      emit('touch', x, y, 0.2);
      return n ? 'Fireflies rise out of the grass' : 'Larks go up out of the grass';
    }
    if (y > land.HY) {
      world.gusts.push({ x, t0: world.t, k: 1 });
      emit('touch', x, y, 0.2);
      return 'A gust rolls across the fields';
    }
    emit('touch', x, y, 0.2);
    if (night() > 0.6) {
      shootingStar(false);
      Object.assign(world.stars[world.stars.length - 1], { x, y });
      return 'A shooting star';
    }
    const ch = design.chimneys[design.chimneys.length - 1];
    const [cx, cy] = at(ch.x + ch.w / 2, ch.y);
    fx('ring', cx, cy, { vx: (x - cx) * 0.12, vy: (y - cy) * 0.12, dur: 7, r: 10 * cs, color: '#f0ece4', grow: 2 });
    speak(spirit(), 'One smoke ring, coming up.');
    return 'The castle blows a smoke ring';
  }

  function step(dt: number) {
    world.t += dt;
    const d0 = world.day;
    world.day = (world.day + dt / world.dayLen) % 1;
    if (world.day < d0) world.days++;
    world.director.step(world.t, dt);
    for (let i = later.length - 1; i >= 0; i--)
      if (world.t >= later[i].at) {
        const { fn } = later[i];
        later.splice(i, 1);
        fn();
      }
    ensureRoute();
    const X0 = world.X;
    walk(dt);
    const dX = world.X - X0;
    sky(dt);
    life(dt, dX);
    ships(dt, dX);
    tarMen(dt, dX);
    effects(dt, dX);
    for (const s of systems) s.step?.(dt);
    flares();
    voices(dt);
    rites();
    world.subs = world.subs.filter((q) => world.t < q.t0 + q.dur + 1);
    world.cards = world.cards.filter((q) => world.t - q.t0 < 9);
  }

  for (let k = 0; k < (phone ? 2 : 3); k++) spawnSheep(GW * (0.1 + r() * 0.8), 'near', 2 + Math.floor(r() * 4));
  for (let k = 0; k < 3; k++) spawnSheep(GW * r(), 'mid', 3 + Math.floor(r() * 6));
  spawnFlock(r() < 0.5 ? 'rooks' : 'geese');
  return world;
}
