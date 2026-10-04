#!/usr/bin/env node
/**
 * Small JPEG thumbnails of the e2e baselines for the studio's world cards and gallery:
 * public/thumbs/<id>.jpg (480×300) and an index. Committed, unlike public/gallery, so
 * the deployed studio has them without running the e2e suite. Run after
 * `pnpm test:e2e:update` (needs Playwright's Chromium).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const src = resolve('e2e/__screenshots__/chromium');
const out = resolve('public/thumbs');
const W = 480;
const H = 300;
mkdirSync(out, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.png'));

const browser = await chromium.launch();
const page = await browser.newPage();
let bytes = 0;
for (const f of files) {
  const dataUrl = `data:image/png;base64,${readFileSync(resolve(src, f)).toString('base64')}`;
  const jpeg = await page.evaluate(
    async ({ dataUrl, W, H }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      // Cover: crop to 16:10 from the center.
      const s = Math.max(W / img.width, H / img.height);
      const w = W / s;
      const h = H / s;
      ctx.drawImage(img, (img.width - w) / 2, (img.height - h) / 2, w, h, 0, 0, W, H);
      return c.toDataURL('image/jpeg', 0.82).split(',')[1];
    },
    { dataUrl, W, H },
  );
  const buf = Buffer.from(jpeg, 'base64');
  bytes += buf.length;
  writeFileSync(resolve(out, f.replace(/\.png$/, '.jpg')), buf);
}
await browser.close();
writeFileSync(resolve(out, 'index.json'), JSON.stringify(files.map((f) => f.replace(/\.png$/, '')), null, 2) + '\n');
console.log(`thumbs: ${files.length} images, ${(bytes / 1024).toFixed(0)} KB -> public/thumbs`);
