import type { Layer } from '../core/layer';

const schema = {
  spacing: { type: 'number', min: 2, max: 12, step: 1, default: 4, label: 'Spacing (px)' },
  opacity: { type: 'number', min: 0, max: 0.4, step: 0.01, default: 0.08, label: 'Opacity' },
  color: { type: 'enum', values: ['dark', 'light'], default: 'dark', label: 'Line color' },
} as const;

/** CRT-style horizontal lines as a DOM layer. */
export const scanlinesLayer: Layer = {
  id: 'scanlines',
  label: 'Scanlines',
  description: 'Repeating horizontal lines for a terminal or CRT feel.',
  tags: ['finish', 'retro', 'terminal'],
  schema,
  // A finishing texture: it must sit over the canvas, which is otherwise opaque.
  domPlacement: 'above',
  dom(root, { options }) {
    const o = options as { spacing: number; opacity: number; color: string };
    const line = o.color === 'light' ? '255,255,255' : '0,0,0';
    const el = document.createElement('div');
    el.className = 'bge-scanlines';
    el.style.cssText = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',
      `opacity:${o.opacity}`,
      `background-image:repeating-linear-gradient(to bottom, rgba(${line},1) 0px, rgba(${line},1) 1px, transparent 1px, transparent ${o.spacing}px)`,
      'z-index:22',
    ].join(';');
    root.appendChild(el);
    return () => el.remove();
  },
  snapshot(ctx, viewport, { options }) {
    const o = options as { spacing: number; opacity: number; color: string };
    ctx.save();
    ctx.globalAlpha *= o.opacity;
    ctx.fillStyle = o.color === 'light' ? '#ffffff' : '#000000';
    for (let y = 0; y < viewport.height; y += o.spacing) ctx.fillRect(0, y, viewport.width, 1);
    ctx.restore();
  },
};
