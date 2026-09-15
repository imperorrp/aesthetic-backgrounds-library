/**
 * Interactive cursor trail effect component that creates animated dots following the mouse movement.
 * Generates a trail of fading circular elements with easing animations that respond to mouse motion.
 * Automatically manages DOM elements and cleanup on unmount.
 *
 * @component
 * @example
 * ```tsx
 * <CursorTrail />
 * ```
 */

import { useEffect } from 'react';

const CursorTrail = () => {
  useEffect(() => {
    const trailElements: Array<{
      element: HTMLDivElement;
      x: number;
      y: number;
      targetX: number;
      targetY: number;
    }> = [];
    const trailLength = 8;

    const trailContainer = document.createElement('div');
    trailContainer.id = 'cursor-trail';
    trailContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(trailContainer);

    for (let i = 0; i < trailLength; i++) {
      const dot = document.createElement('div');
      dot.className = 'trail-dot';
      dot.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: ${6 - i * 0.5}px;
        height: ${6 - i * 0.5}px;
        background: color-mix(in srgb, var(--accent) ${Math.round((0.8 - i * 0.1) * 100)}%, transparent);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transition: opacity 0.3s ease;
        will-change: transform; /* Hint to browser */
      `;
      trailContainer.appendChild(dot);
      trailElements.push({
        element: dot,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0
      });
    }

    let mouseX = 0;
    let mouseY = 0;
    let isMoving = false;
    let moveTimeout: ReturnType<typeof setTimeout>;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      isMoving = true;

      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        isMoving = false;
      }, 100);
    };

    document.addEventListener('mousemove', handleMouseMove);

    let rafId = 0;
    function animateTrail() {
      trailElements.forEach((trail, index) => {
        if (index === 0) {
          trail.targetX = mouseX;
          trail.targetY = mouseY;
        } else {
          const prev = trailElements[index - 1];
          trail.targetX = prev.x;
          trail.targetY = prev.y;
        }

        const ease = 0.2 - index * 0.02;
        trail.x += (trail.targetX - trail.x) * ease;
        trail.y += (trail.targetY - trail.y) * ease;

        // Use transform translate3d to force GPU acceleration
        trail.element.style.transform = `translate3d(${trail.x}px, ${trail.y}px, 0)`;

        const opacity = isMoving ? (0.8 - index * 0.1) : (0.3 - index * 0.05);
        trail.element.style.opacity = Math.max(0, opacity).toString();
      });

      rafId = requestAnimationFrame(animateTrail);
    }

    rafId = requestAnimationFrame(animateTrail);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(moveTimeout);
      cancelAnimationFrame(rafId);
      trailContainer.remove();
    };
  }, []);

  return null;
};

export default CursorTrail;
