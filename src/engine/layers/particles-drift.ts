import type { Layer } from '../core/layer';
import { color, frames60, glowSprite, rgbaOf, TAU, wrap } from './util';

const schema = {
  count: { type: 'number', min: 5, max: 400, step: 1, default: 80, label: 'Count' },
  size: { type: 'number', min: 0.5, max: 8, default: 2, label: 'Size' },
  speed: { type: 'number', min: 0, max: 2, default: 0.4, label: 'Speed' },
  glow: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Glow' },
  pulse: { type: 'number', min: 0, max: 1, default: 0.35, label: 'Pulse', description: 'Brightness breathing' },
  turbulence: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Turbulence', description: 'How much the noise field bends paths' },
  color: { type: 'color', default: 'accent', label: 'Color' },
} as const;

type P = { x: number; y: number; s: number; ph: number; sp: number };

/** Soft points carried by a noise flow field. Fireflies, dust, embers, snow depending on the palette and speed. */
export const particlesDriftLayer: Layer = {
  id: 'particles-drift',
  label: 'Drifting particles',
  description: 'Glowing points carried by a gentle noise flow.',
  tags: ['motion', 'calm', 'nature', 'light-ok'],
  schema,
  canvas(host) {
    const { ctx, rng, noise } = host;
    const o = host.options as { count: number; size: number; speed: number; glow: number; pulse: number; turbulence: number; color: string };
    const c = color(host, o.color);
    const ps: P[] = Array.from({ length: Math.round(o.count) }, () => ({
      x: rng(),
      y: rng(),
      s: 0.5 + rng(),
      ph: rng() * TAU,
      sp: 0.6 + rng() * 0.8,
    }));
    const sprite = o.glow > 0 ? glowSprite(c.rgb, 16) : null;
    return {
      frame({ t, dt }) {
        const { width, height } = host.viewport;
        const f = frames60(dt) * host.intensity;
        const count = Math.floor(ps.length * Math.max(0.3, host.quality));
        const scale = 1.6;
        for (let i = 0; i < count; i++) {
          const p = ps[i];
          const angle = noise.noise2(p.x * scale + 7, p.y * scale + t * 0.05) * Math.PI * (0.5 + o.turbulence * 1.5);
          const v = (o.speed * 0.0007 + 0.0002) * p.sp * f;
          p.x = wrap(p.x + Math.cos(angle) * v, 1);
          p.y = wrap(p.y + Math.sin(angle) * v - v * 0.3, 1);
          const pulse = 1 - o.pulse * 0.5 * (0.5 + 0.5 * Math.sin(t * p.sp * 1.5 + p.ph));
          const r = o.size * p.s;
          const x = p.x * width;
          const y = p.y * height;
          const a = (0.55 + 0.45 * host.intensity) * pulse;
          if (sprite) {
            const gr = r * (3 + o.glow * 5);
            ctx.globalAlpha = a * o.glow * 0.6;
            ctx.drawImage(sprite, x - gr, y - gr, gr * 2, gr * 2);
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = rgbaOf(c, a);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.fill();
        }
      },
    };
  },
};
