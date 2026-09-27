/**
 * `space-background-engine/shader`: author WebGL2 fragment-shader layers.
 * Kept out of `core` so canvas-only consumers do not pay for the GLSL prelude.
 */
export { createShaderLayer, GLSL_PRELUDE } from '../engine/core/shader';
export type { ShaderLayerDefinition } from '../engine/core/shader';
export type { GLLayerHost } from '../engine/core/layer';
