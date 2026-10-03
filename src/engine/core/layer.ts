/**
 * Layers are the unit of authoring. A scene stacks layers bottom to top on one
 * canvas (or on a private surface when a layer needs to fade or mask itself),
 * and can place DOM layers (CSS gradients, grain, scanlines) behind the canvas.
 */
import type { BackgroundSkin, FrameInfo, SkinHost, SkinInspection, SkinLayerContext, Viewport } from './skin';
import type { Schema } from './schema';

export type LayerHost<T = any> = SkinHost<T> & {
  /** Scene-level opacity for this layer; the compositor applies it, this is informational. */
  readonly opacity: number;
  readonly blend: GlobalCompositeOperation;
};

export type LayerInstance = {
  resize?(viewport: Viewport): void;
  frame?(info: FrameInfo): void;
  /** Sim-only step (no drawing), for fast-forward. Layers without simulation omit it. */
  advance?(info: FrameInfo): void;
  /** Debug snapshot (see `SkinInstance.inspect`). */
  inspect?(): SkinInspection | undefined;
  destroy?(): void;
};

export type Layer<T = any> = {
  id: string;
  label: string;
  description?: string;
  /** Mood/niche tags for galleries and agents, e.g. `calm`, `sci-fi`, `light-ok`. */
  tags?: string[];
  schema: Schema;
  /**
   * `shared` (default) draws straight onto the scene canvas in stack order.
   * `own` gives the layer a private canvas the same size, composited each frame;
   * required for layers that fade their previous frame or use destination masks.
   */
  surface?: 'shared' | 'own';
  /** DOM elements placed inside the engine root. Return a cleanup. */
  dom?(root: HTMLElement, context: SkinLayerContext<T>): () => void;
  /**
   * Where the DOM part sits relative to the canvas. `below` (default) for plates and
   * textures the canvas draws over; `above` for finishing passes such as grain and
   * scanlines, which must overlay the canvas to be visible at all.
   */
  domPlacement?: 'below' | 'above';
  /** Canvas drawing. Optional for pure DOM layers. */
  canvas?(host: LayerHost<T>): LayerInstance;
  /**
   * Draw a still equivalent of the DOM part onto a 2D context, for exports that need
   * DOM layers (grain, scanlines, CSS plates) baked into an image.
   */
  snapshot?(ctx: CanvasRenderingContext2D, viewport: Viewport, context: SkinLayerContext<T>): void;
  /** WebGL drawing on a private WebGL2 surface. See `createShaderLayer`. */
  gl?(host: GLLayerHost<T>): LayerInstance;
  /**
   * Update cadence for private-surface layers: 1 (default) every frame, 0.5 every other
   * frame (the last image is re-composited in between). Cheap way to halve a heavy layer's cost.
   */
  rate?: 1 | 0.5;
};

export type GLLayerHost<T = any> = LayerHost<T> & { gl: WebGL2RenderingContext; glCanvas: HTMLCanvasElement };

const layers = new Map<string, Layer>();

export function registerLayer<T>(layer: Layer<T>): Layer<T> {
  layers.set(layer.id, layer as Layer);
  return layer;
}

export function getLayer(id: string): Layer | undefined {
  return layers.get(id);
}

export function listLayers(): Layer[] {
  return [...layers.values()];
}

export function resolveLayer(id: string): Layer {
  const found = layers.get(id);
  if (!found) {
    const known = [...layers.keys()];
    throw new Error(
      `Unknown layer "${id}". Registered layers: ${known.length ? known.join(', ') : '(none)'}. ` +
        'Import "space-background-engine/layers" (or the layer module) before mounting a scene.',
    );
  }
  return found;
}

/**
 * Use any whole skin as a layer inside a scene. It gets a private surface because
 * skins clear the full canvas each frame.
 */
export function fromSkin<T>(skin: BackgroundSkin<T>, meta: Partial<Pick<Layer, 'label' | 'description' | 'tags'>> = {}): Layer<T> {
  return {
    id: skin.id,
    label: meta.label ?? skin.label ?? skin.id,
    description: meta.description ?? skin.description,
    tags: meta.tags ?? skin.tags,
    schema: skin.schema ?? {},
    surface: 'own',
    dom: skin.layers ? (root, context) => skin.layers!(root, context) : undefined,
    canvas: (host) => skin.mount(host),
  };
}
