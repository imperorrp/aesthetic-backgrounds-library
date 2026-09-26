import type { BackgroundSkin, SkinHost, Viewport } from '../../core/skin';
import { rgba } from '../../palette';

export type MatrixSkinOptions = {
  /** Glyph cell size in CSS px. Default 16. */
  fontSize?: number;
  /** Rows per frame multiplier at 60 fps. Default 1. */
  fallSpeed?: number;
  /** Characters to rain. Default: katakana + digits + Latin capitals. */
  charset?: string;
  /** Fraction of trail alpha removed per 60 fps frame. Higher = shorter trails. Default 0.06. */
  fade?: number;
  /** CSS font shorthand. Defaults to the engine display font stack at `fontSize`. */
  font?: string;
};

const DEFAULT_CHARSET = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレゲゼデベペオォコソトノホモヨョロゴゾドボポヴッン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

type Column = {
  alive: boolean;
  /** Current head row (integer). Negative = above the viewport. */
  row: number;
  /** Fractional progress toward the next row. */
  acc: number;
  speed: number;
  /** Glyph drawn at `row` as the head; recolored as trail when the head advances. */
  glyph: string;
};

/**
 * Glyph rain. Draws only where columns move and fades the previous frame toward
 * transparent, so it composites over the host page or other layers instead of
 * painting an opaque plate. Head glyphs use palette ink, trails use the accent.
 */
export const matrixRainSkin: BackgroundSkin<MatrixSkinOptions> = {
  id: 'matrix-rain',
  mount(host: SkinHost<MatrixSkinOptions>) {
    const { canvas, ctx, rng, config, options, palette } = host;
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;

    const fontSize = options?.fontSize ?? 16;
    const fallSpeed = options?.fallSpeed ?? 1.0;
    const charset = options?.charset ?? DEFAULT_CHARSET;
    const fade = options?.fade ?? 0.06;
    const font = options?.font ?? `${fontSize}px "Orbit", "Syne Mono", ui-monospace, monospace`;
    const densityMult = Math.max(0.1, Math.min(1, config.density ?? 1));

    const headColor = palette.ink;
    const trailColor = rgba(palette.accentRgb, 1);

    let columns: Column[] = [];
    let rows = 0;

    const initColumns = () => {
      rows = Math.ceil(height / fontSize);
      const count = Math.floor(width / fontSize);
      columns = [];
      for (let i = 0; i < count; i++) {
        columns.push({
          alive: rng() <= densityMult,
          row: -Math.floor(rng() * rows),
          acc: 0,
          speed: (rng() * 0.5 + 0.5) * fallSpeed,
          glyph: '',
        });
      }
    };

    const randomGlyph = () => charset.charAt(Math.floor(rng() * charset.length));

    initColumns();
    let lastTime = 0;

    return {
      resize(viewport: Viewport) {
        width = viewport.width;
        height = viewport.height;
        initColumns();
        ctx.clearRect(0, 0, width, height);
      },

      frame(timestamp: number) {
        const dt = lastTime ? Math.min(3, (timestamp - lastTime) / 16.667) : 1;
        lastTime = timestamp;

        // Fade everything drawn so far toward transparent (trail effect without an opaque plate).
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, fade * dt)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i < columns.length; i++) {
          const c = columns[i];
          if (!c.alive) continue;

          c.acc += c.speed * dt;
          const x = i * fontSize + fontSize / 2;

          while (c.acc >= 1) {
            c.acc -= 1;

            // The old head becomes trail: clear the cell and redraw the same glyph in accent.
            if (c.glyph && c.row >= 0 && c.row < rows) {
              ctx.clearRect(i * fontSize, c.row * fontSize, fontSize, fontSize);
              ctx.fillStyle = trailColor;
              ctx.fillText(c.glyph, x, c.row * fontSize);
            }

            c.row += 1;

            if (c.row >= rows) {
              // Fell off the bottom: wait a random while, then restart above the top.
              c.glyph = '';
              if (rng() < 0.03) c.row = -Math.floor(rng() * 12) - 1;
              continue;
            }

            if (c.row >= 0) {
              c.glyph = randomGlyph();
              ctx.fillStyle = headColor;
              ctx.fillText(c.glyph, x, c.row * fontSize);
            }
          }
        }
      },

      destroy() {},
    };
  },
};
