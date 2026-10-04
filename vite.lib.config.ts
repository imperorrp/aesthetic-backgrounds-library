import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: {
        index: 'src/lib.ts',
        core: 'src/entries/core.ts',
        element: 'src/element.ts',
        react: 'src/react-entry.tsx',
        vue: 'src/adapters/vue.ts',
        svelte: 'src/adapters/svelte.ts',
        'skins/void-tactical': 'src/entries/skins/void-tactical.ts',
        'skins/drifting-dust': 'src/entries/skins/drifting-dust.ts',
        'skins/matrix-rain': 'src/entries/skins/matrix-rain.ts',
        'skins/undercity': 'src/entries/skins/undercity.ts',
        shader: 'src/entries/shader.ts',
        manifest: 'src/entries/manifest.ts',
        tokens: 'src/entries/tokens.ts',
        layers: 'src/entries/layers.ts',
        presets: 'src/entries/presets.ts',
        audio: 'src/entries/audio.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        // Next.js App Router needs the React entry marked as a client module. Rollup
        // strips module-level directives from sources, so it is added back here.
        banner: (chunk) => (chunk.isEntry && chunk.name === 'react' ? "'use client';" : ''),
      },
    },
  },
});
