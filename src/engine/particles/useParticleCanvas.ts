/**
 * Particle Canvas Hook
 *
 * @description Custom hook for managing interactive particle canvas animations
 * with space-themed effects including nebula backgrounds, constellation lines,
 * particle trails, and mouse/touch interactions.
 *
 * @component
 * @example
 * ```tsx
 * const canvasRef = useParticleCanvas();
 *
 * return <canvas ref={canvasRef} />;
 * ```
 *
 * @features
 * - Nebula background with animated radial gradients and parallax scrolling
 * - Interactive particle scattering with mouse/touch interactions
 * - Constellation mode with dynamic line connections between nearby particles
 * - Spatial grid optimization for efficient neighbor queries (O(n) instead of O(n²))
 * - Performance monitoring with detailed frame time breakdowns
 * - Responsive design with mobile-optimized particle counts and touch handling
 * - Intersection Observer for pause/resume when canvas is off-screen
 * - Chromatic aberration effects and scanline overlays
 * - Particle trails with fade-out animations
 * - Gravity wells and depth layering for 3D-like effects
 * - Text-based particle spawning using "bubble galaxies" typography
 *
 * @returns canvasRef - Ref to attach to HTMLCanvasElement for particle animations
 */

import { useRef, useEffect, useState } from 'react';

const perf = {
  updateFrameStat: (_name: string, _value: number) => {},
};

export type ParticleCanvasOptions = {
  /** Typography rasterized into spawn points. Default matches Bubble Galaxies. */
  text?: string;
  /** Two-line split used below 768px. Defaults to splitting `text` on whitespace. */
  mobileLines?: [string, string];
  /** Particle budget at 1920x1080; scaled by viewport area. */
  baseParticleCount?: number;
  /** Opaque clear color. Original landing used #050505. */
  fillColor?: string;
};

const SPACE_EFFECTS = {
  nebulaBackground: true,
  particleTrails: false,
  depthLayers: false,
  gravityWells: true,
  constellationMode: true,
  bloomEffects: false,
  chromaticAberration: true,
  scanlines: false,
};

export const useParticleCanvas = (options: ParticleCanvasOptions = {}) => {
  const text = options.text ?? 'bubble galaxies';
  const mobileLines = options.mobileLines;
  const baseParticleCount = options.baseParticleCount ?? 3500;
  const fillColor = options.fillColor ?? '#050505';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const isTouchingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const nebulaOffsetRef = useRef(0);
  const nebulaScrollRef = useRef(0);
  const trailsRef = useRef<Array<{ x: number; y: number; alpha: number; color: string }>>([]);
  const constellationLinesRef = useRef<Array<{ x1: number; y1: number; x2: number; y2: number; alpha: number }>>([]);
  const isVisibleRef = useRef(true);
  const animationPausedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      setIsMobile(window.innerWidth < 768);
    };

    updateCanvasSize();

    let particles: {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      color: string;
      scatteredColor: string;
      life: number;
      isAWS: boolean;
      depth: number;
      trail: Array<{ x: number; y: number; alpha: number }>;
      vx: number;
      vy: number;
      currentColor: string;
    }[] = [];

    // Spatial hash grid for neighbor queries (reduces O(n^2) searches)
    const CELL_SIZE = 120;
    let spatialGrid: Map<string, number[]> = new Map();

    const cellKeyFor = (x: number, y: number) => `${Math.floor(x / CELL_SIZE)}_${Math.floor(y / CELL_SIZE)}`;

    const populateGrid = () => {
      spatialGrid.clear();
      for (let i = 0; i < particles.length; i++) {
        const p2 = particles[i];
        const key = cellKeyFor(p2.x, p2.y);
        const bucket = spatialGrid.get(key) || [];
        bucket.push(i);
        spatialGrid.set(key, bucket);
      }
    };

    const nearbyIndicesFor = (x: number, y: number, radius: number) => {
      const indices: number[] = [];
      const r = Math.ceil(radius / CELL_SIZE);
      const cx = Math.floor(x / CELL_SIZE);
      const cy = Math.floor(y / CELL_SIZE);
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const k = `${cx + dx}_${cy + dy}`;
          const list = spatialGrid.get(k);
          if (!list) continue;
          for (const idx of list) indices.push(idx);
        }
      }
      return indices;
    };

    let textImageData: ImageData | null = null;
    let validTextCoordinates: {x: number, y: number}[] = [];
    let linkCounts: Uint8Array | null = null;

    function drawNebulaBackground() {
      if (!SPACE_EFFECTS.nebulaBackground || !ctx || !canvas) return;

      // combine a time offset with a small scroll-driven parallax offset
      const phase = nebulaOffsetRef.current * 0.01 + nebulaScrollRef.current * 0.001;

      // Primary cyan/teal radial gradient
      const gradient1 = ctx.createRadialGradient(
        canvas.width * 0.3,
        canvas.height * 0.4,
        0,
        canvas.width * 0.7,
        canvas.height * 0.6,
        canvas.width * 0.8,
      );
      gradient1.addColorStop(0, `rgba(6, 182, 212, ${0.12 + Math.sin(phase) * 0.05})`);
      gradient1.addColorStop(0.4, `rgba(56, 189, 248, ${0.08 + Math.cos(phase * 0.8) * 0.03})`);
      gradient1.addColorStop(0.7, `rgba(20, 184, 166, ${0.05 + Math.sin(phase * 1.2) * 0.02})`);
      gradient1.addColorStop(1, `rgba(14, 165, 233, ${0.02})`);

      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Secondary accent gradient (offset position for depth)
      const gradient2 = ctx.createRadialGradient(
        canvas.width * 0.7,
        canvas.height * 0.3,
        0,
        canvas.width * 0.5,
        canvas.height * 0.7,
        canvas.width * 0.6,
      );
      gradient2.addColorStop(0, `rgba(56, 189, 248, ${0.08 + Math.cos(phase * 1.5) * 0.04})`);
      gradient2.addColorStop(0.5, `rgba(6, 182, 212, ${0.04 + Math.sin(phase * 0.9) * 0.02})`);
      gradient2.addColorStop(1, 'rgba(20, 184, 166, 0)');

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      nebulaOffsetRef.current++;
    }

    function drawScanlines() {
      if (!SPACE_EFFECTS.scanlines || !ctx || !canvas) return;

      ctx.strokeStyle = `rgba(255, 255, 255, 0.03)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }

    function drawConstellationLines() {
      if (!SPACE_EFFECTS.constellationMode || !ctx) return;

      // Check if mouse is actively interacting (within distortion range)
      const { x: mouseX, y: mouseY } = mousePositionRef.current;
      const isMouseInteracting = particles.some(p => {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 240 && (isTouchingRef.current || !("ontouchstart" in window));
      });

      // Update constellation lines with faster fade during interaction
      const fadeRate = isMouseInteracting ? 0.05 : 0.01; // 5x faster fade when interacting
      constellationLinesRef.current = constellationLinesRef.current.filter((line) => {
        line.alpha -= fadeRate;
        return line.alpha > 0;
      });

      // Draw constellation lines
      if (constellationLinesRef.current.length > 0) {
        ctx.save();
        ctx.lineWidth = 1.5;
        // Batch shadow settings
        ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
        ctx.shadowBlur = 3;
        
        // Group lines by alpha to minimize state changes (approximate bucketing)
        // Or just draw them. For max perf, we might skip shadow if too many lines.
        
        ctx.beginPath();
        constellationLinesRef.current.forEach((line) => {
          // We can't easily batch different alphas in one path without globalAlpha
          // But we can batch the shadow context.
          // Actually, strokeStyle changes per line due to alpha.
          // So we must stroke each one. 
          // BUT we can avoid setting shadowBlur repeatedly.
          
          ctx.strokeStyle = `rgba(6, 182, 212, ${line.alpha * 0.25})`;
          ctx.beginPath();
          ctx.moveTo(line.x1, line.y1);
          ctx.lineTo(line.x2, line.y2);
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    function createTextImage() {
      if (!ctx || !canvas) return 0;

      ctx.fillStyle = "white";
      ctx.save();

      // Responsive font sizing: 48px on mobile; on larger screens scale with viewport width
      // and clamp to sensible min/max so the particle-text remains readable.
      const vw = Math.max(window.innerWidth || 320, 320);
      const fontSize = isMobile
        ? 48
        : Math.min(Math.max(Math.round(vw * 0.06), 96), 172); // 6% of width, clamped 56-140
      ctx.font = `bold ${fontSize}px "Syne Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // On mobile, split text into two lines to prevent cropping
      if (isMobile) {
        const parts = text.trim().split(/\s+/);
        const text1 = mobileLines?.[0] ?? parts[0] ?? text;
        const text2 = mobileLines?.[1] ?? (parts.slice(1).join(' ') || parts[0] || text);
        const x = canvas.width / 2;
        const y1 = canvas.height / 2 - fontSize * 0.6;
        const y2 = canvas.height / 2 + fontSize * 0.6;
        ctx.fillText(text1, x, y1);
        ctx.fillText(text2, x, y2);
      } else {
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        ctx.fillText(text, x, y);
      }

      ctx.restore();

      textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Pre-calculate valid spawn points to avoid scanning in the animation loop
      const validCoords: {x: number, y: number}[] = [];
      const data = textImageData.data;
      for (let y = 0; y < canvas.height; y += 2) { // Skip every other row for speed/memory
        for (let x = 0; x < canvas.width; x += 2) {
          if (data[(y * canvas.width + x) * 4 + 3] > 128) {
            validCoords.push({x, y});
          }
        }
      }
      validTextCoordinates = validCoords;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      return fontSize / 100;
    }

    function createParticle() {
      if (!ctx || !canvas || validTextCoordinates.length === 0) return null;

      // O(1) particle creation using pre-calculated coordinates
      const coords = validTextCoordinates[Math.floor(Math.random() * validTextCoordinates.length)];
      const x = coords.x;
      const y = coords.y;

      const centerX = canvas.width / 2;
      const isRightSide = x >= centerX;
      
      return {
        x: x,
        y: y,
        baseX: x,
        baseY: y,
        size: Math.random() * 1 + 0.5,
        color: "rgba(125, 211, 252, 0.95)",
        scatteredColor: isRightSide ? "rgba(56, 189, 248, 0.9)" : "rgba(6, 182, 212, 0.85)",
        isAWS: isRightSide,
        life: Math.random() * 100 + 50,
        depth: Math.random() * 0.5 + 0.5,
        trail: [],
        vx: 0,
        vy: 0,
        currentColor: "rgba(125, 211, 252, 0.95)",
      };
    }

    function createInitialParticles() {
      if (!canvas) return;
      const particleCount = Math.floor(baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080)));
      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle();
        if (particle) particles.push(particle);
      }
    }

    let animationFrameId: number;
    let frameCounter = 0;
    const GRID_UPDATE_FRAMES = 3; // update spatial grid every N frames to save CPU

    function animate(scale: number) {
      if (!ctx || !canvas || !isVisibleRef.current) return;

      const tStart = performance.now();

      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const tClear = performance.now();
      perf.updateFrameStat('canvas:clear', tClear - tStart);

      // Draw nebula background every frame (it's a gradient, not expensive)
      drawNebulaBackground();
      const tNebula = performance.now();
      perf.updateFrameStat('canvas:nebula', tNebula - tClear);

      drawScanlines();
      const tScanlines = performance.now();
      perf.updateFrameStat('canvas:scanlines', tScanlines - tNebula);

      const { x: mouseX, y: mouseY } = mousePositionRef.current;
      const maxDistance = 240;

      // Populate spatial grid every few frames to reduce CPU overhead
      frameCounter++;
      if (frameCounter % GRID_UPDATE_FRAMES === 0) populateGrid();

      // Per-frame link counts to limit how many constellation links a particle can create
      const maxLinksPerParticle = 2;
      
      // Reuse linkCounts array to avoid allocation
      if (!linkCounts || linkCounts.length !== particles.length) {
        linkCounts = new Uint8Array(particles.length);
      } else {
        linkCounts.fill(0);
      }

      if (SPACE_EFFECTS.particleTrails) {
        trailsRef.current = trailsRef.current.filter((trail) => {
          trail.alpha -= 0.02;
          return trail.alpha > 0;
        });
      }

      const tPrep = performance.now();
      perf.updateFrameStat('particles:prep', tPrep - tScanlines);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Skip distant particles when mouse is active (culling optimization)
        const roughDx = Math.abs(mouseX - p.baseX);
        const roughDy = Math.abs(mouseY - p.baseY);
        if (roughDx > 500 && roughDy > 500) {
          // Still render particle but skip physics updates
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          continue;
        }
        
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        // Optimization: Use squared distance check first to avoid sqrt
        const distSq = dx * dx + dy * dy;
        const maxDistSq = maxDistance * maxDistance;

        if (distSq < maxDistSq && (isTouchingRef.current || !("ontouchstart" in window))) {
          const distance = Math.sqrt(distSq);
          const force = 1.25 * (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          const moveX = Math.cos(angle) * force * 80;
          const moveY = Math.sin(angle) * force * 80;
          p.x = p.baseX - moveX;
          p.y = p.baseY - moveY;
          p.currentColor = p.scatteredColor;
        } else {
          p.x += (p.baseX - p.x) * 0.1;
          p.y += (p.baseY - p.y) * 0.1;
          p.currentColor = "rgba(125, 211, 252, 0.95)";
        }

        if (SPACE_EFFECTS.particleTrails && (Math.abs(p.x - p.baseX) > 5 || Math.abs(p.y - p.baseY) > 5)) {
          trailsRef.current.push({
            x: p.x,
            y: p.y,
            alpha: 0.8,
            color: p.currentColor,
          });
        }

        if (SPACE_EFFECTS.constellationMode && Math.random() < 0.0005) {
          // Use spatial grid to find nearby candidates (faster than full filter)
          let candidateIdx = nearbyIndicesFor(p.x, p.y, 100);
          if (candidateIdx.length === 0) continue;
          // cap candidates to a reasonable sample to avoid worst-case work
          if (candidateIdx.length > 30) candidateIdx = candidateIdx.slice(0, 30);

          // pick a random nearby candidate (skip self) while respecting per-particle link budgets
          const validCandidates: number[] = [];
          for (const idx of candidateIdx) {
            if (idx === i) continue;
            if (linkCounts[i] >= maxLinksPerParticle) break; // this particle reached its budget
            const other = particles[idx];
            if (!other) continue;
            const dist = Math.hypot(other.x - p.x, other.y - p.y);
            if (dist < 100 && dist > 20 && linkCounts[idx] < maxLinksPerParticle) validCandidates.push(idx);
          }
          if (validCandidates.length > 0 && linkCounts[i] < maxLinksPerParticle) {
            const targetIdx = validCandidates[Math.floor(Math.random() * validCandidates.length)];
            const target = particles[targetIdx];
            constellationLinesRef.current.push({ x1: p.x, y1: p.y, x2: target.x, y2: target.y, alpha: 1 });
            // increment link counters for both endpoints
            linkCounts[i]++;
            linkCounts[targetIdx]++;
          }
        }

        const depthScale = SPACE_EFFECTS.depthLayers ? p.depth : 1;
        const particleSize = p.size * depthScale;

        if (SPACE_EFFECTS.chromaticAberration && p.currentColor !== "rgba(125, 211, 252, 0.95)") {
          // Chromatic aberration effect with cyan glow
          ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
          ctx.fillRect(p.x - 0.5, p.y - 0.5, particleSize, particleSize);
          ctx.fillStyle = "rgba(6, 182, 212, 0.3)";
          ctx.fillRect(p.x + 0.5, p.y + 0.5, particleSize, particleSize);
        }

        ctx.fillStyle = p.currentColor;
        ctx.fillRect(p.x, p.y, particleSize, particleSize);

        p.life--;
        if (p.life <= 0) {
          const newParticle = createParticle();
          if (newParticle) {
            particles[i] = newParticle;
          } else {
            particles.splice(i, 1);
            i--;
          }
        }
      }

      const tParticles = performance.now();
      perf.updateFrameStat('particles:update+draw', tParticles - tPrep);

      if (SPACE_EFFECTS.particleTrails) {
        trailsRef.current.forEach((trail) => {
          ctx.fillStyle = trail.color.replace(")", `, ${trail.alpha})`).replace("rgb", "rgba").replace("#", "rgba");
          if (trail.color.startsWith("#")) {
            const hex = trail.color.slice(1);
            const r = Number.parseInt(hex.slice(0, 2), 16);
            const g = Number.parseInt(hex.slice(2, 4), 16);
            const b = Number.parseInt(hex.slice(4, 6), 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${trail.alpha * 0.3})`;
          }
          ctx.fillRect(trail.x, trail.y, 1, 1);
        });
      }

      const tTrails = performance.now();
      perf.updateFrameStat('particles:trails', tTrails - tParticles);

      drawConstellationLines();

      const tConstellations = performance.now();
      perf.updateFrameStat('particles:constellations', tConstellations - tTrails);
      perf.updateFrameStat('total:animate', tConstellations - tStart);

      // Log performance every 60 frames (every ~1 second at 60fps)
      if (frameCounter % 60 === 0) {
        /* console.log('🎯 PARTICLE CANVAS PERFORMANCE:', {
          'Total Frame Time': `${(tConstellations - tStart).toFixed(2)}ms`,
          'Target FPS': (tConstellations - tStart) > 16.67 ? `❌ ${(1000/(tConstellations - tStart)).toFixed(0)} FPS (SLOW)` : `✅ ${(1000/(tConstellations - tStart)).toFixed(0)} FPS`,
          'Canvas Clear': `${(tClear - tStart).toFixed(2)}ms`,
          'Nebula Background': `${(tNebula - tClear).toFixed(2)}ms`,
          'Scanlines': `${(tScanlines - tNebula).toFixed(2)}ms`,
          'Prep (trails filter)': `${(tPrep - tScanlines).toFixed(2)}ms`,
          'Particle Update+Draw': `${(tParticles - tPrep).toFixed(2)}ms 🔴 MAIN BOTTLENECK`,
          'Trail Rendering': `${(tTrails - tParticles).toFixed(2)}ms`,
          'Constellation Lines': `${(tConstellations - tTrails).toFixed(2)}ms`,
          'Particle Count': particles.length,
        }); */
      }

      const targetParticleCount = Math.floor(
        baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 1080)),
      );
      while (particles.length < targetParticleCount) {
        const newParticle = createParticle();
        if (newParticle) particles.push(newParticle);
      }

      animationFrameId = requestAnimationFrame(() => animate(scale));
    }

    const scale = createTextImage();
    createInitialParticles();
    
    // Intersection Observer to pause when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting && animationPausedRef.current) {
          animationPausedRef.current = false;
          animationFrameId = requestAnimationFrame(() => animate(scale));
        } else if (!entry.isIntersecting) {
          animationPausedRef.current = true;
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
        }
      },
      { threshold: 0.1 }
    );
    
    if (canvas) observer.observe(canvas);
    animate(scale);

    const handleResize = () => {
      updateCanvasSize();
      createTextImage();
      particles = [];
      createInitialParticles();
    };

    const handleMove = (x: number, y: number) => {
      mousePositionRef.current = { x, y };
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchStart = () => {
      isTouchingRef.current = true;
    };

    const handleTouchEnd = () => {
      isTouchingRef.current = false;
      mousePositionRef.current = { x: 0, y: 0 };
    };

    const handleMouseLeave = () => {
      if (!("ontouchstart" in window)) {
        mousePositionRef.current = { x: 0, y: 0 };
      }
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      if (canvas) observer.disconnect();
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMobile, text, mobileLines?.[0], mobileLines?.[1], baseParticleCount, fillColor]);

  return canvasRef;
};