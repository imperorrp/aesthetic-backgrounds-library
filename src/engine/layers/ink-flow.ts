import { createShaderLayer } from '../core/shader';

/**
 * Ink in water: thin marbled filaments from strongly warped noise, sharpened into
 * strokes. Reads well on light palettes as dark ink and on dark palettes as glow.
 */
export const inkFlowLayer = createShaderLayer({
  id: 'ink-flow',
  label: 'Ink flow (shader)',
  description: 'Marbled ink filaments drifting through warped noise. WebGL2.',
  tags: ['calm', 'editorial', 'light-ok', 'gpu'],
  rate: 0.5,
  schema: {
    scale: { type: 'number', min: 0.5, max: 5, default: 2.2, label: 'Scale' },
    speed: { type: 'number', min: 0, max: 1, default: 0.2, label: 'Speed' },
    sharpness: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Sharpness', description: 'Thin filaments vs soft washes' },
    strength: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Strength' },
    color: { type: 'color', default: 'accent', label: 'Ink color' },
  },
  fragment: /* glsl */ `
void main() {
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * u_scale + u_seed * 19.0;
  float t = u_time * u_speed * 0.08;
  vec2 q = vec2(fbm(p + vec2(t, 0.0), 5), fbm(p + vec2(0.0, -t) + 3.1, 5));
  float f = fbm(p + 3.5 * q, 6);
  // Filaments: ridges of |f| near zero, sharpened.
  float ridge = 1.0 - abs(f);
  float k = mix(2.0, 14.0, u_sharpness);
  float ink = pow(clamp(ridge, 0.0, 1.0), k);
  float wash = smoothstep(0.2, 0.9, f) * 0.25 * (1.0 - u_sharpness);
  float a = clamp(ink + wash, 0.0, 1.0) * u_strength * (0.4 + 0.6 * u_intensity);
  vec3 col = u_light > 0.5 ? mix(u_color, vec3(0.0), 0.25) : mix(u_color, u_ink, 0.2);
  fragColor = vec4(col * a, a);
}
`,
});
