import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Menu } from './menu.js';
import type { AppDescriptor } from '@iagente/protocol';

const mkApp = (
  id: string,
  partial: Partial<AppDescriptor> = {},
): AppDescriptor => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  categories: ['ai'],
  capability: 'ai',
  ui: { type: 'headless' },
  createAssistant: () => ({
    capabilityId: 'ai',
    listIntents: async () => [],
    beginSession: async () => ({ sessionId: 's', status: 'ready', intents: [] }),
    endSession: async () => {},
  }),
  ...partial,
});

describe('Menu', () => {
  it('shows an empty message when no apps are provided', () => {
    const { getByRole } = render(<Menu apps={[]} onSelectApp={() => {}} />);
    expect(getByRole('status').textContent).toContain('Nenhum app');
  });

  it('groups apps by category using known labels', () => {
    const apps = [mkApp('apoia'), mkApp('assis'), mkApp('nps', { categories: ['feedback'], capability: 'feedback' })];
    const { getByText } = render(<Menu apps={apps} onSelectApp={() => {}} />);
    expect(getByText('Assistentes de IA')).toBeTruthy();
    expect(getByText('Avaliação')).toBeTruthy();
  });

  it('calls onSelectApp when an item is clicked', () => {
    const apps = [mkApp('apoia')];
    let clicked = '';
    const { getByRole } = render(<Menu apps={apps} onSelectApp={(id) => (clicked = id)} />);
    fireEvent.click(getByRole('button', { name: /Apoia/i }));
    expect(clicked).toBe('apoia');
  });

  it('marks the selected app with aria-pressed', () => {
    const apps = [mkApp('apoia'), mkApp('assis')];
    const { getByRole } = render(
      <Menu apps={apps} onSelectApp={() => {}} selectedAppId="apoia" />,
    );
    expect(getByRole('button', { name: /Apoia/i }).getAttribute('aria-pressed')).toBe('true');
    expect(getByRole('button', { name: /Assis/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('renders app icons when present', () => {
    const apps = [mkApp('apoia', { icon: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' })];
    const { container } = render(<Menu apps={apps} onSelectApp={() => {}} />);
    expect(container.querySelector('img.iagente-menu__icon')).toBeTruthy();
  });

  it('lists an app under multiple categories it belongs to', () => {
    const apps = [mkApp('multi', { categories: ['ai', 'feedback'] })];
    const { getAllByText } = render(<Menu apps={apps} onSelectApp={() => {}} />);
    // Multi is listed once per category → 2 instances.
    expect(getAllByText('Multi').length).toBe(2);
  });
});
