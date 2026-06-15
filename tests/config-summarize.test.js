import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig, loadApiKey } from '../src/config.js';

describe('config summarize', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rain-config-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

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

  it('should load api key from inline value', () => {
    const key = loadApiKey({ apiKey: 'tp-test123' });
    assert.equal(key, 'tp-test123');
  });

  it('should load api key from file', () => {
    const keyPath = path.join(tempDir, 'key.txt');
    writeFileSync(keyPath, 'tp-fromfile\n');
    const key = loadApiKey({ apiKey: keyPath });
    assert.equal(key, 'tp-fromfile');
  });

  it('should throw when api key file is missing', () => {
    assert.throws(
      () => loadApiKey({ apiKey: path.join(tempDir, 'missing.txt') }),
      /不存在/
    );
  });

  it('should throw when api key file content is invalid', () => {
    const keyPath = path.join(tempDir, 'badkey.txt');
    writeFileSync(keyPath, 'invalid-key');
    assert.throws(
      () => loadApiKey({ apiKey: keyPath }),
      /格式不正确/
    );
  });
});
