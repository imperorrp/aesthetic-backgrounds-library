/**
 * # Sandsea: the open sand, where the spice is harvested and the worms come for the harvesters.
 *
 * On screen, at a glance: dunes to the horizon under a white sun (or two moons); a crawler
 * working a dark stain of spice, dust pouring off it; its carryall standing off; two spotter
 * ornithopters circling; a rock ledge in the foreground with watchers on it; the desert folk
 * crossing the near dunes in a line.
 * The camera: on the ledge, looking out over the whole erg.
 *
 * Always happening (the floor):
 * - The harvest: a carryall brings a crawler down onto a spice patch, it works the sand (dust,
 *   the hold filling), the carryall comes back and lifts it away with its tonnes; then the next.
 * - Spotters circle the crawler; sand streams off the crests; the day turns; the folk cross.
 *
 * The cast (each seed draws some):
 * - worms [threat, forced] wormsign running at the crawler; the carryall races it; the worm takes
 *   the crawler (a crater, a loss in the log) or only sand.
 * - storm [weather] a wall of dust from one side; everything grounds or runs; static flashes;
 *   a spotter may go down in it (a wreck, smoking, for the rest of the session).
 * - smugglers [visitors] a lander at night on the far sand; the folk come to trade.
 * - patrol [company] flights of three with searchlights, sweeping; the folk crouch; a smuggler runs.
 * - riders [wonder] at dawn the folk set a thumper and ride the worm that comes, across and away.
 * - blow [wonder] a spice blow: a geyser of sand and spice, and a rich new patch.
 * - devils [weather] dust devils in the heat of the day.
 * - salvage [life] the folk strip a wreck by night.
 * - oldone [legendary] the old one, a worm the size of a hill, rises at the horizon.
 * Quotas: 3–5 in all; 0–2 weather.
 *
 * Events: common: a crawler lifted with its tonnes, a party crossing, a spotter's report;
 * uncommon: wormsign, a storm, a blow; rare: a crawler lost, a spotter down, the riders;
 * legendary: the old one.
 * What keeps it going: there is always another crawler, another patch; the worms make the
 * craters and the wrecks, and the folk come to them.
 * What changes with the seed: the air (white, red, yellow, grey), the horizon, the ledge's side,
 * the cast, the names, how rich the sand is.
 * A touch: plants a thumper on the sand where you click; a worm en route turns for it, or one comes.
 * Phone: the same erg, smaller; one spotter, closer patches.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import { type Air } from './desert';
import type {
  Carryall, Crawler, Ctx, Fx, FxKind, Party, SandOptions, SandWorld, Thopter, ThopterRole, Worm,
} from './types';

export const REGIONS = ['THE BONE SEA', 'THE SOUTHERN ERG', 'THE WINDWARD SANDS', 'THE DEEP SAND', 'THE SEA OF GLASS', 'THE WHITE SHIELD', 'THE GREAT FLAT', 'THE HOLLOW SANDS', 'THE DRUM SANDS', 'THE LONG ERG'];
const CRAWLER_NAMES = ['CRAWLER FOUR', 'CRAWLER SEVEN', 'CRAWLER NINE', 'CRAWLER TWELVE', 'CRAWLER TWO', 'CRAWLER FIFTEEN', 'CRAWLER SIX', 'CRAWLER ELEVEN', 'CRAWLER THREE', 'CRAWLER TWENTY'];
const CARRYALL_NAMES = ['BURDEN', 'LONG ARM', 'PATIENCE', 'GOODWIFE', 'THE OX', 'THE MULE', 'MERCY', 'THE HOIST', 'STRONGBACK', 'LAST WORD'];
const THOPTER_NAMES = ['KESTREL', 'SPARROW', 'SHRIKE', 'WREN', 'HAWK TWO', 'LARK', 'SWIFT', 'HARRIER', 'PLOVER', 'MARTIN', 'KITE', 'TERN'];
const LINES = {
  working: ['HOLD AT FORTY PERCENT', 'SPICE IS RICH HERE', 'TRACKS CLEAR, GOING ON', 'SAND\'S SOFT ON THE LEFT SCOOP', 'KEEP YOUR EYES ON THE HORIZON, SPOTTERS', 'INTAKES RUNNING HOT', 'SEVENTY PERCENT AND CLIMBING', 'WE\'LL FILL HER BY DUSK'],
  spotter: ['NO SIGN. THE SAND IS QUIET', 'SPOTTER TWO, ALL CLEAR', 'HOLDING THE CIRCLE', 'WIND\'S RISING OUT OF THE EAST', 'NOTHING ON THE SOUTH SIDE', 'I HAVE THE CRAWLER IN SIGHT', 'VISIBILITY GOOD'],
  standoff: ['CARRYALL ON STATION', 'STANDING OFF AT TWO THOUSAND', 'READY FOR THE LIFT WHEN YOU CALL', 'FUEL IS GOOD FOR TWO HOURS'],
  alarm: ['WORMSIGN! WORMSIGN!', 'CARRYALL, COME IN NOW', 'LIFT HER, LIFT HER NOW', 'ALL CREW TO THE LIFT POINTS', 'IT\'S A BIG ONE', 'SHUT DOWN THE INTAKES'],
  late: ['WE ARE NOT GOING TO MAKE IT', 'GET OUT! GET OUT OF HER!', 'SPOTTERS, TAKE THE CREW OFF', 'TOO CLOSE, TOO CLOSE'],
  lifted: ['SHE\'S UP. SHE\'S UP.', 'CLEAR OF THE SAND', 'THAT WAS CLOSE', 'WELL FLOWN, CARRYALL'],
  lost: ['SHE\'S GONE. SHE\'S GONE.', 'DID ANYONE GET OFF?', 'MARK THE POSITION'],
  storm: ['STORM ON THE HORIZON', 'GROUND EVERYTHING', 'GET HER UNDER COVER', 'I CAN\'T SEE THE SAND'],
  patrol: ['PATROL SWEEP, SECTOR NINE', 'NOTHING MOVING DOWN THERE', 'LIGHTS ON THE DUNES', 'HOLD FORMATION'],
};

const DAY_LEN = 960;

export function createSandsea(seed: string | number, W: number, H: number, opts: SandOptions): SandWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'sand');
  const shotR: Rng = forkRng(seed, 'sand-shots');
  const g: Genome = createGenome(seed, 'sand');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const phone = GW < GH;
  const traffic = Math.max(0.3, Math.min(2.5, opts.traffic));
  const pick = <T>(a: readonly T[], R: Rng = r) => a[Math.floor(R() * a.length)];
  let ids = 1;

  const air = g.weighted<Air>({ bone: 4, rose: 3, ochre: 3, ash: 2 });
  const HY = Math.round(GH * g.range(0.46, 0.54));
  const NY = Math.round(GH * 0.86);
  const side: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const sunSide: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const yOf = (d: number) => HY + (NY - HY) * Math.pow(1 - Math.max(0, Math.min(1, d)), 2);
  const mOf = (d: number) => 0.08 + 0.92 * Math.pow(1 - Math.max(0, Math.min(1, d)), 2);
  const xOf = (x: number, d: number) => GW / 2 + (x - GW / 2) * (0.35 + 0.65 * Math.pow(1 - Math.max(0, Math.min(1, d)), 2));

  // eslint-disable-next-line prefer-const
  let world: SandWorld;
  world = {
    t: 0, W, H, GW, GH, u, bus,
    director: createDirector(forkRng(seed, 'sand-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    name: g.pick(REGIONS), air, cast: [], castIds: [],
    day: g.range(0.3, 0.44), dayLen: DAY_LEN,
    HY, NY, ledge: { y: NY, x0: 0, x1: GW, side }, sunSide,
    yOf, mOf, xOf,
    patches: [], crawlers: [], carryalls: [], thopters: [], worms: [], parties: [], wrecks: [], craters: [], thumpers: [], devils: [], fx: [], watchers: [],
    storm: 0, stormFront: 0, stormDir: 1, flash: 0, wind: g.range(-1, 1) * 10, dust: 0,
    blow: null, oldOne: null, tonnes: 0, lost: 0,
    op: { phase: 'between', t0: -20, crawler: -1, carryall: -1, patch: -1, alarm: 0, eta: 0 },
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    labels: [], chronicle: [],
    step, nudge,
    counts: () => ({
      crawlers: world.crawlers.filter((c) => c.state !== 'lost' && c.state !== 'wreck').length,
      carryalls: world.carryalls.filter((c) => c.state !== 'off').length,
      thopters: world.thopters.filter((c) => c.state !== 'off' && c.state !== 'wreck').length,
      worms: world.worms.filter((w) => w.state !== 'gone').length,
      parties: world.parties.length,
      wrecks: world.wrecks.length,
      patches: world.patches.length,
      fx: world.fx.length,
      tonnes: Math.round(world.tonnes),
    }),
  };

  // ---- the verbs -----------------------------------------------------------------------------------
  function establish(): { x: number; y: number; zoom: number } {
    const c = world?.crawlers?.find((q) => q.state === 'working');
    if (c && shotR() < 0.6) return { x: xOf(c.x, c.d), y: yOf(c.d) - 20 * u, zoom: 1.8 };
    return { x: GW / 2, y: GH * 0.58, zoom: 1 };
  }
  const say = (text: string, x: number, y: number, color = '#efe6d2') => {
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
  const speak = (who: { line: string; lineT: number }, line: string) => {
    who.line = line;
    who.lineT = world.t;
    bus.emit({ type: 'radio', text: line, weight: 0.05, priority: 'low' });
  };
  const look = (why: string, x: number, d: number, zoom: number, hold: number, priority: number) => world.director.look(why, xOf(x, d), yOf(d) - 30 * u * mOf(d), zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: FxKind, x: number, d: number, alt: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 900) return;
    world.fx.push({ kind, x, d, alt, vx: 0, valt: 0, t0: world.t, dur: 2, r: 10 * u, color: '#c8a878', seed: Math.floor(r() * 1e6), ...extra });
  };
  const entryX = (dir: 1 | -1, off: number) => (dir > 0 ? -off : GW + off);
  function spawnThopter(role: ThopterRole, x: number, d: number, extra: Partial<Thopter> = {}): Thopter {
    const th: Thopter = {
      id: ids++, name: pick(THOPTER_NAMES), x, d, alt: 160 * u, dir: 1, state: 'cross', t0: world.t, role, cx: x, cd: d, cr: 260 * u, phase: r() * 6, speed: (150 + r() * 40) * u, seed: Math.floor(r() * 1e6), beat: r() * 6,
      lamp: false, tx: x, td: d, line: '', lineT: -99, ...extra,
    };
    world.thopters.push(th);
    return th;
  }
  function spawnParty(x: number, d: number, dir: 1 | -1, n: number, extra: Partial<Party> = {}): Party {
    const members = Array.from({ length: n }, (_, i) => ({ dx: -i * (14 + r() * 8) * u, dd: (r() - 0.5) * 0.02, ph: r() * 6, pack: r() < 0.6, weapon: r() < 0.35, child: i > 1 && r() < 0.12, seed: Math.floor(r() * 1e6) }));
    const p: Party = { id: ids++, x, d, dir, speed: (9 + r() * 3) * u, state: 'cross', t0: world.t, seed: Math.floor(r() * 1e6), tx: dir > 0 ? GW + 200 * u : -200 * u, members, at: -1, line: '', lineT: -99, ...extra };
    world.parties.push(p);
    return p;
  }
  function spawnWorm(x: number, d: number, extra: Partial<Worm> = {}): Worm {
    const w: Worm = { id: ids++, x, d, dir: 1, speed: (26 + r() * 16) * u, state: 'sign', t0: world.t, k: 0, tx: x, td: d, targetKind: 'none', crawler: -1, size: 0.8 + r() * 0.5, riders: 0, seed: Math.floor(r() * 1e6), dur: 12, ...extra };
    world.worms.push(w);
    return w;
  }
  const ctx: Ctx = { world, r, say, emit, chronicle, speak, thopter: spawnThopter, party: spawnParty, worm: spawnWorm, fx, look, after };

  // ---- the cast library ---------------------------------------------------------------------------
  const etaWords = (s: number) => (s < 40 ? 'ESTIMATE THIRTY SECONDS' : s < 75 ? 'ESTIMATE ONE MINUTE' : `ESTIMATE ${['TWO', 'THREE', 'FOUR', 'FIVE'][Math.min(3, Math.round(s / 60) - 2)] ?? 'FIVE'} MINUTES`);
  const LIBRARY: SystemDef<Ctx>[] = [
    {
      id: 'worms', label: 'the worms', weight: 10, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'worms',
          step(dt) {
            const cr = w.crawlers.find((q) => q.id === w.op.crawler && q.state === 'working');
            if (!cr || w.op.alarm !== 0 || w.storm > 0.3 || w.worms.some((q) => q.state !== 'gone')) return;
            // The longer she works, the likelier; the director keeps them apart.
            const worked = w.t - cr.t0;
            if (worked < 25 || c.r() > dt * 0.02 * (worked / 60) || !w.director.want('worm', 0.65, 140)) return;
            const dir: 1 | -1 = cr.x > GW / 2 ? 1 : -1;
            const far = Math.min(0.72, cr.d + 0.06 + c.r() * 0.16);
            // Most come from far off, and the carryall makes it; a third come close and fast, and it is a race.
            const close = c.r() < 0.35;
            const wm = c.worm(cr.x - dir * (close ? 650 + c.r() * 350 : 1500 + c.r() * 800) * u, close ? cr.d + 0.04 : far, { dir, targetKind: 'crawler', crawler: cr.id, tx: cr.x, td: cr.d, ...(close ? { speed: (40 + c.r() * 12) * u, size: 1.2 + c.r() * 0.4 } : {}) });
            // The spotters see it when they see it: the alarm comes a little after the sign.
            const seen = 2 + c.r() * 12;
            w.op.alarm = -1;
            c.after(seen, () => {
              if (wm.state !== 'sign' || cr.state !== 'working') return;
              const dist = Math.hypot(wm.x - cr.x, (wm.d - cr.d) * 2600 * u);
              w.op.eta = dist / wm.speed;
              w.op.alarm = w.t;
              c.say(`WORMSIGN. ${etaWords(w.op.eta)}`, xOf(wm.x, wm.d), yOf(wm.d) - 40 * u, '#fcd9a0');
              c.emit('wormsign', xOf(wm.x, wm.d), yOf(wm.d), 0.7);
              c.look('wormsign', wm.x, wm.d, 1.5, 12, 7);
              c.speak(cr, pick(LINES.alarm, c.r));
              const sp = w.thopters.find((q) => q.role === 'spotter' && q.state === 'circle');
              if (sp) c.after(2, () => c.speak(sp, 'WORMSIGN! WORMSIGN!'));
            });
          },
          counts: () => ({ wormsign: w.worms.filter((q) => q.state === 'sign').length }),
        };
      },
    },
    {
      id: 'storm', label: 'the storms', weight: 5, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let rising = false;
        return {
          id: 'storm',
          step(dt) {
            if (w.storm <= 0 && !rising && w.t > 90 && w.director.want('storm', 0.55, 420)) {
              rising = true;
              until = w.t + 60 + c.r() * 60;
              w.stormDir = c.r() < 0.5 ? 1 : -1;
              w.stormFront = w.stormDir > 0 ? -GW * 0.6 : GW * 1.6;
              c.say('A STORM ON THE HORIZON, COMING THIS WAY', GW / 2, HY - 60 * u, '#e8c8a0');
              c.emit('storm', GW / 2, HY, 0.6);
              c.chronicle('A sandstorm came over the erg, and the sand ran white.');
              for (const th of w.thopters) if (th.role === 'spotter') c.after(3 + c.r() * 4, () => c.speak(th, pick(LINES.storm, c.r)));
              if (w.op.phase === 'working') w.op.alarm = w.t;
            }
            if (!rising) return;
            if (w.t < until) {
              w.storm = Math.min(1, w.storm + dt / 40);
              w.stormFront += w.stormDir * dt * 70 * u;
              w.wind += (w.stormDir * 40 - w.wind) * dt * 0.1;
              if (c.r() < dt * 0.4 * w.storm) {
                w.flash = 1;
                c.emit('static', GW / 2, HY, 0.15);
              }
              // In the thick of it, the storm is the only thing that happens; say so.
              if (w.storm > 0.5 && w.director.want('stormline', 0.1, 18)) {
                c.say(pick(['THE SAND RUNS WHITE OVER THE LEDGE', 'STATIC CRACKLES IN THE DUST', 'THE WIND SCREAMS. NOTHING CAN FLY IN THIS', 'THE WATCHERS CROUCH BEHIND THE ROCK', 'A DUNE WALKS PAST IN THE DARK', 'YOU CANNOT SEE YOUR HAND'], c.r), GW / 2, HY - 40 * u, '#e8c8a0');
                c.emit('gust', GW / 2, HY, 0.1);
              }
            } else {
              w.storm = Math.max(0, w.storm - dt / 50);
              w.stormFront += w.stormDir * dt * 90 * u;
              if (w.storm === 0) {
                rising = false;
                w.wind = (c.r() - 0.5) * 20;
                c.say('THE STORM PASSES, AND THE DUNES HAVE MOVED', GW / 2, HY - 40 * u, '#e8d8c0');
              }
            }
            // Anything flying in it may go down.
            for (const th of w.thopters) {
              if (th.state !== 'circle' && th.state !== 'cross') continue;
              if (w.storm > 0.6 && c.r() < dt * 0.012 && w.wrecks.length < 3 && w.director.want('spotterdown', 0.8, 600)) {
                th.state = 'falling';
                th.t0 = w.t;
                c.say(`${th.name} GOES DOWN IN THE STORM`, xOf(th.x, th.d), yOf(th.d) - th.alt * mOf(th.d), '#fca5a5');
                c.emit('crash', xOf(th.x, th.d), yOf(th.d), 0.9);
                c.chronicle(`${th.name} went down in the storm, somewhere on the south sand.`);
              }
            }
          },
          counts: () => ({ storm: w.storm > 0 ? 1 : 0 }),
        };
      },
    },
    {
      id: 'smugglers', label: 'smugglers', weight: 4, tags: ['visitors'],
      create: (c) => {
        const w = c.world;
        let lander: Thopter | null = null;
        let party: Party | null = null;
        let phase = 0;
        let t0 = 0;
        return {
          id: 'smugglers',
          step() {
            const night = w.day < 0.24 || w.day > 0.8;
            if (!lander) {
              if (!night || w.t < 60 || w.storm > 0.1 || !w.director.want('smugglers', 0.5, 480)) return;
              const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
              const d = 0.42 + c.r() * 0.2;
              const x = GW * (0.3 + c.r() * 0.4);
              lander = c.thopter('smuggler', entryX(dir, 200 * u), d, { dir, tx: x, td: d, state: 'cross', lamp: false, alt: 120 * u, name: pick(['NIGHTJAR', 'THE GREY GOOSE', 'NO NAME', 'LITTLE SISTER'], c.r) });
              lander.cx = x;
              party = c.party(x + (c.r() < 0.5 ? -1 : 1) * 700 * u, d + 0.04, x > lander.x ? 1 : -1, 4 + Math.floor(c.r() * 3), { at: lander.id });
              party.tx = x;
              phase = 0;
              t0 = w.t;
              c.say('A LANDER COMES IN LOW WITHOUT LIGHTS', xOf(lander.x, lander.d), yOf(lander.d) - 60 * u, '#c8c0d8');
              c.emit('smugglers', xOf(x, d), yOf(d), 0.5);
              return;
            }
            const age = w.t - t0;
            if (phase === 0 && lander.state === 'landed') {
              phase = 1;
              t0 = w.t;
            } else if (phase === 1 && party && party.state === 'meet') {
              phase = 2;
              t0 = w.t;
              c.say('SPICE FOR WATER, IN THE DARK', xOf(lander.x, lander.d), yOf(lander.d) - 50 * u, '#fcd9a0');
              c.emit('trade', xOf(lander.x, lander.d), yOf(lander.d), 0.4);
              c.look('trade', lander.x, lander.d, 1.9, 10, 5);
            } else if (phase === 2 && age > 25) {
              phase = 3;
              lander.state = 'takeoff';
              lander.t0 = w.t;
              lander.tx = entryX(lander.dir, 300 * u);
              if (party) {
                party.state = 'cross';
                party.tx = party.dir > 0 ? -300 * u : GW + 300 * u;
                party.dir = party.dir > 0 ? -1 : 1;
              }
              c.chronicle('Smugglers landed in the night and traded with the desert folk.');
            } else if (phase === 3 && lander.state === 'off') {
              lander = null;
              party = null;
            }
            // A patrol finds them: the lander runs early.
            const ld = lander;
            if (ld && phase < 3 && ld.state !== 'off' && w.thopters.some((q) => q.role === 'patrol' && q.state === 'cross' && Math.abs(q.x - ld.x) < 500 * u)) {
              phase = 3;
              ld.state = 'takeoff';
              ld.t0 = w.t;
              ld.tx = entryX(ld.dir, 300 * u);
              if (party) {
                party.state = 'crouch';
                party.t0 = w.t;
              }
              c.say('THE PATROL! THE LANDER RUNS FOR IT', xOf(ld.x, ld.d), yOf(ld.d) - 50 * u, '#fca5a5');
              c.emit('chase', xOf(ld.x, ld.d), yOf(ld.d), 0.7);
              c.chronicle('A patrol caught the smugglers at their trade; the lander ran for the dark.');
            }
          },
          counts: () => ({ smugglers: lander ? 1 : 0 }),
        };
      },
    },
    {
      id: 'patrol', label: 'the Company\'s patrols', weight: 4, tags: ['company'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'patrol',
          step() {
            if (w.t < 45 || w.storm > 0.2 || w.thopters.some((q) => q.role === 'patrol') || !w.director.want('patrol', 0.35, 200)) return;
            const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
            const d = 0.5 + c.r() * 0.3;
            const night = w.day < 0.25 || w.day > 0.78;
            for (let k = 0; k < 3; k++) {
              const th = c.thopter('patrol', entryX(dir, (200 + k * 140) * u), d + (k ? 0.03 : 0), { dir, tx: entryX(dir > 0 ? -1 : 1, 300 * u), td: d, lamp: night, alt: (140 + (k ? 30 : 0)) * u, name: `PATROL ${['ONE', 'TWO', 'THREE'][k]}` });
              if (k === 0) c.after(4, () => c.speak(th, pick(LINES.patrol, c.r)));
            }
            c.say(night ? 'A PATROL SWEEPS THE SAND WITH ITS LIGHTS' : 'A COMPANY PATROL CROSSES THE ERG', GW / 2, yOf(d) - 100 * u, '#c8d0e0');
            c.emit('patrol', GW / 2, yOf(d), 0.4);
          },
        };
      },
    },
    {
      id: 'riders', label: 'the riders', weight: 4, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        let party: Party | null = null;
        let worm: Worm | null = null;
        let phase = 0;
        return {
          id: 'riders',
          step() {
            const dawn = w.day > 0.23 && w.day < 0.34;
            if (!party) {
              if (!dawn || w.storm > 0.1 || w.worms.some((q) => q.state !== 'gone') || !w.director.want('riders', 0.75, 700)) return;
              const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
              const d = 0.5 + c.r() * 0.15;
              party = c.party(entryX(dir, 100 * u), d, dir, 5 + Math.floor(c.r() * 3), { tx: GW * (0.35 + c.r() * 0.3) });
              phase = 0;
              c.say('THE DESERT FOLK WALK OUT ONTO THE OPEN SAND AT DAWN', xOf(party.x, d), yOf(d) - 40 * u, '#fcd9a0');
              return;
            }
            if (phase === 0 && party.state === 'wait') {
              phase = 1;
              w.thumpers.push({ x: party.x + party.dir * 120 * u, d: party.d, t0: w.t, until: w.t + 60 });
              c.say('A THUMPER IS SET, AND BEATS', xOf(party.x, party.d), yOf(party.d) - 30 * u, '#efe6d2');
              c.emit('thumper', xOf(party.x, party.d), yOf(party.d), 0.4);
              const wdir: 1 | -1 = party.x > GW / 2 ? 1 : -1;
              worm = c.worm(party.x - wdir * 1500 * u, Math.min(0.9, party.d + 0.2), { dir: wdir, targetKind: 'thumper', tx: party.x + party.dir * 120 * u, td: party.d, riders: party.members.length, size: 1.1 + c.r() * 0.4, dur: 40 });
              c.look('riders', party.x, party.d, 1.5, 30, 8);
            } else if (phase === 1 && worm && worm.state === 'ridden') {
              phase = 2;
              party.state = 'mount';
              c.say('THEY TAKE THE WORM WITH THEIR HOOKS, AND RIDE IT', xOf(worm.x, worm.d), yOf(worm.d) - 80 * u, '#fcd9a0');
              c.emit('ride', xOf(worm.x, worm.d), yOf(worm.d), 0.9);
              c.chronicle('At dawn the desert folk called a worm, and rode it away south.');
            } else if (phase === 2 && (!worm || worm.state === 'gone')) {
              w.parties = w.parties.filter((q) => q !== party);
              party = null;
              worm = null;
            }
          },
        };
      },
    },
    {
      id: 'blow', label: 'spice blows', weight: 4, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'blow',
          step(dt) {
            if (w.blow) {
              const age = w.t - w.blow.t0;
              if (age > 18) {
                w.patches.push({ id: ids++, x: w.blow.x, d: w.blow.d, r: (160 + c.r() * 80) * u, spice: 1, rich: true });
                w.blow = null;
                return;
              }
              const k = 1 - age / 18;
              for (let q = 0; q < 3; q++) if (c.r() < k) c.fx(c.r() < 0.4 ? 'spice' : 'sand', w.blow.x + (c.r() - 0.5) * 40 * u, w.blow.d, 0, { vx: (c.r() - 0.5) * 60 * u, valt: (180 + c.r() * 160) * u * k, dur: 3 + c.r() * 2, r: (10 + c.r() * 14) * u });
              void dt;
              return;
            }
            if (w.t < 60 || w.storm > 0.1 || !w.director.want('blow', 0.55, 420)) return;
            const d = 0.22 + c.r() * 0.3;
            const x = GW * (0.15 + c.r() * 0.7);
            w.blow = { x, d, t0: w.t };
            c.say('A SPICE BLOW! THE SAND ERUPTS', xOf(x, d), yOf(d) - 90 * u * mOf(d), '#fcd9a0');
            c.emit('blow', xOf(x, d), yOf(d), 0.8);
            c.look('blow', x, d, 1.6, 12, 7);
            c.chronicle('A pre-spice mass blew, and left a rich new patch on the sand.');
          },
        };
      },
    },
    {
      id: 'devils', label: 'dust devils', weight: 5, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'devils',
          step(dt) {
            const heat = Math.max(0, 1 - Math.abs(w.day - 0.56) / 0.2);
            if (heat > 0.2 && w.storm < 0.1 && w.devils.length < 3 && c.r() < dt * 0.03 * heat) {
              const d = 0.2 + c.r() * 0.6;
              w.devils.push({ x: GW * (0.1 + c.r() * 0.8), d, t0: w.t, dur: 20 + c.r() * 25, h: (120 + c.r() * 160) * u, vx: (c.r() - 0.5) * 30 * u + w.wind });
              if (c.r() < 0.3) c.say('A DUST DEVIL WALKS THE SAND', GW / 2, yOf(d) - 60 * u, '#e8d8c0');
              c.emit('devil', GW / 2, yOf(d), 0.15);
            }
          },
        };
      },
    },
    {
      id: 'salvage', label: 'salvagers', weight: 4, tags: ['life'],
      create: (c) => {
        const w = c.world;
        let party: Party | null = null;
        return {
          id: 'salvage',
          step() {
            const night = w.day < 0.25 || w.day > 0.78;
            if (party) {
              if (!w.parties.includes(party)) party = null;
              return;
            }
            const wk = w.wrecks.find((q) => q.stripped < 1 && w.t - q.t0 > 60);
            if (!wk || !night || w.storm > 0.1 || !w.director.want('salvage', 0.4, 300)) return;
            const dir: 1 | -1 = wk.x > GW / 2 ? -1 : 1;
            party = c.party(entryX(dir > 0 ? -1 : 1, 100 * u), wk.d + 0.02, dir, 4 + Math.floor(c.r() * 3), { tx: wk.x, at: wk.id });
            c.say('THE FOLK COME FOR THE WRECK IN THE DARK', xOf(wk.x, wk.d), yOf(wk.d) - 40 * u, '#e8d8c0');
            c.emit('salvage', xOf(wk.x, wk.d), yOf(wk.d), 0.4);
          },
        };
      },
    },
    {
      id: 'oldone', label: 'the old one', weight: 2, tags: ['legendary'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'oldone',
          step() {
            if (w.oldOne) {
              if (w.t - w.oldOne.t0 > w.oldOne.dur) w.oldOne = null;
              return;
            }
            if (w.storm > 0.1 || w.t < 300 || !w.director.want('oldone', 0.95, 1500)) return;
            w.oldOne = { x: GW * (0.3 + c.r() * 0.4), t0: w.t, dur: 70 };
            c.say('THE OLD ONE RISES AT THE HORIZON, A WORM THE SIZE OF A HILL', GW / 2, HY - 60 * u, '#fcd9a0');
            c.emit('oldone', GW / 2, HY, 1);
            c.look('oldone', w.oldOne.x, 0.96, 1.4, 30, 9);
            c.chronicle('The old one rose at the horizon and lay in the sun for a long minute, and every engine stopped.');
            for (const cr of w.crawlers) if (cr.state === 'working') c.speak(cr, 'SHUT DOWN. SHUT EVERYTHING DOWN.');
          },
        };
      },
    },
  ];
  const RULE = { total: [3, 5] as [number, number], quota: { weather: [0, 2] as [number, number], threat: [1, 1] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE, ['worms']);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);

  // ---- the sand: patches to work, the watchers on the ledge -----------------------------------------
  for (let k = 0; k < 4; k++) world.patches.push({ id: ids++, x: GW * (0.15 + r() * 0.7), d: 0.2 + r() * 0.3, r: (120 + r() * 90) * u, spice: 0.5 + r() * 0.5, rich: r() < 0.3 });
  const nWatch = phone ? 2 : 3;
  for (let k = 0; k < nWatch; k++) world.watchers.push({ x: GW * (side > 0 ? 0.62 + k * 0.1 : 0.18 + k * 0.1) + r() * 30 * u, seed: Math.floor(r() * 1e6), glass: k === 0 ? 1 : 0 });

  // ---- the harvest ------------------------------------------------------------------------------------
  const op = world.op;
  const crawlerOf = () => world.crawlers.find((q) => q.id === op.crawler);
  const carryallOf = () => world.carryalls.find((q) => q.id === op.carryall);
  const patchOf = () => world.patches.find((q) => q.id === op.patch);
  const CRUISE = 230 * u;
  const SLING = 70 * u;
  let crawlerNo = Math.floor(r() * CRAWLER_NAMES.length);
  function harvest(dt: number) {
    const age = world.t - op.t0;
    if (op.phase === 'between') {
      if (age < 18 + (phone ? 10 : 0)) return;
      if (world.storm > 0.5 || world.oldOne) return;
      // The next patch: the richest still worth working; or a new one found by the spotters.
      let patch = [...world.patches].sort((a, b) => b.spice - a.spice)[0];
      if (!patch || patch.spice < 0.25) {
        patch = { id: ids++, x: GW * (0.15 + r() * 0.7), d: 0.2 + r() * 0.3, r: (120 + r() * 90) * u, spice: 0.6 + r() * 0.4, rich: r() < 0.3 };
        world.patches.push(patch);
        say('THE SPOTTERS FIND SPICE SIGN ON THE SAND', xOf(patch.x, patch.d), yOf(patch.d) - 40 * u, '#fcd9a0');
      }
      world.patches = world.patches.filter((q) => q.spice > 0.08 || q === patch);
      const dir: 1 | -1 = patch.x > GW / 2 ? 1 : -1;
      const name = CRAWLER_NAMES[crawlerNo++ % CRAWLER_NAMES.length];
      const cr: Crawler = { id: ids++, name, x: entryX(dir, 300 * u), d: patch.d, alt: CRUISE - SLING, dir, state: 'slung', t0: world.t, hold: 0, crew: 8 + Math.floor(r() * 8), seed: Math.floor(r() * 1e6), line: '', lineT: -99 };
      const ca: Carryall = { id: ids++, name: pick(CARRYALL_NAMES), x: cr.x, d: patch.d, alt: CRUISE, dir, state: 'inbound', t0: world.t, crawler: cr.id, seed: Math.floor(r() * 1e6), tx: patch.x, td: patch.d, talt: CRUISE, line: '', lineT: -99 };
      world.crawlers.push(cr);
      world.carryalls.push(ca);
      const nSpot = phone ? 1 : 2;
      for (let k = 0; k < nSpot; k++) spawnThopter('spotter', entryX(dir, (500 + k * 200) * u), patch.d, { dir, state: 'cross', tx: patch.x + (k ? -1 : 1) * 300 * u, td: patch.d, cx: patch.x, cd: patch.d, cr: (220 + k * 120) * u, alt: (110 + k * 40) * u });
      Object.assign(op, { phase: 'inbound', t0: world.t, crawler: cr.id, carryall: ca.id, patch: patch.id, alarm: 0, eta: 0 });
      say(`${ca.name} BRINGS ${name} OUT TO THE SPICE`, xOf(patch.x, patch.d), yOf(patch.d) - 120 * u * mOf(patch.d), '#efe6d2');
      emit('inbound', xOf(patch.x, patch.d), yOf(patch.d), 0.3);
      return;
    }
    const cr = crawlerOf();
    const ca = carryallOf();
    const patch = patchOf();
    if (!cr || !ca || !patch) {
      Object.assign(op, { phase: 'between', t0: world.t });
      return;
    }
    if (op.phase === 'inbound') {
      if (ca.state === 'standoff') {
        cr.state = 'working';
        cr.t0 = world.t;
        cr.alt = 0;
        Object.assign(op, { phase: 'working', t0: world.t });
        for (const th of world.thopters) if (th.role === 'spotter' && th.state === 'cross') th.state = 'circle';
        say(`${cr.name} IS DOWN ON THE SAND, AND WORKING`, xOf(cr.x, cr.d), yOf(cr.d) - 60 * u * mOf(cr.d), '#efe6d2');
        emit('working', xOf(cr.x, cr.d), yOf(cr.d), 0.4);
        look('working', cr.x, cr.d, 1.7, 10, 4);
      }
    } else if (op.phase === 'working') {
      // She crawls across the patch and back; the hold fills; the patch thins.
      const rate = (patch.rich ? 1.5 : 1) / (110 + (phone ? 0 : 50));
      cr.hold = Math.min(1, cr.hold + dt * rate);
      patch.spice = Math.max(0, patch.spice - dt * rate * 0.6);
      cr.x += cr.dir * dt * 6 * u;
      if (Math.abs(cr.x - patch.x) > patch.r * 0.8) cr.dir = cr.x > patch.x ? -1 : 1;
      const m = mOf(cr.d);
      if (r() < dt * 14) fx('dust', cr.x - cr.dir * 70 * u, cr.d + (r() - 0.5) * 0.01, 0, { vx: -cr.dir * 10 * u + world.wind * 0.5, valt: (8 + r() * 10) * u, dur: 4 + r() * 3, r: (14 + r() * 10) * u * (0.5 + m) });
      if (r() < dt * 3) fx('spice', cr.x + cr.dir * 60 * u, cr.d, 10 * u, { vx: world.wind * 0.3, valt: 14 * u, dur: 3, r: 8 * u });
      if (r() < dt * 2) fx('smoke', cr.x - cr.dir * 62 * u, cr.d, 70 * u, { vx: world.wind * 0.4, valt: 20 * u, dur: 4, r: 7 * u, color: '#5a5048' });
      if (cr.hold >= 1 || (op.alarm > 0 && ca.state === 'standoff') || patch.spice <= 0.02) {
        Object.assign(op, { phase: 'calling', t0: world.t });
        ca.state = 'lift';
        ca.t0 = world.t;
        ca.tx = cr.x;
        ca.td = cr.d;
        ca.talt = SLING;
        if (op.alarm <= 0) {
          say(`${cr.name} IS FULL. ${ca.name} COMES IN FOR THE LIFT`, xOf(cr.x, cr.d), yOf(cr.d) - 60 * u * m, '#efe6d2');
          emit('calling', xOf(cr.x, cr.d), yOf(cr.d), 0.3);
        } else speak(ca, 'COMING IN. HOLD ON.');
      }
    } else if (op.phase === 'calling') {
      cr.x += cr.dir * dt * 3 * u;
      if (r() < dt * 6) fx('dust', cr.x - cr.dir * 70 * u, cr.d, 0, { vx: -cr.dir * 8 * u + world.wind * 0.5, valt: 8 * u, dur: 3, r: 14 * u });
      ca.tx = cr.x;
      if (ca.state === 'rise') {
        cr.state = 'lifting';
        cr.t0 = world.t;
        Object.assign(op, { phase: 'lifting', t0: world.t });
        if (op.alarm > 0) {
          speak(ca, pick(LINES.lifted));
          emit('lifted', xOf(cr.x, cr.d), yOf(cr.d), 0.6);
        }
      }
    } else if (op.phase === 'lifting') {
      cr.alt = ca.alt - SLING;
      cr.x = ca.x;
      cr.d = ca.d;
      if (ca.state === 'away') {
        Object.assign(op, { phase: 'away', t0: world.t });
        const tonnes = Math.round(cr.hold * (280 + r() * 160));
        world.tonnes += tonnes;
        say(`${cr.name} LIFTED AWAY WITH ${tonnes} TONNES OF SPICE`, xOf(cr.x, cr.d), yOf(cr.d) - (cr.alt + 60 * u) * mOf(cr.d), '#fcd9a0');
        emit('lifted', xOf(cr.x, cr.d), yOf(cr.d), 0.4);
        chronicle(`${titled(cr.name)} brought in ${tonnes} tonnes of spice${op.alarm > 0 ? ', with the worm a minute behind her' : ''}.`);
        for (const th of world.thopters) if (th.role === 'spotter') Object.assign(th, { state: 'cross', tx: entryX(th.dir, 400 * u), t0: world.t });
      }
    } else if (op.phase === 'away') {
      cr.alt = ca.alt - SLING;
      cr.x = ca.x;
      cr.d = ca.d;
      if (ca.state === 'off') {
        world.crawlers = world.crawlers.filter((q) => q !== cr);
        world.carryalls = world.carryalls.filter((q) => q !== ca);
        Object.assign(op, { phase: 'between', t0: world.t, crawler: -1, carryall: -1, patch: -1, alarm: 0 });
      }
    }
  }
  const titled = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

  // ---- the machines in the air ------------------------------------------------------------------------
  const toward = (o: { x: number; d: number; alt?: number }, tx: number, td: number, talt: number, speed: number, dt: number) => {
    const dx = tx - o.x;
    const dd = (td - o.d) * 2600 * u;
    const da = o.alt === undefined ? 0 : talt - o.alt;
    const dist = Math.hypot(dx, dd, da);
    const step = Math.min(dist, speed * dt);
    if (dist < 1e-3) return 0;
    o.x += (dx / dist) * step;
    o.d += ((dd / dist) * step) / (2600 * u);
    if (o.alt !== undefined) o.alt += (da / dist) * step;
    return dist - step;
  };
  let hooking = 0;
  function carryalls(dt: number) {
    for (const ca of world.carryalls) {
      const age = world.t - ca.t0;
      const speed = (110 + (op.alarm > 0 ? 60 : 0)) * u;
      if (ca.state === 'inbound') {
        ca.dir = ca.tx > ca.x ? 1 : -1;
        const left = toward(ca, ca.tx, ca.td, CRUISE, speed, dt);
        if (left < 4 * u) {
          ca.state = 'lower';
          ca.t0 = world.t;
        }
      } else if (ca.state === 'lower') {
        ca.alt = Math.max(SLING, CRUISE - (CRUISE - SLING) * Math.min(1, age / 7));
        if (r() < dt * 10) fx('dust', ca.x + (r() - 0.5) * 160 * u, ca.d, 0, { vx: (r() - 0.5) * 40 * u, valt: 12 * u, dur: 2.5, r: 16 * u });
        if (age > 8) {
          ca.state = 'standoff';
          ca.t0 = world.t;
          ca.tx = ca.x + (ca.x > GW / 2 ? -1 : 1) * 1000 * u;
          ca.td = Math.max(0.15, ca.d - 0.08);
          ca.talt = CRUISE;
          after(6, () => speak(ca, pick(LINES.standoff)));
        }
      } else if (ca.state === 'standoff') {
        ca.dir = ca.tx > ca.x ? 1 : -1;
        const left = toward(ca, ca.tx + Math.sin(world.t * 0.15) * 80 * u, ca.td, CRUISE + Math.sin(world.t * 0.2) * 20 * u, 70 * u, dt);
        void left;
      } else if (ca.state === 'lift') {
        // Straight in and down to her; then the hooks go on (that takes a while), and up.
        ca.dir = ca.tx > ca.x ? 1 : -1;
        const left = toward(ca, ca.tx, ca.td, SLING, speed, dt);
        if (left < 6 * u) {
          hooking += dt;
          if (r() < dt * 8) fx('dust', ca.x + (r() - 0.5) * 160 * u, ca.d, 0, { vx: (r() - 0.5) * 40 * u, valt: 12 * u, dur: 2.5, r: 16 * u });
          if (hooking > (op.alarm > 0 ? 9 : 11)) {
            hooking = 0;
            ca.state = 'rise';
            ca.t0 = world.t;
          }
        }
      } else if (ca.state === 'rise') {
        ca.alt = Math.min(CRUISE, ca.alt + dt * 26 * u);
        if (r() < dt * 12) fx('dust', ca.x + (r() - 0.5) * 180 * u, ca.d, 0, { vx: (r() - 0.5) * 50 * u, valt: 14 * u, dur: 2.5, r: 18 * u });
        if (ca.alt >= CRUISE - 1) {
          ca.state = 'away';
          ca.t0 = world.t;
          ca.tx = entryX(ca.dir, 400 * u);
        }
      } else if (ca.state === 'away') {
        ca.dir = ca.tx > ca.x ? 1 : -1;
        const left = toward(ca, ca.tx, ca.td, CRUISE, speed, dt);
        if (left < 4 * u) ca.state = 'off';
      }
    }
  }
  function thopters(dt: number) {
    for (const th of world.thopters) {
      const age = world.t - th.t0;
      th.beat += dt * (th.state === 'landed' || th.state === 'wreck' ? 0 : 22);
      if (th.state === 'cross') {
        th.dir = th.tx > th.x ? 1 : -1;
        const left = toward(th, th.tx, th.td, th.alt, th.speed, dt);
        if (left < 4 * u) {
          if (th.role === 'spotter' && op.phase !== 'away' && op.phase !== 'between') th.state = 'circle';
          else if (th.role === 'smuggler') {
            th.state = 'land';
            th.t0 = world.t;
          } else th.state = 'off';
        }
      } else if (th.state === 'circle') {
        const cr = crawlerOf();
        if (cr) {
          th.cx = cr.x;
          th.cd = cr.d;
        }
        th.phase += (dt * th.speed) / th.cr;
        const nx = th.cx + Math.cos(th.phase) * th.cr;
        const nd = th.cd + Math.sin(th.phase) * 0.06;
        th.dir = nx > th.x ? 1 : -1;
        th.x = nx;
        th.d = Math.max(0.05, Math.min(0.95, nd));
        th.alt = (120 + Math.sin(th.phase * 0.5) * 30) * u;
        if (world.storm > 0.4 && th.role === 'spotter') {
          Object.assign(th, { state: 'cross', tx: entryX(th.dir, 400 * u), t0: world.t });
        }
      } else if (th.state === 'land') {
        th.alt = Math.max(0, th.alt - dt * 40 * u);
        if (th.alt <= 0) {
          th.state = 'landed';
          th.t0 = world.t;
        }
      } else if (th.state === 'takeoff') {
        th.alt = Math.min(150 * u, th.alt + dt * 50 * u);
        if (th.alt >= 150 * u) {
          th.state = 'cross';
          th.t0 = world.t;
        }
      } else if (th.state === 'falling') {
        th.alt = Math.max(0, th.alt - dt * (30 + age * 25) * u);
        th.x += th.dir * dt * th.speed * 0.5;
        if (r() < dt * 10) fx('smoke', th.x, th.d, th.alt, { vx: world.wind * 0.3, valt: 10 * u, dur: 3, r: 8 * u, color: '#3a3430' });
        if (th.alt <= 0) {
          th.state = 'wreck';
          th.t0 = world.t;
          world.wrecks.push({ id: ids++, kind: 'thopter', x: th.x, d: th.d, t0: world.t, smoke: 1, stripped: 0, seed: th.seed });
          for (let k = 0; k < 12; k++) fx(k < 6 ? 'fire' : 'sand', th.x + (r() - 0.5) * 40 * u, th.d, 0, { vx: (r() - 0.5) * 60 * u, valt: (20 + r() * 60) * u, dur: 1.5 + r(), r: (8 + r() * 10) * u });
          fx('flash', th.x, th.d, 10 * u, { dur: 0.5, r: 60 * u });
          emit('crash', xOf(th.x, th.d), yOf(th.d), 0.8);
        }
      }
    }
    world.thopters = world.thopters.filter((th) => th.state !== 'off' && !(th.state === 'wreck' && world.t - th.t0 > 2));
  }

  // ---- the worms ------------------------------------------------------------------------------------
  function worms(dt: number) {
    for (const wm of world.worms) {
      const age = world.t - wm.t0;
      if (wm.state === 'sign') {
        wm.k = Math.min(1, age / 6);
        if (wm.targetKind === 'crawler') {
          const cr = world.crawlers.find((q) => q.id === wm.crawler);
          if (cr && cr.state === 'working') {
            wm.tx = cr.x;
            wm.td = cr.d;
          }
        }
        // A thumper beating nearer draws it off.
        const th = world.thumpers.find((q) => world.t < q.until);
        if (th && wm.targetKind !== 'thumper' && Math.hypot(th.x - wm.x, (th.d - wm.d) * 2600 * u) < Math.hypot(wm.tx - wm.x, (wm.td - wm.d) * 2600 * u) * 1.2) {
          wm.targetKind = 'thumper';
          wm.tx = th.x;
          wm.td = th.d;
          wm.crawler = -1;
          say('THE WORM TURNS FOR THE THUMPER', xOf(th.x, th.d), yOf(th.d) - 30 * u, '#fcd9a0');
          emit('turned', xOf(th.x, th.d), yOf(th.d), 0.5);
        }
        wm.dir = wm.tx > wm.x ? 1 : -1;
        const left = toward(wm, wm.tx, wm.td, 0, wm.speed * (1 + wm.k * 0.3), dt);
        // The sand it breaks as it comes.
        if (r() < dt * 10) fx('sand', wm.x - wm.dir * 60 * u * wm.size, wm.d + (r() - 0.5) * 0.01, 0, { vx: -wm.dir * 20 * u + (r() - 0.5) * 30 * u, valt: (20 + r() * 30) * u, dur: 2.5, r: (10 + r() * 8) * u * wm.size });
        if (wm.targetKind === 'crawler') {
          const cr = world.crawlers.find((q) => q.id === wm.crawler);
          op.eta = left / wm.speed;
          if (cr && cr.state === 'working' && left < 260 * u && r() < dt * 0.6) speak(cr, pick(LINES.late));
        }
        if (wm.targetKind === 'none' && left < 4 * u) {
          wm.state = 'surface';
          wm.t0 = world.t;
          wm.x = wm.tx;
          wm.d = wm.td;
        } else if (left < 30 * u) {
          wm.x = wm.tx;
          wm.d = wm.td;
          wm.t0 = world.t;
          if (wm.riders > 0) {
            wm.state = 'ridden';
            wm.dir = wm.x > GW / 2 ? -1 : 1;
          } else {
            wm.state = 'strike';
            const cr = world.crawlers.find((q) => q.id === wm.crawler);
            const caught = cr && (cr.state === 'working' || (cr.state === 'lifting' && cr.alt < 50 * u));
            emit('strike', xOf(wm.x, wm.d), yOf(wm.d), 1);
            look('strike', wm.x, wm.d, 1.8, 10, 9);
            world.flash = 0.3;
            if (caught && cr) {
              cr.state = 'lost';
              cr.t0 = world.t;
              const saved = world.thopters.some((q) => q.role === 'spotter' && q.state === 'circle') && r() < 0.55;
              const dead = saved ? Math.floor(cr.crew * (0.2 + r() * 0.4)) : cr.crew;
              world.lost++;
              say(`THE WORM TAKES ${cr.name}`, xOf(wm.x, wm.d), yOf(wm.d) - 160 * u * mOf(wm.d), '#fca5a5');
              chronicle(saved ? `The worm took ${titled(cr.name)}; the spotters lifted ${cr.crew - dead} of her crew of ${cr.crew} off the sand first.` : `The worm took ${titled(cr.name)} with all her crew of ${cr.crew}.`);
              speak(cr, pick(LINES.lost));
              const ca = carryallOf();
              if (ca) {
                ca.state = 'away';
                ca.t0 = world.t;
                ca.tx = entryX(ca.dir, 400 * u);
                after(3, () => speak(ca, 'WE WERE TOO LATE. WE WERE TOO LATE.'));
              }
              for (const th of world.thopters) if (th.role === 'spotter') Object.assign(th, { state: 'cross', tx: entryX(th.dir, 400 * u), t0: world.t });
              Object.assign(op, { phase: 'between', t0: world.t, crawler: -1, carryall: -1, patch: -1, alarm: 0 });
            } else {
              say(wm.targetKind === 'thumper' ? 'THE WORM TAKES THE THUMPER, AND THE SAND' : 'THE WORM TAKES ONLY SAND', xOf(wm.x, wm.d), yOf(wm.d) - 140 * u * mOf(wm.d), '#fcd9a0');
              if (wm.targetKind === 'crawler') chronicle('The carryall lifted her clear with the worm a minute behind; the worm took only sand.');
              world.thumpers = world.thumpers.filter((q) => Math.hypot(q.x - wm.x, (q.d - wm.d) * 2600 * u) > 200 * u);
            }
          }
        }
      } else if (wm.state === 'strike') {
        wm.k = Math.min(1, age / 3);
        const m = mOf(wm.d);
        if (r() < dt * 30 * (1 - wm.k * 0.5)) fx('sand', wm.x + (r() - 0.5) * 220 * u * wm.size, wm.d + (r() - 0.5) * 0.02, 0, { vx: (r() - 0.5) * 120 * u, valt: (60 + r() * 160) * u, dur: 2 + r() * 2, r: (12 + r() * 18) * u * (0.5 + m) });
        if (age > 5) {
          wm.state = 'submerge';
          wm.t0 = world.t;
          world.craters.push({ x: wm.x, d: wm.d, t0: world.t, size: wm.size });
          const cr = world.crawlers.find((q) => q.id === wm.crawler && q.state === 'lost');
          if (cr) world.crawlers = world.crawlers.filter((q) => q !== cr);
        }
      } else if (wm.state === 'surface' || wm.state === 'ridden') {
        wm.k = Math.min(1, age / wm.dur);
        if (wm.state === 'ridden') {
          wm.x += wm.dir * dt * wm.speed * 1.6;
          wm.d = Math.min(0.95, wm.d + dt * 0.004);
          if (r() < dt * 16) fx('sand', wm.x - wm.dir * 200 * u * wm.size, wm.d, 0, { vx: -wm.dir * 30 * u, valt: (30 + r() * 50) * u, dur: 2, r: (14 + r() * 10) * u });
          if (wm.x < -600 * u || wm.x > GW + 600 * u) wm.state = 'gone';
        } else {
          wm.x += wm.dir * dt * wm.speed * 0.8;
          if (r() < dt * 10) fx('sand', wm.x + (r() - 0.5) * 300 * u, wm.d, 0, { vx: (r() - 0.5) * 30 * u, valt: (30 + r() * 40) * u, dur: 2, r: 12 * u });
          if (age > wm.dur) {
            wm.state = 'submerge';
            wm.t0 = world.t;
          }
        }
      } else if (wm.state === 'submerge') {
        wm.k = Math.min(1, age / 8);
        if (age > 8) wm.state = 'gone';
      }
    }
    world.worms = world.worms.filter((wm) => wm.state !== 'gone');
    world.craters = world.craters.filter((c) => world.t - c.t0 < 600);
  }

  // ---- the folk ------------------------------------------------------------------------------------
  let nextParty = 30 + r() * 30;
  function parties(dt: number) {
    const night = world.day < 0.27 || world.day > 0.76;
    if (world.t > nextParty) {
      nextParty = world.t + (night ? 60 : 160) / traffic + r() * 60;
      if (world.parties.length < (phone ? 1 : 2) && world.storm < 0.3) {
        const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
        const d = 0.08 + r() * 0.3;
        spawnParty(entryX(dir, 150 * u), d, dir, 3 + Math.floor(r() * 5));
        if (r() < 0.4) say(night ? 'THE DESERT FOLK CROSS THE NEAR SAND BY NIGHT' : 'A LINE OF WALKERS, WITHOUT RHYTHM, ON THE DUNES', xOf(GW / 2, d), yOf(d) - 50 * u, '#e8d8c0');
        emit('party', GW / 2, yOf(d), 0.15);
      }
    }
    for (const p of world.parties) {
      const age = world.t - p.t0;
      // Aircraft near: crouch and be still.
      const craft = world.thopters.find((q) => (q.role === 'patrol' || q.role === 'spotter') && q.state !== 'landed' && q.state !== 'wreck' && Math.abs(q.x - p.x) < 420 * u && Math.abs(q.d - p.d) < 0.2);
      if (craft && p.state === 'cross') {
        p.state = 'crouch';
        p.t0 = world.t;
        if (r() < 0.5) speak(p, pick(['DOWN. STILL.', 'LET IT PASS', 'NOBODY MOVES'], r));
      }
      if (p.state === 'crouch') {
        if (!craft && age > 6) {
          p.state = 'cross';
          p.t0 = world.t;
        }
        continue;
      }
      if (p.state === 'cross') {
        const dx = p.tx - p.x;
        p.dir = dx > 0 ? 1 : -1;
        const step = Math.min(Math.abs(dx), p.speed * dt);
        p.x += p.dir * step;
        for (const m of p.members) m.ph += dt * (3 + Math.sin(world.t * 1.7 + m.seed) * 2.2);
        if (Math.abs(dx) < 4 * u) {
          if (p.at >= 0) {
            const wk = world.wrecks.find((q) => q.id === p.at);
            const th = world.thopters.find((q) => q.id === p.at);
            if (wk) {
              p.state = 'salvage';
              p.t0 = world.t;
            } else if (th) {
              p.state = 'meet';
              p.t0 = world.t;
            } else p.state = 'wait';
          } else if (p.x > -100 * u && p.x < GW + 100 * u) {
            p.state = 'wait';
            p.t0 = world.t;
          } else p.state = 'wait';
        }
      } else if (p.state === 'salvage') {
        const wk = world.wrecks.find((q) => q.id === p.at);
        if (wk) {
          wk.stripped = Math.min(1, wk.stripped + dt / 50);
          if (r() < dt * 2) fx('glint', wk.x + (r() - 0.5) * 60 * u, wk.d, 10 * u, { dur: 0.6, r: 3 * u, color: '#fff0c0' });
          if (wk.stripped >= 1) {
            chronicle('The desert folk stripped the wreck by night and left nothing but the frame.');
            p.state = 'cross';
            p.t0 = world.t;
            p.tx = p.dir > 0 ? -300 * u : GW + 300 * u;
            p.dir = p.dir > 0 ? -1 : 1;
          }
        } else p.state = 'cross';
      } else if (p.state === 'wait' || p.state === 'meet' || p.state === 'mount') {
        for (const m of p.members) m.ph += dt * 0.5;
        if (p.state === 'wait' && p.at < 0 && (p.x < -50 * u || p.x > GW + 50 * u)) p.state = 'cross';
        if (p.state === 'wait' && p.at < 0 && age > 90) {
          p.state = 'cross';
          p.tx = p.dir > 0 ? GW + 300 * u : -300 * u;
        }
      }
    }
    world.parties = world.parties.filter((p) => !(p.state === 'cross' && (p.x < -250 * u || p.x > GW + 250 * u) && Math.abs(p.tx - p.x) < 60 * u));
  }

  // ---- the weather and the small things --------------------------------------------------------------
  function weather(dt: number) {
    world.flash = Math.max(0, world.flash - dt * 3);
    world.wind += ((Math.sin(world.t * 0.05) * 8 + Math.sin(world.t * 0.013) * 6) * (1 - world.storm) + (world.storm > 0 ? world.stormDir * 30 * world.storm : 0) - world.wind) * dt * 0.2;
    world.dust = Math.max(0, world.dust + (world.storm * 0.6 - world.dust) * dt * 0.1);
    for (const dv of world.devils) dv.x += dv.vx * dt;
    world.devils = world.devils.filter((dv) => world.t - dv.t0 < dv.dur);
    world.thumpers = world.thumpers.filter((th) => world.t < th.until);
    for (const wk of world.wrecks) {
      wk.smoke = Math.max(0, wk.smoke - dt / 240);
      if (wk.smoke > 0 && r() < dt * 4 * wk.smoke) fx('smoke', wk.x + (r() - 0.5) * 20 * u, wk.d, 10 * u, { vx: world.wind * 0.4, valt: (8 + r() * 8) * u, dur: 5, r: (6 + r() * 6) * u, color: '#3a3430' });
    }
    // The old one at the horizon throws sand like weather.
    if (world.oldOne && r() < dt * 6) fx('sand', world.oldOne.x + (r() - 0.5) * 600 * u, 0.96, 0, { vx: (r() - 0.5) * 20 * u, valt: (40 + r() * 60) * u, dur: 4, r: 30 * u });
    for (const f of world.fx) {
      f.x += f.vx * dt;
      f.alt += f.valt * dt;
      f.valt -= dt * (f.kind === 'sand' || f.kind === 'spice' ? 60 : f.kind === 'dust' ? -4 : 0) * u;
      if (f.alt < 0 && (f.kind === 'sand' || f.kind === 'spice')) f.alt = 0;
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
  }

  // ---- the radio ------------------------------------------------------------------------------------
  let nextVoice = 6;
  function voices(dt: number) {
    nextVoice -= dt;
    if (nextVoice > 0) return;
    nextVoice = 5 + r() * 7;
    const cr = crawlerOf();
    const ca = carryallOf();
    const spot = world.thopters.filter((q) => q.role === 'spotter' && q.state === 'circle' && world.t - q.lineT > 12);
    const roll = r();
    if (world.storm > 0.2) {
      const who = [cr, ca, ...world.thopters.filter((q) => q.role === 'spotter')].filter((q): q is Crawler | Carryall | Thopter => !!q && world.t - q.lineT > 10);
      if (who.length) speak(pick(who), pick(LINES.storm));
      return;
    }
    if (cr && cr.state === 'working' && world.t - cr.lineT > 12 && roll < 0.4) speak(cr, op.alarm > 0 ? pick(LINES.alarm) : cr.hold > 0.6 ? pick(['SEVENTY PERCENT AND CLIMBING', 'NEARLY FULL', 'CALL THE CARRYALL IN TEN']) : pick(LINES.working));
    else if (spot.length && roll < 0.75) speak(pick(spot), op.alarm > 0 ? pick(LINES.alarm) : pick(LINES.spotter));
    else if (ca && ca.state === 'standoff' && world.t - ca.lineT > 12) speak(ca, pick(LINES.standoff));
    else {
      const pt = world.thopters.find((q) => q.role === 'patrol' && world.t - q.lineT > 12);
      if (pt) speak(pt, pick(LINES.patrol));
    }
  }

  // ---- the hours of the sand: what every day brings ------------------------------------------------
  const RITES: [number, string, string][] = [
    [0.255, 'THE SUN COMES UP RED OVER THE ERG', '#fcd9a0'],
    [0.5, 'NOON. THE SAND IS WHITE, AND NOTHING MOVES THAT CAN HELP IT', '#efe6d2'],
    [0.735, 'THE SUN GOES DOWN, AND THE SAND COOLS', '#fcd9a0'],
    [0.8, 'THE TWO MOONS RISE', '#c8c0d8'],
    [0.06, 'THE DEEP OF THE NIGHT. THE SAND TICKS AS IT COOLS', '#c8c0d8'],
  ];
  const rited = new Set<string>();
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
    // The wind, when it rises, lifts the sand off every crest.
    if (Math.abs(world.wind) > 24 && world.storm < 0.2 && world.director.want('gust', 0.15, 80)) {
      say('THE WIND LIFTS THE SAND OFF THE CRESTS', GW / 2, yOf(0.3) - 40 * u, '#e8d8c0');
      emit('gust', GW / 2, yOf(0.3), 0.1);
    }
    // The crawler's hold, called in quarters.
    const cr = crawlerOf();
    if (cr && cr.state === 'working') {
      const q = Math.floor(cr.hold * 4);
      if (q > 0 && q < 4 && !rited.has(`hold:${cr.id}:${q}`)) {
        rited.add(`hold:${cr.id}:${q}`);
        emit('hold', xOf(cr.x, cr.d), yOf(cr.d), 0.05);
      }
    }
  }

  // ---- a touch -------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 3 || y > NY || y < HY + 6 * u) return null;
    lastNudge = world.t;
    // Back from the picture to the sand: d from y, then x.
    const k = (y - HY) / (NY - HY);
    const d = 1 - Math.sqrt(Math.max(0, Math.min(1, k)));
    const gx = GW / 2 + (x - GW / 2) / (0.35 + 0.65 * Math.pow(1 - d, 2));
    world.thumpers.push({ x: gx, d, t0: world.t, until: world.t + 50 });
    emit('thumper', x, y, 0.3);
    const wm = world.worms.find((q) => q.state === 'sign');
    if (wm) {
      wm.targetKind = 'thumper';
      wm.tx = gx;
      wm.td = d;
      wm.crawler = -1;
      say('A THUMPER, SET. THE WORM TURNS FOR IT', x, y - 30 * u, '#fcd9a0');
      return 'A THUMPER, SET. THE WORM TURNS FOR IT';
    }
    if (world.castIds.includes('worms') && !world.worms.length && world.director.want('thumperworm', 0.4, 90)) {
      const dir: 1 | -1 = gx > GW / 2 ? 1 : -1;
      spawnWorm(gx - dir * 1200 * u, Math.min(0.92, d + 0.2), { dir, targetKind: 'thumper', tx: gx, td: d });
      say('A THUMPER, SET AND BEATING. SOMETHING COMES', x, y - 30 * u, '#fcd9a0');
      return 'A THUMPER, SET AND BEATING. SOMETHING COMES';
    }
    say('A THUMPER, SET AND BEATING ON THE SAND', x, y - 30 * u, '#efe6d2');
    return 'A THUMPER, SET AND BEATING ON THE SAND';
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
    weather(dt);
    harvest(dt);
    carryalls(dt);
    thopters(dt);
    worms(dt);
    parties(dt);
    for (const s of systems) s.step?.(dt);
    voices(dt);
    rites();
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
