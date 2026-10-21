/**
 * # Windtrap: a hold of the desert folk cut into a cliff, seen in cutaway, living by its water.
 *
 * On screen, at a glance: a cliff rising from the sand, its inside laid open like a hive:
 * chambers off a shaft and galleries, lamps in them, people at their work; the windtrap tower
 * on the cliff top breathing; the cistern at the bottom with its water line; the great gate
 * low in the cliff face with its path down to the sand; and the open desert beyond, to the
 * horizon.
 * The camera: the whole cliff and the desert beside it.
 *
 * Always happening (the floor):
 * - The day of the hold: sleep by night, dew gathered at dawn, work by day, the hall at dusk.
 * - Water: the dew of each dawn dripping into the cistern, the day's use taken out; the count
 *   on the HUD and the line in the cistern.
 * - The windtrap turns; the gate opens at dusk and closes at dawn; the watch changes.
 *
 * The cast (each seed draws some):
 * - raids [threat] a party out at dusk to the enemy's wells, back by dawn with water, or wounded, or fewer.
 * - patrol [threat] the Company's ornithopters pass: every lamp out, nobody moves.
 * - storm [weather] the doors seal, the windtrap shutters, sand drifts into the gate.
 * - drought [weather] a dry wind for a day: no dew.
 * - smugglers [trade] a lander at night below the gate: spice for water.
 * - riders [wonder] at dawn, riders go out and call a worm, seen from the lookout.
 * - naming [life] a child is born and named in the hall.
 * - funeral [life] a death; the water of the dead goes to the tribe.
 * - stranger [life] someone found on the sand, brought in and given water.
 * - garden [wonder] a hidden garden, green growing in the rock.
 * - feast [life] when the cistern is high, a feast with music in the hall.
 * Quotas: 4–6 in all; 0–2 threats.
 *
 * What keeps it going: the water rises and falls; people go out and come back, are born and die.
 * What changes with the seed: which side the cliff is on, how many chambers and where, the air,
 * the hold's name, the people's names, the cast.
 * A touch: in a chamber, the people there turn and gather; on the sand, a thumper.
 * Phone: fewer levels and people, the same cliff.
 */
import { createBus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Genome, type SystemDef } from '../../../kit';
import type { Air } from '../sandsea/desert';
import type { Bus } from '../../../sim/bus';
import type { Director } from '../../../kit';

export type ChamberKind = 'windtrap' | 'lookout' | 'hall' | 'cistern' | 'stills' | 'spice' | 'kitchen' | 'school' | 'armoury' | 'tomb' | 'cell' | 'garden' | 'gate' | 'store';
export type Chamber = { id: number; kind: ChamberKind; x: number; y: number; w: number; h: number; level: number; door: [number, number]; lamps: [number, number][]; seed: number; name: string };
export type Task = 'sleep' | 'work' | 'eat' | 'gather' | 'guard' | 'play' | 'dew' | 'idle' | 'mourn';
export type Person = {
  id: number; name: string; x: number; y: number; dir: 1 | -1; home: number; job: number; at: number; target: number;
  path: [number, number][]; pi: number; state: 'go' | 'in' | 'out'; task: Task; ph: number; seed: number; child: boolean; t0: number;
  /** Where in the chamber they settle. */
  spot: number; alive: boolean;
};
export type Outside = { id: number; kind: 'party' | 'stranger'; x: number; d: number; dir: 1 | -1; n: number; state: 'out' | 'back' | 'climb' | 'wait' | 'meet'; t0: number; members: number[]; seed: number; speed: number };
export type Fx = { kind: 'drop' | 'note' | 'spark' | 'smoke' | 'sand' | 'steam' | 'glint'; x: number; y: number; vx: number; vy: number; t0: number; dur: number; r: number; color: string };
export type Label = { text: string; x: number; y: number; t0: number; color: string };

export type HoldOptions = { people: number; camera?: string };

export type HoldWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; bus: Bus; director: Director;
  name: string; air: Air; cast: string[]; castIds: string[];
  day: number; dayLen: number;
  /** The cliff: which side it stands (+1 right), its face x, its top, the sand at its foot; the horizon beyond. */
  side: 1 | -1; cx0: number; cx1: number; top: number; floor: number; HY: number; shaftX: number;
  sunSide: 1 | -1;
  /** On the desert: a point at distance d (0 the foot of the cliff, 1 the horizon). */
  yOf(d: number): number; mOf(d: number): number; xOf(x: number, d: number): number;
  chambers: Chamber[]; levels: number[]; people: Person[]; outside: Outside[]; fx: Fx[];
  /** The water, in litres; the cistern's capacity. */
  water: number; capacity: number; dewRate: number; lastDew: number;
  /** The gate: open 0..1; sand drifted into it, 0..1. The lamps: 1 lit, 0 blackout. The windtrap: turning. */
  gate: number; gateSand: number; lamps: number; trap: number; shutters: number;
  storm: number; stormFront: number; stormDir: 1 | -1; flash: number; wind: number; drought: number;
  /** A thopter over the desert (the patrol, a lander), if any. */
  craft: { x: number; d: number; alt: number; dir: 1 | -1; state: 'cross' | 'land' | 'landed' | 'takeoff' | 'off'; t0: number; role: 'patrol' | 'smuggler'; beat: number; seed: number } | null;
  /** A worm on the far desert, if any. */
  worm: { x: number; d: number; dir: 1 | -1; state: 'sign' | 'ridden' | 'surface' | 'submerge'; t0: number; k: number; riders: number; size: number } | null;
  thumper: { x: number; d: number; until: number } | null;
  feast: number; mourning: number; garden: number; births: number; deaths: number; raids: number;
  view: { x: number; y: number; zoom: number; fit: number };
  labels: Label[]; chronicle: { t: number; text: string }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

type Ctx = {
  world: HoldWorld; r: Rng;
  say(text: string, x: number, y: number, color?: string): void;
  emit(type: string, x: number, y: number, weight: number): void;
  chronicle(text: string): void;
  look(why: string, x: number, y: number, zoom: number, hold: number, priority: number): void;
  after(delay: number, fn: () => void): void;
  /** Send people of a chamber (or anyone idle) to a chamber with a task. */
  send(who: Person[], to: number, task: Task): void;
  byKind(kind: ChamberKind): Chamber | undefined;
  insideIdle(n: number, adults?: boolean): Person[];
  goOut(members: Person[], kind: Outside['kind']): Outside;
  comeBack(o: Outside, lost: number[]): void;
  die(p: Person, how: string): void;
  born(name: string): Person;
  fx(kind: Fx['kind'], x: number, y: number, extra?: Partial<Fx>): void;
};

export const HOLDS = ['THE HOLD AT RED CLIFF', 'STONEWELL', 'THE DEEP HOLD', 'WINDGATE', 'THE CAVE OF THE BROKEN WORM', 'NORTH WALL', 'DRYSTONE', 'THE HIDDEN WELL', 'HOLLOW CLIFF', 'THE LAST WELL'];
const NAMES = ['ESKA', 'TARO', 'MIRRA', 'JOHAN', 'KEL', 'SABA', 'ORIN', 'NIMA', 'HAKON', 'TESSE', 'RUAN', 'ILSA', 'VARO', 'DEMA', 'OTTO', 'LIRA', 'CASPAR', 'ZEV', 'ANNIK', 'BRAM', 'SORA', 'IDRIS', 'MAEL', 'TOVA', 'HESSA', 'KIRAN', 'NOOR', 'PELL', 'WREN', 'YARA'];
const DAY_LEN = 900;
const KIND_NAMES: Record<ChamberKind, string> = {
  windtrap: 'THE WINDTRAP', lookout: 'THE LOOKOUT', hall: 'THE GREAT HALL', cistern: 'THE CISTERN', stills: 'THE STILL-ROOM', spice: 'THE SPICE ROOM', kitchen: 'THE KITCHEN', school: 'THE SCHOOL',
  armoury: 'THE ARMOURY', tomb: 'THE ROOM OF THE DEAD', cell: 'A SLEEPING CELL', garden: 'THE GARDEN', gate: 'THE GATE', store: 'THE STORES',
};

export function createWindtrap(seed: string | number, W: number, H: number, opts: HoldOptions): HoldWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'hold');
  const shotR: Rng = forkRng(seed, 'hold-shots');
  const g: Genome = createGenome(seed, 'hold');
  const GW = Math.max(64, Math.round(W * WORLD_SCALE));
  const GH = Math.max(40, Math.round(H * WORLD_SCALE));
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const phone = GW < GH;
  let ids = 1;

  const air = g.weighted<Air>({ bone: 4, rose: 3, ochre: 3, ash: 2 });
  const side: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const sunSide: 1 | -1 = side > 0 ? -1 : 1;
  const faceK = phone ? 0.3 : g.range(0.36, 0.44);
  const cx0 = side > 0 ? Math.round(GW * faceK) : -40;
  const cx1 = side > 0 ? GW + 40 : Math.round(GW * (1 - faceK));
  const top = Math.round(GH * g.range(0.13, 0.19));
  const floor = Math.round(GH * 0.8);
  const HY = Math.round(GH * g.range(0.47, 0.52));
  const rockW = cx1 - cx0;
  const shaftX = Math.round(side > 0 ? cx0 + rockW * 0.46 : cx1 - rockW * 0.46);
  const yOf = (d: number) => HY + (floor - HY) * Math.pow(1 - Math.max(0, Math.min(1, d)), 2);
  const mOf = (d: number) => 0.08 + 0.92 * Math.pow(1 - Math.max(0, Math.min(1, d)), 2);
  const desertMid = side > 0 ? cx0 / 2 : (cx1 + GW) / 2;
  const xOf = (x: number, d: number) => desertMid + (x - desertMid) * (0.35 + 0.65 * Math.pow(1 - Math.max(0, Math.min(1, d)), 2));

  // eslint-disable-next-line prefer-const
  let world: HoldWorld;
  world = {
    t: 0, W, H, GW, GH, u, bus,
    director: createDirector(forkRng(seed, 'hold-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    name: g.pick(HOLDS), air, cast: [], castIds: [],
    day: g.range(0.3, 0.44), dayLen: DAY_LEN,
    side, cx0, cx1, top, floor, HY, shaftX, sunSide, yOf, mOf, xOf,
    chambers: [], levels: [], people: [], outside: [], fx: [],
    water: 0, capacity: 0, dewRate: 0, lastDew: -1,
    gate: 0, gateSand: 0, lamps: 1, trap: 1, shutters: 0,
    storm: 0, stormFront: 0, stormDir: 1, flash: 0, wind: g.range(-1, 1) * 12, drought: 0,
    craft: null, worm: null, thumper: null,
    feast: 0, mourning: 0, garden: 0, births: 0, deaths: 0, raids: 0,
    view: { x: GW / 2, y: GH / 2, zoom: 1, fit: 1 },
    labels: [], chronicle: [],
    step, nudge,
    counts: () => ({
      people: world.people.filter((p) => p.alive && p.state !== 'out').length,
      out: world.people.filter((p) => p.alive && p.state === 'out').length,
      chambers: world.chambers.length,
      water: Math.round(world.water / 1000),
      fx: world.fx.length,
    }),
  };

  // ---- the hold, cut --------------------------------------------------------------------------------
  // Few levels, deep rooms: big enough that the people in them read.
  const L = phone ? 3 : 4;
  const levelH = (floor - top - 30 * u) / L;
  const LH = levelH;
  for (let l = 0; l < L; l++) world.levels.push(Math.round(top + 36 * u + (l + 1) * levelH - 8 * u));
  const chambers = world.chambers;
  const addChamber = (kind: ChamberKind, level: number, x: number, w: number, h: number) => {
    const y = world.levels[level];
    const ch: Chamber = { id: ids++, kind, x, y: y - h, w, h, level, door: [side > 0 ? (x < shaftX ? x + w : x) : x < shaftX ? x + w : x, y], lamps: [], seed: Math.floor(r() * 1e6), name: KIND_NAMES[kind] };
    // Which side of the chamber faces the shaft is where the door is.
    ch.door = [x + w / 2 < shaftX ? x + w : x, y];
    const n = kind === 'hall' ? 3 : kind === 'cell' ? 1 : 2;
    for (let k = 0; k < n; k++) ch.lamps.push([x + w * ((k + 1) / (n + 1)), ch.y + 10 * u]);
    chambers.push(ch);
    return ch;
  };
  // The fixed rooms: the windtrap at the top of the shaft, the cistern under it, the gate in the face, the hall in the middle.
  const shaftL = side > 0 ? 1 : -1;
  const faceX = side > 0 ? cx0 : cx1;
  addChamber('windtrap', 0, shaftX - 70 * u, 140 * u, LH * 0.56);
  addChamber('cistern', L - 1, shaftX - 170 * u, 340 * u, LH * 0.84);
  const gateLevel = L - 2;
  const gateW = 130 * u;
  addChamber('gate', gateLevel, side > 0 ? faceX + 6 * u : faceX - gateW - 6 * u, gateW, LH * 0.66);
  addChamber('lookout', 0, side > 0 ? faceX + 20 * u : faceX - 100 * u, 80 * u, LH * 0.44);
  const hallW = phone ? 220 * u : 330 * u;
  addChamber('hall', phone ? 1 : 1, shaftX + shaftL * 40 * u - (shaftL < 0 ? hallW : 0), hallW, LH * 0.84);
  // The rest: slots along each gallery, on either side of the shaft, filled by the seed.
  const others: ChamberKind[] = g.shuffle(['stills', 'spice', 'kitchen', 'school', 'armoury', 'tomb', 'store', 'cell', 'cell', 'cell', 'cell', 'cell', ...(phone ? [] : ['cell', 'store'])] as ChamberKind[]);
  const slots: [number, number, number][] = [];
  for (let l = 0; l < L; l++) {
    const lo = side > 0 ? faceX + 12 * u : cx0 + 20 * u;
    const hi = side > 0 ? cx1 - 60 * u : faceX - 12 * u;
    let x = lo;
    while (x < hi - 60 * u) {
      const w = (100 + r() * 80) * u;
      const taken = chambers.some((c) => c.level === l && x < c.x + c.w + 16 * u && x + w > c.x - 16 * u);
      const shaftHit = x < shaftX + 22 * u && x + w > shaftX - 22 * u;
      if (!taken && !shaftHit) {
        slots.push([l, x, w]);
        x += w + (18 + r() * 40) * u;
      } else x += 24 * u;
    }
  }
  const wantGarden = true;
  for (const [l, x, w] of g.shuffle(slots)) {
    const kind = others.shift();
    if (!kind) break;
    const h = kind === 'cell' ? LH * 0.5 : LH * (0.6 + r() * 0.1);
    addChamber(kind, l, x, Math.min(w, kind === 'cell' ? 120 * u : w), h);
  }
  const gardenSlot = slots.find(([l, x, w]) => !chambers.some((c) => c.level === l && x < c.x + c.w && x + w > c.x));
  if (wantGarden && gardenSlot) addChamber('garden', gardenSlot[0], gardenSlot[1], Math.min(gardenSlot[2], 140 * u), LH * 0.62);
  if (!chambers.some((c) => c.kind === 'cell')) addChamber('cell', 1, shaftX + shaftL * 30 * u - (shaftL < 0 ? 100 * u : 0), 100 * u, LH * 0.5);
  const byKind = (kind: ChamberKind) => chambers.find((c) => c.kind === kind);
  const cells = chambers.filter((c) => c.kind === 'cell');
  const workRooms = chambers.filter((c) => ['stills', 'spice', 'kitchen', 'armoury', 'store', 'garden', 'windtrap', 'cistern'].includes(c.kind));
  const hall = byKind('hall')!;
  const gate = byKind('gate')!;
  const cistern = byKind('cistern')!;

  // ---- the people -----------------------------------------------------------------------------------
  const nPeople = Math.round((phone ? 18 : 34) * Math.max(0.5, Math.min(2, opts.people)));
  let nameNo = Math.floor(r() * NAMES.length);
  const nextName = () => NAMES[nameNo++ % NAMES.length];
  function addPerson(name: string, child = false, at?: Chamber): Person {
    const home = cells[Math.floor(r() * cells.length)];
    const job = child ? byKind('school') ?? hall : workRooms[Math.floor(r() * workRooms.length)] ?? hall;
    const start = at ?? home;
    const p: Person = { id: ids++, name, x: start.x + start.w * (0.2 + r() * 0.6), y: start.y + start.h, dir: r() < 0.5 ? 1 : -1, home: home.id, job: job.id, at: start.id, target: start.id, path: [], pi: 0, state: 'in', task: 'idle', ph: r() * 6, seed: Math.floor(r() * 1e6), child, t0: world.t, spot: r(), alive: true };
    world.people.push(p);
    return p;
  }
  for (let k = 0; k < nPeople; k++) addPerson(nextName(), r() < 0.18);
  world.capacity = 400000 * (nPeople / 34);
  world.water = world.capacity * g.range(0.3, 0.7);
  world.dewRate = world.capacity * 0.009;

  // ---- the verbs -----------------------------------------------------------------------------------
  function establish(): { x: number; y: number; zoom: number } {
    const inside = world?.people?.filter((p) => p.alive && p.state !== 'out') ?? [];
    const p = inside[Math.floor(shotR() * inside.length)];
    if (p && shotR() < 0.6) return { x: p.x, y: p.y - 20 * u, zoom: 2 };
    return { x: GW / 2, y: GH / 2, zoom: 1 };
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
  const look = (why: string, x: number, y: number, zoom: number, hold: number, priority: number) => world.director.look(why, x, y, zoom, hold, priority);
  const later: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => later.push({ at: world.t + delay, fn });
  const fx = (kind: Fx['kind'], x: number, y: number, extra: Partial<Fx> = {}) => {
    if (world.fx.length > 600) return;
    world.fx.push({ kind, x, y, vx: 0, vy: 0, t0: world.t, dur: 2, r: 3 * u, color: '#ffd890', ...extra });
  };
  const chamberOf = (id: number) => chambers.find((c) => c.id === id);
  /** The way from one chamber to another: to the gallery, along it to the shaft, up or down, along, in. */
  function route(p: Person, to: Chamber): [number, number][] {
    const from = chamberOf(p.at) ?? chamberOf(p.target) ?? hall;
    const pts: [number, number][] = [];
    const fy = from.y + from.h;
    const ty = to.y + to.h;
    pts.push([from.door[0], fy]);
    if (from.level !== to.level) {
      pts.push([shaftX, fy]);
      pts.push([shaftX, ty]);
    }
    pts.push([to.door[0], ty]);
    pts.push([to.x + to.w * (0.15 + p.spot * 0.7), ty]);
    return pts;
  }
  function send(who: Person[], to: number, task: Task) {
    const ch = chamberOf(to);
    if (!ch) return;
    for (const p of who) {
      if (!p.alive || p.state === 'out') continue;
      p.spot = r();
      if (p.at === to && p.state === 'in') {
        p.task = task;
        continue;
      }
      p.path = route(p, ch);
      p.pi = 0;
      p.state = 'go';
      p.target = to;
      p.task = task;
    }
  }
  const insideIdle = (n: number, adults = true) => world.people.filter((p) => p.alive && p.state !== 'out' && (!adults || !p.child) && p.task !== 'mourn').sort((a, b) => a.seed - b.seed).slice(0, n);
  function goOut(members: Person[], kind: Outside['kind']): Outside {
    for (const p of members) {
      p.state = 'out';
      p.at = gate.id;
    }
    const o: Outside = { id: ids++, kind, x: gate.x + gate.w / 2, d: 0, dir: side > 0 ? -1 : 1, n: members.length, state: 'out', t0: world.t, members: members.map((p) => p.id), seed: Math.floor(r() * 1e6), speed: (24 + r() * 8) * u };
    world.outside.push(o);
    return o;
  }
  function comeBack(o: Outside, lost: number[]) {
    for (const id of o.members) {
      const p = world.people.find((q) => q.id === id);
      if (!p) continue;
      if (lost.includes(id)) {
        p.alive = false;
        continue;
      }
      p.state = 'in';
      p.at = gate.id;
      p.x = gate.x + gate.w * (0.3 + r() * 0.4);
      p.y = gate.y + gate.h;
      p.task = 'idle';
    }
    world.outside = world.outside.filter((q) => q !== o);
  }
  function die(p: Person, how: string) {
    p.alive = false;
    world.deaths++;
    chronicle(`${titled(p.name)} died ${how}.`);
  }
  function born(name: string): Person {
    world.births++;
    return addPerson(name, true, hall);
  }
  const titled = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const ctx: Ctx = { world, r, say, emit, chronicle, look, after, send, byKind, insideIdle, goOut, comeBack, die, born, fx };

  // ---- the cast library ---------------------------------------------------------------------------
  const hallMid = () => [hall.x + hall.w / 2, hall.y + hall.h / 2] as [number, number];
  const LIBRARY: SystemDef<Ctx>[] = [
    {
      id: 'raids', label: 'the raiders', weight: 8, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        let party: Outside | null = null;
        let due = 0;
        return {
          id: 'raids',
          step() {
            const dusk = w.day > 0.76 && w.day < 0.82;
            if (!party) {
              if (!dusk || w.storm > 0.1 || !w.director.want('raid', 0.6, 400)) return;
              const n = 5 + Math.floor(c.r() * 4);
              const members = c.insideIdle(40).filter((p) => p.task !== 'guard').slice(-n);
              if (members.length < 3) return;
              party = c.goOut(members, 'party');
              due = w.t + 160 + c.r() * 120;
              w.raids++;
              c.say(`${members.length} GO OUT AT DUSK TO THE ENEMY'S WELLS`, gate.x + gate.w / 2, gate.y - 20 * u, '#fcd9a0');
              c.emit('raid', gate.x, gate.y, 0.6);
              c.look('raid', gate.x, gate.y + gate.h, 1.7, 10, 6);
              return;
            }
            if (party.state === 'out' && w.t > due && (side > 0 ? party.x < -300 * u : party.x > GW + 300 * u)) {
              // The return, and what it brought.
              party.state = 'back';
              party.t0 = w.t;
              party.x = side > 0 ? -300 * u : GW + 300 * u;
              party.d = 0.5;
            }
            if (party.state === 'wait') {
              const roll = c.r();
              const lost: number[] = [];
              if (roll < 0.15) for (const id of party.members.slice(0, 1 + Math.floor(c.r() * 2))) lost.push(id);
              const gained = roll < 0.6 ? w.capacity * (0.05 + c.r() * 0.12) : roll < 0.85 ? w.capacity * 0.02 : 0;
              w.water = Math.min(w.capacity, w.water + gained);
              const names = lost.map((id) => titled(w.people.find((q) => q.id === id)?.name ?? ''));
              c.comeBack(party, lost);
              w.deaths += lost.length;
              if (gained > w.capacity * 0.04) {
                c.say(`THE RAIDERS RETURN WITH ${Math.round(gained / 1000)},000 LITRES OF THE ENEMY'S WATER`, gate.x + gate.w / 2, gate.y - 20 * u, '#bae6fd');
                c.chronicle(`The raiders came back at dawn with ${Math.round(gained / 1000)},000 litres of the enemy's water${names.length ? `, and without ${names.join(' and ')}` : ''}.`);
              } else if (gained > 0) {
                c.say('THE RAIDERS RETURN WITH LITTLE, AND WOUNDED', gate.x + gate.w / 2, gate.y - 20 * u, '#e8d8c0');
                c.chronicle(`The raid found the wells guarded; they came back with little${names.length ? `, and without ${names.join(' and ')}` : ''}.`);
              } else {
                c.say('THE RAIDERS RETURN EMPTY-HANDED', gate.x + gate.w / 2, gate.y - 20 * u, '#e8d8c0');
                c.chronicle(`The raiders came back with nothing${names.length ? `, and without ${names.join(' and ')}` : ''}.`);
              }
              c.emit('return', gate.x, gate.y, 0.6);
              if (lost.length) w.mourning = Math.max(w.mourning, 1);
              party = null;
            }
          },
          counts: () => ({ raiders: party ? party.n : 0 }),
        };
      },
    },
    {
      id: 'patrol', label: 'the Company\'s patrols', weight: 5, tags: ['threat'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'patrol',
          step() {
            if (w.t < 45 || w.craft || w.storm > 0.2 || !w.director.want('patrol', 0.45, 260)) return;
            const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
            w.craft = { x: dir > 0 ? -200 * u : GW + 200 * u, d: 0.45 + c.r() * 0.3, alt: 140 * u, dir, state: 'cross', t0: w.t, role: 'patrol', beat: 0, seed: Math.floor(c.r() * 1e6) };
            w.lamps = 0;
            c.say('A PATROL! EVERY LAMP OUT, AND NOBODY MOVES', gate.x + gate.w / 2, gate.y - 30 * u, '#fca5a5');
            c.emit('patrol', w.xOf(w.craft.x, w.craft.d), w.yOf(w.craft.d), 0.6);
            c.after(55, () => {
              w.lamps = 1;
              c.say('THE PATROL IS GONE. THE LAMPS ARE LIT AGAIN', hallMid()[0], hall.y - 10 * u, '#fcd9a0');
            });
          },
        };
      },
    },
    {
      id: 'storm', label: 'the storms', weight: 5, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        let until = 0;
        let on = false;
        return {
          id: 'storm',
          step(dt) {
            if (!on && w.storm <= 0 && w.t > 90 && w.director.want('storm', 0.5, 420)) {
              on = true;
              until = w.t + 80 + c.r() * 60;
              w.stormDir = side > 0 ? 1 : -1;
              w.stormFront = side > 0 ? -GW * 0.5 : GW * 1.5;
              c.say('A STORM. SEAL THE DOORS, SHUTTER THE WINDTRAP', gate.x + gate.w / 2, gate.y - 30 * u, '#e8c8a0');
              c.emit('storm', GW / 2, HY, 0.6);
              c.chronicle('A sandstorm came against the cliff; the doors were sealed, and the sand came in anyway.');
            }
            if (!on) return;
            if (w.t < until) {
              w.storm = Math.min(1, w.storm + dt / 30);
              w.stormFront += w.stormDir * dt * 60 * u;
              w.gateSand = Math.min(1, w.gateSand + dt * 0.006);
              if (c.r() < dt * 0.3 * w.storm) w.flash = 1;
            } else {
              w.storm = Math.max(0, w.storm - dt / 40);
              if (w.storm === 0) {
                on = false;
                c.say('THE STORM PASSES. NOW DIG OUT THE GATE', gate.x + gate.w / 2, gate.y - 20 * u, '#e8d8c0');
                c.send(c.insideIdle(4), gate.id, 'work');
              }
            }
          },
          counts: () => ({ storm: w.storm > 0 ? 1 : 0 }),
        };
      },
    },
    {
      id: 'drought', label: 'a dry wind', weight: 3, tags: ['weather'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'drought',
          step(dt) {
            if (w.drought > 0) {
              w.drought = Math.max(0, w.drought - dt / 300);
              return;
            }
            if (w.t > 120 && w.director.want('drought', 0.4, 700)) {
              w.drought = 1;
              c.say('THE WIND BRINGS NO WATER. THE DEW FAILS', byKind('windtrap')!.x, byKind('windtrap')!.y - 20 * u, '#e8d8c0');
              c.chronicle('A dry wind blew for a day, and the windtrap gave nothing.');
            }
          },
        };
      },
    },
    {
      id: 'smugglers', label: 'smugglers', weight: 4, tags: ['trade'],
      create: (c) => {
        const w = c.world;
        let party: Outside | null = null;
        let phase = 0;
        return {
          id: 'smugglers',
          step() {
            const night = w.day < 0.24 || w.day > 0.82;
            if (!w.craft && !party) {
              if (!night || w.storm > 0.1 || !w.director.want('smugglers', 0.5, 480)) return;
              const dir: 1 | -1 = side > 0 ? 1 : -1;
              w.craft = { x: dir > 0 ? -200 * u : GW + 200 * u, d: 0.12, alt: 120 * u, dir, state: 'cross', t0: w.t, role: 'smuggler', beat: 0, seed: Math.floor(c.r() * 1e6) };
              phase = 0;
              c.say('A LANDER COMES IN WITHOUT LIGHTS, BELOW THE GATE', gate.x + gate.w / 2, gate.y - 30 * u, '#c8c0d8');
              c.emit('smugglers', gate.x, gate.y, 0.5);
              return;
            }
            if (!w.craft || w.craft.role !== 'smuggler') return;
            if (phase === 0 && w.craft.state === 'landed') {
              phase = 1;
              party = c.goOut(c.insideIdle(3), 'party');
              party.state = 'meet';
            } else if (phase === 1 && w.t - w.craft.t0 > 30) {
              phase = 2;
              const gained = w.capacity * (0.02 + c.r() * 0.04);
              w.water = Math.min(w.capacity, w.water + gained);
              c.say(`SPICE FOR WATER: ${Math.round(gained / 1000)},000 LITRES INTO THE CISTERN`, gate.x + gate.w / 2, gate.y - 20 * u, '#bae6fd');
              c.chronicle(`Smugglers traded ${Math.round(gained / 1000)},000 litres of water for spice at the gate.`);
              c.emit('trade', gate.x, gate.y, 0.4);
              w.craft.state = 'takeoff';
              w.craft.t0 = w.t;
              if (party) c.comeBack(party, []);
              party = null;
            }
          },
        };
      },
    },
    {
      id: 'riders', label: 'the riders', weight: 4, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        let party: Outside | null = null;
        let phase = 0;
        return {
          id: 'riders',
          step() {
            const dawn = w.day > 0.24 && w.day < 0.32;
            if (!party) {
              if (!dawn || w.storm > 0.1 || w.worm || !w.director.want('riders', 0.7, 700)) return;
              party = c.goOut(c.insideIdle(30).slice(-4), 'party');
              phase = 0;
              c.say('RIDERS GO OUT AT DAWN WITH THEIR HOOKS', gate.x + gate.w / 2, gate.y - 20 * u, '#fcd9a0');
              return;
            }
            if (phase === 0 && party.state === 'out' && party.d > 0.35) {
              phase = 1;
              party.state = 'wait';
              w.thumper = { x: party.x, d: party.d, until: w.t + 60 };
              w.worm = { x: party.x + (side > 0 ? -1 : 1) * 1400 * u, d: Math.min(0.9, party.d + 0.25), dir: side > 0 ? 1 : -1, state: 'sign', t0: w.t, k: 0, riders: party.n, size: 1.2, };
              c.say('A THUMPER BEATS ON THE SAND, AND THE WORM COMES', w.xOf(party.x, party.d), w.yOf(party.d) - 30 * u, '#fcd9a0');
              c.look('riders', w.xOf(party.x, party.d), w.yOf(party.d), 1.5, 30, 8);
            } else if (phase === 1 && w.worm && w.worm.state === 'ridden') {
              phase = 2;
              c.say('THEY TAKE IT WITH THEIR HOOKS, AND RIDE', w.xOf(w.worm.x, w.worm.d), w.yOf(w.worm.d) - 80 * u, '#fcd9a0');
              c.emit('ride', w.xOf(w.worm.x, w.worm.d), w.yOf(w.worm.d), 0.9);
              c.chronicle('At dawn four riders called a worm below the cliff and rode it out of sight.');
              w.outside = w.outside.filter((q) => q !== party);
              const members = party.members;
              c.after(200 + c.r() * 100, () => {
                const back: Outside = { id: ids++, kind: 'party', x: side > 0 ? -300 * u : GW + 300 * u, d: 0.5, dir: side > 0 ? 1 : -1, n: members.length, state: 'back', t0: w.t, members, seed: 1, speed: 28 * u };
                w.outside.push(back);
              });
              party = null;
            }
          },
        };
      },
    },
    {
      id: 'naming', label: 'namings', weight: 5, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'naming',
          step() {
            const evening = w.day > 0.74 && w.day < 0.8;
            if (!evening || w.lamps < 1 || !w.director.want('naming', 0.5, 500)) return;
            const name = nextName();
            const child = c.born(name);
            c.send(c.insideIdle(12), hall.id, 'gather');
            c.say(`A CHILD IS BORN TO THE HOLD, AND NAMED ${name}`, ...hallMid(), '#fcd9a0');
            c.emit('naming', ...hallMid(), 0.6);
            c.look('naming', ...hallMid(), 1.9, 10, 6);
            c.chronicle(`A child was named ${titled(name)} in the hall, and given its first water.`);
            void child;
          },
        };
      },
    },
    {
      id: 'funeral', label: 'the water of the dead', weight: 6, tags: ['life'],
      create: (c) => {
        const w = c.world;
        let phase = 0;
        let t0 = 0;
        let who = '';
        return {
          id: 'funeral',
          step() {
            if (phase === 0) {
              // Someone dies of age or hurt now and then; the raiders' dead are mourned too.
              const fresh = w.mourning >= 1;
              if (!fresh && !(w.people.filter((p) => p.alive).length > 12 && w.director.want('death', 0.55, 600))) return;
              if (!fresh) {
                const p = c.insideIdle(50)[Math.floor(c.r() * 6)];
                if (!p) return;
                c.die(p, c.r() < 0.5 ? 'in the night, of age' : 'of a hurt taken on the sand');
                who = p.name;
              } else who = '';
              w.mourning = 0.99;
              phase = 1;
              t0 = w.t;
              const tomb = byKind('tomb') ?? cistern;
              c.send(c.insideIdle(14), tomb.id, 'mourn');
              c.say(who ? `${who} IS DEAD. THE HOLD GATHERS FOR THE WATER` : 'THE HOLD GATHERS FOR THE WATER OF THE DEAD', tomb.x + tomb.w / 2, tomb.y - 16 * u, '#e8d8c0');
              c.emit('funeral', tomb.x, tomb.y, 0.5);
              c.look('funeral', tomb.x + tomb.w / 2, tomb.y + tomb.h / 2, 1.9, 12, 6);
            } else if (phase === 1 && w.t - t0 > 30) {
              phase = 0;
              w.mourning = 0;
              const litres = 38 + Math.floor(c.r() * 10);
              w.water += litres;
              const tomb = byKind('tomb') ?? cistern;
              c.say(`THE WATER OF ${who || 'THE DEAD'}, ${litres} LITRES, GOES TO THE TRIBE`, tomb.x + tomb.w / 2, tomb.y - 16 * u, '#bae6fd');
              c.chronicle(`The water of ${who ? titled(who) : 'the dead'} was rendered to the cistern: ${litres} litres, and the count read aloud.`);
              for (const p of w.people) if (p.task === 'mourn') p.task = 'idle';
            }
          },
        };
      },
    },
    {
      id: 'stranger', label: 'strangers from the sand', weight: 4, tags: ['life'],
      create: (c) => {
        const w = c.world;
        let s: Outside | null = null;
        return {
          id: 'stranger',
          step() {
            if (s) {
              if (!w.outside.includes(s)) {
                s = null;
              }
              return;
            }
            if (w.t < 60 || w.storm > 0.1 || !w.director.want('stranger', 0.5, 600)) return;
            s = { id: ids++, kind: 'stranger', x: side > 0 ? -200 * u : GW + 200 * u, d: 0.3, dir: side > 0 ? 1 : -1, n: 1, state: 'back', t0: w.t, members: [], seed: Math.floor(c.r() * 1e6), speed: 9 * u };
            w.outside.push(s);
            c.say('SOMEONE IS CRAWLING ON THE SAND BELOW THE CLIFF', w.xOf(s.x, s.d), w.yOf(s.d) - 30 * u, '#e8d8c0');
            c.emit('stranger', w.xOf(s.x, s.d), w.yOf(s.d), 0.4);
          },
        };
      },
    },
    {
      id: 'garden', label: 'the hidden garden', weight: 4, tags: ['wonder'],
      create: (c) => {
        const w = c.world;
        let said = false;
        return {
          id: 'garden',
          step(dt) {
            const gd = byKind('garden');
            if (!gd) return;
            w.garden = Math.min(1, w.garden + dt / 1400 * (w.water > w.capacity * 0.3 ? 1 : 0.2));
            if (!said && w.garden > 0.5) {
              said = true;
              c.say('IN THE ROCK, THE GARDEN HAS COME INTO LEAF', gd.x + gd.w / 2, gd.y - 16 * u, '#bbf7d0');
              c.chronicle('The hidden garden came into leaf; the children were taken to see green.');
              c.send(w.people.filter((p) => p.child && p.alive && p.state !== 'out'), gd.id, 'play');
              c.look('garden', gd.x + gd.w / 2, gd.y + gd.h / 2, 2, 10, 5);
            }
          },
        };
      },
    },
    {
      id: 'feast', label: 'feasts', weight: 5, tags: ['life'],
      create: (c) => {
        const w = c.world;
        return {
          id: 'feast',
          step(dt) {
            if (w.feast > 0) {
              w.feast = Math.max(0, w.feast - dt / 60);
              if (c.r() < dt * 3) c.fx('note', hall.x + hall.w * (0.3 + c.r() * 0.4), hall.y + hall.h * 0.5, { vy: -12 * u, dur: 2.5, color: '#fde68a' });
              return;
            }
            const evening = w.day > 0.76 && w.day < 0.86;
            if (!evening || w.water < w.capacity * 0.8 || w.lamps < 1 || !w.director.want('feast', 0.55, 500)) return;
            w.feast = 1;
            c.send(c.insideIdle(30, false), hall.id, 'gather');
            c.say('THE CISTERN IS HIGH: A FEAST IN THE HALL, WITH MUSIC', ...hallMid(), '#fcd9a0');
            c.emit('feast', ...hallMid(), 0.6);
            c.chronicle('With the cistern high, the hold held a feast, and there was music in the hall.');
          },
        };
      },
    },
  ];
  const RULE = { total: [4, 6] as [number, number], quota: { threat: [0, 2] as [number, number], weather: [0, 2] as [number, number], life: [1, 3] as [number, number] } };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);

  // ---- the day of the hold --------------------------------------------------------------------------
  /** Where someone should be at this hour, and doing what. */
  function wantOf(p: Person): [number, Task] {
    const d = world.day;
    const h = hash(p.seed, Math.floor(d * 48));
    if (d < 0.24 || d > 0.86) {
      if (h < 0.08) return [byKind('lookout')?.id ?? hall.id, 'guard'];
      if (h < 0.14) return [gate.id, 'guard'];
      if (h < 0.22 && !p.child) return [hall.id, 'idle'];
      return [p.home, 'sleep'];
    }
    if (d < 0.32) {
      if (h < 0.35 && !p.child) return [byKind('windtrap')!.id, 'dew'];
      if (h < 0.45) return [byKind('kitchen')?.id ?? hall.id, 'work'];
      return [p.home, 'idle'];
    }
    if (d < 0.5 || (d > 0.56 && d < 0.74)) {
      if (p.child) return [h < 0.7 ? byKind('school')?.id ?? hall.id : byKind('garden')?.id ?? hall.id, h < 0.7 ? 'work' : 'play'];
      if (h < 0.08) return [byKind('lookout')?.id ?? hall.id, 'guard'];
      if (h < 0.75) return [p.job, 'work'];
      return [workRooms[Math.floor(h * 97) % workRooms.length]?.id ?? hall.id, 'work'];
    }
    if (d <= 0.56) return [hall.id, 'eat'];
    if (d < 0.8) return [hall.id, 'gather'];
    return [h < 0.5 ? hall.id : p.home, h < 0.5 ? 'idle' : 'sleep'];
  }
  const hash = (a: number, b: number) => {
    let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  let nextPlan = 0;
  function people(dt: number) {
    nextPlan -= dt;
    const plan = nextPlan <= 0;
    if (plan) nextPlan = 2;
    for (const p of world.people) {
      if (!p.alive || p.state === 'out') continue;
      if (plan && world.lamps > 0 && p.task !== 'mourn' && p.task !== 'gather' && !(world.feast > 0 && p.at === hall.id)) {
        const [to, task] = wantOf(p);
        if (to !== p.target || (p.state === 'in' && p.task !== task)) {
          if (to !== p.target) send([p], to, task);
          else p.task = task;
        }
      }
      if (p.state === 'go') {
        if (world.lamps <= 0) continue;
        const [tx, ty] = p.path[p.pi];
        const dx = tx - p.x;
        const dy = ty - p.y;
        const dist = Math.hypot(dx, dy);
        const sp = (p.child ? 26 : 22) * u * (p.task === 'guard' ? 1.2 : 1);
        if (dist < sp * dt) {
          p.x = tx;
          p.y = ty;
          p.pi++;
          if (p.pi >= p.path.length) {
            p.state = 'in';
            p.at = p.target;
            p.t0 = world.t;
            // Someone arriving somewhere is a small thing happening.
            if (p.task !== 'idle') emit(p.task === 'sleep' ? 'rest' : p.task === 'guard' ? 'watch' : 'arrive', p.x, p.y, 0.02);
          }
        } else {
          p.x += (dx / dist) * sp * dt;
          p.y += (dy / dist) * sp * dt;
          if (Math.abs(dx) > 0.5) p.dir = dx > 0 ? 1 : -1;
        }
        p.ph += dt * (dist > 0 ? 7 + Math.sin(world.t * 1.3 + p.seed) * 3 : 0);
      } else {
        // In a chamber: a little wandering at work and play, still at sleep and guard.
        const ch = chamberOf(p.at);
        if (!ch) continue;
        if (p.task === 'work' || p.task === 'play' || p.task === 'dew' || (p.task === 'idle' && r() < 0.3)) {
          if (r() < dt * 0.25) {
            p.spot = r();
            p.dir = r() < 0.5 ? 1 : -1;
          }
          const tx = ch.x + ch.w * (0.12 + p.spot * 0.76);
          const dx = tx - p.x;
          if (Math.abs(dx) > 2) {
            p.x += Math.sign(dx) * Math.min(Math.abs(dx), 14 * u * dt);
            p.dir = dx > 0 ? 1 : -1;
            p.ph += dt * 6;
          }
          if (p.task === 'dew' && ch.kind === 'windtrap' && r() < dt * 0.5) fx('drop', ch.x + ch.w / 2 + (r() - 0.5) * 20 * u, ch.y + ch.h * 0.3, { vy: 60 * u, dur: 1.2, color: '#bae6fd' });
          if (p.task === 'work' && ch.kind === 'kitchen' && r() < dt * 0.4) fx('steam', p.x, ch.y + ch.h * 0.5, { vy: -10 * u, dur: 2, r: 4 * u, color: '#e8e4dc' });
          if (p.task === 'work' && ch.kind === 'stills' && r() < dt * 0.3) fx('drop', p.x + 6 * u, ch.y + ch.h * 0.4, { vy: 30 * u, dur: 0.8, color: '#bae6fd' });
          if (p.task === 'work' && ch.kind === 'armoury' && r() < dt * 0.3) fx('spark', p.x, ch.y + ch.h * 0.6, { vx: (r() - 0.5) * 30 * u, vy: -20 * u, dur: 0.5, color: '#ffd890' });
          if (p.task === 'work' && ch.kind === 'gate' && world.gateSand > 0) {
            world.gateSand = Math.max(0, world.gateSand - dt * 0.02);
            if (r() < dt * 2) fx('sand', p.x + p.dir * 10 * u, ch.y + ch.h - 6 * u, { vx: p.dir * 20 * u, vy: -16 * u, dur: 1, r: 3 * u, color: '#c8a878' });
          }
        }
      }
    }
    // The outside: parties on the sand, leaving and coming home.
    for (const o of world.outside) {
      const age = world.t - o.t0;
      if (o.state === 'out') {
        // Down the path to the sand, then away across it.
        if (o.d < 0.08) {
          o.x += (side > 0 ? -1 : 1) * o.speed * dt * 0.8;
          o.d = Math.min(0.08, o.d + dt * 0.012);
        } else {
          o.x += (side > 0 ? -1 : 1) * o.speed * dt;
          o.d = Math.min(0.6, o.d + dt * 0.01);
        }
        if (o.kind === 'party' && (o.x < -300 * u || o.x > GW + 300 * u)) {
          // Gone over the horizon; the system brings them back.
          o.x = side > 0 ? -320 * u : GW + 320 * u;
        }
      } else if (o.state === 'back') {
        const tx = gate.x + gate.w / 2 + (side > 0 ? -1 : 1) * 40 * u;
        const dx = tx - o.x;
        o.x += Math.sign(dx) * Math.min(Math.abs(dx), o.speed * dt);
        o.d = Math.max(0.02, o.d - dt * 0.012);
        if (Math.abs(dx) < 6 * u) {
          o.state = o.kind === 'stranger' ? 'wait' : 'climb';
          o.t0 = world.t;
          if (o.kind === 'stranger') {
            say('A STRANGER AT THE GATE, HALF DEAD OF THIRST', gate.x + gate.w / 2, gate.y - 20 * u, '#e8d8c0');
            after(12, () => {
              const p = addPerson(nextName(), false, gate);
              world.outside = world.outside.filter((q) => q !== o);
              chronicle(`A stranger was found below the cliff and given water; ${titled(p.name)} is one of the hold now.`);
              say(`${p.name} IS GIVEN WATER, AND A PLACE IN THE HOLD`, gate.x + gate.w / 2, gate.y - 20 * u, '#bae6fd');
              emit('taken-in', gate.x, gate.y, 0.5);
            });
          }
        }
      } else if (o.state === 'climb') {
        if (age > 6) o.state = 'wait';
      }
    }
    // The gate opens at dusk and closes at dawn (and seals in a storm).
    const open = world.storm > 0.1 ? 0 : world.day > 0.74 || world.day < 0.3 || world.outside.some((o) => o.state === 'climb' || o.state === 'wait') ? 1 : 0;
    world.gate += (open - world.gate) * Math.min(1, dt * 0.5);
    world.shutters += ((world.storm > 0.1 || world.drought > 0 ? 1 : 0) - world.shutters) * Math.min(1, dt * 0.5);
  }

  // ---- the hours of the hold: what is said and done every day --------------------------------------------
  const RITES: [number, string, () => [number, number], string][] = [
    [0.26, 'DAWN. THE LOOKOUT CHANGES', () => [byKind('lookout')?.x ?? shaftX, (byKind('lookout')?.y ?? top) - 14 * u], '#e8d8c0'],
    [0.3, 'THE GATE IS CLOSED AGAINST THE DAY', () => [gate.x + gate.w / 2, gate.y - 14 * u], '#e8d8c0'],
    [0.34, 'THE COOKS BOIL THE MORNING RATION', () => [(byKind('kitchen') ?? hall).x + 30 * u, (byKind('kitchen') ?? hall).y - 14 * u], '#e8d8c0'],
    [0.4, 'THE CHILDREN LEARN THE WORM\'S SIGNS', () => [(byKind('school') ?? hall).x + 30 * u, (byKind('school') ?? hall).y - 14 * u], '#e8d8c0'],
    [0.46, 'IN THE STILL-ROOM, THE SUITS ARE MENDED', () => [(byKind('stills') ?? hall).x + 30 * u, (byKind('stills') ?? hall).y - 14 * u], '#e8d8c0'],
    [0.51, 'THE HOLD EATS TOGETHER IN THE HALL', () => [hall.x + hall.w / 2, hall.y - 14 * u], '#fcd9a0'],
    [0.6, 'THE SPICE IS WORKED, AND THE AIR IS CINNAMON', () => [(byKind('spice') ?? hall).x + 30 * u, (byKind('spice') ?? hall).y - 14 * u], '#fcd9a0'],
    [0.66, 'THE ARMOURER SHARPENS THE HOOKS', () => [(byKind('armoury') ?? hall).x + 30 * u, (byKind('armoury') ?? hall).y - 14 * u], '#e8d8c0'],
    [0.75, 'THE GATE OPENS FOR THE NIGHT', () => [gate.x + gate.w / 2, gate.y - 14 * u], '#e8d8c0'],
    [0.78, '', () => [cistern.x + cistern.w / 2, cistern.y - 14 * u], '#bae6fd'],
    [0.88, 'THE LAMPS ARE TURNED LOW. THE HOLD SLEEPS', () => [hall.x + hall.w / 2, hall.y - 14 * u], '#c8c0d8'],
    [0.08, 'THE DEEP OF THE NIGHT. ONLY THE WATCH IS AWAKE', () => [gate.x + gate.w / 2, gate.y - 14 * u], '#c8c0d8'],
  ];
  const rited = new Set<string>();
  function rites() {
    const dayNo = Math.floor(world.t / world.dayLen + world.day);
    for (const [at, text, where, color] of RITES) {
      const key = `${dayNo}:${at}`;
      if (rited.has(key) || Math.abs(world.day - at) > 0.004) continue;
      rited.add(key);
      if (world.lamps < 1 || world.storm > 0.3) continue;
      const [x, y] = where();
      const line = text || `THE WATER COUNT IS READ: ${Math.round(world.water).toLocaleString('en-US')} LITRES`;
      say(line, x, y, color);
      emit('rite', x, y, 0.12);
      if (!text) chronicle(`The water count was read at dusk: ${Math.round(world.water).toLocaleString('en-US')} litres.`);
    }
    if (rited.size > 60) rited.clear();
  }

  // ---- the water ----------------------------------------------------------------------------------------
  function water(dt: number) {
    const dawn = world.day > 0.24 && world.day < 0.34;
    const dayNo = Math.floor(world.t / world.dayLen);
    if (dawn && world.drought <= 0 && world.storm < 0.1) {
      const gain = (world.dewRate / (0.1 * world.dayLen)) * dt;
      world.water = Math.min(world.capacity, world.water + gain);
      if (r() < dt * 2) {
        fx('drop', shaftX + (r() - 0.5) * 8 * u, byKind('windtrap')!.y + byKind('windtrap')!.h, { vy: 90 * u, dur: (cistern.y - byKind('windtrap')!.y) / (90 * u), color: '#bae6fd' });
        if (r() < 0.2) emit('drip', shaftX, cistern.y, 0.02);
      }
      if (world.lastDew !== dayNo) {
        world.lastDew = dayNo;
        say('DAWN. THE WINDTRAP GIVES ITS WATER', byKind('windtrap')!.x + 60 * u, byKind('windtrap')!.y - 20 * u, '#bae6fd');
        emit('dew', shaftX, top, 0.2);
      }
    }
    const souls = world.people.filter((p) => p.alive).length;
    world.water = Math.max(0, world.water - ((souls * 60) / world.dayLen) * dt);
    world.flash = Math.max(0, world.flash - dt * 3);
    world.wind += ((Math.sin(world.t * 0.05) * 8 + Math.sin(world.t * 0.013) * 6) * (1 - world.storm) + world.storm * world.stormDir * 30 - world.wind) * dt * 0.2;
    world.trap = Math.abs(world.wind) * (1 - world.shutters) * 0.1;
    if (world.water < world.capacity * 0.2 && world.director.want('discipline', 0.3, 600)) {
      say('THE CISTERN IS LOW. WATER DISCIPLINE: HALF RATIONS', cistern.x + cistern.w / 2, cistern.y - 16 * u, '#fca5a5');
      chronicle('The cistern fell low, and the hold went to half rations.');
    }
  }

  // ---- the desert beside ----------------------------------------------------------------------------
  function desert(dt: number) {
    const c = world.craft;
    if (c) {
      c.beat += dt * 22;
      if (c.state === 'cross') {
        c.x += c.dir * dt * 150 * u;
        if (c.role === 'smuggler' && Math.abs(c.x - (gate.x + (side > 0 ? -180 : 180) * u)) < 20 * u) {
          c.state = 'land';
          c.t0 = world.t;
        }
        if (c.x < -300 * u || c.x > GW + 300 * u) world.craft = null;
      } else if (c.state === 'land') {
        c.alt = Math.max(0, c.alt - dt * 40 * u);
        if (c.alt <= 0) {
          c.state = 'landed';
          c.t0 = world.t;
        }
      } else if (c.state === 'takeoff') {
        c.alt = Math.min(140 * u, c.alt + dt * 50 * u);
        if (c.alt >= 140 * u) c.state = 'cross';
      }
    }
    const wm = world.worm;
    if (wm) {
      const age = world.t - wm.t0;
      if (wm.state === 'sign') {
        wm.k = Math.min(1, age / 6);
        const party = world.outside.find((o) => o.state === 'wait' && o.kind === 'party');
        const tx = party ? party.x : wm.x;
        const dx = tx - wm.x;
        wm.x += Math.sign(dx) * Math.min(Math.abs(dx), 34 * u * dt);
        wm.dir = dx > 0 ? 1 : -1;
        if (Math.abs(dx) < 30 * u || age > 60) {
          wm.state = 'ridden';
          wm.t0 = world.t;
          wm.dir = side > 0 ? -1 : 1;
          if (party) world.outside = world.outside.filter((o) => o !== party);
        }
      } else if (wm.state === 'ridden') {
        wm.k = Math.min(1, age / 40);
        wm.x += wm.dir * dt * 45 * u;
        wm.d = Math.min(0.92, wm.d + dt * 0.004);
        if (r() < dt * 12) fx('sand', world.xOf(wm.x - wm.dir * 200 * u, wm.d), world.yOf(wm.d), { vx: -wm.dir * 20 * u, vy: -(20 + r() * 30) * u * world.mOf(wm.d), dur: 2, r: 10 * u * world.mOf(wm.d) + 2, color: '#c8a878' });
        if (wm.x < -600 * u || wm.x > GW + 600 * u) world.worm = null;
      } else if (wm.state === 'surface') {
        wm.k = Math.min(1, age / 20);
        wm.x += wm.dir * dt * 30 * u;
        if (age > 20) {
          wm.state = 'submerge';
          wm.t0 = world.t;
        }
      } else if (age > 8) world.worm = null;
      else wm.k = Math.min(1, age / 8);
    } else if (r() < dt * 0.004 && world.storm < 0.1) {
      world.worm = { x: GW * (0.2 + r() * 0.6), d: 0.75 + r() * 0.2, dir: r() < 0.5 ? 1 : -1, state: 'surface', t0: world.t, k: 0, riders: 0, size: 1 + r(), };
      say('A WORM SURFACES, FAR OFF ON THE SAND', world.xOf(world.worm.x, world.worm.d), world.yOf(world.worm.d) - 40 * u, '#e8d8c0');
      emit('worm', world.xOf(world.worm.x, world.worm.d), world.yOf(world.worm.d), 0.3);
    }
    if (world.thumper && world.t > world.thumper.until) world.thumper = null;
    for (const f of world.fx) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'drop') f.vy += 120 * u * dt;
      if (f.kind === 'sand') f.vy += 60 * u * dt;
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
  }

  // ---- a touch -------------------------------------------------------------------------------------
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 3) return null;
    const ch = chambers.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (ch) {
      lastNudge = world.t;
      const there = world.people.filter((p) => p.alive && p.state === 'in' && p.at === ch.id);
      for (const p of there) {
        p.dir = x > p.x ? 1 : -1;
        p.spot = Math.max(0, Math.min(1, (x - ch.x) / ch.w + (r() - 0.5) * 0.2));
      }
      for (let k = 0; k < 4; k++) fx('glint', x + (r() - 0.5) * 20 * u, y + (r() - 0.5) * 20 * u, { dur: 0.8, color: '#fde68a' });
      const line = there.length ? `${ch.name} STIRS: ${there.length} LOOK UP` : `${ch.name}, EMPTY AT THIS HOUR`;
      say(line, ch.x + ch.w / 2, ch.y - 12 * u, '#efe6d2');
      emit('nudge', x, y, 0.2);
      return line;
    }
    const onSand = (side > 0 ? x < cx0 : x > cx1) && y > HY && y < floor;
    if (!onSand) return null;
    lastNudge = world.t;
    const k = (y - HY) / (floor - HY);
    const d = 1 - Math.sqrt(Math.max(0, Math.min(1, k)));
    const gx = desertMid + (x - desertMid) / (0.35 + 0.65 * Math.pow(1 - d, 2));
    world.thumper = { x: gx, d, until: world.t + 50 };
    emit('thumper', x, y, 0.3);
    if (!world.worm && world.director.want('thumperworm', 0.4, 90)) {
      world.worm = { x: gx + (gx > desertMid ? -1 : 1) * 1200 * u, d: Math.min(0.9, d + 0.2), dir: gx > desertMid ? 1 : -1, state: 'sign', t0: world.t, k: 0, riders: 0, size: 1 + r() * 0.5, };
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
    water(dt);
    rites();
    people(dt);
    desert(dt);
    for (const s of systems) s.step?.(dt);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
