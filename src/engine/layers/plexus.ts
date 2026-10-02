import type { Layer } from '../core/layer';
import { color, frames60, QUIET_FIELD, quietFactor, rgbaOf, TAU, wrap } from './util';

const schema = {
  count: { type: 'number', min: 10, max: 300, step: 1, default: 120, label: 'Nodes' },
  radius: { type: 'number', min: 40, max: 300, default: 120, label: 'Link radius (px)' },
  speed: { type: 'number', min: 0, max: 2, default: 0.5, label: 'Speed' },
  pointerRadius: { type: 'number', min: 0, max: 600, default: 160, label: 'Pointer radius (px)', description: '0 disables pointer links' },
  lineAlpha: { type: 'number', min: 0, max: 1, default: 0.35, label: 'Line opacity' },
  color: { type: 'color', default: 'accent', label: 'Color' },
  quiet: QUIET_FIELD,
} as const;

type Node = { x: number; y: number; vx: number; vy: number; r: number; par: number };

/** Drifting nodes linked when close, with optional pointer links. Layer form of the drifting-dust skin. */
export const plexusLayer: Layer = {
  id: 'plexus',
  label: 'Plexus network',
  description: 'Nodes that link when near; the classic particle network, done with restraint.',
  tags: ['motion', 'tech', 'data', 'interactive'],
  schema,
  canvas(host) {
    const { ctx, rng, pointer } = host;
    const o = host.options as { count: number; radius: number; speed: number; pointerRadius: number; lineAlpha: number; color: string; quiet: number };
    let qf = new Float32Array(Math.round(o.count));
    const c = color(host, o.color);
    const nodes: Node[] = Array.from({ length: Math.round(o.count) }, () => ({
      x: rng(),
      y: rng(),
      vx: (rng() - 0.5) * 0.4,
      vy: (rng() - 0.5) * 0.4,
      r: 1 + rng() * 1.5,
      par: 0.6 + rng() * 0.4,
    }));
    const pos = nodes.map(() => ({ x: 0, y: 0 }));
    let cam = 0;
    return {
      frame({ dt }) {
        const { width, height } = host.viewport;
        const f = frames60(dt) * host.intensity;
        const count = Math.floor(nodes.length * Math.max(0.3, host.quality));
        cam += o.speed * 0.25 * f;
        for (let i = 0; i < count; i++) {
          const n = nodes[i];
          n.x += (n.vx * f * o.speed) / width;
          n.y += (n.vy * f * o.speed) / height;
          pos[i].x = wrap(n.x * width - cam * n.par, width);
          pos[i].y = wrap(n.y * height - cam * 0.5 * n.par, height);
        }
        const rad = o.radius;
        const radSq = rad * rad;
        if (qf.length < count) qf = new Float32Array(count);
        for (let i = 0; i < count; i++) qf[i] = quietFactor(host, pos[i].x, pos[i].y, o.quiet);
        ctx.lineWidth = 1;
        for (let i = 0; i < count; i++) {
          const a = pos[i];
          for (let j = i + 1; j < count; j++) {
            const b = pos[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            if (Math.abs(dx) > rad || Math.abs(dy) > rad) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 >= radSq) continue;
            const alpha = (1 - Math.sqrt(d2) / rad) * o.lineAlpha * Math.min(qf[i], qf[j]);
            if (alpha < 0.005) continue;
            ctx.strokeStyle = rgbaOf(c, alpha);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (o.pointerRadius > 0 && pointer.active && pointer.idle < 2) {
          const fade = 1 - Math.min(1, pointer.idle / 2);
          const pr2 = o.pointerRadius * o.pointerRadius;
          for (let i = 0; i < count; i++) {
            const p = pos[i];
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < pr2) {
              ctx.strokeStyle = rgbaOf(c, (1 - Math.sqrt(d2) / o.pointerRadius) * o.lineAlpha * fade);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(pointer.x, pointer.y);
              ctx.stroke();
            }
          }
        }
        for (let i = 0; i < count; i++) {
          if (qf[i] < 0.02) continue;
          ctx.fillStyle = rgbaOf(c, 0.8 * qf[i]);
          ctx.beginPath();
          ctx.arc(pos[i].x, pos[i].y, nodes[i].r, 0, TAU);
          ctx.fill();
        }
      },
    };
  },
};
