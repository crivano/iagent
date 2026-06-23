import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  demoHostAdapter,
  DemoAuthHelper,
  DemoCaseManagementSystem,
  DemoDocumentManagementSystem,
  EDITOR_SELECTOR,
} from './index.js';

// Attribute/constant conventions used in the host DOM.
const CASE_NUMBER_ATTR = 'data-demo-case-number';
const PARTY_ATTR = 'data-demo-party';
const MOVEMENT_ATTR = 'data-demo-movement';
const EDITOR_ATTR = 'data-demo-editor'; // matches SELECTORS.editorTextarea

const PARTY_NAME_LEFT = 'João';
const PARTY_NAME_RIGHT = 'Maria';
const MOVEMENT_DATE = '2024-01-15';
const MOVEMENT_DESC = 'Despacho';

const mkDoc = (caseNumber?: string, text = ''): Document => {
  const html = `<body>
    ${caseNumber ? `<span ${CASE_NUMBER_ATTR}="${caseNumber}" data-demo-title="Proc ${caseNumber}">Número: ${caseNumber}</span>` : ''}
    <div ${PARTY_ATTR}="${PARTY_NAME_LEFT}" data-demo-name="${PARTY_NAME_LEFT}" data-demo-role="autor">Autor</div>
    <div ${PARTY_ATTR}="${PARTY_NAME_RIGHT}" data-demo-name="${PARTY_NAME_RIGHT}" data-demo-role="réu">Réu</div>
    <div ${MOVEMENT_ATTR} data-demo-date="${MOVEMENT_DATE}">${MOVEMENT_DESC}</div>
    <textarea ${EDITOR_ATTR}>${text}</textarea>
  </body>`;
  return new JSDOM(html).window.document;
};

const fakeWindow = () => ({}) as unknown as Window;

describe('demoHostAdapter — descriptor and detection', () => {
  it('declares the right URL pattern and selectors', () => {
    expect(demoHostAdapter.descriptor.urlPatterns).toEqual(['https://demo-host.local/*']);
    expect(demoHostAdapter.descriptor.selectors).toBeDefined();
  });

  it('activate() returns case, document, and auth capabilities', () => {
    const doc = mkDoc('0001-23.456');
    const ctx = { document: doc, window: fakeWindow(), url: 'https://demo-host.local/case/1' };
    const caps = demoHostAdapter.activate(ctx);
    expect(caps.case).toBeInstanceOf(DemoCaseManagementSystem);
    expect(caps.document).toBeInstanceOf(DemoDocumentManagementSystem);
    expect(caps.auth).toBeInstanceOf(DemoAuthHelper);
  });
});

describe('DemoCaseManagementSystem — DOM-backed capability', () => {
  it('reads the open case from the DOM', async () => {
    const doc = mkDoc('0001-99.2024');
    const cms = new DemoCaseManagementSystem(doc);
    const ctx = { user: { id: 'u1', name: 'T' } };
    const openCase = await cms.getOpenCase(ctx);
    expect(openCase?.number).toBe('0001-99.2024');
    expect(openCase?.title).toBe('Proc 0001-99.2024');
  });

  it('returns null when no case is open', async () => {
    const doc = mkDoc(); // no case number
    const cms = new DemoCaseManagementSystem(doc);
    expect(await cms.getOpenCase({ user: { id: 'u', name: 't' } })).toBeNull();
  });

  it('reads parties from the DOM', async () => {
    const doc = mkDoc();
    const cms = new DemoCaseManagementSystem(doc);
    const parties = await cms.getParties({ user: { id: 'u', name: 't' } });
    expect(parties.map((p) => p.name)).toEqual([PARTY_NAME_LEFT, PARTY_NAME_RIGHT]);
  });

  it('reads movements from the DOM', async () => {
    const doc = mkDoc();
    const cms = new DemoCaseManagementSystem(doc);
    const mvts = await cms.getMovements({ user: { id: 'u', name: 't' } });
    expect(mvts[0]?.date).toBe(MOVEMENT_DATE);
    expect(mvts[0]?.description).toBe(MOVEMENT_DESC);
  });
});

describe('DemoDocumentManagementSystem — session-scoped capabilities', () => {
  const sessionCtx = {
    sessionId: 'sess-1',
    intent: 'review' as const,
    user: { id: 'u', name: 'test' },
  };

  it('reads and writes the editor textarea', () => {
    const doc = mkDoc('x', 'original text');
    const dms = new DemoDocumentManagementSystem(doc);
    expect(dms.readEditorText()).toBe('original text');
    dms.writeEditorText('reviewed by ai');
    expect(dms.readEditorText()).toBe('reviewed by ai');
  });

  it('getOpenDocument returns a ref when an editor exists', async () => {
    const doc = mkDoc();
    const dms = new DemoDocumentManagementSystem(doc);
    const ref = await dms.getOpenDocument({ user: { id: 'u', name: 't' } });
    expect(ref?.id).toBe('demo-editor');
  });

  it('readCurrentContent returns HTML/plainText snapshots of the editor', async () => {
    const doc = mkDoc('x', 'hello world');
    const dms = new DemoDocumentManagementSystem(doc);
    const content = await dms.readCurrentContent(sessionCtx);
    expect(content.plainText).toBe('hello world');
    expect(content.html).toContain('hello world');
    expect(content.selectionInfo?.endOffset).toBe(11);
  });

  it('getSinkConfig returns a "to-parent" sink with a button label', async () => {
    const doc = mkDoc();
    const dms = new DemoDocumentManagementSystem(doc);
    const sink = await dms.getSinkConfig(sessionCtx);
    expect(sink.kind).toBe('to-parent');
    expect(sink.buttonText).toBeDefined();
  });

  it('deliverResult writes back into the editor and returns accepted', async () => {
    const doc = mkDoc('x', 'original');
    const dms = new DemoDocumentManagementSystem(doc);
    const receipt = await dms.deliverResult('reviewed text', sessionCtx);
    expect(receipt.accepted).toBe(true);
    expect(dms.readEditorText()).toBe('reviewed text');
  });

  it('uses the EDITOR_SELECTOR constant exported from the package', () => {
    expect(EDITOR_SELECTOR).toBe('[data-demo-editor]');
  });
});

describe('DemoAuthHelper — popup capability at the top frame', () => {
  it('returns cancelled when window.open returns null (popup blocked)', async () => {
    const blocked = {
      open: () => null,
    } as unknown as Window;
    const auth = new DemoAuthHelper(blocked);
    const result = await auth.openAuthPopup('https://example/auth');
    expect(result.status).toBe('cancelled');
  });
});
