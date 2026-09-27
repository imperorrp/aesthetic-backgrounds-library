/**
 * Standard layer library. Importing this module registers every layer by id so
 * scenes and presets can reference them.
 */
import { registerLayer, type Layer } from '../core/layer';
import { registerSkin } from '../core/registry';
import { sceneSkin } from '../core/scene';
import { gradientBaseLayer } from './gradient-base';
import { meshGradientLayer } from './mesh-gradient';
import { vignetteLayer } from './vignette';
import { grainLayer } from './grain';
import { scanlinesLayer } from './scanlines';
import { starfieldLayer } from './starfield';
import { particlesDriftLayer } from './particles-drift';
import { plexusLayer } from './plexus';
import { flowFieldLayer } from './flow-field';
import { gridLayer } from './grid';
import { auroraLayer } from './aurora';
import { lightFollowLayer } from './light-follow';
import { glyphRainLayer } from './glyph-rain';

export const standardLayers: readonly Layer[] = [
  gradientBaseLayer,
  meshGradientLayer,
  auroraLayer,
  starfieldLayer,
  particlesDriftLayer,
  plexusLayer,
  flowFieldLayer,
  glyphRainLayer,
  gridLayer,
  lightFollowLayer,
  vignetteLayer,
  grainLayer,
  scanlinesLayer,
];

standardLayers.forEach((layer) => registerLayer(layer));
// Anyone with layers wants to run scenes from JSON.
registerSkin(sceneSkin);

export {
  gradientBaseLayer,
  meshGradientLayer,
  auroraLayer,
  starfieldLayer,
  particlesDriftLayer,
  plexusLayer,
  flowFieldLayer,
  glyphRainLayer,
  gridLayer,
  lightFollowLayer,
  vignetteLayer,
  grainLayer,
  scanlinesLayer,
};
