/**
 * Warfront: two factions hold the two halves of the map. The front between them is
 * a moving line; systems change hands as it shifts; squadrons clash along it with
 * missiles, beams, and tracers; artillery volleys arc across it onto enemy systems.
 */
import type { Fleet } from '../types';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { createCombat } from './combat';
import { registerMechanic, steerToward } from './types';

registerMechanic({
  id: 'warfront',
  label: 'War along a front',
  description: 'Two factions hold the two halves of the map; the front moves, systems fall, squadrons clash, artillery arcs across.',
  schema: {
    battles: { type: 'number', min: 0.2, max: 5, default: 1.6, label: 'Clashes per minute' },
    mobility: { type: 'number', min: 0, max: 1, default: 0.5, label: 'How much the front moves' },
    bombard: { type: 'boolean', default: true, label: 'Artillery volleys' },
  },
  create(api, p) {
    const combat = createCombat(api);
    const factions = api.pack.factions;
    const colorOf = (side: number) => factions[side]?.color ?? (side === 0 ? '#f87171' : '#60a5fa');
    const nameOf = (side: number) => factions[side]?.name ?? (side === 0 ? 'WEST' : 'EAST');
    const owner = new Map<string, number>();
    const mobility = Number(p.mobility ?? 0.5);
    let nextClash = api.t + 3;
    let nextVolley = api.t + 7;
    type Squad = { f: Fleet; side: number; phase: 'advance' | 'fight' | 'retreat'; until: number };
    const squads: Squad[] = [];

    /** Front position (screen x) at height y and time t. */
    const frontX = (y: number, t: number) =>
      api.width * (0.5 + mobility * (0.22 * api.host.noise.fbm2(t / 70, 3.3, 3) + 0.07 * Math.sin(t * 0.05 + y * 0.006)) + 0.03 * Math.sin(y * 0.013 + 1.7));

    const squad = (side: number, y: number) => {
      const v = api.view();
      const x = side === 0 ? v.left - 30 : v.right + 30;
      const heavy = api.rng() < 0.3;
      const cls = heavy ? (api.rng() < 0.4 ? 'capital' : 'cruiser') : 'fighter';
      const sp = SHIP_SPECS[cls].speed * 1.1;
      const s: Squad = { f: null as unknown as Fleet, side, phase: 'advance', until: 0 };
      s.f = api.spawnFleet(
        { x, y, vx: side === 0 ? 40 : -40, vy: 0 },
        {
          cls,
          faction: side,
          color: colorOf(side),
          tag: 'war',
          steer: (f, dt) => {
            const L = f.ships[0];
            const fx = api.view().left + frontX(L.y, api.t);
            if (s.phase === 'retreat') {
              steerToward(L, side === 0 ? api.view().left - 120 : api.view().right + 120, L.y, sp, 1.5, dt);
              return;
            }
            // Advance to just short of the front, then hold and fight.
            const hold = fx + (side === 0 ? -40 : 40);
            steerToward(L, hold, y + Math.sin(api.t * 0.4 + y) * 30, sp, 1.6, dt, 60);
          },
        },
      );
      squads.push(s);
      return s;
    };

    const clash = () => {
      const y = 80 + api.rng() * (api.height - 160);
      const a = squad(0, y);
      const b = squad(1, y + (api.rng() - 0.5) * 80);
      const at = api.view().left + frontX(y, api.t);
      combat.engage([a.f], [b.f], { weaponA: 'mixed', weaponB: 'mixed', seconds: 18 + api.rng() * 10, colorA: colorOf(0), colorB: colorOf(1) });
      a.phase = b.phase = 'fight';
      a.until = b.until = api.t + 26;
      api.say(`CONTACT ALONG THE FRONT`, at, y - 20, api.host.palette.ink, { priority: 'medium', duration: 3500 });
      api.emit({ type: 'combat', x: at, y, weight: 0.65, follow: api.follow(a.f) });
    };

    const volley = () => {
      const side = api.rng() < 0.5 ? 0 : 1;
      const enemy = api.world.systems.filter((s) => !s.z && owner.get(s.id) === 1 - side && api.onScreen(s.x, s.y, 0));
      if (!enemy.length) return;
      const target = enemy[Math.floor(api.rng() * enemy.length)];
      const v = api.view();
      const fromX = side === 0 ? v.left + 20 : v.right - 20;
      const fromY = api.height * (0.2 + api.rng() * 0.6);
      const color = colorOf(side);
      const n = 3 + Math.floor(api.rng() * 4);
      for (let i = 0; i < n; i++) {
        const tx = target.x + (api.rng() - 0.5) * 50;
        const ty = target.y + (api.rng() - 0.5) * 50;
        api.fx.missile(fromX, fromY + i * 8, side === 0 ? 50 : -50, -80 - api.rng() * 60, () => ({ x: tx, y: ty }), color, (x, y) => api.fx.explode(x, y, color, 0.6), 120 + api.rng() * 40);
      }
      api.say(`BOMBARDMENT · ${target.name}`, target.x, target.y - 28, color, { priority: 'high' });
    };

    return {
      update(dt) {
        combat.update(dt);
        // Ownership follows the front; a system the front passes changes hands.
        for (const s of api.world.systems) {
          if (s.z || !api.onScreen(s.x, s.y, 60)) continue;
          const side = api.screenX(s.x) < frontX(s.y, api.t) ? 0 : 1;
          const prev = owner.get(s.id);
          if (prev === undefined) owner.set(s.id, side);
          else if (prev !== side) {
            owner.set(s.id, side);
            api.fx.ring(s.x, s.y, colorOf(side), 90, 1.4, 4, 2);
            api.fx.flash(s.x, s.y, colorOf(side), 40, 0.8);
            api.say(`${s.name} FALLS TO ${nameOf(side)}`, s.x, s.y + 30, colorOf(side), { priority: 'high', duration: 5000 });
            api.emit({ type: 'capture', x: s.x, y: s.y, weight: 0.85, color: colorOf(side), side });
          }
        }
        if (api.t >= nextClash) {
          if (squads.filter((s) => s.phase !== 'retreat').length < 6) clash();
          nextClash = api.t + (60 / (Number(p.battles) || 1.6)) * (0.6 + api.rng() * 0.8) / (0.6 + api.tension * 0.8);
        }
        if (p.bombard !== false && api.t >= nextVolley) {
          volley();
          nextVolley = api.t + 9 + api.rng() * 14;
        }
        for (let i = squads.length - 1; i >= 0; i--) {
          const s = squads[i];
          if (s.f.mode === 'gone' || !s.f.ships.length) {
            squads.splice(i, 1);
            continue;
          }
          if (s.phase === 'fight' && (api.t > s.until || !combat.fighting(s.f))) s.phase = 'retreat';
          if (s.phase === 'retreat' && !api.onScreen(s.f.ships[0].x, s.f.ships[0].y, 100)) s.f.mode = 'gone';
        }
      },
      draw(ctx, pass, frame) {
        if (pass === 'under') {
          // Territory: each side faintly tinted, fading toward the line.
          const steps = 24;
          ctx.save();
          for (const side of [0, 1]) {
            ctx.beginPath();
            const edge = side === 0 ? 0 : api.width;
            ctx.moveTo(edge, 0);
            for (let i = 0; i <= steps; i++) {
              const y = (i / steps) * api.height;
              ctx.lineTo(frontX(y, frame.time), y);
            }
            ctx.lineTo(edge, api.height);
            ctx.closePath();
            ctx.fillStyle = hexRgba(colorOf(side), 0.045);
            ctx.fill();
          }
          // The front itself: a broken line with tick marks.
          ctx.strokeStyle = hexRgba(api.host.palette.ink, 0.35);
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]);
          ctx.lineDashOffset = -frame.time * 6;
          ctx.beginPath();
          for (let i = 0; i <= steps * 2; i++) {
            const y = (i / (steps * 2)) * api.height;
            const x = frontX(y, frame.time);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = '9px "Syne Mono", ui-monospace, monospace';
          ctx.textAlign = 'center';
          for (let i = 1; i < 4; i++) {
            const y = (i / 4) * api.height;
            const x = frontX(y, frame.time);
            ctx.fillStyle = hexRgba(colorOf(0), 0.6);
            ctx.fillText('◀', Math.round(x - 14), Math.round(y));
            ctx.fillStyle = hexRgba(colorOf(1), 0.6);
            ctx.fillText('▶', Math.round(x + 14), Math.round(y));
          }
          ctx.restore();
        } else if (pass === 'mid') {
          // Owner rings on every system.
          ctx.save();
          ctx.lineWidth = 1.4;
          for (const s of api.world.systems) {
            const o = owner.get(s.id);
            if (o === undefined) continue;
            const x = api.screenX(s.x);
            if (x < -60 || x > api.width + 60) continue;
            const contested = Math.abs(x - frontX(s.y, frame.time)) < 90;
            ctx.strokeStyle = hexRgba(colorOf(o), contested ? 0.45 + 0.35 * Math.sin(frame.time * 6) : 0.55);
            ctx.beginPath();
            ctx.arc(x, s.y, s.starRadius * 4 + 30, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      },
    };
  },
});
