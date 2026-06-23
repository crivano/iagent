/**
 * Abstract key/value storage, used to persist user preferences.
 *
 * Two implementations are provided:
 *   - {@link createLocalStorage}: web `localStorage`, with safe fallback to
 *     in-memory when unavailable (private mode, sandboxed iframe, etc.).
 *   - {@link createInMemoryStorage}: a Map-backed implementation for tests.
 *
 * Scope: only UI/preferences (button position, sidebar width, preferred app
 * per category). iAgente never stores tokens, credentials, or document data.
 */

/**
 * Synchronous key/value persistence. Values are any JSON-serialisable type.
 */
export interface IStorage {
  /** Returns the stored value, or `undefined` if not present. */
  get<T>(key: string): T | undefined;
  /** Returns the stored value, or the provided default if not present. */
  getOrDefault<T>(key: string, defaultValue: T): T;
  /** Stores a value. Replaces any existing value for the same key. */
  set<T>(key: string, value: T): void;
  /** Removes the value associated with `key`. No-op if the key doesn't exist. */
  remove(key: string): void;
  /** Returns true if the key exists. */
  has(key: string): boolean;
  /** Removes all stored values. */
  clear(): void;
}

/** Keys used by the iAgente shell for UI preferences. */
export const STORAGE_KEYS = {
  /** Vertical position (px) of the floating button. */
  buttonY: 'iagente.ui.buttonY',
  /** Last sidebar width (px). NOT persisted when the user closes by dragging to 0. */
  sidebarWidth: 'iagente.ui.sidebarWidth',
  /** Whether the sidebar is open (true) or collapsed (false) at startup. */
  sidebarOpen: 'iagente.ui.sidebarOpen',
  /** Preferred app id per capability key. */
  preferredApp: (capability: string) => `iagente.prefs.app.${capability}`,
} as const;
