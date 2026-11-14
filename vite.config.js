import { defineConfig } from 'vite';

// base './' keeps dist/ portable (sub-path hosting and file:// inspection)
export default defineConfig({
  base: './',
  publicDir: 'public',
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
