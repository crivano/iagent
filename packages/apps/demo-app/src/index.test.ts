import { describe, it, expect } from 'vitest';
import { DemoAICollaborator } from './index.js';

describe('DemoAICollaborator — the IInteractiveAssistant contract', () => {
  it('lists intents including summarize, review, draft', async () => {
    const ai = new DemoAICollaborator();
    const intents = await ai.listIntents();
    expect(intents.map((i) => i.intent)).toEqual(
      expect.arrayContaining(['summarize', 'review', 'draft']),
    );
  });

  it('begins a session and returns a ready handle with intents', async () => {
    const ai = new DemoAICollaborator();
    const session = await ai.beginSession('review', {
      intent: 'review',
      user: { id: 'u-1', name: 'Judge' },
    });
    expect(session.status).toBe('ready');
    expect(session.sessionId).toMatch(/^demo-ai-/);
    expect(session.intents.length).toBeGreaterThan(0);
  });

  it('each session gets a fresh sessionId', async () => {
    const ai = new DemoAICollaborator();
    const s1 = await ai.beginSession('summarize', {
      intent: 'summarize',
      user: { id: 'u', name: 'u' },
    });
    const s2 = await ai.beginSession('summarize', {
      intent: 'summarize',
      user: { id: 'u', name: 'u' },
    });
    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  it('endSession removes the session without error', async () => {
    const ai = new DemoAICollaborator();
    const session = await ai.beginSession('draft', {
      intent: 'draft',
      user: { id: 'u', name: 'u' },
    });
    await expect(ai.endSession(session.sessionId)).resolves.toBeUndefined();
  });
});
