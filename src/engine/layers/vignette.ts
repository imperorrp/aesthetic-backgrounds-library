import type { Layer } from '../core/layer';
import { color, rgbaOf } from './util';

const schema = {
  strength: { type: 'number', min: 0, max: 1, default: 0.55, label: 'Strength' },
  size: { type: 'number', min: 0.4, max: 1.6, default: 1, label: 'Size', description: 'Radius of the clear center relative to the canvas' },
  lightBias: {
    type: 'number',
    min: 0,
    max: 1,
    default: 0.5,
    label: 'Open toward light',
    description: 'Shift the clear center toward the scene light so the lit side stays open',
  },
  color: { type: 'color', default: 'bg', label: 'Edge color' },
} as const;

/**
 * Darkens (or, on light palettes, lightens) toward the edges so content in the middle
 * stays anchored. The clear center leans toward the scene light, so the shadowed
 * side closes in a little more, as it would under a real key light.
 */
export const vignetteLayer: Layer = {
  id: 'vignette',
  label: 'Vignette',
  description: 'Edge falloff toward the background color, opening toward the scene light.',
  tags: ['finish', 'calm', 'light-ok'],
  schema,
  canvas(host) {
    const { ctx, light } = host;
    const o = host.options as { strength: number; size: number; lightBias: number; color: string };
    const edge = color(host, o.color);
    return {
      frame() {
        const { width, height } = host.viewport;
        const cx = width * (0.5 + light.dx * 0.07 * o.lightBias);
        const cy = height * (0.5 + light.dy * 0.07 * o.lightBias);
        const r = Math.hypot(width / 2, height / 2) * o.size;
        const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
        g.addColorStop(0, rgbaOf(edge, 0));
        g.addColorStop(0.7, rgbaOf(edge, o.strength * 0.45));
        g.addColorStop(1, rgbaOf(edge, o.strength));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      },
    };
  },
};
