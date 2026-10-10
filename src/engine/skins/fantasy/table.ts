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
import { hash, hexA, mixRgb } from '../instruments/kit';
import { WAR_TABLE_SCHEMA } from './index';
import { createTableWorld, MONTH as MONTH_S, MONTHS, type Arrow, type Blot, type Token } from './table-sim';
import { placeName, serif, titled } from './names';
import { isoPath } from './iso';

const INK = '#3b2a1a';
const PAPER = '#e9dcbd';

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(WAR_TABLE_SCHEMA, host.options) as { realms: number; pace: number; dragons: number; candle: boolean; notes: boolean; fog: boolean };
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
    // Rhumb lines from the compass rose, faint, across everything.
    const sea0: [number, number][] = [];
    for (let i = 0; i < 400 && sea0.length < 40; i++) {
      const x = hash(world.n, i, 1) * W;
      const y = hash(world.n, i, 2) * H;
      if (world.elevAt(x, y) < -0.14) sea0.push([x, y]);
    }
    const rosePt = sea0.find(([x, y]) => x > W * 0.7 && y > H * 0.6) ?? [W - 90, H - 110];
    g.strokeStyle = hexA(INK, 0.07);
    g.lineWidth = 0.7;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.moveTo(rosePt[0], rosePt[1]);
      g.lineTo(rosePt[0] + Math.cos(a) * W * 1.5, rosePt[1] + Math.sin(a) * W * 1.5);
    }
    g.stroke();
    // Rivers: from the high ground, downhill to the sea, thickening as they go.
    const peaks: [number, number][] = [];
    for (let y = 30; y < H - 20; y += 24) for (let x = 20; x < W - 20; x += 26) if (world.elevAt(x, y) > 0.56) peaks.push([x, y]);
    for (let i = 0; i < Math.min(5, peaks.length); i++) {
      let [x, y] = peaks[Math.floor(hash(world.n, i, 7) * peaks.length)];
      const line: [number, number][] = [[x, y]];
      for (let s = 0; s < 120; s++) {
        let best: [number, number] | null = null;
        let be = world.elevAt(x, y);
        for (let a = 0; a < 8; a++) {
          const nx = x + Math.cos((a / 8) * Math.PI * 2) * 9;
          const ny = y + Math.sin((a / 8) * Math.PI * 2) * 9;
          const e = world.elevAt(nx, ny);
          if (e < be) {
            be = e;
            best = [nx, ny];
          }
        }
        if (!best) break;
        [x, y] = best;
        line.push([x + (hash(s, i) - 0.5) * 3, y + (hash(i, s) - 0.5) * 3]);
        if (be < 0) break;
      }
      if (line.length < 6 || world.elevAt(x, y) >= 0.02) continue;
      g.strokeStyle = hexA(INK, 0.6);
      for (let s = 1; s < line.length; s++) {
        g.lineWidth = 0.6 + (s / line.length) * 1.4;
        g.beginPath();
        g.moveTo(line[s - 1][0], line[s - 1][1]);
        g.lineTo(line[s][0], line[s][1]);
        g.stroke();
      }
    }
    // Hills and mountains, hatched on the side away from the light.
    const ranges: [number, number][] = [];
    for (let y = 30; y < H - 20; y += 24) {
      for (let x = 20; x < W - 20; x += 26) {
        const jx = x + (hash(x, y, 1) - 0.5) * 14;
        const jy = y + (hash(x, y, 2) - 0.5) * 12;
        const e = world.elevAt(jx, jy);
        if (e < 0.48) continue;
        ranges.push([jx, jy]);
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
    // Woods: little trees in clusters (the biggest gets a name).
    let wood: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 70; i++) {
      const cx = r() * W;
      const cy = r() * H;
      const e = world.elevAt(cx, cy);
      if (e < 0.1 || e > 0.45) continue;
      const n = 4 + Math.floor(r() * 9);
      if (n > wood[2] && world.towns.every((t) => Math.hypot(t.x - cx, t.y - cy) > 60)) wood = [cx, cy, n];
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
    compass(g, rosePt[0], rosePt[1], 34);
    // Names across the land and sea, spaced out as on old maps.
    const spaced = (text: string, x: number, y: number, size: number, a: number) => {
      g.font = serif(size, true);
      g.textAlign = 'center';
      g.fillStyle = hexA(INK, a);
      g.fillText(text.split('').join(' '), x, y);
    };
    const nameOf = () => titled(placeName(r)).replace(/(wood|mere|vale|hold|wick|barrow|haven|moor|fell|stead|march|gate|bridge|watch|crag|holm|by|ton|reach|dale|mouth|well|ford)$/i, '');
    if (ranges.length > 6) {
      const mx = ranges.reduce((s, p) => s + p[0], 0) / ranges.length;
      const my = ranges.reduce((s, p) => s + p[1], 0) / ranges.length;
      spaced(`The ${nameOf()} Peaks`.toUpperCase(), mx, my + 26, 10, 0.5);
    }
    if (wood[2]) spaced(`The ${nameOf()}wood`.toUpperCase(), wood[0], wood[1] + 26, 10, 0.5);
    const deep = sea.slice().sort((a, b) => world.elevAt(a[0], a[1]) - world.elevAt(b[0], b[1]))[0];
    if (deep) spaced(`The ${nameOf()} Sea`.toUpperCase(), deep[0], deep[1], 12, 0.42);
    // Strange places, with their names in a small hand.
    const land: [number, number][] = [];
    for (let i = 0; i < 600 && land.length < 12; i++) {
      const x = 60 + r() * (W - 120);
      const y = 90 + r() * (H - 160);
      const e = world.elevAt(x, y);
      if (e < 0.12 || e > 0.46) continue;
      if (world.towns.some((t) => Math.hypot(t.x - x, t.y - y) < 70)) continue;
      if (land.some(([px, py]) => Math.hypot(px - x, py - y) < 120)) continue;
      land.push([x, y]);
    }
    const label = (text: string, x: number, y: number) => {
      g.font = serif(10, true);
      g.textAlign = 'center';
      g.fillStyle = hexA(INK, 0.62);
      g.fillText(text, x, y + 14);
    };
    g.strokeStyle = hexA(INK, 0.75);
    g.fillStyle = hexA(INK, 0.75);
    g.lineWidth = 1;
    if (land[0]) {
      // A tower where someone lives who should not be visited.
      const [x, y] = land[0];
      g.strokeRect(x - 2.5, y - 16, 5, 16);
      g.beginPath();
      g.moveTo(x - 4, y - 16);
      g.lineTo(x, y - 25);
      g.lineTo(x + 4, y - 16);
      g.closePath();
      g.stroke();
      g.fillRect(x - 0.6, y - 11, 1.2, 2.5);
      star(g, x + 6, y - 26, 2.5);
      label(`the ${['Witch', 'Wizard', 'Hermit', 'Astrologer'][Math.floor(r() * 4)]}'s Tower`, x, y);
    }
    if (land[1]) {
      // Ruins: broken columns, a fallen lintel.
      const [x, y] = land[1];
      for (const [dx, h] of [
        [-8, 10],
        [-3, 6],
        [3, 12],
        [8, 4],
      ] as const) g.strokeRect(x + dx - 1, y - h, 2, h);
      g.beginPath();
      g.moveTo(x - 10, y + 1);
      g.lineTo(x + 10, y + 1);
      g.moveTo(x + 2, y - 2);
      g.lineTo(x + 10, y - 4);
      g.stroke();
      label(`ruins of Old ${titled(placeName(r))}`, x, y);
    }
    if (land[2]) {
      // A ring of standing stones.
      const [x, y] = land[2];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        g.fillRect(x + Math.cos(a) * 9 - 1, y + Math.sin(a) * 5 - 4, 2, 4);
      }
      label('the Standing Stones', x, y);
    }
    if (land[3]) {
      // A barrow, and a warning.
      const [x, y] = land[3];
      g.beginPath();
      g.ellipse(x, y, 9, 4, 0, Math.PI, 0);
      g.stroke();
      g.beginPath();
      g.moveTo(x - 2, y - 1);
      g.lineTo(x + 2, y - 1);
      g.stroke();
      label('the barrow, let it be', x, y);
    }
    // A kraken in the deep, and a whale spouting.
    if (sea[20]) {
      const [x, y] = sea[20];
      g.strokeStyle = hexA(INK, 0.7);
      g.lineWidth = 1.2;
      for (let k = 0; k < 4; k++) {
        const bx = x - 18 + k * 12;
        g.beginPath();
        g.moveTo(bx, y + 4);
        g.bezierCurveTo(bx - 4, y - 8, bx + 8, y - 14 - k * 2, bx + 4 + (k % 2 ? 4 : -4), y - 18 - k * 2);
        g.stroke();
        for (let s = 0; s < 3; s++) g.fillRect(bx + 1 + s * 0.5, y - 2 - s * 5, 1.2, 1.2);
      }
      g.beginPath();
      g.moveTo(x - 24, y + 4);
      g.quadraticCurveTo(x, y + 8, x + 24, y + 4);
      g.stroke();
      label('here the deep thing rises', x, y + 6);
    }
    if (sea[25]) {
      const [x, y] = sea[25];
      g.strokeStyle = hexA(INK, 0.7);
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(x - 14, y);
      g.quadraticCurveTo(x - 4, y - 9, x + 10, y - 2);
      g.lineTo(x + 16, y - 7);
      g.moveTo(x + 10, y - 2);
      g.lineTo(x + 16, y + 2);
      g.moveTo(x - 14, y);
      g.quadraticCurveTo(x, y + 3, x + 10, y - 2);
      g.moveTo(x - 9, y - 6);
      g.quadraticCurveTo(x - 12, y - 14, x - 15, y - 12);
      g.moveTo(x - 9, y - 6);
      g.quadraticCurveTo(x - 6, y - 14, x - 3, y - 12);
      g.stroke();
    }
    // A wind's head in the upper right, blowing across the sea.
    wind(g, W - 74, 138);
    // The frame, and a scale of leagues.
    g.strokeStyle = hexA(INK, 0.7);
    g.lineWidth = 1.4;
    g.strokeRect(9, 9, W - 18, H - 18);
    g.lineWidth = 0.7;
    g.strokeRect(14, 14, W - 28, H - 28);
    for (const [cx2, cy2] of [
      [9, 9],
      [W - 9, 9],
      [9, H - 9],
      [W - 9, H - 9],
    ]) {
      g.fillStyle = hexA(INK, 0.7);
      g.fillRect(cx2 - 3, cy2 - 3, 6, 6);
    }
    const sx0 = 36;
    const sy0 = H - 34;
    for (let k = 0; k < 5; k++) {
      g.fillStyle = k % 2 ? PAPER : hexA(INK, 0.7);
      g.fillRect(sx0 + k * 18, sy0, 18, 4);
    }
    g.strokeStyle = hexA(INK, 0.7);
    g.strokeRect(sx0, sy0, 90, 4);
    g.font = serif(9, true);
    g.textAlign = 'left';
    g.fillStyle = hexA(INK, 0.65);
    g.fillText('leagues', sx0, sy0 - 4);
    mapArt = { n: world.n, W, H, c };
  }

  function star(g: CanvasRenderingContext2D, x: number, y: number, rr: number) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const d = i % 2 ? rr * 0.45 : rr;
      if (i) g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      else g.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    g.closePath();
    g.fill();
  }

  /** A wind's head: a round face, puffed cheeks, and the breath in curling lines. */
  function wind(g: CanvasRenderingContext2D, x: number, y: number) {
    g.save();
    g.strokeStyle = hexA(INK, 0.6);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, 12, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x - 6, y + 2, 4, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x + 4, y - 4, 1, 0, Math.PI * 2);
    g.moveTo(x - 4, y - 5);
    g.arc(x - 4, y - 4, 1, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(x - 11, y + 4, 2, 0, Math.PI * 2);
    g.stroke();
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(x - 14, y + 4 + (k - 1.5) * 4);
      g.bezierCurveTo(x - 30, y + (k - 1.5) * 8, x - 44, y + 10 + (k - 1.5) * 9, x - 62 - k * 6, y + 4 + (k - 1.5) * 10);
      g.stroke();
    }
    g.restore();
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

  // ---- dispatches -----------------------------------------------------------------------------

  /** A folded letter, sealed in red wax; broken open when taken, unfolded when delivered. */
  function letter(x: number, y: number, a: number, s: number, alpha: number, broken: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(40,25,10,0.25)';
    ctx.fillRect(-6 + 1.5, -4 + 1.5, 12, 8);
    ctx.fillStyle = '#f4ead3';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.strokeStyle = hexA(INK, 0.75);
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-6, -4, 12, 8);
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(0, 0.5);
    ctx.lineTo(6, -4);
    ctx.stroke();
    ctx.fillStyle = '#991b1b';
    if (broken) {
      ctx.fillRect(-2.6, -0.6, 2, 2.6);
      ctx.fillRect(0.8, 0.2, 2, 2.4);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0.8, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function letters(t: number) {
    for (const d of world.dispatches) {
      if (d.taken) {
        // Taken: the seal broken, the letter turned over in the enemy's hand.
        const k = Math.min(1, (t - d.takenAt) / 0.6);
        letter(d.x, d.y - 6, 0.4 + k * 2.2, 1.1, Math.max(0, 1 - (t - d.takenAt - 2.5)), true);
        continue;
      }
      if (d.opened >= 0) {
        // Delivered: unfolded a moment, a few lines of a hand on it, then put away.
        const k = (t - d.opened) / 2.5;
        const s = 1 + Math.min(1, k * 4) * 0.9;
        ctx.save();
        ctx.translate(d.x + 14, d.y - 18);
        ctx.rotate(-0.08);
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) * 2.5);
        ctx.fillStyle = 'rgba(40,25,10,0.2)';
        ctx.fillRect(-9 * s + 1.5, -6 * s + 1.5, 18 * s, 12 * s);
        ctx.fillStyle = '#f6eedb';
        ctx.fillRect(-9 * s, -6 * s, 18 * s, 12 * s);
        ctx.strokeStyle = hexA(INK, 0.6);
        ctx.lineWidth = 0.6;
        ctx.strokeRect(-9 * s, -6 * s, 18 * s, 12 * s);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const yy = -3.5 * s + i * 2.4 * s;
          ctx.moveTo(-7 * s, yy);
          for (let j = 0; j < 6; j++) ctx.lineTo(-7 * s + (j + 1) * 2.2 * s, yy + (hash(d.seed, i, j) - 0.5) * 1.2);
        }
        ctx.stroke();
        ctx.restore();
        continue;
      }
      // On the road: a dotted line behind the rider, the letter riding along.
      ctx.save();
      ctx.strokeStyle = hexA(d.realm.color, 0.35);
      ctx.lineWidth = 0.9;
      ctx.setLineDash([1.5, 3]);
      ctx.beginPath();
      ctx.moveTo(d.x0, d.y0);
      ctx.quadraticCurveTo((d.x0 + d.x) / 2 + (hash(d.seed) - 0.5) * 30, (d.y0 + d.y) / 2, d.x, d.y);
      ctx.stroke();
      ctx.restore();
      letter(d.x, d.y - 6, Math.sin(t * 6 + d.seed) * 0.12, 1, 1, false);
    }
  }

  // ---- the fog of war ---------------------------------------------------------------------------

  /**
   * The map is kept by the first realm's war council. What it cannot see is blank paper with
   * the coast and towns sketched in pencil; enemy armies there are only where they were last
   * reported, marked in pencil with a question.
   */
  let pencil: { n: number; W: number; H: number; c: HTMLCanvasElement } | null = null;
  let fogLayer: { c: HTMLCanvasElement; g: CanvasRenderingContext2D; W: number; H: number; at: number } | null = null;
  let holeSprite: HTMLCanvasElement | null = null;
  const lastSeen = new Map<number, { x: number; y: number; t: number; color: string; kind: Token['kind'] }>();

  function paintPencil() {
    const { c, g } = canvas(W, H, 1);
    g.drawImage(paper!.c, 0, 0, W, H);
    // Graphite hatching, light, over the unknown.
    g.strokeStyle = 'rgba(80,80,90,0.07)';
    g.lineWidth = 0.8;
    g.beginPath();
    for (let k = -H; k < W; k += 9) {
      g.moveTo(k, H);
      g.lineTo(k + H, 0);
    }
    g.stroke();
    // The coast, in pencil.
    const cell = 6;
    const cols = Math.ceil(W / cell) + 1;
    const rows = Math.ceil(H / cell) + 1;
    const v = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = world.elevAt(i * cell, j * cell);
    g.strokeStyle = 'rgba(70,70,80,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    isoPath(g, v, cols, rows, cell, 0);
    g.stroke();
    // Towns as pencil rings, names faint.
    g.font = serif(11, true);
    g.textAlign = 'center';
    for (const t of world.towns) {
      g.strokeStyle = 'rgba(70,70,80,0.5)';
      g.beginPath();
      g.arc(t.x, t.y - 4, t.capital ? 6 : 4.5, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(70,70,80,0.45)';
      g.fillText(titled(t.name), t.x, t.y + 14);
    }
    pencil = { n: world.n, W, H, c };
  }

  /** What the council can see: around its towns, its armies, its riders, and armies laid bare. */
  function known(): [number, number, number][] {
    const us = world.realms[0];
    const out: [number, number, number][] = [];
    const m = Math.min(W, H);
    if (!us) return out;
    for (const t of world.towns) {
      if (t.owner === us) out.push([t.x, t.y, m * (t.capital ? 0.28 : 0.21)]);
      // Enemy towns on a road from ours are watched by scouts.
      else if (t.links.some((l) => l.owner === us)) out.push([t.x, t.y, m * 0.1]);
    }
    for (const k of world.tokens) if (k.realm === us && k.fallenAt < 0) out.push([k.x, k.y, m * 0.17]);
    for (const d of world.dispatches) if (d.realm === us && d.opened < 0 && !d.taken) out.push([d.x, d.y, 50]);
    for (const k of world.tokens) if (world.revealed.has(k.id) && k.fallenAt < 0) out.push([k.x, k.y, 60]);
    return out;
  }

  function fog(t: number) {
    if (!o.fog || world.realms.length < 2) return;
    if (!pencil || pencil.n !== world.n || pencil.W !== W || pencil.H !== H) paintPencil();
    if (!holeSprite) {
      holeSprite = document.createElement('canvas');
      holeSprite.width = holeSprite.height = 64;
      const g = holeSprite.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.62, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    const seen = known();
    // Redrawn four times a second: the edge of the known moves slowly.
    if (!fogLayer || fogLayer.W !== W || fogLayer.H !== H || t - fogLayer.at > 0.25 || t < fogLayer.at) {
      if (!fogLayer || fogLayer.W !== W || fogLayer.H !== H) {
        const c = document.createElement('canvas');
        c.width = Math.ceil(W / 2);
        c.height = Math.ceil(H / 2);
        fogLayer = { c, g: c.getContext('2d')!, W, H, at: t };
      }
      const g = fogLayer.g;
      g.setTransform(0.5, 0, 0, 0.5, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.drawImage(pencil!.c, 0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      for (const [x, y, rr] of seen) g.drawImage(holeSprite, x - rr, y - rr, rr * 2, rr * 2);
      // The title and the legend are always legible.
      g.fillRect(0, 0, 360, 90);
      g.fillRect(W - 300, 0, 300, 100);
      g.globalCompositeOperation = 'source-over';
      fogLayer.at = t;
    }
    // Who is seen now; the rest are where they were last reported.
    const inSight = (x: number, y: number) => seen.some(([sx, sy, rr]) => Math.hypot(sx - x, sy - y) < rr * 0.8);
    for (const k of world.tokens) {
      if (k.fallenAt >= 0) {
        lastSeen.delete(k.id);
        continue;
      }
      if (k.realm === world.realms[0]) continue;
      if (inSight(k.x, k.y)) lastSeen.set(k.id, { x: k.x, y: k.y, t, color: k.realm.color, kind: k.kind });
    }
    ctx.drawImage(fogLayer.c, 0, 0, W, H);
    ctx.save();
    ctx.font = serif(11, true);
    ctx.textAlign = 'center';
    for (const [id, s] of lastSeen) {
      const k = world.tokens.find((x) => x.id === id);
      if (!k || inSight(k.x, k.y)) continue;
      const age = t - s.t;
      const a = Math.max(0, 1 - age / (MONTH_S * 5));
      if (a <= 0) {
        lastSeen.delete(id);
        continue;
      }
      ctx.strokeStyle = `rgba(70,70,80,${(0.6 * a).toFixed(3)})`;
      ctx.lineWidth = 0.9;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(s.x - 7, s.y - 7, 14, 14);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(70,70,80,${(0.7 * a).toFixed(3)})`;
      ctx.fillText('?', s.x, s.y + 4);
    }
    ctx.restore();
  }

  // ---- the light of the seasons ---------------------------------------------------------------

  /** Each month's light on the table: cold in winter, fresh in spring, gold in summer, amber in autumn. */
  const LIGHT = ['#c4cfe2', '#c9d3e3', '#d6dccf', '#dfe6c8', '#e6e8c8', '#fbe2b0', '#ffdca2', '#ffd9a0', '#f6cf98', '#f0c08e', '#e2c1a2', '#ccd3e0'];
  let lightRGB: [number, number, number] | null = null;

  function seasons(t: number) {
    const want = mixRgb(LIGHT[world.month], LIGHT[world.month], 0);
    lightRGB = lightRGB ? (lightRGB.map((v, i) => v + (want[i] - v) * 0.02) as [number, number, number]) : want;
    const [lr, lg, lb] = lightRGB.map((v) => v | 0);
    // The whole table takes the season's color.
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(${lr},${lg},${lb},0.55)`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // Light through a window: a skewed pane drifting across the table as the days go by,
    // the mullions' shadows across it. Brighter and longer in summer.
    const summer = [5, 6, 7].includes(world.month);
    const winter = [11, 0, 1].includes(world.month);
    const drift = ((t / (MONTH_S * 3)) % 1) * 0.6;
    const px = W * (0.08 + drift);
    const py = H * 0.12;
    const pw = W * (summer ? 0.3 : winter ? 0.2 : 0.25);
    const ph = H * (summer ? 0.62 : 0.5);
    const skew = pw * 0.45;
    // Painted tiny and laid over large: the window's light has soft edges, as real light does.
    if (!pane) {
      const c = document.createElement('canvas');
      pane = { c, g: c.getContext('2d')! };
    }
    const k = 1 / 10;
    const pwc = Math.ceil(W * k);
    const phc = Math.ceil(H * k);
    if (pane.c.width !== pwc || pane.c.height !== phc) {
      pane.c.width = pwc;
      pane.c.height = phc;
    }
    const g = pane.g;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, W, H);
    const quad = (x: number, y: number, w: number, h: number, sk: number) => {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y);
      g.lineTo(x + w + sk, y + h);
      g.lineTo(x + sk, y + h);
      g.closePath();
    };
    g.fillStyle = `rgba(${lr},${lg},${lb},1)`;
    quad(px, py, pw, ph, skew);
    g.fill();
    // The mullions' shadow: a cross through the pane.
    g.globalCompositeOperation = 'destination-out';
    quad(px + pw * 0.47, py, pw * 0.06, ph, skew);
    g.fill();
    quad(px + skew * 0.48, py + ph * 0.48, pw, ph * 0.05, skew * 0.05);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = summer ? 0.2 : winter ? 0.1 : 0.14;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pane.c, 0, 0, W, H);
    ctx.restore();
  }
  let pane: { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;

  /** Autumn: a few leaves blown in through the window, lying on the map. */
  function leaves(t: number) {
    if (![8, 9, 10].includes(world.month)) return;
    const n = 2 + ((world.month - 8) * 2);
    for (let i = 0; i < n; i++) {
      const x = hash(world.n, world.year, i * 3) * W;
      const y = hash(world.n, world.year, i * 3 + 1) * H;
      const a = hash(world.n, world.year, i * 3 + 2) * Math.PI * 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = ['#b45309', '#9a3412', '#a16207'][i % 3];
      ctx.strokeStyle = hexA(INK, 0.5);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.quadraticCurveTo(-3, -6, 7, 0);
      ctx.quadraticCurveTo(-3, 6, -9, 0);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.restore();
    }
    void t;
  }

  /** A realm's arms on a small shield: a crown, a tower, a star, or an oak. */
  function arms(x: number, y: number, color: string, kind: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = hexA(INK, 0.85);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo(6, -7);
    ctx.lineTo(6, 0);
    ctx.quadraticCurveTo(6, 6, 0, 8);
    ctx.quadraticCurveTo(-6, 6, -6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4ead3';
    if (kind === 'lion') {
      ctx.beginPath();
      ctx.moveTo(-3.5, 1.5);
      ctx.lineTo(-3.5, -3);
      ctx.lineTo(-1.5, -0.5);
      ctx.lineTo(0, -3.5);
      ctx.lineTo(1.5, -0.5);
      ctx.lineTo(3.5, -3);
      ctx.lineTo(3.5, 1.5);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'tower') {
      ctx.fillRect(-2, -3, 4, 6);
      ctx.fillRect(-3, -4.5, 1.5, 2);
      ctx.fillRect(-0.75, -4.5, 1.5, 2);
      ctx.fillRect(1.5, -4.5, 1.5, 2);
    } else if (kind === 'star') star(ctx, 0, -0.5, 4);
    else {
      ctx.beginPath();
      ctx.arc(0, -1.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-0.6, 1, 1.2, 3);
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
    // Newest first: a new note has the place; an older one written at the same spot gives way
    // (it fades as the new one is written), and an old one with no room left is not written.
    const placed: [number, number, number][] = [];
    const spoken: { x: number; y: number; t0: number }[] = [];
    const live = world.notes.filter((n) => t - n.t0 >= 0 && t - n.t0 < 26).reverse();
    for (const [k, n] of live.entries()) {
      const age = t - n.t0;
      let a = Math.min(1, age * 1.5) * Math.max(0, Math.min(1, (26 - age) / 6)) * level;
      const newer = spoken.find((s) => Math.hypot(s.x - n.x, s.y - n.y) < 110);
      spoken.push({ x: n.x, y: n.y, t0: n.t0 });
      if (newer) a *= Math.max(0, 1 - (t - newer.t0) / 1.5);
      if (a <= 0.01 || k >= 6) continue;
      const chars = Math.floor(age * 24);
      const text = n.text.slice(0, chars);
      const w = ctx.measureText(n.text).width;
      const x = Math.max(w / 2 + 16, Math.min(W - w / 2 - 16, n.x));
      const y0 = Math.max(70, Math.min(H - 40, n.y));
      const clash = (y: number) => placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18);
      // Where there is room: on the spot, then just above or below it.
      const y = [0, -19, 19, -38, 38].map((d) => y0 + d).find((yy) => yy > 60 && yy < H - 30 && !clash(yy));
      if (y === undefined && k > 0) continue;
      const yy = y ?? y0;
      placed.push([x, yy, w]);
      ctx.save();
      ctx.translate(x, yy);
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
      const ty = 32 + i * 20;
      ctx.fillStyle = hexA(INK, (rl.out ? 0.45 : 0.9) * level);
      ctx.fillText(`${titled(rl.short)}, ${held} town${held === 1 ? '' : 's'}${rl.out ? ' (yielded)' : ''}`, W - 44, ty);
      arms(W - 32, ty - 4, rl.color, rl.arms);
    });
    // Whose map this is.
    if (o.fog && world.realms[0]) {
      ctx.textAlign = 'center';
      ctx.font = serif(10, true);
      ctx.fillStyle = hexA(INK, 0.6 * level);
      ctx.fillText(`as kept by the council of ${titled(world.realms[0].short)}`, x + w / 2, y + h + 13);
    }
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
      pencil = null;
      fogLayer = null;
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
      letters(t);
      dragon(t);
      fog(t);
      leaves(t);
      for (const b of world.blots) if (b.kind === 'seal') blot(b, t);
      seasons(t);
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
