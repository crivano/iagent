/**
 * JSON-RPC 2.0 message types — https://www.jsonrpc.org/specification
 *
 * Used as the wire format for ALL communication between iAgente and:
 * - external apps (via postMessage, see @iagente/rpc PostMessageTransport)
 * - host adapters (via in-process transport)
 *
 * Why JSON-RPC:
 * - Standard `id` enables request/response correlation over async channels.
 * - `method` string maps naturally to "namespace.methodName" of a TS interface,
 *   which @iagente/rpc's createRpcProxy exploits to auto-route interface calls.
 * - Notifications (no `id`) support fire-and-forget events.
 */

/** A value that can be JSON-serialized. */
export type Json = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: Json;
}
export interface JsonArray extends Array<Json> {}

/** ID used to correlate a Request with its Response. `null` is reserved. */
export type RequestId = number | string;

/** A structured value (object) or a positional value (array). */
export type Params = JsonObject | JsonArray;

/** JSON-RPC 2.0 Request: expects a Response with the same `id`. */
export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: RequestId;
  readonly method: string;
  readonly params?: Params;
}

/** JSON-RPC 2.0 Notification: fire-and-forget (no Response). */
export interface JsonRpcNotification {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: Params;
}

/** Standard JSON-RPC error codes. */
export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  /** Application-defined errors should use the range -32000 to -32099. */
  ServerError = -32000,
}

/** JSON-RPC 2.0 Error object. */
export interface JsonRpcError {
  readonly code: number;
  readonly message: string;
  /** Additional diagnostic data (stack trace, context, etc.). */
  readonly data?: Json;
}

/** JSON-RPC 2.0 Response (success). */
export interface JsonRpcSuccessResponse {
  readonly jsonrpc: '2.0';
  readonly id: RequestId;
  readonly result: Json;
}

/** JSON-RPC 2.0 Response (error). */
export interface JsonRpcErrorResponse {
  readonly jsonrpc: '2.0';
  readonly id: RequestId | null;
  readonly error: JsonRpcError;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

/** Any JSON-RPC message. */
export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse;

// --- Discriminators / guards -----------------------------------------------

/** Structural check for the `jsonrpc: "2.0"` envelope all messages carry. */
function isEnvelope(m: unknown): m is { jsonrpc: '2.0' } {
  return (
    typeof m === 'object' &&
    m !== null &&
    (m as { jsonrpc?: unknown }).jsonrpc === '2.0'
  );
}

export function isRequest(m: JsonRpcMessage): m is JsonRpcRequest {
  return (
    isEnvelope(m) &&
    'method' in m &&
    typeof (m as JsonRpcRequest).method === 'string' &&
    'id' in m &&
    typeof (m as JsonRpcRequest).id !== 'undefined'
  );
}

export function isNotification(m: JsonRpcMessage): m is JsonRpcNotification {
  return (
    isEnvelope(m) &&
    'method' in m &&
    typeof (m as JsonRpcNotification).method === 'string' &&
    !('id' in m)
  );
}

export function isSuccessResponse(m: JsonRpcMessage): m is JsonRpcSuccessResponse {
  return isEnvelope(m) && 'result' in m && !('error' in m);
}

export function isErrorResponse(m: JsonRpcMessage): m is JsonRpcErrorResponse {
  return isEnvelope(m) && 'error' in m;
}

export function isResponse(m: JsonRpcMessage): m is JsonRpcResponse {
  return isSuccessResponse(m) || isErrorResponse(m);
}

/** Sentinel value used internally for the JSON-RPC version. */
export const JSONRPC_VERSION = '2.0' as const;
