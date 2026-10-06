/**
 * Light and the finishing passes: what makes a frame look lit rather than drawn.
 *
 * - `createGlow`: cached radial halos by color, drawn with alpha (no shadowBlur).
 * - `createBloom`: a soft halo for a small source canvas (downscaled twice, drawn back up
 *   additively). Fields drawn at quarter resolution bloom almost for free.
 * - `createGrain`: a fixed noise tile drawn at a moving offset (film, paper tooth).
 * - `vignette`: the edge of the lamp's light.
 */
import { hexA } from '../skins/instruments/kit';

export type Glow = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) => void;

export function createGlow(soft = 0.35): Glow {
  const cache = new Map<string, HTMLCanvasElement>();
  return (ctx, x, y, r, color, a) => {
    if (r <= 0.5 || a <= 0.01) return;
    let s = cache.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(soft, hexA(color, 0.3));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      cache.set(color, s);
    }
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prev;
  };
}

export function createBloom() {
  let a: HTMLCanvasElement | null = null;
  let b: HTMLCanvasElement | null = null;
  const fit = (c: HTMLCanvasElement | null, w: number, h: number) => {
    const cc = c ?? document.createElement('canvas');
    if (cc.width !== w || cc.height !== h) {
      cc.width = w;
      cc.height = h;
    }
    return cc;
  };
  return {
    /** Draw `src` (already placed at dx, dy, dw, dh) a second and third time, blurred. */
    draw(ctx: CanvasRenderingContext2D, src: CanvasImageSource & { width: number; height: number }, dx: number, dy: number, dw: number, dh: number, strength: number) {
      if (strength <= 0) return;
      a = fit(a, Math.max(1, Math.ceil(src.width / 3)), Math.max(1, Math.ceil(src.height / 3)));
      b = fit(b, Math.max(1, Math.ceil(src.width / 8)), Math.max(1, Math.ceil(src.height / 8)));
      const ga = a.getContext('2d')!;
      const gb = b.getContext('2d')!;
      ga.imageSmoothingEnabled = gb.imageSmoothingEnabled = true;
      ga.clearRect(0, 0, a.width, a.height);
      ga.drawImage(src, 0, 0, a.width, a.height);
      gb.clearRect(0, 0, b.width, b.height);
      gb.drawImage(a, 0, 0, b.width, b.height);
      const prevOp = ctx.globalCompositeOperation;
      const prevA = ctx.globalAlpha;
      const prevS = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = strength * 0.6;
      ctx.drawImage(a, dx, dy, dw, dh);
      ctx.globalAlpha = strength * 0.5;
      ctx.drawImage(b, dx, dy, dw, dh);
      ctx.globalCompositeOperation = prevOp;
      ctx.globalAlpha = prevA;
      ctx.imageSmoothingEnabled = prevS;
    },
  };
}

/** A grain tile from a seeded stream (deterministic), drawn at a frame-stepped offset. */
export function createGrain(rnd: () => number, size = 128) {
  let tile: HTMLCanvasElement | null = null;
  return (ctx: CanvasRenderingContext2D, W: number, H: number, t: number, amount: number, mode: GlobalCompositeOperation = 'overlay') => {
    if (amount <= 0) return;
    if (!tile) {
      tile = document.createElement('canvas');
      tile.width = tile.height = size;
      const g = tile.getContext('2d')!;
      const img = g.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        const v = 128 + (rnd() - 0.5) * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    const pat = ctx.createPattern(tile, 'repeat');
    if (!pat) return;
    const step = Math.floor(t * 12);
    const ox = ((step * 37) % size) - size;
    const oy = ((step * 53) % size) - size;
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = amount;
    ctx.translate(ox, oy);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W + size, H + size);
    ctx.restore();
  };
}

export function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, strength: number, color = '2,2,8') {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength.toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
