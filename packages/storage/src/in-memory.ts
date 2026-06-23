/**
 * In-memory storage implementation. No persistence across page reloads.
 * Used in tests and as a fallback when `localStorage` is unavailable.
 */

import type { IStorage } from './storage.js';

export function createInMemoryStorage(): IStorage {
  const map = new Map<string, unknown>();
  return {
    get<T>(key: string): T | undefined {
      return map.get(key) as T | undefined;
    },
    getOrDefault<T>(key: string, defaultValue: T): T {
      return (map.has(key) ? map.get(key) : defaultValue) as T;
    },
    set<T>(key: string, value: T): void {
      map.set(key, value);
    },
    remove(key: string): void {
      map.delete(key);
    },
    has(key: string): boolean {
      return map.has(key);
    },
    clear(): void {
      map.clear();
    },
  };
}
