/**
 * usePersistedState — React hook that reads/writes state backed by an IStorage.
 *
 * Initial value is resolved synchronously on mount from the storage, falling
 * back to `defaultValue` if not present. Each `setState` call (or returned
 * setter) writes through to storage, so the value survives reloads.
 *
 * Used by the shell to persist UI preferences (button Y position, sidebar
 * width, preferred app per category). Never used for sensitive data.
 */

import { useCallback, useState } from 'react';
import type { IStorage } from '@iagente/storage';

export interface UsePersistedStateOptions {
  /**
   * When true (default), skips persisting writes that fail an `shouldPersist`
   * check. Useful e.g. for sidebarWidth when the user drags to 0 (close edge):
   * we want to update UI state but NOT persist the "0" (so reload reverts to
   * the last meaningful width).
   */
  readonly shouldPersist?: (next: unknown) => boolean;
}

export function usePersistedState<T>(
  storage: IStorage,
  key: string,
  defaultValue: T,
  options: UsePersistedStateOptions = {},
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const { shouldPersist = () => true } = options;

  const [value, setValue] = useState<T>(() => storage.getOrDefault<T>(key, defaultValue));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        if (shouldPersist(resolved)) {
          storage.set(key, resolved);
        }
        return resolved;
      });
    },
    [storage, key, shouldPersist],
  );

  return [value, set] as const;
}
