/**
 * Ambient CSS / SVG overlay stack from the Bubble Galaxies landing page.
 * Sits between the space-simulation canvas and page content.
 */
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import './overlays.css';
import { DEFAULT_OVERLAYS, type OverlayFlags } from './overlays/flags';

export type AmbientLayerFlags = OverlayFlags;

export function AmbientOverlays({
  layers,
  children,
}: {
  layers?: AmbientLayerFlags;
  /** Extra layers (typically the space-sim canvas) rendered inside the stack. */
  children?: ReactNode;
}) {
  const flags = { ...DEFAULT_OVERLAYS, ...layers };
  const glowRef = useRef<HTMLDivElement>(null);

  return (
    <div className="ambient-stack" aria-hidden="true">
      {flags.gradient && <div className="space-gradient-base" />}
      {flags.mesh && <div className="mesh-gradient-layer" />}
      {flags.asciiGrid && <div className="ascii-grid-base" />}
      {flags.ascii1 && <div className="ascii-layer-1" />}
      {flags.ascii2 && <div className="ascii-layer-2" />}
      {flags.clouds && <div className="ascii-clouds" />}
      {flags.noise && <div className="noise-texture" />}
      {flags.starfield && <div className="starfield-layer" />}
      {flags.mouseGlow && <MouseGlow glowRef={glowRef} />}
      {children}
    </div>
  );
}

function MouseGlow({ glowRef }: { glowRef: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      if (glowRef.current) {
        glowRef.current.style.setProperty('--mouse-x', `${x}%`);
        glowRef.current.style.setProperty('--mouse-y', `${y}%`);
        glowRef.current.style.opacity = '1';
      }
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (glowRef.current) glowRef.current.style.opacity = '0';
      }, 1000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, [glowRef]);

  return <div ref={glowRef} className="mouse-glow-layer" style={{ opacity: 0 }} />;
}
