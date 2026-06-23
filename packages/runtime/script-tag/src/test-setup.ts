/**
 * Test setup for @iagente/runtime-script-tag.
 *
 * Enables React 19's act() environment. Does NOT use @testing-library/react's
 * cleanup() because it unmounts ALL React roots (including our overlay's
 * createRoot), which breaks subsequent test renders.
 */

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
