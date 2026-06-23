/**
 * Sidebar — the iAgente launcher panel mounted in the overlay. Shows available
 * apps and triggers their actions through the orchestrator.
 *
 * The Sidebar receives a list of "app actions" (typically produced by reading
 * the Capability Bus) and renders them. Clicking one invokes the provided
 * callback, which usually launches an app and routes a capability call.
 */

import type { FC } from 'react';
import { ActionButton } from './action-button.js';

export interface AppAction {
  /** Stable id (e.g. "ai.summarize"). */
  readonly id: string;
  readonly label: string;
  readonly icon?: React.ReactNode;
  /** Invoked when the action is triggered. */
  readonly onActivate: () => void | Promise<void>;
}

export interface SidebarProps {
  readonly title?: string;
  readonly actions: readonly AppAction[];
  /** When true, shows a spinner instead of the actions list. */
  readonly busy?: boolean;
}

export const Sidebar: FC<SidebarProps> = ({
  title = 'iAgente',
  actions,
  busy = false,
}) => {
  return (
    <aside className="iagente-sidebar" role="complementary" aria-label={title}>
      <header className="iagente-sidebar__header">
        <h1 className="iagente-sidebar__title">{title}</h1>
      </header>
      <div className="iagente-sidebar__body">
        {busy ? (
          <p className="iagente-sidebar__busy" aria-live="polite">
            Carregando…
          </p>
        ) : actions.length === 0 ? (
          <p className="iagente-sidebar__empty">Nenhuma ação disponível.</p>
        ) : (
          <ul className="iagente-sidebar__actions">
            {actions.map((a) => (
              <li key={a.id} className="iagente-sidebar__action">
                <ActionButton
                  label={a.label}
                  icon={a.icon}
                  onClick={a.onActivate}
                  variant="secondary"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};
