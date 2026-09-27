/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
  },
  test: {
    environment: 'node',
    // Playwright owns e2e/**; vitest owns unit and jsdom tests under src/.
    include: ['src/**/*.test.ts'],
  },
});
