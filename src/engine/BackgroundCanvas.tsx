/**
 * React adapter around createBackground. The loop lives in the skin, not here.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { createBackground } from './core/createBackground';
import { voidTacticalSkin } from './skins/void-tactical/runtime';
import type { BackgroundConfig } from './config';
import type { BackgroundSkin } from './core/skin';

export type BackgroundCanvasProps = {
  config?: BackgroundConfig;
  skin?: BackgroundSkin;
};

const BackgroundCanvas: React.FC<BackgroundCanvasProps> = ({ config, skin = voidTacticalSkin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = useMemo(
    () => JSON.stringify({
      seed: config?.seed,
      density: config?.density,
      detail: config?.detail ?? config?.labelDensity,
      cameraSpeed: config?.cameraSpeed,
      targetFps: config?.targetFps,
      palette: config?.palette,
      skin: skin.id,
    }),
    [config?.seed, config?.density, config?.detail, config?.labelDensity, config?.cameraSpeed, config?.targetFps, config?.palette, skin.id],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createBackground(canvas, { config, skin });
    return () => handle.destroy();
  }, [key, config, skin]);

  return (
    <canvas
      ref={canvasRef}
      className="space-sim-canvas bg-engine-canvas"
      aria-hidden="true"
    />
  );
};

export default React.memo(BackgroundCanvas);
