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
        'skins/void-tactical': 'src/entries/skins/void-tactical.ts',
        'skins/drifting-dust': 'src/entries/skins/drifting-dust.ts',
        'skins/matrix-rain': 'src/entries/skins/matrix-rain.ts',
        layers: 'src/entries/layers.ts',
        presets: 'src/entries/presets.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
