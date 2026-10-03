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
import { clamp01, createPhosphor, hash, hexA, mixRgb, mono, typed } from './kit';

const schema = {
  storms: { type: 'number', min: 1, max: 8, default: 4, step: 1, label: 'Storm cells' },
  sweep: { type: 'number', min: 3, max: 14, default: 6.5, label: 'Sweep period (s)' },
  contours: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Contours' },
  barbs: { type: 'boolean', default: true, label: 'Wind barbs' },
} satisfies Schema;

const CRATERS = ['JEZERO', 'BELVA', 'HOLDEN', 'EBERSWALDE', 'GUSEV', 'SANTA FE', 'NERETVA'];
const GRID_W = 150;
const GRID_H = 94;

type Cell = { x: number; y: number; r: number; dbz: number; vx: number; vy: number; born: number; life: number };
type Devil = { x: number; y: number; vx: number; vy: number; born: number; life: number };

export const marsRadarSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'mars-radar',
  label: 'Martian weather radar',
  description: 'Dust storm radar over Jezero: contours, drifting storm cells, sweep-refreshed reflectivity, dust devils.',
  tags: ['instrument', 'mars', 'dark', 'rust'],
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
          if (t > c.born + c.life || c.x < -0.3 || c.x > 1.3 || c.y < -0.3 || c.y > 1.3) cells.splice(i, 1, newCell(t, false));
        }
        if (t >= nextDevil) {
          const ang = rng() * Math.PI * 2;
          devils.push({ x: 0.1 + rng() * 0.8, y: 0.15 + rng() * 0.7, vx: Math.cos(ang) * 0.012, vy: Math.sin(ang) * 0.012, born: t, life: 18 + rng() * 14 });
          nextDevil = t + 14 + rng() * 18;
        }
        tracks.decay(dt, 90);
        for (let i = devils.length - 1; i >= 0; i--) {
          const d = devils[i];
          const px0 = d.x * W;
          const py0 = d.y * H;
          d.x += d.vx * dt;
          d.y += d.vy * dt + Math.sin(t * 0.7 + i) * 0.0008;
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
        for (let km = 50; km <= 200; km += 50) ctx.fillText(`${km} KM`, sx + 3, sy - km * kmPx - 2);
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
        ctx.fillText('JEZERO WX-2', sx + 10, sy);

        // Dust devils: a small turning glyph.
        ctx.font = mono(11);
        ctx.textAlign = 'center';
        for (const d of devils) {
          const a = clamp01((t - d.born) / 2) * clamp01((d.born + d.life - t) / 2) * level;
          ctx.fillStyle = hexA('#fde68a', 0.85 * a);
          ctx.fillText(['@', '6', '@', '9'][Math.floor(t * 8) % 4], d.x * W, d.y * H);
          ctx.strokeStyle = hexA('#fde68a', 0.3 * a);
          ctx.beginPath();
          ctx.arc(d.x * W, d.y * H, 9 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
          ctx.stroke();
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
        for (let z = 10; z <= 50; z += 10) ctx.fillText(String(z), lx - 4, ly + (55 - z) * 2.2);
        ctx.fillText('DBZ', lx + 12, ly - 10);

        // Readouts.
        const lmst = 14 * 60 + 22 + Math.floor(t * 0.5);
        ctx.font = mono(10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = hexA(ink, 0.6 * level);
        ctx.fillText(`SOL ${1204 + Math.floor(lmst / 1440)} · LMST ${String(Math.floor(lmst / 60) % 24).padStart(2, '0')}:${String(lmst % 60).padStart(2, '0')}`, 18, 16);
        ctx.fillStyle = hexA(ink, 0.45 * level);
        ctx.fillText(`TAU ${(1.6 + cells.reduce((s, c) => s + c.dbz, 0) / 120).toFixed(1)} · 6.1 MBAR · −63°C`, 18, 30);
        ctx.fillText(`WIND ${Math.round(wind.dir)}° ${Math.round(wind.speed)} M/S`, 18, 44);

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
            ctx.fillText(typed(advisory.text, age, 34, t), 18, H - 14);
          }
        }
      },
      destroy() {},
    };
  },
};
