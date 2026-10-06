/**
 * Captions: one line at a time, set like a title card, for the moments that matter.
 *
 * Worlds show what happens; captions only name it, rarely. A caption waits its turn
 * (one on screen), types itself in, holds, and fades. Minor lines go to the small
 * chronicle at the foot of the screen (or nowhere).
 */
import { fillCrisp, hexA, typed } from '../skins/instruments/kit';

export const SERIF = '"IM Fell English SC", "Cinzel", Georgia, "Times New Roman", serif';
export const serifFont = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px ${SERIF}`;

type Line = { text: string; sub?: string; color: string; t0: number; dur: number };

export function createCaptions() {
  const queue: Line[] = [];
  let current: Line | null = null;
  const chronicle: { t: number; text: string }[] = [];
  return {
    /** A title card. `sub` is a smaller line under it. */
    say(text: string, t: number, color = '#f5ecd7', sub?: string, dur = 6) {
      if (current?.text === text || queue.some((q) => q.text === text)) return;
      if (queue.length >= 2) queue.shift();
      queue.push({ text, sub, color, t0: t, dur });
    },
    note(text: string, t: number) {
      chronicle.push({ t, text });
      if (chronicle.length > 3) chronicle.shift();
    },
    get chronicle() {
      return chronicle;
    },
    draw(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, level: number, opts: { chronicle: boolean; y?: number }) {
      if (!current || t - current.t0 > current.dur) {
        current = queue.shift() ?? null;
        if (current) current.t0 = t;
      }
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      if (current) {
        const age = t - current.t0;
        const a = Math.min(1, age * 1.5, (current.dur - age) / 1.2) * level;
        if (a > 0) {
          const y = opts.y ?? H * 0.84;
          ctx.font = serifFont(Math.round(Math.max(15, Math.min(22, W / 60))));
          const text = typed(current.text, age, 26, t);
          const w = ctx.measureText(current.text).width;
          const band = ctx.createLinearGradient(W / 2 - w, 0, W / 2 + w, 0);
          band.addColorStop(0, 'rgba(3,3,8,0)');
          band.addColorStop(0.5, `rgba(3,3,8,${(0.55 * a).toFixed(3)})`);
          band.addColorStop(1, 'rgba(3,3,8,0)');
          ctx.fillStyle = band;
          ctx.fillRect(W / 2 - w, y - 26, w * 2, current.sub ? 50 : 36);
          ctx.fillStyle = hexA(current.color, 0.95 * a);
          fillCrisp(ctx, text, W / 2, y);
          if (current.sub) {
            ctx.font = serifFont(12, true);
            ctx.fillStyle = hexA('#d6d3d1', 0.8 * a * Math.min(1, Math.max(0, age - 0.8)));
            fillCrisp(ctx, current.sub, W / 2, y + 18);
          }
        }
      }
      if (opts.chronicle) {
        ctx.textAlign = 'left';
        ctx.font = serifFont(12, true);
        chronicle.forEach((l, i) => {
          const age = t - l.t;
          ctx.fillStyle = hexA('#e7e5f4', Math.min(1, age) * (i === chronicle.length - 1 ? 0.75 : 0.45) * level);
          fillCrisp(ctx, typed(l.text, age, 50, t), 16, H - 16 - (chronicle.length - 1 - i) * 17);
        });
      }
      ctx.restore();
    },
  };
}
