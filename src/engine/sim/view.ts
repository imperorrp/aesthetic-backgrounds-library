/**
 * View: the camera and the projection from world space to the screen.
 *
 * World space: x grows right (the direction the map streams), y grows down, z is depth
 * (0 = the main plane; larger is farther away). A point projects as
 *
 *     s  = zoom / (1 + z)                 scale at that depth
 *     sx = W/2 + (x - cam.x) * s
 *     sy = H/2 + (y - cam.y) * s
 *
 * so far things are smaller and move less: real parallax from one camera.
 *
 * Two frames matter:
 * - the BASE frame: where the camera would be with no director (the classic drift,
 *   zoom 1, centered vertically). Spawning and culling use it, so the world is always
 *   populated around it.
 * - the CAMERA: what is actually drawn. The director may zoom in (never out) and look
 *   around, but only inside the base frame, so nothing unpopulated is ever shown.
 *
 * Drawing code projects every point through the view and draws in screen space, so text
 * and 1px lines stay crisp at any zoom (see docs/ARCHITECTURE.md, "Rendering").
 */

export type Point = { x: number; y: number };
export type Rect = { left: number; right: number; top: number; bottom: number };

export type View = {
  /** Screen size in CSS px. */
  readonly width: number;
  readonly height: number;
  /** Camera center in world units, and zoom (1 = the classic framing). */
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  /** Center of the base frame (the director's anchor). */
  readonly baseX: number;
  readonly baseY: number;

  /** Scale at depth z (zoom / (1 + z)). */
  scale(z?: number): number;
  /** Screen x / y of a world point at depth z. */
  sx(x: number, z?: number): number;
  sy(y: number, z?: number): number;
  /** World x / y under a screen point at depth z. */
  wx(sx: number, z?: number): number;
  wy(sy: number, z?: number): number;
  /** Visible world rectangle at depth z (the camera), grown by `margin` screen px. */
  bounds(z?: number, margin?: number): Rect;
  /** The base frame's world rectangle at depth z: where the world must be populated. */
  baseBounds(z?: number, margin?: number): Rect;
  /** Is a world point inside the camera's view (with a screen-px margin)? */
  onScreen(x: number, y: number, z?: number, margin?: number): boolean;

  /** Move the base frame (the drift). */
  setBase(x: number, y: number): void;
  /** Set the camera; it is clamped so the view stays inside the base frame. */
  setCamera(x: number, y: number, zoom: number): void;
  resize(width: number, height: number): void;
};

/** Largest zoom the director or the user may reach. */
export const MAX_ZOOM = 1.8;

export function createView(width: number, height: number): View {
  let W = width;
  let H = height;
  let bx = W / 2;
  let by = H / 2;
  let cx = bx;
  let cy = by;
  let zoom = 1;

  /** Keep the camera's rectangle inside the base frame's rectangle (at depth 0). */
  const clampCamera = () => {
    zoom = Math.max(1, Math.min(MAX_ZOOM, zoom));
    const slackX = (W / 2) * (1 - 1 / zoom);
    const slackY = (H / 2) * (1 - 1 / zoom);
    cx = Math.max(bx - slackX, Math.min(bx + slackX, cx));
    cy = Math.max(by - slackY, Math.min(by + slackY, cy));
  };

  const rectAt = (centerX: number, centerY: number, z: number, z0: number, margin: number): Rect => {
    const s = z0 / (1 + z);
    const halfW = (W / 2 + margin) / s;
    const halfH = (H / 2 + margin) / s;
    return { left: centerX - halfW, right: centerX + halfW, top: centerY - halfH, bottom: centerY + halfH };
  };

  return {
    get width() {
      return W;
    },
    get height() {
      return H;
    },
    get x() {
      return cx;
    },
    get y() {
      return cy;
    },
    get zoom() {
      return zoom;
    },
    get baseX() {
      return bx;
    },
    get baseY() {
      return by;
    },
    scale: (z = 0) => zoom / (1 + z),
    sx: (x, z = 0) => W / 2 + (x - cx) * (zoom / (1 + z)),
    sy: (y, z = 0) => H / 2 + (y - cy) * (zoom / (1 + z)),
    wx: (sx, z = 0) => cx + (sx - W / 2) / (zoom / (1 + z)),
    wy: (sy, z = 0) => cy + (sy - H / 2) / (zoom / (1 + z)),
    bounds: (z = 0, margin = 0) => rectAt(cx, cy, z, zoom, margin),
    baseBounds: (z = 0, margin = 0) => rectAt(bx, by, z, 1, margin),
    onScreen(x, y, z = 0, margin = 0) {
      const s = zoom / (1 + z);
      const px = W / 2 + (x - cx) * s;
      const py = H / 2 + (y - cy) * s;
      return px > -margin && px < W + margin && py > -margin && py < H + margin;
    },
    setBase(x, y) {
      // The camera rides along with the base frame, keeping its offset.
      cx += x - bx;
      cy += y - by;
      bx = x;
      by = y;
      clampCamera();
    },
    setCamera(x, y, z) {
      cx = x;
      cy = y;
      zoom = z;
      clampCamera();
    },
    resize(w, h) {
      bx += (w - W) / 2;
      by = h / 2;
      W = w;
      H = h;
      clampCamera();
    },
  };
}
