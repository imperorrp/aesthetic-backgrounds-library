/**
 * React adapter around createBackground. The loop lives in the skin, not here.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { createBackground } from './core/createBackground';
import { voidTacticalSkin } from './skins/void-tactical/runtime';
import type { BackgroundConfig } from './config';
import type { BackgroundSkin } from './core/skin';

export type BackgroundCanvasProps<T = any> = {
  config?: BackgroundConfig;
  skin?: BackgroundSkin<T>;
  options?: T;
};

const BackgroundCanvas = <T = any>({ config, skin = voidTacticalSkin as any, options }: BackgroundCanvasProps<T>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = useMemo(
    () => JSON.stringify({
      seed: config?.seed,
      density: config?.density,
      detail: config?.detail ?? config?.labelDensity,
      cameraSpeed: config?.cameraSpeed,
      targetFps: config?.targetFps,
      palette: config?.palette,
      intensity: config?.intensity,
      motion: config?.motion,
      skin: skin?.id,
      options,
    }),
    [config?.seed, config?.density, config?.detail, config?.labelDensity, config?.cameraSpeed, config?.targetFps, config?.palette, config?.intensity, config?.motion, skin?.id, options],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createBackground(canvas, { config, skin, options });
    return () => handle.destroy();
  }, [key, config, skin]);

  return (
    <canvas
      ref={canvasRef}
      className="space-sim-canvas bg-engine-canvas"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', zIndex: 10 }}
      aria-hidden="true"
    />
  );
};

export default React.memo(BackgroundCanvas);
