/**
 * Blockade's words, the way a film would put them on screen: a title and the blockade's day in
 * the corner, one event card at the top (a chapter card, centred, between two rules), the radio
 * as subtitles at the foot of the frame (one line at a time, the speaker's ship above it in small
 * capitals), and a short ship's log in the other corner on wide screens. Nothing floats over the
 * ships: fixed places that never collide, each on a soft dark backing so it reads over the sun,
 * the planet's day side and the night alike.
 */
import { fitText } from '../../../kit';
import { fillCrisp } from '../../instruments/kit';
import { CLS_WORD } from './design';
import type { BlockWorld, Radio } from './types';

export const DISPLAY = (px: number) => `${px}px "Electrolize", "Orbit", "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
export const SUB = (px: number, w = 500) => `${w} ${px}px "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
export const MONO = (px: number) => `${px}px "Syne Mono", "JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace`;

const spaced = (ctx: CanvasRenderingContext2D, px: number) => {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
};

/** A soft dark band behind text: a rounded bar whose ends fade out. */
export function band(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, a: number) {
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, 'rgba(2,4,10,0)');
  g.addColorStop(0.12, `rgba(2,4,10,${a})`);
  g.addColorStop(0.88, `rgba(2,4,10,${a})`);
  g.addColorStop(1, 'rgba(2,4,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
}

const hhmm = (world: BlockWorld) => {
  const m = Math.floor((world.hour * 24 * 60 + 6 * 60) % (24 * 60));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const storesWord = (v: number) => (v < 0.15 ? 'STARVING' : v < 0.35 ? 'HUNGRY' : v < 0.65 ? 'ON SHORT RATIONS' : 'SUPPLIED');
export const resolveWord = (v: number) => (v < 0.3 ? 'THE LINE WAVERS' : v < 0.5 ? 'THE ADMIRAL IS ANGRY' : 'THE LINE HOLDS');

export function createText(world: BlockWorld) {
  /** The subtitle on screen and its queue. */
  let sub: (Radio & { shown: number }) | null = null;
  let seen = 0;
  let card: { text: string; color: string; t0: number } | null = null;

  /** Choose the radio line to show: the most important not yet shown, within the last few seconds. */
  function pickSub(t: number) {
    if (sub && t - sub.shown < Math.max(3.2, sub.text.length / 14)) return;
    const fresh = world.radio.filter((r) => r.t > seen && t - r.t < 6 && r.name !== 'MARKER');
    if (!fresh.length) {
      if (sub && t - sub.shown > 5.5) sub = null;
      return;
    }
    // A story line beats traffic beats chatter; chatter only when nothing else has been heard for a while.
    fresh.sort((a, b) => b.pri - a.pri || a.t - b.t);
    const best = fresh[0];
    if (best.pri < 1 && sub && t - sub.shown < 9) return;
    sub = { ...best, shown: Math.min(t, best.t + 0.3) };
    seen = best.t;
  }
  function pickCard(t: number) {
    const l = world.labels.filter((q) => q.pri >= 2).at(-1);
    if (!l) return;
    if (card && card.text === l.text) return;
    if (card && t - card.t0 < 2.2 && l.t0 <= card.t0) return;
    if (!card || l.t0 > card.t0) card = { text: l.text, color: l.color, t0: Math.min(t, l.t0 + 0.4) };
  }

  return {
    /** Which ship is speaking now (for the brackets), or -1. */
    speaker: () => (sub ? sub.id : -1),
    draw(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, o: { labels: boolean; hud: boolean; level: number; mapMode: boolean }) {
      const phone = W < 620;
      ctx.textBaseline = 'alphabetic';
      let titleRight = 0;
      let logLeft = W;
      if (o.hud) {
        // The title, and the blockade's day and state.
        ctx.textAlign = 'left';
        const tg = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(W * 0.6, 420));
        tg.addColorStop(0, 'rgba(2,4,10,0.55)');
        tg.addColorStop(1, 'rgba(2,4,10,0)');
        ctx.fillStyle = tg;
        ctx.fillRect(0, 0, Math.min(W * 0.6, 420), 120);
        spaced(ctx, phone ? 2 : 3);
        ctx.font = DISPLAY(phone ? 15 : 18);
        ctx.fillStyle = `rgba(236,240,248,${0.95 * o.level})`;
        const title = fitText(ctx, `BLOCKADE OF ${world.name}`, W - 32);
        fillCrisp(ctx, title, 18, phone ? 28 : 32);
        titleRight = 18 + ctx.measureText(title).width;
        spaced(ctx, 1.2);
        ctx.font = DISPLAY(phone ? 10.5 : 11.5);
        ctx.fillStyle = `rgba(176,190,212,${0.92 * o.level})`;
        const w = world.war;
        const line2 = `DAY ${w.day} · ${hhmm(world)} · ${world.planetLook.label.toUpperCase()} ${storesWord(w.stores)}`;
        fillCrisp(ctx, fitText(ctx, line2, W - 32), 18, phone ? 45 : 51);
        titleRight = Math.max(titleRight, Math.min(18 + ctx.measureText(line2).width, phone ? W : 18 + 240));
        if (!phone) {
          const alarm = world.alarm ? `ALERT: ${world.alarmWhy}` : resolveWord(w.resolve);
          ctx.fillStyle = world.alarm ? `rgba(252,165,165,${(0.75 + 0.25 * Math.sin(t * 5)) * o.level})` : `rgba(150,168,196,${0.85 * o.level})`;
          fillCrisp(ctx, fitText(ctx, `${world.fleet.name} · ${alarm}`, W - 32), 18, 68);
        }
        spaced(ctx, 0);
        // The ship's log, on screens wide enough for it.
        if (!phone && W > 900 && world.chronicle.length) {
          const lw = Math.min(330, W * 0.26);
          const x = W - lw - 18;
          logLeft = x;
          const lines = world.chronicle.slice(-2);
          ctx.font = MONO(10.5);
          const rows: { text: string; a: number }[] = [];
          lines.forEach((l, i) => {
            const words = l.text.split(' ');
            const out: string[] = [];
            let cur = '';
            for (const wd of words) {
              const test = cur ? `${cur} ${wd}` : wd;
              if (ctx.measureText(test).width > lw - 70 && cur) {
                out.push(cur);
                cur = wd;
              } else cur = test;
            }
            if (cur) out.push(cur);
            const stamp = `D${world.war.day} ${String(Math.floor(l.t / 60)).padStart(2, '0')}:${String(Math.floor(l.t % 60)).padStart(2, '0')}`;
            out.slice(0, 2).forEach((s, k) => rows.push({ text: `${k ? '         ' : stamp.padEnd(9)} ${k === 1 && out.length > 2 ? `${s}…` : s}`, a: i === lines.length - 1 ? 0.9 : 0.55 }));
          });
          const lh = 14;
          const top = 22;
          const lg = ctx.createRadialGradient(W, 0, 0, W, 0, lw + 60);
          lg.addColorStop(0, 'rgba(2,4,10,0.6)');
          lg.addColorStop(1, 'rgba(2,4,10,0)');
          ctx.fillStyle = lg;
          ctx.fillRect(W - lw - 70, 0, lw + 70, top + rows.length * lh + 40);
          ctx.fillStyle = `rgba(120,140,170,${0.8 * o.level})`;
          spaced(ctx, 2);
          ctx.font = DISPLAY(9.5);
          fillCrisp(ctx, `LOG · ${world.fleet.prefix} FLAG`, x, top);
          spaced(ctx, 0);
          ctx.font = MONO(10.5);
          rows.forEach((r, i) => {
            ctx.fillStyle = `rgba(206,218,236,${r.a * o.level})`;
            fillCrisp(ctx, r.text, x, top + 16 + i * lh);
          });
        }
      }
      if (!o.labels) return;
      pickCard(t);
      pickSub(t);
      // The event card: one at a time, centred in the space between the title and the log, between rules.
      if (card) {
        const age = t - card.t0;
        if (age > 6.5) card = null;
        else {
          const a = Math.min(1, age * 2.5, (6.5 - age) / 1.2);
          ctx.textAlign = 'center';
          spaced(ctx, phone ? 1.2 : 2);
          ctx.font = DISPLAY(phone ? 12 : 14);
          const free = phone ? W - 36 : Math.min(760, 2 * Math.min(W / 2 - titleRight - 28, logLeft - W / 2 - 28));
          const lines = wrap(ctx, card.text, Math.max(220, free)).slice(0, 2);
          if (lines.length === 2 && wrap(ctx, card.text, Math.max(220, free)).length > 2) lines[1] = fitText(ctx, `${lines[1]} …`, Math.max(220, free));
          const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
          const y = phone ? 82 : 34;
          const cx = W / 2;
          band(ctx, cx, y - 5 + (lines.length - 1) * 9, tw + 110, 26 + (lines.length - 1) * 18, 0.6 * a);
          ctx.strokeStyle = hexToRgba(card.color, 0.6 * a);
          ctx.lineWidth = 1;
          ctx.beginPath();
          const ry = y - 5.5 + (lines.length - 1) * 9;
          ctx.moveTo(cx - tw / 2 - 40, ry);
          ctx.lineTo(cx - tw / 2 - 12, ry);
          ctx.moveTo(cx + tw / 2 + 12, ry);
          ctx.lineTo(cx + tw / 2 + 40, ry);
          ctx.stroke();
          ctx.fillStyle = hexToRgba(card.color, 0.98 * a);
          lines.forEach((l, i) => fillCrisp(ctx, l, cx, y + i * 18));
          spaced(ctx, 0);
        }
      }
      // The subtitle: the speaker's ship, then the line.
      if (sub) {
        const age = t - sub.shown;
        const dur = Math.max(3.2, sub.text.length / 14) + 0.8;
        const a = Math.min(1, age * 4, Math.max(0, (dur - age) / 0.5));
        if (a > 0.01) {
          ctx.textAlign = 'center';
          const staticK = world.static;
          let text = sub.text.charAt(0) + sub.text.slice(1).toLowerCase();
          text = text.replace(/\b(i|i'm|i've)\b/g, (m) => m.toUpperCase());
          // Names keep their capitals.
          const names = new Set<string>([world.name, world.station.name, ...world.moons.map((m) => m.name), ...world.ships.map((q) => q.name)].flatMap((n) => n.split(' ')).filter((w) => w.length > 3 && !['LINE', 'FLIGHT', 'SHUTTLE', 'GREAT', 'HOME', 'FLEET', 'LONG', 'HIGH', 'LAST', 'GOOD'].includes(w)));
          text = text.split(' ').map((w) => (names.has(w.toUpperCase().replace(/[^A-Z']/g, '')) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
          if (staticK > 0.2) text = text.replace(/[a-z]/g, (ch, i) => (Math.sin(i * 12.9 + Math.floor(t * 12)) > 1 - staticK * 0.3 ? '·' : ch));
          ctx.font = SUB(phone ? 15 : 19, 500);
          const max = Math.min(W - 40, 860);
          const lines: string[] = [];
          let cur = '';
          for (const wd of text.split(' ')) {
            const test = cur ? `${cur} ${wd}` : wd;
            if (ctx.measureText(test).width > max && cur) {
              lines.push(cur);
              cur = wd;
            } else cur = test;
          }
          if (cur) lines.push(cur);
          const lh = phone ? 20 : 25;
          const base = H - (phone ? 30 : 38) - (lines.length - 1) * lh;
          const wmax = Math.max(...lines.map((l) => ctx.measureText(l).width));
          band(ctx, W / 2, base - 10 + ((lines.length - 1) * lh) / 2 - 6, wmax + 140, lines.length * lh + 34, 0.5 * a);
          const who = sub.side === 'merchant' ? `${sub.name} · ${CLS_WORD[sub.cls]}` : sub.side === 'runner' ? `${sub.name} · RUNNER` : sub.side === 'home' ? `${sub.name} · ${world.name}` : `${world.fleet.prefix} ${sub.name}`;
          spaced(ctx, 2);
          ctx.font = DISPLAY(phone ? 9.5 : 10.5);
          const col = sub.side === 'fleet' ? world.fleet.trim : sub.side === 'home' ? world.home.trim : sub.side === 'runner' ? '#f0a050' : '#d8c8a8';
          ctx.fillStyle = hexToRgba(lighten(col), 0.95 * a);
          fillCrisp(ctx, fitText(ctx, who, W - 40), W / 2, base - (phone ? 19 : 23));
          spaced(ctx, 0);
          ctx.font = SUB(phone ? 15 : 19, 500);
          ctx.fillStyle = `rgba(0,0,0,${0.65 * a})`;
          lines.forEach((l, i) => fillCrisp(ctx, l, W / 2 + 1, base + i * lh + 1.5));
          ctx.fillStyle = `rgba(250,250,246,${a})`;
          lines.forEach((l, i) => fillCrisp(ctx, l, W / 2, base + i * lh));
        }
      }
      ctx.textAlign = 'left';
    },
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const wd of text.split(' ')) {
    const test = cur ? `${cur} ${wd}` : wd;
    if (ctx.measureText(test).width > max && cur) {
      out.push(cur);
      cur = wd;
    } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}

export const hexToRgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
};
/** A trim colour, lifted so it reads on dark. */
export const lighten = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (v: number) => Math.round(v + (255 - v) * 0.45);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
};
