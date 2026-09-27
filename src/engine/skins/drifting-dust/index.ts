import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
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
  /** Pointer attraction radius in px. 0 disables. Default 160. */
  pointerRadius?: number;
};

export const driftingDustSkin: BackgroundSkin<NetworkSkinOptions> = {
  id: 'drifting-dust',
  mount(host: SkinHost<NetworkSkinOptions>) {
    const { ctx, rng, config, options, palette, pointer } = host;
    let width = host.viewport.width;
    let height = host.viewport.height;

    // Config interpretation
    const densityMult = Math.max(0.1, config.density ?? 1);
    const maxNodes = options?.maxNodes ?? 250;
    const total = Math.min(maxNodes, Math.floor(150 * densityMult));
    const baseConnectionRadius = options?.connectionRadius ?? 120;
    const connectionRadius = baseConnectionRadius * (1 + (densityMult - 1) * 0.2);
    const pointerRadius = options?.pointerRadius ?? 160;

    // Palette comes from the host as values; no CSS variable lookups in the frame loop.
    const accent = (alpha: number) => rgba(palette.accentRgb, alpha);

    const nodes: Node[] = [];

    // Initialize nodes in normalized space so a later resize just rescales the field.
    for (let i = 0; i < total; i++) {
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
    const positions: { x: number; y: number; r: number }[] = nodes.map(() => ({ x: 0, y: 0, r: 0 }));

    return {
      resize(viewport: Viewport) {
        width = viewport.width;
        height = viewport.height;
      },

      frame({ dt }: FrameInfo) {
        // Motion is expressed per frame at 60 fps; scale by real elapsed time.
        const frames = dt * 60;
        const intensity = host.intensity;
        // Quality governor: draw fewer nodes when frames run long. Node order is stable so it degrades gracefully.
        const count = Math.max(8, Math.floor(total * (0.4 + 0.6 * host.quality)));

        const speed = (config.cameraSpeed ?? 0.25) * intensity;
        cameraX += speed * frames;
        cameraY += (speed * 0.5) * frames;

        ctx.clearRect(0, 0, width, height);

        // Calculate positions
        for (let i = 0; i < count; i++) {
          const n = nodes[i];
          n.x += (n.vx * frames * intensity) / width;
          n.y += (n.vy * frames * intensity) / height;

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
        const lineAlpha = 0.4 * (0.5 + 0.5 * intensity);
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
              ctx.strokeStyle = accent((1 - dist / connectionRadius) * lineAlpha);
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }

        // Pointer: light up nodes near the cursor with lines back to it.
        if (pointerRadius > 0 && pointer.active && pointer.idle < 2) {
          const fade = 1 - Math.min(1, pointer.idle / 2);
          const prSq = pointerRadius * pointerRadius;
          for (let i = 0; i < count; i++) {
            const p = positions[i];
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < prSq) {
              const a = (1 - Math.sqrt(d2) / pointerRadius) * 0.35 * fade;
              ctx.strokeStyle = accent(a);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(pointer.x, pointer.y);
              ctx.stroke();
            }
          }
        }

        // Draw nodes
        ctx.fillStyle = accent(0.8);
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
