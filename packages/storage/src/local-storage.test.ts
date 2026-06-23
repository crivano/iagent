import { describe, it, expect } from 'vitest';
import { createLocalStorage } from './local-storage.js';

/** Stub Storage that emulates the browser localStorage API in tests. */
class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/** A Storage that throws on every write — simulates quota/security errors. */
class BlockedStorage implements Storage {
  readonly length = 0;
  clear(): void {
    throw new DOMException('blocked');
  }
  getItem(): string | null {
    throw new DOMException('blocked');
  }
  key(): string | null {
    throw new DOMException('blocked');
  }
  removeItem(): void {
    throw new DOMException('blocked');
  }
  setItem(): void {
    throw new DOMException('blocked');
  }
}

describe('createLocalStorage', () => {
  it('persists values across instances backed by the same store', () => {
    const store = new FakeStorage();
    const s1 = createLocalStorage(store);
    s1.set('a', { x: 1 });
    // A second adapter on the same store sees the same data.
    const s2 = createLocalStorage(store);
    expect(s2.get<{ x: number }>('a')).toEqual({ x: 1 });
  });

  it('serialises values as JSON', () => {
    const store = new FakeStorage();
    const s = createLocalStorage(store);
    s.set('arr', [1, 2, 3]);
    expect(store.getItem('arr')).toBe('[1,2,3]');
  });

  it('returns undefined when stored JSON is corrupted', () => {
    const store = new FakeStorage();
    store.setItem('broken', '{not json');
    const s = createLocalStorage(store);
    expect(s.get('broken')).toBeUndefined();
  });

  it('falls back to in-memory semantics when storage is unavailable', () => {
    const s = createLocalStorage(undefined);
    s.set('a', 1);
    expect(s.get('a')).toBe(1); // works in-memory
    // A NEW adapter (no shared store) shouldn't see it.
    const s2 = createLocalStorage(undefined);
    expect(s2.get('a')).toBeUndefined();
  });

  it('degrades gracefully when Storage throws (blocked)', () => {
    const s = createLocalStorage(new BlockedStorage());
    // The constructor detected unavailable storage, so it falls back.
    // All operations should be in-memory no-ops that don't throw.
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.has('a')).toBe(true); // in-memory write succeeded
    expect(() => s.remove('a')).not.toThrow();
    expect(s.has('a')).toBe(false); // remove worked
  });

  it('clear() only removes keys prefixed "iagente."', () => {
    const store = new FakeStorage();
    store.setItem('hostPageSetting', 'do-not-touch');
    store.setItem('iagente.ui.buttonY', '100');
    const s = createLocalStorage(store);
    s.clear();
    expect(store.getItem('hostPageSetting')).toBe('do-not-touch');
    expect(store.getItem('iagente.ui.buttonY')).toBeNull();
  });
});
