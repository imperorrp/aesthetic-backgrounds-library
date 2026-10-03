/**
 * The Long Siege's set pieces, on top of the war state in war.ts (`useWar`):
 *
 *   artillery  a spotter flies out and paints a target with a dotted designator line;
 *              seconds later the volley arcs in. Shields ripple and strain. Kill the
 *              spotter first and the volley never comes.
 *   duels      two siege monitors face each other across the line and trade beam
 *              broadsides: shields ripple and fail, armor plates break away, and one
 *              of them may not leave.
 *   truces     the guns stop. White-marked medical ships cross no-man's-land from both
 *              sides, and the memorial beacon counts the names.
 *   mines      fields of mines along the line and around old hazards. A ship that strays
 *              in sets one off; the blast sets off the next, in a chain across the field.
 *
 * Each spends from its side's reserve, so a side that has been fighting hard has less
 * to spend on the next thing.
 */
import type { Fleet, Ship } from '../types';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { useWar, type Shield, type War } from './war';
import { registerMechanic, steerToward, type MechanicApi } from './types';

type P = { x: number; y: number };

/** Main-plane targets of one side that the other could shell: systems, then working structures. */
function targetsOf(api: MechanicApi, war: War, side: number): (P & { label: string })[] {
  const out: (P & { label: string })[] = [];
  for (const s of api.world.systems) if (!s.z && api.onScreen(s.x, s.y, -60) && war.ownerAt(s.x, s.y) === side) out.push({ x: s.x, y: s.y, label: s.name });
  for (const st of api.structures()) {
    if (st.z || !api.onScreen(st.x, st.y, -60) || war.ownerAt(st.x, st.y) !== side) continue;
    if (st.role === 'defense' || st.role === 'dock' || st.role === 'shipyard' || st.role === 'mine' || st.role === 'relay') out.push({ x: st.x, y: st.y, label: st.label });
  }
  return out;
}

// ---- artillery ------------------------------------------------------------------------------

registerMechanic({
  id: 'artillery',
  label: 'Spotted artillery',
  description: 'A spotter paints a target with a designator line, then the volley arcs in. Shields ripple and strain; kill the spotter and the volley never comes.',
  schema: {
    rate: { type: 'number', min: 0.2, max: 4, default: 1.2, label: 'Volleys per minute' },
    paint: { type: 'number', min: 1, max: 6, default: 3, label: 'Seconds spent painting' },
    shells: { type: 'number', min: 2, max: 10, default: 6, step: 1, label: 'Shells per volley' },
  },
  create(api, p) {
    const war = useWar(api);
    const rate = Number(p.rate) || 1.2;
    const paint = Number(p.paint) || 3;
    type Strike = { side: 0 | 1; spotter: Fleet; target: P & { label: string }; stand: P; phase: 'out' | 'paint' | 'home'; fireAt: number; paintedAt: number };
    const strikes: Strike[] = [];
    let next = api.t + 8 + api.rng() * 6;

    const begin = () => {
      // The side with more to spend calls it in.
      const s: 0 | 1 = war.sides[0].reserve >= war.sides[1].reserve ? 0 : 1;
      const me = war.sides[s];
      if (me.reserve < 10) return;
      // Prefer targets close to the line: that is what the guns can reach.
      const pool = targetsOf(api, war, 1 - s).filter((t) => Math.abs(t.y - war.lineAt(t.x)) < 260);
      if (!pool.length) return;
      const target = pool[Math.floor(api.rng() * pool.length)];
      me.reserve -= 10;
      // The spotter stands off on its own side of the line, clear of the enemy's mines.
      const toward = s === 0 ? -1 : 1;
      const sx = target.x + (api.rng() - 0.5) * 90;
      const behind = war.lineAt(sx) + toward * (60 + api.rng() * 30);
      const near = target.y + toward * (130 + api.rng() * 40);
      const stand = { x: sx, y: Math.max(24, Math.min(api.height - 24, s === 0 ? Math.min(behind, near) : Math.max(behind, near))) };
      const sp = SHIP_SPECS.scout.speed;
      const st: Strike = { side: s, spotter: null as unknown as Fleet, target, stand, phase: 'out', fireAt: 0, paintedAt: 0 };
      st.spotter = api.spawnFleet(
        { x: stand.x + (api.rng() - 0.5) * 120, y: war.rearY(s), vx: 0, vy: -toward * 40 },
        {
          cls: 'scout',
          faction: s,
          color: me.color,
          tag: 'spotter',
          steer: (f, dt) => {
            const L = f.ships[0];
            if (st.phase === 'home') steerToward(L, L.x, war.rearY(s) + toward * 40, sp, 1.4, dt);
            else steerToward(L, st.stand.x, st.stand.y, sp, 1.6, dt, 40);
          },
        },
      );
      war.enlist(st.spotter, s);
      strikes.push(st);
    };

    /** The volley: shells arc in from a friendly fire base near the target, or from the rear. */
    const volley = (st: Strike) => {
      const color = war.sides[st.side].color;
      const base = api
        .structures()
        .filter((b) => !b.z && b.role === 'defense' && war.ownerAt(b.x, b.y) === st.side && Math.hypot(b.x - st.target.x, b.y - st.target.y) < 520)
        .sort((a, b) => Math.hypot(a.x - st.target.x, a.y - st.target.y) - Math.hypot(b.x - st.target.x, b.y - st.target.y))[0];
      const from = base ?? { x: st.target.x + (api.rng() - 0.5) * 300, y: st.side === 0 ? -10 : api.height + 10 };
      const shield = war.shieldAt(st.target.x, st.target.y);
      const n = Math.round(Number(p.shells) || 6);
      for (let i = 0; i < n; i++) {
        // Aim: the shield's rim facing the guns, or the target itself, give or take.
        let aim: P;
        if (shield) {
          const a = Math.atan2(from.y - shield.y, from.x - shield.x) + (api.rng() - 0.5) * 0.9;
          aim = { x: shield.x + Math.cos(a) * shield.r, y: shield.y + Math.sin(a) * shield.r };
        } else aim = { x: st.target.x + (api.rng() - 0.5) * 50, y: st.target.y + (api.rng() - 0.5) * 50 };
        // Fire away from the target first, so the shells arc over rather than fly straight.
        const sideways = (api.rng() - 0.5) * 120;
        const away = st.side === 0 ? -1 : 1;
        api.fx.missile(from.x + (api.rng() - 0.5) * 10, from.y, sideways, away * (30 + api.rng() * 50), () => aim, color, (x, y) => land(st, shield, from, x, y), 150 + api.rng() * 50);
      }
      api.say(`VOLLEY · ${st.target.label}`, st.target.x, st.target.y - 30, color, { priority: 'high' });
      api.emit({ type: 'bombard', x: st.target.x, y: st.target.y, weight: 0.65, color, side: st.side });
    };

    /** A shell comes down: on a shield, it ripples; otherwise it hurts what is there. */
    const land = (st: Strike, shield: Shield | undefined, from: P, x: number, y: number) => {
      const color = war.sides[st.side].color;
      if (shield && api.t >= shield.downUntil) {
        war.hitShield(shield, from.x, from.y, 0.09);
        api.fx.sparks(x, y, '#ffffff', 5, 40);
        return;
      }
      api.fx.explode(x, y, color, 0.6);
      api.emit({ type: 'blast', x, y, r: 26, weight: 0.1 });
      const cell = war.cellAt(x, y);
      if (cell.owner === 1 - st.side) cell.hold = Math.max(0.02, cell.hold - 0.05);
      for (const c of war.combatants()) {
        if (c.side === st.side) continue;
        for (const s of c.f.ships) if (Math.hypot(s.x - x, s.y - y) < 26) api.damage(c.f, s, 2);
      }
    };

    return {
      update() {
        if (api.t >= next) {
          if (!war.inTruce() && strikes.length < 2) begin();
          next = api.t + (60 / rate) * (0.6 + api.rng() * 0.8);
        }
        for (let i = strikes.length - 1; i >= 0; i--) {
          const st = strikes[i];
          const L = st.spotter.ships[0];
          if (!L || st.spotter.mode === 'gone') {
            if (!L && st.phase !== 'home') api.say(`SPOTTER LOST · VOLLEY CALLED OFF`, st.stand.x, st.stand.y, war.sides[st.side].color, { priority: 'medium' });
            strikes.splice(i, 1);
            continue;
          }
          if (st.phase === 'home') {
            if (L.y < -40 || L.y > api.height + 40) st.spotter.mode = 'gone';
            continue;
          }
          if (war.inTruce()) {
            st.phase = 'home';
            continue;
          }
          if (st.phase === 'out' && Math.hypot(L.x - st.stand.x, L.y - st.stand.y) < 22) {
            st.phase = 'paint';
            st.paintedAt = api.t;
            st.fireAt = api.t + paint;
            api.say(`${war.sides[st.side].short} SPOTTER · TARGET PAINTED · ${st.target.label}`, L.x, L.y, war.sides[st.side].color, { priority: 'medium', followId: st.spotter.id });
            api.emit({ type: 'spot', x: st.target.x, y: st.target.y, weight: 0.45, side: st.side });
          }
          if (st.phase === 'paint' && api.t >= st.fireAt) {
            volley(st);
            st.phase = 'home';
          }
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'over') return;
        ctx.save();
        for (const st of strikes) {
          const L = st.spotter.ships[0];
          if (!L || st.phase !== 'paint') continue;
          const color = war.sides[st.side].color;
          const k = Math.min(1, (frame.time - st.paintedAt) / paint);
          const lx = api.screenX(L.x);
          const tx = api.screenX(st.target.x);
          // The designator: a faint beam and dots running down it to the target.
          ctx.strokeStyle = hexRgba(color, 0.18);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx, L.y);
          ctx.lineTo(tx, st.target.y);
          ctx.stroke();
          ctx.strokeStyle = hexRgba(color, 0.85);
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 6]);
          ctx.lineDashOffset = -frame.time * 40;
          ctx.stroke();
          ctx.setLineDash([]);
          // The reticle: brackets closing in as the solution firms up.
          const r = 30 - 16 * k;
          const arm = 6;
          ctx.strokeStyle = hexRgba(color, 0.6 + 0.4 * Math.sin(frame.time * 12) ** 2);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const cx = tx + sx * r;
            const cy = st.target.y + sy * r;
            ctx.moveTo(cx, cy - sy * arm);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx - sx * arm, cy);
          }
          ctx.stroke();
          ctx.fillStyle = hexRgba(color, 0.9);
          ctx.fillRect(tx - 1, st.target.y - 1, 2, 2);
        }
        ctx.restore();
      },
    };
  },
});

// ---- monitor duels --------------------------------------------------------------------------

type Plate = { x: number; y: number; vx: number; vy: number; ang: number; spin: number; w: number; h: number; life: number; max: number; color: string };

registerMechanic({
  id: 'duels',
  label: 'Monitor duels',
  description: 'Two siege monitors face each other across the line and trade beam broadsides. Shields ripple and fail, armor plates break away, and one of them may not leave.',
  schema: {
    every: { type: 'number', min: 0.5, max: 6, default: 1.6, label: 'Minutes between duels' },
    plates: { type: 'boolean', default: true, label: 'Armor breaks away' },
  },
  create(api, p) {
    const war = useWar(api);
    const every = Number(p.every) || 1.6;
    /** `aim` is the chance a beam lands; `reload` is when its next broadside is ready. */
    type Monitor = { f: Fleet; side: 0 | 1; hold: P; shield: Shield; aim: number; reload: number };
    type Duel = { a: Monitor; b: Monitor; phase: 'approach' | 'fight' | 'part'; until: number; shots: { at: number; from: Monitor; to: Monitor; dx: number }[] };
    let duel: Duel | null = null;
    let next = api.t + 30 + api.rng() * 20;
    const plates: Plate[] = [];

    const hull = (m: Monitor): Ship | undefined => m.f.ships.find((s) => s.cls === 'capital');

    const monitor = (s: 0 | 1, hold: P): Monitor => {
      const sp = SHIP_SPECS.capital.speed * 1.2;
      const m: Monitor = { f: null as unknown as Fleet, side: s, hold, shield: null as unknown as Shield, aim: 0.68 + api.rng() * 0.24, reload: 0 };
      m.f = api.spawnFleet(
        { x: hold.x + (api.rng() - 0.5) * 80, y: war.rearY(s), vx: 0, vy: s === 0 ? 30 : -30 },
        {
          cls: 'capital',
          wings: ['fighter', 'fighter'],
          faction: s,
          color: war.sides[s].color,
          tag: 'monitor',
          steer: (f, dt) => {
            const L = f.ships[0];
            if (duel?.phase === 'part' || !duel) steerToward(L, L.x, war.rearY(s) + (s === 0 ? -50 : 50), sp, 0.8, dt);
            else steerToward(L, m.hold.x, m.hold.y, sp, 0.9, dt, 60);
          },
        },
      );
      m.shield = war.addShield({ id: `monitor-${m.f.id}`, label: m.f.callsign, r: 30, owner: s, at: () => hull(m) ?? null });
      war.enlist(m.f, s);
      return m;
    };

    const begin = () => {
      if (war.sides[0].reserve < 30 || war.sides[1].reserve < 30) return;
      war.sides[0].reserve -= 30;
      war.sides[1].reserve -= 30;
      const x = api.view().left + api.width * (0.3 + api.rng() * 0.4);
      const line = Math.max(150, Math.min(api.height - 150, war.lineAt(x)));
      const gap = Math.min(130, api.height * 0.2);
      duel = {
        a: monitor(0, { x: x - 30, y: line - gap }),
        b: monitor(1, { x: x + 30, y: line + gap }),
        phase: 'approach',
        until: api.t + 85,
        shots: [],
      };
    };

    /** One beam from a gun position along the shooter's hull to the other monitor. */
    const shoot = (from: Monitor, to: Monitor, dx: number) => {
      const a = hull(from);
      const b = hull(to);
      if (!a || !b) return;
      const color = war.sides[from.side].color;
      const miss = api.rng() > from.aim;
      const up = api.t < to.shield.downUntil ? null : to.shield;
      let end: () => P | null;
      if (miss) {
        const ox = (api.rng() - 0.5) * 120;
        const oy = (b.y - a.y) * 0.4;
        end = () => ({ x: b.x + ox, y: b.y + oy });
      } else if (up) {
        const rim = war.hitShield(up, a.x + dx, a.y, 0.1);
        const rx = rim.x - b.x;
        const ry = rim.y - b.y;
        end = () => (to.f.ships.includes(b) ? { x: b.x + rx, y: b.y + ry } : null);
      } else {
        end = () => (to.f.ships.includes(b) ? { x: b.x, y: b.y } : null);
        // Armor: plates break away, sparks fly, the hull takes it.
        api.fx.sparks(b.x, b.y, '#fff7d6', 6, 60);
        if (p.plates !== false) {
          for (let i = 0; i < 2; i++) {
            const ang = Math.atan2(b.y - a.y, b.x - a.x) + (api.rng() - 0.5) * 1.6;
            const v = 10 + api.rng() * 22;
            plates.push({ x: b.x + (api.rng() - 0.5) * 10, y: b.y + (api.rng() - 0.5) * 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, ang: api.rng() * 6, spin: (api.rng() - 0.5) * 3, w: 4 + api.rng() * 4, h: 2 + api.rng() * 1.5, life: 0, max: 7 + api.rng() * 5, color: b.color });
          }
          if (plates.length > 60) plates.splice(0, plates.length - 60);
        }
        const killed = b.hp <= 1;
        api.damage(to.f, b, 1);
        if (killed) {
          api.say(`${to.f.callsign} IS BREAKING UP`, b.x, b.y - 26, war.sides[to.side].color, { priority: 'high', duration: 5000 });
          for (let i = 0; i < 4; i++) api.fx.explode(b.x + (api.rng() - 0.5) * 40, b.y + (api.rng() - 0.5) * 20, '#fdba74', 0.9);
          api.emit({ type: 'monitor-lost', x: b.x, y: b.y, weight: 0.9, color: war.sides[to.side].color });
        }
      }
      api.fx.beam(() => (from.f.ships.includes(a) ? { x: a.x + dx, y: a.y } : null), end, color, 0.5, 2.2);
    };

    return {
      update(dt) {
        for (let i = plates.length - 1; i >= 0; i--) {
          const pl = plates[i];
          pl.life += dt;
          if (pl.life > pl.max) {
            plates.splice(i, 1);
            continue;
          }
          pl.x += pl.vx * dt;
          pl.y += pl.vy * dt;
          pl.vx *= 1 - dt * 0.15;
          pl.vy *= 1 - dt * 0.15;
          pl.ang += pl.spin * dt;
        }
        if (!duel) {
          if (api.t >= next && !war.inTruce()) {
            begin();
            next = api.t + every * 60 * (0.7 + api.rng() * 0.6);
          }
          return;
        }
        const d = duel;
        const A = hull(d.a);
        const B = hull(d.b);
        // Steaming slowly along the line together.
        d.a.hold.x += dt * 5;
        d.b.hold.x += dt * 5;
        if (d.phase !== 'part' && (!A || !B || api.t > d.until || war.inTruce())) {
          d.phase = 'part';
          d.until = api.t + 20;
          if (A && B) api.say('THE MONITORS DISENGAGE', (A.x + B.x) / 2, (A.y + B.y) / 2, api.host.palette.ink, { priority: 'medium' });
          else {
            const w = A ? d.a : d.b;
            const ws = hull(w);
            if (ws) api.say(`${w.f.callsign} HOLDS THE FIELD`, ws.x, ws.y + 24, war.sides[w.side].color, { priority: 'medium' });
          }
        }
        if (d.phase === 'approach' && A && B && Math.hypot(A.x - d.a.hold.x, A.y - d.a.hold.y) < 30 && Math.hypot(B.x - d.b.hold.x, B.y - d.b.hold.y) < 30) {
          d.phase = 'fight';
          d.a.reload = api.t + 0.8 + api.rng() * 2;
          d.b.reload = api.t + 0.8 + api.rng() * 2;
          api.say(`MONITOR DUEL · ${d.a.f.callsign} / ${d.b.f.callsign}`, (A.x + B.x) / 2 + 60, (A.y + B.y) / 2, api.host.palette.ink, { priority: 'high', duration: 5000 });
          api.emit({
            type: 'duel',
            x: (A.x + B.x) / 2,
            y: (A.y + B.y) / 2,
            weight: 0.85,
            follow: () => {
              const a = hull(d.a);
              const b = hull(d.b);
              return a && b && duel === d && d.phase === 'fight' ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
            },
          });
        }
        if (d.phase === 'fight') {
          // Broadsides: four guns along the hull, fired in a ripple, whenever each ship has reloaded.
          for (const [from, to] of [[d.a, d.b], [d.b, d.a]] as const) {
            if (api.t < from.reload) continue;
            for (let g = 0; g < 4; g++) d.shots.push({ at: api.t + g * 0.14, from, to, dx: -14 + g * 9 });
            from.reload = api.t + 3.8 + api.rng() * 1.4;
          }
        }
        for (let i = d.shots.length - 1; i >= 0; i--) {
          if (api.t < d.shots[i].at) continue;
          const s = d.shots[i];
          d.shots.splice(i, 1);
          if (d.phase === 'fight') shoot(s.from, s.to, s.dx);
        }
        if (d.phase === 'part') {
          const gone = (m: Monitor) => m.f.mode === 'gone' || !m.f.ships.length;
          for (const m of [d.a, d.b]) {
            const L = m.f.ships[0];
            if (L && (L.y < -50 || L.y > api.height + 50)) m.f.mode = 'gone';
          }
          if ((gone(d.a) && gone(d.b)) || api.t > d.until) {
            for (const m of [d.a, d.b]) if (!gone(m)) m.f.mode = 'gone';
            duel = null;
          }
        }
      },
      draw(ctx, pass) {
        if (pass !== 'over' || !plates.length) return;
        ctx.save();
        ctx.lineWidth = 1;
        for (const pl of plates) {
          const a = 1 - pl.life / pl.max;
          ctx.save();
          ctx.translate(api.screenX(pl.x), pl.y);
          ctx.rotate(pl.ang);
          ctx.fillStyle = hexRgba(pl.color, 0.25 * a);
          ctx.strokeStyle = hexRgba(pl.color, 0.85 * a);
          ctx.fillRect(-pl.w / 2, -pl.h / 2, pl.w, pl.h);
          ctx.strokeRect(-pl.w / 2, -pl.h / 2, pl.w, pl.h);
          ctx.restore();
        }
        ctx.restore();
      },
    };
  },
});

// ---- truces ---------------------------------------------------------------------------------

const BEACON_ART = ['   |   ', '  -+-  ', '   |   ', '  /_\\  '];
const MEDIC = '#f8fafc';

registerMechanic({
  id: 'truces',
  label: 'Truces',
  description: "Now and then the guns stop. White-marked medical ships cross no-man's-land from both sides, and the memorial beacon counts the names.",
  schema: {
    every: { type: 'number', min: 1, max: 10, default: 3.5, label: 'Minutes between truces' },
    length: { type: 'number', min: 10, max: 90, default: 32, label: 'Seconds a truce lasts' },
  },
  create(api, p) {
    const war = useWar(api);
    const every = Number(p.every) || 3.5;
    const length = Number(p.length) || 32;
    type Medic = { f: Fleet; side: 0 | 1; to: P; phase: 'out' | 'work' | 'home'; until: number };
    const medics: Medic[] = [];
    let next = api.t + 70 + api.rng() * 40;
    let beacon: { x: number; y: number } | null = null;
    let shown = war.names;
    let endedAt = -100;

    const findBeacon = () =>
      api.structures().find((s) => !s.z && (s.kind === 'memorial_beacon' || /MEMORIAL/.test(s.label)) && api.onScreen(s.x, s.y, -80));

    const begin = () => {
      war.truceUntil = api.t + length;
      const x = api.view().left + api.width * (0.35 + api.rng() * 0.3);
      let b = findBeacon();
      if (!b) {
        const def = api.pack.structures.find((s) => s.kind === 'memorial_beacon');
        b = api.addStructure({ x, y: war.lineAt(x), label: def?.label ?? 'MEMORIAL BEACON', role: 'mystery', art: def?.art ?? BEACON_ART, color: def?.color ?? '#fef3c7', kind: 'memorial_beacon' });
      }
      beacon = b;
      shown = war.names;
      api.say('TRUCE · THE GUNS FALL SILENT', b.x, b.y - 40, MEDIC, { priority: 'high', duration: 6000 });
      api.emit({ type: 'truce', x: b.x, y: b.y, weight: 0.75, color: MEDIC });
      // Medical tenders from both sides, to points along the line near the beacon.
      for (const s of [0, 1] as const) {
        for (let i = 0; i < 2; i++) {
          const mx = b.x + (api.rng() - 0.5) * 520;
          const to = { x: mx, y: war.lineAt(mx) + (api.rng() - 0.5) * 30 };
          const sp = SHIP_SPECS.freighter.speed * 1.1;
          const m: Medic = { f: null as unknown as Fleet, side: s, to, phase: 'out', until: 0 };
          m.f = api.spawnFleet(
            { x: mx + (api.rng() - 0.5) * 100, y: war.rearY(s), vx: 0, vy: s === 0 ? 30 : -30 },
            {
              cls: 'freighter',
              faction: s,
              color: MEDIC,
              tag: 'medical',
              callsign: `MED-${100 + Math.floor(api.rng() * 900)}`,
              steer: (f, dt) => {
                const L = f.ships[0];
                if (m.phase === 'home') steerToward(L, L.x, war.rearY(s) + (s === 0 ? -40 : 40), sp, 1.2, dt);
                else steerToward(L, m.to.x + (m.phase === 'work' ? Math.sin(api.t * 0.8 + i) * 12 : 0), m.to.y, sp, 1.4, dt, 40);
              },
            },
          );
          medics.push(m);
        }
      }
    };

    return {
      update(dt) {
        if (!war.inTruce() && api.t >= next) {
          begin();
          next = api.t + length + every * 60 * (0.7 + api.rng() * 0.6);
        }
        const truce = war.inTruce();
        if (beacon && !truce && endedAt < war.truceUntil) {
          endedAt = api.t;
          api.say('TRUCE EXPIRES · WEAPONS FREE', beacon.x, beacon.y - 40, api.host.palette.ink, { priority: 'high' });
          api.emit({ type: 'truce-end', x: beacon.x, y: beacon.y, weight: 0.5 });
        }
        // The beacon's count catches up with the names, a few at a time.
        shown = Math.min(war.names, shown + Math.max(1, (war.names - shown) * dt * 0.8));
        for (let i = medics.length - 1; i >= 0; i--) {
          const m = medics[i];
          const L = m.f.ships[0];
          if (!L || m.f.mode === 'gone') {
            medics.splice(i, 1);
            continue;
          }
          if (m.phase === 'out' && Math.hypot(L.x - m.to.x, L.y - m.to.y) < 24) {
            m.phase = 'work';
            m.until = api.t + 6 + api.rng() * 4;
            api.say(`${m.f.callsign} · RECOVERING`, L.x, L.y, MEDIC, { priority: 'low' });
          }
          if (m.phase === 'work' && api.t >= m.until) {
            m.phase = 'home';
            war.names += 20 + Math.floor(api.rng() * 140);
          }
          if (m.phase !== 'home' && !truce) m.phase = 'home';
          if (m.phase === 'home' && (L.y < -40 || L.y > api.height + 40)) m.f.mode = 'gone';
        }
      },
      draw(ctx, pass, frame) {
        if (pass === 'over') {
          // Medical markings: a white cross over each tender, and a soft ring.
          ctx.save();
          ctx.lineWidth = 1.5;
          for (const m of medics) {
            const L = m.f.ships[0];
            if (!L) continue;
            const x = api.screenX(L.x);
            ctx.strokeStyle = hexRgba(MEDIC, 0.95);
            ctx.beginPath();
            ctx.moveTo(x - 4, L.y - 14);
            ctx.lineTo(x + 4, L.y - 14);
            ctx.moveTo(x, L.y - 18);
            ctx.lineTo(x, L.y - 10);
            ctx.stroke();
            ctx.strokeStyle = hexRgba(MEDIC, 0.25 + (m.phase === 'work' ? 0.2 * Math.sin(frame.time * 4) : 0));
            ctx.beginPath();
            ctx.arc(x, L.y, 12, 0, Math.PI * 2);
            ctx.stroke();
          }
          // The beacon burns brighter while the truce holds, and shows the names.
          const lit = war.inTruce() ? 1 : Math.max(0, 1 - (frame.time - endedAt) / 6);
          if (beacon && lit > 0) {
            const x = api.screenX(beacon.x);
            const g = ctx.createRadialGradient(x, beacon.y, 0, x, beacon.y, 70);
            g.addColorStop(0, hexRgba('#fef3c7', 0.28 * lit * (0.8 + 0.2 * Math.sin(frame.time * 2))));
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 70, beacon.y - 70, 140, 140);
            ctx.font = '10px "Orbit", "Syne Mono", ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = hexRgba('#fef3c7', 0.9 * lit);
            ctx.fillText(`NAMES · ${Math.floor(shown).toLocaleString('en-US')}`, Math.round(x), Math.round(beacon.y + 30));
          }
          ctx.restore();
        } else if (pass === 'hud' && war.inTruce()) {
          // Countdown, top center.
          const left = Math.max(0, war.truceUntil - frame.time);
          const text = `TRUCE · ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
          ctx.save();
          ctx.font = '10px "Orbit", "Syne Mono", ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          const w = ctx.measureText(text).width;
          ctx.fillStyle = hexRgba(api.host.palette.bg, 0.75);
          ctx.fillRect(api.width / 2 - w / 2 - 6, 10, w + 12, 16);
          ctx.fillStyle = hexRgba(MEDIC, 0.9);
          ctx.fillText(text, api.width / 2, 22);
          ctx.restore();
        }
      },
    };
  },
});

// ---- mines ----------------------------------------------------------------------------------

type Mine = { x: number; y: number; live: boolean; fuse: number; phase: number };
type Field = { mines: Mine[]; side: number; color: string; left: number; right: number; top: number; bottom: number; chain: number; doneAt: number };

registerMechanic({
  id: 'mines',
  label: 'Live minefields',
  description: 'Fields of mines along the line and around old hazards. A ship that strays in sets one off, and each blast can set off the next, in a chain across the field.',
  schema: {
    layers: { type: 'boolean', default: true, label: 'Minelayers sow new fields' },
    chain: { type: 'number', min: 0, max: 1, default: 0.85, label: 'Chance a blast sets off a neighbor' },
  },
  create(api, p) {
    const war = useWar(api);
    const chance = Number(p.chain ?? 0.85);
    const fields: Field[] = [];
    const seeded = new Set<string>();
    type Layer = { f: Fleet; side: 0 | 1; field: Field; from: P; to: P; phase: 'out' | 'lay' | 'home'; nextDrop: number };
    const layers: Layer[] = [];
    let nextLayer = api.t + 25 + api.rng() * 20;
    let nextScan = 0;

    const field = (side: number, color: string): Field => {
      const f: Field = { mines: [], side, color, left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, chain: 0, doneAt: -1 };
      fields.push(f);
      return f;
    };
    const drop = (f: Field, x: number, y: number) => {
      f.mines.push({ x, y, live: true, fuse: -1, phase: api.rng() * 6 });
      f.left = Math.min(f.left, x - 30);
      f.right = Math.max(f.right, x + 30);
      f.top = Math.min(f.top, y - 30);
      f.bottom = Math.max(f.bottom, y + 30);
    };
    /** A strip along the line, a little inside a side's own ground. */
    const strip = (side: number, x0: number, n: number) => {
      const f = field(side, war.sides[side]?.color ?? '#f97316');
      for (let i = 0; i < n; i++) {
        const x = x0 + i * 15 + (api.rng() - 0.5) * 6;
        drop(f, x, war.lineAt(x) + (side === 0 ? -1 : 1) * (14 + api.rng() * 18) + (api.rng() - 0.5) * 8);
      }
      return f;
    };

    /** Set off a mine: blast, hurt what is close, and maybe light the fuses of its neighbors. */
    const detonate = (f: Field, m: Mine) => {
      m.live = false;
      f.chain++;
      api.fx.explode(m.x, m.y, '#f97316', 0.5);
      api.fx.ring(m.x, m.y, '#fdba74', 22, 0.6, 2, 1);
      for (const fl of api.world.fleets) {
        if (fl.z > 0.15 || fl.tag === 'medical') continue;
        for (const s of fl.ships) if (Math.hypot(s.x - m.x, s.y - m.y) < 22) api.damage(fl, s, 2);
      }
      for (const n of f.mines) if (n.live && n.fuse < 0 && Math.hypot(n.x - m.x, n.y - m.y) < 32 && api.rng() < chance) n.fuse = 0.1 + api.rng() * 0.14;
      if (f.chain === 4) {
        api.say(`CHAIN DETONATION · ${f.side >= 0 ? `${war.sides[f.side].short} FIELD` : 'OLD FIELD'}`, m.x, m.y - 20, '#f97316', { priority: 'high' });
        api.emit({ type: 'mines', x: m.x, y: m.y, weight: 0.65, color: '#f97316' });
      }
    };
    /** Anything that blows up near a field can set it off. */
    const shock = (x: number, y: number, r: number) => {
      for (const f of fields) {
        if (x < f.left || x > f.right || y < f.top || y > f.bottom) continue;
        for (const m of f.mines) if (m.live && m.fuse < 0 && Math.hypot(m.x - x, m.y - y) < r) m.fuse = 0.05 + api.rng() * 0.1;
      }
    };
    api.bus.on('explosion', (e) => {
      if (typeof e.x === 'number' && typeof e.y === 'number' && !e.z) shock(e.x, e.y, 28);
    });
    api.bus.on('blast', (e) => {
      if (typeof e.x === 'number' && typeof e.y === 'number') shock(e.x, e.y, typeof e.r === 'number' ? e.r : 24);
    });

    // A few fields are already down when we arrive.
    {
      const v = api.view();
      strip(0, v.left + api.width * (0.05 + api.rng() * 0.15), 14 + Math.floor(api.rng() * 8));
      strip(1, v.left + api.width * (0.38 + api.rng() * 0.15), 14 + Math.floor(api.rng() * 8));
      strip(api.rng() < 0.5 ? 0 : 1, v.left + api.width * (0.7 + api.rng() * 0.15), 14 + Math.floor(api.rng() * 8));
    }

    const sendLayer = () => {
      // One minelayer per side at a time.
      const s: 0 | 1 = layers.some((L) => L.side === 0) ? 1 : layers.some((L) => L.side === 1) ? 0 : api.rng() < 0.5 ? 0 : 1;
      const me = war.sides[s];
      if (me.reserve < 12 || layers.some((L) => L.side === s)) return;
      me.reserve -= 12;
      const x0 = api.view().left + api.width * (0.2 + api.rng() * 0.5);
      const off = (s === 0 ? -1 : 1) * 22;
      const from = { x: x0, y: war.lineAt(x0) + off };
      const to = { x: x0 + 320, y: war.lineAt(x0 + 320) + off };
      const sp = SHIP_SPECS.freighter.speed;
      const L: Layer = { f: null as unknown as Fleet, side: s, field: field(s, me.color), from, to, phase: 'out', nextDrop: 0 };
      L.f = api.spawnFleet(
        { x: x0 - 40, y: war.rearY(s), vx: 0, vy: s === 0 ? 30 : -30 },
        {
          cls: 'freighter',
          faction: s,
          color: me.color,
          tag: 'minelayer',
          steer: (f, dt) => {
            const lead = f.ships[0];
            if (L.phase === 'home') steerToward(lead, lead.x, war.rearY(s) + (s === 0 ? -40 : 40), sp, 1.2, dt);
            else if (L.phase === 'out') steerToward(lead, L.from.x, L.from.y, sp, 1.4, dt, 30);
            else {
              // Follow the line while sowing.
              const tx = lead.x + 30;
              steerToward(lead, tx, war.lineAt(tx) + off, sp * 0.6, 1.2, dt);
            }
          },
        },
      );
      war.enlist(L.f, s);
      layers.push(L);
      api.say(`${me.short} MINELAYER · SOWING THE LINE`, from.x, from.y, me.color, { priority: 'low', followId: L.f.id });
    };

    return {
      update(dt) {
        const v = api.view();
        // Old hazards carry old fields.
        if (api.t >= nextScan) {
          nextScan = api.t + 1;
          for (const st of api.structures()) {
            if (st.z || seeded.has(st.id) || !(st.kind === 'minefield' || (st.role === 'hazard' && /MINE/.test(st.label))) || !api.onScreen(st.x, st.y, 100)) continue;
            seeded.add(st.id);
            const f = field(-1, st.color ?? '#f97316');
            for (let i = 0; i < 26; i++) {
              const a = api.rng() * Math.PI * 2;
              const r = 18 + Math.sqrt(api.rng()) * 58;
              drop(f, st.x + Math.cos(a) * r, st.y + Math.sin(a) * r * 0.75);
            }
          }
        }
        if (p.layers !== false && api.t >= nextLayer) {
          if (!war.inTruce() && layers.length < 2) sendLayer();
          nextLayer = api.t + 25 + api.rng() * 20;
        }
        for (let i = layers.length - 1; i >= 0; i--) {
          const L = layers[i];
          const lead = L.f.ships[0];
          if (!lead || L.f.mode === 'gone') {
            layers.splice(i, 1);
            continue;
          }
          if (L.phase === 'out' && Math.hypot(lead.x - L.from.x, lead.y - L.from.y) < 24) L.phase = 'lay';
          if (L.phase === 'lay') {
            if (api.t >= L.nextDrop) {
              drop(L.field, lead.x + (api.rng() - 0.5) * 8, lead.y + (api.rng() - 0.5) * 10);
              L.nextDrop = api.t + 0.45;
            }
            if (lead.x >= L.to.x || war.inTruce()) L.phase = 'home';
          }
          if (L.phase === 'home' && (lead.y < -40 || lead.y > api.height + 40)) L.f.mode = 'gone';
        }
        // Triggers: a ship over a live mine (a side's own ships know its safe lanes).
        for (const f of fields) {
          if (f.right < v.left - 40) continue;
          for (const fl of api.world.fleets) {
            if (fl.z > 0.15 || fl.tag === 'medical' || fl.faction === f.side) continue;
            for (const s of fl.ships) {
              if (s.x < f.left || s.x > f.right || s.y < f.top || s.y > f.bottom) continue;
              for (const m of f.mines) if (m.live && m.fuse < 0 && Math.hypot(m.x - s.x, m.y - s.y) < 14) m.fuse = 0;
            }
          }
          for (const m of f.mines) {
            if (!m.live || m.fuse < 0) continue;
            m.fuse -= dt;
            if (m.fuse <= 0) detonate(f, m);
          }
          if (!f.mines.some((m) => m.fuse >= 0)) f.chain = 0;
        }
        // Forget fields that have scrolled away or are spent.
        for (let i = fields.length - 1; i >= 0; i--) {
          const f = fields[i];
          const spent = f.mines.length > 0 && !f.mines.some((m) => m.live);
          const sowing = layers.some((L) => L.field === f);
          if (f.right < v.left - 100 || (spent && !sowing) || (!f.mines.length && !sowing)) fields.splice(i, 1);
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'mid') return;
        ctx.save();
        ctx.lineWidth = 1;
        for (const f of fields) {
          const ox = api.screenX(0);
          if (f.right + ox < -20 || f.left + ox > api.width + 20) continue;
          ctx.strokeStyle = hexRgba(f.color, 0.55);
          ctx.beginPath();
          for (const m of f.mines) {
            if (!m.live) continue;
            const x = m.x + ox;
            ctx.moveTo(x - 2.5, m.y - 2.5);
            ctx.lineTo(x + 2.5, m.y + 2.5);
            ctx.moveTo(x + 2.5, m.y - 2.5);
            ctx.lineTo(x - 2.5, m.y + 2.5);
          }
          ctx.stroke();
          // Each mine blinks now and then; a lit fuse burns bright.
          for (const m of f.mines) {
            if (!m.live) continue;
            const blink = Math.sin(frame.time * 1.3 + m.phase) > 0.96;
            if (!blink && m.fuse < 0) continue;
            ctx.fillStyle = m.fuse >= 0 ? '#fff7d6' : hexRgba('#ef4444', 0.9);
            ctx.fillRect(m.x + ox - 1, m.y - 1, 2, 2);
          }
        }
        ctx.restore();
      },
    };
  },
});
