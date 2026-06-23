import { defineConfig } from 'vite';

/**
 * Vite build for the script-tag runtime.
 *
 * Produces a single, self-executing IIFE bundle (./dist/iagente.js) suitable
 * for injection via a <script> tag. The bundle:
 *   - inlines its dependencies (no external chunks);
 *   - calls startIagente() on DOMContentLoaded.
 */
export default defineConfig({
  build: {
    lib: {
      entry: './src/entry.tsx',
      name: 'Iagente',
      fileName: () => 'iagente.js',
      formats: ['iife'],
    },
    outDir: './dist',
    emptyOutDir: true,
    minify: false, // keep readable for the demo / debugging
    sourcemap: true,
    rollupOptions: {
      output: {
        // Single file, no async chunks.
        inlineDynamicImports: true,
      },
    },
  },
});
