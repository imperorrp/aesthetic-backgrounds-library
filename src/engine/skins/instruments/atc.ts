/**
 * Approach radar: an air traffic control scope. A sweep paints primary returns onto
 * phosphor that fades, so every aircraft leaves a trail of dimming returns behind
 * it. Arrivals fly fixes to the final approach and land, departures climb out and
 * turn for their exit fix, airliners cross high overhead, and the controller's
 * clearances type out along the bottom. Time runs faster than life so motion reads.
 */
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import type { Schema } from '../../core/schema';
import { resolveOptions } from '../../core/schema';
import { clamp01, createPhosphor, fixName, hash, hexA, mono, plate, typed } from './kit';

const schema = {
  traffic: { type: 'number', min: 3, max: 18, default: 10, step: 1, label: 'Traffic' },
  sweep: { type: 'number', min: 2, max: 10, default: 4.8, label: 'Sweep period (s)' },
  timeScale: { type: 'number', min: 4, max: 30, default: 14, label: 'Time compression' },
  weather: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Weather returns' },
} satisfies Schema;

type Pt = { x: number; y: number };
type Aircraft = {
  call: string;
  kind: 'arr' | 'dep' | 'ovf';
  x: number;
  y: number;
  hdg: number;
  gs: number;
  alt: number;
  route: { x: number; y: number; alt: number; gs: number; say?: string }[];
  wp: number;
  shown: Pt | null;
  shownAlt: number;
  shownGs: number;
  done: boolean;
};

const AIRLINES = ['KST', 'NVQ', 'ORB', 'LMX', 'TZR', 'VRX', 'HLY', 'MRD', 'QZA'];
const deg = Math.PI / 180;

export const atcRadarSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'atc-radar',
  label: 'Approach radar',
  description: 'An air traffic control scope: sweep, fading returns, arrivals, departures, and typed clearances.',
  tags: ['instrument', 'aviation', 'dark', 'green'],
  schema,
  defaults: { palette: { from: '#34d399' }, intensity: 0.6 },
  mount(host: SkinHost) {
    const o = resolveOptions(schema, host.options);
    const { ctx, palette } = host;
    const rng = host.fork('atc');
    const phos = createPhosphor();
    let W = host.viewport.width;
    let H = host.viewport.height;
    let cx = 0;
    let cy = 0;
    let px = 10; // pixels per nautical mile
    const accent = palette.accent;
    const ink = palette.ink;
    const airport = fixName(Math.floor(rng() * 1e6)).slice(0, 4);
    const toXY = (bearing: number, nm: number): Pt => ({ x: Math.sin(bearing * deg) * nm, y: -Math.cos(bearing * deg) * nm });
    const bearingOf = (p: Pt) => ((Math.atan2(p.x, -p.y) / deg) + 360) % 360;

    // Runway 27 (land west) and runway 32 (land northwest); approaches come from the east and southeast.
    const finals = [
      { name: '27', hdg: 270, iaf: toXY(90, 14), faf: toXY(90, 5), thr: toXY(90, 0.8) },
      { name: '32', hdg: 320, iaf: toXY(140, 13), faf: toXY(140, 5), thr: toXY(140, 0.8) },
    ];
    const fixes = Array.from({ length: 9 }, (_, i) => {
      const b = i * 40 + rng() * 22;
      return { name: fixName(Math.floor(rng() * 1e6) + i), ...toXY(b, 20 + rng() * 16) };
    });

    const air: Aircraft[] = [];
    const say: { text: string; at: number }[] = [];
    const callsign = () => `${AIRLINES[Math.floor(rng() * AIRLINES.length)]}${1 + Math.floor(rng() * (rng() < 0.5 ? 99 : 2999))}`;

    const spawn = (kind: Aircraft['kind'], t: number, preRoll = 0) => {
      const call = callsign();
      let a: Aircraft;
      if (kind === 'arr') {
        const fin = finals[Math.floor(rng() * finals.length)];
        const entry = toXY(rng() * 360, 44);
        const fix = fixes.reduce((best, f) => (Math.hypot(f.x - entry.x, f.y - entry.y) < Math.hypot(best.x - entry.x, best.y - entry.y) ? f : best), fixes[0]);
        const alt = 11000 + Math.floor(rng() * 6) * 1000;
        a = {
          call, kind, x: entry.x, y: entry.y, hdg: bearingOf({ x: fix.x - entry.x, y: fix.y - entry.y }), gs: 290, alt,
          route: [
            { x: fix.x, y: fix.y, alt: 8000, gs: 250, say: `${call}, DESCEND AND MAINTAIN 8000` },
            { x: fin.iaf.x, y: fin.iaf.y, alt: 4000, gs: 210, say: `${call}, CLEARED ILS RUNWAY ${fin.name} APPROACH` },
            { x: fin.faf.x, y: fin.faf.y, alt: 1800, gs: 160, say: `${call}, CONTACT TOWER 118.7` },
            { x: fin.thr.x, y: fin.thr.y, alt: 0, gs: 130 },
          ],
          wp: 0, shown: null, shownAlt: alt, shownGs: 290, done: false,
        };
      } else if (kind === 'dep') {
        const fin = finals[Math.floor(rng() * finals.length)];
        const start = { x: -fin.thr.x * 0.6, y: -fin.thr.y * 0.6 };
        const exit = fixes[Math.floor(rng() * fixes.length)];
        const out = toXY(bearingOf(exit), 48);
        const climb = toXY(fin.hdg, 6);
        a = {
          call, kind, x: start.x, y: start.y, hdg: fin.hdg, gs: 160, alt: 200,
          route: [
            { x: climb.x, y: climb.y, alt: 5000, gs: 230, say: `${call}, RADAR CONTACT, CLIMB AND MAINTAIN 5000` },
            { x: exit.x, y: exit.y, alt: 17000, gs: 290, say: `${call}, PROCEED DIRECT ${exit.name}` },
            { x: out.x, y: out.y, alt: 23000, gs: 320, say: `${call}, CONTACT CENTER 132.45` },
          ],
          wp: 0, shown: null, shownAlt: 200, shownGs: 160, done: false,
        };
      } else {
        const b = rng() * 360;
        const from = toXY(b, 46);
        const to = toXY(b + 160 + rng() * 40, 46);
        const alt = 31000 + Math.floor(rng() * 9) * 1000;
        a = { call, kind, x: from.x, y: from.y, hdg: bearingOf({ x: to.x - from.x, y: to.y - from.y }), gs: 460, alt, route: [{ x: to.x, y: to.y, alt, gs: 460 }], wp: 0, shown: null, shownAlt: alt, shownGs: 460, done: false };
      }
      air.push(a);
      // Advance a freshly seeded aircraft so the scope starts busy, mid-story.
      for (let s = 0; s < preRoll; s += 0.25) step(a, 0.25, t, true);
    };

    function step(a: Aircraft, dt: number, t: number, quiet = false) {
      const w = a.route[a.wp];
      if (!w) {
        a.done = true;
        return;
      }
      const sim = dt * o.timeScale;
      const want = bearingOf({ x: w.x - a.x, y: w.y - a.y });
      let d = want - a.hdg;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      a.hdg = (a.hdg + Math.max(-3 * sim, Math.min(3 * sim, d)) + 360) % 360;
      a.gs += Math.max(-2 * sim, Math.min(2 * sim, w.gs - a.gs));
      a.alt += Math.max(-30 * sim, Math.min(30 * sim, w.alt - a.alt));
      const nm = (a.gs / 3600) * sim;
      a.x += Math.sin(a.hdg * deg) * nm;
      a.y -= Math.cos(a.hdg * deg) * nm;
      if (Math.hypot(w.x - a.x, w.y - a.y) < Math.max(0.6, nm * 2)) {
        if (w.say && !quiet) say.push({ text: w.say, at: t });
        a.wp++;
        if (a.wp >= a.route.length) a.done = true;
      }
    }

    const counts = () => ({ arr: air.filter((a) => a.kind === 'arr').length, dep: air.filter((a) => a.kind === 'dep').length, ovf: air.filter((a) => a.kind === 'ovf').length });
    for (let i = 0; i < o.traffic; i++) {
      const r = i % 5;
      spawn(r < 2 ? 'arr' : r < 4 ? 'dep' : 'ovf', 0, 10 + rng() * 140);
    }
    for (const a of air) a.shown = { x: a.x, y: a.y };

    // Weather: a few precipitation cells drifting with the wind.
    const cells = Array.from({ length: 4 }, () => ({ ...toXY(rng() * 360, 12 + rng() * 26), r: 3 + rng() * 5, k: 0.4 + rng() * 0.6 }));
    const wind = { x: 0.35, y: -0.12 };

    const layout = () => {
      cx = W * 0.5;
      cy = H * 0.54;
      px = (Math.min(W, H) * 0.44) / 30;
      phos.resize(W, H, host.viewport.dpr);
    };
    layout();

    let sweep = -Math.PI / 2;
    let nextSpawn = 2;
    const sx = (p: Pt) => cx + p.x * px;
    const sy = (p: Pt) => cy + p.y * px;

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

        // Traffic.
        for (const a of air) step(a, dt, t);
        for (let i = air.length - 1; i >= 0; i--) if (air[i].done || Math.hypot(air[i].x, air[i].y) > 52) air.splice(i, 1);
        if (t >= nextSpawn) {
          if (air.length < o.traffic) {
            const c = counts();
            spawn(c.arr <= c.dep ? 'arr' : c.ovf < 2 && hash(Math.floor(t), 5) < 0.4 ? 'ovf' : 'dep', t);
          }
          nextSpawn = t + 3 + hash(Math.floor(t * 10), 1) * 5;
        }
        for (const c of cells) {
          c.x += wind.x * dt * o.timeScale * 0.02;
          c.y += wind.y * dt * o.timeScale * 0.02;
        }

        // Sweep: paint whatever it passed since the last frame onto the phosphor.
        const prev = sweep;
        sweep += (dt / o.sweep) * Math.PI * 2;
        // Each return outlives a few sweeps, so aircraft trail their own history.
        phos.decay(dt, o.sweep * 0.9);
        const pctx = phos.ctx;
        const passed = (p: Pt) => {
          let a = Math.atan2(p.y, p.x);
          while (a < prev) a += Math.PI * 2;
          return a <= sweep;
        };
        if (dt > 0) {
          pctx.fillStyle = hexA(accent, 0.9);
          for (const a of air) {
            if (!passed(a)) continue;
            a.shown = { x: a.x, y: a.y };
            a.shownAlt = a.alt;
            a.shownGs = a.gs;
            pctx.fillRect(sx(a) - 2, sy(a) - 2, 4, 4);
            pctx.fillStyle = hexA(accent, 0.25);
            pctx.fillRect(sx(a) - 4, sy(a) - 4, 8, 8);
            pctx.fillStyle = hexA(accent, 0.9);
          }
          // Weather and ground clutter: speckle along the sweep line.
          const steps = Math.max(1, Math.ceil(((sweep - prev) / (Math.PI * 2)) * 360));
          for (let s = 0; s < steps; s++) {
            const ang = prev + ((sweep - prev) * (s + 0.5)) / steps;
            const seed = Math.floor((ang / (Math.PI * 2)) * 720);
            for (let k = 0; k < 18; k++) {
              const r = (hash(seed, k, Math.floor(t / o.sweep)) ** 1.6) * 46;
              const p = { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
              let e = r < 1.8 ? 0.35 * hash(seed, k + 50) : 0;
              for (const c of cells) {
                const dd = Math.hypot(p.x - c.x, p.y - c.y);
                if (dd < c.r) e += c.k * o.weather * (1 - dd / c.r) * (0.6 + 0.4 * hash(seed, k, 9));
              }
              if (e > 0.12) {
                pctx.fillStyle = hexA(accent, Math.min(0.55, e * 0.6));
                pctx.fillRect(sx(p), sy(p), 2, 2);
              }
            }
          }
        }

        // Scope.
        plate(ctx, W, H, palette.bg, accent, cx / W, cy / H, 0.08);
        ctx.save();
        ctx.lineWidth = 1;
        // Range rings every 5 NM.
        ctx.strokeStyle = hexA(accent, 0.16 * level);
        ctx.beginPath();
        for (let nm = 5; nm <= 60; nm += 5) {
          ctx.moveTo(cx + nm * px, cy);
          ctx.arc(cx, cy, nm * px, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.fillStyle = hexA(accent, 0.4 * level);
        ctx.font = mono(9);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let nm = 10; nm <= 40; nm += 10) ctx.fillText(`${nm}`, cx + 3, cy - nm * px - 6);

        // Bearing ticks on the 30 NM ring.
        const R = 30 * px;
        ctx.strokeStyle = hexA(accent, 0.35 * level);
        ctx.beginPath();
        for (let b = 0; b < 360; b += 5) {
          const len = b % 30 === 0 ? 9 : b % 10 === 0 ? 5 : 3;
          const a = (b - 90) * deg;
          ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          ctx.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
        }
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = hexA(ink, 0.45 * level);
        for (let b = 0; b < 360; b += 30) {
          const a = (b - 90) * deg;
          ctx.fillText(String(b).padStart(3, '0'), cx + Math.cos(a) * (R + 20), cy + Math.sin(a) * (R + 20));
        }

        // Airways, fixes, finals, runways.
        ctx.strokeStyle = hexA(accent, 0.13 * level);
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        for (const f of fixes) {
          const fin = finals.reduce((b, n) => (Math.hypot(n.iaf.x - f.x, n.iaf.y - f.y) < Math.hypot(b.iaf.x - f.x, b.iaf.y - f.y) ? n : b), finals[0]);
          ctx.moveTo(sx(f), sy(f));
          ctx.lineTo(sx(fin.iaf), sy(fin.iaf));
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = mono(9);
        ctx.textAlign = 'left';
        for (const f of fixes) {
          ctx.strokeStyle = hexA(accent, 0.5 * level);
          ctx.beginPath();
          ctx.moveTo(sx(f), sy(f) - 4);
          ctx.lineTo(sx(f) + 3.5, sy(f) + 2.5);
          ctx.lineTo(sx(f) - 3.5, sy(f) + 2.5);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = hexA(ink, 0.45 * level);
          ctx.fillText(f.name, sx(f) + 7, sy(f));
        }
        for (const fin of finals) {
          ctx.strokeStyle = hexA(accent, 0.28 * level);
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(sx(fin.thr), sy(fin.thr));
          ctx.lineTo(sx(fin.iaf), sy(fin.iaf));
          ctx.stroke();
          ctx.setLineDash([]);
          // Distance ticks along final.
          const dir = { x: (fin.iaf.x - fin.thr.x) / 14, y: (fin.iaf.y - fin.thr.y) / 14 };
          ctx.beginPath();
          for (let n = 2; n <= 12; n += 2) {
            const p = { x: fin.thr.x + dir.x * n, y: fin.thr.y + dir.y * n };
            ctx.moveTo(sx(p) - dir.y * 3 * px * 0.3, sy(p) + dir.x * 3 * px * 0.3);
            ctx.lineTo(sx(p) + dir.y * 3 * px * 0.3, sy(p) - dir.x * 3 * px * 0.3);
          }
          ctx.stroke();
          // Runway.
          ctx.strokeStyle = hexA(ink, 0.75 * level);
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(sx(fin.thr), sy(fin.thr));
          ctx.lineTo(cx - fin.thr.x * px * 0.6, cy - fin.thr.y * px * 0.6);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        ctx.restore();

        // Returns.
        ctx.save();
        ctx.globalAlpha = level;
        phos.draw(ctx, W, H);
        ctx.restore();

        // The sweep line with a fading wake.
        const L = Math.hypot(W, H);
        for (let i = 0; i < 14; i++) {
          const a0 = sweep - (i + 1) * 0.03;
          const a1 = sweep - i * 0.03;
          ctx.fillStyle = hexA(accent, 0.07 * (1 - i / 14) * level);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a0) * L, cy + Math.sin(a0) * L);
          ctx.lineTo(cx + Math.cos(a1) * L, cy + Math.sin(a1) * L);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = hexA(accent, 0.6 * level);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweep) * L, cy + Math.sin(sweep) * L);
        ctx.stroke();

        // Data blocks, anchored to each aircraft's last painted position.
        ctx.font = mono(10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const a of air) {
          if (!a.shown) continue;
          const x = sx(a.shown);
          const y = sy(a.shown);
          if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
          const lx = x + 16;
          const ly = y - 16;
          ctx.strokeStyle = hexA(ink, 0.45 * level);
          ctx.beginPath();
          ctx.moveTo(x + 3, y - 3);
          ctx.lineTo(lx - 2, ly + 2);
          ctx.stroke();
          const fl = String(Math.round(a.shownAlt / 100)).padStart(3, '0');
          const trend = a.route[a.wp] ? (a.route[a.wp].alt > a.shownAlt + 150 ? '↑' : a.route[a.wp].alt < a.shownAlt - 150 ? '↓' : ' ') : ' ';
          ctx.fillStyle = hexA(a.kind === 'ovf' ? ink : accent, (a.kind === 'ovf' ? 0.55 : 0.9) * level);
          ctx.fillText(a.call, lx, ly - 6);
          ctx.fillStyle = hexA(ink, 0.65 * level);
          ctx.fillText(`${fl}${trend} ${Math.round(a.shownGs / 10)}`, lx, ly + 6);
        }

        // Readouts and the clearance line.
        ctx.font = mono(10);
        ctx.fillStyle = hexA(ink, 0.55 * level);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${airport} APPROACH · 119.30`, 18, 16);
        ctx.fillText(`ALTIMETER 29.92 · WIND 270/12 · ATIS ${String.fromCharCode(65 + (Math.floor(t / 90) % 26))}`, 18, 30);
        ctx.textAlign = 'right';
        const minutes = 14 * 60 + 22 + Math.floor((t * o.timeScale) / 60);
        ctx.fillText(`${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}Z · ${air.length} TRACKS`, W - 18, 16);
        while (say.length && t - say[0].at > 7) say.shift();
        const msg = say[say.length - 1];
        if (msg) {
          const age = t - msg.at;
          ctx.textBaseline = 'bottom';
          ctx.font = mono(11);
          ctx.fillStyle = hexA(accent, 0.9 * level * clamp01((7 - age) * 2));
          ctx.fillText(typed(msg.text, age, 30, t), W - 18, H - 14);
        }
      },
      destroy() {},
    };
  },
};
