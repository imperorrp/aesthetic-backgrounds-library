/**
 * Cradles that hatch: shipyards here are wombs. Each one beats (a double pulse, faster
 * as the hatching nears), its membrane wobbling with veins of light. Then it splits: a
 * flash, a ring, and a ship comes out small and grows to full size as it flies away.
 * Cradles take over the shipyards' launches.
 */
import type { ShipClass } from '../universe';
import { hexRgba } from '../renderers/utils';
import { registerMechanic } from './types';

const BROOD: ShipClass[] = ['fighter', 'fighter', 'scout', 'cruiser', 'carrier', 'capital'];

registerMechanic({
  id: 'cradles',
  label: 'Cradles that hatch',
  description: 'Shipyards beat like hearts and hatch ships that grow to full size as they fly.',
  schema: {
    every: { type: 'number', min: 8, max: 120, default: 30, label: 'Seconds between hatchings (per cradle)' },
    growth: { type: 'number', min: 4, max: 60, default: 20, label: 'Seconds to grow up' },
    color: { type: 'color', default: '#c4b5fd', label: 'Membrane' },
  },
  create(api, p) {
    api.world.managedRoles ??= new Set();
    api.world.managedRoles.add('shipyard');
    const due = new Map<string, number>();
    const every = Number(p.every) || 30;
    const color = String(p.color || '#c4b5fd');

    const cradles = () => api.structures().filter((s) => !s.z && s.role === 'shipyard' && api.onScreen(s.x, s.y, -60));

    return {
      update() {
        for (const s of cradles()) {
          if (!due.has(s.id)) due.set(s.id, api.t + every * (0.3 + api.rng() * 0.9));
          if (api.t < due.get(s.id)!) continue;
          due.set(s.id, api.t + every * (0.7 + api.rng() * 0.6));
          if (!api.onScreen(s.x, s.y, 30)) continue;
          const cls = BROOD[Math.floor(api.rng() * BROOD.length)];
          const ang = api.rng() * Math.PI * 2;
          const f = api.spawnFleet({ x: s.x + Math.cos(ang) * 10, y: s.y + Math.sin(ang) * 10, vx: Math.cos(ang) * 14, vy: Math.sin(ang) * 14 }, { cls, wings: [], fadeIn: true });
          f.tag = undefined;
          f.grow = { at: api.t, dur: Number(p.growth) || 20 };
          s.flashAt = api.t;
          api.fx.flash(s.x, s.y, '#ffffff', 36, 0.6);
          api.fx.ring(s.x, s.y, color, 70, 1.4, 6, 1.5);
          api.fx.sparks(s.x, s.y, color, 14, 50);
          api.say(`SOMETHING HATCHED · ${s.label}`, s.x, s.y + 26, color, { priority: 'high', followId: f.id });
          api.emit({ type: 'hatch', x: s.x, y: s.y, weight: 0.6, follow: api.follow(f) });
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'under') return;
        for (const s of cradles()) {
          const left = (due.get(s.id) ?? frame.time + every) - frame.time;
          const near = Math.max(0, 1 - left / every);
          // A double beat, quickening as the hatching nears.
          const rate = 0.7 + near * 1.6;
          const ph = (frame.time * rate + s.spin) % 1;
          const beat = Math.max(Math.exp(-((ph - 0.1) ** 2) / 0.002), 0.6 * Math.exp(-((ph - 0.28) ** 2) / 0.002));
          const x = api.screenX(s.x);
          const r = 26 + beat * 4 + near * 4;
          const g = ctx.createRadialGradient(x, s.y, 0, x, s.y, r * 1.8);
          g.addColorStop(0, hexRgba(color, 0.12 + 0.18 * beat));
          g.addColorStop(1, hexRgba(color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - r * 1.8, s.y - r * 1.8, r * 3.6, r * 3.6);
          // The membrane: a wobbling ring with veins running in.
          ctx.strokeStyle = hexRgba(color, 0.3 + 0.35 * beat);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            const rr = r + Math.sin(a * 5 + frame.time * 2 + s.spin) * 2.2;
            const px = x + Math.cos(a) * rr;
            const py = s.y + Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.strokeStyle = hexRgba(color, 0.12 + 0.2 * near);
          ctx.beginPath();
          for (let i = 0; i < 7; i++) {
            const a = s.spin + (i / 7) * Math.PI * 2;
            ctx.moveTo(x + Math.cos(a) * r, s.y + Math.sin(a) * r);
            ctx.quadraticCurveTo(x + Math.cos(a + 0.3) * r * 0.6, s.y + Math.sin(a + 0.3) * r * 0.6, x + Math.cos(a + 0.5) * r * 0.2, s.y + Math.sin(a + 0.5) * r * 0.2);
          }
          ctx.stroke();
        }
      },
    };
  },
});
