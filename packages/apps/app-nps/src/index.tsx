/**
 * @iagente/app-nps — example of a React-bundled app.
 *
 * Implements IFeedbackCollector under the new interactive-assistant protocol:
 *   - listIntents() advertises 'collect-feedback'
 *   - beginSession(...) marks the session as ready; the form UI is rendered
 *     by {@link NpsRoot} inside the iAgente sidebar.
 *
 * Demonstrates the `'react'` UI mode: no iframe, no postMessage. The component
 * obtains host capabilities via the `callHost` prop injected by AppHostPanel.
 */

import type {
  AppDescriptor,
  AppRootProps,
  IFeedbackCollector,
  IntentDescriptor,
  IntentCategory,
  LaunchContext,
  SessionHandle,
} from '@iagente/protocol';
import { useState } from 'react';
import type { FC } from 'react';

const NPS_INTENTS: readonly IntentDescriptor<'collect-feedback'>[] = [
  {
    intent: 'collect-feedback',
    label: 'Avaliar o sistema',
    category: 'feedback' as IntentCategory,
  },
];

let nextSessionId = 0;

/**
 * NPS assistant. Mostly holds session bookkeeping — the actual UI lives in
 * {@link NpsRoot}, which the shell renders when this assistant's session
 * becomes visible.
 */
export class NpsAssistant implements IFeedbackCollector {
  readonly capabilityId = 'feedback' as const;

  async listIntents(): Promise<readonly IntentDescriptor<'collect-feedback'>[]> {
    return NPS_INTENTS;
  }

  async beginSession(
    _intent: 'collect-feedback',
    _ctx: LaunchContext,
  ): Promise<SessionHandle> {
    return {
      sessionId: `nps-${++nextSessionId}`,
      status: 'ready',
      intents: NPS_INTENTS,
    };
  }

  async endSession(): Promise<void> {}
}

/**
 * The React root rendered by AppHostPanel. Self-contained form: scale 0–10,
 * optional comment, submit. On submit, attempts to log/dispatch the result.
 *
 * In a real deployment this would call `props.callHost('feedback')` or POST
 * to an NPS endpoint. For this example we capture and bubble the result via
 * the onChange prop.
 */
export interface NpsRootProps extends AppRootProps {}

export const NpsRoot: FC<NpsRootProps> = (props: NpsRootProps) => {
  void props;
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div role="status" className="nps-submitted">
        <p>Obrigado pela sua avaliação!</p>
        {rating !== null && <p>Você notou o sistema com <strong>{rating}/10</strong>.</p>}
      </div>
    );
  }

  const handleSubmit = () => {
    if (rating === null) return;
    setSubmitted(true);
    // Real apps would send this somewhere; here we just toggle state.
  };

  return (
    <form
      className="nps-form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h3>Como você avalia o sistema hospedeiro?</h3>
      <div className="nps-scale" role="radiogroup" aria-label="Nota NPS">
        {Array.from({ length: 11 }, (_, n) => n).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            className={`nps-scale__btn${rating === n ? ' nps-scale__btn--selected' : ''}`}
            onClick={() => setRating(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        className="nps-comment"
        placeholder="Comentário (opcional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button type="submit" className="nps-submit" disabled={rating === null}>
        Enviar
      </button>
    </form>
  );
};

/**
 * Descriptor used by `registerApp(bus, registry, npsApp)`.
 */
export const npsApp: AppDescriptor = {
  id: 'nps',
  name: 'Avaliar sistema',
  categories: ['feedback' as IntentCategory],
  capability: 'feedback',
  ui: {
    type: 'react',
    root: NpsRoot as (props: AppRootProps) => unknown,
  },
  createAssistant: () => new NpsAssistant(),
};
