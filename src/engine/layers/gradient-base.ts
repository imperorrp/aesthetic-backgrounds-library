import type { Layer } from '../core/layer';
import { color, rgbaOf, shiftHue, tripletOf } from './util';

const schema = {
  tint: { type: 'number', min: 0, max: 1, default: 0.35, label: 'Accent tint', description: 'How much accent bleeds into the plate' },
  drift: { type: 'number', min: 0, max: 1, default: 0.3, label: 'Drift', description: 'Speed of the slow light movement' },
  spread: { type: 'number', min: 0, max: 120, default: 40, label: 'Hue spread', description: 'Degrees between the two tint lights' },
  opaque: { type: 'boolean', default: true, label: 'Opaque plate', description: 'Fill with the palette background first' },
} as const;

/**
 * The plate everything else sits on: palette background with two slow-moving
 * tinted lights. Calm by construction; carries any palette including light themes.
 */
export const gradientBaseLayer: Layer = {
  id: 'gradient-base',
  label: 'Gradient base',
  description: 'Palette background plate with two drifting tinted lights.',
  tags: ['base', 'calm', 'light-ok'],
  schema,
  canvas(host) {
    const { ctx, palette, noise } = host;
    const o = host.options as { tint: number; drift: number; spread: number; opaque: boolean };
    const accent = color(host, 'accent');
    const second = { hex: shiftHue(palette.accent, o.spread), rgb: tripletOf(shiftHue(palette.accent, o.spread)) };
    const light = palette.theme === 'light';
    return {
      frame({ t }) {
        const { width, height } = host.viewport;
        const k = o.tint * host.intensity * (light ? 0.22 : 0.16);
        if (o.opaque) {
          ctx.fillStyle = palette.bg;
          ctx.fillRect(0, 0, width, height);
        }
        const tt = t * o.drift * 0.08;
        const lights = [
          { c: accent, x: 0.25 + noise.noise2(tt, 0.3) * 0.2, y: 0.7 + noise.noise2(0.7, tt) * 0.2, r: 0.75, a: k },
          { c: second, x: 0.78 + noise.noise2(tt + 5, 2.1) * 0.2, y: 0.22 + noise.noise2(3.3, tt + 5) * 0.2, r: 0.65, a: k * 0.7 },
        ];
        for (const l of lights) {
          const cx = l.x * width;
          const cy = l.y * height;
          const r = l.r * Math.max(width, height);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, rgbaOf(l.c, l.a));
          g.addColorStop(0.5, rgbaOf(l.c, l.a * 0.35));
          g.addColorStop(1, rgbaOf(l.c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
        }
      },
    };
  },
};
