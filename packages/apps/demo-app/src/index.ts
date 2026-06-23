/**
 * @iagente/app-demo — a fake AI collaborator app used to validate the
 * host↔app decoupling end-to-end. In production this would be Apoia or Assis.
 *
 * Implements the new IInteractiveAssistant protocol: clients call
 * `beginSession(intent, ctx)` instead of `summarize(text)`. The session-based
 * model mirrors how the Apoia actually behaves (launch UI → user works →
 * result delivered).
 *
 * Two pieces are provided:
 *
 * 1. `DemoAICollaborator`: a pure IAICollaborator implementation. Easy to unit
 *    test without a browser.
 * 2. `startDemoApp()`: the iframe-side entrypoint that uses @iagente/app-sdk
 *    to expose DemoAICollaborator via postMessage to the iAgente kernel.
 */

import type {
  IAICollaborator,
  IntentDescriptor,
  IntentCategory,
  LaunchContext,
  SessionHandle,
} from '@iagente/protocol';

/** Intent set offered by the demo assistant. */
type DemoIntent = 'summarize' | 'review' | 'draft' | 'refine' | 'minuta' | 'chat';

/** Intents the demo assistant offers. Used to populate the menu. */
const DEMO_INTENTS: readonly IntentDescriptor<DemoIntent>[] = [
  { intent: 'summarize', label: 'Resumir (demo)', category: 'ai' as IntentCategory },
  { intent: 'review', label: 'Revisar (demo)', category: 'ai' as IntentCategory },
  { intent: 'draft', label: 'Rascunho (demo)', category: 'ai' as IntentCategory },
];

let nextSessionId = 0;

/**
 * A simplistic interactive AI implementation. NOT a real LLM — just a stub
 * that records intents and returns ready/never-completes-on-its-own sessions,
 * proving the iAgente architecture works. Apps integrated in real life would
 * (`Apoia`, `Assis`) actually render their UI inside the sandbox/shell and
 * drive `host.deliverResult(...)` when the user approves the result.
 */
export class DemoAICollaborator implements IAICollaborator {
  readonly capabilityId = 'ai' as const;

  /** Sessions started by this assistant, keyed by sessionId. */
  private readonly sessions = new Map<string, { readonly intent: DemoIntent }>();

  async listIntents(): Promise<readonly IntentDescriptor<DemoIntent>[]> {
    return DEMO_INTENTS;
  }

  async beginSession(intent: DemoIntent, ctx: LaunchContext): Promise<SessionHandle> {
    const sessionId = `demo-ai-${++nextSessionId}`;
    this.sessions.set(sessionId, { intent });
    // In the demo, the assistant is "ready" immediately. Real apps would
    // flip status to 'ready' after auth + initial data fetch.
    void ctx;
    return {
      sessionId,
      status: 'ready',
      intents: DEMO_INTENTS,
    };
  }

  async endSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

/**
 * The iframe-side entrypoint. Call this from a script running inside the demo
 * app's page (loaded in an iframe by iAgente).
 *
 * It uses the app-sdk to expose the DemoAICollaborator over postMessage.
 *
 * @returns A disposer that stops serving.
 */
export function startDemoApp(): () => void {
  // Import dynamically so that unit-testing the worker class doesn't pull in
  // a `window` dependency in non-browser contexts.
  // @iagente/app-sdk is safe to import statically in a browser context.
  return serveInternally(new DemoAICollaborator());
}

// Indirection to keep the SDK import optional-from-the-test standpoint.
import { serve } from '@iagente/app-sdk';
function serveInternally(impl: IAICollaborator): () => void {
  return serve(impl, 'ai');
}
