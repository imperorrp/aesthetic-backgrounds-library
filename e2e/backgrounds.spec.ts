import { expect, test, type Page } from '@playwright/test';

/**
 * Every built-in skin and preset, rendered by the deterministic check harness
 * (manual clock, fixed seed, fixed frame count), must:
 *   1. match its stored screenshot (visual regression),
 *   2. keep the palette ink legible behind a text column (contrast gate),
 *   3. replay pixel-identically for the same seed (determinism, real pixels).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every registered skin and preset under test. `pnpm create-skin` appends new ids to e2e/subjects.json. */
const SUBJECTS: string[] = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'subjects.json'), 'utf8'));

type Probe = {
  meanLuminance: number;
  maxLuminance: number;
  meanContrast: number;
  worstContrast: number;
  failingShare: number;
  samples: number;
};

/**
 * Shader layers rasterize on the CPU wherever there is no GPU (CI, and Playwright's
 * Chromium locally), so these settle in fewer frames. Determinism is asserted per
 * subject at whatever count it uses, so this only trades run time, not strictness.
 */
const GPU_SUBJECTS = new Set(['nebula-drift', 'ink-wash']);
const framesFor = (skin: string) => (GPU_SUBJECTS.has(skin) ? '90' : '240');

async function openCheck(page: Page, skin: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ skin, seed: 'orion-7', frames: framesFor(skin), ...extra });
  await page.goto(`/check.html?${params.toString()}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 90_000 });
}

for (const skin of SUBJECTS) {
  test.describe(skin, () => {
    test('matches its reference render', async ({ page }) => {
      await openCheck(page, skin, { text: '0' });
      await expect(page).toHaveScreenshot(`${skin}.png`);
    });

    test('keeps page text legible at default settings', async ({ page }) => {
      await openCheck(page, skin);
      const report = (await page.evaluate(() => (window as any).__bge.probe())) as Probe;
      expect(report.samples).toBeGreaterThan(1000);
      // M9 gate: the background behind the column must reach WCAG AAA (7:1) against the
      // palette ink on average, and almost no individual pixel may fall below AA.
      expect(report.meanContrast, `mean contrast for ${skin}`).toBeGreaterThanOrEqual(7);
      expect(report.failingShare, `failing share for ${skin}`).toBeLessThanOrEqual(0.05);
    });

    test('replays pixel-identically for the same seed', async ({ page, browser }) => {
      await openCheck(page, skin, { text: '0' });
      const a = (await page.evaluate(() => (window as any).__bge.dataUrl())) as string;
      // A second, independent browser context at exactly the same canvas size.
      const other = await browser.newPage({
        viewport: page.viewportSize() ?? { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        baseURL: new URL(page.url()).origin,
      });
      await openCheck(other, skin, { text: '0' });
      const b = (await other.evaluate(() => (window as any).__bge.dataUrl())) as string;
      await other.close();
      expect(a.length).toBeGreaterThan(1000);
      expect(a).toBe(b);
    });
  });
}

test('different seeds render differently', async ({ page }) => {
  await openCheck(page, 'void-tactical', { text: '0' });
  const a = (await page.evaluate(() => (window as any).__bge.dataUrl())) as string;
  await openCheck(page, 'void-tactical', { text: '0', seed: 'orion-8' });
  const b = (await page.evaluate(() => (window as any).__bge.dataUrl())) as string;
  expect(a).not.toBe(b);
});
