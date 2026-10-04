/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { build, defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The studio's offline wallpaper file inlines the whole engine as one script. This
 * builds that script (`wallpaper-runtime.js`: the wallpaper page, every world, no
 * chunks) next to the site on `vite build`, and serves it on demand in dev.
 */
function wallpaperRuntime(): Plugin {
  const bundle = (outDir?: string) =>
    build({
      configFile: false,
      logLevel: 'warn',
      publicDir: false,
      build: {
        outDir,
        emptyOutDir: false,
        write: !!outDir,
        copyPublicDir: false,
        lib: { entry: resolve('src/wallpaper/main.ts'), formats: ['iife'], name: 'BGEWallpaper', fileName: () => 'wallpaper-runtime.js' },
        // Skins, layers, presets, and worlds register themselves on import; keep every such
        // side effect (this build does not see package.json's list) and inline lazy chunks.
        rollupOptions: { treeshake: { moduleSideEffects: true }, output: { inlineDynamicImports: true } },
      },
    });
  let outDir = 'dist';
  let cached: Promise<string> | null = null;
  return {
    name: 'wallpaper-runtime',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    configureServer(server) {
      // Rebuilt on the next request after any source change.
      server.watcher.on('change', (file) => {
        if (/[\\/]src[\\/]/.test(file)) cached = null;
      });
      server.middlewares.use('/wallpaper-runtime.js', (_req, res) => {
        cached ??= bundle().then((out) => {
          const first = Array.isArray(out) ? out[0] : out;
          return 'output' in first ? first.output[0].code : '';
        });
        cached.then(
          (code) => {
            res.setHeader('content-type', 'text/javascript');
            res.end(code);
          },
          (err: Error) => {
            cached = null;
            res.statusCode = 500;
            res.end(String(err));
          },
        );
      });
    },
    async closeBundle() {
      if (this.meta.watchMode) return;
      await bundle(resolve(outDir));
    },
  };
}

export default defineConfig({
  plugins: [react(), wallpaperRuntime()],
  server: {
    port: 5174,
    strictPort: false,
  },
  build: {
    rollupOptions: {
      // The studio, and the bare full-screen page wallpapers point at.
      input: { main: resolve('index.html'), wallpaper: resolve('wallpaper.html') },
    },
  },
  test: {
    environment: 'node',
    // Playwright owns e2e/**; vitest owns unit and jsdom tests under src/.
    include: ['src/**/*.test.ts'],
  },
});
