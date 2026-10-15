/**
 * Framing: where a big world's camera sits.
 *
 * A wallpaper should show its whole world. Worlds are generated in the screen's proportions
 * (a little larger than the screen), so the whole of one fits at `fit` zoom. Four modes:
 *
 * - `still`: the whole world, always. Nothing moves but the world.
 * - `drift` (the default): the whole world, and now and then, for the biggest moments only
 *   (a director request of high priority), a slow push in toward it and a slow ease back out.
 * - `follow`: the same world, closer: the camera goes where the director looks, zoomed in far
 *   enough to see the small things (people, items on belts, names). Switchable live
 *   (`setMode`), so a viewer can go from the whole scene to the details and back.
 * - `director`: the old way, for the old wider worlds: follow every shot the director asks for.
 */
import type { Director } from './director';

export type CameraMode = 'still' | 'drift' | 'follow' | 'director';
export const CAMERA_MODES: CameraMode[] = ['drift', 'still', 'follow', 'director'];

/** How much bigger than the screen a whole-scene world is generated: big enough for detail, small enough to fit. */
export const WORLD_SCALE = 1.25;

/** The view a viewer toggles between: the whole scene, or following the action up close. */
export type CameraView = 'whole' | 'follow';

export function createFraming(mode: CameraMode, world: { GW: number; GH: number }, opts: { minPriority?: number; push?: number; maxZoom?: number; closer?: number } = {}) {
  const cam = { x: world.GW / 2, y: world.GH / 2, zoom: 1 };
  const minPriority = opts.minPriority ?? 6;
  const push = opts.push ?? 1.45;
  const maxZoom = opts.maxZoom ?? 2.2;
  /** How much closer than the whole scene `follow` holds, at least. */
  const closer = opts.closer ?? 1.7;
  /** The whole-scene mode to go back to from `follow`. */
  const whole: CameraMode = mode === 'follow' ? 'drift' : mode;
  let first = true;
  return {
    cam,
    get mode(): CameraMode {
      return mode;
    },
    /** Switch the view live: `follow`, or back to the whole scene this world started in. */
    setView(view: CameraView) {
      mode = view === 'follow' ? 'follow' : whole;
    },
    /** The zoom at which the whole world fits the screen. */
    fit: (W: number, H: number) => Math.min(W / world.GW, H / world.GH),
    update(dt: number, t: number, director: Director, W: number, H: number) {
      const fit = Math.min(W / world.GW, H / world.GH);
      const s = director.shot;
      let tx = world.GW / 2;
      let ty = world.GH / 2;
      let tz = fit;
      let speed = 0.25;
      if (mode === 'director') {
        tx = s.x;
        ty = s.y;
        tz = Math.max(fit, Math.min(maxZoom, s.zoom));
        speed = 0.6;
      } else if (mode === 'follow') {
        tx = s.x;
        ty = s.y;
        tz = Math.min(Math.max(maxZoom, fit * closer * 1.4), Math.max(fit * closer, s.zoom));
        speed = 0.45;
      } else if (mode === 'drift' && s.priority >= minPriority && t < s.until) {
        tx = s.x;
        ty = s.y;
        tz = fit * push;
        speed = 0.18;
      }
      const k = first ? 1 : Math.min(1, dt * speed);
      first = false;
      cam.zoom += (tz - cam.zoom) * k;
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
      // Keep the frame on the world (centred where the world is smaller than the frame).
      const hw = W / 2 / cam.zoom;
      const hh = H / 2 / cam.zoom;
      cam.x = hw * 2 >= world.GW ? world.GW / 2 : Math.max(hw, Math.min(world.GW - hw, cam.x));
      cam.y = hh * 2 >= world.GH ? world.GH / 2 : Math.max(hh, Math.min(world.GH - hh, cam.y));
    },
  };
}

/** A line of HUD text shortened with an ellipsis to fit `max` px. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (max <= 0 || ctx.measureText(text).width <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, Math.max(0, lo)).trimEnd()}…`;
}
