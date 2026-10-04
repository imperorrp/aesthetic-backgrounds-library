/**
 * Hive Bloom: something is growing over the colonies, and it is beautiful.
 *
 *   useBloom(api)   the creep: a cellular automaton on a fine hex grid anchored to the world.
 *                   Each cell is empty, creep (value = density 0..1), or ash (burned; it
 *                   cools before anything grows there again). Creep thickens, then spreads
 *                   to a random neighbor, more readily where the ground is rich (a noise
 *                   field) and toward colonies (food).
 *   'bloom'         draws the creep as an organic mass: overlapping blobs, magenta
 *                   pustules, tendrils reaching from the edge. Hive nodes seed and feed it.
 *                   Structures it covers are infested: their ASCII art turns to biomass
 *                   glyph by glyph, and colonies evacuate before the end.
 *   'spores'        flocks of spores burst from hive nodes, swirl as a flock along the flow,
 *                   and settle near colonies, seeding new creep. They clog ships' intakes.
 *   'purge'         purge fleets burn the creep back with flame cones; cells they burn
 *                   turn to ash. Dense creep fights back. Now and then a scourge burns a
 *                   hive node out entirely.
 */
import type { Fleet, Structure } from '../types';
import { cellHash, createHexGrid, type Cell, type HexGrid } from '../../../sim/cells';
import { createField } from '../../../sim/fields';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { registerMechanic, steerToward, type MechanicApi } from './types';

type P = { x: number; y: number };

const CELL = 11;
/** Creep cells beyond this stop spreading (keeps the cost bounded). */
const MAX_CREEP = 2400;
const CREEP = 1;
const ASH = 2;
const GREEN = '#a3e635';
const DEEP = '#3f6212';
const MAGENTA = '#e879f9';
const FLAME = '#fb923c';

export type Bloom = {
  grid: HexGrid;
  /** Creep cells (owner 1), live. */
  readonly creep: ReadonlySet<Cell>;
  readonly count: number;
  /** Plant creep at a point (spores landing, a node feeding). */
  seed(x: number, y: number, density: number): void;
  /** Burn creep within r of a point. Returns how many cells turned to ash. */
  burn(x: number, y: number, r: number, power: number): number;
  densityAt(x: number, y: number): number;
  /** The creep cell nearest a point (for purge targeting), if any within maxDist. */
  nearest(x: number, y: number, maxDist: number): Cell | null;
  /** Spread rate multiplier (the mechanic's tuning). */
  rate: number;
};

export function useBloom(api: MechanicApi): Bloom {
  return api.use('bloom', () => createBloom(api));
}

function createBloom(api: MechanicApi): Bloom {
  const grid = createHexGrid(CELL, () => ({ owner: -1, value: 0, hold: 0 }));
  const creep = new Set<Cell>();
  const ash = new Set<Cell>();
  const noise = api.host.noise;
  /** How rich the ground is here, 0.1..1: creep follows veins of it. */
  const rich = (c: Cell) => 0.55 + 0.45 * noise.noise2(c.x * 0.006, c.y * 0.006 + 40);
  let food: P[] = [];
  let clock = 0;
  let nextFood = 0;

  const makeCreep = (c: Cell, v: number) => {
    if (c.owner !== CREEP) {
      c.owner = CREEP;
      c.value = 0;
      creep.add(c);
      ash.delete(c);
    }
    c.value = Math.min(1, Math.max(c.value, v));
  };

  const bloom: Bloom = {
    grid,
    creep,
    get count() {
      return creep.size;
    },
    rate: 1,
    seed(x, y, density) {
      const c = grid.at(x, y);
      if (c.owner === ASH && c.hold > 0.2) return;
      makeCreep(c, density);
    },
    burn(x, y, r, power) {
      let burned = 0;
      grid.forEachIn({ left: x - r, right: x + r, top: y - r, bottom: y + r }, (c) => {
        if (c.owner !== CREEP || Math.hypot(c.x - x, c.y - y) > r) return;
        c.value -= power;
        if (c.value <= 0) {
          c.owner = ASH;
          c.value = 0;
          c.hold = 1;
          creep.delete(c);
          ash.add(c);
          burned++;
        }
      });
      return burned;
    },
    densityAt(x, y) {
      const c = grid.at(x, y);
      return c.owner === CREEP ? c.value : 0;
    },
    nearest(x, y, maxDist) {
      let best: Cell | null = null;
      let bd = maxDist;
      for (const c of creep) {
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      return best;
    },
  };

  /** The automaton, four times a second: thicken, spread, cool the ash, forget what scrolled away. */
  const step = (dt: number) => {
    const v = api.view();
    if (api.t >= nextFood) {
      food = api.structures().filter((s) => !s.z && s.kind !== 'hive_node' && (s.role === 'dock' || s.role === 'giant' || s.role === 'mine'));
      nextFood = api.t + 2;
    }
    for (const c of [...creep]) {
      if (c.x < v.left - 200) {
        creep.delete(c);
        continue;
      }
      const r = rich(c);
      c.value = Math.min(1, c.value + dt * 0.08 * r);
      if (c.value < 0.45 || creep.size >= MAX_CREEP || api.rng() > dt * 0.7 * c.value * bloom.rate) continue;
      const n = grid.neighbors(c)[Math.floor(api.rng() * 6)];
      if (n.owner === CREEP || (n.owner === ASH && n.hold > 0) || n.y < -CELL || n.y > api.height + CELL) continue;
      const fed = food.some((s) => Math.hypot(s.x - n.x, s.y - n.y) < 140) ? 1.8 : 1;
      if (api.rng() < rich(n) * fed) makeCreep(n, 0.12);
    }
    for (const c of ash) {
      c.hold -= dt * 0.025;
      if (c.hold <= 0 || c.x < v.left - 200) {
        ash.delete(c);
        c.owner = -1;
      }
    }
  };

  api.onUpdate((dt) => {
    clock += dt;
    if (clock < 0.25) return;
    step(clock);
    clock = 0;
    if (api.t > 30 && Math.floor(api.t) % 20 === 0) grid.prune(api.view().left - 400);
  });

  // The creep and the ash, under everything on the map.
  api.onDraw('under', (ctx, frame) => {
    const ox = api.screenX(0);
    const v = api.view();
    const inView = (c: Cell) => c.x > v.left - CELL * 2 && c.x < v.right + CELL * 2;
    ctx.save();
    // Ash: grey specks, glowing while still hot.
    ctx.beginPath();
    let hot = false;
    for (const c of ash) {
      if (!inView(c)) continue;
      const k = cellHash(c.q, c.r);
      ctx.rect(c.x + ox + (k - 0.5) * 6, c.y + (cellHash(c.r, c.q) - 0.5) * 6, 1.5, 1.5);
      if (c.hold > 0.7) hot = true;
    }
    ctx.fillStyle = hexRgba('#94a3b8', 0.35);
    ctx.fill();
    if (hot) {
      ctx.beginPath();
      for (const c of ash) if (c.hold > 0.7 && inView(c)) ctx.rect(c.x + ox - 1, c.y - 1, 2, 2);
      ctx.fillStyle = hexRgba(FLAME, 0.6);
      ctx.fill();
    }
    // The mass: one fused body (overlapping blobs filled as a single path, so only the
    // scalloped outline shows), a brighter core where it is thick, and veins through it.
    const cells: Cell[] = [];
    for (const c of creep) if (inView(c)) cells.push(c);
    const blobs = (minValue: number, size: (c: Cell, k: number) => number) => {
      ctx.beginPath();
      for (const c of cells) {
        if (c.value < minValue) continue;
        const k = cellHash(c.q, c.r);
        const r = size(c, k);
        const x = c.x + ox + (k - 0.5) * 8;
        const y = c.y + (cellHash(c.r, c.q) - 0.5) * 8;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    };
    blobs(0, (c, k) => CELL * (0.7 + 0.55 * c.value) * (0.8 + 0.4 * k));
    ctx.fillStyle = hexRgba(DEEP, 0.46);
    ctx.fill();
    blobs(0.7, (_c, k) => CELL * (0.75 + 0.35 * k));
    ctx.fillStyle = hexRgba(GREEN, 0.14);
    ctx.fill();
    // Veins: each thick cell reaches to one neighbor, so the mass is threaded with a network.
    ctx.beginPath();
    for (const c of cells) {
      if (c.value < 0.55) continue;
      const k = cellHash(c.q + 3, c.r - 2);
      if (k > 0.6) continue;
      const n = grid.neighbors(c)[Math.floor(k * 10) % 6];
      if (n.owner !== CREEP) continue;
      const bend = (cellHash(c.r, c.q + 9) - 0.5) * CELL;
      ctx.moveTo(c.x + ox, c.y);
      ctx.quadraticCurveTo((c.x + n.x) / 2 + ox - bend * 0.5, (c.y + n.y) / 2 + bend, n.x + ox, n.y);
    }
    ctx.strokeStyle = hexRgba(GREEN, 0.32);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Pustules: magenta points in the thickest creep, breathing.
    ctx.beginPath();
    for (const c of cells) {
      const k = cellHash(c.q + 7, c.r);
      if (c.value < 0.8 || k > 0.18) continue;
      const r = 1.2 + 1.3 * (0.5 + 0.5 * Math.sin(frame.time * 1.6 + k * 40));
      ctx.moveTo(c.x + ox + r, c.y);
      ctx.arc(c.x + ox, c.y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = hexRgba(MAGENTA, 0.7);
    ctx.fill();
    // Tendrils: from edge cells out into the open, curling and pulsing.
    ctx.beginPath();
    const tips: P[] = [];
    for (const c of cells) {
      if (c.value < 0.4) continue;
      const k = cellHash(c.q, c.r + 3);
      if (k > 0.35) continue;
      const open = grid.neighbors(c).find((n) => n.owner !== CREEP);
      if (!open) continue;
      const ang = Math.atan2(open.y - c.y, open.x - c.x);
      const len = CELL * (1.4 + 1.2 * k + 0.5 * Math.sin(frame.time * 1.2 + k * 30));
      const curl = noise.noise2(c.x * 0.02, frame.time * 0.15 + k * 9) * 1.4;
      const x0 = c.x + ox;
      const mx = x0 + Math.cos(ang + curl * 0.5) * len * 0.55;
      const my = c.y + Math.sin(ang + curl * 0.5) * len * 0.55;
      const tx = x0 + Math.cos(ang + curl) * len;
      const ty = c.y + Math.sin(ang + curl) * len;
      ctx.moveTo(x0, c.y);
      ctx.quadraticCurveTo(mx, my, tx, ty);
      tips.push({ x: tx, y: ty });
    }
    ctx.strokeStyle = hexRgba(GREEN, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = hexRgba(MAGENTA, 0.75);
    for (const t of tips) ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
    ctx.restore();
  });

  return bloom;
}

// ---- the bloom: nodes, infestation, evacuation ---------------------------------------------

const NODE_ART = ['  .@.  ', ' (@@@) ', '~(@@@)~', "  '@'  "];
const GLYPHS = '@%&*o~';

registerMechanic({
  id: 'bloom',
  label: 'The bloom (creep)',
  description: 'Creep grows over the map as a cellular automaton from hive nodes, reaching for colonies with tendrils. Structures it covers turn to biomass, glyph by glyph; colonies evacuate first.',
  schema: {
    rate: { type: 'number', min: 0.2, max: 3, default: 1, label: 'How fast it spreads' },
    nodes: { type: 'number', min: 1, max: 5, default: 2, step: 1, label: 'Hive nodes on screen' },
  },
  create(api, p) {
    const bloom = useBloom(api);
    bloom.rate = Number(p.rate) || 1;
    const want = Math.round(Number(p.nodes) || 2);
    type Infest = { orig: string[]; label: string; color?: string; level: number; shown: number; evacuated: boolean };
    const infest = new Map<string, Infest>();
    let nextScan = 0;
    let nextNode = api.t + 1;

    const nodes = () => api.structures().filter((s) => !s.z && s.kind === 'hive_node');
    const plantNode = (x: number, y: number) => {
      const def = api.pack.structures.find((s) => s.kind === 'hive_node');
      const s = api.addStructure({ x, y, label: def?.label ?? 'HIVE NODE', role: 'mystery', art: def?.art ?? NODE_ART, color: def?.color ?? MAGENTA, kind: 'hive_node' });
      for (let i = 0; i < 14; i++) {
        const a = api.rng() * Math.PI * 2;
        const r = api.rng() * 30;
        bloom.seed(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.9);
      }
      api.emit({ type: 'bloom', x, y, weight: 0.5, color: MAGENTA });
      return s;
    };
    // The bloom has already begun when we arrive.
    {
      const v = api.view();
      for (let i = 0; i < want; i++) {
        const x = v.left + api.width * ((i + 0.5) / want) + (api.rng() - 0.5) * 160;
        const s = plantNode(x, api.height * (0.25 + api.rng() * 0.5));
        // Give it a head start: a patch already grown around it.
        for (let k = 0; k < 280; k++) {
          const a = api.rng() * Math.PI * 2;
          const r = Math.sqrt(api.rng()) * 115;
          bloom.seed(s.x + Math.cos(a) * r * 1.3, s.y + Math.sin(a) * r, 0.5 + api.rng() * 0.5);
        }
      }
    }

    /** Turn a structure's art to biomass, a share of its glyphs at a time. */
    const overgrow = (orig: string[], level: number, seed: number) =>
      orig.map((row, j) =>
        [...row].map((ch, i) => (ch !== ' ' && cellHash(i + seed, j) < level ? GLYPHS[Math.floor(cellHash(j + seed, i + 5) * GLYPHS.length)] : ch)).join(''),
      );

    const evacuate = (s: Structure) => {
      const sp = SHIP_SPECS.freighter.speed;
      const f = api.spawnFleet(
        { x: s.x, y: s.y, vx: 0, vy: 0 },
        {
          cls: 'freighter',
          wings: ['freighter', 'scout'],
          color: '#93c5fd',
          tag: 'evac',
          purpose: 'transit',
          fadeIn: true,
          steer: (fl, dt) => {
            const L = fl.ships[0];
            steerToward(L, L.x + 200, L.y + (L.y < api.height / 2 ? -60 : 60), sp * 1.2, 1, dt);
            if (!api.onScreen(L.x, L.y, 80)) fl.mode = 'gone';
          },
        },
      );
      api.say(`EVACUATING ${s.label} · ${200 + Math.floor(api.rng() * 900)} ABOARD`, s.x, s.y - 26, '#93c5fd', { priority: 'high', followId: f.id });
      api.emit({ type: 'evac', x: s.x, y: s.y, weight: 0.6, follow: api.follow(f) });
    };

    return {
      update(dt) {
        // Keep the bloom fed: nodes feed their surroundings; a lost node is replaced in time.
        for (const n of nodes()) if (api.rng() < dt * 2) bloom.seed(n.x + (api.rng() - 0.5) * 40, n.y + (api.rng() - 0.5) * 40, 0.8);
        if (api.t >= nextNode) {
          nextNode = api.t + 25 + api.rng() * 20;
          if (nodes().filter((n) => api.onScreen(n.x, n.y, -40)).length < want) {
            const v = api.view();
            plantNode(v.left + api.width * (0.55 + api.rng() * 0.4), api.height * (0.15 + api.rng() * 0.7));
            api.say('A NEW NODE IS BLOOMING', v.left + api.width * 0.75, 40, MAGENTA, { priority: 'medium' });
          }
        }
        // Infestation, twice a second.
        if (api.t < nextScan) return;
        nextScan = api.t + 0.5;
        for (const s of api.structures()) {
          if (s.z || s.kind === 'hive_node' || s.role === 'wreck' || !api.onScreen(s.x, s.y, 40)) continue;
          let all = 0;
          let covered = 0;
          bloom.grid.forEachIn({ left: s.x - 30, right: s.x + 30, top: s.y - 24, bottom: s.y + 24 }, (c) => {
            all++;
            if (c.owner === CREEP && c.value > 0.5) covered++;
          });
          const share = all ? covered / all : 0;
          let st = infest.get(s.id);
          if (!st && share < 0.15) continue;
          if (!st) {
            st = { orig: [...s.art], label: s.label, color: s.color, level: 0, shown: 0, evacuated: false };
            infest.set(s.id, st);
          }
          if (share > 0.3) st.level = Math.min(1, st.level + 0.5 * 0.06 * share);
          if (!st.evacuated && st.level > 0.15 && (s.role === 'dock' || s.role === 'giant')) {
            st.evacuated = true;
            evacuate(s);
          }
          // Redraw the art in steps, so the sprite cache sees a handful of versions, not hundreds.
          const step = Math.floor(st.level * 5) / 5;
          if (step > st.shown) {
            st.shown = step;
            s.art = overgrow(st.orig, step, s.id.length * 13);
            if (step >= 0.6) s.color = GREEN;
            if (step >= 1) {
              s.label = `${st.label} · OVERGROWN`;
              api.say(`${st.label} LOST TO THE BLOOM`, s.x, s.y + 30, GREEN, { priority: 'high', duration: 5000 });
              api.emit({ type: 'infested', x: s.x, y: s.y, weight: 0.75, color: GREEN });
            }
          }
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'mid') return;
        // Hive nodes glow and breathe.
        ctx.save();
        for (const n of nodes()) {
          const x = api.screenX(n.x);
          if (x < -80 || x > api.width + 80) continue;
          const k = 0.5 + 0.5 * Math.sin(frame.time * 1.3 + n.x * 0.01);
          const g = ctx.createRadialGradient(x, n.y, 0, x, n.y, 46 + 10 * k);
          g.addColorStop(0, hexRgba(MAGENTA, 0.32 + 0.15 * k));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 60, n.y - 60, 120, 120);
          ctx.strokeStyle = hexRgba(MAGENTA, 0.35 * (1 - ((frame.time * 0.4) % 1)));
          ctx.beginPath();
          ctx.arc(x, n.y, 20 + 50 * ((frame.time * 0.4) % 1), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
});

// ---- spores ---------------------------------------------------------------------------------

type Spore = { x: number; y: number; vx: number; vy: number; px: number; py: number };
type Flock = { spores: Spore[]; target: P; until: number; color: string };

registerMechanic({
  id: 'spores',
  label: 'Spore flocks',
  description: 'Spores burst from hive nodes, swirl as a flock along the currents, and settle near colonies, seeding new creep. They clog ships that fly through them.',
  schema: {
    every: { type: 'number', min: 5, max: 90, default: 22, label: 'Seconds between bursts' },
    size: { type: 'number', min: 10, max: 80, default: 40, step: 1, label: 'Spores per flock' },
  },
  create(api, p) {
    const bloom = useBloom(api);
    const field = createField(api.host.noise);
    field.add({ kind: 'noise', scale: 0.004, strength: 26, period: 40 });
    const flocks: Flock[] = [];
    let next = api.t + 6;
    let nextClog = 0;
    const tmp = { x: 0, y: 0 };

    const burst = () => {
      const nodes = api.structures().filter((s) => !s.z && s.kind === 'hive_node' && api.onScreen(s.x, s.y, 0));
      if (!nodes.length) return;
      const n = nodes[Math.floor(api.rng() * nodes.length)];
      // Toward the nearest colony not yet taken, or somewhere ahead.
      const colonies = api.structures().filter((s) => !s.z && s.kind !== 'hive_node' && api.onScreen(s.x, s.y, 0) && bloom.densityAt(s.x, s.y) < 0.4);
      const target = colonies.sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))[0] ?? { x: n.x + 300, y: api.height * (0.2 + api.rng() * 0.6) };
      const count = Math.round(Number(p.size) || 40);
      const spores: Spore[] = [];
      for (let i = 0; i < count; i++) {
        const a = api.rng() * Math.PI * 2;
        const v = 20 + api.rng() * 40;
        spores.push({ x: n.x, y: n.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, px: n.x, py: n.y });
      }
      flocks.push({ spores, target: { x: target.x, y: target.y }, until: api.t + 18 + api.rng() * 8, color: api.rng() < 0.5 ? MAGENTA : GREEN });
      api.say(`SPORE BURST · ${n.label}`, n.x, n.y - 30, MAGENTA, { priority: 'medium' });
      api.emit({ type: 'spores', x: n.x, y: n.y, weight: 0.5, color: MAGENTA });
    };

    return {
      update(dt) {
        if (api.t >= next) {
          if (flocks.length < 3) burst();
          next = api.t + (Number(p.every) || 22) * (0.7 + api.rng() * 0.6);
        }
        for (let i = flocks.length - 1; i >= 0; i--) {
          const fl = flocks[i];
          // Boids within the flock, plus the current and a pull toward the target.
          let cx = 0;
          let cy = 0;
          let avx = 0;
          let avy = 0;
          for (const s of fl.spores) {
            cx += s.x;
            cy += s.y;
            avx += s.vx;
            avy += s.vy;
          }
          const n = fl.spores.length || 1;
          cx /= n;
          cy /= n;
          avx /= n;
          avy /= n;
          const tx = fl.target.x - cx;
          const ty = fl.target.y - cy;
          const td = Math.hypot(tx, ty) || 1;
          for (const s of fl.spores) {
            let sx = 0;
            let sy = 0;
            for (const o of fl.spores) {
              if (o === s) continue;
              const dx = s.x - o.x;
              const dy = s.y - o.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 100 && d2 > 0.01) {
                sx += dx / d2;
                sy += dy / d2;
              }
            }
            field.sample(s.x, s.y, api.t, tmp);
            const ax = (cx - s.x) * 0.25 + (avx - s.vx) * 0.6 + sx * 90 + tmp.x * 0.8 + (tx / td) * 22;
            const ay = (cy - s.y) * 0.25 + (avy - s.vy) * 0.6 + sy * 90 + tmp.y * 0.8 + (ty / td) * 22;
            s.vx += ax * dt;
            s.vy += ay * dt;
            const sp = Math.hypot(s.vx, s.vy);
            if (sp > 55) {
              s.vx *= 55 / sp;
              s.vy *= 55 / sp;
            }
            s.px = s.x;
            s.py = s.y;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
          }
          // Arrived, or out of time: settle and seed.
          if (td < 40 || api.t > fl.until) {
            for (const s of fl.spores) if (api.rng() < 0.3) bloom.seed(s.x, s.y, 0.35);
            api.emit({ type: 'settle', x: cx, y: cy, weight: 0.3, color: fl.color });
            flocks.splice(i, 1);
          }
        }
        // Ships flying through a flock choke on it.
        if (api.t >= nextClog && flocks.length) {
          nextClog = api.t + 0.5;
          for (const f of api.world.fleets) {
            if (f.z > 0.15 || !f.ships[0]) continue;
            for (const s of f.ships) {
              let near = 0;
              for (const fl of flocks) for (const sp of fl.spores) if (Math.abs(sp.x - s.x) < 14 && Math.abs(sp.y - s.y) < 14) near++;
              if (near < 5) continue;
              api.damage(f, s, 1);
              if (api.rng() < 0.3) api.say(`${f.callsign} · SPORES ON THE INTAKE`, s.x, s.y, GREEN, { priority: 'low', followId: f.id });
              break;
            }
          }
        }
      },
      draw(ctx, pass) {
        if (pass !== 'over' || !flocks.length) return;
        const ox = api.screenX(0);
        ctx.save();
        ctx.lineWidth = 1;
        for (const fl of flocks) {
          ctx.strokeStyle = hexRgba(fl.color, 0.55);
          ctx.beginPath();
          for (const s of fl.spores) {
            // A short streak: where it was a moment ago to where it is.
            ctx.moveTo(s.px + ox - s.vx * 0.12, s.py - s.vy * 0.12);
            ctx.lineTo(s.x + ox, s.y);
          }
          ctx.stroke();
          ctx.fillStyle = hexRgba(fl.color, 0.95);
          for (const s of fl.spores) ctx.fillRect(s.x + ox - 1, s.y - 1, 2, 2);
        }
        ctx.restore();
      },
    };
  },
});

// ---- purge ----------------------------------------------------------------------------------

type Flame = { from: () => P | null; ang: number; len: number; until: number };

registerMechanic({
  id: 'purge',
  label: 'Purge fleets',
  description: 'Purge fleets burn the creep back with flame cones, leaving ash. Dense creep fights back, and now and then a scourge burns out a hive node.',
  schema: {
    rate: { type: 'number', min: 0.2, max: 4, default: 1.2, label: 'Purges per minute' },
    scourge: { type: 'boolean', default: true, label: 'Scourges burn out hive nodes' },
  },
  create(api, p) {
    const bloom = useBloom(api);
    const rate = Number(p.rate) || 1.2;
    type Purge = { f: Fleet; target: P; until: number; retarget: number; scourge: boolean; node?: Structure };
    const purges: Purge[] = [];
    const flames: Flame[] = [];
    let next = api.t + 12 + api.rng() * 8;
    let nextScourge = api.t + 100 + api.rng() * 60;
    let nextBurn = 0;
    let nextBite = 0;

    const launch = (scourge: boolean) => {
      const v = api.view();
      const node = scourge ? api.structures().find((s) => !s.z && s.kind === 'hive_node' && api.onScreen(s.x, s.y, -60)) : undefined;
      if (scourge && !node) return;
      // Purge the creep nearest a colony it threatens, or the creep's edge anywhere.
      const colonies = api.structures().filter((s) => !s.z && s.kind !== 'hive_node' && api.onScreen(s.x, s.y, 0));
      let target: P | null = node ?? null;
      for (const c of colonies) {
        const e = bloom.nearest(c.x, c.y, 220);
        if (e) {
          target = e;
          break;
        }
      }
      target ??= bloom.nearest(v.left + api.width / 2, api.height / 2, 2000);
      if (!target) return;
      const from = { x: v.right + 40, y: Math.max(40, Math.min(api.height - 40, target.y + (api.rng() - 0.5) * 300)) };
      const cls = scourge ? 'capital' : 'cruiser';
      const sp = SHIP_SPECS[cls].speed * 1.4;
      const pg: Purge = { f: null as unknown as Fleet, target: { x: target.x, y: target.y }, until: api.t + (scourge ? 40 : 34), retarget: 0, scourge, node };
      pg.f = api.spawnFleet(
        { x: from.x, y: from.y, vx: -40, vy: 0 },
        {
          cls,
          wings: ['fighter', 'fighter', 'fighter'],
          faction: 0,
          color: FLAME,
          tag: 'purge',
          warpIn: true,
          steer: (f, dt) => {
            const L = f.ships[0];
            if (api.t > pg.until) steerToward(L, L.x + 200, L.y, sp, 1.2, dt);
            else steerToward(L, pg.target.x + 26, pg.target.y, sp, 1.4, dt, 40);
          },
        },
      );
      const label = scourge ? `SCOURGE · NAPALM RUN · ${node!.label}` : 'PURGE FLEET · TORCHES LIT';
      api.say(label, from.x - 60, from.y, FLAME, { priority: 'high', followId: pg.f.id });
      api.emit({ type: scourge ? 'scourge' : 'purge', x: target.x, y: target.y, weight: scourge ? 0.8 : 0.65, color: FLAME, follow: api.follow(pg.f) });
      purges.push(pg);
    };

    return {
      update() {
        if (api.t >= next) {
          if (purges.length < 2 && bloom.count > 120) launch(false);
          next = api.t + (60 / rate) * (0.6 + api.rng() * 0.8);
        }
        if (p.scourge !== false && api.t >= nextScourge) {
          launch(true);
          nextScourge = api.t + 150 + api.rng() * 90;
        }
        for (let i = flames.length - 1; i >= 0; i--) if (api.t > flames[i].until) flames.splice(i, 1);
        const burning = api.t >= nextBurn;
        if (burning) nextBurn = api.t + 0.15;
        const biting = api.t >= nextBite;
        if (biting) nextBite = api.t + 1;
        for (let i = purges.length - 1; i >= 0; i--) {
          const pg = purges[i];
          const L = pg.f.ships[0];
          if (!L || pg.f.mode === 'gone') {
            purges.splice(i, 1);
            continue;
          }
          if (api.t > pg.until) {
            if (!api.onScreen(L.x, L.y, 60)) pg.f.mode = 'gone';
            continue;
          }
          // Move along the edge: retarget to the nearest creep every couple of seconds.
          if (api.t >= pg.retarget && !pg.scourge) {
            pg.retarget = api.t + 2;
            const e = bloom.nearest(L.x, L.y, 300);
            if (e) pg.target = { x: e.x, y: e.y };
          }
          // Scourge: over the node, the napalm falls.
          if (pg.scourge && pg.node && Math.hypot(L.x - pg.node.x, L.y - pg.node.y) < 40) {
            const n = pg.node;
            pg.node = undefined;
            bloom.burn(n.x, n.y, 95, 2);
            for (let k = 0; k < 6; k++) api.fx.explode(n.x + (api.rng() - 0.5) * 90, n.y + (api.rng() - 0.5) * 70, FLAME, 1.1);
            api.fx.ring(n.x, n.y, FLAME, 120, 1.6, 10, 2);
            api.removeStructure(n.id);
            api.say(`${n.label} BURNED OUT`, n.x, n.y + 30, FLAME, { priority: 'high', duration: 5000 });
            api.emit({ type: 'nodeburn', x: n.x, y: n.y, weight: 0.85, color: FLAME });
            pg.until = api.t + 4;
          }
          // Each ship flames the creep in front of it.
          if (!burning) continue;
          for (const s of pg.f.ships) {
            const c = bloom.nearest(s.x, s.y, s.cls === 'fighter' ? 60 : 80);
            if (!c) continue;
            const ang = Math.atan2(c.y - s.y, c.x - s.x);
            const len = s.cls === 'fighter' ? 52 : 74;
            flames.push({ from: () => (pg.f.ships.includes(s) ? s : null), ang, len, until: api.t + 0.22 });
            // Burn along the cone.
            for (let k = 0.35; k <= 1; k += 0.3) bloom.burn(s.x + Math.cos(ang) * len * k, s.y + Math.sin(ang) * len * k, 10 + 10 * k, 0.28);
            if (api.rng() < 0.2) api.fx.sparks(c.x, c.y, FLAME, 3, 30);
          }
          // Dense creep fights back.
          if (biting) {
            for (const s of pg.f.ships) {
              if (bloom.densityAt(s.x, s.y) > 0.75 && api.rng() < 0.35) {
                api.damage(pg.f, s, 1);
                api.fx.sparks(s.x, s.y, GREEN, 5, 40);
                if (api.rng() < 0.4) api.say(`${pg.f.callsign} · TENDRILS ON THE HULL`, s.x, s.y, GREEN, { priority: 'medium', followId: pg.f.id });
                break;
              }
            }
          }
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'over' || !flames.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const fl of flames) {
          const s = fl.from();
          if (!s) continue;
          const x = api.screenX(s.x);
          // A flickering wedge: white-hot at the nozzle, orange, then nothing.
          const len = fl.len * (0.85 + 0.15 * Math.sin(frame.time * 40 + s.x));
          const g = ctx.createRadialGradient(x, s.y, 2, x, s.y, len);
          g.addColorStop(0, 'rgba(255,247,214,0.85)');
          g.addColorStop(0.25, hexRgba(FLAME, 0.6));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, s.y);
          ctx.arc(x, s.y, len, fl.ang - 0.32, fl.ang + 0.32);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      },
    };
  },
});
