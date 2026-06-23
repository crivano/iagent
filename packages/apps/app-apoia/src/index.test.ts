import { describe, it, expect } from 'vitest';
import { ApoiaAssistant, apoiaApp, buildApoiaUrl } from './index.js';
import type { LaunchContext } from '@iagente/protocol';

describe('buildApoiaUrl', () => {
  const baseCtx: LaunchContext = {
    intent: 'review',
    user: { id: 'u', name: 'T' },
    case: { number: '50283654220254025001' },
  };

  it('builds the keycloak-iframe URL with the encoded redirect param', () => {
    const url = buildApoiaUrl(baseCtx);
    expect(url.startsWith('https://apoia.pdpj.jus.br/auth/keycloak-iframe?redirect=')).toBe(true);
  });

  it('encodes the process number in the redirect value', () => {
    const url = buildApoiaUrl(baseCtx);
    expect(url).toContain('process=50283654220254025001');
  });

  it('defaults instance=primeiro-grau and action=processo_selecionar', () => {
    const url = buildApoiaUrl(baseCtx);
    expect(url).toContain('instance=primeiro-grau');
    expect(url).toContain('action=processo_selecionar');
  });

  it('uses %26 as the separator inside the redirect param (legacy Apoia convention)', () => {
    const url = buildApoiaUrl(baseCtx);
    expect(url).toContain('&' === '&' ? '%26' : '');
    expect(url).not.toMatch(/redirect=\/sidekick\?process=.*?&instance=/);
    // (i.e. no raw '&' between process=... and instance=...)
  });

  it('sets a prompt based on the intent', () => {
    expect(buildApoiaUrl({ ...baseCtx, intent: 'review' })).toContain('prompt=revisao-de-texto');
    expect(buildApoiaUrl({ ...baseCtx, intent: 'minuta' })).toContain('prompt=minuta-de-sentenca');
    expect(buildApoiaUrl({ ...baseCtx, intent: 'chat' })).toContain('prompt=chat');
  });

  it('overrides prompt via ctx.extra.prompt', () => {
    const url = buildApoiaUrl({ ...baseCtx, extra: { prompt: 'custom-prompt' } });
    expect(url).toContain('prompt=custom-prompt');
  });

  it('overrides instance and action via ctx.extra', () => {
    const url = buildApoiaUrl({
      ...baseCtx,
      extra: { instance: 'segundo-grau', action: 'minuta_editar' },
    });
    expect(url).toContain('instance=segundo-grau');
    expect(url).toContain('action=minuta_editar');
  });
});

describe('ApoiaAssistant', () => {
  it('lists review, minuta, chat intents', async () => {
    const a = new ApoiaAssistant();
    const intents = (await a.listIntents()).map((i) => i.intent);
    expect(intents.sort()).toEqual(['chat', 'minuta', 'review']);
  });

  it('begins a session in starting status', async () => {
    const a = new ApoiaAssistant();
    const s = await a.beginSession('review', {
      intent: 'review',
      user: { id: 'u', name: 'T' },
      case: { number: '123' },
    });
    expect(s.status).toBe('starting');
    expect(s.sessionId).toMatch(/^apoia-/);
  });

  it('endSession is a no-op', async () => {
    const a = new ApoiaAssistant();
    await expect(a.endSession('any')).resolves.toBeUndefined();
  });
});

describe('apoiaApp descriptor', () => {
  it('declares iframe UI with allowed origins', () => {
    expect(apoiaApp.ui.type).toBe('iframe');
    if (apoiaApp.ui.type === 'iframe') {
      expect(apoiaApp.ui.allowedOrigins).toContain('https://apoia.pdpj.jus.br');
    }
  });

  it('binds to the ai capability as priority 10 (recommended default)', () => {
    expect(apoiaApp.capability).toBe('ai');
    expect(apoiaApp.priority).toBe(10);
  });

  it('createAssistant returns an ApoiaAssistant instance', () => {
    expect(apoiaApp.createAssistant().constructor.name).toBe('ApoiaAssistant');
  });
});
