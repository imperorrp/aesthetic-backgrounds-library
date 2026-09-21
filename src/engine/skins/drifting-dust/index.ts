import type { BackgroundSkin, SkinHost, Viewport } from '../../core/skin';
import { applyPalette } from '../../palette';

type DustParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  parallax: number;
};

export const driftingDustSkin: BackgroundSkin = {
  id: 'drifting-dust',
  mount(host: SkinHost) {
    const { canvas, ctx, rng, config } = host;
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    
    // Create particles deterministically
    // We base the count on the density config.
    const baseParticleCount = 200;
    const count = Math.floor(baseParticleCount * (config.density ?? 1));
    const particles: DustParticle[] = [];

    // The palette config determines the ambient CSS custom properties,
    // but the engine core injects them into the root or canvas for us.
    // For rendering on the canvas, we'll extract the accent color from the CSS vars
    // in the frame loop so we can respond to theme changes dynamically, or just use a fallback.
    let accentRgbaCache = 'rgba(200, 200, 255, 1)';
    let paletteCached = false;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: rng() * width,
        y: rng() * height,
        vx: (rng() - 0.5) * 0.2,
        vy: (rng() - 0.5) * 0.2,
        radius: rng() * 2 + 0.5,
        opacity: rng() * 0.5 + 0.1,
        parallax: rng() * 0.5 + 0.5, // 0.5 to 1.0
      });
    }

    let cameraX = 0;
    let cameraY = 0;
    let lastTime = 0;

    return {
      resize(viewport: Viewport) {
        width = viewport.width;
        height = viewport.height;
      },
      
      frame(timestamp: number) {
        const dt = lastTime ? (timestamp - lastTime) / 16.66 : 1;
        lastTime = timestamp;

        // Extract palette accent once per skin mount
        if (!paletteCached) {
          const computed = getComputedStyle(document.body);
          const accentStr = computed.getPropertyValue('--bg-accent').trim();
          if (accentStr) {
            // Assuming rgb values like "10, 255, 200"
            const parts = accentStr.split(',').map(s => parseInt(s.trim(), 10));
            if (parts.length === 3 && !parts.some(isNaN)) {
              accentRgbaCache = `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, `;
            }
          }
          paletteCached = true;
        }

        // Camera Pan
        const speed = config.cameraSpeed ?? 0.25;
        cameraX += speed * dt;
        cameraY += (speed * 0.5) * dt;

        ctx.clearRect(0, 0, width, height);

        for (const p of particles) {
          // Move
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Parallax camera offset
          const drawX = p.x - (cameraX * p.parallax);
          const drawY = p.y - (cameraY * p.parallax);

          // Wrap around viewport
          const wrapX = ((drawX % width) + width) % width;
          const wrapY = ((drawY % height) + height) % height;

          // Render
          const alpha = p.opacity;
          const color = accentRgbaCache.endsWith(', ') 
            ? `${accentRgbaCache}${alpha})` 
            : `rgba(255, 255, 255, ${alpha})`;

          ctx.beginPath();
          ctx.arc(wrapX, wrapY, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // Slight glow
          ctx.shadowBlur = p.radius * 2;
          ctx.shadowColor = color;
        }
        
        ctx.shadowBlur = 0;
      },

      destroy() {
        // Nothing to clean up
      }
    };
  }
};
