/**
 * FloatingButton — small launcher button on the right edge of the viewport.
 *
 * Behaviour (agreed with the user):
 *   - Default resting size 32px; expands to 48px on hover and shows the logo.
 *   - Vertical-only drag: pointer/mouse down on the button, move up/down to
 *     change the Y position. Persists Y to storage on pointer up.
 *   - Clicking (without dragging) toggles the sidebar open/closed.
 *   - When the sidebar is open, the FloatingButton is hidden — the sidebar's
 *     own header serves as the close handle.
 *
 * Visual identity: iAgente brand on a circular button, primary colour.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type { IStorage } from '@iagente/storage';
import { STORAGE_KEYS } from '@iagente/storage';
import { usePersistedState } from '../use-persisted.js';

export interface FloatingButtonProps {
  /** Opens (or focuses) the sidebar when the user clicks (not drags). */
  readonly onOpen: () => void;
  /** Storage used to persist the vertical position. */
  readonly storage: IStorage;
}

/** Distance (in px) the pointer must move before we consider it a drag. */
const DRAG_THRESHOLD = 3;
/** Vertical padding so the button never escapes the viewport. */
const VP_PADDING = 8;

function clampY(y: number, buttonSize: number): number {
  const max = window.innerHeight - buttonSize - VP_PADDING;
  return Math.max(VP_PADDING, Math.min(y, max));
}

export const FloatingButton: FC<FloatingButtonProps> = ({ onOpen, storage }) => {
  // Resting button size; expands on hover.
  const [hovered, setHovered] = useState(false);
  const size = hovered ? 48 : 32;

  // Persisted Y position (top edge of the button).
  const [y, setY] = usePersistedState<number>(
    storage,
    STORAGE_KEYS.buttonY,
    Math.max(VP_PADDING, Math.floor((typeof window !== 'undefined' ? window.innerHeight : 800) / 2 - 16)),
  );

  // Drag state machine.
  const dragState = useRef<{
    readonly pointerId: number;
    readonly startY: number; // pointer start Y
    readonly startButtonY: number; // button Y at drag start
    moved: boolean; // crossed DRAG_THRESHOLD
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Recompute clamp on viewport resize.
  useEffect(() => {
    const onResize = () => setY((prev) => clampY(prev, size));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size, setY]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Capture so we keep receiving move events even outside the button.
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragState.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startButtonY: y,
        moved: false,
      };
    },
    [y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = dragState.current;
      if (!st || st.pointerId !== e.pointerId) return;
      const delta = e.clientY - st.startY;
      if (Math.abs(delta) > DRAG_THRESHOLD) {
        st.moved = true;
        setDragging(true);
      }
      if (st.moved) {
        setY(clampY(st.startButtonY + delta, size));
      }
    },
    [size, setY],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = dragState.current;
      if (!st) return;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      const wasDrag = st.moved;
      dragState.current = null;
      setDragging(false);
      if (!wasDrag) {
        // Pure click — toggle sidebar.
        onOpen();
      }
      // The usePersistedState already wrote each intermediate Y position; no
      // extra action needed on drop.
    },
    [onOpen],
  );

  return (
    <button
      type="button"
      aria-label="Abrir iAgente"
      className={`iagente-fab${dragging ? ' iagente-fab--dragging' : ''}`}
      style={{ top: `${y}px`, right: 0, width: `${size}px`, height: `${size}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        viewBox="0 0 24 24"
        width={size - 12}
        height={size - 12}
        aria-hidden="true"
        focusable="false"
        className="iagente-fab__logo"
      >
        {/* A simple chat-bubble-ish glyph; replace with the real iAgente logo later. */}
        <path
          d="M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H9l-5 4V5a1 1 0 011-1z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
};
