/**
 * Vite/Vitest configuration for the React QPU application.
 *
 * The WebLLM package is excluded from dependency pre-bundling because it is
 * loaded dynamically only when browser-based correction assistance is used.
 *
 * Production builds emit into ../workbench with a /workbench/ base so the
 * portfolio Pages site can host the playground next to the static pages.
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { resolveAppBase } from './src/siteBase';

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: resolveAppBase({ command, isPreview }),
  build: {
    outDir: '../workbench',
    emptyOutDir: true,
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
  },
}));
