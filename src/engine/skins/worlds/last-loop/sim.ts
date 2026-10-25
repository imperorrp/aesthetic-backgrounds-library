/**
 * # Last Loop: a tiny handmade solar system living through the last twenty-two minutes before its
 * sun goes supernova, over and over.
 *
 * On screen, at a glance: an orrery seen from a little above the plane: a warm old sun that swells
 * and reddens; a wooded homeworld with a village, a launch tower and a campfire; the hourglass twins
 * with a column of sand pouring from one to the other; a crumbling planet with a black hole at its
 * heart; a stormy ocean giant with tornadoes; a dark thorny planet in its fog; a comet with its icy
 * tail; a moon that will not stay put; the probe cannon on its orbit; the little wooden ship flying
 * between them all with its thruster burning; travellers' campfires with music drifting up.
 * The camera: the whole system, small and close and exaggerated, like a model on a desk. Or, as a
 * map (`view: map`), the same system on a hand-drawn orrery chart.
 *
 * Always happening (the floor):
 * - Orbits and moons, planets turning on their axes, lit by the sun with a terminator.
 * - The ship's voyage: up off the launch tower, across to a planet, down on it to explore, a line
 *   in the ship's log, and away again; a new route every loop.
 * - Campfires flickering; travellers playing (banjo, harmonica, flute, drum...), the notes drifting.
 * - Sand pouring between the twins; crust falling into the black hole; storms on the ocean giant;
 *   the comet's tail always pointing away from the sun.
 * - The loop: the sun ages through the twenty-two minutes (the loop clock); at the end it collapses
 *   and goes supernova, a blue-white shockwave sweeps the system, then the dark, and the traveller
 *   wakes by the fire again. Everything is restored; a few things go differently.
 *
 * The cast (each seed draws some; tag them):
 * - probe [forced] the probe cannon fires its probe out of the system once a loop, a new bearing each time.
 * - quantum [forced, wonder] the shy moon jumps to another planet whenever nobody can see it.
 * - meteors [threat] the volcanic moon throws molten rock at the crumbling planet; shards come loose, scorches stay.
 * - anglers [threat] pale lights hunting in the thorny planet's fog.
 * - shower [weather] a meteor shower streaks through the system.
 * - islands [weather] a tornado on the ocean giant flings an island into orbit; it falls back.
 * - crash [mishap] the ship comes in too fast, crash-lands, and is patched up with tape.
 * - flares [sun] flares and prominences leap off the old sun, more as it ages.
 * - signal [wonder] the signalscope picks up a traveller's song, and they talk.
 * - marshmallow / geysers [life] small things at home.
 * - whitehole [rare] the ground of the crumbling world gives way under the ship; it falls into the
 *   black hole and comes out of the white hole at the edge of the system.
 * - farsignal [rare] the probe's camera catches something past the edge of everything; it looks back.
 * - cometcore [rare] the comet's ice cracks near the sun, and something violet glows inside.
 * Quotas: 6–8 in all with the forced; 0–2 threat; 0–2 weather; 0–1 rare.
 *
 * Events, common to legendary:
 * - common: the ship lands and lifts, music, shards falling, meteors, flares, the comet's pass.
 * - uncommon: the probe, an island flung up, the moon jumping, a shower, a crash.
 * - rare: the end times (all the travellers playing together), the supernova; a loop the traveller
 *   stays home; the fall through the black hole; the comet's core.
 * - legendary: the moon's sixth place (around the sun itself); the eye past the edge.
 *
 * The story of a loop: waking (quiet) → the voyage and the small events → the sun reddening, flares
 * and meteors coming faster, the sand nearly gone, the crust in holes → the end times (everyone
 * plays) → collapse → supernova → dark. What stays: within a loop, the scorches, the fallen crust,
 * the moved sand, the ship's road; across loops, the ship's log and the probe's past bearings.
 * What changes with the seed: the star (gold, white, amber), the sky's colours, the tilt, the order
 * and spacing of the orbits, a ring round the ocean giant, a belt of rubble, every name, the colours of
 * each world (autumn woods or green, teal sea or deep blue), who camps where and plays what, the
 * cast, how long the traveller has been looping (loop 3 or loop 41).
 * A touch: near a planet the ship sets course for it; on the shy moon, it is gone when you look back;
 * on the sun, a flare; anywhere else the signalscope sweeps the dark.
 * Phone: the same system, tilted further toward us to fill the tall screen.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import type { Body, BodyKind, Camp, Ctx, Fx, Island, LoopOptions, LoopWorld, Meteor, Shard, Site, StarKind, Sub, SubKind, SurfPoint, Tornado } from './types';

const SYSTEMS = ['The Small Hours', 'The Old Orrery', 'The Wick', 'The Last Candle', 'The Little Clockwork', 'The Lantern Stars', 'The Tinderbox'];
const ANCIENTS = ['the Lanterners', 'the Sowers', 'the Firstcomers', 'the Waywrights', 'the Still Folk'];
const HOMES = ['Pinecradle', 'Mosshollow', 'Kindlewood', 'Fernhome', 'Barkstead', 'Birchwick', 'Tinderwood'];
const TWINS: [string, string][] = [['Sift', 'Silt'], ['the Glass', 'the Grain'], ['Dusk', 'Dune'], ['Tick', 'Tock'], ['Rose', 'Rust'], ['Hourward', 'Sandward']];
const CRUMBLES = ['Shardhollow', 'Crazewell', 'the Broken Bowl', 'Splinterhold', 'Crackledeep'];
const OCEANS = ['Deepswell', 'Galemother', 'Whorlsea', 'Stormwallow', 'Tideholm', 'the Brine Giant'];
const THORNS = ['Thornheart', 'Nettleshade', 'the Briarwald', 'the Husk', 'Snarlwood'];
const MOONS = ['the Pebble', 'Little Stone', 'the Knuckle', 'the Acorn'];
const CINDERS = ['Cinderling', 'the Spitfire', 'the Kiln', 'Sparkmote'];
const SHIES = ['the Shy Moon', 'the Winking Moon', 'the Elsewhere Moon', 'the Glance'];
const COMETS = ['the Pale Wanderer', 'Rimewake', 'the Long Winter', 'Frostling'];
const STATIONS = ['the Long Glass', 'Farsight', 'the Lookout', 'Old Thunder'];
const SHIPS = ['the Kindling', 'Old Tinder', 'the Birch Bark', 'the Lantern', 'the Pine Knot', 'the Woodpecker'];
const PILOTS = ['Hatch', 'Rook', 'Pell', 'Juniper', 'Corwin', 'Tamsin'];
const FOLK = ['Orrin', 'Tess', 'Bellwen', 'Halden', 'Fenn', 'Marlo', 'Ivy', 'Corbin', 'Sage', 'Runa', 'Tobias', 'Linnet'];
const INSTRUMENTS = ['banjo', 'harmonica', 'flute', 'drum', 'whistle', 'fiddle', 'ocarina', 'concertina', 'kalimba'];
const FIRES = ['#ffb35a', '#ff9440', '#ffc46a', '#ff8a5c', '#9ad7ff', '#b6f08a'];

/** Seconds at the end of a loop: the collapse, the supernova, the dark; and the waking at the start. */
export const COLLAPSE = 7;
export const NOVA = 16;
export const DARK = 5;
export const END = COLLAPSE + NOVA + DARK;
export const WAKE = 12;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
/** The sun's colour through its life, by the kind of star it is: young to deep red. */
const SUN_STOPS: Record<StarKind, [number, [number, number, number]][]> = {
  gold: [[0, [255, 222, 150]], [0.35, [255, 196, 110]], [0.62, [255, 150, 80]], [0.85, [250, 104, 60]], [1, [226, 66, 44]]],
  white: [[0, [236, 242, 255]], [0.3, [255, 236, 200]], [0.6, [255, 176, 110]], [0.85, [246, 110, 70]], [1, [220, 62, 50]]],
  amber: [[0, [255, 196, 120]], [0.35, [255, 164, 86]], [0.62, [248, 124, 66]], [0.85, [232, 86, 52]], [1, [204, 52, 40]]],
};
export function sunColor(age: number, kind: StarKind = 'gold'): [number, number, number] {
  const stops = SUN_STOPS[kind];
  for (let i = 1; i < stops.length; i++) {
    const [a, ca] = stops[i - 1];
    const [b, cb] = stops[i];
    if (age <= b) {
      const k = clamp01((age - a) / (b - a));
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return stops[stops.length - 1][1];
}
const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
/** First letter up: names go in the middle of sentences as they are, and at the start capitalised. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the traveller may learn on each world (the ship's log). {A} {B} the twins, {C} the crumbling one, {O} the ocean, {N} the ancients. */
const RUMOURS: Partial<Record<BodyKind, string[]>> = {
  twinA: ['A tower stands under the sand on {A}. It shows only at the end', 'All the sand of {A} pours to {B} before the end', '{N} built a tower on the equator of {A}', 'The caves of {A} empty as the loop goes on'],
  twinB: ['The sand rises on {B} and buries the caves', 'A city of {N} lies under the sand of {B}', 'Go to {B} early: by the end the sand covers it all'],
  crumble: ['There is a black hole at the heart of {C}', 'Don\'t stand on the cracked ground of {C}', '{N} hung a city under the crust of {C}', 'What falls into {C} comes out somewhere else'],
  ocean: ['The tornadoes on {O} that turn the other way go down, not up', 'The islands of {O} always come back down', 'Something glows in the deep current of {O}', 'The probe cannon is steered from {O}'],
  thorn: ['Follow the music through the fog', 'The lights in the fog are not lanterns', 'The thorns are bigger on the inside', 'Someone plays in the thorns, lost'],
  moon: ['You can see the whole system from the moon', 'The old observatory on the moon still has power'],
  shy: ['The shy moon only moves when no one is looking', 'The shy moon has a sixth place, and no one has seen it'],
  comet: ['The comet is hollow, and something sleeps inside', 'The ice on the comet is not ice'],
  station: ['The cannon fires the same probe every loop, a different way', 'The probe is looking for something out there'],
  home: ['The statue in the village opened its eyes', 'The sun was never meant to last this long'],
};
const EXPLORE: Partial<Record<BodyKind, string[]>> = {
  twinA: ['Sand in everything.', 'The column is loud up close.', 'Caves. Dark ones.'],
  twinB: ['The sand is rising. I can hear it.', 'Ruins under the dunes.', 'A cactus. That\'s all.'],
  crumble: ['The ground is humming.', 'Don\'t look down.', 'A shard just went. Too close.'],
  ocean: ['On an island, holding on.', 'The wind! The wind!', 'Waves as tall as trees.'],
  thorn: ['It\'s so quiet in here.', 'I can hear a harmonica.', 'Lights ahead. Engines off.'],
  moon: ['Low gravity. Wheee.', 'Good view of home from here.', 'The sun looks bigger today.'],
  shy: ['The moon is... still here?', 'Everything is fog.', 'Don\'t blink.'],
  comet: ['Cold. So cold.', 'The ice is singing.', 'Crystals everywhere.'],
  station: ['The cannon is still warm.', 'Docked at the cannon.'],
  home: ['Home again.', 'The fire is still going.', 'Hello, village.'],
  cinder: ['Hot, hot, hot.', 'The ground is lava.'],
};
const CHATTER = ['Is that your ship up there? Wave at the sun for me.', 'I\'ve been playing this song for... how long now?', 'Don\'t mind me. Just watching the stars.', 'Bring marshmallows next time.', 'Something\'s wrong with the sun, isn\'t it?', 'Play along if you know it.', 'Hear that? That\'s the whole system humming.'];

export function createLastLoop(seed: string | number, W: number, H: number, opts: LoopOptions): LoopWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'loop');
  const shotR: Rng = forkRng(seed, 'loop-shots');
  const g: Genome = createGenome(seed, 'loop');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const tall = GH > GW * 1.05;
  const traffic = Math.max(0.4, Math.min(2.5, opts.traffic ?? 1));
  const loopLen = Math.max(180, Math.min(3600, (opts.loop ?? 22) * 60));
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];

  // ---- the shape of the system --------------------------------------------------------------------
  const sinE = tall ? g.range(0.6, 0.74) : g.range(0.34, 0.48);
  const cosE = Math.sqrt(1 - sinE * sinE);
  const Rmax = Math.max(40, Math.min(GW * 0.455, (GH * (tall ? 0.36 : 0.39)) / sinE));
  const k = Rmax / 744;
  /** Bodies are exaggerated, and more so on a small screen, so a phone still sees the woods and the sand. */
  const kr = Math.max(0.55, k) * 1.4;
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const cx = GW / 2 + g.range(-0.02, 0.02) * GW;
  const cy = GH * (tall ? 0.5 : 0.53);
  const star = g.weighted<StarKind>({ gold: 5, white: 2, amber: 3 });
  const sky = g.int(0, 4);

  // The order of the worlds: the twins inside, the thorns outside (mostly); the middle three shuffle.
  const middle = g.shuffle(['home', 'crumble', 'ocean'] as const);
  const order: BodyKind[] = g.chance(0.8) ? ['twinA', ...middle, 'thorn'] : ['twinA', middle[0], 'thorn', middle[1], middle[2]];
  const slots = [0.24, 0.4, 0.565, 0.73, 0.9].map((f, i) => f + (i ? g.range(-0.015, 0.015) : 0));

  const bodies: Body[] = [];
  const mkBody = (kind: BodyKind, name: string, rr: number, a: number, period: number, parent = -1, extra: Partial<Body> = {}): number => {
    const size = rr * kr * g.range(0.9, 1.1);
    bodies.push({
      id: bodies.length, kind, name, r: size, a, phase0: g.range(0, Math.PI * 2), period, parent, X: 0, Y: 0, Z: 0, x: cx, y: cy, R: size, depth: 0,
      spin: g.range(0, Math.PI * 2), spinRate: 0, variant: g.int(0, 2), hue: g.range(-1, 1), gone: false, burnT: -1, ...extra,
    });
    return bodies.length - 1;
  };
  const dir = g.chance(0.5) ? 1 : -1;
  const twinNames = g.pick(TWINS);
  const at = (kind: BodyKind) => Rmax * slots[order.indexOf(kind)];
  const periodAt = (a: number) => dir * (95 + 600 * Math.pow(a / Rmax, 1.5)) * g.range(0.9, 1.1);
  const twinA = mkBody('twinA', twinNames[0], 21, at('twinA'), periodAt(at('twinA')), -1, { spinRate: (Math.PI * 2) / 70 });
  const twinB = mkBody('twinB', twinNames[1], 18.5, at('twinA'), 0, -1, { spinRate: (Math.PI * 2) / 64 });
  const home = mkBody('home', g.pick(HOMES), 33, at('home'), periodAt(at('home')), -1, { spinRate: (Math.PI * 2) / 84 });
  const crumble = mkBody('crumble', g.pick(CRUMBLES), 27, at('crumble'), periodAt(at('crumble')), -1, { spinRate: (Math.PI * 2) / 110 });
  const ocean = mkBody('ocean', g.pick(OCEANS), 46, at('ocean'), periodAt(at('ocean')), -1, { spinRate: (Math.PI * 2) / 56 });
  const thorn = mkBody('thorn', g.pick(THORNS), 30, at('thorn'), periodAt(at('thorn')), -1, { spinRate: (Math.PI * 2) / 150 });
  const moon = mkBody('moon', g.pick(MOONS), 7.5, 0, dir * g.range(34, 46), home, { spinRate: (Math.PI * 2) / 200 });
  bodies[moon].a = bodies[home].r + 22 * kr;
  const cinder = mkBody('cinder', g.pick(CINDERS), 6.5, 0, dir * g.range(26, 34), crumble, { spinRate: (Math.PI * 2) / 30 });
  bodies[cinder].a = bodies[crumble].r + 20 * kr;
  const stationHost = g.chance(0.6) ? ocean : home;
  const station = mkBody('station', g.pick(STATIONS), 6, 0, dir * g.range(48, 62), stationHost, { spinRate: 0 });
  bodies[station].a = bodies[stationHost].r + (stationHost === ocean ? 26 : 40) * kr;
  if (stationHost === home) bodies[moon].a += 10 * kr;
  const shyHosts = [home, ocean, crumble, thorn, twinA];
  const shyStart = g.pick([home, ocean, thorn]);
  const shy = mkBody('shy', g.pick(SHIES), 7, 0, dir * 44, shyStart, { spinRate: (Math.PI * 2) / 40 });
  const comet = mkBody('comet', g.pick(COMETS), 4, Rmax * g.range(0.56, 0.62), g.range(240, 330), -1, { spinRate: (Math.PI * 2) / 20 });
  const cometE = g.range(0.56, 0.64);
  const cometW = g.range(0, Math.PI * 2);
  const twinPeriod = g.range(70, 100) * (g.chance(0.5) ? 1 : -1);
  const twinPhase = g.range(0, Math.PI * 2);
  const twinSep = (bodies[twinA].r + bodies[twinB].r) * 1.95;
  const ringed = g.chance(0.5);
  // A belt of rubble between two orbits, on some seeds.
  const beltAt = g.int(1, 3);
  const belt: [number, number] = g.chance(0.45) ? [(Rmax * (slots[beltAt] + slots[beltAt + 1])) / 2, Rmax * 0.035] : [0, 0];
  const whiteAng = g.range(0, Math.PI * 2);

  // ---- what stands on the worlds ------------------------------------------------------------------
  const vLon = g.range(0, Math.PI * 2);
  const village: Site = { body: home, lon: vLon, lat: g.range(0.12, 0.3) };
  const tower: Site = { body: home, lon: vLon + 0.34, lat: village.lat + 0.05 };
  const islands: Island[] = Array.from({ length: g.int(4, 6) }, (_, i) => ({ id: i, body: ocean, lon: g.range(0, Math.PI * 2), lat: g.range(-0.6, 0.6), lift: 0, liftT: -1, state: 'sea' as const, spinT: g.range(0, 6) }));
  const folk = g.shuffle(FOLK);
  const instruments = g.shuffle(INSTRUMENTS);
  const campBodies = [home, ...g.subset([twinA, twinB, crumble, ocean, thorn, moon], 3, 4)];
  const camps: Camp[] = campBodies.map((b, i) => {
    const onIsland = b === ocean;
    const lon = b === home ? vLon - 0.3 : onIsland ? islands[0].lon : g.range(0, Math.PI * 2);
    const lat = b === home ? village.lat - 0.06 : onIsland ? islands[0].lat : g.range(-0.5, 0.6);
    return { id: i, body: b, lon, lat, who: folk[i], instrument: b === thorn ? 'harmonica' : instruments[i], playing: g.chance(0.6), since: -g.range(0, 30), fire: g.pick(FIRES) };
  });
  const homebody = g.range(0.03, 0.14);

  // eslint-disable-next-line prefer-const
  let world: LoopWorld;
  world = {
    t: 0, W, H, GW, GH, u, k: kr, bus,
    director: createDirector(forkRng(seed, 'loop-director'), { arc: g.pick(ARCS), period: g.range(300, 600), establish: () => establish() }),
    cx, cy, sinE, cosE, Rmax,
    name: g.pick(SYSTEMS), ancients: g.pick(ANCIENTS), cast: [], castIds: [], hues: g.hues('#f0a860', 4),
    star, sky, ringed, belt, whiteHole: null, cometE, cometW,
    loopLen, loop: g.int(3, 41), tau: 0, phase: 'wake', phaseT: 0,
    sun: { r: 46 * kr, r0: 46 * kr, age: 0, color: hex(sunColor(0, star)), heat: 1, flare: 0, flareAng: 0, nova: 0, shock: 0 },
    bodies, home, twinA, twinB, crumble, ocean, thorn, shy, comet, station, moon, cinder,
    sand: 1, shards: [], islands, tornadoes: [], camps, village, tower,
    ship: { name: g.pick(SHIPS), pilot: g.pick(PILOTS), state: 'docked', t0: 0, x: cx, y: cy, depth: 0, ang: 0, from: home, to: home, sx: 0, sy: 0, dur: 1, bend: 0, side: 0, thrust: 0, trail: [], plan: [], leg: 0, asked: -1 },
    probes: [], meteors: [], notes: [], fx: [],
    aim: g.range(0, Math.PI * 2), aimTo: g.range(0, Math.PI * 2), fired: -99,
    shyAt: shyStart, shyT: -99, shower: 0,
    learned: [], log: [], sub: null, subQ: [], scorches: [], route: [], probeLog: [],
    cometCracked: -1, eye: 0, stayHome: false,
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    step, nudge, surf,
    counts: () => ({
      loop: world.loop,
      tau: Math.round(world.tau),
      bodies: bodies.filter((b) => !b.gone).length,
      sand: Math.round(world.sand * 100),
      shards: world.shards.filter((s) => !s.fallen).length,
      notes: world.notes.length,
      fx: world.fx.length,
      meteors: world.meteors.length,
      probes: world.probes.length,
      playing: world.camps.filter((c) => c.playing).length,
      tornadoes: world.tornadoes.length,
      learned: world.learned.length,
      scorches: world.scorches.length,
    }),
  };

  // ---- the verbs ------------------------------------------------------------------------------------
  /** A quiet shot for a following camera: the ship, or a world. Its own rng, so the system plays the same. */
  function establish(): { x: number; y: number; zoom: number } {
    if (!world) return { x: GW / 2, y: GH / 2, zoom: 1 };
    const s = world.ship;
    if (s.state !== 'gone' && shotR() < 0.55) return { x: s.x, y: s.y, zoom: 2.4 };
    const b = bodies[[home, ocean, crumble, twinA, thorn][Math.floor(shotR() * 5)]];
    return { x: b.x, y: b.y, zoom: 2.2 };
  }
  const RANK: Record<SubKind, number> = { big: 3, event: 2, radio: 1, quiet: 0 };
  const said = new Map<string, number>();
  /** A line said: on the bus (the log, sound, the lab), and into the subtitles' queue. */
  const say: Ctx['say'] = (text, x, y, o = {}) => {
    const last = said.get(text);
    if (last !== undefined && world.t - last < 20) return;
    said.set(text, world.t);
    if (said.size > 200) said.clear();
    const kind = o.kind ?? 'event';
    bus.emit({ type: 'say', text: o.who ? `${o.who}: ${text}` : text, x, y, priority: kind === 'quiet' ? 'low' : 'high' });
    if (kind === 'quiet' && world.subQ.length >= 1) return;
    if (kind === 'radio' && world.subQ.length >= 2) return;
    const sub: Sub = { text, who: o.who ?? '', kind, t0: world.t, dur: Math.max(3.6, Math.min(7, 2.4 + text.length * 0.05)), x, y, body: o.body ?? nearest(x, y) };
    world.subQ.push(sub);
    world.subQ.sort((a, b) => RANK[b.kind] - RANK[a.kind] || a.t0 - b.t0);
    if (world.subQ.length > 4) world.subQ.pop();
  };
  function nearest(x: number, y: number): number {
    let best = -1;
    let bd = 60 * kr;
    for (const b of bodies) {
      const d = Math.hypot(b.x - x, b.y - y) - b.R;
      if (d < bd) {
        bd = d;
        best = b.id;
      }
    }
    return best;
  }
  function subtitles() {
    world.subQ = world.subQ.filter((q) => world.t - q.t0 < (q.kind === 'big' ? 40 : 14));
    const cur = world.sub;
    const age = cur ? world.t - cur.t0 : Infinity;
    if (cur && age > cur.dur) world.sub = null;
    const next = world.subQ[0];
    if (!next) return;
    if (!world.sub || (age > 2.2 && RANK[next.kind] > RANK[world.sub.kind]) || age > world.sub.dur * 0.8) {
      world.subQ.shift();
      world.sub = { ...next, t0: world.t };
    }
  }
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const look = (why: string, x: number, y: number, zoom: number, hold: number, priority: number) => world.director.look(why, x, y, zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: Fx['kind'], x: number, y: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 500) return;
    world.fx.push({ kind, x, y, vx: 0, vy: 0, t0: world.t, dur: 1.5, r: 4 * kr, color: '#ffd9a0', ...extra });
  };
  const fill = (s: string) => cap(s.replace(/\{A\}/g, bodies[twinA].name).replace(/\{B\}/g, bodies[twinB].name).replace(/\{C\}/g, bodies[crumble].name).replace(/\{O\}/g, bodies[ocean].name).replace(/\{N\}/g, world.ancients));
  const live = () => world.phase === 'live' || world.phase === 'wake';
  /** How late in the loop it is: things come faster as the sun ages. */
  const hurry = () => 1.15 - 0.55 * world.sun.age;

  /** Where a point on a body's surface is now (lon, lat in radians; lift in radii above it). */
  function surf(b: Body, lon: number, lat: number, lift = 0): SurfPoint {
    const s = lon - b.spin;
    const cl = Math.cos(lat);
    const nx = cl * Math.sin(s);
    const ny = Math.sin(lat);
    const nz = cl * Math.cos(s);
    const a = nx;
    const bb = ny * cosE - nz * sinE;
    const c = ny * sinE + nz * cosE;
    const rr = b.R * (1 + lift);
    const ll = Math.hypot(b.X, b.Y, b.Z) || 1;
    const lit = -(nx * b.X + ny * b.Y + nz * b.Z) / ll;
    return { x: b.x + a * rr, y: b.y - bb * rr, c, nx: a, ny: -bb, lit };
  }

  // ---- where everything is: a function of the loop's clock ----------------------------------------
  const place = (b: Body) => {
    b.x = cx + b.X;
    b.y = cy + b.Z * sinE - b.Y * cosE;
    b.depth = b.Z * cosE + b.Y * sinE;
    b.R = b.r * (1 + 0.09 * (b.depth / Rmax));
  };
  function positions() {
    const tau = world.tau;
    for (const b of bodies) {
      b.spin = b.phase0 * 3 + tau * b.spinRate;
      if (b.kind === 'twinA' || b.kind === 'twinB' || b.kind === 'moon' || b.kind === 'cinder' || b.kind === 'station' || b.kind === 'shy' || b.kind === 'comet') continue;
      const th = b.phase0 + (Math.PI * 2 * tau) / b.period;
      b.X = Math.cos(th) * b.a;
      b.Z = Math.sin(th) * b.a;
      b.Y = 0;
      place(b);
    }
    // The twins circle each other as they go round together.
    const A = bodies[twinA];
    const B = bodies[twinB];
    const th = A.phase0 + (Math.PI * 2 * tau) / A.period;
    const bx = Math.cos(th) * A.a;
    const bz = Math.sin(th) * A.a;
    const ph = twinPhase + (Math.PI * 2 * tau) / twinPeriod;
    const fa = B.r / (A.r + B.r);
    A.X = bx + Math.cos(ph) * twinSep * fa;
    A.Z = bz + Math.sin(ph) * twinSep * fa;
    B.X = bx - Math.cos(ph) * twinSep * (1 - fa);
    B.Z = bz - Math.sin(ph) * twinSep * (1 - fa);
    A.Y = B.Y = 0;
    place(A);
    place(B);
    // Moons, the shy one, and the cannon, around their hosts.
    for (const b of [bodies[moon], bodies[cinder], bodies[station], bodies[shy]]) {
      const atSun = b.kind === 'shy' && world.shyAt < 0;
      const host = atSun ? null : bodies[b.kind === 'shy' ? world.shyAt : b.parent];
      const a = b.kind === 'shy' ? (host ? host.r + 20 * kr : world.sun.r0 * 1.78 + 26 * kr) : b.a;
      const t2 = b.phase0 + (Math.PI * 2 * tau) / b.period;
      b.X = (host?.X ?? 0) + Math.cos(t2) * a;
      b.Z = (host?.Z ?? 0) + Math.sin(t2) * a;
      // The shy moon's orbit is tilted: it goes over and under its host.
      b.Y = b.kind === 'shy' ? Math.sin(t2) * a * 0.35 : 0;
      place(b);
    }
    // The comet on its long ellipse (Kepler: fast near the sun, slow far out).
    const C = bodies[comet];
    const M = C.phase0 + (Math.PI * 2 * tau) / C.period;
    let E = M;
    for (let i = 0; i < 8; i++) E = M + cometE * Math.sin(E);
    const px = C.a * (Math.cos(E) - cometE);
    const pz = C.a * Math.sqrt(1 - cometE * cometE) * Math.sin(E);
    C.X = px * Math.cos(cometW) - pz * Math.sin(cometW);
    C.Z = px * Math.sin(cometW) + pz * Math.cos(cometW);
    C.Y = Math.sin(E) * C.a * 0.08;
    place(C);
  }
  /** The white hole sits far out at the edge, where what falls in comes out. */
  function whitePos(): [number, number] {
    return [cx + Math.cos(whiteAng) * Rmax, cy + Math.sin(whiteAng) * Rmax * sinE];
  }

  // ---- the loop -------------------------------------------------------------------------------------
  let loopR: Rng = forkRng(seed, `loop-${world.loop}`);
  let probeAt = 40;
  let endTimes = false;
  let sandMark = 1;
  let cometNear = false;
  function newLoop(first: boolean) {
    loopR = forkRng(seed, `loop-${world.loop}`);
    world.tau = 0;
    world.phase = 'wake';
    world.phaseT = world.t;
    world.sand = 1;
    sandMark = 1;
    endTimes = false;
    cometNear = false;
    world.sun = { ...world.sun, r: world.sun.r0, age: 0, color: hex(sunColor(0, star)), heat: 1, flare: 0, nova: 0, shock: 0 };
    for (const b of bodies) {
      b.gone = false;
      b.burnT = -1;
    }
    // The crust: shards fall through the loop, faster toward the end, in a new order each time.
    const n = 34;
    const falling = Math.round(n * (0.55 + loopR() * 0.15));
    const shards: Shard[] = [];
    const g2 = createGenome(seed, 'loop-shards');
    for (let i = 0; i < n; i++) shards.push({ id: i, lon: g2.range(0, Math.PI * 2), lat: Math.asin(g2.range(-0.92, 0.92)), fallAt: Infinity, fallen: false, fellT: -1 });
    const idx = shards.map((_, i) => [i, loopR()] as const).sort((a, b) => a[1] - b[1]).map(([i]) => i);
    for (let j = 0; j < falling; j++) shards[idx[j]].fallAt = WAKE + 40 + (loopLen - END - 80 - WAKE) * Math.pow((j + loopR() * 0.8) / falling, 0.75);
    world.shards = shards;
    for (const is of world.islands) Object.assign(is, { lift: 0, liftT: -1, state: 'sea' });
    world.probes = [];
    world.meteors = [];
    world.notes = [];
    world.fx = [];
    world.scorches = [];
    world.route = [];
    world.shower = 0;
    world.shyAt = shyStart;
    world.fired = -99;
    world.cometCracked = -1;
    world.eye = 0;
    probeAt = WAKE + 18 + loopR() * 50;
    world.aimTo = (world.aimTo + 0.8 + loopR() * 4.6) % (Math.PI * 2);
    // Some loops the traveller does not go anywhere at all.
    world.stayHome = !first && loopR() < homebody;
    // The ship is back on its tower, with a new plan.
    const places = [twinA, twinB, crumble, ocean, thorn, moon, comet, station, shy];
    const plan = places.map((p) => [p, loopR()] as const).sort((a, b) => a[1] - b[1]).map(([p]) => p).slice(0, 5 + Math.floor(loopR() * 3));
    plan.push(home);
    Object.assign(world.ship, { state: 'docked', t0: world.t, plan, leg: 0, trail: [], asked: -1, thrust: 0, from: home, to: home });
    for (const c of world.camps) {
      c.playing = c.body === home ? true : loopR() < 0.55;
      c.since = world.t - loopR() * 20;
    }
    positions();
    const fire = surf(bodies[home], camps[0].lon, camps[0].lat);
    say(first ? `Loop ${world.loop}. The traveller wakes by the fire on ${bodies[home].name}.` : `Loop ${world.loop}. The traveller wakes by the fire, and remembers.`, fire.x, fire.y, { kind: 'big', body: home });
    emit('wake', fire.x, fire.y, first ? 0.6 : 0.7);
    look('wake', fire.x, fire.y, 2.6, WAKE, 10);
  }
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function sunAndLoop(dt: number) {
    const L = loopLen;
    const tau = world.tau;
    const S = world.sun;
    const endAt = L - END;
    if (world.phase === 'wake' && tau > WAKE) {
      world.phase = 'live';
      world.phaseT = world.t;
      if (world.stayHome) {
        const c = camps[0];
        const p = surf(bodies[home], c.lon, c.lat);
        say(`This loop, the traveller stays by the fire with ${c.who}, and listens.`, p.x, p.y, { kind: 'big', body: home });
        emit('stayhome', p.x, p.y, 0.5);
      }
    }
    world.eye = Math.max(0, world.eye - dt / 50);
    if (tau < endAt) {
      S.age = clamp01(tau / endAt);
      S.r = S.r0 * (1 + 0.78 * Math.pow(smooth(0.12, 1, S.age), 1.25));
      S.color = hex(sunColor(S.age, star));
      S.heat = 1 - 0.35 * S.age;
      S.flare = Math.max(0, S.flare - dt / 6);
      // The sand pours; the milestones are said.
      world.sand = clamp01(1 - (tau - WAKE) / (endAt - WAKE - 30));
      for (const m of [0.5, 0.25, 0]) {
        if (sandMark > m && world.sand <= m) {
          sandMark = m;
          const A = bodies[twinA];
          const B = bodies[twinB];
          const line = m === 0 ? `The last of the sand pours from ${A.name} to ${B.name}. The tower stands bare.` : m === 0.5 ? `Half the sand of ${A.name} has poured onto ${B.name}.` : `The caves of ${B.name} fill with sand.`;
          say(cap(line), A.x, A.y, { body: m === 0.25 ? twinB : twinA });
          emit('sand', A.x, A.y, 0.3);
        }
      }
      // The end times: everyone plays.
      if (!endTimes && tau > endAt - 80) {
        endTimes = true;
        for (const c of world.camps) {
          c.playing = true;
          c.since = world.t;
        }
        say('The end times. All across the system, the travellers play together.', cx, cy, { kind: 'big', body: -1 });
        emit('endtimes', cx, cy, 0.8);
      }
      if (S.age > 0.82 && world.director.want('dying', 0.2, 80)) {
        say(pick(['The sun is dying.', 'The old sun swells, deep red.', 'The light is going orange on every world.', 'Not much time left in this loop.']), cx, cy, { body: -1 });
        emit('dying', cx, cy, 0.3);
      }
      return;
    }
    const s = tau - endAt;
    if (s < COLLAPSE) {
      if (world.phase !== 'collapse') {
        world.phase = 'collapse';
        world.phaseT = world.t;
        say(`${mmss(tau)}. The sun collapses.`, cx, cy, { kind: 'big', body: -1 });
        emit('collapse', cx, cy, 0.9);
      }
      const rEnd = S.r0 * 1.78;
      const q = smooth(0, COLLAPSE - 0.8, s);
      S.r = Math.max(3 * kr, rEnd * (1 - q * q) + 3 * kr * q);
      const blue = smooth(COLLAPSE - 2.2, COLLAPSE, s);
      const c0 = sunColor(1, star);
      S.color = hex([c0[0] + (210 - c0[0]) * blue, c0[1] + (235 - c0[1]) * blue, c0[2] + (255 - c0[2]) * blue]);
      S.heat = 0.5 - 0.3 * q;
      return;
    }
    if (s < COLLAPSE + NOVA) {
      const n = s - COLLAPSE;
      if (world.phase !== 'nova') {
        world.phase = 'nova';
        world.phaseT = world.t;
        say('Supernova.', cx, cy, { kind: 'big', body: -1 });
        emit('supernova', cx, cy, 1);
        if (world.ship.state !== 'gone') after(1.2, () => say(pick(['Oh no.', 'Not again.', 'Well. See you soon.', 'Beautiful.']), world.ship.x, world.ship.y, { kind: 'radio', who: world.ship.pilot, body: -1 }));
      }
      S.nova = Math.exp(-n / 1.1);
      S.shock = Rmax * 1.3 * Math.pow(n / 10, 0.85);
      S.r = 3 * kr * (1 + 4 * Math.exp(-n / 0.6));
      S.color = '#dff2ff';
      S.heat = 1.8 * Math.exp(-n / 3);
      for (const b of bodies) {
        if (b.gone) continue;
        if (Math.hypot(b.X, b.Y, b.Z) < S.shock) {
          b.gone = true;
          b.burnT = world.t;
          for (let i = 0; i < 10; i++) {
            const a = Math.atan2(b.Z * sinE, b.X) + (r() - 0.5) * 1.6;
            fx('debris', b.x, b.y, { vx: Math.cos(a) * (60 + r() * 120) * kr, vy: Math.sin(a) * (60 + r() * 120) * kr, dur: 3 + r() * 2, r: (1 + r() * 2.5) * kr, color: '#cfe8ff' });
          }
        }
      }
      if (world.ship.state !== 'gone' && Math.hypot(world.ship.x - cx, (world.ship.y - cy) / Math.max(0.3, sinE)) < S.shock) {
        world.ship.state = 'gone';
        world.ship.t0 = world.t;
      }
      return;
    }
    if (world.phase !== 'dark') {
      world.phase = 'dark';
      world.phaseT = world.t;
      S.r = 0;
      S.nova = 0;
      say('And then the dark.', cx, cy, { kind: 'big', body: -1 });
      emit('dark', cx, cy, 0.3);
    }
    S.shock = Rmax * 1.3 * Math.pow((s - COLLAPSE) / 10, 0.85);
  }

  // ---- the ship -------------------------------------------------------------------------------------
  const shipAlive = () => world.ship.state !== 'gone';
  /** The ship as a point in the plane of the orbits, for the chart. */
  const plane = (x: number, y: number): [number, number] => [x - cx, (y - cy) / sinE];
  function mark(body: number) {
    const s = world.ship;
    const [X, Z] = plane(s.x, s.y);
    world.route.push({ X, Z, body, t: world.t });
    if (world.route.length > 40) world.route.shift();
  }
  function landingPoint(b: Body, side: number): [number, number] {
    const h = b.R + 3.5 * kr;
    return [b.x + Math.cos(side) * h, b.y + Math.sin(side) * h];
  }
  function depart(to: number) {
    const s = world.ship;
    const B = bodies[to];
    s.from = s.to;
    s.to = to;
    s.sx = s.x;
    s.sy = s.y;
    // Land on the side it comes from, a little toward the top of the picture.
    const away = Math.atan2(s.y - B.y, s.x - B.x);
    s.side = away + (Math.sin(away) > 0 ? -0.5 : 0.2) * Math.sign(Math.cos(away) || 1);
    const [ex, ey] = landingPoint(B, s.side);
    const dist = Math.hypot(ex - s.x, ey - s.y);
    s.dur = Math.max(7, Math.min(24, dist / (48 * kr) + 3)) / Math.sqrt(traffic);
    s.bend = (r() - 0.5) * 0.7;
    s.state = 'cruise';
    s.t0 = world.t;
    s.thrust = 1;
    if (crashing.next) {
      crashing.next = false;
      crashing.now = true;
    }
  }
  const crashing = { next: false, now: false };
  const radio = (line: string, body = -1) => say(line, world.ship.x, world.ship.y, { kind: 'radio', who: world.ship.pilot, body });
  function shipStep(dt: number) {
    const s = world.ship;
    if (s.state === 'gone') return;
    const age = world.t - s.t0;
    const H = bodies[home];
    if (s.state === 'docked') {
      const p = surf(H, tower.lon, tower.lat, 0.05);
      s.x = p.x;
      s.y = p.y;
      s.ang = Math.atan2(p.ny, p.nx);
      s.depth = H.depth + (p.c > 0 ? 1 : -1) * H.R * 0.5;
      s.thrust = 0;
      s.side = Math.atan2(p.ny, p.nx);
      if (world.phase !== 'live' || age < 6 || world.stayHome) return;
      // Wait for the tower to come round to our side, so we see it go.
      if (p.c > 0.15 || age > 50) {
        s.state = 'launch';
        s.t0 = world.t;
        s.sx = s.x;
        s.sy = s.y;
        s.from = home;
        s.to = home;
        s.thrust = 1;
        mark(home);
        say(`${cap(s.name)} lifts off the launch tower at ${H.name}.`, s.x, s.y, { body: home });
        emit('launch', s.x, s.y, 0.5);
        look('launch', s.x, s.y, 2.2, 8, 5);
        if (r() < 0.6) after(4, () => radio(pick(['Ignition. Here we go again.', 'See you around, village.', 'This time I\'ll get it right.', `Flight log, loop ${world.loop}.`])));
      }
      return;
    }
    if (s.state === 'launch') {
      // Straight up off the tower, then turn for the first leg.
      const k2 = Math.min(1, age / 3);
      s.x = s.sx + Math.cos(s.side) * k2 * k2 * 40 * kr;
      s.y = s.sy + Math.sin(s.side) * k2 * k2 * 40 * kr;
      s.ang = s.side;
      s.depth = H.depth + H.R;
      trail(dt);
      if (age > 3) {
        const next = s.asked >= 0 ? s.asked : s.plan[s.leg] ?? ocean;
        s.asked = -1;
        s.to = home;
        depart(next);
        emit('course', s.x, s.y, 0.2);
      }
      return;
    }
    if (s.state === 'cruise') {
      const B = bodies[s.to];
      const [ex, ey] = landingPoint(B, s.side);
      const q = Math.min(1, age / s.dur);
      const e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
      const mx = (s.sx + ex) / 2 - (ey - s.sy) * s.bend;
      const my = (s.sy + ey) / 2 + (ex - s.sx) * s.bend;
      const px = (1 - e) * (1 - e) * s.sx + 2 * (1 - e) * e * mx + e * e * ex;
      const py = (1 - e) * (1 - e) * s.sy + 2 * (1 - e) * e * my + e * e * ey;
      const vx = px - s.x;
      const vy = py - s.y;
      if (Math.hypot(vx, vy) > 0.01) s.ang = Math.atan2(vy, vx);
      if (crashing.now && q > 0.72) s.ang += dt * 9;
      s.x = px;
      s.y = py;
      s.depth = (s.from >= 0 ? bodies[s.from].depth : 0) * (1 - q) + (B.depth + B.R) * q;
      s.thrust = q < 0.15 || (q > 0.6 && q < 0.92) ? 1 : 0.45;
      trail(dt);
      if (q >= 1) {
        s.t0 = world.t;
        mark(s.to);
        if (crashing.now) {
          crashing.now = false;
          s.state = 'wrecked';
          s.thrust = 0;
          say(`${cap(s.name)} comes in too fast, and crashes on ${B.name}.`, s.x, s.y, { body: B.id });
          emit('crash', s.x, s.y, 0.85);
          look('crash', s.x, s.y, 2.4, 10, 7);
          after(2.5, () => radio(pick(['Ow.', 'That\'s going to need tape.', 'I meant to do that.', 'Hull breach. Fine. Fine.']), B.id));
          for (let i = 0; i < 14; i++) {
            const a = s.side + (r() - 0.5) * 2.2;
            fx('debris', s.x, s.y, { vx: Math.cos(a) * (20 + r() * 50) * kr, vy: Math.sin(a) * (20 + r() * 50) * kr, dur: 1.5 + r(), r: (0.8 + r()) * kr, color: '#d8a060' });
          }
          fx('flash', s.x, s.y, { dur: 0.8, r: 18 * kr, color: '#ffd090' });
        } else {
          s.state = 'land';
        }
      }
      return;
    }
    const B = bodies[s.to];
    if (s.state === 'fall') {
      // Down through the broken crust, into the dark at the middle.
      const q = Math.min(1, age / 2.4);
      const [lx, ly] = landingPoint(B, s.side);
      s.x = lx + (B.x - lx) * q * q;
      s.y = ly + (B.y - ly) * q * q;
      s.ang += dt * 6;
      s.depth = B.depth + B.R * (0.6 - q);
      if (q >= 1) {
        const [wx, wy] = whitePos();
        s.x = wx;
        s.y = wy;
        s.trail = [];
        fx('flash', wx, wy, { dur: 1.2, r: 30 * kr, color: '#ffffff' });
        fx('ring', wx, wy, { dur: 2, r: 40 * kr, color: '#e8f0ff' });
        say('...and out of the white hole, at the very edge of the system.', wx, wy, { kind: 'big', body: -1 });
        emit('whitehole', wx, wy, 0.9);
        look('whitehole', wx, wy, 2, 8, 7);
        after(3, () => radio('Where... am I? Oh. Oh!'));
        s.to = home;
        depart(home);
        s.from = -1;
      }
      return;
    }
    const [lx, ly] = landingPoint(B, s.side);
    s.x = lx;
    s.y = ly;
    s.depth = B.depth + B.R * 0.6;
    if (s.state === 'land') {
      s.ang = s.side + Math.PI;
      s.thrust = 0.6;
      if (age > 1.2) {
        s.state = 'landed';
        s.t0 = world.t;
        s.thrust = 0;
        say(`${cap(s.name)} touches down on ${B.name}.`, s.x, s.y, { kind: 'quiet', body: B.id });
        emit('land', s.x, s.y, 0.35);
        for (let i = 0; i < 8; i++) {
          const a = s.side + (Math.PI / 2) * (i % 2 ? 1 : -1) + (r() - 0.5) * 0.6;
          fx('dust', s.x, s.y, { vx: Math.cos(a) * (8 + r() * 14) * kr, vy: Math.sin(a) * (8 + r() * 14) * kr, dur: 1.4 + r(), r: (2 + r() * 3) * kr, color: '#d9c7a8' });
        }
        after(4 + r() * 6, () => {
          if (s.state !== 'landed' || s.to !== B.id) return;
          radio(pick(EXPLORE[B.kind] ?? ['A look around.'], r), B.id);
          bus.emit({ type: 'log', weight: 0.05, priority: 'low' });
        });
        after(12 + r() * 10, () => {
          if (s.state !== 'landed' || s.to !== B.id) return;
          const pool = RUMOURS[B.kind];
          if (!pool) return;
          const fresh = pool.map(fill).filter((x) => !world.learned.includes(x));
          const lesson = fresh.length ? pick(fresh, loopR) : null;
          if (!lesson) return;
          world.learned.push(lesson);
          world.log.push({ text: lesson, body: B.id, loop: world.loop, t: world.t });
          if (world.learned.length > 40) world.learned.shift();
          if (world.log.length > 40) world.log.shift();
          bus.emit({ type: 'say', text: `Ship's log: ${lesson}.`, x: B.x, y: B.y, priority: 'medium' });
          emit('learned', B.x, B.y, 0.35);
        });
      }
      return;
    }
    if (s.state === 'landed') {
      s.ang = s.side;
      const stay = (26 + (s.to === home ? 30 : 0)) / Math.sqrt(traffic);
      if (age > stay && world.phase === 'live') {
        s.leg++;
        let next = s.asked >= 0 ? s.asked : s.plan[s.leg % s.plan.length];
        s.asked = -1;
        if (next === s.to) next = s.plan[(s.leg + 1) % s.plan.length];
        if (s.to === home && s.leg >= s.plan.length) {
          // Home, between voyages: a new plan from what is left.
          s.plan = [...s.plan.slice(0, -1).map((p) => [p, loopR()] as const).sort((a, b) => a[1] - b[1]).map(([p]) => p), home];
          s.leg = 0;
          next = s.plan[0];
        }
        say(`${cap(s.name)} lifts off ${B.name}, bound for ${bodies[next].name}.`, s.x, s.y, { kind: 'quiet', body: next });
        emit('depart', s.x, s.y, 0.25);
        mark(B.id);
        depart(next);
      }
      return;
    }
    if (s.state === 'wrecked') {
      s.thrust = 0;
      if (r() < dt * 6) fx('smoke', s.x, s.y, { vx: Math.cos(s.side) * 6 * kr + (r() - 0.5) * 4, vy: Math.sin(s.side) * 6 * kr - 3, dur: 3 + r() * 2, r: (2 + r() * 2) * kr, color: '#6b6158' });
      if (age > 22 / Math.sqrt(traffic)) {
        s.state = 'landed';
        s.t0 = world.t - 10;
        say(`Patched with tape and hope, ${s.name} flies again.`, s.x, s.y, { body: s.to });
        emit('repair', s.x, s.y, 0.4);
      }
    }
  }
  let trailT = 0;
  function trail(dt: number) {
    const s = world.ship;
    trailT += dt;
    if (trailT > 0.06) {
      trailT = 0;
      s.trail.push({ x: s.x - Math.cos(s.ang) * 5 * kr, y: s.y - Math.sin(s.ang) * 5 * kr, t: world.t });
    }
    while (s.trail.length && world.t - s.trail[0].t > 3.2) s.trail.shift();
    if (s.trail.length > 70) s.trail.shift();
  }

  // ---- the camps and their music ------------------------------------------------------------------
  function campsStep(dt: number) {
    const sunFrac = world.sun.age;
    for (const c of world.camps) {
      const B = bodies[c.body];
      if (B.gone) continue;
      // Play a while, rest a while; at the end, everyone plays.
      if (!endTimes && world.phase === 'live' && !(world.stayHome && c.body === home)) {
        if (c.playing && world.t - c.since > 40 + ((c.id * 13) % 30)) {
          c.playing = false;
          c.since = world.t;
        } else if (!c.playing && world.t - c.since > 12 + ((c.id * 7) % 20)) {
          c.playing = true;
          c.since = world.t;
          if (world.director.want('music', 0.12, 40)) {
            const p = surf(B, c.lon, c.lat);
            say(`${c.who} plays the ${c.instrument} on ${B.name}.`, p.x, p.y, { kind: 'quiet', body: B.id });
            emit('music', p.x, p.y, 0.15);
          }
        }
      }
      if (!c.playing) continue;
      const p = surf(B, c.lon, c.lat, 0.04);
      if (p.c < -0.05) continue;
      const rate = (1.1 + sunFrac * 0.4) * (endTimes ? 1.8 : 1);
      if (r() < dt * rate && world.notes.length < 160) {
        const up = 10 + r() * 8;
        world.notes.push({ x: p.x, y: p.y, vx: p.nx * up * kr + (r() - 0.5) * 4, vy: p.ny * up * kr - 6 * kr, t0: world.t, color: c.fire, kind: Math.floor(r() * 3) });
      }
    }
    for (const n of world.notes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.vx *= 1 - dt * 0.3;
      n.vy = n.vy * (1 - dt * 0.3) - 2 * kr * dt;
    }
    world.notes = world.notes.filter((n) => world.t - n.t0 < 5);
  }

  // ---- the ocean's storms, the crust, the cannon, the comet ---------------------------------------
  function stormsStep() {
    world.tornadoes = world.tornadoes.filter((q) => world.t - q.born < q.dur);
    while (world.tornadoes.length < 4) {
      world.tornadoes.push({ id: Math.floor(r() * 1e6), body: ocean, lon: r() * Math.PI * 2, lat: (r() - 0.5) * 1.3, h: 0.22 + r() * 0.2, drift: (r() - 0.5) * 0.04, born: world.t - (world.tornadoes.length ? 0 : r() * 10), dur: 30 + r() * 40 } as Tornado);
    }
    for (const q of world.tornadoes) q.lon += q.drift / 30;
    for (const is of world.islands) {
      if (is.state === 'flung') {
        const age = world.t - is.liftT;
        is.lift = Math.min(1.1, age / 4) * 1.05;
        if (age > 26) {
          is.state = 'falling';
          is.liftT = world.t;
        }
      } else if (is.state === 'falling') {
        const age = world.t - is.liftT;
        is.lift = Math.max(0, 1.05 * (1 - (age / 3.2) ** 2));
        if (age > 3.2) {
          is.state = 'sea';
          is.lift = 0;
          const p = surf(bodies[ocean], is.lon, is.lat);
          if (p.c > 0) {
            fx('splash', p.x, p.y, { dur: 1.6, r: 10 * kr, color: '#d8f4ff' });
            say(`The island falls back into the sea of ${bodies[ocean].name}.`, p.x, p.y, { kind: 'quiet', body: ocean });
          }
          emit('splash', p.x, p.y, 0.3);
        }
      }
    }
  }
  function crustStep() {
    const C = bodies[crumble];
    for (const sh of world.shards) {
      if (sh.fallen || world.tau < sh.fallAt) continue;
      sh.fallen = true;
      sh.fellT = world.t;
      const p = surf(C, sh.lon, sh.lat);
      emit('shard', p.x, p.y, 0.12);
      if (p.c > 0) fx('dust', p.x, p.y, { dur: 2, r: 6 * kr, color: '#b9a0c8' });
      if (world.director.want('shardline', 0.1, 70)) {
        const left = world.shards.filter((q) => !q.fallen).length;
        say(pick([`A shard of ${C.name} falls into the black hole.`, `${cap(C.name)} crumbles. ${left} shards of crust left.`, `The crust of ${C.name} gives way.`], r), C.x, C.y, { kind: 'quiet', body: crumble });
      }
      // The ground goes under the ship: on some seeds, down it goes, and out the other side.
      const s = world.ship;
      if (world.whiteHole && s.state === 'landed' && s.to === crumble && world.director.want('fallthrough', 0.6, 600)) {
        s.state = 'fall';
        s.t0 = world.t;
        say(`The ground gives way under ${s.name}. It falls into the black hole...`, s.x, s.y, { kind: 'big', body: crumble });
        emit('fall', s.x, s.y, 0.8);
        look('fall', C.x, C.y, 2.4, 5, 8);
      }
    }
  }
  function cannonStep(dt: number) {
    const S = bodies[station];
    // The barrel turns toward the next bearing before it fires.
    const da = Math.atan2(Math.sin(world.aimTo - world.aim), Math.cos(world.aimTo - world.aim));
    world.aim += da * Math.min(1, dt * 0.4);
    if (world.phase === 'live' && world.fired < 0 && world.tau > probeAt) {
      world.fired = world.t;
      const bearing = world.aim;
      const sp = 210 * kr;
      world.probes.push({ id: world.loop, x: S.x + Math.cos(bearing) * 10 * kr, y: S.y + Math.sin(bearing) * 10 * kr, vx: Math.cos(bearing) * sp, vy: Math.sin(bearing) * sp, t0: world.t, bearing });
      world.probeLog.push({ loop: world.loop, bearing, X: S.X, Z: S.Z });
      if (world.probeLog.length > 8) world.probeLog.shift();
      fx('flash', S.x + Math.cos(bearing) * 12 * kr, S.y + Math.sin(bearing) * 12 * kr, { dur: 0.7, r: 14 * kr, color: '#bfe6ff' });
      fx('ring', S.x, S.y, { dur: 1.2, r: 22 * kr, color: '#bfe6ff' });
      const deg = Math.round(((bearing * 180) / Math.PI + 450) % 360);
      say(`The probe cannon fires. Probe away, bearing ${deg}.`, S.x, S.y, { body: station });
      emit('probe', S.x, S.y, 0.6);
      look('probe', S.x, S.y, 2, 6, 5);
      // On some seeds, the probe's camera sees something it should not.
      if (castHas('farsignal') && loopR() < 0.5) {
        after(14, () => {
          if (world.phase !== 'live' || !world.director.want('eye', 0.6, 900)) return;
          world.eye = 1;
          say('The probe\'s camera catches something past the edge of everything. It looks back.', cx, cy, { kind: 'big', body: -1 });
          emit('eye', cx, cy, 0.9);
        });
      }
    }
    for (const p of world.probes) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    world.probes = world.probes.filter((p) => Math.abs(p.x - cx) < GW * 1.2 && Math.abs(p.y - cy) < GH * 1.2);
  }
  function cometStep() {
    const C = bodies[comet];
    const d = Math.hypot(C.X, C.Z) / Rmax;
    if (!cometNear && d < 0.3 && world.phase === 'live') {
      cometNear = true;
      say(`${cap(C.name)} rounds the sun, its tail blazing.`, C.x, C.y, { kind: 'quiet', body: comet });
      emit('comet', C.x, C.y, 0.4);
      if (castHas('cometcore') && world.cometCracked < 0 && world.tau > 200 && loopR() < 0.45) {
        after(4, () => {
          world.cometCracked = world.t;
          fx('flash', C.x, C.y, { dur: 1.4, r: 26 * kr, color: '#c9a0ff' });
          say(`The ice of ${C.name} cracks open. Something violet glows inside.`, C.x, C.y, { kind: 'big', body: comet });
          emit('cometcore', C.x, C.y, 0.8);
          look('cometcore', C.x, C.y, 2.2, 8, 7);
        });
      }
    } else if (cometNear && d > 0.5) cometNear = false;
  }
  function meteorsStep() {
    for (const m of world.meteors) {
      const q = (world.t - m.t0) / m.dur;
      if (m.kind === 'lava' && m.target >= 0) {
        // Homing on a spot on the turning crust.
        const C = bodies[m.target];
        m.tx = C.x + Math.cos(m.ang) * C.R * 0.75;
        m.ty = C.y + Math.sin(m.ang) * C.R * 0.75;
      }
      const e = Math.min(1, q);
      const arc = Math.sin(e * Math.PI) * 26 * kr;
      m.x = m.sx + (m.tx - m.sx) * e;
      m.y = m.sy + (m.ty - m.sy) * e - arc;
    }
    const done = world.meteors.filter((m) => world.t - m.t0 >= m.dur);
    world.meteors = world.meteors.filter((m) => world.t - m.t0 < m.dur);
    for (const m of done) {
      if (m.kind === 'lava') {
        fx('flash', m.tx, m.ty, { dur: 0.6, r: 12 * kr, color: '#ffb070' });
        for (let i = 0; i < 6; i++) fx('spark', m.tx, m.ty, { vx: (r() - 0.5) * 60 * kr, vy: (r() - 0.7) * 60 * kr, dur: 0.8 + r() * 0.6, r: 1.2 * kr, color: '#ffc080' });
        emit('meteor', m.tx, m.ty, 0.3);
        const C = bodies[crumble];
        // A scorch stays where it hit: the point on the sphere under the impact.
        const dx = (m.tx - C.x) / C.R;
        const dy = -(m.ty - C.y) / C.R;
        const dc = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
        const Ny = dy * cosE + dc * sinE;
        const Nx = dx;
        const Nz = dc * cosE - dy * sinE;
        world.scorches.push({ lon: Math.atan2(Nx, Nz) + C.spin, lat: Math.asin(Math.max(-1, Math.min(1, Ny))), t: world.t });
        if (world.scorches.length > 30) world.scorches.shift();
        // A shard near it comes loose, now and then.
        const near = world.shards.filter((s) => !s.fallen).map((s) => [s, Math.hypot(surf(C, s.lon, s.lat).x - m.tx, surf(C, s.lon, s.lat).y - m.ty)] as const).sort((a, b) => a[1] - b[1])[0];
        if (near && r() < 0.3 && world.shards.filter((q) => !q.fallen).length > world.shards.length * 0.3) {
          near[0].fallAt = world.tau + 1 + r() * 2;
          if (world.director.want('knocked', 0.15, 70)) say(`Molten rock from ${bodies[cinder].name} knocks a shard of ${C.name} loose.`, m.tx, m.ty, { body: crumble });
        }
      } else if (m.target >= 0) {
        fx('flash', m.tx, m.ty, { dur: 0.4, r: 6 * kr, color: '#e0f0ff' });
        emit('impact', m.tx, m.ty, 0.1);
      }
    }
  }
  function fxStep(dt: number) {
    for (const f of world.fx) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'debris' || f.kind === 'spark') f.vy += 10 * kr * dt;
      if (f.kind === 'dust' || f.kind === 'smoke') {
        f.vx *= 1 - dt;
        f.vy *= 1 - dt;
      }
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
  }

  // ---- the cast library -----------------------------------------------------------------------------
  const ctx: Ctx = { world, r, say, emit, look, after };
  const LIBRARY: SystemDef<Ctx>[] = [
    { id: 'probe', label: 'the probe cannon', weight: 0, tags: ['machine'], create: () => ({ id: 'probe' }) },
    {
      id: 'quantum', label: 'the shy moon', weight: 0, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'quantum',
          step() {
            if (!live() || w.t - w.shyT < 25) return;
            const S = bodies[shy];
            const host = w.shyAt >= 0 ? bodies[w.shyAt] : null;
            // Unobserved: hidden behind its host (or behind the sun).
            const behind = host ? S.depth < host.depth && Math.hypot(S.x - host.x, S.y - host.y) < host.R : Math.hypot(S.x - cx, S.y - cy) < w.sun.r && S.depth < 0;
            if (!behind || !w.director.want('quantum', 0.45, 60 / traffic)) return;
            jumpShy(c.r() < 0.06 ? -1 : -2);
          },
        };
      },
    },
    {
      id: 'meteors', label: 'molten rock from the volcanic moon', weight: 6, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'meteors',
          step() {
            if (w.phase !== 'live' || w.meteors.some((m) => m.kind === 'lava') || !w.director.want('meteor', 0.22, (26 * hurry()) / traffic)) return;
            const V = bodies[cinder];
            const C = bodies[crumble];
            const ang = Math.atan2(V.y - C.y, V.x - C.x) + (c.r() - 0.5) * 1.2;
            w.meteors.push({ id: Math.floor(c.r() * 1e6), x: V.x, y: V.y, sx: V.x, sy: V.y, tx: C.x + Math.cos(ang) * C.R * 0.75, ty: C.y + Math.sin(ang) * C.R * 0.75, t0: w.t, dur: 2.2 + c.r(), target: crumble, kind: 'lava', ang } as Meteor);
            fx('flash', V.x, V.y, { dur: 0.5, r: 8 * kr, color: '#ff9050' });
            if (w.director.want('eruption', 0.1, 90)) c.say(`${cap(V.name)} erupts, and throws fire at ${C.name}.`, V.x, V.y, { kind: 'quiet', body: crumble });
            c.emit('eruption', V.x, V.y, 0.2);
          },
        };
      },
    },
    {
      id: 'anglers', label: 'lights in the thorns', weight: 4, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'anglers',
          step() {
            if (w.phase !== 'live' || !w.director.want('anglers', 0.35, 110 / traffic)) return;
            const T = bodies[thorn];
            const near = w.ship.to === thorn && w.ship.state === 'landed';
            if (near) radio('Something in the fog. Engines off. Drift.', thorn);
            else c.say(`Pale lights move in the fog of ${T.name}.`, T.x, T.y, { body: thorn });
            c.emit('anglers', T.x, T.y, 0.45);
          },
        };
      },
    },
    {
      id: 'shower', label: 'meteor showers', weight: 5, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let from = 0;
        return {
          id: 'shower',
          step(dt) {
            if (w.shower <= 0) {
              if (w.phase !== 'live' || w.t < 40 || !w.director.want('shower', 0.5, (170 * hurry()) / traffic)) return;
              w.shower = 1;
              from = c.r() * Math.PI * 2;
              c.say('A meteor shower streaks through the system.', cx, cy, { body: -1 });
              c.emit('shower', cx, cy, 0.55);
              return;
            }
            w.shower = Math.max(0, w.shower - dt / 26);
            if (c.r() < dt * 5 * w.shower) {
              const a = from + (c.r() - 0.5) * 0.5;
              const sx = cx + Math.cos(a) * GW * 0.75 + (c.r() - 0.5) * GW * 0.6;
              const sy = cy + Math.sin(a) * GH * 0.75 + (c.r() - 0.5) * GH * 0.6;
              const tgt = c.r() < 0.25 ? [home, ocean, crumble, thorn, twinA][Math.floor(c.r() * 5)] : -1;
              const tx = tgt >= 0 ? bodies[tgt].x : sx - Math.cos(a) * GW * (0.8 + c.r() * 0.6);
              const ty = tgt >= 0 ? bodies[tgt].y : sy - Math.sin(a) * GH * (0.8 + c.r() * 0.6);
              w.meteors.push({ id: Math.floor(c.r() * 1e6), x: sx, y: sy, sx, sy, tx, ty, t0: w.t, dur: 1.4 + c.r() * 1.2, target: tgt, kind: 'shower', ang: 0 } as Meteor);
            }
          },
        };
      },
    },
    {
      id: 'islands', label: 'islands in the storm', weight: 6, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'islands',
          step() {
            if (w.phase !== 'live' || w.islands.some((q) => q.state !== 'sea')) return;
            const O = bodies[ocean];
            const cand = w.islands.filter((q, i) => i > 0 && surf(O, q.lon, q.lat).c > 0.35);
            if (!cand.length || !w.director.want('island', 0.5, 75 / traffic)) return;
            const is = cand[Math.floor(c.r() * cand.length)];
            is.state = 'flung';
            is.liftT = w.t;
            const p = surf(O, is.lon, is.lat);
            w.tornadoes.push({ id: Math.floor(c.r() * 1e6), body: ocean, lon: is.lon, lat: is.lat, h: 0.5, drift: 0, born: w.t, dur: 8 });
            c.say(`A tornado on ${O.name} tears an island into the sky, trees and all.`, p.x, p.y, { body: ocean });
            c.emit('island', p.x, p.y, 0.6);
            c.look('island', p.x, p.y, 2.2, 10, 6);
          },
        };
      },
    },
    {
      id: 'crash', label: 'hard landings', weight: 5, tags: ['mishap'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'crash',
          step() {
            if (w.phase !== 'live' || crashing.next || crashing.now || w.ship.state !== 'landed' || !w.director.want('crash', 0.55, 200 / traffic)) return;
            crashing.next = true;
          },
        };
      },
    },
    {
      id: 'flares', label: 'flares on the old sun', weight: 5, tags: ['sun'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'flares',
          step() {
            if (w.phase !== 'live' || w.sun.flare > 0 || !w.director.want('flare', 0.25 + w.sun.age * 0.2, (70 * hurry()) / traffic)) return;
            w.sun.flare = 1;
            w.sun.flareAng = c.r() * Math.PI * 2;
            const fx2 = cx + Math.cos(w.sun.flareAng) * w.sun.r;
            const fy2 = cy + Math.sin(w.sun.flareAng) * w.sun.r;
            if (w.director.want('flareline', 0.1, 150)) c.say(w.sun.age > 0.6 ? 'A great flare loops off the red sun.' : 'A flare leaps from the sun.', fx2, fy2, { kind: 'quiet', body: -1 });
            c.emit('flare', fx2, fy2, 0.35);
          },
        };
      },
    },
    {
      id: 'signal', label: 'the signalscope', weight: 4, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'signal',
          step() {
            if (w.phase !== 'live' || !w.director.want('signal', 0.3, 100 / traffic)) return;
            const camp = w.camps[1 + Math.floor(c.r() * (w.camps.length - 1))] ?? w.camps[0];
            const B = bodies[camp.body];
            const p = surf(B, camp.lon, camp.lat);
            camp.playing = true;
            camp.since = w.t;
            fx('ring', p.x, p.y, { dur: 2.4, r: 26 * kr, color: '#c8f0c0' });
            c.say(`The signalscope picks up a ${camp.instrument} on ${B.name}.`, p.x, p.y, { body: B.id });
            c.emit('signal', p.x, p.y, 0.3);
            c.after(4.5, () => c.say(pick(CHATTER, c.r), p.x, p.y, { kind: 'radio', who: camp.who, body: B.id }));
          },
        };
      },
    },
    {
      id: 'marshmallow', label: 'marshmallows at home', weight: 4, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'marshmallow',
          step() {
            if (w.phase !== 'live' || !w.director.want('marshmallow', 0.1, (w.stayHome ? 30 : 90) / traffic)) return;
            const camp = w.camps[0];
            const p = surf(bodies[home], camp.lon, camp.lat);
            if (p.c < 0.1) return;
            const burnt = c.r() < 0.5;
            fx(burnt ? 'flash' : 'spark', p.x, p.y - 3 * kr, { dur: 0.8, r: 5 * kr, color: burnt ? '#ff8040' : '#ffe0a0' });
            c.say(burnt ? `${camp.who}'s marshmallow catches fire. Again.` : `${camp.who} toasts a perfect marshmallow, golden brown.`, p.x, p.y, { kind: 'quiet', body: home });
            c.emit('marshmallow', p.x, p.y, 0.15);
          },
        };
      },
    },
    {
      id: 'geysers', label: 'geysers at home', weight: 3, tags: ['life'],
      create: (c) => {
        const w = c.world;
        const spots = Array.from({ length: 3 }, () => [c.r() * Math.PI * 2, (c.r() - 0.5) * 1.1] as [number, number]);
        return {
          id: 'geysers',
          step() {
            if (w.phase !== 'live' || !w.director.want('geyser', 0.15, 50 / traffic)) return;
            const H = bodies[home];
            const s = spots.map((q) => [q, surf(H, q[0], q[1])] as const).find(([, p]) => p.c > 0.25);
            if (!s) return;
            const p = s[1];
            for (let i = 0; i < 16; i++) fx('splash', p.x, p.y, { vx: p.nx * (14 + c.r() * 22) * kr + (c.r() - 0.5) * 6 * kr, vy: p.ny * (14 + c.r() * 22) * kr + (c.r() - 0.5) * 6 * kr, dur: 1.4 + c.r(), r: (1 + c.r() * 1.5) * kr, color: '#e8f6ff' });
            if (w.director.want('geyserline', 0.1, 160)) c.say(`A geyser erupts on ${H.name}.`, p.x, p.y, { kind: 'quiet', body: home });
            c.emit('geyser', p.x, p.y, 0.2);
          },
        };
      },
    },
    { id: 'whitehole', label: 'the white hole', weight: 2.5, tags: ['rare'], create: () => ({ id: 'whitehole' }) },
    { id: 'farsignal', label: 'the far signal', weight: 2, tags: ['rare'], create: () => ({ id: 'farsignal' }) },
    { id: 'cometcore', label: 'the comet\'s core', weight: 2.5, tags: ['rare'], create: () => ({ id: 'cometcore' }) },
  ];
  const RULE = { total: [6, 8] as [number, number], quota: { threat: [0, 2] as [number, number], weather: [0, 2] as [number, number], rare: [0, 1] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE, ['probe', 'quantum']);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);
  const castHas = (id: string) => world.castIds.includes(id);
  if (castHas('whitehole')) world.whiteHole = [whiteAng, Rmax];

  function jumpShy(to: number) {
    const S = bodies[shy];
    const from = world.shyAt;
    let next = to;
    if (to === -2) {
      const opts2 = shyHosts.filter((h) => h !== from);
      next = opts2[Math.floor(r() * opts2.length)];
    }
    fx('ring', S.x, S.y, { dur: 1.4, r: 16 * kr, color: '#c9b8ff' });
    world.shyAt = next;
    world.shyT = world.t;
    positions();
    fx('ring', S.x, S.y, { dur: 1.8, r: 20 * kr, color: '#c9b8ff' });
    say(next < 0 ? `${cap(S.name)} is circling the sun itself. Its sixth place.` : `Nobody was looking. ${cap(S.name)} is at ${bodies[next].name} now.`, S.x, S.y, { kind: next < 0 ? 'big' : 'event', body: shy });
    emit(next < 0 ? 'sixth' : 'quantum', S.x, S.y, next < 0 ? 0.9 : 0.5);
    look('quantum', S.x, S.y, 2.2, 7, 6);
  }

  /** A visitor's touch. */
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 2 || !live()) return null;
    const S = bodies[shy];
    if (Math.hypot(x - S.x, y - S.y) < S.R + 18 * kr && world.t - world.shyT > 4) {
      lastNudge = world.t;
      jumpShy(-2);
      return `You look away. ${cap(S.name)} is gone.`;
    }
    if (Math.hypot(x - cx, y - cy) < world.sun.r + 10 * kr) {
      lastNudge = world.t;
      world.sun.flare = 1;
      world.sun.flareAng = Math.atan2(y - cy, x - cx);
      const line = 'A flare leaps from the sun.';
      say(line, x, y, { body: -1 });
      emit('nudge', x, y, 0.3);
      return line;
    }
    const near = bodies.filter((b) => !b.gone && b.kind !== 'shy').map((b) => [b, Math.hypot(x - b.x, y - b.y) - b.R] as const).sort((a, b) => a[1] - b[1])[0];
    lastNudge = world.t;
    if (near && near[1] < 40 * kr && shipAlive()) {
      const B = near[0];
      world.ship.asked = B.id;
      if (world.stayHome) world.stayHome = false;
      const line = `The traveller sets a course for ${B.name}.`;
      say(line, B.x, B.y, { body: B.id });
      emit('nudge', x, y, 0.3);
      return line;
    }
    fx('ring', x, y, { dur: 2, r: 30 * kr, color: '#c8f0c0' });
    const line = 'The signalscope sweeps the dark. A faint song.';
    say(line, x, y, { kind: 'quiet', body: -1 });
    emit('nudge', x, y, 0.2);
    return line;
  }

  function step(dt: number) {
    world.t += dt;
    world.tau += dt;
    if (world.tau >= loopLen) {
      world.loop++;
      newLoop(false);
    }
    world.director.step(world.t, dt);
    for (let i = later.length - 1; i >= 0; i--)
      if (world.t >= later[i].at) {
        const { fn } = later[i];
        later.splice(i, 1);
        fn();
      }
    positions();
    sunAndLoop(dt);
    if (live() || world.phase === 'collapse') {
      shipStep(dt);
      campsStep(dt);
      stormsStep();
      crustStep();
      cannonStep(dt);
      cometStep();
      for (const s of systems) s.step?.(dt);
    } else {
      // In the light and the dark, only the wreckage moves.
      world.notes = [];
      if (world.phase === 'nova') shipStep(dt);
    }
    meteorsStep();
    fxStep(dt);
    subtitles();
  }

  newLoop(true);
  return world;
}
