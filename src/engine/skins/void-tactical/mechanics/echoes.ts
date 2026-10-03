/**
 * Echoes: "the same hour, twice." Now and then a circle of the map replays what happened
 * there a few seconds ago: ghost ships fly their old courses again, split into two
 * colors like a badly tuned signal, stuttering at four frames a second like old film.
 *
 * Built on `sim/history.ts`: every quarter second the mechanic records where every ship
 * is; an echo plays those records back inside its circle.
 */
import type { Ship } from '../types';
import type { ShipClass } from '../universe';
import { drawShip } from '../ships';
import { createHistory } from '../../../sim/history';
import { hexRgba } from '../renderers/utils';
import { registerMechanic } from './types';

registerMechanic({
  id: 'echoes',
  label: 'Echoes',
  description: '"The same hour, twice": a circle of the map replays its last seconds as ghost ships, out of tune and stuttering.',
  schema: {
    every: { type: 'number', min: 15, max: 240, default: 55, label: 'Seconds between echoes' },
    radius: { type: 'number', min: 100, max: 420, default: 240, label: 'Size of the echo (px)' },
    lag: { type: 'number', min: 3, max: 14, default: 9, label: 'How far back it reaches (s)' },
  },
  create(api, p) {
    const history = createHistory(72, 0.25);
    const R = Number(p.radius) || 240;
    const lag = Number(p.lag) || 9;
    let echo: { x: number; y: number; t0: number; dur: number } | null = null;
    let next = api.t + Math.max(lag + 4, 14 + api.rng() * 14);

    const begin = () => {
      // Where something happened recently, so there is something to see again.
      const recent = api.bus
        .since(api.t - lag - 4)
        .filter((e) => e.x !== undefined && e.y !== undefined && e.type !== 'say' && api.onScreen(e.x, e.y, 120));
      const pick = recent.length ? recent[Math.floor(api.rng() * recent.length)] : null;
      const busy = api.world.fleets.filter((f) => f.ships[0] && !f.z && api.onScreen(f.ships[0].x, f.ships[0].y, 150));
      const at = pick ?? (busy.length ? busy[Math.floor(api.rng() * busy.length)].ships[0] : null);
      if (!at || at.x === undefined || at.y === undefined) return;
      echo = { x: at.x, y: at.y, t0: api.t, dur: lag + 1 };
      api.say('THE SAME HOUR, TWICE', at.x, at.y - R * 0.55, api.host.palette.accent, { priority: 'high', duration: 4600 });
      api.emit({ type: 'echo', x: at.x, y: at.y, weight: 0.6 });
    };

    return {
      update() {
        history.record(
          api.t,
          api.world.fleets.flatMap((f) => (f.z > 0.1 ? [] : f.ships.map((s: Ship) => ({ x: s.x, y: s.y, a: s.heading, kind: s.cls, color: s.color })))),
        );
        if (echo && api.t > echo.t0 + echo.dur) echo = null;
        if (!echo && api.t >= next) {
          begin();
          next = api.t + (Number(p.every) || 55) * (0.7 + api.rng() * 0.6);
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'over' || !echo) return;
        const age = frame.time - echo.t0;
        const fade = Math.min(1, age / 0.8) * Math.min(1, (echo.dur - age) / 1.2);
        if (fade <= 0) return;
        const cx = api.screenX(echo.x);
        const cy = echo.y;
        ctx.save();
        const accent = api.host.palette.accent;
        // The circle: a darker, tinted inside, a bright rim, and a dashed ring turning outside it.
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${0.32 * fade})`;
        ctx.fill();
        ctx.fillStyle = hexRgba(accent, 0.07 * fade);
        ctx.fill();
        ctx.strokeStyle = hexRgba(accent, 0.6 * fade);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.strokeStyle = hexRgba(accent, 0.3 * fade);
        ctx.setLineDash([2, 9]);
        ctx.lineDashOffset = -frame.time * 18;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.clip();
        // Film: lines, and a few specks of dust that change every frame of the old film.
        ctx.fillStyle = `rgba(255,255,255,${0.05 * fade})`;
        for (let y = cy - R; y < cy + R; y += 3) ctx.fillRect(cx - R, Math.round(y), R * 2, 1);
        const fr = Math.floor(frame.time * 4);
        for (let i = 0; i < 24; i++) {
          const h = Math.sin(fr * 91.7 + i * 12.9898) * 43758.5453;
          const u = h - Math.floor(h);
          const v = (u * 7.31) % 1;
          ctx.fillStyle = `rgba(255,255,255,${0.25 * fade})`;
          ctx.fillRect(cx - R + u * R * 2, cy - R + v * R * 2, 1.5, 1.5);
        }
        // Ghosts: the past replayed, split in two colors, smeared with where they just were.
        const jx = (fr % 3) - 1;
        const at = echo.t0 - lag + age;
        for (const [back, a] of [[1, 0.18], [0.5, 0.3], [0, 0.6]] as const) {
          const snap = history.near(at - back);
          if (!snap) continue;
          for (const s of snap.items) {
            if (Math.hypot(s.x - echo.x, s.y - echo.y) > R) continue;
            const x = api.screenX(s.x) + jx;
            drawShip(ctx, s.kind as ShipClass, x - 2, s.y, s.a, '#f472b6', a * fade, 0.6, 0.5, 1.1);
            drawShip(ctx, s.kind as ShipClass, x + 2, s.y, s.a, '#67e8f9', a * fade, 0.6, 0.5, 1.1);
          }
        }
        ctx.restore();
        // How far back this is.
        ctx.font = '9px "Syne Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = hexRgba(api.host.palette.accent, 0.6 * fade);
        ctx.fillText(`−${String(Math.round(lag)).padStart(2, '0')}S`, Math.round(cx), Math.round(cy + R + 12));
      },
    };
  },
});
