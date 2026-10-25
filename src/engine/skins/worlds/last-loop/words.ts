/**
 * Last Loop's words: few, big, and in the fiction's own voice.
 *
 * - Top left, the title hand-lettered, and under it the ship's log: a small card with the last
 *   things the traveller learned (what carries from loop to loop).
 * - Top right, the loop clock: a dial whose arc is the colour of the sun now, a small sun at its
 *   heart growing as it swells, the minutes round its rim.
 * - At the foot, one line at a time like a film's subtitles: what happened, or a voice on the radio
 *   ("Hatch: That's going to need tape.").
 *
 * Everything is set on a dark backing so it reads over the sun, the shockwave and the dark alike,
 * and nothing is placed where the subtitles or the clock already are.
 */
import { fillCrisp, hexA, typed } from '../../instruments/kit';
import type { LoopWorld } from './types';

export const SERIF = (px: number, italic = false, weight = '') => `${italic ? 'italic ' : ''}${weight ? `${weight} ` : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;
const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

/** Split text into lines no wider than `max`. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, edge = 'rgba(240,168,96,') {
  const r = 6;
  ctx.fillStyle = `rgba(6,8,16,${(0.66 * a).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();
  ctx.strokeStyle = `${edge}${(0.28 * a).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export type WordsOpts = { W: number; H: number; level: number; phone: boolean; hud: boolean; labels: boolean };

/** The title and the ship's log, top left. Returns the bottom of what it drew. */
export function drawTitle(ctx: CanvasRenderingContext2D, world: LoopWorld, t: number, o: WordsOpts, clockW: number): number {
  if (!o.hud) return 0;
  const { W, phone, level } = o;
  const x = 18;
  ctx.save();
  ctx.textAlign = 'left';
  // A soft shade behind the corner, so the title reads over the sun's halo.
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, phone ? 260 : 380);
  sh.addColorStop(0, 'rgba(4,6,12,0.55)');
  sh.addColorStop(1, 'rgba(4,6,12,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, phone ? 260 : 380, phone ? 260 : 380);
  ctx.font = SERIF(phone ? 21 : 26, true);
  ctx.fillStyle = hexA('#f6ead2', 0.96 * level);
  fillCrisp(ctx, 'Last Loop', x, phone ? 34 : 40);
  ctx.font = SERIF(phone ? 12 : 13, true);
  ctx.fillStyle = hexA('#d8c8a8', 0.85 * level);
  fillCrisp(ctx, `${world.name} · loop ${world.loop}`, x, phone ? 52 : 61);
  let y = phone ? 62 : 74;
  // The ship's log: the last things learned.
  const n = phone ? 1 : 2;
  const entries = world.log.slice(-n);
  if (entries.length) {
    const maxW = Math.min(phone ? W - 36 - clockW : 340, W - 36 - clockW);
    ctx.font = SERIF(phone ? 12 : 13);
    const lines = entries.map((e) => wrap(ctx, `${e.text}.`, maxW - 22).slice(0, 3));
    const lh = phone ? 15 : 17;
    const h = 26 + lines.reduce((s, l) => s + l.length * lh + 4, 0);
    const newest = entries[entries.length - 1];
    const fresh = clamp01((t - newest.t) / 1.2);
    panel(ctx, x - 8, y, maxW + 4, h, level);
    ctx.font = SERIF(phone ? 9 : 10, false, '600');
    ctx.fillStyle = hexA('#f0a860', 0.95 * level);
    fillCrisp(ctx, 'SHIP’S LOG', x + 4, y + 16);
    ctx.font = SERIF(phone ? 9 : 10);
    ctx.fillStyle = hexA('#c8b898', 0.75 * level);
    ctx.textAlign = 'right';
    fillCrisp(ctx, `${world.log.length} ${world.log.length === 1 ? 'entry' : 'entries'}`, x + maxW - 14, y + 16);
    ctx.textAlign = 'left';
    let ly = y + 16 + lh + 2;
    lines.forEach((ls, i) => {
      const isNew = i === lines.length - 1;
      const a = (isNew ? 0.4 + 0.6 * fresh : 0.62) * level;
      ctx.fillStyle = hexA('#f0a860', a);
      ctx.beginPath();
      ctx.arc(x + 6, ly - 4, 2, 0, TAU);
      ctx.fill();
      ctx.font = SERIF(phone ? 12 : 13, isNew);
      ctx.fillStyle = hexA(isNew ? '#f6ead2' : '#cfc2a6', a);
      ls.forEach((l, j) => fillCrisp(ctx, isNew ? typed(l, (t - newest.t) * 1.2 - j * 1.5, 40, t) : l, x + 14, ly + j * lh));
      ly += ls.length * lh + 4;
    });
    y += h;
  }
  ctx.restore();
  return y;
}

/** The loop clock, top right. Returns its width. */
export function drawClock(ctx: CanvasRenderingContext2D, world: LoopWorld, o: WordsOpts): number {
  if (!o.hud) return 0;
  const { W, phone, level } = o;
  const R = phone ? 24 : 32;
  const dx = W - R - 20;
  const dy = R + 20;
  const S = world.sun;
  const q = world.tau / world.loopLen;
  const ended = world.phase === 'nova' || world.phase === 'dark';
  ctx.save();
  ctx.fillStyle = `rgba(6,8,16,${(0.62 * level).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(dx, dy, R + 9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = hexA('#f6ead2', 0.16 * level);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(dx, dy, R, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = hexA(ended ? '#cfe8ff' : S.color, 0.95 * level);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(dx, dy, R, -Math.PI / 2, -Math.PI / 2 + q * TAU);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = hexA('#f6ead2', 0.45 * level);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const mins = Math.round(world.loopLen / 60);
  for (let i = 0; i < mins; i++) {
    const a = -Math.PI / 2 + (i / mins) * TAU;
    const l = i % 5 === 0 ? 5 : 3;
    ctx.moveTo(dx + Math.cos(a) * (R - 5 - l), dy + Math.sin(a) * (R - 5 - l));
    ctx.lineTo(dx + Math.cos(a) * (R - 5), dy + Math.sin(a) * (R - 5));
  }
  ctx.stroke();
  // The sun in the middle, at its size now.
  const sr = world.phase === 'live' || world.phase === 'wake' ? (R * 0.18) * (S.r / S.r0) : world.phase === 'collapse' ? 2 : 0;
  if (sr > 0) {
    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, sr * 2.2);
    g.addColorStop(0, hexA(S.color, level));
    g.addColorStop(0.45, hexA(S.color, 0.9 * level));
    g.addColorStop(1, hexA(S.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(dx, dy, sr * 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.font = SERIF(phone ? 13 : 15, false, '600');
  ctx.fillStyle = hexA('#f6ead2', 0.95 * level);
  fillCrisp(ctx, ended ? '—:—' : mmss(world.tau), dx, dy + R + 26);
  ctx.font = SERIF(phone ? 9 : 10, true);
  ctx.fillStyle = hexA('#c8b898', 0.85 * level);
  fillCrisp(ctx, `of ${mmss(world.loopLen)}`, dx, dy + R + (phone ? 38 : 40));
  ctx.restore();
  return R * 2 + 40;
}

/** The subtitle at the foot: one line (or two), sentence case, on a dark band. */
export function drawSubtitle(ctx: CanvasRenderingContext2D, world: LoopWorld, t: number, o: WordsOpts) {
  const s = world.sub;
  if (!s || !o.labels) return;
  const { W, H, phone, level } = o;
  const age = t - s.t0;
  const a = Math.min(1, age * 4, (s.dur - age) / 0.6) * level;
  if (a <= 0) return;
  const px = s.kind === 'big' ? (phone ? 17 : 22) : phone ? 15 : 18;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = SERIF(px, s.kind === 'radio' || s.kind === 'big');
  const who = s.who ? `${s.who}: ` : '';
  const body = s.who ? `“${s.text}”` : s.text;
  const max = Math.min(W - 40, phone ? W - 40 : 820);
  const lines = wrap(ctx, who + body, max).slice(0, 3);
  const lh = px * 1.35;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const y0 = H - (phone ? 34 : 38) - (lines.length - 1) * lh;
  panel(ctx, W / 2 - widest / 2 - 16, y0 - px - 6, widest + 32, lines.length * lh + 12, a * 0.9, 'rgba(246,234,210,');
  const shown = typed(who + body, age, 55, t);
  let used = 0;
  lines.forEach((l, i) => {
    const part = shown.slice(used, used + l.length + 1).trimEnd();
    used += l.length + 1;
    const y = y0 + i * lh;
    if (i === 0 && who) {
      // The speaker's name in the fire's colour, the words in cream.
      const ww = ctx.measureText(l).width;
      const left = W / 2 - ww / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = hexA('#f0b060', a);
      const name = part.slice(0, Math.min(part.length, who.length));
      fillCrisp(ctx, name, left, y);
      ctx.fillStyle = hexA('#f6ead2', a);
      fillCrisp(ctx, part.slice(name.length), left + ctx.measureText(who).width, y);
      ctx.textAlign = 'center';
    } else {
      ctx.fillStyle = hexA(s.kind === 'big' ? '#fff3dc' : s.kind === 'quiet' ? '#ddd2bc' : '#f6ead2', a);
      fillCrisp(ctx, part, W / 2, y);
    }
  });
  ctx.restore();
}

/** A hand-lettered name with a dark halo, for the thing a line is about. */
export function letter(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color: string, a: number) {
  ctx.save();
  ctx.font = SERIF(px, true);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(4,6,12,${(0.8 * a).toFixed(3)})`;
  ctx.lineWidth = 4;
  const d = ctx.getTransform?.().a || 1;
  const rx = Math.round(x * d) / d;
  const ry = Math.round(y * d) / d;
  ctx.strokeText(text, rx, ry);
  ctx.fillStyle = hexA(color, a);
  fillCrisp(ctx, text, rx, ry);
  ctx.restore();
}
