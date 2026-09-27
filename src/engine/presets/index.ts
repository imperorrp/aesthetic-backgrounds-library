/**
 * Curated presets: scenes with tuned defaults, one or two per niche. Importing this
 * module registers the standard layers, the `scene` skin, and every preset by id,
 * so `<bg-engine skin="calm-mesh">` works.
 */
import '../layers';
import { registerSkin } from '../core/registry';
import { registerPreset, sceneSkin, type PresetDefinition, type PresetSkin } from '../core/scene';

registerSkin(sceneSkin);

export const presetDefinitions: readonly PresetDefinition[] = [
  {
    id: 'calm-mesh',
    label: 'Calm mesh',
    description: 'Light, soft color fields with grain. The premium SaaS landing look.',
    tags: ['saas', 'light', 'calm', 'flagship'],
    config: { palette: { from: '#4f6df5', theme: 'light' }, intensity: 0.8 },
    scene: {
      layers: [
        { use: 'gradient-base', with: { tint: 0.3, drift: 0.2, spread: 60 } },
        { use: 'mesh-gradient', with: { blobs: 5, spread: 70, size: 0.85, speed: 0.22, saturation: 0.8 } },
        { use: 'mesh-gradient', with: { blobs: 3, spread: 30, size: 0.45, speed: 0.35, saturation: 1 }, opacity: 0.55, blend: 'multiply' },
        { use: 'light-follow', with: { strength: 0.22, radius: 460, color: 'accent' } },
        { use: 'vignette', with: { strength: 0.18, size: 1.15 } },
        { use: 'grain', with: { opacity: 0.08, blend: 'multiply' } },
      ],
    },
  },
  {
    id: 'aurora-night',
    label: 'Aurora night',
    description: 'Luminous ribbons over a sparse starfield. Dark SaaS or event pages.',
    tags: ['saas', 'dark', 'calm', 'nature'],
    config: { palette: { from: '#22d3ee' }, intensity: 0.85 },
    scene: {
      layers: [
        { use: 'gradient-base', with: { tint: 0.3, spread: 60 } },
        { use: 'starfield', with: { density: 0.6, bands: 2, twinkle: 0.5, drift: 0.15, size: 0.8, tint: 0.2 } },
        { use: 'aurora', with: { bands: 3, height: 0.42, speed: 0.22, spread: 40, ripple: 0.5, position: 0.4 }, blend: 'lighter' },
        { use: 'vignette', with: { strength: 0.5 } },
        { use: 'grain', with: { opacity: 0.08 } },
      ],
    },
  },
  {
    id: 'terminal-rain',
    label: 'Terminal rain',
    description: 'Glyph rain behind scanlines, held back so code stays readable. Developer portfolios.',
    tags: ['terminal', 'dark', 'retro', 'portfolio'],
    config: { palette: { from: '#22c55e' }, intensity: 0.7 },
    scene: {
      layers: [
        { use: 'gradient-base', with: { tint: 0.15, drift: 0.1 } },
        { use: 'glyph-rain', with: { fontSize: 14, speed: 0.9, density: 0.75, fade: 0.045, charset: 'katakana' }, opacity: 0.9 },
        { use: 'scanlines', with: { spacing: 4, opacity: 0.1 } },
        { use: 'vignette', with: { strength: 0.6 } },
      ],
    },
  },
  {
    id: 'deep-field',
    label: 'Deep field',
    description: 'Dense parallax stars with drifting dust. Sci-fi and space without the HUD.',
    tags: ['space', 'sci-fi', 'dark', 'calm'],
    config: { palette: 'void-cyan', intensity: 0.9 },
    scene: {
      layers: [
        { use: 'gradient-base', with: { tint: 0.4, spread: 70, drift: 0.25 } },
        { use: 'starfield', with: { density: 1.4, bands: 3, twinkle: 0.7, drift: 0.5, size: 1, tint: 0.3 } },
        { use: 'particles-drift', with: { count: 40, size: 1.4, speed: 0.2, glow: 0.7, pulse: 0.4, turbulence: 0.4 }, opacity: 0.7 },
        { use: 'vignette', with: { strength: 0.5 } },
        { use: 'grain', with: { opacity: 0.07 } },
      ],
    },
  },
  {
    id: 'flow-lines',
    label: 'Flow lines',
    description: 'Streamlines over a faint dot grid. Data, science, and analytics products.',
    tags: ['data', 'science', 'dark', 'tech'],
    config: { palette: { from: '#38bdf8' }, intensity: 0.8 },
    scene: {
      layers: [
        { use: 'gradient-base', with: { tint: 0.2, drift: 0.15 } },
        { use: 'grid', with: { style: 'dots', spacing: 40, alpha: 0.3, fade: 0.75, drift: 0.15 } },
        { use: 'flow-field', with: { lines: 260, scale: 1.6, speed: 0.5, trail: 0.65, width: 1, evolve: 0.3 } },
        { use: 'vignette', with: { strength: 0.45 } },
      ],
    },
  },
  {
    id: 'fireflies',
    label: 'Fireflies',
    description: 'Warm pulsing lights over slow dust. Wellness, nature, and quiet portfolios.',
    tags: ['nature', 'calm', 'dark', 'warm'],
    config: { palette: { from: '#f5c451' }, intensity: 0.8 },
    scene: {
      layers: [
        { use: 'gradient-base', with: { tint: 0.3, spread: 25, drift: 0.15 } },
        { use: 'particles-drift', with: { count: 120, size: 0.8, speed: 0.15, glow: 0.2, pulse: 0.2, turbulence: 0.3, color: 'inkDim' }, opacity: 0.5 },
        { use: 'particles-drift', with: { count: 70, size: 1.8, speed: 0.3, glow: 0.9, pulse: 0.7, turbulence: 0.6, color: 'accent' } },
        { use: 'vignette', with: { strength: 0.6 } },
        { use: 'grain', with: { opacity: 0.06 } },
      ],
    },
  },
  {
    id: 'paper-grid',
    label: 'Paper grid',
    description: 'Light editorial plate: fine ruled grid, a few drifting motes, heavy grain.',
    tags: ['editorial', 'light', 'calm', 'brutalist'],
    config: { palette: { from: '#334155', theme: 'light' }, intensity: 0.7 },
    scene: {
      layers: [
        { use: 'gradient-base', with: { tint: 0.15, drift: 0.1 } },
        { use: 'grid', with: { style: 'lines', spacing: 56, alpha: 0.35, fade: 0.4, drift: 0.1, color: 'inkDim' } },
        { use: 'particles-drift', with: { count: 25, size: 1.2, speed: 0.1, glow: 0, pulse: 0, turbulence: 0.3, color: 'inkDim' }, opacity: 0.6 },
        { use: 'grain', with: { opacity: 0.12, blend: 'multiply' } },
      ],
    },
  },
];

export const presets: readonly PresetSkin[] = presetDefinitions.map((def) => registerPreset(def));

export const presetIds = presets.map((p) => p.id);
