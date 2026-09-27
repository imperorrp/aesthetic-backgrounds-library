import type { Layer } from '../core/layer';
import { color, rgbaOf, wrap } from './util';

const schema = {
  density: { type: 'number', min: 0, max: 2, default: 1, label: 'Density' },
  bands: { type: 'number', min: 1, max: 3, step: 1, default: 3, label: 'Depth bands' },
  twinkle: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Twinkle' },
  drift: { type: 'number', min: 0, max: 2, default: 0.4, label: 'Drift', description: 'Parallax scroll speed' },
  size: { type: 'number', min: 0.5, max: 2.5, default: 1, label: 'Star size' },
  tint: { type: 'number', min: 0, max: 1, default: 0.3, label: 'Accent tint', description: 'Share of stars tinted toward the accent' },
} as const;

type Star = { x: number; y: number; r: number; a: number; tw: number; ph: number; tinted: boolean };

/** Parallax starfield in up to three depth bands with per-star twinkle. */
export const starfieldLayer: Layer = {
  id: 'starfield',
  label: 'Starfield',
  description: 'Parallax stars in depth bands with gentle twinkle.',
  tags: ['space', 'calm', 'motion'],
  schema,
  canvas(host) {
    const { ctx, rng } = host;
    const o = host.options as { density: number; bands: number; twinkle: number; drift: number; size: number; tint: number };
    const ink = color(host, 'ink');
    const accent = color(host, 'accent');
    const bands: Star[][] = [];
    const perBand = Math.round(90 * o.density);
    for (let b = 0; b < o.bands; b++) {
      const stars: Star[] = [];
      const depth = (b + 1) / o.bands; // 1 = nearest
      for (let i = 0; i < perBand; i++) {
        stars.push({
          x: rng(),
          y: rng(),
          r: (0.4 + rng() * 0.9) * depth * o.size,
          a: 0.25 + rng() * 0.6 * depth,
          tw: 0.5 + rng() * 2,
          ph: rng() * 6.283,
          tinted: rng() < o.tint,
        });
      }
      bands.push(stars);
    }
    return {
      frame({ t }) {
        const { width, height } = host.viewport;
        const intensity = host.intensity;
        const scroll = t * o.drift * 12 * intensity;
        const shown = Math.max(0.35, host.quality);
        for (let b = 0; b < bands.length; b++) {
          const depth = (b + 1) / bands.length;
          const stars = bands[b];
          const count = Math.floor(stars.length * shown);
          const offset = scroll * depth;
          for (let i = 0; i < count; i++) {
            const s = stars[i];
            const x = wrap(s.x * width - offset, width);
            const y = s.y * height;
            const tw = o.twinkle > 0 ? 1 - o.twinkle * 0.5 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph)) : 1;
            ctx.fillStyle = rgbaOf(s.tinted ? accent : ink, s.a * tw * (0.6 + 0.4 * intensity));
            ctx.beginPath();
            ctx.arc(x, y, s.r, 0, 6.283);
            ctx.fill();
          }
        }
      },
    };
  },
};
