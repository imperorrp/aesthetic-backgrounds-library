/**
 * Scene transitions. The incoming background mounts on top of the outgoing one and
 * is revealed by its own frame clock, so a transition under a manual scheduler is
 * as reproducible as a frame: same seed, same frames, same pixels mid-transition.
 */
import { mount, type MountHandle, type MountOptions } from './mount';

export type TransitionKind = 'crossfade' | 'wipe' | 'iris';

export type TransitionOptions = {
  /** Seconds. Default 1.2. */
  duration?: number;
  /**
   * `crossfade` (default) fades the new scene in. `wipe` reveals it from the side the
   * scene light is on. `iris` opens a circle from the new scene's key light, so it
   * dawns from where its light comes from. Under reduced motion every kind becomes a
   * crossfade; with motion off the swap is instant.
   */
  kind?: TransitionKind;
};

export type Transition = {
  /** The incoming background. Store this; it replaces the outgoing handle. */
  handle: MountHandle;
  /** Resolves once the outgoing background has been destroyed. */
  done: Promise<MountHandle>;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function transition<T = any>(from: MountHandle, next: MountOptions<T>, options: TransitionOptions = {}): Transition {
  const target = from.root.parentElement ?? document.body;
  const handle = mount<T>(target, next);
  const root = handle.root;
  const duration = Math.max(0.05, options.duration ?? 1.2);
  const motion = next.motion ?? 'auto';
  const reduced =
    motion === 'reduced' ||
    (motion === 'auto' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const kind: TransitionKind = reduced ? 'crossfade' : options.kind ?? 'crossfade';

  if (motion === 'off') {
    from.destroy();
    return { handle, done: Promise.resolve(handle) };
  }

  let resolve!: (h: MountHandle) => void;
  const done = new Promise<MountHandle>((r) => (resolve = r));
  let finished = false;
  let unsubscribe = () => {};
  let safety: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished) return;
    finished = true;
    unsubscribe();
    if (safety !== undefined) clearTimeout(safety);
    root.style.opacity = '';
    root.style.clipPath = '';
    from.destroy();
    resolve(handle);
  };

  const light = handle.composition().light;
  const apply = (p: number) => {
    const e = ease(p);
    if (kind === 'crossfade') {
      root.style.opacity = String(e);
    } else if (kind === 'wipe') {
      // Reveal from the lit side toward the shadowed side.
      const pct = (1 - e) * 100;
      root.style.clipPath = light.dx < 0 ? `inset(0 ${pct}% 0 0)` : `inset(0 0 0 ${pct}%)`;
    } else {
      root.style.clipPath = `circle(${(e * 150).toFixed(2)}% at ${(light.x * 100).toFixed(1)}% ${(light.y * 100).toFixed(1)}%)`;
    }
  };
  apply(0);

  unsubscribe = handle.onFrame((info) => {
    const p = Math.min(1, info.t / duration);
    apply(p);
    if (p >= 1) finish();
  });
  // If the incoming loop never ticks (hidden tab, paused), do not leave two
  // backgrounds stacked forever.
  safety = setTimeout(finish, duration * 1000 + 2500);

  return { handle, done };
}
