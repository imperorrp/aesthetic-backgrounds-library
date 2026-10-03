/**
 * Police: when a raid starts near a defense platform, the platform scrambles a wing of
 * interceptors. They race to the raiders, turn the raid into a dogfight, and fly home
 * when it is over. Works with any mechanic that emits a `raid` event carrying the
 * raiders' fleet id (`skirmish` does).
 */
import type { Fleet, Structure } from '../types';
import { SHIP_SPECS } from '../ships';
import { colorParam, createCombat } from './combat';
import { registerMechanic, steerOrbit, steerToward } from './types';

registerMechanic({
  id: 'police',
  label: 'Police response',
  description: 'Defense platforms scramble interceptors at raids nearby, so a raid becomes a dogfight.',
  schema: {
    reach: { type: 'number', min: 300, max: 1600, default: 900, label: 'How far they respond (px)' },
    wing: { type: 'number', min: 2, max: 6, default: 3, step: 1, label: 'Interceptors per sortie' },
    color: { type: 'color', default: '#60a5fa', label: 'Police color' },
    name: { type: 'string', default: 'INTERCEPTORS', label: 'What they are called' },
  },
  create(api, p) {
    const combat = createCombat(api);
    const name = String(p.name || 'INTERCEPTORS').toUpperCase().slice(0, 16);
    type Sortie = { police: Fleet; raiders: Fleet; base: Structure; phase: 'scramble' | 'fight' | 'home'; until: number };
    const sorties: Sortie[] = [];
    const speed = SHIP_SPECS.fighter.speed * 1.45;

    api.bus.on('raid', (e) => {
      const raiders = api.world.fleets.find((f) => f.id === e.raiders);
      if (!raiders || e.x === undefined || e.y === undefined || sorties.some((s) => s.raiders === raiders)) return;
      const reach = Number(p.reach) || 900;
      const base = api
        .structures()
        .filter((s) => !s.z && s.role === 'defense' && api.onScreen(s.x, s.y, 80) && Math.hypot(s.x - e.x!, s.y - e.y!) < reach)
        .sort((a, b) => Math.hypot(a.x - e.x!, a.y - e.y!) - Math.hypot(b.x - e.x!, b.y - e.y!))[0];
      if (!base) return;
      const color = colorParam(api, p.color, '#60a5fa');
      const n = Math.max(2, Math.round(Number(p.wing) || 3));
      const ang = Math.atan2(e.y - base.y, e.x - base.x);
      const sortie: Sortie = { police: null as unknown as Fleet, raiders, base, phase: 'scramble', until: api.t + 30 };
      sortie.police = api.spawnFleet(
        { x: base.x + Math.cos(ang) * 14, y: base.y + Math.sin(ang) * 14, vx: Math.cos(ang) * speed * 0.6, vy: Math.sin(ang) * speed * 0.6 },
        {
          cls: 'fighter',
          wings: Array(n - 1).fill('fighter'),
          color,
          tag: 'police',
          fadeIn: true,
          callsign: `${name.slice(0, 3)}-${100 + Math.floor(api.rng() * 900)}`,
          steer: (f, dt) => {
            const me = f.ships[0];
            const r = sortie.raiders.ships[0];
            if (sortie.phase === 'home' || !r) {
              steerToward(me, sortie.base.x, sortie.base.y, speed * 0.8, 2, dt, 40);
              return;
            }
            if (sortie.phase === 'scramble') {
              steerToward(me, r.x + r.vx * 0.5, r.y + r.vy * 0.5, speed, 3.2, dt);
              if (Math.hypot(r.x - me.x, r.y - me.y) < 170) {
                sortie.phase = 'fight';
                combat.engage([f], [sortie.raiders], { weaponA: 'tracers', weaponB: 'tracers', seconds: 16, colorA: color });
                api.say(`${f.callsign} · ENGAGING ${sortie.raiders.callsign}`, me.x, me.y, color, { priority: 'medium', followId: f.id });
              }
            } else steerOrbit(me, r.x, r.y, 70, speed * 0.9, -1, 3, dt);
          },
        },
      );
      base.flashAt = api.t;
      api.say(`${base.label} · SCRAMBLING ${n} ${name}`, base.x, base.y + 26, color, { priority: 'high', followId: sortie.police.id });
      api.emit({ type: 'scramble', x: base.x, y: base.y, weight: 0.7, color, follow: api.follow(sortie.police) });
      sorties.push(sortie);
    });

    return {
      update(dt) {
        combat.update(dt);
        for (let i = sorties.length - 1; i >= 0; i--) {
          const s = sorties[i];
          const police = s.police;
          if (police.mode === 'gone' || !police.ships.length) {
            sorties.splice(i, 1);
            continue;
          }
          const raidersGone = s.raiders.mode === 'gone' || !s.raiders.ships.length || s.raiders.fade < 0.1;
          if (s.phase !== 'home' && (raidersGone || api.t > s.until || (s.phase === 'fight' && !combat.fighting(police)))) {
            s.phase = 'home';
            const L = police.ships[0];
            api.say(raidersGone ? `${police.callsign} · SECTOR CLEAR · RTB` : `${police.callsign} · BREAKING OFF`, L.x, L.y, police.ships[0].color, { priority: 'low', followId: police.id });
          }
          // Home: dock by fading out at the platform.
          if (s.phase === 'home') {
            const L = police.ships[0];
            if (Math.hypot(L.x - s.base.x, L.y - s.base.y) < 46) {
              police.fadeTo = 0;
              if (police.fade < 0.05) police.mode = 'gone';
            }
          }
        }
      },
    };
  },
});
