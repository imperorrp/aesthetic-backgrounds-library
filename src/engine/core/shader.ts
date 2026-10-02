/**
 * Shader layers: a fragment shader on a fullscreen triangle, drawn to a private
 * WebGL2 surface and composited into the scene like any other layer. Uniforms come
 * from the frame (`u_time`, `u_dt`, `u_frame`), the host (`u_resolution`,
 * `u_pointer`, `u_intensity`, `u_quality`, `u_seed`), the palette (`u_bg`,
 * `u_accent`, `u_ink`, `u_hazard` as 0..1 RGB), and every numeric/boolean/color
 * schema field as `u_<name>` (colors as vec3). Deterministic by construction:
 * nothing but those uniforms varies between frames.
 */
import type { GLLayerHost, Layer, LayerInstance } from './layer';
import { resolveColor, type Schema } from './schema';
import { parseHex } from '../color';

export type ShaderLayerDefinition = {
  id: string;
  label: string;
  description?: string;
  tags?: string[];
  schema: Schema;
  /** GLSL ES 3.00 fragment body. Must define `void main()` writing `fragColor`. `v_uv` is 0..1. */
  fragment: string;
  /** Half-rate rendering for heavy shaders. */
  rate?: 1 | 0.5;
};

/** Utilities available to every shader: hash, value noise, fbm, palette helpers. */
export const GLSL_PRELUDE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + n));
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}
float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += a * vnoise(p);
    p = rot * p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

const VERTEX = /* glsl */ `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  // Fullscreen triangle from gl_VertexID; no buffers needed.
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

const STANDARD_UNIFORMS = [
  'time', 'dt', 'frame', 'resolution', 'pointer', 'intensity', 'quality', 'seed',
  'bg', 'accent', 'accent2', 'accent3', 'ink', 'hazard', 'light', 'lightDir', 'lightPos', 'warmth',
] as const;

const rgb01 = (hex: string): [number, number, number] => {
  const c = parseHex(hex) ?? { r: 128, g: 128, b: 128 };
  return [c.r / 255, c.g / 255, c.b / 255];
};

export function createShaderLayer(def: ShaderLayerDefinition): Layer {
  const schemaUniforms = Object.entries(def.schema)
    .map(([key, field]) => (field.type === 'color' ? `uniform vec3 u_${key};` : field.type === 'enum' || field.type === 'string' ? '' : `uniform float u_${key};`))
    .filter(Boolean)
    .join('\n');

  const fragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform float u_time;
uniform float u_dt;
uniform float u_frame;
uniform vec2 u_resolution;
uniform vec4 u_pointer;
uniform float u_intensity;
uniform float u_quality;
uniform float u_seed;
uniform vec3 u_bg;
uniform vec3 u_accent;
uniform vec3 u_ink;
uniform vec3 u_hazard;
uniform vec3 u_accent2;
uniform vec3 u_accent3;
// 1 on light palettes, 0 on dark.
uniform float u_light;
// Scene light: direction from center (uv space, y up), key position (uv), warmth -1..1.
uniform vec2 u_lightDir;
uniform vec2 u_lightPos;
uniform float u_warmth;
${schemaUniforms}
${GLSL_PRELUDE}
${def.fragment}
`;

  return {
    id: def.id,
    label: def.label,
    description: def.description,
    tags: def.tags,
    schema: def.schema,
    rate: def.rate,
    gl(host: GLLayerHost): LayerInstance {
      const { gl, palette } = host;
      const options = host.options as Record<string, unknown>;
      type Program = {
        program: WebGLProgram;
        vao: WebGLVertexArrayObject | null;
        u: Record<string, WebGLUniformLocation | null>;
        opts: { key: string; type: string; loc: WebGLUniformLocation | null }[];
      };

      const build = (): Program => {
        const compile = (type: number, src: string) => {
          const sh = gl.createShader(type);
          if (!sh) throw new Error('createShader failed');
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(sh);
            gl.deleteShader(sh);
            throw new Error(`[bg-engine] shader "${def.id}" failed to compile:\n${log}`);
          }
          return sh;
        };
        const program = gl.createProgram();
        if (!program) throw new Error('createProgram failed');
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(`[bg-engine] shader "${def.id}" failed to link:\n${gl.getProgramInfoLog(program)}`);
        }
        const loc = (name: string) => gl.getUniformLocation(program, name);
        const u = Object.fromEntries(STANDARD_UNIFORMS.map((n) => [n, loc(`u_${n}`)]));
        const opts = Object.entries(def.schema)
          .filter(([, f]) => f.type !== 'enum' && f.type !== 'string')
          .map(([key, f]) => ({ key, type: f.type, loc: loc(`u_${key}`) }));
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
        return { program, vao: gl.createVertexArray(), u, opts };
      };

      let prog: Program | null = build();

      // Browsers drop WebGL contexts (GPU resets, too many contexts, backgrounded
      // mobile tabs). Ask for the context back, rebuild on restore, and draw
      // nothing in between rather than throwing.
      const onLost = (e: Event) => {
        e.preventDefault();
        prog = null;
      };
      const onRestored = () => {
        try {
          prog = build();
        } catch {
          prog = null;
        }
      };
      host.glCanvas.addEventListener('webglcontextlost', onLost);
      host.glCanvas.addEventListener('webglcontextrestored', onRestored);

      const light = host.light;
      const lightDir = [light.dx, -light.dy];
      const lightPos = [light.x, 1 - light.y];

      return {
        frame(info) {
          if (!prog || gl.isContextLost()) return;
          const { program, vao, u, opts } = prog;
          const { width, height } = host.glCanvas;
          gl.viewport(0, 0, width, height);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.useProgram(program);
          gl.bindVertexArray(vao);
          gl.uniform1f(u.time, info.t);
          gl.uniform1f(u.dt, info.dt);
          gl.uniform1f(u.frame, info.frame);
          gl.uniform2f(u.resolution, width, height);
          const p = host.pointer;
          gl.uniform4f(u.pointer, p.nx, 1 - p.ny, p.active ? 1 : 0, p.idle);
          gl.uniform1f(u.intensity, host.intensity);
          gl.uniform1f(u.quality, host.quality);
          gl.uniform1f(u.seed, (host.config.seedHash % 10000) / 10000);
          gl.uniform3fv(u.bg, rgb01(palette.bg));
          gl.uniform3fv(u.accent, rgb01(palette.accent));
          gl.uniform3fv(u.accent2, rgb01(palette.accent2));
          gl.uniform3fv(u.accent3, rgb01(palette.accent3));
          gl.uniform3fv(u.ink, rgb01(palette.ink));
          gl.uniform3fv(u.hazard, rgb01(palette.hazard));
          gl.uniform1f(u.light, palette.theme === 'light' ? 1 : 0);
          gl.uniform2fv(u.lightDir, lightDir);
          gl.uniform2fv(u.lightPos, lightPos);
          gl.uniform1f(u.warmth, light.warmth);
          for (const o of opts) {
            if (!o.loc) continue;
            const v = options[o.key];
            if (o.type === 'color') gl.uniform3fv(o.loc, rgb01(resolveColor(String(v), palette).hex));
            else if (o.type === 'boolean') gl.uniform1f(o.loc, v ? 1 : 0);
            else gl.uniform1f(o.loc, typeof v === 'number' ? v : 0);
          }
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
        destroy() {
          host.glCanvas.removeEventListener('webglcontextlost', onLost);
          host.glCanvas.removeEventListener('webglcontextrestored', onRestored);
          if (prog && !gl.isContextLost()) {
            gl.deleteProgram(prog.program);
            gl.deleteVertexArray(prog.vao);
          }
          prog = null;
        },
      };
    },
  };
}
