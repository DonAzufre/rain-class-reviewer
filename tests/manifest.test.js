import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateAndNormalize, cookieString, readManifest } from '../src/manifest.js';

describe('manifest', () => {
  beforeEach(() => {
    process.env.RAIN_COOKIES = JSON.stringify({ sessionid: 'abc' });
  });

  afterEach(() => {
    delete process.env.RAIN_COOKIES;
  });

  it('should validate full-url manifest and convert images to single presentation', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
      lessons: [{
        lessonId: 'l1',
        date: '2025-01-01',
        title: 'Lesson 1',
        images: ['https://example.com/1.jpg'],
      }],
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.lessons[0].presentations.length, 1);
    assert.equal(manifest.lessons[0].presentations[0].images.length, 1);
    assert.equal(manifest.lessons[0].needsExtraction, false);
    assert.ok(manifest.extractedAt);
  });

  it('should keep presentations array as-is', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
      lessons: [{
        lessonId: 'l1',
        presentations: [
          { presentationId: 'p1', title: 'A', images: ['https://example.com/1.jpg'] },
          { presentationId: 'p2', title: 'B', images: ['https://example.com/2.jpg'] },
        ],
      }],
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.lessons[0].presentations.length, 2);
    assert.equal(manifest.lessons[0].needsExtraction, false);
  });

  it('should normalize slideManifest into single presentation', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
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
    assert.equal(manifest.lessons[0].presentations.length, 1);
    assert.equal(manifest.lessons[0].presentations[0].images.length, 1);
    assert.match(manifest.lessons[0].presentations[0].images[0], /\/slide\/39717931\/cover23567_20260609152755\.jpg/);
  });

  it('should mark lesson for extraction when images are missing', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
      lessons: [{
        lessonId: 'l1',
        date: '2025-01-01',
        title: 'Lesson 1',
      }],
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.lessons[0].presentations.length, 0);
    assert.equal(manifest.lessons[0].needsExtraction, true);
  });

  it('should build cookie string', () => {
    const cookies = { sessionid: 'abc', userid: '123' };
    const str = cookieString(cookies);
    assert.equal(str, 'sessionid=abc; userid=123');
  });

  it('should allow classroomId-only manifest and mark lesson discovery', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.needsDiscovery, false);
    assert.equal(manifest.needsLessonDiscovery, true);
    assert.deepEqual(manifest.lessons, []);
  });

  it('should mark full discovery when neither classroomId nor lessons provided', () => {
    const manifest = {
      courseName: 'Test Course',
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.needsDiscovery, true);
    assert.equal(manifest.needsLessonDiscovery, false);
    assert.deepEqual(manifest.lessons, []);
  });

  it('should reject manifest containing cookies field', () => {
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
      cookies: { sessionid: 'abc' },
    };

    assert.throws(() => validateAndNormalize(manifest), /RAIN_COOKIES/);
  });

  it('should read cookies from RAIN_COOKIES env var', () => {
    process.env.RAIN_COOKIES = JSON.stringify({ sessionid: 'env-session' });
    const manifest = {
      courseName: 'Test Course',
      classroomId: '123',
    };

    validateAndNormalize(manifest);
    assert.equal(manifest.cookies.sessionid, 'env-session');
  });

  it('should read cookies from RAIN_COOKIES env var via readManifest', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'rain-manifest-'));
    const manifestPath = path.join(tempDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({ version: '1.0', courseName: 'Env Course' }), 'utf-8');

    process.env.RAIN_COOKIES = JSON.stringify({ sessionid: 'env-session' });
    try {
      const manifest = readManifest(manifestPath);
      assert.equal(manifest.cookies.sessionid, 'env-session');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
