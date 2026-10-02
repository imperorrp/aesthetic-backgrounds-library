import type { Layer, LayerHost } from '../core/layer';
import { color, glowSprite, QUIET_FIELD, quietFactor, rgbaOf, TAU } from './util';

const schema = {
  rate: { type: 'number', min: 0.1, max: 6, default: 1.2, label: 'Events per minute', description: 'Average; the gaps are random so it never feels scheduled' },
  kinds: { type: 'enum', values: ['mixed', 'meteors', 'comets', 'flares'], default: 'mixed', label: 'Kinds' },
  size: { type: 'number', min: 0.5, max: 2, default: 1, label: 'Size' },
  color: { type: 'color', default: 'ink', label: 'Color' },
  quiet: { ...QUIET_FIELD, default: 0.9, description: 'Events are placed away from page text; this also fades any that drift behind it' },
} as const;

type Kind = 'meteor' | 'comet' | 'flare';

type Moment = {
  kind: Kind;
  start: number;
  duration: number;
  /** Normalized start and end positions. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  scale: number;
};

const smooth = (t: number) => t * t * (3 - 2 * t);
/** Rises over the first `rise` share of the event, holds, falls over the last `fall` share. */
const envelope = (p: number, rise: number, fall: number) => (p < rise ? smooth(p / rise) : p > 1 - fall ? smooth((1 - p) / fall) : 1);

/**
 * Rare events that reward a long look: a meteor streak, a slow comet whose tail
 * points away from the scene light, or a star flaring with diffraction spikes.
 * Scheduled in simulation time from a forked seed, so a seed replays the same
 * events at the same moments. Never more than one at a time; placed away from
 * page content; only flares (no traversal) under reduced motion.
 */
export const momentsLayer: Layer = {
  id: 'moments',
  label: 'Moments',
  description: 'Rare seeded events: meteors, comets with tails away from the light, flaring stars.',
  tags: ['space', 'calm', 'motion', 'rare'],
  schema,
  canvas(host: LayerHost) {
    const { ctx, light } = host;
    const o = host.options as { rate: number; kinds: string; size: number; color: string; quiet: number };
    const c = color(host, o.color);
    const rng = host.fork(`moments:${o.kinds}`);
    const sprite = glowSprite(c.rgb, 24, 1.4);
    let current: Moment | null = null;
    // First event a few seconds in, then exponential gaps around the mean.
    let next = 3 + rng() * 5;

    const meanGap = () => 60 / Math.max(0.1, o.rate);
    const gap = () => Math.min(180, Math.max(4, -Math.log(1 - rng() * 0.999) * meanGap()));

    /** A spot with little page content around it, from a handful of seeded tries. */
    const openSpot = (yMax = 1): [number, number] => {
      const { width, height } = host.viewport;
      let best: [number, number] = [rng(), rng() * yMax];
      let bestQ = Infinity;
      for (let i = 0; i < 8; i++) {
        const x = 0.06 + rng() * 0.88;
        const y = 0.06 + rng() * (yMax - 0.12);
        const q = host.quiet(x * width, y * height);
        if (q < bestQ) {
          bestQ = q;
          best = [x, y];
        }
        if (q < 0.05) break;
      }
      return best;
    };

    const spawn = (t: number): Moment => {
      const reduced = host.motion === 'reduced';
      const pool: Kind[] =
        reduced ? ['flare'] : o.kinds === 'meteors' ? ['meteor'] : o.kinds === 'comets' ? ['comet'] : o.kinds === 'flares' ? ['flare'] : ['meteor', 'meteor', 'comet', 'flare'];
      const kind = pool[Math.floor(rng() * pool.length)];
      const scale = o.size * (0.8 + rng() * 0.5);
      if (kind === 'flare') {
        const [x, y] = openSpot();
        return { kind, start: t, duration: 2.4 + rng(), x0: x, y0: y, x1: x, y1: y, scale };
      }
      if (kind === 'meteor') {
        const [x, y] = openSpot(0.55);
        // Falls down and across, away from the side the light is on.
        const dir = light.dx > 0 ? -1 : 1;
        const len = 0.18 + rng() * 0.16;
        const a = (Math.PI / 180) * (25 + rng() * 25);
        return { kind, start: t, duration: 0.9 + rng() * 0.6, x0: x, y0: y, x1: x + Math.cos(a) * len * dir, y1: y + Math.sin(a) * len, scale };
      }
      // Comet: a slow drift across a quarter of the sky.
      const [x, y] = openSpot(0.7);
      const a = rng() * TAU;
      const len = 0.08 + rng() * 0.08;
      return { kind, start: t, duration: 7 + rng() * 4, x0: x, y0: y, x1: x + Math.cos(a) * len, y1: y + Math.sin(a) * len, scale };
    };

    const drawMeteor = (m: Moment, p: number, alpha: number, w: number, h: number) => {
      const head = smooth(p);
      const hx = (m.x0 + (m.x1 - m.x0) * head) * w;
      const hy = (m.y0 + (m.y1 - m.y0) * head) * h;
      const vx = (m.x1 - m.x0) * w;
      const vy = (m.y1 - m.y0) * h;
      const len = Math.hypot(vx, vy) || 1;
      const tail = 140 * m.scale * (0.4 + 0.6 * Math.min(1, p * 3));
      const tx = hx - (vx / len) * tail;
      const ty = hy - (vy / len) * tail;
      const a = alpha * quietFactor(host, hx, hy, o.quiet);
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, rgbaOf(c, 0));
      g.addColorStop(1, rgbaOf(c, a * 0.9));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4 * m.scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      const r = 7 * m.scale;
      ctx.globalAlpha = a * 0.8;
      ctx.drawImage(sprite, hx - r, hy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    };

    const drawComet = (m: Moment, p: number, alpha: number, w: number, h: number) => {
      const hx = (m.x0 + (m.x1 - m.x0) * p) * w;
      const hy = (m.y0 + (m.y1 - m.y0) * p) * h;
      const a = alpha * quietFactor(host, hx, hy, o.quiet);
      // The tail points away from the light, as a real comet's points away from its star.
      const tail = 120 * m.scale;
      const tx = hx - light.dx * tail;
      const ty = hy - light.dy * tail;
      const nx = -light.dy;
      const ny = light.dx;
      const spread = 16 * m.scale;
      const g = ctx.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, rgbaOf(c, a * 0.45));
      g.addColorStop(1, rgbaOf(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(hx + nx * 2, hy + ny * 2);
      ctx.lineTo(tx + nx * spread, ty + ny * spread);
      ctx.lineTo(tx - nx * spread, ty - ny * spread);
      ctx.lineTo(hx - nx * 2, hy - ny * 2);
      ctx.closePath();
      ctx.fill();
      const r = 10 * m.scale;
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, hx - r, hy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    };

    const drawFlare = (m: Moment, p: number, alpha: number, w: number, h: number) => {
      const x = m.x0 * w;
      const y = m.y0 * h;
      const a = alpha * quietFactor(host, x, y, o.quiet);
      const bloom = 0.6 + 0.4 * Math.sin(p * Math.PI);
      const r = 16 * m.scale * bloom;
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      // Four-point diffraction spikes, the long pair aligned with the light.
      const spike = 34 * m.scale * bloom;
      const ang = Math.atan2(light.dy, light.dx);
      ctx.strokeStyle = rgbaOf(c, a * 0.55);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const t = ang + (i * Math.PI) / 2;
        const l = i % 2 === 0 ? spike : spike * 0.55;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(t) * l, y + Math.sin(t) * l);
      }
      ctx.stroke();
    };

    return {
      frame({ t }) {
        if (host.motion === 'off') return;
        if (!current && t >= next) current = spawn(t);
        if (!current) return;
        const p = (t - current.start) / current.duration;
        if (p >= 1) {
          current = null;
          next = t + gap() * (host.motion === 'reduced' ? 2 : 1);
          return;
        }
        const { width, height } = host.viewport;
        const alpha = (0.45 + 0.55 * host.intensity) * envelope(p, current.kind === 'meteor' ? 0.12 : 0.25, current.kind === 'meteor' ? 0.35 : 0.3);
        if (current.kind === 'meteor') drawMeteor(current, p, alpha, width, height);
        else if (current.kind === 'comet') drawComet(current, p, alpha, width, height);
        else drawFlare(current, p, alpha, width, height);
      },
    };
  },
};
