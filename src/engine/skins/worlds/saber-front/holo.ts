/**
 * Saber Front on the holo-table: the same battle as a commander sees it, projected in blue light over
 * a dark table in a command post.
 *
 * The field from above in contour lines and a survey grid; the front as a glowing sawtooth between
 * the two armies' washes of colour (blue for the Grand Army, amber for the droids); troopers as
 * chevrons in their squads, droids as ticks in their ranks, the fallen as fading crosses; walkers as
 * their own glyphs with their guns' arcs; gunships and landers with their trails and their plotted
 * courses (the unflown part of the same path, as on the sector map); shells as dotted arcs with an
 * impact ring counting down; blasts as rings; the dome; the knights as bright diamonds; the standards
 * where ground was taken. Overhead, the dogfights as paired sparks. The projector flickers and
 * scans; the table's rim frames it. A log of the engagements runs in the corner, and the clock.
 */
import type { SkinHost } from '../../../core/skin';
import { fillCrisp, hash } from '../../instruments/kit';
import { FIELDS } from './fields';
import { clamp01, fbm, hexA, mix, mk } from './scene';
import { dogfightAt } from './sim';
import type { SaberWorld, Side } from './types';

const HOLO = '#7fd6ff';
const GA = '#5ab8ff';
const CF = '#ffa050';
const SANS = (px: number, weight = 500) => `${weight} ${px}px "Avenir Next", "Futura", "Century Gothic", "Segoe UI", ui-sans-serif, sans-serif`;
const MONO = (px: number) => `${px}px "SFMono-Regular", "Menlo", "Consolas", ui-monospace, monospace`;

export function createHolo(host: SkinHost, world: SaberWorld, o: { labels: boolean; hud: boolean }) {
  const ctx = host.ctx;
  const { GW, u } = world;
  const fOf = (d: number) => 0.3 + 0.7 * Math.pow(1 - clamp01(d), 2);
  const gx = (sx: number, d: number) => GW / 2 + (sx - GW / 2) / fOf(d);
  // The plotted ground: across, the field as the picture shows it at middle distance; into the distance, d.
  const X0 = gx(-0.05 * GW, 0.32);
  const X1 = gx(1.05 * GW, 0.32);
  const D0 = -0.02;
  const D1 = 0.74;
  let W = 0;
  let H = 0;
  let box = { x: 0, y: 0, w: 1, h: 1 };
  let table: HTMLCanvasElement | null = null;
  let tw = 0;
  let th = 0;
  const trails = new Map<number, [number, number][]>();
  const layout = (w: number, h: number) => {
    W = w;
    H = h;
    const small = w < 600;
    const mx = small ? 14 : Math.max(40, w * 0.05);
    const top = small ? 84 : 76;
    const bottom = small ? 92 : 70;
    box = { x: mx, y: top, w: w - mx * 2, h: h - top - bottom };
    Z = Math.max(1.1, Math.min(2, Math.min(box.w, box.h * 1.6) / 600));
  };
  const MX = (x: number) => box.x + ((x - X0) / (X1 - X0)) * box.w;
  const MY = (d: number) => box.y + box.h - ((d - D0) / (D1 - D0)) * box.h;
  /** Map size of a ground length (for rings and glyphs): the plot's scale, never under a pixel. */
  const ML = (len: number) => Math.max(1, (len / (X1 - X0)) * box.w);
  /** Glyph size: bigger on a big table. */
  let Z = 1;

  function bakeTable() {
    tw = W;
    th = H;
    table = mk(W, H);
    const g = table.getContext('2d')!;
    // The table: dark metal, a little light from the projector in the middle, the rim and its lamps.
    g.fillStyle = '#05080d';
    g.fillRect(0, 0, W, H);
    const pg = g.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.hypot(W, H) * 0.6);
    pg.addColorStop(0, 'rgba(40,90,130,0.35)');
    pg.addColorStop(0.6, 'rgba(10,30,50,0.2)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pg;
    g.fillRect(0, 0, W, H);
    // The rim: a bevelled frame with panel seams and small status lamps.
    g.strokeStyle = 'rgba(120,150,170,0.18)';
    g.lineWidth = 2;
    g.strokeRect(box.x - 10, box.y - 10, box.w + 20, box.h + 20);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 6;
    g.strokeRect(box.x - 15, box.y - 15, box.w + 30, box.h + 30);
    for (let i = 0; i < 18; i++) {
      const x = box.x + (i / 17) * box.w;
      g.fillStyle = i % 5 === 0 ? 'rgba(255,170,80,0.55)' : 'rgba(120,200,255,0.35)';
      g.fillRect(x - 1, box.y + box.h + 13, 2, 2);
    }
    // The hologram's ground: contour lines of the field, the survey grid, the far things at its top edge.
    const s = Math.floor(hash(world.place.length, 3) * 1e5);
    const cols = Math.ceil(box.w / 3);
    const rows = Math.ceil(box.h / 3);
    const field: number[] = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const x = X0 + (i / cols) * (X1 - X0);
        const d = D1 - (j / rows) * (D1 - D0);
        field.push(fbm(x / (260 * u), (d * 1400) / 260, s, 4));
      }
    g.save();
    g.beginPath();
    g.rect(box.x, box.y, box.w, box.h);
    g.clip();
    g.fillStyle = 'rgba(30,80,120,0.12)';
    g.fillRect(box.x, box.y, box.w, box.h);
    // Contours: a marching-squares sketch, one level at a time.
    for (let lev = 0.3; lev < 0.75; lev += 0.05) {
      g.strokeStyle = hexA(HOLO, Math.abs(lev - 0.5) < 0.03 ? 0.22 : 0.1);
      g.lineWidth = 1;
      g.beginPath();
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const a = field[j * (cols + 1) + i] > lev ? 1 : 0;
          const b = field[j * (cols + 1) + i + 1] > lev ? 1 : 0;
          const c = field[(j + 1) * (cols + 1) + i] > lev ? 1 : 0;
          if (a !== b || a !== c) {
            const x = box.x + i * 3;
            const y = box.y + j * 3;
            g.moveTo(x, y + 1.5);
            g.lineTo(x + 3, y + 1.5 + (b - c) * 1.5);
          }
        }
      g.stroke();
    }
    // The survey grid, finer near.
    g.strokeStyle = hexA(HOLO, 0.07);
    for (let i = 0; i <= 16; i++) {
      const x = box.x + (i / 16) * box.w;
      g.beginPath();
      g.moveTo(x, box.y);
      g.lineTo(x, box.y + box.h);
      g.stroke();
    }
    for (let j = 0; j <= 10; j++) {
      const y = box.y + (j / 10) * box.h;
      g.beginPath();
      g.moveTo(box.x, y);
      g.lineTo(box.x + box.w, y);
      g.stroke();
    }
    // The field's own features, in outline.
    const F = world.style;
    const R = host.fork('holo-table');
    g.strokeStyle = hexA(HOLO, 0.28);
    g.fillStyle = hexA(HOLO, 0.05);
    if (F === 'platform') {
      // The deck's edge and the sea beyond it, hatched.
      const ey = MY(0.8);
      g.fillStyle = hexA('#3a7aa8', 0.12);
      g.fillRect(box.x, box.y, box.w, ey - box.y);
      g.strokeStyle = hexA(HOLO, 0.4);
      g.beginPath();
      g.moveTo(box.x, ey);
      g.lineTo(box.x + box.w, ey);
      g.stroke();
      for (let i = 0; i < 60; i++) {
        const x = box.x + R() * box.w;
        const y = box.y + R() * (ey - box.y);
        g.strokeStyle = hexA(HOLO, 0.12);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 5, y - 2, x + 10, y);
        g.stroke();
      }
    } else if (F === 'crystal') {
      for (let i = 0; i < 40; i++) {
        const x = box.x + R() * box.w;
        const y = box.y + R() * box.h * 0.22;
        const w = 6 + R() * 18;
        const h = 6 + R() * 14;
        g.strokeStyle = hexA(HOLO, 0.25);
        g.strokeRect(x, y, w, h);
        g.fillStyle = hexA(HOLO, 0.06);
        g.fillRect(x, y, w, h);
      }
    } else if (F === 'jungle') {
      for (let i = 0; i < 70; i++) {
        const x = box.x + R() * box.w;
        const y = box.y + (R() < 0.6 ? R() * box.h * 0.2 : R() * box.h);
        const r = 3 + R() * 8;
        g.strokeStyle = hexA('#7aff9a', 0.14);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (F === 'canyon') {
      for (const side of [0, 1]) {
        g.strokeStyle = hexA(HOLO, 0.25);
        for (let i = 0; i < 40; i++) {
          const y = box.y + (i / 40) * box.h;
          const w = (0.06 + (1 - i / 40) * 0.12) * box.w;
          const x = side ? box.x + box.w - w : box.x;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + w, y + 4);
          g.stroke();
        }
      }
      g.strokeRect(box.x + box.w * 0.4, box.y + 6, box.w * 0.2, 14);
    } else {
      for (let i = 0; i < 30; i++) {
        const x = box.x + R() * box.w;
        const y = box.y + R() * box.h * 0.9;
        g.strokeStyle = hexA(HOLO, 0.22);
        g.beginPath();
        g.arc(x, y, 2 + R() * 3, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.restore();
    // The plate's edge glows.
    g.strokeStyle = hexA(HOLO, 0.5);
    g.lineWidth = 1.2;
    g.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
    for (const [cx, cy, dx, dy] of [[box.x, box.y, 1, 1], [box.x + box.w, box.y, -1, 1], [box.x, box.y + box.h, 1, -1], [box.x + box.w, box.y + box.h, -1, -1]] as [number, number, number, number][]) {
      g.strokeStyle = hexA(HOLO, 0.9);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx + dx * 14, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + dy * 14);
      g.stroke();
    }
  }

  const glow = (x: number, y: number, r: number, color: string, a: number) => {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, hexA(color, a));
    gr.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const sideC = (s: Side) => (s === 'ga' ? GA : CF);

  function paint(t: number, w: number, h: number) {
    if (w !== W || h !== H || !table || tw !== w || th !== h) {
      layout(w, h);
      bakeTable();
    }
    ctx.drawImage(table!, 0, 0);
    const small = W < 600;
    const flick = 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 3.1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    // The two armies' ground, and the front between them as a sawtooth of light.
    const fx = MX(world.front);
    const gaLeft = world.gaDir > 0;
    const wash = (x0: number, x1: number, col: string) => {
      const gr = ctx.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, hexA(col, 0.03));
      gr.addColorStop(1, hexA(col, 0.2));
      ctx.fillStyle = gr;
      ctx.fillRect(Math.min(x0, x1), box.y, Math.abs(x1 - x0), box.h);
    };
    wash(gaLeft ? box.x : box.x + box.w, fx, GA);
    wash(gaLeft ? box.x + box.w : box.x, fx, CF);
    ctx.globalCompositeOperation = 'lighter';
    for (const [col, off] of [[GA, gaLeft ? -2 : 2], [CF, gaLeft ? 2 : -2]] as [string, number][]) {
      ctx.strokeStyle = hexA(col, 0.6 * flick);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let j = 0; j <= 30; j++) {
        const d = D0 + (j / 30) * (D1 - D0);
        const x = MX(world.front + Math.sin(j * 1.7 + t * 0.4) * 12 * u * (1 + d)) + off + (j % 2 ? 4 : -4);
        if (j === 0) ctx.moveTo(x, MY(d));
        else ctx.lineTo(x, MY(d));
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'source-over';
    // Scorches: where the shells have fallen, burnt rings that stay.
    for (const s of world.scorches) {
      const age = world.t - s.t0;
      ctx.strokeStyle = hexA(HOLO, 0.06 + 0.12 * clamp01(1 - age / 300));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(MX(s.x), MY(s.d), ML(s.r) * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The dome.
    const sh = world.shield;
    if (sh && sh.up > 0.02) {
      const cx = MX(sh.x);
      const cy = MY(sh.d);
      const rx = ML(sh.r);
      const ry = (sh.r / 1400 / (D1 - D0)) * box.h;
      ctx.fillStyle = hexA('#7ab8ff', 0.08 * sh.up + sh.flick * 0.08);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * sh.up, ry * sh.up, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexA('#9ad0ff', (0.45 + sh.flick * 0.4) * flick);
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexA('#9ad0ff', 0.7);
      ctx.strokeRect(MX(sh.gx) - 3, MY(sh.gd) - 3, 6, 6);
    }
    // Standards and wrecks: the marks the field keeps.
    for (const sd of world.standards) {
      const x = MX(sd.x);
      const y = MY(sd.d);
      ctx.strokeStyle = hexA(sideC(sd.side), 0.8);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 12);
      ctx.lineTo(x + 7, y - 9);
      ctx.lineTo(x, y - 6);
      ctx.stroke();
    }
    for (const wk of world.wrecks) {
      const x = MX(wk.x);
      const y = MY(wk.d);
      const r = wk.kind === 'roller' ? 3 : 7;
      ctx.strokeStyle = hexA('#9ab4c4', 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
      if (wk.smoke > 0.1) {
        ctx.strokeStyle = hexA('#9ab4c4', 0.15 * wk.smoke);
        ctx.beginPath();
        ctx.arc(x, y, r + 4 + ((t * 6) % 10), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // The fallen: crosses fading into the plot.
    for (const s of world.soldiers) {
      if (s.state !== 'dead') continue;
      const a = clamp01(1 - (world.t - s.t0) / 80) * 0.45;
      if (a <= 0.02) continue;
      ctx.fillStyle = hexA(s.side === 'ga' ? '#7aa8c8' : '#c8906a', a);
      ctx.fillRect(MX(s.x) - 1, MY(s.d) - 1, 2, 2);
    }
    ctx.globalCompositeOperation = 'lighter';
    // The armies: chevrons and ranks.
    for (const s of world.soldiers) {
      if (s.state === 'dead') continue;
      const x = MX(s.x);
      const y = MY(s.d);
      const col = sideC(s.side);
      const a = (s.state === 'fall' ? 0.5 : 0.95) * flick;
      ctx.fillStyle = hexA(col, a);
      if (s.side === 'ga') {
        const f = s.face * Z;
        ctx.beginPath();
        ctx.moveTo(x + f * 3.5, y);
        ctx.lineTo(x - f * 2.5, y - 2.6 * Z);
        ctx.lineTo(x - f * 1.2, y);
        ctx.lineTo(x - f * 2.5, y + 2.6 * Z);
        ctx.fill();
      } else ctx.fillRect(x - 1.3 * Z, y - 2.2 * Z, 2.6 * Z, 4.4 * Z);
      if (world.t - s.fireT < 0.1) glow(x, y, 7 * Z, col, 0.55);
    }
    for (const k of world.knights) {
      const x = MX(k.x);
      const y = MY(k.d);
      ctx.fillStyle = hexA(k.blade, 0.95);
      ctx.beginPath();
      ctx.moveTo(x, y - 5 * Z);
      ctx.lineTo(x + 4 * Z, y);
      ctx.lineTo(x, y + 5 * Z);
      ctx.lineTo(x - 4 * Z, y);
      ctx.fill();
      glow(x, y, 16 * Z, k.blade, 0.4);
    }
    for (const ro of world.rollers) {
      const x = MX(ro.x);
      const y = MY(ro.d);
      ctx.strokeStyle = hexA(CF, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.stroke();
      if (ro.state === 'shield') {
        ctx.strokeStyle = hexA('#9ad0ff', 0.6);
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // The ground's works: cover as short strokes, the armies' facilities as plotted outlines with their names.
    for (const c of world.terrain.cover) {
      if (c.hp <= 0) continue;
      const x = MX(c.x);
      const y = MY(c.d);
      const w = Math.max(3, ML(c.w));
      ctx.strokeStyle = hexA(c.side === 'ga' ? GA : c.side === 'cf' ? CF : HOLO, c.side ? 0.55 : 0.3);
      ctx.lineWidth = c.kind === 'trench' ? 2.5 : 1.2;
      ctx.beginPath();
      if (c.kind === 'rock' || c.kind === 'boulder' || c.kind === 'spire' || c.kind === 'crystal' || c.kind === 'fungus' || c.kind === 'stump' || c.kind === 'reef') ctx.arc(x, y, w * 0.35, 0, Math.PI * 2);
      else {
        ctx.moveTo(x - w / 2, y);
        ctx.lineTo(x + w / 2, y);
      }
      ctx.stroke();
    }
    // Plotted names never sit on one another: each tries its spot, then just below and above, else
    // stays unlabelled this frame.
    const placed: number[][] = [];
    const label = (text: string, x: number, y: number) => {
      const w = ctx.measureText(text).width + 6;
      const lh = 11 + Z * 2;
      x = Math.min(Math.max(x, box.x + w / 2 + 2), box.x + box.w - w / 2 - 2);
      for (const dy of [0, lh + 2, -2 * lh - 4]) {
        const r = [x - w / 2, y + dy - lh, w, lh + 3];
        if (placed.some((q) => r[0] < q[0] + q[2] && q[0] < r[0] + r[2] && r[1] < q[1] + q[3] && q[1] < r[1] + r[3])) continue;
        placed.push(r);
        fillCrisp(ctx, text, x, y + dy);
        return;
      }
    };
    ctx.font = SANS(Math.round(8 + Z * 2), 700);
    ctx.textAlign = 'center';
    for (const fc of world.terrain.facilities) {
      const x = MX(fc.x);
      const y = MY(fc.d);
      const col = fc.side === 'ga' ? GA : CF;
      const ruin = fc.state === 'ruin';
      ctx.strokeStyle = hexA(ruin ? '#9ab4c4' : col, ruin ? 0.4 : 0.85 * flick);
      ctx.lineWidth = 1.4;
      const r = 9 * Z * fc.s;
      ctx.beginPath();
      if (fc.kind === 'tower') {
        ctx.moveTo(x, y - r * 1.4);
        ctx.lineTo(x + r, y + r * 0.6);
        ctx.lineTo(x - r, y + r * 0.6);
        ctx.closePath();
      } else ctx.rect(x - r, y - r * 0.6, r * 2, r * 1.2);
      ctx.stroke();
      if (ruin) {
        ctx.beginPath();
        ctx.moveTo(x - r, y - r * 0.6);
        ctx.lineTo(x + r, y + r * 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = hexA(col, ruin ? 0.4 : 0.8);
      label(fc.name.replace(/^THE /, ''), x, y + r + 12);
    }
    // The war machines.
    for (const v of world.vehicles) {
      const x = MX(v.x);
      const y = MY(v.d);
      const col = sideC(v.side);
      ctx.fillStyle = hexA(col, 0.9 * flick);
      ctx.strokeStyle = hexA(col, 0.9 * flick);
      ctx.lineWidth = 1.3;
      const r = (v.kind === 'mtt' || v.kind === 'spha' ? 8 : v.kind === 'aat' || v.kind === 'saber' ? 6 : 4) * Z;
      if (v.kind === 'aat' || v.kind === 'saber' || v.kind === 'mtt') {
        ctx.strokeRect(x - r, y - r * 0.6, r * 2, r * 1.2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + v.face * r * 1.6, y);
        ctx.stroke();
      } else if (v.kind === 'spha') {
        ctx.strokeRect(x - r, y - r * 0.4, r * 2, r * 0.8);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + v.face * r * 2, y - r);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const m of world.missiles) {
      const k = (world.t - m.t0) / m.dur;
      if (k < 0 || k > 1) continue;
      glow(MX(m.x0 + (m.x1 - m.x0) * k), MY(m.d0 + (m.d1 - m.d0) * k), 5 * Z, '#ffb070', 0.9);
    }
    // Walkers: their glyphs, their guns' reach, where they last fired.
    for (const wk of world.walkers) {
      if (wk.state === 'enter') continue;
      const x = MX(wk.x);
      const y = MY(wk.d);
      const col = sideC(wk.side);
      const f = wk.face;
      ctx.strokeStyle = hexA(col, 0.95 * flick);
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(Z, Z);
      ctx.translate(-x, -y);
      if (wk.kind === 'hexa') {
        ctx.strokeRect(x - 9, y - 4, 18, 8);
        for (const lx of [-6, 0, 6])
          for (const sy of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x + lx, y + sy * 4);
            ctx.lineTo(x + lx + 2, y + sy * 8);
            ctx.stroke();
          }
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + f * 14, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
        for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.beginPath();
          ctx.moveTo(x + ax * 4, y + ay * 4);
          ctx.lineTo(x + ax * 10, y + ay * 9);
          ctx.stroke();
        }
      }
      ctx.restore();
      // Stencilled on the plot: the walker's name.
      ctx.font = SANS(Math.round(8 + Z * 2), 700);
      ctx.textAlign = 'center';
      ctx.fillStyle = hexA(col, 0.75);
      label(wk.name, x, y + 18 * Z);
      ctx.strokeStyle = hexA(col, 0.18);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(x, y, ML(900 * u), f > 0 ? -0.6 : Math.PI - 0.6, f > 0 ? 0.6 : Math.PI + 0.6);
      ctx.stroke();
      ctx.setLineDash([]);
      if (wk.hp < 40) {
        ctx.strokeStyle = hexA('#ff5a40', 0.5 + 0.4 * Math.sin(t * 8));
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (world.t - wk.fireT < 0.5 && wk.aimX) {
        ctx.strokeStyle = hexA(col, 0.6 * (1 - (world.t - wk.fireT) / 0.5));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(MX(wk.aimX), MY(wk.aimD));
        ctx.stroke();
      }
    }
    // Craft: trails behind, the plotted course ahead.
    const seen = new Set<number>();
    for (const c of world.crafts) {
      seen.add(c.id);
      const x = MX(c.x);
      const y = MY(c.d) - (c.alt / (400 * u)) * 10;
      const tr = trails.get(c.id) ?? [];
      if (!tr.length || Math.hypot(tr[tr.length - 1][0] - x, tr[tr.length - 1][1] - y) > 3) tr.push([x, y]);
      if (tr.length > 40) tr.shift();
      trails.set(c.id, tr);
      const col = sideC(c.side);
      ctx.strokeStyle = hexA(col, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      tr.forEach(([qx, qy], i) => (i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy)));
      ctx.stroke();
      if (c.state === 'inbound' || c.state === 'strafe' || c.state === 'away') {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = hexA(col, 0.4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(MX(c.tx), MY(c.td));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = hexA(col, 0.5);
        ctx.strokeRect(MX(c.tx) - 3, MY(c.td) - 3, 6, 6);
      }
      ctx.fillStyle = hexA(col, 0.95);
      ctx.strokeStyle = hexA(col, 0.95);
      const f = c.face * Z;
      if (c.kind === 'lander') {
        ctx.beginPath();
        ctx.arc(x, y, 7 * Z, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(x - 3 * Z, y - 2 * Z, 6 * Z, 4 * Z);
      } else {
        ctx.beginPath();
        ctx.moveTo(x + f * 8, y);
        ctx.lineTo(x - f * 6, y - 6 * Z);
        ctx.lineTo(x - f * 3, y);
        ctx.lineTo(x - f * 6, y + 6 * Z);
        ctx.closePath();
        ctx.fill();
      }
      if (c.state === 'drop') {
        ctx.strokeStyle = hexA(col, 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 10 + ((t * 10) % 8), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (c.state === 'falling') glow(x, y, 16, '#ff7a40', 0.7);
    }
    for (const id of [...trails.keys()]) if (!seen.has(id)) trails.delete(id);
    // Bolts as fine dashes; shells as dotted arcs with an impact ring closing on the mark.
    for (const b of world.bolts) {
      const k = (world.t - b.t0) / b.dur;
      if (k < 0 || k > 1) continue;
      const x = MX(b.x0 + (b.x1 - b.x0) * k);
      const y = MY(b.d0 + (b.d1 - b.d0) * k);
      const x2 = MX(b.x0 + (b.x1 - b.x0) * Math.max(0, k - 0.15));
      const y2 = MY(b.d0 + (b.d1 - b.d0) * Math.max(0, k - 0.15));
      ctx.strokeStyle = hexA(b.side === 'ga' ? '#9ad8ff' : '#ff8a6a', 0.8);
      ctx.lineWidth = b.kind === 'cannon' ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    for (const s of world.shells) {
      const k = (world.t - s.t0) / s.dur;
      const col = s.side === 'ga' ? '#9ad8ff' : '#ffb070';
      const tx = MX(s.x1);
      const ty = MY(s.d1);
      ctx.strokeStyle = hexA(col, 0.25);
      ctx.setLineDash([1, 4]);
      ctx.beginPath();
      const sx = MX(s.x0);
      const sy = MY(s.d0);
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + tx) / 2, Math.min(sy, ty) - 40, tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = hexA(col, 0.7);
      ctx.beginPath();
      ctx.arc(tx, ty, 4 + (1 - k) * 18, 0, Math.PI * 2);
      ctx.stroke();
      const q = clamp01(k);
      const bx = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * ((sx + tx) / 2) + q * q * tx;
      const by = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * (Math.min(sy, ty) - 40) + q * q * ty;
      glow(bx, by, 6, col, 0.9);
    }
    for (const f of world.fx) {
      if (f.kind !== 'flash') continue;
      const k = (world.t - f.t0) / f.dur;
      const x = MX(f.x);
      const y = MY(f.d);
      glow(x, y, ML(f.r) * (0.6 + k), '#ffc080', (1 - k) * 0.8);
      ctx.strokeStyle = hexA('#ffd0a0', (1 - k) * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, ML(f.r) * (0.3 + k * 1.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    // Overhead: the dogfights, as paired sparks with short tails.
    for (const df of world.dogfights) {
      for (const chaser of [false, true]) {
        const side: Side = chaser ? (df.chased === 'ga' ? 'cf' : 'ga') : df.chased;
        if (df.state === 'over' && df.winner !== side) continue;
        const p = dogfightAt(df, t, chaser);
        const x = box.x + (p.x / GW) * box.w;
        const y = box.y + (p.y / world.HY) * box.h * 0.45;
        ctx.fillStyle = hexA(sideC(side), 0.8);
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        const q = dogfightAt(df, t - 0.5, chaser);
        ctx.strokeStyle = hexA(sideC(side), 0.3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(box.x + (q.x / GW) * box.w, box.y + (q.y / world.HY) * box.h * 0.45);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // The projector's scan.
    const scanY = box.y + ((t * 40) % box.h);
    const sg = ctx.createLinearGradient(0, scanY - 60, 0, scanY);
    sg.addColorStop(0, hexA(HOLO, 0));
    sg.addColorStop(1, hexA(HOLO, 0.035));
    ctx.fillStyle = sg;
    ctx.fillRect(box.x, scanY - 60, box.w, 60);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = box.y; y < box.y + box.h; y += 3) ctx.fillRect(box.x, y, box.w, 1);
    ctx.restore();
    // The capital ships, as markers along the plate's top edge.
    ctx.textAlign = 'center';
    for (const c of world.capitals) {
      const x = box.x + (c.x / GW) * box.w;
      const y = box.y - 4;
      ctx.fillStyle = hexA(sideC(c.side), 0.9);
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y);
      ctx.lineTo(x + c.face * 12, y - 4);
      ctx.closePath();
      ctx.fill();
      if (world.t < c.fireUntil) glow(x, y, 16, sideC(c.side), 0.5);
    }
    // The log of the engagements, and the clock.
    if (o.hud) {
      const lines = world.chronicle.slice(small ? -2 : -3);
      ctx.textAlign = 'left';
      ctx.font = MONO(small ? 9 : 10);
      lines.forEach((l, i) => {
        const age = world.t - l.t;
        ctx.fillStyle = hexA('#bfe6ff', Math.min(1, age) * (i === lines.length - 1 ? 0.9 : 0.5));
        const text = l.text.length > (small ? 60 : 110) ? `${l.text.slice(0, small ? 58 : 108)}…` : l.text;
        fillCrisp(ctx, text, box.x, box.y + box.h + 30 + i * 13);
      });
      const tt = Math.floor(world.t);
      const top = box.y - (small ? 40 : 34);
      ctx.textAlign = 'right';
      ctx.font = MONO(small ? 11 : 13);
      ctx.fillStyle = hexA(HOLO, 0.9);
      fillCrisp(ctx, `T+ ${String(Math.floor(tt / 60)).padStart(2, '0')}:${String(tt % 60).padStart(2, '0')}`, box.x + box.w, top + 12);
      // The table's heading: where, and which engagement.
      ctx.textAlign = 'left';
      ctx.font = SANS(small ? 11 : 13, 700);
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '2px';
      ctx.fillStyle = hexA('#e8f6ff', 0.95);
      fillCrisp(ctx, world.place.replace(/^THE /, ''), box.x, top + 12);
      ctx.font = SANS(small ? 9 : 10, 600);
      ctx.fillStyle = hexA(HOLO, 0.8);
      const a = world.act;
      const phase = a.phase === 'buildup' ? 'MASSING' : a.phase === 'clash' ? 'LINES ENGAGED' : a.phase === 'climax' ? 'THE DECISIVE HOUR' : 'AFTERMATH';
      fillCrisp(ctx, `${a.title} · ${phase}`, box.x, top + 26);
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
    }
    void o;
    void mix;
    void FIELDS;
  }

  return {
    paint,
    project: (x: number, y: number): [number, number] => {
      // A world point (picture coordinates) to the plate: back through the scene's perspective to the ground.
      const k = (y - world.HY) / (world.NY - world.HY);
      const d = k <= 0 ? D1 : 1 - Math.sqrt(Math.min(1, k));
      return [MX(gx(x, d)), MY(d)];
    },
    unproject: (sx: number, sy: number): [number, number] => {
      const d = D1 - ((sy - box.y) / box.h) * (D1 - D0);
      const x = X0 + ((sx - box.x) / box.w) * (X1 - X0);
      const dd = clamp01(d);
      return [world.xOf(x, dd), world.yOf(dd)];
    },
  };
}
