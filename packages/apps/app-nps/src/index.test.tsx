import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NpsAssistant, NpsRoot, npsApp } from './index.js';
import type { AppRootProps } from '@iagente/protocol';

const fakeRootProps: AppRootProps = {
  ctx: { intent: 'collect-feedback', user: { id: 'u', name: 'T' } },
  session: { sessionId: 's1', status: 'ready', intents: [] },
  callHost: () => {
    throw new Error('not used');
  },
};

describe('NpsAssistant — IFeedbackCollector contract', () => {
  it('lists the collect-feedback intent', async () => {
    const a = new NpsAssistant();
    const intents = await a.listIntents();
    expect(intents.map((i) => i.intent)).toEqual(['collect-feedback']);
  });

  it('begins a session labelled nps-*', async () => {
    const a = new NpsAssistant();
    const s = await a.beginSession('collect-feedback', fakeRootProps.ctx);
    expect(s.sessionId).toMatch(/^nps-/);
    expect(s.status).toBe('ready');
  });

  it('endSession is a no-op', async () => {
    const a = new NpsAssistant();
    await expect(a.endSession('any')).resolves.toBeUndefined();
  });
});

describe('NpsRoot — the form', () => {
  it('renders an 11-button scale (0–10)', () => {
    const { getAllByRole } = render(<NpsRoot {...fakeRootProps} />);
    const radios = getAllByRole('radio');
    expect(radios).toHaveLength(11);
    expect(radios[0]!.textContent).toBe('0');
    expect(radios[10]!.textContent).toBe('10');
  });

  it('disables submit until a rating is chosen', () => {
    const { getByRole } = render(<NpsRoot {...fakeRootProps} />);
    const submit = getByRole('button', { name: /enviar/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit when a rating is selected', () => {
    const { getAllByRole, getByRole } = render(<NpsRoot {...fakeRootProps} />);
    fireEvent.click(getAllByRole('radio')[7]!);
    const submit = getByRole('button', { name: /enviar/i });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a thank-you message on submit', () => {
    const { getAllByRole, getByRole, getByText } = render(<NpsRoot {...fakeRootProps} />);
    fireEvent.click(getAllByRole('radio')[9]!);
    fireEvent.click(getByRole('button', { name: /enviar/i }));
    expect(getByText(/obrigado/i)).toBeTruthy();
    expect(getByText(/9\/10/)).toBeTruthy();
  });

  it('updates the textarea when typing', () => {
    const { getByPlaceholderText } = render(<NpsRoot {...fakeRootProps} />);
    const ta = getByPlaceholderText(/comentário/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'ótimo sistema' } });
    expect(ta.value).toBe('ótimo sistema');
  });
});

describe('npsApp — descriptor', () => {
  it('is the feedback-capability bundled-react app', () => {
    expect(npsApp.id).toBe('nps');
    expect(npsApp.capability).toBe('feedback');
    expect(npsApp.ui.type).toBe('react');
  });

  it('createAssistant returns an NpsAssistant instance', () => {
    const a = npsApp.createAssistant();
    expect(a.constructor.name).toBe('NpsAssistant');
  });
});
