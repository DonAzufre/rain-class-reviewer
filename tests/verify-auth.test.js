import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { runVerifyAuth } from '../src/verify-auth.js';

describe('verify-auth config', () => {
  it('should recognize verify-auth subcommand', () => {
    const config = loadConfig(['node', 'src/index.js', 'verify-auth', '--manifest', './manifest.json']);
    assert.equal(config.verifyAuth, true);
  });

  it('should require manifest or course for verify-auth', () => {
    assert.throws(
      () => loadConfig(['node', 'src/index.js', 'verify-auth']),
      /verify-auth/
    );
  });
});

describe('verify-auth run', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should report ok when course list succeeds', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errcode: 0, errmsg: 'ok', data: { list: [{ classroom_id: '1', course: { name: 'A' } }] } }),
    });

    const config = loadConfig([
      'node',
      'src/index.js',
      'verify-auth',
      '--course',
      'A',
      '--cookies',
      '{"sessionid":"s","csrftoken":"c","uv_id":"2874","university_id":"2874","xtbz":"ykt"}',
    ]);

    const result = await runVerifyAuth(config);
    assert.equal(result.ok, true);
  });

  it('should report failure on auth error', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errcode: 1001, errmsg: '未登录' }),
    });

    const config = loadConfig([
      'node',
      'src/index.js',
      'verify-auth',
      '--course',
      'A',
      '--cookies',
      '{"sessionid":"bad","csrftoken":"c","uv_id":"2874","university_id":"2874","xtbz":"ykt"}',
    ]);

    const result = await runVerifyAuth(config);
    assert.equal(result.ok, false);
  });
});
