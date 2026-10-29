#!/usr/bin/env node
/**
 * Clips: a short animated GIF of every world, for the README, rendered from the live engine.
 *
 *   pnpm clips                       every world
 *   pnpm clips war-rig blockade      only clips whose id contains one of the words
 *   pnpm clips --list                print the clip ids and stop
 *
 * Each clip opens the lab page in view mode (scripts/media.mjs does the same) at a fixed seed,
 * fast-forwards to a lively moment (a time, or a log line via `seek`), then steps the sim one
 * real 60 Hz frame at a time on the page's manual scheduler and screenshots every fifth frame:
 * deterministic, so the same commit gives the same GIF. Frames go straight to ffmpeg on stdin
 * (no temp files), which builds a palette and writes docs/media/clips/<id>.gif. A GIF over
 * the size budget is re-encoded with fewer colours, then a lower frame rate, then shorter.
 *
 * Needs ffmpeg on PATH (or FFMPEG=path). Uses a dev server on LAB_URL / :5180 / :5173, or
 * starts one in process.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * @typedef {{ id: string, skin?: string, u?: string, seed?: string, options?: Record<string, unknown>,
 *   t?: number, seek?: string, max?: number, after?: number, secs?: number, w?: number, h?: number }} Clip
 * `t`: start time in seconds. `seek` + `after`: start `after` seconds from the first log line
 * matching `seek` (searched up to `max` seconds; a negative `after` reloads and starts before it).
 * `w`, `h`: the stage size (default 960 x 600); the sim lays out to it, so seek times change with it.
 */

/** @type {Clip[]} */
const CLIPS = [
  // The sector map's universes (void-tactical with u=).
  { id: 'void', u: 'void', t: 30 },
  { id: 'saltwind', u: 'saltwind', t: 40 },
  { id: 'choir', u: 'choir', t: 45 },
  { id: 'siege', u: 'siege', t: 55 },
  { id: 'hive', u: 'hive', t: 17 },
  { id: 'lastfleet', u: 'lastfleet', t: 18 },
  { id: 'cradle', u: 'cradle', seek: 'SUPERNOVA', max: 400, after: -3, w: 1280, h: 800 }, // at 960 x 600 the star that goes is off screen
  // Skins.
  { id: 'undercity', skin: 'undercity', seed: 'neon-3', seek: 'GRID FAILURE', max: 300, after: -1.5 },
  { id: 'shieldwall', skin: 'shieldwall', seed: 'a1', t: 36 },
  { id: 'ages', skin: 'ages', t: 245 },
  { id: 'war-table', skin: 'war-table', t: 38 },
  { id: 'wyrmspire', skin: 'wyrmspire', seed: 'orion-7', seek: 'FALLS ON', max: 1800, after: 5 },
  { id: 'deephold', skin: 'deephold', seed: 'moss-9', seek: 'BURNS THE GATEHALL', max: 1500, after: -10 },
  { id: 'leylines', skin: 'leylines', seed: 'fen-2', seek: 'DUELS', max: 600, after: 1 },
  { id: 'silent-running', skin: 'silent-running', seek: 'FIRES ON THE', max: 600, after: -1 },
  { id: 'foundry', skin: 'foundry', seed: 'foundry-6', seek: 'BITERS COME OUT', max: 1500, after: 5 },
  { id: 'brasswind', skin: 'brasswind', t: 40 },
  { id: 'ironhaze', skin: 'ironhaze', t: 40 },
  { id: 'sandsea', skin: 'sandsea', seek: 'WORMSIGN', max: 600, after: 6 },
  { id: 'windtrap', skin: 'windtrap', t: 40 },
  { id: 'saber-front', skin: 'saber-front', t: 40 },
  { id: 'walking-castle', skin: 'walking-castle', t: 68 },
  { id: 'war-rig', skin: 'war-rig', t: 40 },
  { id: 'traction', skin: 'traction', t: 40 },
  { id: 'last-loop', skin: 'last-loop', t: 40 },
  { id: 'blockade', skin: 'blockade', t: 40 },
  { id: 'titan-dock', skin: 'titan-dock', t: 40 },
];

const W = 960; // captured at 2x the GIF's width, then downscaled (crisper text and lines)
const H = 600;
const GIF_W = 480;
const FPS = 12;
const SECS = 5.5;
const BUDGET = 2.5 * 1024 * 1024;
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

const args = process.argv.slice(2);
if (args.includes('--list')) {
  console.log(CLIPS.map((c) => c.id).join('\n'));
  process.exit(0);
}
const only = args.filter((a) => !a.startsWith('--'));
const todo = only.length ? CLIPS.filter((c) => only.some((w) => c.id.includes(w))) : CLIPS;
const OUT = resolve('docs/media/clips');

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
  server = await createServer({ logLevel: 'error', server: { port: 5182, strictPort: false } });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const browser = await chromium.launch();
let code = 0;

/** Open the clip's page at its start time; returns the page. */
async function open(clip, start) {
  const w = clip.w ?? W;
  const h = clip.h ?? H;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  /** @type {any} */ (page).errors = errors;
  const q = new URLSearchParams({ view: '1', skin: clip.skin ?? 'void-tactical', seed: clip.seed ?? 'orion-7', w: String(w), h: String(h) });
  if (clip.u) q.set('u', clip.u);
  if (clip.options) q.set('options', JSON.stringify(clip.options));
  await page.goto(`${base}/lab.html?${q}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 300_000, state: 'attached' });
  const err = await page.evaluate(() => document.body.dataset.error);
  if (err) throw new Error(err);
  if (start === undefined && clip.seek) {
    const found = await page.evaluate(([s, max]) => window.__lab.seek(s, max), [clip.seek, clip.max ?? 300]);
    if (!found) {
      console.warn(`  ! ${clip.id}: no match for /${clip.seek}/, starting where the search stopped`);
      code = 1;
    }
    const at = await page.evaluate(() => window.__lab.t());
    const after = clip.after ?? 0;
    // The page only goes forward: to start before the event, reload and go there directly.
    if (after < 0) {
      await page.close();
      return open(clip, Math.max(0, at + after));
    }
    start = at + after;
  }
  await page.evaluate((t) => window.__lab.goto(t), start ?? clip.t ?? 30);
  return page;
}

/** Screenshots at FPS for `secs`, each after stepping 60/FPS real frames. */
async function frames(page, secs) {
  const per = Math.round(60 / FPS);
  const out = [];
  const n = Math.round(secs * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => {
      for (let j = 0; j < k; j++) window.__lab.goto(window.__lab.t() + 1 / 60);
    }, per);
    out.push(await page.screenshot({ type: 'png' }));
  }
  return out;
}

/** Encode PNG frames (at FPS) to a GIF with a per-clip palette; returns the byte size. */
function encode(pngs, file, { fps, colors, secs }) {
  const vf =
    `fps=${fps},scale=${GIF_W}:-1:flags=lanczos,split[a][b];` +
    `[a]palettegen=max_colors=${colors}:stats_mode=diff[p];` +
    '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle';
  return new Promise((ok, fail) => {
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-t', String(secs), '-filter_complex', vf, '-loop', '0', file], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    ff.on('error', fail);
    ff.stdin.on('error', () => {}); // ffmpeg failing early: reported by 'close'
    ff.on('close', (c) => (c === 0 ? ok(statSync(file).size) : fail(new Error(`ffmpeg exited ${c}`))));
    for (const p of pngs) ff.stdin.write(p);
    ff.stdin.end();
  });
}

mkdirSync(OUT, { recursive: true });
try {
  for (const clip of todo) {
    const began = Date.now();
    try {
      const page = await open(clip);
      const at = await page.evaluate(() => window.__lab.t());
      const pngs = await frames(page, clip.secs ?? SECS);
      const errors = /** @type {any} */ (page).errors;
      if (errors.length) {
        console.warn(`  ! ${clip.id}: page errors: ${errors.slice(0, 3).join(' | ')}`);
        code = 1;
      }
      await page.close();
      // CLIPS_FRAMES=dir keeps the PNG frames, for trying encoder settings by hand.
      if (process.env.CLIPS_FRAMES) {
        const dir = resolve(process.env.CLIPS_FRAMES, clip.id);
        mkdirSync(dir, { recursive: true });
        pngs.forEach((p, i) => writeFileSync(resolve(dir, `${String(i).padStart(4, '0')}.png`), p));
      }
      const file = resolve(OUT, `${clip.id}.gif`);
      // Shrink until it fits: fewer colours, then a lower frame rate, then shorter. Worlds
      // whose whole frame moves (scrolling ground, film grain) end up on the later rungs.
      const secs = clip.secs ?? SECS;
      const tries = [
        { fps: FPS, colors: 256, secs },
        { fps: FPS, colors: 128, secs },
        { fps: 10, colors: 128, secs },
        { fps: 10, colors: 128, secs: Math.min(secs, 4.5) },
        { fps: 8, colors: 128, secs: Math.min(secs, 4.5) },
        { fps: 8, colors: 96, secs: Math.min(secs, 4) },
        { fps: 8, colors: 64, secs: Math.min(secs, 3.5) },
      ];
      let size = 0;
      let used;
      for (const tr of tries) {
        size = await encode(pngs, file, tr);
        used = tr;
        if (size <= BUDGET) break;
      }
      if (size > BUDGET) console.warn(`  ! ${clip.id}: still over budget`);
      console.log(
        `${clip.id}.gif  ${(size / 1024).toFixed(0)} KB  t=${at.toFixed(1)}s  ${used.fps} fps ${used.colors} colours ${used.secs} s${((Date.now() - began) / 1000).toFixed(1)} s`,
      );
    } catch (e) {
      console.warn(`  ! ${clip.id}: ${e.message}`);
      code = 1;
    }
  }
} finally {
  await browser.close();
  await server?.close();
}
process.exit(code);
