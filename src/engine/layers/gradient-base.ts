import type { Layer } from '../core/layer';
import { color, rgbaOf, shiftHue, tripletOf, warmTint } from './util';

const schema = {
  tint: { type: 'number', min: 0, max: 1, default: 0.35, label: 'Accent tint', description: 'How much accent bleeds into the plate' },
  drift: { type: 'number', min: 0, max: 1, default: 0.3, label: 'Drift', description: 'Speed of the slow light movement' },
  spread: { type: 'number', min: 0, max: 120, default: 40, label: 'Hue spread', description: 'Degrees between the two tint lights when the secondary is `spread`' },
  secondary: {
    type: 'enum',
    values: ['harmony', 'spread'],
    default: 'harmony',
    label: 'Fill light hue',
    description: '`harmony` uses the palette\'s second hue; `spread` shifts the accent by `spread` degrees',
  },
  followLight: {
    type: 'boolean',
    default: true,
    label: 'Follow scene light',
    description: 'Place the key glow where the scene light comes from and the fill opposite it',
  },
  opaque: { type: 'boolean', default: true, label: 'Opaque plate', description: 'Fill with the palette background first' },
} as const;

/**
 * The plate everything else sits on: palette background lit by a key glow from the
 * scene light and a dimmer fill across from it, both drifting slowly. Warmth from
 * the scene light tints both. Calm by construction; carries light themes too.
 */
export const gradientBaseLayer: Layer = {
  id: 'gradient-base',
  label: 'Gradient base',
  description: 'Palette background plate lit by a key glow from the scene light and a softer fill.',
  tags: ['base', 'calm', 'light-ok'],
  schema,
  canvas(host) {
    const { ctx, palette, noise, light: sceneLight } = host;
    const o = host.options as { tint: number; drift: number; spread: number; secondary: string; followLight: boolean; opaque: boolean };
    const keyHex = warmTint(palette.accent, sceneLight.warmth);
    const fillBase = o.secondary === 'harmony' ? palette.accent2 : shiftHue(palette.accent, o.spread);
    const fillHex = warmTint(fillBase, sceneLight.warmth * 0.6);
    const key = { ...color(host, 'accent'), hex: keyHex, rgb: tripletOf(keyHex) };
    const fill = { hex: fillHex, rgb: tripletOf(fillHex) };
    const isLight = palette.theme === 'light';
    // Key at the light; fill across the frame, a little lower so it reads as bounce.
    const anchors = o.followLight
      ? { kx: sceneLight.x, ky: sceneLight.y, fx: 1 - sceneLight.x, fy: Math.min(0.92, 1 - sceneLight.y * 0.8) }
      : { kx: 0.25, ky: 0.7, fx: 0.78, fy: 0.22 };
    return {
      frame({ t }) {
        const { width, height } = host.viewport;
        const k = o.tint * host.intensity * (isLight ? 0.22 : 0.16);
        if (o.opaque) {
          ctx.fillStyle = palette.bg;
          ctx.fillRect(0, 0, width, height);
        }
        const tt = t * o.drift * 0.08;
        const lights = [
          { c: key, x: anchors.kx + noise.noise2(tt, 0.3) * 0.12, y: anchors.ky + noise.noise2(0.7, tt) * 0.12, r: 0.8, a: k },
          { c: fill, x: anchors.fx + noise.noise2(tt + 5, 2.1) * 0.16, y: anchors.fy + noise.noise2(3.3, tt + 5) * 0.16, r: 0.65, a: k * 0.6 },
        ];
        for (const l of lights) {
          const cx = l.x * width;
          const cy = l.y * height;
          const r = l.r * Math.max(width, height);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, rgbaOf(l.c, l.a));
          g.addColorStop(0.5, rgbaOf(l.c, l.a * 0.35));
          g.addColorStop(1, rgbaOf(l.c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, width, height);
        }
      },
    };
  },
};
