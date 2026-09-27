import type { Layer } from '../core/layer';

const schema = {
  opacity: { type: 'number', min: 0, max: 0.4, step: 0.01, default: 0.09, label: 'Opacity' },
  scale: { type: 'number', min: 0.3, max: 2, default: 0.9, label: 'Scale', description: 'Noise frequency; higher is finer' },
  blend: { type: 'enum', values: ['overlay', 'soft-light', 'multiply', 'screen', 'normal'], default: 'overlay', label: 'Blend' },
} as const;

/** Film grain as a GPU-composited DOM layer (SVG feTurbulence). Hides gradient banding for free. */
export const grainLayer: Layer = {
  id: 'grain',
  label: 'Grain',
  description: 'Static film grain via SVG turbulence.',
  tags: ['finish', 'texture', 'light-ok'],
  schema,
  dom(root, { options }) {
    const o = options as { opacity: number; scale: number; blend: string };
    const el = document.createElement('div');
    el.className = 'bge-grain';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${o.scale.toFixed(2)}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
    el.style.cssText = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',
      `opacity:${o.opacity}`,
      `mix-blend-mode:${o.blend}`,
      `background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      'background-size:256px 256px',
      'z-index:3',
    ].join(';');
    root.appendChild(el);
    return () => el.remove();
  },
};
