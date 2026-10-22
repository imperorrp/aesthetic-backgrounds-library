/**
 * # Saber Front: a ground battle of the galactic civil war, seen from a ridge as a wide diorama.
 *
 * On screen, at a glance: two lines of infantry trading coloured bolts across a strip of open
 * ground (the Grand Army's troopers in white armour with their legion's markings, firing blue; the
 * Confederacy's tan battle droids in ranks, firing red); six-legged assault walkers and spider
 * walkers laying their big guns; troop gunships with bubble turrets coming in low to drop squads;
 * starfighters dogfighting overhead; artillery arcing across; smoke and fire everywhere; wedge
 * cruisers and long-spined frigates hanging in the sky.
 * The camera: on a ridge above the field, the whole battle laid out below, the sky above it.
 *
 * Always happening (the floor):
 * - Infantry: both lines fire on cooldowns; bolts fly; men and droids fall (and lie where they
 *   fell for a while); squads move up and fall back with the front.
 * - Reinforcements: gunships bring squads (descend, doors open, troopers jump down, then a strafing
 *   run over the droid line); the Confederacy's landers set down columns of droids; a short line
 *   marches in from the edge when nothing can fly.
 * - Walkers advance with the front and duel with their main guns; a hurt one smokes, and falls.
 *   A carrier gunship sets a new one down; a new spider walks in from the rear.
 * - Artillery from both rear lines; starfighters in looping dogfights, one going down in flames;
 *   flights crossing; capital ships hanging in the sky.
 * - The tide: the front moves with the strength of the lines and a slow swell; at its limits one
 *   side breaks and falls back, then regroups. It never ends.
 *
 * The cast (each seed draws some):
 * - knights [hero] a knight with a light-blade in the line, turning bolts back on the droids;
 *   leads charges across the open ground.
 * - duelist [hero, rare] the Confederacy's blade-master comes out to meet the knight; they duel in
 *   no-man's-land, and the duelist withdraws (requires knights).
 * - rollers [threat] shield droids roll in, unfold behind their bubble shields and pour fire in.
 * - spiders [threat] a second spider walker; the droids' guns are heavier.
 * - shield [objective] a dome shield over the Confederacy's rear; commandos creep along the near
 *   ground to its generator, and it goes down (a barrage follows); a lander brings a new one.
 * - broadside [sky] a capital ship opens its broadside on the enemy ship or the far ground.
 * - descent [sky] a cruiser comes down through the clouds and launches fighters, then climbs.
 * - bombers [air] a bomber flight lays a line of bombs across the enemy ranks.
 * - storm [weather] the field's own weather: a sandstorm, a downpour, the storm breaking.
 * - flares [weather] illumination flares drift down over a night field and light it.
 * Quotas: 4–6 in all; 0–2 hero; 1–2 sky; 0–1 weather.
 *
 * Events, common to legendary (each a line said on the map):
 * - common: a squad dropped, a lander unloading, a shell landing, a fighter shot down, radio lines.
 * - uncommon: a walker falls, a gunship is shot down, a charge, a retreat and a regroup, a broadside.
 * - rare: the shield goes down, a cruiser's descent, a bomber run.
 * - legendary: the duel in no-man's-land.
 *
 * What keeps it going: every loss is replaced, from the drop ships and the landers and from the
 * edge; the front swings with the strength of the lines, and whoever is pushed back regroups.
 * What changes with the seed: the battlefield (arena plains, crystal city, night jungle, ocean
 * platform, walled canyon) and its hour; the legion and its colour; which side holds the left;
 * the cast; the names of every squad, walker, gunship and ship.
 * A touch: marks the ground for the cruiser's guns: a strike comes down where you click.
 * Phone: the same battle, smaller: fewer men a side, one walker each, two dogfights.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import { BLADES, FIELDS, LEGIONS, type FieldKind } from './fields';
import type {
  Bolt, BoltAim, BoltKind, Capital, Craft, CraftKind, Dogfight, Fx, FxKind, Knight, SaberOptions, SaberWorld, Side, Soldier, SoldierKind, Squad, Walker,
} from './types';

const GA_SQUADS = ['TORRENT', 'HAMMER', 'SHRIKE', 'LANTERN', 'IRONSIDE', 'BRAMBLE', 'COMET', 'VANGUARD', 'ANVIL', 'WARDEN', 'FLINTLOCK', 'GRIFFIN', 'TALON', 'BULWARK'];
const GA_LEADERS = ['SERGEANT TALLON', 'CAPTAIN BRASK', 'SERGEANT KEEL', 'LIEUTENANT OSK', 'SERGEANT DUNE', 'CAPTAIN HARROW', 'SERGEANT FLINT', 'SERGEANT RUSK', 'CAPTAIN VANTO', 'SERGEANT MOSS', 'LIEUTENANT CORR', 'SERGEANT PIKE'];
const CF_UNITS = ['UNIT 4-4-7', 'BATTALION 9', 'COLUMN T-12', 'UNIT 3-3-9', 'COMPANY K-2', 'UNIT 8-0-1', 'COLUMN B-7', 'UNIT 6-6-2'];
const CF_LEADERS = ['COMMANDER K-77', 'COMMANDER R-3', 'TACTICAL DROID VX-9', 'COMMANDER T-14', 'COMMANDER Q-5', 'TACTICAL DROID ZN-2'];
const KNIGHTS = ['GENERAL ORIN VAEL', 'GENERAL SERA TALLO', 'GENERAL DUSAN KOR', 'GENERAL IRIS MERROW', 'GENERAL BAEL ODUNN', 'GENERAL NAHLI ROSK', 'GENERAL TEMO AXIRE'];
const DUELISTS = ['KHERAX THE COLLECTOR', 'THE PALE DUELIST', 'LADY VORRANE', 'GENERAL OSSK OF THE CONFEDERACY'];
const HEXA_NAMES = ['IRONHOOF', 'THE MULE', 'BIG SISTER', 'OLD STEADY', 'TORTOISE TWO', 'BULWARK', 'THE OX', 'GRANITE', 'PATIENCE', 'MOUNTAIN'];
const SPIDER_NAMES = ['SPIDER 11', 'SPIDER 4-0', 'THE WIDOW', 'SPIDER 7-7', 'THE HUNTSMAN', 'SPIDER 2-9'];
const GUNSHIP_NAMES = ['LANTERN ONE', 'HAWK TWO', 'GANNET SIX', 'OSPREY FOUR', 'CONDOR', 'KESTREL THREE', 'HERON FIVE', 'SWIFT ONE', 'PELICAN', 'MERLIN TWO'];
const LANDER_NAMES = ['LANDER K-9', 'LANDER 3-3', 'LANDER V-12', 'LANDER 0-8', 'LANDER R-4'];
const GA_SHIPS = ['THE VIGILANT', 'THE STEADFAST', 'THE IRON LANCE', 'THE BRIGHT SPEAR', 'THE RESOLUTE', 'THE LONG WATCH', 'THE CONSTANT'];
const CF_SHIPS = ['THE MALICE', 'THE GRAVE INTENT', 'THE LONG HUNGER', 'THE TALLY', 'THE COLD LEDGER', 'THE UNKIND', 'THE PROFIT'];

export const LINES = {
  gaHold: ['HOLD THE LINE!', 'KEEP FIRING!', 'STAY IN COVER', 'WATCH YOUR SPACING', 'THEY JUST KEEP COMING', 'STEADY, STEADY', 'PICK YOUR TARGETS', 'EYES FRONT', 'CHANGE YOUR CHARGE PACK', 'SHIELDS? WHAT SHIELDS?'],
  gaHit: ['MEDIC!', 'MAN DOWN!', 'I\'M HIT!', 'MEDIC! OVER HERE!', 'WE LOST HOLLIS', 'GET HIM OUT OF THERE', 'WE NEED A MEDIC!'],
  gaPush: ['FORWARD! FORWARD!', 'PUSH THEM BACK!', 'MOVE UP, MOVE UP', 'GO, GO, GO!', 'FOR THE LEGION!'],
  gaRetreat: ['FALL BACK! FALL BACK!', 'PULL BACK TO THE SECOND LINE', 'WE CAN\'T HOLD HERE', 'GET BACK, GET BACK!'],
  gaRegroup: ['REGROUP ON ME!', 'FORM UP!', 'DIG IN HERE', 'COUNT OFF!', 'WE HOLD HERE'],
  cfHold: ['ROGER, ROGER', 'BLAST THEM', 'TARGET ACQUIRED', 'MOVE, MOVE', 'RIGHT AWAY, COMMANDER', 'SURRENDER, PLEASE', 'I HATE THIS JOB', 'ROGER, ROGER', 'ADVANCE'],
  cfHit: ['UH OH', 'OW', 'WE ARE TAKING LOSSES', 'THAT WAS NOT IN THE PLAN', 'ROGER, ROG—'],
  cfRetreat: ['RETREAT! RETREAT!', 'FALL BACK. ROGER, ROGER', 'THIS IS NOT IN THE PROGRAM'],
  cfPush: ['ADVANCE, ADVANCE', 'CRUSH THEM', 'ROLL OUT', 'ROGER, ROGER'],
  gunshipIn: ['THIRTY SECONDS!', 'HOLD ON, IT\'S GONNA GET HOT', 'DROP ZONE IS HOT', 'TEN SECONDS, LOCK AND LOAD'],
  gunshipDrop: ['GREEN LIGHT! GO, GO, GO!', 'EVERYBODY OUT!', 'GO! GO!'],
  gunshipStrafe: ['STRAFING RUN, HEADS DOWN', 'TURRETS FREE', 'TAKING FIRE!', 'MAKING ANOTHER PASS'],
  gunshipDown: ['WE\'RE HIT! WE\'RE GOING DOWN!', 'MAYDAY, MAYDAY', 'BRACE! BRACE!'],
  lander: ['UNLOADING', 'BATTALION, DEPLOY', 'ROGER, ROGER', 'MORE OF US. ROGER, ROGER'],
  walker: ['MAIN GUN READY', 'FIRING!', 'TARGET THAT SPIDER', 'ADJUST TEN DEGREES', 'REARMING', 'GOOD HIT, GOOD HIT'],
  walkerHurt: ['WE\'VE BEEN HIT!', 'LEGS FOUR AND FIVE ARE GONE', 'SHE WON\'T HOLD MUCH LONGER', 'FIRE IN THE DRIVE'],
  spider: ['TARGETING', 'ENEMY WALKER LOCATED', 'FIRING. ROGER, ROGER'],
  knight: ['WITH ME!', 'HOLD YOUR GROUND', 'STAY BEHIND ME', 'KEEP THEM OFF THE WALKERS', 'THERE ARE TOO MANY OF THEM', 'TRUST YOUR TRAINING'],
  duelist: ['YOUR ARMY IS FINISHED, KNIGHT', 'ANOTHER BLADE FOR MY COLLECTION', 'WE WILL MEET AGAIN'],
};

/** Where a dogfighter is at time t: the chased one on its looping path, the chaser `lag` seconds behind it. */
export function dogfightAt(df: Dogfight, t: number, chaser: boolean): { x: number; y: number; ang: number } {
  const at = (tt: number) => {
    const k = tt - df.t0;
    return [df.cx + df.ax * Math.sin(df.w * k + df.ph) + df.ax * 0.05 * k * Math.cos(df.ph * 3), df.cy + df.ay * Math.sin(2 * df.w * k + df.ph * 1.7)] as const;
  };
  const tt = chaser ? t - df.lag : t;
  const [x, y] = at(tt);
  const [x2, y2] = at(tt + 0.05);
  return { x, y, ang: Math.atan2(y2 - y, x2 - x) };
}

type Ctx = {
  world: SaberWorld; r: Rng;
  say(text: string, x: number, d: number, alt: number, color?: string): void;
  emit(type: string, x: number, d: number, weight: number): void;
  chronicle(text: string): void;
  speak(who: { line: string; lineT: number }, line: string, urgent?: boolean): void;
  /** True once, when the battle's act reaches the climax this system was chosen for. */
  climax(id: string): boolean;
  /** The battle's phase now. */
  phase(): string;
  look(why: string, x: number, d: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
};

export function createSaberFront(seed: string | number, W: number, H: number, opts: SaberOptions): SaberWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'saber');
  const shotR: Rng = forkRng(seed, 'saber-shots');
  const g: Genome = createGenome(seed, 'saber');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const phone = GW < GH;
  const traffic = Math.max(0.3, Math.min(2.5, opts.traffic));
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];
  let ids = 1;

  const drawnField = g.weighted<FieldKind>({ arena: 3, crystal: 2, jungle: 2, platform: 2, canyon: 2 });
  const field: FieldKind = opts.field && opts.field in FIELDS ? (opts.field as FieldKind) : drawnField;
  const F = FIELDS[field];
  const hour = g.fork('hour').int(0, F.hours.length - 1);
  const HY = Math.round(GH * (phone ? 0.5 : g.range(F.horizon[0], F.horizon[1])));
  const NY = Math.round(GH * 0.885);
  const gaDir: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const cl = (v: number) => Math.max(0, Math.min(1, v));
  const fOf = (d: number) => 0.3 + 0.7 * Math.pow(1 - cl(d), 2);
  const yOf = (d: number) => HY + (NY - HY) * Math.pow(1 - Math.max(-0.2, Math.min(1, d)), 2);
  const mOf = (d: number) => 0.06 + 0.94 * Math.pow(1 - cl(d), 2);
  const xOf = (x: number, d: number) => GW / 2 + (x - GW / 2) * fOf(d);
  /** The ground x under a picture x at depth d. */
  const gx = (sx: number, d: number) => GW / 2 + (sx - GW / 2) / fOf(d);
  const DEPTH = 1400 * u;
  const N = Math.max(8, Math.round((phone ? 18 : 46) * Math.pow(traffic, 0.7)));
  const NC = Math.round(N * 1.35);
  const legion = g.pick(LEGIONS);

  // eslint-disable-next-line prefer-const
  let world: SaberWorld;
  world = {
    t: 0, W, H, GW, GH, u, phone, bus,
    director: createDirector(forkRng(seed, 'saber-director'), { arc: g.pick(ARCS), period: g.range(300, 600), establish: () => establish() }),
    field, hour, place: g.pick(F.places), legion, cast: [], castIds: [],
    HY, NY, yOf, mOf, xOf, gaDir,
    front: GW / 2 + g.range(-0.05, 0.05) * GW, gap: 240 * u,
    soldiers: [], squads: [], walkers: [], rollers: [], crafts: [], knights: [],
    bolts: [], shells: [], fx: [], scorches: [], wrecks: [],
    dogfights: [], flybys: [], skyfalls: [], skybolts: [], capitals: [],
    shield: null, flares: [],
    rain: F.rain * 0.6, dust: 0, lightning: 0, fog: F.fog, wind: g.range(-1, 1) * 10,
    fallen: { ga: 0, cf: 0 }, downed: { walkers: 0, gunships: 0, fighters: 0 },
    tide: 0, mood: 'stalemate',
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    labels: [], chronicle: [], radio: [], standards: [], hulks: [],
    jump: null,
    act: { n: 0, phase: 'buildup', t0: 0, until: 0, attacker: 'ga', climax: 'armour', fired: false, winner: null, title: '' },
    step, nudge,
    counts: () => ({
      ga: gaAlive.length,
      cf: cfAlive.length,
      walkers: world.walkers.filter((w) => w.state !== 'fall').length,
      rollers: world.rollers.length,
      crafts: world.crafts.length,
      knights: world.knights.filter((k) => k.state !== 'away').length,
      fighters: world.dogfights.filter((q) => q.state === 'fight').length * 2 + world.flybys.reduce((s, f) => s + f.n, 0),
      capitals: world.capitals.length,
      bolts: world.bolts.length,
      shells: world.shells.length,
      fx: world.fx.length,
      wrecks: world.wrecks.length,
      fallen: world.fallen.ga + world.fallen.cf,
      front: Math.round((xOf(world.front, 0.25) / GW) * 100),
    }),
  };

  // ---- the verbs -----------------------------------------------------------------------------------
  const fwd = (s: Side) => (s === 'ga' ? gaDir : -gaDir) as 1 | -1;
  const other = (s: Side): Side => (s === 'ga' ? 'cf' : 'ga');
  /** Where a soldier `hx` behind the front stands. */
  const lineX = (s: Side, hx: number) => world.front - fwd(s) * (world.gap / 2 + hx);
  /** Just off the picture behind side s at depth d. */
  const rearX = (s: Side, d: number, off = 0) => gx(fwd(s) > 0 ? -off : GW + off, d);
  /** How far behind the front side s can stand at depth d and still be on the picture. */
  const maxHx = (s: Side, d: number) => Math.max(80 * u, Math.abs(world.front - rearX(s, d, -30 * u)) - world.gap / 2);
  const pickD = () => (r() < 0.55 ? 1 - Math.sqrt(0.16 + r() * 0.76) : 0.05 + r() * 0.48);
  const pyOf = (d: number, alt: number) => yOf(d) - alt * mOf(d);

  function establish(): { x: number; y: number; zoom: number } {
    const q = shotR();
    const wk = world?.walkers?.find((w) => w.state === 'walk');
    if (wk && q < 0.35) return { x: xOf(wk.x, wk.d), y: pyOf(wk.d, 40 * u), zoom: 2 };
    const s = world?.soldiers?.filter((x) => x.state === 'line');
    const p = s && s.length ? s[Math.floor(shotR() * s.length)] : null;
    if (p && q < 0.8) return { x: xOf(p.x, p.d), y: pyOf(p.d, 20 * u), zoom: 2.2 };
    return { x: xOf(world?.front ?? GW / 2, 0.3), y: yOf(0.3), zoom: 1.6 };
  }
  /** A headline: only the biggest moments, one at a time (a newer one waits out the last). */
  const sayAt = (text: string, wx: number, wy: number, color = '#efe8dc') => {
    bus.emit({ type: 'say', text, x: wx, y: wy, priority: 'high' });
    const last = world.labels[world.labels.length - 1];
    if (last && (last.text === text || world.t - last.t0 < 4.5)) return;
    world.labels.push({ text, x: wx, y: wy, t0: world.t, color });
    if (world.labels.length > 4) world.labels.shift();
  };
  const say = (text: string, x: number, d: number, alt: number, color = '#efe8dc') => sayAt(text, xOf(x, d), pyOf(d, alt), color);
  const emit = (type: string, x: number, d: number, weight: number) => {
    bus.emit({ type, x: xOf(x, d), y: yOf(d), weight });
    world.director.note(weight * 0.4);
  };
  const emitAt = (type: string, wx: number, wy: number, weight: number) => {
    bus.emit({ type, x: wx, y: wy, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };
  /** A line on the radio: heard as a subtitle, one at a time (a line that comes too soon after the last is only heard by the one who said it). */
  let lastRadio = -9;
  const speak = (who: { line: string; lineT: number }, line: string, urgent = false) => {
    who.line = line;
    who.lineT = world.t;
    bus.emit({ type: 'radio', text: line, weight: 0.05, priority: 'low' });
    if (!urgent && world.t - lastRadio < 3.6) return;
    lastRadio = world.t;
    const o = who as { leader?: string; name?: string; side?: Side };
    world.radio.push({ who: o.leader ?? o.name ?? '', text: line, side: o.side ?? 'ga', t0: world.t });
    if (world.radio.length > 6) world.radio.shift();
  };
  const look = (why: string, x: number, d: number, zoom: number, hold: number, priority: number) => world.director.look(why, xOf(x, d), yOf(d) - 30 * u * mOf(d), zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: FxKind, x: number, d: number, alt: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 700) return;
    world.fx.push({ kind, x, d, alt, vx: 0, vd: 0, valt: 0, t0: world.t, dur: 2, r: 10 * u, color: '#5a5450', seed: Math.floor(r() * 1e6), ...extra });
  };
  const titled = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const alive = (s: Soldier) => s.state !== 'dead' && s.state !== 'fall';
  const byId = new Map<number, Soldier>();
  const gaAlive: Soldier[] = [];
  const cfAlive: Soldier[] = [];
  const climax = (id: string) => {
    const a = world.act;
    if (a.phase !== 'climax' || a.climax !== id || a.fired) return false;
    a.fired = true;
    return true;
  };
  const ctx: Ctx = { world, r, say, emit, chronicle, speak, look, after, climax, phase: () => world.act.phase };

  // ---- the armies ------------------------------------------------------------------------------------
  let squadNo = { ga: Math.floor(r() * GA_SQUADS.length), cf: Math.floor(r() * CF_UNITS.length) };
  function newSquad(side: Side, size: number): Squad {
    const name = side === 'ga' ? `${GA_SQUADS[squadNo.ga++ % GA_SQUADS.length]} SQUAD` : CF_UNITS[squadNo.cf++ % CF_UNITS.length];
    const sq: Squad = { id: ids++, side, name, leader: side === 'ga' ? pick(GA_LEADERS) : pick(CF_LEADERS), line: '', lineT: -99, size };
    world.squads.push(sq);
    return sq;
  }
  function spawnSoldier(side: Side, kind: SoldierKind, x: number, d: number, hx: number, hd: number, state: Soldier['state'], squad: number, alt = 0): Soldier {
    const s: Soldier = {
      id: ids++, side, kind, x, d, alt, hx, hd, state, t0: world.t, cool: 0.5 + r() * 2.5, ph: r() * 6, seed: Math.floor(r() * 1e6), squad,
      crouch: state === 'line' && side === 'ga' && r() < 0.4 ? 1 : 0, face: fwd(side), fireT: -9,
    };
    world.soldiers.push(s);
    byId.set(s.id, s);
    return s;
  }
  const kindFor = (side: Side, i: number): SoldierKind =>
    side === 'ga' ? (i === 0 ? 'officer' : i === 3 ? 'heavy' : 'trooper') : i === 0 ? 'commander' : r() < (world.castIds?.includes('spiders') ? 0.18 : 0.1) ? 'super' : 'droid';
  /** A squad's slots: a centre behind the front and a spread around it. */
  function slots(side: Side, n: number, hd0 = pickD()) {
    const mh = maxHx(side, hd0);
    const hxC = Math.pow(r(), side === 'ga' ? 2 : 1.6) * Math.min(mh * 0.75, 440 * u) + 10 * u;
    return Array.from({ length: n }, (_, i) => {
      const hd = Math.max(0.03, Math.min(0.64, hd0 + (r() - 0.5) * 0.07));
      return { hx: Math.max(0, hxC + (side === 'cf' ? (i % 4) * 18 * u + (r() - 0.5) * 10 * u : (r() - 0.5) * 80 * u)), hd };
    });
  }
  function deploy(side: Side, total: number) {
    let left = total;
    while (left > 0) {
      const n = Math.min(left, side === 'ga' ? 5 + Math.floor(r() * 3) : 7 + Math.floor(r() * 4));
      const sq = newSquad(side, n);
      slots(side, n).forEach((sl, i) => spawnSoldier(side, kindFor(side, i), lineX(side, sl.hx), sl.hd, sl.hx, sl.hd, 'line', sq.id));
      left -= n;
    }
  }

  // ---- bolts, blasts and the dead -------------------------------------------------------------------
  function bolt(side: Side, kind: BoltKind, x0: number, d0: number, a0: number, x1: number, d1: number, a1: number, aim: BoltAim, target: number, hit: boolean, shooter = -1, speed = 1500 * u) {
    if (world.bolts.length > 260) return;
    const dist = Math.hypot(x1 - x0, (d1 - d0) * DEPTH, a1 - a0);
    world.bolts.push({ x0, d0, a0, x1, d1, a1, t0: world.t, dur: Math.max(0.1, Math.min(1.4, dist / speed)), side, kind, aim, target, hit, shooter });
  }
  const distOf = (a: { x: number; d: number }, b: { x: number; d: number }) => Math.hypot(a.x - b.x, (a.d - b.d) * DEPTH);
  let kills = 0;
  function kill(s: Soldier, cause: 'bolt' | 'blast' | 'blade') {
    if (!alive(s)) return;
    s.state = 'fall';
    s.t0 = world.t;
    s.alt = 0;
    world.fallen[s.side]++;
    kills++;
    if (s.side === 'cf') for (let k = 0; k < (cause === 'blast' ? 4 : 2); k++) fx('spark', s.x, s.d, 16 * u, { vx: (r() - 0.5) * 60 * u, valt: (20 + r() * 40) * u, dur: 0.5 + r() * 0.4, r: 2 * u, color: '#ffd080' });
    const sq = world.squads.find((q) => q.id === s.squad);
    if (sq && r() < 0.16 && world.t - sq.lineT > 6) speak(sq, pick(s.side === 'ga' ? LINES.gaHit : LINES.cfHit));
    if (kills % 9 === 0) emit('down', s.x, s.d, 0.06);
  }
  /** A blast on the ground: fire, smoke, a scorch; who is near it falls; walkers and rollers are hurt. */
  function explode(x: number, d: number, R: number, power: number, opts: { big?: boolean; walkerDmg?: number } = {}) {
    const big = opts.big ? 1.8 : 1;
    fx('flash', x, d, 10 * u, { dur: 0.35, r: R * 1.6 * big });
    fx('blast', x, d, 4 * u, { dur: 0.7, r: R * 0.9 * big });
    for (let k = 0; k < 3 * big; k++) fx('fire', x + (r() - 0.5) * R * 0.6, d + (r() - 0.5) * 0.01, (5 + r() * 25) * u, { vx: (r() - 0.5) * 30 * u, valt: (20 + r() * 40) * u, dur: 0.6 + r() * 0.7, r: (8 + r() * 10) * u * big });
    for (let k = 0; k < 6 * big; k++) fx('debris', x, d, 6 * u, { vx: (r() - 0.5) * 220 * u, vd: (r() - 0.5) * 0.06, valt: (60 + r() * 160) * u, dur: 1 + r() * 0.8, r: (1.5 + r() * 2.5) * u, color: '#2a2420' });
    for (let k = 0; k < 4 * big; k++) fx('dust', x + (r() - 0.5) * R, d + (r() - 0.5) * 0.015, 0, { vx: (r() - 0.5) * 40 * u + world.wind, valt: (10 + r() * 20) * u, dur: 2.5 + r() * 2, r: (16 + r() * 18) * u * big });
    for (let k = 0; k < 3 * big; k++) fx('smoke', x + (r() - 0.5) * R * 0.5, d, (10 + r() * 20) * u, { vx: world.wind * 0.6, valt: (18 + r() * 14) * u, dur: 5 + r() * 4, r: (12 + r() * 12) * u * big, color: '#3a3430' });
    world.scorches.push({ x, d, r: R * 0.8 * big, t0: world.t });
    if (world.scorches.length > 140) world.scorches.shift();
    for (const s of world.soldiers) {
      if (!alive(s) || s.alt > 30 * u) continue;
      const dd = distOf(s, { x, d });
      if (dd < R && r() < power * (1 - dd / R)) kill(s, 'blast');
    }
    const wd = opts.walkerDmg ?? 6;
    for (const w of world.walkers) if (w.state === 'walk' && distOf(w, { x, d }) < R * 1.6) w.hp -= wd * (0.6 + r() * 0.8);
    for (const ro of world.rollers) if (ro.state !== 'dead' && distOf(ro, { x, d }) < R * 1.2) ro.hp -= wd * 4;
  }

  function fire(s: Soldier) {
    const enemies = s.side === 'ga' ? cfAlive : gaAlive;
    const mx = s.x + s.face * 8 * u;
    const ma = (s.crouch > 0.5 ? 13 : 20) * u * (s.kind === 'super' ? 1.15 : 1);
    s.fireT = world.t;
    // Now and then at a gunship overhead, or a roller's shield, or a walker.
    if (s.side === 'cf' && r() < 0.18) {
      const c = world.crafts.find((q) => q.side === 'ga' && (q.state === 'drop' || q.state === 'strafe' || q.state === 'descend') && Math.abs(q.x - s.x) < 600 * u);
      if (c) return bolt('cf', 'rifle', mx, s.d, ma, c.x + (r() - 0.5) * 60 * u, c.d, c.alt + (r() - 0.3) * 30 * u, 'craft', c.id, false, s.id);
    }
    if (s.side === 'ga' && r() < 0.14) {
      const ro = world.rollers.find((q) => q.state === 'shield' && distOf(q, s) < 1000 * u);
      if (ro) return bolt('ga', 'rifle', mx, s.d, ma, ro.x - fwd('cf') * 26 * u, ro.d, (8 + r() * 26) * u, 'roller', ro.id, false, s.id);
    }
    if (r() < 0.06) {
      const wk = world.walkers.find((q) => q.side !== s.side && q.state === 'walk' && distOf(q, s) < 1100 * u);
      if (wk) return bolt(s.side, 'rifle', mx, s.d, ma, wk.x + (r() - 0.5) * 50 * u, wk.d, (30 + r() * 50) * u, 'walker', wk.id, true, s.id);
    }
    if (!enemies.length) return;
    let best: Soldier | null = null;
    let bd = Infinity;
    for (let k = 0; k < 5; k++) {
      const e = enemies[Math.floor(r() * enemies.length)];
      if (e.alt > 20 * u) continue;
      const dd = distOf(e, s) * (0.8 + r() * 0.4);
      if (dd < bd) {
        bd = dd;
        best = e;
      }
    }
    if (!best || bd > 1500 * u) return;
    let p = s.side === 'ga' ? 0.024 : 0.022;
    if (s.kind === 'heavy' || s.kind === 'super') p *= 1.6;
    if (best.crouch > 0.5) p *= 0.55;
    if (s.state === 'charge') p *= 1.3;
    if (best.state === 'charge') p *= 1.7;
    if (best.state === 'retreat' || best.state === 'march') p *= 1.4;
    // The side being pushed back is dug in: it hits more, and is hit less.
    p *= 1 - (s.side === 'ga' ? 1 : -1) * world.tide * 0.3;
    p *= Math.max(0.4, 1 - bd / (2600 * u));
    const ta = (best.crouch > 0.5 ? 10 : 16) * u;
    // A knight near the target turns it.
    if (s.side === 'cf') {
      const kn = world.knights.find((k) => (k.state === 'stand' || k.state === 'lead') && Math.abs(k.x - best!.x) < 90 * u && Math.abs(k.d - best!.d) < 0.08);
      if (kn && r() < 0.4) return bolt('cf', 'rifle', mx, s.d, ma, kn.x + kn.face * 10 * u, kn.d, 24 * u, 'knight', kn.id, true, s.id);
    }
    // The dome turns it.
    const sh = world.shield;
    if (s.side === 'ga' && sh && sh.up > 0.6 && Math.abs(best.x - sh.x) < sh.r * 0.95 && Math.abs(best.d - sh.d) < 0.16) {
      const ex = sh.x - fwd('cf') * sh.r * (0.85 + r() * 0.1);
      return bolt('ga', 'shield', mx, s.d, ma, ex, best.d, (20 + r() * 60) * u, 'none', -1, false, s.id);
    }
    const hit = r() < p;
    if (hit) bolt(s.side, 'rifle', mx, s.d, ma, best.x, best.d, ta, 'soldier', best.id, true, s.id);
    else {
      // A miss: past them, or into the ground short.
      const over = r() < 0.6;
      const k = over ? 1.15 + r() * 0.4 : 0.75 + r() * 0.2;
      bolt(s.side, 'rifle', mx, s.d, ma, s.x + (best.x - s.x) * k, s.d + (best.d - s.d) * k + (r() - 0.5) * 0.03, over ? (8 + r() * 40) * u : 0, 'none', -1, false, s.id);
    }
  }
  function resolve(b: Bolt) {
    if (b.kind === 'cannon') {
      if (b.aim === 'walker') {
        const w = world.walkers.find((q) => q.id === b.target);
        if (w && w.state === 'walk' && b.hit) {
          w.hp -= 15 + r() * 14;
          fx('flash', w.x, w.d, b.a1, { dur: 0.3, r: 40 * u });
          for (let k = 0; k < 5; k++) fx('spark', w.x, w.d, b.a1, { vx: (r() - 0.5) * 160 * u, valt: (r() - 0.2) * 140 * u, dur: 0.5 + r() * 0.5, r: 2 * u, color: '#ffc070' });
          fx('smoke', w.x, w.d, b.a1, { vx: world.wind * 0.5, valt: 16 * u, dur: 4, r: 14 * u, color: '#2e2a28' });
          if (w.hp < 40 && world.t - w.lineT > 8) speak(w, pick(w.side === 'ga' ? LINES.walkerHurt : ['DAMAGE. DAMAGE.', 'SYSTEMS FAILING']));
          return;
        }
      }
      explode(b.x1, b.d1, 46 * u, 0.6, { walkerDmg: 8 });
      return;
    }
    if (b.kind === 'shield') {
      fx('spark', b.x1, b.d1, b.a1, { dur: 0.35, r: 6 * u, color: '#a8d8ff' });
      if (world.shield) world.shield.flick = 1;
      return;
    }
    if (b.aim === 'soldier' && b.hit) {
      const s = byId.get(b.target);
      if (s && alive(s)) kill(s, 'bolt');
      return;
    }
    if (b.aim === 'knight') {
      const kn = world.knights.find((k) => k.id === b.target);
      const sh = byId.get(b.shooter);
      if (kn && sh) {
        kn.parryT = world.t;
        kn.swing = r() < 0.5 ? -1 : 1;
        fx('spark', kn.x + kn.face * 8 * u, kn.d, 24 * u, { dur: 0.25, r: 3 * u, color: kn.blade });
        const back = r() < 0.07 && alive(sh);
        bolt('ga', 'rifle', kn.x + kn.face * 10 * u, kn.d, 24 * u, back ? sh.x : sh.x + (r() - 0.5) * 200 * u, sh.d + (back ? 0 : (r() - 0.5) * 0.05), back ? 16 * u : (30 + r() * 80) * u, back ? 'soldier' : 'none', sh.id, back, -1);
      }
      return;
    }
    if (b.aim === 'roller') {
      const ro = world.rollers.find((q) => q.id === b.target);
      if (ro) ro.shield = Math.min(1.4, ro.shield + 0.15);
      fx('spark', b.x1, b.d1, b.a1, { dur: 0.3, r: 4 * u, color: '#9ad0ff' });
      return;
    }
    if (b.aim === 'walker' || b.aim === 'craft') {
      if (r() < 0.3) fx('spark', b.x1, b.d1, b.a1, { vx: (r() - 0.5) * 60 * u, valt: (r() - 0.5) * 60 * u, dur: 0.3, r: 2 * u, color: '#ffd8a0' });
      if (b.aim === 'walker') {
        const w = world.walkers.find((q) => q.id === b.target);
        if (w) w.hp -= 0.4;
      }
      return;
    }
    if (b.a1 <= 1 && r() < 0.5) fx('dust', b.x1, b.d1, 0, { valt: 14 * u, dur: 0.8, r: 5 * u });
  }

  // ---- walkers ------------------------------------------------------------------------------------------
  function spawnWalker(side: Side, x: number, d: number, extra: Partial<Walker> = {}): Walker {
    const w: Walker = {
      id: ids++, side, kind: side === 'ga' ? 'hexa' : 'spider', name: side === 'ga' ? pick(HEXA_NAMES) : pick(SPIDER_NAMES), x, d,
      hx: (side === 'ga' ? 230 : 200) * u + r() * 160 * u, state: 'walk', t0: world.t, hp: side === 'ga' ? 120 : 130, cool: 3 + r() * 4, ph: r() * 6, seed: Math.floor(r() * 1e6), face: fwd(side),
      aimX: 0, aimD: 0, fireT: -9, line: '', lineT: -99, alt: 0, ...extra,
    };
    world.walkers.push(w);
    return w;
  }
  const walkerD = () => 0.2 + r() * 0.26;
  function walkers(dt: number) {
    for (const w of world.walkers) {
      const age = world.t - w.t0;
      if (w.state === 'enter') continue;
      if (w.state === 'fall') {
        if (r() < dt * 20) fx('smoke', w.x + (r() - 0.5) * 60 * u, w.d, (30 + r() * 30) * u, { vx: world.wind * 0.5, valt: 20 * u, dur: 4, r: 14 * u, color: '#262220' });
        if (age > 3.6 && w.hp > -9999) {
          w.hp = -9999;
          explode(w.x, w.d, 90 * u, 0.7, { big: true, walkerDmg: 0 });
          world.wrecks.push({ id: ids++, kind: w.kind, x: w.x, d: w.d, t0: world.t, seed: w.seed, face: w.face, smoke: 1 });
          emit('walkerwreck', w.x, w.d, 0.5);
        }
        continue;
      }
      // Advance with the front; keep a little behind the line.
      const tx = lineX(w.side, w.hx);
      const dx = tx - w.x;
      const sp = (w.kind === 'hexa' ? 11 : 14) * u;
      if (Math.abs(dx) > 6 * u) {
        w.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
        w.ph += dt * (w.kind === 'hexa' ? 1.3 : 1.7);
      }
      w.face = fwd(w.side);
      if (w.hp < 40 && r() < dt * (4 - w.hp / 15)) fx('smoke', w.x + (r() - 0.5) * 40 * u, w.d, (60 + r() * 20) * u, { vx: world.wind * 0.5, valt: (18 + r() * 10) * u, dur: 5, r: (10 + r() * 6) * u, color: '#2a2624' });
      if (w.hp < 25 && r() < dt * 3) fx('fire', w.x + (r() - 0.5) * 30 * u, w.d, (50 + r() * 20) * u, { valt: 20 * u, dur: 0.6, r: 8 * u });
      // The main gun.
      w.cool -= dt;
      if (w.cool <= 0 && Math.abs(dx) < 300 * u) {
        w.cool = 6 + r() * 4;
        const foe = world.walkers.find((q) => q.side !== w.side && q.state === 'walk' && distOf(q, w) < 1800 * u);
        const ro = w.side === 'ga' ? world.rollers.find((q) => q.state === 'shield') : undefined;
        const list = w.side === 'ga' ? cfAlive : gaAlive;
        const turret: [number, number] = w.kind === 'hexa' ? [w.x - w.face * 10 * u, 92 * u] : [w.x + w.face * 44 * u, 50 * u];
        w.fireT = world.t;
        if (ro && r() < 0.6) {
          w.aimX = ro.x;
          w.aimD = ro.d;
          bolt(w.side, 'cannon', turret[0], w.d, turret[1], ro.x, ro.d, 12 * u, 'roller', ro.id, true, -1, 1100 * u);
        } else if (foe && r() < 0.4) {
          w.aimX = foe.x;
          w.aimD = foe.d;
          bolt(w.side, 'cannon', turret[0], w.d, turret[1], foe.x, foe.d, 50 * u, 'walker', foe.id, r() < 0.55, -1, 1100 * u);
        } else if (list.length) {
          const t = list[Math.floor(r() * list.length)];
          w.aimX = t.x;
          w.aimD = t.d;
          bolt(w.side, 'cannon', turret[0], w.d, turret[1], t.x + (r() - 0.5) * 40 * u, t.d, 0, 'none', -1, false, -1, 1100 * u);
        }
        fx('smoke', turret[0] + w.face * 30 * u, w.d, turret[1], { vx: w.face * 20 * u + world.wind * 0.4, valt: 10 * u, dur: 2.5, r: 10 * u, color: '#6a645c' });
        if (r() < 0.25 && world.t - w.lineT > 10) speak(w, pick(w.side === 'ga' ? LINES.walker : LINES.spider));
      }
      if (w.hp <= 0 && (world.director.want('walkerdown', 0.7, 170) || w.hp < -140)) {
        w.state = 'fall';
        w.t0 = world.t;
        world.downed.walkers++;
        const what = w.kind === 'hexa' ? `${w.name} IS DOWN` : `${w.name} COLLAPSES`;
        say(what, w.x, w.d, 140 * u, w.side === 'ga' ? '#ffb4a0' : '#bfe0ff');
        emit('walkerdown', w.x, w.d, 0.9);
        look('walkerdown', w.x, w.d, 1.9, 10, 8);
        chronicle(w.kind === 'hexa' ? `The walker ${titled(w.name)} went down on its knees and burned.` : `The spider walker ${titled(w.name)} folded up and fell, smoking.`);
        speak(w, w.side === 'ga' ? 'WE\'RE GOING OVER! GET OUT!' : 'SYSTEMS FAILING. ROGER, ROG—', true);
        replaceWalker(w.side);
      }
    }
    world.walkers = world.walkers.filter((w) => !(w.state === 'fall' && w.hp <= -9999));
  }
  function replaceWalker(side: Side) {
    after(35 + r() * 40, () => {
      if (world.walkers.filter((q) => q.side === side).length >= walkerQuota(side)) return;
      if (side === 'ga') launchCraft('ga', 'carrier', 0);
      else {
        const d = walkerD();
        const w = spawnWalker('cf', rearX('cf', d, 160 * u), d);
        speak(w, 'SPIDER WALKER ONLINE. ADVANCING. ROGER, ROGER');
        emit('spider', w.x, w.d, 0.4);
      }
    });
  }
  const walkerQuota = (s: Side) => (phone ? 1 : s === 'ga' ? 2 : 1 + (world.castIds.includes('spiders') ? 1 : 0));

  // ---- gunships, carriers and landers --------------------------------------------------------------------
  function launchCraft(side: Side, kind: CraftKind, cargo: number): Craft {
    const d = kind === 'lander' ? 0.28 + r() * 0.26 : 0.1 + r() * 0.32;
    const dropX = kind === 'lander' ? lineX(side, Math.min(maxHx(side, d) * 0.8, (360 + r() * 200) * u)) : lineX(side, Math.min(maxHx(side, d) * 0.7, (120 + r() * 260) * u));
    const c: Craft = {
      id: ids++, side, kind, name: kind === 'lander' ? pick(LANDER_NAMES) : pick(GUNSHIP_NAMES), x: rearX(side, d, 260 * u), d,
      alt: (kind === 'lander' ? 340 : 230) * u, face: fwd(side), tx: dropX, td: d, talt: (kind === 'lander' ? 300 : 210) * u, state: 'inbound', t0: world.t,
      seed: Math.floor(r() * 1e6), cargo, walker: -1, hp: 100, cool: 0, fireT: -9, bank: 0, doors: 0, line: '', lineT: -99, spin: 0,
    };
    if (kind === 'carrier') {
      const w = spawnWalker('ga', c.x, d, { state: 'enter', alt: c.alt - 70 * u });
      c.walker = w.id;
      c.name = `CARRIER ${pick(['ONE', 'TWO', 'NINE', 'SIX'])}`;
    }
    world.crafts.push(c);
    return c;
  }
  const toward = (o: { x: number; d: number; alt: number }, tx: number, td: number, talt: number, speed: number, dt: number) => {
    const dx = tx - o.x;
    const dd = (td - o.d) * DEPTH;
    const da = talt - o.alt;
    const dist = Math.hypot(dx, dd, da);
    if (dist < 1e-3) return 0;
    const st = Math.min(dist, speed * dt);
    o.x += (dx / dist) * st;
    o.d += ((dd / dist) * st) / DEPTH;
    o.alt += (da / dist) * st;
    return dist - st;
  };
  function crafts(dt: number) {
    for (const c of world.crafts) {
      const age = world.t - c.t0;
      const f = fwd(c.side);
      const speed = (c.kind === 'lander' ? 120 : 190) * u;
      const lowAlt = c.kind === 'lander' ? 0 : c.kind === 'carrier' ? 80 * u : 26 * u;
      c.bank += ((c.state === 'strafe' ? 0.08 : c.state === 'away' || c.state === 'inbound' ? 0.04 : 0) - c.bank) * dt;
      if (c.state === 'inbound') {
        c.face = Math.sign(c.tx - c.x) as 1 | -1 || f;
        if (toward(c, c.tx, c.td, c.talt, speed, dt) < 4 * u) {
          c.state = c.kind === 'gunship' && c.cargo <= 0 ? 'climb' : 'descend';
          c.t0 = world.t;
          if (c.kind === 'gunship' && c.cargo > 0) speak(c, pick(LINES.gunshipIn));
          if (c.kind === 'lander') speak(c, 'LANDING. ROGER, ROGER');
        }
      } else if (c.state === 'descend') {
        c.alt = Math.max(lowAlt, c.alt - dt * (c.kind === 'lander' ? 45 : 60) * u);
        if (r() < dt * 12 && c.alt < 120 * u) fx('dust', c.x + (r() - 0.5) * 120 * u, c.d, 0, { vx: (r() - 0.5) * 80 * u, valt: 10 * u, dur: 2, r: 16 * u });
        if (c.alt <= lowAlt + 0.5) {
          c.state = c.cargo > 0 || c.kind !== 'gunship' ? 'drop' : 'climb';
          c.t0 = world.t;
          if (c.kind === 'gunship' && c.cargo > 0) {
            speak(c, pick(LINES.gunshipDrop));
            const sq = newSquad('ga', c.cargo);
            c.walker = sq.id;
            emit('drop', c.x, c.d, 0.4);
            look('drop', c.x, c.d, 2, 6, 4);
          } else if (c.kind === 'lander') {
            const sq = newSquad('cf', c.cargo);
            c.walker = sq.id;
            emit('lander', c.x, c.d, 0.45);
            speak(c, pick(LINES.lander));
          } else if (c.kind === 'carrier') {
            const w = world.walkers.find((q) => q.id === c.walker);
            if (w) {
              w.state = 'walk';
              w.alt = 0;
              w.x = c.x;
              w.d = c.d;
              w.t0 = world.t;
              speak(c, `${w.name} IS ON THE GROUND. GOOD LUCK DOWN THERE`);
              emit('walkerin', c.x, c.d, 0.5);
              look('walkerin', c.x, c.d, 1.8, 8, 5);
            }
            c.walker = -1;
          }
        }
      } else if (c.state === 'drop') {
        c.doors = Math.min(1, c.doors + dt * 2);
        if (c.kind === 'carrier') {
          if (age > 2.5) c.state = 'climb';
        } else if (c.cargo > 0 && age > 0.8) {
          c.cool -= dt;
          if (c.cool <= 0) {
            c.cool = c.kind === 'lander' ? 0.32 : 0.42;
            const sq = world.squads.find((q) => q.id === c.walker);
            const sl = slots(c.side, 1, Math.max(0.03, Math.min(0.62, c.d + (r() - 0.5) * 0.08)))[0];
            const i = (sq?.size ?? 6) - c.cargo;
            if (c.kind === 'gunship') spawnSoldier('ga', kindFor('ga', i), c.x + (r() - 0.5) * 30 * u + c.face * 10 * u, c.d + (r() < 0.5 ? -0.012 : 0.012), Math.min(sl.hx, maxHx('ga', sl.hd) * 0.6), sl.hd, 'drop', sq?.id ?? -1, c.alt + 8 * u);
            else spawnSoldier('cf', kindFor('cf', i), c.x + c.face * 30 * u, c.d - 0.004, Math.min(sl.hx, maxHx('cf', sl.hd) * 0.7), sl.hd, 'march', sq?.id ?? -1);
            c.cargo--;
          }
        } else if (age > (c.kind === 'lander' ? 3.5 : 1.6)) {
          c.state = 'climb';
          c.t0 = world.t;
        }
      } else if (c.state === 'climb') {
        c.doors = Math.max(0, c.doors - dt * 0.8);
        c.alt = Math.min((c.kind === 'lander' ? 300 : 150) * u, c.alt + dt * (c.kind === 'lander' ? 40 : 70) * u);
        if (c.alt >= (c.kind === 'lander' ? 300 : 150) * u - 1) {
          c.t0 = world.t;
          if (c.kind === 'gunship') {
            c.state = 'strafe';
            c.tx = world.front + f * (world.gap / 2 + 380 * u);
            c.face = f;
            speak(c, pick(LINES.gunshipStrafe));
          } else {
            c.state = 'away';
            c.tx = rearX(c.side, c.d, 300 * u);
            c.face = -f as 1 | -1;
          }
        }
      } else if (c.state === 'strafe') {
        c.face = f;
        const left = toward(c, c.tx, c.td, 140 * u, 150 * u, dt);
        c.cool -= dt;
        if (c.cool <= 0) {
          c.cool = 0.22 + r() * 0.2;
          const targets = cfAlive.filter((q) => Math.abs(q.x - c.x) < 520 * u && q.alt === 0);
          const tg = targets[Math.floor(r() * targets.length)];
          if (tg) {
            const wing = r() < 0.5 ? -1 : 1;
            bolt('ga', 'turret', c.x + c.face * 14 * u, c.d + wing * 0.008, c.alt + 10 * u, tg.x, tg.d, 14 * u, 'soldier', tg.id, r() < 0.2, -1, 1600 * u);
            c.fireT = world.t;
          }
          if (r() < 0.1) {
            const sp = world.walkers.find((q) => q.side === 'cf' && q.state === 'walk' && Math.abs(q.x - c.x) < 700 * u);
            if (sp) bolt('ga', 'cannon', c.x, c.d, c.alt, sp.x, sp.d, 40 * u, 'walker', sp.id, r() < 0.5, -1, 900 * u);
          }
        }
        if (age > 2.5 && r() < dt * 0.12 && world.director.want('gunshipdown', 0.75, 140)) {
          c.state = 'falling';
          c.t0 = world.t;
          world.downed.gunships++;
          speak(c, pick(LINES.gunshipDown), true);
          say(`${c.name} IS GOING DOWN`, c.x, c.d, c.alt + 40 * u, '#ffb4a0');
          emit('gunshiphit', c.x, c.d, 0.8);
          look('gunshipdown', c.x, c.d, 1.8, 9, 8);
          for (let k = 0; k < 6; k++) fx('fire', c.x, c.d, c.alt, { vx: (r() - 0.5) * 60 * u, valt: (r() - 0.5) * 40 * u, dur: 0.6, r: 10 * u });
        } else if (left < 6 * u) {
          c.state = 'away';
          c.t0 = world.t;
          c.tx = rearX(c.side, c.d, 300 * u);
          c.face = -f as 1 | -1;
        }
      } else if (c.state === 'away') {
        c.face = Math.sign(c.tx - c.x) as 1 | -1 || c.face;
        if (toward(c, c.tx, c.td, (c.kind === 'lander' ? 360 : 240) * u, speed, dt) < 6 * u) c.state = 'off';
      } else if (c.state === 'falling') {
        c.spin += dt * (1.5 + age);
        c.x += c.face * dt * 90 * u;
        c.alt = Math.max(0, c.alt - dt * (30 + age * 45) * u);
        if (r() < dt * 30) fx('smoke', c.x, c.d, c.alt, { vx: world.wind * 0.4 - c.face * 20 * u, valt: 10 * u, dur: 4 + r() * 2, r: (10 + r() * 8) * u, color: '#1e1a18' });
        if (r() < dt * 14) fx('fire', c.x, c.d, c.alt, { vx: (r() - 0.5) * 20 * u, valt: (r() - 0.5) * 20 * u, dur: 0.5, r: 9 * u });
        if (c.alt <= 0) {
          c.state = 'off';
          explode(c.x, c.d, 80 * u, 0.7, { big: true });
          world.wrecks.push({ id: ids++, kind: 'gunship', x: c.x, d: c.d, t0: world.t, seed: c.seed, face: c.face, smoke: 1 });
          emit('gunshipdown', c.x, c.d, 0.9);
          chronicle(`The gunship ${titled(c.name)} was shot down over the droid line and burned where she fell.`);
        }
      }
      // A slung walker rides under its carrier.
      if (c.kind === 'carrier' && c.walker >= 0) {
        const w = world.walkers.find((q) => q.id === c.walker);
        if (w) {
          w.x = c.x;
          w.d = c.d;
          w.alt = c.alt - 80 * u;
          w.face = c.face;
        }
      }
    }
    world.crafts = world.crafts.filter((c) => c.state !== 'off');
  }

  // ---- the reinforcements ---------------------------------------------------------------------------------
  let nextGunship = 6;
  let nextStrafe = 40 + r() * 20;
  let nextLander = 14 + r() * 10;
  const lastMarch = { ga: 0, cf: 0 };
  function reinforce() {
    const busy = (k: CraftKind) => world.crafts.some((c) => c.kind === k && c.cargo > 0);
    const gaShort = N - gaAlive.length - world.soldiers.filter((s) => s.side === 'ga' && s.state === 'drop').length;
    const cfShort = NC - cfAlive.length;
    if (world.t > nextGunship && !busy('gunship') && gaShort >= (phone ? 3 : 5)) {
      nextGunship = world.t + 16 + r() * 10;
      const c = launchCraft('ga', 'gunship', Math.min(gaShort, phone ? 5 : 6 + Math.floor(r() * 3)));
      if (r() < 0.5) after(2, () => speak(c, 'INBOUND WITH REINFORCEMENTS'));
    } else if (world.t > nextStrafe && !world.crafts.some((c) => c.kind === 'gunship')) {
      nextStrafe = world.t + 45 + r() * 35;
      const c = launchCraft('ga', 'gunship', 0);
      c.state = 'inbound';
      c.talt = 150 * u;
      speak(c, 'AIR SUPPORT INBOUND. KEEP YOUR HEADS DOWN');
      emit('airsupport', c.tx, c.d, 0.3);
    }
    if (world.t > nextLander && !busy('lander') && cfShort >= (phone ? 4 : 6)) {
      nextLander = world.t + 16 + r() * 10;
      launchCraft('cf', 'lander', Math.min(cfShort + 2, phone ? 7 : 12 + Math.floor(r() * 4)));
    }
    // When nothing can fly in, a line walks in from the edge.
    for (const side of ['ga', 'cf'] as Side[]) {
      const short = side === 'ga' ? gaShort : cfShort;
      if (short < (phone ? 4 : 8) || world.t - lastMarch[side] < 28) continue;
      lastMarch[side] = world.t;
      const n = Math.min(short - 2, side === 'ga' ? 5 : 8);
      const sq = newSquad(side, n);
      const sl = slots(side, n);
      sl.forEach((q, i) => spawnSoldier(side, kindFor(side, i), rearX(side, q.hd, (40 + i * 20) * u), q.hd, q.hx, q.hd, 'march', sq.id));
      if (r() < 0.6) speak(sq, side === 'ga' ? 'REINFORCEMENTS, COMING UP ON THE LEFT' : 'REINFORCEMENTS. ROGER, ROGER');
      emit('march', rearX(side, sl[0].hd, -100 * u), sl[0].hd, 0.15);
    }
  }

  let nextSweep = 5;
  /** How hot the fighting runs in each part of an engagement (a multiplier on the time between shots). */
  const PACE: Record<string, number> = { buildup: 1.45, clash: 1, climax: 0.8, aftermath: 2.6 };
  // ---- the infantry -------------------------------------------------------------------------------------
  function infantry(dt: number) {
    gaAlive.length = 0;
    cfAlive.length = 0;
    for (const s of world.soldiers) if (alive(s) && s.state !== 'sneak') (s.side === 'ga' ? gaAlive : cfAlive).push(s);
    for (const s of world.soldiers) {
      const age = world.t - s.t0;
      if (s.state === 'dead') continue;
      if (s.state === 'fall') {
        if (age > 0.8) {
          s.state = 'dead';
          s.t0 = world.t;
        }
        continue;
      }
      if (s.state === 'sneak') continue;
      if (s.state === 'drop') {
        s.alt = Math.max(0, s.alt - dt * (40 + age * 260) * u);
        if (s.alt <= 0) {
          s.state = 'march';
          s.t0 = world.t;
          fx('dust', s.x, s.d, 0, { valt: 8 * u, dur: 1, r: 6 * u });
        }
        continue;
      }
      const f = fwd(s.side);
      const droid = s.side === 'cf';
      let tx = lineX(s.side, s.hx);
      let speed = (droid ? 24 : 34) * u;
      if (s.state === 'charge') {
        tx = world.front + f * (world.gap * 0.15 + s.hx * 0.25);
        speed = 78 * u;
      } else if (s.state === 'retreat') {
        tx = lineX(s.side, s.hx + 320 * u);
        speed = (droid ? 50 : 70) * u;
      }
      const dx = tx - s.x;
      if (Math.abs(dx) > 4 * u) {
        const st = Math.min(Math.abs(dx), speed * dt);
        s.x += Math.sign(dx) * st;
        s.ph += (st / (9 * u)) * (droid ? 1 : 1.1);
        if (s.state === 'line' && Math.abs(dx) > 50 * u) s.state = 'march';
      } else if (s.state === 'march') s.state = 'line';
      s.d += (s.hd - s.d) * Math.min(1, dt * 0.4);
      s.face = s.state === 'retreat' ? (-f as 1 | -1) : f;
      // Troopers take a knee and get up; droids stand in the open.
      const crouchTo = s.state === 'line' && !droid && Math.abs(dx) < 20 * u ? (Math.sin(world.t * 0.07 + s.seed) > -0.1 ? 1 : 0) : 0;
      s.crouch += (crouchTo - s.crouch) * Math.min(1, dt * 4);
      s.cool -= dt;
      if (s.cool <= 0 && s.state !== 'retreat') {
        s.cool = ((droid ? 1.3 : 1.5) + r() * (droid ? 2.2 : 2.6) - (s.kind === 'heavy' || s.kind === 'super' ? 0.6 : 0)) * PACE[world.act.phase];
        fire(s);
        // Heavies and supers fire in bursts.
        if ((s.kind === 'heavy' || s.kind === 'super') && r() < 0.7) after(0.12, () => alive(s) && fire(s));
      }
    }
    // The dead lie a while; the oldest go first when there are too many.
    const dead = world.soldiers.filter((s) => s.state === 'dead');
    const cap = phone ? 30 : 70;
    if (dead.length > cap) {
      dead.sort((a, b) => a.t0 - b.t0);
      const gone = new Set(dead.slice(0, dead.length - cap).map((s) => s.id));
      for (const id of gone) byId.delete(id);
      world.soldiers = world.soldiers.filter((s) => !gone.has(s.id));
    }
    world.soldiers = world.soldiers.filter((s) => {
      const keep = !(s.state === 'dead' && world.t - s.t0 > 90) && !(s.state === 'march' && (xOf(s.x, s.d) < -400 * u || xOf(s.x, s.d) > GW + 400 * u) && Math.abs(s.x - lineX(s.side, s.hx)) < 10 * u);
      if (!keep) byId.delete(s.id);
      return keep;
    });
    // Squads with nobody left are struck off.
    if (world.t > nextSweep) {
      nextSweep = world.t + 5;
      const live = new Set(world.soldiers.filter(alive).map((s) => s.squad));
      world.squads = world.squads.filter((q) => live.has(q.id) || world.t - q.lineT < 4 || world.crafts.some((c) => c.walker === q.id));
    }
  }

  // ---- bolts and shells ----------------------------------------------------------------------------------
  function shots(dt: number) {
    for (let i = world.bolts.length - 1; i >= 0; i--) {
      const b = world.bolts[i];
      if (world.t - b.t0 >= b.dur) {
        world.bolts.splice(i, 1);
        resolve(b);
      }
    }
    for (let i = world.shells.length - 1; i >= 0; i--) {
      const s = world.shells[i];
      if (world.t - s.t0 < s.dur) {
        const k = (world.t - s.t0) / s.dur;
        if (r() < dt * 8) fx('smoke', s.x0 + (s.x1 - s.x0) * k, s.d0 + (s.d1 - s.d0) * k, 4 * s.apex * k * (1 - k), { dur: 1.4, r: 4 * u, valt: 2 * u, color: '#6a6460' });
        continue;
      }
      world.shells.splice(i, 1);
      const sh = world.shield;
      if (s.side === 'ga' && sh && sh.up > 0.6 && Math.abs(s.x1 - sh.x) < sh.r && Math.abs(s.d1 - sh.d) < 0.18) {
        fx('flash', s.x1, s.d1, sh.r * 0.55, { dur: 0.4, r: 70 * u, color: '#a8d8ff' });
        for (let k = 0; k < 6; k++) fx('spark', s.x1, s.d1, sh.r * 0.55, { vx: (r() - 0.5) * 200 * u, valt: (r() - 0.2) * 120 * u, dur: 0.6, r: 2 * u, color: '#c8e8ff' });
        sh.flick = 1;
        emit('shieldhit', s.x1, s.d1, 0.1);
        continue;
      }
      explode(s.x1, s.d1, (52 + s.big * 30) * u, 0.55);
      emit('shell', s.x1, s.d1, 0.12 + s.big * 0.1);
    }
  }
  function shell(side: Side, x1: number, d1: number, big = 0) {
    const d0 = Math.max(0.05, Math.min(0.7, d1 + (r() - 0.5) * 0.2));
    world.shells.push({ x0: rearX(side, d0, 500 * u), d0, x1, d1, t0: world.t, dur: 2.4 + r() * 1.3, apex: (320 + r() * 280) * u, side, big });
  }
  let nextArty = { ga: 3 + r() * 4, cf: 5 + r() * 4 };
  function artillery() {
    for (const side of ['ga', 'cf'] as Side[]) {
      if (world.t < nextArty[side]) continue;
      nextArty[side] = world.t + ((6 + r() * 8) / traffic) * PACE[world.act.phase] * (world.act.phase === 'aftermath' ? 2 : 1);
      const foes = side === 'ga' ? cfAlive : gaAlive;
      const t = foes[Math.floor(r() * foes.length)];
      if (!t) continue;
      const n = r() < 0.3 ? 3 : r() < 0.5 ? 2 : 1;
      for (let k = 0; k < n; k++) after(k * 0.5, () => shell(side, t.x + (r() - 0.5) * 120 * u, Math.max(0.03, Math.min(0.66, t.d + (r() - 0.5) * 0.06))));
      if (n === 3 && world.director.want('artyline', 0.1, 50)) {
        const sq = world.squads.find((q) => q.side === other(side) && world.t - q.lineT > 8);
        if (sq) after(1, () => speak(sq, side === 'cf' ? 'INCOMING! GET DOWN!' : 'INCOMING. UH OH.'));
      }
    }
  }

  // ---- the sky ------------------------------------------------------------------------------------------
  const skyTop = GH * 0.05;
  const skyBottom = HY - 70 * u;
  function spawnDogfight(): Dogfight {
    const cx = GW * (0.15 + r() * 0.7);
    const df: Dogfight = {
      id: ids++, cx, cy: skyTop + (skyBottom - skyTop) * (0.2 + r() * 0.6), ax: (140 + r() * 240) * u * (phone ? 0.6 : 1), ay: (30 + r() * 70) * u, w: 0.3 + r() * 0.35, ph: r() * 6, lag: 0.35 + r() * 0.35,
      s: 0.55 + r() * 0.5, chased: r() < 0.5 ? 'ga' : 'cf', t0: world.t, life: 14 + r() * 26, state: 'fight', downT: 0, winner: null, seed: Math.floor(r() * 1e6), cool: 1,
    };
    df.cy = Math.max(skyTop + df.ay, Math.min(skyBottom - df.ay, df.cy));
    world.dogfights.push(df);
    return df;
  }
  let nextDogfight = 0;
  const pilot = { name: 'ARROW LEAD', side: 'ga' as Side, line: '', lineT: -99 };
  let nextFlyby = 8 + r() * 8;
  function sky(dt: number) {
    const want = (phone ? 2 : 3) + (traffic > 1.4 ? 1 : 0);
    if (world.dogfights.filter((q) => q.state === 'fight').length < want && world.t > nextDogfight) {
      nextDogfight = world.t + 3 + r() * 6;
      spawnDogfight();
    }
    for (const df of world.dogfights) {
      if (df.state === 'fight') {
        df.cool -= dt;
        if (df.cool <= 0) {
          df.cool = r() < 0.7 ? 0.12 : 0.6 + r() * 1.2;
          const a = dogfightAt(df, world.t, true);
          const b = dogfightAt(df, world.t + 0.12, false);
          const color = df.chased === 'ga' ? '#ff5040' : '#60c8ff';
          const miss = (r() - 0.5) * 40 * u;
          world.skybolts.push({ x0: a.x + Math.cos(a.ang) * 10 * u * df.s, y0: a.y + Math.sin(a.ang) * 10 * u * df.s, x1: b.x + miss, y1: b.y + miss * 0.5, t0: world.t, dur: 0.12, color, w: df.s });
        }
        if (world.t - df.t0 > df.life) {
          df.state = 'over';
          df.downT = world.t;
          const chasedLoses = r() < 0.72;
          const loser: Side = chasedLoses ? df.chased : other(df.chased);
          df.winner = other(loser);
          const p = dogfightAt(df, world.t, !chasedLoses);
          world.skyfalls.push({ x: p.x, y: p.y, vx: Math.cos(p.ang) * 120 * u * df.s, vy: Math.sin(p.ang) * 60 * u - 10 * u, t0: world.t, side: loser, s: df.s, seed: df.seed });
          world.downed.fighters++;
          emitAt('fighterdown', p.x, p.y, 0.25);
          if (world.director.want('fighterline', 0.15, 20)) speak(pilot, loser === 'ga' ? pick(['ARROW THREE IS DOWN!', 'I\'M HIT, I\'M HIT—', 'LOST HIM. HE\'S GONE IN']) : pick(['SPLASH ONE VULTURE', 'GOT HIM! GOT HIM!', 'ONE LESS DROID UP HERE']));
        }
      }
    }
    world.dogfights = world.dogfights.filter((q) => !(q.state === 'over' && world.t - q.downT > 5));
    for (const sf of world.skyfalls) {
      sf.x += sf.vx * dt;
      sf.y += sf.vy * dt;
      sf.vy += 50 * u * dt;
      sf.vx *= 1 - dt * 0.2;
    }
    world.skyfalls = world.skyfalls.filter((sf) => sf.y < HY + 10 * u && world.t - sf.t0 < 14);
    // Flights crossing.
    if (world.t > nextFlyby) {
      nextFlyby = world.t + (14 + r() * 18) / Math.sqrt(traffic);
      const side: Side = r() < 0.5 ? 'ga' : 'cf';
      const dir = r() < 0.5 ? 1 : -1;
      const s = 0.4 + r() * 0.6;
      world.flybys.push({ id: ids++, side, kind: 'fighter', x: dir > 0 ? -200 * u : GW + 200 * u, y: skyTop + r() * (skyBottom - skyTop), vx: dir * (180 + r() * 120) * u * (0.6 + s * 0.6), vy: (r() - 0.5) * 14 * u, s, n: 2 + Math.floor(r() * 3), t0: world.t, seed: Math.floor(r() * 1e6) });
    }
    for (const f of world.flybys) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
    world.flybys = world.flybys.filter((f) => f.x > -600 * u && f.x < GW + 600 * u);
    world.skybolts = world.skybolts.filter((b) => world.t - b.t0 < b.dur);
    // The capital ships hang, drift, and come down when they come down.
    for (const c of world.capitals) {
      if (c.falling > 0) {
        // Burning, nose down, sliding toward the horizon; then a flash beyond it, and a hulk that smokes there for good.
        c.falling = Math.min(1, c.falling + dt / 40);
        c.y += dt * (6 + c.falling * 40) * u;
        c.x += c.face * dt * 12 * u;
        c.hitT = world.t - (r() < dt * 6 ? 0 : 0.5);
        if (c.y > HY + 10 * u || c.falling >= 1) {
          world.hulks.push({ x: c.x, s: c.s, t0: world.t, side: c.side, seed: c.seed, kind: c.kind });
          world.capitals = world.capitals.filter((q) => q !== c);
          emitAt('capitalcrash', c.x, HY, 1);
          sayAt('SHE GOES DOWN BEYOND THE HORIZON', c.x, HY - 40 * u, '#ffe0c0');
          // Another of her side's ships jumps in, in time.
          after(120 + r() * 120, () => {
            const ns: Capital = { ...c, id: ids++, name: c.side === 'ga' ? pick(GA_SHIPS) : pick(CF_SHIPS), falling: 0, descent: 0, fireUntil: 0, x: c.x0, y: c.y0, s: c.s0, hitT: -9, seed: Math.floor(r() * 1e6) };
            world.capitals.push(ns);
            world.capitals.sort((p, q) => p.s - q.s);
            sayAt(`${ns.name} DROPS OUT OF HYPERSPACE`, ns.x, ns.y + 60 * u * ns.s, '#e8f0ff');
            emitAt('jump', ns.x, ns.y, 0.7);
            world.jump = { x: ns.x, y: ns.y, t0: world.t, s: ns.s };
          });
        }
        continue;
      }
      c.x = c.x0 + Math.sin(world.t * 0.004 + c.drift) * 60 * u * c.s0;
      const dk = c.descent;
      c.y = c.y0 + dk * (HY - c.y0) * 0.45;
      c.s = c.s0 * (1 + dk * 0.7);
      if (world.t < c.fireUntil) {
        c.cool -= dt;
        if (c.cool <= 0) {
          c.cool = 0.12 + r() * 0.2;
          broadsideShot(c);
        }
      }
    }
  }
  /** One gun of a broadside: at the enemy's ship if there is one in the sky, or the far ground. */
  function broadsideShot(c: Capital) {
    const len = (c.kind === 'wedge' ? 520 : c.kind === 'frigate' ? 560 : 300) * u * c.s;
    const x0 = c.x + (r() - 0.5) * len * 0.7;
    const y0 = c.y + (r() - 0.3) * len * 0.06;
    const foe = world.capitals.find((q) => q.side !== c.side);
    const color = c.side === 'ga' ? '#70d0ff' : '#ff6a4a';
    if (foe && r() < 0.6) {
      const fl = (foe.kind === 'wedge' ? 520 : foe.kind === 'frigate' ? 560 : 300) * u * foe.s;
      const x1 = foe.x + (r() - 0.5) * fl * 0.6;
      const y1 = foe.y + (r() - 0.5) * fl * 0.05;
      world.skybolts.push({ x0, y0, x1, y1, t0: world.t, dur: 0.5, color, w: 1.6 + c.s * 2 });
      after(0.5, () => {
        foe.hitT = world.t;
      });
    } else {
      const d = 0.78 + r() * 0.17;
      const x1 = rearX(other(c.side), d, -(80 + r() * 600) * u);
      world.skybolts.push({ x0, y0, x1: xOf(x1, d), y1: yOf(d), t0: world.t, dur: 0.6, color, w: 1.6 + c.s * 2 });
      after(0.6, () => {
        fx('flash', x1, d, 6 * u, { dur: 0.5, r: 90 * u });
        fx('blast', x1, d, 2 * u, { dur: 0.9, r: 120 * u });
        fx('smoke', x1, d, 20 * u, { valt: 30 * u, dur: 7, r: 60 * u, color: '#3a3430' });
      });
    }
  }
  function setupCapitals() {
    const n = phone ? 2 : 3 + (r() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const side: Side = i === 0 ? 'ga' : i === 1 ? 'cf' : r() < 0.5 ? 'ga' : 'cf';
      const kind = side === 'ga' ? 'wedge' : r() < 0.7 ? 'frigate' : 'core';
      // Each side's ships hang over its own half of the sky.
      const half = fwd(side) > 0 ? 0 : 0.5;
      const s = (phone ? 0.38 : 0.45) + r() * (phone ? 0.35 : 0.55);
      const x0 = GW * (half + 0.08 + r() * 0.34);
      const y0 = skyTop + (HY - skyTop) * (0.06 + (1 - s) * 0.22 + r() * 0.14);
      world.capitals.push({ id: ids++, side, kind, name: side === 'ga' ? pick(GA_SHIPS) : pick(CF_SHIPS), x: x0, y: y0, s, x0, y0, s0: s, face: fwd(side), seed: Math.floor(r() * 1e6), fireUntil: 0, cool: 0, descent: 0, descentT: -999, hitT: -9, drift: r() * 6, falling: 0 });
    }
    // Far ones first (smaller), so the near overlap them.
    world.capitals.sort((a, b) => a.s - b.s);
  }

  // ---- the tide: the front moves; whoever is pushed back breaks, falls back and regroups ----------------------
  let bias = 0;
  const retreatUntil = { ga: -1, cf: -1 };
  const swell = g.range(0, Math.PI * 2);
  const swellPeriod = g.range(150, 260);
  const frontLo = gx(GW * 0.3, 0.25);
  const frontHi = gx(GW * 0.7, 0.25);
  const sideName = (s: Side) => (s === 'ga' ? 'THE GRAND ARMY' : 'THE DROID ARMY');
  /** A side breaks: everyone in its line runs back, then turns and re-forms. */
  function fallBack(loser: Side, headline = true) {
    retreatUntil[loser] = world.t + 9;
    for (const s of world.soldiers) if (s.side === loser && (s.state === 'line' || s.state === 'march' || s.state === 'charge')) s.state = 'retreat';
    const sq = world.squads.find((q) => q.side === loser);
    if (sq) speak(sq, pick(loser === 'ga' ? LINES.gaRetreat : LINES.cfRetreat), true);
    if (headline) say(loser === 'ga' ? 'THE GRAND ARMY FALLS BACK' : 'THE DROID LINE BREAKS', world.front, 0.3, 80 * u, loser === 'ga' ? '#ffb4a0' : '#bfe0ff');
    emit('retreat', world.front, 0.3, 0.6);
    look('retreat', world.front, 0.3, 1.5, 9, 6);
    chronicle(loser === 'ga' ? `The ${titled(legion.name.replace('THE ', ''))} gave ground and fell back to regroup.` : 'The droid line broke and fell back across the field.');
    world.mood = 'retreat';
    bias += loser === 'ga' ? -0.5 : 0.5;
    after(9, () => {
      for (const s of world.soldiers) if (s.side === loser && s.state === 'retreat') s.state = 'march';
      const q = world.squads.find((x) => x.side === loser);
      if (q) speak(q, loser === 'ga' ? pick(LINES.gaRegroup) : 'REGROUP. ROGER, ROGER', true);
      emit('regroup', world.front, 0.3, 0.4);
      bias += loser === 'ga' ? 0.9 : -0.9;
      world.mood = 'regroup';
    });
  }
  function tide(dt: number) {
    const sGA = gaAlive.length / N;
    const sCF = cfAlive.length / NC;
    const a = world.act;
    const push = (a.phase === 'clash' ? 0.35 : a.phase === 'climax' ? 0.75 : 0) * (a.attacker === 'ga' ? 1 : -1) * (a.phase === 'climax' && a.winner && a.winner !== a.attacker ? -1 : 1);
    const p = (sGA - sCF) * 1.2 + bias + push + 0.3 * Math.sin((world.t / swellPeriod) * Math.PI * 2 + swell) + (retreatUntil.cf > world.t ? 0.7 : 0) - (retreatUntil.ga > world.t ? 0.7 : 0);
    world.tide += (Math.max(-1, Math.min(1, p)) - world.tide) * Math.min(1, dt * 0.5);
    bias *= Math.exp(-dt / 25);
    const calm = a.phase === 'aftermath' ? 0.3 : 1;
    world.front = Math.max(frontLo, Math.min(frontHi, world.front + gaDir * world.tide * 9 * u * dt * calm));
    // Pinned at the edge of the field, a side breaks.
    const atGA = gaDir > 0 ? world.front <= frontLo + 2 : world.front >= frontHi - 2;
    const atCF = gaDir > 0 ? world.front >= frontHi - 2 : world.front <= frontLo + 2;
    const loser: Side | null = atGA ? 'ga' : atCF ? 'cf' : sGA < 0.4 ? 'ga' : sCF < 0.4 ? 'cf' : null;
    if (loser && a.phase !== 'aftermath' && retreatUntil[loser] < world.t - 60 && world.director.want(`retreat-${loser}`, 0.55, 110)) fallBack(loser);
    if (world.mood !== 'charge' && world.mood !== 'shield' && world.mood !== 'barrage' && retreatUntil.ga < world.t && retreatUntil.cf < world.t - 8) world.mood = Math.abs(world.tide) > 0.35 ? 'push' : 'stalemate';
  }

  // ---- the story: the battle in acts ----------------------------------------------------------------------
  /**
   * Each engagement: a build-up (the attacker brings in men and machines, the guns range in), the clash
   * (the lines fight it out, the attacker leaning on the defence), a climax drawn from what this seed's
   * battle has (a knight's charge, the shield's fall, a cruiser's descent, a bomber run, a wave of
   * gunships, an armoured push, a roller assault; rarely a duel, or a capital ship brought down), and
   * an aftermath (the guns slacken, the loser falls back, the winner plants its standard, the smoke drifts).
   */
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const roman = (n: number) => ROMAN[(n - 1) % ROMAN.length] + (n > ROMAN.length ? '+' : '');
  let lastClimax = '';
  function climaxFor(attacker: Side): string {
    const has = (id: string) => world.castIds.includes(id);
    const opts: [string, number][] = attacker === 'ga'
      ? [['armour', 3], ['airassault', 3], ['charge', has('knights') ? 5 : 0], ['shield', has('shield') && world.shield?.state === 'up' ? 6 : 0], ['descent', has('descent') ? 4 : 0], ['bombers', has('bombers') ? 3 : 0], ['duel', has('duelist') && world.act.n >= 2 ? 3 : 0]]
      : [['armour', 3], ['droidwave', 4], ['rollers', has('rollers') ? 5 : 0], ['bombers', has('bombers') ? 2 : 0], ['duel', has('duelist') && world.act.n >= 2 ? 2 : 0]];
    // The rarest: a capital ship brought down, in long battles that have the broadsides.
    if (has('broadside') && world.act.n >= 3 && !world.hulks.length && world.capitals.some((c) => c.side !== attacker)) opts.push(['capitalfall', 2.5]);
    const pool = opts.filter(([id, w]) => w > 0 && id !== lastClimax);
    const total = pool.reduce((t, [, w]) => t + w, 0);
    let x = r() * total;
    for (const [id, w] of pool) if ((x -= w) <= 0) return id;
    return 'armour';
  }
  function nextAct() {
    const a = world.act;
    const n = a.n + 1;
    // The attacker: whoever lost the last engagement wants the ground back, mostly.
    const attacker: Side = a.winner ? (r() < 0.65 ? other(a.winner) : a.winner) : r() < 0.5 ? 'ga' : 'cf';
    const cx = climaxFor(attacker);
    lastClimax = cx;
    world.act = { n, phase: 'buildup', t0: world.t, until: world.t + (n === 1 ? 25 : 35) + r() * 25, attacker, climax: cx, fired: false, winner: null, title: `ENGAGEMENT ${roman(n)}` };
    if (n > 1) sayAt(attacker === 'ga' ? 'THE GRAND ARMY MASSES TO ATTACK' : 'THE DROIDS MASS FOR AN ASSAULT', GW / 2, HY - 30 * u, attacker === 'ga' ? '#d8ecff' : '#ffd0b8');
    emitAt('act', GW / 2, HY, 0.3);
    // The attacker brings in more: a drop, a landing.
    if (attacker === 'ga') launchCraft('ga', 'gunship', phone ? 4 : 6);
    else launchCraft('cf', 'lander', phone ? 6 : 10);
  }
  function story() {
    const a = world.act;
    if (a.n === 0) return nextAct();
    if (world.t < a.until) {
      if (a.phase === 'climax' && !a.fired && world.t - a.t0 > 1) storyClimax(a.climax);
      return;
    }
    if (a.phase === 'buildup') {
      a.phase = 'clash';
      a.t0 = world.t;
      a.until = world.t + 55 + r() * 45;
      const sq = world.squads.find((q) => q.side === a.attacker);
      if (sq) speak(sq, a.attacker === 'ga' ? pick(LINES.gaPush) : pick(LINES.cfPush), true);
      emit('clash', world.front, 0.3, 0.4);
    } else if (a.phase === 'clash') {
      a.phase = 'climax';
      a.t0 = world.t;
      a.until = world.t + 32 + r() * 14;
      // Does it come off? Mostly, for the attacker.
      a.winner = r() < 0.68 ? a.attacker : other(a.attacker);
    } else if (a.phase === 'climax') {
      a.phase = 'aftermath';
      a.t0 = world.t;
      a.until = world.t + 30 + r() * 18;
      const won = a.winner ?? (world.tide >= 0 ? 'ga' : 'cf');
      fallBack(other(won), false);
      // The winner plants its standard where the front stands now; the field keeps it.
      const sd = 0.12 + r() * 0.3;
      world.standards.push({ x: world.front + fwd(won) * 30 * u, d: sd, side: won, t0: world.t, seed: Math.floor(r() * 1e6) });
      if (world.standards.length > 8) world.standards.shift();
      sayAt(won === a.attacker ? `${sideName(won)} TAKES THE GROUND` : `${sideName(won)} HOLDS`, GW / 2, HY - 30 * u, won === 'ga' ? '#d8ecff' : '#ffd0b8');
      emit('aftermath', world.front, sd, 0.5);
      chronicle(`Engagement ${roman(a.n)}: ${won === 'ga' ? `the ${titled(legion.name.replace('THE ', ''))}` : 'the droid army'} ${won === a.attacker ? 'took the ground it attacked' : 'held its ground'}.`);
      const sq = world.squads.find((q) => q.side === 'ga');
      if (sq) after(6, () => speak(sq, won === 'ga' ? pick(['MEDICS, UP FRONT', 'DIG IN. THEY\'LL BE BACK', 'GOOD WORK. COUNT OFF']) : pick(['MEDICS! WE NEED MEDICS', 'HOLD WHAT WE HAVE', 'PULL THE WOUNDED BACK']), true));
    } else nextAct();
  }
  function storyClimax(id: string) {
    const a = world.act;
    // Systems that own a climax take it themselves (knights, shield, descent, bombers, rollers, duel).
    if (['charge', 'shield', 'descent', 'bombers', 'rollers', 'duel'].includes(id)) {
      if (world.t - a.t0 > 12) {
        // Not taken (no knight standing, no shield up): the armour goes in instead.
        a.climax = 'armour';
      }
      return;
    }
    a.fired = true;
    const att = a.attacker;
    if (id === 'armour') {
      for (const w of world.walkers) if (w.state === 'walk') w.hx = w.side === att ? 60 * u : w.hx;
      const def = world.walkers.find((w) => w.side !== att && w.state === 'walk');
      if (def && a.winner === att) def.hp = Math.min(def.hp, 30);
      const mine = world.walkers.find((w) => w.side === att && w.state === 'walk');
      if (mine) speak(mine, att === 'ga' ? 'ALL WALKERS, ADVANCE! FIRE AT WILL' : 'ARMOUR, ADVANCE. ROGER, ROGER', true);
      say(att === 'ga' ? 'THE WALKERS GO IN' : 'THE SPIDERS ADVANCE', world.front, 0.3, 120 * u, att === 'ga' ? '#d8ecff' : '#ffd0b8');
      emit('armour', world.front, 0.3, 0.8);
      look('armour', world.front, 0.3, 1.6, 12, 7);
      bias += att === 'ga' ? 0.5 : -0.5;
    } else if (id === 'airassault') {
      for (let k = 0; k < (phone ? 2 : 3); k++) after(k * 2.5, () => launchCraft('ga', 'gunship', phone ? 4 : 6));
      sayAt('A WAVE OF GUNSHIPS COMES IN LOW', GW / 2, HY - 30 * u, '#d8ecff');
      emitAt('airassault', GW / 2, HY, 0.8);
      world.director.look('airassault', xOf(lineX('ga', 200 * u), 0.3), yOf(0.3) - 80 * u, 1.5, 12, 7);
      chronicle('A wave of gunships came in low over the line and put down a whole company at once.');
      bias += 0.5;
    } else if (id === 'droidwave') {
      for (let k = 0; k < (phone ? 1 : 2); k++) after(k * 4, () => launchCraft('cf', 'lander', phone ? 7 : 12));
      lastMarch.cf = -99;
      sayAt('THE CONFEDERACY LANDS ANOTHER LEGION', GW / 2, HY - 30 * u, '#ffd0b8');
      emitAt('droidwave', GW / 2, HY, 0.8);
      chronicle('The Confederacy put down lander after lander behind its line, and a new legion of droids marched out.');
      bias -= 0.5;
    } else if (id === 'capitalfall') {
      const victim = world.capitals.find((c) => c.side !== att && !c.falling);
      const killer = world.capitals.find((c) => c.side === att);
      if (!victim) return;
      if (killer) killer.fireUntil = world.t + 14;
      after(6, () => {
        victim.falling = 0.001;
        sayAt(`${victim.name} IS FALLING`, victim.x, victim.y + 70 * u * victim.s, att === 'ga' ? '#d8ecff' : '#ffd0b8');
        emitAt('capitalfall', victim.x, victim.y, 1);
        world.director.look('capitalfall', victim.x, (victim.y + HY) / 2, 1.3, 30, 9);
        chronicle(`${titled(victim.name)} was brought down; she fell burning beyond the horizon, and her wreck smoked there for the rest of the battle.`);
      });
    }
  }

  // ---- the weather -----------------------------------------------------------------------------------------
  let storm = 0;
  function weather(dt: number) {
    world.lightning = Math.max(0, world.lightning - dt * 3);
    world.wind += (Math.sin(world.t * 0.03) * 10 + Math.sin(world.t * 0.011) * 6 - world.wind) * dt * 0.2;
    const base = F.rain * (0.55 + 0.35 * Math.sin(world.t * 0.02 + swell));
    world.rain += (Math.max(base, storm * (field === 'arena' || field === 'canyon' ? 0 : 1)) - world.rain) * dt * 0.1;
    world.dust += (F.dust * 0.3 + storm * (field === 'arena' || field === 'canyon' ? 0.9 : 0) - world.dust) * dt * 0.1;
    world.fog = F.fog * (0.75 + 0.25 * Math.sin(world.t * 0.015 + swell * 2));
    if (F.lightning && r() < dt * (0.03 + storm * 0.2)) {
      world.lightning = 1;
      emit('thunder', GW / 2, 0.9, 0.1);
    }
    for (const fl of world.flares) {
      fl.alt = Math.max(0, fl.alt - dt * 9 * u);
      fl.x += world.wind * dt * 0.4;
    }
    world.flares = world.flares.filter((fl) => world.t - fl.t0 < fl.dur);
    for (const wk of world.wrecks) {
      wk.smoke = Math.max(0, wk.smoke - dt / 300);
      if (wk.smoke > 0.05 && r() < dt * 7 * wk.smoke) fx('smoke', wk.x + (r() - 0.5) * 40 * u, wk.d, 20 * u, { vx: world.wind * 0.5, valt: (22 + r() * 12) * u, dur: 11, r: (18 + r() * 14) * u, color: '#262220' });
      if (wk.smoke > 0.4 && r() < dt * 3) fx('fire', wk.x + (r() - 0.5) * 50 * u, wk.d, (4 + r() * 16) * u, { valt: 20 * u, dur: 0.7, r: 9 * u });
    }
    // The field keeps its wrecks: the newest few machines, and rollers for a while.
    world.wrecks = world.wrecks.filter((wk) => wk.kind !== 'roller' || world.t - wk.t0 < 150);
    while (world.wrecks.length > (phone ? 4 : 7)) world.wrecks.shift();
    for (const f of world.fx) {
      f.x += f.vx * dt;
      f.d += f.vd * dt;
      f.alt += f.valt * dt;
      if (f.kind === 'debris' || f.kind === 'spark' || f.kind === 'scrap') {
        f.valt -= 340 * u * dt;
        if (f.alt < 0) {
          f.alt = 0;
          f.valt *= -0.25;
          f.vx *= 0.5;
        }
      } else if (f.kind === 'smoke' || f.kind === 'dust') f.vx += (world.wind * 0.6 - f.vx) * dt * 0.3;
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
    // Fires that burn on in the field, here and there, so the smoke never stops.
    if (r() < dt * 3 && world.scorches.length) {
      const s = world.scorches[Math.floor(r() * world.scorches.length)];
      if (world.t - s.t0 < 150 && s.t0 > 0) fx('smoke', s.x, s.d, 6 * u, { vx: world.wind * 0.5, valt: (16 + r() * 10) * u, dur: 9, r: (14 + r() * 12) * u, color: '#3a3632' });
    }
  }

  // ---- the cast ----------------------------------------------------------------------------------------
  const night = F.hours[hour].night > 0.6;
  const LIBRARY: SystemDef<Ctx>[] = [
    {
      id: 'knights', label: 'a knight in the line', weight: 6, tags: ['hero'],
      create: (c) => {
        const w = c.world;
        const n = phone ? 1 : r() < 0.4 ? 2 : 1;
        const blades = g.shuffle(BLADES);
        for (let i = 0; i < n; i++) {
          const hd = 0.08 + r() * 0.35;
          const hx = 30 * u + r() * 60 * u;
          w.knights.push({ id: ids++, side: 'ga', name: KNIGHTS[(Math.floor(r() * KNIGHTS.length) + i) % KNIGHTS.length], blade: blades[i], x: lineX('ga', hx), d: hd, hx, hd, state: 'stand', t0: 0, ph: 0, face: fwd('ga'), seed: Math.floor(r() * 1e6), swing: 0, parryT: -9, robe: pick(['#5a4232', '#6a5644', '#3e3430', '#7a6a58']), line: '', lineT: -99, twin: false });
        }
        let charging: Knight | null = null;
        return {
          id: 'knights',
          step(dt) {
            for (const k of w.knights) {
              if (k.side !== 'ga') continue;
              const age = w.t - k.t0;
              const f = fwd('ga');
              let tx = lineX('ga', k.hx);
              let sp = 36 * u;
              if (k.state === 'lead') {
                tx = w.front + f * (w.gap / 2 + 80 * u);
                sp = 95 * u;
                // The blade: droids near it fall.
                for (const s of cfAlive) if (Math.abs(s.x - k.x) < 34 * u && Math.abs(s.d - k.d) < 0.05 && c.r() < dt * 3) {
                  kill(s, 'blade');
                  k.swing = -k.swing || 1;
                  k.parryT = w.t;
                }
                if (age > 20) {
                  k.state = 'withdraw';
                  k.t0 = w.t;
                  for (const s of w.soldiers) if (s.state === 'charge') s.state = 'march';
                  w.mood = 'push';
                }
              } else if (k.state === 'withdraw') {
                sp = 60 * u;
                if (Math.abs(tx - k.x) < 6 * u) k.state = 'stand';
              } else if (k.state === 'duel') continue;
              const dx = tx - k.x;
              if (Math.abs(dx) > 3 * u) {
                k.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
                k.ph += dt * sp / (8 * u);
              }
              k.d += (k.hd - k.d) * Math.min(1, dt * 0.3);
              k.face = f;
              k.swing *= Math.exp(-dt * 3);
            }
            const kn = w.knights.find((k) => k.state === 'stand' && k.side === 'ga');
            if (!charging && kn && w.t > 40 && (c.climax('charge') || (c.phase() === 'clash' && w.director.want('charge', 0.7, 260)))) {
              charging = kn;
              kn.state = 'lead';
              kn.t0 = w.t;
              w.mood = 'charge';
              bias += 1.1;
              for (const s of w.soldiers) if (s.side === 'ga' && (s.state === 'line' || s.state === 'march') && Math.abs(s.d - kn.d) < 0.22 && s.hx < 500 * u) s.state = 'charge';
              c.speak(kn, pick(['WITH ME! CHARGE!', 'NOW! FORWARD!', 'FOLLOW ME!']), true);
              c.say(`${kn.name} LEADS THE CHARGE`, kn.x, kn.d, 70 * u, '#d8ecff');
              c.emit('charge', kn.x, kn.d, 0.9);
              c.look('charge', kn.x + fwd('ga') * 150 * u, kn.d, 1.9, 14, 7);
              c.chronicle(`${titled(kn.name)} led a charge across the open ground with the blade lit, and the line went too.`);
              const sq = w.squads.find((q) => q.side === 'ga');
              if (sq) c.after(1.5, () => c.speak(sq, pick(LINES.gaPush)));
            }
            if (charging && charging.state !== 'lead') charging = null;
          },
          counts: () => ({ charge: charging ? 1 : 0 }),
        };
      },
    },
    {
      id: 'duelist', label: 'the blade-master', weight: 3, tags: ['hero', 'legendary'], requires: ['knights'],
      create: (c) => {
        const w = c.world;
        let duelist: Knight | null = null;
        let knight: Knight | null = null;
        let clash = 0;
        return {
          id: 'duelist',
          step(dt) {
            if (!duelist) {
              const kn = w.knights.find((k) => k.state === 'stand' && k.side === 'ga');
              if (!kn || !c.climax('duel')) return;
              knight = kn;
              const d = Math.max(0.08, Math.min(0.4, kn.d));
              duelist = { id: ids++, side: 'cf', name: pick(DUELISTS), blade: '#ff3a30', x: rearX('cf', d, 60 * u), d, hx: 0, hd: d, state: 'duel', t0: w.t, ph: 0, face: fwd('cf'), seed: Math.floor(c.r() * 1e6), swing: 0, parryT: -9, robe: '#2a2228', line: '', lineT: -99, twin: true };
              w.knights.push(duelist);
              kn.state = 'duel';
              kn.t0 = w.t;
              c.say(`${duelist.name} COMES TO MEET THE KNIGHT`, w.front, d, 90 * u, '#ffb4a0');
              c.emit('duel', w.front, d, 1);
              c.look('duel', w.front, d, 2.1, 30, 9);
              c.speak(duelist, LINES.duelist[0]);
              c.chronicle(`${titled(duelist.name)} came out between the lines to fight ${titled(kn.name)} blade to blade.`);
              return;
            }
            const age = w.t - duelist.t0;
            const kn = knight!;
            const mid = w.front;
            if (age < 40) {
              // Close in, then circle and clash.
              const near = Math.abs(duelist.x - mid) < 40 * u && Math.abs(kn.x - mid) < 40 * u;
              const sway = Math.sin(age * 0.9) * 24 * u;
              const dTarget = mid - fwd('cf') * (16 * u + sway * 0.3);
              const kTarget = mid - fwd('ga') * (16 * u - sway * 0.3);
              for (const [who, tx] of [[duelist, dTarget], [kn, kTarget]] as [Knight, number][]) {
                const dx = tx - who.x;
                who.x += Math.sign(dx) * Math.min(Math.abs(dx), 90 * u * dt);
                if (Math.abs(dx) > 3 * u) who.ph += dt * 10;
                who.d += (duelist.d - who.d) * Math.min(1, dt * 0.8);
                who.face = fwd(who.side);
              }
              if (near) {
                clash -= dt;
                if (clash <= 0) {
                  clash = 0.25 + c.r() * 0.5;
                  duelist.swing = c.r() < 0.5 ? -1 : 1;
                  kn.swing = -duelist.swing;
                  duelist.parryT = kn.parryT = w.t;
                  for (let k = 0; k < 3; k++) fx('spark', mid, duelist.d, 26 * u, { vx: (c.r() - 0.5) * 120 * u, valt: (c.r() - 0.2) * 100 * u, dur: 0.4, r: 2 * u, color: c.r() < 0.5 ? '#ffffff' : kn.blade });
                }
                if (c.r() < dt * 0.15) c.speak(c.r() < 0.5 ? duelist : kn, c.r() < 0.5 ? pick(LINES.duelist) : pick(['YOU WON\'T PASS THIS LINE', 'GIVE IT UP', 'IS THAT ALL?']));
              }
              duelist.swing *= Math.exp(-dt * 4);
              kn.swing *= Math.exp(-dt * 4);
            } else if (duelist.state === 'duel') {
              duelist.state = 'withdraw';
              duelist.t0 = w.t;
              kn.state = 'withdraw';
              kn.t0 = w.t;
              c.say(`${duelist.name} WITHDRAWS`, duelist.x, duelist.d, 80 * u, '#d8ecff');
              c.emit('duelend', duelist.x, duelist.d, 0.6);
              c.speak(duelist, LINES.duelist[2]);
              c.chronicle(`The duel ended with neither down; ${titled(duelist.name)} withdrew behind the droid line.`);
            } else {
              const tx = rearX('cf', duelist.d, 200 * u);
              duelist.x += Math.sign(tx - duelist.x) * 110 * u * dt;
              duelist.ph += dt * 10;
              duelist.face = -fwd('cf') as 1 | -1;
              if (Math.abs(tx - duelist.x) < 20 * u) {
                w.knights = w.knights.filter((k) => k !== duelist);
                duelist = null;
                knight = null;
              }
            }
          },
          counts: () => ({ duel: duelist ? 1 : 0 }),
        };
      },
    },
    {
      id: 'rollers', label: 'shield droids', weight: 7, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'rollers',
          step(dt) {
            if (!w.rollers.length && (c.climax('rollers') || (c.phase() === 'clash' && w.t > 30 && w.director.want('rollers', 0.55, 170)))) {
              const n = phone ? 2 : 2 + Math.floor(c.r() * 2);
              for (let i = 0; i < n; i++) {
                const d = 0.08 + c.r() * 0.42;
                w.rollers.push({ id: ids++, x: rearX('cf', d, (60 + i * 80) * u), d, tx: lineX('cf', (10 + c.r() * 60) * u), state: 'roll', t0: w.t, hp: 100, cool: 1, seed: Math.floor(c.r() * 1e6), spin: 0, shield: 0, fireT: -9 });
              }
              c.emit('rollers', lineX('cf', 60 * u), 0.3, 0.7);
              c.look('rollers', lineX('cf', 60 * u), 0.3, 1.7, 8, 6);
              const sq = w.squads.find((q) => q.side === 'ga');
              if (sq) c.after(1.5, () => c.speak(sq, pick(['ROLLERS! GET THE LAUNCHERS UP', 'SHIELD DROIDS! SHOOT THE GAPS', 'HERE THEY COME, THE ROLLERS'])));
            }
            for (const ro of w.rollers) {
              const age = w.t - ro.t0;
              if (ro.state === 'roll') {
                ro.tx = lineX('cf', 20 * u);
                const dx = ro.tx - ro.x;
                ro.x += Math.sign(dx) * Math.min(Math.abs(dx), 150 * u * dt);
                ro.spin += dt * 14;
                if (c.r() < dt * 6) fx('dust', ro.x, ro.d, 0, { valt: 6 * u, dur: 1, r: 6 * u });
                if (Math.abs(dx) < 4 * u) {
                  ro.state = 'deploy';
                  ro.t0 = w.t;
                }
              } else if (ro.state === 'deploy') {
                if (age > 1.2) {
                  ro.state = 'shield';
                  ro.t0 = w.t;
                }
              } else if (ro.state === 'shield') {
                ro.x += (lineX('cf', 20 * u) - ro.x) * Math.min(1, dt * 0.3);
                ro.shield += (1 - ro.shield) * Math.min(1, dt * 2);
                ro.cool -= dt;
                if (ro.cool <= 0 && gaAlive.length) {
                  ro.cool = 0.9 + c.r() * 0.6;
                  const t = gaAlive[Math.floor(c.r() * gaAlive.length)];
                  ro.fireT = w.t;
                  for (let k = 0; k < 2; k++) c.after(k * 0.1, () => alive(t) && bolt('cf', 'rifle', ro.x + fwd('cf') * 14 * u, ro.d, 18 * u, t.x, t.d, 14 * u, 'soldier', t.id, c.r() < 0.06, -1));
                }
                if (age > 110) ro.hp -= dt * 3;
              }
              if (ro.hp <= 0 && ro.state !== 'dead') {
                ro.state = 'dead';
                explode(ro.x, ro.d, 40 * u, 0.4);
                w.wrecks.push({ id: ids++, kind: 'roller', x: ro.x, d: ro.d, t0: w.t, seed: ro.seed, face: fwd('cf'), smoke: 0.4 });
                c.emit('rollerdown', ro.x, ro.d, 0.3);
              }
            }
            w.rollers = w.rollers.filter((ro) => ro.state !== 'dead');
          },
        };
      },
    },
    {
      id: 'spiders', label: 'the spider walkers', weight: 4, tags: ['threat'],
      create: () => ({ id: 'spiders' }),
    },
    {
      id: 'shield', label: 'the dome shield', weight: (gg: Genome) => (field === 'platform' ? 3 : 5) + gg.unit(), tags: ['objective'],
      create: (c) => {
        const w = c.world;
        const placeShield = () => {
          const d = 0.38 + c.r() * 0.12;
          const sx = lineX('cf', Math.min(maxHx('cf', d) * 0.75, 460 * u));
          w.shield = { x: sx, d, r: 300 * u, up: 0, state: 'raising', t0: w.t, hp: 100, flick: 0, gx: sx, gd: d - 0.1 };
        };
        placeShield();
        w.shield!.up = 1;
        w.shield!.state = 'up';
        const team: Soldier[] = [];
        let phase: 'idle' | 'sneak' | 'plant' | 'out' = 'idle';
        let t0 = 0;
        return {
          id: 'shield',
          step(dt) {
            const sh = w.shield;
            if (sh) {
              sh.flick = Math.max(0, sh.flick - dt * 2.5);
              // The dome keeps to the droids' rear as the front moves.
              const tx = lineX('cf', Math.min(maxHx('cf', sh.d) * 0.75, 460 * u));
              sh.x += (tx - sh.x) * Math.min(1, dt * 0.05);
              sh.gx = sh.x + fwd('cf') * sh.r * 0.15;
              sh.gd = sh.d - 0.1;
              if (sh.state === 'raising') {
                sh.up = Math.min(1, sh.up + dt / 6);
                if (sh.up >= 1) sh.state = 'up';
              } else if (sh.state === 'down') sh.up = Math.max(0, sh.up - dt * 1.2);
            }
            if (phase === 'idle') {
              if (sh && sh.state === 'up' && c.climax('shield')) {
                phase = 'sneak';
                t0 = w.t;
                team.length = 0;
                const d = 0.02 + c.r() * 0.03;
                const sq = newSquad('ga', 4);
                sq.name = pick(['DELTA TEAM', 'NIGHTJAR TEAM', 'GHOST TEAM', 'SPECTRE TEAM']);
                for (let i = 0; i < 4; i++) team.push(spawnSoldier('ga', 'commando', rearX('ga', d, (40 + i * 26) * u), d + i * 0.004, 0, d, 'sneak', sq.id));
                c.speak(sq, 'TEAM IN POSITION. MOVING ON THE GENERATOR');
                c.emit('commandos', rearX('ga', d, -300 * u), d, 0.4);
              } else if (!sh && w.t - t0 > 150 && c.phase() !== 'climax' && w.director.want('newshield', 0.4, 60)) {
                // A lander brings a new generator.
                const l = launchCraft('cf', 'lander', 0);
                l.name = 'GENERATOR LANDER';
                placeShield();
                w.shield!.up = 0;
                c.say('A NEW SHIELD RISES OVER THE DROID LINES', w.shield!.x, w.shield!.d, 120 * u, '#ffd0b8');
                c.emit('shieldup', w.shield!.x, w.shield!.d, 0.5);
                c.chronicle('The Confederacy landed a new generator, and the dome rose again over their rear.');
              }
              return;
            }
            if (!sh) {
              phase = 'idle';
              return;
            }
            const gen = { x: sh.gx, d: sh.gd };
            if (phase === 'sneak') {
              let there = true;
              for (const [i, s] of team.entries()) {
                if (!alive(s)) continue;
                const tx = gen.x - fwd('ga') * (i * 16 + 30) * u;
                const dx = tx - s.x;
                s.x += Math.sign(dx) * Math.min(Math.abs(dx), 46 * u * dt);
                if (Math.abs(dx) < 40 * u) s.d += (gen.d + i * 0.006 - s.d) * Math.min(1, dt * 0.4);
                s.hd = s.d;
                s.ph += dt * 5;
                s.crouch = 0.6;
                s.face = (Math.sign(dx) || s.face) as 1 | -1;
                if (Math.abs(dx) > 4 * u || Math.abs(s.d - gen.d) > 0.03) there = false;
              }
              if (there || w.t - t0 > 70) {
                phase = 'plant';
                t0 = w.t;
                const sq = w.squads.find((q) => q.id === team[0]?.squad);
                if (sq) c.speak(sq, 'CHARGES SET. TEN SECONDS');
              }
            } else if (phase === 'plant') {
              if (w.t - t0 > 9) {
                phase = 'out';
                t0 = w.t;
                sh.state = 'down';
                sh.t0 = w.t;
                explode(gen.x, gen.d + 0.02, 110 * u, 0.3, { big: true });
                w.wrecks.push({ id: ids++, kind: 'generator', x: gen.x, d: gen.d + 0.02, t0: w.t, seed: 1, face: 1, smoke: 1 });
                c.say('THE SHIELD IS DOWN', gen.x, gen.d, 120 * u, '#d8ecff');
                c.emit('shielddown', gen.x, gen.d, 1);
                c.look('shielddown', sh.x, sh.d, 1.6, 12, 8);
                c.chronicle('Commandos blew the shield generator, and the dome over the droid rear went out; the guns walked in after it.');
                w.mood = 'shield';
                bias += 1;
                for (let k = 0; k < 7; k++) c.after(2 + k * 0.6, () => shell('ga', sh.x + (c.r() - 0.5) * sh.r * 1.4, Math.max(0.05, Math.min(0.66, sh.d + (c.r() - 0.5) * 0.25)), 1));
                c.after(14, () => {
                  w.shield = null;
                  if (w.mood === 'shield') w.mood = 'push';
                });
                const sq = w.squads.find((q) => q.side === 'ga' && q.id !== team[0]?.squad);
                if (sq) c.after(2, () => c.speak(sq, 'THE SHIELD IS DOWN! ALL GUNS, FIRE!'));
              }
            } else if (phase === 'out') {
              for (const s of team) {
                if (!alive(s)) continue;
                const tx = rearX('ga', s.d, 200 * u);
                s.x += Math.sign(tx - s.x) * 70 * u * dt;
                s.ph += dt * 8;
                s.crouch = 0;
                s.face = -fwd('ga') as 1 | -1;
              }
              if (w.t - t0 > 30) {
                const gone = new Set(team.map((s) => s.id));
                w.soldiers = w.soldiers.filter((s) => !gone.has(s.id));
                for (const id of gone) byId.delete(id);
                team.length = 0;
                phase = 'idle';
              }
            }
          },
          counts: () => ({ shield: w.shield && w.shield.state === 'up' ? 1 : 0 }),
        };
      },
    },
    {
      id: 'broadside', label: 'the broadsides', weight: 6, tags: ['sky'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'broadside',
          step() {
            if (w.t < 25 || c.phase() === 'aftermath' || w.capitals.some((q) => w.t < q.fireUntil) || !w.director.want('broadside', 0.6, 100)) return;
            const ship = w.capitals.filter((q) => !q.falling)[Math.floor(c.r() * w.capitals.length)];
            if (!ship) return;
            ship.fireUntil = w.t + 10 + c.r() * 6;
            const foe = w.capitals.find((q) => q.side !== ship.side);
            sayAt(`${ship.name} OPENS FIRE`, ship.x, ship.y + 60 * u * ship.s, ship.side === 'ga' ? '#d8ecff' : '#ffd0b8');
            emitAt('broadside', ship.x, ship.y, 0.7);
            w.director.look('broadside', ship.x, ship.y + 80 * u, 1.5, 10, 6);
            c.chronicle(`${titled(ship.name)} opened her broadside${foe ? ` on ${titled(foe.name)}` : ''}, and the sky lit from end to end.`);
          },
        };
      },
    },
    {
      id: 'descent', label: 'a cruiser\'s descent', weight: 4, tags: ['sky'],
      create: (c) => {
        const w = c.world;
        let ship: Capital | null = null;
        let launched = 0;
        return {
          id: 'descent',
          step(dt) {
            if (!ship) {
              if (!c.climax('descent')) return;
              ship = w.capitals.find((q) => q.side === 'ga' && q.kind === 'wedge') ?? w.capitals[0] ?? null;
              if (!ship) return;
              ship.descentT = w.t;
              launched = 0;
              sayAt(`${ship.name} DESCENDS`, ship.x, ship.y + 70 * u * ship.s, '#d8ecff');
              emitAt('descent', ship.x, ship.y, 0.8);
              w.director.look('descent', ship.x, (ship.y + HY) / 2, 1.4, 16, 6);
              c.chronicle(`${titled(ship.name)} came down low over the field and launched her fighters.`);
              return;
            }
            const age = w.t - ship.descentT;
            const ease = (k: number) => k * k * (3 - 2 * k);
            ship.descent = age < 30 ? ease(age / 30) : age < 60 ? 1 : age < 95 ? 1 - ease((age - 60) / 35) : 0;
            if (age > 25 && age < 60 && launched < 3 && c.r() < dt * 0.25) {
              launched++;
              const dir = -ship.face as 1 | -1;
              world.flybys.push({ id: ids++, side: ship.side, kind: 'fighter', x: ship.x, y: ship.y + 20 * u, vx: dir * 220 * u, vy: 18 * u, s: 0.6 + c.r() * 0.3, n: 3, t0: w.t, seed: Math.floor(c.r() * 1e6) });
              emitAt('launch', ship.x, ship.y, 0.2);
            }
            if (age > 95) {
              ship.descent = 0;
              ship = null;
            }
          },
        };
      },
    },
    {
      id: 'bombers', label: 'bomber runs', weight: 4, tags: ['air'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'bombers',
          step() {
            const cl = c.climax('bombers');
            if (!cl && (w.t < 60 || c.phase() !== 'clash' || !w.director.want('bombers', 0.65, 320))) return;
            const side: Side = cl ? w.act.attacker : c.r() < 0.65 ? 'ga' : 'cf';
            const foe = other(side);
            const d = 0.15 + c.r() * 0.3;
            const dir = fwd(side);
            const y = skyBottom - 40 * u;
            const s = 0.75;
            const sx = dir > 0 ? -160 * u : GW + 160 * u;
            const vx = dir * 240 * u;
            world.flybys.push({ id: ids++, side, kind: 'bomber', x: sx, y, vx, vy: 0, s, n: 3, t0: w.t, seed: Math.floor(c.r() * 1e6) });
            // The bombs come down along the enemy line as they pass over it.
            for (let k = 0; k < 9; k++) {
              const bx = lineX(foe, (40 + k * 60) * u);
              const when = Math.abs(xOf(bx, d) - sx) / Math.abs(vx);
              c.after(when + 1.2, () => explode(bx + (c.r() - 0.5) * 30 * u, Math.max(0.04, d + (c.r() - 0.5) * 0.12), 60 * u, 0.6, { walkerDmg: 15 }));
            }
            sayAt(side === 'ga' ? 'BOMBERS OVER THE DROID LINE' : 'DROID BOMBERS OVERHEAD', GW / 2, y + 30 * u, side === 'ga' ? '#d8ecff' : '#ffb4a0');
            emitAt('bombers', GW / 2, y, 0.8);
            w.director.look('bombers', xOf(lineX(foe, 200 * u), d), yOf(d), 1.5, 9, 6);
            c.chronicle(side === 'ga' ? 'A bomber flight laid a line of fire across the droid ranks.' : 'Droid bombers came over and laid their bombs along the trooper line.');
            w.mood = 'barrage';
            c.after(12, () => {
              if (w.mood === 'barrage') w.mood = 'push';
            });
          },
        };
      },
    },
    {
      id: 'storm', label: field === 'arena' || field === 'canyon' ? 'sandstorms' : field === 'platform' ? 'the storm breaking' : 'downpours',
      weight: () => (field === 'crystal' ? 0 : field === 'platform' ? 6 : 4), tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        return {
          id: 'storm',
          step(dt) {
            if (storm <= 0.01 && w.t > 70 && w.director.want('storm', 0.45, 300)) {
              until = w.t + 50 + c.r() * 40;
              const line = field === 'arena' || field === 'canyon' ? 'A SANDSTORM ROLLS OVER THE FIELD' : field === 'platform' ? 'THE STORM BREAKS OVER THE PLATFORM' : 'THE RAIN COMES DOWN IN SHEETS';
              sayAt(line, GW / 2, HY - 40 * u, '#e8e0d0');
              emitAt('storm', GW / 2, HY, 0.5);
              c.chronicle(`${line.charAt(0)}${line.slice(1).toLowerCase()}, and the fighting went on in it.`);
            }
            storm = w.t < until ? Math.min(1, storm + dt / 15) : Math.max(0, storm - dt / 20);
          },
          counts: () => ({ storm: storm > 0.05 ? 1 : 0 }),
        };
      },
    },
    {
      id: 'flares', label: 'illumination flares', weight: () => (night ? 6 : 0), tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let next = 8;
        return {
          id: 'flares',
          step() {
            if (w.t < next) return;
            next = w.t + 18 + c.r() * 22;
            const d = 0.15 + c.r() * 0.4;
            const x = w.front + (c.r() - 0.5) * 600 * u;
            w.flares.push({ x, d, alt: (380 + c.r() * 120) * u, t0: w.t, dur: 30 });
            c.emit('flare', x, d, 0.15);
          },
        };
      },
    },
  ];
  const RULE = { total: [4, 6] as [number, number], quota: { hero: [0, 2] as [number, number], sky: [1, 2] as [number, number], weather: [0, 1] as [number, number], threat: [0, 1] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);

  // ---- the battle as we find it --------------------------------------------------------------------------
  deploy('ga', N);
  deploy('cf', NC);
  for (let i = 0; i < walkerQuota('ga'); i++) {
    const d = walkerD();
    spawnWalker('ga', 0, d).x = lineX('ga', world.walkers[world.walkers.length - 1].hx);
  }
  for (let i = 0; i < walkerQuota('cf'); i++) {
    const d = walkerD();
    spawnWalker('cf', 0, d).x = lineX('cf', world.walkers[world.walkers.length - 1].hx);
  }
  setupCapitals();
  for (let k = 0; k < (phone ? 2 : 3); k++) spawnDogfight().t0 -= r() * 10;
  // The battle has been going a while: old scorches, a wreck or two, fires.
  for (let k = 0; k < 24; k++) world.scorches.push({ x: world.front + (r() - 0.5) * 1400 * u, d: 0.05 + r() * 0.6, r: (20 + r() * 40) * u, t0: -r() * 200 });
  for (let k = 0; k < (phone ? 1 : 2); k++) {
    const d = 0.2 + r() * 0.4;
    world.wrecks.push({ id: ids++, kind: r() < 0.5 ? 'spider' : 'gunship', x: world.front + (r() - 0.5) * 500 * u, d, t0: -100, seed: Math.floor(r() * 1e6), face: r() < 0.5 ? 1 : -1, smoke: 0.6 });
  }
  launchCraft('ga', 'gunship', 0).x = rearX('ga', 0.3, 40 * u);

  // ---- the radio --------------------------------------------------------------------------------------------
  let nextVoice = 2;
  function voices(dt: number) {
    nextVoice -= dt;
    if (nextVoice > 0) return;
    nextVoice = 2.5 + r() * 4;
    const roll = r();
    const sqs = world.squads.filter((q) => world.t - q.lineT > 8);
    if (roll < 0.62 && sqs.length) {
      const sq = pick(sqs);
      const ga = sq.side === 'ga';
      const pushing = ga ? world.tide > 0.3 : world.tide < -0.3;
      const losing = ga ? world.tide < -0.3 : world.tide > 0.3;
      speak(sq, ga ? pick(pushing ? LINES.gaPush : losing ? [...LINES.gaHold, 'WE NEED SUPPORT HERE!'] : LINES.gaHold) : pick(pushing ? LINES.cfPush : LINES.cfHold));
    } else if (roll < 0.78) {
      const wk = world.walkers.filter((q) => q.state === 'walk' && world.t - q.lineT > 10);
      if (wk.length) {
        const w = pick(wk);
        speak(w, pick(w.side === 'ga' ? (w.hp < 40 ? LINES.walkerHurt : LINES.walker) : LINES.spider));
      }
    } else if (roll < 0.9) {
      const kn = world.knights.filter((k) => k.state === 'stand' && world.t - k.lineT > 12);
      if (kn.length) speak(pick(kn), pick(LINES.knight));
    } else {
      const cr = world.crafts.filter((c) => c.kind === 'gunship' && world.t - c.lineT > 6);
      if (cr.length) speak(pick(cr), pick(LINES.gunshipStrafe));
    }
  }

  // ---- a touch ----------------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 3 || y > NY || y < HY + 6 * u) return null;
    lastNudge = world.t;
    const k = (y - HY) / (NY - HY);
    const d = 1 - Math.sqrt(Math.max(0, Math.min(1, k)));
    const ggx = gx(x, d);
    const ship = world.capitals.find((q) => q.side === 'ga') ?? world.capitals[0];
    const sx = ship ? ship.x : GW / 2;
    const sy = ship ? ship.y : 0;
    for (let i = 0; i < 3; i++) {
      after(i * 0.35, () => world.skybolts.push({ x0: sx + (r() - 0.5) * 80 * u, y0: sy, x1: x + (r() - 0.5) * 30 * u, y1: y, t0: world.t, dur: 0.45, color: '#7ad8ff', w: 3.2 }));
      after(0.45 + i * 0.35, () => explode(ggx + (r() - 0.5) * 50 * u, Math.max(0, d + (r() - 0.5) * 0.03), 70 * u, 0.7, { big: i === 1, walkerDmg: 20 }));
    }
    emitAt('strike', x, y, 0.6);
    const line = ship ? `${ship.name}'S GUNS ANSWER: A STRIKE ON YOUR MARK` : 'A STRIKE COMES DOWN ON YOUR MARK';
    sayAt(line, x, y - 40 * u, '#d8ecff');
    return line;
  }

  function step(dt: number) {
    world.t += dt;
    world.director.step(world.t, dt);
    for (let i = later.length - 1; i >= 0; i--)
      if (world.t >= later[i].at) {
        const { fn } = later[i];
        later.splice(i, 1);
        fn();
      }
    infantry(dt);
    walkers(dt);
    crafts(dt);
    shots(dt);
    artillery();
    reinforce();
    sky(dt);
    story();
    tide(dt);
    for (const s of systems) s.step?.(dt);
    weather(dt);
    voices(dt);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
