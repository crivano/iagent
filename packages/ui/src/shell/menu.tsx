/**
 * Menu — iAgente launcher menu listing all currently-registered apps grouped
 * by their declared `categories`. Clicking an item invokes `onSelectApp`.
 *
 * The menu is purely presentational; selection drives the shell -> AppHostPanel.
 */

import type { FC } from 'react';
import type { AppDescriptor } from '@iagente/protocol';

export interface MenuProps {
  /** Apps registered with iAgente, in any order. Grouped by category here. */
  readonly apps: readonly AppDescriptor[];
  /** Called with the selected app id when the user clicks an item. */
  readonly onSelectApp: (appId: string) => void;
  /** Currently-selected app id (highlighted). */
  readonly selectedAppId?: string;
}

/** Display labels for each IntentCategory. */
const CATEGORY_LABELS: Record<string, string> = {
  ai: 'Assistentes de IA',
  feedback: 'Avaliação',
  utility: 'Ferramentas',
};

const CATEGORY_ORDER = ['ai', 'feedback', 'utility'];

/** Returns apps grouped by category, in a stable order. */
function groupByCategory(
  apps: readonly AppDescriptor[],
): ReadonlyArray<readonly [string, readonly AppDescriptor[]]> {
  const groups = new Map<string, AppDescriptor[]>();
  for (const cat of CATEGORY_ORDER) groups.set(cat, []);
  for (const app of apps) {
    for (const cat of app.categories) {
      if (!groups.has(cat)) {
        // Unknown category — append at the end.
        groups.set(cat, []);
        CATEGORY_LABELS[cat] ??= cat;
      }
      groups.get(cat)!.push(app);
    }
  }
  return [...groups.entries()].filter(([, list]) => list.length > 0);
}

export const Menu: FC<MenuProps> = ({ apps, onSelectApp, selectedAppId }) => {
  const groups = groupByCategory(apps);

  if (groups.length === 0) {
    return (
      <p className="iagente-menu-empty" role="status">
        Nenhum app disponível para este sistema hospedeiro.
      </p>
    );
  }

  return (
    <nav className="iagente-menu" aria-label="Apps iAgente">
      {groups.map(([category, items]) => (
        <section key={category} className="iagente-menu__section">
          <h2 className="iagente-menu__section-title">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <ul className="iagente-menu__list">
            {items.map((app) => {
              const selected = selectedAppId === app.id;
              return (
                <li key={app.id} className="iagente-menu__item">
                  <button
                    type="button"
                    className={`iagente-menu__button${selected ? ' iagente-menu__button--selected' : ''}`}
                    onClick={() => onSelectApp(app.id)}
                    aria-pressed={selected}
                  >
                    {app.icon && (
                      <img src={app.icon} alt="" className="iagente-menu__icon" width="16" height="16" />
                    )}
                    <span className="iagente-menu__label">{app.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
};
