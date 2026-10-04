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
import { fillCrisp, clamp01, fixName, hash, hexA, mono, plate, report, typed } from './kit';

const schema = {
  stations: { type: 'number', min: 6, max: 18, default: 12, step: 1, label: 'Stations' },
  speed: { type: 'number', min: 0.3, max: 3, default: 1, label: 'Paper speed' },
  activity: { type: 'number', min: 0, max: 1, default: 0.75, label: 'Activity' },
  section: { type: 'boolean', default: true, label: 'Crust section' },
} satisfies Schema;

/**
 * What shook: a local quake, one of its aftershocks, a quarry blast, a volcano's
 * harmonic tremor, or a great quake on the far side of the planet (a teleseism).
 */
type Kind = 'quake' | 'after' | 'blast' | 'tremor' | 'tele';
type Quake = { t0: number; mag: number; depth: number; x: number; id: number; kind: Kind; seq?: number; n?: number; dur?: number; region?: string; dist?: number };
const REGIONS = ['KURIL ISLANDS', 'TONGA', 'NORTHERN CHILE', 'SUMATRA', 'ALEUTIAN ISLANDS', 'HINDU KUSH', 'MOLUCCA SEA', 'KERMADEC ISLANDS'];
const VOLCANO_KM = 118;
const QUARRY_KM = 14;
type Station = { code: string; x: number; dist: number; gain: number; phase: number };

const VP = 6.2; // km/s
const VS = 3.6;
const VR = 3.1;

export const seismicSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'seismograph',
  label: 'Seismograph',
  description: 'A seismic record: station traces trembling, quakes sweeping across the stack, the crust below.',
  tags: ['instrument', 'science', 'dark', 'amber'],
  crisp: true,
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
    let id = 400;
    for (let i = 0; i < 300; i++) {
      const roll = rng();
      if (i === 0 || roll < 0.14) {
        // A big one, then its aftershock sequence close by.
        const main: Quake = { id: id++, kind: 'quake', t0: qt, mag: i === 0 ? 4.7 + rng() * 0.5 : 4.6 + rng() * 1.7, depth: 6 + rng() * 22, x: 30 + rng() * 80 };
        quakes.push(main);
        let at = qt + 10;
        const n = 3 + Math.floor(rng() * 4);
        for (let k = 1; k <= n; k++) {
          at += 5 + rng() * 14 * k;
          quakes.push({ id: id++, kind: 'after', seq: main.id, n: k, t0: at, mag: main.mag - 1.1 - rng() * 1.6, depth: Math.max(2, main.depth + (rng() - 0.5) * 8), x: main.x + (rng() - 0.5) * 12 });
        }
      } else if (roll < 0.22) {
        quakes.push({ id: id++, kind: 'blast', t0: qt, mag: 1.8 + rng() * 0.8, depth: 0.3, x: QUARRY_KM + (rng() - 0.5) * 3 });
      } else if (roll < 0.29) {
        quakes.push({ id: id++, kind: 'tremor', t0: qt, mag: 2.6 + rng() * 0.8, depth: 3 + rng() * 4, x: VOLCANO_KM + (rng() - 0.5) * 4, dur: 26 + rng() * 26 });
      } else if (roll < 0.36) {
        quakes.push({ id: id++, kind: 'tele', t0: qt, mag: 6.6 + rng() * 1.6, depth: 30 + rng() * 300, x: 70, region: REGIONS[Math.floor(rng() * REGIONS.length)], dist: 40 + Math.floor(rng() * 50) });
      } else {
        quakes.push({ id: id++, kind: 'quake', t0: qt, mag: 2 + rng() * 2.4, depth: 4 + rng() * 26, x: 10 + rng() * 120 });
      }
      qt += (14 + rng() * 34) / (0.4 + o.activity);
    }
    quakes.sort((a, b) => a.t0 - b.t0);
    const volcano = `MT ${fixName(Math.floor(rng() * 1e6)).slice(0, 5)}`;

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
        if (q.kind === 'tele') {
          // From the far side of the planet: every station at once, long and slow.
          const tp = t - q.t0 - s.x * 0.012;
          const amp = Math.pow(10, (q.mag - 6.5) * 0.4) * s.gain;
          v += 0.25 * amp * wavelet(tp, 1.4, 3);
          v += 0.35 * amp * wavelet(tp - 14, 0.7, 5);
          v += 0.8 * amp * wavelet(tp - 26, 0.16, 26) * clamp01((tp - 26) / 6);
          continue;
        }
        const d = distTo(s, q);
        const amp = Math.pow(10, (q.mag - 3) * 0.34) * s.gain / Math.max(1, d / 18);
        if (q.kind === 'tremor') {
          // A volcano humming: emergent, steady, no clear phases.
          const tau = t - (q.t0 + d / VS);
          const dur = q.dur ?? 30;
          const env = clamp01(tau / 8) * clamp01((dur - tau) / 8);
          if (env > 0) v += 0.45 * amp * env * Math.sin(tau * Math.PI * 2 * (1.6 + 0.2 * Math.sin(tau * 0.3))) * (0.8 + 0.2 * Math.sin(tau * 0.9 + si));
          continue;
        }
        const tp = t - (q.t0 + d / VP);
        const ts = t - (q.t0 + d / VS);
        const tr = t - (q.t0 + d / VR + 2);
        // A blast pushes first and shears little; its energy goes into the surface waves.
        const [kp, ks, kr] = q.kind === 'blast' ? [0.5, 0.15, 1.1] : [0.18, 0.55, 0.7];
        v += kp * amp * wavelet(tp, 7, 1.6);
        v += ks * amp * wavelet(ts, 3.5, 3.2);
        v += kr * amp * wavelet(tr, q.kind === 'blast' ? 1.4 : 0.9, 4 + q.mag * 0.6);
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

    // Each event is reported once as it strikes (for sound), panned to its epicenter
    // in the crust section. The one already ringing when the record starts is not.
    let heard = quakes.findIndex((q) => q.t0 >= 0);
    if (heard < 0) heard = quakes.length;
    const strike = (q: Quake) => {
      const left = Math.max(78, W * lineX);
      const x01 = (left + ((q.x + 20) / 160) * (W - 18 - left)) / W;
      if (q.kind === 'quake') report(host, 'quake', clamp01((q.mag - 2) / 6), x01);
      else if (q.kind === 'after') report(host, 'aftershock', 0.3 + 0.2 * clamp01((q.mag - 2) / 3), x01);
      else if (q.kind === 'blast') report(host, 'blast', 0.3, x01);
      else if (q.kind === 'tremor') report(host, 'tremor', 0.45, x01);
      else report(host, 'teleseism', 0.8);
    };

    return {
      resize(v: Viewport) {
        W = v.width;
        H = v.height;
      },
      frame(info: FrameInfo) {
        const t = info.t;
        for (; heard < quakes.length && quakes[heard].t0 <= t; heard++) strike(quakes[heard]);
        const level = 0.55 + 0.45 * host.intensity;
        plate(ctx, W, H, palette.bg, accent, 0.55, 0.4, 0.06);

        // A big local quake shakes the whole record for a moment as its S waves arrive.
        let shake = 0;
        const recent = latest(t);
        if (host.motion !== 'off' && recent && recent.kind === 'quake' && recent.mag >= 5) {
          const near = Math.min(...stations.map((s) => distTo(s, recent)));
          const k = t - (recent.t0 + near / VS);
          if (k > 0 && k < 2.5) shake = (1 - k / 2.5) * (recent.mag - 4.5) * 3;
        }
        ctx.save();
        if (shake) ctx.translate((hash(Math.floor(t * 30), 1) - 0.5) * shake, (hash(Math.floor(t * 30), 2) - 0.5) * shake);

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
          fillCrisp(ctx, `${s < 0 ? '-' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`, right - (t - s) * pxPerSec, bottom + 6);
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
          fillCrisp(ctx, `${s.code}`, left - 10, y0 - 5);
          ctx.fillStyle = hexA(ink, 0.32 * level);
          ctx.font = mono(8);
          fillCrisp(ctx, `${Math.max(0, Math.round(s.x + 25))} KM`, left - 10, y0 + 6);

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
            // Soft clip: the pen rounds off against its stops instead of drawing flat bars.
            const v = Math.tanh(buf[((k % N) + N) % N] * 0.9) * half * 1.35;
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
        if (q && q.kind !== 'tremor' && t - q.t0 < span) {
          ctx.font = mono(9);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          for (let i = 0; i < n; i++) {
            const d = distTo(stations[i], q);
            const y0 = top + gap * (i + 0.5);
            for (const [label, v] of [['P', VP], ['S', VS]] as const) {
              const arr = q.kind === 'tele' ? q.t0 + stations[i].x * 0.012 + (label === 'S' ? 14 : 0) : q.t0 + d / v;
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
                fillCrisp(ctx, label, x, y0 - gap * 0.5);
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
          const kmToY = (km: number) => sy0 + 24 + (km / 36) * (sectionH - 34);
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
          // The volcano and its magma body, and the quarry.
          const vx = kmToX(VOLCANO_KM);
          const surf = kmToY(0);
          const humming = q && q.kind === 'tremor' && t - q.t0 < (q.dur ?? 30) + 10;
          const glow = humming ? 0.35 + 0.25 * Math.sin(t * 6) : 0.12;
          const mg = ctx.createRadialGradient(vx, kmToY(9), 0, vx, kmToY(9), 34);
          mg.addColorStop(0, hexA(accent, glow * level));
          mg.addColorStop(1, hexA(accent, 0));
          ctx.fillStyle = mg;
          ctx.fillRect(vx - 40, kmToY(9) - 34, 80, 68);
          ctx.strokeStyle = hexA(accent, (humming ? 0.6 : 0.3) * level);
          ctx.beginPath();
          ctx.moveTo(vx - 22, surf);
          ctx.lineTo(vx - 4, surf - 12);
          ctx.lineTo(vx + 4, surf - 12);
          ctx.lineTo(vx + 22, surf);
          ctx.moveTo(vx, surf - 12);
          ctx.lineTo(vx, kmToY(9));
          ctx.stroke();
          ctx.fillStyle = hexA(ink, 0.4 * level);
          ctx.font = mono(8);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          fillCrisp(ctx, volcano, vx, surf - 15);
          fillCrisp(ctx, 'QUARRY', kmToX(QUARRY_KM), surf - 9);
          if (q && q.kind === 'tele' && t - q.t0 < 40) {
            // Rays from the deep earth, arriving nearly straight up.
            const k = ((t - q.t0) * 0.5) % 1;
            ctx.strokeStyle = hexA(accent, 0.4 * level * clamp01(1 - (t - q.t0) / 40));
            ctx.beginPath();
            for (let i = 0; i < 9; i++) {
              const x = left + ((i + 0.5) / 9) * (right - left);
              const y = sy0 + sectionH + 8 - k * sectionH;
              ctx.moveTo(x - 8, y + 18);
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          if (q && q.kind !== 'tele' && q.kind !== 'tremor' && t - q.t0 < 60) {
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
            fillCrisp(ctx, '✶', hx, hy);
          }
          ctx.fillStyle = hexA(ink, 0.35 * level);
          ctx.font = mono(8);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          fillCrisp(ctx, '0 KM', 6, kmToY(0) - 4);
          fillCrisp(ctx, '36 KM', 6, kmToY(36) - 8);
          ctx.restore();
        }

        // Event card.
        ctx.font = mono(11);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const hold = q ? (q.kind === 'tremor' ? (q.dur ?? 30) + 12 : q.kind === 'tele' ? 40 : 26) : 0;
        if (q && t - q.t0 < hold) {
          const age = t - q.t0 - 1;
          const az = ['N', 'NNE', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(hash(q.id, 2) * 9)];
          const where = `DEPTH ${q.depth.toFixed(0)} KM · ${Math.round(q.x)} KM ${az}`;
          const lines =
            q.kind === 'tele' ? [`TELESEISM · M${q.mag.toFixed(1)} ${q.region}`, `Δ ${q.dist}° · DEPTH ${q.depth.toFixed(0)} KM · BAZ ${Math.floor(hash(q.id, 3) * 360)}°`, 'NO LOCAL THREAT · TSUNAMI CENTER NOTIFIED']
            : q.kind === 'tremor' ? [`HARMONIC TREMOR · ${volcano}`, `1.6 HZ · ${Math.round(q.dur ?? 30)} S EPISODE · DEPTH ${q.depth.toFixed(0)} KM`, 'ALERT LEVEL YELLOW · OVERFLIGHT REQUESTED']
            : q.kind === 'blast' ? [`EVENT ${q.id} · M${q.mag.toFixed(1)} · PROBABLE BLAST`, 'DEPTH 0 KM · QUARRY · COMPRESSIONAL FIRST MOTION', 'SCHEDULED SHOT · NO ACTION']
            : q.kind === 'after' ? [`AFTERSHOCK ${q.n} OF ${q.seq} · M${q.mag.toFixed(1)}`, where, 'SEQUENCE ACTIVE · DECAYING']
            : [`EVENT ${q.id} · M${q.mag.toFixed(1)}`, where, q.mag >= 4.5 ? 'FELT REPORTS · SHAKEALERT SENT' : 'LOCATED · 9 PHASES'];
          lines.forEach((l, i) => {
            const hot = i === 0 && q.kind === 'quake' && q.mag >= 4.5;
            ctx.fillStyle = hexA(hot ? '#f87171' : i === 0 ? accent : ink, (i === 0 ? 0.95 : 0.7) * level * clamp01((hold - age) / 2));
            fillCrisp(ctx, typed(l, age - i * 0.6, 36, t), W - 18, 14 + i * 14);
          });
        } else {
          ctx.fillStyle = hexA(ink, 0.45 * level);
          fillCrisp(ctx, 'NETWORK QUIET · MICROSEISM NOMINAL', W - 18, 14);
        }
        ctx.textAlign = 'left';
        ctx.fillStyle = hexA(ink, 0.45 * level);
        ctx.font = mono(10);
        fillCrisp(ctx, `${stations.length} STATIONS · BHZ · 40 SPS`, 18, 14);
        ctx.restore();
      },
      destroy() {},
    };
  },
};
