#!/usr/bin/env node
/**
 * Copy the e2e screenshot baselines into public/gallery so the studio's gallery and
 * the showcase site show the exact pixels the tests protect. Run after
 * `pnpm test:e2e:update`; the Pages workflow runs it before building the site.
 */
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('e2e/__screenshots__/chromium');
const out = resolve('public/gallery');
mkdirSync(out, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.png'));
for (const f of files) copyFileSync(resolve(src, f), resolve(out, f));
writeFileSync(resolve(out, 'index.json'), JSON.stringify(files.map((f) => f.replace(/\.png$/, '')), null, 2) + '\n');
console.log(`gallery: ${files.length} images -> public/gallery`);
