/**
 * @iagente/runtime-script-tag — the entrypoint bundle injected into host pages
 * via a <script> tag. Bootstraps the kernel against whatever host system the
 * current page belongs to.
 *
 * Responsibilities:
 * 1. Build the list of host adapters + app descriptors (build-time inclusion).
 * 2. Bootstrap the kernel: detect host → activate → register capabilities.
 * 3. Register all known apps (Apoia, NPS) into the AppRegistry + bus.
 * 4. Apply the user's persisted preferred apps.
 * 5. Inject the host-side layout CSS (squeezes <body> when the sidebar opens).
 * 6. Mount the React IagenteShell (FloatingButton + SplitPane + Menu + AppHost).
 */

import {
  AppRegistry,
  CapabilityBus,
  applyPreferredApp,
  bootstrap,
  buildContextFor,
  registerApp,
} from '@iagente/core';
import type { HostAdapter } from '@iagente/core';
import { demoHostAdapter } from '@iagente/host-demo';
import { apoiaApp } from '@iagente/app-apoia';
import { npsApp } from '@iagente/app-nps';
import {
  AppHostPanel,
  IagenteShell,
  Menu,
  Settings,
  SHELL_CSS,
  createOverlay,
} from '@iagente/ui';
import {
  createLocalStorage,
  STORAGE_KEYS,
  type IStorage,
} from '@iagente/storage';
import type {
  AppDescriptor,
  AssistantIntent,
  CapabilityKey,
  LaunchContext,
  SessionHandle,
} from '@iagente/protocol';
import { useMemo, useState } from 'react';
import type { FC } from 'react';

/**
 * All host adapters compiled into this bundle.
 */
export const HOST_ADAPTERS: readonly HostAdapter[] = [demoHostAdapter];

/**
 * All known AppDescriptors compiled into this bundle.
 */
export const APP_DESCRIPTORS: readonly AppDescriptor[] = [apoiaApp, npsApp];

/**
 * Layout CSS injected INTO the host page's <head> so the iAgente sidebar
 * SQUEEZES the host content. Toggled by adding/removing the `iagente-open`
 * class on <html> when the shell opens/closes.
 */
export const HOST_LAYOUT_CSS = `
  html.iagente-open body {
    padding-right: var(--iagente-width, 380px) !important;
    transition: padding-right .15s ease;
  }
`;

/**
 * The runtime entrypoint: detect the host, register caps + apps, mount the
 * overlay with the IagenteShell, and return a session handle.
 */
export function startIagente(opts: {
  readonly document?: Document;
  readonly window?: Window;
} = {}): { dispose(): void } {
  const doc = opts.document ?? document;
  const win = opts.window ?? window;

  const storage: IStorage = createLocalStorage();
  const bus = new CapabilityBus();
  const appRegistry = new AppRegistry();

  // --- 1. Host detection + capability registration ---
  const hostSession = bootstrap(bus, HOST_ADAPTERS, {
    url: win.location.href,
    document: doc,
    window: win,
    querySelector: (sel: string) => doc.querySelector(sel),
  });

  if (!hostSession.hostId) {
    return { dispose: () => hostSession.dispose() };
  }

  // --- 2. Register all apps (descriptors + assistants) ---
  const appDisposers = APP_DESCRIPTORS.map((desc) => registerApp(bus, appRegistry, desc));

  // --- 3. Apply persisted preferred apps ---
  for (const cap of ['ai', 'feedback'] as const) {
    applyPreferredApp(bus, appRegistry, storage, cap, STORAGE_KEYS);
  }

  // --- 4. Inject host-side layout CSS (once) ---
  const layoutStyleId = 'iagente-layout';
  let layoutStyle = doc.getElementById(layoutStyleId) as HTMLStyleElement | null;
  if (!layoutStyle) {
    layoutStyle = doc.createElement('style');
    layoutStyle.id = layoutStyleId;
    layoutStyle.textContent = HOST_LAYOUT_CSS;
    doc.head.appendChild(layoutStyle);
  }

  // --- 5. Mount overlay + IagenteShell ---
  const overlay = createOverlay({ css: SHELL_CSS, hostTag: 'iagente-overlay', document: doc });

  const openHost = () => doc.documentElement.classList.add('iagente-open');
  const closeHost = () => doc.documentElement.classList.remove('iagente-open');

  overlay.render(
    <RuntimeRoot
      storage={storage}
      bus={bus}
      appRegistry={appRegistry}
      hostId={hostSession.hostId}
      onShellOpen={openHost}
      onShellClose={closeHost}
    />,
  );

  return {
    dispose() {
      overlay.unmount();
      closeHost();
      layoutStyle?.remove();
      appDisposers.forEach((d) => d());
      hostSession.dispose();
    },
  };
}

/**
 * RuntimeRoot — top-level React component bound to the kernel singletons.
 */
interface RuntimeRootProps {
  readonly storage: IStorage;
  readonly bus: CapabilityBus;
  readonly appRegistry: AppRegistry;
  readonly hostId: string;
  readonly onShellOpen: () => void;
  readonly onShellClose: () => void;
}

const RuntimeRoot: FC<RuntimeRootProps> = ({
  storage,
  bus,
  appRegistry,
  hostId,
  onShellOpen,
  onShellClose,
}) => {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [launchCtx, setLaunchCtx] = useState<LaunchContext | null>(null);
  const [sessionHandle, setSessionHandle] = useState<SessionHandle | null>(null);

  const registeredApps = useMemo(() => appRegistry.list(), [appRegistry]);
  const selectedApp = useMemo(
    () => registeredApps.find((a) => a.id === selectedAppId) ?? null,
    [registeredApps, selectedAppId],
  );

  // Launch the selected app: build a LaunchContext, call beginSession.
  const handleSelectApp = async (appId: string) => {
    // End any previous session first.
    if (selectedApp && sessionHandle) {
      const prev = appRegistry.getApp(selectedApp.id);
      try {
        await prev?.createAssistant().endSession(sessionHandle.sessionId);
      } catch {
        // best-effort cleanup
      }
    }
    const app = appRegistry.getApp(appId);
    if (!app) return;
    const assistant = app.createAssistant();
    const ctx = await buildContextFor(bus, { id: 'anon', name: 'Anônimo' });
    const launch: LaunchContext = {
      intent: 'collect-feedback' as AssistantIntent,
      user: ctx.user,
      case: ctx.case,
      document: ctx.document,
    };
    const intents = await assistant.listIntents();
    if (intents.length > 0) {
      launch.intent = intents[0]!.intent as AssistantIntent;
    }
    const handle = await assistant.beginSession(launch.intent, launch);
    setSelectedAppId(appId);
    setLaunchCtx(launch);
    setSessionHandle(handle);
    setShowSettings(false);
  };

  const handleSelectPreferred = (capability: CapabilityKey, appId: string) => {
    if (bus.listProviders(capability).includes(appId)) {
      bus.setActive(capability, appId);
    }
  };

  return (
    <IagenteShell
      storage={storage}
      title={`iAgente — ${hostId}`}
      onOpen={onShellOpen}
      onClose={onShellClose}
      renderHeaderExtras={() => (
        <button
          type="button"
          aria-label="Configurações"
          className="iagente-pane__settings"
          onClick={() => setShowSettings((v) => !v)}
        >
          ⚙
        </button>
      )}
      renderBody={() =>
        showSettings ? (
          <Settings
            apps={registeredApps}
            storage={storage}
            onSelectPreferred={handleSelectPreferred}
          />
        ) : (
          <>
            <Menu
              apps={registeredApps}
              onSelectApp={handleSelectApp}
              selectedAppId={selectedAppId ?? undefined}
            />
            <div style={{ marginTop: 12 }}>
              <AppHostPanel
                app={selectedApp}
                ctx={launchCtx}
                session={sessionHandle}
                onIframeReady={(iframe) => {
                  void iframe;
                }}
              />
            </div>
          </>
        )
      }
    />
  );
};

/**
 * Auto-start hook: when this bundle is loaded as a script tag in a browser,
 * start iAgente automatically as soon as the DOM is ready.
 *
 * DISABLED in test environments (vitest/jest) so unit tests can call
 * startIagente() themselves without racing an auto-started instance. The
 * detection covers both the NODE_ENV marker and Vitest's worker global.
 */
const IS_TEST_ENV =
  typeof process !== 'undefined' &&
  (process.env?.NODE_ENV === 'test' ||
    (globalThis as { __vitest_worker__?: unknown }).__vitest_worker__ !== undefined);

if (
  typeof document !== 'undefined' &&
  !IS_TEST_ENV &&
  // Skip if a previous iAgente instance already created an overlay.
  !document.querySelector('iagente-overlay')
) {
  const autoStart = () => {
    try {
      startIagente();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[iAgente] failed to start:', err);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoStart, { once: true });
  } else {
    autoStart();
  }
}
