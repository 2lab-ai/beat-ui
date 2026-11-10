import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** One ES module, no dependencies: `dist/beat-ui.js`. Types come from `tsc -p tsconfig.build.json`. */
export default defineConfig({
  build: {
    lib: { entry: resolve(__dirname, 'src/index.ts'), formats: ['es'], fileName: () => 'beat-ui.js' },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
});
