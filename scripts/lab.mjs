#!/usr/bin/env node
/**
 * Lab: render a contact sheet of moments from one scene and save it as a PNG.
 *
 *   pnpm lab                                         void-tactical at t = 4, 15, 40
 *   pnpm lab u=choir t=5,20,40,80                    a universe at chosen times
 *   pnpm lab u=siege seek="FALLS TO" after=0.5,3,8   jump to the first matching log line
 *   pnpm lab sonar every=15 count=6                  any skin, evenly spaced
 *   pnpm lab crop=500,200,520,340 dsf=2 t=30         zoom on a region at retina density
 *   pnpm lab out=path/to/sheet.png name=check-1
 *
 * Uses a dev server already running on LAB_URL / :5180 / :5173, or starts one in
 * process. The page fast-forwards the sim between captures, so late times are cheap.
 * Prints the PNG path, the timing, and any problems the skin reported.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const UNIVERSES = new Set(['void', 'saltwind', 'choir', 'siege', 'hive', 'cradle', 'lastfleet']);
const params = new URLSearchParams();
let out;
let name;
let dsf = 1;
for (const a of process.argv.slice(2)) {
  const [k, v] = a.includes('=') ? a.split(/=(.*)/) : [a, undefined];
  if (v === undefined) {
    if (UNIVERSES.has(k)) params.set('u', k);
    else params.set('skin', k);
  } else if (k === 'out') out = v;
  else if (k === 'name') name = v;
  else if (k === 'dsf') dsf = Number(v);
  else params.set(k, v);
}
if (!params.has('skin')) params.set('skin', 'void-tactical');

const began = Date.now();
const reachable = async (url) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(800) });
    return r.ok;
  } catch {
    return false;
  }
};
let base = process.env.LAB_URL;
let server;
if (!base) {
  for (const port of [5180, 5173, 5199]) {
    if (await reachable(`http://localhost:${port}/lab.html`)) {
      base = `http://localhost:${port}`;
      break;
    }
  }
}
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ logLevel: 'error', server: { port: 5181, strictPort: false } });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const browser = await chromium.launch();
let code = 0;
try {
  const w = Number(params.get('w') ?? 1280);
  const h = Number(params.get('h') ?? 800);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/lab.html?${params}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 300_000 });
  const err = await page.evaluate(() => document.body.dataset.error);
  if (err) throw new Error(err);
  const { url, shots, problems } = await page.evaluate(() => ({ url: window.__lab.dataUrl(), shots: window.__lab.shots, problems: window.__lab.problems }));
  const label = name ?? [params.get('skin'), params.get('u'), params.get('seek') ? 'seek' : null].filter(Boolean).join('-');
  const file = resolve(out ?? `node_modules/.tmp/lab/${label}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(file);
  console.log(`${shots.length} shots: ${shots.map((s) => `${s.t.toFixed(1)}s${s.label ? ` (${s.label})` : ''}`).join(', ')} · ${((Date.now() - began) / 1000).toFixed(1)} s`);
  if (problems?.length) {
    console.log(`problems:\n  - ${problems.join('\n  - ')}`);
    code = 1;
  }
  if (errors.length) {
    console.log(`page errors:\n  - ${errors.slice(0, 10).join('\n  - ')}`);
    code = 1;
  }
} finally {
  await browser.close();
  await server?.close();
}
process.exit(code);
