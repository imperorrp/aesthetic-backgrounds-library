/**
 * `space-background-engine/manifest`: validate, load, and register presets published
 * as JSON, and describe the registry. Kept out of `core` so sites that only mount
 * built-in backgrounds do not ship the validator.
 */
export {
  MANIFEST_VERSION,
  describeLayer,
  describeRegistry,
  describeSkin,
  loadPresetManifest,
  manifestOf,
  presetFromManifest,
  registerPresetManifest,
  sceneCost,
  validatePresetManifest,
} from '../engine/core/manifest';
export type { CostTier, PresetManifest, RegistryEntry, ValidationResult } from '../engine/core/manifest';
