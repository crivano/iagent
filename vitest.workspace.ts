/**
 * Vitest WORKSPACE configuration (root).
 *
 * Lists every package as a separate Vitest project. Each folder's local
 * `vitest.config.ts` (when present) takes precedence — e.g. `@iagente/ui`
 * forces the `jsdom` environment, while others default to `node`.
 *
 * Used by the root-level scripts:
 *   pnpm test:ui    → opens the @vitest/ui dashboard with all projects
 *   vitest run      → runs every project from the root
 *
 * Vitest 2.x requires this file to default-export an ARRAY of project paths.
 */
export default [
  'packages/protocol',
  'packages/rpc',
  'packages/core',
  'packages/sdk',
  'packages/ui',
  'packages/hosts/demo-host',
  'packages/apps/demo-app',
  'packages/runtime/script-tag',
];
