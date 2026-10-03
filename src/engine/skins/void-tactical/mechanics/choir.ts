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
import { createBody, normalAt, seek, stepBody, type Body } from '../../../sim/bodies';
import type { MechanicApi } from './types';

/** Gravity wells that other mechanics (flocks) feel. Shared per world. */
const wells = new WeakMap<object, { x: number; y: number; r: number; k: number }[]>();
/** Wisps swallowed since the Mouth last looked (flocks count, the Mouth eats). */
const feedOf = (api: MechanicApi) => api.use('mouth-feed', () => ({ eaten: 0 }));
const wellsOf = (api: MechanicApi) => {
  let w = wells.get(api.world);
  if (!w) wells.set(api.world, (w = []));
  return w;
};

// ---- song ----------------------------------------------------------------------------------

registerMechanic({
  id: 'song',
  label: 'Singing stars',
  description: 'Hollow stars sing in harmonic rings; when a ring reaches another singer it answers, and the song cascades across the map.',
  schema: {
    period: { type: 'number', min: 3, max: 20, default: 8, label: 'Seconds between songs' },
    harmonics: { type: 'number', min: 2, max: 9, default: 5, step: 1, label: 'Harmonics' },
    reach: { type: 'number', min: 200, max: 1200, default: 700, label: 'How far it carries (px)' },
    cascade: { type: 'number', min: 0, max: 10, default: 5, step: 1, label: 'Longest chain of answers' },
  },
  create(api, p) {
    type Singer = { id: string; x: number; y: number; color: string; label: string };
    type Song = Singer & { born: number; k: number; chain: number; heard: Set<string> };
    /** An answer: a thread of light from the singer that was heard to the one that answers. */
    type Answer = { ax: number; ay: number; bx: number; by: number; at: number; color: string };
    const songs: Song[] = [];
    const answers: Answer[] = [];
    const struck = new Map<string, number>();
    const lastSang = new Map<string, number>();
    let next = api.t + 1.5;
    let count = 0;
    const speed = 70;
    const reach = Number(p.reach) || 700;
    const maxChain = Math.round(Number(p.cascade ?? 5));

    /** Who can sing: giants and mysteries, else systems; a star that has gone out is silent. */
    const singers = (): Singer[] => {
      const giants = allStructures(api.world).filter((s) => !s.z && (s.role === 'giant' || s.role === 'mystery') && api.onScreen(s.x, s.y, 120));
      const voices: Singer[] = giants.map((s) => ({ id: s.id, x: s.x, y: s.y, color: s.color ?? api.host.palette.accent, label: s.label }));
      for (const s of api.world.systems) if (!s.z && s.darkAt === undefined && api.onScreen(s.x, s.y, 80)) voices.push({ id: s.id, x: s.x, y: s.y, color: s.starColor, label: s.name });
      return voices;
    };

    const sing = (s: Singer, at: number, k: number, chain: number) => {
      songs.push({ ...s, born: at, k, chain, heard: new Set([s.id]) });
      lastSang.set(s.id, at);
    };

    return {
      update() {
        if (api.t >= next) {
          const list = singers();
          if (list.length) {
            const s = list[Math.floor(api.rng() * list.length)];
            sing(s, api.t, Math.max(2, Math.round(Number(p.harmonics) || 5) + Math.floor(api.rng() * 3) - 1), 0);
            if (count++ % 3 === 0) api.say(`THE CHOIR SINGS · ${s.label}`, s.x, s.y + 28, s.color, { priority: 'medium', duration: 4200 });
            api.emit({ type: 'song', x: s.x, y: s.y, weight: 0.35 });
          }
          next = api.t + (Number(p.period) || 8) * (0.7 + api.rng() * 0.6);
        }
        // Cascades: a ring that reaches another singer makes it answer, one harmonic higher.
        const voices = singers();
        for (const s of [...songs]) {
          const r = (api.t - s.born) * speed;
          if (r <= 0 || s.chain >= maxChain) continue;
          for (const v of voices) {
            if (s.heard.has(v.id)) continue;
            const d = Math.hypot(v.x - s.x, v.y - s.y);
            if (d > reach || r < d) continue;
            s.heard.add(v.id);
            if (api.t - (lastSang.get(v.id) ?? -99) < 6) continue;
            const delay = 0.5 + api.rng() * 0.7;
            sing(v, api.t + delay, s.k + 1, s.chain + 1);
            answers.push({ ax: s.x, ay: s.y, bx: v.x, by: v.y, at: api.t, color: v.color });
            if (s.chain + 1 >= 3) {
              api.say(`THE CHORUS ANSWERS · ${s.chain + 2} VOICES`, v.x, v.y - 30, v.color, { priority: 'high', duration: 4200 });
            }
            api.emit({ type: 'cascade', x: v.x, y: v.y, weight: Math.min(0.9, 0.35 + 0.12 * (s.chain + 1)), chain: s.chain + 1 });
          }
        }
        for (let i = answers.length - 1; i >= 0; i--) if (api.t - answers[i].at > 2.5) answers.splice(i, 1);
        for (let i = songs.length - 1; i >= 0; i--) if ((api.t - songs[i].born) * speed > reach + 120) songs.splice(i, 1);
        // Resonance: entities the wave front passes ring for a moment.
        const ents = [
          ...api.world.fleets.filter((f) => f.ships.length > 0).map((f) => ({ id: f.id, x: f.ships[0].x, y: f.ships[0].y })),
          ...allStructures(api.world).filter((s) => !s.z).map((s) => ({ id: s.id, x: s.x, y: s.y })),
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
        // Answers: a thread of light runs from the voice that was heard to the one answering.
        for (const a of answers) {
          const age = frame.time - a.at;
          const k = Math.min(1, age / 0.6);
          const fade = Math.max(0, 1 - age / 2.5);
          const ax = api.screenX(a.ax);
          const bx = api.screenX(a.bx);
          const mx = (ax + bx) / 2 - (a.by - a.ay) * 0.15;
          const my = (a.ay + a.by) / 2 + (bx - ax) * 0.15;
          ctx.strokeStyle = hexRgba(a.color, 0.5 * fade);
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(ax, a.ay);
          ctx.quadraticCurveTo(mx, my, ax + (bx - ax) * k, a.ay + (a.by - a.ay) * k);
          ctx.stroke();
          ctx.setLineDash([]);
        }
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
    const cap = Math.round(Number(p.size) || 48) * 2;
    // When the Mouth exhales, new lights burst out of it and join a flock.
    api.bus.on('exhale', (e) => {
      if (e.x === undefined || e.y === undefined || !flocks.length) return;
      const fl = flocks[Math.floor(api.rng() * flocks.length)];
      for (let i = 0; i < Number(e.count ?? 20) && fl.boids.length < cap; i++) {
        const a = api.rng() * Math.PI * 2;
        fl.boids.push({ x: e.x + Math.cos(a) * 8, y: e.y + Math.sin(a) * 8, vx: Math.cos(a) * speed * 1.4, vy: Math.sin(a) * speed * 1.4 });
      }
      fl.bloomAt = api.t;
    });

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
          // Lights the Mouth swallows feed it, and come back at the edge as new ones.
          let swallowed = 0;
          for (const b of fl.boids) {
            if (ws.some((w) => Math.hypot(w.x - b.x, w.y - b.y) < 6)) {
              b.x = v.left + api.rng() * api.width;
              b.y = api.rng() < 0.5 ? -10 : api.height + 10;
              swallowed++;
            }
          }
          if (swallowed) feedOf(api).eaten += swallowed;
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

// ---- the Mouth ------------------------------------------------------------------------------

/**
 * Anchor a tendril: its root stays fixed at (rx, ry) and the rest hangs from it toward
 * the head (one backward pass of FABRIK after the head has moved).
 */
function anchor(b: Body, rx: number, ry: number): void {
  const s = b.seg;
  const n = b.n;
  s[(n - 1) * 2] = rx;
  s[(n - 1) * 2 + 1] = ry;
  for (let i = n - 2; i >= 0; i--) {
    const dx = s[i * 2] - s[(i + 1) * 2];
    const dy = s[i * 2 + 1] - s[(i + 1) * 2 + 1];
    const d = Math.hypot(dx, dy) || 1;
    s[i * 2] = s[(i + 1) * 2] + (dx / d) * b.spacing;
    s[i * 2 + 1] = s[(i + 1) * 2 + 1] + (dy / d) * b.spacing;
  }
  b.x = s[0];
  b.y = s[1];
}

registerMechanic({
  id: 'maw',
  label: 'The Mouth',
  description: 'A living mouth: it drags lights into a lensed spiral, reaches for ships with tendrils, grows as it feeds, and now and then exhales wisps or a newborn star.',
  schema: {
    radius: { type: 'number', min: 80, max: 400, default: 220, label: 'Reach (px)' },
    strength: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Pull' },
    hunger: { type: 'number', min: 0, max: 2, default: 0.6, label: 'Ships taken per minute' },
    tendrils: { type: 'number', min: 0, max: 8, default: 4, step: 1, label: 'Tendrils' },
  },
  create(api, p) {
    const R0 = Number(p.radius) || 220;
    /** How fed it is: grows as it eats, shrinks when it exhales. */
    let size = 1;
    const reach = () => R0 * Math.sqrt(size);
    const motes: { a: number; r: number; w: number }[] = Array.from({ length: 90 }, () => ({ a: api.rng() * Math.PI * 2, r: api.rng() * R0, w: 0.4 + api.rng() * 0.8 }));
    let nextMeal = api.t + 20 + api.rng() * 20;
    let nextExhale = api.t + 40;
    let meal: { f: Fleet; r: number; a: number; dir: number; until: number } | null = null;
    const tendrils: Body[] = [];
    let lastSeen = -99;

    // The Mouth sits on a hazard structure. If none is in view for a while, one opens.
    const center = () => {
      const h = allStructures(api.world).filter((s) => !s.z && s.role === 'hazard' && api.onScreen(s.x, s.y, 60))[0];
      return h ? { x: h.x, y: h.y, label: h.label } : null;
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
          label: def?.label ?? 'THE MOUTH',
          role: 'hazard',
          art: def?.art ?? ['  .-.  ', ' (:@:) ', "  '-'  "],
          color: def?.color ?? '#818cf8',
          rarity: 'rare',
        });
        lastSeen = api.t;
        tendrils.length = 0;
      }
      return center();
    };

    /** Start pulling a ship in. */
    const take = (f: Fleet, c: { x: number; y: number; label: string }) => {
      const L = f.ships[0];
      const R = reach();
      meal = { f, r: Math.hypot(L.x - c.x, L.y - c.y), a: Math.atan2(L.y - c.y, L.x - c.x), dir: api.rng() < 0.5 ? 1 : -1, until: api.t + 7 };
      f.steer = (fl, d) => {
        if (!meal) return;
        meal.r = Math.max(2, meal.r - d * (12 + 40 * (1 - meal.r / R)));
        meal.a += (d * meal.dir * 90) / Math.max(10, meal.r);
        steerOrbit(fl.ships[0], c.x, c.y, meal.r, 60 + 90 * (1 - meal.r / R), meal.dir, 4, d);
      };
      api.say(`${f.callsign} · CAUGHT · ${c.label}`, L.x, L.y, L.color, { priority: 'high', followId: f.id });
      api.emit({ type: 'caught', x: L.x, y: L.y, weight: 0.8, follow: api.follow(f) });
    };


    return {
      update(dt) {
        const c = ensure();
        const ws = wellsOf(api);
        ws.length = 0;
        if (!c) return;
        // Wisps the flocks lost into it feed it a little.
        const feed = feedOf(api);
        size = Math.min(2.2, size + 0.004 * feed.eaten);
        feed.eaten = 0;
        const R = reach();
        ws.push({ x: c.x, y: c.y, r: R, k: Number(p.strength ?? 0.6) });
        for (const m of motes) {
          m.a += (dt * m.w * 60) / Math.max(12, m.r);
          m.r -= dt * (10 + 30 * (1 - m.r / R));
          if (m.r < 4) {
            m.r = R * (0.7 + api.rng() * 0.3);
            m.a = api.rng() * Math.PI * 2;
          }
        }
        // Tendrils: rooted at the Mouth, each reaching for the nearest ship in range.
        while (tendrils.length < Math.round(Number(p.tendrils ?? 4))) {
          const a = (tendrils.length / Math.max(1, Number(p.tendrils ?? 4))) * Math.PI * 2;
          const t = createBody('tendril', c.x + Math.cos(a) * 40, c.y + Math.sin(a) * 40, 14, 9 * Math.sqrt(size), a, tendrils.length + 1);
          t.data.home = a;
          tendrils.push(t);
        }
        const prey = api.world.fleets.filter((f) => f.ships[0] && !f.z && !f.steer && f.mode !== 'docked' && Math.hypot(f.ships[0].x - c.x, f.ships[0].y - c.y) < R * 1.25);
        for (const t of tendrils) {
          t.spacing = 9 * Math.sqrt(size);
          const target = prey.length ? prey[(t.id + Math.floor(api.t / 6)) % prey.length].ships[0] : null;
          const home = Number(t.data.home ?? 0) + Math.sin(api.t * 0.3 + t.id) * 0.8;
          const tx = target ? target.x : c.x + Math.cos(home) * R * 0.55;
          const ty = target ? target.y : c.y + Math.sin(home) * R * 0.55;
          seek(t, tx, ty, target ? 70 : 25, 2.2, dt);
          stepBody(t, dt, 0.4);
          anchor(t, c.x, c.y);
          // A tendril that touches a ship takes it, if the Mouth is hungry yet.
          if (target && !meal && api.t >= nextMeal && Math.hypot(t.x - target.x, t.y - target.y) < 14) {
            const f = prey.find((fl) => fl.ships[0] === target);
            if (f) {
              take(f, c);
              nextMeal = api.t + (60 / Math.max(0.05, Number(p.hunger ?? 0.6))) * (0.6 + api.rng() * 0.8);
            }
          }
        }
        // Hunger: now and then it takes whatever strays too close, tendril or not.
        if (!meal && api.t >= nextMeal) {
          const f = prey[0];
          if (f) take(f, c);
          nextMeal = api.t + (60 / Math.max(0.05, Number(p.hunger ?? 0.6))) * (0.6 + api.rng() * 0.8);
        }
        if (meal && (meal.r < 6 || api.t > meal.until)) {
          const f = meal.f;
          if (f.ships.length) {
            api.fx.flash(c.x, c.y, '#ffffff', 40, 0.5);
            api.fx.ring(c.x, c.y, f.ships[0].color, 90, 1.2, 4, 1.5);
            api.say(`${f.callsign} · TAKEN`, c.x, c.y + 24, f.ships[0].color, { priority: 'high' });
            size = Math.min(2.2, size + 0.15 + 0.05 * f.ships.length);
          }
          f.mode = 'gone';
          meal = null;
        }
        // Fed enough, it exhales: a burst of new wisps, or (more rarely) a newborn star.
        if (size > 1.3 && api.t >= nextExhale) {
          size -= 0.35;
          api.fx.flash(c.x, c.y, '#e9d5ff', 80, 1.2);
          api.fx.ring(c.x, c.y, '#c4b5fd', R * 1.4, 2.4, 10, 2);
          if (api.rng() < 0.35) {
            const a = api.rng() * Math.PI * 2;
            const ns = generateSingleSystem(c.x + Math.cos(a) * R * 0.9, c.y + Math.sin(a) * R * 0.6, api.rng, api.host.palette, api.pack, Math.floor(api.rng() * 1000));
            api.world.systems.push(ns);
            api.fx.ring(ns.x, ns.y, ns.starColor, 120, 2, 4, 2);
            api.say(`THE MOUTH EXHALES · A STAR IS BORN · ${ns.name}`, ns.x, ns.y + 30, ns.starColor, { priority: 'high', duration: 6000 });
            api.emit({ type: 'starbirth', x: ns.x, y: ns.y, weight: 0.9 });
          } else {
            api.say('THE MOUTH EXHALES', c.x, c.y - R * 0.4, '#e9d5ff', { priority: 'high', duration: 4500 });
            api.emit({ type: 'exhale', x: c.x, y: c.y, weight: 0.7, count: 30 });
          }
          nextExhale = api.t + 45 + api.rng() * 40;
        }
      },
      draw(ctx, pass, frame) {
        const c = center();
        if (!c) return;
        const x = api.screenX(c.x);
        const R = reach();
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
          const core = 22 + 10 * size;
          const g = ctx.createRadialGradient(x, c.y, 0, x, c.y, core);
          g.addColorStop(0, 'rgba(0,0,0,0.95)');
          g.addColorStop(0.7, 'rgba(0,0,0,0.6)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, c.y, core, 0, Math.PI * 2);
          ctx.fill();
          // Teeth: a ring of inward hooks, turning slowly, breathing with its size.
          ctx.strokeStyle = hexRgba('#e9d5ff', 0.45);
          ctx.beginPath();
          const n = 18;
          const tr = core + 6 + Math.sin(frame.time * 1.3) * 2;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 - frame.time * 0.15;
            ctx.moveTo(x + Math.cos(a) * tr, c.y + Math.sin(a) * tr);
            ctx.lineTo(x + Math.cos(a + 0.12) * (tr - 7), c.y + Math.sin(a + 0.12) * (tr - 7));
          }
          ctx.stroke();
          ctx.restore();
        } else if (pass === 'mid') {
          ctx.save();
          // Tendrils: tapered, dark, outlined, with suckers along the underside.
          for (const t of tendrils) {
            for (let i = 0; i < t.n - 1; i++) {
              const u = i / (t.n - 1);
              ctx.strokeStyle = `rgba(6,2,14,0.9)`;
              ctx.lineWidth = 1.5 + u * 7;
              ctx.beginPath();
              ctx.moveTo(api.screenX(t.seg[i * 2]), t.seg[i * 2 + 1]);
              ctx.lineTo(api.screenX(t.seg[(i + 1) * 2]), t.seg[(i + 1) * 2 + 1]);
              ctx.stroke();
            }
            ctx.strokeStyle = hexRgba('#a78bfa', 0.55);
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(api.screenX(t.seg[0]), t.seg[1]);
            for (let i = 1; i < t.n; i++) ctx.lineTo(api.screenX(t.seg[i * 2]), t.seg[i * 2 + 1]);
            ctx.stroke();
            ctx.fillStyle = hexRgba('#f0abfc', 0.6);
            for (let i = 2; i < t.n - 1; i += 2) {
              const [nx, ny] = normalAt(t, i);
              const w = (1.5 + (i / (t.n - 1)) * 7) / 2;
              ctx.fillRect(api.screenX(t.seg[i * 2] + nx * w) - 0.75, t.seg[i * 2 + 1] + ny * w - 0.75, 1.5, 1.5);
            }
          }
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
          const vis = api.world.systems.filter((s) => !s.z && api.onScreen(s.x, s.y, 120));
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
