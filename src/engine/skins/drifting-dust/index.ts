import type { BackgroundSkin, SkinHost, Viewport } from '../../core/skin';
import { rgba } from '../../palette';

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
    const { canvas, ctx, rng, config, options, palette } = host;
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;

    // Config interpretation
    const densityMult = Math.max(0.1, config.density ?? 1);
    const maxNodes = options?.maxNodes ?? 250;
    const count = Math.min(maxNodes, Math.floor(150 * densityMult));
    const baseConnectionRadius = options?.connectionRadius ?? 120;
    const connectionRadius = baseConnectionRadius * (1 + (densityMult - 1) * 0.2);

    // Palette comes from the host as values; no CSS variable lookups in the frame loop.
    const accent = (alpha: number) => rgba(palette.accentRgb, alpha);
    const nodeFill = accent(0.8);

    const nodes: Node[] = [];

    // Initialize nodes in normalized space so a later resize just rescales the field.
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: rng(),
        y: rng(),
        vx: (rng() - 0.5) * 0.4,
        vy: (rng() - 0.5) * 0.4,
        radius: rng() * 1.5 + 1.0,
        parallax: rng() * 0.4 + 0.6, // 0.6 to 1.0
      });
    }

    let cameraX = 0;
    let cameraY = 0;
    let lastTime = 0;
    const positions: { x: number; y: number; r: number }[] = nodes.map(() => ({ x: 0, y: 0, r: 0 }));

    return {
      resize(viewport: Viewport) {
        width = viewport.width;
        height = viewport.height;
      },

      frame(timestamp: number) {
        const dt = lastTime ? Math.min(3, (timestamp - lastTime) / 16.66) : 1;
        lastTime = timestamp;

        const speed = config.cameraSpeed ?? 0.25;
        cameraX += speed * dt;
        cameraY += (speed * 0.5) * dt;

        ctx.clearRect(0, 0, width, height);

        // Calculate positions
        for (let i = 0; i < count; i++) {
          const n = nodes[i];
          n.x += (n.vx * dt) / width;
          n.y += (n.vy * dt) / height;

          const drawX = n.x * width - (cameraX * n.parallax);
          const drawY = n.y * height - (cameraY * n.parallax);

          const p = positions[i];
          p.x = ((drawX % width) + width) % width;
          p.y = ((drawY % height) + height) % height;
          p.r = n.radius;
        }

        // Draw connections O(n^2) but optimized by skipping faraway nodes
        // (For a real skin with 10k nodes we'd use a quadtree, but for 150-250 this is fine)
        ctx.lineWidth = 1;
        const radSq = connectionRadius * connectionRadius;
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

            if (distSq < radSq) {
              const dist = Math.sqrt(distSq);
              // Opacity decays with distance
              ctx.strokeStyle = accent((1 - dist / connectionRadius) * 0.4);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }

        // Draw nodes
        ctx.fillStyle = nodeFill;
        for (let i = 0; i < count; i++) {
          const p = positions[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      },

      destroy() {
        // Nothing to clean up
      },
    };
  },
};
