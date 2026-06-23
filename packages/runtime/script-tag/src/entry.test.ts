/**
 * End-to-end integration tests for the new IagenteShell-based runtime.
 *
 * These exercise the actual UX flow:
 *   1. Page loads, host is detected, FloatingButton appears (no sidebar yet).
 *   2. Clicking the FAB opens the SplitPane + injects host-layout CSS that
 *      squeezes <body>.
 *   3. Menu lists the registered apps (Apoia, NPS).
 *   4. Clicking "Avaliar sistema" (NPS) renders the bundled React form.
 *   5. Settings cog opens the preferences panel with the categories.
 *   6. Closing the shell removes the host-layout class.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { startIagente, HOST_ADAPTERS, APP_DESCRIPTORS } from './entry.js';

const DEMO_HOST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Demo Host</title></head>
<body>
  <span data-demo-case-number="0001-99.2024" data-demo-title="Proc 0001-99.2024">Número: 0001-99.2024</span>
  <div data-demo-party="João" data-demo-name="João" data-demo-role="autor">Autor</div>
  <div data-demo-party="Maria" data-demo-name="Maria" data-demo-role="réu">Réu</div>
  <div data-demo-movement data-demo-date="2024-01-15">Despacho</div>
  <textarea data-demo-editor>Texto do documento.</textarea>
</body>
</html>
`;

const buildJsdOM = (): JSDOM =>
  new JSDOM(DEMO_HOST_HTML, { url: 'https://demo-host.local/case/0001', pretendToBeVisual: true });

// Helpers — React 19 renders asynchronously inside the shadow root.
const flush = () => new Promise((r) => setTimeout(r, 30));

describe('iAgente runtime E2E', () => {
  let dom: JSDOM;
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    dom = buildJsdOM();
    (globalThis as unknown as { document: Document }).document = dom.window.document;
    (globalThis as unknown as { window: Window }).window = dom.window;
    // jsdom has no PointerEvent — provide a no-op subclass so FAB drag works.
    if (typeof dom.window.PointerEvent === 'undefined') {
      class PE extends dom.window.MouseEvent {
        pointerId = 0;
        width = 1;
        height = 1;
        pressure = 0;
        tangentialPressure = 0;
        tiltX = 0;
        tiltY = 0;
        twist = 0;
        pointerType = '';
        isPrimary = false;
      }
      (dom.window as unknown as { PointerEvent: typeof PE }).PointerEvent = PE;
      (dom.window.window as unknown as { PointerEvent: typeof PE }).PointerEvent = PE;
    }
    // Clear persisted UI state so each test starts from a closed shell.
    dom.window.localStorage.clear();
  });

  afterEach(async () => {
    // Let any pending microtasks settle before disposing / next test.
    await new Promise((r) => setTimeout(r, 10));
    dispose?.();
    dispose = undefined;
    // Wipe body to ensure no stale overlay hosts leak between tests.
    if (dom?.window?.document?.body) dom.window.document.body.innerHTML = '';
  });

  it('exports the demo-host and the bundled apps', () => {
    expect(HOST_ADAPTERS.map((a) => a.descriptor.id)).toContain('demo-host');
    expect(APP_DESCRIPTORS.map((a) => a.id)).toEqual(expect.arrayContaining(['apoia', 'nps']));
  });

  it('detects the host, mounts the overlay, and shows the FAB (not the pane)', async () => {
    const session = startIagente({ document: dom.window.document, window: dom.window });
    dispose = session.dispose;
    await flush();

    const overlay = dom.window.document.querySelector('iagente-overlay');
    expect(overlay).not.toBeNull();
    const fab = overlay?.shadowRoot?.querySelector('.iagente-fab');
    expect(fab).toBeTruthy();
    // Pane should NOT be present (shell starts closed).
    expect(overlay?.shadowRoot?.querySelector('.iagente-pane')).toBeNull();
    // Host body should NOT be squeezed yet.
    expect(dom.window.document.documentElement.classList.contains('iagente-open')).toBe(false);
  });

  it('opening the FAB mounts the pane, injects the iagente-open class, and lists the apps', async () => {
    const session = startIagente({ document: dom.window.document, window: dom.window });
    dispose = session.dispose;
    await flush();

    const overlay = dom.window.document.querySelector('iagente-overlay')!;
    const fab = overlay.shadowRoot!.querySelector<HTMLButtonElement>('.iagente-fab')!;

    // jsdom dispatches pointer events without real pointer-capture support;
    // exercise the click via a synthesized pointerdown/move/up triplet (move
    // stays below DRAG_THRESHOLD so the FAB treats it as a click, not a drag).
    await act(async () => {
      fab.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, clientY: 100 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true, clientY: 101 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, clientY: 101 }));
    });
    await flush();

    // Pane exists now.
    expect(overlay.shadowRoot!.querySelector('.iagente-pane')).toBeTruthy();
    // <html> got the iagente-open class (so the host CSS squeezes body).
    expect(dom.window.document.documentElement.classList.contains('iagente-open')).toBe(true);
    // Menu lists the apps.
    const menuText = overlay.shadowRoot!.textContent ?? '';
    expect(menuText).toContain('Apoia');
    expect(menuText).toContain('Avaliar sistema');
  });

  it('selecting the NPS app renders the React form inside the pane', async () => {
    const session = startIagente({ document: dom.window.document, window: dom.window });
    dispose = session.dispose;
    await flush();

    const overlay = dom.window.document.querySelector('iagente-overlay')!;
    const fab = overlay.shadowRoot!.querySelector<HTMLButtonElement>('.iagente-fab')!;
    await act(async () => {
      fab.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, clientY: 100 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true, clientY: 101 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, clientY: 101 }));
    });
    await flush();

    // Click the NPS menu item.
    const npsBtns = [...overlay.shadowRoot!.querySelectorAll<HTMLButtonElement>('.iagente-menu__button')];
    expect(npsBtns.length).toBeGreaterThan(0);
    const npsBtn = npsBtns.find((b) => b.textContent?.includes('Avaliar'));
    expect(npsBtn).toBeDefined();
    await act(async () => {
      npsBtn!.click();
    });
    await flush();
    await flush();

    // The NPS form should be rendered: an 11-button scale appears.
    const radios = overlay.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(11);
  });

  it('the settings cog toggles to the preferences panel', async () => {
    const session = startIagente({ document: dom.window.document, window: dom.window });
    dispose = session.dispose;
    await flush();
    const overlay = dom.window.document.querySelector('iagente-overlay')!;

    const fab = overlay.shadowRoot!.querySelector<HTMLButtonElement>('.iagente-fab')!;
    await act(async () => {
      fab.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, clientY: 100 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true, clientY: 101 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, clientY: 101 }));
    });
    await flush();

    // Click the settings cog.
    const cog = overlay.shadowRoot!.querySelector<HTMLButtonElement>('.iagente-pane__settings')!;
    await act(async () => {
      cog.click();
    });
    await flush();

    const bodyText = overlay.shadowRoot!.textContent ?? '';
    expect(bodyText).toContain('Preferências');
    expect(bodyText).toContain('App de IA preferido');
  });

  it('closing the pane removes the iagente-open class and re-shows the FAB', async () => {
    const session = startIagente({ document: dom.window.document, window: dom.window });
    dispose = session.dispose;
    await flush();
    const overlay = dom.window.document.querySelector('iagente-overlay')!;
    const fab = overlay.shadowRoot!.querySelector<HTMLButtonElement>('.iagente-fab')!;
    await act(async () => {
      fab.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, clientY: 100 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true, clientY: 101 }));
      fab.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, clientY: 101 }));
    });
    await flush();

    const closeBtn = overlay.shadowRoot!.querySelector<HTMLButtonElement>('.iagente-pane__close')!;
    await act(async () => {
      closeBtn.click();
    });
    await flush();

    // Pane gone, FAB back, html.iagente-open removed.
    expect(overlay.shadowRoot!.querySelector('.iagente-pane')).toBeNull();
    expect(overlay.shadowRoot!.querySelector('.iagente-fab')).toBeTruthy();
    expect(dom.window.document.documentElement.classList.contains('iagente-open')).toBe(false);
  });

  it('bails cleanly (no overlay) when no host matches the URL', () => {
    const otherDom = new JSDOM('<!DOCTYPE html><body>random page</body>', {
      url: 'https://random.example.com/',
    });
    const session = startIagente({
      document: otherDom.window.document,
      window: otherDom.window,
    });
    dispose = session.dispose;
    expect(otherDom.window.document.querySelector('iagente-overlay')).toBeNull();
  });
});
