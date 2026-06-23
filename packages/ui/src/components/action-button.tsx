/**
 * Action — a button that can be injected into the host page (placed wherever
 * the host adapter decides) and triggers a capability call through the bus.
 *
 * Apps register actions like "Resumir", "Revisar", "Avaliar" via the
 * orchestrator; the host adapter renders them inside its UI.
 */

import type { FC, ReactNode } from 'react';

export interface ActionProps {
  readonly label: string;
  readonly onClick: () => void | Promise<void>;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  /** Variant for styling. */
  readonly variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * A styled button. Intentionally framework-light: real apps can swap it for
 * a design-system Button by re-rendering; this default keeps the package
 * dependency-free.
 */
export const ActionButton: FC<ActionProps> = ({
  label,
  onClick,
  disabled,
  icon,
  variant = 'primary',
}) => {
  return (
    <button
      type="button"
      className={`iagente-action iagente-action--${variant}`}
      disabled={disabled}
      onClick={() => {
        void onClick();
      }}
    >
      {icon ? <span className="iagente-action__icon">{icon}</span> : null}
      <span className="iagente-action__label">{label}</span>
    </button>
  );
};
