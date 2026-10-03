/**
 * Asteroid belts and mining.
 *
 * - Belts are arcs of ASCII rock orbiting a center off the edge of the map, so they sweep
 *   slowly across it. Stray rocks cross the belts and collide: sparks, debris, splits.
 * - Prospectors pick ore-rich rocks, park, and cut: a flickering beam, sparks, ore motes
 *   streaming back. Rocks crack and split. With a full hold they carry the ore home in
 *   glowing pods (the economy unloads it at the dock).
 * - Two prospectors on the same rich rock is a claim dispute: a standoff, warning shots,
 *   and then one backs down or they fight it out.
 * - Weather matters: inside a storm front beams cut out, miners run for the docks, and
 *   loose rock drifts on the wind.
 * - A `blowout` event (from `events`) throws a spray of fresh rock out of a mine.
 */
import type { Fleet, Structure } from '../types';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { createSpatialHash } from '../../../sim/spatial';
import { createCombat } from './combat';
import { registerMechanic, steerOrbit, steerToward } from './types';
import { useWeather } from './weather';

/** A rock: on a belt (orbiting) or loose (drifting with velocity and the wind). */
type Rock = {
  id: number; x: number; y: number; r: number; ore: number; phase: number; hp: number;
  /** Belt membership: orbit angle and radial offset; absent for loose rocks. */
  belt?: Belt; a?: number; dr?: number;
  vx: number; vy: number;
  /** Sim time it came into being; fresh fragments do not collide for a moment (no chain reactions). */
  born: number;
  claim?: string; claimAt?: number;
};
type Belt = { cx: number; cy: number; R: number; w: number; squash: number };
type Mote = { x: number; y: number; to: Fleet; life: number };

const GLYPHS: Record<number, string[]> = { 1: ['.', "'", '·'], 2: ['o', 'c', 'o'], 3: ['O', '0', 'Q'], 4: ['@', '&', '@'] };
const SIZE_PX: Record<number, number> = { 1: 8, 2: 11, 3: 15, 4: 20 };

registerMechanic({
  id: 'asteroids',
  label: 'Asteroid belts and mining',
  description: 'Orbiting belts of ASCII rock with collisions; prospectors cut ore, file claims, dispute them, and haul ore home; storms send them running.',
  schema: {
    density: { type: 'number', min: 0.2, max: 2, default: 1, label: 'Belt density' },
    miners: { type: 'number', min: 0, max: 6, default: 3, step: 1, label: 'Prospectors at work' },
    richness: { type: 'number', min: 0, max: 1, default: 0.45, label: 'Ore richness' },
    strays: { type: 'number', min: 0, max: 3, default: 1, label: 'Stray rocks (collisions)' },
    disputes: { type: 'number', min: 0, max: 1, default: 0.35, label: 'Claim disputes' },
    rock: { type: 'color', default: '#8b7d6b', label: 'Rock color' },
    ore: { type: 'color', default: '#f2b45a', label: 'Ore color' },
  },
  create(api, p) {
    const rocks: Rock[] = [];
    const motes: Mote[] = [];
    const combat = createCombat(api);
    const weather = useWeather(api);
    const grid = createSpatialHash<Rock>(40);
    let id = 100;
    let nextBelt = 0;
    let nextStray = api.t + 6;
    const density = Number(p.density) || 1;
    const rockColor = String(p.rock || '#8b7d6b');
    const oreColor = String(p.ore || '#f2b45a');
    type Job = { fleet: Fleet; rock: Rock | null; cut: number; hold: number; beamAt: number; dispute?: Dispute };
    type Dispute = { a: Job; b: Job; rock: Rock; at: number; stage: 'standoff' | 'warning' | 'settled' };
    const jobs: Job[] = [];
    const disputes: Dispute[] = [];

    const newRock = (o: Omit<Rock, 'id' | 'phase' | 'hp' | 'born'>): Rock => ({ ...o, id: id++, phase: api.rng() * 10, hp: o.r * 2.5, born: api.t });

    /** A belt: an arc of rock around a center well off the map, so it sweeps across slowly. */
    const belt = (x0: number) => {
      const above = api.rng() < 0.5;
      const R = 520 + api.rng() * 520;
      const b: Belt = {
        cx: x0 + R * (0.2 + api.rng() * 0.4),
        cy: above ? -R * 0.55 : api.height + R * 0.55,
        R,
        // Angular speed: about 6-12 px/s along the arc.
        w: ((6 + api.rng() * 6) / R) * (api.rng() < 0.5 ? 1 : -1),
        squash: 0.55 + api.rng() * 0.3,
      };
      const span = 0.5 + api.rng() * 0.5;
      const mid = above ? Math.PI / 2 : -Math.PI / 2;
      const n = Math.round(((R * span) / 9) * density);
      for (let i = 0; i < n; i++) {
        const a = mid + (api.rng() - 0.5) * span;
        const dr = (api.rng() - 0.5) * (60 + api.rng() * 50);
        const r = api.rng() < 0.08 ? 4 : api.rng() < 0.25 ? 3 : api.rng() < 0.6 ? 2 : 1;
        const x = b.cx + Math.cos(a) * (R + dr);
        const y = b.cy + Math.sin(a) * (R + dr) * b.squash;
        rocks.push(newRock({ belt: b, a, dr, x, y, vx: 0, vy: 0, r, ore: api.rng() < Number(p.richness ?? 0.45) ? 0.4 + api.rng() * 0.6 : 0 }));
      }
    };
    // Seed the view, then keep belts coming from ahead.
    belt(api.view().left - 200);
    if (api.rng() < 0.6) belt(api.view().left + api.width * 0.5);
    nextBelt = api.view().right + 200 + api.rng() * 500;

    /** A loose rock flung across the map: the thing that collides with belts. */
    const stray = () => {
      const v = api.view();
      const fromTop = api.rng() < 0.5;
      const x = v.left + api.width * (0.2 + api.rng() * 0.8);
      const y = fromTop ? -20 : api.height + 20;
      const ang = (fromTop ? Math.PI / 2 : -Math.PI / 2) + (api.rng() - 0.5) * 1.1;
      const sp = 30 + api.rng() * 30;
      rocks.push(newRock({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: api.rng() < 0.3 ? 3 : 2, ore: 0 }));
    };

    /** Break a rock: sparks, a ring, and smaller pieces flying off. */
    const shatter = (r: Rock, strength: number) => {
      const i = rocks.indexOf(r);
      if (i < 0) return;
      rocks.splice(i, 1);
      api.fx.sparks(r.x, r.y, rockColor, 8 + r.r * 4, 40 + strength * 30);
      api.fx.ring(r.x, r.y, r.ore ? oreColor : rockColor, 14 + r.r * 6, 0.6, 2, 1);
      if (r.r <= 1) return;
      for (let k = 0; k < 2 + Math.floor(api.rng() * 2); k++) {
        const a = api.rng() * Math.PI * 2;
        const sp = 8 + strength * 14 * api.rng();
        rocks.push(newRock({ x: r.x, y: r.y, vx: r.vx * 0.5 + Math.cos(a) * sp, vy: r.vy * 0.5 + Math.sin(a) * sp, r: r.r - 1, ore: r.ore * 0.5 }));
      }
    };

    const pickRock = (f: Fleet, contest: boolean): Rock | null => {
      const L = f.ships[0];
      const candidates = rocks.filter((r) => r.ore > 0 && r.r >= 2 && api.onScreen(r.x, r.y, 40));
      // A contested pick goes for a rock someone else is already cutting.
      const taken = candidates.filter((r) => jobs.some((j) => j.rock === r && !j.dispute));
      const pool = contest && taken.length ? taken : candidates.filter((r) => !jobs.some((j) => j.rock === r));
      pool.sort((a, b) => Math.hypot(a.x - L.x, a.y - L.y) - Math.hypot(b.x - L.x, b.y - L.y));
      return pool[0] ?? null;
    };

    const docksNear = (x: number, y: number) =>
      api
        .structures()
        .filter((s) => !s.z && (s.role === 'mine' || s.role === 'dock') && api.onScreen(s.x, s.y, 100))
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));

    /** Done mining (full hold, or weather): load the pods and head for a dock. */
    const goHome = (j: Job, why: string) => {
      const f = j.fleet;
      const L = f.ships[0];
      if (j.hold > 0) f.cargo = { good: 'ore', amount: j.hold * 15, color: oreColor };
      const dock: Structure | undefined = docksNear(L.x, L.y)[0];
      api.say(`${f.callsign} · ${why}`, L.x, L.y, L.color, { priority: 'medium', followId: f.id });
      if (dock) api.goTo(f, dock);
      else api.release(f);
      const i = jobs.indexOf(j);
      if (i >= 0) jobs.splice(i, 1);
    };

    const hire = () => {
      const docks = docksNear(api.view().left + api.width / 2, api.height / 2);
      const from = docks.length ? docks[Math.floor(api.rng() * docks.length)] : null;
      const v = api.view();
      const at = from ? { x: from.x, y: from.y } : { x: v.right + 40, y: 60 + api.rng() * (api.height - 120) };
      const contest = api.rng() < Number(p.disputes ?? 0.35);
      const job: Job = { fleet: null as unknown as Fleet, rock: null, cut: 0, hold: 0, beamAt: 0 };
      const speed = SHIP_SPECS.scout.speed * 0.8;
      job.fleet = api.spawnFleet(
        { x: at.x, y: at.y, vx: -20, vy: 0 },
        {
          cls: api.rng() < 0.6 ? 'scout' : 'freighter',
          wings: [],
          tag: 'miner',
          purpose: 'cargo',
          steer: (f, dt) => {
            const L = f.ships[0];
            if (job.dispute && job.dispute.stage !== 'settled') {
              // Standoff: both hold off the rock, facing each other.
              const d = job.dispute;
              steerOrbit(L, d.rock.x, d.rock.y, 46, 10, job === d.a ? 1 : -1, 2, dt);
              return;
            }
            if (!job.rock || !rocks.includes(job.rock)) {
              job.rock = pickRock(f, contest && !job.cut);
              if (!job.rock) {
                steerToward(L, L.x - 40, L.y, speed * 0.5, 1, dt);
                return;
              }
            }
            const r = job.rock;
            const d = Math.hypot(r.x - L.x, r.y - L.y);
            if (d > 30) steerToward(L, r.x, r.y, speed, 2.2, dt, 60);
            else steerOrbit(L, r.x, r.y, 20, 8, 1, 2, dt);
          },
        },
      );
      jobs.push(job);
    };

    /** Two miners on one rock: start a dispute (once per pair). */
    const checkDisputes = () => {
      for (const a of jobs) {
        if (a.dispute || !a.rock) continue;
        const b = jobs.find((o) => o !== a && o.rock === a.rock && !o.dispute);
        if (!b) continue;
        const La = a.fleet.ships[0];
        const Lb = b.fleet.ships[0];
        if (!La || !Lb || Math.hypot(La.x - a.rock.x, La.y - a.rock.y) > 90 || Math.hypot(Lb.x - a.rock.x, Lb.y - a.rock.y) > 90) continue;
        const d: Dispute = { a, b, rock: a.rock, at: api.t, stage: 'standoff' };
        a.dispute = b.dispute = d;
        disputes.push(d);
        api.say(`CLAIM DISPUTE · ROCK ${a.rock.id}`, a.rock.x, a.rock.y - 20, '#f43f5e', { priority: 'high' });
        api.emit({ type: 'dispute', x: a.rock.x, y: a.rock.y, weight: 0.6, follow: api.follow(a.fleet) });
      }
    };

    const runDisputes = () => {
      for (let i = disputes.length - 1; i >= 0; i--) {
        const d = disputes[i];
        const age = api.t - d.at;
        const A = d.a.fleet.ships[0];
        const B = d.b.fleet.ships[0];
        if (!A || !B) {
          if (d.a.dispute === d) d.a.dispute = undefined;
          if (d.b.dispute === d) d.b.dispute = undefined;
          disputes.splice(i, 1);
          continue;
        }
        if (d.stage === 'standoff' && age > 2.5) {
          d.stage = 'warning';
          // Warning shots: wide on purpose.
          for (let k = 0; k < 3; k++) api.fx.tracer(A.x, A.y, B.x + (api.rng() - 0.5) * 60, B.y + (api.rng() - 0.5) * 60, '#f43f5e');
          api.say(`${d.a.fleet.callsign} · WARNING SHOTS`, A.x, A.y, '#f43f5e', { priority: 'medium', followId: d.a.fleet.id });
        } else if (d.stage === 'warning' && age > 5) {
          d.stage = 'settled';
          disputes.splice(i, 1);
          if (api.rng() < 0.5) {
            combat.engage([d.a.fleet], [d.b.fleet], { weaponA: 'tracers', weaponB: 'tracers', seconds: 8, colorA: '#f43f5e', colorB: '#fbbf24' });
            api.say('SHOTS FIRED · CLAIM CONTESTED', d.rock.x, d.rock.y - 22, '#f43f5e', { priority: 'high' });
            api.emit({ type: 'combat', x: d.rock.x, y: d.rock.y, weight: 0.7, follow: api.follow(d.a.fleet) });
          } else {
            const loser = api.rng() < 0.5 ? d.a : d.b;
            loser.rock = null;
            loser.cut = 1;
            api.say(`${loser.fleet.callsign} · BACKING OFF`, loser.fleet.ships[0].x, loser.fleet.ships[0].y, loser.fleet.ships[0].color, { priority: 'medium', followId: loser.fleet.id });
          }
          d.a.dispute = d.b.dispute = undefined;
        }
      }
    };

    // A blowout at a mine sprays fresh rock outward.
    api.bus.on('blowout', (e) => {
      if (e.x === undefined || e.y === undefined) return;
      for (let k = 0; k < 9; k++) {
        const a = api.rng() * Math.PI * 2;
        const sp = 40 + api.rng() * 70;
        rocks.push(newRock({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: api.rng() < 0.3 ? 3 : 2, ore: api.rng() < 0.7 ? 0.6 + api.rng() * 0.4 : 0 }));
      }
    });

    const wind = { x: 0, y: 0 };
    return {
      update(dt) {
        const v = api.view();
        combat.update(dt);
        // Motion: belt rocks orbit; loose rocks drift, slow down, and ride the wind.
        for (const r of rocks) {
          if (r.belt) {
            r.a! += r.belt.w * dt;
            const rr = r.belt.R + r.dr!;
            const nx = r.belt.cx + Math.cos(r.a!) * rr;
            const ny = r.belt.cy + Math.sin(r.a!) * rr * r.belt.squash;
            r.vx = (nx - r.x) / Math.max(dt, 1e-3);
            r.vy = (ny - r.y) / Math.max(dt, 1e-3);
            r.x = nx;
            r.y = ny;
          } else {
            weather.field.sample(r.x, r.y, api.t, wind);
            r.vx += (wind.x - r.vx * 0.15) * dt;
            r.vy += (wind.y - r.vy * 0.15) * dt;
            r.x += r.vx * dt;
            r.y += r.vy * dt;
          }
        }
        // Wind also strips rock off the belts: inside a front, belt rocks come loose.
        for (const r of rocks) {
          if (r.belt && weather.intensity(r.x, r.y) > 0.5 && api.rng() < dt * 0.3) r.belt = undefined;
        }
        for (let i = rocks.length - 1; i >= 0; i--) {
          const r = rocks[i];
          if (r.x < v.left - 300 || r.y < -400 || r.y > api.height + 400) rocks.splice(i, 1);
        }
        if (v.right + 100 > nextBelt) {
          belt(nextBelt);
          nextBelt += 600 + api.rng() * 900;
        }
        if ((Number(p.strays) || 0) > 0 && api.t >= nextStray) {
          stray();
          nextStray = api.t + (20 + api.rng() * 20) / Number(p.strays);
        }

        // Collisions: loose rocks (the fast ones) against everything near.
        grid.clear();
        for (const r of rocks) grid.insert(r, r.x, r.y);
        const near: Rock[] = [];
        for (const r of rocks) {
          if (r.belt || !rocks.includes(r) || api.t - r.born < 2.5) continue;
          for (const o of grid.query(r.x, r.y, r.r * 4 + 8, near)) {
            if (o === r || !rocks.includes(o) || api.t - o.born < 2.5) continue;
            const rel = Math.hypot(r.vx - o.vx, r.vy - o.vy);
            if (rel < 24 || Math.hypot(o.x - r.x, o.y - r.y) > (r.r + o.r) * 2.6) continue;
            const strength = Math.min(2, rel / 30);
            api.emit({ type: 'collision', x: r.x, y: r.y, weight: 0.15 + 0.1 * strength });
            if (o.r <= r.r) shatter(o, strength);
            shatter(r, strength);
            break;
          }
        }

        while (jobs.filter((j) => j.fleet.mode !== 'gone').length < Number(p.miners ?? 3) && rocks.some((r) => r.ore > 0 && api.onScreen(r.x, r.y, 0))) hire();
        checkDisputes();
        runDisputes();

        for (let i = jobs.length - 1; i >= 0; i--) {
          const j = jobs[i];
          const f = j.fleet;
          if (f.mode === 'gone' || !f.ships.length) {
            jobs.splice(i, 1);
            continue;
          }
          const L = f.ships[0];
          // Weather: in a front, beams go dark and miners run for the docks.
          if (weather.intensity(L.x, L.y) > 0.4) {
            goHome(j, 'BEAMS DOWN · RUNNING FOR THE DOCKS');
            continue;
          }
          const r = j.rock;
          if (j.dispute || !r || !rocks.includes(r) || Math.hypot(r.x - L.x, r.y - L.y) > 34) continue;
          // Cutting: a beam pulse, sparks, ore streaming back.
          if (api.t >= j.beamAt) {
            api.fx.beam(() => (rocks.includes(r) ? { x: L.x, y: L.y } : null), () => (rocks.includes(r) ? { x: r.x, y: r.y } : null), oreColor, 0.75, 1.2);
            j.beamAt = api.t + 0.7;
          }
          if (api.rng() < dt * 8) api.fx.sparks(r.x, r.y, oreColor, 2, 30);
          if (r.ore > 0 && api.rng() < dt * 6) motes.push({ x: r.x, y: r.y, to: f, life: 2 });
          r.hp -= dt * 1.1;
          j.cut += dt;
          if (!r.claim && j.cut > 1.5) {
            r.claim = f.callsign;
            r.claimAt = api.t;
          }
          if (r.hp <= 0) {
            if (r.r > 1) api.say(`ROCK ${r.id} SPLIT`, r.x, r.y + 14, oreColor, { duration: 2600 });
            shatter(r, 0.5);
            j.hold += 1;
            j.rock = null;
            if (j.hold >= 2 + Math.floor(api.rng() * 2)) goHome(j, 'HOLD FULL · RETURNING');
          }
        }
        for (const m of motes) {
          const L = m.to.ships[0];
          if (!L) {
            m.life = 0;
            continue;
          }
          const dx = L.x - m.x;
          const dy = L.y - m.y;
          const d = Math.hypot(dx, dy) || 1;
          m.x += (dx / d) * 70 * dt;
          m.y += (dy / d) * 70 * dt;
          m.life -= dt;
          if (d < 4) m.life = 0;
        }
        for (let i = motes.length - 1; i >= 0; i--) if (motes[i].life <= 0) motes.splice(i, 1);
      },
      draw(ctx, pass, frame) {
        if (pass === 'under') {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // One font per size class, so the font is set four times, not once per rock.
          for (let size = 1; size <= 4; size++) {
            ctx.font = `${SIZE_PX[size]}px "Syne Mono", ui-monospace, monospace`;
            for (const r of rocks) {
              if (r.r !== size) continue;
              const x = api.screenX(r.x);
              if (x < -30 || x > api.width + 30) continue;
              const g = GLYPHS[r.r];
              const ch = g[Math.floor(frame.time * 0.25 + r.phase) % g.length];
              const lit = r.ore > 0 ? 0.55 + 0.45 * Math.max(0, Math.sin(frame.time * 1.3 + r.phase)) : 0;
              ctx.fillStyle = hexRgba(lit > 0 ? oreColor : rockColor, lit > 0 ? 0.55 + 0.35 * lit : r.belt ? 0.55 : 0.7);
              ctx.fillText(ch, Math.round(x * frame.dpr) / frame.dpr, Math.round(r.y * frame.dpr) / frame.dpr);
            }
          }
          // Claim flags.
          ctx.font = '8px "Syne Mono", ui-monospace, monospace';
          for (const r of rocks) {
            if (!r.claim || r.claimAt === undefined) continue;
            const age = frame.time - r.claimAt;
            if (age >= 16) continue;
            const x = api.screenX(r.x);
            ctx.fillStyle = hexRgba(oreColor, 0.75 * Math.min(1, (16 - age) / 3));
            ctx.fillText(`⚑ ${r.claim}`, Math.round(x + 14), Math.round(r.y - 12));
          }
          ctx.restore();
        } else if (pass === 'mid') {
          for (const m of motes) {
            ctx.fillStyle = hexRgba(oreColor, 0.9 * Math.min(1, m.life));
            ctx.fillRect(api.screenX(m.x) - 1, m.y - 1, 2, 2);
          }
          // A standoff: a tense dashed line between the two claimants.
          for (const d of disputes) {
            const A = d.a.fleet.ships[0];
            const B = d.b.fleet.ships[0];
            if (!A || !B) continue;
            ctx.strokeStyle = hexRgba('#f43f5e', 0.45 + 0.3 * Math.sin(frame.time * 8));
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(api.screenX(A.x), A.y);
            ctx.lineTo(api.screenX(B.x), B.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      },
    };
  },
});
