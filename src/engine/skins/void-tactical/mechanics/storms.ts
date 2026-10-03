/**
 * Storm fronts: a band of dust (or ions, or static) rolls across the whole map on
 * the wind. Inside it the view fills with driven streaks, ships fade to ghosts, and
 * sensors report it; behind it the air clears.
 */
import { hexRgba } from '../renderers/utils';
import type { FieldHandle } from '../../../sim/fields';
import { registerMechanic } from './types';
import { useWeather } from './weather';

type Front = { born: number; dur: number; ang: number; width: number; seed: number; warned: boolean; wind?: FieldHandle; off?: () => void };

registerMechanic({
  id: 'storms',
  label: 'Storm fronts',
  description: 'A front of dust or ions rolls across the whole map on the wind; ships inside fade to ghosts.',
  schema: {
    rate: { type: 'number', min: 0.1, max: 2, default: 0.5, label: 'Fronts per minute' },
    color: { type: 'color', default: '#c08457', label: 'Storm color' },
    density: { type: 'number', min: 0.2, max: 1.5, default: 0.8, label: 'Thickness' },
    name: { type: 'string', default: 'DUST FRONT', label: 'What it is called' },
  },
  create(api, p) {
    const fronts: Front[] = [];
    let next = api.t + 8 + api.rng() * 14;
    const color = String(p.color || '#c08457');
    const name = String(p.name || 'DUST FRONT').toUpperCase().slice(0, 20);

    /** Signed distance (px) from the front's center line, along the wind. */
    const along = (f: Front, x: number, y: number, t: number) => {
      const k = (t - f.born) / f.dur;
      const reach = Math.hypot(api.width, api.height) + f.width * 2;
      const cx = api.width / 2 - Math.cos(f.ang) * (reach / 2) + Math.cos(f.ang) * reach * k;
      const cy = api.height / 2 - Math.sin(f.ang) * (reach / 2) + Math.sin(f.ang) * reach * k;
      return (x - cx) * Math.cos(f.ang) + (y - cy) * Math.sin(f.ang);
    };

    const weather = useWeather(api);
    /** The front's center line, as a dot product along its direction in world units (for the wind field). */
    const centerAlong = (f: Front, t: number) => {
      const k = (t - f.born) / f.dur;
      const reach = Math.hypot(api.width, api.height) + f.width * 2;
      const cx = api.width / 2 - Math.cos(f.ang) * (reach / 2) + Math.cos(f.ang) * reach * k + api.view().left;
      const cy = api.height / 2 - Math.sin(f.ang) * (reach / 2) + Math.sin(f.ang) * reach * k;
      return cx * Math.cos(f.ang) + cy * Math.sin(f.ang);
    };

    return {
      update() {
        if (api.t >= next) {
          const f: Front = { born: api.t, dur: 34 + api.rng() * 18, ang: (api.rng() < 0.7 ? Math.PI : 0) + (api.rng() - 0.5) * 0.9, width: 220 + api.rng() * 180, seed: api.rng() * 1000, warned: false };
          // The front blows: a band of wind in its direction of travel, and storminess inside it.
          f.wind = weather.field.add({ kind: 'band', angle: f.ang, at: (t) => centerAlong(f, t), width: f.width, strength: 34 * (Number(p.density) || 0.8) });
          f.off = weather.addStorm((x, y, t) => (t > f.born + f.dur ? 0 : Math.max(0, 1 - Math.abs(along(f, api.screenX(x), y, t)) / (f.width / 2))));
          fronts.push(f);
          api.emit({ type: 'storm', x: api.view().left + api.width / 2, y: api.height / 2, weight: 0.35 });
          next = api.t + (60 / (Number(p.rate) || 0.5)) * (0.7 + api.rng() * 0.6);
        }
        for (let i = fronts.length - 1; i >= 0; i--) {
          const f = fronts[i];
          if (api.t > f.born + f.dur) {
            if (f.wind) weather.field.remove(f.wind);
            f.off?.();
            fronts.splice(i, 1);
          } else if (!f.warned && api.t > f.born + f.dur * 0.25) {
            f.warned = true;
            api.say(`${name} · SENSORS DEGRADED`, api.view().left + api.width * 0.5, 40, color, { priority: 'high', duration: 5000 });
          }
        }
        // Ships inside a front fade toward ghosts.
        for (const fl of api.world.fleets) {
          const L = fl.ships[0];
          if (!L) continue;
          let inside = 0;
          for (const f of fronts) inside = Math.max(inside, 1 - Math.min(1, Math.abs(along(f, api.screenX(L.x), L.y, api.t)) / (f.width / 2)));
          if (inside > 0.2 && fl.mode !== 'docked' && fl.mode !== 'jumping') fl.fadeTo = 1 - inside * 0.75;
          else if (fl.fadeTo < 1 && fl.mode !== 'docked' && fl.mode !== 'jumping') fl.fadeTo = 1;
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'over' || !fronts.length) return;
        const d = Number(p.density) || 0.8;
        for (const f of fronts) {
          const k = (frame.time - f.born) / f.dur;
          const reach = Math.hypot(api.width, api.height) + f.width * 2;
          const cx = api.width / 2 - Math.cos(f.ang) * (reach / 2) + Math.cos(f.ang) * reach * k;
          const cy = api.height / 2 - Math.sin(f.ang) * (reach / 2) + Math.sin(f.ang) * reach * k;
          const nx = Math.cos(f.ang);
          const ny = Math.sin(f.ang);
          // The haze: a soft band perpendicular to the wind.
          const g = ctx.createLinearGradient(cx - nx * f.width, cy - ny * f.width, cx + nx * f.width, cy + ny * f.width);
          g.addColorStop(0, hexRgba(color, 0));
          g.addColorStop(0.35, hexRgba(color, 0.12 * d));
          g.addColorStop(0.5, hexRgba(color, 0.22 * d));
          g.addColorStop(0.65, hexRgba(color, 0.12 * d));
          g.addColorStop(1, hexRgba(color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, api.width, api.height);
          // Driven streaks inside the band.
          ctx.strokeStyle = hexRgba(color, 0.35 * d);
          ctx.lineWidth = 1;
          ctx.beginPath();
          const n = Math.round(260 * d);
          const px = -ny;
          const py = nx;
          for (let i = 0; i < n; i++) {
            const h1 = Math.sin(i * 12.9898 + f.seed) * 43758.5453;
            const h2 = Math.sin(i * 78.233 + f.seed) * 12543.123;
            const u = (h1 - Math.floor(h1) - 0.5) * f.width * 1.4;
            const v = (h2 - Math.floor(h2) - 0.5) * reach;
            const drift = ((frame.time * (90 + (i % 7) * 20)) % 160) - 80;
            const sx = cx + nx * (u + drift) + px * v;
            const sy = cy + ny * (u + drift) + py * v;
            if (sx < -20 || sx > api.width + 20 || sy < -20 || sy > api.height + 20) continue;
            const len = 6 + (i % 5) * 4;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + nx * len, sy + ny * len);
          }
          ctx.stroke();
        }
      },
    };
  },
});
