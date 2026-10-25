/**
 * The map view: the dock's defence command plot of the same coast, from above, as it would glow
 * on the big table in the control room.
 *
 * The bay laid flat: the dock at the foot of the plot, the sea running out to the rift at the top,
 * the far shore with the city's blocks (amber by night, dark where they fell), the bridge, the
 * soundings as contour lines. The radar on the dock's tower sweeps round and the contacts glow
 * as it passes: a monster as a red diamond with its track behind it and its course projected to
 * the harbour, mechs as blue chevrons, the lift team and the patrols as small marks, ships, and
 * the bones and wrecks left in the bay. The breach clock in the corner; a short log, typed.
 */
import { fitText } from '../../../kit';
import { fillCrisp, hash } from '../../instruments/kit';
import { vnoise } from '../sandsea/terrain';
import { clamp01, hexA, mix, mk, MOODS } from './look';
import type { DockWorld } from './types';

const MONO = (px: number, weight = 500) => `${weight} ${px}px "JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace`;

export function createMap(ctx: CanvasRenderingContext2D, w: DockWorld, seed: number) {
  const M = MOODS[w.mood];
  const ink = '#03101a';
  const phos = w.mood === 'grey' ? '#9ae8ff' : w.mood === 'violet' ? '#8af0ff' : '#5ef2c8';
  const amber = '#ffb04a';
  const red = '#ff5a48';
  const blue = '#6ab8ff';
  let base: HTMLCanvasElement | null = null;
  let baseKey = '';
  const trails = new Map<number, [number, number][]>();
  let lastTrail = -1;

  /** The plot's frame on the screen: the bay from the dock (bottom) to the rift (top). */
  const frame = (W: number, H: number) => {
    const top = Math.max(60, H * 0.1);
    const bottom = H - Math.max(56, H * 0.08);
    const left = 24;
    const right = W - 24;
    return { left, right, top, bottom };
  };
  const P = (x: number, d: number, W: number, H: number): [number, number] => {
    const f = frame(W, H);
    const cx = w.flip ? w.GW - x : x;
    // The near water stretched (the fights are there), the far water pressed toward the rift.
    return [f.left + (cx / w.GW) * (f.right - f.left), f.bottom - Math.pow(clamp01(d), 0.6) * (f.bottom - f.top)];
  };

  function bake(W: number, H: number) {
    base ??= mk(W, H);
    if (base.width !== W || base.height !== H) {
      base.width = W;
      base.height = H;
    }
    const g = base.getContext('2d')!;
    const f = frame(W, H);
    g.fillStyle = ink;
    g.fillRect(0, 0, W, H);
    // Soundings: depth from noise, deeper toward the rift; the water shaded by depth, contours as lines of phosphor.
    const res = 6;
    const cols = Math.ceil(W / res) + 1;
    const rows = Math.ceil(H / res) + 1;
    const depth = (px: number, py: number) => {
      const d = clamp01((f.bottom - py) / (f.bottom - f.top));
      return d * 7 + vnoise(px / 150, py / 150, seed) * 2.4 + vnoise(px / 55, py / 55, seed + 3) * 0.7;
    };
    const D = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) D[j * cols + i] = depth(i * res, j * res);
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < cols - 1; i++) {
        const v = D[j * cols + i];
        g.fillStyle = `rgb(${3},${Math.round(16 + v * 2.2)},${Math.round(26 + v * 4)})`;
        g.fillRect(i * res, j * res, res, res);
      }
    // Marching squares, one level every half unit of depth; every fourth a little brighter.
    for (let lv = 0.5; lv < 10; lv += 0.5) {
      const major = Math.round(lv * 2) % 4 === 0;
      g.strokeStyle = hexA(phos, major ? 0.3 : 0.12);
      g.lineWidth = major ? 1.1 : 0.8;
      g.beginPath();
      for (let j = 0; j < rows - 1; j++)
        for (let i = 0; i < cols - 1; i++) {
          const a0 = D[j * cols + i] - lv;
          const a1 = D[j * cols + i + 1] - lv;
          const a2 = D[(j + 1) * cols + i + 1] - lv;
          const a3 = D[(j + 1) * cols + i] - lv;
          const pts: [number, number][] = [];
          const x0 = i * res;
          const y0 = j * res;
          if (a0 * a1 < 0) pts.push([x0 + (res * a0) / (a0 - a1), y0]);
          if (a1 * a2 < 0) pts.push([x0 + res, y0 + (res * a1) / (a1 - a2)]);
          if (a2 * a3 < 0) pts.push([x0 + res - (res * a2) / (a2 - a3), y0 + res]);
          if (a3 * a0 < 0) pts.push([x0, y0 + res - (res * a3) / (a3 - a0)]);
          if (pts.length >= 2) {
            g.moveTo(pts[0][0], pts[0][1]);
            g.lineTo(pts[1][0], pts[1][1]);
            if (pts.length === 4) {
              g.moveTo(pts[2][0], pts[2][1]);
              g.lineTo(pts[3][0], pts[3][1]);
            }
          }
        }
      g.stroke();
    }
    // Depth figures, small, here and there.
    g.font = MONO(8, 500);
    g.fillStyle = hexA(phos, 0.35);
    for (let k = 0; k < 18; k++) {
      const px = f.left + hash(k, 1, seed) * (f.right - f.left);
      const py = f.top + hash(k, 2, seed) * (f.bottom - f.top);
      g.fillText(String(Math.round(depth(px, py) * 12)), px, py);
    }
    // The far shore: land beyond the coastline, ragged.
    g.fillStyle = '#0c1a16';
    g.beginPath();
    const coast: [number, number][] = [];
    for (let d = -0.05; d <= 1.02; d += 0.01) {
      const [x, y] = P(w.coastX(d) + (vnoise(d * 30, 0, seed + 5) - 0.5) * 40 * w.u, d, W, H);
      coast.push([x, y]);
    }
    const edgeX = w.flip ? -10 : W + 10;
    g.moveTo(edgeX, coast[0][1]);
    for (const [x, y] of coast) g.lineTo(x, y);
    g.lineTo(edgeX, coast[coast.length - 1][1]);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = hexA(amber, 0.07);
    g.lineWidth = 1;
    for (let k = -H; k < W + H; k += 7) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k - H, H);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = hexA(amber, 0.18);
    g.lineWidth = 5;
    g.beginPath();
    coast.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.strokeStyle = hexA(amber, 0.6);
    g.lineWidth = 1.2;
    g.beginPath();
    coast.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    // The near shore under the dock, and the dock itself.
    const [, by] = P(0, 0, W, H);
    g.fillStyle = '#0c1a16';
    g.fillRect(0, by, W, H - by);
    g.strokeStyle = hexA(amber, 0.6);
    g.beginPath();
    g.moveTo(0, by);
    g.lineTo(W, by);
    g.stroke();
    const [dx0, dy0] = P(w.x0, 0, W, H);
    const [dx1] = P(w.apronX, 0, W, H);
    g.strokeStyle = hexA(phos, 0.85);
    g.lineWidth = 1.5;
    g.strokeRect(Math.min(dx0, dx1), dy0 - 6, Math.abs(dx1 - dx0), 22);
    for (const q of w.bays) {
      const [qx] = P(q.x, 0, W, H);
      const [qw] = P(q.x + q.w * 0.4, 0, W, H);
      g.strokeRect(Math.min(qx, qw) - Math.abs(qw - qx), dy0 - 2, Math.abs(qw - qx) * 2, 14);
    }
    // Range rings and bearings from the dock's radar.
    const [rx, ry] = radarAt(W, H);
    g.strokeStyle = hexA(phos, 0.12);
    g.lineWidth = 1;
    const R = Math.hypot(W, H);
    g.font = MONO(8, 500);
    g.fillStyle = hexA(phos, 0.4);
    for (let k = 1; k < 9; k++) {
      g.beginPath();
      g.arc(rx, ry, (k * R) / 8, Math.PI, Math.PI * 2);
      g.stroke();
      g.fillText(`${k * 4} KM`, rx + 4, ry - (k * R) / 8 - 3);
    }
    for (let a = 0; a < 180; a += 15) {
      const ang = Math.PI + (a / 180) * Math.PI;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + Math.cos(ang) * R, ry + Math.sin(ang) * R);
      g.stroke();
    }
    // A grid, faint, and ticks on the frame.
    g.strokeStyle = hexA(phos, 0.05);
    for (let x = f.left; x < f.right; x += 40) {
      g.beginPath();
      g.moveTo(x, f.top - 20);
      g.lineTo(x, f.bottom);
      g.stroke();
    }
    g.fillStyle = hexA(phos, 0.5);
    for (let x = f.left; x <= f.right; x += 40) g.fillRect(x, f.top - 24, 1, 6);
    baseKey = `${W}x${H}`;
  }
  const radarAt = (W: number, H: number): [number, number] => P(w.x0 + 80 * w.u, 0, W, H);

  function paint(t: number, W: number, H: number) {
    if (!base || baseKey !== `${W}x${H}`) bake(W, H);
    ctx.drawImage(base!, 0, 0);
    const [rx, ry] = radarAt(W, H);
    const ang = (t * 0.8) % (Math.PI * 2);
    const R = Math.hypot(W, H);
    // The sweep: a wedge of phosphor trailing the beam round.
    ctx.save();
    const cg = ctx.createConicGradient(ang - 0.9, rx, ry);
    cg.addColorStop(0, hexA(phos, 0));
    cg.addColorStop(0.142, hexA(phos, 0.16));
    cg.addColorStop(0.1435, hexA(phos, 0));
    cg.addColorStop(1, hexA(phos, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = hexA(phos, 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(ang) * R, ry + Math.sin(ang) * R);
    ctx.stroke();
    ctx.restore();
    const lit = (x: number, y: number) => {
      const a = Math.atan2(y - ry, x - rx);
      const behind = (((ang - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      return 0.4 + 0.6 * Math.exp(-behind * 1.4);
    };
    const labels: { x: number; y: number; text: string; color: string; pri: number }[] = [];
    // The city's blocks: amber squares, dark where they fell.
    for (const b of w.buildings) {
      const [x, y] = P(b.x, b.d, W, H);
      const s = Math.min(7, Math.max(2, (b.w / w.GW) * W * 0.3 * (0.5 + w.mOf(b.d))));
      if (b.fall >= 1) {
        ctx.strokeStyle = hexA(red, 0.6);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s);
        ctx.lineTo(x + s, y + s);
        ctx.moveTo(x + s, y - s);
        ctx.lineTo(x - s, y + s);
        ctx.stroke();
      } else {
        if (b.kind === 'rig') {
          ctx.strokeStyle = hexA(phos, 0.8 * lit(x, y));
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x - 6, y - 6, 12, 12);
          ctx.beginPath();
          ctx.moveTo(x - 6, y - 6);
          ctx.lineTo(x + 6, y + 6);
          ctx.moveTo(x + 6, y - 6);
          ctx.lineTo(x - 6, y + 6);
          ctx.stroke();
          labels.push({ x, y: y + 14, text: 'RIG', color: phos, pri: 0.3 });
          continue;
        }
        ctx.fillStyle = hexA(b.kind === 'stack' || b.kind === 'tank' ? '#ff8a4a' : amber, (b.kind === 'house' ? 0.45 : 0.6) * (1 - w.evac * 0.5) * (b.fall > 0 ? 0.4 + 0.6 * Math.sin(t * 20) : 1));
        if (b.kind === 'tank') {
          ctx.beginPath();
          ctx.arc(x, y, s / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    // The bridge.
    if (w.bridge) {
      const [x0, y0] = P(w.bridgeX0, w.bridgeD, W, H);
      const [x1] = P(w.bridgeX1, w.bridgeD, W, H);
      ctx.strokeStyle = hexA(amber, 0.8);
      ctx.lineWidth = 2;
      ctx.setLineDash(w.bridgeBroken > 0 ? [10, 14] : []);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The rift: rings breathing at the top of the plot.
    const [qx, qy] = P(w.riftX, 0.96, W, H);
    const pulse = 0.4 + 0.3 * Math.sin(t * 1.4) + w.riftPulse * 0.8;
    for (let k = 0; k < 4; k++) {
      const rr = 10 + ((t * 14 + k * 12) % 48);
      ctx.strokeStyle = hexA(M.rift, clamp01(pulse) * (1 - rr / 58));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(qx, qy, rr * 1.8, rr * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    labels.push({ x: qx, y: qy + 22, text: 'THE RIFT', color: M.rift, pri: 2 });
    // Marks left in the bay.
    for (const k of w.marks) {
      const [x, y] = P(k.x, k.d, W, H);
      ctx.strokeStyle = hexA(k.kind === 'bones' ? '#d8d0b8' : blue, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (k.kind === 'bones') {
        ctx.moveTo(x - 5, y - 5);
        ctx.lineTo(x + 5, y + 5);
        ctx.moveTo(x + 5, y - 5);
        ctx.lineTo(x - 5, y + 5);
      } else {
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.moveTo(x - 7, y);
        ctx.lineTo(x + 7, y);
      }
      ctx.stroke();
      labels.push({ x, y: y + 15, text: k.kind === 'bones' ? `BONES OF ${k.name}` : `WRECK · ${k.name}`, color: '#a8b8c0', pri: 0.5 });
    }
    // Ships: dashes with their wakes.
    for (const s of w.ships) {
      if (s.state === 'held') continue;
      const [x, y] = P(s.x, s.d, W, H);
      const len = Math.max(4, (s.len / w.GW) * W * 0.6);
      ctx.strokeStyle = hexA('#c8d4d8', 0.55 * lit(x, y));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y);
      ctx.lineTo(x + len / 2, y);
      ctx.stroke();
    }
    // The engagement: a ring round the fight, ticked, while it lasts.
    for (const m of w.mechs) {
      if (m.state !== 'fight') continue;
      const q = w.monsters.find((z) => z.state === 'fight');
      if (!q) continue;
      const [ax, ay] = P(m.x, m.d, W, H);
      const [bx, by] = P(q.x, q.d, W, H);
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2;
      const rr = Math.min(90, Math.max(34, Math.hypot(ax - bx, ay - by) * 0.8));
      ctx.strokeStyle = hexA(red, 0.5 + 0.3 * Math.sin(t * 4));
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + t * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        ctx.lineTo(cx + Math.cos(a) * (rr + 8), cy + Math.sin(a) * (rr + 8));
        ctx.stroke();
      }
      labels.push({ x: cx, y: cy + rr + 12, text: 'ENGAGED', color: red, pri: 6 });
    }
    // Trails: where each contact has been (kept by the painter, a point every second).
    if (Math.floor(t) !== lastTrail) {
      lastTrail = Math.floor(t);
      for (const q of w.monsters) {
        const tr = trails.get(q.id) ?? [];
        tr.push([q.x, q.d]);
        if (tr.length > 60) tr.shift();
        trails.set(q.id, tr);
      }
      for (const m of w.mechs) {
        if (m.d <= 0.01) continue;
        const tr = trails.get(m.id) ?? [];
        tr.push([m.x, m.d]);
        if (tr.length > 40) tr.shift();
        trails.set(m.id, tr);
      }
    }
    const trail = (id: number, color: string) => {
      const tr = trails.get(id);
      if (!tr) return;
      tr.forEach(([x0, d0], i) => {
        const [x, y] = P(x0, d0, W, H);
        ctx.fillStyle = hexA(color, (0.15 + 0.5 * (i / tr.length)) * 0.8);
        ctx.fillRect(x - 1, y - 1, 2, 2);
      });
    };
    // Monsters: red diamonds, the course projected to the harbour, codename and category.
    for (const q of w.monsters) {
      if (q.state === 'gone') continue;
      const [x, y] = P(q.x, q.d, W, H);
      trail(q.id, red);
      const dead = q.state === 'dying' || q.state === 'carcass';
      const sz = 7 + q.cat * 1.6;
      const a = lit(x, y);
      if (!dead && q.state !== 'retreat') {
        const [tx, ty] = P(w.fightX(w.fightD), w.fightD, W, H);
        ctx.strokeStyle = hexA(red, 0.4);
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, y, 0, x, y, sz * 3);
      gr.addColorStop(0, hexA(dead ? '#7ae8ff' : red, 0.5 * a));
      gr.addColorStop(1, hexA(red, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(x - sz * 3, y - sz * 3, sz * 6, sz * 6);
      ctx.restore();
      ctx.strokeStyle = hexA(dead ? '#7ae8ff' : red, a);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y - sz);
      ctx.lineTo(x + sz, y);
      ctx.lineTo(x, y + sz);
      ctx.lineTo(x - sz, y);
      ctx.closePath();
      ctx.stroke();
      if (!dead) {
        ctx.fillStyle = hexA(red, 0.3 * a);
        ctx.fill();
      }
      labels.push({ x, y: y - sz - 8, text: `${q.name} · SURGE ${['', 'I', 'II', 'III', 'IV', 'V'][q.cat]}${dead ? ' · DOWN' : ''}`, color: dead ? '#7ae8ff' : red, pri: 5 });
    }
    // Mechs out of the dock: blue chevrons; in the dock, their bays light.
    for (const m of w.mechs) {
      if (m.state === 'lost') continue;
      const [x, y] = m.d > 0.01 ? P(m.x, m.d, W, H) : P(m.x, 0, W, H);
      if (m.d > 0.01) trail(m.id, blue);
      const a = lit(x, y);
      const dirX = (w.flip ? -1 : 1) * m.dir;
      ctx.strokeStyle = hexA(m.state === 'sinking' ? red : blue, a);
      ctx.fillStyle = hexA(blue, 0.25 * a);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + dirX * 9, y);
      ctx.lineTo(x - dirX * 6, y - 7);
      ctx.lineTo(x - dirX * 2, y);
      ctx.lineTo(x - dirX * 6, y + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const status = m.state === 'bay' ? (m.hp >= 1 ? 'READY' : `${Math.round(m.hp * 100)}%`) : m.state === 'building' ? `BUILDING ${Math.round(m.built * 100)}%` : m.state === 'fight' ? 'ENGAGED' : m.state === 'sinking' ? 'LOST' : m.state === 'victory' ? 'KILL' : 'UNDER WAY';
      labels.push({ x, y: m.d > 0.01 ? y + 18 : y + 28 + (m.bay % 2) * 12, text: `${m.name} · ${status}`, color: blue, pri: m.d > 0.01 ? 4 : 1 });
    }
    // Helicopters: the lift team and the patrols.
    for (const h of w.helis) {
      if (h.state === 'parked' && h.pad < 0) continue;
      const [x, y] = P(h.x, h.d, W, H);
      ctx.fillStyle = hexA(h.role === 'patrol' ? phos : '#e8eef2', 0.85 * lit(x, y));
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (h.role === 'patrol') {
        ctx.strokeStyle = hexA(phos, 0.25);
        ctx.beginPath();
        ctx.arc(x, y, 9 + Math.sin(t * 3 + h.seed) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // The fight: flashes where blows land.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of w.fx) {
      if (f.d < 0.05 || (f.kind !== 'flash' && f.kind !== 'firework' && f.kind !== 'flare')) continue;
      const [x, y] = P(f.x, f.d, W, H);
      const k = clamp01((w.t - f.t0) / f.dur);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 30 * (1 + k));
      gr.addColorStop(0, hexA(f.kind === 'flare' ? '#ff7040' : '#fff0c0', 0.5 * (1 - k)));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - 60, y - 60, 120, 120);
    }
    ctx.restore();
    // Labels, placed so they never overlap: the most important first.
    ctx.font = MONO(W < 600 ? 9 : 10, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const placed: [number, number, number, number][] = [];
    for (const l of labels.sort((a, b) => b.pri - a.pri)) {
      const tw = ctx.measureText(l.text).width + 8;
      let y = l.y;
      let ok = false;
      for (let k = 0; k < 4 && !ok; k++) {
        y = l.y + [0, 14, -28, 28][k];
        ok = !placed.some(([px, py, pw, ph]) => Math.abs(px - l.x) < (pw + tw) / 2 && Math.abs(py - y) < (ph + 13) / 2);
      }
      if (!ok) continue;
      const x = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, l.x));
      placed.push([x, y, tw, 13]);
      ctx.fillStyle = 'rgba(3,12,18,0.75)';
      ctx.fillRect(x - tw / 2, y - 7, tw, 14);
      ctx.fillStyle = hexA(l.color, 0.95);
      fillCrisp(ctx, l.text, x, y);
    }
    console_(t, W, H);
  }

  /** The console: the plot's title, the breach clock, the log. */
  function console_(t: number, W: number, H: number) {
    const small = W < 600;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = MONO(small ? 10 : 12, 700);
    ctx.fillStyle = hexA(phos, 0.9);
    fillCrisp(ctx, fitText(ctx, small ? `TITAN DOCK ${w.name}` : `TITAN DOCK ${w.name} · COASTAL DEFENCE PLOT`, W - 150), 18, 26);
    ctx.font = MONO(small ? 9 : 10, 500);
    ctx.fillStyle = hexA(phos, 0.55);
    const status = w.phase === 'quiet' ? 'CONDITION GREEN' : w.phase === 'alarm' ? 'BREACH ALERT' : w.phase === 'launch' ? 'LAUNCHING' : w.phase === 'fight' ? 'ENGAGED' : 'RECOVERY';
    fillCrisp(ctx, fitText(ctx, small ? `${status} · ${w.kills} KILLS · ${w.lost} LOST` : `${status} · KILLS ${w.kills} · LOST ${w.lost} · BREACHES ${w.breaches}`, W - 150), 18, 42);
    // The breach clock.
    ctx.textAlign = 'right';
    const sec = Math.max(0, Math.ceil(w.clock));
    const up = Math.max(0, Math.floor(w.t - w.breachT));
    const clock = w.phase === 'quiet' ? `T-${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : `T+${String(Math.floor(up / 60)).padStart(2, '0')}:${String(up % 60).padStart(2, '0')}`;
    ctx.font = MONO(small ? 18 : 26, 700);
    ctx.fillStyle = hexA(w.phase === 'quiet' && w.clock > 30 ? amber : red, 0.95);
    fillCrisp(ctx, clock, W - 18, small ? 30 : 36);
    ctx.font = MONO(small ? 8 : 9, 500);
    ctx.fillStyle = hexA(amber, 0.6);
    fillCrisp(ctx, w.phase === 'quiet' ? 'NEXT BREACH' : 'SINCE THE BREACH', W - 18, small ? 42 : 50);
    // The log: the last few entries, typed.
    ctx.textAlign = 'left';
    ctx.font = MONO(small ? 9 : 10, 500);
    const lines = w.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = w.t - l.t;
      const text = l.text.toUpperCase();
      const n = Math.min(text.length, Math.floor(age * 60));
      const stamp = `${String(Math.floor(l.t / 60)).padStart(3, '0')}:${String(Math.floor(l.t % 60)).padStart(2, '0')} `;
      ctx.fillStyle = hexA(phos, i === lines.length - 1 ? 0.85 : 0.45);
      fillCrisp(ctx, fitText(ctx, stamp + text.slice(0, n) + (n < text.length && Math.floor(t * 6) % 2 ? '▌' : ''), W - 36), 18, H - 16 - (lines.length - 1 - i) * 15);
    });
    void hash;
    void mix;
  }

  return {
    paint,
    project: (x: number, y: number, W: number, H: number): [number, number] => {
      const d = clamp01(1 - Math.sqrt(clamp01((y - w.HY) / (w.NY - w.HY))));
      return P(x, y < w.HY ? 0.98 : d, W, H);
    },
    unproject: (x: number, y: number, W: number, H: number): [number, number] => {
      const f = frame(W, H);
      const cx = ((x - f.left) / (f.right - f.left)) * w.GW;
      const d = Math.pow(clamp01((f.bottom - y) / (f.bottom - f.top)), 1 / 0.6);
      return [w.flip ? w.GW - cx : cx, w.yOf(d)];
    },
  };
}
