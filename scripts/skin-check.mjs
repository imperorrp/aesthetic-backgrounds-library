#!/usr/bin/env node
/**
 * The authoring loop's verdict for one skin or preset:
 *
 *   pnpm skin:check <id> [--update]
 *
 * 1. typecheck
 * 2. unit determinism (identical draw-call hashes, no Math.random / Date.now)
 * 3. browser gates: screenshot baseline, contrast behind a text column, pixel-identical replay
 *
 * --update rewrites the screenshot baseline for this id (after an intentional visual change).
 * Exit code is non-zero if any step fails. Screenshots land in e2e/__screenshots__/chromium/<id>.png.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const update = args.includes('--update');
if (!id) {
  console.error('Usage: pnpm skin:check <skin-or-preset-id> [--update]');
  process.exit(1);
}

const subjects = JSON.parse(readFileSync(resolve('e2e/subjects.json'), 'utf8'));
if (!subjects.includes(id)) {
  console.warn(`Note: "${id}" is not in e2e/subjects.json; browser gates will be skipped. Add it there to include it.`);
}

const run = (title, cmd, cmdArgs) => {
  console.log(`\n== ${title}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\n${title} failed.`);
    process.exit(r.status ?? 1);
  }
};

run('Typecheck', 'pnpm', ['exec', 'tsc', '-b']);
run(`Determinism (unit) for ${id}`, 'pnpm', ['exec', 'vitest', 'run', 'src/engine/skins/determinism.test.ts', '-t', id]);

if (subjects.includes(id)) {
  const pwArgs = ['exec', 'playwright', 'test', '-g', id, '--reporter=list'];
  if (update) pwArgs.push('--update-snapshots');
  run(`Browser gates for ${id}${update ? ' (writing baseline)' : ''}`, 'pnpm', pwArgs);
  const shot = resolve('e2e/__screenshots__/chromium', `${id}.png`);
  console.log(`\nReference render: ${existsSync(shot) ? shot : '(not written)'}`);
}

console.log(`\nAll checks passed for ${id}.`);
