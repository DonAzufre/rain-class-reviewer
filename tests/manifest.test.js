import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalize, cookieString } from '../src/manifest.js';

describe('manifest', () => {
  it('should validate full-url manifest', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
      cookies: { sessionid: 'abc' },
      lessons: [{
        lessonId: 'l1',
        date: '2025-01-01',
        title: 'Lesson 1',
        images: ['https://example.com/1.jpg'],
      }],
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.lessons[0].images.length, 1);
    assert.ok(manifest.extractedAt);
  });

  it('should normalize slideManifest into image URLs', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
      cookies: { sessionid: 'abc' },
      lessons: [{
        lessonId: 'l1',
        slideManifest: {
          slideId: '39717931',
          expire: '1781444297',
          tokenBase: 'IAM-base',
          timestamp: '20260609152755',
          slideDetails: [
            { coverId: '23567', tokenSuffix: 'suffix1' },
          ],
        },
      }],
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.lessons[0].images.length, 1);
    assert.match(manifest.lessons[0].images[0], /\/slide\/39717931\/cover23567_20260609152755\.jpg/);
  });

  it('should mark lesson for extraction when images are missing', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
      cookies: { sessionid: 'abc' },
      lessons: [{
        lessonId: 'l1',
        date: '2025-01-01',
        title: 'Lesson 1',
      }],
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.lessons[0].images.length, 0);
    assert.equal(manifest.lessons[0].needsExtraction, true);
  });

  it('should build cookie string', () => {
    const cookies = { sessionid: 'abc', userid: '123' };
    const str = cookieString(cookies);
    assert.equal(str, 'sessionid=abc; userid=123');
  });
});
