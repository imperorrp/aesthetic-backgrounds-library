import type { Layer } from '../core/layer';
import { color, rgbaOf } from './util';

const schema = {
  x: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Center X', description: 'Fraction of the width' },
  y: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Center Y', description: 'Fraction of the height' },
  width: { type: 'number', min: 0.1, max: 1, default: 0.6, label: 'Width', description: 'Fraction of the canvas width' },
  height: { type: 'number', min: 0.1, max: 1, default: 0.7, label: 'Height', description: 'Fraction of the canvas height' },
  strength: { type: 'number', min: 0, max: 1, default: 0.55, label: 'Strength' },
  feather: { type: 'number', min: 0, max: 400, default: 160, label: 'Feather (px)' },
  color: { type: 'color', default: 'bg', label: 'Shade color' },
} as const;

/**
 * Legibility mask: a feathered rectangle of the background color behind where the
 * page's text sits, so the busiest scene still passes a contrast check. Rendered
 * once per size into a cached sprite and blitted each frame.
 */
export const contentShadeLayer: Layer = {
  id: 'content-shade',
  label: 'Content shade',
  description: 'Feathered shade behind the content area to keep text legible.',
  tags: ['finish', 'legibility', 'light-ok'],
  schema,
  canvas(host) {
    const { ctx } = host;
    const o = host.options as { x: number; y: number; width: number; height: number; strength: number; feather: number; color: string };
    const c = color(host, o.color);
    let sprite: HTMLCanvasElement | null = null;
    let spriteKey = '';
    const build = () => {
      const { width, height, dpr } = host.viewport;
      const key = `${width}x${height}@${dpr}`;
      if (sprite && spriteKey === key) return sprite;
      spriteKey = key;
      const s = document.createElement('canvas');
      s.width = Math.max(1, Math.round(width * dpr));
      s.height = Math.max(1, Math.round(height * dpr));
      const sc = s.getContext('2d')!;
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = o.width * width;
      const h = o.height * height;
      const x = o.x * width - w / 2;
      const y = o.y * height - h / 2;
      // Draw the rect far offscreen and let only its blurred shadow land in place.
      sc.shadowColor = rgbaOf(c, o.strength);
      sc.shadowBlur = o.feather;
      sc.shadowOffsetX = 100000;
      sc.shadowOffsetY = 0;
      sc.fillStyle = 'rgba(0,0,0,1)';
      sc.fillRect(x - 100000, y, w, h);
      sc.shadowColor = 'transparent';
      sc.shadowBlur = 0;
      sc.shadowOffsetX = 0;
      // Solid core so the center is fully shaded regardless of feather.
      sc.fillStyle = rgbaOf(c, o.strength);
      sc.fillRect(x + o.feather * 0.35, y + o.feather * 0.35, Math.max(0, w - o.feather * 0.7), Math.max(0, h - o.feather * 0.7));
      sprite = s;
      return s;
    };
    return {
      frame() {
        const { width, height } = host.viewport;
        ctx.drawImage(build(), 0, 0, width, height);
      },
    };
  },
};
