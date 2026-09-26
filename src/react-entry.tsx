import { useEffect, useRef, type CSSProperties } from 'react';
import { mount, type MountOptions } from './engine/core/mount';
// Registers the built-in skins so `skin="matrix-rain"` resolves.
import './engine/skins';

export type BackgroundProps = MountOptions & {
  className?: string;
  style?: CSSProperties;
};

/**
 * React wrapper around `mount`. One component = full background (layers + canvas).
 * Any prop change tears the background down and mounts it again.
 */
export function Background({ className, style, ...options }: BackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify({
    seed: options.seed,
    density: options.density,
    detail: options.detail ?? options.labelDensity,
    palette: options.palette,
    cameraSpeed: options.cameraSpeed,
    targetFps: options.targetFps,
    zIndex: options.zIndex,
    fonts: options.fonts,
    skin: typeof options.skin === 'string' ? options.skin : options.skin?.id,
    options: options.options,
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handle = mount(node, options);
    return () => handle.destroy();
    // options is reflected in `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
export type { MountOptions } from './engine/core/mount';
export type { BackgroundConfig } from './engine/config';
