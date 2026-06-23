import { describe, it, expect } from 'vitest';
import type {
  AssistantIntent,
  IAICollaborator,
  IntentDescriptor,
  LaunchContext,
  SessionHandle,
} from '@iagente/protocol';
import { CapabilityBus, CapabilityNotAvailableError } from './capability-bus.js';

class FakeAI implements IAICollaborator {
  readonly capabilityId = 'ai' as const;
  constructor(public readonly tag: string) {}
  async listIntents(): Promise<readonly IntentDescriptor<AssistantIntent>[]> {
    return [{ intent: 'summarize', label: `Resumir (${this.tag})`, category: 'ai' }];
  }
  async beginSession(intent: AssistantIntent, ctx: LaunchContext): Promise<SessionHandle> {
    return {
      sessionId: `${this.tag}-${intent}-${ctx.user.id}`,
      status: 'ready',
      intents: [],
    };
  }
  async endSession(): Promise<void> {}
}

describe('CapabilityBus — the decoupling seam', () => {
  it('returns the active provider when getActive is called', async () => {
    const bus = new CapabilityBus();
    bus.register({ key: 'ai', provider: 'apoia', impl: new FakeAI('apoia') });

    const ai = bus.getActive('ai');
    const intents = await ai.listIntents();
    expect(intents[0]?.label).toBe('Resumir (apoia)');
  });

  it('throws a typed error for unknown capabilities', () => {
    const bus = new CapabilityBus();
    expect(() => bus.getActive('feedback')).toThrow(CapabilityNotAvailableError);
  });

  it('tryGetActive returns undefined instead of throwing', () => {
    const bus = new CapabilityBus();
    expect(bus.tryGetActive('ai')).toBeUndefined();
  });

  it('selects the highest-priority provider as active by default', async () => {
    const bus = new CapabilityBus();
    bus.register({ key: 'ai', provider: 'apoia', impl: new FakeAI('apoia'), priority: 0 });
    bus.register({ key: 'ai', provider: 'assis', impl: new FakeAI('assis'), priority: 10 });

    expect(bus.listProviders('ai')).toEqual(['assis', 'apoia']); // sorted desc
    // active = first after sort = assis
    const intents = await bus.getActive('ai').listIntents();
    expect(intents[0]?.label).toBe('Resumir (assis)');
  });

  it('can switch active provider via setActive', async () => {
    const bus = new CapabilityBus();
    bus.register({ key: 'ai', provider: 'apoia', impl: new FakeAI('apoia') });
    bus.register({ key: 'ai', provider: 'assis', impl: new FakeAI('assis') });

    let intents = await bus.getActive('ai').listIntents();
    expect(intents[0]?.label).toBe('Resumir (apoia)');

    bus.setActive('ai', 'assis');
    intents = await bus.getActive('ai').listIntents();
    expect(intents[0]?.label).toBe('Resumir (assis)');
  });

  it('unregisters a provider when its disposer is called', () => {
    const bus = new CapabilityBus();
    const dispose = bus.register({ key: 'ai', provider: 'apoia', impl: new FakeAI('apoia') });
    expect(bus.listProviders('ai')).toEqual(['apoia']);
    dispose();
    expect(bus.listProviders('ai')).toEqual([]);
    expect(() => bus.getActive('ai')).toThrow(CapabilityNotAvailableError);
  });

  it('notifies subscribers when providers or active selection change', () => {
    const bus = new CapabilityBus();
    let calls = 0;
    bus.onProvidersChanged(() => calls++);
    bus.register({ key: 'ai', provider: 'apoia', impl: new FakeAI('apoia') });
    expect(calls).toBe(1); // register fires
    bus.setActive('ai', 'apoia'); // active change fires (even to same provider)
    expect(calls).toBe(2);
  });

  it('availableKeys lists all registered keys', () => {
    const bus = new CapabilityBus();
    bus.register({ key: 'ai', provider: 'x', impl: new FakeAI('x') });
    expect(bus.availableKeys()).toEqual(['ai']);
  });
});
