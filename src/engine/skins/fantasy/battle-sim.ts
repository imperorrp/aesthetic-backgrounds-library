/**
 * Shieldwall's simulation: a war of pitched battles between two peoples, seen side-on.
 * No DOM here; the headless runner steps it as is.
 *
 * Space: battle x runs along the field (0..BW); depth z runs from the far edge of the
 * field (0) to the near edge (1). A unit stands at (x, z). Distances in depth are measured
 * in `DEPTH` pixels so the field reads as a plane.
 *
 * A battle's story:
 *   muster      the armies march onto the field (the first battle starts deployed)
 *   standoff    horns and banners; sometimes the lords ride out and duel between the lines
 *   skirmish    archers loose volleys, trebuchets throw, mages strike at range
 *   clash       the lines advance and meet; horse charges the flanks; mages ward, burn,
 *               call lightning, or raise the fallen; lords rally wavering regiments
 *   rout        a side's morale breaks and it flees; the victors pursue
 *   aftermath   victors cheer, crows come down; then the next battle, days later
 * A war is the best of five battles; then peace, and a new war between new peoples.
 * Sometimes a wild dragon descends on both armies. It can be shot down.
 */
import { forkRng, type Rng } from '../../rng';
import { createBus, type Bus } from '../../sim/bus';
import { createSpatialHash } from '../../sim/spatial';
import { dragonName, heroName, makeFaction, placeName, type Faction, type People } from './names';

export type UnitKind = 'inf' | 'arch' | 'cav' | 'mage' | 'lord' | 'treb';
export type Order = 'muster' | 'hold' | 'advance' | 'charge' | 'reform' | 'rout' | 'duel';
export type Phase = 'muster' | 'standoff' | 'skirmish' | 'clash' | 'rout' | 'aftermath' | 'dusk';

export type Unit = {
  id: number;
  side: 0 | 1;
  kind: UnitKind;
  reg: Regiment;
  /** Rank and file within the regiment. */
  rank: number;
  file: number;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
  fled: boolean;
  /** Seconds until the next swing or shot. */
  cd: number;
  /** Walk-cycle phase. */
  anim: number;
  /** Showing the attack frame until then. */
  swingUntil: number;
  variant: number;
  deadAt: number;
  /** Raised from the dead (drawn rising until then). */
  risenAt: number;
  facing: 1 | -1;
  /** Where this man stands in a melee, off the straight line (px). */
  jx: number;
};

export type Regiment = {
  id: number;
  side: 0 | 1;
  kind: UnitKind;
  units: Unit[];
  order: Order;
  /** The front rank's x. */
  frontX: number;
  homeX: number;
  z0: number;
  z1: number;
  files: number;
  morale: number;
  start: number;
  cd: number;
  /** Archers: drawing until, then loose. */
  drawUntil: number;
  wardUntil: number;
  /** Recent arrow hits taken (for wards). */
  threat: number;
  chargeAt: number;
  engagedSince: number;
  routed: boolean;
  name: string;
  /** How eagerly it advances (0.7..1.2): lines do not meet all at once. */
  pace: number;
};

export type Shot = {
  kind: 'arrow' | 'boulder' | 'fireball';
  side: 0 | 1;
  x0: number;
  z0: number;
  h0: number;
  x1: number;
  z1: number;
  t0: number;
  dur: number;
  peak: number;
  /** Aimed at the dragon. */
  air: boolean;
  landed: boolean;
  /** Arrows that miss stay in the ground a while. */
  stuckUntil: number;
};

export type Effect = {
  kind: 'blast' | 'bolt' | 'ward' | 'raise' | 'dust' | 'crater' | 'spark' | 'scorch' | 'fire' | 'smite';
  x: number;
  z: number;
  h: number;
  t0: number;
  dur: number;
  r: number;
  color: string;
  seed: number;
  /** A ward follows its regiment. */
  reg?: Regiment;
};

export type Dragon = {
  name: string;
  x: number;
  z: number;
  h: number;
  vx: number;
  state: 'arrive' | 'climb' | 'dive' | 'leave' | 'fall' | 'dead';
  hp: number;
  passes: number;
  breathing: boolean;
  targetX: number;
  t0: number;
  colors: number;
  lastHit: 0 | 1 | -1;
  wing: number;
};

export type Label = { text: string; x: number; z: number; h: number; color: string; t0: number; dur: number };
export type Crow = { x: number; z: number; h: number; vx: number; landAt: number; seed: number };

/** `side`: the field is a band along the bottom, under a sky. `above`: the field is the middle of a map. */
export type BattleOptions = { troops: number; magic: number; dragons: number; weather: string; view?: 'side' | 'above' };

export type Battle = {
  n: number;
  name: string;
  day: number;
  BW: number;
  phase: Phase;
  phaseAt: number;
  t0: number;
  weather: 'night' | 'dusk' | 'overcast' | 'storm' | 'snow' | 'fog' | 'dawn';
  units: Unit[];
  regs: Regiment[];
  shots: Shot[];
  effects: Effect[];
  labels: Label[];
  crows: Crow[];
  dragon: Dragon | null;
  dragonAt: number;
  lords: [Unit | null, Unit | null];
  lordNames: [string, string];
  winner: -1 | 0 | 1;
  duel: boolean;
  /** Seconds of lightning flash left (storms, bolts). */
  flash: number;
  /** Where the fighting is, for the camera. */
  focusX: number;
  /** 0..1: how much of the field is fighting. */
  heat: number;
  firstClash: boolean;
  /** Things that happen once per battle. */
  said: Set<string>;
};

export type War = { factions: [Faction, Faction]; wins: [number, number]; name: string; n: number };

export type BattleWorld = {
  t: number;
  W: number;
  H: number;
  bus: Bus;
  war: War;
  battle: Battle;
  /** Chronicle lines for the HUD, oldest first. */
  chronicle: { t: number; text: string }[];
  readonly groundTop: number;
  readonly groundBottom: number;
  readonly depth: number;
  /** Screen y of a point on the field at depth z. */
  sy(z: number): number;
  step(dt: number): void;
  resize(W: number, H: number): void;
  counts(): Record<string, number>;
};

const PEOPLES: People[] = ['kingdom', 'horde', 'fey', 'hollow'];
const WEATHERS: Battle['weather'][] = ['dusk', 'night', 'overcast', 'storm', 'snow', 'fog', 'dawn'];

const SPEED: Record<UnitKind, number> = { inf: 22, arch: 22, cav: 34, mage: 18, lord: 38, treb: 0 };
const HP: Record<UnitKind, number> = { inf: 3, arch: 2, cav: 4, mage: 1, lord: 6, treb: 5 };
const REACH: Record<UnitKind, number> = { inf: 13, arch: 10, cav: 16, mage: 10, lord: 16, treb: 0 };

export function createBattleWorld(seed: string | number, W: number, H: number, opts: BattleOptions): BattleWorld {
  const bus = createBus(() => world.t);
  let nextId = 1;
  const hash = createSpatialHash<Unit>(28);
  const near: Unit[] = [];

  const newWar = (n: number): War => {
    const r = forkRng(seed, `war-${n}`);
    const a = PEOPLES[Math.floor(r() * PEOPLES.length)];
    let b = PEOPLES[Math.floor(r() * PEOPLES.length)];
    if (b === a && r() < 0.7) b = PEOPLES[(PEOPLES.indexOf(a) + 1 + Math.floor(r() * 3)) % PEOPLES.length];
    const fa = makeFaction(a, r);
    const fb = makeFaction(b, r, fa.color);
    if (fb.name === fa.name) fb.name = fb.name.replace('THE ', 'THE NEW ');
    return { factions: [fa, fb], wins: [0, 0], name: placeName(r), n };
  };

  const world: BattleWorld = {
    t: 0,
    W,
    H,
    bus,
    war: newWar(0),
    battle: null as unknown as Battle,
    chronicle: [],
    get groundTop() {
      return world.H * (opts.view === 'above' ? 0.22 : 0.6);
    },
    get groundBottom() {
      return world.H * (opts.view === 'above' ? 0.84 : 0.965);
    },
    get depth() {
      return world.groundBottom - world.groundTop;
    },
    sy: (z) => world.groundTop + z * world.depth,
    step,
    resize(w, h) {
      world.W = w;
      world.H = h;
    },
    counts() {
      const b = world.battle;
      const alive = [0, 0];
      let dead = 0;
      for (const u of b.units) {
        if (u.alive && !u.fled) alive[u.side]++;
        else if (!u.alive) dead++;
      }
      return { battle: b.n, phase: ['muster', 'standoff', 'skirmish', 'clash', 'rout', 'aftermath', 'dusk'].indexOf(b.phase), a: alive[0], b: alive[1], dead, shots: b.shots.length, effects: b.effects.length, dragon: b.dragon ? 1 : 0 };
    },
  };

  // ---- telling -------------------------------------------------------------------------------

  const say = (text: string, x: number, z: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium', h = 46) => {
    const b = world.battle;
    // The same words twice in a breath read as a stutter.
    if (b.labels.some((l) => l.text === text && world.t - l.t0 < 3)) return;
    b.labels.push({ text, x, z, h, color, t0: world.t, dur: 4.8 });
    if (b.labels.length > 10) b.labels.shift();
    bus.emit({ type: 'say', text, x, y: world.sy(z) - h, color, priority });
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 6) world.chronicle.shift();
  };
  const emit = (type: string, x: number, z: number, weight: number, extra: Record<string, unknown> = {}) => bus.emit({ type, x, y: world.sy(z), weight, ...extra });
  const side = (s: 0 | 1) => world.war.factions[s];
  /** True the first time it is asked for a key in this battle. */
  const once = (key: string) => {
    const said = world.battle.said;
    if (said.has(key)) return false;
    said.add(key);
    return true;
  };
  const short = (s: 0 | 1) => side(s).name.replace(/^THE /, '');

  // ---- a battle ---------------------------------------------------------------------------

  function newBattle(n: number, deployed: boolean, day: number): Battle {
    const r = forkRng(seed, `battle-${world.war.n}-${n}`);
    const BW = Math.max(1800, world.W * 1.8);
    const wanted = opts.weather;
    const weather: Battle['weather'] =
      wanted === 'clear' ? (r() < 0.5 ? 'dusk' : 'dawn') : wanted === 'rain' ? 'storm' : wanted === 'snow' ? 'snow' : wanted === 'fog' ? 'fog' : wanted === 'night' ? 'night' : WEATHERS[Math.floor(r() * WEATHERS.length)];
    const b: Battle = {
      n,
      name: placeName(r),
      day,
      BW,
      phase: deployed ? 'standoff' : 'muster',
      phaseAt: world.t,
      t0: world.t,
      weather,
      units: [],
      regs: [],
      shots: [],
      effects: [],
      labels: [],
      crows: [],
      dragon: null,
      // Whether a dragon comes is decided now; when, once the lines meet (see 'skirmish').
      dragonAt: r() < 0.24 * opts.dragons ? 1 : Infinity,
      lords: [null, null],
      lordNames: [heroName(r), heroName(r)],
      winner: -1,
      duel: r() < 0.3,
      flash: 0,
      focusX: BW / 2,
      heat: 0,
      firstClash: true,
      said: new Set(),
    };
    if (b.lordNames[1] === b.lordNames[0]) b.lordNames[1] = 'THE BLACK PRINCE';
    for (const s of [0, 1] as const) deploy(b, s, r, deployed);
    return b;
  }

  function deploy(b: Battle, s: 0 | 1, r: Rng, deployed: boolean) {
    const f = side(s);
    const dir = s === 0 ? 1 : -1;
    const front = s === 0 ? b.BW * 0.355 : b.BW * 0.645;
    const k = Math.max(0.3, opts.troops);
    const total = Math.round(150 * k);
    const nArch = Math.round(total * f.archers);
    const nCav = Math.round(total * f.riders);
    const nInf = Math.max(20, total - nArch - nCav);
    /** A block: `files` men across in depth (about 9 px apart on screen), as many ranks deep as it takes. */
    const add = (kind: UnitKind, count: number, x: number, zc: number, files: number, name: string): Regiment => {
      const half = (files * 9) / Math.max(120, world.depth) / 2;
      const z0 = Math.max(0.01, zc - half);
      const z1 = Math.min(0.99, zc + half);
      const reg: Regiment = {
        id: nextId++, side: s, kind, units: [], order: deployed ? 'hold' : 'muster', frontX: x, homeX: x, z0, z1, files: Math.max(1, Math.min(files, count)),
        // On the first field, the bows are already strung: the opening frames have arrows in the air.
        morale: 0.85 + r() * 0.15, start: count, cd: deployed && (kind === 'arch' || kind === 'treb') ? 0.2 + r() * 0.5 : 1 + r() * 2, drawUntil: -1, wardUntil: -1, threat: 0, chargeAt: Infinity, engagedSince: -1, routed: false, name,
        pace: 0.7 + r() * 0.5,
      };
      for (let i = 0; i < count; i++) {
        const rank = Math.floor(i / reg.files);
        const file = i % reg.files;
        const sx = x - dir * rank * (kind === 'cav' ? 20 : 12);
        const z = z0 + ((file + 0.5) / reg.files) * (z1 - z0) + (r() - 0.5) * 0.01;
        const u: Unit = {
          id: nextId++, side: s, kind, reg, rank, file, x: deployed ? sx : sx - dir * (380 + r() * 60), z, hp: HP[kind], alive: true, fled: false,
          cd: r() * 1.5, anim: r() * 10, swingUntil: -1, variant: Math.floor(r() * 3), deadAt: -1, risenAt: -1, facing: dir as 1 | -1, jx: (r() - 0.5) * 22,
        };
        reg.units.push(u);
        b.units.push(u);
      }
      b.regs.push(reg);
      return reg;
    };
    // The line: blocks of foot at different depths, ragged: some forward, some held back.
    const infRegs = nInf > 110 ? 4 : 3;
    const files = infRegs === 4 ? 5 : 6;
    for (let i = 0; i < infRegs; i++) {
      const zc = 0.2 + (i / (infRegs - 1)) * 0.6;
      add('inf', Math.round(nInf / infRegs), front + dir * (r() - 0.5) * 90, zc, files, `${short(s)} FOOT`);
    }
    // Archers behind it, between the blocks.
    if (nArch > 0) {
      add('arch', Math.ceil(nArch / 2), front - dir * 110, 0.34, 5, `${short(s)} BOWS`);
      add('arch', Math.floor(nArch / 2), front - dir * 110, 0.66, 5, `${short(s)} BOWS`);
    }
    // Horse on the flanks, far and near.
    if (nCav > 0) {
      add('cav', Math.ceil(nCav / 2), front - dir * 60, 0.05, 3, `${short(s)} HORSE`);
      add('cav', Math.floor(nCav / 2), front - dir * 60, 0.95, 3, `${short(s)} HORSE`);
    }
    // Mages, the lord and his guard, and a trebuchet.
    const nMage = Math.round(f.mages * Math.min(2, opts.magic));
    if (nMage > 0) add('mage', nMage, front - dir * 165, 0.5, nMage * 4, `${short(s)} MAGES`);
    add('inf', 10, front - dir * 210, 0.5, 3, `${short(s)} GUARD`);
    const lordReg = add('lord', 1, front - dir * 240, 0.5, 1, b.lordNames[s]);
    b.lords[s] = lordReg.units[0];
    add('treb', 1, front - dir * 300, 0.12 + r() * 0.1, 1, `${short(s)} ENGINES`);
  }

  // ---- helpers ------------------------------------------------------------------------------

  const D = () => world.depth * 0.7;
  const dist = (a: Unit, x: number, z: number) => Math.hypot(a.x - x, (a.z - z) * D());
  const kill = (u: Unit, by: 0 | 1 | -1) => {
    if (!u.alive) return;
    u.alive = false;
    u.deadAt = world.t;
    u.reg.morale -= (u.kind === 'lord' ? 0 : 0.8) / Math.max(4, u.reg.start);
    void by;
    if (u.kind === 'lord') lordFalls(u);
  };
  const hurt = (u: Unit, dmg: number, by: 0 | 1 | -1) => {
    if (!u.alive) return;
    u.hp -= dmg;
    if (u.hp <= 0) kill(u, by);
  };

  function lordFalls(u: Unit) {
    const b = world.battle;
    const s = u.side;
    b.lords[s] = null;
    for (const g of b.regs) if (g.side === s) g.morale -= 0.3;
    for (const g of b.regs) if (g.side !== s) g.morale = Math.min(1, g.morale + 0.12);
    say(`${b.lordNames[s]} HAS FALLEN`, u.x, u.z, '#fca5a5', 'high', 60);
    emit('lordfall', u.x, u.z, 0.85, { color: side(s).color });
    chronicle(`${titled(b.lordNames[s])} of the ${titled(short(s))} fell at ${titled(b.name)}.`);
  }

  /** The living enemies of a side within r of a point. */
  const enemiesNear = (s: 0 | 1, x: number, z: number, r: number) => hash.query(x, z * D(), r, near).filter((u) => u.side !== s && u.alive && !u.fled);

  const regCenter = (g: Regiment) => {
    let x = 0;
    let z = 0;
    let n = 0;
    for (const u of g.units) {
      if (!u.alive || u.fled) continue;
      x += u.x;
      z += u.z;
      n++;
    }
    return n ? { x: x / n, z: z / n, n } : null;
  };

  /** The enemy regiment with the most men within `range` of x: the best target for a volley or a spell. */
  const bestTarget = (s: 0 | 1, x: number, range: number, avoidMelee: boolean) => {
    let best: { x: number; z: number; n: number; reg: Regiment } | null = null;
    for (const g of world.battle.regs) {
      if (g.side === s || g.routed || g.kind === 'treb') continue;
      const c = regCenter(g);
      if (!c || Math.abs(c.x - x) > range) continue;
      // Do not shoot into a melee your own side is in.
      if (avoidMelee && g.engagedSince >= 0) continue;
      if (!best || c.n > best.n) best = { ...c, reg: g };
    }
    return best;
  };

  // ---- the phases --------------------------------------------------------------------------

  function setPhase(p: Phase) {
    const b = world.battle;
    b.phase = p;
    b.phaseAt = world.t;
  }

  function phases(r: Rng) {
    const b = world.battle;
    const age = world.t - b.phaseAt;
    switch (b.phase) {
      case 'muster': {
        if (age > 1 && once('muster0')) say(`${side(0).name} TAKES THE FIELD`, b.BW * 0.25, 0.3, side(0).color, 'medium');
        if (age > 2.5 && once('muster1')) say(`${side(1).name} TAKES THE FIELD`, b.BW * 0.75, 0.3, side(1).color, 'medium');
        if (age > 14) {
          for (const g of b.regs) if (g.order === 'muster') g.order = 'hold';
          setPhase('standoff');
        }
        break;
      }
      case 'standoff': {
        if (once('standoff')) {
          emit('horns', b.BW / 2, 0.5, 0.5);
          if (b.n > 0 || world.t > 1) say(`THE FIELD OF ${b.name}`, b.BW / 2, 0.15, '#fde68a', 'medium', 70);
        }
        if (b.duel && b.lords[0] && b.lords[1] && age > 3 && !duelOn) startDuel();
        const until = duelOn ? Infinity : b.n === 0 && world.t < 30 ? 1.5 : 8;
        if (age > until) setPhase('skirmish');
        break;
      }
      case 'skirmish':
        if (age > 22) {
          setPhase('clash');
          for (const g of b.regs) if (g.kind === 'inf' && g.order === 'hold' && !g.name.endsWith('GUARD')) g.order = 'advance';
          for (const g of b.regs) if (g.kind === 'cav') g.chargeAt = world.t + 6 + r() * 14;
          if (b.dragonAt === 1) b.dragonAt = world.t + 12 + r() * 25;
          say(side(0).cry, b.BW * 0.36, 0.5, side(0).color, 'low');
          say(side(1).cry, b.BW * 0.64, 0.5, side(1).color, 'low');
          emit('advance', b.BW / 2, 0.5, 0.5);
        }
        break;
      case 'clash':
        if (world.t > b.dragonAt && !b.dragon) spawnDragon(r);
        break;
      case 'rout':
        if (age > 9) {
          setPhase('aftermath');
          for (const u of b.units) if (u.alive && !u.fled && u.side === b.winner) u.swingUntil = -1;
          // Crows come down on the field.
          for (let i = 0; i < 9; i++) b.crows.push({ x: b.focusX + (r() - 0.5) * world.W, z: 0.1 + r() * 0.8, h: 220 + r() * 120, vx: (r() - 0.5) * 40, landAt: world.t + 2 + r() * 8, seed: Math.floor(r() * 1e6) });
        }
        break;
      case 'aftermath':
        if (age > 13) setPhase('dusk');
        break;
      case 'dusk':
        if (age > 2.2) nextBattle(r);
        break;
    }
  }

  function nextBattle(r: Rng) {
    const b = world.battle;
    const w = world.war;
    if (w.wins[0] >= 3 || w.wins[1] >= 3) {
      const winner = w.wins[0] >= 3 ? 0 : 1;
      chronicle(`The war of ${titled(w.name)} ended. The ${titled(short(winner))} won it, ${w.wins[winner]} battles to ${w.wins[1 - winner]}.`);
      world.war = newWar(w.n + 1);
      world.battle = newBattle(0, false, b.day + 30 + Math.floor(r() * 300));
      say(`A NEW WAR · ${world.war.factions[0].name} AND ${world.war.factions[1].name}`, world.battle.BW / 2, 0.2, '#fde68a', 'high', 80);
      emit('newwar', world.battle.BW / 2, 0.5, 0.6);
      return;
    }
    world.battle = newBattle(b.n + 1, false, b.day + 1 + Math.floor(r() * 4));
    emit('newbattle', world.battle.BW / 2, 0.5, 0.3);
  }

  // ---- the duel -----------------------------------------------------------------------------

  let duelOn = false;
  function startDuel() {
    const b = world.battle;
    duelOn = true;
    for (const s of [0, 1] as const) {
      const l = b.lords[s]!;
      l.reg.order = 'duel';
    }
    say('THE LORDS MEET BETWEEN THE LINES', b.BW / 2, 0.45, '#fde68a', 'high', 70);
    emit('duel', b.BW / 2, 0.5, 0.7);
  }

  function duel(dt: number, r: Rng) {
    const b = world.battle;
    const a = b.lords[0];
    const c = b.lords[1];
    if (!a || !c) {
      duelOn = false;
      if (b.phase === 'standoff') setPhase('skirmish');
      return;
    }
    const mid = b.BW / 2;
    for (const l of [a, c]) {
      const tx = mid - (l.side === 0 ? 1 : -1) * 12;
      const dx = tx - l.x;
      l.x += Math.sign(dx) * Math.min(Math.abs(dx), SPEED.lord * dt);
      l.z += (0.5 - l.z) * Math.min(1, dt * 2);
      l.anim += dt * (Math.abs(dx) > 1 ? 8 : 0);
    }
    if (Math.abs(a.x - c.x) > 30) return;
    for (const l of [a, c]) {
      l.cd -= dt;
      if (l.cd > 0) continue;
      l.cd = 0.9 + r() * 0.7;
      l.swingUntil = world.t + 0.3;
      const foe = l === a ? c : a;
      b.effects.push({ kind: 'spark', x: (a.x + c.x) / 2, z: 0.5, h: 22, t0: world.t, dur: 0.25, r: 8, color: '#fde68a', seed: Math.floor(r() * 1e6) });
      if (r() < 0.4) hurt(foe, 2, l.side);
      if (!foe.alive) {
        const s = l.side;
        say(`${b.lordNames[s]} WINS THE DUEL`, l.x, l.z, side(s).color, 'high', 64);
        emit('duelwin', l.x, l.z, 0.7);
        l.reg.order = 'hold';
        duelOn = false;
        setPhase('skirmish');
        return;
      }
    }
  }

  // ---- the dragon ---------------------------------------------------------------------------

  function spawnDragon(r: Rng) {
    const b = world.battle;
    const fromLeft = r() < 0.5;
    b.dragon = {
      name: dragonName(r), x: fromLeft ? b.focusX - world.W : b.focusX + world.W, z: 0.3 + r() * 0.4, h: 340, vx: fromLeft ? 150 : -150,
      state: 'arrive', hp: 10, passes: 0, breathing: false, targetX: b.focusX, t0: world.t, colors: Math.floor(r() * 4), lastHit: -1, wing: 0,
    };
    say(`A DRAGON DESCENDS · ${b.dragon.name}`, b.focusX, 0.3, '#fb923c', 'high', 160);
    emit('dragon', b.focusX, 0.3, 0.9);
    chronicle(`${titled(b.dragon.name)} came down on the field of ${titled(b.name)}.`);
  }

  function dragonStep(dt: number, r: Rng) {
    const b = world.battle;
    const d = b.dragon;
    if (!d) return;
    d.wing += dt * (d.state === 'fall' ? 18 : 7);
    const dirTo = (x: number) => (x > d.x ? 1 : -1);
    switch (d.state) {
      case 'arrive':
        d.x += d.vx * dt;
        d.h += (180 - d.h) * dt * 0.6;
        if (Math.abs(d.x - b.focusX) < 220) {
          d.state = 'dive';
          d.targetX = d.x + Math.sign(d.vx) * 420;
          d.z = densestZ(d.x) ?? d.z;
        }
        break;
      case 'dive':
        d.vx += (Math.sign(d.targetX - d.x) * 170 - d.vx) * dt * 2;
        d.x += d.vx * dt;
        d.h += (52 - d.h) * dt * 2.2;
        d.breathing = d.h < 90;
        if (d.breathing) breathe(d, dt, r);
        if (Math.sign(d.targetX - d.x) !== Math.sign(d.vx) || Math.abs(d.targetX - d.x) < 10) {
          d.passes++;
          d.breathing = false;
          d.state = d.passes >= 2 + Math.floor(r() * 2) ? 'leave' : 'climb';
          d.t0 = world.t;
        }
        break;
      case 'climb':
        d.h += (230 - d.h) * dt * 1.2;
        d.x += d.vx * dt;
        d.vx += (-Math.sign(d.vx) * 140 - d.vx) * dt * 0.7;
        if (world.t - d.t0 > 3.2) {
          d.state = 'dive';
          d.targetX = b.focusX + dirTo(b.focusX) * 260;
          d.z = densestZ(b.focusX) ?? d.z;
        }
        break;
      case 'leave':
        d.h += 120 * dt;
        d.x += d.vx * dt;
        if (d.h > 600) {
          say(`${d.name} FLIES AWAY`, d.x, d.z, '#fdba74', 'medium', 200);
          emit('dragonleaves', d.x, d.z, 0.4);
          b.dragon = null;
        }
        break;
      case 'fall':
        d.h -= (60 + (world.t - d.t0) * 160) * dt;
        d.x += d.vx * dt * 0.6;
        if (d.h <= 4) {
          d.h = 0;
          d.state = 'dead';
          b.effects.push({ kind: 'dust', x: d.x, z: d.z, h: 0, t0: world.t, dur: 3, r: 90, color: '#78716c', seed: 7 });
          b.effects.push({ kind: 'crater', x: d.x, z: d.z, h: 0, t0: world.t, dur: 999, r: 60, color: '#1c1917', seed: 9 });
          for (const u of enemiesNear(-1 as unknown as 0, d.x, d.z, 50)) kill(u, -1);
          const by = d.lastHit >= 0 ? ` BY ${side(d.lastHit as 0 | 1).name}` : '';
          say(`${d.name} IS SLAIN${by}`, d.x, d.z, '#fde68a', 'high', 90);
          emit('dragonslain', d.x, d.z, 1);
          chronicle(`${titled(d.name)} was brought down at ${titled(b.name)}${d.lastHit >= 0 ? ` by the ${titled(short(d.lastHit as 0 | 1))}` : ''}.`);
          for (const g of b.regs) if (d.lastHit >= 0 && g.side === d.lastHit) g.morale = Math.min(1, g.morale + 0.2);
        }
        break;
    }
  }

  const densestZ = (x: number) => {
    let best = -1;
    let bz: number | null = null;
    for (let z = 0.15; z <= 0.85; z += 0.1) {
      const n = hash.query(x, z * D(), 90, near).filter((u) => u.alive).length;
      if (n > best) {
        best = n;
        bz = z;
      }
    }
    return bz;
  };

  let breathTick = 0;
  function breathe(d: Dragon, dt: number, r: Rng) {
    const b = world.battle;
    breathTick -= dt;
    if (breathTick > 0) return;
    breathTick = 0.12;
    const fx = d.x + Math.sign(d.vx) * 30;
    b.effects.push({ kind: 'fire', x: fx, z: d.z, h: 0, t0: world.t, dur: 1.6, r: 22, color: '#fb923c', seed: Math.floor(r() * 1e6) });
    if (r() < 0.25) b.effects.push({ kind: 'scorch', x: fx, z: d.z, h: 0, t0: world.t, dur: 60, r: 18, color: '#0c0a09', seed: Math.floor(r() * 1e6) });
    for (const u of hash.query(fx, d.z * D(), 28, near)) {
      if (!u.alive || u.fled || r() > 0.4) continue;
      kill(u, -1);
      u.reg.morale -= 0.02;
    }
    if (d.passes === 0 && !b.labels.some((l) => l.text.includes('FIRE'))) {
      say('DRAGONFIRE', fx, d.z, '#fb923c', 'high', 30);
      emit('dragonfire', fx, d.z, 0.8);
    }
  }

  /** Something struck the dragon. */
  function hitDragon(dmg: number, by: 0 | 1) {
    const d = world.battle.dragon;
    if (!d || d.state === 'fall' || d.state === 'dead' || d.state === 'leave') return;
    d.hp -= dmg;
    d.lastHit = by;
    if (d.hp <= 0) {
      d.state = 'fall';
      d.t0 = world.t;
      d.breathing = false;
      say(`${d.name} IS FALLING`, d.x, d.z, '#fde68a', 'high', d.h + 30);
    }
  }

  // ---- shooting and casting ----------------------------------------------------------------

  function archers(g: Regiment, dt: number, r: Rng) {
    const b = world.battle;
    if (g.routed || b.phase === 'muster' || b.phase === 'standoff' || b.phase === 'aftermath' || b.phase === 'dusk') return;
    g.cd -= dt;
    const c = regCenter(g);
    if (!c) return;
    // A dragon diving in range: bows up, now.
    const d = b.dragon;
    if (d && (d.state === 'dive' || d.state === 'climb') && Math.abs(d.x - c.x) < 700 && g.cd > 1 && g.drawUntil < 0) g.cd = 0.2 + r() * 0.6;
    if (g.drawUntil > 0 && world.t >= g.drawUntil) {
      g.drawUntil = -1;
      loose(g, c, r);
      return;
    }
    if (g.cd > 0 || g.drawUntil > 0) return;
    g.cd = 4.5 + r() * 2.5;
    g.drawUntil = world.t + 0.7;
    for (const u of g.units) if (u.alive) u.swingUntil = g.drawUntil;
  }

  function loose(g: Regiment, c: { x: number; z: number }, r: Rng) {
    const b = world.battle;
    const d = b.dragon;
    const atDragon = !!d && (d.state === 'dive' || d.state === 'climb') && d.h < 220 && Math.abs(d.x - c.x) < 700 && r() < 0.75;
    const target = atDragon ? null : bestTarget(g.side, c.x, 1100, true);
    if (!atDragon && !target) return;
    const shooters = g.units.filter((u) => u.alive && !u.fled);
    for (const [i, u] of shooters.entries()) {
      if (i >= 36) break;
      // At the dragon: lead it by the arrow's own flight time.
      const guess = atDragon ? Math.abs(d!.x - u.x) : 0;
      const lead = atDragon ? 1.1 + guess / 650 : 0;
      const tx = atDragon ? d!.x + d!.vx * lead + (r() - 0.5) * 40 : target!.x + (r() - 0.5) * 50;
      const tz = atDragon ? d!.z : target!.z + (r() - 0.5) * 0.14;
      const span = Math.abs(tx - u.x);
      b.shots.push({ kind: 'arrow', side: g.side, x0: u.x, z0: u.z, h0: 16, x1: tx, z1: tz, t0: world.t + r() * 0.15, dur: 1.1 + span / 650, peak: atDragon ? d!.h + 10 : 50 + span * 0.22, air: atDragon, landed: false, stuckUntil: 0 });
    }
    const where = atDragon ? d!.x : target!.x;
    emit('volley', where, atDragon ? d!.z : target!.z, 0.45, { color: side(g.side).color });
    if (b.n === 0 && !b.labels.some((l) => l.text === 'LOOSE')) say('LOOSE', c.x, c.z, side(g.side).color, 'low', 40);
  }

  function engines(g: Regiment, dt: number, r: Rng) {
    const b = world.battle;
    if (b.phase !== 'skirmish' && b.phase !== 'clash') return;
    const u = g.units[0];
    if (!u?.alive) return;
    g.cd -= dt;
    if (g.cd > 0) return;
    g.cd = 9 + r() * 5;
    const t = bestTarget(g.side, u.x, 1400, true);
    if (!t) return;
    u.swingUntil = world.t + 0.8;
    b.shots.push({ kind: 'boulder', side: g.side, x0: u.x + (g.side === 0 ? 10 : -10), z0: u.z, h0: 40, x1: t.x + (r() - 0.5) * 30, z1: t.z, t0: world.t + 0.3, dur: 2.6, peak: 300, air: false, landed: false, stuckUntil: 0 });
    emit('boulder', u.x, u.z, 0.4);
  }

  function mages(g: Regiment, dt: number, r: Rng) {
    const b = world.battle;
    if (g.routed || (b.phase !== 'skirmish' && b.phase !== 'clash')) return;
    const f = side(g.side);
    for (const u of g.units) {
      if (!u.alive || u.fled) continue;
      u.cd -= dt * Math.max(0.3, opts.magic);
      if (u.cd > 0) continue;
      u.cd = 8 + r() * 6;
      u.swingUntil = world.t + 0.9;
      const d = b.dragon;
      const dragonClose = d && (d.state === 'dive' || d.state === 'climb') && Math.abs(d.x - u.x) < 600;
      if (f.magic === 'storm') {
        if (dragonClose && r() < 0.7) {
          bolt(d!.x, d!.z, d!.h, f.kit.magic, r);
          hitDragon(4, g.side);
          continue;
        }
        const t = bestTarget(g.side, u.x, 800, true) ?? bestTarget(g.side, u.x, 800, false);
        if (!t) continue;
        const x = t.x + (r() - 0.5) * 30;
        bolt(x, t.z, 0, f.kit.magic, r);
        for (const e of enemiesNear(g.side, x, t.z, 26)) if (r() < 0.8) hurt(e, 3, g.side);
        emit('lightning', x, t.z, 0.75, { color: f.kit.magic });
      } else if (f.magic === 'fire') {
        const t = bestTarget(g.side, u.x, 750, true) ?? bestTarget(g.side, u.x, 750, false);
        if (dragonClose && r() < 0.4) {
          b.shots.push({ kind: 'fireball', side: g.side, x0: u.x, z0: u.z, h0: 24, x1: d!.x, z1: d!.z, t0: world.t + 0.5, dur: 1, peak: d!.h + 20, air: true, landed: false, stuckUntil: 0 });
          continue;
        }
        if (!t) continue;
        b.shots.push({ kind: 'fireball', side: g.side, x0: u.x, z0: u.z, h0: 24, x1: t.x + (r() - 0.5) * 20, z1: t.z, t0: world.t + 0.5, dur: 1.2 + Math.abs(t.x - u.x) / 900, peak: 70, air: false, landed: false, stuckUntil: 0 });
        emit('fireball', u.x, u.z, 0.5, { color: f.kit.magic });
      } else if (f.magic === 'ward') {
        // Shield the regiment taking the most arrows; with no arrows falling, smite.
        let best: Regiment | null = null;
        for (const o of b.regs) if (o.side === g.side && !o.routed && o.threat > 2 && o.wardUntil < world.t && (!best || o.threat > best.threat)) best = o;
        if (best) {
          best.wardUntil = world.t + 9;
          best.threat = 0;
          const c = regCenter(best);
          if (c) {
            b.effects.push({ kind: 'ward', x: c.x, z: c.z, h: 0, t0: world.t, dur: 9, r: 60, color: f.kit.magic, seed: best.id, reg: best });
            emit('ward', c.x, c.z, 0.5, { color: f.kit.magic });
            if (r() < 0.5) say('A WARD IS RAISED', c.x, c.z, f.kit.magic, 'low', 70);
          }
        } else if (b.phase === 'clash' || dragonClose) {
          if (dragonClose && r() < 0.6) {
            b.effects.push({ kind: 'smite', x: d!.x, z: d!.z, h: d!.h, t0: world.t, dur: 0.6, r: 14, color: f.kit.magic, seed: 1 });
            hitDragon(3, g.side);
            continue;
          }
          const t = bestTarget(g.side, u.x, 700, true);
          if (!t) continue;
          b.effects.push({ kind: 'smite', x: t.x, z: t.z, h: 0, t0: world.t, dur: 0.8, r: 18, color: f.kit.magic, seed: Math.floor(r() * 1e6) });
          for (const e of enemiesNear(g.side, t.x, t.z, 22)) if (r() < 0.6) hurt(e, 2, g.side);
          emit('smite', t.x, t.z, 0.55, { color: f.kit.magic });
        }
      } else if (f.magic === 'raise') {
        if (b.phase !== 'clash') continue;
        // Raise the nearest fallen (of either side) as the Legion's own.
        const dead = b.units.filter((x) => !x.alive && x.kind === 'inf' && x.risenAt < 0 && world.t - x.deadAt > 3 && Math.abs(x.x - u.x) < 420);
        if (dead.length < 3) continue;
        let reg = b.regs.find((o) => o.side === g.side && o.name === 'THE RISEN');
        if (!reg) {
          reg = { ...g, id: nextId++, kind: 'inf', units: [], order: 'advance', frontX: u.x, homeX: u.x, z0: 0.2, z1: 0.8, files: 6, morale: 1, start: 6, cd: 0, drawUntil: -1, wardUntil: -1, threat: 0, chargeAt: Infinity, engagedSince: -1, routed: false, name: 'THE RISEN' };
          b.regs.push(reg);
        }
        const n = Math.min(6, dead.length);
        let cx = 0;
        let cz = 0;
        for (let i = 0; i < n; i++) {
          const c = dead[Math.floor(r() * dead.length)];
          if (c.risenAt >= 0) continue;
          c.risenAt = 0;
          const risen: Unit = { ...c, id: nextId++, side: g.side, reg, alive: true, fled: false, hp: 1, cd: 1.5, risenAt: world.t, deadAt: -1, swingUntil: -1, facing: g.side === 0 ? 1 : -1, rank: 0, file: reg.units.length % 6 };
          reg.units.push(risen);
          reg.start++;
          b.units.push(risen);
          cx += c.x;
          cz += c.z;
          b.effects.push({ kind: 'raise', x: c.x, z: c.z, h: 0, t0: world.t, dur: 1.6, r: 10, color: f.kit.magic, seed: c.id });
        }
        // Raising takes it out of a necromancer: a long rest before the next.
        u.cd = 18 + r() * 12;
        if (n) {
          if (once(`raise-${Math.floor(world.t / 30)}`)) say('THE DEAD RISE', cx / n, cz / n, f.kit.magic, 'high', 50);
          emit('raise', cx / n, cz / n, 0.7, { color: f.kit.magic });
        }
      }
    }
  }

  function bolt(x: number, z: number, h: number, color: string, r: Rng) {
    const b = world.battle;
    b.effects.push({ kind: 'bolt', x, z, h, t0: world.t, dur: 0.45, r: 18, color, seed: Math.floor(r() * 1e6) });
    b.effects.push({ kind: 'scorch', x, z, h: 0, t0: world.t, dur: 40, r: 14, color: '#0c0a09', seed: Math.floor(r() * 1e6) });
    b.flash = Math.max(b.flash, 0.25);
  }

  // ---- shots in flight ----------------------------------------------------------------------

  function shots(r: Rng) {
    const b = world.battle;
    for (let i = b.shots.length - 1; i >= 0; i--) {
      const s = b.shots[i];
      if (s.landed) {
        if (world.t > s.stuckUntil) b.shots.splice(i, 1);
        continue;
      }
      if (world.t < s.t0 + s.dur) continue;
      s.landed = true;
      s.stuckUntil = s.kind === 'arrow' && !s.air ? world.t + 5 + r() * 4 : world.t;
      if (s.air) {
        const d = b.dragon;
        if (d && Math.abs(d.x - s.x1) < 60 && (s.kind === 'fireball' || r() < 0.32)) hitDragon(s.kind === 'fireball' ? 1 : 0.5, s.side);
        continue;
      }
      if (s.kind === 'arrow') {
        const hit = hash.query(s.x1, s.z1 * D(), 9, near).find((u) => u.side !== s.side && u.alive && !u.fled);
        if (!hit) continue;
        hit.reg.threat++;
        const warded = hit.reg.wardUntil > world.t;
        if (r() < (warded ? 0.04 : hit.kind === 'cav' ? 0.25 : 0.4)) hurt(hit, 1, s.side);
        s.stuckUntil = world.t;
      } else if (s.kind === 'boulder') {
        b.effects.push({ kind: 'dust', x: s.x1, z: s.z1, h: 0, t0: world.t, dur: 1.6, r: 30, color: '#a8a29e', seed: Math.floor(r() * 1e6) });
        b.effects.push({ kind: 'crater', x: s.x1, z: s.z1, h: 0, t0: world.t, dur: 120, r: 12, color: '#1c1917', seed: Math.floor(r() * 1e6) });
        for (const u of enemiesNear(s.side, s.x1, s.z1, 24)) if (r() < 0.7) hurt(u, 2, s.side);
        emit('impact', s.x1, s.z1, 0.55);
      } else {
        b.effects.push({ kind: 'blast', x: s.x1, z: s.z1, h: 0, t0: world.t, dur: 0.9, r: 36, color: side(s.side).kit.magic, seed: Math.floor(r() * 1e6) });
        b.effects.push({ kind: 'scorch', x: s.x1, z: s.z1, h: 0, t0: world.t, dur: 50, r: 22, color: '#0c0a09', seed: Math.floor(r() * 1e6) });
        for (const u of enemiesNear(s.side, s.x1, s.z1, 34)) if (r() < 0.75) hurt(u, 2, s.side);
        b.flash = Math.max(b.flash, 0.12);
        emit('blast', s.x1, s.z1, 0.7, { color: side(s.side).kit.magic });
      }
    }
  }

  // ---- regiments ------------------------------------------------------------------------------

  function regiments(dt: number, r: Rng) {
    const b = world.battle;
    for (const g of b.regs) {
      const dir = g.side === 0 ? 1 : -1;
      const c = regCenter(g);
      if (!c) continue;
      const engaged = g.units.filter((u) => u.alive && u.swingUntil > world.t - 1.5 && u.kind !== 'arch').length / Math.max(1, c.n);
      if (engaged > 0.15 && g.engagedSince < 0) g.engagedSince = world.t;
      if (engaged < 0.05) g.engagedSince = -1;
      g.threat = Math.max(0, g.threat - dt * 0.15);
      if (!g.routed && g.engagedSince < 0) g.morale = Math.min(1, g.morale + dt * 0.008);
      if (g.kind === 'arch') archers(g, dt, r);
      if (g.kind === 'treb') engines(g, dt, r);
      if (g.kind === 'mage') mages(g, dt, r);
      if (g.routed) continue;
      // Breaking.
      if (g.morale < 0.15 && b.phase === 'clash' && g.kind !== 'lord' && g.kind !== 'treb') {
        g.routed = true;
        g.order = 'rout';
        for (const o of b.regs) if (o.side === g.side && o !== g) o.morale -= 0.05;
        if (g.kind === 'inf' || g.kind === 'cav') {
          if (once(`break-${g.side}-${Math.floor(world.t / 8)}`)) say(`${g.name} BREAKS`, c.x, c.z, '#fca5a5', 'medium', 50);
          emit('rout', c.x, c.z, 0.55);
        }
        continue;
      }
      switch (g.order) {
        case 'advance': {
          // Walk forward until the front is fighting.
          // Walk on until there are enemies just ahead in this block's own lane; with the lane
          // empty, wheel toward the nearest foe. Blocks meet where they meet: a ragged front.
          const zc = (g.z0 + g.z1) / 2;
          const ahead = enemiesNear(g.side, g.frontX + dir * 22, zc, 60).length > 0;
          if (engaged < 0.25 && !ahead) g.frontX += dir * SPEED.inf * g.pace * dt;
          g.frontX = Math.max(60, Math.min(b.BW - 60, g.frontX));
          if (!ahead && engaged < 0.1) {
            let near: { x: number; z: number } | null = null;
            let nd = Infinity;
            for (const o of b.regs) {
              if (o.side === g.side || o.routed || o.kind === 'treb') continue;
              const oc = regCenter(o);
              if (!oc) continue;
              const d = Math.abs(oc.x - c.x) + Math.abs(oc.z - zc) * D();
              if (d < nd) {
                nd = d;
                near = oc;
              }
            }
            if (near && Math.abs(near.z - zc) > 0.05) {
              const shift = Math.sign(near.z - zc) * Math.min(Math.abs(near.z - zc), dt * 0.04);
              g.z0 = Math.max(0.01, g.z0 + shift);
              g.z1 = Math.min(0.99, g.z1 + shift);
            }
          }
          if (b.firstClash && engaged > 0.2) {
            b.firstClash = false;
            say('THE LINES MEET', c.x, c.z, '#fde68a', 'medium', 60);
            emit('clash', c.x, c.z, 0.7);
            chronicle(`At ${titled(b.name)} the lines met.`);
          }
          break;
        }
        case 'hold':
          if (g.kind === 'cav' && world.t > g.chargeAt && b.phase === 'clash') {
            const prey = b.regs
              .filter((o) => o.side !== g.side && !o.routed && (o.kind === 'arch' || o.kind === 'mage' || o.kind === 'inf'))
              .map((o) => ({ o, c: regCenter(o) }))
              .filter((x) => x.c)
              .sort((a, b2) => (a.o.kind === 'arch' ? -1 : 0) - (b2.o.kind === 'arch' ? -1 : 0) || Math.abs(a.c!.z - c.z) - Math.abs(b2.c!.z - c.z))[0];
            if (prey?.c) {
              g.order = 'charge';
              g.frontX = prey.c.x;
              g.z0 = Math.max(0, prey.c.z - 0.08);
              g.z1 = Math.min(1, prey.c.z + 0.08);
              g.engagedSince = -1;
              say(`${g.name} CHARGES`, c.x, c.z, side(g.side).color, 'medium', 50);
              emit('charge', c.x, c.z, 0.65, { color: side(g.side).color });
            }
          }
          break;
        case 'charge':
          if (g.engagedSince >= 0 && world.t - g.engagedSince > 7) {
            g.order = 'reform';
            g.frontX = g.homeX;
          }
          break;
        case 'reform': {
          const back = g.units.filter((u) => u.alive && Math.abs(u.x - g.homeX) < 40).length;
          if (back > c.n * 0.6) {
            g.order = 'hold';
            g.z0 = g.units[0].z < 0.5 ? 0.02 : 0.88;
            g.z1 = g.z0 + 0.1;
            g.chargeAt = world.t + 12 + r() * 12;
          }
          break;
        }
      }
    }
  }

  // ---- each man ------------------------------------------------------------------------------

  function men(dt: number, r: Rng) {
    const b = world.battle;
    for (const u of b.units) {
      if (!u.alive || u.fled) continue;
      if (u.kind === 'treb') continue;
      if (u.reg.order === 'duel') continue;
      if (u.risenAt > 0 && world.t - u.risenAt < 1.2) continue;
      const g = u.reg;
      const dir = u.side === 0 ? 1 : -1;
      let tx: number;
      let tz: number;
      let speed = SPEED[u.kind];
      if (g.order === 'rout' || (b.phase === 'rout' && u.side !== b.winner)) {
        tx = u.side === 0 ? -260 : b.BW + 260;
        tz = u.z;
        speed *= 1.35;
        if ((u.side === 0 && u.x < -200) || (u.side === 1 && u.x > b.BW + 200)) {
          u.fled = true;
          continue;
        }
      } else {
        tx = g.frontX - dir * u.rank * (u.kind === 'cav' ? 20 : 12);
        tz = g.z0 + ((u.file + 0.5) / g.files) * (g.z1 - g.z0);
        if (g.order === 'charge') speed = 95;
        if (g.order === 'muster') speed *= 1.6;
        if (u.kind === 'lord' && b.phase === 'clash') {
          // The lord rides to the regiment most in need, and rallies it.
          const weak = b.regs.filter((o) => o.side === u.side && !o.routed && o.kind === 'inf' && o.morale < 0.35 && o.engagedSince >= 0).sort((a, c) => a.morale - c.morale)[0];
          const c = weak && regCenter(weak);
          if (weak && c && u.cd <= 0) {
            tx = c.x - dir * 40;
            tz = c.z;
            if (Math.abs(u.x - tx) < 30) {
              weak.morale = Math.min(1, weak.morale + 0.3);
              u.cd = 25;
              say(`${b.lordNames[u.side]} RALLIES THE LINE`, u.x, u.z, side(u.side).color, 'medium', 60);
              emit('rally', u.x, u.z, 0.5);
            }
          }
          u.cd -= dt;
        }
        // Fight whatever comes within reach (archers and mages only defend themselves).
        const fights = u.kind !== 'mage' && (g.order === 'advance' || g.order === 'charge' || b.phase === 'clash' || b.phase === 'rout');
        const sense = u.kind === 'cav' && g.order === 'charge' ? 40 : u.kind === 'arch' || u.kind === 'mage' ? 16 : 46;
        const foes = fights ? enemiesNear(u.side, u.x, u.z, sense) : [];
        if (foes.length) {
          let best = foes[0];
          let bd = dist(u, best.x, best.z);
          for (const f of foes) {
            const d = dist(u, f.x, f.z);
            if (d < bd) {
              bd = d;
              best = f;
            }
          }
          u.facing = best.x > u.x ? 1 : -1;
          if (bd > REACH[u.kind]) {
            // Close in, each man a little off the straight line, so a melee is a crowd, not a wall.
            tx = best.x - u.facing * (REACH[u.kind] - 3) + u.jx * 0.5;
            tz = best.z + u.jx * 0.0016;
          } else {
            tx = u.x;
            tz = u.z;
            u.cd -= dt;
            if (u.cd <= 0) {
              u.cd = 1 + r() * 0.8;
              u.swingUntil = world.t + 0.28;
              let p = 0.3;
              if (u.kind === 'inf' && best.kind === 'cav') p += 0.2;
              if (u.kind === 'cav' && (best.kind === 'arch' || best.kind === 'mage')) p += 0.25;
              if (u.kind === 'cav' && g.order === 'charge' && g.engagedSince < 0) p += 0.3;
              if (best.facing === u.facing) p += 0.15;
              if (r() < p) hurt(best, 1, u.side);
              if (r() < 0.08) b.effects.push({ kind: 'spark', x: (u.x + best.x) / 2, z: (u.z + best.z) / 2, h: 14, t0: world.t, dur: 0.2, r: 5, color: '#fef3c7', seed: u.id });
            }
          }
        } else if (b.phase === 'aftermath' && u.side === b.winner && r() < dt * 0.6) {
          u.swingUntil = world.t + 0.35;
        }
      }
      // Step toward the target.
      const dx = tx - u.x;
      const dz = (tz - u.z) * D();
      const len = Math.hypot(dx, dz);
      if (len > 0.5) {
        const m = Math.min(len, speed * dt);
        u.x += (dx / len) * m;
        u.z += (dz / len) * m / D();
        u.anim += dt * (u.kind === 'cav' || u.kind === 'lord' ? 10 : 7) * Math.min(1, m / (speed * dt + 1e-6));
        if (Math.abs(dx) > 2 && !foesClose(u)) u.facing = dx > 0 ? 1 : -1;
      }
      u.z = Math.max(0, Math.min(1, u.z));
    }
  }
  const foesClose = (u: Unit) => u.swingUntil > world.t;

  /** Push apart men standing on each other. */
  function spacing() {
    const b = world.battle;
    for (const u of b.units) {
      if (!u.alive || u.fled || u.kind === 'treb') continue;
      for (const o of hash.query(u.x, u.z * D(), 7, near)) {
        if (o === u || !o.alive) continue;
        const dx = u.x - o.x || (u.id - o.id) * 0.01;
        const dz = (u.z - o.z) * D();
        const d = Math.hypot(dx, dz) || 1;
        const push = (7 - d) * 0.25;
        u.x += (dx / d) * push;
        u.z += ((dz / d) * push) / D();
      }
    }
  }

  // ---- victory --------------------------------------------------------------------------------

  function outcome() {
    const b = world.battle;
    if (b.phase !== 'clash') return;
    for (const s of [0, 1] as const) {
      let now = 0;
      let start = 0;
      let standing = 0;
      for (const g of b.regs) {
        if (g.side !== s || g.kind === 'treb' || g.kind === 'lord') continue;
        start += g.start;
        for (const u of g.units) if (u.alive && !u.fled) now++;
        if (!g.routed && g.kind === 'inf') standing++;
      }
      if (now / Math.max(1, start) < 0.25 || standing === 0) {
        const w = (1 - s) as 0 | 1;
        b.winner = w;
        for (const g of b.regs) if (g.side === s) {
          g.routed = true;
          g.order = 'rout';
        }
        world.war.wins[w]++;
        setPhase('rout');
        const c = b.lords[w] ?? b.units.find((u) => u.side === w && u.alive);
        const x = c ? c.x : b.focusX;
        say(`${side(w).name} HOLDS THE FIELD`, x, 0.4, side(w).color, 'high', 80);
        emit('victory', x, 0.4, 0.8, { color: side(w).color });
        chronicle(`Day ${b.day}. ${titled(short(w))} won the field of ${titled(b.name)}.`);
        if (world.war.wins[w] >= 3) {
          say(`THE WAR OF ${world.war.name} IS WON`, x, 0.2, '#fde68a', 'high', 110);
          emit('peace', x, 0.2, 0.7);
        }
        return;
      }
    }
  }

  // ---- the frame ------------------------------------------------------------------------------

  const rng = forkRng(seed, 'battle-step');

  function step(dt: number) {
    world.t += dt;
    const b = world.battle;
    const r = rng;
    hash.clear();
    for (const u of b.units) if (u.alive && !u.fled) hash.insert(u, u.x, u.z * D());
    phases(r);
    if (world.battle !== b) return;
    if (duelOn) duel(dt, r);
    regiments(dt, r);
    men(dt, r);
    spacing();
    shots(r);
    dragonStep(dt, r);
    outcome();
    // Where the fighting is, for the camera; how hot it is, for sound.
    let fx = 0;
    let n = 0;
    let fighting = 0;
    let alive = 0;
    for (const u of b.units) {
      if (!u.alive || u.fled) continue;
      alive++;
      if (u.swingUntil > world.t - 0.5 && u.kind !== 'arch' && u.kind !== 'mage') {
        fx += u.x;
        n++;
        fighting++;
      }
    }
    const target = b.dragon && b.dragon.state !== 'dead' ? b.dragon.x : n > 4 ? fx / n : b.BW / 2;
    b.focusX += (target - b.focusX) * Math.min(1, dt * 0.35);
    b.heat = Math.min(1, fighting / Math.max(1, alive * 0.4));
    b.flash = Math.max(0, b.flash - dt);
    if (b.weather === 'storm' && r() < dt * 0.05) {
      b.flash = 0.3;
      emit('thunder', b.focusX + (r() - 0.5) * world.W, 0, 0.5);
    }
    for (let i = b.effects.length - 1; i >= 0; i--) if (world.t - b.effects[i].t0 > b.effects[i].dur) b.effects.splice(i, 1);
    for (let i = b.labels.length - 1; i >= 0; i--) if (world.t - b.labels[i].t0 > b.labels[i].dur) b.labels.splice(i, 1);
    for (const c of b.crows) {
      if (world.t < c.landAt) {
        c.x += c.vx * dt;
        c.h = Math.max(0, c.h - dt * 40);
      } else c.h = 0;
    }
  }

  world.battle = newBattle(0, true, 1);
  void world.battle;
  chronicle(`Day 1. ${titled(short(0))} and ${titled(short(1))} met at ${titled(world.battle.name)}.`);
  return world;
}

const titled = (s: string) => s.toLowerCase().replace(/(^|\s)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
