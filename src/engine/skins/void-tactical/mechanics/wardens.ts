/**
 * Wardens: toll buoys along the lanes. A ship that passes close is stopped, holds while a
 * scan beam sweeps it ("PAPERS"), and is waved on. Now and then the scan turns up
 * contraband: the ship bolts for the edge of the map and the buoy launches cutters after
 * it. Either the smuggler gets away, or it does not.
 */
import type { Fleet, Structure } from '../types';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { colorParam, createCombat } from './combat';
import { registerMechanic, steerOrbit, steerToward } from './types';

const BUOY_ART = [' /‾\\ ', '<(W)>', ' \\_/ '];

registerMechanic({
  id: 'wardens',
  label: 'Warden checkpoints',
  description: 'Toll buoys stop passing ships and scan them; contraband turns into a chase with warden cutters.',
  schema: {
    buoys: { type: 'number', min: 1, max: 4, default: 2, step: 1, label: 'Buoys on screen' },
    contraband: { type: 'number', min: 0, max: 0.6, default: 0.2, label: 'Share caught smuggling' },
    color: { type: 'color', default: '#38bdf8', label: 'Warden color' },
    name: { type: 'string', default: 'WARDEN BUOY', label: 'What the buoys are called' },
  },
  create(api, p) {
    const combat = createCombat(api);
    const color = colorParam(api, p.color, '#38bdf8');
    const label = String(p.name || 'WARDEN BUOY').toUpperCase().slice(0, 18);
    const buoys: Structure[] = [];
    const checked = new WeakSet<Fleet>();
    type Stop = { f: Fleet; buoy: Structure; until: number; beamAt: number };
    type Chase = { smuggler: Fleet; cutters: Fleet; until: number; done: boolean };
    const stops: Stop[] = [];
    const chases: Chase[] = [];
    let nextBuoy = api.t + 1;

    const place = () => {
      const v = api.view();
      // Count the buoys on screen and the ones already waiting just ahead of it.
      const near = buoys.filter((b) => b.x > v.left - 100 && b.x < v.right + 400);
      if (near.length >= (Number(p.buoys) || 2)) return;
      // Ahead of the view, in the middle band where the lanes run.
      const x = v.right + 60 + api.rng() * 200;
      const y = api.height * (0.25 + api.rng() * 0.5);
      if (api.structures().some((s) => Math.hypot(s.x - x, s.y - y) < 120)) return;
      const b = api.addStructure({ x, y, label, role: 'defense', art: BUOY_ART, color, kind: 'warden_buoy', chatter: ['PAPERS, PLEASE', 'TOLL PAYABLE ON PASSAGE', 'LANE ENFORCEMENT ACTIVE'] });
      buoys.push(b);
    };

    const bolt = (s: Stop) => {
      const f = s.f;
      const sp = SHIP_SPECS[f.cls].speed * 1.7;
      const L = f.ships[0];
      const away = Math.atan2(L.y - s.buoy.y, L.x - s.buoy.x);
      f.hostile = true;
      f.steer = (fl, dt) => {
        const me = fl.ships[0];
        steerToward(me, me.x + Math.cos(away) * 300, me.y + Math.sin(away) * 300, sp, 2.4, dt);
      };
      const ang = Math.atan2(L.y - s.buoy.y, L.x - s.buoy.x);
      const chase: Chase = { smuggler: f, cutters: null as unknown as Fleet, until: api.t + 22, done: false };
      const cut = SHIP_SPECS.fighter.speed * 1.6;
      chase.cutters = api.spawnFleet(
        { x: s.buoy.x + Math.cos(ang) * 12, y: s.buoy.y + Math.sin(ang) * 12, vx: Math.cos(ang) * cut * 0.5, vy: Math.sin(ang) * cut * 0.5 },
        {
          cls: 'fighter',
          wings: ['fighter'],
          color,
          tag: 'warden',
          fadeIn: true,
          steer: (fl, dt) => {
            const me = fl.ships[0];
            const t = chase.smuggler.ships[0];
            if (!t || chase.done) {
              steerToward(me, s.buoy.x, s.buoy.y, cut * 0.7, 2, dt, 40);
              return;
            }
            if (Math.hypot(t.x - me.x, t.y - me.y) < 120) steerOrbit(me, t.x, t.y, 60, cut, 1, 3, dt);
            else steerToward(me, t.x + t.vx * 0.5, t.y + t.vy * 0.5, cut, 3, dt);
          },
        },
      );
      combat.engage([chase.cutters], [f], { weaponA: 'tracers', weaponB: 'tracers', seconds: 20, colorA: color });
      chases.push(chase);
      api.say(`CONTRABAND · ${f.callsign} RUNNING`, L.x, L.y, '#f43f5e', { priority: 'high', followId: f.id });
      api.emit({ type: 'chase', x: L.x, y: L.y, weight: 0.75, follow: api.follow(f) });
    };

    return {
      update(dt) {
        combat.update(dt);
        if (api.t >= nextBuoy) {
          place();
          nextBuoy = api.t + 3;
        }
        for (let i = buoys.length - 1; i >= 0; i--) if (!api.structures().includes(buoys[i])) buoys.splice(i, 1);

        // Stop ordinary traffic that passes close to a buoy.
        for (const f of api.world.fleets) {
          if (f.steer || f.hostile || f.z > 0.1 || checked.has(f) || f.mode !== 'transit' || !f.ships[0] || f.tag === 'warden') continue;
          const L = f.ships[0];
          const b = buoys.find((bu) => Math.hypot(bu.x - L.x, bu.y - L.y) < 90 && api.onScreen(bu.x, bu.y, 0));
          if (!b) continue;
          checked.add(f);
          f.steer = (fl, d) => steerOrbit(fl.ships[0], b.x, b.y, 38, 10, 1, 2, d);
          stops.push({ f, buoy: b, until: api.t + 2.6, beamAt: 0 });
          api.say(`${b.label} · PAPERS · ${f.callsign}`, b.x, b.y + 22, color, { priority: 'low', duration: 2600 });
          api.emit({ type: 'checkpoint', x: b.x, y: b.y, weight: 0.25 });
        }

        for (let i = stops.length - 1; i >= 0; i--) {
          const s = stops[i];
          if (s.f.mode === 'gone' || !s.f.ships.length) {
            stops.splice(i, 1);
            continue;
          }
          if (api.t >= s.beamAt) {
            // The scan: a beam sweeping over the hull, pulse after pulse.
            api.fx.beam(() => ({ x: s.buoy.x, y: s.buoy.y }), () => (s.f.ships[0] ? { x: s.f.ships[0].x + (api.rng() - 0.5) * 8, y: s.f.ships[0].y + (api.rng() - 0.5) * 8 } : null), color, 0.5, 0.8);
            s.beamAt = api.t + 0.6;
          }
          if (api.t < s.until) continue;
          stops.splice(i, 1);
          s.buoy.flashAt = api.t;
          if (api.rng() < (Number(p.contraband) || 0)) bolt(s);
          else {
            api.release(s.f);
            api.say(`${s.f.callsign} · CLEARED`, s.f.ships[0].x, s.f.ships[0].y, color, { priority: 'low', followId: s.f.id, duration: 2200 });
          }
        }

        for (let i = chases.length - 1; i >= 0; i--) {
          const c = chases[i];
          const gone = c.smuggler.mode === 'gone' || !c.smuggler.ships.length;
          const L = c.smuggler.ships[0];
          if (!c.done && (gone || api.t > c.until || (L && !api.onScreen(L.x, L.y, 60)))) {
            c.done = true;
            const at = c.cutters.ships[0] ?? L;
            if (at) api.say(gone ? 'SMUGGLER DOWN' : 'SMUGGLER ESCAPED', at.x, at.y, gone ? color : '#f43f5e', { priority: 'medium' });
            if (L && !gone) c.smuggler.mode = 'gone';
          }
          if (c.done) {
            const C = c.cutters.ships[0];
            const home = buoys[0];
            if (!C || c.cutters.mode === 'gone') {
              chases.splice(i, 1);
              continue;
            }
            if (!home || Math.hypot(C.x - home.x, C.y - home.y) < 50) {
              c.cutters.fadeTo = 0;
              if (c.cutters.fade < 0.05) c.cutters.mode = 'gone';
            }
          }
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'mid') return;
        // The checkpoint zone: a faint dashed circle around each buoy.
        for (const b of buoys) {
          if (!api.onScreen(b.x, b.y, 40)) continue;
          ctx.strokeStyle = hexRgba(color, 0.18 + (stops.some((s) => s.buoy === b) ? 0.2 + 0.15 * Math.sin(frame.time * 6) : 0));
          ctx.setLineDash([2, 6]);
          ctx.beginPath();
          ctx.arc(api.screenX(b.x), b.y, 90, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      },
    };
  },
});
