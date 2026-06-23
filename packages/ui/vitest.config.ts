import { defineConfig } from 'vitest/config';

/**
 * @iagente/ui uses the jsdom environment because tests render React components
 * that interact with the DOM (document, ShadowRoot, etc).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
