/**
 * IagenteShell — top-level React component for the iAgente overlay.
 *
 * Owns the closed/open state machine:
 *   - Closed: renders just the FloatingButton (with persisted Y).
 *   - Open: renders the SplitPane with header + body slot.
 *
 * The runtime entry is responsible for injecting the host-side CSS that makes
 * `<body>` padding-right track `--iagente-width`, plus the iAgente CSS bundle.
 * This component focuses on layout + state.
 *
 * The body content (menu / app host panel) is provided by the caller via the
 * `renderBody` prop so the shell can stay decoupled from the menu/app-host
 * implementation details (those are added in subsequent phases).
 */

import { useCallback, useState, type FC, type ReactNode } from 'react';
import type { IStorage } from '@iagente/storage';
import { STORAGE_KEYS } from '@iagente/storage';
import { FloatingButton } from './floating-button.js';
import { SplitPane } from './split-pane.js';

export interface IagenteShellProps {
  /** Storage used to persist shell preferences (button Y, width). */
  readonly storage: IStorage;
  /** Title shown in the pane header (typically "iAgente — <hostId>"). */
  readonly title: string;
  /** Renders the pane body content (menu, app host, settings). */
  readonly renderBody: () => ReactNode;
  /** Optional extra content in the header (e.g. settings cog). */
  readonly renderHeaderExtras?: () => ReactNode;
  /**
   * Called when the shell transitions from closed to open. The runtime can
   * use it to apply host-side padding. Optional.
   */
  readonly onOpen?: () => void;
  /**
   * Called when the shell closes (close button, or drag-to-close edge).
   * The runtime should remove the host-side padding here.
   */
  readonly onClose?: () => void;
  /**
   * Initial open state. Defaults to whatever the user last left it in
   * (persisted under STORAGE_KEYS.sidebarOpen).
   */
  readonly initialOpen?: boolean;
}

export const IagenteShell: FC<IagenteShellProps> = ({
  storage,
  title,
  renderBody,
  renderHeaderExtras,
  onOpen,
  onClose,
  initialOpen,
}) => {
  const persistedOpen =
    initialOpen ?? storage.getOrDefault<boolean>(STORAGE_KEYS.sidebarOpen, false);
  const [open, setOpen] = useState(persistedOpen);

  const handleOpen = useCallback(() => {
    setOpen(true);
    storage.set(STORAGE_KEYS.sidebarOpen, true);
    onOpen?.();
  }, [storage, onOpen]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // NOT setting sidebarOpen=true; we leave the persisted flag untouched
    // when closing so the next reload uses the wider pattern: closed by default
    // (matches "less intrusive" UX). If you want to remember the open state,
    // uncomment the next line.
    storage.set(STORAGE_KEYS.sidebarOpen, false);
    onClose?.();
  }, [storage, onClose]);

  if (!open) {
    return <FloatingButton onOpen={handleOpen} storage={storage} />;
  }

  return (
    <SplitPane storage={storage} onClose={handleClose}>
      <header className="iagente-pane__header">
        <span className="iagente-pane__title">{title}</span>
        <div className="iagente-pane__header-extras">
          {renderHeaderExtras?.()}
          <button
            type="button"
            className="iagente-pane__close"
            aria-label="Fechar iAgente"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>
      </header>
      <div className="iagente-pane__body">{renderBody()}</div>
    </SplitPane>
  );
};
