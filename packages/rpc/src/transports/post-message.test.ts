import { describe, it, expect, vi } from 'vitest';
import { JSONRPC_VERSION } from '@iagente/protocol';
import { createPostMessageTransport } from './post-message.js';

/**
 * Minimal fake Window for testing PostMessageTransport without a real DOM.
 *
 * Semantics modelled: `targetWindow.postMessage(msg, origin)` is called by a
 * sender and must deliver a MessageEvent to the recipient window's OWN
 * 'message' listeners. So each Window stores its inbound listeners, and
 * postMessage() on a window fires THAT window's queue.
 */
function makeFakeWindowPair() {
  // Each window has its own inbound listener queue.
  const queues: { a: Array<(e: MessageEvent) => void>; b: Array<(e: MessageEvent) => void> } = {
    a: [],
    b: [],
  };

  const make = (key: 'a' | 'b'): Window => {
    const myQueue = queues[key];
    return {
      addEventListener: vi.fn((_: string, fn: (e: MessageEvent) => void) => {
        myQueue.push(fn);
      }),
      removeEventListener: vi.fn((_: string, fn: (e: MessageEvent) => void) => {
        const i = myQueue.indexOf(fn);
        if (i >= 0) myQueue.splice(i, 1);
      }),
      // postMessage(msg, origin): the CALLER uses targetWindow.postMessage to
      // deliver to that target. So we fire on THIS window's own queue.
      postMessage: vi.fn((message: unknown, _origin: string) => {
        const event = { data: message, origin: _origin } as MessageEvent;
        // Clone array to avoid mutation-during-iteration issues.
        for (const fn of [...myQueue]) fn(event);
      }),
    } as unknown as Window;
  };

  return { a: make('a'), b: make('b') };
}

describe('PostMessageTransport', () => {
  it('delivers a wrapped JSON-RPC message between peer windows', () => {
    const { a, b } = makeFakeWindowPair();
    // Allow '*' to focus this test on delivery, not origin filtering
    // (origin filtering is covered in the next test).
    const fromA = createPostMessageTransport({
      allowedOrigins: '*',
      targetWindow: b,
      targetOrigin: 'https://b.test',
      sourceWindow: a,
    });
    const fromB = createPostMessageTransport({
      allowedOrigins: '*',
      targetWindow: a,
      targetOrigin: 'https://a.test',
      sourceWindow: b,
    });

    const received: unknown[] = [];
    fromB.onMessage((m) => received.push(m));

    fromA.send({
      jsonrpc: JSONRPC_VERSION,
      id: 1,
      method: 'ai.summarize',
      params: { text: 'hi' },
    });

    expect(received).toHaveLength(1);
    expect((received[0] as { method: string }).method).toBe('ai.summarize');
  });

  it('drops messages from origins not on the allowlist (security)', () => {
    const { a, b } = makeFakeWindowPair();
    const fromB = createPostMessageTransport({
      allowedOrigins: ['https://trusted.test'],
      sourceWindow: b,
    });

    const received: unknown[] = [];
    fromB.onMessage((m) => received.push(m));

    // Simulate an attacker sending from an untrusted origin.
    for (const fn of (b.addEventListener as unknown as { mock: { calls: unknown[][] } }).mock.calls) {
      if (fn[0] === 'message') {
        (fn[1] as (e: MessageEvent) => void)({
          data: { __iagente__: '__iagente__', message: { jsonrpc: '2.0', id: 1, method: 'x.y' } },
          origin: 'https://evil.test',
        } as MessageEvent);
      }
    }

    expect(received).toHaveLength(0);
  });

  it('rejects non-iAgente payload (no marker)', () => {
    const { a, b } = makeFakeWindowPair();
    const fromB = createPostMessageTransport({
      allowedOrigins: '*',
      sourceWindow: b,
    });

    const received: unknown[] = [];
    fromB.onMessage((m) => received.push(m));

    for (const fn of (b.addEventListener as unknown as { mock: { calls: unknown[][] } }).mock.calls) {
      if (fn[0] === 'message') {
        (fn[1] as (e: MessageEvent) => void)({
          data: { randomProperty: true },
          origin: 'https://whatever.test',
        } as MessageEvent);
      }
    }

    expect(received).toHaveLength(0);
  });

  it('close() unregisters the message listener', () => {
    const { b } = makeFakeWindowPair();
    const fromB = createPostMessageTransport({
      allowedOrigins: '*',
      sourceWindow: b,
    });
    fromB.close();
    expect(b.removeEventListener).toHaveBeenCalled();
  });
});
