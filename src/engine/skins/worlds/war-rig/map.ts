/**
 * War Rig from overhead: the same chase seen from a vulture's height, like a matte painting of
 * the waste from above. The ground runs away under the convoy (salt pans cracked into plates,
 * dunes ridged and shadowed, gravel and rock, the canyon's rim and its long shadow, the bog's
 * black pools); tyre tracks braid along the road; every machine trails a long wake of dust; the
 * low sun throws long shadows across it all, and at night the headlights cut cones ahead.
 *
 * Same sim, another painter: a thing at (x, z) in the convoy's frame stands on the ground at
 * `(x - cx) / mOf(z)` ahead of us, and the map lays that out flat, depth becoming the map's y.
 */
import { clamp01, hash, hexA, mix, mk, posmod, type Env } from './env';
import { fillCrisp } from '../../instruments/kit';
import type { createLand } from './land';
import { dustOf } from './land';
import { KINDS, RIG } from './sim';
import type { Fx, Kind, Region, Vehicle, WarWorld } from './types';
import { mats, POINTS, type Mats } from './vehicles';

type Land = ReturnType<typeof createLand>;
const GROUND: Record<Region, string> = { flats: '#ecd0a8', dunes: '#e89048', towers: '#cc7a44', canyon: '#a8643c', bog: '#40432f' };

export function createMap(E: Env, world: WarWorld, land: Land, seed: number) {
  const { GW, GH, u } = world;
  const c = E.ctx;
  const cx = GW / 2;
  const phone = GW < GH;
  /** Map pixels per ground unit; the road's lanes spread across the map. */
  const k = (phone ? 1.05 : 0.64) * world.mOf(0.5);
  const LY = GH * (phone ? 0.3 : 0.4);
  const Y0 = GH * (phone ? 0.52 : 0.56);
  const U = u * world.VS;
  const mx = (x: number, z: number) => cx + ((x - cx) / world.mOf(z)) * k;
  const my = (z: number) => Y0 + (z - 0.5) * LY;
  const gx = (G: number) => cx + (G - world.dist) * k;

  // ---- light: where shadows fall --------------------------------------------------------------
  function shadowDir(): [number, number] {
    const [kx, ky] = land.keyLight();
    const el = clamp01((world.HY - ky) / (world.HY * 0.9));
    const len = Math.min(3.2, 0.35 + 1 / Math.tan(0.12 + el * 1.25));
    const side = (cx - kx) / GW;
    return [side * 1.3 * len, 0.75 * len];
  }

  // ---- the ground, seen from above: baked once a region, grey, laid over the hour's colour ----------
  const T = 512;
  const tex = new Map<Region, CanvasPattern | null>();
  function bake(reg: Region) {
    const cv = mk(T, T);
    const g = cv.getContext('2d')!;
    const img = g.createImageData(T, T);
    const sd = seed + reg.length * 131;
    const P = (x: number, y: number, s: number, p: number) => land.pnoise(x, y, s, p);
    // A height field, lit from the upper left, plus marks.
    const hAt = (x: number, y: number): number => {
      if (reg === 'dunes') {
        const warp = P(x / 128, y / 128, sd, T / 128) * 70;
        const ph = posmod((x + warp + y * 0.25) / 85, 1);
        const prof = ph < 0.8 ? ph / 0.8 : Math.pow(1 - (ph - 0.8) / 0.2, 1.5);
        return prof * 22 * (0.6 + P(x / 256, y / 256, sd + 1, T / 256) * 0.6) + Math.sin((x * 0.9 + y * 0.4) / 3.2) * 0.5;
      }
      if (reg === 'towers' || reg === 'canyon') {
        const n = P(x / 64, y / 64, sd + 2, T / 64);
        const rock = clamp01((n - 0.62) * 6) * (reg === 'canyon' ? 26 : 20);
        return rock + P(x / 16, y / 16, sd + 3, T / 16) * 3;
      }
      if (reg === 'bog') return P(x / 64, y / 64, sd + 4, T / 64) * 6;
      return P(x / 128, y / 128, sd + 5, T / 128) * 4;
    };
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const h0 = hAt(x, y);
        const dx = hAt(x + 1, y) - h0;
        const dy = hAt(x, y + 1) - h0;
        // Lambert from the upper left.
        let v = 128 + (-dx * 0.7 - dy * 0.7) * 22;
        const grain = (hash(x, y, sd) - 0.5) * 12;
        if (reg === 'flats') {
          // Plates of salt, cracked at their edges, lips raised.
          const fx = x / 48;
          const fy = y / 42;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          let f1 = 9;
          let f2 = 9;
          let id = 0;
          for (let a = -1; a <= 1; a++)
            for (let b = -1; b <= 1; b++) {
              const X = posmod(ix + a, T / 48 | 0);
              const Y = posmod(iy + b, Math.round(T / 42));
              const px = ix + a + hash(X, Y, sd);
              const py = iy + b + hash(X, Y, sd + 1);
              const d = Math.hypot(fx - px, fy - py);
              if (d < f1) {
                f2 = f1;
                f1 = d;
                id = hash(X, Y, sd + 2);
              } else if (d < f2) f2 = d;
            }
          const edge = (f2 - f1) * 45;
          v += (id - 0.5) * 22 + (edge < 1.6 ? -70 : edge < 4 ? 16 : 0);
        } else if (reg === 'bog') {
          const n = P(x / 90, y / 90, sd + 6, Math.round(T / 90));
          if (n > 0.6) v = 70 + (n - 0.6) * 60 + Math.sin(x * 0.2) * 3;
          else if (n > 0.57) v = 150;
          if (hash(Math.floor(x / 3), Math.floor(y / 3), sd + 7) < 0.03 && n < 0.55) v = 170;
        } else if (reg === 'towers' || reg === 'canyon') {
          if (hash(Math.floor(x / 5), Math.floor(y / 5), sd + 8) < 0.05) v += (y % 5) < 2 ? 50 : -40;
        }
        v += grain;
        const o = (y * T + x) * 4;
        const q = Math.max(0, Math.min(255, v));
        img.data[o] = img.data[o + 1] = img.data[o + 2] = q;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.createPattern(cv, 'repeat');
  }
  const patOf = (reg: Region) => {
    if (!tex.has(reg)) tex.set(reg, bake(reg));
    return tex.get(reg)!;
  };
  /** Where a leg of road begins on the map: it comes in at the right edge when it starts. */
  const legX = (at: number) => cx + (at + (GW - cx) / k - world.dist) * k;
  function ground() {
    const legs = world.legs;
    const cur = legs[legs.length - 1];
    const prev = legs.length > 1 ? legs[legs.length - 2] : cur;
    const xb = prev === cur ? -1e9 : legX(cur.at);
    const spans: [Region, number, number][] = prev === cur || xb < -40 ? [[cur.kind, -40, GW + 40]] : xb > GW + 40 ? [[prev.kind, -40, GW + 40]] : [[prev.kind, -40, xb], [cur.kind, xb, GW + 40]];
    const mat = typeof DOMMatrix !== 'undefined' ? new DOMMatrix() : null;
    for (const [i, [rg, x0, x1]] of spans.entries()) {
      c.save();
      // A ragged edge where one ground gives way to the next.
      c.beginPath();
      const ragged = (x: number) => {
        for (let y = -40; y <= GH + 40; y += 12) c.lineTo(x + (land.pnoise(y / 60, 3, seed + 9) - 0.5) * 80 * u + (hash(Math.floor(y / 12), 4, seed) - 0.5) * 10 * u, y);
      };
      if (i === 0) {
        c.moveTo(x0, -40);
        ragged(x1);
        c.lineTo(x0, GH + 40);
      } else {
        c.moveTo(x1, -40);
        c.lineTo(x1, GH + 40);
        for (let y = GH + 40; y >= -40; y -= 12) c.lineTo(x0 + (land.pnoise(y / 60, 3, seed + 9) - 0.5) * 80 * u + (hash(Math.floor(y / 12), 4, seed) - 0.5) * 10 * u, y);
      }
      c.closePath();
      c.clip();
      const base = c.createLinearGradient(0, 0, 0, GH);
      base.addColorStop(0, E.tone(GROUND[rg], 0.25, 0.45));
      base.addColorStop(0.5, E.tone(GROUND[rg], 0.12, 0.55));
      base.addColorStop(1, E.tone(GROUND[rg], 0.18, 0.4));
      c.fillStyle = base;
      c.fillRect(-40, -40, GW + 80, GH + 80);
      const pat = patOf(rg);
      if (pat && mat) {
        mat.a = 1;
        mat.d = 1;
        mat.e = -posmod(world.dist * k, T);
        mat.f = 0;
        pat.setTransform(mat);
        c.globalCompositeOperation = 'overlay';
        c.fillStyle = pat;
        c.fillRect(-40, -40, GW + 80, GH + 80);
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    }
    // The road: a broad band of churned ground, braided with tyre tracks.
    const road0 = my(-0.08);
    const road1 = my(1.08);
    const rg = c.createLinearGradient(0, road0 - 20 * u, 0, road1 + 20 * u);
    const churn = E.tone(mix(GROUND[cur.kind], '#6a4a30', 0.25), 0.15, 0.3);
    rg.addColorStop(0, hexA(churn, 0));
    rg.addColorStop(0.12, hexA(churn, 0.32));
    rg.addColorStop(0.88, hexA(churn, 0.32));
    rg.addColorStop(1, hexA(churn, 0));
    c.fillStyle = rg;
    c.fillRect(-40, road0 - 20 * u, GW + 80, road1 - road0 + 40 * u);
    const track = E.tone('#3a2618', 0.15, 0.05);
    c.strokeStyle = hexA(track, cur.kind === 'bog' ? 0.5 : 0.28);
    c.lineWidth = Math.max(0.8, 1.6 * u);
    for (let i = 0; i < 18; i++) {
      const z = -0.04 + hash(i, 1, seed) * 1.08;
      c.beginPath();
      for (let x = -40; x <= GW + 40; x += 20) {
        const G = world.dist + (x - cx) / k;
        const y = my(z) + (land.pnoise(G / (900 * u), i, seed + 13) - 0.5) * 40 * u;
        if (x === -40) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    // The light raking across, warm from the sun's side, the far side in shade.
    const [sdx] = shadowDir();
    const lg = c.createLinearGradient(0, 0, GW, 0);
    lg.addColorStop(sdx > 0 ? 0 : 1, hexA(E.L.sun, 0.12 * (1 - E.night)));
    lg.addColorStop(sdx > 0 ? 1 : 0, hexA(E.L.fill, 0.18));
    c.fillStyle = lg;
    c.fillRect(-40, -40, GW + 80, GH + 80);
  }

  // ---- the canyon's rim: the plateau above, its cliff edge, its long shadow on the floor --------------
  function canyon() {
    const zW = -0.42;
    const edge: [number, number][] = [];
    let any = false;
    for (let x = -40; x <= GW + 40; x += 8) {
      const G = world.dist + (x - cx) / k;
      let w = 0;
      for (const [rg, q] of land.regionMix(G - (GW - cx) / k)) if (rg === 'canyon') w += q;
      if (w > 0.02) any = true;
      const y = w <= 0 ? -60 : my(zW) - (1 - w) * (my(zW) + 60) + (land.pnoise(G / (200 * u), 2, seed + 21) - 0.5) * 30 * u;
      edge.push([x, y]);
    }
    if (!any) return;
    const [sdx, sdy] = shadowDir();
    // Its shadow, thrown onto the floor.
    c.fillStyle = hexA(E.tone('#14202a', 0.2), 0.45 * (1 - E.night * 0.4));
    c.beginPath();
    c.moveTo(-40, -60);
    for (const [x, y] of edge) c.lineTo(x + sdx * 60 * u, y + Math.max(0, sdy) * 70 * u * (y > 0 ? 1 : 0));
    c.lineTo(GW + 40, -60);
    c.fill();
    // The plateau: rock, its strata as contour lines stepping back from the edge.
    const top = new Path2D();
    top.moveTo(-40, -60);
    for (const [x, y] of edge) top.lineTo(x, y);
    top.lineTo(GW + 40, -60);
    top.closePath();
    c.fillStyle = E.tone('#a05c38', 0.2, 0.4);
    c.fill(top);
    c.save();
    c.clip(top);
    c.strokeStyle = hexA(E.tone('#5a3020', 0.2), 0.35);
    c.lineWidth = Math.max(0.6, 1.2 * u);
    for (let q = 1; q < 7; q++) {
      c.beginPath();
      for (const [x, y] of edge) c.lineTo(x + Math.sin(x * 0.01 + q) * 6 * u, y - q * 14 * u - (land.pnoise(x / 80, q, seed) - 0.5) * 10 * u);
      c.stroke();
    }
    c.restore();
    // The lit lip of the cliff.
    c.strokeStyle = hexA(E.tone('#ffc080', 0.1, 1), 0.6 * (0.3 + E.L.rim));
    c.lineWidth = Math.max(1, 2.4 * u);
    c.beginPath();
    edge.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }

  // ---- props from above --------------------------------------------------------------------------
  function props() {
    const g0 = world.dist + (-80 - cx) / k;
    const g1 = world.dist + (GW + 80 - cx) / k;
    const [sdx, sdy] = shadowDir();
    const shade = hexA(E.tone('#10202a', 0.2), 0.42 * (1 - E.night * 0.5));
    for (const p of land.propSpecs(() => [g0, g1])) {
      const x = gx(p.G);
      const y = my(p.z);
      if (y < -40 || y > GH + 40) continue;
      const s = U * k;
      const H = (q: number) => hash(p.ps, q);
      const tall = p.kind === 'spire' ? 140 : p.kind === 'pole' ? 120 : p.kind === 'tree' ? 70 : p.kind === 'stilt' ? 90 : p.kind === 'boulder' ? 40 : p.kind === 'rock' ? 18 : 8;
      // The shadow first: a long dark finger across the ground.
      c.strokeStyle = shade;
      c.fillStyle = shade;
      c.lineCap = 'round';
      const r0 = (p.kind === 'boulder' ? 26 : p.kind === 'rock' ? 10 : p.kind === 'spire' ? 14 : p.kind === 'husk' ? 30 : 6) * s;
      c.lineWidth = Math.max(1, r0 * (p.kind === 'pole' || p.kind === 'tree' ? 0.4 : 1.4));
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + sdx * tall * s * 0.6, y + sdy * tall * s * 0.6);
      c.stroke();
      c.lineCap = 'butt';
      const d = 0.15;
      if (p.kind === 'rock' || p.kind === 'boulder' || p.kind === 'spire') {
        const rr = r0 * (0.8 + H(1) * 0.4);
        const g = c.createRadialGradient(x - rr * 0.35, y - rr * 0.35, rr * 0.1, x, y, rr);
        g.addColorStop(0, E.tone('#e8a870', d, 0.9));
        g.addColorStop(0.6, E.tone('#9a5a38', d, 0.2));
        g.addColorStop(1, E.tone('#3a2218', d, 0));
        c.fillStyle = g;
        c.beginPath();
        for (let q = 0; q < 9; q++) {
          const a = (q / 9) * Math.PI * 2;
          const rq = rr * (0.8 + H(q + 3) * 0.35);
          c.lineTo(x + Math.cos(a) * rq, y + Math.sin(a) * rq * 0.9);
        }
        c.fill();
      } else if (p.kind === 'tree') {
        c.strokeStyle = E.tone(p.reg === 'bog' ? '#1e2018' : '#4a3020', d, 0.2);
        c.lineWidth = Math.max(0.6, 2 * s);
        c.beginPath();
        for (let q = 0; q < 6; q++) {
          const a = H(q) * Math.PI * 2;
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * (14 + H(q + 9) * 14) * s, y + Math.sin(a) * (14 + H(q + 9) * 14) * s);
        }
        c.stroke();
      } else if (p.kind === 'husk') {
        c.save();
        c.translate(x, y);
        c.rotate((H(1) - 0.5) * 1.2);
        c.fillStyle = E.tone('#6a3420', d, 0.4);
        c.fillRect(-30 * s, -12 * s, 60 * s, 24 * s);
        c.fillStyle = E.tone('#2a1810', d, 0);
        c.fillRect(-8 * s, -10 * s, 18 * s, 20 * s);
        c.restore();
      } else if (p.kind === 'salt') {
        c.fillStyle = E.tone('#fff6e8', d, 0.8);
        c.beginPath();
        c.arc(x, y, (8 + H(1) * 10) * s, 0, Math.PI * 2);
        c.fill();
      } else if (p.kind === 'reeds' || p.kind === 'tuft') {
        c.strokeStyle = E.tone(p.reg === 'bog' ? '#4a5a30' : '#a8904a', d, 0.4);
        c.lineWidth = Math.max(0.6, s);
        c.beginPath();
        for (let q = 0; q < 8; q++) {
          const a = H(q) * Math.PI * 2;
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s);
        }
        c.stroke();
      } else if (p.kind === 'stilt') {
        c.fillStyle = E.tone('#2a2420', d, 0.2);
        c.beginPath();
        c.arc(x, y, 4 * s, 0, Math.PI * 2);
        c.fill();
        E.glow(x + 6 * s, y - 4 * s, 26 * s, '#ffb050', 0.5 + 0.5 * E.night);
      } else {
        c.fillStyle = p.kind === 'bones' ? E.tone('#efe2c8', d, 0.6) : E.tone('#3a2a20', d, 0.3);
        c.beginPath();
        c.arc(x, y, 4 * s, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  // ---- dust wakes --------------------------------------------------------------------------------
  function wake(x: number, y: number, len: number, width: number, seedW: number, strength: number) {
    const bog = world.region === 'bog';
    const dust = world.region === 'flats' ? mix(dustOf('flats'), '#9a6a44', 0.45) : dustOf(world.region);
    const col = E.tone(dust, 0.1, 0.45);
    const lit = E.tone(dust, 0.1, 1);
    const spr = E.soft(col);
    const sprL = E.soft(lit);
    const life = bog ? 0.9 : 2.2;
    const speed = world.V * k;
    const N = 16;
    const [sdx] = shadowDir();
    for (let q = 0; q < N; q++) {
      const a = posmod(E.t / life + q / N + hash(seedW, q) * 0.2, 1);
      const age = a * life;
      const px = x - speed * age * 0.92;
      const spread = width * (0.7 + age * 2.4);
      const py = y + Math.sin(E.t * 1.3 + q * 2 + seedW) * spread * 0.15;
      const r = spread * (bog ? 0.4 : 1);
      const al = 0.7 * Math.pow(1 - a, 1.05) * Math.min(1, a * 8) * strength * (1 - E.storm * 0.4);
      c.globalAlpha = al;
      c.drawImage(spr, px - r * 1.3, py - r, r * 2.6, r * 2);
      c.globalAlpha = al * 0.55 * (1 - E.night * 0.6);
      c.drawImage(sprL, px - r * 1.1 - sdx * r * 0.2, py - r * 0.9, r * 2.2, r * 1.6);
    }
    c.globalAlpha = 1;
    void len;
  }

  // ---- machines from above -------------------------------------------------------------------------
  /** A machine seen from above, nose to the right: body, cab, wheels, the kind's furniture, crew. */
  function topDown(kind: Kind | 'rig', M: Mats, x: number, y: number, s: number, rot: number, o: { pole?: number; poleZ?: number; beat?: number; burnt?: boolean; boost?: number; seed: number }) {
    const L = kind === 'rig' ? RIG.L : KINDS[kind].L;
    const Wd = kind === 'rig' ? 46 : kind === 'bike' ? 10 : kind === 'howler' ? 42 : kind === 'crusher' ? 46 : kind === 'throne' ? 40 : 30;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    const wheelsAt = POINTS[kind].wheels;
    const tyre = M.tyre;
    // Wheels, poking out from under.
    c.fillStyle = tyre;
    for (const [wx, r] of wheelsAt) {
      const ww = kind === 'crusher' || kind === 'throne' ? 12 : kind === 'bike' ? 3 : 6;
      c.beginPath();
      c.roundRect(wx - r * 0.85, -Wd / 2 - ww * 0.5, r * 1.7, ww, 2);
      c.roundRect(wx - r * 0.85, Wd / 2 - ww * 0.5, r * 1.7, ww, 2);
      c.fill();
    }
    const body = (x0: number, x1: number, w: number, col: string, lit: string, rr = 4) => {
      const g = c.createLinearGradient(0, -w / 2, 0, w / 2);
      g.addColorStop(0, lit);
      g.addColorStop(0.45, col);
      g.addColorStop(1, mix(col, M.dark, 0.5));
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(x0, -w / 2, x1 - x0, w, rr);
      c.fill();
    };
    if (kind === 'rig') {
      const half = RIG.L / 2;
      // The tank seen from above: a cylinder, brightest along its crown, its bands, the catwalk on top.
      const tank = (x0: number, x1: number) => {
        const g = c.createLinearGradient(0, -24, 0, 24);
        g.addColorStop(0, mix(M.rust, M.dark, 0.4));
        g.addColorStop(0.32, M.rustL);
        g.addColorStop(0.5, M.rust);
        g.addColorStop(1, M.dark);
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(x0, -24, x1 - x0, 48, 20);
        c.fill();
        c.fillStyle = hexA(M.dark, 0.5);
        for (let bx = x0 + 10; bx < x1 - 6; bx += 24) c.fillRect(bx, -23, 3, 46);
        c.strokeStyle = M.steelL;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x0 + 6, -6);
        c.lineTo(x1 - 6, -6);
        c.moveTo(x0 + 6, 2);
        c.lineTo(x1 - 6, 2);
        c.stroke();
      };
      tank(-half, 40);
      c.fillStyle = hexA(M.rim, 0.45 * M.rimA);
      c.fillRect(-half + 12, -10, 176, 2.5);
      c.fillStyle = M.steel;
      c.beginPath();
      c.arc(-48, -2, 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = M.steelD;
      c.fillRect(-48, -4, 22, 4);
      // The tractor: cab roof, the long nose with its louvres and the two blowers, stacks, fenders.
      c.fillStyle = M.tyre;
      for (const fx of [64, 92, 132]) {
        c.beginPath();
        c.ellipse(fx, -21, 13, 5, 0, 0, Math.PI * 2);
        c.ellipse(fx, 21, 13, 5, 0, 0, Math.PI * 2);
        c.fill();
      }
      body(56, 100, 42, M.paint, M.paintL, 6);
      c.fillStyle = M.glass;
      c.fillRect(94, -16, 5, 32);
      body(100, 154, 32, M.paint, M.paintL, 10);
      c.strokeStyle = hexA(M.dark, 0.6);
      c.lineWidth = 1;
      c.beginPath();
      for (let lx = 104; lx < 140; lx += 4) {
        c.moveTo(lx, -14);
        c.lineTo(lx, -10);
        c.moveTo(lx, 10);
        c.lineTo(lx, 14);
      }
      c.stroke();
      for (const bx of [114, 132]) {
        c.fillStyle = vg(-7, 7, M.chromeL, M.chromeD);
        c.beginPath();
        c.roundRect(bx - 7, -7, 14, 14, 2);
        c.fill();
        c.fillStyle = M.dark;
        c.fillRect(bx + 2, -4, 4, 8);
      }
      for (const sy of [-16, 16]) {
        c.fillStyle = M.chrome;
        c.beginPath();
        c.arc(52, sy, 3.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = M.dark;
        c.beginPath();
        c.arc(52, sy, 1.8, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = M.steelD;
      c.beginPath();
      c.moveTo(154, -18);
      c.lineTo(168, -4);
      c.lineTo(168, 4);
      c.lineTo(154, 18);
      c.fill();
      c.strokeStyle = M.chrome;
      c.lineWidth = 1.4;
      c.beginPath();
      for (const sy of [-12, -4, 4, 12]) {
        c.moveTo(166, sy);
        c.lineTo(176, sy);
      }
      c.stroke();
      // The crew on her back.
      c.fillStyle = M.skin;
      for (const hx of [-138, -96, -48, 6]) {
        c.beginPath();
        c.arc(hx, 8, 3.6, 0, Math.PI * 2);
        c.fill();
      }
    } else if (kind === 'howler') {
      body(-L / 2, L / 2 - 30, Wd, M.steelD, M.steel, 3);
      // The speaker wall, cones pumping.
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 3; j++) {
          const r0 = 5.5 * (1 + (o.beat ?? 0) * 0.15);
          c.fillStyle = M.dark;
          c.beginPath();
          c.arc(-56 + i * 17, -12 + j * 12, r0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = M.chrome;
          c.beginPath();
          c.arc(-56 + i * 17, -12 + j * 12, r0 * 0.5, 0, Math.PI * 2);
          c.fill();
        }
      body(L / 2 - 32, L / 2, Wd * 0.9, M.paint, M.paintL, 5);
      c.strokeStyle = M.steel;
      c.lineWidth = 2;
      c.strokeRect(L / 2, -14, 14, 28);
      c.fillStyle = M.cloth;
      c.beginPath();
      c.arc(L / 2 + 16, 0, 5, 0, Math.PI * 2);
      c.fill();
    } else {
      const col = M.paint;
      const lit = M.paintL;
      if (kind === 'bike') {
        c.fillStyle = M.steelD;
        c.fillRect(-L / 2, -2, L, 4);
        c.fillStyle = M.cloth;
        c.beginPath();
        c.arc(-2, 0, 4.5, 0, Math.PI * 2);
        c.arc(-11, 0, 4, 0, Math.PI * 2);
        c.fill();
      } else {
        // A car from above: fenders over the wheels, a nose narrower than the tail, hood, glass, roof, deck.
        const pc = kind === 'porcupine' ? M.rust : col;
        const pl = kind === 'porcupine' ? M.rustL : lit;
        const g = c.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
        g.addColorStop(0, mix(pc, M.dark, 0.3));
        g.addColorStop(0.3, pl);
        g.addColorStop(0.6, pc);
        g.addColorStop(1, M.dark);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-L / 2, -Wd * 0.42);
        c.quadraticCurveTo(-L / 2 - 2, 0, -L / 2, Wd * 0.42);
        c.lineTo(L * 0.2, Wd * 0.46);
        c.quadraticCurveTo(L / 2, Wd * 0.4, L / 2, 0);
        c.quadraticCurveTo(L / 2, -Wd * 0.4, L * 0.2, -Wd * 0.46);
        c.closePath();
        c.fill();
        for (const [wx] of wheelsAt) {
          c.fillStyle = mix(pc, M.dark, 0.25);
          c.beginPath();
          c.ellipse(wx, -Wd * 0.44, 9, 4, 0, 0, Math.PI * 2);
          c.ellipse(wx, Wd * 0.44, 9, 4, 0, 0, Math.PI * 2);
          c.fill();
        }
        // The hood's ridge, the glass, the roof catching the light.
        c.strokeStyle = hexA(pl, 0.8);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(L * 0.12, 0);
        c.lineTo(L * 0.46, 0);
        c.stroke();
        c.fillStyle = M.glass;
        c.beginPath();
        c.moveTo(L * 0.06, -Wd * 0.34);
        c.lineTo(L * 0.12, -Wd * 0.3);
        c.lineTo(L * 0.12, Wd * 0.3);
        c.lineTo(L * 0.06, Wd * 0.34);
        c.fill();
        c.fillStyle = vg(-Wd * 0.3, Wd * 0.3, pl, mix(pc, M.dark, 0.3));
        c.fillRect(-L * 0.18, -Wd * 0.3, L * 0.24, Wd * 0.6);
        if (kind === 'hotrod' && o.seed % 3 !== 2) {
          c.fillStyle = hexA('#ffa020', 0.7);
          for (let q = 0; q < 3; q++) {
            c.beginPath();
            c.moveTo(L * 0.48, -Wd * 0.3 + q * Wd * 0.3);
            c.lineTo(L * 0.2, -Wd * 0.36 + q * Wd * 0.3);
            c.lineTo(L * 0.3, -Wd * 0.22 + q * Wd * 0.3);
            c.fill();
          }
        }
        if (kind !== 'porcupine' && kind !== 'drifter') {
          // Spikes along the flanks.
          c.strokeStyle = M.chrome;
          c.lineWidth = 0.9;
          c.beginPath();
          for (let q = 0; q < 5; q++) {
            const sx = -L * 0.4 + q * L * 0.2;
            c.moveTo(sx, -Wd * 0.47);
            c.lineTo(sx - 3, -Wd * 0.47 - 6);
            c.moveTo(sx, Wd * 0.47);
            c.lineTo(sx - 3, Wd * 0.47 + 6);
          }
          c.stroke();
        }
        if (kind === 'hotrod' || kind === 'throne' || kind === 'drifter') {
          c.fillStyle = vg(-5, 5, M.chromeL, M.chromeD);
          c.fillRect(L * 0.24, -5, 11, 10);
        }
        if (kind === 'porcupine') {
          c.strokeStyle = M.chrome;
          c.lineWidth = 1;
          c.beginPath();
          for (let q = 0; q < 24; q++) {
            const a = (q / 24) * Math.PI * 2;
            c.moveTo(Math.cos(a) * L * 0.42, Math.sin(a) * Wd * 0.45);
            c.lineTo(Math.cos(a) * (L * 0.42 + 12), Math.sin(a) * (Wd * 0.45 + 12));
          }
          c.stroke();
        }
        if (kind === 'crusher') {
          c.fillStyle = M.steel;
          c.beginPath();
          c.arc(-8, 0, 15, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = M.steelD;
          c.fillRect(4, -2.5, 52, 5);
        }
        if (kind === 'ram') {
          c.fillStyle = M.steelD;
          c.beginPath();
          c.moveTo(L / 2, -Wd / 2 - 4);
          c.lineTo(L / 2 + 14, 0);
          c.lineTo(L / 2, Wd / 2 + 4);
          c.fill();
        }
        c.fillStyle = M.skin;
        const heads = kind === 'buggy' ? 2 : kind === 'ram' ? 3 : kind === 'throne' ? 3 : 2;
        for (let q = 0; q < heads; q++) {
          c.beginPath();
          c.arc(-L * 0.3 + q * 9, (q % 2 ? 4 : -4), 3.4, 0, Math.PI * 2);
          c.fill();
        }
      }
      // The polecat's pole, reaching out sideways toward the rig when it attacks.
      if (kind === 'polecat' && o.pole !== undefined) {
        const reach = Math.sin(clamp01(o.pole)) * 170;
        const dir = (o.poleZ ?? 0) < 0.5 ? 1 : -1;
        c.strokeStyle = M.steelD;
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(-6, 0);
        c.lineTo(-6 + Math.cos(o.pole) * 30, dir * reach);
        c.stroke();
        c.fillStyle = M.skin;
        c.beginPath();
        c.arc(-6 + Math.cos(o.pole) * 30, dir * reach, 4, 0, Math.PI * 2);
        c.fill();
      }
    }
    // The light along its top edge.
    c.strokeStyle = hexA(M.rim, 0.35 * M.rimA);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-L / 2 + 4, -Wd / 2 + 1);
    c.lineTo(L / 2 - 4, -Wd / 2 + 1);
    c.stroke();
    c.restore();
  }
  const vg = (y0: number, y1: number, a: string, b: string) => {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  /** The shadow under and beside a machine; longer when it is in the air. */
  function machineShadow(kind: Kind | 'rig', x: number, y: number, s: number, alt: number, rot: number) {
    const L = kind === 'rig' ? RIG.L : KINDS[kind].L;
    const Wd = kind === 'rig' ? 46 : kind === 'bike' ? 12 : 34;
    const [sdx, sdy] = shadowDir();
    const h = (kind === 'rig' ? 110 : KINDS[kind].H) * 0.5 + alt / U;
    c.save();
    c.translate(x + sdx * h * s * 0.5, y + sdy * h * s * 0.5);
    c.rotate(rot);
    c.fillStyle = hexA(E.tone('#0e1c22', 0.2), 0.45 * (1 - E.night * 0.45) * clamp01(1 - alt / (500 * U)));
    c.beginPath();
    c.roundRect((-L / 2) * s, (-Wd / 2) * s, L * s, Wd * s, 6 * s);
    c.fill();
    c.restore();
  }
  /** Headlights from above: cones on the ground ahead. */
  function beams(x: number, y: number, s: number, L: number, wide: number) {
    const lit = Math.max(E.night, E.storm * 0.7);
    if (lit < 0.05) return;
    const x0 = x + (L / 2) * s;
    const len = 300 * u * k * 2.2;
    const g = c.createLinearGradient(x0, 0, x0 + len, 0);
    g.addColorStop(0, hexA('#fff0c8', 0.3 * lit));
    g.addColorStop(1, hexA('#fff0c8', 0));
    c.fillStyle = g;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(x0, y + side * wide * 0.3 * s);
      c.lineTo(x0 + len, y + side * wide * 0.3 * s - 50 * u * k);
      c.lineTo(x0 + len, y + side * wide * 0.3 * s + 50 * u * k);
      c.fill();
    }
  }

  // ---- what flies and burns -------------------------------------------------------------------------
  function fxAt(f: Fx) {
    const age = E.t - f.t0;
    if (age < 0) return;
    const q = clamp01(age / f.dur);
    const x = mx(f.x, f.z);
    const y = my(f.z) - f.alt * k * 0.35;
    const s = k / Math.max(0.3, world.mOf(f.z)) * 0.9;
    if (f.kind === 'smoke' || f.kind === 'dust') {
      const r = f.r * s * (1 + q * 2.6);
      c.globalAlpha = 0.5 * Math.pow(1 - q, 1.1) * Math.min(1, age * 4);
      c.drawImage(E.soft(f.kind === 'dust' ? E.tone(dustOf(world.region), 0.1, 0.5) : E.tone(f.color, 0.2, 0.1)), x - r, y - r, r * 2, r * 2);
      c.globalAlpha = 1;
    } else if (f.kind === 'boom') {
      const r = f.r * s * (0.7 + q * 1.4);
      c.globalAlpha = 0.9 * (1 - q * 0.6);
      c.drawImage(E.soft(q < 0.35 ? mix('#ffd060', '#ff6a1a', q / 0.35) : mix('#c03a10', '#2a1a14', (q - 0.35) / 0.65)), x - r, y - r, r * 2, r * 2);
      c.globalAlpha = 1;
    } else if (f.kind === 'debris' || f.kind === 'body' || f.kind === 'wheel') {
      c.fillStyle = E.tone(f.kind === 'body' ? '#d8ccb8' : '#3a3028', 0.2, 0.3);
      c.fillRect(x - 2 * u, y - 2 * u, 4 * u, 4 * u);
    }
  }
  function fxLight(f: Fx) {
    const age = E.t - f.t0;
    if (age < 0) return;
    const q = clamp01(age / f.dur);
    const x = mx(f.x, f.z);
    const y = my(f.z) - f.alt * k * 0.35;
    const s = k / Math.max(0.3, world.mOf(f.z));
    if (f.kind === 'boom') E.glow(x, y, f.r * s * 2.4 * (1 + q), '#ff8a30', 0.7 * (1 - q));
    else if (f.kind === 'flash') {
      E.glow(x, y, f.r * s * (0.8 + q), '#fff0c0', 0.9 * (1 - q));
      // The shock ring on the ground.
      c.strokeStyle = hexA('#ffe0b0', 0.5 * (1 - q));
      c.lineWidth = 2 * u;
      c.beginPath();
      c.arc(x, my(f.z), f.r * s * (0.4 + q * 2.5), 0, Math.PI * 2);
      c.stroke();
    } else if (f.kind === 'fire') E.glow(x, y, f.r * s * 2, '#ff8a30', 0.6 * (1 - q));
  }

  // ---- the frame ------------------------------------------------------------------------------------
  function paint() {
    ground();
    canyon();
    props();
    // Scorched ground where wrecks burn, and the wrecks.
    for (const wk of world.wrecks) {
      const x = mx(wk.x, wk.z);
      const y = my(wk.z);
      const s = U * k;
      const g = c.createRadialGradient(x, y, 0, x, y, 60 * s);
      g.addColorStop(0, hexA('#120a06', 0.6));
      g.addColorStop(1, hexA('#120a06', 0));
      c.fillStyle = g;
      c.fillRect(x - 60 * s, y - 60 * s, 120 * s, 120 * s);
      topDown(wk.kind, mats(E, 0.1, wk.clan, wk.seed, x, true), x, y, s, wk.seed % 7 - 3 + (wk.rot ? 2.4 : 0) * 0.1, { seed: wk.seed });
    }
    // Wakes, then shadows, then the machines (near the ground first, the ones in the air last).
    const rig = world.rig;
    const rS = U * k;
    const rx = mx(rig.x, rig.z);
    const ry = my(rig.z);
    const vs = world.vehicles.filter((v) => v.x > -500 * u && v.x < GW + 500 * u);
    for (const v of vs) if (v.alt < 5 && v.state !== 'stuck') wake(mx(v.x, v.z) - (KINDS[v.kind].L / 2) * U * k, my(v.z), 1, KINDS[v.kind].L * 0.35 * U * k, v.seed, 0.8 + v.boost * 0.3);
    wake(rx - (RIG.L / 2) * rS, ry, 1, 60 * rS, 7, 1.2);
    if (rig.leak > 0) {
      c.fillStyle = hexA(rig.cargo === 'fuel' ? '#140c08' : '#6ab8d8', 0.55 * rig.leak);
      for (let q = 0; q < 10; q++) {
        const px = rx + rig.leakAt * rS - q * 40 * rS;
        c.beginPath();
        c.ellipse(px, ry + 26 * rS + Math.sin(q * 2) * 4 * rS, 14 * rS * (1 + q * 0.1), 5 * rS, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    machineShadow('rig', rx, ry, rS, 0, 0);
    for (const v of vs) machineShadow(v.kind, mx(v.x, v.z), my(v.z), U * k, v.alt, v.state === 'crash' || v.state === 'flung' ? v.rot : 0);
    const air = (v: Vehicle) => v.alt > 5;
    for (const v of vs.filter((q) => !air(q))) {
      const M = mats(E, 0.1, v.clan, v.seed, v.x);
      topDown(v.kind, M, mx(v.x, v.z), my(v.z) + (v.state === 'stuck' ? 0 : Math.sin(E.t * 9 + v.seed) * 0.5), U * k * (1 - v.sink * 0.2), 0, { pole: v.pole, poleZ: v.z, beat: v.kind === 'howler' ? Math.pow(Math.max(0, Math.sin(E.t * 13.2)), 6) : 0, seed: v.seed, boost: v.boost });
    }
    topDown('rig', mats(E, 0.1, 'rig', 7, rx), rx, ry + Math.sin(E.t * 4.1) * 0.6, rS, rig.knock * 0.02 * Math.sin(E.t * 30), { seed: 7 });
    // Boarders on the tank: little figures on its back.
    c.fillStyle = E.tone('#e8e0d0', 0.1, 0.5);
    for (const b of rig.boarders) {
      c.beginPath();
      c.arc(rx + b.at, ry - 6 * rS, 4 * rS, 0, Math.PI * 2);
      c.fill();
    }
    for (const f of world.fx) if (f.kind !== 'boom') fxAt(f);
    for (const v of vs.filter(air)) {
      const lift = v.alt * k * 0.35;
      topDown(v.kind, mats(E, 0.1, v.clan, v.seed, v.x), mx(v.x, v.z), my(v.z) - lift, U * k * (1 + clamp01(v.alt / (900 * U)) * 0.4), v.rot * 0.5, { seed: v.seed });
    }
    for (const f of world.fx) if (f.kind === 'boom') fxAt(f);
    // Missiles: the thing, and its shadow on the ground under it.
    for (const ms of world.missiles) {
      const x = mx(ms.x, ms.z);
      const y = my(ms.z);
      c.fillStyle = hexA('#0e1a20', 0.35);
      c.beginPath();
      c.arc(x, y, 3 * u, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = ms.kind === 'flare' ? '#ff6a4a' : '#2a2018';
      c.beginPath();
      c.arc(x, y - ms.alt * k * 0.35, (ms.kind === 'flare' ? 4 : 2.6) * u, 0, Math.PI * 2);
      c.fill();
    }
    // Light: beams, flames, fire, tracers.
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const v of vs) if (!air(v) && v.state !== 'stuck') beams(mx(v.x, v.z), my(v.z), U * k, KINDS[v.kind].L, 30);
    beams(rx, ry, rS, RIG.L, 46);
    for (const wk of world.wrecks) if (wk.burn > 0.2) E.glow(mx(wk.x, wk.z), my(wk.z), 60 * u * k * 2 * wk.burn, '#ff7a28', 0.55 * wk.burn * (0.8 + 0.2 * Math.sin(E.t * 13 + wk.seed)));
    for (const f of world.fx) fxLight(f);
    for (const sh of world.shots) {
      const q = (E.t - sh.t0) / sh.dur;
      if (q < 0 || q > 1) continue;
      const p = (t: number) => {
        const z = sh.z0 + (sh.z1 - sh.z0) * t;
        return [mx(sh.x0 + (sh.x1 - sh.x0) * t, z), my(z) - (sh.a0 + (sh.a1 - sh.a0) * t) * k * 0.35] as [number, number];
      };
      const [x1, y1] = p(q);
      const [x0, y0] = p(Math.max(0, q - 0.3));
      c.strokeStyle = hexA(sh.color, 0.95);
      c.lineWidth = Math.max(1, 1.5 * u);
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
    }
    for (const ms of world.missiles) E.glow(mx(ms.x, ms.z), my(ms.z) - ms.alt * k * 0.35, (ms.kind === 'flare' ? 90 : 10) * u, ms.kind === 'flare' ? '#ff5a3a' : '#ffb050', ms.kind === 'flare' ? 0.5 : 0.8);
    for (const b of world.bolts) {
      const q = (E.t - b.t0) / 0.6;
      if (q < 0 || q > 1) continue;
      E.glow(mx(b.x, b.z), my(b.z), 160 * u, '#c8b8ff', (1 - q) * 0.9);
    }
    c.restore();
    storm();
    night();
    lettering();
  }
  /** The storm from above: a wheel of orange murk turning over the road. */
  function storm() {
    const st = world.storm;
    if (st < 0.01) return;
    const ex = world.stormX;
    const ey = my(0.5);
    const spr = E.soft(E.tone('#a8582a', 0.4, 0.4));
    const sprD = E.soft(E.tone('#3a2014', 0.4, 0));
    for (let q = 0; q < 46; q++) {
      const arm = q % 3;
      const tq = (q / 46) * 6;
      const a = tq + arm * 2.1 + E.t * 0.5;
      const rr = (60 + tq * 120) * u;
      const x = ex + Math.cos(a) * rr * 1.4;
      const y = ey + Math.sin(a) * rr * 0.8;
      const r = (120 + tq * 30) * u;
      c.globalAlpha = st * 0.32;
      c.drawImage(q % 2 ? spr : sprD, x - r, y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
    c.fillStyle = hexA(E.tone('#4a2410', 0.4), st * 0.3);
    c.fillRect(-40, -40, GW + 80, GH + 80);
  }
  function night() {
    if (E.night < 0.05) return;
    c.fillStyle = hexA('#04102a', 0.25 * E.night);
    c.fillRect(-40, -40, GW + 80, GH + 80);
  }
  /** Hand-lettered on the ground: the stretch's name, and a kilometre post every half kilometre by the road. */
  const KM = (330 * u) / 0.024;
  function lettering() {
    const step = KM / 2;
    const g0 = world.dist + (-60 - cx) / k;
    const g1 = world.dist + (GW + 60 - cx) / k;
    const ink = E.night > 0.5 ? '#dfe8f2' : '#2a1a10';
    c.textAlign = 'center';
    for (let i = Math.floor(g0 / step); i <= Math.ceil(g1 / step); i++) {
      const G = i * step;
      const x = gx(G);
      const y = my(1.2);
      const km = world.km + ((G - world.dist) / KM);
      c.fillStyle = hexA(E.tone('#2a1c14', 0.1, 0.2), 0.9);
      c.fillRect(x - 1.5 * u, y - 16 * u, 3 * u, 16 * u);
      c.fillStyle = hexA(E.tone('#e8d8b8', 0.1, 0.6), 0.9);
      c.fillRect(x - 6 * u, y - 18 * u, 12 * u, 5 * u);
      c.font = `italic ${Math.round(Math.max(11, 14 * u))}px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
      c.fillStyle = hexA(ink, 0.8);
      const whole = Math.floor(km + 1e-6);
      fillCrisp(c, `km ${whole}${km - whole > 0.25 ? '½' : ''}`, x, y + 16 * u);
    }
    // The name of the stretch, lettered large and spaced across the ground beyond the road.
    c.font = `italic ${Math.round(Math.max(16, 30 * u))}px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
    const name = world.regionName.split('').join(' ');
    c.fillStyle = hexA(ink, 0.32);
    fillCrisp(c, name, GW * 0.5, my(-0.62));
    c.textAlign = 'left';
  }
  return { paint, mx, my, k, clear: () => tex.clear() };
}
