import type { Layer } from '../core/layer';
import { color, frames60, rgbaOf } from './util';

const schema = {
  radius: { type: 'number', min: 80, max: 900, default: 380, label: 'Radius (px)' },
  strength: { type: 'number', min: 0, max: 1, default: 0.45, label: 'Strength' },
  lag: { type: 'number', min: 0, max: 1, default: 0.2, label: 'Lag', description: 'How far the light trails the pointer' },
  color: { type: 'color', default: 'accent', label: 'Color' },
} as const;

/** A soft light that follows the pointer and fades when it rests. Canvas-based so it composites with the stack. */
export const lightFollowLayer: Layer = {
  id: 'light-follow',
  label: 'Light follow',
  description: 'Pointer-following glow that fades when idle.',
  tags: ['interactive', 'finish', 'light-ok'],
  schema,
  canvas(host) {
    const { ctx, pointer } = host;
    const o = host.options as { radius: number; strength: number; lag: number; color: string };
    const c = color(host, o.color);
    let x = -1;
    let y = -1;
    return {
      frame({ dt }) {
        if (!pointer.active) return;
        const { width, height } = host.viewport;
        if (x < 0) {
          x = pointer.x;
          y = pointer.y;
        }
        const ease = 1 - Math.pow(1 - (0.35 - o.lag * 0.3), frames60(dt));
        x += (pointer.x - x) * ease;
        y += (pointer.y - y) * ease;
        const rest = Math.max(0, 1 - Math.max(0, pointer.idle - 1.2) / 1.5);
        if (rest <= 0) return;
        const a = o.strength * rest * (0.5 + 0.5 * host.intensity);
        const g = ctx.createRadialGradient(x, y, 0, x, y, o.radius);
        g.addColorStop(0, rgbaOf(c, a * 0.5));
        g.addColorStop(0.4, rgbaOf(c, a * 0.18));
        g.addColorStop(1, rgbaOf(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      },
    };
  },
};
