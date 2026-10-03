/**
 * Seismograph: a stack of station traces scrolling like a drum recorder. Between
 * events the pens tremble with microseism. When a quake strikes, its P, S, and
 * surface waves reach each station later the farther away it is, so the wavefront
 * sweeps diagonally down the stack; big ones clip the pens flat. A cross-section of
 * the crust at the bottom marks the hypocenter, and the event card types out.
 */
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import type { Schema } from '../../core/schema';
import { resolveOptions } from '../../core/schema';
import { clamp01, fixName, hash, hexA, mono, plate, typed } from './kit';

const schema = {
  stations: { type: 'number', min: 6, max: 18, default: 12, step: 1, label: 'Stations' },
  speed: { type: 'number', min: 0.3, max: 3, default: 1, label: 'Paper speed' },
  activity: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Activity' },
  section: { type: 'boolean', default: true, label: 'Crust section' },
} satisfies Schema;

type Quake = { t0: number; mag: number; depth: number; x: number; id: number };
type Station = { code: string; x: number; dist: number; gain: number; phase: number };

const VP = 6.2; // km/s
const VS = 3.6;
const VR = 3.1;

export const seismicSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'seismograph',
  label: 'Seismograph',
  description: 'A seismic record: station traces trembling, quakes sweeping across the stack, the crust below.',
  tags: ['instrument', 'science', 'dark', 'amber'],
  schema,
  defaults: { palette: { from: '#f59e0b' }, intensity: 0.6 },
  mount(host: SkinHost) {
    const o = resolveOptions(schema, host.options);
    const { ctx, palette } = host;
    const rng = host.fork('seismic');
    let W = host.viewport.width;
    let H = host.viewport.height;
    const accent = palette.accent;
    const ink = palette.ink;
    const pxPerSec = 26 * o.speed;
    const lineX = 0.08; // where the stack's left labels end, as a fraction of width

    // Stations along a line through the fault zone (km), sorted by position.
    const stations: Station[] = Array.from({ length: o.stations }, (_, i) => ({
      code: fixName(Math.floor(rng() * 1e6) + i).slice(0, 3),
      x: (i / (o.stations - 1)) * 160 - 20 + (rng() - 0.5) * 8,
      dist: 0,
      gain: 0.8 + rng() * 0.5,
      phase: rng() * 100,
    }));

    // Quakes: a seeded catalog. The first lands early so a fresh page shows one.
    const quakes: Quake[] = [];
    // One struck just before the record starts, so the first screen already shows it.
    let qt = -9;
    for (let i = 0; i < 400; i++) {
      const big = i === 0 || rng() < 0.12;
      quakes.push({ id: 400 + i, t0: qt, mag: big ? 4.5 + rng() * 1.8 : 2 + rng() * 2.4, depth: 4 + rng() * 26, x: 10 + rng() * 120 });
      qt += (18 + rng() * 40) / (0.4 + o.activity);
    }

    const distTo = (s: Station, q: Quake) => Math.hypot(s.x - q.x, q.depth);

    const wavelet = (tau: number, f: number, decay: number) => (tau <= 0 ? 0 : Math.sin(tau * f * Math.PI * 2) * (1 - Math.exp(-tau * 12)) * Math.exp(-tau / decay));

    /** Ground motion at a station at time t, in trace heights (may exceed 1 and clip). */
    const motion = (si: number, t: number) => {
      const s = stations[si];
      // Microseism: slow swell plus fine tremble.
      let v = host.noise.noise2(t * 0.35, s.phase) * 0.1 + host.noise.noise2(t * 3.1, s.phase + 50) * 0.05 + (hash(Math.floor(t * 40), si) - 0.5) * 0.03;
      for (const q of quakes) {
        if (q.t0 > t) break;
        if (t - q.t0 > 120) continue;
        const d = distTo(s, q);
        const amp = Math.pow(10, (q.mag - 3) * 0.55) * s.gain / Math.max(1, d / 18);
        const tp = t - (q.t0 + d / VP);
        const ts = t - (q.t0 + d / VS);
        const tr = t - (q.t0 + d / VR + 2);
        v += 0.18 * amp * wavelet(tp, 7, 1.6);
        v += 0.55 * amp * wavelet(ts, 3.5, 3.2);
        v += 0.7 * amp * wavelet(tr, 0.9, 7 + q.mag);
      }
      return v;
    };

    // Ground motion is a pure function of time, so each trace keeps a ring of samples
    // and only computes the new ones as the paper advances.
    const STEP = 1.5; // px between samples
    const sp = STEP / pxPerSec; // seconds between samples
    let N = 0;
    let bufs: Float32Array[] = [];
    let lastK = -Infinity;
    const sampleTo = (kNow: number) => {
      const from = Math.max(lastK + 1, kNow - N + 1);
      for (let k = from; k <= kNow; k++) {
        const slot = ((k % N) + N) % N;
        for (let i = 0; i < stations.length; i++) bufs[i][slot] = motion(i, k * sp);
      }
      lastK = kNow;
    };
    const ensureBuffers = (width: number) => {
      const need = Math.ceil(width / STEP) + 4;
      if (need === N) return;
      N = need;
      bufs = stations.map(() => new Float32Array(N));
      lastK = -Infinity;
    };

    const latest = (t: number) => {
      let q: Quake | null = null;
      for (const k of quakes) {
        if (k.t0 > t) break;
        q = k;
      }
      return q;
    };

    return {
      resize(v: Viewport) {
        W = v.width;
        H = v.height;
      },
      frame(info: FrameInfo) {
        const t = info.t;
        const level = 0.55 + 0.45 * host.intensity;
        plate(ctx, W, H, palette.bg, accent, 0.55, 0.4, 0.06);

        const sectionH = o.section ? Math.min(150, H * 0.2) : 0;
        const top = 54;
        const bottom = H - sectionH - 34;
        const n = stations.length;
        const gap = (bottom - top) / n;
        const left = Math.max(78, W * lineX);
        const right = W - 18;
        const span = (right - left) / pxPerSec; // seconds visible

        // Time grid: a line every 10 s, scrolling with the paper.
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexA(accent, 0.1 * level);
        ctx.beginPath();
        const first = Math.ceil((t - span) / 10) * 10;
        for (let s = first; s <= t; s += 10) {
          const x = Math.round(right - (t - s) * pxPerSec) + 0.5;
          ctx.moveTo(x, top - 8);
          ctx.lineTo(x, bottom);
        }
        ctx.stroke();
        ctx.fillStyle = hexA(ink, 0.4 * level);
        ctx.font = mono(9);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let s = first; s <= t; s += 10) {
          if (s % 30 !== 0) continue;
          const abs = Math.abs(s);
          ctx.fillText(`${s < 0 ? '-' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`, right - (t - s) * pxPerSec, bottom + 6);
        }

        // Traces.
        ensureBuffers(right - left);
        const kNow = Math.floor(t / sp);
        sampleTo(kNow);
        for (let i = 0; i < n; i++) {
          const y0 = top + gap * (i + 0.5);
          const s = stations[i];
          ctx.fillStyle = hexA(ink, 0.55 * level);
          ctx.font = mono(10);
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${s.code}`, left - 10, y0 - 5);
          ctx.fillStyle = hexA(ink, 0.32 * level);
          ctx.font = mono(8);
          ctx.fillText(`${Math.max(0, Math.round(s.x + 25))} KM`, left - 10, y0 + 6);

          ctx.strokeStyle = hexA(accent, 0.12 * level);
          ctx.beginPath();
          ctx.moveTo(left, Math.round(y0) + 0.5);
          ctx.lineTo(right, Math.round(y0) + 0.5);
          ctx.stroke();

          ctx.strokeStyle = hexA(accent, 0.85 * level);
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          const half = gap * 0.46;
          const buf = bufs[i];
          let started = false;
          for (let k = kNow - N + 1; k <= kNow; k++) {
            const x = right - (t - k * sp) * pxPerSec;
            if (x < left) continue;
            const v = Math.max(-1, Math.min(1, buf[((k % N) + N) % N])) * half;
            if (!started) {
              ctx.moveTo(x, y0 - v);
              started = true;
            } else ctx.lineTo(x, y0 - v);
          }
          ctx.stroke();
          ctx.lineWidth = 1;
        }

        // Phase picks on the newest event: P and S ticks where they reach each trace.
        const q = latest(t);
        if (q && t - q.t0 < span) {
          ctx.font = mono(9);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          for (let i = 0; i < n; i++) {
            const d = distTo(stations[i], q);
            const y0 = top + gap * (i + 0.5);
            for (const [label, v] of [['P', VP], ['S', VS]] as const) {
              const arr = q.t0 + d / v;
              if (arr > t) continue;
              const x = right - (t - arr) * pxPerSec;
              if (x < left) continue;
              ctx.strokeStyle = hexA(ink, 0.55 * level);
              ctx.beginPath();
              ctx.moveTo(x, y0 - gap * 0.48);
              ctx.lineTo(x, y0 - gap * 0.3);
              ctx.stroke();
              if (i === 0 || i === n - 1) {
                ctx.fillStyle = hexA(ink, 0.6 * level);
                ctx.fillText(label, x, y0 - gap * 0.5);
              }
            }
          }
        }

        // Crust section: layered strata, stations on the surface, the hypocenter star.
        if (o.section) {
          const sy0 = H - sectionH - 8;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, sy0, W, sectionH + 8);
          ctx.clip();
          const kmToX = (km: number) => left + ((km + 20) / 160) * (right - left);
          const kmToY = (km: number) => sy0 + 14 + (km / 36) * (sectionH - 24);
          ctx.strokeStyle = hexA(accent, 0.18 * level);
          ctx.beginPath();
          for (let layer = 0; layer < 6; layer++) {
            for (let x = left; x <= right; x += 6) {
              const km = ((x - left) / (right - left)) * 160 - 20;
              const depth = layer * 6 + 2 + host.noise.noise2(km * 0.02, layer * 3.1) * 3 + (km > 60 ? (km - 60) * 0.05 * (layer % 2 ? 1 : -1) : 0);
              const y = kmToY(Math.max(0, depth));
              if (x === left) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          // A fault, dipping.
          ctx.strokeStyle = hexA(accent, 0.35 * level);
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(kmToX(58), kmToY(0));
          ctx.lineTo(kmToX(78), kmToY(36));
          ctx.stroke();
          ctx.setLineDash([]);
          for (const s of stations) {
            const x = kmToX(s.x);
            ctx.fillStyle = hexA(ink, 0.6 * level);
            ctx.beginPath();
            ctx.moveTo(x, kmToY(0) - 6);
            ctx.lineTo(x + 3.5, kmToY(0));
            ctx.lineTo(x - 3.5, kmToY(0));
            ctx.closePath();
            ctx.fill();
          }
          if (q && t - q.t0 < 60) {
            const age = t - q.t0;
            const hx = kmToX(q.x);
            const hy = kmToY(q.depth);
            // Expanding wavefronts in the section.
            for (const [v, a] of [[VP, 0.5], [VS, 0.35]] as const) {
              const r = (age * v) / 160 * (right - left);
              if (r < (right - left) * 1.2) {
                ctx.strokeStyle = hexA(accent, a * level * clamp01(1 - age / 40));
                ctx.beginPath();
                ctx.ellipse(hx, hy, r, r * ((sectionH - 24) / 36 / ((right - left) / 160)), 0, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
            ctx.fillStyle = hexA(accent, level);
            ctx.font = mono(14);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✶', hx, hy);
          }
          ctx.fillStyle = hexA(ink, 0.35 * level);
          ctx.font = mono(8);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('0 KM', 6, kmToY(0) - 4);
          ctx.fillText('36 KM', 6, kmToY(36) - 8);
          ctx.restore();
        }

        // Event card.
        ctx.font = mono(11);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        if (q && t - q.t0 < 26) {
          const age = t - q.t0 - 1;
          const az = ['N', 'NNE', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(hash(q.id, 2) * 9)];
          const lines = [`EVENT ${q.id} · M${q.mag.toFixed(1)}`, `DEPTH ${q.depth.toFixed(0)} KM · ${Math.round(q.x)} KM ${az}`, q.mag >= 4.5 ? 'FELT REPORTS · ALERT SENT' : 'LOCATED · 9 PHASES'];
          lines.forEach((l, i) => {
            ctx.fillStyle = hexA(i === 0 ? accent : ink, (i === 0 ? 0.95 : 0.7) * level * clamp01((26 - age) / 2));
            ctx.fillText(typed(l, age - i * 0.6, 36, t), W - 18, 14 + i * 14);
          });
        } else {
          ctx.fillStyle = hexA(ink, 0.45 * level);
          ctx.fillText('NETWORK QUIET · MICROSEISM NOMINAL', W - 18, 14);
        }
        ctx.textAlign = 'left';
        ctx.fillStyle = hexA(ink, 0.45 * level);
        ctx.font = mono(10);
        ctx.fillText(`${stations.length} STATIONS · BHZ · 40 SPS`, 18, 14);
      },
      destroy() {},
    };
  },
};
