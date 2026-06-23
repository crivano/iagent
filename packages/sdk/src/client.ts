/**
 * @iagente/app-sdk — the SDK external apps (Apoia, NPS, …) import to talk to
 * iAgente over postMessage.
 *
 * Two halves:
 *
 * 1. `connect({ allowedOrigins })` → returns a client with:
 *    - `host`: typed proxy for whichever HOST capability iAgente is offering
 *      (ICaseManagementSystem, IDocumentManagementSystem, …).
 *    - `context`: async getter for the launch context (user/doc/case).
 *    - `close()`: tear down the transport.
 *
 * 2. `serve(impl, { allowedOrigins, namespace })` → registers one of the app's
 *    capability interfaces (IAICollaborator, IFeedbackCollector, …) for iAgente
 *    to call via JSON-RPC. Returns a disposer.
 *
 * Together this implements the same proxy/stub mechanism as the kernel, but
 * from the app's side of the postMessage bridge.
 */

import type {
  CapabilityCatalog,
  CapabilityKey,
  CapabilityOf,
  ContextPayload,
} from '@iagente/protocol';
import { CAPABILITY_NAMESPACES } from '@iagente/protocol';
import {
  createPostMessageTransport,
  createRpcProxy,
  createRpcStub,
} from '@iagente/rpc';

/** Resolves the namespace string for a capability key. */
function namespaceOf(key: CapabilityKey): string {
  return CAPABILITY_NAMESPACES[key];
}

export interface ConnectOptions {
  /**
   * Origins we accept messages from. By default, only the parent window's
   * origin (iAgente) is trusted.
   */
  readonly allowedOrigins?: readonly string[];
  /**
   * The window to use as the message source. Defaults to globalThis.
   * Override for tests.
   */
  readonly sourceWindow?: Window;
  /** The peer window. Defaults to window.parent (apps run in iframes). */
  readonly targetWindow?: Window;
}

/** Connection to iAgente from an external app. */
export interface IagenteConnection {
  /**
   * Returns a typed proxy for the host capability `K`. The capability must be
   * OFFERED by iAgente (declared via handshake / orchestrator setup).
   *
   * Use it as: connection.host("case").getOpenCase(ctx)
   */
  host<K extends CapabilityKey>(key: K): CapabilityOf<K>;
  /** Convenience: alias for host() to read better in some call sites. */
  capability<K extends CapabilityKey>(key: K): CapabilityOf<K>;
  /** Tear down the connection. */
  close(): void;
}

/**
 * Connects to iAgente. Returns a client whose `.host(key)` method yields typed
 * proxies for whatever capabilities iAgente is offering.
 *
 * Use this from inside an external app's iframe/popup.
 *
 * Example:
 *   const conn = connect();
 *   const cms = conn.host("case");
 *   const openCase = await cms.getOpenCase(ctx);
 */
export function connect(opts: ConnectOptions = {}): IagenteConnection {
  const win = opts.sourceWindow ?? window;
  const transport = createPostMessageTransport({
    allowedOrigins: opts.allowedOrigins ?? '*',
    sourceWindow: win,
    targetWindow: opts.targetWindow ?? win.parent,
  });

  return {
    host<K extends CapabilityKey>(key: K): CapabilityOf<K> {
      return createRpcProxy<CapabilityOf<K>>(transport, namespaceOf(key));
    },
    capability<K extends CapabilityKey>(key: K): CapabilityOf<K> {
      return createRpcProxy<CapabilityOf<K>>(transport, namespaceOf(key));
    },
    close() {
      transport.close();
    },
  };
}

export interface ServeOptions {
  /** Origins allowed to call the app (iAgente only, typically). */
  readonly allowedOrigins?: readonly string[];
  readonly sourceWindow?: Window;
  readonly targetWindow?: Window;
}

/**
 * Exposes a capability implementation on the postMessage bridge for iAgente
 * (and the host, indirectly) to call.
 *
 * @example
 *   class MyAI implements IAICollaborator { async summarize(...) {...} }
 *   const stop = serve(new MyAI(), 'ai');
 */
export function serve<T extends object>(
  impl: T,
  namespace: string,
  opts: ServeOptions = {},
): () => void {
  const win = opts.sourceWindow ?? window;
  const transport = createPostMessageTransport({
    allowedOrigins: opts.allowedOrigins ?? '*',
    sourceWindow: win,
    targetWindow: opts.targetWindow ?? win.parent,
  });
  return createRpcStub(impl, namespace, transport);
}

// Re-export catalogue helpers so apps can typecheck against `key`.
export type { CapabilityCatalog, CapabilityKey, CapabilityOf, ContextPayload };
