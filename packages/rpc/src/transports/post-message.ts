/**
 * PostMessageTransport — JSON-RPC over `window.postMessage`.
 *
 * Used between iAgente (in the host page) and an external app running in an
 * iframe or popup window. Both sides create one of these pointing at the other
 * side's `Window` and verify the peer's origin against an allowlist.
 *
 * Security notes:
 * 1. ALWAYS pass an `allowedOrigins` allowlist. Messages from any other origin
 *    are silently dropped.
 * 2. The handshake (see @iagente/protocol) should be performed BEFORE
 *    accepting RPC traffic, to confirm both sides are iAgente endpoints.
 */

import type { JsonRpcMessage } from '@iagente/protocol';
import { isRequest, isNotification, isResponse } from '@iagente/protocol';
import type { ITransport, MessageHandler } from '../transport.js';

export interface PostMessageTransportOptions {
  /**
   * Origins allowed to send to us. Messages from other origins are dropped.
   * Use the exact origin (scheme + host + port), e.g. `https://apoia.example`.
   * Use `'*'` ONLY for the OPENING side before the peer origin is known.
   */
  readonly allowedOrigins: readonly string[] | '*';
  /**
   * Target window: `contentWindow` of an iframe, or the opener/popup window.
   * Defaults to `window.parent` (useful for the iframe/app side).
   */
  readonly targetWindow?: Window;
  /** Origin to use when CALLING postMessage on the target. Defaults to '*'. */
  readonly targetOrigin?: string;
  /** Source window (for tests). Defaults to `window`. */
  readonly sourceWindow?: Window;
}

/** Sentinel marker added to every iAgente postMessage payload. */
const IAGENTE_MARKER = '__iagente__' as const;

interface WrappedPayload {
  readonly __iagente__: typeof IAGENTE_MARKER;
  readonly message: JsonRpcMessage;
}

function wrap(message: JsonRpcMessage): WrappedPayload {
  return { __iagente__: IAGENTE_MARKER, message };
}

function isWrapped(x: unknown): x is WrappedPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as { __iagente__?: unknown }).__iagente__ === IAGENTE_MARKER
  );
}

/**
 * Creates a postMessage-backed transport.
 *
 * @param opts.targetWindow The peer window. For an app: `window.parent`.
 *                          For iAgente launching an iframe: that iframe's
 *                          `contentWindow` (after handshake establishes origin).
 */
export function createPostMessageTransport(
  opts: PostMessageTransportOptions,
): ITransport {
  const self = opts.sourceWindow ?? window;
  const target = opts.targetWindow ?? self.parent;
  const targetOrigin = opts.targetOrigin ?? '*';
  const allowedOrigins = opts.allowedOrigins;
  const handlers: MessageHandler[] = [];
  const closeHandlers: Array<() => void> = [];
  let closed = false;

  const isOriginAllowed = (origin: string): boolean => {
    if (allowedOrigins === '*') return true;
    return allowedOrigins.includes(origin);
  };

  const listener = (event: MessageEvent) => {
    if (closed) return;
    if (!isWrapped(event.data)) return;
    // Verify origin for security, unless we explicitly allow '*' temporarily.
    if (allowedOrigins !== '*' && !isOriginAllowed(event.origin)) return;

    const { message } = event.data;
    // Basic structural sanity: must be a recognizable JSON-RPC message.
    if (!isRequest(message) && !isNotification(message) && !isResponse(message)) {
      return;
    }
    for (const fn of handlers) fn(message);
  };

  self.addEventListener('message', listener);

  return {
    id: `postmessage:${targetOrigin}`,
    send(message) {
      if (closed) throw new Error('PostMessageTransport is closed');
      target.postMessage(wrap(message), targetOrigin);
    },
    onMessage(fn) {
      handlers.push(fn);
      return () => {
        const i = handlers.indexOf(fn);
        if (i >= 0) handlers.splice(i, 1);
      };
    },
    onClose(fn) {
      closeHandlers.push(fn);
      return () => {
        const i = closeHandlers.indexOf(fn);
        if (i >= 0) closeHandlers.splice(i, 1);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      self.removeEventListener('message', listener);
      for (const fn of closeHandlers) fn();
    },
  };
}
