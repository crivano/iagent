/**
 * InjectedActions — tests
 *
 * Verifies that the component inserts buttons into the host's document at
 * the correct positions and dispatches `iagente:launch-intent` events on
 * click.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { InjectedAction } from '@iagente/protocol';
import { LAUNCH_INTENT_EVENT } from '@iagente/protocol';
import { InjectedActions } from './injected-actions.js';

function makeDoc(): Document {
  // Use the global jsdom document (which has defaultView = window) instead
  // of createHTMLDocument (which has defaultView = null). The component
  // dispatches on `defaultView` and the RuntimeRoot listens on the global
  // window, so the test must mimic that setup.
  return document;
}

describe('InjectedActions', () => {
  let host: Document;
  let originalBody: string;

  beforeEach(() => {
    host = makeDoc();
    originalBody = host.body.innerHTML;
    host.body.innerHTML = `
      <div>
        <input data-demo-editor />
      </div>
    `;
  });

  afterEach(() => {
    // Remove any iagente-injected-action buttons that the component inserted
    // (the global document is shared with other tests in the suite).
    for (const b of [...host.querySelectorAll('button.iagente-injected-action')]) {
      b.remove();
    }
    host.body.innerHTML = originalBody;
  });

  it('renders nothing in the React tree (returns null)', () => {
    const { container } = render(
      <InjectedActions
        document={host}
        actions={[
          {
            id: 'cta-summarize',
            label: 'Resumir',
            intent: 'summarize',
            capability: 'ai',
            targetSelector: '[data-demo-editor]',
            placement: 'after',
          },
        ]}
      />,
    );
    // The React container is a <div> created by @testing-library; the
    // component itself renders no children inside it.
    expect(container.firstChild).toBeNull();
  });

  it('inserts a button after the target element', () => {
    render(
      <InjectedActions
        document={host}
        actions={[
          {
            id: 'cta-summarize',
            label: 'Resumir',
            intent: 'summarize',
            capability: 'ai',
            targetSelector: '[data-demo-editor]',
            placement: 'after',
          },
        ]}
      />,
    );
    const target = host.querySelector('[data-demo-editor]')!;
    const btn = target.nextElementSibling as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.classList.contains('iagente-injected-action')).toBe(true);
    expect(btn.getAttribute('data-iagente-action-id')).toBe('cta-summarize');
    expect(btn.getAttribute('data-iagente-intent')).toBe('summarize');
    expect(btn.getAttribute('data-iagente-capability')).toBe('ai');
    expect(btn.textContent).toContain('Resumir');
  });

  it('inserts a button before the target element', () => {
    render(
      <InjectedActions
        document={host}
        actions={[
          {
            id: 'cta-summarize',
            label: 'Resumir',
            intent: 'summarize',
            capability: 'ai',
            targetSelector: '[data-demo-editor]',
            placement: 'before',
          },
        ]}
      />,
    );
    const target = host.querySelector('[data-demo-editor]')!;
    const btn = target.previousElementSibling as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
  });

  it('inserts a button inside the target as the last child', () => {
    host.body.innerHTML = `<div data-demo-editor><span>existing</span></div>`;
    render(
      <InjectedActions
        document={host}
        actions={[
          {
            id: 'cta-summarize',
            label: 'Resumir',
            intent: 'summarize',
            capability: 'ai',
            targetSelector: '[data-demo-editor]',
            placement: 'inside-end',
          },
        ]}
      />,
    );
    const target = host.querySelector('[data-demo-editor]')!;
    expect(target.lastElementChild?.tagName).toBe('BUTTON');
  });

  it('dispatches iagente:launch-intent on click with the right detail', () => {
    render(
      <InjectedActions
        document={host}
        actions={[
          {
            id: 'cta-summarize',
            label: 'Resumir',
            intent: 'summarize',
            capability: 'ai',
            targetSelector: '[data-demo-editor]',
            placement: 'after',
          },
        ]}
      />,
    );
    const target = host.querySelector('[data-demo-editor]')!;
    const btn = target.nextElementSibling as HTMLButtonElement;

    let receivedDetail: unknown = null;
    const listener = (e: Event) => {
      receivedDetail = (e as CustomEvent).detail;
    };
    // The component dispatches on `defaultView` (window). We listen there.
    window.addEventListener(LAUNCH_INTENT_EVENT, listener);
    btn.click();
    window.removeEventListener(LAUNCH_INTENT_EVENT, listener);

    expect(receivedDetail).toEqual({
      actionId: 'cta-summarize',
      capability: 'ai',
      intent: 'summarize',
    });
  });

  it('skips actions whose target selector is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <InjectedActions
        document={host}
        actions={[
          {
            id: 'cta-ghost',
            label: 'Ghost',
            intent: 'summarize',
            capability: 'ai',
            targetSelector: '[does-not-exist]',
            placement: 'after',
          },
        ]}
      />,
    );
    const buttons = host.querySelectorAll('button.iagente-injected-action');
    expect(buttons).toHaveLength(0);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('cleans up the inserted buttons on unmount', () => {
    const { unmount } = render(
      <InjectedActions
        document={host}
        actions={[
          {
            id: 'cta-summarize',
            label: 'Resumir',
            intent: 'summarize',
            capability: 'ai',
            targetSelector: '[data-demo-editor]',
            placement: 'after',
          },
        ]}
      />,
    );
    expect(host.querySelectorAll('button.iagente-injected-action')).toHaveLength(1);
    unmount();
    expect(host.querySelectorAll('button.iagente-injected-action')).toHaveLength(0);
  });

  it('handles multiple actions with mixed placements', () => {
    host.body.innerHTML = `
      <div data-demo-editor></div>
      <button data-demo-cmd>cmd</button>
    `;
    const actions: InjectedAction[] = [
      {
        id: 'cta-1',
        label: 'Resumir',
        intent: 'summarize',
        capability: 'ai',
        targetSelector: '[data-demo-editor]',
        placement: 'before',
      },
      {
        id: 'cta-2',
        label: 'Revisar',
        intent: 'review',
        capability: 'ai',
        targetSelector: '[data-demo-cmd]',
        placement: 'after',
      },
    ];
    render(<InjectedActions document={host} actions={actions} />);
    expect(host.querySelectorAll('button.iagente-injected-action')).toHaveLength(2);
  });
});
