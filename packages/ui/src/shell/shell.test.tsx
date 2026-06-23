import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { FloatingButton } from './floating-button.js';
import { SplitPane } from './split-pane.js';
import { IagenteShell } from './iagente-shell.js';
import { createInMemoryStorage, STORAGE_KEYS } from '@iagente/storage';

// jsdom's PointerEvent global is polyfilled in test-setup.ts.
// fireEvent.pointer* picks it up correctly and wraps acts.

describe('FloatingButton', () => {
  it('renders a button with aria-label "Abrir iAgente"', () => {
    const storage = createInMemoryStorage();
    const { getByRole } = render(<FloatingButton onOpen={() => {}} storage={storage} />);
    expect(getByRole('button', { name: /abrir iagente/i })).toBeTruthy();
  });

  it('calls onOpen when clicked (pointer down+up without drag)', () => {
    const storage = createInMemoryStorage();
    let opens = 0;
    const { getByRole } = render(<FloatingButton onOpen={() => opens++} storage={storage} />);
    const btn = getByRole('button');
    fireEvent.pointerDown(btn, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(btn, { clientY: 100, pointerId: 1 });
    expect(opens).toBe(1);
  });

  it('does NOT call onOpen when the pointer moved past the drag threshold', () => {
    const storage = createInMemoryStorage();
    let opens = 0;
    const { getByRole } = render(<FloatingButton onOpen={() => opens++} storage={storage} />);
    const btn = getByRole('button');
    fireEvent.pointerDown(btn, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(btn, { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(btn, { clientY: 200, pointerId: 1 });
    expect(opens).toBe(0);
  });

  it('persists the dragged Y position to storage', () => {
    const storage = createInMemoryStorage();
    const { getByRole } = render(<FloatingButton onOpen={() => {}} storage={storage} />);
    const btn = getByRole('button');
    fireEvent.pointerDown(btn, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(btn, { clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(btn, { clientY: 250, pointerId: 1 });
    const stored = storage.get<number>(STORAGE_KEYS.buttonY);
    expect(typeof stored).toBe('number');
  });
});

describe('SplitPane', () => {
  it('renders children inside the pane', () => {
    const storage = createInMemoryStorage();
    const { getByText } = render(
      <SplitPane storage={storage} onClose={() => {}}>
        <div>body content</div>
      </SplitPane>,
    );
    expect(getByText('body content')).toBeTruthy();
  });

  it('exposes a resize separator handle', () => {
    const storage = createInMemoryStorage();
    const { getByRole } = render(
      <SplitPane storage={storage} onClose={() => {}}>
        <div>x</div>
      </SplitPane>,
    );
    expect(getByRole('separator')).toBeTruthy();
  });

  it('persists width on a normal resize (still above close edge)', () => {
    const storage = createInMemoryStorage();
    const { getByRole } = render(
      <SplitPane storage={storage} onClose={() => {}}>
        <div>x</div>
      </SplitPane>,
    );
    const handle = getByRole('separator');
    // Default width 380. Pane is anchored right; dragging the LEFT edge RIGHT-ward
    // (handle moves from x=380 to x=480) makes the pane NARROWER by 100 → 280.
    fireEvent.pointerDown(handle, { clientX: 380, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 480, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 480, pointerId: 1 });
    expect(storage.get<number>(STORAGE_KEYS.sidebarWidth)).toBe(280);
  });

  it('calls onClose when dragged below the close edge (≤ 50px)', () => {
    const storage = createInMemoryStorage();
    let closes = 0;
    const { getByRole } = render(
      <SplitPane storage={storage} onClose={() => closes++}>
        <div>x</div>
      </SplitPane>,
    );
    const handle = getByRole('separator');
    // Drag the LEFT edge far to the RIGHT past the close edge: handle right
    // moves from 380 toward 1000, shrinking the pane below CLOSE_EDGE_PX.
    fireEvent.pointerDown(handle, { clientX: 380, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 1000, pointerId: 1 });
    expect(closes).toBe(1);
  });

  it('does NOT persist width when dragged below the close edge', () => {
    const storage = createInMemoryStorage();
    const { getByRole } = render(
      <SplitPane storage={storage} onClose={() => {}}>
        <div>x</div>
      </SplitPane>,
    );
    const handle = getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 380, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 1000, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 1000, pointerId: 1 });
    // shouldPersist rejected ALL writes during this drag (every value was
    // below CLOSE_EDGE_PX < MIN_WIDTH_PX), so storage is untouched.
    expect(storage.get<number>(STORAGE_KEYS.sidebarWidth)).toBeUndefined();
  });
});

describe('IagenteShell', () => {
  it('renders only the FloatingButton when initially closed', () => {
    const storage = createInMemoryStorage();
    const { queryByRole, getByRole } = render(
      <IagenteShell storage={storage} title="Test" renderBody={() => null} initialOpen={false} />,
    );
    expect(getByRole('button', { name: /abrir iagente/i })).toBeTruthy();
    expect(queryByRole('region')).toBeNull();
  });

  it('renders the pane with header + body when initially open', () => {
    const storage = createInMemoryStorage();
    const { getByText, getByRole } = render(
      <IagenteShell
        storage={storage}
        title="iAgente — demo-host"
        renderBody={() => <div>menu placeholder</div>}
        initialOpen={true}
      />,
    );
    expect(getByText('iAgente — demo-host')).toBeTruthy();
    expect(getByText('menu placeholder')).toBeTruthy();
    expect(getByRole('button', { name: /fechar iagente/i })).toBeTruthy();
  });

  it('the close button hides the pane and re-shows the floating button', async () => {
    const storage = createInMemoryStorage();
    const { getByRole, queryByRole } = render(
      <IagenteShell storage={storage} title="t" renderBody={() => null} initialOpen={true} />,
    );
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /fechar iagente/i }));
    });
    expect(queryByRole('region')).toBeNull();
    expect(getByRole('button', { name: /abrir iagente/i })).toBeTruthy();
  });

  it('opening the shell via FAB triggers onOpen, then closing fires onClose', async () => {
    const storage = createInMemoryStorage();
    let opens = 0;
    let closes = 0;
    const { getByRole } = render(
      <IagenteShell
        storage={storage}
        title="t"
        renderBody={() => null}
        initialOpen={false}
        onOpen={() => opens++}
        onClose={() => closes++}
      />,
    );
    // Open by clicking the FAB.
    const fab = getByRole('button', { name: /abrir iagente/i });
    await act(async () => {
      fireEvent.pointerDown(fab, { clientY: 100, pointerId: 1 });
      fireEvent.pointerUp(fab, { clientY: 100, pointerId: 1 });
    });
    expect(opens).toBe(1);

    // Close button.
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /fechar iagente/i }));
    });
    expect(closes).toBe(1);
  });
});
