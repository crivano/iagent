/**
 * Capability Bus — the central registry where producers (hosts, apps) publish
 * capability implementations and consumers (orchestrator, injected UI) resolve
 * them by INTERFACE TYPE.
 *
 * This is THE decoupling seam. Neither side knows the other's identity:
 *   - A host publishes `case` capability. Consumers ask for `ICaseManagementSystem`.
 *   - An app publishes `ai` capability. Consumers ask for `IAICollaborator`.
 *   - When the orchestrator wants "summarize text", it asks for any IAICollaborator;
 *     swapping Apoia for Assis needs no caller change.
 */

import type {
  CapabilityKey,
  CapabilityOf,
  ContextPayload,
} from '@iagente/protocol';
import { CAPABILITY_NAMESPACES } from '@iagente/protocol';
import { createRpcProxy, type ITransport } from '@iagente/rpc';

/**
 * A producer entry in the capability bus.
 *
 * A "local" producer lives in the same JS context (e.g. a host adapter loaded
 * in the kernel bundle); we register the implementation object directly.
 * A "remote" producer lives across a transport (e.g. an app in an iframe); we
 * register the transport and lazily build a proxy on demand.
 */
export interface CapabilityRegistration<K extends CapabilityKey = CapabilityKey> {
  readonly key: K;
  /** Human-readable provider name (e.g. "eproc", "apoia") for diagnostics. */
  readonly provider: string;
  /** Local implementation, if same-process. Mutually exclusive with transport. */
  readonly impl?: CapabilityOf<K>;
  /** Remote transport, if cross-context. Mutually exclusive with impl. */
  readonly transport?: ITransport;
  /**
   * A relative priority. Higher wins when multiple providers register the same
   * capability and `getActive` is called. Default 0.
   */
  readonly priority?: number;
}

interface ResolvedProvider<K extends CapabilityKey> {
  readonly registration: CapabilityRegistration<K>;
  /** The proxy or impl that callers will invoke. */
  readonly instance: CapabilityOf<K>;
}

type ProviderListener = () => void;

export class CapabilityBus {
  /** Map<capabilityKey, ResolvedProvider[]> — multiple providers per key allowed. */
  private readonly providers = new Map<CapabilityKey, ResolvedProvider<CapabilityKey>[]>();
  /** Map<capabilityKey, activeProviderIndex> — index into the providers array. */
  private readonly activeIndex = new Map<CapabilityKey, number>();
  private readonly listeners = new Set<ProviderListener>();

  /** Register a capability provider. Returns a disposer. */
  register<K extends CapabilityKey>(reg: CapabilityRegistration<K>): () => void {
    if (!reg.impl && !reg.transport) {
      throw new Error(
        `CapabilityBus.register("${reg.key}"): must provide either impl or transport`,
      );
    }

    const instance: CapabilityOf<K> = reg.transport
      ? (createRpcProxy<CapabilityOf<K>>(reg.transport, CAPABILITY_NAMESPACES[reg.key]) as CapabilityOf<K>)
      : (reg.impl as CapabilityOf<K>);

    const resolved: ResolvedProvider<K> = { registration: reg, instance };

    const arr = this.providers.get(reg.key) ?? [];
    arr.push(resolved as ResolvedProvider<CapabilityKey>);
    // Sort by descending priority so index 0 is the default active.
    arr.sort((a, b) => (b.registration.priority ?? 0) - (a.registration.priority ?? 0));
    this.providers.set(reg.key, arr);

    // First registration of a key becomes active by default.
    if (!this.activeIndex.has(reg.key)) this.activeIndex.set(reg.key, 0);

    this.emit();
    return () => this.unregister(reg.key, resolved);
  }

  /** Remove a specific resolved provider. */
  private unregister<K extends CapabilityKey>(
    key: K,
    resolved: ResolvedProvider<K>,
  ): void {
    const arr = this.providers.get(key);
    if (!arr) return;
    const i = arr.indexOf(resolved as ResolvedProvider<CapabilityKey>);
    if (i < 0) return;
    arr.splice(i, 1);
    if (arr.length === 0) {
      this.providers.delete(key);
      this.activeIndex.delete(key);
    } else {
      // Keep active index in range.
      const cur = this.activeIndex.get(key) ?? 0;
      this.activeIndex.set(key, Math.min(cur, arr.length - 1));
    }
    this.emit();
  }

  /**
   * Returns the ACTIVE provider's instance for `key`, or throws if none.
   *
   * The returned object is either the local impl or an RPC proxy; the caller
   * treats it identically.
   */
  getActive<K extends CapabilityKey>(key: K): CapabilityOf<K> {
    const arr = this.providers.get(key);
    if (!arr || arr.length === 0) {
      throw new CapabilityNotAvailableError(key);
    }
    const idx = this.activeIndex.get(key) ?? 0;
    // The providers map stores wide-union entries; we narrow back to K here.
    // (Safety: entries were registered under the same key K, see register<K>.)
    return arr[idx]!.instance as unknown as CapabilityOf<K>;
  }

  /** Like getActive but returns undefined instead of throwing. */
  tryGetActive<K extends CapabilityKey>(key: K): CapabilityOf<K> | undefined {
    try {
      return this.getActive(key);
    } catch {
      return undefined;
    }
  }

  /** Switch the active provider for `key` to the one with the given provider name. */
  setActive<K extends CapabilityKey>(key: K, providerName: string): void {
    const arr = this.providers.get(key);
    if (!arr) throw new CapabilityNotAvailableError(key);
    const idx = arr.findIndex((r) => r.registration.provider === providerName);
    if (idx < 0) {
      throw new Error(`Provider "${providerName}" not registered for "${key}"`);
    }
    this.activeIndex.set(key, idx);
    this.emit();
  }

  /** Lists all provider names registered for a key. */
  listProviders<K extends CapabilityKey>(key: K): readonly string[] {
    return (this.providers.get(key) ?? []).map((r) => r.registration.provider);
  }

  /** Lists capability keys with at least one provider. */
  availableKeys(): readonly CapabilityKey[] {
    return [...this.providers.keys()];
  }

  /** Subscribe to provider-add/remove/active-change events. */
  onProvidersChanged(fn: ProviderListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

/** Thrown when a capability has no registered provider. */
export class CapabilityNotAvailableError extends Error {
  constructor(public readonly key: CapabilityKey) {
    super(`Capability "${key}" is not available (no provider registered)`);
    this.name = 'CapabilityNotAvailableError';
  }
}

/**
 * Convenience: produces a ContextPayload (user/document/case identity) from the
 * current state of a Case- or Document-capability host.
 *
 * Typically called by the orchestrator before launching an app, to bundle the
 * "context" payload the app needs.
 */
export async function buildContextFor(
  bus: CapabilityBus,
  user: ContextPayload['user'],
): Promise<ContextPayload> {
  const ctx: ContextPayload = { user };
  const cms = bus.tryGetActive('case');
  if (cms) {
    const openCase = await cms.getOpenCase(ctx).catch(() => null);
    if (openCase) return { ...ctx, case: openCase };
  }
  const dms = bus.tryGetActive('document');
  if (dms) {
    const openDoc = await dms.getOpenDocument(ctx).catch(() => null);
    if (openDoc) return { ...ctx, document: openDoc };
  }
  return ctx;
}
