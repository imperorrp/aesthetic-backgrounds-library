/**
 * Stranger mechanics, built for the Choir but usable anywhere.
 *
 * - `song`: giant structures (or stars) sing in harmonic rings that ripple outward;
 *   everything the wave passes resonates.
 * - `flocks`: murmurations of small lights flying as boids instead of formations.
 * - `maw`: a hazard that pulls lights into a lensed spiral and, now and then, a ship.
 * - `cartography`: scouts leave luminous chart lines that linger, and the chart
 *   itself changes: a system goes missing and another appears.
 */
import type { Fleet, StarSystem } from '../types';
import { generateSingleSystem } from '../generators';
import { allStructures } from '../fleets';
import { hexRgba } from '../renderers/utils';
import { registerMechanic, steerOrbit } from './types';
import type { MechanicApi } from './types';

/** Gravity wells that other mechanics (flocks) feel. Shared per world. */
const wells = new WeakMap<object, { x: number; y: number; r: number; k: number }[]>();
const wellsOf = (api: MechanicApi) => {
  let w = wells.get(api.world);
  if (!w) wells.set(api.world, (w = []));
  return w;
};

// ---- song ----------------------------------------------------------------------------------

registerMechanic({
  id: 'song',
  label: 'Singing stars',
  description: 'Giant structures sing in harmonic rings that ripple across the map; everything the wave passes resonates.',
  schema: {
    period: { type: 'number', min: 3, max: 20, default: 8, label: 'Seconds between songs' },
    harmonics: { type: 'number', min: 2, max: 9, default: 5, step: 1, label: 'Harmonics' },
    reach: { type: 'number', min: 200, max: 1200, default: 700, label: 'How far it carries (px)' },
  },
  create(api, p) {
    type Song = { x: number; y: number; born: number; color: string; k: number; label: string };
    const songs: Song[] = [];
    const struck = new Map<string, number>();
    let next = api.t + 1.5;
    let count = 0;
    const speed = 70;
    const reach = Number(p.reach) || 700;

    const singers = () => {
      const giants = allStructures(api.world).filter((s) => (s.role === 'giant' || s.role === 'mystery') && api.onScreen(s.x, s.y, 120));
      if (giants.length) return giants.map((s) => ({ x: s.x, y: s.y, color: s.color ?? api.host.palette.accent, label: s.label }));
      return api.world.systems.filter((s) => api.onScreen(s.x, s.y, 80)).map((s) => ({ x: s.x, y: s.y, color: s.starColor, label: s.name }));
    };

    return {
      update() {
        if (api.t >= next) {
          const list = singers();
          if (list.length) {
            const s = list[Math.floor(api.rng() * list.length)];
            songs.push({ ...s, born: api.t, k: Math.max(2, Math.round(Number(p.harmonics) || 5) + Math.floor(api.rng() * 3) - 1) });
            if (count++ % 3 === 0) api.say(`THE CHOIR SINGS · ${s.label}`, s.x, s.y + 28, s.color, { priority: 'medium', duration: 4200 });
            // Sometimes a second voice answers.
            if (list.length > 1 && api.rng() < 0.35) {
              const o = list.find((x) => x !== s)!;
              songs.push({ ...o, born: api.t + 0.8, k: songs[songs.length - 1].k + 1 });
            }
          }
          next = api.t + (Number(p.period) || 8) * (0.7 + api.rng() * 0.6);
        }
        for (let i = songs.length - 1; i >= 0; i--) if ((api.t - songs[i].born) * speed > reach + 120) songs.splice(i, 1);
        // Resonance: entities the wave front passes ring for a moment.
        const ents = [
          ...api.world.fleets.filter((f) => f.ships.length > 0).map((f) => ({ id: f.id, x: f.ships[0].x, y: f.ships[0].y })),
          ...allStructures(api.world).map((s) => ({ id: s.id, x: s.x, y: s.y })),
        ];
        for (const s of songs) {
          const r = (api.t - s.born) * speed;
          if (r < 0) continue;
          for (const e of ents) {
            if (Math.abs(Math.hypot(e.x - s.x, e.y - s.y) - r) < 5 && api.t - (struck.get(e.id) ?? -9) > 2) struck.set(e.id, api.t);
          }
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'over') return;
        ctx.save();
        ctx.lineWidth = 1;
        for (const s of songs) {
          const age = frame.time - s.born;
          if (age < 0) continue;
          const x0 = api.screenX(s.x);
          for (let ring = 0; ring < 3; ring++) {
            const r = age * speed - ring * 26;
            if (r <= 4) continue;
            const fade = Math.max(0, 1 - r / reach);
            ctx.strokeStyle = hexRgba(s.color, 0.42 * fade * (1 - ring * 0.25));
            ctx.beginPath();
            const steps = Math.max(48, Math.round(r / 3));
            for (let i = 0; i <= steps; i++) {
              const a = (i / steps) * Math.PI * 2;
              const rr = r + Math.sin(a * s.k + frame.time * 2.2 + ring) * (3 + 5 * fade);
              const px = x0 + Math.cos(a) * rr;
              const py = s.y + Math.sin(a) * rr;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();
          }
        }
        // Resonating things ring softly.
        for (const [id, at] of struck) {
          const age = frame.time - at;
          if (age > 1) continue;
          const f = api.world.fleets.find((fl) => fl.id === id);
          const st = f ? null : allStructures(api.world).find((x) => x.id === id);
          const pos = f ? f.ships[0] : st;
          if (!pos) continue;
          const c = f ? f.ships[0].color : st?.color ?? '#ffffff';
          ctx.strokeStyle = hexRgba(c, 0.8 * (1 - age));
          ctx.beginPath();
          ctx.arc(api.screenX(pos.x), pos.y, 6 + age * 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
});

// ---- flocks ----------------------------------------------------------------------------------

registerMechanic({
  id: 'flocks',
  label: 'Murmurations',
  description: 'Flocks of small lights flying as boids: cohesion, alignment, and separation, wheeling around an unseen lead.',
  schema: {
    flocks: { type: 'number', min: 1, max: 6, default: 3, step: 1, label: 'Flocks' },
    size: { type: 'number', min: 10, max: 120, default: 48, step: 1, label: 'Lights per flock' },
    speed: { type: 'number', min: 20, max: 160, default: 70, label: 'Speed' },
    name: { type: 'string', default: 'WISPS', label: 'What they are called' },
  },
  create(api, p) {
    type Boid = { x: number; y: number; vx: number; vy: number };
    type Flock = { boids: Boid[]; color: string; ax: number; ay: number; fx: number; fy: number; phase: number; bloomAt: number };
    const flocks: Flock[] = [];
    const speed = Number(p.speed) || 70;
    const name = String(p.name || 'WISPS').toUpperCase();
    const make = (i: number): Flock => {
      const v = api.view();
      const cx = v.left + api.width * (0.2 + api.rng() * 0.6);
      const cy = api.height * (0.2 + api.rng() * 0.6);
      const color = api.pack.factions[i % Math.max(1, api.pack.factions.length)]?.color ?? api.host.palette.accent;
      const n = Math.round(Number(p.size) || 48);
      return {
        boids: Array.from({ length: n }, () => ({ x: cx + (api.rng() - 0.5) * 80, y: cy + (api.rng() - 0.5) * 80, vx: (api.rng() - 0.5) * speed, vy: (api.rng() - 0.5) * speed })),
        color,
        ax: 0.2 + api.rng() * 0.6,
        ay: 0.2 + api.rng() * 0.6,
        fx: 0.03 + api.rng() * 0.05,
        fy: 0.04 + api.rng() * 0.05,
        phase: api.rng() * 10,
        bloomAt: -99,
      };
    };
    for (let i = 0; i < Math.round(Number(p.flocks) || 3); i++) flocks.push(make(i));
    let nextBloom = api.t + 10 + api.rng() * 10;

    return {
      update(dt) {
        const v = api.view();
        const ws = wellsOf(api);
        for (const fl of flocks) {
          // An unseen lead wanders a Lissajous path across the screen.
          const tx = v.left + api.width * (0.5 + 0.42 * Math.sin(api.t * fl.fx * 2 + fl.phase) * fl.ax * 1.6);
          const ty = api.height * (0.5 + 0.4 * Math.sin(api.t * fl.fy * 2 + fl.phase * 1.7) * fl.ay * 1.6);
          let mx = 0, my = 0, mvx = 0, mvy = 0;
          for (const b of fl.boids) {
            mx += b.x; my += b.y; mvx += b.vx; mvy += b.vy;
          }
          const n = fl.boids.length || 1;
          mx /= n; my /= n; mvx /= n; mvy /= n;
          for (const b of fl.boids) {
            let sx = 0, sy = 0;
            for (const o of fl.boids) {
              if (o === b) continue;
              const dx = b.x - o.x;
              const dy = b.y - o.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 144 && d2 > 0.01) {
                sx += dx / d2;
                sy += dy / d2;
              }
            }
            let ax = (mx - b.x) * 0.35 + (mvx - b.vx) * 0.6 + sx * 260 + (tx - b.x) * 0.25;
            let ay = (my - b.y) * 0.35 + (mvy - b.vy) * 0.6 + sy * 260 + (ty - b.y) * 0.25;
            for (const w of ws) {
              const dx = w.x - b.x;
              const dy = w.y - b.y;
              const d = Math.hypot(dx, dy) || 1;
              if (d < w.r) {
                ax += (dx / d) * w.k * (1 - d / w.r) * 600;
                ay += (dy / d) * w.k * (1 - d / w.r) * 600;
              }
            }
            b.vx += ax * dt;
            b.vy += ay * dt;
            const sp = Math.hypot(b.vx, b.vy) || 1;
            const clamp = Math.max(speed * 0.5, Math.min(speed * 1.4, sp));
            b.vx = (b.vx / sp) * clamp;
            b.vy = (b.vy / sp) * clamp;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
          }
          // Lights the maw swallowed come back at the edge, as new ones.
          for (const b of fl.boids) {
            if (ws.some((w) => Math.hypot(w.x - b.x, w.y - b.y) < 6)) {
              b.x = v.left + api.rng() * api.width;
              b.y = api.rng() < 0.5 ? -10 : api.height + 10;
            }
          }
        }
        if (api.t >= nextBloom) {
          const fl = flocks[Math.floor(api.rng() * flocks.length)];
          if (fl) {
            fl.bloomAt = api.t;
            const c = fl.boids[0];
            if (c) api.say(`THE ${name} ARE SINGING`, c.x, c.y, fl.color, { priority: 'medium' });
          }
          nextBloom = api.t + 18 + api.rng() * 20;
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'mid') return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const fl of flocks) {
          const bloom = Math.max(0, 1 - (frame.time - fl.bloomAt) / 2.5);
          ctx.strokeStyle = hexRgba(fl.color, 0.45 + 0.4 * bloom);
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (const b of fl.boids) {
            const x = api.screenX(b.x);
            const sp = Math.hypot(b.vx, b.vy) || 1;
            ctx.moveTo(x, b.y);
            ctx.lineTo(x - (b.vx / sp) * 5, b.y - (b.vy / sp) * 5);
          }
          ctx.stroke();
          ctx.fillStyle = hexRgba(fl.color, 0.85 + 0.15 * bloom);
          for (const b of fl.boids) ctx.fillRect(api.screenX(b.x) - 1, b.y - 1, 2 + bloom * 2, 2 + bloom * 2);
        }
        ctx.restore();
      },
    };
  },
});

// ---- maw ------------------------------------------------------------------------------------

registerMechanic({
  id: 'maw',
  label: 'The maw',
  description: 'A hazard that drags lights into a lensed spiral, and now and then takes a whole ship.',
  schema: {
    radius: { type: 'number', min: 80, max: 400, default: 220, label: 'Reach (px)' },
    strength: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Pull' },
    hunger: { type: 'number', min: 0, max: 2, default: 0.6, label: 'Ships taken per minute' },
  },
  create(api, p) {
    const R = Number(p.radius) || 220;
    const motes: { a: number; r: number; w: number }[] = Array.from({ length: 90 }, () => ({ a: api.rng() * Math.PI * 2, r: api.rng() * R, w: 0.4 + api.rng() * 0.8 }));
    let nextMeal = api.t + 20 + api.rng() * 20;
    let meal: { f: Fleet; r: number; a: number; dir: number; until: number } | null = null;
    // The maw sits on a hazard structure. If none is in view for a while, one opens.
    let lastSeen = -99;
    const center = () => {
      const h = allStructures(api.world).filter((s) => s.role === 'hazard' && api.onScreen(s.x, s.y, 60))[0];
      if (h) return { x: h.x, y: h.y, label: h.label };
      return null;
    };
    const ensure = () => {
      const c = center();
      if (c) {
        lastSeen = api.t;
        return c;
      }
      if (api.t - lastSeen > 6) {
        const def = api.pack.structures.find((s) => s.role === 'hazard');
        const v = api.view();
        api.addStructure({
          x: v.right - api.width * (0.2 + api.rng() * 0.15),
          y: api.height * (0.3 + api.rng() * 0.4),
          label: def?.label ?? 'THE MAW',
          role: 'hazard',
          art: def?.art ?? ['  .-.  ', ' (:@:) ', "  '-'  "],
          color: def?.color ?? '#818cf8',
          rarity: 'rare',
        });
        lastSeen = api.t;
      }
      return center();
    };
    return {
      update(dt) {
        const c = ensure();
        const ws = wellsOf(api);
        ws.length = 0;
        if (!c) return;
        ws.push({ x: c.x, y: c.y, r: R, k: Number(p.strength ?? 0.6) });
        for (const m of motes) {
          m.a += (dt * m.w * 60) / Math.max(12, m.r);
          m.r -= dt * (10 + 30 * (1 - m.r / R));
          if (m.r < 4) {
            m.r = R * (0.7 + api.rng() * 0.3);
            m.a = api.rng() * Math.PI * 2;
          }
        }
        // Now and then a ship strays too close and is taken.
        if (!meal && api.t >= nextMeal) {
          const near = api.world.fleets.filter((f) => f.ships.length > 0 && !f.steer && f.mode !== 'docked' && Math.hypot(f.ships[0].x - c.x, f.ships[0].y - c.y) < R * 1.4);
          const f = near[0];
          if (f) {
            const L = f.ships[0];
            meal = { f, r: Math.hypot(L.x - c.x, L.y - c.y), a: Math.atan2(L.y - c.y, L.x - c.x), dir: api.rng() < 0.5 ? 1 : -1, until: api.t + 7 };
            f.steer = (fl, d) => {
              if (!meal) return;
              meal.r = Math.max(2, meal.r - d * (12 + 40 * (1 - meal.r / R)));
              meal.a += (d * meal.dir * 90) / Math.max(10, meal.r);
              steerOrbit(fl.ships[0], c.x, c.y, meal.r, 60 + 90 * (1 - meal.r / R), meal.dir, 4, d);
            };
            api.say(`${f.callsign} · CAUGHT · ${c.label}`, L.x, L.y, L.color, { priority: 'high', followId: f.id });
          }
          nextMeal = api.t + (60 / Math.max(0.05, Number(p.hunger ?? 0.6))) * (0.6 + api.rng() * 0.8);
        }
        if (meal && (meal.r < 6 || api.t > meal.until)) {
          const f = meal.f;
          if (f.ships.length) {
            api.fx.flash(c.x, c.y, '#ffffff', 40, 0.5);
            api.fx.ring(c.x, c.y, f.ships[0].color, 90, 1.2, 4, 1.5);
            api.say(`${f.callsign} · TAKEN`, c.x, c.y + 24, f.ships[0].color, { priority: 'high' });
          }
          f.mode = 'gone';
          meal = null;
        }
      },
      draw(ctx, pass, frame) {
        const c = center();
        if (!c) return;
        const x = api.screenX(c.x);
        if (pass === 'under') {
          // Lensing: rings that flow inward, slightly squeezed.
          ctx.save();
          ctx.lineWidth = 1;
          for (let i = 0; i < 6; i++) {
            const k = (i / 6 + frame.time * 0.06) % 1;
            const r = R * (1 - k);
            ctx.strokeStyle = hexRgba(api.host.palette.accent, 0.18 * k);
            ctx.setLineDash([2, 5]);
            ctx.lineDashOffset = -frame.time * 10;
            ctx.beginPath();
            ctx.ellipse(x, c.y, r, r * 0.86, frame.time * 0.05, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          const g = ctx.createRadialGradient(x, c.y, 0, x, c.y, 26);
          g.addColorStop(0, 'rgba(0,0,0,0.95)');
          g.addColorStop(0.7, 'rgba(0,0,0,0.6)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, c.y, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (pass === 'mid') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (const m of motes) {
            const k = 1 - m.r / R;
            ctx.fillStyle = hexRgba(api.host.palette.ink, 0.15 + 0.6 * k);
            const sx = x + Math.cos(m.a) * m.r;
            const sy = c.y + Math.sin(m.a) * m.r * 0.86;
            // Stretched along the orbit as it falls.
            ctx.fillRect(sx, sy, 1 + k * 2.5, 1);
          }
          ctx.restore();
        }
      },
    };
  },
});

// ---- cartography ------------------------------------------------------------------------------

registerMechanic({
  id: 'cartography',
  label: 'Living chart',
  description: 'Scouts leave luminous chart lines that linger, and the chart changes: systems go missing and others appear.',
  schema: {
    linger: { type: 'number', min: 10, max: 120, default: 55, label: 'How long chart lines last (s)' },
    scouts: { type: 'number', min: 0, max: 6, default: 3, step: 1, label: 'Scouts charting' },
    changes: { type: 'number', min: 0, max: 3, default: 0.8, label: 'Chart changes per minute' },
  },
  create(api, p) {
    const lines = new Map<string, { pts: number[]; color: string }>();
    const missing: { x: number; y: number; at: number; name: string }[] = [];
    let nextChange = api.t + 20 + api.rng() * 20;
    let nextScout = api.t + 1;
    const linger = Number(p.linger) || 55;

    return {
      update() {
        // Keep scouts in the air.
        if (api.t >= nextScout) {
          const scouts = api.world.fleets.filter((f) => f.cls === 'scout' && f.mode !== 'gone').length;
          if (scouts < (Number(p.scouts ?? 3) || 0)) {
            const v = api.view();
            const y = 60 + api.rng() * (api.height - 120);
            api.spawnFleet({ x: v.right + 30, y, vx: -40, vy: 0 }, { cls: 'scout', purpose: 'survey' });
          }
          nextScout = api.t + 3;
        }
        for (const f of api.world.fleets) {
          if (f.cls !== 'scout') continue;
          let l = lines.get(f.id);
          if (!l) lines.set(f.id, (l = { pts: [], color: f.ships[0].color }));
          const L = f.ships[0];
          const n = l.pts.length;
          if (!n || Math.hypot(l.pts[n - 3] - L.x, l.pts[n - 2] - L.y) > 10) l.pts.push(L.x, L.y, api.t);
        }
        for (const [id, l] of lines) {
          while (l.pts.length && api.t - l.pts[2] > linger) l.pts.splice(0, 3);
          if (!l.pts.length && !api.world.fleets.some((f) => f.id === id)) lines.delete(id);
        }
        // The chart changes.
        if (api.t >= nextChange && Number(p.changes ?? 0.8) > 0) {
          const vis = api.world.systems.filter((s) => api.onScreen(s.x, s.y, 120));
          if (vis.length > 1) {
            const s: StarSystem = vis[Math.floor(api.rng() * vis.length)];
            missing.push({ x: s.x, y: s.y, at: api.t, name: s.name });
            api.world.systems.splice(api.world.systems.indexOf(s), 1);
            const v = api.view();
            const ns = generateSingleSystem(v.left + api.width * (0.15 + api.rng() * 0.7), api.height * (0.15 + api.rng() * 0.7), api.rng, api.host.palette, api.pack, Math.floor(api.rng() * 1000));
            api.world.systems.push(ns);
            api.fx.ring(ns.x, ns.y, ns.starColor, 80, 1.6, 2, 1);
            api.say('THE CHART HAS CHANGED', s.x, s.y + 26, api.host.palette.accent, { priority: 'high', duration: 5000 });
          }
          nextChange = api.t + (60 / Number(p.changes)) * (0.7 + api.rng() * 0.6);
        }
        for (let i = missing.length - 1; i >= 0; i--) if (api.t - missing[i].at > 18) missing.splice(i, 1);
      },
      draw(ctx, pass, frame, board) {
        if (pass !== 'under') return;
        ctx.save();
        ctx.lineCap = 'round';
        for (const l of lines.values()) {
          const n = l.pts.length / 3;
          for (let i = 1; i < n; i++) {
            const age = frame.time - l.pts[i * 3 + 2];
            const a = Math.max(0, 1 - age / linger);
            ctx.strokeStyle = hexRgba(l.color, 0.32 * a);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(api.screenX(l.pts[i * 3 - 3]), l.pts[i * 3 - 2]);
            ctx.lineTo(api.screenX(l.pts[i * 3]), l.pts[i * 3 + 1]);
            ctx.stroke();
            if (i % 6 === 0) {
              ctx.fillStyle = hexRgba(l.color, 0.5 * a);
              ctx.fillRect(api.screenX(l.pts[i * 3]) - 1, l.pts[i * 3 + 1] - 1, 2, 2);
            }
          }
        }
        for (const m of missing) {
          const age = frame.time - m.at;
          const a = Math.min(1, age) * Math.max(0, 1 - age / 18);
          const x = api.screenX(m.x);
          ctx.strokeStyle = hexRgba(api.host.palette.ink, 0.45 * a);
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.arc(x, m.y, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          board?.add({ text: `${m.name} · MISSING`, x, y: m.y, offset: 18, color: api.host.palette.ink, alpha: 0.7 * a, font: '9px "Syne Mono", ui-monospace, monospace', priority: 6, spots: ['below', 'above'] });
        }
        ctx.restore();
      },
    };
  },
});
