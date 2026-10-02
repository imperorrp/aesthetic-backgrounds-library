import type { Layer } from '../core/layer';
import { color, frames60, QUIET_FIELD, rgbaOf } from './util';

const schema = {
  lines: { type: 'number', min: 20, max: 800, step: 1, default: 220, label: 'Streams' },
  scale: { type: 'number', min: 0.3, max: 4, default: 1.4, label: 'Field scale', description: 'Noise frequency of the flow field' },
  speed: { type: 'number', min: 0, max: 2, default: 0.6, label: 'Speed' },
  trail: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Trail length' },
  width: { type: 'number', min: 0.5, max: 3, default: 1, label: 'Stroke width' },
  evolve: { type: 'number', min: 0, max: 1, default: 0.3, label: 'Evolution', description: 'How fast the field itself changes' },
  color: { type: 'color', default: 'accent', label: 'Color' },
  quiet: QUIET_FIELD,
} as const;

type S = { x: number; y: number; life: number };

/**
 * Streamlines following a curl-like noise field, drawn as short fading strokes.
 * Uses its own surface because the trail fade must not erase layers beneath.
 */
export const flowFieldLayer: Layer = {
  id: 'flow-field',
  label: 'Flow field',
  description: 'Streamlines tracing a slowly evolving noise field.',
  tags: ['motion', 'data', 'science', 'calm'],
  surface: 'own',
  schema,
  canvas(host) {
    const { ctx, rng, noise } = host;
    const o = host.options as { lines: number; scale: number; speed: number; trail: number; width: number; evolve: number; color: string; quiet: number };
    // Per-stream dither threshold: behind content a stream draws only when its threshold
    // clears the local quietness, thinning the field there while keeping one batched stroke.
    const dither = Array.from({ length: Math.round(o.lines) }, (_, i) => ((Math.imul(i + 1, 2654435761) >>> 0) % 1000) / 1000);
    const c = color(host, o.color);
    const streams: S[] = Array.from({ length: Math.round(o.lines) }, () => ({ x: rng(), y: rng(), life: rng() * 200 }));
    const respawn = (s: S) => {
      s.x = rng();
      s.y = rng();
      s.life = 80 + rng() * 240;
    };
    return {
      resize() {
        ctx.clearRect(0, 0, host.viewport.width, host.viewport.height);
      },
      frame({ t, dt }) {
        const { width, height } = host.viewport;
        const f = frames60(dt);
        // Fade the previous frame toward transparent; longer trail = slower fade.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (0.16 - o.trail * 0.14) * f)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        const count = Math.floor(streams.length * Math.max(0.3, host.quality));
        const step = (o.speed * 0.0022 + 0.0004) * f * host.intensity;
        const tt = t * o.evolve * 0.15;
        ctx.lineWidth = o.width;
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgbaOf(c, 0.35 + 0.35 * host.intensity);
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const s = streams[i];
          const angle = noise.fbm2(s.x * o.scale, s.y * o.scale + tt, 2) * Math.PI * 2;
          const nx = s.x + Math.cos(angle) * step;
          const ny = s.y + Math.sin(angle) * step * (width / height);
          const px = s.x * width;
          const py = s.y * height;
          if (o.quiet <= 0 || dither[i] >= o.quiet * host.quiet(px, py)) {
            ctx.moveTo(px, py);
            ctx.lineTo(nx * width, ny * height);
          }
          s.x = nx;
          s.y = ny;
          s.life -= f;
          if (s.life <= 0 || nx < -0.02 || nx > 1.02 || ny < -0.02 || ny > 1.02) respawn(s);
        }
        ctx.stroke();
      },
    };
  },
};
