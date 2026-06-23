/**
 * Orchestrator — coordinates the lifecycle of the iAgente kernel:
 *
 *   bootstrap(hostAdapters)
 *     → detectHost(...)                            // pick the right adapter
 *     → adapter.activate(hostCtx)                  // get its capabilities
 *     → bus.register(...) for each capability      // publish to the bus
 *     → return active session handle
 *
 * On `dispose()`, the orchestrator calls adapter.dispose() and unregisters
 * everything from the bus. State is purely in-memory: nothing is persisted.
 */

import type { CapabilityKey } from '@iagente/protocol';
import type { CapabilityBus } from './capability-bus.js';
import {
  detectHost,
  type DetectorDeps,
  type HostAdapter,
  type HostContext,
} from './host-detector.js';

/** Public handle returned to the runtime entrypoint. */
export interface Session {
  /** The host adapter that won detection (or null if none matched). */
  readonly hostId: string | null;
  /** All capability keys the host published. */
  readonly providedCapabilities: readonly CapabilityKey[];
  /** Tear down the session, unregistering everything. */
  dispose(): void;
}

export interface OrchestratorOptions {
  /** Skip auto-detection and force a specific adapter id. Useful for tests. */
  readonly forceHostId?: string;
}

/**
 * Bootstraps an iAgente session against the current page.
 *
 * @param bus The capability bus the host will publish into.
 * @param hostAdapters The list of hosts that might match this page.
 * @param deps Page access — usually the live document/window; injected for tests.
 * @param options Optional overrides (e.g. forceHostId).
 */
export function bootstrap(
  bus: CapabilityBus,
  hostAdapters: readonly HostAdapter[],
  deps: DetectorDeps & Pick<HostContext, 'document' | 'window'>,
  options: OrchestratorOptions = {},
): Session {
  let adapter: HostAdapter | null = null;

  if (options.forceHostId) {
    adapter = hostAdapters.find((a) => a.descriptor.id === options.forceHostId) ?? null;
  } else {
    const detected = detectHost(hostAdapters, deps);
    adapter = detected?.adapter ?? null;
  }

  if (!adapter) {
    return { hostId: null, providedCapabilities: [], dispose: () => {} };
  }

  // Activate the adapter, gathering its capabilities.
  const hostCtx: HostContext = {
    document: deps.document,
    window: deps.window,
    url: deps.url,
  };
  const caps = adapter.activate(hostCtx);

  // Publish each capability the host provides into the bus.
  const disposers: Array<() => void> = [];
  const provided: CapabilityKey[] = [];
  if (caps.case) {
    disposers.push(bus.register({ key: 'case', provider: adapter.descriptor.id, impl: caps.case }));
    provided.push('case');
  }
  if (caps.document) {
    disposers.push(
      bus.register({ key: 'document', provider: adapter.descriptor.id, impl: caps.document }),
    );
    provided.push('document');
  }
  if (caps.auth) {
    disposers.push(bus.register({ key: 'auth', provider: adapter.descriptor.id, impl: caps.auth }));
    provided.push('auth');
  }

  return {
    hostId: adapter.descriptor.id,
    providedCapabilities: provided,
    dispose() {
      disposers.forEach((d) => d());
      adapter?.dispose?.();
    },
  };
}
