/**
 * Web `localStorage`-backed implementation of IStorage.
 *
 * Falls back to in-memory storage when `localStorage` is unavailable (private
 * browsing modes, sandboxed iframes with no `allow-same-origin`, SSR contexts,
 * quota exceeded, etc.). iAgente should never crash if persistence is refused.
 */

import { createInMemoryStorage } from './in-memory.js';
import type { IStorage } from './storage.js';

/** Returns true when localStorage can actually be used (read+write probe). */
function localStorageAvailable(ls: Storage | undefined | null): ls is Storage {
  if (!ls) return false;
  const probeKey = '__iagente_storage_probe__';
  try {
    ls.setItem(probeKey, '1');
    ls.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a localStorage-backed storage. Accepts an optional `store` argument
 * (useful to inject `sessionStorage` in tests, or a stub for node).
 *
 * Serialises values as JSON. Throws are NEVER propagated: a write failure
 * silently degrades to in-memory semantics.
 */
export function createLocalStorage(store?: Storage): IStorage {
  const ls = store ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!localStorageAvailable(ls)) {
    return createInMemoryStorage();
  }

  return {
    get<T>(key: string): T | undefined {
      const raw = ls.getItem(key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        // Corrupted entry — treat as missing rather than throwing.
        return undefined;
      }
    },
    getOrDefault<T>(key: string, defaultValue: T): T {
      const v = this.get<T>(key);
      return v === undefined ? defaultValue : v;
    },
    set<T>(key: string, value: T): void {
      try {
        ls.setItem(key, JSON.stringify(value));
      } catch {
        // QuotaExceededError or SecurityError — swallow silently.
      }
    },
    remove(key: string): void {
      try {
        ls.removeItem(key);
      } catch {
        // ignored
      }
    },
    has(key: string): boolean {
      try {
        return ls.getItem(key) !== null;
      } catch {
        return false;
      }
    },
    clear(): void {
      // Only clear our own keys (prefixed `iagente.`). Avoid nuking unrelated
      // host-page state.
      try {
        const keys: string[] = [];
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (k && k.startsWith('iagente.')) keys.push(k);
        }
        for (const k of keys) ls.removeItem(k);
      } catch {
        // ignored
      }
    },
  };
}
