import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { AppHostPanel, __iframeCache } from './app-host-panel.js';
import type { AppDescriptor, LaunchContext, SessionHandle } from '@iagente/protocol';

const session: SessionHandle = {
  sessionId: 'sess-1',
  status: 'ready',
  intents: [{ intent: 'summarize', label: 'Resumir', category: 'ai' }],
};
const ctx: LaunchContext = {
  intent: 'summarize',
  user: { id: 'u', name: 'T' },
};

describe('AppHostPanel — placeholder states', () => {
  beforeEach(() => {
    __iframeCache.clear();
  });

  it('renders a placeholder when no app is selected', () => {
    const { getByRole } = render(
      <AppHostPanel app={null} ctx={null} session={null} />,
    );
    expect(getByRole('status').textContent).toContain('Selecione um app');
  });

  it('renders a headless app notice', () => {
    const app: AppDescriptor = {
      id: 'h',
      name: 'Headless Worker',
      categories: ['utility'],
      capability: 'ai',
      ui: { type: 'headless' },
      createAssistant: () => ({ capabilityId: 'ai', listIntents: async () => [], beginSession: async () => session, endSession: async () => {} }),
    };
    const { getByRole } = render(<AppHostPanel app={app} ctx={ctx} session={session} />);
    expect(getByRole('status').textContent).toContain('Headless Worker');
  });
});

describe('AppHostPanel — react host', () => {
  beforeEach(() => {
    __iframeCache.clear();
  });

  it('renders the app react root when ctx+session are present', () => {
    const app: AppDescriptor = {
      id: 'nps',
      name: 'Avaliar',
      categories: ['feedback'],
      capability: 'feedback',
      ui: {
        type: 'react',
        root: (props) => (
          <div>
            <span>Form-NPS</span>
            <button onClick={() => props.callHost('feedback')}>submit</button>
          </div>
        ),
      },
      createAssistant: () => ({ capabilityId: 'feedback', listIntents: async () => [], beginSession: async () => session, endSession: async () => {} }),
    };
    const { getByText } = render(<AppHostPanel app={app} ctx={ctx} session={session} />);
    expect(getByText('Form-NPS')).toBeTruthy();
  });

  it('shows a pending state when ctx/session are missing', () => {
    const app: AppDescriptor = {
      id: 'nps',
      name: 'Avaliar',
      categories: ['feedback'],
      capability: 'feedback',
      ui: { type: 'react', root: () => <span>x</span> },
      createAssistant: () => ({ capabilityId: 'feedback', listIntents: async () => [], beginSession: async () => session, endSession: async () => {} }),
    };
    const { getByRole } = render(<AppHostPanel app={app} ctx={null} session={null} />);
    expect(getByRole('status').textContent).toContain('aguardando');
  });
});

describe('AppHostPanel — iframe host', () => {
  beforeEach(() => {
    __iframeCache.clear();
  });

  it('renders an <iframe> with src from urlBuilder once a session exists', async () => {
    const app: AppDescriptor = {
      id: 'apoia',
      name: 'Apoia',
      categories: ['ai'],
      capability: 'ai',
      ui: {
        type: 'iframe',
        urlBuilder: () => 'https://apoia.pdpj.jus.br/sidekick',
        allowedOrigins: ['https://apoia.pdpj.jus.br'],
      },
      createAssistant: () => ({ capabilityId: 'ai', listIntents: async () => [], beginSession: async () => session, endSession: async () => {} }),
    };
    const { container } = render(<AppHostPanel app={app} ctx={null} session={session} />);
    // Wait for useEffect to fire and set src.
    await waitFor(() => {
      const iframe = container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute('src')).toBe('https://apoia.pdpj.jus.br/sidekick');
    });
  });

  it('does not render the iframe before a session exists', () => {
    const app: AppDescriptor = {
      id: 'apoia',
      name: 'Apoia',
      categories: ['ai'],
      capability: 'ai',
      ui: {
        type: 'iframe',
        urlBuilder: () => 'https://apoia.pdpj.jus.br/sidekick',
        allowedOrigins: ['https://apoia.pdpj.jus.br'],
      },
      createAssistant: () => ({ capabilityId: 'ai', listIntents: async () => [], beginSession: async () => session, endSession: async () => {} }),
    };
    const { container } = render(<AppHostPanel app={app} ctx={null} session={null} />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('caches the iframe element in __iframeCache by app id', async () => {
    const app: AppDescriptor = {
      id: 'apoia',
      name: 'Apoia',
      categories: ['ai'],
      capability: 'ai',
      ui: {
        type: 'iframe',
        urlBuilder: () => 'https://apoia.pdpj.jus.br/sidekick',
        allowedOrigins: ['https://apoia.pdpj.jus.br'],
      },
      createAssistant: () => ({ capabilityId: 'ai', listIntents: async () => [], beginSession: async () => session, endSession: async () => {} }),
    };
    const { unmount } = render(<AppHostPanel app={app} ctx={null} session={session} />);
    await waitFor(() => expect(__iframeCache.get('apoia')).toBeDefined());
    const firstIframe = __iframeCache.get('apoia');
    expect(firstIframe).toBeDefined();

    // Unmount then re-render the same app — iframe element should be reused.
    unmount();
    render(<AppHostPanel app={app} ctx={null} session={session} />);
    await waitFor(() => expect(__iframeCache.get('apoia')).toBe(firstIframe));
  });

  it('fires onIframeReady when the iframe load event fires', async () => {
    const app: AppDescriptor = {
      id: 'apoia',
      name: 'Apoia',
      categories: ['ai'],
      capability: 'ai',
      ui: {
        type: 'iframe',
        urlBuilder: () => 'https://apoia.pdpj.jus.br/sidekick',
        allowedOrigins: ['https://apoia.pdpj.jus.br'],
      },
      createAssistant: () => ({ capabilityId: 'ai', listIntents: async () => [], beginSession: async () => session, endSession: async () => {} }),
    };
    let loadEvents = 0;
    const { container } = render(
      <AppHostPanel
        app={app}
        ctx={null}
        session={session}
        onIframeReady={() => loadEvents++}
      />,
    );
    const iframe = (await waitFor(() => container.querySelector('iframe'))) as HTMLIFrameElement;
    // Simulate the iframe finishing loading.
    fireEvent.load(iframe);
    expect(loadEvents).toBe(1);
  });
});
