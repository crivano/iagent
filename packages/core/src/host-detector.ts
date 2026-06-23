/**
 * HostDetector — auto-detects which host system the iAgente bundle has been
 * injected into, by URL/DOM pattern matching with a simple scoring algorithm.
 *
 * Each host adapter declares a `HostDescriptor` with optional URL patterns and
 * DOM selectors. The detector scores every known adapter against the current
 * page; the adapter with the highest non-zero score wins.
 */

/** A URL glob pattern. Supports a trailing `*` wildcard. */
export type UrlPattern = string;

/** A CSS selector whose presence contributes to the host's score. */
export type DomSelector = string;

/**
 * Descriptor advertised by every host adapter.
 *
 * Both urlPatterns and selectors are optional but at least one should match.
 * Each matched URL pattern scores +2; each matched selector scores +1.
 */
export interface HostDescriptor {
  /** Adapter id (e.g. "eproc", "pje", "demo-host"). */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  readonly urlPatterns?: readonly UrlPattern[];
  readonly selectors?: readonly DomSelector[];
}

/**
 * Adapter for a host system: descriptor + capability factory.
 *
 * The capability factory receives a {@link HostContext} and returns a partial
 * capability map. The kernel registers each returned capability in the bus.
 */
export interface HostAdapter {
  readonly descriptor: HostDescriptor;
  /**
   * Called when this adapter wins detection. Provides the caps it implements.
   *
   * @returns A map of capabilityKey → implementation object. Those will be
   *          registered in the CapabilityBus as local providers.
   */
  activate(ctx: HostContext): HostCapabilities;
  /** Called when leaving the host or tearing down. */
  dispose?(): void;
}

/** Capabilities a host adapter can publish into the bus. */
export interface HostCapabilities {
  readonly case?: import('@iagente/protocol').ICaseManagementSystem;
  readonly document?: import('@iagente/protocol').IDocumentManagementSystem;
  readonly auth?: import('@iagente/protocol').IAuthHelper;
  /**
   * Call-to-action buttons the host wants the iAgente shell to inject into
   * its own DOM. The shell reads these AFTER host activation and mounts each
   * action at the declared `targetSelector` / `placement`.
   */
  readonly injectedActions?: readonly import('@iagente/protocol').InjectedAction[];
}

/** Context given to a host adapter on activation. */
export interface HostContext {
  /** The live document — used to read the DOM. */
  readonly document: Document;
  /** The live window — used to subscribe to navigation/SPL events. */
  readonly window: Window;
  /** The current URL when detection fired. */
  readonly url: string;
}

/**
 * Result of scoring one adapter against the current page.
 */
export interface DetectionScore {
  readonly adapterId: string;
  readonly score: number;
  readonly matchedUrls: readonly string[];
  readonly matchedSelectors: readonly string[];
}

/** Pattern matcher: supports trailing `*` only. */
function matchUrlPattern(pattern: UrlPattern, url: string): boolean {
  if (pattern.endsWith('*')) {
    return url.startsWith(pattern.slice(0, -1));
  }
  return url === pattern;
}

/** Dependencies the detector needs (abstracted for testability). */
export interface DetectorDeps {
  readonly url: string;
  querySelector(selector: string): Element | null;
}

/**
 * Auto-detects the best-matching host adapter.
 *
 * @param adapters All registered host adapters.
 * @param deps Page access (URL + DOM query) — injected for testability.
 * @returns The winning adapter, or null if no adapter matched.
 */
export function detectHost(
  adapters: readonly HostAdapter[],
  deps: DetectorDeps,
): { adapter: HostAdapter; score: DetectionScore } | null {
  let best: { adapter: HostAdapter; score: DetectionScore } | null = null;

  for (const adapter of adapters) {
    const { descriptor } = adapter;
    const matchedUrls: string[] = [];
    const matchedSelectors: string[] = [];
    let score = 0;

    for (const p of descriptor.urlPatterns ?? []) {
      if (matchUrlPattern(p, deps.url)) {
        score += 2;
        matchedUrls.push(p);
      }
    }
    for (const s of descriptor.selectors ?? []) {
      if (deps.querySelector(s)) {
        score += 1;
        matchedSelectors.push(s);
      }
    }

    if (score <= 0) continue;

    const result: DetectionScore = {
      adapterId: descriptor.id,
      score,
      matchedUrls,
      matchedSelectors,
    };
    if (!best || score > best.score.score) {
      best = { adapter, score: result };
    }
  }

  return best;
}
