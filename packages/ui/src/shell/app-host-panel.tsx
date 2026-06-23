/**
 * AppHostPanel — renders the UI of the currently-selected app.
 *
 * Two modes are supported, matching `AppUi` from @iagente/protocol:
 *
 *   1. 'react' — the app provides a React component (bundled at iAgente build
 *      time). We render it directly with the AppRootProps (ctx, session, callHost).
 *   2. 'iframe' — the app is loaded from a remote URL in an <iframe>. We create
 *      the iframe LAZILY (only once the app is selected) and, when the user
 *      switches away, keep the iframe mounted with `display: none` so a
 *      later re-selection is instant (cache).
 *
 * 'headless' apps have no UI; the panel renders a small "running" notice.
 *
 * The iframe lifecycle is:
 *   1. rendered with src = urlBuilder(ctx)
 *   2. onLoad → caller is notified; caller-side code attaches the postMessage
 *      transport and sends the `app.launch` handshake with the LaunchContext.
 *
 * For now the panel only mounts the iframe; transport wiring is added by a
 * separate phase (app-apoia integration).
 */

import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type {
  AppDescriptor,
  AppRootProps,
  LaunchContext,
  SessionHandle,
} from '@iagente/protocol';

export interface AppHostPanelProps {
  /** Descriptor of the app to render. Null while no app is selected. */
  readonly app: AppDescriptor | null;
  /** Launch context (user + case + document + intent). */
  readonly ctx: LaunchContext | null;
  /** Session handle returned by the app's beginSession call. */
  readonly session: SessionHandle | null;
  /** Notified once an iframe finishes loading (so the caller can wire transport). */
  readonly onIframeReady?: (iframe: HTMLIFrameElement) => void;
}

export const AppHostPanel: FC<AppHostPanelProps> = ({ app, ctx, session, onIframeReady }) => {
  if (!app) {
    return (
      <p className="iagente-apphost-placeholder" role="status">
        Selecione um app no menu.
      </p>
    );
  }

  const ui = app.ui;
  switch (ui.type) {
    case 'react':
      return <ReactAppHost app={app} ui={ui} ctx={ctx} session={session} />;
    case 'iframe':
      return <IframeAppHost app={app} ui={ui} session={session} onReady={onIframeReady} />;
    case 'headless':
      return (
        <p className="iagente-apphost-headless" role="status">
          O app &laquo;{app.name}&raquo; está em execução (sem interface).
        </p>
      );
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = ui;
      void _exhaustive;
      return null;
    }
  }
};

// ---------------------------------------------------------------------------
// React slot host
// ---------------------------------------------------------------------------

interface ReactAppHostProps {
  readonly app: AppDescriptor;
  readonly ui: Extract<AppDescriptor['ui'], { type: 'react' }>;
  readonly ctx: LaunchContext | null;
  readonly session: SessionHandle | null;
}

const ReactAppHost: FC<ReactAppHostProps> = ({ app, ui, ctx, session }) => {
  // Apps that haven't been launched yet show a waiting state.
  if (!ctx || !session) {
    return <p className="iagente-apphost-pending" role="status">{app.name} aguardando início…</p>;
  }
  const Root = ui.root as (props: AppRootProps) => React.ReactNode;
  const props: AppRootProps = {
    ctx,
    session,
    callHost: () => {
      // Placeholder: real callHost is injected by the orchestrator once the
      // bus is wired up. Apps that use it should gracefully no-op here.
      throw new Error('callHost not wired yet');
    },
  };
  return <div className="iagente-apphost-react">{Root(props)}</div>;
};

// ---------------------------------------------------------------------------
// iframe host (lazy + hidden cache)
// ---------------------------------------------------------------------------

/**
 * App iframes that have been mounted at least once. Cached in a module-level
 * map keyed by app id, so re-selecting the app is instant. Memory cost is
 * an active iframe per recently-used app; that's acceptable until we have a
 * reason to evict (low-memory hosts, etc).
 *
 * Exported so tests can reset it between cases.
 */
export const __iframeCache = new Map<string, HTMLIFrameElement>();

interface IframeAppHostProps {
  readonly app: AppDescriptor;
  readonly ui: Extract<AppDescriptor['ui'], { type: 'iframe' }>;
  readonly session: SessionHandle | null;
  readonly onReady?: (iframe: HTMLIFrameElement) => void;
}

const IframeAppHost: FC<IframeAppHostProps> = ({ app, ui, session, onReady }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  // Lazily compute the iframe URL once we know the session is starting.
  // (We could also compute at props-change time, but deferring keeps the
  // first paint clean.)
  useEffect(() => {
    // Build the URL only when a session exists (means beginSession was called).
    if (!session) return;
    // urlBuilder expects a ctx; provide a minimal stub (real ctx is delivered
    // via post-handshake `app.launch`). This matches the "URL params legacy
    // + handshake" decision.
    const url = ui.urlBuilder({
      intent: 'launch' as never,
      user: { id: 'pre-handshake', name: '' },
    });
    setSrc(url);
  }, [session, ui]);

  // Mount the cached iframe, or create one if missing. Toggle display based
  // on whether we're "selected" (we always are in this component — the parent
  // reuses the cached element across selections).
  useEffect(() => {
    if (!src || !hostRef.current) return;

    let iframe = __iframeCache.get(app.id);
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.className = 'iagente-apphost-iframe';
      iframe.title = app.name;
      iframe.setAttribute('allow', 'clipboard-write; popup');
      iframe.addEventListener('load', () => {
        if (iframe) onReady?.(iframe);
      });
      __iframeCache.set(app.id, iframe);
    }
    // Always update src to the freshly-built URL (it may differ across launches).
    iframe.src = src;
    iframe.style.display = 'block';

    // Append if not already a child of the host div.
    if (iframe.parentElement !== hostRef.current) {
      hostRef.current.appendChild(iframe);
    }

    return () => {
      // Hide instead of unmount — preserves app state across selections.
      if (iframe) iframe.style.display = 'none';
    };
  }, [src, app.id, app.name, onReady]);

  return (
    <div ref={hostRef} className="iagente-apphost-iframe-container" role="presentation">
      {!session && <p className="iagente-apphost-pending">Carregando {app.name}…</p>}
    </div>
  );
};
