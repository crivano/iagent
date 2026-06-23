/**
 * AppRegistry — parallel registry to CapabilityBus that stores AppDescriptors.
 *
 * The CapabilityBus holds capability IMPLEMENTATIONS (proxies for the active
 * provider per capability key). The AppRegistry holds METADATA about every app
 * known to iAgente: id/name/categories/UI mode/assistant factory.
 *
 * Why split? Because the SAME app implements exactly ONE capability but offers
 * potentially many menu entries (intents). And because the UI/menu needs to
 * list ALL apps regardless of which is active — the bus only knows "the active
 * assistant" for each capability, not the catalogue.
 *
 * Connection: `registerApp(bus, registry, descriptor)` registers the descriptor
 * in the registry AND wires its assistant (lazily) into the bus as a provider
 * for its capability.
 */

import type {
  AppDescriptor,
  CapabilityKey,
  IntentCategory,
  IInteractiveAssistant,
} from '@iagente/protocol';
import type { CapabilityBus } from './capability-bus.js';
import type { IStorage, STORAGE_KEYS as StorageKeysNs } from '@iagente/storage';

// Re-export for callers' convenience.
export type { AppDescriptor };

/**
 * Registry of AppDescriptors. Stateless beyond the in-memory map.
 */
export class AppRegistry {
  private readonly appsById = new Map<string, AppDescriptor>();

  /** Registers an app descriptor. Idempotent by id — overrides previous. */
  register(desc: AppDescriptor): () => void {
    this.appsById.set(desc.id, desc);
    return () => {
      // Only remove if still the same descriptor (don't clobber a re-registration).
      if (this.appsById.get(desc.id) === desc) this.appsById.delete(desc.id);
    };
  }

  /** Returns the descriptor for an app id, or undefined. */
  getApp(id: string): AppDescriptor | undefined {
    return this.appsById.get(id);
  }

  /** All registered apps. */
  list(): readonly AppDescriptor[] {
    return [...this.appsById.values()];
  }

  /** Apps filtered by UI category (e.g. 'ai' for the AI section of the menu). */
  listByCategory(category: IntentCategory): readonly AppDescriptor[] {
    return this.list().filter((a) => a.categories.includes(category));
  }

  /** Apps filtered by their capability binding. */
  listByCapability(capability: CapabilityKey): readonly AppDescriptor[] {
    return this.list().filter((a) => a.capability === capability);
  }
}

/**
 * Registers an app fully:
 *   1. Adds it to the AppRegistry.
 *   2. Instantiates its assistant lazily and registers the impl/proxy in the
 *      CapabilityBus, under the descriptor's capability. The descriptor's
 *      `priority` controls the bus ordering (used as default active).
 *
 * The bus registration is created exactly once per descriptor (memoised on the
 * descriptor by id) so that toggling the app on/off in settings doesn't spawn
 * duplicate providers.
 *
 * @returns A disposer that removes both the registry entry and the bus provider.
 */
export function registerApp(
  bus: CapabilityBus,
  registry: AppRegistry,
  desc: AppDescriptor,
): () => void {
  const disposeRegistry = registry.register(desc);
  const assistant: IInteractiveAssistant = desc.createAssistant();
  // Cast helper: registerApp promises the descriptor's `createAssistant`
  // matches its declared `capability`. The bus's generic constraints can't
  // follow this pairing through arbitrary union keys, so we cross `unknown`.
  const disposeBus = bus.register({
    key: desc.capability,
    provider: desc.id,
    impl: assistant as unknown as import('@iagente/protocol').CapabilityOf<typeof desc.capability>,
    priority: desc.priority ?? 0,
  });

  return () => {
    disposeBus();
    disposeRegistry();
  };
}

/**
 * Resolves which app should be the ACTIVE provider for `capability`, given:
 *   - the user's persisted preference (storage), or
 *   - the highest-priority registered app.
 *
 * Side-effects: if a preference is stored and an app with that id is
 * registered, calls `bus.setActive(capability, appId)`.
 */
export function applyPreferredApp(
  bus: CapabilityBus,
  registry: AppRegistry,
  storage: IStorage,
  capability: CapabilityKey,
  storageKeys: typeof StorageKeysNs,
): void {
  const preferredId = storage.get<string>(storageKeys.preferredApp(capability));
  const registered = registry.listByCapability(capability).map((a) => a.id);
  if (preferredId && registered.includes(preferredId)) {
    bus.setActive(capability, preferredId);
  }
  // If no preference, the bus default (highest priority) stays active.
}
