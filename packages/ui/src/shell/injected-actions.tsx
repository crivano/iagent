/**
 * InjectedActions — mounts CTAs declared by the host adapter into the HOST'S
 * document (NOT the iAgente shadow root), so they live in the natural DOM
 * flow of the page.
 *
 * Each action declares a `targetSelector` (CSS selector inside the host's
 * document) and a `placement` ('before' | 'after' | 'inside-start' |
 * 'inside-end'). The component resolves the target, inserts the button at
 * the right position, and cleans up on unmount.
 *
 * Click handler: dispatches an `iagente:launch-intent` CustomEvent on
 * `window` with the action's id/capability/intent. The IagenteShell listens
 * for this event and opens the sidebar with the corresponding app + intent
 * already preselected.
 *
 * This is intentionally framework-light: each button is a real
 * `<button class="iagente-injected-action">` in the host's document. Style
 * via the iagente-injected-action CSS class — declared in the host-side
 * stylesheet injected by the runtime.
 */

import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { InjectedAction, LaunchIntentEventDetail } from '@iagente/protocol';
import { LAUNCH_INTENT_EVENT } from '@iagente/protocol';

export interface InjectedActionsProps {
  /** CTAs declared by the active host adapter. */
  readonly actions: readonly InjectedAction[];
  /**
   * The document the buttons are injected into. Defaults to the global
   * `document` (the host's own document). Injected for tests.
   */
  readonly document?: Document;
}

/**
 * Renders the host's CTAs into the host's document. Renders nothing into
 * React's own tree — the buttons are inserted as real DOM nodes via effect.
 */
export const InjectedActions: FC<InjectedActionsProps> = ({ actions, document: doc }) => {
  const ownerDoc = doc ?? (typeof document !== 'undefined' ? document : null);
  // Track the buttons we inserted so we can clean them up on unmount or
  // when the actions list changes.
  const inserted = useRef<Array<{ btn: HTMLButtonElement; host: Node }>>([]);

  useEffect(() => {
    if (!ownerDoc) return;
    // Clean up any previously inserted buttons first.
    for (const { btn, host } of inserted.current) {
      try {
        host.removeChild(btn);
      } catch {
        // already removed
      }
    }
    inserted.current = [];

    for (const action of actions) {
      const target = ownerDoc.querySelector(action.targetSelector);
      if (!target) {
        // Target missing: skip silently. The host page may not have the
        // element yet (SPA navigation); the host adapter should re-activate
        // when the relevant UI appears.
        // eslint-disable-next-line no-console
        console.warn(
          `[iAgente] injected action "${action.id}" skipped: target selector "${action.targetSelector}" not found`,
        );
        continue;
      }

      const btn = ownerDoc.createElement('button');
      btn.type = 'button';
      btn.className = `iagente-injected-action iagente-injected-action--${action.variant ?? 'secondary'}`;
      btn.setAttribute('data-iagente-action-id', action.id);
      btn.setAttribute('data-iagente-intent', action.intent);
      btn.setAttribute('data-iagente-capability', action.capability);
      if (action.icon) {
        const icon = ownerDoc.createElement('span');
        icon.className = 'iagente-injected-action__icon';
        icon.textContent = action.icon;
        btn.appendChild(icon);
      }
      const label = ownerDoc.createElement('span');
      label.className = 'iagente-injected-action__label';
      label.textContent = action.label;
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        const detail: LaunchIntentEventDetail = {
          actionId: action.id,
          capability: action.capability,
          intent: action.intent,
        };
        ownerDoc.defaultView?.dispatchEvent(
          new CustomEvent<LaunchIntentEventDetail>(LAUNCH_INTENT_EVENT, { detail }),
        );
      });

      // Place the button at the requested position relative to the target.
      switch (action.placement) {
        case 'before':
          target.parentNode?.insertBefore(btn, target);
          inserted.current.push({ btn, host: target.parentNode! });
          break;
        case 'after':
          target.parentNode?.insertBefore(btn, target.nextSibling);
          inserted.current.push({ btn, host: target.parentNode! });
          break;
        case 'inside-start':
          target.insertBefore(btn, target.firstChild);
          inserted.current.push({ btn, host: target });
          break;
        case 'inside-end':
          target.appendChild(btn);
          inserted.current.push({ btn, host: target });
          break;
      }
    }

    return () => {
      for (const { btn, host } of inserted.current) {
        try {
          host.removeChild(btn);
        } catch {
          // already removed
        }
      }
      inserted.current = [];
    };
  }, [ownerDoc, actions]);

  // The component renders nothing in the React tree — buttons live in the
  // host's DOM. We return an empty fragment to keep React happy.
  return null;
};
