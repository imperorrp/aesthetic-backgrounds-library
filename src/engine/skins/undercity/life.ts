/**
 * Life in the city: everything that moves but is not the net.
 *
 *   lanes    flying cars at three altitudes and depths: cars, cabs, haulers, police
 *   rail     a maglev line across the mid layer; a train passes now and then
 *   crowd    pedestrians on the near street, some under neon umbrellas
 *   steam    vents breathing on the street
 *   rain     three depths of streaks and splashes; drifts from drizzle to downpour
 *   storm    lightning in heavy rain, and thunder a moment later
 *   police   units sent to a building (a flatlined runner) that hover with searchlights
 *
 * Positions live in their layer's space (x scrolls with that layer's parallax); rain and
 * lightning are in screen space.
 */
import type { Rng } from '../../rng';
import type { Noise2D } from '../../noise';
import { hexA } from '../instruments/kit';
import { LAYERS, NEON, type Building, type City } from './world';

const LANES = [
  { y: 0.2, k: 0.28, s: 0.75 },
  { y: 0.33, k: 0.55, s: 1.05 },
  { y: 0.47, k: 0.8, s: 1.35 },
];
type CarKind = 'car' | 'cab' | 'hauler' | 'police';
type Car = { lane: number; x: number; dy: number; v: number; kind: CarKind };
type Train = { x: number; v: number; cars: number; announced: boolean };
type Person = { x: number; v: number; h: number; umbrella: string | null; phase: number };
type Puff = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number };
type Drop = { x: number; y: number; speed: number; len: number; depth: number };
type Splash = { x: number; t0: number };
type Unit = { L: number; x: number; y: number; target: { b: Building; ox: number; oy: number }; phase: 'in' | 'hover' | 'out'; until: number; sweep: number };
type Bolt = { t0: number; pts: number[] };

export type LifeOptions = { traffic: number; crowd: number; rain: number };

export type Life = {
  update(dt: number): void;
  drawSky(ctx: CanvasRenderingContext2D): void;
  drawLane(ctx: CanvasRenderingContext2D, lane: number): void;
  drawRail(ctx: CanvasRenderingContext2D): void;
  drawStreet(ctx: CanvasRenderingContext2D): void;
  drawPolice(ctx: CanvasRenderingContext2D): void;
  drawRain(ctx: CanvasRenderingContext2D): void;
  /** Send police to a point on a building. */
  dispatch(b: Building, ox: number, oy: number): void;
  readonly wet: number;
  counts(): Record<string, number>;
};

export function createLife(city: City, rng: Rng, noise: Noise2D, o: LifeOptions, reduced: () => boolean): Life {
  const cars: Car[] = [];
  const trains: Train[] = [];
  const people: Person[] = [];
  const puffs: Puff[] = [];
  const drops: Drop[] = [];
  const splashes: Splash[] = [];
  const units: Unit[] = [];
  let bolt: Bolt | null = null;
  let flash = 0;
  let wet = 0.5;
  let nextTrain = 6 + rng() * 10;
  let nextBolt = 20 + rng() * 30;
  let thunderAt = -1;
  let thunderX = 0;
  const railY = () => city.H * 0.6;

  const laneX = (lane: number) => city.cam * LANES[lane].k;
  const newCar = (lane: number, anywhere: boolean): Car => {
    const dir = rng() < 0.5 ? -1 : 1;
    const r = rng();
    const kind: CarKind = r < 0.07 ? 'police' : r < 0.22 ? 'cab' : r < 0.32 ? 'hauler' : 'car';
    const v = dir * (50 + rng() * 110) * (kind === 'hauler' ? 0.6 : 1);
    const left = laneX(lane);
    const x = anywhere ? left + rng() * city.W : dir > 0 ? left - 40 - rng() * 120 : left + city.W + 40 + rng() * 120;
    return { lane, x, dy: (rng() - 0.5) * 22, v, kind };
  };
  const newPerson = (anywhere: boolean): Person => {
    const dir = rng() < 0.5 ? -1 : 1;
    const x = anywhere ? city.cam + rng() * city.W : dir > 0 ? city.cam - 20 : city.cam + city.W + 20;
    return { x, v: dir * (10 + rng() * 18), h: 8 + rng() * 3.5, umbrella: rng() < 0.28 ? NEON[Math.floor(rng() * NEON.length)] : null, phase: rng() * 6 };
  };

  const populate = () => {
    cars.length = 0;
    people.length = 0;
    drops.length = 0;
    LANES.forEach((_, lane) => {
      const n = Math.round((city.W / (lane === 0 ? 75 : 110)) * o.traffic);
      for (let i = 0; i < n; i++) cars.push(newCar(lane, true));
    });
    const np = Math.round((city.W / 8) * o.crowd);
    for (let i = 0; i < np; i++) people.push(newPerson(true));
    const nd = Math.min(520, Math.round(((city.W * city.H) / 2400) * Math.min(1.5, o.rain)));
    for (let i = 0; i < nd; i++) {
      const depth = rng() < 0.45 ? 0 : rng() < 0.6 ? 1 : 2;
      drops.push({ x: rng() * city.W, y: rng() * city.H, speed: [520, 700, 900][depth] * (0.85 + rng() * 0.3), len: [7, 11, 16][depth], depth });
    }
  };
  populate();
  let lastW = city.W;
  let lastH = city.H;

  const life: Life = {
    get wet() {
      return wet;
    },
    update(dt) {
      if (city.W !== lastW || city.H !== lastH) {
        lastW = city.W;
        lastH = city.H;
        populate();
      }
      const t = city.t;
      wet = Math.min(1, Math.max(0, (0.25 + 0.75 * (0.5 + 0.5 * noise.noise2(t * 0.012, 3.3))) * o.rain));
      // Air traffic: fly, and come round again when out of view.
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        c.x += c.v * dt;
        const sx = c.x - laneX(c.lane);
        if ((c.v < 0 && sx < -140) || (c.v > 0 && sx > city.W + 140) || sx < -400 || sx > city.W + 400) cars[i] = newCar(c.lane, false);
      }
      // Trains.
      if (t >= nextTrain && trains.length < 2) {
        const dir = rng() < 0.5 ? -1 : 1;
        const left = city.cam * LAYERS[1].k;
        trains.push({ x: dir > 0 ? left - 500 : left + city.W + 60, v: dir * (210 + rng() * 60), cars: 6 + Math.floor(rng() * 5), announced: false });
        nextTrain = t + 18 + rng() * 22;
      }
      for (let i = trains.length - 1; i >= 0; i--) {
        const tr = trains[i];
        tr.x += tr.v * dt;
        const sx = tr.x - city.cam * LAYERS[1].k;
        if (!tr.announced && sx > -200 && sx < city.W + 10) {
          tr.announced = true;
          city.emit('train', Math.max(0, Math.min(city.W, sx)), railY(), 0.35);
        }
        if ((tr.v > 0 && sx > city.W + 60) || (tr.v < 0 && sx < -tr.cars * 48 - 60)) trains.splice(i, 1);
      }
      // People walk; the street goes on.
      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        p.x += p.v * dt;
        p.phase += dt * 8;
        const sx = p.x - city.cam;
        if (sx < -30 || sx > city.W + 30) people[i] = newPerson(false);
      }
      // Steam from vents in the street, every few hundred pixels of the near layer.
      for (let vx = Math.floor((city.cam - 40) / 310) * 310; vx < city.cam + city.W + 40; vx += 310) {
        const k = Math.sin(vx * 12.9898) * 43758.5453;
        if (k - Math.floor(k) > 0.55) continue;
        if (rng() < dt * 3 && puffs.length < 70) puffs.push({ x: vx + 40, y: city.baseY(2), vx: (rng() - 0.5) * 6, vy: -18 - rng() * 12, age: 0, life: 3 + rng() * 2, r: 4 + rng() * 4 });
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += dt * 6;
        if (p.age > p.life) puffs.splice(i, 1);
      }
      // Rain.
      const street = city.baseY(2);
      const wind = 0.18 + 0.1 * noise.noise2(t * 0.05, 9);
      const n = Math.floor(drops.length * wet);
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d.y += d.speed * dt;
        d.x += d.speed * wind * dt;
        if (d.depth === 2 && d.y > street && d.y - d.speed * dt <= street && rng() < 0.35 && splashes.length < 50) splashes.push({ x: d.x, t0: t });
        if (d.y > city.H + d.len) {
          d.y -= city.H + d.len * 2;
          d.x = rng() * (city.W + 100) - 100;
        }
        if (d.x > city.W + 20) d.x -= city.W + 40;
      }
      for (let i = splashes.length - 1; i >= 0; i--) if (t - splashes[i].t0 > 0.35) splashes.splice(i, 1);
      // Lightning in heavy rain; thunder follows.
      flash = Math.max(0, flash - dt * 3.2);
      if (wet > 0.72 && t >= nextBolt) {
        nextBolt = t + 25 + rng() * 45;
        const x = city.W * (0.1 + rng() * 0.8);
        const pts = [x, 0];
        let px = x;
        for (let y = 0; y < city.H * 0.5; y += 18 + rng() * 22) {
          px += (rng() - 0.5) * 50;
          pts.push(px, y);
        }
        bolt = { t0: t, pts };
        flash = reduced() ? 0.25 : 1;
        city.emit('lightning', x, city.H * 0.2, 0.3);
        thunderAt = t + 0.8 + rng() * 2.2;
        thunderX = x;
      }
      if (thunderAt > 0 && t >= thunderAt) {
        thunderAt = -1;
        city.emit('thunder', thunderX, city.H * 0.2, 0.55);
      }
      // Police: in, hover over the target with searchlights, then away.
      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        const k = LAYERS[u.L].k;
        const tx = u.target.b.x + u.target.ox + (i % 3 - 1) * 26;
        const ty = city.baseY(u.L) - u.target.b.h + u.target.oy - 50 - (i % 3) * 12;
        if (u.phase === 'out') {
          u.x += 160 * dt;
          u.y -= 40 * dt;
          if (u.x - city.cam * k > city.W + 80) units.splice(i, 1);
          continue;
        }
        const dx = tx - u.x;
        const dy = ty - u.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = Math.min(220, d * 2);
        u.x += (dx / d) * sp * dt;
        u.y += (dy / d) * sp * dt;
        u.sweep += dt;
        if (u.phase === 'in' && d < 8) {
          u.phase = 'hover';
          u.until = t + 12;
        }
        if (u.phase === 'hover' && t > u.until) u.phase = 'out';
      }
    },
    drawSky(ctx) {
      if (bolt && city.t - bolt.t0 < 0.5) {
        const a = 1 - (city.t - bolt.t0) / 0.5;
        ctx.save();
        ctx.strokeStyle = hexA('#e9d5ff', 0.85 * a);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < bolt.pts.length; i += 2) {
          if (i === 0) ctx.moveTo(bolt.pts[0], bolt.pts[1]);
          else ctx.lineTo(bolt.pts[i], bolt.pts[i + 1]);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (flash > 0) {
        ctx.fillStyle = hexA('#c4b5fd', 0.22 * flash);
        ctx.fillRect(0, 0, city.W, city.H);
      }
    },
    drawLane(ctx, lane) {
      const L = LANES[lane];
      const left = laneX(lane);
      const y0 = city.H * L.y;
      const s = L.s;
      ctx.save();
      // Light streaks behind (tail lights smeared by speed) and a short headlight beam ahead,
      // then bodies, then the lights themselves, each batched.
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.6 * s;
      ctx.strokeStyle = hexA('#fb7185', 0.42);
      ctx.beginPath();
      for (const c of cars) {
        if (c.lane !== lane) continue;
        const x = c.x - left;
        const y = y0 + c.dy + Math.sin(city.t * 0.8 + c.x * 0.01) * 2;
        const dir = Math.sign(c.v);
        ctx.moveTo(x - dir * 6 * s, y);
        ctx.lineTo(x - dir * (6 * s + Math.abs(c.v) * 0.3 * s), y);
      }
      ctx.stroke();
      ctx.lineWidth = 2.4 * s;
      ctx.strokeStyle = hexA('#fefce8', 0.16);
      ctx.beginPath();
      for (const c of cars) {
        if (c.lane !== lane) continue;
        const x = c.x - left;
        const y = y0 + c.dy + Math.sin(city.t * 0.8 + c.x * 0.01) * 2;
        const dir = Math.sign(c.v);
        ctx.moveTo(x + dir * 7 * s, y);
        ctx.lineTo(x + dir * 22 * s, y + 1.5 * s);
      }
      ctx.stroke();
      ctx.fillStyle = '#05040c';
      ctx.beginPath();
      for (const c of cars) {
        if (c.lane !== lane) continue;
        const x = c.x - left;
        const y = y0 + c.dy + Math.sin(city.t * 0.8 + c.x * 0.01) * 2;
        const len = (c.kind === 'hauler' ? 22 : 13) * s;
        ctx.rect(x - len / 2, y - 2 * s, len, 4 * s);
      }
      ctx.fill();
      for (const c of cars) {
        if (c.lane !== lane) continue;
        const x = c.x - left;
        const y = y0 + c.dy + Math.sin(city.t * 0.8 + c.x * 0.01) * 2;
        const dir = Math.sign(c.v);
        const len = (c.kind === 'hauler' ? 22 : 13) * s;
        ctx.fillStyle = hexA('#fefce8', 0.95);
        ctx.fillRect(x + (dir * len) / 2 - 1, y - 1, 2 * s, 2 * s);
        ctx.fillStyle = hexA('#f43f5e', 0.9);
        ctx.fillRect(x - (dir * len) / 2 - 1, y - 1, 2 * s, 2 * s);
        if (c.kind === 'cab') {
          ctx.fillStyle = hexA('#facc15', 0.8);
          ctx.fillRect(x - len / 4, y - 3 * s, len / 2, 1.2 * s);
        } else if (c.kind === 'police') {
          ctx.fillStyle = Math.floor(city.t * 6 + c.x) % 2 ? '#3b82f6' : '#ef4444';
          ctx.fillRect(x - 2 * s, y - 3.5 * s, 4 * s, 1.5 * s);
        } else if (c.kind === 'hauler') {
          ctx.fillStyle = hexA('#f97316', 0.6);
          for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * 6 * s - 1, y + 2 * s, 2, 1.2 * s);
        }
      }
      ctx.restore();
    },
    drawRail(ctx) {
      const k = LAYERS[1].k;
      const y = railY();
      const base = city.baseY(1);
      ctx.save();
      // Pylons and the beam.
      ctx.fillStyle = '#0d0b1a';
      const left = city.cam * k;
      for (let px = Math.floor(left / 170) * 170; px < left + city.W + 170; px += 170) {
        const x = px - left;
        ctx.fillRect(x - 3, y + 4, 6, base - y);
      }
      ctx.fillRect(0, y, city.W, 5);
      ctx.fillStyle = hexA('#22d3ee', 0.25);
      ctx.fillRect(0, y + 5, city.W, 1);
      // Trains: lit capsules, a headlight, and a smear of speed.
      for (const tr of trains) {
        const dir = Math.sign(tr.v);
        const sx = tr.x - left;
        for (let c = 0; c < tr.cars; c++) {
          const cx = sx - dir * c * 48;
          if (cx < -60 || cx > city.W + 60) continue;
          ctx.fillStyle = '#100d1f';
          ctx.fillRect(cx - 22, y - 11, 44, 10);
          ctx.fillStyle = hexA(c % 3 === 0 ? '#67e8f9' : '#fde68a', 0.75);
          ctx.fillRect(cx - 18, y - 8, 36, 3);
          ctx.fillStyle = hexA('#22d3ee', 0.12);
          ctx.fillRect(cx - 22 - dir * 30, y - 9, 30, 6);
        }
        const hx = sx + dir * 24;
        const g = ctx.createRadialGradient(hx, y - 6, 0, hx, y - 6, 40);
        g.addColorStop(0, 'rgba(254,252,232,0.7)');
        g.addColorStop(1, 'rgba(254,252,232,0)');
        ctx.fillStyle = g;
        ctx.fillRect(hx - 40, y - 46, 80, 80);
      }
      ctx.restore();
    },
    drawStreet(ctx) {
      const base = city.baseY(2);
      ctx.save();
      // Steam.
      for (const p of puffs) {
        const x = p.x - city.cam;
        const a = 0.09 * (1 - p.age / p.life);
        ctx.fillStyle = hexA('#e2e8f0', a);
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Pedestrians: silhouettes with a little bob, some under neon umbrellas.
      ctx.fillStyle = '#030208';
      ctx.beginPath();
      for (const p of people) {
        const x = p.x - city.cam;
        const bob = Math.abs(Math.sin(p.phase)) * 0.8;
        ctx.rect(x - 1.5, base - p.h - bob, 3, p.h);
        ctx.moveTo(x + 2, base - p.h - 2 - bob);
        ctx.arc(x, base - p.h - 2 - bob, 2, 0, Math.PI * 2);
      }
      ctx.fill();
      for (const p of people) {
        if (!p.umbrella) continue;
        const x = p.x - city.cam;
        const top = base - p.h - 6;
        ctx.fillStyle = hexA(p.umbrella, 0.7);
        ctx.beginPath();
        ctx.arc(x, top + 2, 6, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = hexA(p.umbrella, 0.18);
        ctx.fillRect(x - 6, top + 2, 12, p.h + 4);
      }
      // Splashes.
      ctx.strokeStyle = hexA('#bae6fd', 0.4);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const s of splashes) {
        const age = city.t - s.t0;
        const r = 1 + age * 10;
        const y = base + 3 + (s.x % 7);
        ctx.moveTo(s.x + r, y);
        ctx.ellipse(s.x, y, r, r * 0.3, 0, Math.PI, 0);
      }
      ctx.stroke();
      ctx.restore();
    },
    drawPolice(ctx) {
      if (!units.length) return;
      ctx.save();
      for (const u of units) {
        const x = u.x - city.cam * LAYERS[u.L].k;
        if (u.phase === 'hover') {
          // A searchlight sweeping the building.
          const ang = Math.PI / 2 + Math.sin(u.sweep * 0.9) * 0.45;
          const len = city.baseY(u.L) - u.y;
          const ex = x + Math.cos(ang) * len;
          const ey = u.y + Math.sin(ang) * len;
          const g = ctx.createLinearGradient(x, u.y, ex, ey);
          g.addColorStop(0, 'rgba(241,245,249,0.32)');
          g.addColorStop(1, 'rgba(241,245,249,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, u.y);
          ctx.lineTo(ex - 26, ey);
          ctx.lineTo(ex + 26, ey);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#05040c';
        ctx.fillRect(x - 8, u.y - 2.5, 16, 5);
        ctx.fillStyle = Math.floor(city.t * 8) % 2 ? '#3b82f6' : '#ef4444';
        ctx.fillRect(x - 3, u.y - 4.5, 6, 2);
        const g = ctx.createRadialGradient(x, u.y - 4, 0, x, u.y - 4, 18);
        g.addColorStop(0, Math.floor(city.t * 8) % 2 ? 'rgba(59,130,246,0.35)' : 'rgba(239,68,68,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 18, u.y - 22, 36, 36);
      }
      ctx.restore();
    },
    drawRain(ctx) {
      const n = Math.floor(drops.length * wet);
      if (!n) return;
      ctx.save();
      const slant = 0.2;
      for (let depth = 0; depth < 3; depth++) {
        ctx.strokeStyle = hexA('#c7d2fe', [0.14, 0.24, 0.38][depth]);
        ctx.lineWidth = [0.6, 0.8, 1][depth];
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const d = drops[i];
          if (d.depth !== depth) continue;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * slant, d.y - d.len);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
    dispatch(b, ox, oy) {
      const k = LAYERS[b.layer].k;
      for (let i = 0; i < 3; i++) {
        units.push({ L: b.layer, x: city.cam * k + city.W + 60 + i * 40, y: city.H * (0.15 + 0.1 * i), target: { b, ox, oy }, phase: 'in', until: 0, sweep: rng() * 6 });
      }
    },
    counts: () => ({ cars: cars.length, people: people.length, rain: Math.floor(drops.length * wet), trains: trains.length, police: units.length, steam: puffs.length }),
  };
  return life;
}
