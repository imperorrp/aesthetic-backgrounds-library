/**
 * Asteroid belts and mining. Belts of ASCII rock drift across the map. Prospectors
 * pick ore-rich rocks, park beside them, and cut: a flickering beam, sparks, ore
 * streaming back to the ship. Rocks crack and split into smaller ones, claims are
 * filed, and a ship with a full hold heads for the nearest dock.
 */
import type { Fleet } from '../types';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { registerMechanic, steerOrbit, steerToward } from './types';

type Rock = { id: number; x: number; y: number; r: number; ore: number; vx: number; vy: number; phase: number; hp: number; claim?: string; claimAt?: number };
type Mote = { x: number; y: number; to: Fleet; life: number };

const GLYPHS: Record<number, string[]> = { 1: ['.', "'", '·'], 2: ['o', 'c', 'o'], 3: ['O', '0', 'Q'], 4: ['@', '&', '@'] };
const SIZE_PX: Record<number, number> = { 1: 8, 2: 11, 3: 15, 4: 20 };

registerMechanic({
  id: 'asteroids',
  label: 'Asteroid belts and mining',
  description: 'Drifting belts of ASCII rock. Prospectors cut ore-rich rocks, rocks split, claims are filed, full holds head for the docks.',
  schema: {
    density: { type: 'number', min: 0.2, max: 2, default: 1, label: 'Belt density' },
    miners: { type: 'number', min: 0, max: 6, default: 3, step: 1, label: 'Prospectors at work' },
    richness: { type: 'number', min: 0, max: 1, default: 0.45, label: 'Ore richness' },
    rock: { type: 'color', default: '#8b7d6b', label: 'Rock color' },
    ore: { type: 'color', default: '#f2b45a', label: 'Ore color' },
  },
  create(api, p) {
    const rocks: Rock[] = [];
    const motes: Mote[] = [];
    let id = 100;
    let nextBelt = 0;
    const density = Number(p.density) || 1;
    const rockColor = String(p.rock || '#8b7d6b');
    const oreColor = String(p.ore || '#f2b45a');
    type Job = { fleet: Fleet; rock: Rock | null; cut: number; hold: number; beamAt: number };
    const jobs: Job[] = [];

    const belt = (x0: number) => {
      // A belt is a long, slightly bent band of rock.
      const cy = 80 + api.rng() * (api.height - 160);
      const ang = (api.rng() - 0.5) * 0.9;
      const len = 380 + api.rng() * 520;
      const n = Math.round((len / 9) * density);
      for (let i = 0; i < n; i++) {
        const u = api.rng();
        const off = (api.rng() - 0.5) * (50 + api.rng() * 50);
        const bend = Math.sin(u * Math.PI) * 40;
        const r = api.rng() < 0.08 ? 4 : api.rng() < 0.25 ? 3 : api.rng() < 0.6 ? 2 : 1;
        rocks.push({
          id: id++,
          x: x0 + Math.cos(ang) * u * len - Math.sin(ang) * off,
          y: cy + Math.sin(ang) * u * len + Math.cos(ang) * off + bend,
          r,
          ore: api.rng() < Number(p.richness ?? 0.45) ? 0.4 + api.rng() * 0.6 : 0,
          vx: (api.rng() - 0.5) * 2,
          vy: (api.rng() - 0.5) * 2,
          phase: api.rng() * 10,
          hp: r * 2.5,
        });
      }
    };
    // Seed the view, then keep belts coming from ahead.
    belt(api.view().left - 100);
    if (api.rng() < 0.6) belt(api.view().left + api.width * 0.5);
    nextBelt = api.view().right + 200 + api.rng() * 500;

    const pickRock = (f: Fleet) => {
      const L = f.ships[0];
      const ore = rocks.filter((r) => r.ore > 0 && r.r >= 2 && !jobs.some((j) => j.rock === r) && api.onScreen(r.x, r.y, 40));
      ore.sort((a, b) => Math.hypot(a.x - L.x, a.y - L.y) - Math.hypot(b.x - L.x, b.y - L.y));
      return ore[0] ?? null;
    };

    const hire = () => {
      const docks = api.structures().filter((s) => !s.z && (s.role === 'mine' || s.role === 'dock') && api.onScreen(s.x, s.y, 100));
      const from = docks.length ? docks[Math.floor(api.rng() * docks.length)] : null;
      const v = api.view();
      const at = from ? { x: from.x, y: from.y } : { x: v.right + 40, y: 60 + api.rng() * (api.height - 120) };
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
            if (!job.rock || !rocks.includes(job.rock)) {
              job.rock = pickRock(f);
              if (!job.rock) {
                steerToward(L, L.x - 40, L.y, speed * 0.5, 1, dt);
                return;
              }
              api.say(`${f.callsign} · CUTTING ROCK ${job.rock.id}`, L.x, L.y, f.ships[0].color, { followId: f.id });
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

    return {
      update(dt) {
        const v = api.view();
        for (const r of rocks) {
          r.x += r.vx * dt;
          r.y += r.vy * dt;
        }
        for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].x < v.left - 300) rocks.splice(i, 1);
        if (v.right + 100 > nextBelt) {
          belt(nextBelt);
          nextBelt += 500 + api.rng() * 900;
        }

        while (jobs.filter((j) => j.fleet.mode !== 'gone').length < Number(p.miners ?? 3) && rocks.some((r) => r.ore > 0 && api.onScreen(r.x, r.y, 0))) hire();

        for (let i = jobs.length - 1; i >= 0; i--) {
          const j = jobs[i];
          const f = j.fleet;
          if (f.mode === 'gone' || !f.ships.length) {
            jobs.splice(i, 1);
            continue;
          }
          const r = j.rock;
          const L = f.ships[0];
          if (!r || !rocks.includes(r) || Math.hypot(r.x - L.x, r.y - L.y) > 34) continue;
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
            // The rock cracks into smaller pieces.
            const idx = rocks.indexOf(r);
            rocks.splice(idx, 1);
            api.fx.sparks(r.x, r.y, rockColor, 14, 50);
            api.fx.ring(r.x, r.y, oreColor, 26, 0.6, 2, 1);
            if (r.r > 1) {
              for (let k = 0; k < 2 + Math.floor(api.rng() * 2); k++) {
                const a = api.rng() * Math.PI * 2;
                rocks.push({ id: id++, x: r.x, y: r.y, r: r.r - 1, ore: r.ore * 0.5, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, phase: api.rng() * 10, hp: (r.r - 1) * 2.5 });
              }
              api.say(`ROCK ${r.id} SPLIT`, r.x, r.y + 14, oreColor, { duration: 2600 });
            }
            j.hold += 1;
            j.rock = null;
            if (j.hold >= 2 + Math.floor(api.rng() * 2)) {
              api.say(`${f.callsign} · HOLD FULL · RETURNING`, L.x, L.y, L.color, { priority: 'medium', followId: f.id });
              api.release(f);
              jobs.splice(i, 1);
            }
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
      draw(ctx, pass, frame, board) {
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
            ctx.fillStyle = hexRgba(lit > 0 ? oreColor : rockColor, lit > 0 ? 0.55 + 0.35 * lit : 0.55);
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
        }
        void board;
      },
    };
  },
});
