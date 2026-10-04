/**
 * War: territory held cell by cell, and two sides that fight for it with what they have.
 *
 * The Long Siege runs along a front. One side holds the top of the map, the other the
 * bottom, and the camera travels along the line between them. Territory is a hex grid
 * anchored to the world (`sim/cells.ts`), so captured ground, walls, and old scars scroll
 * past like everything else; new ground coming in on the right continues the line.
 *
 *   useWar(api)   the state every siege mechanic shares: the grid, the two sides (supply,
 *                 reserve), the truce, the names on the memorial, shields over fortress
 *                 worlds, and the roster of combatants (who fights for whom)
 *   'front'       the war itself:
 *                 - each side earns reserve from its ground and its supply, and spends it on
 *                   probes, on defense, and, once it has saved enough, on an offensive
 *                 - squads wear down an enemy cell's hold until it falls; momentum carries
 *                   them on a cell or two
 *                 - supply convoys run from depots to the line and the enemy hunts them; a
 *                   starved line stops holding and gives way
 *                 - an edge held long enough becomes a wall (ASCII, in the builder's color)
 *                 - fire bases shoot enemy combatants in range
 *
 * The other siege mechanics (artillery, duels, truces, mines) live in siege.ts.
 */
import type { Fleet } from '../types';
import { cellHash, createHexGrid, type Cell, type HexGrid } from '../../../sim/cells';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { createCombat } from './combat';
import { registerMechanic, steerToward, type MechanicApi } from './types';

// ---- the shared war state ------------------------------------------------------------------

export type Side = {
  id: 0 | 1;
  name: string;
  /** Short form for tight labels. */
  short: string;
  color: string;
  /** 0..1: how fed the line is. Below 0.3 it stops holding. */
  supply: number;
  /** Points to spend: squads, volleys, monitors. */
  reserve: number;
};

/** A hex-lattice bubble over a fortress world (or a moving monitor) that ripples when hit. */
export type Shield = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  owner: number;
  /** 0..1 strength. At 0 it fails for a while. */
  hp: number;
  downUntil: number;
  /** Recent impacts, relative to the center. */
  hits: { dx: number; dy: number; t: number }[];
  /** Where the protected thing is now; null once it is gone. */
  at: () => { x: number; y: number } | null;
};

export type War = {
  grid: HexGrid;
  sides: [Side, Side];
  /** Sim time the current truce ends (no fighting until then). */
  truceUntil: number;
  inTruce(): boolean;
  cellAt(x: number, y: number): Cell;
  ownerAt(x: number, y: number): number;
  /** Every cell in (or just around) the base frame. */
  visible(fn: (c: Cell) => void): void;
  /** Visible cells of `side` that touch the other side. */
  frontier(side: number): Cell[];
  /** True for a cell on the line. */
  onLine(c: Cell): boolean;
  /** An edge both sides have held for a while is a wall. */
  fortified(a: Cell, b: Cell): boolean;
  /** y of the line at world x. */
  lineAt(x: number): number;
  /** An off-map y behind a side's lines, where its reinforcements come from. */
  rearY(side: number): number;
  /** Names on the memorial: everyone lost. */
  names: number;
  /** Put a fleet on a side's roster (fire bases and mines know whom to hit). */
  enlist(f: Fleet, side: number): void;
  combatants(): readonly { f: Fleet; side: number }[];
  shields: Shield[];
  /** The standing shield covering a point. */
  shieldAt(x: number, y: number): Shield | undefined;
  /** A shot from (fromX, fromY) lands on the shield: ripple, strain, maybe fail. Returns the rim point. */
  hitShield(sh: Shield, fromX: number, fromY: number, strain?: number): { x: number; y: number };
  /** A moving shield (a monitor's). Removed when `at` returns null. */
  addShield(sh: Pick<Shield, 'id' | 'label' | 'r' | 'owner' | 'at'>): Shield;
};

const HEX = 46;
/** Seconds both cells must have been held before their shared edge is a wall. */
const FORTIFY_AFTER = 40;
const SHIELD_DOWN = 30;
const RIPPLE = 1.4;
const LATTICE = 7;
const SQRT3 = Math.sqrt(3);

const idHash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/** Trace a pointy-top hexagon (corners at -30°, 30°, ... like `grid.corners`). */
export function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const px = x + size * Math.cos(a);
    const py = y + size * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function useWar(api: MechanicApi): War {
  return api.use('war', () => createWar(api));
}

function createWar(api: MechanicApi): War {
  const f = api.pack.factions;
  const side = (i: 0 | 1, fallback: string): Side => {
    const name = f[i]?.name ?? (i ? 'SOUTH' : 'NORTH');
    return { id: i, name, short: f[i]?.prefix ?? name.slice(0, 3), color: f[i]?.color ?? fallback, supply: 0.75, reserve: 40 };
  };
  const noise = api.host.noise;
  /** The line the war started on: a meander through the middle third. */
  const startLine = (x: number) => api.height * (0.5 + 0.15 * noise.noise2(x * 0.0016, 7.7) + 0.05 * noise.noise2(x * 0.006, 2.1));
  // Most of the line has stood for years: cells start "held since" up to two minutes back.
  const grid = createHexGrid(HEX, (q, r, x, y) => ({ owner: y < startLine(x) ? 0 : 1, hold: 0.85, since: -20 - cellHash(q, r) * 120 }));
  const roster: { f: Fleet; side: number }[] = [];
  const statics = new Map<string, Shield>();
  const lattices = new Map<number, number[]>();
  let nextShieldScan = 0;
  let nextPrune = 10;

  const rect = () => {
    const v = api.view();
    return { left: v.left - HEX, right: v.right + HEX, top: -HEX, bottom: api.height + HEX };
  };

  const war: War = {
    grid,
    sides: [side(0, '#f87171'), side(1, '#60a5fa')],
    truceUntil: -1,
    inTruce: () => api.t < war.truceUntil,
    cellAt: (x, y) => grid.at(x, y),
    ownerAt: (x, y) => grid.at(x, y).owner,
    visible: (fn) => grid.forEachIn(rect(), fn),
    onLine: (c) => grid.neighbors(c).some((n) => n.owner === 1 - c.owner),
    frontier(s) {
      const out: Cell[] = [];
      const v = api.view();
      grid.forEachIn({ left: v.left, right: v.right, top: 0, bottom: api.height }, (c) => {
        if (c.owner === s && c.x > v.left && c.x < v.right && war.onLine(c)) out.push(c);
      });
      return out;
    },
    fortified: (a, b) => api.t - Math.max(a.since, b.since) > FORTIFY_AFTER,
    lineAt(x) {
      // Walk down the column until the owner changes.
      for (let y = 0; y < api.height; y += HEX * 0.75) if (grid.at(x, y).owner === 1) return Math.max(0, y - HEX * 0.4);
      return api.height / 2;
    },
    rearY: (s) => (s === 0 ? -50 : api.height + 50),
    names: 4112009,
    enlist: (fl, s) => void roster.push({ f: fl, side: s }),
    combatants: () => roster,
    shields: [],
    shieldAt(x, y) {
      return war.shields.find((sh) => api.t >= sh.downUntil && Math.hypot(sh.x - x, sh.y - y) < sh.r);
    },
    hitShield(sh, fromX, fromY, strain = 0.08) {
      const a = Math.atan2(fromY - sh.y, fromX - sh.x);
      const dx = Math.cos(a) * sh.r;
      const dy = Math.sin(a) * sh.r;
      sh.hits.push({ dx, dy, t: api.t });
      if (sh.hits.length > 8) sh.hits.shift();
      sh.hp -= strain;
      if (sh.hp <= 0 && api.t >= sh.downUntil) {
        sh.hp = 0;
        sh.downUntil = api.t + SHIELD_DOWN;
        const color = war.sides[sh.owner]?.color ?? api.host.palette.ink;
        api.say(`${sh.label} · SHIELD DOWN`, sh.x, sh.y - sh.r - 10, color, { priority: 'high' });
        api.emit({ type: 'shield', x: sh.x, y: sh.y, weight: 0.6, color });
      }
      return { x: sh.x + dx, y: sh.y + dy };
    },
    addShield(s) {
      const p = s.at();
      const sh: Shield = { ...s, x: p?.x ?? 0, y: p?.y ?? 0, hp: 1, downUntil: -1, hits: [] };
      war.shields.push(sh);
      return sh;
    },
  };

  /** Fortress worlds: about two systems in five on the main plane, and any fortress structure. */
  const scanShields = () => {
    for (const s of api.world.systems) {
      if (s.z || idHash(s.id) > 0.4 || statics.has(s.id) || !api.onScreen(s.x, s.y, 120)) continue;
      const sh = war.addShield({ id: s.id, label: s.name, r: s.starRadius * 4 + 46, owner: war.ownerAt(s.x, s.y), at: () => (api.world.systems.includes(s) ? s : null) });
      statics.set(s.id, sh);
    }
    for (const st of api.structures()) {
      if (st.z || st.role !== 'giant' || statics.has(st.id) || !api.onScreen(st.x, st.y, 120)) continue;
      const sh = war.addShield({ id: st.id, label: st.label, r: 74, owner: war.ownerAt(st.x, st.y), at: () => (api.world.structures.includes(st) ? st : null) });
      statics.set(st.id, sh);
    }
  };

  api.onUpdate((dt) => {
    for (let i = roster.length - 1; i >= 0; i--) if (roster[i].f.mode === 'gone' || !roster[i].f.ships.length) roster.splice(i, 1);
    if (api.t >= nextShieldScan) {
      scanShields();
      nextShieldScan = api.t + 1;
    }
    for (let i = war.shields.length - 1; i >= 0; i--) {
      const sh = war.shields[i];
      const p = sh.at();
      if (!p) {
        war.shields.splice(i, 1);
        statics.delete(sh.id);
        continue;
      }
      sh.x = p.x;
      sh.y = p.y;
      if (statics.has(sh.id)) sh.owner = war.ownerAt(sh.x, sh.y);
      if (api.t >= sh.downUntil) sh.hp = Math.min(1, sh.hp + dt * 0.03);
    }
    if (api.t >= nextPrune) {
      grid.prune(api.view().left - 600);
      nextPrune = api.t + 10;
    }
  });

  // Every ship lost is a crew's worth of names.
  api.bus.on('explosion', (e) => {
    const size = typeof e.size === 'number' ? e.size : 1;
    war.names += Math.round(size * size * size * 40);
  });

  /** Lattice cell centers inside a bubble of radius r (cached per radius). */
  const lattice = (r: number) => {
    const key = Math.round(r / 4) * 4;
    let pts = lattices.get(key);
    if (!pts) {
      pts = [];
      const w = LATTICE * SQRT3;
      const h = LATTICE * 1.5;
      const rows = Math.ceil(key / h);
      const cols = Math.ceil(key / w) + 1;
      for (let row = -rows; row <= rows; row++)
        for (let col = -cols; col <= cols; col++) {
          const dx = (col + (row & 1) * 0.5) * w;
          const dy = row * h;
          if (dx * dx + dy * dy < (key - LATTICE * 0.6) ** 2) pts.push(dx, dy);
        }
      lattices.set(key, pts);
    }
    return pts;
  };

  // Shields: a faint rim and a lattice that shows only near the edge, until something
  // hits; then a ring of lit cells spreads from the impact across the dome.
  const ALPHAS = [0.07, 0.18, 0.38, 0.7];
  api.onDraw('over', (ctx, frame) => {
    if (!war.shields.length) return;
    ctx.save();
    for (const sh of war.shields) {
      const x = api.screenX(sh.x);
      if (x < -sh.r - 20 || x > api.width + sh.r + 20) continue;
      const color = war.sides[sh.owner]?.color ?? api.host.palette.ink;
      if (frame.time < sh.downUntil) {
        // Just failed: the rim flickers in pieces for a few seconds.
        const age = frame.time - (sh.downUntil - SHIELD_DOWN);
        if (age < 3 && Math.sin(frame.time * 40) > -0.2) {
          ctx.strokeStyle = hexRgba(color, 0.4 * (1 - age / 3));
          ctx.setLineDash([3, 9]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, sh.y, sh.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        continue;
      }
      const hits = sh.hits.filter((h) => frame.time - h.t < RIPPLE);
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexRgba(color, 0.16 + 0.12 * sh.hp + (hits.length ? 0.15 : 0));
      ctx.beginPath();
      ctx.arc(x, sh.y, sh.r, 0, Math.PI * 2);
      ctx.stroke();
      const pts = lattice(sh.r);
      const buckets: number[][] = [[], [], [], []];
      for (let i = 0; i < pts.length; i += 2) {
        const dx = pts[i];
        const dy = pts[i + 1];
        const d = Math.hypot(dx, dy) / sh.r;
        let v = 0.12 * Math.max(0, (d - 0.74) / 0.26) ** 2;
        for (const h of hits) {
          const age = frame.time - h.t;
          const wave = age * 110;
          const dist = Math.hypot(dx - h.dx, dy - h.dy);
          v += Math.exp(-((dist - wave) ** 2) / 90) * (1 - age / RIPPLE) * 0.95;
        }
        const b = v > 0.55 ? 3 : v > 0.28 ? 2 : v > 0.1 ? 1 : v > 0.035 ? 0 : -1;
        if (b >= 0) buckets[b].push(dx, dy);
      }
      for (let b = 0; b < 4; b++) {
        if (!buckets[b].length) continue;
        ctx.strokeStyle = hexRgba(color, ALPHAS[b]);
        ctx.beginPath();
        for (let i = 0; i < buckets[b].length; i += 2) hexPath(ctx, x + buckets[b][i], sh.y + buckets[b][i + 1], LATTICE * 0.9);
        ctx.stroke();
      }
      // The impact itself: a bright point on the rim.
      for (const h of hits) {
        const age = frame.time - h.t;
        if (age > 0.4) continue;
        ctx.fillStyle = hexRgba('#ffffff', 0.8 * (1 - age / 0.4));
        ctx.beginPath();
        ctx.arc(x + h.dx, sh.y + h.dy, 3 + age * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });

  return war;
}

// ---- the front ---------------------------------------------------------------------------

type Role = 'attack' | 'hold' | 'home';
type Squad = { f: Fleet; side: 0 | 1; target: Cell; role: Role; pushes: number; until: number; nextClash: number; nextShot: number };
type Convoy = { f: Fleet; side: 0 | 1; to: Cell; phase: 'out' | 'back'; huntAt: number; relief: boolean };
type Hunter = { f: Fleet; side: 0 | 1; prey: Convoy; until: number; engaged: boolean };

const COST = { attack: 24, hold: 14, hunt: 10 };

registerMechanic({
  id: 'front',
  label: 'The front (cells)',
  description: 'Territory held hex by hex along a front, with a heat map of where it changed hands. Each side spends what it has on probes and offensives; supply convoys keep the line fed and the enemy hunts them; long-held edges become walls.',
  schema: {
    aggression: { type: 'number', min: 0.2, max: 2, default: 1, label: 'How hard they push' },
    supply: { type: 'boolean', default: true, label: 'Supply lines' },
    heat: { type: 'boolean', default: true, label: 'Show where it changed hands' },
    status: { type: 'boolean', default: true, label: 'Each side in a corner' },
  },
  create(api, p) {
    const war = useWar(api);
    const { grid } = war;
    const combat = createCombat(api);
    const aggression = Number(p.aggression) || 1;
    const squads: Squad[] = [];
    const convoys: Convoy[] = [];
    const hunters: Hunter[] = [];
    const nextThink = [api.t + 2, api.t + 3.5];
    const nextConvoy = [api.t + 5, api.t + 9];
    let holdClock = 0;
    let nextBases = 0;

    const fortifiedCell = (c: Cell) => grid.neighbors(c).some((n) => n.owner === 1 - c.owner && war.fortified(c, n));
    const systemIn = (c: Cell) => api.world.systems.find((s) => !s.z && grid.at(s.x, s.y) === c);
    const inBounds = (c: Cell) => {
      const v = api.view();
      return c.x > v.left + 50 && c.x < v.right - 50 && c.y > 40 && c.y < api.height - 40;
    };
    const active = (s: number) => squads.filter((q) => q.side === s && q.role !== 'home');

    const goHome = (sq: Squad) => {
      sq.role = 'home';
      combat.disengage(sq.f);
    };

    /** A squad flies in from its side's rear to a cell and works it (or holds it). */
    const launch = (s: 0 | 1, target: Cell, role: 'attack' | 'hold') => {
      const heavy = role === 'attack' && api.rng() < 0.4;
      const cls = heavy ? 'cruiser' : 'fighter';
      const sp = SHIP_SPECS[cls].speed * 1.05;
      const sq: Squad = { f: null as unknown as Fleet, side: s, target, role, pushes: 0, until: api.t + 75, nextClash: 0, nextShot: 0 };
      const x = target.x + (api.rng() - 0.5) * 120;
      const y = war.rearY(s);
      const spin = api.rng() * 6;
      sq.f = api.spawnFleet(
        { x, y, vx: 0, vy: s === 0 ? 40 : -40 },
        {
          cls,
          wings: heavy ? ['fighter', 'fighter'] : ['fighter', 'fighter', 'fighter'],
          faction: s,
          color: war.sides[s].color,
          tag: 'war',
          steer: (fl, dt) => {
            const L = fl.ships[0];
            if (sq.role === 'home') {
              steerToward(L, L.x, war.rearY(s) + (s === 0 ? -40 : 40), sp, 1.4, dt);
              return;
            }
            // Work the cell: circle inside it.
            const k = api.t * 0.6 + spin;
            steerToward(L, sq.target.x + Math.cos(k) * 16, sq.target.y + Math.sin(k) * 12, sp, 1.6, dt, 50);
          },
        },
      );
      war.enlist(sq.f, s);
      squads.push(sq);
      war.sides[s].reserve -= COST[role];
      return sq;
    };

    /** Which enemy cell is most worth taking, and why. */
    const pickTarget = (s: number) => {
      const foe = war.sides[1 - s];
      let best: Cell | null = null;
      let why = '';
      let score = -Infinity;
      for (const c of war.frontier(1 - s)) {
        if (!inBounds(c)) continue;
        const sys = systemIn(c);
        const walls = fortifiedCell(c);
        const sc = (1 - c.hold) * 1.2 + (sys ? 0.6 : 0) - (walls ? 0.4 : 0) + api.rng() * 0.5;
        if (sc > score) {
          score = sc;
          best = c;
          why = foe.supply < 0.3 ? 'THEIR LINE IS STARVING' : sys ? `FOR ${sys.name}` : walls ? 'BREAK THE WALL' : 'STRAIGHTEN THE LINE';
        }
      }
      return best ? { cell: best, why } : null;
    };

    /** A side's turn, every few seconds: earn, defend, then attack if it can afford to. */
    const think = (s: 0 | 1) => {
      const me = war.sides[s];
      const foe = war.sides[1 - s];
      let held = 0;
      war.visible((c) => {
        if (c.owner === s) held++;
      });
      me.reserve = Math.min(220, me.reserve + (1.6 + held * 0.03 + me.supply * 2.4) * aggression);
      if (war.inTruce()) return;
      const mine = active(s);
      // Shore up a cell that is about to go.
      const failing = war.frontier(s).filter((c) => c.hold < 0.4 && inBounds(c) && !mine.some((q) => q.target === c)).sort((a, b) => a.hold - b.hold)[0];
      if (failing && me.reserve >= COST.hold && mine.filter((q) => q.role === 'hold').length < 2) {
        launch(s, failing, 'hold');
        api.say(`${me.short} · REINFORCING THE LINE`, failing.x, failing.y, me.color, { priority: 'low' });
      }
      const attacking = mine.filter((q) => q.role === 'attack').length;
      // Rhythm: save up, then go all at once. A starving enemy is an invitation.
      const need = foe.supply < 0.3 ? 60 : 100;
      if (!attacking && me.reserve >= need) {
        const t = pickTarget(s);
        if (!t) return;
        const first = launch(s, t.cell, 'attack');
        for (const n of grid.neighbors(t.cell)) {
          if (me.reserve < COST.attack || active(s).filter((q) => q.role === 'attack').length >= 3) break;
          if (n.owner === 1 - s && war.onLine(n) && inBounds(n) && api.rng() < 0.6) launch(s, n, 'attack');
        }
        api.say(`${me.name} · OFFENSIVE · ${t.why}`, t.cell.x, t.cell.y - 30, me.color, { priority: 'high', duration: 5000 });
        api.emit({ type: 'offensive', x: t.cell.x, y: t.cell.y, weight: 0.75, color: me.color, side: s, follow: api.follow(first.f) });
      } else if (attacking < 1 && me.reserve >= 45 && api.rng() < 0.25) {
        const t = pickTarget(s);
        if (!t) return;
        launch(s, t.cell, 'attack');
        api.say(`${me.short} · PROBING ATTACK`, t.cell.x, t.cell.y - 24, me.color, { priority: 'low' });
      }
    };

    /** A cell changes hands; any system in it falls with it, and its shield drops. */
    const capture = (c: Cell, s: number) => {
      grid.setOwner(c, s, api.t);
      c.hold = 0.3;
      c.value = Math.min(6, c.value + 1);
      const color = war.sides[s].color;
      api.fx.ring(c.x, c.y, color, HEX * 1.3, 1, 6, 1.5);
      const sys = systemIn(c);
      if (sys) {
        api.fx.flash(sys.x, sys.y, color, 40, 0.8);
        api.say(`${sys.name} FALLS TO ${war.sides[s].name}`, sys.x, sys.y + 30, color, { priority: 'high', duration: 5000 });
        api.emit({ type: 'capture', x: sys.x, y: sys.y, weight: 0.85, color, side: s });
      } else api.emit({ type: 'front', x: c.x, y: c.y, weight: 0.35, color, side: s });
      for (const sh of war.shields) {
        if (grid.at(sh.x, sh.y) !== c || api.t < sh.downUntil) continue;
        sh.hp = 0;
        sh.downUntil = api.t + SHIELD_DOWN;
      }
    };

    /** A supply run from a depot behind the line (or the rear) to the nearest friendly line cell. */
    const sendConvoy = (s: 0 | 1, relief: boolean) => {
      const front = war.frontier(s).filter(inBounds);
      if (!front.length) return;
      const v = api.view();
      const depots = api.structures().filter((st) => !st.z && (st.role === 'dock' || st.role === 'mine' || st.role === 'shipyard') && war.ownerAt(st.x, st.y) === s && api.onScreen(st.x, st.y, 0));
      const from = depots.length ? depots[Math.floor(api.rng() * depots.length)] : { x: v.left + api.width * (0.15 + api.rng() * 0.7), y: war.rearY(s) };
      const to = front.sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      const sp = SHIP_SPECS.freighter.speed;
      const cv: Convoy = { f: null as unknown as Fleet, side: s, to, phase: 'out', huntAt: api.t + 3 + api.rng() * 4, relief };
      cv.f = api.spawnFleet(
        { x: from.x, y: from.y, vx: 0, vy: 0 },
        {
          cls: 'freighter',
          wings: relief ? ['freighter', 'freighter', 'fighter', 'fighter'] : ['freighter'],
          faction: s,
          color: war.sides[s].color,
          tag: 'supply',
          purpose: 'cargo',
          fadeIn: true,
          steer: (fl, dt) => {
            const L = fl.ships[0];
            if (cv.phase === 'back') steerToward(L, L.x, war.rearY(s) + (s === 0 ? -40 : 40), sp, 1.2, dt);
            else steerToward(L, cv.to.x, cv.to.y, sp, 1.4, dt, 40);
          },
        },
      );
      cv.f.cargo = { good: 'munitions', amount: relief ? 60 : 30, color: '#fde047' };
      war.enlist(cv.f, s);
      convoys.push(cv);
      if (relief) {
        api.say(`${war.sides[s].name} · RELIEF CONVOY`, from.x, Math.max(20, Math.min(api.height - 20, from.y)), war.sides[s].color, { priority: 'high', followId: cv.f.id });
        api.emit({ type: 'convoy', x: from.x, y: from.y, weight: 0.5, follow: api.follow(cv.f) });
      }
    };

    /** The enemy sends fighters to cut a convoy off. */
    const hunt = (cv: Convoy) => {
      const s = (1 - cv.side) as 0 | 1;
      const L = cv.f.ships[0];
      if (!L || war.sides[s].reserve < COST.hunt) return;
      war.sides[s].reserve -= COST.hunt;
      const ang = api.rng() * Math.PI * 2;
      const at = { x: L.x + Math.cos(ang) * 230, y: Math.max(30, Math.min(api.height - 30, L.y + Math.sin(ang) * 180)) };
      const sp = SHIP_SPECS.fighter.speed * 1.3;
      const h: Hunter = { f: null as unknown as Fleet, side: s, prey: cv, until: api.t + 18, engaged: false };
      h.f = api.spawnFleet(
        { x: at.x, y: at.y, vx: 0, vy: 0 },
        {
          cls: 'fighter',
          wings: ['fighter', 'fighter'],
          faction: s,
          color: war.sides[s].color,
          tag: 'war',
          warpIn: true,
          steer: (fl, dt) => {
            const me = fl.ships[0];
            const prey = h.prey.f.ships[0];
            if (!prey || h.until < api.t) steerToward(me, me.x, war.rearY(s), sp, 1.5, dt);
            else steerToward(me, prey.x + prey.vx * 0.5, prey.y + prey.vy * 0.5, sp, 2.5, dt);
          },
        },
      );
      war.enlist(h.f, s);
      hunters.push(h);
      api.say(`${war.sides[s].short} INTERDICTORS · ${war.sides[cv.side].short} SUPPLY`, at.x, at.y, war.sides[s].color, { priority: 'high', followId: h.f.id });
    };

    /** Fire bases shoot enemy combatants that come within range. */
    const fireBases = (dt: number) => {
      if (war.inTruce()) return;
      for (const st of api.structures()) {
        if (st.z || st.role !== 'defense' || !api.onScreen(st.x, st.y, 40) || api.rng() > dt * 0.3) continue;
        const own = war.ownerAt(st.x, st.y);
        const target = war.combatants().find((c) => c.side !== own && c.f.ships[0] && Math.hypot(c.f.ships[0].x - st.x, c.f.ships[0].y - st.y) < 240);
        if (!target) continue;
        const victim = target.f.ships[Math.floor(api.rng() * target.f.ships.length)];
        api.fx.beam(() => ({ x: st.x, y: st.y }), () => (target.f.ships.includes(victim) ? { x: victim.x, y: victim.y } : null), war.sides[own]?.color ?? st.color ?? '#fca5a5', 0.5, 1.6);
        api.damage(target.f, victim, 1);
      }
    };

    return {
      update(dt) {
        combat.update(dt);
        const truce = war.inTruce();
        for (const s of [0, 1] as const) {
          const me = war.sides[s];
          me.supply = Math.max(0, me.supply - dt * (0.004 + 0.0015 * active(s).length));
          if (api.t >= nextThink[s]) {
            think(s);
            nextThink[s] = api.t + 3 + api.rng() * 2;
          }
          if (p.supply !== false && api.t >= nextConvoy[s] && !truce) {
            const enRoute = convoys.some((c) => c.side === s && c.phase === 'out');
            if (!enRoute || me.supply > 0.3) sendConvoy(s, me.supply < 0.3 && !enRoute);
            nextConvoy[s] = api.t + 20 + api.rng() * 12;
          }
        }
        if (api.t >= nextBases) {
          fireBases(0.5);
          nextBases = api.t + 0.5;
        }

        // Convoys: arrive and feed the line, or die and leave it hungry.
        for (let i = convoys.length - 1; i >= 0; i--) {
          const cv = convoys[i];
          const L = cv.f.ships[0];
          if (!L || cv.f.mode === 'gone') {
            convoys.splice(i, 1);
            if (!L && cv.phase === 'out') {
              const me = war.sides[cv.side];
              me.supply = Math.max(0, me.supply - 0.1);
              api.say(`SUPPLY LINE CUT · ${me.name}`, cv.to.x, cv.to.y, '#fde047', { priority: 'high' });
              api.emit({ type: 'supplycut', x: cv.to.x, y: cv.to.y, weight: 0.6, side: cv.side });
            }
            continue;
          }
          if (cv.phase === 'back') {
            if (L.y < -40 || L.y > api.height + 40) cv.f.mode = 'gone';
            continue;
          }
          if (cv.huntAt > 0 && api.t >= cv.huntAt) {
            cv.huntAt = -1;
            if (!truce && api.rng() < (cv.relief ? 0.8 : 0.45)) hunt(cv);
          }
          if (Math.hypot(L.x - cv.to.x, L.y - cv.to.y) < 30) {
            const me = war.sides[cv.side];
            me.supply = Math.min(1, me.supply + (cv.relief ? 0.45 : 0.22));
            cv.f.cargo = undefined;
            cv.phase = 'back';
            api.fx.ring(L.x, L.y, '#fde047', 34, 0.8, 4, 1);
            api.say(`SUPPLY THROUGH · ${me.short}`, L.x, L.y, '#fde047', { priority: cv.relief ? 'medium' : 'low' });
          }
        }

        // Hunters: catch the convoy and fight it, then go home.
        for (let i = hunters.length - 1; i >= 0; i--) {
          const h = hunters[i];
          const me = h.f.ships[0];
          if (!me || h.f.mode === 'gone') {
            hunters.splice(i, 1);
            continue;
          }
          const prey = h.prey.f.ships[0];
          if (truce) {
            combat.disengage(h.f);
            h.until = Math.min(h.until, api.t);
          }
          if (!h.engaged && prey && h.until > api.t && Math.hypot(prey.x - me.x, prey.y - me.y) < 150) {
            h.engaged = true;
            combat.engage([h.f], [h.prey.f], { weaponA: 'tracers', weaponB: 'mixed', seconds: 14, colorA: war.sides[h.side].color, colorB: war.sides[h.prey.side].color });
            api.emit({ type: 'combat', x: me.x, y: me.y, weight: 0.55, follow: api.follow(h.prey.f) });
          }
          if ((h.until < api.t || !prey) && (me.y < -40 || me.y > api.height + 40 || !api.onScreen(me.x, me.y, 100))) h.f.mode = 'gone';
        }

        // Squads: press, clash, hold, go home.
        for (let i = squads.length - 1; i >= 0; i--) {
          const sq = squads[i];
          const L = sq.f.ships[0];
          if (!L || sq.f.mode === 'gone') {
            squads.splice(i, 1);
            continue;
          }
          if (sq.role === 'home') {
            if (L.y < -40 || L.y > api.height + 40 || !api.onScreen(L.x, L.y, 200)) sq.f.mode = 'gone';
            continue;
          }
          if (truce || api.t > sq.until) {
            goHome(sq);
            continue;
          }
          const me = war.sides[sq.side];
          if (api.t >= sq.nextClash && !combat.fighting(sq.f)) {
            const foe = squads.find((o) => o.side !== sq.side && o.role !== 'home' && o.f.ships[0] && Math.hypot(o.f.ships[0].x - L.x, o.f.ships[0].y - L.y) < 170);
            if (foe) {
              sq.nextClash = foe.nextClash = api.t + 14;
              combat.engage([sq.f], [foe.f], { weaponA: 'mixed', weaponB: 'mixed', seconds: 10, colorA: me.color, colorB: war.sides[foe.side].color });
              api.emit({ type: 'combat', x: L.x, y: L.y, weight: 0.5, follow: api.follow(sq.f) });
            }
          }
          const here = grid.at(L.x, L.y);
          if (sq.role === 'attack') {
            if (sq.target.owner === sq.side) sq.role = 'hold';
            else if (here === sq.target) {
              // Strafe the positions in the cell.
              if (api.t >= sq.nextShot) {
                const s = sq.f.ships[Math.floor(api.rng() * sq.f.ships.length)];
                const tx = here.x + (api.rng() - 0.5) * HEX;
                const ty = here.y + (api.rng() - 0.5) * HEX;
                api.fx.tracer(s.x, s.y, tx, ty, me.color);
                api.fx.sparks(tx, ty, me.color, 3, 30);
                sq.nextShot = api.t + 0.3 + api.rng() * 0.4;
              }
              // Walls and defenders slow it down; the fight between the squads decides the rest.
              const defended = squads.some((o) => o.side !== sq.side && o.role !== 'home' && o.f.ships[0] && grid.at(o.f.ships[0].x, o.f.ships[0].y) === here);
              const rate = 0.03 * sq.f.ships.length * (me.supply > 0.3 ? 1 : 0.45) * (fortifiedCell(here) ? 0.7 : 1) * (defended ? 0.6 : 1);
              here.hold -= rate * dt;
              if (here.hold <= 0) {
                capture(here, sq.side);
                // Momentum: on into the weakest next enemy cell, a couple of times.
                const next = grid
                  .neighbors(here)
                  .filter((n) => n.owner === 1 - sq.side && inBounds(n))
                  .sort((a, b) => a.hold - b.hold)[0];
                if (next && sq.pushes < 2) {
                  sq.target = next;
                  sq.pushes++;
                } else sq.role = 'hold';
              }
            }
          } else if (sq.role === 'hold') {
            if (sq.target.owner !== sq.side) goHome(sq);
            else {
              // Dig in, unless the enemy is in the cell too.
              const attacked = squads.some((o) => o.side !== sq.side && o.role === 'attack' && o.target === sq.target);
              if (here === sq.target && !attacked) sq.target.hold = Math.min(1, sq.target.hold + dt * 0.02);
              if (sq.target.hold > 0.85 && !combat.fighting(sq.f)) goHome(sq);
            }
          }
        }

        // The ground itself, four times a second: line cells firm up when fed and give when
        // starved; a starved line can collapse on its own. Old fighting cools.
        holdClock += dt;
        if (holdClock >= 0.25) {
          const step = holdClock;
          holdClock = 0;
          war.visible((c) => {
            c.value = Math.max(0, c.value - step * 0.004);
            const sup = war.sides[c.owner]?.supply ?? 1;
            if (!war.onLine(c)) {
              c.hold = Math.min(1, c.hold + step * 0.05);
              return;
            }
            c.hold = Math.max(0.02, Math.min(1, c.hold + step * (sup > 0.3 ? 0.008 : -0.01)));
            if (sup < 0.15 && c.hold < 0.08 && !truce && inBounds(c) && api.rng() < step * 0.03) {
              const loser = war.sides[c.owner];
              capture(c, 1 - c.owner);
              api.say(`${loser.name} · THE LINE GIVES WAY`, c.x, c.y, loser.color, { priority: 'medium' });
            }
          });
        }
      },

      draw(ctx, pass, frame) {
        if (pass === 'under') drawTerritory(ctx, frame.time);
        else if (pass === 'mid') drawOwners(ctx, frame.time);
        else if (pass === 'hud' && p.status !== false) drawStatus(ctx, frame.time);
      },
    };

    /** Territory, heat, and the line (walls where it has held). */
    function drawTerritory(ctx: CanvasRenderingContext2D, time: number) {
      const ox = api.screenX(0);
      const cells: Cell[] = [];
      war.visible((c) => void cells.push(c));
      ctx.save();
      // One fill per side.
      for (const s of [0, 1]) {
        ctx.beginPath();
        for (const c of cells) if (c.owner === s) hexPath(ctx, c.x + ox, c.y, HEX);
        ctx.fillStyle = hexRgba(war.sides[s].color, 0.06);
        ctx.fill();
      }
      // The cells worth singling out: fresh captures, contested ground, old scars.
      ctx.lineWidth = 1;
      for (const c of cells) {
        if (c.owner < 0) continue;
        const x = c.x + ox;
        const fresh = Math.max(0, 1 - (time - c.since) / 10);
        const contested = war.onLine(c) && c.hold < 0.6 ? 1 - c.hold / 0.6 : 0;
        if (fresh > 0) {
          ctx.beginPath();
          hexPath(ctx, x, c.y, HEX);
          ctx.fillStyle = hexRgba(war.sides[c.owner].color, 0.16 * fresh);
          ctx.fill();
        }
        if (contested > 0) {
          ctx.beginPath();
          hexPath(ctx, x, c.y, HEX - 3);
          ctx.strokeStyle = hexRgba(war.sides[1 - c.owner].color, contested * (0.25 + 0.2 * Math.sin(time * 5)));
          ctx.stroke();
        }
        if (p.heat !== false && c.value > 0.05) {
          // Heat: ground that changed hands glows warmer the more often it did; the old
          // owner's color lingers as an inner ring.
          ctx.beginPath();
          hexPath(ctx, x, c.y, HEX);
          ctx.fillStyle = hexRgba('#fb923c', Math.min(0.14, 0.035 * c.value));
          ctx.fill();
          const prev = c.history[c.history.length - 1];
          if (prev && prev[0] >= 0 && prev[0] !== c.owner) {
            ctx.beginPath();
            hexPath(ctx, x, c.y, HEX * 0.62);
            ctx.strokeStyle = hexRgba(war.sides[prev[0]].color, Math.min(0.3, 0.08 * c.value));
            ctx.stroke();
          }
        }
      }
      // The line: every edge between the two sides. Walls are ASCII in the builder's color.
      ctx.font = '8px "Syne Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      const walls: [number, number, number, number, string][] = [];
      for (const c of cells) {
        if (c.owner !== 0) continue;
        const k = grid.corners(c);
        grid.neighbors(c).forEach((n, i) => {
          if (n.owner !== 1) return;
          // Neighbor i shares the edge from corner (6 - i) % 6 to the next one.
          const a = (6 - i) % 6;
          const b = (a + 1) % 6;
          const x0 = k[a * 2] + ox;
          const y0 = k[a * 2 + 1];
          const x1 = k[b * 2] + ox;
          const y1 = k[b * 2 + 1];
          if (war.fortified(c, n)) walls.push([x0, y0, x1, y1, war.sides[c.since < n.since ? 0 : 1].color]);
          else {
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
          }
        });
      }
      ctx.strokeStyle = hexRgba(api.host.palette.ink, 0.45);
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -time * 6;
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [x0, y0, x1, y1, color] of walls) {
        ctx.strokeStyle = hexRgba(color, 0.3);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.fillStyle = hexRgba(color, 0.75);
        for (let s = 0.1; s < 1; s += 0.2) ctx.fillText('#', Math.round(x0 + (x1 - x0) * s), Math.round(y0 + (y1 - y0) * s));
      }
      ctx.restore();
    }

    /** Systems wear their owner's ring; contested ones pulse. */
    function drawOwners(ctx: CanvasRenderingContext2D, time: number) {
      ctx.save();
      ctx.lineWidth = 1.4;
      for (const s of api.world.systems) {
        if (s.z) continue;
        const x = api.screenX(s.x);
        if (x < -60 || x > api.width + 60) continue;
        const c = grid.at(s.x, s.y);
        if (c.owner < 0) continue;
        const contested = war.onLine(c) && c.hold < 0.6;
        ctx.strokeStyle = hexRgba(war.sides[c.owner].color, contested ? 0.45 + 0.35 * Math.sin(time * 6) : 0.5);
        ctx.beginPath();
        ctx.arc(x, s.y, s.starRadius * 4 + 30, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    /** Each side's supply and reserve in its corner: ▲ holds the top, ▼ the bottom. */
    function drawStatus(ctx: CanvasRenderingContext2D, time: number) {
      ctx.save();
      ctx.font = '9px "Orbit", "Syne Mono", ui-monospace, monospace';
      ctx.textBaseline = 'alphabetic';
      for (const s of war.sides) {
        const bars = Math.round(s.supply * 8);
        const text = `${s.id === 0 ? '▲' : '▼'} ${s.name} · SUPPLY ${'■'.repeat(bars)}${'□'.repeat(8 - bars)} · RESERVE ${Math.round(s.reserve)}`;
        ctx.textAlign = s.id === 0 ? 'left' : 'right';
        const w = ctx.measureText(text).width;
        const x = s.id === 0 ? 14 : api.width - 14;
        ctx.fillStyle = hexRgba(api.host.palette.bg, 0.75);
        ctx.fillRect(s.id === 0 ? x - 4 : x - w - 4, api.height - 23, w + 8, 15);
        ctx.fillStyle = hexRgba(s.color, s.supply < 0.3 ? 0.55 + 0.35 * Math.sin(time * 6) : 0.8);
        ctx.fillText(text, x, api.height - 12);
      }
      ctx.restore();
    }
  },
});
