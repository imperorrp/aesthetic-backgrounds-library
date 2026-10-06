/**
 * The phenomena a Leylines world can draw (see kit/compose). Each seed gets its own cast:
 *
 *   weather   storm (swirls the lines), aurora (pulls them north), ley-tide (a wave of power
 *             sweeping the land), mist (drifting fog)
 *   calamity  rift (a void that eats lines, closed by ritual), blight (a hostile growth that
 *             eats the orders' lines), quake (a fault that cuts the land), eclipse (the wells
 *             dim)
 *   wonder    convergence (the moons align, everything surges), comet (lays a new line
 *             across the sky), starfall (meteors make new wells), great beacons
 *   life      wisps (flocks of lights riding the lines), a leviathan (a vast serpent in the
 *             deep), pilgrims (lantern processions between wells), migrations (birds)
 *
 * Systems start their moments when the director allows (`want`), so the cast is paced by
 * the seed's arc, not by timers. Positions here are in cells unless named px.
 */
import type { SystemDef, SystemInstance, Genome } from '../../../kit';
import type { InkWorld } from './sim';
import { hexA } from '../../instruments/kit';

type W = InkWorld;
const px = (w: W, c: number) => c * w.cell;
const alive = (w: W) => w.orders.filter((o) => o.alive);

// ---- weather ------------------------------------------------------------------------------------

const storm: SystemDef<W, { size: number; swirl: number; hue: string; often: number }> = {
  id: 'storm', label: 'arcane storms', tags: ['weather'],
  weight: (_g, w) => 1.2 * w.opts.storms,
  params: (g) => ({ size: g.range(0.1, 0.2), swirl: g.range(0.6, 1.4) * (g.chance(0.5) ? 1 : -1), hue: g.pick(['#a78bfa', '#f472b6', '#22d3ee', '#fbbf24', '#e0e7ff']), often: g.range(60, 110) }),
  create(w, p, g) {
    const storms: { x: number; y: number; vx: number; vy: number; r: number; t0: number; dur: number }[] = [];
    w.steer.push((i) => {
      for (const s of storms) {
        const dx = w.phys.x[i] - s.x;
        const dy = w.phys.y[i] - s.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < s.r * s.r) return p.swirl * 0.35 * (1 - Math.sqrt(d2) / s.r);
      }
      return 0;
    });
    return {
      id: 'storm',
      step(dt) {
        if (!storms.length && w.director.want('storm', 0.5, p.often)) {
          const left = g.chance(0.5);
          const s = { x: left ? -10 : w.cols + 10, y: g.range(0.25, 0.75) * w.rows, vx: (left ? 1 : -1) * g.range(2.5, 4.5), vy: g.range(-1, 1), r: p.size * w.rows * 1.6, t0: w.t, dur: 90 };
          storms.push(s);
          w.emit('storm', px(w, left ? 20 : w.cols - 20), px(w, s.y), 0.5, 'AN ARCANE STORM');
          w.tell('An arcane storm came over the land.', p.hue, false);
          w.look('storm', px(w, left ? w.cols * 0.3 : w.cols * 0.7), px(w, s.y), 1.15, 10, 3);
        }
        for (const s of storms) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          for (const o of alive(w)) w.phys.trails[o.slot].swirl(s.x, s.y, s.r, p.swirl * dt * 1.2, 0);
          if (g.unit() < dt * 6) {
            const o = g.pick(alive(w));
            if (o) w.phys.trails[o.slot].splat(s.x + g.normal(0, s.r * 0.4), s.y + g.normal(0, s.r * 0.4), 2, 6);
          }
        }
        for (let i = storms.length - 1; i >= 0; i--) if (storms[i].x < -30 || storms[i].x > w.cols + 30 || w.t - storms[i].t0 > 120) storms.splice(i, 1);
      },
      paint(pass, ctx) {
        const v = w.view!;
        for (const s of storms) {
          const X = v.sx(px(w, s.x));
          const Y = v.sy(px(w, s.y));
          const R = px(w, s.r) * v.z;
          if (pass === 'over') {
            for (let k = 0; k < 10; k++) {
              const a = v.t * p.swirl * 0.8 + (k / 10) * Math.PI * 2;
              const d = R * (0.25 + 0.6 * ((k * 0.37) % 1));
              const gx = X + Math.cos(a) * d;
              const gy = Y + Math.sin(a) * d * 0.7;
              const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.45);
              gr.addColorStop(0, v.medium === 'vellum' ? 'rgba(60,50,40,0.12)' : 'rgba(20,16,36,0.3)');
              gr.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = gr;
              ctx.fillRect(gx - R * 0.45, gy - R * 0.45, R * 0.9, R * 0.9);
            }
          } else if (pass === 'glow') {
            v.glow(ctx, X, Y, R * 0.9, p.hue, 0.12 + 0.05 * Math.sin(v.t * 3));
            if (Math.sin(v.t * 9 + s.t0) > 0.93) {
              ctx.strokeStyle = hexA('#f5f3ff', 0.85);
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              let x = X + Math.sin(v.t * 7) * R * 0.5;
              let y = Y - R * 0.6;
              ctx.moveTo(x, y);
              for (let k = 0; k < 7; k++) {
                x += Math.sin(v.t * 31 + k * 2.3) * 14 * v.z;
                y += R * 0.17;
                ctx.lineTo(x, y);
              }
              ctx.stroke();
            }
          }
        }
      },
      counts: () => ({ storms: storms.length }),
    };
  },
};

const aurora: SystemDef<W, { hues: string[]; often: number }> = {
  id: 'aurora', label: 'auroras', tags: ['weather'],
  weight: (_g, w) => 0.6 + w.land.tundra * 3 + (w.medium === 'night' || w.medium === 'starchart' ? 0.5 : 0),
  params: (g) => ({ hues: [g.pick(['#4ade80', '#22d3ee', '#a78bfa']), g.pick(['#f472b6', '#86efac', '#93c5fd'])], often: g.range(100, 180) }),
  create(w, p) {
    let until = -1;
    let t0 = 0;
    return {
      id: 'aurora',
      step() {
        if (until < w.t && w.director.want('aurora', 0.3, p.often)) {
          t0 = w.t;
          until = w.t + 55;
          w.emit('aurora', w.W / 2, w.H * 0.2, 0.35);
          w.tell('Lights hung over the north of the land.', p.hues[0], false);
          for (let k = 0; k < 6; k++) w.attractors.push({ x: (w.cols * (k + 0.5)) / 6, y: w.rows * (0.18 + 0.05 * Math.sin(k)), r: w.rows * 0.18, v: 0.6, slot: -1, until });
        }
      },
      paint(pass, ctx) {
        if (pass !== 'glow' || w.t > until) return;
        const v = w.view!;
        const a = Math.min(1, (w.t - t0) / 6, (until - w.t) / 6);
        for (let x = 0; x < v.W; x += 6) {
          const n = Math.sin(x * 0.006 + v.t * 0.25) * 0.5 + Math.sin(x * 0.017 - v.t * 0.4) * 0.3;
          const top = v.H * (0.04 + 0.06 * n);
          const h = v.H * (0.18 + 0.1 * Math.sin(x * 0.011 + v.t * 0.3));
          const grad = ctx.createLinearGradient(0, top, 0, top + h);
          grad.addColorStop(0, hexA(p.hues[1], 0));
          grad.addColorStop(0.6, hexA(p.hues[0], 0.11 * a * (0.6 + 0.4 * Math.sin(x * 0.05 + v.t))));
          grad.addColorStop(1, hexA(p.hues[0], 0));
          ctx.fillStyle = grad;
          ctx.fillRect(x, top, 6, h);
        }
      },
    };
  },
};

const tide: SystemDef<W, { angle: number; speed: number; color: string; often: number }> = {
  id: 'tide', label: 'ley-tides', tags: ['weather'],
  weight: 1,
  params: (g) => ({ angle: g.unit() * Math.PI * 2, speed: g.range(5, 9), color: g.pick(['#fef3c7', '#e0f2fe', '#fae8ff']), often: g.range(80, 140) }),
  create(w, p) {
    let pos = Infinity;
    const len = Math.hypot(w.cols, w.rows);
    const dx = Math.cos(p.angle);
    const dy = Math.sin(p.angle);
    return {
      id: 'tide',
      step(dt) {
        if (pos > len / 2 + 10 && w.director.want('tide', 0.35, p.often)) {
          pos = -len / 2 - 5;
          w.emit('tide', w.W / 2, w.H / 2, 0.35);
          w.tell('A tide of power went over the land.', p.color, false);
        }
        if (pos > len / 2 + 10) return;
        pos += p.speed * dt;
        // Along the wavefront: power into every order's lines.
        for (let s = -len / 2; s < len / 2; s += 5) {
          const x = w.cols / 2 + dx * pos - dy * s;
          const y = w.rows / 2 + dy * pos + dx * s;
          if (x < 0 || y < 0 || x >= w.cols || y >= w.rows) continue;
          for (const o of alive(w)) w.phys.trails[o.slot].splat(x, y, 2.5, 0.5);
        }
      },
      paint(pass, ctx) {
        if (pass !== 'glow' || pos > len / 2 + 10) return;
        const v = w.view!;
        const cx = v.sx(px(w, w.cols / 2 + dx * pos));
        const cy = v.sy(px(w, w.rows / 2 + dy * pos));
        const L = px(w, len) * v.z;
        const band = px(w, 6) * v.z;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p.angle);
        const grad = ctx.createLinearGradient(-band, 0, band, 0);
        grad.addColorStop(0, hexA(p.color, 0));
        grad.addColorStop(0.5, hexA(p.color, 0.16));
        grad.addColorStop(1, hexA(p.color, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(-band, -L / 2, band * 2, L);
        ctx.restore();
      },
    };
  },
};

const mist: SystemDef<W, { density: number; tint: string }> = {
  id: 'mist', label: 'mists', tags: ['weather'],
  weight: (_g, w) => 0.5 + w.land.marsh * 3 + w.land.isles,
  params: (g) => ({ density: g.range(0.5, 1), tint: g.pick(['#cbd5e1', '#e2e8f0', '#a5b4fc']) }),
  create(w, p, g) {
    const banks = Array.from({ length: 9 }, () => ({ x: g.unit(), y: g.unit(), r: g.range(0.12, 0.25), s: g.range(0.004, 0.01) }));
    return {
      id: 'mist',
      paint(pass, ctx) {
        if (pass !== 'over') return;
        const v = w.view!;
        for (const b of banks) {
          const x = (((b.x + v.t * b.s) % 1.4) - 0.2) * v.W;
          const y = (b.y + Math.sin(v.t * 0.05 + b.r * 10) * 0.03) * v.H;
          const r = b.r * v.W;
          const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, hexA(p.tint, (v.medium === 'vellum' ? 0.14 : 0.06) * p.density));
          gr.addColorStop(1, hexA(p.tint, 0));
          ctx.fillStyle = gr;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      },
    };
  },
};

// ---- calamities ---------------------------------------------------------------------------------

const rift: SystemDef<W, { often: number; max: number }> = {
  id: 'rift', label: 'rifts', tags: ['calamity'],
  weight: (_g, w) => 1.2 * w.opts.rifts,
  params: (g) => ({ often: g.range(110, 200), max: g.range(7, 13) }),
  create(w, p, g) {
    let r: { x: number; y: number; r: number; t0: number; closing: number; closed: number } | null = null;
    w.steer.push((i) => {
      if (!r || r.closed >= 0) return 0;
      const dx = r.x - w.phys.x[i];
      const dy = r.y - w.phys.y[i];
      const d = Math.hypot(dx, dy);
      if (d > r.r * 3) return 0;
      // Turn toward it: the lines are drawn in.
      const want = Math.atan2(dy, dx);
      let diff = want - w.phys.a[i];
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      return diff * 0.08 * (1 - d / (r.r * 3));
    });
    return {
      id: 'rift',
      step(dt) {
        if (!r && w.director.want('rift', 0.85, p.often)) {
          const well = g.pick(w.wells);
          r = { x: well.x / w.cell, y: well.y / w.cell, r: 2, t0: w.t, closing: 0, closed: -1 };
          w.emit('rift', well.x, well.y, 0.9, `A RIFT OPENS AT ${well.name}`);
          w.tell(`A RIFT OPENS AT ${well.name}`, '#c084fc', true, 'the world tears where the lines met');
          w.look('rift', well.x, well.y, 1.45, 12, 7);
        }
        if (!r) return;
        if (r.closed >= 0) {
          if (w.t - r.closed > 6) r = null;
          return;
        }
        const age = w.t - r.t0;
        if (age < 50) r.r = Math.min(p.max, r.r + dt * 0.25);
        else r.closing += dt / 30;
        const R = r.r * (1 - r.closing * 0.9);
        for (const o of alive(w)) {
          const f = w.phys.trails[o.slot];
          for (let y = Math.max(0, Math.floor(r.y - R)); y <= Math.min(w.rows - 1, Math.ceil(r.y + R)); y++) for (let x = Math.max(0, Math.floor(r.x - R)); x <= Math.min(w.cols - 1, Math.ceil(r.x + R)); x++) {
            if (Math.hypot(x - r.x, y - r.y) < R) f.data[y * w.cols + x] *= 0.8;
          }
        }
        for (let i = 0; i < w.phys.n; i++) if (w.phys.alive[i] && Math.hypot(w.phys.x[i] - r.x, w.phys.y[i] - r.y) < R * 0.6) w.phys.kill(i);
        if (r.closing >= 1) {
          r.closed = w.t;
          w.emit('riftclosed', px(w, r.x), px(w, r.y), 0.7, 'THE RIFT IS CLOSED');
          w.tell('THE RIFT IS CLOSED', '#e0f2fe', true);
          w.look('rift', px(w, r.x), px(w, r.y), 1.3, 6, 5);
          // Sometimes the scar becomes a well.
          if (g.chance(0.45)) {
            const nw = w.addWell(px(w, r.x + 3), px(w, r.y + 2), 1.8, true);
            if (nw) w.tell(`The scar became a well: ${nw.name.toLowerCase()}.`, '#c084fc', false);
          }
        }
      },
      paint(pass, ctx) {
        if (!r) return;
        const v = w.view!;
        const X = v.sx(px(w, r.x));
        const Y = v.sy(px(w, r.y));
        const fade = r.closed >= 0 ? Math.max(0, 1 - (w.t - r.closed) / 6) : 1;
        const R = px(w, r.r) * v.z * (1 - r.closing * 0.9) * fade;
        if (R < 1) return;
        if (pass === 'over') {
          const gr = ctx.createRadialGradient(X, Y, 0, X, Y, R * 1.5);
          gr.addColorStop(0, 'rgba(0,0,0,0.96)');
          gr.addColorStop(0.55, 'rgba(12,2,24,0.9)');
          gr.addColorStop(0.8, 'rgba(126,34,206,0.45)');
          gr.addColorStop(1, 'rgba(126,34,206,0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          for (let k = 0; k <= 28; k++) {
            const a = (k / 28) * Math.PI * 2;
            const rr = R * 1.5 * (0.85 + 0.15 * Math.sin(a * 5 + v.t * 2) + Math.sin(k * 7.1) * 0.06);
            if (k) ctx.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr);
            else ctx.moveTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr);
          }
          ctx.fill();
          if (r.closing > 0) {
            ctx.strokeStyle = hexA('#e0f2fe', 0.5 * fade);
            ctx.lineWidth = 1.2;
            for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.arc(X, Y, R * (2 + k * 0.5), v.t * (0.2 + k * 0.1), v.t * (0.2 + k * 0.1) + Math.PI * 2 * Math.min(1, r.closing * 1.4));
              ctx.stroke();
            }
          }
        } else if (pass === 'glow') {
          for (let k = 0; k < 18; k++) {
            const u = (v.t * 0.35 + k / 18) % 1;
            const a = k * 2.39 + u * 5;
            const d = R * (3 - u * 2.3);
            v.glow(ctx, X + Math.cos(a) * d, Y + Math.sin(a) * d, 3 * v.z, '#c084fc', 0.7 * u * fade);
          }
        }
      },
      status: () => (r && r.closed < 0 ? 'THE WORLD IS TORN' : null),
    };
  },
};

const blight: SystemDef<W, { often: number; peak: number }> = {
  id: 'blight', label: 'a blight', tags: ['calamity'],
  weight: (_g, w) => 0.8 * w.opts.rifts + w.land.marsh,
  params: (g) => ({ often: g.range(160, 260), peak: g.range(1800, 3200) }),
  create(w, p, g) {
    const o = w.orders[w.maxSlots - 1];
    o.hostile = true;
    o.name = g.pick(['THE BLIGHT', 'THE CREEPING ROT', 'THE GREY HUNGER', 'THE WITHERING']);
    o.color = '#7e22ce';
    const sp = w.phys.species[o.slot];
    Object.assign(sp, { sa: 0.9, sd: 4, ra: 0.7, speed: 0.7, deposit: 2, diffuse: 0.5, keep: 0.94, repel: 0, jitter: 0.2 });
    let t0 = -1;
    let n = 0;
    return {
      id: 'blight',
      step() {
        if (!o.alive && w.director.want('blight', 0.75, p.often)) {
          const well = g.pick(w.wells);
          w.raiseOrder(well, true);
          o.alive = true;
          o.hostile = true;
          t0 = w.t;
          w.emit('blight', well.x, well.y, 0.8, `${o.name} SPREADS FROM ${well.name}`);
          w.tell(`${o.name} SPREADS FROM ${well.name}`, '#d8b4fe', true, 'it eats the lines it touches');
          w.look('blight', well.x, well.y, 1.4, 10, 6);
        }
        if (!o.alive) return;
        const age = w.t - t0;
        o.target = age < 90 ? p.peak : Math.max(0, p.peak * (1 - (age - 90) / 60));
        // It eats what it touches.
        if (++n % 4 === 0) {
          const b = w.phys.trails[o.slot].data;
          const nb = w.norm[o.slot];
          for (const other of alive(w)) {
            if (other === o) continue;
            const d = w.phys.trails[other.slot].data;
            for (let i = 0; i < d.length; i++) if (b[i] * nb > 0.3) d[i] *= 0.85;
          }
        }
        if (age > 90 && w.phys.count(o.slot) < 40) {
          o.alive = false;
          for (let i = 0; i < w.phys.n; i++) if (w.phys.alive[i] && w.phys.s[i] === o.slot) w.phys.kill(i);
          w.phys.trails[o.slot].scale(0);
          w.emit('blightburned', w.W / 2, w.H / 2, 0.6, `${o.name} IS BURNED AWAY`);
          w.tell(`${o.name} IS BURNED AWAY`, '#e9d5ff', true);
        }
      },
      status: () => (o.alive ? `${o.name} SPREADS` : null),
    };
  },
};

const quake: SystemDef<W, { often: number; glow: string }> = {
  id: 'quake', label: 'ley-quakes', tags: ['calamity'],
  weight: (_g, w) => 0.6 + w.land.mountains * 2 + w.land.desert,
  params: (g) => ({ often: g.range(140, 240), glow: g.pick(['#fb923c', '#fde68a', '#f472b6']) }),
  create(w, p, g) {
    let line: [number, number][] = [];
    let cells: number[] = [];
    let t0 = -1;
    return {
      id: 'quake',
      step() {
        if (!line.length && w.director.want('quake', 0.7, p.often)) {
          // A fault: a jagged walk across part of the land.
          let x = g.range(0.1, 0.9) * w.cols;
          let y = g.chance(0.5) ? 0 : w.rows - 1;
          let a = y === 0 ? Math.PI / 2 : -Math.PI / 2;
          a += g.range(-0.6, 0.6);
          const steps = Math.floor(w.rows * g.range(0.5, 0.9));
          for (let k = 0; k < steps; k++) {
            a += g.range(-0.35, 0.35);
            x += Math.cos(a) * 1.4;
            y += Math.sin(a) * 1.4;
            if (x < 0 || y < 0 || x >= w.cols || y >= w.rows) break;
            line.push([x, y]);
            const i = (y | 0) * w.cols + (x | 0);
            if (!w.wall[i]) {
              w.wall[i] = 2;
              cells.push(i);
            }
          }
          t0 = w.t;
          const mid = line[line.length >> 1] ?? [w.cols / 2, w.rows / 2];
          w.emit('quake', px(w, mid[0]), px(w, mid[1]), 0.75, 'THE LAND BREAKS');
          w.tell('THE LAND BREAKS', p.glow, true, 'a fault opens across the lines');
          w.look('quake', px(w, mid[0]), px(w, mid[1]), 1.25, 9, 6);
        }
        if (!line.length) return;
        for (const i of cells) if (w.wall[i] === 2) for (const o of alive(w)) w.phys.trails[o.slot].data[i] = 0;
        // Healing from the ends in.
        const age = w.t - t0;
        if (age > 70) {
          const k = Math.floor(((age - 70) / 60) * cells.length);
          for (let j = 0; j < Math.min(k, cells.length); j++) if (w.wall[cells[j]] === 2) w.wall[cells[j]] = 0;
          if (age > 130) {
            for (const i of cells) if (w.wall[i] === 2) w.wall[i] = 0;
            line = [];
            cells = [];
          }
        }
      },
      paint(pass, ctx) {
        if (!line.length || pass !== 'glow') return;
        const v = w.view!;
        const age = w.t - t0;
        const a = Math.min(1, age * 2) * (age > 70 ? Math.max(0, 1 - (age - 70) / 60) : 1);
        ctx.strokeStyle = hexA(p.glow, 0.75 * a);
        ctx.lineWidth = Math.max(1, 1.6 * v.z);
        ctx.beginPath();
        line.forEach(([x, y], k) => (k ? ctx.lineTo(v.sx(px(w, x)), v.sy(px(w, y))) : ctx.moveTo(v.sx(px(w, x)), v.sy(px(w, y)))));
        ctx.stroke();
        for (let k = 0; k < line.length; k += 6) v.glow(ctx, v.sx(px(w, line[k][0])), v.sy(px(w, line[k][1])), 10 * v.z, p.glow, 0.3 * a);
      },
    };
  },
};

const eclipse: SystemDef<W, { often: number }> = {
  id: 'eclipse', label: 'eclipses', tags: ['calamity', 'sky'],
  weight: 0.7,
  params: (g) => ({ often: g.range(200, 320) }),
  create(w, p) {
    let t0 = -1;
    const on = () => t0 >= 0 && w.t - t0 < 45;
    return {
      id: 'eclipse',
      step() {
        if (!on() && w.director.want('eclipse', 0.6, p.often)) {
          t0 = w.t;
          w.emit('eclipse', w.W / 2, w.H / 2, 0.7, 'THE ECLIPSE');
          w.tell('THE ECLIPSE', '#e2e8f0', true, 'the wells grow dim');
        }
        if (on()) {
          w.mods.deposit *= 0.55;
          w.mods.light *= 0.6;
        }
      },
      paint(pass, ctx) {
        if (!on()) return;
        const v = w.view!;
        const k = Math.min(1, (w.t - t0) / 5, (45 - (w.t - t0)) / 5);
        if (pass === 'over') {
          ctx.fillStyle = `rgba(0,0,6,${(0.35 * k).toFixed(3)})`;
          ctx.fillRect(0, 0, v.W, v.H);
        } else if (pass === 'glow') {
          const X = v.W - 70;
          const Y = 70;
          v.glow(ctx, X, Y, 46, '#e0e7ff', 0.5 * k);
          ctx.fillStyle = `rgba(2,2,6,${k.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(X, Y, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      status: () => (on() ? 'THE SUN IS EATEN' : null),
    };
  },
};

// ---- wonders ------------------------------------------------------------------------------------

const convergence: SystemDef<W, { often: number; hues: string[] }> = {
  id: 'convergence', label: 'the convergence', tags: ['wonder', 'sky'],
  weight: 1.3,
  params: (g) => ({ often: g.range(200, 300), hues: ['#e0e7ff', g.pick(['#fde68a', '#fbcfe8', '#a5f3fc']), g.pick(['#fbcfe8', '#c4b5fd', '#bbf7d0'])] }),
  create(w, p) {
    let t0 = -1;
    const on = () => t0 >= 0 && w.t - t0 < 45;
    return {
      id: 'convergence',
      step() {
        if (!on() && w.director.want('convergence', 0.85, p.often)) {
          t0 = w.t;
          w.emit('convergence', w.W / 2, w.H / 2, 0.9, 'THE CONVERGENCE');
          w.tell('THE CONVERGENCE', '#e0e7ff', true, 'the moons come into line, and every well burns');
          w.look('converge', w.W / 2, w.H / 2, 1, 14, 6);
        }
        if (on()) {
          w.mods.deposit *= 1.7;
          w.mods.speed *= 1.15;
          w.mods.keep *= 1.01;
          w.mods.light *= 1.6;
        }
      },
      paint(pass, ctx) {
        if (pass !== 'glow') return;
        const v = w.view!;
        // The moons, drawn together toward the line, high over the map.
        const k = on() ? 1 : 0;
        const since = t0 >= 0 ? w.t - t0 : 999;
        const near = since < 45 ? 1 : 0;
        p.hues.forEach((c, i) => {
          const a = near ? -Math.PI / 2 : (w.t * (0.02 + i * 0.013) + i * 2) % (Math.PI * 2);
          const R = 22 + i * 9;
          const X = v.W - 60 + Math.cos(a) * R;
          const Y = v.H - 60 + Math.sin(a) * R;
          v.glow(ctx, X, Y, 6 + k * 6, c, 0.7);
        });
        if (on()) v.glow(ctx, v.W / 2, v.H / 2, Math.max(v.W, v.H) * 0.7, p.hues[1], 0.07 * Math.min(1, since / 3, (45 - since) / 3));
      },
      status: () => (on() ? 'THE MOONS ARE IN LINE' : null),
    };
  },
};

const comet: SystemDef<W, { often: number; color: string }> = {
  id: 'comet', label: 'comets', tags: ['wonder', 'sky'],
  weight: 1,
  params: (g) => ({ often: g.range(120, 220), color: g.pick(['#e0f2fe', '#fef3c7', '#d9f99d']) }),
  create(w, p, g) {
    let c: { x0: number; y0: number; x1: number; y1: number; t0: number } | null = null;
    const pos = (u: number) => [c!.x0 + (c!.x1 - c!.x0) * u, c!.y0 + (c!.y1 - c!.y0) * u - Math.sin(u * Math.PI) * w.rows * 0.12];
    return {
      id: 'comet',
      step() {
        if (!c && w.director.want('comet', 0.55, p.often)) {
          const fromLeft = g.chance(0.5);
          c = { x0: fromLeft ? -5 : w.cols + 5, y0: g.range(0.1, 0.5) * w.rows, x1: fromLeft ? w.cols + 5 : -5, y1: g.range(0.4, 0.9) * w.rows, t0: w.t };
          w.emit('comet', w.W / 2, w.H * 0.3, 0.6, 'A COMET');
          w.tell('A COMET CROSSES THE SKY', p.color, true, 'and lays a new line over the land');
        }
        if (!c) return;
        const u = (w.t - c.t0) / 16;
        if (u > 1) {
          c = null;
          return;
        }
        const [x, y] = pos(u);
        if (x > 0 && y > 0 && x < w.cols && y < w.rows) for (const o of alive(w)) w.phys.trails[o.slot].splat(x, y, 2.5, 3);
      },
      paint(pass, ctx) {
        if (!c || pass !== 'glow') return;
        const v = w.view!;
        const u = (w.t - c.t0) / 16;
        ctx.lineCap = 'round';
        for (let k = 0; k < 24; k++) {
          const uu = u - k * 0.012;
          if (uu < 0) break;
          const [x, y] = pos(uu);
          ctx.strokeStyle = hexA(p.color, 0.5 * (1 - k / 24));
          ctx.lineWidth = (6 - k * 0.22) * v.z;
          const [x2, y2] = pos(uu - 0.012);
          ctx.beginPath();
          ctx.moveTo(v.sx(px(w, x)), v.sy(px(w, y)));
          ctx.lineTo(v.sx(px(w, x2)), v.sy(px(w, y2)));
          ctx.stroke();
        }
        const [x, y] = pos(u);
        v.glow(ctx, v.sx(px(w, x)), v.sy(px(w, y)), 26 * v.z, p.color, 0.9);
      },
    };
  },
};

const starfall: SystemDef<W, { often: number; color: string }> = {
  id: 'starfall', label: 'starfalls', tags: ['wonder', 'sky'],
  weight: (_g, w) => 0.8 + (w.wells.length < 30 ? 0.8 : 0) + w.land.desert,
  params: (g) => ({ often: g.range(170, 280), color: g.pick(['#fde68a', '#fecaca', '#bae6fd']) }),
  create(w, p, g) {
    const falls: { x: number; y: number; t0: number; hit: boolean }[] = [];
    let t0 = -1;
    return {
      id: 'starfall',
      step() {
        if (t0 < 0 && w.director.want('starfall', 0.65, p.often)) {
          t0 = w.t;
          for (let k = 0; k < g.int(3, 7); k++) falls.push({ x: g.range(0.1, 0.9) * w.W, y: g.range(0.2, 0.85) * w.H, t0: w.t + k * g.range(2, 4), hit: false });
          w.emit('starfall', w.W / 2, w.H / 2, 0.65, 'STARS FALL');
          w.tell('STARS FALL', p.color, true, 'and where they strike, new wells open');
        }
        for (const f of falls) {
          if (f.hit || w.t < f.t0 + 1.2) continue;
          f.hit = true;
          const well = w.addWell(f.x, f.y, 1.6, true);
          for (const o of alive(w)) w.phys.trails[o.slot].splat(f.x / w.cell, f.y / w.cell, 4, 4);
          if (well) w.emit('impact', f.x, f.y, 0.3);
          w.look('starfall', f.x, f.y, 1.3, 3, 4);
        }
        if (t0 >= 0 && falls.every((f) => f.hit && w.t - f.t0 > 6)) {
          falls.length = 0;
          t0 = -1;
        }
      },
      paint(pass, ctx) {
        if (pass !== 'glow') return;
        const v = w.view!;
        for (const f of falls) {
          const age = w.t - f.t0;
          if (age < 0) continue;
          const X = v.sx(f.x);
          const Y = v.sy(f.y);
          if (age < 1.2) {
            const k = age / 1.2;
            const sx = X - 200 * (1 - k);
            const sy = Y - 260 * (1 - k);
            ctx.strokeStyle = hexA(p.color, 0.8);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - 40, sy - 52);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            v.glow(ctx, sx, sy, 12, p.color, 0.9);
          } else if (age < 6) v.glow(ctx, X, Y, (20 + (age - 1.2) * 30) * v.z, p.color, 0.8 * (1 - (age - 1.2) / 4.8));
        }
      },
    };
  },
};

// ---- life ---------------------------------------------------------------------------------------

const wisps: SystemDef<W, { n: number; color: string; speed: number }> = {
  id: 'wisps', label: 'wisps', tags: ['life'],
  weight: 1.4,
  params: (g) => ({ n: Math.round(g.lognormal(180, 0.4)), color: g.pick(['#e0f2fe', '#fef9c3', '#f5d0fe', '#ccfbf1']), speed: g.range(14, 26) }),
  create(w, p, g) {
    const n = Math.max(40, Math.min(500, p.n));
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const vx = new Float32Array(n);
    const vy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const well = g.pick(w.wells);
      x[i] = well.x + g.normal(0, 30);
      y[i] = well.y + g.normal(0, 30);
      vx[i] = g.normal(0, 5);
      vy[i] = g.normal(0, 5);
    }
    const tot = w.total;
    return {
      id: 'wisps',
      step(dt) {
        for (let i = 0; i < n; i++) {
          const cx = x[i] / w.cell;
          const cy = y[i] / w.cell;
          // Up the slope of the lines, along with a few neighbours, a little wander.
          const gx = tot.sample(cx + 1.5, cy) - tot.sample(cx - 1.5, cy);
          const gy = tot.sample(cx, cy + 1.5) - tot.sample(cx, cy - 1.5);
          const j = (i * 7 + 3) % n;
          vx[i] += (gx * 6 + (vx[j] - vx[i]) * 0.4 + g.normal(0, 3)) * dt;
          vy[i] += (gy * 6 + (vy[j] - vy[i]) * 0.4 + g.normal(0, 3)) * dt;
          const sp = Math.hypot(vx[i], vy[i]);
          const lim = p.speed * w.mods.speed;
          if (sp > lim) {
            vx[i] *= lim / sp;
            vy[i] *= lim / sp;
          }
          x[i] += vx[i] * dt;
          y[i] += vy[i] * dt;
          if (x[i] < 0 || y[i] < 0 || x[i] > w.W || y[i] > w.H) {
            const well = g.pick(w.wells);
            x[i] = well.x;
            y[i] = well.y;
          }
        }
      },
      paint(pass, ctx) {
        if (pass !== 'glow') return;
        const v = w.view!;
        for (let i = 0; i < n; i++) {
          const X = v.sx(x[i]);
          const Y = v.sy(y[i]);
          if (X < -10 || Y < -10 || X > v.W + 10 || Y > v.H + 10) continue;
          v.glow(ctx, X, Y, 3.2 * v.z, p.color, 0.55 + 0.3 * Math.sin(v.t * 4 + i));
        }
      },
      counts: () => ({ wisps: n }),
    };
  },
};

const leviathan: SystemDef<W, { color: string; length: number; often: number }> = {
  id: 'leviathan', label: 'a leviathan', tags: ['life'],
  weight: (_g, w) => 0.3 + w.land.isles * 3 + w.land.marsh * 1.5,
  params: (g) => ({ color: g.pick(['#5eead4', '#93c5fd', '#c4b5fd', '#fda4af']), length: g.int(26, 44), often: g.range(130, 220) }),
  create(w, p, g) {
    const segs: [number, number][] = [];
    let head = [w.W / 2, w.H / 2];
    let heading = g.unit() * Math.PI * 2;
    let shown = -1;
    let until = -1;
    const on = () => w.t < until;
    return {
      id: 'leviathan',
      step(dt) {
        if (!on() && w.director.want('leviathan', 0.55, p.often)) {
          shown = w.t;
          until = w.t + 70;
          head = [g.range(0.2, 0.8) * w.W, g.range(0.25, 0.75) * w.H];
          segs.length = 0;
          w.emit('leviathan', head[0], head[1], 0.6, 'THE LEVIATHAN');
          w.tell('THE LEVIATHAN RISES', p.color, true, 'something vast moves under the lines');
          w.look('leviathan', head[0], head[1], 1.3, 12, 5);
        }
        if (!on()) return;
        heading += Math.sin(w.t * 0.4 + shown) * dt * 0.6;
        // Keep off the edges.
        const cx = w.W / 2 - head[0];
        const cy = w.H / 2 - head[1];
        if (Math.hypot(cx, cy) > Math.min(w.W, w.H) * 0.35) heading += Math.atan2(Math.sin(Math.atan2(cy, cx) - heading), Math.cos(Math.atan2(cy, cx) - heading)) * dt * 0.8;
        head = [head[0] + Math.cos(heading) * 22 * dt, head[1] + Math.sin(heading) * 22 * dt];
        segs.unshift([head[0], head[1]]);
        if (segs.length > p.length * 6) segs.length = p.length * 6;
        // Its wake stirs the lines.
        for (const o of alive(w)) w.phys.trails[o.slot].swirl(head[0] / w.cell, head[1] / w.cell, 5, 0.12, 0);
      },
      paint(pass, ctx) {
        if (!on() || pass !== 'glow') return;
        const v = w.view!;
        const k = Math.min(1, (w.t - shown) / 5, (until - w.t) / 5);
        for (let i = 0; i < segs.length; i += 6) {
          const [x, y] = segs[i];
          const u = i / segs.length;
          const r = (7 + Math.sin(u * Math.PI) * 9) * v.z;
          v.glow(ctx, v.sx(x), v.sy(y), r * 1.8, p.color, 0.25 * k * (1 - u * 0.6));
          ctx.fillStyle = hexA(p.color, 0.55 * k * (1 - u));
          ctx.beginPath();
          ctx.arc(v.sx(x), v.sy(y), r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        if (segs.length) v.glow(ctx, v.sx(segs[0][0]), v.sy(segs[0][1]), 14 * v.z, '#ffffff', 0.6 * k);
      },
    };
  },
};

const pilgrims: SystemDef<W, { often: number; color: string }> = {
  id: 'pilgrims', label: 'pilgrims', tags: ['life'],
  weight: 1,
  params: (g) => ({ often: g.range(35, 70), color: g.pick(['#fde68a', '#fed7aa', '#fef3c7']) }),
  create(w, p, g) {
    const bands: { x: number; y: number; tx: number; ty: number; n: number; t0: number; trail: [number, number][] }[] = [];
    return {
      id: 'pilgrims',
      step(dt) {
        if (bands.length < 3 && w.director.want('pilgrims', 0.15, p.often)) {
          const held = w.wells.filter((x) => x.owner >= 0);
          const a = g.pick(held.length > 1 ? held : w.wells);
          const b = g.pick(w.wells.filter((x) => x !== a && (x.owner === a.owner || held.length < 2)));
          if (a && b) {
            bands.push({ x: a.x, y: a.y, tx: b.x, ty: b.y, n: g.int(5, 12), t0: w.t, trail: [] });
            w.emit('pilgrims', a.x, a.y, 0.15);
          }
        }
        for (const b of bands) {
          const dx = b.tx - b.x;
          const dy = b.ty - b.y;
          const d = Math.hypot(dx, dy);
          const cx = b.x / w.cell;
          const cy = b.y / w.cell;
          // Toward the shrine, keeping to the lines where they run.
          const gx = w.total.sample(cx + 2, cy) - w.total.sample(cx - 2, cy);
          const gy = w.total.sample(cx, cy + 2) - w.total.sample(cx, cy - 2);
          const s = 9 * dt;
          b.x += (dx / Math.max(1, d)) * s + gx * 2 * dt;
          b.y += (dy / Math.max(1, d)) * s + gy * 2 * dt;
          b.trail.unshift([b.x, b.y]);
          if (b.trail.length > b.n * 14) b.trail.length = b.n * 14;
        }
        for (let i = bands.length - 1; i >= 0; i--) if (Math.hypot(bands[i].tx - bands[i].x, bands[i].ty - bands[i].y) < 6 || w.t - bands[i].t0 > 200) bands.splice(i, 1);
      },
      paint(pass, ctx) {
        if (pass !== 'glow') return;
        const v = w.view!;
        for (const b of bands) for (let k = 0; k < b.trail.length; k += 14) {
          const [x, y] = b.trail[k];
          v.glow(ctx, v.sx(x), v.sy(y), 4 * v.z, p.color, 0.8 * (0.7 + 0.3 * Math.sin(v.t * 5 + k)));
        }
      },
      counts: () => ({ pilgrims: bands.length }),
    };
  },
};

const migration: SystemDef<W, { often: number }> = {
  id: 'migration', label: 'migrations', tags: ['life'],
  weight: (_g, w) => 0.6 + w.land.marsh + w.land.steppe,
  params: (g) => ({ often: g.range(60, 110) }),
  create(w, p, g) {
    let flock: { x: number; y: number; dx: number; dy: number }[] = [];
    let vx = 0;
    let vy = 0;
    return {
      id: 'migration',
      step(dt) {
        if (!flock.length && w.director.want('migration', 0.15, p.often)) {
          const left = g.chance(0.5);
          const y0 = g.range(0.2, 0.8) * w.H;
          vx = (left ? 1 : -1) * g.range(40, 60);
          vy = g.range(-8, 8);
          const n = g.int(18, 60);
          flock = Array.from({ length: n }, (_v, i) => {
            const row = Math.floor(Math.sqrt(i));
            const side = i % 2 ? 1 : -1;
            return { x: (left ? -40 : w.W + 40) - Math.sign(vx) * row * 14, y: y0 + side * row * 9, dx: g.normal(0, 2), dy: g.normal(0, 2) };
          });
          w.emit('migration', left ? 40 : w.W - 40, y0, 0.15);
        }
        for (const b of flock) {
          b.x += vx * dt;
          b.y += vy * dt + Math.sin(w.t * 2 + b.dx) * dt * 4;
        }
        if (flock.length && flock.every((b) => b.x < -60 || b.x > w.W + 60)) flock = [];
      },
      paint(pass, ctx) {
        if (pass !== 'over' || !flock.length) return;
        const v = w.view!;
        ctx.strokeStyle = v.medium === 'vellum' ? 'rgba(40,30,20,0.7)' : 'rgba(226,232,240,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const b of flock) {
          const X = v.sx(b.x);
          const Y = v.sy(b.y);
          const f = Math.sin(v.t * 9 + b.dx * 5) * 2.5;
          ctx.moveTo(X - 4, Y - f);
          ctx.lineTo(X, Y);
          ctx.lineTo(X + 4, Y - f);
        }
        ctx.stroke();
      },
    };
  },
};

export const LIBRARY: SystemDef<W, any>[] = [storm, aurora, tide, mist, rift, blight, quake, eclipse, convergence, comet, starfall, wisps, leviathan, pilgrims, migration];

/** For tests and tools: every system id. */
export const SYSTEM_IDS = LIBRARY.map((s) => s.id);
export type { SystemInstance, Genome };
