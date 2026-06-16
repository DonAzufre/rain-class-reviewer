import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfig, loadApiKey } from '../src/config.js';

describe('config summarize', () => {

  it('should parse summarize subcommand', () => {
    const config = loadConfig(['node', 'index.js', 'summarize', '--course-dir', '/tmp/course']);
    assert.equal(config.summarize, true);
    assert.equal(config.courseDir, path.resolve('/tmp/course'));
    assert.equal(config.model, 'mimo-v2.5-pro');
    assert.equal(config.extractModel, 'mimo-v2.5');
    assert.equal(config.extractConcurrency, 2);
  });

  it('should parse lesson-dir and extract-concurrency', () => {
    const lessonDir = path.resolve('/tmp/course/lesson1');
    const config = loadConfig([
      'node', 'index.js', 'summarize',
      '--course-dir', '/tmp/course',
      '--lesson-dir', lessonDir,
      '--extract-concurrency', '1',
    ]);
    assert.equal(config.lessonDir, lessonDir);
    assert.equal(config.extractConcurrency, 1);
  });

  it('should require course-dir in summarize mode', () => {
    assert.throws(
      () => loadConfig(['node', 'index.js', 'summarize']),
      /course-dir/
    );
  });

  it('should load api key from MIMO_TP_API_KEY env var', () => {
    process.env.MIMO_TP_API_KEY = 'tp-env123';
    try {
      const key = loadApiKey();
      assert.equal(key, 'tp-env123');
    } finally {
      delete process.env.MIMO_TP_API_KEY;
    }
  });

  it('should throw when MIMO_TP_API_KEY env var is missing', () => {
    delete process.env.MIMO_TP_API_KEY;
    assert.throws(
      () => loadApiKey(),
      /MIMO_TP_API_KEY/
    );
  });

  it('should throw when MIMO_TP_API_KEY env var is invalid', () => {
    process.env.MIMO_TP_API_KEY = 'invalid-key';
    try {
      assert.throws(
        () => loadApiKey(),
        /tp-/
      );
    } finally {
      delete process.env.MIMO_TP_API_KEY;
    }
  });
});
