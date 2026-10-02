#!/usr/bin/env node
/**
 * Stage a blind side-by-side: each current e2e baseline next to the oldest committed
 * render of the same subject, for `public/compare.html` (open /compare.html under
 * `pnpm dev`). The M9 acceptance line asks for this against the 0.2.0 baselines;
 * presets that did not exist yet fall back to the next release.
 *
 *   node scripts/prepare-compare.mjs              # 0.2.0, then 0.3.0 for newer presets
 *   node scripts/prepare-compare.mjs --ref <sha>  # one specific commit for every subject
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = 'e2e/__screenshots__/chromium';
const RELEASES = [
  { ref: '4c8fb33', label: '0.2.0' },
  { ref: '66be69f', label: '0.3.0' },
];

const args = process.argv.slice(2);
const refAt = args.indexOf('--ref');
const sources = refAt >= 0 && args[refAt + 1] ? [{ ref: args[refAt + 1], label: args[refAt + 1].slice(0, 7) }] : RELEASES;

const git = (argv, encoding = 'utf8') => execFileSync('git', argv, { encoding, maxBuffer: 64 * 1024 * 1024 });
const filesAt = (ref) => {
  try {
    return new Set(git(['ls-tree', '--name-only', `${ref}:${DIR}`]).split('\n').filter((f) => f.endsWith('.png')));
  } catch {
    console.error(`compare: ${ref} is not a commit in this repository`);
    process.exit(1);
  }
};
const trees = sources.map((s) => ({ ...s, files: filesAt(s.ref) }));

const out = resolve('public/compare');
rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(out, 'old'), { recursive: true });
mkdirSync(resolve(out, 'new'), { recursive: true });

const pairs = [];
for (const file of readdirSync(resolve(DIR)).filter((f) => f.endsWith('.png')).sort()) {
  const from = trees.find((t) => t.files.has(file));
  if (!from) continue;
  const before = git(['show', `${from.ref}:${DIR}/${file}`], 'buffer');
  const current = resolve(DIR, file);
  writeFileSync(resolve(out, 'old', file), before);
  copyFileSync(current, resolve(out, 'new', file));
  pairs.push({ id: file.replace(/\.png$/, ''), from: from.label });
}

writeFileSync(resolve(out, 'index.json'), JSON.stringify(pairs, null, 2) + '\n');
const byRelease = sources.map((s) => `${pairs.filter((p) => p.from === s.label).length} vs ${s.label}`).join(', ');
console.log(`compare: ${pairs.length} pairs (${byRelease}) -> public/compare; open /compare.html under pnpm dev`);
