import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Builds the popup and options pages. Content and background scripts are built by scripts/build.mjs.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  publicDir: resolve(import.meta.dirname, 'public'),
  base: '',
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'src/popup/index.html'),
        options: resolve(import.meta.dirname, 'src/options/index.html'),
      },
    },
  },
});
