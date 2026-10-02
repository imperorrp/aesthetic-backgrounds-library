/**
 * Manifests: machine-readable descriptions of skins, layers, and presets, and the
 * JSON format third parties use to publish presets without shipping code.
 *
 * A preset manifest is pure data (a scene plus config defaults). Because every
 * layer validates its options against a schema, a manifest can be checked before
 * it is ever mounted, which is what lets a community index accept submissions
 * from strangers: `validatePresetManifest()` runs in CI, `registerPresetManifest()`
 * runs in the browser, and no code changes in this repository.
 */
import type { BackgroundConfig } from '../config';
import { resolvePalette } from '../palette';
import { getLayer, listLayers, type Layer } from './layer';
import { getSkin, listSkins, registerSkin } from './registry';
import { createPreset, type PresetSkin, type Scene } from './scene';
import type { FieldSchema, Schema } from './schema';
import type { BackgroundSkin } from './skin';

export const MANIFEST_VERSION = 1;

/** What it costs to run: `low` canvas-only, `medium` uses private surfaces, `gpu` needs WebGL2. */
export type CostTier = 'low' | 'medium' | 'gpu';

export type RegistryEntry = {
  kind: 'skin' | 'preset' | 'layer';
  id: string;
  label: string;
  description?: string;
  tags: string[];
  /** Palette themes it is designed for. */
  themes: ('dark' | 'light')[];
  cost: CostTier;
  schema: Schema;
  defaults?: Partial<BackgroundConfig>;
  /** For presets: the layer stack. */
  scene?: Scene;
  /** Relative preview image, when a reference render exists. */
  preview?: string;
  /** For community entries: who published it. */
  author?: { name: string; url?: string };
  source: 'builtin' | 'community';
};

/** The JSON a third party publishes. Only `id`, `label`, and `scene` are required. */
export type PresetManifest = {
  $schema?: string;
  manifestVersion?: number;
  id: string;
  label: string;
  description?: string;
  tags?: string[];
  author?: { name: string; url?: string };
  config?: Partial<BackgroundConfig>;
  scene: Scene;
};

export type ValidationResult = { ok: boolean; errors: string[]; warnings: string[] };

const ID = /^[a-z][a-z0-9-]{1,48}$/;
const BLENDS = new Set([
  'source-over', 'lighter', 'screen', 'multiply', 'overlay', 'soft-light', 'hard-light',
  'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion',
]);

function themesOf(defaults: Partial<BackgroundConfig> | undefined, tags: string[]): ('dark' | 'light')[] {
  if (tags.includes('light-ok')) return ['dark', 'light'];
  const p = defaults?.palette;
  if (p && typeof p === 'object' && 'from' in p && p.theme === 'light') return ['light'];
  if (tags.includes('light')) return ['light'];
  return ['dark'];
}

function layerCost(layer: Layer | undefined): CostTier {
  if (!layer) return 'low';
  if (layer.gl) return 'gpu';
  if (layer.surface === 'own') return 'medium';
  return 'low';
}

const rank: Record<CostTier, number> = { low: 0, medium: 1, gpu: 2 };
const maxCost = (a: CostTier, b: CostTier): CostTier => (rank[a] >= rank[b] ? a : b);

export function sceneCost(scene: Scene): CostTier {
  return scene.layers
    .filter((l) => l.enabled !== false)
    .reduce<CostTier>((acc, ref) => maxCost(acc, layerCost(getLayer(ref.use))), 'low');
}

export function describeLayer(layer: Layer): RegistryEntry {
  const tags = layer.tags ?? [];
  return {
    kind: 'layer',
    id: layer.id,
    label: layer.label,
    description: layer.description,
    tags,
    themes: tags.includes('light-ok') ? ['dark', 'light'] : ['dark'],
    cost: layerCost(layer),
    schema: layer.schema,
    source: 'builtin',
  };
}

export function describeSkin(skin: BackgroundSkin): RegistryEntry {
  const tags = skin.tags ?? [];
  const scene = (skin as PresetSkin).scene;
  return {
    kind: scene ? 'preset' : 'skin',
    id: skin.id,
    label: skin.label ?? skin.id,
    description: skin.description,
    tags,
    themes: themesOf(skin.defaults, tags),
    cost: scene ? sceneCost(scene) : 'medium',
    schema: skin.schema ?? {},
    defaults: skin.defaults,
    scene,
    preview: `gallery/${skin.id}.png`,
    source: 'builtin',
  };
}

/** Everything currently registered, in a stable order. */
export function describeRegistry(): RegistryEntry[] {
  const skins = listSkins()
    .filter((id) => id !== 'scene')
    .map((id) => describeSkin(getSkin(id)!));
  const layers = listLayers().map(describeLayer);
  const order = { skin: 0, preset: 1, layer: 2 } as const;
  return [...skins, ...layers].sort((a, b) => order[a.kind] - order[b.kind] || a.id.localeCompare(b.id));
}

function checkField(path: string, field: FieldSchema, value: unknown, errors: string[], warnings: string[]) {
  switch (field.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${path}: expected a number`);
      else if (value < field.min || value > field.max) warnings.push(`${path}: ${value} is outside ${field.min}..${field.max} and will be clamped`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path}: expected true or false`);
      break;
    case 'enum':
      if (!field.values.includes(value as string)) errors.push(`${path}: "${String(value)}" is not one of ${field.values.join(', ')}`);
      break;
    case 'color':
    case 'string':
      if (typeof value !== 'string') errors.push(`${path}: expected a string`);
      break;
  }
}

/**
 * Validate a third-party preset without mounting it. Errors block registration;
 * warnings (values that will be clamped) do not.
 */
export function validatePresetManifest(input: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const m = input as Partial<PresetManifest> | null;
  if (!m || typeof m !== 'object') return { ok: false, errors: ['manifest must be a JSON object'], warnings };
  if (typeof m.id !== 'string' || !ID.test(m.id)) errors.push('id: lowercase kebab-case, 2 to 49 characters');
  if (typeof m.label !== 'string' || !m.label.trim()) errors.push('label: required');
  if (m.manifestVersion !== undefined && m.manifestVersion > MANIFEST_VERSION) {
    errors.push(`manifestVersion ${m.manifestVersion} is newer than this engine supports (${MANIFEST_VERSION})`);
  }
  if (m.tags !== undefined && (!Array.isArray(m.tags) || m.tags.some((t) => typeof t !== 'string'))) errors.push('tags: array of strings');
  if (m.config?.palette !== undefined) {
    const p = m.config.palette;
    const valid = typeof p === 'string' || (p && typeof p === 'object' && 'from' in p && typeof p.from === 'string');
    if (!valid) errors.push('config.palette: a built-in id, a hex color, or { from, theme }');
    else if (resolvePalette(p).id === 'void-cyan' && typeof p === 'string' && p !== 'void-cyan') {
      warnings.push(`config.palette: "${p}" is not recognised and falls back to void-cyan`);
    }
  }
  if (m.config?.intensity !== undefined && (typeof m.config.intensity !== 'number' || m.config.intensity < 0 || m.config.intensity > 1)) {
    errors.push('config.intensity: a number from 0 to 1');
  }
  const light = m.config?.light;
  if (light !== undefined) {
    const num = (v: unknown) => v === undefined || (typeof v === 'number' && Number.isFinite(v));
    if (!light || typeof light !== 'object' || !num(light.angle) || !num(light.warmth)) {
      errors.push('config.light: { angle?: degrees, warmth?: -1..1 }');
    } else if (light.warmth !== undefined && Math.abs(light.warmth) > 1) {
      warnings.push('config.light.warmth: clamped to -1..1');
    }
  }
  const leg = m.config?.legibility;
  if (leg !== undefined && leg !== 'auto' && leg !== 'off' && (!leg || typeof leg !== 'object')) {
    errors.push("config.legibility: 'auto', 'off', or { selector?, strength? }");
  }
  const layers = m.scene?.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    errors.push('scene.layers: at least one layer');
  } else {
    layers.forEach((ref, i) => {
      const at = `scene.layers[${i}]`;
      if (!ref || typeof ref.use !== 'string') {
        errors.push(`${at}.use: required`);
        return;
      }
      const layer = getLayer(ref.use);
      if (!layer) {
        errors.push(`${at}.use: unknown layer "${ref.use}"`);
        return;
      }
      if (ref.opacity !== undefined && (typeof ref.opacity !== 'number' || ref.opacity < 0 || ref.opacity > 1)) errors.push(`${at}.opacity: 0 to 1`);
      if (ref.blend !== undefined && !BLENDS.has(ref.blend)) errors.push(`${at}.blend: unsupported "${ref.blend}"`);
      for (const [key, value] of Object.entries(ref.with ?? {})) {
        const field = layer.schema[key];
        if (!field) warnings.push(`${at}.with.${key}: "${ref.use}" has no option "${key}" (ignored)`);
        else checkField(`${at}.with.${key}`, field, value, errors, warnings);
      }
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Turn a validated manifest into a preset skin (not registered). Throws with all errors when invalid. */
export function presetFromManifest(input: unknown): PresetSkin {
  const result = validatePresetManifest(input);
  if (!result.ok) throw new Error(`Invalid preset manifest:\n  ${result.errors.join('\n  ')}`);
  const m = input as PresetManifest;
  return createPreset({
    id: m.id,
    label: m.label,
    description: m.description,
    tags: [...(m.tags ?? []), 'community'],
    config: m.config,
    scene: m.scene,
  });
}

/** Validate, build, and register a preset manifest so it mounts by id. */
export function registerPresetManifest(input: unknown): PresetSkin {
  const skin = presetFromManifest(input);
  registerSkin(skin);
  return skin;
}

/** Fetch a manifest from a URL and register it. */
export async function loadPresetManifest(url: string, init?: RequestInit): Promise<PresetSkin> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`loadPresetManifest: ${res.status} ${res.statusText} for ${url}`);
  return registerPresetManifest(await res.json());
}

/** Export any registered preset as a portable manifest (the inverse of `presetFromManifest`). */
export function manifestOf(skin: PresetSkin, extra: Partial<PresetManifest> = {}): PresetManifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    id: skin.id,
    label: skin.label ?? skin.id,
    description: skin.description,
    tags: skin.tags,
    config: skin.defaults,
    scene: skin.scene,
    ...extra,
  };
}
