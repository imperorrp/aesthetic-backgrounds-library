import { defineConfig, devices } from '@playwright/test';

/**
 * Browser-level gates: visual regression per skin/preset, contrast behind a text
 * column, and pixel-identical replay for one seed. Runs against the Vite dev server
 * on a dedicated port so it never collides with a developer's `pnpm dev`.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/debug-*', '**/zz*'],
  // Shader layers fall back to software rasterization without a GPU (CI), so a
  // settle-and-screenshot cycle can take a while.
  timeout: 180_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // Baselines are per platform: font rasterization differs between Windows and Linux, so
  // a Windows baseline can never match a Linux render. The committed baselines (Windows,
  // where they are made; the README and the gallery use them) live in `chromium/`; other
  // platforms keep theirs in `chromium-<platform>/`. Missing snapshots are written rather
  // than failed, so CI bootstraps its own on first run; existing ones compare strictly.
  updateSnapshots: 'missing',
  snapshotPathTemplate: process.platform === 'win32' ? '{testDir}/__screenshots__/{projectName}/{arg}{ext}' : '{testDir}/__screenshots__/{projectName}-{platform}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled' },
  },
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  // The device preset carries its own 1280x720 viewport; pin ours after it so every
  // render (and every baseline) is the same canvas size.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: 'pnpm exec vite --port 5199 --strictPort',
    url: 'http://localhost:5199/check.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
