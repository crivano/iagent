/**
 * App descriptor + App UI shape.
 *
 * Apps (Apoia, Assis, NPS) are described declaratively so the iAgente kernel
 * and UI shell can work with them generically (render menu, mount UI, route
 * RPC) without knowing each app's concrete implementation.
 *
 * The `AppUi` union captures the three container modes agreed with the user:
 *  - 'iframe': external app loaded in an <iframe> via postMessage
 *              (e.g. Apoia at https://apoia.pdpj.jus.br)
 *  - 'react':  UI component bundled into iAgente and rendered inside the
 *              sidebar (e.g. an NPS form, a notes panel)
 *  - 'headless': no UI; the assistant's `beginSession` does its thing silently
 *                and returns results via host capabilities
 */

import type { CapabilityKey } from './index.js';
import type {
  AssistantIntent,
  IntentCategory,
  IInteractiveAssistant,
  LaunchContext,
  SessionHandle,
} from './index.js';

/**
 * React container mode props (used only when `ui.type === 'react'`).
 *
 * Declared as a structural type so the protocol package doesn't import React.
 * The UI package bridges this to the real `React.FC<AppRootProps>`.
 */
export interface AppRootProps {
  readonly ctx: LaunchContext;
  readonly session: SessionHandle;
  /** Function the component can call to read/send host data. */
  readonly callHost: <K extends CapabilityKey>(
    key: K,
  ) => import('./index.js').CapabilityCatalog[K];
}

/** Discriminated union describing how an app's UI is hosted. */
export type AppUi =
  | {
      readonly type: 'iframe';
      /**
       * Builds the initial iframe URL for a given launch context.
       *
       * Legacy apps (e.g. Apoia today) interpolate process/instance/action via
       * query string params; newer apps may return a fixed URL and rely on the
       * `app.launch` JSON-RPC handshake alone for context delivery.
       */
      readonly urlBuilder: (ctx: LaunchContext) => string;
      /** Origins permitted to send `postMessage` to/from this iframe. */
      readonly allowedOrigins: readonly string[];
      /**
       * When true, the iframe ignores URL params entirely and waits for the
       * post-handshake `app.launch` message. Used by apps targeting the new
       * protocol (future versions of Apoia, Assis, etc.).
       */
      readonly handshakeOnly?: boolean;
    }
  | {
      readonly type: 'react';
      readonly root: (props: AppRootProps) => unknown;
    }
  | {
      readonly type: 'headless';
    };

/**
 * Static descriptor of a pluggable app.
 *
 * Combines: enrollable metadata (id/name/category/icon) + capability binding
 * (which CapabilityKey the assistant implements) + UI mode.
 *
 * The descriptor does NOT instantiate anything — that's the responsibility of
 * `createAssistant()`, invoked lazily by the kernel once the app is selected.
 */
export interface AppDescriptor<
  T extends string = AssistantIntent,
  K extends CapabilityKey = CapabilityKey,
> {
  /** Stable id (e.g. "apoia", "assis", "nps-siga"). */
  readonly id: string;
  /** Display name shown in the menu. */
  readonly name: string;
  /** Capabilities this app OFFERS (used to group/filter in the menu). */
  readonly categories: readonly IntentCategory[];
  /** The CapabilityKey this app implements as an IInteractiveAssistant. */
  readonly capability: K;
  readonly icon?: string;
  readonly ui: AppUi;
  /** Default priority when auto-selecting per capability. Higher wins. */
  readonly priority?: number;
  /** Factory that instantiates the assistant implementation. */
  readonly createAssistant: () => IInteractiveAssistant<T>;
}
