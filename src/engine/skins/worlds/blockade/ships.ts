/**
 * Blockade's ships, baked: each hull (./hulls) drawn once into a sprite, lit from the system's
 * star (the deck by the light from above, the side face by its curvature, a highlight along the
 * edge, the planet's glow on the belly), plated, trenched, greebled, and faded toward the deep
 * blue of distance; and a second sprite of its own lights (windows, bays, engine cores). Sprites
 * are kept by size, light and distance, and re-baked a few a frame as the light turns.
 */
import { hash } from '../../instruments/kit';
import { at, designFor, KK, lightsOf, N, type Design, type Light } from './hulls';
import type { FleetLook } from './design';
import type { Cls, V3 } from './types';

export type RGB = [number, number, number];
export const rgbOf = (hex: string): RGB => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const css = (c: RGB, a = 1) => `rgba(${Math.round(Math.max(0, Math.min(1, c[0])) * 255)},${Math.round(Math.max(0, Math.min(1, c[1])) * 255)},${Math.round(Math.max(0, Math.min(1, c[2])) * 255)},${a})`;

/** The light on the fleet now: the star's direction (view space, y down), how much of it, its colour; the ambient; the planet's glow from below. */
export type Lighting = { L: V3; S: number; star: RGB; amb: RGB; shine: RGB };
export type Sprite = { c: HTMLCanvasElement; ax: number; ay: number; Lp: number; w: number; h: number };

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

export function createShipArt() {
  const designs = new Map<string, Design>();
  const cache = new Map<string, { s: Sprite; used: number }>();
  const fallback = new Map<string, Sprite>();
  let frame = 0;
  let budget = 0;

  function design(cls: Cls, look: FleetLook, seed: number, merchant = false): Design {
    const key = `${cls}:${seed}:${look.prefix}:${merchant ? 1 : 0}`;
    let d = designs.get(key);
    if (!d) {
      d = designFor(cls, look, seed, merchant);
      d.key = key;
      designs.set(key, d);
      if (designs.size > 400) designs.delete(designs.keys().next().value!);
    }
    return d;
  }

  /** A sprite of the hull ('body'), its lights ('glow'), or its wreck ('wreck'). */
  function sprite(d: Design, Lp: number, lt: Lighting, fog: number, dir: 1 | -1, kind: 'body' | 'glow' | 'wreck'): Sprite | null {
    const qs = Math.round(Math.log(Math.max(4, Lp)) * 22);
    const Lb = Math.exp(qs / 22);
    const q = (v: number) => Math.round(v * 7);
    const lk = kind === 'glow' ? '' : `${q(lt.L[0] * dir)},${q(lt.L[1])},${q(lt.L[2])},${q(lt.S)},${q(lt.shine[0] + lt.shine[1])}`;
    const base = `${d.key}|${qs}|${Math.round(fog * 12)}|${dir}|${kind}`;
    const key = `${base}|${lk}`;
    const hit = cache.get(key);
    if (hit) {
      hit.used = frame;
      return hit.s;
    }
    const old = fallback.get(base);
    if (old && budget <= 0) return old;
    budget -= Lb > 200 ? 2 : 1;
    const s = bake(d, Lb, lt, fog, dir, kind);
    cache.set(key, { s, used: frame });
    fallback.set(base, s);
    if (cache.size > 160) {
      const keys = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, 30);
      for (const [k] of keys) cache.delete(k);
    }
    if (fallback.size > 200) fallback.delete(fallback.keys().next().value!);
    return s;
  }

  function bake(d: Design, Lp: number, lt: Lighting, fog: number, dir: 1 | -1, kind: 'body' | 'glow' | 'wreck'): Sprite {
    const pad = 3;
    const w = (1 + d.ov + 0.03) * Lp + pad * 2;
    const h = (d.up + d.down) * Lp + pad * 2;
    const c = mk(w, h);
    const g = c.getContext('2d')!;
    const ax = pad + (d.ov + 0.5) * Lp;
    const ay = pad + d.up * Lp;
    const X = (x: number) => pad + (d.ov + x) * Lp;
    const Y = (hh: number) => ay - hh * Lp;
    const T = (x: number) => at(d.top, x);
    const B = (x: number) => at(d.bot, x);
    const Wd = (x: number) => at(d.wid, x);
    const px = Math.max(0.5, Lp / 600);
    const S: Sprite = { c, ax, ay, Lp, w: c.width, h: c.height };
    if (kind === 'glow') {
      glow(g, d, Lp, X, Y, T, B, Wd, px);
      return S;
    }
    const Ls: V3 = [lt.L[0] * dir, -lt.L[1], lt.L[2]];
    const Hn = (() => {
      const v: V3 = [Ls[0], Ls[1], Ls[2] + 1];
      const n = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / n, v[1] / n, v[2] / n] as V3;
    })();
    const wreck = kind === 'wreck';
    const shadeK = (base: RGB, n: V3, shine = 1): RGB => {
      const ndl = Math.max(0, n[0] * Ls[0] + n[1] * Ls[1] + n[2] * Ls[2]);
      const spec = Math.pow(Math.max(0, n[0] * Hn[0] + n[1] * Hn[1] + n[2] * Hn[2]), 22) * 0.35 * lt.S;
      const down = Math.max(0, -n[1]) * shine;
      const k = wreck ? 0.55 : 1;
      return [
        base[0] * k * (lt.amb[0] + lt.star[0] * lt.S * ndl * 0.88 + lt.shine[0] * down) + spec * lt.star[0],
        base[1] * k * (lt.amb[1] + lt.star[1] * lt.S * ndl * 0.88 + lt.shine[1] * down) + spec * lt.star[1],
        base[2] * k * (lt.amb[2] + lt.star[2] * lt.S * ndl * 0.88 + lt.shine[2] * down) + spec * lt.star[2],
      ];
    };
    const sh = (hex: string, n: V3) => css(shadeK(rgbOf(hex), n));
    const nrm = (a: number): V3 => [0, Math.sin(a), Math.cos(a)];
    const hull = rgbOf(d.hull);
    const hull2 = rgbOf(d.hull2);
    const R = (a: number, b = 0) => hash(d.seed, a, b);
    let maxTop = 0;
    let maxBot = 0;
    for (let i = 0; i <= N; i++) {
      maxTop = Math.max(maxTop, d.top[i]);
      maxBot = Math.max(maxBot, d.bot[i]);
    }
    /** The side face's light: a vertical gradient through the curve of the hull. */
    const sideGrad = (y0: number, y1: number, base: RGB) => {
      const gr = g.createLinearGradient(0, y0, 0, y1);
      const stops: [number, number][] = [[0, 1.1], [0.12, 0.7], [0.3, 0.28], [0.5, 0], [0.7, -0.35], [0.88, -0.8], [1, -1.2]];
      // The light through the curve, and the hull's own occlusion toward the keel (form even when front-lit).
      for (const [f, a] of stops) {
        const c = shadeK(base, nrm(a));
        const ao = 0.5 + 0.5 * (1 - f * f);
        gr.addColorStop(f, css([c[0] * ao, c[1] * ao, c[2] * ao]));
      }
      return gr;
    };

    // ---- the engines' housings, behind the stern --------------------------------------------------------
    for (const e of d.engines) {
      const ey = ay + e.y * Lp;
      const r0 = e.r * Lp;
      g.fillStyle = sideGrad(ey - r0 * 1.3, ey + r0 * 1.3, hull2);
      g.beginPath();
      g.moveTo(X(0.02), ey - r0 * 1.05);
      g.lineTo(X(-e.len), ey - r0 * 1.3);
      g.lineTo(X(-e.len), ey + r0 * 1.3);
      g.lineTo(X(0.02), ey + r0 * 1.05);
      g.closePath();
      g.fill();
      g.strokeStyle = css([0, 0, 0], 0.35);
      g.lineWidth = px;
      for (let k = 1; k < 3; k++) {
        const xx = X(-e.len * (k / 3));
        g.beginPath();
        g.moveTo(xx, ey - r0 * 1.2);
        g.lineTo(xx, ey + r0 * 1.2);
        g.stroke();
      }
      g.fillStyle = '#07080b';
      g.beginPath();
      g.ellipse(X(-e.len), ey, Math.max(1, r0 * 0.32), r0 * 1.22, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = sh(d.hull, nrm(0.2));
      g.lineWidth = Math.max(0.5, r0 * 0.12);
      g.stroke();
    }
    // ---- fins (behind) ----------------------------------------------------------------------------------
    const fin = (f: (typeof d.fins)[number]) => {
      const edge = f.up ? T(f.x + f.len * 0.5) : -B(f.x + f.len * 0.5);
      const tipY = f.up ? f.h : -f.h;
      g.fillStyle = sh(d.hull2, f.up ? nrm(0.5) : nrm(-0.6));
      g.beginPath();
      g.moveTo(X(f.x + f.len), Y(edge));
      g.lineTo(X(f.x), Y(edge));
      g.lineTo(X(f.x - f.len * 0.25), Y(tipY));
      g.lineTo(X(f.x + f.len * 0.15), Y(tipY));
      g.closePath();
      g.fill();
      g.strokeStyle = css(shadeK(hull, nrm(0.9)), 0.6);
      g.lineWidth = px;
      g.beginPath();
      g.moveTo(X(f.x - f.len * 0.25), Y(tipY));
      g.lineTo(X(f.x + f.len * 0.15), Y(tipY));
      g.stroke();
    };
    for (const f of d.fins) if (!f.up) fin(f);

    // ---- the deck --------------------------------------------------------------------------------------------
    const deck = new Path2D();
    deck.moveTo(X(0), Y(T(0)));
    for (let i = 0; i <= N; i++) deck.lineTo(X(i / N), Y(d.top[i] + 2 * d.wid[i] * KK));
    for (let i = N; i >= 0; i--) deck.lineTo(X(i / N), Y(d.top[i]));
    deck.closePath();
    g.fillStyle = sh(d.hull, [0, 0.92, 0.38]);
    g.fill(deck);
    if (Lp > 60) {
      g.save();
      g.clip(deck);
      // Lines along the deck, plates and greebles on it.
      g.strokeStyle = css([0, 0, 0], 0.18);
      g.lineWidth = px;
      for (const f of [0.25, 0.5, 0.75]) {
        g.beginPath();
        for (let i = 0; i <= N; i++) {
          const yy = Y(d.top[i] + 2 * d.wid[i] * KK * f);
          if (i) g.lineTo(X(i / N), yy);
          else g.moveTo(X(0), yy);
        }
        g.stroke();
      }
      const n = Math.floor(Lp / 6);
      for (let i = 0; i < n; i++) {
        const x = R(i, 1);
        const f = R(i, 2);
        const yy = Y(T(x) + 2 * Wd(x) * KK * f);
        const ww = (0.004 + R(i, 3) * 0.02) * Lp;
        const hh = Math.max(px, (0.002 + R(i, 4) * 0.006) * Lp);
        g.fillStyle = R(i, 5) < 0.5 ? css([1, 1, 1], 0.08) : css([0, 0, 0], 0.22);
        g.fillRect(X(x), yy - hh, ww, hh);
      }
      g.restore();
    }

    // ---- the side face ------------------------------------------------------------------------------------
    const side = new Path2D();
    side.moveTo(X(0), Y(T(0)));
    for (let i = 0; i <= N; i++) side.lineTo(X(i / N), Y(d.top[i]));
    for (let i = N; i >= 0; i--) side.lineTo(X(i / N), Y(-d.bot[i]));
    side.closePath();
    g.fillStyle = sideGrad(Y(maxTop), Y(-maxBot), hull);
    g.fill(side);
    g.save();
    g.clip(side);
    if (Lp > 50) {
      // Plating: a grid of plates, each a little lighter or darker.
      const cw = Math.max(3, d.panel * Lp);
      const rows = Math.max(3, Math.round(((maxTop + maxBot) * Lp) / (cw * 0.7)));
      const y0 = Y(maxTop);
      const rh = ((maxTop + maxBot) * Lp) / rows;
      let col = 0;
      for (let x = X(0); x < X(1); x += cw, col++) {
        for (let rr = 0; rr < rows; rr++) {
          const v = R(col * 31 + rr, 7);
          const off = R(col, rr + 40) < 0.5 ? 0 : cw * 0.5;
          const a = 0.05 + R(col, rr + 9) * 0.12;
          g.fillStyle = v < 0.45 ? css([0, 0, 0], a) : v < 0.8 ? css([1, 1, 1], a * 0.5) : css(rgbOf(d.hull2), a * 2);
          g.fillRect(x + (rr % 2 ? off : 0), y0 + rr * rh, cw * (0.7 + R(col, rr + 20) * 0.9), rh - px * 0.8);
        }
        if (R(col, 3) < 0.35) {
          g.fillStyle = css([0, 0, 0], 0.18);
          g.fillRect(x, y0, px, (maxTop + maxBot) * Lp);
        }
      }
      // Weathering: streaks down from the vents.
      for (let i = 0; i < Math.floor(Lp / 40); i++) {
        const x = X(0.05 + R(i, 60) * 0.9);
        const gr = g.createLinearGradient(0, Y(maxTop), 0, Y(-maxBot));
        gr.addColorStop(0, css([0, 0, 0], 0.15));
        gr.addColorStop(1, css([0, 0, 0], 0));
        g.fillStyle = gr;
        g.fillRect(x, Y(maxTop), (0.003 + R(i, 61) * 0.01) * Lp, (maxTop + maxBot) * Lp);
      }
    }
    // Belts along the hull, following its line.
    const belt = (f: number, a: number, wdt: number) => {
      g.strokeStyle = css([0, 0, 0], a);
      g.lineWidth = wdt;
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const yy = Y(d.top[i] - f * (d.top[i] + d.bot[i]));
        if (i) g.lineTo(X(i / N), yy);
        else g.moveTo(X(0), yy);
      }
      g.stroke();
    };
    belt(0.3, 0.3, px);
    belt(0.78, 0.25, px);
    if (d.trench >= 0 && Lp > 40) {
      // The trench: a dark channel of machinery, with greebles in it.
      g.fillStyle = css([0, 0, 0], 0.38);
      g.beginPath();
      for (let i = 0; i <= N; i++) g.lineTo(X(i / N), Y(d.top[i] - (d.trench - 0.05) * (d.top[i] + d.bot[i])));
      for (let i = N; i >= 0; i--) g.lineTo(X(i / N), Y(d.top[i] - (d.trench + 0.05) * (d.top[i] + d.bot[i])));
      g.fill();
      const n = Math.floor(Lp / 3.5);
      for (let i = 0; i < n; i++) {
        const x = R(i, 80) * 0.97;
        const hh = T(x) + B(x);
        const yy = Y(T(x) - (d.trench - 0.045 + R(i, 81) * 0.08) * hh);
        const ww = (0.002 + R(i, 82) * 0.012) * Lp;
        const gh = Math.max(px, (0.004 + R(i, 83) * 0.01) * Lp);
        g.fillStyle = css(shadeK(R(i, 84) < 0.5 ? hull : hull2, nrm(0.3)), 0.9);
        g.fillRect(X(x), yy, ww, gh * 0.5);
        g.fillStyle = css([0, 0, 0], 0.5);
        g.fillRect(X(x), yy + gh * 0.5, ww, gh * 0.4);
      }
    }
    if (d.ports >= 0 && Lp > 80) {
      // A row of gun ports: the broadside.
      for (let x = 0.12; x < 0.86; x += 0.025) {
        const hh = T(x) + B(x);
        const yy = Y(T(x) - d.ports * hh);
        const s = Math.max(1, 0.006 * Lp);
        g.fillStyle = '#08090c';
        g.fillRect(X(x), yy - s / 2, s * 1.4, s);
        g.fillStyle = css(shadeK(hull, nrm(0.9)), 0.6);
        g.fillRect(X(x), yy - s / 2 - px, s * 1.4, px);
      }
    }
    if (d.stripe) {
      g.fillStyle = css(shadeK(rgbOf(d.trim), nrm(0)), 0.6);
      g.beginPath();
      g.moveTo(X(d.stripe[0]), Y(maxTop));
      g.lineTo(X(d.stripe[1]), Y(maxTop));
      g.lineTo(X(d.stripe[1] - 0.02), Y(-maxBot));
      g.lineTo(X(d.stripe[0] - 0.02), Y(-maxBot));
      g.fill();
    }
    // The hull number, near the bow.
    if (Lp > 140) {
      const x0 = d.stripe ? d.stripe[0] - 0.08 : 0.75;
      const hh = T(x0) + B(x0);
      const yy = Y(T(x0) - 0.35 * hh);
      g.fillStyle = css(shadeK([0.95, 0.95, 0.92], nrm(0)), 0.55);
      for (let i = 0; i < 4; i++) g.fillRect(X(x0 + i * 0.012), yy, 0.008 * Lp, 0.016 * Lp * (R(i, 90) < 0.3 ? 0.5 : 1));
    }
    // Bays: dark mouths (their glow is in the lights sprite).
    for (const b of d.bays) {
      const yy0 = Y(T(b.x0) - b.f0 * (T(b.x0) + B(b.x0)));
      const yy1 = Y(T(b.x0) - b.f1 * (T(b.x0) + B(b.x0)));
      g.fillStyle = '#050608';
      g.fillRect(X(b.x0), yy0, (b.x1 - b.x0) * Lp, yy1 - yy0);
      g.strokeStyle = css(shadeK(hull2, nrm(0.6)), 0.9);
      g.lineWidth = Math.max(px, 0.003 * Lp);
      g.strokeRect(X(b.x0), yy0, (b.x1 - b.x0) * Lp, yy1 - yy0);
    }
    // Shadow under the lip and toward the keel.
    const og = g.createLinearGradient(0, Y(-maxBot * 0.3), 0, Y(-maxBot));
    og.addColorStop(0, css([0, 0, 0], 0));
    og.addColorStop(1, css([0, 0, 0], 0.35));
    g.fillStyle = og;
    g.fillRect(0, Y(-maxBot * 0.3), c.width, maxBot * Lp);
    g.restore();
    // The edge between deck and side, catching the light.
    g.strokeStyle = css(shadeK(hull, [0, 0.7, 0.7]), 0.9);
    g.lineWidth = Math.max(px, 0.002 * Lp);
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      if (i) g.lineTo(X(i / N), Y(d.top[i]));
      else g.moveTo(X(0), Y(d.top[0]));
    }
    g.stroke();

    // ---- pods and containers -------------------------------------------------------------------------------
    for (const p of d.pods) {
      const yy = ay + p.y * Lp;
      const r0 = p.r * Lp;
      const base = rgbOf(p.color);
      g.fillStyle = (() => {
        const gr = g.createLinearGradient(0, yy - r0, 0, yy + r0);
        gr.addColorStop(0, css(shadeK(base, nrm(1.1))));
        gr.addColorStop(0.35, css(shadeK(base, nrm(0.2))));
        gr.addColorStop(1, css(shadeK(base, nrm(-1.1))));
        return gr;
      })();
      const x0 = X(p.x0);
      const ww = (p.x1 - p.x0) * Lp;
      g.beginPath();
      g.roundRect?.(x0, yy - r0, ww, r0 * 2, d.cls === 'freighter' ? Math.max(0.5, r0 * 0.08) : r0 * 0.9);
      if (!g.roundRect) g.rect(x0, yy - r0, ww, r0 * 2);
      g.fill();
      // A highlight along the upper curve, and the shadow under it.
      g.fillStyle = css(shadeK(base, nrm(0.7)).map((v) => v * 1.15) as RGB, 0.35);
      g.fillRect(x0 + ww * 0.04, yy - r0 * 0.62, ww * 0.92, Math.max(px, r0 * 0.12));
      if (Lp > 60) {
        g.strokeStyle = css([0, 0, 0], 0.3);
        g.lineWidth = px;
        for (let k = 1; k < 4; k++) {
          g.beginPath();
          g.moveTo(x0 + (ww * k) / 4, yy - r0);
          g.lineTo(x0 + (ww * k) / 4, yy + r0);
          g.stroke();
        }
      }
    }

    // ---- superstructure: boxes, the tower, turrets ------------------------------------------------------
    const boxAt = (x0: number, x1: number, z0: number, hh: number, bw: number, base: RGB) => {
      const n = 8;
      const front: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        front.push([X(x), Y(T(x) + Math.max(0, Wd(x) - bw) * KK + z0)]);
      }
      // Top face.
      g.fillStyle = css(shadeK(base, [0, 0.92, 0.38]));
      g.beginPath();
      front.forEach(([x, y], i) => (i ? g.lineTo(x, y - hh * Lp) : g.moveTo(x, y - hh * Lp)));
      for (let i = n; i >= 0; i--) g.lineTo(front[i][0], front[i][1] - hh * Lp - 2 * bw * KK * Lp);
      g.closePath();
      g.fill();
      // Front face.
      const gr = g.createLinearGradient(0, front[0][1] - hh * Lp, 0, front[0][1]);
      gr.addColorStop(0, css(shadeK(base, nrm(0.35))));
      gr.addColorStop(1, css(shadeK(base, nrm(-0.15))));
      g.fillStyle = gr;
      g.beginPath();
      front.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      for (let i = n; i >= 0; i--) g.lineTo(front[i][0], front[i][1] - hh * Lp);
      g.closePath();
      g.fill();
      g.strokeStyle = css(shadeK(base, [0, 0.7, 0.7]), 0.8);
      g.lineWidth = px;
      g.beginPath();
      front.forEach(([x, y], i) => (i ? g.lineTo(x, y - hh * Lp) : g.moveTo(x, y - hh * Lp)));
      g.stroke();
      // The end toward the stern, in shadow or lit as the light falls.
      g.fillStyle = css(shadeK(base, [-1, 0, 0.2]));
      g.beginPath();
      g.moveTo(front[0][0], front[0][1]);
      g.lineTo(front[0][0], front[0][1] - hh * Lp);
      g.lineTo(front[0][0] + bw * Lp * 0.3, front[0][1] - hh * Lp - 2 * bw * KK * Lp);
      g.lineTo(front[0][0] + bw * Lp * 0.3, front[0][1] - 2 * bw * KK * Lp);
      g.closePath();
      g.fill();
      return front;
    };
    for (const b of d.boxes) {
      const front = boxAt(b.x0, b.x1, b.z0, b.h, b.bw, R(b.x0 * 100, 5) < 0.5 ? hull : hull2);
      if (Lp > 100) {
        // Greebles along the top of each tier.
        const n = Math.floor(((b.x1 - b.x0) * Lp) / 7);
        for (let i = 0; i < n; i++) {
          const k = R(i, b.x0 * 1000 + 3);
          const j = Math.min(7, Math.floor(k * 8));
          const [fx, fy] = front[j];
          const xx = fx + (front[j + 1][0] - fx) * ((k * 8) % 1);
          const gh = (0.002 + R(i, 7) * 0.006) * Lp;
          g.fillStyle = css(shadeK(hull2, nrm(0.5)), 1);
          g.fillRect(xx, fy - b.h * Lp - gh - R(i, 8) * 2 * b.bw * KK * Lp, (0.003 + R(i, 9) * 0.008) * Lp, gh);
        }
      }
    }
    for (const t of d.turrets) {
      const x = t.x;
      const yb = Y(T(x) + Wd(x) * KK);
      const r0 = t.r * Lp;
      // Barrels toward the bow.
      g.strokeStyle = css(shadeK(hull2, nrm(0.6)));
      g.lineWidth = Math.max(px, r0 * 0.22);
      for (let k = 0; k < t.barrels; k++) {
        const oy = (k - (t.barrels - 1) / 2) * r0 * 0.3;
        g.beginPath();
        g.moveTo(X(x), yb - r0 * 0.55 + oy * 0.4);
        g.lineTo(X(x) + r0 * (t.big ? 3.4 : 2.4), yb - r0 * 0.6 + oy * 0.4);
        g.stroke();
      }
      g.fillStyle = sideGrad(yb - r0, yb, hull);
      g.beginPath();
      g.ellipse(X(x), yb - r0 * 0.45, r0 * 1.3, r0 * 0.6, 0, Math.PI, 0);
      g.lineTo(X(x) + r0 * 1.3, yb);
      g.lineTo(X(x) - r0 * 1.3, yb);
      g.closePath();
      g.fill();
    }
    if (d.tower) {
      const tw = d.tower;
      const neck = boxAt(tw.x - tw.w / 2, tw.x + tw.w / 2, 0, tw.h, tw.bw, hull2);
      void neck;
      boxAt(tw.x - tw.headW / 2, tw.x + tw.headW / 2, tw.h, tw.headH, tw.bw * 1.8, hull);
      const yTop = Y(T(tw.x) + Math.max(0, Wd(tw.x) - tw.bw * 1.8) * KK + tw.h + tw.headH) - 2 * tw.bw * 1.8 * KK * Lp;
      if (tw.dome) {
        g.fillStyle = sideGrad(yTop - tw.headH * Lp, yTop, hull);
        for (const o of [-0.25, 0.25]) {
          g.beginPath();
          g.ellipse(X(tw.x + o * tw.headW), yTop, tw.headH * Lp * 0.9, tw.headH * Lp * 0.7, 0, Math.PI, 0);
          g.fill();
        }
      }
      g.strokeStyle = css(shadeK(hull2, nrm(0.5)), 0.9);
      g.lineWidth = px;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const xx = X(tw.x + (k - 1) * tw.headW * 0.3);
        g.moveTo(xx, yTop);
        g.lineTo(xx, yTop - (0.01 + R(k, 70) * 0.025) * Lp);
      }
      g.stroke();
    }
    for (const f of d.fins) if (f.up) fin(f);

    // ---- distance, and for a wreck, char --------------------------------------------------------------------
    if (wreck) {
      g.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 26; i++) {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, 'rgba(10,6,4,0.75)');
        gr.addColorStop(1, 'rgba(10,6,4,0)');
        g.save();
        g.translate(X(R(i, 100)), Y(T(R(i, 100)) * (1 - 2 * R(i, 101))));
        g.scale((0.02 + R(i, 102) * 0.06) * Lp, (0.015 + R(i, 103) * 0.03) * Lp);
        g.fillStyle = gr;
        g.fillRect(-1, -1, 2, 2);
        g.restore();
      }
      g.globalCompositeOperation = 'source-over';
    }
    if (fog > 0.01) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = css([0.1, 0.15, 0.26], fog);
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
    return S;
  }

  /** The ship's own lights: windows, the bays' glow, engine cores. */
  function glow(g: CanvasRenderingContext2D, d: Design, Lp: number, X: (x: number) => number, Y: (h: number) => number, T: (x: number) => number, B: (x: number) => number, Wd: (x: number) => number, px: number) {
    const win = rgbOf(d.window);
    const R = (a: number, b = 0) => hash(d.seed, a, b + 500);
    const dot = Math.max(1, 0.0028 * Lp);
    for (const w of d.windows) {
      let i = 0;
      for (let x = w.x0; x < w.x1; x += w.step * (Lp < 160 ? 2.5 : 1), i++) {
        const v = R(i, w.f * 100);
        // Windows in runs, with dark gaps.
        if (v < 0.3 || Math.sin(i * 0.4 + d.seed) > 0.75) continue;
        const yy = Y(T(x) - w.f * (T(x) + B(x)));
        g.fillStyle = css([win[0] * (0.8 + v * 0.2), win[1] * (0.75 + v * 0.25), win[2] * (0.7 + v * 0.3)], 0.6 + v * 0.4);
        g.fillRect(X(x), yy, dot * 1.5, dot);
      }
    }
    const boxWin = (x0: number, x1: number, z0: number, hh: number, bw: number, rows: number) => {
      for (let rr = 0; rr < rows; rr++) {
        let i = 0;
        for (let x = x0 + 0.004; x < x1 - 0.004; x += Lp < 160 ? 0.02 : 0.007, i++) {
          if (R(i, rr * 13 + z0 * 1000) < 0.35) continue;
          const yy = Y(T(x) + Math.max(0, Wd(x) - bw) * KK + z0 + hh * ((rr + 0.5) / rows));
          g.fillStyle = css(win, 0.55 + R(i, rr) * 0.45);
          g.fillRect(X(x), yy, dot * 1.4, dot * 0.9);
        }
      }
    };
    for (const b of d.boxes) if (b.win > 0 && b.h * Lp > 4) boxWin(b.x0, b.x1, b.z0, b.h, b.bw, Math.max(1, Math.min(3, Math.floor((b.h * Lp) / 5))));
    if (d.tower) {
      const tw = d.tower;
      const yy = Y(T(tw.x) + Math.max(0, Wd(tw.x) - tw.bw * 1.8) * KK + tw.h + tw.headH * 0.45);
      g.fillStyle = css(win, 0.95);
      g.fillRect(X(tw.x - tw.headW * 0.42), yy - Math.max(1, tw.headH * Lp * 0.25), tw.headW * 0.84 * Lp, Math.max(1, tw.headH * Lp * 0.3));
      boxWin(tw.x - tw.w / 2, tw.x + tw.w / 2, 0, tw.h, tw.bw, Math.max(1, Math.min(6, Math.floor((tw.h * Lp) / 6))));
    }
    for (const b of d.bays) {
      const yy0 = Y(T(b.x0) - b.f0 * (T(b.x0) + B(b.x0)));
      const yy1 = Y(T(b.x0) - b.f1 * (T(b.x0) + B(b.x0)));
      const gr = g.createLinearGradient(0, yy0, 0, yy1);
      gr.addColorStop(0, 'rgba(255,190,130,0.12)');
      gr.addColorStop(0.6, 'rgba(255,210,160,0.4)');
      gr.addColorStop(1, 'rgba(255,236,200,0.7)');
      g.fillStyle = gr;
      const ins = Math.max(px, 0.004 * Lp);
      g.fillRect(X(b.x0) + ins, yy0 + ins, (b.x1 - b.x0) * Lp - ins * 2, yy1 - yy0 - ins * 2);
      // Craft parked in the bay, and the deck lights.
      g.fillStyle = 'rgba(20,16,14,0.85)';
      const n = Math.max(1, Math.floor(((b.x1 - b.x0) * Lp) / 14));
      for (let i = 0; i < n; i++) {
        const x = X(b.x0) + ((i + 0.5) / n) * (b.x1 - b.x0) * Lp;
        const s = Math.min(6, (yy1 - yy0) * 0.25);
        g.beginPath();
        g.moveTo(x - s, yy1 - ins);
        g.lineTo(x + s * 1.2, yy1 - ins - s * 0.3);
        g.lineTo(x - s * 0.4, yy1 - ins - s * 0.9);
        g.fill();
      }
      g.fillStyle = 'rgba(255,250,235,0.9)';
      for (let i = 0; i < n * 3; i++) g.fillRect(X(b.x0) + ins + ((i + 0.5) / (n * 3)) * ((b.x1 - b.x0) * Lp - ins * 2), yy1 - ins * 1.6, Math.max(1, px), Math.max(1, px));
    }
    const eng = rgbOf(d.engine);
    for (const e of d.engines) {
      const ey = Y(0) + e.y * Lp;
      const r0 = e.r * Lp;
      g.fillStyle = css(eng, 0.95);
      g.beginPath();
      g.ellipse(X(-e.len), ey, Math.max(0.7, r0 * 0.24), r0 * 0.95, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(X(-e.len), ey, Math.max(0.5, r0 * 0.12), r0 * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  return {
    design,
    sprite,
    lights: (d: Design): Light[] => lightsOf(d),
    /** Call once a frame: how many sprites may be baked this frame. */
    frame(n: number) {
      frame++;
      budget = n;
    },
  };
}
export type ShipArt = ReturnType<typeof createShipArt>;
