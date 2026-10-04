/**
 * Martian weather radar. A topographic basemap (contour lines over craters with
 * real names), dust storm cells drifting on the wind, and a radar at Jezero that
 * repaints reflectivity only where its sweep passes, the way real radar data ages
 * between scans. Wind barbs, dust devils leaving tracks, a dBZ legend, the sol and
 * local solar time, and typed storm advisories.
 */
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import type { Schema } from '../../core/schema';
import { resolveOptions } from '../../core/schema';
import { fillCrisp, clamp01, createPhosphor, hash, hexA, mixRgb, mono, report, typed } from './kit';

const schema = {
  storms: { type: 'number', min: 1, max: 8, default: 4, step: 1, label: 'Storm cells' },
  sweep: { type: 'number', min: 3, max: 14, default: 6.5, label: 'Sweep period (s)' },
  contours: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Contours' },
  barbs: { type: 'boolean', default: true, label: 'Wind barbs' },
  activity: { type: 'number', min: 0, max: 3, default: 1, label: 'Surface activity (rover, landings, impacts)' },
} satisfies Schema;

const CRATERS = ['JEZERO', 'BELVA', 'HOLDEN', 'EBERSWALDE', 'GUSEV', 'SANTA FE', 'NERETVA'];
const GRID_W = 150;
const GRID_H = 94;

type Cell = { x: number; y: number; r: number; dbz: number; vx: number; vy: number; born: number; life: number; big?: boolean };
type P = { x: number; y: number };
const ORBITERS = ['MRO', 'MAVEN', 'TGO', 'ODYSSEY', 'TIANWEN-1'];
const CARGO = ['CARGO-3', 'HAB-2', 'ASCENT-1', 'CARGO-4', 'PROSPECT-7'];
type Devil = { x: number; y: number; vx: number; vy: number; born: number; life: number };

export const marsRadarSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'mars-radar',
  label: 'Martian weather radar',
  description: 'Dust storm radar over Jezero: contours, drifting storm cells, sweep-refreshed reflectivity, dust devils.',
  tags: ['instrument', 'mars', 'dark', 'rust'],
  crisp: true,
  schema,
  defaults: { palette: { from: '#f97316' }, intensity: 0.6 },
  mount(host: SkinHost) {
    const o = resolveOptions(schema, host.options);
    const { ctx, palette } = host;
    const rng = host.fork('mars');
    let W = host.viewport.width;
    let H = host.viewport.height;
    const accent = palette.accent;
    const ink = palette.ink;

    const base = document.createElement('canvas');
    const bctx = base.getContext('2d')!;
    const disp = document.createElement('canvas');
    disp.width = GRID_W;
    disp.height = GRID_H;
    const dctx = disp.getContext('2d')!;
    const dimg = dctx.createImageData(GRID_W, GRID_H);
    const tracks = createPhosphor();

    // Craters in grid space (0..1), the first is the radar's home.
    const craters = CRATERS.map((name, i) => ({
      name,
      x: i === 0 ? 0.36 : 0.08 + rng() * 0.86,
      y: i === 0 ? 0.56 : 0.1 + rng() * 0.8,
      r: i === 0 ? 0.07 : 0.025 + rng() * 0.05,
    }));
    const station = craters[0];
    const height = (u: number, v: number) => {
      let h = host.noise.fbm2(u * 3.2, v * 2.2, 5) * 0.6 + u * 0.35;
      for (const c of craters) {
        const d = Math.hypot((u - c.x) * 1.6, v - c.y) / c.r;
        if (d < 1.6) h += d < 1 ? -0.35 * (1 - d * d) : 0.18 * Math.max(0, 1 - Math.abs(d - 1.12) * 3);
      }
      return h;
    };

    // Contours: marching squares over the height grid, drawn once per size.
    const drawBase = () => {
      base.width = Math.max(1, Math.round(W * host.viewport.dpr));
      base.height = Math.max(1, Math.round(H * host.viewport.dpr));
      bctx.setTransform(host.viewport.dpr, 0, 0, host.viewport.dpr, 0, 0);
      const gx = 120;
      const gy = Math.round((gx * H) / W);
      const field: number[] = [];
      for (let j = 0; j <= gy; j++) for (let i = 0; i <= gx; i++) field.push(height(i / gx, j / gy));
      const at = (i: number, j: number) => field[j * (gx + 1) + i];
      const cw = W / gx;
      const ch = H / gy;
      for (let level = -1; level <= 1.2; level += 0.06) {
        const major = Math.round(level / 0.06) % 5 === 0;
        bctx.strokeStyle = hexA(accent, (major ? 0.24 : 0.11) * o.contours);
        bctx.lineWidth = major ? 1 : 0.7;
        bctx.beginPath();
        for (let j = 0; j < gy; j++) {
          for (let i = 0; i < gx; i++) {
            const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
            const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x = i * cw;
            const y = j * ch;
            const lerp = (p: number, q: number) => (level - p) / (q - p || 1e-6);
            const top = [x + lerp(a, b) * cw, y];
            const right = [x + cw, y + lerp(b, c) * ch];
            const bottom = [x + lerp(d, c) * cw, y + ch];
            const left = [x, y + lerp(a, d) * ch];
            const seg = (p: number[], q: number[]) => {
              bctx.moveTo(p[0], p[1]);
              bctx.lineTo(q[0], q[1]);
            };
            switch (idx) {
              case 1: case 14: seg(left, bottom); break;
              case 2: case 13: seg(bottom, right); break;
              case 3: case 12: seg(left, right); break;
              case 4: case 11: seg(top, right); break;
              case 6: case 9: seg(top, bottom); break;
              case 7: case 8: seg(left, top); break;
              case 5: seg(left, top); seg(bottom, right); break;
              case 10: seg(top, right); seg(left, bottom); break;
            }
          }
        }
        bctx.stroke();
      }
      bctx.font = mono(9);
      bctx.textAlign = 'center';
      bctx.textBaseline = 'top';
      for (const c of craters) {
        bctx.fillStyle = hexA(ink, 0.4);
        bctx.fillText(c.name, c.x * W, c.y * H + c.r * H + 6);
      }
    };

    // Reflectivity field: storm cells drifting on a steady wind, plus fine texture.
    const wind = { dir: 220 + rng() * 40, speed: 14 + rng() * 10 };
    const windVec = () => {
      const a = ((wind.dir + 180) * Math.PI) / 180; // blowing toward
      return { x: Math.sin(a), y: -Math.cos(a) };
    };
    const cells: Cell[] = [];
    const newCell = (t: number, anywhere: boolean): Cell => {
      const w = windVec();
      const sp = (0.006 + rng() * 0.006) * (wind.speed / 18);
      return {
        x: anywhere ? rng() : w.x > 0 ? -0.1 : 1.1,
        y: anywhere ? rng() : rng(),
        r: 0.06 + rng() * 0.1,
        dbz: 18 + rng() * 34,
        vx: w.x * sp,
        vy: w.y * sp,
        born: t,
        life: 60 + rng() * 120,
      };
    };
    for (let i = 0; i < o.storms; i++) cells.push(newCell(-rng() * 60, true));
    const dbzAt = (u: number, v: number, t: number) => {
      let z = 0;
      for (const c of cells) {
        const d2 = ((u - c.x) * 1.6) ** 2 + (v - c.y) ** 2;
        const life = clamp01((t - c.born) / 8) * clamp01((c.born + c.life - t) / 10);
        z = Math.max(z, c.dbz * life * Math.exp(-d2 / (c.r * c.r)));
      }
      const tex = host.noise.fbm2(u * 9 + t * 0.02, v * 9, 3);
      return z * (0.75 + 0.35 * tex) + (tex > 0.35 ? 6 : 0);
    };
    const STOPS: [number, string][] = [[5, '#3b0d06'], [15, '#7c2d12'], [25, '#c2410c'], [35, '#f97316'], [45, '#fbbf24'], [55, '#fef3c7']];
    const colorOf = (z: number): [number, number, number, number] => {
      if (z < 5) return [0, 0, 0, 0];
      for (let i = 1; i < STOPS.length; i++) {
        if (z <= STOPS[i][0] || i === STOPS.length - 1) {
          const [z0, c0] = STOPS[i - 1];
          const [z1, c1] = STOPS[i];
          const rgb = mixRgb(c0, c1, clamp01((z - z0) / (z1 - z0)));
          return [rgb[0], rgb[1], rgb[2], Math.round(255 * clamp01(0.35 + (z - 5) / 40))];
        }
      }
      return [0, 0, 0, 0];
    };

    // Grid cells bucketed by bearing from the radar, so the sweep only touches what it crosses.
    let buckets: number[][] = [];
    let range = 1;
    const layout = () => {
      drawBase();
      tracks.resize(W, H, host.viewport.dpr);
      buckets = Array.from({ length: 360 }, () => []);
      range = Math.hypot(Math.max(station.x, 1 - station.x) * W, Math.max(station.y, 1 - station.y) * H);
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          const dx = (i / GRID_W - station.x) * W;
          const dy = (j / GRID_H - station.y) * H;
          const b = Math.floor((((Math.atan2(dy, dx) * 180) / Math.PI) + 360) % 360);
          buckets[b].push(j * GRID_W + i);
        }
      }
      // Paint one full scan so the display is not empty at mount.
      for (let b = 0; b < 360; b++) paint(b, 0);
      dctx.putImageData(dimg, 0, 0);
    };
    const paint = (bucket: number, t: number) => {
      for (const idx of buckets[bucket]) {
        const i = idx % GRID_W;
        const j = (idx - i) / GRID_W;
        const [r, g, b, a] = colorOf(dbzAt(i / GRID_W, j / GRID_H, t));
        dimg.data[idx * 4] = r;
        dimg.data[idx * 4 + 1] = g;
        dimg.data[idx * 4 + 2] = b;
        dimg.data[idx * 4 + 3] = a;
      }
    };

    const devils: Devil[] = [];
    let nextDevil = 2;
    let sweep = 0;
    let advisory: { text: string; at: number } | null = null;
    let nextAdvisory = 6;

    // Surface operations, on their own stream so the weather stays the same per seed:
    // a rover driving and sampling, a helicopter scouting ahead of it, orbiters passing
    // over for relay, meteors, the occasional landing, and regional storm watches.
    const ops = host.fork('mars-ops');
    const every = (base: number) => (base * (0.7 + ops() * 0.6)) / Math.max(0.15, o.activity);
    const lmstAt = (t: number) => 14 * 60 + 22 + Math.floor(t * 0.5);
    const clock = (t: number) => {
      const m = lmstAt(t);
      return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    };
    const log: { text: string; at: number }[] = [];
    const note = (text: string, t: number) => {
      log.push({ text, at: t });
      if (log.length > 5) log.shift();
    };
    const rover = { x: station.x + 0.025, y: station.y + 0.04, hdg: 0, target: null as P | null, until: 0, sampling: false, sample: 24 + Math.floor(ops() * 12), odo: 18.4 + ops() * 6, safed: false };
    const trail: P[] = [{ x: rover.x, y: rover.y }];
    const heli = { x: rover.x + 0.01, y: rover.y - 0.01, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, start: -1, dur: 9, flight: 60 + Math.floor(ops() * 20), next: 10 + ops() * 8 };
    const impacts: { x: number; y: number; r: number; at: number; m: number }[] = [];
    let meteor: { a: P; b: P; at: number } | null = null;
    let nextMeteor = every(45);
    let pass: { name: string; a: P; b: P; at: number; dur: number; mb: number; aos: number } | null = null;
    let nextPass = 5 + ops() * 8;
    const PHASES: [number, string][] = [[0, 'ENTRY INTERFACE'], [0.28, 'PEAK HEATING'], [0.55, 'PARACHUTE DEPLOY'], [0.8, 'POWERED DESCENT']];
    let edl: { to: P; from: P; at: number; dur: number; name: string; phase: number } | null = null;
    let nextEdl = every(110);
    const landers: (P & { name: string })[] = [];
    let watchEnds = -1;
    let nextWatch = every(150);
    const px = (p: P) => ({ x: p.x * W, y: p.y * H });

    const operate = (t: number, dt: number) => {
      if (dt <= 0) return;
      // Rover: drive to a nearby waypoint, sometimes stop to abrade and core a sample.
      if (!rover.safed && t >= rover.until) {
        if (rover.sampling) {
          rover.sampling = false;
          note(`ROVER · SAMPLE ${rover.sample} SEALED`, t);
        }
        if (!rover.target) {
          const a = ops() * Math.PI * 2;
          const d = 0.03 + ops() * 0.05;
          rover.target = { x: Math.min(0.9, Math.max(0.1, station.x + Math.cos(a) * d * 1.3)), y: Math.min(0.9, Math.max(0.1, station.y + Math.sin(a) * d * 1.6)) };
          report(host, 'drive', 0.2, rover.x);
        }
        const dx = (rover.target.x - rover.x) * W;
        const dy = (rover.target.y - rover.y) * H;
        const dist = Math.hypot(dx, dy);
        const stepPx = Math.min(dist, 5 * dt);
        if (dist > 0.5) {
          rover.hdg = Math.atan2(dy, dx);
          rover.x += (dx / dist) * (stepPx / W);
          rover.y += (dy / dist) * (stepPx / H);
          rover.odo += stepPx * 0.004;
          const last = trail[trail.length - 1];
          if (Math.hypot((rover.x - last.x) * W, (rover.y - last.y) * H) > 3) {
            trail.push({ x: rover.x, y: rover.y });
            if (trail.length > 500) trail.shift();
          }
        } else {
          rover.target = null;
          if (ops() < 0.45) {
            rover.sampling = true;
            rover.sample++;
            rover.until = t + 9 + ops() * 6;
            note(`ROVER · ABRADING · CORING SAMPLE ${rover.sample}`, t);
            report(host, 'core', 0.35, rover.x);
          } else rover.until = t + 1.5 + ops() * 3;
        }
      }
      // Helicopter: scouts a hop ahead of the rover, then waits for the next window.
      if (heli.start < 0 && t >= heli.next && !rover.safed) {
        const a = ops() * Math.PI * 2;
        heli.from = { x: heli.x, y: heli.y };
        heli.to = { x: Math.min(0.92, Math.max(0.08, rover.x + Math.cos(a) * 0.05)), y: Math.min(0.92, Math.max(0.08, rover.y + Math.sin(a) * 0.07)) };
        heli.start = t;
        heli.flight++;
        const m = Math.round(Math.hypot((heli.to.x - heli.from.x) * W, (heli.to.y - heli.from.y) * H) * 9);
        note(`INGENUITY · FLIGHT ${heli.flight} · ${m} M HOP`, t);
        report(host, 'flight', 0.35, heli.x);
      }
      if (heli.start >= 0 && t >= heli.start + heli.dur) {
        heli.x = heli.to.x;
        heli.y = heli.to.y;
        heli.start = -1;
        heli.next = t + every(30);
      }
      // Meteors: a streak, a flash, a new crater that stays on the map.
      if (!meteor && t >= nextMeteor) {
        const b = { x: 0.08 + ops() * 0.84, y: 0.12 + ops() * 0.76 };
        const a = ops() * Math.PI * 2;
        meteor = { a: { x: b.x + Math.cos(a) * 0.3, y: b.y - Math.abs(Math.sin(a)) * 0.35 }, b, at: t };
        nextMeteor = t + every(55);
      }
      if (meteor && t >= meteor.at + 1.3) {
        const m = Math.round(3 + ops() * 11);
        impacts.push({ ...meteor.b, r: 2 + m * 0.35, at: t, m });
        if (impacts.length > 8) impacts.shift();
        note(`NEW IMPACT · ${m} M CRATER · ORBITAL IMAGING REQUESTED`, t);
        report(host, 'meteor', 0.7, meteor.b.x);
        meteor = null;
      }
      // Orbiter passes: a ground track across the map, a relay window when it sees the rover.
      if (!pass && t >= nextPass) {
        const tilt = (ops() - 0.5) * 0.7;
        const cx = Math.min(0.9, Math.max(0.1, rover.x + (ops() - 0.5) * 0.4));
        const dir = { x: Math.sin(tilt), y: Math.cos(tilt) };
        const north = ops() < 0.5 ? 1 : -1;
        pass = {
          name: ORBITERS[Math.floor(ops() * ORBITERS.length)],
          a: { x: cx - dir.x * 0.75 * north, y: rover.y - dir.y * 0.75 * north },
          b: { x: cx + dir.x * 0.75 * north, y: rover.y + dir.y * 0.75 * north },
          at: t,
          dur: 28 + ops() * 10,
          mb: 0,
          aos: -1,
        };
        nextPass = t + every(48);
      }
      if (pass) {
        const k = (t - pass.at) / pass.dur;
        const o2 = { x: pass.a.x + (pass.b.x - pass.a.x) * k, y: pass.a.y + (pass.b.y - pass.a.y) * k };
        const seen = Math.hypot((o2.x - rover.x) * W, (o2.y - rover.y) * H) < Math.min(W, H) * 0.16;
        if (seen) {
          if (pass.aos < 0) {
            pass.aos = t;
            note(`${pass.name} · UHF RELAY · AOS`, t);
            report(host, 'pass', 0.25, o2.x);
          }
          pass.mb += dt * (18 + 10 * Math.sin(t));
        } else if (pass.aos >= 0 && pass.mb > 0) {
          note(`${pass.name} · LOS · ${Math.round(pass.mb)} MB RELAYED`, t);
          pass.mb = -1;
        }
        if (k >= 1) pass = null;
      }
      // Entry, descent and landing: rare, watched start to finish.
      if (!edl && t >= nextEdl) {
        const to = { x: 0.15 + ops() * 0.7, y: 0.2 + ops() * 0.6 };
        const left = ops() < 0.5;
        edl = { to, from: { x: left ? -0.08 : 1.08, y: to.y - 0.25 - ops() * 0.2 }, at: t, dur: 24, name: CARGO[Math.floor(ops() * CARGO.length)], phase: -1 };
        nextEdl = t + every(190);
        report(host, 'entry', 0.5, edl.from.x);
      }
      if (edl) {
        const k = (t - edl.at) / edl.dur;
        let ph = 0;
        for (let i = 0; i < PHASES.length; i++) if (k >= PHASES[i][0]) ph = i;
        if (ph !== edl.phase) {
          edl.phase = ph;
          note(`${edl.name} · ${PHASES[ph][1]}`, t);
        }
        if (k >= 1) {
          landers.push({ ...edl.to, name: edl.name });
          if (landers.length > 3) landers.shift();
          note(`${edl.name} · TOUCHDOWN CONFIRMED`, t);
          report(host, 'landing', 0.7, edl.to.x);
          edl = null;
        }
      }
      // Storm watch: a big cell rolls in on the wind; the rover parks until it passes.
      if (watchEnds < 0 && t >= nextWatch) {
        const w = windVec();
        const sp = 0.012 * (wind.speed / 18);
        cells.push({ x: station.x - w.x * 0.42, y: station.y - w.y * 0.42, r: 0.2, dbz: 56, vx: w.x * sp, vy: w.y * sp, born: t, life: 90, big: true });
        rover.safed = true;
        watchEnds = t + 55;
        note('REGIONAL DUST STORM WATCH · ROVER SAFED', t);
        report(host, 'storm', 0.6, station.x - w.x * 0.42);
        nextWatch = t + every(220);
      }
      if (watchEnds >= 0 && t >= watchEnds) {
        rover.safed = false;
        watchEnds = -1;
        note('STORM WATCH LIFTED · DRIVING RESUMES', t);
        report(host, 'clear', 0.3);
      }
    };
    note('SOL PLAN UPLINKED · DRIVE + SAMPLE', -90);
    note(`INGENUITY · FLIGHT ${heli.flight} · NOMINAL`, -50);
    layout();

    return {
      resize(v: Viewport) {
        W = v.width;
        H = v.height;
        layout();
      },
      frame(info: FrameInfo) {
        const t = info.t;
        const dt = host.motion === 'off' ? 0 : info.dt;
        const level = 0.55 + 0.45 * host.intensity;

        // Weather moves.
        for (let i = cells.length - 1; i >= 0; i--) {
          const c = cells[i];
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          if (t > c.born + c.life || c.x < -0.3 || c.x > 1.3 || c.y < -0.3 || c.y > 1.3) {
            if (c.big) cells.splice(i, 1);
            else cells.splice(i, 1, newCell(t, false));
          }
        }
        if (t >= nextDevil) {
          const ang = rng() * Math.PI * 2;
          devils.push({ x: 0.1 + rng() * 0.8, y: 0.15 + rng() * 0.7, vx: Math.cos(ang) * 0.012, vy: Math.sin(ang) * 0.012, born: t, life: 18 + rng() * 14 });
          nextDevil = t + 14 + rng() * 18;
          report(host, 'devil', 0.2, devils[devils.length - 1].x);
        }
        tracks.decay(dt, 90);
        for (let i = devils.length - 1; i >= 0; i--) {
          const d = devils[i];
          const px0 = d.x * W;
          const py0 = d.y * H;
          d.x += d.vx * dt;
          d.y += (d.vy + Math.sin(t * 0.7 + i) * 0.004) * dt;
          if (dt > 0) {
            tracks.ctx.strokeStyle = hexA('#000000', 0.5);
            tracks.ctx.lineWidth = 2;
            tracks.ctx.beginPath();
            tracks.ctx.moveTo(px0, py0);
            tracks.ctx.lineTo(d.x * W, d.y * H);
            tracks.ctx.stroke();
          }
          if (t > d.born + d.life) devils.splice(i, 1);
        }
        operate(t, dt);

        // Sweep: refresh the reflectivity buckets it crossed.
        const prev = sweep;
        sweep += (dt / o.sweep) * 360;
        const fromB = Math.floor(prev);
        const toB = Math.floor(sweep);
        for (let b = fromB; b < toB && b < fromB + 360; b++) paint(((b % 360) + 360) % 360, t);
        if (toB > fromB) dctx.putImageData(dimg, 0, 0);

        // Plate and basemap.
        ctx.fillStyle = palette.bg;
        ctx.fillRect(0, 0, W, H);
        const tint = ctx.createRadialGradient(station.x * W, station.y * H, 0, station.x * W, station.y * H, range);
        tint.addColorStop(0, hexA(accent, 0.09));
        tint.addColorStop(1, hexA(accent, 0.01));
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.globalAlpha = level;
        ctx.drawImage(base, 0, 0, W, H);
        tracks.draw(ctx, W, H, 'source-over');
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 0.85 * level;
        ctx.drawImage(disp, 0, 0, W, H);
        ctx.restore();

        // Fresh craters and the rover's tracks, part of the ground.
        ctx.lineWidth = 1;
        for (const c of impacts) {
          const p = px(c);
          const age = t - c.at;
          ctx.strokeStyle = hexA(ink, 0.45 * level);
          ctx.beginPath();
          ctx.arc(p.x, p.y, c.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = hexA('#fde68a', 0.18 * level);
          ctx.beginPath();
          ctx.arc(p.x, p.y, c.r * 2.4, 0, Math.PI * 2);
          ctx.stroke();
          if (age < 2) {
            // The flash, and the ring of ejecta going out.
            const k = age / 2;
            ctx.fillStyle = hexA('#fff7ed', (1 - k) * 0.8 * level);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 + k * 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = hexA('#fde68a', (1 - k) * 0.7 * level);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 + k * 46, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (trail.length > 1) {
          ctx.strokeStyle = hexA(ink, 0.32 * level);
          ctx.lineWidth = 2;
          ctx.setLineDash([1, 2]);
          ctx.beginPath();
          ctx.moveTo(trail[0].x * W, trail[0].y * H);
          for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x * W, trail[i].y * H);
          ctx.lineTo(rover.x * W, rover.y * H);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineWidth = 1;
        }

        // Range rings and the sweep.
        const sx = station.x * W;
        const sy = station.y * H;
        const kmPx = Math.min(W, H) / 400;
        ctx.strokeStyle = hexA(ink, 0.14 * level);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let km = 50; km * kmPx < range; km += 50) {
          ctx.moveTo(sx + km * kmPx, sy);
          ctx.arc(sx, sy, km * kmPx, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.fillStyle = hexA(ink, 0.35 * level);
        ctx.font = mono(8);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        for (let km = 50; km <= 200; km += 50) fillCrisp(ctx, `${km} KM`, sx + 3, sy - km * kmPx - 2);
        const ang = (sweep * Math.PI) / 180;
        for (let i = 0; i < 12; i++) {
          const a0 = ang - (i + 1) * 0.025;
          const a1 = ang - i * 0.025;
          ctx.fillStyle = hexA(ink, 0.05 * (1 - i / 12) * level);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a0) * range, sy + Math.sin(a0) * range);
          ctx.lineTo(sx + Math.cos(a1) * range, sy + Math.sin(a1) * range);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = hexA(ink, 0.5 * level);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(ang) * range, sy + Math.sin(ang) * range);
        ctx.stroke();
        ctx.fillStyle = hexA(ink, 0.9 * level);
        ctx.beginPath();
        ctx.moveTo(sx, sy - 6);
        ctx.lineTo(sx + 5, sy + 4);
        ctx.lineTo(sx - 5, sy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.font = mono(10);
        ctx.textBaseline = 'middle';
        fillCrisp(ctx, 'JEZERO WX-2', sx + 10, sy);

        // Dust devils: a small turning glyph.
        ctx.font = mono(11);
        ctx.textAlign = 'center';
        for (const d of devils) {
          const a = clamp01((t - d.born) / 2) * clamp01((d.born + d.life - t) / 2) * level;
          ctx.fillStyle = hexA('#fde68a', 0.85 * a);
          fillCrisp(ctx, ['@', '6', '@', '9'][Math.floor(t * 8) % 4], d.x * W, d.y * H);
          ctx.strokeStyle = hexA('#fde68a', 0.3 * a);
          ctx.beginPath();
          ctx.arc(d.x * W, d.y * H, 9 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Landers on the ground, and one coming down.
        ctx.font = mono(8);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const l of landers) {
          const p = px(l);
          ctx.strokeStyle = hexA(ink, 0.6 * level);
          ctx.strokeRect(Math.round(p.x) - 2.5, Math.round(p.y) - 2.5, 5, 5);
          ctx.beginPath();
          ctx.moveTo(p.x - 2, p.y + 3);
          ctx.lineTo(p.x - 5, p.y + 6);
          ctx.moveTo(p.x + 2, p.y + 3);
          ctx.lineTo(p.x + 5, p.y + 6);
          ctx.stroke();
          ctx.fillStyle = hexA(ink, 0.45 * level);
          fillCrisp(ctx, l.name, p.x + 9, p.y);
        }
        if (edl) {
          const k = clamp01((t - edl.at) / edl.dur);
          const to = px(edl.to);
          ctx.strokeStyle = hexA(accent, 0.5 * level);
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.ellipse(to.x, to.y, 34 * (1 - k * 0.6), 14 * (1 - k * 0.6), -0.3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = hexA(accent, 0.6 * level);
          fillCrisp(ctx, `${edl.name} · LANDING ELLIPSE`, to.x + 38, to.y - 10);
          const { from, to: dest } = edl;
          const at = (q: number) => {
            const e = 1 - (1 - q) ** 2.4;
            return { x: (from.x + (dest.x - from.x) * e) * W, y: (from.y + (dest.y - from.y) * e) * H - Math.sin(q * Math.PI) * 30 };
          };
          const pos = at(k);
          // The path so far, hot while it is still hypersonic.
          ctx.strokeStyle = hexA(k < 0.5 ? '#fde68a' : ink, 0.5 * level);
          ctx.beginPath();
          for (let q = Math.max(0, k - 0.3); q <= k; q += 0.01) {
            const s = at(q);
            if (q === Math.max(0, k - 0.3)) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          }
          ctx.stroke();
          if (k < 0.55) {
            const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 10);
            g.addColorStop(0, hexA('#fff7ed', 0.9 * level));
            g.addColorStop(1, hexA('#f97316', 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = hexA(ink, 0.9 * level);
            ctx.fillRect(Math.round(pos.x) - 2, Math.round(pos.y) - 2, 4, 4);
            if (k < 0.8) {
              ctx.strokeStyle = hexA(ink, 0.7 * level);
              ctx.beginPath();
              ctx.arc(pos.x, pos.y - 10, 6, Math.PI, 0);
              ctx.moveTo(pos.x - 6, pos.y - 10);
              ctx.lineTo(pos.x, pos.y - 2);
              ctx.lineTo(pos.x + 6, pos.y - 10);
              ctx.stroke();
            } else {
              ctx.fillStyle = hexA('#fde68a', (0.5 + 0.5 * Math.sin(t * 40)) * 0.7 * level);
              ctx.fillRect(Math.round(pos.x) - 1, Math.round(pos.y) + 3, 2, 4);
            }
          }
          ctx.fillStyle = hexA(accent, 0.85 * level);
          fillCrisp(ctx, PHASES[Math.max(0, edl.phase)][1], pos.x + 12, pos.y);
        }

        // Rover and helicopter.
        {
          const p = px(rover);
          ctx.save();
          ctx.translate(Math.round(p.x), Math.round(p.y));
          ctx.rotate(rover.hdg);
          ctx.fillStyle = hexA(ink, 0.95 * level);
          ctx.fillRect(-4, -2.5, 8, 5);
          ctx.fillStyle = hexA(accent, 0.9 * level);
          ctx.fillRect(3, -1, 2, 2);
          ctx.restore();
          if (rover.sampling) {
            ctx.strokeStyle = hexA(accent, (0.4 + 0.4 * Math.sin(t * 5)) * level);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = hexA(ink, 0.6 * level);
          fillCrisp(ctx, rover.safed ? 'PERSEVERANCE · SAFED' : rover.sampling ? `PERSEVERANCE · CORING ${rover.sample}` : 'PERSEVERANCE', p.x + 9, p.y + 9);
          let h = { x: heli.x, y: heli.y };
          let alt = 0;
          if (heli.start >= 0) {
            const k = clamp01((t - heli.start) / heli.dur);
            const e = k * k * (3 - 2 * k);
            h = { x: heli.from.x + (heli.to.x - heli.from.x) * e, y: heli.from.y + (heli.to.y - heli.from.y) * e };
            alt = Math.min(1, Math.sin(k * Math.PI) * 1.6);
          }
          const hp = px(h);
          ctx.fillStyle = hexA('#000000', 0.5 * level);
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 2, 0, Math.PI * 2);
          ctx.fill();
          const lift = alt * 14;
          const spin = heli.start >= 0 ? t * 30 : 0.6;
          ctx.strokeStyle = hexA(ink, 0.9 * level);
          ctx.beginPath();
          for (const r of [spin, spin + Math.PI / 2]) {
            ctx.moveTo(hp.x - Math.cos(r) * 5, hp.y - lift - Math.sin(r) * 2);
            ctx.lineTo(hp.x + Math.cos(r) * 5, hp.y - lift + Math.sin(r) * 2);
          }
          ctx.stroke();
          if (heli.start >= 0) {
            ctx.fillStyle = hexA(ink, 0.6 * level);
            fillCrisp(ctx, `INGENUITY · ALT ${Math.round(alt * 12)} M`, hp.x + 9, hp.y - lift - 6);
          }
        }

        // An orbiter crossing: its ground track, footprint, and the relay link while it sees the rover.
        if (pass) {
          const k = (t - pass.at) / pass.dur;
          const a = px(pass.a);
          const b = px(pass.b);
          const o2 = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
          ctx.strokeStyle = hexA(ink, 0.12 * level);
          ctx.setLineDash([2, 6]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = hexA(ink, 0.35 * level);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(o2.x, o2.y);
          ctx.stroke();
          const foot = Math.min(W, H) * 0.16;
          ctx.strokeStyle = hexA(ink, 0.12 * level);
          ctx.beginPath();
          ctx.arc(o2.x, o2.y, foot, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = hexA(ink, 0.9 * level);
          ctx.fillRect(Math.round(o2.x) - 2, Math.round(o2.y) - 2, 4, 4);
          ctx.fillRect(Math.round(o2.x) - 9, Math.round(o2.y) - 0.5, 5, 1);
          ctx.fillRect(Math.round(o2.x) + 4, Math.round(o2.y) - 0.5, 5, 1);
          ctx.fillStyle = hexA(ink, 0.6 * level);
          const live = pass.aos >= 0 && pass.mb >= 0;
          fillCrisp(ctx, live ? `${pass.name} · ↓ ${Math.round(pass.mb)} MB` : pass.name, o2.x + 12, o2.y);
          if (live) {
            const r = px(rover);
            ctx.strokeStyle = hexA(accent, (0.35 + 0.3 * Math.sin(t * 9)) * level);
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -t * 30;
            ctx.beginPath();
            ctx.moveTo(r.x, r.y);
            ctx.lineTo(o2.x, o2.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
          }
        }

        // A meteor on its way in.
        if (meteor) {
          const k = clamp01((t - meteor.at) / 1.3);
          const a = px(meteor.a);
          const b = px(meteor.b);
          const hx = a.x + (b.x - a.x) * k;
          const hy = a.y + (b.y - a.y) * k;
          const tk = Math.max(0, k - 0.3);
          const g = ctx.createLinearGradient(a.x + (b.x - a.x) * tk, a.y + (b.y - a.y) * tk, hx, hy);
          g.addColorStop(0, hexA('#fde68a', 0));
          g.addColorStop(1, hexA('#fff7ed', 0.95 * level));
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a.x + (b.x - a.x) * tk, a.y + (b.y - a.y) * tk);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Wind barbs.
        if (o.barbs) {
          const w = windVec();
          const from = Math.atan2(-w.y, -w.x);
          ctx.strokeStyle = hexA(ink, 0.32 * level);
          ctx.lineWidth = 1;
          for (let j = 1; j <= 4; j++) {
            for (let i = 1; i <= 7; i++) {
              const x = (i / 8) * W;
              const y = (j / 5) * H;
              const local = from + host.noise.noise2(i * 0.7, j * 0.7 + t * 0.01) * 0.4;
              const speed = wind.speed * (0.8 + 0.4 * (host.noise.noise2(i * 0.5 + 9, j * 0.5) * 0.5 + 0.5));
              const len = 22;
              const ex = x + Math.cos(local) * len;
              const ey = y + Math.sin(local) * len;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(ex, ey);
              let left = speed;
              let k = 0;
              while (left >= 5 && k < 5) {
                const full = left >= 10;
                const bx = ex - Math.cos(local) * k * 4;
                const by = ey - Math.sin(local) * k * 4;
                const bl = full ? 9 : 5;
                ctx.moveTo(bx, by);
                ctx.lineTo(bx + Math.cos(local + 1.2) * bl, by + Math.sin(local + 1.2) * bl);
                left -= full ? 10 : 5;
                k++;
              }
              ctx.stroke();
            }
          }
        }

        // Legend.
        const lx = W - 34;
        const ly = H - 150;
        for (let z = 5; z <= 55; z += 1) {
          const [r, g, b, a] = colorOf(z);
          ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255) * level})`;
          ctx.fillRect(lx, ly + (55 - z) * 2.2, 10, 2.3);
        }
        ctx.fillStyle = hexA(ink, 0.5 * level);
        ctx.font = mono(8);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let z = 10; z <= 50; z += 10) fillCrisp(ctx, String(z), lx - 4, ly + (55 - z) * 2.2);
        fillCrisp(ctx, 'DBZ', lx + 12, ly - 10);

        // Readouts.
        const lmst = 14 * 60 + 22 + Math.floor(t * 0.5);
        ctx.font = mono(10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = hexA(ink, 0.6 * level);
        fillCrisp(ctx, `SOL ${1204 + Math.floor(lmst / 1440)} · LMST ${String(Math.floor(lmst / 60) % 24).padStart(2, '0')}:${String(lmst % 60).padStart(2, '0')}`, 18, 16);
        ctx.fillStyle = hexA(ink, 0.45 * level);
        fillCrisp(ctx, `TAU ${(1.6 + cells.reduce((s, c) => s + c.dbz, 0) / 120).toFixed(1)} · 6.1 MBAR · −63°C`, 18, 30);
        fillCrisp(ctx, `WIND ${Math.round(wind.dir)}° ${Math.round(wind.speed)} M/S`, 18, 44);
        fillCrisp(ctx, `ROVER ODO ${rover.odo.toFixed(2)} KM · ${rover.sample} SAMPLES CACHED`, 18, 58);

        // Advisory when a strong cell is near the station.
        if (!advisory && t >= nextAdvisory) {
          const strong = cells
            .map((c) => ({ c, km: Math.hypot((c.x - station.x) * W, (c.y - station.y) * H) / kmPx }))
            .filter((x) => x.c.dbz > 32 && x.km < 260)
            .sort((a, b) => a.km - b.km)[0];
          if (strong) {
            const brg = Math.round((((Math.atan2(strong.c.y - station.y, strong.c.x - station.x) * 180) / Math.PI) + 450) % 360);
            const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            advisory = { text: `ADVISORY · DUST CELL ${Math.round(strong.c.dbz)} DBZ · ${Math.round(strong.km)} KM ${dirs[Math.round(brg / 45) % 8]} · MOVING ${String(Math.round(wind.dir + 180) % 360).padStart(3, '0')} AT ${Math.round(wind.speed)} M/S`, at: t };
          }
          nextAdvisory = t + 16 + hash(Math.floor(t), 3) * 14;
        }
        if (advisory) {
          const age = t - advisory.at;
          if (age > 10) advisory = null;
          else {
            ctx.font = mono(11);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = hexA(accent, 0.95 * level * clamp01((10 - age) * 2));
            fillCrisp(ctx, typed(advisory.text, age, 34, t), 18, H - 14);
          }
        }

        // Ops log: the shift so far, newest at the bottom, typed in.
        ctx.font = mono(9);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const logX = Math.max(W * 0.5, W - 330);
        ctx.fillStyle = hexA(ink, 0.4 * level);
        fillCrisp(ctx, 'OPS LOG', logX, 16);
        log.forEach((e, i) => {
          const age = t - e.at;
          const newest = i === log.length - 1;
          ctx.fillStyle = hexA(newest && age < 6 ? accent : ink, (newest ? 0.85 : 0.35 + 0.1 * i) * level);
          fillCrisp(ctx, `${clock(e.at)}  ${newest ? typed(e.text, age, 40, t) : e.text}`, logX, 30 + i * 13);
        });
      },
      destroy() {},
    };
  },
};
