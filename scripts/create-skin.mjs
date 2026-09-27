#!/usr/bin/env node
/**
 * Scaffold a new skin that already follows the engine's conventions:
 *
 *   pnpm create-skin ember-drift            # canvas skin
 *   pnpm create-skin ember-drift --label "Ember drift" --tags "warm,calm"
 *
 * Creates src/engine/skins/<id>/index.ts from a template, registers it in
 * src/engine/skins/local.ts, and adds it to e2e/subjects.json so the
 * determinism, contrast, and screenshot gates cover it. Then run:
 *
 *   pnpm skin:check <id>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: pnpm create-skin <kebab-case-id> [--label "Name"] [--tags "a,b"]');
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const label = flag('label', id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const tags = flag('tags', 'custom').split(',').map((t) => t.trim()).filter(Boolean);
const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const exportName = `${camel}Skin`;

const root = resolve(process.cwd());
const dir = resolve(root, 'src/engine/skins', id);
if (existsSync(dir)) {
  console.error(`Skin folder already exists: ${dir}`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const template = `import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import { resolveOptions, resolveColor } from '../../core/schema';
import { rgba } from '../../palette';

/**
 * ${label}
 *
 * Conventions this skin follows (keep them; the gates check most of them):
 * - randomness only from host.rng / host.fork(), never Math.random
 * - time only from FrameInfo (t, dt); no Date.now, performance.now, or timers
 * - colors from host.palette or schema color fields, never hardcoded
 * - motion scaled by dt (seconds) and host.intensity; detail by host.quality
 * - everything released in destroy()
 */
const schema = {
  count: { type: 'number', min: 10, max: 400, step: 1, default: 90, label: 'Count' },
  size: { type: 'number', min: 0.5, max: 6, default: 2, label: 'Size' },
  speed: { type: 'number', min: 0, max: 2, default: 0.5, label: 'Speed' },
  color: { type: 'color', default: 'accent', label: 'Color', description: 'Palette token (accent, ink, inkDim, bg, hazard) or hex' },
} as const;

export type ${camel[0].toUpperCase() + camel.slice(1)}Options = Partial<{
  count: number;
  size: number;
  speed: number;
  color: string;
}>;

type Mote = { x: number; y: number; vx: number; vy: number; r: number; phase: number };

export const ${exportName}: BackgroundSkin<${camel[0].toUpperCase() + camel.slice(1)}Options> = {
  id: '${id}',
  label: '${label}',
  description: 'TODO: one sentence on the look and the niche it serves.',
  tags: ${JSON.stringify(tags)},
  schema,
  // Config applied beneath the caller's config. Pick the palette this skin is designed for.
  defaults: { palette: 'void-cyan', intensity: 0.8 },
  mount(host: SkinHost<${camel[0].toUpperCase() + camel.slice(1)}Options>) {
    const { ctx, rng, noise, palette } = host;
    const o = resolveOptions(schema, host.options);
    const color = resolveColor(o.color, palette);

    // World generation in normalized coordinates so a resize only rescales.
    const motes: Mote[] = Array.from({ length: o.count }, () => ({
      x: rng(),
      y: rng(),
      vx: (rng() - 0.5) * 0.02,
      vy: (rng() - 0.5) * 0.02,
      r: (0.5 + rng()) * o.size,
      phase: rng() * Math.PI * 2,
    }));

    return {
      resize(_viewport: Viewport) {
        // Regenerate size-dependent caches here if you have any.
      },
      frame({ t, dt }: FrameInfo) {
        const { width, height } = host.viewport;
        const speed = o.speed * host.intensity * dt;
        const shown = Math.floor(motes.length * Math.max(0.3, host.quality));
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < shown; i++) {
          const m = motes[i];
          const drift = noise.noise2(m.x * 2, m.y * 2 + t * 0.05) * Math.PI;
          m.x = ((m.x + (m.vx + Math.cos(drift) * 0.01) * speed) % 1 + 1) % 1;
          m.y = ((m.y + (m.vy + Math.sin(drift) * 0.01) * speed) % 1 + 1) % 1;
          const alpha = 0.35 + 0.35 * Math.sin(t * 1.5 + m.phase);
          ctx.fillStyle = rgba(color.rgb, alpha * (0.5 + 0.5 * host.intensity));
          ctx.beginPath();
          ctx.arc(m.x * width, m.y * height, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      destroy() {},
    };
  },
};
`;

writeFileSync(resolve(dir, 'index.ts'), template);

// Register in local.ts
const localPath = resolve(root, 'src/engine/skins/local.ts');
let local = readFileSync(localPath, 'utf8');
local = local.replace('// create-skin:imports', `import { ${exportName} } from './${id}';\n// create-skin:imports`);
local = local.replace('  // create-skin:entries', `  ${exportName},\n  // create-skin:entries`);
writeFileSync(localPath, local);

// Add to e2e subjects
const subjectsPath = resolve(root, 'e2e/subjects.json');
const subjects = JSON.parse(readFileSync(subjectsPath, 'utf8'));
if (!subjects.includes(id)) {
  subjects.push(id);
  writeFileSync(subjectsPath, JSON.stringify(subjects, null, 2) + '\n');
}

console.log(`Created src/engine/skins/${id}/index.ts`);
console.log(`Registered ${exportName} in src/engine/skins/local.ts`);
console.log(`Added "${id}" to e2e/subjects.json`);
console.log('');
console.log('Next:');
console.log(`  pnpm dev                 # pick "${label}" under Skins in the studio`);
console.log(`  pnpm skin:check ${id}     # typecheck, determinism, screenshot, contrast, replay`);
