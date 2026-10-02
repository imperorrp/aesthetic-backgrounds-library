import type { Layer } from '../core/layer';
import { color, frames60, QUIET_FIELD, quietFactor, rgbaOf } from './util';

const CHARSETS: Record<string, string> = {
  katakana: 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレゲゼデベペオォコソトノホモヨョロゴゾドボポヴッン0123456789',
  hex: '0123456789ABCDEF',
  binary: '01',
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/\\~',
};

const schema = {
  fontSize: { type: 'number', min: 8, max: 40, step: 1, default: 16, label: 'Glyph size (px)' },
  speed: { type: 'number', min: 0.1, max: 3, default: 1, label: 'Fall speed' },
  density: { type: 'number', min: 0.1, max: 1, default: 0.8, label: 'Column density' },
  fade: { type: 'number', min: 0.01, max: 0.3, step: 0.01, default: 0.06, label: 'Fade', description: 'Higher fades trails faster' },
  charset: { type: 'enum', values: ['katakana', 'hex', 'binary', 'latin', 'symbols'], default: 'katakana', label: 'Charset' },
  head: { type: 'color', default: 'ink', label: 'Head color' },
  trail: { type: 'color', default: 'accent', label: 'Trail color' },
  quiet: QUIET_FIELD,
} as const;

type Column = { alive: boolean; row: number; acc: number; speed: number; glyph: string };

/** Falling glyph columns with persistent, fading trails. Layer form of the matrix-rain skin. */
export const glyphRainLayer: Layer = {
  id: 'glyph-rain',
  label: 'Glyph rain',
  description: 'Falling characters with fading trails; charset, speed, and colors are configurable.',
  tags: ['motion', 'terminal', 'retro'],
  surface: 'own',
  schema,
  canvas(host) {
    const { ctx, rng } = host;
    const o = host.options as { fontSize: number; speed: number; density: number; fade: number; charset: string; head: string; trail: string; quiet: number };
    const head = color(host, o.head);
    const trail = color(host, o.trail);
    const chars = CHARSETS[o.charset] ?? CHARSETS.katakana;
    const font = `${o.fontSize}px "Orbit", "Syne Mono", ui-monospace, monospace`;
    let columns: Column[] = [];
    let rows = 0;
    const init = () => {
      const { width, height } = host.viewport;
      rows = Math.ceil(height / o.fontSize);
      columns = Array.from({ length: Math.floor(width / o.fontSize) }, () => ({
        alive: rng() <= o.density,
        row: -Math.floor(rng() * rows),
        acc: 0,
        speed: (rng() * 0.5 + 0.5) * o.speed,
        glyph: '',
      }));
    };
    init();
    return {
      resize() {
        init();
        ctx.clearRect(0, 0, host.viewport.width, host.viewport.height);
      },
      frame({ dt }) {
        const { width, height } = host.viewport;
        const f = frames60(dt);
        const share = 0.35 + 0.65 * host.intensity;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, o.fade * f)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < columns.length; i++) {
          const c = columns[i];
          if (!c.alive || (i % 20) / 20 > share) continue;
          c.acc += c.speed * f * (0.4 + 0.6 * host.intensity);
          const x = i * o.fontSize + o.fontSize / 2;
          while (c.acc >= 1) {
            c.acc -= 1;
            if (c.glyph && c.row >= 0 && c.row < rows) {
              ctx.clearRect(i * o.fontSize, c.row * o.fontSize, o.fontSize, o.fontSize);
              ctx.fillStyle = rgbaOf(trail, quietFactor(host, x, c.row * o.fontSize, o.quiet));
              ctx.fillText(c.glyph, x, c.row * o.fontSize);
            }
            c.row += 1;
            if (c.row >= rows) {
              c.glyph = '';
              if (rng() < 0.03) c.row = -Math.floor(rng() * 12) - 1;
              continue;
            }
            if (c.row >= 0) {
              c.glyph = chars.charAt(Math.floor(rng() * chars.length));
              // Heads are the brightest marks; behind text they drop to the trail color.
              const q = quietFactor(host, x, c.row * o.fontSize, o.quiet);
              ctx.fillStyle = q < 0.999 ? rgbaOf(trail, q) : head.hex;
              ctx.fillText(c.glyph, x, c.row * o.fontSize);
            }
          }
        }
      },
    };
  },
};
