import type { BackgroundSkin, SkinHost, Viewport } from '../../core/skin';

export type MatrixSkinOptions = {
  fontSize?: number;
  fallSpeed?: number;
  charset?: string;
};

const DEFAULT_CHARSET = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレゲゼデベペオォコソトノホモヨョロゴゾドボポヴッン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const matrixRainSkin: BackgroundSkin<MatrixSkinOptions> = {
  id: 'matrix-rain',
  mount(host: SkinHost<MatrixSkinOptions>) {
    const { canvas, ctx, rng, config, options } = host;
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;

    const fontSize = options?.fontSize ?? 16;
    const fallSpeed = options?.fallSpeed ?? 1.0;
    const charset = options?.charset ?? DEFAULT_CHARSET;
    const densityMult = Math.max(0.1, config.density ?? 1);

    let columns = Math.floor(width / fontSize);
    let drops: number[] = [];
    let speeds: number[] = [];

    const initColumns = () => {
      columns = Math.floor(width / fontSize);
      drops = [];
      speeds = [];
      for (let x = 0; x < columns; x++) {
        // Random start position above screen
        drops[x] = (rng() * -height) / fontSize;
        // Density affects whether a column even spawns
        if (rng() > densityMult) {
          drops[x] = -9999; // effectively dead
        }
        speeds[x] = (rng() * 0.5 + 0.5) * fallSpeed;
      }
    };

    initColumns();

    let accentRgbaCache = 'rgba(0, 255, 100, ';
    let paletteCached = false;

    // Fill completely black initially
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    return {
      resize(viewport: Viewport) {
        width = viewport.width;
        height = viewport.height;
        initColumns();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
      },

      frame(timestamp: number) {
        if (!paletteCached) {
          const computed = getComputedStyle(document.body);
          const accentStr = computed.getPropertyValue('--bg-accent').trim();
          if (accentStr) {
            const parts = accentStr.split(',').map(s => parseInt(s.trim(), 10));
            if (parts.length === 3 && !parts.some(isNaN)) {
              accentRgbaCache = `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, `;
            }
          }
          paletteCached = true;
        }

        // Translucent black background to create trail
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, width, height);

        ctx.font = `${fontSize}px "Orbit", "Syne Mono", monospace`;
        ctx.textAlign = 'center';

        for (let i = 0; i < drops.length; i++) {
          if (drops[i] === -9999) continue; // Dead column due to density

          const text = charset.charAt(Math.floor(rng() * charset.length));
          const x = i * fontSize + fontSize / 2;
          const y = drops[i] * fontSize;

          // Draw the trail character (accent color)
          ctx.fillStyle = `${accentRgbaCache}1)`;
          ctx.fillText(text, x, y);

          // Draw a slightly lower "lead" character (white) to make it look like it's falling
          // Actually, standard matrix sets the currently drawn character as lead, 
          // and previous frames become trail naturally due to rgba(0,0,0,0.05).
          // To make the lead white, we draw it white, then next frame the translucent 
          // black covers it, and we don't redraw it. Wait, the translucent black will 
          // quickly turn it gray. 
          // Standard canvas trick:
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, x, y);

          // Standard canvas trick leaves the lead white. Next frame, the translucent rect covers it, 
          // dimming it. But wait, if we drew it white, it stays white-ish. We want it to turn green.
          // To properly do this: The current head is drawn white. We ALSO overwrite the *previous* head
          // with green, so the translucent black doesn't have to shift white to green (which would just be gray).
          if (drops[i] > 0) {
            ctx.fillStyle = `${accentRgbaCache}1)`;
            const prevText = charset.charAt(Math.floor(rng() * charset.length));
            ctx.fillText(prevText, x, y - fontSize);
          }

          drops[i] += speeds[i];

          // Reset drop to top randomly
          if (drops[i] * fontSize > height && rng() > 0.975) {
            drops[i] = 0;
          }
        }
      },

      destroy() {},
    };
  },
};
