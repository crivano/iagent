import { defineConfig } from 'vite';

/**
 * Vite config for the LOCAL DEMO server (`pnpm dev:demo` from the root).
 *
 * Unlike the production `vite.config.ts` (which produces a single IIFE bundle
 * for injection), this serves the `demo/index.html` page so you can SEE the
 * iAgente overlay/sidebar rendering against a real (mock) host page in your
 * browser, with hot reload.
 *
 * The `entry.tsx` module auto-starts iAgente when loaded in a browser context
 * (see the auto-start hook at the bottom of entry.tsx).
 *
 * NB: this loads source TS directly — make sure upstream packages (core, rpc,
 * protocol, ui, host-demo) are built (`pnpm -r run build`) so their `dist/`
 * can be resolved, OR the relevant entries exist.
 */
export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 5174,
    open: true,
  },
  build: {
    // Allows `vite build` with this config too, if you want a preview build.
    outDir: './demo-dist',
    emptyOutDir: true,
  },
});
