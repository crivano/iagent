/**
 * @iagente/host-demo — a fake host adapter used to validate the architecture
 * end-to-end without depending on a real legal/administrative system.
 *
 * It simulates a case + document-management page: declares a URL pattern for
 * detection (https://demo-host.local/*) and implements ICaseManagementSystem,
 * IDocumentManagementSystem (with session-scoped readCurrentContent /
 * getSinkConfig / deliverResult), and IAuthHelper by reading mock data from
 * the DOM and opening real popup windows from the top frame.
 *
 * In production, this would be `@iagente/host-eproc` or `@iagente/host-pje`.
 */

import type {
  CaseRef,
  ContextPayload,
  DeliveryReceipt,
  DocumentContent,
  DocumentRef,
  IAuthHelper,
  ICaseManagementSystem,
  IDocumentManagementSystem,
  Json,
  Movement,
  Party,
  SessionContext,
  SinkConfig,
} from '@iagente/protocol';
import type { HostAdapter, HostCapabilities, HostContext } from '@iagente/core';

/** DOM selectors used to read host state. */
const SELECTORS = {
  caseNumber: '[data-demo-case-number]',
  partyList: '[data-demo-party]',
  movementList: '[data-demo-movement]',
  editorTextarea: '[data-demo-editor]',
} as const;

/**
 * The actual capability implementation: reads the live DOM to answer
 * ICaseManagementSystem queries.
 */
class DemoCaseManagementSystem implements ICaseManagementSystem {
  readonly capabilityId = 'case' as const;
  constructor(private readonly doc: Document) {}

  async getOpenCase(_ctx: ContextPayload): Promise<CaseRef | null> {
    const el = this.doc.querySelector(CASE_NUMBER_SELECTOR);
    const number = el?.getAttribute('data-demo-case-number') ?? el?.textContent ?? null;
    if (!number) return null;
    return { number, title: el?.getAttribute('data-demo-title') ?? undefined };
  }

  async getParties(_ctx: ContextPayload): Promise<readonly Party[]> {
    const nodes = this.doc.querySelectorAll(PARTY_SELECTOR);
    return [...nodes].map((el) => ({
      name: el.getAttribute('data-demo-name') ?? el.textContent ?? '',
      role: el.getAttribute('data-demo-role') ?? 'parte',
    }));
  }

  async getMovements(_ctx: ContextPayload): Promise<readonly Movement[]> {
    const nodes = this.doc.querySelectorAll(MOVEMENT_SELECTOR);
    return [...nodes].map((el) => ({
      date: el.getAttribute('data-demo-date') ?? '',
      description: el.textContent ?? '',
    }));
  }
}

/**
 * Document Management capability for the demo host.
 *
 * The editor textarea is treated as the "open document": readCurrentContent
 * returns its value as HTML/plainText, deliverResult writes back into it.
 */
class DemoDocumentManagementSystem implements IDocumentManagementSystem {
  readonly capabilityId = 'document' as const;
  constructor(
    private readonly doc: Document,
    private readonly onChangeListeners: Set<(text: string) => void> = new Set(),
  ) {}

  async getOpenDocument(_ctx: ContextPayload): Promise<DocumentRef | null> {
    const ta = this.doc.querySelector<HTMLTextAreaElement>(EDITOR_SELECTOR);
    if (!ta) return null;
    return { id: 'demo-editor', title: 'Editor', mimeType: 'text/plain' };
  }

  async readDocumentContent(_ref: DocumentRef, _ctx: ContextPayload): Promise<string> {
    return this.readEditorText();
  }

  async writeDocumentContent(
    _ref: DocumentRef,
    content: string,
    _ctx: ContextPayload,
  ): Promise<void> {
    this.writeEditorText(content);
  }

  // --- Session-scoped methods (called by apps during a session) ---

  async readCurrentContent(_sessionCtx: SessionContext): Promise<DocumentContent> {
    const plainText = this.readEditorText();
    return {
      html: `<div>${escapeHtml(plainText)}</div>`,
      plainText,
      selectionInfo: { startOffset: 0, endOffset: Math.min(plainText.length, 100) },
    };
  }

  async getSinkConfig(_sessionCtx: SessionContext): Promise<SinkConfig> {
    return {
      kind: 'to-parent',
      buttonText: 'Enviar para o editor',
      target: 'demo-host editor textarea',
    };
  }

  async deliverResult(
    text: string,
    _sessionCtx: SessionContext,
  ): Promise<DeliveryReceipt> {
    this.writeEditorText(text);
    for (const fn of this.onChangeListeners) fn(text);
    return { accepted: true, message: 'Texto atualizado no editor do host.' };
  }

  // --- Editor helpers (also exposed publicly for the demo shell) ---

  readEditorText(): string {
    const ta = this.doc.querySelector<HTMLTextAreaElement>(EDITOR_SELECTOR);
    return ta?.value ?? '';
  }

  writeEditorText(text: string): void {
    const ta = this.doc.querySelector<HTMLTextAreaElement>(EDITOR_SELECTOR);
    if (ta) ta.value = text;
  }
}

/**
 * Auth helper. Real OAuth popups happen via `window.open` from the TOP frame
 * (browsers block popups originating from iframes). The host adapter offers
 * this capability so apps can request a popup without knowing the host.
 */
class DemoAuthHelper implements IAuthHelper {
  readonly capabilityId = 'auth' as const;
  constructor(private readonly win: Window) {}

  async openAuthPopup(
    url: string,
  ): Promise<{ readonly status: 'completed' | 'cancelled' }> {
    const popup = this.win.open(url, '_blank', 'width=600,height=700');
    if (!popup) {
      // Popup was blocked. Consider this a cancellation.
      return { status: 'cancelled' };
    }
    // Demo strategy: poll until the popup closes. A real implementation would
    // also intercept the OAuth redirect target and parse tokens (out of scope
    // for the demo host, which has no real auth server).
    return new Promise((resolve) => {
      const timer = this.win.setInterval(() => {
        if (popup.closed) {
          this.win.clearInterval(timer);
          resolve({ status: 'completed' });
        }
      }, 300);
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

// Silence unused warning for Json import (kept for type completeness).
export type { Json };

// Selector constants — kept outside the class for the test file to import.
const CASE_NUMBER_SELECTOR = SELECTORS.caseNumber;
const PARTY_SELECTOR = SELECTORS.partyList;
const MOVEMENT_SELECTOR = SELECTORS.movementList;
const EDITOR_SELECTOR = SELECTORS.editorTextarea;

/**
 * Factory: build a host adapter bound to DOM globals. Used by `entry.tsx`.
 */
export const demoHostAdapter: HostAdapter = {
  descriptor: {
    id: 'demo-host',
    name: 'Demo Host',
    urlPatterns: ['https://demo-host.local/*'],
    selectors: [SELECTORS.caseNumber],
  },
  activate(ctx: HostContext): HostCapabilities {
    return {
      case: new DemoCaseManagementSystem(ctx.document),
      document: new DemoDocumentManagementSystem(ctx.document),
      auth: new DemoAuthHelper(ctx.window),
    };
  },
};

export {
  DemoCaseManagementSystem,
  DemoDocumentManagementSystem,
  DemoAuthHelper,
  CASE_NUMBER_SELECTOR,
  PARTY_SELECTOR,
  MOVEMENT_SELECTOR,
  EDITOR_SELECTOR,
};
