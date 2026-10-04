#!/usr/bin/env node
/**
 * Bundle-size budget check. Run after `pnpm build:lib`.
 *
 * Measures gzip size of each entry's full import closure (the entry file plus every
 * chunk it statically imports), so `space-background-engine/core` is guaranteed not to
 * drag a skin along, and the batteries-included entry stays honest about its cost.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = resolve('dist');

/** gzip KB budgets per entry closure. Raise deliberately, with a note in the commit. */
const BUDGETS_KB = {
  // host + scene compositor + schema: must never pull a skin, a layer, or the GLSL prelude.
  // 13 covers the compositor's WebGL surface handling and snapshotScene (M5/M6).
  // 16 since M9 put the scene light, quiet zones, auto-shade, and transitions in the host;
  // 16.5 with fastForward, time scale, inspect, page scroll, and interactive gestures (v3 phase 1).
  'core.js': 16.5,
  // shader authoring (GLSL prelude + program setup), opt-in
  'shader.js': 15,
  // manifest validation/loading and the design-token bridge, opt-in (M8)
  'manifest.js': 16,
  'tokens.js': 14,
  // generated sound bound to skin events, opt-in (v3 phase 5)
  'audio.js': 6,
  'skins/drifting-dust.js': 11,
  'skins/matrix-rain.js': 11,
  // the sector map skin plus its five part layers and the void-sector preset; 52 since the
  // overhaul added universe packs, fleets, and anomaly art; 58 with the mechanics system
  // (nine built-in mechanics, effects, combat) and a fourth pack, less the GitHub galaxy
  'skins/void-tactical.js': 58,
  // standard layer library (now including two shader layers) and the presets built from it
  'layers.js': 20,
  'presets.js': 22,
  // batteries included: core + all skins + layers + presets + shader/manifest/token tooling.
  // 62 since M8 added the manifest and token entries to the batteries bundle; 67 since
  // M9 (host lighting and legibility, the moments layer, light-aware base layers); 101
  // since the void-tactical overhaul and the five instrument skins; 116 with mechanics and
  // the instruments' events (holds, torpedoes, aftershocks, predation, surface ops); 118 with
  // the v3 camera (view, bus, director). Lazy universe packs (v3 phase 2) should win this back.
  'index.js': 118,
  // framework adapters: core + all built-in skins, layers, and presets (no tooling); 59 since M9,
  // 89 with the overhauled sector map and the instruments, 107 with mechanics and events,
  // 109 with the v3 camera
  'element.js': 109,
  'react.js': 109,
  'vue.js': 109,
  'svelte.js': 109,
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

// Minified output puts every statement on one line, so match anywhere, not at line starts.
// Covers `import{a}from"./x"`, `import"./x"`, and `export{a}from"./x"`.
const importRe = /(?:import|export)\s*(?:[^'";]*?\s*from\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;

function closure(entryPath) {
  const seen = new Set();
  const queue = [entryPath];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(importRe)) {
      const spec = m[1];
      if (!spec) continue;
      queue.push(resolve(dirname(file), spec));
    }
  }
  return [...seen];
}

const gzipKb = (files) => {
  const bytes = files.reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0);
  return bytes / 1024;
};

const allJs = walk(DIST);
let failed = false;
const rows = [];
for (const [entry, budget] of Object.entries(BUDGETS_KB)) {
  const path = join(DIST, entry);
  if (!allJs.includes(path)) {
    rows.push([entry, 'missing', budget, 'FAIL']);
    failed = true;
    continue;
  }
  const files = closure(path);
  const kb = gzipKb(files);
  const ok = kb <= budget;
  if (!ok) failed = true;
  rows.push([entry, kb.toFixed(2), budget.toFixed(0), ok ? 'ok' : 'FAIL', files.map((f) => relative(DIST, f)).join(', ')]);
}

// Plugins register themselves as a side effect of being imported. If a module is not
// listed in package.json `sideEffects`, the bundler drops it silently, so check the
// built output really contains every built-in mechanic.
const MECHANICS = ['skirmish', 'events', 'economy', 'police', 'gates', 'relays', 'asteroids', 'storms', 'wardens', 'song', 'flocks', 'maw', 'cartography', 'warfront', 'front', 'artillery', 'duels', 'truces', 'mines', 'bloom', 'spores', 'purge', 'ark', 'flotilla', 'pursuit', 'skimming', 'nebula', 'stars', 'life', 'epochs','leviathans', 'echoes', 'cradles', 'restless', 'dread'];
const dist = allJs.map((f) => readFileSync(f, 'utf8')).join('\n');
const missing = MECHANICS.filter((id) => !new RegExp(`id:\\s*"${id}"`).test(dist));
if (missing.length) {
  console.error(`Built output is missing mechanics: ${missing.join(', ')}. Check package.json "sideEffects".`);
  failed = true;
}

const total = gzipKb(allJs);
console.log('entry closure (gzip KB)      actual   budget  status');
for (const [entry, kb, budget, status, files] of rows) {
  console.log(`${entry.padEnd(28)} ${String(kb).padStart(7)} ${String(budget).padStart(8)}  ${status}`);
  if (files && process.env.SIZE_VERBOSE) console.log(`    ${files}`);
}
console.log(`\nall dist js (gzip): ${total.toFixed(2)} KB`);

if (failed) {
  console.error('\nSize budget exceeded. Raise the budget in scripts/size-check.mjs only on purpose.');
  process.exit(1);
}
