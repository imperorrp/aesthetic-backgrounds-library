/**
 * Combat: an engagement engine shared by raids and wars, and the `skirmish`
 * mechanic built on it. Ships fire by class (fighters stitch tracers, cruisers lance
 * beams, capitals and carriers loose homing missiles), escorts shoot missiles down,
 * nearby defense platforms join in, and ships that run out of hull explode.
 */
import type { Fleet, Ship } from '../types';
import { SHIP_SPECS } from '../ships';
import { registerMechanic, steerOrbit, steerToward, type MechanicApi } from './types';

export type Weapon = 'tracers' | 'beams' | 'missiles' | 'mixed';
type Battle = { a: Fleet[]; b: Fleet[]; weaponA: Weapon; weaponB: Weapon; until: number; colorA: string; colorB: string };

const RANGE = { tracers: 170, beams: 240, missiles: 340 };

/** Resolve a palette token ('hazard', 'accent', ...) or a hex. */
export function colorParam(api: MechanicApi, v: unknown, fallback: string): string {
  if (typeof v !== 'string' || !v) return fallback;
  if (v.startsWith('#')) return v;
  const p = api.host.palette as unknown as Record<string, unknown>;
  return typeof p[v] === 'string' ? (p[v] as string) : fallback;
}

export type Combat = {
  engage(a: Fleet[], b: Fleet[], opts: { weaponA?: Weapon; weaponB?: Weapon; seconds: number; colorA?: string; colorB?: string }): void;
  update(dt: number): void;
  readonly active: number;
  /** True while a fleet is in any engagement. */
  fighting(f: Fleet): boolean;
  /** End every engagement this fleet is in (a truce, a retreat). */
  disengage(f: Fleet): void;
};

export function createCombat(api: MechanicApi): Combat {
  const battles: Battle[] = [];
  const cooldown = new WeakMap<Ship, number>();
  const pending: { at: number; f: Fleet; s: Ship; dmg: number }[] = [];
  const alive = (f: Fleet) => f.mode !== 'gone' && f.ships.length > 0 && api.world.fleets.includes(f);
  const posOf = (f: Fleet, s: Ship) => () => (alive(f) && f.ships.includes(s) ? { x: s.x, y: s.y } : null);

  const weaponFor = (w: Weapon, s: Ship): Exclude<Weapon, 'mixed'> => {
    if (w !== 'mixed') return w;
    if (s.cls === 'capital' || s.cls === 'carrier') return 'missiles';
    if (s.cls === 'cruiser') return 'beams';
    return 'tracers';
  };

  const fire = (af: Fleet, a: Ship, df: Fleet, d: Ship, w: Exclude<Weapon, 'mixed'>, color: string) => {
    const r = api.rng;
    if (w === 'tracers') {
      const miss = r() > 0.55;
      const jx = miss ? (r() - 0.5) * 30 : (r() - 0.5) * 4;
      const jy = miss ? (r() - 0.5) * 30 : (r() - 0.5) * 4;
      api.fx.tracer(a.x, a.y, d.x + jx, d.y + jy, color);
      if (!miss) pending.push({ at: api.t + 0.12, f: df, s: d, dmg: 1 });
      cooldown.set(a, 0.28 + r() * 0.45);
    } else if (w === 'beams') {
      api.fx.beam(posOf(af, a), posOf(df, d), color, 0.7, a.cls === 'capital' ? 2.4 : 1.6);
      pending.push({ at: api.t + 0.65, f: df, s: d, dmg: 3 });
      cooldown.set(a, 1.6 + r() * 1.2);
    } else {
      const ang = Math.atan2(d.y - a.y, d.x - a.x) + (r() - 0.5) * 1.6;
      api.fx.missile(a.x, a.y, Math.cos(ang) * 60, Math.sin(ang) * 60, posOf(df, d), color, (x, y) => {
        api.fx.explode(x, y, color, 0.45);
        if (alive(df) && df.ships.includes(d)) api.damage(df, d, 3);
      });
      cooldown.set(a, 2.2 + r() * 1.8);
    }
  };

  const side = (shooters: Fleet[], targets: Fleet[], weapon: Weapon, color: string, dt: number) => {
    const live = targets.filter(alive);
    if (!live.length) return;
    for (const f of shooters) {
      if (!alive(f)) continue;
      for (const s of f.ships) {
        const cd = (cooldown.get(s) ?? api.rng() * 0.8) - dt;
        cooldown.set(s, cd);
        if (cd > 0) continue;
        const w = weaponFor(weapon, s);
        let best: { f: Fleet; s: Ship; d: number } | null = null;
        for (const tf of live) for (const ts of tf.ships) {
          const d = Math.hypot(ts.x - s.x, ts.y - s.y);
          if (d < RANGE[w] && (!best || d < best.d)) best = { f: tf, s: ts, d };
        }
        if (best) fire(f, s, best.f, best.s, w, color);
        else cooldown.set(s, 0.2);
      }
    }
  };

  /** Escort fighters near incoming missiles have a chance to shoot them down. */
  const pointDefense = (defenders: Fleet[], color: string, dt: number) => {
    const ms = api.fx.missiles();
    if (!ms.length) return;
    for (const f of defenders) {
      if (!alive(f)) continue;
      for (const s of f.ships) {
        if (s.cls !== 'fighter' && s.cls !== 'cruiser') continue;
        for (const m of ms) {
          if (m.dead) continue;
          if (Math.hypot(m.x - s.x, m.y - s.y) < 90 && api.rng() < dt * 2.2) {
            api.fx.tracer(s.x, s.y, m.x, m.y, color);
            api.fx.sparks(m.x, m.y, color, 6, 50);
            m.kill();
          }
        }
      }
    }
  };

  return {
    get active() {
      return battles.length;
    },
    fighting(f) {
      return battles.some((b) => b.a.includes(f) || b.b.includes(f));
    },
    disengage(f) {
      for (let i = battles.length - 1; i >= 0; i--) if (battles[i].a.includes(f) || battles[i].b.includes(f)) battles.splice(i, 1);
    },
    engage(a, b, opts) {
      battles.push({
        a,
        b,
        weaponA: opts.weaponA ?? 'mixed',
        weaponB: opts.weaponB ?? 'mixed',
        until: api.t + opts.seconds,
        colorA: opts.colorA ?? a[0]?.ships[0]?.color ?? '#f87171',
        colorB: opts.colorB ?? b[0]?.ships[0]?.color ?? '#38bdf8',
      });
    },
    update(dt) {
      for (let i = battles.length - 1; i >= 0; i--) {
        const bt = battles[i];
        if (api.t > bt.until || !bt.a.some(alive) || !bt.b.some(alive)) {
          battles.splice(i, 1);
          continue;
        }
        side(bt.a, bt.b, bt.weaponA, bt.colorA, dt);
        side(bt.b, bt.a, bt.weaponB, bt.colorB, dt);
        pointDefense(bt.a, bt.colorA, dt);
        pointDefense(bt.b, bt.colorB, dt);
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i];
        if (api.t < p.at) continue;
        pending.splice(i, 1);
        if (alive(p.f) && p.f.ships.includes(p.s)) {
          api.fx.sparks(p.s.x, p.s.y, '#fff7d6', 3, 40);
          api.damage(p.f, p.s, p.dmg);
        }
      }
    },
  };
}

// ---- the skirmish mechanic --------------------------------------------------------------

registerMechanic({
  id: 'skirmish',
  label: 'Raids',
  description: 'Hostiles jump a convoy. Escorts and nearby defense platforms fight back; ships burn; survivors run.',
  schema: {
    rate: { type: 'number', min: 0.1, max: 4, default: 0.8, label: 'Raids per minute' },
    raiders: { type: 'number', min: 2, max: 7, default: 4, step: 1, label: 'Raiders per attack' },
    weapon: { type: 'enum', values: ['tracers', 'beams', 'missiles', 'mixed'], default: 'tracers', label: 'Raider weapons' },
    name: { type: 'string', default: 'RAIDERS', label: 'What they are called' },
    color: { type: 'color', default: 'hazard', label: 'Raider color' },
  },
  create(api, p) {
    const combat = createCombat(api);
    const rate = Number(p.rate) || 0.8;
    const name = String(p.name || 'RAIDERS').toUpperCase().slice(0, 18);
    let next = api.t + 6 + api.rng() * 10;
    type Raid = { raiders: Fleet; target: Fleet; phase: 'intercept' | 'strafe' | 'withdraw'; until: number; dir: number };
    const raids: Raid[] = [];

    const begin = () => {
      const color = colorParam(api, p.color, '#f87171');
      // Raids happen on the main plane, where the raiders live.
      const candidates = api.world.fleets.filter((f) => f.ships.length > 0 && f.z < 0.15 && !f.steer && !f.hostile && f.mode !== 'docked' && f.fade > 0.8 && api.onScreen(f.ships[0].x, f.ships[0].y, 120));
      if (!candidates.length) return;
      const cargo = candidates.filter((f) => f.purpose === 'cargo');
      const pool = cargo.length && api.rng() < 0.7 ? cargo : candidates;
      const target = pool[Math.floor(api.rng() * pool.length)];
      const L = target.ships[0];
      const ang = api.rng() * Math.PI * 2;
      const at = { x: L.x + Math.cos(ang) * 280, y: Math.max(30, Math.min(api.height - 30, L.y + Math.sin(ang) * 220)) };
      const raid: Raid = { raiders: null as unknown as Fleet, target, phase: 'intercept', until: api.t + 14 + api.rng() * 8, dir: api.rng() < 0.5 ? 1 : -1 };
      const speed = SHIP_SPECS.fighter.speed * 1.35;
      raid.raiders = api.spawnFleet(
        { x: at.x, y: at.y, vx: Math.cos(ang + Math.PI) * speed * 0.5, vy: Math.sin(ang + Math.PI) * speed * 0.5 },
        {
          cls: 'fighter',
          wings: Array(Math.max(1, Math.round(Number(p.raiders) || 4) - 1)).fill('fighter'),
          color,
          tag: 'raider',
          hostile: true,
          warpIn: true,
          callsign: `${name.split(' ')[0].slice(0, 4)}-${100 + Math.floor(api.rng() * 900)}`,
          steer: (f, dt) => {
            const tl = raid.target.ships[0];
            const lead = f.ships[0];
            if (raid.phase === 'withdraw' || !tl || raid.target.mode === 'gone') {
              steerToward(lead, lead.x + (lead.x - api.view().left - api.width / 2) * 2, lead.y + (lead.y - api.height / 2) * 2, speed * 1.2, 2, dt);
              return;
            }
            const d = Math.hypot(tl.x - lead.x, tl.y - lead.y);
            if (raid.phase === 'intercept') {
              steerToward(lead, tl.x + tl.vx * 0.6, tl.y + tl.vy * 0.6, speed, 3, dt);
              if (d < 150) {
                raid.phase = 'strafe';
                combat.engage([raid.raiders], [raid.target], { weaponA: p.weapon as never, weaponB: 'mixed', seconds: raid.until - api.t, colorA: color });
                for (const s of api.structures()) {
                  if (!s.z && s.role === 'defense' && Math.hypot(s.x - tl.x, s.y - tl.y) < 320) api.say(`${s.label} · ENGAGING`, s.x, s.y, s.color ?? color, { priority: 'medium' });
                }
              }
            } else {
              steerOrbit(lead, tl.x, tl.y, 85, speed * 0.95, raid.dir, 3, dt);
            }
          },
        },
      );
      api.say(`CONTACT · ${raid.raiders.ships.length} ${name}`, at.x, at.y, color, { priority: 'high', followId: raid.raiders.id });
      // The target runs, toward a defense platform if one is near, else away.
      const haven = api.structures().filter((s) => !s.z && s.role === 'defense' && api.onScreen(s.x, s.y, 0)).sort((a, b) => Math.hypot(a.x - L.x, a.y - L.y) - Math.hypot(b.x - L.x, b.y - L.y))[0];
      target.steer = (f, dt) => {
        const me = f.ships[0];
        const sp = SHIP_SPECS[f.cls].speed * 1.15;
        const r = raid.raiders.ships[0];
        if (haven) steerToward(me, haven.x, haven.y, sp, 1.5, dt, 60);
        else if (r) steerToward(me, me.x + (me.x - r.x), me.y + (me.y - r.y), sp, 1.5, dt);
      };
      api.say(`${target.callsign} · TAKING FIRE`, L.x, L.y, target.ships[0].color, { priority: 'high', followId: target.id });
      api.emit({ type: 'raid', x: L.x, y: L.y, weight: 0.85, color, follow: api.follow(target), raiders: raid.raiders.id, target: target.id });
      raids.push(raid);
    };

    return {
      update(dt) {
        combat.update(dt);
        if (api.t >= next) {
          if (raids.length < 2) begin();
          next = api.t + (60 / rate) * (0.6 + api.rng() * 0.8) / (0.6 + api.tension * 0.8);
        }
        for (let i = raids.length - 1; i >= 0; i--) {
          const r = raids[i];
          const raidersAlive = r.raiders.ships.length > 0 && r.raiders.mode !== 'gone';
          const targetAlive = r.target.ships.length > 0 && r.target.mode !== 'gone';
          // Defense platforms near the fight lance the raiders.
          if (raidersAlive && r.phase === 'strafe') {
            for (const s of api.structures()) {
              if (s.z || s.role !== 'defense' || api.rng() > dt * 0.9) continue;
              const rs = r.raiders.ships[Math.floor(api.rng() * r.raiders.ships.length)];
              if (rs && Math.hypot(s.x - rs.x, s.y - rs.y) < 300) {
                const victim = rs;
                api.fx.beam(() => ({ x: s.x, y: s.y }), () => (r.raiders.ships.includes(victim) ? { x: victim.x, y: victim.y } : null), s.color ?? '#38bdf8', 0.6, 2);
                api.damage(r.raiders, victim, 2);
              }
            }
          }
          if (r.phase !== 'withdraw' && (api.t > r.until || !targetAlive || !raidersAlive)) {
            r.phase = 'withdraw';
            if (raidersAlive) api.say(`${name} BREAK OFF`, r.raiders.ships[0].x, r.raiders.ships[0].y, r.raiders.ships[0].color, { priority: 'medium', followId: r.raiders.id });
            if (targetAlive) api.release(r.target);
            r.until = api.t + 2.5;
          }
          if (r.phase === 'withdraw' && api.t > r.until) {
            if (raidersAlive) {
              const l = r.raiders.ships[0];
              api.fx.warp(l.x, l.y, Math.atan2(l.vy, l.vx), l.color, false);
              r.raiders.mode = 'gone';
            }
            raids.splice(i, 1);
          }
        }
      },
    };
  },
});
