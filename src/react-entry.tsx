import { useEffect, useRef, type CSSProperties } from 'react';
import { mount, type MountHandle, type MountOptions } from './engine/core/mount';
import { transition as runTransition, type TransitionOptions } from './engine/core/transition';
// Re-exported so the imports are retained and the built-in skins, layers, and presets register by id.
export { builtInSkins } from './engine/skins';
export { presets } from './engine/presets';

export type BackgroundProps = MountOptions & {
  className?: string;
  style?: CSSProperties;
  /**
   * Animate between configurations instead of remounting: seconds for a crossfade,
   * or `{ duration, kind: 'crossfade' | 'wipe' | 'iris' }`.
   */
  transition?: number | TransitionOptions;
  /** Receives the live handle after every mount or transition (composition, pause, onFrame...). */
  onReady?: (handle: MountHandle) => void;
};

const keyOf = (o: MountOptions) =>
  JSON.stringify({ ...o, skin: typeof o.skin === 'string' ? o.skin : o.skin?.id, scheduler: undefined, exposeTokens: o.exposeTokens === true });

/**
 * React wrapper around `mount`. One component = full background (layers + canvas).
 * A prop change remounts, or transitions when `transition` is set.
 */
export function Background({ className, style, transition, onReady, ...options }: BackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MountHandle | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const transitionRef = useRef(transition);
  transitionRef.current = transition;
  const key = keyOf(options);
  const mountedKey = useRef(key);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    handleRef.current = mount(node, optionsRef.current);
    mountedKey.current = keyOf(optionsRef.current);
    readyRef.current?.(handleRef.current);
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const node = ref.current;
    const prev = handleRef.current;
    // Also guards StrictMode's re-run of effects with an unchanged key.
    if (!node || !prev || mountedKey.current === key) return;
    mountedKey.current = key;
    const t = transitionRef.current;
    if (t) {
      handleRef.current = runTransition(prev, optionsRef.current, typeof t === 'number' ? { duration: t } : t).handle;
    } else {
      prev.destroy();
      handleRef.current = mount(node, optionsRef.current);
    }
    readyRef.current?.(handleRef.current);
  }, [key]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}
      aria-hidden="true"
    />
  );
}

export { mount } from './engine/core/mount';
export { transition } from './engine/core/transition';
export type { MountOptions, MountHandle } from './engine/core/mount';
export type { TransitionKind, TransitionOptions } from './engine/core/transition';
export type { BackgroundConfig } from './engine/config';
