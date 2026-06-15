import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApiHeaders, extractSlideUrls } from '../src/extract.js';

describe('extract', () => {
  it('should build API headers from manifest', () => {
    const manifest = {
      classroomId: '123',
      cookies: {
        sessionid: 'abc',
        csrftoken: 'csrf',
        uv_id: '456',
        university_id: '789',
        xtbz: 'ykt',
      },
      headers: {
        'User-Agent': 'CustomAgent',
      },
    };

    const referer = 'https://changjiang.yuketang.cn/v2/web/student-v3/123/lesson1/activity1';
    const headers = buildApiHeaders(manifest, referer);
    assert.ok(headers.Cookie.includes('sessionid=abc'));
    assert.equal(headers['classroom-id'], '123');
    assert.equal(headers['university-id'], '789');
    assert.equal(headers['uv-id'], '456');
    assert.equal(headers['xtbz'], 'ykt');
    assert.equal(headers['X-CSRFToken'], 'csrf');
    assert.equal(headers['User-Agent'], 'CustomAgent');
    assert.equal(headers.Referer, referer);
  });

  it('should throw when sessionid is missing', () => {
    const manifest = {
      classroomId: '123',
      cookies: {},
    };

    assert.throws(
      () => buildApiHeaders(manifest, 'lesson1'),
      /sessionid/
    );
  });

  it('should extract slide urls and deduplicate by index', () => {
    const timelineList = [
      { type: 'slide', index: 1, firstTime: 200, cover: 'http://a/2.jpg', visible: true },
      { type: 'slide', index: 1, firstTime: 100, cover: 'http://a/1.jpg', visible: true },
      { type: 'slide', index: 2, firstTime: 300, cover: 'http://a/3.jpg', visible: true },
      { type: 'slide', index: 3, firstTime: 400, cover: 'http://a/4.jpg', visible: false },
      { type: 'other', index: 4, firstTime: 500, cover: 'http://a/5.jpg' },
    ];

    const urls = extractSlideUrls(timelineList);
    assert.equal(urls.length, 2);
    assert.equal(urls[0], 'http://a/1.jpg');
    assert.equal(urls[1], 'http://a/3.jpg');
  });
});
