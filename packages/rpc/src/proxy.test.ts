import { describe, it, expect } from 'vitest';
import type {
  AssistantIntent,
  IAICollaborator,
  IntentDescriptor,
  LaunchContext,
  SessionHandle,
} from '@iagente/protocol';
import {
  createInProcessTransportPair,
  createRpcProxy,
  createRpcStub,
  RpcError,
  buildMethod,
  parseMethod,
} from './index.js';

/**
 * Two DIFFERENT mock IAICollaborator implementations, used to prove that
 * swapping the implementor requires no change to the proxy caller.
 * (In production: these would be Apoia and Assis.)
 */
const APOIA_INTENTS: readonly IntentDescriptor<AssistantIntent>[] = [
  { intent: 'summarize', label: 'Resumir (Apoia)', category: 'ai' },
  { intent: 'review', label: 'Revisar (Apoia)', category: 'ai' },
];
const ASSIS_INTENTS: readonly IntentDescriptor<AssistantIntent>[] = [
  { intent: 'summarize', label: 'Resumir (Assis)', category: 'ai' },
];

class FakeApoia implements IAICollaborator {
  readonly capabilityId = 'ai' as const;
  async listIntents() {
    return APOIA_INTENTS;
  }
  async beginSession(intent: AssistantIntent, ctx: LaunchContext): Promise<SessionHandle> {
    return {
      sessionId: `apoia-${intent}-${ctx.user.id}`,
      status: 'ready',
      intents: APOIA_INTENTS,
    };
  }
  async endSession(): Promise<void> {}
}

class FakeAssis implements IAICollaborator {
  readonly capabilityId = 'ai' as const;
  async listIntents() {
    return ASSIS_INTENTS;
  }
  async beginSession(intent: AssistantIntent, ctx: LaunchContext): Promise<SessionHandle> {
    return {
      sessionId: `assis-${intent}-${ctx.user.id}`,
      status: 'ready',
      intents: ASSIS_INTENTS,
    };
  }
  async endSession(): Promise<void> {}
}

describe('RPC proxy/stub — method routing', () => {
  it('buildMethod and parseMethod are inverse', () => {
    expect(buildMethod('ai', 'listIntents')).toBe('ai.listIntents');
    expect(parseMethod('ai.listIntents')).toEqual(['ai', 'listIntents']);
    expect(parseMethod('nope')).toBeNull();
    expect(parseMethod('.x')).toBeNull();
    expect(parseMethod('x.')).toBeNull();
  });
});

describe('RPC proxy/stub — request/response round-trip', () => {
  it('marshals a call through InProcessTransport and returns the result', async () => {
    const [client, server] = createInProcessTransportPair();
    createRpcStub(new FakeApoia(), 'ai', server);

    const ai = createRpcProxy<IAICollaborator>(client, 'ai');
    const intents = await ai.listIntents();

    expect(intents).toHaveLength(2);
    expect(intents[0]?.label).toBe('Resumir (Apoia)');
  });

  it(' SURVIVES swapping the implementor without changing the caller', async () => {
    // *** This is the decoupling test. ***
    // The caller (this test) is unchanged between the two halves below.
    const [client, server] = createInProcessTransportPair();
    // Half A: Apoia behind the stub.
    const disposeApoia = createRpcStub(new FakeApoia(), 'ai', server);
    const ai = createRpcProxy<IAICollaborator>(client, 'ai');
    const fromApoia = await ai.listIntents();
    expect(fromApoia[0]?.label).toContain('(Apoia)');

    // Swap to Assis: dispose old stub, register new one. Caller code is UNCHANGED.
    disposeApoia();
    createRpcStub(new FakeAssis(), 'ai', server);
    const fromAssis = await ai.listIntents();
    expect(fromAssis[0]?.label).toContain('(Assis)');

    // Same shape of result → caller doesn't need to know who answered.
    expect(Array.isArray(fromAssis)).toBe(true);
  });

  it('passes session-scoped arguments through (beginSession)', async () => {
    const [client, server] = createInProcessTransportPair();
    createRpcStub(new FakeApoia(), 'ai', server);
    const ai = createRpcProxy<IAICollaborator>(client, 'ai');

    const session = await ai.beginSession('review', {
      intent: 'review',
      user: { id: 'u-1', name: 'Judge' },
    });
    expect(session.sessionId).toBe('apoia-review-u-1');
    expect(session.status).toBe('ready');
  });

  it('propagates errors from the stub to the proxy as RpcError', async () => {
    const [client, server] = createInProcessTransportPair();
    // Override beginSession to throw.
    const throwing: IAICollaborator = {
      capabilityId: 'ai',
      async listIntents() {
        return [];
      },
      async beginSession() {
        throw new Error('cannot start');
      },
      async endSession() {},
    };
    createRpcStub(throwing, 'ai', server);
    const ai = createRpcProxy<IAICollaborator>(client, 'ai');

    await expect(
      ai.beginSession('summarize', {
        intent: 'summarize',
        user: { id: 'x', name: 'x' },
      }),
    ).rejects.toBeInstanceOf(RpcError);
  });

  it('returns MethodNotFound when calling an unknown capability method', async () => {
    const [client, server] = createInProcessTransportPair();
    createRpcStub(new FakeApoia(), 'ai', server);
    const ai = createRpcProxy<IAICollaborator>(client, 'ai');

    // Cast to access an unknown method.
    await expect(
      (ai as unknown as { nonExistent: () => Promise<unknown> }).nonExistent(),
    ).rejects.toMatchObject({ code: -32601 });
  });
});
