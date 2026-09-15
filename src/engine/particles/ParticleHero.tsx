import { useParticleCanvas, type ParticleCanvasOptions } from './useParticleCanvas';

export type ParticleHeroProps = ParticleCanvasOptions & {
  className?: string;
  ariaLabel?: string;
};

/**
 * Interactive particle typography canvas. Rasterizes `text` offscreen,
 * spawns particles on the glyph outline, and applies mouse repulsion +
 * spring return — the "bubble galaxies" hero from the original landing page.
 */
export function ParticleHero({
  className = 'particle-canvas',
  ariaLabel,
  ...options
}: ParticleHeroProps) {
  const canvasRef = useParticleCanvas(options);
  const label = ariaLabel ?? `Interactive particle effect with "${options.text ?? 'bubble galaxies'}" text`;

  return (
    <div className="particle-hero">
      <canvas ref={canvasRef} className={className} aria-label={label} />
    </div>
  );
}
