import { defineConfig, devices } from '@playwright/test';

/**
 * Browser-level gates: visual regression per skin/preset, contrast behind a text
 * column, and pixel-identical replay for one seed. Runs against the Vite dev server
 * on a dedicated port so it never collides with a developer's `pnpm dev`.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/debug-*'],
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // Missing snapshots are written rather than failed, so a new platform (CI's Linux vs
  // a developer's Windows) bootstraps its own baselines on first run. Existing
  // baselines for the current platform are compared strictly.
  updateSnapshots: 'missing',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
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
