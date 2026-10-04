/**
 * The War Table's mount: the campaign (table-sim.ts), on parchment, in ink.
 *
 * Caches: the parchment (fibres, stains, a crease, burnt edges) per size; the map (a coast
 * drawn with contour ripples, hatched mountains, woods, roads, towns and their names, a
 * compass rose, a sea serpent) per campaign; the realms' watercolor washes when a town
 * changes hands; frost for winter. Live: orders drawn in ink, painted tokens moved by an
 * unseen hand, sieges counted in ticks, battles, burnings, notes in the margin, a dragon
 * sketched in passing, the wax seal of a peace, and a candle's warmth.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { forkRng } from '../../rng';
import { hash, hexA } from '../instruments/kit';
import { WAR_TABLE_SCHEMA } from './index';
import { createTableWorld, MONTHS, type Arrow, type Blot, type Token } from './table-sim';
import { serif, titled } from './names';

const INK = '#3b2a1a';
const PAPER = '#e9dcbd';

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(WAR_TABLE_SCHEMA, host.options) as { realms: number; pace: number; dragons: number; candle: boolean; notes: boolean };
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world = createTableWorld(host.config.seed, W, H, host.noise, { realms: o.realms, pace: o.pace, dragons: o.dragons });
  let nextAmbience = 0;

  world.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const x = typeof e.x === 'number' ? e.x : W / 2;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near: 1, text: e.text, color: e.color, priority: e.priority });
  });

  const step = (info: FrameInfo) => {
    world.step(host.motion === 'off' ? 0 : Math.min(info.dt, 0.1));
    if (world.t >= nextAmbience && host.events?.active) {
      nextAmbience = world.t + 2;
      host.events.emit({ type: 'ambience', weight: world.winter ? 0.2 : 0.5, pan: 0, near: 1 });
    }
  };

  const canvas = (w: number, h: number, scale = 1) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    return { c, g };
  };
  const dpr = () => Math.min(2, host.viewport.dpr || 1);

  // ---- parchment -----------------------------------------------------------------------------

  let paper: { W: number; H: number; c: HTMLCanvasElement } | null = null;
  function paintPaper() {
    const { c, g } = canvas(W, H, dpr());
    const r = forkRng(host.config.seed, 'parchment');
    const base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#ece0c3');
    base.addColorStop(0.5, PAPER);
    base.addColorStop(1, '#e2d2ad');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // Blotches of age.
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 40 + r() * 160;
      const st = g.createRadialGradient(x, y, 0, x, y, rad);
      st.addColorStop(0, `rgba(150,110,60,${(0.02 + r() * 0.04).toFixed(3)})`);
      st.addColorStop(1, 'rgba(150,110,60,0)');
      g.fillStyle = st;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Fibres.
    g.strokeStyle = 'rgba(120,90,50,0.06)';
    g.lineWidth = 0.6;
    for (let i = 0; i < W * H * 0.0006; i++) {
      const x = r() * W;
      const y = r() * H;
      const a = r() * Math.PI;
      const l = 3 + r() * 9;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // A crease across the middle, and one down.
    for (const [x0, y0, x1, y1] of [
      [0, H * 0.5, W, H * 0.52],
      [W * 0.5, 0, W * 0.49, H],
    ]) {
      g.strokeStyle = 'rgba(110,80,40,0.10)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.strokeStyle = 'rgba(255,250,235,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0 + 1.5, y0 + 1.5);
      g.lineTo(x1 + 1.5, y1 + 1.5);
      g.stroke();
    }
    // Burnt, darkened edges.
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    v.addColorStop(0, 'rgba(90,55,25,0)');
    v.addColorStop(0.75, 'rgba(90,55,25,0.18)');
    v.addColorStop(1, 'rgba(60,35,15,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    paper = { W, H, c };
  }

  // ---- the map, in ink --------------------------------------------------------------------------

  let mapArt: { n: number; W: number; H: number; c: HTMLCanvasElement } | null = null;

  /** Contours of the land at `level`, by marching squares on a coarse grid. */
  function contour(g: CanvasRenderingContext2D, level: number, cell: number) {
    const cols = Math.ceil(W / cell) + 1;
    const rows = Math.ceil(H / cell) + 1;
    const v: number[] = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v.push(world.elevAt(i * cell, j * cell) - level);
    const at = (i: number, j: number) => v[j * cols + i];
    const lerp = (a: number, b: number) => a / (a - b);
    g.beginPath();
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i + 1, j + 1);
        const d = at(i, j + 1);
        const pts: [number, number][] = [];
        if (a > 0 !== b > 0) pts.push([(i + lerp(a, b)) * cell, j * cell]);
        if (b > 0 !== c > 0) pts.push([(i + 1) * cell, (j + lerp(b, c)) * cell]);
        if (c > 0 !== d > 0) pts.push([(i + 1 - lerp(c, d)) * cell, (j + 1) * cell]);
        if (d > 0 !== a > 0) pts.push([i * cell, (j + 1 - lerp(d, a)) * cell]);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          g.moveTo(pts[k][0], pts[k][1]);
          g.lineTo(pts[k + 1][0], pts[k + 1][1]);
        }
      }
    }
    g.stroke();
  }

  function paintMap() {
    const { c, g } = canvas(W, H, dpr());
    const r = forkRng(host.config.seed, `map-${world.n}`);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // The sea: ripples out from the coast, fainter as they go.
    [
      [-0.035, 0.24],
      [-0.075, 0.14],
      [-0.12, 0.08],
    ].forEach(([lvl, a]) => {
      g.strokeStyle = hexA(INK, a);
      g.lineWidth = 0.9;
      contour(g, lvl, 6);
    });
    // The coast itself, and a wash of shallow water along it.
    g.strokeStyle = hexA(INK, 0.85);
    g.lineWidth = 1.5;
    contour(g, 0, 5);
    // Hills and mountains, hatched on the side away from the light.
    for (let y = 30; y < H - 20; y += 24) {
      for (let x = 20; x < W - 20; x += 26) {
        const jx = x + (hash(x, y, 1) - 0.5) * 14;
        const jy = y + (hash(x, y, 2) - 0.5) * 12;
        const e = world.elevAt(jx, jy);
        if (e < 0.48) continue;
        const big = e > 0.62;
        const w = big ? 11 : 7;
        const h = big ? 12 : 7;
        g.strokeStyle = hexA(INK, 0.6);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(jx - w, jy);
        g.quadraticCurveTo(jx - w * 0.3, jy - h * 0.6, jx, jy - h);
        g.quadraticCurveTo(jx + w * 0.4, jy - h * 0.5, jx + w, jy);
        g.stroke();
        g.lineWidth = 0.7;
        g.strokeStyle = hexA(INK, 0.32);
        for (let k = 1; k < 4; k++) {
          g.beginPath();
          g.moveTo(jx + k * (w / 4), jy - h * (1 - k / 4) * 0.8);
          g.lineTo(jx + k * (w / 4) - 2, jy);
          g.stroke();
        }
      }
    }
    // Woods: little trees in clusters.
    for (let i = 0; i < 70; i++) {
      const cx = r() * W;
      const cy = r() * H;
      const e = world.elevAt(cx, cy);
      if (e < 0.1 || e > 0.45) continue;
      const n = 4 + Math.floor(r() * 9);
      for (let k = 0; k < n; k++) {
        const x = cx + (r() - 0.5) * 50;
        const y = cy + (r() - 0.5) * 30;
        if (world.elevAt(x, y) < 0.1) continue;
        g.strokeStyle = hexA(INK, 0.55);
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(x, y - 4, 2.6, 0, Math.PI * 2);
        g.moveTo(x, y - 1.4);
        g.lineTo(x, y + 2);
        g.stroke();
      }
    }
    // Roads: dotted, bending a little.
    g.strokeStyle = hexA(INK, 0.55);
    g.lineWidth = 1;
    g.setLineDash([2, 4]);
    const drawn = new Set<string>();
    for (const a of world.towns) {
      for (const b of a.links) {
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const mx = (a.x + b.x) / 2 + (hash(a.id, b.id) - 0.5) * 30;
        const my = (a.y + b.y) / 2 + (hash(b.id, a.id) - 0.5) * 30;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.quadraticCurveTo(mx, my, b.x, b.y);
        g.stroke();
      }
    }
    g.setLineDash([]);
    // Towns: a little castle each (the seats bigger), and their names in a hand.
    for (const t of world.towns) {
      const s = t.capital ? 1.4 : 1;
      g.fillStyle = PAPER;
      g.strokeStyle = INK;
      g.lineWidth = 1.1;
      const w = 10 * s;
      const h = 7 * s;
      g.fillRect(t.x - w / 2, t.y - h, w, h);
      g.strokeRect(t.x - w / 2, t.y - h, w, h);
      g.fillRect(t.x - w / 2 - 2, t.y - h - 4 * s, 4 * s, h + 4 * s);
      g.strokeRect(t.x - w / 2 - 2, t.y - h - 4 * s, 4 * s, h + 4 * s);
      g.fillRect(t.x + w / 2 - 2 * s, t.y - h - 4 * s, 4 * s, h + 4 * s);
      g.strokeRect(t.x + w / 2 - 2 * s, t.y - h - 4 * s, 4 * s, h + 4 * s);
      g.fillStyle = INK;
      g.fillRect(t.x - 1.5, t.y - 4, 3, 4);
      g.font = serif(t.capital ? 14 : 12, true);
      g.textAlign = 'center';
      g.fillStyle = hexA(INK, 0.9);
      g.fillText(titled(t.name), t.x, t.y + 16 + (t.capital ? 2 : 0));
    }
    // Sea things: waves, a ship, a serpent; and a compass rose.
    const sea: [number, number][] = [];
    for (let i = 0; i < 400 && sea.length < 40; i++) {
      const x = r() * W;
      const y = r() * H;
      if (world.elevAt(x, y) < -0.14) sea.push([x, y]);
    }
    g.strokeStyle = hexA(INK, 0.4);
    g.lineWidth = 0.9;
    for (const [x, y] of sea.slice(0, 26)) {
      g.beginPath();
      g.moveTo(x - 7, y);
      g.quadraticCurveTo(x - 3.5, y - 3, x, y);
      g.quadraticCurveTo(x + 3.5, y + 3, x + 7, y);
      g.stroke();
    }
    if (sea[30]) {
      const [x, y] = sea[30];
      g.strokeStyle = hexA(INK, 0.7);
      g.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x - 24 + k * 16, y, 7, Math.PI, 0);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(x + 24, y);
      g.quadraticCurveTo(x + 30, y - 14, x + 38, y - 10);
      g.lineTo(x + 32, y - 6);
      g.stroke();
      g.font = serif(10, true);
      g.fillStyle = hexA(INK, 0.6);
      g.fillText('a serpent was seen here', x, y + 18);
    }
    if (sea[34]) {
      const [x, y] = sea[34];
      g.strokeStyle = hexA(INK, 0.75);
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(x - 12, y);
      g.quadraticCurveTo(x, y + 7, x + 12, y);
      g.closePath();
      g.moveTo(x, y);
      g.lineTo(x, y - 18);
      g.moveTo(x, y - 17);
      g.quadraticCurveTo(x + 9, y - 10, x, y - 3);
      g.stroke();
    }
    const rose = sea.find(([x, y]) => x > W * 0.7 && y > H * 0.6) ?? [W - 90, H - 110];
    compass(g, rose[0], rose[1], 34);
    mapArt = { n: world.n, W, H, c };
  }

  function compass(g: CanvasRenderingContext2D, x: number, y: number, R: number) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = hexA(INK, 0.75);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, R * 0.75, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const len = i % 2 ? R * 0.6 : R;
      g.fillStyle = i % 2 ? hexA(INK, 0.35) : i === 0 ? '#9a3b2a' : hexA(INK, 0.75);
      g.beginPath();
      g.moveTo(Math.cos(a) * len, Math.sin(a) * len);
      g.lineTo(Math.cos(a + 0.22) * R * 0.18, Math.sin(a + 0.22) * R * 0.18);
      g.lineTo(Math.cos(a - 0.22) * R * 0.18, Math.sin(a - 0.22) * R * 0.18);
      g.closePath();
      g.fill();
    }
    g.font = serif(12, true);
    g.textAlign = 'center';
    g.fillStyle = hexA(INK, 0.85);
    g.fillText('N', 0, -R - 5);
    g.restore();
  }

  // ---- the realms' washes ---------------------------------------------------------------------

  let washes: { v: number; n: number; W: number; H: number; c: HTMLCanvasElement } | null = null;
  function paintWashes() {
    const { c, g } = canvas(W, H, 1);
    for (const t of world.towns) {
      const rad = t.capital ? 90 : 70;
      const wash = g.createRadialGradient(t.x, t.y, 0, t.x, t.y, rad);
      wash.addColorStop(0, hexA(t.owner.color, 0.16));
      wash.addColorStop(0.7, hexA(t.owner.color, 0.08));
      wash.addColorStop(1, hexA(t.owner.color, 0));
      g.fillStyle = wash;
      g.fillRect(t.x - rad, t.y - rad, rad * 2, rad * 2);
    }
    washes = { v: world.version, n: world.n, W, H, c };
  }

  // ---- frost ----------------------------------------------------------------------------------

  let frost: { W: number; H: number; c: HTMLCanvasElement } | null = null;
  let winterK = 0;
  function paintFrost() {
    const { c, g } = canvas(W, H, 1);
    const r = forkRng(host.config.seed, 'frost');
    for (let i = 0; i < W * H * 0.004; i++) {
      const x = r() * W;
      const y = r() * H;
      const edge = Math.min(x, y, W - x, H - y) / (Math.min(W, H) * 0.25);
      if (r() < edge) continue;
      g.fillStyle = `rgba(240,248,255,${(0.35 * (1 - edge)).toFixed(3)})`;
      g.fillRect(x, y, 1 + r() * 2, 1);
    }
    frost = { W, H, c };
  }

  // ---- the living layer ------------------------------------------------------------------------

  function arrows(t: number) {
    for (const a of world.arrows) {
      const age = t - a.t0;
      const draw = Math.min(1, age / 1.2);
      const alpha = Math.max(0.1, 0.75 - Math.max(0, age - 4) * 0.035);
      // A smoothed path through the order's towns.
      const pts = a.pts;
      let total = 0;
      for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      ctx.save();
      ctx.strokeStyle = hexA(a.color, alpha);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.setLineDash([total * draw, total + 10]);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1];
        const [x, y] = pts[i];
        const bend = (hash(i, Math.floor(a.t0 * 10)) - 0.5) * 24;
        const nx = -(y - py);
        const ny = x - px;
        const nl = Math.hypot(nx, ny) || 1;
        ctx.quadraticCurveTo((px + x) / 2 + (nx / nl) * bend, (py + y) / 2 + (ny / nl) * bend, x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (draw >= 1) {
        const [x, y] = pts[pts.length - 1];
        const [px, py] = pts[pts.length - 2];
        const ang = Math.atan2(y - py, x - px);
        ctx.fillStyle = hexA(a.color, alpha);
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(ang) * 6, y - Math.sin(ang) * 6);
        ctx.lineTo(x - Math.cos(ang) * 16 - Math.sin(ang) * 6, y - Math.sin(ang) * 16 + Math.cos(ang) * 6);
        ctx.lineTo(x - Math.cos(ang) * 16 + Math.sin(ang) * 6, y - Math.sin(ang) * 16 - Math.cos(ang) * 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function tokenAt(k: Token, t: number) {
    const fallen = k.fallenAt >= 0;
    const tip = fallen ? Math.min(1, (t - k.fallenAt) / 0.6) : 0;
    const size = k.kind === 'king' ? 18 : 15;
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(tip * 1.3);
    ctx.globalAlpha = fallen ? Math.max(0, 1 - (t - k.fallenAt) / 3) : 1;
    // The stack: one plate per point of strength, the top one carved.
    const n = Math.max(1, Math.min(5, k.strength));
    for (let i = n - 1; i >= 0; i--) {
      const y = i * 2.5;
      ctx.fillStyle = 'rgba(40,25,10,0.28)';
      ctx.fillRect(-size / 2 + 2.5, -size / 2 + y + 3, size, size);
      const g = ctx.createLinearGradient(-size / 2, -size / 2 + y, size / 2, size / 2 + y);
      g.addColorStop(0, hexA(k.realm.color, 1));
      g.addColorStop(1, hexA(k.realm.ink, 1));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2 + y, size, size, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,18,8,0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,248,230,0.55)';
    ctx.beginPath();
    ctx.moveTo(-size / 2 + 2, -size / 2 + 1.5);
    ctx.lineTo(size / 2 - 2, -size / 2 + 1.5);
    ctx.stroke();
    // The carving.
    ctx.strokeStyle = 'rgba(250,240,215,0.9)';
    ctx.fillStyle = 'rgba(250,240,215,0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (k.kind === 'king') {
      ctx.moveTo(-5, 3);
      ctx.lineTo(-5, -3);
      ctx.lineTo(-2.5, 0);
      ctx.lineTo(0, -4);
      ctx.lineTo(2.5, 0);
      ctx.lineTo(5, -3);
      ctx.lineTo(5, 3);
      ctx.closePath();
      ctx.stroke();
    } else if (k.kind === 'horse') {
      ctx.arc(0, -1, 4, Math.PI * 0.1, Math.PI * 0.9, true);
      ctx.stroke();
    } else {
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 5);
      ctx.moveTo(-3.5, 2);
      ctx.lineTo(3.5, 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function sieges(t: number) {
    for (const town of world.towns) {
      if (town.siege <= 0) continue;
      const by = world.tokens.find((k) => k.at === town && !k.to && k.realm !== town.owner && k.fallenAt < 0);
      if (!by) continue;
      ctx.save();
      ctx.strokeStyle = hexA(by.realm.color, 0.75);
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -t * 6;
      ctx.beginPath();
      ctx.arc(town.x, town.y - 4, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Days of siege, counted in ticks around the ring.
      const ticks = Math.min(24, Math.floor((town.siege / town.walls) * 24));
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexA(INK, 0.7);
      for (let i = 0; i < ticks; i++) {
        const a = -Math.PI / 2 + (i / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(town.x + Math.cos(a) * 27, town.y - 4 + Math.sin(a) * 27);
        ctx.lineTo(town.x + Math.cos(a) * 31, town.y - 4 + Math.sin(a) * 31);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function pennants(t: number) {
    for (const town of world.towns) {
      const x = town.x + (town.capital ? 9 : 7);
      const y = town.y - (town.capital ? 20 : 15);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y - 4);
      ctx.stroke();
      ctx.fillStyle = town.owner.color;
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 9, y - 1.5 + Math.sin(t * 3 + town.id) * 0.8);
      ctx.lineTo(x, y + 1);
      ctx.fill();
    }
  }

  function blot(b: Blot, t: number) {
    const age = t - b.t0;
    const fade = Math.min(1, age * 3);
    const r = (k: number) => hash(b.seed, k);
    ctx.save();
    if (b.kind === 'battle') {
      ctx.fillStyle = hexA(INK, 0.5 * fade);
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(b.x + (r(i) - 0.5) * 34, b.y + (r(i + 20) - 0.5) * 24, 0.8 + r(i + 40) * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = hexA(INK, 0.85 * fade);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(b.x - 9, b.y - 9);
      ctx.lineTo(b.x + 9, b.y + 9);
      ctx.moveTo(b.x + 9, b.y - 9);
      ctx.lineTo(b.x - 9, b.y + 9);
      ctx.moveTo(b.x - 9, b.y + 3);
      ctx.lineTo(b.x - 3, b.y + 9);
      ctx.moveTo(b.x + 9, b.y + 3);
      ctx.lineTo(b.x + 3, b.y + 9);
      ctx.stroke();
    } else if (b.kind === 'burn' || b.kind === 'dragon') {
      const g = ctx.createRadialGradient(b.x, b.y - 4, 0, b.x, b.y - 4, 26);
      g.addColorStop(0, `rgba(40,25,12,${(0.55 * fade).toFixed(3)})`);
      g.addColorStop(0.6, `rgba(90,50,20,${(0.25 * fade).toFixed(3)})`);
      g.addColorStop(1, 'rgba(90,50,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = 18 + r(i) * 10;
        (i ? ctx.lineTo : ctx.moveTo).call(ctx, b.x + Math.cos(a) * rr, b.y - 4 + Math.sin(a) * rr * 0.8);
      }
      ctx.fill();
      if (age < 4) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(234,88,12,${(0.25 * (1 - age / 4)).toFixed(3)})`;
        ctx.fill();
      }
    } else if (b.kind === 'plague') {
      ctx.fillStyle = `rgba(87,83,78,${(0.18 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 22, 14, 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'seal') {
      // The wax seal of the peace, stamped.
      const s = age < 0.4 ? 1.5 - age * 1.25 : 1;
      ctx.translate(b.x, b.y);
      ctx.scale(s, s);
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(-6, 14);
      ctx.lineTo(-14, 46);
      ctx.lineTo(-4, 40);
      ctx.lineTo(2, 48);
      ctx.lineTo(4, 16);
      ctx.fill();
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = 26 + (r(i) - 0.5) * 4;
        (i ? ctx.lineTo : ctx.moveTo).call(ctx, Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.fill();
      ctx.strokeStyle = '#6b1515';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = serif(20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#5c1010';
      ctx.fillText((b.text ?? 'P').charAt(0), 0, 1);
      ctx.fillStyle = 'rgba(255,200,200,0.18)';
      ctx.beginPath();
      ctx.ellipse(-8, -10, 8, 4, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function dragon(t: number) {
    const d = world.dragon;
    if (!d) return;
    const flip = d.tx < d.x ? -1 : 1;
    const flap = Math.sin(t * 6);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(flip, 1);
    ctx.strokeStyle = hexA('#5e2015', 0.9);
    ctx.fillStyle = hexA('#5e2015', 0.18);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    // Body and tail, neck and head, sketched.
    ctx.moveTo(-36, 6);
    ctx.quadraticCurveTo(-18, -4, 0, 0);
    ctx.quadraticCurveTo(14, 2, 22, -6);
    ctx.lineTo(30, -8);
    ctx.lineTo(24, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -1);
    ctx.lineTo(-12, -20 - flap * 10);
    ctx.lineTo(4, -12 - flap * 4);
    ctx.lineTo(10, -22 - flap * 9);
    ctx.lineTo(10, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function notes(t: number, level: number) {
    if (!o.notes) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = serif(13, true);
    const placed: [number, number, number][] = [];
    for (const n of world.notes) {
      const age = t - n.t0;
      const a = Math.min(1, age * 1.5) * Math.max(0, Math.min(1, (26 - age) / 6)) * level;
      if (a <= 0) continue;
      const chars = Math.floor(age * 24);
      const text = n.text.slice(0, chars);
      // Written where there is room: below an earlier note, not over it.
      const w = ctx.measureText(n.text).width;
      const x = Math.max(w / 2 + 16, Math.min(W - w / 2 - 16, n.x));
      let y = Math.max(70, Math.min(H - 40, n.y));
      for (let tries = 0; tries < 8 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 6 && Math.abs(py - y) < 17); tries++) y += 17;
      placed.push([x, y, w]);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(n.angle);
      ctx.font = serif(13, true);
      ctx.fillStyle = hexA(n.ink, 0.92 * a);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function cartouche(level: number) {
    const title = `THE WAR OF ${world.name}`;
    ctx.save();
    ctx.font = serif(16);
    const w = Math.max(ctx.measureText(title).width + 60, 240);
    const x = 24;
    const y = 20;
    const h = 52;
    ctx.fillStyle = 'rgba(240,228,200,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hexA(INK, 0.8 * level);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA(INK, 0.9 * level);
    ctx.fillText(title, x + w / 2, y + 24);
    ctx.font = serif(12, true);
    ctx.fillText(`${titled(MONTHS[world.month])} of the year ${world.year}${world.winter ? ', in winter quarters' : ''}`, x + w / 2, y + 42);
    // The realms, with their colors, in the corner.
    ctx.textAlign = 'right';
    ctx.font = serif(12, true);
    world.realms.forEach((rl, i) => {
      const held = world.towns.filter((tw) => tw.owner === rl).length;
      const ty = 30 + i * 18;
      ctx.fillStyle = hexA(INK, (rl.out ? 0.45 : 0.9) * level);
      ctx.fillText(`${titled(rl.short)}, ${held} town${held === 1 ? '' : 's'}${rl.out ? ' (yielded)' : ''}`, W - 40, ty);
      ctx.fillStyle = rl.color;
      ctx.fillRect(W - 32, ty - 9, 10, 10);
    });
    ctx.restore();
  }

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      world.resize(W, H);
      paper = null;
      mapArt = null;
      washes = null;
      frost = null;
    },
    frame(info: FrameInfo) {
      step(info);
      const t = world.t;
      const level = 0.6 + 0.4 * host.intensity;
      if (!paper || paper.W !== W || paper.H !== H) paintPaper();
      if (!mapArt || mapArt.n !== world.n || mapArt.W !== W || mapArt.H !== H) paintMap();
      if (!washes || washes.v !== world.version || washes.n !== world.n || washes.W !== W || washes.H !== H) paintWashes();
      ctx.drawImage(paper!.c, 0, 0, W, H);
      ctx.drawImage(washes!.c, 0, 0, W, H);
      ctx.drawImage(mapArt!.c, 0, 0, W, H);
      for (const b of world.blots) if (b.kind !== 'seal') blot(b, t);
      pennants(t);
      arrows(t);
      sieges(t);
      const order = [...world.tokens].sort((a, b) => a.y - b.y);
      for (const k of order) tokenAt(k, t);
      dragon(t);
      for (const b of world.blots) if (b.kind === 'seal') blot(b, t);
      // Winter: frost creeps in from the edges.
      winterK += ((world.winter ? 1 : 0) - winterK) * 0.03;
      if (winterK > 0.01) {
        if (!frost || frost.W !== W || frost.H !== H) paintFrost();
        ctx.globalAlpha = winterK;
        ctx.drawImage(frost!.c, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      // A candle off to one side.
      if (o.candle) {
        const fl = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1);
        const g = ctx.createRadialGradient(-W * 0.05, H * 0.15, 0, -W * 0.05, H * 0.15, W * 0.7);
        g.addColorStop(0, `rgba(255,190,110,${(0.10 * fl).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      cartouche(level);
      notes(t, level);
      if (world.sealed >= 0 && t - world.sealed > 7) {
        ctx.fillStyle = `rgba(233,220,189,${Math.min(1, (t - world.sealed - 7) / 2).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    },
    advance(info: FrameInfo) {
      step(info);
    },
    inspect(): SkinInspection {
      return {
        t: world.t,
        counts: world.counts(),
        log: world.bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: world.bus.seq,
      };
    },
    destroy() {
      paper = null;
      mapArt = null;
      washes = null;
      frost = null;
    },
  };
}

export type { Arrow };
