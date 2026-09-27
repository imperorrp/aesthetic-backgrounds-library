/**
 * A scene is data: an ordered list of layer references with options. The `scene`
 * skin runs it; `createPreset()` wraps a scene as a named, registrable skin so
 * `<bg-engine skin="calm-mesh">` works like any other skin.
 */
import type { BackgroundConfig } from '../config';
import { resolveLayer, type GLLayerHost, type Layer, type LayerHost, type LayerInstance } from './layer';
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

type Surface = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; gl: WebGL2RenderingContext | null };

type Mounted = {
  ref: SceneLayer;
  layer: Layer;
  instance: LayerInstance;
  opacity: number;
  blend: GlobalCompositeOperation;
  own?: Surface;
  rate: number;
};

const enabledLayers = (scene: Scene | undefined) => (scene?.layers ?? []).filter((l) => l.enabled !== false);

function layerHostFor<T>(
  host: SkinHost,
  options: T,
  opacity: number,
  blend: GlobalCompositeOperation,
  surface?: Surface,
): LayerHost<T> | GLLayerHost<T> {
  // Prototype chain keeps the host's live getters (motion, intensity, quality) intact.
  const props: PropertyDescriptorMap = {
    options: { value: options, enumerable: true },
    opacity: { value: opacity, enumerable: true },
    blend: { value: blend, enumerable: true },
  };
  if (surface?.ctx) {
    props.canvas = { value: surface.canvas, enumerable: true };
    props.ctx = { value: surface.ctx, enumerable: true };
  }
  if (surface?.gl) {
    props.gl = { value: surface.gl, enumerable: true };
    props.glCanvas = { value: surface.canvas, enumerable: true };
  }
  return Object.create(host, props) as LayerHost<T>;
}

const warned = new Set<string>();

function mountScene(host: SkinHost<Scene>, scene: Scene | undefined) {
  const mounted: Mounted[] = [];
  for (const ref of enabledLayers(scene)) {
    const layer = resolveLayer(ref.use);
    if (!layer.canvas && !layer.gl) continue;
    const options = resolveOptions(layer.schema, ref.with);
    const opacity = Math.max(0, Math.min(1, ref.opacity ?? 1));
    const blend = ref.blend ?? 'source-over';
    let own: Surface | undefined;
    let instance: LayerInstance | null = null;
    if (layer.gl) {
      const canvas = document.createElement('canvas');
      const gl = typeof WebGL2RenderingContext !== 'undefined'
        ? (canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false }) as WebGL2RenderingContext | null)
        : null;
      if (!gl) {
        if (!warned.has(layer.id)) {
          warned.add(layer.id);
          if (typeof console !== 'undefined') console.warn(`[bg-engine] WebGL2 unavailable; layer "${layer.id}" skipped.`);
        }
        continue;
      }
      own = { canvas, ctx: null, gl };
      instance = layer.gl(layerHostFor(host, options, opacity, blend, own) as GLLayerHost);
    } else if (layer.surface === 'own') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('2D canvas context unavailable for layer surface');
      own = { canvas, ctx, gl: null };
      instance = layer.canvas!(layerHostFor(host, options, opacity, blend, own));
    } else {
      instance = layer.canvas!(layerHostFor(host, options, opacity, blend));
    }
    mounted.push({ ref, layer, instance, opacity, blend, own, rate: layer.rate ?? 1 });
  }

  const sizeSurfaces = () => {
    const { width, height } = host.canvas;
    const dpr = host.viewport.dpr;
    for (const m of mounted) {
      if (!m.own) continue;
      if (m.own.canvas.width !== width || m.own.canvas.height !== height) {
        m.own.canvas.width = width;
        m.own.canvas.height = height;
        m.own.gl?.viewport(0, 0, width, height);
      }
      m.own.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
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
          // Half-rate layers skip odd frames and re-composite their last image.
          if (m.rate === 1 || info.frame % 2 === 0) m.instance.frame?.(info);
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
      for (const m of mounted) {
        m.instance.destroy?.();
        m.own?.gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }
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

/**
 * Bake a scene's DOM layers (in stack order) onto a 2D context, then the live canvas
 * on top, so an exported image matches what the page shows.
 */
export function snapshotScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene | undefined,
  context: SkinLayerContext,
  liveCanvas: HTMLCanvasElement,
  viewport: Viewport,
): void {
  const draw = (placement: 'below' | 'above') => {
    for (const ref of enabledLayers(scene)) {
      const layer = resolveLayer(ref.use);
      if (!layer.dom || !layer.snapshot) continue;
      if ((layer.domPlacement ?? 'below') !== placement) continue;
      const options = resolveOptions(layer.schema, ref.with);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, ref.opacity ?? 1));
      layer.snapshot(ctx, viewport, { ...context, options });
      ctx.restore();
    }
  };
  ctx.fillStyle = context.palette.bg;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  // Same order as the DOM: plates, the canvas, then finishing textures.
  draw('below');
  ctx.drawImage(liveCanvas, 0, 0, viewport.width, viewport.height);
  draw('above');
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
