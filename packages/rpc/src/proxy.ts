/**
 * RPC Proxy & Stub — turn a TypeScript interface into JSON-RPC over a transport.
 *
 * ## The core decoupling mechanism
 *
 * `createRpcProxy<T>(transport, namespace)` returns an object that *looks* like
 * an implementation of `T`, but every method call is converted to a JSON-RPC
 * request with method = `${namespace}.${methodName}` and routed over `transport`.
 *
 * `createRpcStub<T>(impl, namespace, transport)` does the inverse: it listens
 * for JSON-RPC requests on `transport` and dispatches them to a real object
 * implementing `T`, sending back the response.
 *
 * Because both sides only agree on the *interface* (and the namespace), the
 * caller and implementor are completely decoupled:
 *   - Swapping the IMPLEMENTOR (e.g. Apoia → Assis) needs no change to the proxy.
 *   - Swapping the CALLER (e.g. eproc → PJe) needs no change to the stub.
 *
 * This is what makes N hosts × M apps = N+M adapters (not N×M connections).
 */

import {
  JSONRPC_VERSION,
  JsonRpcErrorCode,
  isResponse,
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcError,
  type Params,
  type RequestId,
} from '@iagente/protocol';
import type { ITransport } from './transport.js';

// --- Errors -----------------------------------------------------------------

/** Error thrown on the proxy side when the stub returns a JSON-RPC error. */
export class RpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'RpcError';
  }

  static fromJsonRpcError(e: JsonRpcError): RpcError {
    return new RpcError(e.code, e.message, e.data);
  }

  toJsonRpcError(): JsonRpcError {
    return { code: this.code, message: this.message, data: this.data as never };
  }
}

// --- ID generation ----------------------------------------------------------

let _idCounter = 0;
/** Monotonic ID generator for request correlation. Wraps at MAX_SAFE_INTEGER. */
function nextRequestId(): RequestId {
  _idCounter = (_idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return _idCounter;
}

// --- Utility: namespace.methodName routing ----------------------------------

/** Builds a JSON-RPC method string from a namespace and method name. */
export function buildMethod(namespace: string, method: string): string {
  return `${namespace}.${method}`;
}

/** Parses a JSON-RPC method string into [namespace, method]. Returns null if malformed. */
export function parseMethod(fullMethod: string): [string, string] | null {
  const dot = fullMethod.indexOf('.');
  if (dot <= 0 || dot >= fullMethod.length - 1) return null;
  return [fullMethod.slice(0, dot), fullMethod.slice(dot + 1)];
}

// --- coercion of arbitrary params to JSON-RPC Params ------------------------

function toParams(args: unknown[]): Params | undefined {
  if (args.length === 0) return undefined;
  // Convention: methods take either no args or a single "params object" arg.
  // We pass it through as-is when it's a record; otherwise wrap positionally.
  const [first] = args;
  if (args.length === 1 && typeof first === 'object' && first !== null && !Array.isArray(first)) {
    return first as Params;
  }
  return args as unknown as Params;
}

function fromParams(params: Params | undefined, expectedCount: number): unknown[] {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params;
  // Single object param: return as [obj] for single-arg methods, or [] if none expected.
  if (expectedCount <= 1) return [params];
  return [params];
}

// --- Proxy ------------------------------------------------------------------

/**
 * Pending request bookkeeping for a single proxy instance.
 * One PendingMap is shared across all proxy methods.
 */
interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
}

/**
 * Options for createRpcProxy.
 */
export interface RpcProxyOptions {
  /**
   * Optional per-call timeout in ms. If exceeded, the promise rejects with
   * an RpcError of code -32000 (ServerError). 0 = no timeout.
   */
  readonly requestTimeoutMs?: number;
}

/**
 * Creates a proxy that marshals method calls on interface `T` into JSON-RPC
 * requests over `transport`.
 *
 * @param transport The channel to send/receive JSON-RPC messages on.
 * @param namespace The RPC namespace (matches the interface's capabilityId).
 *
 * @example
 *   const ai = createRpcProxy<IAICollaborator>(transport, 'ai');
 *   const result = await ai.summarize({ text: '...' });
 *   // → sends: { method: 'ai.summarize', params: { text: '...' }, id: 1 }
 */
export function createRpcProxy<T extends object>(
  transport: ITransport,
  namespace: string,
  options: RpcProxyOptions = {},
): T {
  const pending = new Map<RequestId, Pending>();
  const timeoutMs = options.requestTimeoutMs ?? 0;

  // Wire up the response handler once per proxy.
  transport.onMessage((msg: JsonRpcMessage) => {
    if (!isResponse(msg)) return;
    const entry = pending.get(msg.id ?? NaN);
    if (!entry) return; // not ours, or already resolved
    pending.delete(msg.id ?? NaN);

    if ('result' in msg) {
      entry.resolve(msg.result);
    } else {
      entry.reject(RpcError.fromJsonRpcError(msg.error));
    }
  });

  const proxy = new Proxy({} as Record<string, unknown>, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      // Return an async function that issues a JSON-RPC request.
      return (...args: unknown[]): Promise<unknown> => {
        const id = nextRequestId();
        const request: JsonRpcRequest = {
          jsonrpc: JSONRPC_VERSION,
          id,
          method: buildMethod(namespace, prop),
          params: toParams(args),
        };

        return new Promise((resolve, reject) => {
          const timeouts: ReturnType<typeof setTimeout>[] = [];
          if (timeoutMs > 0) {
            timeouts.push(
              setTimeout(() => {
                pending.delete(id);
                reject(
                  new RpcError(
                    JsonRpcErrorCode.ServerError,
                    `Request timed out after ${timeoutMs}ms: ${request.method}`,
                  ),
                );
              }, timeoutMs),
            );
          }
          pending.set(id, {
            resolve: (v) => {
              timeouts.forEach(clearTimeout);
              resolve(v);
            },
            reject: (e) => {
              timeouts.forEach(clearTimeout);
              reject(e);
            },
          });

          try {
            transport.send(request);
          } catch (err) {
            pending.delete(id);
            timeouts.forEach(clearTimeout);
            reject(err);
          }
        });
      };
    },
  });

  return proxy as T;
}

// --- Stub -------------------------------------------------------------------

/** A handler map for stubs: methodName → handler. */
type HandlerMap = Map<string, (params: unknown[]) => Promise<unknown>>;

/** Reads a HandlerMap from a target object that implements interface T. */
function buildHandlerMap<T extends object>(impl: T): HandlerMap {
  const map: HandlerMap = new Map();
  const SKIP = new Set<string>([
    'constructor',
    'capabilityId',
    'then', // avoid thenable confusion
    'toJSON',
  ]);

  // Collect own and prototype methods.
  const names = new Set<string>();
  for (const k of Object.keys(impl)) names.add(k);
  let proto = Object.getPrototypeOf(impl);
  while (proto && proto !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(proto)) {
      names.add(k);
    }
    proto = Object.getPrototypeOf(proto);
  }

  for (const name of names) {
    if (SKIP.has(name)) continue;
    const fn = (impl as Record<string, unknown>)[name];
    if (typeof fn !== 'function') continue;
    map.set(name, async (params) => {
      return await (fn as (...a: unknown[]) => unknown).apply(impl, params);
    });
  }
  return map;
}

/**
 * Exposes an implementation of interface `T` as a JSON-RPC server on the
 * given `transport` and `namespace`. Returns a disposer that stops listening.
 *
 * @example
 *   class ApoiaCollaborator implements IAICollaborator { ... }
 *   createRpcStub(new ApoiaCollaborator(), 'ai', transport);
 */
export function createRpcStub<T extends object>(
  impl: T,
  namespace: string,
  transport: ITransport,
): () => void {
  const handlers = buildHandlerMap(impl);

  return transport.onMessage(async (msg: JsonRpcMessage) => {
    // Only handle requests/notifications addressed to OUR namespace.
    if (!('method' in msg)) return; // responses handled by proxy, not stub
    const parsed = parseMethod((msg as JsonRpcRequest).method);
    if (!parsed) return;
    const [ns, methodName] = parsed;
    if (ns !== namespace) return;

    const handler = handlers.get(methodName);
    const isNotification = !('id' in msg);

    if (!handler) {
      if (!isNotification) {
        sendError(
          transport,
          (msg as JsonRpcRequest).id,
          JsonRpcErrorCode.MethodNotFound,
          `Method not found: ${(msg as JsonRpcRequest).method}`,
        );
      }
      return;
    }

    const params = fromParams((msg as JsonRpcRequest).params, handler.length);
    try {
      const result = await handler(params);
      if (!isNotification) {
        sendResult(transport, (msg as JsonRpcRequest).id, result);
      }
    } catch (err) {
      if (!isNotification) {
        const rpcErr =
          err instanceof RpcError
            ? err
            : new RpcError(
                JsonRpcErrorCode.InternalError,
                err instanceof Error ? err.message : String(err),
              );
        sendError(transport, (msg as JsonRpcRequest).id, rpcErr.code, rpcErr.message, rpcErr.data);
      }
    }
  });
}

// --- Response senders -------------------------------------------------------

function sendResult(transport: ITransport, id: RequestId, result: unknown): void {
  const response: JsonRpcResponse = {
    jsonrpc: JSONRPC_VERSION,
    id,
    result: result as never,
  };
  transport.send(response);
}

function sendError(
  transport: ITransport,
  id: RequestId,
  code: number,
  message: string,
  data?: unknown,
): void {
  const response: JsonRpcResponse = {
    jsonrpc: JSONRPC_VERSION,
    id,
    error: { code, message, data: data as never },
  };
  transport.send(response);
}
