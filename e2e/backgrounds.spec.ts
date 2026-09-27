import { expect, test, type Page } from '@playwright/test';

/**
 * Every built-in skin and preset, rendered by the deterministic check harness
 * (manual clock, fixed seed, fixed frame count), must:
 *   1. match its stored screenshot (visual regression),
 *   2. keep the palette ink legible behind a text column (contrast gate),
 *   3. replay pixel-identically for the same seed (determinism, real pixels).
 */

const SUBJECTS = [
  'void-tactical',
  'drifting-dust',
  'matrix-rain',
  'calm-mesh',
  'aurora-night',
  'terminal-rain',
  'deep-field',
  'flow-lines',
  'fireflies',
  'paper-grid',
];

type Probe = {
  meanLuminance: number;
  maxLuminance: number;
  meanContrast: number;
  worstContrast: number;
  failingShare: number;
  samples: number;
};

async function openCheck(page: Page, skin: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ skin, seed: 'orion-7', frames: '240', ...extra });
  await page.goto(`/check.html?${params.toString()}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 });
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
      // Mean background behind the column must clear WCAG AA for body text against the palette ink.
      expect(report.meanContrast, `mean contrast for ${skin}`).toBeGreaterThanOrEqual(4.5);
      // And no more than a small share of individual pixels may fall below AA.
      expect(report.failingShare, `failing share for ${skin}`).toBeLessThanOrEqual(0.12);
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
