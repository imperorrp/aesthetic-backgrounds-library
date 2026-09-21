import type { BackgroundSkin, SkinHost, Viewport } from '../../core/skin';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  parallax: number;
};

// Extensibility proof: custom config schema specific to the network skin
export type NetworkSkinOptions = {
  connectionRadius?: number;
  maxNodes?: number;
};

export const driftingDustSkin: BackgroundSkin<NetworkSkinOptions> = {
  id: 'drifting-dust',
  mount(host: SkinHost<NetworkSkinOptions>) {
    const { canvas, ctx, rng, config, options } = host;
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    
    // Config interpretation
    const densityMult = Math.max(0.1, config.density ?? 1);
    const maxNodes = options?.maxNodes ?? 250;
    const count = Math.min(maxNodes, Math.floor(150 * densityMult));
    const baseConnectionRadius = options?.connectionRadius ?? 120;
    const connectionRadius = baseConnectionRadius * (1 + (densityMult - 1) * 0.2);

    const nodes: Node[] = [];

    // Cache palette
    let accentRgbaCache = 'rgba(200, 200, 255, ';
    let paletteCached = false;

    // Initialize nodes
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: rng() * width,
        y: rng() * height,
        vx: (rng() - 0.5) * 0.4,
        vy: (rng() - 0.5) * 0.4,
        radius: rng() * 1.5 + 1.0,
        parallax: rng() * 0.4 + 0.6, // 0.6 to 1.0
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

        if (!paletteCached) {
          const computed = getComputedStyle(document.body);
          const accentStr = computed.getPropertyValue('--bg-accent').trim();
          if (accentStr) {
            const parts = accentStr.split(',').map(s => parseInt(s.trim(), 10));
            if (parts.length === 3 && !parts.some(isNaN)) {
              accentRgbaCache = `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, `;
            }
          }
          paletteCached = true;
        }

        const speed = config.cameraSpeed ?? 0.25;
        cameraX += speed * dt;
        cameraY += (speed * 0.5) * dt;

        ctx.clearRect(0, 0, width, height);

        // Calculate positions
        const positions: { x: number; y: number; r: number; p: number }[] = [];
        for (let i = 0; i < count; i++) {
          const n = nodes[i];
          n.x += n.vx * dt;
          n.y += n.vy * dt;

          const drawX = n.x - (cameraX * n.parallax);
          const drawY = n.y - (cameraY * n.parallax);

          const wrapX = ((drawX % width) + width) % width;
          const wrapY = ((drawY % height) + height) % height;
          
          positions.push({ x: wrapX, y: wrapY, r: n.radius, p: n.parallax });
        }

        // Draw connections O(n^2) but optimized by skipping faraway nodes
        // (For a real skin with 10k nodes we'd use a quadtree, but for 150-250 this is fine)
        ctx.lineWidth = 1;
        for (let i = 0; i < count; i++) {
          const p1 = positions[i];
          for (let j = i + 1; j < count; j++) {
            const p2 = positions[j];
            
            // Fast bounding box check
            if (Math.abs(p1.x - p2.x) > connectionRadius) continue;
            if (Math.abs(p1.y - p2.y) > connectionRadius) continue;

            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;
            const radSq = connectionRadius * connectionRadius;

            if (distSq < radSq) {
              const dist = Math.sqrt(distSq);
              // Opacity decays with distance
              const alpha = (1 - dist / connectionRadius) * 0.4;
              ctx.strokeStyle = `${accentRgbaCache}${alpha})`;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }

        // Draw nodes
        for (let i = 0; i < count; i++) {
          const p = positions[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `${accentRgbaCache}0.8)`;
          ctx.fill();
        }
      },

      destroy() {
        // Nothing to clean up
      }
    };
  }
};
