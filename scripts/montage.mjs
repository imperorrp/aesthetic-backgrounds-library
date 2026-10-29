#!/usr/bin/env node
/**
 * Montage: a short 1080p MP4 of several worlds, cut together, for sharing (a post, a talk).
 *
 *   node scripts/montage.mjs                 the default reel
 *   node scripts/montage.mjs out=reel.mp4    somewhere else (default: docs/private/vivarium-montage.mp4, git-ignored)
 *
 * Same method as scripts/clips.mjs: the lab page in view mode at a fixed seed, fast-forwarded to
 * a lively moment, then stepped one real 60 Hz frame at a time and screenshotted every other
 * frame (30 fps). Every shot's frames go to one ffmpeg process as a single H.264 stream.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** @typedef {{ skin?: string, u?: string, seed?: string, options?: Record<string, unknown>, t?: number, seek?: string, max?: number, after?: number, secs?: number }} Shot */

/** @type {Shot[]} */
const SHOTS = [
  { skin: 'traction', t: 40 },
  { skin: 'war-rig', t: 40 },
  { skin: 'titan-dock', seek: 'SURFACES', max: 900, after: 8 },
  { skin: 'walking-castle', t: 68 },
  { skin: 'blockade', t: 40 },
  { u: 'siege', t: 55 },
  { skin: 'last-loop', seek: 'SUPERNOVA', max: 1500, after: -0.5, secs: 4.5 },
];

const W = 1920;
const H = 1080;
const FPS = 30;
const SECS = 3.5;
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const outArg = process.argv.slice(2).find((a) => a.startsWith('out='));
const OUT = resolve(outArg ? outArg.slice(4) : 'docs/private/vivarium-montage.mp4');

const reachable = async (url) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(800) })).ok;
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
  server = await createServer({ logLevel: 'error', server: { port: 5182, strictPort: false } });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const browser = await chromium.launch();

/** Open the shot's page at its start time. */
async function open(shot, start) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const q = new URLSearchParams({ view: '1', skin: shot.skin ?? 'void-tactical', seed: shot.seed ?? 'orion-7', w: String(W), h: String(H) });
  if (shot.u) q.set('u', shot.u);
  if (shot.options) q.set('options', JSON.stringify(shot.options));
  await page.goto(`${base}/lab.html?${q}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 300_000, state: 'attached' });
  const err = await page.evaluate(() => document.body.dataset.error);
  if (err) throw new Error(err);
  if (start === undefined && shot.seek) {
    const found = await page.evaluate(([s, max]) => window.__lab.seek(s, max), [shot.seek, shot.max ?? 300]);
    if (!found) console.warn(`  ! ${shot.skin ?? shot.u}: no match for /${shot.seek}/, starting where the search stopped`);
    const at = await page.evaluate(() => window.__lab.t());
    const after = shot.after ?? 0;
    if (after < 0) {
      await page.close();
      return open(shot, Math.max(0, at + after));
    }
    start = at + after;
  }
  await page.evaluate((t) => window.__lab.goto(t), start ?? shot.t ?? 30);
  return page;
}

mkdirSync(dirname(OUT), { recursive: true });
const ff = spawn(
  FFMPEG,
  ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
const done = new Promise((ok, fail) => {
  ff.on('error', fail);
  ff.on('close', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}`))));
});
const write = (buf) => new Promise((ok) => (ff.stdin.write(buf) ? ok() : ff.stdin.once('drain', ok)));

try {
  for (const shot of SHOTS) {
    const began = Date.now();
    const page = await open(shot);
    const at = await page.evaluate(() => window.__lab.t());
    const n = Math.round((shot.secs ?? SECS) * FPS);
    const per = Math.round(60 / FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate((k) => {
        for (let j = 0; j < k; j++) window.__lab.goto(window.__lab.t() + 1 / 60);
      }, per);
      await write(await page.screenshot({ type: 'png' }));
    }
    await page.close();
    console.log(`${shot.skin ?? shot.u}  t=${at.toFixed(1)}s  ${n} frames  ${((Date.now() - began) / 1000).toFixed(0)} s`);
  }
} finally {
  ff.stdin.end();
  await done.catch((e) => console.warn(`  ! ${e.message}`));
  await browser.close();
  await server?.close();
}
console.log(`${OUT}  ${(statSync(OUT).size / 1024 / 1024).toFixed(1)} MB`);
