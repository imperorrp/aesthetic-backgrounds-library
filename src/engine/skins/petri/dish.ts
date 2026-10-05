/**
 * Petri's dish: particle life under a fluorescence microscope.
 *
 * Particles of a few species pull on and push each other by a seeded matrix (each species
 * feels each other species differently, and every pair repels up close). From that rule
 * alone, cell-like organisms form, crawl, chase, divide, and swallow each other.
 *
 * The instrument watches: every half second it finds the organisms (connected clusters),
 * matches them to the last look, and logs what happened: a new organism, a division, an
 * engulfment, a dissolution, a colony, a symbiosis of three strains. A technician drops
 * nutrients now and then, sometimes lays an antibiotic disk that clears a zone, and the
 * medium shifts so a strain adapts. Very rarely something enormous drifts through.
 *
 * The sim is DOM-free (canvases are made on the first draw), so the headless runner steps it.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { createBus } from '../../sim/bus';
import { fillCrisp, hexA, mono, typed } from '../instruments/kit';
import { PETRI_SCHEMA } from './index';

const FLUOR = ['#4ade80', '#f472b6', '#38bdf8', '#facc15', '#a78bfa', '#fb923c', '#2dd4bf'];
const DARKFIELD = ['#e2e8f0', '#cbd5e1', '#bae6fd', '#e0f2fe', '#f1f5f9', '#c7d2fe', '#dbeafe'];
const STRAINS = 'ABCDEFG';

type Org = { id: number; size: number; born: number; x: number; y: number; x0: number; y0: number; x1: number; y1: number; strains: number; colony: boolean; symbiosis: boolean; divided: number };

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(PETRI_SCHEMA, host.options) as { stain: 'fluorescent' | 'darkfield'; species: number; life: number; drops: number; tracking: boolean; hud: boolean };
  const r = host.fork('petri');
  /** The jostle: its own stream, so the warmth never disturbs the technician's choices. */
  const rnd = host.fork('petri-brownian');
  let W = host.viewport.width;
  let H = host.viewport.height;
  let t = 0;
  const bus = createBus(() => t);
  const S = Math.max(3, Math.min(7, Math.round(o.species)));
  const G = S; // the giant's strain, when one comes
  const colors = (o.stain === 'darkfield' ? DARKFIELD : FLUOR).slice(0, S).concat(['#f8fafc']);

  // ---- the dish -------------------------------------------------------------------------------

  let cx = W / 2;
  let cy = H / 2;
  let R = Math.min(W, H) * 0.46;
  const rmax = () => Math.max(26, R * 0.105);
  const N = Math.round(Math.max(220, Math.min(1000, (Math.PI * R * R) / 1050)) * o.life);
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const vx = new Float32Array(N);
  const vy = new Float32Array(N);
  const sp = new Uint8Array(N);
  /** A dividing organism's two halves push each other apart until `splitUntil`. */
  const splitUntil = new Float32Array(N);
  const splitSide = new Int8Array(N);
  const splitGroup = new Int32Array(N);
  let splits = 0;
  const giantUntil = { t: -1 };
  // The rule: how species i feels species j, -1 (flees) .. 1 (seeks). Cohesive within a strain.
  const M = new Float32Array((S + 1) * (S + 1));
  for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) M[i * (S + 1) + j] = i === j ? 0.25 + r() * 0.5 : (r() * 2 - 1) * 0.85;
  for (let i = 0; i <= S; i++) {
    M[i * (S + 1) + G] = i === G ? 1 : 0.25;
    M[G * (S + 1) + i] = i === G ? 1 : 0.7;
  }
  for (let i = 0; i < N; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R * 0.92;
    px[i] = cx + Math.cos(a) * d;
    py[i] = cy + Math.sin(a) * d;
    sp[i] = Math.floor(r() * S);
  }

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
    const x = typeof e.x === 'number' ? e.x : W / 2;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near: 1, text: e.text, color: e.color, priority: e.priority });
  });
  const spec = (id: number) => `SPECIMEN ${String(id).padStart(4, '0')}`;

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
    x0 = cx - R - c;
    y0 = cy - R - c;
    cols = Math.ceil((2 * R + 2 * c) / c) + 1;
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

  function physics(dt: number) {
    grid();
    const c = rmax();
    // A wide personal space, and a hard core inside it, so a crowd keeps a body instead of
    // collapsing to a point.
    const beta = 0.36;
    const core = 0.16;
    const force = c * 9;
    const keep = Math.pow(0.5, dt / 0.045);
    const wall = R - 5;
    for (let i = 0; i < N; i++) {
      let fx = 0;
      let fy = 0;
      const gx = cellOf[i] % cols;
      const gy = (cellOf[i] / cols) | 0;
      const row = sp[i] * (S + 1);
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

  function look() {
    for (let i = 0; i < N; i++) parent[i] = i;
    grid();
    const link = rmax() * 0.42;
    for (let i = 0; i < N; i++) {
      const gx = cellOf[i] % cols;
      const gy = (cellOf[i] / cols) | 0;
      for (let yy = Math.max(0, gy - 1); yy <= Math.min(rows - 1, gy + 1); yy++) {
        for (let xx = Math.max(0, gx - 1); xx <= Math.min(cols - 1, gx + 1); xx++) {
          const cell = yy * cols + xx;
          for (let k = cellStart[cell]; k < cellStart[cell + 1]; k++) {
            const j = order[k];
            if (j <= i) continue;
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
      const count = new Array(S + 1).fill(0);
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
      // Inherit the id of the organism most of it came from, the first time it is claimed.
      let id = -1;
      let best = 0;
      for (const [pid, n] of overlap) if (n > best && !next.some((g) => g.id === pid)) {
        best = n;
        id = pid;
      }
      const from = id >= 0 ? prev.get(id) : undefined;
      const org: Org = from && best >= members.length * 0.3
        ? { ...from, size: members.length, x: bx / members.length, y: by / members.length, x0: minx, y0: miny, x1: maxx, y1: maxy, strains }
        : { id: nextOrg++, size: members.length, born: t, x: bx / members.length, y: by / members.length, x0: minx, y0: miny, x1: maxx, y1: maxy, strains, colony: false, symbiosis: false, divided: -1 };
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
      }
      if (!g.symbiosis && g.strains >= 3 && t - g.born > 25 && g.size >= 30) {
        g.symbiosis = true;
        say(`${spec(g.id)} · SYMBIOSIS OF ${g.strains} STRAINS`, g.x, g.y, '#99f6e4', 'high');
        emit('symbiosis', g.x, g.y, 0.7);
      }
    }
    orgs = next;
    label = nextLabel;
  }

  // ---- the technician ----------------------------------------------------------------------------

  const rings: { x: number; y: number; t0: number; r: number }[] = [];
  let nextDrop = 20 + r() * 20;
  let nextShift = 40 + r() * 30;
  let nextToxin = 150 + r() * 120;
  let nextGiant = 200 + r() * 200;
  let nextLook = 0.5;

  /** Somewhere in the dish, not too near the rim. */
  const spot = (k = 0.7) => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R * k;
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d };
  };
  /** Take `n` particles (from wherever) and put them at (x, y), bursting outward. */
  const inject = (n: number, x: number, y: number, strain: () => number, burst = 1) => {
    for (let k = 0; k < n; k++) {
      const i = Math.floor(r() * N);
      const a = r() * Math.PI * 2;
      px[i] = x + Math.cos(a) * r() * 12;
      py[i] = y + Math.sin(a) * r() * 12;
      vx[i] = Math.cos(a) * rmax() * burst * (0.5 + r());
      vy[i] = Math.sin(a) * rmax() * burst * (0.5 + r());
      sp[i] = strain();
    }
  };

  function technician() {
    if (t >= nextDrop && o.drops > 0) {
      nextDrop = t + (24 + r() * 26) / o.drops;
      const at = spot();
      const strain = Math.floor(r() * S);
      inject(24 + Math.floor(r() * 24), at.x, at.y, () => strain);
      rings.push({ x: at.x, y: at.y, t0: t, r: 50 });
      say(`NUTRIENT DROP · STRAIN ${STRAINS[strain]} · ${10 + Math.floor(r() * 40)} µL`, at.x, at.y, colors[strain], 'low');
      emit('drop', at.x, at.y, 0.35);
    }
    if (t >= nextShift) {
      nextShift = t + 35 + r() * 30;
      const s = Math.floor(r() * S);
      for (let k = 0; k < 4; k++) {
        const j = Math.floor(r() * S);
        const idx = s * (S + 1) + j;
        M[idx] = Math.max(-1, Math.min(1, M[idx] + (r() - 0.5) * 1.2));
      }
      say(`MEDIUM SHIFT · STRAIN ${STRAINS[s]} ADAPTS`, cx, cy, colors[s], 'medium');
      emit('mutation', cx, cy, 0.4);
    }
    if (t >= nextToxin && o.drops > 0) {
      nextToxin = t + (180 + r() * 140) / o.drops;
      const at = spot(0.55);
      const names = ['AMP 10', 'TET 30', 'KAN 50', 'CHL 30', 'ERY 15'];
      toxins.push({ x: at.x, y: at.y, r: R * (0.18 + r() * 0.1), t0: t, dur: 26, label: names[Math.floor(r() * names.length)] });
      say(`ANTIBIOTIC DISK · ${toxins[toxins.length - 1].label} · ZONE OF INHIBITION`, at.x, at.y, '#f8fafc', 'high');
      emit('toxin', at.x, at.y, 0.6);
    }
    if (t >= nextGiant) {
      nextGiant = t + 220 + r() * 220;
      if (r() < 0.3) {
        const a = r() * Math.PI * 2;
        const x = cx + Math.cos(a) * R * 0.75;
        const y = cy + Math.sin(a) * R * 0.75;
        inject(Math.min(140, Math.floor(N * 0.16)), x, y, () => G, 0.2);
        giantUntil.t = t + 50;
        say('SOMETHING LARGE ENTERS THE FIELD', x, y, '#f8fafc', 'high');
        emit('giant', x, y, 0.85);
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
    if (t >= nextAmbience && host.events?.active) {
      nextAmbience = t + 2;
      host.events.emit({ type: 'ambience', weight: Math.min(1, orgs.length / 25), pan: 0, near: 1 });
    }
  }

  // ---- drawing --------------------------------------------------------------------------------

  let sprites: HTMLCanvasElement[] | null = null;
  let medium: { W: number; H: number; c: HTMLCanvasElement } | null = null;
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
      gr.addColorStop(0, hexA(col, i === G ? 0.34 : 0.26));
      gr.addColorStop(0.35, hexA(col, 0.1));
      gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
      return c;
    });
  }

  function paintMedium() {
    const d = Math.min(2, host.viewport.dpr || 1);
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * d);
    c.height = Math.ceil(H * d);
    const g = c.getContext('2d')!;
    g.scale(d, d);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0, o.stain === 'darkfield' ? '#05070c' : '#03080a');
    grad.addColorStop(0.85, o.stain === 'darkfield' ? '#030409' : '#020507');
    grad.addColorStop(1, '#000');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    // Grain and debris in the medium.
    const rr = host.fork('medium');
    for (let i = 0; i < R * R * 0.01; i++) {
      const a = rr() * Math.PI * 2;
      const dd = Math.sqrt(rr()) * R;
      g.fillStyle = `rgba(148,163,184,${(0.03 + rr() * 0.06).toFixed(3)})`;
      g.fillRect(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, 1, 1);
    }
    for (let i = 0; i < 9; i++) {
      const a = rr() * Math.PI * 2;
      const dd = Math.sqrt(rr()) * R * 0.9;
      g.strokeStyle = 'rgba(148,163,184,0.07)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, 2 + rr() * 6, 0, Math.PI * 2);
      g.stroke();
    }
    // The eyepiece: a rim, a little colour fringing, a scale around the edge.
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(248,113,113,0.18)';
    g.beginPath();
    g.arc(cx + 1, cy, R + 1, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(96,165,250,0.18)';
    g.beginPath();
    g.arc(cx - 1, cy, R + 1, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(203,213,225,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const l = k % 6 === 0 ? 9 : 4;
      g.strokeStyle = `rgba(203,213,225,${k % 6 === 0 ? 0.35 : 0.18})`;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
      g.lineTo(cx + Math.cos(a) * (R + 4 + l), cy + Math.sin(a) * (R + 4 + l));
      g.stroke();
    }
    medium = { W, H, c };
  }

  function draw() {
    const level = 0.55 + 0.45 * host.intensity;
    sprites ??= glowSprites();
    if (!medium || medium.W !== W || medium.H !== H) paintMedium();
    ctx.drawImage(medium!.c, 0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    // Antibiotic disks and their cleared zones.
    for (const z of toxins) {
      const k = Math.min(1, (t - z.t0) / 4);
      const fade = Math.min(1, (z.dur - (t - z.t0)) / 3);
      ctx.strokeStyle = `rgba(248,250,252,${(0.12 * fade).toFixed(3)})`;
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
    membranes(level);
    // The life: each particle a soft glow in its strain's dye; where they crowd, they shine.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = level;
    for (let i = 0; i < N; i++) {
      const s = sprites[sp[i]];
      const size = sp[i] === G ? 30 : 22;
      ctx.drawImage(s, px[i] - size / 2, py[i] - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = hexA(colors[sp[i]], 0.85 * level);
      ctx.fillRect(px[i] - 1, py[i] - 1, 2, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // Rings where something happened (drops, divisions, engulfings).
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
    // Reticle.
    ctx.strokeStyle = 'rgba(203,213,225,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.08, 0, Math.PI * 2);
    ctx.stroke();
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
    const groups = new Map<number, [number, number][]>();
    const tint = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
      const id = label[i];
      if (id < 0) continue;
      let g = groups.get(id);
      if (!g) {
        groups.set(id, (g = []));
        tint.set(id, new Array(S + 1).fill(0));
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
      const x0 = g.x0 - pad;
      const y0 = g.y0 - pad;
      const x1 = g.x1 + pad;
      const y1 = g.y1 + pad;
      const l = Math.min(12, (x1 - x0) / 3, (y1 - y0) / 3);
      ctx.strokeStyle = hexA('#e2e8f0', 0.55 * level);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [x, y, dx, dy] of [
        [x0, y0, 1, 1],
        [x1, y0, -1, 1],
        [x0, y1, 1, -1],
        [x1, y1, -1, -1],
      ]) {
        ctx.moveTo(x, y + dy * l);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * l, y);
      }
      ctx.stroke();
      const age = t - g.born;
      const text = `${spec(g.id)} · ${g.size} CELLS · ${g.strains} STRAIN${g.strains === 1 ? '' : 'S'} · ${Math.floor(age / 60)}:${String(Math.floor(age % 60)).padStart(2, '0')}`;
      const w = ctx.measureText(text).width;
      const tx = Math.max(8, Math.min(W - w - 8, x0));
      const ty = Math.max(14, y0 - 6);
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
    fillCrisp(ctx, `PETRI // SAMPLE ${String.fromCharCode(65 + (host.config.seedHash % 26))}-${(host.config.seedHash % 90) + 10} // 40× // ${o.stain === 'darkfield' ? 'DARKFIELD' : 'FLUORESCENCE'}`, 14, 20);
    ctx.textAlign = 'right';
    const clock = `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    fillCrisp(ctx, clock, W - 14, 20);
    fillCrisp(ctx, `ORGANISMS ${orgs.length} // DIVISIONS ${divisions}`, W - 14, H - 14);
    // Strains and their dyes.
    ctx.textAlign = 'left';
    for (let s = 0; s < S; s++) {
      ctx.fillStyle = hexA(colors[s], 0.9 * level);
      ctx.fillRect(14 + s * 34, 30, 6, 6);
      ctx.fillStyle = ink;
      fillCrisp(ctx, STRAINS[s], 23 + s * 34, 37);
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
      return {
        t,
        counts: { organisms: orgs.length, divisions, particles: N, toxins: toxins.length },
        log: bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: bus.seq,
      };
    },
    destroy() {
      sprites = null;
      medium = null;
    },
  };
}
