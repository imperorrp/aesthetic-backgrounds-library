#!/usr/bin/env node
/**
 * bg-engine: browse the registry and copy a background into your project.
 *
 *   npx space-background-engine list [--kind preset|skin|layer] [--tag dark] [--json]
 *   npx space-background-engine info <id>
 *   npx space-background-engine add <id> [--dir src/backgrounds] [--js]
 *        [--palette <hex|id>] [--theme dark|light] [--intensity 0.6] [--tokens tokens.json] [--force]
 *   npx space-background-engine validate <manifest.json>
 *
 * `add` writes one editable file with the preset's scene inlined and a
 * `mountBackground()` function. The scene is yours to change; the engine stays a
 * dependency, so fixes and new layers arrive with upgrades.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const registryPath = resolve(pkgRoot, 'registry/index.json');

const args = process.argv.slice(2);
const cmd = args[0];
/** Flags that never take a value, so the argument after them is positional. */
const BOOLEAN_FLAGS = new Set(['--js', '--force', '--json', '--help']);
const positional = args.filter((a, i) => i > 0 && !a.startsWith('--') && !(args[i - 1]?.startsWith('--') && !BOOLEAN_FLAGS.has(args[i - 1])));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  if (BOOLEAN_FLAGS.has(`--${name}`)) return true;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

/** Edit distance, for "did you mean" on typos. */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

const out = (s = '') => process.stdout.write(s + '\n');
const fail = (msg) => {
  process.stderr.write(`bg-engine: ${msg}\n`);
  process.exit(1);
};

function loadRegistry() {
  if (!existsSync(registryPath)) fail(`registry not found at ${registryPath}. In the repo, run \`pnpm registry\` first.`);
  return JSON.parse(readFileSync(registryPath, 'utf8'));
}

/** The engine's logic (validation, token parsing) lives in the built bundle. */
async function loadEngine() {
  const dist = resolve(pkgRoot, 'dist/index.js');
  if (!existsSync(dist)) fail('the built engine was not found (dist/index.js). In the repo, run `pnpm build:lib` first.');
  return import(pathToFileURL(dist).href);
}

function findEntry(registry, id) {
  const entry = registry.entries.find((e) => e.id === id && e.kind !== 'layer') ?? registry.entries.find((e) => e.id === id);
  if (!entry) {
    const near = registry.entries
      .map((e) => ({ id: e.id, d: Math.min(distance(id, e.id), e.id.startsWith(id) || e.id.includes(id) ? 1 : Infinity) }))
      .filter((x) => x.d <= Math.max(2, Math.floor(id.length / 3)))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((x) => x.id);
    fail(`no skin, preset, or layer called "${id}".${near.length ? ` Did you mean: ${near.join(', ')}?` : ' Run `list` to see everything.'}`);
  }
  return entry;
}

function cmdList() {
  const registry = loadRegistry();
  const kind = flag('kind');
  const tag = flag('tag');
  const rows = registry.entries.filter((e) => (!kind || e.kind === kind) && (!tag || e.tags.includes(tag)));
  if (flag('json')) return out(JSON.stringify(rows.map(({ kind, id, label, tags, themes, cost, source }) => ({ kind, id, label, tags, themes, cost, source })), null, 2));
  const w = Math.max(...rows.map((e) => e.id.length), 4);
  for (const k of ['preset', 'skin', 'layer']) {
    const group = rows.filter((e) => e.kind === k);
    if (!group.length) continue;
    out(`\n${k}s`);
    for (const e of group) {
      const meta = [e.themes.join('+'), `cost ${e.cost}`, e.source === 'community' ? 'community' : ''].filter(Boolean).join(' · ');
      out(`  ${e.id.padEnd(w)}  ${meta.padEnd(34)} ${e.description ?? ''}`.slice(0, 170));
    }
  }
  out(`\n${rows.length} entries from ${registry.engine}. \`info <id>\` for options, \`add <id>\` to copy one in.`);
}

function cmdInfo() {
  const registry = loadRegistry();
  const id = positional[0] ?? fail('usage: info <id>');
  const e = findEntry(registry, id);
  out(`${e.label} (${e.kind}, ${e.id})`);
  if (e.description) out(e.description);
  out(`themes: ${e.themes.join(', ')}   cost: ${e.cost}   tags: ${e.tags.join(', ') || '-'}`);
  if (e.author) out(`author: ${e.author.name}${e.author.url ? ` <${e.author.url}>` : ''}`);
  if (e.defaults) out(`defaults: ${JSON.stringify(e.defaults)}`);
  if (e.scene) out(`layers: ${e.scene.layers.map((l) => l.use).join(' → ')}`);
  const fields = Object.entries(e.schema ?? {});
  if (fields.length) {
    out('\noptions');
    for (const [k, f] of fields) {
      const range = f.type === 'number' ? `${f.min}..${f.max}` : f.type === 'enum' ? f.values.join('|') : f.type;
      out(`  ${k.padEnd(16)} ${String(f.default).padEnd(10)} ${range.padEnd(28)} ${f.description ?? f.label ?? ''}`);
    }
  }
}

async function cmdAdd() {
  const registry = loadRegistry();
  const id = positional[0] ?? fail('usage: add <id> [--dir src/backgrounds]');
  const e = findEntry(registry, id);
  if (e.kind === 'layer') fail(`"${id}" is a layer. Add a preset that uses it, or compose one in the studio.`);

  const dir = resolve(process.cwd(), typeof flag('dir') === 'string' ? flag('dir') : 'src/backgrounds');
  const ext = flag('js') ? 'js' : 'ts';
  const file = resolve(dir, `${id}.${ext}`);
  if (existsSync(file) && !flag('force')) fail(`${relative(process.cwd(), file)} exists. Pass --force to overwrite.`);

  const config = { ...(e.defaults ?? {}) };
  if (typeof flag('palette') === 'string') {
    const p = flag('palette');
    config.palette = /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(p) ? { from: p.startsWith('#') ? p : `#${p}`, theme: flag('theme') === 'light' ? 'light' : 'dark' } : p;
  }
  if (typeof flag('tokens') === 'string') {
    const engine = await loadEngine();
    const tokens = JSON.parse(readFileSync(resolve(process.cwd(), flag('tokens')), 'utf8'));
    config.palette = engine.paletteFromTokens(tokens);
  }
  if (typeof flag('intensity') === 'string') config.intensity = Math.max(0, Math.min(1, Number(flag('intensity'))));

  const ts = ext === 'ts';
  const json = (v) => JSON.stringify(v, null, 2);
  let body;
  if (e.kind === 'preset') {
    const manifest = { manifestVersion: registry.manifestVersion, id: e.id, label: e.label, description: e.description, config, scene: e.scene };
    body = `/**
 * ${e.label}, copied from ${registry.engine} with \`bg-engine add ${e.id}\`.
 * Edit the scene freely: reorder layers, change options, add or remove layers.
 * Option ranges: \`npx space-background-engine info <layer-id>\`.
 */
import { mount, registerPresetManifest${ts ? ', type MountOptions, type PresetManifest' : ''} } from 'space-background-engine';

export const manifest${ts ? ': PresetManifest' : ''} = ${json(manifest)};

const preset = registerPresetManifest(manifest);

/** Mount behind \`target\` (default: the whole page). Overrides win over the manifest's config. */
export function mountBackground(target${ts ? ': string | HTMLElement' : ''} = document.body, overrides${ts ? ': MountOptions = {}' : ' = {}'}) {
  return mount(target, { skin: preset, ...overrides });
}
`;
  } else {
    const options = Object.fromEntries(Object.entries(e.schema ?? {}).map(([k, f]) => [k, f.default]));
    body = `/**
 * ${e.label}, set up from ${registry.engine} with \`bg-engine add ${e.id}\`.
 * Every option below is at its default; change any of them.
 */
import { mount${ts ? ', type MountOptions' : ''} } from 'space-background-engine';

export const config = ${json({ skin: e.id, ...config, options })}${ts ? ' satisfies MountOptions' : ''};

export function mountBackground(target${ts ? ': string | HTMLElement' : ''} = document.body, overrides${ts ? ': MountOptions = {}' : ' = {}'}) {
  return mount(target, { ...config, ...overrides });
}
`;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, body);
  out(`Added ${relative(process.cwd(), file)}`);
  out(`\n  import { mountBackground } from './${relative(process.cwd(), file).replace(/\\/g, '/').replace(/\.(ts|js)$/, '')}';\n  mountBackground();\n`);
  if (!existsSync(resolve(process.cwd(), 'node_modules/space-background-engine'))) out('Then: npm install space-background-engine');
}

async function cmdValidate() {
  const path = positional[0] ?? fail('usage: validate <manifest.json>');
  const engine = await loadEngine();
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
  const result = engine.validatePresetManifest(manifest);
  for (const w of result.warnings) out(`! ${w}`);
  for (const err of result.errors) out(`✗ ${err}`);
  if (!result.ok) process.exit(1);
  out(`✓ ${manifest.id} is a valid preset manifest`);
}

const commands = { list: cmdList, info: cmdInfo, add: cmdAdd, validate: cmdValidate };
if (!cmd || !commands[cmd] || flag('help')) {
  out('bg-engine <command>\n\n  list [--kind preset|skin|layer] [--tag t] [--json]\n  info <id>\n  add <id> [--dir src/backgrounds] [--js] [--palette #hex|id] [--theme light] [--intensity n] [--tokens file.json] [--force]\n  validate <manifest.json>');
  process.exit(cmd && !flag('help') ? 1 : 0);
}
await commands[cmd]();
