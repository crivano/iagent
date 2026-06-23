/**
 * Transport layer — abstracts the *channel* over which RPC messages flow.
 *
 * The same RPC proxy/stub code works regardless of whether messages travel
 * over `window.postMessage` (to an iframe/popup) or an in-process channel
 * (for host adapters loaded in the same JS context as the kernel).
 *
 * Implementations:
 * - PostMessageTransport: between iAgente and an external app (iframe/popup).
 * - InProcessTransport:   between kernel and host adapters in-process.
 */

import type { JsonRpcMessage } from '@iagente/protocol';

/**
 * A duplex channel for JSON-RPC messages.
 *
 * Implementations are responsible for:
 * 1. Serializing/receiving message frames.
 * 2. Origin validation and security (allowlist, handshake).
 * 3. Backpressure / connection lifecycle.
 */
export interface ITransport {
  /** A stable identifier for diagnostics. */
  readonly id: string;

  /**
   * Send a message to the peer. Rejects if the channel is closed or the peer
   * is unreachable.
   */
  send(message: JsonRpcMessage): void;

  /**
   * Subscribe to incoming messages. Returns an unsubscribe function.
   * Implementations MUST filter out non-iAgente traffic before invoking `fn`.
   */
  onMessage(fn: MessageHandler): Unsubscribe;

  /** Subscribe to channel lifecycle events. */
  onClose(fn: () => void): Unsubscribe;

  /** Cleanly close the channel and release resources. */
  close(): void;
}

export type MessageHandler = (message: JsonRpcMessage) => void;
export type Unsubscribe = () => void;

/** Transport lifecycle event types. */
export type TransportEvent = 'message' | 'close';
