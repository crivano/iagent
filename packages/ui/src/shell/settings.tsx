/**
 * Settings — user preferences panel.
 *
 * Currently shows one selector per capability that has multiple registered
 * providers, so the user can pick the default ("preferred") app for it.
 * Selections persist via `IStorage` and are notified back to the shell via
 * `onSelectPreferred(capability, appId)` so the CapabilityBus can be updated.
 */

import { useState, type FC } from 'react';
import type { AppDescriptor, CapabilityKey } from '@iagente/protocol';
import type { IStorage } from '@iagente/storage';
import { STORAGE_KEYS } from '@iagente/storage';

export interface SettingsProps {
    /** Apps registered with iAgente (used to populate selectors). */
    readonly apps: readonly AppDescriptor[];
    /** Storage used to persist preferences. */
    readonly storage: IStorage;
    /**
     * Called whenever the user changes a preferred app.
     * The shell should react by calling `bus.setActive(capability, appId)`.
     */
    readonly onSelectPreferred: (capability: CapabilityKey, appId: string) => void;
    /** Capabilities that should appear (even if only one provider), in order. */
    readonly visibleCapabilities?: readonly CapabilityKey[];
}

const DEFAULT_VISIBLE: readonly CapabilityKey[] = ['ai', 'feedback'];

const CAPABILITY_LABELS: Record<string, string> = {
    ai: 'App de IA preferido',
    feedback: 'App de avaliação preferido',
    case: 'Sistema de processo',
    document: 'Editor de documentos',
    auth: 'Auth helper',
};

export const Settings: FC<SettingsProps> = ({
    apps,
    storage,
    onSelectPreferred,
    visibleCapabilities = DEFAULT_VISIBLE,
}) => {
    // Build capability -> app-options map.
    const capsWithOptions: Array<{
        readonly cap: CapabilityKey;
        readonly options: readonly AppDescriptor[];
    }> = [];
    for (const cap of visibleCapabilities) {
        const options = apps.filter((a) => a.capability === cap);
        if (options.length > 0) capsWithOptions.push({ cap, options });
    }
    const capsWithOptionsReadonly: readonly {
        readonly cap: CapabilityKey;
        readonly options: readonly AppDescriptor[];
    }[] = capsWithOptions;

    if (capsWithOptionsReadonly.length === 0) {
        return <p className="iagente-settings-empty">Nenhuma preferência configurável.</p>;
    }

    return (
        <div className="iagente-settings">
            <h2 className="iagente-settings__title">Preferências</h2>
            {capsWithOptionsReadonly.map(({ cap, options }) => (
                <div>
                    <PerCapabilitySelect
                        key={cap}
                        cap={cap}
                        options={options}
                        storage={storage}
                        onSelectPreferred={onSelectPreferred}
                    />
                </div>))}
        </div>
    );
};

interface PerCapabilitySelectProps {
    readonly cap: CapabilityKey;
    readonly options: readonly AppDescriptor[];
    readonly storage: IStorage;
    readonly onSelectPreferred: (capability: CapabilityKey, appId: string) => void;
}

const PerCapabilitySelect: FC<PerCapabilitySelectProps> = ({
    cap,
    options,
    storage,
    onSelectPreferred,
}) => {
    const storedId = storage.getOrDefault<string>(STORAGE_KEYS.preferredApp(cap), options[0]?.id ?? '');
    const [selected, setSelected] = useState(storedId);

    const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        setSelected(next);
        storage.set(STORAGE_KEYS.preferredApp(cap), next);
        onSelectPreferred(cap, next);
    };

    return (
        <label className="iagente-settings__row">
            <span className="iagente-settings__row-label">
                {CAPABILITY_LABELS[cap] ?? cap}
            </span>
            <select className="iagente-settings__select" value={selected} onChange={onChange}>
                {options.map((app) => (
                    <option key={app.id} value={app.id}>
                        {app.name}
                    </option>
                ))}
            </select>
        </label>
    );
};
