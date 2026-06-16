import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { runVerifyAuth, runListCourses } from '../src/verify-auth.js';

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

describe('list-courses config', () => {
  it('should recognize list-courses subcommand', () => {
    const config = loadConfig(['node', 'src/index.js', 'list-courses', '--manifest', './manifest.json']);
    assert.equal(config.listCourses, true);
  });

  it('should require manifest or course for list-courses', () => {
    assert.throws(
      () => loadConfig(['node', 'src/index.js', 'list-courses']),
      /list-courses/
    );
  });
});

describe('verify-auth run', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    process.env.RAIN_COOKIES = JSON.stringify({
      sessionid: 's',
      csrftoken: 'c',
      uv_id: '0',
      university_id: '0',
      xtbz: 'ykt',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.RAIN_COOKIES;
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
    ]);

    const result = await runVerifyAuth(config);
    assert.equal(result.ok, false);
  });

  it('should list courses', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        errcode: 0,
        errmsg: 'ok',
        data: {
          list: [
            { classroom_id: '13522533', name: '班1', course: { name: '计算机网络' }, teacher: { name: '杨' } },
            { classroom_id: '14737547', name: '班2', course: { name: '计算机网络' }, teacher: { name: '蔡' } },
          ],
        },
      }),
    });

    const config = loadConfig([
      'node',
      'src/index.js',
      'list-courses',
      '--course',
      'A',
    ]);

    const result = await runListCourses(config);
    assert.equal(result.ok, true);
    assert.equal(result.courses.length, 2);
    assert.equal(result.courses[0].courseName, '计算机网络');
  });
});
