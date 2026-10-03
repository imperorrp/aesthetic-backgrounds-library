/**
 * Label placement. Renderers queue labels with a priority and an anchor; the board
 * places them in priority order, trying a few spots around each anchor and skipping
 * any label that would overlap one already placed. Nothing overlaps, and the most
 * important names win when the map is crowded.
 */
import { hexRgba } from './utils';

export type LabelSpot = 'below' | 'above' | 'right' | 'left' | 'ne' | 'se' | 'exact';

export type LabelRequest = {
  text: string;
  x: number;
  y: number;
  /** Distance from the anchor to the label (e.g. a ring radius). */
  offset: number;
  color: string;
  alpha: number;
  font: string;
  priority: number;
  spots?: LabelSpot[];
  /** Small leader tick before the text. */
  tick?: boolean;
};

type Rect = { x: number; y: number; w: number; h: number };

const widthCache = new Map<string, number>();

export type LabelBoard = {
  add(req: LabelRequest): void;
  /** Reserve an area (a ship, a ring) so labels avoid covering it. */
  reserve(x: number, y: number, r: number): void;
  flush(ctx: CanvasRenderingContext2D, viewport: { width: number; height: number }): void;
};

export function createLabelBoard(): LabelBoard {
  const queue: LabelRequest[] = [];
  const reserved: Rect[] = [];
  return {
    add(req) {
      if (req.alpha > 0.02 && req.text) queue.push(req);
    },
    reserve(x, y, r) {
      reserved.push({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
    },
    flush(ctx, viewport) {
      if (!queue.length) return;
      queue.sort((a, b) => b.priority - a.priority);
      const placed: Rect[] = [];
      const hits = (r: Rect, list: Rect[]) =>
        list.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      let font = '';
      for (const q of queue) {
        if (q.font !== font) {
          ctx.font = q.font;
          font = q.font;
        }
        const key = `${q.font}|${q.text}`;
        let w = widthCache.get(key);
        if (w === undefined) {
          w = ctx.measureText(q.text).width;
          if (widthCache.size > 4000) widthCache.clear();
          widthCache.set(key, w);
        }
        const h = 11;
        const pad = 2;
        const o = q.offset;
        const spots = q.spots ?? ['below', 'right', 'above', 'left'];
        let chosen: Rect | null = null;
        for (const s of spots) {
          let rx: number;
          let ry: number;
          switch (s) {
            case 'below': rx = q.x - w / 2; ry = q.y + o + 2; break;
            case 'above': rx = q.x - w / 2; ry = q.y - o - h - 2; break;
            case 'right': rx = q.x + o + 4; ry = q.y - h / 2; break;
            case 'left': rx = q.x - o - 4 - w; ry = q.y - h / 2; break;
            case 'ne': rx = q.x + o * 0.7 + 4; ry = q.y - o * 0.7 - h; break;
            case 'se': rx = q.x + o * 0.7 + 4; ry = q.y + o * 0.7; break;
            default: rx = q.x; ry = q.y - h / 2;
          }
          const r = { x: rx - pad, y: ry - pad, w: w + pad * 2 + (q.tick ? 6 : 0), h: h + pad * 2 };
          if (r.x < 2 || r.y < 2 || r.x + r.w > viewport.width - 2 || r.y + r.h > viewport.height - 2) continue;
          if (hits(r, placed) || hits(r, reserved)) continue;
          chosen = r;
          break;
        }
        if (!chosen) continue;
        placed.push(chosen);
        ctx.fillStyle = hexRgba(q.color, q.alpha);
        const tx = chosen.x + pad + (q.tick ? 6 : 0);
        if (q.tick) ctx.fillRect(chosen.x + pad, chosen.y + pad + h / 2, 3, 1);
        ctx.fillText(q.text, tx, chosen.y + pad + h / 2);
      }
      ctx.restore();
      queue.length = 0;
      reserved.length = 0;
    },
  };
}
