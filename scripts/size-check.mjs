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
  // host + scene compositor + schema: must never pull a skin or a layer
  'core.js': 12,
  'skins/drifting-dust.js': 11,
  'skins/matrix-rain.js': 11,
  // the legacy monolith; shrinks as it is decomposed into layers
  'skins/void-tactical.js': 30,
  // standard layer library and the presets built from it (no skins)
  'layers.js': 20,
  'presets.js': 22,
  // batteries included: core + all skins + layers + presets (+ element / react adapters)
  'index.js': 50,
  'element.js': 51,
  'react.js': 51,
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
