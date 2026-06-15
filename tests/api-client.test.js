import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, isAuthError } from '../src/api-client.js';

describe('api-client', () => {
  it('should return data on successful response', async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ code: 0, data: { list: [1, 2] } }),
    });

    const data = await fetchJson('https://example.com/api', { headers: {} });
    assert.deepEqual(data, { list: [1, 2] });
  });

  it('should handle errcode response', async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ errcode: 1001, errmsg: '参数错误' }),
    });

    await assert.rejects(
      () => fetchJson('https://example.com/api', { headers: {} }),
      /参数错误/
    );
  });

  it('should throw on HTTP error', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => JSON.stringify({ msg: 'server error' }),
    });

    await assert.rejects(
      () => fetchJson('https://example.com/api', { headers: {} }, 0),
      /HTTP 500/
    );
  });

  it('should not retry auth errors', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;
      return {
        ok: true,
        text: async () => JSON.stringify({ code: 50000, msg: 'UNAUTHENTICATED' }),
      };
    };

    await assert.rejects(
      () => fetchJson('https://example.com/api', { headers: {} }, 3),
      /UNAUTHENTICATED/
    );
    assert.equal(callCount, 1);
  });

  it('should retry non-auth errors', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount += 1;
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => JSON.stringify({ msg: 'busy' }),
      };
    };

    await assert.rejects(
      () => fetchJson('https://example.com/api', { headers: {} }, 1),
      /HTTP 503/
    );
    assert.equal(callCount, 2);
  });

  it('should detect auth error from message', () => {
    assert.equal(isAuthError(new Error('UNAUTHENTICATED')), true);
    assert.equal(isAuthError(new Error('sessionid missing')), true);
    assert.equal(isAuthError(new Error('network error')), false);
  });
});
