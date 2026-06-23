/**
 * @iagente/app-apoia — bridge to the Apoia (https://apoia.pdpj.jus.br) AI sidekick.
 *
 * Implements IAICollaborator under the new IInteractiveAssistant protocol.
 * UI lives remotely in an <iframe>; the descriptor's urlBuilder produces the
 * legacy Apoia launch URL with query-string params (process, instance, action,
 * prompt, sink-button-text, ...).
 *
 * After the iframe loads, the kernel also sends an `app.launch` JSON-RPC
 * handshake with the structured LaunchContext — covering BOTH the legacy
 * (URL-encoded) and the future (handshake-only) Apoia modes.
 */

import type {
  AppDescriptor,
  AppRootProps,
  IAICollaborator,
  IntentDescriptor,
  IntentCategory,
  LaunchContext,
  SessionHandle,
} from '@iagente/protocol';

const APOIA_INTENTS: readonly IntentDescriptor<
  'summarize' | 'review' | 'draft' | 'refine' | 'minuta' | 'chat'
>[] = [
  { intent: 'review', label: 'Revisar texto', category: 'ai' as IntentCategory },
  { intent: 'minuta', label: 'Minuta de sentença', category: 'ai' as IntentCategory },
  { intent: 'chat', label: 'Conversar com a IA', category: 'ai' as IntentCategory },
];

const APOIA_BASE_URL = 'https://apoia.pdpj.jus.br';

let nextSessionId = 0;

/**
 * URL builder for the Apoia iframe. Reproduces the URL format used in the
 * reference Next.js integration:
 *
 *   https://apoia.pdpj.jus.br/auth/keycloak-iframe?redirect=/sidekick?process=X%26instance=Y%26action=Z
 *
 * The Apoia expects its query params URL-encoded AS A SINGLE STRING inside
 * the redirect param (`%26` instead of `&`).
 *
 * Real context is ALSO delivered via `app.launch` JSON-RPC handshake once the
 * iframe finishes loading, so urlBuilder can be skipped by apps targeting the
 * new protocol only.
 */
export function buildApoiaUrl(ctx: LaunchContext): string {
  const params = new URLSearchParams();

  // The case number from the host (CNJ format).
  const processNumber = ctx.case?.number ?? '';
  if (processNumber) params.set('process', processNumber);

  // instance: 'primeiro-grau' by default; can be overridden via ctx.extra.
  const instance =
    (ctx.extra?.instance as string | undefined) ?? 'primeiro-grau';
  params.set('instance', instance);

  // action: 'processo_selecionar' by default.
  const action = (ctx.extra?.action as string | undefined) ?? 'processo_selecionar';
  params.set('action', action);

  // Optional prompt: selects an Apoia feature (revisao-de-texto, minuta-de-sentenca, ...).
  if (ctx.intent === 'review') params.set('prompt', 'revisao-de-texto');
  else if (ctx.intent === 'minuta') params.set('prompt', 'minuta-de-sentenca');
  else if (ctx.intent === 'chat') params.set('prompt', 'chat');

  // If a `prompt` was explicitly provided via ctx.extra, prefer it.
  const explicitPrompt = ctx.extra?.prompt as string | undefined;
  if (explicitPrompt) params.set('prompt', explicitPrompt);

  // The reference integration uses `%26` to encode the `&` separators inside
  // the value of the single `redirect` param. Apoia parses them on its side.
  const redirectValue = `/sidekick?${params.toString().replace(/&/g, '%26')}`;
  return `${APOIA_BASE_URL}/auth/keycloak-iframe?redirect=${redirectValue}`;
}

/**
 * Apoia assistant.
 *
 * `beginSession` is mostly a marker: the heavy work — auth dance, source/sink
 * negotiation — happens via the host capabilities (host.readCurrentContent,
 * host.getSinkConfig, host.deliverResult) once the iframe is ready. The
 * assistant itself only needs to populate the SessionHandle.
 */
export class ApoiaAssistant implements IAICollaborator {
  readonly capabilityId = 'ai' as const;

  async listIntents() {
    return APOIA_INTENTS;
  }

  async beginSession(
    _intent:
      | 'summarize'
      | 'review'
      | 'draft'
      | 'refine'
      | 'minuta'
      | 'chat',
    _ctx: LaunchContext,
  ): Promise<SessionHandle> {
    return {
      sessionId: `apoia-${++nextSessionId}`,
      status: 'starting',
      intents: APOIA_INTENTS,
    };
  }

  async endSession(): Promise<void> {}
}

/** AppDescriptor the kernel registers via registerApp(bus, registry, apoiaApp). */
export const apoiaApp: AppDescriptor = {
  id: 'apoia',
  name: 'Apoia',
  categories: ['ai' as IntentCategory],
  capability: 'ai',
  icon: `${APOIA_BASE_URL}/favicon.ico`,
  ui: {
    type: 'iframe',
    urlBuilder: buildApoiaUrl,
    allowedOrigins: [APOIA_BASE_URL],
    handshakeOnly: false,
  },
  priority: 10, // Apoia is the recommended default IA when registered
  createAssistant: () => new ApoiaAssistant(),
};

// Ensure AppRootProps is referenced for type exports (no runtime cost).
export type { AppRootProps };
