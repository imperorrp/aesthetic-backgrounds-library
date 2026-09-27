import { createShaderLayer } from '../core/shader';

/**
 * Volumetric-looking nebula: domain-warped fbm in two palette hues, with a dark
 * dust pass, drifting slowly. Alpha-composited over whatever sits below.
 */
export const nebulaLayer = createShaderLayer({
  id: 'nebula',
  label: 'Nebula (shader)',
  description: 'Domain-warped noise clouds in two palette hues with dust lanes. WebGL2.',
  tags: ['space', 'calm', 'base', 'gpu'],
  rate: 0.5,
  schema: {
    density: { type: 'number', min: 0, max: 1, default: 0.55, label: 'Density' },
    scale: { type: 'number', min: 0.5, max: 4, default: 1.6, label: 'Scale' },
    speed: { type: 'number', min: 0, max: 1, default: 0.25, label: 'Speed' },
    warp: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Warp', description: 'How much the clouds fold into themselves' },
    dust: { type: 'number', min: 0, max: 1, default: 0.5, label: 'Dust lanes' },
    color: { type: 'color', default: 'accent', label: 'Primary hue' },
    color2: { type: 'color', default: 'hazard', label: 'Secondary hue' },
  },
  fragment: /* glsl */ `
void main() {
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * u_scale + u_seed * 37.0;
  float t = u_time * u_speed * 0.05;

  // Domain warp: two fbm fields displace the sampling position.
  vec2 q = vec2(fbm(p + vec2(0.0, t), 4), fbm(p + vec2(5.2, 1.3) - t, 4));
  vec2 r = vec2(fbm(p + 4.0 * q * u_warp + vec2(1.7, 9.2) + 0.15 * t, 4), fbm(p + 4.0 * q * u_warp + vec2(8.3, 2.8) - 0.12 * t, 4));
  float f = fbm(p + 4.0 * r * u_warp, 5);

  float cloud = smoothstep(-0.35, 0.75, f) * u_density;
  float dust = smoothstep(0.15, 0.6, fbm(p * 2.1 + r * 2.0 + 3.0, 4)) * u_dust;
  float mixHue = smoothstep(-0.2, 0.6, fbm(p * 0.7 + q, 3));

  vec3 col = mix(u_color, u_color2, mixHue);
  // Light palettes: deepen instead of glow so the clouds read on white.
  vec3 tint = u_light > 0.5 ? mix(col, u_bg, 0.35) : mix(col, u_ink, 0.15);
  float a = cloud * (1.0 - 0.7 * dust) * (0.35 + 0.65 * u_intensity);
  // Premultiplied output.
  fragColor = vec4(tint * a, a);
}
`,
});
