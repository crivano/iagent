/**
 * Domain capability interfaces.
 *
 * These are the contracts that decouple hosts from apps.
 *
 * Design rules:
 * - Hosts (eproc, PJe, SEI, Siga-Doc) implement the host-side interfaces.
 * - Apps (Apoia, Assis, NPS) implement the app-side interfaces.
 * - The iAgente kernel routes calls between them by INTERFACE TYPE, never by
 *   implementation name. So a button that needs "summarize text" asks the
 *   Capability Registry for any IAICollaborator, not for "the Apoia".
 * - This achieves N hosts × M apps = N+M adapters (not N×M classes).
 *
 * Each interface declares an `@type` string used to namespace JSON-RPC methods
 * (see @iagente/rpc createRpcProxy): a method `foo` on interface with namespace
 * `ai` becomes JSON-RPC method `ai.foo`.
 */

/** Unique identifier for a domain capability interface. Maps to RPC namespace. */
export type CapabilityId = string;

// type alias re-export to avoid a circular import within the protocol package
import type { Json } from '../json-rpc.js';

// --- Shared payloads --------------------------------------------------------

/** Identity of the current operator, passed to an app when launched. */
export interface UserIdentity {
  readonly id: string;
  readonly name: string;
  readonly roles?: readonly string[];
}

/** Reference to the document currently open in the host. */
export interface DocumentRef {
  readonly id: string;
  readonly title?: string;
  readonly mimeType?: string;
}

/** Reference to the case / administrative proceeding currently open. */
export interface CaseRef {
  readonly number: string;
  readonly title?: string;
}

/**
 * Context payload passed when launching an app or invoking its capability.
 * Combines: document/case data + user identity + intent.
 */
export interface ContextPayload {
  readonly user: UserIdentity;
  readonly document?: DocumentRef;
  readonly case?: CaseRef;
  /** Free-form metadata for extensibility. */
  readonly meta?: Readonly<Record<string, string>>;
}

/**
 * Intent describes WHICH capability is being requested and with what arguments.
 * Sent over the wire as JSON-RPC params when host triggers an app action.
 */
export interface IntentPayload<TParams extends Json = Json> {
  readonly capability: CapabilityId;
  readonly action: string;
  readonly params?: TParams;
}

/** Handler signature for a capability method. */
export type CapabilityHandler<TParams, TResult> = (
  params: TParams,
  ctx: ContextPayload,
) => Promise<TResult> | TResult;

// --- Host-side capabilities -------------------------------------------------

/**
 * Sistemas de processo judicial: eproc, PJe, …
 *
 * Implemented by host adapters that manage court/electronic-lawsuit cases.
 */
export interface ICaseManagementSystem {
  readonly capabilityId: 'case';
  /** Returns the case currently open in the host, or null. */
  getOpenCase(ctx: ContextPayload): Promise<CaseRef | null>;
  /** Returns a list of procedural parties (partes). */
  getParties(ctx: ContextPayload): Promise<readonly Party[]>;
  /** Returns procedural history (andamentos). */
  getMovements(ctx: ContextPayload): Promise<readonly Movement[]>;
}

export interface Party {
  readonly name: string;
  readonly role: string; // polo ativo/passivo label
}

export interface Movement {
  readonly date: string; // ISO-8601
  readonly description: string;
}

/**
 * Context for a host-call issued during an active app session.
 *
 * Apps call `host.readCurrentContent()`, `host.getSinkConfig()`, etc. passing
 * this context to identify which session/document they're acting on.
 */
export interface SessionContext {
  readonly sessionId: string;
  readonly intent: AssistantIntent;
  readonly user: UserIdentity;
  readonly document?: DocumentRef;
}

/** Snapshot of a document's content (used by apps during a session). */
export interface DocumentContent {
  /** Raw HTML content (matches the historical Apoia format). */
  readonly html: string;
  /** Plain-text convenience. */
  readonly plainText: string;
  /** Selection range within the document, when applicable. */
  readonly selectionInfo?: { readonly startOffset: number; readonly endOffset: number };
}

/**
 * Sink configuration — how the app should deliver its result back to the host.
 * Replaces the historical `get-sink`/`set-sink` Apoia messages.
 */
export interface SinkConfig {
  readonly kind: 'to-parent' | 'download' | 'copy';
  readonly buttonText?: string;
  /** Hint about where the result will be delivered (e.g. eproc field). */
  readonly target?: string;
}

/** Receipt returned when an app delivers a result to the host. */
export interface DeliveryReceipt {
  readonly accepted: boolean;
  readonly message?: string;
}

/**
 * Sistemas de processo administrativo / editor de documentos: SEI, Siga-Doc, …
 *
 * Implemented by host adapters that manage administrative documents.
 *
 * The methods below `readCurrentContent`/`getSinkConfig`/`deliverResult`
 * replace the historical Apoia `get-source`/`get-sink`/submit triad: apps
 * now call them via the standard CapabilityBus instead of via ad-hoc messages.
 */
export interface IDocumentManagementSystem {
  readonly capabilityId: 'document';
  /** Returns the document currently open in the host, or null. */
  getOpenDocument(ctx: ContextPayload): Promise<DocumentRef | null>;
  /** Reads the textual content of a document. */
  readDocumentContent(ref: DocumentRef, ctx: ContextPayload): Promise<string>;
  /**
   * Writes content back into a document. Used when an app returns a
   * reviewed/summarized text that must be persisted in the host.
   */
  writeDocumentContent(
    ref: DocumentRef,
    content: string,
    ctx: ContextPayload,
  ): Promise<void>;

  // --- Session-scoped methods (called by apps during a session) ---

  /** Replaces the historical `get-source` message: app pulls current content. */
  readCurrentContent(sessionCtx: SessionContext): Promise<DocumentContent>;
  /** Replaces the historical `get-sink` message: asks where the result goes. */
  getSinkConfig(sessionCtx: SessionContext): Promise<SinkConfig>;
  /** Replaces the historical `sink submit`: delivers the final text to the host. */
  deliverResult(text: string, sessionCtx: SessionContext): Promise<DeliveryReceipt>;
}

/**
 * Auth helper capability offered by the host.
 *
 * Apps that need OAuth popups (e.g. Apoia's Keycloak flow) call this instead
 * of trying to `window.open` from inside an iframe (which browsers block).
 */
export interface IAuthHelper {
  readonly capabilityId: 'auth';
  /**
   * Opens a popup OUTSIDE the iframe (via window.open from the top frame).
   * Returns when the popup closes or the app signals auth-completed.
   */
  openAuthPopup(url: string): Promise<{ readonly status: 'completed' | 'cancelled' }>;
}

// --- App-side: interactive assistant ---------------------------------------

/**
 * Category used to group apps in the menu.
 */
export type IntentCategory = 'ai' | 'feedback' | 'utility';

/**
 * Stable string identifiers for the well-known assistant intents.
 *
 * The union is closed for the built-in intents, but apps MAY extend with
 * their own intent strings (intersected via `& string`).
 */
export type AssistantIntent =
  | 'summarize'
  | 'review'
  | 'draft'
  | 'refine'
  | 'minuta'
  | 'chat'
  | 'collect-feedback'
  | (string & {});

/** Description of one intent an assistant supports (used to build the menu). */
export interface IntentDescriptor<T extends string = AssistantIntent> {
  readonly intent: T;
  /** Display label (e.g. "Resumir", "Avaliar sistema"). */
  readonly label: string;
  readonly icon?: string;
  readonly category: IntentCategory;
}

/** Lifecycle status of an active session. */
export type SessionStatus =
  | 'starting'
  | 'ready'
  | 'approved'
  | 'cancelled'
  | 'error';

/** Handle returned when an app starts a session. */
export interface SessionHandle {
  readonly sessionId: string;
  readonly status: SessionStatus;
  /**
   * Intents the app can serve in THIS session. Usually equal to the assistant's
   * full listIntents(), but may be filtered per-context.
   */
  readonly intents: readonly IntentDescriptor[];
}

/**
 * Generic interactive assistant.
 *
 * Every app (Apoia, Assis, NPS) implements this — the difference is whether
 * they expose a UI (iframe or React root) via their AppDescriptor.
 *
 * Old RPC-style methods (summarize/review/draft) are gone: to "trigger a
 * summary", call `beginSession('summarize', ctx)`. The app shows its UI inside
 * the iAgente sidebar and returns the result via `host.deliverResult(...)`.
 */
export interface IInteractiveAssistant<T extends string = AssistantIntent> {
  /** Returns the intents this assistant supports (for menu rendering). */
  listIntents(): Promise<readonly IntentDescriptor<T>[]>;
  /** Begins a session for an intent. The kernel wires up UI + transport. */
  beginSession(intent: T, ctx: LaunchContext): Promise<SessionHandle>;
  /** Ends a session, giving the app a chance to clean up. */
  endSession(sessionId: string): Promise<void>;
}

/**
 * Structured launch context sent on `app.launch` (post-handshake) AND passed
 * as params to `beginSession` for in-process apps.
 */
export interface LaunchContext {
  readonly intent: AssistantIntent;
  readonly user: UserIdentity;
  readonly case?: CaseRef;
  readonly document?: DocumentRef;
  /**
   * Content provided up-front to avoid a round-trip to readCurrentContent.
   * Apps that exist only in iframe mode can ignore this and call the host.
   */
  readonly initialContent?: string;
  /**
   * Extra, app-specific params historically encoded in URL query strings
   * (instance, action, prompt, sink-button-text, ...).
   */
  readonly extra?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Apps de IA: Apoia, Assis. capability 'ai'.
 *
 * Specialises IInteractiveAssistant on the AI-specific intent set.
 */
export interface IAICollaborator
  extends IInteractiveAssistant<'summarize' | 'review' | 'draft' | 'refine' | 'minuta' | 'chat'> {
  readonly capabilityId: 'ai';
}

/**
 * Apps de feedback / NPS. capability 'feedback'.
 */
export interface IFeedbackCollector
  extends IInteractiveAssistant<'collect-feedback'> {
  readonly capabilityId: 'feedback';
}

// --- Capability catalog -----------------------------------------------------

/**
 * Master catalog of capability interfaces.
 *
 * The Capability Registry stores adapters keyed by the literal `capabilityId`.
 * Consumers request a capability by that key and get back a typed proxy.
 *
 * `auth` is host-side (apps call it); `ai` and `feedback` are app-side.
 */
export interface CapabilityCatalog {
  readonly case: ICaseManagementSystem;
  readonly document: IDocumentManagementSystem;
  readonly auth: IAuthHelper;
  readonly ai: IAICollaborator;
  readonly feedback: IFeedbackCollector;
}

/** A union of all known capability keys. */
export type CapabilityKey = keyof CapabilityCatalog;

/** Resolve the interface type for a given capability key. */
export type CapabilityOf<K extends CapabilityKey> = CapabilityCatalog[K];

/** Static map from capabilityId → the interface it represents. */
export const CAPABILITY_NAMESPACES: Readonly<Record<CapabilityKey, string>> = {
  case: 'case',
  document: 'document',
  auth: 'auth',
  ai: 'ai',
  feedback: 'feedback',
} as const;
