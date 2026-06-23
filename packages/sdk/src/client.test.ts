/**
 * Smoke test for the public SDK surface. Full postMessage integration is
 * exercised end-to-end in the runtime/script-tag package.
 */
import { describe, it, expect } from 'vitest';
import { connect, serve } from './index.js';

describe('@iagente/app-sdk — public surface', () => {
  it('exports connect and serve as functions', () => {
    expect(typeof connect).toBe('function');
    expect(typeof serve).toBe('function');
  });

  it('connect() returns an IagenteConnection with host/capability/close', () => {
    // jsdom provides window. connect() expects to run in a browser/iframe.
    const conn = connect({ allowedOrigins: '*' });
    expect(typeof conn.host).toBe('function');
    expect(typeof conn.capability).toBe('function');
    expect(typeof conn.close).toBe('function');
    conn.close();
  });

  it('serve() returns a disposer function', () => {
    const fake = {
      async summarize() {
        return { summary: 'x', wordCount: 1 };
      },
    };
    const stop = serve(fake, 'ai', { allowedOrigins: '*' });
    expect(typeof stop).toBe('function');
    stop();
  });
});
