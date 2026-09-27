/**
 * A scene is data: an ordered list of layer references with options. The `scene`
 * skin runs it; `createPreset()` wraps a scene as a named, registrable skin so
 * `<bg-engine skin="calm-mesh">` works like any other skin.
 */
import type { BackgroundConfig } from '../config';
import { resolveLayer, type Layer, type LayerHost, type LayerInstance } from './layer';
import { registerSkin } from './registry';
import { resolveOptions } from './schema';
import type { BackgroundSkin, FrameInfo, SkinHost, SkinLayerContext, Viewport } from './skin';

export type SceneLayer = {
  /** Registered layer id. */
  use: string;
  /** Layer options, validated against the layer's schema. */
  with?: Record<string, unknown>;
  /** 0..1, default 1. */
  opacity?: number;
  /** Canvas composite operation used when stacking this layer. Default `source-over`. */
  blend?: GlobalCompositeOperation;
  /** Default true. Disabled layers stay in the JSON so a UI can toggle them. */
  enabled?: boolean;
};

export type Scene = {
  layers: SceneLayer[];
};

export type PresetDefinition = {
  id: string;
  label: string;
  description?: string;
  tags?: string[];
  scene: Scene;
  /** Config applied beneath whatever the caller passes to `mount()`: palette, intensity, motion... */
  config?: Partial<BackgroundConfig>;
};

export type PresetSkin = BackgroundSkin<Scene> & { readonly scene: Scene };

export const SCENE_SKIN_ID = 'scene';

type Mounted = {
  ref: SceneLayer;
  layer: Layer;
  instance: LayerInstance;
  opacity: number;
  blend: GlobalCompositeOperation;
  own?: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
};

const enabledLayers = (scene: Scene | undefined) => (scene?.layers ?? []).filter((l) => l.enabled !== false);

function layerHostFor<T>(host: SkinHost, options: T, opacity: number, blend: GlobalCompositeOperation, surface?: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }): LayerHost<T> {
  // Prototype chain keeps the host's live getters (motion, intensity, quality) intact.
  return Object.create(host, {
    options: { value: options, enumerable: true },
    opacity: { value: opacity, enumerable: true },
    blend: { value: blend, enumerable: true },
    ...(surface
      ? {
          canvas: { value: surface.canvas, enumerable: true },
          ctx: { value: surface.ctx, enumerable: true },
        }
      : {}),
  }) as LayerHost<T>;
}

function mountScene(host: SkinHost<Scene>, scene: Scene | undefined) {
  const mounted: Mounted[] = [];
  for (const ref of enabledLayers(scene)) {
    const layer = resolveLayer(ref.use);
    if (!layer.canvas) continue;
    const options = resolveOptions(layer.schema, ref.with);
    const opacity = Math.max(0, Math.min(1, ref.opacity ?? 1));
    const blend = ref.blend ?? 'source-over';
    let own: Mounted['own'];
    if (layer.surface === 'own') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('2D canvas context unavailable for layer surface');
      own = { canvas, ctx };
    }
    const instance = layer.canvas(layerHostFor(host, options, opacity, blend, own));
    mounted.push({ ref, layer, instance, opacity, blend, own });
  }

  const sizeSurfaces = () => {
    const { width, height } = host.canvas;
    const dpr = host.viewport.dpr;
    for (const m of mounted) {
      if (!m.own) continue;
      if (m.own.canvas.width !== width || m.own.canvas.height !== height) {
        m.own.canvas.width = width;
        m.own.canvas.height = height;
      }
      m.own.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  return {
    resize(viewport: Viewport) {
      sizeSurfaces();
      for (const m of mounted) m.instance.resize?.(viewport);
    },
    frame(info: FrameInfo) {
      const { ctx } = host;
      const { width, height } = host.viewport;
      sizeSurfaces();
      ctx.clearRect(0, 0, width, height);
      for (const m of mounted) {
        if (m.opacity <= 0) continue;
        if (m.own) {
          m.instance.frame?.(info);
          ctx.save();
          ctx.globalAlpha = m.opacity;
          ctx.globalCompositeOperation = m.blend;
          ctx.drawImage(m.own.canvas, 0, 0, width, height);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = m.opacity;
          ctx.globalCompositeOperation = m.blend;
          m.instance.frame?.(info);
          ctx.restore();
        }
      }
    },
    destroy() {
      for (const m of mounted) m.instance.destroy?.();
      mounted.length = 0;
    },
  };
}

function sceneDomLayers(root: HTMLElement, context: SkinLayerContext<Scene>, scene: Scene | undefined): () => void {
  const cleanups: (() => void)[] = [];
  for (const ref of enabledLayers(scene)) {
    const layer = resolveLayer(ref.use);
    if (!layer.dom) continue;
    const options = resolveOptions(layer.schema, ref.with);
    cleanups.push(layer.dom(root, { ...context, options }));
  }
  return () => cleanups.forEach((fn) => fn());
}

/** Runs any `Scene` passed as `options`: `mount(el, { skin: 'scene', options: { layers: [...] } })`. */
export const sceneSkin: BackgroundSkin<Scene> = {
  id: SCENE_SKIN_ID,
  label: 'Scene',
  description: 'Composes registered layers from JSON.',
  layers: (root, context) => sceneDomLayers(root, context, context.options),
  mount: (host) => mountScene(host, host.options),
};

/**
 * Wrap a scene as a named skin. Callers can still pass `options: { layers }` to
 * override the layer stack; `def.config` supplies palette/intensity defaults.
 */
export function createPreset(def: PresetDefinition): PresetSkin {
  const skin: PresetSkin = {
    id: def.id,
    label: def.label,
    description: def.description,
    tags: def.tags,
    defaults: def.config,
    scene: def.scene,
    layers: (root, context) => sceneDomLayers(root, context, context.options?.layers ? context.options : def.scene),
    mount: (host) => mountScene(host, host.options?.layers ? host.options : def.scene),
  };
  return skin;
}

/** Register a preset by id (returns it for chaining). */
export function registerPreset(def: PresetDefinition): PresetSkin {
  const skin = createPreset(def);
  registerSkin(skin);
  return skin;
}
