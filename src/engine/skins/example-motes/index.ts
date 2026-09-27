import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import { resolveOptions, resolveColor } from '../../core/schema';
import { rgba } from '../../palette';

/**
 * Example motes
 *
 * Conventions this skin follows (keep them; the gates check most of them):
 * - randomness only from host.rng / host.fork(), never Math.random
 * - time only from FrameInfo (t, dt); no Date.now, performance.now, or timers
 * - colors from host.palette or schema color fields, never hardcoded
 * - motion scaled by dt (seconds) and host.intensity; detail by host.quality
 * - everything released in destroy()
 */
const schema = {
  count: { type: 'number', min: 10, max: 400, step: 1, default: 90, label: 'Count' },
  size: { type: 'number', min: 0.5, max: 6, default: 2, label: 'Size' },
  speed: { type: 'number', min: 0, max: 2, default: 0.5, label: 'Speed' },
  color: { type: 'color', default: 'accent', label: 'Color', description: 'Palette token (accent, ink, inkDim, bg, hazard) or hex' },
} as const;

export type ExampleMotesOptions = Partial<{
  count: number;
  size: number;
  speed: number;
  color: string;
}>;

type Mote = { x: number; y: number; vx: number; vy: number; r: number; phase: number };

export const exampleMotesSkin: BackgroundSkin<ExampleMotesOptions> = {
  id: 'example-motes',
  label: 'Example motes',
  description: 'TODO: one sentence on the look and the niche it serves.',
  tags: ["example","calm"],
  schema,
  // Config applied beneath the caller's config. Pick the palette this skin is designed for.
  defaults: { palette: 'void-cyan', intensity: 0.8 },
  mount(host: SkinHost<ExampleMotesOptions>) {
    const { ctx, rng, noise, palette } = host;
    const o = resolveOptions(schema, host.options);
    const color = resolveColor(o.color, palette);

    // World generation in normalized coordinates so a resize only rescales.
    const motes: Mote[] = Array.from({ length: o.count }, () => ({
      x: rng(),
      y: rng(),
      vx: (rng() - 0.5) * 0.02,
      vy: (rng() - 0.5) * 0.02,
      r: (0.5 + rng()) * o.size,
      phase: rng() * Math.PI * 2,
    }));

    return {
      resize(_viewport: Viewport) {
        // Regenerate size-dependent caches here if you have any.
      },
      frame({ t, dt }: FrameInfo) {
        const { width, height } = host.viewport;
        const speed = o.speed * host.intensity * dt;
        const shown = Math.floor(motes.length * Math.max(0.3, host.quality));
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < shown; i++) {
          const m = motes[i];
          const drift = noise.noise2(m.x * 2, m.y * 2 + t * 0.05) * Math.PI;
          m.x = ((m.x + (m.vx + Math.cos(drift) * 0.01) * speed) % 1 + 1) % 1;
          m.y = ((m.y + (m.vy + Math.sin(drift) * 0.01) * speed) % 1 + 1) % 1;
          const alpha = 0.35 + 0.35 * Math.sin(t * 1.5 + m.phase);
          ctx.fillStyle = rgba(color.rgb, alpha * (0.5 + 0.5 * host.intensity));
          ctx.beginPath();
          ctx.arc(m.x * width, m.y * height, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      destroy() {},
    };
  },
};
