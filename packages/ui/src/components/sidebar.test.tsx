import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { Sidebar, type AppAction } from './sidebar.js';
import { createOverlay } from '../overlay.js';

// React 19 root.render() is async; await inside act to flush updates.
const renderIntoOverlay = async (
  overlay: ReturnType<typeof createOverlay>,
  node: React.ReactNode,
) => {
  await act(async () => {
    overlay.render(node);
  });
};

describe('createOverlay — Shadow DOM isolation', () => {
  it('attaches an open shadow root and a mount point', () => {
    const overlay = createOverlay({ css: '.x { color: red; }' });
    try {
      expect(overlay.host.tagName.toLowerCase()).toBe('iagente-overlay');
      expect(overlay.shadow).toBeInstanceOf(ShadowRoot);
      expect(overlay.shadow.mode).toBe('open');
      // Style tag is injected inside the shadow root.
      const style = overlay.shadow.querySelector('style');
      expect(style?.textContent).toContain('.x');
      // Mount point exists.
      expect(overlay.shadow.querySelector('[data-iagente-root]')).not.toBeNull();
    } finally {
      overlay.unmount();
    }
  });

  it('appends the host element to document.body', () => {
    const overlay = createOverlay();
    try {
      expect(document.body.contains(overlay.host)).toBe(true);
    } finally {
      overlay.unmount();
    }
  });

  it('removes the host element on unmount', () => {
    const overlay = createOverlay();
    overlay.unmount();
    expect(document.body.contains(overlay.host)).toBe(false);
  });
});

describe('Sidebar', () => {
  it('renders the title and provided actions', async () => {
    const overlay = createOverlay();
    try {
      const actions: AppAction[] = [
        { id: 'ai.summarize', label: 'Resumir', onActivate: () => {} },
        { id: 'feedback.collect', label: 'Avaliar', onActivate: () => {} },
      ];
      await renderIntoOverlay(overlay, <Sidebar title="Teste" actions={actions} />);

      // Title
      expect(overlay.shadow.textContent).toContain('Teste');
      // Both action labels
      expect(overlay.shadow.textContent).toContain('Resumir');
      expect(overlay.shadow.textContent).toContain('Avaliar');
    } finally {
      overlay.unmount();
    }
  });

  it('shows an empty state when no actions are available', async () => {
    const overlay = createOverlay();
    try {
      await renderIntoOverlay(overlay, <Sidebar actions={[]} />);
      expect(overlay.shadow.textContent).toContain('Nenhuma ação disponível.');
    } finally {
      overlay.unmount();
    }
  });

  it('shows a busy state when busy=true (overriding actions)', async () => {
    const overlay = createOverlay();
    try {
      const actions: AppAction[] = [
        { id: 'x', label: 'Real', onActivate: () => {} },
      ];
      await renderIntoOverlay(overlay, <Sidebar actions={actions} busy />);
      // Busy text replaces actions list.
      expect(overlay.shadow.textContent).toContain('Carregando…');
      // The action label is hidden because we are busy.
      expect(overlay.shadow.textContent).not.toContain('Real');
    } finally {
      overlay.unmount();
    }
  });

  it('invokes the onActivate callback when a button is clicked', async () => {
    const overlay = createOverlay();
    try {
      let clicked = 0;
      const actions: AppAction[] = [
        { id: 'x', label: 'Clique', onActivate: () => { clicked++; } },
      ];
      await renderIntoOverlay(overlay, <Sidebar actions={actions} />);
      const btn = overlay.shadow.querySelector('button')!;
      await act(async () => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(clicked).toBe(1);
    } finally {
      overlay.unmount();
    }
  });
});
