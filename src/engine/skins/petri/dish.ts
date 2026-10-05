/**
 * Petri's dish: particle life under a microscope.
 *
 * Particles of a few strains pull on and push each other by a seeded matrix (each strain
 * feels each other strain differently, and every pair repels up close). From that rule
 * alone, cell-like organisms form, crawl, chase, divide, and swallow each other.
 *
 * They also have to eat. The agar holds food (a coarse grid that slowly regrows); cells
 * take it up, drift toward where there is more, and fade and die where there is none,
 * leaving debris that rots back into food. One strain hunts: it seeks the others, they
 * flee it, and what it catches it turns into more of itself; it starves fastest, so its
 * numbers boom and crash. Now and then something gets in at the rim, a contaminant that
 * converts what it touches, until the technician sterilizes it.
 *
 * The instrument watches: every half second it finds the organisms (connected clusters),
 * matches them to the last look, names them (a genus for each strain, an epithet each),
 * and logs what happened in the notebook. Its focus drifts and the autofocus hunts; its
 * stage pans slowly to keep the action in view. A technician drops nutrients, shifts the
 * medium, lays antibiotic disks, and very rarely something enormous drifts through.
 *
 * The sim is DOM-free (canvases are made on the first draw), so the headless runner steps it.
 * The Lenia culture (medium: 'lenia') is its own mount, in culture.ts.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { createBus } from '../../sim/bus';
import { fillCrisp, hexA, mono, typed } from '../instruments/kit';
import { PETRI_SCHEMA } from './index';
import { CONTAMINANT, createChart, createFocus, createNames, createNotebook, DYES, paintEyepiece, PREDATOR, reticle, type Stain } from './scope';
import { mountCulture } from './culture';

const STRAINS = 'ABCDEFG';

export type PetriOptions = { medium: 'particles' | 'lenia'; stain: Stain; species: number; life: number; predators: boolean; drops: number; tracking: boolean; notebook: boolean; hud: boolean };

type Org = { id: number; size: number; born: number; x: number; y: number; x0: number; y0: number; x1: number; y1: number; strains: number; main: number; colony: boolean; symbiosis: boolean; divided: number };

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(PETRI_SCHEMA, host.options) as PetriOptions;
  if (o.medium === 'lenia') return mountCulture(host, o);
  const r = host.fork('petri');
  /** The jostle: its own stream, so the warmth never disturbs the technician's choices. */
  const rnd = host.fork('petri-brownian');
  /** Who eats whom, and the focus: their own stream too. */
  const life = host.fork('petri-life');
  let W = host.viewport.width;
  let H = host.viewport.height;
  let t = 0;
  const bus = createBus(() => t);
  const S = Math.max(3, Math.min(7, Math.round(o.species)));
  const G = S; // the giant's strain, when one comes
  const C = S + 1; // a contaminant
  const D = S + 2; // debris: the dead
  const K = S + 3;
  const P = o.predators ? S - 1 : -1; // the hunters
  const colors = DYES[o.stain].slice(0, S).concat(['#f8fafc', CONTAMINANT[o.stain], '#57534e']);
  if (P >= 0) colors[P] = PREDATOR[o.stain];
  const names = createNames(host.config.seedHash, String(host.config.seed));
  const notebook = createNotebook();
  const chart = createChart(S + 1);
  const focus = createFocus();

  // ---- the dish -------------------------------------------------------------------------------

  // The eyepiece shows a circle of radius R; the dish itself is a little bigger (Rw), and
  // the stage pans across it.
  let cx = W / 2;
  let cy = H / 2;
  let R = Math.min(W, H) * 0.46;
  const WIDE = 1.18;
  const Rw = () => R * WIDE;
  let panX = 0;
  let panY = 0;
  const rmax = () => Math.max(26, R * 0.105);
  const N = Math.round(Math.max(260, Math.min(1300, (Math.PI * Rw() * Rw()) / 1050)) * o.life);
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  const sp = new Uint8Array(N);
  /** Each cell's store of food: it eats to keep it up, and dies at nothing. */
  const energy = new Float32Array(N).fill(1);
  /** A dividing organism's two halves push each other apart until `splitUntil`. */
  const splitUntil = new Float32Array(N);
  const splitSide = new Int8Array(N);
  const splitGroup = new Int32Array(N);
  let splits = 0;
  const giantUntil = { t: -1 };
  // The rule: how strain i feels strain j, -1 (flees) .. 1 (seeks). Cohesive within a strain.
  const M = new Float32Array(K * K);
  const at = (i: number, j: number) => i * K + j;
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) M[at(i, j)] = i === j ? 0.25 + r() * 0.5 : (r() * 2 - 1) * 0.85;
  if (P >= 0) {
    // The hunters seek everything else; everything else flees them.
    for (let j = 0; j < S; j++) {
      if (j === P) continue;
      M[at(P, j)] = 0.7;
      M[at(j, P)] = -0.35;
    }
    M[at(P, P)] = 0.35;
  }
  for (let i = 0; i <= S; i++) {
    M[at(i, G)] = i === G ? 1 : 0.25;
    M[at(G, i)] = i === G ? 1 : 0.7;
  }
  for (let j = 0; j <= S; j++) {
    M[at(C, j)] = 0.6;
    M[at(j, C)] = -0.35;
  }
  M[at(C, C)] = 0.5;
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * Rw() * 0.92;
    px[i] = cx + Math.cos(a) * d;
    py[i] = cy + Math.sin(a) * d;
    // The hunters start few.
    sp[i] = P >= 0 && r() < 0.03 ? P : Math.floor(r() * (P >= 0 ? S - 1 : S));
  }

  // ---- food -----------------------------------------------------------------------------------

  const FG = 40;
  const food = new Float32Array(FG * FG);
  for (let k = 0; k < FG * FG; k++) food[k] = 0.4 + host.noise.noise2((k % FG) * 0.15, Math.floor(k / FG) * 0.15) * 0.25;
  const fcell = (x: number, y: number) => {
    const s = (2 * Rw()) / FG;
    const i = Math.max(0, Math.min(FG - 1, Math.floor((x - (cx - Rw())) / s)));
    const j = Math.max(0, Math.min(FG - 1, Math.floor((y - (cy - Rw())) / s)));
    return j * FG + i;
  };
  const feed = (x: number, y: number, rr: number, amount: number) => {
    const s = (2 * Rw()) / FG;
    for (let j = 0; j < FG; j++) {
      for (let i = 0; i < FG; i++) {
        const fx = cx - Rw() + (i + 0.5) * s;
        const fy = cy - Rw() + (j + 0.5) * s;
        const d = Math.hypot(fx - x, fy - y) / rr;
        if (d < 1) food[j * FG + i] = Math.min(2, food[j * FG + i] + amount * (1 - d * d));
      }
    }
  };

  // ---- telling -----------------------------------------------------------------------------

  const log: { t: number; text: string; color: string }[] = [];
  const say = (text: string, x: number, y: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    log.push({ t, text, color });
    if (log.length > 5) log.shift();
    bus.emit({ type: 'say', text, x, y, color, priority });
  };
  const emit = (type: string, x: number, y: number, weight: number) => bus.emit({ type, x, y, weight });
  bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const x = typeof e.x === 'number' ? e.x - panX : W / 2;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near: 1, text: e.text, color: e.color, priority: e.priority });
  });
  const spec = (id: number) => `NO. ${String(id).padStart(4, '0')}`;
  const nameOf = (g: Org) => (g.symbiosis ? `Consortium ${names.epithet(g.id)}` : names.name(g.main, g.id));
  /** Where something just happened: the stage drifts toward it. */
  let interest: { x: number; y: number; t: number } | null = null;
  const note = (text: string, x?: number, y?: number) => {
    notebook.write(t, text);
    if (x !== undefined && y !== undefined) interest = { x, y, t };
  };

  // ---- the physics ----------------------------------------------------------------------------

  let cols = 1;
  let rows = 1;
  let cellStart = new Int32Array(1);
  const order = new Int32Array(N);
  const cellOf = new Int32Array(N);
  let x0 = 0;
  let y0 = 0;
  const grid = () => {
    const c = rmax();
    x0 = cx - Rw() - c;
    y0 = cy - Rw() - c;
    cols = Math.ceil((2 * Rw() + 2 * c) / c) + 1;
    rows = cols;
    if (cellStart.length !== cols * rows + 1) cellStart = new Int32Array(cols * rows + 1);
    cellStart.fill(0);
    for (let i = 0; i < N; i++) {
      const gx = Math.max(0, Math.min(cols - 1, Math.floor((px[i] - x0) / c)));
      const gy = Math.max(0, Math.min(rows - 1, Math.floor((py[i] - y0) / c)));
      cellOf[i] = gy * cols + gx;
      cellStart[cellOf[i] + 1]++;
    }
    for (let k = 1; k <= cols * rows; k++) cellStart[k] += cellStart[k - 1];
    const fill = cellStart.slice(0, cols * rows);
    for (let i = 0; i < N; i++) order[fill[cellOf[i]]++] = i;
  };

  /** Disks the technician has laid: everything is pushed out of them. */
  const toxins: { x: number; y: number; r: number; t0: number; dur: number; label: string }[] = [];
  /** Who turned what this look: catches by the hunters, conversions by a contaminant. */
  let caught = 0;
  let caughtAt = { x: 0, y: 0 };
  const turn: number[] = [];

  function physics(dt: number) {
    grid();
    const c = rmax();
    // A wide personal space, and a hard core inside it, so a crowd keeps a body instead of
    // collapsing to a point.
    const beta = 0.36;
    const core = 0.16;
    const force = c * 9;
    const keep = Math.pow(0.5, dt / 0.045);
    const wall = Rw() - 5;
    const fs = (2 * Rw()) / FG;
    turn.length = 0;
    for (let i = 0; i < N; i++) {
      let fx = 0;
      let fy = 0;
      const gx = cellOf[i] % cols;
      const gy = (cellOf[i] / cols) | 0;
      const si = sp[i];
      const row = si * K;
      for (let yy = Math.max(0, gy - 1); yy <= Math.min(rows - 1, gy + 1); yy++) {
        for (let xx = Math.max(0, gx - 1); xx <= Math.min(cols - 1, gx + 1); xx++) {
          const cell = yy * cols + xx;
          for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) {
            const j = order[k];
            if (j === i) continue;
            const dx = px[j] - px[i];
            const dy = py[j] - py[i];
            const d2 = dx * dx + dy * dy;
            if (d2 >= c * c || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            const q = d / c;
            let f = q < core ? (q / core - 1) * 3 - 0.55 : q < beta ? q / beta - 1 : M[row + sp[j]] * (1 - Math.abs(2 * q - 1 - beta) / (1 - beta));
            // Halves of a dividing organism push apart for a while.
            if (splitUntil[i] > t && splitUntil[j] > t && splitGroup[i] === splitGroup[j] && splitSide[i] !== splitSide[j]) f = Math.min(f, -0.7 * (1 - q));
            fx += (dx / d) * f;
            fy += (dy / d) * f;
            // Touching: a hunter catches, a contaminant converts.
            const sj = sp[j];
            if (q < core * 1.7 && sj < S && sj !== si) {
              // A hunter that has eaten well rests.
              if (si === P && energy[i] < 0.85 && life() < dt * 0.06) turn.push(j, P, i);
              else if (si === C && life() < dt * 0.5) turn.push(j, C, i);
            }
          }
        }
      }
      vx[i] = vx[i] * keep + fx * force * dt;
      vy[i] = vy[i] * keep + fy * force * dt;
      // A slow current through the medium, and the jostle of warmth: organisms drift and meet.
      const ex = px[i] - cx;
      const ey = py[i] - cy;
      const a = host.noise.noise2(px[i] * 0.004 + t * 0.03, py[i] * 0.004) * Math.PI * 2;
      vx[i] += (Math.cos(a) * c * 0.35 - ey * 0.04) * dt * 2.5 + (rnd() - 0.5) * c * 1.4 * dt;
      vy[i] += (Math.sin(a) * c * 0.35 + ex * 0.04) * dt * 2.5 + (rnd() - 0.5) * c * 1.4 * dt;
      // Toward food: up the gradient of the agar.
      if (si !== D) {
        const k = fcell(px[i], py[i]);
        const fxg = (food[Math.min(k + 1, food.length - 1)] - food[Math.max(k - 1, 0)]) / (2 * fs);
        const fyg = (food[Math.min(k + FG, food.length - 1)] - food[Math.max(k - FG, 0)]) / (2 * fs);
        vx[i] += fxg * c * c * 0.9 * dt;
        vy[i] += fyg * c * c * 0.9 * dt;
      }
      // The dish wall: soft, easing anything near the rim back toward the middle.
      const ed = Math.hypot(ex, ey);
      if (ed > wall - c) {
        const k = (ed - (wall - c)) / c;
        vx[i] -= (ex / ed) * k * k * c * 30 * dt;
        vy[i] -= (ey / ed) * k * k * c * 30 * dt;
      }
      for (const z of toxins) {
        const zx = px[i] - z.x;
        const zy = py[i] - z.y;
        const zd = Math.hypot(zx, zy) || 1;
        const reach = z.r * Math.min(1, (t - z.t0) / 4);
        if (zd < reach) {
          vx[i] += (zx / zd) * (reach - zd) * 18 * dt;
          vy[i] += (zy / zd) * (reach - zd) * 18 * dt;
        }
      }
      const v = Math.hypot(vx[i], vy[i]);
      const cap = c * 3;
      if (v > cap) {
        vx[i] *= cap / v;
        vy[i] *= cap / v;
      }
    }
    for (let i = 0; i < N; i++) {
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
    }
    // The catches and conversions, all at once (in the order they were found). A hunter eats
    // what it catches, and only when well fed does a catch become another hunter.
    for (let k = 0; k < turn.length; k += 3) {
      const j = turn[k];
      const to = turn[k + 1];
      const by = turn[k + 2];
      if (sp[j] >= S || sp[j] === to) continue;
      energy[by] = Math.min(2, energy[by] + 0.45);
      if (to === P) {
        caught++;
        caughtAt = { x: px[by], y: py[by] };
        if (energy[by] > 1.1) {
          sp[j] = P;
          energy[j] = 0.6;
          energy[by] -= 0.6;
        } else {
          sp[j] = D;
          energy[j] = 0;
        }
        continue;
      }
      sp[j] = to;
      energy[j] = 0.5;
    }
    // Eating, and the cost of living: the hunters burn fastest.
    for (let i = 0; i < N; i++) {
      const s = sp[i];
      if (s === D) continue;
      const k = fcell(px[i], py[i]);
      const eat = Math.min(food[k], 0.07 * food[k] * dt);
      food[k] -= eat * 0.3;
      const burn = s === P ? 0.034 : s === C ? 0.014 : s === G ? 0.004 : 0.012;
      energy[i] = Math.min(2, energy[i] + eat * (s === P ? 0.15 : 1) - burn * dt);
      if (energy[i] <= 0) {
        sp[i] = D;
        energy[i] = 0;
        vx[i] *= 0.3;
        vy[i] *= 0.3;
      }
    }
    // The agar slowly makes good what is taken.
    for (let k = 0; k < food.length; k++) food[k] += (0.32 - food[k]) * 0.035 * dt;
  }

  // ---- watching: organisms ---------------------------------------------------------------------

  const parent = new Int32Array(N);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  let label = new Int32Array(N).fill(-1);
  let orgs: Org[] = [];
  let nextOrg = 1;
  let divisions = 0;
  const MIN = 12;
  /** The hunters' numbers, a sample every look, for their booms and crashes. */
  const hunters: number[] = [];
  let lastBloom = -100;
  let lastCrash = -100;
  let lastHunt = -100;
  let lastStarve = -100;
  const deadAt: number[] = [];

  function look() {
    for (let i = 0; i < N; i++) parent[i] = i;
    grid();
    const link = rmax() * 0.42;
    for (let i = 0; i < N; i++) {
      if (sp[i] === D) continue;
      const gx = cellOf[i] % cols;
      const gy = (cellOf[i] / cols) | 0;
      for (let yy = Math.max(0, gy - 1); yy <= Math.min(rows - 1, gy + 1); yy++) {
        for (let xx = Math.max(0, gx - 1); xx <= Math.min(cols - 1, gx + 1); xx++) {
          const cell = yy * cols + xx;
          for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) {
            const j = order[k];
            if (j <= i || sp[j] === D) continue;
            const dx = px[j] - px[i];
            const dy = py[j] - py[i];
            if (dx * dx + dy * dy > link * link) continue;
            const a = find(i);
            const b = find(j);
            if (a !== b) parent[a] = b;
          }
        }
      }
    }
    // Group, and match each group to the organisms of the last look.
    const groups = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
      if (sp[i] === D) continue;
      const root = find(i);
      let g = groups.get(root);
      if (!g) groups.set(root, (g = []));
      g.push(i);
    }
    const prev = new Map(orgs.map((g) => [g.id, g]));
    const claimed = new Map<number, number>(); // prev id -> how many new groups took a big share
    const next: Org[] = [];
    const nextLabel = new Int32Array(N).fill(-1);
    const shares = new Map<Org, Map<number, number>>();
    const big = [...groups.values()].filter((g) => g.length >= MIN).sort((a, b) => b.length - a.length);
    for (const members of big) {
      const overlap = new Map<number, number>();
      for (const i of members) if (label[i] >= 0) overlap.set(label[i], (overlap.get(label[i]) ?? 0) + 1);
      let bx = 0;
      let by = 0;
      let minx = Infinity;
      let miny = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      const count = new Array(K).fill(0);
      for (const i of members) {
        bx += px[i];
        by += py[i];
        minx = Math.min(minx, px[i]);
        miny = Math.min(miny, py[i]);
        maxx = Math.max(maxx, px[i]);
        maxy = Math.max(maxy, py[i]);
        count[sp[i]]++;
      }
      const strains = count.filter((n) => n >= members.length * 0.15).length;
      const main = count.indexOf(Math.max(...count));
      // Inherit the id of the organism most of it came from, the first time it is claimed.
      let id = -1;
      let best = 0;
      for (const [pid, n] of overlap) if (n > best && !next.some((g) => g.id === pid)) {
        best = n;
        id = pid;
      }
      const from = id >= 0 ? prev.get(id) : undefined;
      const org: Org = from && best >= members.length * 0.3
        ? { ...from, size: members.length, x: bx / members.length, y: by / members.length, x0: minx, y0: miny, x1: maxx, y1: maxy, strains, main }
        : { id: nextOrg++, size: members.length, born: t, x: bx / members.length, y: by / members.length, x0: minx, y0: miny, x1: maxx, y1: maxy, strains, main, colony: false, symbiosis: false, divided: -1 };
      next.push(org);
      shares.set(org, overlap);
      for (const i of members) nextLabel[i] = org.id;
      for (const [pid, n] of overlap) {
        const p = prev.get(pid);
        if (p && n >= p.size * 0.3) claimed.set(pid, (claimed.get(pid) ?? 0) + 1);
      }
      if (!from || best < members.length * 0.3) {
        if (best < members.length * 0.15 && t > 3 && members.length >= 18) emit('emerge', org.x, org.y, 0.25);
      }
    }
    // Divisions: an organism whose body went to two new ones.
    for (const [pid, n] of claimed) {
      if (n < 2) continue;
      const p = prev.get(pid)!;
      divisions++;
      const kids = next.filter((g) => (shares.get(g)?.get(pid) ?? 0) >= p.size * 0.3);
      for (const k of kids) k.divided = t;
      say(`${spec(p.id)} DIVIDES · ${kids.map((k) => k.id).join(' + ')}`, p.x, p.y, '#e2e8f0', 'medium');
      emit('division', p.x, p.y, 0.5);
      rings.push({ x: p.x, y: p.y, t0: t, r: 30 });
      note(`${nameOf(p)} (no. ${p.id}) divided`, p.x, p.y);
    }
    // Engulfment: one new organism holding big shares of two old ones.
    for (const g of next) {
      const sh = shares.get(g)!;
      const parts = [...sh.entries()].filter(([pid, n]) => {
        const p = prev.get(pid);
        return p && p.size >= MIN && n >= p.size * 0.5;
      });
      if (parts.length < 2) continue;
      const [a, b] = parts.sort((p, q) => (prev.get(q[0])?.size ?? 0) - (prev.get(p[0])?.size ?? 0));
      say(`${spec(a[0])} ENGULFS ${spec(b[0])}`, g.x, g.y, '#f9a8d4', 'medium');
      emit('engulf', g.x, g.y, 0.55);
      rings.push({ x: g.x, y: g.y, t0: t, r: 40 });
      const pa = prev.get(a[0]);
      const pb = prev.get(b[0]);
      if (pa && pb) note(`${nameOf(pa)} took in ${nameOf(pb)}`, g.x, g.y);
    }
    // Dissolution: a big organism that went nowhere.
    for (const p of orgs) {
      if (p.size < 24 || next.some((g) => g.id === p.id) || (claimed.get(p.id) ?? 0) > 0) continue;
      say(`${spec(p.id)} DISSOLVES`, p.x, p.y, '#94a3b8', 'low');
      emit('dissolve', p.x, p.y, 0.25);
    }
    // A big organism divides along its long axis (and the next look will log the division).
    for (const g of next) {
      if (g.size < 72 || (g.divided > 0 && t - g.divided < 10) || splitUntil.some((v, i) => v > t && nextLabel[i] === g.id)) continue;
      const members: number[] = [];
      for (let i = 0; i < N; i++) if (nextLabel[i] === g.id) members.push(i);
      let sxx = 0;
      let syy = 0;
      let sxy = 0;
      for (const i of members) {
        const dx = px[i] - g.x;
        const dy = py[i] - g.y;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
      }
      const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const ax = Math.cos(ang);
      const ay = Math.sin(ang);
      splits++;
      for (const i of members) {
        const side = (px[i] - g.x) * ax + (py[i] - g.y) * ay > 0 ? 1 : -1;
        splitSide[i] = side;
        splitGroup[i] = splits;
        splitUntil[i] = t + 6;
        vx[i] += ax * side * rmax() * 1.5;
        vy[i] += ay * side * rmax() * 1.5;
      }
      g.divided = t;
    }
    // Milestones.
    for (const g of next) {
      if (!g.colony && g.size >= 60) {
        g.colony = true;
        say(`${spec(g.id)} · A COLONY OF ${g.size}`, g.x, g.y, '#fde68a', 'high');
        emit('colony', g.x, g.y, 0.7);
        note(`${nameOf(g)} has grown into a colony of ${g.size}`, g.x, g.y);
      }
      if (!g.symbiosis && g.strains >= 3 && t - g.born > 25 && g.size >= 30) {
        g.symbiosis = true;
        say(`${spec(g.id)} · SYMBIOSIS OF ${g.strains} STRAINS`, g.x, g.y, '#99f6e4', 'high');
        emit('symbiosis', g.x, g.y, 0.7);
        note(`Three strains living as one: ${nameOf(g)}`, g.x, g.y);
      }
    }
    orgs = next;
    label = nextLabel;
    population();
  }

  /** The census: the hunters' booms and crashes, starvation, the chart. */
  function population() {
    const counts = new Array(K).fill(0);
    for (let i = 0; i < N; i++) counts[sp[i]]++;
    if (t >= nextChart) {
      nextChart = t + 2;
      chart.push([...counts.slice(0, S), counts[C]]);
    }
    // The hunters: catches, a boom, a crash.
    if (caught >= 6 && t - lastHunt > 8 && P >= 0) {
      lastHunt = t;
      say(`${names.genus(P).toUpperCase()} HUNTS · ${caught} TAKEN`, caughtAt.x, caughtAt.y, colors[P], 'medium');
      emit('hunt', caughtAt.x, caughtAt.y, 0.45);
      interest = { x: caughtAt.x, y: caughtAt.y, t };
    }
    caught = 0;
    if (P >= 0) {
      hunters.push(counts[P]);
      if (hunters.length > 140) hunters.shift();
      const was = hunters[Math.max(0, hunters.length - 40)];
      const peak = Math.max(...hunters);
      if (t > 30 && counts[P] > N * 0.14 && counts[P] > was * 1.6 && t - lastBloom > 60) {
        lastBloom = t;
        say(`THE HUNTERS BLOOM · ${counts[P]} ${names.genus(P).toUpperCase()}`, cx, cy, colors[P], 'high');
        emit('bloom', cx, cy, 0.65);
        note(`${names.genus(P)} is everywhere now: ${counts[P]} cells`);
      }
      if (peak > N * 0.1 && counts[P] < peak * 0.35 && t - lastCrash > 60 && t - lastBloom > 10) {
        lastCrash = t;
        hunters.length = 0;
        say('THE HUNTERS STARVE', cx, cy, '#94a3b8', 'medium');
        emit('crash', cx, cy, 0.5);
        note(`${names.genus(P)} has eaten itself out; its numbers crash`);
      }
    }
    // Starvation: many dying at once, where the agar is spent.
    deadAt.push(counts[D]);
    if (deadAt.length > 24) deadAt.shift();
    if (deadAt.length >= 20 && counts[D] - deadAt[0] > N * 0.05 && t - lastStarve > 45) {
      lastStarve = t;
      say('CELLS STARVE · THE MEDIUM IS SPENT', cx, cy, '#a8a29e', 'medium');
      emit('starve', cx, cy, 0.4);
      note('The middle of the dish is spent; cells are dying there');
    }
    // The dead rot back into the agar, and spores come up where there is food again.
    for (let i = 0; i < N; i++) {
      if (sp[i] !== D) continue;
      const roll = life();
      if (roll < 0.02) feed(px[i], py[i], rmax() * 0.8, 0.05);
      else if (roll < 0.045 && food[fcell(px[i], py[i])] > 0.28) {
        sp[i] = Math.floor(life() * (P >= 0 ? S - 1 : S));
        energy[i] = 0.8;
      }
    }
  }
  let nextChart = 0;

  // ---- the technician ----------------------------------------------------------------------------

  const rings: { x: number; y: number; t0: number; r: number }[] = [];
  let nextDrop = 20 + r() * 20;
  let nextShift = 40 + r() * 30;
  let nextToxin = 150 + r() * 120;
  let nextGiant = 200 + r() * 200;
  let nextContamination = 120 + r() * 160;
  let sterilizeAt = -1;
  let nextLook = 0.5;

  /** Somewhere in the dish, not too near the rim. */
  const spot = (k = 0.7) => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * Rw() * k;
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d };
  };
  /** Take `n` particles (the dead first, then anyone) and put them at (x, y), bursting outward. */
  const inject = (n: number, x: number, y: number, strain: () => number, burst = 1) => {
    const dead: number[] = [];
    for (let i = 0; i < N && dead.length < n; i++) if (sp[i] === D) dead.push(i);
    for (let k = 0; k < n; k++) {
      const i = k < dead.length ? dead[k] : Math.floor(r() * N);
      const a = r() * Math.PI * 2;
      px[i] = x + Math.cos(a) * r() * 12;
      py[i] = y + Math.sin(a) * r() * 12;
      vx[i] = Math.cos(a) * rmax() * burst * (0.5 + r());
      vy[i] = Math.sin(a) * rmax() * burst * (0.5 + r());
      sp[i] = strain();
      energy[i] = 1.2;
    }
  };

  function technician() {
    if (t >= nextDrop && o.drops > 0) {
      nextDrop = t + (24 + r() * 26) / o.drops;
      const at2 = spot();
      const strain = Math.floor(r() * S);
      inject(24 + Math.floor(r() * 24), at2.x, at2.y, () => strain);
      feed(at2.x, at2.y, R * 0.3, 1.2);
      rings.push({ x: at2.x, y: at2.y, t0: t, r: 50 });
      const ul = 10 + Math.floor(r() * 40);
      say(`NUTRIENT DROP · STRAIN ${STRAINS[strain]} · ${ul} µL`, at2.x, at2.y, colors[strain], 'low');
      emit('drop', at2.x, at2.y, 0.35);
      note(`Fed the dish: ${ul} µL, seeded with ${names.genus(strain)}`, at2.x, at2.y);
    }
    if (t >= nextShift) {
      nextShift = t + 35 + r() * 30;
      const s = Math.floor(r() * S);
      for (let k = 0; k < 4; k++) {
        const j = Math.floor(r() * S);
        const idx = at(s, j);
        M[idx] = Math.max(-1, Math.min(1, M[idx] + (r() - 0.5) * 1.2));
      }
      say(`MEDIUM SHIFT · STRAIN ${STRAINS[s]} ADAPTS`, cx, cy, colors[s], 'medium');
      emit('mutation', cx, cy, 0.4);
      note(`The medium shifted; ${names.genus(s)} is behaving differently`);
    }
    if (t >= nextToxin && o.drops > 0) {
      nextToxin = t + (180 + r() * 140) / o.drops;
      const at2 = spot(0.55);
      const labels = ['AMP 10', 'TET 30', 'KAN 50', 'CHL 30', 'ERY 15'];
      toxins.push({ x: at2.x, y: at2.y, r: R * (0.18 + r() * 0.1), t0: t, dur: 26, label: labels[Math.floor(r() * labels.length)] });
      say(`ANTIBIOTIC DISK · ${toxins[toxins.length - 1].label} · ZONE OF INHIBITION`, at2.x, at2.y, '#f8fafc', 'high');
      emit('toxin', at2.x, at2.y, 0.6);
      note(`Laid a disk of ${toxins[toxins.length - 1].label}`, at2.x, at2.y);
    }
    // Contamination: something gets in at the rim; the technician sterilizes it after a while.
    if (t >= nextContamination && o.drops > 0 && sterilizeAt < 0) {
      nextContamination = t + (240 + r() * 240) / o.drops;
      const a = r() * Math.PI * 2;
      const x = cx + Math.cos(a) * Rw() * 0.86;
      const y = cy + Math.sin(a) * Rw() * 0.86;
      inject(36, x, y, () => C, 0.4);
      sterilizeAt = t + 26 + r() * 14;
      say('CONTAMINATION AT THE RIM · UNKNOWN STRAIN', x, y, colors[C], 'high');
      emit('contamination', x, y, 0.7);
      note('Something has got in at the rim. Not one of ours', x, y);
    }
    if (sterilizeAt > 0) {
      let n = 0;
      let mx = 0;
      let my = 0;
      for (let i = 0; i < N; i++) if (sp[i] === C) {
        n++;
        mx += px[i];
        my += py[i];
      }
      if (n === 0) sterilizeAt = -1;
      else if (t >= sterilizeAt || n > N * 0.3) {
        sterilizeAt = -1;
        for (let i = 0; i < N; i++) if (sp[i] === C) {
          sp[i] = D;
          energy[i] = 0;
        }
        rings.push({ x: mx / n, y: my / n, t0: t, r: R * 0.5 });
        flash = t;
        say(`UV · ${n} CONTAMINANT CELLS KILLED`, mx / n, my / n, '#c4b5fd', 'high');
        emit('sterilize', mx / n, my / n, 0.6);
        note(`Sterilized: ${n} cells of the contaminant`, mx / n, my / n);
      }
    }
    if (t >= nextGiant) {
      nextGiant = t + 220 + r() * 220;
      if (r() < 0.3) {
        const a = r() * Math.PI * 2;
        const x = cx + Math.cos(a) * Rw() * 0.75;
        const y = cy + Math.sin(a) * Rw() * 0.75;
        inject(Math.min(140, Math.floor(N * 0.14)), x, y, () => G, 0.2);
        giantUntil.t = t + 50;
        say('SOMETHING LARGE ENTERS THE FIELD', x, y, '#f8fafc', 'high');
        emit('giant', x, y, 0.85);
        note('Something enormous has drifted in. No name for it', x, y);
      }
    }
    // The giant comes apart into ordinary strains in the end.
    if (giantUntil.t > 0 && t > giantUntil.t) {
      giantUntil.t = -1;
      for (let i = 0; i < N; i++) if (sp[i] === G) sp[i] = Math.floor(r() * S);
      say('THE LARGE ONE COMES APART', cx, cy, '#94a3b8', 'medium');
      emit('giantgone', cx, cy, 0.4);
    }
    for (let i = toxins.length - 1; i >= 0; i--) if (t - toxins[i].t0 > toxins[i].dur) toxins.splice(i, 1);
    for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t0 > 2.5) rings.splice(i, 1);
  }
  let flash = -10;

  /** The stage: drift to keep the action (the newest event, or the biggest organism) in view. */
  function stage(dt: number) {
    const biggest = orgs.reduce<Org | null>((a, b) => (!a || b.size > a.size ? b : a), null);
    const target = interest && t - interest.t < 12 ? interest : biggest ? { x: biggest.x, y: biggest.y } : { x: cx, y: cy };
    const lim = Rw() - R;
    let wx = (target.x - cx) * 0.7;
    let wy = (target.y - cy) * 0.7;
    const d = Math.hypot(wx, wy);
    if (d > lim) {
      wx *= lim / d;
      wy *= lim / d;
    }
    const k = Math.min(1, dt * 0.12);
    panX += (wx - panX) * k;
    panY += (wy - panY) * k;
  }

  let nextAmbience = 0;
  function step(dt: number) {
    if (dt <= 0) return;
    t += dt;
    const n = Math.min(3, Math.ceil(dt / (1 / 60)));
    for (let k = 0; k < n; k++) physics(dt / n);
    technician();
    if (t >= nextLook) {
      nextLook = t + 0.5;
      look();
    }
    stage(dt);
    if (focus.step(t, dt, life)) {
      emit('refocus', cx, cy, 0.15);
      if (o.hud) say('AUTOFOCUS', cx, cy - R * 0.9, '#94a3b8', 'low');
    }
    if (t >= nextAmbience && host.events?.active) {
      nextAmbience = t + 2;
      host.events.emit({ type: 'ambience', weight: Math.min(1, orgs.length / 25), pan: 0, near: 1 });
    }
  }

  // ---- drawing --------------------------------------------------------------------------------

  let sprites: HTMLCanvasElement[] | null = null;
  let medium: { W: number; H: number; c: HTMLCanvasElement } | null = null;
  let agar: { at: number; c: HTMLCanvasElement } | null = null;
  const { ctx } = host;

  function glowSprites(): HTMLCanvasElement[] {
    const d = Math.min(2, host.viewport.dpr || 1);
    return colors.map((col, i) => {
      const size = i === G ? 30 : 22;
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(size * d);
      const g = c.getContext('2d')!;
      g.scale(d, d);
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      if (o.stain === 'phase') {
        // Phase contrast: a bright halo around a dark body.
        gr.addColorStop(0, hexA(col, 0));
        gr.addColorStop(0.32, hexA(col, 0.05));
        gr.addColorStop(0.5, hexA(col, 0.32));
        gr.addColorStop(0.7, hexA(col, 0.06));
        gr.addColorStop(1, hexA(col, 0));
      } else {
        gr.addColorStop(0, hexA(col, i === G ? 0.34 : 0.26));
        gr.addColorStop(0.35, hexA(col, 0.1));
        gr.addColorStop(1, hexA(col, 0));
      }
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
      return c;
    });
  }

  /** The agar's food, faint and warm, where the drops have been (redrawn twice a second). */
  function paintAgar() {
    if (!agar) {
      const c = document.createElement('canvas');
      c.width = FG;
      c.height = FG;
      agar = { at: -1, c };
    }
    if (t - agar.at < 0.5 && agar.at >= 0) return agar.c;
    const g = agar.c.getContext('2d')!;
    const img = g.createImageData(FG, FG);
    for (let k = 0; k < FG * FG; k++) {
      const v = Math.max(0, food[k] - 0.3);
      img.data[k * 4] = 250;
      img.data[k * 4 + 1] = 204;
      img.data[k * 4 + 2] = 120;
      img.data[k * 4 + 3] = Math.min(60, v * 40);
    }
    g.putImageData(img, 0, 0);
    agar.at = t;
    return agar.c;
  }

  function draw() {
    const level = 0.55 + 0.45 * host.intensity;
    const f = focus.f;
    sprites ??= glowSprites();
    if (!medium || medium.W !== W || medium.H !== H) medium = { W, H, c: paintEyepiece(host, W, H, cx, cy, R, o.stain) };
    ctx.drawImage(medium.c, 0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(-panX, -panY);
    // Food in the agar.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(paintAgar(), cx - Rw(), cy - Rw(), Rw() * 2, Rw() * 2);
    // The dish's own wall, when the stage has drifted far enough to show it.
    ctx.strokeStyle = 'rgba(203,213,225,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Rw(), 0, Math.PI * 2);
    ctx.stroke();
    // Antibiotic disks and their cleared zones.
    for (const z of toxins) {
      const k = Math.min(1, (t - z.t0) / 4);
      const fade = Math.min(1, (z.dur - (t - z.t0)) / 3);
      ctx.strokeStyle = `rgba(248,250,252,${(0.12 * fade).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(226,232,240,${(0.5 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(z.x, z.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = mono(7);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(15,23,42,${(0.8 * fade).toFixed(3)})`;
      fillCrisp(ctx, z.label.split(' ')[0], z.x, z.y + 2.5);
    }
    // Membranes: each organism's outline (its members' hull, eased outward and smoothed).
    membranes(level * f * f);
    // The life: each particle a soft glow in its strain's dye, dimmer as it starves, bigger
    // and fainter out of focus; where they crowd, they shine.
    const blur = 1 + (1 - f) * 1.1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const s = sp[i];
      const size = (s === G ? 30 : 22) * blur;
      ctx.globalAlpha = level * (s === D ? 0.35 : 0.35 + 0.65 * Math.min(1, energy[i])) * (0.55 + 0.45 * f);
      ctx.drawImage(sprites[s], px[i] - size / 2, py[i] - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    const sharp = f ** 4;
    if (o.stain === 'phase') ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < N; i++) {
      const s = sp[i];
      if (s === D) {
        ctx.fillStyle = hexA('#78716c', 0.5 * level * sharp);
        ctx.fillRect(px[i] - 0.5, py[i] - 0.5, 1, 1);
        continue;
      }
      ctx.fillStyle = o.stain === 'phase' ? `rgba(8,9,10,${(0.9 * sharp).toFixed(3)})` : hexA(colors[s], 0.85 * level * sharp * (0.4 + 0.6 * Math.min(1, energy[i])));
      ctx.fillRect(px[i] - 1, py[i] - 1, 2, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // Rings where something happened (drops, divisions, engulfings, a sterilizing flash).
    for (const g of rings) {
      const k = (t - g.t0) / 2.5;
      for (let m = 0; m < 2; m++) {
        const kk = Math.max(0, k - m * 0.15);
        ctx.strokeStyle = `rgba(226,232,240,${(0.3 * (1 - kk)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r * (0.3 + kk), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    // The UV lamp: the whole field goes violet for a breath.
    if (t - flash < 0.8) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = `rgba(167,139,250,${(0.22 * (1 - (t - flash) / 0.8)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    reticle(ctx, cx, cy, R);
    if (o.tracking) brackets(level);
    if (o.hud) hud(level);
  }

  /** Convex hull (monotone chain) of points, counter-clockwise. */
  const hull = (pts: [number, number][]) => {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o2: [number, number], a: [number, number], b: [number, number]) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
    const lower: [number, number][] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: [number, number][] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  };

  function membranes(level: number) {
    if (level < 0.02) return;
    const groups = new Map<number, [number, number][]>();
    const tint = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
      const id = label[i];
      if (id < 0 || sp[i] === D) continue;
      let g = groups.get(id);
      if (!g) {
        groups.set(id, (g = []));
        tint.set(id, new Array(K).fill(0));
      }
      g.push([px[i], py[i]]);
      tint.get(id)![sp[i]]++;
    }
    for (const [id, pts] of groups) {
      if (pts.length < MIN) continue;
      let mx = 0;
      let my = 0;
      for (const [x, y] of pts) {
        mx += x;
        my += y;
      }
      mx /= pts.length;
      my /= pts.length;
      const h = hull(pts);
      if (h.length < 3) continue;
      // Push each hull point out from the middle, then draw through the midpoints.
      const out = h.map(([x, y]) => {
        const dx = x - mx;
        const dy = y - my;
        const d = Math.hypot(dx, dy) || 1;
        return [x + (dx / d) * 8, y + (dy / d) * 8] as [number, number];
      });
      const counts = tint.get(id)!;
      const main = counts.indexOf(Math.max(...counts));
      ctx.beginPath();
      const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number];
      const start = mid(out[out.length - 1], out[0]);
      ctx.moveTo(start[0], start[1]);
      for (let k = 0; k < out.length; k++) {
        const m = mid(out[k], out[(k + 1) % out.length]);
        ctx.quadraticCurveTo(out[k][0], out[k][1], m[0], m[1]);
      }
      ctx.closePath();
      ctx.fillStyle = hexA(colors[main], 0.06 * level);
      ctx.fill();
      ctx.strokeStyle = hexA(colors[main], 0.32 * level);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** Corner brackets and a readout on a few specimens: the biggest, the newest division, the oldest. */
  function brackets(level: number) {
    const picks: Org[] = [];
    const add = (g: Org | undefined) => g && !picks.includes(g) && picks.push(g);
    add([...orgs].sort((a, b) => b.size - a.size)[0]);
    add([...orgs].filter((g) => g.divided > 0 && t - g.divided < 12).sort((a, b) => b.divided - a.divided)[0]);
    add([...orgs].filter((g) => g.size >= 20).sort((a, b) => a.born - b.born)[0]);
    ctx.save();
    ctx.font = mono(9);
    ctx.textAlign = 'left';
    for (const g of picks) {
      const pad = 8;
      const bx0 = g.x0 - pad - panX;
      const by0 = g.y0 - pad - panY;
      const bx1 = g.x1 + pad - panX;
      const by1 = g.y1 + pad - panY;
      // Only what is in the eyepiece.
      if (Math.hypot((bx0 + bx1) / 2 - cx, (by0 + by1) / 2 - cy) > R * 0.95) continue;
      const l = Math.min(12, (bx1 - bx0) / 3, (by1 - by0) / 3);
      ctx.strokeStyle = hexA('#e2e8f0', 0.55 * level);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [x, y, dx, dy] of [
        [bx0, by0, 1, 1],
        [bx1, by0, -1, 1],
        [bx0, by1, 1, -1],
        [bx1, by1, -1, -1],
      ]) {
        ctx.moveTo(x, y + dy * l);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * l, y);
      }
      ctx.stroke();
      const age = t - g.born;
      const text = `${nameOf(g).toUpperCase()} · ${spec(g.id)} · ${g.size} CELLS · ${Math.floor(age / 60)}:${String(Math.floor(age % 60)).padStart(2, '0')}`;
      const w = ctx.measureText(text).width;
      const tx = Math.max(8, Math.min(W - w - 8, bx0));
      const ty = Math.max(14, by0 - 6);
      ctx.fillStyle = 'rgba(2,6,10,0.65)';
      ctx.fillRect(tx - 3, ty - 9, w + 6, 12);
      ctx.fillStyle = hexA('#e2e8f0', 0.85 * level);
      fillCrisp(ctx, text, tx, ty);
    }
    ctx.restore();
  }

  function hud(level: number) {
    ctx.save();
    ctx.font = mono(10);
    ctx.textBaseline = 'alphabetic';
    const ink = hexA('#94a3b8', 0.85 * level);
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    const stainName = o.stain === 'darkfield' ? 'DARKFIELD' : o.stain === 'phase' ? 'PHASE CONTRAST' : 'FLUORESCENCE';
    const focusText = focus.hunting >= 0 ? 'AUTOFOCUS' : `FOCUS ${Math.round(focus.f * 100)}%`;
    fillCrisp(ctx, `PETRI // SAMPLE ${String.fromCharCode(65 + (host.config.seedHash % 26))}-${(host.config.seedHash % 90) + 10} // 40× // ${stainName} // ${focusText}`, 14, 20);
    ctx.textAlign = 'right';
    const clock = `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    fillCrisp(ctx, clock, W - 14, 20);
    fillCrisp(ctx, `ORGANISMS ${orgs.length} // DIVISIONS ${divisions}`, W - 14, H - 14);
    // Strains and their dyes, the hunters marked.
    ctx.textAlign = 'left';
    for (let s = 0; s < S; s++) {
      ctx.fillStyle = hexA(colors[s], 0.9 * level);
      ctx.fillRect(14 + s * 34, 30, 6, 6);
      ctx.fillStyle = ink;
      fillCrisp(ctx, s === P ? `${STRAINS[s]}▲` : STRAINS[s], 23 + s * 34, 37);
    }
    // Scale bar.
    const bar = R * 0.18;
    const bx = cx + R * 0.55;
    const by = cy + R * 0.82;
    ctx.fillStyle = hexA('#e2e8f0', 0.6 * level);
    ctx.fillRect(bx, by, bar, 2);
    ctx.textAlign = 'center';
    fillCrisp(ctx, '50 µm', bx + bar / 2, by - 5);
    // The log.
    ctx.textAlign = 'left';
    const lines = log.slice(-4);
    lines.forEach((l, i) => {
      const y = H - 14 - (lines.length - 1 - i) * 14;
      ctx.fillStyle = hexA(l.color, (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, `> ${typed(l.text, t - l.t, 40, t)}`, 14, y);
    });
    ctx.restore();
    if (o.notebook) {
      notebook.draw(ctx, W - 14, 42, t, level);
      chart.draw(ctx, W - 180, H - 82, 166, 46, [...colors.slice(0, S), colors[C]], level, 'POPULATION · 2 MIN');
    }
  }

  return {
    resize(v: Viewport) {
      // Keep the life; move and scale it to the new dish.
      const ncx = v.width / 2;
      const ncy = v.height / 2;
      const nR = Math.min(v.width, v.height) * 0.46;
      const k = nR / R;
      for (let i = 0; i < N; i++) {
        px[i] = ncx + (px[i] - cx) * k;
        py[i] = ncy + (py[i] - cy) * k;
      }
      for (const z of toxins) {
        z.x = ncx + (z.x - cx) * k;
        z.y = ncy + (z.y - cy) * k;
        z.r *= k;
      }
      panX *= k;
      panY *= k;
      W = v.width;
      H = v.height;
      cx = ncx;
      cy = ncy;
      R = nR;
      medium = null;
    },
    frame(info: FrameInfo) {
      step(host.motion === 'off' ? 0 : Math.min(info.dt, 0.1));
      draw();
    },
    advance(info: FrameInfo) {
      step(Math.min(info.dt, 0.1));
    },
    inspect(): SkinInspection {
      let dead = 0;
      let hunting = 0;
      for (let i = 0; i < N; i++) {
        if (sp[i] === D) dead++;
        else if (sp[i] === P) hunting++;
      }
      return {
        t,
        counts: { organisms: orgs.length, divisions, particles: N, toxins: toxins.length, dead, hunters: hunting },
        log: bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: bus.seq,
      };
    },
    destroy() {
      sprites = null;
      medium = null;
      agar = null;
    },
  };
}
