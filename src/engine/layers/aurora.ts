import type { Layer } from '../core/layer';
import { hexToOklch, oklchToHex } from '../color';
import { rgbaOf, tripletOf } from './util';

const schema = {
  bands: { type: 'number', min: 1, max: 5, step: 1, default: 3, label: 'Bands' },
  height: { type: 'number', min: 0.1, max: 0.9, default: 0.4, label: 'Height', description: 'Band thickness relative to the canvas' },
  speed: { type: 'number', min: 0, max: 1, default: 0.25, label: 'Speed' },
  spread: { type: 'number', min: 0, max: 120, default: 35, label: 'Hue spread' },
  ripple: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Ripple', description: 'Vertical waviness' },
  position: { type: 'number', min: 0, max: 1, default: 0.35, label: 'Vertical position' },
} as const;

/** Luminous ribbons displaced by noise. Blend `lighter` on dark palettes; `multiply` or normal on light ones. */
export const auroraLayer: Layer = {
  id: 'aurora',
  label: 'Aurora',
  description: 'Soft luminous ribbons waving across the frame.',
  tags: ['motion', 'calm', 'nature', 'saas'],
  schema,
  canvas(host) {
    const { ctx, palette, noise } = host;
    const o = host.options as { bands: number; height: number; speed: number; spread: number; ripple: number; position: number };
    const light = palette.theme === 'light';
    const base = hexToOklch(palette.accent) ?? { l: 0.7, c: 0.12, h: 200 };
    const bands = Array.from({ length: Math.round(o.bands) }, (_, i) => {
      const f = o.bands === 1 ? 0.5 : i / (o.bands - 1);
      const hex = oklchToHex({ l: light ? 0.78 : 0.62, c: light ? 0.1 : 0.14, h: (base.h + (f - 0.5) * o.spread + 360) % 360 });
      return { rgb: tripletOf(hex), seed: i * 3.7, offset: (f - 0.5) * 0.25 };
    });
    const SEGMENTS = 48;
    return {
      frame({ t }) {
        const { width, height } = host.viewport;
        const tt = t * o.speed * 0.25;
        const thickness = height * o.height * 0.6;
        const alpha = (light ? 0.35 : 0.28) * (0.5 + 0.5 * host.intensity);
        for (const b of bands) {
          const baseY = height * (o.position + b.offset);
          const c = { hex: '', rgb: b.rgb };
          const g = ctx.createLinearGradient(0, baseY - thickness, 0, baseY + thickness);
          g.addColorStop(0, rgbaOf(c, 0));
          g.addColorStop(0.45, rgbaOf(c, alpha));
          g.addColorStop(0.6, rgbaOf(c, alpha * 0.6));
          g.addColorStop(1, rgbaOf(c, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          for (let s = 0; s <= SEGMENTS; s++) {
            const u = s / SEGMENTS;
            const x = u * width;
            const y = baseY + noise.fbm2(u * 1.8 + b.seed, tt, 3) * thickness * (0.5 + o.ripple) - thickness * 0.8;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let s = SEGMENTS; s >= 0; s--) {
            const u = s / SEGMENTS;
            const x = u * width;
            const y = baseY + noise.fbm2(u * 1.8 + b.seed + 9, tt + 1.3, 3) * thickness * (0.5 + o.ripple) + thickness * 0.8;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        }
      },
    };
  },
};
