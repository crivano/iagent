/**
 * SHELL_CSS — injected inside the iAgente overlay's Shadow DOM by the runtime
 * entry. Scoped by Shadow DOM so it does NOT leak to the host page.
 *
 * The host-side CSS (squeezing <body>) is SEPARATE — it must run in the
 * light DOM because the host's <body> is outside our shadow root. See
 * applyHostLayout() in @iagente/runtime-script-tag.
 */

export const SHELL_CSS = `
  :host {
    /* The overlay host element spans the viewport so child positioning works. */
    all: initial;
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483000;
  }
  /* Re-enable pointer events only on interactive elements we own. */
  .iagente-fab,
  .iagente-pane,
  .iagente-pane__handle {
    pointer-events: auto;
  }

  /* ---------- Floating button ---------- */
  .iagente-fab {
    position: fixed;
    right: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 8px 0 0 8px;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width .12s ease, height .12s ease, box-shadow .12s ease;
    z-index: 2147483001;
  }
  .iagente-fab:hover {
    box-shadow: 0 4px 14px rgba(37,99,235,0.45);
  }
  .iagente-fab--dragging {
    cursor: ns-resize;
    transition: none;
  }
  .iagente-fab__logo { display: block; }

  /* ---------- Sidebar pane ( squeezes host via body padding-right ) ---------- */
  .iagente-pane {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    background: #ffffff;
    color: #1a1a1a;
    box-shadow: -2px 0 8px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483000;
  }

  .iagente-pane__handle {
    position: absolute;
    left: -2px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: transparent;
  }
  .iagente-pane__handle:hover,
  .iagente-pane--dragging .iagente-pane__handle {
    background: rgba(37,99,235,0.25);
  }

  .iagente-pane__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
    flex: 0 0 auto;
  }
  .iagente-pane__title { font-size: 14px; font-weight: 600; }
  .iagente-pane__header-extras {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .iagente-pane__close {
    appearance: none;
    background: transparent;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 4px 6px;
    border-radius: 4px;
  }
  .iagente-pane__close:hover { background: #f0f0f0; }

  .iagente-pane__body {
    flex: 1 1 auto;
    overflow: auto;
    padding: 8px;
  }

  /* ---------- Misc (shared with older Sidebar/ActionButton components) ---------- */
  .iagente-sidebar__actions { list-style: none; padding: 0; margin: 0; }
  .iagente-sidebar__action { margin-bottom: 4px; }
  .iagente-action {
    border: 1px solid #2563eb; background: #2563eb; color: #fff;
    border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 13px;
    width: 100%; text-align: left;
  }
  .iagente-action--secondary { background: #fff; color: #2563eb; }
  .iagente-action--ghost     { background: transparent; border-color: transparent; color: #555; }
  .iagente-action:disabled { opacity: 0.5; cursor: not-allowed; }
`;
