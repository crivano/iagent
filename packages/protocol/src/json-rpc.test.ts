import { describe, it, expect } from 'vitest';
import {
  isRequest,
  isNotification,
  isSuccessResponse,
  isErrorResponse,
  JSONRPC_VERSION,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
} from './index.js';

describe('JSON-RPC protocol', () => {
  describe('request/response round-trip', () => {
    it('round-trips a request through JSON without loss', () => {
      const req: JsonRpcRequest = {
        jsonrpc: JSONRPC_VERSION,
        id: 42,
        method: 'ai.summarize',
        params: { text: 'hello', maxWords: 10 },
      };
      const json = JSON.stringify(req);
      const back = JSON.parse(json) as JsonRpcRequest;

      expect(back.jsonrpc).toBe('2.0');
      expect(back.id).toBe(42);
      expect(back.method).toBe('ai.summarize');
      expect(back.params).toEqual({ text: 'hello', maxWords: 10 });
      expect(isRequest(back)).toBe(true);
    });

    it('round-trips a notification (no id)', () => {
      const notif: JsonRpcNotification = {
        jsonrpc: JSONRPC_VERSION,
        method: 'case.caseChanged',
        params: { number: '0001-23.456' },
      };
      const back = JSON.parse(JSON.stringify(notif)) as typeof notif;

      expect(back.id).toBeUndefined();
      expect(isNotification(back)).toBe(true);
      expect(isRequest(back)).toBe(false);
    });

    it('round-trips a success response', () => {
      const res: JsonRpcSuccessResponse = {
        jsonrpc: JSONRPC_VERSION,
        id: 42,
        result: { summary: 'ok', wordCount: 2 },
      };
      const back = JSON.parse(JSON.stringify(res)) as typeof res;

      expect(isSuccessResponse(back)).toBe(true);
      expect(back.result).toEqual({ summary: 'ok', wordCount: 2 });
    });

    it('round-trips an error response', () => {
      const res: JsonRpcErrorResponse = {
        jsonrpc: JSONRPC_VERSION,
        id: 42,
        error: { code: -32601, message: 'Method not found' },
      };
      const back = JSON.parse(JSON.stringify(res)) as typeof res;

      expect(isErrorResponse(back)).toBe(true);
      expect(back.error.code).toBe(-32601);
    });
  });

  describe('guards reject malformed input', () => {
    it('rejects non-conforming objects', () => {
      expect(isRequest({ foo: 'bar' } as unknown)).toBe(false);
      expect(isNotification({ method: 'x' } as unknown)).toBe(false);
      expect(isSuccessResponse({ result: 1 } as unknown)).toBe(false);
    });
  });

  describe('capability catalog namespaces', () => {
    it('exposes stable namespaces for all 4 capabilities', async () => {
      const { CAPABILITY_NAMESPACES } = await import('./index.js');
      expect(CAPABILITY_NAMESPACES.ai).toBe('ai');
      expect(CAPABILITY_NAMESPACES.case).toBe('case');
      expect(CAPABILITY_NAMESPACES.document).toBe('document');
      expect(CAPABILITY_NAMESPACES.feedback).toBe('feedback');
    });
  });
});
