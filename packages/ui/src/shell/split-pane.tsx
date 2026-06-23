/**
 * SplitPane — the iAgente sidebar that SQUEEZES the host content (not an overlay).
 *
 * Layout strategy (agreed with the user):
 *   - The pane lives at `position: fixed; right: 0; top: 0; bottom: 0`
 *     inside the iAgente overlay's Shadow DOM.
 *   - To squeeze the host, the runtime entry also injects a `<style>` in the
 *     host `<head>` setting `body { padding-right: var(--iagente-width) }`.
 *     SplitPane exposes its width via a CSS variable so that style picks it up.
 *   - The left edge has a resize handle (cursor: col-resize). Dragging changes
 *     the width; if it drops to ≤ CLOSE_EDGE_PX, `onClose` is invoked.
 *   - Width is persisted to storage EXCEPT when below the persist threshold
 *     (the close-edge), so reloads restore the last meaningful width, not 0.
 *
 * This component is purely presentational + resize mechanics. The shell passes
 * its children (header + body).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC, ReactNode } from 'react';
import type { IStorage } from '@iagente/storage';
import { STORAGE_KEYS } from '@iagente/storage';
import { usePersistedState } from '../use-persisted.js';

export interface SplitPaneProps {
  /** Children rendered inside the pane (typically <Header/> and <Body/>). */
  readonly children: ReactNode;
  /** Storage used to persist the width. */
  readonly storage: IStorage;
  /** Asked to fully close the iAgente shell (e.g. when dragged to the close edge). */
  readonly onClose: () => void;
}

/** Width threshold (px) — drag below this triggers onClose. */
const CLOSE_EDGE_PX = 50;
/** Min/max widths in px. */
const MIN_WIDTH_PX = 280;
const MAX_WIDTH_RATIO = 0.7; // 70vw

export const SplitPane: FC<SplitPaneProps> = ({ children, storage, onClose }) => {
  // Persisted width; never persists values below the close edge.
  const [width, setWidth] = usePersistedState<number>(
    storage,
    STORAGE_KEYS.sidebarWidth,
    380,
    { shouldPersist: (next) => typeof next === 'number' && next >= MIN_WIDTH_PX },
  );

  // Clamp on viewport resize so we never overflow.
  useEffect(() => {
    const onResize = () => {
      const max = Math.floor(window.innerWidth * MAX_WIDTH_RATIO);
      setWidth((prev) => Math.max(MIN_WIDTH_PX, Math.min(prev, max)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setWidth]);

  // Resize handler state.
  const dragState = useRef<{ readonly startX: number; readonly startWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragState.current = { startX: e.clientX, startWidth: width };
      setDragging(true);
    },
    [width],
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = dragState.current;
      if (!st) return;
      const delta = st.startX - e.clientX; // drag left → grows
      const max = Math.floor(window.innerWidth * MAX_WIDTH_RATIO);
      const next = Math.max(0, Math.min(st.startWidth + delta, max));
      setWidth(next);
      if (next <= CLOSE_EDGE_PX) {
        // Trigger close on drop, not mid-drag; but unhinge cursor feedback.
      }
    },
    [setWidth],
  );

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const st = dragState.current;
      if (!st) return;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      dragState.current = null;
      setDragging(false);
      if (width <= CLOSE_EDGE_PX) {
        onClose();
      }
    },
    [width, onClose],
  );

  // Reflect current width as a CSS var on the pane root, so the runtime's
  // <body { padding-right: var(--iagente-width) }> selector picks it up.
  return (
    <div
      className={`iagente-pane${dragging ? ' iagente-pane--dragging' : ''}`}
      style={
        {
          // "--iagente-width" is read by the host-side style injected at runtime.
          ['--iagente-width' as string]: `${Math.max(width, MIN_WIDTH_PX)}px`,
          width: `var(--iagente-width)`,
        } as React.CSSProperties
      }
      role="region"
      aria-label="Painel iAgente"
    >
      <div
        className="iagente-pane__handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar painel"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      />
      <div className="iagente-pane__content">{children}</div>
    </div>
  );
};
