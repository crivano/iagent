import { describe, it, expect } from 'vitest';
import {
  detectHost,
  type DetectorDeps,
  type HostAdapter,
  type HostCapabilities,
  type HostContext,
} from './host-detector.js';

const mkAdapter = (id: string, opts: Partial<HostAdapter['descriptor']>): HostAdapter => ({
  descriptor: { id, name: id, ...opts },
  activate: (_ctx: HostContext): HostCapabilities => ({}),
});

const mkDeps = (url: string, selectors: Record<string, boolean>): DetectorDeps => ({
  url,
  querySelector: (sel) => (selectors[sel] ? ({} as Element) : null),
});

describe('detectHost — URL/DOM scoring', () => {
  it('matches a single adapter by URL pattern', () => {
    const a = mkAdapter('eproc', { urlPatterns: ['https://eproc.example/*'] });
    const result = detectHost([a], mkDeps('https://eproc.example/case/123', {}));
    expect(result?.adapter.descriptor.id).toBe('eproc');
    expect(result?.score.score).toBe(2); // +2 for URL match
  });

  it('combines URL and DOM selector scores', () => {
    const a = mkAdapter('pje', {
      urlPatterns: ['https://pje.example/*'],
      selectors: ['#pje-root', '.pje-toolbar'],
    });
    const result = detectHost(
      [a],
      mkDeps('https://pje.example/x', { '#pje-root': true, '.pje-toolbar': true }),
    );
    expect(result?.adapter.descriptor.id).toBe('pje');
    expect(result?.score.score).toBe(4); // 2 + 1 + 1
  });

  it('picks the highest-scoring adapter when several match', () => {
    const a = mkAdapter('eproc', { urlPatterns: ['*'] }); // matches all, +2
    const b = mkAdapter('pje', {
      urlPatterns: ['https://pje.example/*'],
      selectors: ['#pje-root'],
    });
    // Page is PJe-like
    const result = detectHost(
      [a, b],
      mkDeps('https://pje.example/x', { '#pje-root': true }),
    );
    expect(result?.adapter.descriptor.id).toBe('pje'); // 2+1=3 > 2
  });

  it('returns null when nothing matches', () => {
    const a = mkAdapter('eproc', { urlPatterns: ['https://eproc/*'] });
    const result = detectHost([a], mkDeps('https://random.example/', {}));
    expect(result).toBeNull();
  });

  it('returns null when adapters list is empty', () => {
    const result = detectHost([], mkDeps('https://x/', {}));
    expect(result).toBeNull();
  });

  it('does not match a non-wildcard pattern partially', () => {
    const a = mkAdapter('exact', { urlPatterns: ['https://x/exact'] });
    const result = detectHost([a], mkDeps('https://x/exact/extra', {}));
    expect(result).toBeNull();
  });
});
