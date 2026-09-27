import type { Layer } from '../core/layer';
import { hexToOklch, oklchToHex } from '../color';
import { rgbaOf, tripletOf, TAU } from './util';

const schema = {
  blobs: { type: 'number', min: 2, max: 8, step: 1, default: 4, label: 'Blobs' },
  spread: { type: 'number', min: 0, max: 120, default: 45, label: 'Hue spread', description: 'Degrees of hue variation across blobs' },
  size: { type: 'number', min: 0.3, max: 1.4, default: 0.75, label: 'Size', description: 'Blob radius relative to the shorter side' },
  speed: { type: 'number', min: 0, max: 1, default: 0.3, label: 'Speed' },
  saturation: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Saturation' },
} as const;

/**
 * Soft overlapping color fields wandering on noise. The "premium SaaS" look.
 * Colors are derived in OKLCH from the palette accent so any brand color works,
 * and lightness flips with the palette theme so it reads on white as well as black.
 */
export const meshGradientLayer: Layer = {
  id: 'mesh-gradient',
  label: 'Mesh gradient',
  description: 'Drifting soft color fields derived from the accent hue.',
  tags: ['base', 'calm', 'saas', 'light-ok'],
  schema,
  canvas(host) {
    const { ctx, palette, noise } = host;
    const o = host.options as { blobs: number; spread: number; size: number; speed: number; saturation: number };
    const light = palette.theme === 'light';
    const base = hexToOklch(palette.accent) ?? { l: 0.7, c: 0.12, h: 200 };
    const blobs = Array.from({ length: Math.round(o.blobs) }, (_, i) => {
      const f = o.blobs === 1 ? 0.5 : i / (o.blobs - 1);
      const hue = base.h + (f - 0.5) * o.spread;
      const l = light ? 0.86 - f * 0.06 : 0.42 + f * 0.1;
      const c = (light ? 0.09 : 0.13) * (0.4 + o.saturation);
      const hex = oklchToHex({ l, c, h: (hue + 360) % 360 });
      return { rgb: tripletOf(hex), seed: i * 17.3, phase: (i / o.blobs) * TAU };
    });
    return {
      frame({ t }) {
        const { width, height } = host.viewport;
        const tt = t * o.speed * 0.06;
        const r = o.size * Math.min(width, height);
        const alpha = (light ? 0.9 : 0.75) * (0.55 + 0.45 * host.intensity);
        for (const b of blobs) {
          const nx = noise.noise2(b.seed, tt);
          const ny = noise.noise2(tt + 3.1, b.seed);
          const cx = width * (0.5 + 0.42 * Math.cos(b.phase + tt * 0.6) + nx * 0.18);
          const cy = height * (0.5 + 0.42 * Math.sin(b.phase * 1.3 + tt * 0.5) + ny * 0.18);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          const c = { hex: '', rgb: b.rgb };
          g.addColorStop(0, rgbaOf(c, alpha));
          g.addColorStop(0.45, rgbaOf(c, alpha * 0.45));
          g.addColorStop(1, rgbaOf(c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
        }
      },
    };
  },
};
