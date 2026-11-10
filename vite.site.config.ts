import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * The examples are the docs' live pages. Built for the base `/beat-ui/` into `site-dist/beat-ui/`, the same shape as
 * 2lab-ai/ui (`/ui/`), so a 2lab.ai proxy rule for `/beat-ui/*` can point at this project. `SITE_BASE=/` builds for a root.
 */
const base = process.env.SITE_BASE ?? '/beat-ui/';
const dir = base.replace(/^\/+|\/+$/g, '');

export default defineConfig({
  base,
  root: resolve(__dirname, 'examples'),
  resolve: { alias: { '@2lab.ai/beat-ui': resolve(__dirname, 'src/index.ts') } },
  build: {
    outDir: resolve(__dirname, 'site-dist', dir),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'examples/index.html'),
        reef: resolve(__dirname, 'examples/reef/index.html'),
        minimal: resolve(__dirname, 'examples/minimal/index.html'),
      },
    },
  },
});
