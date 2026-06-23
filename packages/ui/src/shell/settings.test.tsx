import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Settings } from './settings.js';
import { createInMemoryStorage, STORAGE_KEYS } from '@iagente/storage';
import type { AppDescriptor } from '@iagente/protocol';

const mkApp = (id: string, cap: AppDescriptor['capability']): AppDescriptor => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  categories: [cap === 'ai' ? 'ai' : 'feedback'],
  capability: cap,
  ui: { type: 'headless' },
  createAssistant: () => ({
    capabilityId: cap,
    listIntents: async () => [],
    beginSession: async () => ({ sessionId: 's', status: 'ready', intents: [] }),
    endSession: async () => {},
  }),
});

describe('Settings', () => {
  it('renders a select per capability with multiple apps', () => {
    const storage = createInMemoryStorage();
    const apps = [mkApp('apoia', 'ai'), mkApp('assis', 'ai')];
    const { getByText, container } = render(
      <Settings apps={apps} storage={storage} onSelectPreferred={() => {}} />,
    );
    expect(getByText('App de IA preferido')).toBeTruthy();
    expect(container.querySelectorAll('select').length).toBe(1);
    expect(container.querySelectorAll('option').length).toBe(2);
  });

  it('does not render a select for a capability with no apps', () => {
    const storage = createInMemoryStorage();
    const apps = [mkApp('apoia', 'ai')];
    const { container, queryByText } = render(
      <Settings apps={apps} storage={storage} onSelectPreferred={() => {}} />,
    );
    // Only AI section is shown (1 app). Feedback is skipped because no apps.
    expect(container.querySelectorAll('select').length).toBe(1);
    expect(queryByText('App de avaliação preferido')).toBeNull();
  });

  it('defaults the selector to the stored preference', () => {
    const storage = createInMemoryStorage();
    storage.set(STORAGE_KEYS.preferredApp('ai'), 'assis');
    const apps = [mkApp('apoia', 'ai'), mkApp('assis', 'ai')];
    const { container } = render(
      <Settings apps={apps} storage={storage} onSelectPreferred={() => {}} />,
    );
    const select = container.querySelector('select')!;
    expect(select.value).toBe('assis');
  });

  it('defaults to first app when no stored preference exists', () => {
    const storage = createInMemoryStorage();
    const apps = [mkApp('apoia', 'ai'), mkApp('assis', 'ai')];
    const { container } = render(
      <Settings apps={apps} storage={storage} onSelectPreferred={() => {}} />,
    );
    expect(container.querySelector('select')!.value).toBe('apoia');
  });

  it('persists the selection to storage on change', () => {
    const storage = createInMemoryStorage();
    const apps = [mkApp('apoia', 'ai'), mkApp('assis', 'ai')];
    const { container } = render(
      <Settings apps={apps} storage={storage} onSelectPreferred={() => {}} />,
    );
    fireEvent.change(container.querySelector('select')!, { target: { value: 'assis' } });
    expect(storage.get<string>(STORAGE_KEYS.preferredApp('ai'))).toBe('assis');
  });

  it('fires onSelectPreferred(cap, id) on change', () => {
    const storage = createInMemoryStorage();
    const apps = [mkApp('apoia', 'ai'), mkApp('assis', 'ai')];
    const calls: Array<[string, string]> = [];
    const { container } = render(
      <Settings
        apps={apps}
        storage={storage}
        onSelectPreferred={(cap, id) => calls.push([cap, id])}
      />,
    );
    fireEvent.change(container.querySelector('select')!, { target: { value: 'assis' } });
    expect(calls).toEqual([['ai', 'assis']]);
  });

  it('shows empty state when no configurable capabilities exist', () => {
    const storage = createInMemoryStorage();
    const { container } = render(
      <Settings apps={[]} storage={storage} onSelectPreferred={() => {}} />,
    );
    expect(container.textContent).toContain('Nenhuma preferência configurável');
  });
});
