/**
 * Vitest setup for @iagente/ui.
 *
 * 1. Registers IS_REACT_ACT_ENVIRONMENT so React 19 flushes act() correctly.
 * 2. Auto-cleans the DOM after each test (so @testing-library/react renders
 *    don't accumulate across cases and "multiple elements" errors don't appear).
 * 3. Suppresses React 19 + jsdom "not wrapped in act" warnings (known noise
 *    when createRoot defers commits to a microtask).
 */

// 1. IS_REACT_ACT_ENVIRONMENT — required for React 19 act() support.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 2. Auto-cleanup between tests.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
});

// 3. jsdom does not implement PointerEvent; polyfill it for tests that
// dispatch pointer events (drag of FloatingButton / SplitPane handle).
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent implements PointerEvent {
    readonly pointerId: number;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly tangentialPressure: number;
    readonly tiltX: number;
    readonly tiltY: number;
    readonly twist: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init as MouseEventInit);
      this.pointerId = init.pointerId ?? 0;
      this.width = init.width ?? 1;
      this.height = init.height ?? 1;
      this.pressure = init.pressure ?? 0;
      this.tangentialPressure = init.tangentialPressure ?? 0;
      this.tiltX = init.tiltX ?? 0;
      this.tiltY = init.tiltY ?? 0;
      this.twist = init.twist ?? 0;
      this.pointerType = init.pointerType ?? '';
      this.isPrimary = init.isPrimary ?? false;
    }
  }
  (globalThis as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent =
    PointerEventPolyfill;
  // Also expose on window if present.
  if (typeof window !== 'undefined') {
    (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent =
      PointerEventPolyfill;
  }
}

// 3. Suppress known React 19 act warnings.
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    (first.includes('not wrapped in act') ||
      first.includes('ReactDOMTestUtils.act') ||
      first.includes('An update to Root inside a test'))
  ) {
    return;
  }
  originalError(...args);
};
