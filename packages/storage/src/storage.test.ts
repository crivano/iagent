import { describe, it, expect } from 'vitest';
import { createInMemoryStorage, STORAGE_KEYS, type IStorage } from './index.js';

/** Shared scenarios run against any IStorage implementation. */
function contract(name: string, make: () => IStorage) {
  describe(`${name} — IStorage contract`, () => {
    it('returns undefined for missing keys', () => {
      const s = make();
      expect(s.get('missing')).toBeUndefined();
      expect(s.has('missing')).toBe(false);
    });

    it('stores and reads back a value', () => {
      const s = make();
      s.set('k', { a: 1 });
      expect(s.get<{ a: number }>('k')).toEqual({ a: 1 });
      expect(s.has('k')).toBe(true);
    });

    it('overwrites existing values', () => {
      const s = make();
      s.set('k', 1);
      s.set('k', 2);
      expect(s.get('k')).toBe(2);
    });

    it('returns default when key is missing', () => {
      const s = make();
      expect(s.getOrDefault('n', 42)).toBe(42);
      s.set('n', 7);
      expect(s.getOrDefault('n', 42)).toBe(7);
    });

    it('handles complex (JSON-serialisable) values', () => {
      const s = make();
      s.set('arr', [1, 'two', { three: true }]);
      expect(s.get<unknown[]>('arr')).toEqual([1, 'two', { three: true }]);
    });

    it('removes a key', () => {
      const s = make();
      s.set('k', 'v');
      s.remove('k');
      expect(s.get('k')).toBeUndefined();
      expect(s.has('k')).toBe(false);
    });

    it('removing a missing key is a no-op', () => {
      const s = make();
      expect(() => s.remove('nothing')).not.toThrow();
    });

    it('clears all keys', () => {
      const s = make();
      s.set('a', 1);
      s.set('b', 2);
      s.clear();
      expect(s.has('a')).toBe(false);
      expect(s.has('b')).toBe(false);
    });
  });
}

contract('InMemoryStorage', createInMemoryStorage);

describe('STORAGE_KEYS', () => {
  it('exposes well-known UI preference keys', () => {
    const s = createInMemoryStorage();
    expect(STORAGE_KEYS.buttonY).toBe('iagente.ui.buttonY');
    expect(STORAGE_KEYS.sidebarWidth).toBe('iagente.ui.sidebarWidth');
    expect(STORAGE_KEYS.preferredApp('ai')).toBe('iagente.prefs.app.ai');
    void s;
  });

  it('preferredApp keys differ per capability', () => {
    expect(STORAGE_KEYS.preferredApp('ai')).not.toBe(STORAGE_KEYS.preferredApp('feedback'));
  });
});
