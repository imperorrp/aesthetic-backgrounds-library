#!/usr/bin/env node
/**
 * Media: render the README's images from the live engine, so they can be regenerated
 * after any visual change.
 *
 *   pnpm media                 every image
 *   pnpm media hero moments    only images whose file name contains one of the words
 *
 * Each image is a list of shots: a fixed seed at fixed moments (or moments after a log
 * line, via `seek`), taken from the lab page in view mode (the real page: canvas and DOM
 * layers), then composed into a grid or a strip with optional captions and written as a
 * JPEG to docs/media. Same commit, same images.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * @typedef {{ skin?: string, u?: string, seed?: string, w?: number, h?: number, dsf?: number,
 *   t?: number[], seek?: string, max?: number, after?: number[], crop?: [number, number, number, number],
 *   options?: Record<string, unknown>, palette?: string | Record<string, unknown>, captions?: string[] }} Shot
 * @typedef {{ file: string, cols: number, tile: [number, number], gap?: number, quality?: number, shots: Shot[] }} Image
 */

/** @type {Image[]} */
const IMAGES = [
  // The opening montage: four of the worlds, each at a good moment. Two columns, so each
  // tile is still worth looking at at the README's width.
  {
    file: 'hero.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'undercity', seed: 'neon-3', t: [24], captions: ['UNDERCITY'] },
      { u: 'siege', t: [57.7], captions: ['THE LONG SIEGE'] },
      { u: 'lastfleet', t: [20], captions: ['THE LAST FLEET'] },
      { u: 'choir', t: [45], captions: ['CHOIR OF HOLLOW STARS'] },
    ],
  },
  // One still per world, for the universe table.
  ...[
    ['void', 30],
    ['saltwind', 40],
    ['choir', 45],
    ['siege', 57.7],
    ['hive', 14],
    ['lastfleet', 20],
    ['cradle', 140],
  ].map(([u, t]) => ({ file: `worlds/${u}.jpg`, cols: 1, tile: [960, 600], shots: [{ u, t: [t] }] })),
  { file: 'worlds/undercity.jpg', cols: 1, tile: [1280, 800], shots: [{ skin: 'undercity', seed: 'neon-3', t: [24] }] },
  {
    file: 'worlds/shieldwall.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'shieldwall', seed: 'a1', t: [38], captions: ['SIDE-ON'] },
      { skin: 'shieldwall', seed: 'a1', options: { view: 'above' }, t: [45], captions: ['FROM ABOVE'] },
    ],
  },
  {
    file: 'worlds/ages.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'ages', t: [4], captions: ['YEAR 70'] },
      { skin: 'ages', t: [250], captions: ['YEAR 685'] },
    ],
  },
  {
    file: 'moments/ages-zoom.jpg',
    cols: 1,
    tile: [1280, 840],
    shots: [{ skin: 'ages', t: [250], crop: [300, 150, 640, 420], dsf: 2 }],
  },
  {
    file: 'worlds/war-table.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'war-table', t: [40], captions: ['THE CAMPAIGN'] },
      { skin: 'war-table', seek: 'The Peace of', after: [2.5], captions: ['THE PEACE'] },
    ],
  },
  {
    file: 'worlds/wyrmspire.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'wyrmspire', seed: 'v-alpine', options: { valley: 'alpine' }, t: [12], captions: ['THE ALPINE VALLEY'] },
      { skin: 'wyrmspire', seed: 'v-ashland', options: { valley: 'ashland' }, seek: 'BURNS', max: 600, after: [1.5], captions: ['A FIRE WYRM IN THE ASHLANDS'] },
      { skin: 'wyrmspire', seed: 'v-fjord', options: { valley: 'fjord' }, seek: 'BEGINS THE CLIMB', max: 1500, after: [40], captions: ['A HERO ON THE SPIRE PATH'] },
      { skin: 'wyrmspire', seed: 'v-fen', options: { valley: 'fen', time: 'night' }, t: [60], captions: ['THE FEN BY NIGHT'] },
    ],
  },
  {
    file: 'worlds/deephold.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'deephold', seed: 'b-lich', options: { below: 'lich' }, seek: 'RISES IN THE OLD HALLS', max: 1300, after: [12], captions: ['A LICH IN THE OLD HALLS'] },
      { skin: 'deephold', seed: 'b-engine', options: { below: 'engine' }, seek: 'TURNS OVER', max: 1300, after: [14], captions: ['AN ELDER ENGINE WAKES'] },
      { skin: 'deephold', seed: 'c2', t: [400], captions: ['A YOUNG HOLD UNDER THE CRYSTAL DEEP'] },
      { skin: 'deephold', seed: 'b-hive', options: { below: 'hive' }, seek: 'STIRS IN THE HIVE', max: 1300, after: [12], captions: ['THE HIVE QUEEN'] },
    ],
  },
  {
    file: 'worlds/leylines.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'leylines', seed: 'i5', t: [60], captions: ['FIVE ORDERS, FIVE WAYS OF GROWING'] },
      { skin: 'leylines', seed: 'i6', palette: { from: '#b45309', theme: 'light' }, t: [120], captions: ['IN INK, ON VELLUM'] },
      { skin: 'leylines', seed: 'i4', t: [40], captions: ['THE DROWNED FENS, AND A LEVIATHAN'] },
      { skin: 'leylines', seed: 'i9', t: [120], captions: ['THE WHITE WASTE'] },
    ],
  },
  {
    file: 'worlds/petri.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'petri', t: [200], captions: ['FLUORESCENCE'] },
      { skin: 'petri', options: { stain: 'phase' }, t: [200], captions: ['PHASE CONTRAST'] },
      { skin: 'petri', options: { medium: 'lenia' }, t: [4], captions: ['LENIA: ORBIUM GLIDING'] },
      { skin: 'petri', options: { medium: 'lenia' }, t: [30], captions: ['A COLLISION OVERGROWS'] },
    ],
  },
  {
    file: 'moments/shieldwall-siege.jpg',
    cols: 2,
    tile: [960, 600],
    shots: [
      { skin: 'shieldwall', options: { battles: 'siege' }, t: [50, 80], captions: ['THE ENGINES AT THE WALL', 'A TOWER DOCKS'] },
      { skin: 'shieldwall', seed: 'f2', t: [40, 64], captions: ['A BATTLE BY TORCHLIGHT', 'THE GRASS BURNS'] },
    ],
  },
  {
    file: 'moments/shieldwall-dragon.jpg',
    cols: 4,
    tile: [480, 300],
    shots: [{ skin: 'shieldwall', seed: 'd2', options: { dragons: 3, battles: 'field' }, seek: 'IS FALLING', after: [-3.2, -1.6, 0.4, 3.5], captions: ['dragonfire on the ranks', 'it climbs to turn', 'the bows find it', 'it falls'] }],
  },
  // Moments: short sequences of things happening.
  {
    file: 'moments/undercity-outage.jpg',
    cols: 4,
    tile: [480, 300],
    shots: [{ skin: 'undercity', seed: 'neon-3', seek: 'GRID FAILURE', after: [-1, 1, 3, 8], captions: ['a runner breaches the tower', 'the grid fails', 'block by block', 'the district goes dark'] }],
  },
  {
    file: 'moments/siege-duel.jpg',
    cols: 4,
    tile: [360, 360],
    shots: [{ u: 'siege', seek: 'MONITOR DUEL', after: [0.6, 1.4, 1.8, 2.6], crop: [430, 250, 460, 460], dsf: 2, captions: ['two monitors', 'broadside', 'the shields ripple', 'the answer'] }],
  },
  {
    file: 'moments/hive-purge.jpg',
    cols: 4,
    tile: [360, 285],
    shots: [{ u: 'hive', options: { camera: 'steady' }, t: [18.5, 20.2, 22, 26], crop: [560, 420, 480, 380], dsf: 2, captions: ['the purge arrives', 'torches lit', 'the creep burns', 'ash, for now'] }],
  },
  {
    file: 'moments/cradle-supernova.jpg',
    cols: 4,
    tile: [480, 300],
    shots: [{ u: 'cradle', seek: 'SUPERNOVA', max: 400, after: [-6, 0.2, 1.2, 6], captions: ['a massive star', 'it goes', 'the shell', 'gas, given back'] }],
  },
];

const only = process.argv.slice(2);
const todo = only.length ? IMAGES.filter((i) => only.some((w) => i.file.includes(w))) : IMAGES;
const OUT = resolve('docs/media');

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

/** All frames of one shot, as PNG data URLs, from one page session. */
async function capture(shot) {
  const w = shot.w ?? 1280;
  const h = shot.h ?? 800;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: shot.dsf ?? 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const q = new URLSearchParams({ view: '1', skin: shot.skin ?? 'void-tactical', seed: shot.seed ?? 'orion-7', w: String(w), h: String(h) });
  if (shot.u) q.set('u', shot.u);
  if (shot.options) q.set('options', JSON.stringify(shot.options));
  if (shot.palette) q.set('palette', typeof shot.palette === 'string' ? shot.palette : JSON.stringify(shot.palette));
  await page.goto(`${base}/lab.html?${q}`);
  // In view mode the body has no in-flow content, so wait for the flag, not visibility.
  await page.waitForSelector('body[data-ready="1"]', { timeout: 300_000, state: 'attached' });
  const err = await page.evaluate(() => document.body.dataset.error);
  if (err) throw new Error(err);
  let times = shot.t ?? [];
  if (shot.seek) {
    const found = await page.evaluate(([s, max]) => window.__lab.seek(s, max), [shot.seek, shot.max ?? 300]);
    if (!found) {
      console.warn(`  ! no match for /${shot.seek}/`);
      code = 1;
    }
    const at = await page.evaluate(() => window.__lab.t());
    // Frames before the event: the page can only go forward, so seek again from a fresh page.
    const after = shot.after ?? [0.5, 2, 5, 9];
    if (after.some((a) => a < 0)) {
      await page.close();
      return capture({ ...shot, seek: undefined, t: after.map((a) => at + a) });
    }
    times = after.map((a) => at + a);
  }
  const frames = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    await page.evaluate((tt) => window.__lab.goto(tt), t);
    const clip = shot.crop ? { x: shot.crop[0], y: shot.crop[1], width: shot.crop[2], height: shot.crop[3] } : { x: 0, y: 0, width: w, height: h };
    const png = await page.screenshot({ clip, type: 'png' });
    frames.push(`data:image/png;base64,${png.toString('base64')}`);
  }
  if (errors.length) {
    console.warn(`  ! page errors: ${errors.slice(0, 3).join(' | ')}`);
    code = 1;
  }
  await page.close();
  return frames;
}

/** Lay frames out in a grid with captions, in a page, and return JPEG bytes. */
async function compose(image, frames, captions) {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  const url = await page.evaluate(
    async ({ image, frames, captions }) => {
      const [tw, th] = image.tile;
      const gap = image.gap ?? (image.cols > 1 ? 6 : 0);
      const rows = Math.ceil(frames.length / image.cols);
      const c = document.getElementById('c');
      c.width = image.cols * tw + (image.cols - 1) * gap;
      c.height = rows * th + (rows - 1) * gap;
      const g = c.getContext('2d');
      g.fillStyle = '#05070b';
      g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = 'high';
      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        img.src = frames[i];
        await img.decode();
        const x = (i % image.cols) * (tw + gap);
        const y = Math.floor(i / image.cols) * (th + gap);
        // Cover the tile, centered.
        const k = Math.max(tw / img.width, th / img.height);
        const sw = tw / k;
        const sh = th / k;
        g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, tw, th);
        const cap = captions[i];
        if (cap) {
          const size = Math.max(11, Math.round(tw / 46));
          g.font = `${size}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
          g.textBaseline = 'middle';
          const pw = g.measureText(cap).width + size * 1.4;
          g.fillStyle = 'rgba(5,7,11,0.78)';
          g.fillRect(x + size * 0.6, y + th - size * 2.4, pw, size * 1.7);
          g.fillStyle = 'rgba(226,232,240,0.95)';
          g.fillText(cap, x + size * 1.3, y + th - size * 1.55);
        }
      }
      return c.toDataURL('image/jpeg', image.quality ?? 0.86);
    },
    { image, frames, captions },
  );
  await page.close();
  return Buffer.from(url.split(',')[1], 'base64');
}

try {
  for (const image of todo) {
    const began = Date.now();
    const frames = [];
    const captions = [];
    for (const shot of image.shots) {
      const f = await capture(shot);
      frames.push(...f);
      for (let i = 0; i < f.length; i++) captions.push(shot.captions?.[i] ?? '');
    }
    const bytes = await compose(image, frames, captions);
    const file = resolve(OUT, image.file);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    console.log(`${image.file}  ${(bytes.length / 1024).toFixed(0)} KB  ${((Date.now() - began) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
  await server?.close();
}
process.exit(code);
