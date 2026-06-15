import { describe, expect, test } from 'bun:test';
import { BrainApiError, createBrainClient } from './client.ts';

const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;
const HTTP_UNAUTHORIZED = 401;

describe('unwrap', () => {
  const { unwrap } = createBrainClient({ domain: '' });

  test('returns data on success', () => {
    expect(unwrap({ data: { ok: true }, error: null, status: HTTP_OK })).toEqual({ ok: true });
  });

  test('throws BrainApiError carrying the status on error', () => {
    try {
      unwrap({
        data: null,
        error: { status: HTTP_SERVER_ERROR, value: 'boom' },
        status: HTTP_SERVER_ERROR,
      });
      throw new Error('expected unwrap to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BrainApiError);
      expect((error as BrainApiError).status).toBe(HTTP_SERVER_ERROR);
    }
  });

  test('invokes onUnauthorized and prefers the configured message on 401', () => {
    let called = false;
    const client = createBrainClient({
      domain: '',
      onUnauthorized: () => {
        called = true;
      },
      unauthorizedMessage: 'session expired',
    });

    expect(() =>
      client.unwrap({
        data: null,
        error: { status: HTTP_UNAUTHORIZED, value: 'no' },
        status: HTTP_UNAUTHORIZED,
      }),
    ).toThrow('session expired');
    expect(called).toBe(true);
  });
});
