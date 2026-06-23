/**
 * Overlay — mounts the React root into a Shadow DOM attached to a host element
 * in the page, isolating iAgente's styles from the host page's CSS.
 *
 * The shadow root is open so devtools can inspect it; isolation comes from
 * Shadow DOM's natural style scoping (no host CSS leaks in, no iAgente CSS
 * leaks out).
 */

import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

export interface OverlayHandle {
  /** The host element appended to document.body. */
  readonly host: HTMLElement;
  /** The ShadowRoot contents are rendered into. */
  readonly shadow: ShadowRoot;
  /** Render any React tree into the overlay. */
  render(node: ReactNode): void;
  /** Tear down the overlay and remove the host element. */
  unmount(): void;
}

export interface OverlayOptions {
  /** CSS to inject INSIDE the shadow root (scoped to iAgente). */
  readonly css?: string;
  /** Custom tag for the host element. Default 'iagente-overlay'. */
  readonly hostTag?: string;
}

/**
 * Creates a Shadow-DOM-isolated overlay in the page.
 *
 * @example
 *   const overlay = createOverlay({ css: `.btn { color: red; }` });
 *   overlay.render(<Sidebar />);
 */
export function createOverlay(opts: OverlayOptions = {}): OverlayHandle {
  const host = document.createElement(opts.hostTag ?? 'iagente-overlay');
  // Attach BEFORE appending to the page so we can style synchronously.
  const shadow = host.attachShadow({ mode: 'open' });

  if (opts.css) {
    const style = document.createElement('style');
    style.textContent = opts.css;
    shadow.appendChild(style);
  }

  // Container where React will mount its tree (after the <style>).
  const mountPoint = document.createElement('div');
  mountPoint.setAttribute('data-iagente-root', 'true');
  shadow.appendChild(mountPoint);

  // Append host element to the page last (so all structure is ready).
  document.body.appendChild(host);

  const root: Root = createRoot(mountPoint);

  return {
    host,
    shadow,
    render(node) {
      root.render(node);
    },
    unmount() {
      root.unmount();
      host.remove();
    },
  };
}
