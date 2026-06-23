/**
 * InProcessTransport — a synchronous, in-memory transport for adapters that
 * live in the SAME JavaScript context as their peer (e.g. host adapters
 * running inside the kernel bundle).
 *
 * Two endpoints are paired at construction; sending on one delivers to the
 * other's `onMessage` subscribers. This is primarily used for testing and for
 * kernel↔host-adapter wiring.
 *
 * For external apps (iframes/popups) use PostMessageTransport instead.
 */

import type { JsonRpcMessage } from '@iagente/protocol';
import type { ITransport, MessageHandler, Unsubscribe } from '../transport.js';

/** Creates a pair of connected InProcessTransports (call them `a` and `b`). */
export function createInProcessTransportPair(): [InProcessTransport, InProcessTransport] {
  let aHandlers: MessageHandler[] = [];
  let bHandlers: MessageHandler[] = [];
  let closed = false;

  const makeChannel = (
    id: string,
    inbox: () => MessageHandler[],
    deliver: (m: JsonRpcMessage) => void,
  ): InProcessTransport => ({
    id,
    send(message) {
      if (closed) throw new Error(`Transport ${id} is closed`);
      // Defer delivery to mimic async postMessage semantics.
      queueMicrotask(() => deliver(message));
    },
    onMessage(fn) {
      inbox().push(fn);
      return () => {
        const arr = inbox();
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
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
      for (const fn of closeHandlers) fn();
    },
  });

  const closeHandlers: (() => void)[] = [];

  const a: InProcessTransport = makeChannel(
    'in-process:a',
    () => aHandlers,
    (m) => bHandlers.forEach((fn) => fn(m)),
  );
  const b: InProcessTransport = makeChannel(
    'in-process:b',
    () => bHandlers,
    (m) => aHandlers.forEach((fn) => fn(m)),
  );
  return [a, b];
}

export type InProcessTransport = ITransport;
export type { Unsubscribe };
