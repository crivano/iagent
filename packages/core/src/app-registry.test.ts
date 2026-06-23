import { describe, it, expect } from 'vitest';
import type { AppDescriptor, IAICollaborator, IFeedbackCollector } from '@iagente/protocol';
import { CapabilityBus } from './capability-bus.js';
import { AppRegistry, registerApp, applyPreferredApp } from './app-registry.js';
import { createInMemoryStorage, STORAGE_KEYS } from '@iagente/storage';

const apoiaAssistant: IAICollaborator = {
  capabilityId: 'ai',
  async listIntents() {
    return [{ intent: 'summarize', label: 'Apoia', category: 'ai' }];
  },
  async beginSession() {
    return { sessionId: 'apoia', status: 'ready', intents: [] };
  },
  async endSession() {},
};
const assisAssistant: IAICollaborator = {
  capabilityId: 'ai',
  async listIntents() {
    return [{ intent: 'summarize', label: 'Assis', category: 'ai' }];
  },
  async beginSession() {
    return { sessionId: 'assis', status: 'ready', intents: [] };
  },
  async endSession() {},
};

const fakeFeedback: IFeedbackCollector = {
  capabilityId: 'feedback',
  async listIntents() {
    return [{ intent: 'collect-feedback', label: 'Avaliar', category: 'feedback' }];
  },
  async beginSession() {
    return { sessionId: 'sess', status: 'ready', intents: [] };
  },
  async endSession() {},
};

const apoiaApp: AppDescriptor = {
  id: 'apoia',
  name: 'Apoia',
  categories: ['ai'],
  capability: 'ai',
  priority: 0,
  ui: { type: 'headless' },
  createAssistant: () => apoiaAssistant,
};

const assisApp: AppDescriptor = {
  id: 'assis',
  name: 'Assis',
  categories: ['ai'],
  capability: 'ai',
  priority: 10, // higher — becomes bus default
  ui: { type: 'headless' },
  createAssistant: () => assisAssistant,
};

const npsApp: AppDescriptor = {
  id: 'nps',
  name: 'NPS',
  categories: ['feedback'],
  capability: 'feedback',
  ui: { type: 'react', root: () => null },
  createAssistant: () => fakeFeedback,
};

describe('AppRegistry', () => {
  it('registers and lists apps', () => {
    const r = new AppRegistry();
    r.register(apoiaApp);
    r.register(npsApp);
    expect(r.list().map((a) => a.id).sort()).toEqual(['apoia', 'nps']);
  });

  it('retrieves an app by id', () => {
    const r = new AppRegistry();
    r.register(apoiaApp);
    expect(r.getApp('apoia')?.name).toBe('Apoia');
    expect(r.getApp('unknown')).toBeUndefined();
  });

  it('filters by category', () => {
    const r = new AppRegistry();
    r.register(apoiaApp);
    r.register(npsApp);
    expect(r.listByCategory('ai').map((a) => a.id)).toEqual(['apoia']);
    expect(r.listByCategory('feedback').map((a) => a.id)).toEqual(['nps']);
  });

  it('filters by capability', () => {
    const r = new AppRegistry();
    r.register(apoiaApp);
    r.register(assisApp);
    r.register(npsApp);
    expect(r.listByCapability('ai').map((a) => a.id).sort()).toEqual(['apoia', 'assis']);
  });

  it('disposer removes the app', () => {
    const r = new AppRegistry();
    const dispose = r.register(apoiaApp);
    expect(r.list()).toHaveLength(1);
    dispose();
    expect(r.list()).toHaveLength(0);
  });

  it('re-registering with same id replaces (last-wins) and disposer only removes if still current', () => {
    const r = new AppRegistry();
    const d1 = r.register(apoiaApp);
    // A second registration of a DISTINCT descriptor with the same id.
    const replacement: AppDescriptor = { ...apoiaApp, name: 'Apoia v2' };
    r.register(replacement);
    d1(); // since the stored ref is now `replacement`, this should be a no-op
    expect(r.list()).toHaveLength(1);
    expect(r.getApp('apoia')?.name).toBe('Apoia v2');
  });
});

describe('registerApp — descriptor + bus wiring', () => {
  it('registers the descriptor and adds the assistant to the bus', () => {
    const bus = new CapabilityBus();
    const registry = new AppRegistry();
    registerApp(bus, registry, assisApp);

    expect(registry.getApp('assis')).toBeDefined();
    // Bus: assis has higher priority so it is the active 'ai' provider.
    expect(bus.listProviders('ai')).toContain('assis');
  });

  it('disposer removes both registry entry and bus provider', () => {
    const bus = new CapabilityBus();
    const registry = new AppRegistry();
    const dispose = registerApp(bus, registry, apoiaApp);
    expect(bus.listProviders('ai')).toEqual(['apoia']);
    dispose();
    expect(bus.listProviders('ai')).toEqual([]);
    expect(registry.list()).toHaveLength(0);
  });

  it('multiple apps for the same capability: highest priority becomes active', () => {
    const bus = new CapabilityBus();
    const registry = new AppRegistry();
    registerApp(bus, registry, apoiaApp);
    registerApp(bus, registry, assisApp);
    // assis priority 10 > apoia priority 0 → assis is active.
    expect(bus.listProviders('ai')[0]).toBe('assis');
  });
});

describe('applyPreferredApp', () => {
  it('activates the user-preferred app when one is stored', async () => {
    const bus = new CapabilityBus();
    const registry = new AppRegistry();
    const storage = createInMemoryStorage();
    registerApp(bus, registry, apoiaApp);
    registerApp(bus, registry, assisApp);
    // Default: assis is active (higher priority).
    expect((await bus.getActive('ai').listIntents())[0]?.label).toBe('Assis');

    // User prefers Apoia.
    storage.set(STORAGE_KEYS.preferredApp('ai'), 'apoia');
    applyPreferredApp(bus, registry, storage, 'ai', STORAGE_KEYS);

    // Apoia is now the active provider (verified by its distinct intents).
    expect((await bus.getActive('ai').listIntents())[0]?.label).toBe('Apoia');
  });

  it('is a no-op when the stored preference is unknown', () => {
    const bus = new CapabilityBus();
    const registry = new AppRegistry();
    const storage = createInMemoryStorage();
    registerApp(bus, registry, assisApp);
    storage.set(STORAGE_KEYS.preferredApp('ai'), 'unknown-app');
    applyPreferredApp(bus, registry, storage, 'ai', STORAGE_KEYS);
    // assis remains active.
    expect(bus.listProviders('ai')[0]).toBe('assis');
  });

  it('is a no-op when no preference is stored', async () => {
    const bus = new CapabilityBus();
    const registry = new AppRegistry();
    const storage = createInMemoryStorage();
    registerApp(bus, registry, assisApp);
    applyPreferredApp(bus, registry, storage, 'ai', STORAGE_KEYS);
    // Active provider is still Assis (default by priority).
    expect((await bus.getActive('ai').listIntents())[0]?.label).toBe('Assis');
  });
});
