import type { Layer } from '../core/layer';
import { color, rgbaOf, wrap } from './util';

const schema = {
  style: { type: 'enum', values: ['dots', 'lines', 'cross'], default: 'dots', label: 'Style' },
  spacing: { type: 'number', min: 16, max: 200, step: 1, default: 48, label: 'Spacing (px)' },
  alpha: { type: 'number', min: 0, max: 1, default: 0.35, label: 'Opacity' },
  fade: { type: 'number', min: 0, max: 1, default: 0.7, label: 'Edge fade', description: 'Radial mask so the grid dissolves toward the edges' },
  drift: { type: 'number', min: 0, max: 2, default: 0.3, label: 'Drift' },
  color: { type: 'color', default: 'accent', label: 'Color' },
} as const;

/** Dot, line, or cross grid with a radial mask. Uses its own surface for the mask. */
export const gridLayer: Layer = {
  id: 'grid',
  label: 'Grid',
  description: 'Drifting dot, line, or cross grid that fades toward the edges.',
  tags: ['structure', 'tech', 'editorial', 'light-ok'],
  surface: 'own',
  schema,
  canvas(host) {
    const { ctx } = host;
    const o = host.options as { style: string; spacing: number; alpha: number; fade: number; drift: number; color: string };
    const c = color(host, o.color);
    return {
      frame({ t }) {
        const { width, height } = host.viewport;
        ctx.clearRect(0, 0, width, height);
        const s = o.spacing;
        const off = wrap(t * o.drift * 6 * host.intensity, s);
        const a = o.alpha * (0.5 + 0.5 * host.intensity);
        ctx.fillStyle = rgbaOf(c, a);
        ctx.strokeStyle = rgbaOf(c, a * 0.8);
        ctx.lineWidth = 1;
        if (o.style === 'lines') {
          ctx.beginPath();
          for (let x = -off; x <= width + s; x += s) {
            ctx.moveTo(Math.round(x) + 0.5, 0);
            ctx.lineTo(Math.round(x) + 0.5, height);
          }
          for (let y = -off; y <= height + s; y += s) {
            ctx.moveTo(0, Math.round(y) + 0.5);
            ctx.lineTo(width, Math.round(y) + 0.5);
          }
          ctx.stroke();
        } else if (o.style === 'cross') {
          const arm = Math.max(2, s * 0.08);
          ctx.beginPath();
          for (let x = -off; x <= width + s; x += s) {
            for (let y = -off; y <= height + s; y += s) {
              ctx.moveTo(x - arm, y);
              ctx.lineTo(x + arm, y);
              ctx.moveTo(x, y - arm);
              ctx.lineTo(x, y + arm);
            }
          }
          ctx.stroke();
        } else {
          for (let x = -off; x <= width + s; x += s) {
            for (let y = -off; y <= height + s; y += s) {
              ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
            }
          }
        }
        if (o.fade > 0) {
          const cx = width / 2;
          const cy = height / 2;
          const r = Math.hypot(cx, cy);
          const g = ctx.createRadialGradient(cx, cy, r * (0.15 + 0.35 * (1 - o.fade)), cx, cy, r);
          g.addColorStop(0, 'rgba(0,0,0,1)');
          g.addColorStop(1, `rgba(0,0,0,${1 - o.fade})`);
          ctx.save();
          ctx.globalCompositeOperation = 'destination-in';
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      },
    };
  },
};
