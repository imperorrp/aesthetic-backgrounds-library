#!/usr/bin/env node
/**
 * Scaffold a new world from the template (the Pond), already on the kit:
 *
 *   pnpm create-world tidepool
 *   pnpm create-world tidepool --label "Tide pool"
 *
 * Copies src/engine/skins/worlds/template/ to src/engine/skins/worlds/<id>/, renames the skin
 * (id, label, export), and registers it in src/engine/skins/local.ts, so the studio lists it
 * and the lab and the headless runner can run it. Then, in order:
 *
 *   1. write the brief (docs/AUTHORING.md has the template)
 *   2. pnpm world:check <id>      the bar in numbers: busy, never quiet, varied, replays, phones
 *   3. pnpm lab <id> t=10,60,300,900 w=1280 h=800, and again at w=390 h=844: look at it
 */
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || id === 'template') {
  console.error('Usage: pnpm create-world <kebab-case-id> [--label "Name"]');
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const label = flag('label', id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const exportName = `${camel}Skin`;

const root = resolve(process.cwd());
const from = resolve(root, 'src/engine/skins/worlds/template');
const dir = resolve(root, 'src/engine/skins/worlds', id);
if (existsSync(dir)) {
  console.error(`World folder already exists: ${dir}`);
  process.exit(1);
}
cpSync(from, dir, { recursive: true });

// Rename the skin; the pond inside stays a pond until you change it.
for (const f of readdirSync(dir)) {
  const p = resolve(dir, f);
  let s = readFileSync(p, 'utf8');
  s = s
    .replaceAll("'template-pond'", `'${id}'`)
    .replaceAll("'The Pond (template)'", `'${label.replaceAll("'", "\\'")}'`)
    .replaceAll('templatePondSkin', exportName)
    .replaceAll('the template pond (headless)', `${label} (headless)`);
  writeFileSync(p, s);
}
renameSync(resolve(dir, 'template.sim.test.ts'), resolve(dir, `${id}.sim.test.ts`));

const localPath = resolve(root, 'src/engine/skins/local.ts');
let local = readFileSync(localPath, 'utf8');
local = local.replace('// create-skin:imports', `import { ${exportName} } from './worlds/${id}';\n// create-skin:imports`);
local = local.replace('  // create-skin:entries', `  ${exportName},\n  // create-skin:entries`);
writeFileSync(localPath, local);

console.log(`Created src/engine/skins/worlds/${id}/ (sim.ts, paint.ts, index.ts, ${id}.sim.test.ts) from the Pond.`);
console.log(`Registered ${exportName} in src/engine/skins/local.ts.`);
console.log('');
console.log('Next:');
console.log('  1. Write the brief: docs/AUTHORING.md has the template. Then replace the pond with your world.');
console.log(`  2. pnpm world:check ${id}`);
console.log(`  3. pnpm lab ${id} t=10,60,300,900, and with w=390 h=844 for a phone`);
console.log('  4. When it passes: sightings in src/demo/witness.ts, a card in the studio, thumbs, a sound palette.');
