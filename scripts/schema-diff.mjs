#!/usr/bin/env node
/**
 * Classify registry changes between a git ref and the working tree, and say what
 * version bump they require.
 *
 *   pnpm schema-diff                 # against the last tag, or HEAD~1
 *   pnpm schema-diff --base v0.2.0   # against a ref
 *   pnpm schema-diff --check         # also fail when package.json's bump is too small (CI on release)
 *
 * Policy (docs: CONTRIBUTING.md, "Releases"):
 *   breaking  removing a skin/preset/layer or an option; changing an option's type;
 *             removing enum values; narrowing a numeric range
 *   feature   adding a skin/preset/layer or an option; adding enum values; widening a
 *             range; changing a default or a preset's scene (refresh screenshot baselines)
 *   patch     anything else (descriptions, tags, labels)
 * While the major version is 0, a breaking change requires a minor bump.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const baseArg = args[args.indexOf('--base') + 1];
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

let base = args.includes('--base') ? baseArg : '';
if (!base) {
  try {
    base = sh('git describe --tags --abbrev=0');
  } catch {
    base = 'HEAD~1';
  }
}

const read = (ref, path) => {
  try {
    return JSON.parse(sh(`git show ${ref}:${path}`));
  } catch {
    return null;
  }
};

const before = read(base, 'registry/index.json');
const after = JSON.parse(readFileSync('registry/index.json', 'utf8'));
if (!before) {
  console.log(`No registry at ${base}; nothing to compare. Every entry is new (feature).`);
  process.exit(0);
}

const LEVEL = { patch: 0, feature: 1, breaking: 2 };
const changes = [];
const note = (level, what) => changes.push({ level, what });

const key = (e) => `${e.kind}:${e.id}`;
const prev = new Map(before.entries.map((e) => [key(e), e]));
const next = new Map(after.entries.map((e) => [key(e), e]));

for (const [k, e] of prev) if (!next.has(k)) note('breaking', `removed ${e.kind} "${e.id}"`);
for (const [k, e] of next) if (!prev.has(k)) note('feature', `added ${e.kind} "${e.id}"`);

for (const [k, a] of next) {
  const b = prev.get(k);
  if (!b) continue;
  const at = `${a.kind} "${a.id}"`;
  const fb = b.schema ?? {};
  const fa = a.schema ?? {};
  for (const name of Object.keys(fb)) if (!(name in fa)) note('breaking', `${at}: removed option "${name}"`);
  for (const [name, f] of Object.entries(fa)) {
    const old = fb[name];
    if (!old) {
      note('feature', `${at}: added option "${name}"`);
      continue;
    }
    if (old.type !== f.type) {
      note('breaking', `${at}.${name}: type ${old.type} → ${f.type}`);
      continue;
    }
    if (f.type === 'enum') {
      const lost = old.values.filter((v) => !f.values.includes(v));
      const gained = f.values.filter((v) => !old.values.includes(v));
      if (lost.length) note('breaking', `${at}.${name}: removed values ${lost.join(', ')}`);
      if (gained.length) note('feature', `${at}.${name}: added values ${gained.join(', ')}`);
    }
    if (f.type === 'number') {
      if (f.min > old.min || f.max < old.max) note('breaking', `${at}.${name}: range ${old.min}..${old.max} narrowed to ${f.min}..${f.max}`);
      else if (f.min < old.min || f.max > old.max) note('feature', `${at}.${name}: range widened to ${f.min}..${f.max}`);
    }
    if (JSON.stringify(old.default) !== JSON.stringify(f.default)) {
      note('feature', `${at}.${name}: default ${JSON.stringify(old.default)} → ${JSON.stringify(f.default)} (refresh baselines)`);
    }
  }
  if (JSON.stringify(b.defaults ?? null) !== JSON.stringify(a.defaults ?? null)) note('feature', `${at}: config defaults changed (refresh baselines)`);
  if (JSON.stringify(b.scene ?? null) !== JSON.stringify(a.scene ?? null)) note('feature', `${at}: scene changed (refresh baselines)`);
  if (b.label !== a.label || b.description !== a.description || JSON.stringify(b.tags) !== JSON.stringify(a.tags)) note('patch', `${at}: metadata`);
}

const required = changes.reduce((m, c) => Math.max(m, LEVEL[c.level]), 0);
const levelName = Object.keys(LEVEL).find((k) => LEVEL[k] === required);

console.log(`Registry changes since ${base}: ${changes.length || 'none'}`);
for (const lvl of ['breaking', 'feature', 'patch']) {
  for (const c of changes.filter((x) => x.level === lvl)) console.log(`  ${lvl.padEnd(8)} ${c.what}`);
}

const parse = (v) => v.split('.').map(Number);
const pkgNow = JSON.parse(readFileSync('package.json', 'utf8')).version;
const pkgThen = read(base, 'package.json')?.version ?? pkgNow;
const [M, m, p] = parse(pkgNow);
const [M0, m0, p0] = parse(pkgThen);
const bumped = M > M0 ? 'major' : m > m0 ? 'minor' : p > p0 ? 'patch' : 'none';
// 0.x: breaking needs minor; 1.x+: breaking needs major, feature needs minor.
const need = required === 2 ? (M0 === 0 ? 'minor' : 'major') : required === 1 ? (M0 === 0 ? 'patch' : 'minor') : changes.length ? 'patch' : 'none';
const order = ['none', 'patch', 'minor', 'major'];
console.log(`\nRequired: ${levelName} → at least a ${need} bump. package.json: ${pkgThen} → ${pkgNow} (${bumped}).`);

if (check && order.indexOf(bumped) < order.indexOf(need)) {
  console.error(`✗ Version bump too small. Bump to a ${need} release or revert the ${levelName} change.`);
  process.exit(1);
}
