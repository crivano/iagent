/**
 * Handshake protocol used by the postMessage transport.
 *
 * Before RPC messages flow between iAgente and an external app (iframe/popup),
 * both sides perform a handshake to:
 * 1. Confirm the peer is an iAgente endpoint (capability advertisement).
 * 2. Validate that the peer's origin is on the allowlist.
 * 3. Exchange the list of capabilities each side offers/expects.
 */

import type { CapabilityKey } from './capabilities/index.js';

/** Magic string in handshake messages to validate the peer. */
export const IAGENTE_HANDSHAKE_MAGIC = 'iagente:handshake:v1' as const;

/** iAgente → external app: opens the channel and advertises which
 * capabilities iAgente expects to consume from the peer. */
export interface HandshakeInit {
  readonly type: typeof IAGENTE_HANDSHAKE_MAGIC;
  readonly role: 'iagente';
  /** Capabilities iAgente wants to CALL on the peer (e.g. ['ai']). */
  readonly expects: readonly CapabilityKey[];
  /**
   * Capabilities iAgente OFFERS to the peer (e.g. ['case'] when running
   * inside a case-management host). The peer may call these back.
   */
  readonly offers: readonly CapabilityKey[];
  /** Shared secret for basic anti-spoofing (optional). */
  readonly token?: string;
}

/** External app → iAgente: accepts the channel and advertises which
 * capabilities it offers and which it wants to call back on iAgente. */
export interface HandshakeAck {
  readonly type: typeof IAGENTE_HANDSHAKE_MAGIC;
  readonly role: 'app';
  /** Capabilities the app implements and accepts calls on. */
  readonly offers: readonly CapabilityKey[];
  /** Capabilities the app wants to CALL back on iAgente. */
  readonly expects: readonly CapabilityKey[];
}

export type HandshakeMessage = HandshakeInit | HandshakeAck;

export function isHandshakeInit(m: unknown): m is HandshakeInit {
  return (
    typeof m === 'object' &&
    m !== null &&
    (m as HandshakeInit).type === IAGENTE_HANDSHAKE_MAGIC &&
    (m as HandshakeInit).role === 'iagente'
  );
}

export function isHandshakeAck(m: unknown): m is HandshakeAck {
  return (
    typeof m === 'object' &&
    m !== null &&
    (m as HandshakeAck).type === IAGENTE_HANDSHAKE_MAGIC &&
    (m as HandshakeAck).role === 'app'
  );
}
